"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type BankBatch = {
  request_id: string;
  amount_per_user: number;
  recipient_count: number;
  total_hoo: number;
  note: string;
  created_at: string;
};
type Pending = { requestId: string; amount: number; note: string };
type Preview = { registeredUsers: number; missingWallets: number; recent: BankBatch[] };
const nf = new Intl.NumberFormat("ko-KR");

export default function CentralBankPage() {
  const supabase = useMemo(() => createClient(), []);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [userId, setUserId] = useState("");
  const [amountText, setAmountText] = useState("100");
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [denied, setDenied] = useState(false);
  const amount = Number(amountText);
  const valid = /^\d+$/.test(amountText) && Number.isSafeInteger(amount) && amount >= 1 && amount <= 1_000_000;

  const request = useCallback(async (method: "GET" | "POST", payload?: Pending) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("로그인이 필요합니다.");
    const response = await fetch("/api/admin/central-bank", {
      method,
      cache: "no-store",
      headers: { Authorization: `Bearer ${data.session.access_token}`, ...(payload ? { "Content-Type": "application/json" } : {}) },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      if (response.status === 403) setDenied(true);
      throw new Error(typeof result.error === "string" ? result.error : "서버 응답 오류");
    }
    return result;
  }, [supabase]);

  const refresh = useCallback(async () => {
    try {
      const result = await request("GET");
      const next = {
        registeredUsers: Number(result.registeredUsers) || 0,
        missingWallets: Number(result.missingWallets) || 0,
        recent: Array.isArray(result.recent) ? result.recent as BankBatch[] : [],
      };
      setPreview(next);
      return next;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "지급 현황을 불러오지 못했습니다.");
      return null;
    }
  }, [request]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      if (!data.user) { setDenied(true); setMessage("먼저 로그인해 주세요."); return; }
      setUserId(data.user.id);
      try {
        const saved = window.localStorage.getItem(`hoo-bank-pending-v1:${data.user.id}`);
        if (saved) {
          const value = JSON.parse(saved) as Pending;
          if (typeof value.requestId === "string" && Number.isSafeInteger(value.amount) && value.amount > 0 && typeof value.note === "string") {
            setPending(value);
            setAmountText(String(value.amount));
            setNote(value.note);
          }
        }
      } catch { /* A corrupted local cache is never proof of completion. */ }
      await refresh();
    })();
    return () => { alive = false; };
  }, [supabase, refresh]);

  async function distribute() {
    if (working || denied || !preview || !valid || confirmation !== "지급") return;
    if (pending && (pending.amount !== amount || pending.note !== note.trim())) {
      setMessage("미확인 지급 요청이 있습니다. 입력값을 원래대로 되돌려 같은 요청을 재확인해 주세요.");
      return;
    }
    const total = preview.registeredUsers * amount;
    if (!window.confirm(`등록 사용자 ${nf.format(preview.registeredUsers)}명에게 각 ${nf.format(amount)} HOO를 지급합니다.\n예상 총발행량: ${nf.format(total)} HOO\n취소하거나 되돌리기 어려운 지급입니다. 실행할까요?`)) return;
    const transaction = pending ?? { requestId: crypto.randomUUID(), amount, note: note.trim() };
    setPending(transaction);
    window.localStorage.setItem(`hoo-bank-pending-v1:${userId}`, JSON.stringify(transaction));
    setWorking(true);
    setMessage("동일 요청번호로 지급 결과를 확인하고 있습니다…");
    try {
      const result = await request("POST", transaction);
      if (result.ok !== true) throw new Error("결과가 확정되지 않았습니다.");
      const count = Number(result.recipientCount) || 0;
      const paid = Number(result.totalHoo) || 0;
      setMessage(`${result.replayed ? "기존 지급 확인" : "지급 완료"}: ${nf.format(count)}명 · 총 ${nf.format(paid)} HOO`);
      window.localStorage.removeItem(`hoo-bank-pending-v1:${userId}`);
      setPending(null);
      setConfirmation("");
      await refresh();
    } catch (err) {
      setMessage((err instanceof Error ? err.message : "연결 오류") + " 지급 성공 여부가 불확실하므로 같은 요청번호로만 재시도해 주세요.");
    } finally { setWorking(false); }
  }

  return (
    <main className="min-h-screen bg-[#0f1f1a] px-4 py-10 text-[#e6f5ee]">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div><p className="text-sm text-emerald-300">HOO WORLD ADMIN</p><h1 className="text-3xl font-bold">🏦 중앙은행</h1></div>
          <Link className="rounded-lg border border-white/25 px-4 py-2 text-sm" href="/admin">관리자로 돌아가기</Link>
        </div>
        <p className="text-sm text-emerald-100/80">전체 등록 계정에 같은 수량을 추가 지급합니다. 기존 후코인 잔액은 그대로 유지됩니다.</p>
        {denied ? <div className="rounded-xl border border-rose-400/60 bg-rose-900/30 p-5">관리자 인증이 필요합니다. 이 페이지에서 지급할 수 없습니다.</div> : <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#1b382d] p-5"><p className="text-sm opacity-75">지급 대상</p><p className="text-2xl font-bold">{preview ? nf.format(preview.registeredUsers) : "—"}명</p></div>
            <div className="rounded-xl bg-[#1b382d] p-5"><p className="text-sm opacity-75">미생성 지갑</p><p className="text-2xl font-bold">{preview ? nf.format(preview.missingWallets) : "—"}개</p></div>
            <div className="rounded-xl bg-[#1b382d] p-5"><p className="text-sm opacity-75">예상 총발행량</p><p className="text-2xl font-bold">{preview && valid ? nf.format(preview.registeredUsers * amount) : "—"} HOO</p></div>
          </section>
          <section className="space-y-4 rounded-2xl border border-emerald-600/50 bg-[#182d26] p-6">
            <label className="block space-y-2"><span className="font-semibold">유저 한 명당 지급할 후코인 (HOO)</span>
              <input inputMode="numeric" type="number" min="1" max="1000000" step="1" disabled={working || !!pending} value={amountText} onChange={e => setAmountText(e.target.value)} className="w-full rounded-lg bg-white px-4 py-3 text-xl font-bold text-slate-900" /></label>
            <label className="block space-y-2"><span>지급 사유 (선택, 최대 120자)</span>
              <input maxLength={120} disabled={working || !!pending} value={note} onChange={e => setNote(e.target.value)} placeholder="예: 신규 콘텐츠 오픈 기념" className="w-full rounded-lg bg-white px-4 py-3 text-slate-900" /></label>
            {pending && <p className="rounded-lg border border-amber-300/40 bg-amber-400/15 p-3 text-sm text-amber-100">미확인 요청 존재: <code className="break-all">{pending.requestId}</code> · 새로운 지급 요청은 차단되며 같은 요청만 재확인합니다.</p>}
            <label className="block space-y-2"><span>실행 확인: <strong>지급</strong>을 입력해 주세요</span>
              <input value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={working} className="w-full rounded-lg bg-white px-4 py-3 text-slate-900" placeholder="지급" /></label>
            <button type="button" disabled={working || !preview || !valid || confirmation !== "지급" || preview.registeredUsers < 1}
              onClick={() => { void distribute(); }} className="w-full rounded-lg bg-emerald-500 px-5 py-4 text-lg font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
              {working ? "정산 확인 중…" : pending ? "기존 지급 요청 확인 / 재시도" : `전체 ${preview ? nf.format(preview.registeredUsers) : "—"}명에게 공평 지급`}
            </button>
            {message && <p role="status" className="rounded-lg bg-black/20 p-3 text-sm">{message}</p>}
          </section>
          <section className="rounded-2xl border border-white/15 bg-[#182d26] p-6">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">최근 지급 기록</h2>
              <button type="button" onClick={() => { void refresh(); }} className="rounded-md border border-white/20 px-3 py-1 text-sm">새로고침</button></div>
            <div className="space-y-2">{preview?.recent.length ? preview.recent.map(batch => (
              <div key={batch.request_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 p-3 text-sm">
                <div><div className="font-semibold">{nf.format(batch.amount_per_user)} HOO / {nf.format(batch.recipient_count)}명</div>
                <div className="opacity-70">{batch.note || "지급 사유 없음"} · {new Date(batch.created_at).toLocaleString("ko-KR")}</div></div>
                <strong>{nf.format(batch.total_hoo)} HOO</strong>
              </div>
            )) : <p className="text-sm opacity-70">기록이 아직 없습니다.</p>}</div>
          </section>
        </>}
      </div>
    </main>
  );
}

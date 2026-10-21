"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function HooHalloweenAdminPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [enabled, setEnabled] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: userResult, error: userError } = await supabase.auth.getUser();
        if (userError || !userResult.user) throw new Error("로그인 후 이용할 수 있습니다.");
        const [{ data: admin, error: adminError }, { data: current, error: currentError }] =
          await Promise.all([
            supabase.rpc("hoo_can_manage_site_theme"),
            supabase.rpc("hoo_get_site_theme"),
          ]);
        if (adminError) throw adminError;
        if (currentError) throw currentError;
        if (!alive) return;
        setAllowed(admin === true);
        setEnabled(current === true);
        if (admin !== true) setMessage("테마 관리자 권한이 없습니다. 관리자 UID 등록을 확인해 주세요.");
      } catch (error) {
        if (alive) setMessage(error instanceof Error ? error.message : "테마 설정을 불러올 수 없습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [supabase]);

  async function updateTheme(next: boolean) {
    if (saving || !allowed) return;
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("hoo_set_site_theme", { p_enabled: next });
      if (error) throw error;
      if (data !== next) throw new Error("서버 적용값이 요청값과 일치하지 않습니다.");
      setEnabled(next);
      window.dispatchEvent(new CustomEvent("hoo-seasonal-theme-change", { detail: { enabled: next } }));
      setMessage(next ? "할로윈 테마가 켜졌습니다. 접속자 화면에도 순차적으로 반영됩니다." : "할로윈 테마가 꺼졌습니다. 기존 HOO 디자인으로 복귀합니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "설정 변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0e1222] px-5 py-12 text-white">
      <div className="mx-auto max-w-2xl space-y-7">
        <Link href="/admin" className="text-sm text-violet-200 hover:underline">← 관리자 페이지로 돌아가기</Link>
        <div className="rounded-3xl border border-violet-400/25 bg-[#191c31] p-7 shadow-2xl">
          <div className="mb-4 text-xs font-bold tracking-[.2em] text-orange-300">HOO SITE · SEASONAL THEME</div>
          <h1 className="text-3xl font-black">🎃 할로윈 테마</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">홈·캘린더·플레이리스트에만 적용되는 가벼운 시즌 테마입니다. 후월드, 리듬후, 후코인 기능에는 영향을 주지 않습니다.</p>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-5">
            <div>
              <p className="text-sm font-bold">현재 상태</p>
              <p className="mt-1 text-xl font-black">{loading ? "불러오는 중..." : enabled ? "할로윈 테마 ON" : "기본 테마 OFF"}</p>
            </div>
            <button type="button" role="switch" aria-label="할로윈 테마 활성화" aria-checked={enabled} disabled={loading || saving || !allowed} onClick={() => void updateTheme(!enabled)} className={`relative h-12 w-24 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${enabled ? "border-orange-300 bg-orange-500" : "border-slate-500 bg-slate-700"}`}>
              <span className={`absolute left-1 top-1 h-10 w-10 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-12" : "translate-x-0"}`} />
            </button>
          </div>
          {message ? <p role="status" className="mt-5 rounded-xl bg-black/25 px-4 py-3 text-sm text-amber-100">{message}</p> : null}
          <p className="mt-6 text-xs leading-6 text-slate-400">관리자 전용 서버 RPC로 변경하며, 다른 접속자는 화면 포커스 시 또는 최대 약 90초 내에 새 설정을 확인합니다. 관리자가 아닌 계정에서는 버튼이 비활성화됩니다.</p>
        </div>
      </div>
    </main>
  );
}

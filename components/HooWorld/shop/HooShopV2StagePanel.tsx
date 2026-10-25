"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Product = { id: string; title: string; price_hoo: number | string; kind: string; asset_path: string | null };
type InventoryItem = { product_id: string; quantity: number };
type Gift = {
  id: string; product_id: string; quantity: number; sender_id?: string; recipient_id?: string;
  sender_nickname: string; status: string; message: string; created_at: string;
};
type Snapshot = {
  products: Product[]; inventory: InventoryItem[]; sentGifts: Gift[]; receivedGifts: Gift[];
};
type Recipient = { id: string; nickname: string };
type RecipientSearch = { recipients: Recipient[] };
type RecipientLookup = { recipient: Recipient };
type Mode = "shop" | "inventory" | "gifts";
type Action = "purchase" | "gift_purchase" | "gift_inventory" | "accept_gift";
type Command = {
  requestId: string; action: Action; productId?: string; quantity?: number;
  recipientId?: string; message?: string; giftId?: string;
};

const API = "/api/hoo-world/shop-v2";
// Shared, stage-only interaction event from an online HOO WORLD player sprite.
export const HOO_STAGE_GIFT_SELECT_EVENT = "hoo:shop-v2-stage-select-recipient";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tabs: { id: Mode; title: string }[] = [
  { id: "shop", title: "상점" },
  { id: "inventory", title: "인벤토리" },
  { id: "gifts", title: "선물함" },
];
const number = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const money = (value: unknown) => `${number(value).toLocaleString("ko-KR")} HOO`;
function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return [v.products, v.inventory, v.sentGifts, v.receivedGifts].every(Array.isArray);
}

/** Stage-only HOO WORLD shop UI. The database remains authoritative for all prices and payments. */
export default function HooShopV2StagePanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Mode>("shop");
  const [data, setData] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("스테이징 전용 화면입니다. 운영 후코인에는 영향을 주지 않습니다.");
  const [error, setError] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [nicknameQuery, setNicknameQuery] = useState("");
  const [recipientMatches, setRecipientMatches] = useState<Recipient[]>([]);
  const [recipientSearching, setRecipientSearching] = useState(false);
  const searchGeneration = useRef(0);
  const [giftNote, setGiftNote] = useState("");
  const [quantityText, setQuantityText] = useState("1");
  // Keep an unknown-outcome mutation's UUID+payload for safe user-initiated retries.
  // All server-side mutations are transactionally idempotent by requestId.
  const [unresolved, setUnresolved] = useState<Command | null>(null);
  // Show the gift opening only AFTER the server confirms the acceptance receipt.
  const [confirmedGift, setConfirmedGift] = useState<{ title: string; quantity: number } | null>(null);
  const pendingGiftCount = data?.receivedGifts.filter(g => g.status === "pending").length ?? 0;
  const fetching = useRef(false);
  const mutating = useRef(false);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    const id = ++sequence.current;
    try {
      const response = await fetch(API, { credentials: "same-origin", cache: "no-store" });
      const payload: unknown = await response.json();
      if (id !== sequence.current) return;
      if (!response.ok) {
        const code = payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error: unknown }).error) : String(response.status);
        setData(null);
        if (code === "STAGING_DISABLED") setMessage("스테이징 API가 비활성화되어 있습니다. 운영 DB를 변경하지 마세요.");
        else if (code === "UNAUTHORIZED") setMessage("스테이징 계정으로 로그인해야 합니다.");
        else setMessage(`상점 데이터 확인 불가: ${code}`);
        return;
      }
      if (!isSnapshot(payload)) throw new Error("상점 데이터 형식 오류");
      setData(payload);
    } catch (e) {
      if (id === sequence.current) setError(e instanceof Error ? e.message : "연결 오류");
    } finally {
      fetching.current = false;
      if (id === sequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);
  // A world character click selects only a candidate ID; staging DB confirms identity.
  // No periodic API request, automatic transaction, or trust in presence nickname.
  useEffect(() => {
    const handleWorldGiftTarget = (event: Event) => {
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      if (!detail || typeof detail !== "object") return;
      const candidate = detail as Record<string, unknown>;
      const uid = candidate.userId;
      if (typeof uid !== "string" || !UUID.test(uid)) return;
      const generation = ++searchGeneration.current;
      setOpen(true); setTab("shop");
      setRecipientMatches([]); setRecipientId(""); setRecipientName("");
      setRecipientSearching(true); setError("");
      setMessage("월드 이용자의 계정을 스테이징 서버에서 확인 중입니다.");
      void (async () => {
        try {
          const response = await fetch(`${API}?recipientId=${encodeURIComponent(uid)}`, {
            credentials: "same-origin", cache: "no-store"
          });
          const body: unknown = await response.json();
          if (generation !== searchGeneration.current) return;
          if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error) : `HTTP ${response.status}`);
          const person = (body as Partial<RecipientLookup>)?.recipient;
          if (!person || typeof person.id !== "string" || !UUID.test(person.id) ||
              person.id.toLowerCase() !== uid.toLowerCase() ||
              typeof person.nickname !== "string" || !person.nickname.trim())
            throw new Error("RECIPIENT_ID_MISMATCH");
          setRecipientId(person.id); setRecipientName(person.nickname);
          setNicknameQuery(person.nickname);
          setMessage(`수신자 확인 완료: ${person.nickname} · ${person.id.slice(0, 8)}…`);
        } catch (error) {
          if (generation === searchGeneration.current)
            setError(`월드 수신자 선택 실패: ${error instanceof Error ? error.message : "연결 오류"}`);
        } finally {
          if (generation === searchGeneration.current) setRecipientSearching(false);
        }
      })();
    };
    window.addEventListener(HOO_STAGE_GIFT_SELECT_EVENT, handleWorldGiftTarget);
    return () => window.removeEventListener(HOO_STAGE_GIFT_SELECT_EVENT, handleWorldGiftTarget);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || busy) return;
      if (confirmedGift) setConfirmedGift(null);
      else setOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, busy, confirmedGift]);

  const searchRecipients = async () => {
    const requested = nicknameQuery.trim();
    if (!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(requested)) {
      setError("닉네임은 한글·영문·숫자·밑줄 2~16자로 검색해 주세요."); return;
    }
    const generation = ++searchGeneration.current;
    setRecipientSearching(true); setRecipientMatches([]); setError("");
    try {
      const response = await fetch(`${API}?recipientSearch=${encodeURIComponent(requested)}`, {
        credentials: "same-origin", cache: "no-store"
      });
      const payload: unknown = await response.json();
      if (generation !== searchGeneration.current) return;
      if (!response.ok) throw new Error(
        payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error: unknown }).error) : `HTTP ${response.status}`
      );
      if (!payload || typeof payload !== "object" ||
          !Array.isArray((payload as unknown as RecipientSearch).recipients)) throw new Error("조회 응답 형식 오류");
      setRecipientMatches((payload as RecipientSearch).recipients.filter(person =>
        UUID.test(person.id) && typeof person.nickname === "string"));
    } catch (e) {
      if (generation === searchGeneration.current) setError(`수신자 검색 실패: ${e instanceof Error ? e.message : "조회 오류"}`);
    } finally { if (generation === searchGeneration.current) setRecipientSearching(false); }
  };

  const execute = useCallback(async (command: Command) => {
    if (!data || mutating.current) return;
    mutating.current = true;
    setUnresolved(command);
    setBusy(true); setError(""); setMessage("서버 처리 결과를 확인하는 중…");
    try {
      const response = await fetch(API, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(command),
      });
      const reply: unknown = await response.json();
      if (!response.ok) {
        const code = reply && typeof reply === "object" && "error" in reply
          ? String((reply as { error: unknown }).error) : String(response.status);
        if (response.status >= 500) {
          setError(`결과를 확정할 수 없습니다 (${code}). 동일 요청번호로 재확인하세요.`);
          return;
        }
        setUnresolved(null); // A definite rejected command cannot have committed.
        setError(`요청 거절: ${code}`);
        return;
      }
      if (!reply || typeof reply !== "object" || (reply as { ok?: boolean }).ok !== true) {
        setError("응답 확인이 불완전합니다. 같은 요청번호로 재확인하세요.");
        return;
      }
      // Confirmed transaction only; a timeout or uncertain error cannot trigger a reward animation.
      if (command.action === "accept_gift" && command.giftId) {
        const gift = data.receivedGifts.find(g => g.id === command.giftId);
        const title = data.products.find(p => p.id === gift?.product_id)?.title
          ?? gift?.product_id ?? "선물";
        if (gift) setConfirmedGift({ title, quantity: gift.quantity });
      }
      setUnresolved(null);
      setMessage("스테이징 요청 처리 결과가 확인됐습니다.");
      void refresh();
    } catch (e) {
      setError(`네트워크 결과 불명: ${e instanceof Error ? e.message : "오류"}. 같은 요청번호로 재확인하세요.`);
    } finally { mutating.current = false; setBusy(false); }
  }, [data, busy, refresh]);

  const issue = (action: Action, productId?: string, giftId?: string) => {
    if (!data || busy || mutating.current || unresolved) return;
    const cmd: Command = { action, requestId: crypto.randomUUID() };
    if (action === "accept_gift") {
      if (!giftId || !UUID.test(giftId)) { setError("유효하지 않은 선물 번호입니다."); return; }
      cmd.giftId = giftId;
    } else {
      const q = Number(quantityText);
      if (!Number.isSafeInteger(q) || q < 1 || q > 20 || !productId) {
        setError("수량은 1~20개 사이의 정수만 가능해요."); return;
      }
      cmd.productId = productId; cmd.quantity = q;
      if (action !== "purchase") {
        if (!UUID.test(recipientId) || !recipientName) {
          setError("검색 결과에서 선물 받을 사용자를 선택해 주세요."); return;
        }
        cmd.recipientId = recipientId;
        if (giftNote.length > 120) { setError("선물 메시지는 120자 이내입니다."); return; }
        cmd.message = giftNote;
      }
    }
    const selected = data.products.find(p => p.id === productId);
    const title = action === "accept_gift" ? "선물 수락" : action === "purchase" ? "본인 구매" : "아이템 선물";
    const price = action === "purchase" || action === "gift_purchase"
      ? `\n표시 가격: ${money(number(selected?.price_hoo) * (cmd.quantity ?? 1))}` : "";
    const recipientSummary = action === "gift_purchase" || action === "gift_inventory"
      ? `\n받는 사람: ${recipientName} (${recipientId})` : "";
    if (!window.confirm(`스테이징에서 ${title}을(를) 실행할까요?${price}${recipientSummary}\n요청번호: ${cmd.requestId}`)) return;
    void execute(cmd);
  };

  return <>
    <button type="button" onClick={() => { setTab("gifts"); setOpen(true); }}
      className="fixed bottom-[204px] right-5 z-[105] rounded-2xl border border-white/40 bg-[#495b87] px-4 py-2 text-sm font-bold text-white shadow-xl sm:right-6"
      aria-label="스테이징 받은 선물함 열기">🎁 선물함{pendingGiftCount > 0 ? ` ${pendingGiftCount}` : ""}</button>
    <button type="button" onClick={() => { setTab("shop"); setOpen(true); }}
      className="fixed bottom-[148px] right-5 z-[105] rounded-2xl border border-white/40 bg-[#284e3b] px-4 py-3 text-sm font-bold text-white shadow-xl sm:right-6"
      aria-label="HOO WORLD 스테이징 상점 열기">🛍️ 상점 실험실</button>
    {open && <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/65 p-3 sm:p-6" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="HOO WORLD 스테이징 상점" className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-[#f5f7eb] text-[#243d30] shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[#d5e0d0] p-4 sm:p-5">
          <div><p className="text-xs font-bold text-[#617963]">HOO WORLD · STAGING ONLY</p>
            <h2 className="text-lg font-black">아바타 상점 · 인벤토리 · 선물</h2></div>
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-xl bg-[#e0e9dc] px-4 py-2 font-bold">닫기</button>
        </header>
        <div className="flex gap-2 border-b border-[#d5e0d0] px-4 pt-3">
          {tabs.map(item => <button key={item.id} type="button" onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id} className={`rounded-t-xl px-4 py-2 font-bold ${tab === item.id ? "bg-[#346d4e] text-white" : "bg-white"}`}>
              {item.title}{item.id === "gifts" && pendingGiftCount > 0 ? ` · 대기 ${pendingGiftCount}` : ""}
            </button>)}
          <button type="button" onClick={() => void refresh()} disabled={loading || busy} className="ml-auto px-2 text-xs font-bold">{loading ? "조회 중" : "새로고침"}</button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">
          {message && <p role="status" className="mb-3 rounded-lg bg-[#e6eee2] p-3 text-sm">{message}</p>}
          {error && <p role="alert" className="mb-3 rounded-lg bg-[#ffe2de] p-3 text-sm font-semibold text-[#a32d25]">{error}</p>}
          {unresolved && <div className="mb-3 rounded-xl border border-amber-500 bg-amber-50 p-3 text-sm">
            <p className="font-bold">이전 요청의 성공 여부가 확인되지 않았습니다. 새 구매·선물을 차단했어요.</p>
            <p className="my-1 break-all text-xs">요청번호: {unresolved.requestId}</p>
            <button type="button" disabled={busy || !data} onClick={() => void execute(unresolved)} className="rounded-lg bg-amber-700 px-3 py-2 font-bold text-white">같은 요청 재확인</button>
          </div>}
          {!data && <p className="rounded-xl border border-dashed border-[#b5c5ae] p-6 text-center text-sm">독립 스테이징 DB와 API가 준비되어야 실제 상품을 표시합니다. 운영 기능은 활성화하지 않습니다.</p>}
          {data && <>
            <div className="mb-4 rounded-xl border border-[#d5e0d0] bg-white p-3 text-sm">
              <p className="font-bold">테스트 설정</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label>수량 (1~20)<input type="number" min="1" max="20" step="1" value={quantityText} onChange={e => setQuantityText(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
                <div>
                  <label htmlFor="hoo-stage7-lookup">선물 수신자 닉네임 검색</label>
                  <div className="mt-1 flex gap-2">
                    <input id="hoo-stage7-lookup" value={nicknameQuery}
                      onChange={e => { setNicknameQuery(e.target.value); setRecipientMatches([]); setRecipientId(""); setRecipientName(""); searchGeneration.current++; }}
                      placeholder="닉네임 앞부분 2~16자" maxLength={16} autoComplete="off"
                      className="min-w-0 flex-1 rounded-lg border p-2" />
                    <button type="button" disabled={recipientSearching || busy || !data || !!unresolved}
                      onClick={() => void searchRecipients()} className="rounded-lg bg-[#346d4e] px-3 text-sm font-bold text-white disabled:opacity-40">{recipientSearching ? "검색 중" : "검색"}</button>
                  </div>
                  <div aria-live="polite" className="mt-2 max-h-32 overflow-y-auto">
                    {recipientMatches.map(person => <button type="button" key={person.id}
                      className="mb-1 block w-full rounded-lg border bg-white px-2 py-1 text-left text-xs"
                      onClick={() => { setRecipientId(person.id); setRecipientName(person.nickname); setRecipientMatches([]); }}>
                      {person.nickname} · {person.id.slice(0, 8)}…
                    </button>)}
                  </div>
                  {recipientId && <p className="mt-1 break-all text-xs font-semibold text-[#346d4e]">선택됨: {recipientName} ({recipientId})</p>}
                </div>
              </div>
              <label className="mt-2 block">선물 메시지 (선택, 최대 120자)<input value={giftNote} onChange={e => setGiftNote(e.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border p-2" /></label>
              <p className="mt-2 text-xs text-[#697d69]">닉네임 중복 시 검색 결과의 계정 ID로 구분합니다. 월드 캐릭터의 🎁 버튼으로 선택할 경우 서버에서 수신자 ID를 다시 확인합니다.</p>
            </div>
            {tab === "shop" && <div className="grid gap-3 sm:grid-cols-2">{data.products.length === 0 && <p>등록된 스테이징 상품이 없습니다.</p>}
              {data.products.map(p => <article key={p.id} className="rounded-xl border border-[#d5e0d0] bg-white p-4">
                <p className="text-xs text-[#728477]">{p.kind} · {p.id}</p><h3 className="mt-1 font-black">{p.title}</h3>
                <p className="my-2 font-bold">{money(p.price_hoo)}</p>
                <div className="flex gap-2"><button type="button" disabled={busy || !!unresolved} onClick={() => issue("purchase", p.id)} className="rounded-lg bg-[#346d4e] px-3 py-2 text-sm font-bold text-white disabled:opacity-40">구매</button>
                  <button type="button" disabled={busy || !!unresolved} onClick={() => issue("gift_purchase", p.id)} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40">선물 구매</button></div>
              </article>)}</div>}
            {tab === "inventory" && <div className="space-y-2">{data.inventory.length === 0 && <p>인벤토리가 비어 있어요.</p>}
              {data.inventory.map(i => <article key={i.product_id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3">
                <div><strong>{data.products.find(p => p.id === i.product_id)?.title ?? i.product_id}</strong><p className="text-xs">보유 {i.quantity}개</p></div>
                <button type="button" disabled={busy || !!unresolved} onClick={() => issue("gift_inventory", i.product_id)} className="rounded-lg bg-[#346d4e] px-3 py-2 text-sm font-bold text-white disabled:opacity-40">보유품 선물</button>
              </article>)}</div>}
            {tab === "gifts" && <div className="space-y-5">
              <section><h3 className="mb-2 font-black">받은 선물</h3>{data.receivedGifts.length === 0 && <p className="text-sm">없음</p>}
                {data.receivedGifts.map(g => <article key={g.id} className="mb-2 rounded-xl border bg-white p-3 text-sm">
                  <strong>{g.sender_nickname} → {g.product_id} ×{g.quantity}</strong><p>상태: {g.status}</p>{g.message && <p>메시지: {g.message}</p>}
                  {g.status === "pending" && <button type="button" disabled={busy || !!unresolved} onClick={() => issue("accept_gift", undefined, g.id)} className="mt-2 rounded-lg bg-[#346d4e] px-3 py-2 font-bold text-white disabled:opacity-40">수락하여 인벤토리에 넣기</button>}
                </article>)}</section>
              <section><h3 className="mb-2 font-black">보낸 선물</h3>{data.sentGifts.length === 0 && <p className="text-sm">없음</p>}
                {data.sentGifts.map(g => <article key={g.id} className="mb-2 rounded-xl border bg-white p-3 text-sm"><strong>{g.product_id} ×{g.quantity}</strong> · {g.status}<p className="break-all text-xs">수신자: {g.recipient_id}</p></article>)}</section>
            </div>}
          </>}
          <p className="mt-5 text-xs font-medium text-[#667f6c]">이 패널은 개발·검증용입니다. 월드 캐릭터 선택 및 받은 선물함 조회는 스테이징에서만 제공됩니다. 운영 상점·실제 아바타 착용·사이트 전체 개인 알림함 연동은 아직 제공하지 않습니다.</p>
        </div>
      </section>
      {confirmedGift && <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4" role="presentation">
        <section role="dialog" aria-modal="true" aria-label="수락 완료된 선물 개봉" className="w-full max-w-sm rounded-3xl border border-[#c8dbad] bg-[#fffdf2] p-7 text-center text-[#284e3b] shadow-2xl">
          <div aria-hidden="true" className="text-6xl motion-safe:animate-bounce">🎁</div>
          <h3 className="mt-3 text-xl font-black">선물 개봉 완료!</h3>
          <p className="mt-2 text-sm font-semibold">{confirmedGift.title} × {confirmedGift.quantity}</p>
          <p className="mt-2 text-xs">서버에서 수락이 확인되어 인벤토리에 반영됐습니다.</p>
          <button type="button" autoFocus onClick={() => { setConfirmedGift(null); setTab("inventory"); }}
            className="mt-5 rounded-xl bg-[#346d4e] px-5 py-3 font-bold text-white">인벤토리 확인</button>
        </section>
      </div>}
    </div>}
  </>;
}

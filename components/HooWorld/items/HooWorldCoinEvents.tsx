"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import { HOO_WORLD_DEFAULT_REGION_ID } from "@/components/HooWorld/world/hooWorldMap";

type Position = {
  x: number;
  y: number;
};

type Location = Position & {
  field_id: number;
};

type Coin = {
  coin_id: string;
  location: Location;
  expires_at: string;
};

type GiftBox = {
  box_id: string;
  location: Location;
  expires_at: string;
};

type Snapshot = {
  active_coins: Coin[];
  active_boxes: GiftBox[];
  next_coin_at: string | null;
  next_box_at: string | null;
};

type WorldReward = {
  id: string;
  kind: "coin" | "box";
  x: number;
  y: number;
  preview: boolean;
};

type Props = {
  regionId: string;
  playerPositionRef: MutableRefObject<Position>;
};

// 출시 전에는 코인 API를 호출하지 않는다.
// 실제 후코인 지급 권한과는 별개인 표시 전용 스위치.
const REWARD_EVENTS_VISIBLE =
  process.env.NEXT_PUBLIC_HOO_WORLD_COIN_EVENTS_ENABLED === "true";

// HOO_WORLD_REWARD_COLLECT_CLIENT_V1
// 서버 지급 스위치와 별개의 UI 안전 스위치
const CLAIM_UI_ENABLED =
  process.env.NEXT_PUBLIC_HOO_WORLD_REWARD_COLLECT_ENABLED === "true";

const INTERACTION_DISTANCE = 2.5;

function distance(
  a: Position,
  b: Position,
) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function resolveFieldId(regionId: string) {
  return regionId === HOO_WORLD_DEFAULT_REGION_ID ? 1 : 0;
}

export default function HooWorldCoinEvents({
  regionId,
  playerPositionRef,
}: Props) {
  const [snapshot, setSnapshot] =
    useState<Snapshot | null>(null);

  const [previewItems, setPreviewItems] =
    useState<WorldReward[]>([]);

  const [nearbyId, setNearbyId] =
    useState<string | null>(null);

  const [feedback, setFeedback] =
    useState<string | null>(null);

  const feedbackTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const claimBusyRef = useRef(false);

  const notify = useCallback((message: string) => {
    setFeedback(message);

    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
    }

    feedbackTimer.current = setTimeout(
      () => setFeedback(null),
      2500
    );
  }, []);

  // 개발 환경에서만 임시 오브젝트 표시.
  // 서버 DB 및 후코인 잔액은 절대 변경하지 않는다.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const params = new URLSearchParams(
      window.location.search
    );

    if (!params.has("previewCoinEvents")) return;

    const p = playerPositionRef.current;

    const x = Math.max(8, Math.min(90, p.x));
    const y = Math.max(16, Math.min(84, p.y));

    setPreviewItems([
      {
        id: "preview:coin",
        kind: "coin",
        x: x + 1.5,
        y,
        preview: true,
      },
      {
        id: "preview:box",
        kind: "box",
        x: x + 5,
        y,
        preview: true,
      },
    ]);
  }, [playerPositionRef]);

  // 최초 진입 및 실제 이벤트 일정에 맞춰 조회.
  // 반복적인 DB 폴링은 사용하지 않는다.
  useEffect(() => {
    // 출시 전에는 네트워크 요청 및 타이머 생성 금지
    if (!REWARD_EVENTS_VISIBLE) return;

    let disposed = false;
    let busy = false;

    let timer: ReturnType<typeof setTimeout> | null =
      null;

    async function refresh() {
      if (disposed || busy) return;

      busy = true;

      try {
        const response = await fetch(
          "/api/hoo-world/coin-events",
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(
            `COIN_EVENT_HTTP_${response.status}`
          );
        }

        const data = await response.json() as Snapshot;

        if (disposed) return;

        setSnapshot(data);

        const now = Date.now();

        // 한국시간 다음 자정: 일일 일정 갱신용
        const kstOffset = 9 * 60 * 60 * 1000;

        const nextMidnight =
          (Math.floor(
            (now + kstOffset) / 86400000
          ) + 1) * 86400000 - kstOffset;

        const future = [
          nextMidnight,
          data.next_coin_at,
          data.next_box_at,
          ...(data.active_coins ?? [])
            .map((coin) => coin.expires_at),
          ...(data.active_boxes ?? [])
            .map((box) => box.expires_at),
        ]
          .map((value) =>
            typeof value === "number"
              ? value
              : value ? Date.parse(value) : NaN
          )
          .filter(
            (value) =>
              Number.isFinite(value) && value > now
          );

        if (timer) clearTimeout(timer);

        const next = Math.min(...future);

        timer = setTimeout(
          () => void refresh(),
          Math.max(
            1500,
            Math.min(next - now + 1200, 86400000)
          )
        );

      } catch (error) {
        console.warn(
          "World coin events unavailable",
          error
        );
      } finally {
        busy = false;
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );
    const onRewardCollected = () => void refresh();

    window.addEventListener(
      "hoo-world:reward-collected",
      onRewardCollected
    );

    void refresh();

    return () => {
      disposed = true;

      if (timer) clearTimeout(timer);

      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
      window.removeEventListener(
        "hoo-world:reward-collected",
        onRewardCollected
      );
    };
  }, []);

  const items = useMemo<WorldReward[]>(() => {
    const fieldId = resolveFieldId(regionId);
    const now = Date.now();

    const coins = (snapshot?.active_coins ?? [])
      .filter(
        (coin) =>
          Number(coin.location?.field_id) === fieldId &&
          Date.parse(coin.expires_at) > now
      )
      .map((coin) => ({
        id: `coin:${coin.coin_id}`,
        kind: "coin" as const,
        x: Number(coin.location.x),
        y: Number(coin.location.y),
        preview: false,
      }));

    const boxes = (snapshot?.active_boxes ?? [])
      .filter(
        (box) =>
          Number(box.location?.field_id) === fieldId &&
          Date.parse(box.expires_at) > now
      )
      .map((box) => ({
        id: `box:${box.box_id}`,
        kind: "box" as const,
        x: Number(box.location.x),
        y: Number(box.location.y),
        preview: false,
      }));

    return [...coins, ...boxes, ...previewItems]
      .filter(
        (item) =>
          Number.isFinite(item.x) &&
          Number.isFinite(item.y)
      );
  }, [snapshot, previewItems, regionId]);

  const attemptInteraction = useCallback(
    async (item: WorldReward) => {
      const player = playerPositionRef.current;

      if (distance(player, item) > INTERACTION_DISTANCE) {
        notify("조금 더 가까이 이동해주세요.");
        return;
      }

      if (item.preview) {
        notify("🧪 테스트 상호작용 성공 · HOO 미지급");
        return;
      }

      if (!CLAIM_UI_ENABLED) {
        notify("🪙 보상 획득은 아직 준비 중입니다.");
        return;
      }

      if (claimBusyRef.current) return;

      const [kind, objectId] = item.id.split(":");

      if (
        (kind !== "coin" && kind !== "box") ||
        !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
          objectId ?? ""
        )
      ) return;

      claimBusyRef.current = true;

      try {
        const response = await fetch(
          "/api/hoo-world/coin-events/collect",
          {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ kind, objectId }),
          }
        );

        const data = await response.json()
          .catch(() => null);

        if (!response.ok || data?.success !== true) {
          const code = data?.code ?? data?.reason;

          notify(
            code === "POSITION_NOT_VERIFIED"
              ? "현재 위치가 확인되지 않아 획득할 수 없어요."
              : code === "TOO_FAR"
                ? "코인에 조금 더 가까이 이동해 주세요."
                : code === "COLLECT_NOT_RELEASED"
                  ? "🪙 보상 지급은 아직 준비 중입니다."
                  : "획득에 실패했어요. 잠시 후 다시 시도해 주세요."
          );

          return;
        }

        notify("🎉 후코인 획득 완료!");

        // 중복 클릭 방지를 위해 획득된 아이템 즉시 제거
        setSnapshot((current) => current ? {
          ...current,
          active_coins: current.active_coins.filter(
            (coin) => !(
              kind === "coin" && coin.coin_id === objectId
            )
          ),
          active_boxes: current.active_boxes.filter(
            (box) => !(
              kind === "box" && box.box_id === objectId
            )
          ),
        } : current);

        // 실제 데이터 변형 후 1회 조회
        window.dispatchEvent(
          new Event("hoo-world:reward-collected")
        );

      } catch {
        notify("네트워크 연결을 확인해 주세요.");
      } finally {
        claimBusyRef.current = false;
      }
    },
    [playerPositionRef, notify]
  );

  // 월드 좌표만 검사하므로 네트워크 요청은 없음.
  useEffect(() => {
    if (items.length === 0) {
      setNearbyId(null);
      return;
    }

    function updateNearby() {
      const player = playerPositionRef.current;

      const nearest = items
        .map((item) => ({
          item,
          dist: distance(player, item),
        }))
        .filter(
          (candidate) =>
            candidate.dist <= INTERACTION_DISTANCE
        )
        .sort((a, b) => a.dist - b.dist)[0];

      setNearbyId((previous) => {
        const next = nearest?.item.id ?? null;
        return previous === next ? previous : next;
      });
    }

    updateNearby();

    const interval = setInterval(updateNearby, 200);

    return () => clearInterval(interval);
  }, [items, playerPositionRef]);

  // 기존 F키 상호작용과 충돌하지 않도록
  // 코인 접근 범위 안에서만 키 입력을 사용한다.
  useEffect(() => {
    if (items.length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== "f" ||
        event.repeat ||
        event.isComposing ||
        event.defaultPrevented
      ) return;

      const target = event.target;

      if (
        target instanceof Element &&
        target.closest(
          'input,textarea,select,[contenteditable="true"]'
        )
      ) return;

      const player = playerPositionRef.current;

      const nearest = items
        .map((item) => ({
          item,
          dist: distance(player, item),
        }))
        .filter(
          (candidate) =>
            candidate.dist <= INTERACTION_DISTANCE
        )
        .sort((a, b) => a.dist - b.dist)[0];

      if (!nearest) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      attemptInteraction(nearest.item);
    }

    window.addEventListener(
      "keydown",
      onKeyDown,
      true
    );

    return () => {
      window.removeEventListener(
        "keydown",
        onKeyDown,
        true
      );
    };
  }, [items, playerPositionRef, attemptInteraction]);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  const nearby = items.find(
    (item) => item.id === nearbyId
  );

  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-label="후월드 코인 이벤트"
    >
      {items.map((item) => {
        const isNear = nearbyId === item.id;

        return (
          <button
            key={item.id}
            type="button"
            aria-label={
              item.kind === "coin"
                ? "후코인 이벤트 상호작용"
                : "코인 대박상자 상호작용"
            }
            title={
              item.preview
                ? "개발용 테스트 아이템"
                : "후코인 이벤트"
            }
            onClick={() => attemptInteraction(item)}
            className={`pointer-events-auto absolute flex items-center justify-center border-2 shadow-lg transition-transform ${
              item.kind === "coin"
                ? "h-10 w-10 rounded-full border-yellow-300 bg-amber-500/25 text-2xl"
                : "h-12 w-12 rounded-xl border-amber-300 bg-amber-600/25 text-3xl"
            } ${
              isNear
                ? "ring-2 ring-white ring-offset-2 ring-offset-transparent"
                : ""
            }`}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: "translate(-50%, -100%)",
              zIndex: Math.round(100 + item.y),
            }}
          >
            {item.kind === "coin" ? "🪙" : "🎁"}
          </button>
        );
      })}

      {nearby && (
        <div className="pointer-events-auto absolute bottom-[7%] left-1/2 z-[500] -translate-x-1/2">
          <button
            type="button"
            onClick={() => attemptInteraction(nearby)}
            className="whitespace-nowrap rounded-xl border border-amber-300 bg-neutral-950/90 px-4 py-3 text-sm font-bold text-white shadow-xl"
          >
            {nearby.kind === "coin"
              ? "🪙 F / 터치 · 코인 확인"
              : "🎁 F / 터치 · 상자 확인"}
          </button>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="absolute left-1/2 top-[12%] z-[600] w-max max-w-[85%] -translate-x-1/2 rounded-lg bg-neutral-950/90 px-4 py-3 text-center text-sm font-bold text-white shadow-lg"
        >
          {feedback}
        </div>
      )}

      {previewItems.length > 0 && (
        <div className="absolute left-1/2 top-3 z-[600] -translate-x-1/2 rounded-lg bg-neutral-950/85 px-3 py-2 text-xs font-bold text-yellow-300">
          개발용 이벤트 미리보기 · 보상 없음
        </div>
      )}
    </div>
  );
}

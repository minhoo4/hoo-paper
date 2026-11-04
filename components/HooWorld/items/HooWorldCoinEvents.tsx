"use client";

import { useEffect, useState } from "react";

type Location = {
  field_id: number;
  x: number;
  y: number;
};

type Coin = {
  coin_id: string;
  location: Location;
  expires_at: string;
};

type Box = {
  box_id: string;
  location: Location;
  expires_at: string;
};

type Snapshot = {
  active_coins: Coin[];
  active_boxes: Box[];
  next_coin_at: string | null;
  next_box_at: string | null;
};

export default function HooWorldCoinEvents({
  regionId,
}: {
  regionId: string;
}) {
  const [snapshot, setSnapshot] =
    useState<Snapshot | null>(null);

  useEffect(() => {
    let disposed = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      if (disposed || busy) return;
      busy = true;

      try {
        const response = await fetch(
          "/api/hoo-world/coin-events",
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`EVENT_HTTP_${response.status}`);
        }

        const data = (await response.json()) as Snapshot;

        if (disposed) return;

        setSnapshot(data);

        if (timer) clearTimeout(timer);

        const now = Date.now();
        const times = [
          data.next_coin_at,
          data.next_box_at,
          ...data.active_coins.map((v) => v.expires_at),
          ...data.active_boxes.map((v) => v.expires_at),
        ]
          .filter((value): value is string => Boolean(value))
          .map((value) => Date.parse(value))
          .filter((value) => Number.isFinite(value) && value > now);

        if (times.length > 0) {
          const next = Math.min(...times);
          timer = setTimeout(
            () => void refresh(),
            Math.min(Math.max(next - now + 1200, 1500), 86400000)
          );
        }
      } catch (error) {
        console.warn("Coin event snapshot unavailable", error);
      } finally {
        busy = false;
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    void refresh();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!snapshot) return null;

  // 현재 필드 1만 지원. 다른 지역에는 이벤트를 표시하지 않는다.
  const normalizedRegion = regionId.trim().toLowerCase();
  const currentFieldId =
    normalizedRegion === "main"
      ? 1
      : Number(normalizedRegion.match(/(\d+)$/)?.[1] ?? 0);

  const now = Date.now();

  const coins = snapshot.active_coins.filter(
    (coin) =>
      coin.location?.field_id === currentFieldId &&
      Date.parse(coin.expires_at) > now
  );

  const boxes = snapshot.active_boxes.filter(
    (box) =>
      box.location?.field_id === currentFieldId &&
      Date.parse(box.expires_at) > now
  );

  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-label="후월드 코인 이벤트"
    >
      {coins.map((coin) => (
        <div
          key={coin.coin_id}
          title="후코인 이벤트"
          className="absolute flex h-9 w-9 items-center justify-center rounded-full border-2 border-yellow-300 bg-yellow-500/20 text-2xl shadow-lg"
          style={{
            left: `${coin.location.x}%`,
            top: `${coin.location.y}%`,
            transform: "translate(-50%, -100%)",
            zIndex: Math.round(100 + coin.location.y),
          }}
        >
          🪙
        </div>
      ))}

      {boxes.map((box) => (
        <div
          key={box.box_id}
          title="코인 대박상자 이벤트"
          className="absolute flex h-12 w-12 items-center justify-center rounded-xl border-2 border-amber-400 bg-amber-500/20 text-3xl shadow-xl"
          style={{
            left: `${box.location.x}%`,
            top: `${box.location.y}%`,
            transform: "translate(-50%, -100%)",
            zIndex: Math.round(100 + box.location.y),
          }}
        >
          🎁
        </div>
      ))}
    </div>
  );
}

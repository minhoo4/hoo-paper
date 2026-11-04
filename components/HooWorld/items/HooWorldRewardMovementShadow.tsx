"use client";

import { useEffect, type MutableRefObject } from "react";
import {
  HOO_WORLD_DEFAULT_REGION_ID,
} from "@/components/HooWorld/world/hooWorldMap";

type Position = {
  x: number;
  y: number;
};

type MovementInput = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
};

type Props = {
  enabled: boolean;
  regionId: string;
  playerPositionRef: MutableRefObject<Position>;
  movementInputRef: MutableRefObject<MovementInput>;
};

const API = "/api/hoo-world/coin-events/movement";

const SHADOW_ENABLED =
  process.env.NEXT_PUBLIC_HOO_WORLD_REWARD_SHADOW_ENABLED === "true";

export default function HooWorldRewardMovementShadow({
  enabled,
  regionId,
  playerPositionRef,
  movementInputRef,
}: Props) {
  useEffect(() => {
    if (
      !SHADOW_ENABLED ||
      !enabled ||
      regionId !== HOO_WORLD_DEFAULT_REGION_ID
    ) {
      return;
    }

    let disposed = false;
    let ready = false;
    let busy = false;
    let sequence = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    let lastDirection = "0,0";
    let lastSent = 0;
    let warned = false;

    let queued: {
      dx: number;
      dy: number;
      x: number;
      y: number;
    } | null = null;

    async function flush() {
      if (!ready || busy || disposed) return;

      busy = true;

      try {
        while (queued && !disposed && ready) {
          const input = queued;
          queued = null;
          sequence += 1;

          const response = await fetch(API, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
            body: JSON.stringify({
              dx: input.dx,
              dy: input.dy,
              sequence,
            }),
          });

          if (!response.ok) {
            ready = false;
            break;
          }

          const data = await response.json();

          if (
            data?.success !== true ||
            data?.stale === true
          ) {
            ready = false;
            break;
          }

          const serverX = Number(data.x);
          const serverY = Number(data.y);

          if (
            !warned &&
            Number.isFinite(serverX) &&
            Number.isFinite(serverY)
          ) {
            const difference = Math.hypot(
              serverX - input.x,
              serverY - input.y
            );

            if (difference > 2.5) {
              warned = true;
              console.warn(
                "HOO_WORLD_REWARD_POSITION_DIVERGENCE",
                { difference }
              );
            }
          }
        }
      } catch (error) {
        ready = false;
        console.warn("Reward movement sync stopped", error);
      } finally {
        busy = false;
      }
    }

    async function initialize() {
      try {
        const response = await fetch(API, {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok || disposed) return;

        const data = await response.json();
        const initialSequence = Number(data?.last_sequence);

        if (
          data?.success !== true ||
          !Number.isSafeInteger(initialSequence) ||
          initialSequence < 0
        ) {
          return;
        }

        sequence = initialSequence;
        ready = true;

        timer = setInterval(() => {
          if (!ready || disposed) return;

          const current = { ...playerPositionRef.current };

          if (
            !Number.isFinite(current.x) ||
            !Number.isFinite(current.y)
          ) {
            return;
          }

          const input = movementInputRef.current;
          const visible = document.visibilityState === "visible";

          const dx = visible
            ? Number(input.right) - Number(input.left)
            : 0;

          const dy = visible
            ? Number(input.down) - Number(input.up)
            : 0;

          const direction = `${dx},${dy}`;
          const now = Date.now();

          if (
            direction === "0,0" &&
            lastDirection === "0,0"
          ) {
            return;
          }

          if (
            direction === lastDirection &&
            now - lastSent < 1000
          ) {
            return;
          }

          lastDirection = direction;
          lastSent = now;

          queued = {
            dx,
            dy,
            x: current.x,
            y: current.y,
          };

          void flush();
        }, 200);

      } catch (error) {
        console.warn(
          "Reward movement initialization failed",
          error
        );
      }
    }

    void initialize();

    return () => {
      disposed = true;
      ready = false;
      queued = null;

      if (timer) clearInterval(timer);
    };
  }, [enabled, regionId, playerPositionRef, movementInputRef]);

  return null;
}

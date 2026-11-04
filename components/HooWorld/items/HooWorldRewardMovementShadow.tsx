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

type MovementResponse = {
  success?: boolean;
  stale?: boolean;
  session_id?: string;
  x?: number;
  y?: number;
  last_sequence?: number;
  authority_eligible?: boolean;
};

const AUTHORITY_ENABLED =
  process.env.NEXT_PUBLIC_HOO_WORLD_REWARD_AUTHORITY_ENABLED === "true";

const API = "/api/hoo-world/coin-events/movement";

export default function HooWorldRewardMovementShadow({
  enabled,
  regionId,
  playerPositionRef,
  movementInputRef,
}: Props) {
  useEffect(() => {
    if (
      !AUTHORITY_ENABLED ||
      !enabled ||
      regionId !== HOO_WORLD_DEFAULT_REGION_ID
    ) return;

    let disposed = false;
    let ready = false;
    let busy = false;
    let sequence = 0;
    let sessionId = "";

    let lastDirection = "0,0";
    let lastSentAt = 0;

    let timer: ReturnType<typeof setInterval> | null = null;

    let queued: {
      dx: number;
      dy: number;
    } | null = null;

    function publish(
      data: MovementResponse,
      initial: boolean
    ) {
      const x = Number(data.x);
      const y = Number(data.y);

      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 5 || x > 95 ||
        y < 9 || y > 93
      ) return;

      const local = playerPositionRef.current;

      const difference = Math.hypot(
        local.x - x,
        local.y - y
      );

      // 서버 좌표를 캐릭터에 반영
      if (initial || difference > 0.75) {
        window.dispatchEvent(
          new CustomEvent(
            "hoo-world:reward-authority-position",
            {
              detail: {
                x,
                y,
                fieldId: 1,
                sessionId,
              },
            }
          )
        );
      }

      if (
        initial ||
        (queued === null && lastDirection === "0,0")
      ) {
        console.info(
          initial
            ? "HOO_WORLD_AUTHORITY_START"
            : "HOO_WORLD_AUTHORITY_STOP",
          {
            difference: Number(difference.toFixed(2)),
            serverX: Number(x.toFixed(2)),
            serverY: Number(y.toFixed(2)),
            sequence: data.last_sequence,
          }
        );
      }
    }

    async function request(
      body: Record<string, unknown>
    ): Promise<MovementResponse> {
      const response = await fetch(API, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          `MOVEMENT_HTTP_${response.status}`
        );
      }

      return await response.json() as MovementResponse;
    }

    async function flush() {
      if (!ready || busy || disposed) return;

      busy = true;

      try {
        while (queued && !disposed && ready) {
          const move = queued;
          queued = null;

          sequence += 1;

          const result = await request({
            action: "step",
            sessionId,
            dx: move.dx,
            dy: move.dy,
            sequence,
          });

          if (disposed) return;

          if (
            result.success !== true ||
            result.stale === true ||
            result.session_id !== sessionId
          ) {
            ready = false;
            return;
          }

          publish(result, false);
        }
      } catch (error) {
        ready = false;
        console.warn(
          "HOO_WORLD_AUTHORITY_STOPPED",
          error
        );
      } finally {
        busy = false;
      }
    }

    async function initialize() {
      try {
        // 서버에서 테스트 대상 여부 확인
        const response = await fetch(API, {
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!response.ok || disposed) return;

        const availability =
          await response.json() as MovementResponse;

        if (
          !availability.authority_eligible ||
          disposed
        ) return;

        // 서버가 위치 및 세션 발급
        const result = await request({
          action: "start",
        });

        if (
          disposed ||
          result.success !== true ||
          typeof result.session_id !== "string"
        ) return;

        sessionId = result.session_id;
        sequence = 0;
        ready = true;

        publish(result, true);

        // 로컬 입력을 관찰하되 DB 폴링은 하지 않음
        timer = setInterval(() => {
          if (disposed || !ready) return;

          const input = movementInputRef.current;

          const visible =
            document.visibilityState === "visible";

          const dx = visible
            ? Number(input.right) - Number(input.left)
            : 0;

          const dy = visible
            ? Number(input.down) - Number(input.up)
            : 0;

          const direction = `${dx},${dy}`;
          const now = Date.now();

          // 정지 상태 반복 요청 차단
          if (
            direction === "0,0" &&
            lastDirection === "0,0"
          ) return;

          // 같은 방향은 최소 800ms 간격
          if (
            direction === lastDirection &&
            now - lastSentAt < 800
          ) return;

          lastSentAt = now;
          lastDirection = direction;

          queued = { dx, dy };
          void flush();
        }, 100);

      } catch (error) {
        console.warn(
          "HOO_WORLD_AUTHORITY_START_FAILED",
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
  }, [
    enabled,
    regionId,
    playerPositionRef,
    movementInputRef,
  ]);

  return null;
}

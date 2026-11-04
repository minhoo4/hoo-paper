import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createSession } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers });
}

export async function GET() {
  // HOO_WORLD_REWARD_PRODUCTION_CANARY_V1
  // 운영 배포 시 지정 계정만 이벤트 조회 가능
  const canaryId =
    process.env.HOO_WORLD_REWARD_COLLECT_TEST_USER_ID;

  const emptySnapshot = {
    active_coins: [],
    active_boxes: [],
    next_coin_at: null,
    next_box_at: null,
  };

  if (!canaryId) {
    return Response.json({
      ...emptySnapshot,
      canary_diagnostic: "ENV_MISSING",
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { createClient: createCanarySession } =
    await import("@/lib/supabase/server");

  const canarySession = await createCanarySession();
  const { data: canaryAuth, error: canaryError } =
    await canarySession.auth.getUser();

  if (
    canaryError ||
    canaryAuth.user?.id !== canaryId
  ) {
    return Response.json({
      ...emptySnapshot,
      canary_diagnostic:
        canaryError
          ? "AUTH_ERROR"
          : canaryAuth.user?.id
            ? "ACCOUNT_MISMATCH"
            : "LOGIN_REQUIRED",
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  }


  try {
    const session = await createSession();
    const { data: auth, error: authError } =
      await session.auth.getUser();

    if (authError || !auth.user) {
      return json({ error: "AUTH_REQUIRED" }, 401);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return json({ error: "SERVER_CONFIG_MISSING" }, 503);
    }

    const admin = createAdmin(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // DB 출시 게이트를 서버에서 조회한다.
    const { data: releaseRows, error: releaseError } =
      await admin
        .from("hoo_feature_release_gates_v1")
        .select("feature_key,enabled")
        .in("feature_key", ["world_coin", "weekly_box"]);

    if (releaseError) {
      console.error("World event release check failed", {
        code: releaseError.code,
      });
      return json({ error: "EVENT_GATES_UNAVAILABLE" }, 503);
    }

    const released = new Set(
      (releaseRows ?? [])
        .filter((row) => row.enabled === true)
        .map((row) => row.feature_key)
    );

    let activeCoins: unknown[] = [];
    let nextCoinAt: string | null = null;
    let coinEventsAvailable = false;

    if (released.has("world_coin")) {
      const prepared = await session.rpc(
        "hoo_world_coin_prepare_today_v1"
      );

      if (prepared.error || prepared.data?.success !== true) {
        console.warn("World coin schedule unavailable", {
          code: prepared.error?.code ?? "PREPARE_NOT_READY",
        });
      } else {
        const coins = await session.rpc(
          "hoo_world_coin_activate_due_v1"
        );

        if (coins.error || coins.data?.success !== true) {
          console.warn("World coin activation unavailable", {
            code: coins.error?.code ?? "ACTIVATE_NOT_READY",
          });
        } else {
          activeCoins = Array.isArray(coins.data.active_coins)
            ? coins.data.active_coins
            : [];

          nextCoinAt =
            typeof coins.data.next_scheduled_at === "string"
              ? coins.data.next_scheduled_at
              : null;

          coinEventsAvailable = true;
        }
      }
    }

    // 대박상자 시스템은 일반 코인과 독립적으로 처리한다.
    // 출시 잠금이나 경제 보호 장치 오류가 발생해도
    // 일반 코인 생성·조회 결과를 유지한다.
    let activeBoxes: unknown[] = [];
    let nextBoxAt: string | null = null;
    let boxEventsAvailable = false;

    if (released.has("weekly_box")) {
      const weekly = await admin.rpc(
        "hoo_world_event_box_prepare_week_v2"
      );

      if (weekly.error || weekly.data?.success !== true) {
        console.warn("World weekly box unavailable", {
          code: weekly.error?.code ?? "PREPARE_NOT_READY",
        });
      } else {
        const boxes = await admin.rpc(
          "hoo_world_event_box_activate_due_v1"
        );

        if (boxes.error || boxes.data?.success !== true) {
          console.warn("World box activation unavailable", {
            code: boxes.error?.code ?? "ACTIVATE_NOT_READY",
          });
        } else {
          activeBoxes = Array.isArray(boxes.data.active_boxes)
            ? boxes.data.active_boxes
            : [];

          nextBoxAt =
            typeof boxes.data.next_scheduled_at === "string"
              ? boxes.data.next_scheduled_at
              : null;

          boxEventsAvailable = true;
        }
      }

    }

    return json({
      active_coins: activeCoins,
      coin_events_available: coinEventsAvailable,
      active_boxes: activeBoxes,
      next_coin_at: nextCoinAt,
      next_box_at: nextBoxAt,
      box_events_available: boxEventsAvailable,
    });
  } catch (error) {
    console.error("World coin event error", error);
    return json({ error: "WORLD_COIN_EVENT_UNAVAILABLE" }, 503);
  }
}

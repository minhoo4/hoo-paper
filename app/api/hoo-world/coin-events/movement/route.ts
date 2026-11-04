import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createSession } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers });

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createAdmin(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthorizedUser() {
  const session = await createSession();
  const { data, error } = await session.auth.getUser();

  return error ? null : data.user;
}

function eligible(userId: string) {
  const tester =
    process.env.HOO_WORLD_REWARD_AUTHORITY_TEST_USER_ID;

  return (
    process.env.HOO_WORLD_REWARD_AUTHORITY_ENABLED === "true" &&
    !!tester &&
    tester === userId
  );
}

export async function GET() {
  if (
    process.env.HOO_WORLD_REWARD_MOVEMENT_ENABLED !== "true"
  ) {
    return json({
      success: false,
      code: "MOVEMENT_NOT_RELEASED",
    }, 503);
  }

  try {
    const user = await getAuthorizedUser();

    if (!user) {
      return json({
        success: false,
        code: "AUTH_REQUIRED",
      }, 401);
    }

    const admin = adminClient();

    if (!admin) {
      return json({
        success: false,
        code: "SERVER_NOT_READY",
      }, 503);
    }

    const { data, error } = await admin
      .from("hoo_world_reward_move_states_v1")
      .select("x,y,field_id,last_sequence")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return json({
        success: false,
        code: "MOVEMENT_READ_FAILED",
      }, 503);
    }

    return json({
      success: true,
      authority_eligible: eligible(user.id),
      x: Number(data?.x ?? 50),
      y: Number(data?.y ?? 78),
      field_id: Number(data?.field_id ?? 1),
      last_sequence: Number(data?.last_sequence ?? 0),
      reward_enabled: false,
      proof_issued: false,
    });

  } catch (error) {
    console.error("Movement snapshot error", error);

    return json({
      success: false,
      code: "MOVEMENT_UNAVAILABLE",
    }, 503);
  }
}

export async function POST(request: Request) {
  if (
    process.env.HOO_WORLD_REWARD_MOVEMENT_ENABLED !== "true"
  ) {
    return json({
      success: false,
      code: "MOVEMENT_NOT_RELEASED",
    }, 503);
  }

  try {
    const user = await getAuthorizedUser();

    if (!user) {
      return json({
        success: false,
        code: "AUTH_REQUIRED",
      }, 401);
    }

    // 테스트 계정 외의 이동 상태 변경 차단
    if (!eligible(user.id)) {
      return json({
        success: false,
        code: "MOVEMENT_AUTHORITY_NOT_RELEASED",
      }, 403);
    }

    const size = Number(
      request.headers.get("content-length") ?? 0
    );

    if (size > 2048) {
      return json({
        success: false,
        code: "REQUEST_TOO_LARGE",
      }, 413);
    }

    const body: unknown = await request.json()
      .catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return json({
        success: false,
        code: "INVALID_REQUEST",
      }, 400);
    }

    const input = body as Record<string, unknown>;
    const admin = adminClient();

    if (!admin) {
      return json({
        success: false,
        code: "SERVER_NOT_READY",
      }, 503);
    }

    // 새 서버 이동 세션 발급
    if (input.action === "start") {
      const { data, error } = await admin.rpc(
        "hoo_world_reward_move_join_v2",
        { p_user_id: user.id }
      );

      if (error) {
        console.error("Movement start error", error.code);

        return json({
          success: false,
          code: "MOVEMENT_START_FAILED",
        }, 503);
      }

      return json(data);
    }

    if (input.action !== "step") {
      return json({
        success: false,
        code: "INVALID_ACTION",
      }, 400);
    }

    const {
      dx,
      dy,
      sequence,
      sessionId,
    } = input;

    if (
      !Number.isInteger(dx) ||
      !Number.isInteger(dy) ||
      ![-1, 0, 1].includes(dx as number) ||
      ![-1, 0, 1].includes(dy as number) ||
      !Number.isSafeInteger(sequence) ||
      (sequence as number) <= 0 ||
      typeof sessionId !== "string" ||
      !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(
        sessionId
      )
    ) {
      return json({
        success: false,
        code: "INVALID_MOVEMENT",
      }, 400);
    }

    const { data, error } = await admin.rpc(
      "hoo_world_reward_move_step_v2",
      {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_dx: dx,
        p_dy: dy,
        p_sequence: sequence,
      }
    );

    if (error) {
      console.error("Movement step error", error.code);

      return json({
        success: false,
        code: "MOVEMENT_STEP_FAILED",
      }, 409);
    }

    return json(data);

  } catch (error) {
    console.error("Movement request error", error);

    return json({
      success: false,
      code: "MOVEMENT_UNAVAILABLE",
    }, 503);
  }
}

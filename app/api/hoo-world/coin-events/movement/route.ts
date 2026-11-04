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
  if (
    process.env.HOO_WORLD_REWARD_MOVEMENT_ENABLED !== "true"
  ) {
    return json({
      success: false,
      code: "MOVEMENT_NOT_RELEASED",
    }, 503);
  }

  try {
    const session = await createSession();

    const { data: auth, error: authError } =
      await session.auth.getUser();

    if (authError || !auth.user) {
      return json({
        success: false,
        code: "AUTH_REQUIRED",
      }, 401);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return json({
        success: false,
        code: "SERVER_NOT_READY",
      }, 503);
    }

    const admin = createAdmin(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await admin
      .from("hoo_world_reward_move_states_v1")
      .select("x,y,field_id,last_sequence")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error) {
      return json({
        success: false,
        code: "MOVEMENT_READ_FAILED",
      }, 503);
    }

    return json({
      success: true,
      x: Number(data?.x ?? 50),
      y: Number(data?.y ?? 78),
      field_id: Number(data?.field_id ?? 1),
      last_sequence: Number(data?.last_sequence ?? 0),
      proof_issued: false,
      reward_enabled: false,
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
  // 서버 이동 검증 연동이 완료되기 전에는
  // 외부에서 이동 상태를 생성할 수 없도록 차단한다.
  if (
    process.env.HOO_WORLD_REWARD_MOVEMENT_ENABLED !== "true"
  ) {
    return json({
      success: false,
      code: "MOVEMENT_NOT_RELEASED",
    }, 503);
  }

  try {
    const session = await createSession();

    const { data: auth, error: authError } =
      await session.auth.getUser();

    if (authError || !auth.user) {
      return json({
        success: false,
        code: "AUTH_REQUIRED",
      }, 401);
    }

    const length = Number(
      request.headers.get("content-length") ?? 0
    );

    if (length > 2048) {
      return json({
        success: false,
        code: "REQUEST_TOO_LARGE",
      }, 413);
    }

    const body: unknown = await request.json()
      .catch(() => null);

    if (!body || typeof body !== "object") {
      return json({
        success: false,
        code: "INVALID_REQUEST",
      }, 400);
    }

    const input = body as Record<string, unknown>;

    const dx = input.dx;
    const dy = input.dy;
    const sequence = input.sequence;

    if (
      !Number.isInteger(dx) ||
      !Number.isInteger(dy) ||
      !Number.isSafeInteger(sequence) ||
      ![-1, 0, 1].includes(dx as number) ||
      ![-1, 0, 1].includes(dy as number) ||
      (sequence as number) <= 0
    ) {
      return json({
        success: false,
        code: "INVALID_MOVEMENT",
      }, 400);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return json({
        success: false,
        code: "SERVER_NOT_READY",
      }, 503);
    }

    const admin = createAdmin(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await admin.rpc(
      "hoo_world_reward_move_sync_v1",
      {
        p_user_id: auth.user.id,
        p_dx: dx,
        p_dy: dy,
        p_sequence: sequence,
      }
    );

    if (error) {
      console.error("World reward movement failed", {
        code: error.code,
      });

      return json({
        success: false,
        code: "MOVEMENT_SYNC_FAILED",
      }, 503);
    }

    return json(data);

  } catch (error) {
    console.error("World reward movement error", error);

    return json({
      success: false,
      code: "MOVEMENT_UNAVAILABLE",
    }, 503);
  }
}

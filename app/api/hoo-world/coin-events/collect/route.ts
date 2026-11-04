import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createSession } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const respond = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

export async function POST(request: Request) {
  // 보상 지급 준비가 완료될 때까지 기본 차단
  if (
    process.env.HOO_WORLD_REWARD_COLLECT_ENABLED !== "true" ||
    process.env.HOO_WORLD_REWARD_CLAIM_ENABLED !== "true"
  ) {
    return respond({
      success: false,
      code: "COLLECT_NOT_RELEASED",
    }, 503);
  }

  try {
    const origin = request.headers.get("origin");

    if (
      origin &&
      origin !== new URL(request.url).origin
    ) {
      return respond({
        success: false,
        code: "INVALID_ORIGIN",
      }, 403);
    }

    const session = await createSession();
    const { data: auth, error: authError } =
      await session.auth.getUser();

    if (authError || !auth.user) {
      return respond({
        success: false,
        code: "AUTH_REQUIRED",
      }, 401);
    }

    // 출시 전에는 지정된 테스트 계정만 허용
    const tester =
      process.env.HOO_WORLD_REWARD_COLLECT_TEST_USER_ID;

    if (!tester || tester !== auth.user.id) {
      return respond({
        success: false,
        code: "COLLECT_TESTER_ONLY",
      }, 403);
    }

    const length = Number(
      request.headers.get("content-length") ?? 0
    );

    if (!Number.isFinite(length) || length > 1024) {
      return respond({
        success: false,
        code: "INVALID_REQUEST_SIZE",
      }, 413);
    }

    const body: unknown = await request.json()
      .catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return respond({
        success: false,
        code: "INVALID_REQUEST",
      }, 400);
    }

    const input = body as Record<string, unknown>;
    const { kind, objectId } = input;

    if (
      (kind !== "coin" && kind !== "box") ||
      typeof objectId !== "string" ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
        objectId
      )
    ) {
      return respond({
        success: false,
        code: "INVALID_COLLECT_INPUT",
      }, 400);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return respond({
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

    // 사용자 ID는 서버 세션에서만 가져옴
    // 클라이언트 좌표·보상 금액은 수신하지 않음
    const { data, error } = await admin.rpc(
      "hoo_world_reward_collect_v1",
      {
        p_user_id: auth.user.id,
        p_kind: kind,
        p_object_id: objectId,
      }
    );

    if (error) {
      console.error("World reward collect failed", {
        code: error.code,
      });

      return respond({
        success: false,
        code: "COLLECT_REJECTED",
      }, 409);
    }

    // DB 지급 RPC의 공식 결과는 { ok: true }.
    // 성공한 지급을 실패로 오인하지 않도록 정규화한다.
    if (!data || data.ok !== true) {
      return respond({
        success: false,
        code:
          typeof data?.code === "string"
            ? data.code
            : typeof data?.reason === "string"
              ? data.reason
              : "COLLECT_REJECTED",
      }, 409);
    }

    return respond({
      ...data,
      success: true,
    });

  } catch (error) {
    console.error("World reward collect error", error);

    return respond({
      success: false,
      code: "COLLECT_UNAVAILABLE",
    }, 503);
  }
}

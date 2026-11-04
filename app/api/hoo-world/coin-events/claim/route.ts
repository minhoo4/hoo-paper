import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createSession } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  // 위치 증명 및 실제 획득 검증 완료 전까지 지급 차단
  if (process.env.HOO_WORLD_REWARD_CLAIM_ENABLED !== "true") {
    return json({
      ok: false,
      code: "REWARD_CLAIM_NOT_RELEASED",
    }, 503);
  }

  try {
    const session = await createSession();

    const { data: auth, error: authError } =
      await session.auth.getUser();

    if (authError || !auth.user) {
      return json({ ok: false, code: "AUTH_REQUIRED" }, 401);
    }

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return json({ ok: false, code: "INVALID_REQUEST" }, 400);
    }

    const input = body as Record<string, unknown>;

    const kind = input.kind;
    const objectId = input.objectId;
    const proofId = input.proofId;

    if (
      (kind !== "coin" && kind !== "box") ||
      typeof objectId !== "string" ||
      !UUID.test(objectId) ||
      typeof proofId !== "string" ||
      !UUID.test(proofId)
    ) {
      return json({ ok: false, code: "INVALID_REQUEST" }, 400);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return json({ ok: false, code: "SERVER_NOT_READY" }, 503);
    }

    const admin = createAdmin(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await admin.rpc(
      "hoo_world_reward_claim_v1",
      {
        // 사용자 ID는 브라우저에서 받지 않는다.
        p_user_id: auth.user.id,
        p_kind: kind,
        p_object_id: objectId,
        p_proof_id: proofId,
      }
    );

    if (error) {
      console.error("World reward claim error", {
        code: error.code,
      });

      return json({
        ok: false,
        code: "REWARD_CLAIM_FAILED",
      }, 503);
    }

    if (!data || data.ok !== true) {
      return json({
        ok: false,
        code: data?.code ?? "CLAIM_REJECTED",
      }, 409);
    }

    return json(data);

  } catch (error) {
    console.error("World reward request failed", error);

    return json({
      ok: false,
      code: "REWARD_UNAVAILABLE",
    }, 503);
  }
}

import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 4096;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}
/** Accept anonymous feedback; verify any attached UID against the real session. */
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return reply({ error: "요청이 너무 깁니다." }, 413);
    }
    let payload: unknown;
    try { payload = JSON.parse(raw); }
    catch { return reply({ error: "올바른 요청 형식이 아닙니다." }, 400); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return reply({ error: "올바른 요청 형식이 아닙니다." }, 400);
    }
    const body = payload as Record<string, unknown>;
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) return reply({ error: "내용을 입력해주세요." }, 400);
    if (content.length > 100) return reply({ error: "피드백은 100자 이하만 가능합니다." }, 400);

    // Existing HOO pages intentionally submit userId:null for anonymous feedback.
    let userId: string | null = null;
    if (body.userId !== null && body.userId !== undefined && body.userId !== "") {
      if (typeof body.userId !== "string" || !UUID_PATTERN.test(body.userId)) {
        return reply({ error: "사용자 정보가 올바르지 않습니다." }, 400);
      }
      const session = await createSessionClient();
      const { data: { user }, error } = await session.auth.getUser();
      if (error || !user || user.id.toLowerCase() !== body.userId.toLowerCase()) {
        return reply({ error: "확인되지 않은 사용자 정보입니다." }, 403);
      }
      userId = user.id;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error("[feedback] missing service configuration");
      return reply({ error: "서버 환경설정 오류가 발생했습니다." }, 500);
    }
    const admin = createAdminClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.from("hoo_feedback")
      .insert({ user_id: userId, content })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[feedback] insert failed", { code: error?.code });
      return reply({ error: "피드백 저장에 실패했습니다." }, 500);
    }
    return reply({ success: true, feedbackId: data.id });
  } catch (error) {
    console.error("[feedback] unexpected error", error);
    return reply({ error: "피드백 저장에 실패했습니다." }, 500);
  }
}

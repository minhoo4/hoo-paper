import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reject(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: noStore }
  );
}

export async function POST(request: NextRequest) {
  try {
    // Both server-side approvals are required.
    // Default: locked.
    if (
      process.env.HOO_CONTEST_ARCHIVE_WRITE_ENABLED !== "true" ||
      process.env.HOO_CONTEST_ROI_E2E_VERIFIED !== "true"
    ) {
      return reject("대회 결과 보관은 검증 전 잠금 상태입니다.", 423);
    }

    // Same-origin POST only.
    const origin = request.headers.get("origin");

    if (!origin || origin !== request.nextUrl.origin) {
      return reject("허용되지 않은 요청 출처입니다.", 403);
    }

    const contentType =
      request.headers.get("content-type")?.toLowerCase() ?? "";

    if (!contentType.startsWith("application/json")) {
      return reject("JSON 요청만 허용합니다.", 415);
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reject("로그인이 필요합니다.", 401);
    }

    const { data: canManage, error: adminError } =
      await supabase.rpc("can_manage_admin_content");

    if (adminError || canManage !== true) {
      return reject("관리자 권한이 필요합니다.", 403);
    }

    const body: unknown =
      await request.json().catch(() => null);

    const contestId =
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      "contestId" in body
        ? body.contestId
        : null;

    if (
      typeof contestId !== "string" ||
      !uuidPattern.test(contestId)
    ) {
      return reject("올바른 대회 ID가 필요합니다.", 400);
    }

    // Database also checks feature gate,
    // admin authorization, contest state,
    // score integrity and archive duplication.
    const { data, error } = await supabase.rpc(
      "hoo_trading_contest_admin_archive_v5",
      { p_contest_id: contestId }
    );

    if (error) {
      console.error("HOO_CONTEST_ARCHIVE_V4", {
        code: error.code,
        message: error.message,
      });

      if (error.message.includes("CONTEST_NOT_RELEASED")) {
        return reject("대회 운영 잠금 상태입니다.", 423);
      }

      return reject("후보 결과 보관 조건을 충족하지 못했습니다.", 409);
    }

    const result = data as { success?: boolean } | null;

    if (result?.success !== true) {
      return reject("보관 응답 검증에 실패했습니다.", 502);
    }

    return NextResponse.json(data, {
      headers: noStore,
    });
  } catch (error) {
    console.error("HOO_CONTEST_ARCHIVE_API", error);
    return reject("보관 요청 처리 중 오류가 발생했습니다.", 500);
  }
}
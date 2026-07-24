import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CreateNoticeBody = {
  title?: unknown;
  content?: unknown;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. 로그인 확인
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    // 2. 관리자 권한 확인
    const { data: canManage, error: permissionError } =
      await supabase.rpc("can_manage_admin_content");

    if (permissionError) {
      console.error("관리자 권한 확인 실패:", permissionError);

      return NextResponse.json(
        { error: "관리자 권한 확인에 실패했습니다." },
        { status: 500 },
      );
    }

    if (canManage !== true) {
      return NextResponse.json(
        { error: "관리자 권한이 없습니다." },
        { status: 403 },
      );
    }

    // 3. 요청 데이터 읽기
    let body: CreateNoticeBody;

    try {
      body = (await request.json()) as CreateNoticeBody;
    } catch {
      return NextResponse.json(
        { error: "올바른 요청 형식이 아닙니다." },
        { status: 400 },
      );
    }

    const title =
      typeof body.title === "string" ? body.title.trim() : "";

    const content =
      typeof body.content === "string" ? body.content.trim() : "";

    // 4. 입력값 검사
    if (!title || !content) {
      return NextResponse.json(
        { error: "제목과 내용을 입력하세요." },
        { status: 400 },
      );
    }

    if (title.length > 100) {
      return NextResponse.json(
        { error: "제목은 100자 이하로 입력하세요." },
        { status: 400 },
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: "내용은 5,000자 이하로 입력하세요." },
        { status: 400 },
      );
    }

    // 5. 공지 저장
    const { data: notice, error: noticeError } = await supabase
      .from("hoo_notices")
      .insert({
        title,
        content,
        is_published: true,
        is_deleted: false,
        author_id: user.id,
      })
      .select(
        `
          id,
          title,
          content,
          is_published,
          is_deleted,
          author_id,
          created_at,
          updated_at
        `,
      )
      .single();

    if (noticeError || !notice) {
      console.error("공지 저장 실패:", noticeError);

      return NextResponse.json(
        {
          error:
            noticeError?.message ??
            "공지를 저장하지 못했습니다.",
        },
        { status: 500 },
      );
    }

    // 6. 관리자 작업 로그 저장
    const { error: logError } = await supabase
      .from("admin_logs")
      .insert({
        admin_id: user.id,
        action: "CREATE_NOTICE",
        target_table: "hoo_notices",
        target_id: notice.id,
        before_data: null,
        after_data: notice,
      });

    if (logError) {
      console.error("관리자 로그 저장 실패:", logError);
    }

    return NextResponse.json(
      {
        success: true,
        notice,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("공지 작성 API 오류:", error);

    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
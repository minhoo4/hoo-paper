import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const userId =
      typeof body.userId === "string" &&
      body.userId.trim().length > 0
        ? body.userId.trim()
        : null;

    const content =
      typeof body.content === "string"
        ? body.content.trim()
        : "";

    if (!content) {
      return NextResponse.json(
        { error: "내용을 입력해주세요." },
        { status: 400 },
      );
    }

    if (content.length > 100) {
      return NextResponse.json(
        { error: "피드백은 100자 이하만 가능합니다." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("hoo_feedback")
      .insert({
        user_id: userId,
        content,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Supabase 피드백 저장 오류:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      feedbackId: data.id,
    });
  } catch (error) {
    console.error("피드백 API 오류:", error);

    return NextResponse.json(
      { error: "피드백 저장에 실패했습니다." },
      { status: 500 },
    );
  }
}
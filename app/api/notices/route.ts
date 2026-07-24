import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: notices, error } = await supabase
      .from("hoo_notices")
      .select(`
        id,
        title,
        content,
        created_at,
        updated_at
      `)
      .eq("is_published", true)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("공지 조회 실패:", error);

      return NextResponse.json(
        { error: "공지를 불러오지 못했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      notices: notices ?? [],
    });
  } catch (error) {
    console.error("공지 조회 API 오류:", error);

    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
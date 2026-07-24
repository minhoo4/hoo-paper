import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { stats: null },
        { status: 200 },
      );
    }

    const { data, error } = await supabase.rpc(
      "get_my_sudoku_stats",
    );

    if (error) {
      throw error;
    }

    const stats = Array.isArray(data)
      ? data[0] ?? null
      : data;

    return NextResponse.json({
      stats,
    });
  } catch (error) {
    console.error("GET /api/sudoku/me 오류:", error);

    return NextResponse.json(
      {
        error: "내 스도쿠 기록을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ stats: null }, { status: 200 });
    }

    const { data, error } = await supabase.rpc("get_my_sudoku_stats");
    if (error) throw error;

    return NextResponse.json({ stats: Array.isArray(data) ? data[0] ?? null : data });
  } catch (error) {
    console.error("GET /api/sudoku/me", error);
    return NextResponse.json({ error: "내 기록을 불러오지 못했습니다." }, { status: 500 });
  }
}

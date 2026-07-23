import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { RankingPeriod } from "@/lib/community-types";

const PERIODS = new Set<RankingPeriod>(["today", "week", "all"]);

export async function GET(request: NextRequest) {
  try {
    const periodParam = request.nextUrl.searchParams.get("period") ?? "all";
    const period = PERIODS.has(periodParam as RankingPeriod)
      ? (periodParam as RankingPeriod)
      : "all";
    const limit = Math.min(
      100,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 20)),
    );

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_sudoku_ranking", {
      p_period: period,
      p_limit: limit,
    });

    if (error) throw error;

    return NextResponse.json({ rankings: data ?? [] });
  } catch (error) {
    console.error("GET /api/sudoku/ranking", error);
    return NextResponse.json({ error: "랭킹을 불러오지 못했습니다." }, { status: 500 });
  }
}

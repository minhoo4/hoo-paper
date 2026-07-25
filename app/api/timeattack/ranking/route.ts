import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GAMES = new Set(["sudoku", "2048"]);

export async function GET(request: NextRequest) {
  try {
    const gameParam =
      request.nextUrl.searchParams.get("game") ?? "sudoku";

    const game = GAMES.has(gameParam)
      ? gameParam
      : "sudoku";

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number(request.nextUrl.searchParams.get("limit") ?? 20),
      ),
    );

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "get_time_attack_ranking",
      {
        p_game: game,
        p_limit: limit,
      },
    );

    if (error) throw error;

    return NextResponse.json({
      rankings: data ?? [],
    });
  } catch (error) {
    console.error("GET /api/timeattack/ranking", error);

    return NextResponse.json(
      {
        error: "타임어택 랭킹을 불러오지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}
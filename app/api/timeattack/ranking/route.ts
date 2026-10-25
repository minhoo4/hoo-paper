import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GAMES = new Set(["2048"]);

export async function GET(request: NextRequest) {
  try {
    const gameParam =
      request.nextUrl.searchParams.get("game") ?? "2048";

    const game = GAMES.has(gameParam)
      ? gameParam
      : "2048";

    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
    if (!Number.isSafeInteger(requestedLimit)) {
      return NextResponse.json(
        { error: "올바른 랭킹 조회 개수를 입력하세요." },
        { status: 400 },
      );
    }
    const limit = Math.min(100, Math.max(1, requestedLimit));

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
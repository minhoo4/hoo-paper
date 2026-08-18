import {
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";

type MiniGameName =
  | "shisen"
  | "hoo1952"
  | "bubble";

type MiniGameScores = Record<
  MiniGameName,
  number
>;

type RawStats = {
  total_score?: number;
  totalScore?: number;
  [key: string]: unknown;
};

type MiniGameScoreRow = {
  game: string;
  score: number;
};

const EMPTY_MINIGAME_SCORES:
  MiniGameScores = {
    shisen: 0,
    hoo1952: 0,
    bubble: 0,
  };

function isMiniGameName(
  value: string,
): value is MiniGameName {
  return (
    value === "shisen" ||
    value === "hoo1952" ||
    value === "bubble"
  );
}

function toSafeScore(
  value: unknown,
): number {
  const score = Number(value);

  if (
    !Number.isFinite(score) ||
    score < 0
  ) {
    return 0;
  }

  return Math.floor(score);
}

export async function GET() {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          stats: null,
        },
        {
          status: 200,
        },
      );
    }

    const [
      statsResult,
      miniGameResult,
    ] = await Promise.all([
      supabase.rpc(
        "get_my_sudoku_stats",
      ),
      supabase
        .from(
          "hoo_minigame_scores",
        )
        .select("game, score")
        .eq("user_id", user.id),
    ]);

    if (statsResult.error) {
      console.error(
        "내 기본 기록 조회 오류:",
        {
          code:
            statsResult.error.code,
          message:
            statsResult.error.message,
          details:
            statsResult.error.details,
          hint:
            statsResult.error.hint,
        },
      );

      throw statsResult.error;
    }

    if (miniGameResult.error) {
      console.error(
        "내 미니게임 점수 조회 오류:",
        {
          code:
            miniGameResult.error.code,
          message:
            miniGameResult.error
              .message,
          details:
            miniGameResult.error
              .details,
          hint:
            miniGameResult.error
              .hint,
        },
      );

      throw miniGameResult.error;
    }

    const rawStats =
      Array.isArray(
        statsResult.data,
      )
        ? statsResult.data[0] ??
          null
        : statsResult.data;

    if (!rawStats) {
      return NextResponse.json({
        stats: null,
      });
    }

    const miniGameScores:
      MiniGameScores = {
        ...EMPTY_MINIGAME_SCORES,
      };

    for (
      const row of
        (miniGameResult.data ??
          []) as MiniGameScoreRow[]
    ) {
      if (
        typeof row.game ===
          "string" &&
        isMiniGameName(row.game)
      ) {
        miniGameScores[row.game] =
          toSafeScore(row.score);
      }
    }

    const miniGameTotalScore =
      miniGameScores.shisen +
      miniGameScores.hoo1952 +
      miniGameScores.bubble;

    const typedStats =
      rawStats as RawStats;

    const originalTotalScore =
      toSafeScore(
        typedStats.total_score ??
          typedStats.totalScore,
      );

    /*
     * 기존 스도쿠·2048 총점에
     * 서버에 저장된 세 미니게임
     * 종합점수를 합산합니다.
     */
    const totalScore =
      originalTotalScore +
      miniGameTotalScore;

    return NextResponse.json({
      stats: {
        ...typedStats,
        total_score: totalScore,
        totalScore,
        mini_game_total_score:
          miniGameTotalScore,
        mini_game_scores:
          miniGameScores,
      },
    });
  } catch (error) {
    console.error(
      "GET /api/sudoku/me 오류:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "내 게임 기록을 불러오지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}
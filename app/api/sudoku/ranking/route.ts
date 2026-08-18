import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getLevelProgress } from "@/lib/community";
import type {
  RankingPeriod,
  RankingRow,
} from "@/lib/community-types";
import { createClient } from "@/lib/supabase/server";

const PERIODS =
  new Set<RankingPeriod>([
    "today",
    "week",
    "all",
  ]);

type RawRankingRow = {
  rank?: number;
  userId?: string;
  user_id?: string;
  nickname?: string;
  avatarEmoji?: string;
  avatar_emoji?: string;
  totalScore?: number;
  total_score?: number;
  completedGames?: number;
  completed_games?: number;
  easyCount?: number;
  easy_count?: number;
  normalCount?: number;
  normal_count?: number;
  hardCount?: number;
  hard_count?: number;
  level?: number;
};

type MiniGameScoreRow = {
  user_id: string;
  score: number;
};

function toSafeNumber(
  value: unknown,
): number {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return 0;
  }

  return Math.floor(number);
}

function normalizeRankingRow(
  row: RawRankingRow,
): RankingRow | null {
  const userId =
    row.userId ?? row.user_id;

  if (!userId) {
    return null;
  }

  const totalScore = toSafeNumber(
    row.totalScore ??
      row.total_score,
  );

  return {
    rank: toSafeNumber(row.rank),
    userId,
    nickname:
      row.nickname?.trim() ||
      "익명",
    avatarEmoji:
      row.avatarEmoji ??
      row.avatar_emoji ??
      "🦉",
    totalScore,
    completedGames: toSafeNumber(
      row.completedGames ??
        row.completed_games,
    ),
    easyCount: toSafeNumber(
      row.easyCount ??
        row.easy_count,
    ),
    normalCount: toSafeNumber(
      row.normalCount ??
        row.normal_count,
    ),
    hardCount: toSafeNumber(
      row.hardCount ??
        row.hard_count,
    ),
    level:
      row.level ??
      getLevelProgress(totalScore)
        .level,
  };
}

export async function GET(
  request: NextRequest,
) {
  try {
    const periodParam =
      request.nextUrl.searchParams.get(
        "period",
      ) ?? "all";

    const period = PERIODS.has(
      periodParam as RankingPeriod,
    )
      ? (periodParam as RankingPeriod)
      : "all";

    const requestedLimit = Number(
      request.nextUrl.searchParams.get(
        "limit",
      ) ?? 20,
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.isFinite(
          requestedLimit,
        )
          ? Math.floor(
              requestedLimit,
            )
          : 20,
      ),
    );

    const supabase =
      await createClient();

    /*
     * 종합점수를 합산한 뒤 순위를 다시
     * 정해야 하므로 기존 스도쿠 순위를
     * 넉넉하게 불러옵니다.
     */
    const baseRankingLimit =
      period === "all"
        ? 1000
        : limit;

    const {
      data: rankingData,
      error: rankingError,
    } = await supabase.rpc(
      "get_sudoku_ranking",
      {
        p_period: period,
        p_limit: baseRankingLimit,
      },
    );

    if (rankingError) {
      throw rankingError;
    }

    const baseRankings = (
      Array.isArray(rankingData)
        ? rankingData
        : []
    )
      .map((row) =>
        normalizeRankingRow(
          row as RawRankingRow,
        ),
      )
      .filter(
        (
          row,
        ): row is RankingRow =>
          row !== null,
      );

    /*
     * 오늘·이번 주 랭킹은 기존처럼
     * 해당 기간의 스도쿠 획득점수만
     * 표시합니다.
     */
    if (period !== "all") {
      const rankings =
        baseRankings
          .slice(0, limit)
          .map((row, index) => ({
            ...row,
            rank: index + 1,
          }));

      return NextResponse.json({
        rankings,
      });
    }

    /*
     * 종합 랭킹에서는 서버에 저장된
     * 사천성·1952·후버블 점수를
     * 사용자별로 모두 합산합니다.
     */
    const {
      data: miniGameData,
      error: miniGameError,
    } = await supabase
      .from("hoo_minigame_scores")
      .select("user_id, score");

    if (miniGameError) {
      console.error(
        "미니게임 종합점수 조회 오류:",
        {
          code:
            miniGameError.code,
          message:
            miniGameError.message,
          details:
            miniGameError.details,
          hint:
            miniGameError.hint,
        },
      );

      throw miniGameError;
    }

    const miniGameTotals =
      new Map<string, number>();

    for (
      const row of
        (miniGameData ??
          []) as MiniGameScoreRow[]
    ) {
      const score =
        toSafeNumber(row.score);

      miniGameTotals.set(
        row.user_id,
        (miniGameTotals.get(
          row.user_id,
        ) ?? 0) + score,
      );
    }

    const rankings =
      baseRankings
        .map((row) => {
          const miniGameScore =
            miniGameTotals.get(
              row.userId,
            ) ?? 0;

          const totalScore =
            row.totalScore +
            miniGameScore;

          return {
            ...row,
            totalScore,
            level:
              getLevelProgress(
                totalScore,
              ).level,
          };
        })
        .sort((a, b) => {
          if (
            b.totalScore !==
            a.totalScore
          ) {
            return (
              b.totalScore -
              a.totalScore
            );
          }

          if (
            b.completedGames !==
            a.completedGames
          ) {
            return (
              b.completedGames -
              a.completedGames
            );
          }

          return a.nickname.localeCompare(
            b.nickname,
            "ko",
          );
        })
        .slice(0, limit)
        .map((row, index) => ({
          ...row,
          rank: index + 1,
        }));

    return NextResponse.json({
      rankings,
    });
  } catch (error) {
    console.error(
      "GET /api/sudoku/ranking",
      error,
    );

    return NextResponse.json(
      {
        error:
          "랭킹을 불러오지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}
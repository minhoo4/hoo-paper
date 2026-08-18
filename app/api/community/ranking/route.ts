export const dynamic = "force-dynamic";
export const revalidate = 0;


import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getLevelProgress } from "@/lib/community";

const safeLimit = (request: NextRequest) => {
  const value = Number(
    request.nextUrl.searchParams.get("limit") ?? 100,
  );

  return Number.isFinite(value)
    ? Math.min(100, Math.max(1, Math.floor(value)))
    : 100;
};

export async function GET(
  request: NextRequest,
) {
  try {
    const supabase = await createClient();
    const limit = safeLimit(request);

    const {
      data: sudokuRows,
      error: sudokuError,
    } = await supabase.rpc(
      "get_sudoku_ranking",
      {
        p_period: "all",
        p_limit: 1000,
      },
    );

    if (sudokuError) {
      console.error(
        "스도쿠 랭킹 조회 오류:",
        sudokuError,
      );

      return NextResponse.json(
        { error: "종합 랭킹을 불러오지 못했습니다." },
        { status: 500 },
      );
    }

    const {
      data: miniGameRows,
      error: miniGameError,
    } = await supabase
      .from("hoo_minigame_scores")
      .select("user_id, game, score");

    if (miniGameError) {
      console.error(
        "미니게임 랭킹 조회 오류:",
        miniGameError,
      );

      return NextResponse.json(
        { error: "종합 랭킹을 불러오지 못했습니다." },
        { status: 500 },
      );
    }

    const users = new Map<
      string,
      {
        userId: string;
        nickname: string;
        avatarEmoji: string;
        sudokuScore: number;
        miniGameScore: number;
        easyCount: number;
        normalCount: number;
        hardCount: number;
      }
    >();

    for (const row of sudokuRows ?? []) {
      const userId =
        row.user_id ??
        row.userId ??
        "";

      if (!userId) continue;

      users.set(userId, {
        userId,
        nickname:
          row.nickname ?? "HOO",
        avatarEmoji:
          row.avatar_emoji ??
          row.avatarEmoji ??
          "🦉",
        sudokuScore: Number(
          row.total_score ??
            row.totalScore ??
            0,
        ),
        miniGameScore: 0,
        easyCount: Number(
          row.easy_count ??
            row.easyCount ??
            0,
        ),
        normalCount: Number(
          row.normal_count ??
            row.normalCount ??
            0,
        ),
        hardCount: Number(
          row.hard_count ??
            row.hardCount ??
            0,
        ),
      });
    }

    for (const row of miniGameRows ?? []) {
      const userId = String(
        row.user_id ?? "",
      );

      if (!userId) continue;

      const score = Number(row.score);

      if (
        !Number.isFinite(score) ||
        score < 0
      ) {
        continue;
      }

      const existing = users.get(userId);

      if (existing) {
        existing.miniGameScore += score;
        continue;
      }

      users.set(userId, {
        userId,
        nickname: "HOO",
        avatarEmoji: "🦉",
        sudokuScore: 0,
        miniGameScore: score,
        easyCount: 0,
        normalCount: 0,
        hardCount: 0,
      });
    }

    const userIds = [...users.keys()];

    if (userIds.length > 0) {
      const { data: profiles } =
        await supabase
          .from("profiles")
          .select(
            "id,nickname,avatar_emoji",
          )
          .in("id", userIds);

      for (const profile of profiles ?? []) {
        const user = users.get(profile.id);

        if (!user) continue;

        user.nickname =
          profile.nickname ??
          user.nickname;

        user.avatarEmoji =
          profile.avatar_emoji ??
          user.avatarEmoji;
      }
    }

    const rankings = [...users.values()]
      .map((user) => {
        const totalScore =
          user.sudokuScore +
          user.miniGameScore;

        const level =
          getLevelProgress(totalScore);

        return {
          userId: user.userId,
          nickname: user.nickname,
          avatarEmoji:
            user.avatarEmoji,
          totalScore,
          level: level.level,
          easyCount:
            user.easyCount,
          normalCount:
            user.normalCount,
          hardCount:
            user.hardCount,
        };
      })
      .filter(
        (row) => row.totalScore > 0,
      )
      .sort(
        (a, b) =>
          b.totalScore -
          a.totalScore,
      )
      .slice(0, limit);

   return NextResponse.json(
  {
    rankings,
  },
  {
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",
    },
  },
);

  } catch (error) {
    console.error(
      "GET /api/community/ranking 오류:",
      error,
    );

    return NextResponse.json(
      { error: "종합 랭킹을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
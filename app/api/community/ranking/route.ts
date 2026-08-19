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

type RankingUser = {
  userId: string;
  nickname: string;
  avatarEmoji: string;
  sudokuScore: number;
  miniGameScore: number;
  score2048: number;
  easyCount: number;
  normalCount: number;
  hardCount: number;
};

function createEmptyUser(
  userId: string,
): RankingUser {
  return {
    userId,
    nickname: "HOO",
    avatarEmoji: "🦉",
    sudokuScore: 0,
    miniGameScore: 0,
    score2048: 0,
    easyCount: 0,
    normalCount: 0,
    hardCount: 0,
  };
}

export async function GET(
  request: NextRequest,
) {
  try {
    const supabase =
      await createClient();

    const limit =
      safeLimit(request);

    /*
     * 1. 스도쿠 종합점수
     */
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
        {
          error:
            "종합 랭킹을 불러오지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * 2. 사천성 / 1952 / 후버블
     *
     * 여기의 score는 게임 원점수가 아니라
     * 종합점수 전용 누적 포인트다.
     */
    const {
      data: miniGameRows,
      error: miniGameError,
    } = await supabase
      .from("hoo_minigame_scores")
      .select(
        "user_id, game, score",
      )
      .in(
        "game",
        [
          "shisen",
          "hoo1952",
          "bubble",
        ],
      );

    if (miniGameError) {
      console.error(
        "미니게임 종합점수 조회 오류:",
        miniGameError,
      );

      return NextResponse.json(
        {
          error:
            "종합 랭킹을 불러오지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * 3. 2048 종합점수
     *
     * 게임 score는 사용하지 않고
     * awarded_score만 누적한다.
     */
    const {
      data: score2048Rows,
      error: score2048Error,
    } = await supabase
      .from("hoo2048_scores")
      .select(
        "user_id, awarded_score",
      )
      .gt(
        "awarded_score",
        0,
      );

    if (score2048Error) {
      console.error(
        "2048 종합점수 조회 오류:",
        score2048Error,
      );

      return NextResponse.json(
        {
          error:
            "종합 랭킹을 불러오지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const users =
      new Map<
        string,
        RankingUser
      >();

    /*
     * 스도쿠 합산
     */
    for (
      const row of sudokuRows ?? []
    ) {
      const userId =
        String(
          row.user_id ??
            row.userId ??
            "",
        );

      if (!userId) {
        continue;
      }

      users.set(
        userId,
        {
          userId,

          nickname:
            row.nickname ??
            "HOO",

          avatarEmoji:
            row.avatar_emoji ??
            row.avatarEmoji ??
            "🦉",

          sudokuScore:
            Math.max(
              0,
              Number(
                row.total_score ??
                  row.totalScore ??
                  0,
              ) || 0,
            ),

          miniGameScore: 0,
          score2048: 0,

          easyCount:
            Math.max(
              0,
              Number(
                row.easy_count ??
                  row.easyCount ??
                  0,
              ) || 0,
            ),

          normalCount:
            Math.max(
              0,
              Number(
                row.normal_count ??
                  row.normalCount ??
                  0,
              ) || 0,
            ),

          hardCount:
            Math.max(
              0,
              Number(
                row.hard_count ??
                  row.hardCount ??
                  0,
              ) || 0,
            ),
        },
      );
    }

    /*
     * 사천성 / 1952 / 후버블
     * 종합점수 전용 포인트 합산
     */
    for (
      const row of
        miniGameRows ?? []
    ) {
      const userId =
        String(
          row.user_id ??
            "",
        );

      if (!userId) {
        continue;
      }

      const score =
        Number(
          row.score,
        );

      if (
        !Number.isFinite(
          score,
        ) ||
        score < 0
      ) {
        continue;
      }

      let user =
        users.get(
          userId,
        );

      if (!user) {
        user =
          createEmptyUser(
            userId,
          );

        users.set(
          userId,
          user,
        );
      }

      user.miniGameScore +=
        score;
    }

    /*
     * 2048
     * awarded_score 전부 누적
     */
    for (
      const row of
        score2048Rows ?? []
    ) {
      const userId =
        String(
          row.user_id ??
            "",
        );

      if (!userId) {
        continue;
      }

      const awardedScore =
        Number(
          row.awarded_score,
        );

      if (
        !Number.isFinite(
          awardedScore,
        ) ||
        awardedScore <= 0
      ) {
        continue;
      }

      let user =
        users.get(
          userId,
        );

      if (!user) {
        user =
          createEmptyUser(
            userId,
          );

        users.set(
          userId,
          user,
        );
      }

      user.score2048 +=
        awardedScore;
    }

    /*
     * 프로필 적용
     */
    const userIds = [
      ...users.keys(),
    ];

    if (
      userIds.length > 0
    ) {
      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from("profiles")
        .select(
          "id,nickname,avatar_emoji",
        )
        .in(
          "id",
          userIds,
        );

      if (
        profilesError
      ) {
        console.warn(
          "프로필 조회 오류:",
          profilesError,
        );
      }

      for (
        const profile of
          profiles ?? []
      ) {
        const user =
          users.get(
            profile.id,
          );

        if (!user) {
          continue;
        }

        user.nickname =
          profile.nickname ??
          user.nickname;

        user.avatarEmoji =
          profile.avatar_emoji ??
          user.avatarEmoji;
      }
    }

    /*
     * 최종 종합점수
     *
     * 게임 원점수는 절대 포함하지 않는다.
     */
    const rankings = [
      ...users.values(),
    ]
      .map(
        (user) => {
          const totalScore =
            user.sudokuScore +
            user.miniGameScore +
            user.score2048;

          const level =
            getLevelProgress(
              totalScore,
            );

          return {
            userId:
              user.userId,

            nickname:
              user.nickname,

            avatarEmoji:
              user.avatarEmoji,

            totalScore,

            level:
              level.level,

            easyCount:
              user.easyCount,

            normalCount:
              user.normalCount,

            hardCount:
              user.hardCount,
          };
        },
      )
      .filter(
        (row) =>
          row.totalScore >
          0,
      )
      .sort(
        (a, b) =>
          b.totalScore -
          a.totalScore,
      )
      .slice(
        0,
        limit,
      );

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
      {
        error:
          "종합 랭킹을 불러오지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}
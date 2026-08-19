import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";

const safeLimit = (
  request: NextRequest,
) => {
  const value = Number(
    request.nextUrl.searchParams.get(
      "limit",
    ) ?? 10,
  );

  return Number.isFinite(value)
    ? Math.min(
        100,
        Math.max(
          1,
          Math.floor(value),
        ),
      )
    : 10;
};

export async function GET(
  request: NextRequest,
) {
  const supabase =
    await createClient();

  const {
    data: records,
    error,
  } = await supabase
    .from("hoo_1952_records")
    .select(
      "user_id,best_score,best_wave,best_seconds",
    )
    .order(
      "best_score",
      {
        ascending: false,
      },
    )
    .order(
      "best_wave",
      {
        ascending: false,
      },
    )
    .order(
      "best_seconds",
      {
        ascending: false,
      },
    )
    .limit(
      safeLimit(request),
    );

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message,
      },
      {
        status: 500,
      },
    );
  }

  const userIds =
    (records ?? []).map(
      (record) =>
        record.user_id,
    );

  const {
    data: profiles,
  } = userIds.length
    ? await supabase
        .from("profiles")
        .select(
          "id,nickname,avatar_emoji",
        )
        .in(
          "id",
          userIds,
        )
    : {
        data: [],
      };

  const profileMap =
    new Map(
      (profiles ?? []).map(
        (profile) => [
          profile.id,
          profile,
        ],
      ),
    );

  return NextResponse.json({
    rankings:
      (records ?? []).map(
        (record) => {
          const profile =
            profileMap.get(
              record.user_id,
            );

          return {
            userId:
              record.user_id,

            nickname:
              profile?.nickname ||
              "UNKNOWN PILOT",

            avatarEmoji:
              profile?.avatar_emoji ||
              "✈️",

            bestScore:
              Number(
                record.best_score,
              ) || 0,

            bestWave:
              Number(
                record.best_wave,
              ) || 1,

            bestSeconds:
              Number(
                record.best_seconds,
              ) || 0,
          };
        },
      ),
  });
}

export async function POST(
  request: NextRequest,
) {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "로그인이 필요합니다.",
      },
      {
        status: 401,
      },
    );
  }

  const body =
    await request
      .json()
      .catch(
        () => ({}),
      );

  const score =
    Math.max(
      0,
      Math.floor(
        Number(body.score) || 0,
      ),
    );

  const wave =
    Math.max(
      1,
      Math.floor(
        Number(body.wave) || 1,
      ),
    );

  const survivalSeconds =
    Math.max(
      0,
      Math.floor(
        Number(
          body.survivalSeconds,
        ) || 0,
      ),
    );

  if (score <= 0) {
    return NextResponse.json(
      {
        error:
          "유효한 점수가 필요합니다.",
      },
      {
        status: 400,
      },
    );
  }

  const {
    data: previous,
    error: previousError,
  } = await supabase
    .from(
      "hoo_1952_records",
    )
    .select(
      "best_score,best_wave,best_seconds",
    )
    .eq(
      "user_id",
      user.id,
    )
    .maybeSingle();

  if (previousError) {
    return NextResponse.json(
      {
        error:
          previousError.message,
      },
      {
        status: 500,
      },
    );
  }

  const previousBestScore =
    Number(
      previous?.best_score,
    ) || 0;

  const previousBestWave =
    Number(
      previous?.best_wave,
    ) || 1;

  const previousBestSeconds =
    Number(
      previous?.best_seconds,
    ) || 0;

  /*
   * 게임 스코어와 웨이브 기록은 별도로 관리
   */
  const nextBestScore =
    Math.max(
      previousBestScore,
      score,
    );

  const nextBestWave =
    Math.max(
      previousBestWave,
      wave,
    );

  const nextBestSeconds =
    score >
    previousBestScore
      ? survivalSeconds
      : previousBestSeconds;

  /*
   * 기존 1952 게임 기록 저장
   */
  const {
    error:
      recordSaveError,
  } = await supabase
    .from(
      "hoo_1952_records",
    )
    .upsert(
      {
        user_id:
          user.id,

        best_score:
          nextBestScore,

        best_wave:
          nextBestWave,

        best_seconds:
          nextBestSeconds,

        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict:
          "user_id",
      },
    );

  if (recordSaveError) {
    return NextResponse.json(
      {
        error:
          recordSaveError.message,
      },
      {
        status: 500,
      },
    );
  }

  /*
   * 종합점수
   *
   * 1952 종합점수 =
   * 최고 웨이브 × 5
   *
   * 게임 스코어는 여기 포함하지 않는다.
   */
  const totalRankingScore =
    nextBestWave * 5;

  const {
    error:
      rankingSaveError,
  } = await supabase
    .from(
      "hoo_minigame_scores",
    )
    .upsert(
      {
        user_id:
          user.id,

        game:
          "hoo1952",

        score:
          totalRankingScore,

        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict:
          "user_id,game",
      },
    );

  if (rankingSaveError) {
    console.error(
      "1952 종합점수 저장 오류:",
      rankingSaveError,
    );

    return NextResponse.json(
      {
        error:
          "1952 종합점수를 저장하지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    saved:
      nextBestScore >
        previousBestScore ||
      nextBestWave >
        previousBestWave,

    bestScore:
      nextBestScore,

    bestWave:
      nextBestWave,

    rankingScore:
      totalRankingScore,
  });
}
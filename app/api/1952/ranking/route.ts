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
    console.error("1952 랭킹 조회 오류:", error);
    return NextResponse.json({ error: "랭킹을 불러오지 못했습니다." }, { status: 500 });
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

  // Only accept finite, integral game values; do not silently clamp malformed records.
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "올바른 요청 형식이 아닙니다." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "올바른 요청 형식이 아닙니다." }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;
  const score = body.score;
  const wave = body.wave;
  const survivalSeconds = body.survivalSeconds;
  if (
    typeof score !== "number" || !Number.isSafeInteger(score) || score <= 0 ||
    typeof wave !== "number" || !Number.isSafeInteger(wave) || wave < 1 ||
    typeof survivalSeconds !== "number" || !Number.isSafeInteger(survivalSeconds) || survivalSeconds < 0 ||
    wave > Math.floor(Number.MAX_SAFE_INTEGER / 5)
  ) {
    return NextResponse.json({ error: "점수, 웨이브 또는 생존 시간이 올바르지 않습니다." }, { status: 400 });
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
    console.error("1952 이전 기록 조회 오류:", previousError);
    return NextResponse.json({ error: "이전 기록을 확인하지 못했습니다." }, { status: 500 });
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
    console.error("1952 기록 저장 오류:", recordSaveError);
    return NextResponse.json({ error: "1952 기록을 저장하지 못했습니다." }, { status: 500 });
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
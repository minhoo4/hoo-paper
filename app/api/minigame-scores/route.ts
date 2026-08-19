import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";

/*
 * hoo_minigame_scores에 저장되는 값은
 * 게임 원점수가 아니라 "종합랭킹 전용 점수"다.
 *
 * shisen:
 *   각 스테이지 클리어 시 10 × stage 누적
 *
 * bubble:
 *   각 스테이지 클리어 시 30 × stage 누적
 *
 * hoo1952:
 *   별도 /api/1952 API에서
 *   best_wave × 5 로 관리
 *
 * 2048:
 *   이 테이블을 사용하지 않음.
 *   hoo2048_scores.awarded_score를 사용
 */

const READ_GAME_NAMES = [
  "shisen",
  "hoo1952",
  "bubble",
] as const;

const WRITABLE_GAME_NAMES = [
  "shisen",
  "bubble",
] as const;

type ReadGameName =
  (typeof READ_GAME_NAMES)[number];

type WritableGameName =
  (typeof WRITABLE_GAME_NAMES)[number];

type MiniGameScores = Record<
  ReadGameName,
  number
>;

const EMPTY_SCORES: MiniGameScores = {
  shisen: 0,
  hoo1952: 0,
  bubble: 0,
};

function isReadGameName(
  value: string,
): value is ReadGameName {
  return READ_GAME_NAMES.includes(
    value as ReadGameName,
  );
}

function normalizeScore(
  value: unknown,
): number | null {
  const score = Number(value);

  if (
    !Number.isSafeInteger(score) ||
    score < 0
  ) {
    return null;
  }

  return score;
}

export async function GET() {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          scores:
            EMPTY_SCORES,

          authenticated:
            false,
        },
        {
          status: 200,
        },
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        "hoo_minigame_scores",
      )
      .select(
        "game, score",
      )
      .eq(
        "user_id",
        user.id,
      )
      .in(
        "game",
        [
          ...READ_GAME_NAMES,
        ],
      );

    if (error) {
      console.error(
        "미니게임 종합점수 조회 오류:",
        {
          code:
            error.code,

          message:
            error.message,

          details:
            error.details,

          hint:
            error.hint,
        },
      );

      return NextResponse.json(
        {
          error:
            "미니게임 종합점수를 불러오지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const scores:
      MiniGameScores = {
        ...EMPTY_SCORES,
      };

    for (
      const row of
        data ?? []
    ) {
      if (
        typeof row.game ===
          "string" &&
        isReadGameName(
          row.game,
        )
      ) {
        scores[row.game] =
          normalizeScore(
            row.score,
          ) ?? 0;
      }
    }

    return NextResponse.json({
      scores,

      authenticated:
        true,

      /*
       * 이 값은 shisen + 1952 + bubble만.
       * 스도쿠/2048은 각 전용 테이블에서
       * community ranking API가 별도로 더한다.
       */
      miniGameTotal:
        scores.shisen +
        scores.hoo1952 +
        scores.bubble,
    });
  } catch (error) {
    console.error(
      "GET /api/minigame-scores 오류:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "미니게임 종합점수를 불러오지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
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

    /*
     * 이 API에서 직접 저장 가능한 게임은
     * 사천성과 후버블만.
     *
     * 1952는 전용 API,
     * 2048은 awarded_score 시스템 사용.
     */
    const body =
      (await request.json()) as {
        scores?: Partial<
          Record<
            WritableGameName,
            unknown
          >
        >;
      };

    if (
      !body.scores ||
      typeof body.scores !==
        "object"
    ) {
      return NextResponse.json(
        {
          error:
            "저장할 종합점수가 없습니다.",
        },
        {
          status: 400,
        },
      );
    }

    const incomingScores =
      WRITABLE_GAME_NAMES.reduce<
        Partial<
          Record<
            WritableGameName,
            number
          >
        >
      >(
        (
          result,
          game,
        ) => {
          if (
            !Object.prototype.hasOwnProperty.call(
              body.scores,
              game,
            )
          ) {
            return result;
          }

          const score =
            normalizeScore(
              body.scores?.[
                game
              ],
            );

          if (
            score !== null
          ) {
            result[game] =
              score;
          }

          return result;
        },
        {},
      );

    if (
      Object.keys(
        incomingScores,
      ).length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "올바른 종합점수를 입력해주세요.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * 서버에 이미 저장된
     * 사천성/후버블 종합점수 확인
     */
    const {
      data: existingRows,
      error: existingError,
    } = await supabase
      .from(
        "hoo_minigame_scores",
      )
      .select(
        "game, score",
      )
      .eq(
        "user_id",
        user.id,
      )
      .in(
        "game",
        [
          ...WRITABLE_GAME_NAMES,
        ],
      );

    if (existingError) {
      console.error(
        "기존 종합점수 조회 오류:",
        {
          code:
            existingError.code,

          message:
            existingError.message,

          details:
            existingError.details,

          hint:
            existingError.hint,
        },
      );

      return NextResponse.json(
        {
          error:
            "기존 종합점수를 확인하지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const existingScores: Record<
      WritableGameName,
      number
    > = {
      shisen: 0,
      bubble: 0,
    };

   for (
  const row of
    existingRows ?? []
) {
  const game =
    String(
      row.game ?? "",
    );

  if (
    game !== "shisen" &&
    game !== "bubble"
  ) {
    continue;
  }

  const gameName =
    game as WritableGameName;

  existingScores[
    gameName
  ] =
    normalizeScore(
      row.score,
    ) ?? 0;
}

    /*
     * 클라이언트가 보내는 값은
     * 이미 누적된 종합점수이므로
     * 더하기가 아니라 MAX를 사용한다.
     *
     * 이렇게 해야 같은 기록을
     * 여러 번 POST해도 중복 가산되지 않는다.
     */
    const rowsToSave =
      Object.entries(
        incomingScores,
      ).map(
        ([
          game,
          incomingScore,
        ]) => {
          const gameName =
            game as WritableGameName;

          return {
            user_id:
              user.id,

            game:
              gameName,

            score:
              Math.max(
                existingScores[
                  gameName
                ],
                incomingScore ??
                  0,
              ),

            updated_at:
              new Date().toISOString(),
          };
        },
      );

    const {
      error: upsertError,
    } = await supabase
      .from(
        "hoo_minigame_scores",
      )
      .upsert(
        rowsToSave,
        {
          onConflict:
            "user_id,game",
        },
      );

    if (upsertError) {
      console.error(
        "종합점수 저장 오류:",
        {
          code:
            upsertError.code,

          message:
            upsertError.message,

          details:
            upsertError.details,

          hint:
            upsertError.hint,
        },
      );

      return NextResponse.json(
        {
          error:
            "미니게임 종합점수를 저장하지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * 저장 후 1952까지 포함한
     * 현재 종합점수 데이터 재조회
     */
    const {
      data: savedRows,
      error:
        savedRowsError,
    } = await supabase
      .from(
        "hoo_minigame_scores",
      )
      .select(
        "game, score",
      )
      .eq(
        "user_id",
        user.id,
      )
      .in(
        "game",
        [
          ...READ_GAME_NAMES,
        ],
      );

    if (
      savedRowsError
    ) {
      console.error(
        "저장된 종합점수 조회 오류:",
        savedRowsError,
      );

      return NextResponse.json(
        {
          error:
            "저장된 종합점수를 확인하지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const scores:
      MiniGameScores = {
        ...EMPTY_SCORES,
      };

    for (
      const row of
        savedRows ?? []
    ) {
      if (
        typeof row.game ===
          "string" &&
        isReadGameName(
          row.game,
        )
      ) {
        scores[row.game] =
          normalizeScore(
            row.score,
          ) ?? 0;
      }
    }

    return NextResponse.json({
      saved: true,

      scores,

      miniGameTotal:
        scores.shisen +
        scores.hoo1952 +
        scores.bubble,
    });
  } catch (error) {
    console.error(
      "POST /api/minigame-scores 오류:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "미니게임 종합점수를 저장하지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}
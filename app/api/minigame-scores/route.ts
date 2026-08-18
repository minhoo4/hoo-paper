import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";

const GAME_NAMES = [
  "shisen",
  "hoo1952",
  "bubble",
  "2048",
] as const;

type MiniGameName =
  (typeof GAME_NAMES)[number];

type MiniGameScores = Record<
  MiniGameName,
  number
>;

const EMPTY_SCORES: MiniGameScores = {
  shisen: 0,
  hoo1952: 0,
  bubble: 0,
  2048: 0,
};

function isMiniGameName(
  value: string,
): value is MiniGameName {
  return GAME_NAMES.includes(
    value as MiniGameName,
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
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          scores: EMPTY_SCORES,
          authenticated: false,
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
      .from("hoo_minigame_scores")
      .select("game, score")
      .eq("user_id", user.id);

    if (error) {
      console.error(
        "미니게임 점수 조회 오류:",
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
      );

      return NextResponse.json(
        {
          error:
            "미니게임 점수를 불러오지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const scores: MiniGameScores = {
      ...EMPTY_SCORES,
    };

    for (const row of data ?? []) {
      if (
        typeof row.game === "string" &&
        isMiniGameName(row.game)
      ) {
        scores[row.game] =
          normalizeScore(row.score) ?? 0;
      }
    }

    return NextResponse.json({
      scores,
      authenticated: true,
      totalScore:
        scores.shisen +
        scores.hoo1952 +
        scores.bubble +
        scores["2048"],
    });
  } catch (error) {
    console.error(
      "GET /api/minigame-scores 오류:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "미니게임 점수를 불러오지 못했습니다.",
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
    } = await supabase.auth.getUser();

    if (userError || !user) {
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

    const body = (await request.json()) as {
      scores?: Partial<
        Record<MiniGameName, unknown>
      >;
    };

    if (
      !body.scores ||
      typeof body.scores !== "object"
    ) {
      return NextResponse.json(
        {
          error:
            "저장할 점수가 없습니다.",
        },
        {
          status: 400,
        },
      );
    }

    const incomingScores =
      GAME_NAMES.reduce<
        Partial<MiniGameScores>
      >((result, game) => {
        if (
          !Object.prototype.hasOwnProperty.call(
            body.scores,
            game,
          )
        ) {
          return result;
        }

        const score = normalizeScore(
          body.scores?.[game],
        );

        if (score !== null) {
          result[game] = score;
        }

        return result;
      }, {});

    if (
      Object.keys(incomingScores)
        .length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "올바른 점수를 입력해주세요.",
        },
        {
          status: 400,
        },
      );
    }

    const {
      data: existingRows,
      error: existingError,
    } = await supabase
      .from("hoo_minigame_scores")
      .select("game, score")
      .eq("user_id", user.id);

    if (existingError) {
      console.error(
        "기존 미니게임 점수 조회 오류:",
        {
          code: existingError.code,
          message:
            existingError.message,
          details:
            existingError.details,
          hint: existingError.hint,
        },
      );

      return NextResponse.json(
        {
          error:
            "기존 점수를 확인하지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const existingScores:
      MiniGameScores = {
        ...EMPTY_SCORES,
      };

    for (
      const row of existingRows ?? []
    ) {
      if (
        typeof row.game === "string" &&
        isMiniGameName(row.game)
      ) {
        existingScores[row.game] =
          normalizeScore(row.score) ??
          0;
      }
    }

    const rowsToSave = Object.entries(
      incomingScores,
    ).map(([game, score]) => ({
      user_id: user.id,
      game,
      score: Math.max(
        existingScores[
          game as MiniGameName
        ],
        score ?? 0,
      ),
      updated_at:
        new Date().toISOString(),
    }));

    const {
      error: upsertError,
    } = await supabase
      .from("hoo_minigame_scores")
      .upsert(rowsToSave, {
        onConflict: "user_id,game",
      });

    if (upsertError) {
      console.error(
        "미니게임 점수 저장 오류:",
        {
          code: upsertError.code,
          message:
            upsertError.message,
          details:
            upsertError.details,
          hint: upsertError.hint,
        },
      );

      return NextResponse.json(
        {
          error:
            "미니게임 점수를 저장하지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const {
      data: savedRows,
      error: savedRowsError,
    } = await supabase
      .from("hoo_minigame_scores")
      .select("game, score")
      .eq("user_id", user.id);

    if (savedRowsError) {
      console.error(
        "저장된 미니게임 점수 조회 오류:",
        savedRowsError,
      );

      return NextResponse.json(
        {
          error:
            "저장된 점수를 확인하지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const scores: MiniGameScores = {
      ...EMPTY_SCORES,
    };

    for (const row of savedRows ?? []) {
      if (
        typeof row.game === "string" &&
        isMiniGameName(row.game)
      ) {
        scores[row.game] =
          normalizeScore(row.score) ??
          0;
      }
    }

    return NextResponse.json({
      saved: true,
      scores,
      totalScore:
        scores.shisen +
        scores.hoo1952 +
        scores.bubble +
        scores["2048"],
    });
  } catch (error) {
    console.error(
      "POST /api/minigame-scores 오류:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "미니게임 점수를 저장하지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}
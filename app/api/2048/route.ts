import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DIFFICULTIES = new Set([
  "easy",
  "normal",
  "hard",
  "buddha",
]);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "로그인이 필요합니다.",
        },
        {
          status: 401,
        },
      );
    }

    const body = await request.json();

    const difficulty =
      typeof body.difficulty === "string"
        ? body.difficulty
        : "";

    const score = Number(body.score);

    const elapsedSeconds = Number(
      body.elapsedSeconds,
    );

    const maxTile = Number(body.maxTile);

    if (!DIFFICULTIES.has(difficulty)) {
      return NextResponse.json(
        {
          error: "올바르지 않은 난이도입니다.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(score) ||
      score < 0
    ) {
      return NextResponse.json(
        {
          error: "올바르지 않은 점수입니다.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(elapsedSeconds) ||
      elapsedSeconds < 0
    ) {
      return NextResponse.json(
        {
          error:
            "올바르지 않은 플레이 시간입니다.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isInteger(maxTile) ||
      maxTile < 2
    ) {
      return NextResponse.json(
        {
          error:
            "올바르지 않은 최고 타일입니다.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * 부처모드
     *
     * 종합점수를 지급하지 않고
     * 플레이 기록만 저장한다.
     *
     * 랭킹에서는 사용자별 MAX(score)를 사용한다.
     */
    if (difficulty === "buddha") {
      const {
        error: insertError,
      } = await supabase
        .from("hoo2048_scores")
        .insert({
          user_id: user.id,
          difficulty: "buddha",
          score,
          elapsed_seconds:
            elapsedSeconds,
          awarded_score: 0,
        });

      if (insertError) {
        console.error(
          "부처모드 기록 저장 오류:",
          {
            code: insertError.code,
            message:
              insertError.message,
            details:
              insertError.details,
            hint: insertError.hint,
          },
        );

        return NextResponse.json(
          {
            error:
              insertError.message,
            code: insertError.code,
            details:
              insertError.details,
            hint: insertError.hint,
          },
          {
            status: 500,
          },
        );
      }

      const {
        data: bestScoreData,
        error: bestScoreError,
      } = await supabase
        .from("hoo2048_scores")
        .select("score")
        .eq("user_id", user.id)
        .eq("difficulty", "buddha")
        .order("score", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (bestScoreError) {
        console.error(
          "부처모드 최고점수 조회 오류:",
          {
            code: bestScoreError.code,
            message:
              bestScoreError.message,
            details:
              bestScoreError.details,
            hint: bestScoreError.hint,
          },
        );

        return NextResponse.json(
          {
            error:
              bestScoreError.message,
            code:
              bestScoreError.code,
            details:
              bestScoreError.details,
            hint:
              bestScoreError.hint,
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json({
        score,
        difficulty,
        elapsedSeconds,
        maxTile,
        awardedScore: 0,
        totalScore: 0,
        bestScore:
          bestScoreData?.score ??
          score,
      });
    }

    /*
     * 일반 2048
     *
     * 기존 complete_hoo2048 RPC와
     * 종합점수 지급 방식을 그대로 유지한다.
     */
    const { data, error: rpcError } =
      await supabase.rpc(
        "complete_hoo2048",
        {
          p_difficulty:
            difficulty,
          p_score: score,
          p_elapsed_seconds:
            elapsedSeconds,
          p_max_tile: maxTile,
        },
      );

    if (rpcError) {
      console.error(
        "complete_hoo2048 RPC 오류:",
        {
          code: rpcError.code,
          message: rpcError.message,
          details:
            rpcError.details,
          hint: rpcError.hint,
        },
      );

      return NextResponse.json(
        {
          error: rpcError.message,
          code: rpcError.code,
          details:
            rpcError.details,
          hint: rpcError.hint,
        },
        {
          status: 500,
        },
      );
    }

    const result = Array.isArray(data)
      ? data[0]
      : data;

    return NextResponse.json({
      score,
      difficulty,
      elapsedSeconds,
      maxTile,
      awardedScore:
        result?.awarded_score ?? 0,
      totalScore:
        result?.new_total_score ?? 0,
    });
  } catch (error) {
    console.error(
      "2048 기록 API 오류:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "서버 오류가 발생했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}
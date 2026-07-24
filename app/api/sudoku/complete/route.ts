import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SudokuDifficulty } from "@/lib/community-types";

const VALID_DIFFICULTIES = new Set<SudokuDifficulty>(["easy", "normal", "hard"]);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json()) as {
      puzzleId?: string;
      difficulty?: SudokuDifficulty;
      elapsedSeconds?: number;
      hintsUsed?: number;
    };

    if (!body.puzzleId || body.puzzleId.length > 160) {
      return NextResponse.json({ error: "올바르지 않은 퍼즐 ID입니다." }, { status: 400 });
    }

    if (!body.difficulty || !VALID_DIFFICULTIES.has(body.difficulty)) {
      return NextResponse.json({ error: "올바르지 않은 난이도입니다." }, { status: 400 });
    }

    const elapsedSeconds = Math.floor(Number(body.elapsedSeconds));
    const hintsUsed = Math.floor(Number(body.hintsUsed ?? 0));

    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 10 || elapsedSeconds > 86_400) {
      return NextResponse.json(
        { error: "기록 시간이 비정상적입니다. 최소 10초 이상이어야 합니다." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(hintsUsed) || hintsUsed < 0 || hintsUsed > 3) {
      return NextResponse.json({ error: "힌트 기록이 올바르지 않습니다." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("complete_sudoku", {
      p_puzzle_id: body.puzzleId,
      p_difficulty: body.difficulty,
      p_elapsed_seconds: elapsedSeconds,
      p_hints_used: hintsUsed,
    });

   if (error) {
  console.error("complete_sudoku RPC error:", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  if (error.code === "23505") {
    return NextResponse.json({
      score: 0,
      totalScore: null,
      alreadyCompleted: true,
    });
  }

  return NextResponse.json(
    {
      error: "complete_sudoku 함수 실행 실패",
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    },
    { status: 500 },
  );
}

    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      score: result?.awarded_score ?? 0,
      totalScore: result?.new_total_score ?? 0,
      alreadyCompleted: false,
    });
  } catch (error) {
    console.error("POST /api/sudoku/complete", error);
    return NextResponse.json({ error: "기록을 저장하지 못했습니다." }, { status: 500 });
  }
}

import type { SudokuDifficulty } from "./community-types";

export const SCORE_BY_DIFFICULTY: Record<
  SudokuDifficulty,
  number
> = {
  easy: 10,
  normal: 25,
  hard: 50,
};

export function createPuzzleId(
  difficulty: SudokuDifficulty,
): string {
  const randomPart =
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

  return `${difficulty}-${randomPart}`;
}

const MAX_LEVEL = 1500;

function getRequiredXpForNextLevel(
  level: number,
): number {
  if (level <= 10) {
    return 50;
  }

  if (level <= 100) {
    return 100;
  }

  if (level <= 500) {
    return 150;
  }

  if (level <= 1000) {
    return 200;
  }

  return 300;
}

export function getLevelFromXp(
  totalXp: number,
): number {
  const safeTotalXp = Math.max(
    0,
    Math.floor(totalXp),
  );

  let level = 1;
  let accumulatedXp = 0;

  while (level < MAX_LEVEL) {
    const requiredXp =
      getRequiredXpForNextLevel(level);

    if (
      safeTotalXp <
      accumulatedXp + requiredXp
    ) {
      break;
    }

    accumulatedXp += requiredXp;
    level += 1;
  }

  return level;
}

export function getLevelProgress(totalXp: number) {
  const safeTotalXp = Math.max(
    0,
    Math.floor(totalXp),
  );

  const level = getLevelFromXp(safeTotalXp);

  let levelStartXp = 0;

  for (
    let previousLevel = 1;
    previousLevel < level;
    previousLevel += 1
  ) {
    levelStartXp +=
      getRequiredXpForNextLevel(previousLevel);
  }

  if (level >= MAX_LEVEL) {
    return {
      level: MAX_LEVEL,
      currentLevelXp: 0,
      neededXp: 0,
      nextLevelXp: levelStartXp,
      progressPercent: 100,
    };
  }

  const neededXp =
    getRequiredXpForNextLevel(level);

  const currentLevelXp =
    safeTotalXp - levelStartXp;

  const nextLevelXp =
    levelStartXp + neededXp;

  const progressPercent = Math.max(
    0,
    Math.min(
      100,
      (currentLevelXp / neededXp) * 100,
    ),
  );

  return {
    level,
    currentLevelXp,
    neededXp,
    nextLevelXp,
    progressPercent,
  };
}

export async function submitSudokuCompletion(input: {
  puzzleId: string;
  difficulty: SudokuDifficulty;
  elapsedSeconds: number;
  hintsUsed: number;
}) {
  const response = await fetch(
    "/api/sudoku/complete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ?? "기록 저장에 실패했습니다.",
    );
  }

  return data as {
    score: number;
    totalScore: number;
    alreadyCompleted: boolean;
  };
}

export async function submit2048Completion(input: {
  difficulty: "easy" | "normal" | "hard" | "buddha";
  score: number;
  elapsedSeconds: number;
  maxTile: number;
}) {
  const response = await fetch("/api/2048", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ??
        "2048 기록 저장에 실패했습니다.",
    );
  }

  return data as {
    score: number;
    difficulty: "easy" | "normal" | "hard";
    elapsedSeconds: number;
    maxTile: number;
    awardedScore: number;
    totalScore: number;
  };
}
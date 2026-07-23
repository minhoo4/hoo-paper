export type ChessPuzzleDifficulty = "easy" | "normal" | "hard";

export type ChessPuzzleItem = {
  id: string;
  title: string;
  difficulty: ChessPuzzleDifficulty;
  instruction: string;
  fen: string;
  solution: string[];
};

export const CHESS_PUZZLES: ChessPuzzleItem[] = [
  {
    id: "mate-001",
    title: "막힌 킹을 노려라",
    difficulty: "easy",
    instruction: "백 차례입니다. 한 수 안에 체크메이트하세요.",
    fen: "6k1/5p1p/6KQ/8/8/8/8/8 w - - 0 1",
    solution: ["h6g7"],
  },
  {
    id: "mate-002",
    title: "백랭크 메이트",
    difficulty: "easy",
    instruction: "백 차례입니다. 한 수 안에 체크메이트하세요.",
    fen: "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1",
    solution: ["e1e8"],
  },
  {
    id: "mate-003",
    title: "퀸과 비숍의 협공",
    difficulty: "easy",
    instruction: "백 차례입니다. 한 수 안에 체크메이트하세요.",
    fen: "7k/6pp/8/8/8/3Q4/2B5/6K1 w - - 0 1",
    solution: ["d3h7"],
  },
];

export function getRandomChessPuzzle(
  previousId?: string,
): ChessPuzzleItem {
  const candidates =
    CHESS_PUZZLES.length > 1
      ? CHESS_PUZZLES.filter((puzzle) => puzzle.id !== previousId)
      : CHESS_PUZZLES;

  return candidates[Math.floor(Math.random() * candidates.length)];
}

export type RankingPeriod = "today" | "week" | "all";

// P1.1: retired Sudoku-specific counters are not part of active rankings.
export type RankingRow = {
  rank?: number;
  userId: string;
  nickname: string;
  avatarEmoji: string;
  totalScore: number;
  level: number;
};

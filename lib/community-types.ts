export type SudokuDifficulty = "easy" | "normal" | "hard";
export type RankingPeriod = "today" | "week" | "all";

export type RankingRow = {
  rank: number;
  userId: string;
  nickname: string;
  avatarEmoji: string;
  totalScore: number;
  completedGames: number;
  easyCount: number;
  normalCount: number;
  hardCount: number;
  level: number;
};

export type MySudokuStats = {
  userId: string;
  nickname: string;
  avatarEmoji: string;
  totalScore: number;
  completedGames: number;
  easyCount: number;
  normalCount: number;
  hardCount: number;
  currentStreak: number;
  bestStreak: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  achievements: string[];
};

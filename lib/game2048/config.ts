export type Game2048Mode =
  | "classic"
  | "normal"
  | "hard"
  | "infinite";

export type Game2048Theme =
  | "default"
  | "space"
  | "neon"
  | "forest";

export type Game2048ModeConfig = {
  id: Game2048Mode;
  name: string;
  boardSize: number;
  targetTile: number | null;
  randomEventsEnabled: boolean;
  infiniteExpansion: boolean;
};

export const GAME_2048_MODES: Record<
  Game2048Mode,
  Game2048ModeConfig
> = {
  classic: {
    id: "classic",
    name: "클래식",
    boardSize: 4,
    targetTile: 2048,
    randomEventsEnabled: true,
    infiniteExpansion: false,
  },

  normal: {
    id: "normal",
    name: "노멀",
    boardSize: 5,
    targetTile: 4096,
    randomEventsEnabled: true,
    infiniteExpansion: false,
  },

  hard: {
    id: "hard",
    name: "하드",
    boardSize: 8,
    targetTile: 8192,
    randomEventsEnabled: true,
    infiniteExpansion: false,
  },

  infinite: {
    id: "infinite",
    name: "인피니티",
    boardSize: 4,
    targetTile: null,
    randomEventsEnabled: true,
    infiniteExpansion: true,
  },
};

export const GAME_2048_THEMES: {
  id: Game2048Theme;
  name: string;
}[] = [
  {
    id: "default",
    name: "클래식",
  },
  {
    id: "space",
    name: "우주",
  },
  {
    id: "neon",
    name: "네온",
  },
  {
    id: "forest",
    name: "숲",
  },
];
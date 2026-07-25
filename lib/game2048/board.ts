import { GAME_2048_MODES, Game2048Mode } from "./config";

export type Tile = number;

export type Board = Tile[][];

export function createEmptyBoard(size: number): Board {
  return Array.from({ length: size }, () =>
    Array(size).fill(0),
  );
}

export function getBoardSize(mode: Game2048Mode) {
  return GAME_2048_MODES[mode].boardSize;
}

export function createBoard(mode: Game2048Mode): Board {
  const size = getBoardSize(mode);

  return createEmptyBoard(size);
}
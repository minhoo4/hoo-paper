"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import { submit2048Completion } from "@/lib/community";
import { createClient } from "@/lib/supabase/client";

import {
  moveDownWithScore,
  moveLeftWithScore,
  moveRightWithScore,
  moveUpWithScore,
} from "@/lib/game2048/movement";

type Difficulty = "easy" | "normal" | "hard" | "buddha";
type Board = number[][];

type BuddhaRankingEntry = {
  rank: number;
  userId: string;
  nickname: string;
  avatarEmoji: string;
  bestScore: number;
  completedGames: number;
  achievedAt: string | null;
};

type AnimatedTile = {
  id: string;
  value: number;
  fromRow: number;
  fromColumn: number;
  toRow: number;
  toColumn: number;
  absorbed?: boolean;
};

type WormHoleOutputTile = AnimatedTile;

type PendingBuddhaWormHole = {
  row: number;
  column: number;
  activateAtMove: number;
};

type BuddhaBomb = {
  id: string;
  row: number;
  column: number;
  remainingTurns: number;
};

type BuddhaExplosion = {
  id: string;
  row: number;
  column: number;
  startedAt: number;
};

type WormHoleEmissionResult = {
  board: Board;
  emittedTiles: WormHoleOutputTile[];
  mergedTiles: {
    row: number;
    column: number;
  }[];
  absorbedBlackHoles: {
    row: number;
    column: number;
  }[];
  score: number;
};

type MoveFunction = typeof moveLeftWithScore;

const ANIMATION_DURATION = 150;
const WORM_HOLE_EMISSION_DURATION = 360;
const BLACK_HOLE_TILE = -1;
const WORM_HOLE_TILE = -2;
const NORMAL_BLACK_HOLE_INTERVAL = 24;
const NORMAL_WORM_HOLE_INTERVAL = 40;
const WORM_HOLE_MIN_OUTPUT = 3;
const WORM_HOLE_MAX_OUTPUT = 6;
const BUDDHA_BLACK_HOLE_INTERVAL = 30;
const BUDDHA_WORM_HOLE_INTERVAL = 50;
const BUDDHA_WORM_HOLE_OUTPUT_COUNT = 5;
const BUDDHA_BOMB_INTERVAL = 100;
const BUDDHA_BOMB_COUNTDOWN = 50;
const BUDDHA_EXPLOSION_DURATION = 420;


function moveBuddhaBombsWithTiles(
  bombs: BuddhaBomb[],
  movedTiles: {
    fromRow: number;
    fromColumn: number;
    toRow: number;
    toColumn: number;
  }[],
): BuddhaBomb[] {
  return bombs.map((bomb) => {
    const movedTile = movedTiles.find(
      (tile) =>
        tile.fromRow === bomb.row &&
        tile.fromColumn === bomb.column,
    );

    if (!movedTile) {
      return bomb;
    }

    return {
      ...bomb,
      row: movedTile.toRow,
      column: movedTile.toColumn,
    };
  });
}

function spawnBuddhaBomb(
  board: Board,
  bombs: BuddhaBomb[],
): BuddhaBomb[] {
  const candidates: {
    row: number;
    column: number;
  }[] = [];

  for (let row = 0; row < board.length; row += 1) {
    for (
      let column = 0;
      column < board[row].length;
      column += 1
    ) {
      const value = board[row][column];

      if (
        value !== BLACK_HOLE_TILE &&
        value !== WORM_HOLE_TILE
      ) {
        candidates.push({ row, column });
      }
    }
  }

  if (candidates.length === 0) {
    return bombs;
  }

  const target =
    candidates[
      Math.floor(Math.random() * candidates.length)
    ];

  return [
    ...bombs,
    {
      id: `buddha-bomb-${Date.now()}-${Math.random()}`,
      row: target.row,
      column: target.column,
      remainingTurns: BUDDHA_BOMB_COUNTDOWN,
    },
  ];
}
function resolveBuddhaBombs(
  board: Board,
  bombs: BuddhaBomb[],
): {
  board: Board;
  bombs: BuddhaBomb[];
  explosions: BuddhaExplosion[];
} {
  const nextBoard = copyBoard(board);

  const tickingBombs = bombs.map((bomb) => ({
    ...bomb,
    remainingTurns: bomb.remainingTurns - 1,
  }));

  const explodingBombs = tickingBombs.filter(
    (bomb) => bomb.remainingTurns <= 0,
  );

  if (explodingBombs.length === 0) {
    return {
      board: nextBoard,
      bombs: tickingBombs,
      explosions: [],
    };
  }

  const explodedBombIds = new Set(
    explodingBombs.map((bomb) => bomb.id),
  );

  for (const bomb of explodingBombs) {
    for (
      let rowOffset = -1;
      rowOffset <= 1;
      rowOffset += 1
    ) {
      for (
        let columnOffset = -1;
        columnOffset <= 1;
        columnOffset += 1
      ) {
        const row = bomb.row + rowOffset;
        const column =
          bomb.column + columnOffset;

        if (
          row < 0 ||
          row >= nextBoard.length ||
          column < 0 ||
          column >= nextBoard[row].length
        ) {
          continue;
        }

        const value =
          nextBoard[row][column];

        // 중심칸(폭탄이 붙어있는 타일)은 삭제
        if (
          rowOffset === 0 &&
          columnOffset === 0
        ) {
          if (value > 0) {
            nextBoard[row][column] = 0;
          }

          continue;
        }

        // 블랙홀, 웜홀은 영향 없음
        if (
          value === BLACK_HOLE_TILE ||
          value === WORM_HOLE_TILE
        ) {
          continue;
        }

        // 주변 숫자는 절반으로 감소
        if (value > 0) {
          const reduced =
            Math.floor(value / 2);

          nextBoard[row][column] =
            Math.max(reduced, 2);
        }
      }
    }
  }

  return {
    board: nextBoard,

    bombs: tickingBombs.filter(
      (bomb) =>
        !explodedBombIds.has(bomb.id),
    ),

   explosions: explodingBombs.map((bomb) => ({
  id: `buddha-explosion-${bomb.id}-${Date.now()}`,
  row: bomb.row,
  column: bomb.column,
  startedAt: Date.now(),
})),
  };
}

function getBoardSize(
  difficulty: Difficulty,
): number {
  if (
    difficulty === "normal" ||
    difficulty === "buddha"
  ) {
    return 5;
  }

  return 4;
}

function getTargetTile(
  difficulty: Difficulty,
): number {
  if (difficulty === "normal") {
    return 4096;
  }

  if (difficulty === "buddha") {
    return 131072;
  }

  return 2048;
}

function getAwardedScore(
  difficulty: Difficulty,
): number {
  if (difficulty === "normal") {
    return 3000;
  }

  if (difficulty === "buddha") {
    return 0;
  }

  return 30;
}

function getDifficultyLabel(
  difficulty: Difficulty,
): string {
  if (difficulty === "easy") {
    return "쉬움";
  }

  if (difficulty === "normal") {
    return "보통";
  }

  if (difficulty === "buddha") {
    return "부처";
  }

  return "어려움";
}

function createEmptyBoard(
  boardSize: number,
): Board {
  return Array.from(
    { length: boardSize },
    () => Array(boardSize).fill(0),
  );
}

function copyBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function spawnRandomTile(
  board: Board,
  difficulty: Difficulty = "easy",
): Board {
  const nextBoard = copyBoard(board);

  const emptyCells: {
    row: number;
    column: number;
  }[] = [];

  for (
    let row = 0;
    row < nextBoard.length;
    row += 1
  ) {
    for (
      let column = 0;
      column < nextBoard[row].length;
      column += 1
    ) {
      if (nextBoard[row][column] === 0) {
        emptyCells.push({
          row,
          column,
        });
      }
    }
  }

  if (emptyCells.length === 0) {
    return nextBoard;
  }

  const randomCell =
    emptyCells[
      Math.floor(
        Math.random() * emptyCells.length,
      )
    ];

  if (difficulty === "buddha") {
    const roll = Math.random();

    nextBoard[randomCell.row][
      randomCell.column
    ] =
      roll < 0.3
        ? 4
        : roll < 0.7
          ? 8
          : roll < 0.9
            ? 16
            : 32;

    return nextBoard;
  }

  const fourProbability =
    difficulty === "easy"
      ? 0.05
      : difficulty === "normal"
        ? 0.25
        : 0.2;

  nextBoard[randomCell.row][
    randomCell.column
  ] =
    Math.random() < 1 - fourProbability
      ? 2
      : 4;

  return nextBoard;
}

function spawnBlackHoleTile(
  board: Board,
): Board {
  const nextBoard = copyBoard(board);

  const emptyCells: {
    row: number;
    column: number;
  }[] = [];

  for (
    let row = 0;
    row < nextBoard.length;
    row += 1
  ) {
    for (
      let column = 0;
      column < nextBoard[row].length;
      column += 1
    ) {
      if (nextBoard[row][column] === 0) {
        emptyCells.push({
          row,
          column,
        });
      }
    }
  }

  if (emptyCells.length === 0) {
    return nextBoard;
  }

  const randomCell =
    emptyCells[
      Math.floor(
        Math.random() * emptyCells.length,
      )
    ];

  nextBoard[randomCell.row][
    randomCell.column
  ] = BLACK_HOLE_TILE;

  return nextBoard;
}


function spawnWormHoleTile(
  board: Board,
): Board {
  const nextBoard = copyBoard(board);

  const candidates: {
    row: number;
    column: number;
  }[] = [];

  for (
    let row = 0;
    row < nextBoard.length;
    row += 1
  ) {
    for (
      let column = 0;
      column < nextBoard[row].length;
      column += 1
    ) {
      if (nextBoard[row][column] !== 0) {
        continue;
      }

      const availableDirections =
        getWormHoleOutputCells(
          nextBoard,
          {
            row,
            column,
          },
        );

      if (
        availableDirections.length >=
        WORM_HOLE_MIN_OUTPUT
      ) {
        candidates.push({
          row,
          column,
        });
      }
    }
  }

  if (candidates.length === 0) {
    return nextBoard;
  }

  const randomCell =
    candidates[
      Math.floor(
        Math.random() *
          candidates.length,
      )
    ];

  nextBoard[randomCell.row][
    randomCell.column
  ] = WORM_HOLE_TILE;

  return nextBoard;
}


function getRandomBuddhaWormHoleValue(): number {
  const values = [4, 8, 16, 32, 64];

  return values[
    Math.floor(Math.random() * values.length)
  ];
}

function spawnBuddhaWormHoleTile(
  board: Board,
): {
  board: Board;
  cell: {
    row: number;
    column: number;
  } | null;
} {
  const nextBoard = copyBoard(board);

  const emptyCells: {
    row: number;
    column: number;
  }[] = [];

  for (
    let row = 0;
    row < nextBoard.length;
    row += 1
  ) {
    for (
      let column = 0;
      column < nextBoard[row].length;
      column += 1
    ) {
      if (nextBoard[row][column] === 0) {
        emptyCells.push({
          row,
          column,
        });
      }
    }
  }

  if (emptyCells.length === 0) {
    return {
      board: nextBoard,
      cell: null,
    };
  }

  const cell =
    emptyCells[
      Math.floor(
        Math.random() * emptyCells.length,
      )
    ];

  nextBoard[cell.row][cell.column] =
    WORM_HOLE_TILE;

  return {
    board: nextBoard,
    cell,
  };
}

function emitBuddhaWormHoleTiles(
  board: Board,
  wormHole: {
    row: number;
    column: number;
  },
): WormHoleEmissionResult {
  const nextBoard = copyBoard(board);

  nextBoard[wormHole.row][
    wormHole.column
  ] = 0;

  const directions =
    shuffleCells(
      getWormHoleDirections(),
    );

  const emittedTiles:
    WormHoleOutputTile[] = [];

  const mergedTiles: {
    row: number;
    column: number;
  }[] = [];

  const absorbedBlackHoles: {
    row: number;
    column: number;
  }[] = [];

  let gainedScore = 0;

  for (const direction of directions) {
    if (
      emittedTiles.length >=
      BUDDHA_WORM_HOLE_OUTPUT_COUNT
    ) {
      break;
    }

    const value =
      getRandomBuddhaWormHoleValue();

    const target =
      resolveWormHoleShot(
        nextBoard,
        wormHole,
        direction,
        value,
      );

    if (!target) {
      continue;
    }

    if (target.absorbedByBlackHole) {
      nextBoard[target.row][
        target.column
      ] = 0;

      absorbedBlackHoles.push({
        row: target.row,
        column: target.column,
      });

      emittedTiles.push({
        id: `buddha-worm-blackhole-${Date.now()}-${emittedTiles.length}`,
        value,
        fromRow: wormHole.row,
        fromColumn:
          wormHole.column,
        toRow: target.row,
        toColumn: target.column,
        absorbed: true,
      });

      continue;
    }

    if (target.merged) {
      const mergedValue =
        nextBoard[target.row][
          target.column
        ] + value;

      nextBoard[target.row][
        target.column
      ] = mergedValue;

      gainedScore += mergedValue;

      mergedTiles.push({
        row: target.row,
        column: target.column,
      });
    } else {
      nextBoard[target.row][
        target.column
      ] = value;
    }

    emittedTiles.push({
      id: `buddha-worm-output-${Date.now()}-${emittedTiles.length}`,
      value,
      fromRow: wormHole.row,
      fromColumn:
        wormHole.column,
      toRow: target.row,
      toColumn: target.column,
    });
  }

  if (
    emittedTiles.length <
    BUDDHA_WORM_HOLE_OUTPUT_COUNT
  ) {
    const fallbackCells: {
      row: number;
      column: number;
    }[] = [];

    for (
      let row = 0;
      row < nextBoard.length;
      row += 1
    ) {
      for (
        let column = 0;
        column < nextBoard[row].length;
        column += 1
      ) {
        if (nextBoard[row][column] === 0) {
          fallbackCells.push({
            row,
            column,
          });
        }
      }
    }

    const needed =
      BUDDHA_WORM_HOLE_OUTPUT_COUNT -
      emittedTiles.length;

    for (
      const cell of shuffleCells(
        fallbackCells,
      ).slice(0, needed)
    ) {
      const value =
        getRandomBuddhaWormHoleValue();

      nextBoard[cell.row][cell.column] =
        value;

      emittedTiles.push({
        id: `buddha-worm-fallback-${Date.now()}-${emittedTiles.length}`,
        value,
        fromRow: wormHole.row,
        fromColumn:
          wormHole.column,
        toRow: cell.row,
        toColumn: cell.column,
      });
    }
  }

  return {
    board: nextBoard,
    emittedTiles,
    mergedTiles,
    absorbedBlackHoles,
    score: gainedScore,
  };
}

function getRandomWormHoleValue(): number {
  const roll = Math.random();

  if (roll < 0.35) {
    return 2;
  }

  if (roll < 0.65) {
    return 4;
  }

  if (roll < 0.85) {
    return 8;
  }

  if (roll < 0.95) {
    return 16;
  }

  return 32;
}

function shuffleCells<T>(items: T[]): T[] {
  const nextItems = [...items];

  for (
    let index =
      nextItems.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() * (index + 1),
      );

    [
      nextItems[index],
      nextItems[randomIndex],
    ] = [
      nextItems[randomIndex],
      nextItems[index],
    ];
  }

  return nextItems;
}

function getWormHoleDirections(): {
  row: number;
  column: number;
}[] {
  return [
    { row: -1, column: -1 },
    { row: -1, column: 0 },
    { row: -1, column: 1 },
    { row: 0, column: -1 },
    { row: 0, column: 1 },
    { row: 1, column: -1 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
  ];
}

function isInsideBoard(
  board: Board,
  row: number,
  column: number,
): boolean {
  return (
    row >= 0 &&
    row < board.length &&
    column >= 0 &&
    column < board[row].length
  );
}

function getWormHoleOutputCells(
  board: Board,
  wormHole: {
    row: number;
    column: number;
  },
): {
  row: number;
  column: number;
}[] {
  const cells: {
    row: number;
    column: number;
  }[] = [];

  for (
    const direction of
    getWormHoleDirections()
  ) {
    let row =
      wormHole.row + direction.row;

    let column =
      wormHole.column +
      direction.column;

    let lastEmptyCell:
      | {
          row: number;
          column: number;
        }
      | null = null;

    while (
      isInsideBoard(
        board,
        row,
        column,
      )
    ) {
      const value =
        board[row][column];

      if (
        value === BLACK_HOLE_TILE ||
        value === WORM_HOLE_TILE
      ) {
        break;
      }

      if (value === 0) {
        lastEmptyCell = {
          row,
          column,
        };

        row += direction.row;
        column += direction.column;
        continue;
      }

      if (value > 0) {
        cells.push({
          row,
          column,
        });
      } else if (lastEmptyCell) {
        cells.push(lastEmptyCell);
      }

      lastEmptyCell = null;
      break;
    }

    if (
      lastEmptyCell &&
      !cells.some(
        (cell) =>
          cell.row ===
            lastEmptyCell?.row &&
          cell.column ===
            lastEmptyCell?.column,
      )
    ) {
      cells.push(lastEmptyCell);
    }
  }

  return cells;
}

function resolveWormHoleShot(
  board: Board,
  wormHole: {
    row: number;
    column: number;
  },
  direction: {
    row: number;
    column: number;
  },
  value: number,
): {
  row: number;
  column: number;
  merged: boolean;
  absorbedByBlackHole: boolean;
} | null {
  let row =
    wormHole.row + direction.row;

  let column =
    wormHole.column +
    direction.column;

  let lastEmptyCell:
    | {
        row: number;
        column: number;
      }
    | null = null;

  while (
    isInsideBoard(
      board,
      row,
      column,
    )
  ) {
    const targetValue =
      board[row][column];

    if (
      targetValue === WORM_HOLE_TILE
    ) {
      return lastEmptyCell
        ? {
            ...lastEmptyCell,
            merged: false,
            absorbedByBlackHole: false,
          }
        : null;
    }

    if (
      targetValue === BLACK_HOLE_TILE
    ) {
      return {
        row,
        column,
        merged: false,
        absorbedByBlackHole: true,
      };
    }

    if (targetValue === 0) {
      lastEmptyCell = {
        row,
        column,
      };

      row += direction.row;
      column += direction.column;
      continue;
    }

    if (targetValue === value) {
      return {
        row,
        column,
        merged: true,
        absorbedByBlackHole: false,
      };
    }

    return lastEmptyCell
      ? {
          ...lastEmptyCell,
          merged: false,
          absorbedByBlackHole: false,
        }
      : null;
  }

  return lastEmptyCell
    ? {
        ...lastEmptyCell,
        merged: false,
        absorbedByBlackHole: false,
      }
    : null;
}

function emitWormHoleTiles(
  board: Board,
  wormHole: {
    row: number;
    column: number;
  },
): WormHoleEmissionResult {
  const nextBoard = copyBoard(board);

  const directions =
    shuffleCells(
      getWormHoleDirections(),
    );

  const desiredOutputCount =
    WORM_HOLE_MIN_OUTPUT +
    Math.floor(
      Math.random() *
        (WORM_HOLE_MAX_OUTPUT -
          WORM_HOLE_MIN_OUTPUT +
          1),
    );

  const emittedTiles:
    WormHoleOutputTile[] = [];

  const mergedTiles: {
    row: number;
    column: number;
  }[] = [];

  const absorbedBlackHoles: {
    row: number;
    column: number;
  }[] = [];

  let gainedScore = 0;

  for (const direction of directions) {
    if (
      emittedTiles.length >=
      desiredOutputCount
    ) {
      break;
    }

    const value =
      getRandomWormHoleValue();

    const target =
      resolveWormHoleShot(
        nextBoard,
        wormHole,
        direction,
        value,
      );

    if (!target) {
      continue;
    }

    if (target.absorbedByBlackHole) {
      nextBoard[target.row][
        target.column
      ] = 0;

      absorbedBlackHoles.push({
        row: target.row,
        column: target.column,
      });

      emittedTiles.push({
        id: `worm-output-blackhole-${Date.now()}-${emittedTiles.length}`,
        value,
        fromRow: wormHole.row,
        fromColumn:
          wormHole.column,
        toRow: target.row,
        toColumn: target.column,
        absorbed: true,
      });

      continue;
    }

    if (target.merged) {
      const mergedValue =
        nextBoard[target.row][
          target.column
        ] + value;

      nextBoard[target.row][
        target.column
      ] = mergedValue;

      gainedScore += mergedValue;

      mergedTiles.push({
        row: target.row,
        column: target.column,
      });
    } else {
      nextBoard[target.row][
        target.column
      ] = value;
    }

    emittedTiles.push({
      id: `worm-output-${Date.now()}-${emittedTiles.length}`,
      value,
      fromRow: wormHole.row,
      fromColumn:
        wormHole.column,
      toRow: target.row,
      toColumn: target.column,
    });
  }

  if (
    emittedTiles.length <
    WORM_HOLE_MIN_OUTPUT
  ) {
    const fallbackCells: {
      row: number;
      column: number;
    }[] = [];

    for (
      let row = 0;
      row < nextBoard.length;
      row += 1
    ) {
      for (
        let column = 0;
        column < nextBoard[row].length;
        column += 1
      ) {
        if (nextBoard[row][column] === 0) {
          fallbackCells.push({
            row,
            column,
          });
        }
      }
    }

    const needed =
      WORM_HOLE_MIN_OUTPUT -
      emittedTiles.length;

    for (
      const cell of shuffleCells(
        fallbackCells,
      ).slice(0, needed)
    ) {
      const value =
        getRandomWormHoleValue();

      nextBoard[cell.row][cell.column] =
        value;

      emittedTiles.push({
        id: `worm-output-fallback-${Date.now()}-${emittedTiles.length}`,
        value,
        fromRow: wormHole.row,
        fromColumn:
          wormHole.column,
        toRow: cell.row,
        toColumn: cell.column,
      });
    }
  }

  return {
    board: nextBoard,
    emittedTiles,
    mergedTiles,
    absorbedBlackHoles,
    score: gainedScore,
  };
}

function createInitialBoard(
  difficulty: Difficulty = "normal",
): Board {
  const boardSize =
    getBoardSize(difficulty);

  let nextBoard =
    createEmptyBoard(boardSize);

  const initialTileCount =
    difficulty === "easy"
      ? 2
      : difficulty === "normal"
        ? 5
        : difficulty === "buddha"
          ? 8
          : 4;

  for (
    let tileIndex = 0;
    tileIndex < initialTileCount;
    tileIndex += 1
  ) {
    nextBoard = spawnRandomTile(
      nextBoard,
      difficulty,
    );
  }

  return nextBoard;
}

function hasBoardChanged(
  previousBoard: Board,
  nextBoard: Board,
): boolean {
  return nextBoard.some(
    (row, rowIndex) =>
      row.some(
        (value, columnIndex) =>
          value !==
          previousBoard[rowIndex]?.[
            columnIndex
          ],
      ),
  );
}

function canMove(board: Board): boolean {
  for (const row of board) {
    if (row.includes(0)) {
      return true;
    }
  }

  for (
    let row = 0;
    row < board.length;
    row += 1
  ) {
    for (
      let column = 0;
      column <
      board[row].length - 1;
      column += 1
    ) {
      if (
        board[row][column] > 0 &&
        board[row][column] ===
        board[row][column + 1]
      ) {
        return true;
      }
    }
  }

  for (
    let row = 0;
    row < board.length - 1;
    row += 1
  ) {
    for (
      let column = 0;
      column < board[row].length;
      column += 1
    ) {
      if (
        board[row][column] > 0 &&
        board[row][column] ===
        board[row + 1][column]
      ) {
        return true;
      }
    }
  }

  return false;
}

function hasWon(
  board: Board,
  targetTile: number,
): boolean {
  return board.some((row) =>
    row.some(
      (value) => value >= targetTile,
    ),
  );
}

function getSpecialCells(
  board: Board,
  specialValue: number,
): {
  row: number;
  column: number;
}[] {
  const cells: {
    row: number;
    column: number;
  }[] = [];

  for (
    let row = 0;
    row < board.length;
    row += 1
  ) {
    for (
      let column = 0;
      column < board[row].length;
      column += 1
    ) {
      if (
        board[row][column] ===
        specialValue
      ) {
        cells.push({
          row,
          column,
        });
      }
    }
  }

  return cells;
}

function createMovementBoard(
  board: Board,
): Board {
  return board.map((row) =>
    row.map((value) =>
      value === BLACK_HOLE_TILE ||
      value === WORM_HOLE_TILE
        ? 0
        : value,
    ),
  );
}

function findCrossedSpecialCell(
  tile: {
    fromRow: number;
    fromColumn: number;
    toRow: number;
    toColumn: number;
  },
  specialCells: {
    row: number;
    column: number;
  }[],
  consumedKeys?: Set<string>,
): {
  row: number;
  column: number;
} | null {
  const rowStep = Math.sign(
    tile.toRow - tile.fromRow,
  );

  const columnStep = Math.sign(
    tile.toColumn - tile.fromColumn,
  );

  let row =
    tile.fromRow + rowStep;

  let column =
    tile.fromColumn + columnStep;

  while (
    row !== tile.toRow ||
    column !== tile.toColumn
  ) {
    const crossed =
      specialCells.find(
        (cell) =>
          cell.row === row &&
          cell.column === column &&
          !consumedKeys?.has(
            `${cell.row}:${cell.column}`,
          ),
      );

    if (crossed) {
      return crossed;
    }

    row += rowStep;
    column += columnStep;
  }

  
  return (
    specialCells.find(
      (cell) =>
        cell.row === tile.toRow &&
        cell.column === tile.toColumn &&
        !consumedKeys?.has(
          `${cell.row}:${cell.column}`,
        ),
    ) ?? null
  );
}

function restoreSpecialCells(
  board: Board,
  cells: {
    row: number;
    column: number;
  }[],
  specialValue: number,
): Board {
  const nextBoard = copyBoard(board);

  for (const cell of cells) {
    nextBoard[cell.row][cell.column] =
      specialValue;
  }

  return nextBoard;
}

function getTileClass(value: number): string {
  if (value === BLACK_HOLE_TILE) {
    return "bg-black text-white shadow-[inset_0_0_16px_rgba(139,92,246,0.9),0_0_14px_rgba(76,29,149,0.7)]";
  }

  if (value === WORM_HOLE_TILE) {
    return "bg-gradient-to-br from-fuchsia-700 via-violet-950 to-black text-white shadow-[inset_0_0_18px_rgba(232,121,249,0.95),0_0_16px_rgba(168,85,247,0.85)]";
  }

  switch (value) {
    case 2:
      return "bg-[#eee4da] text-[#776e65]";

    case 4:
      return "bg-[#ede0c8] text-[#776e65]";

    case 8:
      return "bg-[#f2b179] text-white";

    case 16:
      return "bg-[#f59563] text-white";

    case 32:
      return "bg-[#f67c5f] text-white";

    case 64:
      return "bg-[#f65e3b] text-white";

    case 128:
      return "bg-[#edcf72] text-white";

    case 256:
      return "bg-[#edcc61] text-white";

    case 512:
      return "bg-[#edc850] text-white";

    case 1024:
      return "bg-[#edc53f] text-white";

    case 2048:
      return "bg-[#edc22e] text-white";

    case 4096:
      return "bg-[#a78bfa] text-white";

    default:
      return "bg-[#3c3a32] text-white";
  }
}

function getTileTextSize(
  value: number,
  boardSize: number,
): string {
  if (
    value === BLACK_HOLE_TILE ||
    value === WORM_HOLE_TILE
  ) {
    return boardSize >= 5
      ? "text-2xl"
      : "text-3xl";
  }

  if (boardSize >= 5) {
    if (value >= 10000) {
      return "text-xs";
    }

    if (value >= 1000) {
      return "text-sm";
    }

    if (value >= 100) {
      return "text-base";
    }

    return "text-lg";
  }

  if (value >= 10000) {
    return "text-sm";
  }

  if (value >= 1000) {
    return "text-base";
  }

  if (value >= 100) {
    return "text-lg";
  }

  return "text-xl";
}

function getTileTransform(
  tile: AnimatedTile,
  animationStarted: boolean,
): string {
  if (!animationStarted) {
    return "translate(0, 0) scale(1) rotate(0deg)";
  }

  const columnDifference =
    tile.toColumn - tile.fromColumn;

  const rowDifference =
    tile.toRow - tile.fromRow;

  const horizontalPercent =
    columnDifference * 100;

  const horizontalGap =
    columnDifference * 0.375;

  const verticalPercent =
    rowDifference * 100;

  const verticalGap =
    rowDifference * 0.375;

  const absorptionEffect =
    tile.absorbed
      ? " scale(0.05) rotate(540deg)"
      : " scale(1) rotate(0deg)";

  return `translate(
    calc(${horizontalPercent}% + ${horizontalGap}rem),
    calc(${verticalPercent}% + ${verticalGap}rem)
  )${absorptionEffect}`;
}

type Hoo2048GameProps = {
  difficulty?: Difficulty;
  bestScore?: number;
  autoStartBuddha?: boolean;
  onScoreChange?: (score: number) => void;
  onRecordSaved?: () => void;
  onBackToMenu?: () => void;
};

export default function Hoo2048Game({
  difficulty = "easy",
  bestScore = 0,
  autoStartBuddha = false,
  onScoreChange,
  onRecordSaved,
  onBackToMenu,
}: Hoo2048GameProps) {
  const boardSize =
    getBoardSize(difficulty);

  const targetTile =
    getTargetTile(difficulty);

  const awardedScore =
    getAwardedScore(difficulty);

  const difficultyLabel =
    getDifficultyLabel(difficulty);

  const gridStyle = {
    gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${boardSize}, minmax(0, 1fr))`,
  };

  const [board, setBoard] =
    useState<Board>(() =>
      createInitialBoard(difficulty),
    );

  const [displayBoard, setDisplayBoard] =
    useState<Board>(() =>
      copyBoard(board),
    );

  const [score, setScore] =
    useState(0);

  const [moveCount, setMoveCount] =
    useState(0);

  const [
    buddhaRanking,
    setBuddhaRanking,
  ] = useState<BuddhaRankingEntry[]>([]);

  const [
    isBuddhaRankingLoading,
    setIsBuddhaRankingLoading,
  ] = useState(false);

  const [
    buddhaRankingError,
    setBuddhaRankingError,
  ] = useState("");

  const [
    currentBuddhaUserId,
    setCurrentBuddhaUserId,
  ] = useState<string | null>(null);

  const [
    buddhaPersonalBest,
    setBuddhaPersonalBest,
  ] = useState(0);

  const startedAtRef =
    useRef(Date.now());

  const scoreRef =
    useRef(0);

  const moveCountRef =
    useRef(0);

  const recordSubmittedRef =
    useRef(false);

  const [isAnimating, setIsAnimating] =
    useState(false);

  const [animatedTiles, setAnimatedTiles] =
    useState<AnimatedTile[]>([]);

  const [
    wormHoleOutputTiles,
    setWormHoleOutputTiles,
  ] = useState<WormHoleOutputTile[]>([]);

  const [
    animationStarted,
    setAnimationStarted,
  ] = useState(false);

  const [
    wormHoleEmissionStarted,
    setWormHoleEmissionStarted,
  ] = useState(false);

  const [mergedTileKeys, setMergedTileKeys] =
    useState<string[]>([]);

  const [isGameOver, setIsGameOver] =
    useState(false);

  const [isWon, setIsWon] =
    useState(false);

  const [hasContinued, setHasContinued] =
    useState(false);

  const [
    pendingBuddhaWormHoles,
    setPendingBuddhaWormHoles,
  ] = useState<PendingBuddhaWormHole[]>([]);

  const [buddhaBombs, setBuddhaBombs] =
    useState<BuddhaBomb[]>([]);

  const [
    buddhaExplosions,
    setBuddhaExplosions,
  ] = useState<BuddhaExplosion[]>([]);

  const [
    isBuddhaFocusMode,
    setIsBuddhaFocusMode,
  ] = useState(false);

  const [
    isEnteringBuddhaMode,
    setIsEnteringBuddhaMode,
  ] = useState(
    difficulty === "buddha" &&
      autoStartBuddha,
  );

  const buddhaEntryTimeoutRef =
    useRef<number | null>(null);

  const movementTimeoutRef =
    useRef<number | null>(null);

  const wormHoleEmissionTimeoutRef =
    useRef<number | null>(null);

  const buddhaExplosionTimeoutRef =
    useRef<number | null>(null);

  const mergeTimeoutRef =
    useRef<number | null>(null);

  const animationFrameRef =
    useRef<number | null>(null);

  const wormHoleEmissionFrameRef =
    useRef<number | null>(null);

  const touchStartXRef =
    useRef<number | null>(null);

  const touchStartYRef =
    useRef<number | null>(null);

  useEffect(() => {
    onScoreChange?.(score);
  }, [score, onScoreChange]);

  const loadBuddhaRanking = useCallback(
    async () => {
      if (difficulty !== "buddha") {
        return;
      }

      setIsBuddhaRankingLoading(true);
      setBuddhaRankingError("");

      try {
        const supabase = createClient();

        const [
          rankingResult,
          userResult,
        ] = await Promise.all([
          supabase.rpc(
            "get_2048_buddha_ranking",
            {
              p_limit: 10,
            },
          ),
          supabase.auth.getUser(),
        ]);

        if (rankingResult.error) {
          throw rankingResult.error;
        }

        const nextRanking =
          (
            rankingResult.data ?? []
          ).map(
            (
              item: Record<
                string,
                unknown
              >,
            ): BuddhaRankingEntry => ({
              rank: Number(
                item.rank ?? 0,
              ),
              userId: String(
                item.userId ?? "",
              ),
              nickname: String(
                item.nickname ??
                  "알 수 없는 사용자",
              ),
              avatarEmoji: String(
                item.avatarEmoji ?? "🙂",
              ),
              bestScore: Number(
                item.bestScore ?? 0,
              ),
              completedGames: Number(
                item.completedGames ?? 0,
              ),
              achievedAt:
                typeof item.achievedAt ===
                "string"
                  ? item.achievedAt
                  : null,
            }),
          );

        const nextUserId =
          userResult.data.user?.id ??
          null;

        setBuddhaRanking(nextRanking);
        setCurrentBuddhaUserId(
          nextUserId,
        );

        if (nextUserId) {
         const myEntry =
  nextRanking.find(
    (
      entry: BuddhaRankingEntry,
    ) =>
      entry.userId ===
      nextUserId,
  );

          if (myEntry) {
            setBuddhaPersonalBest(
              myEntry.bestScore,
            );
          }
        }
      } catch (error) {
        console.error(
          "부처모드 랭킹 조회 실패:",
          error,
        );

        setBuddhaRankingError(
          "랭킹을 불러오지 못했습니다.",
        );
      } finally {
        setIsBuddhaRankingLoading(false);
      }
    },
    [difficulty],
  );

  useEffect(() => {
    if (
      difficulty === "buddha" &&
      isBuddhaFocusMode
    ) {
      void loadBuddhaRanking();
    }
  }, [
    difficulty,
    isBuddhaFocusMode,
    loadBuddhaRanking,
  ]);

  function clearMovementAnimation() {
    if (
      buddhaEntryTimeoutRef.current !== null
    ) {
      window.clearTimeout(
        buddhaEntryTimeoutRef.current,
      );

      buddhaEntryTimeoutRef.current = null;
    }

    if (
      movementTimeoutRef.current !== null
    ) {
      window.clearTimeout(
        movementTimeoutRef.current,
      );

      movementTimeoutRef.current = null;
    }

    if (
      wormHoleEmissionTimeoutRef.current !==
      null
    ) {
      window.clearTimeout(
        wormHoleEmissionTimeoutRef.current,
      );

      wormHoleEmissionTimeoutRef.current =
        null;
    }

    if (
      buddhaExplosionTimeoutRef.current !==
      null
    ) {
      window.clearTimeout(
        buddhaExplosionTimeoutRef.current,
      );

      buddhaExplosionTimeoutRef.current =
        null;
    }

    if (
      mergeTimeoutRef.current !== null
    ) {
      window.clearTimeout(
        mergeTimeoutRef.current,
      );

      mergeTimeoutRef.current = null;
    }

    if (
      wormHoleEmissionFrameRef.current !==
      null
    ) {
      window.cancelAnimationFrame(
        wormHoleEmissionFrameRef.current,
      );

      wormHoleEmissionFrameRef.current =
        null;
    }

    if (
      animationFrameRef.current !== null
    ) {
      window.cancelAnimationFrame(
        animationFrameRef.current,
      );

      animationFrameRef.current = null;
    }
  }

  function showMergeAnimation(
    mergedTiles: {
      row: number;
      column: number;
    }[],
  ) {
    const keys = mergedTiles.map(
      ({ row, column }) =>
        `${row}-${column}`,
    );

    setMergedTileKeys(keys);

    if (
      mergeTimeoutRef.current !== null
    ) {
      window.clearTimeout(
        mergeTimeoutRef.current,
      );
    }

    mergeTimeoutRef.current =
      window.setTimeout(() => {
        setMergedTileKeys([]);
        mergeTimeoutRef.current = null;
      }, 180);
  }

  function enterBuddhaFocusMode() {
    if (
      difficulty !== "buddha" ||
      isEnteringBuddhaMode
    ) {
      return;
    }

    if (
      buddhaEntryTimeoutRef.current !== null
    ) {
      window.clearTimeout(
        buddhaEntryTimeoutRef.current,
      );

      buddhaEntryTimeoutRef.current = null;
    }

    setIsEnteringBuddhaMode(true);

    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      void document.documentElement
        .requestFullscreen()
        .catch((error) => {
          console.warn(
            "전체화면 진입에 실패했습니다:",
            error,
          );
        });
    }

    buddhaEntryTimeoutRef.current =
      window.setTimeout(() => {
        setIsEnteringBuddhaMode(false);
        setIsBuddhaFocusMode(true);

        buddhaEntryTimeoutRef.current = null;
      }, 1000);
  }

  function exitBuddhaFocusMode() {
    if (
      buddhaEntryTimeoutRef.current !== null
    ) {
      window.clearTimeout(
        buddhaEntryTimeoutRef.current,
      );

      buddhaEntryTimeoutRef.current = null;
    }

    setIsEnteringBuddhaMode(false);
    setIsBuddhaFocusMode(false);

    if (
      document.fullscreenElement &&
      document.exitFullscreen
    ) {
      void document
        .exitFullscreen()
        .catch((error) => {
          console.warn(
            "전체화면 종료에 실패했습니다:",
            error,
          );
        });
    }
  }

  useEffect(() => {
    function handleFullscreenChange() {
      if (difficulty !== "buddha") {
        return;
      }

      if (!document.fullscreenElement) {
        if (
          buddhaEntryTimeoutRef.current !== null
        ) {
          window.clearTimeout(
            buddhaEntryTimeoutRef.current,
          );

          buddhaEntryTimeoutRef.current = null;
        }

        setIsEnteringBuddhaMode(false);
        setIsBuddhaFocusMode(false);
      }
    }

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange,
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
      );
    };
  }, [difficulty]);

  function restartGame() {
    clearMovementAnimation();

    const nextBoard =
      createInitialBoard(difficulty);

    startedAtRef.current = Date.now();
    scoreRef.current = 0;
    moveCountRef.current = 0;
    recordSubmittedRef.current = false;

    setBoard(nextBoard);
    setDisplayBoard(
      copyBoard(nextBoard),
    );
    setScore(0);
    setMoveCount(0);
    setIsAnimating(false);
    setAnimatedTiles([]);
    setWormHoleOutputTiles([]);
    setAnimationStarted(false);
    setWormHoleEmissionStarted(false);
    setMergedTileKeys([]);
    setIsGameOver(false);
    setIsWon(false);
    setHasContinued(false);
    setPendingBuddhaWormHoles([]);
    setBuddhaBombs([]);
    setBuddhaExplosions([]);
  }

  function returnToGameSelection() {
    clearMovementAnimation();

    setIsEnteringBuddhaMode(false);
    setIsBuddhaFocusMode(false);

    if (
      document.fullscreenElement &&
      document.exitFullscreen
    ) {
      void document
        .exitFullscreen()
        .catch((error) => {
          console.warn(
            "전체화면 종료에 실패했습니다:",
            error,
          );
        })
        .finally(() => {
          if (onBackToMenu) {
            onBackToMenu();
            return;
          }

          restartGame();
        });

      return;
    }

    if (onBackToMenu) {
      onBackToMenu();
      return;
    }

    restartGame();
  }

  function continueGame() {
    recordSubmittedRef.current = false;
    setIsWon(false);
    setHasContinued(true);
  }

  const submitRecord = useCallback(
    async (
      finalScore: number,
      finalBoard: Board,
    ) => {
      if (recordSubmittedRef.current) {
        return;
      }

      recordSubmittedRef.current = true;

      try {
        const elapsedSeconds = Math.floor(
          (Date.now() -
            startedAtRef.current) /
            1000,
        );

        const maxTile = Math.max(
          ...finalBoard
            .flat()
            .filter((value) => value > 0),
          0,
        );

        await submit2048Completion({
          difficulty,
          score: finalScore,
          elapsedSeconds,
          maxTile,
        });

        if (difficulty === "buddha") {
          setBuddhaPersonalBest(
            (previousBest) =>
              Math.max(
                previousBest,
                finalScore,
              ),
          );

          await loadBuddhaRanking();
        }

        onRecordSaved?.();
      } catch (error) {
        recordSubmittedRef.current = false;

        console.error(
          "2048 기록 저장 실패:",
          error,
        );
      }
    },
    [
      difficulty,
      loadBuddhaRanking,
      onRecordSaved,
    ],
  );

  const performMove = useCallback(
    (moveFunction: MoveFunction) => {
      if (
        isAnimating ||
        isGameOver ||
        isWon
      ) {
        return;
      }

      const usesBlackHole =
        difficulty === "normal" ||
        difficulty === "hard" ||
        difficulty === "buddha";

      const blackHoleCells =
        usesBlackHole
          ? getSpecialCells(
              board,
              BLACK_HOLE_TILE,
            )
          : [];

      const wormHoleCells =
        difficulty === "hard" ||
        difficulty === "buddha"
          ? getSpecialCells(
              board,
              WORM_HOLE_TILE,
            )
          : [];

      const movementBoard =
        usesBlackHole
          ? createMovementBoard(board)
          : board;

      const result =
        moveFunction(movementBoard);

      if (
        !hasBoardChanged(
          movementBoard,
          result.board,
        )
      ) {
        if (!canMove(movementBoard)) {
          setIsGameOver(true);

          void submitRecord(
            scoreRef.current,
            board,
          );
        }

        return;
      }

      const movedResultBoard =
        copyBoard(result.board);

      const consumedBlackHoleKeys =
        new Set<string>();

      const consumedWormHoleKeys =
        new Set<string>();

      const triggeredWormHoles: {
        row: number;
        column: number;
      }[] = [];

      const movementTiles =
        result.movedTiles.map(
          (tile, index) => {
            const crossedBlackHole =
              usesBlackHole
                ? findCrossedSpecialCell(
                    tile,
                    blackHoleCells,
                    consumedBlackHoleKeys,
                  )
                : null;

            const crossedWormHole =
              !crossedBlackHole &&
              difficulty === "hard"
                ? findCrossedSpecialCell(
                    tile,
                    wormHoleCells,
                    consumedWormHoleKeys,
                  )
                : null;

            const crossedSpecialCell =
              crossedBlackHole ??
              crossedWormHole;

            if (crossedSpecialCell) {
              movedResultBoard[
                tile.toRow
              ][tile.toColumn] = 0;
            }

            if (crossedBlackHole) {
              consumedBlackHoleKeys.add(
                `${crossedBlackHole.row}:${crossedBlackHole.column}`,
              );
            }

            if (crossedWormHole) {
              const key =
                `${crossedWormHole.row}:${crossedWormHole.column}`;

              consumedWormHoleKeys.add(key);

              triggeredWormHoles.push(
                crossedWormHole,
              );
            }

            return {
              id: `${Date.now()}-${index}`,
              value: tile.value,
              fromRow: tile.fromRow,
              fromColumn:
                tile.fromColumn,
              toRow:
                crossedSpecialCell?.row ??
                tile.toRow,
              toColumn:
                crossedSpecialCell?.column ??
                tile.toColumn,
              absorbed:
                Boolean(
                  crossedSpecialCell,
                ),
            };
          },
        );

      const movedBuddhaBombs =
        difficulty === "buddha"
          ? moveBuddhaBombsWithTiles(
              buddhaBombs,
              result.movedTiles,
            )
          : buddhaBombs;

      const remainingBlackHoleCells =
        blackHoleCells.filter(
          (cell) =>
            !consumedBlackHoleKeys.has(
              `${cell.row}:${cell.column}`,
            ),
        );

      const remainingWormHoleCells =
        wormHoleCells.filter(
          (cell) =>
            !consumedWormHoleKeys.has(
              `${cell.row}:${cell.column}`,
            ),
        );

      setIsAnimating(true);
      setAnimationStarted(false);
      setAnimatedTiles(movementTiles);

      const animationBoard =
        createEmptyBoard(boardSize);

      for (
        const cell of blackHoleCells
      ) {
        animationBoard[cell.row][
          cell.column
        ] = BLACK_HOLE_TILE;
      }

      for (
        const cell of wormHoleCells
      ) {
        animationBoard[cell.row][
          cell.column
        ] = WORM_HOLE_TILE;
      }

      setDisplayBoard(animationBoard);

      animationFrameRef.current =
        window.requestAnimationFrame(() => {
          animationFrameRef.current =
            window.requestAnimationFrame(
              () => {
                setAnimationStarted(true);
                animationFrameRef.current =
                  null;
              },
            );
        });

      movementTimeoutRef.current =
        window.setTimeout(() => {
          const nextMoveCount =
            moveCountRef.current + 1;

          moveCountRef.current =
            nextMoveCount;

          setMoveCount(nextMoveCount);

          let nextBoard =
            usesBlackHole
              ? restoreSpecialCells(
                  movedResultBoard,
                  remainingBlackHoleCells,
                  BLACK_HOLE_TILE,
                )
              : movedResultBoard;

          if (
            difficulty === "buddha"
          ) {
            nextBoard =
              restoreSpecialCells(
                nextBoard,
                remainingWormHoleCells,
                WORM_HOLE_TILE,
              );
          }

          const emittedTiles:
            WormHoleOutputTile[] = [];

          const wormHoleMergedTiles: {
            row: number;
            column: number;
          }[] = [];

          const absorbedBlackHoleTiles: {
            row: number;
            column: number;
          }[] = [];

          let wormHoleScore = 0;

          if (difficulty === "hard") {
            nextBoard =
              restoreSpecialCells(
                nextBoard,
                remainingWormHoleCells,
                WORM_HOLE_TILE,
              );

            for (
              const wormHole of
              triggeredWormHoles
            ) {
              const emissionResult =
                emitWormHoleTiles(
                  nextBoard,
                  wormHole,
                );

              nextBoard =
                emissionResult.board;

              emittedTiles.push(
                ...emissionResult.emittedTiles,
              );

              wormHoleMergedTiles.push(
                ...emissionResult.mergedTiles,
              );

              absorbedBlackHoleTiles.push(
                ...emissionResult.absorbedBlackHoles,
              );

              wormHoleScore +=
                emissionResult.score;
            }
          }

          let nextPendingBuddhaWormHoles =
            pendingBuddhaWormHoles;

          if (difficulty === "buddha") {
            const activatingWormHoles =
              pendingBuddhaWormHoles.filter(
                (wormHole) =>
                  wormHole.activateAtMove <=
                  nextMoveCount,
              );

            nextPendingBuddhaWormHoles =
              pendingBuddhaWormHoles.filter(
                (wormHole) =>
                  wormHole.activateAtMove >
                  nextMoveCount,
              );

            for (
              const wormHole of
              activatingWormHoles
            ) {
              const emissionResult =
                emitBuddhaWormHoleTiles(
                  nextBoard,
                  wormHole,
                );

              nextBoard =
                emissionResult.board;

              emittedTiles.push(
                ...emissionResult.emittedTiles,
              );

              wormHoleMergedTiles.push(
                ...emissionResult.mergedTiles,
              );

              absorbedBlackHoleTiles.push(
                ...emissionResult.absorbedBlackHoles,
              );

              wormHoleScore +=
                emissionResult.score;
            }
          }

         let nextBuddhaBombs =
  movedBuddhaBombs;

let nextBuddhaExplosions:
  BuddhaExplosion[] = [];

// 새로 생성된 폭탄은 이번 턴에는 절대 카운트다운하지 않는다.
if (
  difficulty === "buddha" &&
  nextMoveCount %
    BUDDHA_BOMB_INTERVAL !==
    0
) {
  const bombResult =
    resolveBuddhaBombs(
      nextBoard,
      nextBuddhaBombs,
    );

  nextBoard = bombResult.board;
  nextBuddhaBombs =
    bombResult.bombs;
  nextBuddhaExplosions =
    bombResult.explosions;
}

          nextBoard =
            spawnRandomTile(
              nextBoard,
              difficulty,
            );

          if (
            difficulty === "buddha" &&
            nextMoveCount %
              BUDDHA_WORM_HOLE_INTERVAL ===
              0
          ) {
            const spawnedWormHole =
              spawnBuddhaWormHoleTile(
                nextBoard,
              );

            nextBoard =
              spawnedWormHole.board;

            if (spawnedWormHole.cell) {
              nextPendingBuddhaWormHoles = [
                ...nextPendingBuddhaWormHoles,
                {
                  ...spawnedWormHole.cell,
                  activateAtMove:
                    nextMoveCount + 1,
                },
              ];
            }
          }

          if (
            difficulty === "buddha" &&
            nextMoveCount %
              BUDDHA_BOMB_INTERVAL ===
              0
          ) {
            nextBuddhaBombs =
              spawnBuddhaBomb(
                nextBoard,
                nextBuddhaBombs,
              );
          }

          if (
            difficulty === "buddha" &&
            nextMoveCount %
              BUDDHA_BLACK_HOLE_INTERVAL ===
              0
          ) {
            nextBoard =
              spawnBlackHoleTile(
                nextBoard,
              );
          }

          if (
            (
              difficulty === "normal" ||
              difficulty === "hard"
            ) &&
            nextMoveCount %
              NORMAL_BLACK_HOLE_INTERVAL ===
              0
          ) {
            nextBoard =
              spawnBlackHoleTile(
                nextBoard,
              );
          }

          if (
            difficulty === "hard" &&
            nextMoveCount %
              NORMAL_WORM_HOLE_INTERVAL ===
              0
          ) {
            nextBoard =
              spawnWormHoleTile(
                nextBoard,
              );
          }

          const nextScore =
            scoreRef.current +
            result.score +
            wormHoleScore;

          scoreRef.current = nextScore;
          setScore(nextScore);

          if (difficulty === "buddha") {
            setPendingBuddhaWormHoles(
              nextPendingBuddhaWormHoles,
            );
            setBuddhaBombs(
              nextBuddhaBombs,
            );

            if (
              nextBuddhaExplosions.length >
              0
            ) {
              setBuddhaExplosions(
                nextBuddhaExplosions,
              );

              if (
                buddhaExplosionTimeoutRef.current !==
                null
              ) {
                window.clearTimeout(
                  buddhaExplosionTimeoutRef.current,
                );
              }

              buddhaExplosionTimeoutRef.current =
                window.setTimeout(() => {
                  setBuddhaExplosions([]);
                  buddhaExplosionTimeoutRef.current =
                    null;
                }, BUDDHA_EXPLOSION_DURATION);
            }
          }

          showMergeAnimation([
            ...result.mergedTiles,
            ...wormHoleMergedTiles,
          ]);

          const finishMove = () => {
            setBoard(nextBoard);
            setDisplayBoard(
              copyBoard(nextBoard),
            );

            if (
              difficulty !== "buddha" &&
              !hasContinued &&
              hasWon(
                nextBoard,
                targetTile,
              )
            ) {
              setIsWon(true);

              void submitRecord(
                nextScore,
                nextBoard,
              );
            }

            if (
              !canMove(
                createMovementBoard(
                  nextBoard,
                ),
              )
            ) {
              setIsGameOver(true);

              void submitRecord(
                nextScore,
                nextBoard,
              );
            }

            setAnimatedTiles([]);
            setWormHoleOutputTiles([]);
            setAnimationStarted(false);
            setWormHoleEmissionStarted(
              false,
            );
            setIsAnimating(false);
          };

          if (emittedTiles.length > 0) {
            const emissionDisplayBoard =
              copyBoard(nextBoard);

            for (
              const tile of emittedTiles
            ) {
              const isMergeTarget =
                wormHoleMergedTiles.some(
                  (mergedTile) =>
                    mergedTile.row ===
                      tile.toRow &&
                    mergedTile.column ===
                      tile.toColumn,
                );

              const isBlackHoleTarget =
                absorbedBlackHoleTiles.some(
                  (blackHole) =>
                    blackHole.row ===
                      tile.toRow &&
                    blackHole.column ===
                      tile.toColumn,
                );

              if (isBlackHoleTarget) {
                emissionDisplayBoard[
                  tile.toRow
                ][tile.toColumn] =
                  BLACK_HOLE_TILE;
              } else if (
                !isMergeTarget
              ) {
                emissionDisplayBoard[
                  tile.toRow
                ][tile.toColumn] = 0;
              } else {
                emissionDisplayBoard[
                  tile.toRow
                ][tile.toColumn] =
                  tile.value;
              }
            }

            setBoard(nextBoard);
            setDisplayBoard(
              emissionDisplayBoard,
            );
            setAnimatedTiles([]);
            setAnimationStarted(false);
            setWormHoleOutputTiles(
              emittedTiles,
            );
            setWormHoleEmissionStarted(
              false,
            );

            wormHoleEmissionFrameRef.current =
              window.requestAnimationFrame(
                () => {
                  wormHoleEmissionFrameRef.current =
                    window.requestAnimationFrame(
                      () => {
                        setWormHoleEmissionStarted(
                          true,
                        );

                        wormHoleEmissionFrameRef.current =
                          null;
                      },
                    );
                },
              );

            wormHoleEmissionTimeoutRef.current =
              window.setTimeout(() => {
                if (
                  wormHoleMergedTiles.length >
                  0
                ) {
                  showMergeAnimation(
                    wormHoleMergedTiles,
                  );
                }

                finishMove();

                wormHoleEmissionTimeoutRef.current =
                  null;
              }, WORM_HOLE_EMISSION_DURATION);
          } else {
            finishMove();
          }

          movementTimeoutRef.current =
            null;
        }, ANIMATION_DURATION);
    },
    [
      board,
      boardSize,
      buddhaBombs,
      difficulty,
      hasContinued,
      isAnimating,
      isGameOver,
      isWon,
      pendingBuddhaWormHoles,
      submitRecord,
      targetTile,
    ],
  );

  function handleTouchStart(
    event: React.TouchEvent<HTMLDivElement>,
  ) {
    touchStartXRef.current =
      event.touches[0].clientX;

    touchStartYRef.current =
      event.touches[0].clientY;
  }

  function handleTouchEnd(
    event: React.TouchEvent<HTMLDivElement>,
  ) {
    if (
      touchStartXRef.current === null ||
      touchStartYRef.current === null
    ) {
      return;
    }

    const deltaX =
      event.changedTouches[0].clientX -
      touchStartXRef.current;

    const deltaY =
      event.changedTouches[0].clientY -
      touchStartYRef.current;

    const minSwipe = 30;

    if (
      Math.abs(deltaX) < minSwipe &&
      Math.abs(deltaY) < minSwipe
    ) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }

    if (
      Math.abs(deltaX) >
      Math.abs(deltaY)
    ) {
      if (deltaX > 0) {
        performMove(
          moveRightWithScore,
        );
      } else {
        performMove(
          moveLeftWithScore,
        );
      }
    } else if (deltaY > 0) {
      performMove(
        moveDownWithScore,
      );
    } else {
      performMove(
        moveUpWithScore,
      );
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  }

  function handleTouchCancel() {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  }

  useEffect(() => {
    clearMovementAnimation();

    startedAtRef.current = Date.now();
    scoreRef.current = 0;
    moveCountRef.current = 0;
    recordSubmittedRef.current = false;

    const initialBoard =
      createInitialBoard(difficulty);

    const shouldAutoStartBuddha =
      difficulty === "buddha" &&
      autoStartBuddha;

    setBoard(initialBoard);
    setDisplayBoard(
      copyBoard(initialBoard),
    );
    setScore(0);
    setMoveCount(0);
    setIsAnimating(false);
    setAnimatedTiles([]);
    setWormHoleOutputTiles([]);
    setAnimationStarted(false);
    setWormHoleEmissionStarted(false);
    setMergedTileKeys([]);
    setIsGameOver(false);
    setIsWon(false);
    setHasContinued(false);
    setPendingBuddhaWormHoles([]);
    setBuddhaBombs([]);
    setBuddhaExplosions([]);
    setBuddhaRanking([]);
    setBuddhaRankingError("");
    setCurrentBuddhaUserId(null);
    setBuddhaPersonalBest(0);
    setIsBuddhaFocusMode(false);
    setIsEnteringBuddhaMode(
      shouldAutoStartBuddha,
    );

    if (shouldAutoStartBuddha) {
      buddhaEntryTimeoutRef.current =
        window.setTimeout(() => {
          setIsEnteringBuddhaMode(false);
          setIsBuddhaFocusMode(true);

          buddhaEntryTimeoutRef.current =
            null;
        }, 1000);
    }
  }, [difficulty, autoStartBuddha]);

  useEffect(() => {
    const previousTitle =
      document.title;

    document.title =
      `HOO 2048 - ${difficultyLabel}`;

    return () => {
      document.title =
        previousTitle;
    };
  }, [difficultyLabel]);

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape" &&
        difficulty === "buddha" &&
        (isBuddhaFocusMode ||
          isEnteringBuddhaMode)
      ) {
        event.preventDefault();
        exitBuddhaFocusMode();
        return;
      }

      if (
        difficulty === "buddha" &&
        !isBuddhaFocusMode
      ) {
        return;
      }

      switch (event.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          event.preventDefault();
          performMove(
            moveLeftWithScore,
          );
          break;

        case "ArrowRight":
        case "d":
        case "D":
          event.preventDefault();
          performMove(
            moveRightWithScore,
          );
          break;

        case "ArrowUp":
        case "w":
        case "W":
          event.preventDefault();
          performMove(
            moveUpWithScore,
          );
          break;

        case "ArrowDown":
        case "s":
        case "S":
          event.preventDefault();
          performMove(
            moveDownWithScore,
          );
          break;

        default:
          break;
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    difficulty,
    isBuddhaFocusMode,
    isEnteringBuddhaMode,
    performMove,
  ]);

  useEffect(() => {
    return () => {
      clearMovementAnimation();
    };
  }, []);

  function renderBuddhaGameLayout() {
    const buddhaBoardSize = 5;

    const displayedBuddhaBest =
      Math.max(
        score,
        bestScore,
        buddhaPersonalBest,
      );

    const hasCriticalBuddhaBomb =
      buddhaBombs.some(
        (bomb) => bomb.remainingTurns <= 3,
      );

    const hasFinalBuddhaBomb =
      buddhaBombs.some(
        (bomb) => bomb.remainingTurns <= 1,
      );

    const buddhaGridStyle = {
      gridTemplateColumns:
        `repeat(${buddhaBoardSize}, minmax(0, 1fr))`,
      gridTemplateRows:
        `repeat(${buddhaBoardSize}, minmax(0, 1fr))`,
    };

    return createPortal(
      <div
        className={`fixed inset-0 z-[999999] h-[100dvh] w-[100dvw] overflow-hidden bg-black text-white ${
          hasCriticalBuddhaBomb
            ? "buddha-danger-screen"
            : ""
        }`}
      >
        <style jsx global>{`
          .buddha-explosion-ring {
            position: absolute;
            inset: 0;
            border: clamp(3px, 0.45vw, 6px) solid rgba(255, 74, 74, 0.98);
            border-radius: 9999px;
            box-shadow:
              0 0 18px rgba(255, 45, 45, 0.95),
              inset 0 0 18px rgba(255, 110, 70, 0.75);
            animation: buddhaExplosionRing 420ms ease-out forwards;
            will-change: transform, opacity;
          }

          .buddha-explosion-flash {
            position: absolute;
            inset: -18%;
            border-radius: 9999px;
            background:
              radial-gradient(
                circle,
                rgba(255, 255, 255, 1) 0%,
                rgba(255, 224, 170, 0.98) 17%,
                rgba(255, 112, 64, 0.92) 38%,
                rgba(239, 68, 68, 0.7) 62%,
                rgba(127, 29, 29, 0) 100%
              );
            filter: blur(1px);
            animation: buddhaExplosionFlash 420ms ease-out forwards;
            will-change: transform, opacity, filter;
          }

          .buddha-explosion-core {
            position: absolute;
            inset: 14%;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.94);
            box-shadow:
              0 0 20px rgba(255, 255, 255, 1),
              0 0 44px rgba(255, 70, 45, 1);
            animation: buddhaExplosionCore 420ms ease-out forwards;
            will-change: transform, opacity;
          }

          .buddha-explosion-emoji {
            position: relative;
            z-index: 2;
            font-size: clamp(24px, 4vw, 52px);
            line-height: 1;
            filter:
              drop-shadow(0 0 8px rgba(255, 255, 255, 1))
              drop-shadow(0 0 16px rgba(255, 60, 40, 0.95));
            animation: buddhaExplosionEmoji 420ms ease-out forwards;
            will-change: transform, opacity;
          }

          @keyframes buddhaExplosionRing {
            0% {
              transform: scale(0.25);
              opacity: 1;
            }

            55% {
              opacity: 0.9;
            }

            100% {
              transform: scale(3.15);
              opacity: 0;
            }
          }

          @keyframes buddhaExplosionFlash {
            0% {
              transform: scale(0.25);
              opacity: 1;
              filter: blur(0);
            }

            45% {
              transform: scale(1.55);
              opacity: 0.92;
              filter: blur(1px);
            }

            100% {
              transform: scale(2.65);
              opacity: 0;
              filter: blur(5px);
            }
          }

          @keyframes buddhaExplosionCore {
            0% {
              transform: scale(0.35);
              opacity: 1;
            }

            50% {
              transform: scale(1.25);
              opacity: 1;
            }

            100% {
              transform: scale(1.8);
              opacity: 0;
            }
          }

          @keyframes buddhaExplosionEmoji {
            0% {
              transform: scale(0.45) rotate(-12deg);
              opacity: 0;
            }

            25% {
              transform: scale(1.22) rotate(6deg);
              opacity: 1;
            }

            100% {
              transform: scale(1.65) rotate(14deg);
              opacity: 0;
            }
          }

          .buddha-bomb-countdown {
            transform-origin: center;
            will-change: transform, filter, box-shadow;
          }

          .buddha-bomb-danger {
            animation:
              buddhaBombDangerPulse 0.78s ease-in-out infinite;
          }

          .buddha-bomb-warning {
            animation:
              buddhaBombWarningShake 0.42s ease-in-out infinite,
              buddhaBombDangerPulse 0.62s ease-in-out infinite;
          }

          .buddha-bomb-critical {
            animation:
              buddhaBombCriticalShake 0.2s linear infinite,
              buddhaBombCriticalPulse 0.42s ease-in-out infinite;
            background:
              linear-gradient(
                135deg,
                rgba(69, 10, 10, 0.98),
                rgba(185, 28, 28, 0.98)
              );
            border-color: rgba(254, 202, 202, 1);
            color: white;
            box-shadow:
              0 0 14px rgba(255, 255, 255, 0.6),
              0 0 30px rgba(239, 68, 68, 1),
              inset 0 0 12px rgba(255, 255, 255, 0.18);
          }

          .buddha-bomb-final {
            animation:
              buddhaBombFinalShake 0.11s linear infinite,
              buddhaBombFinalPulse 0.26s ease-in-out infinite;
            box-shadow:
              0 0 18px rgba(255, 255, 255, 0.95),
              0 0 42px rgba(239, 68, 68, 1),
              0 0 70px rgba(127, 29, 29, 0.95);
          }

          .buddha-danger-screen {
            animation:
              buddhaDangerScreenShake 0.18s linear infinite;
          }

          .buddha-final-warning-overlay {
            position: fixed;
            inset: 0;
            z-index: 999998;
            pointer-events: none;
            background:
              radial-gradient(
                circle at center,
                transparent 42%,
                rgba(220, 38, 38, 0.18) 78%,
                rgba(127, 29, 29, 0.34) 100%
              );
            animation:
              buddhaFinalWarningOverlay 0.28s ease-in-out infinite;
          }

          .buddha-screen-explosion-flash {
            position: fixed;
            inset: 0;
            z-index: 1000000;
            pointer-events: none;
            background:
              radial-gradient(
                circle at center,
                rgba(255, 255, 255, 0.82) 0%,
                rgba(255, 154, 88, 0.48) 32%,
                rgba(239, 68, 68, 0.26) 68%,
                transparent 100%
              );
            animation:
              buddhaScreenExplosionFlash 420ms ease-out forwards;
          }

          .buddha-explosion-particle {
            position: absolute;
            left: 50%;
            top: 50%;
            width: clamp(5px, 0.8vw, 10px);
            height: clamp(12px, 1.7vw, 22px);
            margin-left: clamp(-3px, -0.4vw, -5px);
            margin-top: clamp(-6px, -0.85vw, -11px);
            border-radius: 9999px;
            background:
              linear-gradient(
                to bottom,
                rgba(255, 255, 255, 1),
                rgba(253, 186, 116, 1) 34%,
                rgba(239, 68, 68, 0.95) 72%,
                rgba(127, 29, 29, 0)
              );
            box-shadow:
              0 0 10px rgba(255, 220, 160, 1),
              0 0 18px rgba(239, 68, 68, 0.92);
            opacity: 0;
            transform-origin: 50% 100%;
            will-change: transform, opacity;
          }

          .buddha-explosion-particle-1 {
            animation: buddhaExplosionParticle1 420ms ease-out forwards;
          }

          .buddha-explosion-particle-2 {
            animation: buddhaExplosionParticle2 420ms ease-out forwards;
          }

          .buddha-explosion-particle-3 {
            animation: buddhaExplosionParticle3 420ms ease-out forwards;
          }

          .buddha-explosion-particle-4 {
            animation: buddhaExplosionParticle4 420ms ease-out forwards;
          }

          .buddha-explosion-particle-5 {
            animation: buddhaExplosionParticle5 420ms ease-out forwards;
          }

          .buddha-explosion-particle-6 {
            animation: buddhaExplosionParticle6 420ms ease-out forwards;
          }

          .buddha-explosion-particle-7 {
            animation: buddhaExplosionParticle7 420ms ease-out forwards;
          }

          .buddha-explosion-particle-8 {
            animation: buddhaExplosionParticle8 420ms ease-out forwards;
          }

          @keyframes buddhaBombDangerPulse {
            0%,
            100% {
              transform: scale(1);
              filter: brightness(1);
            }

            50% {
              transform: scale(1.08);
              filter: brightness(1.35);
            }
          }

          @keyframes buddhaBombWarningShake {
            0%,
            100% {
              transform: translateX(0) rotate(0deg);
            }

            25% {
              transform: translateX(-2px) rotate(-2deg);
            }

            75% {
              transform: translateX(2px) rotate(2deg);
            }
          }

          @keyframes buddhaBombCriticalShake {
            0%,
            100% {
              transform: translate(0, 0) rotate(0deg);
            }

            25% {
              transform: translate(-3px, 1px) rotate(-3deg);
            }

            50% {
              transform: translate(3px, -1px) rotate(3deg);
            }

            75% {
              transform: translate(-2px, -1px) rotate(-2deg);
            }
          }

          @keyframes buddhaBombCriticalPulse {
            0%,
            100% {
              scale: 1;
              filter: brightness(1);
            }

            50% {
              scale: 1.25;
              filter: brightness(1.55);
            }
          }

          @keyframes buddhaBombFinalShake {
            0%,
            100% {
              transform: translate(0, 0) rotate(0deg);
            }

            25% {
              transform: translate(-4px, 2px) rotate(-5deg);
            }

            50% {
              transform: translate(4px, -2px) rotate(5deg);
            }

            75% {
              transform: translate(-3px, -2px) rotate(-4deg);
            }
          }

          @keyframes buddhaBombFinalPulse {
            0%,
            100% {
              scale: 1.06;
              filter: brightness(1.2);
            }

            50% {
              scale: 1.38;
              filter: brightness(1.9);
            }
          }

          @keyframes buddhaDangerScreenShake {
            0%,
            100% {
              transform: translate(0, 0);
            }

            25% {
              transform: translate(-1px, 0);
            }

            50% {
              transform: translate(1px, 1px);
            }

            75% {
              transform: translate(0, -1px);
            }
          }

          @keyframes buddhaFinalWarningOverlay {
            0%,
            100% {
              opacity: 0.28;
            }

            50% {
              opacity: 0.78;
            }
          }

          @keyframes buddhaScreenExplosionFlash {
            0% {
              opacity: 1;
            }

            22% {
              opacity: 0.92;
            }

            100% {
              opacity: 0;
            }
          }

          @keyframes buddhaExplosionParticle1 {
            0% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) translateY(0) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) rotate(0deg) translateY(-230%) scale(0.3); }
          }

          @keyframes buddhaExplosionParticle2 {
            0% { opacity: 1; transform: translate(-50%, -50%) rotate(45deg) translateY(0) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) rotate(45deg) translateY(-230%) scale(0.3); }
          }

          @keyframes buddhaExplosionParticle3 {
            0% { opacity: 1; transform: translate(-50%, -50%) rotate(90deg) translateY(0) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) rotate(90deg) translateY(-230%) scale(0.3); }
          }

          @keyframes buddhaExplosionParticle4 {
            0% { opacity: 1; transform: translate(-50%, -50%) rotate(135deg) translateY(0) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) rotate(135deg) translateY(-230%) scale(0.3); }
          }

          @keyframes buddhaExplosionParticle5 {
            0% { opacity: 1; transform: translate(-50%, -50%) rotate(180deg) translateY(0) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) rotate(180deg) translateY(-230%) scale(0.3); }
          }

          @keyframes buddhaExplosionParticle6 {
            0% { opacity: 1; transform: translate(-50%, -50%) rotate(225deg) translateY(0) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) rotate(225deg) translateY(-230%) scale(0.3); }
          }

          @keyframes buddhaExplosionParticle7 {
            0% { opacity: 1; transform: translate(-50%, -50%) rotate(270deg) translateY(0) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) rotate(270deg) translateY(-230%) scale(0.3); }
          }

          @keyframes buddhaExplosionParticle8 {
            0% { opacity: 1; transform: translate(-50%, -50%) rotate(315deg) translateY(0) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) rotate(315deg) translateY(-230%) scale(0.3); }
          }

          @media (prefers-reduced-motion: reduce) {
            .buddha-bomb-countdown,
            .buddha-danger-screen,
            .buddha-final-warning-overlay,
            .buddha-screen-explosion-flash,
            .buddha-explosion-particle {
              animation-duration: 1ms !important;
              animation-iteration-count: 1 !important;
            }
          }
        `}</style>

        {hasFinalBuddhaBomb && (
          <div className="buddha-final-warning-overlay" />
        )}

        {buddhaExplosions.length > 0 && (
          <div className="buddha-screen-explosion-flash" />
        )}

        <div className="flex h-full w-full flex-col px-[clamp(12px,2.2vw,40px)] py-[clamp(10px,1.8vh,24px)]">
          <header className="flex h-[56px] shrink-0 items-center justify-between sm:h-[64px]">
            <h1 className="text-[clamp(24px,2.6vw,42px)] font-black tracking-[0.08em] text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.35)]">
              HOO 2048
            </h1>

            <button
              type="button"
              onClick={exitBuddhaFocusMode}
              className="flex items-center gap-2 rounded-full border border-white/25 bg-black px-4 py-2 text-sm font-black text-white transition hover:border-white/60 hover:bg-white/5 sm:gap-3 sm:px-6 sm:py-3 sm:text-base"
            >
              나가기

              <span className="text-xl font-light leading-none sm:text-2xl">
                ×
              </span>
            </button>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
            <div className="grid min-h-full w-full grid-cols-1 items-center justify-items-center gap-4 lg:h-full lg:grid-cols-[280px_minmax(0,1fr)_250px] lg:gap-[clamp(20px,2.4vw,40px)]">
              <aside className="hidden h-[min(calc(100dvh-116px),780px)] w-[280px] shrink-0 lg:block">
                <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-white/20 bg-[#080808]">
                  <div className="border-b border-white/10 px-5 py-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-400">
                          Buddha Ranking
                        </p>

                        <h2 className="mt-1 text-xl font-black text-white">
                          🧘 부처 랭킹
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          void loadBuddhaRanking();
                        }}
                        disabled={
                          isBuddhaRankingLoading
                        }
                       className="min-w-[88px] whitespace-nowrap rounded-full border border-white/15 px-4 py-1.5 text-xs font-black text-white/70 transition hover:border-violet-400 hover:text-white disabled:cursor-wait disabled:opacity-40"
                      >
                        새로고침
                      </button>
                    </div>

                    <p className="mt-3 text-xs font-semibold leading-relaxed text-white/45">
                      클리어가 아닌 개인 최고점으로
                      순위가 결정됩니다.
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                    {isBuddhaRankingLoading &&
                    buddhaRanking.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-sm font-bold text-white/45">
                        랭킹 불러오는 중...
                      </div>
                    ) : buddhaRankingError ? (
                      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                        <p className="text-sm font-bold text-red-300">
                          {buddhaRankingError}
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            void loadBuddhaRanking();
                          }}
                          className="mt-3 rounded-lg border border-white/20 px-3 py-2 text-xs font-black text-white"
                        >
                          다시 시도
                        </button>
                      </div>
                    ) : buddhaRanking.length ===
                      0 ? (
                      <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                        <span className="text-4xl">
                          🪷
                        </span>

                        <p className="mt-3 text-sm font-black text-white/70">
                          아직 기록이 없습니다.
                        </p>

                        <p className="mt-1 text-xs font-semibold leading-relaxed text-white/35">
                          첫 번째 부처모드 기록의
                          주인공이 되어보세요.
                        </p>
                      </div>
                    ) : (
                      <ol className="space-y-2">
                        {buddhaRanking.map(
                          (entry) => {
                            const isMe =
                              entry.userId ===
                              currentBuddhaUserId;

                            const rankBadge =
                              entry.rank === 1
                                ? "🥇"
                                : entry.rank === 2
                                  ? "🥈"
                                  : entry.rank === 3
                                    ? "🥉"
                                    : entry.rank;

                            return (
                              <li
                                key={entry.userId}
                                className={`rounded-2xl border px-3 py-3 transition ${
                                  isMe
                                    ? "border-violet-400/80 bg-violet-500/15 shadow-[0_0_20px_rgba(139,92,246,0.18)]"
                                    : "border-white/10 bg-white/[0.025]"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-sm font-black">
                                    {rankBadge}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-lg">
                                        {entry.avatarEmoji}
                                      </span>

                                      <p className="truncate text-sm font-black text-white">
                                        {entry.nickname}
                                      </p>

                                      {isMe && (
                                        <span className="rounded-full bg-violet-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                                          ME
                                        </span>
                                      )}
                                    </div>

                                    <p className="mt-1 text-right text-base font-black tabular-nums text-violet-300">
                                      {entry.bestScore.toLocaleString(
                                        "ko-KR",
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </li>
                            );
                          },
                        )}
                      </ol>
                    )}
                  </div>

                  <div className="border-t border-white/10 px-5 py-4">
                    <p className="text-xs font-black text-white/40">
                      내 최고점
                    </p>

                    <p className="mt-1 text-right text-2xl font-black tabular-nums text-white">
                      {displayedBuddhaBest.toLocaleString(
                        "ko-KR",
                      )}
                    </p>
                  </div>
                </div>
              </aside>

              <div className="relative mx-auto aspect-square h-[min(calc(100dvh-140px),calc(100dvw-32px),760px)] max-h-full max-w-full lg:h-[min(calc(100dvh-116px),calc(100dvw-590px),780px)]">
                <div
                  className="relative h-full w-full touch-none overflow-hidden rounded-[12px] border border-white/20 bg-[#080808] p-[clamp(5px,0.55vw,9px)] shadow-[0_0_55px_rgba(255,255,255,0.04)]"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchCancel}
                >
                  <div
                    className="absolute inset-[clamp(5px,0.55vw,9px)] grid gap-[clamp(4px,0.5vw,8px)]"
                    style={buddhaGridStyle}
                  >
                    {Array.from({
                      length:
                        buddhaBoardSize *
                        buddhaBoardSize,
                    }).map((_, index) => (
                      <div
                        key={`buddha-background-${index}`}
                        className="rounded-[clamp(6px,0.7vw,10px)] border border-white/10 bg-[#f8f8f8]"
                      />
                    ))}
                  </div>

                  <div
                    className="pointer-events-none absolute inset-[clamp(5px,0.55vw,9px)] grid gap-[clamp(4px,0.5vw,8px)]"
                    style={buddhaGridStyle}
                  >
                    {displayBoard.flatMap(
                      (row, rowIndex) =>
                        row.map(
                          (
                            value,
                            columnIndex,
                          ) => {
                            if (value === 0) {
                              return null;
                            }

                            const tileKey =
                              `${rowIndex}-${columnIndex}`;

                            const isMerged =
                              mergedTileKeys.includes(
                                tileKey,
                              );

                            return (
                              <div
                                key={tileKey}
                                className={`flex select-none items-center justify-center rounded-[clamp(6px,0.7vw,10px)] font-black transition-transform duration-150 ease-out ${getTileClass(
                                  value,
                                )} ${getTileTextSize(
                                  value,
                                  buddhaBoardSize,
                                )} ${
                                  isMerged
                                    ? "scale-110 ring-2 ring-white/70"
                                    : "scale-100"
                                }`}
                                style={{
                                  gridRowStart:
                                    rowIndex + 1,
                                  gridColumnStart:
                                    columnIndex + 1,
                                }}
                              >
                                {value ===
                                BLACK_HOLE_TILE ? (
                                  <span aria-label="블랙홀 타일">
                                    ◉
                                  </span>
                                ) : value ===
                                  WORM_HOLE_TILE ? (
                                  <span
                                    aria-label="웜홀 타일"
                                    className="animate-pulse"
                                  >
                                    ◎
                                  </span>
                                ) : (
                                  value
                                )}
                              </div>
                            );
                          },
                        ),
                    )}
                  </div>

                  <div
                    className="pointer-events-none absolute inset-[clamp(5px,0.55vw,9px)] grid gap-[clamp(4px,0.5vw,8px)]"
                    style={buddhaGridStyle}
                  >
                    {animatedTiles.map(
                      (tile) => (
                        <div
                          key={tile.id}
                          className={`z-10 flex select-none items-center justify-center rounded-[clamp(6px,0.7vw,10px)] font-black transition-[transform,opacity,filter] duration-150 ease-out ${getTileClass(
                            tile.value,
                          )} ${getTileTextSize(
                            tile.value,
                            buddhaBoardSize,
                          )}`}
                          style={{
                            gridRowStart:
                              tile.fromRow + 1,
                            gridColumnStart:
                              tile.fromColumn + 1,
                            transform:
                              getTileTransform(
                                tile,
                                animationStarted,
                              ),
                            opacity:
                              animationStarted &&
                              tile.absorbed
                                ? 0
                                : 1,
                            filter:
                              tile.absorbed
                                ? "blur(1.5px)"
                                : "none",
                            willChange:
                              "transform, opacity, filter",
                          }}
                        >
                          {tile.value}
                        </div>
                      ),
                    )}
                  </div>

                  <div
                    className="pointer-events-none absolute inset-[clamp(5px,0.55vw,9px)] grid gap-[clamp(4px,0.5vw,8px)]"
                    style={buddhaGridStyle}
                  >
                    {wormHoleOutputTiles.map(
                      (tile) => (
                        <div
                          key={tile.id}
                          className={`z-20 flex select-none items-center justify-center rounded-[clamp(6px,0.7vw,10px)] font-black transition-[transform,opacity,filter] ease-out ${getTileClass(
                            tile.value,
                          )} ${getTileTextSize(
                            tile.value,
                            buddhaBoardSize,
                          )}`}
                          style={{
                            gridRowStart:
                              tile.fromRow + 1,
                            gridColumnStart:
                              tile.fromColumn + 1,
                            transform:
                              getTileTransform(
                                tile,
                                wormHoleEmissionStarted,
                              ),
                            opacity:
                              wormHoleEmissionStarted &&
                              tile.absorbed
                                ? 0
                                : wormHoleEmissionStarted
                                  ? 1
                                  : 0.35,
                            transitionDuration:
                              `${WORM_HOLE_EMISSION_DURATION}ms`,
                            willChange:
                              "transform, opacity, filter",
                          }}
                        >
                          {tile.value}
                        </div>
                      ),
                    )}
                  </div>

                  <div
                    className="pointer-events-none absolute inset-[clamp(5px,0.55vw,9px)] grid gap-[clamp(4px,0.5vw,8px)]"
                    style={buddhaGridStyle}
                  >
                    {buddhaBombs.map((bomb) => {
                      const countdownClass =
                        bomb.remainingTurns <= 1
                          ? "buddha-bomb-final"
                          : bomb.remainingTurns <= 3
                            ? "buddha-bomb-critical"
                            : bomb.remainingTurns <= 5
                              ? "buddha-bomb-warning"
                              : bomb.remainingTurns <= 10
                                ? "buddha-bomb-danger"
                                : "";

                      return (
                        <div
                          key={bomb.id}
                          className="z-30 flex items-end justify-end p-[clamp(2px,0.35vw,5px)]"
                          style={{
                            gridRowStart:
                              bomb.row + 1,
                            gridColumnStart:
                              bomb.column + 1,
                          }}
                        >
                          <div
                            aria-label={`폭탄 남은 턴 ${bomb.remainingTurns}`}
                            className={`buddha-bomb-countdown flex min-w-[clamp(32px,4vw,48px)] items-center justify-center gap-0.5 rounded-full border bg-black/90 px-1.5 py-0.5 font-black tabular-nums ${
                              bomb.remainingTurns <= 3
                                ? "border-red-200 text-white"
                                : bomb.remainingTurns <= 10
                                  ? "border-red-300 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.95)]"
                                  : "border-red-400/70 text-white shadow-[0_0_16px_rgba(239,68,68,0.8)]"
                            } ${countdownClass}`}
                            style={{
                              fontSize:
                                "clamp(10px,1.3vw,14px)",
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className={
                                bomb.remainingTurns <=
                                3
                                  ? "text-[1.15em]"
                                  : ""
                              }
                            >
                              💣
                            </span>

                            <span>
                              {bomb.remainingTurns}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {buddhaExplosions.map(
                      (explosion) => (
                        <div
                          key={explosion.id}
                          className="relative z-50 flex items-center justify-center overflow-visible"
                          style={{
                            gridRowStart:
                              explosion.row + 1,
                            gridColumnStart:
                              explosion.column + 1,
                          }}
                        >
                          <div className="buddha-explosion-flash" />
                          <div className="buddha-explosion-ring" />
                          <div className="buddha-explosion-core" />

                          {Array.from({
                            length: 8,
                          }).map(
                            (_, particleIndex) => (
                              <span
                                key={`${explosion.id}-particle-${particleIndex}`}
                                aria-hidden="true"
                                className={`buddha-explosion-particle buddha-explosion-particle-${
                                  particleIndex + 1
                                }`}
                              />
                            ),
                          )}

                          <span
                            aria-hidden="true"
                            className="buddha-explosion-emoji"
                          >
                            💥
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {isWon && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[12px] bg-black/90">
                    <h2 className="text-3xl font-black tracking-[0.12em] sm:text-4xl">
                      YOU WIN
                    </h2>

                    <p className="mt-4 font-bold text-white/65">
                      {targetTile.toLocaleString(
                        "ko-KR",
                      )}
                      을 완성했습니다.
                    </p>

                    <div className="mt-7 flex gap-3">
                      <button
                        type="button"
                        onClick={continueGame}
                        className="rounded-xl bg-white px-5 py-3 font-black text-black sm:px-6"
                      >
                        계속 플레이
                      </button>

                      <button
                        type="button"
                        onClick={returnToGameSelection}
                        className="rounded-xl border border-white/30 bg-black px-5 py-3 font-black text-white sm:px-6"
                      >
                        다시 시작
                      </button>
                    </div>
                  </div>
                )}

                {isGameOver && !isWon && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[12px] bg-black/90">
                    <h2 className="text-3xl font-black tracking-[0.12em] sm:text-4xl">
                      GAME OVER
                    </h2>

                    <p className="mt-4 font-bold text-white/65">
                      최종 점수{" "}
                      {score.toLocaleString(
                        "ko-KR",
                      )}
                    </p>

                    <button
                      type="button"
                      onClick={returnToGameSelection}
                      className="mt-7 rounded-xl bg-white px-7 py-3 font-black text-black"
                    >
                      다시 시작
                    </button>
                  </div>
                )}
              </div>

              <aside className="hidden w-[250px] shrink-0 lg:block">
                <div className="overflow-hidden rounded-[24px] border border-white/20 bg-[#080808] px-6 py-6">
                  <div>
                    <p className="text-base font-black text-violet-400">
                      난이도
                    </p>

                    <div className="mt-4 rounded-2xl border border-violet-500/70 bg-gradient-to-r from-violet-950 to-violet-800 px-4 py-4">
                      <p className="text-base font-black text-white">
                        🧘 부처 모드 (5×5)
                      </p>
                    </div>
                  </div>

                  <div className="my-6 h-px bg-white/10" />

                  <div>
                    <p className="text-base font-black text-violet-400">
                      이동 횟수
                    </p>

                    <p className="mt-3 text-center text-3xl font-black tabular-nums">
                      {moveCount.toLocaleString(
                        "ko-KR",
                      )}
                    </p>
                  </div>

                  <div className="my-6 h-px bg-white/10" />

                  <div>
                    <p className="text-base font-black text-violet-400">
                      현재 점수
                    </p>

                    <p className="mt-3 text-center text-3xl font-black tabular-nums">
                      {score.toLocaleString(
                        "ko-KR",
                      )}
                    </p>
                  </div>

                  <div className="my-6 h-px bg-white/10" />

                  <div>
                    <p className="text-base font-black text-violet-400">
                      최고 점수
                    </p>

                    <p className="mt-3 text-center text-3xl font-black tabular-nums">
                      {displayedBuddhaBest.toLocaleString(
                        "ko-KR",
                      )}
                    </p>
                  </div>
                </div>
              </aside>

              <aside className="grid w-full max-w-[760px] grid-cols-4 gap-2 lg:hidden">
                <div className="rounded-xl border border-white/15 bg-[#080808] px-3 py-3 text-center">
                  <p className="text-[10px] font-black text-violet-400">
                    난이도
                  </p>

                  <p className="mt-1 text-xs font-black">
                    부처 5×5
                  </p>
                </div>

                <div className="rounded-xl border border-white/15 bg-[#080808] px-3 py-3 text-center">
                  <p className="text-[10px] font-black text-violet-400">
                    이동
                  </p>

                  <p className="mt-1 text-sm font-black tabular-nums">
                    {moveCount.toLocaleString(
                      "ko-KR",
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-white/15 bg-[#080808] px-3 py-3 text-center">
                  <p className="text-[10px] font-black text-violet-400">
                    점수
                  </p>

                  <p className="mt-1 text-sm font-black tabular-nums">
                    {score.toLocaleString(
                      "ko-KR",
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-white/15 bg-[#080808] px-3 py-3 text-center">
                  <p className="text-[10px] font-black text-violet-400">
                    최고
                  </p>

                  <p className="mt-1 text-sm font-black tabular-nums">
                    {Math.max(
                      score,
                      bestScore,
                    ).toLocaleString("ko-KR")}
                  </p>
                </div>
              </aside>

              <aside className="w-full max-w-[760px] rounded-2xl border border-white/15 bg-[#080808] p-3 lg:hidden">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-white">
                    🧘 부처 랭킹 TOP 10
                  </h2>

                  <button
                    type="button"
                    onClick={() => {
                      void loadBuddhaRanking();
                    }}
                    className="text-xs font-black text-violet-300"
                  >
                    새로고침
                  </button>
                </div>

                <div className="mt-3 max-h-40 overflow-y-auto">
                  {buddhaRanking.length ===
                  0 ? (
                    <p className="py-5 text-center text-xs font-bold text-white/40">
                      아직 등록된 기록이 없습니다.
                    </p>
                  ) : (
                    <ol className="space-y-1.5">
                      {buddhaRanking.map(
                        (entry) => (
                          <li
                            key={`mobile-${entry.userId}`}
                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${
                              entry.userId ===
                              currentBuddhaUserId
                                ? "bg-violet-500/20"
                                : "bg-white/[0.035]"
                            }`}
                          >
                            <span className="w-6 font-black text-violet-300">
                              {entry.rank}
                            </span>

                            <span>
                              {entry.avatarEmoji}
                            </span>

                            <span className="min-w-0 flex-1 truncate font-black">
                              {entry.nickname}
                            </span>

                            <span className="font-black tabular-nums">
                              {entry.bestScore.toLocaleString(
                                "ko-KR",
                              )}
                            </span>
                          </li>
                        ),
                      )}
                    </ol>
                  )}
                </div>
              </aside>
            </div>
          </main>
        </div>
      </div>,
      document.body,
    );
  }

  if (
    difficulty === "buddha" &&
    isBuddhaFocusMode
  ) {
    return renderBuddhaGameLayout();
  }

  return (
    <section
      className={
        difficulty === "buddha" &&
        isBuddhaFocusMode
          ? "fixed inset-0 z-[9999] flex min-h-screen items-center justify-center overflow-hidden bg-black p-3 text-white sm:p-6"
          : "mx-auto w-full max-w-xl"
      }
    >
      {difficulty === "buddha" &&
        isEnteringBuddhaMode && (
          <div className="buddha-entry-overlay fixed inset-0 z-[10020] flex items-center justify-center bg-black">
            <p className="buddha-good-luck text-2xl font-black tracking-[0.5em] text-white sm:text-4xl">
              GOOD LUCK.
            </p>
          </div>
        )}

      <style jsx>{`
        .buddha-entry-overlay {
          animation: buddhaOverlayFade 900ms ease-in-out forwards;
        }

        .buddha-good-luck {
          animation: buddhaGoodLuck 900ms ease-in-out forwards;
        }

        @keyframes buddhaOverlayFade {
          0% { opacity: 0; }
          20% { opacity: 1; }
          75% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes buddhaGoodLuck {
          0% {
            opacity: 0;
            transform: scale(0.88);
            letter-spacing: 0.2em;
          }
          30% {
            opacity: 1;
            transform: scale(1);
            letter-spacing: 0.5em;
          }
          70% {
            opacity: 1;
            transform: scale(1);
            letter-spacing: 0.5em;
          }
          100% {
            opacity: 0;
            transform: scale(1.08);
            letter-spacing: 0.7em;
          }
        }
      `}</style>

      {difficulty === "buddha" &&
        isBuddhaFocusMode && (
          <div className="fixed right-4 top-4 z-[10030] flex items-center gap-2">
            <span className="hidden text-xs font-semibold text-white/50 sm:inline">
              ESC
            </span>

            <button
              type="button"
              onClick={exitBuddhaFocusMode}
              aria-label="부처모드 닫기"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-xl font-light text-white/80 backdrop-blur-md transition hover:scale-105 hover:border-white/60 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

      {difficulty === "buddha" &&
      !autoStartBuddha &&
      !isBuddhaFocusMode ? (
        <div className="rounded-[30px] border border-white/10 bg-black p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.48)] sm:p-8">
          <div className="rounded-[22px] border border-red-700/70 bg-red-950/30 px-5 py-5 text-center shadow-[0_0_28px_rgba(220,38,38,0.12)]">
            <p className="text-base font-black leading-8 text-red-50 sm:text-lg">
              이 모드는 절대 못 깹니다.
              <br />
              도전하시겠습니까?
            </p>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-[18px] bg-white text-[44px] leading-none text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)]">
              ☯
            </div>

            <div className="min-w-0 text-left">
              <p className="text-xs font-black tracking-[0.22em] text-white/40">
                NUMBER MERGE
              </p>

              <h2 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
                HOO 2048
              </h2>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-4 gap-2">
            {(["쉬움", "보통", "어려움"] as const).map(
              (label) => (
                <div
                  key={label}
                  className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-black text-white/35 sm:text-base"
                >
                  {label}
                </div>
              ),
            )}

            <div className="flex h-12 items-center justify-center rounded-2xl bg-white text-sm font-black text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] sm:text-base">
              부처
            </div>
          </div>

          <div className="mt-7 rounded-[22px] border border-white/10 bg-white/[0.055] px-5 py-5">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-white/45">
                최고점수
              </span>

              <strong className="text-2xl font-black tracking-wide text-white">
                {Math.max(
                  score,
                  bestScore,
                ).toLocaleString("ko-KR")}
              </strong>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="text-base font-bold text-white/45">
                타임어택
              </span>

              <strong className="text-lg font-black text-red-400">
                제한 없음
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={enterBuddhaFocusMode}
            disabled={isEnteringBuddhaMode}
            className="mt-7 w-full rounded-[20px] border border-orange-300/70 bg-[#ff7a1a] px-5 py-5 text-base font-black text-white shadow-[0_10px_30px_rgba(255,122,26,0.38)] transition-all duration-200 hover:scale-[1.015] hover:bg-[#ff8a33] hover:shadow-[0_14px_36px_rgba(255,122,26,0.5)] active:scale-[0.985] active:bg-[#ed6d0d] disabled:cursor-wait disabled:opacity-60 sm:text-lg"
          >
            깰 게임이면 안 왔다. 도전!
          </button>
        </div>
      ) : (
      <>
      <div
        className={
          difficulty === "buddha" &&
          isBuddhaFocusMode
            ? "hidden"
            : "mb-4 text-center"
        }
      >
        <h2 className="text-2xl font-bold">
          HOO 2048
        </h2>

        {difficulty === "buddha" ? (
          <p className="mt-1 text-sm text-[#8b849d]">
            클리어 대신 최고점수로 경쟁하는
            생존 랭킹 모드입니다.
          </p>
        ) : (
          <p className="mt-1 text-sm text-[#8b849d]">
            {targetTile.toLocaleString(
              "ko-KR",
            )}
            을 완성하면 종합 점수{" "}
            {awardedScore.toLocaleString(
              "ko-KR",
            )}
            점을 획득합니다.
          </p>
        )}

        {difficulty === "buddha" && (
          <p className="mt-1 text-xs font-semibold text-[#8f86a8]">
            5×5 생존 랭킹 · 최고점수 기록 ·
            종합점수 미지급 · ESC 종료
          </p>
        )}

        {difficulty === "normal" && (
          <p className="mt-1 text-xs font-semibold text-[#9b6b52]">
          
          </p>
        )}

        <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-3 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#332f45]">
          <span>
            난이도: {difficultyLabel}
          </span>

          <span className="text-[#c8c1d8]">
            |
          </span>

          <span>
            보드: {boardSize}×{boardSize}
          </span>

          <span className="text-[#c8c1d8]">
            |
          </span>

          <span>
            이동:{" "}
            {moveCount.toLocaleString(
              "ko-KR",
            )}
          </span>

          <span className="text-[#c8c1d8]">
            |
          </span>

          <span>
            점수:{" "}
            {score.toLocaleString(
              "ko-KR",
            )}
          </span>

          <span className="text-[#c8c1d8]">
            |
          </span>

          <span>
            최고:{" "}
            {Math.max(
              score,
              bestScore,
            ).toLocaleString("ko-KR")}

            {score > bestScore && (
              <span className="ml-2 rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-black text-[#332f45]">
                NEW
              </span>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={returnToGameSelection}
          className="mt-3 rounded-xl bg-[#5f4b8b] px-4 py-2 text-sm font-bold text-white transition hover:scale-105"
        >
          다시 시작
        </button>
      </div>

      <div
        className={
          difficulty === "buddha" &&
          isBuddhaFocusMode
            ? "relative w-[min(92vw,82vh)]"
            : "relative"
        }
      >
        <div
          className={`relative aspect-square touch-none overflow-hidden rounded-2xl ${
            difficulty === "buddha"
              ? "bg-[#18151f] shadow-[0_0_70px_rgba(139,92,246,0.2)]"
              : "bg-[#d9d3e8]"
          } ${
            boardSize >= 5
              ? "p-2"
              : "p-3"
          }`}
          onTouchStart={
            handleTouchStart
          }
          onTouchEnd={
            handleTouchEnd
          }
          onTouchCancel={
            handleTouchCancel
          }
        >
          <div
            className={`absolute grid ${
              boardSize >= 5
                ? "inset-2 gap-1.5"
                : "inset-3 gap-2"
            }`}
            style={gridStyle}
          >
            {Array.from({
              length:
                boardSize * boardSize,
            }).map((_, index) => (
              <div
                key={`background-${index}`}
                className={
                  boardSize >= 5
                    ? "rounded-lg bg-white"
                    : "rounded-xl bg-white"
                }
              />
            ))}
          </div>

          <div
            className={`pointer-events-none absolute grid ${
              boardSize >= 5
                ? "inset-2 gap-1.5"
                : "inset-3 gap-2"
            }`}
            style={gridStyle}
          >
            {displayBoard.flatMap(
              (row, rowIndex) =>
                row.map(
                  (
                    value,
                    columnIndex,
                  ) => {
                    if (value === 0) {
                      return null;
                    }

                    const tileKey =
                      `${rowIndex}-${columnIndex}`;

                    const isMerged =
                      mergedTileKeys.includes(
                        tileKey,
                      );

                    return (
                      <div
                        key={tileKey}
                        className={`flex select-none items-center justify-center ${
                          boardSize >= 5
                            ? "rounded-lg"
                            : "rounded-xl"
                        } font-black transition-transform duration-150 ease-out ${getTileClass(
                          value,
                        )} ${getTileTextSize(
                          value,
                          boardSize,
                        )} ${
                          isMerged
                            ? "scale-125 ring-4 ring-yellow-300/70"
                            : "scale-100"
                        }`}
                        style={{
                          gridRowStart:
                            rowIndex + 1,
                          gridColumnStart:
                            columnIndex + 1,
                        }}
                      >
                        {value ===
                        BLACK_HOLE_TILE ? (
                          <span
                            aria-label="블랙홀 타일"
                          >
                            ◉
                          </span>
                        ) : value ===
                          WORM_HOLE_TILE ? (
                          <span
                            aria-label="웜홀 타일"
                            className="animate-pulse"
                          >
                            ◎
                          </span>
                        ) : (
                          value
                        )}
                      </div>
                    );
                  },
                ),
            )}
          </div>

          {difficulty === "buddha" && (
            <div
              className={`pointer-events-none absolute grid ${
                boardSize >= 5
                  ? "inset-2 gap-1.5"
                  : "inset-3 gap-2"
              }`}
              style={gridStyle}
            >
              {buddhaBombs.map((bomb) => (
                <div
                  key={bomb.id}
                  className="z-30 flex items-end justify-end p-1"
                  style={{
                    gridRowStart: bomb.row + 1,
                    gridColumnStart:
                      bomb.column + 1,
                  }}
                >
                  <div
                    aria-label={`폭탄 남은 턴 ${bomb.remainingTurns}`}
                    className={`flex min-w-[34px] items-center justify-center gap-0.5 rounded-full border border-red-300/70 bg-black/85 px-1.5 py-0.5 font-black shadow-[0_0_14px_rgba(239,68,68,0.75)] ${
                      bomb.remainingTurns <= 10
                        ? "animate-pulse text-red-300"
                        : "text-white"
                    }`}
                    style={{
                      fontSize:
                        boardSize >= 5
                          ? "10px"
                          : "12px",
                    }}
                  >
                    <span aria-hidden="true">
                      💣
                    </span>
                    <span>
                      {bomb.remainingTurns}
                    </span>
                  </div>
                </div>
              ))}

              {buddhaExplosions.map(
                (explosion) => (
                  <div
                    key={explosion.id}
                    className="z-40 flex items-center justify-center overflow-visible"
                    style={{
                      gridRowStart:
                        explosion.row + 1,
                      gridColumnStart:
                        explosion.column + 1,
                    }}
                  >
                    <div className="h-[280%] w-[280%] animate-ping rounded-full bg-red-500/60 shadow-[0_0_55px_rgba(239,68,68,1)]" />
                    <div className="absolute text-3xl drop-shadow-[0_0_14px_rgba(255,255,255,1)]">
                      💥
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          <div
            className={`pointer-events-none absolute grid ${
              boardSize >= 5
                ? "inset-2 gap-1.5"
                : "inset-3 gap-2"
            }`}
            style={gridStyle}
          >
            {animatedTiles.map(
              (tile) => (
                <div
                  key={tile.id}
                  className={`z-10 flex select-none items-center justify-center ${
                    boardSize >= 5
                      ? "rounded-lg"
                      : "rounded-xl"
                  } font-black transition-[transform,opacity,filter] duration-150 ease-out ${getTileClass(
                    tile.value,
                  )} ${getTileTextSize(
                    tile.value,
                    boardSize,
                  )}`}
                  style={{
                    gridRowStart:
                      tile.fromRow + 1,
                    gridColumnStart:
                      tile.fromColumn + 1,
                    transform:
                      getTileTransform(
                        tile,
                        animationStarted,
                      ),
                    opacity:
                      animationStarted &&
                      tile.absorbed
                        ? 0
                        : 1,
                    filter:
                      tile.absorbed
                        ? "blur(1.5px)"
                        : "none",
                    willChange:
                      "transform, opacity, filter",
                  }}
                >
                  {tile.value}
                </div>
              ),
            )}
          </div>

          <div
            className={`pointer-events-none absolute grid ${
              boardSize >= 5
                ? "inset-2 gap-1.5"
                : "inset-3 gap-2"
            }`}
            style={gridStyle}
          >
            {wormHoleOutputTiles.map(
              (tile) => (
                <div
                  key={tile.id}
                  className={`z-20 flex select-none items-center justify-center ${
                    boardSize >= 5
                      ? "rounded-lg"
                      : "rounded-xl"
                  } font-black transition-[transform,opacity,filter] ease-out ${getTileClass(
                    tile.value,
                  )} ${getTileTextSize(
                    tile.value,
                    boardSize,
                  )}`}

                  style={{
                    gridRowStart:
                      tile.fromRow + 1,
                    gridColumnStart:
                      tile.fromColumn + 1,
                    transform:
                      getTileTransform(
                        tile,
                        wormHoleEmissionStarted,
                      ),
                    opacity:
                      wormHoleEmissionStarted &&
                      tile.absorbed
                        ? 0
                        : wormHoleEmissionStarted
                          ? 1
                          : 0.35,
                    filter:
                      wormHoleEmissionStarted
                        ? tile.absorbed
                          ? "blur(2px) drop-shadow(0 0 16px rgba(139,92,246,1))"
                          : mergedTileKeys.includes(
                                `${tile.toRow}-${tile.toColumn}`,
                              )
                            ? "drop-shadow(0 0 14px rgba(250,204,21,1))"
                            : "drop-shadow(0 0 8px rgba(168,85,247,0.9))"
                        : "blur(2px)",
                    transitionDuration:
                      `${WORM_HOLE_EMISSION_DURATION}ms`,
                    willChange:
                      "transform, opacity, filter",
                  }}
                >
                  
                  {tile.value}
                </div>
              ),
            )}
          </div>
        </div>

        {isWon && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-[#5f4b8b]/90">
            <h3 className="text-3xl font-black text-white">
              YOU WIN!
            </h3>

            <p className="mt-2 text-sm font-semibold text-white/90">
              {targetTile.toLocaleString(
                "ko-KR",
              )}
              을 완성했습니다.
            </p>

            <p className="mt-1 text-sm font-semibold text-white/90">
              난이도: {difficultyLabel}
            </p>

            <p className="mt-1 text-sm font-semibold text-white/90">
              보드: {boardSize}×{boardSize}
            </p>

            <p className="mt-1 text-sm font-bold text-white">
              최종 점수:{" "}
              {score.toLocaleString(
                "ko-KR",
              )}
            </p>

            <p className="mt-1 text-sm font-bold text-white">
              최고 기록:{" "}
              {Math.max(
                score,
                bestScore,
              ).toLocaleString("ko-KR")}
            </p>

            <p className="mt-1 text-sm font-bold text-white">
              종합 점수{" "}
              {awardedScore.toLocaleString(
                "ko-KR",
              )}
              점 획득
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={continueGame}
                className="rounded-xl bg-white px-5 py-3 font-bold text-[#332f45] transition hover:scale-105"
              >
                계속 플레이
              </button>

              <button
                type="button"
                onClick={returnToGameSelection}
                className="rounded-xl bg-[#332f45] px-5 py-3 font-bold text-white transition hover:scale-105"
              >
                다시 시작
              </button>
            </div>
          </div>
        )}

        {isGameOver && !isWon && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-black/70">
            <h3 className="text-3xl font-black text-white">
              GAME OVER
            </h3>

            <p className="mt-2 text-sm font-semibold text-white/80">
              난이도: {difficultyLabel}
            </p>

            <p className="mt-2 text-sm font-semibold text-white/80">
              보드: {boardSize}×{boardSize}
            </p>

            <p className="mt-2 text-sm font-semibold text-white/80">
              최종 점수:{" "}
              {score.toLocaleString(
                "ko-KR",
              )}
            </p>

            <p className="mt-2 text-sm font-semibold text-white/80">
              최고 기록:{" "}
              {Math.max(
                score,
                bestScore,
              ).toLocaleString("ko-KR")}
            </p>

            <button
              type="button"
              onClick={returnToGameSelection}
              className="mt-5 rounded-xl bg-white px-6 py-3 font-bold text-[#332f45] transition hover:scale-105"
            >
              다시 시작
            </button>
          </div>
        )}
      </div>
      </>
      )}
    </section>
  );
}
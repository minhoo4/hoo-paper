"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Point = { row: number; column: number };
type Tile = { id: string; symbol: string } | null;

type HooShisenGameProps = {
  onExit: () => void;
};

const TILE_SYMBOLS = [
  "🌙", "⭐", "☀️", "☁️", "🌈", "⚡", "❄️", "🔥",
  "🍎", "🍋", "🍇", "🍒", "🥝", "🍑", "🍉", "🍊",
  "🐶", "🐱", "🐰", "🦊", "🐼", "🐯", "🐸", "🐵",
  "🌸", "🌻", "🌹", "🌷", "🍀", "🌵", "🌴", "🍁",
  "⚽", "🏀", "🎾", "🎱", "🎲", "🎯", "🎮", "🧩",
  "🚗", "🚕", "🚀", "✈️", "🚲", "⛵", "🚂", "🛸",
  "🎵", "🎸", "🎹", "🎺", "🔔", "💎", "🔑", "👑",
  "🧁", "🍩", "🍪", "🍫", "🍭", "🍰", "🥨", "🍿",
];

const TILE_PALETTES = [
  "border-[#ffd166] bg-gradient-to-br from-[#fff4b8] to-[#ffc857]",
  "border-[#72ddf7] bg-gradient-to-br from-[#dff8ff] to-[#68d8f0]",
  "border-[#ff8fab] bg-gradient-to-br from-[#ffe2eb] to-[#ff8fab]",
  "border-[#a7f3a0] bg-gradient-to-br from-[#e7ffe4] to-[#8ee38a]",
  "border-[#c4a7ff] bg-gradient-to-br from-[#eee5ff] to-[#b99af4]",
  "border-[#ffad66] bg-gradient-to-br from-[#ffead8] to-[#ff9f59]",
  "border-[#7de2d1] bg-gradient-to-br from-[#dcfff8] to-[#68d5c2]",
  "border-[#f5a3ff] bg-gradient-to-br from-[#fde5ff] to-[#e995f3]",
];

function getTilePalette(symbol: string) {
  const symbolIndex = TILE_SYMBOLS.indexOf(symbol);
  return TILE_PALETTES[
    Math.max(0, symbolIndex) % TILE_PALETTES.length
  ];
}

const STAGE_GROUPS = [
  { from: 1, to: 10, rows: 4, columns: 4, minTiles: 8, maxTiles: 16 },
  { from: 11, to: 25, rows: 4, columns: 6, minTiles: 18, maxTiles: 24 },
  { from: 26, to: 40, rows: 6, columns: 6, minTiles: 26, maxTiles: 36 },
  { from: 41, to: 60, rows: 6, columns: 8, minTiles: 38, maxTiles: 48 },
  { from: 61, to: 80, rows: 8, columns: 8, minTiles: 50, maxTiles: 64 },
  { from: 81, to: 99, rows: 8, columns: 10, minTiles: 66, maxTiles: 80 },
  { from: 100, to: 100, rows: 10, columns: 10, minTiles: 100, maxTiles: 100 },
];

function getStageSize(stage: number) {
  const group =
    STAGE_GROUPS.find(
      (group) => stage >= group.from && stage <= group.to,
    ) ?? STAGE_GROUPS[0]!;
  const stageSpan = Math.max(1, group.to - group.from);
  const stageProgress = (stage - group.from) / stageSpan;
  const interpolatedTiles =
    group.minTiles +
    (group.maxTiles - group.minTiles) * stageProgress;
  const tileCount = Math.min(
    group.rows * group.columns,
    Math.max(group.minTiles, Math.round(interpolatedTiles / 2) * 2),
  );

  return { ...group, tileCount };
}

function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }

  return result;
}

function createStageBoard(stage: number): Tile[][] {
  const { rows, columns, tileCount } = getStageSize(stage);
  const pairCount = tileCount / 2;
  const tiles: NonNullable<Tile>[] = [];

  for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
    const symbol = TILE_SYMBOLS[pairIndex % TILE_SYMBOLS.length];
    tiles.push(
      { id: `${stage}-${pairIndex}-a-${Math.random()}`, symbol },
      { id: `${stage}-${pairIndex}-b-${Math.random()}`, symbol },
    );
  }

  let fallbackBoard: Tile[][] = [];

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const shuffledCells = shuffleArray<Tile>([
      ...tiles,
      ...Array.from(
        { length: rows * columns - tileCount },
        () => null,
      ),
    ]);
    const board: Tile[][] = Array.from({ length: rows }, () =>
      Array.from({ length: columns }, () => null),
    );

    let tileIndex = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        board[row][column] = shuffledCells[tileIndex] ?? null;
        tileIndex += 1;
      }
    }

    fallbackBoard = board;

    if (findAvailablePair(board)) {
      return board;
    }
  }

  return fallbackBoard;
}

function findConnectionPath(
  board: Tile[][],
  start: Point,
  end: Point,
): Point[] | null {
  if (start.row === end.row && start.column === end.column) return null;

  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  const paddedRows = rows + 2;
  const paddedColumns = columns + 2;
  const startPoint = { row: start.row + 1, column: start.column + 1 };
  const endPoint = { row: end.row + 1, column: end.column + 1 };
  const directions = [
    { row: -1, column: 0 },
    { row: 1, column: 0 },
    { row: 0, column: -1 },
    { row: 0, column: 1 },
  ];
  const queue: Array<
    Point & {
      direction: number;
      turns: number;
      path: Point[];
    }
  > = [];
  const visited = new Map<string, number>();

  directions.forEach((direction, directionIndex) => {
    const next = {
      row: startPoint.row + direction.row,
      column: startPoint.column + direction.column,
    };

    if (next.row < 0 || next.row >= paddedRows || next.column < 0 || next.column >= paddedColumns) return;
    const isEnd = next.row === endPoint.row && next.column === endPoint.column;
    const occupied =
      next.row > 0 && next.row <= rows && next.column > 0 && next.column <= columns
        ? board[next.row - 1][next.column - 1] !== null
        : false;

    if (!occupied || isEnd) {
      queue.push({
        ...next,
        direction: directionIndex,
        turns: 0,
        path: [next],
      });
    }
  });

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.row === endPoint.row && current.column === endPoint.column) {
      const fullPath = [startPoint, ...current.path];
      const turningPoints = fullPath.filter((point, index) => {
        if (index === 0 || index === fullPath.length - 1) return true;

        const previous = fullPath[index - 1];
        const next = fullPath[index + 1];
        const previousDirection = {
          row: point.row - previous.row,
          column: point.column - previous.column,
        };
        const nextDirection = {
          row: next.row - point.row,
          column: next.column - point.column,
        };

        return (
          previousDirection.row !== nextDirection.row ||
          previousDirection.column !== nextDirection.column
        );
      });

      return turningPoints.map((point) => ({
        row: point.row - 1,
        column: point.column - 1,
      }));
    }

    const key = `${current.row}:${current.column}:${current.direction}`;
    const bestTurns = visited.get(key);
    if (bestTurns !== undefined && bestTurns <= current.turns) continue;
    visited.set(key, current.turns);

    directions.forEach((direction, directionIndex) => {
      const turns = current.turns + (directionIndex === current.direction ? 0 : 1);
      if (turns > 2) return;

      const nextRow = current.row + direction.row;
      const nextColumn = current.column + direction.column;
      if (nextRow < 0 || nextRow >= paddedRows || nextColumn < 0 || nextColumn >= paddedColumns) return;

      const isEnd = nextRow === endPoint.row && nextColumn === endPoint.column;
      const occupied =
        nextRow > 0 && nextRow <= rows && nextColumn > 0 && nextColumn <= columns
          ? board[nextRow - 1][nextColumn - 1] !== null
          : false;

      if (!occupied || isEnd) {
        queue.push({
          row: nextRow,
          column: nextColumn,
          direction: directionIndex,
          turns,
          path: [
            ...current.path,
            { row: nextRow, column: nextColumn },
          ],
        });
      }
    });
  }

  return null;
}

function canConnect(board: Tile[][], start: Point, end: Point): boolean {
  return findConnectionPath(board, start, end) !== null;
}

function findAvailablePair(board: Tile[][]): [Point, Point] | null {
  const grouped = new Map<string, Point[]>();

  board.forEach((row, rowIndex) => {
    row.forEach((tile, columnIndex) => {
      if (!tile) return;
      grouped.set(tile.symbol, [
        ...(grouped.get(tile.symbol) ?? []),
        { row: rowIndex, column: columnIndex },
      ]);
    });
  });

  for (const positions of grouped.values()) {
    for (let first = 0; first < positions.length; first += 1) {
      for (let second = first + 1; second < positions.length; second += 1) {
        if (canConnect(board, positions[first], positions[second])) {
          return [positions[first], positions[second]];
        }
      }
    }
  }

  return null;
}

function forcePlayableBoard(board: Tile[][]): Tile[][] {
  const occupiedPoints: Point[] = [];
  const tiles = board.flat().filter((tile): tile is NonNullable<Tile> => Boolean(tile));

  board.forEach((row, rowIndex) => {
    row.forEach((tile, columnIndex) => {
      if (tile) occupiedPoints.push({ row: rowIndex, column: columnIndex });
    });
  });

  if (tiles.length < 2 || occupiedPoints.length < 2) return board;

  let targetPair: [Point, Point] | null = null;
  for (let first = 0; first < occupiedPoints.length && !targetPair; first += 1) {
    for (let second = first + 1; second < occupiedPoints.length; second += 1) {
      if (canConnect(board, occupiedPoints[first], occupiedPoints[second])) {
        targetPair = [occupiedPoints[first], occupiedPoints[second]];
        break;
      }
    }
  }

  if (!targetPair) return board;

  const symbolGroups = new Map<string, NonNullable<Tile>[]>();
  tiles.forEach((tile) => {
    symbolGroups.set(tile.symbol, [...(symbolGroups.get(tile.symbol) ?? []), tile]);
  });
  const guaranteedTiles = [...symbolGroups.values()].find((group) => group.length >= 2);
  if (!guaranteedTiles) return board;

  const guaranteedIds = new Set([guaranteedTiles[0].id, guaranteedTiles[1].id]);
  const remainingTiles = shuffleArray(tiles.filter((tile) => !guaranteedIds.has(tile.id)));
  const [firstTarget, secondTarget] = targetPair;
  let remainingIndex = 0;

  return board.map((row, rowIndex) =>
    row.map((tile, columnIndex) => {
      if (!tile) return null;
      if (rowIndex === firstTarget.row && columnIndex === firstTarget.column) return guaranteedTiles[0];
      if (rowIndex === secondTarget.row && columnIndex === secondTarget.column) return guaranteedTiles[1];
      const nextTile = remainingTiles[remainingIndex] ?? null;
      remainingIndex += 1;
      return nextTile;
    }),
  );
}

function shuffleRemainingTiles(board: Tile[][]): Tile[][] {
  const source = board.flat().filter((tile): tile is NonNullable<Tile> => Boolean(tile));
  let fallback = board;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const remaining = shuffleArray(source);
    let index = 0;
    const candidate = board.map((row) =>
      row.map((tile) => {
        if (!tile) return null;
        const nextTile = remaining[index] ?? null;
        index += 1;
        return nextTile;
      }),
    );

    fallback = candidate;
    if (findAvailablePair(candidate)) return candidate;
  }

  return findAvailablePair(fallback) ? fallback : forcePlayableBoard(fallback);
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

const BREAK_STYLES = [
  { id: "cyber", name: "사이버펑크", icon: "⚡", motif: "◆" },
  { id: "steam", name: "스팀펑크", icon: "⚙️", motif: "⚙" },
  { id: "heaven", name: "천국", icon: "✨", motif: "✦" },
  { id: "hell", name: "지옥", icon: "🔥", motif: "🔥" },
  { id: "ocean", name: "바다", icon: "🌊", motif: "●" },
  { id: "typhoon", name: "태풍", icon: "🌀", motif: "◌" },
  { id: "dream", name: "꿈", icon: "🌙", motif: "★" },
  { id: "glass", name: "유리 파편", icon: "💎", motif: "◇" },
  { id: "leaf", name: "풀잎", icon: "🍃", motif: "🍃" },
  { id: "wind", name: "바람", icon: "💨", motif: "≋" },
] as const;

type BreakStyle = (typeof BREAK_STYLES)[number];
type EffectVariant = 0 | 1 | 2;

function getRandomBreakStyle(previousId?: BreakStyle["id"]): BreakStyle {
  const candidates = previousId
    ? BREAK_STYLES.filter((style) => style.id !== previousId)
    : BREAK_STYLES;

  return (
    candidates[Math.floor(Math.random() * candidates.length)] ??
    BREAK_STYLES[0]
  );
}

function getNextEffectVariant(current: EffectVariant): EffectVariant {
  const offset = Math.random() < 0.5 ? 1 : 2;
  return ((current + offset) % 3) as EffectVariant;
}

export default function HooShisenGame({ onExit }: HooShisenGameProps) {
  const effectSequenceRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const [stage, setStage] = useState(1);
  const [unlockedStage, setUnlockedStage] = useState(1);
  const [board, setBoard] = useState<Tile[][]>(() => createStageBoard(1));
  const [selected, setSelected] = useState<Point | null>(null);
  const [hintPair, setHintPair] = useState<[Point, Point] | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [moves, setMoves] = useState(0);
  const [shuffles, setShuffles] = useState(3);
  const [hints, setHints] = useState(3);
  const [isStageClear, setIsStageClear] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [revealedTileIds, setRevealedTileIds] =
    useState<Set<string>>(() => new Set());
  const [isResolvingPair, setIsResolvingPair] =
    useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewCountdown, setPreviewCountdown] =
    useState<number | "START">(5);
  const [connectionLine, setConnectionLine] =
    useState<Point[] | null>(null);
  const [breakingTileIds, setBreakingTileIds] =
    useState<Set<string>>(() => new Set());
  const [breakEffects, setBreakEffects] = useState<
    Array<Point & { id: string; symbol: string }>
  >([]);
  const [breakStyle, setBreakStyle] =
    useState<BreakStyle>(BREAK_STYLES[0]);
  const [effectVariant, setEffectVariant] =
    useState<EffectVariant>(0);
  const [autoShuffleMessage, setAutoShuffleMessage] = useState(false);
  const [isLiteEffectMode, setIsLiteEffectMode] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [clearReward, setClearReward] = useState({ pair: 0, time: 0, efficiency: 0, resource: 0, stage: 0, total: 0, isBest: false, rankingPoints: 0 });

  const remainingTiles = useMemo(
    () => board.flat().filter(Boolean).length,
    [board],
  );

  useEffect(() => {
    setBreakStyle(getRandomBreakStyle());
    const saved = Number(localStorage.getItem("hoo-shisen-unlocked-stage") ?? "1");
    setUnlockedStage(Math.min(100, Math.max(1, saved)));

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const updateEffectMode = () => setIsLiteEffectMode(mediaQuery.matches);
    updateEffectMode();
    mediaQuery.addEventListener?.("change", updateEffectMode);
    return () => mediaQuery.removeEventListener?.("change", updateEffectMode);
  }, []);

  useEffect(() => {
    setIsPreviewing(true);
    setSelected(null);
    setRevealedTileIds(new Set());
    setPreviewCountdown(5);

    let countdown = 5;
    let startTimer: number | null = null;

    const countdownTimer = window.setInterval(() => {
      countdown -= 1;

      if (countdown > 0) {
        setPreviewCountdown(countdown);
        return;
      }

      window.clearInterval(countdownTimer);
      setPreviewCountdown("START");

      startTimer = window.setTimeout(() => {
        setIsPreviewing(false);
      }, 800);
    }, 1000);

    return () => {
      window.clearInterval(countdownTimer);

      if (startTimer !== null) {
        window.clearTimeout(startTimer);
      }
    };
  }, [previewKey, stage]);

  useEffect(() => {
    if (isStageClear || isPreviewing) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isStageClear, isPreviewing, stage]);

  const startStage = useCallback((nextStage: number) => {
    effectSequenceRef.current += 1;
    setBreakStyle((current) => getRandomBreakStyle(current.id));
    setEffectVariant((current) => getNextEffectVariant(current));
    setStage(nextStage);
    setBoard(createStageBoard(nextStage));
    setSelected(null);
    setHintPair(null);
    setSeconds(0);
    setMoves(0);
    setHints(3);
    setShuffles(3);
    setIsStageClear(false);
    setIsPreviewing(true);
    setRevealedTileIds(new Set());
    setIsResolvingPair(false);
    setPreviewKey((value) => value + 1);
    setConnectionLine(null);
    setBreakingTileIds(new Set());
    setBreakEffects([]);
    setAutoShuffleMessage(false);
    scoreRef.current = 0;
    comboRef.current = 0;
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setClearReward({ pair: 0, time: 0, efficiency: 0, resource: 0, stage: 0, total: 0, isBest: false, rankingPoints: 0 });
  }, []);

  async function clearPair(first: Point, second: Point) {
    const nextBoard = board.map((row) => [...row]);
    nextBoard[first.row][first.column] = null;
    nextBoard[second.row][second.column] = null;
    setBoard(nextBoard);
    setMoves((value) => value + 1);
    setSelected(null);
    setHintPair(null);
    setRevealedTileIds(new Set());

    const tilesLeft = nextBoard.flat().filter(Boolean).length;
    if (tilesLeft === 0) {
      const expectedMoves = getStageSize(stage).tileCount / 2;
      const finalMoves = moves + 1;
      const timeReward = Math.max(0, 3000 - seconds * 20);
      const efficiencyReward = Math.max(
        0,
        2000 - Math.max(0, finalMoves - expectedMoves) * 100,
      );
      const resourceReward = hints * 250 + shuffles * 300;
      const stageReward = stage * 100;
      const totalReward =
        scoreRef.current +
        timeReward +
        efficiencyReward +
        resourceReward +
        stageReward;
      const bestScoreKey = `hoo-shisen-stage-${stage}-best-score`;
      const previousBest = Number(localStorage.getItem(bestScoreKey) ?? "0");
      const isBest = totalReward > previousBest;

      if (isBest) {
        localStorage.setItem(bestScoreKey, String(totalReward));
      }

      const previousTotalScore = Number(
        localStorage.getItem("hoo-shisen-total-score") ?? "0",
      );
      const improvedScore = Math.max(0, totalReward - previousBest);
      localStorage.setItem(
        "hoo-shisen-total-score",
        String(previousTotalScore + improvedScore),
      );

      const isRankingMilestone = stage % 10 === 0;
      const rankingPoints = isRankingMilestone
        ? stage >= 80
          ? 30
          : stage >= 50
            ? 20
            : 10
        : 0;

      if (rankingPoints > 0) {
        const previousRankingScore = Number(
          localStorage.getItem("hoo-shisen-ranking-score") ?? "0",
        );
        const nextRankingScore = previousRankingScore + rankingPoints;

        localStorage.setItem(
          "hoo-shisen-ranking-score",
          String(nextRankingScore),
        );

        try {
          const response = await fetch("/api/minigame-scores", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              scores: {
                shisen: nextRankingScore,
              },
            }),
            cache: "no-store",
          });

          if (!response.ok && response.status !== 401) {
            console.warn("사천성 랭킹 점수 서버 저장 실패");
          }
        } catch (error) {
          console.warn("사천성 랭킹 점수 서버 저장 오류:", error);
        }

        window.dispatchEvent(
          new CustomEvent("hoo:shisen-ranking-score", {
            detail: {
              stage,
              points: rankingPoints,
              total: nextRankingScore,
            },
          }),
        );
      }

      setClearReward({
        pair: scoreRef.current,
        time: timeReward,
        efficiency: efficiencyReward,
        resource: resourceReward,
        stage: stageReward,
        total: totalReward,
        isBest,
        rankingPoints,
      });

      const nextUnlocked = Math.min(
        100,
        Math.max(unlockedStage, stage + 1),
      );
      setUnlockedStage(nextUnlocked);
      localStorage.setItem(
        "hoo-shisen-unlocked-stage",
        String(nextUnlocked),
      );
      setIsStageClear(true);
      return;
    }

    if (!findAvailablePair(nextBoard)) {
      const playableBoard = shuffleRemainingTiles(nextBoard);
      setBoard(playableBoard);
      setAutoShuffleMessage(true);
      window.setTimeout(() => setAutoShuffleMessage(false), 1400);
    }
  }

  function selectTile(point: Point) {
    const tile = board[point.row]?.[point.column];
    if (
      !tile ||
      isStageClear ||
      isPreviewing ||
      isResolvingPair
    ) return;

    if (!selected) {
      setSelected(point);
      setHintPair(null);
      setRevealedTileIds(new Set([tile.id]));
      return;
    }

    if (selected.row === point.row && selected.column === point.column) {
      setSelected(null);
      setRevealedTileIds(new Set());
      return;
    }

    const selectedTile = board[selected.row]?.[selected.column];
    setRevealedTileIds((previous) => {
      const next = new Set(previous);
      next.add(tile.id);
      return next;
    });
    setIsResolvingPair(true);

    const validConnectionPath =
      selectedTile?.symbol === tile.symbol
        ? findConnectionPath(board, selected, point)
        : null;

    if (selectedTile && validConnectionPath) {
      const nextCombo = comboRef.current + 1;
      const gainedScore = 100 + Math.min(900, (nextCombo - 1) * 50);
      comboRef.current = nextCombo;
      scoreRef.current += gainedScore;
      setCombo(nextCombo);
      setBestCombo((value) => Math.max(value, nextCombo));
      setScore(scoreRef.current);
      effectSequenceRef.current += 1;
      const effectSequence = effectSequenceRef.current;
      setEffectVariant((current) => getNextEffectVariant(current));

      setConnectionLine(validConnectionPath);
      setBreakingTileIds(
        new Set([selectedTile.id, tile.id]),
      );
      setBreakEffects([
        {
          ...selected,
          id: `break-${selectedTile.id}`,
          symbol: selectedTile.symbol,
        },
        {
          ...point,
          id: `break-${tile.id}`,
          symbol: tile.symbol,
        },
      ]);

      window.setTimeout(() => {
        clearPair(selected, point);
        setIsResolvingPair(false);
      }, 140);

      window.setTimeout(() => {
        if (effectSequenceRef.current !== effectSequence) {
          return;
        }

        setConnectionLine(null);
        setBreakingTileIds(new Set());
        setBreakEffects([]);
      }, isLiteEffectMode ? 760 : 1220);
      return;
    }

    window.setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
      setSelected(null);
      setHintPair(null);
      setRevealedTileIds(new Set());
      setIsResolvingPair(false);
    }, 420);
  }

  function useHint() {
    if (hints <= 0 || isPreviewing || isResolvingPair || isStageClear) return;
    const pair = findAvailablePair(board);
    if (!pair) {
      setBoard(shuffleRemainingTiles(board));
      setAutoShuffleMessage(true);
      window.setTimeout(() => setAutoShuffleMessage(false), 1400);
      return;
    }
    setHints((value) => value - 1);
    setHintPair(pair);
    window.setTimeout(() => setHintPair(null), 1800);
  }

  function shuffleBoard() {
    if (shuffles <= 0 || isPreviewing || isResolvingPair || isStageClear) return;
    effectSequenceRef.current += 1;
    setShuffles((value) => value - 1);
    setBoard(shuffleRemainingTiles(board));
    setSelected(null);
    setHintPair(null);
    setRevealedTileIds(new Set());
    setConnectionLine(null);
    setBreakingTileIds(new Set());
    setBreakEffects([]);
    setAutoShuffleMessage(false);
    comboRef.current = 0;
    setCombo(0);
  }

  const { rows, columns } = getStageSize(stage);
  const connectionPoints =
    connectionLine
      ?.map(
        (point) =>
          `${point.column + 0.5},${point.row + 0.5}`,
      )
      .join(" ") ?? "";
  const tileFontSize =
    columns <= 6
      ? "text-[clamp(30px,5vw,58px)]"
      : columns <= 8
        ? "text-[clamp(26px,4vw,48px)]"
        : columns <= 10
          ? "text-[clamp(20px,3.2vw,40px)]"
          : columns <= 12
            ? "text-[clamp(16px,2.6vw,32px)]"
            : "text-[clamp(12px,2vw,25px)]";

  return createPortal(
    <section className="fixed inset-0 z-[999999] h-[100dvh] w-[100dvw] overflow-hidden bg-[#050507] text-white">
      <div className="mx-auto flex h-full w-full max-w-[1080px] flex-col px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-[calc(8px+env(safe-area-inset-top))] sm:px-5 sm:py-5">
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-2 pb-3 sm:pb-4">
          <div>
            <p className="text-[9px] font-black tracking-[0.2em] text-violet-300/60">TILE CONNECT</p>
            <h1 className="text-xl font-black tracking-[0.06em] sm:text-3xl">HOO 사천성</h1>
          </div>
          <button type="button" onClick={onExit} className="rounded-full border border-white/25 px-4 py-2 text-sm font-black transition active:scale-95 sm:px-6 sm:py-3">
            나가기 ×
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-2 pt-2 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-4 lg:pt-4">
          <aside className="hidden min-h-0 rounded-3xl border border-white/10 bg-white/[0.04] p-4 lg:flex lg:flex-col">
            <h2 className="text-lg font-black">스테이지 선택</h2>
            <div className="mt-3 grid min-h-0 flex-1 grid-cols-4 gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {Array.from({ length: 100 }, (_, index) => index + 1).map((stageNumber) => (
                <button key={stageNumber} type="button" disabled={stageNumber > unlockedStage} onClick={() => startStage(stageNumber)} className={`aspect-square rounded-xl text-xs font-black ${stageNumber === stage ? "bg-violet-500 text-white" : stageNumber <= unlockedStage ? "bg-white/10 text-white" : "bg-black/30 text-white/20"}`}>
                  {stageNumber > unlockedStage ? "🔒" : stageNumber}
                </button>
              ))}
            </div>
          </aside>

          <main className="relative flex min-h-0 flex-col rounded-3xl border border-white/10 bg-white/[0.035] p-2 sm:p-4">
            <div className="mb-2 grid grid-cols-5 gap-1.5 text-center sm:mb-3 sm:gap-2">
              {[
                ["STAGE", `${stage}/100`],
                ["TIME", formatTime(seconds)],
                ["TILES", String(remainingTiles)],
                ["MOVE", String(moves)],
                ["SIZE", `${columns}×${rows}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-black/35 px-1 py-1.5 sm:py-2">
                  <p className="text-[7px] font-black text-white/35 sm:text-[9px]">{label}</p>
                  <p className="text-[10px] font-black text-white sm:text-sm">{value}</p>
                </div>
              ))}
            </div>

            <div
              className={`hoo-break-theme-${breakStyle.id} hoo-effect-variant-${effectVariant} relative min-h-0 flex-1 rounded-2xl border border-violet-300/20 bg-[#14111d] p-1.5 sm:p-2`}
            >
              <div className="pointer-events-none absolute right-2 top-2 z-[70] flex items-center gap-1.5 sm:right-3 sm:top-3">
                {combo >= 2 && <span className="animate-pulse rounded-full bg-fuchsia-500/90 px-2 py-1 text-[8px] font-black shadow-[0_0_16px_rgba(217,70,239,0.7)] sm:text-[10px]">COMBO ×{combo}</span>}
                <span className="rounded-full border border-yellow-200/30 bg-black/75 px-2.5 py-1 text-[8px] font-black text-yellow-100 sm:text-[10px]">SCORE {score.toLocaleString()}</span>
              </div>
              {autoShuffleMessage && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-[80] -translate-x-1/2 animate-pulse rounded-full border border-violet-300/50 bg-black/85 px-4 py-2 text-[10px] font-black tracking-[0.08em] text-violet-100 shadow-[0_0_24px_rgba(139,92,246,0.5)] sm:text-xs">
                  연결 가능한 패가 없어 자동으로 섞었어요
                </div>
              )}
              <div className="mx-auto grid h-full max-h-full w-full gap-[2px] sm:gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
                {board.flatMap((row, rowIndex) =>
                  row.map((tile, columnIndex) => {
                    const isSelected = selected?.row === rowIndex && selected?.column === columnIndex;
                    const isHint = hintPair?.some((point) => point.row === rowIndex && point.column === columnIndex);
                    const isBreaking = Boolean(
                      tile && breakingTileIds.has(tile.id),
                    );
                    const isFaceUp = Boolean(
                      tile &&
                      (
                        isPreviewing ||
                        isHint ||
                        revealedTileIds.has(tile.id)
                      ),
                    );
                    return (
                      <button key={`${rowIndex}-${columnIndex}`} type="button" disabled={!tile || isPreviewing || isResolvingPair} onClick={() => selectTile({ row: rowIndex, column: columnIndex })} className={`hoo-tile-card relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-[5px] border-2 font-black transition-[transform,box-shadow,border-color] duration-150 sm:rounded-xl ${tile ? isFaceUp ? `${getTilePalette(tile.symbol)} shadow-[inset_0_2px_0_rgba(255,255,255,0.55),0_3px_8px_rgba(0,0,0,0.2)] [transform:rotateY(0deg)]` : "border-violet-400/25 bg-gradient-to-br from-[#35275a] to-[#1c1633] shadow-[inset_0_0_18px_rgba(139,92,246,0.18)] [transform:rotateY(180deg)]" : "border-transparent bg-transparent"} ${isSelected ? "scale-90 ring-4 ring-white" : ""} ${isHint ? "animate-pulse ring-4 ring-yellow-200" : ""} ${isBreaking ? "hoo-tile-breaking" : ""} ${tileFontSize}`}>
                        {tile && (
                          isFaceUp ? (
                            <span className="drop-shadow-[0_2px_1px_rgba(0,0,0,0.2)] [transform:rotateY(0deg)_scale(1.12)]">
                              {tile.symbol}
                            </span>
                          ) : (
                            <span className="select-none text-[8px] font-black tracking-[0.08em] text-violet-200/55 [transform:rotateY(180deg)] sm:text-xs">
                              HOO
                            </span>
                          )
                        )}
                      </button>
                    );
                  }),
                )}
              </div>

              {connectionLine && (
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-1.5 z-20 h-[calc(100%_-_12px)] w-[calc(100%_-_12px)] overflow-visible sm:inset-2 sm:h-[calc(100%_-_16px)] sm:w-[calc(100%_-_16px)]"
                  viewBox={`0 0 ${columns} ${rows}`}
                  preserveAspectRatio="none"
                >
                  {breakStyle.id === "ocean" ? (
                    <>
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#075985" strokeWidth="0.34" strokeLinecap="round" strokeLinejoin="round" className="hoo-ocean-current-base" />
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#38bdf8" strokeWidth="0.24" strokeLinecap="round" strokeLinejoin="round" className="hoo-ocean-current-water" />
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#ffffff" strokeWidth="0.075" strokeLinecap="round" strokeLinejoin="round" className="hoo-ocean-current-foam" />
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#bae6fd" strokeWidth="0.035" strokeLinecap="round" strokeLinejoin="round" className="hoo-ocean-current-glint" />
                    </>
                  ) : breakStyle.id === "cyber" ? (
                    <>
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#08122c" strokeWidth="0.25" strokeLinecap="square" strokeLinejoin="miter" className="hoo-cyber-link-base" />
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#00f5ff" strokeWidth="0.075" strokeLinecap="square" strokeLinejoin="miter" className="hoo-cyber-link-cyan" />
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#ff00d4" strokeWidth="0.045" strokeLinecap="square" strokeLinejoin="miter" className="hoo-cyber-link-magenta" />
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#ffffff" strokeWidth="0.018" strokeLinecap="square" strokeLinejoin="miter" className="hoo-cyber-link-pulse" />
                    </>
                  ) : breakStyle.id === "steam" ? (
                    <>
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#431407" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" className="hoo-steam-pipe-shadow" />
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#b87333" strokeWidth="0.22" strokeLinecap="round" strokeLinejoin="round" className="hoo-steam-pipe" />
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#fde68a" strokeWidth="0.055" strokeLinecap="round" strokeLinejoin="round" className="hoo-steam-pipe-shine" />
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#fff7ed" strokeWidth="0.09" strokeLinecap="round" strokeLinejoin="round" className="hoo-steam-flow" />
                    </>
                  ) : breakStyle.id === "hell" ? (
                    <>
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#1c0503" strokeWidth="0.3" strokeLinecap="round" strokeLinejoin="round" className="hoo-hell-trail-base" />
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#ef2b0a" strokeWidth="0.18" strokeLinecap="round" strokeLinejoin="round" className="hoo-hell-trail-fire" />
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#ffb000" strokeWidth="0.075" strokeLinecap="round" strokeLinejoin="round" className="hoo-hell-trail-core" />
                      <polyline pathLength="1" points={connectionPoints} fill="none" stroke="#fff3a3" strokeWidth="0.025" strokeLinecap="round" strokeLinejoin="round" className="hoo-hell-trail-spark" />
                    </>
                  ) : (
                    <>
                      <polyline points={connectionPoints} fill="none" stroke="var(--hoo-break-glow)" strokeWidth="0.12" strokeLinecap="round" strokeLinejoin="round" className="hoo-connect-line-glow" />
                      <polyline points={connectionPoints} fill="none" stroke="var(--hoo-break-line)" strokeWidth="0.055" strokeLinecap="round" strokeLinejoin="round" className="hoo-connect-line" />
                    </>
                  )}
                </svg>
              )}

              {breakEffects.length > 0 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-1.5 z-30 grid gap-[2px] sm:inset-2 sm:gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                  }}
                >
                  <span className="hoo-break-impact pointer-events-none absolute inset-0 rounded-2xl" />
                  <span className="hoo-break-atmosphere pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" />
                  {breakEffects.map((effect) => (
                    <div
                      key={effect.id}
                      className="hoo-break-origin relative overflow-visible [perspective:520px] [transform-style:preserve-3d]"
                      style={{
                        gridRowStart: effect.row + 1,
                        gridColumnStart: effect.column + 1,
                      }}
                    >
                      {breakStyle.id === "ocean" && <span className="hoo-ocean-tile-ghost absolute inset-[8%] z-10 items-center justify-center rounded-xl text-[clamp(28px,5vw,58px)]">{effect.symbol}</span>}
                      {breakStyle.id === "glass" && (
                        <span className="hoo-glass-card-ghost absolute inset-[5%] z-10 items-center justify-center overflow-hidden rounded-xl text-[clamp(28px,5vw,58px)]">
                          <b className="relative z-10 font-normal">{effect.symbol}</b>
                          {Array.from({ length: isLiteEffectMode ? 5 : 8 }, (_, index) => <i key={`crack-${index}`} className={`hoo-glass-crack hoo-glass-crack-${index + 1} absolute left-1/2 top-1/2 h-[2px] origin-left`} />)}
                        </span>
                      )}
                      {breakStyle.id === "cyber" && (<>
                        <span className="hoo-cyber-card-ghost absolute inset-[5%] z-10 items-center justify-center overflow-hidden rounded-md text-[clamp(28px,5vw,58px)]"><b className="hoo-cyber-symbol relative z-10 font-normal">{effect.symbol}</b><i className="hoo-cyber-grid absolute inset-0" /><i className="hoo-cyber-scan absolute inset-x-0 top-0 h-[18%]" /></span>
                        {Array.from({ length: isLiteEffectMode ? 6 : 12 }, (_, index) => <span key={`cyber-pixel-${index}`} className={`hoo-cyber-pixel hoo-cyber-pixel-${index + 1} absolute left-1/2 top-1/2 z-20`} />)}
                      </>)}
                      {breakStyle.id === "steam" && (<>
                        <span className="hoo-steam-card-ghost absolute inset-[5%] z-10 items-center justify-center overflow-visible rounded-xl text-[clamp(28px,5vw,58px)]"><b className="relative z-10 font-normal">{effect.symbol}</b><i className="hoo-steam-gauge absolute right-[8%] top-[8%] h-[25%] w-[25%] rounded-full"><em className="hoo-steam-needle absolute bottom-1/2 left-1/2 h-[42%] w-[2px] origin-bottom" /></i>{Array.from({ length: 4 }, (_, index) => <i key={`rivet-${index}`} className={`hoo-steam-rivet hoo-steam-rivet-${index + 1} absolute h-[8%] w-[8%] rounded-full`} />)}</span>
                        {Array.from({ length: isLiteEffectMode ? 3 : 6 }, (_, index) => <span key={`steam-puff-${index}`} className={`hoo-steam-puff hoo-steam-puff-${index + 1} absolute left-1/2 top-1/2 z-20 rounded-full`} />)}
                        {Array.from({ length: isLiteEffectMode ? 2 : 4 }, (_, index) => <span key={`steam-gear-${index}`} className={`hoo-steam-gear hoo-steam-gear-${index + 1} absolute left-1/2 top-1/2 z-20 flex items-center justify-center font-black`}>⚙</span>)}
                      </>)}
                      {breakStyle.id === "hell" && (<>
                        <span className="hoo-hell-card-ghost absolute inset-[5%] z-10 items-center justify-center overflow-visible rounded-xl text-[clamp(28px,5vw,58px)]"><b className="hoo-hell-symbol relative z-10 font-normal">{effect.symbol}</b><i className="hoo-hell-char absolute inset-0 rounded-xl" /></span>
                        <span className="hoo-hell-backglow absolute inset-[-14%] z-[5] rounded-[28%]" />
                        {Array.from({ length: isLiteEffectMode ? 8 : 18 }, (_, index) => <span key={`hell-ash-${index}`} className={`hoo-hell-ash hoo-hell-ash-${index + 1} absolute left-1/2 top-1/2 z-30`} />)}
                        {Array.from({ length: isLiteEffectMode ? 6 : 14 }, (_, index) => <span key={`hell-ember-${index}`} className={`hoo-hell-ember hoo-hell-ember-${index + 1} absolute left-1/2 top-1/2 z-30 rounded-full`} />)}
                      </>)}
                      {breakStyle.id === "dream" && (<>
                        <span className="hoo-dream-card-ghost absolute inset-[5%] z-10 items-center justify-center overflow-visible rounded-xl text-[clamp(28px,5vw,58px)]"><b className="hoo-dream-symbol relative z-20 font-normal">{effect.symbol}</b><i className="hoo-dream-portal absolute inset-[-16%] rounded-full" /><i className="hoo-dream-halo hoo-dream-halo-one absolute inset-[-8%] rounded-full" /><i className="hoo-dream-halo hoo-dream-halo-two absolute inset-[5%] rounded-full" /></span>
                        {Array.from({ length: isLiteEffectMode ? 3 : 6 }, (_, index) => <span key={`dream-wisp-${index}`} className={`hoo-dream-wisp hoo-dream-wisp-${index + 1} absolute left-1/2 top-1/2 z-20 rounded-full`} />)}
                      </>)}
                      {breakStyle.id === "leaf" && (<>
                        <span className="hoo-leaf-green-burst absolute inset-[-8%] z-[5] rounded-full" />
                        {Array.from({ length: isLiteEffectMode ? 6 : 12 }, (_, index) => (
                          <span key={`leaf-fly-${index}`} className={`hoo-leaf-fly hoo-leaf-fly-${index + 1} absolute left-1/2 top-1/2 z-30`}><i /></span>
                        ))}
                      </>)}
                      {breakStyle.id === "heaven" && (<>
                        <span className="hoo-heaven-sanctum absolute inset-[-20%] z-[5] rounded-full"><i /><b /></span>
                        <span className="hoo-heaven-gate absolute inset-[-28%] z-[6]"><i /><b /></span>
                        <span className="hoo-heaven-card-ghost absolute inset-[5%] z-10 flex items-center justify-center rounded-xl text-[clamp(28px,5vw,58px)]"><i className="hoo-heaven-sigil absolute left-1/2 top-1/2" /><b className="relative z-20 font-normal">{effect.symbol}</b></span>
                        {Array.from({ length: isLiteEffectMode ? 4 : 8 }, (_, index) => <span key={`heaven-feather-${index}`} className={`hoo-heaven-feather hoo-heaven-feather-${index + 1} absolute left-1/2 top-1/2 z-30`}><i /></span>)}
                      </>)}
                      <span className="hoo-break-flash absolute left-1/2 top-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
                      <span className="hoo-break-ring absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2" />
                      <span className="hoo-break-ring hoo-break-ring-second absolute left-1/2 top-1/2 h-[52%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full border" />
                      <span className="hoo-theme-core absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2" />

                      {Array.from({ length: isLiteEffectMode ? 2 : breakStyle.id === "dream" || breakStyle.id === "leaf" || breakStyle.id === "heaven" ? 4 : 6 }, (_, index) => (
                        <span
                          key={`motif-${index}`}
                          className={`hoo-theme-motif hoo-theme-motif-${index + 1} absolute left-1/2 top-1/2 flex items-center justify-center font-black`}
                        >
                          {breakStyle.motif}
                        </span>
                      ))}

                      {Array.from({ length: isLiteEffectMode ? 3 : breakStyle.id === "dream" || breakStyle.id === "leaf" || breakStyle.id === "heaven" ? 6 : 12 }, (_, index) => (
                        <span
                          key={`depth-${index}`}
                          className={`hoo-depth-fragment hoo-depth-fragment-${index + 1} absolute left-1/2 top-1/2`}
                        >
                          <i />
                        </span>
                      ))}

                      {Array.from({ length: isLiteEffectMode ? 5 : breakStyle.id === "dream" ? 10 : breakStyle.id === "leaf" ? 6 : breakStyle.id === "heaven" ? 8 : 18 }, (_, index) => (
                        <span
                          key={index}
                          className={`hoo-break-particle hoo-break-particle-${index + 1} absolute left-1/2 top-1/2 h-[18%] w-[18%] rounded-[3px]`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2 grid shrink-0 grid-cols-4 gap-2">
              <button type="button" onClick={useHint} disabled={hints <= 0 || isPreviewing || isResolvingPair || isStageClear} className="rounded-xl bg-violet-600 py-2 text-xs font-black disabled:opacity-30 sm:text-sm">힌트 {hints}</button>
              <button type="button" onClick={shuffleBoard} disabled={shuffles <= 0 || isPreviewing || isResolvingPair || isStageClear} className="rounded-xl bg-white/10 py-2 text-xs font-black disabled:opacity-30 sm:text-sm">섞기 {shuffles}</button>
              <button type="button" onClick={() => startStage(stage)} className="rounded-xl bg-white/10 py-2 text-xs font-black sm:text-sm">재시작</button>
              <button type="button" onClick={() => startStage(Math.min(unlockedStage, stage + 1))} disabled={stage >= unlockedStage} className="rounded-xl bg-white/10 py-2 text-xs font-black disabled:opacity-30 sm:text-sm">다음 ▶</button>
            </div>

            {isPreviewing && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-3xl bg-black/20 backdrop-blur-[1px]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.28),transparent_58%)]" />

                <div className="relative flex flex-col items-center text-center [font-family:'Courier_New',monospace]">
                  <p className="text-[10px] font-black tracking-[0.42em] text-cyan-300 drop-shadow-[0_0_10px_rgba(103,232,249,0.9)] sm:text-sm">
                    MEMORY PHASE
                  </p>

                  <p className="mt-2 rounded-full border border-white/20 bg-black/45 px-4 py-1 text-[10px] font-black tracking-[0.15em] text-white/80 sm:text-xs">
                    {breakStyle.icon} {breakStyle.name} BREAK
                  </p>

                  <p className="mt-3 border-y border-violet-300/30 px-6 py-2 text-sm font-black tracking-[0.12em] text-white drop-shadow-[0_2px_0_rgba(0,0,0,1)] sm:text-xl">
                    타일을 기억하세요
                  </p>

                  <div
                    key={previewCountdown}
                    className={`hoo-arcade-count mt-3 flex min-h-[130px] items-center justify-center font-black leading-none tracking-[-0.08em] text-white sm:min-h-[190px] ${
                      previewCountdown === "START"
                        ? "text-[clamp(58px,12vw,138px)] text-yellow-300 drop-shadow-[5px_5px_0_#7c3aed]"
                        : "text-[clamp(90px,18vw,210px)] drop-shadow-[7px_7px_0_#7c3aed]"
                    }`}
                  >
                    {previewCountdown === "START"
                      ? "START!"
                      : previewCountdown}
                  </div>

                  <div className="mt-1 flex gap-2">
                    {Array.from({ length: 5 }, (_, index) => {
                      const remaining =
                        previewCountdown === "START"
                          ? 0
                          : previewCountdown;

                      return (
                        <span
                          key={index}
                          className={`h-2 w-8 border sm:h-3 sm:w-12 ${
                            index < remaining
                              ? "border-cyan-200 bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]"
                              : "border-white/15 bg-white/5"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <style jsx global>{`
              .hoo-arcade-count {
                animation: hooArcadeCount 650ms ease-out;
              }

              .hoo-connect-line,
              .hoo-connect-line-glow {
                stroke-dasharray: 12;
                stroke-dashoffset: 12;
                animation: hooConnectLine 850ms ease-out forwards;
              }

              .hoo-connect-line-glow {
                filter: drop-shadow(0 0 0.18px var(--hoo-break-line))
                  drop-shadow(0 0 0.35px var(--hoo-break-accent));
              }

              .hoo-tile-breaking {
                opacity: 0 !important;
                filter: var(--hoo-break-filter, brightness(2) blur(4px));
                transform: var(--hoo-break-transform, scale(0) rotate(12deg)) !important;
                transition-duration: 220ms !important;
              }

              .hoo-break-impact {
                animation: hooBoardImpact 760ms ease-out forwards;
                background:
                  radial-gradient(circle at center, var(--hoo-break-line) 0, transparent 34%),
                  linear-gradient(110deg, transparent 30%, var(--hoo-break-accent) 50%, transparent 70%);
                box-shadow: inset 0 0 70px var(--hoo-break-accent);
                mix-blend-mode: screen;
              }

              .hoo-break-atmosphere {
                animation: hooAtmosphereFade 900ms ease-out forwards;
                mix-blend-mode: screen;
              }

              .hoo-break-atmosphere::before,
              .hoo-break-atmosphere::after {
                content: "";
                position: absolute;
                inset: -35%;
                opacity: 0.85;
              }

              .hoo-ocean-tile-ghost {
                display:none;
              }

              .hoo-glass-card-ghost {
                display:none;
              }

              .hoo-cyber-card-ghost,
              .hoo-cyber-pixel {
                display:none;
              }

              .hoo-steam-card-ghost,
              .hoo-steam-puff,
              .hoo-steam-gear {
                display:none;
              }

              .hoo-hell-card-ghost,
              .hoo-hell-backglow,
              .hoo-hell-ash,
              .hoo-hell-ember {
                display:none;
              }

              .hoo-dream-card-ghost,
              .hoo-dream-wisp {
                display:none;
              }

              .hoo-cyber-link-base,
              .hoo-cyber-link-cyan,
              .hoo-cyber-link-magenta,
              .hoo-cyber-link-pulse {
                stroke-dasharray:1;
                stroke-dashoffset:1;
              }
              .hoo-cyber-link-base { animation:hooCyberLinkBuild 860ms steps(12,end) forwards; filter:drop-shadow(0 0 .2px #00f5ff); }
              .hoo-cyber-link-cyan { stroke-dasharray:.08 .035; animation:hooCyberCurrent 900ms linear forwards; filter:drop-shadow(0 0 .12px #00f5ff) drop-shadow(0 0 .25px #00f5ff); }
              .hoo-cyber-link-magenta { stroke-dasharray:.025 .07; animation:hooCyberCurrentReverse 900ms linear forwards; filter:drop-shadow(0 0 .13px #ff00d4) drop-shadow(0 0 .24px #ff00d4); }
              .hoo-cyber-link-pulse { stroke-dasharray:.012 .16; animation:hooCyberPulse 760ms linear forwards; filter:drop-shadow(0 0 .13px #fff); }

              .hoo-steam-pipe-shadow,
              .hoo-steam-pipe,
              .hoo-steam-pipe-shine {
                stroke-dasharray:1;
                stroke-dashoffset:1;
                animation:hooSteamPipeBuild 900ms ease-out forwards;
              }
              .hoo-steam-pipe { filter:drop-shadow(0 0 .14px #f59e0b) drop-shadow(0 .08px .12px #1c0a02); }
              .hoo-steam-pipe-shine { animation-delay:55ms; }
              .hoo-steam-flow {
                stroke-dasharray:.025 .095;
                stroke-dashoffset:.8;
                animation:hooSteamFlow 920ms linear forwards;
                filter:blur(.02px) drop-shadow(0 0 .12px #fff7ed);
              }

              .hoo-hell-trail-base,
              .hoo-hell-trail-fire,
              .hoo-hell-trail-core {
                stroke-dasharray:1;
                stroke-dashoffset:1;
                animation:hooHellTrailIgnite 920ms ease-out forwards;
              }
              .hoo-hell-trail-fire { filter:drop-shadow(0 0 .16px #ff2d00) drop-shadow(0 0 .32px #7f1d1d);animation-delay:35ms; }
              .hoo-hell-trail-core { filter:drop-shadow(0 0 .13px #fff000);animation-delay:70ms; }
              .hoo-hell-trail-spark { stroke-dasharray:.012 .1;stroke-dashoffset:.8;animation:hooHellTrailSpark 860ms linear forwards;filter:drop-shadow(0 0 .12px #fff); }

              .hoo-glass-crack {
                width:58%;
                background:linear-gradient(90deg,#fff,rgba(186,230,253,.9),transparent);
                box-shadow:0 0 3px #fff,0 0 7px #7dd3fc;
                transform:rotate(var(--crack-angle)) scaleX(0);
                animation:hooGlassCrackGrow 360ms ease-out var(--crack-delay) forwards;
              }

              .hoo-glass-crack-1 { --crack-angle:8deg;--crack-delay:45ms;width:62%; }
              .hoo-glass-crack-2 { --crack-angle:51deg;--crack-delay:75ms;width:54%; }
              .hoo-glass-crack-3 { --crack-angle:96deg;--crack-delay:30ms;width:60%; }
              .hoo-glass-crack-4 { --crack-angle:137deg;--crack-delay:90ms;width:48%; }
              .hoo-glass-crack-5 { --crack-angle:181deg;--crack-delay:55ms;width:58%; }
              .hoo-glass-crack-6 { --crack-angle:224deg;--crack-delay:110ms;width:52%; }
              .hoo-glass-crack-7 { --crack-angle:274deg;--crack-delay:65ms;width:61%; }
              .hoo-glass-crack-8 { --crack-angle:318deg;--crack-delay:100ms;width:50%; }

              .hoo-cyber-pixel {
                --pixel-x:0%;
                --pixel-y:0%;
                width:14%;
                height:9%;
                border:1px solid #00f5ff;
                background:linear-gradient(90deg,#00f5ff,#ff00d4);
                box-shadow:0 0 8px #00f5ff,0 0 14px #ff00d4;
                animation:hooCyberPixelBurst 820ms steps(8,end) forwards;
              }
              .hoo-cyber-pixel-1{--pixel-x:-360%;--pixel-y:-260%}.hoo-cyber-pixel-2{--pixel-x:-80%;--pixel-y:-390%}.hoo-cyber-pixel-3{--pixel-x:260%;--pixel-y:-310%}
              .hoo-cyber-pixel-4{--pixel-x:390%;--pixel-y:-70%}.hoo-cyber-pixel-5{--pixel-x:330%;--pixel-y:250%}.hoo-cyber-pixel-6{--pixel-x:80%;--pixel-y:390%}
              .hoo-cyber-pixel-7{--pixel-x:-250%;--pixel-y:340%}.hoo-cyber-pixel-8{--pixel-x:-410%;--pixel-y:90%}.hoo-cyber-pixel-9{--pixel-x:170%;--pixel-y:-420%}
              .hoo-cyber-pixel-10{--pixel-x:440%;--pixel-y:150%}.hoo-cyber-pixel-11{--pixel-x:-120%;--pixel-y:440%}.hoo-cyber-pixel-12{--pixel-x:-450%;--pixel-y:-130%}

              .hoo-theme-core {
                animation: hooThemeCore 840ms ease-out forwards;
                border: 2px solid var(--hoo-break-line);
                border-radius: 50%;
                background: radial-gradient(circle, var(--hoo-break-flash), transparent 68%);
                box-shadow: 0 0 25px var(--hoo-break-line), inset 0 0 22px var(--hoo-break-accent);
              }

              .hoo-theme-motif {
                width: 28%;
                height: 28%;
                color: var(--hoo-particle-2);
                font-size: clamp(11px, 2.2vw, 28px);
                line-height: 1;
                text-shadow: 0 0 8px var(--hoo-break-line), 0 0 18px var(--hoo-break-accent);
                animation: hooThemeMotif 880ms cubic-bezier(0.12, 0.75, 0.18, 1) forwards;
              }

              .hoo-theme-motif-1 { --motif-x:-260%; --motif-y:-210%; }
              .hoo-theme-motif-2 { --motif-x:20%; --motif-y:-310%; }
              .hoo-theme-motif-3 { --motif-x:270%; --motif-y:-170%; }
              .hoo-theme-motif-4 { --motif-x:270%; --motif-y:190%; }
              .hoo-theme-motif-5 { --motif-x:0%; --motif-y:310%; }
              .hoo-theme-motif-6 { --motif-x:-280%; --motif-y:180%; }

              .hoo-depth-fragment {
                --depth-x: 0%;
                --depth-y: 0%;
                --depth-z: 160px;
                --depth-rx: 260deg;
                --depth-ry: 420deg;
                --depth-delay: 0ms;
                width: 18%;
                height: 23%;
                transform-style: preserve-3d;
                animation: hooDepthFragment 940ms cubic-bezier(.08,.7,.16,1) var(--depth-delay) forwards;
                filter: drop-shadow(0 8px 5px rgba(0,0,0,.65));
              }

              .hoo-depth-fragment > i {
                position: absolute;
                inset: 0;
                display: block;
                overflow: hidden;
                border: 1px solid rgba(255,255,255,.72);
                border-radius: 3px;
                background:
                  linear-gradient(135deg,rgba(255,255,255,.9),transparent 25%),
                  linear-gradient(145deg,var(--hoo-particle-1),var(--hoo-break-accent));
                box-shadow:
                  inset -7px -8px 10px rgba(0,0,0,.32),
                  inset 5px 5px 8px rgba(255,255,255,.48),
                  0 0 14px var(--hoo-break-line);
                transform: translateZ(6px);
              }

              .hoo-depth-fragment > i::after {
                content:"";
                position:absolute;
                inset:8% 52% 38% 8%;
                border-radius:999px;
                background:rgba(255,255,255,.72);
                filter:blur(2px);
              }

              .hoo-depth-fragment::before,
              .hoo-depth-fragment::after {
                content:"";
                position:absolute;
                background:color-mix(in srgb,var(--hoo-break-accent) 65%,#08050d);
                box-shadow:inset 0 0 5px rgba(255,255,255,.2);
              }

              .hoo-depth-fragment::before {
                right:-6px;
                top:3px;
                width:7px;
                height:100%;
                transform:rotateY(90deg);
                transform-origin:left;
              }

              .hoo-depth-fragment::after {
                left:3px;
                bottom:-6px;
                width:100%;
                height:7px;
                transform:rotateX(90deg);
                transform-origin:top;
              }

              .hoo-depth-fragment-1 { --depth-x:-420%;--depth-y:-280%;--depth-z:240px;--depth-rx:310deg;--depth-ry:520deg; }
              .hoo-depth-fragment-2 { --depth-x:-160%;--depth-y:-430%;--depth-z:90px;--depth-rx:-420deg;--depth-ry:260deg;--depth-delay:25ms; }
              .hoo-depth-fragment-3 { --depth-x:180%;--depth-y:-410%;--depth-z:310px;--depth-rx:520deg;--depth-ry:-360deg;--depth-delay:45ms; }
              .hoo-depth-fragment-4 { --depth-x:430%;--depth-y:-210%;--depth-z:140px;--depth-rx:-280deg;--depth-ry:580deg; }
              .hoo-depth-fragment-5 { --depth-x:460%;--depth-y:120%;--depth-z:280px;--depth-rx:430deg;--depth-ry:330deg;--depth-delay:35ms; }
              .hoo-depth-fragment-6 { --depth-x:280%;--depth-y:390%;--depth-z:80px;--depth-rx:-540deg;--depth-ry:-280deg;--depth-delay:60ms; }
              .hoo-depth-fragment-7 { --depth-x:0%;--depth-y:470%;--depth-z:330px;--depth-rx:370deg;--depth-ry:620deg; }
              .hoo-depth-fragment-8 { --depth-x:-290%;--depth-y:390%;--depth-z:120px;--depth-rx:-340deg;--depth-ry:410deg;--depth-delay:55ms; }
              .hoo-depth-fragment-9 { --depth-x:-470%;--depth-y:130%;--depth-z:260px;--depth-rx:580deg;--depth-ry:-390deg;--depth-delay:20ms; }
              .hoo-depth-fragment-10 { --depth-x:-350%;--depth-y:-70%;--depth-z:60px;--depth-rx:-460deg;--depth-ry:300deg;--depth-delay:75ms; }
              .hoo-depth-fragment-11 { --depth-x:90%;--depth-y:-330%;--depth-z:360px;--depth-rx:290deg;--depth-ry:540deg;--depth-delay:65ms; }
              .hoo-depth-fragment-12 { --depth-x:360%;--depth-y:300%;--depth-z:190px;--depth-rx:-510deg;--depth-ry:-470deg;--depth-delay:80ms; }

              .hoo-break-flash {
                animation: hooBreakFlash 820ms ease-out forwards;
                background: var(--hoo-break-flash);
                box-shadow:
                  0 0 18px rgba(255, 255, 255, 1),
                  0 0 36px var(--hoo-break-line),
                  0 0 54px var(--hoo-break-accent);
              }

              .hoo-break-ring {
                animation: hooBreakRing 850ms ease-out forwards;
                border-color: var(--hoo-break-line);
                box-shadow: 0 0 20px var(--hoo-break-line);
              }

              .hoo-break-ring-second {
                animation-delay: 90ms;
                border-color: var(--hoo-break-accent);
              }

              .hoo-break-particle {
                --break-x: 0%;
                --break-y: 0%;
                animation: hooBreakParticle 880ms cubic-bezier(0.12, 0.72, 0.2, 1)
                  forwards;
                background: var(--hoo-particle-1);
                box-shadow: 0 0 12px currentColor, 0 0 24px currentColor;
              }

              .hoo-break-particle-1 { --break-x: -330%; --break-y: -260%; background: var(--hoo-particle-1); }
              .hoo-break-particle-2 { --break-x: 10%; --break-y: -390%; background: var(--hoo-particle-2); }
              .hoo-break-particle-3 { --break-x: 310%; --break-y: -250%; background: var(--hoo-particle-3); }
              .hoo-break-particle-4 { --break-x: 390%; --break-y: 0%; background: var(--hoo-particle-4); }
              .hoo-break-particle-5 { --break-x: 290%; --break-y: 280%; background: var(--hoo-particle-1); }
              .hoo-break-particle-6 { --break-x: 0%; --break-y: 400%; background: var(--hoo-particle-2); }
              .hoo-break-particle-7 { --break-x: -300%; --break-y: 290%; background: var(--hoo-particle-3); }
              .hoo-break-particle-8 { --break-x: -400%; --break-y: 10%; background: var(--hoo-particle-4); }
              .hoo-break-particle-9 { --break-x: 180%; --break-y: -350%; background: var(--hoo-particle-2); }
              .hoo-break-particle-10 { --break-x: -180%; --break-y: 350%; background: var(--hoo-particle-1); }
              .hoo-break-particle-11 { --break-x: 470%; --break-y: -160%; background: var(--hoo-particle-3); }
              .hoo-break-particle-12 { --break-x: 460%; --break-y: 190%; background: var(--hoo-particle-4); }
              .hoo-break-particle-13 { --break-x: 140%; --break-y: 480%; background: var(--hoo-particle-2); }
              .hoo-break-particle-14 { --break-x: -150%; --break-y: 470%; background: var(--hoo-particle-3); }
              .hoo-break-particle-15 { --break-x: -480%; --break-y: 170%; background: var(--hoo-particle-1); }
              .hoo-break-particle-16 { --break-x: -460%; --break-y: -180%; background: var(--hoo-particle-4); }
              .hoo-break-particle-17 { --break-x: -130%; --break-y: -480%; background: var(--hoo-particle-2); }
              .hoo-break-particle-18 { --break-x: 150%; --break-y: -470%; background: var(--hoo-particle-1); }

              [class*="hoo-break-theme-"] {
                --hoo-break-line: #67e8f9;
                --hoo-break-glow: rgba(255, 255, 255, 0.95);
                --hoo-break-accent: #8b5cf6;
                --hoo-break-flash: #ffffff;
                --hoo-particle-1: #67e8f9;
                --hoo-particle-2: #ffffff;
                --hoo-particle-3: #facc15;
                --hoo-particle-4: #c084fc;
              }

              .hoo-break-theme-cyber { --hoo-break-line:#22d3ee; --hoo-break-accent:#f000ff; --hoo-particle-1:#00f5ff; --hoo-particle-2:#ff00d4; --hoo-particle-3:#7cff00; --hoo-particle-4:#ffffff; }
              .hoo-break-theme-steam { --hoo-break-line:#f59e0b; --hoo-break-glow:#fff0c2; --hoo-break-accent:#7c2d12; --hoo-break-flash:#ffd08a; --hoo-particle-1:#b87333; --hoo-particle-2:#fde68a; --hoo-particle-3:#78716c; --hoo-particle-4:#431407; --hoo-break-filter:sepia(1) brightness(1.8) blur(3px); }
              .hoo-break-theme-heaven { --hoo-break-line:#ffffff; --hoo-break-glow:#ffffff; --hoo-break-accent:#fde68a; --hoo-break-flash:#fffef0; --hoo-particle-1:#ffffff; --hoo-particle-2:#fef3c7; --hoo-particle-3:#bae6fd; --hoo-particle-4:#e9d5ff; --hoo-break-transform:scale(0.35) translateY(-45%) rotate(-8deg); }
              .hoo-break-theme-hell { --hoo-break-line:#ff3b00; --hoo-break-glow:#ffd3a8; --hoo-break-accent:#7f1d1d; --hoo-break-flash:#fff000; --hoo-particle-1:#ff2d00; --hoo-particle-2:#ff8a00; --hoo-particle-3:#fde047; --hoo-particle-4:#450a0a; --hoo-break-filter:brightness(2.5) saturate(2) blur(3px); }
              .hoo-break-theme-ocean { --hoo-break-line:#38bdf8; --hoo-break-glow:#e0f2fe; --hoo-break-accent:#0369a1; --hoo-break-flash:#dffaff; --hoo-particle-1:#22d3ee; --hoo-particle-2:#ffffff; --hoo-particle-3:#0ea5e9; --hoo-particle-4:#2dd4bf; }
              .hoo-break-theme-typhoon { --hoo-break-line:#cbd5e1; --hoo-break-glow:#ffffff; --hoo-break-accent:#64748b; --hoo-break-flash:#f8fafc; --hoo-particle-1:#e2e8f0; --hoo-particle-2:#94a3b8; --hoo-particle-3:#67e8f9; --hoo-particle-4:#475569; --hoo-break-transform:scale(0) rotate(220deg); }
              .hoo-break-theme-dream { --hoo-break-line:#d8b4fe; --hoo-break-glow:#fdf4ff; --hoo-break-accent:#f0abfc; --hoo-break-flash:#fae8ff; --hoo-particle-1:#c4b5fd; --hoo-particle-2:#f9a8d4; --hoo-particle-3:#fde68a; --hoo-particle-4:#93c5fd; --hoo-break-filter:brightness(1.7) blur(6px); }
              .hoo-break-theme-glass { --hoo-break-line:#e0f2fe; --hoo-break-glow:#ffffff; --hoo-break-accent:#7dd3fc; --hoo-break-flash:#ffffff; --hoo-particle-1:#ffffff; --hoo-particle-2:#bae6fd; --hoo-particle-3:#dbeafe; --hoo-particle-4:#67e8f9; --hoo-break-transform:scale(1.18) rotate(3deg); }
              .hoo-break-theme-leaf { --hoo-break-line:#86efac; --hoo-break-glow:#f0fdf4; --hoo-break-accent:#15803d; --hoo-break-flash:#dcfce7; --hoo-particle-1:#4ade80; --hoo-particle-2:#a3e635; --hoo-particle-3:#facc15; --hoo-particle-4:#166534; --hoo-break-transform:scale(0.2) translateY(35%) rotate(35deg); }
              .hoo-break-theme-wind { --hoo-break-line:#e2e8f0; --hoo-break-glow:#ffffff; --hoo-break-accent:#93c5fd; --hoo-break-flash:#f8fafc; --hoo-particle-1:#ffffff; --hoo-particle-2:#bfdbfe; --hoo-particle-3:#cbd5e1; --hoo-particle-4:#e0f2fe; --hoo-break-transform:scale(0.15) translateX(120%) rotate(18deg); }

              .hoo-break-theme-glass .hoo-break-particle { border-radius: 0; clip-path: polygon(50% 0,100% 100%,0 72%); animation-name: hooGlassParticle; }
              .hoo-break-theme-leaf .hoo-break-particle { border-radius: 100% 0 100% 0; animation-name: hooLeafParticle; }
              .hoo-break-theme-leaf .hoo-leaf-green-burst {
                display:block;
                background:radial-gradient(circle,rgba(236,252,203,.8) 0 8%,rgba(134,239,172,.55) 22%,rgba(34,197,94,.32) 43%,rgba(21,128,61,.12) 62%,transparent 74%);
                box-shadow:0 0 22px rgba(74,222,128,.62),0 0 48px rgba(22,163,74,.36);
                animation:hooLeafGreenBurst 820ms ease-out forwards;
              }
              .hoo-break-theme-leaf .hoo-leaf-fly {
                display:block;
                width:18%;height:28%;
                transform-style:preserve-3d;
                animation:hooLeafScatter 1050ms cubic-bezier(.16,.72,.22,1) var(--leaf-delay) forwards;
              }
              .hoo-break-theme-leaf .hoo-leaf-fly > i {
                position:absolute;inset:0;
                border-radius:100% 0 100% 0;
                background:linear-gradient(135deg,var(--leaf-light) 0 14%,var(--leaf-color) 17% 52%,var(--leaf-dark) 55% 100%);
                box-shadow:inset -3px -3px 5px rgba(20,83,45,.28),0 0 8px rgba(74,222,128,.42);
                transform:rotate(var(--leaf-tilt));
                animation:hooLeafFlutter 190ms ease-in-out infinite alternate;
              }
              .hoo-break-theme-leaf .hoo-leaf-fly > i::after {
                content:"";position:absolute;left:47%;top:7%;width:7%;height:88%;border-radius:99px;
                background:rgba(240,253,244,.62);transform:rotate(-43deg);transform-origin:center;
              }
              .hoo-break-theme-leaf .hoo-leaf-fly-1{--leaf-x:-440%;--leaf-y:-260%;--leaf-turn:-120deg;--leaf-tilt:-18deg;--leaf-delay:0ms;--leaf-color:#4ade80;--leaf-light:#dcfce7;--leaf-dark:#15803d}.hoo-break-theme-leaf .hoo-leaf-fly-2{--leaf-x:-260%;--leaf-y:-470%;--leaf-turn:210deg;--leaf-tilt:22deg;--leaf-delay:55ms;--leaf-color:#a3e635;--leaf-light:#ecfccb;--leaf-dark:#4d7c0f}.hoo-break-theme-leaf .hoo-leaf-fly-3{--leaf-x:-40%;--leaf-y:-520%;--leaf-turn:390deg;--leaf-tilt:-30deg;--leaf-delay:105ms;--leaf-color:#22c55e;--leaf-light:#bbf7d0;--leaf-dark:#166534}.hoo-break-theme-leaf .hoo-leaf-fly-4{--leaf-x:210%;--leaf-y:-440%;--leaf-turn:-280deg;--leaf-tilt:16deg;--leaf-delay:25ms;--leaf-color:#84cc16;--leaf-light:#d9f99d;--leaf-dark:#3f6212}.hoo-break-theme-leaf .hoo-leaf-fly-5{--leaf-x:430%;--leaf-y:-250%;--leaf-turn:240deg;--leaf-tilt:-12deg;--leaf-delay:90ms;--leaf-color:#16a34a;--leaf-light:#86efac;--leaf-dark:#14532d}.hoo-break-theme-leaf .hoo-leaf-fly-6{--leaf-x:500%;--leaf-y:20%;--leaf-turn:460deg;--leaf-tilt:28deg;--leaf-delay:140ms;--leaf-color:#65a30d;--leaf-light:#bef264;--leaf-dark:#365314}.hoo-break-theme-leaf .hoo-leaf-fly-7{--leaf-x:380%;--leaf-y:290%;--leaf-turn:-320deg;--leaf-tilt:-26deg;--leaf-delay:45ms;--leaf-color:#4ade80;--leaf-light:#dcfce7;--leaf-dark:#15803d}.hoo-break-theme-leaf .hoo-leaf-fly-8{--leaf-x:140%;--leaf-y:440%;--leaf-turn:300deg;--leaf-tilt:18deg;--leaf-delay:120ms;--leaf-color:#a3e635;--leaf-light:#ecfccb;--leaf-dark:#4d7c0f}.hoo-break-theme-leaf .hoo-leaf-fly-9{--leaf-x:-120%;--leaf-y:420%;--leaf-turn:510deg;--leaf-tilt:-15deg;--leaf-delay:70ms;--leaf-color:#22c55e;--leaf-light:#bbf7d0;--leaf-dark:#166534}.hoo-break-theme-leaf .hoo-leaf-fly-10{--leaf-x:-350%;--leaf-y:310%;--leaf-turn:-400deg;--leaf-tilt:32deg;--leaf-delay:155ms;--leaf-color:#84cc16;--leaf-light:#d9f99d;--leaf-dark:#3f6212}.hoo-break-theme-leaf .hoo-leaf-fly-11{--leaf-x:-510%;--leaf-y:60%;--leaf-turn:350deg;--leaf-tilt:-22deg;--leaf-delay:95ms;--leaf-color:#16a34a;--leaf-light:#86efac;--leaf-dark:#14532d}.hoo-break-theme-leaf .hoo-leaf-fly-12{--leaf-x:300%;--leaf-y:130%;--leaf-turn:-470deg;--leaf-tilt:12deg;--leaf-delay:180ms;--leaf-color:#65a30d;--leaf-light:#bef264;--leaf-dark:#365314}
              .hoo-break-theme-wind .hoo-break-particle { width: 25%; height: 5%; border-radius: 999px; animation-name: hooWindParticle; }
              .hoo-break-theme-typhoon .hoo-break-particle { border-radius: 999px; animation-name: hooTyphoonParticle; }
              .hoo-break-theme-cyber .hoo-break-particle { clip-path: polygon(0 30%,70% 30%,70% 0,100% 50%,70% 100%,70% 70%,0 70%); }
              .hoo-break-theme-steam .hoo-break-particle { border: 2px solid #fde68a; border-radius: 50%; background: transparent; }
              .hoo-break-theme-heaven .hoo-break-particle { border-radius: 100% 0 100% 0; filter: brightness(1.8); }
              .hoo-break-theme-heaven .hoo-heaven-sanctum {
                display:block;
                background:radial-gradient(circle,rgba(255,255,255,.96) 0 7%,rgba(254,243,199,.72) 17%,rgba(253,224,71,.28) 35%,rgba(186,230,253,.2) 52%,transparent 72%);
                box-shadow:0 0 24px rgba(255,255,255,.95),0 0 54px rgba(253,230,138,.64),0 0 84px rgba(186,230,253,.42);
                animation:hooHeavenSanctum 1040ms ease-out forwards;
              }
              .hoo-break-theme-heaven .hoo-heaven-sanctum::before {
                content:"";position:absolute;inset:-45% -12%;
                background:repeating-conic-gradient(from -5deg,rgba(255,255,255,.84) 0 2deg,transparent 3deg 14deg,rgba(253,230,138,.46) 15deg 17deg,transparent 18deg 30deg);
                mask-image:radial-gradient(circle,transparent 0 19%,#000 25% 66%,transparent 76%);
                animation:hooHeavenSacredRays 980ms ease-out forwards;
              }
              .hoo-break-theme-heaven .hoo-heaven-sanctum::after {
                content:"";position:absolute;left:18%;right:18%;top:-75%;height:190%;
                background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),rgba(255,248,203,.88),rgba(255,255,255,.18),transparent);
                clip-path:polygon(34% 0,66% 0,100% 100%,0 100%);
                filter:blur(5px);
                animation:hooHeavenBeam 920ms ease-out forwards;
              }
              .hoo-break-theme-heaven .hoo-heaven-sanctum > i,
              .hoo-break-theme-heaven .hoo-heaven-sanctum > b {
                position:absolute;left:50%;top:50%;border:2px solid rgba(255,255,255,.9);border-radius:50%;
                box-shadow:0 0 14px #fff,0 0 24px rgba(253,230,138,.8);
              }
              .hoo-break-theme-heaven .hoo-heaven-sanctum > i { inset:17%; animation:hooHeavenHaloOne 900ms ease-out forwards; }
              .hoo-break-theme-heaven .hoo-heaven-sanctum > b { inset:29%; animation:hooHeavenHaloTwo 900ms ease-out forwards; }
              .hoo-break-theme-heaven .hoo-heaven-gate {
                display:block;
                filter:drop-shadow(0 0 9px #fff) drop-shadow(0 0 22px rgba(253,230,138,.82));
                animation:hooHeavenGate 1040ms ease-out forwards;
              }
              .hoo-break-theme-heaven .hoo-heaven-gate::before,
              .hoo-break-theme-heaven .hoo-heaven-gate::after {
                content:"";position:absolute;top:22%;width:53%;height:68%;
                background:
                  repeating-linear-gradient(155deg,rgba(255,255,255,.96) 0 5%,rgba(254,243,199,.74) 6% 9%,transparent 10% 16%),
                  linear-gradient(145deg,rgba(255,255,255,.95),rgba(186,230,253,.42));
                clip-path:polygon(100% 0,72% 7%,46% 22%,17% 54%,0 100%,43% 82%,72% 58%,100% 46%);
                transform-origin:100% 55%;
              }
              .hoo-break-theme-heaven .hoo-heaven-gate::before { right:49%;animation:hooHeavenWingLeft 920ms cubic-bezier(.16,.8,.22,1) forwards; }
              .hoo-break-theme-heaven .hoo-heaven-gate::after { left:49%;transform:scaleX(-1);animation:hooHeavenWingRight 920ms cubic-bezier(.16,.8,.22,1) forwards; }
              .hoo-break-theme-heaven .hoo-heaven-gate > i,
              .hoo-break-theme-heaven .hoo-heaven-gate > b {
                position:absolute;left:50%;top:3%;width:2px;height:94%;transform-origin:center;
                background:linear-gradient(transparent,#fff 16%,#fde68a 48%,#fff 78%,transparent);
                box-shadow:0 0 8px #fff,0 0 20px #fde68a;
              }
              .hoo-break-theme-heaven .hoo-heaven-gate > i { transform:rotate(45deg); }
              .hoo-break-theme-heaven .hoo-heaven-gate > b { transform:rotate(-45deg); }
              .hoo-break-theme-heaven .hoo-heaven-card-ghost {
                border:1px solid rgba(255,255,255,.9);
                background:linear-gradient(145deg,rgba(255,255,255,.86),rgba(254,243,199,.76) 48%,rgba(224,242,254,.7));
                color:#fff;
                box-shadow:inset 0 0 22px #fff,0 0 20px #fff,0 0 48px rgba(253,230,138,.78);
                text-shadow:0 0 12px #fff,0 0 26px #fde68a;
                animation:hooHeavenAscend 1020ms cubic-bezier(.16,.8,.22,1) forwards;
              }
              .hoo-break-theme-heaven .hoo-heaven-sigil {
                width:86%;height:86%;border:1px solid rgba(255,255,255,.88);border-radius:50%;
                transform:translate(-50%,-50%);
                background:conic-gradient(from 0deg,transparent 0 8%,rgba(255,255,255,.9) 9% 10%,transparent 11% 23%,rgba(253,230,138,.9) 24% 25%,transparent 26% 49%,rgba(255,255,255,.88) 50% 51%,transparent 52% 74%,rgba(253,230,138,.9) 75% 76%,transparent 77%);
                box-shadow:inset 0 0 13px rgba(255,255,255,.82),0 0 16px rgba(253,230,138,.72);
                animation:hooHeavenSigil 920ms ease-out forwards;
              }
              .hoo-break-theme-heaven .hoo-heaven-feather {
                display:block;width:14%;height:24%;
                animation:hooHeavenFeatherRise 1080ms cubic-bezier(.16,.72,.22,1) var(--heaven-delay) forwards;
              }
              .hoo-break-theme-heaven .hoo-heaven-feather > i {
                position:absolute;inset:0;border-radius:100% 0 100% 0;
                background:linear-gradient(145deg,#fff 0 28%,#fef3c7 32% 48%,#bae6fd 54% 100%);
                box-shadow:inset 4px 2px 5px #fff,0 0 10px rgba(255,255,255,.9);
                animation:hooHeavenFeatherFlutter 240ms ease-in-out infinite alternate;
              }
              .hoo-break-theme-heaven .hoo-heaven-feather > i::after { content:"";position:absolute;left:49%;top:8%;width:5%;height:86%;border-radius:99px;background:rgba(255,255,255,.88);transform:rotate(-43deg); }
              .hoo-break-theme-heaven .hoo-heaven-feather-1{--heaven-x:-340%;--heaven-y:-430%;--heaven-turn:-180deg;--heaven-delay:0ms}.hoo-break-theme-heaven .hoo-heaven-feather-2{--heaven-x:-120%;--heaven-y:-560%;--heaven-turn:220deg;--heaven-delay:70ms}.hoo-break-theme-heaven .hoo-heaven-feather-3{--heaven-x:120%;--heaven-y:-590%;--heaven-turn:-260deg;--heaven-delay:135ms}.hoo-break-theme-heaven .hoo-heaven-feather-4{--heaven-x:350%;--heaven-y:-450%;--heaven-turn:300deg;--heaven-delay:35ms}.hoo-break-theme-heaven .hoo-heaven-feather-5{--heaven-x:420%;--heaven-y:-160%;--heaven-turn:-340deg;--heaven-delay:110ms}.hoo-break-theme-heaven .hoo-heaven-feather-6{--heaven-x:180%;--heaven-y:-310%;--heaven-turn:270deg;--heaven-delay:175ms}.hoo-break-theme-heaven .hoo-heaven-feather-7{--heaven-x:-190%;--heaven-y:-300%;--heaven-turn:-290deg;--heaven-delay:95ms}.hoo-break-theme-heaven .hoo-heaven-feather-8{--heaven-x:-430%;--heaven-y:-120%;--heaven-turn:330deg;--heaven-delay:150ms}
              .hoo-break-theme-hell .hoo-break-particle { clip-path: polygon(50% 0,100% 100%,50% 78%,0 100%); }
              .hoo-break-theme-ocean .hoo-break-particle { border-radius: 50% 50% 50% 0; }
              .hoo-break-theme-dream .hoo-break-particle {
                border-radius:50%;
                filter:blur(.5px) drop-shadow(0 0 8px currentColor);
                mix-blend-mode:screen;
                animation-name:hooDreamParticle;
              }

              .hoo-break-theme-cyber .hoo-depth-fragment > i {
                border-color:#00f5ff;
                border-radius:1px;
                background:repeating-linear-gradient(90deg,transparent 0 5px,rgba(0,245,255,.55) 6px 7px),linear-gradient(145deg,#10142e,#f000ff);
              }
              .hoo-break-theme-steam .hoo-depth-fragment > i {
                border:2px ridge #fde68a;
                border-radius:50%;
                background:radial-gradient(circle,#2a1608 0 24%,#f59e0b 26% 38%,#78350f 40% 58%,#d97706 60%);
              }
              .hoo-break-theme-heaven .hoo-depth-fragment > i {
                border-radius:90% 8% 90% 8%;
                background:linear-gradient(145deg,#fff,#fef3c7 48%,#bae6fd);
                box-shadow:inset 7px 0 8px #fff,0 0 24px #fff;
              }
              .hoo-break-theme-hell .hoo-depth-fragment > i {
                border-color:#ff8a00;
                clip-path:polygon(50% 0,100% 100%,54% 76%,0 100%);
                background:radial-gradient(circle at 50% 80%,#fff000,#ff3b00 42%,#450a0a 85%);
              }
              .hoo-break-theme-ocean .hoo-depth-fragment > i {
                border-radius:55% 55% 55% 8%;
                background:radial-gradient(circle at 30% 24%,#fff 0 7%,transparent 9%),linear-gradient(145deg,rgba(224,242,254,.95),rgba(14,165,233,.75));
                backdrop-filter:blur(2px);
              }
              .hoo-break-theme-typhoon .hoo-depth-fragment > i {
                border-radius:50% 10% 50% 10%;
                background:linear-gradient(145deg,#f8fafc,#64748b 55%,#0f172a);
              }
              .hoo-break-theme-dream .hoo-depth-fragment > i {
                border-radius:50%;
                background:radial-gradient(circle at 28% 22%,#fff 0 5%,#fbcfe8 12%,#c4b5fd 34%,#7c3aed 66%,#1e1b4b 100%);
                box-shadow:inset -9px -12px 16px rgba(30,27,75,.65),0 0 18px #f0abfc,0 0 38px rgba(99,102,241,.8);
                animation:hooDreamOrbFloat 980ms ease-out forwards;
              }
              .hoo-break-theme-glass .hoo-depth-fragment > i {
                border:1px solid #fff;
                border-radius:0;
                clip-path:polygon(8% 0,100% 24%,72% 100%,0 68%);
                background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(125,211,252,.18) 38%,rgba(255,255,255,.55));
                backdrop-filter:blur(3px);
              }
              .hoo-break-theme-leaf .hoo-depth-fragment > i {
                border-color:#bbf7d0;
                border-radius:100% 0 100% 0;
                background:linear-gradient(135deg,#dcfce7 0 8%,#4ade80 12% 48%,#166534 52% 55%,#a3e635 58%);
              }
              .hoo-break-theme-wind .hoo-depth-fragment {
                width:32%;
                height:8%;
              }
              .hoo-break-theme-wind .hoo-depth-fragment > i {
                border:0;
                border-radius:999px;
                background:linear-gradient(90deg,transparent,#fff 45%,#93c5fd 70%,transparent);
                box-shadow:0 0 18px #fff;
              }

              .hoo-break-theme-cyber .hoo-break-atmosphere::before {
                background: repeating-linear-gradient(0deg, transparent 0 7px, rgba(0,245,255,.5) 8px 9px);
                animation: hooCyberScan 520ms linear forwards;
              }
              .hoo-break-theme-cyber .hoo-break-atmosphere::after {
                background: linear-gradient(90deg, transparent 25%, rgba(255,0,212,.55) 48%, rgba(0,245,255,.65) 52%, transparent 75%);
                animation: hooCyberSlash 720ms ease-out forwards;
              }
              .hoo-break-theme-cyber .hoo-theme-core { border-radius: 4px; transform: translate(-50%,-50%) rotate(45deg); }
              .hoo-break-theme-cyber .hoo-cyber-card-ghost {
                display:flex;
                border:2px solid #00f5ff;
                background:linear-gradient(135deg,rgba(0,245,255,.19),rgba(8,18,44,.88) 45%,rgba(255,0,212,.2));
                box-shadow:inset 0 0 22px rgba(0,245,255,.24),0 0 14px #00f5ff,0 0 28px rgba(255,0,212,.65);
                animation:hooCyberCardGlitch 900ms steps(12,end) forwards;
              }
              .hoo-break-theme-cyber .hoo-cyber-symbol {
                filter:drop-shadow(-3px 0 #ff00d4) drop-shadow(3px 0 #00f5ff);
                animation:hooCyberSymbolSplit 620ms steps(9,end) forwards;
              }
              .hoo-break-theme-cyber .hoo-cyber-grid {
                background-image:linear-gradient(rgba(0,245,255,.2) 1px,transparent 1px),linear-gradient(90deg,rgba(255,0,212,.18) 1px,transparent 1px);
                background-size:12% 12%;
                animation:hooCyberGridShift 540ms linear infinite;
              }
              .hoo-break-theme-cyber .hoo-cyber-scan {
                background:linear-gradient(180deg,transparent,rgba(255,255,255,.9),#00f5ff,transparent);
                box-shadow:0 0 12px #00f5ff;
                animation:hooCyberCardScan 520ms linear forwards;
              }
              .hoo-break-theme-cyber .hoo-cyber-pixel { display:block; }
              .hoo-break-theme-cyber .hoo-depth-fragment { animation-delay:calc(var(--depth-delay) + 150ms); animation-duration:760ms; }

              .hoo-break-theme-steam .hoo-break-atmosphere::before {
                background: repeating-radial-gradient(circle, rgba(255,208,138,.45) 0 3%, transparent 4% 10%);
                filter: blur(10px) sepia(1);
                animation: hooSteamCloud 900ms ease-out forwards;
              }
              .hoo-break-theme-steam .hoo-theme-core { border: 5px dotted #b87333; animation-name: hooSteamGear; }
              .hoo-break-theme-steam .hoo-theme-motif { color:#fbbf24; animation-name: hooGearFly; }
              .hoo-break-theme-steam .hoo-steam-card-ghost {
                display:flex;
                border:3px ridge #fbbf24;
                background:
                  radial-gradient(circle at 18% 16%,rgba(255,255,255,.5) 0 3%,transparent 4%),
                  linear-gradient(145deg,#7c2d12,#d97706 42%,#78350f 72%,#2a1608);
                box-shadow:inset 5px 5px 9px rgba(253,230,138,.55),inset -8px -10px 14px rgba(42,22,8,.72),0 8px 18px rgba(0,0,0,.62),0 0 12px rgba(245,158,11,.55);
                animation:hooSteamCardPressure 980ms ease-out forwards;
              }
              .hoo-break-theme-steam .hoo-steam-gauge {
                border:2px solid #fde68a;
                background:radial-gradient(circle,#fff7ed 0 55%,#92400e 58% 68%,#2a1608 70%);
                box-shadow:inset 0 0 5px #78350f,0 2px 5px #1c0a02;
              }
              .hoo-break-theme-steam .hoo-steam-needle { background:#dc2626; animation:hooSteamNeedle 540ms cubic-bezier(.2,.8,.2,1) forwards; }
              .hoo-break-theme-steam .hoo-steam-rivet { background:radial-gradient(circle at 35% 30%,#fff7ed,#b45309 45%,#431407); box-shadow:0 2px 3px #1c0a02; }
              .hoo-break-theme-steam .hoo-steam-rivet-1{left:4%;top:4%}.hoo-break-theme-steam .hoo-steam-rivet-2{right:4%;top:4%}.hoo-break-theme-steam .hoo-steam-rivet-3{left:4%;bottom:4%}.hoo-break-theme-steam .hoo-steam-rivet-4{right:4%;bottom:4%}
              .hoo-break-theme-steam .hoo-steam-puff {
                display:block;
                width:28%;height:28%;
                background:radial-gradient(circle,rgba(255,247,237,.9),rgba(214,211,209,.62) 45%,transparent 72%);
                filter:blur(2px) drop-shadow(0 0 5px rgba(255,247,237,.65));
                animation:hooSteamPuff 900ms ease-out var(--steam-delay) forwards;
              }
              .hoo-break-theme-steam .hoo-steam-puff-1{--steam-x:-310%;--steam-y:-250%;--steam-delay:180ms}.hoo-break-theme-steam .hoo-steam-puff-2{--steam-x:20%;--steam-y:-350%;--steam-delay:230ms}.hoo-break-theme-steam .hoo-steam-puff-3{--steam-x:320%;--steam-y:-210%;--steam-delay:195ms}
              .hoo-break-theme-steam .hoo-steam-puff-4{--steam-x:340%;--steam-y:170%;--steam-delay:260ms}.hoo-break-theme-steam .hoo-steam-puff-5{--steam-x:-30%;--steam-y:330%;--steam-delay:215ms}.hoo-break-theme-steam .hoo-steam-puff-6{--steam-x:-330%;--steam-y:150%;--steam-delay:245ms}
              .hoo-break-theme-steam .hoo-steam-gear {
                display:flex;
                width:30%;height:30%;
                color:#f59e0b;
                font-size:clamp(18px,3.5vw,42px);
                text-shadow:0 3px 3px #1c0a02,0 0 7px #fde68a;
                animation:hooSteamGearBurst 920ms cubic-bezier(.12,.72,.2,1) var(--gear-delay) forwards;
              }
              .hoo-break-theme-steam .hoo-steam-gear-1{--gear-x:-300%;--gear-y:-230%;--gear-spin:620deg;--gear-delay:210ms}.hoo-break-theme-steam .hoo-steam-gear-2{--gear-x:310%;--gear-y:-190%;--gear-spin:-540deg;--gear-delay:245ms}.hoo-break-theme-steam .hoo-steam-gear-3{--gear-x:260%;--gear-y:260%;--gear-spin:720deg;--gear-delay:230ms}.hoo-break-theme-steam .hoo-steam-gear-4{--gear-x:-280%;--gear-y:250%;--gear-spin:-680deg;--gear-delay:270ms}
              .hoo-break-theme-steam .hoo-depth-fragment { animation-delay:calc(var(--depth-delay) + 190ms);animation-duration:790ms; }

              .hoo-break-theme-heaven .hoo-break-atmosphere::before {
                background: repeating-conic-gradient(from 0deg, rgba(255,255,255,.72) 0 3deg, transparent 3deg 18deg);
                animation: hooHeavenRays 900ms ease-out forwards;
              }
              .hoo-break-theme-heaven .hoo-break-atmosphere::after {
                background: radial-gradient(ellipse at center, rgba(255,255,255,.95), rgba(253,230,138,.28) 30%, transparent 65%);
              }
              .hoo-break-theme-heaven .hoo-theme-motif { animation-name: hooHeavenRise; }

              .hoo-break-theme-hell .hoo-break-atmosphere::before {
                background: radial-gradient(ellipse at bottom, rgba(255,240,0,.9), rgba(255,45,0,.65) 22%, rgba(127,29,29,.4) 48%, transparent 72%);
                animation: hooHellBurst 820ms ease-out forwards;
              }
              .hoo-break-theme-hell .hoo-break-atmosphere::after {
                background: repeating-linear-gradient(72deg, transparent 0 8%, rgba(255,61,0,.4) 9% 11%, transparent 12% 18%);
                animation: hooHellHeat 300ms linear infinite;
              }
              .hoo-break-theme-hell .hoo-theme-motif { animation-name: hooHellFlame; }
              .hoo-break-theme-hell .hoo-hell-card-ghost {
                display:flex;
                border:2px solid #ff8a00;
                background:linear-gradient(145deg,#5b1608,#c2410c 42%,#7f1d1d 72%,#240503);
                box-shadow:inset 0 0 18px rgba(255,176,0,.42),0 0 14px #ff2d00,0 12px 22px rgba(0,0,0,.72);
                animation:hooHellCardBurn 1040ms ease-out forwards;
              }
              .hoo-break-theme-hell .hoo-hell-char {
                background:
                  radial-gradient(circle at 25% 82%,#000 0 12%,transparent 28%),
                  radial-gradient(circle at 72% 70%,#120302 0 15%,transparent 34%),
                  linear-gradient(0deg,#050101,#1c0503 58%,transparent 82%);
                mix-blend-mode:multiply;
                animation:hooHellCharSpread 900ms ease-in forwards;
              }
              .hoo-break-theme-hell .hoo-hell-symbol { animation:hooHellSymbolScorch 900ms ease-in forwards; }
              .hoo-break-theme-hell .hoo-hell-backglow {
                display:block;
                background:radial-gradient(circle at 50% 55%,rgba(255,232,150,.82) 0 9%,rgba(255,132,0,.72) 23%,rgba(239,36,0,.6) 42%,rgba(142,13,13,.4) 61%,transparent 76%);
                box-shadow:0 0 18px rgba(255,112,0,.94),0 0 42px rgba(220,38,38,.8),0 0 76px rgba(127,29,29,.62),inset 0 0 24px rgba(255,190,40,.4);
                filter:blur(3px);
                transform-origin:center;
                animation:hooHellBackglow 980ms ease-in-out forwards;
              }
              .hoo-break-theme-hell .hoo-hell-backglow::before {
                content:"";
                position:absolute;inset:12%;
                border-radius:35%;
                background:radial-gradient(circle,rgba(255,232,150,.72),rgba(255,61,0,.4) 48%,transparent 72%);
                filter:blur(6px);
                animation:hooHellHeatPulse 260ms ease-in-out infinite alternate;
              }
              .hoo-break-theme-hell .hoo-hell-backglow::after {
                content:"";
                position:absolute;inset:-8%;
                border:2px solid rgba(255,61,0,.36);
                border-radius:38%;
                box-shadow:0 0 18px rgba(255,45,0,.66);
                animation:hooHellHeatRing 700ms ease-out forwards;
              }
              .hoo-break-theme-hell .hoo-hell-ash {
                display:block;
                width:var(--ash-size,6%);height:var(--ash-size,6%);
                clip-path:polygon(12% 5%,86% 0,100% 68%,68% 100%,3% 82%);
                background:linear-gradient(145deg,#57534e,#18181b 58%,#050505);
                box-shadow:0 0 3px rgba(255,90,0,.38);
                animation:hooHellAshDrift 680ms cubic-bezier(.18,.62,.2,1) var(--ash-delay) forwards;
              }
              .hoo-break-theme-hell .hoo-hell-ash-1{--ash-x:-390%;--ash-y:-210%;--ash-delay:380ms;--ash-size:8%}.hoo-break-theme-hell .hoo-hell-ash-2{--ash-x:-260%;--ash-y:-360%;--ash-delay:420ms;--ash-size:5%}.hoo-break-theme-hell .hoo-hell-ash-3{--ash-x:-120%;--ash-y:-430%;--ash-delay:350ms;--ash-size:7%}
              .hoo-break-theme-hell .hoo-hell-ash-4{--ash-x:20%;--ash-y:-470%;--ash-delay:455ms;--ash-size:4%}.hoo-break-theme-hell .hoo-hell-ash-5{--ash-x:170%;--ash-y:-410%;--ash-delay:395ms;--ash-size:8%}.hoo-break-theme-hell .hoo-hell-ash-6{--ash-x:330%;--ash-y:-300%;--ash-delay:440ms;--ash-size:5%}
              .hoo-break-theme-hell .hoo-hell-ash-7{--ash-x:410%;--ash-y:-120%;--ash-delay:370ms;--ash-size:7%}.hoo-break-theme-hell .hoo-hell-ash-8{--ash-x:360%;--ash-y:90%;--ash-delay:475ms;--ash-size:4%}.hoo-break-theme-hell .hoo-hell-ash-9{--ash-x:230%;--ash-y:240%;--ash-delay:410ms;--ash-size:6%}
              .hoo-break-theme-hell .hoo-hell-ash-10{--ash-x:70%;--ash-y:320%;--ash-delay:450ms;--ash-size:5%}.hoo-break-theme-hell .hoo-hell-ash-11{--ash-x:-90%;--ash-y:300%;--ash-delay:385ms;--ash-size:8%}.hoo-break-theme-hell .hoo-hell-ash-12{--ash-x:-250%;--ash-y:230%;--ash-delay:465ms;--ash-size:4%}
              .hoo-break-theme-hell .hoo-hell-ash-13{--ash-x:-380%;--ash-y:80%;--ash-delay:405ms;--ash-size:6%}.hoo-break-theme-hell .hoo-hell-ash-14{--ash-x:-320%;--ash-y:-90%;--ash-delay:435ms;--ash-size:5%}.hoo-break-theme-hell .hoo-hell-ash-15{--ash-x:280%;--ash-y:-190%;--ash-delay:360ms;--ash-size:7%}
              .hoo-break-theme-hell .hoo-hell-ash-16{--ash-x:130%;--ash-y:-520%;--ash-delay:485ms;--ash-size:4%}.hoo-break-theme-hell .hoo-hell-ash-17{--ash-x:-190%;--ash-y:-500%;--ash-delay:400ms;--ash-size:6%}.hoo-break-theme-hell .hoo-hell-ash-18{--ash-x:390%;--ash-y:180%;--ash-delay:460ms;--ash-size:5%}
              .hoo-break-theme-hell .hoo-hell-ember {
                display:block;
                width:6%;height:6%;
                background:#ffd000;
                box-shadow:0 0 6px #fff3a3,0 0 12px #ff2d00;
                animation:hooHellEmberRise 920ms ease-out var(--ember-delay) forwards;
              }
              .hoo-break-theme-hell .hoo-hell-ember-1{--ember-x:-360%;--ember-y:-420%;--ember-delay:80ms}.hoo-break-theme-hell .hoo-hell-ember-2{--ember-x:-210%;--ember-y:-520%;--ember-delay:150ms}.hoo-break-theme-hell .hoo-hell-ember-3{--ember-x:-60%;--ember-y:-460%;--ember-delay:30ms}
              .hoo-break-theme-hell .hoo-hell-ember-4{--ember-x:90%;--ember-y:-560%;--ember-delay:180ms}.hoo-break-theme-hell .hoo-hell-ember-5{--ember-x:230%;--ember-y:-480%;--ember-delay:100ms}.hoo-break-theme-hell .hoo-hell-ember-6{--ember-x:370%;--ember-y:-420%;--ember-delay:210ms}
              .hoo-break-theme-hell .hoo-hell-ember-7{--ember-x:-300%;--ember-y:-350%;--ember-delay:240ms}.hoo-break-theme-hell .hoo-hell-ember-8{--ember-x:-140%;--ember-y:-620%;--ember-delay:130ms}.hoo-break-theme-hell .hoo-hell-ember-9{--ember-x:20%;--ember-y:-600%;--ember-delay:260ms}
              .hoo-break-theme-hell .hoo-hell-ember-10{--ember-x:160%;--ember-y:-500%;--ember-delay:60ms}.hoo-break-theme-hell .hoo-hell-ember-11{--ember-x:310%;--ember-y:-580%;--ember-delay:200ms}.hoo-break-theme-hell .hoo-hell-ember-12{--ember-x:-390%;--ember-y:-470%;--ember-delay:170ms}
              .hoo-break-theme-hell .hoo-hell-ember-13{--ember-x:400%;--ember-y:-360%;--ember-delay:120ms}.hoo-break-theme-hell .hoo-hell-ember-14{--ember-x:0%;--ember-y:-680%;--ember-delay:225ms}
              .hoo-break-theme-hell .hoo-break-atmosphere,
              .hoo-break-theme-hell .hoo-break-impact,
              .hoo-break-theme-hell .hoo-theme-core,
              .hoo-break-theme-hell .hoo-theme-motif,
              .hoo-break-theme-hell .hoo-depth-fragment,
              .hoo-break-theme-hell .hoo-break-particle,
              .hoo-break-theme-hell .hoo-break-ring,
              .hoo-break-theme-hell .hoo-break-flash { display:none !important; }

              .hoo-break-theme-ocean .hoo-break-atmosphere::before {
                inset:auto;
                left:-78%;
                top:4%;
                width:78%;
                height:94%;
                border-radius:8% 58% 48% 8%;
                background:
                  radial-gradient(ellipse at 93% 17%,transparent 0 20%,rgba(255,255,255,.96) 21% 26%,rgba(186,230,253,.82) 27% 32%,transparent 34%),
                  radial-gradient(ellipse at 76% 42%,rgba(255,255,255,.88) 0 7%,transparent 9%),
                  linear-gradient(105deg,rgba(3,105,161,.18),rgba(14,165,233,.82) 50%,rgba(34,211,238,.9) 78%,rgba(224,242,254,.95));
                box-shadow:20px 0 34px rgba(56,189,248,.75),inset -18px 0 22px rgba(255,255,255,.52);
                filter:drop-shadow(0 15px 12px rgba(2,132,199,.65));
                animation: hooOceanSweep 960ms cubic-bezier(.18,.72,.12,1) forwards;
              }
              .hoo-break-theme-ocean .hoo-break-atmosphere::after {
                inset:-10% -55%;
                background:repeating-radial-gradient(circle,rgba(255,255,255,.95) 0 3px,transparent 4px 17px);
                background-size:38px 31px;
                filter:blur(.4px) drop-shadow(0 0 5px #7dd3fc);
                animation:hooOceanFoam 980ms ease-out forwards;
              }
              .hoo-break-theme-ocean .hoo-break-atmosphere { z-index:30; overflow:visible; }
              .hoo-break-theme-ocean .hoo-ocean-tile-ghost {
                display:flex;
                border:2px solid rgba(224,242,254,.85);
                background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(56,189,248,.68));
                box-shadow:inset 0 0 18px rgba(255,255,255,.8),0 10px 24px rgba(2,132,199,.7);
                animation:hooOceanTileCarry 980ms cubic-bezier(.2,.72,.18,1) forwards;
              }
              .hoo-break-theme-ocean .hoo-theme-motif { border:2px solid #e0f2fe; border-radius:50%; font-size:0; animation-name: hooBubbleFly; }

              .hoo-break-theme-ocean .hoo-break-atmosphere,
              .hoo-break-theme-ocean .hoo-break-impact,
              .hoo-break-theme-ocean .hoo-theme-core,
              .hoo-break-theme-ocean .hoo-theme-motif,
              .hoo-break-theme-ocean .hoo-depth-fragment,
              .hoo-break-theme-ocean .hoo-break-particle,
              .hoo-break-theme-ocean .hoo-break-ring,
              .hoo-break-theme-ocean .hoo-break-flash {
                display:none !important;
              }

              .hoo-ocean-current-base,
              .hoo-ocean-current-water {
                stroke-dasharray:1;
                stroke-dashoffset:1;
                animation:hooOceanCurrentFill 920ms cubic-bezier(.16,.72,.18,1) forwards;
              }
              .hoo-ocean-current-base {
                filter:drop-shadow(0 0 .14px #075985) drop-shadow(0 0 .28px #0ea5e9);
              }
              .hoo-ocean-current-water {
                animation-delay:35ms;
                filter:drop-shadow(0 0 .12px #7dd3fc);
              }
              .hoo-ocean-current-foam {
                stroke-dasharray:.075 .085;
                stroke-dashoffset:.9;
                animation:hooOceanFoamFlow 960ms linear forwards;
                filter:drop-shadow(0 0 .1px #fff) drop-shadow(0 0 .2px #bae6fd);
              }
              .hoo-ocean-current-glint {
                stroke-dasharray:.018 .12;
                stroke-dashoffset:.65;
                animation:hooOceanGlintFlow 880ms linear forwards;
                filter:drop-shadow(0 0 .12px #fff);
              }

              .hoo-break-theme-typhoon .hoo-break-atmosphere::before {
                background: repeating-conic-gradient(from 0deg, transparent 0 14deg, rgba(203,213,225,.6) 15deg 19deg, transparent 20deg 38deg);
                border-radius:50%;
                animation: hooTyphoonSpin 820ms cubic-bezier(.2,.8,.2,1) forwards;
              }
              .hoo-break-theme-typhoon .hoo-break-atmosphere::after {
                background: radial-gradient(circle, transparent 0 8%, rgba(255,255,255,.75) 10%, transparent 28%);
                animation: hooTyphoonEye 720ms ease-out forwards;
              }

              .hoo-break-theme-dream .hoo-break-atmosphere::before {
                inset:-18%;
                background:
                  radial-gradient(circle at 20% 30%,#fff 0 2px,transparent 3px),radial-gradient(circle at 72% 22%,#fde68a 0 3px,transparent 4px),radial-gradient(circle at 62% 70%,#f9a8d4 0 3px,transparent 4px),radial-gradient(circle at 35% 78%,#c4b5fd 0 2px,transparent 3px),
                  conic-gradient(from 45deg at 50% 50%,transparent,rgba(168,85,247,.24),transparent 34%,rgba(59,130,246,.2),transparent 70%);
                background-size:90px 80px,110px 96px,125px 105px,105px 95px,100% 100%;
                filter:blur(.2px) drop-shadow(0 0 9px rgba(216,180,254,.9));
                animation:hooDreamDrift 1080ms cubic-bezier(.16,.8,.22,1) forwards;
              }
              .hoo-break-theme-dream .hoo-break-atmosphere::after {
                inset:-5%;
                background:radial-gradient(ellipse at 50% 54%,rgba(255,255,255,.38) 0 7%,rgba(240,171,252,.38) 18%,rgba(139,92,246,.34) 36%,rgba(30,27,75,.12) 58%,transparent 72%);
                filter:blur(10px) saturate(1.35);
                animation:hooDreamNebula 1050ms ease-out forwards;
              }
              .hoo-break-theme-dream .hoo-theme-motif { animation-name: hooDreamStar; }
              .hoo-break-theme-dream .hoo-dream-card-ghost {
                display:flex;
                border:1px solid rgba(233,213,255,.75);
                background:linear-gradient(145deg,rgba(49,46,129,.78),rgba(126,34,206,.6) 46%,rgba(30,27,75,.82));
                box-shadow:inset 0 0 24px rgba(255,255,255,.24),0 0 20px rgba(232,121,249,.75),0 0 46px rgba(99,102,241,.7);
                animation:hooDreamCardDissolve 1020ms cubic-bezier(.16,.8,.22,1) forwards;
              }
              .hoo-break-theme-dream .hoo-dream-symbol {
                filter:drop-shadow(0 0 10px #fff) drop-shadow(0 0 22px #f0abfc);
                animation:hooDreamSymbolEcho 980ms ease-out forwards;
              }
              .hoo-break-theme-dream .hoo-dream-portal {
                background:conic-gradient(from 0deg,transparent,rgba(216,180,254,.72),transparent 25%,rgba(147,197,253,.62),transparent 52%,rgba(249,168,212,.64),transparent 78%);
                filter:blur(7px);
                mix-blend-mode:screen;
                animation:hooDreamPortal 980ms ease-out forwards;
              }
              .hoo-break-theme-dream .hoo-dream-halo {
                border:1px solid rgba(255,255,255,.5);
                box-shadow:0 0 14px rgba(216,180,254,.85),inset 0 0 13px rgba(147,197,253,.45);
              }
              .hoo-break-theme-dream .hoo-dream-halo-one { animation:hooDreamHaloOne 920ms ease-out forwards; }
              .hoo-break-theme-dream .hoo-dream-halo-two { animation:hooDreamHaloTwo 920ms ease-out forwards; }
              .hoo-break-theme-dream .hoo-dream-wisp {
                display:block;
                width:14%;height:7%;
                background:linear-gradient(90deg,transparent,rgba(255,255,255,.92),rgba(240,171,252,.72),transparent);
                box-shadow:0 0 12px rgba(216,180,254,.9);
                filter:blur(2px);
                animation:hooDreamWisp 980ms cubic-bezier(.18,.7,.2,1) var(--dream-delay) forwards;
              }
              .hoo-break-theme-dream .hoo-dream-wisp-1{--dream-x:-360%;--dream-y:-240%;--dream-rotate:-28deg;--dream-delay:30ms}.hoo-break-theme-dream .hoo-dream-wisp-2{--dream-x:-180%;--dream-y:-430%;--dream-rotate:18deg;--dream-delay:120ms}.hoo-break-theme-dream .hoo-dream-wisp-3{--dream-x:40%;--dream-y:-480%;--dream-rotate:62deg;--dream-delay:70ms}.hoo-break-theme-dream .hoo-dream-wisp-4{--dream-x:260%;--dream-y:-330%;--dream-rotate:118deg;--dream-delay:160ms}.hoo-break-theme-dream .hoo-dream-wisp-5{--dream-x:400%;--dream-y:-80%;--dream-rotate:155deg;--dream-delay:50ms}.hoo-break-theme-dream .hoo-dream-wisp-6{--dream-x:340%;--dream-y:230%;--dream-rotate:205deg;--dream-delay:135ms}.hoo-break-theme-dream .hoo-dream-wisp-7{--dream-x:100%;--dream-y:390%;--dream-rotate:248deg;--dream-delay:90ms}.hoo-break-theme-dream .hoo-dream-wisp-8{--dream-x:-150%;--dream-y:370%;--dream-rotate:292deg;--dream-delay:180ms}.hoo-break-theme-dream .hoo-dream-wisp-9{--dream-x:-390%;--dream-y:150%;--dream-rotate:330deg;--dream-delay:105ms}.hoo-break-theme-dream .hoo-dream-wisp-10{--dream-x:220%;--dream-y:90%;--dream-rotate:42deg;--dream-delay:210ms}

              .hoo-break-theme-glass .hoo-break-atmosphere::before {
                background: repeating-conic-gradient(from 12deg, transparent 0 10deg, rgba(224,242,254,.75) 11deg 12deg, transparent 13deg 27deg);
                animation: hooGlassCrack 780ms ease-out forwards;
              }
              .hoo-break-theme-glass .hoo-theme-core { border-radius:0; clip-path:polygon(50% 0,100% 35%,82% 100%,18% 100%,0 35%); }
              .hoo-break-theme-glass .hoo-theme-motif { animation-name: hooGlassMotif; }
              .hoo-break-theme-glass .hoo-glass-card-ghost {
                display:flex;
                border:2px solid rgba(255,255,255,.92);
                background:
                  linear-gradient(135deg,rgba(255,255,255,.82),rgba(186,230,253,.34) 42%,rgba(125,211,252,.16)),
                  rgba(224,242,254,.3);
                box-shadow:
                  inset 8px 7px 13px rgba(255,255,255,.76),
                  inset -10px -12px 16px rgba(14,165,233,.22),
                  0 8px 20px rgba(2,132,199,.45),
                  0 0 15px rgba(255,255,255,.8);
                backdrop-filter:blur(4px);
                animation:hooGlassCardBreak 980ms ease-out forwards;
              }
              .hoo-break-theme-glass .hoo-depth-fragment {
                animation-duration:760ms;
                animation-delay:calc(var(--depth-delay) + 245ms);
              }
              .hoo-break-theme-glass .hoo-break-atmosphere,
              .hoo-break-theme-glass .hoo-break-impact,
              .hoo-break-theme-glass .hoo-theme-core,
              .hoo-break-theme-glass .hoo-theme-motif,
              .hoo-break-theme-glass .hoo-break-particle,
              .hoo-break-theme-glass .hoo-break-ring,
              .hoo-break-theme-glass .hoo-break-flash {
                display:none !important;
              }

              .hoo-break-theme-leaf .hoo-break-atmosphere::before {
                background: linear-gradient(115deg,transparent 25%,rgba(74,222,128,.38) 45%,rgba(163,230,53,.45) 55%,transparent 75%);
                animation: hooLeafGust 860ms ease-out forwards;
              }
              .hoo-break-theme-leaf .hoo-theme-motif { animation-name: hooLeafMotif; }

              .hoo-break-theme-wind .hoo-break-atmosphere::before {
                background: repeating-linear-gradient(168deg,transparent 0 10%,rgba(255,255,255,.65) 11% 12%,transparent 13% 20%);
                animation: hooWindSweep 720ms ease-out forwards;
              }
              .hoo-break-theme-wind .hoo-break-atmosphere::after {
                background:linear-gradient(90deg,transparent,rgba(147,197,253,.7),transparent);
                animation:hooWindFlash 600ms ease-out forwards;
              }
              .hoo-break-theme-wind .hoo-theme-motif { animation-name: hooWindMotif; }

              .hoo-effect-variant-1 .hoo-depth-fragment { animation-name: hooDepthSpiral; }
              .hoo-effect-variant-1 .hoo-break-particle { animation-name: hooParticleSpiral; }
              .hoo-effect-variant-1 .hoo-theme-motif { animation-name: hooMotifOrbit; }
              .hoo-effect-variant-1 .hoo-theme-core { animation-name: hooCoreVortex; }
              .hoo-effect-variant-1 .hoo-break-impact { animation-name: hooImpactTwist; }

              .hoo-effect-variant-2 .hoo-depth-fragment { animation-name: hooDepthImplode; }
              .hoo-effect-variant-2 .hoo-break-particle { animation-name: hooParticleShockwave; }
              .hoo-effect-variant-2 .hoo-theme-motif { animation-name: hooMotifRebound; }
              .hoo-effect-variant-2 .hoo-theme-core { animation-name: hooCoreImplode; }
              .hoo-effect-variant-2 .hoo-break-ring { animation-name: hooRingPulse; }
              .hoo-effect-variant-2 .hoo-break-atmosphere { animation-name: hooAtmosphereFlash; }

              @keyframes hooAtmosphereFade { 0%{opacity:0} 12%{opacity:1} 100%{opacity:0} }
              @keyframes hooDepthFragment {
                0% {
                  opacity:0;
                  transform:translate3d(-50%,-50%,-70px) scale(.08) rotateX(0) rotateY(0) rotateZ(0);
                  filter:drop-shadow(0 1px 1px rgba(0,0,0,0));
                }
                16% {
                  opacity:1;
                  transform:translate3d(-50%,-50%,35px) scale(1.15) rotateX(35deg) rotateY(28deg) rotateZ(12deg);
                }
                58% { opacity:1; }
                100% {
                  opacity:0;
                  transform:translate3d(calc(-50% + var(--depth-x)),calc(-50% + var(--depth-y)),var(--depth-z)) scale(.62) rotateX(var(--depth-rx)) rotateY(var(--depth-ry)) rotateZ(240deg);
                  filter:drop-shadow(0 22px 9px rgba(0,0,0,.75));
                }
              }
              @keyframes hooDepthSpiral {
                0% { opacity:0; transform:translate3d(-50%,-50%,-120px) scale(.1) rotateX(0) rotateY(0); }
                18% { opacity:1; transform:translate3d(-50%,-50%,70px) scale(1.2) rotateX(70deg) rotateY(90deg); }
                52% { opacity:1; transform:translate3d(calc(-50% + var(--depth-y)),calc(-50% - 180%),90px) scale(.9) rotateX(240deg) rotateY(360deg) rotateZ(210deg); }
                100% { opacity:0; transform:translate3d(calc(-50% + var(--depth-x)),calc(-50% + var(--depth-y)),var(--depth-z)) scale(.45) rotateX(var(--depth-rx)) rotateY(var(--depth-ry)) rotateZ(760deg); }
              }
              @keyframes hooDepthImplode {
                0% { opacity:0; transform:translate3d(calc(-50% + var(--depth-x)),calc(-50% + var(--depth-y)),-160px) scale(1.4) rotateX(var(--depth-rx)) rotateY(var(--depth-ry)); }
                28% { opacity:1; }
                48% { opacity:1; transform:translate3d(-50%,-50%,90px) scale(.12) rotateX(0) rotateY(0); }
                62% { opacity:1; transform:translate3d(-50%,-50%,240px) scale(1.55) rotateX(120deg) rotateY(160deg); }
                100% { opacity:0; transform:translate3d(calc(-50% + var(--depth-x)),calc(-50% + var(--depth-y)),var(--depth-z)) scale(.35) rotateX(var(--depth-rx)) rotateY(var(--depth-ry)); }
              }
              @keyframes hooParticleSpiral {
                0% { opacity:1; transform:translate(-50%,-50%) scale(.25) rotate(0); }
                45% { opacity:1; transform:translate(calc(-50% + var(--break-y)),calc(-50% - 220%)) scale(1.25) rotate(420deg); }
                100% { opacity:0; transform:translate(calc(-50% + var(--break-x)),calc(-50% + var(--break-y))) scale(.12) rotate(920deg); }
              }
              @keyframes hooParticleShockwave {
                0% { opacity:0; transform:translate(calc(-50% + var(--break-x)),calc(-50% + var(--break-y))) scale(.2) rotate(180deg); }
                32% { opacity:1; transform:translate(-50%,-50%) scale(.05) rotate(0); }
                52% { opacity:1; transform:translate(-50%,-50%) scale(1.8) rotate(90deg); }
                100% { opacity:0; transform:translate(calc(-50% + var(--break-x)),calc(-50% + var(--break-y))) scale(.18) rotate(420deg); }
              }
              @keyframes hooMotifOrbit {
                0% { opacity:0; transform:translate(-50%,-50%) scale(.1) rotate(0); }
                28% { opacity:1; transform:translate(calc(-50% + var(--motif-y)),calc(-50% - 140%)) scale(1.3) rotate(180deg); }
                100% { opacity:0; transform:translate(calc(-50% + var(--motif-x)),calc(-50% + var(--motif-y))) scale(.5) rotate(760deg); }
              }
              @keyframes hooMotifRebound {
                0% { opacity:0; transform:translate(calc(-50% + var(--motif-x)),calc(-50% + var(--motif-y))) scale(.2); }
                38% { opacity:1; transform:translate(-50%,-50%) scale(.1); }
                58% { opacity:1; transform:translate(-50%,-50%) scale(1.9); }
                100% { opacity:0; transform:translate(calc(-50% + var(--motif-x)),calc(-50% + var(--motif-y))) scale(.65) rotate(320deg); }
              }
              @keyframes hooCoreVortex { 0%{opacity:0;transform:translate(-50%,-50%) scale(2.8) rotate(0)} 40%{opacity:1;transform:translate(-50%,-50%) scale(.25) rotate(460deg)} 100%{opacity:0;transform:translate(-50%,-50%) scale(3.4) rotate(920deg)} }
              @keyframes hooCoreImplode { 0%{opacity:0;transform:translate(-50%,-50%) scale(3.5)} 42%{opacity:1;transform:translate(-50%,-50%) scale(.08)} 58%{opacity:1;transform:translate(-50%,-50%) scale(2.2)} 100%{opacity:0;transform:translate(-50%,-50%) scale(4)} }
              @keyframes hooImpactTwist { 0%{opacity:0;transform:scale(.3) rotate(-35deg)} 30%{opacity:.9;transform:scale(1) rotate(20deg)} 100%{opacity:0;transform:scale(1.25) rotate(70deg)} }
              @keyframes hooRingPulse { 0%{opacity:0;transform:translate(-50%,-50%) scale(3)} 42%{opacity:1;transform:translate(-50%,-50%) scale(.18)} 62%{opacity:1;transform:translate(-50%,-50%) scale(1.4)} 100%{opacity:0;transform:translate(-50%,-50%) scale(5)} }
              @keyframes hooAtmosphereFlash { 0%{opacity:0;filter:brightness(1)} 40%{opacity:.2} 50%{opacity:1;filter:brightness(3.5)} 100%{opacity:0;filter:brightness(1)} }
              @keyframes hooThemeCore { 0%{opacity:1;transform:translate(-50%,-50%) scale(.1) rotate(0)} 45%{opacity:.9;transform:translate(-50%,-50%) scale(1.8) rotate(90deg)} 100%{opacity:0;transform:translate(-50%,-50%) scale(3) rotate(180deg)} }
              @keyframes hooThemeMotif { 0%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(0)} 20%{opacity:1} 100%{opacity:0;transform:translate(calc(-50% + var(--motif-x)),calc(-50% + var(--motif-y))) scale(1.2) rotate(300deg)} }
              @keyframes hooCyberScan { 0%{opacity:0;transform:translateY(-35%)} 30%{opacity:1} 100%{opacity:0;transform:translateY(35%)} }
              @keyframes hooCyberSlash { 0%{opacity:0;transform:translateX(-70%) skewX(-18deg)} 30%{opacity:1} 100%{opacity:0;transform:translateX(70%) skewX(-18deg)} }
              @keyframes hooCyberLinkBuild { 0%{opacity:0;stroke-dashoffset:1} 18%{opacity:1} 62%{stroke-dashoffset:0} 100%{opacity:0;stroke-dashoffset:-.12} }
              @keyframes hooCyberCurrent { 0%{opacity:0;stroke-dashoffset:.8} 18%{opacity:1} 78%{opacity:1} 100%{opacity:0;stroke-dashoffset:-.55} }
              @keyframes hooCyberCurrentReverse { 0%{opacity:0;stroke-dashoffset:-.65} 22%{opacity:1} 76%{opacity:1} 100%{opacity:0;stroke-dashoffset:.6} }
              @keyframes hooCyberPulse { 0%{opacity:0;stroke-dashoffset:.55} 28%{opacity:1} 100%{opacity:0;stroke-dashoffset:-.85} }
              @keyframes hooCyberCardGlitch {
                0%{opacity:1;transform:translate(0,0) skewX(0);clip-path:inset(0)}
                18%{transform:translate(-2px,1px) skewX(2deg);clip-path:inset(8% 0 0)}
                31%{transform:translate(3px,-1px) skewX(-3deg);clip-path:inset(0 0 14%)}
                46%{opacity:1;transform:translate(-4px,0) scaleX(1.04);clip-path:inset(28% 0 20%)}
                62%{opacity:.8;transform:translate(5px,0) scaleY(.86);clip-path:inset(42% 0 35%)}
                78%{opacity:.45;transform:translate(-7px,0) scaleX(1.18);clip-path:inset(48% 0 44%)}
                100%{opacity:0;transform:translate(12px,0) scaleX(.2);clip-path:inset(50% 0)}
              }
              @keyframes hooCyberSymbolSplit { 0%{opacity:1;transform:translateX(0)} 35%{transform:translateX(-3px) scaleX(1.08)} 55%{transform:translateX(4px) scaleX(.94)} 100%{opacity:0;transform:translateX(12px) scaleX(.25)} }
              @keyframes hooCyberGridShift { 0%{background-position:0 0} 100%{background-position:12% 24%} }
              @keyframes hooCyberCardScan { 0%{opacity:0;transform:translateY(-120%)} 18%{opacity:1} 82%{opacity:1} 100%{opacity:0;transform:translateY(620%)} }
              @keyframes hooCyberPixelBurst { 0%{display:block;opacity:0;transform:translate(-50%,-50%) scale(.2)} 24%{opacity:1} 100%{opacity:0;transform:translate(calc(-50% + var(--pixel-x)),calc(-50% + var(--pixel-y))) scale(.35) rotate(180deg)} }
              @keyframes hooSteamCloud { 0%{opacity:0;transform:scale(.35)} 30%{opacity:.9} 100%{opacity:0;transform:scale(1.45) translateY(-12%)} }
              @keyframes hooSteamGear { 0%{opacity:1;transform:translate(-50%,-50%) scale(.25) rotate(0)} 100%{opacity:0;transform:translate(-50%,-50%) scale(2.7) rotate(540deg)} }
              @keyframes hooGearFly { 0%{opacity:1;transform:translate(-50%,-50%) scale(.3) rotate(0)} 100%{opacity:0;transform:translate(calc(-50% + var(--motif-x)),calc(-50% + var(--motif-y))) scale(1.4) rotate(720deg)} }
              @keyframes hooSteamPipeBuild { 0%{opacity:0;stroke-dashoffset:1} 16%{opacity:1} 62%{stroke-dashoffset:0} 86%{opacity:1} 100%{opacity:0;stroke-dashoffset:-.08} }
              @keyframes hooSteamFlow { 0%{opacity:0;stroke-dashoffset:.8} 25%{opacity:.95} 78%{opacity:.75} 100%{opacity:0;stroke-dashoffset:-.7} }
              @keyframes hooSteamCardPressure {
                0%{opacity:1;transform:translateZ(0) scale(1);filter:brightness(1)}
                28%{transform:translateZ(12px) scale(1.015);filter:brightness(1.12)}
                43%{transform:translate3d(-2px,1px,20px) scale(1.025)}
                52%{transform:translate3d(3px,-1px,24px) scale(1.04);filter:brightness(1.35)}
                62%{opacity:1;transform:translateZ(34px) scale(1.1);filter:brightness(2)}
                72%{opacity:0;transform:translateZ(55px) scale(1.28);filter:brightness(3) blur(3px)}
                100%{opacity:0;transform:translateZ(55px) scale(1.28)}
              }
              @keyframes hooSteamNeedle { 0%{transform:rotate(-72deg)} 68%{transform:rotate(68deg)} 82%{transform:rotate(46deg)} 100%{transform:rotate(82deg)} }
              @keyframes hooSteamPuff { 0%{opacity:0;transform:translate(-50%,-50%) scale(.15)} 28%{opacity:.95} 100%{opacity:0;transform:translate(calc(-50% + var(--steam-x)),calc(-50% + var(--steam-y))) scale(2.1)} }
              @keyframes hooSteamGearBurst { 0%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(0)} 25%{opacity:1} 100%{opacity:0;transform:translate(calc(-50% + var(--gear-x)),calc(-50% + var(--gear-y))) scale(.72) rotate(var(--gear-spin))} }
              @keyframes hooHeavenRays { 0%{opacity:0;transform:scale(.2) rotate(-15deg)} 25%{opacity:1} 100%{opacity:0;transform:scale(1.25) rotate(16deg)} }
              @keyframes hooHeavenRise { 0%{opacity:1;transform:translate(-50%,-20%) scale(.3)} 100%{opacity:0;transform:translate(calc(-50% + var(--motif-x)),calc(-220% + var(--motif-y))) scale(1.6) rotate(40deg)} }
              @keyframes hooHellBurst { 0%{opacity:0;transform:translateY(35%) scale(.3)} 28%{opacity:1} 100%{opacity:0;transform:translateY(-20%) scale(1.5)} }
              @keyframes hooHellHeat { 0%{transform:translateY(10%) skewX(0)} 50%{transform:translateY(-4%) skewX(8deg)} 100%{transform:translateY(-16%) skewX(-5deg)} }
              @keyframes hooHellFlame { 0%{opacity:1;transform:translate(-50%,-30%) scale(.3)} 100%{opacity:0;transform:translate(calc(-50% + var(--motif-x)),calc(-180% + var(--motif-y))) scale(1.7) rotate(25deg)} }
              @keyframes hooHellTrailIgnite { 0%{opacity:0;stroke-dashoffset:1} 16%{opacity:1} 60%{stroke-dashoffset:0} 82%{opacity:1} 100%{opacity:0;stroke-dashoffset:-.1} }
              @keyframes hooHellTrailSpark { 0%{opacity:0;stroke-dashoffset:.8} 22%{opacity:1} 78%{opacity:.9} 100%{opacity:0;stroke-dashoffset:-.8} }
              @keyframes hooHellCardBurn {
                0%{opacity:1;transform:scale(1);filter:brightness(1) saturate(1);clip-path:polygon(0 0,50% 0,100% 0,100% 50%,100% 100%,50% 100%,0 100%,0 50%)}
                28%{transform:scale(1.02);filter:brightness(1.35) saturate(1.4)}
                52%{opacity:1;transform:translateY(-1%) scale(.99);filter:brightness(.9) saturate(.8)}
                74%{opacity:.9;transform:translateY(-3%) scale(.94);filter:brightness(.48) saturate(.25) contrast(1.7);clip-path:polygon(5% 4%,48% 0,96% 7%,100% 54%,91% 96%,52% 100%,6% 91%,0 45%)}
                90%{opacity:.35;transform:translateY(-7%) scale(.76);filter:brightness(.18) grayscale(1) blur(1px);clip-path:polygon(18% 12%,52% 3%,87% 16%,91% 48%,78% 85%,49% 94%,14% 78%,8% 43%)}
                100%{opacity:0;transform:translateY(-16%) scale(.42);filter:brightness(0) grayscale(1) blur(5px);clip-path:polygon(34% 20%,54% 9%,74% 25%,69% 44%,80% 61%,55% 78%,31% 68%,23% 42%)}
              }
              @keyframes hooHellCharSpread { 0%{opacity:0;clip-path:inset(100% 0 0)} 30%{opacity:.2} 72%{opacity:.82;clip-path:inset(18% 0 0)} 100%{opacity:1;clip-path:inset(0)} }
              @keyframes hooHellSymbolScorch { 0%{filter:brightness(1) saturate(1);opacity:1} 45%{filter:brightness(1.4) sepia(.4);opacity:1} 72%{filter:brightness(.42) sepia(1) grayscale(.7);opacity:.82} 100%{filter:brightness(0) grayscale(1) blur(2px);opacity:0} }
              @keyframes hooHellBackglow { 0%{opacity:0;transform:scale(.65);filter:blur(5px) brightness(.8)} 20%{opacity:1;transform:scale(1.02);filter:blur(3px) brightness(1.35)} 62%{opacity:.92;transform:scale(.96);filter:blur(4px) brightness(1.1)} 100%{opacity:0;transform:scale(1.18);filter:blur(9px) brightness(.55)} }
              @keyframes hooHellHeatPulse { 0%{opacity:.55;transform:scale(.88)} 100%{opacity:1;transform:scale(1.12)} }
              @keyframes hooHellHeatRing { 0%{opacity:.8;transform:scale(.55)} 100%{opacity:0;transform:scale(1.55)} }
              @keyframes hooHellCardFlame { 0%{opacity:0;transform:scaleX(.65) scaleY(.15) rotate(-4deg)} 18%{opacity:1} 42%{transform:scaleX(1.05) scaleY(1.25) rotate(5deg)} 72%{opacity:1;transform:translateY(-24%) scaleX(.8) scaleY(1.65) rotate(-6deg)} 100%{opacity:0;transform:translateY(-85%) scaleX(.35) scaleY(2.1) rotate(4deg)} }
              @keyframes hooHellInfernoBody { 0%{opacity:0;transform:scale(.35) translateY(28%)} 14%{opacity:1} 68%{opacity:1;transform:scale(1.05) translateY(-2%)} 88%{opacity:.92;transform:scale(.98) translateY(-8%)} 100%{opacity:0;transform:scale(.72) translateY(-34%)} }
              @keyframes hooHellOuterFlame { 0%{transform:skewX(-3deg) scaleX(.96) scaleY(.92)} 100%{transform:skewX(4deg) scaleX(1.04) scaleY(1.08)} }
              @keyframes hooHellInnerFlame { 0%{transform:translateX(-3%) scaleX(.9) scaleY(1.04)} 100%{transform:translateX(3%) scaleX(1.08) scaleY(.92)} }
              @keyframes hooHellTongueLeft { 0%{transform:rotate(-8deg) scaleY(.86)} 100%{transform:rotate(5deg) scaleY(1.14) translateY(-5%)} }
              @keyframes hooHellTongueCenter { 0%{transform:rotate(3deg) scaleX(.9) scaleY(.9)} 100%{transform:rotate(-4deg) scaleX(1.08) scaleY(1.18) translateY(-7%)} }
              @keyframes hooHellTongueRight { 0%{transform:rotate(7deg) scaleY(.9)} 100%{transform:rotate(-6deg) scaleY(1.12) translateY(-4%)} }
              @keyframes hooHellCorePulse { 0%{opacity:.78;transform:scale(.88)} 100%{opacity:1;transform:scale(1.1) translateY(-3%)} }
              @keyframes hooHellSmokeRise { 0%{opacity:0;transform:translateY(45%) scale(.45)} 30%{opacity:.68} 100%{opacity:0;transform:translateY(-72%) scale(1.45)} }
              @keyframes hooHellAshDrift { 0%{opacity:0;transform:translate(-50%,-50%) scale(.1) rotate(0);filter:blur(0)} 18%{opacity:1} 64%{opacity:.88} 100%{opacity:0;transform:translate(calc(-50% + var(--ash-x)),calc(-50% + var(--ash-y))) scale(.28) rotate(460deg);filter:blur(1.5px)} }
              @keyframes hooHellEmberRise { 0%{opacity:0;transform:translate(-50%,-50%) scale(.3)} 24%{opacity:1} 72%{opacity:1} 100%{opacity:0;transform:translate(calc(-50% + var(--ember-x)),calc(-50% + var(--ember-y))) scale(.12) rotate(280deg)} }
              @keyframes hooOceanWave { 0%{opacity:1;transform:scale(.15)} 100%{opacity:0;transform:scale(1.45)} }
              @keyframes hooOceanRise { 0%{opacity:0;transform:translateY(55%)} 35%{opacity:.9} 100%{opacity:0;transform:translateY(-28%)} }
              @keyframes hooOceanSweep {
                0% { opacity:0; transform:translate3d(-12%,8%,0) scaleY(.55) rotate(-4deg); }
                16% { opacity:1; transform:translate3d(35%,0,0) scaleY(1.08) rotate(1deg); }
                58% { opacity:1; transform:translate3d(145%,-4%,35px) scaleY(.92) rotate(-2deg); }
                100% { opacity:0; transform:translate3d(265%,3%,0) scaleY(.62) rotate(3deg); }
              }
              @keyframes hooOceanFoam {
                0% { opacity:0; transform:translateX(-35%) translateY(28%) scale(.7); }
                24% { opacity:.95; }
                72% { opacity:.7; }
                100% { opacity:0; transform:translateX(48%) translateY(-18%) scale(1.2); }
              }
              @keyframes hooOceanTileCarry {
                0% { opacity:1; transform:translate3d(0,0,0) rotateX(0) rotateY(0) scale(1); filter:blur(0); }
                24% { opacity:1; transform:translate3d(-8%,2%,18px) rotateX(-8deg) rotateY(8deg) scale(1.06); }
                46% { opacity:1; transform:translate3d(18%,-5%,28px) rotateX(14deg) rotateY(-16deg) scale(.96); }
                100% { opacity:0; transform:translate3d(175%,-24%,55px) rotateX(120deg) rotateY(150deg) scale(.48); filter:blur(5px); }
              }
              @keyframes hooLocalOceanSweep {
                0% { opacity:0; transform:translate3d(-48%,7%,0) scale(.68); }
                12% { opacity:1; }
                42% { opacity:1; transform:translate3d(-8%,-2%,22px) scale(.92); }
                76% { opacity:1; transform:translate3d(24%,1%,30px) scale(.88); }
                100% { opacity:0; transform:translate3d(52%,8%,0) scale(.72); }
              }
              @keyframes hooLocalOceanDrops {
                0% { opacity:0; transform:translateY(12%) scale(.5); }
                25% { opacity:1; }
                100% { opacity:0; transform:translateY(-28%) scale(1.35); }
              }
              @keyframes hooOceanCurrentFill {
                0% { opacity:0; stroke-dashoffset:1; }
                14% { opacity:1; }
                58% { opacity:1; stroke-dashoffset:0; }
                82% { opacity:.9; stroke-dashoffset:-.04; }
                100% { opacity:0; stroke-dashoffset:-.18; }
              }
              @keyframes hooOceanFoamFlow {
                0% { opacity:0; stroke-dashoffset:.9; }
                18% { opacity:1; }
                72% { opacity:1; }
                100% { opacity:0; stroke-dashoffset:-.55; }
              }
              @keyframes hooOceanGlintFlow {
                0% { opacity:0; stroke-dashoffset:.65; }
                24% { opacity:1; }
                68% { opacity:.9; }
                100% { opacity:0; stroke-dashoffset:-.8; }
              }
              @keyframes hooRealOceanSweep {
                0% { opacity:0; transform:translate3d(-82%,7%,0) scaleY(.72); }
                10% { opacity:1; }
                38% { opacity:1; transform:translate3d(-20%,-2%,20px) scaleY(1.06); }
                72% { opacity:1; transform:translate3d(30%,1%,36px) scaleY(.98); }
                100% { opacity:0; transform:translate3d(88%,8%,0) scaleY(.74); }
              }
              @keyframes hooOceanBodyRoll {
                0% { transform:skewX(-2deg) scaleY(.96) translateY(2%); }
                100% { transform:skewX(2deg) scaleY(1.05) translateY(-2%); }
              }
              @keyframes hooOceanSpray {
                0% { opacity:0; transform:translate3d(-5%,15%,0) scale(.55); }
                24% { opacity:1; }
                66% { opacity:.9; transform:translate3d(8%,-10%,40px) scale(1.15); }
                100% { opacity:0; transform:translate3d(18%,-28%,70px) scale(1.5); }
              }
              @keyframes hooBubbleFly { 0%{opacity:1;transform:translate(-50%,-50%) scale(.2)} 100%{opacity:0;transform:translate(calc(-50% + var(--motif-x)),calc(-180% + var(--motif-y))) scale(1.5)} }
              @keyframes hooTyphoonSpin { 0%{opacity:0;transform:scale(.2) rotate(0)} 25%{opacity:1} 100%{opacity:0;transform:scale(1.1) rotate(620deg)} }
              @keyframes hooTyphoonEye { 0%{opacity:0;transform:scale(.1)} 35%{opacity:1} 100%{opacity:0;transform:scale(2)} }
              @keyframes hooDreamDrift { 0%{opacity:0;transform:translate(9%,14%) scale(.58) rotate(-6deg)} 24%{opacity:1} 62%{opacity:.9;transform:translate(-3%,-6%) scale(1.03) rotate(9deg)} 100%{opacity:0;transform:translate(-13%,-22%) scale(1.38) rotate(24deg)} }
              @keyframes hooDreamNebula { 0%{opacity:0;transform:scale(.35) rotate(-10deg)} 24%{opacity:.95} 58%{opacity:.8;transform:scale(1.05) rotate(8deg)} 100%{opacity:0;transform:scale(1.48) rotate(24deg)} }
              @keyframes hooDreamStar { 0%{opacity:0;transform:translate(-50%,-50%) scale(.08) rotate(0);filter:blur(4px)} 28%{opacity:1;transform:translate(-50%,-50%) scale(2.15) rotate(75deg);filter:blur(0) drop-shadow(0 0 12px #fff)} 100%{opacity:0;transform:translate(calc(-50% + var(--motif-x)),calc(-50% + var(--motif-y))) scale(.28) rotate(300deg);filter:blur(3px)} }
              @keyframes hooDreamCardDissolve { 0%{opacity:1;transform:translateZ(0) scale(1);filter:blur(0) brightness(1)} 24%{transform:translateZ(24px) scale(1.04);filter:blur(0) brightness(1.45)} 52%{opacity:.92;transform:translate3d(0,-5%,48px) scale(1.1);filter:blur(1px) brightness(1.8)} 76%{opacity:.5;transform:translate3d(5%,-18%,68px) scale(.86) rotate(5deg);filter:blur(5px) brightness(1.5)} 100%{opacity:0;transform:translate3d(12%,-45%,90px) scale(.35) rotate(14deg);filter:blur(12px) brightness(.8)} }
              @keyframes hooDreamSymbolEcho { 0%{opacity:1;transform:scale(1)} 32%{opacity:1;transform:scale(1.18)} 58%{opacity:.72;text-shadow:-13px 4px 0 rgba(249,168,212,.32),13px -5px 0 rgba(147,197,253,.3)} 100%{opacity:0;transform:translateY(-38%) scale(1.7);filter:blur(7px)} }
              @keyframes hooDreamPortal { 0%{opacity:0;transform:scale(.2) rotate(0)} 24%{opacity:1} 72%{opacity:.9;transform:scale(1.18) rotate(230deg)} 100%{opacity:0;transform:scale(1.7) rotate(420deg)} }
              @keyframes hooDreamHaloOne { 0%{opacity:0;transform:scale(.25) rotateX(64deg)} 30%{opacity:1} 100%{opacity:0;transform:scale(1.7) rotateX(68deg) rotateZ(52deg)} }
              @keyframes hooDreamHaloTwo { 0%{opacity:0;transform:scale(.3) rotateY(66deg)} 38%{opacity:.9} 100%{opacity:0;transform:scale(1.45) rotateY(70deg) rotateZ(-48deg)} }
              @keyframes hooDreamWisp { 0%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(var(--dream-rotate));filter:blur(5px)} 24%{opacity:1} 68%{opacity:.85} 100%{opacity:0;transform:translate(calc(-50% + var(--dream-x)),calc(-50% + var(--dream-y))) scale(1.6) rotate(calc(var(--dream-rotate) + 55deg));filter:blur(8px)} }
              @keyframes hooDreamParticle { 0%{opacity:0;transform:translate(-50%,-50%) scale(.1);filter:blur(4px)} 22%{opacity:1} 66%{opacity:.85} 100%{opacity:0;transform:translate(calc(-50% + var(--break-x)),calc(-50% + var(--break-y))) scale(.35) rotate(240deg);filter:blur(3px)} }
              @keyframes hooDreamOrbFloat { 0%{transform:translateZ(0) scale(.2);opacity:0} 28%{opacity:1} 100%{transform:translateZ(90px) scale(1.25) rotate(180deg);opacity:0} }
              @keyframes hooGlassCrack { 0%{opacity:0;transform:scale(.1)} 22%{opacity:1} 100%{opacity:0;transform:scale(1.4) rotate(12deg)} }
              @keyframes hooGlassCrackGrow {
                0% { opacity:0; transform:rotate(var(--crack-angle)) scaleX(0); }
                18% { opacity:1; }
                100% { opacity:1; transform:rotate(var(--crack-angle)) scaleX(1); }
              }
              @keyframes hooGlassCardBreak {
                0% { opacity:1; transform:translateZ(0) scale(1); filter:brightness(1); }
                18% { transform:translate3d(-1px,1px,8px) scale(1.01); }
                27% { transform:translate3d(2px,-1px,12px) scale(.995); }
                36% { opacity:1; transform:translate3d(-2px,0,18px) scale(1.025); filter:brightness(1.25); }
                45% { opacity:1; transform:translateZ(28px) scale(1.07); filter:brightness(2.8); }
                54% { opacity:0; transform:translateZ(45px) scale(1.16); filter:brightness(4) blur(2px); }
                100% { opacity:0; transform:translateZ(45px) scale(1.16); }
              }
              @keyframes hooGlassMotif { 0%{opacity:1;transform:translate(-50%,-50%) scale(.2) rotate(0)} 100%{opacity:0;transform:translate(calc(-50% + var(--motif-x)),calc(-50% + var(--motif-y))) scale(1.8) rotate(680deg)} }
              @keyframes hooHeavenSanctum { 0%{opacity:0;transform:scale(.28)} 20%{opacity:1;transform:scale(.82)} 58%{opacity:.96;transform:scale(1.03)} 100%{opacity:0;transform:scale(1.42)} }
              @keyframes hooHeavenSacredRays { 0%{opacity:0;transform:scale(.35) rotate(-18deg)} 26%{opacity:1} 100%{opacity:0;transform:scale(1.28) rotate(16deg)} }
              @keyframes hooHeavenBeam { 0%{opacity:0;transform:translateY(-28%) scaleX(.35)} 22%{opacity:1} 68%{opacity:.9;transform:translateY(0) scaleX(1)} 100%{opacity:0;transform:translateY(-14%) scaleX(1.2)} }
              @keyframes hooHeavenGate { 0%{opacity:0;transform:scale(.35) translateZ(-20px)} 24%{opacity:1} 66%{opacity:1;transform:scale(1.08) translateZ(38px)} 100%{opacity:0;transform:scale(1.42) translateZ(70px)} }
              @keyframes hooHeavenWingLeft { 0%{opacity:0;transform:scale(.1) rotateY(78deg) translateX(38%)} 28%{opacity:1} 66%{opacity:1;transform:scale(1.06) rotateY(-8deg) translateX(0)} 100%{opacity:0;transform:scale(1.28) rotateY(-22deg) translateX(-14%)} }
              @keyframes hooHeavenWingRight { 0%{opacity:0;transform:scaleX(-1) scale(.1) rotateY(78deg) translateX(38%)} 28%{opacity:1} 66%{opacity:1;transform:scaleX(-1) scale(1.06) rotateY(-8deg) translateX(0)} 100%{opacity:0;transform:scaleX(-1) scale(1.28) rotateY(-22deg) translateX(-14%)} }
              @keyframes hooHeavenSigil { 0%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(-90deg)} 30%{opacity:1} 72%{opacity:.9;transform:translate(-50%,-50%) scale(1.12) rotate(120deg)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1.5) rotate(220deg)} }
              @keyframes hooHeavenHaloOne { 0%{opacity:0;transform:scale(.2) rotateX(62deg)} 32%{opacity:1} 100%{opacity:0;transform:scale(1.7) rotateX(68deg) rotateZ(42deg)} }
              @keyframes hooHeavenHaloTwo { 0%{opacity:0;transform:scale(.25) rotateY(68deg)} 38%{opacity:1} 100%{opacity:0;transform:scale(1.55) rotateY(72deg) rotateZ(-48deg)} }
              @keyframes hooHeavenAscend { 0%{opacity:1;transform:translateZ(0) scale(1);filter:brightness(1)} 30%{opacity:1;transform:translateZ(28px) scale(1.08);filter:brightness(1.7)} 64%{opacity:.92;transform:translate3d(0,-28%,55px) scale(.92);filter:brightness(2.4)} 100%{opacity:0;transform:translate3d(0,-105%,80px) scale(.35);filter:brightness(3.2) blur(5px)} }
              @keyframes hooHeavenFeatherRise { 0%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(0)} 18%{opacity:1} 66%{opacity:.95} 100%{opacity:0;transform:translate(calc(-50% + var(--heaven-x)),calc(-50% + var(--heaven-y))) scale(.7) rotate(var(--heaven-turn))} }
              @keyframes hooHeavenFeatherFlutter { 0%{transform:rotateY(-54deg) skewX(-7deg)} 100%{transform:rotateY(58deg) skewX(8deg) rotate(14deg)} }
              @keyframes hooLeafGust { 0%{opacity:0;transform:translateX(-60%) skewX(-15deg)} 30%{opacity:1} 100%{opacity:0;transform:translateX(60%) skewX(12deg)} }
              @keyframes hooLeafMotif { 0%{opacity:1;transform:translate(-50%,-50%) scale(.3) rotate(0)} 45%{transform:translate(calc(-50% + var(--motif-x)),calc(-50% + var(--motif-y))) scale(1.2) rotate(190deg)} 100%{opacity:0;transform:translate(calc(-20% + var(--motif-x)),calc(80% + var(--motif-y))) scale(.7) rotate(420deg)} }
              @keyframes hooLeafGreenBurst { 0%{opacity:0;transform:scale(.25)} 22%{opacity:1;transform:scale(.82)} 58%{opacity:.72;transform:scale(1.08)} 100%{opacity:0;transform:scale(1.45)} }
              @keyframes hooLeafScatter { 0%{opacity:0;transform:translate(-50%,-50%) translateZ(0) scale(.15) rotate(0)} 16%{opacity:1} 48%{opacity:1;transform:translate(-50%,-72%) translateZ(42px) scale(1) rotate(95deg)} 78%{opacity:.86} 100%{opacity:0;transform:translate(calc(-50% + var(--leaf-x)),calc(-50% + var(--leaf-y) + 65%)) translateZ(80px) scale(.55) rotate(var(--leaf-turn))} }
              @keyframes hooLeafFlutter { 0%{transform:rotate(var(--leaf-tilt)) rotateY(-58deg) skewX(-8deg)} 100%{transform:rotate(calc(var(--leaf-tilt) + 18deg)) rotateY(62deg) skewX(7deg)} }
              @keyframes hooWindSweep { 0%{opacity:0;transform:translateX(-70%)} 25%{opacity:1} 100%{opacity:0;transform:translateX(70%)} }
              @keyframes hooWindFlash { 0%{opacity:0;transform:translateX(-80%) scaleX(.2)} 35%{opacity:1} 100%{opacity:0;transform:translateX(80%) scaleX(2)} }
              @keyframes hooWindMotif { 0%{opacity:1;transform:translate(-50%,-50%) scaleX(.2)} 100%{opacity:0;transform:translate(calc(150% + var(--motif-x)),calc(-50% + var(--motif-y))) scaleX(2.4)} }

              @keyframes hooBoardImpact {
                0% { opacity: 0; transform: scale(0.82); filter: brightness(1); }
                12% { opacity: 0.82; transform: scale(1); filter: brightness(2.4); }
                32% { opacity: 0.42; }
                100% { opacity: 0; transform: scale(1.08); filter: brightness(1); }
              }

              @keyframes hooBreakFlash {
                0% {
                  opacity: 0;
                  transform: translate(-50%, -50%) scale(0.2);
                }
                24% {
                  opacity: 1;
                  transform: translate(-50%, -50%) scale(1.4);
                }
                100% {
                  opacity: 0;
                  transform: translate(-50%, -50%) scale(2.4);
                }
              }

              @keyframes hooBreakRing {
                0% {
                  opacity: 1;
                  transform: translate(-50%, -50%) scale(0.3);
                }
                100% {
                  opacity: 0;
                  transform: translate(-50%, -50%) scale(4.2);
                }
              }

              @keyframes hooBreakParticle {
                0% {
                  opacity: 1;
                  transform: translate(-50%, -50%) scale(1) rotate(0deg);
                }
                75% {
                  opacity: 1;
                }
                100% {
                  opacity: 0;
                  transform: translate(
                      calc(-50% + var(--break-x)),
                      calc(-50% + var(--break-y))
                    )
                    scale(0.15) rotate(240deg);
                }
              }

              @keyframes hooGlassParticle {
                0% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
                100% { opacity: 0; transform: translate(calc(-50% + var(--break-x)), calc(-50% + var(--break-y))) scale(0.45) rotate(520deg); }
              }

              @keyframes hooLeafParticle {
                0% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(1); }
                55% { opacity: 1; transform: translate(calc(-50% + var(--break-x)), -20%) rotate(140deg) scale(0.8); }
                100% { opacity: 0; transform: translate(calc(-50% + var(--break-x)), calc(-50% + var(--break-y) + 100%)) rotate(310deg) scale(0.2); }
              }

              @keyframes hooWindParticle {
                0% { opacity: 1; transform: translate(-50%, -50%) scaleX(0.4); }
                100% { opacity: 0; transform: translate(600%, calc(-50% + var(--break-y))) scaleX(2.4); }
              }

              @keyframes hooTyphoonParticle {
                0% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(1); }
                45% { opacity: 1; transform: translate(calc(-50% + var(--break-y)), calc(-50% - 80%)) rotate(300deg) scale(0.9); }
                100% { opacity: 0; transform: translate(calc(-50% + var(--break-x)), calc(-50% + var(--break-y))) rotate(760deg) scale(0.1); }
              }

              @keyframes hooConnectLine {
                0% {
                  stroke-dashoffset: 12;
                  opacity: 0;
                }
                25% {
                  opacity: 1;
                }
                100% {
                  stroke-dashoffset: 0;
                  opacity: 1;
                }
              }

              @media (max-width: 767px), (pointer: coarse) {
                .hoo-tile-card {
                  contain:layout style;
                  transition-duration:90ms !important;
                }

                .hoo-tile-card:not(.scale-90) {
                  transform:none !important;
                }

                .hoo-tile-card:not(.ring-4) {
                  box-shadow:inset 0 0 4px rgba(139,92,246,.12) !important;
                }

                .hoo-tile-card > span {
                  transform:none !important;
                  filter:none !important;
                  text-shadow:none !important;
                }

                .hoo-tile-breaking {
                  filter:none !important;
                  transition-duration:120ms !important;
                }

                [class*="hoo-break-theme-"] svg polyline,
                .hoo-connect-line-glow {
                  filter:none !important;
                }

                .hoo-break-atmosphere {
                  display:none !important;
                }

                .hoo-break-impact {
                  filter:none !important;
                  box-shadow:none !important;
                  mix-blend-mode:normal !important;
                  animation-duration:420ms !important;
                }

                .hoo-break-flash,
                .hoo-break-ring,
                .hoo-theme-core,
                .hoo-depth-fragment,
                .hoo-theme-motif,
                .hoo-break-particle {
                  filter:none !important;
                  text-shadow:none !important;
                }

                .hoo-break-origin {
                  perspective:none !important;
                }

                .hoo-break-origin * {
                  mix-blend-mode:normal !important;
                }

                .hoo-break-theme-dream .hoo-dream-card-ghost,
                .hoo-break-theme-heaven .hoo-heaven-card-ghost,
                .hoo-break-theme-hell .hoo-hell-card-ghost,
                .hoo-break-theme-steam .hoo-steam-card-ghost,
                .hoo-break-theme-cyber .hoo-cyber-card-ghost {
                  backdrop-filter:none !important;
                  box-shadow:0 0 12px var(--hoo-break-accent) !important;
                }

                .hoo-break-theme-dream .hoo-dream-portal,
                .hoo-break-theme-hell .hoo-hell-backglow,
                .hoo-break-theme-heaven .hoo-heaven-sanctum {
                  filter:blur(2px) !important;
                  box-shadow:0 0 18px var(--hoo-break-accent) !important;
                }

                .hoo-break-theme-heaven .hoo-heaven-gate,
                .hoo-break-theme-ocean .hoo-ocean-tile-ghost {
                  filter:none !important;
                }

                .hoo-break-theme-glass .hoo-glass-card-ghost {
                  backdrop-filter:none !important;
                }
              }

              @keyframes hooArcadeCount {
                0% {
                  opacity: 0;
                  transform: scale(1.65);
                  filter: blur(8px);
                }
                35% {
                  opacity: 1;
                  transform: scale(0.92);
                  filter: blur(0);
                }
                55% {
                  transform: scale(1.05);
                }
                100% {
                  opacity: 1;
                  transform: scale(1);
                }
              }
            `}</style>
          </main>
        </div>

        {isStageClear && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-[30px] border border-violet-300/30 bg-[#17121f] p-7 text-center shadow-2xl">
              <p className="text-5xl">🎉</p>
              <h2 className="mt-4 text-2xl font-black">STAGE {stage} CLEAR!</h2>
              <p className="mt-2 text-sm font-bold text-white/55">{formatTime(seconds)} · {moves}회 이동</p>
              {clearReward.isBest && <p className="mt-3 text-xs font-black tracking-[0.15em] text-yellow-300">NEW BEST SCORE!</p>}
              {clearReward.rankingPoints > 0 && (
                <div className="mt-3 rounded-2xl border border-yellow-300/35 bg-yellow-300/10 px-4 py-3 shadow-[0_0_24px_rgba(250,204,21,0.18)]">
                  <p className="text-[9px] font-black tracking-[0.18em] text-yellow-100/65">HOO 종합 점수</p>
                  <p className="mt-1 text-xl font-black text-yellow-300">+{clearReward.rankingPoints}점 획득</p>
                </div>
              )}
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-left text-xs font-bold">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-white/55">
                  <span>매칭·콤보</span><b className="text-right text-white">+{clearReward.pair.toLocaleString()}</b>
                  <span>시간 보너스</span><b className="text-right text-cyan-200">+{clearReward.time.toLocaleString()}</b>
                  <span>이동 효율</span><b className="text-right text-emerald-200">+{clearReward.efficiency.toLocaleString()}</b>
                  <span>아이템 보존</span><b className="text-right text-violet-200">+{clearReward.resource.toLocaleString()}</b>
                  <span>스테이지 보너스</span><b className="text-right text-yellow-200">+{clearReward.stage.toLocaleString()}</b>
                </div>
                <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-3"><span className="text-white/60">BEST COMBO ×{bestCombo}</span><strong className="text-xl text-yellow-300">{clearReward.total.toLocaleString()}점</strong></div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => startStage(stage)} className="rounded-2xl bg-white/10 py-3 text-sm font-black">다시 플레이</button>
                <button type="button" onClick={() => stage < 100 ? startStage(stage + 1) : onExit()} className="rounded-2xl bg-violet-600 py-3 text-sm font-black">{stage < 100 ? "다음 스테이지" : "완료"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>,
    document.body,
  );
}

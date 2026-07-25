


"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { submit2048Completion } from "@/lib/community";


import {
  moveDownWithScore,
  moveLeftWithScore,
  moveRightWithScore,
  moveUpWithScore,
} from "@/lib/game2048/movement";

type Board = number[][];

type AnimatedTile = {
  id: string;
  value: number;
  fromRow: number;
  fromColumn: number;
  toRow: number;
  toColumn: number;
};

type MoveFunction = typeof moveLeftWithScore;

const BOARD_SIZE = 4;
const ANIMATION_DURATION = 150;

function createEmptyBoard(): Board {
  return Array.from(
    { length: BOARD_SIZE },
    () => Array(BOARD_SIZE).fill(0),
  );
}

function copyBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function spawnRandomTile(
  board: Board,
  difficulty:
    | "easy"
    | "normal"
    | "hard" = "easy",
): Board {

  const nextBoard = copyBoard(board);

  const emptyCells: {
    row: number;
    column: number;
  }[] = [];

  for (
    let row = 0;
    row < BOARD_SIZE;
    row += 1
  ) {
    for (
      let column = 0;
      column < BOARD_SIZE;
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

 const fourProbability =
  difficulty === "easy"
    ? 0.05
    : difficulty === "normal"
      ? 0.1
      : 0.2;

nextBoard[randomCell.row][
  randomCell.column
] =
  Math.random() < 1 - fourProbability
    ? 2
    : 4;

  return nextBoard;
}

function createInitialBoard(
  difficulty: "easy" | "normal" | "hard" = "normal",
): Board {
  let nextBoard = createEmptyBoard();

 const initialTileCount =
  difficulty === "easy"
    ? 2
    : difficulty === "normal"
      ? 3
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
          previousBoard[rowIndex][
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
    row < BOARD_SIZE;
    row += 1
  ) {
    for (
      let column = 0;
      column < BOARD_SIZE - 1;
      column += 1
    ) {
      if (
        board[row][column] ===
        board[row][column + 1]
      ) {
        return true;
      }
    }
  }

  for (
    let row = 0;
    row < BOARD_SIZE - 1;
    row += 1
  ) {
    for (
      let column = 0;
      column < BOARD_SIZE;
      column += 1
    ) {
      if (
        board[row][column] ===
        board[row + 1][column]
      ) {
        return true;
      }
    }
  }

  return false;
}

function hasWon(board: Board): boolean {
  return board.some((row) =>
    row.some((value) => value >= 2048),
  );
}

function getTileClass(value: number): string {
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

    default:
      return "bg-[#3c3a32] text-white";
  }
}

function getTileTextSize(value: number): string {
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
    return "translate(0, 0)";
  }

  const columnDifference =
    tile.toColumn - tile.fromColumn;

  const rowDifference =
    tile.toRow - tile.fromRow;

  const horizontalPercent =
    columnDifference * 100;

  const horizontalGap =
    columnDifference * 0.5;

  const verticalPercent =
    rowDifference * 100;

  const verticalGap =
    rowDifference * 0.5;

  return `translate(
    calc(${horizontalPercent}% + ${horizontalGap}rem),
    calc(${verticalPercent}% + ${verticalGap}rem)
  )`;
}

type Hoo2048GameProps = {
  difficulty?: "easy" | "normal" | "hard";
  bestScore?: number;
  onScoreChange?: (score: number) => void;
  onRecordSaved?: () => void;
};

export default function Hoo2048Game({
  difficulty = "easy",
  bestScore = 0,
  onScoreChange,
  onRecordSaved,
}: Hoo2048GameProps) {


  const [board, setBoard] =
  useState<Board>(() =>
    createEmptyBoard(),
  );

  const [displayBoard, setDisplayBoard] =
    useState<Board>(() => copyBoard(board));

  const [score, setScore] = useState(0);

 const startedAtRef = useRef(Date.now());

const scoreRef = useRef(0);

const recordSubmittedRef = useRef(false);

  useEffect(() => {
  onScoreChange?.(score);
}, [score, onScoreChange]);

  const [isAnimating, setIsAnimating] =
    useState(false);

  const [animatedTiles, setAnimatedTiles] =
    useState<AnimatedTile[]>([]);

  const [
    animationStarted,
    setAnimationStarted,
  ] = useState(false);

  const [mergedTileKeys, setMergedTileKeys] =
    useState<string[]>([]);

  const [isGameOver, setIsGameOver] =
    useState(false);

  const [isWon, setIsWon] =
    useState(false);

  const [hasContinued, setHasContinued] =
    useState(false);

  const movementTimeoutRef =
    useRef<number | null>(null);

  const mergeTimeoutRef =
    useRef<number | null>(null);

  const animationFrameRef =
    useRef<number | null>(null);

    const touchStartXRef =
  useRef<number | null>(null);

const touchStartYRef =
  useRef<number | null>(null);

  function clearMovementAnimation() {
    if (movementTimeoutRef.current !== null) {
      window.clearTimeout(
        movementTimeoutRef.current,
      );

      movementTimeoutRef.current = null;
    }

    if (mergeTimeoutRef.current !== null) {
      window.clearTimeout(
        mergeTimeoutRef.current,
      );

      mergeTimeoutRef.current = null;
    }

    if (animationFrameRef.current !== null) {
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

    if (mergeTimeoutRef.current !== null) {
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

  function restartGame() {
    clearMovementAnimation();

   const nextBoard =
  createInitialBoard(difficulty);
  
  startedAtRef.current = Date.now();
scoreRef.current = 0;
recordSubmittedRef.current = false;


    setBoard(nextBoard);
    setDisplayBoard(copyBoard(nextBoard));

    setScore(0);
    setIsAnimating(false);
    setAnimatedTiles([]);
    setAnimationStarted(false);
    setMergedTileKeys([]);
    setIsGameOver(false);
    setIsWon(false);
    setHasContinued(false);
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
        ...finalBoard.flat(),
      );

      await submit2048Completion({
        difficulty,
        score: finalScore,
        elapsedSeconds,
        maxTile,
      });

      onRecordSaved?.();
    } catch (error) {
      recordSubmittedRef.current = false;

      console.error(
        "2048 기록 저장 실패:",
        error,
      );
    }
  },
  [difficulty, onRecordSaved],
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

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    if (deltaX > 0) {
      performMove(moveRightWithScore);
    } else {
      performMove(moveLeftWithScore);
    }
  } else {
    if (deltaY > 0) {
      performMove(moveDownWithScore);
    } else {
      performMove(moveUpWithScore);
    }
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
recordSubmittedRef.current = false;

  const initialBoard =
    createInitialBoard(difficulty);

  setBoard(initialBoard);
  setDisplayBoard(
    copyBoard(initialBoard),
  );

  setScore(0);
  setIsAnimating(false);
  setAnimatedTiles([]);
  setAnimationStarted(false);
  setMergedTileKeys([]);
  setIsGameOver(false);
  setIsWon(false);
  setHasContinued(false);
}, [difficulty]);

useEffect(() => {
  const previousTitle = document.title;

  document.title = `HOO 2048 - ${
    difficulty === "easy"
      ? "쉬움"
      : difficulty === "normal"
        ? "보통"
        : "어려움"
  }`;

  return () => {
    document.title = previousTitle;
  };
}, [difficulty]);


  const performMove = useCallback(
    (moveFunction: MoveFunction) => {
      if (
        isAnimating ||
        isGameOver ||
        isWon
      ) {
        return;
      }

      const result =
        moveFunction(board);

  if (
  !hasBoardChanged(
    board,
    result.board,
  )
) {
  if (!canMove(board)) {
    setIsGameOver(true);
    void submitRecord(
      scoreRef.current,
      board,
    );
  }

  return;
}

      const movementTiles =
        result.movedTiles.map(
          (tile, index) => ({
            id: `${Date.now()}-${index}`,
            value: tile.value,
            fromRow: tile.fromRow,
            fromColumn: tile.fromColumn,
            toRow: tile.toRow,
            toColumn: tile.toColumn,
          }),
        );

      setIsAnimating(true);
      setAnimationStarted(false);
      setAnimatedTiles(movementTiles);

      // 기존 숫자 타일은 잠시 숨기고,
      // animatedTiles가 대신 이동한다.
      setDisplayBoard(createEmptyBoard());

      animationFrameRef.current =
        window.requestAnimationFrame(() => {
          animationFrameRef.current =
            window.requestAnimationFrame(() => {
              setAnimationStarted(true);

              animationFrameRef.current =
                null;
            });
        });

      movementTimeoutRef.current =
        window.setTimeout(() => {
          
          const nextBoard =
  spawnRandomTile(
    result.board,
    difficulty,
  );

          setBoard(nextBoard);
          setDisplayBoard(
            copyBoard(nextBoard),
          );

        const nextScore =
  scoreRef.current + result.score;

scoreRef.current = nextScore;
setScore(nextScore);


          showMergeAnimation(
            result.mergedTiles,
          );

       if (
  !hasContinued &&
  hasWon(nextBoard)
) {
  setIsWon(true);
  void submitRecord(
    nextScore,
    nextBoard,
  );
}

       if (!canMove(nextBoard)) {
  setIsGameOver(true);
  void submitRecord(
    nextScore,
    nextBoard,
  );
}

          setAnimatedTiles([]);
          setAnimationStarted(false);
          setIsAnimating(false);

          movementTimeoutRef.current =
            null;
        }, ANIMATION_DURATION);
    },
   [
  board,
  difficulty,
  hasContinued,
  isAnimating,
  isGameOver,
  isWon,
  submitRecord,
],
  );

 useEffect(() => {
  function handleKeyDown(
    event: KeyboardEvent,
  ) {
    switch (event.key) {
      case "ArrowLeft":
      case "a":
      case "A":
        event.preventDefault();
        performMove(moveLeftWithScore);
        break;

      case "ArrowRight":
      case "d":
      case "D":
        event.preventDefault();
        performMove(moveRightWithScore);
        break;

      case "ArrowUp":
      case "w":
      case "W":
        event.preventDefault();
        performMove(moveUpWithScore);
        break;

      case "ArrowDown":
      case "s":
      case "S":
        event.preventDefault();
        performMove(moveDownWithScore);
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
}, [performMove]);


  useEffect(() => {
    return () => {
      clearMovementAnimation();
    };
  }, []);

  return (
    <section className="mx-auto w-full max-w-xl">
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-bold">
          HOO 2048
        </h2>

        <p className="mt-1 text-sm text-[#8b849d]">
          2048을 완성하면 종합 점수 30점을
          획득합니다.
        </p>

     <div className="mt-3 inline-flex items-center gap-3 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#332f45]">
  <span>
    난이도:{" "}
    {difficulty === "easy"
      ? "쉬움"
      : difficulty === "normal"
        ? "보통"
        : "어려움"}
  </span>

  <span className="text-[#c8c1d8]">
    |
  </span>

 <span>
  점수: {score.toLocaleString("ko-KR")}
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
  onClick={restartGame}
  className="mt-3 rounded-xl bg-[#5f4b8b] px-4 py-2 text-sm font-bold text-white transition hover:scale-105"
>
  다시 시작
</button>

      </div>

      <div className="relative">

       <div
  className="relative aspect-square touch-none overflow-hidden rounded-2xl bg-[#d9d3e8] p-3"
  onTouchStart={handleTouchStart}
  onTouchEnd={handleTouchEnd}
  onTouchCancel={handleTouchCancel}
>

  
          {/* 빈 칸 배경 */}
          <div
            className="absolute inset-3 grid grid-cols-4 gap-2"
            style={{
              gridTemplateRows:
                "repeat(4, minmax(0, 1fr))",
            }}
          >
            {Array.from({
              length:
                BOARD_SIZE * BOARD_SIZE,
            }).map((_, index) => (
              <div
                key={`background-${index}`}
                className="rounded-xl bg-white"
              />
            ))}
          </div>

          {/* 이동이 끝난 실제 타일 */}
          <div
            className="pointer-events-none absolute inset-3 grid grid-cols-4 gap-2"
            style={{
              gridTemplateRows:
                "repeat(4, minmax(0, 1fr))",
            }}
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
                        className={`flex select-none items-center justify-center rounded-xl font-black transition-transform duration-150 ease-out ${getTileClass(
                          value,
                        )} ${getTileTextSize(
                          value,
                        )} ${
                          isMerged
                            ? "scale-110"
                            : "scale-100"
                        }`}
                        style={{
                          gridRowStart:
                            rowIndex + 1,
                          gridColumnStart:
                            columnIndex +
                            1,
                        }}
                      >
                        {value}
                      </div>
                    );
                  },
                ),
            )}
          </div>

          {/* 움직이는 애니메이션 타일 */}
          <div
            className="pointer-events-none absolute inset-3 grid grid-cols-4 gap-2"
            style={{
              gridTemplateRows:
                "repeat(4, minmax(0, 1fr))",
            }}
          >
            {animatedTiles.map((tile) => (
              <div
                key={tile.id}
                className={`z-10 flex select-none items-center justify-center rounded-xl font-black transition-transform duration-150 ease-out ${getTileClass(
                  tile.value,
                )} ${getTileTextSize(
                  tile.value,
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

                  willChange: "transform",
                }}
              >
                {tile.value}
              </div>
            ))}
          </div>
        </div>

        {isWon && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-[#5f4b8b]/90">
            <h3 className="text-3xl font-black text-white">
              YOU WIN!
            </h3>

            <p className="mt-2 text-sm font-semibold text-white/90">
              2048을 완성했습니다.
            </p>

            <p className="mt-1 text-sm font-semibold text-white/90">
  난이도:{" "}
  {difficulty === "easy"
    ? "쉬움"
    : difficulty === "normal"
      ? "보통"
      : "어려움"}
</p>

<>
  <p className="mt-1 text-sm font-bold text-white">
    최종 점수:{" "}
    {score.toLocaleString("ko-KR")}
  </p>

<p className="mt-1 text-sm font-bold text-white">
  최고 기록:{" "}
  {Math.max(
    score,
    bestScore,
  ).toLocaleString("ko-KR")}
</p>

  <p className="mt-1 text-sm font-bold text-white">
    종합 점수 30점 획득
  </p>
</>

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
                onClick={restartGame}
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
  난이도:{" "}
  {difficulty === "easy"
    ? "쉬움"
    : difficulty === "normal"
      ? "보통"
      : "어려움"}
</p>

            <p className="mt-2 text-sm font-semibold text-white/80">
  최종 점수:{" "}
  {score.toLocaleString("ko-KR")}
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
              onClick={restartGame}
              className="mt-5 rounded-xl bg-white px-6 py-3 font-bold text-[#332f45] transition hover:scale-105"
            >
              다시 시작
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
"use client";

import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  getRandomChessPuzzle,
  type ChessPuzzleItem,
} from "@/lib/chess-puzzles";

type PuzzleStatus = "playing" | "wrong" | "correct";

function createGame(fen: string) {
  return new Chess(fen);
}

function normalizeMove(from: string, to: string) {
  return `${from}${to}`.toLowerCase();
}

export default function ChessPuzzle() {
  const [puzzle, setPuzzle] = useState<ChessPuzzleItem>(() =>
    getRandomChessPuzzle(),
  );
  const [game, setGame] = useState(() => createGame(puzzle.fen));
  const [status, setStatus] = useState<PuzzleStatus>("playing");
  const [message, setMessage] = useState(puzzle.instruction);

  const boardOrientation = game.turn() === "w" ? "white" : "black";

  function resetPuzzle(targetPuzzle = puzzle) {
    setPuzzle(targetPuzzle);
    setGame(createGame(targetPuzzle.fen));
    setStatus("playing");
    setMessage(targetPuzzle.instruction);
  }

  function loadRandomPuzzle() {
    const nextPuzzle = getRandomChessPuzzle(puzzle.id);
    resetPuzzle(nextPuzzle);
  }

  function handlePieceDrop(args: any) {
    if (status === "correct") return false;

    const sourceSquare = args?.sourceSquare;
    const targetSquare = args?.targetSquare;

    if (!sourceSquare || !targetSquare) return false;

    const expectedMove = puzzle.solution[0];
    const attemptedMove = normalizeMove(sourceSquare, targetSquare);

    let moveResult = null;

    try {
      moveResult = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
    } catch {
      moveResult = null;
    }

    if (!moveResult) {
      setStatus("wrong");
      setMessage("그 수는 둘 수 없습니다. 다른 수를 찾아보세요.");
      return false;
    }

    if (attemptedMove !== expectedMove) {
      game.undo();
      setGame(createGame(game.fen()));
      setStatus("wrong");
      setMessage("아쉽습니다. 체크메이트가 되는 다른 수를 찾아보세요.");
      return false;
    }

    const updatedGame = createGame(game.fen());
    setGame(updatedGame);
    setStatus("correct");
    setMessage(
      updatedGame.isCheckmate()
        ? "체크메이트! 퍼즐을 해결했습니다."
        : "정답입니다! 퍼즐을 해결했습니다.",
    );

    return true;
  }

  const chessboardOptions = useMemo(
    () =>
      ({
        id: `hoo-chess-${puzzle.id}`,
        position: game.fen(),
        boardOrientation,
        onPieceDrop: handlePieceDrop,
        animationDurationInMs: 180,
        darkSquareStyle: {
          backgroundColor: "#8f7ab5",
        },
        lightSquareStyle: {
          backgroundColor: "#eee8f7",
        },
        boardStyle: {
          borderRadius: "18px",
          boxShadow: "0 18px 45px rgba(37, 28, 66, 0.22)",
        },
      }) as any,
    [boardOrientation, game, puzzle.id, status],
  );

  return (
    <section className="rounded-[30px] border border-white/60 bg-white/90 p-5 shadow-[0_20px_70px_rgba(20,20,45,0.18)] backdrop-blur-xl md:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-[#978fab]">
            HOO CHESS PUZZLE
          </p>
          <h2 className="mt-1 text-2xl font-black text-[#3f3954]">
            {puzzle.title}
          </h2>
          <p className="mt-2 text-sm font-bold text-[#81798f]">
            {puzzle.instruction}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => resetPuzzle()}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-[#6f6784] shadow-sm transition hover:bg-[#f5f2ff]"
          >
            다시 시작
          </button>
          <button
            type="button"
            onClick={loadRandomPuzzle}
            className="rounded-2xl bg-[#7467d8] px-4 py-2 text-sm font-black text-white transition hover:bg-[#6255c7]"
          >
            랜덤 문제
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,560px)_minmax(240px,1fr)] lg:items-start">
        <div className="mx-auto w-full max-w-[560px]">
          <Chessboard options={chessboardOptions} />
        </div>

        <aside className="rounded-[24px] bg-[#f7f5ff] p-5">
          <p className="text-xs font-black tracking-[0.16em] text-[#928ba8]">
            PUZZLE STATUS
          </p>

          <div
            className={[
              "mt-3 rounded-2xl px-4 py-4 text-sm font-black leading-6",
              status === "correct"
                ? "bg-[#e7f8ea] text-[#367546]"
                : status === "wrong"
                  ? "bg-[#fff0f1] text-[#bf5161]"
                  : "bg-white text-[#514b63]",
            ].join(" ")}
            aria-live="polite"
          >
            {message}
          </div>

          <div className="mt-4 space-y-3 text-sm font-bold text-[#706981]">
            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
              <span>난이도</span>
              <strong className="text-[#403a54]">쉬움</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
              <span>현재 차례</span>
              <strong className="text-[#403a54]">
                {game.turn() === "w" ? "백" : "흑"}
              </strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
              <span>문제 번호</span>
              <strong className="text-[#403a54]">{puzzle.id}</strong>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-[#fff8dc] px-4 py-4 text-sm font-bold leading-6 text-[#8a6a20]">
            기물을 끌어서 이동하세요. 문제를 풀거나 랜덤 문제 버튼을 누르면
            다음 퍼즐을 만날 수 있습니다.
          </div>
        </aside>
      </div>
    </section>
  );
}

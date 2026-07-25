"use client";

export type HooGameId = "chess" | "sudoku";

type GameSelectorProps = {
  activeGame: HooGameId;
  onChange: (game: HooGameId) => void;
};

const GAMES: Array<{
  id: HooGameId;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    id: "chess",
    icon: "♟",
    title: "체스 퍼즐",
    description: "체크메이트 수를 찾아보세요.",
  },
  {
    id: "sudoku",
    icon: "▦",
    title: "스도쿠",
    description: "숫자 퍼즐을 완성하세요.",
  },
];

export default function GameSelector({
  activeGame,
  onChange,
}: GameSelectorProps) {
  return (
    <nav
      aria-label="게임 선택"
     className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      {GAMES.map((game) => {
        const isActive = activeGame === game.id;

        return (
          <button
            key={game.id}
            type="button"
            onClick={() => onChange(game.id)}
            aria-pressed={isActive}
            className={[
              "flex min-h-[110px] items-center gap-4 rounded-[26px] border px-5 py-4 text-left transition",
              isActive
                ? "border-[#7467d8] bg-[#7467d8] text-white shadow-[0_12px_35px_rgba(116,103,216,0.3)]"
                : "border-white/70 bg-white/85 text-[#4a445d] shadow-[0_10px_30px_rgba(35,28,60,0.1)] hover:-translate-y-0.5 hover:bg-white",
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              className={[
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl",
                isActive
                  ? "bg-white/18 text-white"
                  : "bg-[#f0ecfb] text-[#7467d8]",
              ].join(" ")}
            >
              {game.icon}
            </span>

            <span className="min-w-0">
              <span className="block text-base font-black">
                {game.title}
              </span>
              <span
                className={[
                  "mt-1 block text-sm font-bold",
                  isActive ? "text-white/75" : "text-[#8b8499]",
                ].join(" ")}
              >
                {game.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

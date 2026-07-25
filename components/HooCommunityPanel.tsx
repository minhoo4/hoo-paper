"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { getLevelProgress } from "@/lib/community";
import type { RankingPeriod, RankingRow } from "@/lib/community-types";

type SessionUser = { id: string; email?: string } | null;

type MyStats = {
  nickname: string;
  nickname_tag: number;
  avatar_emoji: string;
  total_score: number;
  completed_games: number;
  easy_count: number;
  normal_count: number;
  hard_count: number;
  current_streak: number;
  best_streak: number;
  achievements: string[] | null;
} | null;

const PERIOD_LABEL: Record<RankingPeriod, string> = {
  today: "오늘",
  week: "이번 주",
  all: "종합 점수",
};

type HooCommunityPanelProps = {
  refreshKey?: number;
};

export default function HooCommunityPanel({
  refreshKey = 0,
}: HooCommunityPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<SessionUser>(null);
  const [period, setPeriod] = useState<RankingPeriod>("all");

  const [rankingMode, setRankingMode] = useState<
    "score" | "timeAttack"
  >("score");

const [selectedGame, setSelectedGame] =
  useState<"sudoku" | "2048">("sudoku");


  const [timeAttackRankings, setTimeAttackRankings] =
  useState<
    Array<{
      userId: string;
      nickname: string;
      avatarEmoji: string;
      elapsedSeconds: number;
      difficulty: string;
      hintsUsed: number;
    }>
  >([]);

  const [rankings, setRankings] = useState<RankingRow[]>([]);
  const [stats, setStats] = useState<MyStats>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");

  const loadRanking = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/sudoku/ranking?period=${period}&limit=100`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (response.ok) setRankings(data.rankings ?? []);
    } catch (error) {
      console.error("랭킹 불러오기 오류:", error);
    }
  }, [period]);

  const loadTimeAttackRanking = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/timeattack/ranking?game=${selectedGame}&limit=100`,
        { cache: "no-store" },
      );

      const data = await response.json();

      if (response.ok) {
        setTimeAttackRankings(data.rankings ?? []);
      }
    } catch (error) {
      console.error("타임어택 랭킹 불러오기 오류:", error);
    }
  }, [selectedGame]);

  const loadMe = useCallback(async () => {
    try {
      const response = await fetch("/api/sudoku/me", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setStats(data.stats ?? null);
    } catch (error) {
      console.error("내 기록 불러오기 오류:", error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ? { id: data.user.id, email: data.user.email } : null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(
          session?.user
            ? { id: session.user.id, email: session.user.email }
            : null,
        );
        void loadMe();
        void loadRanking();
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadMe, loadRanking, supabase]);

  useEffect(() => {
    void loadRanking();
  }, [loadRanking]);

  useEffect(() => {
    if (rankingMode !== "timeAttack") return;

    void loadTimeAttackRanking();
  }, [loadTimeAttackRanking, rankingMode]);

 useEffect(() => {
  if (refreshKey <= 0) {
    return;
  }

  void loadRanking();

  if (rankingMode === "timeAttack") {
    void loadTimeAttackRanking();
  }

  if (user) {
    void loadMe();
  }
}, [
  loadMe,
  loadRanking,
  loadTimeAttackRanking,
  rankingMode,
  refreshKey,
  user,
]);

  useEffect(() => {
    if (user) void loadMe();
    else setStats(null);
  }, [loadMe, user]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setMessage("이메일을 입력해주세요.");
      return;
    }

    if (password.length < 6) {
      setMessage("비밀번호는 6자 이상 입력해주세요.");
      return;
    }

    if (authMode === "signup") {
      const cleanNickname = nickname.trim();

      if (!cleanNickname) {
        setMessage("닉네임을 입력해주세요.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { nickname: cleanNickname },
          emailRedirectTo: `${window.location.origin}`,
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.session) {
        setMessage(
          "가입 확인 메일을 보냈습니다. 가장 최근 메일의 링크를 눌러주세요.",
        );
      } else {
        setMessage("가입이 완료되었습니다!");
        setAuthOpen(false);
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setAuthOpen(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setStats(null);
  }

  const level = getLevelProgress(stats?.total_score ?? 0);

return (
  <aside className="flex h-full flex-col rounded-[34px] bg-[#f7f5ff] p-6">
    
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-[#928ba8]">
            HOO COMMUNITY
          </p>
          <h3 className="mt-1 text-xl font-black text-[#3f3954]">랭킹</h3>
        </div>
        {loading ? null : user ? (
          <button
            type="button"
            onClick={signOut}
            className="rounded-xl bg-white px-3 py-2 text-xs font-black text-[#746d88]"
          >
            로그아웃
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAuthMode("login");
              setMessage("");
              setAuthOpen(true);
            }}
            className="rounded-xl bg-[#7467d8] px-4 py-2 text-xs font-black text-white"
          >
            로그인
          </button>
        )}
      </div>

      {stats && (
        <div className="mt-4 rounded-2xl bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="font-black text-[#4b4560]">
              {stats.avatar_emoji} {stats.nickname}#{stats.nickname_tag}
            </p>
            <span className="rounded-full bg-[#eeeafd] px-3 py-1 text-xs font-black text-[#6659bf]">
              Lv.{level.level}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ece8f6]">
            <div
              className="h-full rounded-full bg-[#7467d8]"
              style={{ width: `${Math.min(100, level.progressPercent)}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="font-black text-[#332f45]">{stats.total_score}</p>
              <p className="text-[#928ba8]">총점</p>
            </div>
            <div>
              <p className="font-black text-[#332f45]">{stats.completed_games}</p>
              <p className="text-[#928ba8]">완료</p>
            </div>
            <div>
              <p className="font-black text-[#332f45]">🔥 {stats.current_streak}</p>
              <p className="text-[#928ba8]">연속일</p>
            </div>
          </div>
        </div>
      )}

      {!user && (
        <p className="mt-4 rounded-2xl bg-[#fff8dc] px-4 py-3 text-center text-xs font-bold text-[#8a6a20]">
          누구나 플레이할 수 있어요. 로그인하면 점수와 업적이 저장됩니다.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
  <button
    type="button"
    onClick={() => setRankingMode("score")}
    className={`rounded-xl py-2.5 text-xs font-black transition ${
      rankingMode === "score"
        ? "bg-[#51479a] text-white"
        : "bg-white text-[#716a85]"
    }`}
  >
    🏆 종합 점수
  </button>

  <button
    type="button"
    onClick={() => setRankingMode("timeAttack")}
    className={`rounded-xl py-2.5 text-xs font-black transition ${
      rankingMode === "timeAttack"
        ? "bg-[#51479a] text-white"
        : "bg-white text-[#716a85]"
    }`}
  >
    ⚡ 타임어택
  </button>
      </div>

      {rankingMode === "score" && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(Object.keys(PERIOD_LABEL) as RankingPeriod[]).map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setPeriod(item)}
                className={`rounded-xl py-2 text-xs font-black ${
                  period === item
                    ? "bg-[#51479a] text-white"
                    : "bg-white text-[#716a85]"
                }`}
              >
                {PERIOD_LABEL[item]}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-black text-[#403a54]">
              🏆{" "}
              {period === "all"
                ? "종합 점수 랭킹"
                : `${PERIOD_LABEL[period]} 점수 랭킹`}
            </h4>

            <p className="mt-1 text-[11px] font-bold text-[#9b94aa]">
              {period === "all"
                ? "모든 미니게임에서 획득한 점수를 합산한 랭킹입니다."
                : `${PERIOD_LABEL[period]} 동안 획득한 점수 랭킹입니다.`}
            </p>
          </div>

          <div
            className="mt-3 max-h-[330px] space-y-2 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {rankings.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#948da7]">
                첫 주인공이 되어보세요!
              </p>
            ) : (
              rankings.map((row, index) => (
                <div
                  key={row.userId}
                  className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3"
                >
                  <span className="w-7 text-center text-sm font-black text-[#675f7d]">
                    {index < 3
                      ? ["🥇", "🥈", "🥉"][index]
                      : `${index + 1}위`}
                  </span>

                  <span className="text-xl">
                    {row.avatarEmoji || "🦉"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#403a54]">
                      {row.nickname}
                    </p>

                    <p className="text-[11px] font-bold text-[#9b94aa]">
                      쉬움 {row.easyCount} · 보통 {row.normalCount} · 어려움{" "}
                      {row.hardCount}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-[#6659bf]">
                      {row.totalScore}점
                    </p>

                    <p className="text-[10px] text-[#9b94aa]">
                      Lv.{row.level}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {rankingMode === "timeAttack" && (
        <div className="mt-4 rounded-2xl bg-white p-4">
          <div>
            <h4 className="text-sm font-black text-[#403a54]">
              ⚡ 타임어택 랭킹
            </h4>

            <p className="mt-1 text-[11px] font-bold text-[#9b94aa]">
              게임별 가장 빠른 클리어 기록을 보여줍니다.
            </p>
          </div>

          <div className="mt-4">
            <label
              htmlFor="time-attack-game"
              className="text-[11px] font-black text-[#8f88a3]"
            >
              게임 선택
            </label>

            <select
              id="time-attack-game"
              value={selectedGame}
              
             onChange={(event) =>
  setSelectedGame(event.target.value as "sudoku" | "2048")
}

              className="mt-2 w-full rounded-xl border border-[#ded8ef] bg-[#f8f6ff] px-4 py-3 text-sm font-black text-[#403a54] outline-none focus:border-[#7467d8]"
            >

            <option value="sudoku">스도쿠</option>
<option value="2048">HOO2048</option>


            </select>
          </div>

          <div
            className="mt-4 max-h-[330px] space-y-2 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {timeAttackRankings.length === 0 ? (
              <p className="rounded-2xl bg-[#f7f5ff] px-4 py-8 text-center text-sm font-bold text-[#948da7]">
                아직 등록된 타임어택 기록이 없어요.
              </p>
            ) : (
              timeAttackRankings.map((row, index) => (
                <div
                  key={`${row.userId}-${index}`}
                  className="flex items-center gap-3 rounded-2xl bg-[#f7f5ff] px-3 py-3"
                >
                  <span className="w-7 text-center text-sm font-black text-[#675f7d]">
                    {index < 3
                      ? ["🥇", "🥈", "🥉"][index]
                      : `${index + 1}위`}
                  </span>

                  <span className="text-xl">
                    {row.avatarEmoji || "🦉"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#403a54]">
                      {row.nickname}
                    </p>

                <p className="text-[11px] font-bold text-[#9b94aa]">
  {selectedGame === "sudoku"
    ? `${row.difficulty} · 힌트 ${row.hintsUsed}회`
    : row.difficulty}
</p>
                  </div>

                  <p className="text-sm font-black text-[#6659bf]">
                    {Math.floor(row.elapsedSeconds / 60)}:
                    {String(row.elapsedSeconds % 60).padStart(2, "0")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {authOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            onMouseDown={() => setAuthOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={authMode === "login" ? "HOO 로그인" : "HOO 회원가입"}
          >
            <form
              onSubmit={handleAuth}
              onMouseDown={(event) => event.stopPropagation()}
              className="relative w-full max-w-sm space-y-3 rounded-[28px] bg-white p-6 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f1eef9] text-lg font-black text-[#706881] transition hover:bg-[#e5e0f3]"
                aria-label="로그인 창 닫기"
              >
                ×
              </button>

              <h3 className="pr-10 text-2xl font-black text-[#3d374f]">
                {authMode === "login" ? "HOO 로그인" : "HOO 회원가입"}
              </h3>

              {authMode === "signup" && (
                <input
                  type="text"
                  placeholder="닉네임"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  autoComplete="nickname"
                  className="w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                />
              )}

              <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
              />

              <input
                type="password"
                placeholder="비밀번호 (6자 이상)"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
              />

              {message && (
                <p className="text-sm font-bold text-[#d45b72]">{message}</p>
              )}

              <button
                type="submit"
                className="mt-2 w-full rounded-2xl bg-[#7467d8] py-3 font-black text-white transition hover:bg-[#6255c7]"
              >
                {authMode === "login" ? "로그인" : "가입하기"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "signup" : "login");
                  setMessage("");
                }}
                className="w-full text-sm font-bold text-[#7467d8]"
              >
                {authMode === "login"
                  ? "처음이신가요? 회원가입"
                  : "이미 계정이 있나요? 로그인"}
              </button>
            </form>
          </div>,
          document.body,
        )}
    </aside>
  );
}
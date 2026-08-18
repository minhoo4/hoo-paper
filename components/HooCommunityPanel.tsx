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

type AuthMessageTone = "info" | "success" | "error";

const AUTH_EMAIL_LIMIT = 5;
const AUTH_EMAIL_WINDOW_MS = 60 * 60 * 1000;
const AUTH_RESEND_COOLDOWN_SECONDS = 60;

function translateAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("email not confirmed") ||
    normalized.includes("email_not_confirmed")
  ) {
    return "이메일 인증이 아직 완료되지 않았습니다. 아래에서 인증 메일을 다시 받을 수 있어요.";
  }

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid_credentials")
  ) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already registered")
  ) {
    return "이미 가입된 이메일입니다. 로그인하거나 비밀번호를 확인해주세요.";
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("over_email_send_rate_limit")
  ) {
    return "인증 메일 요청 횟수를 초과했습니다. 한 시간 뒤 다시 시도해주세요.";
  }

  if (
    normalized.includes("expired") ||
    normalized.includes("otp_expired")
  ) {
    return "인증 링크가 만료되었습니다. 새 인증 메일을 받아주세요.";
  }

  if (normalized.includes("network")) {
    return "서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.";
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

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
  mini_game_total_score?: number;
  mini_game_scores?: LocalMiniGameScores;
} | null;

const PERIOD_LABEL: Record<RankingPeriod, string> = {
  today: "오늘",
  week: "이번 주",
  all: "종합 점수",
};

type LocalMiniGameScores = {
  shisen: number;
  hoo1952: number;
  bubble: number;
};

const LOCAL_MINIGAME_SCORE_KEYS = {
  shisen: "hoo-shisen-ranking-score",
  hoo1952: "hoo-1952-ranking-score",
  bubble: "hoo-bubble-ranking-score",
} as const;

function readLocalMiniGameScores(): LocalMiniGameScores {
  if (typeof window === "undefined") {
    return { shisen: 0, hoo1952: 0, bubble: 0 };
  }

  const readScore = (key: string) => {
    const value = Number.parseInt(window.localStorage.getItem(key) ?? "0", 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  return {
    shisen: readScore(LOCAL_MINIGAME_SCORE_KEYS.shisen),
    hoo1952: readScore(LOCAL_MINIGAME_SCORE_KEYS.hoo1952),
    bubble: readScore(LOCAL_MINIGAME_SCORE_KEYS.bubble),
  };
}

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
  const [localMiniGameScores, setLocalMiniGameScores] =
    useState<LocalMiniGameScores>({ shisen: 0, hoo1952: 0, bubble: 0 });
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] =
    useState<AuthMessageTone>("info");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hourlyEmailCount, setHourlyEmailCount] = useState(0);

  const loadRanking = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/sudoku/ranking?period=${period}&limit=100`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        setRankings([]);
        return;
      }

      const data = await response.json();

      setRankings(data.rankings ?? []);
    } catch {
      setRankings([]);

      console.warn(
        "랭킹 API에 일시적으로 연결하지 못했습니다.",
      );
    }
  }, [period]);

  const loadTimeAttackRanking = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/timeattack/ranking?game=${selectedGame}&limit=100`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        setTimeAttackRankings([]);
        return;
      }

      const data = await response.json();

      setTimeAttackRankings(
        data.rankings ?? [],
      );
    } catch {
      setTimeAttackRankings([]);

      console.warn(
        "타임어택 랭킹 API에 일시적으로 연결하지 못했습니다.",
      );
    }
  }, [selectedGame]);

  const loadMe = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/sudoku/me",
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        setStats(null);
        return;
      }

      const data = await response.json();

      setStats(data.stats ?? null);
    } catch {
      setStats(null);

      console.warn(
        "내 기록 API에 일시적으로 연결하지 못했습니다.",
      );
    }
  }, []);

  const syncMiniGameScores = useCallback(async () => {
    const browserScores = readLocalMiniGameScores();

    if (!user) {
      setLocalMiniGameScores(browserScores);
      return;
    }

    const hasBrowserScore =
      browserScores.shisen > 0 ||
      browserScores.hoo1952 > 0 ||
      browserScores.bubble > 0;

    try {
      const response = await fetch("/api/minigame-scores", {
        method: hasBrowserScore ? "POST" : "GET",
        headers: hasBrowserScore
          ? { "Content-Type": "application/json" }
          : undefined,
        body: hasBrowserScore
          ? JSON.stringify({ scores: browserScores })
          : undefined,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("미니게임 점수 동기화 실패");
      }

      const data = await response.json();
      const serverScores = data.scores as
        | Partial<LocalMiniGameScores>
        | undefined;

      setLocalMiniGameScores({
        shisen: Number(serverScores?.shisen ?? 0),
        hoo1952: Number(serverScores?.hoo1952 ?? 0),
        bubble: Number(serverScores?.bubble ?? 0),
      });

      await Promise.all([loadMe(), loadRanking()]);
    } catch (error) {
      console.warn("미니게임 점수를 서버와 동기화하지 못했습니다.", error);
      setLocalMiniGameScores(browserScores);
    }
  }, [loadMe, loadRanking, user]);


  const getEmailRequestState = useCallback(() => {
    if (typeof window === "undefined") {
      return { count: 0, timestamps: [] as number[] };
    }

    const storageKey = `hoo-auth-email-requests:${email.trim().toLowerCase()}`;

    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as number[]) : [];
      const now = Date.now();
      const timestamps = parsed.filter(
        (timestamp) => now - timestamp < AUTH_EMAIL_WINDOW_MS,
      );

      window.localStorage.setItem(storageKey, JSON.stringify(timestamps));

      return {
        count: timestamps.length,
        timestamps,
      };
    } catch {
      return { count: 0, timestamps: [] as number[] };
    }
  }, [email]);

  const recordEmailRequest = useCallback(() => {
    if (typeof window === "undefined") return 0;

    const normalizedEmail = email.trim().toLowerCase();
    const storageKey = `hoo-auth-email-requests:${normalizedEmail}`;
    const current = getEmailRequestState();
    const timestamps = [...current.timestamps, Date.now()];

    window.localStorage.setItem(storageKey, JSON.stringify(timestamps));
    setHourlyEmailCount(timestamps.length);

    return timestamps.length;
  }, [email, getEmailRequestState]);

  useEffect(() => {
    const current = getEmailRequestState();
    setHourlyEmailCount(current.count);
  }, [email, getEmailRequestState]);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );

    const authType = params.get("type") ?? hashParams.get("type");
    const authError =
      params.get("error_description") ??
      hashParams.get("error_description");

    if (authError) {
      setAuthMode("login");
      setAuthOpen(true);
      setMessageTone("error");
      setMessage(translateAuthError(decodeURIComponent(authError)));
      return;
    }

    if (authType === "signup" || authType === "email") {
      setAuthMode("login");
      setAuthOpen(true);
      setEmailSent(false);
      setMessageTone("success");
      setMessage(
        "이메일 인증이 완료되었습니다. 이제 가입한 이메일과 비밀번호로 로그인해주세요.",
      );
    }
  }, []);

  useEffect(() => {
  function handleOpenAuthModal(
    event: Event,
  ) {
    const customEvent =
      event as CustomEvent<{
        mode?: "login" | "signup";
      }>;

    const requestedMode =
      customEvent.detail?.mode ===
      "signup"
        ? "signup"
        : "login";

    setAuthMode(
      requestedMode,
    );

    setMessage("");
    setMessageTone("info");
    setEmailSent(false);
    setPassword("");

    if (
      requestedMode === "signup"
    ) {
      setNickname("");
    }

    setAuthOpen(true);
  }

  window.addEventListener(
    "hoo-open-auth-modal",
    handleOpenAuthModal,
  );

  return () => {
    window.removeEventListener(
      "hoo-open-auth-modal",
      handleOpenAuthModal,
    );
  };
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
    const handleMiniGameScoreChange = () => {
      void syncMiniGameScores();
    };

    void syncMiniGameScores();

    window.addEventListener("storage", handleMiniGameScoreChange);
    window.addEventListener(
      "hoo:shisen-ranking-score",
      handleMiniGameScoreChange,
    );
    window.addEventListener(
      "hoo:1952-ranking-score",
      handleMiniGameScoreChange,
    );
    window.addEventListener(
      "hoo:bubble-ranking-score",
      handleMiniGameScoreChange,
    );

    return () => {
      window.removeEventListener("storage", handleMiniGameScoreChange);
      window.removeEventListener(
        "hoo:shisen-ranking-score",
        handleMiniGameScoreChange,
      );
      window.removeEventListener(
        "hoo:1952-ranking-score",
        handleMiniGameScoreChange,
      );
      window.removeEventListener(
        "hoo:bubble-ranking-score",
        handleMiniGameScoreChange,
      );
    };
  }, [syncMiniGameScores]);

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

    if (authSubmitting) return;

    setMessage("");
    setEmailSent(false);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessageTone("error");
      setMessage("이메일을 입력해주세요.");
      return;
    }

    if (password.length < 6) {
      setMessageTone("error");
      setMessage("비밀번호는 6자 이상 입력해주세요.");
      return;
    }

    setAuthSubmitting(true);

    try {
      if (authMode === "signup") {
        const cleanNickname = nickname.trim();

        if (!cleanNickname) {
          setMessageTone("error");
          setMessage("닉네임을 입력해주세요.");
          return;
        }

        const currentRequests = getEmailRequestState();

        if (currentRequests.count >= AUTH_EMAIL_LIMIT) {
          setMessageTone("error");
          setMessage(
            "인증 메일은 한 시간에 최대 5회까지 받을 수 있습니다. 잠시 후 다시 시도해주세요.",
          );
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
          setMessageTone("error");
          setMessage(translateAuthError(error.message));
          return;
        }

        if (!data.session) {
          recordEmailRequest();
          setEmailSent(true);
          setResendCooldown(AUTH_RESEND_COOLDOWN_SECONDS);
          setMessageTone("success");
          setMessage(
            "인증 메일을 보냈습니다. 이메일에서 ‘HOO 가입 완료하기’ 링크를 눌러주세요.",
          );
        } else {
          setMessageTone("success");
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
        setMessageTone("error");
        setMessage(translateAuthError(error.message));

        if (
          error.message.toLowerCase().includes("email not confirmed") ||
          error.message.toLowerCase().includes("email_not_confirmed")
        ) {
          setEmailSent(true);
        }

        return;
      }

      setAuthOpen(false);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function resendConfirmationEmail() {
    if (authSubmitting || resendCooldown > 0) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessageTone("error");
      setMessage("인증 메일을 받을 이메일을 입력해주세요.");
      return;
    }

    const currentRequests = getEmailRequestState();

    if (currentRequests.count >= AUTH_EMAIL_LIMIT) {
      setMessageTone("error");
      setMessage(
        "인증 메일은 한 시간에 최대 5회까지 받을 수 있습니다. 한 시간 뒤 다시 시도해주세요.",
      );
      return;
    }

    setAuthSubmitting(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: cleanEmail,
        options: {
          emailRedirectTo: `${window.location.origin}`,
        },
      });

      if (error) {
        setMessageTone("error");
        setMessage(translateAuthError(error.message));
        return;
      }

      const count = recordEmailRequest();
      setEmailSent(true);
      setResendCooldown(AUTH_RESEND_COOLDOWN_SECONDS);
      setMessageTone("success");
      setMessage(
        `인증 메일을 다시 보냈습니다. 최근에 도착한 메일을 확인해주세요. (${count}/${AUTH_EMAIL_LIMIT}회)`,
      );
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setStats(null);
  }

  const localMiniGameTotal =
    localMiniGameScores.shisen +
    localMiniGameScores.hoo1952 +
    localMiniGameScores.bubble;
  const displayedTotalScore =
  (stats?.total_score ?? 0) +
  localMiniGameTotal;
  const level = getLevelProgress(displayedTotalScore);

  const displayedRankings = rankings;

return (
  <aside className="flex h-[calc(100vh-140px)] max-h-[760px] min-h-0 flex-col overflow-hidden rounded-[34px] bg-[#f7f5ff] p-6">
    
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-[#928ba8]">
            HOO COMMUNITY
          </p>
          <h3 className="mt-1 text-xl font-black text-[#3f3954]">
            종합 랭킹
          </h3>
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
              setMessageTone("info");
              setEmailSent(false);
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
              <p className="font-black text-[#332f45]">{displayedTotalScore}</p>
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
          {localMiniGameTotal > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 rounded-xl bg-[#f7f5ff] px-3 py-2 text-[10px] font-black text-[#746d88]">
              <span>사천성 +{localMiniGameScores.shisen}</span>
              <span>HOO 1952 +{localMiniGameScores.hoo1952}</span>
              <span>HOO BUBBLE +{localMiniGameScores.bubble}</span>
            </div>
          )}
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
        <div className="flex min-h-0 flex-1 flex-col">
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
            className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 [&::-webkit-scrollbar]:hidden"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {displayedRankings.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-[#948da7]">
                첫 주인공이 되어보세요!
              </p>
            ) : (
              displayedRankings.map((row, index) => (
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
        </div>
      )}

      {rankingMode === "timeAttack" && (
        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white p-4">
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
            className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 [&::-webkit-scrollbar]:hidden"
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
                <>
                  <div className="rounded-2xl bg-[#f4f1ff] px-4 py-3 text-xs font-bold leading-5 text-[#665c94]">
                    가입 후 이메일 인증이 필요합니다.
                    <br />
                    인증 메일은 한 시간에 최대 5회까지 받을 수 있어요.
                  </div>

                  <input
                    type="text"
                    placeholder="닉네임"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    autoComplete="nickname"
                    className="w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                  />
                </>
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
                <div
                  className={`rounded-2xl px-4 py-3 text-sm font-bold leading-5 ${
                    messageTone === "success"
                      ? "bg-[#ebfbf2] text-[#27764b]"
                      : messageTone === "error"
                        ? "bg-[#fff0f3] text-[#c04d67]"
                        : "bg-[#f4f1ff] text-[#665c94]"
                  }`}
                >
                  {message}
                </div>
              )}

              {emailSent && (
                <div className="space-y-2 rounded-2xl border border-[#e2dcf5] bg-[#faf9ff] p-4">
                  <p className="text-xs font-black text-[#51479a]">
                    인증 메일 확인 방법
                  </p>
                  <p className="text-xs font-bold leading-5 text-[#746d88]">
                    받은편지함에서 가장 최근에 도착한 HOO 인증 메일을 열고,
                    가입 완료 링크를 눌러주세요. 보이지 않으면 스팸함도 확인해주세요.
                  </p>
                  <p className="text-[11px] font-bold text-[#9a93aa]">
                    최근 1시간 요청: {hourlyEmailCount}/{AUTH_EMAIL_LIMIT}회
                  </p>
                  <button
                    type="button"
                    onClick={resendConfirmationEmail}
                    disabled={
                      authSubmitting ||
                      resendCooldown > 0 ||
                      hourlyEmailCount >= AUTH_EMAIL_LIMIT
                    }
                    className="w-full rounded-xl bg-[#eeeafd] py-2.5 text-xs font-black text-[#6659bf] transition hover:bg-[#e2dcf8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resendCooldown > 0
                      ? `인증 메일 다시 받기 (${resendCooldown}초)`
                      : hourlyEmailCount >= AUTH_EMAIL_LIMIT
                        ? "한 시간 내 발송 한도 도달"
                        : "인증 메일 다시 받기"}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="mt-2 w-full rounded-2xl bg-[#7467d8] py-3 font-black text-white transition hover:bg-[#6255c7] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authSubmitting
                  ? "처리 중..."
                  : authMode === "login"
                    ? "로그인"
                    : "가입하기"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "signup" : "login");
                  setMessage("");
                  setMessageTone("info");
                  setEmailSent(false);
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

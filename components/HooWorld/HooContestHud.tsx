"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ContestHistoryItem, ContestLeaderboard,
  ContestOverview, ContestRank, HooContestApi,
} from "../../lib/hoo-contest/contracts";
import { formatDayHourMinute, formatHoo, formatKst, formatRoi, isContestOver } from "../../lib/hoo-contest/clock";
import styles from "./HooContestHud.module.css";
import HooContestPoster from "@/components/HooContestPoster";

export interface HooContestHudProps {
  /** MUST stay false until approved backend, release gate, and runtime tests are ready. */
  enabled?: boolean;
  allowJoin?: boolean;
  /** Inject an authenticated server adapter. No direct Supabase writes in this component. */
  api: HooContestApi;
}

export default function HooContestHud({ enabled = false, api, allowJoin = false }: HooContestHudProps) {
  if (!enabled) return null;
  return <ContestUI api={api} allowJoin={allowJoin} />;
}

function errText(e: unknown): string { return e instanceof Error ? e.message : "요청에 실패했어요."; }
function positive(n: number): string { return Number.isFinite(n) && n > 0 ? styles.positive : Number.isFinite(n) && n < 0 ? styles.negative : ""; }

function RankTable({ rows }: { rows: ContestRank[] }) {
  const top20 = rows.slice(0, 20);
  if (top20.length === 0) return <div className={styles.empty}>아직 집계된 순위가 없어요.</div>;
  return (
    <div className={styles.scroll} tabIndex={0} role="region" aria-label="대회 순위 스크롤 영역">
      <table className={styles.table}>
        <thead><tr><th scope="col">순위</th><th scope="col">닉네임</th><th scope="col">수익률</th><th scope="col">수익금</th></tr></thead>
        <tbody>
          {top20.map(row => (
            <tr key={`${row.rank}:${row.nickname}`}>
              <td aria-label={`${row.rank}위`}>{row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}</td>
              <td title={row.nickname}>{row.nickname}</td>
              <td className={row.roiPercent === null ? "" : positive(row.roiPercent)}>{formatRoi(row.roiPercent)}</td>
              <td className={positive(row.realizedPnlHoo)}>{row.realizedPnlHoo > 0 ? "+" : ""}{formatHoo(row.realizedPnlHoo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContestUI({ api, allowJoin }: { api: HooContestApi; allowJoin: boolean }) {
  const [overview, setOverview] = useState<ContestOverview | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"ranking" | "history">("ranking");
  const [board, setBoard] = useState<ContestLeaderboard | null>(null);
  const [boardBusy, setBoardBusy] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [history, setHistory] = useState<ContestHistoryItem[] | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [nowMs, setNowMs] = useState(0);
  const overviewFirst = useRef<Promise<ContestOverview> | null>(null);
  const boardInFlight = useRef<Promise<ContestLeaderboard> | null>(null);
  const historyInFlight = useRef<Promise<ContestHistoryItem[]> | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);



  const reloadOverview = useCallback(async (first = false) => {
    setOverviewError("");
    try {
      const pending = first && overviewFirst.current ? overviewFirst.current : api.overview();
      if (first && !overviewFirst.current) overviewFirst.current = pending;
      const result = await pending;
      setOverview(result);
      return result;
    } catch (e) {
      setOverview(null);
      setOpen(false);
      setOverviewError(errText(e));
      // On explicit retry, allow an extra attempt.
      if (first) overviewFirst.current = null;
      return null;
    }
  }, [api]);

  useEffect(() => { void reloadOverview(true); }, [reloadOverview]);

  // HOO_CONTEST_VISIBILITY_RECHECK_V1
  // 탭 복귀 시만 재조회, 주기적 DB 폴링 없음
  useEffect(() => {
    let lastCheck = Date.now();

    const checkOnReturn = () => {
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastCheck < 15000) return;

      lastCheck = now;
      void reloadOverview();
    };

    window.addEventListener("focus", checkOnReturn);
    document.addEventListener("visibilitychange", checkOnReturn);

    return () => {
      window.removeEventListener("focus", checkOnReturn);
      document.removeEventListener("visibilitychange", checkOnReturn);
    };
  }, [reloadOverview]);

  useEffect(() => {
    // Countdown updates only local React state. No HTTP requests or DB polling.
    setNowMs(Date.now());
    const interval = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const contest = overview?.contest ?? null;
  const presentation = overview?.presentation ?? null;
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  useEffect(() => {
    setClockOffsetMs(overview && Number.isFinite(Date.parse(overview.serverNow))
      ? Date.parse(overview.serverNow) - Date.now() : 0);
  }, [overview?.serverNow]);
  const serverAdjustedNow = nowMs + clockOffsetMs;
  const over = contest ? isContestOver(contest.endsAt, serverAdjustedNow) : false;
  const finished = !!contest && (over || ["review", "official", "ended"].includes(contest.phase));
  // A local clock never authorizes participation; only server phase=active can.
  const startsMs = contest ? Date.parse(contest.startsAt) : NaN;
  const active = !!contest
    && contest.phase === "active"
    && !finished
    && Number.isFinite(startsMs)
    && serverAdjustedNow >= startsMs;
  const showContest = !!contest && !finished &&
    (contest.phase === "scheduled" || active);
  const joiningAllowed = allowJoin && active && !overview?.viewer.joined;

  const loadLeaderboard = useCallback(async (id: string, mode: "cached" | "fresh") => {
    if (boardInFlight.current) return boardInFlight.current;
    setBoardBusy(true); setBoardError("");
    const pending = api.leaderboard(id, mode);
    boardInFlight.current = pending;
    try {
      const result = await pending;
      if (result.contestId !== id) throw new Error("랭킹 대회 식별자가 일치하지 않아요.");
      setBoard(result);
      return result;
    } catch (e) {
      setBoardError(errText(e));
      return null;
    } finally {
      boardInFlight.current = null;
      setBoardBusy(false);
    }
  }, [api]);

  const loadHistory = useCallback(async () => {
    if (historyInFlight.current) return historyInFlight.current;
    setHistoryBusy(true); setHistoryError("");
    const pending = api.history();
    historyInFlight.current = pending;
    try { const result = await pending; setHistory(result); return result; }
    catch (e) { setHistoryError(errText(e)); return null; }
    finally { historyInFlight.current = null; setHistoryBusy(false); }
  }, [api]);

  const showDialog = useCallback(() => {
    setOpen(true);
    setTab("ranking");
    if (contest?.phase === "active" && (!board || board.contestId !== contest.id)) void loadLeaderboard(contest.id, "cached");
  }, [board, contest, loadLeaderboard]);

  const showHistory = () => {
    setTab("history");
    if (!history && !historyBusy) void loadHistory();
  };

  useEffect(() => {
    if (!showContest) setOpen(false);
  }, [showContest]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  const join = async () => {
    if (!contest || !joiningAllowed || joining) return;
    setJoining(true); setJoinError("");
    try {
      const result = await api.join(contest.id);
      if (result?.joined !== true) throw new Error("참가 확정 응답을 확인하지 못했어요.");
      // Only server-confirmed success updates joined state. Never optimistic.
      setOverview(prev => prev && prev.contest?.id === contest.id
        ? { ...prev, viewer: { joined: true } } : prev);
    } catch (e) { setJoinError(errText(e)); }
    finally { setJoining(false); }
  };

  const refreshPersonal = () => {
    if (!contest || contest.phase !== "active" || boardBusy) return;
    // Does NOT overwrite the shared hourly snapshot. Server calculates a private result.
    void loadLeaderboard(contest.id, "fresh");
  };

  const currentBoard = board && contest && board.contestId === contest.id ? board : null;
  const resultRows = currentBoard?.rows ?? [];
  const activeHistory = history?.find(item => item.contestId === selectedHistory) ?? null;

  if (!showContest || !overview) return null;
  return (
    <>
      <button type="button" ref={triggerRef} className={styles.hud} onClick={showDialog}
        aria-label={active ? `후레이딩 대회 남은 시간 ${formatDayHourMinute(contest!.endsAt, serverAdjustedNow)}. 랭킹보기` : "후레이딩 대회 랭킹보기"}>
        <span className={styles.hudTitle}>🏆 HOO CONTEST</span>
        <span className={styles.hudClock}>
          {overviewError ? "연결 오류" : !contest ? "대회 대기 중" : active ? formatDayHourMinute(contest.endsAt, serverAdjustedNow) :
            contest.phase === "scheduled" ? (serverAdjustedNow < Date.parse(contest.startsAt) ? `시작까지 ${formatDayHourMinute(contest.startsAt, serverAdjustedNow)}` : "시작 처리 대기") : contest.phase === "official" ? "공식 결과" : "대회 종료"}
        </span>
        <span className={styles.hudHint}>랭킹보기 <span aria-hidden="true">›</span></span>
      </button>
      {open && (
        <div className={styles.backdrop} onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="후레이딩 대회" tabIndex={-1} ref={dialogRef}>
            <div className={styles.heading}>
              <div className={styles.headingTitle}>🏆 HOO TRADING CONTEST</div>
              <div className={styles.actions}>
                {tab === "ranking" && contest && (
                  <button type="button" className={styles.refresh} disabled={!active || boardBusy} onClick={refreshPersonal}
                    title="내 화면에만 최신 순위 조회" aria-label="최신 랭킹 수동 갱신">↻ 갱신</button>
                )}
                <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="닫기">✕</button>
              </div>
            </div>
            {overviewError && <div className={styles.error} role="alert">{overviewError}<button type="button" className={styles.refresh} onClick={() => void reloadOverview()}>다시 조회</button></div>}
            {contest ? (
              <>
                {/* HOO_CONTEST_DYNAMIC_POSTER_V1: uses contest API data, no DB writes */}
                <HooContestPoster contest={{
                  title: contest.title,
                  startsAt: contest.startsAt,
                  endsAt: contest.endsAt,
                  prizesHoo: {
                    first: contest.prizesHoo.first,
                    second: contest.prizesHoo.second,
                    third: contest.prizesHoo.third,
                  },
                  phase: ["draft", "scheduled", "active", "review", "official", "ended"].includes(String(contest.phase))
                    ? (contest.phase as "draft" | "scheduled" | "active" | "review" | "official" | "ended")
                    : "scheduled",
                }} />
                {joinError && <div className={styles.error} role="alert">{joinError}</div>}
                {!finished && <button type="button" className={`${styles.join} ${overview?.viewer.joined ? styles.joined : ""}`}
                  onClick={join} disabled={!joiningAllowed || joining}>
                  {overview?.viewer.joined ? "참가완료!" : joining ? "참가 처리 중…" :
                    !allowJoin ? "참가 기능 준비 중" : active ? "무료 참가" : contest.phase === "scheduled" ? "개최 후 참가 가능" : "참가 마감"}
                </button>}
                {!finished && !overview?.viewer.joined && (
                  <div className={styles.subtle} style={{ textAlign: "center", marginBottom: 12 }}>
                    무료 참가 · 신청 후 중도 취소 불가
                  </div>
                )}
              </>
            ) : <div className={styles.empty}>현재 진행 중인 대회가 없습니다.</div>}
            <div className={styles.tabs} role="tablist" aria-label="대회 정보">
              <button type="button" role="tab" aria-selected={tab === "ranking"} className={`${styles.tab} ${tab === "ranking" ? styles.tabActive : ""}`}
                onClick={() => {setTab("ranking");if (contest?.phase === "active" && (!board || board.contestId !== contest.id)) void loadLeaderboard(contest.id,"cached");}}>{finished ? "최종 결과" : contest?.phase === "scheduled" ? "대회 랭킹 (개최 후)" : "진행 중 랭킹"}</button>
              <button type="button" role="tab" aria-selected={tab === "history"} className={`${styles.tab} ${tab === "history" ? styles.tabActive : ""}`} onClick={showHistory}>지난 대회</button>
            </div>
            {tab === "ranking" ? (
              <>
                <div className={styles.meta}>
                  <span>{currentBoard?.official ? "공식 확정 결과" : finished ? "잠정 결과 · 관리자 검증 대기" : "TOP20 · 1시간 공용 집계"}</span>
                  <span>{currentBoard ? `기준 ${formatKst(currentBoard.snapshotAt)}` : ""}</span>
                </div>
                {boardError && <div className={styles.error} role="alert">{boardError}</div>}
                {boardBusy && <div className={styles.subtle} role="status">랭킹을 확인하고 있어요…</div>}
                {(!boardBusy || board) && <RankTable rows={resultRows} />}
                <div className={styles.subtle} style={{ marginTop: 9 }}>
                  {finished ? "상금은 관리자 검증·승인 후 별도 지급됩니다." : currentBoard?.source === "personal" ? "내 화면만 최신 랭킹으로 갱신되었습니다. 공용 순위는 그대로 유지됩니다." :
                    "공용 랭킹은 1시간마다 집계됩니다. 우측 상단 ↻ 갱신은 내 화면에만 적용돼요."}
                </div>
              </>
            ) : (
              <>
                {historyBusy && <div className={styles.subtle}>지난 대회 기록을 불러오는 중…</div>}
                {historyError && <div className={styles.error} role="alert">{historyError}</div>}
                {history?.length === 0 && <div className={styles.empty}>기록된 지난 대회가 없습니다.</div>}
                {history?.map(item => (
                  <button key={item.contestId} type="button" className={styles.historyBtn}
                    onClick={() => setSelectedHistory(old => old === item.contestId ? null : item.contestId)}>
                    {item.title} <small>{formatKst(item.endedAt)} · {item.official ? "공식 결과" : "검증 대기"}</small>
                  </button>
                ))}
                {activeHistory && <RankTable rows={activeHistory.top} />}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

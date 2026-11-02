"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import HooContestPoster from "@/components/HooContestPoster";
import { toContestInstant, type ContestPosterData, type ContestPosterPhase } from "@/lib/hooContestPoster";
import styles from "./HooContestWelcomePopup.module.css";

type PublicContest = ContestPosterData & { id: string };
const LANDING_ROUTES = new Set(["/", "/hoo-world"]);
const VISIBLE_PHASES = new Set<ContestPosterPhase>(["scheduled", "active"]);

/** Korea calendar day; do not use the visitor's local system timezone. */
function kstDay(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function readPublicContest(payload: unknown): PublicContest | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as Record<string, unknown>;
  // Fail closed on explicit public feature / publication flags.
  if (response.enabled === false || response.featureEnabled === false || response.public === false) return null;
  const wrapper = response.data && typeof response.data === "object"
    ? (response.data as Record<string, unknown>) : response;
  if (wrapper.enabled === false || wrapper.featureEnabled === false || wrapper.public === false) return null;
  const candidate = wrapper.contest;
  if (!candidate || typeof candidate !== "object") return null;
  const contest = candidate as Record<string, unknown>;
  if (contest.published === false || contest.isPublished === false || contest.isPublic === false) return null;
  if (typeof contest.status === "string" && contest.status !== "active") return null;
  if (typeof contest.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(contest.id)) return null;
  if (typeof contest.title !== "string" || !contest.title.trim()) return null;
  if (typeof contest.phase !== "string" || !VISIBLE_PHASES.has(contest.phase as ContestPosterPhase)) return null;
  if (typeof contest.startsAt !== "string" || typeof contest.endsAt !== "string") return null;
  const start = toContestInstant(contest.startsAt);
  const end = toContestInstant(contest.endsAt);
  if (!start || !end || end.getTime() <= start.getTime() || end.getTime() <= Date.now()) return null;
  const p = contest.prizesHoo;
  if (!p || typeof p !== "object") return null;
  const prizes = p as Record<string, unknown>;
  if (![prizes.first, prizes.second, prizes.third].every(
    v => typeof v === "number" && Number.isFinite(v) && v >= 0
  )) return null;
  return {
    id: contest.id,
    title: contest.title,
    startsAt: contest.startsAt,
    endsAt: contest.endsAt,
    prizesHoo: {
      first: prizes.first as number,
      second: prizes.second as number,
      third: prizes.third as number,
    },
    phase: contest.phase as ContestPosterPhase,
  };
}

/**
 * Mounted once in the root layout. One read-only GET on first HOO landing route.
 * No database write, no timer/polling, no extra fetch after closing.
 * An unpublished draft can NEVER be displayed merely because admin pressed Apply.
 */
export default function HooContestWelcomePopup() {
  const pathname = usePathname();
  const checkedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [contest, setContest] = useState<PublicContest | null>(null);

  useEffect(() => {
    if (checkedRef.current || !pathname || !LANDING_ROUTES.has(pathname)) return;
    checkedRef.current = true;
    let mounted = true;
    void (async () => {
      try {
        const response = await fetch("/api/hoo-contest/overview", {
          method: "GET", credentials: "same-origin", cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        const item = readPublicContest(payload);
        if (!mounted || !item) return;
        const day = kstDay();
        const viewKey = `hoo:contest:welcome:viewed:${item.id}:${day}`;
        const hideKey = `hoo:contest:welcome:hide-today:${item.id}`;
        try {
          if (sessionStorage.getItem(viewKey) === "1" || localStorage.getItem(hideKey) === day) return;
          sessionStorage.setItem(viewKey, "1");
        } catch {
          // Browser storage unavailable: display remains dismissible for this mount.
        }
        setContest(item);
      } catch {
        // No banner if the public API is unavailable or rejects an unauthenticated visitor.
      }
    })();
    return () => { mounted = false; };
  }, [pathname]);

  useEffect(() => {
    if (!contest) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContest(null);
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      restoreFocusRef.current?.focus();
    };
  }, [contest]);

  if (!contest) return null;
  const dismiss = () => setContest(null);
  const hideToday = () => {
    try { localStorage.setItem(`hoo:contest:welcome:hide-today:${contest.id}`, kstDay()); }
    catch { /* storage restricted */ }
    dismiss();
  };

  return createPortal(
    <div className={styles.overlay} onMouseDown={event => {
      if (event.target === event.currentTarget) dismiss();
    }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true"
        aria-labelledby="hoo-contest-welcome-title" className={styles.dialog}>
        <header className={styles.header}>
          <h2 id="hoo-contest-welcome-title">🏆 HOO CONTEST</h2>
          <button type="button" className={styles.close} onClick={dismiss} aria-label="대회 안내 닫기">✕</button>
        </header>
        <div className={styles.poster}><HooContestPoster contest={contest} /></div>
        <footer className={styles.footer}>
          <button type="button" className={styles.hideToday} onClick={hideToday}>오늘 하루 안 보기</button>
          <button type="button" className={styles.confirm} onClick={dismiss}>닫기</button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

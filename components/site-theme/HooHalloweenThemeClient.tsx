"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * HOO Halloween V12 — SAFE SKIN.
 * - Zero inserted decorative DOM nodes (no overlay can cover controls).
 * - Never touches user's wallpaper or persists local settings.
 * - Source-level opt-in via data-hoo-skin="..." is preferred.
 * - Conservative fallback marks existing dashboard containers until actual
 *   app/page.tsx can be annotated. Does not change JSX or handlers.
 * - Admin RPC remains the sole source of truth.
 */
type ThemeState = "loading" | "on" | "off" | "error";
type Surface =
  | "home-brief" | "todo-main" | "todo-progress" | "calendar-grid"
  | "calendar-detail" | "memo-main" | "memo-folders" | "games-main"
  | "ranking" | "playlist-poster" | "music-list" | "music-record"
  | "music-video";

const SELECTORS = "h1,h2,h3,h4,p,span,strong,label,button,a,[aria-label]";
const AUTO_MARKS = ["data-hoo-h-panel", "data-hoo-h-action", "data-hoo-h-search", "data-hoo-h-bookmark", "data-hoo-h-bar", "data-hoo-h-brand", "data-hoo-h-widget"] as const;

function isVisible(node: Element): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false;
  const r = node.getBoundingClientRect();
  if (r.width < 4 || r.height < 4 || r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) return false;
  if (node.closest('[aria-hidden="true"], [inert], [role="dialog"], [data-hoo-theme-no-skin]')) return false;
  const s = getComputedStyle(node);
  return s.display !== "none" && s.visibility !== "hidden";
}
function label(node: HTMLElement) {
  if (node.childElementCount > 2 && !node.hasAttribute("aria-label")) return "";
  const value = (node.getAttribute("aria-label") || node.textContent || "").trim().replace(/\s+/g, " ");
  return value.length <= 90 ? value : "";
}
function safeContainer(node: HTMLElement, minWidth: number, minHeight: number) {
  if (node.matches("html,body")) return false;
  if (node.closest('[data-hoo-theme-no-skin], [role="dialog"]')) return false;
  if (node.hasAttribute("data-hoo-h-ornament")) return false;
  const r = node.getBoundingClientRect();
  // Avoid wallpaper/viewports, floating modal shells and small controls.
  if (r.width < minWidth || r.height < minHeight || r.width > innerWidth * 0.96 || r.height > innerHeight * 1.55) return false;
  const style = node.getAttribute("style") || "";
  if (/background(?:-image)?\s*:\s*url\(/i.test(style)) return false;
  const cn = typeof node.className === "string" ? node.className : "";
  return /rounded|border|shadow|backdrop|panel|card|bg-\[|bg-black|bg-slate|bg-gray/.test(cn) || node.matches("article,aside,section");
}
function nearestPanel(anchor: HTMLElement, width: number, height: number): HTMLElement | null {
  let node = anchor.parentElement;
  for (let i = 0; i < 10 && node; i++, node = node.parentElement) {
    if (safeContainer(node, width, height)) return node;
  }
  return null;
}
function clearAutoMarks() {
  document.querySelectorAll<HTMLElement>(AUTO_MARKS.map(attr => `[${attr}]`).join(",")).forEach(node => {
    for (const attr of AUTO_MARKS) node.removeAttribute(attr);
  });
  // Remove only legacy injected ornaments; never remove app content.
  document.querySelectorAll<HTMLElement>('[data-hoo-h-ornament]').forEach(node => node.remove());
  delete document.documentElement.dataset.hooHScreen;
}
function paintForeground(): number {
  clearAutoMarks();
  const labels: Array<{ node: HTMLElement; text: string }> = [];
  for (const node of Array.from(document.querySelectorAll<HTMLElement>(SELECTORS))) {
    if (!isVisible(node)) continue;
    const text = label(node);
    if (text) labels.push({ node, text });
  }
  const match = (re: RegExp) => labels.find(item => re.test(item.text))?.node;
  const has = (re: RegExp) => labels.some(item => re.test(item.text));
  const screen = has(/^MUSIC PICK$/i) ? "music" :
    has(/HOO.?PLAY.?LIST/i) ? "playlist" :
    has(/^게임 선택$|HOO MINI GAME/i) ? "games" :
    has(/^메모장$|HOO MEMO/i) ? "memo" :
    has(/HOO CALENDAR|새 일정 만들기|SELECTED DATE/i) ? "calendar" :
    has(/^오늘의 할 일$|HOO TO DO/i) ? "todo" : "home";
  document.documentElement.dataset.hooHScreen = screen;
  const panels: Array<[RegExp, Surface, number, number]> = [
    [/^오늘의 할 일$|HOO TO DO/i, "todo-main", 420, 240],
    [/오늘의 달성률|TODAY PROGRESS/i, "todo-progress", 270, 230],
    [/HOO CALENDAR|^\d{4}년\s*\d{1,2}월$/i, "calendar-grid", 470, 280],
    [/^SELECTED DATE$|^일정 내용$|^새 일정 만들기$/i, "calendar-detail", 310, 260],
    [/^메모장$|^HOO MEMO$/i, "memo-main", 430, 240],
    [/^후디노트 정리본$|^HOO STUDY NOTE$/i, "memo-folders", 275, 210],
    [/^게임 선택$|HOO MINI GAME/i, "games-main", 420, 240],
    [/^종합 랭킹$/i, "ranking", 260, 260],
    [/^HOO.?PLAY.?LIST$|Music Connects Us/i, "playlist-poster", 260, 240],
    [/^추천곡(?:\s*\d+)?$/i, "music-list", 205, 220],
    [/^YouTube$/i, "music-video", 200, 150],
    [/^오늘의 브리핑$/i, "home-brief", 290, 45],
  ];
  for (const [re, kind, w, h] of panels) {
    const anchor = match(re);
    if (!anchor) continue;
    const target = nearestPanel(anchor, w, h);
    if (target && !target.hasAttribute("data-hoo-skin") && !target.dataset.hooHPanel) {
      target.dataset.hooHPanel = kind;
    }
  }
  if (screen === "music") {
    const disk = document.querySelector<HTMLElement>('[aria-label*="vinyl" i], [aria-label*="레코드"], [class*="turntable"]');
    if (disk && isVisible(disk)) {
      const target = nearestPanel(disk, 310, 240);
      if (target && !target.dataset.hooHPanel && !target.hasAttribute("data-hoo-skin")) target.dataset.hooHPanel = "music-record";
    }
  }
  for (const { node, text } of labels) {
    if (text === "HOO" && node.getBoundingClientRect().height >= 44) node.dataset.hooHBrand = "1";
    const button = node.matches("button,a") ? node : node.closest<HTMLElement>("button,a");
    if (!button) continue;
    if (/^(추가|검색|메모 저장|일정 저장|리듬후 플레이|스도쿠 플레이|오늘|지금, 음악과 연결되기)$/.test(text)) button.dataset.hooHAction = "primary";
    if (/^(FOCUS MODE|HOO 설치|시크릿 ON)$/.test(text)) { button.dataset.hooHAction = "secondary";button.dataset.hooHWidget = "1"; }
  }
  for (const input of Array.from(document.querySelectorAll<HTMLInputElement>('input[placeholder*="Google" i]'))) {
    if (!isVisible(input)) continue;
    let parent = input.parentElement;
    for (let i = 0; i < 4 && parent; i++, parent = parent.parentElement) {
      const box = parent.getBoundingClientRect();
      if (box.width > 250 && box.height > 28 && box.height < 104) {
        parent.dataset.hooHSearch = "1";
        let header = parent.parentElement;
        for (let k = 0; k < 4 && header; k++, header = header.parentElement) {
          const h = header.getBoundingClientRect();
          if (h.width > 450 && h.height >= 38 && h.height <= 106) {header.dataset.hooHBar = "1";break;}
        }
        break;
      }
    }
  }
  if (screen === "home") {
    let n = 0;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("button,a"))) {
      if (n === 8) break;
      const r = el.getBoundingClientRect();
      if (isVisible(el) && (el.textContent?.trim() === "+" || (el.getAttribute("aria-label") || "").includes("즐겨찾기")) && r.width >= 55 && r.width < 180 && r.height >= 35 && r.height < 145) {
        el.dataset.hooHBookmark = String(++n);
      }
    }
  }
  // The data-hoo-skin opt-ins are the future source-level integration points.
  // They are not removed by the client and work without any text matching.
  return document.querySelectorAll("[data-hoo-h-panel], [data-hoo-skin]").length;
}

export default function HooHalloweenThemeClient() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const supabase = useMemo(() => createClient(), []);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<ThemeState>("loading");
  const [detail, setDetail] = useState("");
  const [count, setCount] = useState(0);
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get("hooThemeDebug") === "1");
  }, [pathname]);

  useEffect(() => {
    if (!onHome) { setStatus("loading"); return; }
    let alive = true;
    let loading = false;
    async function refresh() {
      if (!alive || loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const { data, error } = await supabase.rpc("hoo_get_site_theme");
        if (!alive) return;
        if (error) throw new Error(error.message);
        if (typeof data !== "boolean") throw new Error(`테마 RPC가 boolean 대신 ${String(data)} 반환`);
        setActive(data);
        setStatus(data ? "on" : "off");
        setDetail("");
      } catch (e) {
        if (!alive) return;
        setStatus("error");
        setDetail(e instanceof Error ? e.message : String(e));
      } finally { loading = false; }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 25_000);
    const focus = () => void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const update = (event: Event) => {
      const next = (event as CustomEvent<{enabled?: boolean}>).detail?.enabled;
      if (typeof next !== "boolean") return;
      setActive(next);
      setStatus(next ? "on" : "off");
      setDetail("");
    };
    window.addEventListener("focus", focus);
    window.addEventListener("pageshow", focus);
    window.addEventListener("hoo-seasonal-theme-change", update);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("pageshow", focus);
      window.removeEventListener("hoo-seasonal-theme-change", update);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [onHome, supabase]);

  useEffect(() => {
    if (!onHome || !active) {
      delete document.documentElement.dataset.hooSeason;
      clearAutoMarks();
      setCount(0);
      return;
    }
    document.documentElement.dataset.hooSeason = "halloween";
    let scheduled: number | undefined;
    let lastRun = 0;
    function update() {
      lastRun = performance.now();
      const marked = paintForeground();
      setCount(old => old === marked ? old : marked);
    }
    function schedule() {
      if (scheduled !== undefined) return;
      scheduled = window.setTimeout(() => { scheduled = undefined; update(); }, Math.max(250, 650 - (performance.now() - lastRun)));
    }
    update();
    const observer = new MutationObserver(changes => {
      if (changes.some(change => change.addedNodes.length || change.removedNodes.length)) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", schedule, { passive: true });
    const late = window.setTimeout(schedule, 1400);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", schedule);
      window.clearTimeout(late);
      if (scheduled !== undefined) window.clearTimeout(scheduled);
      delete document.documentElement.dataset.hooSeason;
      clearAutoMarks();
    };
  }, [onHome, active]);

  if (!onHome || !debug) return null;
  return <output aria-live="polite" style={{position:"fixed",bottom:12,left:130,zIndex:999999,background:"#1b1024",color:"#ffdaad",padding:"8px 12px",border:"1px solid #ff9c50",borderRadius:12,fontSize:12,pointerEvents:"none"}}>
    🎃 V12 | 서버 {status.toUpperCase()} | 패널 {count}개
    {detail ? <span style={{display:"block",color:"#ff9292"}}>RPC 오류: {detail}</span> : null}
  </output>;
}

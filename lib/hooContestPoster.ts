/** HOO CONTEST poster is a *view*. It never performs auth, DB writes or uploads. */
export type ContestPosterPhase =
  | "draft" | "scheduled" | "active" | "review" | "official" | "ended";

export type ContestPosterData = {
  title: string;
  startsAt: string | null;  // ISO UTC(+offset) from server or KST YYYY-MM-DDTHH:mm from admin input
  endsAt: string | null;
  prizesHoo: { first: number; second: number; third: number };
  phase: ContestPosterPhase;
};

export const CONTEST_DEMO: ContestPosterData = {
  title: "제1회 HOO TRADING CONTEST",
  startsAt: "2026-11-05T09:00:00+09:00",
  endsAt: "2026-11-12T21:00:00+09:00",
  prizesHoo: { first: 100, second: 50, third: 30 },
  phase: "scheduled",
};

const phaseLabels: Record<ContestPosterPhase, string> = {
  draft: "DRAFT", scheduled: "COMING SOON", active: "NOW LIVE",
  review: "RESULTS PENDING", official: "OFFICIAL RESULTS", ended: "ENDED",
};

export function posterStatus(phase: ContestPosterPhase): string {
  return phaseLabels[phase] ?? "COMING SOON";
}

export function formatPrizeHoo(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "미정";
  return new Intl.NumberFormat("ko-KR", {maximumFractionDigits:3}).format(value);
}

export function toContestInstant(value: string | null): Date | null {
  if (!value?.trim()) return null;
  const normalized = value.trim();
  // Admin's datetime-local is KST, not browser/computer local timezone.
  const iso = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized)
    ? normalized : `${normalized.replace(" ","T")}${normalized.length===16 ? ":00" : ""}+09:00`;
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Convert persisted ISO UTC/offset datetime to the input type=datetime-local (KST). */
export function toContestKstInput(value: string | null): string {
  const date = toContestInstant(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const get = (key: Intl.DateTimeFormatPartTypes) => parts.find(p=>p.type===key)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatContestKst(value: string | null): string {
  const date = toContestInstant(value);
  if (!date) return "일정 미정";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year:"numeric",month:"2-digit",day:"2-digit",
    weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  }).formatToParts(date);
  const get = (key: Intl.DateTimeFormatPartTypes) => parts.find(p=>p.type===key)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} (${get("weekday")}) ${get("hour")}:${get("minute")}`;
}

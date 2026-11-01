/** Pure utilities, no timers or network requests. */
export function remainingMinutes(endAt: string, nowMs: number): number {
  const endMs = Date.parse(endAt);
  if (!Number.isFinite(endMs) || !Number.isFinite(nowMs)) return 0;
  // Never display 00:00:00 before the server deadline actually arrives.
  return Math.max(0, Math.ceil((endMs - nowMs) / 60000));
}

export function formatDayHourMinute(endAt: string, nowMs: number): string {
  const minutes = remainingMinutes(endAt, nowMs);
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;
  return `D-${days} ${String(hours).padStart(2, "0")} : ${String(mins).padStart(2, "0")}`;
}

export function isContestOver(endAt: string, nowMs: number): boolean {
  const endMs = Date.parse(endAt);
  return Number.isFinite(endMs) && Number.isFinite(nowMs) && nowMs >= endMs;
}

export function formatHoo(value: number): string {
  if (!Number.isFinite(value)) return "–";
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value);
}
export function formatRoi(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "–";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}
export function formatKst(timestamp: string): string {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return "기준시각 확인 중";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

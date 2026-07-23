import type { FocusView } from "../types/focus";

export function formatFocusTime(
  totalSeconds: number,
) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor(
    (safeSeconds % 3600) / 60,
  );
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
}

export function formatDurationLabel(
  totalSeconds: number,
) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  );
  const seconds = totalSeconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}시간`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}분`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}초`);
  }

  return parts.join(" ");
}

export function formatProfileDuration(
  totalSeconds: number,
) {
  const safeSeconds = Math.max(
    0,
    Math.floor(totalSeconds),
  );

  const hours = Math.floor(
    safeSeconds / 3600,
  );

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60,
  );

  const seconds =
    safeSeconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}시간`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}분`);
  }

  if (
    seconds > 0 ||
    parts.length === 0
  ) {
    parts.push(`${seconds}초`);
  }

  return parts.join(" ");
}

export function getFocusBackdropClass(
  view: FocusView,
) {
  const baseClass =
    "fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-700 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

  if (view === "timer") {
    return `${baseClass} bg-black/[0.97] backdrop-blur-2xl`;
  }

  if (view === "completed") {
    return `${baseClass} bg-black/[0.92] backdrop-blur-2xl`;
  }

  return `${baseClass} bg-[#010610]/70 backdrop-blur-xl`;
}

"use client";

type FocusPresenceBadgeProps = {
  count: number;
  status:
    | "idle"
    | "connecting"
    | "connected"
    | "unavailable"
    | "error";
};

export default function FocusPresenceBadge({
  count,
  status,
}: FocusPresenceBadgeProps) {
  if (
    status === "idle" ||
    status === "unavailable" ||
    status === "error"
  ) {
    return null;
  }

  const message =
    status === "connecting"
      ? "함께 집중하는 사람을 확인하고 있어요"
      : `현재 ${Math.max(
          1,
          count,
        ).toLocaleString(
          "ko-KR",
        )}명이 함께 집중 중이에요`;

  return (
    <div
      className="mx-auto mt-5 flex w-fit items-center justify-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-4 py-2 text-xs font-bold text-white/42"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="relative flex h-2.5 w-2.5">
        {status === "connected" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/45" />
        )}

        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            status === "connected"
              ? "bg-emerald-300"
              : "bg-[#9385ff]"
          }`}
        />
      </span>

      <span>{message}</span>
    </div>
  );
}

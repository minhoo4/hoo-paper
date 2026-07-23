import {
  HOO_FOCUS_HISTORY_STORAGE_KEY,
} from "../constants/focus";
import type {
  FocusHistory,
} from "../types/focus";
import {
  createFocusMemoId,
} from "./id";

export type SaveFocusHistoryInput = {
  goal: string;
  plannedSeconds: number;
  actualSeconds: number;
  startedAt: string | null;
};

export function loadFocusHistory():
  FocusHistory[] {
  try {
    const savedHistory =
      window.localStorage.getItem(
        HOO_FOCUS_HISTORY_STORAGE_KEY,
      );

    if (!savedHistory) {
      return [];
    }

    const parsedHistory: unknown =
      JSON.parse(savedHistory);

    if (!Array.isArray(parsedHistory)) {
      return [];
    }

    return parsedHistory
      .map(
        (
          history,
        ): FocusHistory | null => {
          if (
            typeof history !== "object" ||
            history === null
          ) {
            return null;
          }

          const candidate = history as {
            id?: unknown;
            goal?: unknown;
            durationSeconds?: unknown;
            plannedSeconds?: unknown;
            actualSeconds?: unknown;
            startedAt?: unknown;
            completedAt?: unknown;
          };

          if (
            typeof candidate.id !== "string" ||
            typeof candidate.goal !== "string" ||
            typeof candidate.completedAt !==
              "string"
          ) {
            return null;
          }

          const completedAt = new Date(
            candidate.completedAt,
          );

          if (
            Number.isNaN(completedAt.getTime())
          ) {
            return null;
          }

          const legacyDuration =
            typeof candidate.durationSeconds ===
              "number" &&
            Number.isFinite(
              candidate.durationSeconds,
            ) &&
            candidate.durationSeconds >= 1
              ? candidate.durationSeconds
              : null;

          const plannedSeconds =
            typeof candidate.plannedSeconds ===
              "number" &&
            Number.isFinite(
              candidate.plannedSeconds,
            ) &&
            candidate.plannedSeconds >= 1
              ? candidate.plannedSeconds
              : legacyDuration;

          const actualSeconds =
            typeof candidate.actualSeconds ===
              "number" &&
            Number.isFinite(
              candidate.actualSeconds,
            ) &&
            candidate.actualSeconds >= 1
              ? candidate.actualSeconds
              : legacyDuration ??
                plannedSeconds;

          if (
            plannedSeconds === null ||
            actualSeconds === null
          ) {
            return null;
          }

          const fallbackStartedAt =
            new Date(
              completedAt.getTime() -
                actualSeconds * 1000,
            ).toISOString();

          const startedAt =
            typeof candidate.startedAt ===
              "string" &&
            !Number.isNaN(
              new Date(
                candidate.startedAt,
              ).getTime(),
            )
              ? candidate.startedAt
              : fallbackStartedAt;

          return {
            id: candidate.id,
            goal: candidate.goal,
            plannedSeconds,
            actualSeconds,
            startedAt,
            completedAt:
              candidate.completedAt,
          };
        },
      )
      .filter(
        (
          history,
        ): history is FocusHistory =>
          history !== null,
      )
      .sort(
        (a, b) =>
          new Date(
            b.completedAt,
          ).getTime() -
          new Date(
            a.completedAt,
          ).getTime(),
      );
  } catch (error) {
    console.error(
      "집중 기록을 불러오지 못했습니다.",
      error,
    );

    return [];
  }
}

export function saveFocusHistoryRecord({
  goal,
  plannedSeconds,
  actualSeconds,
  startedAt,
}: SaveFocusHistoryInput) {
  const history = loadFocusHistory();
  const completedAt = new Date();

  const safeStartedAt =
    startedAt ??
    new Date(
      completedAt.getTime() -
        actualSeconds * 1000,
    ).toISOString();

  const newHistory: FocusHistory = {
    id: createFocusMemoId(),
    goal,
    plannedSeconds,
    actualSeconds,
    startedAt: safeStartedAt,
    completedAt:
      completedAt.toISOString(),
  };

  const nextHistory = [
    newHistory,
    ...history,
  ];

  window.localStorage.setItem(
    HOO_FOCUS_HISTORY_STORAGE_KEY,
    JSON.stringify(nextHistory),
  );

  window.dispatchEvent(
    new CustomEvent(
      "hoo-focus-history-updated",
      {
        detail: nextHistory,
      },
    ),
  );

  return nextHistory;
}

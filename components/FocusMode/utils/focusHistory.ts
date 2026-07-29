import {
  HOO_FOCUS_HISTORY_STORAGE_KEY,
} from "../constants/focus";

import type {
  FocusHistory,
} from "../types/focus";

import {
  createFocusMemoId,
} from "./id";

import {
  createClient,
} from "@/lib/supabase/client";

export type SaveFocusHistoryInput = {
  goal: string;
  plannedSeconds: number;
  actualSeconds: number;
  startedAt: string | null;
};

type FocusHistoryDatabaseRow = {
  id: string;
  goal: string;
  planned_seconds: number;
  actual_seconds: number;
  started_at: string;
  completed_at: string;
};

/* ─────────────────────────────
   공통 함수
───────────────────────────── */

function isValidDateString(
  value: unknown,
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return !Number.isNaN(
    new Date(value).getTime(),
  );
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function createFocusHistoryId() {
  if (
    typeof window !== "undefined" &&
    window.crypto?.randomUUID
  ) {
    return window.crypto.randomUUID();
  }

  return createFocusMemoId();
}

function sortFocusHistory(
  history: FocusHistory[],
) {
  return [...history].sort(
    (a, b) =>
      new Date(
        b.completedAt,
      ).getTime() -
      new Date(
        a.completedAt,
      ).getTime(),
  );
}

function dispatchFocusHistoryUpdated(
  history: FocusHistory[],
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      "hoo-focus-history-updated",
      {
        detail: history,
      },
    ),
  );
}

function saveFocusHistoryToLocal(
  history: FocusHistory[],
  shouldDispatch = true,
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  const sortedHistory =
    sortFocusHistory(history);

  window.localStorage.setItem(
    HOO_FOCUS_HISTORY_STORAGE_KEY,
    JSON.stringify(sortedHistory),
  );

  if (shouldDispatch) {
    dispatchFocusHistoryUpdated(
      sortedHistory,
    );
  }
}

function normalizeFocusHistoryItem(
  history: unknown,
): FocusHistory | null {
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
    !isValidDateString(
      candidate.completedAt,
    )
  ) {
    return null;
  }

  const completedAt = new Date(
    candidate.completedAt,
  );

  const legacyDuration =
    typeof candidate.durationSeconds ===
      "number" &&
    Number.isFinite(
      candidate.durationSeconds,
    ) &&
    candidate.durationSeconds >= 1
      ? Math.floor(
          candidate.durationSeconds,
        )
      : null;

  const plannedSeconds =
    typeof candidate.plannedSeconds ===
      "number" &&
    Number.isFinite(
      candidate.plannedSeconds,
    ) &&
    candidate.plannedSeconds >= 1
      ? Math.floor(
          candidate.plannedSeconds,
        )
      : legacyDuration;

  const actualSeconds =
    typeof candidate.actualSeconds ===
      "number" &&
    Number.isFinite(
      candidate.actualSeconds,
    ) &&
    candidate.actualSeconds >= 1
      ? Math.floor(
          candidate.actualSeconds,
        )
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
    isValidDateString(
      candidate.startedAt,
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
}

function normalizeDatabaseRow(
  row: FocusHistoryDatabaseRow,
): FocusHistory | null {
  if (
    typeof row.id !== "string" ||
    typeof row.goal !== "string" ||
    typeof row.planned_seconds !==
      "number" ||
    typeof row.actual_seconds !==
      "number" ||
    row.planned_seconds < 1 ||
    row.actual_seconds < 1 ||
    !isValidDateString(
      row.started_at,
    ) ||
    !isValidDateString(
      row.completed_at,
    )
  ) {
    return null;
  }

  return {
    id: row.id,
    goal: row.goal,
    plannedSeconds:
      row.planned_seconds,
    actualSeconds:
      row.actual_seconds,
    startedAt:
      row.started_at,
    completedAt:
      row.completed_at,
  };
}

function mergeFocusHistories(
  localHistory: FocusHistory[],
  cloudHistory: FocusHistory[],
) {
  const mergedHistory =
    new Map<string, FocusHistory>();

  localHistory.forEach(
    (history) => {
      mergedHistory.set(
        history.id,
        history,
      );
    },
  );

  cloudHistory.forEach(
    (history) => {
      mergedHistory.set(
        history.id,
        history,
      );
    },
  );

  return sortFocusHistory(
    Array.from(
      mergedHistory.values(),
    ),
  );
}

/* ─────────────────────────────
   로컬 집중 기록 불러오기
───────────────────────────── */

export function loadFocusHistory():
  FocusHistory[] {
  if (
    typeof window === "undefined"
  ) {
    return [];
  }

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

    return sortFocusHistory(
      parsedHistory
        .map(
          normalizeFocusHistoryItem,
        )
        .filter(
          (
            history,
          ): history is FocusHistory =>
            history !== null,
        ),
    );
  } catch (error) {
    console.error(
      "집중 기록을 불러오지 못했습니다.",
      error,
    );

    return [];
  }
}

/* ─────────────────────────────
   Supabase 집중 기록 동기화
   기존 localStorage 기록 자동 이전
───────────────────────────── */

export async function syncFocusHistoryWithCloud():
  Promise<FocusHistory[]> {
  const localHistory =
    loadFocusHistory();

  try {
    const supabase =
      createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    /*
     * 비로그인 상태에서는
     * 기존 localStorage 기록만 사용한다.
     */
    if (!user) {
      return localHistory;
    }

    /*
     * 과거 기록의 ID가 UUID 형식이 아니면
     * Supabase 저장이 가능하도록 새 ID를 부여한다.
     */
    let localHistoryChanged = false;

    const migrationHistory =
      localHistory.map(
        (history) => {
          if (
            isValidUuid(
              history.id,
            )
          ) {
            return history;
          }

          localHistoryChanged = true;

          return {
            ...history,
            id:
              createFocusHistoryId(),
          };
        },
      );

    if (localHistoryChanged) {
      saveFocusHistoryToLocal(
        migrationHistory,
        false,
      );
    }

    /*
     * 로컬 기록을 서버로 자동 이전한다.
     * 동일 ID가 있으면 중복 생성하지 않는다.
     */
    if (
      migrationHistory.length > 0
    ) {
      const migrationRows =
        migrationHistory.map(
          (history) => ({
            id:
              history.id,

            user_id:
              user.id,

            goal:
              history.goal,

            planned_seconds:
              history.plannedSeconds,

            actual_seconds:
              history.actualSeconds,

            started_at:
              history.startedAt,

            completed_at:
              history.completedAt,

            created_at:
              history.completedAt,
          }),
        );

      const {
        error: migrationError,
      } =
        await supabase
          .from(
            "focus_histories",
          )
          .upsert(
            migrationRows,
            {
              onConflict: "id",
              ignoreDuplicates:
                true,
            },
          );

      if (migrationError) {
        console.error(
          "기존 집중 기록 서버 이전 실패:",
          migrationError,
        );
      }
    }

    /*
     * 서버 기록을 불러온다.
     */
    const {
      data: cloudRows,
      error: cloudError,
    } =
      await supabase
        .from(
          "focus_histories",
        )
        .select(
          `
            id,
            goal,
            planned_seconds,
            actual_seconds,
            started_at,
            completed_at
          `,
        )
        .eq(
          "user_id",
          user.id,
        )
        .order(
          "completed_at",
          {
            ascending: false,
          },
        );

    if (cloudError) {
      throw cloudError;
    }

    const cloudHistory =
      (
        Array.isArray(
          cloudRows,
        )
          ? cloudRows
          : []
      )
        .map(
          (row) =>
            normalizeDatabaseRow(
              row as FocusHistoryDatabaseRow,
            ),
        )
        .filter(
          (
            history,
          ): history is FocusHistory =>
            history !== null,
        );

    /*
     * 서버 이전에 실패한 로컬 기록이 있더라도
     * 사라지지 않도록 두 데이터를 병합한다.
     */
    const mergedHistory =
      mergeFocusHistories(
        migrationHistory,
        cloudHistory,
      );

    saveFocusHistoryToLocal(
      mergedHistory,
    );

    return mergedHistory;
  } catch (error) {
    console.error(
      "집중 기록 클라우드 동기화 실패:",
      error,
    );

    return localHistory;
  }
}

/* ─────────────────────────────
   새 집중 기록 저장
───────────────────────────── */

export function saveFocusHistoryRecord({
  goal,
  plannedSeconds,
  actualSeconds,
  startedAt,
}: SaveFocusHistoryInput) {
  const history =
    loadFocusHistory();

  const completedAt =
    new Date();

  const safePlannedSeconds =
    Math.max(
      1,
      Math.floor(
        plannedSeconds,
      ),
    );

  const safeActualSeconds =
    Math.max(
      1,
      Math.floor(
        actualSeconds,
      ),
    );

  const safeStartedAt =
    isValidDateString(
      startedAt,
    )
      ? startedAt
      : new Date(
          completedAt.getTime() -
            safeActualSeconds *
              1000,
        ).toISOString();

  const newHistory: FocusHistory = {
    id:
      createFocusHistoryId(),

    goal:
      goal.trim(),

    plannedSeconds:
      safePlannedSeconds,

    actualSeconds:
      safeActualSeconds,

    startedAt:
      safeStartedAt,

    completedAt:
      completedAt.toISOString(),
  };

  const nextHistory =
    sortFocusHistory([
      newHistory,
      ...history,
    ]);

  /*
   * 화면과 localStorage에는
   * 즉시 기록한다.
   */
  saveFocusHistoryToLocal(
    nextHistory,
  );

  /*
   * 서버 저장은 백그라운드에서 진행한다.
   * 기존 FocusMode 함수는 수정하지 않아도 된다.
   */
  void saveFocusHistoryRecordToCloud(
    newHistory,
  );

  return nextHistory;
}

/* ─────────────────────────────
   새 기록 Supabase 저장
───────────────────────────── */

async function saveFocusHistoryRecordToCloud(
  history: FocusHistory,
) {
  try {
    const supabase =
      createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    /*
     * 비로그인 상태에서는
     * localStorage 기록만 유지한다.
     */
    if (!user) {
      return;
    }

    const {
      error: insertError,
    } =
      await supabase
        .from(
          "focus_histories",
        )
        .upsert(
          {
            id:
              history.id,

            user_id:
              user.id,

            goal:
              history.goal,

            planned_seconds:
              history.plannedSeconds,

            actual_seconds:
              history.actualSeconds,

            started_at:
              history.startedAt,

            completed_at:
              history.completedAt,

            created_at:
              history.completedAt,
          },
          {
            onConflict: "id",
          },
        );

    if (insertError) {
      throw insertError;
    }
  } catch (error) {
    console.error(
      "집중 기록 서버 저장 실패:",
      error,
    );

    /*
     * 로컬 기록은 삭제하지 않는다.
     * 다음 클라우드 동기화 때 다시 이전된다.
     */
  }
}
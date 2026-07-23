import type {
  FocusCalendarDay,
  FocusCalendarMonthSummary,
  FocusHistory,
  FocusWeeklyInsight,
} from "../types/focus";
import {
  createLocalDateKey,
} from "./focusStreak";

const CALENDAR_CELL_COUNT = 42;

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function getMonday(date: Date) {
  const monday = startOfDay(date);
  const day = monday.getDay();
  const daysFromMonday =
    day === 0 ? 6 : day - 1;

  monday.setDate(
    monday.getDate() - daysFromMonday,
  );

  return monday;
}

function isDateInRange(
  date: Date,
  start: Date,
  end: Date,
) {
  return date >= start && date < end;
}

function sumActualSeconds(
  history: FocusHistory[],
) {
  return history.reduce(
    (sum, item) =>
      sum + item.actualSeconds,
    0,
  );
}

export function createMonthAnchor(
  date = new Date(),
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );
}

export function moveCalendarMonth(
  month: Date,
  offset: number,
) {
  return new Date(
    month.getFullYear(),
    month.getMonth() + offset,
    1,
  );
}

export function formatCalendarMonth(
  month: Date,
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      year: "numeric",
      month: "long",
    },
  ).format(month);
}

export function formatCalendarDate(
  date: Date,
) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      month: "long",
      day: "numeric",
      weekday: "short",
    },
  ).format(date);
}

export function getFocusIntensity(
  totalSeconds: number,
): 0 | 1 | 2 | 3 | 4 {
  if (totalSeconds <= 0) {
    return 0;
  }

  if (totalSeconds < 30 * 60) {
    return 1;
  }

  if (totalSeconds < 60 * 60) {
    return 2;
  }

  if (totalSeconds < 2 * 60 * 60) {
    return 3;
  }

  return 4;
}

export function groupFocusHistoryByDate(
  history: FocusHistory[],
) {
  const groupedHistory =
    new Map<string, FocusHistory[]>();

  history.forEach((item) => {
    const completedAt = new Date(
      item.completedAt,
    );

    if (
      Number.isNaN(
        completedAt.getTime(),
      )
    ) {
      return;
    }

    const dateKey =
      createLocalDateKey(completedAt);

    const sessions =
      groupedHistory.get(dateKey) ?? [];

    sessions.push(item);
    groupedHistory.set(
      dateKey,
      sessions,
    );
  });

  groupedHistory.forEach(
    (sessions) => {
      sessions.sort(
        (a, b) =>
          new Date(
            b.completedAt,
          ).getTime() -
          new Date(
            a.completedAt,
          ).getTime(),
      );
    },
  );

  return groupedHistory;
}

export function createFocusCalendarDays(
  month: Date,
  history: FocusHistory[],
) {
  const monthAnchor =
    createMonthAnchor(month);

  const firstDayIndex =
    monthAnchor.getDay();

  const mondayFirstOffset =
    firstDayIndex === 0
      ? 6
      : firstDayIndex - 1;

  const gridStart = new Date(
    monthAnchor.getFullYear(),
    monthAnchor.getMonth(),
    1 - mondayFirstOffset,
  );

  const today = startOfDay(
    new Date(),
  );

  const groupedHistory =
    groupFocusHistoryByDate(history);

  return Array.from(
    {
      length: CALENDAR_CELL_COUNT,
    },
    (_, index): FocusCalendarDay => {
      const date = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + index,
      );

      const dateKey =
        createLocalDateKey(date);

      const sessions =
        groupedHistory.get(dateKey) ?? [];

      const totalSeconds =
        sumActualSeconds(sessions);

      return {
        dateKey,
        date,
        dayNumber: date.getDate(),
        isCurrentMonth:
          date.getFullYear() ===
            monthAnchor.getFullYear() &&
          date.getMonth() ===
            monthAnchor.getMonth(),
        isToday:
          startOfDay(date).getTime() ===
          today.getTime(),
        totalSeconds,
        sessionCount:
          sessions.length,
        intensity:
          getFocusIntensity(
            totalSeconds,
          ),
        sessions,
      };
    },
  );
}

function getLongestConsecutiveDays(
  dateKeys: string[],
) {
  if (dateKeys.length === 0) {
    return 0;
  }

  const dayNumbers = dateKeys
    .map((dateKey) => {
      const [year, month, day] =
        dateKey.split("-").map(Number);

      return Math.floor(
        Date.UTC(
          year,
          month - 1,
          day,
        ) / 86_400_000,
      );
    })
    .sort((a, b) => a - b);

  let longest = 1;
  let current = 1;

  for (
    let index = 1;
    index < dayNumbers.length;
    index += 1
  ) {
    if (
      dayNumbers[index] -
        dayNumbers[index - 1] ===
      1
    ) {
      current += 1;
      longest = Math.max(
        longest,
        current,
      );
    } else if (
      dayNumbers[index] !==
      dayNumbers[index - 1]
    ) {
      current = 1;
    }
  }

  return longest;
}

export function getMonthFocusSummary(
  month: Date,
  history: FocusHistory[],
): FocusCalendarMonthSummary {
  const monthAnchor =
    createMonthAnchor(month);

  const monthSessions =
    history.filter((item) => {
      const completedAt =
        new Date(item.completedAt);

      return (
        !Number.isNaN(
          completedAt.getTime(),
        ) &&
        completedAt.getFullYear() ===
          monthAnchor.getFullYear() &&
        completedAt.getMonth() ===
          monthAnchor.getMonth()
      );
    });

  const groupedHistory =
    groupFocusHistoryByDate(
      monthSessions,
    );

  const dayTotals =
    Array.from(
      groupedHistory.values(),
    ).map(sumActualSeconds);

  const totalSeconds =
    sumActualSeconds(monthSessions);

  const longestSessionSeconds =
    monthSessions.reduce(
      (longest, item) =>
        Math.max(
          longest,
          item.actualSeconds,
        ),
      0,
    );

  const averageSessionSeconds =
    monthSessions.length > 0
      ? Math.floor(
          totalSeconds /
            monthSessions.length,
        )
      : 0;

  return {
    totalSeconds,
    totalSessions:
      monthSessions.length,
    activeDays:
      groupedHistory.size,
    longestDaySeconds:
      dayTotals.length > 0
        ? Math.max(...dayTotals)
        : 0,
    longestStreakDays:
      getLongestConsecutiveDays(
        Array.from(
          groupedHistory.keys(),
        ),
      ),
    averageSessionSeconds,
    longestSessionSeconds,
  };
}

export function getWeeklyFocusInsight(
  history: FocusHistory[],
  now = new Date(),
): FocusWeeklyInsight {
  const thisWeekStart =
    getMonday(now);

  const thisWeekEnd =
    new Date(thisWeekStart);

  thisWeekEnd.setDate(
    thisWeekEnd.getDate() + 7,
  );

  const lastWeekStart =
    new Date(thisWeekStart);

  lastWeekStart.setDate(
    lastWeekStart.getDate() - 7,
  );

  const thisWeekSeconds =
    sumActualSeconds(
      history.filter((item) => {
        const completedAt =
          new Date(item.completedAt);

        return (
          !Number.isNaN(
            completedAt.getTime(),
          ) &&
          isDateInRange(
            completedAt,
            thisWeekStart,
            thisWeekEnd,
          )
        );
      }),
    );

  const lastWeekSeconds =
    sumActualSeconds(
      history.filter((item) => {
        const completedAt =
          new Date(item.completedAt);

        return (
          !Number.isNaN(
            completedAt.getTime(),
          ) &&
          isDateInRange(
            completedAt,
            lastWeekStart,
            thisWeekStart,
          )
        );
      }),
    );

  if (
    lastWeekSeconds === 0 &&
    thisWeekSeconds === 0
  ) {
    return {
      thisWeekSeconds,
      lastWeekSeconds,
      percentageChange: 0,
      direction: "same",
      message:
        "이번 주와 지난 주 모두 아직 집중 기록이 없어요. 첫 세션을 시작해보세요.",
    };
  }

  if (lastWeekSeconds === 0) {
    return {
      thisWeekSeconds,
      lastWeekSeconds,
      percentageChange: null,
      direction: "new",
      message:
        "지난 주 기록은 없지만, 이번 주에 새로운 집중 흐름을 만들기 시작했어요.",
    };
  }

  const percentageChange =
    Math.round(
      ((thisWeekSeconds -
        lastWeekSeconds) /
        lastWeekSeconds) *
        100,
    );

  if (percentageChange > 0) {
    return {
      thisWeekSeconds,
      lastWeekSeconds,
      percentageChange,
      direction: "increase",
      message:
        `이번 주는 지난 주보다 집중시간이 ${percentageChange}% 증가했습니다.`,
    };
  }

  if (percentageChange < 0) {
    return {
      thisWeekSeconds,
      lastWeekSeconds,
      percentageChange,
      direction: "decrease",
      message:
        `이번 주는 지난 주보다 집중시간이 ${Math.abs(
          percentageChange,
        )}% 감소했습니다.`,
    };
  }

  return {
    thisWeekSeconds,
    lastWeekSeconds,
    percentageChange: 0,
    direction: "same",
    message:
      "이번 주 집중시간은 지난 주와 같습니다.",
  };
}

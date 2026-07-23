import type {
  FocusHistory,
  FocusStatistics,
} from "../types/focus";

function isSameDay(
  date: Date,
  target: Date,
) {
  return (
    date.getFullYear() ===
      target.getFullYear() &&
    date.getMonth() ===
      target.getMonth() &&
    date.getDate() === target.getDate()
  );
}

function isSameWeek(
  date: Date,
  target: Date,
) {
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);

  const day = start.getDay();
  const daysFromMonday =
    day === 0 ? 6 : day - 1;

  start.setDate(
    start.getDate() - daysFromMonday,
  );

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return date >= start && date < end;
}

function isSameMonth(
  date: Date,
  target: Date,
) {
  return (
    date.getFullYear() ===
      target.getFullYear() &&
    date.getMonth() === target.getMonth()
  );
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

export function getFocusStatistics(
  history: FocusHistory[],
  now = new Date(),
): FocusStatistics {
  const todayHistory = history.filter(
    (item) =>
      isSameDay(
        new Date(item.completedAt),
        now,
      ),
  );

  const weekHistory = history.filter(
    (item) =>
      isSameWeek(
        new Date(item.completedAt),
        now,
      ),
  );

  const monthHistory = history.filter(
    (item) =>
      isSameMonth(
        new Date(item.completedAt),
        now,
      ),
  );

  const totalSeconds =
    sumActualSeconds(history);

  const longestSession = history.reduce(
    (longest, item) =>
      Math.max(
        longest,
        item.actualSeconds,
      ),
    0,
  );

  const averageSession =
    history.length === 0
      ? 0
      : Math.floor(
          totalSeconds / history.length,
        );

  const totalPlannedSeconds =
    history.reduce(
      (sum, item) =>
        sum + item.plannedSeconds,
      0,
    );

  const completionRate =
    totalPlannedSeconds === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (totalSeconds /
              totalPlannedSeconds) *
              100,
          ),
        );

  return {
    totalSessions: history.length,
    totalSeconds,
    todaySessions: todayHistory.length,
    todaySeconds:
      sumActualSeconds(todayHistory),
    weekSessions: weekHistory.length,
    weekSeconds:
      sumActualSeconds(weekHistory),
    monthSessions:
      monthHistory.length,
    monthSeconds:
      sumActualSeconds(monthHistory),
    longestSession,
    averageSession,
    completionRate,
    latestGoal:
      history.length > 0
        ? history[0].goal
        : null,
  };
}

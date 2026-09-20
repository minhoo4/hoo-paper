export type ScheduleRepeatType =
  | "none"
  | "dailyRange"
  | "weekly"
  | "monthly";

type CreateScheduleDatesOptions = {
  startDate: string;
  endDate?: string;
  repeatUntil?: string;
  repeatType: ScheduleRepeatType;
};

function parseDateKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDateKey(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getMonthlyOccurrence(
  year: number,
  month: number,
  weekday: number,
  occurrence: number,
): Date | null {
  const firstOfMonth = new Date(year, month, 1, 12, 0, 0, 0);
  const offset = (weekday - firstOfMonth.getDay() + 7) % 7;
  const day = 1 + offset + (occurrence - 1) * 7;
  const candidate = new Date(year, month, day, 12, 0, 0, 0);

  return candidate.getMonth() === month ? candidate : null;
}

export function createScheduleDates({
  startDate,
  endDate,
  repeatUntil,
  repeatType,
}: CreateScheduleDatesOptions): string[] {
  const start = parseDateKey(startDate);

  if (!start) {
    return [];
  }

  if (repeatType === "none") {
    return [formatDateKey(start)];
  }

  if (repeatType === "dailyRange") {
    const end = parseDateKey(endDate ?? "") ?? start;

    if (end < start) {
      return [formatDateKey(start)];
    }

    const dates: string[] = [];

    for (
      let cursor = new Date(start);
      cursor <= end;
      cursor = addDays(cursor, 1)
    ) {
      dates.push(formatDateKey(cursor));
    }

    return dates;
  }

  const until = parseDateKey(repeatUntil ?? "") ?? start;

  if (until < start) {
    return [formatDateKey(start)];
  }

  if (repeatType === "weekly") {
    const dates: string[] = [];

    for (
      let cursor = new Date(start);
      cursor <= until;
      cursor = addDays(cursor, 7)
    ) {
      dates.push(formatDateKey(cursor));
    }

    return dates;
  }

  const weekday = start.getDay();
  const occurrence = Math.floor((start.getDate() - 1) / 7) + 1;
  const dates: string[] = [formatDateKey(start)];

  let year = start.getFullYear();
  let month = start.getMonth() + 1;

  while (true) {
    if (month > 11) {
      month = 0;
      year += 1;
    }

    const monthStart = new Date(year, month, 1, 12, 0, 0, 0);

    if (monthStart > until) {
      break;
    }

    const candidate = getMonthlyOccurrence(
      year,
      month,
      weekday,
      occurrence,
    );

    if (candidate && candidate <= until) {
      dates.push(formatDateKey(candidate));
    }

    month += 1;
  }

  return dates;
}

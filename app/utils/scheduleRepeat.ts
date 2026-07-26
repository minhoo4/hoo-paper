export type ScheduleRepeatType =
  | "none"
  | "dailyRange"
  | "weekly"
  | "monthly";

export type RepeatScheduleInput = {
  startDate: string;
  endDate?: string;
  repeatUntil?: string;
  repeatType: ScheduleRepeatType;
};

function createDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(
      2,
      "0",
    ),
    String(date.getDate()).padStart(
      2,
      "0",
    ),
  ].join("-");
}

function parseDateKey(dateKey: string) {
  const [year, month, day] =
    dateKey.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
  );
}

function addDays(
  dateKey: string,
  amount: number,
) {
  const date = parseDateKey(dateKey);

  date.setDate(
    date.getDate() + amount,
  );

  return createDateKey(date);
}

function addWeeks(
  dateKey: string,
  amount: number,
) {
  return addDays(
    dateKey,
    amount * 7,
  );
}

function getWeekOfMonth(
  date: Date,
) {
  return Math.ceil(
    date.getDate() / 7,
  );
}

function getLastWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
) {
  const lastDate = new Date(
    year,
    month + 1,
    0,
    12,
    0,
    0,
  );

  const dayDifference =
    (lastDate.getDay() -
      weekday +
      7) %
    7;

  lastDate.setDate(
    lastDate.getDate() -
      dayDifference,
  );

  return lastDate;
}

function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  weekOfMonth: number,
) {
  const firstDate = new Date(
    year,
    month,
    1,
    12,
    0,
    0,
  );

  const firstWeekdayDifference =
    (weekday -
      firstDate.getDay() +
      7) %
    7;

  const targetDay =
    1 +
    firstWeekdayDifference +
    (weekOfMonth - 1) * 7;

  const lastDayOfMonth =
    new Date(
      year,
      month + 1,
      0,
      12,
      0,
      0,
    ).getDate();

  if (
    targetDay <= lastDayOfMonth
  ) {
    return new Date(
      year,
      month,
      targetDay,
      12,
      0,
      0,
    );
  }

  return getLastWeekdayOfMonth(
    year,
    month,
    weekday,
  );
}

function addMonthsByWeekday(
  startDate: string,
  amount: number,
) {
  const originalDate =
    parseDateKey(startDate);

  const weekday =
    originalDate.getDay();

  const weekOfMonth =
    getWeekOfMonth(
      originalDate,
    );

  const targetMonth = new Date(
    originalDate.getFullYear(),
    originalDate.getMonth() +
      amount,
    1,
    12,
    0,
    0,
  );

  const targetDate =
    getNthWeekdayOfMonth(
      targetMonth.getFullYear(),
      targetMonth.getMonth(),
      weekday,
      weekOfMonth,
    );

  return createDateKey(
    targetDate,
  );
}

function createDailyRangeDates(
  startDate: string,
  endDate: string,
) {
  const dates: string[] = [];

  let currentDate = startDate;
  let safetyCount = 0;

  while (
    currentDate <= endDate &&
    safetyCount < 366
  ) {
    dates.push(currentDate);

    currentDate = addDays(
      currentDate,
      1,
    );

    safetyCount += 1;
  }

  return dates;
}

function createWeeklyDates(
  startDate: string,
  repeatUntil: string,
) {
  const dates: string[] = [];

  let currentDate = startDate;
  let safetyCount = 0;

  while (
    currentDate <= repeatUntil &&
    safetyCount < 260
  ) {
    dates.push(currentDate);

    currentDate = addWeeks(
      currentDate,
      1,
    );

    safetyCount += 1;
  }

  return dates;
}

function createMonthlyDates(
  startDate: string,
  repeatUntil: string,
) {
  const dates: string[] = [];

  let repeatIndex = 0;
  let currentDate = startDate;

  while (
    currentDate <= repeatUntil &&
    repeatIndex < 120
  ) {
    dates.push(currentDate);

    repeatIndex += 1;

    currentDate =
      addMonthsByWeekday(
        startDate,
        repeatIndex,
      );
  }

  return dates;
}

export function createScheduleDates({
  startDate,
  endDate,
  repeatUntil,
  repeatType,
}: RepeatScheduleInput) {
  if (repeatType === "none") {
    return [startDate];
  }

  if (
    repeatType ===
    "dailyRange"
  ) {
    if (
      !endDate ||
      endDate < startDate
    ) {
      return [startDate];
    }

    return createDailyRangeDates(
      startDate,
      endDate,
    );
  }

  if (
    repeatType === "weekly"
  ) {
    if (
      !repeatUntil ||
      repeatUntil < startDate
    ) {
      return [startDate];
    }

    return createWeeklyDates(
      startDate,
      repeatUntil,
    );
  }

  if (
    repeatType === "monthly"
  ) {
    if (
      !repeatUntil ||
      repeatUntil < startDate
    ) {
      return [startDate];
    }

    return createMonthlyDates(
      startDate,
      repeatUntil,
    );
  }

  return [startDate];
}
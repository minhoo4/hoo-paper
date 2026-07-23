import type {
  FocusHistory,
  FocusStreak,
} from "../types/focus";

export function createLocalDateKey(
  date: Date,
) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateKeyToDayNumber(
  dateKey: string,
) {
  const [year, month, day] = dateKey
    .split("-")
    .map(Number);

  return Math.floor(
    Date.UTC(
      year,
      month - 1,
      day,
    ) / 86_400_000,
  );
}

export function getUniqueFocusDates(
  history: FocusHistory[],
) {
  const uniqueDates =
    new Set<string>();

  history.forEach((item) => {
    const completedAt = new Date(
      item.completedAt,
    );

    if (
      !Number.isNaN(
        completedAt.getTime(),
      )
    ) {
      uniqueDates.add(
        createLocalDateKey(completedAt),
      );
    }
  });

  return Array.from(uniqueDates).sort(
    (a, b) =>
      dateKeyToDayNumber(a) -
      dateKeyToDayNumber(b),
  );
}

export function calculateCurrentStreak(
  focusDates: string[],
  today = new Date(),
) {
  if (focusDates.length === 0) {
    return 0;
  }

  const dayNumbers =
    focusDates.map(
      dateKeyToDayNumber,
    );

  const latestDay =
    dayNumbers[
      dayNumbers.length - 1
    ];

  const todayDay =
    dateKeyToDayNumber(
      createLocalDateKey(today),
    );

  const daysSinceLatest =
    todayDay - latestDay;

  if (
    daysSinceLatest < 0 ||
    daysSinceLatest > 1
  ) {
    return 0;
  }

  let streak = 1;

  for (
    let index =
      dayNumbers.length - 1;
    index > 0;
    index -= 1
  ) {
    const currentDay =
      dayNumbers[index];
    const previousDay =
      dayNumbers[index - 1];

    if (
      currentDay - previousDay !== 1
    ) {
      break;
    }

    streak += 1;
  }

  return streak;
}

export function calculateLongestStreak(
  focusDates: string[],
) {
  if (focusDates.length === 0) {
    return 0;
  }

  const dayNumbers =
    focusDates.map(
      dateKeyToDayNumber,
    );

  let longestStreak = 1;
  let runningStreak = 1;

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
      runningStreak += 1;
      longestStreak = Math.max(
        longestStreak,
        runningStreak,
      );
    } else {
      runningStreak = 1;
    }
  }

  return longestStreak;
}

export function getFocusStreak(
  history: FocusHistory[],
): FocusStreak {
  const focusDates =
    getUniqueFocusDates(history);

  return {
    currentStreak:
      calculateCurrentStreak(
        focusDates,
      ),
    longestStreak:
      calculateLongestStreak(
        focusDates,
      ),
    activeDays: focusDates.length,
    lastFocusedDate:
      focusDates.length > 0
        ? focusDates[
            focusDates.length - 1
          ]
        : null,
  };
}

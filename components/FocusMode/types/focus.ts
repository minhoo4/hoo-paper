export type FocusDuration = 25 | 60 | "custom";

export type FocusView =
  | "setup"
  | "timer"
  | "completed";

export type ProfileTab =
  | "overview"
  | "calendar"
  | "achievements";

export type FocusQuickMemo = {
  id: string;
  content: string;
  createdAt: string;
};

export type HooMemo = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

export type FocusHistory = {
  id: string;
  goal: string;
  plannedSeconds: number;
  actualSeconds: number;
  startedAt: string;
  completedAt: string;
};

export type FocusStatistics = {
  totalSessions: number;
  totalSeconds: number;
  todaySessions: number;
  todaySeconds: number;
  weekSessions: number;
  weekSeconds: number;
  monthSessions: number;
  monthSeconds: number;
  longestSession: number;
  averageSession: number;
  completionRate: number;
  latestGoal: string | null;
};

export type FocusStreak = {
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  lastFocusedDate: string | null;
};

export type ProfileImageRecord = {
  id: string;
  blob: Blob;
  updatedAt: string;
};

export type FocusCalendarDay = {
  dateKey: string;
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  totalSeconds: number;
  sessionCount: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  sessions: FocusHistory[];
};

export type FocusCalendarMonthSummary = {
  totalSeconds: number;
  totalSessions: number;
  activeDays: number;
  longestDaySeconds: number;
  longestStreakDays: number;
  averageSessionSeconds: number;
  longestSessionSeconds: number;
};

export type FocusWeeklyInsight = {
  thisWeekSeconds: number;
  lastWeekSeconds: number;
  percentageChange: number | null;
  direction:
    | "increase"
    | "decrease"
    | "same"
    | "new";
  message: string;
};


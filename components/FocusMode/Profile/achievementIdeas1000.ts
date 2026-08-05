import type {
  FocusHistory,
  FocusStatistics,
  FocusStreak,
} from "../types/focus";

export type ExtendedAchievement = {
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  category: string;
  rarity:
    | "rare"
    | "epic"
    | "legendary"
    | "mythic"
    | "cosmic";
  hidden: boolean;
};

type CreateAchievementIdeasInput = {
  history: FocusHistory[];
  journalDateKeys: string[];
  statistics: FocusStatistics | null;
  streak: FocusStreak | null;
};

type SessionData = FocusHistory & {
  dateKey: string;
  weekKey: string;
  monthKey: string;
  weekday: string;
  hour: number;
  minuteOfDay: number;
  dayNumber: number;
  monthNumber: number;
};

const MOODS = [
  "금이 간", "폭주하는", "잠들지 않는", "차원을 넘은", "중력을 잃은",
  "시간을 씹는", "우주를 접는", "현실을 거부한", "끝없이 증식하는", "HOO가 목격한",
  "새벽에 깨어난", "달빛을 삼킨", "태양을 추월한", "기록에 미친", "루틴을 지배한",
  "집중에 빙의한", "시계를 멈춘", "한계를 삭제한", "평행세계를 건넌", "블랙홀을 견딘",
  "미래에서 돌아온", "뇌가 과열된", "목표를 사냥한", "의지를 복제한", "전설이 되어버린",
];

const WEEKDAYS = [
  "월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일",
];

const WEEKDAY_CODES = [
  "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
];

const KST_FORMATTER = new Intl.DateTimeFormat(
  "en-CA",
  {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  },
);

function getDateData(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const values = new Map(
    KST_FORMATTER.formatToParts(date).map(
      (part) => [part.type, part.value],
    ),
  );
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");

  if (!year || !month || !day) {
    return null;
  }

  const hour = Number(values.get("hour") ?? 0);
  const minute = Number(values.get("minute") ?? 0);
  const dateKey = `${year}-${month}-${day}`;

  return {
    dateKey,
    monthKey: `${year}-${month}`,
    weekKey: getWeekKey(dateKey),
    weekday: values.get("weekday") ?? "",
    hour,
    minuteOfDay: hour * 60 + minute,
    dayNumber: Number(day),
    monthNumber: Number(month),
  };
}

function getWeekKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const weekday = date.getUTCDay();
  const distance = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - distance);
  return date.toISOString().slice(0, 10);
}

function durationLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function timeLabel(totalMinutes: number) {
  const normalized =
    ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getRarity(level: number) {
  if (level >= 24) return "cosmic" as const;
  if (level >= 20) return "mythic" as const;
  if (level >= 14) return "legendary" as const;
  if (level >= 8) return "epic" as const;
  return "rare" as const;
}

function getLongestDateStreak(dateKeys: string[]) {
  const keys = [...new Set(dateKeys)].sort();
  if (keys.length === 0) return 0;

  let current = 1;
  let longest = 1;

  for (let index = 1; index < keys.length; index += 1) {
    const previous = new Date(`${keys[index - 1]}T00:00:00Z`);
    const next = new Date(`${keys[index]}T00:00:00Z`);
    const difference = Math.round(
      (next.getTime() - previous.getTime()) / 86_400_000,
    );

    if (difference === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

function getLongestKeyStreak(
  keys: string[],
  type: "week" | "month",
) {
  const uniqueKeys = [...new Set(keys)].sort();
  if (uniqueKeys.length === 0) return 0;

  let current = 1;
  let longest = 1;

  for (let index = 1; index < uniqueKeys.length; index += 1) {
    const previous = uniqueKeys[index - 1];
    const next = uniqueKeys[index];
    let consecutive = false;

    if (type === "week") {
      const previousDate = new Date(`${previous}T00:00:00Z`);
      const nextDate = new Date(`${next}T00:00:00Z`);
      consecutive =
        Math.round(
          (nextDate.getTime() - previousDate.getTime()) /
            86_400_000,
        ) === 7;
    } else {
      const [previousYear, previousMonth] = previous.split("-").map(Number);
      const [nextYear, nextMonth] = next.split("-").map(Number);
      consecutive =
        nextYear * 12 + nextMonth -
          (previousYear * 12 + previousMonth) ===
        1;
    }

    if (consecutive) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

function getMaximumGapDays(dateKeys: string[]) {
  const keys = [...new Set(dateKeys)].sort();
  let maximum = 0;

  for (let index = 1; index < keys.length; index += 1) {
    const previous = new Date(`${keys[index - 1]}T00:00:00Z`);
    const next = new Date(`${keys[index]}T00:00:00Z`);
    const emptyDays =
      Math.round(
        (next.getTime() - previous.getTime()) / 86_400_000,
      ) - 1;
    maximum = Math.max(maximum, emptyDays);
  }

  return maximum;
}

function getSimilarHourStreak(sessions: SessionData[]) {
  const hourDates = new Map<number, string[]>();

  sessions.forEach((session) => {
    const dates = hourDates.get(session.hour) ?? [];
    dates.push(session.dateKey);
    hourDates.set(session.hour, dates);
  });

  return Math.max(
    0,
    ...Array.from(hourDates.values()).map(
      getLongestDateStreak,
    ),
  );
}

export function createAchievementIdeas1000({
  history,
  journalDateKeys,
  statistics,
  streak,
}: CreateAchievementIdeasInput): ExtendedAchievement[] {
  const sessions = history
    .map((session) => {
      const data = getDateData(session.completedAt);
      return data ? { ...session, ...data } : null;
    })
    .filter(
      (session): session is SessionData => session !== null,
    );

  const dailySessions = new Map<string, SessionData[]>();
  const dailySeconds = new Map<string, number>();
  const weeklySessions = new Map<string, number>();
  const weeklySeconds = new Map<string, number>();
  const monthlySessions = new Map<string, number>();
  const monthlySeconds = new Map<string, number>();
  const monthlyDates = new Map<string, Set<string>>();
  const goalCounts = new Map<string, number>();
  const weekdayCounts = new Map<string, number>();
  const monthCounts = new Map<number, number>();
  const startHourCounts = new Map<number, number>();

  sessions.forEach((session) => {
    const dayItems = dailySessions.get(session.dateKey) ?? [];
    dayItems.push(session);
    dailySessions.set(session.dateKey, dayItems);
    dailySeconds.set(
      session.dateKey,
      (dailySeconds.get(session.dateKey) ?? 0) + session.actualSeconds,
    );
    weeklySessions.set(
      session.weekKey,
      (weeklySessions.get(session.weekKey) ?? 0) + 1,
    );
    weeklySeconds.set(
      session.weekKey,
      (weeklySeconds.get(session.weekKey) ?? 0) + session.actualSeconds,
    );
    monthlySessions.set(
      session.monthKey,
      (monthlySessions.get(session.monthKey) ?? 0) + 1,
    );
    monthlySeconds.set(
      session.monthKey,
      (monthlySeconds.get(session.monthKey) ?? 0) + session.actualSeconds,
    );

    const dates = monthlyDates.get(session.monthKey) ?? new Set<string>();
    dates.add(session.dateKey);
    monthlyDates.set(session.monthKey, dates);

    const goal = session.goal.trim().toLocaleLowerCase("ko-KR");
    if (goal) goalCounts.set(goal, (goalCounts.get(goal) ?? 0) + 1);

    weekdayCounts.set(
      session.weekday,
      (weekdayCounts.get(session.weekday) ?? 0) + 1,
    );
    monthCounts.set(
      session.monthNumber,
      (monthCounts.get(session.monthNumber) ?? 0) + 1,
    );
    startHourCounts.set(
      session.hour,
      (startHourCounts.get(session.hour) ?? 0) + 1,
    );
  });

  const totalSessions = statistics?.totalSessions ?? sessions.length;
  const totalSeconds = statistics?.totalSeconds ?? sessions.reduce(
    (sum, session) => sum + session.actualSeconds,
    0,
  );
  const longestSession = statistics?.longestSession ?? Math.max(
    0,
    ...sessions.map((session) => session.actualSeconds),
  );
  const longestStreak = streak?.longestStreak ?? getLongestDateStreak(
    sessions.map((session) => session.dateKey),
  );
  const activeDays = dailySessions.size;
  const maximumDailySessions = Math.max(0, ...Array.from(dailySessions.values()).map((items) => items.length));
  const maximumDailySeconds = Math.max(0, ...dailySeconds.values());
  const maximumWeeklySessions = Math.max(0, ...weeklySessions.values());
  const maximumWeeklySeconds = Math.max(0, ...weeklySeconds.values());
  const maximumMonthlySeconds = Math.max(0, ...monthlySeconds.values());
  const uniqueGoals = goalCounts.size;
  const maximumSameGoal = Math.max(0, ...goalCounts.values());
  const journalDates = new Set(journalDateKeys);
  const journalStreak = getLongestDateStreak(journalDateKeys);
  const focusJournalDays = [...dailySessions.keys()].filter((key) => journalDates.has(key)).length;
  const customSessionCount = sessions.filter((session) => session.plannedSeconds !== 25 * 60 && session.plannedSeconds !== 60 * 60).length;
  const keptPromiseCount = sessions.filter((session) => session.plannedSeconds > 0 && session.actualSeconds >= session.plannedSeconds).length;
  const maximumExceededMinutes = Math.max(0, ...sessions.map((session) => Math.floor((session.actualSeconds - session.plannedSeconds) / 60)));
  const maximumGapDays = getMaximumGapDays(sessions.map((session) => session.dateKey));
  const similarHourStreak = getSimilarHourStreak(sessions);
  const weekendSessions = sessions.filter((session) => session.weekday === "Sat" || session.weekday === "Sun").length;
  const weekdaySessions = sessions.length - weekendSessions;
  const consecutiveWeeks = getLongestKeyStreak(sessions.map((session) => session.weekKey), "week");
  const consecutiveMonths = getLongestKeyStreak(sessions.map((session) => session.monthKey), "month");
  const maximumDailyUniqueGoals = Math.max(0, ...Array.from(dailySessions.values()).map((items) => new Set(items.map((item) => item.goal.trim().toLocaleLowerCase("ko-KR")).filter(Boolean)).size));
  const longGoalSessions = sessions.filter((session) => session.goal.trim().length >= 20).length;
  const averageSeconds = totalSessions > 0 ? totalSeconds / totalSessions : 0;
  const morningSessions = sessions.filter((session) => session.hour < 10).length;
  const nightSessions = sessions.filter((session) => session.hour >= 22).length;
  const distinctHours = startHourCounts.size;

  const recentCompletionRate = (count: number) => {
    if (sessions.length < count) return 0;
    const recent = [...sessions]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, count);
    const completed = recent.filter((session) => session.plannedSeconds > 0 && session.actualSeconds >= session.plannedSeconds).length;
    return (completed / count) * 100;
  };

  const monthsMeetingDays = (days: number) =>
    [...monthlyDates.values()].filter((dates) => dates.size >= days).length;

  const dailyComboCount = (sessionCount: number, goalCount: number) =>
    [...dailySessions.entries()].filter(([dateKey, items]) => {
      const goals = new Set(items.map((item) => item.goal.trim().toLocaleLowerCase("ko-KR")).filter(Boolean));
      return items.length >= sessionCount && goals.size >= goalCount && journalDates.has(dateKey);
    }).length;

  const groups: Array<{
    category: string;
    noun: string;
    icon: string;
    description: (index: number) => string;
    unlocked: (index: number) => boolean;
  }> = [
    { category: "세션 횟수", noun: "세션 엔진", icon: "∞", description: i => `누적 집중 세션 ${125 + i * 37}회를 완료하세요.`, unlocked: i => totalSessions >= 125 + i * 37 },
    { category: "누적 시간", noun: "시간 저장고", icon: "◴", description: i => `누적 집중시간 ${125 + i * 29}시간을 달성하세요.`, unlocked: i => totalSeconds >= (125 + i * 29) * 3600 },
    { category: "최장 세션", noun: "단일 몰입체", icon: "◇", description: i => `한 번에 ${durationLabel(130 + i * 17)} 이상 집중하세요.`, unlocked: i => longestSession >= (130 + i * 17) * 60 },
    { category: "연속 집중", noun: "연속성 코어", icon: "♨", description: i => `${8 + i * 3}일 연속으로 집중 세션을 완료하세요.`, unlocked: i => longestStreak >= 8 + i * 3 },
    { category: "활동 일수", noun: "출석 생명체", icon: "▦", description: i => `서로 다른 날짜 ${40 + i * 13}일에 집중하세요.`, unlocked: i => activeDays >= 40 + i * 13 },
    { category: "하루 세션", noun: "하루 폭주기관", icon: "≋", description: i => `하루에 집중 세션 ${6 + i}회를 완료하세요.`, unlocked: i => maximumDailySessions >= 6 + i },
    { category: "하루 집중시간", noun: "일일 시간로", icon: "☄", description: i => `하루 총 집중시간 ${durationLabel(250 + i * 23)}을 달성하세요.`, unlocked: i => maximumDailySeconds >= (250 + i * 23) * 60 },
    { category: "주간 세션", noun: "주간 증폭기", icon: "▥", description: i => `한 주에 집중 세션 ${12 + i * 3}회를 완료하세요.`, unlocked: i => maximumWeeklySessions >= 12 + i * 3 },
    { category: "주간 집중시간", noun: "주간 압축장", icon: "▰", description: i => `한 주 총 집중시간 ${15 + i * 2}시간을 달성하세요.`, unlocked: i => maximumWeeklySeconds >= (15 + i * 2) * 3600 },
    { category: "월간 활동일", noun: "월간 출석괴수", icon: "▣", description: i => `한 달에 ${6 + (i % 25)}일 집중하고 이 기록을 ${1 + Math.floor(i / 5)}개월 달성하세요.`, unlocked: i => monthsMeetingDays(6 + (i % 25)) >= 1 + Math.floor(i / 5) },
    { category: "월간 집중시간", noun: "월간 특이점", icon: "◉", description: i => `한 달 총 집중시간 ${35 + i * 7}시간을 달성하세요.`, unlocked: i => maximumMonthlySeconds >= (35 + i * 7) * 3600 },
    { category: "서로 다른 목표", noun: "목표 수집기", icon: "⌖", description: i => `서로 다른 집중 목표 ${12 + i * 7}개를 완료하세요.`, unlocked: i => uniqueGoals >= 12 + i * 7 },
    { category: "같은 목표 반복", noun: "단일목표 추적자", icon: "◎", description: i => `같은 집중 목표를 ${4 + i * 3}회 완료하세요.`, unlocked: i => maximumSameGoal >= 4 + i * 3 },
    { category: "목표 글자 수", noun: "문장형 목표체", icon: "✍", description: i => `${25 + i * 5}자 이상의 목표를 작성하고 집중을 완료하세요.`, unlocked: i => sessions.some(session => session.goal.trim().length >= 25 + i * 5) },
    { category: "일지 누적", noun: "일지 포식자", icon: "✎", description: i => `Daily Journal을 총 ${8 + i * 11}일 작성하세요.`, unlocked: i => journalDates.size >= 8 + i * 11 },
    { category: "일지 연속", noun: "기록 연속체", icon: "▤", description: i => `Daily Journal을 ${4 + i * 2}일 연속 작성하세요.`, unlocked: i => journalStreak >= 4 + i * 2 },
    { category: "집중과 일지", noun: "집중기록 융합체", icon: "☯", description: i => `집중과 Daily Journal을 같은 날 ${3 + i * 4}회 기록하세요.`, unlocked: i => focusJournalDays >= 3 + i * 4 },
    { category: "새벽 시간대", noun: "새벽 시간망령", icon: "☀", description: i => `${timeLabel(180 + i * 7)}부터 ${timeLabel(187 + i * 7)} 사이에 집중을 완료하세요.`, unlocked: i => sessions.some(session => session.minuteOfDay >= 180 + i * 7 && session.minuteOfDay < 187 + i * 7) },
    { category: "야간 시간대", noun: "야간 시간술사", icon: "☾", description: i => `${timeLabel(1200 + i * 9)}부터 ${timeLabel(1209 + i * 9)} 사이에 집중을 완료하세요.`, unlocked: i => sessions.some(session => session.minuteOfDay >= 1200 + i * 9 && session.minuteOfDay < 1209 + i * 9) },
    { category: "요일별 횟수", noun: "요일 지배자", icon: "W", description: i => `${WEEKDAYS[i % 7]} 집중 세션을 누적 ${5 + Math.floor(i / 7) * 7 + i}회 완료하세요.`, unlocked: i => (weekdayCounts.get(WEEKDAY_CODES[i % 7]) ?? 0) >= 5 + Math.floor(i / 7) * 7 + i },
    { category: "정확한 시간", noun: "정시 절단기", icon: "◷", description: i => `정확히 ${durationLabel(10 + i * 7)}로 설정한 집중 세션을 완료하세요.`, unlocked: i => sessions.some(session => session.plannedSeconds === (10 + i * 7) * 60 && session.actualSeconds >= session.plannedSeconds) },
    { category: "커스텀 시간", noun: "커스텀 리듬체", icon: "♪", description: i => `기본 프리셋이 아닌 커스텀 집중 세션을 누적 ${2 + i * 3}회 완료하세요.`, unlocked: i => customSessionCount >= 2 + i * 3 },
    { category: "계획 완수", noun: "약속 수호자", icon: "✓", description: i => `설정한 시간을 모두 채운 집중 세션을 누적 ${10 + i * 9}회 완료하세요.`, unlocked: i => keptPromiseCount >= 10 + i * 9 },
    { category: "계획 초과", noun: "시간 초과생물", icon: "↗", description: i => `계획보다 ${1 + i}분 이상 오래 집중한 세션을 완료하세요.`, unlocked: i => maximumExceededMinutes >= 1 + i },
    { category: "복귀", noun: "귀환 신호체", icon: "↻", description: i => `${10 + i * 5}일 이상 쉬었다가 다시 집중을 완료하세요.`, unlocked: i => maximumGapDays >= 10 + i * 5 },
    { category: "동일 시작 시간", noun: "루틴 복제기", icon: "◫", description: i => `비슷한 시간대에 집중을 시작하는 기록을 ${3 + i}일 연속 유지하세요.`, unlocked: i => similarHourStreak >= 3 + i },
    { category: "주말 집중", noun: "주말 점령자", icon: "S", description: i => `토요일과 일요일 집중 세션을 합쳐 누적 ${8 + i * 6}회 완료하세요.`, unlocked: i => weekendSessions >= 8 + i * 6 },
    { category: "평일 집중", noun: "평일 생존자", icon: "M", description: i => `월요일부터 금요일까지의 집중 세션을 누적 ${20 + i * 10}회 완료하세요.`, unlocked: i => weekdaySessions >= 20 + i * 10 },
    { category: "연속 활동 주", noun: "주간 연결체", icon: "⛓", description: i => `${2 + i}주 연속으로 매주 한 번 이상 집중하세요.`, unlocked: i => consecutiveWeeks >= 2 + i },
    { category: "연속 활동 월", noun: "월간 연결체", icon: "◌", description: i => `${2 + i}개월 연속으로 매월 한 번 이상 집중하세요.`, unlocked: i => consecutiveMonths >= 2 + i },
    { category: "하루 목표 다양성", noun: "목표 분열체", icon: "✣", description: i => `하루에 서로 다른 집중 목표 ${2 + i}개를 완료하세요.`, unlocked: i => maximumDailyUniqueGoals >= 2 + i },
    { category: "긴 목표 반복", noun: "장문 주문사", icon: "☷", description: i => `20자 이상의 목표가 있는 집중 세션을 누적 ${3 + i * 4}회 완료하세요.`, unlocked: i => longGoalSessions >= 3 + i * 4 },
    { category: "평균 세션", noun: "평균시간 조율사", icon: "≈", description: i => `전체 평균 집중시간을 ${durationLabel(20 + i * 6)} 이상으로 유지하세요.`, unlocked: i => averageSeconds >= (20 + i * 6) * 60 },
    { category: "완주율", noun: "완주율 연금술사", icon: "%", description: i => `최근 ${10 + i * 4}개 집중 세션의 완주율을 ${75 + (i % 6) * 5}% 이상으로 유지하세요.`, unlocked: i => recentCompletionRate(10 + i * 4) >= 75 + (i % 6) * 5 },
    { category: "아침 누적", noun: "아침빛 흡수체", icon: "☀", description: i => `오전 10시 이전 집중 세션을 누적 ${5 + i * 5}회 완료하세요.`, unlocked: i => morningSessions >= 5 + i * 5 },
    { category: "밤 누적", noun: "밤공기 포식자", icon: "☾", description: i => `오후 10시 이후 집중 세션을 누적 ${5 + i * 5}회 완료하세요.`, unlocked: i => nightSessions >= 5 + i * 5 },
    { category: "날짜 수집", noun: "달력 사냥꾼", icon: "▦", description: i => `매월 ${i + 1}일에 집중 세션을 완료하세요.`, unlocked: i => sessions.some(session => session.dayNumber === i + 1) },
    { category: "월별 집중", noun: "계절 항해자", icon: "❖", description: i => `${(i % 12) + 1}월에 집중 세션 ${3 + Math.floor(i / 12) * 12 + i}회를 완료하세요.`, unlocked: i => (monthCounts.get((i % 12) + 1) ?? 0) >= 3 + Math.floor(i / 12) * 12 + i },
    { category: "시간대 수집", noun: "24시간 탐사선", icon: "◴", description: i => `서로 다른 시작 시간대 ${Math.min(24, 2 + i)}개를 수집하고 해당 시간대 집중을 합계 ${3 + i * 4}회 완료하세요.`, unlocked: i => distinctHours >= Math.min(24, 2 + i) && totalSessions >= 3 + i * 4 },
    { category: "복합 도전", noun: "조건 혼돈체", icon: "※", description: i => `하루 ${2 + (i % 5)}회 집중, 목표 ${2 + (i % 7)}개, 일지 작성을 동시에 ${1 + Math.floor(i / 5)}회 달성하세요.`, unlocked: i => dailyComboCount(2 + (i % 5), 2 + (i % 7)) >= 1 + Math.floor(i / 5) },
  ];

  return groups.flatMap((group) =>
    Array.from({ length: 25 }, (_, index) => {
      const rarity = getRarity(index + 1);

      return {
        title: `${MOODS[index]} ${group.noun}`,
        description: group.description(index),
        icon: group.icon,
        unlocked: group.unlocked(index),
        category: group.category,
        rarity,
        hidden: rarity === "mythic" || rarity === "cosmic",
      };
    }),
  );
}

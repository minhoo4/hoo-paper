"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  createAchievementIdeas1000,
} from "./achievementIdeas1000";

import type {
  FocusHistory,
  FocusStatistics,
  FocusStreak,
} from "../types/focus";

type ProfileAchievementsProps = {
  statistics: FocusStatistics | null;
  streak: FocusStreak | null;
  history: FocusHistory[];
};

type AchievementItem = {
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
};

type SessionWithDate = FocusHistory & {
  dateKey: string;
  hour: number;
  weekday: string;
};

const KOREAN_DATE_FORMATTER =
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });

function getKoreanDateParts(
  dateString: string,
) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const values = new Map(
    KOREAN_DATE_FORMATTER
      .formatToParts(date)
      .map((part) => [
        part.type,
        part.value,
      ]),
  );

  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");

  if (!year || !month || !day) {
    return null;
  }

  return {
    dateKey: `${year}-${month}-${day}`,
    hour: Number(values.get("hour") ?? 0),
    weekday: values.get("weekday") ?? "",
  };
}

function getWeekKey(dateKey: string) {
  const date = new Date(
    `${dateKey}T00:00:00Z`,
  );

  const weekday = date.getUTCDay();
  const distance =
    weekday === 0 ? 6 : weekday - 1;

  date.setUTCDate(
    date.getUTCDate() - distance,
  );

  return date.toISOString().slice(0, 10);
}

function getMaximumConsecutiveDays(
  dateKeys: string[],
) {
  const keys = [
    ...new Set(dateKeys),
  ].sort();

  if (keys.length === 0) {
    return 0;
  }

  let current = 1;
  let longest = 1;

  for (
    let index = 1;
    index < keys.length;
    index += 1
  ) {
    const previous = new Date(
      `${keys[index - 1]}T00:00:00Z`,
    );
    const next = new Date(
      `${keys[index]}T00:00:00Z`,
    );
    const difference = Math.round(
      (next.getTime() - previous.getTime()) /
        86_400_000,
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

function hasBreakOfAtLeast(
  dateKeys: string[],
  emptyDays: number,
) {
  const keys = [
    ...new Set(dateKeys),
  ].sort();

  for (
    let index = 1;
    index < keys.length;
    index += 1
  ) {
    const previous = new Date(
      `${keys[index - 1]}T00:00:00Z`,
    );
    const next = new Date(
      `${keys[index]}T00:00:00Z`,
    );
    const difference = Math.round(
      (next.getTime() - previous.getTime()) /
        86_400_000,
    );

    if (difference >= emptyDays + 1) {
      return true;
    }
  }

  return false;
}

function isCompletedDuration(
  session: FocusHistory,
  seconds: number,
) {
  return (
    session.plannedSeconds === seconds &&
    session.actualSeconds >= seconds
  );
}

export default function ProfileAchievements({
  statistics,
  streak,
  history,
}: ProfileAchievementsProps) {
  const [statusFilter, setStatusFilter] =
    useState<"all" | "unlocked" | "locked">(
      "all",
    );
  const [visibleCount, setVisibleCount] =
    useState(50);
  const [journalDateKeys, setJournalDateKeys] =
    useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadJournalDates() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          const localDates: string[] = [];

          for (
            let index = 0;
            index < window.localStorage.length;
            index += 1
          ) {
            const key =
              window.localStorage.key(index);

            if (
              !key?.startsWith(
                "hoo-daily-journal-",
              )
            ) {
              continue;
            }

            const content =
              window.localStorage.getItem(key);

            if (content?.trim()) {
              localDates.push(
                key.replace(
                  "hoo-daily-journal-",
                  "",
                ),
              );
            }
          }

          if (!cancelled) {
            setJournalDateKeys(localDates);
          }

          return;
        }

        const { data, error } =
          await supabase
            .from("daily_journals")
            .select("journal_date, content")
            .eq("user_id", user.id);

        if (error) {
          throw error;
        }

        const cloudDates = (data ?? [])
          .filter(
            (journal) =>
              typeof journal.content ===
                "string" &&
              journal.content.trim().length > 0,
          )
          .map((journal) =>
            String(journal.journal_date),
          );

        if (!cancelled) {
          setJournalDateKeys(cloudDates);
        }
      } catch (error) {
        console.error(
          "업적용 일지 기록 불러오기 실패:",
          error,
        );

        if (!cancelled) {
          setJournalDateKeys([]);
        }
      }
    }

    void loadJournalDates();

    return () => {
      cancelled = true;
    };
  }, []);

  const achievements = useMemo(() => {
    const sessions = history
      .map((session) => {
        const dateParts = getKoreanDateParts(
          session.completedAt,
        );

        if (!dateParts) {
          return null;
        }

        return {
          ...session,
          ...dateParts,
        };
      })
      .filter(
        (
          session,
        ): session is SessionWithDate =>
          session !== null,
      );

    const totalSessions =
      statistics?.totalSessions ??
      sessions.length;
    const totalSeconds =
      statistics?.totalSeconds ??
      sessions.reduce(
        (sum, session) =>
          sum + session.actualSeconds,
        0,
      );
    const longestSession =
      statistics?.longestSession ??
      Math.max(
        0,
        ...sessions.map(
          (session) => session.actualSeconds,
        ),
      );
    const longestStreak =
      streak?.longestStreak ?? 0;

    const dailySessions = new Map<
      string,
      SessionWithDate[]
    >();
    const dailySeconds =
      new Map<string, number>();
    const weeklyDates =
      new Map<string, Set<string>>();
    const weeklySeconds =
      new Map<string, number>();
    const monthlyDates =
      new Map<string, Set<string>>();
    const monthlySeconds =
      new Map<string, number>();
    const goalCounts =
      new Map<string, number>();

    sessions.forEach((session) => {
      const daySessions =
        dailySessions.get(session.dateKey) ?? [];
      daySessions.push(session);
      dailySessions.set(
        session.dateKey,
        daySessions,
      );

      dailySeconds.set(
        session.dateKey,
        (dailySeconds.get(session.dateKey) ?? 0) +
          session.actualSeconds,
      );

      const weekKey = getWeekKey(
        session.dateKey,
      );
      const weekDateSet =
        weeklyDates.get(weekKey) ??
        new Set<string>();
      weekDateSet.add(session.dateKey);
      weeklyDates.set(weekKey, weekDateSet);
      weeklySeconds.set(
        weekKey,
        (weeklySeconds.get(weekKey) ?? 0) +
          session.actualSeconds,
      );

      const monthKey =
        session.dateKey.slice(0, 7);
      const monthDateSet =
        monthlyDates.get(monthKey) ??
        new Set<string>();
      monthDateSet.add(session.dateKey);
      monthlyDates.set(
        monthKey,
        monthDateSet,
      );
      monthlySeconds.set(
        monthKey,
        (monthlySeconds.get(monthKey) ?? 0) +
          session.actualSeconds,
      );

      const goal = session.goal
        .trim()
        .toLocaleLowerCase("ko-KR");

      if (goal) {
        goalCounts.set(
          goal,
          (goalCounts.get(goal) ?? 0) + 1,
        );
      }
    });

    const dateKeys = [
      ...dailySessions.keys(),
    ];
    const activeDays = dateKeys.length;
    const maximumDailySessions = Math.max(
      0,
      ...Array.from(dailySessions.values()).map(
        (items) => items.length,
      ),
    );
    const maximumDailySeconds = Math.max(
      0,
      ...dailySeconds.values(),
    );
    const maximumWeeklyDays = Math.max(
      0,
      ...Array.from(weeklyDates.values()).map(
        (dates) => dates.size,
      ),
    );
    const maximumWeeklySeconds = Math.max(
      0,
      ...weeklySeconds.values(),
    );
    const maximumMonthlyDays = Math.max(
      0,
      ...Array.from(monthlyDates.values()).map(
        (dates) => dates.size,
      ),
    );
    const maximumMonthlySeconds = Math.max(
      0,
      ...monthlySeconds.values(),
    );
    const uniqueGoals = goalCounts.size;
    const maximumSameGoal = Math.max(
      0,
      ...goalCounts.values(),
    );
    const goalSessionCount = sessions.filter(
      (session) => session.goal.trim(),
    ).length;
    const weekdays = new Set(
      sessions.map((session) =>
        session.weekday,
      ),
    );
    const journalDates = new Set(
      journalDateKeys,
    );
    const focusJournalDays = new Set(
      dateKeys.filter((dateKey) =>
        journalDates.has(dateKey),
      ),
    ).size;
    const journalStreak =
      getMaximumConsecutiveDays(
        journalDateKeys,
      );

    const hasHourRange = (
      start: number,
      end: number,
    ) =>
      sessions.some(
        (session) =>
          session.hour >= start &&
          session.hour < end,
      );

    const hasExactDuration = (
      seconds: number,
    ) =>
      sessions.some((session) =>
        isCompletedDuration(session, seconds),
      );

    const hasDailyDifferentGoals =
      Array.from(dailySessions.values()).some(
        (items) =>
          new Set(
            items
              .map((item) =>
                item.goal
                  .trim()
                  .toLocaleLowerCase("ko-KR"),
              )
              .filter(Boolean),
          ).size >= 5,
      );

    const hasTwoTempos = Array.from(
      dailySessions.values(),
    ).some(
      (items) =>
        items.some((item) =>
          isCompletedDuration(item, 25 * 60),
        ) &&
        items.some((item) =>
          isCompletedDuration(item, 60 * 60),
        ),
    );

    const item = (
      title: string,
      description: string,
      icon: string,
      unlocked: boolean,
    ): AchievementItem => ({
      title,
      description,
      icon,
      unlocked,
    });

    const baseAchievements = [
      item("첫걸음", "첫 집중을 완료하세요.", "✦", totalSessions >= 1),
      item("꾸준한 불씨", "3일 연속 집중하세요.", "♨", longestStreak >= 3),
      item("몰입의 시간", "누적 10시간을 달성하세요.", "◷", totalSeconds >= 10 * 3600),
      item("긴 호흡", "한 번에 2시간 집중하세요.", "◇", longestSession >= 2 * 3600),
      item("일주일의 약속", "7일 연속 집중하세요.", "◆", longestStreak >= 7),
      item("백 번의 시작", "집중 세션 100회를 완료하세요.", "◎", totalSessions >= 100),
      item("아침을 여는 사람", "오전 6시 이전에 집중을 완료하세요.", "☀", hasHourRange(0, 6)),
      item("달빛 집중", "오후 11시 이후에 집중을 완료하세요.", "☾", hasHourRange(23, 24)),
      item("월요일의 시동", "월요일에 집중을 완료하세요.", "M", weekdays.has("Mon")),
      item("주말의 장인", "토요일과 일요일에 각각 집중하세요.", "W", weekdays.has("Sat") && weekdays.has("Sun")),
      item("두 번째 호흡", "하루에 집중 세션 2회를 완료하세요.", "Ⅱ", maximumDailySessions >= 2),
      item("트리플 집중", "하루에 집중 세션 3회를 완료하세요.", "Ⅲ", maximumDailySessions >= 3),
      item("집중의 파도", "하루에 집중 세션 5회를 완료하세요.", "≋", maximumDailySessions >= 5),
      item("목표를 가진 시작", "목표를 입력하고 집중을 완료하세요.", "⌖", goalSessionCount >= 1),
      item("다채로운 도전", "서로 다른 집중 목표 10개를 완료하세요.", "✣", uniqueGoals >= 10),
      item("약속을 지킨 시간", "설정한 집중시간을 모두 채우세요.", "✓", sessions.some((s) => s.plannedSeconds > 0 && s.actualSeconds >= s.plannedSeconds)),
      item("계획 이상의 하루", "계획했던 시간보다 오래 집중하세요.", "↗", sessions.some((s) => s.plannedSeconds > 0 && s.actualSeconds > s.plannedSeconds)),
      item("균형 잡힌 한 주", "한 주에 5일 동안 집중하세요.", "⚖", maximumWeeklyDays >= 5),
      item("주간 몰입", "한 주 동안 총 20시간 집중하세요.", "▥", maximumWeeklySeconds >= 20 * 3600),
      item("뜨거운 하루", "하루 동안 총 4시간 집중하세요.", "♨", maximumDailySeconds >= 4 * 3600),
      item("꾸준한 한 달", "한 달에 20일 이상 집중하세요.", "▦", maximumMonthlyDays >= 20),
      item("매일의 기록", "Daily Journal을 7일 연속 작성하세요.", "✎", journalStreak >= 7),
      item("집중과 기록", "집중한 날 Daily Journal을 작성하세요.", "▤", focusJournalDays >= 1),
      item("다시 돌아온 사람", "7일 이상 쉰 뒤 다시 집중하세요.", "↻", hasBreakOfAtLeast(dateKeys, 7)),
      item("나만의 리듬", "커스텀 시간으로 집중을 완료하세요.", "♪", sessions.some((s) => s.plannedSeconds !== 25 * 60 && s.plannedSeconds !== 60 * 60)),
      item("두 가지 템포", "같은 날 25분과 60분 집중을 완료하세요.", "◐", hasTwoTempos),

      item("가벼운 출발", "집중 세션 5회를 완료하세요.", "⑤", totalSessions >= 5),
      item("열 번의 선택", "집중 세션 10회를 완료하세요.", "⑩", totalSessions >= 10),
      item("스물다섯 걸음", "집중 세션 25회를 완료하세요.", "25", totalSessions >= 25),
      item("반백의 기록", "집중 세션 50회를 완료하세요.", "50", totalSessions >= 50),
      item("이백 번의 몰입", "집중 세션 200회를 완료하세요.", "200", totalSessions >= 200),
      item("집중 수집가", "집중 세션 250회를 완료하세요.", "250", totalSessions >= 250),
      item("오백 번의 시작", "집중 세션 500회를 완료하세요.", "500", totalSessions >= 500),
      item("칠백오십 개의 흔적", "집중 세션 750회를 완료하세요.", "750", totalSessions >= 750),
      item("천 번의 결심", "집중 세션 1,000회를 완료하세요.", "1K", totalSessions >= 1000),
      item("집중의 전설", "집중 세션 2,000회를 완료하세요.", "2K", totalSessions >= 2000),

      item("첫 한 시간", "누적 집중시간 1시간을 달성하세요.", "1H", totalSeconds >= 3600),
      item("다섯 시간의 발견", "누적 집중시간 5시간을 달성하세요.", "5H", totalSeconds >= 5 * 3600),
      item("집중의 하루", "누적 집중시간 24시간을 달성하세요.", "24H", totalSeconds >= 24 * 3600),
      item("쉰 시간의 여정", "누적 집중시간 50시간을 달성하세요.", "50H", totalSeconds >= 50 * 3600),
      item("백 시간의 증명", "누적 집중시간 100시간을 달성하세요.", "100H", totalSeconds >= 100 * 3600),
      item("이백 시간의 성장", "누적 집중시간 200시간을 달성하세요.", "200H", totalSeconds >= 200 * 3600),
      item("집중의 일 년", "누적 집중시간 365시간을 달성하세요.", "365H", totalSeconds >= 365 * 3600),
      item("오백 시간의 경지", "누적 집중시간 500시간을 달성하세요.", "500H", totalSeconds >= 500 * 3600),
      item("칠백오십 시간의 기록", "누적 집중시간 750시간을 달성하세요.", "750H", totalSeconds >= 750 * 3600),
      item("천 시간의 몰입", "누적 집중시간 1,000시간을 달성하세요.", "1KH", totalSeconds >= 1000 * 3600),

      item("반 시간의 집중", "한 번에 30분 집중하세요.", "30", longestSession >= 30 * 60),
      item("집중의 삼사분기", "한 번에 45분 집중하세요.", "45", longestSession >= 45 * 60),
      item("깊어지는 호흡", "한 번에 90분 집중하세요.", "90", longestSession >= 90 * 60),
      item("세 시간의 방", "한 번에 3시간 집중하세요.", "3H", longestSession >= 3 * 3600),
      item("네 시간의 세계", "한 번에 4시간 집중하세요.", "4H", longestSession >= 4 * 3600),
      item("여섯 시간의 항해", "한 번에 6시간 집중하세요.", "6H", longestSession >= 6 * 3600),
      item("하루의 삼분의 일", "한 번에 8시간 집중하세요.", "8H", longestSession >= 8 * 3600),
      item("정확한 약속", "정확히 25분 세션을 완료하세요.", "25", hasExactDuration(25 * 60)),
      item("온전한 한 시간", "정확히 60분 세션을 완료하세요.", "60", hasExactDuration(60 * 60)),
      item("아흔 분의 리듬", "정확히 90분 세션을 완료하세요.", "90", hasExactDuration(90 * 60)),

      item("이어지는 마음", "2일 연속 집중하세요.", "2D", longestStreak >= 2),
      item("다섯 날의 불꽃", "5일 연속 집중하세요.", "5D", longestStreak >= 5),
      item("열흘의 습관", "10일 연속 집중하세요.", "10D", longestStreak >= 10),
      item("두 주의 약속", "14일 연속 집중하세요.", "14D", longestStreak >= 14),
      item("세 주의 변화", "21일 연속 집중하세요.", "21D", longestStreak >= 21),
      item("한 달의 루틴", "30일 연속 집중하세요.", "30D", longestStreak >= 30),
      item("오십 일의 의지", "50일 연속 집중하세요.", "50D", longestStreak >= 50),
      item("칠십오 일의 여정", "75일 연속 집중하세요.", "75D", longestStreak >= 75),
      item("백일의 수행", "100일 연속 집중하세요.", "100D", longestStreak >= 100),
      item("매일의 몰입", "365일 연속 집중하세요.", "365D", longestStreak >= 365),

      item("활동의 씨앗", "서로 다른 날짜 5일에 집중하세요.", "5", activeDays >= 5),
      item("열흘의 흔적", "서로 다른 날짜 10일에 집중하세요.", "10", activeDays >= 10),
      item("스물다섯 날의 기록", "서로 다른 날짜 25일에 집중하세요.", "25", activeDays >= 25),
      item("서른 날의 발자국", "서로 다른 날짜 30일에 집중하세요.", "30", activeDays >= 30),
      item("오십 날의 성장", "서로 다른 날짜 50일에 집중하세요.", "50", activeDays >= 50),
      item("백일의 기록가", "서로 다른 날짜 100일에 집중하세요.", "100", activeDays >= 100),
      item("이백일의 동행", "서로 다른 날짜 200일에 집중하세요.", "200", activeDays >= 200),
      item("삼백일의 여정", "서로 다른 날짜 300일에 집중하세요.", "300", activeDays >= 300),
      item("일 년의 발자국", "서로 다른 날짜 365일에 집중하세요.", "365", activeDays >= 365),
      item("오백일의 기록", "서로 다른 날짜 500일에 집중하세요.", "500", activeDays >= 500),

      item("네 번의 파동", "하루에 집중 세션 4회를 완료하세요.", "Ⅳ", maximumDailySessions >= 4),
      item("일곱 번의 몰입", "하루에 집중 세션 7회를 완료하세요.", "Ⅶ", maximumDailySessions >= 7),
      item("열 번의 하루", "하루에 집중 세션 10회를 완료하세요.", "Ⅹ", maximumDailySessions >= 10),
      item("집중으로 채운 한 시간", "하루 총 집중시간 1시간을 달성하세요.", "1H", maximumDailySeconds >= 3600),
      item("두 시간의 하루", "하루 총 집중시간 2시간을 달성하세요.", "2H", maximumDailySeconds >= 2 * 3600),
      item("여섯 시간의 하루", "하루 총 집중시간 6시간을 달성하세요.", "6H", maximumDailySeconds >= 6 * 3600),
      item("주간 첫 리듬", "한 주에 서로 다른 3일 동안 집중하세요.", "3D", maximumWeeklyDays >= 3),
      item("여섯 날의 균형", "한 주에 서로 다른 6일 동안 집중하세요.", "6D", maximumWeeklyDays >= 6),
      item("빈틈없는 한 주", "같은 주의 모든 요일에 집중하세요.", "7D", maximumWeeklyDays >= 7),
      item("주간 열 시간", "한 주 동안 총 10시간 집중하세요.", "10H", maximumWeeklySeconds >= 10 * 3600),

      item("강렬한 한 주", "한 주 동안 총 30시간 집중하세요.", "30H", maximumWeeklySeconds >= 30 * 3600),
      item("몰입으로 채운 한 주", "한 주 동안 총 40시간 집중하세요.", "40H", maximumWeeklySeconds >= 40 * 3600),
      item("월간 첫걸음", "한 달에 서로 다른 5일 동안 집중하세요.", "5D", maximumMonthlyDays >= 5),
      item("월간 루틴 형성", "한 달에 서로 다른 10일 동안 집중하세요.", "10D", maximumMonthlyDays >= 10),
      item("보름의 몰입", "한 달에 서로 다른 15일 동안 집중하세요.", "15D", maximumMonthlyDays >= 15),
      item("스물다섯 날의 몰입", "한 달에 서로 다른 25일 동안 집중하세요.", "25D", maximumMonthlyDays >= 25),
      item("빈틈없는 한 달", "한 달에 서로 다른 30일 동안 집중하세요.", "30D", maximumMonthlyDays >= 30),
      item("월간 마흔 시간", "한 달 동안 총 40시간 집중하세요.", "40H", maximumMonthlySeconds >= 40 * 3600),
      item("월간 여든 시간", "한 달 동안 총 80시간 집중하세요.", "80H", maximumMonthlySeconds >= 80 * 3600),
      item("월간 백이십 시간", "한 달 동안 총 120시간 집중하세요.", "120H", maximumMonthlySeconds >= 120 * 3600),

      item("자정의 문", "자정부터 오전 1시 사이에 집중을 완료하세요.", "00", hasHourRange(0, 1)),
      item("고요한 심야", "오전 1시부터 3시 사이에 집중을 완료하세요.", "01", hasHourRange(1, 3)),
      item("새벽의 사색가", "오전 3시부터 5시 사이에 집중을 완료하세요.", "03", hasHourRange(3, 5)),
      item("출발 전 집중", "오전 6시부터 8시 사이에 집중을 완료하세요.", "06", hasHourRange(6, 8)),
      item("아침의 추진력", "오전 8시부터 10시 사이에 집중을 완료하세요.", "08", hasHourRange(8, 10)),
      item("점심의 틈", "정오부터 오후 2시 사이에 집중을 완료하세요.", "12", hasHourRange(12, 14)),
      item("오후의 항해", "오후 2시부터 5시 사이에 집중을 완료하세요.", "14", hasHourRange(14, 17)),
      item("저녁의 전환", "오후 6시부터 8시 사이에 집중을 완료하세요.", "18", hasHourRange(18, 20)),
      item("밤의 몰입가", "오후 8시부터 10시 사이에 집중을 완료하세요.", "20", hasHourRange(20, 22)),
      item("하루의 마지막 준비", "오후 10시부터 11시 사이에 집중을 완료하세요.", "22", hasHourRange(22, 23)),

      item("목표 탐험가", "서로 다른 집중 목표 3개를 완료하세요.", "3G", uniqueGoals >= 3),
      item("목표 수집가", "서로 다른 집중 목표 25개를 완료하세요.", "25G", uniqueGoals >= 25),
      item("목표 개척자", "서로 다른 집중 목표 50개를 완료하세요.", "50G", uniqueGoals >= 50),
      item("백 가지 목적", "서로 다른 집중 목표 100개를 완료하세요.", "100G", uniqueGoals >= 100),
      item("한 길을 걷는 사람", "같은 목표로 집중 세션 3회를 완료하세요.", "×3", maximumSameGoal >= 3),
      item("꾸준한 목표", "같은 목표로 집중 세션 10회를 완료하세요.", "×10", maximumSameGoal >= 10),
      item("목표의 장인", "같은 목표로 집중 세션 30회를 완료하세요.", "×30", maximumSameGoal >= 30),
      item("구체적인 다짐", "20자 이상의 목표로 집중을 완료하세요.", "✍", sessions.some((s) => s.goal.trim().length >= 20)),
      item("다섯 가지 하루", "하루에 서로 다른 목표 5개를 완료하세요.", "5G", hasDailyDifferentGoals),
      item("목적 있는 백 번", "목표를 작성한 집중 세션 100회를 완료하세요.", "100", goalSessionCount >= 100),

      item("기록의 시작", "첫 Daily Journal을 작성하세요.", "✎", journalDateKeys.length >= 1),
      item("삼일의 기록", "Daily Journal을 3일 연속 작성하세요.", "3J", journalStreak >= 3),
      item("기록의 두 주", "Daily Journal을 14일 연속 작성하세요.", "14J", journalStreak >= 14),
      item("기록의 한 달", "Daily Journal을 30일 연속 작성하세요.", "30J", journalStreak >= 30),
      item("서른 개의 이야기", "Daily Journal을 총 30일 작성하세요.", "30", journalDates.size >= 30),
      item("백일의 이야기", "Daily Journal을 총 100일 작성하세요.", "100", journalDates.size >= 100),
      item("집중 뒤의 문장", "집중과 일지를 같은 날 10회 기록하세요.", "10J", focusJournalDays >= 10),
      item("몰입의 기록가", "집중과 일지를 같은 날 30회 기록하세요.", "30J", focusJournalDays >= 30),
      item("긴 잠에서 깨어난 사람", "30일 이상 쉰 뒤 다시 집중하세요.", "↻", hasBreakOfAtLeast(dateKeys, 30)),
      item("요일 수집가", "월요일부터 일요일까지 모두 집중하세요.", "7W", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].every((day) => weekdays.has(day))),
    ];

    const additionalAchievements =
      createAchievementIdeas1000({
        history,
        journalDateKeys,
        statistics,
        streak,
      });

    return [
      ...baseAchievements,
      ...additionalAchievements,
    ];
  }, [
    history,
    journalDateKeys,
    statistics,
    streak,
  ]);

  const filteredAchievements = useMemo(
    () =>
      achievements.filter((achievement) => {
        if (statusFilter === "unlocked") {
          return achievement.unlocked;
        }

        if (statusFilter === "locked") {
          return !achievement.unlocked;
        }

        return true;
      }),
    [achievements, statusFilter],
  );

  const visibleAchievements =
    filteredAchievements.slice(0, visibleCount);

  const unlockedCount = achievements.filter(
    (achievement) => achievement.unlocked,
  ).length;

  const achievementCompletionRate =
    achievements.length > 0
      ? Math.round(
          (unlockedCount / achievements.length) * 100,
        )
      : 0;

  function changeStatusFilter(
    nextFilter: "all" | "unlocked" | "locked",
  ) {
    setStatusFilter(nextFilter);
    setVisibleCount(50);
  }

  return (
    <div className="mt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.035] p-3">
        <div>
          <p className="text-xs font-black tracking-[0.14em] text-[#a99cff]">
            HOO ACHIEVEMENTS
          </p>
          <p className="mt-1 text-sm font-bold text-white/55">
            {unlockedCount.toLocaleString("ko-KR")} / {achievements.length.toLocaleString("ko-KR")} 해금
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            ["all", "전체"],
            ["unlocked", "해금"],
            ["locked", "미해금"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                changeStatusFilter(value)
              }
              className={`min-h-11 rounded-full px-4 text-xs font-black transition ${
                statusFilter === value
                  ? "bg-[#7667e8] text-white"
                  : "bg-white/[0.06] text-white/55 hover:bg-white/[0.1] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section
        className="mb-4 grid grid-cols-3 overflow-hidden rounded-[24px] border border-[#8d7cff]/35 bg-[linear-gradient(135deg,rgba(118,103,232,0.18),rgba(255,255,255,0.035))] shadow-[0_18px_55px_rgba(0,0,0,0.18)]"
        aria-label="업적 달성 현황"
      >
        <div className="flex min-h-[112px] flex-col items-center justify-center border-r border-white/10 px-2 py-4 text-center sm:min-h-[130px] sm:px-4">
          <p className="text-[10px] font-black tracking-[0.12em] text-white/45 sm:text-xs sm:tracking-[0.16em]">
            총 업적
          </p>
          <p className="mt-2 text-2xl font-black text-white sm:text-4xl">
            {achievements.length.toLocaleString("ko-KR")}
          </p>
          <p className="mt-1 text-[10px] font-bold text-white/35 sm:text-xs">
            TOTAL
          </p>
        </div>

        <div className="flex min-h-[112px] flex-col items-center justify-center border-r border-white/10 px-2 py-4 text-center sm:min-h-[130px] sm:px-4">
          <p className="text-[10px] font-black tracking-[0.12em] text-white/45 sm:text-xs sm:tracking-[0.16em]">
            클리어
          </p>
          <p className="mt-2 text-2xl font-black text-[#b7adff] sm:text-4xl">
            {unlockedCount.toLocaleString("ko-KR")}
          </p>
          <p className="mt-1 text-[10px] font-bold text-white/35 sm:text-xs">
            UNLOCKED
          </p>
        </div>

        <div className="flex min-h-[112px] flex-col items-center justify-center px-2 py-4 text-center sm:min-h-[130px] sm:px-4">
          <p className="text-[10px] font-black tracking-[0.12em] text-white/45 sm:text-xs sm:tracking-[0.16em]">
            달성률
          </p>
          <p className="mt-2 text-2xl font-black text-[#8d7cff] sm:text-4xl">
            {achievementCompletionRate}%
          </p>
          <p className="mt-1 text-[10px] font-bold text-white/35 sm:text-xs">
            PROGRESS
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {visibleAchievements.map((achievement) => {
        const isHidden =
          "hidden" in achievement &&
          achievement.hidden &&
          !achievement.unlocked;

        return (
        <article
          key={achievement.title}
          className={`flex min-h-[210px] flex-col rounded-[24px] border p-4 transition-all duration-300 ${
            achievement.unlocked
              ? "border-[#8d7cff]/55 bg-[#7667e8]/15 shadow-[0_14px_45px_rgba(118,103,232,0.12)]"
              : "border-white/10 bg-white/[0.035]"
          }`}
        >
          <div
            className={`flex h-10 min-w-10 w-fit items-center justify-center rounded-full px-2 text-sm font-black ${
              achievement.unlocked
                ? "bg-[#7667e8]/25 text-[#b7adff]"
                : "bg-white/[0.06] text-[#a99cff]/55"
            }`}
          >
            {isHidden ? "?" : achievement.icon}
          </div>

          <h3
            className={`mt-4 text-base font-black ${
              achievement.unlocked
                ? "text-white"
                : "text-white/65"
            }`}
          >
            {isHidden ? "???" : achievement.title}
          </h3>

          <p
            className={`mt-2 text-[11px] font-bold leading-5 ${
              achievement.unlocked
                ? "text-white/55"
                : "text-white/35"
            }`}
          >
            {isHidden
              ? "해금 조건이 숨겨진 업적입니다."
              : achievement.description}
          </p>

          <p
            className={`mt-auto pt-5 text-[10px] font-black tracking-[0.14em] ${
              achievement.unlocked
                ? "text-[#a99cff]"
                : "text-white/28"
            }`}
          >
            {achievement.unlocked
              ? "UNLOCKED"
              : "LOCKED"}
          </p>
        </article>
        );
      })}
      </div>

      {visibleCount <
        filteredAchievements.length && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() =>
              setVisibleCount(
                (count) => count + 50,
              )
            }
            className="min-h-12 rounded-full border border-[#8d7cff]/45 bg-[#7667e8]/15 px-8 text-sm font-black text-[#b7adff] transition hover:bg-[#7667e8]/25"
          >
            업적 50개 더 보기
          </button>
        </div>
      )}
    </div>
  );
}

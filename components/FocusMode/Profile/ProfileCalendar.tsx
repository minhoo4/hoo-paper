"use client";

import {
  useMemo,
  useState,
} from "react";
import type {
  FocusCalendarDay,
  FocusHistory,
} from "../types/focus";
import {
  createFocusCalendarDays,
  createMonthAnchor,
  formatCalendarDate,
  formatCalendarMonth,
  getMonthFocusSummary,
  getWeeklyFocusInsight,
  moveCalendarMonth,
} from "../utils/focusCalendar";
import {
  formatProfileDuration,
} from "../utils/format";

const WEEKDAYS = [
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
  "일",
];

const INTENSITY_CLASSES = [
  "border-white/[0.06] bg-white/[0.035]",
  "border-[#54499e]/45 bg-[#54499e]/35",
  "border-[#6558c1]/55 bg-[#6558c1]/55",
  "border-[#7969e7]/70 bg-[#7969e7]/75",
  "border-[#a093ff]/85 bg-[#9385ff]",
];

function formatCalendarCellClock(
  totalSeconds: number,
) {
  const safeSeconds = Math.max(
    0,
    Math.floor(totalSeconds),
  );

  if (safeSeconds === 0) {
    return "";
  }

  const hours = Math.floor(
    safeSeconds / 3600,
  );

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60,
  );

  const seconds =
    safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(
      minutes,
    ).padStart(2, "0")}:${String(
      seconds,
    ).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

function formatTimelineTime(
  dateString: string,
) {
  const date = new Date(dateString);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "--:--";
  }

  return date.toLocaleTimeString(
    "ko-KR",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    },
  );
}


function getMinuteOfDay(
  dateString: string,
) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return (
    date.getHours() * 60 +
    date.getMinutes() +
    date.getSeconds() / 60
  );
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians =
    ((angleInDegrees - 90) *
      Math.PI) /
    180;

  return {
    x:
      centerX +
      radius *
        Math.cos(angleInRadians),
    y:
      centerY +
      radius *
        Math.sin(angleInRadians),
  };
}

function createScheduleArcPath(
  startMinute: number,
  endMinute: number,
  radius: number,
) {
  const safeStart = Math.max(
    0,
    Math.min(1440, startMinute),
  );

  const safeEnd = Math.max(
    safeStart,
    Math.min(1440, endMinute),
  );

  const startAngle =
    (safeStart / 1440) * 360;

  const endAngle =
    (safeEnd / 1440) * 360;

  const start =
    polarToCartesian(
      120,
      120,
      radius,
      endAngle,
    );

  const end =
    polarToCartesian(
      120,
      120,
      radius,
      startAngle,
    );

  const largeArcFlag =
    endAngle - startAngle > 180
      ? 1
      : 0;

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}

type ProfileCalendarProps = {
  history: FocusHistory[];
};

export default function ProfileCalendar({
  history,
}: ProfileCalendarProps) {
  const [visibleMonth, setVisibleMonth] =
    useState(() =>
      createMonthAnchor(),
    );

  const [
    selectedDateKey,
    setSelectedDateKey,
  ] = useState<string | null>(null);

  const calendarDays = useMemo(
    () =>
      createFocusCalendarDays(
        visibleMonth,
        history,
      ),
    [visibleMonth, history],
  );

  const monthSummary = useMemo(
    () =>
      getMonthFocusSummary(
        visibleMonth,
        history,
      ),
    [visibleMonth, history],
  );

  const weeklyInsight = useMemo(
    () =>
      getWeeklyFocusInsight(history),
    [history],
  );

  const selectedDay = useMemo(() => {
    if (selectedDateKey) {
      return (
        calendarDays.find(
          (day) =>
            day.dateKey ===
            selectedDateKey,
        ) ?? null
      );
    }

    return (
      calendarDays.find(
        (day) =>
          day.isToday &&
          day.isCurrentMonth,
      ) ??
      calendarDays.find(
        (day) =>
          day.isCurrentMonth &&
          day.sessionCount > 0,
      ) ??
      calendarDays.find(
        (day) =>
          day.isCurrentMonth,
      ) ??
      null
    );
  }, [
    calendarDays,
    selectedDateKey,
  ]);

  function changeMonth(offset: number) {
    const nextMonth =
      moveCalendarMonth(
        visibleMonth,
        offset,
      );

    setVisibleMonth(nextMonth);
    setSelectedDateKey(null);
  }

  function returnToToday() {
    setVisibleMonth(
      createMonthAnchor(),
    );
    setSelectedDateKey(null);
  }

  return (
    <div className="mt-5 space-y-4">
      <InsightCard
        message={weeklyInsight.message}
        direction={
          weeklyInsight.direction
        }
        thisWeekSeconds={
          weeklyInsight.thisWeekSeconds
        }
        lastWeekSeconds={
          weeklyInsight.lastWeekSeconds
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_380px]">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 md:p-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-[#9485ff]">
                FOCUS CALENDAR
              </p>

              <h3 className="mt-2 text-3xl font-black md:text-4xl">
                {formatCalendarMonth(
                  visibleMonth,
                )}
              </h3>

              <p className="mt-2 text-sm font-bold leading-6 text-white/48">
                하루의 집중량이 많을수록
                기록의 색이 깊어집니다.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  changeMonth(-1)
                }
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-xl font-black text-white/55 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
                aria-label="이전 달"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={returnToToday}
                className="h-11 rounded-xl border border-[#8373ef]/35 bg-[#7667e8]/12 px-5 text-sm font-black tracking-[0.08em] text-[#b4abff] transition hover:bg-[#7667e8]/22"
              >
                오늘
              </button>

              <button
                type="button"
                onClick={() =>
                  changeMonth(1)
                }
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-xl font-black text-white/55 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
                aria-label="다음 달"
              >
                ›
              </button>
            </div>
          </header>

          <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              {
                label: "이번 달 총 집중",
                value:
                  formatProfileDuration(
                    monthSummary.totalSeconds,
                  ),
              },
              {
                label: "최대 연속 집중",
                value:
                  `${monthSummary.longestStreakDays}일`,
              },
              {
                label: "평균 집중 시간",
                value:
                  formatProfileDuration(
                    monthSummary.averageSessionSeconds,
                  ),
              },
              {
                label: "최대 집중 시간",
                value:
                  formatProfileDuration(
                    monthSummary.longestSessionSeconds,
                  ),
              },
            ].map((item) => (
              <article
                key={item.label}
                className="rounded-2xl border border-white/[0.08] bg-black/15 px-4 py-4"
              >
                <p className="text-xs font-black tracking-[0.08em] text-white/42">
                  {item.label}
                </p>

                <p className="mt-2 text-xl font-black text-white/95 md:text-2xl">
                  {item.value}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-7 gap-1.5 md:gap-2">
            {WEEKDAYS.map(
              (weekday) => (
                <div
                  key={weekday}
                  className="pb-2 text-center text-xs font-black text-white/42"
                >
                  {weekday}
                </div>
              ),
            )}

            {calendarDays.map((day) => {
              const isSelected =
                selectedDay?.dateKey ===
                day.dateKey;

              return (
                <CalendarDayButton
                  key={day.dateKey}
                  day={day}
                  isSelected={isSelected}
                  onSelect={() =>
                    setSelectedDateKey(
                      day.dateKey,
                    )
                  }
                />
              );
            })}
          </div>

          <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
            <p className="text-xs font-bold text-white/38">
              날짜를 누르면 하루의 집중
              타임라인을 확인할 수 있어요.
            </p>

            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-xs font-bold text-white/38">
                적음
              </span>

              {INTENSITY_CLASSES.map(
                (className, index) => (
                  <span
                    key={index}
                    className={`h-3.5 w-3.5 rounded-[4px] border ${className}`}
                  />
                ),
              )}

              <span className="ml-1 text-xs font-bold text-white/38">
                많음
              </span>
            </div>
          </footer>
        </section>

        <SelectedDayTimeline
          selectedDay={selectedDay}
        />
      </div>
    </div>
  );
}

type InsightCardProps = {
  message: string;
  direction:
    | "increase"
    | "decrease"
    | "same"
    | "new";
  thisWeekSeconds: number;
  lastWeekSeconds: number;
};

function InsightCard({
  message,
  direction,
  thisWeekSeconds,
  lastWeekSeconds,
}: InsightCardProps) {
  const directionIcon =
    direction === "increase"
      ? "↗"
      : direction === "decrease"
        ? "↘"
        : direction === "new"
          ? "✦"
          : "→";

  return (
    <section className="flex flex-col gap-4 rounded-[24px] border border-[#8d7cff]/25 bg-[linear-gradient(135deg,rgba(118,103,232,0.16),rgba(255,255,255,0.035))] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#7869e8]/20 text-xl font-black text-[#b7aeff]">
          {directionIcon}
        </span>

        <div>
          <p className="text-xs font-black tracking-[0.16em] text-[#aaa0ff]">
            AI INSIGHT
          </p>

          <p className="mt-2 text-base font-black leading-7 text-white/88">
            {message}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2">
          <p className="text-[10px] font-black text-white/32">
            지난 주
          </p>
          <p className="mt-1 text-sm font-black">
            {formatProfileDuration(
              lastWeekSeconds,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-[#8d7cff]/20 bg-[#7869e8]/10 px-3 py-2">
          <p className="text-[10px] font-black text-[#aaa0ff]/70">
            이번 주
          </p>
          <p className="mt-1 text-sm font-black text-[#c4beff]">
            {formatProfileDuration(
              thisWeekSeconds,
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

type CalendarDayButtonProps = {
  day: FocusCalendarDay;
  isSelected: boolean;
  onSelect: () => void;
};

function CalendarDayButton({
  day,
  isSelected,
  onSelect,
}: CalendarDayButtonProps) {
  const intensityClass =
    INTENSITY_CLASSES[
      day.intensity
    ];

  const focusDuration =
    formatCalendarCellClock(
      day.totalSeconds,
    );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative aspect-square min-h-12 overflow-hidden rounded-xl border text-left transition md:rounded-2xl ${
        day.isCurrentMonth
          ? intensityClass
          : "border-white/[0.025] bg-white/[0.015] opacity-25"
      } ${
        isSelected
          ? "ring-2 ring-[#b2a8ff] ring-offset-2 ring-offset-[#0b101b]"
          : "hover:-translate-y-0.5 hover:border-white/25"
      }`}
      aria-label={`${formatCalendarDate(
        day.date,
      )}, ${formatProfileDuration(
        day.totalSeconds,
      )}, ${day.sessionCount}회`}
    >
      <span
        className={`absolute left-2.5 top-2.5 z-10 text-xs font-black md:left-3 md:top-3 md:text-sm ${
          day.isToday
            ? "flex h-7 min-w-12 items-center justify-center rounded-full bg-white px-2 text-[#5548b2]"
            : "text-white/65"
        }`}
      >
        {day.dayNumber}일
      </span>

      {focusDuration && (
        <span className="absolute inset-x-2 bottom-2.5 z-10 whitespace-nowrap text-center font-mono text-[10px] font-black tracking-[-0.02em] text-white/68 md:inset-x-3 md:bottom-3 md:text-xs">
          {focusDuration}
        </span>
      )}
    </button>
  );
}

type CircularDayScheduleProps = {
  selectedDay: FocusCalendarDay;
};

function CircularDaySchedule({
  selectedDay,
}: CircularDayScheduleProps) {
  const scheduleSessions =
    useMemo(() => {
      return [
        ...selectedDay.sessions,
      ]
        .sort(
          (a, b) =>
            new Date(
              a.startedAt,
            ).getTime() -
            new Date(
              b.startedAt,
            ).getTime(),
        )
        .map((session) => {
          const startMinute =
            getMinuteOfDay(
              session.startedAt,
            );

          const completedMinute =
            getMinuteOfDay(
              session.completedAt,
            );

          const durationMinutes =
            Math.max(
              1,
              session.actualSeconds / 60,
            );

          let endMinute =
            completedMinute;

          if (
            endMinute <= startMinute
          ) {
            endMinute =
              startMinute +
              durationMinutes;
          }

          return {
            ...session,
            startMinute,
            endMinute: Math.min(
              1440,
              Math.max(
                startMinute + 1,
                endMinute,
              ),
            ),
          };
        });
    }, [selectedDay]);

  const totalRecordedMinutes =
    scheduleSessions.reduce(
      (total, session) =>
        total +
        Math.max(
          0,
          session.endMinute -
            session.startMinute,
        ),
      0,
    );

  return (
    <section className="mt-6 border-t border-white/[0.08] pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black tracking-[0.1em] text-white/55">
            DAILY SCHEDULE
          </p>

          <p className="mt-1 text-xs font-bold text-white/32">
            00시부터 24시까지의 집중
            흐름이에요.
          </p>
        </div>

        <span className="rounded-full bg-[#7869e8]/14 px-3 py-1.5 text-xs font-black text-[#c2bbff]">
          {Math.round(
            totalRecordedMinutes,
          )}
          분
        </span>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/[0.08] bg-black/15 p-4">
        <div className="mx-auto max-w-[280px]">
          <svg
            viewBox="0 0 240 240"
            className="h-auto w-full"
            role="img"
            aria-label={`${formatCalendarDate(
              selectedDay.date,
            )} 24시간 원형 집중 스케줄`}
          >
            <defs>
              <linearGradient
                id={`schedule-gradient-${selectedDay.dateKey}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor="#6656d9"
                />
                <stop
                  offset="100%"
                  stopColor="#b0a4ff"
                />
              </linearGradient>

              <filter
                id={`schedule-glow-${selectedDay.dateKey}`}
                x="-40%"
                y="-40%"
                width="180%"
                height="180%"
              >
                <feGaussianBlur
                  stdDeviation="3"
                  result="blur"
                />

                <feMerge>
                  <feMergeNode
                    in="blur"
                  />
                  <feMergeNode
                    in="SourceGraphic"
                  />
                </feMerge>
              </filter>
            </defs>

            <circle
              cx="120"
              cy="120"
              r="86"
              fill="none"
              stroke="rgba(255,255,255,0.065)"
              strokeWidth="18"
            />

            {Array.from({
              length: 24,
            }).map((_, hour) => {
              const angle =
                (hour / 24) *
                  Math.PI *
                  2 -
                Math.PI / 2;

              const isMajor =
                hour % 6 === 0;

              const innerRadius =
                isMajor ? 72 : 76;

              const outerRadius = 98;

              return (
                <line
                  key={hour}
                  x1={
                    120 +
                    Math.cos(angle) *
                      innerRadius
                  }
                  y1={
                    120 +
                    Math.sin(angle) *
                      innerRadius
                  }
                  x2={
                    120 +
                    Math.cos(angle) *
                      outerRadius
                  }
                  y2={
                    120 +
                    Math.sin(angle) *
                      outerRadius
                  }
                  stroke={
                    isMajor
                      ? "rgba(255,255,255,0.42)"
                      : "rgba(255,255,255,0.13)"
                  }
                  strokeWidth={
                    isMajor ? 2 : 1
                  }
                  strokeLinecap="round"
                />
              );
            })}

            {scheduleSessions.map(
              (session, index) => (
                <path
                  key={session.id}
                  d={createScheduleArcPath(
                    session.startMinute,
                    session.endMinute,
                    86,
                  )}
                  fill="none"
                  stroke={`url(#schedule-gradient-${selectedDay.dateKey})`}
                  strokeWidth="18"
                  strokeLinecap="round"
                  filter={`url(#schedule-glow-${selectedDay.dateKey})`}
                  opacity={Math.max(
                    0.58,
                    1 - index * 0.06,
                  )}
                >
                  <title>
                    {`${session.goal}: ${formatTimelineTime(
                      session.startedAt,
                    )} - ${formatTimelineTime(
                      session.completedAt,
                    )}`}
                  </title>
                </path>
              ),
            )}

            <circle
              cx="120"
              cy="120"
              r="61"
              fill="rgba(12,15,28,0.94)"
              stroke="rgba(255,255,255,0.07)"
            />

            <text
              x="120"
              y="104"
              textAnchor="middle"
              fill="rgba(255,255,255,0.42)"
              fontSize="10"
              fontWeight="800"
              letterSpacing="1.6"
            >
              TOTAL FOCUS
            </text>

            <text
              x="120"
              y="129"
              textAnchor="middle"
              fill="rgba(255,255,255,0.96)"
              fontSize="20"
              fontWeight="900"
            >
              {formatProfileDuration(
                selectedDay.totalSeconds,
              )}
            </text>

            <text
              x="120"
              y="149"
              textAnchor="middle"
              fill="rgba(190,182,255,0.8)"
              fontSize="10"
              fontWeight="800"
            >
              {selectedDay.sessionCount}
              회 집중
            </text>

            <text
              x="120"
              y="15"
              textAnchor="middle"
              fill="rgba(255,255,255,0.42)"
              fontSize="10"
              fontWeight="800"
            >
              00
            </text>

            <text
              x="226"
              y="124"
              textAnchor="middle"
              fill="rgba(255,255,255,0.42)"
              fontSize="10"
              fontWeight="800"
            >
              06
            </text>

            <text
              x="120"
              y="236"
              textAnchor="middle"
              fill="rgba(255,255,255,0.42)"
              fontSize="10"
              fontWeight="800"
            >
              12
            </text>

            <text
              x="14"
              y="124"
              textAnchor="middle"
              fill="rgba(255,255,255,0.42)"
              fontSize="10"
              fontWeight="800"
            >
              18
            </text>
          </svg>
        </div>

        {scheduleSessions.length === 0 ? (
          <div className="mt-1 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center">
            <p className="text-sm font-black text-white/45">
              표시할 집중 구간이 없어요.
            </p>

            <p className="mt-1 text-xs font-bold text-white/28">
              집중 세션을 완료하면 원형
              스케줄에 자동으로 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {scheduleSessions.map(
              (session) => (
                <article
                  key={session.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-3"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#9c8fff] shadow-[0_0_12px_rgba(156,143,255,0.7)]" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white/82">
                      {session.goal}
                    </p>

                    <p className="mt-1 text-[11px] font-bold text-white/34">
                      {formatTimelineTime(
                        session.startedAt,
                      )}
                      {" — "}
                      {formatTimelineTime(
                        session.completedAt,
                      )}
                    </p>
                  </div>

                  <span className="shrink-0 text-xs font-black text-[#bdb5ff]">
                    {formatProfileDuration(
                      session.actualSeconds,
                    )}
                  </span>
                </article>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}

type SelectedDayTimelineProps = {
  selectedDay:
    FocusCalendarDay | null;
};

function SelectedDayTimeline({
  selectedDay,
}: SelectedDayTimelineProps) {
  const chronologicalSessions =
    useMemo(() => {
      if (!selectedDay) {
        return [];
      }

      return [
        ...selectedDay.sessions,
      ].sort(
        (a, b) =>
          new Date(
            a.startedAt,
          ).getTime() -
          new Date(
            b.startedAt,
          ).getTime(),
      );
    }, [selectedDay]);

  if (!selectedDay) {
    return null;
  }

  return (
    <aside className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(116,103,216,0.16),rgba(255,255,255,0.035))] p-6 md:p-7">
      <p className="text-xs font-black tracking-[0.16em] text-[#b1a8ff]">
        DAILY TIMELINE
      </p>

      <h3 className="mt-3 text-3xl font-black">
        {formatCalendarDate(
          selectedDay.date,
        )}
      </h3>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <article className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
          <p className="text-xs font-black text-white/42">
            총 집중
          </p>

          <p className="mt-2 text-2xl font-black">
            {formatProfileDuration(
              selectedDay.totalSeconds,
            )}
          </p>
        </article>

        <article className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
          <p className="text-xs font-black text-white/42">
            세션
          </p>

          <p className="mt-2 text-2xl font-black">
            {selectedDay.sessionCount}회
          </p>
        </article>
      </div>

      <CircularDaySchedule
        selectedDay={selectedDay}
      />

      <div className="mt-6 border-t border-white/[0.08] pt-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black tracking-[0.1em] text-white/55">
            FOCUS TIMELINE
          </p>

          <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white/55">
            {selectedDay.sessionCount}
          </span>
        </div>

        {chronologicalSessions.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center">
            <p className="text-base font-black text-white/48">
              아직 집중 기록이 없어요.
            </p>

            <p className="mt-2 text-sm font-bold leading-6 text-white/32">
              이 날의 첫 집중을
              기록해보세요.
            </p>
          </div>
        ) : (
          <div className="relative mt-5 max-h-[430px] overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div
              aria-hidden="true"
              className="absolute bottom-4 left-[51px] top-3 w-px bg-[linear-gradient(180deg,rgba(169,156,255,0.7),rgba(255,255,255,0.06))]"
            />

            <div className="space-y-4">
              {chronologicalSessions.map(
                (session, index) => (
                  <article
                    key={session.id}
                    className="relative grid grid-cols-[42px_18px_minmax(0,1fr)] gap-2"
                  >
                    <div className="pt-1 text-right">
                      <p className="text-xs font-black text-white/52">
                        {formatTimelineTime(
                          session.startedAt,
                        )}
                      </p>
                    </div>

                    <div className="relative flex justify-center pt-1.5">
                      <span className="relative z-10 h-3.5 w-3.5 rounded-full border-[3px] border-[#181a32] bg-[#a99cff] shadow-[0_0_0_3px_rgba(169,156,255,0.12)]" />
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-base font-black leading-6 text-white/90">
                            {session.goal}
                          </p>

                          <p className="mt-2 text-xs font-bold text-white/38">
                            {formatTimelineTime(
                              session.startedAt,
                            )}
                            {" — "}
                            {formatTimelineTime(
                              session.completedAt,
                            )}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-[#7869e8]/14 px-3 py-1.5 text-xs font-black text-[#c2bbff]">
                          {formatProfileDuration(
                            session.actualSeconds,
                          )}
                        </span>
                      </div>

                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#6656d9,#9c8fff)]"
                          style={{
                            width: `${Math.max(
                              8,
                              Math.min(
                                100,
                                (session.actualSeconds /
                                  Math.max(
                                    ...chronologicalSessions.map(
                                      (item) =>
                                        item.actualSeconds,
                                    ),
                                  )) *
                                  100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>

                      {index ===
                        chronologicalSessions.length -
                          1 && (
                        <p className="mt-3 text-[10px] font-bold text-white/24">
                          오늘의 마지막 집중 세션
                        </p>
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
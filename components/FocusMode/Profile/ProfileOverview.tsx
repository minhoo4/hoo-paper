"use client";

import {
  useMemo,
} from "react";
import type {
  FocusHistory,
  FocusStatistics,
  FocusStreak,
} from "../types/focus";
import {
  getFocusIntensity,
  groupFocusHistoryByDate,
} from "../utils/focusCalendar";
import {
  createLocalDateKey,
} from "../utils/focusStreak";
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

const WEEK_INTENSITY_CLASSES = [
  "border-white/[0.08] bg-white/[0.055]",
  "border-[#54499e]/45 bg-[#54499e]/35",
  "border-[#6558c1]/55 bg-[#6558c1]/55",
  "border-[#7969e7]/70 bg-[#7969e7]/75",
  "border-[#a093ff]/85 bg-[#9385ff]",
];

type ProfileOverviewProps = {
  statistics: FocusStatistics | null;
  streak: FocusStreak | null;
  history: FocusHistory[];
};

export default function ProfileOverview({
  statistics,
  streak,
  history,
}: ProfileOverviewProps) {
  const weeklyFocusDays = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const currentDay = now.getDay();
    const daysFromMonday =
      currentDay === 0
        ? 6
        : currentDay - 1;

    const monday = new Date(now);
    monday.setDate(
      monday.getDate() -
        daysFromMonday,
    );

    const groupedHistory =
      groupFocusHistoryByDate(history);

    return WEEKDAYS.map(
      (label, index) => {
        const date = new Date(monday);
        date.setDate(
          monday.getDate() + index,
        );

        const dateKey =
          createLocalDateKey(date);

        const sessions =
          groupedHistory.get(dateKey) ?? [];

        const totalSeconds =
          sessions.reduce(
            (sum, session) =>
              sum +
              session.actualSeconds,
            0,
          );

        return {
          label,
          dateKey,
          totalSeconds,
          sessionCount:
            sessions.length,
          intensity:
            getFocusIntensity(
              totalSeconds,
            ),
          isToday:
            date.getTime() ===
            now.getTime(),
        };
      },
    );
  }, [history]);

  const profileStatistics =
    statistics;
  const profileStreak = streak;

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "오늘 집중",
            value: formatProfileDuration(
              profileStatistics?.todaySeconds ?? 0,
            ),
            sub: `${profileStatistics?.todaySessions ?? 0}회 완료`,
            icon: "◷",
          },
          {
            label: "현재 연속",
            value: `${profileStreak?.currentStreak ?? 0}일`,
            sub: `최고 ${profileStreak?.longestStreak ?? 0}일`,
            icon: "♨",
          },
          {
            label: "누적 집중",
            value: formatProfileDuration(
              profileStatistics?.totalSeconds ?? 0,
            ),
            sub: `${profileStatistics?.totalSessions ?? 0}개의 세션`,
            icon: "✦",
          },
          {
            label: "완주율",
            value: `${profileStatistics?.completionRate ?? 0}%`,
            sub: "계획 대비 실제 집중",
            icon: "◇",
          },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-[24px] border border-white/10 bg-white/[0.045] p-5 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.065]"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-black tracking-[0.13em] text-white/40">
                {item.label}
              </p>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7a6be8]/15 text-[#a99cff]">
                {item.icon}
              </span>
            </div>

            <p className="mt-5 text-3xl font-black tracking-[-0.04em]">
              {item.value}
            </p>

            <p className="mt-2 text-xs font-bold text-white/40">
              {item.sub}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.16em] text-[#9485ff]">
                THIS WEEK
              </p>

              <h3 className="mt-2 text-2xl font-black">
                이번 주 집중 흐름
              </h3>
            </div>

            <span className="rounded-full bg-[#7869e8]/15 px-3 py-1.5 text-xs font-black text-[#a99cff]">
              {formatProfileDuration(
                profileStatistics?.weekSeconds ?? 0,
              )}
            </span>
          </div>

          <div className="mt-7 grid grid-cols-7 gap-2 md:gap-3">
            {weeklyFocusDays.map(
              (day) => {
                const levelClass =
                  WEEK_INTENSITY_CLASSES[
                    day.intensity
                  ];

                return (
                  <div
                    key={day.dateKey}
                    className="text-center"
                    title={`${day.label} · ${formatProfileDuration(
                      day.totalSeconds,
                    )} · ${day.sessionCount}회`}
                  >
                    <div
                      className={`relative mx-auto aspect-square w-full max-w-[68px] rounded-2xl border transition hover:-translate-y-0.5 ${levelClass} ${
                        day.isToday
                          ? "ring-2 ring-[#b2a8ff] ring-offset-2 ring-offset-[#111722]"
                          : ""
                      }`}
                    >
                      {day.totalSeconds > 0 && (
                        <span className="absolute inset-x-1 bottom-2 truncate text-[10px] font-black text-white/72 md:text-xs">
                          {formatProfileDuration(
                            day.totalSeconds,
                          )}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-xs font-black text-white/42">
                      {day.label}
                    </p>
                  </div>
                );
              },
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
            <p className="text-xs font-bold text-white/38">
              실제 집중시간에 따라
              색이 자동으로 진해집니다.
            </p>

            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-xs font-bold text-white/38">
                적음
              </span>

              {WEEK_INTENSITY_CLASSES.map(
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
          </div>
        </article>

        <article className="rounded-[26px] border border-white/10 bg-[linear-gradient(145deg,rgba(116,103,216,0.18),rgba(255,255,255,0.035))] p-5 md:p-6">
          <p className="text-xs font-black tracking-[0.16em] text-[#b2a9ff]">
            LATEST GOAL
          </p>

          <h3 className="mt-4 text-2xl font-black leading-snug">
            {profileStatistics?.latestGoal ||
              "첫 집중 목표를 기다리고 있어요."}
          </h3>

          <div className="mt-8 border-t border-white/10 pt-5">
            <p className="text-xs font-bold text-white/35">
              평균 집중 시간
            </p>

            <p className="mt-2 text-2xl font-black">
              {formatProfileDuration(
                profileStatistics?.averageSession ?? 0,
              )}
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}

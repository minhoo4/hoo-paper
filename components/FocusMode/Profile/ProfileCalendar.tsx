"use client";

import {
  ChangeEvent,
  useEffect,
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

type DailyJournalBookEntry = {
  journalDate: string;
  content: string;
  updatedAt: string;
};

type ProfileCalendarProps = {
  history: FocusHistory[];

  dailyJournal: string;

  dailyJournalEntries:
    DailyJournalBookEntry[];

  journalBookLoading: boolean;

  journalLoading: boolean;
  journalSaving: boolean;
  journalSaved: boolean;
  journalExists: boolean;

  onLoadDailyJournal:
    (targetDate: Date) =>
      void | Promise<void>;

  onChangeDailyJournal: (
    event:
      ChangeEvent<HTMLTextAreaElement>,
    targetDate: Date,
  ) => void;
};


export default function ProfileCalendar({
  history,
  dailyJournal,
  dailyJournalEntries,
  journalBookLoading,
  journalLoading,
  journalSaving,
  journalSaved,
  journalExists,
  onLoadDailyJournal,
  onChangeDailyJournal,
}: ProfileCalendarProps) {


  const [
  isCalendarMounted,
  setIsCalendarMounted,
] = useState(false);

const [
  visibleMonth,
  setVisibleMonth,
] = useState(() =>
  createMonthAnchor(),
);


  const [
    selectedDateKey,
    setSelectedDateKey,
  ] = useState<string | null>(null);


  useEffect(() => {
  setIsCalendarMounted(true);
}, []);


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

  useEffect(() => {
  if (!selectedDay) {
    return;
  }

  void onLoadDailyJournal(
    selectedDay.date,
  );
}, [
  selectedDay,
  onLoadDailyJournal,
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

  setSelectedDateKey(
    null,
  );
}

if (!isCalendarMounted) {
  return (
    <div className="mt-5">
      <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04]">
        <div className="text-center">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-4 border-white/10 border-t-[#9688ff]" />

          <p className="mt-5 text-sm font-black text-white/45">
            캘린더를 불러오고 있어요.
          </p>
        </div>
      </div>
    </div>
  );
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_380px]">
        <div className="min-w-0 space-y-4">
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

        <DailyJournalBook
          entries={dailyJournalEntries}
          isLoading={journalBookLoading}
          onOpenEntry={(entry) => {
            const entryDate = new Date(
              `${entry.journalDate}T12:00:00`,
            );

            if (Number.isNaN(entryDate.getTime())) {
              return;
            }

            setVisibleMonth(
              createMonthAnchor(entryDate),
            );
            setSelectedDateKey(entry.journalDate);
            void onLoadDailyJournal(entryDate);
          }}
        />
        </div>

        <SelectedDayTimeline
          selectedDay={selectedDay}
          dailyJournal={dailyJournal}
          journalLoading={journalLoading}
          journalSaving={journalSaving}
          journalSaved={journalSaved}
          journalExists={journalExists}
          onChangeDailyJournal={onChangeDailyJournal}
        />
      </div>
    </div>
  );
}


type DailyJournalBookProps = {
  entries:
    DailyJournalBookEntry[];

  isLoading: boolean;

  onOpenEntry: (
    entry:
      DailyJournalBookEntry,
  ) => void;
};

function DailyJournalBook({
  entries,
  isLoading,
  onOpenEntry,
}: DailyJournalBookProps) {
  const [
    currentPage,
    setCurrentPage,
  ] = useState(0);

  const [
    pageDirection,
    setPageDirection,
  ] = useState<
    "previous" |
    "next" |
    null
  >(null);

  const safePage =
    entries.length === 0
      ? 0
      : Math.min(
          currentPage,
          entries.length - 1,
        );

  const currentEntry =
    entries[
      safePage
    ] ?? null;

  useEffect(() => {
    if (
      entries.length === 0
    ) {
      setCurrentPage(0);
      return;
    }

    setCurrentPage(
      (previous) =>
        Math.min(
          previous,
          entries.length - 1,
        ),
    );
  }, [
    entries.length,
  ]);

  function movePage(
    direction:
      | "previous"
      | "next",
  ) {
    if (
      entries.length <= 1
    ) {
      return;
    }

    setPageDirection(
      direction,
    );

    setCurrentPage(
      (previous) => {
        if (
          direction ===
          "previous"
        ) {
          return previous === 0
            ? entries.length - 1
            : previous - 1;
        }

        return (
          previous ===
          entries.length - 1
            ? 0
            : previous + 1
        );
      },
    );

    window.setTimeout(
      () => {
        setPageDirection(
          null,
        );
      },
      650,
    );
  }

  function formatBookDate(
    journalDate: string,
  ) {
    const date =
      new Date(
        `${journalDate}T12:00:00`,
      );

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return journalDate;
    }

    return date.toLocaleDateString(
      "ko-KR",
      {
        year:
          "numeric",
        month:
          "long",
        day:
          "numeric",
        weekday:
          "long",
      },
    );
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#8f7cff]/20 bg-[linear-gradient(145deg,rgba(84,63,45,0.34),rgba(20,18,29,0.96))] p-4 shadow-[0_25px_70px_rgba(0,0,0,0.34)] sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.2em] text-[#c9b18d]">
            DAILY JOURNAL BOOK
          </p>

          <h3 className="mt-2 text-2xl font-black text-white md:text-3xl">
            한줄일기 모아보기
          </h3>

          <p className="mt-2 text-sm font-bold leading-6 text-white/42">
            날짜별 기록을 책장처럼 넘겨보세요.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-black text-white/60">
            총 {entries.length}페이지
          </span>

          {entries.length > 0 && (
            <span className="rounded-full bg-[#8b75e9]/15 px-4 py-2 text-xs font-black text-[#c5bbff]">
              {safePage + 1}
              {" / "}
              {entries.length}
            </span>
          )}
        </div>
      </header>

      {isLoading ? (
        <div className="mt-6 flex min-h-[330px] items-center justify-center rounded-[26px] border border-white/10 bg-black/20">
          <p className="text-sm font-black text-white/45">
            일기장을 펼치고 있어요.
          </p>
        </div>
      ) : !currentEntry ? (
        <div className="mt-6 flex min-h-[330px] flex-col items-center justify-center rounded-[26px] border border-dashed border-white/10 bg-black/15 px-6 text-center">
          <span className="text-5xl">
            📖
          </span>

          <p className="mt-5 text-lg font-black text-white/65">
            아직 작성된 일기가 없어요.
          </p>

          <p className="mt-2 text-sm font-bold leading-6 text-white/35">
            캘린더에서 날짜를 선택하고
            <br />
            첫 기록을 남겨보세요.
          </p>
        </div>
      ) : (
        <div className="relative mt-5">
          <div
            className={`hoo-journal-book-page relative mx-auto min-h-[520px] max-w-[520px] overflow-hidden rounded-[24px] border border-[#d2b98d]/45 bg-[#eee1c3] shadow-[0_24px_55px_rgba(0,0,0,0.38)] ${
              pageDirection ===
              "next"
                ? "hoo-journal-page-next"
                : pageDirection ===
                    "previous"
                  ? "hoo-journal-page-previous"
                  : ""
            }`}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-[178px] z-10 h-px bg-[#8e734d]/25 shadow-[0_0_18px_rgba(70,50,24,0.24)]"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0px,transparent_31px,rgba(103,80,46,0.09)_32px)]"
            />

            {pageDirection && (
              <div
                aria-hidden="true"
                className={`hoo-journal-turning-sheet pointer-events-none absolute inset-0 z-30 overflow-hidden bg-[#eee1c3] ${
                  pageDirection === "next"
                    ? "hoo-journal-turn-next"
                    : "hoo-journal-turn-previous"
                }`}
              >
                <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0px,transparent_31px,rgba(103,80,46,0.10)_32px)]" />
                <div className="hoo-journal-sheet-light absolute inset-y-0 w-[42%]" />
                <div className="hoo-journal-sheet-shadow absolute inset-y-0 w-[28%]" />
                <div className="absolute inset-x-0 top-[178px] h-px bg-[#8e734d]/20" />
              </div>
            )}

            <div className="relative z-10 flex min-h-[520px] flex-col">
              <article className="border-b border-[#9e8258]/20 px-7 py-6 text-[#4d402f] sm:px-8">
                <p className="text-xs font-black tracking-[0.18em] text-[#8f7550]">
                  HOO DAILY JOURNAL
                </p>

                <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                <p className="text-5xl font-black leading-none text-[#5d4a31]">
                  {String(
                    new Date(
                      `${currentEntry.journalDate}T12:00:00`,
                    ).getDate(),
                  ).padStart(
                    2,
                    "0",
                  )}
                </p>

                <p className="mt-3 text-sm font-black leading-6 sm:text-base">
                  {formatBookDate(
                    currentEntry.journalDate,
                  )}
                </p>

                </div>

                <div>
                  <span className="inline-flex rounded-full border border-[#987c51]/25 bg-white/25 px-4 py-2 text-xs font-black text-[#715b3c]">
                    PAGE {safePage + 1}
                  </span>
                </div>
                </div>
              </article>

              <article className="flex min-h-[340px] flex-1 flex-col p-7 text-[#453a2b] sm:p-8">
                <p className="text-xs font-black tracking-[0.16em] text-[#937852]">
                  TODAY&apos;S STORY
                </p>

                <p className="mt-6 max-h-[230px] flex-1 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-base font-bold leading-8 [scrollbar-width:thin] sm:text-lg">
                  {currentEntry.content}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    onOpenEntry(
                      currentEntry,
                    )
                  }
                  className="mt-7 self-end rounded-full border border-[#826943]/25 bg-white/30 px-5 py-2.5 text-xs font-black text-[#665137] transition hover:bg-white/50"
                >
                  이 날짜 열기
                </button>
              </article>
            </div>
          </div>

          {entries.length > 1 && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  movePage(
                    "previous",
                  )
                }
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-2xl font-black text-white/70 transition hover:border-[#9b8cff]/40 hover:bg-[#806fe8]/15 hover:text-white"
                aria-label="이전 일기"
              >
                ‹
              </button>

              <div className="flex max-w-[240px] gap-1.5 overflow-hidden">
                {entries
                  .slice(
                    Math.max(
                      0,
                      safePage - 2,
                    ),
                    Math.max(
                      5,
                      safePage + 3,
                    ),
                  )
                  .map(
                    (
                      entry,
                    ) => {
                      const index =
                        entries.findIndex(
                          (
                            candidate,
                          ) =>
                            candidate
                              .journalDate ===
                            entry
                              .journalDate,
                        );

                      return (
                        <button
                          key={
                            entry.journalDate
                          }
                          type="button"
                          onClick={() =>
                            setCurrentPage(
                              index,
                            )
                          }
                          className={`h-2.5 rounded-full transition-all ${
                            index ===
                            safePage
                              ? "w-7 bg-[#9d8dff]"
                              : "w-2.5 bg-white/20 hover:bg-white/40"
                          }`}
                          aria-label={`${formatBookDate(
                            entry.journalDate,
                          )} 일기 열기`}
                        />
                      );
                    },
                  )}
              </div>

              <button
                type="button"
                onClick={() =>
                  movePage(
                    "next",
                  )
                }
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-2xl font-black text-white/70 transition hover:border-[#9b8cff]/40 hover:bg-[#806fe8]/15 hover:text-white"
                aria-label="다음 일기"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .hoo-journal-book-page {
          perspective: 1500px;
          transform-style: preserve-3d;
        }

        @keyframes journal-content-next {
          0%, 42% {
            opacity: 0.36;
            filter: brightness(0.86);
          }

          100% {
            opacity: 1;
            filter: brightness(1);
          }
        }

        @keyframes journal-content-previous {
          0%, 42% {
            opacity: 0.4;
            filter: brightness(0.88);
          }

          100% {
            opacity: 1;
            filter: brightness(1);
          }
        }

        @keyframes journal-sheet-next {
          0% {
            opacity: 1;
            transform: rotateY(0deg) skewY(0deg);
            box-shadow: -4px 0 12px rgba(45, 31, 16, 0.12);
          }

          45% {
            opacity: 1;
            transform: rotateY(-58deg) skewY(0.6deg);
            box-shadow: -28px 7px 38px rgba(45, 31, 16, 0.38);
          }

          82% {
            opacity: 0.96;
            transform: rotateY(-94deg) skewY(0.25deg);
            box-shadow: -10px 2px 24px rgba(45, 31, 16, 0.28);
          }

          100% {
            opacity: 0;
            transform: rotateY(-108deg) skewY(0deg);
            box-shadow: none;
          }
        }

        @keyframes journal-sheet-previous {
          0% {
            opacity: 1;
            transform: rotateY(0deg) skewY(0deg);
            box-shadow: 4px 0 12px rgba(45, 31, 16, 0.12);
          }

          45% {
            opacity: 1;
            transform: rotateY(58deg) skewY(-0.6deg);
            box-shadow: 28px 7px 38px rgba(45, 31, 16, 0.38);
          }

          82% {
            opacity: 0.96;
            transform: rotateY(94deg) skewY(-0.25deg);
            box-shadow: 10px 2px 24px rgba(45, 31, 16, 0.28);
          }

          100% {
            opacity: 0;
            transform: rotateY(108deg) skewY(0deg);
            box-shadow: none;
          }
        }

        @keyframes journal-sheet-glint {
          0% {
            opacity: 0;
            transform: translateX(-45%);
          }

          38% {
            opacity: 0.7;
          }

          100% {
            opacity: 0;
            transform: translateX(185%);
          }
        }

        @keyframes journal-sheet-shadow {
          0% {
            opacity: 0.08;
          }

          52% {
            opacity: 0.48;
          }

          100% {
            opacity: 0;
          }
        }

        .hoo-journal-page-next {
          animation: journal-content-next 620ms ease-out;
        }

        .hoo-journal-page-previous {
          animation: journal-content-previous 620ms ease-out;
        }

        .hoo-journal-turning-sheet {
          backface-visibility: hidden;
          transform-style: preserve-3d;
          will-change: transform, opacity, box-shadow;
        }

        .hoo-journal-turn-next {
          left: 0;
          transform-origin: left center;
          animation: journal-sheet-next 620ms cubic-bezier(0.42, 0, 0.18, 1) forwards;
        }

        .hoo-journal-turn-previous {
          right: 0;
          transform-origin: right center;
          animation: journal-sheet-previous 620ms cubic-bezier(0.42, 0, 0.18, 1) forwards;
        }

        .hoo-journal-sheet-light {
          left: 3%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.65), transparent);
          animation: journal-sheet-glint 620ms ease-in-out forwards;
        }

        .hoo-journal-sheet-shadow {
          right: 0;
          background: linear-gradient(90deg, transparent, rgba(72, 49, 24, 0.4));
          animation: journal-sheet-shadow 620ms ease-in-out forwards;
        }

        @media (
          prefers-reduced-motion:
            reduce
        ) {
          .hoo-journal-page-next,
          .hoo-journal-page-previous,
          .hoo-journal-turning-sheet,
          .hoo-journal-sheet-light,
          .hoo-journal-sheet-shadow {
            animation: none;
          }
        }
      `}</style>
    </section>
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

type ScheduleRingSegment = {
  id: string;
  sessionId: string;
  goal: string;
  startedAt: string;
  completedAt: string;
  actualSeconds: number;
  startMinute: number;
  durationMinutes: number;
};

const DAY_MINUTES = 24 * 60;
const SCHEDULE_RING_RADIUS = 86;
const SCHEDULE_RING_CIRCUMFERENCE =
  2 *
  Math.PI *
  SCHEDULE_RING_RADIUS;
const SCHEDULE_SEGMENT_GAP_MINUTES = 2;

function CircularDaySchedule({
  selectedDay,
}: CircularDayScheduleProps) {
  const [
    hoveredSessionId,
    setHoveredSessionId,
  ] = useState<string | null>(null);

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

          const durationMinutes =
            Math.max(
              1 / 60,
              session.actualSeconds / 60,
            );

          return {
            ...session,
            startMinute,
            durationMinutes,
          };
        });
    }, [selectedDay]);

  const ringSegments =
    useMemo<
      ScheduleRingSegment[]
    >(() => {
      return scheduleSessions.flatMap(
        (session) => {
          const safeDuration =
            Math.min(
              DAY_MINUTES,
              session.durationMinutes,
            );

          const firstDuration =
            Math.min(
              safeDuration,
              DAY_MINUTES -
                session.startMinute,
            );

          const segments: ScheduleRingSegment[] =
            [
              {
                id: `${session.id}-first`,
                sessionId: session.id,
                goal: session.goal,
                startedAt:
                  session.startedAt,
                completedAt:
                  session.completedAt,
                actualSeconds:
                  session.actualSeconds,
                startMinute:
                  session.startMinute,
                durationMinutes:
                  firstDuration,
              },
            ];

          const remainingDuration =
            safeDuration -
            firstDuration;

          if (
            remainingDuration > 0
          ) {
            segments.push({
              id: `${session.id}-overflow`,
              sessionId: session.id,
              goal: session.goal,
              startedAt:
                session.startedAt,
              completedAt:
                session.completedAt,
              actualSeconds:
                session.actualSeconds,
              startMinute: 0,
              durationMinutes:
                remainingDuration,
            });
          }

          return segments;
        },
      );
    }, [scheduleSessions]);

  const hoveredSession =
    scheduleSessions.find(
      (session) =>
        session.id ===
        hoveredSessionId,
    ) ?? null;

  const gradientId =
    `schedule-gradient-${selectedDay.dateKey}`;

  const glowId =
    `schedule-glow-${selectedDay.dateKey}`;

  return (
    <section className="mt-6 border-t border-white/[0.08] pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black tracking-[0.1em] text-white/55">
            DAILY SCHEDULE
          </p>

          <p className="mt-1 text-xs font-bold text-white/32">
            포커스 모드를 실행한 시간을
            24시간 원형 바에 표시합니다.
          </p>
        </div>

        <span className="rounded-full bg-[#7869e8]/14 px-3 py-1.5 text-xs font-black text-[#c2bbff]">
          {formatProfileDuration(
            selectedDay.totalSeconds,
          )}
        </span>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/[0.08] bg-black/15 p-4">
        <div className="relative mx-auto max-w-[290px]">
          <svg
            viewBox="0 0 240 240"
            className="h-auto w-full overflow-visible"
            role="img"
            aria-label={`${formatCalendarDate(
              selectedDay.date,
            )} 24시간 원형 집중 스케줄`}
            onMouseLeave={() =>
              setHoveredSessionId(
                null,
              )
            }
          >
            <defs>
              <linearGradient
                id={gradientId}
                x1="15%"
                y1="10%"
                x2="85%"
                y2="90%"
              >
                <stop
                  offset="0%"
                  stopColor="#d2cbff"
                />

                <stop
                  offset="46%"
                  stopColor="#aa9cff"
                />

                <stop
                  offset="100%"
                  stopColor="#8170ef"
                />
              </linearGradient>

              <filter
                id={glowId}
                x="-35%"
                y="-35%"
                width="170%"
                height="170%"
              >
                <feGaussianBlur
                  stdDeviation="2.2"
                  result="blur"
                />

                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="
                    1 0 0 0 0.56
                    0 1 0 0 0.49
                    0 0 1 0 1
                    0 0 0 0.72 0
                  "
                  result="coloredBlur"
                />

                <feMerge>
                  <feMergeNode
                    in="coloredBlur"
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
              r={
                SCHEDULE_RING_RADIUS
              }
              fill="none"
              stroke="rgba(255,255,255,0.075)"
              strokeWidth="18"
            />

            <circle
              cx="120"
              cy="120"
              r={
                SCHEDULE_RING_RADIUS
              }
              fill="none"
              stroke="rgba(150,139,225,0.05)"
              strokeWidth="14"
            />

            {ringSegments.map(
              (segment) => {
                const visibleMinutes =
                  Math.max(
                    0.35,
                    segment.durationMinutes -
                      Math.min(
                        SCHEDULE_SEGMENT_GAP_MINUTES,
                        segment.durationMinutes *
                          0.08,
                      ),
                  );

                const segmentLength =
                  (visibleMinutes /
                    DAY_MINUTES) *
                  SCHEDULE_RING_CIRCUMFERENCE;

                const segmentOffset =
                  -(
                    segment.startMinute /
                    DAY_MINUTES
                  ) *
                  SCHEDULE_RING_CIRCUMFERENCE;

                const isHovered =
                  hoveredSessionId ===
                  segment.sessionId;

                return (
                  <circle
                    key={segment.id}
                    cx="120"
                    cy="120"
                    r={
                      SCHEDULE_RING_RADIUS
                    }
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={
                      isHovered
                        ? 20
                        : 18
                    }
                    strokeLinecap="round"
                    strokeDasharray={`${segmentLength} ${SCHEDULE_RING_CIRCUMFERENCE}`}
                    strokeDashoffset={
                      segmentOffset
                    }
                    transform="rotate(-90 120 120)"
                    filter={`url(#${glowId})`}
                    opacity={
                      hoveredSessionId &&
                      !isHovered
                        ? 0.42
                        : 1
                    }
                    className="cursor-pointer transition-[opacity,stroke-width] duration-200"
                    onMouseEnter={() =>
                      setHoveredSessionId(
                        segment.sessionId,
                      )
                    }
                    onFocus={() =>
                      setHoveredSessionId(
                        segment.sessionId,
                      )
                    }
                    tabIndex={0}
                    aria-label={`${segment.goal}, ${formatTimelineTime(
                      segment.startedAt,
                    )}부터 ${formatTimelineTime(
                      segment.completedAt,
                    )}까지`}
                  >
                    <title>
                      {`${segment.goal}: ${formatTimelineTime(
                        segment.startedAt,
                      )} - ${formatTimelineTime(
                        segment.completedAt,
                      )} · ${formatProfileDuration(
                        segment.actualSeconds,
                      )}`}
                    </title>
                  </circle>
                );
              },
            )}

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
                isMajor ? 71 : 76;

              const outerRadius =
                isMajor ? 101 : 98;

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
                      ? "rgba(255,255,255,0.5)"
                      : "rgba(255,255,255,0.13)"
                  }
                  strokeWidth={
                    isMajor ? 2 : 1
                  }
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              );
            })}

            <circle
              cx="120"
              cy="120"
              r="61"
              fill="rgba(10,13,25,0.97)"
              stroke="rgba(255,255,255,0.075)"
            />

            <text
              x="120"
              y="103"
              textAnchor="middle"
              fill="rgba(255,255,255,0.43)"
              fontSize="9.5"
              fontWeight="800"
              letterSpacing="1.6"
            >
              TOTAL FOCUS
            </text>

            <text
              x="120"
              y="129"
              textAnchor="middle"
              fill="rgba(255,255,255,0.97)"
              fontSize="19"
              fontWeight="900"
            >
              {formatProfileDuration(
                selectedDay.totalSeconds,
              )}
            </text>

            <text
              x="120"
              y="150"
              textAnchor="middle"
              fill="rgba(194,185,255,0.86)"
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
              fill="rgba(255,255,255,0.47)"
              fontSize="10"
              fontWeight="800"
            >
              00
            </text>

            <text
              x="226"
              y="124"
              textAnchor="middle"
              fill="rgba(255,255,255,0.47)"
              fontSize="10"
              fontWeight="800"
            >
              06
            </text>

            <text
              x="120"
              y="236"
              textAnchor="middle"
              fill="rgba(255,255,255,0.47)"
              fontSize="10"
              fontWeight="800"
            >
              12
            </text>

            <text
              x="14"
              y="124"
              textAnchor="middle"
              fill="rgba(255,255,255,0.47)"
              fontSize="10"
              fontWeight="800"
            >
              18
            </text>
          </svg>

          {hoveredSession && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[190px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#a99cff]/25 bg-[#0d1120]/95 px-4 py-3 text-center shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <p className="truncate text-sm font-black text-white/92">
                {hoveredSession.goal}
              </p>

              <p className="mt-1 text-xs font-bold text-white/45">
                {formatTimelineTime(
                  hoveredSession.startedAt,
                )}
                {" — "}
                {formatTimelineTime(
                  hoveredSession.completedAt,
                )}
              </p>

              <p className="mt-2 text-sm font-black text-[#bdb4ff]">
                {formatProfileDuration(
                  hoveredSession.actualSeconds,
                )}
              </p>
            </div>
          )}
        </div>

      {scheduleSessions.length === 0 ? (
  <div className="mt-2 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center">
    <p className="text-sm font-black text-white/45">
      표시할 포커스 시간이 없어요.
    </p>

    <p className="mt-1 text-xs font-bold leading-5 text-white/28">
      포커스 모드를 완료하면
      연보라색 원형 바에 자동으로
      기록됩니다.
    </p>
  </div>
) : (
  <div className="mt-3 max-h-[168px] overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.07] bg-white/[0.018] [scrollbar-color:rgba(169,156,255,0.45)_rgba(255,255,255,0.04)] [scrollbar-width:thin]">
    {scheduleSessions.map(
      (session, index) => {
        const isHovered =
          hoveredSessionId ===
          session.id;

        return (
          <button
            type="button"
            key={session.id}
            onMouseEnter={() =>
              setHoveredSessionId(
                session.id,
              )
            }
            onMouseLeave={() =>
              setHoveredSessionId(
                null,
              )
            }
            onFocus={() =>
              setHoveredSessionId(
                session.id,
              )
            }
            onBlur={() =>
              setHoveredSessionId(
                null,
              )
            }
            className={`flex min-h-14 w-full items-center gap-3 px-3 py-3 text-left transition ${
              index > 0
                ? "border-t border-white/[0.06]"
                : ""
            } ${
              isHovered
                ? "bg-[#8f7fff]/10"
                : "hover:bg-white/[0.035]"
            }`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#aa9cff] shadow-[0_0_12px_rgba(170,156,255,0.72)]" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-white/80">
                {formatTimelineTime(
                  session.startedAt,
                )}
                {" — "}
                {formatTimelineTime(
                  session.completedAt,
                )}
              </p>

              <p className="mt-1 truncate text-[11px] font-bold text-white/34">
                {session.goal}
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-[#8575ee]/12 px-2.5 py-1 text-[11px] font-black text-[#bdb4ff]">
              {formatProfileDuration(
                session.actualSeconds,
              )}
            </span>
          </button>
        );
      },
    )}
  </div>
)}


        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-5 rounded-full bg-[linear-gradient(90deg,#d2cbff,#8170ef)] shadow-[0_0_10px_rgba(170,156,255,0.5)]" />

            <span className="text-[11px] font-black text-[#bdb4ff]">
              포커스 모드
            </span>
          </div>

          <p className="text-right text-[10px] font-bold leading-4 text-white/27">
            원형 바의 위치가 실제 집중
            시간대입니다.
          </p>
        </div>
      </div>
    </section>
  );
}


type SelectedDayTimelineProps = {
  selectedDay:
    FocusCalendarDay | null;

  dailyJournal: string;
  journalLoading: boolean;
  journalSaving: boolean;
  journalSaved: boolean;
  journalExists: boolean;

  onChangeDailyJournal: (
    event:
      ChangeEvent<HTMLTextAreaElement>,
    targetDate: Date,
  ) => void;
};

function SelectedDayTimeline({
  selectedDay,
  dailyJournal,
  journalLoading,
  journalSaving,
  journalSaved,
  journalExists,
  onChangeDailyJournal,
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

<section className="mt-6 border-t border-white/[0.08] pt-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <p className="text-sm font-black tracking-[0.1em] text-white/55">
        DAILY JOURNAL
      </p>

      <p className="mt-1 text-xs font-bold leading-5 text-white/32">
        선택한 날짜의 생각과 기록을
        자유롭게 남겨보세요.
      </p>
    </div>

    <div className="flex items-center gap-2">
      {journalLoading ? (
        <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-white/45">
          불러오는 중
        </span>
      ) : journalSaving ? (
        <span className="rounded-full bg-[#7869e8]/14 px-3 py-1.5 text-[11px] font-black text-[#c2bbff]">
          저장 중
        </span>
      ) : journalSaved ? (
        <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-[11px] font-black text-emerald-200/85">
          저장 완료
        </span>
      ) : journalExists ? (
        <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-white/45">
          기록 있음
        </span>
      ) : (
        <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[11px] font-black text-white/30">
          새 일지
        </span>
      )}

      <span className="text-[11px] font-black text-white/30">
        {dailyJournal.length}/1000
      </span>
    </div>
  </div>

  <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-black/15 p-3">
    {journalLoading ? (
      <div className="flex min-h-[170px] items-center justify-center rounded-2xl border border-dashed border-white/[0.08]">
        <p className="text-sm font-black text-white/35">
          하루일지를 불러오고 있어요.
        </p>
      </div>
    ) : (
      <textarea
        value={dailyJournal}
        onChange={(event) =>
          onChangeDailyJournal(
            event,
            selectedDay.date,
          )
        }
        maxLength={1000}
        rows={7}
        placeholder="오늘의 집중, 감정, 생각을 기록해보세요."
        className="min-h-[170px] w-full resize-none rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-4 text-sm font-bold leading-7 text-white/90 outline-none transition placeholder:text-white/22 focus:border-[#9b8cff]/50 focus:bg-white/[0.04] focus:ring-2 focus:ring-[#8d7cff]/10"
      />
    )}

    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1">
      <p className="text-[11px] font-bold leading-5 text-white/27">
        마지막 입력 후 0.7초가 지나면
        자동으로 저장됩니다.
      </p>

      <p className="text-[11px] font-black text-[#aaa0ff]/60">
        {formatCalendarDate(
          selectedDay.date,
        )}
      </p>
    </div>
  </div>
</section>

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

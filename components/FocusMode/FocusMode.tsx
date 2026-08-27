"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  MAX_CUSTOM_HOURS,
  MAX_CUSTOM_SECONDS,
} from "./constants/focus";
import FocusLaunchers from "./FocusLaunchers";
import {
  useProfileImage,
} from "./hooks/useProfileImage";
import {
  useProfileNickname,
} from "./hooks/useProfileNickname";
import {
  useFocusPresence,
} from "./hooks/useFocusPresence";
import ProfileModal from "./Profile/ProfileModal";
import TimerModal from "./Timer/FocusTimerModal";
import type {
  FocusDuration,
  FocusHistory,
  FocusQuickMemo,
  FocusStatistics,
  FocusStreak,
  FocusView,
  HooMemo,
  ProfileTab,
} from "./types/focus";
import {
  playTimerAlarm,
} from "./utils/audio";
import {
  formatDurationLabel,
} from "./utils/format";

import {
  loadFocusHistory,
  saveFocusHistoryRecord,
  syncFocusHistoryWithCloud,
} from "./utils/focusHistory";

import {
  getFocusStatistics,
} from "./utils/focusStatistics";
import {
  getFocusStreak,
} from "./utils/focusStreak";

import {
  createFocusMemoId,
} from "./utils/id";

import {
  createClient,
} from "@/lib/supabase/client";

type FocusModeProps = {
  isLoggedIn: boolean;

  focusAlarmVolume: number;

  showWeather: boolean;
  weatherCode?: number;
  temperatureCelsius?: number;
  apparentTemperatureCelsius?: number;
  weatherIsDay?: boolean;
  isWeatherLoading: boolean;

  loggedInNickname:
    string | null;

  onNicknameUpdated: (
    nickname: string,
  ) => void;

  profileImageUrl:
    string | null;

  onProfileImageUpdated: (
    profileImageUrl: string | null,
  ) => void;

  floatingButtonsDirection:
    | "toSearch"
    | "fromSearch"
    | null;

  showFloatingButtons: boolean;

  floatingButtonsTarget: {
    x: number;
    y: number;
  };

  onFocusRunningChange?: (
    isRunning: boolean,
  ) => void;

  onFocusModeActiveChange?: (
    isActive: boolean,
  ) => void;
};


function formatJournalDate(
  date: Date,
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      date.getDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function FocusMode({
  isLoggedIn,
  focusAlarmVolume,
  showWeather,
  weatherCode,
  temperatureCelsius,
  apparentTemperatureCelsius,
  weatherIsDay,
  isWeatherLoading,
  loggedInNickname,
  onNicknameUpdated,
  profileImageUrl:
    loggedInProfileImageUrl,
  onProfileImageUpdated,
  floatingButtonsDirection,
  showFloatingButtons,
  floatingButtonsTarget,
  onFocusRunningChange,
  onFocusModeActiveChange,
}: FocusModeProps) {



  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [isOpen, setIsOpen] =
    useState(false);

  const [
    isProfileOpen,
    setIsProfileOpen,
  ] = useState(false);

  const [profileTab, setProfileTab] =
    useState<ProfileTab>("overview");

  const [
    profileStatistics,
    setProfileStatistics,
  ] =
    useState<FocusStatistics | null>(
      null,
    );

  const [
    profileStreak,
    setProfileStreak,
  ] =
    useState<FocusStreak | null>(
      null,
    );

  const [
    profileHistory,
    setProfileHistory,
  ] = useState<FocusHistory[]>([]);

 type DailyJournalBookEntry = {
  journalDate: string;
  content: string;
  updatedAt: string;
};

const [
  dailyJournal,
  setDailyJournal,
] = useState("");

const [
  dailyJournalEntries,
  setDailyJournalEntries,
] = useState<
  DailyJournalBookEntry[]
>([]);

const [
  journalBookLoading,
  setJournalBookLoading,
] = useState(false);

const [
  journalLoading,
  setJournalLoading,
] = useState(false);

const [
  journalSaving,
  setJournalSaving,
] = useState(false);

const [
  journalSaved,
  setJournalSaved,
] = useState(false);

const [
  journalExists,
  setJournalExists,
] = useState(false);


const journalSaveTimerRef =
  useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

const pendingJournalSaveRef =
  useRef<{
    targetDate: Date;
    content: string;
  } | null>(null);

const journalLoadRequestIdRef =
  useRef(0);

const activeJournalDateRef =
  useRef<string | null>(null);

  const [view, setView] =
    useState<FocusView>("setup");

  const [
    selectedDuration,
    setSelectedDuration,
  ] =
    useState<FocusDuration>(25);

  const [
    customHours,
    setCustomHours,
  ] = useState(0);

  const [
    customMinutes,
    setCustomMinutes,
  ] = useState(0);

  const [
    customSeconds,
    setCustomSeconds,
  ] = useState(1);

  const [focusGoal, setFocusGoal] =
    useState("");

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] = useState(25 * 60);

  const [
  focusStartedAt,
  setFocusStartedAt,
] =
  useState<string | null>(null);

const [
  focusEndsAt,
  setFocusEndsAt,
] =
  useState<number | null>(null);

const [isRunning, setIsRunning] =
  useState(false);

useEffect(() => {
  onFocusRunningChange?.(
    isRunning,
  );
}, [
  isRunning,
  onFocusRunningChange,
]);

useEffect(() => {
  const shouldOpenFromHooWorld =
    window.sessionStorage.getItem(
      "hoo-world-open-focus",
    ) === "true";

  const isFocusModeActive =
    shouldOpenFromHooWorld ||
    (
      isOpen &&
      view === "setup"
    ) ||
    isRunning;

  onFocusModeActiveChange?.(
    isFocusModeActive,
  );
}, [
  isOpen,
  view,
  isRunning,
  onFocusModeActiveChange,
]);


  const [
    quickMemoInput,
    setQuickMemoInput,
  ] = useState("");

  const [
    focusQuickMemos,
    setFocusQuickMemos,
  ] =
    useState<FocusQuickMemo[]>([]);

  const [
    isExitConfirmOpen,
    setIsExitConfirmOpen,
  ] = useState(false);

  const [
    wasRunningBeforeExitConfirm,
    setWasRunningBeforeExitConfirm,
  ] = useState(false);

const {
  profileImageUrl,
  isProfileImageLoading,
  profileImageError,
  profileImageInputRef,
  loadProfileImage,
  openProfileImagePicker,
  changeProfileImage,
  removeProfileImage,
} = useProfileImage({
  profileImageUrl:
    loggedInProfileImageUrl,

  onProfileImageUpdated,
});

const {
  nickname,
  nicknameDraft,
  isNicknameEditing,
  nicknameError,
  maxNicknameLength,
  startNicknameEditing,
  cancelNicknameEditing,
  changeNicknameDraft,
  saveNickname,
} = useProfileNickname(
  loggedInNickname,
  onNicknameUpdated,
);

  const {
    focusedPeopleCount,
    presenceStatus:
      focusPresenceStatus,
  } = useFocusPresence(
    isOpen && view === "timer",
  );

  const trimmedGoal =
    focusGoal.trim();

  const customTotalSeconds = Math.min(
    MAX_CUSTOM_SECONDS,
    Math.max(
      0,
      customHours * 3600 +
        customMinutes * 60 +
        customSeconds,
    ),
  );

  const initialSeconds =
    selectedDuration === "custom"
      ? customTotalSeconds
      : selectedDuration * 60;

  const canStart =
    trimmedGoal.length > 0 &&
    initialSeconds >= 1 &&
    initialSeconds <=
      MAX_CUSTOM_SECONDS;

  const durationLabel =
    formatDurationLabel(
      initialSeconds,
    );

  const progress = useMemo(() => {
    if (initialSeconds <= 0) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        100,
        ((initialSeconds -
          remainingSeconds) /
          initialSeconds) *
          100,
      ),
    );
  }, [
    initialSeconds,
    remainingSeconds,
  ]);


  const loadDailyJournalEntries =
  useCallback(async () => {
    setJournalBookLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      /*
       * 비로그인 상태:
       * 날짜별 localStorage 일기를 모은다.
       */
      if (!user) {
        const entries:
          DailyJournalBookEntry[] = [];

        for (
          let index = 0;
          index <
          window.localStorage.length;
          index += 1
        ) {
          const key =
            window.localStorage.key(
              index,
            );

          if (
            !key?.startsWith(
              "hoo-daily-journal-",
            )
          ) {
            continue;
          }

          const journalDate =
            key.replace(
              "hoo-daily-journal-",
              "",
            );

          const content =
            window.localStorage.getItem(
              key,
            ) ?? "";

          if (!content.trim()) {
            continue;
          }

          entries.push({
            journalDate,
            content,
            updatedAt:
              new Date(
                `${journalDate}T00:00:00`,
              ).toISOString(),
          });
        }

        entries.sort(
          (a, b) =>
            b.journalDate.localeCompare(
              a.journalDate,
            ),
        );

        setDailyJournalEntries(
          entries,
        );

        return;
      }

      /*
       * 로그인 상태:
       * Supabase에서 일기 전체를 불러온다.
       */
      const {
        data,
        error,
      } =
        await supabase
          .from("daily_journals")
          .select(
            `
              journal_date,
              content,
              updated_at
            `,
          )
          .eq(
            "user_id",
            user.id,
          )
          .order(
            "journal_date",
            {
              ascending: false,
            },
          );

      if (error) {
        throw error;
      }

      const entries:
        DailyJournalBookEntry[] =
          Array.isArray(data)
            ? data.reduce<
                DailyJournalBookEntry[]
              >(
                (
                  result,
                  journal,
                ) => {
                  const journalDate =
                    typeof journal
                      .journal_date ===
                    "string"
                      ? journal
                          .journal_date
                      : "";

                  const content =
                    typeof journal
                      .content ===
                    "string"
                      ? journal.content
                      : "";

                  if (
                    !journalDate ||
                    !content.trim()
                  ) {
                    return result;
                  }

                  result.push({
                    journalDate,
                    content,

                    updatedAt:
                      typeof journal
                        .updated_at ===
                      "string"
                        ? journal
                            .updated_at
                        : new Date()
                            .toISOString(),
                  });

                  return result;
                },
                [],
              )
            : [];

      setDailyJournalEntries(
        entries,
      );
    } catch (error) {
      console.error(
        "한줄일기 목록을 불러오지 못했습니다.",
        error,
      );

      setDailyJournalEntries(
        [],
      );
    } finally {
      setJournalBookLoading(false);
    }
  }, [supabase]);



 const saveDailyJournal =
  useCallback(
    async (
      targetDate: Date,
      content: string,
    ) => {
      const journalDate =
        formatJournalDate(
          targetDate,
        );

      const trimmedContent =
        content.trim();

      const isActiveDate = () =>
        activeJournalDateRef.current ===
        journalDate;

      if (isActiveDate()) {
        setJournalSaving(true);
        setJournalSaved(false);
      }

      try {
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        /*
         * 비로그인 상태에서는
         * 날짜별 localStorage에 저장한다.
         */
        if (!user) {
          const storageKey =
            `hoo-daily-journal-${journalDate}`;

          if (!trimmedContent) {
            window.localStorage.removeItem(
              storageKey,
            );

            if (isActiveDate()) {
              setJournalExists(false);
            }
          } else {
            window.localStorage.setItem(
              storageKey,
              content,
            );

            if (isActiveDate()) {
              setJournalExists(true);
            }
          }

          if (isActiveDate()) {
            setJournalSaved(true);
          }

          await loadDailyJournalEntries();

          return;
        }

        /*
         * 내용이 비어 있으면
         * 해당 날짜의 일지를 삭제한다.
         */
        if (!trimmedContent) {
          const {
            error: deleteError,
          } =
            await supabase
              .from("daily_journals")
              .delete()
              .eq(
                "user_id",
                user.id,
              )
              .eq(
                "journal_date",
                journalDate,
              );

          if (deleteError) {
            throw deleteError;
          }

          if (isActiveDate()) {
            setJournalExists(false);
            setJournalSaved(true);
          }

          await loadDailyJournalEntries();

          return;
        }

        /*
         * 같은 사용자·같은 날짜의 일지는
         * 한 개만 유지한다.
         */
        const {
          error: upsertError,
        } =
          await supabase
            .from("daily_journals")
            .upsert(
              {
                user_id:
                  user.id,

                journal_date:
                  journalDate,

                content,

                updated_at:
                  new Date()
                    .toISOString(),
              },
              {
                onConflict:
                  "user_id,journal_date",
              },
            );

        if (upsertError) {
          throw upsertError;
        }

        if (isActiveDate()) {
          setJournalExists(true);
          setJournalSaved(true);
        }

        await loadDailyJournalEntries();
      } catch (error) {
        console.error(
          "오늘의 일지를 저장하지 못했습니다.",
          error,
        );

        if (isActiveDate()) {
          setJournalSaved(false);
        }
      } finally {
        if (isActiveDate()) {
          setJournalSaving(false);
        }
      }
    },
    [
      supabase,
      loadDailyJournalEntries,
    ],
  );



  const flushPendingDailyJournal =
    useCallback(async () => {
      if (
        journalSaveTimerRef.current
      ) {
        clearTimeout(
          journalSaveTimerRef.current,
        );

        journalSaveTimerRef.current =
          null;
      }

      const pendingSave =
        pendingJournalSaveRef.current;

      if (!pendingSave) {
        return;
      }

      pendingJournalSaveRef.current =
        null;

      await saveDailyJournal(
        pendingSave.targetDate,
        pendingSave.content,
      );
    }, [saveDailyJournal]);

  const loadDailyJournal =
    useCallback(
      async (
        targetDate: Date,
      ) => {
        const requestId =
          journalLoadRequestIdRef.current +
          1;

        journalLoadRequestIdRef.current =
          requestId;

        /*
         * 다른 날짜로 이동하기 전에
         * 아직 예약 중인 기존 날짜의 입력을
         * 먼저 즉시 저장한다.
         */
        await flushPendingDailyJournal();

        /*
         * 저장을 기다리는 사이 더 새로운 날짜
         * 요청이 들어왔다면 이 요청은 중단한다.
         */
        if (
          requestId !==
          journalLoadRequestIdRef.current
        ) {
          return;
        }

        const journalDate =
          formatJournalDate(
            targetDate,
          );

        activeJournalDateRef.current =
          journalDate;

        setJournalLoading(true);
        setJournalSaved(false);

        try {
          const {
            data: { user },
            error: userError,
          } =
            await supabase.auth.getUser();

          if (userError) {
            throw userError;
          }

          if (
            requestId !==
            journalLoadRequestIdRef.current
          ) {
            return;
          }

          /*
           * 비로그인 상태에서는
           * 브라우저 저장소에서 불러온다.
           */
          if (!user) {
            const storageKey =
              `hoo-daily-journal-${journalDate}`;

            const savedJournal =
              window.localStorage.getItem(
                storageKey,
              );

            if (
              requestId !==
              journalLoadRequestIdRef.current
            ) {
              return;
            }

            setDailyJournal(
              savedJournal ?? "",
            );

            setJournalExists(
              Boolean(savedJournal),
            );

            return;
          }

          const {
            data,
            error,
          } =
            await supabase
              .from("daily_journals")
              .select("content")
              .eq(
                "user_id",
                user.id,
              )
              .eq(
                "journal_date",
                journalDate,
              )
              .maybeSingle();

          if (error) {
            throw error;
          }

          if (
            requestId !==
            journalLoadRequestIdRef.current
          ) {
            return;
          }

          const content =
            typeof data?.content ===
            "string"
              ? data.content
              : "";

          setDailyJournal(content);
          setJournalExists(
            content.length > 0,
          );
        } catch (error) {
          if (
            requestId !==
            journalLoadRequestIdRef.current
          ) {
            return;
          }

          console.error(
            "오늘의 일지를 불러오지 못했습니다.",
            error,
          );

          setDailyJournal("");
          setJournalExists(false);
        } finally {
          if (
            requestId ===
            journalLoadRequestIdRef.current
          ) {
            setJournalLoading(false);
          }
        }
      },
      [
        flushPendingDailyJournal,
        supabase,
      ],
    );

  function changeDailyJournal(
    event:
      ChangeEvent<HTMLTextAreaElement>,
    targetDate: Date,
  ) {
    const nextValue =
      event.target.value.slice(
        0,
        1000,
      );

    const pendingSave = {
      targetDate:
        new Date(targetDate),
      content: nextValue,
    };

    setDailyJournal(nextValue);
    setJournalSaved(false);

    pendingJournalSaveRef.current =
      pendingSave;

    if (
      journalSaveTimerRef.current
    ) {
      clearTimeout(
        journalSaveTimerRef.current,
      );
    }

    journalSaveTimerRef.current =
      setTimeout(() => {
        if (
          pendingJournalSaveRef.current !==
          pendingSave
        ) {
          return;
        }

        pendingJournalSaveRef.current =
          null;

        journalSaveTimerRef.current =
          null;

        void saveDailyJournal(
          pendingSave.targetDate,
          pendingSave.content,
        );
      }, 700);
  }

function applyProfileHistory(
  history: FocusHistory[],
) {
  setProfileHistory(history);

  setProfileStatistics(
    getFocusStatistics(history),
  );

  setProfileStreak(
    getFocusStreak(history),
  );
}

function refreshProfileData() {
  applyProfileHistory(
    loadFocusHistory(),
  );
}

async function syncProfileDataWithCloud() {
  const history =
    await syncFocusHistoryWithCloud();

  applyProfileHistory(history);
}

 function openProfile() {
  /*
   * 로컬 기록을 먼저 보여줘서
   * 프로필이 즉시 열린다.
   */
  refreshProfileData();

  setProfileTab("overview");
  setIsProfileOpen(true);

  /*
   * 이후 서버 기록을 불러와
   * 프로필 통계와 그래프를 갱신한다.
   */
  void syncProfileDataWithCloud();
}

function handleProfileLauncherClick() {
  /*
   * 로그인된 사용자는
   * 기존 프로필 창을 연다.
   */
  if (isLoggedIn) {
    openProfile();
    return;
  }

  /*
   * 비로그인 사용자는
   * 커뮤니티 패널의 로그인 창을 연다.
   */
  window.dispatchEvent(
    new CustomEvent(
      "hoo-open-auth-modal",
      {
        detail: {
          mode: "login",
        },
      },
    ),
  );
}

  function closeProfile() {
    setIsProfileOpen(false);
  }

  function openFocusMode() {
    setIsOpen(true);
    setView("setup");
  }

  /*
   * HOO WORLD에서 포커스모드 버튼을 눌러 메인으로 돌아온 경우
   * FocusMode를 즉시 연다.
   *
   * sessionStorage를 사용하므로 일반적인 메인화면 진입에는
   * 영향을 주지 않고, 한 번 처리한 요청은 바로 삭제한다.
   */
  useEffect(() => {
    const shouldOpenFromHooWorld =
      window.sessionStorage.getItem(
        "hoo-world-open-focus",
      ) === "true";

    if (!shouldOpenFromHooWorld) {
      return;
    }

    window.sessionStorage.removeItem(
      "hoo-world-open-focus",
    );

    setIsOpen(true);
    setView("setup");
  }, []);

 function closeFocusMode() {
  setIsOpen(false);
  setIsRunning(false);
  setFocusEndsAt(null);
  setFocusStartedAt(null);
  setIsExitConfirmOpen(false);
}

  function selectCustomDuration() {
    setSelectedDuration("custom");
  }

  function updateCustomHours(
    value: number,
  ) {
    const safeHours = Math.max(
      0,
      Math.min(
        MAX_CUSTOM_HOURS,
        value || 0,
      ),
    );

    setCustomHours(safeHours);
    setSelectedDuration("custom");

    if (
      safeHours ===
      MAX_CUSTOM_HOURS
    ) {
      setCustomMinutes(0);
      setCustomSeconds(0);
    }
  }

  function updateCustomMinutes(
    value: number,
  ) {
    if (
      customHours ===
      MAX_CUSTOM_HOURS
    ) {
      setCustomMinutes(0);
      return;
    }

    setCustomMinutes(
      Math.max(
        0,
        Math.min(59, value || 0),
      ),
    );

    setSelectedDuration("custom");
  }

  function updateCustomSeconds(
    value: number,
  ) {
    if (
      customHours ===
      MAX_CUSTOM_HOURS
    ) {
      setCustomSeconds(0);
      return;
    }

    setCustomSeconds(
      Math.max(
        0,
        Math.min(59, value || 0),
      ),
    );

    setSelectedDuration("custom");
  }

 function startFocusMode() {
  if (!canStart) {
    return;
  }

  const now = Date.now();

  setRemainingSeconds(
    initialSeconds,
  );

  setFocusStartedAt(
    new Date(now).toISOString(),
  );

  setFocusEndsAt(
    now + initialSeconds * 1000,
  );

  setQuickMemoInput("");
  setFocusQuickMemos([]);
  setView("timer");
  setIsRunning(true);
}

  async function saveQuickMemo() {
    const content =
      quickMemoInput.trim();

    if (!content) {
      return;
    }

    const now =
      new Date().toISOString();

    const newQuickMemo:
      FocusQuickMemo = {
        id: createFocusMemoId(),
        content,
        createdAt: now,
      };

    const newHooMemo: HooMemo = {
      id: newQuickMemo.id,
      title:
        `집중 메모 · ${trimmedGoal}`,
      content,
      updatedAt: now,
    };

    /*
     * 화면에 먼저 즉시 반영한다.
     */
    setFocusQuickMemos(
      (previous) => [
        newQuickMemo,
        ...previous,
      ],
    );

    setQuickMemoInput("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      /*
       * 비로그인 상태에서는
       * 기존 브라우저 저장 방식을 유지한다.
       */
      if (!user) {
        const savedValue =
          window.localStorage.getItem(
            "hoo-memos",
          );

        const parsedValue: unknown =
          savedValue
            ? JSON.parse(savedValue)
            : [];

        const previousMemos =
          Array.isArray(parsedValue)
            ? parsedValue
            : [];

        const nextMemos = [
          {
            ...newHooMemo,
            isSecret: false,
          },
          ...previousMemos,
        ];

        window.localStorage.setItem(
          "hoo-memos",
          JSON.stringify(nextMemos),
        );

        window.dispatchEvent(
          new CustomEvent(
            "hoo-memos-updated",
            {
              detail: nextMemos,
            },
          ),
        );

        return;
      }

      const { error: insertError } =
        await supabase
          .from("memos")
          .insert({
            id: newHooMemo.id,
            user_id: user.id,
            title: newHooMemo.title,
            content: newHooMemo.content,
            is_secret: false,
            created_at:
              newHooMemo.updatedAt,
            updated_at:
              newHooMemo.updatedAt,
          });

      if (insertError) {
        throw insertError;
      }

      /*
       * page.tsx에 Supabase 재조회를 요청한다.
       */
      window.dispatchEvent(
        new CustomEvent(
          "hoo-memos-updated",
        ),
      );
    } catch (error) {
      console.error(
        "집중 메모를 저장하지 못했습니다.",
        error,
      );

      /*
       * 서버 저장 실패 시
       * Focus Mode 목록에서 되돌린다.
       */
      setFocusQuickMemos(
        (previous) =>
          previous.filter(
            (memo) =>
              memo.id !==
              newQuickMemo.id,
          ),
      );

      window.alert(
        "집중 메모를 서버에 저장하지 못했습니다.",
      );
    }
  }

  async function deleteQuickMemo(
    memoId: string,
  ) {
    const targetMemo =
      focusQuickMemos.find(
        (memo) =>
          memo.id === memoId,
      );

    if (!targetMemo) {
      return;
    }

    const targetIndex =
      focusQuickMemos.findIndex(
        (memo) =>
          memo.id === memoId,
      );

    /*
     * Focus Mode 화면에서 먼저 삭제한다.
     */
    setFocusQuickMemos(
      (previous) =>
        previous.filter(
          (memo) =>
            memo.id !== memoId,
        ),
    );

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      /*
       * 비로그인 상태에서는
       * localStorage에서 삭제한다.
       */
      if (!user) {
        const savedValue =
          window.localStorage.getItem(
            "hoo-memos",
          );

        const parsedValue: unknown =
          savedValue
            ? JSON.parse(savedValue)
            : [];

        const previousMemos =
          Array.isArray(parsedValue)
            ? parsedValue
            : [];

        const nextMemos =
          previousMemos.filter(
            (memo) => {
              if (
                !memo ||
                typeof memo !== "object"
              ) {
                return false;
              }

              return (
                (memo as { id?: unknown }).id !==
                memoId
              );
            },
          );

        window.localStorage.setItem(
          "hoo-memos",
          JSON.stringify(nextMemos),
        );

        window.dispatchEvent(
          new CustomEvent(
            "hoo-memos-updated",
            {
              detail: nextMemos,
            },
          ),
        );

        return;
      }

      const { error: deleteError } =
        await supabase
          .from("memos")
          .delete()
          .eq("id", memoId)
          .eq("user_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      /*
       * page.tsx에 Supabase 재조회를 요청한다.
       */
      window.dispatchEvent(
        new CustomEvent(
          "hoo-memos-updated",
        ),
      );
    } catch (error) {
      console.error(
        "집중 메모를 삭제하지 못했습니다.",
        error,
      );

      /*
       * 서버 삭제 실패 시
       * 기존 위치에 복원한다.
       */
      setFocusQuickMemos(
        (previous) => {
          const nextMemos = [
            ...previous,
          ];

          nextMemos.splice(
            Math.max(
              0,
              targetIndex,
            ),
            0,
            targetMemo,
          );

          return nextMemos;
        },
      );

      window.alert(
        "집중 메모를 서버에서 삭제하지 못했습니다.",
      );
    }
  }

  function saveFocusHistory(
  actualSeconds: number,
) {
  const safeActualSeconds =
    Math.max(
      0,
      Math.min(
        initialSeconds,
        Math.floor(actualSeconds),
      ),
    );

  if (safeActualSeconds < 1) {
    return false;
  }

  try {
    saveFocusHistoryRecord({
      goal: trimmedGoal,
      plannedSeconds:
        initialSeconds,
      actualSeconds:
        safeActualSeconds,
      startedAt:
        focusStartedAt,
    });

    /*
     * 로그인한 이용자의 집중시간을
     * 후코인 서버 보상 시스템으로 전달한다.
     *
     * 10분(600초)당 후코인 1개.
     *
     * 실제 코인 지급과 중복 방지는
     * 서버 API에서 최종 검증한다.
     */
    if (
      isLoggedIn &&
      focusStartedAt
    ) {
      void fetch(
        "/api/hoo-coins/focus",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            startedAt:
              focusStartedAt,

            actualSeconds:
              safeActualSeconds,
          }),
        },
      )
        .then(async (response) => {
          if (!response.ok) {
            const message =
              await response.text();

            throw new Error(
              message ||
                "후코인 지급 요청 실패",
            );
          }

          return response.json();
        })
        .then((result) => {
          window.dispatchEvent(
            new CustomEvent(
              "hoo-coin-updated",
              {
                detail: result,
              },
            ),
          );
        })
        .catch((error) => {
          /*
           * 후코인 지급 실패가
           * 기존 포커스 기록 저장을
           * 방해하지 않도록 분리한다.
           */
          console.error(
            "포커스 후코인 지급 실패:",
            error,
          );
        });
    }

    return true;
  } catch (error) {
    console.error(
      "집중 기록 저장 실패",
      error,
    );

    return false;
  }
}


 function toggleTimer() {
  if (isRunning) {
    const nextRemainingSeconds =
      focusEndsAt === null
        ? remainingSeconds
        : Math.max(
            0,
            Math.ceil(
              (focusEndsAt - Date.now()) /
                1000,
            ),
          );

    setRemainingSeconds(
      nextRemainingSeconds,
    );

    setFocusEndsAt(null);
    setIsRunning(false);
    return;
  }

  if (remainingSeconds <= 0) {
    return;
  }

  setFocusEndsAt(
    Date.now() +
      remainingSeconds * 1000,
  );

  setIsRunning(true);
}

  function requestFinishFocusMode() {
    const nextRemainingSeconds =
      focusEndsAt === null
        ? remainingSeconds
        : Math.max(
            0,
            Math.ceil(
              (focusEndsAt - Date.now()) /
                1000,
            ),
          );

    setWasRunningBeforeExitConfirm(
      isRunning,
    );

    setRemainingSeconds(
      nextRemainingSeconds,
    );

    setFocusEndsAt(null);
    setIsRunning(false);
    setIsExitConfirmOpen(true);
  }

  function continueFocusMode() {
    setIsExitConfirmOpen(false);

    if (
      wasRunningBeforeExitConfirm &&
      remainingSeconds > 0
    ) {
      setFocusEndsAt(
        Date.now() +
          remainingSeconds * 1000,
      );

      setIsRunning(true);
    }
  }
function confirmFinishFocusMode() {
  const currentRemainingSeconds =
    focusEndsAt === null
      ? remainingSeconds
      : Math.max(
          0,
          Math.ceil(
            (focusEndsAt - Date.now()) /
              1000,
          ),
        );

  const actualSeconds =
    initialSeconds -
    currentRemainingSeconds;

  const didSave =
    saveFocusHistory(
      actualSeconds,
    );

  if (didSave) {
    refreshProfileData();
  }

  setRemainingSeconds(
    currentRemainingSeconds,
  );

  setFocusEndsAt(null);
  setIsExitConfirmOpen(false);
  setIsRunning(false);
  setView("completed");
}
function restartFocusMode() {
  setIsRunning(false);
  setFocusEndsAt(null);
  setFocusStartedAt(null);
  setIsExitConfirmOpen(false);

  setRemainingSeconds(
    initialSeconds,
  );

  setView("setup");
}
useEffect(() => {
  return () => {
    journalLoadRequestIdRef.current +=
      1;

    if (
      journalSaveTimerRef.current
    ) {
      clearTimeout(
        journalSaveTimerRef.current,
      );

      journalSaveTimerRef.current =
        null;
    }

    const pendingSave =
      pendingJournalSaveRef.current;

    pendingJournalSaveRef.current =
      null;

    if (pendingSave) {
      void saveDailyJournal(
        pendingSave.targetDate,
        pendingSave.content,
      );
    }
  };
}, [saveDailyJournal]);

 useEffect(() => {
  let cancelled = false;

  async function initializeFocusHistory() {
    /*
     * 비로그인 상태에서는
     * Supabase를 호출하지 않고
     * 브라우저의 기존 집중 기록을 사용한다.
     */
    if (!isLoggedIn) {
      if (!cancelled) {
        applyProfileHistory(
          loadFocusHistory(),
        );
      }

      return;
    }

    /*
     * 로그인 상태에서는
     * 서버와 집중 기록을 동기화한다.
     */
    try {
      const history =
        await syncFocusHistoryWithCloud();

      if (cancelled) {
        return;
      }

      applyProfileHistory(
        history,
      );
    } catch (error) {
      console.error(
        "집중 기록 클라우드 동기화 실패:",
        error,
      );

      /*
       * 로그인 세션이 만료됐거나
       * 서버 동기화에 실패해도
       * 로컬 기록으로 정상 표시한다.
       */
      if (!cancelled) {
        applyProfileHistory(
          loadFocusHistory(),
        );
      }
    }
  }

  void initializeFocusHistory();

  function handleFocusHistoryUpdated(
    event: Event,
  ) {
    const customEvent =
      event as CustomEvent<
        FocusHistory[]
      >;

    const history =
      Array.isArray(
        customEvent.detail,
      )
        ? customEvent.detail
        : loadFocusHistory();

    applyProfileHistory(
      history,
    );
  }

  window.addEventListener(
    "hoo-focus-history-updated",
    handleFocusHistoryUpdated,
  );

  return () => {
    cancelled = true;

    window.removeEventListener(
      "hoo-focus-history-updated",
      handleFocusHistoryUpdated,
    );
  };
}, [
  isLoggedIn,
]);

 useEffect(() => {
  if (!isProfileOpen) {
    return;
  }

  void loadProfileImage();

  if (
    profileTab === "calendar"
  ) {
    void loadDailyJournalEntries();
  }
}, [
  isProfileOpen,
  profileTab,
  loadProfileImage,
  loadDailyJournalEntries,
]);


  useEffect(() => {
    if (
      !isOpen &&
      !isProfileOpen
    ) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key !== "Escape"
      ) {
        return;
      }

      if (isProfileOpen) {
        closeProfile();
        return;
      }

      if (
        isExitConfirmOpen
      ) {
        continueFocusMode();
        return;
      }

      if (view === "timer") {
        requestFinishFocusMode();
        return;
      }

      closeFocusMode();
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    isOpen,
    isProfileOpen,
    isExitConfirmOpen,
    view,
    wasRunningBeforeExitConfirm,
  ]);
useEffect(() => {
  if (
    !isOpen ||
    view !== "timer" ||
    !isRunning ||
    focusEndsAt === null
  ) {
    return;
  }

  let isCompleted = false;

  function syncFocusTimer() {
    if (
      isCompleted ||
      focusEndsAt === null
    ) {
      return;
    }

    const nextRemainingSeconds =
      Math.max(
        0,
        Math.ceil(
          (focusEndsAt - Date.now()) /
            1000,
        ),
      );

    setRemainingSeconds(
      nextRemainingSeconds,
    );

    if (
      nextRemainingSeconds > 0
    ) {
      return;
    }

    isCompleted = true;

    setIsRunning(false);
    setFocusEndsAt(null);

    playTimerAlarm(
      focusAlarmVolume,
    );

    saveFocusHistory(
      initialSeconds,
    );

    refreshProfileData();
    setView("completed");
  }

  syncFocusTimer();

  const interval =
    window.setInterval(
      syncFocusTimer,
      500,
    );

  function handleVisibilityChange() {
    if (
      document.visibilityState ===
      "visible"
    ) {
      syncFocusTimer();
    }
  }

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange,
  );

  return () => {
    window.clearInterval(
      interval,
    );

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
  };
}, [
  isOpen,
  view,
  isRunning,
  focusEndsAt,
  initialSeconds,
  focusAlarmVolume,
]);


  useEffect(() => {
    if (view === "setup") {
      setRemainingSeconds(
        initialSeconds,
      );
    }
  }, [
    initialSeconds,
    view,
  ]);

  return (
    <>


<FocusLaunchers
  isLoggedIn={isLoggedIn}
  nickname={loggedInNickname}
  showWeather={showWeather}
  weatherCode={weatherCode}
  temperatureCelsius={
    temperatureCelsius
  }
  apparentTemperatureCelsius={
    apparentTemperatureCelsius
  }
  weatherIsDay={weatherIsDay}
  isWeatherLoading={
    isWeatherLoading
  }
  onOpenProfile={
    handleProfileLauncherClick
  }
  onOpenFocus={
    openFocusMode
  }
  floatingButtonsDirection={
    floatingButtonsDirection
  }
  showFloatingButtons={
    showFloatingButtons
  }
  floatingButtonsTarget={
    floatingButtonsTarget
  }
/>


    <ProfileModal
  isOpen={
    isProfileOpen
  }

  activeTab={
    profileTab
  }

  nickname={
    nickname
  }

  nicknameDraft={
    nicknameDraft
  }

  isNicknameEditing={
    isNicknameEditing
  }

  nicknameError={
    nicknameError
  }

  maxNicknameLength={
    maxNicknameLength
  }

  statistics={
    profileStatistics
  }

  streak={
    profileStreak
  }

  history={
    profileHistory
  }

  dailyJournal={
    dailyJournal
  }

  dailyJournalEntries={
    dailyJournalEntries
  }

  journalBookLoading={
    journalBookLoading
  }

  journalLoading={
    journalLoading
  }

  journalSaving={
    journalSaving
  }

  journalSaved={
    journalSaved
  }

  journalExists={
    journalExists
  }

  profileImageUrl={
    profileImageUrl
  }

  isProfileImageLoading={
    isProfileImageLoading
  }

  profileImageError={
    profileImageError
  }

  profileImageInputRef={
    profileImageInputRef
  }

  onClose={
    closeProfile
  }

  onStartNicknameEditing={
    startNicknameEditing
  }

  onCancelNicknameEditing={
    cancelNicknameEditing
  }

  onChangeNickname={
    changeNicknameDraft
  }

  onSaveNickname={
    saveNickname
  }

  onTabChange={
    setProfileTab
  }

  onOpenImagePicker={
    openProfileImagePicker
  }

  onChangeImage={
    changeProfileImage
  }

  onRemoveImage={
    removeProfileImage
  }

  onLoadDailyJournal={
    loadDailyJournal
  }

  onChangeDailyJournal={
    changeDailyJournal
  }
/>


      <TimerModal
        isOpen={isOpen}
        view={view}
        selectedDuration={
          selectedDuration
        }
        customHours={
          customHours
        }
        customMinutes={
          customMinutes
        }
        customSeconds={
          customSeconds
        }
        customTotalSeconds={
          customTotalSeconds
        }
        focusGoal={focusGoal}
        trimmedGoal={
          trimmedGoal
        }
        canStart={canStart}
        remainingSeconds={
          remainingSeconds
        }
        progress={progress}
        durationLabel={
          durationLabel
        }
        isRunning={isRunning}
        quickMemoInput={
          quickMemoInput
        }
        focusQuickMemos={
          focusQuickMemos
        }
        isExitConfirmOpen={
          isExitConfirmOpen
        }
        focusedPeopleCount={
          focusedPeopleCount
        }
        focusPresenceStatus={
          focusPresenceStatus
        }
        onClose={closeFocusMode}
        onStart={startFocusMode}
        onSelectDuration={
          setSelectedDuration
        }
        onSelectCustomDuration={
          selectCustomDuration
        }
        onUpdateCustomHours={
          updateCustomHours
        }
        onUpdateCustomMinutes={
          updateCustomMinutes
        }
        onUpdateCustomSeconds={
          updateCustomSeconds
        }
        setFocusGoal={
          setFocusGoal
        }
        setQuickMemoInput={
          setQuickMemoInput
        }
        onToggleTimer={
          toggleTimer
        }
        onRequestFinish={
          requestFinishFocusMode
        }
        onContinue={
          continueFocusMode
        }
        onConfirmFinish={
          confirmFinishFocusMode
        }
        onRestart={
          restartFocusMode
        }
        onSaveQuickMemo={
          saveQuickMemo
        }
        onDeleteQuickMemo={
          deleteQuickMemo
        }
      />
    </>
  );
}

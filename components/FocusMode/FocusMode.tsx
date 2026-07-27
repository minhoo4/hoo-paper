"use client";

import {
  useEffect,
  useMemo,
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
  deleteHooMemo,
  saveHooMemo,
} from "./utils/memoStorage";

type FocusModeProps = {
  floatingButtonsDirection:
    | "toSearch"
    | "fromSearch"
    | null;

  showFloatingButtons: boolean;

  floatingButtonsTarget: {
    x: number;
    y: number;
  };
};

export default function FocusMode({
  floatingButtonsDirection,
  showFloatingButtons,
  floatingButtonsTarget,
}: FocusModeProps) {

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
  } = useProfileImage();

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
  } = useProfileNickname();

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

  function refreshProfileData() {
    const history =
      loadFocusHistory();

    setProfileHistory(history);

    setProfileStatistics(
      getFocusStatistics(history),
    );

    setProfileStreak(
      getFocusStreak(history),
    );
  }

  function openProfile() {
    refreshProfileData();
    setProfileTab("overview");
    setIsProfileOpen(true);
  }

  function closeProfile() {
    setIsProfileOpen(false);
  }

  function openFocusMode() {
    setIsOpen(true);
    setView("setup");
  }

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

  function saveQuickMemo() {
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

    setFocusQuickMemos(
      (previous) => [
        newQuickMemo,
        ...previous,
      ],
    );

    setQuickMemoInput("");

    try {
      saveHooMemo(newHooMemo);
    } catch (error) {
      console.error(
        "집중 메모를 저장하지 못했습니다.",
        error,
      );
    }
  }

  function deleteQuickMemo(
    memoId: string,
  ) {
    setFocusQuickMemos(
      (previous) =>
        previous.filter(
          (memo) =>
            memo.id !== memoId,
        ),
    );

    try {
      deleteHooMemo(memoId);
    } catch (error) {
      console.error(
        "집중 메모를 삭제하지 못했습니다.",
        error,
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
    if (isProfileOpen) {
      void loadProfileImage();
    }
  }, [
    isProfileOpen,
    loadProfileImage,
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

    if (nextRemainingSeconds > 0) {
      return;
    }

    isCompleted = true;

    setIsRunning(false);
    setFocusEndsAt(null);

    playTimerAlarm();

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

  window.addEventListener(
    "focus",
    syncFocusTimer,
  );

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange,
  );

  return () => {
    window.clearInterval(interval);

    window.removeEventListener(
      "focus",
      syncFocusTimer,
    );

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
  };
}, [
  isOpen,
  isRunning,
  view,
  focusEndsAt,
  initialSeconds,
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
  profileImageUrl={
    profileImageUrl
  }
  onOpenProfile={
    openProfile
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
        isOpen={isProfileOpen}
        activeTab={profileTab}
        nickname={nickname}
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
        streak={profileStreak}
        history={profileHistory}
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
        onClose={closeProfile}
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
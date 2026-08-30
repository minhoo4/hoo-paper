"use client";

import type {
  Dispatch,
  SetStateAction,
} from "react";
import type {
  FocusDuration,
  FocusQuickMemo,
  FocusView,
} from "../types/focus";
import {
  getFocusBackdropClass,
} from "../utils/format";
import FocusCompleted from "./FocusCompleted";
import FocusSession from "./FocusSession";
import FocusSetup from "./FocusSetup";

type FocusTimerModalProps = {
  isOpen: boolean;
  view: FocusView;
  selectedDuration: FocusDuration;
  customHours: number;
  customMinutes: number;
  customSeconds: number;
  customTotalSeconds: number;
  focusGoal: string;
  trimmedGoal: string;
  canStart: boolean;
  remainingSeconds: number;
  progress: number;
  durationLabel: string;
  isRunning: boolean;
  quickMemoInput: string;
  focusQuickMemos: FocusQuickMemo[];
  isExitConfirmOpen: boolean;
  focusedPeopleCount: number;
  focusPresenceStatus:
    | "idle"
    | "connecting"
    | "connected"
    | "unavailable"
    | "error";
  onClose: () => void;
  onStart: () => void;
  onSelectDuration:
    (duration: FocusDuration) => void;
  onSelectCustomDuration: () => void;
  onUpdateCustomHours:
    (value: number) => void;
  onUpdateCustomMinutes:
    (value: number) => void;
  onUpdateCustomSeconds:
    (value: number) => void;
  setFocusGoal:
    Dispatch<SetStateAction<string>>;
  setQuickMemoInput:
    Dispatch<SetStateAction<string>>;
  onToggleTimer: () => void;
  onOpenStudyNote: () => void;
  onRequestFinish: () => void;
  onContinue: () => void;
  onConfirmFinish: () => void;
  onRestart: () => void;
  onSaveQuickMemo: () => void;
  onDeleteQuickMemo:
    (memoId: string) => void;
};

export default function FocusTimerModal({
  isOpen,
  view,
  selectedDuration,
  customHours,
  customMinutes,
  customSeconds,
  customTotalSeconds,
  focusGoal,
  trimmedGoal,
  canStart,
  remainingSeconds,
  progress,
  durationLabel,
  isRunning,
  quickMemoInput,
  focusQuickMemos,
  isExitConfirmOpen,
  focusedPeopleCount,
  focusPresenceStatus,
  onClose,
  onStart,
  onSelectDuration,
  onSelectCustomDuration,
  onUpdateCustomHours,
  onUpdateCustomMinutes,
  onUpdateCustomSeconds,
  setFocusGoal,
  setQuickMemoInput,
  onToggleTimer,
  onOpenStudyNote,
  onRequestFinish,
  onContinue,
  onConfirmFinish,
  onRestart,
  onSaveQuickMemo,
  onDeleteQuickMemo,
}: FocusTimerModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={
        getFocusBackdropClass(view)
      }
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-mode-title"
      onMouseDown={(event) => {
        if (
          view === "setup" &&
          event.target ===
            event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <FocusSetup
        view={view}
        selectedDuration={
          selectedDuration
        }
        customHours={customHours}
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
        canStart={canStart}
        onClose={onClose}
        onStart={onStart}
        onSelectDuration={
          onSelectDuration
        }
        onSelectCustomDuration={
          onSelectCustomDuration
        }
        onUpdateCustomHours={
          onUpdateCustomHours
        }
        onUpdateCustomMinutes={
          onUpdateCustomMinutes
        }
        onUpdateCustomSeconds={
          onUpdateCustomSeconds
        }
        setFocusGoal={
          setFocusGoal
        }
      />

      <FocusSession
        view={view}
        trimmedGoal={
          trimmedGoal
        }
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
        setQuickMemoInput={
          setQuickMemoInput
        }
        onToggleTimer={
          onToggleTimer
        }
        onOpenStudyNote={
          onOpenStudyNote
        }
        onRequestFinish={
          onRequestFinish
        }
        onContinue={onContinue}
        onConfirmFinish={
          onConfirmFinish
        }
        onSaveQuickMemo={
          onSaveQuickMemo
        }
        onDeleteQuickMemo={
          onDeleteQuickMemo
        }
      />

      <FocusCompleted
        view={view}
        trimmedGoal={
          trimmedGoal
        }
        onClose={onClose}
        onRestart={onRestart}
      />
    </div>
  );
}

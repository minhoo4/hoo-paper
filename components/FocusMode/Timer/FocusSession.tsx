"use client";

import type {
  Dispatch,
  SetStateAction,
} from "react";
import {
  MAX_CUSTOM_HOURS,
} from "../constants/focus";
import type {
  FocusDuration,
  FocusQuickMemo,
  FocusView,
} from "../types/focus";
import {
  formatDurationLabel,
  formatFocusTime,
} from "../utils/format";
import FocusPresenceBadge from "./FocusPresenceBadge";


type FocusSessionProps = {
  view: FocusView;
  trimmedGoal: string;
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
  setQuickMemoInput:
    Dispatch<SetStateAction<string>>;
  onToggleTimer: () => void;
  onRequestFinish: () => void;
  onContinue: () => void;
  onConfirmFinish: () => void;
  onSaveQuickMemo: () => void;
  onDeleteQuickMemo:
    (memoId: string) => void;
};

export default function FocusSession({
  view,
  trimmedGoal,
  remainingSeconds,
  progress,
  durationLabel,
  isRunning,
  quickMemoInput,
  focusQuickMemos,
  isExitConfirmOpen,
  focusedPeopleCount,
  focusPresenceStatus,
  setQuickMemoInput,
  onToggleTimer,
  onRequestFinish,
  onContinue,
  onConfirmFinish,
  onSaveQuickMemo,
  onDeleteQuickMemo,
}: FocusSessionProps) {
  const toggleTimer = onToggleTimer;
  const requestFinishFocusMode =
    onRequestFinish;
  const continueFocusMode = onContinue;
  const confirmFinishFocusMode =
    onConfirmFinish;
  const saveQuickMemo =
    onSaveQuickMemo;
  const deleteQuickMemo =
    onDeleteQuickMemo;

  return (
    <>
{view === "timer" && (
            <section className="relative my-auto w-full max-w-[1180px] overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(3,5,11,0.995),rgba(0,0,0,0.99))] px-5 py-7 text-white shadow-[0_40px_140px_rgba(0,0,0,0.9)] md:px-8 md:py-9">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5f50d8]/10 blur-[110px]"
              />

              <div className="relative z-10 grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="text-center">
                  <p className="text-xs font-black tracking-[0.25em] text-[#9485ff]">
                    FOCUS SESSION
                  </p>

                <h2 className="mx-auto mt-5 max-w-[620px] break-words text-2xl font-black leading-tight md:text-4xl">
                  {trimmedGoal}
                </h2>

                <div className="mx-auto mt-10 flex aspect-square w-full max-w-[390px] items-center justify-center rounded-full border border-[#6f5ee8]/55 bg-black shadow-[0_0_36px_rgba(92,74,231,0.38),inset_0_0_80px_rgba(35,28,92,0.16)]">
                  <div>
                    <p className="text-6xl font-black tracking-[-0.05em] md:text-8xl">
                      {formatFocusTime(
                        remainingSeconds,
                      )}
                    </p>

                    <p className="mt-4 text-sm font-black tracking-[0.16em] text-white/45">
                      {isRunning
                        ? "집중 중"
                        : "잠시 멈춤"}
                    </p>
                  </div>
                </div>

                <div className="mx-auto mt-9 max-w-[520px]">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#7f6df1,#4f6ce0)] transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>

                  <div className="mt-3 flex justify-between text-xs font-black text-white/35">
                    <span>0분</span>
                    <span>{durationLabel}</span>
                  </div>
                </div>

                <div className="mx-auto mt-10 grid max-w-[560px] gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={toggleTimer}
                    className="min-h-14 rounded-2xl bg-[linear-gradient(135deg,#6656d9,#4b54c9)] px-6 text-base font-black text-white shadow-[0_16px_40px_rgba(66,57,173,0.3)] transition hover:-translate-y-0.5 hover:brightness-110"
                  >
                    {isRunning
                      ? "일시정지"
                      : "다시 시작"}
                  </button>

                  <button
                    type="button"
                    onClick={requestFinishFocusMode}
                    className="min-h-14 rounded-2xl border border-white/15 bg-white/[0.025] px-6 text-base font-black text-white/65 transition hover:border-rose-300/35 hover:bg-rose-400/10 hover:text-white"
                  >
                    집중 종료
                  </button>
                </div>

                <FocusPresenceBadge
                  count={
                    focusedPeopleCount
                  }
                  status={
                    focusPresenceStatus
                  }
                />

                </div>

                <aside className="flex min-h-[620px] flex-col rounded-[28px] border border-white/10 bg-white/[0.025] p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <div>
                    <p className="text-xs font-black tracking-[0.2em] text-[#9485ff]">
                      QUICK MEMO
                    </p>

                    <h3 className="mt-2 text-xl font-black text-white">
                      집중 메모
                    </h3>

                    <p className="mt-2 text-xs font-bold leading-6 text-white/35">
                      떠오른 내용을 적어두면 HOO 메모장에
                      자동으로 저장돼요.
                    </p>
                  </div>

                  <div className="mt-5 flex-1 space-y-3 overflow-y-auto pr-1">
                    {focusQuickMemos.length === 0 ? (
                      <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm font-bold leading-7 text-white/25">
                        집중을 방해하는 생각은
                        <br />
                        잠시 여기에 내려놓으세요.
                      </div>
                    ) : (
                      focusQuickMemos
                        .slice(0, 5)
                        .map((memo, index) => (
                          <article
                            key={memo.id}
                            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] px-4 pb-4 pt-5 shadow-[0_12px_30px_rgba(0,0,0,0.22)]"
                            style={{
                              transform: `rotate(${
                                index % 2 === 0
                                  ? -0.35
                                  : 0.35
                              }deg)`,
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className="absolute right-0 top-0 h-5 w-5 border-b border-l border-white/10 bg-black/35"
                              style={{
                                clipPath:
                                  "polygon(100% 0, 0 0, 100% 100%)",
                              }}
                            />

                            <button
                              type="button"
                              onClick={() =>
                                deleteQuickMemo(memo.id)
                              }
                              className="absolute right-3 top-3 rounded-full px-2 py-1 text-xs font-black text-white/0 transition group-hover:text-white/35 hover:!text-rose-200"
                              aria-label="집중 메모 삭제"
                            >
                              ×
                            </button>

                            <p className="whitespace-pre-wrap break-words pr-5 text-sm font-bold leading-6 text-white/75">
                              {memo.content}
                            </p>

                            <p className="mt-3 text-[10px] font-black text-white/25">
                              {new Date(
                                memo.createdAt,
                              ).toLocaleTimeString(
                                "ko-KR",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </p>
                          </article>
                        ))
                    )}
                  </div>

                  <div className="mt-5">
                    <div className="flex items-end gap-2 rounded-2xl border border-white/12 bg-black/35 p-2 transition focus-within:border-[#7565e8]/60">
                      <textarea
                        value={quickMemoInput}
                        maxLength={300}
                        rows={2}
                        onChange={(event) =>
                          setQuickMemoInput(
                            event.target.value,
                          )
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            !event.shiftKey
                          ) {
                            event.preventDefault();
                            saveQuickMemo();
                          }
                        }}
                        placeholder="빠르게 메모하기..."
                        className="min-h-[52px] min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-sm font-bold leading-6 text-white outline-none placeholder:text-white/20"
                      />

                      <button
                        type="button"
                        onClick={saveQuickMemo}
                        disabled={
                          quickMemoInput.trim().length === 0
                        }
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6355db] text-lg font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/20"
                        aria-label="집중 메모 저장"
                      >
                        ↑
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] font-black text-white/20">
                      <span>Enter 저장 · Shift+Enter 줄바꿈</span>
                      <span>
                        {Math.min(
                          focusQuickMemos.length,
                          5,
                        )}
                        /5
                      </span>
                    </div>
                  </div>
                </aside>
              </div>

              {isExitConfirmOpen && (
                <div
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-5 backdrop-blur-md"
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="focus-exit-title"
                  aria-describedby="focus-exit-description"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) {
                      continueFocusMode();
                    }
                  }}
                >
                  <div className="w-full max-w-[460px] rounded-[28px] border border-white/15 bg-[linear-gradient(145deg,rgba(13,17,29,0.99),rgba(3,5,11,0.99))] p-7 text-center shadow-[0_30px_100px_rgba(0,0,0,0.85)] md:p-9">
                    <span
                      aria-hidden="true"
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-200/20 bg-amber-300/10 text-2xl text-amber-100"
                    >
                      ‖
                    </span>

                    <h3
                      id="focus-exit-title"
                      className="mt-6 text-2xl font-black text-white md:text-3xl"
                    >
                      집중을 종료하시겠어요?
                    </h3>

                    <p
                      id="focus-exit-description"
                      className="mx-auto mt-4 max-w-[360px] text-sm font-bold leading-7 text-white/50"
                    >
                      지금 종료하면 이번 집중 세션은
                      완료되지 않은 상태로 끝나요.
                    </p>

                    <div className="mt-8 grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={continueFocusMode}
                        className="min-h-14 rounded-2xl bg-[linear-gradient(135deg,#6656d9,#4b54c9)] px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(66,57,173,0.28)] transition hover:-translate-y-0.5 hover:brightness-110"
                      >
                        계속 집중
                      </button>

                      <button
                        type="button"
                        onClick={confirmFinishFocusMode}
                        className="min-h-14 rounded-2xl border border-rose-300/20 bg-rose-400/[0.06] px-5 text-sm font-black text-rose-100/80 transition hover:border-rose-300/40 hover:bg-rose-400/10 hover:text-white"
                      >
                        종료하기
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
    </>
  );
}

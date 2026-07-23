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


type FocusSetupProps = {
  view: FocusView;
  selectedDuration: FocusDuration;
  customHours: number;
  customMinutes: number;
  customSeconds: number;
  customTotalSeconds: number;
  focusGoal: string;
  canStart: boolean;
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
};

export default function FocusSetup({
  view,
  selectedDuration,
  customHours,
  customMinutes,
  customSeconds,
  customTotalSeconds,
  focusGoal,
  canStart,
  onClose,
  onStart,
  onSelectDuration,
  onSelectCustomDuration,
  onUpdateCustomHours,
  onUpdateCustomMinutes,
  onUpdateCustomSeconds,
  setFocusGoal,
}: FocusSetupProps) {
  const closeFocusMode = onClose;
  const startFocusMode = onStart;
  const setSelectedDuration =
    onSelectDuration;
  const selectCustomDuration =
    onSelectCustomDuration;
  const updateCustomHours =
    onUpdateCustomHours;
  const updateCustomMinutes =
    onUpdateCustomMinutes;
  const updateCustomSeconds =
    onUpdateCustomSeconds;

  return (
    <>
{view === "setup" && (
            <section className="relative my-auto h-fit min-h-0 w-full max-w-[920px] max-h-[calc(100vh-32px)] overflow-y-auto overflow-x-hidden rounded-[30px] border border-white/15 bg-[linear-gradient(145deg,rgba(13,19,32,0.97),rgba(8,12,22,0.96))] px-5 py-4 text-white shadow-[0_35px_110px_rgba(0,0,0,0.65)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:px-8 md:py-5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-32 -top-28 h-72 w-72 rounded-full bg-[#6355d9]/15 blur-[90px]"
              />

              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-36 -right-32 h-80 w-80 rounded-full bg-[#314f9c]/15 blur-[100px]"
              />

              <button
                type="button"
                onClick={closeFocusMode}
                className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/0 text-3xl font-light text-white/65 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
                aria-label="집중 모드 닫기"
              >
                ×
              </button>

              <div className="relative z-10">
                <header className="pr-12">
                  <p className="flex items-center gap-2 text-[11px] font-black tracking-[0.22em] text-[#9485ff]">
                    <span aria-hidden="true">✦</span>
                    HOO FOCUS MODE
                  </p>

                  <h2
                    id="focus-mode-title"
                    className="mt-3 text-3xl font-black tracking-[-0.04em] text-white md:text-[42px]"
                  >
                    어떤 방식으로 집중할까요?
                  </h2>
                </header>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDuration(25)
                    }
                    className={`group relative min-h-[205px] overflow-hidden rounded-[24px] border p-5 text-left transition duration-300 ${
                      selectedDuration === 25
                        ? "border-[#8d7cff] shadow-[0_18px_55px_rgba(73,57,160,0.2)]"
                        : "border-white/15 hover:-translate-y-1 hover:border-white/30"
                    }`}
                    style={{
                      backgroundImage:
                        'linear-gradient(180deg, rgba(24,22,55,0.35), rgba(8,12,22,0.94)), url("/focus-basic.jpg")',
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                    aria-pressed={
                      selectedDuration === 25
                    }
                  >
                    <span
                      className={`absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black transition ${
                        selectedDuration === 25
                          ? "border-white bg-[#aaa0ff] text-[#30286d]"
                          : "border-white/25 text-transparent"
                      }`}
                    >
                      ✓
                    </span>

                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <span
                        aria-hidden="true"
                        className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl ${
                          selectedDuration === 25
                            ? "bg-[#8d7cff]/20 text-[#9c8fff]"
                            : "bg-white/[0.07] text-white/45"
                        }`}
                      >
                        ♧
                      </span>

                      <p className="mt-3 text-4xl font-black">
                        25
                        <span className="ml-1 text-xl">
                          분
                        </span>
                      </p>

                      <p
                        className={`mt-2 text-lg font-black ${
                          selectedDuration === 25
                            ? "text-[#9688ff]"
                            : "text-white"
                        }`}
                      >
                        기본 집중
                      </p>

                      <p className="mt-3 max-w-[230px] text-xs font-bold leading-6 text-white/55">
                        25분 동안 한 가지 일에
                        <br />
                        차분하게 집중해요.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDuration(60)
                    }
                    className={`group relative min-h-[205px] overflow-hidden rounded-[24px] border p-5 text-left transition duration-300 ${
                      selectedDuration === 60
                        ? "border-[#8d7cff] shadow-[0_18px_55px_rgba(73,57,160,0.2)]"
                        : "border-white/15 hover:-translate-y-1 hover:border-white/30"
                    }`}
                    style={{
                      backgroundImage:
                        'linear-gradient(180deg, rgba(14,18,35,0.35), rgba(8,12,22,0.94)), url("/focus-deep.jpg")',
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                    aria-pressed={
                      selectedDuration === 60
                    }
                  >
                    <span
                      className={`absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black transition ${
                        selectedDuration === 60
                          ? "border-white bg-[#aaa0ff] text-[#30286d]"
                          : "border-white/25 text-transparent"
                      }`}
                    >
                      ✓
                    </span>

                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <span
                        aria-hidden="true"
                        className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${
                          selectedDuration === 60
                            ? "bg-[#8d7cff]/20 text-[#9c8fff]"
                            : "bg-white/[0.07] text-white/45"
                        }`}
                      >
                        △
                      </span>

                      <p className="mt-3 text-4xl font-black">
                        60
                        <span className="ml-1 text-xl">
                          분
                        </span>
                      </p>

                      <p
                        className={`mt-2 text-lg font-black ${
                          selectedDuration === 60
                            ? "text-[#9688ff]"
                            : "text-white"
                        }`}
                      >
                        깊은 집중
                      </p>

                      <p className="mt-3 max-w-[230px] text-xs font-bold leading-6 text-white/55">
                        1시간 동안 흐름을 끊지 않고
                        <br />
                        깊게 몰입해요.
                      </p>
                    </div>
                  </button>
                </div>

                <section
                  className={`mt-4 rounded-[22px] border p-4 transition duration-300 ${
                    selectedDuration === "custom"
                      ? "border-[#8d7cff]/80 bg-[#7467d8]/[0.08] shadow-[0_14px_36px_rgba(73,57,160,0.14)]"
                      : "border-white/12 bg-white/[0.025] hover:border-white/25"
                  }`}
                  onClick={selectCustomDuration}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black tracking-[0.18em] text-[#9485ff]">
                        CUSTOM TIMER
                      </p>

                      <h3 className="mt-1 text-lg font-black text-white">
                        직접 시간 설정
                      </h3>

                      <p className="mt-0.5 text-[11px] font-bold text-white/35">
                        1초부터 9999시간까지 자유롭게 설정해요.
                      </p>
                    </div>

                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black transition ${
                        selectedDuration === "custom"
                          ? "border-white bg-[#aaa0ff] text-[#30286d]"
                          : "border-white/20 text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <label className="text-center">
                      <span className="text-xs font-black text-white/40">
                        시간
                      </span>

                      <input
                        type="number"
                        min={0}
                        max={MAX_CUSTOM_HOURS}
                        value={customHours}
                        onFocus={selectCustomDuration}
                        onChange={(event) =>
                          updateCustomHours(
                            Number(event.target.value),
                          )
                        }
                        className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2.5 text-center text-base font-black text-white outline-none transition focus:border-[#8d7cff]"
                      />
                    </label>

                    <label className="text-center">
                      <span className="text-xs font-black text-white/40">
                        분
                      </span>

                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={customMinutes}
                        disabled={
                          customHours === MAX_CUSTOM_HOURS
                        }
                        onFocus={selectCustomDuration}
                        onChange={(event) =>
                          updateCustomMinutes(
                            Number(event.target.value),
                          )
                        }
                        className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2.5 text-center text-base font-black text-white outline-none transition focus:border-[#8d7cff] disabled:cursor-not-allowed disabled:opacity-35"
                      />
                    </label>

                    <label className="text-center">
                      <span className="text-xs font-black text-white/40">
                        초
                      </span>

                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={customSeconds}
                        disabled={
                          customHours === MAX_CUSTOM_HOURS
                        }
                        onFocus={selectCustomDuration}
                        onChange={(event) =>
                          updateCustomSeconds(
                            Number(event.target.value),
                          )
                        }
                        className="mt-1.5 w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2.5 text-center text-base font-black text-white outline-none transition focus:border-[#8d7cff] disabled:cursor-not-allowed disabled:opacity-35"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 py-1">
                    <span className="text-xs font-black text-white/35">
                      설정 시간
                    </span>

                    <strong
                      className={`text-sm font-black ${
                        customTotalSeconds >= 1
                          ? "text-white/85"
                          : "text-rose-200"
                      }`}
                    >
                      {customTotalSeconds >= 1
                        ? formatDurationLabel(
                            customTotalSeconds,
                          )
                        : "최소 1초를 설정해 주세요"}
                    </strong>
                  </div>
                </section>

                <div className="mt-5">
                  <label
                    htmlFor="focus-goal"
                    className="text-lg font-black text-white"
                  >
                    이번 집중 시간엔 무엇을 끝낼까요?
                  </label>

                  <div className="mt-3 flex min-h-14 items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.035] px-4 transition focus-within:border-[#8d7cff] focus-within:bg-white/[0.055]">
                    <span
                      aria-hidden="true"
                      className="text-2xl text-white/45"
                    >
                      ✎
                    </span>

                    <input
                      id="focus-goal"
                      type="text"
                      value={focusGoal}
                      maxLength={80}
                      onChange={(event) =>
                        setFocusGoal(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          canStart
                        ) {
                          startFocusMode();
                        }
                      }}
                      placeholder="한 가지 목표를 적어주세요."
                      className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold text-white outline-none placeholder:text-white/30 md:text-base"
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[0.78fr_1.22fr]">
                  <button
                    type="button"
                    onClick={closeFocusMode}
                    className="min-h-14 rounded-2xl border border-white/15 bg-white/[0.025] px-6 text-base font-black text-white/65 transition hover:border-white/30 hover:bg-white/[0.06] hover:text-white"
                  >
                    돌아가기
                  </button>

                  <button
                    type="button"
                    onClick={startFocusMode}
                    disabled={!canStart}
                    className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#6656d9,#4b54c9)] px-6 text-base font-black text-white shadow-[0_16px_40px_rgba(66,57,173,0.3)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/25 disabled:text-black/65 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:brightness-100"
                  >
                    <span aria-hidden="true">▶</span>
                    집중 시작하기
                  </button>
                </div>
              </div>
            </section>
          )}
    </>
  );
}

"use client";

import type {
  FocusView,
} from "../types/focus";

type FocusCompletedProps = {
  view: FocusView;
  trimmedGoal: string;
  onClose: () => void;
  onRestart: () => void;
};

export default function FocusCompleted({
  view,
  trimmedGoal,
  onClose,
  onRestart,
}: FocusCompletedProps) {
  if (view !== "completed") {
    return null;
  }

  return (
    <section className="relative my-auto w-full max-w-[640px] overflow-hidden rounded-[36px] border border-white/15 bg-[linear-gradient(145deg,rgba(12,18,31,0.98),rgba(6,10,18,0.97))] px-6 py-10 text-center text-white shadow-[0_35px_110px_rgba(0,0,0,0.68)] md:px-12 md:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5f50d8]/14 blur-[100px]"
      />

      <div className="relative z-10">
        <span
          aria-hidden="true"
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#9d90ff]/35 bg-[#7767e8]/15 text-4xl text-[#ad9fff]"
        >
          ✓
        </span>

        <p className="mt-7 text-xs font-black tracking-[0.24em] text-[#9485ff]">
          SESSION COMPLETE
        </p>

        <h2 className="mt-4 text-3xl font-black md:text-5xl">
          집중을 마쳤어요
        </h2>

        <p className="mx-auto mt-8 max-w-[500px] break-words text-2xl font-black leading-relaxed text-white/90 md:text-3xl">
          {trimmedGoal}
        </p>

        <div className="mt-10 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-14 rounded-2xl border border-white/15 bg-white/[0.025] px-6 text-base font-black text-white/65 transition hover:border-white/30 hover:bg-white/[0.06] hover:text-white"
          >
            홈으로 돌아가기
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="min-h-14 rounded-2xl bg-[linear-gradient(135deg,#6656d9,#4b54c9)] px-6 text-base font-black text-white shadow-[0_16px_40px_rgba(66,57,173,0.3)] transition hover:-translate-y-0.5 hover:brightness-110"
          >
            다시 집중하기
          </button>
        </div>
      </div>
    </section>
  );
}

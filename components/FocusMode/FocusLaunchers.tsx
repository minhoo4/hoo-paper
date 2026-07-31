"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
} from "react";

type FocusLaunchersProps = {
  isLoggedIn: boolean;
  nickname: string | null;

  onOpenProfile: () => void;
  onOpenFocus: () => void;

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

export default function FocusLaunchers({
  isLoggedIn,
  nickname,
  onOpenProfile,
  onOpenFocus,
  floatingButtonsDirection,
  showFloatingButtons,
  floatingButtonsTarget,
}: FocusLaunchersProps) {
  const [isClient, setIsClient] =
    useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const launcherTargetX = isClient
    ? floatingButtonsTarget.x -
      (window.innerWidth - 28)
    : 0;

  const launcherTargetY = isClient
    ? floatingButtonsTarget.y -
      (window.innerHeight - 28)
    : 0;

  const profileButtonLabel =
    isLoggedIn && nickname
      ? nickname
      : "LOGIN";

  return (
    <div
      className={`fixed bottom-7 right-7 z-[9990] flex flex-col items-end gap-3 transition-[transform,opacity,filter] duration-[900ms] ease-in-out ${
        floatingButtonsDirection ===
        "fromSearch"
          ? "animate-[hoo-floating-buttons-return_900ms_ease-in-out]"
          : ""
      } ${
        showFloatingButtons
          ? "visible pointer-events-auto"
          : "invisible pointer-events-none"
      }`}
      style={
        {
          "--hoo-floating-target-x": `${launcherTargetX}px`,
          "--hoo-floating-target-y": `${launcherTargetY}px`,

          transform:
            floatingButtonsDirection ===
            "toSearch"
              ? `translate(${launcherTargetX}px, ${launcherTargetY}px) scale(0.2)`
              : "translate(0px, 0px) scale(1)",

          opacity:
            floatingButtonsDirection ===
            "toSearch"
              ? 0.05
              : 1,

          filter:
            floatingButtonsDirection ===
            "toSearch"
              ? "blur(8px)"
              : "blur(0px)",

          transformOrigin:
            "bottom right",
        } as CSSProperties
      }
    >
     <button
  type="button"
  onClick={onOpenProfile}
  className="flex h-14 w-[196px] shrink-0 items-center justify-center gap-3 rounded-full border border-white/30 bg-[#090d16]/95 px-5 text-sm font-black tracking-[0.18em] text-white shadow-[0_16px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[#8d7cff]/80 hover:bg-[#11182a] hover:shadow-[0_20px_55px_rgba(55,45,140,0.4)]"
  aria-label={
    isLoggedIn
      ? "프로필 열기"
      : "로그인 열기"
  }
>
  <span
    aria-hidden="true"
    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7667e8]/20 text-[#a99cff]"
  >
    {isLoggedIn ? "●" : "🔒"}
  </span>

  <span
    className={
      isLoggedIn
        ? "min-w-0 max-w-[110px] truncate tracking-[0.08em]"
        : "whitespace-nowrap"
    }
  >
    {profileButtonLabel}
  </span>
</button>

<button
  type="button"
  onClick={onOpenFocus}
  className="flex h-14 w-[196px] shrink-0 items-center justify-center gap-3 rounded-full border border-white/30 bg-[#090d16]/95 px-5 text-sm font-black tracking-[0.18em] text-white shadow-[0_16px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[#8d7cff]/80 hover:bg-[#11182a] hover:shadow-[0_20px_55px_rgba(55,45,140,0.4)]"
  aria-label="집중 모드 열기"
>
  <span
    aria-hidden="true"
    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7667e8]/20 text-[#a99cff]"
  >
    ✦
  </span>

  <span className="whitespace-nowrap">
    FOCUS MODE
  </span>
</button>
    </div>
  );
}
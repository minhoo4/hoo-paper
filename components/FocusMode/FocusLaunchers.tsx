"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
} from "react";

type FocusLaunchersProps = {
  profileImageUrl: string | null;
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
  profileImageUrl,
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
        className="group flex min-h-14 items-center justify-center gap-3 rounded-full border border-white/30 bg-[#090d16]/90 px-5 py-3 text-sm font-black tracking-[0.14em] text-white shadow-[0_16px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[#8d7cff]/80 hover:bg-[#11182a] hover:shadow-[0_20px_55px_rgba(55,45,140,0.4)]"
        aria-label="프로필 열기"
      >
        <span
          aria-hidden="true"
          className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#a99cff]/45 bg-[radial-gradient(circle_at_35%_30%,#a99cff,#5d52bc_55%,#292447)] text-sm text-white shadow-inner"
        >
          {profileImageUrl ? (
            <img
              src={profileImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            "H"
          )}

          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#090d16] bg-[#69e6a6]" />
        </span>

        <span className="flex flex-col items-start leading-none">
          <span className="text-[10px] tracking-[0.2em] text-white/45">
            HOO PROFILE
          </span>

          <span className="mt-1 tracking-[0.12em]">
            MY RECORD
          </span>
        </span>

        <span
          aria-hidden="true"
          className="ml-1 text-base text-[#a99cff] transition group-hover:translate-x-0.5"
        >
          ›
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenFocus}
        className="flex min-h-14 items-center justify-center gap-3 rounded-full border border-white/30 bg-[#090d16]/90 px-7 py-4 text-sm font-black tracking-[0.18em] text-white shadow-[0_16px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[#8d7cff]/80 hover:bg-[#11182a] hover:shadow-[0_20px_55px_rgba(55,45,140,0.4)]"
        aria-label="집중 모드 열기"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7667e8]/20 text-[#a99cff]"
        >
          ✦
        </span>

        <span>FOCUS MODE</span>
      </button>
    </div>
  );
}
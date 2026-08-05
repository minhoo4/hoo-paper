"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
} from "react";

type FocusLaunchersProps = {
  isLoggedIn: boolean;
  nickname: string | null;

  showWeather: boolean;
  weatherCode?: number;
  temperatureCelsius?: number;
  apparentTemperatureCelsius?: number;
  weatherIsDay?: boolean;
  isWeatherLoading: boolean;

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

function getWeatherPresentation(
  weatherCode?: number,
  isDay = true,
) {
  if (weatherCode === undefined) {
    return {
      icon: "◌",
      label: "날씨 확인 중",
    };
  }

  if (weatherCode === 0) {
    return {
      icon: isDay ? "☀" : "☾",
      label: isDay ? "맑음" : "맑은 밤",
    };
  }

  if (
    weatherCode === 1 ||
    weatherCode === 2
  ) {
    return {
      icon: isDay ? "🌤" : "☁",
      label: "구름 조금",
    };
  }

  if (weatherCode === 3) {
    return {
      icon: "☁",
      label: "흐림",
    };
  }

  if (
    weatherCode === 45 ||
    weatherCode === 48
  ) {
    return {
      icon: "≋",
      label: "안개",
    };
  }

  if (
    (weatherCode >= 51 &&
      weatherCode <= 67) ||
    (weatherCode >= 80 &&
      weatherCode <= 82)
  ) {
    return {
      icon: "☂",
      label:
        weatherCode >= 80
          ? "소나기"
          : "비",
    };
  }

  if (
    (weatherCode >= 71 &&
      weatherCode <= 77) ||
    (weatherCode >= 85 &&
      weatherCode <= 86)
  ) {
    return {
      icon: "❄",
      label: "눈",
    };
  }

  if (
    weatherCode >= 95 &&
    weatherCode <= 99
  ) {
    return {
      icon: "ϟ",
      label: "천둥·번개",
    };
  }

  return {
    icon: "◌",
    label: "날씨",
  };
}

export default function FocusLaunchers({
  isLoggedIn,
  nickname,
  showWeather,
  weatherCode,
  temperatureCelsius,
  apparentTemperatureCelsius,
  weatherIsDay,
  isWeatherLoading,
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

  const weather =
    getWeatherPresentation(
      weatherCode,
      weatherIsDay ?? true,
    );

  const hasTemperature =
    typeof temperatureCelsius ===
    "number";

  const hasApparentTemperature =
    typeof apparentTemperatureCelsius ===
    "number";

  return (
    <div
      className={`fixed bottom-3 right-3 z-[9990] flex items-end gap-2 transition-[transform,opacity,filter] duration-[900ms] ease-in-out sm:bottom-7 sm:right-7 sm:gap-3 ${
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
      {showWeather && (
        <aside
          className="flex h-[124px] w-[96px] shrink-0 flex-col items-center justify-center rounded-[28px] border border-white/30 bg-[#090d16]/95 px-2 text-center text-white shadow-[0_16px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:w-[132px] sm:px-3"
          aria-label={
            hasTemperature
              ? `${weather.label}, 현재 ${Math.round(temperatureCelsius)}도${
                  hasApparentTemperature
                    ? `, 체감 ${Math.round(apparentTemperatureCelsius)}도`
                    : ""
                }`
              : "현재 날씨 확인 중"
          }
        >
          <span
            aria-hidden="true"
            className="text-[26px] leading-none text-[#b7adff] sm:text-[30px]"
          >
            {isWeatherLoading &&
            !hasTemperature
              ? "◌"
              : weather.icon}
          </span>

          <p className="mt-2 max-w-full truncate text-[10px] font-black text-white/55 sm:text-[11px]">
            {isWeatherLoading &&
            !hasTemperature
              ? "확인 중"
              : weather.label}
          </p>

          <p className="mt-1 text-xl font-black leading-none text-white sm:text-2xl">
            {hasTemperature
              ? `${Math.round(temperatureCelsius)}°`
              : "--°"}
          </p>

          <p className="mt-2 whitespace-nowrap text-[9px] font-bold text-white/45 sm:text-[10px]">
            체감{" "}
            {hasApparentTemperature
              ? `${Math.round(apparentTemperatureCelsius)}°`
              : "--°"}
          </p>
        </aside>
      )}

      <div className="flex flex-col items-end gap-3">
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
    </div>
  );
}

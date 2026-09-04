"use client";

import {
  useEffect,
  useState,
} from "react";

type BeforeInstallPromptEvent =
  Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{
      outcome:
        | "accepted"
        | "dismissed";
      platform: string;
    }>;
  };

export default function PwaInstallButton() {
  const [
    installPrompt,
    setInstallPrompt,
  ] =
    useState<BeforeInstallPromptEvent | null>(
      null,
    );

  const [
    isIos,
    setIsIos,
  ] = useState(false);

  const [
    isInstalled,
    setIsInstalled,
  ] = useState(true);

  const [
    isReady,
    setIsReady,
  ] = useState(false);

  useEffect(() => {
    const iosNavigator =
      navigator as Navigator & {
        standalone?: boolean;
      };

    const displayMode =
      window.matchMedia(
        "(display-mode: standalone)",
      );

    const checkInstalled = () => {
      const standalone =
        displayMode.matches ||
        iosNavigator.standalone ===
          true;

      setIsInstalled(standalone);
    };

    checkInstalled();

    const userAgent =
      window.navigator.userAgent.toLowerCase();

    setIsIos(
      /iphone|ipad|ipod/.test(
        userAgent,
      ),
    );

    setIsReady(true);

    function handleBeforeInstallPrompt(
      event: Event,
    ) {
      event.preventDefault();

      setInstallPrompt(
        event as BeforeInstallPromptEvent,
      );

      setIsInstalled(false);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
      setIsInstalled(true);
    }

    function handleDisplayModeChange() {
      checkInstalled();
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled,
    );

    displayMode.addEventListener(
      "change",
      handleDisplayModeChange,
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled,
      );

      displayMode.removeEventListener(
        "change",
        handleDisplayModeChange,
      );
    };
  }, []);

  async function installHoo() {
    if (isInstalled) {
      return;
    }

    if (installPrompt) {
      try {
        await installPrompt.prompt();

        const choice =
          await installPrompt.userChoice;

        if (
          choice.outcome ===
          "accepted"
        ) {
          setIsInstalled(true);
        }
      } catch (error) {
        console.error(
          "HOO 설치 창을 열지 못했습니다.",
          error,
        );
      } finally {
        setInstallPrompt(null);
      }

      return;
    }

    if (isIos) {
      window.alert(
        "Safari 하단의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택해주세요.",
      );

      return;
    }

    window.alert(
      "브라우저 메뉴(⋮)에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해주세요. 설치 메뉴가 아직 보이지 않는다면 페이지를 새로고침한 뒤 다시 시도해주세요.",
    );
  }

  if (
    !isReady ||
    isInstalled
  ) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        void installHoo();
      }}
      className="fixed right-3 top-[calc(132px+var(--hoo-safe-top))] z-[10000] min-h-10 rounded-xl border border-white/30 bg-[#7467d8] px-4 py-2 text-xs font-black text-white shadow-xl backdrop-blur-md transition active:scale-95 sm:right-6 sm:top-[136px] sm:text-sm"
    >
      HOO 설치
    </button>
  );
}
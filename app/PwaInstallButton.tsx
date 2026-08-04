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

  useEffect(() => {
    const iosNavigator =
      navigator as Navigator & {
        standalone?: boolean;
      };

    const standalone =
      window.matchMedia(
        "(display-mode: standalone)",
      ).matches ||
      iosNavigator.standalone ===
        true;

    setIsInstalled(standalone);

    const userAgent =
      window.navigator.userAgent.toLowerCase();

    setIsIos(
      /iphone|ipad|ipod/.test(
        userAgent,
      ),
    );

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

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled,
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
    };
  }, []);

  async function installHoo() {
    if (installPrompt) {
      await installPrompt.prompt();

      const choice =
        await installPrompt.userChoice;

      if (
        choice.outcome ===
        "accepted"
      ) {
        setIsInstalled(true);
      }

      setInstallPrompt(null);
      return;
    }

    if (isIos) {
      window.alert(
        "Safari 하단의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택해주세요.",
      );
    }
  }

  if (
    isInstalled ||
    (!installPrompt && !isIos)
  ) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        void installHoo();
      }}
      className="fixed right-3 top-[calc(12px+var(--hoo-safe-top))] z-[10000] min-h-10 rounded-xl border border-white/30 bg-[#7467d8] px-4 py-2 text-xs font-black text-white shadow-xl backdrop-blur-md transition active:scale-95 sm:right-6 sm:top-6 sm:text-sm"
    >
      HOO 설치
    </button>
  );
}
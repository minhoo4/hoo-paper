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

const HOO_STUDY_NOTE_INSTALLED_KEY =
  "hoo-study-note-installed";

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
    isStudyNotePage,
    setIsStudyNotePage,
  ] = useState(false);

  const [
    isStudyNoteInstalled,
    setIsStudyNoteInstalled,
  ] = useState(true);

  useEffect(() => {
    const currentIsStudyNotePage =
      window.location.pathname ===
        "/study-note" ||
      window.location.pathname.startsWith(
        "/study-note/",
      );

    setIsStudyNotePage(
      currentIsStudyNotePage,
    );

    setIsStudyNoteInstalled(
      window.localStorage.getItem(
        HOO_STUDY_NOTE_INSTALLED_KEY,
      ) === "true",
    );

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

    /*
     * 기존 HOO 설치 여부 판단은 그대로 유지한다.
     * /study-note에서는 별도의 HOO터디 노트 설치 상태를 사용한다.
     */
    setIsInstalled(
      currentIsStudyNotePage
        ? false
        : standalone,
    );

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

      const promptEvent =
        event as BeforeInstallPromptEvent;

      setInstallPrompt(
        promptEvent,
      );

      if (
        currentIsStudyNotePage
      ) {
        setIsStudyNoteInstalled(
          false,
        );

        const shouldInstallImmediately =
          new URLSearchParams(
            window.location.search,
          ).get("install") === "1";

        if (
          shouldInstallImmediately
        ) {
          /*
           * 메인 HOO 화면의 "Hoo노트 설치"에서 넘어온 경우
           * /study-note 도착 즉시 전용 설치 프롬프트를 실행한다.
           *
           * 브라우저가 자동 프롬프트를 허용하지 않는 환경에서는
           * 기존 Hoo노트 설치 버튼이 그대로 남아 수동 설치가 가능하다.
           */
          window.history.replaceState(
            {},
            "",
            "/study-note",
          );

          void (async () => {
            try {
              await promptEvent.prompt();

              const choice =
                await promptEvent.userChoice;

              if (
                choice.outcome ===
                "accepted"
              ) {
                window.localStorage.setItem(
                  HOO_STUDY_NOTE_INSTALLED_KEY,
                  "true",
                );

                setIsStudyNoteInstalled(
                  true,
                );
              }
            } catch (error) {
              console.warn(
                "HOO터디 노트 자동 설치 프롬프트 실행 실패:",
                error,
              );
            } finally {
              setInstallPrompt(null);
            }
          })();
        }

        return;
      }

      setIsInstalled(false);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);

      if (
        currentIsStudyNotePage
      ) {
        window.localStorage.setItem(
          HOO_STUDY_NOTE_INSTALLED_KEY,
          "true",
        );

        setIsStudyNoteInstalled(
          true,
        );
      } else {
        setIsInstalled(true);
      }
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

  async function installStudyNote() {
    /*
     * 메인 HOO 화면에서는 다른 manifest를 직접 설치할 수 없으므로
     * HOO터디 노트 전용 manifest가 연결된 /study-note로 이동한다.
     * 이동한 페이지에서 같은 버튼을 한 번 더 누르면
     * HOO터디 노트 전용 설치 프롬프트가 열린다.
     */
    if (!isStudyNotePage) {
      window.location.assign(
        "/study-note?install=1",
      );
      return;
    }

    if (installPrompt) {
      await installPrompt.prompt();

      const choice =
        await installPrompt.userChoice;

      if (
        choice.outcome ===
        "accepted"
      ) {
        window.localStorage.setItem(
          HOO_STUDY_NOTE_INSTALLED_KEY,
          "true",
        );

        setIsStudyNoteInstalled(
          true,
        );
      }

      setInstallPrompt(null);
      return;
    }

    if (isIos) {
      window.alert(
        "Safari 하단의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택해주세요.",
      );
      return;
    }

    window.alert(
      "이 페이지가 완전히 열린 뒤 다시 ‘Hoo노트 설치’를 눌러주세요. 설치 버튼이 계속 나타나지 않으면 브라우저 주소창의 설치 아이콘을 사용해주세요.",
    );
  }

  const showHooInstall =
    !isStudyNotePage &&
    !isInstalled &&
    Boolean(
      installPrompt ||
        isIos,
    );

  const showStudyNoteInstall =
    !isStudyNoteInstalled;

  if (
    !showHooInstall &&
    !showStudyNoteInstall
  ) {
    return null;
  }

  return (
    <div className="fixed right-3 top-[calc(132px+var(--hoo-safe-top))] z-[10000] flex w-[112px] flex-col gap-2 sm:right-6 sm:top-[136px]">
      {showHooInstall ? (
        <button
          type="button"
          onClick={() => {
            void installHoo();
          }}
          className="min-h-10 w-full rounded-xl border border-white/30 bg-[#7467d8] px-3 py-2 text-xs font-black text-white shadow-xl backdrop-blur-md transition active:scale-95 sm:text-sm"
        >
          HOO 설치
        </button>
      ) : !isStudyNotePage ? (
        /*
         * HOO가 이미 설치되어 버튼이 사라진 경우에도
         * Hoo노트 설치 버튼은 기존 HOO 설치 버튼의
         * 바로 아래 위치를 유지한다.
         */
        <div
          aria-hidden="true"
          className="min-h-10 w-full"
        />
      ) : null}

      {showStudyNoteInstall && (
        <button
          type="button"
          onClick={() => {
            void installStudyNote();
          }}
          className="min-h-10 w-full rounded-xl border border-white/30 bg-[#7467d8] px-2 py-2 text-[11px] font-black text-white shadow-xl backdrop-blur-md transition active:scale-95 sm:text-xs"
        >
          Hoo노트 설치
        </button>
      )}
    </div>
  );
}

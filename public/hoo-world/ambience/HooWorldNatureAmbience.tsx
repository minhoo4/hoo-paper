

import {
  useEffect,
  useRef,
} from "react";

type HooWorldNatureAmbienceProps = {
  enabled?: boolean;
  src?: string;
  volume?: number;
};

const DEFAULT_SRC =
  "/hoo-world/ambience/nature-loop.wav";

const DEFAULT_VOLUME =
  0.16;

const FADE_IN_MS =
  4_000;

const FADE_OUT_MS =
  1_200;

function clampVolume(
  value: number,
) {
  return Math.max(
    0,
    Math.min(
      1,
      value,
    ),
  );
}

export default function HooWorldNatureAmbience({
  enabled = true,
  src = DEFAULT_SRC,
  volume = DEFAULT_VOLUME,
}: HooWorldNatureAmbienceProps) {
  const audioRef =
    useRef<HTMLAudioElement | null>(
      null,
    );

  const fadeFrameRef =
    useRef<number | null>(
      null,
    );

  useEffect(() => {
    const audio =
      new Audio(
        src,
      );

    audio.loop = true;

    audio.preload =
      "auto";

    audio.volume = 0;

    audioRef.current =
      audio;

    let cancelled =
      false;

    function clearFadeFrame() {
      if (
        fadeFrameRef.current ===
        null
      ) {
        return;
      }

      window.cancelAnimationFrame(
        fadeFrameRef.current,
      );

      fadeFrameRef.current =
        null;
    }

    function fadeVolume(
      targetVolume: number,
      durationMs: number,
      onComplete?: () => void,
    ) {
      clearFadeFrame();

      const startVolume =
        audio.volume;

      const safeTarget =
        clampVolume(
          targetVolume,
        );

      const startedAt =
        performance.now();

      function step(
        now: number,
      ) {
        if (cancelled) {
          return;
        }

        const progress =
          Math.min(
            1,
            Math.max(
              0,
              (
                now -
                startedAt
              ) /
                durationMs,
            ),
          );

        audio.volume =
          clampVolume(
            startVolume +
              (
                safeTarget -
                startVolume
              ) *
                progress,
          );

        if (
          progress >= 1
        ) {
          fadeFrameRef.current =
            null;

          onComplete?.();

          return;
        }

        fadeFrameRef.current =
          window.requestAnimationFrame(
            step,
          );
      }

      fadeFrameRef.current =
        window.requestAnimationFrame(
          step,
        );
    }

    async function startAmbience() {
      if (
        cancelled ||
        !enabled ||
        !audio.paused
      ) {
        return;
      }

      try {
        await audio.play();

        if (cancelled) {
          return;
        }

        fadeVolume(
          clampVolume(
            volume,
          ),
          FADE_IN_MS,
        );
      } catch {
        /*
         * 브라우저 자동재생 정책에 막힌 경우
         * 첫 키 입력 / 클릭에서 다시 시작한다.
         */
      }
    }

    function stopAmbience() {
      if (
        audio.paused
      ) {
        audio.volume = 0;
        return;
      }

      fadeVolume(
        0,
        FADE_OUT_MS,
        () => {
          audio.pause();
        },
      );
    }

    function handleUserGesture() {
      if (!enabled) {
        return;
      }

      void startAmbience();
    }

    function handleAudioError() {
      console.warn(
        "HOO WORLD 자연음 파일을 불러오지 못했습니다.",
        src,
      );
    }

    audio.addEventListener(
      "error",
      handleAudioError,
    );

    window.addEventListener(
      "pointerdown",
      handleUserGesture,
    );

    window.addEventListener(
      "keydown",
      handleUserGesture,
    );

    if (enabled) {
      void startAmbience();
    } else {
      stopAmbience();
    }

    return () => {
      cancelled =
        true;

      clearFadeFrame();

      audio.removeEventListener(
        "error",
        handleAudioError,
      );

      window.removeEventListener(
        "pointerdown",
        handleUserGesture,
      );

      window.removeEventListener(
        "keydown",
        handleUserGesture,
      );

      audio.pause();

      audio.src = "";

      audioRef.current =
        null;
    };
  }, [
    enabled,
    src,
    volume,
  ]);

  return null;
}

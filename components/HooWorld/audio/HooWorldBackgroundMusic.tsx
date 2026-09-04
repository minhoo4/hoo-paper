"use client";

import {
  useEffect,
  useRef,
} from "react";

type HooWorldBackgroundMusicProps = {
  enabled: boolean;
  tracks: readonly string[];
};

const MIN_DELAY_MS = 10_000;
const MAX_DELAY_MS = 30_000;
const TARGET_VOLUME = 0.0425;
const FADE_IN_MS = 2200;
const FADE_OUT_MS = 900;

function getRandomDelay() {
  return (
    MIN_DELAY_MS +
    Math.floor(
      Math.random() *
        (
          MAX_DELAY_MS -
          MIN_DELAY_MS +
          1
        ),
    )
  );
}

function getNextTrackIndex(
  trackCount: number,
  previousIndex: number | null,
) {
  if (trackCount <= 1) {
    return 0;
  }

  let nextIndex =
    Math.floor(
      Math.random() *
        trackCount,
    );

  while (
    nextIndex ===
    previousIndex
  ) {
    nextIndex =
      Math.floor(
        Math.random() *
          trackCount,
      );
  }

  return nextIndex;
}

export default function HooWorldBackgroundMusic({
  enabled,
  tracks,
}: HooWorldBackgroundMusicProps) {
  const audioRef =
    useRef<HTMLAudioElement | null>(
      null,
    );

  const delayTimerRef =
    useRef<number | null>(
      null,
    );

  const fadeFrameRef =
    useRef<number | null>(
      null,
    );

  const previousTrackIndexRef =
    useRef<number | null>(
      null,
    );

  const pendingTrackIndexRef =
    useRef<number | null>(
      null,
    );

  const enabledRef =
    useRef(enabled);

  enabledRef.current =
    enabled;

  const tracksRef =
    useRef(tracks);

  tracksRef.current =
    tracks;

  useEffect(() => {
    const audio =
      new Audio();

    audio.preload =
      "metadata";

    audio.volume = 0;

    audioRef.current =
      audio;

    function clearDelayTimer() {
      if (
        delayTimerRef.current ===
        null
      ) {
        return;
      }

      window.clearTimeout(
        delayTimerRef.current,
      );

      delayTimerRef.current =
        null;
    }

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

      const startedAt =
        performance.now();

      function step(
        now: number,
      ) {
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
          Math.min(
            1,
            Math.max(
              0,
              startVolume +
                (
                  targetVolume -
                  startVolume
                ) *
                  progress,
            ),
          );

        if (progress >= 1) {
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

    function scheduleNextTrack() {
      clearDelayTimer();

      if (
        !enabledRef.current ||
        tracksRef.current.length ===
          0
      ) {
        return;
      }

      delayTimerRef.current =
        window.setTimeout(
          () => {
            delayTimerRef.current =
              null;

            const nextIndex =
              getNextTrackIndex(
                tracksRef.current.length,
                previousTrackIndexRef.current,
              );

            pendingTrackIndexRef.current =
              nextIndex;

            void playPendingTrack();
          },
          getRandomDelay(),
        );
    }

    async function playPendingTrack() {
      if (
        !enabledRef.current
      ) {
        return;
      }

      const trackIndex =
        pendingTrackIndexRef.current;

      if (
        trackIndex === null
      ) {
        return;
      }

      const track =
        tracksRef.current[
          trackIndex
        ];

      if (!track) {
        pendingTrackIndexRef.current =
          null;

        scheduleNextTrack();

        return;
      }

      clearFadeFrame();

      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;
      audio.src = track;

      try {
        await audio.play();

        pendingTrackIndexRef.current =
          null;

        previousTrackIndexRef.current =
          trackIndex;

        fadeVolume(
          TARGET_VOLUME,
          FADE_IN_MS,
        );
      } catch {
        /*
         * 브라우저 자동재생 정책에 막힌 경우
         * 다음 사용자 키/클릭 입력에서 같은 곡을 다시 시도한다.
         */
      }
    }

    function stopMusic(
      immediate = false,
    ) {
      clearDelayTimer();
      pendingTrackIndexRef.current =
        null;

      if (
        audio.paused ||
        immediate
      ) {
        clearFadeFrame();
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0;
        return;
      }

      fadeVolume(
        0,
        FADE_OUT_MS,
        () => {
          audio.pause();
          audio.currentTime = 0;
        },
      );
    }

    function handleEnded() {
      audio.volume = 0;

      scheduleNextTrack();
    }

    function handleError() {
      pendingTrackIndexRef.current =
        null;

      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;

      if (
        enabledRef.current
      ) {
        scheduleNextTrack();
      }
    }

    function handleUserGesture() {
      if (
        !enabledRef.current ||
        pendingTrackIndexRef.current ===
          null
      ) {
        return;
      }

      void playPendingTrack();
    }

    audio.addEventListener(
      "ended",
      handleEnded,
    );

    audio.addEventListener(
      "error",
      handleError,
    );

    window.addEventListener(
      "pointerdown",
      handleUserGesture,
    );

    window.addEventListener(
      "keydown",
      handleUserGesture,
    );

    if (
      enabledRef.current &&
      tracksRef.current.length > 0
    ) {
      scheduleNextTrack();
    }

    const syncTimer =
      window.setInterval(
        () => {
          if (
            !enabledRef.current
          ) {
            stopMusic();
            return;
          }

          if (
            tracksRef.current.length ===
            0
          ) {
            stopMusic(true);
            return;
          }

          if (
            audio.paused &&
            delayTimerRef.current ===
              null &&
            pendingTrackIndexRef.current ===
              null
          ) {
            scheduleNextTrack();
          }
        },
        250,
      );

    return () => {
      window.clearInterval(
        syncTimer,
      );

      clearDelayTimer();
      clearFadeFrame();

      audio.removeEventListener(
        "ended",
        handleEnded,
      );

      audio.removeEventListener(
        "error",
        handleError,
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
  }, []);

  return null;
}

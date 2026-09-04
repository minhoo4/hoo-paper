"use client";

import {
  useCallback,
  useEffect,
  useRef,
} from "react";

type UseHooWorldCampfireAudioOptions = {
  volume?: number;
};

type CampfireAudioRuntime = {
  context: AudioContext;
  masterGain: GainNode;

  brownNoiseBuffer: AudioBuffer;
  whiteNoiseBuffer: AudioBuffer;

  lowFireSource: AudioBufferSourceNode | null;
  lowFireHighpass: BiquadFilterNode | null;
  lowFireLowpass: BiquadFilterNode | null;
  lowFireGain: GainNode | null;

  flameSource: AudioBufferSourceNode | null;
  flameHighpass: BiquadFilterNode | null;
  flameLowpass: BiquadFilterNode | null;
  flameGain: GainNode | null;

  lowFireLfo: OscillatorNode | null;
  lowFireLfoGain: GainNode | null;

  flameLfo: OscillatorNode | null;
  flameLfoGain: GainNode | null;

  crackleTimer: number | null;
  emberTimer: number | null;

  isRunning: boolean;
};

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.max(
    min,
    Math.min(
      max,
      value,
    ),
  );
}

function randomBetween(
  min: number,
  max: number,
) {
  return (
    min +
    Math.random() *
      (
        max -
        min
      )
  );
}

function createBrownNoiseBuffer(
  context: AudioContext,
  seconds: number,
) {
  const frameCount =
    Math.max(
      1,
      Math.floor(
        context.sampleRate *
          seconds,
      ),
    );

  const buffer =
    context.createBuffer(
      1,
      frameCount,
      context.sampleRate,
    );

  const data =
    buffer.getChannelData(
      0,
    );

  let previous = 0;

  for (
    let index = 0;
    index < frameCount;
    index += 1
  ) {
    const white =
      Math.random() * 2 - 1;

    previous =
      previous * 0.985 +
      white * 0.015;

    data[index] =
      previous * 3.0;
  }

  return buffer;
}

function createWhiteNoiseBuffer(
  context: AudioContext,
  seconds: number,
) {
  const frameCount =
    Math.max(
      1,
      Math.floor(
        context.sampleRate *
          seconds,
      ),
    );

  const buffer =
    context.createBuffer(
      1,
      frameCount,
      context.sampleRate,
    );

  const data =
    buffer.getChannelData(
      0,
    );

  for (
    let index = 0;
    index < frameCount;
    index += 1
  ) {
    data[index] =
      Math.random() * 2 - 1;
  }

  return buffer;
}

function safeDisconnect(
  node: AudioNode | null,
) {
  try {
    node?.disconnect();
  } catch {
    // 이미 해제된 노드는 무시한다.
  }
}

function safeStop(
  node:
    | AudioBufferSourceNode
    | OscillatorNode
    | null,
) {
  try {
    node?.stop();
  } catch {
    // 이미 정지된 노드는 무시한다.
  }
}

export default function useHooWorldCampfireAudio({
  volume = 0.55,
}: UseHooWorldCampfireAudioOptions = {}) {
  const runtimeRef =
    useRef<CampfireAudioRuntime | null>(
      null,
    );

  const volumeRef =
    useRef(
      clamp(
        volume,
        0,
        1,
      ),
    );

  volumeRef.current =
    clamp(
      volume,
      0,
      1,
    );

  const clearRandomTimers =
    useCallback(() => {
      const runtime =
        runtimeRef.current;

      if (!runtime) {
        return;
      }

      if (
        runtime.crackleTimer !==
        null
      ) {
        window.clearTimeout(
          runtime.crackleTimer,
        );

        runtime.crackleTimer =
          null;
      }

      if (
        runtime.emberTimer !==
        null
      ) {
        window.clearTimeout(
          runtime.emberTimer,
        );

        runtime.emberTimer =
          null;
      }
    }, []);

  const scheduleCrackle =
    useCallback(
      function scheduleCrackle() {
        const runtime =
          runtimeRef.current;

        if (
          !runtime ||
          !runtime.isRunning
        ) {
          return;
        }

        runtime.crackleTimer =
          window.setTimeout(
            () => {
              const currentRuntime =
                runtimeRef.current;

              if (
                !currentRuntime ||
                !currentRuntime.isRunning
              ) {
                return;
              }

              const {
                context,
                masterGain,
                whiteNoiseBuffer,
              } =
                currentRuntime;

              const now =
                context.currentTime;

              /*
               * 편안한 실제 장작의 "타닥... 토독..." 질감.
               *
               * 바람처럼 계속 쉬익거리지 않고,
               * 불규칙한 순간에만 나무가 갈라지는 소리를 만든다.
               */
              const tapCount =
                Math.floor(
                  randomBetween(
                    1,
                    3.15,
                  ),
                );

              for (
                let tapIndex = 0;
                tapIndex < tapCount;
                tapIndex += 1
              ) {
                const startAt =
                  now +
                  tapIndex *
                    randomBetween(
                      0.09,
                      0.26,
                    );

                const pan =
                  randomBetween(
                    -0.5,
                    0.5,
                  );

                /*
                 * A. 장작의 중심 갈라짐 — 둥근 "탁"
                 */
                const bodySource =
                  context.createBufferSource();

                bodySource.buffer =
                  whiteNoiseBuffer;

                const bodyBandpass =
                  context.createBiquadFilter();

                bodyBandpass.type =
                  "bandpass";

                bodyBandpass.frequency.value =
                  randomBetween(
                    650,
                    1650,
                  );

                bodyBandpass.Q.value =
                  randomBetween(
                    0.8,
                    1.8,
                  );

                const bodyGain =
                  context.createGain();

                const bodyPanner =
                  context.createStereoPanner();

                bodyPanner.pan.value =
                  pan;

                const bodyDuration =
                  randomBetween(
                    0.045,
                    0.12,
                  );

                const bodyStop =
                  startAt +
                  bodyDuration;

                const bodyPeak =
                  randomBetween(
                    0.028,
                    0.058,
                  );

                bodyGain.gain.setValueAtTime(
                  0.0001,
                  startAt,
                );

                bodyGain.gain.exponentialRampToValueAtTime(
                  bodyPeak,
                  startAt +
                    0.006,
                );

                bodyGain.gain.exponentialRampToValueAtTime(
                  0.0001,
                  bodyStop,
                );

                bodySource.connect(
                  bodyBandpass,
                );

                bodyBandpass.connect(
                  bodyGain,
                );

                bodyGain.connect(
                  bodyPanner,
                );

                bodyPanner.connect(
                  masterGain,
                );

                const bodyMaxOffset =
                  Math.max(
                    0,
                    whiteNoiseBuffer.duration -
                      bodyDuration,
                  );

                bodySource.start(
                  startAt,
                  randomBetween(
                    0,
                    bodyMaxOffset,
                  ),
                  bodyDuration,
                );

                bodySource.addEventListener(
                  "ended",
                  () => {
                    safeDisconnect(
                      bodySource,
                    );

                    safeDisconnect(
                      bodyBandpass,
                    );

                    safeDisconnect(
                      bodyGain,
                    );

                    safeDisconnect(
                      bodyPanner,
                    );
                  },
                  {
                    once: true,
                  },
                );

                /*
                 * B. 아주 얇은 수지 파열 — 짧은 "딱"
                 *
                 * 고역을 크게 줄여 오래 들어도 귀가 피곤하지 않게 한다.
                 */
                const snapSource =
                  context.createBufferSource();

                snapSource.buffer =
                  whiteNoiseBuffer;

                const snapHighpass =
                  context.createBiquadFilter();

                snapHighpass.type =
                  "highpass";

                snapHighpass.frequency.value =
                  randomBetween(
                    1800,
                    2800,
                  );

                const snapLowpass =
                  context.createBiquadFilter();

                snapLowpass.type =
                  "lowpass";

                snapLowpass.frequency.value =
                  randomBetween(
                    3800,
                    5200,
                  );

                const snapGain =
                  context.createGain();

                const snapPanner =
                  context.createStereoPanner();

                snapPanner.pan.value =
                  clamp(
                    pan +
                      randomBetween(
                        -0.1,
                        0.1,
                      ),
                    -1,
                    1,
                  );

                const snapDuration =
                  randomBetween(
                    0.01,
                    0.025,
                  );

                const snapStart =
                  startAt +
                  randomBetween(
                    0,
                    0.01,
                  );

                const snapStop =
                  snapStart +
                  snapDuration;

                snapGain.gain.setValueAtTime(
                  0.0001,
                  snapStart,
                );

                snapGain.gain.exponentialRampToValueAtTime(
                  randomBetween(
                    0.006,
                    0.018,
                  ),
                  snapStart +
                    0.0025,
                );

                snapGain.gain.exponentialRampToValueAtTime(
                  0.0001,
                  snapStop,
                );

                snapSource.connect(
                  snapHighpass,
                );

                snapHighpass.connect(
                  snapLowpass,
                );

                snapLowpass.connect(
                  snapGain,
                );

                snapGain.connect(
                  snapPanner,
                );

                snapPanner.connect(
                  masterGain,
                );

                const snapMaxOffset =
                  Math.max(
                    0,
                    whiteNoiseBuffer.duration -
                      snapDuration,
                  );

                snapSource.start(
                  snapStart,
                  randomBetween(
                    0,
                    snapMaxOffset,
                  ),
                  snapDuration,
                );

                snapSource.addEventListener(
                  "ended",
                  () => {
                    safeDisconnect(
                      snapSource,
                    );

                    safeDisconnect(
                      snapHighpass,
                    );

                    safeDisconnect(
                      snapLowpass,
                    );

                    safeDisconnect(
                      snapGain,
                    );

                    safeDisconnect(
                      snapPanner,
                    );
                  },
                  {
                    once: true,
                  },
                );

                /*
                 * C. 나무 몸통의 짧고 따뜻한 울림 — "톡"
                 */
                const woodOscillator =
                  context.createOscillator();

                woodOscillator.type =
                  "triangle";

                const woodGain =
                  context.createGain();

                const woodPanner =
                  context.createStereoPanner();

                woodPanner.pan.value =
                  pan * 0.55;

                const woodStop =
                  startAt +
                  randomBetween(
                    0.07,
                    0.13,
                  );

                woodOscillator.frequency.setValueAtTime(
                  randomBetween(
                    95,
                    160,
                  ),
                  startAt,
                );

                woodOscillator.frequency.exponentialRampToValueAtTime(
                  randomBetween(
                    60,
                    90,
                  ),
                  woodStop,
                );

                woodGain.gain.setValueAtTime(
                  0.0001,
                  startAt,
                );

                woodGain.gain.exponentialRampToValueAtTime(
                  randomBetween(
                    0.004,
                    0.011,
                  ),
                  startAt +
                    0.007,
                );

                woodGain.gain.exponentialRampToValueAtTime(
                  0.0001,
                  woodStop,
                );

                woodOscillator.connect(
                  woodGain,
                );

                woodGain.connect(
                  woodPanner,
                );

                woodPanner.connect(
                  masterGain,
                );

                woodOscillator.start(
                  startAt,
                );

                woodOscillator.stop(
                  woodStop +
                    0.01,
                );

                woodOscillator.addEventListener(
                  "ended",
                  () => {
                    safeDisconnect(
                      woodOscillator,
                    );

                    safeDisconnect(
                      woodGain,
                    );

                    safeDisconnect(
                      woodPanner,
                    );
                  },
                  {
                    once: true,
                  },
                );
              }

              scheduleCrackle();
            },
            randomBetween(
              650,
              2400,
            ),
          );
      },
      [],
    );

  const scheduleEmberPop =
    useCallback(
      function scheduleEmberPop() {
        const runtime =
          runtimeRef.current;

        if (
          !runtime ||
          !runtime.isRunning
        ) {
          return;
        }

        runtime.emberTimer =
          window.setTimeout(
            () => {
              const currentRuntime =
                runtimeRef.current;

              if (
                !currentRuntime ||
                !currentRuntime.isRunning
              ) {
                return;
              }

              const {
                context,
                masterGain,
              } =
                currentRuntime;

              const now =
                context.currentTime;

              /*
               * 가끔 들리는 낮은 "톡/툭" 소리.
               * 고음 파직만 계속되는 느낌을 줄여준다.
               */
              const oscillator =
                context.createOscillator();

              oscillator.type =
                "triangle";

              const gain =
                context.createGain();

              const panner =
                context.createStereoPanner();

              panner.pan.value =
                randomBetween(
                  -0.55,
                  0.55,
                );

              const startFrequency =
                randomBetween(
                  78,
                  138,
                );

              oscillator.frequency.setValueAtTime(
                startFrequency,
                now,
              );

              oscillator.frequency.exponentialRampToValueAtTime(
                randomBetween(
                  48,
                  76,
                ),
                now +
                  0.09,
              );

              gain.gain.setValueAtTime(
                0.0001,
                now,
              );

              gain.gain.exponentialRampToValueAtTime(
                randomBetween(
                  0.005,
                  0.013,
                ),
                now +
                  0.008,
              );

              gain.gain.exponentialRampToValueAtTime(
                0.0001,
                now +
                  0.13,
              );

              oscillator.connect(
                gain,
              );

              gain.connect(
                panner,
              );

              panner.connect(
                masterGain,
              );

              oscillator.start(
                now,
              );

              oscillator.stop(
                now +
                  0.15,
              );

              oscillator.addEventListener(
                "ended",
                () => {
                  safeDisconnect(
                    oscillator,
                  );

                  safeDisconnect(
                    gain,
                  );

                  safeDisconnect(
                    panner,
                  );
                },
                {
                  once: true,
                },
              );

              scheduleEmberPop();
            },
            randomBetween(
              3500,
              8500,
            ),
          );
      },
      [],
    );

  const stop =
    useCallback(() => {
      const runtime =
        runtimeRef.current;

      if (!runtime) {
        return;
      }

      runtime.isRunning =
        false;

      clearRandomTimers();

      const now =
        runtime.context.currentTime;

      runtime.masterGain.gain.cancelScheduledValues(
        now,
      );

      runtime.masterGain.gain.setValueAtTime(
        Math.max(
          0.0001,
          runtime.masterGain.gain.value,
        ),
        now,
      );

      runtime.masterGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.28,
      );

      window.setTimeout(
        () => {
          const currentRuntime =
            runtimeRef.current;

          if (
            !currentRuntime ||
            currentRuntime.isRunning
          ) {
            return;
          }

          safeStop(
            currentRuntime.lowFireSource,
          );

          safeStop(
            currentRuntime.flameSource,
          );

          safeStop(
            currentRuntime.lowFireLfo,
          );

          safeStop(
            currentRuntime.flameLfo,
          );

          safeDisconnect(
            currentRuntime.lowFireSource,
          );

          safeDisconnect(
            currentRuntime.lowFireHighpass,
          );

          safeDisconnect(
            currentRuntime.lowFireLowpass,
          );

          safeDisconnect(
            currentRuntime.lowFireGain,
          );

          safeDisconnect(
            currentRuntime.flameSource,
          );

          safeDisconnect(
            currentRuntime.flameHighpass,
          );

          safeDisconnect(
            currentRuntime.flameLowpass,
          );

          safeDisconnect(
            currentRuntime.flameGain,
          );

          safeDisconnect(
            currentRuntime.lowFireLfo,
          );

          safeDisconnect(
            currentRuntime.lowFireLfoGain,
          );

          safeDisconnect(
            currentRuntime.flameLfo,
          );

          safeDisconnect(
            currentRuntime.flameLfoGain,
          );

          currentRuntime.lowFireSource =
            null;

          currentRuntime.lowFireHighpass =
            null;

          currentRuntime.lowFireLowpass =
            null;

          currentRuntime.lowFireGain =
            null;

          currentRuntime.flameSource =
            null;

          currentRuntime.flameHighpass =
            null;

          currentRuntime.flameLowpass =
            null;

          currentRuntime.flameGain =
            null;

          currentRuntime.lowFireLfo =
            null;

          currentRuntime.lowFireLfoGain =
            null;

          currentRuntime.flameLfo =
            null;

          currentRuntime.flameLfoGain =
            null;
        },
        340,
      );
    }, [
      clearRandomTimers,
    ]);

  const start =
    useCallback(
      async () => {
        let runtime =
          runtimeRef.current;

        if (!runtime) {
          const AudioContextClass =
            window.AudioContext;

          const context =
            new AudioContextClass();

          const masterGain =
            context.createGain();

          masterGain.gain.value =
            0.0001;

          masterGain.connect(
            context.destination,
          );

          runtime = {
            context,
            masterGain,

            brownNoiseBuffer:
              createBrownNoiseBuffer(
                context,
                5.5,
              ),

            whiteNoiseBuffer:
              createWhiteNoiseBuffer(
                context,
                4.5,
              ),

            lowFireSource:
              null,

            lowFireHighpass:
              null,

            lowFireLowpass:
              null,

            lowFireGain:
              null,

            flameSource:
              null,

            flameHighpass:
              null,

            flameLowpass:
              null,

            flameGain:
              null,

            lowFireLfo:
              null,

            lowFireLfoGain:
              null,

            flameLfo:
              null,

            flameLfoGain:
              null,

            crackleTimer:
              null,

            emberTimer:
              null,

            isRunning:
              false,
          };

          runtimeRef.current =
            runtime;
        }

        if (
          runtime.context.state ===
          "suspended"
        ) {
          await runtime.context.resume();
        }

        if (
          runtime.isRunning
        ) {
          return;
        }

        runtime.isRunning =
          true;

        const {
          context,
          masterGain,
          brownNoiseBuffer,
          whiteNoiseBuffer,
        } =
          runtime;

        /*
         * 1. 낮고 두꺼운 연소층.
         * 장작이 실제로 계속 타고 있다는 몸통 소리.
         */
        const lowFireSource =
          context.createBufferSource();

        lowFireSource.buffer =
          brownNoiseBuffer;

        lowFireSource.loop =
          true;

        const lowFireHighpass =
          context.createBiquadFilter();

        lowFireHighpass.type =
          "highpass";

        lowFireHighpass.frequency.value =
          42;

        const lowFireLowpass =
          context.createBiquadFilter();

        lowFireLowpass.type =
          "lowpass";

        lowFireLowpass.frequency.value =
          720;

        lowFireLowpass.Q.value =
          0.28;

        const lowFireGain =
          context.createGain();

        lowFireGain.gain.value =
          0.105;

        const lowFireLfo =
          context.createOscillator();

        lowFireLfo.type =
          "sine";

        lowFireLfo.frequency.value =
          randomBetween(
            0.11,
            0.17,
          );

        const lowFireLfoGain =
          context.createGain();

        lowFireLfoGain.gain.value =
          0.035;

        lowFireLfo.connect(
          lowFireLfoGain,
        );

        lowFireLfoGain.connect(
          lowFireGain.gain,
        );

        lowFireSource.connect(
          lowFireHighpass,
        );

        lowFireHighpass.connect(
          lowFireLowpass,
        );

        lowFireLowpass.connect(
          lowFireGain,
        );

        lowFireGain.connect(
          masterGain,
        );

        /*
         * 2. 중고역 불꽃층.
         * 활활 타는 불의 사각거림과 공기 소리를 담당한다.
         */
        const flameSource =
          context.createBufferSource();

        flameSource.buffer =
          whiteNoiseBuffer;

        flameSource.loop =
          true;

        const flameHighpass =
          context.createBiquadFilter();

        flameHighpass.type =
          "highpass";

        flameHighpass.frequency.value =
          520;

        const flameLowpass =
          context.createBiquadFilter();

        flameLowpass.type =
          "lowpass";

        flameLowpass.frequency.value =
          2850;

        flameLowpass.Q.value =
          0.35;

        const flameGain =
          context.createGain();

        flameGain.gain.value =
          0.018;

        const flameLfo =
          context.createOscillator();

        flameLfo.type =
          "sine";

        flameLfo.frequency.value =
          randomBetween(
            0.38,
            0.62,
          );

        const flameLfoGain =
          context.createGain();

        flameLfoGain.gain.value =
          0.009;

        flameLfo.connect(
          flameLfoGain,
        );

        flameLfoGain.connect(
          flameGain.gain,
        );

        flameSource.connect(
          flameHighpass,
        );

        flameHighpass.connect(
          flameLowpass,
        );

        flameLowpass.connect(
          flameGain,
        );

        flameGain.connect(
          masterGain,
        );

        runtime.lowFireSource =
          lowFireSource;

        runtime.lowFireHighpass =
          lowFireHighpass;

        runtime.lowFireLowpass =
          lowFireLowpass;

        runtime.lowFireGain =
          lowFireGain;

        runtime.flameSource =
          flameSource;

        runtime.flameHighpass =
          flameHighpass;

        runtime.flameLowpass =
          flameLowpass;

        runtime.flameGain =
          flameGain;

        runtime.lowFireLfo =
          lowFireLfo;

        runtime.lowFireLfoGain =
          lowFireLfoGain;

        runtime.flameLfo =
          flameLfo;

        runtime.flameLfoGain =
          flameLfoGain;

        const now =
          context.currentTime;

        masterGain.gain.cancelScheduledValues(
          now,
        );

        masterGain.gain.setValueAtTime(
          0.0001,
          now,
        );

        masterGain.gain.exponentialRampToValueAtTime(
          Math.max(
            0.0001,
            volumeRef.current *
              0.72,
          ),
          now + 0.32,
        );

        lowFireSource.start();

        flameSource.start();

        lowFireLfo.start();

        flameLfo.start();

        scheduleCrackle();

        scheduleEmberPop();
      },
      [
        scheduleCrackle,
        scheduleEmberPop,
      ],
    );

  const setVolume =
    useCallback(
      (
        nextVolume: number,
      ) => {
        const normalized =
          clamp(
            nextVolume,
            0,
            1,
          );

        volumeRef.current =
          normalized;

        const runtime =
          runtimeRef.current;

        if (
          !runtime ||
          !runtime.isRunning
        ) {
          return;
        }

        const now =
          runtime.context.currentTime;

        runtime.masterGain.gain.cancelScheduledValues(
          now,
        );

        runtime.masterGain.gain.linearRampToValueAtTime(
          Math.max(
            0.0001,
            normalized *
              0.72,
          ),
          now + 0.12,
        );
      },
      [],
    );

  useEffect(() => {
    setVolume(
      volume,
    );
  }, [
    setVolume,
    volume,
  ]);

  useEffect(() => {
    return () => {
      const runtime =
        runtimeRef.current;

      if (!runtime) {
        return;
      }

      runtime.isRunning =
        false;

      clearRandomTimers();

      safeStop(
        runtime.lowFireSource,
      );

      safeStop(
        runtime.flameSource,
      );

      safeStop(
        runtime.lowFireLfo,
      );

      safeStop(
        runtime.flameLfo,
      );

      safeDisconnect(
        runtime.lowFireSource,
      );

      safeDisconnect(
        runtime.lowFireHighpass,
      );

      safeDisconnect(
        runtime.lowFireLowpass,
      );

      safeDisconnect(
        runtime.lowFireGain,
      );

      safeDisconnect(
        runtime.flameSource,
      );

      safeDisconnect(
        runtime.flameHighpass,
      );

      safeDisconnect(
        runtime.flameLowpass,
      );

      safeDisconnect(
        runtime.flameGain,
      );

      safeDisconnect(
        runtime.lowFireLfo,
      );

      safeDisconnect(
        runtime.lowFireLfoGain,
      );

      safeDisconnect(
        runtime.flameLfo,
      );

      safeDisconnect(
        runtime.flameLfoGain,
      );

      safeDisconnect(
        runtime.masterGain,
      );

      void runtime.context.close();

      runtimeRef.current =
        null;
    };
  }, [
    clearRandomTimers,
  ]);

  return {
    start,
    stop,
    setVolume,
  };
}

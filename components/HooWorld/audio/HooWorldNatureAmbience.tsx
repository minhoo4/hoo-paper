"use client";

import {
  useEffect,
  useRef,
} from "react";

type HooWorldNatureAmbienceProps = {
  enabled?: boolean;
  volume?: number;
};

type NatureRuntime = {
  context: AudioContext;
  masterGain: GainNode;

  brownNoiseBuffer: AudioBuffer;
  whiteNoiseBuffer: AudioBuffer;

  windSource: AudioBufferSourceNode | null;
  windHighpass: BiquadFilterNode | null;
  windLowpass: BiquadFilterNode | null;
  windGain: GainNode | null;
  windAmplitudeLfo: OscillatorNode | null;
  windAmplitudeLfoGain: GainNode | null;
  windFilterLfo: OscillatorNode | null;
  windFilterLfoGain: GainNode | null;

  canopySource: AudioBufferSourceNode | null;
  canopyHighpass: BiquadFilterNode | null;
  canopyLowpass: BiquadFilterNode | null;
  canopyGain: GainNode | null;
  canopyLfo: OscillatorNode | null;
  canopyLfoGain: GainNode | null;

  leafTimer: number | null;
  insectTimer: number | null;
  birdTimer: number | null;

  isRunning: boolean;
};

const DEFAULT_VOLUME =
  0.99;

const FADE_IN_SECONDS =
  3.0;

const FADE_OUT_SECONDS =
  3.0;

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
      previous * 0.986 +
      white * 0.014;

    data[index] =
      previous * 2.9;
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

export default function HooWorldNatureAmbience({
  enabled = true,
  volume = DEFAULT_VOLUME,
}: HooWorldNatureAmbienceProps) {
  const runtimeRef =
    useRef<NatureRuntime | null>(
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

  useEffect(() => {
    let cancelled = false;

    function clearTimer(
      timer: number | null,
    ) {
      if (
        timer !== null
      ) {
        window.clearTimeout(
          timer,
        );
      }
    }

    function clearNatureTimers(
      runtime: NatureRuntime,
    ) {
      clearTimer(
        runtime.leafTimer,
      );

      clearTimer(
        runtime.insectTimer,
      );

      clearTimer(
        runtime.birdTimer,
      );

      runtime.leafTimer =
        null;

      runtime.insectTimer =
        null;

      runtime.birdTimer =
        null;
    }

    /*
     * 나뭇잎은 한 번의 "쉬익"이 아니라
     * 2~3번 작은 파동이 지나가도록 만들어
     * 바람에 수풀 전체가 흔들리는 느낌을 낸다.
     */
    function scheduleLeaves() {
      const runtime =
        runtimeRef.current;

      if (
        !runtime ||
        !runtime.isRunning
      ) {
        return;
      }

      runtime.leafTimer =
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

            const clusterStart =
              context.currentTime;

            /*
             * 긴 "쉬익-" 노이즈는 빗자루로 바닥을 쓸어 담는
             * 느낌이 날 수 있어 제거한다.
             *
             * 대신 짧은 잎사귀 충돌음을 여러 개 흩뿌려
             * 가까운 나뭇잎들이 서로 스치는 입체감을 만든다.
             */
            const rustleCount =
              Math.floor(
                randomBetween(
                  3,
                  7,
                ),
              );

            let lastStop =
              clusterStart;

            for (
              let index = 0;
              index < rustleCount;
              index += 1
            ) {
              const source =
                context.createBufferSource();

              source.buffer =
                whiteNoiseBuffer;

              const highpass =
                context.createBiquadFilter();

              highpass.type =
                "highpass";

              highpass.frequency.value =
                randomBetween(
                  1700,
                  2900,
                );

              const lowpass =
                context.createBiquadFilter();

              lowpass.type =
                "lowpass";

              lowpass.frequency.value =
                randomBetween(
                  5200,
                  8200,
                );

              const gain =
                context.createGain();

              const panner =
                context.createStereoPanner();

              const startAt =
                clusterStart +
                index *
                  randomBetween(
                    0.045,
                    0.13,
                  ) +
                randomBetween(
                  0,
                  0.055,
                );

              const duration =
                randomBetween(
                  0.055,
                  0.19,
                );

              const stopAt =
                startAt +
                duration;

              lastStop =
                Math.max(
                  lastStop,
                  stopAt,
                );

              const distanceScale =
                randomBetween(
                  0.45,
                  1,
                );

              const peak =
                randomBetween(
                  0.012,
                  0.034,
                ) *
                distanceScale;

              gain.gain.setValueAtTime(
                0.0001,
                startAt,
              );

              gain.gain.exponentialRampToValueAtTime(
                peak,
                startAt +
                  Math.min(
                    0.018,
                    duration *
                      0.25,
                  ),
              );

              gain.gain.exponentialRampToValueAtTime(
                0.0001,
                stopAt,
              );

              const startPan =
                randomBetween(
                  -0.95,
                  0.95,
                );

              const endPan =
                clamp(
                  startPan +
                    randomBetween(
                      -0.24,
                      0.24,
                    ),
                  -1,
                  1,
                );

              panner.pan.setValueAtTime(
                startPan,
                startAt,
              );

              panner.pan.linearRampToValueAtTime(
                endPan,
                stopAt,
              );

              source.connect(
                highpass,
              );

              highpass.connect(
                lowpass,
              );

              lowpass.connect(
                gain,
              );

              gain.connect(
                panner,
              );

              panner.connect(
                masterGain,
              );

              const maxOffset =
                Math.max(
                  0,
                  whiteNoiseBuffer.duration -
                    duration,
                );

              source.start(
                startAt,
                randomBetween(
                  0,
                  maxOffset,
                ),
                duration,
              );

              source.addEventListener(
                "ended",
                () => {
                  safeDisconnect(
                    source,
                  );

                  safeDisconnect(
                    highpass,
                  );

                  safeDisconnect(
                    lowpass,
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
            }

            scheduleLeaves();
          },
          randomBetween(
            900,
            3_800,
          ),
        );
    }

    /*
     * 풀벌레는 짧은 고음 하나를 반복하는 대신
     * 작은 무리 단위로 아주 약하게 등장한다.
     */
    function scheduleInsects() {
      const runtime =
        runtimeRef.current;

      if (
        !runtime ||
        !runtime.isRunning
      ) {
        return;
      }

      runtime.insectTimer =
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

            const baseStart =
              context.currentTime;

            const chirpCount =
              Math.floor(
                randomBetween(
                  2,
                  6,
                ),
              );

            const panner =
              context.createStereoPanner();

            panner.pan.value =
              randomBetween(
                -0.75,
                0.75,
              );

            panner.connect(
              masterGain,
            );

            let lastStop =
              baseStart;

            for (
              let index = 0;
              index < chirpCount;
              index += 1
            ) {
              const oscillator =
                context.createOscillator();

              oscillator.type =
                "sine";

              const gain =
                context.createGain();

              const startAt =
                baseStart +
                index *
                  randomBetween(
                    0.075,
                    0.135,
                  );

              const duration =
                randomBetween(
                  0.028,
                  0.07,
                );

              const stopAt =
                startAt +
                duration;

              lastStop =
                Math.max(
                  lastStop,
                  stopAt,
                );

              const frequency =
                randomBetween(
                  3900,
                  6200,
                );

              oscillator.frequency.setValueAtTime(
                frequency,
                startAt,
              );

              oscillator.frequency.exponentialRampToValueAtTime(
                frequency *
                  randomBetween(
                    0.96,
                    1.05,
                  ),
                stopAt,
              );

              const peak =
                randomBetween(
                  0.0022,
                  0.006,
                );

              gain.gain.setValueAtTime(
                0.0001,
                startAt,
              );

              gain.gain.exponentialRampToValueAtTime(
                peak,
                startAt +
                  0.006,
              );

              gain.gain.exponentialRampToValueAtTime(
                0.0001,
                stopAt,
              );

              oscillator.connect(
                gain,
              );

              gain.connect(
                panner,
              );

              oscillator.start(
                startAt,
              );

              oscillator.stop(
                stopAt +
                  0.01,
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
                },
                {
                  once: true,
                },
              );
            }

            window.setTimeout(
              () => {
                safeDisconnect(
                  panner,
                );
              },
              Math.max(
                100,
                (
                  lastStop -
                  context.currentTime
                ) *
                  1000 +
                  80,
              ),
            );

            scheduleInsects();
          },
          randomBetween(
            1_700,
            5_600,
          ),
        );
    }

    /*
     * 새소리는 매우 드물고 멀게.
     * 짧은 주파수 곡선을 몇 개 이어 붙여
     * 게임 효과음처럼 자주 들리지 않도록 한다.
     */
    function scheduleBirds() {
      const runtime =
        runtimeRef.current;

      if (
        !runtime ||
        !runtime.isRunning
      ) {
        return;
      }

      runtime.birdTimer =
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

            const phraseStart =
              context.currentTime;

            const panner =
              context.createStereoPanner();

            panner.pan.value =
              randomBetween(
                -0.95,
                0.95,
              );

            panner.connect(
              masterGain,
            );

            const noteCount =
              Math.floor(
                randomBetween(
                  2,
                  4,
                ),
              );

            let lastStop =
              phraseStart;

            for (
              let index = 0;
              index < noteCount;
              index += 1
            ) {
              const oscillator =
                context.createOscillator();

              oscillator.type =
                "sine";

              const gain =
                context.createGain();

              const vibrato =
                context.createOscillator();

              vibrato.type =
                "sine";

              vibrato.frequency.value =
                randomBetween(
                  6,
                  11,
                );

              const vibratoGain =
                context.createGain();

              vibratoGain.gain.value =
                randomBetween(
                  18,
                  42,
                );

              const startAt =
                phraseStart +
                index *
                  randomBetween(
                    0.16,
                    0.27,
                  );

              const duration =
                randomBetween(
                  0.13,
                  0.22,
                );

              const stopAt =
                startAt +
                duration;

              lastStop =
                Math.max(
                  lastStop,
                  stopAt,
                );

              const baseFrequency =
                randomBetween(
                  1350,
                  2200,
                );

              oscillator.frequency.setValueAtTime(
                baseFrequency,
                startAt,
              );

              oscillator.frequency.exponentialRampToValueAtTime(
                baseFrequency *
                  randomBetween(
                    1.22,
                    1.5,
                  ),
                startAt +
                  duration *
                    0.45,
              );

              oscillator.frequency.exponentialRampToValueAtTime(
                baseFrequency *
                  randomBetween(
                    0.94,
                    1.08,
                  ),
                stopAt,
              );

              const peak =
                randomBetween(
                  0.008,
                  0.018,
                );

              gain.gain.setValueAtTime(
                0.0001,
                startAt,
              );

              gain.gain.exponentialRampToValueAtTime(
                peak,
                startAt +
                  0.025,
              );

              gain.gain.exponentialRampToValueAtTime(
                0.0001,
                stopAt,
              );

              vibrato.connect(
                vibratoGain,
              );

              vibratoGain.connect(
                oscillator.frequency,
              );

              oscillator.connect(
                gain,
              );

              gain.connect(
                panner,
              );

              vibrato.start(
                startAt,
              );

              oscillator.start(
                startAt,
              );

              vibrato.stop(
                stopAt +
                  0.02,
              );

              oscillator.stop(
                stopAt +
                  0.02,
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
                    vibrato,
                  );

                  safeDisconnect(
                    vibratoGain,
                  );
                },
                {
                  once: true,
                },
              );
            }

            window.setTimeout(
              () => {
                safeDisconnect(
                  panner,
                );
              },
              Math.max(
                180,
                (
                  lastStop -
                  context.currentTime
                ) *
                  1000 +
                  120,
              ),
            );

            scheduleBirds();
          },
          randomBetween(
            18_000,
            48_000,
          ),
        );
    }

    function createRuntime() {
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

      const runtime:
        NatureRuntime = {
          context,
          masterGain,

          brownNoiseBuffer:
            createBrownNoiseBuffer(
              context,
              6,
            ),

          whiteNoiseBuffer:
            createWhiteNoiseBuffer(
              context,
              5,
            ),

          windSource:
            null,

          windHighpass:
            null,

          windLowpass:
            null,

          windGain:
            null,

          windAmplitudeLfo:
            null,

          windAmplitudeLfoGain:
            null,

          windFilterLfo:
            null,

          windFilterLfoGain:
            null,

          canopySource:
            null,

          canopyHighpass:
            null,

          canopyLowpass:
            null,

          canopyGain:
            null,

          canopyLfo:
            null,

          canopyLfoGain:
            null,

          leafTimer:
            null,

          insectTimer:
            null,

          birdTimer:
            null,

          isRunning:
            false,
        };

      runtimeRef.current =
        runtime;

      return runtime;
    }

    async function startNature() {
      if (
        cancelled ||
        !enabled
      ) {
        return;
      }

      const runtime =
        runtimeRef.current ??
        createRuntime();

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
       * 1. 산들바람층.
       *
       * 저역의 둔탁한 노이즈를 줄이고 중저역 공기 흐름을 살려
       * 바닥을 쓸어내는 소리가 아니라 나무 사이로 지나가는
       * 부드러운 바람처럼 들리게 한다.
       */
      const windSource =
        context.createBufferSource();

      windSource.buffer =
        brownNoiseBuffer;

      windSource.loop =
        true;

      const windHighpass =
        context.createBiquadFilter();

      windHighpass.type =
        "highpass";

      windHighpass.frequency.value =
        95;

      const windLowpass =
        context.createBiquadFilter();

      windLowpass.type =
        "lowpass";

      windLowpass.frequency.value =
        1650;

      windLowpass.Q.value =
        0.22;

    const windGain =
  context.createGain();

windGain.gain.value =
  0.05;

/*
 * 바람 세기가 일정하지 않도록
 * 아주 천천히 출렁인다.
 */
const windAmplitudeLfo =
  context.createOscillator();

windAmplitudeLfo.type =
  "sine";

windAmplitudeLfo.frequency.value =
  randomBetween(
    0.035,
    0.055,
  );

const windAmplitudeLfoGain =
  context.createGain();

windAmplitudeLfoGain.gain.value =
  0.014;


      windAmplitudeLfo.connect(
        windAmplitudeLfoGain,
      );

      windAmplitudeLfoGain.connect(
        windGain.gain,
      );

      /*
       * 바람의 밝기도 천천히 바뀌어
       * 같은 노이즈가 반복되는 느낌을 줄인다.
       */
      const windFilterLfo =
        context.createOscillator();

      windFilterLfo.type =
        "sine";

      windFilterLfo.frequency.value =
        randomBetween(
          0.018,
          0.032,
        );

      const windFilterLfoGain =
        context.createGain();

      windFilterLfoGain.gain.value =
        310;

      windFilterLfo.connect(
        windFilterLfoGain,
      );

      windFilterLfoGain.connect(
        windLowpass.frequency,
      );

      windSource.connect(
        windHighpass,
      );

      windHighpass.connect(
        windLowpass,
      );

      windLowpass.connect(
        windGain,
      );

      windGain.connect(
        masterGain,
      );

      /*
       * 2. 아주 먼 수관의 공기층.
       *
       * 연속 백색 노이즈가 빗자루 소리처럼 들리지 않도록
       * 존재감은 크게 낮추고, 높은 대역의 얇은 공기감만 남긴다.
       * 실제 잎사귀 부딪힘은 scheduleLeaves()의 짧은 입체 음향이 담당한다.
       */
      const canopySource =
        context.createBufferSource();

      canopySource.buffer =
        whiteNoiseBuffer;

      canopySource.loop =
        true;

      const canopyHighpass =
        context.createBiquadFilter();

      canopyHighpass.type =
        "highpass";

      canopyHighpass.frequency.value =
        2800;

      const canopyLowpass =
        context.createBiquadFilter();

      canopyLowpass.type =
        "lowpass";

      canopyLowpass.frequency.value =
        7600;

      const canopyGain =
        context.createGain();

      canopyGain.gain.value =
        0.0035;

      const canopyLfo =
        context.createOscillator();

      canopyLfo.type =
        "sine";

      canopyLfo.frequency.value =
        randomBetween(
          0.045,
          0.075,
        );

      const canopyLfoGain =
        context.createGain();

      canopyLfoGain.gain.value =
        0.0018;

      canopyLfo.connect(
        canopyLfoGain,
      );

      canopyLfoGain.connect(
        canopyGain.gain,
      );

      canopySource.connect(
        canopyHighpass,
      );

      canopyHighpass.connect(
        canopyLowpass,
      );

      canopyLowpass.connect(
        canopyGain,
      );

      canopyGain.connect(
        masterGain,
      );

      runtime.windSource =
        windSource;

      runtime.windHighpass =
        windHighpass;

      runtime.windLowpass =
        windLowpass;

      runtime.windGain =
        windGain;

      runtime.windAmplitudeLfo =
        windAmplitudeLfo;

      runtime.windAmplitudeLfoGain =
        windAmplitudeLfoGain;

      runtime.windFilterLfo =
        windFilterLfo;

      runtime.windFilterLfoGain =
        windFilterLfoGain;

      runtime.canopySource =
        canopySource;

      runtime.canopyHighpass =
        canopyHighpass;

      runtime.canopyLowpass =
        canopyLowpass;

      runtime.canopyGain =
        canopyGain;

      runtime.canopyLfo =
        canopyLfo;

      runtime.canopyLfoGain =
        canopyLfoGain;

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
          volumeRef.current,
        ),
        now +
          FADE_IN_SECONDS,
      );

      windSource.start();

      canopySource.start();

      windAmplitudeLfo.start();

      windFilterLfo.start();

      canopyLfo.start();

      scheduleLeaves();

      scheduleInsects();

      scheduleBirds();
    }

    function stopRuntime(
      runtime: NatureRuntime,
      closeContext: boolean,
    ) {
      runtime.isRunning =
        false;

      clearNatureTimers(
        runtime,
      );

      safeStop(
        runtime.windSource,
      );

      safeStop(
        runtime.windAmplitudeLfo,
      );

      safeStop(
        runtime.windFilterLfo,
      );

      safeStop(
        runtime.canopySource,
      );

      safeStop(
        runtime.canopyLfo,
      );

      safeDisconnect(
        runtime.windSource,
      );

      safeDisconnect(
        runtime.windHighpass,
      );

      safeDisconnect(
        runtime.windLowpass,
      );

      safeDisconnect(
        runtime.windGain,
      );

      safeDisconnect(
        runtime.windAmplitudeLfo,
      );

      safeDisconnect(
        runtime.windAmplitudeLfoGain,
      );

      safeDisconnect(
        runtime.windFilterLfo,
      );

      safeDisconnect(
        runtime.windFilterLfoGain,
      );

      safeDisconnect(
        runtime.canopySource,
      );

      safeDisconnect(
        runtime.canopyHighpass,
      );

      safeDisconnect(
        runtime.canopyLowpass,
      );

      safeDisconnect(
        runtime.canopyGain,
      );

      safeDisconnect(
        runtime.canopyLfo,
      );

      safeDisconnect(
        runtime.canopyLfoGain,
      );

      runtime.windSource =
        null;

      runtime.windHighpass =
        null;

      runtime.windLowpass =
        null;

      runtime.windGain =
        null;

      runtime.windAmplitudeLfo =
        null;

      runtime.windAmplitudeLfoGain =
        null;

      runtime.windFilterLfo =
        null;

      runtime.windFilterLfoGain =
        null;

      runtime.canopySource =
        null;

      runtime.canopyHighpass =
        null;

      runtime.canopyLowpass =
        null;

      runtime.canopyGain =
        null;

      runtime.canopyLfo =
        null;

      runtime.canopyLfoGain =
        null;

      if (closeContext) {
        safeDisconnect(
          runtime.masterGain,
        );

        void runtime.context.close();
      }
    }

    function fadeOutAndStop(
      runtime: NatureRuntime,
    ) {
      if (
        !runtime.isRunning
      ) {
        return;
      }

      runtime.isRunning =
        false;

      clearNatureTimers(
        runtime,
      );

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
        now +
          FADE_OUT_SECONDS,
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

          stopRuntime(
            currentRuntime,
            false,
          );
        },
        (
          FADE_OUT_SECONDS *
          1000
        ) +
          100,
      );
    }

    function handleUserGesture() {
      if (!enabled) {
        return;
      }

      void startNature().catch(
        () => {},
      );
    }

    window.addEventListener(
      "pointerdown",
      handleUserGesture,
    );

    window.addEventListener(
      "keydown",
      handleUserGesture,
    );

    if (enabled) {
      void startNature().catch(
        () => {
          /*
           * 브라우저 자동재생 정책에 막힌 경우
           * 첫 키 입력 또는 클릭에서 다시 시작한다.
           */
        },
      );
    } else {
      const runtime =
        runtimeRef.current;

      if (runtime) {
        fadeOutAndStop(
          runtime,
        );
      }
    }

    return () => {
      cancelled =
        true;

      window.removeEventListener(
        "pointerdown",
        handleUserGesture,
      );

      window.removeEventListener(
        "keydown",
        handleUserGesture,
      );

      const runtime =
        runtimeRef.current;

      if (!runtime) {
        return;
      }

      stopRuntime(
        runtime,
        true,
      );

      runtimeRef.current =
        null;
    };
  }, [
    enabled,
  ]);

  /*
   * 설정에서 볼륨을 바꾸면
   * 현재 자연음 전체가 부드럽게 따라간다.
   */
  useEffect(() => {
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
        volumeRef.current,
      ),
      now +
        0.18,
    );
  }, [
    volume,
  ]);

  return null;
}

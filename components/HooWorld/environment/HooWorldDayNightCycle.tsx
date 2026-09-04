"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type DayPhase =
  | "day"
  | "dusk"
  | "night"
  | "dawn";

type CycleVisual = {
  phase: DayPhase;
  cycleMinute: number;
  ready: boolean;

  darkness: number;
  warmth: number;
  moonlight: number;
  lightStrength: number;

  tintR: number;
  tintG: number;
  tintB: number;
  tintOpacity: number;

  sunsetOpacity: number;
  blueHourOpacity: number;
  vignetteOpacity: number;
};

type VisualKeyframe = Omit<
  CycleVisual,
  "phase" | "cycleMinute" | "ready"
>;

type CampfireRevealArea = {
  left: number;
  top: number;
  radiusX: number;
  radiusY: number;
  isBurning: boolean;
};

const CYCLE_MINUTES = 30;
const CYCLE_MS =
  CYCLE_MINUTES * 60 * 1000;

/*
 * HOO WORLD의 공용 시간대.
 *
 * 이용자의 PC / 브라우저 지역 설정과 무관하게
 * 모든 이용자가 Asia/Seoul(KST, UTC+9)을 기준으로
 * 같은 낮 / 저녁 / 밤 / 새벽을 보도록 한다.
 */
const HOO_WORLD_KST_OFFSET_MS =
  9 * 60 * 60 * 1000;

const WORLD_CLOCK_RESYNC_MS =
  60 * 1000;

/*
 * 각 시간대의 "중심" 색감.
 *
 * 현실시간 기준:
 * 00~10분  낮
 * 10~15분  저녁
 * 15~25분  밤
 * 25~30분  새벽
 *
 * 시각 효과는 경계에서 갑자기 바뀌지 않는다.
 * 아래 중심점 사이를 계속 보간해 하루 전체가 하나의 연속된 흐름이 된다.
 */
const DAY_KEYFRAME: VisualKeyframe = {
  darkness: 0,
  warmth: 0.04,
  moonlight: 0,
  lightStrength: 0.04,

  tintR: 255,
  tintG: 246,
  tintB: 214,
  tintOpacity: 0.025,

  sunsetOpacity: 0,
  blueHourOpacity: 0,
  vignetteOpacity: 0.015,
};

const DUSK_KEYFRAME: VisualKeyframe = {
  darkness: 0.18,
  warmth: 0.82,
  moonlight: 0.02,
  lightStrength: 0.28,

  tintR: 188,
  tintG: 91,
  tintB: 66,
  tintOpacity: 0.18,

  sunsetOpacity: 0.34,
  blueHourOpacity: 0.04,
  vignetteOpacity: 0.09,
};

const NIGHT_KEYFRAME: VisualKeyframe = {
  darkness: 0.8,
  warmth: 0.06,
  moonlight: 0.58,
  lightStrength: 1,

  tintR: 9,
  tintG: 20,
  tintB: 46,
  tintOpacity: 0.68,

  sunsetOpacity: 0,
  blueHourOpacity: 0.34,
  vignetteOpacity: 0.3,
};

const DAWN_KEYFRAME: VisualKeyframe = {
  darkness: 0.34,
  warmth: 0.12,
  moonlight: 0.2,
  lightStrength: 0.52,

  tintR: 67,
  tintG: 103,
  tintB: 151,
  tintOpacity: 0.3,

  sunsetOpacity: 0.05,
  blueHourOpacity: 0.32,
  vignetteOpacity: 0.12,
};

const DEFAULT_VISUAL: CycleVisual = {
  phase: "day",
  cycleMinute: 0,
  ready: false,
  ...DAY_KEYFRAME,
};

function clamp01(
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

/*
 * 선형 보간보다 시작/끝이 부드러운 곡선.
 * 시간대 중심을 지날 때도 색감의 "꺾임"이 느껴지지 않게 한다.
 */
function smootherStep(
  value: number,
) {
  const x =
    clamp01(
      value,
    );

  return (
    x *
    x *
    x *
    (
      x *
      (
        x * 6 -
        15
      ) +
      10
    )
  );
}

function lerp(
  from: number,
  to: number,
  progress: number,
) {
  return (
    from +
    (
      to -
      from
    ) *
      progress
  );
}

function interpolateVisual(
  from: VisualKeyframe,
  to: VisualKeyframe,
  progress: number,
): VisualKeyframe {
  const t =
    smootherStep(
      progress,
    );

  return {
    darkness:
      lerp(
        from.darkness,
        to.darkness,
        t,
      ),
    warmth:
      lerp(
        from.warmth,
        to.warmth,
        t,
      ),
    moonlight:
      lerp(
        from.moonlight,
        to.moonlight,
        t,
      ),
    lightStrength:
      lerp(
        from.lightStrength,
        to.lightStrength,
        t,
      ),

    tintR:
      lerp(
        from.tintR,
        to.tintR,
        t,
      ),
    tintG:
      lerp(
        from.tintG,
        to.tintG,
        t,
      ),
    tintB:
      lerp(
        from.tintB,
        to.tintB,
        t,
      ),
    tintOpacity:
      lerp(
        from.tintOpacity,
        to.tintOpacity,
        t,
      ),

    sunsetOpacity:
      lerp(
        from.sunsetOpacity,
        to.sunsetOpacity,
        t,
      ),
    blueHourOpacity:
      lerp(
        from.blueHourOpacity,
        to.blueHourOpacity,
        t,
      ),
    vignetteOpacity:
      lerp(
        from.vignetteOpacity,
        to.vignetteOpacity,
        t,
      ),
  };
}

function getPhase(
  cycleMinute: number,
): DayPhase {
  if (cycleMinute < 10) {
    return "day";
  }

  if (cycleMinute < 15) {
    return "dusk";
  }

  if (cycleMinute < 28) {
    return "night";
  }

  return "dawn";
}

/*
 * 시간대의 경계값을 직접 색상 변경점으로 사용하지 않고
 * 각 시간대의 "중앙"을 대표 색감의 정점으로 사용한다.
 *
 * 낮 중심    05:00
 * 저녁 중심  12:30
 * 밤 중심    20:00
 * 새벽 중심  27:30
 *
 * 27:30 이후에는 다음 주기의 낮 중심(35:00)까지 이어서 보간한다.
 * 따라서 30:00 -> 00:00으로 시간이 돌아가도 화면 색은 끊기지 않는다.
 */
function getVisualForCycleMinute(
  rawCycleMinute: number,
): CycleVisual {
  const cycleMinute =
    (
      (
        rawCycleMinute %
        CYCLE_MINUTES
      ) +
      CYCLE_MINUTES
    ) %
    CYCLE_MINUTES;

  const phase =
    getPhase(
      cycleMinute,
    );

  let visual:
    VisualKeyframe;

  /*
   * 00~10분
   * 완전한 낮.
   */
  if (cycleMinute < 10) {
    visual =
      DAY_KEYFRAME;
  }

  /*
   * 10~15분
   * 낮 → 노을 → 밤.
   *
   * 12.5분을 노을의 정점으로 사용한다.
   * 경계에서 갑자기 색이 바뀌지 않고
   * smootherStep 보간으로 계속 이어진다.
   */
  else if (
    cycleMinute < 12.5
  ) {
    visual =
      interpolateVisual(
        DAY_KEYFRAME,
        DUSK_KEYFRAME,
        (
          cycleMinute -
          10
        ) /
          2.5,
      );
  } else if (
    cycleMinute < 15
  ) {
    visual =
      interpolateVisual(
        DUSK_KEYFRAME,
        NIGHT_KEYFRAME,
        (
          cycleMinute -
          12.5
        ) /
          2.5,
      );
  }

  /*
   * 15~28분
   * 충분히 긴 밤.
   *
   * 이 구간에서는 깊은 밤 색감을 그대로 유지해서
   * 모닥불 / 랜턴 / 달빛이 안정적으로 살아난다.
   */
  else if (
    cycleMinute < 28
  ) {
    visual =
      NIGHT_KEYFRAME;
  }

  /*
   * 28~30분
   * 짧은 새벽.
   *
   * 28분에는 밤과 완전히 같은 색에서 시작하고,
   * 29분에 푸른 새벽,
   * 30분에 다시 낮까지 자연스럽게 연결한다.
   */
  else if (
    cycleMinute < 29
  ) {
    visual =
      interpolateVisual(
        NIGHT_KEYFRAME,
        DAWN_KEYFRAME,
        cycleMinute -
          28,
      );
  } else {
    visual =
      interpolateVisual(
        DAWN_KEYFRAME,
        DAY_KEYFRAME,
        cycleMinute -
          29,
      );
  }

  return {
    phase,
    cycleMinute,
    ready: true,
    ...visual,
  };
}

function getVisualForTime(
  nowMs: number,
): CycleVisual {
  /*
   * 절대시각을 KST로 이동한 뒤 30분 주기에 넣는다.
   *
   * 따라서 미국 / 일본 / 유럽 등 어디에서 접속해도
   * 브라우저의 로컬 타임존은 시간대 판정에 영향을 주지 않는다.
   */
  const kstNowMs =
    nowMs +
    HOO_WORLD_KST_OFFSET_MS;

  const cycleMinute =
    (
      (
        kstNowMs %
        CYCLE_MS
      ) +
      CYCLE_MS
    ) %
      CYCLE_MS /
    60_000;

  return getVisualForCycleMinute(
    cycleMinute,
  );
}

export default function HooWorldDayNightCycle() {
  /*
   * 브라우저 PC 시계가 몇 초 틀려 있어도
   * 모든 이용자가 같은 화면을 보도록 서버 시각과의 차이를 저장한다.
   *
   * 서버 시각을 못 가져오는 경우에는 0으로 유지되어
   * 기존 Date.now() 방식으로 안전하게 동작한다.
   */
  const serverClockOffsetRef =
    useRef(0);

  const [
    visual,
    setVisual,
  ] =
    useState<CycleVisual>(
      DEFAULT_VISUAL,
    );

  const [
    campfireRevealArea,
    setCampfireRevealArea,
  ] =
    useState<CampfireRevealArea>({
      left: -9999,
      top: -9999,
      radiusX: 0,
      radiusY: 0,
      isBurning: false,
    });

  const [
    campfireRevealStrength,
    setCampfireRevealStrength,
  ] =
    useState(0);

  const campfireRevealStrengthRef =
    useRef(0);

  /*
   * 모닥불의 실제 화면 위치와 연소 상태를 읽는다.
   *
   * 모닥불이 타는 동안 DAY / NIGHT 오버레이 자체를
   * 주변에서 걷어내기 위한 기준점이다.
   */
  useEffect(() => {
    function refreshCampfireRevealArea() {
      const campfireElement =
        document.querySelector<HTMLElement>(
          '[data-hoo-world-campfire="main-campfire"]',
        );

      if (!campfireElement) {
        setCampfireRevealArea(
          (current) =>
            current.isBurning
              ? {
                  ...current,
                  isBurning: false,
                }
              : current,
        );

        return;
      }

      const rect =
        campfireElement.getBoundingClientRect();

      const nextArea: CampfireRevealArea = {
        left:
          rect.left +
          rect.width /
            2,
        top:
          rect.top +
          rect.height *
            0.56,

        /*
         * 중심은 대낮처럼 깨끗하게,
         * 가장자리에서 밤 색감이 부드럽게 돌아오게 한다.
         */
        radiusX:
          Math.min(
            window.innerWidth *
              0.47,
            Math.max(
              360,
              rect.width *
                1.72,
            ),
          ),
        radiusY:
          Math.min(
            window.innerHeight *
              0.4,
            Math.max(
              230,
              rect.height *
                1.48,
            ),
          ),

        isBurning:
          campfireElement.dataset
            .hooWorldCampfireBurning ===
          "true",
      };

      setCampfireRevealArea(
        (current) => {
          if (
            Math.abs(
              current.left -
                nextArea.left,
            ) < 0.5 &&
            Math.abs(
              current.top -
                nextArea.top,
            ) < 0.5 &&
            Math.abs(
              current.radiusX -
                nextArea.radiusX,
            ) < 0.5 &&
            Math.abs(
              current.radiusY -
                nextArea.radiusY,
            ) < 0.5 &&
            current.isBurning ===
              nextArea.isBurning
          ) {
            return current;
          }

          return nextArea;
        },
      );
    }

    refreshCampfireRevealArea();

    const timer =
      window.setInterval(
        refreshCampfireRevealArea,
        120,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, []);

  /*
   * 모닥불 점화/소화 때 주변이 갑자기 뚫리지 않고
   * 약 0.9초 동안 자연스럽게 밝아지고 다시 어두워진다.
   */
  useEffect(() => {
    const from =
      campfireRevealStrengthRef.current;

    const to =
      campfireRevealArea.isBurning
        ? 1
        : 0;

    if (
      Math.abs(
        from -
          to,
      ) <
      0.001
    ) {
      campfireRevealStrengthRef.current =
        to;

      setCampfireRevealStrength(
        to,
      );

      return;
    }

    const startedAt =
      performance.now();

    const durationMs =
      900;

    let frameId:
      number | null =
      null;

    function animate(
      now: number,
    ) {
      const rawProgress =
        Math.max(
          0,
          Math.min(
            1,
            (
              now -
              startedAt
            ) /
              durationMs,
          ),
        );

      const easedProgress =
        smootherStep(
          rawProgress,
        );

      const nextValue =
        lerp(
          from,
          to,
          easedProgress,
        );

      campfireRevealStrengthRef.current =
        nextValue;

      setCampfireRevealStrength(
        nextValue,
      );

      if (
        rawProgress <
        1
      ) {
        frameId =
          window.requestAnimationFrame(
            animate,
          );
      }
    }

    frameId =
      window.requestAnimationFrame(
        animate,
      );

    return () => {
      if (
        frameId !==
        null
      ) {
        window.cancelAnimationFrame(
          frameId,
        );
      }
    };
  }, [
    campfireRevealArea.isBurning,
  ]);

  useEffect(() => {
    let cancelled = false;

    function getSynchronizedNow() {
      return (
        Date.now() +
        serverClockOffsetRef.current
      );
    }

    function updateCycle() {
      setVisual(
        getVisualForTime(
          getSynchronizedNow(),
        ),
      );
    }

    /*
     * 같은 HOO WORLD 서버의 Date 헤더를 이용해
     * 이용자 PC 시계와 서버 시계의 차이를 보정한다.
     *
     * 왕복시간의 절반 지점을 서버 응답 시각으로 추정해
     * 네트워크 지연으로 생길 수 있는 오차도 줄인다.
     */
    async function synchronizeWorldClock() {
      const requestStartedAt =
        Date.now();

      try {
        const syncUrl =
          `${window.location.pathname}?__hoo_world_time_sync=${requestStartedAt}`;

        const response =
          await fetch(
            syncUrl,
            {
              method: "HEAD",
              cache: "no-store",
            },
          );

        const serverDateHeader =
          response.headers.get(
            "date",
          );

        if (
          !serverDateHeader ||
          cancelled
        ) {
          return;
        }

        const serverTimeMs =
          Date.parse(
            serverDateHeader,
          );

        if (
          !Number.isFinite(
            serverTimeMs,
          )
        ) {
          return;
        }

        const requestFinishedAt =
          Date.now();

        const estimatedClientTimeAtServerResponse =
          requestStartedAt +
          (
            requestFinishedAt -
            requestStartedAt
          ) /
            2;

        serverClockOffsetRef.current =
          serverTimeMs -
          estimatedClientTimeAtServerResponse;

        updateCycle();
      } catch {
        /*
         * 네트워크 문제로 동기화가 실패해도
         * 로컬 절대시각 기반 사이클은 계속 유지한다.
         */
      }
    }

    updateCycle();

    void synchronizeWorldClock();

    /*
     * 화면 색감은 0.5초마다 같은 공용 시각에서 다시 계산한다.
     */
    const cycleInterval =
      window.setInterval(
        updateCycle,
        500,
      );

    /*
     * PC 시계 변경 / 장시간 접속 / 절전 복귀에도
     * 다른 이용자와 시간이 벌어지지 않도록 1분마다 재동기화한다.
     */
    const clockSyncInterval =
      window.setInterval(
        () => {
          void synchronizeWorldClock();
        },
        WORLD_CLOCK_RESYNC_MS,
      );

    return () => {
      cancelled = true;

      window.clearInterval(
        cycleInterval,
      );

      window.clearInterval(
        clockSyncInterval,
      );
    };
  }, []);

  /*
   * 앞으로 모닥불 / 랜턴 / 가로등 / 창문 등의 빛이
   * 현재 밤의 깊이에 맞춰 자동으로 강해질 수 있도록
   * 전역 CSS 변수를 제공한다.
   */
  useEffect(() => {
    const root =
      document.documentElement;

    root.style.setProperty(
      "--hoo-world-darkness",
      String(
        visual.darkness,
      ),
    );

    root.style.setProperty(
      "--hoo-world-warmth",
      String(
        visual.warmth,
      ),
    );

    root.style.setProperty(
      "--hoo-world-moonlight",
      String(
        visual.moonlight,
      ),
    );

    root.style.setProperty(
      "--hoo-world-light-strength",
      String(
        visual.lightStrength,
      ),
    );

    root.dataset.hooWorldDayPhase =
      visual.phase;

    return () => {
      root.style.removeProperty(
        "--hoo-world-darkness",
      );

      root.style.removeProperty(
        "--hoo-world-warmth",
      );

      root.style.removeProperty(
        "--hoo-world-moonlight",
      );

      root.style.removeProperty(
        "--hoo-world-light-strength",
      );

      delete root.dataset
        .hooWorldDayPhase;
    };
  }, [
    visual.darkness,
    visual.lightStrength,
    visual.moonlight,
    visual.phase,
    visual.warmth,
  ]);

  const tintColor =
    useMemo(
      () =>
        `rgba(${Math.round(
          visual.tintR,
        )}, ${Math.round(
          visual.tintG,
        )}, ${Math.round(
          visual.tintB,
        )}, ${visual.tintOpacity})`,
      [
        visual.tintB,
        visual.tintG,
        visual.tintOpacity,
        visual.tintR,
      ],
    );

  /*
   * 핵심:
   * 모닥불 주변에 밝은 색을 덧씌우는 것이 아니라
   * DAY / NIGHT 오버레이 자체에 투명한 구멍을 낸다.
   *
   * 그래서 밤에 모닥불을 켜면 바닥 / 캐릭터 / 장작 등의
   * 원래 밝고 깨끗한 색이 그대로 드러난다.
   */
  const campfireRevealMask =
    useMemo(
      () => {
        const reveal =
          clamp01(
            campfireRevealStrength,
          );

        const centerAlpha =
          clamp01(
            1 -
              reveal,
          );

        const innerAlpha =
          clamp01(
            1 -
              reveal *
                0.96,
          );

        const middleAlpha =
          clamp01(
            1 -
              reveal *
                0.68,
          );

        const outerAlpha =
          clamp01(
            1 -
              reveal *
                0.32,
          );

        return `radial-gradient(
          ellipse ${campfireRevealArea.radiusX}px ${campfireRevealArea.radiusY}px
          at ${campfireRevealArea.left}px ${campfireRevealArea.top}px,
          rgba(0, 0, 0, ${centerAlpha}) 0%,
          rgba(0, 0, 0, ${centerAlpha}) 46%,
          rgba(0, 0, 0, ${innerAlpha}) 58%,
          rgba(0, 0, 0, ${middleAlpha}) 72%,
          rgba(0, 0, 0, ${outerAlpha}) 88%,
          rgba(0, 0, 0, 1) 100%
        )`;
      },
      [
        campfireRevealArea.left,
        campfireRevealArea.radiusX,
        campfireRevealArea.radiusY,
        campfireRevealArea.top,
        campfireRevealStrength,
      ],
    );

  return (
      <div
    data-hoo-world-day-night-cycle="true"
      data-hoo-world-phase={
        visual.phase
      }
      className="pointer-events-none absolute inset-0 z-[35] overflow-hidden"
      style={{
        opacity:
          visual.ready
            ? 1
            : 0,
        transition:
          "opacity 1800ms ease",

        /*
         * 모닥불 주변에서는 밤/새벽/노을/달빛 필터 전체를 제거한다.
         * 이전의 "주변이 대낮처럼 깨끗하게 보이는" 상태를 복구한다.
         */
        WebkitMaskImage:
          campfireRevealMask,
        maskImage:
          campfireRevealMask,
      }}
      aria-hidden="true"
    >
      {/* 전체 시간대 색감 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor:
            tintColor,
          transition:
            "background-color 1200ms linear",
        }}
      />

      {/* 저녁 노을: 중앙~하단의 따뜻한 빛 */}
      <div
        className="absolute inset-0"
        style={{
          opacity:
            visual.sunsetOpacity,
          background:
            "linear-gradient(180deg, rgba(113,70,111,0.18) 0%, rgba(239,124,70,0.42) 47%, rgba(255,190,104,0.24) 72%, rgba(255,219,145,0.06) 100%)",
          transition:
            "opacity 1200ms linear",
        }}
      />

      {/* 밤/새벽의 푸른 공기감 */}
      <div
        className="absolute inset-0"
        style={{
          opacity:
            visual.blueHourOpacity,
          background:
            "linear-gradient(180deg, rgba(12,29,65,0.54) 0%, rgba(34,61,102,0.34) 55%, rgba(79,107,139,0.12) 100%)",
          transition:
            "opacity 1200ms linear",
        }}
      />

      {/* 달빛: 밤이 깊어질수록 우측 상단에서 아주 부드럽게 퍼진다. */}
      <div
        className="absolute inset-0"
        style={{
          opacity:
            visual.moonlight,
          background:
            "radial-gradient(circle at 78% 14%, rgba(220,232,255,0.24) 0%, rgba(173,201,255,0.09) 18%, rgba(121,158,223,0.035) 36%, transparent 62%)",
          transition:
            "opacity 1200ms linear",
        }}
      />

      {/* 밤의 가장자리 깊이감. 중앙 시야는 과하게 어둡히지 않는다. */}
      <div
        className="absolute inset-0"
        style={{
          opacity:
            visual.vignetteOpacity,
          background:
            "radial-gradient(circle at 50% 48%, transparent 38%, rgba(5,12,25,0.25) 72%, rgba(2,7,16,0.52) 100%)",
          transition:
            "opacity 1200ms linear",
        }}
      />
    </div>
  );
}

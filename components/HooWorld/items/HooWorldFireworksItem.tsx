"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  MutableRefObject,
} from "react";

export const HOO_WORLD_FIREWORKS_INTERACTION_DISTANCE_PX =
  120;

const HOO_WORLD_FIREWORKS_BAG_IGNITE_MS =
  1500;

const HOO_WORLD_FIREWORKS_BAG_POP_MS =
  260;

type HooWorldFireworksItemProps = {
  itemId: string;
  x: number;
  y: number;
  playerPositionRef: MutableRefObject<{
    x: number;
    y: number;
  }>;
  interactionLocked?: boolean;
};

function getPlayerDistancePx(
  playerPositionRef:
    HooWorldFireworksItemProps["playerPositionRef"],
  x: number,
  y: number,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const player =
    playerPositionRef.current;

  const deltaX =
    (
      player.x -
      x
    ) /
    100 *
    window.innerWidth;

  const deltaY =
    (
      player.y -
      y
    ) /
    100 *
    window.innerHeight;

  return Math.hypot(
    deltaX,
    deltaY,
  );
}

export default function HooWorldFireworksItem({
  itemId,
  x,
  y,
  playerPositionRef,
  interactionLocked = false,
}: HooWorldFireworksItemProps) {
  const [
    isNearby,
    setIsNearby,
  ] = useState(false);

  const [
    isIgniting,
    setIsIgniting,
  ] = useState(false);

  const [
    isPopping,
    setIsPopping,
  ] = useState(false);

  const igniteTimerRef =
    useRef<number | null>(
      null,
    );

  const popTimerRef =
    useRef<number | null>(
      null,
    );

  useEffect(() => {
    function refreshNearby() {
      const nextNearby =
        !interactionLocked &&
        getPlayerDistancePx(
          playerPositionRef,
          x,
          y,
        ) <=
          HOO_WORLD_FIREWORKS_INTERACTION_DISTANCE_PX;

      setIsNearby(
        nextNearby,
      );
    }

    refreshNearby();

    const timer =
      window.setInterval(
        refreshNearby,
        120,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    interactionLocked,
    playerPositionRef,
    x,
    y,
  ]);

  useEffect(() => {
    if (
      igniteTimerRef.current !==
      null
    ) {
      window.clearTimeout(
        igniteTimerRef.current,
      );

      igniteTimerRef.current =
        null;
    }

    if (
      popTimerRef.current !==
      null
    ) {
      window.clearTimeout(
        popTimerRef.current,
      );

      popTimerRef.current =
        null;
    }

    if (
      !interactionLocked
    ) {
      setIsIgniting(
        false,
      );

      setIsPopping(
        false,
      );

      return;
    }

    setIsIgniting(
      true,
    );

    setIsPopping(
      false,
    );

    igniteTimerRef.current =
      window.setTimeout(
        () => {
          setIsPopping(
            true,
          );
        },
        HOO_WORLD_FIREWORKS_BAG_IGNITE_MS,
      );

    popTimerRef.current =
      window.setTimeout(
        () => {
          setIsIgniting(
            false,
          );

          setIsPopping(
            false,
          );
        },
        HOO_WORLD_FIREWORKS_BAG_IGNITE_MS +
          HOO_WORLD_FIREWORKS_BAG_POP_MS,
      );

    return () => {
      if (
        igniteTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          igniteTimerRef.current,
        );

        igniteTimerRef.current =
          null;
      }

      if (
        popTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          popTimerRef.current,
        );

        popTimerRef.current =
          null;
      }
    };
  }, [
    interactionLocked,
  ]);

  const rockets = [
    {
      left: 12,
      top: 6,
      rotate: -8,
      body:
        "#d6535f",
      stripe:
        "#f5d78a",
      accent:
        "#fff4c8",
    },
    {
      left: 27,
      top: -2,
      rotate: -2,
      body:
        "#6f7fd8",
      stripe:
        "#f0d6ff",
      accent:
        "#f8f5ff",
    },
    {
      left: 42,
      top: 0,
      rotate: 4,
      body:
        "#db9c47",
      stripe:
        "#fff0a8",
      accent:
        "#fff8d8",
    },
    {
      left: 55,
      top: 8,
      rotate: 9,
      body:
        "#5e9f88",
      stripe:
        "#d9fff3",
      accent:
        "#effff9",
    },
  ] as const;

  return (
    <div
      data-hoo-world-fireworks-item="true"
      data-hoo-world-fireworks-item-id={
        itemId
      }
      data-hoo-world-fireworks-igniting={
        isIgniting
          ? "true"
          : "false"
      }
      className="relative h-full w-full"
      aria-label="후월드 불꽃놀이"
    >
      {isNearby ? (
        <div className="pointer-events-none absolute bottom-[calc(100%+28px)] left-1/2 z-[8] -translate-x-1/2 whitespace-nowrap rounded-full border border-[#f4dfac]/55 bg-[#17182a]/94 px-3 py-1.5 text-[10px] font-black text-[#fff8e8] shadow-[0_7px_18px_rgba(10,10,20,0.34)] backdrop-blur-sm">
          <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-[#ffe8a5]/55 bg-[#f1d484] px-1 text-[10px] text-[#2b2630] shadow-[0_2px_5px_rgba(22,18,24,0.22)]">
            F
          </span>
          점화
        </div>
      ) : null}

      <div
        data-hoo-world-collision-anchor="true"
        className="pointer-events-none absolute bottom-[2px] left-1/2 h-[12px] w-[60px] -translate-x-1/2"
      />

      {/* 바닥 그림자 */}
      <div
        className="pointer-events-none absolute bottom-[-4px] left-1/2 h-[12px] w-[66px] -translate-x-1/2 rounded-[50%] bg-[#121625]/22 blur-[4px]"
        style={{
          opacity:
            isPopping
              ? 0
              : 1,
          transition:
            "opacity 180ms ease-out",
        }}
      />

      {/* 점화 시 가방 아래에서 직접 불이 붙는다. */}
      {isIgniting ? (
        <>
          {/* 바닥 열기 */}
          <div className="pointer-events-none absolute bottom-[1px] left-1/2 z-[2] h-[18px] w-[56px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(circle_at_center,rgba(255,239,176,0.72)_0%,rgba(255,164,69,0.52)_30%,rgba(255,91,45,0.25)_55%,rgba(255,91,45,0)_78%)] blur-[1px]" />

          {/* 불꽃 */}
          {[
            {
              left: "28%",
              height: 11,
              delay: "0ms",
              duration: "420ms",
            },
            {
              left: "39%",
              height: 15,
              delay: "90ms",
              duration: "500ms",
            },
            {
              left: "50%",
              height: 18,
              delay: "40ms",
              duration: "470ms",
            },
            {
              left: "61%",
              height: 14,
              delay: "140ms",
              duration: "520ms",
            },
            {
              left: "72%",
              height: 10,
              delay: "210ms",
              duration: "460ms",
            },
          ].map(
            (
              flame,
              index,
            ) => (
              <span
                key={
                  `hoo-world-fireworks-case-flame-${index}`
                }
                className="pointer-events-none absolute bottom-[5px] z-[3] w-[10px] -translate-x-1/2 rounded-full"
                style={{
                  left:
                    flame.left,
                  height:
                    `${flame.height}px`,
                  background:
                    "linear-gradient(to top, rgba(255,91,42,0.96) 0%, rgba(255,171,66,0.98) 55%, rgba(255,246,200,0.88) 100%)",
                  boxShadow:
                    "0 0 7px rgba(255,156,71,0.42)",
                  animation:
                    `hooWorldFireworksCaseFlame ${flame.duration} ease-in-out ${flame.delay} infinite`,
                }}
              />
            ),
          )}

          {/* 치지지직 튀는 스파크 */}
          {[
            {
              left: "31%",
              drift: -7,
              delay: "0ms",
              duration: "560ms",
            },
            {
              left: "39%",
              drift: 5,
              delay: "120ms",
              duration: "620ms",
            },
            {
              left: "47%",
              drift: -4,
              delay: "250ms",
              duration: "540ms",
            },
            {
              left: "54%",
              drift: 7,
              delay: "70ms",
              duration: "650ms",
            },
            {
              left: "62%",
              drift: -6,
              delay: "190ms",
              duration: "600ms",
            },
            {
              left: "69%",
              drift: 4,
              delay: "320ms",
              duration: "690ms",
            },
            {
              left: "43%",
              drift: 8,
              delay: "390ms",
              duration: "580ms",
            },
            {
              left: "58%",
              drift: -8,
              delay: "430ms",
              duration: "660ms",
            },
          ].map(
            (
              spark,
              index,
            ) => (
              <span
                key={
                  `hoo-world-fireworks-case-spark-${index}`
                }
                className="pointer-events-none absolute bottom-[11px] z-[6] h-[4px] w-[4px] rounded-full"
                style={{
                  left:
                    spark.left,
                  backgroundColor:
                    index % 2 ===
                    0
                      ? "#fff4bd"
                      : "#ffbe62",
                  boxShadow:
                    "0 0 6px rgba(255,211,126,0.78)",
                  animation:
                    `hooWorldFireworksCaseSpark ${spark.duration} linear ${spark.delay} infinite`,
                  ["--hoo-fireworks-spark-drift" as string]:
                    `${spark.drift}px`,
                }}
              />
            ),
          )}

          {/* 아주 약한 연기 */}
          {[
            {
              left: "37%",
              delay: "0ms",
            },
            {
              left: "51%",
              delay: "260ms",
            },
            {
              left: "64%",
              delay: "130ms",
            },
          ].map(
            (
              smoke,
              index,
            ) => (
              <span
                key={
                  `hoo-world-fireworks-case-smoke-${index}`
                }
                className="pointer-events-none absolute bottom-[13px] z-[2] h-[13px] w-[13px] rounded-full bg-[#d7d4dc]/34 blur-[1px]"
                style={{
                  left:
                    smoke.left,
                  animation:
                    `hooWorldFireworksCaseSmoke 1.3s ease-out ${smoke.delay} infinite`,
                }}
              />
            ),
          )}
        </>
      ) : null}

      {/* 가방 본체 */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-[5]"
        style={{
          transform:
            isPopping
              ? "translate(-50%, -50%) scale(1.26)"
              : isIgniting
                ? undefined
                : "translate(-50%, -50%) scale(1)",
          opacity:
            isPopping
              ? 0
              : 1,
          animation:
            isIgniting &&
            !isPopping
              ? "hooWorldFireworksCaseInflate 1.5s cubic-bezier(0.25,0.72,0.2,1) both"
              : undefined,
          transition:
            isPopping
              ? "transform 190ms cubic-bezier(0.16,1,0.3,1), opacity 160ms ease-out"
              : undefined,
        }}
      >
        <div className="relative h-[72px] w-[84px]">
          {/* 열린 뒷판 */}
          <div className="absolute bottom-[31px] left-1/2 h-[25px] w-[66px] -translate-x-1/2 -rotate-[2deg] overflow-hidden rounded-[7px_7px_4px_4px] border border-[#14182a]/80 bg-gradient-to-b from-[#333653] via-[#242944] to-[#171b31] shadow-[0_4px_8px_rgba(14,16,28,0.28)]">
            <span className="absolute inset-x-[5px] top-[5px] h-[1px] rounded-full bg-[#f1d999]/24" />

            <span className="absolute left-[11px] top-[9px] h-[7px] w-[7px] rounded-full border border-[#e6c875]/70" />
            <span className="absolute left-[14px] top-[5px] h-[5px] w-[1px] bg-[#e6c875]/55" />
            <span className="absolute left-[14px] top-[16px] h-[5px] w-[1px] bg-[#e6c875]/55" />
            <span className="absolute left-[6px] top-[12px] h-[1px] w-[5px] bg-[#e6c875]/55" />
            <span className="absolute left-[18px] top-[12px] h-[1px] w-[5px] bg-[#e6c875]/55" />

            <span className="absolute right-[11px] top-[9px] h-[7px] w-[7px] rounded-full border border-[#e6c875]/70" />
            <span className="absolute right-[14px] top-[5px] h-[5px] w-[1px] bg-[#e6c875]/55" />
            <span className="absolute right-[14px] top-[16px] h-[5px] w-[1px] bg-[#e6c875]/55" />
            <span className="absolute right-[6px] top-[12px] h-[1px] w-[5px] bg-[#e6c875]/55" />
            <span className="absolute right-[18px] top-[12px] h-[1px] w-[5px] bg-[#e6c875]/55" />

            <span className="absolute bottom-[2px] left-[7px] right-[7px] h-[7px] rounded-[3px] bg-[#661f2a]/42" />
          </div>

          {/* 로켓 묶음 */}
          {rockets.map(
            (
              rocket,
              index,
            ) => (
              <div
                key={
                  `hoo-world-fireworks-rocket-${index}`
                }
                className="absolute h-[46px] w-[11px] origin-bottom drop-shadow-[0_3px_3px_rgba(17,15,22,0.22)]"
                style={{
                  left:
                    rocket.left,
                  top:
                    rocket.top,
                  transform:
                    `rotate(${rocket.rotate}deg)`,
                }}
              >
                <span
                  className="absolute left-1/2 top-0 h-[12px] w-[11px] -translate-x-1/2 [clip-path:polygon(50%_0%,100%_100%,0%_100%)]"
                  style={{
                    background:
                      `linear-gradient(to bottom, ${rocket.accent}, ${rocket.stripe})`,
                  }}
                />

                <span
                  className="absolute left-1/2 top-[10px] h-[27px] w-[9px] -translate-x-1/2 overflow-hidden rounded-[3px_3px_2px_2px] border border-black/15"
                  style={{
                    background:
                      `linear-gradient(to bottom, ${rocket.body}, ${rocket.body} 72%, #2a2940 72%)`,
                  }}
                >
                  <span
                    className="absolute left-0 right-0 top-[7px] h-[3px]"
                    style={{
                      backgroundColor:
                        rocket.stripe,
                    }}
                  />
                  <span className="absolute left-[2px] top-[13px] h-[5px] w-[1px] rounded-full bg-white/24" />
                </span>

                <span className="absolute bottom-[-2px] left-1/2 h-[13px] w-[2px] -translate-x-1/2 rounded-full bg-[#b88b5d]" />
              </div>
            ),
          )}

          {/* 가방 몸통 */}
          <div className="absolute bottom-[3px] left-1/2 h-[39px] w-[66px] -translate-x-1/2 overflow-hidden rounded-[7px] border border-[#0f1428]/80 bg-gradient-to-b from-[#303650] via-[#222740] to-[#161b31] shadow-[0_8px_12px_rgba(16,17,29,0.32)]">
            <span className="absolute left-0 right-0 top-0 h-[4px] bg-gradient-to-b from-[#59617d]/50 to-transparent" />

            <span className="absolute bottom-0 left-[7px] top-0 w-[6px] bg-gradient-to-b from-[#bc3d4b] via-[#8e2937] to-[#6b1f2b]" />
            <span className="absolute bottom-0 right-[7px] top-0 w-[6px] bg-gradient-to-b from-[#bc3d4b] via-[#8e2937] to-[#6b1f2b]" />

            <span className="absolute bottom-[5px] left-[3px] top-[5px] w-[1px] bg-[#e3c777]/46" />
            <span className="absolute bottom-[5px] right-[3px] top-[5px] w-[1px] bg-[#e3c777]/46" />

            <div className="absolute left-1/2 top-[10px] flex h-[19px] min-w-[42px] -translate-x-1/2 flex-col items-center justify-center rounded-[4px] border border-[#e6c875]/60 bg-[#171a2d]/92 px-[5px] shadow-[0_3px_7px_rgba(8,10,19,0.28)]">
              <span className="text-[6px] font-black tracking-[0.17em] text-[#f4dda0]">
                HOO
              </span>
              <span className="mt-[1px] text-[4px] font-black tracking-[0.12em] text-[#e7858e]">
                HANABI
              </span>
            </div>

            <span className="absolute bottom-[5px] left-[18px] right-[18px] h-[1px] rounded-full bg-[#e2c36e]/55" />
          </div>

          {/* 잠금 장치 */}
          <div className="absolute bottom-[1px] left-1/2 h-[8px] w-[13px] -translate-x-1/2 rounded-[2px] border border-[#8a6b2d]/55 bg-gradient-to-b from-[#f1d885] to-[#a67b33] shadow-[0_2px_3px_rgba(20,18,18,0.18)]">
            <span className="absolute left-1/2 top-[2px] h-[2px] w-[3px] -translate-x-1/2 rounded-full bg-[#5e4921]/70" />
          </div>

          {/* 짧은 심지 */}
          <div className="absolute right-[7px] top-[26px] h-[13px] w-[12px]">
            <span className="absolute right-[2px] top-[1px] h-[10px] w-[7px] rotate-[24deg] rounded-full border-r-[2px] border-[#d4b16e]/85" />
            <span
              className="absolute right-0 top-0 h-[3px] w-[3px] rounded-full bg-[#f4d786]"
              style={{
                boxShadow:
                  isIgniting
                    ? "0 0 9px rgba(255,214,111,0.96)"
                    : "0 0 5px rgba(244,215,134,0.45)",
                animation:
                  isIgniting
                    ? "hooWorldFireworksFuseBlink 240ms ease-in-out infinite"
                    : undefined,
              }}
            />
          </div>
        </div>
      </div>

      {/* 가방이 뿅 하고 사라질 때의 작은 팝 */}
      {isPopping ? (
        <>
          <div className="pointer-events-none absolute left-1/2 top-[38px] z-[9] h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ffebb5]/60 bg-[radial-gradient(circle_at_center,rgba(255,248,221,0.64)_0%,rgba(255,218,137,0.28)_36%,rgba(255,218,137,0)_68%)] [animation:hooWorldFireworksCasePop_220ms_ease-out_forwards]" />

          {Array.from({
            length: 10,
          }).map(
            (
              _,
              index,
            ) => (
              <span
                key={
                  `hoo-world-fireworks-case-pop-ray-${index}`
                }
                className="pointer-events-none absolute left-1/2 top-[38px] z-[10] h-[2px] w-[18px] origin-left -translate-y-1/2 rounded-full bg-[#fff0b9] [animation:hooWorldFireworksCasePopRay_220ms_ease-out_forwards]"
                style={{
                  transform:
                    `translateY(-50%) rotate(${index * 36}deg)`,
                  boxShadow:
                    "0 0 6px rgba(255,225,152,0.72)",
                }}
              />
            ),
          )}
        </>
      ) : null}

      <style jsx>{`
        @keyframes hooWorldFireworksCaseFlame {
          0% {
            transform: translateX(-50%) scaleX(0.9) scaleY(0.78);
            opacity: 0.76;
          }

          45% {
            transform: translateX(-50%) translateY(-3px) scaleX(1.08) scaleY(1.2);
            opacity: 1;
          }

          100% {
            transform: translateX(-50%) scaleX(0.94) scaleY(0.84);
            opacity: 0.78;
          }
        }

        @keyframes hooWorldFireworksCaseSpark {
          0% {
            transform: translate3d(0, 0, 0) scale(0.5);
            opacity: 0;
          }

          12% {
            opacity: 1;
          }

          100% {
            transform: translate3d(
              var(--hoo-fireworks-spark-drift),
              -25px,
              0
            ) scale(0.15);
            opacity: 0;
          }
        }

        @keyframes hooWorldFireworksCaseSmoke {
          0% {
            transform: translate3d(0, 0, 0) scale(0.7);
            opacity: 0;
          }

          18% {
            opacity: 0.4;
          }

          100% {
            transform: translate3d(-4px, -23px, 0) scale(1.5);
            opacity: 0;
          }
        }

        @keyframes hooWorldFireworksCaseInflate {
          0% {
            transform: translate(-50%, -50%) scale(1);
          }

          20% {
            transform: translate(-50%, -50%) scale(1.02, 0.99);
          }

          38% {
            transform: translate(-50%, -50%) scale(1.04, 1.015);
          }

          56% {
            transform: translate(-50%, -50%) scale(1.065, 1.035);
          }

          74% {
            transform: translate(-50%, -50%) scale(1.085, 1.055);
          }

          88% {
            transform: translate(-50%, -50%) scale(1.11, 1.075);
          }

          100% {
            transform: translate(-50%, -50%) scale(1.14, 1.095);
          }
        }

        @keyframes hooWorldFireworksFuseBlink {
          0%,
          100% {
            transform: scale(0.86);
            opacity: 0.8;
          }

          50% {
            transform: scale(1.28);
            opacity: 1;
          }
        }

        @keyframes hooWorldFireworksCasePop {
          0% {
            transform: translate(-50%, -50%) scale(0.28);
            opacity: 0.95;
          }

          100% {
            transform: translate(-50%, -50%) scale(1.55);
            opacity: 0;
          }
        }

        @keyframes hooWorldFireworksCasePopRay {
          0% {
            width: 5px;
            opacity: 0.92;
          }

          100% {
            width: 26px;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

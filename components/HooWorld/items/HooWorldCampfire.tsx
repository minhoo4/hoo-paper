"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createPortal,
} from "react-dom";

import useHooWorldCampfireAudio from "@/components/HooWorld/hooks/useHooWorldCampfireAudio";
import {
  createClient,
} from "@/lib/supabase/client";

type HooWorldCampfireProps = {
  onBeforeUse?: () => void;
};

type CampfireRow = {
  campfire_id: string;
  burn_until: string | null;
  revision: number;
};

const CAMPFIRE_ID =
  "main-campfire";

const FIREWOOD_USE_RADIUS_PX =
  270;

const PLAYER_INTERACTION_RADIUS_PX =
  185;

function isEditableTarget(
  target: EventTarget | null,
) {
  if (
    !(target instanceof HTMLElement)
  ) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

function parseCampfireRow(
  value: unknown,
): CampfireRow | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  const campfireId =
    typeof row.campfire_id ===
    "string"
      ? row.campfire_id
      : "";

  const burnUntil =
    typeof row.burn_until ===
    "string"
      ? row.burn_until
      : null;

  const revision =
    Number(
      row.revision ?? 0,
    );

  if (
    !campfireId ||
    !Number.isFinite(
      revision,
    )
  ) {
    return null;
  }

  return {
    campfire_id:
      campfireId,
    burn_until:
      burnUntil,
    revision:
      Math.max(
        0,
        Math.floor(
          revision,
        ),
      ),
  };
}

function getBurnUntilMs(
  burnUntil: string | null,
) {
  if (!burnUntil) {
    return null;
  }

  const value =
    new Date(
      burnUntil,
    ).getTime();

  return Number.isFinite(
    value,
  )
    ? value
    : null;
}

export default function HooWorldCampfire({
  onBeforeUse,
}: HooWorldCampfireProps) {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const campfireElementRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const revisionRef =
    useRef(0);

  const [
    burnUntilMs,
    setBurnUntilMs,
  ] = useState<number | null>(
    null,
  );

  const [
    nowMs,
    setNowMs,
  ] = useState(
    Date.now(),
  );

  const [
    isPlayerNear,
    setIsPlayerNear,
  ] = useState(false);

  const [
    interactionOverlayPosition,
    setInteractionOverlayPosition,
  ] = useState<{
    left: number;
    top: number;
  } | null>(
    null,
  );

  const [
    campfireLightPosition,
    setCampfireLightPosition,
  ] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(
    null,
  );

  /*
   * 거대해지는 불꽃은 중앙 흙 공터의 clip-path / overflow에
   * 잘리지 않도록 document.body Portal로 따로 렌더링한다.
   *
   * 이 값은 현재 모닥불 DOM의 실제 화면 좌표를 기준으로 한다.
   */
  const [
    campfireFlamePosition,
    setCampfireFlamePosition,
  ] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(
    null,
  );

  const [
    nearbyFirewoodItemId,
    setNearbyFirewoodItemId,
  ] = useState<string | null>(
    null,
  );

  const nearbyFirewoodItemIdRef =
    useRef<string | null>(
      null,
    );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState<string | null>(
    null,
  );

  const messageTimerRef =
    useRef<number | null>(
      null,
    );

  const {
    start:
      startCampfireAudio,
    stop:
      stopCampfireAudio,
    setVolume:
      setCampfireVolume,
  } =
    useHooWorldCampfireAudio({
      volume: 0.58,
    });

  const isBurning =
    burnUntilMs !== null &&
    burnUntilMs > nowMs;

  const isBurningRef =
    useRef(isBurning);

  isBurningRef.current =
    isBurning;

  const remainingSeconds =
    isBurning &&
    burnUntilMs !== null
      ? Math.max(
          0,
          Math.ceil(
            (
              burnUntilMs -
              nowMs
            ) /
              1000,
          ),
        )
      : 0;

  function showMessage(
    nextMessage: string,
  ) {
    setMessage(
      nextMessage,
    );

    if (
      messageTimerRef.current !==
      null
    ) {
      window.clearTimeout(
        messageTimerRef.current,
      );
    }

    messageTimerRef.current =
      window.setTimeout(
        () => {
          setMessage(
            null,
          );

          messageTimerRef.current =
            null;
        },
        1800,
      );
  }

  /*
   * 공용 모닥불 상태 최초 로드 + Realtime 동기화.
   */
  useEffect(() => {
    let cancelled = false;

    function applyRow(
      rawRow: unknown,
    ) {
      const row =
        parseCampfireRow(
          rawRow,
        );

      if (
        !row ||
        row.campfire_id !==
          CAMPFIRE_ID
      ) {
        return;
      }

      if (
        row.revision <
        revisionRef.current
      ) {
        return;
      }

      revisionRef.current =
        row.revision;

      setBurnUntilMs(
        getBurnUntilMs(
          row.burn_until,
        ),
      );
    }

    async function loadCampfireState() {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "hoo_world_campfire_states",
          )
          .select(
            "campfire_id, burn_until, revision",
          )
          .eq(
            "campfire_id",
            CAMPFIRE_ID,
          )
          .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        console.warn(
          "HOO WORLD 모닥불 상태를 불러오지 못했습니다.",
          error,
        );

        return;
      }

      applyRow(
        data,
      );
    }

    void loadCampfireState();

    const channel =
      supabase
        .channel(
          "hoo-world-main-campfire-state",
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "hoo_world_campfire_states",
            filter:
              `campfire_id=eq.${CAMPFIRE_ID}`,
          },
          (
            payload,
          ) => {
            applyRow(
              payload.new,
            );
          },
        )
        .subscribe();

    return () => {
      cancelled = true;

      void supabase.removeChannel(
        channel,
      );
    };
  }, [
    supabase,
  ]);

  /*
   * burn_until이 지나면 로컬 화면에서도 즉시 작은 불씨 상태로 돌아간다.
   */
  useEffect(() => {
    if (
      burnUntilMs ===
      null
    ) {
      return;
    }

    setNowMs(
      Date.now(),
    );

    const timer =
      window.setInterval(
        () => {
          setNowMs(
            Date.now(),
          );
        },
        250,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    burnUntilMs,
  ]);

  /*
   * 캐릭터와 모닥불 거리,
   * 그리고 모닥불 근처에 놓인 가장 가까운 장작을 찾는다.
   *
   * 장작을 아무 곳에서나 소모하지 않고,
   * 실제로 모닥불 가까이 가져다 놓은 장작만 사용한다.
   */
  useEffect(() => {
    function refreshProximity() {
      const campfireElement =
        campfireElementRef.current;

      const playerElement =
        document.querySelector<HTMLElement>(
          '[data-hoo-world-local-player="true"]',
        );

      if (
        !campfireElement ||
        !playerElement
      ) {
        setIsPlayerNear(
          false,
        );

        setInteractionOverlayPosition(
          null,
        );

        setCampfireFlamePosition(
          null,
        );

        nearbyFirewoodItemIdRef.current =
          null;

        setNearbyFirewoodItemId(
          null,
        );

        return;
      }

      const campfireRect =
        campfireElement.getBoundingClientRect();

      /*
       * 불꽃의 원래 burning 래퍼 위치를 화면 좌표로 환산한다.
       *
       * 기존 JSX:
       * left 50% / top 19% / width 52% / height 65%
       *
       * 이 기준 크기만 Portal로 옮기고,
       * 실제 배율은 남은 분 수에 따라 transform scale로 적용한다.
       */
      const nextCampfireFlamePosition = {
        left:
          campfireRect.left +
          campfireRect.width *
            0.5,
        top:
          campfireRect.top +
          campfireRect.height *
            0.19,
        width:
          campfireRect.width *
            0.52,
        height:
          campfireRect.height *
            0.65,
      };

      setCampfireFlamePosition(
        (
          current,
        ) => {
          if (
            current &&
            Math.abs(
              current.left -
                nextCampfireFlamePosition.left,
            ) < 0.5 &&
            Math.abs(
              current.top -
                nextCampfireFlamePosition.top,
            ) < 0.5 &&
            Math.abs(
              current.width -
                nextCampfireFlamePosition.width,
            ) < 0.5 &&
            Math.abs(
              current.height -
                nextCampfireFlamePosition.height,
            ) < 0.5
          ) {
            return current;
          }

          return nextCampfireFlamePosition;
        },
      );

      /*
       * DAY / NIGHT 오버레이보다 위에서 빛이 보여야 하므로
       * 모닥불의 실제 화면 위치를 Portal 광원에 전달한다.
       *
       * 단순 원형 빛이 아니라 바닥에 넓게 퍼지는 타원형 광원으로 잡는다.
       */
      const nextCampfireLightPosition = {
        left:
          campfireRect.left +
          campfireRect.width /
            2,
        top:
          campfireRect.top +
          campfireRect.height *
            0.56,
        width:
          Math.min(
            window.innerWidth *
              0.76,
            Math.max(
              320,
              campfireRect.width *
                2.35,
            ),
          ),
        height:
          Math.min(
            window.innerHeight *
              0.58,
            Math.max(
              220,
              campfireRect.height *
                1.62,
            ),
          ),
      };

      setCampfireLightPosition(
        (
          current,
        ) => {
          if (
            current &&
            Math.abs(
              current.left -
                nextCampfireLightPosition.left,
            ) < 0.5 &&
            Math.abs(
              current.top -
                nextCampfireLightPosition.top,
            ) < 0.5 &&
            Math.abs(
              current.width -
                nextCampfireLightPosition.width,
            ) < 0.5 &&
            Math.abs(
              current.height -
                nextCampfireLightPosition.height,
            ) < 0.5
          ) {
            return current;
          }

          return nextCampfireLightPosition;
        },
      );

      const nextOverlayLeft =
        campfireRect.left +
        campfireRect.width /
          2;

      const nextOverlayTop =
        campfireRect.top +
        campfireRect.height *
          1.04;

      setInteractionOverlayPosition(
        (
          current,
        ) => {
          if (
            current &&
            Math.abs(
              current.left -
                nextOverlayLeft,
            ) < 0.5 &&
            Math.abs(
              current.top -
                nextOverlayTop,
            ) < 0.5
          ) {
            return current;
          }

          return {
            left:
              nextOverlayLeft,
            top:
              nextOverlayTop,
          };
        },
      );

      const playerRect =
        playerElement.getBoundingClientRect();

      const campfireCenterX =
        campfireRect.left +
        campfireRect.width /
          2;

      const campfireCenterY =
        campfireRect.top +
        campfireRect.height *
          0.56;

      const playerGroundX =
        playerRect.left +
        playerRect.width /
          2;

      const playerGroundY =
        playerRect.bottom;

      const playerDistance =
        Math.hypot(
          playerGroundX -
            campfireCenterX,
          playerGroundY -
            campfireCenterY,
        );

      const nextIsPlayerNear =
        playerDistance <=
        PLAYER_INTERACTION_RADIUS_PX;

      setIsPlayerNear(
        (
          current,
        ) =>
          current ===
          nextIsPlayerNear
            ? current
            : nextIsPlayerNear,
      );

      /*
       * 가까울수록 타닥타닥 소리가 크게 들리고,
       * 멀어지면 자연스럽게 거의 들리지 않게 한다.
       */
      const fullVolumeDistance =
        95;

      const silentDistance =
        470;

      const distanceRatio =
        1 -
        (
          playerDistance -
          fullVolumeDistance
        ) /
          (
            silentDistance -
            fullVolumeDistance
          );

      setCampfireVolume(
        Math.max(
          0,
          Math.min(
            1,
            distanceRatio,
          ),
        ) *
          0.85,
      );

      let nearestItemId:
        string | null =
        null;

      let nearestDistance =
        Number.POSITIVE_INFINITY;

      const firewoodElements =
        document.querySelectorAll<HTMLElement>(
          '[data-hoo-world-firewood="true"]',
        );

      for (
        const firewoodElement of
        firewoodElements
      ) {
        const itemElement =
          firewoodElement.closest<HTMLElement>(
            '[data-hoo-world-item="true"]',
          );

        if (!itemElement) {
          continue;
        }

        const itemId =
          itemElement.dataset
            .hooWorldItemId;

        if (!itemId) {
          continue;
        }

        const firewoodRect =
          itemElement.getBoundingClientRect();

        const firewoodCenterX =
          firewoodRect.left +
          firewoodRect.width /
            2;

        const firewoodCenterY =
          firewoodRect.top +
          firewoodRect.height /
            2;

        const distance =
          Math.hypot(
            firewoodCenterX -
              campfireCenterX,
            firewoodCenterY -
              campfireCenterY,
          );

        if (
          distance >
            FIREWOOD_USE_RADIUS_PX ||
          distance >=
            nearestDistance
        ) {
          continue;
        }

        nearestDistance =
          distance;

        nearestItemId =
          itemId;
      }

      nearbyFirewoodItemIdRef.current =
        nearestItemId;

      setNearbyFirewoodItemId(
        (
          current,
        ) =>
          current ===
          nearestItemId
            ? current
            : nearestItemId,
      );
    }

    refreshProximity();

    const timer =
      window.setInterval(
        refreshProximity,
        120,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    setCampfireVolume,
  ]);

  /*
   * 불이 켜져 있을 때만 Web Audio 모닥불 사운드를 유지한다.
   */
  useEffect(() => {
    if (!isBurning) {
      stopCampfireAudio();
      return;
    }

    void startCampfireAudio().catch(
      () => {
        /*
         * 아직 브라우저 오디오가 사용자 입력으로 해제되지 않은 경우
         * 아래 key/pointer 이벤트에서 다시 시작한다.
         */
      },
    );
  }, [
    isBurning,
    startCampfireAudio,
    stopCampfireAudio,
  ]);

  /*
   * 다른 이용자가 먼저 장작을 넣은 경우에도
   * 이 이용자가 키/마우스를 사용하는 순간 소리를 시작할 수 있게 한다.
   */
  useEffect(() => {
    function tryStartAudio() {
      if (
        !isBurningRef.current
      ) {
        return;
      }

      void startCampfireAudio().catch(
        () => {},
      );
    }

    window.addEventListener(
      "pointerdown",
      tryStartAudio,
    );

    window.addEventListener(
      "keydown",
      tryStartAudio,
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        tryStartAudio,
      );

      window.removeEventListener(
        "keydown",
        tryStartAudio,
      );
    };
  }, [
    startCampfireAudio,
  ]);

  /*
   * F를 누르면 모닥불 주변에 놓인 장작 1개만 소비한다.
   */
  useEffect(() => {
    async function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.code !== "KeyF" ||
        event.repeat ||
        isEditableTarget(
          event.target,
        ) ||
        !isPlayerNear ||
        isSubmitting
      ) {
        return;
      }

      event.preventDefault();

      const firewoodItemId =
        nearbyFirewoodItemIdRef.current;

      if (!firewoodItemId) {
        showMessage(
          "모닥불 가까이에 장작을 가져다 놓아 주세요.",
        );

        return;
      }

      onBeforeUse?.();

      setIsSubmitting(
        true,
      );

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "use_hoo_world_firewood",
            {
              p_firewood_item_id:
                firewoodItemId,
              p_campfire_id:
                CAMPFIRE_ID,
            },
          );

        if (error) {
          const errorMessage =
            error.message ?? "";

          if (
            errorMessage.includes(
              "FIREWOOD_ALREADY_USED",
            )
          ) {
            showMessage(
              "이미 사용된 장작이에요.",
            );

            return;
          }

          if (
            errorMessage.includes(
              "FIREWOOD_NOT_FOUND",
            )
          ) {
            showMessage(
              "사용할 장작을 찾지 못했어요.",
            );

            return;
          }

          console.error(
            "HOO WORLD 장작 사용에 실패했습니다.",
            error,
          );

          showMessage(
            "장작을 넣지 못했어요.",
          );

          return;
        }

        const row =
          data &&
          typeof data ===
            "object" &&
          !Array.isArray(data)
            ? (
                data as Record<
                  string,
                  unknown
                >
              )
            : null;

        const nextBurnUntil =
          typeof row?.burn_until ===
          "string"
            ? row.burn_until
            : null;

        const nextRevision =
          Number(
            row?.revision ?? 0,
          );

        if (
          Number.isFinite(
            nextRevision,
          )
        ) {
          revisionRef.current =
            Math.max(
              revisionRef.current,
              Math.floor(
                nextRevision,
              ),
            );
        }

        setBurnUntilMs(
          getBurnUntilMs(
            nextBurnUntil,
          ),
        );

        setNowMs(
          Date.now(),
        );

        showMessage(
          "장작을 넣었어요. 불길 +1분",
        );

        /*
         * 이 사용자의 F 입력은 확실한 사용자 제스처이므로
         * 즉시 오디오를 시작할 수 있다.
         */
        void startCampfireAudio().catch(
          () => {},
        );
      } finally {
        setIsSubmitting(
          false,
        );
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    isPlayerNear,
    isSubmitting,
    onBeforeUse,
    startCampfireAudio,
    supabase,
  ]);

  useEffect(() => {
    return () => {
      if (
        messageTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          messageTimerRef.current,
        );
      }
    };
  }, []);

  const remainingMinutes =
    Math.floor(
      remainingSeconds /
        60,
    );

  const remainingSecondsPart =
    remainingSeconds %
    60;

  return (
    <div
      ref={
        campfireElementRef
      }
      data-hoo-world-campfire={
        CAMPFIRE_ID
      }
      data-hoo-world-campfire-burning={
        isBurning
          ? "true"
          : "false"
      }
      className="pointer-events-none absolute left-1/2 top-[47%] z-[1000] h-[31%] w-[27%] -translate-x-1/2 -translate-y-1/2"
    >
      {/* 많이 밟힌 중앙 흙자리 */}
      <div className="absolute left-1/2 top-1/2 h-[88%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[48%_52%_46%_54%] bg-[#6f4d36]/7 blur-[2px]" />
      <div className="absolute left-1/2 top-1/2 h-[64%] w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#6e4e38]/10 bg-[#8b6244]/5" />

      {/* 불 주변의 그을린 흙 */}
      <div
        className={`absolute left-1/2 top-[51%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] transition-all duration-300 ${
          isBurning
            ? "h-[56%] w-[60%] bg-[#5a3828]/24 blur-[5px]"
            : "h-[44%] w-[48%] bg-[#4c392f]/15 blur-[3px]"
        }`}
      />
      <div
        className={`absolute left-1/2 top-[51%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] transition-all duration-300 ${
          isBurning
            ? "h-[38%] w-[43%] bg-[#2d231f]/22"
            : "h-[31%] w-[35%] bg-[#332b27]/16"
        }`}
      />

      {/* 활활 타는 동안 넓어지는 주황빛 */}
      {isBurning && (
        <>
          <div className="absolute left-1/2 top-[46%] z-[1] h-[70%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#ff8d32]/6 blur-[19px] animate-pulse" />
          <div className="absolute left-1/2 top-[44%] z-[1] h-[50%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#ffd36a]/4 blur-[13px]" />
        </>
      )}

      {campfireLightPosition &&
      typeof document !==
        "undefined"
        ? createPortal(
            <>
              <style>{`
                @keyframes hoo-campfire-wide-light-dance {
                  0% {
                    transform: scale(0.96, 0.93) translate3d(-0.4%, 0.4%, 0);
                    filter: blur(10px) brightness(0.92);
                  }
                  14% {
                    transform: scale(1.025, 0.985) translate3d(0.7%, -0.3%, 0);
                    filter: blur(12px) brightness(1.07);
                  }
                  31% {
                    transform: scale(0.985, 1.035) translate3d(-0.6%, -0.7%, 0);
                    filter: blur(9px) brightness(0.98);
                  }
                  47% {
                    transform: scale(1.04, 0.965) translate3d(0.3%, 0.5%, 0);
                    filter: blur(13px) brightness(1.12);
                  }
                  66% {
                    transform: scale(0.97, 1.015) translate3d(-0.2%, -0.4%, 0);
                    filter: blur(10px) brightness(0.94);
                  }
                  82% {
                    transform: scale(1.018, 1.028) translate3d(0.5%, -0.2%, 0);
                    filter: blur(12px) brightness(1.05);
                  }
                  100% {
                    transform: scale(0.96, 0.93) translate3d(-0.4%, 0.4%, 0);
                    filter: blur(10px) brightness(0.92);
                  }
                }

                @keyframes hoo-campfire-core-light-dance {
                  0% {
                    transform: scale(0.92, 0.96) translate3d(-1%, 1%, 0);
                    filter: blur(7px) brightness(0.9);
                  }
                  18% {
                    transform: scale(1.07, 1.01) translate3d(1%, -1.2%, 0);
                    filter: blur(8px) brightness(1.14);
                  }
                  39% {
                    transform: scale(0.97, 1.08) translate3d(-0.7%, -0.4%, 0);
                    filter: blur(6px) brightness(0.98);
                  }
                  57% {
                    transform: scale(1.1, 0.94) translate3d(0.8%, 0.4%, 0);
                    filter: blur(9px) brightness(1.18);
                  }
                  73% {
                    transform: scale(0.95, 1.03) translate3d(-0.4%, -0.8%, 0);
                    filter: blur(6px) brightness(0.94);
                  }
                  89% {
                    transform: scale(1.04, 1.06) translate3d(0.5%, -0.3%, 0);
                    filter: blur(8px) brightness(1.09);
                  }
                  100% {
                    transform: scale(0.92, 0.96) translate3d(-1%, 1%, 0);
                    filter: blur(7px) brightness(0.9);
                  }
                }

                @keyframes hoo-campfire-hot-light-dance {
                  0% {
                    transform: scale(0.9) translate3d(-1.2%, 1.4%, 0);
                    filter: blur(4px) brightness(0.92);
                  }
                  22% {
                    transform: scale(1.12) translate3d(1.1%, -1.5%, 0);
                    filter: blur(6px) brightness(1.22);
                  }
                  43% {
                    transform: scale(0.97) translate3d(-0.6%, -0.5%, 0);
                    filter: blur(4px) brightness(1);
                  }
                  61% {
                    transform: scale(1.08) translate3d(0.7%, -1%, 0);
                    filter: blur(5px) brightness(1.17);
                  }
                  79% {
                    transform: scale(0.94) translate3d(-0.4%, 0.7%, 0);
                    filter: blur(4px) brightness(0.96);
                  }
                  100% {
                    transform: scale(0.9) translate3d(-1.2%, 1.4%, 0);
                    filter: blur(4px) brightness(0.92);
                  }
                }

                @media (prefers-reduced-motion: reduce) {
                  [data-hoo-world-campfire-light-layer="wide"],
                  [data-hoo-world-campfire-light-layer="core"],
                  [data-hoo-world-campfire-light-layer="hot"] {
                    animation: none !important;
                  }
                }
              `}</style>

              <div
                data-hoo-world-campfire-light="true"
                className="pointer-events-none fixed z-[36]"
                aria-hidden="true"
                style={{
                  left:
                    campfireLightPosition.left,
                  top:
                    campfireLightPosition.top,
                  width:
                    campfireLightPosition.width,
                  height:
                    campfireLightPosition.height,
                  transform:
                    "translate(-50%, -50%)",
                  opacity:
                    isBurning
                      ? 1
                      : 0,
                  transition:
                    "opacity 900ms ease",
                  mixBlendMode:
                    "screen",
                }}
              >
                {/*
                 * 가장 넓은 바닥 광원.
                 * --hoo-world-light-strength를 사용하므로
                 * 낮에는 거의 보이지 않고 밤이 깊을수록 자연스럽게 살아난다.
                 */}
                <div
                  className="absolute inset-0"
                  style={{
                    opacity:
                      "calc(var(--hoo-world-light-strength, 0.16) * 0.24)",
                  }}
                >
                  <div
                    data-hoo-world-campfire-light-layer="wide"
                    className="absolute inset-[2%] rounded-[50%]"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 52%, rgba(255,205,122,0.13) 0%, rgba(255,143,58,0.075) 28%, rgba(245,92,31,0.028) 54%, rgba(194,62,24,0.012) 70%, transparent 84%)",
                      animation:
                        "hoo-campfire-wide-light-dance 3.17s ease-in-out infinite",
                    }}
                  />
                </div>

                {/*
                 * 모닥불 가까이에서 더 따뜻하게 번지는 중간 광원.
                 * 넓은 광원과 주기가 달라 반복적인 펄스처럼 보이지 않는다.
                 */}
                <div
                  className="absolute left-1/2 top-[52%] h-[66%] w-[60%] -translate-x-1/2 -translate-y-1/2"
                  style={{
                    opacity:
                      "calc(var(--hoo-world-light-strength, 0.16) * 0.3)",
                  }}
                >
                  <div
                    data-hoo-world-campfire-light-layer="core"
                    className="absolute inset-0 rounded-[50%]"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 48%, rgba(255,236,168,0.18) 0%, rgba(255,174,79,0.09) 28%, rgba(255,105,35,0.035) 54%, transparent 78%)",
                      animation:
                        "hoo-campfire-core-light-dance 2.29s ease-in-out infinite",
                    }}
                  />
                </div>

                {/*
                 * 불꽃 바로 주변의 작은 고온 광원.
                 * 빠르고 불규칙하게 흔들려 실제 불꽃의 밝기 변화처럼 보인다.
                 */}
                <div
                  className="absolute left-1/2 top-[48%] h-[42%] w-[34%] -translate-x-1/2 -translate-y-1/2"
                  style={{
                    opacity:
                      "calc(var(--hoo-world-light-strength, 0.16) * 0.38)",
                  }}
                >
                  <div
                    data-hoo-world-campfire-light-layer="hot"
                    className="absolute inset-0 rounded-[50%]"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 50%, rgba(255,248,201,0.24) 0%, rgba(255,199,91,0.12) 28%, rgba(255,112,36,0.04) 55%, transparent 76%)",
                      animation:
                        "hoo-campfire-hot-light-dance 1.43s ease-in-out infinite",
                    }}
                  />
                </div>
              </div>
            </>,
            document.body,
          )
        : null}

      {/* 돌 화덕 */}
      {[
        [50, 25, 19, 11, -3],
        [67, 30, 18, 11, 9],
        [77, 43, 19, 11, 18],
        [76, 59, 18, 11, -10],
        [64, 72, 19, 11, 7],
        [48, 76, 19, 11, -4],
        [32, 70, 18, 11, 10],
        [22, 57, 19, 11, -13],
        [23, 41, 18, 11, 8],
        [34, 29, 19, 11, -8],
      ].map(
        (
          [
            left,
            top,
            width,
            height,
            rotate,
          ],
          index,
        ) => (
          <span
            key={`camp-hub-stone-${index}`}
            className="absolute z-[2] rounded-[48%_52%_45%_55%] border border-[#69675c]/45 bg-gradient-to-br from-[#aaa48f] via-[#858379] to-[#65665f] shadow-[0_2px_3px_rgba(52,47,41,0.20)]"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
            }}
          >
            <span className="absolute left-[14%] top-[12%] h-[20%] w-[38%] rounded-full bg-white/12" />
          </span>
        ),
      )}

      {/* 화덕 안 기본 장작 */}
      <div className="absolute left-1/2 top-[52%] z-[3] h-[11%] w-[43%] -translate-x-1/2 -translate-y-1/2 rotate-[22deg] overflow-hidden rounded-full border border-[#4e3328]/70 bg-gradient-to-r from-[#4d3025] via-[#805039] to-[#4c3026] shadow-[0_3px_4px_rgba(47,34,27,0.23)]">
        <span className="absolute left-[18%] top-[24%] h-[16%] w-[49%] rounded-full bg-[#b2754e]/24" />
      </div>

      <div className="absolute left-1/2 top-[52%] z-[3] h-[11%] w-[43%] -translate-x-1/2 -translate-y-1/2 -rotate-[22deg] overflow-hidden rounded-full border border-[#4d3227]/70 bg-gradient-to-r from-[#4a2f25] via-[#78503a] to-[#4b3026] shadow-[0_3px_4px_rgba(47,34,27,0.23)]">
        <span className="absolute left-[22%] top-[25%] h-[16%] w-[44%] rounded-full bg-[#b2754e]/21" />
      </div>

      {/* 불꽃
          중앙 흙 공터의 clip-path / overflow / stacking context를
          완전히 벗어나도록 document.body Portal에서 렌더링한다.
          따라서 불꽃이 커져도 잔디 뒤로 잘리지 않는다. */}
      {campfireFlamePosition &&
      typeof document !==
        "undefined"
        ? createPortal(
            <div
  data-hoo-world-campfire-flame-portal="true"
  className="pointer-events-none fixed z-[9999] origin-bottom transition-transform duration-500"
  aria-hidden="true"

              style={{
                left:
                  campfireFlamePosition.left,
                top:
                  campfireFlamePosition.top,
                width:
                  campfireFlamePosition.width,
                height:
                  campfireFlamePosition.height,
                transform:
                  `translateX(-50%) scale(${
                    isBurning
                      ? Math.max(
                          1,
                          Math.ceil(
                            remainingSeconds /
                              60,
                          ),
                        )
                      : 1
                  })`,
                transformOrigin:
                  "50% 100%",
                willChange:
                  "transform",
                opacity:
                  isBurning
                    ? 1
                    : 0,
                transition:
                  "transform 500ms ease, opacity 300ms ease",
              }}
            >
        <div
          className={`absolute bottom-[3%] left-1/2 -translate-x-1/2 rounded-full transition-all duration-300 ${
            isBurning
              ? "h-[94%] w-[118%] bg-[#ff8c32]/22 blur-[14px]"
              : "h-[76%] w-[88%] bg-[#ff9b43]/12 blur-[9px]"
          }`}
        />

        <div
          className={`absolute bottom-[15%] left-1/2 -translate-x-1/2 rounded-full transition-all duration-300 ${
            isBurning
              ? "h-[68%] w-[82%] bg-[#ffd66f]/15 blur-[10px]"
              : "h-[46%] w-[62%] bg-[#ffd66f]/7 blur-[7px]"
          }`}
        />

        <div className={`absolute bottom-[7%] left-[18%] h-[55%] w-[34%] -rotate-[13deg] rounded-[65%_35%_55%_45%] bg-gradient-to-t from-[#d94f2e] via-[#f47b38] to-[#ffc465] ${isBurning ? "animate-pulse" : ""}`} />
        <div className={`absolute bottom-[6%] right-[17%] h-[60%] w-[35%] rotate-[12deg] rounded-[45%_55%_64%_36%] bg-gradient-to-t from-[#df5930] via-[#f98a3d] to-[#ffd473] ${isBurning ? "animate-pulse" : ""}`} />
        <div className="absolute bottom-[5%] left-1/2 h-[72%] w-[43%] -translate-x-1/2 rounded-[55%_45%_62%_38%] bg-gradient-to-t from-[#e8572d] via-[#ff963f] to-[#ffe086] shadow-[0_0_8px_rgba(255,141,54,0.38)]" />
        <div className="absolute bottom-[12%] left-1/2 h-[45%] w-[23%] -translate-x-1/2 rounded-[60%_40%_58%_42%] bg-gradient-to-t from-[#ffc849] to-[#fff2ad]" />

        {isBurning && (
          <>
            <div className="absolute bottom-[8%] left-[30%] h-[79%] w-[29%] -rotate-[6deg] rounded-[58%_42%_66%_34%] bg-gradient-to-t from-[#e74e29] via-[#ff8a36] to-[#ffe899] opacity-95" />
            <div className="absolute bottom-[4%] right-[27%] h-[86%] w-[25%] rotate-[7deg] rounded-[42%_58%_38%_62%] bg-gradient-to-t from-[#ed5d2d] via-[#ff9d3f] to-[#fff0aa] opacity-90 animate-pulse" />
          </>
        )}
            </div>,
            document.body,
          )
        : null}

      {/* 불씨 */}
      <span className={`absolute left-[44%] z-[5] h-[3px] w-[3px] rounded-full bg-[#ffd477]/80 shadow-[0_0_3px_rgba(255,207,103,0.55)] ${isBurning ? "top-[16%] animate-pulse" : "top-[25%]"}`} />
      <span className={`absolute left-[57%] z-[5] h-[2px] w-[2px] rounded-full bg-[#ffbe5e]/75 ${isBurning ? "top-[23%] animate-pulse" : "top-[31%]"}`} />
      <span className={`absolute left-[50%] z-[5] h-[2px] w-[2px] rounded-full bg-[#ffe09a]/70 ${isBurning ? "top-[11%] animate-pulse" : "top-[20%]"}`} />

      {/* 가까이 갔을 때만 보이는 상호작용 안내
          월드 오브젝트의 z-index / stacking context와 완전히 분리한다. */}
      {isPlayerNear &&
      interactionOverlayPosition &&
      typeof document !==
        "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[1000] flex -translate-x-1/2 flex-col items-center gap-1.5 whitespace-nowrap"
              style={{
                left:
                  interactionOverlayPosition.left,
                top:
                  interactionOverlayPosition.top,
              }}
            >
              {isBurning && (
                <div className="rounded-full border border-[#e9c983]/30 bg-[#251e19]/90 px-2.5 py-1 text-[9px] font-black text-[#ffd98d] shadow-[0_3px_10px_rgba(0,0,0,0.32)] backdrop-blur-sm">
                  🔥 {remainingMinutes}:{String(
                    remainingSecondsPart,
                  ).padStart(
                    2,
                    "0",
                  )}
                </div>
              )}

              <div className="rounded-full border border-white/25 bg-black/78 px-3.5 py-1.5 text-[10px] font-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.38)] backdrop-blur-sm">
                {nearbyFirewoodItemId
                  ? isSubmitting
                    ? "장작 넣는 중..."
                    : "F 장작 넣기"
                  : "장작을 가까이 가져오세요"}
              </div>

              {message && (
                <div className="rounded-full border border-[#f0d8a6]/25 bg-[#31251d]/94 px-3 py-1 text-[9px] font-bold text-[#ffe5b5] shadow-[0_3px_10px_rgba(0,0,0,0.34)] backdrop-blur-sm">
                  {message}
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

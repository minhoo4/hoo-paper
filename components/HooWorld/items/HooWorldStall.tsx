"use client";

import {
  type MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import HooWorldItem from "@/components/HooWorld/items/HooWorldItem";
import {
  createClient,
} from "@/lib/supabase/client";

type HooWorldPosition = {
  x: number;
  y: number;
};

type HooWorldStallProps = {
  x?: number;
  y?: number;
  playerPositionRef: MutableRefObject<HooWorldPosition>;
  onBeforeOpen?: () => void;
  onBalanceChange?: (
    nextBalance: number,
  ) => void;
};

export default function HooWorldStall({
  x = 77,
  y = 58,
  playerPositionRef,
  onBeforeOpen,
  onBalanceChange,
}: HooWorldStallProps) {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const stallElementRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const promptElementRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const dialogElementRef =
    useRef<HTMLDialogElement | null>(
      null,
    );

  const [
    hooCoinBalance,
    setHooCoinBalance,
  ] = useState(0);

  const [
    hooWorldStallTotal,
    setHooWorldStallTotal,
  ] = useState(0);

  const [
    hooWorldStallDonationAmount,
    setHooWorldStallDonationAmount,
  ] = useState("");

  const [
    isSubmittingHooWorldStallDonation,
    setIsSubmittingHooWorldStallDonation,
  ] = useState(false);

  const [
    hooWorldStallDonationMessage,
    setHooWorldStallDonationMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    hooWorldStallRequestText,
    setHooWorldStallRequestText,
  ] = useState("");

  const [
    hooWorldStallRequestOfferedCoin,
    setHooWorldStallRequestOfferedCoin,
  ] = useState("");

  const [
    isSubmittingHooWorldStallRequest,
    setIsSubmittingHooWorldStallRequest,
  ] = useState(false);

  const [
    hooWorldStallRequestMessage,
    setHooWorldStallRequestMessage,
  ] = useState<string | null>(
    null,
  );

  /*
   * 가판대가 자기 지갑 정보도 직접 관리한다.
   * 맵(page.tsx)의 고정 좌표/상태에 의존하지 않는다.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadWallet() {
      try {
        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (
          cancelled ||
          !user
        ) {
          return;
        }

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "hoo_coin_wallets",
            )
            .select("balance")
            .eq(
              "user_id",
              user.id,
            )
            .maybeSingle();

        if (
          cancelled
        ) {
          return;
        }

        if (error) {
          console.error(
            "HOO WORLD 가판대 지갑 정보를 불러오지 못했습니다.",
            error,
          );

          return;
        }

        const nextBalance =
          Number(
            data?.balance ?? 0,
          );

        const normalizedBalance =
          Number.isFinite(
            nextBalance,
          )
            ? Math.max(
                0,
                Math.floor(
                  nextBalance,
                ),
              )
            : 0;

        setHooCoinBalance(
          normalizedBalance,
        );

        onBalanceChange?.(
          normalizedBalance,
        );
      } catch (error) {
        console.error(
          "HOO WORLD 가판대 지갑 정보를 불러오는 중 오류가 발생했습니다.",
          error,
        );
      }
    }

    void loadWallet();

    return () => {
      cancelled = true;
    };
  }, [
    onBalanceChange,
    supabase,
  ]);

  /*
   * 공동 모금액 역시 가판대 자체가 동기화한다.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadStallState() {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "get_hoo_world_stall_state",
        );

      if (cancelled) {
        return;
      }

      if (error) {
        console.warn(
          "HOO WORLD 가판대 모금액 동기화를 잠시 건너뜁니다.",
          error,
        );

        return;
      }

      const result =
        data &&
        typeof data ===
          "object" &&
        !Array.isArray(data)
          ? (
              data as {
                total_hoo_coin?: unknown;
              }
            )
          : null;

      const nextTotal =
        Number(
          result?.total_hoo_coin ??
            0,
        );

      setHooWorldStallTotal(
        Number.isFinite(
          nextTotal,
        )
          ? Math.max(
              0,
              Math.floor(
                nextTotal,
              ),
            )
          : 0,
      );
    }

    void loadStallState();

    const refreshTimer =
      window.setInterval(
        () => {
          void loadStallState();
        },
        5000,
      );

    return () => {
      cancelled = true;

      window.clearInterval(
        refreshTimer,
      );
    };
  }, [
    supabase,
  ]);

  async function submitDonation() {
    if (
      isSubmittingHooWorldStallDonation
    ) {
      return;
    }

    const normalizedAmount =
      hooWorldStallDonationAmount.trim();

    if (
      !/^\d+$/.test(
        normalizedAmount,
      )
    ) {
      setHooWorldStallDonationMessage(
        "1 이상의 숫자를 입력해 주세요.",
      );

      return;
    }

    const amount =
      Number(
        normalizedAmount,
      );

    if (
      !Number.isSafeInteger(
        amount,
      ) ||
      amount <= 0
    ) {
      setHooWorldStallDonationMessage(
        "올바른 후코인 수량을 입력해 주세요.",
      );

      return;
    }

    if (
      amount >
      hooCoinBalance
    ) {
      setHooWorldStallDonationMessage(
        "보유한 HOO COIN보다 많이 제출할 수 없어요.",
      );

      return;
    }

    setIsSubmittingHooWorldStallDonation(
      true,
    );

    setHooWorldStallDonationMessage(
      null,
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "donate_hoo_coin_to_world_stall",
          {
            p_amount: amount,
          },
        );

      if (error) {
        const errorMessage =
          error.message ?? "";

        if (
          errorMessage.includes(
            "INSUFFICIENT_HOO_COIN",
          )
        ) {
          setHooWorldStallDonationMessage(
            "보유한 HOO COIN이 부족해요.",
          );

          return;
        }

        if (
          errorMessage.includes(
            "AUTH_REQUIRED",
          )
        ) {
          setHooWorldStallDonationMessage(
            "로그인 후 이용할 수 있어요.",
          );

          return;
        }

        console.error(
          "HOO WORLD 가판대 후코인 제출에 실패했습니다.",
          error,
        );

        setHooWorldStallDonationMessage(
          "후코인을 제출하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );

        return;
      }

      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      if (
        result &&
        typeof result ===
          "object"
      ) {
        const typedResult =
          result as {
            new_balance?: unknown;
            stall_total?: unknown;
          };

        const nextBalance =
          Number(
            typedResult.new_balance,
          );

        const nextStallTotal =
          Number(
            typedResult.stall_total,
          );

        if (
          Number.isFinite(
            nextBalance,
          )
        ) {
          const normalizedBalance =
            Math.max(
              0,
              Math.floor(
                nextBalance,
              ),
            );

          setHooCoinBalance(
            normalizedBalance,
          );

          onBalanceChange?.(
            normalizedBalance,
          );
        }

        if (
          Number.isFinite(
            nextStallTotal,
          )
        ) {
          setHooWorldStallTotal(
            Math.max(
              0,
              Math.floor(
                nextStallTotal,
              ),
            ),
          );
        }
      }

      setHooWorldStallDonationAmount(
        "",
      );

      setHooWorldStallDonationMessage(
        `${amount.toLocaleString()} HOO COIN을 가판대에 넣었어요.`,
      );
    } catch (error) {
      console.error(
        "HOO WORLD 가판대 후코인 제출 중 오류가 발생했습니다.",
        error,
      );

      setHooWorldStallDonationMessage(
        "후코인을 제출하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsSubmittingHooWorldStallDonation(
        false,
      );
    }
  }

  async function submitRequest() {
    if (
      isSubmittingHooWorldStallRequest
    ) {
      return;
    }

    const normalizedRequest =
      hooWorldStallRequestText
        .replace(/\s+/g, " ")
        .trim();

    const normalizedCoinText =
      hooWorldStallRequestOfferedCoin
        .replace(/[^0-9]/g, "")
        .trim();

    if (!normalizedRequest) {
      setHooWorldStallRequestMessage(
        "원하는 아이템 정보를 입력해 주세요.",
      );

      return;
    }

    if (
      Array.from(
        normalizedRequest,
      ).length > 500
    ) {
      setHooWorldStallRequestMessage(
        "아이템 정보는 최대 500글자까지 입력할 수 있어요.",
      );

      return;
    }

    if (!normalizedCoinText) {
      setHooWorldStallRequestMessage(
        "코인 제시 금액을 입력해 주세요.",
      );

      return;
    }

    const offeredCoin =
      Number(normalizedCoinText);

    if (
      !Number.isFinite(
        offeredCoin,
      ) ||
      offeredCoin < 1
    ) {
      setHooWorldStallRequestMessage(
        "코인 제시는 1 이상으로 입력해 주세요.",
      );

      return;
    }

    if (
      !Number.isInteger(
        offeredCoin,
      )
    ) {
      setHooWorldStallRequestMessage(
        "코인 제시는 정수로 입력해 주세요.",
      );

      return;
    }

    if (
      offeredCoin >
      9_999_999_999
    ) {
      setHooWorldStallRequestMessage(
        "코인 제시는 너무 크게 입력할 수 없어요.",
      );

      return;
    }

    setIsSubmittingHooWorldStallRequest(
      true,
    );

    setHooWorldStallRequestMessage(
      null,
    );

    try {
      const {
        error,
      } =
        await supabase.rpc(
          "submit_hoo_world_item_request",
          {
            p_request_text:
              normalizedRequest,
            p_offered_hoo_coin:
              offeredCoin,
          },
        );

      if (error) {
        const errorMessage =
          error.message ?? "";

        if (
          errorMessage.includes(
            "AUTH_REQUIRED",
          )
        ) {
          setHooWorldStallRequestMessage(
            "로그인 후 이용할 수 있어요.",
          );

          return;
        }

        if (
          errorMessage.includes(
            "EMPTY_REQUEST",
          )
        ) {
          setHooWorldStallRequestMessage(
            "원하는 아이템 정보를 입력해 주세요.",
          );

          return;
        }

        if (
          errorMessage.includes(
            "REQUEST_TOO_LONG",
          )
        ) {
          setHooWorldStallRequestMessage(
            "아이템 정보는 최대 500글자까지 입력할 수 있어요.",
          );

          return;
        }

        if (
          errorMessage.includes(
            "INVALID_HOO_COIN",
          ) ||
          errorMessage.includes(
            "INVALID_OFFERED_HOO_COIN",
          )
        ) {
          setHooWorldStallRequestMessage(
            "코인 제시는 1 이상 정수로 입력해 주세요.",
          );

          return;
        }

        console.error(
          "HOO WORLD 제작 요청 저장에 실패했습니다.",
          error,
        );

        setHooWorldStallRequestMessage(
          "제작 요청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );

        return;
      }

      setHooWorldStallRequestText(
        "",
      );

      setHooWorldStallRequestOfferedCoin(
        "",
      );

      setHooWorldStallRequestMessage(
        `"${normalizedRequest}" 요청과 ${offeredCoin.toLocaleString()} HOO COIN 제시를 접수했어요.`,
      );
    } catch (error) {
      console.error(
        "HOO WORLD 제작 요청 저장 중 오류가 발생했습니다.",
        error,
      );

      setHooWorldStallRequestMessage(
        "제작 요청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsSubmittingHooWorldStallRequest(
        false,
      );
    }
  }

  /*
   * 가판대 고유 기능은 F키만 직접 관리한다.
   *
   * X 이동 / 방향키 이동 / 좌표 저장 / Realtime 동기화는
   * 공용 HooWorldItem이 전부 담당한다.
   */
  useEffect(() => {
    const stallElement =
      stallElementRef.current;

    const promptElement =
      promptElementRef.current;

    const dialogElement =
      dialogElementRef.current;

    if (
      !stallElement ||
      !promptElement ||
      !dialogElement
    ) {
      return;
    }

    const activeStallElement =
      stallElement;

    const activePromptElement =
      promptElement;

    const activeDialogElement =
      dialogElement;

    let isNearStall = false;

    let interactionFrame:
      number | null =
      null;

    function setPromptVisible(
      nextVisible: boolean,
    ) {
      if (
        nextVisible ===
        isNearStall
      ) {
        return;
      }

      isNearStall =
        nextVisible;

      activePromptElement.style.display =
        isNearStall
          ? "flex"
          : "none";

      activePromptElement.setAttribute(
        "aria-hidden",
        isNearStall
          ? "false"
          : "true",
      );
    }

    function updateInteraction() {
      const current =
        playerPositionRef.current;

      const stallRect =
        activeStallElement.getBoundingClientRect();

      if (
        stallRect.width <= 0 ||
        stallRect.height <= 0
      ) {
        setPromptVisible(
          false,
        );

        interactionFrame =
          requestAnimationFrame(
            updateInteraction,
          );

        return;
      }

      const playerPixelX =
        (
          current.x /
          100
        ) *
        window.innerWidth;

      const playerPixelY =
        (
          current.y /
          100
        ) *
        window.innerHeight;

      const interactionCenterX =
        stallRect.left +
        stallRect.width /
          2;

      const interactionCenterY =
        stallRect.bottom -
        Math.min(
          14,
          stallRect.height *
            0.07,
        );

      const interactionRadiusX =
        Math.max(
          96,
          stallRect.width *
            0.82,
        );

      const interactionRadiusY =
        Math.max(
          72,
          stallRect.height *
            0.46,
        );

      const normalizedX =
        (
          playerPixelX -
          interactionCenterX
        ) /
        interactionRadiusX;

      const normalizedY =
        (
          playerPixelY -
          interactionCenterY
        ) /
        interactionRadiusY;

      const nextIsNearStall =
        normalizedX *
          normalizedX +
          normalizedY *
            normalizedY <=
        1;

      setPromptVisible(
        nextIsNearStall,
      );

      interactionFrame =
        requestAnimationFrame(
          updateInteraction,
        );
    }

    function stopDialogKeyboardPropagation(
      event: KeyboardEvent,
    ) {
      event.stopPropagation();
    }

    function handleInteraction(
      event: KeyboardEvent,
    ) {
      if (
        event.code !== "KeyF" ||
        event.repeat ||
        !isNearStall ||
        activeDialogElement.open
      ) {
        return;
      }

      const target =
        event.target;

      if (
        target instanceof
          HTMLInputElement ||
        target instanceof
          HTMLTextAreaElement ||
        target instanceof
          HTMLSelectElement ||
        (
          target instanceof
            HTMLElement &&
          target.isContentEditable
        )
      ) {
        return;
      }

      event.preventDefault();

      onBeforeOpen?.();

      activeDialogElement.showModal();
    }

    activeDialogElement.addEventListener(
      "keydown",
      stopDialogKeyboardPropagation,
    );

    activeDialogElement.addEventListener(
      "keyup",
      stopDialogKeyboardPropagation,
    );

    window.addEventListener(
      "keydown",
      handleInteraction,
    );

    interactionFrame =
      requestAnimationFrame(
        updateInteraction,
      );

    return () => {
      if (
        interactionFrame !==
        null
      ) {
        cancelAnimationFrame(
          interactionFrame,
        );
      }

      activeDialogElement.removeEventListener(
        "keydown",
        stopDialogKeyboardPropagation,
      );

      activeDialogElement.removeEventListener(
        "keyup",
        stopDialogKeyboardPropagation,
      );

      window.removeEventListener(
        "keydown",
        handleInteraction,
      );
    };
  }, [
    onBeforeOpen,
    playerPositionRef,
  ]);

  return (
    <>
      <HooWorldItem
        ref={
          stallElementRef
        }
        itemId="hoo-world-stall"
        itemType="stall"
        x={x}
        y={y}
        width={210}
        height={196}
        movable
        collision
        collisionBottomRatio={
          0.15
        }
        interactive
        zIndex={12}
      >
        <div
          className="relative h-full w-full"
          data-hoo-world-donation-stall="true"
        >
          {/*
           * 실제 가판대 다리가 땅에 닿는 지점.
           *
           * 공용 충돌 엔진은 이 앵커가 있으면
           * 아이템 전체 박스가 아니라 이 영역만 충돌로 사용한다.
           * 따라서 가판대를 이동해도 접지 충돌도 같이 이동한다.
           */}
          <div
            data-hoo-world-collision-anchor="true"
            className="pointer-events-none absolute bottom-[18px] left-1/2 h-[6px] w-[176px] -translate-x-1/2"
          />

          {/* 바닥 그림자 */}
          <div className="absolute bottom-[1px] left-1/2 h-[26px] w-[174px] -translate-x-1/2 rounded-[50%] bg-[#39412e]/20 blur-[5px]" />

          {/* 가판대 본체 */}
          <div className="absolute bottom-[18px] left-1/2 h-[147px] w-[176px] -translate-x-1/2">
            {/* 좌우 기둥 */}
            <div className="absolute bottom-0 left-[8px] h-[121px] w-[15px] rounded-[5px] border border-[#503524]/70 bg-gradient-to-r from-[#68442e] via-[#9c6742] to-[#60402b] shadow-[2px_3px_4px_rgba(44,34,25,0.20)]">
              <span className="absolute left-[3px] top-[11px] h-[2px] w-[7px] rounded-full bg-[#c08a5d]/35" />
              <span className="absolute left-[4px] top-[56px] h-[2px] w-[6px] rounded-full bg-[#4b3023]/25" />
            </div>

            <div className="absolute bottom-0 right-[8px] h-[121px] w-[15px] rounded-[5px] border border-[#503524]/70 bg-gradient-to-r from-[#68442e] via-[#9c6742] to-[#60402b] shadow-[2px_3px_4px_rgba(44,34,25,0.20)]">
              <span className="absolute left-[3px] top-[19px] h-[2px] w-[7px] rounded-full bg-[#c08a5d]/35" />
              <span className="absolute left-[4px] top-[71px] h-[2px] w-[6px] rounded-full bg-[#4b3023]/25" />
            </div>

            {/* 뒤쪽 나무판 */}
            <div className="absolute bottom-[5px] left-1/2 h-[105px] w-[145px] -translate-x-1/2 overflow-hidden rounded-[7px] border border-[#583a28]/65 bg-gradient-to-b from-[#9b6743] via-[#825438] to-[#69452f] shadow-[0_4px_7px_rgba(46,34,25,0.20)]">
              <span className="absolute inset-x-0 top-[24%] h-px bg-[#513323]/25" />
              <span className="absolute inset-x-0 top-[49%] h-px bg-[#513323]/25" />
              <span className="absolute inset-x-0 top-[74%] h-px bg-[#513323]/25" />

              <span className="absolute left-[12px] top-[8px] h-[3px] w-[42px] rounded-full bg-[#c58c5e]/18" />
              <span className="absolute right-[15px] top-[41px] h-[3px] w-[34px] rounded-full bg-[#c58c5e]/15" />
            </div>

            {/* 지붕 그림자 */}
            <div className="absolute left-1/2 top-[14px] h-[25px] w-[178px] -translate-x-1/2 rounded-[50%] bg-[#483024]/16 blur-[4px]" />

            {/* 목재 지붕 */}
            <div className="absolute left-1/2 top-0 h-[39px] w-[184px] -translate-x-1/2 overflow-hidden rounded-[12px_12px_8px_8px] border border-[#563824]/70 bg-gradient-to-b from-[#b97c4d] via-[#98613d] to-[#75482f] shadow-[0_5px_7px_rgba(54,38,26,0.22)]">
              <span className="absolute left-[13px] top-[9px] h-[5px] w-[45px] -rotate-3 rounded-full bg-[#dfaa72]/19" />
              <span className="absolute left-[67px] top-[7px] h-[4px] w-[39px] rotate-2 rounded-full bg-[#dca36d]/16" />
              <span className="absolute right-[15px] top-[11px] h-[4px] w-[41px] -rotate-2 rounded-full bg-[#dca36d]/18" />

              <span className="absolute bottom-0 left-[25%] h-full w-px rotate-[7deg] bg-[#563823]/22" />
              <span className="absolute bottom-0 left-1/2 h-full w-px -rotate-[4deg] bg-[#563823]/22" />
              <span className="absolute bottom-0 left-[75%] h-full w-px rotate-[6deg] bg-[#563823]/22" />
            </div>

            {/* HOO COIN 간판 */}
            <div className="absolute left-1/2 top-[23px] z-[3] flex h-[34px] w-[119px] -translate-x-1/2 items-center justify-center rounded-[8px] border border-[#63452f]/65 bg-gradient-to-b from-[#ead0a0] to-[#cba472] shadow-[0_2px_4px_rgba(55,38,26,0.18)]">
              <span className="text-[12px] font-black tracking-[0.12em] text-[#543823]">
                HOO COIN
              </span>

              <span className="absolute -top-[5px] left-1/2 h-[8px] w-[13px] -translate-x-1/2 rotate-[-18deg] rounded-[70%_30%_70%_30%] bg-[#6e8b4f]" />
            </div>

            {/* 왼쪽: 기부 투입구 */}
            <div className="absolute left-[26px] top-[68px] h-[52px] w-[55px] rounded-[6px] border border-[#60412e]/55 bg-[#d5b27d]/75 shadow-[inset_0_2px_3px_rgba(255,238,193,0.18)]">
              <span className="absolute left-1/2 top-[7px] -translate-x-1/2 whitespace-nowrap text-[7px] font-black text-[#69503a]">
                기부하기
              </span>

              <div className="absolute left-1/2 top-[24px] h-[7px] w-[31px] -translate-x-1/2 rounded-full border border-[#392b23]/45 bg-[#2f2924]/80 shadow-[inset_0_2px_2px_rgba(0,0,0,0.18)]" />

              <div className="absolute left-1/2 top-[33px] flex h-[14px] w-[14px] -translate-x-1/2 items-center justify-center rounded-full border border-[#a36c13] bg-gradient-to-br from-[#ffe280] via-[#e9ae29] to-[#b8740f] text-[7px] font-black text-[#81500b] shadow-[0_1px_2px_rgba(74,49,15,0.22)]">
                H
              </div>
            </div>

            {/* 오른쪽: 요청 게시판 */}
            <div className="absolute right-[25px] top-[68px] h-[52px] w-[61px] rounded-[6px] border border-[#60412e]/55 bg-[#d8b783]/75 shadow-[inset_0_2px_3px_rgba(255,238,193,0.18)]">
              <span className="absolute left-1/2 top-[7px] -translate-x-1/2 whitespace-nowrap text-[7px] font-black text-[#69503a]">
                요청하기
              </span>

              <div className="absolute left-1/2 top-[22px] h-[10px] w-[47px] -translate-x-1/2 rounded-[3px] border border-[#876c4f]/35 bg-[#f3dfba]/55" />

              <div className="absolute bottom-[5px] left-1/2 flex h-[11px] w-[29px] -translate-x-1/2 items-center justify-center rounded-[3px] border border-[#5b3c28]/45 bg-[#825438] text-[6px] font-black text-[#f3dfbd]">
                요청
              </div>
            </div>

            {/* 모금액 표시판 */}
            <div className="absolute bottom-[14px] left-1/2 z-[3] flex h-[28px] w-[111px] -translate-x-1/2 items-center justify-center rounded-[5px] border border-[#493122]/65 bg-[#483326]/92 shadow-[0_2px_4px_rgba(40,29,22,0.18)]">
              <span className="mr-[5px] text-[6px] font-bold text-[#d9c4a2]">
                모금액
              </span>

              <span className="text-[11px] font-black tabular-nums text-[#ffe291]">
                {hooWorldStallTotal.toLocaleString()}
              </span>
            </div>

            {/* 오른쪽 작은 HOO 깃발 */}
            <div className="absolute right-[-2px] top-[43px] h-[43px] w-[25px] origin-top">
              <div className="absolute left-[2px] top-0 h-full w-[2px] rounded-full bg-[#503724]" />

              <div className="absolute left-[5px] top-[4px] flex h-[30px] w-[20px] items-center justify-center rounded-b-[8px] border border-[#43543a]/50 bg-gradient-to-b from-[#5c7654] to-[#40583f] shadow-sm">
                <span className="text-[7px] font-black text-[#e6d6ab]">
                  HOO
                </span>
              </div>
            </div>
          </div>

          {/* 가판대 왼쪽 코인 적재 공간 */}
          <div className="absolute bottom-[11px] left-[-7px] h-[49px] w-[65px]">
            <div className="absolute bottom-0 left-[4px] h-[11px] w-[55px] rounded-[50%] bg-[#51462f]/20 blur-[2px]" />

            {Array.from({
              length: Math.floor(
                hooWorldStallTotal /
                  10,
              ),
            }).map((_, index) => {
              const column =
                index % 3;

              const level =
                Math.floor(
                  index / 3,
                );

              const left =
                8 +
                column * 15 +
                (level % 2) * 2;

              const top =
                31 -
                level * 3;

              const rotate =
                [-4, 1, 5, -2, 3][
                  index % 5
                ];

              return (
                <span
                  key={`hoo-stall-coin-${index}`}
                  className="absolute h-[7px] w-[20px] rounded-[50%] border border-[#9d6612]/75 bg-gradient-to-b from-[#ffe078] via-[#dca126] to-[#a86b11] shadow-[0_1px_2px_rgba(78,50,10,0.25)]"
                  style={{
                    left,
                    top,
                    transform: `rotate(${rotate}deg)`,
                    animation:
                      `hooStallCoinDrop 220ms ease-out ${(index % 12) * 35}ms both`,
                  }}
                >
                  <span className="absolute inset-[2px] rounded-[50%] border border-[#fff2a6]/25" />
                </span>
              );
            })}

            <style>{`
              @keyframes hooStallCoinDrop {
                0% {
                  opacity: 0;
                  transform: translateY(-12px) scale(0.92);
                }
                72% {
                  opacity: 1;
                  transform: translateY(1px) scale(1.02);
                }
                100% {
                  opacity: 1;
                }
              }
            `}</style>

            <span className="absolute bottom-[1px] left-[7px] whitespace-nowrap rounded-[4px] bg-[#55402f]/88 px-[5px] py-[2px] text-[5px] font-black tracking-[0.04em] text-[#ead6af]">
              10 = 1 COIN
            </span>
          </div>

          {/* 캐릭터가 가판대 근처에 있을 때만 표시 */}
          <div
            ref={
              promptElementRef
            }
            data-hoo-world-donation-prompt="true"
            aria-hidden="true"
            className="absolute -bottom-[18px] left-1/2 -translate-x-1/2 items-center gap-[5px] whitespace-nowrap rounded-full border border-white/35 bg-[#2f3228]/82 px-[9px] py-[5px] shadow-[0_3px_8px_rgba(39,43,33,0.20)] backdrop-blur-sm"
            style={{
              display: "none",
            }}
          >
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-[#f3efe4] text-[9px] font-black text-[#37362f]">
              F
            </span>

            <span className="text-[7px] font-black text-white">
              이용
            </span>
          </div>
        </div>
      </HooWorldItem>

      {/* 가판대 기능 UI도 같은 컴포넌트가 소유한다. */}
      <dialog
        ref={
          dialogElementRef
        }
        data-hoo-world-donation-dialog="true"
        className="fixed left-1/2 top-1/2 z-[120] m-0 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-[#78563b]/45 bg-[#f4e6c9] p-0 text-[#493727] shadow-[0_25px_80px_rgba(25,22,17,0.38)] backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
      >
        <div className="relative overflow-hidden">
          <div className="relative border-b border-[#68482f]/35 bg-gradient-to-b from-[#9c6946] to-[#765039] px-6 py-5 text-[#fff1cf]">
            <p className="text-[10px] font-black tracking-[0.2em] text-[#ead2a5]/75">
              HOO WORLD
            </p>

            <h2 className="mt-1 text-2xl font-black">
              HOO COIN 가판대
            </h2>

            <p className="mt-1 text-xs font-bold text-[#efdcb9]/75">
              함께 모아서 월드를 만들어가요.
            </p>

            <form
              method="dialog"
              className="absolute right-4 top-4"
            >
              <button
                type="submit"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/15 text-lg font-black text-white/85 transition hover:bg-black/25"
                aria-label="가판대 닫기"
              >
                ×
              </button>
            </form>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#d0b68b]/55 bg-[#fff8e9]/75 px-4 py-3">
                <span className="block text-[10px] font-black text-[#80694e]">
                  내가 가진 HOO COIN
                </span>

                <strong className="mt-1 block text-lg font-black tabular-nums text-[#ba7718]">
                  {hooCoinBalance.toLocaleString()}
                </strong>
              </div>

              <div className="rounded-2xl border border-[#d0b68b]/55 bg-[#fff8e9]/75 px-4 py-3">
                <span className="block text-[10px] font-black text-[#80694e]">
                  공동 모금액
                </span>

                <strong className="mt-1 block text-lg font-black tabular-nums text-[#6d7d4f]">
                  {hooWorldStallTotal.toLocaleString()}
                </strong>
              </div>
            </div>

            <section className="rounded-[18px] border border-[#c9b084]/60 bg-[#fff7e6]/72 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black tracking-[0.12em] text-[#71835b]">
                    COMMUNITY FUND
                  </p>

                  <h3 className="mt-0.5 text-sm font-black text-[#5c4937]">
                    공동 모금에 HOO COIN 넣기
                  </h3>
                </div>

                <span className="shrink-0 text-[10px] font-bold tabular-nums text-[#9a856d]">
                  보유 {hooCoinBalance.toLocaleString()}
                </span>
              </div>

              <div className="mt-2 flex gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#cdb38a] bg-white/90 px-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      hooWorldStallDonationAmount
                    }
                    onChange={(event) => {
                      const digitsOnly =
                        event.target.value.replace(
                          /[^0-9]/g,
                          "",
                        );

                      setHooWorldStallDonationAmount(
                        digitsOnly,
                      );

                      setHooWorldStallDonationMessage(
                        null,
                      );
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        event.preventDefault();

                        void submitDonation();
                      }
                    }}
                    placeholder="넣을 코인"
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm font-black outline-none placeholder:text-[#b2a28e]"
                  />

                  <span className="shrink-0 text-[10px] font-black text-[#7b6a57]">
                    HOO
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void submitDonation();
                  }}
                  disabled={
                    isSubmittingHooWorldStallDonation ||
                    hooWorldStallDonationAmount.trim()
                      .length === 0
                  }
                  className="flex h-10 shrink-0 items-center justify-center rounded-xl border border-[#667650] bg-gradient-to-b from-[#84956c] to-[#667950] px-4 text-xs font-black text-[#fff9e9] shadow-[0_4px_10px_rgba(82,100,71,0.18)] transition hover:from-[#788b61] hover:to-[#5d7148] active:translate-y-[1px] disabled:cursor-not-allowed disabled:border-[#a6ad9b] disabled:bg-gradient-to-b disabled:from-[#d9dfd1] disabled:to-[#c4ccb9] disabled:text-[#6e7864] disabled:shadow-none"
                >
                  {isSubmittingHooWorldStallDonation
                    ? "넣는 중..."
                    : "공동 모금"}
                </button>
              </div>

              {hooWorldStallDonationMessage ? (
                <p className="mt-2 text-center text-[10px] font-black leading-4 text-[#71835b]">
                  {hooWorldStallDonationMessage}
                </p>
              ) : (
                <p className="mt-2 text-center text-[9px] font-bold leading-4 text-[#9c8870]">
                  넣은 HOO COIN은 공동 제작비로 사용돼요.
                </p>
              )}
            </section>

            <section className="rounded-[22px] border border-[#ceb489]/55 bg-[#fffaf0]/80 p-4">
              <p className="text-[10px] font-black tracking-[0.15em] text-[#71835b]">
                ITEM REQUEST
              </p>

              <h3 className="mt-1 text-lg font-black">
                원하는 물건 제작 요청
              </h3>

              <p className="mt-1 text-xs font-bold leading-5 text-[#89745c]">
                원하는 아이템 정보와 “이 정도면 충분하다” 싶은 코인을 함께 제시해 주세요.
              </p>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black text-[#80694e]">
                    요청내용
                  </span>

                  <span className="shrink-0 text-[10px] font-black tabular-nums text-[#8a795f]">
                    {Array.from(
                      hooWorldStallRequestText,
                    ).length}
                    /500
                  </span>
                </div>

                <textarea
                  maxLength={500}
                  rows={4}
                  value={
                    hooWorldStallRequestText
                  }
                  onChange={(event) => {
                    const nextValue =
                      Array.from(
                        event.target.value,
                      )
                        .slice(
                          0,
                          500,
                        )
                        .join("");

                    setHooWorldStallRequestText(
                      nextValue,
                    );

                    setHooWorldStallRequestMessage(
                      null,
                    );
                  }}
                  placeholder="예: 캠핑카, 작은 나무 메뉴판, 감성 조명 의자"
                  className="mt-2 w-full resize-none rounded-xl border border-[#cdb38a] bg-white/85 px-4 py-3 text-sm font-black leading-5 outline-none transition focus:border-[#799266] focus:ring-2 focus:ring-[#799266]/15"
                />
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black text-[#80694e]">
                    코인 제시
                  </span>

                  <span className="text-[10px] font-bold text-[#9b866c]">
                    공동 모금액과 별개
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#cdb38a] bg-white/90 px-4">
                  <input
                    inputMode="numeric"
                    value={
                      hooWorldStallRequestOfferedCoin
                    }
                    onChange={(event) => {
                      const digitsOnly =
                        event.target.value.replace(
                          /[^0-9]/g,
                          "",
                        );

                      setHooWorldStallRequestOfferedCoin(
                        digitsOnly,
                      );

                      setHooWorldStallRequestMessage(
                        null,
                      );
                    }}
                    placeholder="예: 100"
                    className="h-12 w-full bg-transparent text-sm font-black outline-none placeholder:text-[#b2a28e]"
                  />

                  <span className="shrink-0 text-xs font-black text-[#7b6a57]">
                    HOO COIN
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  void submitRequest();
                }}
                disabled={
                  isSubmittingHooWorldStallRequest ||
                  hooWorldStallRequestText.trim()
                    .length === 0 ||
                  hooWorldStallRequestOfferedCoin.trim()
                    .length === 0
                }
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-[#4f6444] bg-gradient-to-b from-[#7e966a] to-[#5f7452] text-sm font-black tracking-[0.02em] text-[#fff7e8] shadow-[0_6px_16px_rgba(82,100,71,0.22)] transition hover:from-[#70885e] hover:to-[#556848] active:translate-y-[1px] disabled:cursor-not-allowed disabled:border-[#95a287] disabled:bg-gradient-to-b disabled:from-[#d9dfd1] disabled:to-[#bcc7b1] disabled:text-[#55624a] disabled:shadow-none"
              >
                {isSubmittingHooWorldStallRequest
                  ? "요청 중..."
                  : "제작 요청 보내기"}
              </button>

              {hooWorldStallRequestMessage ? (
                <p className="mt-2 text-center text-[10px] font-black leading-4 text-[#71835b]">
                  {hooWorldStallRequestMessage}
                </p>
              ) : (
                <p className="mt-2 text-center text-[10px] font-bold leading-4 text-[#a08c74]">
                  요청 등록과 제작 시작만으로는 HOO COIN이 차감되지 않고, 제시 코인은 운영진과 소통하는 기준값이에요.
                </p>
              )}
            </section>

            <p className="text-center text-[10px] font-bold text-[#9b866c]">
              ESC 닫기
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}

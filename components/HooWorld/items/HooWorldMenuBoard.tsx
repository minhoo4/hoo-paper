"use client";

import {
  type CSSProperties,
  type MutableRefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import HooWorldItem from "@/components/HooWorld/items/HooWorldItem";

type HooWorldPosition = {
  x: number;
  y: number;
};

type HooWorldMenuBoardProps = {
  x?: number;
  y?: number;
  playerPositionRef: MutableRefObject<HooWorldPosition>;
  onBeforeOpen?: () => void;
};

const HOO_WORLD_MENU_BOARD_ITEM_ID =
  "hoo-world-menu-board";

const HOO_WORLD_MENU_ITEMS = [
  {
    icon: "🔥",
    name: "장작",
    price: "1 HC",
  },
  {
    icon: "🍜",
    name: "매콤한 라면",
    price: "3 HC",
  },
  {
    icon: "🍖",
    name: "랜덤요리 4인분",
    price: "10 HC",
  },
  {
    icon: "🎆",
    name: "불꽃놀이 세트",
    price: "20 HC",
  },
] as const;

const HOO_WORLD_CHALK_FONT_FAMILY =
  '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

const HOO_WORLD_CHALK_ROTATION_MAP = [
  "-1.45deg",
  "0.95deg",
  "-0.7deg",
  "1.2deg",
] as const;

function getHooWorldChalkRotation(
  index: number,
) {
  return HOO_WORLD_CHALK_ROTATION_MAP[
    index %
      HOO_WORLD_CHALK_ROTATION_MAP.length
  ];
}

function getHooWorldChalkFill(
  density: "soft" | "rich",
) {
  return density === "rich"
    ? [
        "radial-gradient(circle at 18% 24%, rgba(255,255,255,0.98) 0 14%, rgba(255,255,255,0.24) 15% 24%, transparent 25%)",
        "radial-gradient(circle at 76% 20%, rgba(247,240,224,0.95) 0 13%, rgba(247,240,224,0.20) 14% 22%, transparent 23%)",
        "radial-gradient(circle at 36% 72%, rgba(255,252,245,0.92) 0 12%, rgba(255,252,245,0.18) 13% 20%, transparent 21%)",
        "radial-gradient(circle at 70% 70%, rgba(248,243,230,0.88) 0 10%, rgba(248,243,230,0.16) 11% 18%, transparent 19%)",
        "linear-gradient(180deg, rgba(255,250,241,0.98), rgba(238,231,214,0.92))",
      ].join(", ")
    : [
        "radial-gradient(circle at 20% 28%, rgba(255,255,255,0.95) 0 12%, rgba(255,255,255,0.18) 13% 22%, transparent 23%)",
        "radial-gradient(circle at 72% 24%, rgba(245,239,223,0.92) 0 12%, rgba(245,239,223,0.16) 13% 22%, transparent 23%)",
        "radial-gradient(circle at 44% 74%, rgba(255,250,241,0.88) 0 10%, rgba(255,250,241,0.15) 11% 19%, transparent 20%)",
        "linear-gradient(180deg, rgba(255,249,240,0.96), rgba(239,232,217,0.90))",
      ].join(", ");
}

function getHooWorldChalkTextStyle(
  index: number,
  variant:
    | "miniLabel"
    | "miniPrice"
    | "panelLabel"
    | "panelPrice"
    | "caption",
): CSSProperties {
  const rotation =
    variant === "caption"
      ? "-1deg"
      : getHooWorldChalkRotation(index);

  const isMini =
    variant === "miniLabel" ||
    variant === "miniPrice";
  const isPrice =
    variant === "miniPrice" ||
    variant === "panelPrice";
  const isCaption =
    variant === "caption";

  return {
    fontFamily:
      HOO_WORLD_CHALK_FONT_FAMILY,
    fontWeight: isCaption ? 800 : 900,
    letterSpacing: isPrice
      ? "0.01em"
      : isMini
        ? "-0.065em"
        : "-0.07em",
    transform: `translateY(${isMini ? "0.4px" : "0.7px"}) rotate(${isPrice ? (index % 2 === 0 ? "0.55deg" : "-0.5deg") : rotation})`,
    color: "transparent",
    backgroundImage:
      getHooWorldChalkFill(
        isMini ? "soft" : "rich",
      ),
    backgroundSize: isMini
      ? "9px 9px, 10px 10px, 8px 8px, 100% 100%"
      : "12px 12px, 13px 13px, 10px 10px, 11px 11px, 100% 100%",
    backgroundPosition:
      index % 2 === 0
        ? "0 0, 4px 2px, 2px 5px, 0 0, 0 0"
        : "2px 1px, 0 3px, 5px 4px, 1px 0, 0 0",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextStroke: isMini
      ? "0.28px rgba(250,245,232,0.82)"
      : isCaption
        ? "0.5px rgba(248,243,229,0.84)"
        : "0.45px rgba(250,245,232,0.84)",
    textShadow: isMini
      ? "0.4px 0 rgba(255,255,255,0.18), -0.25px 0 rgba(255,255,255,0.1), 0 0 1px rgba(255,255,255,0.12), 0 1px 0 rgba(0,0,0,0.12)"
      : "0.8px 0 rgba(255,255,255,0.18), -0.55px 0 rgba(255,255,255,0.1), 0 0 1.8px rgba(255,255,255,0.14), 0 1px 0 rgba(0,0,0,0.14)",
    filter: isMini
      ? "drop-shadow(0 0 0.45px rgba(255,255,255,0.18))"
      : "drop-shadow(0 0 0.65px rgba(255,255,255,0.2))",
    lineHeight: 1,
    textRendering: "geometricPrecision",
  };
}

function isTypingTarget(
  target: EventTarget | null,
) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (
      target instanceof HTMLElement &&
      target.isContentEditable
    )
  );
}

export default function HooWorldMenuBoard({
  x = 67,
  y = 60,
  playerPositionRef,
  onBeforeOpen,
}: HooWorldMenuBoardProps) {
  const menuBoardElementRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const promptElementRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const [
    isMenuOpen,
    setIsMenuOpen,
  ] = useState(false);

  const isMenuOpenRef =
    useRef(false);

  function setMenuVisible(
    nextVisible: boolean,
  ) {
    if (
      isMenuOpenRef.current ===
      nextVisible
    ) {
      return;
    }

    isMenuOpenRef.current =
      nextVisible;

    setIsMenuOpen(
      nextVisible,
    );
  }

  /*
   * 메뉴판 고유 기능
   *
   * - X 이동 / 위치 저장 / Realtime 동기화:
   *   공용 HooWorldItem 담당
   *
   * - F 메뉴 열기 / 닫기:
   *   이 컴포넌트 담당
   */
  useEffect(() => {
    const menuBoardElement =
      menuBoardElementRef.current;

    const promptElement =
      promptElementRef.current;

    if (
      !menuBoardElement ||
      !promptElement
    ) {
      return;
    }

    const activeMenuBoardElement =
      menuBoardElement;

    const activePromptElement =
      promptElement;

    let isNearMenuBoard =
      false;

    let interactionFrame:
      number | null =
      null;

    function getClosestInteractiveItemId() {
      const current =
        playerPositionRef.current;

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

      const interactiveItems =
        document.querySelectorAll<HTMLElement>(
          '[data-hoo-world-item="true"][data-hoo-world-interactive="true"]',
        );

      let closestItemId:
        string | null =
        null;

      let closestDistance =
        Number.POSITIVE_INFINITY;

      interactiveItems.forEach(
        (itemElement) => {
          const rect =
            itemElement.getBoundingClientRect();

          if (
            rect.width <= 0 ||
            rect.height <= 0
          ) {
            return;
          }

          const centerX =
            rect.left +
            rect.width /
              2;

          const centerY =
            rect.bottom -
            Math.min(
              10,
              rect.height *
                0.08,
            );

          const deltaX =
            playerPixelX -
            centerX;

          const deltaY =
            playerPixelY -
            centerY;

          const distance =
            deltaX *
              deltaX +
            deltaY *
              deltaY;

          if (
            distance >=
            closestDistance
          ) {
            return;
          }

          const candidateId =
            itemElement.dataset
              .hooWorldItemId;

          if (!candidateId) {
            return;
          }

          closestDistance =
            distance;

          closestItemId =
            candidateId;
        },
      );

      return closestItemId;
    }

    function setPromptVisible(
      nextVisible: boolean,
    ) {
      activePromptElement.style.display =
        nextVisible
          ? "flex"
          : "none";

      activePromptElement.setAttribute(
        "aria-hidden",
        nextVisible
          ? "false"
          : "true",
      );
    }

    function updateInteraction() {
      const current =
        playerPositionRef.current;

      const boardRect =
        activeMenuBoardElement.getBoundingClientRect();

      if (
        boardRect.width <= 0 ||
        boardRect.height <= 0
      ) {
        isNearMenuBoard =
          false;

        setPromptVisible(
          false,
        );

        setMenuVisible(
          false,
        );

        interactionFrame =
          requestAnimationFrame(
            updateInteraction,
          );

        return;
      }

      const isMovingBoard =
        activeMenuBoardElement.dataset
          .hooWorldItemMoveMode ===
        "true";

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
        boardRect.left +
        boardRect.width /
          2;

      const interactionCenterY =
        boardRect.bottom -
        Math.min(
          8,
          boardRect.height *
            0.08,
        );

      /*
       * 작은 오브젝트라 실제 시각 크기보다
       * F 상호작용 범위를 조금 넉넉하게 사용한다.
       */
      const interactionRadiusX =
        Math.max(
          82,
          boardRect.width *
            1.2,
        );

      const interactionRadiusY =
        Math.max(
          62,
          boardRect.height *
            0.9,
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

      const nextIsNearMenuBoard =
        normalizedX *
          normalizedX +
          normalizedY *
            normalizedY <=
        1;

      isNearMenuBoard =
        nextIsNearMenuBoard;

      const isClosestInteractiveItem =
        getClosestInteractiveItemId() ===
        HOO_WORLD_MENU_BOARD_ITEM_ID;

      setPromptVisible(
        nextIsNearMenuBoard &&
          isClosestInteractiveItem &&
          !isMovingBoard,
      );

      /*
       * 메뉴판에서 멀어지거나
       * X 이동모드가 시작되면 메뉴를 자동으로 닫는다.
       */
      if (
        !nextIsNearMenuBoard ||
        isMovingBoard
      ) {
        setMenuVisible(
          false,
        );
      }

      interactionFrame =
        requestAnimationFrame(
          updateInteraction,
        );
    }

    function handleInteraction(
      event: KeyboardEvent,
    ) {
      if (
        event.repeat ||
        isTypingTarget(
          event.target,
        )
      ) {
        return;
      }

      if (
        event.code ===
          "Escape" &&
        isMenuOpenRef.current
      ) {
        event.preventDefault();

        setMenuVisible(
          false,
        );

        return;
      }

      if (
        event.code !==
          "KeyF" ||
        !isNearMenuBoard
      ) {
        return;
      }

      if (
        activeMenuBoardElement.dataset
          .hooWorldItemMoveMode ===
        "true"
      ) {
        return;
      }

      if (
        document.querySelector(
          "dialog[open]",
        )
      ) {
        return;
      }

      if (
        getClosestInteractiveItemId() !==
        HOO_WORLD_MENU_BOARD_ITEM_ID
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      const nextOpen =
        !isMenuOpenRef.current;

      if (nextOpen) {
        onBeforeOpen?.();
      }

      setMenuVisible(
        nextOpen,
      );
    }

    window.addEventListener(
      "keydown",
      handleInteraction,
      true,
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

      window.removeEventListener(
        "keydown",
        handleInteraction,
        true,
      );
    };
  }, [
    onBeforeOpen,
    playerPositionRef,
  ]);

  return (
    <>
      {/* ─────────────────────────
          필드 설치용 메뉴판
          - 가판대 약 50% 크기
          - X 이동 가능
          - 충돌 / Realtime 위치 공유
          - 가까이 접근 시 F 메뉴 보기
      ───────────────────────── */}
      <HooWorldItem
        ref={menuBoardElementRef}
        itemId={HOO_WORLD_MENU_BOARD_ITEM_ID}
        itemType="menu-board"
        x={x}
        y={y}
        width={132}
        height={132}
        movable
        collision
        collisionBottomRatio={0.16}
        interactive
        zIndex={12}
      >
        <div
          className="relative h-full w-full"
          data-hoo-world-menu-board="true"
        >
          <div
            data-hoo-world-collision-anchor="true"
            className="pointer-events-none absolute bottom-[10px] left-1/2 h-[4px] w-[84px] -translate-x-1/2"
          />

          <div className="pointer-events-none absolute bottom-[1px] left-1/2 h-[14px] w-[96px] -translate-x-1/2 rounded-[50%] bg-[rgba(25,26,20,0.20)] blur-[4px]" />

          {/* 좌우 기둥 */}
          <div className="pointer-events-none absolute bottom-[10px] left-[14px] h-[86px] w-[12px] rounded-[8px] border-[2px] border-[#6a4128] bg-gradient-to-r from-[#7b4a2f] via-[#c27d4d] to-[#7a492f] shadow-[2px_3px_4px_rgba(42,27,18,0.25)]" />
          <div className="pointer-events-none absolute bottom-[10px] right-[14px] h-[86px] w-[12px] rounded-[8px] border-[2px] border-[#6a4128] bg-gradient-to-r from-[#72442b] via-[#b97649] to-[#74452d] shadow-[2px_3px_4px_rgba(42,27,18,0.25)]" />

          {/* 상단 아치 */}
          <div className="pointer-events-none absolute left-1/2 top-[6px] h-[42px] w-[104px] -translate-x-1/2 overflow-hidden rounded-[48%_48%_12px_12px] border-[2px] border-[#6c4229] bg-gradient-to-b from-[#ca8a56] via-[#a8673f] to-[#844f31] shadow-[0_5px_8px_rgba(45,31,23,0.24)]">
            <div className="absolute inset-[3px] rounded-[46%_46%_9px_9px] border border-[#efb777]/20" />
            <span className="absolute left-1/2 top-[-7px] flex h-[20px] w-[20px] -translate-x-1/2 items-center justify-center rounded-full border border-[#b47422]/50 bg-gradient-to-br from-[#ffe08c] to-[#f2b73c] text-[12px] text-[#fff6c6] shadow-[0_2px_4px_rgba(95,58,22,0.28)]">✦</span>
            <span className="absolute left-[10px] top-[6px] h-[8px] w-[16px] -rotate-[30deg] rounded-[100%_0_100%_0] bg-gradient-to-br from-[#a7d065] to-[#567f36]" />
            <span className="absolute left-[21px] top-[3px] h-[7px] w-[14px] rotate-[18deg] rounded-[100%_0_100%_0] bg-gradient-to-br from-[#8eb755] to-[#4d7333]" />
            <span className="absolute right-[10px] top-[6px] h-[8px] w-[16px] rotate-[30deg] rounded-[0_100%_0_100%] bg-gradient-to-bl from-[#a7d065] to-[#567f36]" />
            <span className="absolute right-[21px] top-[3px] h-[7px] w-[14px] -rotate-[18deg] rounded-[0_100%_0_100%] bg-gradient-to-bl from-[#8eb755] to-[#4d7333]" />
            <span className="absolute left-[4px] top-[12px] flex h-[12px] w-[12px] items-center justify-center rounded-full bg-[#fff8e6] text-[8px] text-[#e7b84d] shadow-sm">✿</span>
            <span className="absolute right-[4px] top-[12px] flex h-[12px] w-[12px] items-center justify-center rounded-full bg-[#fff8e6] text-[8px] text-[#e7b84d] shadow-sm">✿</span>
            <div className="absolute inset-x-0 bottom-[4px] text-center">
              <p className="text-[10px] font-black tracking-[-0.04em] text-[#fff3dc] drop-shadow-[0_1px_1px_rgba(74,44,24,0.44)]">
                후월드 메뉴
              </p>
              <p className="mt-[-1px] text-[4px] font-black tracking-[0.18em] text-[#ffe4af]">
                ♥ HOO WORLD ♥
              </p>
            </div>
          </div>

          {/* 본체 */}
          <div className="pointer-events-none absolute bottom-[14px] left-1/2 h-[74px] w-[94px] -translate-x-1/2 rounded-[10px] border-[2px] border-[#5f3822] bg-gradient-to-b from-[#9e6038] to-[#72442b] shadow-[0_5px_8px_rgba(40,27,19,0.28)]">
            <div className="absolute inset-[4px] rounded-[7px] border border-[#d69158]/25 bg-[#845235]" />
            <span className="absolute left-[4px] top-[4px] h-[5px] w-[5px] rounded-full border border-[#a66a1d] bg-gradient-to-br from-[#ffe38b] to-[#b9751f]" />
            <span className="absolute right-[4px] top-[4px] h-[5px] w-[5px] rounded-full border border-[#a66a1d] bg-gradient-to-br from-[#ffe38b] to-[#b9751f]" />
            <span className="absolute left-[4px] bottom-[4px] h-[5px] w-[5px] rounded-full border border-[#a66a1d] bg-gradient-to-br from-[#ffe38b] to-[#b9751f]" />
            <span className="absolute right-[4px] bottom-[4px] h-[5px] w-[5px] rounded-full border border-[#a66a1d] bg-gradient-to-br from-[#ffe38b] to-[#b9751f]" />

            <div className="absolute inset-[8px] overflow-hidden rounded-[5px] border border-[#32271f] bg-gradient-to-b from-[#213c31] via-[#193127] to-[#12251d] px-[5px] py-[4px] shadow-[inset_0_3px_6px_rgba(0,0,0,0.38)]">
              <span className="absolute left-[8px] top-[6px] h-px w-[19px] -rotate-3 bg-white/8" />
              <span className="absolute right-[9px] bottom-[7px] h-px w-[18px] rotate-2 bg-white/8" />

              {HOO_WORLD_MENU_ITEMS.map((menu, index) => (
                <div
                  key={menu.name}
                  className={`flex h-[12px] items-center gap-[3px] ${
                    index !== 0
                      ? "border-t border-dashed border-[#efe7d2]/15"
                      : ""
                  }`}
                >
                  <span className="flex h-[8px] w-[8px] shrink-0 items-center justify-center text-[6px] text-[#f2ead6]">
                    {menu.icon}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-[5px] leading-none text-[#f8f0de]"
                    style={getHooWorldChalkTextStyle(
                      index,
                      "miniLabel",
                    )}
                  >
                    {menu.name}
                  </span>
                  <span
                    className="shrink-0 text-[5px] leading-none tabular-nums text-[#f1e7cf]"
                    style={getHooWorldChalkTextStyle(
                      index,
                      "miniPrice",
                    )}
                  >
                    {menu.price}
                  </span>
                </div>
              ))}

              <div className="absolute bottom-[2px] left-[4px] text-[5px] text-[#d7e1c6]/85">♧</div>
              <div className="absolute bottom-[2px] right-[4px] text-[7px] text-[#ffd9df]/85">♡</div>
            </div>
          </div>

          {/* 좌측 랜턴 */}
          <div className="pointer-events-none absolute left-[0px] top-[52px] z-[5] h-[34px] w-[20px]">
            <div className="absolute left-1/2 top-[-5px] h-[7px] w-[2px] -translate-x-1/2 rounded-full bg-[#493629]" />
            <div className="absolute left-1/2 top-0 h-[5px] w-[12px] -translate-x-1/2 rounded-t-[4px] bg-[#4b392d]" />
            <div className="absolute left-1/2 top-[4px] flex h-[18px] w-[16px] -translate-x-1/2 items-center justify-center rounded-[4px] border border-[#634b36] bg-gradient-to-b from-[#fff3b8] via-[#ffd25d] to-[#d58a24] text-[9px] text-[#fff8d0] shadow-[0_0_12px_rgba(255,205,86,0.60)]">✦</div>
            <div className="absolute bottom-[2px] left-1/2 h-[6px] w-[12px] -translate-x-1/2 rounded-b-[4px] bg-[#4b392d]" />
          </div>

          {/* 우측 매달린 태그 */}
          <div className="pointer-events-none absolute right-[-2px] top-[52px] z-[5] h-[43px] w-[24px]">
            <span className="absolute left-[13px] top-[-7px] h-[10px] w-[2px] rotate-[8deg] rounded-full bg-[#745136]" />
            <span className="absolute left-[8px] top-[-7px] h-[10px] w-[2px] -rotate-[8deg] rounded-full bg-[#745136]" />
            <div className="absolute left-1/2 top-[1px] flex h-[36px] w-[22px] -translate-x-1/2 flex-col items-center justify-center rounded-[6px] border border-[#6e452d] bg-gradient-to-b from-[#cb8955] to-[#955936] text-[#fff1cd] shadow-[0_3px_6px_rgba(43,30,20,0.26)]">
              <span className="text-[7px]">♡</span>
              <span className="mt-[-1px] text-[4px] font-black leading-[1.1]">좋은</span>
              <span className="text-[4px] font-black leading-[1.1]">시간</span>
            </div>
          </div>

          <span className="pointer-events-none absolute bottom-[10px] left-[10px] z-[5] h-[20px] w-[8px] rotate-[16deg] rounded-[100%_0_100%_0] bg-gradient-to-br from-[#95bc58] to-[#557c39]" />
          <span className="pointer-events-none absolute bottom-[7px] left-[20px] z-[5] flex h-[13px] w-[13px] items-center justify-center rounded-full bg-[#fff8e6] text-[8px] text-[#e6b84d] shadow-sm">✿</span>
          <span className="pointer-events-none absolute bottom-[8px] right-[18px] z-[5] flex h-[13px] w-[13px] items-center justify-center rounded-full bg-[#fff8e6] text-[8px] text-[#e6b84d] shadow-sm">✿</span>
          <span className="pointer-events-none absolute bottom-[10px] right-[10px] z-[5] h-[20px] w-[8px] -rotate-[16deg] rounded-[0_100%_0_100%] bg-gradient-to-bl from-[#95bc58] to-[#557c39]" />

          <div
            ref={promptElementRef}
            data-hoo-world-menu-board-prompt="true"
            aria-hidden="true"
            className="absolute -top-[31px] left-1/2 z-[90] -translate-x-1/2 items-center gap-[5px] whitespace-nowrap rounded-[12px] border border-[#fff4dd]/50 bg-[#f6edde]/96 px-[8px] py-[5px] shadow-[0_4px_10px_rgba(33,30,24,0.25)]"
            style={{ display: "none" }}
          >
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-[#32322d] text-[9px] font-black text-white">
              F
            </span>
            <span className="text-[7px] font-black text-[#3f382f]">
              메뉴 보기
            </span>
          </div>
        </div>
      </HooWorldItem>

      {/* ─────────────────────────
          왼쪽 하단 메뉴판 UI
          - 비클릭 안내 전용
          - 최대 4개 메뉴
          - 아래 → 위 슬라이드 등장
          - 거칠고 투박한 캠프 보급판 스타일
      ───────────────────────── */}
      <aside
        aria-hidden={!isMenuOpen}
        data-hoo-world-menu-board-panel="true"
        className={`pointer-events-none fixed bottom-4 left-4 z-[105] w-[min(92vw,540px)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isMenuOpen
            ? "translate-y-0 opacity-100"
            : "translate-y-[calc(100%+56px)] opacity-0"
        }`}
      >
        <div className="relative px-[18px] pb-[18px] pt-[34px]">
          {/* 묵직한 바닥 그림자 */}
          <div className="absolute bottom-[8px] left-1/2 h-[34px] w-[88%] -translate-x-1/2 rounded-[50%] bg-black/35 blur-[16px]" />

          {/* 좌/우 거친 목재 기둥 */}
          <div className="absolute bottom-[30px] left-[12px] top-[96px] w-[38px] rotate-[-0.7deg] border-[4px] border-[#3e2619] bg-gradient-to-r from-[#4d2f21] via-[#6d432c] to-[#493020] shadow-[5px_7px_12px_rgba(25,17,12,0.34)]">
            <span className="absolute left-[7px] top-[14%] h-[3px] w-[24px] -rotate-6 bg-black/20" />
            <span className="absolute right-[4px] top-[48%] h-[2px] w-[20px] rotate-3 bg-[#b77b50]/18" />
            <span className="absolute left-[5px] bottom-[20%] h-[3px] w-[22px] rotate-6 bg-black/18" />
          </div>
          <div className="absolute bottom-[30px] right-[12px] top-[96px] w-[38px] rotate-[0.8deg] border-[4px] border-[#3e2619] bg-gradient-to-r from-[#493020] via-[#6a402a] to-[#4a2d1e] shadow-[-5px_7px_12px_rgba(25,17,12,0.34)]">
            <span className="absolute left-[6px] top-[21%] h-[3px] w-[22px] rotate-4 bg-black/18" />
            <span className="absolute right-[5px] top-[58%] h-[2px] w-[20px] -rotate-5 bg-[#b77b50]/16" />
          </div>

          {/* 메인 거친 프레임 */}
          <div className="relative z-[2] rotate-[-0.15deg] border-[6px] border-[#3b2417] bg-gradient-to-b from-[#5d3824] via-[#4b2d1e] to-[#382216] p-[14px] shadow-[0_20px_44px_rgba(18,14,10,0.42)]">
            {/* 상단 거친 현판 - 아치 대신 두꺼운 통나무 판 */}
            <div
              className="absolute left-1/2 top-[-88px] h-[128px] w-[calc(100%+34px)] -translate-x-1/2 overflow-hidden border-[6px] border-[#3b2417] bg-gradient-to-b from-[#7a492e] via-[#643b27] to-[#4d2e1f] shadow-[0_10px_18px_rgba(24,16,11,0.38)]"
              style={{
                clipPath:
                  "polygon(2% 13%, 12% 8%, 31% 10%, 47% 4%, 65% 9%, 87% 6%, 98% 14%, 100% 91%, 87% 96%, 68% 93%, 50% 98%, 29% 94%, 10% 97%, 0 90%)",
              }}
            >
              {/* 나뭇결 / 찍힘 */}
              <span className="absolute left-[6%] top-[23px] h-[4px] w-[33%] -rotate-2 bg-black/16" />
              <span className="absolute right-[7%] top-[38px] h-[3px] w-[28%] rotate-1 bg-[#bd8054]/14" />
              <span className="absolute left-[18%] top-[58px] h-[2px] w-[22%] rotate-2 bg-black/14" />
              <span className="absolute right-[22%] bottom-[18px] h-[3px] w-[31%] -rotate-2 bg-black/16" />
              <span className="absolute left-[4%] bottom-[22px] h-[10px] w-[20px] rounded-[50%] border-[3px] border-[#322017]/55" />
              <span className="absolute right-[5%] top-[22px] h-[8px] w-[16px] rounded-[50%] border-[3px] border-[#322017]/50" />

              {/* 거친 철판 중앙장식 */}
              <div className="absolute left-1/2 top-[7px] flex h-[34px] w-[46px] -translate-x-1/2 items-center justify-center border-[3px] border-[#332d27] bg-gradient-to-b from-[#5b5750] to-[#36322e] text-[18px] font-black text-[#d5bd88] shadow-[0_4px_7px_rgba(0,0,0,0.32)]">
                ×
              </div>

              {/* 대못 */}
              <span className="absolute left-[14px] top-[13px] h-[13px] w-[13px] rounded-full border-[3px] border-[#28231f] bg-gradient-to-br from-[#716d64] to-[#393632] shadow-[1px_2px_3px_rgba(0,0,0,0.30)]" />
              <span className="absolute right-[14px] top-[13px] h-[13px] w-[13px] rounded-full border-[3px] border-[#28231f] bg-gradient-to-br from-[#716d64] to-[#393632] shadow-[1px_2px_3px_rgba(0,0,0,0.30)]" />

              <div className="absolute inset-x-0 bottom-[18px] text-center">
                <h2 className="text-[31px] font-black tracking-[-0.055em] drop-shadow-[0_3px_1px_rgba(28,18,12,0.55)]">
                  <span className="text-[#eee0c5]">후월드 </span>
                  <span className="text-[#cfa66d]">메뉴</span>
                </h2>
                <p className="mt-[2px] text-[10px] font-black tracking-[0.24em] text-[#c3aa87]">
                  HOO WORLD · CAMP SUPPLY
                </p>
              </div>
            </div>

            {/* 바깥 철제 보강대 */}
            <div className="absolute left-[-10px] top-[72px] h-[82px] w-[22px] border-[3px] border-[#282522] bg-gradient-to-r from-[#47423c] via-[#666058] to-[#393632] shadow-[3px_4px_6px_rgba(0,0,0,0.28)]">
              <span className="absolute left-1/2 top-[10px] h-[8px] w-[8px] -translate-x-1/2 rounded-full bg-[#22201e]" />
              <span className="absolute bottom-[10px] left-1/2 h-[8px] w-[8px] -translate-x-1/2 rounded-full bg-[#22201e]" />
            </div>
            <div className="absolute right-[-10px] top-[72px] h-[82px] w-[22px] border-[3px] border-[#282522] bg-gradient-to-r from-[#393632] via-[#666058] to-[#47423c] shadow-[-3px_4px_6px_rgba(0,0,0,0.28)]">
              <span className="absolute left-1/2 top-[10px] h-[8px] w-[8px] -translate-x-1/2 rounded-full bg-[#22201e]" />
              <span className="absolute bottom-[10px] left-1/2 h-[8px] w-[8px] -translate-x-1/2 rounded-full bg-[#22201e]" />
            </div>

            {/* 칠판 본체 - 둥근 모서리 제거 */}
            <div className="relative overflow-hidden border-[5px] border-[#251f19] bg-gradient-to-b from-[#1c3028] via-[#172a22] to-[#102018] px-[22px] pb-[23px] pt-[20px] shadow-[inset_0_9px_22px_rgba(0,0,0,0.48)]">
              {/* 칠판 스크래치 / 닦인 자국 */}
              <span className="absolute left-[5%] top-[11%] h-px w-[31%] -rotate-2 bg-white/7" />
              <span className="absolute right-[6%] top-[37%] h-px w-[27%] rotate-1 bg-white/6" />
              <span className="absolute left-[17%] top-[63%] h-px w-[22%] rotate-2 bg-white/5" />
              <span className="absolute right-[18%] bottom-[15%] h-px w-[29%] -rotate-2 bg-white/5" />
              <span className="absolute left-[8%] bottom-[7%] h-[18px] w-[62px] rotate-[-3deg] border-t border-white/5" />

              {HOO_WORLD_MENU_ITEMS.map((menu, index) => (
                <div
                  key={menu.name}
                  className={`relative flex min-h-[72px] items-center gap-[14px] ${
                    index !== HOO_WORLD_MENU_ITEMS.length - 1
                      ? "border-b-2 border-dashed border-[#d7cdb7]/20"
                      : ""
                  }`}
                >
                  {/* 아이콘도 메탈 원형 대신 낡은 사각 태그 */}
                  <span className="flex h-[44px] w-[44px] shrink-0 rotate-[-1deg] items-center justify-center border-[2px] border-[#4b4842] bg-[#232d28]/70 text-[23px] text-[#e7ddc6] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    {menu.icon}
                  </span>

                  <span
                    className="min-w-0 shrink-0 text-[22px] leading-none text-[#f7efdb]"
                    style={getHooWorldChalkTextStyle(
                      index,
                      "panelLabel",
                    )}
                  >
                    {menu.name}
                  </span>

                  <span className="relative h-[8px] min-w-[28px] flex-1 overflow-hidden">
                    <span className="absolute inset-x-0 top-[3px] border-t-[3px] border-dotted border-[#d9ceb8]/48" />
                    <span className="absolute left-[16%] right-[9%] top-[6px] border-t border-[#d9ceb8]/10" />
                  </span>

                  <span
                    className="shrink-0 text-[22px] leading-none tabular-nums text-[#f2e9d3]"
                    style={getHooWorldChalkTextStyle(
                      index,
                      "panelPrice",
                    )}
                  >
                    {menu.price}
                  </span>
                </div>
              ))}

              {/* 하단 낙서도 덜 귀엽고 거칠게 */}
              <div className="mt-[17px] flex items-end justify-between text-[#ded4bf]/78">
                <div className="flex items-end gap-[5px] text-[#c7c0ae]">
                  <span className="text-[27px] leading-none">△</span>
                  <span className="text-[21px] leading-none">×</span>
                  <span className="text-[18px] leading-none">△</span>
                </div>

                <div className="flex flex-col items-center">
                  <p
                    className="text-[15px] leading-none text-[#e9dfcb]"
                    style={getHooWorldChalkTextStyle(
                      0,
                      "caption",
                    )}
                  >
                    좋은 하루 되시는!
                  </p>
                  <span className="mt-[6px] h-[2px] w-[132px] -rotate-1 bg-[#d5cab5]/38" />
                </div>

                <div className="flex items-center gap-[2px] text-[#bfb6a4]">
                  <span className="text-[21px] leading-none">///</span>
                </div>
              </div>
            </div>

            {/* 하단 통나무 받침 */}
            <div className="mx-auto mt-[10px] h-[16px] w-[96%] border-[3px] border-[#3d2417] bg-gradient-to-b from-[#69412a] to-[#4d2e1e] shadow-[0_3px_4px_rgba(28,18,12,0.30)]">
              <span className="absolute left-[14%] mt-[4px] h-[2px] w-[24%] -rotate-1 bg-black/18" />
            </div>
          </div>

          {/* 왼쪽 철제 랜턴 - 장식성 축소 */}
          <div className="absolute left-[-5px] top-[154px] z-[5] h-[112px] w-[66px] rotate-[-1deg]">
            <span className="absolute left-[29px] top-[-27px] h-[36px] w-[5px] bg-[#26231f]" />
            <div className="absolute left-[7px] top-[6px] h-[18px] w-[45px] border-[3px] border-[#272421] bg-[#48433c]" />
            <div className="absolute left-[10px] top-[22px] flex h-[58px] w-[39px] items-center justify-center border-[3px] border-[#2d2925] bg-gradient-to-b from-[#d4a654] via-[#bd792c] to-[#70411c] text-[22px] font-black text-[#ffe0৮0] shadow-[0_0_18px_rgba(225,145,50,0.34)]">
              +
            </div>
            <div className="absolute left-[7px] top-[78px] h-[18px] w-[45px] border-[3px] border-[#272421] bg-[#48433c]" />
          </div>

          {/* 오른쪽 거친 나무 태그 */}
          <div className="absolute right-[-16px] top-[166px] z-[5] h-[128px] w-[60px] rotate-[1.5deg]">
            <span className="absolute left-[30px] top-[-24px] h-[31px] w-[4px] rotate-[7deg] bg-[#5b4634]" />
            <span className="absolute left-[17px] top-[-20px] h-[29px] w-[4px] -rotate-[8deg] bg-[#5b4634]" />
            <div className="absolute left-1/2 top-0 flex h-[108px] w-[54px] -translate-x-1/2 flex-col items-center border-[4px] border-[#3f271a] bg-gradient-to-b from-[#71472f] to-[#4b2f20] px-[5px] py-[9px] text-[#d8c8ae] shadow-[0_7px_12px_rgba(28,18,12,0.34)]">
              <span className="text-[15px] font-black">CAMP</span>
              <span className="mt-[4px] h-[2px] w-[34px] bg-black/25" />
              <span className="mt-[6px] text-[9px] font-black leading-[1.35]">좋은</span>
              <span className="text-[9px] font-black leading-[1.35]">시간</span>
              <span className="text-[9px] font-black leading-[1.35]">되는!</span>
              <span className="mt-auto text-[12px] text-[#a68f70]">×</span>
            </div>
          </div>

          {/* 하단 장식 대신 나무 조각/철못 */}
          <span className="absolute bottom-[20px] left-[6px] z-[6] h-[34px] w-[11px] rotate-[18deg] bg-[#553420] shadow-sm" />
          <span className="absolute bottom-[12px] left-[26px] z-[6] h-[18px] w-[18px] rotate-[-8deg] border-[3px] border-[#2c2925] bg-[#555049] shadow-md" />
          <span className="absolute bottom-[14px] right-[24px] z-[6] h-[18px] w-[18px] rotate-[7deg] border-[3px] border-[#2c2925] bg-[#555049] shadow-md" />
          <span className="absolute bottom-[22px] right-[6px] z-[5] h-[36px] w-[11px] -rotate-[17deg] bg-[#53311f] shadow-sm" />
        </div>

        <div className="mt-1 flex justify-center">
          <span className="border-2 border-[#62584b]/60 bg-[#252a25]/88 px-4 py-[5px] text-[10px] font-black text-[#ded7ca]/80 shadow-sm backdrop-blur-sm">
            F 다시 누르면 닫기
          </span>
        </div>
      </aside>
    </>
  );
}
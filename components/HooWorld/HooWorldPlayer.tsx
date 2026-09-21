"use client";

import {
  useRef,
} from "react";

import type {
  HooWorldPlayerStatus,
} from "./hooks/useHooWorldPresence";

import type {
  HooWorldPlayerFacing,
} from "./characters/types";

export type {
  HooWorldPlayerFacing,
} from "./characters/types";

/*
 * HOO WORLD 캐릭터 슬롯
 * - 1~7: 일반 유저용
 * - 8: 운영자 전용 M 핀 스킨
 * - 기본값: user-4 (초록색)
 */
export const HOO_WORLD_CHARACTER_SLOT_IMAGE_MAP = {
  1: "/hoo-world/characters/user-1.png",
  2: "/hoo-world/characters/user-2.png",
  3: "/hoo-world/characters/user-3.png",
  4: "/hoo-world/characters/user-4.png",
  5: "/hoo-world/characters/user-5.png",
  6: "/hoo-world/characters/user-6.png",
  7: "/hoo-world/characters/user-7.png",
  8: "/hoo-world/hoo-bubble-mascot.png",
} as const;

export const HOO_WORLD_FOCUS_CHARACTER_SLOT_IMAGE_MAP = {
  1: "/hoo-world/characters/focus/focus-red.png",
  2: "/hoo-world/characters/focus/focus-orange.png",
  3: "/hoo-world/characters/focus/focus-yellow.png",
  4: "/hoo-world/characters/focus/focus-green.png",
  5: "/hoo-world/characters/focus/focus-blue.png",
  6: "/hoo-world/characters/focus/focus-navy.png",
  7: "/hoo-world/characters/focus/focus-purple.png",
} as const;


export type HooWorldCharacterSlot =
  keyof typeof HOO_WORLD_CHARACTER_SLOT_IMAGE_MAP;

/*
 * HOO WORLD 이미지 정책
 *
 * - 이용자는 직접 이미지 파일/URL을 등록할 수 없다.
 * - 캐릭터 기본 이미지와 장신구 이미지는 운영자가 코드에 등록한
 *   로컬 정적 파일만 사용할 수 있다.
 * - 새 장신구 추가:
 *   1) public/hoo-world/accessories/ 아래에 PNG 추가
 *   2) 아래 카탈로그에 항목 1개 추가
 */
export const HOO_WORLD_ACCESSORY_CATALOG = [
  {
    id: "scarf_red",
    name: "빨간 목도리",
    imagePath:
      "/hoo-world/accessories/scarf-red.png",
    className:
      "absolute left-1/2 top-[72px] h-[54px] w-[102px] -translate-x-1/2 bg-contain bg-center bg-no-repeat",
  },
  {
    id: "santa_hat",
    name: "산타 모자",
    imagePath:
      "/hoo-world/accessories/santa-hat.png",
    className:
      "absolute left-1/2 top-[-10px] h-[52px] w-[96px] -translate-x-1/2 bg-contain bg-center bg-no-repeat",
  },
] as const;

export type HooWorldAccessoryId =
  (typeof HOO_WORLD_ACCESSORY_CATALOG)[number]["id"];

type HooWorldAccessoryDefinition =
  (typeof HOO_WORLD_ACCESSORY_CATALOG)[number];

const HOO_WORLD_ACCESSORY_BY_ID =
  new Map<
    HooWorldAccessoryId,
    HooWorldAccessoryDefinition
  >(
    HOO_WORLD_ACCESSORY_CATALOG.map(
      (accessory) => [
        accessory.id,
        accessory,
      ],
    ),
  );

function getApprovedAccessory(
  value: unknown,
) {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  return (
    HOO_WORLD_ACCESSORY_BY_ID.get(
      value as HooWorldAccessoryId,
    ) ?? null
  );
}


function getApprovedCharacterImagePath(
  slot: number | null | undefined,
  isAdmin: boolean,
) {
  if (
    slot === 8 &&
    !isAdmin
  ) {
    return HOO_WORLD_CHARACTER_SLOT_IMAGE_MAP[4];
  }

  if (
    slot &&
    slot in
      HOO_WORLD_CHARACTER_SLOT_IMAGE_MAP
  ) {
    return HOO_WORLD_CHARACTER_SLOT_IMAGE_MAP[
      slot as HooWorldCharacterSlot
    ];
  }

  /*
   * 기본 캐릭터는 항상 user-4 (초록색)
   */
  return HOO_WORLD_CHARACTER_SLOT_IMAGE_MAP[4];
}


function getFocusCharacterImagePath(
  slot: number | null | undefined,
) {
  if (
    slot &&
    slot in
      HOO_WORLD_FOCUS_CHARACTER_SLOT_IMAGE_MAP
  ) {
    return HOO_WORLD_FOCUS_CHARACTER_SLOT_IMAGE_MAP[
      slot as keyof typeof HOO_WORLD_FOCUS_CHARACTER_SLOT_IMAGE_MAP
    ];
  }

  /*
   * 포커스 기본 캐릭터도 4번 초록색
   */
  return HOO_WORLD_FOCUS_CHARACTER_SLOT_IMAGE_MAP[4];
}



type HooWorldPlayerProps = {
  nickname: string;
  status: HooWorldPlayerStatus;
  facing?: HooWorldPlayerFacing;

  /*
   * 기본 캐릭터 슬롯
   * - 1~5만 허용
   * - 값이 없거나 이상하면 user-01 사용
   */
  characterSlot?: number;

  /*
   * 운영자 전용 8번(M 핀) 스킨 사용 권한.
   * false인 사용자가 8번 값을 강제로 넣어도 user-4로 대체한다.
   */
  isAdmin?: boolean;

  /*
   * 앞으로 커스터마이징은 캐릭터 몸체 교체가 아니라
   * 목도리 / 모자 / 안경 / 가방 등의 장신구 방식으로 사용한다.
   */
  accessoryIds?: HooWorldAccessoryId[];

  /* 로컬 침낭 취침 UI용. 원격 캐릭터에는 전달하지 않는다. */
  sleepElapsedSeconds?: number;

  /* 빙결 누적 10분으로 발병한 감기. 행동 status와 별도로 유지한다. */
  hasCold?: boolean;

  /* 감기 발병 직후 로컬 캐릭터에 잠깐 보여 주는 안내 문구. */
  showColdNotice?: boolean;
} & Record<string, unknown>;

export default function HooWorldPlayer({
  nickname,
  status,
  facing = "down",
  characterSlot = 4,
  isAdmin = false,
  accessoryIds = [],
  sleepElapsedSeconds,
  hasCold = false,
  showColdNotice = false,
}: HooWorldPlayerProps) {
  const isFocusing =
    status === "focusing";

  const isDancing =
    status === "dancing";

  const isResting =
    status === "resting" ||
    status === "frozen_resting";

  const isFrozen =
    status === "frozen" ||
    status === "frozen_resting";

  const isCold =
    hasCold === true;

  const safeSleepElapsedSeconds =
    typeof sleepElapsedSeconds ===
      "number" &&
    Number.isFinite(
      sleepElapsedSeconds,
    )
      ? Math.max(
          0,
          Math.floor(
            sleepElapsedSeconds,
          ),
        )
      : null;

  const sleepElapsedLabel =
    safeSleepElapsedSeconds !==
      null
      ? `${Math.floor(
          safeSleepElapsedSeconds /
            60,
        )}:${String(
          safeSleepElapsedSeconds %
            60,
        ).padStart(2, "0")}`
      : null;

  const characterImagePath =
    isFocusing &&
    !(
      characterSlot === 8 &&
      isAdmin
    )
      ? getFocusCharacterImagePath(
          characterSlot,
        )
      : getApprovedCharacterImagePath(
          characterSlot,
          isAdmin,
        );

  return (
    <div className="flex flex-col items-center">
      <style jsx>{`
        @keyframes hoo-world-focus-bob {
          0%,
          100% {
            transform:
              translate3d(0, 0, 0)
              rotate(0deg);
          }

          50% {
            transform:
              translate3d(0, 2px, 0)
              rotate(-0.6deg);
          }
        }

        @keyframes hoo-world-resting-breathe {
          0%,
          100% {
            transform:
              translate3d(0, 7px, 0)
              rotate(0deg)
              scale(0.94);
          }

          50% {
            transform:
              translate3d(0, 5px, 0)
              rotate(0deg)
              scale(0.97);
          }
        }

        @keyframes hoo-world-frozen-shiver {
          0%,
          100% {
            transform:
              translate3d(-1px, 0, 0)
              rotate(-0.7deg);
          }

          50% {
            transform:
              translate3d(1px, -1px, 0)
              rotate(0.7deg);
          }
        }

        @keyframes hoo-world-frozen-resting {
          0%,
          100% {
            transform:
              translate3d(-1px, 7px, 0)
              rotate(-0.5deg)
              scale(0.94);
          }

          50% {
            transform:
              translate3d(1px, 5px, 0)
              rotate(0.5deg)
              scale(0.97);
          }
        }

        @keyframes hoo-world-cold-drip {
          0%,
          100% {
            transform:
              translate3d(-50%, 0, 0)
              scaleY(0.96);
          }

          50% {
            transform:
              translate3d(-50%, 2px, 0)
              scaleY(1.04);
          }
        }

        @keyframes hoo-world-dance-sway {
          0%,
          100% {
            transform:
              translate3d(0, 0, 0)
              rotate(-30deg);
          }

          25% {
            transform:
              translate3d(0, -4px, 0)
              rotate(0deg);
          }

          50% {
            transform:
              translate3d(0, 0, 0)
              rotate(30deg);
          }

          75% {
            transform:
              translate3d(0, -4px, 0)
              rotate(0deg);
          }
        }
      `}</style>

      <div className="relative flex h-[230px] w-[190px] items-end justify-center">
        <div
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-[#1f291f]/18 blur-[2px] transition-all duration-200 ${
            isResting
              ? "hidden"
              : isFocusing
                ? "bottom-[8px] h-[16px] w-[112px]"
                : "bottom-[10px] h-[14px] w-[62px]"
          }`}
        />

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
          <CharacterBody
            facing={facing}
            accessoryIds={accessoryIds}
            characterImagePath={
              characterImagePath
            }
            focusing={isFocusing}
            dancing={isDancing}
            resting={isResting}
            frozen={isFrozen}
            cold={isCold}
          />
        </div>
      </div>

      <div className="mt-2 max-w-[150px] truncate rounded-full border border-white/10 bg-[#142017]/78 px-3 py-1 text-center text-xs font-black text-white shadow-[0_3px_8px_rgba(20,35,23,0.24)] backdrop-blur-sm">
        {nickname}
      </div>

      <div className="mt-1 text-[10px] font-bold tracking-[0.05em] text-white/65 drop-shadow-[0_1px_2px_rgba(20,30,20,0.32)]">
        {isFocusing
          ? "집중 중"
          : isFrozen
            ? "빙결 중"
            : isResting
              ? "자는 중"
              : isCold
                ? "감기 중"
                : isDancing
                  ? "신나는 중"
                  : "쉬는 중"}
      </div>

      {showColdNotice ? (
        <div className="mt-1.5 whitespace-nowrap rounded-full border border-[#ffb7b7]/45 bg-[#4a1f24]/88 px-3 py-1 text-[10px] font-black text-[#ffe4e4] shadow-[0_3px_9px_rgba(45,15,20,0.28)] backdrop-blur-sm">
          감기에 걸렸습니다!
        </div>
      ) : null}

      {isResting &&
      sleepElapsedLabel ? (
        <div className="mt-1.5 whitespace-nowrap rounded-full border border-[#d7e8c9]/30 bg-[#182018]/78 px-2.5 py-1 text-[9px] font-black tabular-nums text-[#e6f2dc] shadow-[0_3px_8px_rgba(20,30,20,0.20)] backdrop-blur-sm">
          수면 유지 {sleepElapsedLabel}
        </div>
      ) : null}
    </div>
  );
}



type CharacterBodyProps = {
  facing: HooWorldPlayerFacing;
  accessoryIds: HooWorldAccessoryId[];
  characterImagePath: string;
  focusing?: boolean;
  dancing?: boolean;
  resting?: boolean;
  frozen?: boolean;
  cold?: boolean;
};

function CharacterBody({
  facing,
  accessoryIds,
  characterImagePath,
  focusing = false,
  dancing = false,
  resting = false,
  frozen = false,
  cold = false,
}: CharacterBodyProps) {
  /*
   * HOO 마스코트는 좌/우 방향만 실제 시각 방향으로 사용한다.
   * up/down이 들어와도 마지막 좌/우 방향을 그대로 유지한다.
   */
  const horizontalFacingRef =
    useRef<"left" | "right">(
      facing === "left"
        ? "left"
        : "right",
    );

  if (
    facing === "left" ||
    facing === "right"
  ) {
    horizontalFacingRef.current =
      facing;
  }

  const horizontalFacing =
    horizontalFacingRef.current;

  const mirrorX =
    horizontalFacing === "right"
      ? -1
      : 1;

  const characterMotionAnimation =
    frozen && resting
      ? "hoo-world-frozen-resting 0.24s steps(2, end) infinite"
      : frozen
        ? "hoo-world-frozen-shiver 0.22s steps(2, end) infinite"
        : resting
          ? "hoo-world-resting-breathe 2.2s ease-in-out infinite"
          : dancing
            ? "hoo-world-dance-sway 0.92s ease-in-out infinite"
            : focusing
              ? "hoo-world-focus-bob 1.25s ease-in-out infinite"
              : undefined;

  return (
    <div
      className={`relative h-[92px] w-[108px] transition-transform duration-200 ${
        focusing
          ? "translate-y-[4px]"
          : ""
      }`}
      data-facing={facing}
      data-horizontal-facing={
        horizontalFacing
      }
      data-hoo-world-character="bubble-mascot"
      data-character-slot-image={
        characterImagePath
      }
      data-accessory-ids={accessoryIds.join(",")}
      data-hoo-world-dancing={
        dancing
          ? "true"
          : "false"
      }
      data-hoo-world-resting={
        resting
          ? "true"
          : "false"
      }
      data-hoo-world-frozen={
        frozen
          ? "true"
          : "false"
      }
      data-hoo-world-cold={
        cold
          ? "true"
          : "false"
      }
    >
      {frozen ? (
        <>
          <div className="pointer-events-none absolute -inset-x-[10px] -inset-y-[8px] rounded-[48%] bg-cyan-100/10 blur-[5px]" />
          <span className="pointer-events-none absolute -left-[7px] top-[24%] text-[11px] text-cyan-100/90 drop-shadow-[0_0_4px_rgba(207,250,254,0.9)]">❄</span>
          <span className="pointer-events-none absolute -right-[5px] top-[43%] text-[9px] text-cyan-50/85 drop-shadow-[0_0_3px_rgba(207,250,254,0.8)]">❄</span>
          <span className="pointer-events-none absolute bottom-[10%] left-[12%] h-[5px] w-[28%] rotate-[-7deg] rounded-full bg-cyan-100/40 blur-[0.5px]" />
          <span className="pointer-events-none absolute bottom-[8%] right-[8%] h-[4px] w-[24%] rotate-[8deg] rounded-full bg-cyan-50/35 blur-[0.5px]" />
        </>
      ) : null}

      {cold ? (
        <>
          {horizontalFacing === "right" ? (
            <>
              <span className="pointer-events-none absolute left-[24%] top-[45%] z-20 h-[12px] w-[20px] rounded-full bg-rose-500/35 blur-[1px]" />
              <span className="pointer-events-none absolute right-[16%] top-[45%] z-20 h-[12px] w-[20px] rounded-full bg-rose-500/35 blur-[1px]" />
              <span
                className="pointer-events-none absolute left-[54%] top-[54%] z-30 h-[27px] w-[5px] origin-top rounded-full bg-sky-100/90 shadow-[0_0_4px_rgba(224,247,255,0.8)]"
                style={{
                  animation:
                    "hoo-world-cold-drip 1.8s ease-in-out infinite",
                }}
              >
                <span className="absolute -bottom-[5px] left-1/2 h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-sky-100/95" />
              </span>
            </>
          ) : (
            <>
              <span className="pointer-events-none absolute left-[16%] top-[45%] z-20 h-[12px] w-[20px] rounded-full bg-rose-500/35 blur-[1px]" />
              <span className="pointer-events-none absolute right-[24%] top-[45%] z-20 h-[12px] w-[20px] rounded-full bg-rose-500/35 blur-[1px]" />
              <span
                className="pointer-events-none absolute left-[46%] top-[54%] z-30 h-[27px] w-[5px] origin-top rounded-full bg-sky-100/90 shadow-[0_0_4px_rgba(224,247,255,0.8)]"
                style={{
                  animation:
                    "hoo-world-cold-drip 1.8s ease-in-out infinite",
                }}
              >
                <span className="absolute -bottom-[5px] left-1/2 h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-sky-100/95" />
              </span>
            </>
          )}
        </>
      ) : null}

      <div
        data-hoo-player-sprite-motion="true"
        className="pointer-events-none absolute inset-0 origin-[50%_78%] will-change-transform"
        style={{
          transform:
            "translate3d(0, 0, 0) rotate(0deg)",
          animation:
            characterMotionAnimation,
          /*
           * 침낭 취침 중에는 캐릭터 하단 30%를 숨겨
           * 아래쪽 몸이 침낭 안에 포근하게 들어가 있는 것처럼 보이게 한다.
           * 상단 70%는 그대로 보여 얼굴/상체 표정은 유지한다.
           */
          clipPath:
            resting
              ? "inset(0 0 30% 0)"
              : undefined,
        }}
      >
        <div className="absolute bottom-0 left-1/2 h-[132px] w-[154px] origin-bottom -translate-x-1/2 scale-[0.7]">
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            src={characterImagePath}
            className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none object-contain"
            style={{
              transform:
                `scaleX(${mirrorX})`,
              filter:
                frozen
                  ? "drop-shadow(0 0 4px rgba(207,250,254,0.8)) saturate(0.78) brightness(1.08)"
                  : cold
                    ? "drop-shadow(0 0 2px rgba(244,63,94,0.16)) saturate(1.04)"
                    : undefined,
            }}
          />

          <AccessoryLayer
            accessoryIds={accessoryIds}
            mirrorX={mirrorX}
          />
        </div>
      </div>
    </div>
  );
}

type AccessoryLayerProps = {
  accessoryIds: HooWorldAccessoryId[];
  mirrorX: number;
};

function AccessoryLayer({
  accessoryIds,
  mirrorX,
}: AccessoryLayerProps) {
  const approvedAccessories =
    accessoryIds
      .map(
        getApprovedAccessory,
      )
      .filter(
        (
          accessory,
        ): accessory is HooWorldAccessoryDefinition =>
          accessory !== null,
      );

  if (
    approvedAccessories.length ===
    0
  ) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      data-hoo-accessory-layer="true"
      style={{
        transform:
          `scaleX(${mirrorX})`,
      }}
    >
      {approvedAccessories.map(
        (accessory) => (
          <span
            key={accessory.id}
            data-hoo-accessory={
              accessory.id
            }
            className={
              accessory.className
            }
            style={{
              backgroundImage:
                `url("${accessory.imagePath}")`,
            }}
          />
        ),
      )}
    </div>
  );
}

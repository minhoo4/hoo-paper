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
} & Record<string, unknown>;

export default function HooWorldPlayer({
  nickname,
  status,
  facing = "down",
  characterSlot = 4,
  isAdmin = false,
  accessoryIds = [],
}: HooWorldPlayerProps) {
  const isFocusing =
    status === "focusing";

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
      `}</style>

      <div className="relative flex h-[230px] w-[190px] items-end justify-center">
        <div
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-[#1f291f]/18 blur-[2px] transition-all duration-200 ${
            isFocusing
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
          />
        </div>
      </div>

      <div className="mt-2 max-w-[150px] truncate rounded-full border border-white/10 bg-[#142017]/78 px-3 py-1 text-center text-xs font-black text-white shadow-[0_3px_8px_rgba(20,35,23,0.24)] backdrop-blur-sm">
        {nickname}
      </div>

      <div className="mt-1 text-[10px] font-bold tracking-[0.05em] text-white/65 drop-shadow-[0_1px_2px_rgba(20,30,20,0.32)]">
        {isFocusing
          ? "집중 중"
          : "쉬는 중"}
      </div>
    </div>
  );
}



type CharacterBodyProps = {
  facing: HooWorldPlayerFacing;
  accessoryIds: HooWorldAccessoryId[];
  characterImagePath: string;
  focusing?: boolean;
};

function CharacterBody({
  facing,
  accessoryIds,
  characterImagePath,
  focusing = false,
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
    >
      <div
        data-hoo-player-sprite-motion="true"
        className="pointer-events-none absolute inset-0 origin-[50%_78%] will-change-transform"
        style={{
          transform:
            "translate3d(0, 0, 0) rotate(0deg)",
          animation:
            focusing
              ? "hoo-world-focus-bob 1.25s ease-in-out infinite"
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
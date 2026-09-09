"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  MutableRefObject,
} from "react";

import {
  HOO_WORLD_FOOD_INTERACTION_DISTANCE_PX,
  type HooWorldFoodDefinition,
  type HooWorldFoodFieldItem,
} from "./hooWorldFoodCatalog";

type HooWorldFoodItemProps = {
  item: HooWorldFoodFieldItem;
  food: HooWorldFoodDefinition;
  playerPositionRef: MutableRefObject<{
    x: number;
    y: number;
  }>;
  interactionLocked?: boolean;

  /*
   * true일 때는 외부 HooWorldItem이 좌표/이동/충돌을 담당한다.
   * 음식 컴포넌트는 시각과 F 안내만 렌더한다.
   */
  embedded?: boolean;
};

function getPlayerDistancePx(
  playerPositionRef:
    HooWorldFoodItemProps["playerPositionRef"],
  item: HooWorldFoodFieldItem,
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
      item.x
    ) /
    100 *
    window.innerWidth;

  const deltaY =
    (
      player.y -
      item.y
    ) /
    100 *
    window.innerHeight;

  return Math.hypot(
    deltaX,
    deltaY,
  );
}

export default function HooWorldFoodItem({
  item,
  food,
  playerPositionRef,
  interactionLocked = false,
  embedded = false,
}: HooWorldFoodItemProps) {
  const [
    isNearby,
    setIsNearby,
  ] = useState(false);

  useEffect(() => {
    function refreshNearby() {
      const nextNearby =
        !interactionLocked &&
        getPlayerDistancePx(
          playerPositionRef,
          item,
        ) <=
          HOO_WORLD_FOOD_INTERACTION_DISTANCE_PX;

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
    item,
    playerPositionRef,
  ]);

  return (
    <div
      data-hoo-world-food-item="true"
      data-hoo-world-food-id={
        food.id
      }
      data-hoo-world-food-item-id={
        item.itemId
      }
      data-hoo-world-collision-object={
        embedded
          ? undefined
          : "true"
      }
      data-hoo-world-collision-bottom-ratio={
        embedded
          ? undefined
          : "0.42"
      }
      className={
        embedded
          ? "absolute left-1/2 top-1/2 z-[17] -translate-x-1/2 -translate-y-1/2"
          : "absolute z-[17] -translate-x-1/2 -translate-y-1/2"
      }
      style={
        embedded
          ? undefined
          : {
              left:
                `${item.x}%`,
              top:
                `${item.y}%`,
            }
      }
      aria-label={
        food.name
      }
    >
      {isNearby && (
        <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[3] -translate-x-1/2 whitespace-nowrap rounded-full border border-white/60 bg-black/70 px-3 py-1.5 text-[10px] font-black text-white shadow-lg backdrop-blur-sm">
          F · 먹기
        </div>
      )}

      <div
        data-hoo-world-collision-anchor="true"
        className="relative flex h-[54px] w-[62px] items-center justify-center"
      >
        {food.imagePath
          ? (
              <img
                src={
                  food.imagePath
                }
                alt=""
                aria-hidden="true"
                draggable={false}
                className="relative z-[1] max-h-[50px] max-w-[58px] select-none object-contain drop-shadow-[0_3px_3px_rgba(0,0,0,0.16)]"
              />
            )
          : (
              <span
                aria-hidden="true"
                className="relative z-[1] text-[38px] leading-none drop-shadow-[0_3px_3px_rgba(0,0,0,0.14)]"
              >
                {
                  food.fallbackEmoji
                }
              </span>
            )}
      </div>
    </div>
  );
}

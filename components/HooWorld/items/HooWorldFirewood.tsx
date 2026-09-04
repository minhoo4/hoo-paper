"use client";

import type {
  FC,
} from "react";

import HooWorldItem from "@/components/HooWorld/items/HooWorldItem";

export type HooWorldFirewoodProps = {
  itemId?: string;
  x?: number;
  y?: number;
};

const HooWorldFirewood: FC<
  HooWorldFirewoodProps
> = ({
  itemId = "hoo-world-firewood-pile-01",
  x = 62,
  y = 56,
}) => {
  return (
    <HooWorldItem
      itemId={itemId}
      itemType="firewood"
      x={x}
      y={y}
      width={56}
      height={35}
      movable
      collision
      collisionBottomRatio={0.14}
      zIndex={13}
    >
      <div
        className="relative h-full w-full"
        data-hoo-world-firewood="true"
      >
        <div
          data-hoo-world-collision-anchor="true"
          className="pointer-events-none absolute bottom-[4px] left-1/2 h-[4px] w-[42px] -translate-x-1/2"
        />

        {/* 바닥 그림자 */}
        <div className="absolute bottom-[1px] left-1/2 h-[8px] w-[42px] -translate-x-1/2 rounded-[50%] bg-[#3c3027]/20 blur-[2px]" />

        {/* 장작 본체: 더 원통형 */}
        <div className="absolute bottom-[7px] left-1/2 h-[16px] w-[44px] -translate-x-1/2 -rotate-[8deg] overflow-hidden rounded-full border border-[#4d3125]/70 bg-gradient-to-b from-[#9b6848] via-[#7f543d] to-[#56382c] shadow-[0_2px_4px_rgba(47,34,27,0.22)]">
          {/* 나무결 */}
          <span className="absolute left-[8px] top-[3px] h-[2px] w-[24px] rounded-full bg-[#d9a173]/24" />
          <span className="absolute left-[10px] top-[7px] h-[2px] w-[21px] rounded-full bg-[#4b2f24]/18" />
          <span className="absolute left-[6px] bottom-[3px] h-[2px] w-[25px] rounded-full bg-[#c98f62]/14" />

          {/* 왼쪽 끝 음영 */}
          <span className="absolute left-0 top-1/2 h-[12px] w-[6px] -translate-y-1/2 rounded-full bg-[#472d22]/28" />

          {/* 오른쪽 절단면 */}
          <span className="absolute right-[2px] top-1/2 h-[14px] w-[10px] -translate-y-1/2 rounded-full border border-[#452b20]/58 bg-[#7f543b] shadow-inner">
            <span className="absolute inset-[2px] rounded-full border border-[#c8956a]/34" />
            <span className="absolute inset-[4px] rounded-full border border-[#57382a]/22" />
          </span>
        </div>

        {/* 작은 균열 */}
        <span className="absolute bottom-[14px] right-[9px] h-[1px] w-[5px] -rotate-[18deg] rounded-full bg-[#40281e]/35" />
      </div>
    </HooWorldItem>
  );
};

export default HooWorldFirewood;

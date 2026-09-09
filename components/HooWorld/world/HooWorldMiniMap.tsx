"use client";

import {
  useEffect,
  useRef,
} from "react";

import type {
  HooWorldPlayerFacing,
} from "@/components/HooWorld/HooWorldPlayer";

import {
  getHooWorldRegion,
  type HooWorldRegionId,
} from "./hooWorldMap";

type PositionRef = {
  current: {
    x: number;
    y: number;
  };
};

type FacingRef = {
  current: HooWorldPlayerFacing;
};

type HooWorldMiniMapProps = {
  regionId: HooWorldRegionId;
  playerPositionRef: PositionRef;
  playerFacingRef: FacingRef;

  /*
   * 기존 page.tsx 호환용.
   * 잠긴 지역은 미니맵에 아예 노출하지 않는 방향으로 바뀌었으므로
   * 현재 시각 렌더링에는 사용하지 않는다.
   */
  unlockedRegionIds?: readonly HooWorldRegionId[];
};

const MINI_MAP_SIZE = 164;
const MINI_MAP_PLAYER_TRAVEL_X = 104;
const MINI_MAP_PLAYER_TRAVEL_Y = 96;

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

type MiniMapTreeProps = {
  x: number;
  y: number;
  scale?: number;
  dark?: boolean;
};

function MiniMapTree({
  x,
  y,
  scale = 1,
  dark = false,
}: MiniMapTreeProps) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
    >
      <ellipse
        cx="0"
        cy="7"
        rx="7"
        ry="3.2"
        fill="#315a3d"
        opacity="0.20"
      />

      <rect
        x="-2"
        y="-2"
        width="4"
        height="12"
        rx="1.4"
        fill="#78583f"
      />

      <circle
        cx="-5"
        cy="-7"
        r="9"
        fill={
          dark
            ? "#2d5e3d"
            : "#3f7847"
        }
      />

      <circle
        cx="4"
        cy="-8"
        r="10"
        fill={
          dark
            ? "#376c43"
            : "#4d8a50"
        }
      />

      <circle
        cx="0"
        cy="-15"
        r="9"
        fill={
          dark
            ? "#356940"
            : "#5c9657"
        }
      />

      <circle
        cx="-2"
        cy="-17"
        r="4"
        fill="#8ab66a"
        opacity="0.32"
      />
    </g>
  );
}

function HomeFieldArtwork() {
  const outerTrees = [
    [8, 24, 0.76, true],
    [25, 13, 0.72, false],
    [46, 7, 0.70, true],
    [68, 4, 0.70, false],
    [91, 3, 0.72, true],
    [115, 4, 0.70, false],
    [139, 7, 0.72, true],
    [162, 13, 0.74, false],
    [185, 24, 0.78, true],
    [195, 48, 0.76, false],
    [198, 72, 0.78, true],
    [197, 128, 0.78, false],
    [190, 151, 0.78, true],
    [176, 170, 0.74, false],
    [157, 184, 0.72, true],
    [38, 184, 0.72, false],
    [19, 169, 0.76, true],
    [7, 148, 0.78, false],
    [3, 124, 0.78, true],
    [3, 83, 0.78, false],
    [4, 58, 0.78, true],
  ] as const;

  const rightBlockTrees = [
    [169, 88, 0.86, true],
    [184, 78, 0.82, false],
    [195, 91, 0.90, true],
    [173, 105, 0.92, false],
    [188, 111, 0.90, true],
    [199, 120, 0.84, false],
  ] as const;

  const campLogs = [
    [72, 72, -12],
    [103, 69, 12],
    [128, 87, 4],
    [126, 116, -10],
    [101, 132, 4],
    [72, 128, 12],
    [50, 108, 10],
    [50, 84, -10],
  ] as const;

  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="hooHomeMiniGrass"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor="#b9df78"
          />
          <stop
            offset="58%"
            stopColor="#9fd369"
          />
          <stop
            offset="100%"
            stopColor="#7fba58"
          />
        </linearGradient>

        <linearGradient
          id="hooHomeMiniRiver"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor="#7dd7e7"
          />
          <stop
            offset="100%"
            stopColor="#49b9d6"
          />
        </linearGradient>

        <filter
          id="hooHomeMiniObjectShadow"
          x="-50%"
          y="-50%"
          width="200%"
          height="210%"
        >
          <feDropShadow
            dx="0"
            dy="1.6"
            stdDeviation="1.3"
            floodColor="#30442f"
            floodOpacity="0.28"
          />
        </filter>
      </defs>

      {/* 홈필드 잔디 */}
      <rect
        width="200"
        height="200"
        fill="url(#hooHomeMiniGrass)"
      />

      <path
        d="M-10 18 C37 7 67 10 101 16 C134 22 165 12 210 18 V-10 H-10 Z"
        fill="#73ad55"
        opacity="0.22"
      />

      {/* 홈필드 중앙 캠프 공터 */}
      <circle
        cx="91"
        cy="100"
        r="54"
        fill="#d8b66f"
        opacity="0.34"
      />
      <circle
        cx="91"
        cy="99"
        r="48"
        fill="#efd293"
      />
      <circle
        cx="91"
        cy="97"
        r="42"
        fill="#f2d79c"
        opacity="0.80"
      />

      {/* 좌측 상단 배송 게이트에서 홈필드로 들어오는 길 */}
      <path
        d="M27 0 C28 22 35 38 52 54 C64 65 72 74 78 84"
        fill="none"
        stroke="#d8b774"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M28 0 C30 22 38 39 54 53"
        fill="none"
        stroke="#f1d89d"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.72"
      />

      {/* 오른쪽으로 이어지는 길 - 끝은 숲에 막혀 있다. */}
      <path
        d="M132 100 C148 100 160 100 172 100 C183 100 191 99 203 98"
        fill="none"
        stroke="#d7b673"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M134 98 C150 98 162 98 176 98"
        fill="none"
        stroke="#f2d99f"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.66"
      />

      {/* 하단 냇물 */}
      <path
        d="M-12 161 C25 154 53 158 83 164 C112 170 139 166 166 157 C185 151 198 150 212 151"
        fill="none"
        stroke="#477f58"
        strokeWidth="30"
        strokeLinecap="round"
        opacity="0.24"
      />
      <path
        d="M-12 161 C25 154 53 158 83 164 C112 170 139 166 166 157 C185 151 198 150 212 151"
        fill="none"
        stroke="#e0e6bd"
        strokeWidth="24"
        strokeLinecap="round"
      />
      <path
        d="M-12 161 C25 154 53 158 83 164 C112 170 139 166 166 157 C185 151 198 150 212 151"
        fill="none"
        stroke="url(#hooHomeMiniRiver)"
        strokeWidth="19"
        strokeLinecap="round"
      />
      <path
        d="M4 159 C38 154 62 159 88 164 C117 169 141 164 163 158"
        fill="none"
        stroke="#d9f7f2"
        strokeWidth="2.3"
        strokeLinecap="round"
        opacity="0.60"
      />

      {/* 하단 중앙 나무다리 */}
      <g
        transform="translate(102 162)"
        filter="url(#hooHomeMiniObjectShadow)"
      >
        <rect
          x="-16"
          y="-8"
          width="32"
          height="16"
          rx="2"
          fill="#9b653e"
        />
        {[-11, -5, 1, 7, 13].map(
          (x) => (
            <line
              key={`hoo-home-mini-bridge-${x}`}
              x1={x}
              y1="-7"
              x2={x}
              y2="7"
              stroke="#6d4730"
              strokeWidth="1"
            />
          ),
        )}
        <line
          x1="-17"
          y1="-10"
          x2="17"
          y2="-10"
          stroke="#704830"
          strokeWidth="2.2"
        />
        <line
          x1="-17"
          y1="10"
          x2="17"
          y2="10"
          stroke="#704830"
          strokeWidth="2.2"
        />
        <line
          x1="-15"
          y1="-12"
          x2="-15"
          y2="12"
          stroke="#704830"
          strokeWidth="2.2"
        />
        <line
          x1="15"
          y1="-12"
          x2="15"
          y2="12"
          stroke="#704830"
          strokeWidth="2.2"
        />
      </g>

      {/* 좌측 상단 배송 게이트 */}
      <g
        transform="translate(28 27)"
        filter="url(#hooHomeMiniObjectShadow)"
      >
        <rect
          x="-18"
          y="-12"
          width="5"
          height="30"
          rx="2"
          fill="#714a32"
        />
        <rect
          x="15"
          y="-12"
          width="5"
          height="30"
          rx="2"
          fill="#714a32"
        />
        <rect
          x="-20"
          y="-13"
          width="42"
          height="15"
          rx="3"
          fill="#875638"
        />
        <rect
          x="-14"
          y="-9"
          width="30"
          height="8"
          rx="2"
          fill="#f0ddb1"
        />
        <text
          x="1"
          y="-3"
          textAnchor="middle"
          fontSize="7"
          fontWeight="900"
          fill="#6a4632"
          letterSpacing="1.4"
        >
          HOO
        </text>
        <circle
          cx="18"
          cy="-16"
          r="4.2"
          fill="#4f5847"
        />
        <path
          d="M18 -18 V-14 M16 -16 H20"
          stroke="#f4e7c7"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </g>

      {/*
       * 캠프파이어 돌 위치는 고정 좌표를 사용한다.
       *
       * Math.sin / Math.cos 결과는 서버(Node)와 브라우저 사이에서
       * 극미세한 부동소수점 차이가 날 수 있어 SVG 속성 hydration mismatch를
       * 만들 수 있다. 렌더 시 계산하지 않고 동일한 숫자 상수를 사용한다.
       */}
      <g
        transform="translate(91 100)"
        filter="url(#hooHomeMiniObjectShadow)"
      >
        {[
          { cx: 9, cy: 0 },
          { cx: 6.8944, cy: 3.8567 },
          { cx: 1.5628, cy: 5.9088 },
          { cx: -4.5, cy: 5.1962 },
          { cx: -8.4572, cy: 2.0521 },
          { cx: -8.4572, cy: -2.0521 },
          { cx: -4.5, cy: -5.1962 },
          { cx: 1.5628, cy: -5.9088 },
          { cx: 6.8944, cy: -3.8567 },
        ].map(
          (stone, index) => (
            <circle
              key={`hoo-home-mini-fire-stone-${index}`}
              cx={stone.cx}
              cy={stone.cy}
              r="3.2"
              fill={
                index % 2 === 0
                  ? "#7f8178"
                  : "#959688"
              }
            />
          ),
        )}
        <ellipse
          cx="0"
          cy="2"
          rx="7"
          ry="4"
          fill="#644931"
        />
        <path
          d="M-2 3 C-7 -3 -4 -10 1 -15 C3 -9 9 -7 8 -1 C7 6 2 8 -2 3 Z"
          fill="#ef7230"
        />
        <path
          d="M0 3 C-3 -1 -1 -6 2 -10 C5 -5 5 0 2 4 Z"
          fill="#ffd25e"
        />
      </g>

      {/* 모닥불 주변 통나무 */}
      {campLogs.map(
        ([x, y, rotation], index) => (
          <g
            key={`hoo-home-mini-log-${index}`}
            transform={`translate(${x} ${y}) rotate(${rotation})`}
            filter="url(#hooHomeMiniObjectShadow)"
          >
            <rect
              x="-9"
              y="-3.7"
              width="18"
              height="7.4"
              rx="3.7"
              fill="#945831"
            />
            <ellipse
              cx="-7.3"
              cy="0"
              rx="2.2"
              ry="3"
              fill="#704129"
            />
            <ellipse
              cx="-7.3"
              cy="0"
              rx="1.25"
              ry="1.8"
              fill="none"
              stroke="#ac7147"
              strokeWidth="0.7"
            />
          </g>
        ),
      )}

      {/* 자연 디테일 */}
      <g
        fill="#92968a"
        filter="url(#hooHomeMiniObjectShadow)"
      >
        <ellipse
          cx="29"
          cy="83"
          rx="8"
          ry="5.4"
        />
        <ellipse
          cx="154"
          cy="151"
          rx="6"
          ry="4"
        />
        <ellipse
          cx="45"
          cy="160"
          rx="6.5"
          ry="4.5"
        />
      </g>

      <g
        transform="translate(144 48)"
        filter="url(#hooHomeMiniObjectShadow)"
      >
        <rect
          x="-4"
          y="-3"
          width="8"
          height="10"
          rx="2"
          fill="#835333"
        />
        <ellipse
          cx="0"
          cy="-3"
          rx="4.5"
          ry="2.2"
          fill="#a96c3f"
        />
        <ellipse
          cx="0"
          cy="-3"
          rx="2.5"
          ry="1.2"
          fill="none"
          stroke="#75472f"
          strokeWidth="0.8"
        />
      </g>

      {/* 필드 외곽 숲 */}
      {outerTrees.map(
        ([x, y, scale, dark], index) => (
          <MiniMapTree
            key={`hoo-home-outer-tree-${index}`}
            x={x}
            y={y}
            scale={scale}
            dark={dark}
          />
        ),
      )}

      {/* 오른쪽 길을 가로막는 빽빽한 숲. 길 위에 겹쳐 해금 전 통행 불가가 보인다. */}
      <g>
        <ellipse
          cx="187"
          cy="101"
          rx="25"
          ry="28"
          fill="#2f6d40"
          opacity="0.36"
        />
        {rightBlockTrees.map(
          ([x, y, scale, dark], index) => (
            <MiniMapTree
              key={`hoo-home-right-block-tree-${index}`}
              x={x}
              y={y}
              scale={scale}
              dark={dark}
            />
          ),
        )}
      </g>

      {/* 꽃 / 작은 풀 */}
      <g
        fill="#fffaf0"
        opacity="0.98"
      >
        {[
          [30, 54],
          [38, 59],
          [132, 32],
          [145, 38],
          [25, 128],
          [38, 138],
          [146, 127],
          [157, 135],
        ].map(
          ([x, y], index) => (
            <g
              key={`hoo-home-mini-flower-${index}`}
              transform={`translate(${x} ${y})`}
            >
              <circle
                cx="-1.5"
                cy="0"
                r="1.3"
              />
              <circle
                cx="1.5"
                cy="0"
                r="1.3"
              />
              <circle
                cx="0"
                cy="-1.5"
                r="1.3"
              />
              <circle
                cx="0"
                cy="1.5"
                r="1.3"
              />
              <circle
                cx="0"
                cy="0"
                r="0.8"
                fill="#e6bd52"
              />
            </g>
          ),
        )}
      </g>

      <g
        fill="none"
        stroke="#5e934d"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.72"
      >
        <path d="M40 91 l-2 -5 M40 91 l3 -4" />
        <path d="M137 73 l-2 -5 M137 73 l3 -4" />
        <path d="M57 142 l-2 -5 M57 142 l3 -4" />
        <path d="M144 117 l-2 -5 M144 117 l3 -4" />
      </g>
    </svg>
  );
}

function GenericDiscoveredRegionArtwork({
  regionId,
}: {
  regionId: HooWorldRegionId;
}) {
  const isCave =
    regionId === "cave" ||
    regionId === "cave_b1" ||
    regionId === "cave_b2" ||
    regionId === "cave_bottom" ||
    regionId === "hidden_room";

  const isWater =
    regionId === "creek" ||
    regionId === "beach" ||
    regionId === "deserted_island";

  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="hooMiniGenericGround"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor={
              isCave
                ? "#59615a"
                : isWater
                  ? "#a9ce7a"
                  : "#a8cf71"
            }
          />
          <stop
            offset="100%"
            stopColor={
              isCave
                ? "#333b38"
                : isWater
                  ? "#78aa63"
                  : "#75ad59"
            }
          />
        </linearGradient>
      </defs>

      <rect
        width="200"
        height="200"
        fill="url(#hooMiniGenericGround)"
      />

      {isCave ? (
        <>
          <path
            d="M-10 37 C22 17 52 28 72 18 C96 6 119 23 138 17 C160 10 183 21 210 12 V-10 H-10 Z"
            fill="#272f2c"
            opacity="0.54"
          />
          <path
            d="M20 159 C45 134 69 142 89 129 C110 116 128 121 147 108 C166 95 182 99 207 82"
            fill="none"
            stroke="#70695d"
            strokeWidth="18"
            strokeLinecap="round"
          />
          <g
            fill="#86887b"
            opacity="0.78"
          >
            <ellipse
              cx="42"
              cy="68"
              rx="18"
              ry="12"
            />
            <ellipse
              cx="151"
              cy="54"
              rx="22"
              ry="14"
            />
            <ellipse
              cx="127"
              cy="151"
              rx="15"
              ry="10"
            />
          </g>
        </>
      ) : (
        <>
          <path
            d="M-10 126 C35 111 61 119 88 139 C111 155 135 154 161 136 C179 124 194 121 210 125 V210 H-10 Z"
            fill="#6aa052"
            opacity="0.22"
          />
          <path
            d="M-8 151 C29 139 55 129 78 111 C97 96 120 91 151 96 C173 100 188 96 210 84"
            fill="none"
            stroke="#d8bb79"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {isWater && (
            <path
              d="M155 210 C147 185 151 167 168 151 C185 135 190 115 210 98"
              fill="none"
              stroke="#70c7d7"
              strokeWidth="20"
              strokeLinecap="round"
            />
          )}
          <MiniMapTree
            x={35}
            y={46}
            scale={0.9}
          />
          <MiniMapTree
            x={160}
            y={46}
            scale={0.82}
            dark
          />
          <MiniMapTree
            x={48}
            y={151}
            scale={0.72}
            dark
          />
        </>
      )}
    </svg>
  );
}

export default function HooWorldMiniMap({
  regionId,
  playerPositionRef,
  playerFacingRef,
}: HooWorldMiniMapProps) {
  const playerMarkerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const currentRegion =
    getHooWorldRegion(
      regionId,
    );

  const currentRegionLabel =
    regionId === "camping"
      ? "홈필드"
      : currentRegion.name;

  /*
   * 본 월드 이동은 React state가 아니라 DOM transform을 직접 갱신한다.
   * 미니맵도 같은 positionRef를 RAF에서 읽어 플레이어 마커만 갱신한다.
   */
  useEffect(() => {
    let animationFrame = 0;

    function updateMarker() {
      const marker =
        playerMarkerRef.current;

      if (marker) {
        const position =
          playerPositionRef.current;

        const localX =
          clamp(
            Number(position.x),
            0,
            100,
          );

        const localY =
          clamp(
            Number(position.y),
            0,
            100,
          );

        /*
         * 원형 지도 안쪽에서 실제 월드 좌표를 넓게 사용한다.
         * 바깥 테두리와 하단 지역명 라벨을 침범하지 않게 이동폭을 제한한다.
         */
        const offsetX =
          (
            localX -
            50
          ) /
          100 *
          MINI_MAP_PLAYER_TRAVEL_X;

        const offsetY =
          (
            localY -
            50
          ) /
          100 *
          MINI_MAP_PLAYER_TRAVEL_Y;

        const rotation =
          playerFacingRef.current ===
          "left"
            ? -90
            : playerFacingRef.current ===
                "right"
              ? 90
              : playerFacingRef.current ===
                  "up"
                ? 0
                : 180;

        marker.style.transform =
          `translate3d(${offsetX}px, ${offsetY}px, 0) rotate(${rotation}deg)`;
      }

      animationFrame =
        window.requestAnimationFrame(
          updateMarker,
        );
    }

    animationFrame =
      window.requestAnimationFrame(
        updateMarker,
      );

    return () => {
      window.cancelAnimationFrame(
        animationFrame,
      );
    };
  }, [
    playerFacingRef,
    playerPositionRef,
    regionId,
  ]);

  return (
    <aside
      aria-label="HOO WORLD 미니맵"
      className="fixed left-1/2 top-4 z-[96] -translate-x-1/2 select-none sm:top-6"
    >
      <div
        className="relative overflow-hidden rounded-full border border-white/70 bg-[#dce8b8] shadow-[0_10px_30px_rgba(25,45,28,0.30)]"
        style={{
          width: MINI_MAP_SIZE,
          height: MINI_MAP_SIZE,
        }}
      >
        {/*
         * 미해금 지역 노드/자물쇠는 표시하지 않는다.
         * 현재 플레이어가 실제로 진입한 지역의 항공지도만 보여준다.
         */}
        {regionId === "camping" ? (
          <HomeFieldArtwork />
        ) : (
          <GenericDiscoveredRegionArtwork
            regionId={regionId}
          />
        )}

        {/* 이미지와 같은 연한 크림-연두 원형 프레임 */}
        <div className="pointer-events-none absolute inset-0 rounded-full border-[5px] border-[#dce9b5]/95 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.60)]" />
        <div className="pointer-events-none absolute inset-[7px] rounded-full border border-[#6c865b]/20" />

        {/* 약 80도 항공뷰 느낌을 살리는 상단 하이라이트 */}
        <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_34%_22%,rgba(255,255,255,0.23),transparent_34%),linear-gradient(to_bottom,rgba(255,255,255,0.08),transparent_42%)]" />

        {/* 실제 캐릭터 x/y + 바라보는 방향과 동기화 */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0">
          <div
            ref={playerMarkerRef}
            className="absolute -left-[14px] -top-[14px] h-7 w-7 will-change-transform rounded-full border border-white/95 bg-[#17643e] shadow-[0_2px_5px_rgba(31,51,35,0.38)]"
            style={{
              transformOrigin:
                "50% 50%",
            }}
          >
            {/* 방향을 나타내는 노란 웨지 */}
            <span
              className="absolute left-1/2 top-[-3px] h-[14px] w-[17px] -translate-x-1/2 bg-[#f6b93f] shadow-[0_1px_1px_rgba(75,65,38,0.20)]"
              style={{
                clipPath:
                  "polygon(50% 0%, 100% 100%, 0% 100%)",
              }}
            />

            {/* 플레이어 중심점 */}
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_2px_rgba(33,52,36,0.25)]" />
          </div>
        </div>

        {/* 지역명 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[7px] z-30 flex justify-center">
          <span className="max-w-[118px] truncate rounded-full border border-white/20 bg-[#344b32]/90 px-3 py-1.5 text-[10px] font-black text-white shadow-[0_4px_10px_rgba(30,44,31,0.30)] backdrop-blur-[2px]">
            {currentRegionLabel}
          </span>
        </div>
      </div>
    </aside>
  );
}

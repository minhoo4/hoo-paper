"use client";

import Link from "next/link";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import HooWorldPlayer, {
  type HooWorldPlayerFacing,
} from "@/components/HooWorld/HooWorldPlayer";

import {
  useHooWorldPresence,
} from "@/components/HooWorld/hooks/useHooWorldPresence";

import {
  createClient,
} from "@/lib/supabase/client";

const HOO_WORLD_ACCESSORY_SLOT_COUNT =
  10;

function getAccessorySlotId(
  slotNumber: number,
) {
  return String(
    slotNumber,
  );
}


const HooWorldBoundaryForest =
  memo(
    function HooWorldBoundaryForest() {
      const topBackTrees =
        Array.from(
          { length: 34 },
          (_, index) => ({
            x:
              -35 +
              index * 51,
            y:
              58 +
              (
                index % 3
              ) *
                7,
            scale:
              0.54 +
              (
                index % 4
              ) *
                0.035,
            variant:
              index % 2,
          }),
        );

      const topFrontTrees =
        Array.from(
          { length: 28 },
          (_, index) => ({
            x:
              index * 61,
            y:
              72 +
              (
                index % 2
              ) *
                8,
            scale:
              0.62 +
              (
                index % 5
              ) *
                0.03,
            variant:
              index % 3,
          }),
        );

      const leftTrees =
        Array.from(
          { length: 15 },
          (_, index) => ({
            x:
              index % 2 ===
              0
                ? 52
                : 106,
            y:
              190 +
              index * 49,
            scale:
              0.66 +
              (
                index % 4
              ) *
                0.035,
            variant:
              index % 3,
          }),
        );

      const rightTrees =
        Array.from(
          { length: 15 },
          (_, index) => ({
            x:
              index % 2 ===
              0
                ? 1548
                : 1494,
            y:
              190 +
              index * 49,
            scale:
              0.66 +
              (
                index % 4
              ) *
                0.035,
            variant:
              (
                index +
                1
              ) %
              3,
          }),
        );

      const bottomTrees =
        Array.from(
          { length: 28 },
          (_, index) => ({
            x:
              -10 +
              index * 60,
            y:
              860 +
              (
                index % 3
              ) *
                4,
            scale:
              0.68 +
              (
                index % 4
              ) *
                0.03,
            variant:
              (
                index +
                2
              ) %
              3,
          }),
        );

      function getFrontTreeHref(
        variant: number,
      ) {
        if (variant === 1) {
          return "#hooFieldTreeFrontB";
        }

        if (variant === 2) {
          return "#hooFieldTreeFrontC";
        }

        return "#hooFieldTreeFrontA";
      }

      function getBackTreeHref(
        variant: number,
      ) {
        return variant === 1
          ? "#hooFieldTreeBackB"
          : "#hooFieldTreeBackA";
      }

      return (
        <div
          className="pointer-events-none absolute inset-0 z-[7] overflow-hidden"
          style={{
            contain:
              "layout paint style",
            transform:
              "scale(1.18)",
            transformOrigin:
              "50% 50%",
          }}
        >
          <svg
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="hooFieldTrunk"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop
                  offset="0%"
                  stopColor="#2f241d"
                />
                <stop
                  offset="28%"
                  stopColor="#4b3729"
                />
                <stop
                  offset="55%"
                  stopColor="#73533b"
                />
                <stop
                  offset="76%"
                  stopColor="#856249"
                />
                <stop
                  offset="100%"
                  stopColor="#33271f"
                />
              </linearGradient>

              <linearGradient
                id="hooFieldTrunkBack"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop
                  offset="0%"
                  stopColor="#2e3928"
                />
                <stop
                  offset="50%"
                  stopColor="#48543a"
                />
                <stop
                  offset="100%"
                  stopColor="#283426"
                />
              </linearGradient>

              {/* 뒤쪽 숲 A */}
              <g id="hooFieldTreeBackA">
                <path
                  d="M-10 78
                     C-9 55 -8 34 -5 14
                     C-3 2 1 -10 5 -19
                     C10 -5 12 11 11 29
                     C11 49 13 65 16 78 Z"
                  fill="url(#hooFieldTrunkBack)"
                />

                <path
                  d="M-69 15
                     C-65 -10 -45 -25 -20 -26
                     C-17 -52 6 -69 31 -59
                     C50 -66 71 -53 76 -30
                     C97 -20 99 5 87 21
                     C96 44 75 60 52 59
                     C39 77 10 79 -4 66
                     C-25 78 -52 66 -56 47
                     C-76 43 -84 29 -69 15 Z"
                  fill="#315737"
                />

                <path
                  d="M-53 2
                     C-44 -15 -25 -18 -12 -13
                     C-5 -33 15 -43 33 -35
                     C50 -39 63 -25 62 -10
                     C78 -5 80 11 72 23
                     C56 19 42 21 31 29
                     C11 16 -5 18 -20 29
                     C-29 14 -40 7 -53 2 Z"
                  fill="#426c42"
                  opacity="0.86"
                />
              </g>

              {/* 뒤쪽 숲 B */}
              <g id="hooFieldTreeBackB">
                <path
                  d="M-9 78
                     C-8 53 -6 32 -4 13
                     C-2 -1 2 -12 7 -22
                     C11 -7 13 9 13 29
                     C14 49 16 65 19 78 Z"
                  fill="url(#hooFieldTrunkBack)"
                />

                <path
                  d="M-72 21
                     C-73 2 -59 -17 -38 -23
                     C-35 -43 -17 -56 4 -53
                     C18 -70 42 -68 54 -49
                     C76 -50 91 -31 86 -12
                     C103 -1 101 21 88 32
                     C93 53 72 68 52 62
                     C35 78 8 78 -6 63
                     C-29 75 -51 62 -55 44
                     C-75 43 -84 33 -72 21 Z"
                  fill="#365e3b"
                />

                <path
                  d="M-45 -2
                     C-35 -19 -16 -22 -2 -16
                     C8 -37 28 -43 44 -31
                     C59 -34 71 -19 68 -4
                     C81 1 84 16 76 27
                     C57 18 42 22 27 32
                     C9 19 -9 21 -23 31
                     C-28 17 -36 7 -45 -2 Z"
                  fill="#4a7548"
                  opacity="0.82"
                />
              </g>

              {/* 앞쪽 숲 A */}
              <g id="hooFieldTreeFrontA">
                <path
                  d="M-15 94
                     C-14 66 -12 43 -9 24
                     C-7 6 -2 -9 5 -25
                     C12 -10 15 8 15 29
                     C15 48 18 69 22 94
                     C12 90 5 88 -1 88
                     C-6 89 -10 91 -15 94 Z"
                  fill="url(#hooFieldTrunk)"
                />

                <path
                  d="M-86 17
                     C-88 -8 -69 -27 -45 -32
                     C-44 -57 -20 -76 4 -68
                     C19 -85 46 -82 58 -61
                     C83 -63 101 -41 95 -18
                     C114 -5 114 19 98 34
                     C105 57 83 74 60 70
                     C45 91 13 93 -3 75
                     C-27 89 -56 75 -59 53
                     C-82 52 -96 35 -86 17 Z"
                  fill="#315735"
                />

                <path
                  d="M-69 2
                     C-57 -18 -37 -23 -19 -17
                     C-9 -42 14 -54 35 -44
                     C55 -52 76 -35 75 -14
                     C93 -8 99 12 87 27
                     C75 17 60 16 46 24
                     C34 11 16 9 2 18
                     C-17 8 -34 14 -44 28
                     C-50 17 -58 8 -69 2 Z"
                  fill="#4a7848"
                />

                <path
                  d="M-56 -7
                     C-45 -19 -30 -19 -17 -13
                     C-7 -29 9 -36 24 -30
                     C37 -35 51 -25 54 -11
                     C44 -8 34 -3 28 6
                     C15 0 4 2 -5 10
                     C-18 2 -31 4 -40 13
                     C-43 5 -49 -2 -56 -7 Z"
                  fill="#76995e"
                  opacity="0.56"
                />

                <path
                  d="M-8 86
                     C-4 66 -3 50 -2 35"
                  stroke="#b08461"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  opacity="0.22"
                />
              </g>

              {/* 앞쪽 숲 B */}
              <g id="hooFieldTreeFrontB">
                <path
                  d="M-18 95
                     C-16 68 -14 46 -11 25
                     C-9 7 -4 -11 3 -27
                     C10 -12 14 6 15 27
                     C16 51 19 72 24 95
                     C14 91 6 89 0 89
                     C-6 89 -12 91 -18 95 Z"
                  fill="url(#hooFieldTrunk)"
                />

                <path
                  d="M-91 26
                     C-96 6 -81 -15 -60 -23
                     C-62 -46 -42 -64 -20 -62
                     C-9 -84 18 -91 36 -74
                     C59 -82 82 -64 83 -41
                     C106 -35 115 -12 103 7
                     C117 27 105 50 84 56
                     C76 80 48 91 27 78
                     C8 96 -24 92 -38 70
                     C-63 79 -85 61 -82 40
                     C-96 37 -102 32 -91 26 Z"
                  fill="#365d38"
                />

                <path
                  d="M-69 10
                     C-57 -8 -39 -15 -21 -8
                     C-12 -31 7 -44 28 -38
                     C47 -49 68 -34 69 -14
                     C88 -10 94 8 84 23
                     C69 18 56 21 46 31
                     C28 19 12 20 -2 31
                     C-18 18 -37 19 -50 33
                     C-54 23 -61 15 -69 10 Z"
                  fill="#4d7a4a"
                />

                <path
                  d="M-47 -3
                     C-37 -14 -23 -17 -10 -12
                     C0 -28 15 -35 30 -29
                     C43 -33 57 -22 59 -8
                     C48 -4 40 1 33 10
                     C21 3 8 5 -1 13
                     C-15 6 -28 8 -36 18
                     C-38 9 -42 3 -47 -3 Z"
                  fill="#7a9d62"
                  opacity="0.54"
                />

                <path
                  d="M0 87
                     C2 68 3 52 5 37"
                  stroke="#b68a65"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  opacity="0.20"
                />
              </g>

              {/* 앞쪽 숲 C */}
              <g id="hooFieldTreeFrontC">
                <path
                  d="M-14 94
                     C-13 66 -12 43 -8 21
                     C-5 4 0 -12 7 -27
                     C14 -9 16 9 16 29
                     C17 50 20 71 24 94
                     C15 91 7 89 1 89
                     C-5 89 -10 91 -14 94 Z"
                  fill="url(#hooFieldTrunk)"
                />

                <path
                  d="M-88 18
                     C-89 -4 -72 -24 -49 -29
                     C-47 -51 -28 -67 -6 -64
                     C8 -84 35 -84 49 -65
                     C70 -72 92 -57 94 -35
                     C114 -29 123 -7 111 11
                     C121 30 109 52 88 58
                     C80 78 55 89 36 78
                     C18 96 -12 94 -28 76
                     C-50 88 -77 73 -78 52
                     C-95 48 -102 30 -88 18 Z"
                  fill="#325936"
                />

                <path
                  d="M-71 0
                     C-58 -17 -39 -22 -23 -15
                     C-13 -38 8 -49 28 -41
                     C46 -48 64 -35 67 -16
                     C86 -13 94 6 84 21
                     C70 15 57 18 47 27
                     C31 16 14 18 2 28
                     C-16 17 -34 21 -45 34
                     C-51 19 -60 8 -71 0 Z"
                  fill="#477447"
                />

                <path
                  d="M-53 -7
                     C-43 -20 -27 -22 -14 -16
                     C-4 -33 12 -40 27 -33
                     C41 -39 55 -28 57 -13
                     C47 -9 38 -3 32 6
                     C19 -1 7 2 -2 10
                     C-15 3 -29 5 -38 15
                     C-41 7 -47 0 -53 -7 Z"
                  fill="#71975d"
                  opacity="0.56"
                />

                <path
                  d="M5 87
                     C6 67 8 50 10 35"
                  stroke="#b38865"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  opacity="0.21"
                />
              </g>
            </defs>

            {/* 외곽 숲 아래의 유기적인 덤불 띠 */}
            <path
              d="M0 0 H1600 V79
                 C1512 95 1445 89 1375 101
                 C1302 114 1235 103 1162 112
                 C1080 122 1010 104 928 116
                 C842 129 770 108 690 120
                 C608 132 536 111 458 121
                 C372 133 301 111 226 124
                 C143 138 76 125 0 133 Z"
              fill="#274b31"
              opacity="0.56"
            />

            <path
              d="M0 0 H76
                 C94 99 102 132 107 173
                 C112 224 109 270 113 321
                 C118 383 109 443 114 508
                 C119 570 110 630 114 693
                 C118 756 110 822 118 900
                 H0 Z"
              fill="#2c5235"
              opacity="0.52"
            />

            <path
              d="M1600 0 H1524
                 C1504 102 1498 144 1494 191
                 C1488 249 1493 308 1488 365
                 C1483 430 1492 492 1486 553
                 C1480 619 1491 683 1486 745
                 C1482 800 1487 847 1482 900
                 H1600 Z"
              fill="#2c5235"
              opacity="0.52"
            />

            <path
              d="M0 900 V846
                 C91 834 176 842 258 835
                 C344 827 424 840 506 832
                 C594 822 676 839 760 829
                 C845 819 927 837 1014 827
                 C1103 816 1190 835 1275 824
                 C1365 812 1472 834 1600 819
                 V900 Z"
              fill="#274b31"
              opacity="0.58"
            />

            {/* 가장 뒤쪽 나무 */}
            <g opacity="0.87">
              {topBackTrees.map(
                (
                  tree,
                  index,
                ) => (
                  <use
                    key={`field-top-back-${index}`}
                    href={
                      getBackTreeHref(
                        tree.variant,
                      )
                    }
                    transform={`translate(${tree.x} ${tree.y}) scale(${tree.scale})`}
                  />
                ),
              )}
            </g>

            {/* 상단 앞줄 */}
            <g opacity="0.98">
              {topFrontTrees.map(
                (
                  tree,
                  index,
                ) => (
                  <use
                    key={`field-top-front-${index}`}
                    href={
                      getFrontTreeHref(
                        tree.variant,
                      )
                    }
                    transform={`translate(${tree.x} ${tree.y}) scale(${tree.scale})`}
                  />
                ),
              )}
            </g>

            {/* 좌우 숲 */}
            <g opacity="0.98">
              {leftTrees.map(
                (
                  tree,
                  index,
                ) => (
                  <use
                    key={`field-left-${index}`}
                    href={
                      getFrontTreeHref(
                        tree.variant,
                      )
                    }
                    transform={`translate(${tree.x} ${tree.y}) scale(${tree.scale})`}
                  />
                ),
              )}

              {rightTrees.map(
                (
                  tree,
                  index,
                ) => (
                  <use
                    key={`field-right-${index}`}
                    href={
                      getFrontTreeHref(
                        tree.variant,
                      )
                    }
                    transform={`translate(${tree.x} ${tree.y}) scale(${tree.scale})`}
                  />
                ),
              )}
            </g>

            {/* 하단 숲 */}
            <g opacity="0.99">
              {bottomTrees.map(
                (
                  tree,
                  index,
                ) => (
                  <use
                    key={`field-bottom-${index}`}
                    href={
                      getFrontTreeHref(
                        tree.variant,
                      )
                    }
                    transform={`translate(${tree.x} ${tree.y}) scale(${tree.scale})`}
                  />
                ),
              )}
            </g>

            {/* 낮은 수풀도 원형이 아니라 불규칙한 덩어리로 정리 */}
            <g opacity="0.82">
              <path
                d="M17 216
                   C35 184 69 178 91 194
                   C116 173 151 190 151 220
                   C171 238 157 268 128 267
                   C109 283 73 276 65 253
                   C38 259 16 244 17 216 Z"
                fill="#3f7044"
              />
              <path
                d="M17 365
                   C34 335 63 329 87 343
                   C111 326 143 340 149 367
                   C168 387 151 414 126 414
                   C102 427 70 416 63 395
                   C37 399 16 389 17 365 Z"
                fill="#4b7d4a"
              />
              <path
                d="M14 522
                   C32 489 63 484 88 500
                   C114 481 147 498 151 526
                   C168 545 155 574 126 574
                   C105 589 73 580 64 556
                   C38 563 15 548 14 522 Z"
                fill="#3f7044"
              />
              <path
                d="M13 681
                   C31 650 65 644 91 660
                   C118 641 150 658 152 686
                   C168 706 151 734 124 733
                   C102 750 70 738 63 716
                   C37 722 15 708 13 681 Z"
                fill="#4b7d4a"
              />

              <path
                d="M1449 217
                   C1469 185 1503 180 1527 196
                   C1552 176 1584 191 1590 220
                   C1607 239 1594 267 1567 267
                   C1546 282 1512 275 1504 252
                   C1478 258 1450 244 1449 217 Z"
                fill="#4b7d4a"
              />
              <path
                d="M1448 369
                   C1468 337 1499 330 1524 345
                   C1548 327 1581 342 1588 370
                   C1605 389 1591 416 1564 416
                   C1542 432 1511 421 1503 398
                   C1477 404 1449 391 1448 369 Z"
                fill="#3f7044"
              />
              <path
                d="M1447 529
                   C1468 497 1501 489 1527 506
                   C1550 488 1583 503 1589 531
                   C1605 549 1592 577 1565 578
                   C1545 592 1511 583 1502 559
                   C1477 566 1449 551 1447 529 Z"
                fill="#4b7d4a"
              />
              <path
                d="M1449 687
                   C1468 656 1501 650 1525 664
                   C1550 646 1582 660 1589 688
                   C1605 707 1590 736 1564 735
                   C1544 751 1513 741 1503 718
                   C1477 724 1451 710 1449 687 Z"
                fill="#3f7044"
              />
            </g>
          </svg>

          {/* 화면 모서리 숲 그림자 */}
          <div className="absolute inset-y-0 left-0 w-[9%] bg-gradient-to-r from-[#203e2a]/30 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-[9%] bg-gradient-to-l from-[#203e2a]/30 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-[12%] bg-gradient-to-b from-[#1d3c28]/24 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[10%] bg-gradient-to-t from-[#1d3c28]/27 to-transparent" />
        </div>
      );
    },
  );


export default function HooWorldPage() {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [
    nickname,
    setNickname,
  ] = useState<string | null>(
    null,
  );

  const [
    hooCoinBalance,
    setHooCoinBalance,
  ] = useState(0);

  const [
    isAccessorySettingsOpen,
    setIsAccessorySettingsOpen,
  ] = useState(false);

  const [
    isEnteringFocusMode,
    setIsEnteringFocusMode,
  ] = useState(false);

  const [
    selectedAccessoryId,
    setSelectedAccessoryId,
  ] = useState<string | null>(
    null,
  );

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<string | null>(
    null,
  );

  const currentUserIdRef =
    useRef<string | null>(
      null,
    );

  
    const [
    isUserLoading,
    setIsUserLoading,
  ] = useState(true);

  const playerPositionRef =
    useRef({
      x: 50,
      y: 78,
    });

  const playerElementRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const playerMotionRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const [
    playerFacing,
    setPlayerFacing,
  ] = useState<HooWorldPlayerFacing>(
    "down",
  );

  const playerFacingRef =
    useRef<HooWorldPlayerFacing>(
      "down",
    );

  const movementInputRef =
    useRef({
      left: false,
      right: false,
      up: false,
      down: false,
    });

  const movementFrameRef =
    useRef<number | null>(
      null,
    );

  const previousMovementTimeRef =
    useRef<number>(
      0,
    );

  const {
    players,
    onlineCount,
    isConnected,
    status,
    updateStatus,
    updatePosition,
  } = useHooWorldPresence({
    enabled: true,
    nickname,
  });

  /*
   * 이동 RAF 안에서는 매 렌더마다 바뀔 수 있는 함수 참조 대신
   * 항상 최신 updatePosition을 ref로 호출한다.
   *
   * 이렇게 하면 이동 이벤트 리스너를 매번 다시 등록하지 않고도
   * 실시간 Broadcast 함수를 최신 상태로 유지할 수 있다.
   */
  const updatePositionRef =
    useRef(updatePosition);

  updatePositionRef.current =
    updatePosition;

  /*
   * 실시간 좌표 송출 주기를 제한한다.
   * 50ms = 초당 최대 약 20회 전송.
   * 로컬 이동은 기존처럼 RAF 60fps를 유지한다.
   */
  const lastMovementBroadcastAtRef =
    useRef(0);

  /*
   * 현재 이용자를 제외한 같은 필드의 다른 이용자.
   * Focus Mode 이용자도 Presence가 유지되는 동안
   * status="focusing" 상태로 이 배열에 그대로 남는다.
   */
  const remotePlayers = useMemo(
    () =>
      players.filter(
        (player) =>
          player.userId !==
          currentUserId,
      ),
    [
      players,
      currentUserId,
    ],
  );


  /*
   * 로그인 사용자 정보 +
   * HOO COIN 지갑 +
   * HOO WORLD 이미지 슬롯 불러오기
   */
  useEffect(() => {
    let cancelled = false;

    async function loadPlayer() {
      try {
        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (!user) {
          currentUserIdRef.current =
            null;

          if (!cancelled) {
            setCurrentUserId(
              null,
            );
            setSelectedAccessoryId(
              null,
            );

            setIsUserLoading(false);
          }

          return;
        }

        currentUserIdRef.current =
          user.id;

        setCurrentUserId(
          user.id,
        );

        const [
          profileResult,
          walletResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "nickname, hoo_world_accessory_slot",
            )
            .eq(
              "id",
              user.id,
            )
            .maybeSingle(),

          supabase
            .from(
              "hoo_coin_wallets",
            )
            .select("balance")
            .eq(
              "user_id",
              user.id,
            )
            .maybeSingle(),
        ]);

        if (cancelled) {
          return;
        }

        const profileNickname =
          profileResult.data
            ?.nickname;

        setNickname(
          typeof profileNickname ===
            "string" &&
            profileNickname.trim()
            ? profileNickname.trim()
            : user.email?.split(
                "@",
              )[0] ??
                "HOO",
        );

        const savedAccessorySlot =
          Number(
            profileResult.data
              ?.hoo_world_accessory_slot,
          );

        setSelectedAccessoryId(
          Number.isInteger(
            savedAccessorySlot,
          ) &&
          savedAccessorySlot >= 1 &&
          savedAccessorySlot <=
            HOO_WORLD_ACCESSORY_SLOT_COUNT
            ? String(
                savedAccessorySlot,
              )
            : null,
        );

        setHooCoinBalance(
          Number(
            walletResult.data
              ?.balance ?? 0,
          ),
        );
      } catch (error) {
        console.error(
          "HOO WORLD 사용자 정보를 불러오지 못했습니다.",
          error,
        );
      } finally {
        if (!cancelled) {
          setIsUserLoading(false);
        }
      }
    }

    void loadPlayer();

    return () => {
      cancelled = true;
    };
  }, [
    supabase,
  ]);

  async function saveAccessorySlot(
    accessoryId: string | null,
  ) {
    const userId =
      currentUserIdRef.current;

    if (!userId) {
      return;
    }

    const slotNumber =
      accessoryId === null
        ? null
        : Number(
            accessoryId,
          );

    if (
      slotNumber !== null &&
      (
        !Number.isInteger(
          slotNumber,
        ) ||
        slotNumber < 1 ||
        slotNumber >
          HOO_WORLD_ACCESSORY_SLOT_COUNT
      )
    ) {
      return;
    }

    const previousAccessoryId =
      selectedAccessoryId;

    setSelectedAccessoryId(
      accessoryId,
    );

    const {
      error,
    } =
      await supabase
        .from("profiles")
        .update({
          hoo_world_accessory_slot:
            slotNumber,
        })
        .eq(
          "id",
          userId,
        );

    if (error) {
      console.error(
        "HOO WORLD 이미지 슬롯 저장에 실패했습니다.",
        error,
      );

      setSelectedAccessoryId(
        previousAccessoryId,
      );
    }
  }

  /*
   * HOO WORLD 캐릭터 키보드 이동
   * WASD + 방향키 지원
   *
   * v38:
   * - 주변 포레스트를 마지노선으로 잡고
   *   그 중앙에서는 거의 자유롭게 움직일 수 있게 수정
   * - 복잡한 중앙/모서리 단계 제한 제거
   * - 상단 이동 범위를 더 크게 열어줌
   *
   * 중요:
   * 캐릭터 이동 중 React state를 갱신하지 않고
   * 캐릭터 DOM transform만 변경한다.
   * 따라서 배경 / 나무 / 오브젝트가 매 프레임 다시 렌더링되지 않는다.
   */
  useEffect(() => {
    const movementInput =
      movementInputRef.current;

    function hasMovementInput() {
      return (
        movementInput.left ||
        movementInput.right ||
        movementInput.up ||
        movementInput.down
      );
    }

    function setMovementInput(
      code: string,
      pressed: boolean,
    ) {
      switch (code) {
        case "KeyA":
        case "ArrowLeft":
          movementInput.left =
            pressed;
          return true;

        case "KeyD":
        case "ArrowRight":
          movementInput.right =
            pressed;
          return true;

        case "KeyW":
        case "ArrowUp":
          movementInput.up =
            pressed;
          return true;

        case "KeyS":
        case "ArrowDown":
          movementInput.down =
            pressed;
          return true;

        default:
          return false;
      }
    }

    function clearMovementInput() {
      movementInput.left = false;
      movementInput.right = false;
      movementInput.up = false;
      movementInput.down = false;
    }

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

    /*
     * 포레스트 바로 안쪽을 이동 마지노선으로 사용한다.
     * 중앙은 거의 전부 자유롭게 쓰고,
     * 모서리만 아주 약하게 더 막아 자연스럽게 보이게 한다.
     */
    function getWalkableBounds(
      x: number,
      y: number,
    ) {
      let minX = 5;
      let maxX = 95;
      let minY = 9;
      let maxY = 93;

      if (y < 15) {
        minX = 7;
        maxX = 93;
      } else if (y < 21) {
        minX = 6;
        maxX = 94;
      }

      if (y > 88) {
        minX = 7;
        maxX = 93;
      } else if (y > 82) {
        minX = 6;
        maxX = 94;
      }

      if (x < 9 || x > 91) {
        minY = 11;
        maxY = 91;
      }

      return {
        minX,
        maxX,
        minY,
        maxY,
      };
    }

    const staticCollisionZones = [
      {
        type:
          "ellipse" as const,
        centerX: 50,
        centerY: 50,
        radiusX: 4.2,
        radiusY: 4.1,
      },
      {
        type:
          "rect" as const,
        minX: 35.0,
        maxX: 40.7,
        minY: 50.8,
        maxY: 55.6,
      },
      {
        type:
          "rect" as const,
        minX: 58.7,
        maxX: 65.8,
        minY: 50.2,
        maxY: 57.3,
      },
    ];

    function resolveStaticCollisions(
      nextX: number,
      nextY: number,
    ) {
      let x = nextX;
      let y = nextY;

      for (
        const zone of
        staticCollisionZones
      ) {
        if (
          zone.type ===
          "ellipse"
        ) {
          const dx =
            x -
            zone.centerX;

          const dy =
            y -
            zone.centerY;

          const normalized =
            (
              dx *
              dx
            ) /
              (
                zone.radiusX *
                zone.radiusX
              ) +
            (
              dy *
              dy
            ) /
              (
                zone.radiusY *
                zone.radiusY
              );

          if (
            normalized >= 1
          ) {
            continue;
          }

          const distance =
            Math.hypot(
              dx /
                zone.radiusX,
              dy /
                zone.radiusY,
            );

          if (
            distance <
            0.001
          ) {
            y =
              zone.centerY +
              zone.radiusY;

            continue;
          }

          const scale =
            1 /
            distance;

          x =
            zone.centerX +
            dx *
              scale;

          y =
            zone.centerY +
            dy *
              scale;

          continue;
        }

        const isInside =
          x >
            zone.minX &&
          x <
            zone.maxX &&
          y >
            zone.minY &&
          y <
            zone.maxY;

        if (!isInside) {
          continue;
        }

        const distances = [
          {
            side:
              "left" as const,
            value:
              Math.abs(
                x -
                  zone.minX,
              ),
          },
          {
            side:
              "right" as const,
            value:
              Math.abs(
                zone.maxX -
                  x,
              ),
          },
          {
            side:
              "top" as const,
            value:
              Math.abs(
                y -
                  zone.minY,
              ),
          },
          {
            side:
              "bottom" as const,
            value:
              Math.abs(
                zone.maxY -
                  y,
              ),
          },
        ].sort(
          (
            first,
            second,
          ) =>
            first.value -
            second.value,
        );

        const nearest =
          distances[0];

        if (
          nearest.side ===
          "left"
        ) {
          x =
            zone.minX;

          continue;
        }

        if (
          nearest.side ===
          "right"
        ) {
          x =
            zone.maxX;

          continue;
        }

        if (
          nearest.side ===
          "top"
        ) {
          y =
            zone.minY;

          continue;
        }

        y =
          zone.maxY;
      }

      return {
        x,
        y,
      };
    }

    function constrainToWalkableField(
      nextX: number,
      nextY: number,
    ) {
      let x = nextX;
      let y = nextY;

      const firstBounds =
        getWalkableBounds(
          x,
          y,
        );

      x = clamp(
        x,
        firstBounds.minX,
        firstBounds.maxX,
      );

      y = clamp(
        y,
        firstBounds.minY,
        firstBounds.maxY,
      );

      const collisionResolved =
        resolveStaticCollisions(
          x,
          y,
        );

      x =
        collisionResolved.x;

      y =
        collisionResolved.y;

      const finalBounds =
        getWalkableBounds(
          x,
          y,
        );

      x = clamp(
        x,
        finalBounds.minX,
        finalBounds.maxX,
      );

      y = clamp(
        y,
        finalBounds.minY,
        finalBounds.maxY,
      );

      return {
        x,
        y,
      };
    }

    function applyPlayerTransform() {
      const element =
        playerElementRef.current;

      if (!element) {
        return;
      }

      const {
        x,
        y,
      } =
        playerPositionRef.current;

      const pixelX =
        (
          x /
          100
        ) *
        window.innerWidth;

      const pixelY =
        (
          y /
          100
        ) *
        window.innerHeight;

      element.style.transform =
        `translate3d(${pixelX}px, ${pixelY}px, 0) translate(-50%, -50%)`;
    }

    function getPlayerSpriteMotionElement() {
      const scopeElement =
        playerMotionRef.current;

      if (!scopeElement) {
        return null;
      }

      return scopeElement.querySelector<
        HTMLDivElement
      >(
        '[data-hoo-player-sprite-motion="true"]',
      );
    }

    function applyPlayerFacingDirection(
      moveX: number,
      moveY: number,
    ) {
      /*
       * HOO 마스코트는 좌/우 방향만 실제 외형 방향으로 사용한다.
       *
       * - 좌우 이동: 해당 방향을 바라본다.
       * - 상하 이동: 마지막 좌/우 바라보는 방향을 그대로 유지한다.
       *
       * 예)
       * 오른쪽 이동 -> 위 이동 = 계속 오른쪽
       * 왼쪽 이동 -> 아래 이동 = 계속 왼쪽
       */
      if (moveX === 0) {
        return;
      }

      const nextFacing:
        HooWorldPlayerFacing =
        moveX < 0
          ? "left"
          : "right";

      if (
        nextFacing ===
        playerFacingRef.current
      ) {
        return;
      }

      playerFacingRef.current =
        nextFacing;

      setPlayerFacing(
        nextFacing,
      );
    }

    function resetPlayerWalkMotion() {
      const spriteMotionElement =
        getPlayerSpriteMotionElement();

      if (!spriteMotionElement) {
        return;
      }

      spriteMotionElement.dataset.hooMotionMode =
        "idle";

      spriteMotionElement.dataset.hooMotionFacing =
        playerFacingRef.current;

      spriteMotionElement.style.transition =
        "transform 120ms ease-out";

      spriteMotionElement.style.transform =
        "translate3d(0, 0, 0) rotate(0deg)";
    }

    function applyPlayerWalkMotion(
      currentTime: number,
      isMoving: boolean,
    ) {
      const spriteMotionElement =
        getPlayerSpriteMotionElement();

      if (!spriteMotionElement) {
        return;
      }

      if (!isMoving) {
        resetPlayerWalkMotion();
        return;
      }

      /*
       * HOO 마스코트는 사람형 관절 리그를 사용하지 않는다.
       * 이동 중 캐릭터 전체에만 아주 작은 바운스/기울기를 준다.
       */
      const cycle =
        (
          currentTime /
          360
        ) *
        Math.PI *
        2;

      const bounceY =
        Math.abs(
          Math.sin(
            cycle,
          ),
        ) * 2.2;

      const tilt =
        Math.sin(
          cycle,
        ) * 1.4;

      spriteMotionElement.dataset.hooMotionMode =
        "walk";

      spriteMotionElement.dataset.hooMotionFacing =
        playerFacingRef.current;

      spriteMotionElement.style.transition =
        "none";

      spriteMotionElement.style.transform =
        `translate3d(0, ${-bounceY}px, 0) rotate(${tilt}deg)`;
    }

    function stopMovementFrame() {
      if (
        movementFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          movementFrameRef.current,
        );

        movementFrameRef.current =
          null;
      }
    }

    function movePlayer(
      currentTime: number,
    ) {
      movementFrameRef.current =
        null;

      if (
        !hasMovementInput()
      ) {
        previousMovementTimeRef.current =
          0;

        resetPlayerWalkMotion();

        return;
      }

      if (
        previousMovementTimeRef.current ===
        0
      ) {
        previousMovementTimeRef.current =
          currentTime;
      }

      const deltaSeconds =
        Math.min(
          (
            currentTime -
            previousMovementTimeRef.current
          ) /
            1000,
          0.05,
        );

      previousMovementTimeRef.current =
        currentTime;

      /*
       * 상/하/좌/우를 서로 독립된 입력으로 계산한다.
       *
       * A + W  => moveX -1 / moveY -1
       * D + W  => moveX +1 / moveY -1
       * A + S  => moveX -1 / moveY +1
       * D + S  => moveX +1 / moveY +1
       *
       * 두 키를 동시에 누르면 같은 프레임에서
       * X축과 Y축이 동시에 반영된다.
       */
      const moveX =
        Number(
          movementInput.right,
        ) -
        Number(
          movementInput.left,
        );

      const moveY =
        Number(
          movementInput.down,
        ) -
        Number(
          movementInput.up,
        );

      if (
        moveX !== 0 ||
        moveY !== 0
      ) {
        applyPlayerFacingDirection(
          moveX,
          moveY,
        );

        const magnitude =
          Math.hypot(
            moveX,
            moveY,
          ) || 1;

        const speed = 20;

        const current =
          playerPositionRef.current;

        const previousX =
          current.x;

        const previousY =
          current.y;

        const nextPosition =
          constrainToWalkableField(
            current.x +
              (
                moveX /
                magnitude
              ) *
                speed *
                deltaSeconds,
            current.y +
              (
                moveY /
                magnitude
              ) *
                speed *
                deltaSeconds,
          );

        current.x =
          nextPosition.x;

        current.y =
          nextPosition.y;

        const didMove =
          Math.abs(
            current.x -
              previousX,
          ) >
            0.0001 ||
          Math.abs(
            current.y -
              previousY,
          ) >
            0.0001;

        applyPlayerTransform();

        applyPlayerWalkMotion(
          currentTime,
          didMove,
        );

        /*
         * 다른 이용자에게는 Presence sync를 기다리지 않고
         * Broadcast 채널로 좌표를 즉시 전송한다.
         *
         * 50ms 간격으로 x/y + 방향 + 이동 상태를 보내서
         * 상대 화면에서 거의 실시간으로 따라오게 한다.
         */
        if (
          currentTime -
            lastMovementBroadcastAtRef.current >=
          50
        ) {
          lastMovementBroadcastAtRef.current =
            currentTime;

          void updatePositionRef.current(
            current.x,
            current.y,
            playerFacingRef.current,
            didMove,
          );
        }
      } else {
        resetPlayerWalkMotion();
      }

      movementFrameRef.current =
        requestAnimationFrame(
          movePlayer,
        );
    }

    function startMovementFrame() {
      if (
        movementFrameRef.current !==
        null
      ) {
        return;
      }

      previousMovementTimeRef.current =
        performance.now();

      movementFrameRef.current =
        requestAnimationFrame(
          movePlayer,
        );
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      const handled =
        setMovementInput(
          event.code,
          true,
        );

      if (!handled) {
        return;
      }

      event.preventDefault();

      startMovementFrame();
    }

    function handleKeyUp(
      event: KeyboardEvent,
    ) {
      const handled =
        setMovementInput(
          event.code,
          false,
        );

      if (!handled) {
        return;
      }

      event.preventDefault();

      /*
       * 대각선 입력 중 한 키만 떼면
       * 남아 있는 방향 입력은 그대로 유지한다.
       */
      if (
        !hasMovementInput()
      ) {
        previousMovementTimeRef.current =
          0;

        resetPlayerWalkMotion();

        /*
         * 마지막 키를 놓는 순간 정지 좌표를 즉시 한 번 더 보내
         * 상대 화면의 걷기 모션도 바로 멈춘다.
         */
        const current =
          playerPositionRef.current;

        lastMovementBroadcastAtRef.current =
          0;

        void updatePositionRef.current(
          current.x,
          current.y,
          playerFacingRef.current,
          false,
        );
      }
    }

    function handleBlur() {
      clearMovementInput();

      previousMovementTimeRef.current =
        0;

      resetPlayerWalkMotion();

      stopMovementFrame();

      /*
       * 창 전환/포커스 이탈 시에도 정지 상태를 즉시 확정한다.
       */
      const current =
        playerPositionRef.current;

      lastMovementBroadcastAtRef.current =
        0;

      void updatePositionRef.current(
        current.x,
        current.y,
        playerFacingRef.current,
        false,
      );
    }

    function handleResize() {
      const current =
        playerPositionRef.current;

      const constrained =
        constrainToWalkableField(
          current.x,
          current.y,
        );

      current.x =
        constrained.x;

      current.y =
        constrained.y;

      applyPlayerTransform();
    }

    const initialPosition =
      constrainToWalkableField(
        playerPositionRef.current
          .x,
        playerPositionRef.current
          .y,
      );

    playerPositionRef.current.x =
      initialPosition.x;

    playerPositionRef.current.y =
      initialPosition.y;

    const initialFrame =
      requestAnimationFrame(
        () => {
          applyPlayerTransform();
          resetPlayerWalkMotion();
        },
      );

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    window.addEventListener(
      "keyup",
      handleKeyUp,
    );

    window.addEventListener(
      "blur",
      handleBlur,
    );

    window.addEventListener(
      "resize",
      handleResize,
    );

    return () => {
      cancelAnimationFrame(
        initialFrame,
      );

      stopMovementFrame();

      resetPlayerWalkMotion();

      clearMovementInput();

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      window.removeEventListener(
        "keyup",
        handleKeyUp,
      );

      window.removeEventListener(
        "blur",
        handleBlur,
      );

      window.removeEventListener(
        "resize",
        handleResize,
      );
    };
  }, []);

  async function enterFocusModeFromHooWorld() {
    if (isEnteringFocusMode) {
      return;
    }

    setIsEnteringFocusMode(true);

    /*
     * 포커스 전환 순간 좌표를 정확하게 고정하기 위해
     * 이동 입력과 RAF를 먼저 정지한다.
     */
    movementInputRef.current.left = false;
    movementInputRef.current.right = false;
    movementInputRef.current.up = false;
    movementInputRef.current.down = false;

    if (
      movementFrameRef.current !== null
    ) {
      cancelAnimationFrame(
        movementFrameRef.current,
      );

      movementFrameRef.current = null;
    }

    previousMovementTimeRef.current = 0;

    /*
     * playerPositionRef는 현재 화면에서 실제로 이동한
     * 캐릭터의 최종 좌표를 가지고 있다.
     *
     * 이 값을 포커스 진입 좌표의 단일 기준점으로 사용한다.
     */
    const currentPosition = {
      x: playerPositionRef.current.x,
      y: playerPositionRef.current.y,
    };

    try {
      /*
       * 중요:
       * updateStatus("focusing")보다 먼저 현재 좌표를 저장한다.
       *
       * Presence 훅의 focusing 처리도 이 handoff 값을 읽기 때문에
       * 이전 포커스 좌표나 기본 리스폰 좌표가 끼어들지 않고
       * 방금 이동을 멈춘 실제 위치를 그대로 사용하게 된다.
       */
      window.sessionStorage.setItem(
        "hoo-world-focus-position",
        JSON.stringify(
          currentPosition,
        ),
      );

      window.sessionStorage.setItem(
        "hoo-world-open-focus",
        "true",
      );

      /*
       * 현재 실제 좌표와 바라보는 방향을
       * 정지 상태로 Broadcast에 마지막 한 번 확정한다.
       */
      await updatePosition(
        currentPosition.x,
        currentPosition.y,
        playerFacingRef.current,
        false,
      );

      /*
       * 최신 좌표가 저장된 뒤 focusing Presence를 갱신하므로
       * 다른 이용자와 늦게 들어온 이용자 모두 같은 좌표를 본다.
       */
      await updateStatus(
        "focusing",
      );

      window.location.assign("/");
    } catch (error) {
      /*
       * 포커스 진입에 실패했다면
       * 실패한 handoff가 다음 진입에 남지 않도록 정리한다.
       */
      window.sessionStorage.removeItem(
        "hoo-world-focus-position",
      );

      window.sessionStorage.removeItem(
        "hoo-world-open-focus",
      );

      window.sessionStorage.removeItem(
        "hoo-world-focus-field-id",
      );

      window.sessionStorage.removeItem(
        "hoo-world-focus-facing",
      );

      console.error(
        "HOO WORLD 포커스모드 연결에 실패했습니다.",
        error,
      );

      setIsEnteringFocusMode(false);
    }
  }

  function getRemotePlayerPosition(
    userId: string,
    index: number,
  ) {
    const remotePlayer =
      remotePlayers.find(
        (player) =>
          player.userId === userId,
      );

    const remoteX =
      Number(
        remotePlayer?.x,
      );

    const remoteY =
      Number(
        remotePlayer?.y,
      );

    if (
      Number.isFinite(remoteX) &&
      Number.isFinite(remoteY)
    ) {
      return {
        x: Math.max(
          0,
          Math.min(
            100,
            remoteX,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            100,
            remoteY,
          ),
        ),
      };
    }

    /*
     * 아직 좌표 패킷을 받지 못한 이용자도
     * 화면에서 사라지지 않도록 안정적인 임시 위치를 사용한다.
     */
    let hash = 0;

    for (
      let charIndex = 0;
      charIndex < userId.length;
      charIndex += 1
    ) {
      hash =
        (
          hash * 31 +
          userId.charCodeAt(
            charIndex,
          )
        ) >>> 0;
    }

    const fallbackPositions = [
      { x: 39, y: 69 },
      { x: 47, y: 67 },
      { x: 55, y: 68 },
      { x: 63, y: 70 },
      { x: 35, y: 58 },
      { x: 45, y: 56 },
      { x: 56, y: 56 },
      { x: 65, y: 58 },
      { x: 43, y: 46 },
      { x: 58, y: 46 },
    ];

    return fallbackPositions[
      (hash + index) %
        fallbackPositions.length
    ];
  }

  return (
    <main className="relative h-[100dvh] min-h-[640px] w-full overflow-hidden bg-[#7fa75d] text-[#2d3329]">
    
    
      {/* ─────────────────────────
          HOO WORLD FINAL BUILD v45 · STATIC WORLD COLLISION
          1. 전체 잔디
          2. 중앙의 넓은 흙 공터
          3. 맵 외곽의 빽빽한 숲
      ───────────────────────── */}

      {/* 전체 잔디 바닥 */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#a8cd7d] via-[#8db664] to-[#6f944f]" />

      {/* 필드 원근감 - 위쪽은 밝고 멀게, 아래쪽은 조금 더 진하고 가깝게 */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_bottom,rgba(222,236,181,0.10)_0%,rgba(255,255,255,0.015)_38%,rgba(66,102,54,0.045)_69%,rgba(45,77,42,0.10)_100%)]" />
      <div className="pointer-events-none absolute inset-x-[8%] top-[7%] z-[1] h-[24%] rounded-[50%] bg-[#d8e8ad]/8 blur-[32px]" />
      <div className="pointer-events-none absolute inset-x-[13%] bottom-[-9%] z-[1] h-[27%] rounded-[50%] bg-[#426f3f]/8 blur-[34px]" />

      {/* 잔디의 큰 색 변화 - 한 장짜리 평면처럼 보이지 않도록 분산 */}
      <div className="pointer-events-none absolute -left-[10%] top-[13%] z-[1] h-[36%] w-[38%] -rotate-6 rounded-[50%] bg-[#c7df9b]/16 blur-[34px]" />
      <div className="pointer-events-none absolute left-[18%] top-[8%] z-[1] h-[31%] w-[29%] rotate-3 rounded-[50%] bg-[#7eaa5b]/12 blur-[32px]" />
      <div className="pointer-events-none absolute left-[42%] top-[13%] z-[1] h-[29%] w-[28%] -rotate-4 rounded-[50%] bg-[#bdd88c]/12 blur-[30px]" />
      <div className="pointer-events-none absolute -right-[9%] top-[18%] z-[1] h-[38%] w-[38%] rotate-5 rounded-[50%] bg-[#557e45]/11 blur-[35px]" />
      <div className="pointer-events-none absolute -left-[7%] bottom-[3%] z-[1] h-[34%] w-[34%] rotate-4 rounded-[50%] bg-[#638747]/11 blur-[36px]" />
      <div className="pointer-events-none absolute left-[29%] bottom-[-13%] z-[1] h-[38%] w-[41%] rounded-[50%] bg-[#5e8246]/12 blur-[40px]" />
      <div className="pointer-events-none absolute right-[2%] bottom-[1%] z-[1] h-[31%] w-[32%] -rotate-5 rounded-[50%] bg-[#9fc474]/10 blur-[34px]" />

      {/* 잔디 수채화 입자 */}
      <div className="pointer-events-none absolute inset-0 z-[2] opacity-[0.13] [background-image:radial-gradient(circle_at_20%_30%,#dcebb7_0_1px,transparent_1.5px),radial-gradient(circle_at_70%_55%,#426f3a_0_1px,transparent_1.5px),radial-gradient(circle_at_45%_80%,#eef1c7_0_1px,transparent_1.5px)] [background-size:29px_31px,41px_43px,53px_57px]" />

      {/* 짧은 잔디 결 - 아주 옅게 두 겹 */}
      <div className="pointer-events-none absolute inset-0 z-[2] opacity-[0.075] [background-image:linear-gradient(103deg,transparent_0_47%,rgba(68,105,57,0.42)_48%_49%,transparent_50%_100%)] [background-size:43px_35px]" />
      <div className="pointer-events-none absolute inset-0 z-[2] opacity-[0.055] [background-image:linear-gradient(78deg,transparent_0_48%,rgba(210,228,166,0.38)_49%_50%,transparent_51%_100%)] [background-size:59px_47px]" />

      {/* 넓은 잔디 얼룩 / 색이 조금씩 다른 군락 */}
      {[
        [12, 22, 145, 54, -12, "#b9d58c", 0.10],
        [24, 66, 132, 49, 8, "#5f8a49", 0.08],
        [37, 17, 122, 44, 5, "#c5dc98", 0.08],
        [56, 74, 151, 54, -6, "#60894a", 0.075],
        [71, 20, 133, 48, 9, "#b4d184", 0.085],
        [84, 63, 128, 47, -8, "#5b8247", 0.075],
      ].map(
        (
          [
            left,
            top,
            width,
            height,
            rotate,
            color,
            opacity,
          ],
          index,
        ) => (
          <span
            key={`field-grass-tone-${index}`}
            className="pointer-events-none absolute z-[2] rounded-[50%] blur-[7px]"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width,
              height,
              backgroundColor: String(
                color,
              ),
              opacity,
              transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
            }}
          />
        ),
      )}

      {/* 낮은 잔디 군락 - 큰 오브젝트가 아니라 필드 결만 보강 */}
      {[
        [15, 29, 0.90, -8],
        [21, 52, 0.74, 6],
        [28, 19, 0.82, -4],
        [34, 76, 0.78, 5],
        [47, 20, 0.70, -6],
        [56, 79, 0.76, 7],
        [68, 18, 0.82, 4],
        [76, 72, 0.86, -5],
        [85, 31, 0.78, 6],
        [88, 57, 0.72, -7],
      ].map(
        (
          [
            left,
            top,
            scale,
            rotate,
          ],
          patchIndex,
        ) => (
          <div
            key={`field-low-grass-${patchIndex}`}
            className="pointer-events-none absolute z-[3] h-[30px] w-[52px] origin-bottom opacity-55"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
            }}
          >
            {[5, 12, 20, 29, 38, 46].map(
              (
                bladeLeft,
                bladeIndex,
              ) => (
                <span
                  key={`field-low-grass-blade-${patchIndex}-${bladeLeft}`}
                  className="absolute bottom-0 w-[2px] origin-bottom rounded-full bg-gradient-to-b from-[#80aa62] to-[#466f3c]"
                  style={{
                    left:
                      bladeLeft,
                    height:
                      12 +
                      (
                        bladeIndex %
                        3
                      ) *
                        5,
                    transform: `rotate(${bladeIndex % 2 === 0 ? -12 : 11}deg)`,
                    opacity:
                      0.50 +
                      (
                        bladeIndex %
                        3
                      ) *
                        0.08,
                  }}
                />
              ),
            )}
          </div>
        ),
      )}

      {/* ─────────────────────────
          v42 환경 밀도 업그레이드
          기존 맵 구조는 그대로 두고, 잔디·숲·공터 사이의 깊이와 자연스러운 불규칙성을 보강
      ───────────────────────── */}

      {/* 넓은 필드에 희미한 지형 음영을 추가해서 평면감을 줄임 */}
      <div className="pointer-events-none absolute left-[4%] top-[35%] z-[2] h-[18%] w-[25%] -rotate-6 rounded-[50%] bg-[#527545]/6 blur-[26px]" />
      <div className="pointer-events-none absolute right-[6%] top-[38%] z-[2] h-[17%] w-[23%] rotate-7 rounded-[50%] bg-[#567a47]/6 blur-[26px]" />
      <div className="pointer-events-none absolute left-[18%] bottom-[14%] z-[2] h-[15%] w-[22%] rotate-4 rounded-[50%] bg-[#4e7142]/5 blur-[24px]" />
      <div className="pointer-events-none absolute right-[18%] bottom-[12%] z-[2] h-[14%] w-[21%] -rotate-5 rounded-[50%] bg-[#4b6f41]/5 blur-[24px]" />

      {/* 숲 아래쪽의 더 짙은 잔디 띠 */}
      <div className="pointer-events-none absolute inset-x-[7%] top-[18%] z-[3] h-[6%] rounded-[50%] bg-[#436f43]/7 blur-[12px]" />
      <div className="pointer-events-none absolute inset-x-[9%] bottom-[8%] z-[3] h-[6%] rounded-[50%] bg-[#3f6840]/7 blur-[12px]" />

      {/* 맵 전역의 작은 풀꽃 / 잔디 포인트 */}
      {[
        [17, 31, 0.85, -8],
        [23, 72, 0.72, 6],
        [31, 24, 0.75, 5],
        [39, 82, 0.68, -6],
        [52, 21, 0.80, 4],
        [61, 78, 0.72, -4],
        [70, 28, 0.78, 7],
        [78, 69, 0.70, -5],
        [84, 36, 0.82, 6],
      ].map(
        (
          [
            left,
            top,
            scale,
            rotate,
          ],
          index,
        ) => (
          <div
            key={`field-fine-grass-${index}`}
            className="pointer-events-none absolute z-[3] h-[18px] w-[26px] origin-bottom opacity-50"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
            }}
          >
            <span className="absolute bottom-0 left-[5px] h-[13px] w-[2px] origin-bottom -rotate-12 rounded-full bg-[#587d49]" />
            <span className="absolute bottom-0 left-[11px] h-[16px] w-[2px] origin-bottom rotate-6 rounded-full bg-[#73985a]" />
            <span className="absolute bottom-0 left-[17px] h-[12px] w-[2px] origin-bottom rotate-12 rounded-full bg-[#4f7544]" />
            {index % 3 === 0 && (
              <span className="absolute left-[9px] top-[2px] h-[4px] w-[4px] rounded-full bg-[#d4d98e]/70 shadow-[0_0_2px_rgba(213,220,142,0.28)]" />
            )}
          </div>
        ),
      )}

      {/* 나무 근처 떨어진 잔가지 */}
      {[
        [14, 37, 22, -18],
        [19, 67, 19, 13],
        [81, 34, 21, 17],
        [86, 66, 20, -14],
        [34, 18, 17, 8],
        [66, 18, 18, -7],
      ].map(
        (
          [
            left,
            top,
            width,
            rotate,
          ],
          index,
        ) => (
          <span
            key={`field-twig-${index}`}
            className="pointer-events-none absolute z-[3] h-[2px] origin-left rounded-full bg-[#65533b]/38 shadow-[0_1px_1px_rgba(65,52,37,0.08)]"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width,
              transform: `rotate(${rotate}deg)`,
            }}
          >
            <span className="absolute right-[15%] top-[-3px] h-[6px] w-[1px] origin-bottom rotate-[42deg] rounded-full bg-[#65533b]/28" />
          </span>
        ),
      )}

      {/* 화면 중앙에 아주 약한 따뜻한 광량을 추가해 캠프가 자연스럽게 중심이 되도록 함 */}
      <div className="pointer-events-none absolute left-1/2 top-[48%] z-[3] h-[34%] w-[40%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#e5c981]/3 blur-[30px]" />

      {/* ─────────────────────────
          v40 필드 마감 디테일
          큰 구조는 건드리지 않고 빛 / 낙엽 / 작은 돌만 아주 약하게 보강
      ───────────────────────── */}

      {/* 나뭇잎 사이로 들어오는 부드러운 얼룩빛 */}
      <div className="pointer-events-none absolute left-[13%] top-[20%] z-[2] h-[16%] w-[18%] -rotate-12 rounded-[50%] bg-[#e4e9aa]/8 blur-[18px]" />
      <div className="pointer-events-none absolute left-[69%] top-[24%] z-[2] h-[13%] w-[16%] rotate-8 rounded-[50%] bg-[#dce7a2]/7 blur-[18px]" />
      <div className="pointer-events-none absolute left-[21%] top-[69%] z-[2] h-[12%] w-[15%] rotate-6 rounded-[50%] bg-[#d5e39b]/6 blur-[18px]" />
      <div className="pointer-events-none absolute right-[12%] top-[66%] z-[2] h-[14%] w-[17%] -rotate-8 rounded-[50%] bg-[#d9e6a0]/6 blur-[18px]" />

      {/* 숲 가장자리의 낙엽 / 마른 풀 조각 */}
      {[
        {
          left: 12,
          top: 25,
          width: 7,
          height: 3,
          rotate: -24,
          color: "#8c7547",
        },
        {
          left: 17,
          top: 20,
          width: 5,
          height: 2,
          rotate: 17,
          color: "#a0844e",
        },
        {
          left: 82,
          top: 22,
          width: 7,
          height: 3,
          rotate: 28,
          color: "#876f43",
        },
        {
          left: 88,
          top: 29,
          width: 5,
          height: 2,
          rotate: -16,
          color: "#9a7d49",
        },
        {
          left: 11,
          top: 73,
          width: 6,
          height: 2,
          rotate: 14,
          color: "#816a40",
        },
        {
          left: 16,
          top: 80,
          width: 7,
          height: 3,
          rotate: -21,
          color: "#9a7a47",
        },
        {
          left: 83,
          top: 78,
          width: 6,
          height: 2,
          rotate: 19,
          color: "#876d42",
        },
        {
          left: 89,
          top: 72,
          width: 5,
          height: 2,
          rotate: -11,
          color: "#9a814e",
        },
      ].map(
        (
          leaf,
          index,
        ) => (
          <span
            key={`field-leaf-litter-${index}`}
            className="pointer-events-none absolute z-[3] rounded-[70%_30%_65%_35%] opacity-35 shadow-[0_1px_1px_rgba(65,53,36,0.10)]"
            style={{
              left: `${leaf.left}%`,
              top: `${leaf.top}%`,
              width: leaf.width,
              height: leaf.height,
              backgroundColor:
                leaf.color,
              transform: `rotate(${leaf.rotate}deg)`,
            }}
          />
        ),
      )}

      {/* 필드 안쪽의 아주 작은 자연석 */}
      {[
        {
          left: 25,
          top: 28,
          width: 9,
          height: 5,
          rotate: -8,
        },
        {
          left: 73,
          top: 31,
          width: 8,
          height: 5,
          rotate: 11,
        },
        {
          left: 19,
          top: 59,
          width: 7,
          height: 4,
          rotate: 6,
        },
        {
          left: 80,
          top: 61,
          width: 9,
          height: 5,
          rotate: -13,
        },
        {
          left: 31,
          top: 78,
          width: 8,
          height: 4,
          rotate: 12,
        },
        {
          left: 69,
          top: 76,
          width: 7,
          height: 4,
          rotate: -5,
        },
      ].map(
        (
          stone,
          index,
        ) => (
          <span
            key={`field-micro-stone-${index}`}
            className="pointer-events-none absolute z-[3] rounded-[48%_52%_45%_55%] bg-gradient-to-br from-[#a7a18a]/45 to-[#6f7467]/38 shadow-[0_1px_2px_rgba(48,55,43,0.10)]"
            style={{
              left: `${stone.left}%`,
              top: `${stone.top}%`,
              width: stone.width,
              height: stone.height,
              transform: `rotate(${stone.rotate}deg)`,
            }}
          />
        ),
      )}

      {/* 중앙 활동 구역 쪽으로 자연스럽게 시선이 모이는 아주 약한 밝기 */}
      <div className="pointer-events-none absolute left-1/2 top-[50%] z-[2] h-[48%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#d7db91]/4 blur-[32px]" />

      {/* ─────────────────────────
          중앙 흙 공터
      ───────────────────────── */}

      {/* 잔디와 흙 사이의 흐릿한 경계 */}
      <div
        className="pointer-events-none absolute left-1/2 top-[51%] z-[3] h-[40%] w-[43%] -translate-x-1/2 -translate-y-1/2 bg-[#70563e]/16 blur-[13px]"
        style={{
          clipPath:
            "polygon(8% 33%, 13% 18%, 25% 9%, 39% 5%, 55% 7%, 68% 12%, 82% 22%, 91% 36%, 94% 51%, 89% 66%, 79% 78%, 65% 88%, 49% 93%, 33% 90%, 19% 81%, 10% 69%, 5% 53%)",
        }}
      />

      {/* 메인 흙바닥 */}
      <section
        className="pointer-events-none absolute left-1/2 top-[51%] z-[4] h-[34%] w-[37%] -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-gradient-to-br from-[#c99d68] via-[#b98759] to-[#9e704b] shadow-[inset_0_16px_27px_rgba(255,225,174,0.11),inset_0_-17px_28px_rgba(92,61,40,0.14),0_10px_26px_rgba(63,73,47,0.09)]"
        style={{
          clipPath:
            "polygon(5% 36%, 10% 22%, 21% 12%, 35% 6%, 49% 7%, 61% 5%, 75% 13%, 86% 24%, 94% 39%, 96% 52%, 91% 66%, 82% 77%, 69% 87%, 54% 92%, 40% 90%, 26% 86%, 15% 76%, 8% 63%, 4% 49%)",
        }}
      >
        {/* 흙먼지 질감 */}
        <div className="absolute inset-0 opacity-[0.28] [background-image:radial-gradient(circle_at_20%_30%,#6d4d36_0_0.8px,transparent_1.2px),radial-gradient(circle_at_65%_18%,#e5c18e_0_1px,transparent_1.4px),radial-gradient(circle_at_78%_72%,#7a5538_0_0.7px,transparent_1.1px)] [background-size:23px_25px,31px_29px,41px_37px]" />

        {/* 자주 밟힌 중앙부 */}
        <div className="absolute left-[17%] top-[19%] h-[58%] w-[67%] -rotate-2 rounded-[49%_51%_45%_55%] bg-[#d4ad77]/13 blur-[8px]" />
        <div className="absolute left-[27%] top-[28%] h-[38%] w-[48%] rotate-2 rounded-[52%_48%_55%_45%] bg-[#8e633f]/8 blur-[9px]" />

        {/* 불규칙한 흙 얼룩 */}
        {[
          [13, 23, 105, 46, -9, 0.10],
          [30, 64, 126, 51, 7, 0.08],
          [49, 17, 92, 39, 4, 0.08],
          [61, 69, 115, 43, -6, 0.09],
          [78, 34, 94, 37, 8, 0.08],
          [83, 74, 78, 34, -9, 0.08],
        ].map(
          (
            [
              left,
              top,
              width,
              height,
              rotate,
              opacity,
            ],
            index,
          ) => (
            <span
              key={`field-dirt-patch-${index}`}
              className="absolute rounded-[50%] bg-[#71503a] blur-[3px]"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width,
                height,
                opacity,
                transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
              }}
            />
          ),
        )}

        {/* ─────────────────────────
            공동 캠핑구역 공간 뼈대
            실제 시설 없이, 흙의 마모와 색차만으로 자리만 미리 잡는다.
        ───────────────────────── */}

        {/* 캠프 주변 은은한 바닥 반사광 */}
        <div className="absolute left-1/2 top-[47%] h-[22%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#e5a04b]/5 blur-[15px]" />

        {/* 중앙 공동 허브 - HOO 공동 캠프파이어 */}
        <div className="absolute left-1/2 top-[47%] h-[31%] w-[27%] -translate-x-1/2 -translate-y-1/2">
          {/* 많이 밟힌 중앙 흙자리 */}
          <div className="absolute left-1/2 top-1/2 h-[88%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[48%_52%_46%_54%] bg-[#6f4d36]/7 blur-[2px]" />
          <div className="absolute left-1/2 top-1/2 h-[64%] w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#6e4e38]/10 bg-[#8b6244]/5" />

          {/* 불 주변의 그을린 흙 */}
          <div className="absolute left-1/2 top-[51%] h-[44%] w-[48%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#4c392f]/15 blur-[3px]" />
          <div className="absolute left-1/2 top-[51%] h-[31%] w-[35%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#332b27]/16" />

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

          {/* 장작 두 개 */}
          <div className="absolute left-1/2 top-[52%] z-[3] h-[11%] w-[43%] -translate-x-1/2 -translate-y-1/2 rotate-[22deg] overflow-hidden rounded-full border border-[#4e3328]/70 bg-gradient-to-r from-[#4d3025] via-[#805039] to-[#4c3026] shadow-[0_3px_4px_rgba(47,34,27,0.23)]">
            <span className="absolute left-[18%] top-[24%] h-[16%] w-[49%] rounded-full bg-[#b2754e]/24" />
          </div>
          <div className="absolute left-1/2 top-[52%] z-[3] h-[11%] w-[43%] -translate-x-1/2 -translate-y-1/2 -rotate-[22deg] overflow-hidden rounded-full border border-[#4d3227]/70 bg-gradient-to-r from-[#4a2f25] via-[#78503a] to-[#4b3026] shadow-[0_3px_4px_rgba(47,34,27,0.23)]">
            <span className="absolute left-[22%] top-[25%] h-[16%] w-[44%] rounded-full bg-[#b2754e]/21" />
          </div>

          {/* 작은 공동 불꽃 */}
          <div className="absolute left-1/2 top-[42%] z-[4] h-[42%] w-[35%] -translate-x-1/2">
            <div className="absolute bottom-[3%] left-1/2 h-[76%] w-[88%] -translate-x-1/2 rounded-full bg-[#ff9b43]/12 blur-[9px]" />
            <div className="absolute bottom-[15%] left-1/2 h-[46%] w-[62%] -translate-x-1/2 rounded-full bg-[#ffd66f]/7 blur-[7px]" />

            <div className="absolute bottom-[7%] left-[18%] h-[55%] w-[34%] -rotate-[13deg] rounded-[65%_35%_55%_45%] bg-gradient-to-t from-[#d94f2e] via-[#f47b38] to-[#ffc465]" />
            <div className="absolute bottom-[6%] right-[17%] h-[60%] w-[35%] rotate-[12deg] rounded-[45%_55%_64%_36%] bg-gradient-to-t from-[#df5930] via-[#f98a3d] to-[#ffd473]" />
            <div className="absolute bottom-[5%] left-1/2 h-[72%] w-[43%] -translate-x-1/2 rounded-[55%_45%_62%_38%] bg-gradient-to-t from-[#e8572d] via-[#ff963f] to-[#ffe086] shadow-[0_0_8px_rgba(255,141,54,0.38)]" />
            <div className="absolute bottom-[12%] left-1/2 h-[45%] w-[23%] -translate-x-1/2 rounded-[60%_40%_58%_42%] bg-gradient-to-t from-[#ffc849] to-[#fff2ad]" />
          </div>

          {/* 불씨 */}
          <span className="absolute left-[44%] top-[25%] z-[5] h-[3px] w-[3px] rounded-full bg-[#ffd477]/80 shadow-[0_0_3px_rgba(255,207,103,0.55)]" />
          <span className="absolute left-[57%] top-[31%] z-[5] h-[2px] w-[2px] rounded-full bg-[#ffbe5e]/75" />
          <span className="absolute left-[50%] top-[20%] z-[5] h-[2px] w-[2px] rounded-full bg-[#ffe09a]/70" />
        </div>

        {/* 중앙 캠프파이어 주변 공동 휴식자리 */}
        <div className="absolute left-[37%] top-[34%] h-[12%] w-[16%] -rotate-[11deg]">
          <div className="absolute bottom-[-3px] left-[4%] h-[35%] w-[92%] rounded-[50%] bg-[#4b392d]/13 blur-[3px]" />
          <div className="absolute inset-x-0 top-[10%] h-[58%] overflow-hidden rounded-[45%_55%_48%_52%] border border-[#5b3e2e]/55 bg-gradient-to-b from-[#9d6948] via-[#7f5239] to-[#60402f] shadow-[0_3px_5px_rgba(55,40,31,0.20)]">
            <span className="absolute left-[10%] top-[24%] h-[8%] w-[58%] rounded-full bg-[#c4875d]/22" />
            <span className="absolute right-[4%] top-[8%] h-[84%] w-[14%] rounded-[50%] border border-[#4f3428]/40 bg-[#74503a]" />
          </div>
        </div>

        <div className="absolute right-[37%] top-[35%] h-[12%] w-[16%] rotate-[11deg]">
          <div className="absolute bottom-[-3px] left-[4%] h-[35%] w-[92%] rounded-[50%] bg-[#4b392d]/13 blur-[3px]" />
          <div className="absolute inset-x-0 top-[10%] h-[58%] overflow-hidden rounded-[52%_48%_55%_45%] border border-[#5b3e2e]/55 bg-gradient-to-b from-[#9a6646] via-[#7b5038] to-[#5f3f2f] shadow-[0_3px_5px_rgba(55,40,31,0.20)]">
            <span className="absolute left-[14%] top-[24%] h-[8%] w-[52%] rounded-full bg-[#c4875d]/20" />
            <span className="absolute left-[3%] top-[8%] h-[84%] w-[14%] rounded-[50%] border border-[#4f3428]/40 bg-[#74503a]" />
          </div>
        </div>

        <div className="absolute left-1/2 top-[64%] h-[12%] w-[18%] -translate-x-1/2 rotate-[1deg]">
          <div className="absolute bottom-[-3px] left-[5%] h-[35%] w-[90%] rounded-[50%] bg-[#4b392d]/14 blur-[3px]" />
          <div className="absolute inset-x-0 top-[8%] h-[60%] overflow-hidden rounded-[48%_52%_45%_55%] border border-[#5a3d2d]/58 bg-gradient-to-b from-[#a16c49] via-[#80533a] to-[#60402f] shadow-[0_3px_5px_rgba(55,40,31,0.21)]">
            <span className="absolute left-[12%] top-[24%] h-[8%] w-[59%] rounded-full bg-[#c78a60]/22" />
            <span className="absolute right-[3%] top-[8%] h-[84%] w-[12%] rounded-[50%] border border-[#503528]/40 bg-[#73503a]" />
          </div>
        </div>

        {/* 작은 통나무 스툴 2개 */}
        <div className="absolute left-[38%] top-[57%] h-[6%] w-[6%] -rotate-6 rounded-[50%] border border-[#5a3d2e]/48 bg-gradient-to-br from-[#ad7651] via-[#83573e] to-[#60412f] shadow-[0_3px_4px_rgba(53,40,31,0.18)]">
          <span className="absolute left-[21%] top-[18%] h-[42%] w-[52%] rounded-[50%] border border-[#d0a071]/18" />
        </div>

        <div className="absolute right-[38%] top-[56%] h-[6%] w-[6%] rotate-7 rounded-[50%] border border-[#5a3d2e]/48 bg-gradient-to-br from-[#aa734f] via-[#80553c] to-[#5e402f] shadow-[0_3px_4px_rgba(53,40,31,0.18)]">
          <span className="absolute left-[21%] top-[18%] h-[42%] w-[52%] rounded-[50%] border border-[#d0a071]/18" />
        </div>

        {/* 좌측 공동 포커스 스팟 */}
        <div className="absolute left-[7%] top-[43%] h-[30%] w-[20%] -rotate-4">
          {/* 많이 밟힌 포커스 구역 바닥 */}
          <div className="absolute inset-[5%] rounded-[48%_52%_45%_55%] bg-[#d7b17d]/7 blur-[2px]" />
          <div className="absolute left-[10%] top-[16%] h-[67%] w-[79%] rounded-[48%_52%_46%_54%] border border-[#806248]/8 bg-[#e1bd8b]/4" />

          {/* 공용 긴 목재 테이블 */}
          <div className="absolute left-[18%] top-[31%] z-[2] h-[19%] w-[64%] -rotate-2 rounded-[16%_18%_14%_17%] border border-[#65452f]/48 bg-gradient-to-b from-[#a8734e] via-[#865a3d] to-[#684630] shadow-[0_3px_5px_rgba(54,39,29,0.18)]">
            <span className="absolute left-[7%] top-[20%] h-[11%] w-[68%] rounded-full bg-[#d39a68]/17" />
            <span className="absolute left-[11%] bottom-[-34%] h-[42%] w-[8%] rounded-b bg-[#5f412e]" />
            <span className="absolute right-[11%] bottom-[-34%] h-[42%] w-[8%] rounded-b bg-[#5f412e]" />
          </div>

          {/* 테이블 위 공용 노트북 2대 */}
          <div className="absolute left-[30%] top-[27%] z-[3] h-[15%] w-[18%] -rotate-3">
            <div className="absolute left-[5%] top-0 h-[72%] w-[90%] rounded-t-[5px] border border-[#495253]/55 bg-gradient-to-b from-[#718083] to-[#4c585b] shadow-sm">
              <span className="absolute left-[11%] top-[12%] h-[55%] w-[78%] rounded-[2px] bg-[#b7d7d1]/25" />
            </div>
            <div className="absolute bottom-0 left-0 h-[24%] w-full rounded-b-[3px] bg-[#596164]" />
          </div>

          <div className="absolute right-[28%] top-[29%] z-[3] h-[14%] w-[17%] rotate-2">
            <div className="absolute left-[5%] top-0 h-[72%] w-[90%] rounded-t-[5px] border border-[#495253]/55 bg-gradient-to-b from-[#728184] to-[#4d595c] shadow-sm">
              <span className="absolute left-[11%] top-[12%] h-[55%] w-[78%] rounded-[2px] bg-[#bddbd4]/24" />
            </div>
            <div className="absolute bottom-0 left-0 h-[24%] w-full rounded-b-[3px] bg-[#596164]" />
          </div>

          {/* 앞쪽 공용 통나무 좌석 2개 */}
          <div className="absolute left-[23%] top-[61%] z-[2] h-[12%] w-[23%] rotate-2 rounded-[45%_55%_48%_52%] border border-[#5a3d2d]/48 bg-gradient-to-b from-[#9d6948] via-[#7d5139] to-[#5e3f2e] shadow-[0_3px_4px_rgba(51,38,29,0.17)]">
            <span className="absolute left-[15%] top-[22%] h-[10%] w-[54%] rounded-full bg-[#c7875c]/18" />
          </div>

          <div className="absolute right-[22%] top-[60%] z-[2] h-[12%] w-[23%] -rotate-3 rounded-[52%_48%_55%_45%] border border-[#5a3d2d]/48 bg-gradient-to-b from-[#9a6646] via-[#7b5038] to-[#5d3e2e] shadow-[0_3px_4px_rgba(51,38,29,0.17)]">
            <span className="absolute left-[16%] top-[22%] h-[10%] w-[52%] rounded-full bg-[#c7875c]/18" />
          </div>

          {/* 작은 공용 랜턴 */}
          <div className="absolute left-[9%] top-[38%] z-[3] h-[25%] w-[12%]">
            <span className="absolute left-1/2 top-0 h-[40%] w-[8%] -translate-x-1/2 rounded-full bg-[#5b4935]" />
            <span className="absolute bottom-[8%] left-1/2 h-[48%] w-[58%] -translate-x-1/2 rounded-[28%] border border-[#5f482f]/55 bg-[#e9c768] shadow-[0_0_6px_rgba(243,204,102,0.19)]" />
            <span className="absolute bottom-[18%] left-1/2 h-[27%] w-[35%] -translate-x-1/2 rounded-[35%] bg-[#fff1a6]/70" />
          </div>

          {/* 구역 가장자리 낮은 풀 */}
          {[
            [9, 77, -12],
            [19, 87, 9],
            [78, 82, -8],
            [88, 70, 11],
          ].map(
            (
              [
                left,
                top,
                rotate,
              ],
              index,
            ) => (
              <span
                key={`focus-spot-grass-${index}`}
                className="absolute h-[12%] w-[3px] origin-bottom rounded-full bg-gradient-to-b from-[#769b59] to-[#456a3b]"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: `rotate(${rotate}deg)`,
                }}
              />
            ),
          )}
        </div>

        {/* 우측 공동 물품 / 배송 스테이션 */}
        <div className="absolute right-[7%] top-[43%] h-[30%] w-[20%] rotate-4">
          {/* 많이 밟힌 배송 구역 바닥 */}
          <div className="absolute inset-[5%] rounded-[52%_48%_55%_45%] bg-[#7c573d]/6 blur-[2px]" />
          <div className="absolute left-[8%] top-[11%] h-[75%] w-[84%] rounded-[50%_50%_47%_53%] border border-[#7a5a43]/8 bg-[#c99664]/4" />

          {/* 낮은 공동 목재 데크 */}
          <div className="absolute left-[13%] top-[47%] z-[2] h-[30%] w-[74%] -rotate-2 overflow-hidden rounded-[16%_18%_14%_17%] border border-[#62432f]/50 bg-gradient-to-b from-[#9f6c4b] via-[#7f563d] to-[#624331] shadow-[0_4px_6px_rgba(54,40,31,0.20)]">
            {[16, 34, 52, 70, 88].map(
              (
                top,
                index,
              ) => (
                <span
                  key={`delivery-deck-plank-${index}`}
                  className="absolute left-[4%] right-[4%] h-[2px] rounded-full bg-[#4f382b]/22"
                  style={{
                    top: `${top}%`,
                  }}
                />
              ),
            )}
            <span className="absolute left-[8%] top-[10%] h-[6%] w-[58%] rounded-full bg-[#d09b6d]/15" />
          </div>

          {/* 오픈형 공동 배송 카운터 */}
          <div className="absolute left-[22%] top-[24%] z-[3] h-[34%] w-[57%] -rotate-1">
            {/* 기둥 */}
            <span className="absolute bottom-[2%] left-[5%] h-[70%] w-[7%] rounded bg-gradient-to-r from-[#5e402e] to-[#79513a]" />
            <span className="absolute bottom-[2%] right-[5%] h-[70%] w-[7%] rounded bg-gradient-to-r from-[#5e402e] to-[#79513a]" />

            {/* 지붕 */}
            <div className="absolute left-1/2 top-0 h-[30%] w-[112%] -translate-x-1/2 -rotate-2 rounded-[42%_58%_35%_65%] border border-[#65442f]/48 bg-gradient-to-b from-[#b88357] via-[#95623f] to-[#744b34] shadow-[0_3px_5px_rgba(55,40,30,0.19)]">
              <span className="absolute left-[10%] top-[18%] h-[13%] w-[62%] rounded-full bg-[#d5a16e]/17" />
            </div>

            {/* 카운터 상판 */}
            <div className="absolute bottom-[24%] left-1/2 h-[18%] w-[92%] -translate-x-1/2 rounded-[12%] border border-[#5a3c2c]/48 bg-gradient-to-b from-[#a66f4b] to-[#76503a] shadow-[0_3px_4px_rgba(53,39,30,0.18)]">
              <span className="absolute left-[8%] top-[22%] h-[10%] w-[56%] rounded-full bg-[#ce9161]/18" />
            </div>

            {/* 작은 공동 표지판 */}
            <div className="absolute left-1/2 top-[20%] -translate-x-1/2 rounded-[4px] border border-[#5e412f]/45 bg-[#8b5d3e]/88 px-[7%] py-[2%] text-center text-[5px] font-black tracking-[0.12em] text-[#ead4ad]/80">
              HOO SUPPLY
            </div>
          </div>

          {/* 배송 상자 3개 */}
          <div className="absolute left-[17%] top-[64%] z-[4] h-[18%] w-[20%] -rotate-6 rounded-[10%] border border-[#6b4932]/50 bg-gradient-to-br from-[#bd8354] to-[#87583b] shadow-[0_3px_4px_rgba(55,39,28,0.18)]">
            <span className="absolute left-1/2 top-0 h-full w-[8%] -translate-x-1/2 bg-[#684830]/20" />
            <span className="absolute left-[10%] top-[18%] h-[8%] w-[55%] rounded-full bg-[#dcaa78]/18" />
          </div>

          <div className="absolute left-[36%] top-[67%] z-[4] h-[15%] w-[18%] rotate-3 rounded-[10%] border border-[#6a4832]/48 bg-gradient-to-br from-[#b87c4f] to-[#81543a] shadow-[0_3px_4px_rgba(55,39,28,0.17)]">
            <span className="absolute left-1/2 top-0 h-full w-[8%] -translate-x-1/2 bg-[#684830]/19" />
          </div>

          <div className="absolute right-[16%] top-[61%] z-[4] h-[20%] w-[22%] rotate-6 rounded-[10%] border border-[#6b4932]/50 bg-gradient-to-br from-[#c18958] to-[#8b5b3d] shadow-[0_3px_4px_rgba(55,39,28,0.18)]">
            <span className="absolute left-1/2 top-0 h-full w-[8%] -translate-x-1/2 bg-[#684830]/20" />
            <span className="absolute left-[12%] top-[18%] h-[8%] w-[50%] rounded-full bg-[#dfae7c]/17" />
          </div>

          {/* 배송 대기 표시용 작은 바구니 */}
          <div className="absolute right-[6%] top-[44%] z-[4] h-[17%] w-[15%] rotate-5 rounded-[30%_30%_45%_45%] border border-[#6a4d37]/45 bg-gradient-to-b from-[#a8794f] to-[#77543c] shadow-[0_2px_4px_rgba(54,40,31,0.15)]">
            <span className="absolute left-[15%] top-[-22%] h-[45%] w-[70%] rounded-[50%] border-2 border-[#755239]/55 border-b-0" />
          </div>

          {/* 구역 가장자리 낮은 풀 */}
          {[
            [10, 79, -12],
            [22, 89, 9],
            [77, 86, -9],
            [89, 73, 11],
          ].map(
            (
              [
                left,
                top,
                rotate,
              ],
              index,
            ) => (
              <span
                key={`delivery-spot-grass-${index}`}
                className="absolute h-[12%] w-[3px] origin-bottom rounded-full bg-gradient-to-b from-[#769b59] to-[#456a3b]"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: `rotate(${rotate}deg)`,
                }}
              />
            ),
          )}
        </div>

        {/* 아래쪽 공동 자유 배치 / 집합 공간 */}
        <div className="absolute bottom-[2%] left-[31%] h-[20%] w-[38%] -rotate-1">
          {/* 중앙은 비워두고, 바닥 마모만으로 공간의 존재를 표현 */}
          <div className="absolute inset-[3%] rounded-[48%_52%_46%_54%] bg-[#e1bf8b]/6 blur-[2px]" />
          <div className="absolute left-[8%] top-[9%] h-[78%] w-[84%] rounded-[47%_53%_49%_51%] border border-[#8b6749]/8 bg-[#d6ad78]/3" />

          {/* 사람들이 모이는 중심부의 아주 옅은 밟힌 자리 */}
          <div className="absolute left-1/2 top-[51%] h-[51%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#7a563d]/5 blur-[2px]" />

          {/* 외곽에만 작은 돌을 두어 자유 배치 영역을 암시 */}
          {[
            [14, 22, 13, 9, -12],
            [83, 24, 12, 9, 9],
            [88, 67, 13, 9, -7],
            [16, 71, 12, 9, 11],
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
                key={`shared-open-area-stone-${index}`}
                className="absolute rounded-[47%_53%_45%_55%] border border-[#777365]/30 bg-gradient-to-br from-[#a8a18d]/65 to-[#747267]/60 shadow-[0_2px_3px_rgba(57,49,40,0.11)]"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                  transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
                }}
              />
            ),
          )}

          {/* 가장자리의 낮은 풀 - 중앙 배치 공간은 침범하지 않음 */}
          {[
            [7, 43, -10],
            [20, 85, 8],
            [79, 84, -7],
            [94, 48, 10],
          ].map(
            (
              [
                left,
                top,
                rotate,
              ],
              index,
            ) => (
              <span
                key={`shared-open-area-grass-${index}`}
                className="absolute h-[13%] w-[3px] origin-bottom rounded-full bg-gradient-to-b from-[#7a9f5c] to-[#466b3c]"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: `rotate(${rotate}deg)`,
                }}
              />
            ),
          )}
        </div>

        {/* 각 구역을 중앙과 잇는 아주 희미한 밟힌 동선 */}
        <div className="absolute left-[23%] top-[45%] h-[6%] w-[25%] -rotate-2 rounded-[50%] bg-[#74513a]/6 blur-[2px]" />
        <div className="absolute right-[23%] top-[45%] h-[6%] w-[25%] rotate-2 rounded-[50%] bg-[#74513a]/6 blur-[2px]" />
        <div className="absolute bottom-[15%] left-[46%] h-[20%] w-[8%] rotate-1 rounded-[50%] bg-[#74513a]/5 blur-[2px]" />

        {/* 많이 밟힌 길쭉한 흙 결 */}
        <div className="absolute left-[19%] top-[41%] h-[9%] w-[30%] -rotate-6 rounded-[50%] bg-[#7d573d]/10 blur-[4px]" />
        <div className="absolute right-[16%] top-[54%] h-[8%] w-[27%] rotate-[7deg] rounded-[50%] bg-[#ead0a3]/8 blur-[4px]" />

        {/* 작은 발자국 / 끌린 흔적 */}
        {[
          [31, 50, 18, 7, -12, 0.13],
          [35, 54, 15, 6, -8, 0.11],
          [61, 42, 17, 6, 9, 0.12],
          [65, 46, 14, 5, 12, 0.10],
          [49, 68, 21, 7, -3, 0.09],
        ].map(
          (
            [
              left,
              top,
              width,
              height,
              rotate,
              opacity,
            ],
            index,
          ) => (
            <span
              key={`field-dirt-wear-${index}`}
              className="absolute rounded-[50%] bg-[#6f4d37] blur-[1px]"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width,
                height,
                opacity,
                transform: `rotate(${rotate}deg)`,
              }}
            />
          ),
        )}

        {/* 작은 돌 / 흙덩이 */}
        {[
          [15, 38, 14, 8, -8],
          [23, 73, 10, 6, 5],
          [37, 22, 12, 7, 9],
          [46, 80, 16, 8, -4],
          [59, 34, 11, 6, 7],
          [67, 72, 13, 7, -7],
          [77, 20, 10, 6, 6],
          [86, 55, 14, 7, -9],
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
              key={`field-dirt-pebble-${index}`}
              className="absolute rounded-[48%_52%] bg-[#846246]/34 shadow-[0_1px_1px_rgba(73,50,34,0.14)]"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width,
                height,
                transform: `rotate(${rotate}deg)`,
              }}
            />
          ),
        )}
      </section>

      {/* 흙 가장자리의 남은 잔디 조각 */}
      {[
        [31, 36, 64, 18, -18],
        [29, 48, 54, 17, -6],
        [33, 62, 68, 19, 12],
        [39, 69, 56, 16, 5],
        [47, 72, 60, 17, -3],
        [57, 70, 58, 16, 4],
        [66, 63, 67, 19, -13],
        [70, 52, 55, 17, 8],
        [69, 40, 58, 17, 16],
        [64, 31, 60, 17, -9],
        [53, 28, 55, 16, 4],
        [41, 30, 58, 17, 8],
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
          <div
            key={`field-grass-fringe-${index}`}
            className="pointer-events-none absolute z-[5] rounded-[50%] bg-[#789f57]/26 blur-[1.5px]"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width,
              height,
              transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
            }}
          >
            <span className="absolute left-[14%] top-[42%] h-[2px] w-[34%] rounded-full bg-[#5e8849]/22" />
            <span className="absolute right-[10%] top-[29%] h-[2px] w-[29%] rounded-full bg-[#a6c77c]/18" />
          </div>
        ),
      )}

      {/* 중앙 공동구역으로 이어지는 희미한 잔디 마모 방향 */}
      <div className="pointer-events-none absolute left-[26%] top-[47%] z-[5] h-[4%] w-[13%] -rotate-3 rounded-[50%] bg-[#799a59]/8 blur-[2px]" />
      <div className="pointer-events-none absolute right-[26%] top-[47%] z-[5] h-[4%] w-[13%] rotate-3 rounded-[50%] bg-[#799a59]/8 blur-[2px]" />
      <div className="pointer-events-none absolute bottom-[15%] left-[46%] z-[5] h-[12%] w-[8%] rounded-[50%] bg-[#759656]/7 blur-[2px]" />

      {/* 공터 바로 바깥의 닳은 잔디 조각 */}
      {[
        [36, 36, 46, 13, -12],
        [43, 31, 41, 12, 5],
        [57, 31, 44, 12, -5],
        [65, 38, 45, 13, 11],
        [68, 56, 47, 13, -8],
        [60, 68, 44, 12, 5],
        [47, 70, 49, 13, -4],
        [35, 61, 46, 13, 9],
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
            key={`field-worn-grass-${index}`}
            className="pointer-events-none absolute z-[5] rounded-[50%] bg-[#9dbb72]/16 blur-[1px]"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width,
              height,
              transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
            }}
          />
        ),
      )}

      {/* ─────────────────────────
          맵 외곽의 울창한 숲
      ───────────────────────── */}

      <>
        <HooWorldBoundaryForest />

        {/* v41 숲 입체감 보강 - 기존 나무 구조는 유지하고 명암층만 추가 */}
        <svg
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 z-[7] h-full w-full"
          aria-hidden="true"
          style={{
            transform:
              "scale(1.16)",
            transformOrigin:
              "50% 50%",
          }}
        >
          {/* 상단 수관의 안쪽 깊은 그림자 */}
          <path
            transform="translate(0 -45)"
            d="M0 118
               C90 137 171 126 252 139
               C337 152 413 133 500 145
               C585 157 668 139 751 150
               C838 161 918 141 1006 152
               C1094 164 1172 143 1260 154
               C1347 166 1437 148 1600 160
               L1600 188
               C1455 176 1360 193 1261 181
               C1165 169 1084 188 998 176
               C909 165 829 183 742 172
               C654 161 576 178 492 167
               C408 156 331 174 246 162
               C162 151 84 164 0 151 Z"
            fill="#173c29"
            opacity="0.16"
          />

          {/* 상단 나뭇잎 가장자리 하이라이트 */}
          <path
            transform="translate(0 -45)"
            d="M68 155
               C136 137 192 145 252 154
               C322 165 374 151 441 159
               C508 167 558 155 622 162
               C691 170 743 158 807 165
               C873 173 929 160 994 167
               C1061 175 1114 163 1177 169
               C1243 177 1303 164 1370 171
               C1432 178 1496 170 1545 178"
            fill="none"
            stroke="#a6c77a"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.10"
          />

          {/* 좌측 숲 내부 깊이 */}
          <path
            d="M102 170
               C126 223 112 280 129 334
               C144 389 125 446 140 503
               C154 560 135 617 149 675
               C160 726 150 777 166 833"
            fill="none"
            stroke="#153a27"
            strokeWidth="31"
            strokeLinecap="round"
            opacity="0.13"
          />

          {/* 우측 숲 내부 깊이 */}
          <path
            d="M1498 171
               C1477 226 1488 281 1472 338
               C1457 392 1476 450 1460 506
               C1446 563 1465 620 1451 677
               C1439 730 1450 781 1434 834"
            fill="none"
            stroke="#153a27"
            strokeWidth="31"
            strokeLinecap="round"
            opacity="0.13"
          />

          {/* 하단 수관 안쪽 그림자 */}
          <path
            d="M0 838
               C107 823 202 838 302 827
               C404 816 496 836 598 824
               C704 812 800 834 903 822
               C1007 810 1104 833 1208 821
               C1312 809 1411 830 1600 815
               L1600 850
               C1420 865 1313 845 1207 857
               C1102 869 1006 846 902 858
               C797 870 701 849 597 861
               C492 873 401 852 298 864
               C197 875 101 861 0 875 Z"
            fill="#173c29"
            opacity="0.15"
          />

          {/* 하단 잎 가장자리 하이라이트 */}
          <path
            d="M61 824
               C145 813 212 824 290 817
               C369 809 438 822 517 814
               C598 806 668 821 747 812
               C829 803 897 819 978 811
               C1061 802 1128 818 1209 810
               C1292 801 1374 813 1541 800"
            fill="none"
            stroke="#8fb56b"
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.085"
          />
        </svg>

        {/* 숲 안쪽 작은 빛 포켓 - 반복적인 수관 패턴을 깨준다 */}
        <div className="pointer-events-none absolute left-[9%] top-[17%] z-[7] h-[8%] w-[10%] -rotate-12 rounded-[50%] bg-[#9fc17a]/8 blur-[10px]" />
        <div className="pointer-events-none absolute left-[32%] top-[15%] z-[7] h-[7%] w-[9%] rotate-6 rounded-[50%] bg-[#a8ca7f]/7 blur-[10px]" />
        <div className="pointer-events-none absolute right-[30%] top-[16%] z-[7] h-[7%] w-[9%] -rotate-5 rounded-[50%] bg-[#9fc17a]/7 blur-[10px]" />
        <div className="pointer-events-none absolute right-[8%] top-[18%] z-[7] h-[8%] w-[10%] rotate-10 rounded-[50%] bg-[#a5c77d]/8 blur-[10px]" />

        <div className="pointer-events-none absolute left-[7%] bottom-[8%] z-[7] h-[7%] w-[10%] rotate-8 rounded-[50%] bg-[#8fb36c]/7 blur-[10px]" />
        <div className="pointer-events-none absolute left-[34%] bottom-[7%] z-[7] h-[6%] w-[9%] -rotate-6 rounded-[50%] bg-[#93b86e]/6 blur-[10px]" />
        <div className="pointer-events-none absolute right-[31%] bottom-[8%] z-[7] h-[6%] w-[9%] rotate-5 rounded-[50%] bg-[#8fb36c]/6 blur-[10px]" />
        <div className="pointer-events-none absolute right-[7%] bottom-[7%] z-[7] h-[7%] w-[10%] -rotate-9 rounded-[50%] bg-[#93b86e]/7 blur-[10px]" />
      </>

      {/* ─────────────────────────
          숲과 잔디의 접촉부
          나무가 공중에 떠 보이지 않도록 낮은 덤불/그늘/잔디를 한 겹 연결
      ───────────────────────── */}

      <svg
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 z-[8] h-full w-full"
        aria-hidden="true"
        style={{
          transform:
            "scale(1.14)",
          transformOrigin:
            "50% 50%",
        }}
      >
        {/* 상단 숲 아래의 부드러운 지면 그늘 */}
        <path
          transform="translate(0 -40)"
          d="M0 112
             C118 127 213 116 321 130
             C426 143 521 124 624 136
             C731 149 834 126 940 139
             C1054 152 1155 128 1266 140
             C1381 153 1482 138 1600 147
             L1600 181
             C1480 169 1371 181 1260 168
             C1149 156 1046 180 935 166
             C829 154 727 176 618 162
             C511 149 420 168 315 156
             C208 143 110 157 0 145 Z"
          fill="#335d3a"
          opacity="0.17"
        />

        {/* 좌측 숲 접촉부 */}
        <path
          d="M78 0
             C95 92 89 172 103 253
             C116 333 96 411 109 493
             C121 576 103 654 115 735
             C123 791 117 845 127 900
             L164 900
             C150 840 157 785 146 728
             C135 651 153 576 141 496
             C129 416 147 337 134 256
             C122 177 128 93 113 0 Z"
          fill="#2f5a38"
          opacity="0.16"
        />

        {/* 우측 숲 접촉부 */}
        <path
          d="M1522 0
             C1508 92 1515 176 1502 257
             C1490 338 1508 418 1495 500
             C1483 581 1501 658 1488 739
             C1479 796 1485 849 1475 900
             L1439 900
             C1453 840 1446 783 1457 727
             C1468 650 1450 575 1462 496
             C1474 416 1456 338 1469 257
             C1481 176 1476 92 1490 0 Z"
          fill="#2f5a38"
          opacity="0.16"
        />

        {/* 하단 숲 위의 부드러운 접지 */}
        <path
          d="M0 823
             C119 809 225 823 335 811
             C446 800 548 820 659 808
             C773 796 880 819 992 807
             C1105 795 1214 818 1326 806
             C1425 795 1514 805 1600 794
             L1600 842
             C1511 852 1421 840 1322 850
             C1209 862 1104 842 993 854
             C879 866 775 844 660 856
             C549 868 446 848 334 860
             C221 872 113 858 0 872 Z"
          fill="#2a5335"
          opacity="0.19"
        />
      </svg>

      {/* 외곽에 낮은 풀 군락을 배치해서 숲-초원 경계를 끊어준다 */}
      {[
        [6, 8, 0.78, -8],
        [17, 7, 0.70, 6],
        [29, 8, 0.66, -5],
        [42, 7, 0.72, 5],
        [57, 8, 0.68, -6],
        [71, 7, 0.74, 4],
        [84, 8, 0.70, -5],
        [94, 9, 0.76, 7],

        [5, 42, 0.75, 6],
        [4, 63, 0.70, -7],
        [5, 79, 0.76, 5],

        [95, 40, 0.72, -6],
        [96, 61, 0.74, 7],
        [95, 78, 0.78, -5],

        [18, 93, 0.74, 5],
        [35, 94, 0.70, -6],
        [54, 94, 0.76, 4],
        [72, 93, 0.72, -5],
        [86, 92, 0.78, 6],
      ].map(
        (
          [
            left,
            top,
            scale,
            rotate,
          ],
          patchIndex,
        ) => (
          <div
            key={`forest-edge-grass-${patchIndex}`}
            className="pointer-events-none absolute z-[9] h-[32px] w-[58px] origin-bottom opacity-60"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
            }}
          >
            {[5, 13, 22, 31, 40, 49].map(
              (
                bladeLeft,
                bladeIndex,
              ) => (
                <span
                  key={`forest-edge-blade-${patchIndex}-${bladeLeft}`}
                  className="absolute bottom-0 w-[2px] origin-bottom rounded-full bg-gradient-to-b from-[#7da15c] to-[#355f37]"
                  style={{
                    left:
                      bladeLeft,
                    height:
                      13 +
                      (
                        bladeIndex %
                        3
                      ) *
                        5,
                    transform: `rotate(${bladeIndex % 2 === 0 ? -13 : 12}deg)`,
                    opacity:
                      0.52 +
                      (
                        bladeIndex %
                        3
                      ) *
                        0.08,
                  }}
                />
              ),
            )}
          </div>
        ),
      )}

      {/* 외곽 숲이 만드는 부드러운 그늘 */}
      <div className="pointer-events-none absolute inset-0 z-[10] bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_49%,rgba(27,61,38,0.055)_66%,rgba(22,51,32,0.19)_100%)]" />

      {/* 바닥에 떨어지는 나뭇잎 그림자 */}
      <div className="pointer-events-none absolute left-[5%] top-[27%] z-[9] h-[31%] w-[17%] -rotate-8 rounded-[50%] bg-[#244d31]/8 blur-[20px]" />
      <div className="pointer-events-none absolute right-[4%] top-[31%] z-[9] h-[32%] w-[18%] rotate-7 rounded-[50%] bg-[#244d31]/8 blur-[20px]" />
      <div className="pointer-events-none absolute bottom-[0%] left-[22%] z-[9] h-[13%] w-[56%] rounded-[50%] bg-[#244d31]/7 blur-[22px]" />
      <div className="pointer-events-none absolute left-[26%] top-[11%] z-[9] h-[8%] w-[48%] rounded-[50%] bg-[#315d3b]/6 blur-[18px]" />

      {/* 전체 종이결 / 회화풍 톤 */}
      <div className="pointer-events-none absolute inset-0 z-[70] opacity-[0.045] mix-blend-multiply [background-image:radial-gradient(circle_at_20%_30%,#5b674d_0_0.7px,transparent_0.9px),radial-gradient(circle_at_70%_40%,#ffffff_0_0.8px,transparent_1px),radial-gradient(circle_at_45%_78%,#6f634c_0_0.6px,transparent_0.9px)] [background-size:11px_13px,17px_15px,23px_19px]" />

      {/* ─────────────────────────
          다른 이용자 캐릭터

          - 일반 이용자: 현재 캐릭터로 표시
          - Focus Mode: status="focusing"을 그대로 전달해
            노트북 포커스 캐릭터로 표시
          - Broadcast x/y를 받아 실제 이동 좌표를 따라간다.
      ───────────────────────── */}

      {remotePlayers.map(
        (
          remotePlayer,
          index,
        ) => {
          const position =
            getRemotePlayerPosition(
              remotePlayer.userId,
              index,
            );

          const remoteFacing:
            HooWorldPlayerFacing =
              remotePlayer.facing ===
                "left" ||
              remotePlayer.facing ===
                "right"
                ? remotePlayer.facing
                : "down";

          return (
            <div
              key={
                remotePlayer.userId
              }
              className="pointer-events-none absolute left-0 top-0 z-20 will-change-transform"
              style={{
                transform: `translate3d(${position.x}vw, ${position.y}vh, 0) translate(-50%, -50%)`,
                transition:
                  remotePlayer.moving
                    ? "transform 80ms linear"
                    : "transform 120ms ease-out",
              }}
            >
              <div
                className="origin-center"
                style={{
                  transform:
                    "scale(0.65)",
                }}
              >
                <HooWorldPlayer
                  nickname={
                    remotePlayer.nickname
                  }
                  status={
                    remotePlayer.status
                  }
                  facing={
                    remoteFacing
                  }
                  characterSlot={
                    remotePlayer.characterSlot ??
                    4
                  }
                  accessoryIds={[]}
                />
              </div>
            </div>
          );
        },
      )}

      {/* ─────────────────────────
          내 캐릭터
      ───────────────────────── */}

      <div
        ref={
          playerElementRef
        }
        className="absolute left-0 top-0 z-30 will-change-transform"
        style={{
          transform:
            "translate3d(50vw, 78vh, 0) translate(-50%, -50%)",
          contain:
            "layout paint style",
        }}
      >
        {!isUserLoading && (
          <div
            className="origin-center"
            style={{
              transform:
                "scale(0.65)",
            }}
          >
            <div
              ref={
                playerMotionRef
              }
            >
              <HooWorldPlayer
                nickname={
                  nickname ??
                  "HOO"
                }
                status={
                  status
                }
                facing={
                  playerFacing
                }
                characterSlot={
                  selectedAccessoryId
                    ? Number(
                        selectedAccessoryId,
                      )
                    : 4
                }
                accessoryIds={[]}
              />
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────
          기존 기능 UI 유지
      ───────────────────────── */}

            <header className="absolute inset-x-0 top-0 z-50 flex items-start justify-between gap-3 p-4 sm:p-6">
        <div className="flex items-start gap-2">
          <Link
            href="/"
            className="flex h-12 items-center rounded-2xl border border-white/45 bg-black/60 px-4 text-sm font-black text-white shadow-lg backdrop-blur-xl transition hover:bg-black/75"
          >
            ← HOO
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsAccessorySettingsOpen(
                  (current) =>
                    !current,
                );
              }}
              className="flex h-12 items-center gap-2 rounded-2xl border border-white/40 bg-white/80 px-4 text-sm font-black text-[#423e34] shadow-lg backdrop-blur-xl transition hover:bg-white"
              aria-expanded={
                isAccessorySettingsOpen
              }
              aria-label="HOO WORLD 이미지 설정"
            >
              <span aria-hidden="true">
                ⚙️
              </span>
              <span>설정</span>
            </button>

            
{isAccessorySettingsOpen && (
  <div className="absolute left-0 top-[58px] w-[248px] rounded-[22px] border border-white/45 bg-[#172018]/92 p-3 text-white shadow-2xl backdrop-blur-xl">
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <div>
        <p className="text-[10px] font-black tracking-[0.18em] text-white/45">
          HOO IMAGE
        </p>

        <p className="mt-0.5 text-xs font-black">
          이미지 교체
        </p>
      </div>

      <span className="text-[10px] font-bold text-white/40">
        1 ~ 10
      </span>
    </div>

    <div className="grid grid-cols-5 gap-2">
      {Array.from(
        {
          length:
            HOO_WORLD_ACCESSORY_SLOT_COUNT,
        },
        (
          _,
          index,
        ) => {
          const slotNumber =
            index + 1;

          const accessoryId =
            getAccessorySlotId(
              slotNumber,
            );

          const isSelected =
            selectedAccessoryId ===
            accessoryId;

          const characterImagePath =
            slotNumber <= 7
              ? `/hoo-world/characters/user-${slotNumber}.png`
              : null;

          return (
            <button
              key={slotNumber}
              type="button"
              onClick={() => {
                if (!characterImagePath) {
                  return;
                }

                void saveAccessorySlot(
                  accessoryId,
                );
              }}
              disabled={
                !characterImagePath
              }
              className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl border font-black transition ${
                isSelected
                  ? "border-white bg-white text-[#243025] shadow-md"
                  : characterImagePath
                    ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                    : "cursor-default border-white/10 bg-white/5 text-white/30"
              }`}
            >
              {characterImagePath ? (
                <>
                  <img
                    src={
                      characterImagePath
                    }
                    alt={`캐릭터 ${slotNumber}`}
                    draggable={false}
                    className="h-[36px] w-[42px] max-w-none object-contain"
                  />

                  <span className="absolute bottom-[2px] right-[4px] text-[9px] font-black">
                    {slotNumber}
                  </span>
                </>
              ) : (
                <span className="text-sm">
                  {slotNumber}
                </span>
              )}
            </button>
          );
        },
      )}
    </div>

    <button
      type="button"
      onClick={() => {
        void saveAccessorySlot(
          "4",
        );
      }}
      className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-white/65 transition hover:bg-white/10 hover:text-white"
    >
      기본 캐릭터로 변경하기
    </button>

    <p className="mt-3 px-1 text-[10px] font-bold leading-4 text-white/45">
      user-1.png ~ user-7.png가 각 번호에
      직접 연결됩니다.
    </p>
  </div>
)}

          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <div className="rounded-2xl border border-white/40 bg-white/80 px-4 py-2.5 shadow-lg backdrop-blur-xl">
            <p className="text-[9px] font-black tracking-[0.16em] text-[#887f6a]">
              HOO COIN
            </p>

            <p className="mt-0.5 text-sm font-black text-[#423e34]">
              🪙{" "}
              {hooCoinBalance.toLocaleString(
                "ko-KR",
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/25 bg-black/65 px-4 py-2.5 text-white shadow-lg backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isConnected
                    ? "bg-emerald-400"
                    : "bg-amber-400"
                }`}
              />

              <div>
                <p className="text-[9px] font-black tracking-[0.16em] text-white/45">
                  HOO WORLD
                </p>

                <p className="mt-0.5 text-sm font-black">
                  {isConnected
                    ? `온라인 ${onlineCount}명`
                    : "접속 중..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

            <button
        type="button"
        onClick={() => {
          void enterFocusModeFromHooWorld();
        }}
        disabled={isEnteringFocusMode}
        className="fixed bottom-5 right-5 z-[100] flex h-12 items-center gap-2 rounded-2xl border border-white/35 bg-[#1d2f24] px-5 text-sm font-black text-white shadow-[0_8px_24px_rgba(20,35,24,0.38)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-[#294132] disabled:cursor-wait disabled:opacity-60 sm:bottom-6 sm:right-6"
        aria-label="포커스모드 시작"
      >
        <span
          aria-hidden="true"
          className="text-base"
        >
          💻
        </span>

        <span>
          {isEnteringFocusMode
            ? "연결 중..."
            : "포커스모드"}
        </span>
      </button>

      <div className="absolute bottom-4 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/35 bg-black/55 px-5 py-2.5 text-[11px] font-black text-white shadow-lg backdrop-blur-xl sm:text-xs">
        {status ===
        "focusing"
          ? "💻 포커스모드 집중 중"
          : "🌿 HOO 공동 필드"}
      </div>
    </main>
  );
}

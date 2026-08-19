"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  onExit: () => void;
  onRecordSaved?: () => void;
};
type Key = "left" | "right" | "up" | "down" | "fire";
type Body = { x: number; y: number; vx: number; vy: number; w: number; h: number };
type Enemy = Body & {
  id: number;
  dir: number;
  trapped: number;
  dead: boolean;
  variant: 0 | 1 | 2;
  trapImmunity: number;
};
type Bubble = Body & { id: number; life: number; enemyId?: number };
type BossBubble = Body & {
  id: number;
  life: number;
  kind: "capture" | "damage";
  ownerId: number;
};
type Coin = Body & { id: number; life: number };
type BossExplosion = {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  kind: "mid" | "high";
};
type MidBoss = Body & {
  id: number;
  hp: number;
  maxHp: number;
  dir: number;
  shootAt: number;
  mouthOpen: boolean;
};
type HighBoss = MidBoss;
type SavedGame = {
  version: 1;
  worldWidth?: number;
  stage: number;
  score: number;
  life: number;
  coinProgress: number;
  waveRemainingMs: number;
  midSpawned: number;
  highSpawned: number;
  player: Body & { grounded: boolean; face: number; dropThrough: number };
  enemies: Enemy[];
  midBosses: MidBoss[];
  highBosses: HighBoss[];
  coins: Coin[];
};
type Platform = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: "platform" | "slide";
  endY?: number;
};

// 월드를 넓혀 같은 화면 안에 더 많은 지형이 보이도록 줌아웃한다.
const W = 1920;
const H = 1080;
const WORLD_W = 3800;
const WORLD_OFFSET_X = (WORLD_W - W) / 2;
const SAVE_KEY = "hoo-bubble-wave-save-v1";

type StageConfig = {
  minutes: number;
  midTotal: number;
  highTotal: number;
  midSimultaneous: number;
  highSimultaneous: number;
  normalMonsters: boolean;
};

const STAGE_CONFIGS: StageConfig[] = [
  { minutes: 2, midTotal: 1, highTotal: 0, midSimultaneous: 1, highSimultaneous: 0, normalMonsters: true },
  { minutes: 3, midTotal: 2, highTotal: 0, midSimultaneous: 1, highSimultaneous: 0, normalMonsters: true },
  { minutes: 5, midTotal: 3, highTotal: 1, midSimultaneous: 1, highSimultaneous: 1, normalMonsters: true },
  { minutes: 7, midTotal: 5, highTotal: 3, midSimultaneous: 2, highSimultaneous: 1, normalMonsters: true },
  { minutes: 10, midTotal: 10, highTotal: 5, midSimultaneous: 3, highSimultaneous: 2, normalMonsters: true },
  { minutes: 12, midTotal: 15, highTotal: 7, midSimultaneous: 4, highSimultaneous: 3, normalMonsters: true },
  { minutes: 15, midTotal: 20, highTotal: 10, midSimultaneous: 6, highSimultaneous: 4, normalMonsters: true },
  { minutes: 20, midTotal: 25, highTotal: 10, midSimultaneous: 10, highSimultaneous: 10, normalMonsters: true },
  { minutes: 30, midTotal: 30, highTotal: 15, midSimultaneous: 20, highSimultaneous: 10, normalMonsters: true },
  { minutes: 60, midTotal: 50, highTotal: 30, midSimultaneous: 50, highSimultaneous: 30, normalMonsters: true },
];

const getStageConfig = (stage: number) =>
  STAGE_CONFIGS[Math.min(STAGE_CONFIGS.length - 1, Math.max(0, stage - 1))];

const formatCountdown = (milliseconds: number) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};
const keys: Record<Key, boolean> = {
  left: false, right: false, up: false, down: false, fire: false,
};

const MAP_THEMES = [
  { sky: "#101b24", horizon: "#172d35", platform: "#38575a", edge: "#92d2c5", accent: "#f0d27a" },
  { sky: "#181326", horizon: "#2b2040", platform: "#51466d", edge: "#c6a9ef", accent: "#e9b8d1" },
  { sky: "#171c17", horizon: "#263529", platform: "#486248", edge: "#abd68e", accent: "#f1d781" },
  { sky: "#20151a", horizon: "#3b2228", platform: "#67434b", edge: "#e0a493", accent: "#ffd38e" },
  { sky: "#111b2b", horizon: "#1d3350", platform: "#354f6b", edge: "#8ec5eb", accent: "#f0c980" },
] as const;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const hit = (a: Body, b: Body) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function stagePlatforms(stage: number): Platform[] {
  const floor = { x: 0, y: H - 42, w: WORLD_W, h: 42 };
  const patterns: Platform[][] = [
    // 1. 1층과 2층을 긴 미끄럼틀로 연결한 놀이터
    [
      { x: 70, y: 735, w: 520, h: 20 },
      { x: 590, y: 735, w: 250, h: 20, kind: "slide", endY: 835 },
      { x: 920, y: 690, w: 570, h: 20 },
      { x: 975, y: 575, w: 330, h: 20 },
      { x: 645, y: 620, w: 330, h: 20, kind: "slide", endY: 720 },
      { x: 185, y: 530, w: 460, h: 20 },
      { x: 185, y: 415, w: 280, h: 20 },
      { x: 465, y: 415, w: 300, h: 20, kind: "slide", endY: 515 },
      { x: 835, y: 360, w: 500, h: 20 },
      { x: 1040, y: 245, w: 300, h: 20 },
    ],
    // 2. 가운데가 뚫린 2층 건물과 양쪽 비상 미끄럼틀
    [
      { x: 60, y: 735, w: 610, h: 20 },
      { x: 930, y: 735, w: 610, h: 20 },
      { x: 230, y: 620, w: 420, h: 20 },
      { x: 950, y: 620, w: 420, h: 20 },
      { x: 620, y: 620, w: 180, h: 20, kind: "slide", endY: 720 },
      { x: 800, y: 720, w: 180, h: 20, kind: "slide", endY: 620 },
      { x: 55, y: 505, w: 570, h: 20 },
      { x: 975, y: 505, w: 570, h: 20 },
      { x: 430, y: 390, w: 740, h: 20 },
      { x: 170, y: 275, w: 360, h: 20 },
      { x: 1070, y: 275, w: 360, h: 20 },
      { x: 620, y: 160, w: 360, h: 20 },
    ],
    // 3. 짧은 섬과 굽이치는 미끄럼틀이 이어진 놀이공원
    [
      { x: 40, y: 750, w: 260, h: 20 },
      { x: 370, y: 705, w: 250, h: 20 },
      { x: 700, y: 750, w: 240, h: 20 },
      { x: 1010, y: 690, w: 220, h: 20 },
      { x: 1230, y: 690, w: 260, h: 20, kind: "slide", endY: 820 },
      { x: 1080, y: 575, w: 330, h: 20 },
      { x: 755, y: 575, w: 325, h: 20, kind: "slide", endY: 680 },
      { x: 420, y: 530, w: 335, h: 20 },
      { x: 100, y: 475, w: 260, h: 20 },
      { x: 360, y: 475, w: 240, h: 20, kind: "slide", endY: 580 },
      { x: 705, y: 360, w: 420, h: 20 },
      { x: 1125, y: 360, w: 230, h: 20, kind: "slide", endY: 465 },
      { x: 330, y: 245, w: 375, h: 20 },
      { x: 80, y: 130, w: 250, h: 20 },
    ],
    // 4. 양쪽 고층 건물과 중앙 협곡 다리
    [
      { x: 0, y: 745, w: 470, h: 20 },
      { x: 1130, y: 745, w: 470, h: 20 },
      { x: 125, y: 630, w: 390, h: 20 },
      { x: 1085, y: 630, w: 390, h: 20 },
      { x: 470, y: 630, w: 260, h: 20, kind: "slide", endY: 735 },
      { x: 870, y: 735, w: 260, h: 20, kind: "slide", endY: 630 },
      { x: 0, y: 515, w: 440, h: 20 },
      { x: 1160, y: 515, w: 440, h: 20 },
      { x: 330, y: 400, w: 940, h: 20 },
      { x: 120, y: 285, w: 360, h: 20 },
      { x: 1120, y: 285, w: 360, h: 20 },
      { x: 510, y: 170, w: 580, h: 20 },
    ],
    // 5. 여러 층을 크게 휘어 내려오는 지그재그 미끄럼틀
    [
      { x: 70, y: 750, w: 620, h: 20 },
      { x: 690, y: 750, w: 270, h: 20, kind: "slide", endY: 835 },
      { x: 1030, y: 700, w: 500, h: 20 },
      { x: 770, y: 585, w: 560, h: 20 },
      { x: 530, y: 585, w: 240, h: 20, kind: "slide", endY: 690 },
      { x: 80, y: 530, w: 450, h: 20 },
      { x: 320, y: 415, w: 650, h: 20 },
      { x: 970, y: 415, w: 260, h: 20, kind: "slide", endY: 520 },
      { x: 1230, y: 520, w: 270, h: 20 },
      { x: 810, y: 300, w: 510, h: 20 },
      { x: 540, y: 300, w: 270, h: 20, kind: "slide", endY: 405 },
      { x: 130, y: 245, w: 410, h: 20 },
      { x: 445, y: 130, w: 470, h: 20 },
    ],
  ];

  const lowerField: Platform[] = [
    { x: 55, y: H - 175, w: 455, h: 20 },
    { x: 510, y: H - 175, w: 265, h: 20, kind: "slide", endY: H - 72 },
    { x: 820, y: H - 235, w: 470, h: 20 },
    { x: 1325, y: H - 160, w: 520, h: 20 },
    { x: 1540, y: 735, w: 300, h: 20 },
    { x: 1640, y: 520, w: 235, h: 20 },
    { x: 1450, y: 330, w: 310, h: 20 },
  ];
  const selected = patterns[(stage - 1) % patterns.length].map((platform) => {
    if (stage !== 1 || platform.y >= 600) return platform;
    return {
      ...platform,
      y: platform.y + 70,
      endY: typeof platform.endY === "number" ? platform.endY + 70 : undefined,
    };
  });
  const centralField = [...lowerField, ...selected].map((platform) => ({
    ...platform,
    x: platform.x + WORLD_OFFSET_X,
  }));

  // 화면 밖 좌우 구역. 바닥으로도 이동할 수 있고 발판과 미끄럼틀로
  // 중앙 구역에 다시 합류할 수 있는 별도의 탐험 공간이다.
  const outerField: Platform[] = [
    { x: 40, y: 850, w: 390, h: 20 },
    { x: 430, y: 850, w: 210, h: 20, kind: "slide", endY: 735 },
    { x: 610, y: 735, w: 330, h: 20 },
    { x: 85, y: 650, w: 360, h: 20 },
    { x: 445, y: 650, w: 195, h: 20, kind: "slide", endY: 545 },
    { x: 630, y: 545, w: 310, h: 20 },
    { x: 45, y: 430, w: 390, h: 20 },
    { x: 435, y: 430, w: 225, h: 20, kind: "slide", endY: 330 },
    { x: 660, y: 330, w: 280, h: 20 },
    { x: 330, y: 255, w: 310, h: 20 },
    { x: 65, y: 145, w: 320, h: 20 },
    { x: 700, y: 145, w: 240, h: 20 },

    { x: WORLD_W - 940, y: 735, w: 330, h: 20 },
    { x: WORLD_W - 640, y: 735, w: 210, h: 20, kind: "slide", endY: 850 },
    { x: WORLD_W - 430, y: 850, w: 390, h: 20 },
    { x: WORLD_W - 940, y: 545, w: 310, h: 20 },
    { x: WORLD_W - 640, y: 545, w: 195, h: 20, kind: "slide", endY: 650 },
    { x: WORLD_W - 445, y: 650, w: 360, h: 20 },
    { x: WORLD_W - 940, y: 330, w: 280, h: 20 },
    { x: WORLD_W - 660, y: 330, w: 225, h: 20, kind: "slide", endY: 430 },
    { x: WORLD_W - 435, y: 430, w: 390, h: 20 },
    { x: WORLD_W - 640, y: 255, w: 310, h: 20 },
    { x: WORLD_W - 385, y: 145, w: 320, h: 20 },
    { x: WORLD_W - 940, y: 145, w: 240, h: 20 },
  ];

  return [floor, ...outerField, ...centralField];
}

function drawLizard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  face: number,
  walk: number,
  shooting: boolean,
) {
  ctx.save();
  ctx.translate(x + 40, y + 50);
  ctx.scale(face * 0.8, 0.8);
  ctx.imageSmoothingEnabled = false;
  const step = walk > 0.5 ? 4 : -2;

  // 식빵 몸 뒤에서 살짝 삐져나온 꼬리
  ctx.fillStyle = "#6eaa4b";
  ctx.fillRect(-51, 7, 23, 11);
  ctx.fillRect(-60, 11, 13, 7);

  // 바닥에 납작하게 엎드린 통통한 식빵 몸체
  ctx.fillStyle = "#7fc956";
  ctx.fillRect(-47, -14, 96, 42);
  ctx.fillRect(-41, -25, 84, 58);
  ctx.fillRect(-34, -35, 70, 69);
  ctx.fillRect(-42, 28, 84, 10);
  ctx.fillStyle = "#a3df6d";
  ctx.fillRect(-35, -28, 58, 6);
  ctx.fillRect(-41, -14, 7, 28);

  // 식빵 위로 솟은 후드의 양 귀
  ctx.fillStyle = "#7fc956";
  ctx.fillRect(-32, -48, 14, 17);
  ctx.fillRect(-27, -57, 9, 12);
  ctx.fillRect(19, -48, 14, 17);
  ctx.fillRect(19, -57, 9, 12);

  // 노란 얼굴 창
  ctx.fillStyle = "#fff2a1";
  ctx.fillRect(-28, -30, 57, 37);
  ctx.fillRect(-22, -36, 45, 48);

  // 양쪽 볼 홍조
  ctx.fillStyle = "#f19282";
  ctx.fillRect(-25, -7, 11, 10);
  ctx.fillRect(16, -7, 10, 10);

  if (shooting) {
    // 발사 순간 이마 위로 들린 선글라스
    ctx.fillStyle = "#11130f";
    ctx.fillRect(-25, -45, 21, 10);
    ctx.fillRect(7, -45, 21, 10);
    ctx.fillRect(-5, -42, 13, 5);
    ctx.fillStyle = "#4e5b45";
    ctx.fillRect(-21, -42, 13, 3);
    ctx.fillRect(11, -42, 13, 3);

    // 하찮게 콩알 두 개만 톡톡 박힌 눈
    ctx.fillStyle = "#252820";
    ctx.fillRect(-13, -22, 5, 6);
    ctx.fillRect(10, -22, 5, 6);

    // 버블을 뱉는 조그만 동그란 입
    ctx.fillRect(20, -13, 7, 7);
    ctx.fillStyle = "#f7f4d6";
    ctx.fillRect(22, -11, 3, 3);
    ctx.strokeStyle = "rgba(225,245,235,.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(36, -9, 7, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // 평소에는 얼굴을 가리는 시크한 선글라스
    ctx.fillStyle = "#0d0f0c";
    ctx.fillRect(-27, -27, 23, 15);
    ctx.fillRect(7, -27, 23, 15);
    ctx.fillRect(-5, -23, 13, 6);
    ctx.fillStyle = "#333a30";
    ctx.fillRect(-23, -24, 14, 4);
    ctx.fillRect(11, -24, 14, 4);
  }

  // 귀 옆 파란 리본
  ctx.fillStyle = "#426fe0";
  ctx.fillRect(15, -49, 7, 12);
  ctx.fillRect(28, -49, 7, 12);
  ctx.fillRect(21, -46, 8, 7);

  // 앞발 대신 후드 목에서 내려오는 검은 끈
  ctx.fillStyle = "#151713";
  ctx.fillRect(-11, 12, 4, 13);
  ctx.fillRect(8, 12, 4, 13);

  // 가운데에서 묶은 검은 픽셀 리본
  ctx.fillRect(-5, 22, 11, 8);
  ctx.fillRect(-16, 20, 11, 9);
  ctx.fillRect(6, 20, 11, 9);
  ctx.fillRect(-19, 23, 6, 8);
  ctx.fillRect(14, 23, 6, 8);

  // 리본 아래로 짧게 떨어지는 끈 끝
  ctx.fillRect(-5, 29, 4, 8);
  ctx.fillRect(3, 29, 4, 8);

  // 이동할 때에만 몸 뒤로 살짝 보이는 작은 뒷발
  ctx.fillStyle = "#5f9c40";
  ctx.fillRect(-36, 34, 17 + step, 7);
  ctx.fillRect(20 - step, 34, 17 + step, 7);
  ctx.restore();
}

function drawMonster(ctx: CanvasRenderingContext2D, enemy: Enemy) {
  const { x, y, variant } = enemy;
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  if (variant === 0) {
    // 크림색 양갈래 머리와 청록색 눈의 명랑한 몬스터
    ctx.fillStyle = "#f4dfb2";
    ctx.fillRect(x + 9, y + 9, 58, 50);
    ctx.fillRect(x + 3, y + 15, 18, 25);
    ctx.fillRect(x + 55, y + 15, 18, 25);
    ctx.fillRect(x + 8, y + 3, 18, 17);
    ctx.fillRect(x + 50, y + 3, 18, 17);
    ctx.fillStyle = "#fff4dc";
    ctx.fillRect(x + 15, y + 28, 46, 35);
    ctx.fillStyle = "#54b6a7";
    ctx.fillRect(x + 20, y + 38, 11, 13);
    ctx.fillRect(x + 46, y + 38, 11, 13);
    ctx.fillStyle = "#18201e";
    ctx.fillRect(x + 24, y + 40, 5, 8);
    ctx.fillRect(x + 48, y + 40, 5, 8);
    ctx.fillStyle = "#f1a093";
    ctx.fillRect(x + 13, y + 51, 10, 7);
    ctx.fillRect(x + 55, y + 51, 10, 7);
    ctx.fillStyle = "#482c2b";
    ctx.fillRect(x + 32, y + 53, 14, 5);
    ctx.fillStyle = "#26394b";
    ctx.fillRect(x + 17, y + 63, 44, 10);
  } else if (variant === 1) {
    // 비대칭으로 뒤틀린 창백한 괴물 몸체
    ctx.fillStyle = "#d8d8c9";
    ctx.fillRect(x + 12, y + 11, 53, 49);
    ctx.fillRect(x + 6, y + 23, 62, 30);
    ctx.fillRect(x + 19, y + 5, 34, 61);
    ctx.fillRect(x + 54, y + 17, 17, 25);

    // 서로 크기가 다른 뿔과 혹
    ctx.fillStyle = "#b8b9aa";
    ctx.fillRect(x + 14, y + 2, 9, 18);
    ctx.fillRect(x + 20, y, 7, 9);
    ctx.fillRect(x + 49, y + 4, 15, 10);
    ctx.fillRect(x + 59, y + 1, 7, 8);
    ctx.fillRect(x + 4, y + 31, 11, 13);

    // 큰 눈 하나, 작은 눈 둘
    ctx.fillStyle = "#f5f1dc";
    ctx.fillRect(x + 17, y + 20, 22, 20);
    ctx.fillStyle = "#151713";
    ctx.fillRect(x + 24, y + 25, 10, 12);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 26, y + 26, 4, 4);
    ctx.fillStyle = "#151713";
    ctx.fillRect(x + 48, y + 22, 7, 8);
    ctx.fillRect(x + 57, y + 34, 5, 6);

    // 찢어진 입과 들쭉날쭉한 이빨
    ctx.fillStyle = "#321c1c";
    ctx.fillRect(x + 20, y + 45, 35, 15);
    ctx.fillRect(x + 27, y + 41, 26, 7);
    ctx.fillStyle = "#f2edcf";
    ctx.fillRect(x + 24, y + 45, 6, 7);
    ctx.fillRect(x + 35, y + 45, 6, 10);
    ctx.fillRect(x + 47, y + 45, 5, 7);
    ctx.fillStyle = "#a15f65";
    ctx.fillRect(x + 31, y + 56, 16, 5);

    // 길이가 서로 다른 흐느적거리는 팔
    ctx.fillStyle = "#c5c6b7";
    ctx.fillRect(x, y + 43, 17, 8);
    ctx.fillRect(x + 1, y + 50, 8, 18);
    ctx.fillRect(x + 63, y + 47, 13, 8);
    ctx.fillRect(x + 69, y + 53, 7, 10);
    ctx.fillStyle = "#151713";
    ctx.fillRect(x, y + 65, 11, 5);
    ctx.fillRect(x + 66, y + 62, 10, 5);

    // 비틀린 짧은 다리
    ctx.fillStyle = "#b7b8a9";
    ctx.fillRect(x + 17, y + 61, 14, 10);
    ctx.fillRect(x + 48, y + 59, 11, 13);
    ctx.fillStyle = "#151713";
    ctx.fillRect(x + 11, y + 69, 21, 6);
    ctx.fillRect(x + 48, y + 70, 18, 5);
  } else {
    // 노란 머리, 눈물, 분홍 리본의 울상 몬스터
    ctx.fillStyle = "#f5ca55";

    // 머리 양쪽에 붙은 커다란 왕만두 두 개
    ctx.fillRect(x + 1, y + 5, 23, 31);
    ctx.fillRect(x + 5, y + 1, 15, 39);
    ctx.fillRect(x + 52, y + 5, 23, 31);
    ctx.fillRect(x + 56, y + 1, 15, 39);
    ctx.fillStyle = "#ffe184";
    ctx.fillRect(x + 5, y + 7, 15, 6);
    ctx.fillRect(x + 56, y + 7, 15, 6);
    ctx.fillStyle = "#d9a936";
    ctx.fillRect(x + 8, y + 14, 3, 14);
    ctx.fillRect(x + 14, y + 12, 3, 18);
    ctx.fillRect(x + 59, y + 12, 3, 18);
    ctx.fillRect(x + 65, y + 14, 3, 14);

    ctx.fillStyle = "#f5ca55";
    ctx.fillRect(x + 9, y + 11, 58, 50);
    ctx.fillRect(x + 4, y + 21, 17, 35);
    ctx.fillRect(x + 55, y + 21, 17, 35);
    ctx.fillRect(x + 21, y + 4, 34, 17);
    ctx.fillRect(x + 33, y, 12, 12);
    ctx.fillStyle = "#fff1d8";
    ctx.fillRect(x + 16, y + 29, 45, 33);
    ctx.fillStyle = "#24221f";
    ctx.fillRect(x + 20, y + 35, 14, 12);
    ctx.fillRect(x + 44, y + 35, 14, 12);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 23, y + 36, 5, 4);
    ctx.fillRect(x + 47, y + 36, 5, 4);
    ctx.fillStyle = "#b9ecff";
    ctx.fillRect(x + 23, y + 47, 7, 13);
    ctx.fillRect(x + 49, y + 47, 7, 13);
    ctx.fillStyle = "#5b4337";
    ctx.fillRect(x + 32, y + 54, 15, 4);
    ctx.fillRect(x + 29, y + 58, 4, 5);
    ctx.fillRect(x + 46, y + 58, 4, 5);
    ctx.fillStyle = "#e8789b";
    ctx.fillRect(x + 23, y + 64, 14, 10);
    ctx.fillRect(x + 42, y + 64, 14, 10);
    ctx.fillStyle = "#bf4f73";
    ctx.fillRect(x + 36, y + 66, 7, 7);
  }

  ctx.restore();
}

function drawMidBoss(ctx: CanvasRenderingContext2D, boss: MidBoss) {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.scale(2, 2);

  // 중급보스: 커다란 왕만두 머리와 보라색 후드를 쓴 울상 흡입 괴물.
  ctx.fillStyle = "#30123f";
  ctx.fillRect(7, 17, 62, 47);
  ctx.fillRect(12, 9, 52, 58);
  ctx.fillRect(3, 27, 11, 27);
  ctx.fillRect(62, 27, 11, 27);

  // 양옆 왕만두와 주름
  ctx.fillStyle = "#8e4eb5";
  ctx.fillRect(1, 10, 23, 29);
  ctx.fillRect(5, 5, 16, 38);
  ctx.fillRect(52, 10, 23, 29);
  ctx.fillRect(55, 5, 16, 38);
  ctx.fillStyle = "#c47be8";
  ctx.fillRect(7, 9, 10, 5);
  ctx.fillRect(59, 9, 10, 5);
  ctx.fillStyle = "#56246f";
  [8, 14, 58, 64].forEach((x) => ctx.fillRect(x, 16, 3, 17));

  // 창백한 얼굴
  ctx.fillStyle = "#ffe4bd";
  ctx.fillRect(15, 22, 46, 35);
  ctx.fillRect(20, 18, 36, 43);

  // 짙은 눈두덩과 커다란 울상 눈
  ctx.fillStyle = "#241228";
  ctx.fillRect(18, 27, 17, 14);
  ctx.fillRect(43, 27, 17, 14);
  ctx.fillStyle = "#f7f1ff";
  ctx.fillRect(21, 29, 11, 9);
  ctx.fillRect(46, 29, 11, 9);
  ctx.fillStyle = "#4f225f";
  ctx.fillRect(25, 31, 6, 8);
  ctx.fillRect(47, 31, 6, 8);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(26, 31, 3, 3);
  ctx.fillRect(48, 31, 3, 3);

  // 계속 떨어지는 굵은 눈물
  ctx.fillStyle = "#70d9ff";
  ctx.fillRect(21, 39, 8, 16);
  ctx.fillRect(49, 39, 8, 16);
  ctx.fillStyle = "#d9f8ff";
  ctx.fillRect(22, 40, 3, 10);
  ctx.fillRect(50, 40, 3, 10);

  // 흡입할 때 크게 벌어지는 입
  if (boss.mouthOpen) {
    ctx.fillStyle = "#130817";
    ctx.fillRect(25, 45, 28, 24);
    ctx.fillRect(21, 50, 36, 14);
    ctx.fillStyle = "#78306f";
    ctx.fillRect(29, 59, 20, 8);
    ctx.fillStyle = "#fff0d3";
    ctx.fillRect(24, 48, 7, 6);
    ctx.fillRect(47, 48, 7, 6);
    ctx.fillStyle = "#b46dd0";
    ctx.fillRect(35, 45, 7, 4);
  } else {
    ctx.fillStyle = "#442033";
    ctx.fillRect(29, 49, 20, 5);
    ctx.fillRect(25, 53, 5, 5);
    ctx.fillRect(48, 53, 5, 5);
  }

  // 짧고 둔한 발과 흡입 기관
  ctx.fillStyle = "#4b205d";
  ctx.fillRect(9, 57, 18, 13);
  ctx.fillRect(51, 57, 18, 13);
  ctx.fillStyle = "#a866c7";
  ctx.fillRect(6, 66, 23, 7);
  ctx.fillRect(49, 66, 23, 7);
  ctx.fillStyle = "#d48cff";
  ctx.fillRect(2, 43, 8, 6);
  ctx.fillRect(68, 43, 8, 6);
  ctx.restore();
}

function drawHighBoss(ctx: CanvasRenderingContext2D, boss: HighBoss) {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.scale(4, 4);

  // 상급보스: 여러 눈·비대칭 뿔·거대한 턱을 가진 고대 버블 괴수.
  ctx.fillStyle = "#17111f";
  ctx.fillRect(8, 14, 61, 54);
  ctx.fillRect(3, 25, 70, 34);
  ctx.fillRect(15, 7, 48, 65);

  // 비대칭 뿔과 솟은 등껍질
  ctx.fillStyle = "#6d596f";
  ctx.fillRect(7, 3, 9, 21);
  ctx.fillRect(12, 0, 6, 13);
  ctx.fillRect(57, 6, 12, 18);
  ctx.fillRect(65, 1, 7, 13);
  ctx.fillRect(29, 2, 8, 12);
  ctx.fillRect(42, 5, 6, 9);
  ctx.fillStyle = "#9d88a1";
  ctx.fillRect(10, 4, 3, 13);
  ctx.fillRect(62, 7, 4, 11);

  // 일그러진 얼굴 판
  ctx.fillStyle = "#b9b0b6";
  ctx.fillRect(12, 18, 51, 39);
  ctx.fillRect(7, 29, 61, 23);
  ctx.fillStyle = "#d9d1cf";
  ctx.fillRect(18, 14, 32, 47);

  // 크기와 방향이 전부 다른 다섯 개의 눈
  ctx.fillStyle = "#f4f0dc";
  ctx.fillRect(10, 23, 15, 15);
  ctx.fillRect(29, 18, 19, 17);
  ctx.fillRect(52, 24, 11, 13);
  ctx.fillRect(19, 39, 10, 9);
  ctx.fillRect(48, 39, 14, 10);
  ctx.fillStyle = "#23121d";
  ctx.fillRect(15, 27, 7, 9);
  ctx.fillRect(36, 21, 9, 12);
  ctx.fillRect(54, 28, 6, 8);
  ctx.fillRect(21, 41, 5, 6);
  ctx.fillRect(51, 41, 8, 7);
  ctx.fillStyle = "#e95582";
  ctx.fillRect(17, 28, 3, 4);
  ctx.fillRect(39, 22, 4, 5);
  ctx.fillRect(54, 29, 3, 3);

  // 얼굴 절반을 차지하는 찢어진 입과 불규칙한 이빨
  ctx.fillStyle = "#2b0717";
  ctx.fillRect(12, 50, 53, 19);
  ctx.fillRect(18, 46, 41, 27);
  ctx.fillStyle = "#f3e5c4";
  ctx.fillRect(16, 49, 7, 10);
  ctx.fillRect(27, 48, 6, 14);
  ctx.fillRect(39, 50, 8, 9);
  ctx.fillRect(53, 48, 6, 15);
  ctx.fillRect(22, 65, 7, 8);
  ctx.fillRect(35, 62, 6, 11);
  ctx.fillRect(47, 65, 8, 8);
  ctx.fillStyle = "#a62b61";
  ctx.fillRect(28, 62, 23, 8);

  // 양쪽 촉수와 갈고리 손
  ctx.fillStyle = "#6c5e70";
  ctx.fillRect(0, 36, 13, 9);
  ctx.fillRect(1, 43, 7, 21);
  ctx.fillRect(63, 34, 13, 9);
  ctx.fillRect(69, 41, 7, 24);
  ctx.fillStyle = "#d2c8cf";
  ctx.fillRect(0, 61, 12, 7);
  ctx.fillRect(64, 62, 12, 7);
  ctx.fillRect(4, 67, 5, 7);
  ctx.fillRect(67, 68, 5, 7);
  ctx.restore();
}

function drawBossStatusHud(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  midBosses: MidBoss[],
  highBosses: HighBoss[],
) {
  const bosses = [
    ...highBosses.map((boss) => ({
      boss,
      rank: 2,
      name: "상급보스 · 고대 버블 괴수",
      track: "#351019",
      healthy: "#e33e65",
      danger: "#ff8b47",
      border: "#ffd3bc",
      text: "#ffe7dc",
    })),
    ...midBosses.map((boss) => ({
      boss,
      rank: 1,
      name: "울보스",
      track: "#32153f",
      healthy: "#ad52df",
      danger: "#ef668d",
      border: "#f0d9ff",
      text: "#f6eaff",
    })),
  ]
    .sort((a, b) => {
      if (a.rank !== b.rank) return b.rank - a.rank;
      return a.boss.hp / a.boss.maxHp - b.boss.hp / b.boss.maxHp;
    })
    .slice(0, 5);

  if (bosses.length === 0) return;

  const centerX = canvasWidth / 2;
  const barWidth = Math.min(440, Math.max(280, canvasWidth * 0.3));
  const barHeight = 12;
  const firstY = 118;
  const rowHeight = 54;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  bosses.forEach((entry, index) => {
    const ratio = clamp(entry.boss.hp / entry.boss.maxHp, 0, 1);
    const nameY = firstY + index * rowHeight;
    const barX = centerX - barWidth / 2;
    const healthY = nameY + 16;
    const barY = nameY + 23;

    ctx.font = "900 15px monospace";
    ctx.fillStyle = entry.text;
    ctx.shadowColor = "rgba(0,0,0,.95)";
    ctx.shadowBlur = 6;
    ctx.fillText(entry.name, centerX, nameY);

    // 체력 수치는 이름과 분리해 체력바 바로 위에 표시한다.
    ctx.font = "900 12px monospace";
    ctx.fillText(
      `${Math.max(0, Math.ceil(entry.boss.hp))} / ${entry.boss.maxHp}`,
      centerX,
      healthY,
    );

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,.86)";
    ctx.fillRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8);
    ctx.fillStyle = entry.track;
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = ratio > 0.3 ? entry.healthy : entry.danger;
    ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
    ctx.strokeStyle = entry.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = "rgba(255,255,255,.38)";
    ctx.fillRect(barX + 2, barY + 2, Math.max(0, barWidth * ratio - 4), 2);
  });

  ctx.restore();
}

const BUBBLE_RANKING_SCORE_KEY = "hoo-bubble-ranking-score";

function getBubbleStageRankingPoints(stage: number) {
  const normalizedStage = Math.max(
    1,
    Math.min(10, Math.floor(stage)),
  );

  return 30 * normalizedStage;
}
export default function HooBubbleGame({ onExit, onRecordSaved }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const firePressRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const onRecordSavedRef = useRef(onRecordSaved);
  const dashInputRef = useRef<{
    lastLeftAt: number;
    lastRightAt: number;
    direction: -1 | 0 | 1;
    dashStartedAt: number;
    jumpAfterDashAt: number;
    comboDirection: -1 | 0 | 1;
    highJumpRequested: boolean;
  }>({
    lastLeftAt: 0,
    lastRightAt: 0,
    direction: 0,
    dashStartedAt: 0,
    jumpAfterDashAt: 0,
    comboDirection: 0,
    highJumpRequested: false,
  });
  const [mounted, setMounted] = useState(false);
  const [started, setStarted] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [hud, setHud] = useState({ score: 0, stage: 1, life: 3 });

  const getGameAudioContext = () => {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextConstructor) return null;
    if (
      !audioContextRef.current ||
      audioContextRef.current.state === "closed"
    ) {
      audioContextRef.current = new AudioContextConstructor();
    }
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  useEffect(() => {
    onRecordSavedRef.current = onRecordSaved;
  }, [onRecordSaved]);

  useEffect(() => {
    setMounted(true);
    setHasSave(Boolean(window.localStorage.getItem(SAVE_KEY)));
  }, []);

  useEffect(() => {
    if (!started) return;
    dashInputRef.current = {
      lastLeftAt: 0,
      lastRightAt: 0,
      direction: 0,
      dashStartedAt: 0,
      jumpAfterDashAt: 0,
      comboDirection: 0,
      highJumpRequested: false,
    };
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let mobileRenderScale = 1;
    const updateMobileRenderScale = () => {
      mobileRenderScale = window.matchMedia(
        "(max-width: 1024px) and (orientation: portrait)",
      ).matches
        ? 0.82
        : 1;
    };
    updateMobileRenderScale();
    window.addEventListener("resize", updateMobileRenderScale);
    window.addEventListener("orientationchange", updateMobileRenderScale);

    let saved: SavedGame | null = null;
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      saved = raw ? JSON.parse(raw) as SavedGame : null;
      if (saved?.version !== 1) saved = null;
    } catch {
      saved = null;
    }

    let stage = saved?.stage ?? 1;
    let score = saved?.score ?? 0;
    let life = saved?.life ?? 3;
    let last = performance.now(), fireAt = 0, invincible = 0;
    let highJumpEffect = 0;
    let lastDashTrailAt = 0;
    let dashTrailPoints: Array<{
      x: number;
      y: number;
      face: number;
      life: number;
    }> = [];
    let gameOver = false;

    const playTone = (
      startAt: number,
      duration: number,
      fromFrequency: number,
      toFrequency: number,
      volume: number,
      type: OscillatorType = "sine",
    ) => {
      const audio = getGameAudioContext();
      if (!audio) return;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(fromFrequency, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, toFrequency),
        startAt + duration,
      );
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.02);
    };

    const playNoiseBurst = (
      startAt: number,
      duration: number,
      volume: number,
      filterFrequency: number,
    ) => {
      const audio = getGameAudioContext();
      if (!audio) return;
      const frameCount = Math.max(1, Math.floor(audio.sampleRate * duration));
      const buffer = audio.createBuffer(1, frameCount, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < frameCount; index += 1) {
        const fade = 1 - index / frameCount;
        data[index] = (Math.random() * 2 - 1) * fade * fade;
      }
      const source = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(filterFrequency, startAt);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(80, filterFrequency * 0.28),
        startAt + duration,
      );
      gain.gain.setValueAtTime(volume, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      source.connect(filter).connect(gain).connect(audio.destination);
      source.start(startAt);
    };

    const playBubbleShootSound = () => {
      const audio = getGameAudioContext();
      if (!audio) return;
      const at = audio.currentTime;
      // 물방울이 통통 튀어나오는 두 겹의 "뽀용" 음색.
      playTone(at, 0.13, 230, 610, 0.085, "sine");
      playTone(at + 0.045, 0.15, 720, 310, 0.055, "triangle");
    };

    const playBubblePopSound = () => {
      const audio = getGameAudioContext();
      if (!audio) return;
      const at = audio.currentTime;
      playTone(at, 0.085, 760, 135, 0.12, "sine");
      playNoiseBurst(at, 0.075, 0.055, 2400);
    };

    const playPlayerHurtSound = () => {
      const audio = getGameAudioContext();
      if (!audio) return;
      const at = audio.currentTime;
      // 짧은 2음절 상승음으로 귀여운 "아-야!" 느낌을 만든다.
      playTone(at, 0.09, 520, 820, 0.105, "triangle");
      playTone(at + 0.095, 0.13, 650, 1080, 0.125, "triangle");
      playTone(at + 0.1, 0.11, 980, 720, 0.035, "sine");
    };

    const playBossDefeatSound = (kind: "mid" | "high") => {
      const audio = getGameAudioContext();
      if (!audio) return;
      const at = audio.currentTime;
      const bursts = kind === "high" ? 4 : 2;
      for (let index = 0; index < bursts; index += 1) {
        const burstAt = at + index * 0.115;
        playNoiseBurst(
          burstAt,
          kind === "high" ? 0.48 : 0.32,
          kind === "high" ? 0.17 : 0.12,
          1100 - index * 120,
        );
        playTone(
          burstAt,
          kind === "high" ? 0.42 : 0.28,
          150 - index * 12,
          34,
          kind === "high" ? 0.13 : 0.09,
          "sawtooth",
        );
      }
      // 폭발 뒤 보스의 형체가 빨려 사라지는 하강 소멸음.
      playTone(
        at + bursts * 0.1,
        kind === "high" ? 0.78 : 0.5,
        kind === "high" ? 920 : 680,
        46,
        kind === "high" ? 0.11 : 0.075,
        "sine",
      );
    };
    let player: Body & { grounded: boolean; face: number; dropThrough: number } = {
      x: 80, y: H - 128, vx: 0, vy: 0, w: 80, h: 86, grounded: false, face: 1, dropThrough: 0,
    };
    if (saved?.player) player = saved.player;
    let platforms = stagePlatforms(stage);
    let bubbles: Bubble[] = [];
    let bossBubbles: BossBubble[] = [];
    let coins: Coin[] = [];
    let bossExplosions: BossExplosion[] = [];
    let healingEffect = 0;
    let enemySeq = 0, bubbleSeq = 0, bossSeq = 0;
    let bossBubbleSeq = 0, coinSeq = 0;
    let coinProgress = saved?.coinProgress ?? 0;
    let enemies: Enemy[] = saved?.enemies ?? [];
    let midBosses: MidBoss[] = (saved?.midBosses ?? []).map((boss) => ({ ...boss, mouthOpen: false }));
    let highBosses: HighBoss[] = saved?.highBosses ?? [];
    coins = saved?.coins ?? [];

    // 이전 너비로 저장된 세이브는 늘어난 폭의 절반만큼 이동해
    // 플레이 위치가 확장 월드의 같은 중앙 구역에 유지되도록 한다.
    if (saved && saved.worldWidth !== WORLD_W) {
      const previousWorldWidth = saved.worldWidth ?? W;
      const migrationOffset = (WORLD_W - previousWorldWidth) / 2;
      player.x += migrationOffset;
      enemies.forEach((enemy) => { enemy.x += migrationOffset; });
      midBosses.forEach((boss) => { boss.x += migrationOffset; });
      highBosses.forEach((boss) => { boss.x += migrationOffset; });
      coins.forEach((coin) => { coin.x += migrationOffset; });
    }
    enemySeq = Math.max(0, ...enemies.map((enemy) => enemy.id));
    bossSeq = Math.max(0, ...midBosses.map((boss) => boss.id), ...highBosses.map((boss) => boss.id));
    coinSeq = Math.max(0, ...coins.map((coin) => coin.id));
    let stageConfig = getStageConfig(stage);
    let waveDurationMs = stageConfig.minutes * 60_000;
    let waveRemainingMs = saved?.waveRemainingMs ?? waveDurationMs;
    let midSpawned = saved?.midSpawned ?? midBosses.length;
    let highSpawned = saved?.highSpawned ?? highBosses.length;
    let normalSpawnAccumulator = 0;
    let midSpawnAccumulator = 0;
    let highSpawnAccumulator = 0;
    let saveAccumulator = 0;
    let playerCaptured = false;
    let capturedBossId: number | null = null;
    let capturePressStart = 0;
    let capturePressTarget = 15;

    const makeEnemy = (index = enemySeq): Enemy => ({
      id: ++enemySeq,
      x: 100 + (index * 283 + Math.random() * 170) % (WORLD_W - 210),
      y: 80 + (index % 8) * 105,
      vx: 0, vy: 0, w: 76, h: 76,
      dir: index % 2 ? 1 : -1,
      trapped: 0, dead: false, trapImmunity: 0,
      variant: Math.floor(Math.random() * 3) as 0 | 1 | 2,
    });

    const spawnStage = () => {
      stageConfig = getStageConfig(stage);
      waveDurationMs = stageConfig.minutes * 60_000;
      waveRemainingMs = waveDurationMs;
      midSpawned = 0;
      highSpawned = 0;
      normalSpawnAccumulator = 0;
      midSpawnAccumulator = 0;
      highSpawnAccumulator = 0;
      platforms = stagePlatforms(stage);
      player.x = WORLD_W / 2 - player.w / 2;
      player.y = H - 130; player.vx = 0; player.vy = 0; player.dropThrough = 0;
      bubbles = [];
      bossBubbles = [];
      bossExplosions = [];
      healingEffect = 0;
      midBosses = [];
      highBosses = [];
      enemies = stageConfig.normalMonsters
        ? Array.from({ length: 5 }, (_, index) => makeEnemy(index))
        : [];
      setHud({ score, stage, life });
    };

    // 이전 버전에서 1스테이지가 일반 몬스터 없이 보스로 바로 시작된
    // 저장 데이터도 새 진행 방식에 맞게 한 번만 정상화한다.
    if (saved && stage === 1 && enemies.length === 0) {
      enemies = Array.from({ length: 5 }, (_, index) => makeEnemy(index));
      midBosses = [];
      highBosses = [];
      bossBubbles = [];
      midSpawned = 0;
      highSpawned = 0;
      midSpawnAccumulator = 0;
      highSpawnAccumulator = 0;
    }
    if (!saved) spawnStage();

    const releasePlayer = (burst = false) => {
      const captor = midBosses.find((boss) => boss.id === capturedBossId) ?? null;
      playerCaptured = false;
      capturedBossId = null;
      if (captor) captor.mouthOpen = false;
      bossBubbles = bossBubbles.filter((bubble) => bubble.kind === "damage");
      invincible = 80;
      player.vy = -8;
      player.vx = captor && player.x < captor.x ? -7 : 7;
      if (burst) {
        const cx = player.x + player.w / 2;
        const cy = player.y + player.h / 2;
        for (const enemy of enemies) {
          if (enemy.dead || enemy.trapped > 0 || enemy.trapImmunity > 0) continue;
          if (Math.hypot(enemy.x + enemy.w / 2 - cx, enemy.y + enemy.h / 2 - cy) > 260) continue;
          const bubble: Bubble = {
            id: ++bubbleSeq, x: enemy.x + 2, y: enemy.y + 2,
            vx: 0, vy: -1.2, w: 72, h: 72, life: 300, enemyId: enemy.id,
          };
          enemy.trapped = 300;
          score += 10;
          bubbles.push(bubble);
        }
      }
    };

    const trapEnemiesAroundBoss = (
      centerX: number,
      centerY: number,
      radius: number,
      limit: number,
    ) => {
      const targets = enemies
        .filter((enemy) =>
          !enemy.dead &&
          enemy.trapped <= 0 &&
          enemy.trapImmunity <= 0 &&
          Math.hypot(
            enemy.x + enemy.w / 2 - centerX,
            enemy.y + enemy.h / 2 - centerY,
          ) <= radius
        )
        .sort((left, right) =>
          Math.hypot(left.x + left.w / 2 - centerX, left.y + left.h / 2 - centerY) -
          Math.hypot(right.x + right.w / 2 - centerX, right.y + right.h / 2 - centerY)
        )
        .slice(0, limit);

      for (const enemy of targets) {
        enemy.trapped = 420;
        enemy.vx = 0;
        enemy.vy = -1.2;
        score += 10;
        bubbles.push({
          id: ++bubbleSeq,
          x: enemy.x + 2,
          y: enemy.y + 2,
          vx: 0,
          vy: -1.2,
          w: 72,
          h: 72,
          life: 420,
          enemyId: enemy.id,
        });
      }
    };

    const dropBossCoins = (boss: MidBoss | HighBoss, amount: number) => {
      const centerX = boss.x + boss.w / 2;
      const centerY = boss.y + boss.h / 2;
      for (let index = 0; index < amount; index += 1) {
        const angle = Math.PI * 2 * (index / amount) - Math.PI / 2;
        const speed = 5.5 + (index % 3) * 1.1;
        coins.push({
          id: ++coinSeq,
          x: centerX - 13,
          y: centerY - 13,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4.5,
          w: 26,
          h: 26,
          life: 1100,
        });
      }
    };

    const triggerGameOver = () => {
      life = 0;
      gameOver = true;
      window.localStorage.removeItem(SAVE_KEY);
      setHasSave(false);
      setHud({ score, stage, life: 0 });
      setStarted(false);
    };

    const persistGame = (updateUi = true) => {
      if (gameOver || life <= 0) return;
      const data: SavedGame = {
        version: 1, worldWidth: WORLD_W,
        stage, score, life, coinProgress, waveRemainingMs,
        midSpawned, highSpawned,
        player: { ...player },
        enemies: enemies.map((enemy) => ({ ...enemy })),
        midBosses: midBosses.map((boss) => ({ ...boss, mouthOpen: false })),
        highBosses: highBosses.map((boss) => ({ ...boss })),
        coins: coins.map((coin) => ({ ...coin })),
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (updateUi) setHasSave(true);
    };
    const handleBeforeUnload = () => persistGame(false);
    window.addEventListener("beforeunload", handleBeforeUnload);

    const registerDashPress = (key: "left" | "right") => {
      const now = performance.now();
      const input = dashInputRef.current;
      const pressedDirection = key === "left" ? -1 : 1;
      const previousAt = key === "left" ? input.lastLeftAt : input.lastRightAt;

      if (
        input.comboDirection === -pressedDirection &&
        input.jumpAfterDashAt > 0 &&
        now - input.jumpAfterDashAt <= 420
      ) {
        input.highJumpRequested = true;
        input.jumpAfterDashAt = 0;
        input.comboDirection = 0;
      }

      if (previousAt > 0 && now - previousAt <= 285) {
        input.direction = pressedDirection;
        input.dashStartedAt = now;
      }

      if (key === "left") input.lastLeftAt = now;
      else input.lastRightAt = now;
    };

    const registerDashJump = () => {
      const now = performance.now();
      const input = dashInputRef.current;
      if (
        input.direction !== 0 &&
        input.dashStartedAt > 0 &&
        now - input.dashStartedAt <= 560
      ) {
        input.jumpAfterDashAt = now;
        input.comboDirection = input.direction;
      }
    };

    const down = (event: KeyboardEvent) => {
      const map: Record<string, Key | undefined> = {
        ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
        ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", " ": "fire",
      };
      const key = map[event.key];
      if (key) {
        getGameAudioContext();
        if (!event.repeat && (key === "left" || key === "right")) {
          registerDashPress(key);
        }
        if (!event.repeat && key === "up") registerDashJump();
        if (key === "fire" && !event.repeat) firePressRef.current += 1;
        keys[key] = true;
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => {
      const map: Record<string, Key | undefined> = {
        ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
        ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", " ": "fire",
      };
      const key = map[event.key];
      if (key) {
        keys[key] = false;
        const releasedDirection = key === "left" ? -1 : key === "right" ? 1 : 0;
        if (dashInputRef.current.direction === releasedDirection) {
          dashInputRef.current.direction = 0;
        }
      }
    };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);

    const land = (body: Body, oldY: number) => {
      // 상승 중에는 위층 바닥에 붙지 않고 점프 최고점까지 그대로 이동
      if (body.vy < 0) {
        return false;
      }

      for (const p of platforms) {
        // 아래키로 내려가는 동안에는 현재 층만 통과하고 최하단 바닥은 유지
        if (
          body === player &&
          player.dropThrough > 0 &&
          p.y < H - 50
        ) {
          continue;
        }

        const connectionPadding = p.kind === "slide" ? 10 : 0;
        if (
          body.x + body.w <= p.x - connectionPadding ||
          body.x >= p.x + p.w + connectionPadding
        ) {
          continue;
        }

        const centerX = clamp(body.x + body.w / 2, p.x, p.x + p.w);
        const progress = (centerX - p.x) / p.w;
        const surfaceY =
          p.kind === "slide" && typeof p.endY === "number"
            ? p.y + (p.endY - p.y) * progress
            : p.y;

        if (
          oldY + body.h <= surfaceY + 18 &&
          body.y + body.h >= surfaceY
        ) {
          body.y = surfaceY - body.h;
          body.vy = 0;

          if (p.kind === "slide" && typeof p.endY === "number") {
            const slopeDirection = Math.sign(p.endY - p.y);
            body.vx += slopeDirection * 0.34;
          }

          return true;
        }
      }
      return false;
    };

    const frame = (now: number) => {
      const dt = Math.min(2, (now - last) / 16.667); last = now;
      const elapsedMs = dt * 16.667;
      waveRemainingMs = Math.max(0, waveRemainingMs - elapsedMs);
      normalSpawnAccumulator += elapsedMs;
      midSpawnAccumulator += elapsedMs;
      highSpawnAccumulator += elapsedMs;
      saveAccumulator += elapsedMs;
      invincible = Math.max(0, invincible - dt);
      highJumpEffect = Math.max(0, highJumpEffect - dt);
      player.dropThrough = Math.max(0, player.dropThrough - dt);
      let playerIsDashing = false;
      if (!playerCaptured) {
        const moveDirection = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        playerIsDashing =
          moveDirection !== 0 &&
          dashInputRef.current.direction === moveDirection;
        const moveAcceleration = playerIsDashing ? 2.75 : 1.35;
        const moveFriction = playerIsDashing ? 0.9 : 0.76;
        const maximumSpeed = playerIsDashing ? 14.5 : 7.2;
        player.vx += moveDirection * moveAcceleration * dt;
        player.vx *= Math.pow(moveFriction, dt);
        player.vx = clamp(player.vx, -maximumSpeed, maximumSpeed);
        if (Math.abs(player.vx) > .5) player.face = player.vx > 0 ? 1 : -1;
        if (keys.up && player.grounded) { player.vy = -15; player.grounded = false; keys.up = false; }
        if (dashInputRef.current.highJumpRequested && !player.grounded) {
          player.vy = Math.min(player.vy, -20.5);
          dashInputRef.current.highJumpRequested = false;
          highJumpEffect = 18;
        }
        if (keys.down && !player.grounded) player.vy = Math.min(22, player.vy + 2.8 * dt);
        player.vy += .78 * dt;
        const oldPY = player.y; player.x += player.vx * dt; player.y += player.vy * dt;
        player.x = clamp(player.x, 0, WORLD_W - player.w);
        player.grounded = land(player, oldPY);
        if (keys.down && player.grounded) {
          player.dropThrough = 18;
          player.y += 14;
          player.vy = 3.5;
          player.grounded = false;
          keys.down = false;
        }
        if (player.y > H + 80) {
          life--; invincible = 100;
          player.x = WORLD_W / 2 - player.w / 2;
          player.y = H - 220; player.vy = 0;
        }
      }

      dashTrailPoints = dashTrailPoints
        .map((point) => ({ ...point, life: point.life - dt }))
        .filter((point) => point.life > 0);
      if (playerIsDashing && now - lastDashTrailAt >= 28) {
        lastDashTrailAt = now;
        dashTrailPoints.push({
          x: player.x,
          y: player.y,
          face: player.face,
          life: 16,
        });
        if (dashTrailPoints.length > 10) dashTrailPoints.shift();
      }

      if (!playerCaptured && keys.fire && now - fireAt > 280) {
        fireAt = now;
        playBubbleShootSound();
        bubbles.push({ id: ++bubbleSeq, x: player.x + (player.face > 0 ? 68 : -60), y: player.y + 4,
          vx: player.face * 9, vy: -1, w: 72, h: 72, life: 360 });
      }

      for (const b of bubbles) {
        b.life -= dt; b.vx *= Math.pow(.975, dt); b.vy = Math.max(-2.3, b.vy - .018 * dt);
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < -20) b.x = WORLD_W; if (b.x > WORLD_W) b.x = -20;
        if (b.enemyId && hit(player, b)) {
          const e = enemies.find((item) => item.id === b.enemyId);
          if (e) {
            playBubblePopSound();
            e.dead = true;
            score += 100 + stage * 10;
            b.life = 0;
            coins.push({
              id: ++coinSeq, x: e.x + e.w / 2 - 13, y: e.y + e.h / 2 - 13,
              vx: (Math.random() - .5) * 5, vy: -7, w: 26, h: 26, life: 900,
            });
          }
        }
      }

      const waveActive = waveRemainingMs > 0;
      const normalAliveLimit = Math.min(
        39,
        Math.ceil((5 + stage * 3) * 1.3),
      );
      const stageMonsterTotal = stageConfig.normalMonsters
        ? normalAliveLimit + stageConfig.midTotal + stageConfig.highTotal
        : stageConfig.midTotal + stageConfig.highTotal;
      const normalSpawnInterval = Math.max(180, 620 - stage * 40);
      if (
        waveActive && stageConfig.normalMonsters &&
        normalSpawnAccumulator >= normalSpawnInterval &&
        enemies.length < normalAliveLimit
      ) {
        normalSpawnAccumulator = 0;
        enemies.push(makeEnemy());
      }

      const midInterval = Math.max(900, waveDurationMs * .48 / Math.max(1, stageConfig.midTotal));
      while (
        waveActive && midSpawned < stageConfig.midTotal &&
        midBosses.length < stageConfig.midSimultaneous &&
        midSpawnAccumulator >= midInterval
      ) {
        midSpawnAccumulator -= midInterval;
        const id = ++bossSeq;
        midBosses.push({
          id,
          x: 90 + (id * 347) % (WORLD_W - 300),
          y: 100 + (id % 3) * 165,
          vx: 0, vy: 0, w: 152, h: 152,
          hp: 20, maxHp: 20, dir: id % 2 ? -1 : 1,
          shootAt: now + 1000 + Math.random() * 900, mouthOpen: false,
        });
        midSpawned += 1;
      }

      const simultaneousBossWave = stage >= 8;
      const highPhaseReady = simultaneousBossWave ||
        (midSpawned >= stageConfig.midTotal && midBosses.length === 0);
      const highInterval = Math.max(1200, waveDurationMs * .46 / Math.max(1, stageConfig.highTotal));
      while (
        waveActive && highPhaseReady && highSpawned < stageConfig.highTotal &&
        highBosses.length < stageConfig.highSimultaneous &&
        highSpawnAccumulator >= highInterval
      ) {
        highSpawnAccumulator -= highInterval;
        const id = ++bossSeq;
        highBosses.push({
          id,
          x: 45 + (id * 431) % (WORLD_W - 390),
          y: 85 + (id % 2) * 230,
          vx: 0, vy: 0, w: 304, h: 304,
          hp: 80, maxHp: 80, dir: id % 2 ? 1 : -1,
          shootAt: now + 900 + Math.random() * 800, mouthOpen: true,
        });
        highSpawned += 1;
      }

      const getMidSpawnStatus = () => {
        if (stageConfig.midTotal === 0) return "없음";
        if (midSpawned >= stageConfig.midTotal) return "출몰 완료";
        if (!waveActive) return "웨이브 종료";
        if (
          midBosses.length >= stageConfig.midSimultaneous &&
          midSpawnAccumulator >= midInterval
        ) return "전투 중";
        return formatCountdown(Math.max(0, midInterval - midSpawnAccumulator));
      };

      const getHighSpawnStatus = () => {
        if (stageConfig.highTotal === 0) return "없음";
        if (highSpawned >= stageConfig.highTotal) return "출몰 완료";
        if (!waveActive) return "웨이브 종료";
        if (!highPhaseReady) return "중급 처치 후";
        if (
          highBosses.length >= stageConfig.highSimultaneous &&
          highSpawnAccumulator >= highInterval
        ) return "전투 중";
        return formatCountdown(Math.max(0, highInterval - highSpawnAccumulator));
      };

      const midSpawnStatus = getMidSpawnStatus();
      const highSpawnStatus = getHighSpawnStatus();

      for (const boss of midBosses) {
        boss.x += boss.dir * (1.3 + stage * .025) * dt;
        if (boss.x < 35 || boss.x + boss.w > WORLD_W - 35) {
          boss.dir *= -1;
          boss.x = clamp(boss.x, 35, WORLD_W - 35 - boss.w);
        }
        boss.y += Math.sin(now / 720 + boss.id) * .28 * dt;
        if (!playerCaptured && now >= boss.shootAt && bossBubbles.length < 600) {
          const dx = player.x + player.w / 2 - (boss.x + boss.w / 2);
          const dy = player.y + player.h / 2 - (boss.y + boss.h * .55);
          const length = Math.max(1, Math.hypot(dx, dy));
          bossBubbles.push({
            id: ++bossBubbleSeq, ownerId: boss.id,
            x: boss.x + boss.w * .42, y: boss.y + boss.h * .46,
            vx: dx / length * 5.5, vy: dy / length * 5.5,
            w: 64, h: 64, life: 440, kind: "capture",
          });
          boss.shootAt = now + Math.max(1500, 2700 - stage * 45);
        }
      }

      for (const boss of highBosses) {
        boss.x += boss.dir * .9 * dt;
        if (boss.x < 20 || boss.x + boss.w > WORLD_W - 20) {
          boss.dir *= -1;
          boss.x = clamp(boss.x, 20, WORLD_W - 20 - boss.w);
        }
        boss.y += Math.sin(now / 880 + boss.id) * .2 * dt;
        if (
          now >= boss.shootAt &&
          bossBubbles.filter((bubble) => bubble.kind === "damage").length < 420
        ) {
          const cx = boss.x + boss.w / 2;
          const cy = boss.y + boss.h * .58;
          for (let i = 0; i < 12; i += 1) {
            const angle = Math.PI * 2 * (i / 12) + now / 1700 + boss.id;
            bossBubbles.push({
              id: ++bossBubbleSeq, ownerId: boss.id,
              x: cx - 27, y: cy - 27,
              vx: Math.cos(angle) * 4.8, vy: Math.sin(angle) * 4.8,
              w: 54, h: 54, life: 480, kind: "damage",
            });
          }
          boss.shootAt = now + Math.max(1500, 2300 - stage * 45);
        }
      }

      for (const bubble of bubbles) {
        if (bubble.enemyId || bubble.life <= 0) continue;
        const midTarget = midBosses.find((boss) => boss.hp > 0 && hit(bubble, boss));
        if (midTarget) {
          bubble.life = 0; midTarget.hp -= 1; score += 40; continue;
        }
        const highTarget = highBosses.find((boss) => boss.hp > 0 && hit(bubble, boss));
        if (highTarget) {
          bubble.life = 0; highTarget.hp -= 1; score += 60;
        }
      }

      const deadMidIds = new Set(midBosses.filter((boss) => boss.hp <= 0).map((boss) => boss.id));
      const deadHighIds = new Set(highBosses.filter((boss) => boss.hp <= 0).map((boss) => boss.id));

      for (const boss of midBosses.filter((target) => target.hp <= 0)) {
        playBossDefeatSound("mid");
        const centerX = boss.x + boss.w / 2;
        const centerY = boss.y + boss.h / 2;
        dropBossCoins(boss, 5);
        trapEnemiesAroundBoss(centerX, centerY, 390, 5);
        bossExplosions.push({
          x: centerX,
          y: centerY,
          radius: 390,
          life: 42,
          maxLife: 42,
          kind: "mid",
        });
      }

      for (const boss of highBosses.filter((target) => target.hp <= 0)) {
        playBossDefeatSound("high");
        const centerX = boss.x + boss.w / 2;
        const centerY = boss.y + boss.h / 2;
        dropBossCoins(boss, 10);
        trapEnemiesAroundBoss(centerX, centerY, 560, 10);
        bossExplosions.push({
          x: centerX,
          y: centerY,
          radius: 560,
          life: 54,
          maxLife: 54,
          kind: "high",
        });
        life = 5;
        healingEffect = 96;
      }

      if (deadMidIds.size) score += deadMidIds.size * 3000;
      if (deadHighIds.size) score += deadHighIds.size * 8000;
      if (capturedBossId !== null && deadMidIds.has(capturedBossId)) releasePlayer();
      midBosses = midBosses.filter((boss) => boss.hp > 0);
      highBosses = highBosses.filter((boss) => boss.hp > 0);
      bossBubbles = bossBubbles.filter((bubble) =>
        !deadMidIds.has(bubble.ownerId) && !deadHighIds.has(bubble.ownerId)
      );

      for (const b of bossBubbles) {
        b.life -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (!playerCaptured && invincible <= 0 && hit(player, b)) {
          b.life = 0;
          const firingBoss = midBosses.find((boss) => boss.id === b.ownerId) ?? null;
          if (b.kind === "capture" && firingBoss) {
            playerCaptured = true;
            capturedBossId = firingBoss.id;
            player.vx = 0;
            player.vy = 0;
            capturePressStart = firePressRef.current;
            capturePressTarget = 10 + Math.floor(Math.random() * 11);
            firingBoss.mouthOpen = true;
          } else if (b.kind === "damage") {
            playPlayerHurtSound();
            life -= 1;
            invincible = 105;
            player.vx = b.vx > 0 ? 8 : -8;
            player.vy = -7;
          }
        }
      }

      if (playerCaptured) {
        const captor = midBosses.find((boss) => boss.id === capturedBossId) ?? null;
        if (firePressRef.current - capturePressStart >= capturePressTarget) {
          releasePlayer(true);
        } else if (!captor) {
          releasePlayer();
        } else {
          const targetX = captor.x + captor.w * 0.42 - player.w / 2;
          const targetY = captor.y + captor.h * 0.52 - player.h / 2;
          player.x += (targetX - player.x) * 0.024 * dt;
          player.y += (targetY - player.y) * 0.024 * dt;
          player.face = targetX > player.x ? 1 : -1;
          if (Math.hypot(targetX - player.x, targetY - player.y) < 20) {
            triggerGameOver();
          }
        }
      }

      for (const e of enemies) {
        if (e.dead) continue;
        e.trapImmunity = Math.max(0, e.trapImmunity - dt);
        if (e.trapped > 0) { e.trapped -= dt; e.vx = 0; e.vy = -1.2; }
        else {
          e.vx = e.dir * (1.8 + stage * .12); e.vy += .65 * dt;
          if (Math.random() < .006 * dt) e.vy = -10;
        }
        const oldEY = e.y; e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.x < 0 || e.x + e.w > WORLD_W) {
          e.dir *= -1;
          e.x = clamp(e.x, 0, WORLD_W - e.w);
        }
        land(e, oldEY);
        if (e.y > H) { e.y = 0; e.x = Math.random() * (WORLD_W - e.w); }
        if (!e.trapped && e.trapImmunity <= 0) {
          const bubble = bubbles.find((b) => !b.enemyId && b.life > 0 && hit(e, b));
          if (bubble) {
            e.trapped = 420;
            score += 10;
            bubble.enemyId = e.id;
            bubble.vx = 0;
            bubble.x = e.x + 2;
            bubble.y = e.y + 2;
            e.x = bubble.x - 2;
            e.y = bubble.y - 2;
          }
        } else {
          const bubble = bubbles.find((b) => b.enemyId === e.id);
          if (bubble) { e.x = bubble.x; e.y = bubble.y; }
          else e.trapped = 0;
        }
        if (e.trapped > 0) {
          const collider = enemies.find((other) =>
            other.id !== e.id && !other.dead && other.trapped <= 0 && hit(e, other)
          );
          if (collider) {
            const prison = bubbles.find((b) => b.enemyId === e.id);
            if (prison) prison.life = 0;
            e.trapped = 0;
            e.trapImmunity = 85;
            e.dir = collider.x < e.x ? 1 : -1;
            e.vx = e.dir * 6;
            e.vy = -6;
          }
        }
        if (!e.trapped && hit(player, e)) {
          if (playerCaptured) {
            // 흡입 도중 일반 몬스터에 닿으면 포획 물방울이 깨진다.
            releasePlayer();
          } else if (invincible <= 0) {
            playPlayerHurtSound();
            life--; invincible = 110;
            player.x = WORLD_W / 2 - player.w / 2;
            player.y = H - 220; player.vy = -8;
          }
        }
      }
      for (const coin of coins) {
        coin.life -= dt;
        coin.vy += .42 * dt;
        const oldY = coin.y;
        coin.x += coin.vx * dt;
        coin.y += coin.vy * dt;
        coin.vx *= Math.pow(.985, dt);
        if (land(coin, oldY)) coin.vx *= .85;
        if (hit(player, coin)) {
          coin.life = 0;
          coinProgress += 1;
          score += 50;
          if (coinProgress >= 3) {
            coinProgress -= 3;
            life = Math.min(5, life + 1);
          }
        }
      }
      bubbles = bubbles.filter((b) => b.life > 0 && b.y > -70);
      coins = coins.filter((coin) => coin.life > 0 && coin.y < H + 70);
      bossExplosions = bossExplosions
        .map((explosion) => ({ ...explosion, life: explosion.life - dt }))
        .filter((explosion) => explosion.life > 0);
      healingEffect = Math.max(0, healingEffect - dt);
      bossBubbles = bossBubbles.filter((b) =>
        b.life > 0 && b.x > -100 && b.x < WORLD_W + 100 && b.y > -100 && b.y < H + 100
      );
      enemies = enemies.filter((e) => !e.dead);
      if (
        waveRemainingMs <= 0 && enemies.length === 0 &&
        midBosses.length === 0 && highBosses.length === 0
      ) {
        const clearedStage = stage;
        const rankingPoints = getBubbleStageRankingPoints(clearedStage);
        const storedRankingScore = Number.parseInt(
          window.localStorage.getItem(BUBBLE_RANKING_SCORE_KEY) ?? "0",
          10,
        );
        const previousRankingScore =
          Number.isFinite(storedRankingScore) && storedRankingScore > 0
            ? storedRankingScore
            : 0;
        const nextRankingScore = previousRankingScore + rankingPoints;

        window.localStorage.setItem(
          BUBBLE_RANKING_SCORE_KEY,
          String(nextRankingScore),
        );

        void fetch("/api/minigame-scores", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            scores: {
              bubble: nextRankingScore,
            },
          }),
        })
          .then((response) => {
            if (!response.ok) {
              console.warn("후버블 랭킹 점수 서버 저장 실패");
            }
          })
          .catch((error) => {
            console.warn("후버블 랭킹 점수 서버 저장 오류:", error);
          });

        window.dispatchEvent(
          new CustomEvent("hoo:bubble-ranking-score", {
            detail: {
              stage: clearedStage,
              points: rankingPoints,
              total: nextRankingScore,
            },
          }),
        );
        onRecordSavedRef.current?.();

        stage = Math.min(10, stage + 1);
        spawnStage();
      }
      if (saveAccumulator >= 1000) {
        saveAccumulator = 0;
        persistGame();
      }
      if (life <= 0 && !gameOver) {
        triggerGameOver();
      }

      // 실제 월드는 캔버스보다 넓고, 카메라는 가능한 구간에서
      // 캐릭터의 중심을 화면 정중앙에 고정한다.
      const cameraX = clamp(
        player.x + player.w / 2 - W / 2,
        0,
        WORLD_W - W,
      );
      const theme = MAP_THEMES[(stage - 1) % MAP_THEMES.length];
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, theme.sky);
      sky.addColorStop(1, theme.horizon);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // 세로형 모바일에서는 전체 장면을 살짝 축소해 캐릭터 주변 지형과
      // 상단 정보를 더 넓게 보여준다. 배경은 먼저 채워 검은 여백을 막는다.
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(mobileRenderScale, mobileRenderScale);
      ctx.translate(-W / 2, -H / 2);

      // 멀리 보이는 달과 고정된 별빛
      ctx.beginPath();
      ctx.arc(W - 135, 120, 53, 0, Math.PI * 2);
      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.72;
      ctx.fill();
      ctx.globalAlpha = 1;
      for (let i = 0; i < 42; i += 1) {
        const starX = (i * 193 + 71) % W;
        const starY = 70 + ((i * 97 + 31) % 520);
        const size = i % 7 === 0 ? 4 : 2;
        ctx.fillStyle = i % 5 === 0 ? theme.accent : "rgba(255,255,240,.55)";
        ctx.fillRect(starX, starY, size, size);
      }

      // 원경 도시와 창문: 플레이 영역보다 뒤에만 표시
      ctx.fillStyle = "rgba(4,8,12,.24)";
      for (let i = 0; i < 14; i += 1) {
        const buildingX = i * 126 - 25;
        const buildingH = 75 + ((i * 47) % 145);
        ctx.fillRect(buildingX, H - 42 - buildingH, 92, buildingH);
        ctx.fillStyle = "rgba(255,224,143,.24)";
        for (let wy = H - 62 - buildingH; wy < H - 75; wy += 28) {
          ctx.fillRect(buildingX + 17, wy + 20, 8, 8);
          ctx.fillRect(buildingX + 51, wy + 20, 8, 8);
        }
        ctx.fillStyle = "rgba(4,8,12,.24)";
      }

      ctx.strokeStyle = "rgba(220,230,196,.06)"; ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const currentMonsterCount = enemies.length + midBosses.length + highBosses.length;
      ctx.fillStyle = "#d8ddc5"; ctx.font = "700 23px monospace";
      ctx.fillText(`SCORE ${String(score).padStart(6, "0")}`, 24, 38);
      ctx.fillText(
        `ENEMY ${String(currentMonsterCount).padStart(2, "0")}/${String(stageMonsterTotal).padStart(2, "0")}`,
        1210,
        38,
      );
      ctx.fillText(`LIFE ${"●".repeat(Math.max(0, life))}`, 1500, 38);
      ctx.fillText(`COIN ${coinProgress}/3`, 1740, 38);

      ctx.textAlign = "center";
      ctx.fillStyle = "#f4f0dc";
      ctx.font = "900 25px monospace";
      ctx.fillText(`STAGE ${String(stage).padStart(2, "0")}`, W / 2, 31);
      ctx.fillStyle = waveRemainingMs > 0 ? "#d9c6ff" : "#ffcf8b";
      ctx.font = "900 31px monospace";
      ctx.fillText(
        waveRemainingMs > 0 ? formatCountdown(waveRemainingMs) : "FINAL CLEANUP",
        W / 2,
        66,
      );

      ctx.font = "900 17px monospace";
      ctx.fillStyle = "rgba(235,225,255,.92)";
      ctx.fillText(`중급 출몰  ${midSpawnStatus}`, W / 2 - 185, 94);
      ctx.fillStyle = "rgba(255,205,171,.94)";
      ctx.fillText(`상급 출몰  ${highSpawnStatus}`, W / 2 + 185, 94);
      ctx.textAlign = "left";

      ctx.save();
      ctx.translate(-cameraX, 0);
      const isVisibleOnCamera = (body: { x: number; w: number }) =>
        body.x + body.w >= cameraX - 100 && body.x <= cameraX + W + 100;

      ctx.font = "900 16px monospace";
      ctx.fillStyle = "rgba(235,245,224,.32)";
      ctx.fillText("2F", 22, 390);
      ctx.fillText("1F", 22, 705);

      for (const p of platforms) {
        if (!isVisibleOnCamera(p)) continue;
        if (p.kind === "slide" && typeof p.endY === "number") {
          const startCenterY = p.y + p.h / 2;
          const endCenterY = p.endY + p.h / 2;

          // 그림자부터 본체까지 동일한 중심선을 사용해 절단면 없이 연결한다.
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          ctx.beginPath();
          ctx.moveTo(p.x + 7, startCenterY + 9);
          ctx.lineTo(p.x + p.w + 7, endCenterY + 9);
          ctx.strokeStyle = "rgba(0,0,0,.3)";
          ctx.lineWidth = p.h + 9;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p.x, startCenterY);
          ctx.lineTo(p.x + p.w, endCenterY);
          ctx.strokeStyle = theme.platform;
          ctx.lineWidth = p.h;
          ctx.stroke();

          // 미끄럼틀의 밝은 상단 레일과 어두운 하단 레일
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.w, p.endY);
          ctx.strokeStyle = theme.edge;
          ctx.lineWidth = 7;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + p.h);
          ctx.lineTo(p.x + p.w, p.endY + p.h);
          ctx.strokeStyle = "rgba(5,9,10,.45)";
          ctx.lineWidth = 5;
          ctx.stroke();

          // 양쪽 플랫폼과 맞닿는 부분을 둥근 연결 패드로 덮는다.
          ctx.fillStyle = theme.edge;
          ctx.beginPath();
          ctx.arc(p.x, p.y + 2, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x + p.w, p.endY + 2, 6, 0, Math.PI * 2);
          ctx.fill();

          // 경사면을 따라 배치된 작은 연결 볼트
          ctx.fillStyle = theme.accent;
          for (const progress of [.25, .5, .75]) {
            const boltX = p.x + p.w * progress;
            const boltY = p.y + (p.endY - p.y) * progress + 8;
            ctx.fillRect(boltX - 2, boltY - 2, 4, 4);
          }
          ctx.restore();
        } else {
          // 발판 그림자와 두꺼운 본체
          ctx.fillStyle = "rgba(0,0,0,.28)";
          ctx.fillRect(p.x + 7, p.y + 9, p.w, p.h + 7);
          ctx.fillStyle = theme.platform;
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.fillStyle = theme.edge;
          ctx.fillRect(p.x, p.y, p.w, 6);
          ctx.fillStyle = "rgba(255,255,255,.22)";
          ctx.fillRect(p.x + 5, p.y + 7, 5, p.h - 10);
          ctx.fillRect(p.x + p.w - 10, p.y + 7, 5, p.h - 10);

          // 긴 발판에는 볼트와 짧은 지지대를 추가
          if (p.y < H - 50) {
            ctx.fillStyle = theme.accent;
            for (let boltX = p.x + 40; boltX < p.x + p.w - 20; boltX += 90) {
              ctx.fillRect(boltX, p.y + 10, 4, 4);
            }
            ctx.fillStyle = "rgba(8,14,16,.38)";
            ctx.fillRect(p.x + 30, p.y + p.h, 13, 24);
            ctx.fillRect(p.x + p.w - 43, p.y + p.h, 13, 24);
          }
        }
      }
      for (const explosion of bossExplosions) {
        if (
          explosion.x + explosion.radius < cameraX - 100 ||
          explosion.x - explosion.radius > cameraX + W + 100
        ) continue;
        const progress = 1 - explosion.life / explosion.maxLife;
        const currentRadius = explosion.radius * Math.min(1, progress * 1.35);
        const alpha = Math.max(0, 1 - progress);
        const glow = ctx.createRadialGradient(
          explosion.x,
          explosion.y,
          0,
          explosion.x,
          explosion.y,
          Math.max(1, currentRadius),
        );
        glow.addColorStop(
          0,
          explosion.kind === "high"
            ? `rgba(255,255,226,${alpha * .9})`
            : `rgba(255,246,205,${alpha * .82})`,
        );
        glow.addColorStop(
          .25,
          explosion.kind === "high"
            ? `rgba(255,177,79,${alpha * .72})`
            : `rgba(255,199,103,${alpha * .62})`,
        );
        glow.addColorStop(1, `rgba(255,92,35,0)`);
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
          explosion.x,
          explosion.y,
          currentRadius * .82,
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = `rgba(255,238,173,${alpha * .88})`;
        ctx.lineWidth = explosion.kind === "high" ? 18 : 12;
        ctx.stroke();
      }
      for (const b of bubbles) {
        if (!isVisibleOnCamera(b)) continue;
        const radius = b.w / 2;
        const trappedEnemy = b.enemyId
          ? enemies.find((enemy) => enemy.id === b.enemyId && !enemy.dead)
          : undefined;

        ctx.beginPath();
        ctx.arc(b.x + radius, b.y + radius, radius - 3, 0, Math.PI * 2);
        ctx.fillStyle = trappedEnemy
          ? "rgba(178,221,226,.22)"
          : "rgba(180,210,205,.16)";
        ctx.fill();

        if (trappedEnemy) {
          drawMonster(ctx, {
            ...trappedEnemy,
            x: b.x - 2,
            y: b.y - 2,
          });

          // 어떤 몬스터 외형이 들어가도 확실히 보이는 큰 눈물 연출
          ctx.fillStyle = "rgba(184,239,255,.96)";
          ctx.fillRect(b.x + 20, b.y + 43, 7, 17);
          ctx.fillRect(b.x + 49, b.y + 43, 7, 17);
          ctx.fillStyle = "rgba(235,252,255,.95)";
          ctx.fillRect(b.x + 21, b.y + 43, 3, 8);
          ctx.fillRect(b.x + 50, b.y + 43, 3, 8);
          ctx.fillStyle = "rgba(114,199,231,.92)";
          ctx.fillRect(b.x + 22, b.y + 59, 4, 6);
          ctx.fillRect(b.x + 50, b.y + 59, 4, 6);
        }

        ctx.beginPath();
        ctx.arc(b.x + radius, b.y + radius, radius - 3, 0, Math.PI * 2);
        ctx.strokeStyle = trappedEnemy ? "#dffaff" : "#c9d6bd";
        ctx.lineWidth = trappedEnemy ? 6 : 5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(b.x + radius * .65, b.y + radius * .58, 8, Math.PI, Math.PI * 1.8);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      for (const b of bossBubbles) {
        if (!isVisibleOnCamera(b)) continue;
        const radius = b.w / 2;
        const glow = ctx.createRadialGradient(
          b.x + radius * .72, b.y + radius * .62, 3,
          b.x + radius, b.y + radius, radius,
        );
        glow.addColorStop(0, b.kind === "capture" ? "rgba(244,191,255,.72)" : "rgba(255,194,155,.82)");
        glow.addColorStop(.42, b.kind === "capture" ? "rgba(123,38,164,.72)" : "rgba(177,30,69,.78)");
        glow.addColorStop(1, b.kind === "capture" ? "rgba(33,7,51,.18)" : "rgba(55,4,13,.2)");
        ctx.beginPath();
        ctx.arc(b.x + radius, b.y + radius, radius - 2, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.strokeStyle = b.kind === "capture" ? "#ca67f2" : "#ff6f77";
        ctx.lineWidth = 5;
        ctx.stroke();
      }
      for (const e of enemies) {
        if (e.trapped || !isVisibleOnCamera(e)) continue;
        drawMonster(ctx, e);
      }
      for (const coin of coins) {
        if (!isVisibleOnCamera(coin)) continue;
        const pulse = 1 + Math.sin(now / 90 + coin.id) * .12;
        ctx.save();
        ctx.translate(coin.x + coin.w / 2, coin.y + coin.h / 2);
        ctx.scale(pulse, pulse);
        ctx.beginPath();
        ctx.arc(0, 0, coin.w / 2, 0, Math.PI * 2);
        ctx.fillStyle = "#ffd34f";
        ctx.fill();
        ctx.strokeStyle = "#fff0a0";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = "#a46a18";
        ctx.font = "900 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText("C", 0, 6);
        ctx.restore();
      }
      for (const boss of midBosses) {
        if (isVisibleOnCamera(boss)) drawMidBoss(ctx, boss);
      }
      for (const boss of highBosses) {
        if (isVisibleOnCamera(boss)) drawHighBoss(ctx, boss);
      }
      if (invincible % 12 < 7) {
        if (highJumpEffect > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(.75, highJumpEffect / 18);
          ctx.fillStyle = "#d9f7ad";
          ctx.fillRect(player.x + 17, player.y + player.h + 5, 7, 35);
          ctx.fillRect(player.x + 38, player.y + player.h + 12, 5, 50);
          ctx.fillRect(player.x + 59, player.y + player.h + 3, 7, 31);
          ctx.restore();
        }
        if (dashTrailPoints.length > 0) {
          // 실제 이동 좌표를 따라 휘어지는 뱀 형태의 대시 잔상
          ctx.save();
          if (dashTrailPoints.length > 1) {
            const centers = dashTrailPoints.map((point) => ({
              x: point.x + player.w / 2,
              y: point.y + player.h / 2,
            }));
            ctx.beginPath();
            ctx.moveTo(centers[0].x, centers[0].y);
            for (let index = 1; index < centers.length - 1; index += 1) {
              const current = centers[index];
              const next = centers[index + 1];
              ctx.quadraticCurveTo(
                current.x,
                current.y,
                (current.x + next.x) / 2,
                (current.y + next.y) / 2,
              );
            }
            const lastCenter = centers[centers.length - 1];
            ctx.lineTo(lastCenter.x, lastCenter.y);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = "rgba(141,229,210,.15)";
            ctx.lineWidth = 34;
            ctx.stroke();
            ctx.strokeStyle = "rgba(217,247,173,.28)";
            ctx.lineWidth = 9;
            ctx.stroke();
          }

          for (const trail of dashTrailPoints) {
            ctx.globalAlpha = Math.min(.34, (trail.life / 16) * .34);
            drawLizard(
              ctx,
              trail.x,
              trail.y,
              trail.face,
              (now / 130) % 1,
              false,
            );
          }
          ctx.restore();
        }
        drawLizard(
          ctx,
          player.x,
          player.y,
          player.face,
          (now / 130) % 1,
          now - fireAt < 180,
        );
      }
      if (healingEffect > 0) {
        const pulse = .72 + Math.sin(now / 90) * .18;
        const centerX = player.x + player.w / 2;
        const centerY = player.y + player.h / 2;
        ctx.save();
        const healingGlow = ctx.createRadialGradient(
          centerX,
          centerY,
          3,
          centerX,
          centerY,
          92,
        );
        healingGlow.addColorStop(0, `rgba(255,248,149,${pulse * .42})`);
        healingGlow.addColorStop(1, "rgba(255,220,70,0)");
        ctx.beginPath();
        ctx.arc(centerX, centerY, 92, 0, Math.PI * 2);
        ctx.fillStyle = healingGlow;
        ctx.fill();
        ctx.globalAlpha = Math.min(1, healingEffect / 24) * pulse;
        ctx.fillStyle = "#fff49a";
        ctx.shadowColor = "#ffd83d";
        ctx.shadowBlur = 24;
        ctx.fillRect(centerX - 9, centerY - 43, 18, 86);
        ctx.fillRect(centerX - 43, centerY - 9, 86, 18);
        ctx.fillStyle = "rgba(255,255,225,.9)";
        ctx.fillRect(centerX - 4, centerY - 34, 8, 68);
        ctx.fillRect(centerX - 34, centerY - 4, 68, 8);
        ctx.restore();
      }
      if (playerCaptured) {
        const cx = player.x + player.w / 2;
        const cy = player.y + player.h / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(player.w, player.h) * .63, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(91,24,125,.27)";
        ctx.fill();
        ctx.strokeStyle = "#d784ff";
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - 17, cy - 20, 11, Math.PI, Math.PI * 1.8);
        ctx.strokeStyle = "rgba(255,235,255,.9)";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = "#f3d9ff";
        ctx.font = "900 15px monospace";
        ctx.textAlign = "center";
        const pressed = Math.min(capturePressTarget, firePressRef.current - capturePressStart);
        ctx.fillText(`BUBBLE 연타 ${pressed}/${capturePressTarget}`, cx, cy - 67);
        ctx.textAlign = "left";
      }
      ctx.restore();

      // 월드와 모든 이펙트를 그린 뒤 마지막 화면 레이어에 보스 HUD를
      // 배치해야 발판·몬스터·버블 등에 가려지지 않는다.
      drawBossStatusHud(ctx, W, midBosses, highBosses);

      ctx.restore();
      if (!gameOver) rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      persistGame(false);
      cancelAnimationFrame(rafRef.current); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("resize", updateMobileRenderScale);
      window.removeEventListener("orientationchange", updateMobileRenderScale);
      (Object.keys(keys) as Key[]).forEach((key) => { keys[key] = false; });
      dashInputRef.current.direction = 0;
      dashInputRef.current.highJumpRequested = false;
    };
  }, [started]);

  const hold = (key: Key, value: boolean) => {
    if (value) getGameAudioContext();
    if ((key === "left" || key === "right") && value && !keys[key]) {
      const now = performance.now();
      const input = dashInputRef.current;
      const pressedDirection = key === "left" ? -1 : 1;
      const previousAt = key === "left" ? input.lastLeftAt : input.lastRightAt;
      if (
        input.comboDirection === -pressedDirection &&
        input.jumpAfterDashAt > 0 &&
        now - input.jumpAfterDashAt <= 420
      ) {
        input.highJumpRequested = true;
        input.jumpAfterDashAt = 0;
        input.comboDirection = 0;
      }
      if (previousAt > 0 && now - previousAt <= 285) {
        input.direction = pressedDirection;
        input.dashStartedAt = now;
      }
      if (key === "left") input.lastLeftAt = now;
      else input.lastRightAt = now;
    }
    if (key === "up" && value && !keys.up) {
      const now = performance.now();
      const input = dashInputRef.current;
      if (
        input.direction !== 0 &&
        input.dashStartedAt > 0 &&
        now - input.dashStartedAt <= 560
      ) {
        input.jumpAfterDashAt = now;
        input.comboDirection = input.direction;
      }
    }
    if ((key === "left" || key === "right") && !value) {
      const releasedDirection = key === "left" ? -1 : 1;
      if (dashInputRef.current.direction === releasedDirection) {
        dashInputRef.current.direction = 0;
      }
    }
    if (key === "fire" && value && !keys.fire) firePressRef.current += 1;
    keys[key] = value;
  };
  const button = (key: Key, label: string, extra = "") => (
    <button type="button" aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); hold(key, true); }}
      onPointerUp={() => hold(key, false)} onPointerCancel={() => hold(key, false)} onPointerLeave={() => hold(key, false)}
      className={`select-none touch-none border-2 border-[#aab09e] bg-black/75 font-black text-[#e6eadb] active:bg-[#68705f] ${extra}`}>{label}</button>
  );

  if (!mounted) return null;
  return createPortal(
    <section className="hoo-bubble-shell fixed inset-0 z-[20000] overflow-hidden bg-black text-white">
      <div className="hoo-bubble-root flex h-full min-h-0 w-full flex-col bg-[#090a09]">
        <header className="hoo-bubble-game-header flex h-16 shrink-0 items-center justify-between border-b border-white/15 px-4 sm:px-6">
          <div><p className="font-mono text-[9px] font-black tracking-[.35em] text-[#89917c]">HOO ARCADE FILE 02 · WIDE STAGE</p><h1 className="font-mono text-xl font-black tracking-[.14em]">HOO BUBBLE</h1></div>
          <button type="button" onClick={onExit} className="rounded-full border border-white/25 px-4 py-2 text-sm font-black">나가기 ×</button>
        </header>
        <div className="hoo-bubble-game-stage flex min-h-0 flex-1 flex-col bg-black">
          <div className="hoo-bubble-canvas-wrap relative min-h-0 flex-1 overflow-hidden bg-black">
            <canvas ref={canvasRef} width={W} height={H} className="hoo-bubble-game-canvas h-full w-full object-contain [image-rendering:pixelated]" />
          {!started && (
            <div className="hoo-bubble-start-overlay absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/80 px-6 text-center backdrop-blur-[2px]">
              <div className="hoo-bubble-start-content"><div className="mx-auto mb-5 h-20 w-20 border-2 border-[#aab09e] bg-[#161816] [image-rendering:pixelated]"><span className="block pt-5 text-4xl">🦎</span></div>
                <p className="font-mono text-xs font-black tracking-[.3em] text-[#9da58f]">A VERY SMALL HERO</p>
                <h2 className="mt-2 font-mono text-3xl font-black">하찮은 도마뱀 출동</h2>
                {hud.life === 0 && <p className="mt-3 font-mono text-sm">FINAL SCORE {hud.score}</p>}
                {hasSave && hud.life !== 0 && <p className="mt-3 font-mono text-xs text-[#c9d5b8]">저장된 웨이브가 있습니다.</p>}
                {hasSave && hud.life !== 0 ? (
                  <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setStarted(true)}
                      className="border-2 border-[#dce2cf] bg-[#555e4e] px-10 py-4 font-mono text-lg font-black text-white"
                    >
                      이어하기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.removeItem(SAVE_KEY);
                        setHasSave(false);
                        setHud({ score: 0, stage: 1, life: 3 });
                        firePressRef.current = 0;
                        setStarted(true);
                      }}
                      className="border-2 border-[#d7c6ff] bg-[#6548a8] px-10 py-4 font-mono text-lg font-black text-white"
                    >
                      처음부터 도전
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      window.localStorage.removeItem(SAVE_KEY);
                      setHasSave(false);
                      setHud({ score: 0, stage: 1, life: 3 });
                      firePressRef.current = 0;
                      setStarted(true);
                    }}
                    className="mt-7 border-2 border-[#dce2cf] bg-[#555e4e] px-10 py-4 font-mono text-lg font-black text-white"
                  >
                    {hud.life === 0 ? "다시 시작" : "게임 시작"}
                  </button>
                )}
              </div>
            </div>
          )}

          </div>

          {started && (
            <div className="hoo-bubble-mobile-controls pointer-events-none z-30 shrink-0 items-center px-[max(14px,env(safe-area-inset-left))] pb-[max(12px,env(safe-area-inset-bottom))] pr-[max(14px,env(safe-area-inset-right))]">
              <div className="hoo-bubble-round-console pointer-events-auto relative h-[116px] w-[116px] touch-none rounded-full border-2 border-white/25 bg-black/55 shadow-[0_10px_28px_rgba(0,0,0,.55),inset_0_0_22px_rgba(174,145,255,.16)] backdrop-blur-[3px]">
                {button("up", "▲", "absolute left-1/2 top-[7px] h-[42px] w-[42px] -translate-x-1/2 rounded-full text-base shadow-[inset_0_0_9px_rgba(255,255,255,.12)]")}
                {button("left", "◀", "absolute left-[7px] top-1/2 h-[42px] w-[42px] -translate-y-1/2 rounded-full text-base shadow-[inset_0_0_9px_rgba(255,255,255,.12)]")}
                {button("right", "▶", "absolute right-[7px] top-1/2 h-[42px] w-[42px] -translate-y-1/2 rounded-full text-base shadow-[inset_0_0_9px_rgba(255,255,255,.12)]")}
                {button("down", "▼", "absolute bottom-[7px] left-1/2 h-[42px] w-[42px] -translate-x-1/2 rounded-full text-base shadow-[inset_0_0_9px_rgba(255,255,255,.12)]")}
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-[28px] w-[28px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-[#171421] shadow-[inset_0 0 10px_rgba(145,111,255,.4)]" />
              </div>

              <div className="hoo-bubble-fire-wrap pointer-events-auto flex justify-end pr-1">
                {button(
                  "fire",
                  "BUBBLE",
                  "h-[88px] w-[88px] rounded-full font-mono text-[11px] shadow-[0_0_0_7px_rgba(37,42,35,.75)]",
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      <style jsx>{`
        .hoo-bubble-shell {
          height: 100vh;
          height: 100svh;
          height: 100dvh;
          overscroll-behavior: none;
          touch-action: none;
          -webkit-user-select: none;
          user-select: none;
        }

        .hoo-bubble-game-canvas {
          display: block;
          min-width: 0;
          min-height: 0;
        }

        .hoo-bubble-mobile-controls {
          display: none;
        }

        @media (max-width: 1024px), (any-hover: none) and (any-pointer: coarse) {
          .hoo-bubble-mobile-controls {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            align-items: end;
            width: 100%;
            height: 150px;
            height: clamp(132px, 20svh, 168px);
            padding-top: 12px;
            background: #030303;
            border-top: 1px solid rgba(255, 255, 255, 0.14);
            box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.5);
          }

          .hoo-bubble-round-console,
          .hoo-bubble-fire-wrap {
            -webkit-tap-highlight-color: transparent;
          }
        }

        @media (max-width: 1024px) and (orientation: portrait),
          (any-hover: none) and (any-pointer: coarse) and (orientation: portrait) {
          .hoo-bubble-game-header {
            height: max(48px, calc(44px + env(safe-area-inset-top)));
            padding-top: env(safe-area-inset-top);
            padding-left: max(10px, env(safe-area-inset-left));
            padding-right: max(10px, env(safe-area-inset-right));
          }

          .hoo-bubble-game-header p {
            display: none;
          }

          .hoo-bubble-game-header h1 {
            font-size: 15px;
            letter-spacing: 0.1em;
          }

          .hoo-bubble-game-header button {
            padding: 7px 12px;
            font-size: 12px;
          }

          .hoo-bubble-game-canvas {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center center;
          }

          .hoo-bubble-mobile-controls {
            padding-left: max(10px, env(safe-area-inset-left));
            padding-right: max(10px, env(safe-area-inset-right));
            padding-bottom: max(14px, env(safe-area-inset-bottom));
          }

          .hoo-bubble-start-overlay {
            padding: 12px 18px max(18px, env(safe-area-inset-bottom));
          }

          .hoo-bubble-start-content {
            width: min(100%, 420px);
            transform: scale(0.92);
          }
        }

        @media (max-width: 380px) and (orientation: portrait) {
          .hoo-bubble-mobile-controls {
            height: 132px;
          }

          .hoo-bubble-round-console {
            transform: scale(0.86);
            transform-origin: left bottom;
          }

          .hoo-bubble-fire-wrap {
            transform: scale(0.86);
            transform-origin: right bottom;
          }
        }

        @media (max-height: 520px) and (orientation: landscape) {
          .hoo-bubble-game-header {
            height: max(42px, calc(38px + env(safe-area-inset-top)));
            padding-top: env(safe-area-inset-top);
          }

          .hoo-bubble-game-header p {
            display: none;
          }

          .hoo-bubble-round-console {
            transform: scale(0.78);
            transform-origin: left bottom;
          }

          .hoo-bubble-fire-wrap {
            transform: scale(0.78);
            transform-origin: right bottom;
          }

          .hoo-bubble-mobile-controls {
            height: 104px;
            padding-top: 6px;
            padding-bottom: max(8px, env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </section>, document.body,
  );
}

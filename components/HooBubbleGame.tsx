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

  // 어떤 공격으로 처치되더라도 일반 몬스터 코인은 정확히 1번만 드랍한다.
  coinDropped?: boolean;
};
type Bubble = Body & {
  id: number;
  life: number;
  enemyId?: number;
  riddenAtMs?: number;
};

type WaterStream = Body & {
  id: number;
  dir: number;
  life: number;
  pushedEnemyId?: number;
  source: "sky" | "player";

  // 지형 추적 상태
  flowMode?: "falling" | "surface" | "wall";
  attachedPlatformIndex?: number;
  wallX?: number;
  wallDir?: number;

  // 떨어질 때는 좁은 1자 물기둥,
  // 지형에 붙은 뒤 점점 길게 펴지기 위한 값.
  targetWidth?: number;
  flowWidth?: number;
};
type BossBubble = Body & {
  id: number;
  life: number;
  kind: "capture" | "damage";
  ownerId: number;
};
type Coin = Body & { id: number; life: number };

type WaterBurst = {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
};


type WaterBomb = Body & {
  id: number;
  life: number;
  dir: number;
};
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
  stageElapsedMs?: number;
  normalSpawned?: number;
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

// 코인 크기: 기존 26px의 약 5배.
const NORMAL_COIN_SIZE = 65;
const NORMAL_COIN_HALF = NORMAL_COIN_SIZE / 2;

const BOSS_COIN_SIZE = 65;
const BOSS_COIN_HALF = BOSS_COIN_SIZE / 2;

type StageConfig = {
  normalTotal: number;
  normalSimultaneous: number;
  midTotal: number;
  highTotal: number;
  midSimultaneous: number;
  highSimultaneous: number;
};

const STAGE_CONFIGS: StageConfig[] = [
  { normalTotal: 5, normalSimultaneous: 5, midTotal: 1, highTotal: 0, midSimultaneous: 1, highSimultaneous: 0 },
  { normalTotal: 12, normalSimultaneous: 10, midTotal: 2, highTotal: 0, midSimultaneous: 1, highSimultaneous: 0 },
  { normalTotal: 18, normalSimultaneous: 15, midTotal: 3, highTotal: 1, midSimultaneous: 1, highSimultaneous: 1 },
  { normalTotal: 25, normalSimultaneous: 15, midTotal: 5, highTotal: 3, midSimultaneous: 2, highSimultaneous: 1 },
  { normalTotal: 35, normalSimultaneous: 15, midTotal: 10, highTotal: 5, midSimultaneous: 3, highSimultaneous: 2 },
  { normalTotal: 20, normalSimultaneous: 20, midTotal: 15, highTotal: 7, midSimultaneous: 4, highSimultaneous: 3 },
  { normalTotal: 30, normalSimultaneous: 20, midTotal: 20, highTotal: 10, midSimultaneous: 6, highSimultaneous: 4 },
  { normalTotal: 50, normalSimultaneous: 30, midTotal: 25, highTotal: 10, midSimultaneous: 10, highSimultaneous: 10 },
  { normalTotal: 80, normalSimultaneous: 30, midTotal: 30, highTotal: 15, midSimultaneous: 20, highSimultaneous: 10 },
  { normalTotal: 150, normalSimultaneous: 100, midTotal: 50, highTotal: 30, midSimultaneous: 50, highSimultaneous: 30 },
];

const getStageConfig = (stage: number) =>
  STAGE_CONFIGS[Math.min(STAGE_CONFIGS.length - 1, Math.max(0, stage - 1))];

const formatStageTime = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

const formatSpawnCountdown = (milliseconds: number) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};
const keys: Record<Key, boolean> = {
  left: false, right: false, up: false, down: false, fire: false,
};

type StageVisualTheme = {
  sky: string;
  horizon: string;
  platform: string;
  platformDark: string;
  edge: string;
  accent: string;
  glow: string;
  secondaryGlow: string;
  slide: string;
  slideEdge: string;
  scenery: "bubble" | "steampunk" | "cyberpunk" | "hell";
};

const MAP_THEMES: StageVisualTheme[] = [
  // 1~3단계: 기존 버블 판타지 분위기 유지
  { sky: "#101b24", horizon: "#172d35", platform: "#38575a", platformDark: "#22383b", edge: "#92d2c5", accent: "#f0d27a", glow: "#9df7e8", secondaryGlow: "#8bcfff", slide: "#4d7778", slideEdge: "#b8efe4", scenery: "bubble" },
  { sky: "#181326", horizon: "#2b2040", platform: "#51466d", platformDark: "#332a48", edge: "#c6a9ef", accent: "#e9b8d1", glow: "#c391ff", secondaryGlow: "#89cfff", slide: "#715f8d", slideEdge: "#e2ceff", scenery: "bubble" },
  { sky: "#171c17", horizon: "#263529", platform: "#486248", platformDark: "#2c3f2e", edge: "#abd68e", accent: "#f1d781", glow: "#9ee6ae", secondaryGlow: "#82d7e4", slide: "#617c5f", slideEdge: "#d1efb5", scenery: "bubble" },

  // 4~5단계: 스팀펑크
  { sky: "#1b1512", horizon: "#4a3024", platform: "#6f5438", platformDark: "#34251b", edge: "#c9955a", accent: "#edbd67", glow: "#f0a94e", secondaryGlow: "#a46f45", slide: "#745035", slideEdge: "#e1ad6b", scenery: "steampunk" },
  { sky: "#15110f", horizon: "#3b261d", platform: "#5c422f", platformDark: "#281b15", edge: "#ad784c", accent: "#e49345", glow: "#ffad4b", secondaryGlow: "#9d4f31", slide: "#623b28", slideEdge: "#ea8c4c", scenery: "steampunk" },

  // 6~7단계: 사이버펑크
  { sky: "#061523", horizon: "#0f2b42", platform: "#17384c", platformDark: "#0a1e2c", edge: "#1ddce8", accent: "#d849ff", glow: "#00f4ff", secondaryGlow: "#ea3dff", slide: "#15556a", slideEdge: "#28f1ff", scenery: "cyberpunk" },
  { sky: "#070920", horizon: "#21103f", platform: "#25245d", platformDark: "#10112f", edge: "#8f50ff", accent: "#ff42d1", glow: "#28ddff", secondaryGlow: "#ff3bd0", slide: "#392c79", slideEdge: "#ba5fff", scenery: "cyberpunk" },

  // 8~10단계: 지옥
  { sky: "#19090a", horizon: "#581511", platform: "#492521", platformDark: "#251010", edge: "#b8462c", accent: "#ff8b32", glow: "#ff4d1f", secondaryGlow: "#ffb038", slide: "#632315", slideEdge: "#ff6b28", scenery: "hell" },
  { sky: "#120506", horizon: "#450a08", platform: "#391716", platformDark: "#1d0808", edge: "#991f17", accent: "#ff531c", glow: "#ff3217", secondaryGlow: "#d7190f", slide: "#54150f", slideEdge: "#ff3a1c", scenery: "hell" },
  { sky: "#080202", horizon: "#330404", platform: "#28100f", platformDark: "#0f0404", edge: "#74120f", accent: "#ff2f14", glow: "#ff1808", secondaryGlow: "#ff771c", slide: "#3a0a08", slideEdge: "#ff3417", scenery: "hell" },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const hit = (a: Body, b: Body) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// 미끄럼틀 양 끝은 완만하고 중앙에서 자연스럽게 기울어지는 S-커브.
// 렌더링과 충돌 판정이 같은 곡선을 사용하므로 캐릭터가 뜨거나 파묻히지 않는다.
const smoothSlideProgress = (progress: number) => {
  const t = clamp(progress, 0, 1);
  return t * t * (3 - 2 * t);
};

const roundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) => {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

function drawStageBackground(
  ctx: CanvasRenderingContext2D,
  stage: number,
  theme: StageVisualTheme,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, theme.sky);
  sky.addColorStop(0.58, theme.horizon);
  sky.addColorStop(1, theme.platformDark);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.save();

  if (theme.scenery === "bubble") {
    // 1~3단계: 편안한 버블 판타지. 단계가 오를수록 조금 더 깊고 신비롭게.
    const moonX = W - 150;
    const moonY = 122;
    const moonR = 48 + stage * 3;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 150);
    moonGlow.addColorStop(0, "rgba(255,242,183,.34)");
    moonGlow.addColorStop(1, "rgba(255,242,183,0)");
    ctx.fillStyle = moonGlow;
    ctx.fillRect(moonX - 160, moonY - 160, 320, 320);

    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.73;
    ctx.fill();

    // 별의 크기와 밝기를 조금씩 다르게 해서 평면적인 느낌을 줄인다.
    ctx.globalAlpha = 1;
    for (let i = 0; i < 64; i += 1) {
      const starX = (i * 193 + stage * 47 + 71) % W;
      const starY = 45 + ((i * 97 + stage * 29 + 31) % 540);
      const size = i % 13 === 0 ? 4 : i % 5 === 0 ? 3 : 1.5;
      ctx.fillStyle = i % 6 === 0 ? theme.accent : "rgba(244,255,248,.62)";
      ctx.fillRect(starX, starY, size, size);
      if (i % 11 === 0) {
        ctx.globalAlpha = 0.23;
        ctx.fillRect(starX - 4, starY + 1, size + 8, 1);
        ctx.fillRect(starX + 1, starY - 4, 1, size + 8);
        ctx.globalAlpha = 1;
      }
    }

    // 세 겹의 원경을 만들어 깊이감을 준다.
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = theme.secondaryGlow;
    ctx.beginPath();
    ctx.moveTo(0, H - 365);
    ctx.bezierCurveTo(270, H - 510, 520, H - 300, 760, H - 420);
    ctx.bezierCurveTo(1030, H - 545, 1280, H - 315, 1510, H - 420);
    ctx.bezierCurveTo(1710, H - 510, 1840, H - 395, W, H - 440);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    ctx.globalAlpha = 0.29;
    ctx.fillStyle = theme.platform;
    ctx.beginPath();
    ctx.moveTo(0, H - 250);
    ctx.bezierCurveTo(220, H - 380, 430, H - 185, 650, H - 285);
    ctx.bezierCurveTo(870, H - 370, 1090, H - 190, 1320, H - 280);
    ctx.bezierCurveTo(1530, H - 355, 1735, H - 230, W, H - 305);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    ctx.globalAlpha = 0.14;
    ctx.fillStyle = theme.edge;
    ctx.beginPath();
    ctx.moveTo(0, H - 150);
    ctx.bezierCurveTo(300, H - 255, 535, H - 110, 790, H - 200);
    ctx.bezierCurveTo(1030, H - 280, 1290, H - 125, 1535, H - 210);
    ctx.bezierCurveTo(1700, H - 260, 1820, H - 210, W, H - 235);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    // 작은 버블 군집과 먼 빛기둥.
    for (let i = 0; i < 28; i += 1) {
      const bubbleX = (i * 257 + stage * 53 + 95) % W;
      const bubbleY = 135 + ((i * 173 + stage * 37 + 65) % 690);
      const radius = 3 + (i % 5) * 2.6;
      const halo = ctx.createRadialGradient(bubbleX, bubbleY, 0, bubbleX, bubbleY, radius * 2.4);
      halo.addColorStop(0, "rgba(226,255,250,.10)");
      halo.addColorStop(1, "rgba(226,255,250,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(bubbleX - radius * 3, bubbleY - radius * 3, radius * 6, radius * 6);
      ctx.beginPath(); ctx.arc(bubbleX, bubbleY, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(225,245,242,.025)"; ctx.fill();
      ctx.strokeStyle = "rgba(225,245,242,.17)"; ctx.lineWidth = 1.5; ctx.stroke();
    }

    if (stage >= 2) {
      ctx.globalAlpha = stage === 3 ? 0.15 : 0.09;
      for (let i = 0; i < 5; i += 1) {
        const beamX = 190 + i * 390;
        const beam = ctx.createLinearGradient(beamX, 120, beamX, H - 80);
        beam.addColorStop(0, "rgba(160,220,255,0)");
        beam.addColorStop(0.4, "rgba(160,220,255,.22)");
        beam.addColorStop(1, "rgba(160,220,255,0)");
        ctx.fillStyle = beam;
        ctx.fillRect(beamX, 100, 3, H - 180);
      }
    }
  } else if (theme.scenery === "steampunk") {
    // 4~5단계: 황동 공업도시. 5단계는 더 거대하고 더 뜨거운 공장지대.
    const sunX = W - 235;
    const sunY = 150;
    const sun = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, stage === 5 ? 185 : 145);
    sun.addColorStop(0, "rgba(255,220,137,.55)");
    sun.addColorStop(0.36, "rgba(255,167,62,.25)");
    sun.addColorStop(1, "rgba(255,112,35,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(sunX - 210, sunY - 210, 420, 420);

    // 먼 파이프 라인.
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = theme.edge;
    ctx.lineWidth = 12;
    for (let i = 0; i < 4; i += 1) {
      const y = 180 + i * 130;
      ctx.beginPath();
      ctx.moveTo(-30, y);
      ctx.bezierCurveTo(330, y - 50, 630, y + 70, 970, y + 10);
      ctx.bezierCurveTo(1300, y - 40, 1600, y + 55, W + 50, y - 15);
      ctx.stroke();
    }

    // 굴뚝과 공장. 앞/뒤 레이어를 다르게 해서 도시의 깊이를 만든다.
    for (let layer = 0; layer < 2; layer += 1) {
      const spacing = layer === 0 ? 145 : 120;
      const alpha = layer === 0 ? 0.38 : 0.73;
      ctx.globalAlpha = alpha;
      for (let i = 0; i < 17; i += 1) {
        const x = i * spacing - 35 + (layer ? 45 : 0);
        const height = 105 + ((i * 61 + layer * 93) % (stage === 5 ? 340 : 270));
        ctx.fillStyle = layer === 0 ? "#271a13" : "#140d09";
        ctx.fillRect(x, H - 42 - height, 90, height);
        if (i % 2 === 0) {
          ctx.fillRect(x + 19, H - 42 - height - 72, 18, 72);
          ctx.fillRect(x + 50, H - 42 - height - 104, 20, 104);
          ctx.fillStyle = "rgba(255,157,58,.18)";
          ctx.fillRect(x + 47, H - 42 - height - 8, 26, 6);
        }
        ctx.fillStyle = "rgba(255,174,67,.28)";
        for (let wy = H - height + 18; wy < H - 80; wy += 45) {
          ctx.fillRect(x + 17, wy, 8, 11);
          ctx.fillRect(x + 54, wy + 7, 9, 11);
        }
      }
    }

    // 큰 톱니바퀴와 체인.
    ctx.globalAlpha = stage === 5 ? 0.30 : 0.22;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 7;
    for (let i = 0; i < 8; i += 1) {
      const gearX = 115 + i * 250;
      const gearY = H - 130 - (i % 3) * 105;
      const radius = 28 + (i % 3) * 15;
      ctx.beginPath(); ctx.arc(gearX, gearY, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(gearX, gearY, radius * 0.42, 0, Math.PI * 2); ctx.stroke();
      for (let tooth = 0; tooth < 10; tooth += 1) {
        const angle = (Math.PI * 2 * tooth) / 10;
        ctx.beginPath();
        ctx.moveTo(gearX + Math.cos(angle) * (radius - 1), gearY + Math.sin(angle) * (radius - 1));
        ctx.lineTo(gearX + Math.cos(angle) * (radius + 11), gearY + Math.sin(angle) * (radius + 11));
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 0.13;
    ctx.strokeStyle = "#d7aa72";
    ctx.lineWidth = 3;
    for (let chain = 0; chain < 5; chain += 1) {
      const x = 180 + chain * 405;
      for (let y = 40; y < 460; y += 24) {
        ctx.beginPath(); ctx.ellipse(x, y, 7, 12, chain % 2 ? 0 : Math.PI / 2, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // 증기 구름.
    ctx.globalAlpha = stage === 5 ? 0.10 : 0.07;
    ctx.fillStyle = "#f0e2cc";
    for (let i = 0; i < 16; i += 1) {
      ctx.beginPath();
      ctx.arc(65 + ((i * 211) % W), 120 + ((i * 83) % 420), 25 + (i % 5) * 16, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme.scenery === "cyberpunk") {
    // 6~7단계: 입체적인 네온 메가시티. 7단계에서 광고/전력선 밀도를 크게 올린다.
    const haze = ctx.createLinearGradient(0, H * 0.25, 0, H);
    haze.addColorStop(0, "rgba(20,10,65,0)");
    haze.addColorStop(1, stage === 7 ? "rgba(194,32,255,.12)" : "rgba(0,220,255,.09)");
    ctx.fillStyle = haze; ctx.fillRect(0, 0, W, H);

    // 원경 빌딩.
    ctx.globalAlpha = 0.42;
    for (let i = 0; i < 24; i += 1) {
      const x = i * 88 - 24;
      const h = 100 + ((i * 57) % 290);
      ctx.fillStyle = "#08101e";
      ctx.fillRect(x, H - 42 - h, 55, h);
      ctx.fillStyle = i % 2 ? theme.glow : theme.secondaryGlow;
      for (let y = H - h + 18; y < H - 70; y += 36) {
        ctx.globalAlpha = 0.10;
        ctx.fillRect(x + 11, y, 5, 8);
        ctx.fillRect(x + 34, y + 9, 6, 7);
      }
      ctx.globalAlpha = 0.42;
    }

    // 전경 타워.
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 17; i += 1) {
      const x = i * 120 - 20;
      const h = 155 + ((i * 73) % (stage === 7 ? 450 : 360));
      ctx.fillStyle = "rgba(3,7,17,.88)";
      ctx.fillRect(x, H - 42 - h, 76, h);
      ctx.fillStyle = i % 2 === 0 ? theme.glow : theme.secondaryGlow;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(x + 3, H - 42 - h, 2, h);
      for (let wy = H - h + 15; wy < H - 75; wy += 32) {
        ctx.fillRect(x + 14, wy, 8, 13);
        ctx.fillRect(x + 47, wy + 7, 10, 8);
      }
      ctx.globalAlpha = 0.85;
    }

    // 홀로그램 광고판.
    const signCount = stage === 7 ? 10 : 6;
    for (let i = 0; i < signCount; i += 1) {
      const sx = 120 + (i * 207) % 1680;
      const sy = 130 + (i % 4) * 125;
      ctx.globalAlpha = 0.18 + (i % 3) * 0.04;
      ctx.strokeStyle = i % 2 ? theme.secondaryGlow : theme.glow;
      ctx.lineWidth = 2.5;
      roundedRectPath(ctx, sx, sy, 96 + (i % 3) * 18, 38 + (i % 2) * 8, 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + 16, sy + 14);
      ctx.lineTo(sx + 70, sy + 14);
      ctx.moveTo(sx + 16, sy + 24);
      ctx.lineTo(sx + 54, sy + 24);
      ctx.stroke();
    }

    // 원근감 있는 네온 전력선.
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i += 1) {
      ctx.strokeStyle = i % 2 ? theme.secondaryGlow : theme.glow;
      ctx.beginPath();
      ctx.moveTo(-20, 165 + i * 72);
      ctx.lineTo(W + 30, 75 + i * 82);
      ctx.stroke();
    }

    // 바닥 안개와 데이터 입자.
    const fog = ctx.createLinearGradient(0, H - 300, 0, H);
    fog.addColorStop(0, "rgba(0,0,0,0)");
    fog.addColorStop(1, stage === 7 ? "rgba(161,38,255,.18)" : "rgba(10,203,232,.14)");
    ctx.fillStyle = fog; ctx.globalAlpha = 1; ctx.fillRect(0, H - 300, W, 300);
    for (let i = 0; i < (stage === 7 ? 58 : 38); i += 1) {
      const px = (i * 181 + 43) % W;
      const py = 90 + ((i * 137) % 750);
      ctx.fillStyle = i % 2 ? theme.glow : theme.secondaryGlow;
      ctx.globalAlpha = 0.2 + (i % 5) * 0.05;
      ctx.fillRect(px, py, i % 7 === 0 ? 3 : 1.5, 10 + (i % 4) * 6);
    }
  } else {
    // 8~10단계: 지옥. 단계가 오를수록 성채·화산·용암·불씨가 압도적으로 늘어난다.
    const intensity = stage - 7;
    const hellGlow = ctx.createRadialGradient(W / 2, 145, 0, W / 2, 145, 620 + intensity * 80);
    hellGlow.addColorStop(0, `rgba(255,${70 - intensity * 12},10,${0.24 + intensity * 0.08})`);
    hellGlow.addColorStop(0.55, "rgba(170,18,5,.12)");
    hellGlow.addColorStop(1, "rgba(70,0,0,0)");
    ctx.fillStyle = hellGlow; ctx.fillRect(0, 0, W, H);

    // 붉은 구름층.
    ctx.globalAlpha = 0.16 + intensity * 0.03;
    for (let i = 0; i < 14; i += 1) {
      const cx = (i * 179 + 70) % W;
      const cy = 80 + ((i * 83) % 330);
      const cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, 85 + (i % 4) * 20);
      cloud.addColorStop(0, "rgba(135,20,12,.42)");
      cloud.addColorStop(1, "rgba(40,0,0,0)");
      ctx.fillStyle = cloud;
      ctx.fillRect(cx - 150, cy - 110, 300, 220);
    }

    // 여러 화산 실루엣.
    ctx.globalAlpha = 0.82;
    for (let i = 0; i < 5; i += 1) {
      const vx = 160 + i * 410;
      const peakY = 210 + ((i * 73) % 170) - intensity * 18;
      ctx.fillStyle = i === 2 ? "#110505" : "#160707";
      ctx.beginPath();
      ctx.moveTo(vx - 250, H - 42);
      ctx.lineTo(vx, peakY);
      ctx.lineTo(vx + 250, H - 42);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = theme.glow;
      ctx.globalAlpha = 0.24 + intensity * 0.05;
      ctx.lineWidth = 3 + intensity;
      ctx.beginPath();
      ctx.moveTo(vx - 12, peakY + 20);
      ctx.lineTo(vx + 15, peakY + 130);
      ctx.lineTo(vx - 8, peakY + 215);
      ctx.stroke();
      ctx.globalAlpha = 0.82;
    }

    // 지옥 성채. 10단계는 중앙 왕좌 첨탑을 가장 크게.
    ctx.fillStyle = "#080202";
    ctx.globalAlpha = 0.58 + intensity * 0.08;
    for (let i = 0; i < 14; i += 1) {
      const towerX = i * 148 - 20;
      let towerHeight = 135 + ((i * 97) % (260 + intensity * 55));
      if (stage === 10 && i === 6) towerHeight = 590;
      ctx.fillRect(towerX, H - 42 - towerHeight, 88, towerHeight);
      ctx.beginPath();
      ctx.moveTo(towerX - 6, H - 42 - towerHeight);
      ctx.lineTo(towerX + 44, H - 100 - towerHeight - (i % 3) * 18);
      ctx.lineTo(towerX + 94, H - 42 - towerHeight);
      ctx.closePath(); ctx.fill();
      if (i % 2 === 0) {
        ctx.fillStyle = "rgba(255,61,20,.34)";
        for (let wy = H - towerHeight + 25; wy < H - 85; wy += 55) {
          ctx.fillRect(towerX + 35, wy, 10, 18);
        }
        ctx.fillStyle = "#080202";
      }
    }

    // 용암강과 균열.
    const lava = ctx.createLinearGradient(0, H - 150, 0, H);
    lava.addColorStop(0, "rgba(255,40,8,0)");
    lava.addColorStop(1, `rgba(255,54,8,${0.13 + intensity * 0.05})`);
    ctx.fillStyle = lava; ctx.globalAlpha = 1; ctx.fillRect(0, H - 180, W, 180);

    ctx.strokeStyle = theme.glow;
    ctx.lineWidth = 2 + intensity;
    ctx.globalAlpha = 0.43 + intensity * 0.06;
    for (let i = 0; i < 14 + intensity * 3; i += 1) {
      const crackX = 45 + i * (W / (14 + intensity * 3));
      ctx.beginPath();
      ctx.moveTo(crackX, H);
      ctx.lineTo(crackX + 20, H - 75);
      ctx.lineTo(crackX - 12, H - 135);
      ctx.lineTo(crackX + 27, H - 195 - (i % 3) * 25);
      ctx.stroke();
    }

    // 불씨 + 유성처럼 떨어지는 불꽃.
    for (let i = 0; i < 44 + intensity * 15; i += 1) {
      const sparkX = (i * 173 + intensity * 41 + 61) % W;
      const sparkY = 70 + ((i * 119 + intensity * 83) % 770);
      const sparkSize = i % 8 === 0 ? 4 : 2;
      ctx.fillStyle = i % 4 === 0 ? "#ffcf63" : theme.glow;
      ctx.globalAlpha = 0.52 + (i % 4) * 0.08;
      ctx.fillRect(sparkX, sparkY, sparkSize, sparkSize);
      if (i % 12 === 0) {
        ctx.strokeStyle = "rgba(255,150,60,.32)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sparkX, sparkY); ctx.lineTo(sparkX - 20, sparkY - 55); ctx.stroke();
      }
    }
  }

  ctx.restore();
}

function drawStagePlatform(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  theme: StageVisualTheme,
) {
  const isFloor = platform.y >= H - 50;
  const bodyHeight = isFloor ? platform.h + 18 : platform.h + 12;
  const radius =
    theme.scenery === "bubble" ? (isFloor ? 18 : 13) :
    theme.scenery === "cyberpunk" ? 7 : 5;

  ctx.save();

  // 넓은 그림자와 접지 그림자를 분리해 발판이 배경에 붙어 보이지 않게 한다.
  roundedRectPath(ctx, platform.x + 9, platform.y + 11, platform.w, bodyHeight, radius);
  ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill();
  roundedRectPath(ctx, platform.x + 3, platform.y + 5, platform.w, bodyHeight, radius);
  ctx.strokeStyle = "rgba(0,0,0,.28)"; ctx.lineWidth = 4; ctx.stroke();

  roundedRectPath(ctx, platform.x, platform.y, platform.w, bodyHeight, radius);
  const gradient = ctx.createLinearGradient(0, platform.y, 0, platform.y + bodyHeight);
  gradient.addColorStop(0, theme.edge);
  gradient.addColorStop(0.12, theme.platform);
  gradient.addColorStop(0.62, theme.platform);
  gradient.addColorStop(1, theme.platformDark);
  ctx.fillStyle = gradient; ctx.fill();

  // 위쪽 림과 하단 림.
  ctx.beginPath();
  ctx.moveTo(platform.x + radius, platform.y + 4);
  ctx.lineTo(platform.x + platform.w - radius, platform.y + 4);
  ctx.strokeStyle = theme.edge;
  ctx.lineWidth = theme.scenery === "cyberpunk" ? 5 : 4;
  ctx.globalAlpha = 0.92; ctx.lineCap = "round"; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(platform.x + radius, platform.y + bodyHeight - 4);
  ctx.lineTo(platform.x + platform.w - radius, platform.y + bodyHeight - 4);
  ctx.strokeStyle = theme.platformDark; ctx.globalAlpha = 0.75; ctx.lineWidth = 3; ctx.stroke();

  if (theme.scenery === "bubble") {
    // 둥근 섬 형태 + 작은 결정/이끼 같은 장식.
    if (!isFloor) {
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = theme.platform;
      const lobeCount = Math.max(2, Math.min(7, Math.floor(platform.w / 100)));
      for (let index = 0; index < lobeCount; index += 1) {
        const lobeX = platform.x + ((index + 1) / (lobeCount + 1)) * platform.w;
        const lobeRadius = 8 + ((index * 7 + Math.floor(platform.x)) % 10);
        ctx.beginPath(); ctx.arc(lobeX, platform.y + bodyHeight - 1, lobeRadius, 0, Math.PI); ctx.fill();
      }
    }
    ctx.globalAlpha = 0.62;
    for (let x = platform.x + 46; x < platform.x + platform.w - 30; x += 96) {
      ctx.beginPath(); ctx.arc(x, platform.y + 13, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = theme.accent; ctx.fill();
      if (!isFloor && Math.floor(x / 96) % 2 === 0) {
        ctx.strokeStyle = theme.glow; ctx.globalAlpha = 0.22; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 7, platform.y + bodyHeight - 2); ctx.lineTo(x, platform.y + bodyHeight + 9); ctx.lineTo(x + 7, platform.y + bodyHeight - 2); ctx.stroke();
        ctx.globalAlpha = 0.62;
      }
    }
  }

  if (theme.scenery === "steampunk") {
    // 황동 판넬, 리벳, 지지빔, 작은 파이프.
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(28,15,8,.62)"; ctx.lineWidth = 2;
    for (let x = platform.x + 92; x < platform.x + platform.w; x += 118) {
      ctx.beginPath(); ctx.moveTo(x, platform.y + 6); ctx.lineTo(x, platform.y + bodyHeight - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 38, platform.y + bodyHeight - 4); ctx.lineTo(x, platform.y + 7); ctx.stroke();
    }
    for (let x = platform.x + 25; x < platform.x + platform.w - 15; x += 48) {
      ctx.beginPath(); ctx.arc(x, platform.y + 14, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = theme.accent; ctx.fill();
      ctx.beginPath(); ctx.arc(x - 1, platform.y + 13, 1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,245,190,.72)"; ctx.fill();
    }
    ctx.strokeStyle = theme.secondaryGlow; ctx.globalAlpha = 0.48; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(platform.x + 18, platform.y + bodyHeight - 9); ctx.lineTo(platform.x + platform.w - 18, platform.y + bodyHeight - 9); ctx.stroke();
  }

  if (theme.scenery === "cyberpunk") {
    // 네온 패널과 회로 패턴.
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = theme.glow;
    for (let x = platform.x + 34; x < platform.x + platform.w - 20; x += 78) {
      ctx.fillRect(x, platform.y + bodyHeight - 7, 28, 2);
    }
    ctx.strokeStyle = theme.secondaryGlow; ctx.lineWidth = 2; ctx.globalAlpha = 0.48;
    for (let x = platform.x + 55; x < platform.x + platform.w - 45; x += 145) {
      ctx.beginPath();
      ctx.moveTo(x, platform.y + 10); ctx.lineTo(x + 24, platform.y + 10);
      ctx.lineTo(x + 38, platform.y + 18); ctx.lineTo(x + 62, platform.y + 18);
      ctx.stroke();
      ctx.fillStyle = theme.secondaryGlow; ctx.globalAlpha = 0.75;
      ctx.fillRect(x + 62, platform.y + 16, 4, 4);
      ctx.globalAlpha = 0.48;
    }
    // 아주 약한 발광 테두리.
    ctx.shadowColor = theme.glow; ctx.shadowBlur = 7; ctx.globalAlpha = 0.24;
    roundedRectPath(ctx, platform.x + 1, platform.y + 1, platform.w - 2, bodyHeight - 2, radius);
    ctx.strokeStyle = theme.glow; ctx.lineWidth = 1.5; ctx.stroke(); ctx.shadowBlur = 0;
  }

  if (theme.scenery === "hell") {
    // 검은 암석 + 안쪽에서 새어나오는 용암 균열 + 쇠가시.
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = theme.glow; ctx.lineWidth = 2;
    for (let x = platform.x + 38; x < platform.x + platform.w - 22; x += 76) {
      ctx.beginPath();
      ctx.moveTo(x, platform.y + bodyHeight - 3);
      ctx.lineTo(x + 8, platform.y + bodyHeight - 17);
      ctx.lineTo(x + 17, platform.y + bodyHeight - 7);
      ctx.lineTo(x + 27, platform.y + 7);
      ctx.stroke();
    }
    if (!isFloor) {
      ctx.fillStyle = theme.platformDark; ctx.globalAlpha = 0.92;
      for (let x = platform.x + 42; x < platform.x + platform.w - 25; x += 95) {
        ctx.beginPath();
        ctx.moveTo(x - 8, platform.y + bodyHeight);
        ctx.lineTo(x, platform.y + bodyHeight + 13);
        ctx.lineTo(x + 8, platform.y + bodyHeight);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.shadowColor = theme.glow; ctx.shadowBlur = 9; ctx.globalAlpha = 0.28;
    ctx.beginPath(); ctx.moveTo(platform.x + radius, platform.y + 4); ctx.lineTo(platform.x + platform.w - radius, platform.y + 4);
    ctx.strokeStyle = theme.glow; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawStageSlide(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  theme: StageVisualTheme,
) {
  if (platform.kind !== "slide" || typeof platform.endY !== "number") return;

  const drawCurve = (offsetX = 0, offsetY = 0) => {
    ctx.beginPath();
    for (let step = 0; step <= 32; step += 1) {
      const progress = step / 32;
      const curvedProgress = smoothSlideProgress(progress);
      const x = platform.x + platform.w * progress + offsetX;
      const y = platform.y + (platform.endY! - platform.y) * curvedProgress + platform.h / 2 + offsetY;
      if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  };

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 다층 그림자.
  drawCurve(9, 12); ctx.strokeStyle = "rgba(0,0,0,.38)"; ctx.lineWidth = platform.h + 17; ctx.stroke();
  drawCurve(3, 5); ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = platform.h + 12; ctx.stroke();

  drawCurve(); ctx.strokeStyle = theme.slide; ctx.lineWidth = platform.h + 9; ctx.stroke();
  drawCurve(); ctx.strokeStyle = theme.slideEdge; ctx.lineWidth = theme.scenery === "cyberpunk" ? 5 : 4; ctx.globalAlpha = 0.92; ctx.stroke();

  if (theme.scenery === "bubble") {
    // 물방울 관보다는 부드러운 고체형 곡선 다리 느낌. 내부 반사만 약하게 유지.
    drawCurve(0, 6); ctx.strokeStyle = "rgba(255,255,255,.13)"; ctx.lineWidth = 2; ctx.stroke();
    for (const progress of [0.22, 0.46, 0.70]) {
      const t = smoothSlideProgress(progress);
      const x = platform.x + platform.w * progress;
      const y = platform.y + (platform.endY - platform.y) * t + platform.h / 2;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fillStyle = theme.accent; ctx.globalAlpha = 0.50; ctx.fill();
    }
  } else if (theme.scenery === "steampunk") {
    // 진짜 금속 파이프처럼 밴드와 리벳을 추가.
    for (const progress of [0.14, 0.30, 0.46, 0.62, 0.78, 0.92]) {
      const t = smoothSlideProgress(progress);
      const x = platform.x + platform.w * progress;
      const y = platform.y + (platform.endY - platform.y) * t + platform.h / 2;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = theme.accent; ctx.globalAlpha = 0.92; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = theme.platformDark; ctx.fill();
      ctx.beginPath(); ctx.arc(x - 2, y - 2, 1, 0, Math.PI * 2); ctx.fillStyle = "#ffe0a3"; ctx.fill();
    }
  } else if (theme.scenery === "cyberpunk") {
    // 에너지 레일: 중심선 + 양쪽 점멸 세그먼트.
    ctx.shadowColor = theme.glow; ctx.shadowBlur = 10;
    drawCurve(); ctx.strokeStyle = theme.secondaryGlow; ctx.globalAlpha = 0.62; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.shadowBlur = 0;
    for (const progress of [0.12, 0.28, 0.44, 0.60, 0.76, 0.92]) {
      const t = smoothSlideProgress(progress);
      const x = platform.x + platform.w * progress;
      const y = platform.y + (platform.endY - platform.y) * t + platform.h / 2;
      ctx.fillStyle = progress < 0.5 ? theme.glow : theme.secondaryGlow;
      ctx.globalAlpha = 0.88; ctx.fillRect(x - 4, y - 2, 8, 4);
    }
  } else {
    // 용암이 흐르는 검은 돌다리.
    ctx.shadowColor = theme.glow; ctx.shadowBlur = 9;
    drawCurve(); ctx.strokeStyle = "#ffb037"; ctx.globalAlpha = 0.64; ctx.lineWidth = 3; ctx.stroke();
    ctx.shadowBlur = 0;
    for (const progress of [0.18, 0.37, 0.57, 0.78]) {
      const t = smoothSlideProgress(progress);
      const x = platform.x + platform.w * progress;
      const y = platform.y + (platform.endY - platform.y) * t + platform.h / 2;
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fillStyle = "#ff7a24"; ctx.globalAlpha = 0.8; ctx.fill();
    }
  }

  // 연결부 캡. 테마별 장식은 달라도 충돌 경계는 동일하게 유지한다.
  ctx.globalAlpha = 1;
  for (const endpoint of [
    { x: platform.x, y: platform.y + platform.h / 2 },
    { x: platform.x + platform.w, y: platform.endY + platform.h / 2 },
  ]) {
    ctx.beginPath(); ctx.arc(endpoint.x, endpoint.y, platform.h * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = theme.slide; ctx.fill();
    ctx.beginPath(); ctx.arc(endpoint.x, endpoint.y - platform.h * 0.25, 4.7, 0, Math.PI * 2);
    ctx.fillStyle = theme.slideEdge; ctx.fill();
  }

  ctx.restore();
}

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
    let squirrelFallTimer = 0;

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

    const playCoinPickupSound = () => {
      const audio = getGameAudioContext();
      if (!audio) return;

      const at = audio.currentTime;

      // 짧고 선명한 동전 획득음: "띠-링!"
      playTone(
        at,
        0.085,
        1320,
        1680,
        0.095,
        "sine",
      );

      playTone(
        at + 0.065,
        0.16,
        1780,
        2350,
        0.085,
        "triangle",
      );

      // 끝에 아주 약한 반짝임을 더해 금속성 동전 느낌을 만든다.
      playTone(
        at + 0.11,
        0.12,
        2450,
        2050,
        0.035,
        "sine",
      );
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
    let waterStreams: WaterStream[] = [];
    let waterBursts: WaterBurst[] = [];
    let waterBombs: WaterBomb[] = [];
    let waterStreamSeq = 0;
    let waterBombSeq = 0;

    const createFallingWaterStream = (
      x: number,
      dir: number,
      y: number,
    ): WaterStream => ({
      id: ++waterStreamSeq,
      x,
      y,
      vx: 0,
      vy: 3.28,
      w: 42,
      h: 150,
      dir,
      life: 900,
      source: "sky",
      flowMode: "falling",
      targetWidth: 520,
      flowWidth: 42,
    });
    let skyWaterAccumulator = 0;
    let lastSpacePressAt = -Infinity;
    let waterShotReadyAt = 0;
    let pendingWaterShot = false;
    let ridingBubbleId: number | null = null;
    let ridingWaterStreamId: number | null = null;
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
    coins = (saved?.coins ?? []).map(
      (coin) => {
        const centerX =
          coin.x +
          coin.w / 2;
        const centerY =
          coin.y +
          coin.h / 2;

        return {
          ...coin,
          x:
            centerX -
            NORMAL_COIN_HALF,
          y:
            centerY -
            NORMAL_COIN_HALF,
          w: NORMAL_COIN_SIZE,
          h: NORMAL_COIN_SIZE,
        };
      },
    );

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
    let stageElapsedMs = saved?.stageElapsedMs ?? 0;
    let normalSpawned = Math.min(
      stageConfig.normalTotal,
      Math.max(saved?.normalSpawned ?? 0, enemies.length),
    );
    let midSpawned = saved?.midSpawned ?? midBosses.length;
    let highSpawned = saved?.highSpawned ?? highBosses.length;
    let normalSpawnAccumulator = 0;
    let midSpawnAccumulator = 0;
    let highSpawnAccumulator = 0;
    let saveAccumulator = 0;
    let playerCaptured = false;
    let capturedBossId: number | null = null;
    let capturePressStart = 0;
    let capturePressTarget = 5;

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
      stageElapsedMs = 0;
      normalSpawned = 0;
      midSpawned = 0;
      highSpawned = 0;
      normalSpawnAccumulator = 0;
      midSpawnAccumulator = 0;
      highSpawnAccumulator = 0;
      platforms = stagePlatforms(stage);
      player.x = WORLD_W / 2 - player.w / 2;
      player.y = H - 130; player.vx = 0; player.vy = 0; player.dropThrough = 0;
      bubbles = [];
      waterStreams = [];
      waterBursts = [];
      waterBombs = [];
      skyWaterAccumulator = 0;
      ridingBubbleId = null;
      ridingWaterStreamId = null;
      bossBubbles = [];
      bossExplosions = [];
      healingEffect = 0;
      midBosses = [];
      highBosses = [];

      // 각 스테이지는 5마리로 시작하고, 처치될 때마다
      // 스테이지별 최대 동시출몰 수를 넘지 않는 범위에서 보충한다.
      const initialNormalCount = Math.min(
        5,
        stageConfig.normalTotal,
        stageConfig.normalSimultaneous,
      );
      enemies = Array.from(
        { length: initialNormalCount },
        (_, index) => makeEnemy(index),
      );
      normalSpawned = initialNormalCount;

      setHud({ score, stage, life });
    };

    // 이전 버전에서 1스테이지가 일반 몬스터 없이 보스로 바로 시작된
    // 저장 데이터도 새 진행 방식에 맞게 한 번만 정상화한다.
    if (saved && enemies.length === 0 && normalSpawned === 0) {
      const initialNormalCount = Math.min(
        5,
        stageConfig.normalTotal,
        stageConfig.normalSimultaneous,
      );
      enemies = Array.from(
        { length: initialNormalCount },
        (_, index) => makeEnemy(index),
      );
      normalSpawned = initialNormalCount;
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

    const dropNormalMonsterCoin = (
      enemy: Enemy,
    ) => {
      // 이미 이 몬스터가 코인을 드랍했다면 중복 생성하지 않는다.
      if (enemy.coinDropped) {
        return;
      }

      enemy.coinDropped = true;

      coins.push({
        id: ++coinSeq,
        x:
          enemy.x +
          enemy.w / 2 -
          NORMAL_COIN_HALF,
        y:
          enemy.y +
          enemy.h / 2 -
          NORMAL_COIN_HALF,
        vx:
          (Math.random() - .5) *
          5,
        vy: -7,
        w: NORMAL_COIN_SIZE,
        h: NORMAL_COIN_SIZE,
        life: 900,
      });
    };

    const dropBossCoins = (boss: MidBoss | HighBoss, amount: number) => {
      const centerX = boss.x + boss.w / 2;
      const centerY = boss.y + boss.h / 2;
      for (let index = 0; index < amount; index += 1) {
        const angle = Math.PI * 2 * (index / amount) - Math.PI / 2;
        const speed = 5.5 + (index % 3) * 1.1;
        coins.push({
          id: ++coinSeq,
          x:
            centerX -
            BOSS_COIN_HALF,
          y:
            centerY -
            BOSS_COIN_HALF,
          vx:
            Math.cos(angle) *
            speed,
          vy:
            Math.sin(angle) *
              speed -
            4.5,
          w: BOSS_COIN_SIZE,
          h: BOSS_COIN_SIZE,
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
        stage, score, life, coinProgress,
        stageElapsedMs, normalSpawned,
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
        ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
        " ": "fire", Spacebar: "fire",
      };
      const key: Key | undefined =
        event.code === "Space" ? "fire" : map[event.key];

      if (key) {
        // Space가 직전에 클릭했던 START/RESTART/FULLSCREEN 같은 버튼을
        // 다시 눌러 게임 루프가 중복 실행되는 브라우저 기본 동작을 완전히 차단한다.
        event.preventDefault();
        event.stopPropagation();

        if (key === "fire") {
          const activeElement = document.activeElement;
          if (activeElement instanceof HTMLElement) {
            activeElement.blur();
          }
        }

        getGameAudioContext();
        if (!event.repeat && (key === "left" || key === "right")) {
          registerDashPress(key);
        }
        if (!event.repeat && key === "up") registerDashJump();
        if (key === "fire" && !event.repeat) {
          firePressRef.current += 1;

          const pressedAt = performance.now();
          if (
            pressedAt - lastSpacePressAt <= 300 &&
            pressedAt >= waterShotReadyAt &&
            !playerCaptured
          ) {
            // 실제 발사 프레임에서 성공한 뒤에만 쿨타임을 시작한다.
            pendingWaterShot = true;
            lastSpacePressAt = -Infinity;
          } else {
            lastSpacePressAt = pressedAt;
          }
        }
        keys[key] = true;
      }
    };
    const up = (event: KeyboardEvent) => {
      const map: Record<string, Key | undefined> = {
        ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
        ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
        " ": "fire", Spacebar: "fire",
      };
      const key: Key | undefined =
        event.code === "Space" ? "fire" : map[event.key];

      if (key) {
        event.preventDefault();
        event.stopPropagation();
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
        const curvedProgress = smoothSlideProgress(progress);
        const surfaceY =
          p.kind === "slide" && typeof p.endY === "number"
            ? p.y + (p.endY - p.y) * curvedProgress
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
      stageElapsedMs += elapsedMs;
      normalSpawnAccumulator += elapsedMs;
      midSpawnAccumulator += elapsedMs;
      highSpawnAccumulator += elapsedMs;
      skyWaterAccumulator += elapsedMs;
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
      if (squirrelFallTimer > 0 && !player.grounded && ridingBubbleId === null) {
        squirrelFallTimer = Math.max(0, squirrelFallTimer - dt);

        // 날다람쥐 활공처럼 낙하속도를 제한한다.
        player.vy = Math.min(player.vy, 4.2);

        // 수평 관성을 조금 오래 유지해 '펼쳐서 떨어지는' 느낌을 준다.
        player.vx *= Math.pow(.992, dt);
      }
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

      // 30초마다 하늘에서 한 칸 폭의 물줄기가 떨어진다.
      // 발판에 닿으면 진행 방향으로 흘러가며, 최대 한 마리만 밀어낸다.
      while (skyWaterAccumulator >= 30_000) {
        skyWaterAccumulator -= 30_000;
        const fallWidth = 42;
        const fallHeight = 150;

        // 정기 낙하 물줄기는 맵 양끝에서만 생성된다.
        // 왼쪽 끝이면 오른쪽으로, 오른쪽 끝이면 왼쪽으로 흐른다.
        const spawnFromLeft =
          Math.random() < .5;

        // 현재 카메라에 보이는 맵의 좌/우 끝에서 생성한다.
        // 그래서 넓은 월드에서도 낙하 물줄기가 화면에 확실히 보인다.
        const visibleCameraX = clamp(
          player.x + player.w / 2 - W / 2,
          0,
          WORLD_W - W,
        );

        const spawnX =
          spawnFromLeft
            ? visibleCameraX + 26
            : visibleCameraX +
              W -
              fallWidth -
              26;

        const flowDirection =
          spawnFromLeft
            ? 1
            : -1;

        waterStreams.push(
          createFallingWaterStream(
            spawnX,
            flowDirection,
            -fallHeight,
          ),
        );
      }

      // 스페이스바 빠른 2회 입력: 12초 쿨타임의 물폭탄.
      if (pendingWaterShot && !playerCaptured) {
        pendingWaterShot = false;

        const direction =
          player.face >= 0 ? 1 : -1;

        const bombSize = 64;

        waterBombs.push({
          id: ++waterBombSeq,
          x:
            direction > 0
              ? player.x + player.w + 8
              : player.x - bombSize - 8,
          y:
            player.y +
            player.h * .34 -
            bombSize / 2,
          vx: direction * 8.2,
          vy: -8.6,
          w: bombSize,
          h: bombSize,
          dir: direction,
          life: 420,
        });

        // 실제 물폭탄 생성이 완료된 뒤에만 쿨타임 시작.
        waterShotReadyAt = now + 12_000;
      }

      if (!playerCaptured && keys.fire && now - fireAt > 280) {
        fireAt = now;
        playBubbleShootSound();
        bubbles.push({
          id: ++bubbleSeq,
          // 발사 직후 바로 올라탈 수 있도록 생성 위치와 전진 속도를 줄인다.
          x: player.x + (player.face > 0 ? 54 : -46),
          y: player.y + 4,
          vx: player.face * 5.5,
          vy: -1,
          w: 72,
          h: 72,
          life: 360,
        });
      }

      for (const b of bubbles) {
        b.life -= dt;
        b.vx *= Math.pow(.975, dt);
        b.vy = Math.max(-2.3, b.vy - .018 * dt);
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.x < -20) b.x = WORLD_W;
        if (b.x > WORLD_W) b.x = -20;

        if (b.enemyId && hit(player, b)) {
          const e = enemies.find((item) => item.id === b.enemyId);
          if (e) {
            playBubblePopSound();
            e.dead = true;
            score += 100 + stage * 10;
            b.life = 0;
            dropNormalMonsterCoin(e);
          }
        }
      }

      // 빈 버블 위에 착지하면 버블을 타고 천천히 상승한다.
      // 탑승 후 5초가 지나면 버블이 터지며, 탑승 중에도 좌우 이동이 가능하다.
      if (
        !playerCaptured &&
        ridingWaterStreamId === null
      ) {
        let ridingBubble =
          ridingBubbleId !== null
            ? bubbles.find(
                (bubble) =>
                  bubble.id === ridingBubbleId &&
                  !bubble.enemyId &&
                  bubble.life > 0,
              )
            : undefined;

        if (!ridingBubble && player.vy >= 0) {
          ridingBubble = bubbles.find((bubble) => {
            if (bubble.enemyId || bubble.life <= 0) return false;

            const bubbleTop = bubble.y + 12;
            const playerBottom = player.y + player.h;
            const horizontalOverlap =
              player.x + player.w * .72 > bubble.x + 7 &&
              player.x + player.w * .28 < bubble.x + bubble.w - 7;

            return (
              horizontalOverlap &&
              playerBottom >= bubbleTop - 12 &&
              playerBottom <= bubbleTop + 20
            );
          });

          if (ridingBubble) {
            ridingBubbleId = ridingBubble.id;
            ridingBubble.riddenAtMs ??= now;
          }
        }

        if (ridingBubble) {
          if (
            ridingBubble.riddenAtMs !== undefined &&
            now - ridingBubble.riddenAtMs >= 5_000
          ) {
            playBubblePopSound();
            ridingBubble.life = 0;
            ridingBubbleId = null;
            player.vy = -2.5;
          } else {
            const rideDirection =
              (keys.right ? 1 : 0) -
              (keys.left ? 1 : 0);

            // 아래키를 누르면 물풍선에서 바로 떨어진다.
            if (keys.down) {
              // 버블 탑승은 쿨타임 없는 자유 기술.
              // 아래키를 누르면 곧바로 땅으로 꽂히지 않고,
              // 잠깐 활공한 뒤 날다람쥐처럼 납작하게 떨어진다.
              ridingBubbleId = null;
              player.grounded = false;
              player.vx = ridingBubble.vx * 0.55;
              player.vy = 1.2;
              squirrelFallTimer = 58;

              // 같은 버블에 즉시 재탑승되지 않을 정도만 아래로 분리한다.
              player.y =
                ridingBubble.y +
                ridingBubble.h -
                2;

              keys.down = false;
            } else if (keys.up) {
              // 위키는 기존처럼 점프 하차.
              player.vy = -12.5;
              player.grounded = false;
              ridingBubbleId = null;
              keys.up = false;
            } else {
              // 탑승 중에는 플레이어가 따로 움직이는 것이 아니라
              // 물풍선 자체가 좌우로 이동하고 플레이어는 그 중심에 고정된다.
              ridingBubble.vy = Math.max(
                -1.45,
                Math.min(ridingBubble.vy, -1.05),
              );

              ridingBubble.vx +=
                rideDirection * .34 * dt;
              ridingBubble.vx *=
                Math.pow(.94, dt);
              ridingBubble.vx = clamp(
                ridingBubble.vx,
                -5.2,
                5.2,
              );

              // 입력 직후에도 풍선이 바로 반응하도록 소량 직접 이동시킨다.
              ridingBubble.x +=
                rideDirection * 1.15 * dt;
              ridingBubble.x = clamp(
                ridingBubble.x,
                0,
                WORLD_W - ridingBubble.w,
              );

              // 플레이어를 물풍선 중앙에 고정해 둘이 함께 움직이게 한다.
              player.x =
                ridingBubble.x +
                (ridingBubble.w - player.w) / 2;
              player.x = clamp(
                player.x,
                0,
                WORLD_W - player.w,
              );

              // 이전보다 물풍선에 조금 더 붙어 보이도록 8px → 16px 겹친다.
              player.y =
                ridingBubble.y -
                player.h +
                16;

              player.vx = ridingBubble.vx;
              player.vy = ridingBubble.vy;
              player.grounded = true;

              if (Math.abs(rideDirection) > 0) {
                player.face = rideDirection;
              }
            }
          }
        } else {
          ridingBubbleId = null;
        }
      }

      const applyWaterBombExplosionDamage = (
        x: number,
        y: number,
        radius: number,
        excludedNormalId?: number,
        excludedMidBossId?: number,
        excludedHighBossId?: number,
      ) => {
        // 일반 몬스터는 체력 시스템이 없으므로 폭발 데미지 1에도 처치된다.
        for (const enemy of enemies) {
          if (
            enemy.dead ||
            enemy.id === excludedNormalId
          ) {
            continue;
          }

          const centerX =
            enemy.x + enemy.w / 2;
          const centerY =
            enemy.y + enemy.h / 2;

          const distance =
            Math.hypot(
              centerX - x,
              centerY - y,
            );

          if (distance <= radius) {
            enemy.dead = true;
            dropNormalMonsterCoin(enemy);
            score += 100 + stage * 10;
          }
        }

        // 중급/상급 보스는 폭발 데미지 1.
        for (const boss of midBosses) {
          if (
            boss.id === excludedMidBossId
          ) {
            continue;
          }

          const centerX =
            boss.x + boss.w / 2;
          const centerY =
            boss.y + boss.h / 2;

          if (
            Math.hypot(
              centerX - x,
              centerY - y,
            ) <= radius
          ) {
            boss.hp -= 1;
          }
        }

        for (const boss of highBosses) {
          if (
            boss.id === excludedHighBossId
          ) {
            continue;
          }

          const centerX =
            boss.x + boss.w / 2;
          const centerY =
            boss.y + boss.h / 2;

          if (
            Math.hypot(
              centerX - x,
              centerY - y,
            ) <= radius
          ) {
            boss.hp -= 1;
          }
        }
      };

      // 플레이어 물폭탄:
      // 직격은 데미지 2, 폭발 범위는 데미지 1.
      // 일반 몬스터는 어느 쪽이든 맞으면 처치되고,
      // 보스는 해당 수치만큼 체력이 감소한다.
      for (const bomb of waterBombs) {
        bomb.life -= dt;

        const oldBottom =
          bomb.y + bomb.h;

        bomb.vy = Math.min(
          15,
          bomb.vy + .52 * dt,
        );

        const nextX =
          bomb.x + bomb.vx * dt;
        const nextY =
          bomb.y + bomb.vy * dt;
        const nextBody: Body = {
          x: nextX,
          y: nextY,
          vx: bomb.vx,
          vy: bomb.vy,
          w: bomb.w,
          h: bomb.h,
        };

        let directNormalId:
          number | undefined;
        let directMidBossId:
          number | undefined;
        let directHighBossId:
          number | undefined;
        let directHitX =
          nextX + bomb.w / 2;
        let directHitY =
          nextY + bomb.h / 2;
        let directHit = false;

        // 일반 몬스터 직격: 데미지 2 → 즉시 처치
        const directEnemy =
          enemies.find(
            (enemy) =>
              !enemy.dead &&
              hit(nextBody, enemy),
          );

        if (directEnemy) {
          directEnemy.dead = true;
          dropNormalMonsterCoin(
            directEnemy,
          );
          directNormalId =
            directEnemy.id;
          directHitX =
            directEnemy.x +
            directEnemy.w / 2;
          directHitY =
            directEnemy.y +
            directEnemy.h / 2;
          score +=
            100 +
            stage * 10;
          directHit = true;
        }

        // 중급보스 직격: 정확히 2 데미지
        if (!directHit) {
          const directMid =
            midBosses.find(
              (boss) =>
                hit(nextBody, boss),
            );

          if (directMid) {
            directMid.hp -= 2;
            directMidBossId =
              directMid.id;
            directHitX =
              directMid.x +
              directMid.w / 2;
            directHitY =
              directMid.y +
              directMid.h / 2;
            score += 80;
            directHit = true;
          }
        }

        // 상급보스 직격: 정확히 2 데미지
        if (!directHit) {
          const directHigh =
            highBosses.find(
              (boss) =>
                hit(nextBody, boss),
            );

          if (directHigh) {
            directHigh.hp -= 2;
            directHighBossId =
              directHigh.id;
            directHitX =
              directHigh.x +
              directHigh.w / 2;
            directHitY =
              directHigh.y +
              directHigh.h / 2;
            score += 120;
            directHit = true;
          }
        }

        if (directHit) {
          const explosionRadius = 38;

          waterBursts.push({
            x: directHitX,
            y: directHitY,
            life: 17,
            maxLife: 17,
            radius: 7,
          });

          // 직격 대상은 2 데미지만 받고,
          // 주변 대상만 폭발 데미지 1을 받는다.
          applyWaterBombExplosionDamage(
            directHitX,
            directHitY,
            explosionRadius,
            directNormalId,
            directMidBossId,
            directHighBossId,
          );

          playBubblePopSound();
          bomb.life = 0;
          continue;
        }

        const nextBottom =
          nextY + bomb.h;

        let hitPlatform = false;
        let hitY = nextBottom;

        for (const platform of platforms) {
          if (
            nextX + bomb.w <
              platform.x ||
            nextX >
              platform.x +
                platform.w
          ) {
            continue;
          }

          const centerX = clamp(
            nextX + bomb.w / 2,
            platform.x,
            platform.x + platform.w,
          );

          const progress =
            platform.w <= 0
              ? 0
              : (centerX - platform.x) /
                platform.w;

          const surfaceY =
            platform.kind === "slide" &&
            typeof platform.endY ===
              "number"
              ? platform.y +
                (platform.endY -
                  platform.y) *
                  progress
              : platform.y;

          if (
            oldBottom <=
              surfaceY + 12 &&
            nextBottom >=
              surfaceY - 8
          ) {
            hitPlatform = true;
            hitY = surfaceY;
            break;
          }
        }

        if (hitPlatform) {
          const explosionX =
            nextX + bomb.w / 2;
          const explosionRadius = 38;

          waterBursts.push({
            x: explosionX,
            y: hitY,
            life: 17,
            maxLife: 17,
            radius: 7,
          });

          // 지형에 맞아 터졌을 때는 범위 내 대상에게 데미지 1.
          applyWaterBombExplosionDamage(
            explosionX,
            hitY,
            explosionRadius,
          );

          playBubblePopSound();
          bomb.life = 0;
          continue;
        }

        bomb.x = nextX;
        bomb.y = nextY;

        if (
          bomb.x <
            -bomb.w * 2 ||
          bomb.x >
            WORLD_W +
              bomb.w * 2 ||
          bomb.y > H + 220
        ) {
          bomb.life = 0;
        }
      }

      // 물줄기 이동:
      // 1) 떨어질 때는 세로로 좁은 1자 물기둥
      // 2) 발판/경사면과 실제로 교차하는 순간 표면에 정확히 붙음
      // 3) 붙은 뒤 진행 방향으로 흐르면서 길이가 점점 늘어남
      // 4) 발판 끝에서는 벽을 타고 내려간 뒤 아래층에서 반대 방향으로 흐름
      for (const stream of waterStreams) {
        stream.life -= dt;

        const getPlatformSurfaceY = (
          platform: Platform,
          x: number,
        ): number => {
          const clampedX = clamp(
            x,
            platform.x,
            platform.x + platform.w,
          );

          if (
            platform.kind === "slide" &&
            typeof platform.endY === "number"
          ) {
            const progress =
              platform.w <= 0
                ? 0
                : (clampedX - platform.x) /
                  platform.w;

            return (
              platform.y +
              (platform.endY - platform.y) *
                progress
            );
          }

          return platform.y;
        };

        const findLandingPlatform = (
          previousBottom: number,
          nextBottom: number,
          left: number,
          right: number,
        ) => {
          let bestIndex = -1;
          let bestSurfaceY = Infinity;
          let bestProbeX = (left + right) / 2;

          const probeCount = 11;

          for (
            let platformIndex = 0;
            platformIndex < platforms.length;
            platformIndex += 1
          ) {
            const platform = platforms[platformIndex];

            if (
              right < platform.x - 14 ||
              left > platform.x + platform.w + 14
            ) {
              continue;
            }

            for (
              let probeIndex = 0;
              probeIndex < probeCount;
              probeIndex += 1
            ) {
              const ratio =
                probeIndex / (probeCount - 1);

              const probeX =
                left +
                (right - left) * ratio;

              if (
                probeX < platform.x - 10 ||
                probeX > platform.x + platform.w + 10
              ) {
                continue;
              }

              const surfaceX = clamp(
                probeX,
                platform.x,
                platform.x + platform.w,
              );

              const surfaceY =
                getPlatformSurfaceY(
                  platform,
                  surfaceX,
                );

              const crossedSurface =
                previousBottom <= surfaceY + 16 &&
                nextBottom >= surfaceY - 12;

              if (
                crossedSurface &&
                surfaceY < bestSurfaceY
              ) {
                bestIndex = platformIndex;
                bestSurfaceY = surfaceY;
                bestProbeX = surfaceX;
              }
            }
          }

          return {
            index: bestIndex,
            surfaceY: bestSurfaceY,
            probeX: bestProbeX,
          };
        };

        const currentTargetWidth =
          stream.targetWidth ??
          (stream.source === "player" ? 280 : 260);

        if (
          stream.flowMode === undefined ||
          stream.flowMode === "falling"
        ) {
          stream.flowMode = "falling";

          const previousBottom =
            stream.y + stream.h;

          // 하늘/플레이어 물줄기 모두 같은 설정으로 수직 낙하.
          stream.vx = 0;
          stream.vy = Math.min(
            6.8,
            stream.vy + .36 * dt,
          );

          const nextX = stream.x;
          const nextY =
            stream.y + stream.vy * dt;
          const nextBottom =
            nextY + stream.h;

          const landing =
            findLandingPlatform(
              previousBottom,
              nextBottom,
              nextX,
              nextX + stream.w,
            );

          // 지형 충돌을 먼저 검사하고, 없을 때만 실제로 아래로 이동한다.
          // 이 순서로 처리해 발판 관통을 막는다.
          if (landing.index < 0) {
            stream.x = nextX;
            stream.y = nextY;
          }

          if (landing.index >= 0) {
            const platform =
              platforms[landing.index];

            stream.attachedPlatformIndex =
              landing.index;
            stream.flowMode = "surface";

            // 지형에 닿는 순간부터 완성된 긴 물줄기로 전환한다.
            const oldCenterX =
              stream.x + stream.w / 2;

            stream.h = 38;
            stream.flowWidth =
              stream.targetWidth ?? 520;
            stream.w =
              stream.flowWidth;

            if (stream.dir > 0) {
              stream.x =
                oldCenterX - 24;
            } else {
              stream.x =
                oldCenterX -
                stream.w +
                24;
            }

            const attachX = clamp(
              landing.probeX,
              platform.x,
              platform.x + platform.w,
            );

            const surfaceY =
              getPlatformSurfaceY(
                platform,
                attachX,
              );

            stream.y =
              surfaceY -
              stream.h +
              5;

            const targetSpeed = 3.28;

            stream.vx =
              stream.dir * targetSpeed;
            stream.vy = 0;
          }
        } else if (
          stream.flowMode === "surface"
        ) {
          const platformIndex =
            stream.attachedPlatformIndex;

          const platform =
            typeof platformIndex === "number"
              ? platforms[platformIndex]
              : undefined;

          if (!platform) {
            stream.flowMode = "falling";
            stream.attachedPlatformIndex =
              undefined;
            stream.vy = 3;
          } else {
            // 지형을 타는 동안에도 처음부터 최종 길이를 유지한다.
            stream.flowWidth =
              currentTargetWidth;
            stream.w =
              currentTargetWidth;

            const targetSpeed = 3.28;

            const nextX =
              stream.x +
              stream.dir *
                targetSpeed *
                dt;

            const nextFrontX =
              stream.dir > 0
                ? nextX + stream.w
                : nextX;

            const platformLeft =
              platform.x;
            const platformRight =
              platform.x +
              platform.w;

            const frontReachedEdge =
              stream.dir > 0
                ? nextFrontX >=
                  platformRight
                : nextFrontX <=
                  platformLeft;

            if (!frontReachedEdge) {
              stream.x = nextX;

              // 진행 방향 앞쪽을 기준으로 지형 표면에 붙인다.
              // 곡선 보간 없이 발판/사선의 실제 직선 형태를 따라간다.
              const surfaceProbeX = clamp(
                stream.dir > 0
                  ? stream.x + stream.w - 8
                  : stream.x + 8,
                platform.x,
                platform.x + platform.w,
              );

              const surfaceY =
                getPlatformSurfaceY(
                  platform,
                  surfaceProbeX,
                );

              stream.y =
                surfaceY -
                stream.h +
                4;

              stream.vx =
                stream.dir *
                targetSpeed;
              stream.vy = 0;
            } else {
              const edgeX =
                stream.dir > 0
                  ? platformRight
                  : platformLeft;

              stream.flowMode = "wall";
              stream.wallX = edgeX;
              stream.wallDir = stream.dir;
              stream.attachedPlatformIndex =
                undefined;

              // 벽을 탈 때 다시 좁아지며 세로 물기둥으로 변한다.
              stream.w = 48;
              stream.flowWidth = 48;
              stream.h = 120;

              stream.x =
                edgeX - stream.w / 2;

              stream.vx = 0;
              stream.vy = 2.72;
            }
          }
        } else {
          // 벽을 타고 아래로 내려가는 세로 물기둥
          const wallX =
            stream.wallX ??
            stream.x + stream.w / 2;

          const previousBottom =
            stream.y + stream.h;

          stream.vx = 0;
          stream.vy = Math.min(
            5.2,
            stream.vy +
              .232 * dt,
          );

          stream.x =
            wallX -
            stream.w / 2;
          stream.y +=
            stream.vy * dt;

          const nextBottom =
            stream.y + stream.h;

          const landing =
            findLandingPlatform(
              previousBottom,
              nextBottom,
              stream.x - 24,
              stream.x + stream.w + 24,
            );

          if (landing.index >= 0) {
            const platform =
              platforms[landing.index];

            stream.attachedPlatformIndex =
              landing.index;
            stream.flowMode = "surface";

            // 아래층에서는 반대 방향으로 꺾여 흐른다.
            stream.dir =
              -(
                stream.wallDir ??
                stream.dir
              );

            stream.wallX = undefined;
            stream.wallDir = undefined;

            stream.h = 38;
            stream.flowWidth =
              stream.targetWidth ?? 520;
            stream.w =
              stream.flowWidth;

            const targetSpeed = 3.28;

            stream.vx =
              stream.dir * targetSpeed;
            stream.vy = 0;

            const centerX = clamp(
              wallX,
              platform.x + stream.w / 2,
              platform.x +
                platform.w -
                stream.w / 2,
            );

            stream.x =
              centerX -
              stream.w / 2;

            const surfaceY =
              getPlatformSurfaceY(
                platform,
                centerX,
              );

            stream.y =
              surfaceY -
              stream.h +
              5;
          }
        }

        // 아직 태운 적이 없을 때 첫 번째 적만 포획한다.
        if (
          stream.pushedEnemyId ===
            undefined &&
          stream.life > 0
        ) {
          const target =
            enemies.find(
              (enemy) =>
                !enemy.dead &&
                enemy.trapped <= 0 &&
                hit(stream, enemy),
            );

          if (target) {
            stream.pushedEnemyId =
              target.id;
            target.trapped = 0;
            target.trapImmunity =
              Math.max(
                target.trapImmunity,
                140,
              );
            target.dir =
              stream.dir;
          }
        }

        // 첫 번째 적은 물줄기의 선두에 계속 실려간다.
        if (
          stream.pushedEnemyId !==
          undefined
        ) {
          const carriedEnemy =
            enemies.find(
              (enemy) =>
                enemy.id ===
                  stream.pushedEnemyId &&
                !enemy.dead,
            );

          if (carriedEnemy) {
            if (
              stream.flowMode ===
              "wall"
            ) {
              carriedEnemy.x =
                stream.x +
                (stream.w -
                  carriedEnemy.w) /
                  2;
              carriedEnemy.y =
                stream.y +
                stream.h -
                16;
              carriedEnemy.vx = 0;
              carriedEnemy.vy =
                stream.vy;
            } else {
              const frontOverlap =
                18;

              carriedEnemy.x =
                stream.dir > 0
                  ? stream.x +
                    stream.w -
                    frontOverlap
                  : stream.x -
                    carriedEnemy.w +
                    frontOverlap;

              carriedEnemy.y =
                stream.y -
                carriedEnemy.h +
                14;

              carriedEnemy.vx =
                stream.vx;
              carriedEnemy.vy =
                stream.vy;
            }

            carriedEnemy.dir =
              stream.dir;
            carriedEnemy.trapped = 0;
            carriedEnemy.trapImmunity =
              Math.max(
                carriedEnemy.trapImmunity,
                140,
              );
          }
        }

        if (
          stream.x <
            -stream.w * 1.5 ||
          stream.x >
            WORLD_W +
              stream.w * 1.5 ||
          stream.y >
            H + 220
        ) {
          stream.life = 0;
        }
      }

      // 플레이어도 흐르는 물줄기 위에 올라탈 수 있다.
      // 쿨타임 없이 자유롭게 이용하며 물줄기와 함께 이동한다.
      if (
        !playerCaptured &&
        ridingBubbleId === null
      ) {
        let ridingWaterStream =
          ridingWaterStreamId !== null
            ? waterStreams.find(
                (stream) =>
                  stream.id ===
                    ridingWaterStreamId &&
                  stream.life > 0 &&
                  stream.flowMode ===
                    "surface",
              )
            : undefined;

        if (
          !ridingWaterStream &&
          player.vy >= 0
        ) {
          ridingWaterStream =
            waterStreams.find(
              (stream) => {
                if (
                  stream.life <= 0 ||
                  stream.flowMode !==
                    "surface"
                ) {
                  return false;
                }

                const streamTop =
                  stream.y + 3;
                const playerBottom =
                  player.y +
                  player.h;

                const horizontalOverlap =
                  player.x +
                    player.w * .72 >
                    stream.x + 5 &&
                  player.x +
                    player.w * .28 <
                    stream.x +
                      stream.w -
                      5;

                return (
                  horizontalOverlap &&
                  playerBottom >=
                    streamTop - 12 &&
                  playerBottom <=
                    streamTop + 22
                );
              },
            );

          if (ridingWaterStream) {
            ridingWaterStreamId =
              ridingWaterStream.id;
          }
        }

        if (ridingWaterStream) {
          const rideDirection =
            (keys.right ? 1 : 0) -
            (keys.left ? 1 : 0);

          // 물줄기 자체의 이동량을 그대로 플레이어에게 전달한다.
          player.x +=
            ridingWaterStream.vx *
            dt;

          // 물줄기 위에서 좌우로 걸을 수도 있다.
          player.x +=
            rideDirection *
            1.8 *
            dt;

          player.x = clamp(
            player.x,
            ridingWaterStream.x -
              player.w * .5,
            ridingWaterStream.x +
              ridingWaterStream.w -
              player.w * .5,
          );

          player.y =
            ridingWaterStream.y -
            player.h +
            10;

          player.vx =
            ridingWaterStream.vx;
          player.vy = 0;
          player.grounded = true;

          if (
            rideDirection !== 0
          ) {
            player.face =
              rideDirection;
          }

          // 위키로 점프해서 내린다.
          if (keys.up) {
            ridingWaterStreamId =
              null;
            player.grounded = false;
            player.vy = -11.5;
            keys.up = false;
          } else if (keys.down) {
            // 아래키로 물줄기 아래로 빠져나온다.
            ridingWaterStreamId =
              null;
            player.grounded = false;
            player.vy = 5.5;
            player.y =
              ridingWaterStream.y +
              ridingWaterStream.h +
              5;
            keys.down = false;
          }
        } else {
          ridingWaterStreamId =
            null;
        }
      } else if (
        ridingBubbleId !== null
      ) {
        ridingWaterStreamId =
          null;
      }

      // 일반 몬스터는 총 등장 수를 넘지 않으며,
      // 현재 살아있는 수는 스테이지별 동시출몰 상한을 넘지 않는다.
      const normalSpawnInterval = Math.max(
        180,
        520 - stage * 24,
      );

      while (
        normalSpawned < stageConfig.normalTotal &&
        enemies.length < stageConfig.normalSimultaneous &&
        normalSpawnAccumulator >= normalSpawnInterval
      ) {
        normalSpawnAccumulator -= normalSpawnInterval;
        enemies.push(makeEnemy());
        normalSpawned += 1;
      }

      // 제한시간이 사라졌으므로 보스 출몰도 스테이지 경과시간을 기준으로
      // 일정한 템포로 진행한다. 총 수와 최대 동시출몰 수는 기존 설정을 유지한다.
      const midInterval = Math.max(
        3600,
        9000 - stage * 350,
      );

      while (
        midSpawned < stageConfig.midTotal &&
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
      const highPhaseReady =
        simultaneousBossWave ||
        (midSpawned >= stageConfig.midTotal && midBosses.length === 0);

      const highInterval = Math.max(
        5200,
        12000 - stage * 400,
      );

      while (
        highPhaseReady &&
        highSpawned < stageConfig.highTotal &&
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
        if (
          midBosses.length >= stageConfig.midSimultaneous &&
          midSpawnAccumulator >= midInterval
        ) return "전투 중";
        return formatSpawnCountdown(
          Math.max(0, midInterval - midSpawnAccumulator),
        );
      };

      const getHighSpawnStatus = () => {
        if (stageConfig.highTotal === 0) return "없음";
        if (highSpawned >= stageConfig.highTotal) return "출몰 완료";
        if (!highPhaseReady) return "중급 처치 후";
        if (
          highBosses.length >= stageConfig.highSimultaneous &&
          highSpawnAccumulator >= highInterval
        ) return "전투 중";
        return formatSpawnCountdown(
          Math.max(0, highInterval - highSpawnAccumulator),
        );
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
        ctx.restore();
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
            capturePressTarget = 5;
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

        // 물줄기 앞에 실려가는 적은 일반 이동 AI를 잠시 중지한다.
        // 위치는 위의 물줄기 로직이 매 프레임 직접 갱신한다.
        const carryingStream = waterStreams.find(
          (stream) =>
            stream.life > 0 &&
            stream.pushedEnemyId === e.id,
        );

        if (carryingStream) {
          e.trapped = 0;
          e.trapImmunity = Math.max(
            e.trapImmunity,
            140,
          );
          e.dir = carryingStream.dir;
          e.vx = carryingStream.vx;
          e.vy = carryingStream.vy;
          continue;
        }

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

          // 코인을 실제로 획득한 순간 "띠링!" 효과음.
          playCoinPickupSound();

          coinProgress += 1;
          score += 50;

          if (coinProgress >= 3) {
            coinProgress -= 3;
            life = Math.min(
              5,
              life + 1,
            );
          }
        }
      }
      bubbles = bubbles.filter((b) => b.life > 0 && b.y > -70);
      if (
        ridingBubbleId !== null &&
        !bubbles.some((bubble) => bubble.id === ridingBubbleId)
      ) {
        ridingBubbleId = null;
      }
      waterBombs = waterBombs.filter(
        (bomb) => bomb.life > 0,
      );

      for (const burst of waterBursts) {
        burst.life -= dt;

        // 약 0.28초 동안만 보이는 작은 "물방울 톡!" 이펙트.
        // 최대 시각 지름은 약 38px.
        burst.radius = Math.min(
          19,
          burst.radius + 1.15 * dt,
        );
      }

      waterBursts = waterBursts.filter(
        (burst) => burst.life > 0,
      );

      waterStreams = waterStreams.filter(
        (stream) =>
          stream.life > 0 &&
          stream.y < H + 220 &&
          stream.x > -320 &&
          stream.x <
            WORLD_W + 320,
      );

      if (
        ridingWaterStreamId !== null &&
        !waterStreams.some(
          (stream) =>
            stream.id ===
              ridingWaterStreamId &&
            stream.flowMode ===
              "surface",
        )
      ) {
        ridingWaterStreamId = null;
      }

      coins = coins.filter((coin) => coin.life > 0 && coin.y < H + 70);
      bossExplosions = bossExplosions
        .map((explosion) => ({ ...explosion, life: explosion.life - dt }))
        .filter((explosion) => explosion.life > 0);
      healingEffect = Math.max(0, healingEffect - dt);
      bossBubbles = bossBubbles.filter((b) =>
        b.life > 0 && b.x > -100 && b.x < WORLD_W + 100 && b.y > -100 && b.y < H + 100
      );
      // 일반 몬스터가 어떤 방식으로 처치됐든,
      // dead 상태로 배열에서 제거되기 직전에 코인을 반드시 1개 드랍한다.
      // 기존 물풍선/물폭탄 처치 경로에서 이미 드랍했다면
      // coinDropped 플래그 때문에 중복 드랍되지 않는다.
      for (const enemy of enemies) {
        if (
          enemy.dead &&
          !enemy.coinDropped
        ) {
          dropNormalMonsterCoin(
            enemy,
          );
        }
      }

      enemies = enemies.filter(
        (enemy) => !enemy.dead,
      );

      const allNormalMonstersCleared =
        normalSpawned >= stageConfig.normalTotal &&
        enemies.length === 0;
      const allMidBossesCleared =
        midSpawned >= stageConfig.midTotal &&
        midBosses.length === 0;
      const allHighBossesCleared =
        highSpawned >= stageConfig.highTotal &&
        highBosses.length === 0;

      if (
        allNormalMonstersCleared &&
        allMidBossesCleared &&
        allHighBossesCleared
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
      const theme = MAP_THEMES[
        Math.min(MAP_THEMES.length - 1, Math.max(0, stage - 1))
      ];

      // 이전 프레임의 save/scale/translate 상태가 어떤 이유로든 남더라도
      // 새 프레임은 항상 정상 좌표계에서 시작하도록 강제 초기화한다.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      drawStageBackground(ctx, stage, theme);

      // 세로형 모바일에서는 게임 오브젝트와 HUD를 살짝 축소해
      // 캐릭터 주변 지형과 상단 정보를 더 넓게 보여준다.
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(mobileRenderScale, mobileRenderScale);
      ctx.translate(-W / 2, -H / 2);

      ctx.strokeStyle = "rgba(220,230,196,.06)"; ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const currentMonsterCount =
        enemies.length +
        midBosses.length +
        highBosses.length;

      // HUD에 표시할 해당 스테이지 전체 적 수.
      // 현재 stageConfig을 직접 사용해 미정의 변수 참조를 방지한다.
      const stageMonsterTotal =
        stageConfig.normalTotal +
        stageConfig.midTotal +
        stageConfig.highTotal;

      ctx.fillStyle = "#d8ddc5"; ctx.font = "700 23px monospace";
      ctx.fillText(`SCORE ${String(score).padStart(6, "0")}`, 24, 38);
      ctx.fillText(
        `ENEMY ${String(currentMonsterCount).padStart(2, "0")}/${String(stageMonsterTotal).padStart(2, "0")}`,
        1210,
        38,
      );
      ctx.fillText(`LIFE ${"●".repeat(Math.max(0, life))}`, 1500, 38);
      ctx.fillText(`COIN ${coinProgress}/3`, 1740, 38);

      // 왼쪽 하단 물줄기 스킬 HUD
      const waterCooldownMs = Math.max(0, waterShotReadyAt - now);
      const waterSkillReady = waterCooldownMs <= 0;
      const skillX = 26;
      const skillY = H - 86;
      ctx.save();
      ctx.globalAlpha = waterSkillReady ? 1 : .82;
      ctx.fillStyle = waterSkillReady
        ? "rgba(31,132,177,.84)"
        : "rgba(70,74,78,.82)";
      roundedRectPath(ctx, skillX, skillY, 58, 58, 14);
      ctx.fill();
      ctx.strokeStyle = waterSkillReady
        ? "rgba(176,241,255,.95)"
        : "rgba(165,168,170,.7)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // 물방울 아이콘
      ctx.beginPath();
      ctx.moveTo(skillX + 29, skillY + 11);
      ctx.bezierCurveTo(
        skillX + 17,
        skillY + 27,
        skillX + 15,
        skillY + 34,
        skillX + 29,
        skillY + 45,
      );
      ctx.bezierCurveTo(
        skillX + 43,
        skillY + 34,
        skillX + 41,
        skillY + 27,
        skillX + 29,
        skillY + 11,
      );
      ctx.closePath();
      ctx.fillStyle = waterSkillReady ? "#b9f2ff" : "#9a9da0";
      ctx.fill();

      if (!waterSkillReady) {
        ctx.fillStyle = "#f2f2f2";
        ctx.font = "900 17px monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          `${Math.ceil(waterCooldownMs / 1000)}`,
          skillX + 29,
          skillY + 37,
        );
      }
      ctx.fillStyle = waterSkillReady ? "#dff9ff" : "#b8b8b8";
      ctx.font = "900 12px monospace";
      ctx.textAlign = "left";
      ctx.fillText("SPACE×2", skillX + 68, skillY + 25);
      ctx.fillText(waterSkillReady ? "READY" : "BOMB", skillX + 68, skillY + 45);
      ctx.restore();

      ctx.textAlign = "center";
      ctx.fillStyle = "#f4f0dc";
      ctx.font = "900 25px monospace";
      ctx.fillText(`STAGE ${String(stage).padStart(2, "0")}`, W / 2, 31);
      ctx.fillStyle = "#d9c6ff";
      ctx.font = "900 31px monospace";
      ctx.fillText(
        formatStageTime(stageElapsedMs),
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
          drawStageSlide(ctx, p, theme);
          continue;
        }

        drawStagePlatform(ctx, p, theme);
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
      for (const bomb of waterBombs) {
        if (!isVisibleOnCamera(bomb)) continue;

        ctx.save();

        const radius =
          bomb.w / 2;

        const gradient =
          ctx.createRadialGradient(
            bomb.x + radius * .7,
            bomb.y + radius * .6,
            4,
            bomb.x + radius,
            bomb.y + radius,
            radius,
          );

        gradient.addColorStop(
          0,
          "rgba(235,254,255,.98)",
        );
        gradient.addColorStop(
          .38,
          "rgba(95,211,245,.94)",
        );
        gradient.addColorStop(
          1,
          "rgba(18,105,185,.88)",
        );

        ctx.beginPath();
        ctx.arc(
          bomb.x + radius,
          bomb.y + radius,
          radius,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.strokeStyle =
          "rgba(220,251,255,.96)";
        ctx.lineWidth = 4;
        ctx.stroke();

        // 물폭탄 표면의 반사광
        ctx.beginPath();
        ctx.arc(
          bomb.x + radius * .75,
          bomb.y + radius * .72,
          radius * .26,
          Math.PI,
          Math.PI * 1.7,
        );
        ctx.strokeStyle =
          "rgba(255,255,255,.86)";
        ctx.lineWidth = 4;
        ctx.stroke();

        // 포물선 이동감을 주는 뒤쪽 작은 물방울
        ctx.globalAlpha = .58;
        for (let i = 0; i < 4; i += 1) {
          ctx.beginPath();
          ctx.arc(
            bomb.x +
              radius -
              bomb.dir *
                (radius + 10 + i * 10),
            bomb.y +
              radius +
              Math.sin(now / 90 + i) * 7,
            3 + i,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle =
            "#bcefff";
          ctx.fill();
        }

        ctx.restore();
      }

      for (const stream of waterStreams) {
        if (!isVisibleOnCamera(stream)) continue;

        ctx.save();

        if (
          stream.flowMode === "falling" ||
          stream.flowMode === "wall"
        ) {
          // 떨어질 때는 1자로 길쭉한 세로 물기둥.
          const verticalGradient =
            ctx.createLinearGradient(
              stream.x,
              stream.y,
              stream.x,
              stream.y + stream.h,
            );

          verticalGradient.addColorStop(
            0,
            "rgba(226,253,255,.96)",
          );
          verticalGradient.addColorStop(
            .36,
            "rgba(96,206,242,.9)",
          );
          verticalGradient.addColorStop(
            1,
            "rgba(18,112,188,.76)",
          );

          roundedRectPath(
            ctx,
            stream.x,
            stream.y,
            stream.w,
            stream.h,
            Math.min(20, stream.w / 2),
          );

          ctx.fillStyle =
            verticalGradient;
          ctx.fill();

          ctx.strokeStyle =
            "rgba(224,253,255,.94)";
          ctx.lineWidth = 3;
          ctx.stroke();

          // 세로로 흐르는 흰 물결
          ctx.globalAlpha = .74;
          ctx.strokeStyle = "#eaffff";
          ctx.lineWidth = 4;
          ctx.lineCap = "round";

          for (let i = 0; i < 3; i += 1) {
            const lineX =
              stream.x +
              stream.w *
                (.28 + i * .22);

            ctx.beginPath();
            ctx.moveTo(
              lineX,
              stream.y + 12,
            );
            ctx.bezierCurveTo(
              lineX + Math.sin(now / 90 + i) * 4,
              stream.y + stream.h * .35,
              lineX - Math.sin(now / 100 + i) * 4,
              stream.y + stream.h * .7,
              lineX,
              stream.y + stream.h - 12,
            );
            ctx.stroke();
          }
        } else {
          // 땅을 만난 뒤에는 얇고 길게 펴지며 발판 표면을 흐른다.
          const waterGradient =
            ctx.createLinearGradient(
              stream.x,
              stream.y,
              stream.x,
              stream.y + stream.h,
            );

          waterGradient.addColorStop(
            0,
            "rgba(222,252,255,.96)",
          );
          waterGradient.addColorStop(
            .38,
            "rgba(83,198,239,.9)",
          );
          waterGradient.addColorStop(
            1,
            "rgba(19,118,189,.76)",
          );

          ctx.fillStyle =
            waterGradient;
          ctx.fillRect(
            stream.x,
            stream.y,
            stream.w,
            stream.h,
          );

          ctx.strokeStyle =
            "rgba(219,251,255,.92)";
          ctx.lineWidth = 3;
          ctx.strokeRect(
            stream.x,
            stream.y,
            stream.w,
            stream.h,
          );

          const centerY =
            stream.y +
            stream.h / 2;

          ctx.globalAlpha = .8;
          ctx.strokeStyle = "#e8fdff";
          ctx.lineWidth = 4;
          ctx.lineCap = "round";
          ctx.beginPath();

          const segmentCount =
            Math.max(
              5,
              Math.floor(
                stream.w / 34,
              ),
            );

          for (
            let i = 0;
            i <= segmentCount;
            i += 1
          ) {
            const px =
              stream.x +
              (stream.w * i) /
                segmentCount;

            const py =
              centerY -
              4 +
              Math.sin(
                now / 90 +
                  i * .85,
              ) *
                4;

            if (i === 0) {
              ctx.moveTo(px, py);
            } else {
              ctx.lineTo(px, py);
            }
          }

          ctx.stroke();

          ctx.globalAlpha = .86;
          ctx.fillStyle =
            "rgba(181,239,255,.86)";

          const crestWidth = 20;
          const crestHeight = 14;

          ctx.fillRect(
            stream.dir > 0
              ? stream.x +
                stream.w -
                crestWidth
              : stream.x,
            stream.y - 4,
            crestWidth,
            crestHeight,
          );

          // 뒤쪽 작은 물방울
          ctx.globalAlpha = .52;
          for (
            let i = 0;
            i < 5;
            i += 1
          ) {
            ctx.beginPath();
            ctx.arc(
              stream.dir > 0
                ? stream.x -
                    7 -
                    i * 10
                : stream.x +
                    stream.w +
                    7 +
                    i * 10,
              centerY +
                Math.sin(
                  now / 110 + i,
                ) *
                  6,
              2.5 + i * .55,
              0,
              Math.PI * 2,
            );
            ctx.fillStyle =
              "#bcefff";
            ctx.fill();
          }
        }

        ctx.restore();
      }

      // 더블스페이스 물폭탄 전용 착지 이펙트.
      // 물폭탄이 실제 착지/직격한 지점에서 작은 물방울이 "톡!" 터지듯 표현한다.
      for (const burst of waterBursts) {
        const progress =
          1 - burst.life / burst.maxLife;

        const alpha =
          Math.max(0, 1 - progress);

        const r =
          Math.min(19, burst.radius);

        ctx.save();

        // 1) 착지 순간 작은 동그란 물방울 코어
        if (progress < .42) {
          const coreProgress =
            progress / .42;

          const coreRadius =
            Math.max(
              1.5,
              8.5 *
                (1 - coreProgress * .72),
            );

          const coreGradient =
            ctx.createRadialGradient(
              burst.x - coreRadius * .3,
              burst.y - coreRadius * .72,
              1,
              burst.x,
              burst.y - coreRadius * .24,
              coreRadius,
            );

          coreGradient.addColorStop(
            0,
            "rgba(247,255,255,.99)",
          );
          coreGradient.addColorStop(
            .38,
            "rgba(110,222,250,.97)",
          );
          coreGradient.addColorStop(
            1,
            "rgba(28,140,217,.86)",
          );

          ctx.globalAlpha =
            alpha * .98;
          ctx.fillStyle =
            coreGradient;

          ctx.beginPath();
          ctx.arc(
            burst.x,
            burst.y -
              coreRadius * .38,
            coreRadius,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }

        // 2) 가운데에서 동글동글한 물기둥 3개가 짧게 솟음
        const popPhase =
          Math.sin(
            Math.min(
              1,
              progress * 1.35,
            ) * Math.PI,
          );

        const popStalks = [
          [-.34, .53, .13],
          [0, .82, .16],
          [.34, .52, .13],
        ] as const;

        for (const [
          offset,
          height,
          width,
        ] of popStalks) {
          const stalkX =
            burst.x +
            r * offset;

          const stalkTop =
            burst.y -
            r *
              height *
              popPhase;

          ctx.globalAlpha =
            alpha * .9;
          ctx.strokeStyle =
            "rgba(98,211,248,.95)";
          ctx.lineWidth =
            Math.max(
              2,
              r * width,
            );
          ctx.lineCap =
            "round";

          ctx.beginPath();
          ctx.moveTo(
            stalkX,
            burst.y - 1,
          );
          ctx.quadraticCurveTo(
            stalkX +
              r *
                offset *
                .14,
            burst.y -
              r *
                height *
                .5 *
                popPhase,
            stalkX,
            stalkTop,
          );
          ctx.stroke();

          ctx.fillStyle =
            "rgba(222,252,255,.97)";
          ctx.beginPath();
          ctx.arc(
            stalkX,
            stalkTop,
            Math.max(
              1.7,
              r * width * .65,
            ),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }

        // 3) 좌우로 튀는 둥근 물방울 8개
        for (
          let i = 0;
          i < 8;
          i += 1
        ) {
          const side =
            i < 4 ? -1 : 1;
          const local =
            i % 4;

          const horizontal =
            r *
            (.28 +
              progress * .62 +
              local * .075);

          const vertical =
            r *
            (.18 +
              local * .1) *
            popPhase;

          const dropX =
            burst.x +
            side * horizontal;

          const dropY =
            burst.y -
            vertical -
            2;

          const dropRadius =
            Math.max(
              1.2,
              2.7 -
                progress * 1.35 +
                (local % 2) * .25,
            );

          ctx.globalAlpha =
            alpha *
            (.72 +
              (local % 2) * .14);

          ctx.fillStyle =
            local % 2 === 0
              ? "rgba(231,254,255,.97)"
              : "rgba(79,199,242,.92)";

          ctx.beginPath();
          ctx.ellipse(
            dropX,
            dropY,
            dropRadius,
            dropRadius * 1.12,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }

        // 4) 착지 지점에서 아주 작은 원형 물결이 한 번 퍼짐
        const rippleProgress =
          Math.min(
            1,
            progress * 1.2,
          );

        ctx.globalAlpha =
          alpha * .56;
        ctx.strokeStyle =
          "rgba(173,240,255,.91)";
        ctx.lineWidth =
          Math.max(
            1,
            2.2 - progress,
          );

        ctx.beginPath();
        ctx.ellipse(
          burst.x,
          burst.y + 2,
          6 +
            13 *
              rippleProgress,
          2.3 +
            2.8 *
              rippleProgress,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();

        // 5) 아주 작은 물웅덩이가 잠깐 남았다가 사라짐
        ctx.globalAlpha =
          alpha * .3;
        ctx.fillStyle =
          "rgba(70,186,236,.52)";

        ctx.beginPath();
        ctx.ellipse(
          burst.x,
          burst.y + 3,
          5 +
            9 *
              rippleProgress,
          1.7 +
            1.7 *
              rippleProgress,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.restore();
      }

      for (const b of bubbles) {
        if (!isVisibleOnCamera(b)) continue;
        const radius = b.w / 2;
        const trappedEnemy = b.enemyId
          ? enemies.find((enemy) => enemy.id === b.enemyId && !enemy.dead)
          : undefined;
        const isRiddenBubble = ridingBubbleId === b.id && !trappedEnemy;
        const bubbleCenterX = b.x + radius;
        const bubbleCenterY = b.y + radius;

        ctx.save();
        if (isRiddenBubble) {
          // 탑승 중에는 위쪽이 눌린 듯 세로로 살짝 납작해진다.
          ctx.translate(bubbleCenterX, bubbleCenterY + 5);
          ctx.scale(1.06, .82);
          ctx.translate(-bubbleCenterX, -bubbleCenterY);
        }

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

        // 버블 탑승 시 적용한 scale/translate가 다음 버블 및 다음 프레임으로
        // 절대 누적되지 않도록 반드시 원래 캔버스 상태로 복구한다.
        ctx.restore();
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
        ctx.lineWidth = 8;
        ctx.stroke();

        // 커진 코인에 맞춰 중앙 표시도 확대.
        ctx.fillStyle = "#a46a18";
        ctx.font = "900 54px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("C", 0, 3);
        ctx.textBaseline = "alphabetic";
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
        if (squirrelFallTimer > 0 && !player.grounded && ridingBubbleId === null) {
        // 날다람쥐처럼 몸을 좌우로 펼치고 납작하게 떨어지는 연출.
        ctx.save();
        ctx.translate(
          player.x + player.w / 2,
          player.y + player.h / 2,
        );
        ctx.scale(1.28, 0.72);
        ctx.rotate(player.vx * 0.008);
        ctx.translate(
          -(player.x + player.w / 2),
          -(player.y + player.h / 2),
        );

        drawLizard(
          ctx,
          player.x,
          player.y + 8,
          player.face,
          (now / 130) % 1,
          now - fireAt < 180,
        );

        // 양옆에 펼친 막처럼 보이는 실루엣
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = "#9eddbd";
        ctx.beginPath();
        ctx.moveTo(player.x + 16, player.y + 42);
        ctx.lineTo(player.x - 18, player.y + 58);
        ctx.lineTo(player.x + 18, player.y + 67);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(player.x + player.w - 16, player.y + 42);
        ctx.lineTo(player.x + player.w + 18, player.y + 58);
        ctx.lineTo(player.x + player.w - 18, player.y + 67);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      } else {
        drawLizard(
          ctx,
          player.x,
          player.y,
          player.face,
          (now / 130) % 1,
          now - fireAt < 180,
        );
      }
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

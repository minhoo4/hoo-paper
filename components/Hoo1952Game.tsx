"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Hoo1952GameProps = {
  onExit: () => void;
  onRecordSaved?: () => void;
};

type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind?: "bullet" | "heavy" | "missile" | "support" | "reflected" | "bomb";
  frozenUntil?: number;
  lastBarrierPulseAt?: number;
};
type Enemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  r: number;
  phase: number;
  kind: "fighter" | "bomber" | "boss" | "fortress";
  shotAt: number;
  bombAt: number;
  lastAirstrikeAt: number;
  knockbackUntil?: number;
  lastCollisionAt?: number;
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
};
type UpgradeKind =
  | "spread"
  | "rapid"
  | "homing"
  | "support"
  | "laser"
  | "fan"
  | "barrier"
  | "counter"
  | "artillery"
  | "gravity"
  | "repair";
type PowerUp = { x: number; y: number; vy: number; kind: UpgradeKind };
type MegaBomb = {
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startedAt: number;
};
type MegaBlast = { x: number; y: number; startedAt: number; radius: number };
type EnemyVortex = {
  x: number;
  y: number;
  startX: number;
  startY: number;
  startedAt: number;
  exploded: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export default function Hoo1952Game({ onExit, onRecordSaved }: Hoo1952GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [, setPower] = useState(1);
  const [arsenal, setArsenal] = useState("1·1·0·0·0·0·0·0·0·0");
  const [skillCharges, setSkillCharges] = useState(0);
  const [skillSeconds, setSkillSeconds] = useState(30);
  const [survivalPoints, setSurvivalPoints] = useState(0);
  const [runSeconds, setRunSeconds] = useState(0);
  const restartRef = useRef(0);
  const airstrikeRequestRef = useRef(0);
  const onRecordSavedRef = useRef(onRecordSaved);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    onRecordSavedRef.current = onRecordSaved;
  }, [onRecordSaved]);

  useEffect(() => {
    if (!started) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    let width = 390;
    let height = 760;
    let lowPowerMode = window.matchMedia("(pointer: coarse)").matches;
    let frame = 0;
    let lastTime = performance.now();
    const runStartedAt = lastTime;
    let lastPlayerShot = 0;
    let lastSpawn = 0;
    let lastUiUpdate = 0;
    let lastSurvivalRewardAt = performance.now();
    let currentSurvivalPoints = 0;
    let currentScore = 0;
    let currentLives = 3;
    let currentWave = 1;
    let currentPower = 1;
    let spreadLevel = 1;
    let rapidLevel = 1;
    let homingLevel = 0;
    let supportLevel = 0;
    let laserLevel = 0;
    let fanLevel = 0;
    let barrierLevel = 0;
    let counterLevel = 0;
    let artilleryLevel = 0;
    let gravityLevel = 0;
    let killCount = 0;
    let currentSkillCharges = 0;
    let handledAirstrikeRequests = airstrikeRequestRef.current;
    let lastSkillChargeAt = performance.now();
    let airstrikeStartedAt = -Infinity;
    let airstrikeBlasts: Array<{
      x: number;
      y: number;
      delay: number;
      size: number;
    }> = [];
    let lastLaserAt = performance.now();
    let laserVisibleUntil = 0;
    let laserX = 0;
    let lastBarrierAt = performance.now();
    let barrierPulseAt = -Infinity;
    let lastCounterAt = performance.now();
    let counterPulseAt = -Infinity;
    let lastArtilleryAt = performance.now();
    let lastGravityAt = performance.now();
    let gravityStartedAt = -Infinity;
    let gravityX = width / 2;
    let gravityY = height * 0.3;
    let lastEnemyVortexAt = performance.now() - 4000;
    let lastTwinLaserAt = performance.now();
    let twinLaserStartedAt = -Infinity;
    let lastFanAt = performance.now();
    let fanStartedAt = -Infinity;
    let lastHeavyAt = performance.now();
    let lastSupportVolleyAt = performance.now();
    let invincibleUntil = 0;
    let running = true;
    let dragging = false;
    let bossSpawnedForWave = false;

    const player = { x: width / 2, y: height * 0.82, r: 16 };
    const playerShots: Shot[] = [];
    const enemyShots: Shot[] = [];
    const enemies: Enemy[] = [];
    const particles: Particle[] = [];
    const powerUps: PowerUp[] = [];
    const megaBombs: MegaBomb[] = [];
    const megaBlasts: MegaBlast[] = [];
    const enemyVortices: EnemyVortex[] = [];
    const stars = Array.from({ length: lowPowerMode ? 42 : 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.15 + Math.random() * 0.55,
      size: 0.4 + Math.random() * 1.5,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(300, rect.width);
      height = Math.max(480, rect.height);
      lowPowerMode = window.matchMedia("(pointer: coarse)").matches || width < 520;
      const ratio = lowPowerMode ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      player.x = clamp(player.x, 24, width - 24);
      player.y = clamp(player.y, 90, height - 45);
    };

    const pointerPosition = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * width,
        y: ((event.clientY - rect.top) / rect.height) * height,
      };
    };
    const pointerDown = (event: PointerEvent) => {
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      const position = pointerPosition(event);
      player.x = clamp(position.x, 22, width - 22);
      player.y = clamp(position.y - (event.pointerType === "touch" ? 58 : 0), 90, height - 38);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const position = pointerPosition(event);
      player.x = clamp(position.x, 22, width - 22);
      player.y = clamp(position.y - (event.pointerType === "touch" ? 58 : 0), 90, height - 38);
    };
    const pointerUp = () => { dragging = false; };

    const explode = (x: number, y: number, amount: number) => {
      const particleLimit = lowPowerMode ? 48 : 90;
      const requestedAmount = lowPowerMode ? Math.ceil(amount * 0.55) : amount;
      const allowed = Math.max(0, Math.min(requestedAmount, particleLimit - particles.length));
      for (let index = 0; index < allowed; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 45 + Math.random() * 150;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.25 + Math.random() * 0.45,
          maxLife: 0.7,
          size: 1 + Math.random() * 4,
        });
      }
    };

    const spawnEnemy = (kind: Enemy["kind"] = "fighter") => {
      const boss = kind === "boss";
      const fortress = kind === "fortress";
      const bomber = kind === "bomber";
      const hp = fortress
        ? 420 + currentWave * 70
        : boss
        ? 55 + currentWave * 18
        : bomber
          ? 3 + Math.floor(currentWave * 1.25)
          : 1 + Math.floor((currentWave - 1) / 2);
      enemies.push({
        x: boss || fortress ? width / 2 : 35 + Math.random() * (width - 70),
        y: fortress ? -120 : boss ? -60 : -28,
        vx: fortress ? 34 : boss ? 58 : (Math.random() - 0.5) * (45 + currentWave * 4),
        vy: fortress ? 17 : boss ? 24 : bomber ? 32 + currentWave * 2 : 38 + currentWave * 4 + Math.random() * 18,
        hp,
        maxHp: hp,
        r: fortress ? 88 : boss ? 52 : bomber ? 25 : 16,
        phase: Math.random() * 6,
        kind,
        shotAt: performance.now() + 1400 + Math.random() * 1600,
        bombAt: performance.now() + 2200,
        lastAirstrikeAt: -Infinity,
      });
    };

    const hit = (a: { x: number; y: number; r: number }, b: { x: number; y: number; r: number }) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const radius = a.r + b.r;
      return dx * dx + dy * dy < radius * radius;
    };

    const drawPlane = (x: number, y: number, scale: number, enemy = false) => {
      context.save();
      context.translate(x, y);
      if (enemy) context.rotate(Math.PI);
      context.fillStyle = enemy ? "#5e5e5e" : "#eeeeea";
      context.strokeStyle = enemy ? "#c6c6c0" : "#555";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(0, -22 * scale);
      context.lineTo(8 * scale, -5 * scale);
      context.lineTo(25 * scale, 7 * scale);
      context.lineTo(24 * scale, 13 * scale);
      context.lineTo(7 * scale, 8 * scale);
      context.lineTo(5 * scale, 22 * scale);
      context.lineTo(-5 * scale, 22 * scale);
      context.lineTo(-7 * scale, 8 * scale);
      context.lineTo(-24 * scale, 13 * scale);
      context.lineTo(-25 * scale, 7 * scale);
      context.lineTo(-8 * scale, -5 * scale);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = enemy ? "#191919" : "#777";
      context.fillRect(-2 * scale, -8 * scale, 4 * scale, 23 * scale);
      context.restore();
    };

    const getInterceptorPosition = (index: number, now: number) => {
      const count = Math.max(1, supportLevel * 2);
      const angle = now / 650 + (index / count) * Math.PI * 2;
      const radius = 38 + (index % 2) * 18;
      return {
        x: player.x + Math.cos(angle) * radius,
        y: player.y + 8 + Math.sin(angle) * radius * 0.45,
      };
    };

    const destroyEnemy = (enemyIndex: number) => {
      const enemy = enemies[enemyIndex];
      if (!enemy) return;
      currentScore += enemy.kind === "fortress" ? 3500 : enemy.kind === "boss" ? 1000 : enemy.kind === "bomber" ? 180 : 80;
      explode(enemy.x, enemy.y, enemy.kind === "fortress" ? 70 : enemy.kind === "boss" ? 45 : 14);
      killCount += 1;
      const upgradeRotation: UpgradeKind[] = [
        "spread", "rapid", "homing", "support", "laser", "fan",
        "barrier", "counter", "artillery", "gravity",
      ];
      const kind: UpgradeKind = enemy.kind === "boss" || enemy.kind === "fortress" || killCount % 30 === 0
        ? "repair"
        : upgradeRotation[(killCount - 1) % upgradeRotation.length];
      powerUps.push({ x: enemy.x, y: enemy.y, vy: 62, kind });
      enemies.splice(enemyIndex, 1);
    };

    const triggerAirstrike = (now: number) => {
      airstrikeStartedAt = now;
      airstrikeBlasts = Array.from({ length: lowPowerMode ? 16 : 28 }, (_, index) => ({
        x: 24 + Math.random() * Math.max(1, width - 48),
        y: 90 + Math.random() * Math.max(1, height - 170),
        delay: 220 + index * 34 + Math.random() * 150,
        size: 24 + Math.random() * 48,
      }));
      invincibleUntil = Math.max(invincibleUntil, now + 1900);
    };

    const update = (now: number, delta: number) => {
      frame += delta;
      currentWave = Math.floor(currentScore / 1250) + 1;

      // 생존 랭킹 점수: 매 30초마다 10점, 재플레이도 반복 획득 가능
      while (now - lastSurvivalRewardAt >= 30000) {
        lastSurvivalRewardAt += 30000;
        currentSurvivalPoints += 10;
        setSurvivalPoints(currentSurvivalPoints);

        const previousRankingScore = Number(
          localStorage.getItem("hoo-1952-ranking-score") ?? "0",
        );
        const nextRankingScore = previousRankingScore + 10;
        localStorage.setItem("hoo-1952-ranking-score", String(nextRankingScore));
        window.dispatchEvent(new CustomEvent("hoo:1952-ranking-score", {
          detail: {
            points: 10,
            runPoints: currentSurvivalPoints,
            total: nextRankingScore,
          },
        }));
        onRecordSavedRef.current?.();
      }

      if (currentSkillCharges < 2 && now - lastSkillChargeAt >= 30000) {
        currentSkillCharges += 1;
        lastSkillChargeAt += 30000;
        setSkillCharges(currentSkillCharges);
      }

      const requestedAirstrikes = airstrikeRequestRef.current - handledAirstrikeRequests;
      if (requestedAirstrikes > 0) {
        handledAirstrikeRequests = airstrikeRequestRef.current;
        if (currentSkillCharges > 0) {
          currentSkillCharges -= 1;
          setSkillCharges(currentSkillCharges);
          triggerAirstrike(now);
          if (currentSkillCharges < 2) lastSkillChargeAt = now;
        }
      }

      const activeAirstrikeAge = now - airstrikeStartedAt;
      const isAirstrikeActive = activeAirstrikeAge >= 0 && activeAirstrikeAge < 1900;
      if (isAirstrikeActive) {
        const sweepProgress = clamp(activeAirstrikeAge / 1550, 0, 1);
        const sweepY = height + 170 - sweepProgress * (height + 380);

        for (let index = enemies.length - 1; index >= 0; index -= 1) {
          const enemy = enemies[index];
          if (sweepY <= enemy.y + enemy.r || activeAirstrikeAge > 1600) {
            if (enemy.kind === "boss" || enemy.kind === "fortress") {
              if (enemy.lastAirstrikeAt !== airstrikeStartedAt) {
                enemy.lastAirstrikeAt = airstrikeStartedAt;
                enemy.hp = Math.max(1, enemy.hp - enemy.maxHp * 0.3);
                explode(enemy.x, enemy.y, enemy.kind === "fortress" ? 42 : 26);
              }
              continue;
            }
            currentScore += enemy.kind === "bomber" ? 180 : 80;
            explode(enemy.x, enemy.y, 14);
            enemies.splice(index, 1);
          }
        }

        for (let index = enemyShots.length - 1; index >= 0; index -= 1) {
          const shot = enemyShots[index];
          if (sweepY <= shot.y || activeAirstrikeAge > 1600) {
            explode(shot.x, shot.y, 2);
            enemyShots.splice(index, 1);
          }
        }
      }

      const shotDelay = Math.max(58, 220 - rapidLevel * 28);
      if (now - lastPlayerShot > shotDelay) {
        lastPlayerShot = now;
        const spread = spreadLevel >= 7
          ? [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3]
          : spreadLevel >= 6
            ? [-0.26, -0.155, -0.05, 0.05, 0.155, 0.26]
          : spreadLevel >= 5
          ? [-0.22, -0.11, 0, 0.11, 0.22]
          : spreadLevel >= 4
            ? [-0.16, -0.055, 0.055, 0.16]
            : spreadLevel >= 3
              ? [-0.12, 0, 0.12]
              : spreadLevel >= 2
                ? [-0.055, 0.055]
                : [0];
        spread.forEach((angle) => playerShots.push({
          x: player.x + angle * 50,
          y: player.y - 24,
          vx: angle * 360,
          vy: -560,
          r: 3,
          kind: "bullet",
        }));

        if (homingLevel > 0 && Math.floor(now / 420) !== Math.floor((now - shotDelay) / 420)) {
          for (let index = 0; index < Math.min(3, homingLevel); index += 1) {
            playerShots.push({
              x: player.x + (index - (Math.min(3, homingLevel) - 1) / 2) * 15,
              y: player.y - 18,
              vx: (index - 1) * 35,
              vy: -360,
              r: 5,
              kind: "missile",
            });
          }
        }

      }

      if (spreadLevel >= 3 && now - lastHeavyAt >= Math.max(650, 1450 - rapidLevel * 90)) {
        lastHeavyAt = now;
        playerShots.push({
          x: player.x,
          y: player.y - 28,
          vx: 0,
          vy: -430,
          r: 7,
          kind: "heavy",
        });
      }

      if (supportLevel > 0 && now - lastSupportVolleyAt >= Math.max(260, 700 - supportLevel * 80)) {
        lastSupportVolleyAt = now;
        const interceptorCount = supportLevel * 2;
        for (let index = 0; index < interceptorCount; index += 1) {
          const origin = getInterceptorPosition(index, now);
          let angle = -Math.PI / 2;
          if (enemies.length > 0) {
            let target = enemies[0];
            enemies.forEach((enemy) => {
              if (Math.hypot(enemy.x - origin.x, enemy.y - origin.y) < Math.hypot(target.x - origin.x, target.y - origin.y)) target = enemy;
            });
            angle = Math.atan2(target.y - origin.y, target.x - origin.x);
          }
          playerShots.push({
            x: origin.x, y: origin.y,
            vx: Math.cos(angle) * 390,
            vy: Math.sin(angle) * 390,
            r: 2.5,
            kind: "support",
          });
        }
      }

      if (laserLevel > 0 && now - lastLaserAt >= 3000) {
        lastLaserAt = now;
        laserVisibleUntil = now + 360;
        laserX = player.x;
        const laserWidth = 15 + laserLevel * 5;
        enemies.forEach((enemy) => {
          if (Math.abs(enemy.x - laserX) <= laserWidth + enemy.r) {
            enemy.hp -= 8 + laserLevel * 7;
          }
        });
        for (let index = enemies.length - 1; index >= 0; index -= 1) {
          if (enemies[index].hp <= 0) destroyEnemy(index);
        }
      }

      const fanInterval = Math.max(2800, 4800 - (fanLevel - 1) * 450);
      if (fanLevel > 0 && now - lastFanAt >= fanInterval) {
        lastFanAt = now;
        fanStartedAt = now;
      }

      const fanAge = now - fanStartedAt;
      if (fanAge >= 0 && fanAge < 950) {
        const progress = fanAge / 950;
        const angle = -Math.PI * 0.85 + progress * Math.PI * 0.7;
        const directionX = Math.cos(angle);
        const directionY = Math.sin(angle);
        const beamWidth = 9 + fanLevel * 4;
        enemies.forEach((enemy) => {
          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const projection = dx * directionX + dy * directionY;
          const perpendicular = Math.abs(dx * directionY - dy * directionX);
          if (projection > 0 && perpendicular < beamWidth + enemy.r) {
            enemy.hp -= delta * (11 + fanLevel * 6);
          }
        });
        for (let index = enemies.length - 1; index >= 0; index -= 1) {
          if (enemies[index].hp <= 0) destroyEnemy(index);
        }
      }

      const barrierInterval = 5000;
      if (barrierLevel > 0 && now - lastBarrierAt >= barrierInterval) {
        lastBarrierAt = now;
        barrierPulseAt = now;
      }

      if (counterLevel > 0 && now - lastCounterAt >= 15000) {
        lastCounterAt = now;
        counterPulseAt = now;
        for (let index = enemyShots.length - 1; index >= 0; index -= 1) {
          if (Math.random() >= 0.5) continue;
          const incoming = enemyShots[index];
          let angle = Math.atan2(-incoming.vy, -incoming.vx);
          if (enemies.length > 0) {
            let target = enemies[0];
            enemies.forEach((enemy) => {
              if (Math.hypot(enemy.x - incoming.x, enemy.y - incoming.y) < Math.hypot(target.x - incoming.x, target.y - incoming.y)) target = enemy;
            });
            angle = Math.atan2(target.y - incoming.y, target.x - incoming.x);
          }
          playerShots.push({
            x: incoming.x,
            y: incoming.y,
            vx: Math.cos(angle) * 440,
            vy: Math.sin(angle) * 440,
            r: incoming.kind === "bomb" ? 7 : 4,
            kind: "reflected",
          });
          explode(incoming.x, incoming.y, incoming.kind === "bomb" ? 7 : 3);
          enemyShots.splice(index, 1);
        }
      }

      const artilleryInterval = Math.max(5000, 9000 - (artilleryLevel - 1) * 800);
      if (artilleryLevel > 0 && enemies.length > 0 && now - lastArtilleryAt >= artilleryInterval) {
        lastArtilleryAt = now;
        const targetX = enemies.reduce((sum, enemy) => sum + enemy.x, 0) / enemies.length;
        const targetY = enemies.reduce((sum, enemy) => sum + enemy.y, 0) / enemies.length;
        megaBombs.push({
          x: player.x,
          y: player.y - 24,
          startX: player.x,
          startY: player.y - 24,
          targetX: clamp(targetX, 45, width - 45),
          targetY: clamp(targetY, 100, height * 0.65),
          startedAt: now,
        });
      }

      for (let index = megaBombs.length - 1; index >= 0; index -= 1) {
        const bomb = megaBombs[index];
        const progress = clamp((now - bomb.startedAt) / 820, 0, 1);
        bomb.x = bomb.startX + (bomb.targetX - bomb.startX) * progress;
        bomb.y = bomb.startY + (bomb.targetY - bomb.startY) * progress - Math.sin(progress * Math.PI) * 130;
        if (progress >= 1) {
          const radius = 90 + artilleryLevel * 18;
          const damage = 14 + artilleryLevel * 10;
          megaBlasts.push({ x: bomb.targetX, y: bomb.targetY, startedAt: now, radius });
          explode(bomb.targetX, bomb.targetY, 45);
          for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
            const enemy = enemies[enemyIndex];
            if (Math.hypot(enemy.x - bomb.targetX, enemy.y - bomb.targetY) <= radius + enemy.r) {
              enemy.hp -= damage;
              if (enemy.hp <= 0) destroyEnemy(enemyIndex);
            }
          }
          megaBombs.splice(index, 1);
        }
      }
      for (let index = megaBlasts.length - 1; index >= 0; index -= 1) {
        if (now - megaBlasts[index].startedAt > 800) megaBlasts.splice(index, 1);
      }

      // 플레이어 기본 필살기: 5초마다 양 날개에서 1초간 쌍레이저 발사
      if (now - lastTwinLaserAt >= 5000) {
        lastTwinLaserAt = now;
        twinLaserStartedAt = now;
      }

      const twinLaserAge = now - twinLaserStartedAt;
      if (twinLaserAge >= 0 && twinLaserAge < 1000) {
        const wingOffset = 18;
        const beamWidth = 8;
        const destroyed: Array<{ x: number; y: number; maxHp: number }> = [];

        for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
          const enemy = enemies[enemyIndex];
          const insideLeft = Math.abs(enemy.x - (player.x - wingOffset)) <= beamWidth + enemy.r;
          const insideRight = Math.abs(enemy.x - (player.x + wingOffset)) <= beamWidth + enemy.r;
          if (!insideLeft && !insideRight) continue;

          const damage = enemy.kind === "boss" || enemy.kind === "fortress"
            ? enemy.maxHp * delta * 0.22
            : enemy.maxHp + 1;
          enemy.hp -= damage;
          if (enemy.hp <= 0) {
            destroyed.push({ x: enemy.x, y: enemy.y, maxHp: enemy.maxHp });
            destroyEnemy(enemyIndex);
          }
        }

        // 레이저로 터진 적의 폭발은 주변 적에게 최대 체력의 50% 피해
        destroyed.forEach((blast) => {
          explode(blast.x, blast.y, 24);
          for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
            const enemy = enemies[enemyIndex];
            if (Math.hypot(enemy.x - blast.x, enemy.y - blast.y) > 62 + enemy.r) continue;
            enemy.hp -= enemy.kind === "boss" || enemy.kind === "fortress"
              ? enemy.maxHp * 0.08
              : enemy.maxHp * 0.5;
            if (enemy.hp <= 0) destroyEnemy(enemyIndex);
          }
        });
      }

      if (gravityLevel > 0 && now - lastGravityAt >= 20000) {
        lastGravityAt = now;
        gravityStartedAt = now;
        gravityX = enemies.length > 0
          ? enemies.reduce((sum, enemy) => sum + enemy.x, 0) / enemies.length
          : player.x;
        gravityY = enemies.length > 0
          ? enemies.reduce((sum, enemy) => sum + enemy.y, 0) / enemies.length
          : height * 0.32;
        gravityX = clamp(gravityX, 55, width - 55);
        gravityY = clamp(gravityY, 110, height * 0.58);
      }

      const spawnDelay = Math.max(380, 1250 - (currentWave - 1) * 85);
      const enemyLimit = Math.min(14, 3 + Math.ceil(currentWave * 1.35));
      if (!isAirstrikeActive && now - lastSpawn > spawnDelay && enemies.length < enemyLimit) {
        lastSpawn = now;
        spawnEnemy(Math.random() < 0.18 ? "bomber" : "fighter");
      }
      if (!isAirstrikeActive && currentScore > 0 && currentScore % 1250 < 100 && !bossSpawnedForWave) {
        bossSpawnedForWave = true;
        spawnEnemy(currentWave % 5 === 0 ? "fortress" : "boss");
      }
      if (currentScore % 1250 > 280) bossSpawnedForWave = false;

      // 적 중력 폭발: 보스전 또는 4웨이브부터 중앙에 중력탄 투척
      const vortexCaster = enemies.find((enemy) =>
        enemy.kind === "fortress" || enemy.kind === "boss" ||
        (currentWave >= 4 && enemy.kind === "bomber"),
      );
      const enemyVortexInterval = Math.max(8500, 15000 - currentWave * 320);
      if (
        vortexCaster &&
        enemyVortices.length === 0 &&
        now - lastEnemyVortexAt >= enemyVortexInterval &&
        !isAirstrikeActive
      ) {
        lastEnemyVortexAt = now;
        enemyVortices.push({
          x: vortexCaster.x,
          y: vortexCaster.y,
          startX: vortexCaster.x,
          startY: vortexCaster.y,
          startedAt: now,
          exploded: false,
        });
      }

      playerShots.forEach((shot) => {
        if ((shot.kind === "missile" || shot.kind === "support" || shot.kind === "reflected") && enemies.length > 0) {
          let target = enemies[0];
          let distance = Infinity;
          enemies.forEach((enemy) => {
            const nextDistance = Math.hypot(enemy.x - shot.x, enemy.y - shot.y);
            if (nextDistance < distance) {
              distance = nextDistance;
              target = enemy;
            }
          });
          const angle = Math.atan2(target.y - shot.y, target.x - shot.x);
          const speed = shot.kind === "missile" ? 430 : shot.kind === "reflected" ? 440 : 390;
          const turn = Math.min(1, delta * (shot.kind === "missile" ? 7 : shot.kind === "reflected" ? 5 : 4));
          shot.vx += (Math.cos(angle) * speed - shot.vx) * turn;
          shot.vy += (Math.sin(angle) * speed - shot.vy) * turn;
        }
        shot.x += shot.vx * delta;
        shot.y += shot.vy * delta;
      });
      enemyShots.forEach((shot) => {
        const pulseAge = now - barrierPulseAt;
        if (pulseAge >= 0 && pulseAge < 700) {
          const pulseProgress = pulseAge / 700;
          const pulseRadius = 20 + pulseProgress * Math.max(width, height) * 1.05;
          const distanceFromPlayer = Math.hypot(shot.x - player.x, shot.y - player.y);
          if (
            distanceFromPlayer <= pulseRadius + 24 &&
            shot.lastBarrierPulseAt !== barrierPulseAt
          ) {
            shot.lastBarrierPulseAt = barrierPulseAt;
            shot.frozenUntil = now + 1000;
          }
        }

        if (!shot.frozenUntil || now >= shot.frozenUntil) {
          shot.x += shot.vx * delta;
          shot.y += shot.vy * delta;
        }
      });
      powerUps.forEach((item) => { item.y += item.vy * delta; });
      particles.forEach((particle) => {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vy += 40 * delta;
        particle.life -= delta;
      });

      enemies.forEach((enemy) => {
        enemy.phase += delta * 2;
        enemy.x += (enemy.vx + Math.sin(enemy.phase) * (enemy.kind === "fortress" ? 15 : enemy.kind === "boss" ? 45 : 22)) * delta;
        enemy.y += enemy.vy * delta;
        if (enemy.x < enemy.r || enemy.x > width - enemy.r) enemy.vx *= -1;
        if (enemy.kind === "boss" && enemy.y > 105) enemy.vy = 0;
        if (enemy.kind === "fortress" && enemy.y > 135) enemy.vy = 0;
        const canFire = enemy.kind === "boss" || enemy.kind === "fortress" ||
          (enemy.kind === "bomber" && currentWave >= 2) ||
          currentWave >= 3;
        if (!isAirstrikeActive && canFire && now > enemy.shotAt && enemy.y > 0) {
          enemy.shotAt = now + (enemy.kind === "fortress"
            ? 240
            : enemy.kind === "boss"
            ? Math.max(390, 720 - currentWave * 22)
            : Math.max(850, 2100 - currentWave * 85) + Math.random() * 700);
          const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          const count = enemy.kind === "fortress"
            ? 7
            : enemy.kind === "boss"
            ? currentWave >= 5 ? 3 : currentWave >= 3 ? 2 : 1
            : 1;
          for (let index = 0; index < count; index += 1) {
            const offset = (index - (count - 1) / 2) * (enemy.kind === "fortress" ? 0.22 : 0.18);
            enemyShots.push({
              x: enemy.x, y: enemy.y + enemy.r,
              vx: Math.cos(angle + offset) * (88 + currentWave * 7),
              vy: Math.sin(angle + offset) * (88 + currentWave * 7),
              r: 5,
            });
          }
        }

        if (!isAirstrikeActive && enemy.kind === "fortress" && now > enemy.bombAt && enemy.y > 0) {
          enemy.bombAt = now + Math.max(850, 1450 - currentWave * 25);
          const bombCount = Math.min(14, 8 + Math.floor(currentWave / 2));
          for (let index = 0; index < bombCount; index += 1) {
            const angle = (index / bombCount) * Math.PI * 2 + enemy.phase * 0.16;
            const speed = 72 + currentWave * 3 + (index % 3) * 12;
            enemyShots.push({
              x: enemy.x,
              y: enemy.y + 22,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              r: 11,
              kind: "bomb",
            });
          }
        }
      });

      const gravityAge = now - gravityStartedAt;
      const gravityDuration = 4000 + gravityLevel * 180;
      if (gravityAge >= 0 && gravityAge < gravityDuration) {
        const pullStrength = 125 + gravityLevel * 42;
        enemyShots.forEach((shot) => {
          const dx = gravityX - shot.x;
          const dy = gravityY - shot.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const pull = Math.min(distance, pullStrength * delta * (1 + 150 / distance));
          shot.x += (dx / distance) * pull;
          shot.y += (dy / distance) * pull;
        });
        enemies.forEach((enemy) => {
          const dx = gravityX - enemy.x;
          const dy = gravityY - enemy.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const resistance = enemy.kind === "fortress" ? 0.035 : enemy.kind === "boss" ? 0.1 : 0.65;
          const pull = Math.min(distance, pullStrength * delta * resistance * (1 + 110 / distance));
          enemy.x += (dx / distance) * pull;
          enemy.y += (dy / distance) * pull;
        });
      }

      // 적 중력탄: 비행 → 흡입 → 전방 충격파
      for (let vortexIndex = enemyVortices.length - 1; vortexIndex >= 0; vortexIndex -= 1) {
        const vortex = enemyVortices[vortexIndex];
        const age = now - vortex.startedAt;
        const flightDuration = 650;
        const explodeAt = 2350;

        if (age < flightDuration) {
          const progress = clamp(age / flightDuration, 0, 1);
          vortex.x = vortex.startX + (width / 2 - vortex.startX) * progress;
          vortex.y = vortex.startY + (height * 0.43 - vortex.startY) * progress - Math.sin(progress * Math.PI) * 42;
        } else if (age < explodeAt) {
          const pullStrength = 185 + currentWave * 7;
          enemyShots.forEach((shot) => {
            const dx = vortex.x - shot.x;
            const dy = vortex.y - shot.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            if (distance > 250) return;
            const pull = Math.min(distance, pullStrength * delta * (1 + 115 / distance));
            shot.x += (dx / distance) * pull;
            shot.y += (dy / distance) * pull;
          });
          enemies.forEach((enemy) => {
            const dx = vortex.x - enemy.x;
            const dy = vortex.y - enemy.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            if (distance > 265) return;
            const resistance = enemy.kind === "fortress" ? 0.02 : enemy.kind === "boss" ? 0.07 : 0.72;
            const pull = Math.min(distance, pullStrength * delta * resistance * (1 + 95 / distance));
            enemy.x += (dx / distance) * pull;
            enemy.y += (dy / distance) * pull;
          });
        } else if (!vortex.exploded) {
          vortex.exploded = true;
          explode(vortex.x, vortex.y, 58);

          enemyShots.forEach((shot) => {
            const dx = shot.x - vortex.x;
            const dy = shot.y - vortex.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const side = dx / distance;
            shot.vx = side * (130 + currentWave * 4);
            shot.vy = 245 + currentWave * 8 + Math.max(0, dy / distance) * 70;
          });

          enemies.forEach((enemy) => {
            if (enemy.kind === "boss" || enemy.kind === "fortress") return;
            const dx = enemy.x - vortex.x;
            const distance = Math.max(1, Math.hypot(dx, enemy.y - vortex.y));
            enemy.vx = (dx / distance) * (150 + currentWave * 6);
            enemy.vy = 220 + currentWave * 7;
            enemy.knockbackUntil = now + 1150;
          });
        }

        if (age > 3000) enemyVortices.splice(vortexIndex, 1);
      }

      // 중력 폭발로 날아간 적끼리 충돌하면 서로 피해
      const collisionDamage = new Map<Enemy, number>();
      for (let firstIndex = 0; firstIndex < enemies.length; firstIndex += 1) {
        const first = enemies[firstIndex];
        if (!first.knockbackUntil || now >= first.knockbackUntil) continue;
        for (let secondIndex = firstIndex + 1; secondIndex < enemies.length; secondIndex += 1) {
          const second = enemies[secondIndex];
          if (!hit(first, second)) continue;
          const lastCollision = Math.max(first.lastCollisionAt ?? 0, second.lastCollisionAt ?? 0);
          if (now - lastCollision < 180) continue;
          first.lastCollisionAt = now;
          second.lastCollisionAt = now;
          collisionDamage.set(first, (collisionDamage.get(first) ?? 0) + first.maxHp * 0.34);
          collisionDamage.set(second, (collisionDamage.get(second) ?? 0) + second.maxHp * 0.34);
          const impactX = (first.x + second.x) / 2;
          const impactY = (first.y + second.y) / 2;
          explode(impactX, impactY, 18);
          const swapVx = first.vx;
          first.vx = second.vx * 0.7;
          second.vx = swapVx * 0.7;
        }
      }
      for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
        const damage = collisionDamage.get(enemies[enemyIndex]);
        if (!damage) continue;
        enemies[enemyIndex].hp -= damage;
        if (enemies[enemyIndex].hp <= 0) destroyEnemy(enemyIndex);
      }

      for (let shotIndex = playerShots.length - 1; shotIndex >= 0; shotIndex -= 1) {
        const shot = playerShots[shotIndex];
        if (shot.y < -30 || shot.y > height + 30 || shot.x < -40 || shot.x > width + 40) {
          playerShots.splice(shotIndex, 1);
          continue;
        }
        for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
          const enemy = enemies[enemyIndex];
          if (!hit(shot, enemy)) continue;
          playerShots.splice(shotIndex, 1);
          enemy.hp -= shot.kind === "reflected" ? 3 + counterLevel * 2 : shot.kind === "heavy" ? 5 : shot.kind === "missile" ? 3 : 1;
          if (enemy.hp <= 0) {
            destroyEnemy(enemyIndex);
          }
          break;
        }
      }

      const damagePlayer = (x: number, y: number) => {
        if (now < invincibleUntil) return;
        currentLives -= 1;
        invincibleUntil = now + 1600;
        explode(x, y, 28);
        if (currentLives <= 0) {
          running = false;
          setScore(currentScore);
          setLives(0);
          setRunSeconds(Math.floor((now - runStartedAt) / 1000));
          setGameOver(true);
        }
      };

      for (let shotIndex = enemyShots.length - 1; shotIndex >= 0; shotIndex -= 1) {
        const bomb = enemyShots[shotIndex];
        if (bomb.kind !== "bomb") continue;
        let detonated = false;
        for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
          const target = enemies[enemyIndex];
          if (target.kind === "boss" || target.kind === "fortress") continue;
          if (!hit(bomb, target)) continue;
          target.hp -= 20;
          explode(bomb.x, bomb.y, 18);
          enemyShots.splice(shotIndex, 1);
          detonated = true;
          if (target.hp <= 0) destroyEnemy(enemyIndex);
          break;
        }
        if (detonated) continue;
      }

      for (let index = enemyShots.length - 1; index >= 0; index -= 1) {
        const shot = enemyShots[index];
        if (shot.y < -30 || shot.y > height + 20 || shot.x < -20 || shot.x > width + 20) { enemyShots.splice(index, 1); continue; }
        if (hit(shot, player)) { enemyShots.splice(index, 1); damagePlayer(player.x, player.y); }
      }
      for (let index = enemies.length - 1; index >= 0; index -= 1) {
        const enemy = enemies[index];
        if (hit(enemy, player)) { enemies.splice(index, 1); damagePlayer(player.x, player.y); }
        else if (enemy.y > height + 80) enemies.splice(index, 1);
      }
      for (let index = powerUps.length - 1; index >= 0; index -= 1) {
        const item = powerUps[index];
        if (Math.hypot(item.x - player.x, item.y - player.y) < 30) {
          if (item.kind === "spread") spreadLevel = Math.min(7, spreadLevel + 1);
          if (item.kind === "rapid") rapidLevel = Math.min(8, rapidLevel + 1);
          if (item.kind === "homing") homingLevel = Math.min(5, homingLevel + 1);
          if (item.kind === "support") supportLevel = Math.min(4, supportLevel + 1);
          if (item.kind === "laser") laserLevel = Math.min(5, laserLevel + 1);
          if (item.kind === "fan") fanLevel = Math.min(5, fanLevel + 1);
          if (item.kind === "barrier") barrierLevel = Math.min(5, barrierLevel + 1);
          if (item.kind === "counter") counterLevel = Math.min(5, counterLevel + 1);
          if (item.kind === "artillery") artilleryLevel = Math.min(5, artilleryLevel + 1);
          if (item.kind === "gravity") gravityLevel = Math.min(5, gravityLevel + 1);
          if (item.kind === "repair") currentLives = Math.min(5, currentLives + 1);
          currentPower = spreadLevel + rapidLevel + homingLevel + supportLevel + laserLevel + fanLevel + barrierLevel + counterLevel + artilleryLevel + gravityLevel - 1;
          powerUps.splice(index, 1);
        } else if (item.y > height + 20) powerUps.splice(index, 1);
      }
      for (let index = particles.length - 1; index >= 0; index -= 1) if (particles[index].life <= 0) particles.splice(index, 1);

      const playerShotLimit = lowPowerMode ? 170 : 300;
      const enemyShotLimit = lowPowerMode ? 190 : 320;
      if (playerShots.length > playerShotLimit) {
        playerShots.splice(0, playerShots.length - playerShotLimit);
      }
      if (enemyShots.length > enemyShotLimit) {
        enemyShots.splice(0, enemyShots.length - enemyShotLimit);
      }

      if (now - lastUiUpdate > (lowPowerMode ? 200 : 120)) {
        lastUiUpdate = now;
        setScore(currentScore);
        setLives(currentLives);
        setWave(currentWave);
        setRunSeconds(Math.floor((now - runStartedAt) / 1000));
        setPower(currentPower);
        setArsenal(`${spreadLevel}·${rapidLevel}·${homingLevel}·${supportLevel}·${laserLevel}·${fanLevel}·${barrierLevel}·${counterLevel}·${artilleryLevel}·${gravityLevel}`);
        setSkillSeconds(
          currentSkillCharges >= 2
            ? 0
            : Math.max(0, Math.ceil((30000 - (now - lastSkillChargeAt)) / 1000)),
        );
      }
    };

    const draw = (now: number) => {
      context.fillStyle = "#111";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#272727";
      for (const star of stars) {
        const y = ((star.y * height + frame * star.speed * 80) % height);
        context.globalAlpha = 0.25 + star.speed * 0.45;
        context.fillRect(star.x * width, y, star.size, star.size * 3);
      }
      context.globalAlpha = 1;

      context.strokeStyle = "rgba(255,255,255,.07)";
      context.lineWidth = 1;
      for (let y = 80; y < height; y += 54) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y - 20); context.stroke();
      }

      enemyVortices.forEach((vortex) => {
        const age = now - vortex.startedAt;
        context.save();
        context.translate(vortex.x, vortex.y);

        if (age < 2350) {
          const suctionProgress = clamp((age - 650) / 1700, 0, 1);
          context.rotate(now / 280);
          for (let ring = 0; ring < 4; ring += 1) {
            context.globalAlpha = 0.2 + ring * 0.12;
            context.strokeStyle = ring % 2 === 0 ? "#fff" : "#777";
            context.lineWidth = 1.5 + ring;
            context.beginPath();
            context.ellipse(0, 0, 28 + ring * 17 + suctionProgress * 12, 11 + ring * 9, ring * 0.7, 0, Math.PI * 2);
            context.stroke();
          }
          context.globalAlpha = 1;
          context.shadowColor = "#fff";
          context.shadowBlur = 22;
          const vortexGradient = context.createRadialGradient(-7, -8, 2, 0, 0, 29);
          vortexGradient.addColorStop(0, "#686868");
          vortexGradient.addColorStop(0.24, "#101010");
          vortexGradient.addColorStop(1, "#000");
          context.fillStyle = vortexGradient;
          context.beginPath();
          context.arc(0, 0, 29 + Math.sin(now / 80) * 3, 0, Math.PI * 2);
          context.fill();
        } else {
          const blastProgress = clamp((age - 2350) / 650, 0, 1);
          context.globalAlpha = 1 - blastProgress;
          context.shadowColor = "#fff";
          context.shadowBlur = lowPowerMode ? 10 : 30;
          context.strokeStyle = "#fff";
          context.lineWidth = 8 - blastProgress * 6;
          context.beginPath();
          context.arc(0, 0, 28 + blastProgress * 245, 0, Math.PI * 2);
          context.stroke();
          context.fillStyle = "rgba(255,255,255,.16)";
          context.beginPath();
          context.ellipse(0, 85 + blastProgress * 90, 95 + blastProgress * 150, 175 + blastProgress * 190, 0, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
      });

      playerShots.forEach((shot) => {
        context.fillStyle = shot.kind === "heavy" ? "#fff" : shot.kind === "missile" ? "#d8d8d8" : "#fff";
        context.shadowColor = "#fff"; context.shadowBlur = 7;
        if (shot.kind === "heavy") {
          context.shadowBlur = 15;
          context.fillRect(shot.x - 5, shot.y - 16, 10, 25);
          context.strokeStyle = "rgba(255,255,255,.55)";
          context.strokeRect(shot.x - 8, shot.y - 19, 16, 31);
        } else if (shot.kind === "missile") {
          context.beginPath();
          context.arc(shot.x, shot.y, 5, 0, Math.PI * 2);
          context.fill();
        } else if (shot.kind === "reflected") {
          context.shadowBlur = 18;
          context.beginPath();
          context.arc(shot.x, shot.y, shot.r + 2, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = "#777";
          context.lineWidth = 3;
          context.beginPath();
          context.arc(shot.x, shot.y, shot.r + 7, 0, Math.PI * 2);
          context.stroke();
        } else if (shot.kind === "support") {
          context.beginPath();
          context.arc(shot.x, shot.y, 2.5, 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillRect(shot.x - 1.5, shot.y - 9, 3, 15);
        }
      });
      context.shadowBlur = 0;
      enemyShots.forEach((shot) => {
        context.fillStyle = shot.kind === "bomb" ? "#dedede" : "#ad2020";
        context.shadowColor = "#ff3030"; context.shadowBlur = 7;
        if (shot.kind === "bomb") {
          context.save();
          context.translate(shot.x, shot.y);
          context.rotate(Math.atan2(shot.vy, shot.vx) + Math.PI / 2);
          context.beginPath();
          context.ellipse(0, 0, 8, 15, 0, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#333";
          context.fillRect(-7, -14, 14, 5);
          context.restore();
        } else {
          context.beginPath(); context.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2); context.fill();
        }
        if (shot.frozenUntil && now < shot.frozenUntil) {
          context.save();
          context.globalAlpha = 0.75 + Math.sin(now / 55) * 0.2;
          context.strokeStyle = "#fff";
          context.lineWidth = 2;
          context.shadowColor = "#fff";
          context.shadowBlur = 12;
          context.beginPath();
          context.arc(shot.x, shot.y, shot.r + 7, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }
      });
      context.shadowBlur = 0;

      enemies.forEach((enemy) => {
        drawPlane(enemy.x, enemy.y, enemy.kind === "fortress" ? 3.8 : enemy.kind === "boss" ? 2.3 : enemy.kind === "bomber" ? 1.25 : 0.8, true);
        if (enemy.kind === "fortress") {
          context.fillStyle = "#222";
          [-58, -28, 28, 58].forEach((offset) => {
            context.beginPath();
            context.arc(enemy.x + offset, enemy.y - 5, 10, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = "#ddd";
            context.stroke();
          });
        }
        if (enemy.kind === "boss" || enemy.kind === "fortress") {
          const barWidth = enemy.kind === "fortress" ? 190 : 110;
          const barY = enemy.y - (enemy.kind === "fortress" ? 118 : 70);
          context.fillStyle = "rgba(255,255,255,.15)";
          context.fillRect(enemy.x - barWidth / 2, barY, barWidth, 6);
          context.fillStyle = "#c8c8c8";
          context.fillRect(enemy.x - barWidth / 2, barY, barWidth * (enemy.hp / enemy.maxHp), 6);
        }
      });
      powerUps.forEach((item) => {
        const itemLabel: Record<UpgradeKind, string> = {
          spread: "M", rapid: "R", homing: "H", support: "S",
          laser: "L", fan: "F", barrier: "B", counter: "C",
          artillery: "A", gravity: "G", repair: "+",
        };
        context.fillStyle = item.kind === "repair" ? "#fff" : "#bbb";
        context.strokeStyle = "#111"; context.lineWidth = 2;
        context.beginPath(); context.arc(item.x, item.y, 13, 0, Math.PI * 2); context.fill(); context.stroke();
        context.fillStyle = "#111"; context.font = "900 13px monospace"; context.textAlign = "center";
        context.fillText(itemLabel[item.kind], item.x, item.y + 5);
      });
      particles.forEach((particle) => {
        context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
        context.fillStyle = particle.size > 2.5 ? "#eee" : "#666";
        context.fillRect(particle.x, particle.y, particle.size, particle.size);
      });
      context.globalAlpha = 1;

      const airstrikeAge = now - airstrikeStartedAt;
      if (airstrikeAge >= 0 && airstrikeAge < 1900) {
        const progress = clamp(airstrikeAge / 1550, 0, 1);
        context.save();

        airstrikeBlasts.forEach((blast) => {
          const blastAge = airstrikeAge - blast.delay;
          if (blastAge > -230 && blastAge < 0) {
            const fallProgress = 1 + blastAge / 230;
            context.globalAlpha = 0.85;
            context.fillStyle = "#d7d7d7";
            context.beginPath();
            context.ellipse(
              blast.x,
              blast.y - (1 - fallProgress) * 105,
              3.5,
              9,
              0,
              0,
              Math.PI * 2,
            );
            context.fill();
          }

          if (blastAge >= 0 && blastAge < 580) {
            const blastProgress = blastAge / 580;
            const radius = blast.size * (0.35 + blastProgress * 1.2);
            context.globalAlpha = 1;
            if (lowPowerMode) {
              context.fillStyle = `rgba(225,225,225,${Math.max(0, 0.72 - blastProgress * 0.68)})`;
            } else {
              const gradient = context.createRadialGradient(
                blast.x, blast.y, 0,
                blast.x, blast.y, radius,
              );
              gradient.addColorStop(0, `rgba(255,255,255,${1 - blastProgress})`);
              gradient.addColorStop(0.2, `rgba(225,225,225,${0.9 - blastProgress * 0.8})`);
              gradient.addColorStop(0.55, `rgba(105,105,105,${0.75 - blastProgress * 0.65})`);
              gradient.addColorStop(1, "rgba(0,0,0,0)");
              context.fillStyle = gradient;
            }
            context.beginPath();
            context.arc(blast.x, blast.y, radius, 0, Math.PI * 2);
            context.fill();

            context.globalAlpha = Math.max(0, 0.75 - blastProgress);
            context.strokeStyle = "#fff";
            context.lineWidth = 2;
            context.beginPath();
            context.arc(blast.x, blast.y, radius * 1.3, 0, Math.PI * 2);
            context.stroke();
          }
        });

        const bomberX = width / 2 + Math.sin(progress * Math.PI) * width * 0.06;
        const bomberY = height + 170 - progress * (height + 380);
        context.globalAlpha = 0.42;
        context.strokeStyle = "#fff";
        context.lineWidth = 8;
        [-37, 37].forEach((offset) => {
          context.beginPath();
          context.moveTo(bomberX + offset, bomberY + 55);
          context.lineTo(bomberX + offset, bomberY + 230);
          context.stroke();
        });
        context.globalAlpha = 1;
        context.shadowColor = "#fff";
        context.shadowBlur = lowPowerMode ? 10 : 28;
        drawPlane(bomberX, bomberY, 2.85, false);
        context.shadowBlur = 0;

        if (airstrikeAge < 240) {
          context.globalAlpha = (1 - airstrikeAge / 240) * 0.38;
          context.fillStyle = "#fff";
          context.fillRect(0, 0, width, height);
        }
        context.restore();
      }

      if (now >= invincibleUntil || Math.floor(now / 90) % 2 === 0) drawPlane(player.x, player.y, 0.9, false);

      const twinChargeAge = now - lastTwinLaserAt;
      if (twinChargeAge >= 4300 && twinChargeAge < 5000) {
        const chargeProgress = (twinChargeAge - 4300) / 700;
        context.save();
        [-18, 18].forEach((offset) => {
          const pulseRadius = 5 + chargeProgress * 9 + Math.sin(now / 45) * 2;
          context.globalAlpha = 0.45 + chargeProgress * 0.5;
          context.fillStyle = "#fff";
          context.shadowColor = "#fff";
          context.shadowBlur = 12 + chargeProgress * 28;
          context.beginPath();
          context.arc(player.x + offset, player.y - 3, pulseRadius, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = "rgba(255,255,255,.7)";
          context.lineWidth = 2;
          context.beginPath();
          context.arc(player.x + offset, player.y - 3, pulseRadius + 8 + chargeProgress * 10, 0, Math.PI * 2);
          context.stroke();
        });
        context.restore();
      }

      const twinDrawAge = now - twinLaserStartedAt;
      if (twinDrawAge >= 0 && twinDrawAge < 1000) {
        const attackFade = Math.min(1, twinDrawAge / 100, (1000 - twinDrawAge) / 180);
        context.save();
        context.globalAlpha = clamp(attackFade, 0, 1);
        context.lineCap = "round";
        [-18, 18].forEach((offset) => {
          const beamX = player.x + offset;
          context.strokeStyle = "rgba(255,255,255,.22)";
          context.lineWidth = 27;
          context.shadowColor = "#fff";
          context.shadowBlur = lowPowerMode ? 12 : 32;
          context.beginPath();
          context.moveTo(beamX, player.y - 5);
          context.lineTo(beamX, -30);
          context.stroke();
          context.strokeStyle = "#fff";
          context.lineWidth = 8 + Math.sin(now / 45) * 1.8;
          context.beginPath();
          context.moveTo(beamX, player.y - 5);
          context.lineTo(beamX, -30);
          context.stroke();
        });
        context.restore();
      }

      if (supportLevel > 0) {
        const interceptorCount = supportLevel * 2;
        for (let index = 0; index < interceptorCount; index += 1) {
          const position = getInterceptorPosition(index, now);
          drawPlane(position.x, position.y, 0.25, false);
        }
      }

      if (now < laserVisibleUntil) {
        const laserAlpha = clamp((laserVisibleUntil - now) / 360, 0, 1);
        const laserWidth = 8 + laserLevel * 4;
        context.save();
        context.globalAlpha = laserAlpha;
        context.shadowColor = "#fff";
        context.shadowBlur = lowPowerMode ? 10 : 24;
        context.fillStyle = "rgba(255,255,255,.92)";
        context.fillRect(laserX - laserWidth / 2, 0, laserWidth, player.y - 18);
        context.fillStyle = "rgba(255,255,255,.35)";
        context.fillRect(laserX - laserWidth, 0, laserWidth * 2, player.y - 18);
        context.restore();
      }

      const fanDrawAge = now - fanStartedAt;
      if (fanDrawAge >= 0 && fanDrawAge < 950) {
        const progress = fanDrawAge / 950;
        const beamLength = Math.max(width, height) * 1.35;
        context.save();
        context.lineCap = "round";
        for (let trail = 7; trail >= 0; trail -= 1) {
          const trailProgress = Math.max(0, progress - trail * 0.018);
          const angle = -Math.PI * 0.85 + trailProgress * Math.PI * 0.7;
          const alpha = trail === 0 ? 0.96 : (8 - trail) * 0.035;
          context.globalAlpha = alpha;
          context.strokeStyle = trail === 0 ? "#fff" : "#aaa";
          context.lineWidth = trail === 0 ? 7 + fanLevel * 2.2 : 3 + fanLevel;
          context.shadowColor = "#fff";
          context.shadowBlur = trail === 0 ? 24 : 10;
          context.beginPath();
          context.moveTo(player.x, player.y - 12);
          context.lineTo(
            player.x + Math.cos(angle) * beamLength,
            player.y - 12 + Math.sin(angle) * beamLength,
          );
          context.stroke();
        }
        context.restore();
      }

      const pulseAge = now - barrierPulseAt;
      if (pulseAge >= 0 && pulseAge < 700) {
        const progress = pulseAge / 700;
        context.save();
        context.globalAlpha = 1 - progress;
        context.strokeStyle = "#fff";
        context.lineWidth = 5 - progress * 3;
        context.shadowColor = "#fff";
        context.shadowBlur = 18;
        context.beginPath();
        context.arc(player.x, player.y, 20 + progress * Math.max(width, height) * 1.05, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }

      const counterAge = now - counterPulseAt;
      if (counterAge >= 0 && counterAge < 850) {
        const progress = counterAge / 850;
        context.save();
        context.globalAlpha = 1 - progress;
        context.strokeStyle = "#fff";
        context.lineWidth = 7 - progress * 4;
        context.shadowColor = "#fff";
        context.shadowBlur = lowPowerMode ? 10 : 22;
        context.beginPath();
        context.arc(player.x, player.y, 32 + progress * Math.max(width, height) * 0.95, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([12, 16]);
        context.beginPath();
        context.arc(player.x, player.y, 55 + progress * Math.max(width, height) * 0.75, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }

      // 화면 스캔라인은 바깥 CSS 오버레이가 담당하므로 캔버스 반복 드로잉은 생략
      if (!lowPowerMode && Math.random() < 0.07) {
        context.fillStyle = "rgba(255,255,255,.12)";
        context.fillRect(Math.random() * width, 0, 1, height);
      }
    };

    const loop = (now: number) => {
      const delta = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;
      if (running) update(now, delta);
      draw(now);
      if (running) requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    setScore(0); setLives(3); setWave(1); setPower(1); setArsenal("1·1·0·0·0·0·0·0·0·0");
    setSkillCharges(0); setSkillSeconds(30); setSurvivalPoints(0); setRunSeconds(0); setGameOver(false);
    const animation = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
    };
  }, [started, restartRef.current]);

  if (!mounted) return null;

  const formattedRunTime = `${String(Math.floor(runSeconds / 60)).padStart(2, "0")}:${String(runSeconds % 60).padStart(2, "0")}`;

  return createPortal(
    <section className="fixed inset-0 z-[999999] overflow-hidden overscroll-none bg-[#080808] font-mono text-white">
      <div className="relative mx-auto flex h-[100dvh] w-full max-w-[760px] flex-col bg-black sm:border-x sm:border-white/10">
        <header className="relative z-20 flex h-[calc(58px+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-white/15 bg-black px-3 pt-[env(safe-area-inset-top)] sm:h-[84px] sm:px-6 sm:pt-0">
          <div>
            <p className="text-[7px] font-black tracking-[0.28em] text-white/40 sm:text-[9px] sm:tracking-[0.35em]">CLASSIFIED AIR COMMAND</p>
            <h1 className="text-xl font-black tracking-[0.14em] sm:text-3xl sm:tracking-[0.16em]">HOO 1952</h1>
          </div>
          <button type="button" onClick={onExit} className="min-h-9 rounded-full border border-white/25 px-3 text-xs font-black transition active:scale-95 sm:min-h-11 sm:px-6 sm:text-sm">
            나가기 ×
          </button>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <canvas ref={canvasRef} className="h-full w-full touch-none select-none" aria-label="HOO 1952 비행 슈팅 게임" />

          {started && !gameOver && (
            <button
              type="button"
              disabled={skillCharges <= 0}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                if (skillCharges <= 0) return;
                airstrikeRequestRef.current += 1;
              }}
              className="absolute bottom-[calc(12px+env(safe-area-inset-bottom))] right-3 z-20 flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-2 border-white/60 bg-black/85 text-white shadow-[0_0_28px_rgba(255,255,255,.18)] backdrop-blur-sm transition active:scale-90 disabled:border-white/20 disabled:text-white/35 disabled:shadow-none sm:bottom-6 sm:right-6 sm:h-24 sm:w-24"
            >
              <span className="text-[7px] font-black tracking-[0.1em] sm:text-[9px] sm:tracking-[0.14em]">AIR STRIKE</span>
              <strong className="mt-0.5 text-[11px] font-black sm:mt-1 sm:text-sm">지원 폭격</strong>
              <span className="mt-0.5 flex items-center gap-1 text-[8px] sm:mt-1 sm:text-[10px]">
                <i className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${skillCharges >= 1 ? "bg-white" : "bg-white/20"}`} />
                <i className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${skillCharges >= 2 ? "bg-white" : "bg-white/20"}`} />
                {skillCharges < 2 && <b className="ml-1 font-black">{skillSeconds}s</b>}
              </span>
            </button>
          )}

          <div className="pointer-events-none absolute left-2 top-2 z-10 flex w-[60px] flex-col gap-1 sm:left-5 sm:top-4 sm:w-[92px] sm:gap-2">
            {[["SCORE", score.toLocaleString()], ["WAVE", String(wave).padStart(2, "0")], ["LIFE", "●".repeat(lives) || "—"]].map(([label, value]) => (
              <div key={label} className="border border-white/20 bg-black/80 px-1 py-1.5 text-center shadow-[0_5px_18px_rgba(0,0,0,.3)] backdrop-blur-sm sm:px-1.5 sm:py-2.5">
                <p className="text-[7px] font-black tracking-[0.12em] text-white/40 sm:text-[9px] sm:tracking-[0.16em]">{label}</p>
                <strong className="block truncate text-[10px] tracking-wide text-white sm:mt-0.5 sm:text-sm sm:tracking-wider">{value}</strong>
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 text-center sm:top-4">
            <p className="text-[8px] font-black tracking-[0.22em] text-white/45 sm:text-[10px]">TIME</p>
            <strong className="block text-xl font-black tracking-[0.16em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,.95)] sm:text-3xl">{formattedRunTime}</strong>
          </div>

          <div className="pointer-events-none absolute right-2 top-2 z-10 w-[128px] border border-white/20 bg-black/80 px-1.5 py-1.5 text-center shadow-[0_5px_18px_rgba(0,0,0,.3)] backdrop-blur-sm sm:right-5 sm:top-4 sm:w-[210px] sm:px-2 sm:py-2.5">
            <p className="truncate text-[6px] font-black tracking-[0.08em] text-white/40 sm:text-[9px] sm:tracking-[0.12em]">M·R·H·S·L·F·B·C·A·G</p>
            <strong className="block truncate text-[9px] tracking-wide text-white sm:mt-0.5 sm:text-sm sm:tracking-wider">{arsenal}</strong>
            <p className="mt-1 border-t border-white/10 pt-1 text-[7px] font-black tracking-wider text-white/55 sm:text-[9px]">
              SURVIVAL <b className="text-white">+{survivalPoints}</b>
            </p>
          </div>

          {!started && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/88 px-5 pb-[env(safe-area-inset-bottom)] text-center sm:px-6">
              <div className="max-w-sm">
                <p className="mb-3 text-[10px] font-black tracking-[0.42em] text-white/45">THE SKY AWAITS</p>
                <h2 className="text-4xl font-black tracking-[0.12em] sm:text-6xl">1952</h2>
                <div className="mx-auto my-6 h-px w-24 bg-white/40" />
                <p className="text-sm font-bold leading-7 text-white/65">화면을 드래그해 기체를 조종하세요.<br />모바일에서는 손가락 위쪽으로 기체가 이동합니다.</p>
                <button type="button" onClick={() => setStarted(true)} className="mt-8 min-h-14 w-full border-2 border-white bg-white px-8 text-base font-black tracking-[0.18em] text-black transition active:scale-95">
                  출격하기
                </button>
              </div>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 px-6 text-center backdrop-blur-[2px]">
              <div className="w-full max-w-sm border border-white/25 bg-[#111] p-7 shadow-2xl">
                <p className="text-[10px] font-black tracking-[0.38em] text-white/45">MISSION REPORT</p>
                <h2 className="mt-3 text-3xl font-black tracking-widest">작전 종료</h2>
                <p className="mt-5 text-sm text-white/60">최종 점수</p>
                <strong className="mt-1 block text-4xl font-black">{score.toLocaleString()}</strong>
                <p className="mt-4 text-xs font-black tracking-wider text-white/45">작전 진행시간</p>
                <strong className="mt-1 block text-xl font-black text-white">{formattedRunTime}</strong>
                <p className="mt-4 text-xs font-black tracking-wider text-white/45">생존 랭킹 점수</p>
                <strong className="mt-1 block text-xl font-black text-white">+{survivalPoints}점</strong>
                <button type="button" onClick={() => { restartRef.current += 1; setStarted(false); requestAnimationFrame(() => setStarted(true)); }} className="mt-7 min-h-13 w-full bg-white px-6 py-3.5 font-black tracking-widest text-black transition active:scale-95">
                  다시 출격
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 z-50 opacity-[0.06] [background-image:repeating-linear-gradient(0deg,transparent,transparent_3px,#fff_4px)]" />
      </div>
    </section>,
    document.body,
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  kind?: "bullet" | "heavy" | "missile" | "support" | "reflected" | "bomb" | "ufo";
  frozenUntil?: number;
  lastBarrierPulseAt?: number;
  curveCount?: number;
  nextCurveAt?: number;
  ufoLaunched?: boolean;
  ufoState?: "travel" | "pause";
  ufoTargetX?: number;
  ufoTargetY?: number;
  ufoPauseUntil?: number;
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
  kind: "fighter" | "bomber" | "boss" | "fortress" | "dreadnought";
  shotAt: number;
  bombAt: number;
  ufoAt: number;
  laserAt: number;
  vortexAt: number;
  windAt: number;
  ufoChargeStartedAt?: number;
  lastAirstrikeAt: number;
  knockbackUntil?: number;
  lastCollisionAt?: number;
  damageFlashUntil?: number;
  entryTargetY: number;
  isEntering: boolean;
  formationId: number;
  formationSlot: number;
  spinUntil?: number;
  spinAngle?: number;
  spinSpeed?: number;
  detonateAt?: number;
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
type DamagePopup = {
  x: number;
  y: number;
  value: number;
  life: number;
  maxLife: number;
};
type HitSmoke = {
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
  | "fan"
  | "barrier"
  | "counter"
  | "artillery"
  | "repair";

type PowerUp = {
  x: number;
  y: number;
  vy: number;
  kind: UpgradeKind;
};

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
  targetX: number;
  targetY: number;
  startedAt: number;
  exploded: boolean;
  flightDuration: number;
  explodeAt: number;
};
type BattlefieldBlackHole = {
  x: number;
  y: number;
  startedAt: number;
  duration: number;
  radius: number;
  spin: number;
};
type EnemyLaser = {
  x: number;
  startedAt: number;
  warmup: number;
  duration: number;
  width: number;
  lastHitAt: number;
};
type DreadDebris = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  spin: number;
  life: number;
  harmful?: boolean;
};

type MissionPhase = "combat" | "landing" | "returned" | "report";

type Hoo1952RankingRow = {
  userId: string;
  nickname: string;
  avatarEmoji: string;
  bestScore: number;
  bestWave: number;
  bestSeconds: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const SCORE_PER_WAVE = 1850;

export default function Hoo1952Game({ onExit, onRecordSaved }: Hoo1952GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const [mounted, setMounted] = useState(false);
  const [started, setStarted] = useState(false);
  const [bgmMuted, setBgmMuted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [missionPhase, setMissionPhase] = useState<MissionPhase>("combat");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [, setPower] = useState(1);
  const [, setArsenal] = useState("1·1·0·0·0·0·0·0");
  const [skillCharges, setSkillCharges] = useState(0);
  const [skillSeconds, setSkillSeconds] = useState(30);
  const [survivalPoints, setSurvivalPoints] = useState(0);
  const [runSeconds, setRunSeconds] = useState(0);
  const restartRef = useRef(0);
  const airstrikeRequestRef = useRef(0);
  const onRecordSavedRef = useRef(onRecordSaved);
  const submittedRunRef = useRef<string | null>(null);
  const [rankings, setRankings] = useState<Hoo1952RankingRow[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);

  const loadRankings = useCallback(async () => {
    try {
      const response = await fetch("/api/1952/ranking?limit=10", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("1952 ranking unavailable");
      const data = await response.json();
      setRankings(Array.isArray(data.rankings) ? data.rankings : []);
    } catch {
      const saved = window.localStorage.getItem("hoo-1952-best-run");
      if (saved) {
        try {
          const best = JSON.parse(saved) as {
            score?: number;
            wave?: number;
            seconds?: number;
          };
          setRankings([{
            userId: "local-player",
            nickname: "MY BEST",
            avatarEmoji: "✈️",
            bestScore: Number(best.score) || 0,
            bestWave: Number(best.wave) || 1,
            bestSeconds: Number(best.seconds) || 0,
          }]);
        } catch {
          setRankings([]);
        }
      }
    } finally {
      setRankingLoading(false);
    }
  }, []);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    void loadRankings();
    const refreshTimer = window.setInterval(() => {
      void loadRankings();
    }, 30000);
    return () => window.clearInterval(refreshTimer);
  }, [loadRankings, mounted]);
  useEffect(() => {
    onRecordSavedRef.current = onRecordSaved;
  }, [onRecordSaved]);

  useEffect(() => {
    const bgm = bgmRef.current;
    if (!bgm) return;
    bgm.volume = 0.35;
    bgm.loop = true;
    bgm.muted = bgmMuted;
  }, [bgmMuted, mounted]);

  useEffect(() => {
    if (!gameOver && missionPhase === "combat") return;
    const bgm = bgmRef.current;
    if (!bgm) return;
    bgm.pause();
    bgm.currentTime = 0;
  }, [gameOver, missionPhase]);

  useEffect(() => () => {
    const bgm = bgmRef.current;
    if (!bgm) return;
    bgm.pause();
    bgm.currentTime = 0;
  }, []);

  useEffect(() => {
    if (missionPhase !== "landing") return;
    const arrivalTimer = window.setTimeout(() => setMissionPhase("returned"), 9200);
    return () => window.clearTimeout(arrivalTimer);
  }, [missionPhase]);

  useEffect(() => {
    if (!gameOver || score <= 0) return;
    const runKey = `${score}:${wave}:${runSeconds}`;
    if (submittedRunRef.current === runKey) return;
    submittedRunRef.current = runKey;

    const previousRaw = window.localStorage.getItem("hoo-1952-best-run");
    let previousScore = 0;
    if (previousRaw) {
      try {
        previousScore = Number(JSON.parse(previousRaw)?.score) || 0;
      } catch {
        previousScore = 0;
      }
    }
    if (score > previousScore) {
      window.localStorage.setItem("hoo-1952-best-run", JSON.stringify({
        score,
        wave,
        seconds: runSeconds,
      }));
    }

    void fetch("/api/1952/ranking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, wave, survivalSeconds: runSeconds }),
    }).catch(() => undefined).finally(() => {
      void loadRankings();
    });
  }, [gameOver, loadRankings, runSeconds, score, wave]);

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
    let fanLevel = 0;
    let barrierLevel = 0;
    let counterLevel = 0;
    let artilleryLevel = 0;
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
    let lastBarrierAt = performance.now();
    let barrierPulseAt = -Infinity;
    let lastCounterAt = performance.now();
    let counterPulseAt = -Infinity;
    let lastArtilleryAt = performance.now();
    let lastEnemyVortexAt = performance.now() - 4000;
    let lastBlackHoleAt = performance.now();
    let lastTwinLaserAt = performance.now();
    let twinLaserStartedAt = -Infinity;
    let lastFanAt = performance.now();
    let fanStartedAt = -Infinity;
    let lastHeavyAt = performance.now();
    let lastSupportVolleyAt = performance.now();
    let invincibleUntil = 0;
    let playerHitFlashUntil = 0;
    let playerDestroyedAt = -Infinity;
    let screenShakeUntil = 0;
    let screenShakeStrength = 0;
    let running = true;
    let dragging = false;
    let bossSpawnedForWave = false;
    let formationSequence = 0;
    const dreadnoughtSpawnAt = runStartedAt + 270000 + Math.random() * 60000;
    let dreadnoughtSpawned = false;
    let dreadWindUntil = -Infinity;
    let dreadnoughtDefeatedAt = -Infinity;
    let dreadDebrisEmitted = 0;
    let arrivalStarted = false;
    let dreadExplosionX = width / 2;
    let dreadExplosionY = height * 0.24;
    let lastDreadChainSoundAt = -Infinity;

    const player = { x: width / 2, y: height * 0.82, r: 18 };
    const playerShots: Shot[] = [];
    const enemyShots: Shot[] = [];
    const enemies: Enemy[] = [];
    const particles: Particle[] = [];
    const damagePopups: DamagePopup[] = [];
    const hitSmokes: HitSmoke[] = [];
    const powerUps: PowerUp[] = [];
    const megaBombs: MegaBomb[] = [];
    const megaBlasts: MegaBlast[] = [];
    const enemyVortices: EnemyVortex[] = [];
    const battlefieldBlackHoles: BattlefieldBlackHole[] = [];
    const enemyLasers: EnemyLaser[] = [];
    const dreadDebris: DreadDebris[] = [];
    let audioContext: AudioContext | null = null;
    let explosionNoiseBuffer: AudioBuffer | null = null;
    const stars = Array.from({ length: lowPowerMode ? 42 : 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.15 + Math.random() * 0.55,
      size: 0.4 + Math.random() * 1.5,
    }));

    const getAudioContext = () => {
      if (!audioContext || audioContext.state === "closed") {
        const AudioContextConstructor =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextConstructor) return null;
        audioContext = new AudioContextConstructor();
        const sampleLength = Math.floor(audioContext.sampleRate * 0.9);
        explosionNoiseBuffer = audioContext.createBuffer(
          1,
          sampleLength,
          audioContext.sampleRate,
        );
        const samples = explosionNoiseBuffer.getChannelData(0);
        for (let index = 0; index < sampleLength; index += 1) {
          const progress = index / sampleLength;
          const decay = Math.pow(1 - progress, 2.2);
          // 완전한 백색소음보다 낮고 거친 폭발 잔향이 나도록
          // 이전 샘플과 섞어 무게감 있는 노이즈를 만든다.
          const previous = index > 0 ? samples[index - 1] : 0;
          samples[index] =
            ((Math.random() * 2 - 1) * 0.62 + previous * 0.38) * decay;
        }
      }
      if (audioContext.state === "suspended") {
        void audioContext.resume().catch(() => undefined);
      }
      return audioContext;
    };

    const playExplosionBurst = (startAt: number, power: number) => {
      const audio = getAudioContext();
      if (!audio || !explosionNoiseBuffer) return;

      const compressor = audio.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, startAt);
      compressor.knee.setValueAtTime(16, startAt);
      compressor.ratio.setValueAtTime(5, startAt);
      compressor.attack.setValueAtTime(0.002, startAt);
      compressor.release.setValueAtTime(0.28, startAt);
      compressor.connect(audio.destination);

      const master = audio.createGain();
      master.gain.setValueAtTime(0.0001, startAt);
      master.gain.exponentialRampToValueAtTime(0.16 * power, startAt + 0.006);
      master.gain.exponentialRampToValueAtTime(0.045 * power, startAt + 0.08);
      master.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.52 * power);
      master.connect(compressor);

      // 1. 공기가 찢어지는 짧은 초기 파열음
      const crack = audio.createBufferSource();
      crack.buffer = explosionNoiseBuffer;
      crack.playbackRate.setValueAtTime(1.5 + Math.random() * 0.55, startAt);
      const crackFilter = audio.createBiquadFilter();
      crackFilter.type = "highpass";
      crackFilter.frequency.setValueAtTime(1100 + Math.random() * 500, startAt);
      const crackGain = audio.createGain();
      crackGain.gain.setValueAtTime(0.18 * Math.min(power, 1.5), startAt);
      crackGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.065);
      crack.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(compressor);
      crack.start(startAt);
      crack.stop(startAt + 0.085);

      // 2. 폭발 본체와 뭉개지는 파편 잔향
      const noise = audio.createBufferSource();
      noise.buffer = explosionNoiseBuffer;
      noise.playbackRate.setValueAtTime(0.68 + Math.random() * 0.2, startAt);
      const noiseFilter = audio.createBiquadFilter();
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.setValueAtTime(1250 / Math.sqrt(power), startAt);
      noiseFilter.frequency.exponentialRampToValueAtTime(105, startAt + 0.46 * power);
      noise.connect(noiseFilter);
      noiseFilter.connect(master);
      noise.start(startAt);
      noise.stop(startAt + 0.58 * power);

      // 3. 가슴에 울리는 낮은 충격파
      const rumble = audio.createOscillator();
      const rumbleGain = audio.createGain();
      rumble.type = "sine";
      rumble.frequency.setValueAtTime(78 / Math.sqrt(power), startAt);
      rumble.frequency.exponentialRampToValueAtTime(24, startAt + 0.42 * power);
      rumbleGain.gain.setValueAtTime(0.0001, startAt);
      rumbleGain.gain.exponentialRampToValueAtTime(0.2 * power, startAt + 0.012);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.48 * power);
      rumble.connect(rumbleGain);
      rumbleGain.connect(compressor);
      rumble.start(startAt);
      rumble.stop(startAt + 0.5 * power);
    };

    const playEnemyExplosionSound = (kind: Enemy["kind"]) => {
      const audio = getAudioContext();
      if (!audio) return;
      const burstCount =
        kind === "dreadnought" ? 15 : kind === "fortress" ? 7 : kind === "boss" ? 4 : kind === "bomber" ? 2 : 1;
      const power =
        kind === "dreadnought" ? 2.15 : kind === "fortress" ? 1.7 : kind === "boss" ? 1.42 : kind === "bomber" ? 1.15 : 0.85;
      const interval = kind === "dreadnought" ? 0.13 : kind === "fortress" ? 0.11 : kind === "boss" ? 0.095 : 0.075;

      for (let index = 0; index < burstCount; index += 1) {
        playExplosionBurst(
          audio.currentTime + index * interval + Math.random() * 0.025,
          power * (0.82 + Math.random() * 0.28),
        );
      }
    };

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

    const explode = (x: number, y: number, amount: number, linger = 1) => {
      const particleLimit = lowPowerMode ? 48 : 90;
      const requestedAmount = lowPowerMode ? Math.ceil(amount * 0.55) : amount;
      const allowed = Math.max(0, Math.min(requestedAmount, particleLimit - particles.length));
      for (let index = 0; index < allowed; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 45 + Math.random() * 150;
        const particleLife = (0.25 + Math.random() * 0.45) * linger;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: particleLife,
          maxLife: particleLife,
          size: (1 + Math.random() * 4) * (linger > 1 ? 1.12 : 1),
        });
      }
    };

    const markEnemyHit = (
      enemy: Enemy,
      damage: number,
      now: number,
      impactX = enemy.x,
      impactY = enemy.y,
      showNumber = true,
    ) => {
      if (enemy.isEntering) return;
      enemy.hp -= damage;
      enemy.damageFlashUntil = now + 120;
      explode(impactX, impactY, lowPowerMode ? 3 : 6);
      const smokeLimit = lowPowerMode ? 36 : 84;
      const smokeAmount = Math.min(
        lowPowerMode ? 3 : 6,
        Math.max(0, smokeLimit - hitSmokes.length),
      );
      for (let smokeIndex = 0; smokeIndex < smokeAmount; smokeIndex += 1) {
        const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.8;
        const speed = 14 + Math.random() * 42;
        const life = 0.52 + Math.random() * 0.5;
        hitSmokes.push({
          x: impactX + (Math.random() - 0.5) * 15,
          y: impactY + (Math.random() - 0.5) * 11,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 18,
          life,
          maxLife: life,
          size: 9 + Math.random() * 16,
        });
      }
      if (showNumber) {
        damagePopups.push({
          x: impactX + (Math.random() - 0.5) * 10,
          y: impactY - enemy.r * 0.45,
          value: Math.max(1, Math.round(damage)),
          life: 0.48,
          maxLife: 0.48,
        });
      }
    };

    const spawnEnemy = (
      kind: Enemy["kind"] = "fighter",
      placement?: {
        x?: number;
        targetY?: number;
        entryLag?: number;
        formationId?: number;
        formationSlot?: number;
      },
    ) => {
      const boss = kind === "boss";
      const fortress = kind === "fortress";
      const dreadnought = kind === "dreadnought";
      const bomber = kind === "bomber";
      const fortressHp = 420 + currentWave * 70;
      const hp = dreadnought
        ? fortressHp * 20 * 200
        : fortress
        ? 420 + currentWave * 70
        : boss
        ? 55 + currentWave * 18
        : bomber
          ? 3 + Math.floor(currentWave * 1.25)
          : 1 + Math.floor((currentWave - 1) / 2);
      const radius = dreadnought
        ? clamp(width * 0.442, 172, 309)
        : fortress ? 88 : boss ? 52 : bomber ? 25 : 16;
      const targetY = placement?.targetY ??
        (dreadnought
          ? Math.max(radius + 18, height * 0.23)
          : fortress ? Math.max(145, radius + 28) : boss ? Math.max(112, radius + 24) : 82 + Math.random() * 105);
      enemies.push({
        x: placement?.x ?? (boss || fortress || dreadnought ? width / 2 : 35 + Math.random() * (width - 70)),
        y: -radius - 18 - (placement?.entryLag ?? 0),
        vx: dreadnought ? 12 : fortress ? 34 : boss ? 58 : (Math.random() - 0.5) * (45 + currentWave * 4),
        vy: dreadnought ? 8 : fortress ? 17 : boss ? 24 : bomber ? 32 + currentWave * 2 : 38 + currentWave * 4 + Math.random() * 18,
        hp,
        maxHp: hp,
        r: radius,
        phase: Math.random() * 6,
        kind,
        shotAt: Infinity,
        bombAt: Infinity,
        ufoAt: Infinity,
        laserAt: Infinity,
        vortexAt: Infinity,
        windAt: Infinity,
        ufoChargeStartedAt: undefined,
        lastAirstrikeAt: -Infinity,
        damageFlashUntil: 0,
        entryTargetY: targetY,
        isEntering: true,
        formationId: placement?.formationId ?? -1,
        formationSlot: placement?.formationSlot ?? 0,
      });
    };

    const formationPatterns = [
      // V, 횡대, 쐐기, 2열 종대, 다이아몬드, 사선 제대, 방벽형
      [[-2, 0], [-1, 0.65], [0, 1.3], [1, 0.65], [2, 0]],
      [[-2.5, 0], [-1.5, 0], [-0.5, 0], [0.5, 0], [1.5, 0], [2.5, 0]],
      [[0, 0], [-1, 0.65], [1, 0.65], [-2, 1.3], [0, 1.3], [2, 1.3]],
      [[-1.1, 0], [1.1, 0], [-1.1, 0.9], [1.1, 0.9], [-1.1, 1.8], [1.1, 1.8]],
      [[0, 0], [-1.2, 0.7], [1.2, 0.7], [-2.2, 1.4], [0, 1.4], [2.2, 1.4], [0, 2.1]],
      [[-2.5, 0], [-1.5, 0.45], [-0.5, 0.9], [0.5, 1.35], [1.5, 1.8], [2.5, 2.25]],
      [[-2.5, 0], [-1.5, 0.55], [-0.5, 0], [0.5, 0.55], [1.5, 0], [2.5, 0.55], [0, 1.25]],
    ] as const;

    const spawnFormation = () => {
      const formationId = formationSequence % formationPatterns.length;
      formationSequence += 1;
      const pattern = formationPatterns[formationId];
      const spacing = clamp(width / 8.5, 36, 62);
      const extent = Math.max(...pattern.map(([x]) => Math.abs(x))) * spacing;
      const centerX = clamp(
        width / 2 + (Math.random() - 0.5) * width * 0.18,
        extent + 24,
        width - extent - 24,
      );
      const topY = 76 + (formationId % 3) * 18;
      pattern.forEach(([offsetX, offsetY], slot) => {
        const bomberSlot = currentWave >= 2 && (slot === pattern.length - 1 || (currentWave >= 4 && slot === 0));
        spawnEnemy(bomberSlot ? "bomber" : "fighter", {
          x: clamp(centerX + offsetX * spacing, 22, width - 22),
          targetY: topY + offsetY * spacing * 0.62,
          entryLag: offsetY * 18,
          formationId,
          formationSlot: slot,
        });
      });
    };

    const hit = (a: { x: number; y: number; r: number }, b: { x: number; y: number; r: number }) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const radius = a.r + b.r;
      return dx * dx + dy * dy < radius * radius;
    };

    const drawPlane = (x: number, y: number, scale: number, enemy = false, rotation = 0) => {
      context.save();
      context.translate(x, y);
      context.rotate(rotation);
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
      playEnemyExplosionSound(enemy.kind);
      currentScore += enemy.kind === "dreadnought" ? 25000 : enemy.kind === "fortress" ? 3500 : enemy.kind === "boss" ? 1000 : enemy.kind === "bomber" ? 180 : 80;
      const isDreadnought = enemy.kind === "dreadnought";
      const isMediumEnemy = enemy.kind === "bomber";
      const isLargeEnemy = enemy.kind === "boss" || enemy.kind === "fortress" || isDreadnought;
      explode(
        enemy.x,
        enemy.y,
        isDreadnought ? 150 : enemy.kind === "fortress" ? 86 : enemy.kind === "boss" ? 62 : isMediumEnemy ? 34 : 14,
        isDreadnought ? 3.4 : enemy.kind === "fortress" ? 2.55 : enemy.kind === "boss" ? 2.25 : isMediumEnemy ? 1.85 : 1.7,
      );

      // 소형기는 기존 폭발을 유지하고, 중형·대형기만 짙은 연기와 다중 충격파를 더한다.
      if (isMediumEnemy || isLargeEnemy) {
        const blastRadius = isDreadnought ? Math.max(220, enemy.r * 1.65) : enemy.kind === "fortress" ? 132 : enemy.kind === "boss" ? 98 : 62;
        const smokeCount = lowPowerMode
          ? isDreadnought ? 16 : isLargeEnemy ? 8 : 5
          : isDreadnought ? 36 : isLargeEnemy ? 18 : 10;
        megaBlasts.push({
          x: enemy.x,
          y: enemy.y,
          startedAt: performance.now(),
          radius: blastRadius,
        });
        if (isLargeEnemy) {
          const chainCount = isDreadnought ? 42 : 1;
          for (let chainIndex = 0; chainIndex < chainCount; chainIndex += 1) {
            megaBlasts.push({
              x: enemy.x + (Math.random() - 0.5) * enemy.r * 1.25,
              y: enemy.y + (Math.random() - 0.5) * enemy.r * 0.9,
              startedAt: performance.now() + 80 + chainIndex * 122,
              radius: blastRadius * (0.52 + Math.random() * 0.34),
            });
          }
        }
        for (let smokeIndex = 0; smokeIndex < smokeCount; smokeIndex += 1) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 18 + Math.random() * (isLargeEnemy ? 68 : 42);
          const smokeLife = (isLargeEnemy ? 1.15 : 0.78) + Math.random() * 0.65;
          hitSmokes.push({
            x: enemy.x + Math.cos(angle) * enemy.r * 0.35,
            y: enemy.y + Math.sin(angle) * enemy.r * 0.25,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 18,
            life: smokeLife,
            maxLife: smokeLife,
            size: (isLargeEnemy ? 9 : 6) + Math.random() * (isLargeEnemy ? 13 : 8),
          });
        }
        const shakeStrength = isDreadnought ? 38 : enemy.kind === "fortress" ? 24 : enemy.kind === "boss" ? 18 : 10;
        screenShakeUntil = Math.max(screenShakeUntil, performance.now() + (isDreadnought ? 1500 : isLargeEnemy ? 720 : 430));
        screenShakeStrength = Math.max(screenShakeStrength, shakeStrength);
      }

      if (isDreadnought) {
        dreadnoughtDefeatedAt = performance.now();
        dreadExplosionX = enemy.x;
        dreadExplosionY = enemy.y;
        dreadDebrisEmitted = 0;
      }
      killCount += 1;
      const upgradeRotation: UpgradeKind[] = [
        "spread", "rapid", "homing", "support", "fan",
        "barrier", "counter", "artillery",
      ];
      // 모든 적이 아이템을 떨어뜨리지 않도록 실제 드랍 확률을 50%로 제한한다.
      if (Math.random() < 0.5) {
        const kind: UpgradeKind = enemy.kind === "boss" || enemy.kind === "fortress" || isDreadnought || killCount % 30 === 0
          ? "repair"
          : upgradeRotation[(killCount - 1) % upgradeRotation.length];
        powerUps.push({ x: enemy.x, y: enemy.y, vy: 62, kind });
      }
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
      const audio = getAudioContext();
      if (audio) {
        // 지원기가 지나간 뒤 지면 전체가 순차적으로 터지는 중량감 있는 연쇄 폭격음.
        const blastCount = lowPowerMode ? 12 : 22;
        for (let index = 0; index < blastCount; index += 1) {
          playExplosionBurst(
            audio.currentTime + 0.18 + index * 0.055 + Math.random() * 0.045,
            1.2 + Math.random() * 0.72,
          );
        }
      }
      invincibleUntil = Math.max(invincibleUntil, now + 1900);
    };

    const update = (now: number, delta: number) => {
      frame += delta;

      if (currentLives <= 0) {
        particles.forEach((particle) => {
          particle.x += particle.vx * delta;
          particle.y += particle.vy * delta;
          particle.vy += 55 * delta;
          particle.life -= delta;
        });
        for (let index = particles.length - 1; index >= 0; index -= 1) {
          if (particles[index].life <= 0) particles.splice(index, 1);
        }
        hitSmokes.forEach((smoke) => {
          smoke.x += smoke.vx * delta;
          smoke.y += smoke.vy * delta;
          smoke.vx *= 0.97;
          smoke.vy -= 12 * delta;
          smoke.size += 15 * delta;
          smoke.life -= delta;
        });
        for (let index = hitSmokes.length - 1; index >= 0; index -= 1) {
          if (hitSmokes[index].life <= 0) hitSmokes.splice(index, 1);
        }
        if (now - playerDestroyedAt >= 850) {
          running = false;
          setScore(currentScore);
          setLives(0);
          setRunSeconds(Math.floor((now - runStartedAt) / 1000));
          setGameOver(true);
        }
        return;
      }

      currentWave = Math.floor(currentScore / SCORE_PER_WAVE) + 1;
      const runElapsedMs = now - runStartedAt;
      const elapsedMinutes = Math.floor(runElapsedMs / 60000);

      if (Number.isFinite(dreadnoughtDefeatedAt)) {
        const defeatAge = now - dreadnoughtDefeatedAt;
        const stormDuration = 5000;
        const totalDebris = (lowPowerMode ? 26 : 42) * 150;
        const targetEmitted = Math.min(totalDebris, Math.floor((defeatAge / stormDuration) * totalDebris));
        const batchCount = Math.min(targetEmitted - dreadDebrisEmitted, lowPowerMode ? 28 : 46);
        for (let debrisIndex = 0; debrisIndex < batchCount; debrisIndex += 1) {
          const spawnX = dreadExplosionX + (Math.random() - 0.5) * width * 0.92;
          const safeHalfWidth = Math.max(48, width * 0.1);
          const canHurt = Math.random() < 0.038 && Math.abs(spawnX - player.x) > safeHalfWidth;
          const speed = 76 + Math.random() * 118;
          const horizontal = (Math.random() - 0.5) * speed * 1.25;
          dreadDebris.push({
            x: spawnX,
            y: dreadExplosionY + (Math.random() - 0.5) * 90,
            vx: horizontal,
            vy: 58 + Math.random() * speed,
            r: canHurt ? 10 + Math.random() * 15 : 3 + Math.random() * 9,
            angle: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 9,
            life: 1.2 + Math.random() * 2.5,
            harmful: canHurt,
          });
        }
        dreadDebrisEmitted += Math.max(0, batchCount);

        if (defeatAge < stormDuration && now - lastDreadChainSoundAt >= 280) {
          lastDreadChainSoundAt = now;
          const audio = getAudioContext();
          if (audio) playExplosionBurst(audio.currentTime, 0.85 + Math.random() * 0.8);
        }

        if (!arrivalStarted && defeatAge >= stormDuration) {
          arrivalStarted = true;
          currentScore += 50000;
          currentWave = Math.floor(currentScore / SCORE_PER_WAVE) + 1;
          setScore(currentScore);
          setLives(currentLives);
          setWave(currentWave);
          setRunSeconds(Math.floor((now - runStartedAt) / 1000));
          setMissionPhase("landing");
          running = false;
          return;
        }
      }

      // 최종 귀환 저지함: 시작 후 4분 30초~5분 30초 사이에 단 한 번 등장한다.
      if (!dreadnoughtSpawned && now >= dreadnoughtSpawnAt) {
        dreadnoughtSpawned = true;
        spawnEnemy("dreadnought", {
          x: width / 2,
          targetY: Math.max(150, height * 0.23),
          entryLag: 0,
          formationId: -99,
          formationSlot: 0,
        });
      }

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
          if (enemy.isEntering) continue;
          if (sweepY <= enemy.y + enemy.r || activeAirstrikeAge > 1600) {
            if (enemy.kind === "boss" || enemy.kind === "fortress" || enemy.kind === "dreadnought") {
              if (enemy.lastAirstrikeAt !== airstrikeStartedAt) {
                enemy.lastAirstrikeAt = airstrikeStartedAt;
                enemy.hp = Math.max(1, enemy.hp - enemy.maxHp * 0.3);
                explode(enemy.x, enemy.y, enemy.kind === "dreadnought" ? 64 : enemy.kind === "fortress" ? 42 : 26);
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
          ? Array.from(
              { length: Math.min(10, spreadLevel) },
              (_, index) => (index - (Math.min(10, spreadLevel) - 1) / 2) * 0.085,
            )
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
          const homingCount = Math.min(4, Math.max(1, Math.ceil(homingLevel * 4 / 7)));
          for (let index = 0; index < homingCount; index += 1) {
            playerShots.push({
              x: player.x + (index - (homingCount - 1) / 2) * 15,
              y: player.y - 18,
              vx: (index - (homingCount - 1) / 2) * 35,
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
            markEnemyHit(enemy, delta * (11 + fanLevel * 6), now, enemy.x, enemy.y, false);
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
              markEnemyHit(enemy, damage, now, bomb.targetX, bomb.targetY, true);
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

          const damage = enemy.kind === "boss" || enemy.kind === "fortress" || enemy.kind === "dreadnought"
            ? enemy.maxHp * delta * 0.22
            : enemy.maxHp + 1;
          markEnemyHit(enemy, damage, now, enemy.x, enemy.y, false);
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
            markEnemyHit(
              enemy,
              enemy.kind === "boss" || enemy.kind === "fortress" || enemy.kind === "dreadnought"
                ? enemy.maxHp * 0.08
                : enemy.maxHp * 0.5,
              now,
              enemy.x,
              enemy.y,
              false,
            );
            if (enemy.hp <= 0) destroyEnemy(enemyIndex);
          }
        });
      }

      const spawnDelay = Math.max(1050, 2450 - (currentWave - 1) * 105);
      const enemyLimit = Math.min(34, 12 + currentWave * 2);
      if (!isAirstrikeActive && now - lastSpawn > spawnDelay && enemies.length <= enemyLimit - 5) {
        lastSpawn = now;
        spawnFormation();
      }
      if (!isAirstrikeActive && currentScore > 0 && currentScore % SCORE_PER_WAVE < 100 && !bossSpawnedForWave) {
        bossSpawnedForWave = true;
        spawnEnemy(currentWave % 5 === 0 ? "fortress" : "boss");
      }
      if (currentScore % SCORE_PER_WAVE > 280) bossSpawnedForWave = false;

      // 난이도가 상승해도 전장 블랙홀은 최대 1개만 유지된다.
      const blackHoleLimit = Math.min(1, elapsedMinutes);
      // 최초 1분 뒤 등장하고, 이후에는 마지막 생성 시점 기준 30초 간격으로만 등장한다.
      const blackHoleInterval = 30000;
      if (
        runElapsedMs >= 60000 &&
        blackHoleLimit > battlefieldBlackHoles.length &&
        now - lastBlackHoleAt >= blackHoleInterval
      ) {
        lastBlackHoleAt = now;
        const vacancies = blackHoleLimit - battlefieldBlackHoles.length;
        const batch = Math.min(
          1,
          vacancies,
          currentWave >= 7 ? 1 + Math.floor(Math.random() * 3) : currentWave >= 4 ? 1 + Math.floor(Math.random() * 2) : 1,
        );
        for (let index = 0; index < batch; index += 1) {
          battlefieldBlackHoles.push({
            x: 55 + Math.random() * Math.max(1, width - 110),
            y: 145 + Math.random() * Math.max(1, height * 0.52),
            startedAt: now + index * (540 + Math.random() * 360),
            duration: 6200 + Math.random() * 1800,
            radius: Math.min(104, 27 + elapsedMinutes * 8 + Math.random() * 12),
            spin: Math.random() > 0.5 ? 1 : -1,
          });
        }
      }

      // 적 중력 폭발: 보스전 또는 4웨이브부터 중앙에 중력탄 투척
      const vortexCaster = enemies.find((enemy) => !enemy.isEntering && (
        enemy.kind === "fortress" || enemy.kind === "boss" ||
        (currentWave >= 4 && enemy.kind === "bomber"))) ??
        enemies.find((enemy) => !enemy.isEntering);
      const vortexVolleyCount = Math.min(5, 1 + elapsedMinutes);
      const enemyVortexInterval = Math.max(6500, 14500 - elapsedMinutes * 950);
      if (
        vortexCaster &&
        runElapsedMs >= 30000 &&
        enemyVortices.length < vortexVolleyCount &&
        now - lastEnemyVortexAt >= enemyVortexInterval &&
        !isAirstrikeActive
      ) {
        lastEnemyVortexAt = now;
        const vacancies = vortexVolleyCount - enemyVortices.length;
        // 한 번의 투척에서 허용 수 전체가 동시에 등장하지 않도록 1~3개만 무작위 생성한다.
        const spawnCount = Math.min(
          vacancies,
          1 + Math.floor(Math.random() * Math.min(3, vacancies)),
        );
        const explodeAt = Math.max(1050, 2350 - elapsedMinutes * 190);
        const flightDuration = Math.max(330, 650 - elapsedMinutes * 35);
        for (let index = 0; index < spawnCount; index += 1) {
          const edge = Math.floor(Math.random() * 4);
          const targetX = 60 + Math.random() * Math.max(1, width - 120);
          const targetY = 135 + Math.random() * Math.max(1, height * 0.46);
          const startX = edge === 1
            ? -34
            : edge === 2
              ? width + 34
              : 35 + Math.random() * Math.max(1, width - 70);
          const startY = edge === 0
            ? -34
            : edge === 3
              ? height + 34
              : 105 + Math.random() * Math.max(1, height - 210);
          enemyVortices.push({
            x: startX,
            y: startY,
            startX,
            startY,
            targetX,
            targetY,
            startedAt: now + index * 310,
            exploded: false,
            flightDuration,
            explodeAt,
          });
        }
      }

      playerShots.forEach((shot) => {
        const activeEnemies = enemies.filter((enemy) => !enemy.isEntering);
        if ((shot.kind === "missile" || shot.kind === "support" || shot.kind === "reflected") && activeEnemies.length > 0) {
          let target = activeEnemies[0];
          let distance = Infinity;
          activeEnemies.forEach((enemy) => {
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
        if (shot.kind === "ufo" && !shot.ufoLaunched) {
          const targetX = shot.ufoTargetX ?? player.x;
          const targetY = shot.ufoTargetY ?? player.y;
          if (shot.ufoState !== "pause") {
            const dx = targetX - shot.x;
            const dy = targetY - shot.y;
            const distance = Math.hypot(dx, dy);
            const trackingSpeed = 105 + currentWave * 3;
            if (distance <= Math.max(10, trackingSpeed * delta * 1.25)) {
              // 플레이어가 있던 위치에 정확히 도착한 뒤 잠시 완전히 정지한다.
              shot.x = targetX;
              shot.y = targetY;
              shot.vx = 0;
              shot.vy = 0;
              shot.curveCount = (shot.curveCount ?? 0) + 1;
              shot.ufoState = "pause";
              shot.ufoPauseUntil = now + 420;
            } else {
              shot.vx = (dx / distance) * trackingSpeed;
              shot.vy = (dy / distance) * trackingSpeed;
            }
          } else {
            shot.vx = 0;
            shot.vy = 0;
            if (now >= (shot.ufoPauseUntil ?? now)) {
              if ((shot.curveCount ?? 0) >= 3) {
                // 세 번의 이동과 정지를 마친 뒤 현재 플레이어 방향으로 고속 직선 발사한다.
                const launchAngle = Math.atan2(player.y - shot.y, player.x - shot.x);
                const attackSpeed = 310 + currentWave * 11 + elapsedMinutes * 8;
                shot.vx = Math.cos(launchAngle) * attackSpeed;
                shot.vy = Math.sin(launchAngle) * attackSpeed;
                shot.ufoLaunched = true;
                shot.nextCurveAt = Infinity;
              } else {
                shot.ufoTargetX = player.x;
                shot.ufoTargetY = player.y;
                shot.ufoState = "travel";
              }
            }
          }
        }

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
      damagePopups.forEach((popup) => {
        popup.y -= 34 * delta;
        popup.life -= delta;
      });
      hitSmokes.forEach((smoke) => {
        smoke.x += smoke.vx * delta;
        smoke.y += smoke.vy * delta;
        smoke.vx *= 0.965;
        smoke.vy -= 10 * delta;
        smoke.size += 13 * delta;
        smoke.life -= delta;
      });
      dreadDebris.forEach((debris) => {
        debris.x += debris.vx * delta;
        debris.y += debris.vy * delta;
        debris.vy += 7 * delta;
        debris.angle += debris.spin * delta;
        debris.life -= delta;
      });
      for (let laserIndex = enemyLasers.length - 1; laserIndex >= 0; laserIndex -= 1) {
        const laser = enemyLasers[laserIndex];
        if (now - laser.startedAt > laser.warmup + laser.duration) enemyLasers.splice(laserIndex, 1);
      }

      for (let index = battlefieldBlackHoles.length - 1; index >= 0; index -= 1) {
        const blackHole = battlefieldBlackHoles[index];
        const age = now - blackHole.startedAt;
        if (age > blackHole.duration) {
          battlefieldBlackHoles.splice(index, 1);
          continue;
        }
        if (age < 0) continue;
        const fade = Math.min(1, age / 480, (blackHole.duration - age) / 650);
        const influence = blackHole.radius * Math.min(8.2, 5.4 + elapsedMinutes * 0.42);
        const pullObject = (object: { x: number; y: number }, resistance: number) => {
          const dx = blackHole.x - object.x;
          const dy = blackHole.y - object.y;
          const distance = Math.max(12, Math.hypot(dx, dy));
          if (distance > influence) return;
          const force = (1 - distance / influence) * (96 + currentWave * 7 + elapsedMinutes * 34) * fade * resistance * delta;
          object.x += (dx / distance) * force;
          object.y += (dy / distance) * force;
          const tangent = force * 0.34 * blackHole.spin;
          object.x += (-dy / distance) * tangent;
          object.y += (dx / distance) * tangent;
        };
        playerShots.forEach((shot) => pullObject(shot, 1.15));
        enemyShots.forEach((shot) => {
          if (shot.kind !== "ufo") pullObject(shot, 1);
        });
        powerUps.forEach((item) => pullObject(item, 0.9));
        megaBombs.forEach((bomb) => pullObject(bomb, 0.35));
        enemies.forEach((enemy) => {
          if (!enemy.isEntering) pullObject(enemy, enemy.kind === "dreadnought" ? 0.006 : enemy.kind === "fortress" ? 0.08 : enemy.kind === "boss" ? 0.18 : 0.48);
        });
        // 전장 블랙홀은 적기·탄막·아이템만 끌어당기며 플레이어 기체에는 영향을 주지 않는다.
      }

      // 기존 탄은 절대 잘라내지 않고, 상한에 도달하면 새 탄 생성만 잠시 멈춘다.
      // 현재보다 화면에 유지되는 적 탄막을 추가로 30% 감축한다.
      const enemyShotSoftLimit = lowPowerMode ? 50 : 88;
      for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
        const enemy = enemies[enemyIndex];
        if (enemy.detonateAt && now >= enemy.detonateAt) {
          destroyEnemy(enemyIndex);
        }
      }
      enemies.forEach((enemy) => {
        enemy.phase += delta * 2;
        if (enemy.spinUntil && now < enemy.spinUntil) {
          enemy.x += enemy.vx * delta;
          enemy.y += enemy.vy * delta;
          enemy.spinAngle = (enemy.spinAngle ?? 0) + (enemy.spinSpeed ?? 5) * delta;
          return;
        }
        if (enemy.isEntering) {
          const entrySpeed = enemy.kind === "dreadnought" ? 34 : enemy.kind === "fortress" ? 92 : enemy.kind === "boss" ? 112 : 138;
          enemy.y += entrySpeed * delta;
          if (enemy.y >= enemy.entryTargetY) {
            enemy.y = enemy.entryTargetY;
            enemy.isEntering = false;
            enemy.vy = 0;
            enemy.shotAt = now + 750 + Math.random() * 900;
            enemy.bombAt = now + 1800 + Math.random() * 700;
            enemy.ufoAt = now + 3400 + Math.random() * 1800;
            enemy.laserAt = now + 4200;
            enemy.vortexAt = now + 3600;
            enemy.windAt = now + 5200;
          }
        } else {
          if (enemy.kind === "fighter") {
            // 하급기는 웨이브가 오를수록 빠르게 플레이어를 추적하며 직접 충돌을 노린다.
            const diveSpeed = Math.min(245, 42 + currentWave * 13);
            const desiredVx = clamp((player.x - enemy.x) * 0.72, -diveSpeed, diveSpeed);
            enemy.vx += (desiredVx - enemy.vx) * Math.min(1, delta * (1.25 + currentWave * 0.09));
            enemy.y += diveSpeed * 0.38 * delta;
          }
          enemy.x += (enemy.vx + Math.sin(enemy.phase) * (enemy.kind === "dreadnought" ? 7 : enemy.kind === "fortress" ? 15 : enemy.kind === "boss" ? 45 : 22)) * delta;
          const verticalRange = enemy.kind === "dreadnought" ? 8 : enemy.kind === "fortress" ? 18 : enemy.kind === "boss" ? 26 : 34;
          if (enemy.kind !== "fighter") {
            enemy.y = clamp(
              enemy.y + Math.sin(enemy.phase * 0.72 + enemy.formationSlot * 0.45) * 10 * delta,
              Math.max(enemy.r + 18, enemy.entryTargetY - verticalRange),
              Math.min(height * 0.43, enemy.entryTargetY + verticalRange),
            );
          }
        }
        if (enemy.x < enemy.r || enemy.x > width - enemy.r) enemy.vx *= -1;
        const canFire = runElapsedMs >= 8000 && !enemy.isEntering && (enemy.kind === "boss" || enemy.kind === "fortress" || enemy.kind === "dreadnought" ||
          (enemy.kind === "bomber" && currentWave >= 2) ||
          currentWave >= 3);
        if (!isAirstrikeActive && canFire && now > enemy.shotAt && enemy.y > 0) {
          // 초반에는 충분한 회피 간격을 주고, 생존 시간이 길어질수록 수량과 연사력이 함께 상승한다.
          const fireRamp = clamp((runElapsedMs / 1000 - 8) / 240, 0, 1);
          const barrageDensity = Math.min(0.62, 0.07 + fireRamp * 0.45 + (currentWave - 1) * 0.012) * 0.7;
          const intervalScale = 2.25 - fireRamp * 1.1;
          enemy.shotAt = now + (enemy.kind === "dreadnought"
            ? 260 + Math.random() * 210
            : enemy.kind === "fortress"
            ? Math.max(300, 820 - currentWave * 55)
            : enemy.kind === "boss"
            ? Math.max(460, 1350 - currentWave * 70)
            : Math.max(900, 2600 - currentWave * 110) + Math.random() * 760) * intervalScale;
          const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          const baseCount = enemy.kind === "dreadnought"
            ? 8
            : enemy.kind === "fortress"
            ? 2
            : enemy.kind === "boss"
            ? currentWave >= 5 ? 2 : 1
            : 1;
          const count = Math.max(1, Math.round(baseCount * barrageDensity));
          const shouldFireVolley = enemy.kind === "dreadnought"
            ? true
            : baseCount === 1
            ? Math.random() <= barrageDensity
            : Math.random() <= 0.7;
          if (shouldFireVolley) {
            for (let index = 0; index < count; index += 1) {
              if (enemyShots.length >= enemyShotSoftLimit) break;
              const offset = (index - (count - 1) / 2) * (enemy.kind === "dreadnought" ? 0.14 : enemy.kind === "fortress" ? 0.22 : 0.18);
              const shotSpeed = Math.min(165, 58 + currentWave * 6.5);
              enemyShots.push({
                x: enemy.x, y: enemy.y + enemy.r,
                vx: Math.cos(angle + offset) * shotSpeed,
                vy: Math.sin(angle + offset) * shotSpeed,
                r: 8,
              });
            }
          }
        }

        if (runElapsedMs >= 25000 && !enemy.isEntering && !isAirstrikeActive && (enemy.kind === "fortress" || enemy.kind === "dreadnought") && now > enemy.bombAt && enemy.y > 0) {
          const fireRamp = clamp((runElapsedMs / 1000 - 8) / 240, 0, 1);
          const barrageDensity = Math.min(0.62, 0.07 + fireRamp * 0.45 + (currentWave - 1) * 0.012);
          enemy.bombAt = now + (enemy.kind === "dreadnought"
            ? 1150 + Math.random() * 650
            : Math.max(1000, 2600 - currentWave * 105) * (2.15 - fireRamp));
          const bombCount = enemy.kind === "dreadnought"
            ? 7 + Math.floor(Math.random() * 6)
            : Math.random() <= 0.7
            ? Math.max(
                1,
                Math.round(Math.min(14, 8 + Math.floor(currentWave / 2)) * barrageDensity * 0.4),
              )
            : 0;
          for (let index = 0; index < bombCount; index += 1) {
            if (enemyShots.length >= enemyShotSoftLimit) break;
            const angle = (index / bombCount) * Math.PI * 2 + enemy.phase * 0.16;
            const speed = (enemy.kind === "dreadnought" ? 72 : 61) + currentWave * 2.5 + (index % 3) * 10;
            enemyShots.push({
              x: enemy.x,
              y: enemy.y + 22,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              r: 15,
              kind: "bomb",
            });
          }
        }

        if (runElapsedMs >= 45000 && !enemy.isEntering && !isAirstrikeActive && (enemy.kind === "fortress" || enemy.kind === "dreadnought") && now > enemy.ufoAt) {
          if (!enemy.ufoChargeStartedAt) enemy.ufoChargeStartedAt = now;
          const chargeDuration = enemy.kind === "dreadnought" ? 1650 : 1350;
          if (now - enemy.ufoChargeStartedAt >= chargeDuration) {
            const baseUfoInterval = enemy.kind === "dreadnought"
              ? 5200 + Math.random() * 1700
              : Math.max(4300, 8200 - currentWave * 150) + Math.random() * 1900;
            enemy.ufoAt = now + baseUfoInterval;
            enemy.ufoChargeStartedAt = undefined;
            const speed = 68 + currentWave * 2;
            // 일반 대형함은 한 발, 최종 귀환 저지함은 양 날개에서 두 발을 동시에 응축한다.
            const ufoCount = enemy.kind === "dreadnought" ? 2 : 1;
            for (let ufoIndex = 0; ufoIndex < ufoCount; ufoIndex += 1) {
              if (enemyShots.length >= enemyShotSoftLimit) break;
              const wingSide = ufoCount === 2 ? (ufoIndex === 0 ? -1 : 1) : 0;
              const openingAngle = Math.PI / 2 + wingSide * 0.42;
              enemyShots.push({
                x: enemy.x + wingSide * enemy.r * 0.58,
                y: enemy.y + enemy.r * 0.42,
                vx: Math.cos(openingAngle) * speed,
                vy: Math.sin(openingAngle) * speed,
                r: clamp(38 + currentWave * 0.9 + elapsedMinutes * 1.5, 38, 58) * (enemy.kind === "dreadnought" ? 0.92 : 0.75),
                kind: "ufo",
                curveCount: 0,
                ufoState: "travel",
                ufoTargetX: player.x,
                ufoTargetY: player.y,
                nextCurveAt: Infinity,
              });
            }
          }
        }

        if (enemy.kind === "dreadnought" && !enemy.isEntering && !isAirstrikeActive) {
          if (now > enemy.laserAt) {
            enemy.laserAt = now + 6100 + Math.random() * 2400;
            [-0.42, 0.42].forEach((wingOffset) => {
              enemyLasers.push({
                x: clamp(enemy.x + enemy.r * wingOffset, 22, width - 22),
                startedAt: now,
                warmup: 1050,
                duration: 1200,
                width: clamp(width * 0.025, 12, 22),
                lastHitAt: -Infinity,
              });
            });
          }

          if (now > enemy.vortexAt) {
            enemy.vortexAt = now + 5100 + Math.random() * 2100;
            const vortexCount = 2 + Math.floor(Math.random() * 3);
            for (let vortexIndex = 0; vortexIndex < vortexCount; vortexIndex += 1) {
              const side = vortexIndex % 2 === 0 ? -1 : 1;
              enemyVortices.push({
                x: enemy.x + side * enemy.r * 0.5,
                y: enemy.y + enemy.r * 0.25,
                startX: enemy.x + side * enemy.r * 0.5,
                startY: enemy.y + enemy.r * 0.25,
                targetX: clamp(player.x + (Math.random() - 0.5) * width * 0.42, 45, width - 45),
                targetY: clamp(player.y - 70 - Math.random() * 170, height * 0.32, height * 0.76),
                startedAt: now + vortexIndex * 180,
                exploded: false,
                flightDuration: 640,
                explodeAt: 2100,
              });
            }
          }

          if (now > enemy.windAt) {
            enemy.windAt = now + 8200 + Math.random() * 2600;
            dreadWindUntil = now + 1650;
            enemies.forEach((target) => {
              if (target === enemy || target.kind === "dreadnought" || target.isEntering) return;
              const dx = player.x - target.x;
              const dy = player.y - target.y;
              const distance = Math.max(1, Math.hypot(dx, dy));
              const throwSpeed = 105 + Math.random() * 80;
              target.vx = (dx / distance) * throwSpeed + (Math.random() - 0.5) * 65;
              target.vy = Math.max(95, (dy / distance) * throwSpeed + 115);
              target.spinUntil = now + 2100 + Math.random() * 650;
              target.spinSpeed = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8);
              target.spinAngle = 0;
              if (Math.random() < 0.2) target.detonateAt = now + 520 + Math.random() * 1050;
            });
          }
        }
      });

      // 적 중력탄: 비행 → 흡입 → 전방 충격파
      for (let vortexIndex = enemyVortices.length - 1; vortexIndex >= 0; vortexIndex -= 1) {
        const vortex = enemyVortices[vortexIndex];
        const age = now - vortex.startedAt;
        const flightDuration = vortex.flightDuration;
        const explodeAt = vortex.explodeAt;

        if (age < flightDuration) {
          const progress = clamp(age / flightDuration, 0, 1);
          vortex.x = vortex.startX + (vortex.targetX - vortex.startX) * progress;
          vortex.y = vortex.startY + (vortex.targetY - vortex.startY) * progress - Math.sin(progress * Math.PI) * 42;
        } else if (age < explodeAt) {
          const pullStrength = 185 + currentWave * 7;
          enemyShots.forEach((shot) => {
            if (shot.kind === "ufo") return;
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
            const resistance = enemy.kind === "dreadnought" ? 0.005 : enemy.kind === "fortress" ? 0.02 : enemy.kind === "boss" ? 0.07 : 0.72;
            const pull = Math.min(distance, pullStrength * delta * resistance * (1 + 95 / distance));
            enemy.x += (dx / distance) * pull;
            enemy.y += (dy / distance) * pull;
          });
        } else if (!vortex.exploded) {
          vortex.exploded = true;
          explode(vortex.x, vortex.y, 58);
          const audio = getAudioContext();
          if (audio) {
            playExplosionBurst(audio.currentTime, 1.62);
            playExplosionBurst(audio.currentTime + 0.075, 0.82);
          }

          enemyShots.forEach((shot) => {
            if (shot.kind === "ufo") return;
            const dx = shot.x - vortex.x;
            const dy = shot.y - vortex.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const side = dx / distance;
            shot.vx = side * (130 + currentWave * 4);
            shot.vy = 245 + currentWave * 8 + Math.max(0, dy / distance) * 70;
          });

          enemies.forEach((enemy) => {
            if (enemy.kind === "boss" || enemy.kind === "fortress" || enemy.kind === "dreadnought") return;
            const dx = enemy.x - vortex.x;
            const distance = Math.max(1, Math.hypot(dx, enemy.y - vortex.y));
            enemy.vx = (dx / distance) * (150 + currentWave * 6);
            enemy.vy = 220 + currentWave * 7;
            enemy.knockbackUntil = now + 1150;
          });
        }

        if (age > explodeAt + 650) enemyVortices.splice(vortexIndex, 1);
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
        markEnemyHit(enemies[enemyIndex], damage, now, enemies[enemyIndex].x, enemies[enemyIndex].y, true);
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
          if (enemy.isEntering) continue;
          if (!hit(shot, enemy)) continue;
          playerShots.splice(shotIndex, 1);
          const damage = shot.kind === "reflected" ? 3 + counterLevel * 2 : shot.kind === "heavy" ? 5 : shot.kind === "missile" ? 3 : 1;
          markEnemyHit(enemy, damage, now, shot.x, shot.y, true);
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
        playerHitFlashUntil = now + 420;
        screenShakeUntil = now + (currentLives <= 0 ? 820 : 460);
        screenShakeStrength = currentLives <= 0 ? 20 : currentLives === 1 ? 14 : 9;
        explode(x, y, currentLives <= 0 ? 84 : 42);
        if (currentLives <= 0) {
          playerDestroyedAt = now;
        }
      };

      for (const laser of enemyLasers) {
        const laserAge = now - laser.startedAt;
        const active = laserAge >= laser.warmup && laserAge <= laser.warmup + laser.duration;
        if (!active || Math.abs(player.x - laser.x) > player.r + laser.width * 0.55) continue;
        if (now - laser.lastHitAt < 900) continue;
        laser.lastHitAt = now;
        damagePlayer(player.x, player.y);
      }

      for (let debrisIndex = dreadDebris.length - 1; debrisIndex >= 0; debrisIndex -= 1) {
        const debris = dreadDebris[debrisIndex];
        if (debris.life <= 0 || debris.y > height + debris.r * 2 || debris.x < -debris.r * 3 || debris.x > width + debris.r * 3) {
          dreadDebris.splice(debrisIndex, 1);
          continue;
        }
        if (debris.harmful && hit(debris, player)) {
          explode(debris.x, debris.y, 22);
          dreadDebris.splice(debrisIndex, 1);
          damagePlayer(player.x, player.y);
        }
      }

      for (let shotIndex = enemyShots.length - 1; shotIndex >= 0; shotIndex -= 1) {
        const bomb = enemyShots[shotIndex];
        if (bomb.kind !== "bomb") continue;
        let detonated = false;
        for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
          const target = enemies[enemyIndex];
          if (target.isEntering) continue;
          if (target.kind === "boss" || target.kind === "fortress" || target.kind === "dreadnought") continue;
          if (!hit(bomb, target)) continue;
          markEnemyHit(target, 20, now, bomb.x, bomb.y, true);
          explode(bomb.x, bomb.y, 18);
          enemyShots.splice(shotIndex, 1);
          detonated = true;
          if (target.hp <= 0) destroyEnemy(enemyIndex);
          break;
        }
        if (detonated) continue;
      }

      // 최종 돌진에 들어간 커브탄은 적기에도 충돌하며 큰 피해와 폭발을 일으킨다.
      for (let shotIndex = enemyShots.length - 1; shotIndex >= 0; shotIndex -= 1) {
        const curveShot = enemyShots[shotIndex];
        if (curveShot.kind !== "ufo" || !curveShot.ufoLaunched) continue;
        let collided = false;
        for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
          const target = enemies[enemyIndex];
          if (target.isEntering || !hit(curveShot, target)) continue;
          const damage = Math.max(260, target.maxHp * 0.5);
          markEnemyHit(target, damage, now, curveShot.x, curveShot.y, true);
          explode(curveShot.x, curveShot.y, 180, 2.6);
          megaBlasts.push({
            x: curveShot.x,
            y: curveShot.y,
            startedAt: now,
            radius: Math.max(150, curveShot.r * 4.2),
          });
          megaBlasts.push({
            x: curveShot.x,
            y: curveShot.y,
            startedAt: now + 70,
            radius: Math.max(105, curveShot.r * 3.1),
          });
          screenShakeUntil = now + 900;
          screenShakeStrength = 24;
          const audio = getAudioContext();
          if (audio) {
            playExplosionBurst(audio.currentTime, 1.75);
            playExplosionBurst(audio.currentTime + 0.07, 1.18);
            playExplosionBurst(audio.currentTime + 0.16, 0.82);
          }
          enemyShots.splice(shotIndex, 1);
          collided = true;
          if (target.hp <= 0) destroyEnemy(enemyIndex);
          break;
        }
        if (collided) continue;
      }

      for (let index = enemyShots.length - 1; index >= 0; index -= 1) {
        const shot = enemyShots[index];
        const exitMargin = shot.kind === "ufo" ? shot.r + 52 : 30;
        if (shot.y < -exitMargin || shot.y > height + exitMargin || shot.x < -exitMargin || shot.x > width + exitMargin) { enemyShots.splice(index, 1); continue; }
        // 커브탄은 세 번의 위치 이동·정지를 마치고 최종 발사된 뒤부터만 충돌 판정을 갖는다.
        if ((shot.kind !== "ufo" || shot.ufoLaunched) && hit(shot, player)) {
          if (shot.kind === "ufo") {
            explode(shot.x, shot.y, 140, 2.1);
            megaBlasts.push({
              x: shot.x,
              y: shot.y,
              startedAt: now,
              radius: Math.max(135, shot.r * 3.2),
            });
            screenShakeUntil = now + 1050;
            screenShakeStrength = 26;
          }
          enemyShots.splice(index, 1);
          damagePlayer(player.x, player.y);
        }
      }
      for (let index = enemies.length - 1; index >= 0; index -= 1) {
        const enemy = enemies[index];
        if (enemy.isEntering) continue;
        if (hit(enemy, player)) {
          if (enemy.kind === "dreadnought" || enemy.kind === "fortress" || enemy.kind === "boss") {
            damagePlayer(player.x, player.y);
            player.y = clamp(player.y + Math.max(32, enemy.r * 0.25), player.r, height - player.r);
          } else {
            enemies.splice(index, 1);
            damagePlayer(player.x, player.y);
          }
        }
        else if (enemy.y > height + 80) enemies.splice(index, 1);
      }
      for (let index = powerUps.length - 1; index >= 0; index -= 1) {
        const item = powerUps[index];
        if (Math.hypot(item.x - player.x, item.y - player.y) < 30) {
          if (item.kind === "spread") spreadLevel = Math.min(10, spreadLevel + 1);
          if (item.kind === "rapid") rapidLevel = Math.min(8, rapidLevel + 1);
          if (item.kind === "homing") homingLevel = Math.min(7, homingLevel + 1);
          if (item.kind === "support") supportLevel = Math.min(4, supportLevel + 1);
          if (item.kind === "fan") fanLevel = Math.min(5, fanLevel + 1);
          if (item.kind === "barrier") barrierLevel = Math.min(5, barrierLevel + 1);
          if (item.kind === "counter") counterLevel = Math.min(5, counterLevel + 1);
          if (item.kind === "artillery") artilleryLevel = Math.min(5, artilleryLevel + 1);
          if (item.kind === "repair") currentLives = Math.min(5, currentLives + 1);
          currentPower = spreadLevel + rapidLevel + homingLevel + supportLevel + fanLevel + barrierLevel + counterLevel + artilleryLevel - 1;
          powerUps.splice(index, 1);
        } else if (item.y > height + 20) powerUps.splice(index, 1);
      }
      for (let index = particles.length - 1; index >= 0; index -= 1) if (particles[index].life <= 0) particles.splice(index, 1);
      for (let index = damagePopups.length - 1; index >= 0; index -= 1) {
        if (damagePopups[index].life <= 0) damagePopups.splice(index, 1);
      }
      for (let index = hitSmokes.length - 1; index >= 0; index -= 1) {
        if (hitSmokes[index].life <= 0) hitSmokes.splice(index, 1);
      }

      const playerShotLimit = lowPowerMode ? 170 : 300;
      if (playerShots.length > playerShotLimit) {
        playerShots.splice(0, playerShots.length - playerShotLimit);
      }

      if (now - lastUiUpdate > (lowPowerMode ? 200 : 120)) {
        lastUiUpdate = now;
        setScore(currentScore);
        setLives(currentLives);
        setWave(currentWave);
        setRunSeconds(Math.floor((now - runStartedAt) / 1000));
        setPower(currentPower);
        setArsenal(`${spreadLevel}·${rapidLevel}·${homingLevel}·${supportLevel}·${fanLevel}·${barrierLevel}·${counterLevel}·${artilleryLevel}`);
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
      context.save();
      if (now < screenShakeUntil) {
        const shakeDuration = screenShakeStrength >= 35 ? 1500 : screenShakeStrength >= 20 ? 820 : 460;
        const shakeProgress = clamp((screenShakeUntil - now) / shakeDuration, 0, 1);
        const shakePower = screenShakeStrength * shakeProgress;
        context.translate(
          (Math.random() - 0.5) * shakePower * 2,
          (Math.random() - 0.5) * shakePower * 2,
        );
      }
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
        if (age < 0) return;
        const flightDuration = vortex.flightDuration;
        const explodeAt = vortex.explodeAt;
        context.save();
        context.translate(vortex.x, vortex.y);

        if (age < explodeAt) {
          const suctionDuration = Math.max(1, explodeAt - flightDuration);
          const suctionProgress = clamp((age - flightDuration) / suctionDuration, 0, 1);
          const ignitionWindow = Math.min(500, suctionDuration * 0.48);
          const ignition = clamp((age - (explodeAt - ignitionWindow)) / ignitionWindow, 0, 1);
          const ignitionPulse = 0.72 + Math.sin(now / 42) * 0.28;
          context.rotate(now / 280);
          for (let ring = 0; ring < 4; ring += 1) {
            context.globalAlpha = 0.2 + ring * 0.12;
            context.strokeStyle = ignition > 0
              ? `rgba(255,${Math.round(210 - ignition * 180)},${Math.round(210 - ignition * 190)},${0.5 + ignition * 0.45})`
              : ring % 2 === 0 ? "#fff" : "#777";
            context.lineWidth = 1.5 + ring;
            context.beginPath();
            context.ellipse(0, 0, 28 + ring * 17 + suctionProgress * 12, 11 + ring * 9, ring * 0.7, 0, Math.PI * 2);
            context.stroke();
          }
          context.globalAlpha = 1;
          context.shadowColor = ignition > 0 ? "#ff1e00" : "#fff";
          context.shadowBlur = 22 + ignition * ignitionPulse * 34;
          const vortexGradient = context.createRadialGradient(-7, -8, 2, 0, 0, 29);
          vortexGradient.addColorStop(0, ignition > 0 ? "#fff0d0" : "#686868");
          vortexGradient.addColorStop(0.24, ignition > 0 ? "#ff2a00" : "#101010");
          vortexGradient.addColorStop(1, "#000");
          context.fillStyle = vortexGradient;
          context.beginPath();
          context.arc(0, 0, 29 + Math.sin(now / (ignition > 0 ? 35 : 80)) * (3 + ignition * 5), 0, Math.PI * 2);
          context.fill();
        } else {
          const blastProgress = clamp((age - explodeAt) / 650, 0, 1);
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

      battlefieldBlackHoles.forEach((blackHole) => {
        const age = now - blackHole.startedAt;
        if (age < -650 || age > blackHole.duration) return;
        const materialize = clamp((age + 650) / 650, 0, 1);
        const fade = Math.min(materialize, clamp((blackHole.duration - age) / 650, 0, 1));
        context.save();
        context.translate(blackHole.x, blackHole.y);
        context.rotate((now / 620) * blackHole.spin);
        context.globalAlpha = fade;
        context.globalCompositeOperation = "screen";
        for (let ring = 0; ring < (lowPowerMode ? 3 : 5); ring += 1) {
          context.strokeStyle = ring % 2 === 0 ? "rgba(210,210,255,.62)" : "rgba(95,95,130,.55)";
          context.lineWidth = Math.max(1, 4 - ring * 0.55);
          context.beginPath();
          context.ellipse(
            0,
            0,
            blackHole.radius + ring * 10 + Math.sin(now / 120 + ring) * 3,
            blackHole.radius * 0.38 + ring * 4,
            ring * 0.67,
            0,
            Math.PI * 2,
          );
          context.stroke();
        }
        context.globalCompositeOperation = "source-over";
        const core = context.createRadialGradient(-8, -9, 2, 0, 0, blackHole.radius);
        core.addColorStop(0, "#c9c9d4");
        core.addColorStop(0.12, "#282833");
        core.addColorStop(0.48, "#050507");
        core.addColorStop(1, "#000");
        context.fillStyle = core;
        context.shadowColor = "#7777aa";
        context.shadowBlur = lowPowerMode ? 10 : 25;
        context.beginPath();
        context.arc(0, 0, blackHole.radius * materialize, 0, Math.PI * 2);
        context.fill();
        context.restore();
      });

      if (now < dreadWindUntil) {
        const windProgress = clamp((dreadWindUntil - now) / 1650, 0, 1);
        context.save();
        context.globalAlpha = 0.16 + windProgress * 0.24;
        context.strokeStyle = "#e7e7df";
        context.lineWidth = 2;
        context.setLineDash([26, 24]);
        for (let windLine = 0; windLine < (lowPowerMode ? 5 : 10); windLine += 1) {
          const y = ((windLine * 73 + now * 0.28) % (height + 80)) - 40;
          context.beginPath();
          context.moveTo(0, y);
          context.bezierCurveTo(width * 0.28, y - 38, width * 0.68, y + 44, width, y - 12);
          context.stroke();
        }
        context.restore();
      }

      enemyLasers.forEach((laser) => {
        const age = now - laser.startedAt;
        if (age < 0) return;
        const active = age >= laser.warmup;
        const fade = active
          ? clamp(1 - (age - laser.warmup) / laser.duration, 0, 1)
          : clamp(age / laser.warmup, 0, 1);
        context.save();
        context.globalCompositeOperation = "screen";
        context.globalAlpha = active ? 0.82 + Math.sin(now / 34) * 0.16 : 0.2 + fade * 0.3;
        context.strokeStyle = active ? "#fff" : "#a42a2a";
        context.shadowColor = active ? "#ff2222" : "#7c0000";
        context.shadowBlur = active ? 25 : 8;
        context.lineWidth = active ? laser.width : 2;
        context.beginPath();
        context.moveTo(laser.x, 0);
        context.lineTo(laser.x, height);
        context.stroke();
        if (active) {
          context.globalAlpha *= 0.5;
          context.lineWidth = laser.width * 2.4;
          context.strokeStyle = "#d31515";
          context.stroke();
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
        context.fillStyle = shot.kind === "bomb" ? "#dedede" : shot.kind === "ufo" ? "#ff2418" : "#ad2020";
        context.shadowColor = "#ff3030"; context.shadowBlur = 7;
        if (shot.kind === "bomb") {
          context.save();
          context.translate(shot.x, shot.y);
          context.rotate(Math.atan2(shot.vy, shot.vx) + Math.PI / 2);
          context.beginPath();
          context.ellipse(0, 0, 11, 19, 0, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#333";
          context.fillRect(-9, -18, 18, 6);
          context.restore();
        } else if (shot.kind === "ufo") {
          const isFinalCurveShot = (shot.curveCount ?? 0) >= 3;
          context.save();
          context.translate(shot.x, shot.y);
          context.rotate(now / 170);
          context.shadowColor = isFinalCurveShot ? "#b34dff" : "#ff1800";
          context.shadowBlur = lowPowerMode ? 14 : 32;
          const curveOrb = context.createRadialGradient(
            -shot.r * 0.24,
            -shot.r * 0.28,
            2,
            0,
            0,
            shot.r,
          );
          if (isFinalCurveShot) {
            curveOrb.addColorStop(0, "#fff4ff");
            curveOrb.addColorStop(0.16, "#e3a0ff");
            curveOrb.addColorStop(0.46, "#a72cff");
            curveOrb.addColorStop(0.78, "#54108d");
            curveOrb.addColorStop(1, "#180025");
          } else {
            curveOrb.addColorStop(0, "#fff4dc");
            curveOrb.addColorStop(0.16, "#ff9a5b");
            curveOrb.addColorStop(0.46, "#ff2015");
            curveOrb.addColorStop(0.78, "#8b0000");
            curveOrb.addColorStop(1, "#250000");
          }
          context.fillStyle = curveOrb;
          context.beginPath();
          context.arc(0, 0, shot.r, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = isFinalCurveShot
            ? "rgba(239,190,255,.9)"
            : "rgba(255,185,145,.82)";
          context.lineWidth = 3;
          context.stroke();
          context.strokeStyle = isFinalCurveShot
            ? "rgba(188,75,255,.65)"
            : "rgba(255,45,20,.5)";
          for (let ring = 0; ring < 3; ring += 1) {
            context.beginPath();
            context.ellipse(0, 0, shot.r * (1.18 + ring * 0.16), shot.r * (0.48 + ring * 0.1), ring * 1.05, 0, Math.PI * 2);
            context.stroke();
          }
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

      dreadDebris.forEach((debris) => {
        context.save();
        context.translate(debris.x, debris.y);
        context.rotate(debris.angle);
        context.shadowColor = "#d0d0ca";
        context.shadowBlur = lowPowerMode ? 3 : 8;
        context.fillStyle = "#383838";
        context.strokeStyle = "#c4c4bd";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(-debris.r, -debris.r * 0.45);
        context.lineTo(debris.r * 0.8, -debris.r * 0.7);
        context.lineTo(debris.r, debris.r * 0.3);
        context.lineTo(debris.r * 0.15, debris.r);
        context.lineTo(-debris.r * 0.85, debris.r * 0.48);
        context.closePath();
        context.fill();
        context.stroke();
        context.fillStyle = "#b7b7b0";
        context.fillRect(-debris.r * 0.25, -debris.r * 0.8, debris.r * 0.2, debris.r * 1.35);
        context.restore();
      });

      hitSmokes.forEach((smoke) => {
        const smokeAlpha = clamp(smoke.life / smoke.maxLife, 0, 1) * 0.55;
        context.save();
        context.globalAlpha = smokeAlpha;
        const smokeGradient = context.createRadialGradient(
          smoke.x - smoke.size * 0.2,
          smoke.y - smoke.size * 0.2,
          0,
          smoke.x,
          smoke.y,
          smoke.size,
        );
        smokeGradient.addColorStop(0, "rgba(190,190,190,.8)");
        smokeGradient.addColorStop(0.45, "rgba(105,105,105,.55)");
        smokeGradient.addColorStop(1, "rgba(45,45,45,0)");
        context.fillStyle = smokeGradient;
        context.beginPath();
        context.arc(smoke.x, smoke.y, smoke.size, 0, Math.PI * 2);
        context.fill();
        context.restore();
      });

      enemies.forEach((enemy) => {
        const damageRatio = clamp(1 - enemy.hp / enemy.maxHp, 0, 1);
        const enemyScale = enemy.kind === "dreadnought" ? 12.35 : enemy.kind === "fortress" ? 3.8 : enemy.kind === "boss" ? 2.3 : enemy.kind === "bomber" ? 1.25 : 0.8;
        if (damageRatio >= 0.28) {
          context.save();
          const smokeCount = lowPowerMode ? 2 : Math.min(7, 2 + Math.floor(damageRatio * 6));
          for (let smokeIndex = 0; smokeIndex < smokeCount; smokeIndex += 1) {
            const drift = Math.sin(now / 210 + enemy.phase + smokeIndex * 1.7);
            const rise = (now / 18 + smokeIndex * 14) % 48;
            context.globalAlpha = 0.12 + damageRatio * 0.34;
            context.fillStyle = smokeIndex % 2 ? "#777" : "#3e3e3e";
            context.beginPath();
            context.arc(
              enemy.x + drift * (7 + smokeIndex * 2),
              enemy.y - enemy.r * 0.35 - rise,
              (3 + damageRatio * 8 + smokeIndex * 0.7) * Math.min(1.7, enemyScale),
              0,
              Math.PI * 2,
            );
            context.fill();
          }
          context.restore();
        }
        drawPlane(enemy.x, enemy.y, enemyScale, true, enemy.spinAngle ?? 0);
        if ((enemy.kind === "fortress" || enemy.kind === "dreadnought") && enemy.ufoChargeStartedAt) {
          const chargeDuration = enemy.kind === "dreadnought" ? 1650 : 1350;
          const chargeProgress = clamp((now - enemy.ufoChargeStartedAt) / chargeDuration, 0, 1);
          const chargeOffsets = enemy.kind === "dreadnought" ? [-enemy.r * 0.58, enemy.r * 0.58] : [0];
          chargeOffsets.forEach((chargeOffset) => {
            const chargeX = enemy.x + chargeOffset;
            const chargeY = enemy.y + enemy.r * 0.72;
            const chargeRadius = 5 + chargeProgress * (enemy.kind === "dreadnought" ? 44 : 34);
            context.save();
            context.globalCompositeOperation = "screen";
            context.shadowColor = "#ff2418";
            context.shadowBlur = 16 + chargeProgress * 34;
            const chargeGradient = context.createRadialGradient(chargeX - 4, chargeY - 5, 1, chargeX, chargeY, chargeRadius);
            chargeGradient.addColorStop(0, "#fff8dc");
            chargeGradient.addColorStop(0.28, "#ff9a55");
            chargeGradient.addColorStop(0.7, "#ff2117");
            chargeGradient.addColorStop(1, "rgba(80,0,0,0)");
            context.fillStyle = chargeGradient;
            context.beginPath();
            context.arc(chargeX, chargeY, chargeRadius, 0, Math.PI * 2);
            context.fill();
            context.restore();
          });
        }
        if (enemy.isEntering) {
          context.save();
          context.globalAlpha = 0.5;
          context.strokeStyle = "#d8d8d2";
          context.lineWidth = 1.5;
          context.setLineDash([5, 5]);
          context.beginPath();
          context.arc(enemy.x, enemy.y, enemy.r * 1.35, 0, Math.PI * 2);
          context.stroke();
          context.setLineDash([]);
          context.fillStyle = "#d8d8d2";
          context.font = "700 8px monospace";
          context.textAlign = "center";
          context.fillText("APPROACH", enemy.x, enemy.y + enemy.r + 16);
          context.restore();
        }
        if (enemy.damageFlashUntil && now < enemy.damageFlashUntil) {
          context.save();
          context.globalCompositeOperation = "screen";
          context.globalAlpha = clamp((enemy.damageFlashUntil - now) / 120, 0, 1);
          context.strokeStyle = "#fff";
          context.lineWidth = 3;
          context.shadowColor = "#fff";
          context.shadowBlur = 18;
          context.beginPath();
          context.arc(enemy.x, enemy.y, enemy.r * 1.15, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }
        if (enemy.kind === "fortress" || enemy.kind === "dreadnought") {
          context.fillStyle = "#222";
          const gunOffsets = enemy.kind === "dreadnought" ? [-150, -108, -58, 58, 108, 150] : [-58, -28, 28, 58];
          gunOffsets.forEach((offset) => {
            context.beginPath();
            context.arc(enemy.x + offset, enemy.y - 5, enemy.kind === "dreadnought" ? 14 : 10, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = "#ddd";
            context.stroke();
          });
        }
        if (enemy.kind === "boss" || enemy.kind === "fortress" || enemy.kind === "dreadnought") {
          const barWidth = enemy.kind === "dreadnought" ? Math.min(width * 0.78, 520) : enemy.kind === "fortress" ? 190 : 110;
          const barY = enemy.y - (enemy.kind === "dreadnought" ? enemy.r + 26 : enemy.kind === "fortress" ? 118 : 70);
          context.fillStyle = "rgba(255,255,255,.15)";
          context.fillRect(enemy.x - barWidth / 2, barY, barWidth, enemy.kind === "dreadnought" ? 10 : 6);
          context.fillStyle = "#c8c8c8";
          context.fillRect(enemy.x - barWidth / 2, barY, barWidth * (enemy.hp / enemy.maxHp), enemy.kind === "dreadnought" ? 10 : 6);
        }
      });
      powerUps.forEach((item) => {
        if (item.kind === "repair") {
          context.save();
          context.fillStyle = "#28a745";
          context.strokeStyle = "#d7ffe0";
          context.lineWidth = 2;
          context.shadowColor = "#45ff76";
          context.shadowBlur = lowPowerMode ? 7 : 13;
          context.fillRect(item.x - 13, item.y - 13, 26, 26);
          context.strokeRect(item.x - 13, item.y - 13, 26, 26);
          context.fillStyle = "#fff";
          context.fillRect(item.x - 3, item.y - 9, 6, 18);
          context.fillRect(item.x - 9, item.y - 3, 18, 6);
          context.restore();
          return;
        }
        const itemLabel: Record<UpgradeKind, string> = {
          spread: "M", rapid: "R", homing: "H", support: "S",
          fan: "F", barrier: "B", counter: "C",
          artillery: "A", repair: "+",
        };
        context.fillStyle = "#bbb";
        context.strokeStyle = "#111"; context.lineWidth = 2;
        context.beginPath(); context.arc(item.x, item.y, 13, 0, Math.PI * 2); context.fill(); context.stroke();
        context.fillStyle = "#111"; context.font = "900 13px monospace"; context.textAlign = "center";
        context.fillText(itemLabel[item.kind], item.x, item.y + 5);
      });
      megaBlasts.forEach((blast) => {
        const blastAge = now - blast.startedAt;
        if (blastAge < 0 || blastAge > 800) return;
        const progress = blastAge / 800;
        const radius = blast.radius * (0.18 + progress * 0.95);
        context.save();
        context.globalCompositeOperation = "screen";
        context.globalAlpha = Math.max(0, 0.95 - progress);
        context.shadowColor = "#fff1b8";
        context.shadowBlur = lowPowerMode ? 16 : 42;
        const blastGradient = context.createRadialGradient(
          blast.x,
          blast.y,
          0,
          blast.x,
          blast.y,
          radius,
        );
        blastGradient.addColorStop(0, "rgba(255,255,255,.98)");
        blastGradient.addColorStop(0.2, "rgba(255,226,135,.9)");
        blastGradient.addColorStop(0.48, "rgba(255,105,25,.72)");
        blastGradient.addColorStop(1, "rgba(120,0,0,0)");
        context.fillStyle = blastGradient;
        context.beginPath();
        context.arc(blast.x, blast.y, radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.9 - progress)})`;
        context.lineWidth = Math.max(2, 8 * (1 - progress));
        context.beginPath();
        context.arc(blast.x, blast.y, radius * 1.18, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      });
      particles.forEach((particle) => {
        context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
        context.fillStyle = particle.size > 2.5 ? "#eee" : "#666";
        context.fillRect(particle.x, particle.y, particle.size, particle.size);
      });
      context.globalAlpha = 1;

      damagePopups.forEach((popup) => {
        context.save();
        context.globalAlpha = clamp(popup.life / popup.maxLife, 0, 1);
        context.fillStyle = "#fff";
        context.strokeStyle = "#111";
        context.lineWidth = 3;
        context.font = `900 ${lowPowerMode ? 12 : 15}px monospace`;
        context.textAlign = "center";
        context.strokeText(`-${popup.value}`, popup.x, popup.y);
        context.fillText(`-${popup.value}`, popup.x, popup.y);
        context.restore();
      });

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

      if (currentLives > 0) {
        context.save();
        if (currentLives <= 2) {
          const critical = currentLives === 1;
          const smokeCount = lowPowerMode ? 3 : critical ? 8 : 5;
          for (let smokeIndex = 0; smokeIndex < smokeCount; smokeIndex += 1) {
            const sway = Math.sin(now / 135 + smokeIndex * 1.9) * (5 + smokeIndex * 1.5);
            const rise = (now / 12 + smokeIndex * 17) % 72;
            context.globalAlpha = critical ? 0.38 : 0.22;
            context.fillStyle = smokeIndex % 2 ? "#777" : "#3b3b3b";
            context.beginPath();
            context.arc(player.x + sway, player.y + 15 - rise, 5 + smokeIndex * 0.9, 0, Math.PI * 2);
            context.fill();
          }
          if (critical) {
            for (let flameIndex = 0; flameIndex < (lowPowerMode ? 3 : 6); flameIndex += 1) {
              const flameX = player.x + Math.sin(now / 70 + flameIndex * 2.1) * 12;
              const flameHeight = 15 + ((now / 18 + flameIndex * 11) % 24);
              context.globalAlpha = 0.7;
              context.fillStyle = flameIndex % 2 ? "#ff9d00" : "#e33a16";
              context.beginPath();
              context.moveTo(flameX - 5, player.y + 17);
              context.quadraticCurveTo(flameX, player.y + 8 - flameHeight, flameX + 5, player.y + 17);
              context.fill();
            }
          }
        }
        context.restore();

        if (now >= invincibleUntil || Math.floor(now / 90) % 2 === 0) {
          drawPlane(player.x, player.y, 1.08, false);
        }
        if (now < playerHitFlashUntil) {
          const hitProgress = 1 - (playerHitFlashUntil - now) / 420;
          context.save();
          context.globalAlpha = 1 - hitProgress;
          context.strokeStyle = "#fff";
          context.lineWidth = 5 - hitProgress * 3;
          context.shadowColor = "#fff";
          context.shadowBlur = 25;
          context.beginPath();
          context.arc(player.x, player.y, 24 + hitProgress * 48, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }
      } else {
        const explosionAge = now - playerDestroyedAt;
        if (explosionAge >= 0 && explosionAge < 850) {
          const progress = explosionAge / 850;
          context.save();
          const radius = 22 + progress * 105;
          const blast = context.createRadialGradient(player.x, player.y, 0, player.x, player.y, radius);
          blast.addColorStop(0, `rgba(255,255,255,${1 - progress})`);
          blast.addColorStop(0.22, `rgba(255,170,30,${0.95 - progress * 0.7})`);
          blast.addColorStop(0.58, `rgba(220,45,15,${0.78 - progress * 0.65})`);
          blast.addColorStop(1, "rgba(30,30,30,0)");
          context.fillStyle = blast;
          context.beginPath();
          context.arc(player.x, player.y, radius, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }
      }

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
      context.restore();
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
    setScore(0); setLives(3); setWave(1); setPower(1); setArsenal("1·1·0·0·0·0·0·0");
    setSkillCharges(0); setSkillSeconds(30); setSurvivalPoints(0); setRunSeconds(0); setGameOver(false);
    setMissionPhase("combat");
    const animation = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animation);
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close().catch(() => undefined);
      }
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
    };
  }, [started, restartRef.current]);

  if (!mounted) return null;

  const formattedRunTime = `${String(Math.floor(runSeconds / 60)).padStart(2, "0")}:${String(runSeconds % 60).padStart(2, "0")}`;
  const playBgm = () => {
    const bgm = bgmRef.current;
    if (!bgm) return;
    bgm.volume = 0.35;
    bgm.loop = true;
    bgm.muted = bgmMuted;
    void bgm.play().catch(() => undefined);
  };
  const stopBgm = () => {
    const bgm = bgmRef.current;
    if (!bgm) return;
    bgm.pause();
    bgm.currentTime = 0;
  };
  const startMission = () => {
    setMissionPhase("combat");
    if (bgmRef.current) bgmRef.current.currentTime = 0;
    playBgm();
    setStarted(true);
  };
  const restartMission = () => {
    restartRef.current += 1;
    setMissionPhase("combat");
    setStarted(false);
    if (bgmRef.current) bgmRef.current.currentTime = 0;
    playBgm();
    requestAnimationFrame(() => setStarted(true));
  };
  const exitMission = () => {
    stopBgm();
    onExit();
  };
  const toggleBgm = () => {
    const nextMuted = !bgmMuted;
    setBgmMuted(nextMuted);
    const bgm = bgmRef.current;
    if (!bgm) return;
    bgm.muted = nextMuted;
    if (!nextMuted && started && missionPhase === "combat") {
      void bgm.play().catch(() => undefined);
    }
  };
  // 10개 전투 구역을 돌파하면 지구 궤도에 도착하는 귀환 항로.
  const earthReturnProgress = missionPhase === "combat"
    ? clamp((score / (SCORE_PER_WAVE * 10)) * 100, 0, 99)
    : 100;
  const earthDistance = Math.max(0, Math.ceil(100 - earthReturnProgress));

  return createPortal(
    <section className="fixed inset-0 z-[999999] overflow-hidden overscroll-none bg-[#080808] font-mono text-white">
      <audio
        ref={bgmRef}
        src="/audio/1952-bgm-viking-overture.mp3"
        preload="auto"
        loop
        playsInline
      />
      <div className="relative mx-auto flex h-[100dvh] w-full max-w-[1120px] bg-black lg:border-x lg:border-white/10">
        <aside className="relative hidden w-[300px] shrink-0 flex-col overflow-hidden border-r border-white/15 bg-[#070707] px-5 py-6 lg:flex">
          <div className="border-b border-white/15 pb-5">
            <p className="text-[9px] font-black tracking-[0.35em] text-white/35">HOO AIR FORCE</p>
            <h2 className="mt-2 text-2xl font-black tracking-[0.12em]">1952 랭킹</h2>
            <p className="mt-2 text-[11px] font-bold leading-5 text-white/40">한 번의 출격에서 달성한<br />최고 점수 기준 TOP 10</p>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-hidden">
            {rankingLoading ? (
              <div className="flex h-full items-center justify-center text-[10px] font-black tracking-[0.22em] text-white/30">RECEIVING...</div>
            ) : rankings.length > 0 ? (
              <ol className="space-y-2">
                {rankings.slice(0, 10).map((row, index) => {
                  const minutes = Math.floor(row.bestSeconds / 60);
                  const seconds = row.bestSeconds % 60;
                  return (
                    <li key={`${row.userId}-${index}`} className={`grid grid-cols-[30px_1fr_auto] items-center gap-2 border px-2.5 py-2.5 ${index < 3 ? "border-white/25 bg-white/[0.08]" : "border-white/10 bg-white/[0.025]"}`}>
                      <strong className={`text-center text-sm ${index === 0 ? "text-[#f5d76e]" : index === 1 ? "text-white/80" : index === 2 ? "text-[#bd8b63]" : "text-white/35"}`}>
                        {String(index + 1).padStart(2, "0")}
                      </strong>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-white"><span className="mr-1.5">{row.avatarEmoji || "✈️"}</span>{row.nickname}</p>
                        <p className="mt-1 text-[8px] font-bold tracking-wider text-white/35">WAVE {String(row.bestWave).padStart(2, "0")} · {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</p>
                      </div>
                      <strong className="text-right text-sm font-black tabular-nums text-white">{row.bestScore.toLocaleString()}</strong>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="flex h-full flex-col items-center justify-center border border-dashed border-white/10 px-5 text-center">
                <span className="text-3xl opacity-30">✈</span>
                <p className="mt-3 text-xs font-black text-white/45">아직 등록된 기록이 없습니다.</p>
                <p className="mt-2 text-[9px] leading-4 text-white/25">첫 출격으로 랭킹을<br />점령해보세요.</p>
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-white/10 pt-4 text-[8px] font-bold tracking-[0.16em] text-white/25">
            AUTO REFRESH · 30 SEC
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:repeating-linear-gradient(0deg,transparent,transparent_3px,#fff_4px)]" />
        </aside>

        <div className="relative flex min-w-0 flex-1 flex-col bg-black">
        <header className="relative z-20 flex h-[calc(58px+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-white/15 bg-black px-3 pt-[env(safe-area-inset-top)] sm:h-[84px] sm:px-6 sm:pt-0">
          <div>
            <p className="text-[7px] font-black tracking-[0.28em] text-white/40 sm:text-[9px] sm:tracking-[0.35em]">CLASSIFIED AIR COMMAND</p>
            <h1 className="text-xl font-black tracking-[0.14em] sm:text-3xl sm:tracking-[0.16em]">HOO 1952</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleBgm}
              aria-pressed={!bgmMuted}
              className="min-h-9 rounded-full border border-white/20 px-3 text-[9px] font-black tracking-wider text-white/75 transition active:scale-95 sm:min-h-11 sm:px-4 sm:text-xs"
            >
              {bgmMuted ? "BGM OFF" : "BGM ON"}
            </button>
            <button type="button" onClick={exitMission} className="min-h-9 rounded-full border border-white/25 px-3 text-xs font-black transition active:scale-95 sm:min-h-11 sm:px-6 sm:text-sm">
              나가기 ×
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <canvas ref={canvasRef} className="h-full w-full touch-none select-none" aria-label="HOO 1952 비행 슈팅 게임" />

          {started && !gameOver && missionPhase === "combat" && (
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

          <div className="pointer-events-none absolute right-2 top-2 z-10 w-[138px] border border-white/25 bg-black/85 p-1.5 shadow-[0_5px_18px_rgba(0,0,0,.45)] backdrop-blur-sm sm:right-5 sm:top-4 sm:w-[224px] sm:p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[6px] font-black tracking-[0.16em] text-white/45 sm:text-[9px]">EARTH RETURN RADAR</p>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white shadow-[0_0_8px_white] sm:h-2 sm:w-2" />
            </div>

            <div className="relative mt-1.5 h-[42px] overflow-hidden border border-white/15 bg-[#080808] sm:mt-2 sm:h-[68px]">
              <div className="absolute left-1/2 top-1/2 h-[78px] w-[78px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 sm:h-[124px] sm:w-[124px]" />
              <div className="absolute left-1/2 top-1/2 h-[48px] w-[48px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 sm:h-[78px] sm:w-[78px]" />
              <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
              <div className="absolute left-0 top-1/2 h-px w-full bg-white/10" />
              <div className="absolute inset-0 origin-center animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,.16)_24deg,transparent_62deg)]" />

              <span className="absolute right-[8%] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/80 bg-[#1a1a1a] shadow-[0_0_10px_rgba(255,255,255,.65)] sm:h-5 sm:w-5">
                <i className="absolute left-[22%] top-[23%] h-[25%] w-[32%] rounded-full bg-white/50" />
              </span>
              <span
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] text-white [text-shadow:0_0_7px_white] transition-[left] duration-700 sm:text-sm"
                style={{ left: `${8 + earthReturnProgress * 0.78}%` }}
              >
                ▲
              </span>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[6px] font-black tracking-[0.08em] sm:mt-2 sm:text-[9px]">
              <span className="text-white/40">DEEP SPACE</span>
              <span className="text-white">EARTH</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden bg-white/10 sm:h-1.5">
              <div className="h-full bg-white shadow-[0_0_8px_white] transition-[width] duration-700" style={{ width: `${earthReturnProgress}%` }} />
            </div>
            <p className="mt-1 text-center text-[6px] font-black tracking-[0.1em] text-white/55 sm:text-[8px]">
              {missionPhase === "combat"
                ? `DISTANCE ${String(earthDistance).padStart(3, "0")}% · WAVE ${String(wave).padStart(2, "0")}`
                : "EARTH ARRIVAL · 100%"}
            </p>
          </div>

          {!started && (
            <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-black px-4 pb-[env(safe-area-inset-bottom)] text-center sm:px-6">
              <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_18%_22%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_73%_31%,white_0_1px,transparent_1.5px),radial-gradient(circle_at_45%_76%,white_0_1px,transparent_1.5px)] [background-size:97px_83px,131px_109px,157px_137px]" />
              <div className="relative w-full max-w-lg border border-white/20 bg-[#090909]/95 p-5 shadow-[0_0_55px_rgba(255,255,255,.08)] sm:p-8">
                <div className="flex items-center justify-between border-b border-white/15 pb-3">
                  <p className="text-left text-[8px] font-black tracking-[0.3em] text-white/45 sm:text-[10px]">EMERGENCY TRANSMISSION</p>
                  <span className="animate-pulse text-[8px] font-black tracking-[0.16em] text-white sm:text-[10px]">● SIGNAL</span>
                </div>

                <div className="mx-auto mt-5 max-w-md border-y border-white/15 bg-white/[0.035] px-3 py-6 sm:px-6 sm:py-8">
                  <p className="mb-4 text-[9px] font-black tracking-[0.24em] text-white/40 sm:text-[11px]">발신지 지구</p>
                  <p className="text-base font-black leading-8 tracking-[0.08em] text-white sm:text-xl sm:leading-10">
                    “지구<span className="text-white/35">.....</span> 위험하다.<br />
                    외계<span className="text-white/25">..........</span>SOS<span className="text-white/30">......</span>”
                  </p>
                </div>

                <p className="mt-5 text-[10px] font-bold leading-5 text-white/50 sm:text-xs sm:leading-6">
                  우주 탐사 임무 중 정체불명의 적 함대가 귀환 항로를 차단했습니다.<br className="hidden sm:block" />
                  지구까지의 항로를 확보해야 합니다.
                </p>

                <h2 className="mt-6 text-base font-black tracking-[0.06em] text-white sm:text-xl">지구로 돌아가시겠습니까?</h2>
                <button type="button" onClick={startMission} className="mt-5 min-h-14 w-full border-2 border-white bg-white px-8 text-base font-black tracking-[0.18em] text-black transition hover:bg-black hover:text-white active:scale-[0.98]">
                  출격하기
                </button>
                <p className="mt-3 text-[8px] font-bold tracking-[0.12em] text-white/30 sm:text-[9px]">DESTINATION · EARTH</p>
              </div>
            </div>
          )}

          {missionPhase === "landing" && (
            <div className="hoo-earth-arrival absolute inset-0 z-40 overflow-hidden bg-[#9b9b9b]">
              <div className="hoo-arrival-clouds absolute inset-0 z-30 bg-white">
                {Array.from({ length: 18 }, (_, index) => (
                  <i
                    key={index}
                    className="absolute rounded-full bg-white blur-md"
                    style={{
                      left: `${(index * 31) % 112 - 8}%`,
                      top: `${(index * 47) % 105 - 8}%`,
                      width: `${120 + (index % 5) * 54}px`,
                      height: `${72 + (index % 4) * 38}px`,
                      animationDelay: `${(index % 6) * 0.08}s`,
                    }}
                  />
                ))}
              </div>

              <div className="absolute right-3 top-3 z-50 w-[150px] border border-white/45 bg-black/70 p-2 font-mono text-white sm:right-6 sm:top-6 sm:w-[220px] sm:p-3">
                <div className="flex items-center justify-between text-[7px] font-black tracking-[0.18em] sm:text-[10px]">
                  <span>EARTH APPROACH</span><b className="animate-pulse">● LOCK</b>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden bg-white/20 sm:h-2">
                  <div className="hoo-arrival-meter h-full bg-white shadow-[0_0_12px_white]" />
                </div>
                <p className="mt-1 text-center text-[8px] font-black tracking-[0.2em] sm:text-[11px]">ARRIVAL 100%</p>
              </div>

              <div className="hoo-horizon absolute inset-0 bg-[linear-gradient(#d5d5d5_0%,#aaa_38%,#6d6d6d_39%,#333_100%)]" />
              <div className="hoo-runway absolute bottom-[-10%] left-1/2 h-[72%] w-[92%] -translate-x-1/2 bg-[#252525] [clip-path:polygon(39%_0,61%_0,100%_100%,0_100%)]">
                <div className="absolute left-1/2 top-0 h-full w-[2%] -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,#eee_0_5%,transparent_5%_11%)]" />
                <div className="absolute inset-y-0 left-[6%] w-[1.2%] bg-white/80 [transform:rotate(13deg)]" />
                <div className="absolute inset-y-0 right-[6%] w-[1.2%] bg-white/80 [transform:rotate(-13deg)]" />
              </div>

              <div className="hoo-soldier-line absolute bottom-[9%] left-[3%] z-20 flex h-[48%] w-[32%] origin-bottom items-end justify-between [transform:perspective(700px)_rotateY(18deg)]">
                {Array.from({ length: 18 }, (_, index) => (
                  <span key={index} className="relative block h-[18px] w-[7px] bg-[#151515] sm:h-[28px] sm:w-[10px]" style={{ transform: `scale(${0.55 + index * 0.045})` }}>
                    <i className="absolute -left-[1px] -top-[7px] h-[8px] w-[8px] rounded-full bg-[#d5d5d5] sm:-top-[10px] sm:h-[11px] sm:w-[11px]" />
                    <i className="absolute left-[-5px] top-[4px] h-[3px] w-[17px] bg-[#151515] sm:left-[-7px] sm:w-[24px]" />
                  </span>
                ))}
              </div>
              <div className="hoo-soldier-line absolute bottom-[9%] right-[3%] z-20 flex h-[48%] w-[32%] origin-bottom items-end justify-between [transform:perspective(700px)_rotateY(-18deg)]">
                {Array.from({ length: 18 }, (_, index) => (
                  <span key={index} className="relative block h-[18px] w-[7px] bg-[#151515] sm:h-[28px] sm:w-[10px]" style={{ transform: `scale(${0.55 + (17 - index) * 0.045})` }}>
                    <i className="absolute -left-[1px] -top-[7px] h-[8px] w-[8px] rounded-full bg-[#d5d5d5] sm:-top-[10px] sm:h-[11px] sm:w-[11px]" />
                    <i className="absolute left-[-5px] top-[4px] h-[3px] w-[17px] bg-[#151515] sm:left-[-7px] sm:w-[24px]" />
                  </span>
                ))}
              </div>

              <div className="hoo-landing-plane absolute left-1/2 top-[18%] z-30 h-[58px] w-[74px] -translate-x-1/2 sm:h-[88px] sm:w-[112px]">
                <i className="absolute left-1/2 top-0 h-full w-[17%] -translate-x-1/2 bg-white [clip-path:polygon(50%_0,100%_82%,65%_100%,35%_100%,0_82%)]" />
                <i className="absolute left-0 top-[48%] h-[18%] w-full bg-white [clip-path:polygon(0_80%,43%_0,57%_0,100%_80%,56%_62%,44%_62%)]" />
                <i className="absolute bottom-[2%] left-[30%] h-[20%] w-[40%] bg-white [clip-path:polygon(0_100%,40%_0,60%_0,100%_100%)]" />
              </div>

              <div className="hoo-touchdown absolute bottom-[8%] left-1/2 z-20 h-3 w-3 -translate-x-1/2 rounded-full bg-white shadow-[0_0_70px_35px_rgba(255,255,255,.65)]" />
              <style>{`
                .hoo-earth-arrival { animation: hooGreyIn 1.8s ease-out both; }
                .hoo-arrival-clouds { animation: hooCloudPass 4.1s ease-in-out forwards; }
                .hoo-arrival-clouds i { animation: hooCloudDrift 3.6s ease-out both; }
                .hoo-horizon, .hoo-runway, .hoo-soldier-line, .hoo-touchdown { animation: hooGroundReveal 9.2s ease both; }
                .hoo-landing-plane { animation: hooLandingPlane 9.2s cubic-bezier(.28,.7,.18,1) forwards; }
                .hoo-arrival-meter { animation: hooArrivalMeter 8.6s ease-out forwards; }
                @keyframes hooGreyIn { from { filter: grayscale(1) brightness(.25); } to { filter: grayscale(1) brightness(1); } }
                @keyframes hooCloudDrift { from { transform: translate3d(-12%,8%,0) scale(.8); } to { transform: translate3d(24%,-12%,0) scale(1.35); } }
                @keyframes hooCloudPass { 0%,28% { opacity:1; } 52% { opacity:.94; } 72%,100% { opacity:0; visibility:hidden; } }
                @keyframes hooGroundReveal { 0%,42% { opacity:0; } 58%,100% { opacity:1; } }
                @keyframes hooLandingPlane { 0% { transform:translate(-50%,-20%) scale(.18); filter:blur(2px); } 42% { transform:translate(-50%,55%) scale(.55); filter:blur(0); } 72% { transform:translate(-50%,360%) scale(1.35); } 100% { transform:translate(-50%,620%) scale(2.8); } }
                @keyframes hooArrivalMeter { from { width:0; } to { width:100%; } }
              `}</style>
            </div>
          )}

          {missionPhase === "returned" && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white px-5 text-center text-black">
              <div className="w-full max-w-md border-4 border-black bg-white p-7 shadow-[12px_12px_0_#999] sm:p-10">
                <p className="text-[9px] font-black tracking-[0.4em] text-black/45 sm:text-xs">EARTH RETURN COMPLETE</p>
                <h2 className="mt-4 text-2xl font-black tracking-[0.08em] sm:text-4xl">무사히 귀환했습니다.</h2>
                <div className="mx-auto mt-6 h-px w-24 bg-black/30" />
                <button
                  type="button"
                  onClick={() => { setMissionPhase("report"); setGameOver(true); }}
                  className="mt-7 min-h-14 w-full bg-black px-5 text-sm font-black tracking-[0.15em] text-white transition active:scale-[0.98] sm:text-base"
                >
                  다음 습격 준비하기
                </button>
              </div>
            </div>
          )}

          {gameOver && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 px-6 text-center backdrop-blur-[2px]">
              <div className="w-full max-w-sm border border-white/25 bg-[#111] p-7 shadow-2xl">
                <p className="text-[10px] font-black tracking-[0.38em] text-white/45">MISSION REPORT</p>
                <h2 className="mt-3 text-3xl font-black tracking-widest">{missionPhase === "report" ? "귀환 보고서" : "작전 종료"}</h2>
                <p className="mt-5 text-sm text-white/60">최종 점수</p>
                <strong className="mt-1 block text-4xl font-black">{score.toLocaleString()}</strong>
                <p className="mt-4 text-xs font-black tracking-wider text-white/45">작전 진행시간</p>
                <strong className="mt-1 block text-xl font-black text-white">{formattedRunTime}</strong>
                <p className="mt-4 text-xs font-black tracking-wider text-white/45">생존 랭킹 점수</p>
                <strong className="mt-1 block text-xl font-black text-white">+{survivalPoints}점</strong>
                <button type="button" onClick={restartMission} className="mt-7 min-h-13 w-full bg-white px-6 py-3.5 font-black tracking-widest text-black transition active:scale-95">
                  {missionPhase === "report" ? "다음 습격 출격" : "다시 출격"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 z-50 opacity-[0.06] [background-image:repeating-linear-gradient(0deg,transparent,transparent_3px,#fff_4px)]" />
        </div>
      </div>
    </section>,
    document.body,
  );
}

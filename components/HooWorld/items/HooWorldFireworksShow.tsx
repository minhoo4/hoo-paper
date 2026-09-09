"use client";
import { useEffect, useMemo, useRef, } from "react";
export type HooWorldFireworksOutcome = "success" | "failure";
export type HooWorldFireworksSession = {
    sessionId: string;
    itemId: string;
    fieldId: number;
    triggeredByUserId: string;
    x: number;
    y: number;
    outcome: HooWorldFireworksOutcome;
    startedAt: number;
    fuseEndsAt: number;
    fireworksEndsAt: number;
    finaleEndsAt: number;
    glitterEndsAt: number;
    endsAt: number;
};
type FireworkBurstKind = "peony" | "chrysanthemum" | "sakura" | "ring" | "double_ring" | "willow" | "brocade" | "kamuro" | "palm" | "dahlia" | "crossette" | "snow_crystal" | "heart" | "star" | "strobe" | "master_finale";
type FireworkParticleRole = "spark" | "petal" | "willow" | "ember" | "strobe" | "star" | "crossette_child" | "outline_echo" | "white_rain" | "impact_shard";
type FireworkPaletteName = "new_year_gold" | "sakura" | "pearl" | "winter_sky" | "romantic_lilac" | "festival_mix";
type FireworkPalette = {
    name: FireworkPaletteName;
    primary: string;
    secondary: string;
    tertiary: string;
    core: string;
    smoke: string;
};
type FireworkParticlePlan = {
    id: string;
    role: FireworkParticleRole;
    angleDeg: number;
    originAngleDeg: number;
    originRadiusScale: number;
    radiusScale: number;
    durationMs: number;
    delayMs: number;
    sizeScale: number;
    alpha: number;
    gravityScale: number;
    drag: number;
    swayAmplitudeScale: number;
    swayFrequency: number;
    tangentCurlScale: number;
    twinkle: number;
    strobe: number;
    trailLength: number;
    trailWidthScale: number;
    rotationDeg: number;
    rotationSpeedDeg: number;
    colorA: string;
    colorB: string;
    glow: number;
};
type FireworkBurstPlan = {
    id: string;
    kind: FireworkBurstKind;
    x: number;
    y: number;
    at: number;
    durationMs: number;
    radiusScale: number;
    rotationDeg: number;
    palette: FireworkPalette;
    particles: FireworkParticlePlan[];
    haloStrength: number;
    coreStrength: number;
    ringCount: number;
    romanticBloom: number;
};
type FireworkRocketPlan = {
    id: string;
    burstKind: FireworkBurstKind;
    launchAt: number;
    burstAt: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    sway: number;
    color: string;
    trailWidthScale: number;
    smokeStrength: number;
    impactScale: number;
};
type FireworkGlitterPlan = {
    id: string;
    x: number;
    y: number;
    sizeScale: number;
    driftXScale: number;
    driftYScale: number;
    durationMs: number;
    phase: number;
    twinkle: number;
    color: string;
};
type FestivalBokehPlan = {
    id: string;
    x: number;
    y: number;
    radiusScale: number;
    alpha: number;
    phase: number;
    color: string;
};
type NiagaraTrailPlan = {
    id: string;
    x: number;
    topY: number;
    lengthScale: number;
    widthScale: number;
    swayScale: number;
    phase: number;
    delayMs: number;
    durationMs: number;
    color: string;
    alpha: number;
};
type SakuraAfterglowPlan = {
    id: string;
    x: number;
    y: number;
    sizeScale: number;
    driftXScale: number;
    driftYScale: number;
    rotationDeg: number;
    rotationSpeedDeg: number;
    phase: number;
    delayMs: number;
    durationMs: number;
    colorA: string;
    colorB: string;
    alpha: number;
};
type ReflectionGlowPlan = {
    id: string;
    x: number;
    widthScale: number;
    heightScale: number;
    phase: number;
    color: string;
    alpha: number;
};
type SenrinBloomPlan = {
    id: string;
    x: number;
    y: number;
    at: number;
    durationMs: number;
    radiusScale: number;
    rayCount: number;
    rotationDeg: number;
    colorA: string;
    colorB: string;
    alpha: number;
    twinkle: number;
};

type OutlineScatterPlan = {
    id: string;
    burstId: string;
    at: number;
    durationMs: number;
    x: number;
    y: number;
    angleDeg: number;
    radiusScale: number;
    lagScale: number;
    backtrackScale: number;
    tangentDriftScale: number;
    gravityScale: number;
    windScale: number;
    phase: number;
    sizeScale: number;
    trailScale: number;
    alpha: number;
    twinkle: number;
    colorA: string;
    colorB: string;
};

type FinaleWhiteRainPlan = {
    id: string;
    at: number;
    durationMs: number;
    startX: number;
    startY: number;
    spreadXScale: number;
    fallScale: number;
    driftXScale: number;
    swayScale: number;
    phase: number;
    sizeScale: number;
    trailScale: number;
    depth: number;
    alpha: number;
    twinkle: number;
    strobe: number;
    color: string;
};

type FinaleImpactShardPlan = {
    id: string;
    at: number;
    durationMs: number;
    angleDeg: number;
    radiusScale: number;
    widthScale: number;
    lengthScale: number;
    curlScale: number;
    alpha: number;
    color: string;
};

type FinaleShockwavePlan = {
    id: string;
    at: number;
    durationMs: number;
    radiusFromScale: number;
    radiusToScale: number;
    lineWidthScale: number;
    blurScale: number;
    alpha: number;
    color: string;
};

type FinaleSmokeCloudPlan = {
    id: string;
    at: number;
    durationMs: number;
    x: number;
    y: number;
    radiusScale: number;
    driftXScale: number;
    driftYScale: number;
    phase: number;
    alpha: number;
    color: string;
};

type FinaleMicroStarPlan = {
    id: string;
    x: number;
    y: number;
    at: number;
    durationMs: number;
    sizeScale: number;
    phase: number;
    alpha: number;
    twinkle: number;
    color: string;
};

type FinaleImpactTiming = {
    darkStartAt: number;
    nearBlackAt: number;
    masterLaunchAt: number;
    impactAt: number;
    flashEndsAt: number;
    shockwaveEndsAt: number;
    whiteRainStartsAt: number;
    whiteRainEndsAt: number;
};

type FireworksScene = {
    bursts: FireworkBurstPlan[];
    rockets: FireworkRocketPlan[];

    /*
     * 매 프레임마다 master 여부를 다시 검사하지 않도록
     * scene 생성 시점에 한 번만 분리한다.
     */
    regularBursts: FireworkBurstPlan[];
    masterFinaleBursts: FireworkBurstPlan[];
    regularRockets: FireworkRocketPlan[];
    masterFinaleRockets: FireworkRocketPlan[];

    glitter: FireworkGlitterPlan[];
    bokeh: FestivalBokehPlan[];
    niagara: NiagaraTrailPlan[];
    sakuraAfterglow: SakuraAfterglowPlan[];
    reflections: ReflectionGlowPlan[];
    senrin: SenrinBloomPlan[];
    outlineScatter: OutlineScatterPlan[];
    finaleWhiteRain: FinaleWhiteRainPlan[];

    /*
     * 흰 별비의 depth 순서를 scene 생성 시 한 번만 버킷팅한다.
     * 기존처럼 매 프레임 420개를 3회 반복 검사하지 않는다.
     */
    finaleWhiteRainDepthBuckets: [
        FinaleWhiteRainPlan[],
        FinaleWhiteRainPlan[],
        FinaleWhiteRainPlan[],
    ];

    finaleImpactShards: FinaleImpactShardPlan[];
    finaleShockwaves: FinaleShockwavePlan[];
    finaleSmokeClouds: FinaleSmokeCloudPlan[];
    finaleMicroStars: FinaleMicroStarPlan[];
    finaleTiming: FinaleImpactTiming;
};
type CanvasSize = {
    width: number;
    height: number;
    dpr: number;

    /*
     * Math.min(width, height)를 파티클마다 반복 계산하지 않도록
     * resize 시 한 번만 저장한다.
     */
    scale: number;
};
type Point = {
    x: number;
    y: number;
};
type ParticlePoint = Point & {
    alpha: number;
    rotation: number;
    progress: number;
};
const TWO_PI = Math.PI *
    2;
const DEG_TO_RAD = Math.PI /
    180;
const ROMANTIC_NEW_YEAR_PALETTES: readonly FireworkPalette[] = [
    {
        name: "new_year_gold",
        primary: "#ffe8a8",
        secondary: "#ffd18a",
        tertiary: "#fff6d8",
        core: "#ffffff",
        smoke: "#eadcc9",
    },
    {
        name: "sakura",
        primary: "#ffc2d5",
        secondary: "#ffd9e7",
        tertiary: "#fff1f6",
        core: "#ffffff",
        smoke: "#ead8df",
    },
    {
        name: "pearl",
        primary: "#fff8ea",
        secondary: "#f6e6ff",
        tertiary: "#d9e6ff",
        core: "#ffffff",
        smoke: "#e8e5e2",
    },
    {
        name: "winter_sky",
        primary: "#d8e4ff",
        secondary: "#c7d3ff",
        tertiary: "#efe8ff",
        core: "#ffffff",
        smoke: "#dfe2ea",
    },
    {
        name: "romantic_lilac",
        primary: "#e1ccff",
        secondary: "#f1d7ff",
        tertiary: "#ffd8ed",
        core: "#ffffff",
        smoke: "#e4dce8",
    },
    {
        name: "festival_mix",
        primary: "#ffe3a6",
        secondary: "#ffc6d8",
        tertiary: "#d9ccff",
        core: "#ffffff",
        smoke: "#e7ded5",
    },
];
const FESTIVAL_BOKEH_COLORS = [
    "#ffe3a8",
    "#ffd2b8",
    "#ffc7dc",
    "#fff0cf",
    "#e4d6ff",
] as const;
const GLITTER_COLORS = [
    "#ffffff",
    "#fff8e7",
    "#ffeccc",
    "#ffd9e7",
    "#e8e0ff",
] as const;
const ACTIVE_SKY_TOP = "rgba(17, 18, 45, 0.12)";
const ACTIVE_SKY_MIDDLE = "rgba(55, 30, 74, 0.09)";
const ACTIVE_SKY_BOTTOM = "rgba(90, 49, 55, 0.035)";
const MAX_RENDER_DPR = 0.82;
const MIN_CANVAS_SIDE = 1;

/*
 * 노트북 생존 최적화 v2.
 *
 * - 일반 구간: 40fps
 * - 최종 폭발 직전/직후 핵심 임팩트: 60fps
 * - 하얀 별비/잔광: 24fps
 * - 비활성 구간: 15fps
 *
 * 가장 중요한 최종 폭발 순간에만 60fps를 사용하고,
 * 눈이 움직임 차이를 거의 느끼지 못하는 잔광 구간의 프레임을 크게 줄인다.
 */
const HOO_WORLD_FIREWORKS_IMPACT_FRAME_INTERVAL_MS =
    1000 /
    48;

const HOO_WORLD_FIREWORKS_FULL_FRAME_INTERVAL_MS =
    1000 /
    30;

const HOO_WORLD_FIREWORKS_AFTERGLOW_FRAME_INTERVAL_MS =
    1000 /
    15;

const HOO_WORLD_FIREWORKS_IDLE_FRAME_INTERVAL_MS =
    1000 /
    10;
const FUSE_SPARK_COLOR = "#fff3b0";
const FUSE_CORE_COLOR = "#ffd97a";
const FAILURE_SMOKE_COLOR = "#d6d2cc";
const FAILURE_TEXT_COLOR = "#f6f3ed";
function readTime(row: Record<string, unknown>, snakeKey: string, camelKey: string) {
    const raw = row[snakeKey] ??
        row[camelKey];
    if (typeof raw ===
        "number" &&
        Number.isFinite(raw)) {
        return raw;
    }
    if (typeof raw !==
        "string") {
        return NaN;
    }
    return Date.parse(raw);
}
export function normalizeHooWorldFireworksSession(value: unknown): HooWorldFireworksSession | null {
    if (!value ||
        typeof value !==
            "object" ||
        Array.isArray(value)) {
        return null;
    }
    const row = value as Record<string, unknown>;
    const sessionId = typeof row.session_id ===
        "string"
        ? row.session_id
        : typeof row.sessionId ===
            "string"
            ? row.sessionId
            : "";
    const itemId = typeof row.item_id ===
        "string"
        ? row.item_id
        : typeof row.itemId ===
            "string"
            ? row.itemId
            : "";
    const triggeredByUserId = typeof row.triggered_by_user_id ===
        "string"
        ? row.triggered_by_user_id
        : typeof row.triggeredByUserId ===
            "string"
            ? row.triggeredByUserId
            : "";
    const fieldId = Number(row.field_id ??
        row.fieldId);
    const x = Number(row.x);
    const y = Number(row.y);
    const outcomeRaw = row.outcome;
    const outcome: HooWorldFireworksOutcome | null = outcomeRaw ===
        "success" ||
        outcomeRaw ===
            "failure"
        ? outcomeRaw
        : null;
    const startedAt = readTime(row, "started_at", "startedAt");
    const fuseEndsAt = readTime(row, "fuse_ends_at", "fuseEndsAt");
    const fireworksEndsAt = readTime(row, "fireworks_ends_at", "fireworksEndsAt");
    const finaleEndsAt = readTime(row, "finale_ends_at", "finaleEndsAt");
    const glitterEndsAt = readTime(row, "glitter_ends_at", "glitterEndsAt");
    const endsAt = readTime(row, "ends_at", "endsAt");
    if (!sessionId ||
        !itemId ||
        !triggeredByUserId ||
        !Number.isFinite(fieldId) ||
        fieldId <
            1 ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !outcome ||
        !Number.isFinite(startedAt) ||
        !Number.isFinite(fuseEndsAt) ||
        !Number.isFinite(fireworksEndsAt) ||
        !Number.isFinite(finaleEndsAt) ||
        !Number.isFinite(glitterEndsAt) ||
        !Number.isFinite(endsAt)) {
        return null;
    }
    return {
        sessionId,
        itemId,
        fieldId: Math.max(1, Math.floor(fieldId)),
        triggeredByUserId,
        x: clamp(x, 0, 100),
        y: clamp(y, 0, 100),
        outcome,
        startedAt,
        fuseEndsAt,
        fireworksEndsAt,
        finaleEndsAt,
        glitterEndsAt,
        endsAt,
    };
}
function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}
function clamp01(value: number) {
    return clamp(value, 0, 1);
}
function lerp(from: number, to: number, progress: number) {
    return (from +
        (to -
            from) *
            progress);
}
function invLerp(from: number, to: number, value: number) {
    if (from ===
        to) {
        return 0;
    }
    return (value -
        from) /
        (to -
            from);
}
function smoothstep(edge0: number, edge1: number, value: number) {
    const normalized = clamp01(invLerp(edge0, edge1, value));
    return (normalized *
        normalized *
        (3 -
            2 *
                normalized));
}
function easeOutCubic(value: number) {
    const inverse = 1 -
        clamp01(value);
    return (1 -
        inverse *
            inverse *
            inverse);
}
function easeOutQuart(value: number) {
    const inverse = 1 -
        clamp01(value);
    return (1 -
        inverse *
            inverse *
            inverse *
            inverse);
}
function easeInQuad(value: number) {
    const safe = clamp01(value);
    return (safe *
        safe);
}
function easeInOutSine(value: number) {
    const safe = clamp01(value);
    return (-(Math.cos(Math.PI *
        safe) -
        1) /
        2);
}
function getSeed(value: string) {
    let seed = 2166136261;
    for (let index = 0; index <
        value.length; index +=
        1) {
        seed ^=
            value.charCodeAt(index);
        seed =
            Math.imul(seed, 16777619);
    }
    return (seed >>>
        0);
}
function random01(seed: number, index: number) {
    let value = seed +
        Math.imul(index +
            1, 0x9e3779b1);
    value ^=
        value >>>
            16;
    value =
        Math.imul(value, 0x85ebca6b);
    value ^=
        value >>>
            13;
    value =
        Math.imul(value, 0xc2b2ae35);
    value ^=
        value >>>
            16;
    return ((value >>>
        0) /
        4294967296);
}
function randomSigned(seed: number, index: number) {
    return (random01(seed, index) *
        2 -
        1);
}
function choosePalette(seed: number, index: number) {
    const paletteIndex = Math.floor(random01(seed, index) *
        ROMANTIC_NEW_YEAR_PALETTES.length) %
        ROMANTIC_NEW_YEAR_PALETTES.length;
    return (ROMANTIC_NEW_YEAR_PALETTES[paletteIndex]);
}
function chooseColor(palette: FireworkPalette, selector: number) {
    const normalized = selector %
        4;
    if (normalized ===
        0) {
        return palette.primary;
    }
    if (normalized ===
        1) {
        return palette.secondary;
    }
    if (normalized ===
        2) {
        return palette.tertiary;
    }
    return palette.core;
}
function getHexChannel(hex: string, offset: number) {
    return parseInt(hex.slice(offset, offset +
        2), 16);
}
function hexToRgba(hex: string, alpha: number) {
    if (!hex.startsWith("#") ||
        hex.length !==
            7) {
        return hex;
    }
    const red = getHexChannel(hex, 1);
    const green = getHexChannel(hex, 3);
    const blue = getHexChannel(hex, 5);
    return (`rgba(${red}, ${green}, ${blue}, ${clamp01(alpha)})`);
}
function mixHex(first: string, second: string, amount: number) {
    if (first.length !==
        7 ||
        second.length !==
            7) {
        return first;
    }
    const safeAmount = clamp01(amount);
    const firstRed = getHexChannel(first, 1);
    const firstGreen = getHexChannel(first, 3);
    const firstBlue = getHexChannel(first, 5);
    const secondRed = getHexChannel(second, 1);
    const secondGreen = getHexChannel(second, 3);
    const secondBlue = getHexChannel(second, 5);
    const red = Math.round(lerp(firstRed, secondRed, safeAmount));
    const green = Math.round(lerp(firstGreen, secondGreen, safeAmount));
    const blue = Math.round(lerp(firstBlue, secondBlue, safeAmount));
    return (`#${red
        .toString(16)
        .padStart(2, "0")}${green
        .toString(16)
        .padStart(2, "0")}${blue
        .toString(16)
        .padStart(2, "0")}`);
}
function rotatePoint(x: number, y: number, angleRad: number) {
    const cosine = Math.cos(angleRad);
    const sine = Math.sin(angleRad);
    return {
        x: x *
            cosine -
            y *
                sine,
        y: x *
            sine +
            y *
                cosine,
    };
}
function getCanvasScale(size: CanvasSize) {
    return size.scale;
}
function normalizeCanvasSize(width: number, height: number) {
    const normalizedWidth =
        Math.max(
            MIN_CANVAS_SIDE,
            width,
        );

    const normalizedHeight =
        Math.max(
            MIN_CANVAS_SIDE,
            height,
        );

    return {
        width:
            normalizedWidth,
        height:
            normalizedHeight,
        dpr:
            Math.max(
                0.72,
                Math.min(
                    MAX_RENDER_DPR,
                    window.devicePixelRatio ||
                        1,
                ),
            ),
        scale:
            Math.min(
                normalizedWidth,
                normalizedHeight,
            ),
    } satisfies CanvasSize;
}
function createBaseParticle(id: string, role: FireworkParticleRole, angleDeg: number, colorA: string, colorB: string): FireworkParticlePlan {
    return {
        id,
        role,
        angleDeg,
        originAngleDeg: angleDeg,
        originRadiusScale: 0,
        radiusScale: 0.12,
        durationMs: 1800,
        delayMs: 0,
        sizeScale: 0.005,
        alpha: 1,
        gravityScale: 0.028,
        drag: 1.15,
        swayAmplitudeScale: 0.004,
        swayFrequency: 1.6,
        tangentCurlScale: 0,
        twinkle: 0.3,
        strobe: 0,
        trailLength: 0.08,
        trailWidthScale: 0.0014,
        rotationDeg: angleDeg,
        rotationSpeedDeg: 0,
        colorA,
        colorB,
        glow: 0.7,
    };
}
function createPeonyParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const count = 22;
    for (let index = 0; index <
        count; index +=
        1) {
        const angle = index /
            count *
            360 +
            randomSigned(seed, 1000 +
                index) *
                3.2;
        const colorA = chooseColor(palette, index);
        const colorB = mixHex(colorA, palette.core, 0.35);
        const particle = createBaseParticle(`${burstId}-peony-${index}`, "spark", angle, colorA, colorB);
        particle.radiusScale =
            radiusScale *
                (0.86 +
                    random01(seed, 1100 +
                        index) *
                        0.18);
        particle.durationMs =
            1850 +
                random01(seed, 1200 +
                    index) *
                    500;
        particle.sizeScale =
            0.0044 +
                random01(seed, 1300 +
                    index) *
                    0.0026;
        particle.gravityScale =
            0.018 +
                random01(seed, 1400 +
                    index) *
                    0.012;
        particle.drag =
            1.05 +
                random01(seed, 1500 +
                    index) *
                    0.38;
        particle.swayAmplitudeScale =
            0.0015 +
                random01(seed, 1600 +
                    index) *
                    0.003;
        particle.twinkle =
            0.2 +
                random01(seed, 1700 +
                    index) *
                    0.35;
        particle.trailLength =
            0.07 +
                random01(seed, 1800 +
                    index) *
                    0.05;
        particle.glow =
            0.72 +
                random01(seed, 1900 +
                    index) *
                    0.2;
        particles.push(particle);
    }
    return particles;
}
function createChrysanthemumParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const count = 28;
    for (let index = 0; index <
        count; index +=
        1) {
        const angle = index /
            count *
            360 +
            randomSigned(seed, 2100 +
                index) *
                2.2;
        const colorA = index %
            5 ===
            0
            ? palette.core
            : chooseColor(palette, index +
                1);
        const colorB = mixHex(colorA, palette.primary, 0.24);
        const particle = createBaseParticle(`${burstId}-chrysanthemum-${index}`, "spark", angle, colorA, colorB);
        particle.radiusScale =
            radiusScale *
                (0.9 +
                    random01(seed, 2200 +
                        index) *
                        0.22);
        particle.durationMs =
            2200 +
                random01(seed, 2300 +
                    index) *
                    620;
        particle.sizeScale =
            0.0036 +
                random01(seed, 2400 +
                    index) *
                    0.0022;
        particle.gravityScale =
            0.022 +
                random01(seed, 2500 +
                    index) *
                    0.018;
        particle.drag =
            1.22 +
                random01(seed, 2600 +
                    index) *
                    0.52;
        particle.tangentCurlScale =
            randomSigned(seed, 2700 +
                index) *
                0.004;
        particle.twinkle =
            0.28 +
                random01(seed, 2800 +
                    index) *
                    0.5;
        particle.trailLength =
            0.1 +
                random01(seed, 2900 +
                    index) *
                    0.06;
        particle.glow =
            0.66 +
                random01(seed, 3000 +
                    index) *
                    0.25;
        particles.push(particle);
    }
    return particles;
}
function createSakuraParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const petalCount = 64;
    for (let index = 0; index <
        petalCount; index +=
        1) {
        const angle = index /
            petalCount *
            360 +
            randomSigned(seed, 3100 +
                index) *
                4.5;
        const colorA = index %
            4 ===
            0
            ? "#fff7fb"
            : index %
                3 ===
                0
                ? "#ffd6e6"
                : palette.primary;
        const colorB = mixHex(colorA, palette.secondary, 0.5);
        const particle = createBaseParticle(`${burstId}-sakura-${index}`, "petal", angle, colorA, colorB);
        particle.radiusScale =
            radiusScale *
                (0.72 +
                    random01(seed, 3200 +
                        index) *
                        0.34);
        particle.durationMs =
            2300 +
                random01(seed, 3300 +
                    index) *
                    900;
        particle.sizeScale =
            0.005 +
                random01(seed, 3400 +
                    index) *
                    0.0035;
        particle.gravityScale =
            0.032 +
                random01(seed, 3500 +
                    index) *
                    0.022;
        particle.drag =
            1.35 +
                random01(seed, 3600 +
                    index) *
                    0.58;
        particle.swayAmplitudeScale =
            0.004 +
                random01(seed, 3700 +
                    index) *
                    0.008;
        particle.swayFrequency =
            1.6 +
                random01(seed, 3800 +
                    index) *
                    2.2;
        particle.rotationSpeedDeg =
            randomSigned(seed, 3900 +
                index) *
                75;
        particle.twinkle =
            0.12 +
                random01(seed, 4000 +
                    index) *
                    0.25;
        particle.trailLength =
            0.04 +
                random01(seed, 4100 +
                    index) *
                    0.025;
        particle.glow =
            0.56 +
                random01(seed, 4200 +
                    index) *
                    0.18;
        particles.push(particle);
    }
    return particles;
}
function createRingParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const count = 20;
    for (let index = 0; index <
        count; index +=
        1) {
        const angle = index /
            count *
            360;
        const colorA = chooseColor(palette, index);
        const particle = createBaseParticle(`${burstId}-ring-${index}`, "spark", angle, colorA, palette.core);
        particle.radiusScale =
            radiusScale;
        particle.durationMs =
            1750 +
                random01(seed, 4300 +
                    index) *
                    260;
        particle.sizeScale =
            0.0042 +
                random01(seed, 4400 +
                    index) *
                    0.002;
        particle.gravityScale =
            0.012 +
                random01(seed, 4500 +
                    index) *
                    0.008;
        particle.drag =
            1.0 +
                random01(seed, 4600 +
                    index) *
                    0.2;
        particle.twinkle =
            0.42;
        particle.trailLength =
            0.06;
        particle.glow =
            0.82;
        particles.push(particle);
    }
    return particles;
}
function createDoubleRingParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const outer = 52;
    const inner = 34;
    for (let index = 0; index <
        outer; index +=
        1) {
        const angle = index /
            outer *
            360;
        const particle = createBaseParticle(`${burstId}-double-outer-${index}`, "spark", angle, index %
            2 ===
            0
            ? palette.primary
            : palette.secondary, palette.core);
        particle.radiusScale =
            radiusScale;
        particle.durationMs =
            1880;
        particle.sizeScale =
            0.0043;
        particle.gravityScale =
            0.013;
        particle.drag =
            1.1;
        particle.twinkle =
            0.38;
        particle.trailLength =
            0.058;
        particle.glow =
            0.84;
        particles.push(particle);
    }
    for (let index = 0; index <
        inner; index +=
        1) {
        const angle = index /
            inner *
            360 +
            360 /
                inner /
                2;
        const particle = createBaseParticle(`${burstId}-double-inner-${index}`, "spark", angle, palette.tertiary, palette.core);
        particle.radiusScale =
            radiusScale *
                0.58;
        particle.durationMs =
            1650;
        particle.delayMs =
            70;
        particle.sizeScale =
            0.0038;
        particle.gravityScale =
            0.01;
        particle.drag =
            1.0;
        particle.twinkle =
            0.52;
        particle.trailLength =
            0.05;
        particle.glow =
            0.78;
        particles.push(particle);
    }
    return particles;
}
function createWillowParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const count = 26;
    for (let index = 0; index <
        count; index +=
        1) {
        const angle = index /
            count *
            360 +
            randomSigned(seed, 4700 +
                index) *
                3;
        const particle = createBaseParticle(`${burstId}-willow-${index}`, "willow", angle, index %
            7 ===
            0
            ? palette.core
            : palette.primary, palette.secondary);
        particle.radiusScale =
            radiusScale *
                (0.8 +
                    random01(seed, 4800 +
                        index) *
                        0.34);
        particle.durationMs =
            3400 +
                random01(seed, 4900 +
                    index) *
                    1200;
        particle.sizeScale =
            0.0032 +
                random01(seed, 5000 +
                    index) *
                    0.0018;
        particle.gravityScale =
            0.095 +
                random01(seed, 5100 +
                    index) *
                    0.052;
        particle.drag =
            1.75 +
                random01(seed, 5200 +
                    index) *
                    0.82;
        particle.swayAmplitudeScale =
            0.004 +
                random01(seed, 5300 +
                    index) *
                    0.007;
        particle.swayFrequency =
            1.1 +
                random01(seed, 5400 +
                    index) *
                    1.4;
        particle.twinkle =
            0.18;
        particle.trailLength =
            0.2 +
                random01(seed, 5500 +
                    index) *
                    0.1;
        particle.trailWidthScale =
            0.0012 +
                random01(seed, 5600 +
                    index) *
                    0.0006;
        particle.glow =
            0.58;
        particles.push(particle);
    }
    return particles;
}
function createBrocadeParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const count = 30;
    for (let index = 0; index <
        count; index +=
        1) {
        const angle = index /
            count *
            360 +
            randomSigned(seed, 5700 +
                index) *
                2.4;
        const gold = index %
            9 ===
            0
            ? "#ffffff"
            : index %
                4 ===
                0
                ? "#fff0bd"
                : "#ffd58a";
        const particle = createBaseParticle(`${burstId}-brocade-${index}`, "willow", angle, gold, palette.secondary);
        particle.radiusScale =
            radiusScale *
                (0.86 +
                    random01(seed, 5800 +
                        index) *
                        0.24);
        particle.durationMs =
            3000 +
                random01(seed, 5900 +
                    index) *
                    1100;
        particle.sizeScale =
            0.0033 +
                random01(seed, 6000 +
                    index) *
                    0.002;
        particle.gravityScale =
            0.075 +
                random01(seed, 6100 +
                    index) *
                    0.045;
        particle.drag =
            1.55 +
                random01(seed, 6200 +
                    index) *
                    0.55;
        particle.twinkle =
            0.5 +
                random01(seed, 6300 +
                    index) *
                    0.35;
        particle.strobe =
            index %
                6 ===
                0
                ? 0.45
                : 0;
        particle.trailLength =
            0.18 +
                random01(seed, 6400 +
                    index) *
                    0.09;
        particle.glow =
            0.7;
        particles.push(particle);
    }
    return particles;
}
function createKamuroParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const count = 34;
    for (let index = 0; index <
        count; index +=
        1) {
        const angle = index /
            count *
            360 +
            randomSigned(seed, 6500 +
                index) *
                1.8;
        const particle = createBaseParticle(`${burstId}-kamuro-${index}`, "willow", angle, index %
            8 ===
            0
            ? "#ffffff"
            : "#ffe0a2", "#ffd092");
        particle.radiusScale =
            radiusScale *
                (0.88 +
                    random01(seed, 6600 +
                        index) *
                        0.22);
        particle.durationMs =
            3900 +
                random01(seed, 6700 +
                    index) *
                    1350;
        particle.sizeScale =
            0.003 +
                random01(seed, 6800 +
                    index) *
                    0.0018;
        particle.gravityScale =
            0.105 +
                random01(seed, 6900 +
                    index) *
                    0.05;
        particle.drag =
            1.82 +
                random01(seed, 7000 +
                    index) *
                    0.65;
        particle.swayAmplitudeScale =
            0.003 +
                random01(seed, 7100 +
                    index) *
                    0.006;
        particle.swayFrequency =
            0.9 +
                random01(seed, 7200 +
                    index) *
                    1.2;
        particle.twinkle =
            0.34;
        particle.trailLength =
            0.23 +
                random01(seed, 7300 +
                    index) *
                    0.11;
        particle.trailWidthScale =
            0.0011;
        particle.glow =
            0.62;
        particles.push(particle);
    }
    return particles;
}
function createPalmParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const branchCount = 10;
    for (let branch = 0; branch <
        branchCount; branch +=
        1) {
        const baseAngle = branch /
            branchCount *
            360 +
            randomSigned(seed, 7400 +
                branch) *
                4;
        const branchSegments = 5;
        for (let segment = 0; segment <
            branchSegments; segment +=
            1) {
            const angle = baseAngle +
                randomSigned(seed, 7500 +
                    branch *
                        10 +
                    segment) *
                    2.4;
            const particle = createBaseParticle(`${burstId}-palm-${branch}-${segment}`, "willow", angle, segment ===
                0
                ? palette.core
                : palette.primary, palette.secondary);
            particle.originAngleDeg =
                baseAngle;
            particle.originRadiusScale =
                radiusScale *
                    (segment /
                        branchSegments) *
                    0.22;
            particle.radiusScale =
                radiusScale *
                    (0.68 +
                        segment /
                            branchSegments *
                            0.34);
            particle.delayMs =
                segment *
                    38;
            particle.durationMs =
                2500 +
                    segment *
                        160 +
                    random01(seed, 7600 +
                        branch *
                            10 +
                        segment) *
                        480;
            particle.sizeScale =
                0.0038 -
                    segment *
                        0.00025;
            particle.gravityScale =
                0.055 +
                    segment *
                        0.008;
            particle.drag =
                1.4 +
                    segment *
                        0.08;
            particle.twinkle =
                0.28;
            particle.trailLength =
                0.14 +
                    segment *
                        0.015;
            particle.glow =
                0.64;
            particles.push(particle);
        }
    }
    return particles;
}
function createDahliaParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const petalCount = 20;
    for (let index = 0; index <
        petalCount; index +=
        1) {
        const angle = index /
            petalCount *
            360;
        const primary = createBaseParticle(`${burstId}-dahlia-primary-${index}`, "petal", angle, index %
            2 ===
            0
            ? palette.primary
            : palette.secondary, palette.core);
        primary.radiusScale =
            radiusScale *
                (0.92 +
                    random01(seed, 7700 +
                        index) *
                        0.16);
        primary.durationMs =
            2350 +
                random01(seed, 7800 +
                    index) *
                    430;
        primary.sizeScale =
            0.0065 +
                random01(seed, 7900 +
                    index) *
                    0.0022;
        primary.gravityScale =
            0.028;
        primary.drag =
            1.18;
        primary.rotationSpeedDeg =
            randomSigned(seed, 8000 +
                index) *
                85;
        primary.twinkle =
            0.22;
        primary.trailLength =
            0.045;
        primary.glow =
            0.76;
        particles.push(primary);
        const inner = createBaseParticle(`${burstId}-dahlia-inner-${index}`, "spark", angle +
            360 /
                petalCount /
                2, palette.tertiary, palette.core);
        inner.radiusScale =
            radiusScale *
                0.54;
        inner.durationMs =
            1900;
        inner.delayMs =
            80;
        inner.sizeScale =
            0.0035;
        inner.gravityScale =
            0.018;
        inner.drag =
            1.05;
        inner.twinkle =
            0.5;
        inner.trailLength =
            0.05;
        inner.glow =
            0.68;
        particles.push(inner);
    }
    return particles;
}
function createCrossetteParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const spokeCount = 12;
    for (let spoke = 0; spoke <
        spokeCount; spoke +=
        1) {
        const angle = spoke /
            spokeCount *
            360;
        const primary = createBaseParticle(`${burstId}-crossette-primary-${spoke}`, "spark", angle, chooseColor(palette, spoke), palette.core);
        primary.radiusScale =
            radiusScale *
                0.66;
        primary.durationMs =
            1050;
        primary.sizeScale =
            0.0045;
        primary.gravityScale =
            0.015;
        primary.drag =
            0.95;
        primary.twinkle =
            0.18;
        primary.trailLength =
            0.1;
        primary.glow =
            0.85;
        particles.push(primary);
        const childCount = 4;
        for (let child = 0; child <
            childCount; child +=
            1) {
            const childAngle = angle +
                (child -
                    1.5) *
                    16;
            const childParticle = createBaseParticle(`${burstId}-crossette-child-${spoke}-${child}`, "crossette_child", childAngle, palette.core, chooseColor(palette, spoke +
                child));
            childParticle.originAngleDeg =
                angle;
            childParticle.originRadiusScale =
                radiusScale *
                    0.54;
            childParticle.radiusScale =
                radiusScale *
                    0.32;
            childParticle.delayMs =
                780;
            childParticle.durationMs =
                1200 +
                    child *
                        70;
            childParticle.sizeScale =
                0.0032;
            childParticle.gravityScale =
                0.028;
            childParticle.drag =
                1.08;
            childParticle.twinkle =
                0.58;
            childParticle.trailLength =
                0.07;
            childParticle.glow =
                0.72;
            particles.push(childParticle);
        }
    }
    return particles;
}
function createSnowCrystalParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const arms = 5;
    const steps = 9;
    for (let arm = 0; arm <
        arms; arm +=
        1) {
        const baseAngle = arm /
            arms *
            360;
        for (let step = 1; step <=
            steps; step +=
            1) {
            const particle = createBaseParticle(`${burstId}-snow-${arm}-${step}`, "star", baseAngle, step %
                2 ===
                0
                ? "#ffffff"
                : palette.primary, palette.secondary);
            particle.originRadiusScale =
                radiusScale *
                    (step -
                        1) /
                    steps *
                    0.08;
            particle.radiusScale =
                radiusScale *
                    step /
                    steps;
            particle.delayMs =
                step *
                    16;
            particle.durationMs =
                2100 +
                    step *
                        55;
            particle.sizeScale =
                0.003 +
                    step *
                        0.00018;
            particle.gravityScale =
                0.01 +
                    step *
                        0.001;
            particle.drag =
                1.04;
            particle.twinkle =
                0.7;
            particle.strobe =
                0.25;
            particle.trailLength =
                0.05;
            particle.glow =
                0.78;
            particles.push(particle);
            if (step >=
                4 &&
                step <=
                    8) {
                for (const side of [
                    -1,
                    1,
                ]) {
                    const branchParticle = createBaseParticle(`${burstId}-snow-branch-${arm}-${step}-${side}`, "star", baseAngle +
                        side *
                            22, palette.tertiary, "#ffffff");
                    branchParticle.originAngleDeg =
                        baseAngle;
                    branchParticle.originRadiusScale =
                        radiusScale *
                            step /
                            steps *
                            0.58;
                    branchParticle.radiusScale =
                        radiusScale *
                            0.22;
                    branchParticle.delayMs =
                        step *
                            28;
                    branchParticle.durationMs =
                        1500;
                    branchParticle.sizeScale =
                        0.0028;
                    branchParticle.gravityScale =
                        0.012;
                    branchParticle.drag =
                        1.0;
                    branchParticle.twinkle =
                        0.76;
                    branchParticle.strobe =
                        0.32;
                    branchParticle.trailLength =
                        0.035;
                    branchParticle.glow =
                        0.72;
                    particles.push(branchParticle);
                }
            }
        }
    }
    return particles;
}
function createHeartParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const count = 30;
    for (let index = 0; index <
        count; index +=
        1) {
        const t = index /
            count *
            TWO_PI;
        const rawX = 16 *
            Math.pow(Math.sin(t), 3);
        const rawY = -(13 *
            Math.cos(t) -
            5 *
                Math.cos(2 *
                    t) -
            2 *
                Math.cos(3 *
                    t) -
            Math.cos(4 *
                t));
        const angle = Math.atan2(rawY, rawX) /
            DEG_TO_RAD;
        const length = Math.hypot(rawX, rawY) /
            18;
        const particle = createBaseParticle(`${burstId}-heart-${index}`, "petal", angle, index %
            3 ===
            0
            ? "#fff6fb"
            : palette.primary, palette.secondary);
        particle.radiusScale =
            radiusScale *
                length;
        particle.durationMs =
            2350 +
                random01(seed, 8100 +
                    index) *
                    380;
        particle.sizeScale =
            0.0048 +
                random01(seed, 8200 +
                    index) *
                    0.0023;
        particle.gravityScale =
            0.022;
        particle.drag =
            1.1;
        particle.rotationSpeedDeg =
            randomSigned(seed, 8300 +
                index) *
                54;
        particle.twinkle =
            0.34;
        particle.trailLength =
            0.04;
        particle.glow =
            0.82;
        particles.push(particle);
    }
    return particles;
}
function createStarParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const points = 5;
    const samplesPerEdge = 7;
    const starVertices: Point[] = [];
    for (let index = 0; index <
        points *
            2; index +=
        1) {
        const angle = -Math.PI /
            2 +
            index /
                (points *
                    2) *
                TWO_PI;
        const radius = index %
            2 ===
            0
            ? 1
            : 0.43;
        starVertices.push({
            x: Math.cos(angle) *
                radius,
            y: Math.sin(angle) *
                radius,
        });
    }
    let particleIndex = 0;
    for (let edge = 0; edge <
        starVertices.length; edge +=
        1) {
        const from = starVertices[edge];
        const to = starVertices[(edge +
            1) %
            starVertices.length];
        for (let sample = 0; sample <
            samplesPerEdge; sample +=
            1) {
            const progress = sample /
                samplesPerEdge;
            const pointX = lerp(from.x, to.x, progress);
            const pointY = lerp(from.y, to.y, progress);
            const angle = Math.atan2(pointY, pointX) /
                DEG_TO_RAD;
            const length = Math.hypot(pointX, pointY);
            const particle = createBaseParticle(`${burstId}-star-${particleIndex}`, "star", angle, particleIndex %
                3 ===
                0
                ? palette.core
                : palette.primary, palette.secondary);
            particle.radiusScale =
                radiusScale *
                    length;
            particle.durationMs =
                2300;
            particle.delayMs =
                sample *
                    4;
            particle.sizeScale =
                0.0036;
            particle.gravityScale =
                0.014;
            particle.drag =
                1.02;
            particle.twinkle =
                0.72;
            particle.strobe =
                0.18;
            particle.trailLength =
                0.045;
            particle.glow =
                0.8;
            particles.push(particle);
            particleIndex +=
                1;
        }
    }
    return particles;
}
function createStrobeParticles(seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    const particles: FireworkParticlePlan[] = [];
    const count = 28;
    for (let index = 0; index <
        count; index +=
        1) {
        const angle = index /
            count *
            360 +
            randomSigned(seed, 8400 +
                index) *
                3.4;
        const particle = createBaseParticle(`${burstId}-strobe-${index}`, "strobe", angle, index %
            5 ===
            0
            ? "#ffffff"
            : chooseColor(palette, index), palette.core);
        particle.radiusScale =
            radiusScale *
                (0.72 +
                    random01(seed, 8500 +
                        index) *
                        0.35);
        particle.durationMs =
            2400 +
                random01(seed, 8600 +
                    index) *
                    760;
        particle.sizeScale =
            0.0032 +
                random01(seed, 8700 +
                    index) *
                    0.0028;
        particle.gravityScale =
            0.026;
        particle.drag =
            1.28;
        particle.twinkle =
            0.6;
        particle.strobe =
            0.85;
        particle.trailLength =
            0.05;
        particle.glow =
            0.9;
        particles.push(particle);
    }
    return particles;
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * MASTER FINALE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 최종 폭발은 일반 폭죽과 같은 "한 겹의 원형 파티클"로 처리하지 않는다.
 *
 * 감동이 느껴지는 피날레를 만들기 위해 서로 다른 성격의 레이어를
 * 한 번의 폭발 안에 겹친다.
 *
 * 1) 바깥쪽 금빛 Kamuro canopy
 * 2) 진주색 Chrysanthemum core
 * 3) 연분홍 Sakura petal halo
 * 4) 흰색 Strobe crown
 * 5) 얇은 다중 Ring
 * 6) 느리게 처지는 Willow tails
 * 7) 중심부 Impact shard
 *
 * 이 레이어들은 같은 중심에서 시작하지만 거리 / 중력 / 감쇠 /
 * 잔광의 시간이 모두 달라서 최종 폭발이 "큰 원 하나"가 아니라
 * 실제 대형 축제 불꽃처럼 여러 깊이를 가진 형태로 보이게 한다.
 */
function createMasterFinaleParticles(
    seed: number,
    burstId: string,
    palette: FireworkPalette,
    radiusScale: number,
) {
    const particles: FireworkParticlePlan[] = [];

    /*
     * Layer A · Outer Kamuro canopy
     *
     * 가장 외곽 윤곽을 만드는 금빛 가지.
     * 일반 폭죽보다 멀리 뻗고, 마지막에 강하게 아래로 처진다.
     */
    const outerCount = 64;

    for (
        let index = 0;
        index < outerCount;
        index += 1
    ) {
        const baseAngle =
            index /
            outerCount *
            360;

        const angle =
            baseAngle +
            randomSigned(
                seed,
                20000 +
                    index,
            ) *
                1.7;

        const colorA =
            index % 11 === 0
                ? "#ffffff"
                : index % 4 === 0
                    ? "#fff1c8"
                    : "#ffd58e";

        const colorB =
            index % 5 === 0
                ? "#ffc9d9"
                : "#ffcb7d";

        const particle =
            createBaseParticle(
                `${burstId}-master-outer-${index}`,
                "willow",
                angle,
                colorA,
                colorB,
            );

        particle.radiusScale =
            radiusScale *
            (
                0.96 +
                random01(
                    seed,
                    20100 +
                        index,
                ) *
                    0.22
            );

        particle.durationMs =
            4300 +
            random01(
                seed,
                20200 +
                    index,
            ) *
                1250;

        particle.delayMs =
            random01(
                seed,
                20300 +
                    index,
            ) *
                70;

        particle.sizeScale =
            0.0032 +
            random01(
                seed,
                20400 +
                    index,
            ) *
                0.0022;

        particle.gravityScale =
            0.118 +
            random01(
                seed,
                20500 +
                    index,
            ) *
                0.055;

        particle.drag =
            1.82 +
            random01(
                seed,
                20600 +
                    index,
            ) *
                0.62;

        particle.swayAmplitudeScale =
            0.0035 +
            random01(
                seed,
                20700 +
                    index,
            ) *
                0.0068;

        particle.swayFrequency =
            0.9 +
            random01(
                seed,
                20800 +
                    index,
            ) *
                1.3;

        particle.tangentCurlScale =
            randomSigned(
                seed,
                20900 +
                    index,
            ) *
                0.0036;

        particle.twinkle =
            0.42 +
            random01(
                seed,
                21000 +
                    index,
            ) *
                0.28;

        particle.strobe =
            index % 13 === 0
                ? 0.28
                : 0;

        particle.trailLength =
            0.24 +
            random01(
                seed,
                21100 +
                    index,
            ) *
                0.1;

        particle.trailWidthScale =
            0.00115 +
            random01(
                seed,
                21200 +
                    index,
            ) *
                0.0005;

        particle.glow =
            0.68 +
            random01(
                seed,
                21300 +
                    index,
            ) *
                0.2;

        particles.push(
            particle,
        );
    }

    /*
     * Layer B · Pearl chrysanthemum core
     *
     * 중심부를 아주 밝고 촘촘하게 채운다.
     * 외곽 가지와 속도가 다르기 때문에 폭발 순간에 "속이 꽉 찬"
     * 느낌이 생긴다.
     */
    const pearlCount = 52;

    for (
        let index = 0;
        index < pearlCount;
        index += 1
    ) {
        const baseAngle =
            index /
            pearlCount *
            360;

        const angle =
            baseAngle +
            randomSigned(
                seed,
                21400 +
                    index,
            ) *
                2.4;

        const colorA =
            index % 7 === 0
                ? "#ffffff"
                : index % 3 === 0
                    ? "#fff7e9"
                    : "#f5edff";

        const colorB =
            index % 4 === 0
                ? "#ffd4e4"
                : "#e7ddff";

        const particle =
            createBaseParticle(
                `${burstId}-master-pearl-${index}`,
                "spark",
                angle,
                colorA,
                colorB,
            );

        particle.radiusScale =
            radiusScale *
            (
                0.66 +
                random01(
                    seed,
                    21500 +
                        index,
                ) *
                    0.22
            );

        particle.durationMs =
            2600 +
            random01(
                seed,
                21600 +
                    index,
            ) *
                720;

        particle.delayMs =
            25 +
            random01(
                seed,
                21700 +
                    index,
            ) *
                80;

        particle.sizeScale =
            0.0042 +
            random01(
                seed,
                21800 +
                    index,
            ) *
                0.0025;

        particle.gravityScale =
            0.024 +
            random01(
                seed,
                21900 +
                    index,
            ) *
                0.018;

        particle.drag =
            1.18 +
            random01(
                seed,
                22000 +
                    index,
            ) *
                0.32;

        particle.swayAmplitudeScale =
            0.001 +
            random01(
                seed,
                22100 +
                    index,
            ) *
                0.0025;

        particle.twinkle =
            0.56 +
            random01(
                seed,
                22200 +
                    index,
            ) *
                0.3;

        particle.strobe =
            index % 10 === 0
                ? 0.4
                : 0;

        particle.trailLength =
            0.095 +
            random01(
                seed,
                22300 +
                    index,
            ) *
                0.05;

        particle.trailWidthScale =
            0.00135 +
            random01(
                seed,
                22400 +
                    index,
            ) *
                0.00045;

        particle.glow =
            0.86 +
            random01(
                seed,
                22500 +
                    index,
            ) *
                0.12;

        particles.push(
            particle,
        );
    }

    /*
     * Layer C · Sakura petal halo
     *
     * 일본 신년축제의 로맨틱한 인상을 담당한다.
     * 단순 분홍 점이 아니라 길쭉한 petal shape로 렌더되고,
     * 회전 속도를 조금씩 달리해 폭발 이후 흩날리는 꽃잎처럼 보인다.
     */
    const sakuraCount = 36;

    for (
        let index = 0;
        index < sakuraCount;
        index += 1
    ) {
        const baseAngle =
            index /
            sakuraCount *
            360;

        const angle =
            baseAngle +
            randomSigned(
                seed,
                22600 +
                    index,
            ) *
                4.8;

        const colorA =
            index % 5 === 0
                ? "#fff8fc"
                : index % 2 === 0
                    ? "#ffd0e0"
                    : "#ffbdd3";

        const colorB =
            index % 3 === 0
                ? "#fff0f7"
                : "#e7d6ff";

        const particle =
            createBaseParticle(
                `${burstId}-master-sakura-${index}`,
                "petal",
                angle,
                colorA,
                colorB,
            );

        particle.radiusScale =
            radiusScale *
            (
                0.73 +
                random01(
                    seed,
                    22700 +
                        index,
                ) *
                    0.24
            );

        particle.durationMs =
            3000 +
            random01(
                seed,
                22800 +
                    index,
            ) *
                980;

        particle.delayMs =
            80 +
            random01(
                seed,
                22900 +
                    index,
            ) *
                120;

        particle.sizeScale =
            0.0054 +
            random01(
                seed,
                23000 +
                    index,
            ) *
                0.0038;

        particle.gravityScale =
            0.04 +
            random01(
                seed,
                23100 +
                    index,
            ) *
                0.025;

        particle.drag =
            1.35 +
            random01(
                seed,
                23200 +
                    index,
            ) *
                0.42;

        particle.swayAmplitudeScale =
            0.005 +
            random01(
                seed,
                23300 +
                    index,
            ) *
                0.009;

        particle.swayFrequency =
            1.5 +
            random01(
                seed,
                23400 +
                    index,
            ) *
                2.1;

        particle.tangentCurlScale =
            randomSigned(
                seed,
                23500 +
                    index,
            ) *
                0.007;

        particle.rotationSpeedDeg =
            randomSigned(
                seed,
                23600 +
                    index,
            ) *
                90;

        particle.twinkle =
            0.22 +
            random01(
                seed,
                23700 +
                    index,
            ) *
                0.3;

        particle.trailLength =
            0.05 +
            random01(
                seed,
                23800 +
                    index,
            ) *
                0.035;

        particle.glow =
            0.68 +
            random01(
                seed,
                23900 +
                    index,
            ) *
                0.18;

        particles.push(
            particle,
        );
    }

    /*
     * Layer D · White strobe crown
     *
     * "펑" 하고 터졌을 때의 임팩트를 담당하는 레이어.
     * 아주 짧게 여러 번 점멸하면서 중심 광량을 끌어올린다.
     */
    const strobeCount = 32;

    for (
        let index = 0;
        index < strobeCount;
        index += 1
    ) {
        const angle =
            index /
            strobeCount *
            360 +
            randomSigned(
                seed,
                24000 +
                    index,
            ) *
                2;

        const particle =
            createBaseParticle(
                `${burstId}-master-strobe-${index}`,
                "strobe",
                angle,
                "#ffffff",
                index % 2 === 0
                    ? "#fff2cf"
                    : "#f4e9ff",
            );

        particle.radiusScale =
            radiusScale *
            (
                0.48 +
                random01(
                    seed,
                    24100 +
                        index,
                ) *
                    0.25
            );

        particle.durationMs =
            2100 +
            random01(
                seed,
                24200 +
                    index,
            ) *
                620;

        particle.delayMs =
            random01(
                seed,
                24300 +
                    index,
            ) *
                110;

        particle.sizeScale =
            0.0038 +
            random01(
                seed,
                24400 +
                    index,
            ) *
                0.0026;

        particle.gravityScale =
            0.02;

        particle.drag =
            1.1;

        particle.twinkle =
            0.72;

        particle.strobe =
            0.92;

        particle.trailLength =
            0.045;

        particle.glow =
            1;

        particles.push(
            particle,
        );
    }

    /*
     * Layer E · Thin concentric rings
     *
     * 외곽 윤곽을 정돈해 최종 폭발의 크기를 눈이 바로 인식하게 한다.
     */
    const ringLayers = [
        {
            count: 28,
            radius: 0.42,
            color: "#ffffff",
            delay: 40,
        },
        {
            count: 34,
            radius: 0.56,
            color: "#ffe5af",
            delay: 70,
        },
        {
            count: 84,
            radius: 0.7,
            color: "#ffd2e3",
            delay: 100,
        },
        {
            count: 96,
            radius: 0.84,
            color: "#e6dbff",
            delay: 130,
        },
    ] as const;

    for (
        let ringIndex = 0;
        ringIndex < ringLayers.length;
        ringIndex += 1
    ) {
        const ring =
            ringLayers[
                ringIndex
            ];

        for (
            let index = 0;
            index < ring.count;
            index += 1
        ) {
            const angle =
                index /
                ring.count *
                360 +
                ringIndex *
                    2.5;

            const particle =
                createBaseParticle(
                    `${burstId}-master-ring-${ringIndex}-${index}`,
                    "spark",
                    angle,
                    ring.color,
                    "#ffffff",
                );

            particle.radiusScale =
                radiusScale *
                ring.radius;

            particle.durationMs =
                1750 +
                ringIndex *
                    180;

            particle.delayMs =
                ring.delay;

            particle.sizeScale =
                0.0028 +
                ringIndex *
                    0.00025;

            particle.gravityScale =
                0.008 +
                ringIndex *
                    0.002;

            particle.drag =
                0.96 +
                ringIndex *
                    0.04;

            particle.twinkle =
                0.58;

            particle.strobe =
                ringIndex === 0
                    ? 0.3
                    : 0.12;

            particle.trailLength =
                0.038;

            particle.glow =
                0.78;

            particles.push(
                particle,
            );
        }
    }

    /*
     * Layer F · Long white willow tails
     *
     * 최종 폭발이 끝난 뒤 하얀 별비가 떨어지기 전에
     * 폭발 자체에서 먼저 긴 꼬리가 아래로 내려오도록 한다.
     */
    const tailCount = 72;

    for (
        let index = 0;
        index < tailCount;
        index += 1
    ) {
        const angle =
            index /
            tailCount *
            360 +
            randomSigned(
                seed,
                24500 +
                    index,
            ) *
                2.8;

        const particle =
            createBaseParticle(
                `${burstId}-master-tail-${index}`,
                "willow",
                angle,
                index % 6 === 0
                    ? "#ffffff"
                    : "#fff6df",
                "#ffffff",
            );

        particle.radiusScale =
            radiusScale *
            (
                0.76 +
                random01(
                    seed,
                    24600 +
                        index,
                ) *
                    0.2
            );

        particle.durationMs =
            4800 +
            random01(
                seed,
                24700 +
                    index,
            ) *
                1450;

        particle.delayMs =
            140 +
            random01(
                seed,
                24800 +
                    index,
            ) *
                180;

        particle.sizeScale =
            0.0028 +
            random01(
                seed,
                24900 +
                    index,
            ) *
                0.0016;

        particle.gravityScale =
            0.145 +
            random01(
                seed,
                25000 +
                    index,
            ) *
                0.06;

        particle.drag =
            2 +
            random01(
                seed,
                25100 +
                    index,
            ) *
                0.65;

        particle.swayAmplitudeScale =
            0.004 +
            random01(
                seed,
                25200 +
                    index,
            ) *
                0.006;

        particle.swayFrequency =
            0.8 +
            random01(
                seed,
                25300 +
                    index,
            ) *
                1.2;

        particle.twinkle =
            0.68;

        particle.strobe =
            index % 9 === 0
                ? 0.32
                : 0;

        particle.trailLength =
            0.27 +
            random01(
                seed,
                25400 +
                    index,
            ) *
                0.1;

        particle.trailWidthScale =
            0.00105;

        particle.glow =
            0.72;

        particles.push(
            particle,
        );
    }

    /*
     * Layer G · Impact shards
     *
     * 중앙에서 짧고 굵게 뻗는 파편.
     * 지속시간은 짧지만 첫 0.5초의 "충격"을 크게 만든다.
     */
    const shardCount = 52;

    for (
        let index = 0;
        index < shardCount;
        index += 1
    ) {
        const angle =
            index /
            shardCount *
            360 +
            randomSigned(
                seed,
                25500 +
                    index,
            ) *
                3.5;

        const particle =
            createBaseParticle(
                `${burstId}-master-shard-${index}`,
                "impact_shard",
                angle,
                index % 4 === 0
                    ? "#ffffff"
                    : "#ffe7ae",
                "#ffd0df",
            );

        particle.radiusScale =
            radiusScale *
            (
                0.3 +
                random01(
                    seed,
                    25600 +
                        index,
                ) *
                    0.25
            );

        particle.durationMs =
            760 +
            random01(
                seed,
                25700 +
                    index,
            ) *
                340;

        particle.delayMs =
            random01(
                seed,
                25800 +
                    index,
            ) *
                35;

        particle.sizeScale =
            0.004 +
            random01(
                seed,
                25900 +
                    index,
            ) *
                0.002;

        particle.gravityScale =
            0.004;

        particle.drag =
            0.7;

        particle.twinkle =
            0.1;

        particle.strobe =
            0.25;

        particle.trailLength =
            0.16 +
            random01(
                seed,
                26000 +
                    index,
            ) *
                0.06;

        particle.trailWidthScale =
            0.0018 +
            random01(
                seed,
                26100 +
                    index,
            ) *
                0.0006;

        particle.glow =
            1;

        particles.push(
            particle,
        );
    }

    return particles;
}

function createBurstParticles(kind: FireworkBurstKind, seed: number, burstId: string, palette: FireworkPalette, radiusScale: number) {
    switch (kind) {
        case "chrysanthemum":
            return createChrysanthemumParticles(seed, burstId, palette, radiusScale);
        case "sakura":
            return createSakuraParticles(seed, burstId, palette, radiusScale);
        case "ring":
            return createRingParticles(seed, burstId, palette, radiusScale);
        case "double_ring":
            return createDoubleRingParticles(seed, burstId, palette, radiusScale);
        case "willow":
            return createWillowParticles(seed, burstId, palette, radiusScale);
        case "brocade":
            return createBrocadeParticles(seed, burstId, palette, radiusScale);
        case "kamuro":
            return createKamuroParticles(seed, burstId, palette, radiusScale);
        case "palm":
            return createPalmParticles(seed, burstId, palette, radiusScale);
        case "dahlia":
            return createDahliaParticles(seed, burstId, palette, radiusScale);
        case "crossette":
            return createCrossetteParticles(seed, burstId, palette, radiusScale);
        case "snow_crystal":
            return createSnowCrystalParticles(seed, burstId, palette, radiusScale);
        case "heart":
            return createHeartParticles(seed, burstId, palette, radiusScale);
        case "star":
            return createStarParticles(seed, burstId, palette, radiusScale);
        case "strobe":
            return createStrobeParticles(seed, burstId, palette, radiusScale);
        case "master_finale":
            return createMasterFinaleParticles(
                seed,
                burstId,
                palette,
                radiusScale,
            );
        case "peony":
        default:
            return createPeonyParticles(seed, burstId, palette, radiusScale);
    }
}
function getShowProgressTime(session: HooWorldFireworksSession, progress: number) {
    const duration = Math.max(1, session.fireworksEndsAt -
        session.fuseEndsAt);
    return (session.fuseEndsAt +
        duration *
            clamp01(progress));
}
function createBurstPlan(session: HooWorldFireworksSession, seed: number, index: number, kind: FireworkBurstKind, progress: number, x: number, y: number, radiusScale: number, palette: FireworkPalette, romanticBloom = 1) {
    const id = `${session.sessionId}-burst-${index}-${kind}`;
    const at = getShowProgressTime(session, progress);
    const particleSeed = seed ^
        Math.imul(index +
            1, 0x45d9f3b);
    const particles = createBurstParticles(kind, particleSeed, id, palette, radiusScale);
    return {
        id,
        kind,
        x: clamp(x, 5, 95),
        y: clamp(y, 6, 58),
        at,
        durationMs: Math.max(1600, ...particles.map((particle) => particle.delayMs +
            particle.durationMs)),
        radiusScale,
        rotationDeg: randomSigned(seed, 9000 +
            index) *
            14,
        palette,
        particles,
        haloStrength: 0.72 +
            random01(seed, 9100 +
                index) *
                0.26,
        coreStrength: 0.76 +
            random01(seed, 9200 +
                index) *
                0.22,
        ringCount: kind ===
            "double_ring"
            ? 2
            : kind ===
                "ring"
                ? 1
                : 0,
        romanticBloom,
    } satisfies FireworkBurstPlan;
}
function createOpeningBurstPlans(session: HooWorldFireworksSession, seed: number) {
    const bursts: FireworkBurstPlan[] = [];
    bursts.push(createBurstPlan(session, seed, 0, "peony", 0.05, clamp(session.x -
        14, 16, 84), 27, 0.15, ROMANTIC_NEW_YEAR_PALETTES[0], 1.15));
    bursts.push(createBurstPlan(session, seed, 1, "sakura", 0.105, clamp(session.x +
        14, 16, 84), 24, 0.145, ROMANTIC_NEW_YEAR_PALETTES[1], 1.28));
    bursts.push(createBurstPlan(session, seed, 2, "double_ring", 0.16, clamp(session.x -
        3, 15, 85), 18, 0.155, ROMANTIC_NEW_YEAR_PALETTES[4], 1.1));
    return bursts;
}
function createMiddleBurstPlans(session: HooWorldFireworksSession, seed: number, startIndex: number) {
    const bursts: FireworkBurstPlan[] = [];
    const kinds: FireworkBurstKind[] = [
        "chrysanthemum",
        "dahlia",
        "snow_crystal",
        "palm",
        "sakura",
        "crossette",
        "brocade",
        "ring",
        "heart",
        "strobe",
        "willow",
        "star",
    ];
    const progresses = [
        0.22,
        0.285,
        0.345,
        0.405,
        0.465,
        0.525,
        0.585,
        0.64,
        0.695,
        0.745,
        0.79,
        0.825,
    ];
    for (let index = 0; index <
        kinds.length; index +=
        1) {
        const kind = kinds[index];
        const palette = kind ===
            "sakura" ||
            kind ===
                "heart"
            ? ROMANTIC_NEW_YEAR_PALETTES[1]
            : kind ===
                "snow_crystal"
                ? ROMANTIC_NEW_YEAR_PALETTES[2]
                : choosePalette(seed, 9300 +
                    index);
        const horizontalWave = Math.sin(index *
            1.78);
        const x = clamp(session.x +
            horizontalWave *
                25 +
            randomSigned(seed, 9400 +
                index) *
                5, 12, 88);
        const y = 15 +
            random01(seed, 9500 +
                index) *
                22;
        const radiusScale = 0.13 +
            random01(seed, 9600 +
                index) *
                0.07;
        bursts.push(createBurstPlan(session, seed, startIndex +
            index, kind, progresses[index], x, y, radiusScale, palette, kind ===
            "sakura" ||
            kind ===
                "heart"
            ? 1.4
            : 1.1));
    }
    return bursts;
}

function createFinaleBurstPlans(
    session: HooWorldFireworksSession,
    seed: number,
    startIndex: number,
) {
    const bursts: FireworkBurstPlan[] = [];

    const finaleCenter =
        clamp(
            session.x,
            30,
            70,
        );

    /*
     * 피날레 직전까지는 좌우에서 큰 불꽃이 몇 번 번갈아 터진다.
     * 0.93 이후에는 의도적으로 일반 폭발을 비운다.
     *
     * 이 짧은 "빈 구간"이 있어야 마지막 암전 + 중앙 로켓 +
     * 최종 폭발이 하나의 장면처럼 느껴진다.
     */
    bursts.push(
        createBurstPlan(
            session,
            seed,
            startIndex,
            "brocade",
            0.82,
            finaleCenter -
                24,
            28,
            0.185,
            ROMANTIC_NEW_YEAR_PALETTES[
                0
            ],
            1.36,
        ),
    );

    bursts.push(
        createBurstPlan(
            session,
            seed,
            startIndex +
                1,
            "sakura",
            0.845,
            finaleCenter +
                24,
            25,
            0.18,
            ROMANTIC_NEW_YEAR_PALETTES[
                1
            ],
            1.54,
        ),
    );

    bursts.push(
        createBurstPlan(
            session,
            seed,
            startIndex +
                2,
            "chrysanthemum",
            0.875,
            finaleCenter -
                10,
            17,
            0.21,
            ROMANTIC_NEW_YEAR_PALETTES[
                5
            ],
            1.38,
        ),
    );

    bursts.push(
        createBurstPlan(
            session,
            seed,
            startIndex +
                3,
            "dahlia",
            0.895,
            finaleCenter +
                12,
            19,
            0.205,
            ROMANTIC_NEW_YEAR_PALETTES[
                4
            ],
            1.42,
        ),
    );

    bursts.push(
        createBurstPlan(
            session,
            seed,
            startIndex +
                4,
            "snow_crystal",
            0.915,
            finaleCenter -
                27,
            21,
            0.17,
            ROMANTIC_NEW_YEAR_PALETTES[
                2
            ],
            1.34,
        ),
    );

    bursts.push(
        createBurstPlan(
            session,
            seed,
            startIndex +
                5,
            "double_ring",
            0.927,
            finaleCenter +
                28,
            20,
            0.175,
            ROMANTIC_NEW_YEAR_PALETTES[
                4
            ],
            1.32,
        ),
    );

    /*
     * 마지막 한 발.
     *
     * radiusScale 0.37은 일반 폭죽보다 훨씬 크다.
     * 실제 입자 생성은 createMasterFinaleParticles()가 담당하며
     * 여러 레이어를 한 번에 합친다.
     */
    bursts.push(
        createBurstPlan(
            session,
            seed,
            startIndex +
                6,
            "master_finale",
            1,
            finaleCenter,
            15,
            0.37,
            ROMANTIC_NEW_YEAR_PALETTES[
                5
            ],
            2.35,
        ),
    );

    return bursts;
}


function createRocketPlan(
    session: HooWorldFireworksSession,
    seed: number,
    burst: FireworkBurstPlan,
    index: number,
) {
    const isMasterFinale =
        burst.kind ===
        "master_finale";

    /*
     * 최종 로켓은 일반 로켓보다 오래 올라간다.
     *
     * 암전이 시작된 뒤 중앙에서 한 줄의 밝은 궤적이 천천히 올라가고,
     * 그 로켓이 꼭대기에 닿는 순간 최종 폭발이 터지도록 타이밍을 맞춘다.
     */
    const launchDuration =
        isMasterFinale
            ? 1180 +
                random01(
                    seed,
                    9700 +
                        index,
                ) *
                    180
            : 720 +
                random01(
                    seed,
                    9700 +
                        index,
                ) *
                    260;

    const startX =
        isMasterFinale
            ? clamp(
                session.x +
                    randomSigned(
                        seed,
                        9800 +
                            index,
                    ) *
                        0.9,
                4,
                96,
            )
            : clamp(
                session.x +
                    randomSigned(
                        seed,
                        9800 +
                            index,
                    ) *
                        3.2,
                4,
                96,
            );

    const startY =
        isMasterFinale
            ? clamp(
                session.y -
                    1.5,
                58,
                94,
            )
            : clamp(
                session.y -
                    2 +
                    randomSigned(
                        seed,
                        9900 +
                            index,
                    ) *
                        1.6,
                55,
                95,
            );

    const endX =
        burst.x;

    const endY =
        burst.y;

    const sway =
        isMasterFinale
            ? randomSigned(
                seed,
                10000 +
                    index,
            ) *
                0.006
            : randomSigned(
                seed,
                10000 +
                    index,
            ) *
                0.018;

    const trailWidthScale =
        isMasterFinale
            ? 0.0031 +
                random01(
                    seed,
                    10100 +
                        index,
                ) *
                    0.00065
            : 0.0017 +
                random01(
                    seed,
                    10100 +
                        index,
                ) *
                    0.0008;

    const smokeStrength =
        isMasterFinale
            ? 0.82 +
                random01(
                    seed,
                    10200 +
                        index,
                ) *
                    0.12
            : 0.55 +
                random01(
                    seed,
                    10200 +
                        index,
                ) *
                    0.28;

    const color =
        isMasterFinale
            ? "#fff7df"
            : mixHex(
                burst.palette.primary,
                "#ffffff",
                0.48,
            );

    return {
        id:
            `${burst.id}-rocket`,
        burstKind:
            burst.kind,
        launchAt:
            burst.at -
            launchDuration,
        burstAt:
            burst.at,
        startX,
        startY,
        endX,
        endY,
        sway,
        color,
        trailWidthScale,
        smokeStrength,
        impactScale:
            isMasterFinale
                ? 2.2
                : 1,
    } satisfies FireworkRocketPlan;
}

function createGlitterPlans(session: HooWorldFireworksSession, seed: number) {
    const glitter: FireworkGlitterPlan[] = [];
    const count = 64;
    for (let index = 0; index <
        count; index +=
        1) {
        glitter.push({
            id: `${session.sessionId}-glitter-${index}`,
            x: random01(seed, 10300 +
                index *
                    7),
            y: 0.02 +
                random01(seed, 10400 +
                    index *
                        7) *
                    0.72,
            sizeScale: 0.0015 +
                random01(seed, 10500 +
                    index *
                        7) *
                    0.0042,
            driftXScale: randomSigned(seed, 10600 +
                index *
                    7) *
                0.018,
            driftYScale: 0.035 +
                random01(seed, 10700 +
                    index *
                        7) *
                    0.065,
            durationMs: 3600 +
                random01(seed, 10800 +
                    index *
                        7) *
                    5800,
            phase: random01(seed, 10900 +
                index *
                    7) *
                TWO_PI,
            twinkle: 0.4 +
                random01(seed, 11000 +
                    index *
                        7) *
                    0.6,
            color: GLITTER_COLORS[Math.floor(random01(seed, 11100 +
                index *
                    7) *
                GLITTER_COLORS.length) %
                GLITTER_COLORS.length],
        });
    }
    return glitter;
}
function createFestivalBokehPlans(session: HooWorldFireworksSession, seed: number) {
    const bokeh: FestivalBokehPlan[] = [];
    const count = 10;
    for (let index = 0; index <
        count; index +=
        1) {
        const sideBias = index %
            2 ===
            0
            ? random01(seed, 11200 +
                index) *
                0.34
            : 0.66 +
                random01(seed, 11300 +
                    index) *
                    0.34;
        bokeh.push({
            id: `${session.sessionId}-bokeh-${index}`,
            x: sideBias,
            y: 0.62 +
                random01(seed, 11400 +
                    index) *
                    0.34,
            radiusScale: 0.004 +
                random01(seed, 11500 +
                    index) *
                    0.012,
            alpha: 0.04 +
                random01(seed, 11600 +
                    index) *
                    0.1,
            phase: random01(seed, 11700 +
                index) *
                TWO_PI,
            color: FESTIVAL_BOKEH_COLORS[Math.floor(random01(seed, 11800 +
                index) *
                FESTIVAL_BOKEH_COLORS.length) %
                FESTIVAL_BOKEH_COLORS.length],
        });
    }
    return bokeh;
}
function createNiagaraTrailPlans(session: HooWorldFireworksSession, seed: number) {
    const plans: NiagaraTrailPlan[] = [];
    const count = 16;
    for (let index = 0; index <
        count; index +=
        1) {
        const normalized = count <=
            1
            ? 0.5
            : index /
                (count -
                    1);
        const centerWeight = 1 -
            Math.abs(normalized -
                0.5) *
                1.65;
        const color = index %
            7 ===
            0
            ? "#fff8e8"
            : index %
                3 ===
                0
                ? "#ffe1a8"
                : "#ffd08f";
        plans.push({
            id: `${session.sessionId}-niagara-${index}`,
            x: 0.12 +
                normalized *
                    0.76 +
                randomSigned(seed, 13000 +
                    index) *
                    0.007,
            topY: 0.08 +
                random01(seed, 13100 +
                    index) *
                    0.055,
            lengthScale: 0.26 +
                centerWeight *
                    0.18 +
                random01(seed, 13200 +
                    index) *
                    0.06,
            widthScale: 0.00085 +
                random01(seed, 13300 +
                    index) *
                    0.00105,
            swayScale: 0.003 +
                random01(seed, 13400 +
                    index) *
                    0.008,
            phase: random01(seed, 13500 +
                index) *
                TWO_PI,
            delayMs: random01(seed, 13600 +
                index) *
                420,
            durationMs: 3200 +
                random01(seed, 13700 +
                    index) *
                    1100,
            color,
            alpha: 0.52 +
                random01(seed, 13800 +
                    index) *
                    0.38,
        });
    }
    return plans;
}
function createSakuraAfterglowPlans(session: HooWorldFireworksSession, seed: number) {
    const plans: SakuraAfterglowPlan[] = [];
    const count = 28;
    for (let index = 0; index <
        count; index +=
        1) {
        const colorA = index %
            5 ===
            0
            ? "#fff9fc"
            : index %
                3 ===
                0
                ? "#ffd8e8"
                : "#ffc7da";
        const colorB = index %
            4 ===
            0
            ? "#f1ddff"
            : "#fff0f6";
        plans.push({
            id: `${session.sessionId}-sakura-afterglow-${index}`,
            x: 0.08 +
                random01(seed, 13900 +
                    index *
                        11) *
                    0.84,
            y: 0.06 +
                random01(seed, 14000 +
                    index *
                        11) *
                    0.46,
            sizeScale: 0.0022 +
                random01(seed, 14100 +
                    index *
                        11) *
                    0.0046,
            driftXScale: randomSigned(seed, 14200 +
                index *
                    11) *
                0.06,
            driftYScale: 0.08 +
                random01(seed, 14300 +
                    index *
                        11) *
                    0.12,
            rotationDeg: randomSigned(seed, 14400 +
                index *
                    11) *
                180,
            rotationSpeedDeg: randomSigned(seed, 14500 +
                index *
                    11) *
                130,
            phase: random01(seed, 14600 +
                index *
                    11) *
                TWO_PI,
            delayMs: random01(seed, 14700 +
                index *
                    11) *
                3600,
            durationMs: 5200 +
                random01(seed, 14800 +
                    index *
                        11) *
                    5200,
            colorA,
            colorB,
            alpha: 0.35 +
                random01(seed, 14900 +
                    index *
                        11) *
                    0.48,
        });
    }
    return plans;
}
function createReflectionGlowPlans(session: HooWorldFireworksSession, seed: number) {
    const plans: ReflectionGlowPlan[] = [];
    const count = 8;
    for (let index = 0; index <
        count; index +=
        1) {
        const normalized = count <=
            1
            ? 0.5
            : index /
                (count -
                    1);
        plans.push({
            id: `${session.sessionId}-reflection-${index}`,
            x: 0.08 +
                normalized *
                    0.84,
            widthScale: 0.012 +
                random01(seed, 15000 +
                    index) *
                    0.026,
            heightScale: 0.04 +
                random01(seed, 15100 +
                    index) *
                    0.1,
            phase: random01(seed, 15200 +
                index) *
                TWO_PI,
            color: index %
                4 ===
                0
                ? "#ffd4e4"
                : index %
                    3 ===
                    0
                    ? "#e1d5ff"
                    : "#ffe1a9",
            alpha: 0.025 +
                random01(seed, 15300 +
                    index) *
                    0.055,
        });
    }
    return plans;
}
function createSenrinBloomPlans(session: HooWorldFireworksSession, seed: number, bursts: FireworkBurstPlan[]) {
    const plans: SenrinBloomPlan[] = [];
    let planIndex = 0;
    for (let burstIndex = 0; burstIndex <
        bursts.length; burstIndex +=
        1) {
        const burst = bursts[burstIndex];
        const eligible = burst.kind ===
            "chrysanthemum" ||
            burst.kind ===
                "brocade" ||
            burst.kind ===
                "kamuro" ||
            burst.kind ===
                "dahlia" ||
            burst.kind ===
                "sakura";
        if (!eligible) {
            continue;
        }
        const childCount = burst.kind ===
            "kamuro"
            ? 3
            : burst.kind ===
                "brocade"
                ? 3
                : 2;
        for (let child = 0; child <
            childCount; child +=
            1) {
            const radialAngle = random01(seed, 15400 +
                burstIndex *
                    50 +
                child) *
                TWO_PI;
            const radialDistance = 0.025 +
                random01(seed, 15500 +
                    burstIndex *
                        50 +
                    child) *
                    0.075;
            const x = clamp(burst.x /
                100 +
                Math.cos(radialAngle) *
                    radialDistance, 0.08, 0.92);
            const y = clamp(burst.y /
                100 +
                Math.sin(radialAngle) *
                    radialDistance *
                    0.72, 0.06, 0.62);
            const colorA = child %
                4 ===
                0
                ? burst.palette.core
                : chooseColor(burst.palette, child +
                    burstIndex);
            const colorB = mixHex(colorA, burst.palette.secondary, 0.45);
            plans.push({
                id: `${session.sessionId}-senrin-${planIndex}`,
                x,
                y,
                at: burst.at +
                    520 +
                    random01(seed, 15600 +
                        planIndex) *
                        820,
                durationMs: 1050 +
                    random01(seed, 15700 +
                        planIndex) *
                        680,
                radiusScale: 0.022 +
                    random01(seed, 15800 +
                        planIndex) *
                        0.026,
                rayCount: 6 +
                    Math.floor(random01(seed, 15900 +
                        planIndex) *
                        3),
                rotationDeg: randomSigned(seed, 16000 +
                    planIndex) *
                    18,
                colorA,
                colorB,
                alpha: 0.58 +
                    random01(seed, 16100 +
                        planIndex) *
                        0.34,
                twinkle: 0.45 +
                    random01(seed, 16200 +
                        planIndex) *
                        0.48,
            });
            planIndex +=
                1;
        }
    }
    return plans;
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * CINEMATIC FINALE TIMING
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 마지막 폭발 직전의 감정선은 "많이 터뜨리는 것"보다 타이밍이 중요하다.
 *
 * 1) 일반 불꽃이 잠깐 멎는다.
 * 2) 화면 전체가 천천히 어두워진다.
 * 3) 암전 속에서 중앙 로켓 한 발이 올라간다.
 * 4) 거의 검게 내려간 순간 최종 폭발.
 * 5) 폭발 직후 아주 짧은 노출 플래시와 충격파.
 * 6) 거대한 불꽃이 펼쳐지고 흰 별비로 연결.
 */
function createFinaleImpactTiming(
    session: HooWorldFireworksSession,
) {
    const impactAt =
        session.fireworksEndsAt;

    const darkStartAt =
        impactAt -
        1500;

    const nearBlackAt =
        impactAt -
        140;

    const masterLaunchAt =
        impactAt -
        1240;

    const flashEndsAt =
        impactAt +
        520;

    const shockwaveEndsAt =
        impactAt +
        1750;

    const whiteRainStartsAt =
        impactAt +
        520;

    const whiteRainEndsAt =
        Math.max(
            whiteRainStartsAt +
                7800,
            session.glitterEndsAt,
        );

    return {
        darkStartAt,
        nearBlackAt,
        masterLaunchAt,
        impactAt,
        flashEndsAt,
        shockwaveEndsAt,
        whiteRainStartsAt,
        whiteRainEndsAt,
    } satisfies FinaleImpactTiming;
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * OUTLINE BACK-SCATTER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 작은 폭죽이 터질 때 앞쪽 점들만 반듯하게 퍼지면 디지털 아이콘처럼 보인다.
 *
 * 그래서 각 일반 burst 뒤편에 "늦게 따라오는 윤곽 입자"를 별도로 만든다.
 *
 * 이 입자들은:
 * - 메인 윤곽보다 약간 늦게 출발
 * - 메인 반경보다 조금 짧게 이동
 * - 진행 방향의 뒤쪽으로 backtrack
 * - 접선 방향으로 좌우 흔들림
 * - 중력과 바람을 더 많이 받음
 * - 광량은 낮지만 잔광이 더 길게 남음
 *
 * 결과적으로 작은 불꽃의 외곽선 뒤에서 먼지가 흩날리듯
 * "윤곽 뒤로 흩어지는" 깊이감이 생긴다.
 */
function createOutlineScatterPlans(
    session: HooWorldFireworksSession,
    seed: number,
    bursts: FireworkBurstPlan[],
) {
    const plans: OutlineScatterPlan[] = [];

    let planIndex =
        0;

    for (
        let burstIndex = 0;
        burstIndex < bursts.length;
        burstIndex += 1
    ) {
        const burst =
            bursts[
                burstIndex
            ];

        if (
            burst.kind ===
            "master_finale"
        ) {
            continue;
        }

        /*
         * 큰 willow / kamuro는 본래 꼬리가 길기 때문에
         * 지나친 back-scatter를 넣으면 번져 보인다.
         * 종류별로 밀도를 살짝 조절한다.
         */
        const densityMultiplier =
            burst.kind ===
                "willow" ||
            burst.kind ===
                "kamuro"
                ? 0.72
                : burst.kind ===
                    "sakura" ||
                  burst.kind ===
                    "dahlia"
                    ? 1.22
                    : 1;

        const baseCount =
            Math.round(
                (
                    5 +
                    random01(
                        seed,
                        30000 +
                            burstIndex,
                    ) *
                        4
                ) *
                densityMultiplier,
            );

        for (
            let index = 0;
            index < baseCount;
            index += 1
        ) {
            const angleDeg =
                index /
                baseCount *
                360 +
                randomSigned(
                    seed,
                    30100 +
                        burstIndex *
                            100 +
                        index,
                ) *
                    7.5;

            const radiusScale =
                burst.radiusScale *
                (
                    0.58 +
                    random01(
                        seed,
                        30200 +
                            burstIndex *
                                100 +
                            index,
                    ) *
                        0.35
                );

            const lagScale =
                0.06 +
                random01(
                    seed,
                    30300 +
                        burstIndex *
                            100 +
                        index,
                ) *
                    0.18;

            const backtrackScale =
                0.018 +
                random01(
                    seed,
                    30400 +
                        burstIndex *
                            100 +
                        index,
                ) *
                    0.045;

            const tangentDriftScale =
                randomSigned(
                    seed,
                    30500 +
                        burstIndex *
                            100 +
                        index,
                ) *
                (
                    0.012 +
                    random01(
                        seed,
                        30600 +
                            burstIndex *
                                100 +
                            index,
                    ) *
                        0.02
                );

            const gravityScale =
                0.035 +
                random01(
                    seed,
                    30700 +
                        burstIndex *
                            100 +
                        index,
                ) *
                    0.07;

            const windScale =
                randomSigned(
                    seed,
                    30800 +
                        burstIndex *
                            100 +
                        index,
                ) *
                (
                    0.008 +
                    random01(
                        seed,
                        30900 +
                            burstIndex *
                                100 +
                            index,
                    ) *
                        0.015
                );

            const sizeScale =
                0.0018 +
                random01(
                    seed,
                    31000 +
                        burstIndex *
                            100 +
                        index,
                ) *
                    0.0028;

            const trailScale =
                0.035 +
                random01(
                    seed,
                    31100 +
                        burstIndex *
                            100 +
                        index,
                ) *
                    0.075;

            const alpha =
                0.18 +
                random01(
                    seed,
                    31200 +
                        burstIndex *
                            100 +
                        index,
                ) *
                    0.32;

            const twinkle =
                0.18 +
                random01(
                    seed,
                    31300 +
                        burstIndex *
                            100 +
                        index,
                ) *
                    0.5;

            const colorA =
                index % 5 === 0
                    ? burst.palette.core
                    : chooseColor(
                        burst.palette,
                        index +
                            burstIndex,
                    );

            const colorB =
                mixHex(
                    colorA,
                    burst.palette.secondary,
                    0.46,
                );

            plans.push(
                {
                    id:
                        `${session.sessionId}-outline-${planIndex}`,
                    burstId:
                        burst.id,
                    at:
                        burst.at +
                        70 +
                        random01(
                            seed,
                            31400 +
                                planIndex,
                        ) *
                            210,
                    durationMs:
                        1800 +
                        random01(
                            seed,
                            31500 +
                                planIndex,
                        ) *
                            1450,
                    x:
                        burst.x,
                    y:
                        burst.y,
                    angleDeg,
                    radiusScale,
                    lagScale,
                    backtrackScale,
                    tangentDriftScale,
                    gravityScale,
                    windScale,
                    phase:
                        random01(
                            seed,
                            31600 +
                                planIndex,
                        ) *
                        TWO_PI,
                    sizeScale,
                    trailScale,
                    alpha,
                    twinkle,
                    colorA,
                    colorB,
                },
            );

            planIndex +=
                1;
        }
    }

    return plans;
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * FINALE WHITE RAIN
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 최종 폭발 이후의 감정적인 여운.
 *
 * 하얀 빛이 그냥 화면 위에서 아래로 떨어지는 것이 아니라
 * 마지막 폭발의 큰 원형 canopy에서 떨어져 나온 것처럼 시작 위치를 만든다.
 *
 * depth 값을 이용해:
 * - 뒤쪽: 작고 흐리고 느리게
 * - 중간: 보통 크기
 * - 앞쪽: 조금 크고 강하게 반짝임
 *
 * 세 깊이가 동시에 움직여 2D 화면에서도 공간감이 생긴다.
 */
function createFinaleWhiteRainPlans(
    session: HooWorldFireworksSession,
    seed: number,
    timing: FinaleImpactTiming,
) {
    const plans: FinaleWhiteRainPlan[] = [];

    const count =
        90;

    const centerX =
        clamp(
            session.x /
            100,
            0.3,
            0.7,
        );

    const centerY =
        0.15;

    for (
        let index = 0;
        index < count;
        index += 1
    ) {
        const shellAngle =
            random01(
                seed,
                32000 +
                    index *
                        13,
            ) *
            TWO_PI;

        const shellRadius =
            0.05 +
            random01(
                seed,
                32100 +
                    index *
                        13,
            ) *
                0.29;

        const depth =
            random01(
                seed,
                32200 +
                    index *
                        13,
            );

        const startX =
            clamp(
                centerX +
                    Math.cos(
                        shellAngle,
                    ) *
                        shellRadius *
                        (
                            0.82 +
                            depth *
                                0.3
                        ),
                0.03,
                0.97,
            );

        const startY =
            clamp(
                centerY +
                    Math.sin(
                        shellAngle,
                    ) *
                        shellRadius *
                        0.56,
                0.03,
                0.48,
            );

        const delayMs =
            200 +
            random01(
                seed,
                32300 +
                    index *
                        13,
            ) *
                1900;

        const durationMs =
            6500 +
            random01(
                seed,
                32400 +
                    index *
                        13,
            ) *
                6100;

        const spreadXScale =
            randomSigned(
                seed,
                32500 +
                    index *
                        13,
            ) *
            (
                0.01 +
                depth *
                    0.018
            );

        const fallScale =
            0.32 +
            random01(
                seed,
                32600 +
                    index *
                        13,
            ) *
                0.5 +
            depth *
                0.08;

        const driftXScale =
            randomSigned(
                seed,
                32700 +
                    index *
                        13,
            ) *
            (
                0.015 +
                depth *
                    0.025
            );

        const swayScale =
            0.004 +
            random01(
                seed,
                32800 +
                    index *
                        13,
            ) *
                0.014;

        const sizeScale =
            0.0011 +
            depth *
                0.0026 +
            random01(
                seed,
                32900 +
                    index *
                        13,
            ) *
                0.0012;

        const trailScale =
            0.035 +
            depth *
                0.07 +
            random01(
                seed,
                33000 +
                    index *
                        13,
            ) *
                0.04;

        const alpha =
            0.25 +
            depth *
                0.52 +
            random01(
                seed,
                33100 +
                    index *
                        13,
            ) *
                0.18;

        const twinkle =
            0.45 +
            random01(
                seed,
                33200 +
                    index *
                        13,
            ) *
                0.55;

        const strobe =
            index % 17 === 0
                ? 0.65 +
                    random01(
                        seed,
                        33300 +
                            index,
                    ) *
                        0.3
                : 0.12 +
                    random01(
                        seed,
                        33400 +
                            index,
                    ) *
                        0.22;

        const colorSelector =
            index %
            11;

        const color =
            colorSelector === 0
                ? "#fff0d3"
                : colorSelector === 1
                    ? "#f1eaff"
                    : colorSelector === 2
                        ? "#ffe9f1"
                        : "#ffffff";

        plans.push(
            {
                id:
                    `${session.sessionId}-white-rain-${index}`,
                at:
                    timing.whiteRainStartsAt +
                    delayMs,
                durationMs,
                startX,
                startY,
                spreadXScale,
                fallScale,
                driftXScale,
                swayScale,
                phase:
                    random01(
                        seed,
                        33500 +
                            index *
                                13,
                    ) *
                    TWO_PI,
                sizeScale,
                trailScale,
                depth,
                alpha:
                    clamp01(
                        alpha,
                    ),
                twinkle,
                strobe,
                color,
            },
        );
    }

    return plans;
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * FINALE IMPACT SHARDS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 최종 폭발 첫 1초는 부드럽기만 하면 힘이 부족하다.
 * 아주 짧고 날카로운 빛의 파편을 중심에서 뻗게 해
 * "펑" 하는 순간의 충격을 눈으로 느끼게 한다.
 */
function createFinaleImpactShardPlans(
    session: HooWorldFireworksSession,
    seed: number,
    timing: FinaleImpactTiming,
) {
    const plans: FinaleImpactShardPlan[] = [];

    const count =
        44;

    for (
        let index = 0;
        index < count;
        index += 1
    ) {
        const angleDeg =
            index /
            count *
            360 +
            randomSigned(
                seed,
                34000 +
                    index,
            ) *
                2.8;

        const radiusScale =
            0.12 +
            random01(
                seed,
                34100 +
                    index,
            ) *
                0.31;

        const widthScale =
            0.0007 +
            random01(
                seed,
                34200 +
                    index,
            ) *
                0.0012;

        const lengthScale =
            0.055 +
            random01(
                seed,
                34300 +
                    index,
            ) *
                0.14;

        const curlScale =
            randomSigned(
                seed,
                34400 +
                    index,
            ) *
            (
                0.004 +
                random01(
                    seed,
                    34500 +
                        index,
                ) *
                    0.006
            );

        const alpha =
            0.4 +
            random01(
                seed,
                34600 +
                    index,
            ) *
                0.55;

        const color =
            index % 8 === 0
                ? "#ffffff"
                : index % 4 === 0
                    ? "#ffd6e4"
                    : "#ffe7b5";

        plans.push(
            {
                id:
                    `${session.sessionId}-impact-shard-${index}`,
                at:
                    timing.impactAt +
                    random01(
                        seed,
                        34700 +
                            index,
                    ) *
                        60,
                durationMs:
                    720 +
                    random01(
                        seed,
                        34800 +
                            index,
                    ) *
                        540,
                angleDeg,
                radiusScale,
                widthScale,
                lengthScale,
                curlScale,
                alpha,
                color,
            },
        );
    }

    return plans;
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * FINALE SHOCKWAVE RINGS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 실제 화면을 흔들지 않고도 임팩트를 만들기 위한 광학적 충격파.
 * 여러 개의 얇은 링을 시간차로 퍼뜨린다.
 */
function createFinaleShockwavePlans(
    session: HooWorldFireworksSession,
    timing: FinaleImpactTiming,
) {
    const colors = [
        "#ffffff",
        "#fff0c6",
        "#ffd7e5",
        "#e7dcff",
        "#ffffff",
    ] as const;

    const plans: FinaleShockwavePlan[] = [];

    for (
        let index = 0;
        index < colors.length;
        index += 1
    ) {
        plans.push(
            {
                id:
                    `${session.sessionId}-shockwave-${index}`,
                at:
                    timing.impactAt +
                    index *
                        75,
                durationMs:
                    980 +
                    index *
                        170,
                radiusFromScale:
                    0.018 +
                    index *
                        0.012,
                radiusToScale:
                    0.23 +
                    index *
                        0.075,
                lineWidthScale:
                    Math.max(
                        0.0007,
                        0.0022 -
                            index *
                                0.00028,
                    ),
                blurScale:
                    0.01 +
                    index *
                        0.004,
                alpha:
                    0.36 -
                    index *
                        0.045,
                color:
                    colors[
                        index
                    ],
            },
        );
    }

    return plans;
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * BACKLIT FINALE SMOKE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 큰 폭발 뒤에 아무 연기도 없으면 파티클이 공중에 붙어 있는 느낌이 난다.
 *
 * 최종 폭발 뒤편에 아주 옅은 연무를 배치하고,
 * 폭발 광원이 그 연기를 뒤에서 비추는 것처럼 렌더한다.
 */
function createFinaleSmokeCloudPlans(
    session: HooWorldFireworksSession,
    seed: number,
    timing: FinaleImpactTiming,
) {
    const plans: FinaleSmokeCloudPlan[] = [];

    const count =
        12;

    const centerX =
        clamp(
            session.x /
            100,
            0.3,
            0.7,
        );

    const centerY =
        0.16;

    for (
        let index = 0;
        index < count;
        index += 1
    ) {
        const angle =
            random01(
                seed,
                35000 +
                    index *
                        7,
            ) *
            TWO_PI;

        const distance =
            0.025 +
            random01(
                seed,
                35100 +
                    index *
                        7,
            ) *
                0.18;

        plans.push(
            {
                id:
                    `${session.sessionId}-finale-smoke-${index}`,
                at:
                    timing.impactAt +
                    random01(
                        seed,
                        35200 +
                            index *
                                7,
                    ) *
                        420,
                durationMs:
                    3600 +
                    random01(
                        seed,
                        35300 +
                            index *
                                7,
                    ) *
                        3000,
                x:
                    clamp(
                        centerX +
                            Math.cos(
                                angle,
                            ) *
                                distance,
                        0.08,
                        0.92,
                    ),
                y:
                    clamp(
                        centerY +
                            Math.sin(
                                angle,
                            ) *
                                distance *
                                0.6,
                        0.05,
                        0.44,
                    ),
                radiusScale:
                    0.025 +
                    random01(
                        seed,
                        35400 +
                            index *
                                7,
                    ) *
                        0.075,
                driftXScale:
                    randomSigned(
                        seed,
                        35500 +
                            index *
                                7,
                    ) *
                    0.025,
                driftYScale:
                    -0.015 -
                    random01(
                        seed,
                        35600 +
                            index *
                                7,
                    ) *
                        0.025,
                phase:
                    random01(
                        seed,
                        35700 +
                            index *
                                7,
                    ) *
                    TWO_PI,
                alpha:
                    0.025 +
                    random01(
                        seed,
                        35800 +
                            index *
                                7,
                    ) *
                        0.055,
                color:
                    index % 3 === 0
                        ? "#f5e8dc"
                        : index % 3 === 1
                            ? "#eadff0"
                            : "#e9e3de",
            },
        );
    }

    return plans;
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * MICRO STARS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 암전 직전과 최종 폭발 이후 아주 작은 별점이 보이게 한다.
 * 큰 입자 사이의 빈 공간을 채우기 위한 미세 디테일 레이어다.
 */
function createFinaleMicroStarPlans(
    session: HooWorldFireworksSession,
    seed: number,
    timing: FinaleImpactTiming,
) {
    const plans: FinaleMicroStarPlan[] = [];

    const count =
        48;

    for (
        let index = 0;
        index < count;
        index += 1
    ) {
        const x =
            0.05 +
            random01(
                seed,
                36000 +
                    index *
                        5,
            ) *
                0.9;

        const y =
            0.035 +
            random01(
                seed,
                36100 +
                    index *
                        5,
            ) *
                0.62;

        const at =
            timing.darkStartAt +
            random01(
                seed,
                36200 +
                    index *
                        5,
            ) *
                900;

        const durationMs =
            2500 +
            random01(
                seed,
                36300 +
                    index *
                        5,
            ) *
                6200;

        const sizeScale =
            0.00055 +
            random01(
                seed,
                36400 +
                    index *
                        5,
            ) *
                0.0014;

        const alpha =
            0.1 +
            random01(
                seed,
                36500 +
                    index *
                        5,
            ) *
                0.34;

        const twinkle =
            0.45 +
            random01(
                seed,
                36600 +
                    index *
                        5,
            ) *
                0.55;

        const color =
            index % 9 === 0
                ? "#ffe9c4"
                : index % 11 === 0
                    ? "#eadfff"
                    : "#ffffff";

        plans.push(
            {
                id:
                    `${session.sessionId}-micro-star-${index}`,
                x,
                y,
                at,
                durationMs,
                sizeScale,
                phase:
                    random01(
                        seed,
                        36700 +
                            index *
                                5,
                    ) *
                    TWO_PI,
                alpha,
                twinkle,
                color,
            },
        );
    }

    return plans;
}


function createFireworksScene(
    session: HooWorldFireworksSession,
) {
    const seed =
        getSeed(
            session.sessionId,
        );

    const opening =
        createOpeningBurstPlans(
            session,
            seed,
        );

    const middle =
        createMiddleBurstPlans(
            session,
            seed,
            opening.length,
        );

    const finale =
        createFinaleBurstPlans(
            session,
            seed,
            opening.length +
                middle.length,
        );

    const bursts = [
        ...opening,
        ...middle,
        ...finale,
    ];

    const rockets =
        bursts.map(
            (
                burst,
                index,
            ) =>
                createRocketPlan(
                    session,
                    seed,
                    burst,
                    index,
                ),
        );

    const glitter =
        createGlitterPlans(
            session,
            seed,
        );

    const bokeh =
        createFestivalBokehPlans(
            session,
            seed,
        );

    const niagara =
        createNiagaraTrailPlans(
            session,
            seed,
        );

    const sakuraAfterglow =
        createSakuraAfterglowPlans(
            session,
            seed,
        );

    const reflections =
        createReflectionGlowPlans(
            session,
            seed,
        );

    const senrin =
        createSenrinBloomPlans(
            session,
            seed,
            bursts,
        );

    const finaleTiming =
        createFinaleImpactTiming(
            session,
        );

    const outlineScatter =
        createOutlineScatterPlans(
            session,
            seed,
            bursts,
        );

    const finaleWhiteRain =
        createFinaleWhiteRainPlans(
            session,
            seed,
            finaleTiming,
        );

    const finaleImpactShards =
        createFinaleImpactShardPlans(
            session,
            seed,
            finaleTiming,
        );

    const finaleShockwaves =
        createFinaleShockwavePlans(
            session,
            finaleTiming,
        );

    const finaleSmokeClouds =
        createFinaleSmokeCloudPlans(
            session,
            seed,
            finaleTiming,
        );

    const finaleMicroStars =
        createFinaleMicroStarPlans(
            session,
            seed,
            finaleTiming,
        );

    /*
     * 렌더링 루프에서 매 프레임 filter / master 판정을 하지 않도록
     * scene 생성 단계에서 고정 배열로 분리한다.
     */
    const regularBursts =
        bursts.filter(
            (
                burst,
            ) =>
                burst.kind !==
                "master_finale",
        );

    const masterFinaleBursts =
        bursts.filter(
            (
                burst,
            ) =>
                burst.kind ===
                "master_finale",
        );

    const regularRockets =
        rockets.filter(
            (
                rocket,
            ) =>
                rocket.burstKind !==
                "master_finale",
        );

    const masterFinaleRockets =
        rockets.filter(
            (
                rocket,
            ) =>
                rocket.burstKind ===
                "master_finale",
        );

    const finaleWhiteRainDepthBuckets: [
        FinaleWhiteRainPlan[],
        FinaleWhiteRainPlan[],
        FinaleWhiteRainPlan[],
    ] = [
        [],
        [],
        [],
    ];

    for (
        const plan of
        finaleWhiteRain
    ) {
        const bucketIndex =
            Math.min(
                2,
                Math.floor(
                    clamp01(
                        plan.depth,
                    ) *
                    3,
                ),
            );

        const targetBucket =
            finaleWhiteRainDepthBuckets[
                bucketIndex
            ] ??
            finaleWhiteRainDepthBuckets[
                2
            ];

        targetBucket.push(
            plan,
        );
    }

    return {
        bursts,
        rockets,
        regularBursts,
        masterFinaleBursts,
        regularRockets,
        masterFinaleRockets,
        glitter,
        bokeh,
        niagara,
        sakuraAfterglow,
        reflections,
        senrin,
        outlineScatter,
        finaleWhiteRain,
        finaleWhiteRainDepthBuckets,
        finaleImpactShards,
        finaleShockwaves,
        finaleSmokeClouds,
        finaleMicroStars,
        finaleTiming,
    } satisfies FireworksScene;
}

function resizeCanvas(canvas: HTMLCanvasElement, size: CanvasSize) {
    const targetWidth = Math.max(1, Math.round(size.width *
        size.dpr));
    const targetHeight = Math.max(1, Math.round(size.height *
        size.dpr));
    if (canvas.width !==
        targetWidth) {
        canvas.width =
            targetWidth;
    }
    if (canvas.height !==
        targetHeight) {
        canvas.height =
            targetHeight;
    }
    canvas.style.width =
        `${size.width}px`;
    canvas.style.height =
        `${size.height}px`;
}
function applyCanvasScale(context: CanvasRenderingContext2D, size: CanvasSize) {
    context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
}
function clearCanvas(context: CanvasRenderingContext2D, size: CanvasSize) {
    context.save();
    context.globalCompositeOperation =
        "source-over";
    context.globalAlpha =
        1;
    context.clearRect(0, 0, size.width, size.height);
    context.restore();
}
function getBurstCenter(burst: FireworkBurstPlan, size: CanvasSize) {
    return {
        x: burst.x /
            100 *
            size.width,
        y: burst.y /
            100 *
            size.height,
    };
}
function getRocketPoint(rocket: FireworkRocketPlan, progress: number, size: CanvasSize) {
    const safe = clamp01(progress);
    const eased = easeOutQuart(safe);
    const startX = rocket.startX /
        100 *
        size.width;
    const startY = rocket.startY /
        100 *
        size.height;
    const endX = rocket.endX /
        100 *
        size.width;
    const endY = rocket.endY /
        100 *
        size.height;
    const curve = Math.sin(safe *
        Math.PI) *
        rocket.sway *
        size.width;
    return {
        x: lerp(startX, endX, eased) +
            curve,
        y: lerp(startY, endY, eased),
    };
}
function getParticlePoint(particle: FireworkParticlePlan, burst: FireworkBurstPlan, now: number, size: CanvasSize) {
    const localStart = burst.at +
        particle.delayMs;
    const rawProgress = (now -
        localStart) /
        particle.durationMs;
    if (rawProgress <
        0 ||
        rawProgress >
            1) {
        return null;
    }
    const progress = clamp01(rawProgress);
    const center = getBurstCenter(burst, size);
    const baseScale = getCanvasScale(size);
    const baseAngleRad = (particle.angleDeg +
        burst.rotationDeg) *
        DEG_TO_RAD;
    const originAngleRad = (particle.originAngleDeg +
        burst.rotationDeg) *
        DEG_TO_RAD;
    const originRadius = particle.originRadiusScale *
        baseScale;
    const originX = Math.cos(originAngleRad) *
        originRadius;
    const originY = Math.sin(originAngleRad) *
        originRadius;
    const dragStrength = Math.max(0.05, particle.drag);
    const normalizedDrag = (1 -
        Math.exp(-dragStrength *
            progress *
            2.5)) /
        (1 -
            Math.exp(-dragStrength *
                2.5));
    const travelRadius = particle.radiusScale *
        baseScale *
        normalizedDrag;
    const tangentAngle = baseAngleRad +
        Math.PI /
            2;
    const tangentOffset = Math.sin(progress *
        Math.PI *
        2 +
        particle.swayFrequency) *
        particle.tangentCurlScale *
        baseScale *
        progress;
    const sway = Math.sin(progress *
        TWO_PI *
        particle.swayFrequency +
        particle.rotationDeg *
            DEG_TO_RAD) *
        particle.swayAmplitudeScale *
        baseScale *
        easeInOutSine(progress);
    const gravity = particle.gravityScale *
        size.height *
        progress *
        progress;
    const x = center.x +
        originX +
        Math.cos(baseAngleRad) *
            travelRadius +
        Math.cos(tangentAngle) *
            tangentOffset +
        sway;
    const y = center.y +
        originY +
        Math.sin(baseAngleRad) *
            travelRadius +
        Math.sin(tangentAngle) *
            tangentOffset +
        gravity;
    const fadeIn = smoothstep(0, 0.08, progress);
    const fadeOut = 1 -
        smoothstep(0.62, 1, progress);
    const baseAlpha = particle.alpha *
        fadeIn *
        fadeOut;
    const twinkle = particle.twinkle >
        0
        ? 0.72 +
            Math.sin(progress *
                TWO_PI *
                (3.5 +
                    particle.twinkle *
                        5) +
                particle.rotationDeg *
                    DEG_TO_RAD) *
                0.28 *
                particle.twinkle
        : 1;
    const strobe = particle.strobe >
        0
        ? (Math.sin(progress *
            TWO_PI *
            (8 +
                particle.strobe *
                    9) +
            particle.angleDeg *
                DEG_TO_RAD) >
            0.08
            ? 1
            : 0.12)
        : 1;
    const alpha = clamp01(baseAlpha *
        twinkle *
        strobe);
    const rotation = (particle.rotationDeg +
        particle.rotationSpeedDeg *
            progress) *
        DEG_TO_RAD;
    return {
        x,
        y,
        alpha,
        rotation,
        progress,
    } satisfies ParticlePoint;
}
function getPreviousParticlePoint(particle: FireworkParticlePlan, burst: FireworkBurstPlan, now: number, size: CanvasSize) {
    const history = Math.max(24, particle.durationMs *
        particle.trailLength);
    return getParticlePoint(particle, burst, now -
        history, size);
}
function drawRadialGlow(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number) {
    if (radius <=
        0 ||
        alpha <=
            0) {
        return;
    }
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, hexToRgba(color, alpha));
    gradient.addColorStop(0.35, hexToRgba(color, alpha *
        0.45));
    gradient.addColorStop(1, hexToRgba(color, 0));
    context.save();
    context.globalCompositeOperation =
        "lighter";
    context.fillStyle =
        gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, TWO_PI);
    context.fill();
    context.restore();
}
function drawSoftLine(context: CanvasRenderingContext2D, from: Point, to: Point, color: string, alpha: number, width: number, glow: number) {
    if (alpha <=
        0 ||
        width <=
            0) {
        return;
    }
    context.save();
    context.globalCompositeOperation =
        "lighter";
    context.globalAlpha =
        clamp01(alpha);
    context.strokeStyle =
        color;
    context.lineWidth =
        width;
    context.lineCap =
        "round";
    context.shadowColor =
        color;
    context.shadowBlur =
        Math.min(
            glow >
                1
                ? 9
                : 5,
            Math.max(
                0,
                width *
                    3.2 *
                    glow,
            ),
        );
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.restore();
}
function drawRoundSpark(
    context: CanvasRenderingContext2D,
    point: ParticlePoint,
    particle: FireworkParticlePlan,
    size: CanvasSize,
    sizeMultiplier = 1,
    glowMultiplier = 1,
) {
    const scale =
        getCanvasScale(
            size,
        );

    const effectiveGlow =
        particle.glow *
        glowMultiplier;

    const radius =
        Math.max(
            0.8,
            particle.sizeScale *
            sizeMultiplier *
            scale *
            (
                0.7 +
                point.alpha *
                    0.45
            ),
        );

    const mixed =
        mixHex(
            particle.colorA,
            particle.colorB,
            point.progress *
            0.42,
        );

    /*
     * 모든 작은 spark마다 radialGradient를 만들던 부분이
     * 가장 큰 GPU 부하 중 하나였다.
     *
     * 평범한 spark는 가벼운 halo 원으로 대체하고,
     * 최종 임팩트 / strobe / star처럼 정말 강한 빛이 필요한 것만
     * 고급 radial glow를 유지한다.
     */
    const keepPremiumGlow =
        particle.role ===
            "strobe" ||
        particle.role ===
            "star" ||
        particle.role ===
            "impact_shard" ||
        effectiveGlow >=
            0.92;

    if (
        keepPremiumGlow
    ) {
        drawRadialGlow(
            context,
            point.x,
            point.y,
            radius *
            (
                2.4 +
                effectiveGlow *
                    2
            ),
            mixed,
            point.alpha *
            0.2 *
            effectiveGlow,
        );
    } else if (
        point.alpha >
            0.18
    ) {
        context.save();

        context.globalCompositeOperation =
            "lighter";

        context.globalAlpha =
            point.alpha *
            0.12 *
            effectiveGlow;

        context.fillStyle =
            mixed;

        context.beginPath();

        context.arc(
            point.x,
            point.y,
            radius *
                2.1,
            0,
            TWO_PI,
        );

        context.fill();

        context.restore();
    }

    context.save();

    context.globalCompositeOperation =
        "lighter";

    context.globalAlpha =
        point.alpha;

    context.fillStyle =
        mixed;

    if (
        keepPremiumGlow
    ) {
        context.shadowColor =
            mixed;

        context.shadowBlur =
            Math.min(
                6,
                radius *
                (
                    1 +
                    effectiveGlow *
                        1.2
                ),
            );
    } else {
        context.shadowBlur =
            0;
    }

    context.beginPath();

    context.arc(
        point.x,
        point.y,
        radius,
        0,
        TWO_PI,
    );

    context.fill();

    context.restore();
}
function drawPetalSpark(context: CanvasRenderingContext2D, point: ParticlePoint, particle: FireworkParticlePlan, size: CanvasSize) {
    const scale = getCanvasScale(size);
    const width = Math.max(1.2, particle.sizeScale *
        scale *
        0.65);
    const height = width *
        2.6;
    const color = mixHex(particle.colorA, particle.colorB, point.progress *
        0.38);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(point.rotation);
    context.globalCompositeOperation =
        "lighter";
    context.globalAlpha =
        point.alpha;
    context.fillStyle =
        color;
    context.shadowColor =
        color;
    context.shadowBlur =
        Math.min(
            7,
            width *
                (
                    1.8 +
                    particle.glow *
                        2.1
                ),
        );
    context.beginPath();
    context.ellipse(0, 0, width, height, 0, 0, TWO_PI);
    context.fill();
    context.restore();
}
function drawStarSpark(context: CanvasRenderingContext2D, point: ParticlePoint, particle: FireworkParticlePlan, size: CanvasSize) {
    const scale = getCanvasScale(size);
    const radius = Math.max(1.3, particle.sizeScale *
        scale *
        1.2);
    const color = mixHex(particle.colorA, particle.colorB, point.progress *
        0.3);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(point.rotation);
    context.globalCompositeOperation =
        "lighter";
    context.globalAlpha =
        point.alpha;
    context.strokeStyle =
        color;
    context.lineWidth =
        Math.max(0.8, radius *
            0.34);
    context.lineCap =
        "round";
    context.shadowColor =
        color;
    context.shadowBlur =
        Math.min(
            7,
            radius *
                1.8,
        );
    context.beginPath();
    context.moveTo(-radius, 0);
    context.lineTo(radius, 0);
    context.moveTo(0, -radius);
    context.lineTo(0, radius);
    context.stroke();
    context.restore();
}
function drawWillowSpark(context: CanvasRenderingContext2D, point: ParticlePoint, previous: ParticlePoint | null, particle: FireworkParticlePlan, size: CanvasSize) {
    const scale = getCanvasScale(size);
    const width = Math.max(0.7, particle.trailWidthScale *
        scale *
        1.6);
    const color = mixHex(particle.colorA, particle.colorB, point.progress *
        0.48);
    if (previous) {
        drawSoftLine(context, previous, point, color, point.alpha *
            0.92, width, particle.glow);
    }
    if (
        point.progress <
        0.82
    ) {
        /*
         * 기존에는 매 파티클 / 매 프레임마다 {...particle} 객체를 새로 만들었다.
         * multiplier 인자로 같은 비주얼을 유지하면서 GC 압박을 제거한다.
         */
        drawRoundSpark(
            context,
            point,
            particle,
            size,
            0.82,
            0.72,
        );
    }
}

function drawImpactShardParticle(
    context: CanvasRenderingContext2D,
    point: ParticlePoint,
    previous: ParticlePoint | null,
    particle: FireworkParticlePlan,
    size: CanvasSize,
) {
    const scale =
        getCanvasScale(
            size,
        );

    const color =
        mixHex(
            particle.colorA,
            particle.colorB,
            point.progress *
                0.32,
        );

    const length =
        scale *
        (
            0.012 +
            particle.sizeScale *
                3.2
        ) *
        (
            1 -
            point.progress *
                0.45
        );

    const angle =
        particle.angleDeg *
        DEG_TO_RAD;

    const from =
        previous ??
        {
            x:
                point.x -
                Math.cos(
                    angle,
                ) *
                    length,
            y:
                point.y -
                Math.sin(
                    angle,
                ) *
                    length,
        };

    drawSoftLine(
        context,
        from,
        point,
        color,
        point.alpha *
            0.94,
        Math.max(
            0.9,
            particle.trailWidthScale *
            scale *
            1.7,
        ),
        1.2,
    );

    drawRadialGlow(
        context,
        point.x,
        point.y,
        Math.max(
            4,
            scale *
            0.015,
        ),
        color,
        point.alpha *
            0.22,
    );
}

function drawParticle(context: CanvasRenderingContext2D, particle: FireworkParticlePlan, burst: FireworkBurstPlan, now: number, size: CanvasSize) {
    const point = getParticlePoint(particle, burst, now, size);
    if (!point ||
        point.alpha <=
            0.002) {
        return;
    }
    const keepsTrail =
        particle.role ===
            "willow" ||
        particle.role ===
            "impact_shard" ||
        particle.role ===
            "petal" ||
        particle.role ===
            "crossette_child";

    const previous =
        keepsTrail &&
        particle.trailLength >
            0.001
            ? getPreviousParticlePoint(
                particle,
                burst,
                now,
                size,
            )
            : null;

    if (
        previous
    ) {
        const trailColor =
            particle.colorA;

        const trailWidth =
            Math.max(
                0.5,
                particle.trailWidthScale *
                getCanvasScale(
                    size,
                ),
            );

        drawSoftLine(
            context,
            previous,
            point,
            trailColor,
            point.alpha *
            (
                particle.role ===
                    "willow"
                    ? 0.78
                    : 0.46
            ),
            trailWidth,
            particle.glow *
                0.8,
        );
    }
    switch (particle.role) {
        case "petal":
            drawPetalSpark(context, point, particle, size);
            break;
        case "willow":
            drawWillowSpark(context, point, previous, particle, size);
            break;
        case "star":
            drawStarSpark(context, point, particle, size);
            break;
        case "strobe":
            drawRoundSpark(
                context,
                point,
                particle,
                size,
                1.08,
                1.2,
            );
            break;

        case "crossette_child":
            drawRoundSpark(
                context,
                point,
                particle,
                size,
                1,
                1.08,
            );
            break;
        case "impact_shard":
            drawImpactShardParticle(
                context,
                point,
                previous,
                particle,
                size,
            );
            break;
        case "ember":
        case "spark":
        default:
            drawRoundSpark(context, point, particle, size);
            break;
    }
}
function getBurstLocalProgress(burst: FireworkBurstPlan, now: number) {
    return (now -
        burst.at) /
        burst.durationMs;
}
function drawBurstAtmosphere(context: CanvasRenderingContext2D, burst: FireworkBurstPlan, now: number, size: CanvasSize) {
    const progress = getBurstLocalProgress(burst, now);
    if (progress <
        -0.04 ||
        progress >
            1.1) {
        return;
    }
    const safe = clamp01(progress);
    const center = getBurstCenter(burst, size);
    const scale = getCanvasScale(size);
    const flashEnvelope = smoothstep(0, 0.06, safe) *
        (1 -
            smoothstep(0.18, 0.6, safe));
    const bloomEnvelope = smoothstep(0, 0.12, safe) *
        (1 -
            smoothstep(0.28, 0.95, safe));
    const flashRadius = scale *
        burst.radiusScale *
        (0.08 +
            easeOutCubic(safe) *
                0.42);
    const bloomRadius = scale *
        burst.radiusScale *
        (0.22 +
            easeOutCubic(safe) *
                1.2);
    drawRadialGlow(context, center.x, center.y, flashRadius, burst.palette.core, flashEnvelope *
        burst.coreStrength *
        0.6);
    drawRadialGlow(context, center.x, center.y, bloomRadius, burst.palette.primary, bloomEnvelope *
        burst.haloStrength *
        0.18 *
        burst.romanticBloom);
    if (burst.kind ===
        "sakura" ||
        burst.kind ===
            "heart" ||
        burst.kind ===
            "dahlia") {
        drawRadialGlow(context, center.x, center.y, bloomRadius *
            0.78, burst.palette.secondary, bloomEnvelope *
            0.13 *
            burst.romanticBloom);
    }
}
function drawBurst(context: CanvasRenderingContext2D, burst: FireworkBurstPlan, now: number, size: CanvasSize) {
    if (now <
        burst.at -
            80 ||
        now >
            burst.at +
                burst.durationMs +
                160) {
        return;
    }
    drawBurstAtmosphere(context, burst, now, size);
    for (const particle of burst.particles) {
        drawParticle(context, particle, burst, now, size);
    }
}
function drawRocketSmoke(context: CanvasRenderingContext2D, rocket: FireworkRocketPlan, progress: number, size: CanvasSize) {
    if (progress <=
        0 ||
        progress >=
            1) {
        return;
    }
    const scale = getCanvasScale(size);
    const puffCount = 5;
    for (let index = 0; index <
        puffCount; index +=
        1) {
        const history = clamp01(progress -
            index *
                0.055);
        const point = getRocketPoint(rocket, history, size);
        const radius = scale *
            (0.004 +
                index *
                    0.0016);
        const alpha = (1 -
            index /
                puffCount) *
            rocket.smokeStrength *
            0.08 *
            (1 -
                progress *
                    0.5);
        drawRadialGlow(context, point.x, point.y, radius *
            2.4, "#f0e8dd", alpha);
    }
}
function drawRocketTrail(context: CanvasRenderingContext2D, rocket: FireworkRocketPlan, progress: number, size: CanvasSize) {
    const current = getRocketPoint(rocket, progress, size);
    const segments = 6;
    const scale = getCanvasScale(size);
    for (let index = 0; index <
        segments; index +=
        1) {
        const fromProgress = clamp01(progress -
            (index +
                1) *
                0.018);
        const toProgress = clamp01(progress -
            index *
                0.018);
        const from = getRocketPoint(rocket, fromProgress, size);
        const to = getRocketPoint(rocket, toProgress, size);
        const alpha = (1 -
            index /
                segments) *
            0.7;
        drawSoftLine(context, from, to, rocket.color, alpha, Math.max(0.8, rocket.trailWidthScale *
            scale *
            (1 -
                index /
                    segments *
                    0.55)), 0.8);
    }
    drawRadialGlow(context, current.x, current.y, scale *
        0.014, rocket.color, 0.52);
    context.save();
    context.globalCompositeOperation =
        "lighter";
    context.fillStyle =
        "#ffffff";
    context.globalAlpha =
        0.9;
    context.beginPath();
    context.arc(current.x, current.y, Math.max(1.5, scale *
        0.0032), 0, TWO_PI);
    context.fill();
    context.restore();
}
function drawRocket(context: CanvasRenderingContext2D, rocket: FireworkRocketPlan, now: number, size: CanvasSize) {
    if (now <
        rocket.launchAt ||
        now >
            rocket.burstAt) {
        return;
    }
    const progress = clamp01((now -
        rocket.launchAt) /
        Math.max(1, rocket.burstAt -
            rocket.launchAt));
    drawRocketSmoke(context, rocket, progress, size);
    drawRocketTrail(context, rocket, progress, size);
}
function drawFestivalBokeh(context: CanvasRenderingContext2D, scene: FireworksScene, now: number, session: HooWorldFireworksSession, size: CanvasSize) {
    const showProgress = clamp01((now -
        session.fuseEndsAt) /
        Math.max(1, session.glitterEndsAt -
            session.fuseEndsAt));
    const showEnvelope = smoothstep(0, 0.08, showProgress) *
        (1 -
            smoothstep(0.82, 1, showProgress));
    if (showEnvelope <=
        0) {
        return;
    }
    const scale = getCanvasScale(size);
    for (const bokeh of scene.bokeh) {
        const flicker = 0.72 +
            Math.sin(now *
                0.0012 +
                bokeh.phase) *
                0.28;
        drawRadialGlow(context, bokeh.x *
            size.width, bokeh.y *
            size.height, bokeh.radiusScale *
            scale *
            5.5, bokeh.color, bokeh.alpha *
            flicker *
            showEnvelope);
    }
}
function drawActiveSkyWash(context: CanvasRenderingContext2D, now: number, session: HooWorldFireworksSession, size: CanvasSize) {
    const start = session.fuseEndsAt -
        300;
    const end = session.glitterEndsAt;
    const progress = clamp01((now -
        start) /
        Math.max(1, end -
            start));
    const envelope = smoothstep(0, 0.05, progress) *
        (1 -
            smoothstep(0.88, 1, progress));
    if (envelope <=
        0) {
        return;
    }
    const gradient = context.createLinearGradient(0, 0, 0, size.height);
    gradient.addColorStop(0, ACTIVE_SKY_TOP);
    gradient.addColorStop(0.48, ACTIVE_SKY_MIDDLE);
    gradient.addColorStop(1, ACTIVE_SKY_BOTTOM);
    context.save();
    context.globalCompositeOperation =
        "source-over";
    context.globalAlpha =
        envelope;
    context.fillStyle =
        gradient;
    context.fillRect(0, 0, size.width, size.height);
    context.restore();
}
function drawPearlCrossFlares(context: CanvasRenderingContext2D, scene: FireworksScene, now: number, size: CanvasSize) {
    const scale = getCanvasScale(size);
    for (let index = 0; index <
        scene.bursts.length; index +=
        1) {
        if (index %
            3 !==
            0) {
            continue;
        }
        const burst = scene.bursts[index];
        const progress = (now -
            burst.at) /
            950;
        if (progress <
            0 ||
            progress >
                1) {
            continue;
        }
        const envelope = smoothstep(0, 0.08, progress) *
            (1 -
                smoothstep(0.3, 1, progress));
        if (envelope <=
            0) {
            continue;
        }
        const center = getBurstCenter(burst, size);
        const length = scale *
            burst.radiusScale *
            (0.12 +
                easeOutCubic(progress) *
                    0.34);
        const color = mixHex(burst.palette.core, burst.palette.primary, 0.18);
        const horizontal = {
            x: center.x -
                length,
            y: center.y,
        };
        const horizontalEnd = {
            x: center.x +
                length,
            y: center.y,
        };
        const vertical = {
            x: center.x,
            y: center.y -
                length *
                    0.72,
        };
        const verticalEnd = {
            x: center.x,
            y: center.y +
                length *
                    0.72,
        };
        drawSoftLine(context, horizontal, horizontalEnd, color, envelope *
            0.32, Math.max(0.5, scale *
            0.0008), 1);
        drawSoftLine(context, vertical, verticalEnd, color, envelope *
            0.28, Math.max(0.5, scale *
            0.00072), 1);
        drawRadialGlow(context, center.x, center.y, scale *
            burst.radiusScale *
            0.18, color, envelope *
            0.14);
    }
}
function drawFinaleHaloRings(context: CanvasRenderingContext2D, now: number, session: HooWorldFireworksSession, size: CanvasSize) {
    const start = session.fireworksEndsAt -
        420;
    const duration = 2300;
    const progress = (now -
        start) /
        duration;
    if (progress <
        0 ||
        progress >
            1) {
        return;
    }
    const envelope = smoothstep(0, 0.08, progress) *
        (1 -
            smoothstep(0.42, 1, progress));
    const centerX = clamp(session.x /
        100 *
        size.width, size.width *
        0.28, size.width *
        0.72);
    const centerY = size.height *
        0.17;
    const scale = getCanvasScale(size);
    const colors = [
        "#fff8e7",
        "#ffd9e8",
        "#e6dcff",
    ];
    for (let ring = 0; ring <
        colors.length; ring +=
        1) {
        const stagger = ring *
            0.08;
        const local = clamp01((progress -
            stagger) /
            (1 -
                stagger));
        const radius = scale *
            (0.035 +
                ring *
                    0.018 +
                easeOutQuart(local) *
                    (0.16 +
                        ring *
                            0.045));
        const alpha = envelope *
            (0.24 -
                ring *
                    0.045);
        context.save();
        context.globalCompositeOperation =
            "lighter";
        context.globalAlpha =
            alpha;
        context.strokeStyle =
            colors[ring];
        context.lineWidth =
            Math.max(0.7, scale *
                (0.0012 -
                    ring *
                        0.00016));
        context.shadowColor =
            colors[ring];
        context.shadowBlur =
            scale *
                0.018;
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, TWO_PI);
        context.stroke();
        context.restore();
    }
}
function drawFinaleSoftFlash(context: CanvasRenderingContext2D, now: number, session: HooWorldFireworksSession, size: CanvasSize) {
    const start = session.fireworksEndsAt -
        850;
    const progress = (now -
        start) /
        1700;
    if (progress <
        0 ||
        progress >
            1) {
        return;
    }
    const envelope = smoothstep(0, 0.08, progress) *
        (1 -
            smoothstep(0.22, 1, progress));
    const centerX = clamp(session.x /
        100 *
        size.width, size.width *
        0.3, size.width *
        0.7);
    const centerY = size.height *
        0.18;
    const radius = getCanvasScale(size) *
        (0.12 +
            easeOutQuart(progress) *
                0.42);
    drawRadialGlow(context, centerX, centerY, radius, "#fff5df", envelope *
        0.28);
    drawRadialGlow(context, centerX, centerY, radius *
        0.78, "#ffd7e8", envelope *
        0.12);
}
function drawGlitter(context: CanvasRenderingContext2D, scene: FireworksScene, now: number, session: HooWorldFireworksSession, size: CanvasSize) {
    if (now <
        session.finaleEndsAt ||
        now >
            session.glitterEndsAt) {
        return;
    }
    const globalProgress = clamp01((now -
        session.finaleEndsAt) /
        Math.max(1, session.glitterEndsAt -
            session.finaleEndsAt));
    const globalEnvelope = smoothstep(0, 0.04, globalProgress) *
        (1 -
            smoothstep(0.9, 1, globalProgress));
    const scale = getCanvasScale(size);
    for (
        let glitterIndex =
            0;
        glitterIndex <
            scene.glitter.length;
        glitterIndex +=
            1
    ) {
        const glitter =
            scene.glitter[
                glitterIndex
            ];
        const localTime = (now -
            session.finaleEndsAt +
            glitter.phase *
                1000) %
            glitter.durationMs;
        const progress = localTime /
            glitter.durationMs;
        const twinkle = 0.55 +
            Math.sin(progress *
                TWO_PI *
                (2.5 +
                    glitter.twinkle *
                        4) +
                glitter.phase) *
                0.45;
        const x = (glitter.x +
            glitter.driftXScale *
                Math.sin(progress *
                    TWO_PI +
                    glitter.phase)) *
            size.width;
        const y = (glitter.y +
            glitter.driftYScale *
                progress) *
            size.height;
        const alpha = globalEnvelope *
            (0.2 +
                0.8 *
                    clamp01(twinkle)) *
            (1 -
                smoothstep(0.76, 1, progress));
        const radius = Math.max(0.8, glitter.sizeScale *
            scale);
        if (
            glitterIndex %
                4 ===
            0
        ) {
            drawRadialGlow(
                context,
                x,
                y,
                radius *
                    3.5,
                glitter.color,
                alpha *
                    0.16,
            );
        }
        context.save();
        context.globalCompositeOperation =
            "lighter";
        context.globalAlpha =
            alpha;
        context.fillStyle =
            glitter.color;
        context.beginPath();
        context.arc(x, y, radius, 0, TWO_PI);
        context.fill();
        context.restore();
    }
}
function drawFuse(
    context: CanvasRenderingContext2D,
    now: number,
    session: HooWorldFireworksSession,
    size: CanvasSize,
) {
    if (
        now <
            session.startedAt ||
        now >
            session.fuseEndsAt
    ) {
        return;
    }

    /*
     * ───────────────────────────────────────────────────────────────────────
     * HOO HANABI 가방 점화
     * ───────────────────────────────────────────────────────────────────────
     *
     * 기존의 갈색 네모 발사대를 완전히 제거한다.
     *
     * 공용 fireworks session의 startedAt / fuseEndsAt을 그대로 사용하므로
     * 점화한 이용자뿐 아니라 다른 이용자 / 중간 입장자도
     * 같은 위치와 같은 진행률로 가방 점화를 본다.
     *
     * 흐름:
     * HOO HANABI 가방 → 밑에서 치지지직 → 가방 팽창
     * → 마지막 순간 "뿅" 소멸 → 본 불꽃놀이 시작
     */

    const progress =
        clamp01(
            (
                now -
                session.startedAt
            ) /
                Math.max(
                    1,
                    session.fuseEndsAt -
                        session.startedAt,
                ),
        );

    const x =
        session.x /
        100 *
        size.width;

    const y =
        session.y /
        100 *
        size.height;

    const scale =
        getCanvasScale(
            size,
        );

    /*
     * 마지막 14%는 가방이 빠르게 부풀었다가 뿅 사라지는 구간.
     */
    const popStartProgress =
        0.86;

    const popProgress =
        clamp01(
            (
                progress -
                popStartProgress
            ) /
                (
                    1 -
                    popStartProgress
                ),
        );

    const prePopProgress =
        clamp01(
            progress /
                popStartProgress,
        );

    /*
     * 점화되는 동안 서서히 커지고,
     * 마지막 14%에서는 순간적으로 한 번 더 팽창한다.
     */
    const bagScale =
        1 +
        easeOutCubic(
            prePopProgress,
        ) *
            0.11 +
        easeOutCubic(
            popProgress,
        ) *
            0.17;

    const bagAlpha =
        1 -
        easeOutCubic(
            popProgress,
        );

    /*
     * DOM 버전 HOO HANABI 가방과 비슷한 비율.
     * Canvas에서는 실제 화면 크기에 맞춰 자동 스케일된다.
     */
    const bagWidth =
        scale *
        0.082 *
        bagScale;

    const bagHeight =
        scale *
        0.049 *
        bagScale;

    const bagLeft =
        x -
        bagWidth /
            2;

    const bagTop =
        y -
        bagHeight;

    /*
     * 불꽃은 가방 아래에서 직접 시작한다.
     */
    const flameCenterY =
        y -
        scale *
            0.002;

    const flamePulse =
        0.82 +
        (
            Math.sin(
                now *
                    0.026,
            ) +
            1
        ) *
            0.16;

    const heatRadius =
        scale *
        (
            0.025 +
            prePopProgress *
                0.009
        );

    drawRadialGlow(
        context,
        x,
        flameCenterY,
        heatRadius,
        "#ff9f52",
        (
            0.24 +
            prePopProgress *
                0.22
        ) *
            (
                1 -
                popProgress
            ),
    );

    /*
     * 작은 불꽃 5개.
     * 무거운 파티클 시스템 대신 단순 path만 사용해
     * 노트북 최적화 버전의 성능 기조를 유지한다.
     */
    const flameOffsets = [
        -0.028,
        -0.014,
        0,
        0.015,
        0.029,
    ] as const;

    for (
        let flameIndex = 0;
        flameIndex <
        flameOffsets.length;
        flameIndex +=
            1
    ) {
        const flameOffset =
            flameOffsets[
                flameIndex
            ];

        const phase =
            now *
                (
                    0.018 +
                    flameIndex *
                        0.0017
                ) +
            flameIndex *
                1.8;

        const flameHeight =
            scale *
            (
                0.012 +
                (
                    flameIndex %
                        2 ===
                    0
                        ? 0.004
                        : 0.007
                ) +
                (
                    Math.sin(
                        phase,
                    ) +
                    1
                ) *
                    0.0025
            ) *
            flamePulse;

        const flameWidth =
            scale *
            (
                0.0075 +
                (
                    flameIndex %
                        2
                ) *
                    0.0015
            );

        const flameX =
            x +
            flameOffset *
                scale;

        context.save();

        context.globalCompositeOperation =
            "lighter";

        context.globalAlpha =
            (
                0.76 +
                prePopProgress *
                    0.2
            ) *
            (
                1 -
                popProgress
            );

        const flameGradient =
            context.createLinearGradient(
                flameX,
                flameCenterY,
                flameX,
                flameCenterY -
                    flameHeight,
            );

        flameGradient.addColorStop(
            0,
            "#ff6438",
        );

        flameGradient.addColorStop(
            0.52,
            "#ffb454",
        );

        flameGradient.addColorStop(
            1,
            "#fff2ba",
        );

        context.fillStyle =
            flameGradient;

        context.beginPath();

        context.moveTo(
            flameX -
                flameWidth /
                    2,
            flameCenterY,
        );

        context.quadraticCurveTo(
            flameX -
                flameWidth *
                    0.7,
            flameCenterY -
                flameHeight *
                    0.52,
            flameX,
            flameCenterY -
                flameHeight,
        );

        context.quadraticCurveTo(
            flameX +
                flameWidth *
                    0.7,
            flameCenterY -
                flameHeight *
                    0.52,
            flameX +
                flameWidth /
                    2,
            flameCenterY,
        );

        context.closePath();

        context.fill();

        context.restore();
    }

    /*
     * "치지지직" 스파크.
     * 위치를 시간 + index로 결정해서 모든 클라이언트가 거의 동일한
     * 리듬으로 보이면서도 별도 React state가 필요 없다.
     */
    const sparkCount =
        9;

    for (
        let index = 0;
        index <
        sparkCount;
        index +=
            1
    ) {
        const phase =
            (
                progress *
                    8 +
                index /
                    sparkCount
            ) %
            1;

        const side =
            index %
                2 ===
            0
                ? -1
                : 1;

        const sparkX =
            x +
            side *
                scale *
                (
                    0.006 +
                    phase *
                        0.022
                ) +
            Math.sin(
                index *
                    2.13,
            ) *
                scale *
                0.004;

        const sparkY =
            y -
            scale *
                (
                    0.004 +
                    phase *
                        0.031
                );

        const sparkAlpha =
            (
                1 -
                phase
            ) *
            (
                1 -
                popProgress
            );

        const sparkRadius =
            Math.max(
                0.7,
                scale *
                    0.0017 *
                    (
                        1 -
                        phase *
                            0.5
                    ),
            );

        context.save();

        context.globalCompositeOperation =
            "lighter";

        context.globalAlpha =
            sparkAlpha;

        context.fillStyle =
            index %
                3 ===
            0
                ? "#ffffff"
                : index %
                      3 ===
                  1
                    ? "#fff0a8"
                    : "#ffbf65";

        context.beginPath();

        context.arc(
            sparkX,
            sparkY,
            sparkRadius,
            0,
            TWO_PI,
        );

        context.fill();

        context.restore();
    }

    /*
     * 아주 약한 연기.
     */
    for (
        let smokeIndex = 0;
        smokeIndex <
        3;
        smokeIndex +=
            1
    ) {
        const smokePhase =
            (
                progress *
                    2.8 +
                smokeIndex *
                    0.31
            ) %
            1;

        const smokeX =
            x +
            (
                smokeIndex -
                1
            ) *
                scale *
                0.012 +
            Math.sin(
                smokePhase *
                    Math.PI,
            ) *
                scale *
                0.006;

        const smokeY =
            y -
            scale *
                (
                    0.01 +
                    smokePhase *
                        0.038
                );

        const smokeRadius =
            scale *
            (
                0.006 +
                smokePhase *
                    0.006
            );

        context.save();

        context.globalAlpha =
            (
                1 -
                smokePhase
            ) *
            0.13 *
            (
                1 -
                popProgress
            );

        context.fillStyle =
            "#d8d6dd";

        context.beginPath();

        context.arc(
            smokeX,
            smokeY,
            smokeRadius,
            0,
            TWO_PI,
        );

        context.fill();

        context.restore();
    }

    /*
     * 가방 본체.
     * 모든 부품을 동일한 transform 안에서 그려서
     * "가방 전체가 부풀어 오른다"는 느낌을 만든다.
     */
    context.save();

    context.globalAlpha =
        bagAlpha;

    context.translate(
        x,
        y,
    );

    /*
     * 부풀어 오르는 동안 너무 기계적으로 보이지 않게
     * 1px 미만의 가벼운 떨림을 준다.
     */
    const shakeStrength =
        prePopProgress *
        scale *
        0.0018;

    context.translate(
        Math.sin(
            now *
                0.09,
        ) *
            shakeStrength,
        Math.cos(
            now *
                0.075,
        ) *
            shakeStrength *
            0.55,
    );

    context.translate(
        -x,
        -y,
    );

    /*
     * 열린 뒷판.
     */
    const lidHeight =
        bagHeight *
        0.62;

    const lidTop =
        bagTop -
        lidHeight *
            0.52;

    const lidGradient =
        context.createLinearGradient(
            x,
            lidTop,
            x,
            lidTop +
                lidHeight,
        );

    lidGradient.addColorStop(
        0,
        "#363a59",
    );

    lidGradient.addColorStop(
        0.48,
        "#272c49",
    );

    lidGradient.addColorStop(
        1,
        "#171c34",
    );

    context.fillStyle =
        lidGradient;

    context.strokeStyle =
        "rgba(13,17,34,0.86)";

    context.lineWidth =
        Math.max(
            1,
            scale *
                0.0012,
        );

    context.beginPath();

    context.roundRect(
        bagLeft +
            bagWidth *
                0.06,
        lidTop,
        bagWidth *
            0.88,
        lidHeight,
        Math.max(
            3,
            scale *
                0.005,
        ),
    );

    context.fill();

    context.stroke();

    /*
     * 뒷판 금박 장식.
     */
    context.save();

    context.strokeStyle =
        "rgba(231,201,117,0.72)";

    context.lineWidth =
        Math.max(
            0.8,
            scale *
                0.0009,
        );

    const ornamentRadius =
        scale *
        0.005;

    const ornamentY =
        lidTop +
        lidHeight *
            0.45;

    for (
        const ornamentSide of
        [
            -1,
            1,
        ] as const
    ) {
        const ornamentX =
            x +
            ornamentSide *
                bagWidth *
                0.31;

        context.beginPath();

        context.arc(
            ornamentX,
            ornamentY,
            ornamentRadius,
            0,
            TWO_PI,
        );

        context.stroke();

        for (
            let ray = 0;
            ray <
            4;
            ray +=
                1
        ) {
            const angle =
                ray *
                Math.PI /
                2;

            context.beginPath();

            context.moveTo(
                ornamentX +
                    Math.cos(
                        angle,
                    ) *
                        ornamentRadius *
                        1.3,
                ornamentY +
                    Math.sin(
                        angle,
                    ) *
                        ornamentRadius *
                        1.3,
            );

            context.lineTo(
                ornamentX +
                    Math.cos(
                        angle,
                    ) *
                        ornamentRadius *
                        2,
                ornamentY +
                    Math.sin(
                        angle,
                    ) *
                        ornamentRadius *
                        2,
            );

            context.stroke();
        }
    }

    context.restore();

    /*
     * 가방 안의 로켓 4발.
     */
    const rocketData = [
        {
            offsetX:
                -0.3,
            extraTop:
                0.05,
            color:
                "#d6535f",
            stripe:
                "#f5d78a",
        },
        {
            offsetX:
                -0.1,
            extraTop:
                -0.08,
            color:
                "#6f7fd8",
            stripe:
                "#f0d6ff",
        },
        {
            offsetX:
                0.1,
            extraTop:
                -0.03,
            color:
                "#db9c47",
            stripe:
                "#fff0a8",
        },
        {
            offsetX:
                0.3,
            extraTop:
                0.08,
            color:
                "#5e9f88",
            stripe:
                "#d9fff3",
        },
    ] as const;

    for (
        let rocketIndex = 0;
        rocketIndex <
        rocketData.length;
        rocketIndex +=
            1
    ) {
        const rocket =
            rocketData[
                rocketIndex
            ];

        const rocketX =
            x +
            bagWidth *
                rocket.offsetX;

        const rocketBottom =
            bagTop +
            bagHeight *
                0.36;

        const rocketHeight =
            bagHeight *
            1.05;

        const rocketTop =
            rocketBottom -
            rocketHeight +
            bagHeight *
                rocket.extraTop;

        const rocketWidth =
            bagWidth *
            0.105;

        /*
         * 막대.
         */
        context.strokeStyle =
            "#b88b5d";

        context.lineWidth =
            Math.max(
                1,
                rocketWidth *
                    0.18,
            );

        context.beginPath();

        context.moveTo(
            rocketX,
            rocketBottom -
                rocketHeight *
                    0.12,
        );

        context.lineTo(
            rocketX,
            rocketBottom +
                bagHeight *
                    0.18,
        );

        context.stroke();

        /*
         * 몸통.
         */
        context.fillStyle =
            rocket.color;

        context.strokeStyle =
            "rgba(15,18,30,0.28)";

        context.lineWidth =
            Math.max(
                0.7,
                scale *
                    0.0007,
            );

        context.beginPath();

        context.roundRect(
            rocketX -
                rocketWidth /
                    2,
            rocketTop +
                rocketHeight *
                    0.23,
            rocketWidth,
            rocketHeight *
                0.54,
            Math.max(
                1,
                rocketWidth *
                    0.2,
            ),
        );

        context.fill();

        context.stroke();

        /*
         * 로켓 띠.
         */
        context.fillStyle =
            rocket.stripe;

        context.fillRect(
            rocketX -
                rocketWidth /
                    2,
            rocketTop +
                rocketHeight *
                    0.47,
            rocketWidth,
            Math.max(
                1,
                rocketHeight *
                    0.08,
            ),
        );

        /*
         * 삼각 머리.
         */
        context.beginPath();

        context.moveTo(
            rocketX,
            rocketTop,
        );

        context.lineTo(
            rocketX +
                rocketWidth *
                    0.62,
            rocketTop +
                rocketHeight *
                    0.25,
        );

        context.lineTo(
            rocketX -
                rocketWidth *
                    0.62,
            rocketTop +
                rocketHeight *
                    0.25,
        );

        context.closePath();

        context.fillStyle =
            rocket.stripe;

        context.fill();
    }

    /*
     * 메인 가방 몸통.
     */
    const bodyGradient =
        context.createLinearGradient(
            x,
            bagTop,
            x,
            y,
        );

    bodyGradient.addColorStop(
        0,
        "#313750",
    );

    bodyGradient.addColorStop(
        0.55,
        "#232840",
    );

    bodyGradient.addColorStop(
        1,
        "#161b31",
    );

    context.fillStyle =
        bodyGradient;

    context.strokeStyle =
        "rgba(12,16,32,0.88)";

    context.lineWidth =
        Math.max(
            1,
            scale *
                0.0012,
        );

    context.beginPath();

    context.roundRect(
        bagLeft,
        bagTop,
        bagWidth,
        bagHeight,
        Math.max(
            4,
            scale *
                0.006,
        ),
    );

    context.fill();

    context.stroke();

    /*
     * 붉은 축제 띠.
     */
    const strapWidth =
        bagWidth *
        0.085;

    context.fillStyle =
        "#9f2f3e";

    context.fillRect(
        bagLeft +
            bagWidth *
                0.105,
        bagTop,
        strapWidth,
        bagHeight,
    );

    context.fillRect(
        bagLeft +
            bagWidth *
                0.81,
        bagTop,
        strapWidth,
        bagHeight,
    );

    /*
     * 금색 모서리.
     */
    context.strokeStyle =
        "rgba(227,199,119,0.5)";

    context.lineWidth =
        Math.max(
            0.8,
            scale *
                0.0008,
        );

    context.beginPath();

    context.moveTo(
        bagLeft +
            bagWidth *
                0.055,
        bagTop +
            bagHeight *
                0.13,
    );

    context.lineTo(
        bagLeft +
            bagWidth *
                0.055,
        y -
            bagHeight *
                0.13,
    );

    context.moveTo(
        bagLeft +
            bagWidth *
                0.945,
        bagTop +
            bagHeight *
                0.13,
    );

    context.lineTo(
        bagLeft +
            bagWidth *
                0.945,
        y -
            bagHeight *
                0.13,
    );

    context.stroke();

    /*
     * 중앙 HOO / HANABI 라벨.
     */
    const labelWidth =
        bagWidth *
        0.58;

    const labelHeight =
        bagHeight *
        0.46;

    const labelLeft =
        x -
        labelWidth /
            2;

    const labelTop =
        bagTop +
        bagHeight *
            0.24;

    context.fillStyle =
        "rgba(18,22,40,0.96)";

    context.strokeStyle =
        "rgba(230,200,117,0.72)";

    context.lineWidth =
        Math.max(
            0.8,
            scale *
                0.0008,
        );

    context.beginPath();

    context.roundRect(
        labelLeft,
        labelTop,
        labelWidth,
        labelHeight,
        Math.max(
            2,
            scale *
                0.0025,
        ),
    );

    context.fill();

    context.stroke();

    context.textAlign =
        "center";

    context.textBaseline =
        "middle";

    context.font =
        `900 ${Math.max(
            5,
            scale *
                0.008,
        )}px system-ui, sans-serif`;

    context.fillStyle =
        "#f4dda0";

    context.fillText(
        "HOO",
        x,
        labelTop +
            labelHeight *
                0.36,
    );

    context.font =
        `900 ${Math.max(
            3,
            scale *
                0.0043,
        )}px system-ui, sans-serif`;

    context.fillStyle =
        "#e7858e";

    context.fillText(
        "HANABI",
        x,
        labelTop +
            labelHeight *
                0.72,
    );

    /*
     * 금색 잠금 장치.
     */
    const lockWidth =
        bagWidth *
        0.18;

    const lockHeight =
        bagHeight *
        0.17;

    const lockX =
        x -
        lockWidth /
            2;

    const lockY =
        y -
        lockHeight *
            0.55;

    const lockGradient =
        context.createLinearGradient(
            x,
            lockY,
            x,
            lockY +
                lockHeight,
        );

    lockGradient.addColorStop(
        0,
        "#f1d885",
    );

    lockGradient.addColorStop(
        1,
        "#a67b33",
    );

    context.fillStyle =
        lockGradient;

    context.strokeStyle =
        "rgba(100,75,32,0.68)";

    context.beginPath();

    context.roundRect(
        lockX,
        lockY,
        lockWidth,
        lockHeight,
        Math.max(
            1,
            scale *
                0.0018,
        ),
    );

    context.fill();

    context.stroke();

    /*
     * 심지.
     */
    const fuseStartX =
        bagLeft +
        bagWidth *
            0.9;

    const fuseStartY =
        bagTop +
        bagHeight *
            0.55;

    const fuseEndX =
        fuseStartX +
        scale *
            0.012;

    const fuseEndY =
        fuseStartY -
        scale *
            0.018;

    context.strokeStyle =
        "#d4b16e";

    context.lineWidth =
        Math.max(
            1,
            scale *
                0.0018,
        );

    context.beginPath();

    context.moveTo(
        fuseStartX,
        fuseStartY,
    );

    context.quadraticCurveTo(
        fuseStartX +
            scale *
                0.012,
        fuseStartY -
            scale *
                0.006,
        fuseEndX,
        fuseEndY,
    );

    context.stroke();

    /*
     * 심지 끝 발광.
     */
    const fuseSparkRadius =
        scale *
        (
            0.003 +
            (
                Math.sin(
                    now *
                        0.04,
                ) +
                1
            ) *
                0.0007
        );

    drawRadialGlow(
        context,
        fuseEndX,
        fuseEndY,
        fuseSparkRadius *
            4,
        FUSE_CORE_COLOR,
        0.62 *
            (
                1 -
                popProgress
            ),
    );

    context.save();

    context.globalCompositeOperation =
        "lighter";

    context.globalAlpha =
        0.92 *
        (
            1 -
            popProgress
        );

    context.fillStyle =
        FUSE_SPARK_COLOR;

    context.beginPath();

    context.arc(
        fuseEndX,
        fuseEndY,
        fuseSparkRadius,
        0,
        TWO_PI,
    );

    context.fill();

    context.restore();

    context.restore();

    /*
     * 마지막 "뿅".
     * 가방이 완전히 사라지는 순간 짧은 원형 플래시와 방사선을 준다.
     */
    if (
        popProgress >
        0
    ) {
        const popAlpha =
            1 -
            popProgress;

        const popRadius =
            scale *
            (
                0.018 +
                popProgress *
                    0.055
            );

        drawRadialGlow(
            context,
            x,
            y -
                bagHeight *
                    0.55,
            popRadius,
            "#fff0b5",
            popAlpha *
                0.34,
        );

        const rayCount =
            8;

        context.save();

        context.globalCompositeOperation =
            "lighter";

        context.strokeStyle =
            "#ffe7a4";

        context.lineCap =
            "round";

        for (
            let rayIndex = 0;
            rayIndex <
            rayCount;
            rayIndex +=
                1
        ) {
            const angle =
                rayIndex /
                rayCount *
                TWO_PI;

            const innerRadius =
                scale *
                0.018;

            const outerRadius =
                scale *
                (
                    0.022 +
                    popProgress *
                        0.045
                );

            context.globalAlpha =
                popAlpha *
                0.7;

            context.lineWidth =
                Math.max(
                    0.8,
                    scale *
                        0.0015 *
                        (
                            1 -
                            popProgress *
                                0.45
                        ),
                );

            context.beginPath();

            context.moveTo(
                x +
                    Math.cos(
                        angle,
                    ) *
                        innerRadius,
                y -
                    bagHeight *
                        0.55 +
                    Math.sin(
                        angle,
                    ) *
                        innerRadius,
            );

            context.lineTo(
                x +
                    Math.cos(
                        angle,
                    ) *
                        outerRadius,
                y -
                    bagHeight *
                        0.55 +
                    Math.sin(
                        angle,
                    ) *
                        outerRadius,
            );

            context.stroke();
        }

        context.restore();
    }
}

function drawFailure(context: CanvasRenderingContext2D, now: number, session: HooWorldFireworksSession, size: CanvasSize) {
    if (now <
        session.fuseEndsAt ||
        now >
            session.endsAt) {
        return;
    }
    const progress = clamp01((now -
        session.fuseEndsAt) /
        Math.max(1, session.endsAt -
            session.fuseEndsAt));
    const x = session.x /
        100 *
        size.width;
    const y = session.y /
        100 *
        size.height;
    const scale = getCanvasScale(size);
    const puffCount = 12;
    for (let index = 0; index <
        puffCount; index +=
        1) {
        const local = clamp01(progress *
            1.4 -
            index *
                0.045);
        const side = randomSigned(getSeed(session.sessionId), 12000 +
            index);
        const puffX = x +
            side *
                scale *
                0.045 *
                local;
        const puffY = y -
            scale *
                (0.015 +
                    local *
                        0.085);
        const radius = scale *
            (0.014 +
                index *
                    0.0012 +
                local *
                    0.012);
        const alpha = (1 -
            local) *
            0.14;
        drawRadialGlow(context, puffX, puffY, radius *
            1.8, FAILURE_SMOKE_COLOR, alpha);
    }
    const tinySparkEnvelope = (1 -
        smoothstep(0.12, 0.38, progress));
    const sparkCount = 24;
    for (let index = 0; index <
        sparkCount; index +=
        1) {
        const angle = index /
            sparkCount *
            TWO_PI;
        const distance = scale *
            0.045 *
            easeOutCubic(progress);
        const sparkX = x +
            Math.cos(angle) *
                distance;
        const sparkY = y -
            scale *
                0.03 +
            Math.sin(angle) *
                distance +
            progress *
                progress *
                scale *
                0.04;
        context.save();
        context.globalCompositeOperation =
            "lighter";
        context.globalAlpha =
            tinySparkEnvelope *
                0.68;
        context.fillStyle =
            index %
                3 ===
                0
                ? "#ffffff"
                : "#ffd17f";
        context.beginPath();
        context.arc(sparkX, sparkY, Math.max(0.6, scale *
            0.0018), 0, TWO_PI);
        context.fill();
        context.restore();
    }
    if (progress >
        0.12 &&
        progress <
            0.7) {
        const textAlpha = smoothstep(0.12, 0.25, progress) *
            (1 -
                smoothstep(0.55, 0.7, progress));
        context.save();
        context.globalAlpha =
            textAlpha *
                0.8;
        context.fillStyle =
            FAILURE_TEXT_COLOR;
        context.font =
            `800 ${Math.max(11, scale *
                0.017)}px sans-serif`;
        context.textAlign =
            "center";
        context.textBaseline =
            "middle";
        context.shadowColor =
            "rgba(0, 0, 0, 0.5)";
        context.shadowBlur =
            8;
        context.fillText("푸슉...", x, y -
            scale *
                0.085);
        context.restore();
    }
}
function drawSenrinBloom(context: CanvasRenderingContext2D, bloom: SenrinBloomPlan, now: number, size: CanvasSize) {
    const progress = (now -
        bloom.at) /
        bloom.durationMs;
    if (progress <
        0 ||
        progress >
            1) {
        return;
    }
    const safe = clamp01(progress);
    const scale = getCanvasScale(size);
    const centerX = bloom.x *
        size.width;
    const centerY = bloom.y *
        size.height;
    const radius = bloom.radiusScale *
        scale *
        easeOutQuart(safe);
    const fadeIn = smoothstep(0, 0.08, safe);
    const fadeOut = 1 -
        smoothstep(0.56, 1, safe);
    const envelope = bloom.alpha *
        fadeIn *
        fadeOut;
    const coreColor = mixHex(bloom.colorA, "#ffffff", 0.58);
    drawRadialGlow(context, centerX, centerY, radius *
        1.2, bloom.colorB, envelope *
        0.2);
    drawRadialGlow(context, centerX, centerY, Math.max(scale *
        0.006, radius *
        0.28), coreColor, envelope *
        0.42);
    for (let ray = 0; ray <
        bloom.rayCount; ray +=
        1) {
        const angle = (ray /
            bloom.rayCount *
            360 +
            bloom.rotationDeg) *
            DEG_TO_RAD;
        const rayJitter = 0.9 +
            Math.sin(ray *
                2.41 +
                bloom.rotationDeg) *
                0.08;
        const endX = centerX +
            Math.cos(angle) *
                radius *
                rayJitter;
        const endY = centerY +
            Math.sin(angle) *
                radius *
                rayJitter +
            safe *
                safe *
                size.height *
                0.012;
        const historyProgress = clamp01(safe -
            0.13);
        const historyRadius = bloom.radiusScale *
            scale *
            easeOutQuart(historyProgress) *
            rayJitter;
        const startX = centerX +
            Math.cos(angle) *
                historyRadius;
        const startY = centerY +
            Math.sin(angle) *
                historyRadius +
            historyProgress *
                historyProgress *
                size.height *
                0.012;
        const twinkle = 0.68 +
            Math.sin(safe *
                TWO_PI *
                (3 +
                    bloom.twinkle *
                        5) +
                ray *
                    1.37) *
                0.32 *
                bloom.twinkle;
        const color = ray %
            3 ===
            0
            ? bloom.colorB
            : bloom.colorA;
        drawSoftLine(context, {
            x: startX,
            y: startY,
        }, {
            x: endX,
            y: endY,
        }, color, envelope *
            twinkle *
            0.78, Math.max(0.55, scale *
            0.0012), 0.78);
        drawRadialGlow(context, endX, endY, scale *
            0.009, color, envelope *
            twinkle *
            0.12);
        context.save();
        context.globalCompositeOperation =
            "lighter";
        context.globalAlpha =
            envelope *
                twinkle;
        context.fillStyle =
            color;
        context.beginPath();
        context.arc(endX, endY, Math.max(0.6, scale *
            0.00145), 0, TWO_PI);
        context.fill();
        context.restore();
    }
}
function drawSenrinBlooms(context: CanvasRenderingContext2D, scene: FireworksScene, now: number, size: CanvasSize) {
    for (const bloom of scene.senrin) {
        drawSenrinBloom(context, bloom, now, size);
    }
}
function drawReflectionGlows(context: CanvasRenderingContext2D, scene: FireworksScene, now: number, session: HooWorldFireworksSession, size: CanvasSize) {
    if (now <
        session.fuseEndsAt ||
        now >
            session.glitterEndsAt) {
        return;
    }
    const progress = clamp01((now -
        session.fuseEndsAt) /
        Math.max(1, session.glitterEndsAt -
            session.fuseEndsAt));
    const envelope = smoothstep(0, 0.08, progress) *
        (1 -
            smoothstep(0.82, 1, progress));
    if (envelope <=
        0) {
        return;
    }
    const scale = getCanvasScale(size);
    for (const reflection of scene.reflections) {
        const flicker = 0.58 +
            Math.sin(now *
                0.0017 +
                reflection.phase) *
                0.42;
        const centerX = reflection.x *
            size.width;
        const centerY = size.height *
            0.92;
        const width = Math.max(3, reflection.widthScale *
            scale);
        const height = Math.max(8, reflection.heightScale *
            size.height);
        const gradient = context.createLinearGradient(centerX, centerY -
            height, centerX, centerY);
        gradient.addColorStop(0, hexToRgba(reflection.color, 0));
        gradient.addColorStop(0.45, hexToRgba(reflection.color, reflection.alpha *
            envelope *
            flicker));
        gradient.addColorStop(1, hexToRgba(reflection.color, 0));
        context.save();
        context.globalCompositeOperation =
            "lighter";
        context.fillStyle =
            gradient;
        context.beginPath();
        context.ellipse(centerX, centerY -
            height *
                0.35, width, height, 0, 0, TWO_PI);
        context.fill();
        context.restore();
    }
}
function drawNiagaraCurtain(context: CanvasRenderingContext2D, scene: FireworksScene, now: number, session: HooWorldFireworksSession, size: CanvasSize) {
    const curtainStart = session.fireworksEndsAt -
        980;
    const curtainEnd = Math.min(session.glitterEndsAt, session.finaleEndsAt +
        3600);
    if (now <
        curtainStart ||
        now >
            curtainEnd) {
        return;
    }
    const scale = getCanvasScale(size);
    for (const trail of scene.niagara) {
        const localStart = curtainStart +
            trail.delayMs;
        const localProgress = (now -
            localStart) /
            trail.durationMs;
        if (localProgress <
            0 ||
            localProgress >
                1) {
            continue;
        }
        const progress = clamp01(localProgress);
        const fadeIn = smoothstep(0, 0.08, progress);
        const fadeOut = 1 -
            smoothstep(0.68, 1, progress);
        const alpha = trail.alpha *
            fadeIn *
            fadeOut;
        const topX = trail.x *
            size.width;
        const topY = trail.topY *
            size.height;
        const visibleLength = trail.lengthScale *
            size.height *
            easeOutQuart(progress);
        const sway = Math.sin(progress *
            TWO_PI *
            1.4 +
            trail.phase) *
            trail.swayScale *
            size.width;
        const bottomX = topX +
            sway;
        const bottomY = topY +
            visibleLength;
        const previousProgress = clamp01(progress -
            0.06);
        const previousLength = trail.lengthScale *
            size.height *
            easeOutQuart(previousProgress);
        const previousSway = Math.sin(previousProgress *
            TWO_PI *
            1.4 +
            trail.phase) *
            trail.swayScale *
            size.width;
        const previousPoint = {
            x: topX +
                previousSway,
            y: topY +
                previousLength,
        };
        const currentPoint = {
            x: bottomX,
            y: bottomY,
        };
        drawSoftLine(context, previousPoint, currentPoint, trail.color, alpha *
            0.96, Math.max(0.65, trail.widthScale *
            scale), 0.78);
        const sparkCount = 5;
        for (let spark = 0; spark <
            sparkCount; spark +=
            1) {
            const sparkProgress = clamp01(progress -
                spark *
                    0.018);
            const sparkLength = trail.lengthScale *
                size.height *
                easeOutQuart(sparkProgress);
            const sparkSway = Math.sin(sparkProgress *
                TWO_PI *
                1.4 +
                trail.phase) *
                trail.swayScale *
                size.width;
            const sparkX = topX +
                sparkSway;
            const sparkY = topY +
                sparkLength;
            const sparkAlpha = alpha *
                (1 -
                    spark /
                        sparkCount);
            drawRadialGlow(context, sparkX, sparkY, scale *
                0.008 *
                (1 -
                    spark /
                        sparkCount *
                        0.3), trail.color, sparkAlpha *
                0.16);
            context.save();
            context.globalCompositeOperation =
                "lighter";
            context.globalAlpha =
                sparkAlpha;
            context.fillStyle =
                trail.color;
            context.beginPath();
            context.arc(sparkX, sparkY, Math.max(0.6, scale *
                0.0017), 0, TWO_PI);
            context.fill();
            context.restore();
        }
    }
}
function drawSakuraPetalShape(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, rotation: number, colorA: string, colorB: string, alpha: number) {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.globalCompositeOperation =
        "lighter";
    context.globalAlpha =
        alpha;
    const gradient = context.createLinearGradient(0, -height, 0, height);
    gradient.addColorStop(0, colorA);
    gradient.addColorStop(0.62, colorB);
    gradient.addColorStop(1, hexToRgba(colorB, 0.1));
    context.fillStyle =
        gradient;
    context.shadowColor =
        colorA;
    context.shadowBlur =
        width *
            2.8;
    context.beginPath();
    context.moveTo(0, -height);
    context.bezierCurveTo(width *
        0.78, -height *
        0.58, width *
        0.9, height *
        0.2, 0, height);
    context.bezierCurveTo(-width *
        0.9, height *
        0.2, -width *
        0.78, -height *
        0.58, 0, -height);
    context.closePath();
    context.fill();
    context.restore();
}
function drawSakuraAfterglow(context: CanvasRenderingContext2D, scene: FireworksScene, now: number, session: HooWorldFireworksSession, size: CanvasSize) {
    const start = session.finaleEndsAt -
        400;
    const end = session.glitterEndsAt;
    if (now <
        start ||
        now >
            end) {
        return;
    }
    const globalProgress = clamp01((now -
        start) /
        Math.max(1, end -
            start));
    const envelope = smoothstep(0, 0.08, globalProgress) *
        (1 -
            smoothstep(0.84, 1, globalProgress));
    const scale = getCanvasScale(size);
    for (const petal of scene.sakuraAfterglow) {
        const localStart = start +
            petal.delayMs;
        const localTime = now -
            localStart;
        if (localTime <
            0) {
            continue;
        }
        const localProgress = (localTime %
            petal.durationMs) /
            petal.durationMs;
        const sway = Math.sin(localProgress *
            TWO_PI *
            1.4 +
            petal.phase) *
            petal.driftXScale;
        const x = (petal.x +
            sway) *
            size.width;
        const y = (petal.y +
            petal.driftYScale *
                localProgress) *
            size.height;
        const fade = (1 -
            smoothstep(0.72, 1, localProgress));
        const alpha = petal.alpha *
            envelope *
            fade *
            (0.72 +
                Math.sin(localProgress *
                    TWO_PI *
                    2 +
                    petal.phase) *
                    0.28);
        if (alpha <=
            0.01) {
            continue;
        }
        const width = Math.max(1, petal.sizeScale *
            scale);
        const height = width *
            1.55;
        const rotation = (petal.rotationDeg +
            petal.rotationSpeedDeg *
                localProgress) *
            DEG_TO_RAD;
        drawSakuraPetalShape(context, x, y, width, height, rotation, petal.colorA, petal.colorB, alpha);
    }
}
function drawBurstSmokeVeil(context: CanvasRenderingContext2D, scene: FireworksScene, now: number, size: CanvasSize) {
    const scale = getCanvasScale(size);
    for (let index = 0; index <
        scene.bursts.length; index +=
        1) {
        const burst = scene.bursts[index];
        const progress = (now -
            burst.at) /
            3000;
        if (progress <
            0.14 ||
            progress >
                1) {
            continue;
        }
        const center = getBurstCenter(burst, size);
        const smokeEnvelope = smoothstep(0.14, 0.32, progress) *
            (1 -
                smoothstep(0.58, 1, progress));
        const puffCount = 3;
        for (let puff = 0; puff <
            puffCount; puff +=
            1) {
            const phase = index *
                2.7 +
                puff *
                    1.9;
            const puffX = center.x +
                Math.sin(phase) *
                    scale *
                    0.02 *
                    progress;
            const puffY = center.y -
                progress *
                    scale *
                    (0.018 +
                        puff *
                            0.005);
            const radius = scale *
                burst.radiusScale *
                (0.22 +
                    progress *
                        0.48 +
                    puff *
                        0.04);
            drawRadialGlow(context, puffX, puffY, radius, burst.palette.smoke, smokeEnvelope *
                0.028);
        }
    }
}
function drawExposureBloom(context: CanvasRenderingContext2D, scene: FireworksScene, now: number, size: CanvasSize) {
    let strongestAlpha = 0;
    let strongestX = size.width *
        0.5;
    let strongestY = size.height *
        0.22;
    let strongestColor = "#fff8e8";
    for (const burst of scene.bursts) {
        const progress = (now -
            burst.at) /
            520;
        if (progress <
            0 ||
            progress >
                1) {
            continue;
        }
        const alpha = smoothstep(0, 0.1, progress) *
            (1 -
                smoothstep(0.18, 1, progress)) *
            burst.coreStrength;
        if (alpha >
            strongestAlpha) {
            const center = getBurstCenter(burst, size);
            strongestAlpha =
                alpha;
            strongestX =
                center.x;
            strongestY =
                center.y;
            strongestColor =
                burst.palette.core;
        }
    }
    if (strongestAlpha <=
        0.02) {
        return;
    }
    drawRadialGlow(context, strongestX, strongestY, getCanvasScale(size) *
        (0.15 +
            strongestAlpha *
                0.12), strongestColor, strongestAlpha *
        0.12);
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * OUTLINE SCATTER RENDERER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 메인 폭죽 윤곽보다 살짝 뒤에서 따라오면서 접선 방향으로 흩어지는
 * 잔입자 레이어다.
 *
 * "자잘하게 터지는 불꽃이 윤곽 뒤로 흩날리는 느낌"을 담당한다.
 */
function getOutlineScatterPoint(
    plan: OutlineScatterPlan,
    now: number,
    size: CanvasSize,
) {
    const progress =
        (
            now -
            plan.at
        ) /
        plan.durationMs;

    if (
        progress < 0 ||
        progress > 1
    ) {
        return null;
    }

    const safe =
        clamp01(
            progress,
        );

    const baseScale =
        getCanvasScale(
            size,
        );

    const centerX =
        plan.x /
        100 *
        size.width;

    const centerY =
        plan.y /
        100 *
        size.height;

    const angle =
        plan.angleDeg *
        DEG_TO_RAD;

    const tangent =
        angle +
        Math.PI /
        2;

    /*
     * 메인 윤곽보다 살짝 뒤쳐지는 속도.
     * 처음에는 따라가다가 시간이 갈수록 backtrack이 커진다.
     */
    const outwardProgress =
        easeOutCubic(
            safe,
        );

    const laggedProgress =
        clamp01(
            outwardProgress -
            plan.lagScale *
                safe *
                safe,
        );

    const radius =
        plan.radiusScale *
        baseScale *
        laggedProgress;

    const backtrack =
        plan.backtrackScale *
        baseScale *
        easeInQuad(
            safe,
        );

    const tangentDrift =
        plan.tangentDriftScale *
        baseScale *
        (
            0.35 +
            safe *
                0.9
        ) +
        Math.sin(
            safe *
            TWO_PI *
            1.65 +
            plan.phase
        ) *
            plan.tangentDriftScale *
            baseScale *
            0.55;

    const wind =
        plan.windScale *
        baseScale *
        (
            safe *
            safe
        );

    const gravity =
        plan.gravityScale *
        size.height *
        safe *
        safe;

    const x =
        centerX +
        Math.cos(
            angle,
        ) *
            (
                radius -
                backtrack
            ) +
        Math.cos(
            tangent,
        ) *
            tangentDrift +
        wind;

    const y =
        centerY +
        Math.sin(
            angle,
        ) *
            (
                radius -
                backtrack
            ) +
        Math.sin(
            tangent,
        ) *
            tangentDrift +
        gravity;

    const fadeIn =
        smoothstep(
            0,
            0.12,
            safe,
        );

    const fadeOut =
        1 -
        smoothstep(
            0.48,
            1,
            safe,
        );

    const twinkle =
        0.72 +
        Math.sin(
            safe *
            TWO_PI *
            (
                2.2 +
                plan.twinkle *
                    4
            ) +
            plan.phase,
        ) *
            0.28 *
            plan.twinkle;

    const alpha =
        clamp01(
            plan.alpha *
            fadeIn *
            fadeOut *
            twinkle,
        );

    return {
        x,
        y,
        alpha,
        rotation:
            angle,
        progress:
            safe,
    } satisfies ParticlePoint;
}

function getPreviousOutlineScatterPoint(
    plan: OutlineScatterPlan,
    now: number,
    size: CanvasSize,
) {
    const historyMs =
        Math.max(
            32,
            plan.durationMs *
            plan.trailScale,
        );

    return getOutlineScatterPoint(
        plan,
        now -
            historyMs,
        size,
    );
}

function drawOutlineScatterSpark(
    context: CanvasRenderingContext2D,
    plan: OutlineScatterPlan,
    now: number,
    size: CanvasSize,
) {
    const point =
        getOutlineScatterPoint(
            plan,
            now,
            size,
        );

    if (
        !point ||
        point.alpha <=
            0.002
    ) {
        return;
    }

    const previous =
        getPreviousOutlineScatterPoint(
            plan,
            now,
            size,
        );

    const scale =
        getCanvasScale(
            size,
        );

    const mixedColor =
        mixHex(
            plan.colorA,
            plan.colorB,
            point.progress *
                0.55,
        );

    /*
     * 윤곽 뒤쪽이라 메인 파티클보다 얇고 흐린 꼬리를 사용한다.
     */
    if (
        previous
    ) {
        drawSoftLine(
            context,
            previous,
            point,
            mixedColor,
            point.alpha *
                0.48,
            Math.max(
                0.45,
                plan.sizeScale *
                scale *
                0.5,
            ),
            0.42,
        );
    }

    const radius =
        Math.max(
            0.55,
            plan.sizeScale *
            scale *
            (
                0.62 +
                point.alpha *
                    0.38
            ),
        );

    drawRadialGlow(
        context,
        point.x,
        point.y,
        radius *
            4.2,
        mixedColor,
        point.alpha *
            0.16,
    );

    context.save();

    context.globalCompositeOperation =
        "lighter";

    context.globalAlpha =
        point.alpha;

    context.fillStyle =
        mixedColor;

    context.shadowColor =
        mixedColor;

    context.shadowBlur =
        radius *
        2.8;

    context.beginPath();

    context.arc(
        point.x,
        point.y,
        radius,
        0,
        TWO_PI,
    );

    context.fill();

    context.restore();
}

function drawOutlineScatter(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    for (
        const plan of
        scene.outlineScatter
    ) {
        drawOutlineScatterSpark(
            context,
            plan,
            now,
            size,
        );
    }
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * PRE-FINALE DARKNESS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 최종 폭발 직전 주변이 갑자기 어두워지는 장면.
 *
 * 단순 검정 사각형 한 장이 아니라:
 * - 중앙은 아주 조금 덜 어둡게
 * - 가장자리는 더 어둡게
 * - 위쪽은 짙은 남색
 * - 아래쪽은 약간 따뜻한 검정
 *
 * 을 섞어 축제장의 야경이 자연스럽게 눌리는 느낌을 만든다.
 */
function getPreFinaleDarknessAmount(
    scene: FireworksScene,
    now: number,
) {
    const timing =
        scene.finaleTiming;

    if (
        now <
            timing.darkStartAt ||
        now >
            timing.flashEndsAt
    ) {
        return 0;
    }

    if (
        now <=
        timing.nearBlackAt
    ) {
        return smoothstep(
            timing.darkStartAt,
            timing.nearBlackAt,
            now,
        );
    }

    /*
     * 폭발 순간에는 암전이 아주 빠르게 걷힌다.
     */
    return (
        1 -
        smoothstep(
            timing.impactAt -
                40,
            timing.flashEndsAt,
            now,
        )
    );
}

function drawPreFinaleDarkness(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    const amount =
        getPreFinaleDarknessAmount(
            scene,
            now,
        );

    if (
        amount <=
        0.001
    ) {
        return;
    }

    const centerX =
        size.width *
        0.5;

    const centerY =
        size.height *
        0.31;

    const radial =
        context.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            Math.max(
                size.width,
                size.height,
            ) *
                0.82,
        );

    radial.addColorStop(
        0,
        `rgba(8, 9, 22, ${0.48 * amount})`,
    );

    radial.addColorStop(
        0.38,
        `rgba(5, 6, 16, ${0.62 * amount})`,
    );

    radial.addColorStop(
        1,
        `rgba(1, 2, 7, ${0.86 * amount})`,
    );

    context.save();

    context.globalCompositeOperation =
        "source-over";

    context.fillStyle =
        radial;

    context.fillRect(
        0,
        0,
        size.width,
        size.height,
    );

    context.restore();

    /*
     * 상단 남색 베일.
     */
    const vertical =
        context.createLinearGradient(
            0,
            0,
            0,
            size.height,
        );

    vertical.addColorStop(
        0,
        `rgba(9, 11, 33, ${0.34 * amount})`,
    );

    vertical.addColorStop(
        0.56,
        `rgba(6, 7, 18, ${0.18 * amount})`,
    );

    vertical.addColorStop(
        1,
        `rgba(18, 10, 12, ${0.12 * amount})`,
    );

    context.save();

    context.globalCompositeOperation =
        "source-over";

    context.fillStyle =
        vertical;

    context.fillRect(
        0,
        0,
        size.width,
        size.height,
    );

    context.restore();
}

/*
 * 암전 시점에 아주 작은 별점만 남겨 시선이 하늘 중앙으로 모이게 한다.
 */
function drawFinaleMicroStars(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    const darkness =
        getPreFinaleDarknessAmount(
            scene,
            now,
        );

    const afterImpact =
        now >=
        scene.finaleTiming.impactAt;

    const globalAlpha =
        afterImpact
            ? 0.4
            : darkness;

    if (
        globalAlpha <=
        0.01
    ) {
        return;
    }

    const scale =
        getCanvasScale(
            size,
        );

    for (
        const star of
        scene.finaleMicroStars
    ) {
        const progress =
            (
                now -
                star.at
            ) /
            star.durationMs;

        if (
            progress < 0 ||
            progress > 1
        ) {
            continue;
        }

        const twinkle =
            0.52 +
            Math.sin(
                progress *
                TWO_PI *
                (
                    2.2 +
                    star.twinkle *
                        4.8
                ) +
                star.phase,
            ) *
                0.48;

        const fadeOut =
            1 -
            smoothstep(
                0.76,
                1,
                progress,
            );

        const alpha =
            clamp01(
                star.alpha *
                twinkle *
                fadeOut *
                globalAlpha,
            );

        if (
            alpha <=
            0.002
        ) {
            continue;
        }

        const x =
            star.x *
            size.width;

        const y =
            star.y *
            size.height;

        const radius =
            Math.max(
                0.55,
                star.sizeScale *
                scale,
            );

        drawRadialGlow(
            context,
            x,
            y,
            radius *
                4,
            star.color,
            alpha *
                0.22,
        );

        context.save();

        context.globalCompositeOperation =
            "lighter";

        context.globalAlpha =
            alpha;

        context.fillStyle =
            star.color;

        context.beginPath();

        context.arc(
            x,
            y,
            radius,
            0,
            TWO_PI,
        );

        context.fill();

        context.restore();
    }
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * MASTER ROCKET HELPERS
 * ─────────────────────────────────────────────────────────────────────────────
 */
function isMasterFinaleRocket(
    rocket: FireworkRocketPlan,
) {
    return (
        rocket.burstKind ===
        "master_finale"
    );
}

function isMasterFinaleBurst(
    burst: FireworkBurstPlan,
) {
    return (
        burst.kind ===
        "master_finale"
    );
}

function drawRegularRockets(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    for (
        const rocket of
        scene.regularRockets
    ) {
        drawRocket(
            context,
            rocket,
            now,
            size,
        );
    }
}

function drawMasterFinaleRocket(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    for (
        const rocket of
        scene.masterFinaleRockets
    ) {

        drawRocket(
            context,
            rocket,
            now,
            size,
        );

        if (
            now <
                rocket.launchAt ||
            now >
                rocket.burstAt
        ) {
            continue;
        }

        const progress =
            clamp01(
                (
                    now -
                    rocket.launchAt
                ) /
                Math.max(
                    1,
                    rocket.burstAt -
                        rocket.launchAt,
                ),
            );

        const point =
            getRocketPoint(
                rocket,
                progress,
                size,
            );

        const scale =
            getCanvasScale(
                size,
            );

        /*
         * 암전 속에서 중앙 로켓의 머리 부분만 강하게 빛난다.
         */
        drawRadialGlow(
            context,
            point.x,
            point.y,
            scale *
                (
                    0.018 +
                    progress *
                        0.012
                ),
            "#fff6dc",
            0.48 +
                progress *
                    0.24,
        );

        drawRadialGlow(
            context,
            point.x,
            point.y,
            scale *
                0.009,
            "#ffffff",
            0.72,
        );
    }
}

function drawRegularBursts(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    for (
        const burst of
        scene.regularBursts
    ) {
        drawBurst(
            context,
            burst,
            now,
            size,
        );
    }
}

function drawMasterFinaleBurst(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    for (
        const burst of
        scene.masterFinaleBursts
    ) {
        drawBurst(
            context,
            burst,
            now,
            size,
        );
    }
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * FINALE IMPACT FLASH
 * ─────────────────────────────────────────────────────────────────────────────
 */
function getFinaleImpactProgress(
    scene: FireworksScene,
    now: number,
    durationMs: number,
) {
    return (
        now -
        scene.finaleTiming.impactAt
    ) /
    Math.max(
        1,
        durationMs,
    );
}

function drawFinaleFullScreenExposure(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    const progress =
        getFinaleImpactProgress(
            scene,
            now,
            620,
        );

    if (
        progress < 0 ||
        progress > 1
    ) {
        return;
    }

    const envelope =
        smoothstep(
            0,
            0.035,
            progress,
        ) *
        (
            1 -
            smoothstep(
                0.08,
                1,
                progress,
            )
        );

    const alpha =
        envelope *
        0.2;

    context.save();

    context.globalCompositeOperation =
        "screen";

    context.globalAlpha =
        alpha;

    const gradient =
        context.createRadialGradient(
            size.width *
                0.5,
            size.height *
                0.18,
            0,
            size.width *
                0.5,
            size.height *
                0.18,
            Math.max(
                size.width,
                size.height,
            ) *
                0.95,
        );

    gradient.addColorStop(
        0,
        "rgba(255,255,255,1)",
    );

    gradient.addColorStop(
        0.3,
        "rgba(255,244,224,0.82)",
    );

    gradient.addColorStop(
        0.62,
        "rgba(255,221,232,0.42)",
    );

    gradient.addColorStop(
        1,
        "rgba(220,214,255,0)",
    );

    context.fillStyle =
        gradient;

    context.fillRect(
        0,
        0,
        size.width,
        size.height,
    );

    context.restore();
}

function drawFinaleCoreBlast(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    session: HooWorldFireworksSession,
    size: CanvasSize,
) {
    const progress =
        getFinaleImpactProgress(
            scene,
            now,
            1800,
        );

    if (
        progress < 0 ||
        progress > 1
    ) {
        return;
    }

    const centerX =
        clamp(
            session.x /
            100 *
            size.width,
            size.width *
                0.3,
            size.width *
                0.7,
        );

    const centerY =
        size.height *
        0.15;

    const scale =
        getCanvasScale(
            size,
        );

    const flash =
        smoothstep(
            0,
            0.045,
            progress,
        ) *
        (
            1 -
            smoothstep(
                0.2,
                0.78,
                progress,
            )
        );

    const bloom =
        smoothstep(
            0,
            0.08,
            progress,
        ) *
        (
            1 -
            smoothstep(
                0.42,
                1,
                progress,
            )
        );

    const coreRadius =
        scale *
        (
            0.035 +
            easeOutQuart(
                progress,
            ) *
                0.19
        );

    const auraRadius =
        scale *
        (
            0.12 +
            easeOutQuart(
                progress,
            ) *
                0.56
        );

    drawRadialGlow(
        context,
        centerX,
        centerY,
        auraRadius,
        "#ffe6b8",
        bloom *
            0.18,
    );

    drawRadialGlow(
        context,
        centerX,
        centerY,
        auraRadius *
            0.8,
        "#ffd7e6",
        bloom *
            0.1,
    );

    drawRadialGlow(
        context,
        centerX,
        centerY,
        coreRadius,
        "#ffffff",
        flash *
            0.72,
    );

    drawRadialGlow(
        context,
        centerX,
        centerY,
        coreRadius *
            0.56,
        "#ffffff",
        flash *
            0.95,
    );
}

/*
 * 짧은 광선 파편.
 */
function drawFinaleImpactShard(
    context: CanvasRenderingContext2D,
    plan: FinaleImpactShardPlan,
    now: number,
    session: HooWorldFireworksSession,
    size: CanvasSize,
) {
    const progress =
        (
            now -
            plan.at
        ) /
        plan.durationMs;

    if (
        progress < 0 ||
        progress > 1
    ) {
        return;
    }

    const safe =
        clamp01(
            progress,
        );

    const centerX =
        clamp(
            session.x /
            100 *
            size.width,
            size.width *
                0.3,
            size.width *
                0.7,
        );

    const centerY =
        size.height *
        0.15;

    const scale =
        getCanvasScale(
            size,
        );

    const angle =
        plan.angleDeg *
        DEG_TO_RAD;

    const tangent =
        angle +
        Math.PI /
        2;

    const radius =
        plan.radiusScale *
        scale *
        easeOutQuart(
            safe,
        );

    const curl =
        Math.sin(
            safe *
            Math.PI,
        ) *
        plan.curlScale *
        scale;

    const endX =
        centerX +
        Math.cos(
            angle,
        ) *
            radius +
        Math.cos(
            tangent,
        ) *
            curl;

    const endY =
        centerY +
        Math.sin(
            angle,
        ) *
            radius +
        Math.sin(
            tangent,
        ) *
            curl;

    const length =
        plan.lengthScale *
        scale *
        (
            1 -
            safe *
                0.55
        );

    const fromX =
        endX -
        Math.cos(
            angle,
        ) *
            length;

    const fromY =
        endY -
        Math.sin(
            angle,
        ) *
            length;

    const alpha =
        plan.alpha *
        smoothstep(
            0,
            0.08,
            safe,
        ) *
        (
            1 -
            smoothstep(
                0.32,
                1,
                safe,
            )
        );

    drawSoftLine(
        context,
        {
            x:
                fromX,
            y:
                fromY,
        },
        {
            x:
                endX,
            y:
                endY,
        },
        plan.color,
        alpha,
        Math.max(
            0.9,
            plan.widthScale *
            scale,
        ),
        1.2,
    );

    drawRadialGlow(
        context,
        endX,
        endY,
        scale *
            0.012,
        plan.color,
        alpha *
            0.34,
    );
}

function drawFinaleImpactShards(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    session: HooWorldFireworksSession,
    size: CanvasSize,
) {
    for (
        const plan of
        scene.finaleImpactShards
    ) {
        drawFinaleImpactShard(
            context,
            plan,
            now,
            session,
            size,
        );
    }
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * SHOCKWAVE RINGS
 * ─────────────────────────────────────────────────────────────────────────────
 */
function drawFinaleShockwave(
    context: CanvasRenderingContext2D,
    plan: FinaleShockwavePlan,
    now: number,
    session: HooWorldFireworksSession,
    size: CanvasSize,
) {
    const progress =
        (
            now -
            plan.at
        ) /
        plan.durationMs;

    if (
        progress < 0 ||
        progress > 1
    ) {
        return;
    }

    const safe =
        clamp01(
            progress,
        );

    const centerX =
        clamp(
            session.x /
            100 *
            size.width,
            size.width *
                0.3,
            size.width *
                0.7,
        );

    const centerY =
        size.height *
        0.15;

    const scale =
        getCanvasScale(
            size,
        );

    const radius =
        lerp(
            plan.radiusFromScale,
            plan.radiusToScale,
            easeOutQuart(
                safe,
            ),
        ) *
        scale;

    const alpha =
        plan.alpha *
        smoothstep(
            0,
            0.06,
            safe,
        ) *
        (
            1 -
            smoothstep(
                0.18,
                1,
                safe,
            )
        );

    context.save();

    context.globalCompositeOperation =
        "lighter";

    context.globalAlpha =
        alpha;

    context.strokeStyle =
        plan.color;

    context.lineWidth =
        Math.max(
            0.7,
            plan.lineWidthScale *
            scale,
        );

    context.shadowColor =
        plan.color;

    context.shadowBlur =
        plan.blurScale *
        scale;

    context.beginPath();

    context.arc(
        centerX,
        centerY,
        radius,
        0,
        TWO_PI,
    );

    context.stroke();

    context.restore();
}

function drawFinaleShockwaves(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    session: HooWorldFireworksSession,
    size: CanvasSize,
) {
    for (
        const plan of
        scene.finaleShockwaves
    ) {
        drawFinaleShockwave(
            context,
            plan,
            now,
            session,
            size,
        );
    }
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * BACKLIT SMOKE
 * ─────────────────────────────────────────────────────────────────────────────
 */
function drawFinaleSmokeCloud(
    context: CanvasRenderingContext2D,
    plan: FinaleSmokeCloudPlan,
    now: number,
    size: CanvasSize,
) {
    const progress =
        (
            now -
            plan.at
        ) /
        plan.durationMs;

    if (
        progress < 0 ||
        progress > 1
    ) {
        return;
    }

    const safe =
        clamp01(
            progress,
        );

    const x =
        (
            plan.x +
            plan.driftXScale *
                safe +
            Math.sin(
                safe *
                TWO_PI +
                plan.phase,
            ) *
                plan.driftXScale *
                0.32
        ) *
        size.width;

    const y =
        (
            plan.y +
            plan.driftYScale *
                safe
        ) *
        size.height;

    const scale =
        getCanvasScale(
            size,
        );

    const radius =
        plan.radiusScale *
        scale *
        (
            0.65 +
            easeOutCubic(
                safe,
            ) *
                0.72
        );

    const alpha =
        plan.alpha *
        smoothstep(
            0,
            0.12,
            safe,
        ) *
        (
            1 -
            smoothstep(
                0.45,
                1,
                safe,
            )
        );

    const gradient =
        context.createRadialGradient(
            x,
            y,
            0,
            x,
            y,
            radius,
        );

    gradient.addColorStop(
        0,
        hexToRgba(
            plan.color,
            alpha,
        ),
    );

    gradient.addColorStop(
        0.5,
        hexToRgba(
            plan.color,
            alpha *
                0.42,
        ),
    );

    gradient.addColorStop(
        1,
        hexToRgba(
            plan.color,
            0,
        ),
    );

    context.save();

    context.globalCompositeOperation =
        "screen";

    context.fillStyle =
        gradient;

    context.beginPath();

    context.arc(
        x,
        y,
        radius,
        0,
        TWO_PI,
    );

    context.fill();

    context.restore();
}

function drawFinaleSmokeClouds(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    for (
        const plan of
        scene.finaleSmokeClouds
    ) {
        drawFinaleSmokeCloud(
            context,
            plan,
            now,
            size,
        );
    }
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * FINALE WHITE RAIN
 * ─────────────────────────────────────────────────────────────────────────────
 */
function getFinaleWhiteRainPoint(
    plan: FinaleWhiteRainPlan,
    now: number,
    size: CanvasSize,
) {
    const progress =
        (
            now -
            plan.at
        ) /
        plan.durationMs;

    if (
        progress < 0 ||
        progress > 1
    ) {
        return null;
    }

    const safe =
        clamp01(
            progress,
        );

    const x =
        (
            plan.startX +
            plan.spreadXScale *
                easeOutCubic(
                    safe,
                ) +
            plan.driftXScale *
                safe *
                safe +
            Math.sin(
                safe *
                TWO_PI *
                (
                    0.8 +
                    plan.depth *
                        0.9
                ) +
                plan.phase,
            ) *
                plan.swayScale *
                (
                    0.35 +
                    safe *
                        0.65
                )
        ) *
        size.width;

    const y =
        (
            plan.startY +
            plan.fallScale *
                easeInQuad(
                    safe,
                )
        ) *
        size.height;

    const fadeIn =
        smoothstep(
            0,
            0.08,
            safe,
        );

    const fadeOut =
        1 -
        smoothstep(
            0.76,
            1,
            safe,
        );

    const twinkleWave =
        0.56 +
        Math.sin(
            safe *
            TWO_PI *
            (
                2.3 +
                plan.twinkle *
                    5
            ) +
            plan.phase,
        ) *
            0.44;

    const strobeWave =
        plan.strobe > 0.2
            ? (
                Math.sin(
                    safe *
                    TWO_PI *
                    (
                        5.5 +
                        plan.strobe *
                            6
                    ) +
                    plan.phase *
                        0.7,
                ) >
                -0.08
                    ? 1
                    : 0.18
            )
            : 1;

    const alpha =
        clamp01(
            plan.alpha *
            fadeIn *
            fadeOut *
            (
                0.58 +
                0.42 *
                    clamp01(
                        twinkleWave,
                    )
            ) *
            strobeWave,
        );

    const rotation =
        Math.sin(
            safe *
            TWO_PI +
            plan.phase,
        ) *
        0.24;

    return {
        x,
        y,
        alpha,
        rotation,
        progress:
            safe,
    } satisfies ParticlePoint;
}

function getPreviousFinaleWhiteRainPoint(
    plan: FinaleWhiteRainPlan,
    now: number,
    size: CanvasSize,
) {
    const historyMs =
        Math.max(
            55,
            plan.durationMs *
            plan.trailScale,
        );

    return getFinaleWhiteRainPoint(
        plan,
        now -
            historyMs,
        size,
    );
}

function drawFinaleWhiteRainCross(
    context: CanvasRenderingContext2D,
    point: ParticlePoint,
    plan: FinaleWhiteRainPlan,
    size: CanvasSize,
) {
    const scale =
        getCanvasScale(
            size,
        );

    const pulse =
        Math.max(
            0,
            Math.sin(
                point.progress *
                TWO_PI *
                (
                    4 +
                    plan.twinkle *
                        5
                ) +
                plan.phase,
            ),
        );

    if (
        pulse < 0.72
    ) {
        return;
    }

    const length =
        scale *
        (
            0.004 +
            plan.depth *
                0.006
        ) *
        (
            0.6 +
            pulse *
                0.7
        );

    const alpha =
        point.alpha *
        (
            pulse -
            0.65
        ) *
        1.5;

    context.save();

    context.globalCompositeOperation =
        "lighter";

    context.globalAlpha =
        alpha;

    context.strokeStyle =
        plan.color;

    context.lineWidth =
        Math.max(
            0.55,
            scale *
            0.00055,
        );

    context.shadowColor =
        plan.color;

    context.shadowBlur =
        scale *
        0.007;

    context.beginPath();

    context.moveTo(
        point.x -
            length,
        point.y,
    );

    context.lineTo(
        point.x +
            length,
        point.y,
    );

    context.moveTo(
        point.x,
        point.y -
            length,
    );

    context.lineTo(
        point.x,
        point.y +
            length,
    );

    context.stroke();

    context.restore();
}

function drawFinaleWhiteRainParticle(
    context: CanvasRenderingContext2D,
    plan: FinaleWhiteRainPlan,
    now: number,
    size: CanvasSize,
) {
    const point =
        getFinaleWhiteRainPoint(
            plan,
            now,
            size,
        );

    if (
        !point ||
        point.alpha <=
            0.002
    ) {
        return;
    }

    const previous =
        getPreviousFinaleWhiteRainPoint(
            plan,
            now,
            size,
        );

    const scale =
        getCanvasScale(
            size,
        );

    const width =
        Math.max(
            0.55,
            plan.sizeScale *
            scale *
            (
                0.38 +
                plan.depth *
                    0.32
            ),
        );

    if (
        previous
    ) {
        drawSoftLine(
            context,
            previous,
            point,
            plan.color,
            point.alpha *
                (
                    0.42 +
                    plan.depth *
                        0.38
                ),
            width,
            0.78,
        );
    }

    const radius =
        Math.max(
            0.55,
            plan.sizeScale *
            scale *
            (
                0.75 +
                plan.depth *
                    0.52
            ),
        );

    drawRadialGlow(
        context,
        point.x,
        point.y,
        radius *
            (
                4 +
                plan.depth *
                    2
            ),
        plan.color,
        point.alpha *
            (
                0.18 +
                plan.depth *
                    0.12
            ),
    );

    context.save();

    context.globalCompositeOperation =
        "lighter";

    context.globalAlpha =
        point.alpha;

    context.fillStyle =
        plan.color;

    context.shadowColor =
        plan.color;

    context.shadowBlur =
        radius *
        (
            3 +
            plan.depth *
                2
        );

    context.beginPath();

    context.arc(
        point.x,
        point.y,
        radius,
        0,
        TWO_PI,
    );

    context.fill();

    context.restore();

    drawFinaleWhiteRainCross(
        context,
        point,
        plan,
        size,
    );
}

function drawFinaleWhiteRain(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    /*
     * depth 순서는 유지하되 scene 생성 시 이미 3개 버킷으로 분리했다.
     * 각 흰 별비는 매 프레임 정확히 한 번만 검사 / 렌더링된다.
     */
    for (
        const bucket of
        scene.finaleWhiteRainDepthBuckets
    ) {
        for (
            const plan of
            bucket
        ) {
            drawFinaleWhiteRainParticle(
                context,
                plan,
                now,
                size,
            );
        }
    }
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * GROUND LIGHT BOUNCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 큰 폭발이 하늘에서만 밝고 지면에는 아무 영향이 없으면
 * 화면이 분리되어 보인다.
 *
 * 최종 폭발 직후 화면 하단에 아주 약한 금빛 / 분홍빛 반사광을 넣어
 * 같은 공간 안에서 터졌다는 느낌을 만든다.
 */
function drawFinaleGroundLightBounce(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    const progress =
        getFinaleImpactProgress(
            scene,
            now,
            2200,
        );

    if (
        progress < 0 ||
        progress > 1
    ) {
        return;
    }

    const envelope =
        smoothstep(
            0,
            0.06,
            progress,
        ) *
        (
            1 -
            smoothstep(
                0.18,
                1,
                progress,
            )
        );

    const gradient =
        context.createRadialGradient(
            size.width *
                0.5,
            size.height *
                0.95,
            0,
            size.width *
                0.5,
            size.height *
                0.95,
            size.width *
                0.62,
        );

    gradient.addColorStop(
        0,
        `rgba(255, 231, 187, ${0.13 * envelope})`,
    );

    gradient.addColorStop(
        0.35,
        `rgba(255, 205, 222, ${0.07 * envelope})`,
    );

    gradient.addColorStop(
        1,
        "rgba(255,255,255,0)",
    );

    context.save();

    context.globalCompositeOperation =
        "screen";

    context.fillStyle =
        gradient;

    context.fillRect(
        0,
        size.height *
            0.5,
        size.width,
        size.height *
            0.5,
    );

    context.restore();
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * FINALE AFTERGLOW VEIL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 최종 폭발 뒤 하얀 별비가 떨어지는 동안 배경이 완전히 원래 밝기로
 * 돌아오지 않고, 아주 얇은 진주색 빛막을 유지한다.
 */
function drawFinaleAfterglowVeil(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    const timing =
        scene.finaleTiming;

    if (
        now <
            timing.impactAt ||
        now >
            timing.whiteRainEndsAt
    ) {
        return;
    }

    const progress =
        clamp01(
            (
                now -
                timing.impactAt
            ) /
            Math.max(
                1,
                timing.whiteRainEndsAt -
                    timing.impactAt,
            ),
        );

    const envelope =
        (
            1 -
            smoothstep(
                0.72,
                1,
                progress,
            )
        );

    const gradient =
        context.createLinearGradient(
            0,
            0,
            0,
            size.height,
        );

    gradient.addColorStop(
        0,
        `rgba(255, 247, 233, ${0.018 * envelope})`,
    );

    gradient.addColorStop(
        0.36,
        `rgba(248, 229, 246, ${0.015 * envelope})`,
    );

    gradient.addColorStop(
        0.68,
        `rgba(228, 221, 255, ${0.01 * envelope})`,
    );

    gradient.addColorStop(
        1,
        "rgba(255,255,255,0)",
    );

    context.save();

    context.globalCompositeOperation =
        "screen";

    context.fillStyle =
        gradient;

    context.fillRect(
        0,
        0,
        size.width,
        size.height,
    );

    context.restore();
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * FINALE MASTER OPTICAL HALO
 * ─────────────────────────────────────────────────────────────────────────────
 */
function drawFinaleMasterHalo(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    session: HooWorldFireworksSession,
    size: CanvasSize,
) {
    const progress =
        getFinaleImpactProgress(
            scene,
            now,
            3300,
        );

    if (
        progress < 0 ||
        progress > 1
    ) {
        return;
    }

    const centerX =
        clamp(
            session.x /
            100 *
            size.width,
            size.width *
                0.3,
            size.width *
                0.7,
        );

    const centerY =
        size.height *
        0.15;

    const scale =
        getCanvasScale(
            size,
        );

    const envelope =
        smoothstep(
            0,
            0.05,
            progress,
        ) *
        (
            1 -
            smoothstep(
                0.28,
                1,
                progress,
            )
        );

    const colors = [
        "#ffffff",
        "#ffe9b9",
        "#ffd4e5",
        "#e9ddff",
    ] as const;

    for (
        let index = 0;
        index < colors.length;
        index += 1
    ) {
        const local =
            clamp01(
                (
                    progress -
                    index *
                        0.035
                ) /
                (
                    1 -
                    index *
                        0.035
                ),
            );

        const radius =
            scale *
            (
                0.07 +
                index *
                    0.02 +
                easeOutQuart(
                    local,
                ) *
                    (
                        0.2 +
                        index *
                            0.05
                    )
            );

        const alpha =
            envelope *
            (
                0.13 -
                index *
                    0.018
            );

        context.save();

        context.globalCompositeOperation =
            "lighter";

        context.globalAlpha =
            Math.max(
                0,
                alpha,
            );

        context.strokeStyle =
            colors[
                index
            ];

        context.lineWidth =
            Math.max(
                0.7,
                scale *
                (
                    0.0012 -
                    index *
                        0.00013
                ),
            );

        context.shadowColor =
            colors[
                index
            ];

        context.shadowBlur =
            scale *
            (
                0.015 +
                index *
                    0.004
            );

        context.beginPath();

        context.arc(
            centerX,
            centerY,
            radius,
            0,
            TWO_PI,
        );

        context.stroke();

        context.restore();
    }
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * MASTER PARTICLE AFTERIMAGE PASS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 최종 폭발의 입자가 너무 또렷한 점 하나씩으로만 보이지 않도록
 * 짧은 시간차로 과거 위치를 여러 번 샘플링해 광학적 afterimage를 만든다.
 */
function drawMasterFinaleParticleAfterimages(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    const master =
        scene.bursts.find(
            isMasterFinaleBurst,
        );

    if (
        !master
    ) {
        return;
    }

    if (
        now <
            master.at ||
        now >
            master.at +
                master.durationMs
    ) {
        return;
    }

    const historyOffsets = [
        70,
        130,
        210,
        300,
    ] as const;

    for (
        const particle of
        master.particles
    ) {
        if (
            particle.role ===
                "petal" ||
            particle.role ===
                "strobe"
        ) {
            continue;
        }

        const current =
            getParticlePoint(
                particle,
                master,
                now,
                size,
            );

        if (
            !current
        ) {
            continue;
        }

        for (
            let index = 0;
            index < historyOffsets.length;
            index += 1
        ) {
            const offset =
                historyOffsets[
                    index
                ];

            const point =
                getParticlePoint(
                    particle,
                    master,
                    now -
                        offset,
                    size,
                );

            if (
                !point ||
                point.alpha <=
                    0.004
            ) {
                continue;
            }

            const alpha =
                point.alpha *
                (
                    0.12 -
                    index *
                        0.022
                );

            if (
                alpha <=
                0
            ) {
                continue;
            }

            const scale =
                getCanvasScale(
                    size,
                );

            const radius =
                Math.max(
                    0.45,
                    particle.sizeScale *
                    scale *
                    (
                        0.46 -
                        index *
                            0.045
                    ),
                );

            const color =
                mixHex(
                    particle.colorA,
                    particle.colorB,
                    0.45,
                );

            context.save();

            context.globalCompositeOperation =
                "lighter";

            context.globalAlpha =
                alpha;

            context.fillStyle =
                color;

            context.beginPath();

            context.arc(
                point.x,
                point.y,
                radius,
                0,
                TWO_PI,
            );

            context.fill();

            context.restore();
        }
    }
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * MASTER IMPACT GLINT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 폭발 중심에 아주 짧은 십자 광선을 넣어 카메라가 순간적으로
 * 노출된 것 같은 인상을 준다.
 */
function drawFinaleImpactGlint(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    session: HooWorldFireworksSession,
    size: CanvasSize,
) {
    const progress =
        getFinaleImpactProgress(
            scene,
            now,
            720,
        );

    if (
        progress < 0 ||
        progress > 1
    ) {
        return;
    }

    const envelope =
        smoothstep(
            0,
            0.035,
            progress,
        ) *
        (
            1 -
            smoothstep(
                0.1,
                1,
                progress,
            )
        );

    const centerX =
        clamp(
            session.x /
            100 *
            size.width,
            size.width *
                0.3,
            size.width *
                0.7,
        );

    const centerY =
        size.height *
        0.15;

    const scale =
        getCanvasScale(
            size,
        );

    const horizontalLength =
        scale *
        (
            0.16 +
            easeOutQuart(
                progress,
            ) *
                0.28
        );

    const verticalLength =
        horizontalLength *
        0.52;

    const alpha =
        envelope *
        0.48;

    context.save();

    context.globalCompositeOperation =
        "lighter";

    context.globalAlpha =
        alpha;

    context.strokeStyle =
        "#ffffff";

    context.lineWidth =
        Math.max(
            0.7,
            scale *
            0.0011,
        );

    context.shadowColor =
        "#fff0d0";

    context.shadowBlur =
        scale *
        0.02;

    context.beginPath();

    context.moveTo(
        centerX -
            horizontalLength,
        centerY,
    );

    context.lineTo(
        centerX +
            horizontalLength,
        centerY,
    );

    context.moveTo(
        centerX,
        centerY -
            verticalLength,
    );

    context.lineTo(
        centerX,
        centerY +
            verticalLength,
    );

    context.stroke();

    context.restore();
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * FINAL IMPACT RENDER PIPELINE
 * ─────────────────────────────────────────────────────────────────────────────
 */

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * MASTER CANOPY OUTLINE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 최종 폭발의 크기를 한눈에 느끼게 만드는 아주 얇은 외곽선.
 *
 * 완전한 원을 그리지 않고 arc를 여러 조각으로 나눠
 * 실제 불꽃의 윤곽이 끊어지며 이어지는 것처럼 표현한다.
 */
function drawFinaleCanopyOutline(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    session: HooWorldFireworksSession,
    size: CanvasSize,
) {
    const progress =
        getFinaleImpactProgress(
            scene,
            now,
            3400,
        );

    if (
        progress < 0 ||
        progress > 1
    ) {
        return;
    }

    const centerX =
        clamp(
            session.x /
            100 *
            size.width,
            size.width *
                0.3,
            size.width *
                0.7,
        );

    const centerY =
        size.height *
        0.15;

    const scale =
        getCanvasScale(
            size,
        );

    const envelope =
        smoothstep(
            0,
            0.08,
            progress,
        ) *
        (
            1 -
            smoothstep(
                0.34,
                1,
                progress,
            )
        );

    const baseRadius =
        scale *
        (
            0.12 +
            easeOutQuart(
                progress,
            ) *
                0.31
        );

    const colors = [
        "#fffdf7",
        "#ffe5b1",
        "#ffd4e5",
        "#e9ddff",
    ] as const;

    const segmentCount =
        18;

    for (
        let layer = 0;
        layer < colors.length;
        layer += 1
    ) {
        const layerRadius =
            baseRadius *
            (
                0.88 +
                layer *
                    0.055
            );

        const layerAlpha =
            envelope *
            (
                0.16 -
                layer *
                    0.025
            );

        for (
            let segment = 0;
            segment < segmentCount;
            segment += 1
        ) {
            if (
                (
                    segment +
                    layer
                ) %
                5 ===
                0
            ) {
                continue;
            }

            const segmentAngle =
                TWO_PI /
                segmentCount;

            const startAngle =
                segment *
                segmentAngle +
                layer *
                    0.027 +
                progress *
                    (
                        0.08 +
                        layer *
                            0.018
                    );

            const endAngle =
                startAngle +
                segmentAngle *
                    (
                        0.54 +
                        (
                            segment %
                            3
                        ) *
                            0.08
                    );

            context.save();

            context.globalCompositeOperation =
                "lighter";

            context.globalAlpha =
                layerAlpha *
                (
                    0.7 +
                    (
                        segment %
                        4
                    ) *
                        0.07
                );

            context.strokeStyle =
                colors[
                    layer
                ];

            context.lineWidth =
                Math.max(
                    0.55,
                    scale *
                    (
                        0.00085 -
                        layer *
                            0.0001
                    ),
                );

            context.lineCap =
                "round";

            context.shadowColor =
                colors[
                    layer
                ];

            context.shadowBlur =
                scale *
                (
                    0.007 +
                    layer *
                        0.002
                );

            context.beginPath();

            context.arc(
                centerX,
                centerY,
                layerRadius,
                startAngle,
                endAngle,
            );

            context.stroke();

            context.restore();
        }
    }
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * WHITE RAIN LIGHT CURTAIN
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 하얀 별비 뒤쪽에 거의 보이지 않을 정도의 세로 빛막을 깐다.
 * 밝은 점만 떨어질 때보다 "빛이 흘러내리는" 느낌이 강해진다.
 */
function drawFinaleWhiteRainLightCurtain(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    size: CanvasSize,
) {
    const timing =
        scene.finaleTiming;

    if (
        now <
            timing.whiteRainStartsAt ||
        now >
            timing.whiteRainEndsAt
    ) {
        return;
    }

    const progress =
        clamp01(
            (
                now -
                timing.whiteRainStartsAt
            ) /
            Math.max(
                1,
                timing.whiteRainEndsAt -
                    timing.whiteRainStartsAt,
            ),
        );

    const envelope =
        smoothstep(
            0,
            0.08,
            progress,
        ) *
        (
            1 -
            smoothstep(
                0.78,
                1,
                progress,
            )
        );

    const bandCount =
        16;

    for (
        let index = 0;
        index < bandCount;
        index += 1
    ) {
        const normalized =
            (
                index +
                0.5
            ) /
            bandCount;

        const centerBias =
            1 -
            Math.abs(
                normalized -
                0.5
            ) *
                1.65;

        const x =
            normalized *
            size.width +
            Math.sin(
                progress *
                TWO_PI *
                0.72 +
                index *
                    0.83,
            ) *
                size.width *
                0.012;

        const width =
            size.width *
            (
                0.025 +
                centerBias *
                    0.018
            );

        const top =
            size.height *
            (
                0.08 +
                (
                    index %
                    4
                ) *
                    0.025
            );

        const bottom =
            size.height *
            (
                0.72 +
                centerBias *
                    0.2
            );

        const gradient =
            context.createLinearGradient(
                x,
                top,
                x,
                bottom,
            );

        gradient.addColorStop(
            0,
            "rgba(255,255,255,0)",
        );

        gradient.addColorStop(
            0.16,
            `rgba(255,248,234, ${0.012 * envelope * centerBias})`,
        );

        gradient.addColorStop(
            0.48,
            `rgba(255,255,255, ${0.02 * envelope * centerBias})`,
        );

        gradient.addColorStop(
            0.82,
            `rgba(238,231,255, ${0.008 * envelope * centerBias})`,
        );

        gradient.addColorStop(
            1,
            "rgba(255,255,255,0)",
        );

        context.save();

        context.globalCompositeOperation =
            "screen";

        context.fillStyle =
            gradient;

        context.fillRect(
            x -
                width /
                    2,
            top,
            width,
            bottom -
                top,
        );

        context.restore();
    }
}

function drawFinaleImpactSequence(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    session: HooWorldFireworksSession,
    size: CanvasSize,
) {
    drawFinaleFullScreenExposure(
        context,
        scene,
        now,
        size,
    );

    drawFinaleGroundLightBounce(
        context,
        scene,
        now,
        size,
    );

    drawFinaleCoreBlast(
        context,
        scene,
        now,
        session,
        size,
    );

    drawFinaleImpactGlint(
        context,
        scene,
        now,
        session,
        size,
    );

    drawFinaleImpactShards(
        context,
        scene,
        now,
        session,
        size,
    );

    drawFinaleShockwaves(
        context,
        scene,
        now,
        session,
        size,
    );

    drawFinaleMasterHalo(
        context,
        scene,
        now,
        session,
        size,
    );
}


function renderSuccessFrame(
    context: CanvasRenderingContext2D,
    scene: FireworksScene,
    now: number,
    session: HooWorldFireworksSession,
    size: CanvasSize,
) {
    /*
     * ───────────────────────────────────────────────────────────────────────
     * 1. 기본 축제 분위기
     * ───────────────────────────────────────────────────────────────────────
     */
    drawActiveSkyWash(
        context,
        now,
        session,
        size,
    );

    drawFestivalBokeh(
        context,
        scene,
        now,
        session,
        size,
    );

    drawReflectionGlows(
        context,
        scene,
        now,
        session,
        size,
    );

    drawFuse(
        context,
        now,
        session,
        size,
    );

    /*
     * ───────────────────────────────────────────────────────────────────────
     * 2. 일반 로켓 / 일반 폭죽
     * ───────────────────────────────────────────────────────────────────────
     *
     * master_finale만 이 단계에서 제외한다.
     */
    drawRegularRockets(
        context,
        scene,
        now,
        size,
    );

    drawBurstSmokeVeil(
        context,
        scene,
        now,
        size,
    );

    /*
     * 윤곽 뒤로 흩날리는 작은 입자를 메인 burst보다 먼저 그린다.
     * 그래서 실제로 "뒤에 남는" 레이어처럼 보인다.
     */
    drawOutlineScatter(
        context,
        scene,
        now,
        size,
    );

    drawRegularBursts(
        context,
        scene,
        now,
        size,
    );

    drawSenrinBlooms(
        context,
        scene,
        now,
        size,
    );

    drawPearlCrossFlares(
        context,
        scene,
        now,
        size,
    );

    drawExposureBloom(
        context,
        scene,
        now,
        size,
    );

    /*
     * ───────────────────────────────────────────────────────────────────────
     * 3. 피날레 직전 암전
     * ───────────────────────────────────────────────────────────────────────
     *
     * 이 오버레이는 앞에서 그린 일반 불꽃뿐 아니라 투명 canvas 아래의
     * HOO WORLD 배경까지 함께 어둡게 보이게 만든다.
     */
    drawPreFinaleDarkness(
        context,
        scene,
        now,
        size,
    );

    /*
     * 암전 안에서 아주 작은 별점과 중앙 로켓만 남는다.
     */
    drawFinaleMicroStars(
        context,
        scene,
        now,
        size,
    );

    drawMasterFinaleRocket(
        context,
        scene,
        now,
        size,
    );

    /*
     * ───────────────────────────────────────────────────────────────────────
     * 4. 최종 폭발
     * ───────────────────────────────────────────────────────────────────────
     *
     * 연기는 뒤쪽,
     * afterimage는 메인 파티클 뒤쪽,
     * master burst는 그 위,
     * shockwave / flash는 가장 위에 순서대로 올린다.
     */
    drawFinaleSmokeClouds(
        context,
        scene,
        now,
        size,
    );

    drawMasterFinaleParticleAfterimages(
        context,
        scene,
        now,
        size,
    );

    drawMasterFinaleBurst(
        context,
        scene,
        now,
        size,
    );

    drawFinaleCanopyOutline(
        context,
        scene,
        now,
        session,
        size,
    );

    drawFinaleImpactSequence(
        context,
        scene,
        now,
        session,
        size,
    );

    drawFinaleHaloRings(
        context,
        now,
        session,
        size,
    );

    /*
     * ───────────────────────────────────────────────────────────────────────
     * 5. 폭발 이후의 긴 여운
     * ───────────────────────────────────────────────────────────────────────
     */
    drawFinaleAfterglowVeil(
        context,
        scene,
        now,
        size,
    );

    drawNiagaraCurtain(
        context,
        scene,
        now,
        session,
        size,
    );

    drawGlitter(
        context,
        scene,
        now,
        session,
        size,
    );

    drawSakuraAfterglow(
        context,
        scene,
        now,
        session,
        size,
    );

    drawFinaleWhiteRainLightCurtain(
        context,
        scene,
        now,
        size,
    );

    /*
     * 마지막 최상단에는 흰 별비.
     * 다른 모든 잔광보다 밝게 보이게 해 감동적인 마무리를 만든다.
     */
    drawFinaleWhiteRain(
        context,
        scene,
        now,
        size,
    );
}

function renderFailureFrame(context: CanvasRenderingContext2D, now: number, session: HooWorldFireworksSession, size: CanvasSize) {
    drawActiveSkyWash(context, now, session, size);
    drawFuse(context, now, session, size);
    drawFailure(context, now, session, size);
}
function renderFireworksFrame(context: CanvasRenderingContext2D, scene: FireworksScene, now: number, session: HooWorldFireworksSession, size: CanvasSize) {
    clearCanvas(context, size);
    applyCanvasScale(context, size);
    if (session.outcome ===
        "success") {
        renderSuccessFrame(context, scene, now, session, size);
        return;
    }
    renderFailureFrame(context, now, session, size);
}
/*
 * ─────────────────────────────────────────────────────────────────────────────
 * ADAPTIVE FRAME PACING
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 실제로 감동이 필요한 일반 폭발 / 암전 / 최종 폭발 구간은 60fps 유지.
 * 최종 폭발이 끝난 뒤 긴 흰 별비 / 잔광 구간만 48fps로 줄인다.
 *
 * 즉, "퀄리티를 깎아서 최적화"가 아니라
 * 눈으로 거의 구분되지 않는 긴 afterglow 구간의 불필요한 draw 횟수만 줄인다.
 */
function getFireworksFrameIntervalMs(
    now: number,
    scene: FireworksScene,
    session: HooWorldFireworksSession,
) {
    if (
        now <
            session.startedAt ||
        now >
            session.endsAt
    ) {
        return HOO_WORLD_FIREWORKS_IDLE_FRAME_INTERVAL_MS;
    }

    if (
        session.outcome ===
        "failure"
    ) {
        return HOO_WORLD_FIREWORKS_FULL_FRAME_INTERVAL_MS;
    }

    /*
     * 암전 → 최종 펑 → 충격파 구간만 60fps.
     * 감동의 핵심 장면은 그대로 매끄럽게 유지한다.
     */
    const impactHighFrameStartAt =
        scene.finaleTiming.impactAt -
            180;

    const impactHighFrameEndsAt =
        scene.finaleTiming.impactAt +
            950;

    if (
        now >=
            impactHighFrameStartAt &&
        now <=
            impactHighFrameEndsAt
    ) {
        return HOO_WORLD_FIREWORKS_IMPACT_FRAME_INTERVAL_MS;
    }

    const afterglowStartsAt =
        Math.max(
            scene.finaleTiming.whiteRainStartsAt +
                1200,
            scene.finaleTiming.shockwaveEndsAt +
                350,
        );

    if (
        now >=
            afterglowStartsAt
    ) {
        return HOO_WORLD_FIREWORKS_AFTERGLOW_FRAME_INTERVAL_MS;
    }

    return HOO_WORLD_FIREWORKS_FULL_FRAME_INTERVAL_MS;
}

type HooWorldFireworksShowProps = {
    session: HooWorldFireworksSession;
};
export default function HooWorldFireworksShow({ session, }: HooWorldFireworksShowProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const frameRef = useRef<number | null>(null);
    const sizeRef = useRef<CanvasSize>({
        width: 1,
        height: 1,
        dpr: 1,
        scale: 1,
    });
    const scene = useMemo(() => createFireworksScene(session), [
        session,
    ]);
    useEffect(() => {
        const canvas =
            canvasRef.current;

        if (
            !canvas
        ) {
            return;
        }

        const context =
            canvas.getContext(
                "2d",
                {
                    alpha:
                        true,
                    desynchronized:
                        true,
                },
            );

        if (
            !context
        ) {
            return;
        }

        /*
         * null 체크 이후의 확정 타입을 중첩 콜백에서도 그대로 유지한다.
         */
        const canvasElement: HTMLCanvasElement =
            canvas;

        const renderContext: CanvasRenderingContext2D =
            context;

        let disposed =
            false;

        let isCanvasVisible =
            true;

        let isDocumentVisible =
            document.visibilityState !==
            "hidden";

        let lastPaintTimestamp =
            0;

        function refreshSize() {
            const rect =
                canvasElement.getBoundingClientRect();

            const next =
                normalizeCanvasSize(
                    rect.width,
                    rect.height,
                );

            const current =
                sizeRef.current;

            /*
             * ResizeObserver가 같은 크기를 여러 번 알려도
             * 실제 canvas resize는 생략한다.
             * canvas.width/height 변경은 내부 버퍼를 초기화하므로
             * 불필요하게 호출하지 않는 것이 중요하다.
             */
            if (
                Math.abs(
                    current.width -
                    next.width,
                ) <
                    0.5 &&
                Math.abs(
                    current.height -
                    next.height,
                ) <
                    0.5 &&
                Math.abs(
                    current.dpr -
                    next.dpr,
                ) <
                    0.01
            ) {
                return;
            }

            sizeRef.current =
                next;

            resizeCanvas(
                canvasElement,
                next,
            );
        }

        function canRender() {
            return (
                !disposed &&
                isCanvasVisible &&
                isDocumentVisible
            );
        }

        function scheduleRender() {
            if (
                !canRender() ||
                frameRef.current !==
                    null
            ) {
                return;
            }

            frameRef.current =
                window.requestAnimationFrame(
                    render,
                );
        }

        function render(
            animationTimestamp: number,
        ) {
            frameRef.current =
                null;

            if (
                !canRender()
            ) {
                return;
            }

            const now =
                Date.now();

            const targetInterval =
                getFireworksFrameIntervalMs(
                    now,
                    scene,
                    session,
                );

            const shouldPaint =
                lastPaintTimestamp ===
                    0 ||
                animationTimestamp -
                    lastPaintTimestamp >=
                    targetInterval;

            if (
                shouldPaint
            ) {
                renderFireworksFrame(
                    renderContext,
                    scene,
                    now,
                    session,
                    sizeRef.current,
                );

                lastPaintTimestamp =
                    animationTimestamp;
            }

            if (
                now <=
                session.endsAt +
                    250
            ) {
                scheduleRender();
            }
        }

        function handleVisibilityChange() {
            isDocumentVisible =
                document.visibilityState !==
                "hidden";

            if (
                isDocumentVisible
            ) {
                /*
                 * 복귀 즉시 현재 wall-clock 시점으로 한 프레임을 그린다.
                 * 백그라운드에서 프레임을 계속 계산하지 않아도
                 * Realtime 세션 타임라인은 정확히 이어진다.
                 */
                lastPaintTimestamp =
                    0;

                scheduleRender();
            }
        }

        refreshSize();

        const resizeObserver =
            typeof ResizeObserver !==
                "undefined"
                ? new ResizeObserver(
                    () => {
                        refreshSize();
                    },
                )
                : null;

        resizeObserver?.observe(
            canvasElement,
        );

        /*
         * HOO WORLD 화면 밖으로 완전히 벗어난 canvas는
         * rAF 루프 자체를 멈춘다.
         *
         * rootMargin을 둬 화면 근처로 돌아오기 조금 전에 다시 켜기 때문에
         * 사용자가 보게 되는 첫 프레임이 늦어지지 않는다.
         */
        const intersectionObserver =
            typeof IntersectionObserver !==
                "undefined"
                ? new IntersectionObserver(
                    (
                        entries,
                    ) => {
                        const entry =
                            entries[
                                0
                            ];

                        isCanvasVisible =
                            !entry ||
                            entry.isIntersecting;

                        if (
                            isCanvasVisible
                        ) {
                            lastPaintTimestamp =
                                0;

                            scheduleRender();
                        }
                    },
                    {
                        root:
                            null,
                        rootMargin:
                            "180px",
                        threshold:
                            0,
                    },
                )
                : null;

        intersectionObserver?.observe(
            canvasElement,
        );

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange,
        );

        scheduleRender();

        return () => {
            disposed =
                true;

            resizeObserver?.disconnect();

            intersectionObserver?.disconnect();

            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );

            if (
                frameRef.current !==
                null
            ) {
                window.cancelAnimationFrame(
                    frameRef.current,
                );

                frameRef.current =
                    null;
            }

            renderContext.clearRect(
                0,
                0,
                canvasElement.width,
                canvasElement.height,
            );
        };
    }, [
        scene,
        session,
    ]);
    return (<div data-hoo-world-fireworks-show="true" data-hoo-world-fireworks-session-id={session.sessionId} data-hoo-world-fireworks-outcome={session.outcome} className="pointer-events-none absolute inset-0 z-[46] overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full"/>

      <div className="absolute inset-x-0 top-0 h-[46%] opacity-0" style={{
            animation: session.outcome ===
                "success"
                ? `hooWorldFireworksRomanticSky ${Math.max(1800, session.glitterEndsAt -
                    session.fuseEndsAt)}ms ease-out ${session.fuseEndsAt - Date.now()}ms both`
                : "none",
        }}/>

      <style>{`
        @keyframes hooWorldFireworksRomanticSky {
          0% {
            opacity: 0;
            background:
              radial-gradient(
                circle at 50% 24%,
                rgba(255, 245, 221, 0) 0%,
                rgba(255, 214, 230, 0) 45%,
                rgba(218, 203, 255, 0) 72%
              );
          }

          10% {
            opacity: 1;
            background:
              radial-gradient(
                circle at 50% 24%,
                rgba(255, 245, 221, 0.08) 0%,
                rgba(255, 214, 230, 0.055) 45%,
                rgba(218, 203, 255, 0.035) 72%
              );
          }

          76% {
            opacity: 0.9;
            background:
              radial-gradient(
                circle at 50% 24%,
                rgba(255, 245, 221, 0.075) 0%,
                rgba(255, 214, 230, 0.05) 45%,
                rgba(218, 203, 255, 0.03) 72%
              );
          }

          100% {
            opacity: 0;
            background:
              radial-gradient(
                circle at 50% 24%,
                rgba(255, 245, 221, 0) 0%,
                rgba(255, 214, 230, 0) 45%,
                rgba(218, 203, 255, 0) 72%
              );
          }
        }
      `}</style>
    </div>);
}

"use client";

import { memo, useId, type CSSProperties } from "react";
import styles from "./HooMusicCommunity.module.css";
import {
  clamp,
  formatDuration,
  getRecordCatalogNumber,
  type MusicPalette,
  type MusicPick,
} from "./hooMusicCommunityVisuals";

export type HooTurntableProps = {
  pick: MusicPick | null;
  palette: MusicPalette;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  compact?: boolean;
  decorative?: boolean;
};

/** Light stays in world space; only the physical groove surface and label rotate. */
export const VinylRecord = memo(function VinylRecord({
  isPlaying = false,
}: {
  isPlaying?: boolean;
}) {
  return (
    <div className={styles.recordRim} aria-hidden="true">
      <div className={styles.recordDisc}>
        <div className={styles.recordRotating} data-spinning={isPlaying}>
          <div className={styles.recordGrooves} />
          <div className={styles.recordDust} />
          <div className={styles.recordLabel}>
            <span className={styles.labelBrand}>HOO</span>
            <span className={styles.labelScript}>
              Music
              <br />
              Connects Us
            </span>
            <span className={styles.labelEdition}>SIDE A · 33⅓ RPM</span>
            <span className={styles.labelHole} />
          </div>
        </div>
        <div className={styles.recordWarmReflection} />
        <div className={styles.recordPurpleReflection} />
        <div className={styles.recordEdge} />
        <span className={styles.recordSpindle} />
      </div>
    </div>
  );
});

/** A layered metal arm, with an independent pivot for cueing and tracking. */
export const ToneArm = memo(function ToneArm({
  engaged,
  progress = 0,
}: {
  engaged: boolean;
  progress?: number;
}) {
  const id = useId().replace(/:/g, "");
  const metal = `${id}-metal`;
  const blackMetal = `${id}-black`;
  const cap = `${id}-cap`;
  return (
    <svg
      className={styles.toneArm}
      viewBox="0 0 800 720"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={metal}
          x1="650"
          y1="160"
          x2="671"
          y2="169"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#120f0e" />
          <stop offset=".18" stopColor="#81441e" />
          <stop offset=".31" stopColor="#f3c789" />
          <stop offset=".42" stopColor="#fff8d7" />
          <stop offset=".52" stopColor="#845236" />
          <stop offset=".71" stopColor="#201b19" />
          <stop offset=".89" stopColor="#8d6344" />
          <stop offset="1" stopColor="#f6bb70" />
        </linearGradient>
        <linearGradient id={blackMetal} x1="0" x2="1">
          <stop stopColor="#080909" />
          <stop offset=".24" stopColor="#41342a" />
          <stop offset=".48" stopColor="#070909" />
          <stop offset=".8" stopColor="#291e18" />
          <stop offset="1" stopColor="#d38d48" />
        </linearGradient>
        <radialGradient id={cap} cx="30%" cy="21%">
          <stop stopColor="#ce8f51" />
          <stop offset=".24" stopColor="#443329" />
          <stop offset=".72" stopColor="#080b0c" />
          <stop offset=".94" stopColor="#201811" />
          <stop offset="1" stopColor="#e4ae6e" />
        </radialGradient>
      </defs>
      <ellipse cx="685" cy="164" rx="49" ry="43" fill="#000" opacity=".5" />
      <circle
        cx="682"
        cy="144"
        r="45"
        fill={`url(#${cap})`}
        stroke="#3c2517"
        strokeWidth="2"
      />
      <circle
        cx="682"
        cy="144"
        r="32"
        fill="#121313"
        stroke="#b07742"
        strokeWidth="2"
      />
      <circle cx="682" cy="144" r="23" fill={`url(#${cap})`} />
      <g
        className={styles.toneArmMoving}
        style={
          {
            "--arm-angle": `${engaged ? 0 + clamp(progress, 0, 1) * 8 : -24}deg`,
          } as CSSProperties
        }
      >
        <g transform="rotate(19 682 144)">
          <rect
            x="666"
            y="51"
            width="32"
            height="61"
            rx="9"
            fill={`url(#${blackMetal})`}
            stroke="#b87a42"
            strokeWidth="1.4"
          />
          <path d="M673 55v53M693 55v53" stroke="#f8d69b" strokeOpacity=".65" />
          <path d="M666 62h32M666 101h32" stroke="#100c0a" strokeWidth="3" />
        </g>
        <path
          d="M689 118 599 400Q597 408 589 418L565 448"
          stroke="#000"
          strokeWidth="20"
          strokeLinecap="round"
          opacity=".5"
          transform="translate(5 8)"
        />
        <path
          d="M682 115 592 397Q590 405 583 414L559 445"
          stroke="#160e09"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M682 115 592 397Q590 405 583 414L559 445"
          stroke={`url(#${metal})`}
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M680 117 590 397Q588 404 581 413L557 444"
          stroke="#fff1c8"
          strokeOpacity=".65"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle
          cx="682"
          cy="144"
          r="10"
          fill={`url(#${blackMetal})`}
          stroke="#ddad73"
        />
        <g transform="rotate(32 560 450)">
          <rect
            x="551"
            y="422"
            width="18"
            height="29"
            rx="3"
            fill={`url(#${blackMetal})`}
            stroke="#c28748"
          />
          <path
            d="M540 447h40v64l-7 7h-27l-6-7z"
            fill="#000"
            opacity=".45"
            transform="translate(5 7)"
          />
          <path
            d="M538 444h42v65l-7 7h-28l-7-7z"
            fill={`url(#${blackMetal})`}
            stroke="#a86c35"
            strokeWidth="1.5"
          />
          <path d="M542 448v57" stroke="#f0bd78" strokeWidth="1.4" />
          <path d="M548 515v17h20v-17" fill="#a17248" stroke="#38241a" />
          <path d="M557 532v5" stroke="#faf1d9" strokeWidth="2" />
          <circle cx="547" cy="461" r="2.5" fill="#cf9b5d" />
          <circle cx="571" cy="461" r="2.5" fill="#cf9b5d" />
          <circle cx="547" cy="494" r="2.5" fill="#cf9b5d" />
          <circle cx="571" cy="494" r="2.5" fill="#cf9b5d" />
          <path
            d="m579 456 20-5v24"
            stroke="#ce9552"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
});

export function PosterFoliage() {
  return (
    <svg
      className={styles.posterFoliage}
      viewBox="0 0 500 500"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="#786333" strokeWidth="2">
        <path d="M44 510Q171 270 27 98M51 503Q286 328 154 207M123 518Q270 385 359 404M391 512Q337 358 499 290" />
      </g>
      <g fill="#66572c">
        <path d="M78 281Q-7 260 5 194Q62 207 78 281M90 338Q160 258 165 230Q108 250 90 338M46 167Q-2 139 0 105Q49 116 46 167M112 419Q211 391 210 335Q142 345 112 419M214 466Q275 406 310 406Q300 455 214 466M422 386Q449 318 484 331Q472 377 422 386M407 432Q339 410 346 363Q395 377 407 432" />
      </g>
      <g fill="#a28049" opacity=".32">
        <path d="M89 339Q148 279 165 230Q140 287 89 339M114 416Q170 390 208 339Q184 399 114 416M45 165Q9 139 0 105Q28 139 45 165" />
      </g>
    </svg>
  );
}

export default function HooTurntable({
  pick,
  palette,
  isPlaying,
  currentTime,
  duration,
  onSeek,
  compact = false,
  decorative = false,
}: HooTurntableProps) {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const time = clamp(currentTime, 0, safeDuration);
  const progress = safeDuration > 0 ? time / safeDuration : 0;
  const style = {
    "--music-accent": palette.accent,
    "--music-accent-soft": palette.accentSoft,
    "--music-accent-deep": palette.accentDeep,
    "--music-warm": palette.warm,
    "--music-warm-soft": palette.warmSoft,
  } as CSSProperties;
  return (
    <div
      className={`${styles.turntableStage} ${compact ? styles.turntableCompact : ""}`}
      style={style}
    >
      <div className={styles.deckScene} aria-hidden="true">
        <div className={styles.deckShadow} />
        <div className={styles.deckBody}>
          <span className={styles.deckGrain} />
          <span className={styles.deckSheen} />
          <div className={styles.speedKnob}>
            <span />
          </div>
          <div className={styles.speedNumbers}>
            <span>33</span>
            <span>45</span>
          </div>
          <div className={styles.deckManifesto}>
            GOOD
            <br />
            MUSIC
            <br />
            BETTER
            <br />
            PEOPLE
          </div>
          <span className={styles.deckCatalog}>
            {getRecordCatalogNumber(pick)}
          </span>
          <span className={styles.deckPower} data-on={isPlaying} />
        </div>
        <div className={styles.deckRecord}>
          <VinylRecord isPlaying={isPlaying} />
        </div>
        <ToneArm engaged={isPlaying} progress={progress} />
      </div>
      {!compact && !decorative && (
        <div className={styles.recordCaption}>
          <h3 className={styles.currentTitle}>
            {pick?.title ?? "어떤 음악으로 채워볼까요?"}
          </h3>
          <p className={styles.currentByline}>
            {pick ? pick.nickname : "당신의 오늘을 닮은 한 곡"}
          </p>
          <div className={styles.seekArea}>
            <input
              className={styles.seekSlider}
              type="range"
              min={0}
              max={safeDuration || 1}
              step={0.1}
              value={time}
              onChange={(event) => onSeek(Number(event.target.value))}
              disabled={!pick || safeDuration <= 0}
              aria-label="재생 위치"
              aria-valuetext={`${formatDuration(time)} / ${formatDuration(safeDuration)}`}
              style={
                { "--range-progress": `${progress * 100}%` } as CSSProperties
              }
            />
            <div className={styles.seekTimes}>
              <span>{formatDuration(time)}</span>
              <span>{formatDuration(safeDuration)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

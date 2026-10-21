"use client";

import {
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

type LaneKey = "A" | "K";
type Difficulty = "easy" | "normal" | "hard";
type Screen = "home" | "select" | "detail" | "play" | "result" | "editor";
type Judgment = "PERFECT" | "GREAT" | "GOOD" | "MISS";
type EditorTool = "select" | "A" | "K";
type SnapDivision = 4 | 8 | 16 | 32;
type NoteListFilter = "all" | "A" | "K";
type NoteListScope = "nearby" | "all";

type RhythmNote = {
  id: string;
  time: number;
  lane: LaneKey;
  // duration > 0 이면 홀드 노트. 없으면 일반 탭 노트.
  duration?: number;
};

type Chart = {
  bpm: number;
  offset: number;
  notes: RhythmNote[];
  analyzedAt?: string;
};

type Song = {
  id: string;
  title: string;
  subtitle: string;
  duration: number;
  genre: string;
  bpm: number;
  coverUrl?: string;
};

type SongCoverAsset = {
  dataUrl: string;
  fileName: string;
  updatedAt: string;
};


type PublishedCharts = Record<Difficulty, Chart>;

type PublishedSongRow = {
  song_id: string;
  title: string;
  subtitle: string;
  genre: string;
  bpm: number;
  duration: number;
  audio_path: string;
  audio_url: string;
  cover_path: string | null;
  cover_url: string | null;
  charts: PublishedCharts;
  published: boolean;
  sort_order: number;
  published_by: string | null;
  published_at: string | null;
  updated_at: string;
};

type ResultStats = {
  score: number;
  maxCombo: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
};

type HooRhythmGameProps = {
  onExit: () => void;
  onRecordSaved?: () => void;
};

// ============================================================
// PLAY STAGE · VISUAL / IMPACT SYSTEM
// 플레이 화면은 편집기와 분리된 전용 렌더링 시스템을 사용한다.
// 프리셋 데이터는 정적이며 실제 DOM에는 필요한 일부만 렌더링한다.
// ============================================================

type PlayAmbientHue =
  | "cyan"
  | "violet"
  | "fuchsia";

type PlayAmbientPreset = {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
  driftX: number;
  driftY: number;
  hue: PlayAmbientHue;
};

type PlayImpactFx = {
  id: number;
  lane: LaneKey | null;
  judgment: Judgment;
  deltaMs: number;
  combo: number;
  createdAt: number;
};

const PLAY_STAR_PRESETS: PlayAmbientPreset[] = [
  {
    id: 0,
    x: 11.3,
    y: 7.9,
    size: 0.8,
    opacity: 0.12,
    delay: -0.0,
    duration: 3.2,
    driftX: -14.7,
    driftY: -14.95,
    hue: "cyan",
  },
  {
    id: 1,
    x: 48.47,
    y: 69.63,
    size: 2.1,
    opacity: 0.29,
    delay: -0.173,
    duration: 6.1,
    driftX: -1.4,
    driftY: 0.0,
    hue: "violet",
  },
  {
    id: 2,
    x: 85.64,
    y: 31.36,
    size: 3.4,
    opacity: 0.46,
    delay: -0.346,
    duration: 9.0,
    driftX: 11.9,
    driftY: 14.95,
    hue: "fuchsia",
  },
  {
    id: 3,
    x: 22.81,
    y: 93.09,
    size: 1.8,
    opacity: 0.63,
    delay: -0.519,
    duration: 11.9,
    driftX: -4.9,
    driftY: -0.65,
    hue: "cyan",
  },
  {
    id: 4,
    x: 59.98,
    y: 54.82,
    size: 3.1,
    opacity: 0.19,
    delay: -0.692,
    duration: 5.7,
    driftX: 8.4,
    driftY: 14.3,
    hue: "violet",
  },
  {
    id: 5,
    x: 97.15,
    y: 16.55,
    size: 1.5,
    opacity: 0.36,
    delay: -0.865,
    duration: 8.6,
    driftX: -8.4,
    driftY: -1.3,
    hue: "fuchsia",
  },
  {
    id: 6,
    x: 34.32,
    y: 78.28,
    size: 2.8,
    opacity: 0.53,
    delay: -1.038,
    duration: 11.5,
    driftX: 4.9,
    driftY: 13.65,
    hue: "cyan",
  },
  {
    id: 7,
    x: 71.49,
    y: 40.01,
    size: 1.2,
    opacity: 0.7,
    delay: -1.211,
    duration: 5.3,
    driftX: -11.9,
    driftY: -1.95,
    hue: "violet",
  },
  {
    id: 8,
    x: 8.66,
    y: 1.74,
    size: 2.5,
    opacity: 0.26,
    delay: -1.384,
    duration: 8.2,
    driftX: 1.4,
    driftY: 13.0,
    hue: "fuchsia",
  },
  {
    id: 9,
    x: 45.83,
    y: 63.47,
    size: 0.9,
    opacity: 0.43,
    delay: -1.557,
    duration: 11.1,
    driftX: 14.7,
    driftY: -2.6,
    hue: "cyan",
  },
  {
    id: 10,
    x: 83.0,
    y: 25.2,
    size: 2.2,
    opacity: 0.6,
    delay: -1.73,
    duration: 4.9,
    driftX: -2.1,
    driftY: 12.35,
    hue: "violet",
  },
  {
    id: 11,
    x: 20.17,
    y: 86.93,
    size: 3.5,
    opacity: 0.16,
    delay: -1.903,
    duration: 7.8,
    driftX: 11.2,
    driftY: -3.25,
    hue: "fuchsia",
  },
  {
    id: 12,
    x: 57.34,
    y: 48.66,
    size: 1.9,
    opacity: 0.33,
    delay: -2.076,
    duration: 10.7,
    driftX: -5.6,
    driftY: 11.7,
    hue: "cyan",
  },
  {
    id: 13,
    x: 94.51,
    y: 10.39,
    size: 3.2,
    opacity: 0.5,
    delay: -2.249,
    duration: 4.5,
    driftX: 7.7,
    driftY: -3.9,
    hue: "violet",
  },
  {
    id: 14,
    x: 31.68,
    y: 72.12,
    size: 1.6,
    opacity: 0.67,
    delay: -2.422,
    duration: 7.4,
    driftX: -9.1,
    driftY: 11.05,
    hue: "fuchsia",
  },
  {
    id: 15,
    x: 68.85,
    y: 33.85,
    size: 2.9,
    opacity: 0.23,
    delay: -2.595,
    duration: 10.3,
    driftX: 4.2,
    driftY: -4.55,
    hue: "cyan",
  },
  {
    id: 16,
    x: 6.02,
    y: 95.58,
    size: 1.3,
    opacity: 0.4,
    delay: -2.768,
    duration: 4.1,
    driftX: -12.6,
    driftY: 10.4,
    hue: "violet",
  },
  {
    id: 17,
    x: 43.19,
    y: 57.31,
    size: 2.6,
    opacity: 0.57,
    delay: -2.941,
    duration: 7.0,
    driftX: 0.7,
    driftY: -5.2,
    hue: "fuchsia",
  },
  {
    id: 18,
    x: 80.36,
    y: 19.04,
    size: 1.0,
    opacity: 0.13,
    delay: -3.114,
    duration: 9.9,
    driftX: 14.0,
    driftY: 9.75,
    hue: "cyan",
  },
  {
    id: 19,
    x: 17.53,
    y: 80.77,
    size: 2.3,
    opacity: 0.3,
    delay: -3.287,
    duration: 3.7,
    driftX: -2.8,
    driftY: -5.85,
    hue: "violet",
  },
  {
    id: 20,
    x: 54.7,
    y: 42.5,
    size: 3.6,
    opacity: 0.47,
    delay: -3.46,
    duration: 6.6,
    driftX: 10.5,
    driftY: 9.1,
    hue: "fuchsia",
  },
  {
    id: 21,
    x: 91.87,
    y: 4.23,
    size: 2.0,
    opacity: 0.64,
    delay: -3.633,
    duration: 9.5,
    driftX: -6.3,
    driftY: -6.5,
    hue: "cyan",
  },
  {
    id: 22,
    x: 29.04,
    y: 65.96,
    size: 3.3,
    opacity: 0.2,
    delay: -3.806,
    duration: 3.3,
    driftX: 7.0,
    driftY: 8.45,
    hue: "violet",
  },
  {
    id: 23,
    x: 66.21,
    y: 27.69,
    size: 1.7,
    opacity: 0.37,
    delay: -3.979,
    duration: 6.2,
    driftX: -9.8,
    driftY: -7.15,
    hue: "fuchsia",
  },
  {
    id: 24,
    x: 3.38,
    y: 89.42,
    size: 3.0,
    opacity: 0.54,
    delay: -4.152,
    duration: 9.1,
    driftX: 3.5,
    driftY: 7.8,
    hue: "cyan",
  },
  {
    id: 25,
    x: 40.55,
    y: 51.15,
    size: 1.4,
    opacity: 0.71,
    delay: -4.325,
    duration: 12.0,
    driftX: -13.3,
    driftY: -7.8,
    hue: "violet",
  },
  {
    id: 26,
    x: 77.72,
    y: 12.88,
    size: 2.7,
    opacity: 0.27,
    delay: -4.498,
    duration: 5.8,
    driftX: 0.0,
    driftY: 7.15,
    hue: "fuchsia",
  },
  {
    id: 27,
    x: 14.89,
    y: 74.61,
    size: 1.1,
    opacity: 0.44,
    delay: -4.671,
    duration: 8.7,
    driftX: 13.3,
    driftY: -8.45,
    hue: "cyan",
  },
  {
    id: 28,
    x: 52.06,
    y: 36.34,
    size: 2.4,
    opacity: 0.61,
    delay: -4.844,
    duration: 11.6,
    driftX: -3.5,
    driftY: 6.5,
    hue: "violet",
  },
  {
    id: 29,
    x: 89.23,
    y: 98.07,
    size: 0.8,
    opacity: 0.17,
    delay: -5.017,
    duration: 5.4,
    driftX: 9.8,
    driftY: -9.1,
    hue: "fuchsia",
  },
  {
    id: 30,
    x: 26.4,
    y: 59.8,
    size: 2.1,
    opacity: 0.34,
    delay: -5.19,
    duration: 8.3,
    driftX: -7.0,
    driftY: 5.85,
    hue: "cyan",
  },
  {
    id: 31,
    x: 63.57,
    y: 21.53,
    size: 3.4,
    opacity: 0.51,
    delay: -5.363,
    duration: 11.2,
    driftX: 6.3,
    driftY: -9.75,
    hue: "violet",
  },
  {
    id: 32,
    x: 0.74,
    y: 83.26,
    size: 1.8,
    opacity: 0.68,
    delay: -5.536,
    duration: 5.0,
    driftX: -10.5,
    driftY: 5.2,
    hue: "fuchsia",
  },
  {
    id: 33,
    x: 37.91,
    y: 44.99,
    size: 3.1,
    opacity: 0.24,
    delay: -5.709,
    duration: 7.9,
    driftX: 2.8,
    driftY: -10.4,
    hue: "cyan",
  },
  {
    id: 34,
    x: 75.08,
    y: 6.72,
    size: 1.5,
    opacity: 0.41,
    delay: -5.882,
    duration: 10.8,
    driftX: -14.0,
    driftY: 4.55,
    hue: "violet",
  },
  {
    id: 35,
    x: 12.25,
    y: 68.45,
    size: 2.8,
    opacity: 0.58,
    delay: -6.055,
    duration: 4.6,
    driftX: -0.7,
    driftY: -11.05,
    hue: "fuchsia",
  },
  {
    id: 36,
    x: 49.42,
    y: 30.18,
    size: 1.2,
    opacity: 0.14,
    delay: -6.228,
    duration: 7.5,
    driftX: 12.6,
    driftY: 3.9,
    hue: "cyan",
  },
  {
    id: 37,
    x: 86.59,
    y: 91.91,
    size: 2.5,
    opacity: 0.31,
    delay: -6.401,
    duration: 10.4,
    driftX: -4.2,
    driftY: -11.7,
    hue: "violet",
  },
  {
    id: 38,
    x: 23.76,
    y: 53.64,
    size: 0.9,
    opacity: 0.48,
    delay: -6.574,
    duration: 4.2,
    driftX: 9.1,
    driftY: 3.25,
    hue: "fuchsia",
  },
  {
    id: 39,
    x: 60.93,
    y: 15.37,
    size: 2.2,
    opacity: 0.65,
    delay: -6.747,
    duration: 7.1,
    driftX: -7.7,
    driftY: -12.35,
    hue: "cyan",
  },
  {
    id: 40,
    x: 98.1,
    y: 77.1,
    size: 3.5,
    opacity: 0.21,
    delay: -6.92,
    duration: 10.0,
    driftX: 5.6,
    driftY: 2.6,
    hue: "violet",
  },
  {
    id: 41,
    x: 35.27,
    y: 38.83,
    size: 1.9,
    opacity: 0.38,
    delay: -7.093,
    duration: 3.8,
    driftX: -11.2,
    driftY: -13.0,
    hue: "fuchsia",
  },
  {
    id: 42,
    x: 72.44,
    y: 0.56,
    size: 3.2,
    opacity: 0.55,
    delay: -7.266,
    duration: 6.7,
    driftX: 2.1,
    driftY: 1.95,
    hue: "cyan",
  },
  {
    id: 43,
    x: 9.61,
    y: 62.29,
    size: 1.6,
    opacity: 0.72,
    delay: -7.439,
    duration: 9.6,
    driftX: -14.7,
    driftY: -13.65,
    hue: "violet",
  },
  {
    id: 44,
    x: 46.78,
    y: 24.02,
    size: 2.9,
    opacity: 0.28,
    delay: -7.612,
    duration: 3.4,
    driftX: -1.4,
    driftY: 1.3,
    hue: "fuchsia",
  },
  {
    id: 45,
    x: 83.95,
    y: 85.75,
    size: 1.3,
    opacity: 0.45,
    delay: -7.785,
    duration: 6.3,
    driftX: 11.9,
    driftY: -14.3,
    hue: "cyan",
  },
  {
    id: 46,
    x: 21.12,
    y: 47.48,
    size: 2.6,
    opacity: 0.62,
    delay: -7.958,
    duration: 9.2,
    driftX: -4.9,
    driftY: 0.65,
    hue: "violet",
  },
  {
    id: 47,
    x: 58.29,
    y: 9.21,
    size: 1.0,
    opacity: 0.18,
    delay: -8.131,
    duration: 12.1,
    driftX: 8.4,
    driftY: -14.95,
    hue: "fuchsia",
  },
  {
    id: 48,
    x: 95.46,
    y: 70.94,
    size: 2.3,
    opacity: 0.35,
    delay: -8.304,
    duration: 5.9,
    driftX: -8.4,
    driftY: 0.0,
    hue: "cyan",
  },
  {
    id: 49,
    x: 32.63,
    y: 32.67,
    size: 3.6,
    opacity: 0.52,
    delay: -8.477,
    duration: 8.8,
    driftX: 4.9,
    driftY: 14.95,
    hue: "violet",
  },
  {
    id: 50,
    x: 69.8,
    y: 94.4,
    size: 2.0,
    opacity: 0.69,
    delay: -8.65,
    duration: 11.7,
    driftX: -11.9,
    driftY: -0.65,
    hue: "fuchsia",
  },
  {
    id: 51,
    x: 6.97,
    y: 56.13,
    size: 3.3,
    opacity: 0.25,
    delay: -8.823,
    duration: 5.5,
    driftX: 1.4,
    driftY: 14.3,
    hue: "cyan",
  },
  {
    id: 52,
    x: 44.14,
    y: 17.86,
    size: 1.7,
    opacity: 0.42,
    delay: -8.996,
    duration: 8.4,
    driftX: 14.7,
    driftY: -1.3,
    hue: "violet",
  },
  {
    id: 53,
    x: 81.31,
    y: 79.59,
    size: 3.0,
    opacity: 0.59,
    delay: -9.169,
    duration: 11.3,
    driftX: -2.1,
    driftY: 13.65,
    hue: "fuchsia",
  },
  {
    id: 54,
    x: 18.48,
    y: 41.32,
    size: 1.4,
    opacity: 0.15,
    delay: -0.142,
    duration: 5.1,
    driftX: 11.2,
    driftY: -1.95,
    hue: "cyan",
  },
  {
    id: 55,
    x: 55.65,
    y: 3.05,
    size: 2.7,
    opacity: 0.32,
    delay: -0.315,
    duration: 8.0,
    driftX: -5.6,
    driftY: 13.0,
    hue: "violet",
  },
  {
    id: 56,
    x: 92.82,
    y: 64.78,
    size: 1.1,
    opacity: 0.49,
    delay: -0.488,
    duration: 10.9,
    driftX: 7.7,
    driftY: -2.6,
    hue: "fuchsia",
  },
  {
    id: 57,
    x: 29.99,
    y: 26.51,
    size: 2.4,
    opacity: 0.66,
    delay: -0.661,
    duration: 4.7,
    driftX: -9.1,
    driftY: 12.35,
    hue: "cyan",
  },
  {
    id: 58,
    x: 67.16,
    y: 88.24,
    size: 0.8,
    opacity: 0.22,
    delay: -0.834,
    duration: 7.6,
    driftX: 4.2,
    driftY: -3.25,
    hue: "violet",
  },
  {
    id: 59,
    x: 4.33,
    y: 49.97,
    size: 2.1,
    opacity: 0.39,
    delay: -1.007,
    duration: 10.5,
    driftX: -12.6,
    driftY: 11.7,
    hue: "fuchsia",
  },
  {
    id: 60,
    x: 41.5,
    y: 11.7,
    size: 3.4,
    opacity: 0.56,
    delay: -1.18,
    duration: 4.3,
    driftX: 0.7,
    driftY: -3.9,
    hue: "cyan",
  },
  {
    id: 61,
    x: 78.67,
    y: 73.43,
    size: 1.8,
    opacity: 0.12,
    delay: -1.353,
    duration: 7.2,
    driftX: 14.0,
    driftY: 11.05,
    hue: "violet",
  },
  {
    id: 62,
    x: 15.84,
    y: 35.16,
    size: 3.1,
    opacity: 0.29,
    delay: -1.526,
    duration: 10.1,
    driftX: -2.8,
    driftY: -4.55,
    hue: "fuchsia",
  },
  {
    id: 63,
    x: 53.01,
    y: 96.89,
    size: 1.5,
    opacity: 0.46,
    delay: -1.699,
    duration: 3.9,
    driftX: 10.5,
    driftY: 10.4,
    hue: "cyan",
  },
  {
    id: 64,
    x: 90.18,
    y: 58.62,
    size: 2.8,
    opacity: 0.63,
    delay: -1.872,
    duration: 6.8,
    driftX: -6.3,
    driftY: -5.2,
    hue: "violet",
  },
  {
    id: 65,
    x: 27.35,
    y: 20.35,
    size: 1.2,
    opacity: 0.19,
    delay: -2.045,
    duration: 9.7,
    driftX: 7.0,
    driftY: 9.75,
    hue: "fuchsia",
  },
  {
    id: 66,
    x: 64.52,
    y: 82.08,
    size: 2.5,
    opacity: 0.36,
    delay: -2.218,
    duration: 3.5,
    driftX: -9.8,
    driftY: -5.85,
    hue: "cyan",
  },
  {
    id: 67,
    x: 1.69,
    y: 43.81,
    size: 0.9,
    opacity: 0.53,
    delay: -2.391,
    duration: 6.4,
    driftX: 3.5,
    driftY: 9.1,
    hue: "violet",
  },
  {
    id: 68,
    x: 38.86,
    y: 5.54,
    size: 2.2,
    opacity: 0.7,
    delay: -2.564,
    duration: 9.3,
    driftX: -13.3,
    driftY: -6.5,
    hue: "fuchsia",
  },
  {
    id: 69,
    x: 76.03,
    y: 67.27,
    size: 3.5,
    opacity: 0.26,
    delay: -2.737,
    duration: 12.2,
    driftX: 0.0,
    driftY: 8.45,
    hue: "cyan",
  },
  {
    id: 70,
    x: 13.2,
    y: 29.0,
    size: 1.9,
    opacity: 0.43,
    delay: -2.91,
    duration: 6.0,
    driftX: 13.3,
    driftY: -7.15,
    hue: "violet",
  },
  {
    id: 71,
    x: 50.37,
    y: 90.73,
    size: 3.2,
    opacity: 0.6,
    delay: -3.083,
    duration: 8.9,
    driftX: -3.5,
    driftY: 7.8,
    hue: "fuchsia",
  },
  {
    id: 72,
    x: 87.54,
    y: 52.46,
    size: 1.6,
    opacity: 0.16,
    delay: -3.256,
    duration: 11.8,
    driftX: 9.8,
    driftY: -7.8,
    hue: "cyan",
  },
  {
    id: 73,
    x: 24.71,
    y: 14.19,
    size: 2.9,
    opacity: 0.33,
    delay: -3.429,
    duration: 5.6,
    driftX: -7.0,
    driftY: 7.15,
    hue: "violet",
  },
  {
    id: 74,
    x: 61.88,
    y: 75.92,
    size: 1.3,
    opacity: 0.5,
    delay: -3.602,
    duration: 8.5,
    driftX: 6.3,
    driftY: -8.45,
    hue: "fuchsia",
  },
  {
    id: 75,
    x: 99.05,
    y: 37.65,
    size: 2.6,
    opacity: 0.67,
    delay: -3.775,
    duration: 11.4,
    driftX: -10.5,
    driftY: 6.5,
    hue: "cyan",
  },
  {
    id: 76,
    x: 36.22,
    y: 99.38,
    size: 1.0,
    opacity: 0.23,
    delay: -3.948,
    duration: 5.2,
    driftX: 2.8,
    driftY: -9.1,
    hue: "violet",
  },
  {
    id: 77,
    x: 73.39,
    y: 61.11,
    size: 2.3,
    opacity: 0.4,
    delay: -4.121,
    duration: 8.1,
    driftX: -14.0,
    driftY: 5.85,
    hue: "fuchsia",
  },
  {
    id: 78,
    x: 10.56,
    y: 22.84,
    size: 3.6,
    opacity: 0.57,
    delay: -4.294,
    duration: 11.0,
    driftX: -0.7,
    driftY: -9.75,
    hue: "cyan",
  },
  {
    id: 79,
    x: 47.73,
    y: 84.57,
    size: 2.0,
    opacity: 0.13,
    delay: -4.467,
    duration: 4.8,
    driftX: 12.6,
    driftY: 5.2,
    hue: "violet",
  },
  {
    id: 80,
    x: 84.9,
    y: 46.3,
    size: 3.3,
    opacity: 0.3,
    delay: -4.64,
    duration: 7.7,
    driftX: -4.2,
    driftY: -10.4,
    hue: "fuchsia",
  },
  {
    id: 81,
    x: 22.07,
    y: 8.03,
    size: 1.7,
    opacity: 0.47,
    delay: -4.813,
    duration: 10.6,
    driftX: 9.1,
    driftY: 4.55,
    hue: "cyan",
  },
  {
    id: 82,
    x: 59.24,
    y: 69.76,
    size: 3.0,
    opacity: 0.64,
    delay: -4.986,
    duration: 4.4,
    driftX: -7.7,
    driftY: -11.05,
    hue: "violet",
  },
  {
    id: 83,
    x: 96.41,
    y: 31.49,
    size: 1.4,
    opacity: 0.2,
    delay: -5.159,
    duration: 7.3,
    driftX: 5.6,
    driftY: 3.9,
    hue: "fuchsia",
  },
  {
    id: 84,
    x: 33.58,
    y: 93.22,
    size: 2.7,
    opacity: 0.37,
    delay: -5.332,
    duration: 10.2,
    driftX: -11.2,
    driftY: -11.7,
    hue: "cyan",
  },
  {
    id: 85,
    x: 70.75,
    y: 54.95,
    size: 1.1,
    opacity: 0.54,
    delay: -5.505,
    duration: 4.0,
    driftX: 2.1,
    driftY: 3.25,
    hue: "violet",
  },
  {
    id: 86,
    x: 7.92,
    y: 16.68,
    size: 2.4,
    opacity: 0.71,
    delay: -5.678,
    duration: 6.9,
    driftX: -14.7,
    driftY: -12.35,
    hue: "fuchsia",
  },
  {
    id: 87,
    x: 45.09,
    y: 78.41,
    size: 0.8,
    opacity: 0.27,
    delay: -5.851,
    duration: 9.8,
    driftX: -1.4,
    driftY: 2.6,
    hue: "cyan",
  },
  {
    id: 88,
    x: 82.26,
    y: 40.14,
    size: 2.1,
    opacity: 0.44,
    delay: -6.024,
    duration: 3.6,
    driftX: 11.9,
    driftY: -13.0,
    hue: "violet",
  },
  {
    id: 89,
    x: 19.43,
    y: 1.87,
    size: 3.4,
    opacity: 0.61,
    delay: -6.197,
    duration: 6.5,
    driftX: -4.9,
    driftY: 1.95,
    hue: "fuchsia",
  },
  {
    id: 90,
    x: 56.6,
    y: 63.6,
    size: 1.8,
    opacity: 0.17,
    delay: -6.37,
    duration: 9.4,
    driftX: 8.4,
    driftY: -13.65,
    hue: "cyan",
  },
  {
    id: 91,
    x: 93.77,
    y: 25.33,
    size: 3.1,
    opacity: 0.34,
    delay: -6.543,
    duration: 3.2,
    driftX: -8.4,
    driftY: 1.3,
    hue: "violet",
  },
  {
    id: 92,
    x: 30.94,
    y: 87.06,
    size: 1.5,
    opacity: 0.51,
    delay: -6.716,
    duration: 6.1,
    driftX: 4.9,
    driftY: -14.3,
    hue: "fuchsia",
  },
  {
    id: 93,
    x: 68.11,
    y: 48.79,
    size: 2.8,
    opacity: 0.68,
    delay: -6.889,
    duration: 9.0,
    driftX: -11.9,
    driftY: 0.65,
    hue: "cyan",
  },
  {
    id: 94,
    x: 5.28,
    y: 10.52,
    size: 1.2,
    opacity: 0.24,
    delay: -7.062,
    duration: 11.9,
    driftX: 1.4,
    driftY: -14.95,
    hue: "violet",
  },
  {
    id: 95,
    x: 42.45,
    y: 72.25,
    size: 2.5,
    opacity: 0.41,
    delay: -7.235,
    duration: 5.7,
    driftX: 14.7,
    driftY: 0.0,
    hue: "fuchsia",
  },
  {
    id: 96,
    x: 79.62,
    y: 33.98,
    size: 0.9,
    opacity: 0.58,
    delay: -7.408,
    duration: 8.6,
    driftX: -2.1,
    driftY: 14.95,
    hue: "cyan",
  },
  {
    id: 97,
    x: 16.79,
    y: 95.71,
    size: 2.2,
    opacity: 0.14,
    delay: -7.581,
    duration: 11.5,
    driftX: 11.2,
    driftY: -0.65,
    hue: "violet",
  },
  {
    id: 98,
    x: 53.96,
    y: 57.44,
    size: 3.5,
    opacity: 0.31,
    delay: -7.754,
    duration: 5.3,
    driftX: -5.6,
    driftY: 14.3,
    hue: "fuchsia",
  },
  {
    id: 99,
    x: 91.13,
    y: 19.17,
    size: 1.9,
    opacity: 0.48,
    delay: -7.927,
    duration: 8.2,
    driftX: 7.7,
    driftY: -1.3,
    hue: "cyan",
  },
  {
    id: 100,
    x: 28.3,
    y: 80.9,
    size: 3.2,
    opacity: 0.65,
    delay: -8.1,
    duration: 11.1,
    driftX: -9.1,
    driftY: 13.65,
    hue: "violet",
  },
  {
    id: 101,
    x: 65.47,
    y: 42.63,
    size: 1.6,
    opacity: 0.21,
    delay: -8.273,
    duration: 4.9,
    driftX: 4.2,
    driftY: -1.95,
    hue: "fuchsia",
  },
  {
    id: 102,
    x: 2.64,
    y: 4.36,
    size: 2.9,
    opacity: 0.38,
    delay: -8.446,
    duration: 7.8,
    driftX: -12.6,
    driftY: 13.0,
    hue: "cyan",
  },
  {
    id: 103,
    x: 39.81,
    y: 66.09,
    size: 1.3,
    opacity: 0.55,
    delay: -8.619,
    duration: 10.7,
    driftX: 0.7,
    driftY: -2.6,
    hue: "violet",
  },
  {
    id: 104,
    x: 76.98,
    y: 27.82,
    size: 2.6,
    opacity: 0.72,
    delay: -8.792,
    duration: 4.5,
    driftX: 14.0,
    driftY: 12.35,
    hue: "fuchsia",
  },
  {
    id: 105,
    x: 14.15,
    y: 89.55,
    size: 1.0,
    opacity: 0.28,
    delay: -8.965,
    duration: 7.4,
    driftX: -2.8,
    driftY: -3.25,
    hue: "cyan",
  },
  {
    id: 106,
    x: 51.32,
    y: 51.28,
    size: 2.3,
    opacity: 0.45,
    delay: -9.138,
    duration: 10.3,
    driftX: 10.5,
    driftY: 11.7,
    hue: "violet",
  },
  {
    id: 107,
    x: 88.49,
    y: 13.01,
    size: 3.6,
    opacity: 0.62,
    delay: -0.111,
    duration: 4.1,
    driftX: -6.3,
    driftY: -3.9,
    hue: "fuchsia",
  },
  {
    id: 108,
    x: 25.66,
    y: 74.74,
    size: 2.0,
    opacity: 0.18,
    delay: -0.284,
    duration: 7.0,
    driftX: 7.0,
    driftY: 11.05,
    hue: "cyan",
  },
  {
    id: 109,
    x: 62.83,
    y: 36.47,
    size: 3.3,
    opacity: 0.35,
    delay: -0.457,
    duration: 9.9,
    driftX: -9.8,
    driftY: -4.55,
    hue: "violet",
  },
  {
    id: 110,
    x: 0.0,
    y: 98.2,
    size: 1.7,
    opacity: 0.52,
    delay: -0.63,
    duration: 3.7,
    driftX: 3.5,
    driftY: 10.4,
    hue: "fuchsia",
  },
  {
    id: 111,
    x: 37.17,
    y: 59.93,
    size: 3.0,
    opacity: 0.69,
    delay: -0.803,
    duration: 6.6,
    driftX: -13.3,
    driftY: -5.2,
    hue: "cyan",
  },
  {
    id: 112,
    x: 74.34,
    y: 21.66,
    size: 1.4,
    opacity: 0.25,
    delay: -0.976,
    duration: 9.5,
    driftX: 0.0,
    driftY: 9.75,
    hue: "violet",
  },
  {
    id: 113,
    x: 11.51,
    y: 83.39,
    size: 2.7,
    opacity: 0.42,
    delay: -1.149,
    duration: 3.3,
    driftX: 13.3,
    driftY: -5.85,
    hue: "fuchsia",
  },
  {
    id: 114,
    x: 48.68,
    y: 45.12,
    size: 1.1,
    opacity: 0.59,
    delay: -1.322,
    duration: 6.2,
    driftX: -3.5,
    driftY: 9.1,
    hue: "cyan",
  },
  {
    id: 115,
    x: 85.85,
    y: 6.85,
    size: 2.4,
    opacity: 0.15,
    delay: -1.495,
    duration: 9.1,
    driftX: 9.8,
    driftY: -6.5,
    hue: "violet",
  },
  {
    id: 116,
    x: 23.02,
    y: 68.58,
    size: 0.8,
    opacity: 0.32,
    delay: -1.668,
    duration: 12.0,
    driftX: -7.0,
    driftY: 8.45,
    hue: "fuchsia",
  },
  {
    id: 117,
    x: 60.19,
    y: 30.31,
    size: 2.1,
    opacity: 0.49,
    delay: -1.841,
    duration: 5.8,
    driftX: 6.3,
    driftY: -7.15,
    hue: "cyan",
  },
  {
    id: 118,
    x: 97.36,
    y: 92.04,
    size: 3.4,
    opacity: 0.66,
    delay: -2.014,
    duration: 8.7,
    driftX: -10.5,
    driftY: 7.8,
    hue: "violet",
  },
  {
    id: 119,
    x: 34.53,
    y: 53.77,
    size: 1.8,
    opacity: 0.22,
    delay: -2.187,
    duration: 11.6,
    driftX: 2.8,
    driftY: -7.8,
    hue: "fuchsia",
  },
  {
    id: 120,
    x: 71.7,
    y: 15.5,
    size: 3.1,
    opacity: 0.39,
    delay: -2.36,
    duration: 5.4,
    driftX: -14.0,
    driftY: 7.15,
    hue: "cyan",
  },
  {
    id: 121,
    x: 8.87,
    y: 77.23,
    size: 1.5,
    opacity: 0.56,
    delay: -2.533,
    duration: 8.3,
    driftX: -0.7,
    driftY: -8.45,
    hue: "violet",
  },
  {
    id: 122,
    x: 46.04,
    y: 38.96,
    size: 2.8,
    opacity: 0.12,
    delay: -2.706,
    duration: 11.2,
    driftX: 12.6,
    driftY: 6.5,
    hue: "fuchsia",
  },
  {
    id: 123,
    x: 83.21,
    y: 0.69,
    size: 1.2,
    opacity: 0.29,
    delay: -2.879,
    duration: 5.0,
    driftX: -4.2,
    driftY: -9.1,
    hue: "cyan",
  },
  {
    id: 124,
    x: 20.38,
    y: 62.42,
    size: 2.5,
    opacity: 0.46,
    delay: -3.052,
    duration: 7.9,
    driftX: 9.1,
    driftY: 5.85,
    hue: "violet",
  },
  {
    id: 125,
    x: 57.55,
    y: 24.15,
    size: 0.9,
    opacity: 0.63,
    delay: -3.225,
    duration: 10.8,
    driftX: -7.7,
    driftY: -9.75,
    hue: "fuchsia",
  },
  {
    id: 126,
    x: 94.72,
    y: 85.88,
    size: 2.2,
    opacity: 0.19,
    delay: -3.398,
    duration: 4.6,
    driftX: 5.6,
    driftY: 5.2,
    hue: "cyan",
  },
  {
    id: 127,
    x: 31.89,
    y: 47.61,
    size: 3.5,
    opacity: 0.36,
    delay: -3.571,
    duration: 7.5,
    driftX: -11.2,
    driftY: -10.4,
    hue: "violet",
  },
  {
    id: 128,
    x: 69.06,
    y: 9.34,
    size: 1.9,
    opacity: 0.53,
    delay: -3.744,
    duration: 10.4,
    driftX: 2.1,
    driftY: 4.55,
    hue: "fuchsia",
  },
  {
    id: 129,
    x: 6.23,
    y: 71.07,
    size: 3.2,
    opacity: 0.7,
    delay: -3.917,
    duration: 4.2,
    driftX: -14.7,
    driftY: -11.05,
    hue: "cyan",
  },
  {
    id: 130,
    x: 43.4,
    y: 32.8,
    size: 1.6,
    opacity: 0.26,
    delay: -4.09,
    duration: 7.1,
    driftX: -1.4,
    driftY: 3.9,
    hue: "violet",
  },
  {
    id: 131,
    x: 80.57,
    y: 94.53,
    size: 2.9,
    opacity: 0.43,
    delay: -4.263,
    duration: 10.0,
    driftX: 11.9,
    driftY: -11.7,
    hue: "fuchsia",
  },
  {
    id: 132,
    x: 17.74,
    y: 56.26,
    size: 1.3,
    opacity: 0.6,
    delay: -4.436,
    duration: 3.8,
    driftX: -4.9,
    driftY: 3.25,
    hue: "cyan",
  },
  {
    id: 133,
    x: 54.91,
    y: 17.99,
    size: 2.6,
    opacity: 0.16,
    delay: -4.609,
    duration: 6.7,
    driftX: 8.4,
    driftY: -12.35,
    hue: "violet",
  },
  {
    id: 134,
    x: 92.08,
    y: 79.72,
    size: 1.0,
    opacity: 0.33,
    delay: -4.782,
    duration: 9.6,
    driftX: -8.4,
    driftY: 2.6,
    hue: "fuchsia",
  },
  {
    id: 135,
    x: 29.25,
    y: 41.45,
    size: 2.3,
    opacity: 0.5,
    delay: -4.955,
    duration: 3.4,
    driftX: 4.9,
    driftY: -13.0,
    hue: "cyan",
  },
  {
    id: 136,
    x: 66.42,
    y: 3.18,
    size: 3.6,
    opacity: 0.67,
    delay: -5.128,
    duration: 6.3,
    driftX: -11.9,
    driftY: 1.95,
    hue: "violet",
  },
  {
    id: 137,
    x: 3.59,
    y: 64.91,
    size: 2.0,
    opacity: 0.23,
    delay: -5.301,
    duration: 9.2,
    driftX: 1.4,
    driftY: -13.65,
    hue: "fuchsia",
  },
  {
    id: 138,
    x: 40.76,
    y: 26.64,
    size: 3.3,
    opacity: 0.4,
    delay: -5.474,
    duration: 12.1,
    driftX: 14.7,
    driftY: 1.3,
    hue: "cyan",
  },
  {
    id: 139,
    x: 77.93,
    y: 88.37,
    size: 1.7,
    opacity: 0.57,
    delay: -5.647,
    duration: 5.9,
    driftX: -2.1,
    driftY: -14.3,
    hue: "violet",
  },
  {
    id: 140,
    x: 15.1,
    y: 50.1,
    size: 3.0,
    opacity: 0.13,
    delay: -5.82,
    duration: 8.8,
    driftX: 11.2,
    driftY: 0.65,
    hue: "fuchsia",
  },
  {
    id: 141,
    x: 52.27,
    y: 11.83,
    size: 1.4,
    opacity: 0.3,
    delay: -5.993,
    duration: 11.7,
    driftX: -5.6,
    driftY: -14.95,
    hue: "cyan",
  },
  {
    id: 142,
    x: 89.44,
    y: 73.56,
    size: 2.7,
    opacity: 0.47,
    delay: -6.166,
    duration: 5.5,
    driftX: 7.7,
    driftY: 0.0,
    hue: "violet",
  },
  {
    id: 143,
    x: 26.61,
    y: 35.29,
    size: 1.1,
    opacity: 0.64,
    delay: -6.339,
    duration: 8.4,
    driftX: -9.1,
    driftY: 14.95,
    hue: "fuchsia",
  },
  {
    id: 144,
    x: 63.78,
    y: 97.02,
    size: 2.4,
    opacity: 0.2,
    delay: -6.512,
    duration: 11.3,
    driftX: 4.2,
    driftY: -0.65,
    hue: "cyan",
  },
  {
    id: 145,
    x: 0.95,
    y: 58.75,
    size: 0.8,
    opacity: 0.37,
    delay: -6.685,
    duration: 5.1,
    driftX: -12.6,
    driftY: 14.3,
    hue: "violet",
  },
  {
    id: 146,
    x: 38.12,
    y: 20.48,
    size: 2.1,
    opacity: 0.54,
    delay: -6.858,
    duration: 8.0,
    driftX: 0.7,
    driftY: -1.3,
    hue: "fuchsia",
  },
  {
    id: 147,
    x: 75.29,
    y: 82.21,
    size: 3.4,
    opacity: 0.71,
    delay: -7.031,
    duration: 10.9,
    driftX: 14.0,
    driftY: 13.65,
    hue: "cyan",
  },
  {
    id: 148,
    x: 12.46,
    y: 43.94,
    size: 1.8,
    opacity: 0.27,
    delay: -7.204,
    duration: 4.7,
    driftX: -2.8,
    driftY: -1.95,
    hue: "violet",
  },
  {
    id: 149,
    x: 49.63,
    y: 5.67,
    size: 3.1,
    opacity: 0.44,
    delay: -7.377,
    duration: 7.6,
    driftX: 10.5,
    driftY: 13.0,
    hue: "fuchsia",
  },
  {
    id: 150,
    x: 86.8,
    y: 67.4,
    size: 1.5,
    opacity: 0.61,
    delay: -7.55,
    duration: 10.5,
    driftX: -6.3,
    driftY: -2.6,
    hue: "cyan",
  },
  {
    id: 151,
    x: 23.97,
    y: 29.13,
    size: 2.8,
    opacity: 0.17,
    delay: -7.723,
    duration: 4.3,
    driftX: 7.0,
    driftY: 12.35,
    hue: "violet",
  },
  {
    id: 152,
    x: 61.14,
    y: 90.86,
    size: 1.2,
    opacity: 0.34,
    delay: -7.896,
    duration: 7.2,
    driftX: -9.8,
    driftY: -3.25,
    hue: "fuchsia",
  },
  {
    id: 153,
    x: 98.31,
    y: 52.59,
    size: 2.5,
    opacity: 0.51,
    delay: -8.069,
    duration: 10.1,
    driftX: 3.5,
    driftY: 11.7,
    hue: "cyan",
  },
  {
    id: 154,
    x: 35.48,
    y: 14.32,
    size: 0.9,
    opacity: 0.68,
    delay: -8.242,
    duration: 3.9,
    driftX: -13.3,
    driftY: -3.9,
    hue: "violet",
  },
  {
    id: 155,
    x: 72.65,
    y: 76.05,
    size: 2.2,
    opacity: 0.24,
    delay: -8.415,
    duration: 6.8,
    driftX: 0.0,
    driftY: 11.05,
    hue: "fuchsia",
  },
  {
    id: 156,
    x: 9.82,
    y: 37.78,
    size: 3.5,
    opacity: 0.41,
    delay: -8.588,
    duration: 9.7,
    driftX: 13.3,
    driftY: -4.55,
    hue: "cyan",
  },
  {
    id: 157,
    x: 46.99,
    y: 99.51,
    size: 1.9,
    opacity: 0.58,
    delay: -8.761,
    duration: 3.5,
    driftX: -3.5,
    driftY: 10.4,
    hue: "violet",
  },
  {
    id: 158,
    x: 84.16,
    y: 61.24,
    size: 3.2,
    opacity: 0.14,
    delay: -8.934,
    duration: 6.4,
    driftX: 9.8,
    driftY: -5.2,
    hue: "fuchsia",
  },
  {
    id: 159,
    x: 21.33,
    y: 22.97,
    size: 1.6,
    opacity: 0.31,
    delay: -9.107,
    duration: 9.3,
    driftX: -7.0,
    driftY: 9.75,
    hue: "cyan",
  },
  {
    id: 160,
    x: 58.5,
    y: 84.7,
    size: 2.9,
    opacity: 0.48,
    delay: -0.08,
    duration: 12.2,
    driftX: 6.3,
    driftY: -5.85,
    hue: "violet",
  },
  {
    id: 161,
    x: 95.67,
    y: 46.43,
    size: 1.3,
    opacity: 0.65,
    delay: -0.253,
    duration: 6.0,
    driftX: -10.5,
    driftY: 9.1,
    hue: "fuchsia",
  },
  {
    id: 162,
    x: 32.84,
    y: 8.16,
    size: 2.6,
    opacity: 0.21,
    delay: -0.426,
    duration: 8.9,
    driftX: 2.8,
    driftY: -6.5,
    hue: "cyan",
  },
  {
    id: 163,
    x: 70.01,
    y: 69.89,
    size: 1.0,
    opacity: 0.38,
    delay: -0.599,
    duration: 11.8,
    driftX: -14.0,
    driftY: 8.45,
    hue: "violet",
  },
  {
    id: 164,
    x: 7.18,
    y: 31.62,
    size: 2.3,
    opacity: 0.55,
    delay: -0.772,
    duration: 5.6,
    driftX: -0.7,
    driftY: -7.15,
    hue: "fuchsia",
  },
  {
    id: 165,
    x: 44.35,
    y: 93.35,
    size: 3.6,
    opacity: 0.72,
    delay: -0.945,
    duration: 8.5,
    driftX: 12.6,
    driftY: 7.8,
    hue: "cyan",
  },
  {
    id: 166,
    x: 81.52,
    y: 55.08,
    size: 2.0,
    opacity: 0.28,
    delay: -1.118,
    duration: 11.4,
    driftX: -4.2,
    driftY: -7.8,
    hue: "violet",
  },
  {
    id: 167,
    x: 18.69,
    y: 16.81,
    size: 3.3,
    opacity: 0.45,
    delay: -1.291,
    duration: 5.2,
    driftX: 9.1,
    driftY: 7.15,
    hue: "fuchsia",
  },
  {
    id: 168,
    x: 55.86,
    y: 78.54,
    size: 1.7,
    opacity: 0.62,
    delay: -1.464,
    duration: 8.1,
    driftX: -7.7,
    driftY: -8.45,
    hue: "cyan",
  },
  {
    id: 169,
    x: 93.03,
    y: 40.27,
    size: 3.0,
    opacity: 0.18,
    delay: -1.637,
    duration: 11.0,
    driftX: 5.6,
    driftY: 6.5,
    hue: "violet",
  },
  {
    id: 170,
    x: 30.2,
    y: 2.0,
    size: 1.4,
    opacity: 0.35,
    delay: -1.81,
    duration: 4.8,
    driftX: -11.2,
    driftY: -9.1,
    hue: "fuchsia",
  },
  {
    id: 171,
    x: 67.37,
    y: 63.73,
    size: 2.7,
    opacity: 0.52,
    delay: -1.983,
    duration: 7.7,
    driftX: 2.1,
    driftY: 5.85,
    hue: "cyan",
  },
  {
    id: 172,
    x: 4.54,
    y: 25.46,
    size: 1.1,
    opacity: 0.69,
    delay: -2.156,
    duration: 10.6,
    driftX: -14.7,
    driftY: -9.75,
    hue: "violet",
  },
  {
    id: 173,
    x: 41.71,
    y: 87.19,
    size: 2.4,
    opacity: 0.25,
    delay: -2.329,
    duration: 4.4,
    driftX: -1.4,
    driftY: 5.2,
    hue: "fuchsia",
  },
  {
    id: 174,
    x: 78.88,
    y: 48.92,
    size: 0.8,
    opacity: 0.42,
    delay: -2.502,
    duration: 7.3,
    driftX: 11.9,
    driftY: -10.4,
    hue: "cyan",
  },
  {
    id: 175,
    x: 16.05,
    y: 10.65,
    size: 2.1,
    opacity: 0.59,
    delay: -2.675,
    duration: 10.2,
    driftX: -4.9,
    driftY: 4.55,
    hue: "violet",
  },
  {
    id: 176,
    x: 53.22,
    y: 72.38,
    size: 3.4,
    opacity: 0.15,
    delay: -2.848,
    duration: 4.0,
    driftX: 8.4,
    driftY: -11.05,
    hue: "fuchsia",
  },
  {
    id: 177,
    x: 90.39,
    y: 34.11,
    size: 1.8,
    opacity: 0.32,
    delay: -3.021,
    duration: 6.9,
    driftX: -8.4,
    driftY: 3.9,
    hue: "cyan",
  },
  {
    id: 178,
    x: 27.56,
    y: 95.84,
    size: 3.1,
    opacity: 0.49,
    delay: -3.194,
    duration: 9.8,
    driftX: 4.9,
    driftY: -11.7,
    hue: "violet",
  },
  {
    id: 179,
    x: 64.73,
    y: 57.57,
    size: 1.5,
    opacity: 0.66,
    delay: -3.367,
    duration: 3.6,
    driftX: -11.9,
    driftY: 3.25,
    hue: "fuchsia",
  },
  {
    id: 180,
    x: 1.9,
    y: 19.3,
    size: 2.8,
    opacity: 0.22,
    delay: -3.54,
    duration: 6.5,
    driftX: 1.4,
    driftY: -12.35,
    hue: "cyan",
  },
  {
    id: 181,
    x: 39.07,
    y: 81.03,
    size: 1.2,
    opacity: 0.39,
    delay: -3.713,
    duration: 9.4,
    driftX: 14.7,
    driftY: 2.6,
    hue: "violet",
  },
  {
    id: 182,
    x: 76.24,
    y: 42.76,
    size: 2.5,
    opacity: 0.56,
    delay: -3.886,
    duration: 3.2,
    driftX: -2.1,
    driftY: -13.0,
    hue: "fuchsia",
  },
  {
    id: 183,
    x: 13.41,
    y: 4.49,
    size: 0.9,
    opacity: 0.12,
    delay: -4.059,
    duration: 6.1,
    driftX: 11.2,
    driftY: 1.95,
    hue: "cyan",
  },
  {
    id: 184,
    x: 50.58,
    y: 66.22,
    size: 2.2,
    opacity: 0.29,
    delay: -4.232,
    duration: 9.0,
    driftX: -5.6,
    driftY: -13.65,
    hue: "violet",
  },
  {
    id: 185,
    x: 87.75,
    y: 27.95,
    size: 3.5,
    opacity: 0.46,
    delay: -4.405,
    duration: 11.9,
    driftX: 7.7,
    driftY: 1.3,
    hue: "fuchsia",
  },
  {
    id: 186,
    x: 24.92,
    y: 89.68,
    size: 1.9,
    opacity: 0.63,
    delay: -4.578,
    duration: 5.7,
    driftX: -9.1,
    driftY: -14.3,
    hue: "cyan",
  },
  {
    id: 187,
    x: 62.09,
    y: 51.41,
    size: 3.2,
    opacity: 0.19,
    delay: -4.751,
    duration: 8.6,
    driftX: 4.2,
    driftY: 0.65,
    hue: "violet",
  },
  {
    id: 188,
    x: 99.26,
    y: 13.14,
    size: 1.6,
    opacity: 0.36,
    delay: -4.924,
    duration: 11.5,
    driftX: -12.6,
    driftY: -14.95,
    hue: "fuchsia",
  },
  {
    id: 189,
    x: 36.43,
    y: 74.87,
    size: 2.9,
    opacity: 0.53,
    delay: -5.097,
    duration: 5.3,
    driftX: 0.7,
    driftY: 0.0,
    hue: "cyan",
  },
  {
    id: 190,
    x: 73.6,
    y: 36.6,
    size: 1.3,
    opacity: 0.7,
    delay: -5.27,
    duration: 8.2,
    driftX: 14.0,
    driftY: 14.95,
    hue: "violet",
  },
  {
    id: 191,
    x: 10.77,
    y: 98.33,
    size: 2.6,
    opacity: 0.26,
    delay: -5.443,
    duration: 11.1,
    driftX: -2.8,
    driftY: -0.65,
    hue: "fuchsia",
  },
  {
    id: 192,
    x: 47.94,
    y: 60.06,
    size: 1.0,
    opacity: 0.43,
    delay: -5.616,
    duration: 4.9,
    driftX: 10.5,
    driftY: 14.3,
    hue: "cyan",
  },
  {
    id: 193,
    x: 85.11,
    y: 21.79,
    size: 2.3,
    opacity: 0.6,
    delay: -5.789,
    duration: 7.8,
    driftX: -6.3,
    driftY: -1.3,
    hue: "violet",
  },
  {
    id: 194,
    x: 22.28,
    y: 83.52,
    size: 3.6,
    opacity: 0.16,
    delay: -5.962,
    duration: 10.7,
    driftX: 7.0,
    driftY: 13.65,
    hue: "fuchsia",
  },
  {
    id: 195,
    x: 59.45,
    y: 45.25,
    size: 2.0,
    opacity: 0.33,
    delay: -6.135,
    duration: 4.5,
    driftX: -9.8,
    driftY: -1.95,
    hue: "cyan",
  },
  {
    id: 196,
    x: 96.62,
    y: 6.98,
    size: 3.3,
    opacity: 0.5,
    delay: -6.308,
    duration: 7.4,
    driftX: 3.5,
    driftY: 13.0,
    hue: "violet",
  },
  {
    id: 197,
    x: 33.79,
    y: 68.71,
    size: 1.7,
    opacity: 0.67,
    delay: -6.481,
    duration: 10.3,
    driftX: -13.3,
    driftY: -2.6,
    hue: "fuchsia",
  },
  {
    id: 198,
    x: 70.96,
    y: 30.44,
    size: 3.0,
    opacity: 0.23,
    delay: -6.654,
    duration: 4.1,
    driftX: 0.0,
    driftY: 12.35,
    hue: "cyan",
  },
  {
    id: 199,
    x: 8.13,
    y: 92.17,
    size: 1.4,
    opacity: 0.4,
    delay: -6.827,
    duration: 7.0,
    driftX: 13.3,
    driftY: -3.25,
    hue: "violet",
  },
  {
    id: 200,
    x: 45.3,
    y: 53.9,
    size: 2.7,
    opacity: 0.57,
    delay: -7.0,
    duration: 9.9,
    driftX: -3.5,
    driftY: 11.7,
    hue: "fuchsia",
  },
  {
    id: 201,
    x: 82.47,
    y: 15.63,
    size: 1.1,
    opacity: 0.13,
    delay: -7.173,
    duration: 3.7,
    driftX: 9.8,
    driftY: -3.9,
    hue: "cyan",
  },
  {
    id: 202,
    x: 19.64,
    y: 77.36,
    size: 2.4,
    opacity: 0.3,
    delay: -7.346,
    duration: 6.6,
    driftX: -7.0,
    driftY: 11.05,
    hue: "violet",
  },
  {
    id: 203,
    x: 56.81,
    y: 39.09,
    size: 0.8,
    opacity: 0.47,
    delay: -7.519,
    duration: 9.5,
    driftX: 6.3,
    driftY: -4.55,
    hue: "fuchsia",
  },
  {
    id: 204,
    x: 93.98,
    y: 0.82,
    size: 2.1,
    opacity: 0.64,
    delay: -7.692,
    duration: 3.3,
    driftX: -10.5,
    driftY: 10.4,
    hue: "cyan",
  },
  {
    id: 205,
    x: 31.15,
    y: 62.55,
    size: 3.4,
    opacity: 0.2,
    delay: -7.865,
    duration: 6.2,
    driftX: 2.8,
    driftY: -5.2,
    hue: "violet",
  },
  {
    id: 206,
    x: 68.32,
    y: 24.28,
    size: 1.8,
    opacity: 0.37,
    delay: -8.038,
    duration: 9.1,
    driftX: -14.0,
    driftY: 9.75,
    hue: "fuchsia",
  },
  {
    id: 207,
    x: 5.49,
    y: 86.01,
    size: 3.1,
    opacity: 0.54,
    delay: -8.211,
    duration: 12.0,
    driftX: -0.7,
    driftY: -5.85,
    hue: "cyan",
  },
  {
    id: 208,
    x: 42.66,
    y: 47.74,
    size: 1.5,
    opacity: 0.71,
    delay: -8.384,
    duration: 5.8,
    driftX: 12.6,
    driftY: 9.1,
    hue: "violet",
  },
  {
    id: 209,
    x: 79.83,
    y: 9.47,
    size: 2.8,
    opacity: 0.27,
    delay: -8.557,
    duration: 8.7,
    driftX: -4.2,
    driftY: -6.5,
    hue: "fuchsia",
  },
  {
    id: 210,
    x: 17.0,
    y: 71.2,
    size: 1.2,
    opacity: 0.44,
    delay: -8.73,
    duration: 11.6,
    driftX: 9.1,
    driftY: 8.45,
    hue: "cyan",
  },
  {
    id: 211,
    x: 54.17,
    y: 32.93,
    size: 2.5,
    opacity: 0.61,
    delay: -8.903,
    duration: 5.4,
    driftX: -7.7,
    driftY: -7.15,
    hue: "violet",
  },
  {
    id: 212,
    x: 91.34,
    y: 94.66,
    size: 0.9,
    opacity: 0.17,
    delay: -9.076,
    duration: 8.3,
    driftX: 5.6,
    driftY: 7.8,
    hue: "fuchsia",
  },
  {
    id: 213,
    x: 28.51,
    y: 56.39,
    size: 2.2,
    opacity: 0.34,
    delay: -0.049,
    duration: 11.2,
    driftX: -11.2,
    driftY: -7.8,
    hue: "cyan",
  },
  {
    id: 214,
    x: 65.68,
    y: 18.12,
    size: 3.5,
    opacity: 0.51,
    delay: -0.222,
    duration: 5.0,
    driftX: 2.1,
    driftY: 7.15,
    hue: "violet",
  },
  {
    id: 215,
    x: 2.85,
    y: 79.85,
    size: 1.9,
    opacity: 0.68,
    delay: -0.395,
    duration: 7.9,
    driftX: -14.7,
    driftY: -8.45,
    hue: "fuchsia",
  },
  {
    id: 216,
    x: 40.02,
    y: 41.58,
    size: 3.2,
    opacity: 0.24,
    delay: -0.568,
    duration: 10.8,
    driftX: -1.4,
    driftY: 6.5,
    hue: "cyan",
  },
  {
    id: 217,
    x: 77.19,
    y: 3.31,
    size: 1.6,
    opacity: 0.41,
    delay: -0.741,
    duration: 4.6,
    driftX: 11.9,
    driftY: -9.1,
    hue: "violet",
  },
  {
    id: 218,
    x: 14.36,
    y: 65.04,
    size: 2.9,
    opacity: 0.58,
    delay: -0.914,
    duration: 7.5,
    driftX: -4.9,
    driftY: 5.85,
    hue: "fuchsia",
  },
  {
    id: 219,
    x: 51.53,
    y: 26.77,
    size: 1.3,
    opacity: 0.14,
    delay: -1.087,
    duration: 10.4,
    driftX: 8.4,
    driftY: -9.75,
    hue: "cyan",
  },
  {
    id: 220,
    x: 88.7,
    y: 88.5,
    size: 2.6,
    opacity: 0.31,
    delay: -1.26,
    duration: 4.2,
    driftX: -8.4,
    driftY: 5.2,
    hue: "violet",
  },
  {
    id: 221,
    x: 25.87,
    y: 50.23,
    size: 1.0,
    opacity: 0.48,
    delay: -1.433,
    duration: 7.1,
    driftX: 4.9,
    driftY: -10.4,
    hue: "fuchsia",
  },
  {
    id: 222,
    x: 63.04,
    y: 11.96,
    size: 2.3,
    opacity: 0.65,
    delay: -1.606,
    duration: 10.0,
    driftX: -11.9,
    driftY: 4.55,
    hue: "cyan",
  },
  {
    id: 223,
    x: 0.21,
    y: 73.69,
    size: 3.6,
    opacity: 0.21,
    delay: -1.779,
    duration: 3.8,
    driftX: 1.4,
    driftY: -11.05,
    hue: "violet",
  },
  {
    id: 224,
    x: 37.38,
    y: 35.42,
    size: 2.0,
    opacity: 0.38,
    delay: -1.952,
    duration: 6.7,
    driftX: 14.7,
    driftY: 3.9,
    hue: "fuchsia",
  },
  {
    id: 225,
    x: 74.55,
    y: 97.15,
    size: 3.3,
    opacity: 0.55,
    delay: -2.125,
    duration: 9.6,
    driftX: -2.1,
    driftY: -11.7,
    hue: "cyan",
  },
  {
    id: 226,
    x: 11.72,
    y: 58.88,
    size: 1.7,
    opacity: 0.72,
    delay: -2.298,
    duration: 3.4,
    driftX: 11.2,
    driftY: 3.25,
    hue: "violet",
  },
  {
    id: 227,
    x: 48.89,
    y: 20.61,
    size: 3.0,
    opacity: 0.28,
    delay: -2.471,
    duration: 6.3,
    driftX: -5.6,
    driftY: -12.35,
    hue: "fuchsia",
  },
  {
    id: 228,
    x: 86.06,
    y: 82.34,
    size: 1.4,
    opacity: 0.45,
    delay: -2.644,
    duration: 9.2,
    driftX: 7.7,
    driftY: 2.6,
    hue: "cyan",
  },
  {
    id: 229,
    x: 23.23,
    y: 44.07,
    size: 2.7,
    opacity: 0.62,
    delay: -2.817,
    duration: 12.1,
    driftX: -9.1,
    driftY: -13.0,
    hue: "violet",
  },
  {
    id: 230,
    x: 60.4,
    y: 5.8,
    size: 1.1,
    opacity: 0.18,
    delay: -2.99,
    duration: 5.9,
    driftX: 4.2,
    driftY: 1.95,
    hue: "fuchsia",
  },
  {
    id: 231,
    x: 97.57,
    y: 67.53,
    size: 2.4,
    opacity: 0.35,
    delay: -3.163,
    duration: 8.8,
    driftX: -12.6,
    driftY: -13.65,
    hue: "cyan",
  },
  {
    id: 232,
    x: 34.74,
    y: 29.26,
    size: 0.8,
    opacity: 0.52,
    delay: -3.336,
    duration: 11.7,
    driftX: 0.7,
    driftY: 1.3,
    hue: "violet",
  },
  {
    id: 233,
    x: 71.91,
    y: 90.99,
    size: 2.1,
    opacity: 0.69,
    delay: -3.509,
    duration: 5.5,
    driftX: 14.0,
    driftY: -14.3,
    hue: "fuchsia",
  },
  {
    id: 234,
    x: 9.08,
    y: 52.72,
    size: 3.4,
    opacity: 0.25,
    delay: -3.682,
    duration: 8.4,
    driftX: -2.8,
    driftY: 0.65,
    hue: "cyan",
  },
  {
    id: 235,
    x: 46.25,
    y: 14.45,
    size: 1.8,
    opacity: 0.42,
    delay: -3.855,
    duration: 11.3,
    driftX: 10.5,
    driftY: -14.95,
    hue: "violet",
  },
  {
    id: 236,
    x: 83.42,
    y: 76.18,
    size: 3.1,
    opacity: 0.59,
    delay: -4.028,
    duration: 5.1,
    driftX: -6.3,
    driftY: 0.0,
    hue: "fuchsia",
  },
  {
    id: 237,
    x: 20.59,
    y: 37.91,
    size: 1.5,
    opacity: 0.15,
    delay: -4.201,
    duration: 8.0,
    driftX: 7.0,
    driftY: 14.95,
    hue: "cyan",
  },
  {
    id: 238,
    x: 57.76,
    y: 99.64,
    size: 2.8,
    opacity: 0.32,
    delay: -4.374,
    duration: 10.9,
    driftX: -9.8,
    driftY: -0.65,
    hue: "violet",
  },
  {
    id: 239,
    x: 94.93,
    y: 61.37,
    size: 1.2,
    opacity: 0.49,
    delay: -4.547,
    duration: 4.7,
    driftX: 3.5,
    driftY: 14.3,
    hue: "fuchsia",
  },
  {
    id: 240,
    x: 32.1,
    y: 23.1,
    size: 2.5,
    opacity: 0.66,
    delay: -4.72,
    duration: 7.6,
    driftX: -13.3,
    driftY: -1.3,
    hue: "cyan",
  },
  {
    id: 241,
    x: 69.27,
    y: 84.83,
    size: 0.9,
    opacity: 0.22,
    delay: -4.893,
    duration: 10.5,
    driftX: 0.0,
    driftY: 13.65,
    hue: "violet",
  },
  {
    id: 242,
    x: 6.44,
    y: 46.56,
    size: 2.2,
    opacity: 0.39,
    delay: -5.066,
    duration: 4.3,
    driftX: 13.3,
    driftY: -1.95,
    hue: "fuchsia",
  },
  {
    id: 243,
    x: 43.61,
    y: 8.29,
    size: 3.5,
    opacity: 0.56,
    delay: -5.239,
    duration: 7.2,
    driftX: -3.5,
    driftY: 13.0,
    hue: "cyan",
  },
  {
    id: 244,
    x: 80.78,
    y: 70.02,
    size: 1.9,
    opacity: 0.12,
    delay: -5.412,
    duration: 10.1,
    driftX: 9.8,
    driftY: -2.6,
    hue: "violet",
  },
  {
    id: 245,
    x: 17.95,
    y: 31.75,
    size: 3.2,
    opacity: 0.29,
    delay: -5.585,
    duration: 3.9,
    driftX: -7.0,
    driftY: 12.35,
    hue: "fuchsia",
  },
  {
    id: 246,
    x: 55.12,
    y: 93.48,
    size: 1.6,
    opacity: 0.46,
    delay: -5.758,
    duration: 6.8,
    driftX: 6.3,
    driftY: -3.25,
    hue: "cyan",
  },
  {
    id: 247,
    x: 92.29,
    y: 55.21,
    size: 2.9,
    opacity: 0.63,
    delay: -5.931,
    duration: 9.7,
    driftX: -10.5,
    driftY: 11.7,
    hue: "violet",
  },
  {
    id: 248,
    x: 29.46,
    y: 16.94,
    size: 1.3,
    opacity: 0.19,
    delay: -6.104,
    duration: 3.5,
    driftX: 2.8,
    driftY: -3.9,
    hue: "fuchsia",
  },
  {
    id: 249,
    x: 66.63,
    y: 78.67,
    size: 2.6,
    opacity: 0.36,
    delay: -6.277,
    duration: 6.4,
    driftX: -14.0,
    driftY: 11.05,
    hue: "cyan",
  },
  {
    id: 250,
    x: 3.8,
    y: 40.4,
    size: 1.0,
    opacity: 0.53,
    delay: -6.45,
    duration: 9.3,
    driftX: -0.7,
    driftY: -4.55,
    hue: "violet",
  },
  {
    id: 251,
    x: 40.97,
    y: 2.13,
    size: 2.3,
    opacity: 0.7,
    delay: -6.623,
    duration: 12.2,
    driftX: 12.6,
    driftY: 10.4,
    hue: "fuchsia",
  },
  {
    id: 252,
    x: 78.14,
    y: 63.86,
    size: 3.6,
    opacity: 0.26,
    delay: -6.796,
    duration: 6.0,
    driftX: -4.2,
    driftY: -5.2,
    hue: "cyan",
  },
  {
    id: 253,
    x: 15.31,
    y: 25.59,
    size: 2.0,
    opacity: 0.43,
    delay: -6.969,
    duration: 8.9,
    driftX: 9.1,
    driftY: 9.75,
    hue: "violet",
  },
  {
    id: 254,
    x: 52.48,
    y: 87.32,
    size: 3.3,
    opacity: 0.6,
    delay: -7.142,
    duration: 11.8,
    driftX: -7.7,
    driftY: -5.85,
    hue: "fuchsia",
  },
  {
    id: 255,
    x: 89.65,
    y: 49.05,
    size: 1.7,
    opacity: 0.16,
    delay: -7.315,
    duration: 5.6,
    driftX: 5.6,
    driftY: 9.1,
    hue: "cyan",
  },
  {
    id: 256,
    x: 26.82,
    y: 10.78,
    size: 3.0,
    opacity: 0.33,
    delay: -7.488,
    duration: 8.5,
    driftX: -11.2,
    driftY: -6.5,
    hue: "violet",
  },
  {
    id: 257,
    x: 63.99,
    y: 72.51,
    size: 1.4,
    opacity: 0.5,
    delay: -7.661,
    duration: 11.4,
    driftX: 2.1,
    driftY: 8.45,
    hue: "fuchsia",
  },
  {
    id: 258,
    x: 1.16,
    y: 34.24,
    size: 2.7,
    opacity: 0.67,
    delay: -7.834,
    duration: 5.2,
    driftX: -14.7,
    driftY: -7.15,
    hue: "cyan",
  },
  {
    id: 259,
    x: 38.33,
    y: 95.97,
    size: 1.1,
    opacity: 0.23,
    delay: -8.007,
    duration: 8.1,
    driftX: -1.4,
    driftY: 7.8,
    hue: "violet",
  },
];

const PLAY_DUST_PRESETS: PlayAmbientPreset[] = [
  {
    id: 0,
    x: 11.3,
    y: 7.9,
    size: 0.8,
    opacity: 0.12,
    delay: -0.0,
    duration: 3.2,
    driftX: -14.7,
    driftY: -14.95,
    hue: "violet",
  },
  {
    id: 1,
    x: 48.47,
    y: 69.63,
    size: 2.1,
    opacity: 0.29,
    delay: -0.173,
    duration: 6.1,
    driftX: -1.4,
    driftY: 0.0,
    hue: "fuchsia",
  },
  {
    id: 2,
    x: 85.64,
    y: 31.36,
    size: 3.4,
    opacity: 0.46,
    delay: -0.346,
    duration: 9.0,
    driftX: 11.9,
    driftY: 14.95,
    hue: "cyan",
  },
  {
    id: 3,
    x: 22.81,
    y: 93.09,
    size: 1.8,
    opacity: 0.63,
    delay: -0.519,
    duration: 11.9,
    driftX: -4.9,
    driftY: -0.65,
    hue: "violet",
  },
  {
    id: 4,
    x: 59.98,
    y: 54.82,
    size: 3.1,
    opacity: 0.19,
    delay: -0.692,
    duration: 5.7,
    driftX: 8.4,
    driftY: 14.3,
    hue: "fuchsia",
  },
  {
    id: 5,
    x: 97.15,
    y: 16.55,
    size: 1.5,
    opacity: 0.36,
    delay: -0.865,
    duration: 8.6,
    driftX: -8.4,
    driftY: -1.3,
    hue: "cyan",
  },
  {
    id: 6,
    x: 34.32,
    y: 78.28,
    size: 2.8,
    opacity: 0.53,
    delay: -1.038,
    duration: 11.5,
    driftX: 4.9,
    driftY: 13.65,
    hue: "violet",
  },
  {
    id: 7,
    x: 71.49,
    y: 40.01,
    size: 1.2,
    opacity: 0.7,
    delay: -1.211,
    duration: 5.3,
    driftX: -11.9,
    driftY: -1.95,
    hue: "fuchsia",
  },
  {
    id: 8,
    x: 8.66,
    y: 1.74,
    size: 2.5,
    opacity: 0.26,
    delay: -1.384,
    duration: 8.2,
    driftX: 1.4,
    driftY: 13.0,
    hue: "cyan",
  },
  {
    id: 9,
    x: 45.83,
    y: 63.47,
    size: 0.9,
    opacity: 0.43,
    delay: -1.557,
    duration: 11.1,
    driftX: 14.7,
    driftY: -2.6,
    hue: "violet",
  },
  {
    id: 10,
    x: 83.0,
    y: 25.2,
    size: 2.2,
    opacity: 0.6,
    delay: -1.73,
    duration: 4.9,
    driftX: -2.1,
    driftY: 12.35,
    hue: "fuchsia",
  },
  {
    id: 11,
    x: 20.17,
    y: 86.93,
    size: 3.5,
    opacity: 0.16,
    delay: -1.903,
    duration: 7.8,
    driftX: 11.2,
    driftY: -3.25,
    hue: "cyan",
  },
  {
    id: 12,
    x: 57.34,
    y: 48.66,
    size: 1.9,
    opacity: 0.33,
    delay: -2.076,
    duration: 10.7,
    driftX: -5.6,
    driftY: 11.7,
    hue: "violet",
  },
  {
    id: 13,
    x: 94.51,
    y: 10.39,
    size: 3.2,
    opacity: 0.5,
    delay: -2.249,
    duration: 4.5,
    driftX: 7.7,
    driftY: -3.9,
    hue: "fuchsia",
  },
  {
    id: 14,
    x: 31.68,
    y: 72.12,
    size: 1.6,
    opacity: 0.67,
    delay: -2.422,
    duration: 7.4,
    driftX: -9.1,
    driftY: 11.05,
    hue: "cyan",
  },
  {
    id: 15,
    x: 68.85,
    y: 33.85,
    size: 2.9,
    opacity: 0.23,
    delay: -2.595,
    duration: 10.3,
    driftX: 4.2,
    driftY: -4.55,
    hue: "violet",
  },
  {
    id: 16,
    x: 6.02,
    y: 95.58,
    size: 1.3,
    opacity: 0.4,
    delay: -2.768,
    duration: 4.1,
    driftX: -12.6,
    driftY: 10.4,
    hue: "fuchsia",
  },
  {
    id: 17,
    x: 43.19,
    y: 57.31,
    size: 2.6,
    opacity: 0.57,
    delay: -2.941,
    duration: 7.0,
    driftX: 0.7,
    driftY: -5.2,
    hue: "cyan",
  },
  {
    id: 18,
    x: 80.36,
    y: 19.04,
    size: 1.0,
    opacity: 0.13,
    delay: -3.114,
    duration: 9.9,
    driftX: 14.0,
    driftY: 9.75,
    hue: "violet",
  },
  {
    id: 19,
    x: 17.53,
    y: 80.77,
    size: 2.3,
    opacity: 0.3,
    delay: -3.287,
    duration: 3.7,
    driftX: -2.8,
    driftY: -5.85,
    hue: "fuchsia",
  },
  {
    id: 20,
    x: 54.7,
    y: 42.5,
    size: 3.6,
    opacity: 0.47,
    delay: -3.46,
    duration: 6.6,
    driftX: 10.5,
    driftY: 9.1,
    hue: "cyan",
  },
  {
    id: 21,
    x: 91.87,
    y: 4.23,
    size: 2.0,
    opacity: 0.64,
    delay: -3.633,
    duration: 9.5,
    driftX: -6.3,
    driftY: -6.5,
    hue: "violet",
  },
  {
    id: 22,
    x: 29.04,
    y: 65.96,
    size: 3.3,
    opacity: 0.2,
    delay: -3.806,
    duration: 3.3,
    driftX: 7.0,
    driftY: 8.45,
    hue: "fuchsia",
  },
  {
    id: 23,
    x: 66.21,
    y: 27.69,
    size: 1.7,
    opacity: 0.37,
    delay: -3.979,
    duration: 6.2,
    driftX: -9.8,
    driftY: -7.15,
    hue: "cyan",
  },
  {
    id: 24,
    x: 3.38,
    y: 89.42,
    size: 3.0,
    opacity: 0.54,
    delay: -4.152,
    duration: 9.1,
    driftX: 3.5,
    driftY: 7.8,
    hue: "violet",
  },
  {
    id: 25,
    x: 40.55,
    y: 51.15,
    size: 1.4,
    opacity: 0.71,
    delay: -4.325,
    duration: 12.0,
    driftX: -13.3,
    driftY: -7.8,
    hue: "fuchsia",
  },
  {
    id: 26,
    x: 77.72,
    y: 12.88,
    size: 2.7,
    opacity: 0.27,
    delay: -4.498,
    duration: 5.8,
    driftX: 0.0,
    driftY: 7.15,
    hue: "cyan",
  },
  {
    id: 27,
    x: 14.89,
    y: 74.61,
    size: 1.1,
    opacity: 0.44,
    delay: -4.671,
    duration: 8.7,
    driftX: 13.3,
    driftY: -8.45,
    hue: "violet",
  },
  {
    id: 28,
    x: 52.06,
    y: 36.34,
    size: 2.4,
    opacity: 0.61,
    delay: -4.844,
    duration: 11.6,
    driftX: -3.5,
    driftY: 6.5,
    hue: "fuchsia",
  },
  {
    id: 29,
    x: 89.23,
    y: 98.07,
    size: 0.8,
    opacity: 0.17,
    delay: -5.017,
    duration: 5.4,
    driftX: 9.8,
    driftY: -9.1,
    hue: "cyan",
  },
  {
    id: 30,
    x: 26.4,
    y: 59.8,
    size: 2.1,
    opacity: 0.34,
    delay: -5.19,
    duration: 8.3,
    driftX: -7.0,
    driftY: 5.85,
    hue: "violet",
  },
  {
    id: 31,
    x: 63.57,
    y: 21.53,
    size: 3.4,
    opacity: 0.51,
    delay: -5.363,
    duration: 11.2,
    driftX: 6.3,
    driftY: -9.75,
    hue: "fuchsia",
  },
  {
    id: 32,
    x: 0.74,
    y: 83.26,
    size: 1.8,
    opacity: 0.68,
    delay: -5.536,
    duration: 5.0,
    driftX: -10.5,
    driftY: 5.2,
    hue: "cyan",
  },
  {
    id: 33,
    x: 37.91,
    y: 44.99,
    size: 3.1,
    opacity: 0.24,
    delay: -5.709,
    duration: 7.9,
    driftX: 2.8,
    driftY: -10.4,
    hue: "violet",
  },
  {
    id: 34,
    x: 75.08,
    y: 6.72,
    size: 1.5,
    opacity: 0.41,
    delay: -5.882,
    duration: 10.8,
    driftX: -14.0,
    driftY: 4.55,
    hue: "fuchsia",
  },
  {
    id: 35,
    x: 12.25,
    y: 68.45,
    size: 2.8,
    opacity: 0.58,
    delay: -6.055,
    duration: 4.6,
    driftX: -0.7,
    driftY: -11.05,
    hue: "cyan",
  },
  {
    id: 36,
    x: 49.42,
    y: 30.18,
    size: 1.2,
    opacity: 0.14,
    delay: -6.228,
    duration: 7.5,
    driftX: 12.6,
    driftY: 3.9,
    hue: "violet",
  },
  {
    id: 37,
    x: 86.59,
    y: 91.91,
    size: 2.5,
    opacity: 0.31,
    delay: -6.401,
    duration: 10.4,
    driftX: -4.2,
    driftY: -11.7,
    hue: "fuchsia",
  },
  {
    id: 38,
    x: 23.76,
    y: 53.64,
    size: 0.9,
    opacity: 0.48,
    delay: -6.574,
    duration: 4.2,
    driftX: 9.1,
    driftY: 3.25,
    hue: "cyan",
  },
  {
    id: 39,
    x: 60.93,
    y: 15.37,
    size: 2.2,
    opacity: 0.65,
    delay: -6.747,
    duration: 7.1,
    driftX: -7.7,
    driftY: -12.35,
    hue: "violet",
  },
  {
    id: 40,
    x: 98.1,
    y: 77.1,
    size: 3.5,
    opacity: 0.21,
    delay: -6.92,
    duration: 10.0,
    driftX: 5.6,
    driftY: 2.6,
    hue: "fuchsia",
  },
  {
    id: 41,
    x: 35.27,
    y: 38.83,
    size: 1.9,
    opacity: 0.38,
    delay: -7.093,
    duration: 3.8,
    driftX: -11.2,
    driftY: -13.0,
    hue: "cyan",
  },
  {
    id: 42,
    x: 72.44,
    y: 0.56,
    size: 3.2,
    opacity: 0.55,
    delay: -7.266,
    duration: 6.7,
    driftX: 2.1,
    driftY: 1.95,
    hue: "violet",
  },
  {
    id: 43,
    x: 9.61,
    y: 62.29,
    size: 1.6,
    opacity: 0.72,
    delay: -7.439,
    duration: 9.6,
    driftX: -14.7,
    driftY: -13.65,
    hue: "fuchsia",
  },
  {
    id: 44,
    x: 46.78,
    y: 24.02,
    size: 2.9,
    opacity: 0.28,
    delay: -7.612,
    duration: 3.4,
    driftX: -1.4,
    driftY: 1.3,
    hue: "cyan",
  },
  {
    id: 45,
    x: 83.95,
    y: 85.75,
    size: 1.3,
    opacity: 0.45,
    delay: -7.785,
    duration: 6.3,
    driftX: 11.9,
    driftY: -14.3,
    hue: "violet",
  },
  {
    id: 46,
    x: 21.12,
    y: 47.48,
    size: 2.6,
    opacity: 0.62,
    delay: -7.958,
    duration: 9.2,
    driftX: -4.9,
    driftY: 0.65,
    hue: "fuchsia",
  },
  {
    id: 47,
    x: 58.29,
    y: 9.21,
    size: 1.0,
    opacity: 0.18,
    delay: -8.131,
    duration: 12.1,
    driftX: 8.4,
    driftY: -14.95,
    hue: "cyan",
  },
  {
    id: 48,
    x: 95.46,
    y: 70.94,
    size: 2.3,
    opacity: 0.35,
    delay: -8.304,
    duration: 5.9,
    driftX: -8.4,
    driftY: 0.0,
    hue: "violet",
  },
  {
    id: 49,
    x: 32.63,
    y: 32.67,
    size: 3.6,
    opacity: 0.52,
    delay: -8.477,
    duration: 8.8,
    driftX: 4.9,
    driftY: 14.95,
    hue: "fuchsia",
  },
  {
    id: 50,
    x: 69.8,
    y: 94.4,
    size: 2.0,
    opacity: 0.69,
    delay: -8.65,
    duration: 11.7,
    driftX: -11.9,
    driftY: -0.65,
    hue: "cyan",
  },
  {
    id: 51,
    x: 6.97,
    y: 56.13,
    size: 3.3,
    opacity: 0.25,
    delay: -8.823,
    duration: 5.5,
    driftX: 1.4,
    driftY: 14.3,
    hue: "violet",
  },
  {
    id: 52,
    x: 44.14,
    y: 17.86,
    size: 1.7,
    opacity: 0.42,
    delay: -8.996,
    duration: 8.4,
    driftX: 14.7,
    driftY: -1.3,
    hue: "fuchsia",
  },
  {
    id: 53,
    x: 81.31,
    y: 79.59,
    size: 3.0,
    opacity: 0.59,
    delay: -9.169,
    duration: 11.3,
    driftX: -2.1,
    driftY: 13.65,
    hue: "cyan",
  },
  {
    id: 54,
    x: 18.48,
    y: 41.32,
    size: 1.4,
    opacity: 0.15,
    delay: -0.142,
    duration: 5.1,
    driftX: 11.2,
    driftY: -1.95,
    hue: "violet",
  },
  {
    id: 55,
    x: 55.65,
    y: 3.05,
    size: 2.7,
    opacity: 0.32,
    delay: -0.315,
    duration: 8.0,
    driftX: -5.6,
    driftY: 13.0,
    hue: "fuchsia",
  },
  {
    id: 56,
    x: 92.82,
    y: 64.78,
    size: 1.1,
    opacity: 0.49,
    delay: -0.488,
    duration: 10.9,
    driftX: 7.7,
    driftY: -2.6,
    hue: "cyan",
  },
  {
    id: 57,
    x: 29.99,
    y: 26.51,
    size: 2.4,
    opacity: 0.66,
    delay: -0.661,
    duration: 4.7,
    driftX: -9.1,
    driftY: 12.35,
    hue: "violet",
  },
  {
    id: 58,
    x: 67.16,
    y: 88.24,
    size: 0.8,
    opacity: 0.22,
    delay: -0.834,
    duration: 7.6,
    driftX: 4.2,
    driftY: -3.25,
    hue: "fuchsia",
  },
  {
    id: 59,
    x: 4.33,
    y: 49.97,
    size: 2.1,
    opacity: 0.39,
    delay: -1.007,
    duration: 10.5,
    driftX: -12.6,
    driftY: 11.7,
    hue: "cyan",
  },
  {
    id: 60,
    x: 41.5,
    y: 11.7,
    size: 3.4,
    opacity: 0.56,
    delay: -1.18,
    duration: 4.3,
    driftX: 0.7,
    driftY: -3.9,
    hue: "violet",
  },
  {
    id: 61,
    x: 78.67,
    y: 73.43,
    size: 1.8,
    opacity: 0.12,
    delay: -1.353,
    duration: 7.2,
    driftX: 14.0,
    driftY: 11.05,
    hue: "fuchsia",
  },
  {
    id: 62,
    x: 15.84,
    y: 35.16,
    size: 3.1,
    opacity: 0.29,
    delay: -1.526,
    duration: 10.1,
    driftX: -2.8,
    driftY: -4.55,
    hue: "cyan",
  },
  {
    id: 63,
    x: 53.01,
    y: 96.89,
    size: 1.5,
    opacity: 0.46,
    delay: -1.699,
    duration: 3.9,
    driftX: 10.5,
    driftY: 10.4,
    hue: "violet",
  },
  {
    id: 64,
    x: 90.18,
    y: 58.62,
    size: 2.8,
    opacity: 0.63,
    delay: -1.872,
    duration: 6.8,
    driftX: -6.3,
    driftY: -5.2,
    hue: "fuchsia",
  },
  {
    id: 65,
    x: 27.35,
    y: 20.35,
    size: 1.2,
    opacity: 0.19,
    delay: -2.045,
    duration: 9.7,
    driftX: 7.0,
    driftY: 9.75,
    hue: "cyan",
  },
  {
    id: 66,
    x: 64.52,
    y: 82.08,
    size: 2.5,
    opacity: 0.36,
    delay: -2.218,
    duration: 3.5,
    driftX: -9.8,
    driftY: -5.85,
    hue: "violet",
  },
  {
    id: 67,
    x: 1.69,
    y: 43.81,
    size: 0.9,
    opacity: 0.53,
    delay: -2.391,
    duration: 6.4,
    driftX: 3.5,
    driftY: 9.1,
    hue: "fuchsia",
  },
  {
    id: 68,
    x: 38.86,
    y: 5.54,
    size: 2.2,
    opacity: 0.7,
    delay: -2.564,
    duration: 9.3,
    driftX: -13.3,
    driftY: -6.5,
    hue: "cyan",
  },
  {
    id: 69,
    x: 76.03,
    y: 67.27,
    size: 3.5,
    opacity: 0.26,
    delay: -2.737,
    duration: 12.2,
    driftX: 0.0,
    driftY: 8.45,
    hue: "violet",
  },
  {
    id: 70,
    x: 13.2,
    y: 29.0,
    size: 1.9,
    opacity: 0.43,
    delay: -2.91,
    duration: 6.0,
    driftX: 13.3,
    driftY: -7.15,
    hue: "fuchsia",
  },
  {
    id: 71,
    x: 50.37,
    y: 90.73,
    size: 3.2,
    opacity: 0.6,
    delay: -3.083,
    duration: 8.9,
    driftX: -3.5,
    driftY: 7.8,
    hue: "cyan",
  },
  {
    id: 72,
    x: 87.54,
    y: 52.46,
    size: 1.6,
    opacity: 0.16,
    delay: -3.256,
    duration: 11.8,
    driftX: 9.8,
    driftY: -7.8,
    hue: "violet",
  },
  {
    id: 73,
    x: 24.71,
    y: 14.19,
    size: 2.9,
    opacity: 0.33,
    delay: -3.429,
    duration: 5.6,
    driftX: -7.0,
    driftY: 7.15,
    hue: "fuchsia",
  },
  {
    id: 74,
    x: 61.88,
    y: 75.92,
    size: 1.3,
    opacity: 0.5,
    delay: -3.602,
    duration: 8.5,
    driftX: 6.3,
    driftY: -8.45,
    hue: "cyan",
  },
  {
    id: 75,
    x: 99.05,
    y: 37.65,
    size: 2.6,
    opacity: 0.67,
    delay: -3.775,
    duration: 11.4,
    driftX: -10.5,
    driftY: 6.5,
    hue: "violet",
  },
  {
    id: 76,
    x: 36.22,
    y: 99.38,
    size: 1.0,
    opacity: 0.23,
    delay: -3.948,
    duration: 5.2,
    driftX: 2.8,
    driftY: -9.1,
    hue: "fuchsia",
  },
  {
    id: 77,
    x: 73.39,
    y: 61.11,
    size: 2.3,
    opacity: 0.4,
    delay: -4.121,
    duration: 8.1,
    driftX: -14.0,
    driftY: 5.85,
    hue: "cyan",
  },
  {
    id: 78,
    x: 10.56,
    y: 22.84,
    size: 3.6,
    opacity: 0.57,
    delay: -4.294,
    duration: 11.0,
    driftX: -0.7,
    driftY: -9.75,
    hue: "violet",
  },
  {
    id: 79,
    x: 47.73,
    y: 84.57,
    size: 2.0,
    opacity: 0.13,
    delay: -4.467,
    duration: 4.8,
    driftX: 12.6,
    driftY: 5.2,
    hue: "fuchsia",
  },
  {
    id: 80,
    x: 84.9,
    y: 46.3,
    size: 3.3,
    opacity: 0.3,
    delay: -4.64,
    duration: 7.7,
    driftX: -4.2,
    driftY: -10.4,
    hue: "cyan",
  },
  {
    id: 81,
    x: 22.07,
    y: 8.03,
    size: 1.7,
    opacity: 0.47,
    delay: -4.813,
    duration: 10.6,
    driftX: 9.1,
    driftY: 4.55,
    hue: "violet",
  },
  {
    id: 82,
    x: 59.24,
    y: 69.76,
    size: 3.0,
    opacity: 0.64,
    delay: -4.986,
    duration: 4.4,
    driftX: -7.7,
    driftY: -11.05,
    hue: "fuchsia",
  },
  {
    id: 83,
    x: 96.41,
    y: 31.49,
    size: 1.4,
    opacity: 0.2,
    delay: -5.159,
    duration: 7.3,
    driftX: 5.6,
    driftY: 3.9,
    hue: "cyan",
  },
  {
    id: 84,
    x: 33.58,
    y: 93.22,
    size: 2.7,
    opacity: 0.37,
    delay: -5.332,
    duration: 10.2,
    driftX: -11.2,
    driftY: -11.7,
    hue: "violet",
  },
  {
    id: 85,
    x: 70.75,
    y: 54.95,
    size: 1.1,
    opacity: 0.54,
    delay: -5.505,
    duration: 4.0,
    driftX: 2.1,
    driftY: 3.25,
    hue: "fuchsia",
  },
  {
    id: 86,
    x: 7.92,
    y: 16.68,
    size: 2.4,
    opacity: 0.71,
    delay: -5.678,
    duration: 6.9,
    driftX: -14.7,
    driftY: -12.35,
    hue: "cyan",
  },
  {
    id: 87,
    x: 45.09,
    y: 78.41,
    size: 0.8,
    opacity: 0.27,
    delay: -5.851,
    duration: 9.8,
    driftX: -1.4,
    driftY: 2.6,
    hue: "violet",
  },
  {
    id: 88,
    x: 82.26,
    y: 40.14,
    size: 2.1,
    opacity: 0.44,
    delay: -6.024,
    duration: 3.6,
    driftX: 11.9,
    driftY: -13.0,
    hue: "fuchsia",
  },
  {
    id: 89,
    x: 19.43,
    y: 1.87,
    size: 3.4,
    opacity: 0.61,
    delay: -6.197,
    duration: 6.5,
    driftX: -4.9,
    driftY: 1.95,
    hue: "cyan",
  },
  {
    id: 90,
    x: 56.6,
    y: 63.6,
    size: 1.8,
    opacity: 0.17,
    delay: -6.37,
    duration: 9.4,
    driftX: 8.4,
    driftY: -13.65,
    hue: "violet",
  },
  {
    id: 91,
    x: 93.77,
    y: 25.33,
    size: 3.1,
    opacity: 0.34,
    delay: -6.543,
    duration: 3.2,
    driftX: -8.4,
    driftY: 1.3,
    hue: "fuchsia",
  },
  {
    id: 92,
    x: 30.94,
    y: 87.06,
    size: 1.5,
    opacity: 0.51,
    delay: -6.716,
    duration: 6.1,
    driftX: 4.9,
    driftY: -14.3,
    hue: "cyan",
  },
  {
    id: 93,
    x: 68.11,
    y: 48.79,
    size: 2.8,
    opacity: 0.68,
    delay: -6.889,
    duration: 9.0,
    driftX: -11.9,
    driftY: 0.65,
    hue: "violet",
  },
  {
    id: 94,
    x: 5.28,
    y: 10.52,
    size: 1.2,
    opacity: 0.24,
    delay: -7.062,
    duration: 11.9,
    driftX: 1.4,
    driftY: -14.95,
    hue: "fuchsia",
  },
  {
    id: 95,
    x: 42.45,
    y: 72.25,
    size: 2.5,
    opacity: 0.41,
    delay: -7.235,
    duration: 5.7,
    driftX: 14.7,
    driftY: 0.0,
    hue: "cyan",
  },
  {
    id: 96,
    x: 79.62,
    y: 33.98,
    size: 0.9,
    opacity: 0.58,
    delay: -7.408,
    duration: 8.6,
    driftX: -2.1,
    driftY: 14.95,
    hue: "violet",
  },
  {
    id: 97,
    x: 16.79,
    y: 95.71,
    size: 2.2,
    opacity: 0.14,
    delay: -7.581,
    duration: 11.5,
    driftX: 11.2,
    driftY: -0.65,
    hue: "fuchsia",
  },
  {
    id: 98,
    x: 53.96,
    y: 57.44,
    size: 3.5,
    opacity: 0.31,
    delay: -7.754,
    duration: 5.3,
    driftX: -5.6,
    driftY: 14.3,
    hue: "cyan",
  },
  {
    id: 99,
    x: 91.13,
    y: 19.17,
    size: 1.9,
    opacity: 0.48,
    delay: -7.927,
    duration: 8.2,
    driftX: 7.7,
    driftY: -1.3,
    hue: "violet",
  },
  {
    id: 100,
    x: 28.3,
    y: 80.9,
    size: 3.2,
    opacity: 0.65,
    delay: -8.1,
    duration: 11.1,
    driftX: -9.1,
    driftY: 13.65,
    hue: "fuchsia",
  },
  {
    id: 101,
    x: 65.47,
    y: 42.63,
    size: 1.6,
    opacity: 0.21,
    delay: -8.273,
    duration: 4.9,
    driftX: 4.2,
    driftY: -1.95,
    hue: "cyan",
  },
  {
    id: 102,
    x: 2.64,
    y: 4.36,
    size: 2.9,
    opacity: 0.38,
    delay: -8.446,
    duration: 7.8,
    driftX: -12.6,
    driftY: 13.0,
    hue: "violet",
  },
  {
    id: 103,
    x: 39.81,
    y: 66.09,
    size: 1.3,
    opacity: 0.55,
    delay: -8.619,
    duration: 10.7,
    driftX: 0.7,
    driftY: -2.6,
    hue: "fuchsia",
  },
  {
    id: 104,
    x: 76.98,
    y: 27.82,
    size: 2.6,
    opacity: 0.72,
    delay: -8.792,
    duration: 4.5,
    driftX: 14.0,
    driftY: 12.35,
    hue: "cyan",
  },
  {
    id: 105,
    x: 14.15,
    y: 89.55,
    size: 1.0,
    opacity: 0.28,
    delay: -8.965,
    duration: 7.4,
    driftX: -2.8,
    driftY: -3.25,
    hue: "violet",
  },
  {
    id: 106,
    x: 51.32,
    y: 51.28,
    size: 2.3,
    opacity: 0.45,
    delay: -9.138,
    duration: 10.3,
    driftX: 10.5,
    driftY: 11.7,
    hue: "fuchsia",
  },
  {
    id: 107,
    x: 88.49,
    y: 13.01,
    size: 3.6,
    opacity: 0.62,
    delay: -0.111,
    duration: 4.1,
    driftX: -6.3,
    driftY: -3.9,
    hue: "cyan",
  },
  {
    id: 108,
    x: 25.66,
    y: 74.74,
    size: 2.0,
    opacity: 0.18,
    delay: -0.284,
    duration: 7.0,
    driftX: 7.0,
    driftY: 11.05,
    hue: "violet",
  },
  {
    id: 109,
    x: 62.83,
    y: 36.47,
    size: 3.3,
    opacity: 0.35,
    delay: -0.457,
    duration: 9.9,
    driftX: -9.8,
    driftY: -4.55,
    hue: "fuchsia",
  },
  {
    id: 110,
    x: 0.0,
    y: 98.2,
    size: 1.7,
    opacity: 0.52,
    delay: -0.63,
    duration: 3.7,
    driftX: 3.5,
    driftY: 10.4,
    hue: "cyan",
  },
  {
    id: 111,
    x: 37.17,
    y: 59.93,
    size: 3.0,
    opacity: 0.69,
    delay: -0.803,
    duration: 6.6,
    driftX: -13.3,
    driftY: -5.2,
    hue: "violet",
  },
  {
    id: 112,
    x: 74.34,
    y: 21.66,
    size: 1.4,
    opacity: 0.25,
    delay: -0.976,
    duration: 9.5,
    driftX: 0.0,
    driftY: 9.75,
    hue: "fuchsia",
  },
  {
    id: 113,
    x: 11.51,
    y: 83.39,
    size: 2.7,
    opacity: 0.42,
    delay: -1.149,
    duration: 3.3,
    driftX: 13.3,
    driftY: -5.85,
    hue: "cyan",
  },
  {
    id: 114,
    x: 48.68,
    y: 45.12,
    size: 1.1,
    opacity: 0.59,
    delay: -1.322,
    duration: 6.2,
    driftX: -3.5,
    driftY: 9.1,
    hue: "violet",
  },
  {
    id: 115,
    x: 85.85,
    y: 6.85,
    size: 2.4,
    opacity: 0.15,
    delay: -1.495,
    duration: 9.1,
    driftX: 9.8,
    driftY: -6.5,
    hue: "fuchsia",
  },
  {
    id: 116,
    x: 23.02,
    y: 68.58,
    size: 0.8,
    opacity: 0.32,
    delay: -1.668,
    duration: 12.0,
    driftX: -7.0,
    driftY: 8.45,
    hue: "cyan",
  },
  {
    id: 117,
    x: 60.19,
    y: 30.31,
    size: 2.1,
    opacity: 0.49,
    delay: -1.841,
    duration: 5.8,
    driftX: 6.3,
    driftY: -7.15,
    hue: "violet",
  },
  {
    id: 118,
    x: 97.36,
    y: 92.04,
    size: 3.4,
    opacity: 0.66,
    delay: -2.014,
    duration: 8.7,
    driftX: -10.5,
    driftY: 7.8,
    hue: "fuchsia",
  },
  {
    id: 119,
    x: 34.53,
    y: 53.77,
    size: 1.8,
    opacity: 0.22,
    delay: -2.187,
    duration: 11.6,
    driftX: 2.8,
    driftY: -7.8,
    hue: "cyan",
  },
  {
    id: 120,
    x: 71.7,
    y: 15.5,
    size: 3.1,
    opacity: 0.39,
    delay: -2.36,
    duration: 5.4,
    driftX: -14.0,
    driftY: 7.15,
    hue: "violet",
  },
  {
    id: 121,
    x: 8.87,
    y: 77.23,
    size: 1.5,
    opacity: 0.56,
    delay: -2.533,
    duration: 8.3,
    driftX: -0.7,
    driftY: -8.45,
    hue: "fuchsia",
  },
  {
    id: 122,
    x: 46.04,
    y: 38.96,
    size: 2.8,
    opacity: 0.12,
    delay: -2.706,
    duration: 11.2,
    driftX: 12.6,
    driftY: 6.5,
    hue: "cyan",
  },
  {
    id: 123,
    x: 83.21,
    y: 0.69,
    size: 1.2,
    opacity: 0.29,
    delay: -2.879,
    duration: 5.0,
    driftX: -4.2,
    driftY: -9.1,
    hue: "violet",
  },
  {
    id: 124,
    x: 20.38,
    y: 62.42,
    size: 2.5,
    opacity: 0.46,
    delay: -3.052,
    duration: 7.9,
    driftX: 9.1,
    driftY: 5.85,
    hue: "fuchsia",
  },
  {
    id: 125,
    x: 57.55,
    y: 24.15,
    size: 0.9,
    opacity: 0.63,
    delay: -3.225,
    duration: 10.8,
    driftX: -7.7,
    driftY: -9.75,
    hue: "cyan",
  },
  {
    id: 126,
    x: 94.72,
    y: 85.88,
    size: 2.2,
    opacity: 0.19,
    delay: -3.398,
    duration: 4.6,
    driftX: 5.6,
    driftY: 5.2,
    hue: "violet",
  },
  {
    id: 127,
    x: 31.89,
    y: 47.61,
    size: 3.5,
    opacity: 0.36,
    delay: -3.571,
    duration: 7.5,
    driftX: -11.2,
    driftY: -10.4,
    hue: "fuchsia",
  },
  {
    id: 128,
    x: 69.06,
    y: 9.34,
    size: 1.9,
    opacity: 0.53,
    delay: -3.744,
    duration: 10.4,
    driftX: 2.1,
    driftY: 4.55,
    hue: "cyan",
  },
  {
    id: 129,
    x: 6.23,
    y: 71.07,
    size: 3.2,
    opacity: 0.7,
    delay: -3.917,
    duration: 4.2,
    driftX: -14.7,
    driftY: -11.05,
    hue: "violet",
  },
  {
    id: 130,
    x: 43.4,
    y: 32.8,
    size: 1.6,
    opacity: 0.26,
    delay: -4.09,
    duration: 7.1,
    driftX: -1.4,
    driftY: 3.9,
    hue: "fuchsia",
  },
  {
    id: 131,
    x: 80.57,
    y: 94.53,
    size: 2.9,
    opacity: 0.43,
    delay: -4.263,
    duration: 10.0,
    driftX: 11.9,
    driftY: -11.7,
    hue: "cyan",
  },
  {
    id: 132,
    x: 17.74,
    y: 56.26,
    size: 1.3,
    opacity: 0.6,
    delay: -4.436,
    duration: 3.8,
    driftX: -4.9,
    driftY: 3.25,
    hue: "violet",
  },
  {
    id: 133,
    x: 54.91,
    y: 17.99,
    size: 2.6,
    opacity: 0.16,
    delay: -4.609,
    duration: 6.7,
    driftX: 8.4,
    driftY: -12.35,
    hue: "fuchsia",
  },
  {
    id: 134,
    x: 92.08,
    y: 79.72,
    size: 1.0,
    opacity: 0.33,
    delay: -4.782,
    duration: 9.6,
    driftX: -8.4,
    driftY: 2.6,
    hue: "cyan",
  },
  {
    id: 135,
    x: 29.25,
    y: 41.45,
    size: 2.3,
    opacity: 0.5,
    delay: -4.955,
    duration: 3.4,
    driftX: 4.9,
    driftY: -13.0,
    hue: "violet",
  },
  {
    id: 136,
    x: 66.42,
    y: 3.18,
    size: 3.6,
    opacity: 0.67,
    delay: -5.128,
    duration: 6.3,
    driftX: -11.9,
    driftY: 1.95,
    hue: "fuchsia",
  },
  {
    id: 137,
    x: 3.59,
    y: 64.91,
    size: 2.0,
    opacity: 0.23,
    delay: -5.301,
    duration: 9.2,
    driftX: 1.4,
    driftY: -13.65,
    hue: "cyan",
  },
  {
    id: 138,
    x: 40.76,
    y: 26.64,
    size: 3.3,
    opacity: 0.4,
    delay: -5.474,
    duration: 12.1,
    driftX: 14.7,
    driftY: 1.3,
    hue: "violet",
  },
  {
    id: 139,
    x: 77.93,
    y: 88.37,
    size: 1.7,
    opacity: 0.57,
    delay: -5.647,
    duration: 5.9,
    driftX: -2.1,
    driftY: -14.3,
    hue: "fuchsia",
  },
  {
    id: 140,
    x: 15.1,
    y: 50.1,
    size: 3.0,
    opacity: 0.13,
    delay: -5.82,
    duration: 8.8,
    driftX: 11.2,
    driftY: 0.65,
    hue: "cyan",
  },
  {
    id: 141,
    x: 52.27,
    y: 11.83,
    size: 1.4,
    opacity: 0.3,
    delay: -5.993,
    duration: 11.7,
    driftX: -5.6,
    driftY: -14.95,
    hue: "violet",
  },
  {
    id: 142,
    x: 89.44,
    y: 73.56,
    size: 2.7,
    opacity: 0.47,
    delay: -6.166,
    duration: 5.5,
    driftX: 7.7,
    driftY: 0.0,
    hue: "fuchsia",
  },
  {
    id: 143,
    x: 26.61,
    y: 35.29,
    size: 1.1,
    opacity: 0.64,
    delay: -6.339,
    duration: 8.4,
    driftX: -9.1,
    driftY: 14.95,
    hue: "cyan",
  },
  {
    id: 144,
    x: 63.78,
    y: 97.02,
    size: 2.4,
    opacity: 0.2,
    delay: -6.512,
    duration: 11.3,
    driftX: 4.2,
    driftY: -0.65,
    hue: "violet",
  },
  {
    id: 145,
    x: 0.95,
    y: 58.75,
    size: 0.8,
    opacity: 0.37,
    delay: -6.685,
    duration: 5.1,
    driftX: -12.6,
    driftY: 14.3,
    hue: "fuchsia",
  },
  {
    id: 146,
    x: 38.12,
    y: 20.48,
    size: 2.1,
    opacity: 0.54,
    delay: -6.858,
    duration: 8.0,
    driftX: 0.7,
    driftY: -1.3,
    hue: "cyan",
  },
  {
    id: 147,
    x: 75.29,
    y: 82.21,
    size: 3.4,
    opacity: 0.71,
    delay: -7.031,
    duration: 10.9,
    driftX: 14.0,
    driftY: 13.65,
    hue: "violet",
  },
  {
    id: 148,
    x: 12.46,
    y: 43.94,
    size: 1.8,
    opacity: 0.27,
    delay: -7.204,
    duration: 4.7,
    driftX: -2.8,
    driftY: -1.95,
    hue: "fuchsia",
  },
  {
    id: 149,
    x: 49.63,
    y: 5.67,
    size: 3.1,
    opacity: 0.44,
    delay: -7.377,
    duration: 7.6,
    driftX: 10.5,
    driftY: 13.0,
    hue: "cyan",
  },
  {
    id: 150,
    x: 86.8,
    y: 67.4,
    size: 1.5,
    opacity: 0.61,
    delay: -7.55,
    duration: 10.5,
    driftX: -6.3,
    driftY: -2.6,
    hue: "violet",
  },
  {
    id: 151,
    x: 23.97,
    y: 29.13,
    size: 2.8,
    opacity: 0.17,
    delay: -7.723,
    duration: 4.3,
    driftX: 7.0,
    driftY: 12.35,
    hue: "fuchsia",
  },
  {
    id: 152,
    x: 61.14,
    y: 90.86,
    size: 1.2,
    opacity: 0.34,
    delay: -7.896,
    duration: 7.2,
    driftX: -9.8,
    driftY: -3.25,
    hue: "cyan",
  },
  {
    id: 153,
    x: 98.31,
    y: 52.59,
    size: 2.5,
    opacity: 0.51,
    delay: -8.069,
    duration: 10.1,
    driftX: 3.5,
    driftY: 11.7,
    hue: "violet",
  },
  {
    id: 154,
    x: 35.48,
    y: 14.32,
    size: 0.9,
    opacity: 0.68,
    delay: -8.242,
    duration: 3.9,
    driftX: -13.3,
    driftY: -3.9,
    hue: "fuchsia",
  },
  {
    id: 155,
    x: 72.65,
    y: 76.05,
    size: 2.2,
    opacity: 0.24,
    delay: -8.415,
    duration: 6.8,
    driftX: 0.0,
    driftY: 11.05,
    hue: "cyan",
  },
  {
    id: 156,
    x: 9.82,
    y: 37.78,
    size: 3.5,
    opacity: 0.41,
    delay: -8.588,
    duration: 9.7,
    driftX: 13.3,
    driftY: -4.55,
    hue: "violet",
  },
  {
    id: 157,
    x: 46.99,
    y: 99.51,
    size: 1.9,
    opacity: 0.58,
    delay: -8.761,
    duration: 3.5,
    driftX: -3.5,
    driftY: 10.4,
    hue: "fuchsia",
  },
  {
    id: 158,
    x: 84.16,
    y: 61.24,
    size: 3.2,
    opacity: 0.14,
    delay: -8.934,
    duration: 6.4,
    driftX: 9.8,
    driftY: -5.2,
    hue: "cyan",
  },
  {
    id: 159,
    x: 21.33,
    y: 22.97,
    size: 1.6,
    opacity: 0.31,
    delay: -9.107,
    duration: 9.3,
    driftX: -7.0,
    driftY: 9.75,
    hue: "violet",
  },
  {
    id: 160,
    x: 58.5,
    y: 84.7,
    size: 2.9,
    opacity: 0.48,
    delay: -0.08,
    duration: 12.2,
    driftX: 6.3,
    driftY: -5.85,
    hue: "fuchsia",
  },
  {
    id: 161,
    x: 95.67,
    y: 46.43,
    size: 1.3,
    opacity: 0.65,
    delay: -0.253,
    duration: 6.0,
    driftX: -10.5,
    driftY: 9.1,
    hue: "cyan",
  },
  {
    id: 162,
    x: 32.84,
    y: 8.16,
    size: 2.6,
    opacity: 0.21,
    delay: -0.426,
    duration: 8.9,
    driftX: 2.8,
    driftY: -6.5,
    hue: "violet",
  },
  {
    id: 163,
    x: 70.01,
    y: 69.89,
    size: 1.0,
    opacity: 0.38,
    delay: -0.599,
    duration: 11.8,
    driftX: -14.0,
    driftY: 8.45,
    hue: "fuchsia",
  },
  {
    id: 164,
    x: 7.18,
    y: 31.62,
    size: 2.3,
    opacity: 0.55,
    delay: -0.772,
    duration: 5.6,
    driftX: -0.7,
    driftY: -7.15,
    hue: "cyan",
  },
  {
    id: 165,
    x: 44.35,
    y: 93.35,
    size: 3.6,
    opacity: 0.72,
    delay: -0.945,
    duration: 8.5,
    driftX: 12.6,
    driftY: 7.8,
    hue: "violet",
  },
  {
    id: 166,
    x: 81.52,
    y: 55.08,
    size: 2.0,
    opacity: 0.28,
    delay: -1.118,
    duration: 11.4,
    driftX: -4.2,
    driftY: -7.8,
    hue: "fuchsia",
  },
  {
    id: 167,
    x: 18.69,
    y: 16.81,
    size: 3.3,
    opacity: 0.45,
    delay: -1.291,
    duration: 5.2,
    driftX: 9.1,
    driftY: 7.15,
    hue: "cyan",
  },
  {
    id: 168,
    x: 55.86,
    y: 78.54,
    size: 1.7,
    opacity: 0.62,
    delay: -1.464,
    duration: 8.1,
    driftX: -7.7,
    driftY: -8.45,
    hue: "violet",
  },
  {
    id: 169,
    x: 93.03,
    y: 40.27,
    size: 3.0,
    opacity: 0.18,
    delay: -1.637,
    duration: 11.0,
    driftX: 5.6,
    driftY: 6.5,
    hue: "fuchsia",
  },
  {
    id: 170,
    x: 30.2,
    y: 2.0,
    size: 1.4,
    opacity: 0.35,
    delay: -1.81,
    duration: 4.8,
    driftX: -11.2,
    driftY: -9.1,
    hue: "cyan",
  },
  {
    id: 171,
    x: 67.37,
    y: 63.73,
    size: 2.7,
    opacity: 0.52,
    delay: -1.983,
    duration: 7.7,
    driftX: 2.1,
    driftY: 5.85,
    hue: "violet",
  },
  {
    id: 172,
    x: 4.54,
    y: 25.46,
    size: 1.1,
    opacity: 0.69,
    delay: -2.156,
    duration: 10.6,
    driftX: -14.7,
    driftY: -9.75,
    hue: "fuchsia",
  },
  {
    id: 173,
    x: 41.71,
    y: 87.19,
    size: 2.4,
    opacity: 0.25,
    delay: -2.329,
    duration: 4.4,
    driftX: -1.4,
    driftY: 5.2,
    hue: "cyan",
  },
  {
    id: 174,
    x: 78.88,
    y: 48.92,
    size: 0.8,
    opacity: 0.42,
    delay: -2.502,
    duration: 7.3,
    driftX: 11.9,
    driftY: -10.4,
    hue: "violet",
  },
  {
    id: 175,
    x: 16.05,
    y: 10.65,
    size: 2.1,
    opacity: 0.59,
    delay: -2.675,
    duration: 10.2,
    driftX: -4.9,
    driftY: 4.55,
    hue: "fuchsia",
  },
  {
    id: 176,
    x: 53.22,
    y: 72.38,
    size: 3.4,
    opacity: 0.15,
    delay: -2.848,
    duration: 4.0,
    driftX: 8.4,
    driftY: -11.05,
    hue: "cyan",
  },
  {
    id: 177,
    x: 90.39,
    y: 34.11,
    size: 1.8,
    opacity: 0.32,
    delay: -3.021,
    duration: 6.9,
    driftX: -8.4,
    driftY: 3.9,
    hue: "violet",
  },
  {
    id: 178,
    x: 27.56,
    y: 95.84,
    size: 3.1,
    opacity: 0.49,
    delay: -3.194,
    duration: 9.8,
    driftX: 4.9,
    driftY: -11.7,
    hue: "fuchsia",
  },
  {
    id: 179,
    x: 64.73,
    y: 57.57,
    size: 1.5,
    opacity: 0.66,
    delay: -3.367,
    duration: 3.6,
    driftX: -11.9,
    driftY: 3.25,
    hue: "cyan",
  },
  {
    id: 180,
    x: 1.9,
    y: 19.3,
    size: 2.8,
    opacity: 0.22,
    delay: -3.54,
    duration: 6.5,
    driftX: 1.4,
    driftY: -12.35,
    hue: "violet",
  },
  {
    id: 181,
    x: 39.07,
    y: 81.03,
    size: 1.2,
    opacity: 0.39,
    delay: -3.713,
    duration: 9.4,
    driftX: 14.7,
    driftY: 2.6,
    hue: "fuchsia",
  },
  {
    id: 182,
    x: 76.24,
    y: 42.76,
    size: 2.5,
    opacity: 0.56,
    delay: -3.886,
    duration: 3.2,
    driftX: -2.1,
    driftY: -13.0,
    hue: "cyan",
  },
  {
    id: 183,
    x: 13.41,
    y: 4.49,
    size: 0.9,
    opacity: 0.12,
    delay: -4.059,
    duration: 6.1,
    driftX: 11.2,
    driftY: 1.95,
    hue: "violet",
  },
  {
    id: 184,
    x: 50.58,
    y: 66.22,
    size: 2.2,
    opacity: 0.29,
    delay: -4.232,
    duration: 9.0,
    driftX: -5.6,
    driftY: -13.65,
    hue: "fuchsia",
  },
  {
    id: 185,
    x: 87.75,
    y: 27.95,
    size: 3.5,
    opacity: 0.46,
    delay: -4.405,
    duration: 11.9,
    driftX: 7.7,
    driftY: 1.3,
    hue: "cyan",
  },
  {
    id: 186,
    x: 24.92,
    y: 89.68,
    size: 1.9,
    opacity: 0.63,
    delay: -4.578,
    duration: 5.7,
    driftX: -9.1,
    driftY: -14.3,
    hue: "violet",
  },
  {
    id: 187,
    x: 62.09,
    y: 51.41,
    size: 3.2,
    opacity: 0.19,
    delay: -4.751,
    duration: 8.6,
    driftX: 4.2,
    driftY: 0.65,
    hue: "fuchsia",
  },
  {
    id: 188,
    x: 99.26,
    y: 13.14,
    size: 1.6,
    opacity: 0.36,
    delay: -4.924,
    duration: 11.5,
    driftX: -12.6,
    driftY: -14.95,
    hue: "cyan",
  },
  {
    id: 189,
    x: 36.43,
    y: 74.87,
    size: 2.9,
    opacity: 0.53,
    delay: -5.097,
    duration: 5.3,
    driftX: 0.7,
    driftY: 0.0,
    hue: "violet",
  },
  {
    id: 190,
    x: 73.6,
    y: 36.6,
    size: 1.3,
    opacity: 0.7,
    delay: -5.27,
    duration: 8.2,
    driftX: 14.0,
    driftY: 14.95,
    hue: "fuchsia",
  },
  {
    id: 191,
    x: 10.77,
    y: 98.33,
    size: 2.6,
    opacity: 0.26,
    delay: -5.443,
    duration: 11.1,
    driftX: -2.8,
    driftY: -0.65,
    hue: "cyan",
  },
  {
    id: 192,
    x: 47.94,
    y: 60.06,
    size: 1.0,
    opacity: 0.43,
    delay: -5.616,
    duration: 4.9,
    driftX: 10.5,
    driftY: 14.3,
    hue: "violet",
  },
  {
    id: 193,
    x: 85.11,
    y: 21.79,
    size: 2.3,
    opacity: 0.6,
    delay: -5.789,
    duration: 7.8,
    driftX: -6.3,
    driftY: -1.3,
    hue: "fuchsia",
  },
  {
    id: 194,
    x: 22.28,
    y: 83.52,
    size: 3.6,
    opacity: 0.16,
    delay: -5.962,
    duration: 10.7,
    driftX: 7.0,
    driftY: 13.65,
    hue: "cyan",
  },
  {
    id: 195,
    x: 59.45,
    y: 45.25,
    size: 2.0,
    opacity: 0.33,
    delay: -6.135,
    duration: 4.5,
    driftX: -9.8,
    driftY: -1.95,
    hue: "violet",
  },
  {
    id: 196,
    x: 96.62,
    y: 6.98,
    size: 3.3,
    opacity: 0.5,
    delay: -6.308,
    duration: 7.4,
    driftX: 3.5,
    driftY: 13.0,
    hue: "fuchsia",
  },
  {
    id: 197,
    x: 33.79,
    y: 68.71,
    size: 1.7,
    opacity: 0.67,
    delay: -6.481,
    duration: 10.3,
    driftX: -13.3,
    driftY: -2.6,
    hue: "cyan",
  },
  {
    id: 198,
    x: 70.96,
    y: 30.44,
    size: 3.0,
    opacity: 0.23,
    delay: -6.654,
    duration: 4.1,
    driftX: 0.0,
    driftY: 12.35,
    hue: "violet",
  },
  {
    id: 199,
    x: 8.13,
    y: 92.17,
    size: 1.4,
    opacity: 0.4,
    delay: -6.827,
    duration: 7.0,
    driftX: 13.3,
    driftY: -3.25,
    hue: "fuchsia",
  },
  {
    id: 200,
    x: 45.3,
    y: 53.9,
    size: 2.7,
    opacity: 0.57,
    delay: -7.0,
    duration: 9.9,
    driftX: -3.5,
    driftY: 11.7,
    hue: "cyan",
  },
  {
    id: 201,
    x: 82.47,
    y: 15.63,
    size: 1.1,
    opacity: 0.13,
    delay: -7.173,
    duration: 3.7,
    driftX: 9.8,
    driftY: -3.9,
    hue: "violet",
  },
  {
    id: 202,
    x: 19.64,
    y: 77.36,
    size: 2.4,
    opacity: 0.3,
    delay: -7.346,
    duration: 6.6,
    driftX: -7.0,
    driftY: 11.05,
    hue: "fuchsia",
  },
  {
    id: 203,
    x: 56.81,
    y: 39.09,
    size: 0.8,
    opacity: 0.47,
    delay: -7.519,
    duration: 9.5,
    driftX: 6.3,
    driftY: -4.55,
    hue: "cyan",
  },
  {
    id: 204,
    x: 93.98,
    y: 0.82,
    size: 2.1,
    opacity: 0.64,
    delay: -7.692,
    duration: 3.3,
    driftX: -10.5,
    driftY: 10.4,
    hue: "violet",
  },
  {
    id: 205,
    x: 31.15,
    y: 62.55,
    size: 3.4,
    opacity: 0.2,
    delay: -7.865,
    duration: 6.2,
    driftX: 2.8,
    driftY: -5.2,
    hue: "fuchsia",
  },
  {
    id: 206,
    x: 68.32,
    y: 24.28,
    size: 1.8,
    opacity: 0.37,
    delay: -8.038,
    duration: 9.1,
    driftX: -14.0,
    driftY: 9.75,
    hue: "cyan",
  },
  {
    id: 207,
    x: 5.49,
    y: 86.01,
    size: 3.1,
    opacity: 0.54,
    delay: -8.211,
    duration: 12.0,
    driftX: -0.7,
    driftY: -5.85,
    hue: "violet",
  },
  {
    id: 208,
    x: 42.66,
    y: 47.74,
    size: 1.5,
    opacity: 0.71,
    delay: -8.384,
    duration: 5.8,
    driftX: 12.6,
    driftY: 9.1,
    hue: "fuchsia",
  },
  {
    id: 209,
    x: 79.83,
    y: 9.47,
    size: 2.8,
    opacity: 0.27,
    delay: -8.557,
    duration: 8.7,
    driftX: -4.2,
    driftY: -6.5,
    hue: "cyan",
  },
  {
    id: 210,
    x: 17.0,
    y: 71.2,
    size: 1.2,
    opacity: 0.44,
    delay: -8.73,
    duration: 11.6,
    driftX: 9.1,
    driftY: 8.45,
    hue: "violet",
  },
  {
    id: 211,
    x: 54.17,
    y: 32.93,
    size: 2.5,
    opacity: 0.61,
    delay: -8.903,
    duration: 5.4,
    driftX: -7.7,
    driftY: -7.15,
    hue: "fuchsia",
  },
  {
    id: 212,
    x: 91.34,
    y: 94.66,
    size: 0.9,
    opacity: 0.17,
    delay: -9.076,
    duration: 8.3,
    driftX: 5.6,
    driftY: 7.8,
    hue: "cyan",
  },
  {
    id: 213,
    x: 28.51,
    y: 56.39,
    size: 2.2,
    opacity: 0.34,
    delay: -0.049,
    duration: 11.2,
    driftX: -11.2,
    driftY: -7.8,
    hue: "violet",
  },
  {
    id: 214,
    x: 65.68,
    y: 18.12,
    size: 3.5,
    opacity: 0.51,
    delay: -0.222,
    duration: 5.0,
    driftX: 2.1,
    driftY: 7.15,
    hue: "fuchsia",
  },
  {
    id: 215,
    x: 2.85,
    y: 79.85,
    size: 1.9,
    opacity: 0.68,
    delay: -0.395,
    duration: 7.9,
    driftX: -14.7,
    driftY: -8.45,
    hue: "cyan",
  },
  {
    id: 216,
    x: 40.02,
    y: 41.58,
    size: 3.2,
    opacity: 0.24,
    delay: -0.568,
    duration: 10.8,
    driftX: -1.4,
    driftY: 6.5,
    hue: "violet",
  },
  {
    id: 217,
    x: 77.19,
    y: 3.31,
    size: 1.6,
    opacity: 0.41,
    delay: -0.741,
    duration: 4.6,
    driftX: 11.9,
    driftY: -9.1,
    hue: "fuchsia",
  },
  {
    id: 218,
    x: 14.36,
    y: 65.04,
    size: 2.9,
    opacity: 0.58,
    delay: -0.914,
    duration: 7.5,
    driftX: -4.9,
    driftY: 5.85,
    hue: "cyan",
  },
  {
    id: 219,
    x: 51.53,
    y: 26.77,
    size: 1.3,
    opacity: 0.14,
    delay: -1.087,
    duration: 10.4,
    driftX: 8.4,
    driftY: -9.75,
    hue: "violet",
  },
];

const PLAY_ORBIT_PRESETS: PlayAmbientPreset[] = [
  {
    id: 0,
    x: 11.3,
    y: 7.9,
    size: 0.8,
    opacity: 0.12,
    delay: -0.0,
    duration: 3.2,
    driftX: -14.7,
    driftY: -14.95,
    hue: "violet",
  },
  {
    id: 1,
    x: 48.47,
    y: 69.63,
    size: 2.1,
    opacity: 0.29,
    delay: -0.173,
    duration: 6.1,
    driftX: -1.4,
    driftY: 0.0,
    hue: "fuchsia",
  },
  {
    id: 2,
    x: 85.64,
    y: 31.36,
    size: 3.4,
    opacity: 0.46,
    delay: -0.346,
    duration: 9.0,
    driftX: 11.9,
    driftY: 14.95,
    hue: "cyan",
  },
  {
    id: 3,
    x: 22.81,
    y: 93.09,
    size: 1.8,
    opacity: 0.63,
    delay: -0.519,
    duration: 11.9,
    driftX: -4.9,
    driftY: -0.65,
    hue: "violet",
  },
  {
    id: 4,
    x: 59.98,
    y: 54.82,
    size: 3.1,
    opacity: 0.19,
    delay: -0.692,
    duration: 5.7,
    driftX: 8.4,
    driftY: 14.3,
    hue: "fuchsia",
  },
  {
    id: 5,
    x: 97.15,
    y: 16.55,
    size: 1.5,
    opacity: 0.36,
    delay: -0.865,
    duration: 8.6,
    driftX: -8.4,
    driftY: -1.3,
    hue: "cyan",
  },
  {
    id: 6,
    x: 34.32,
    y: 78.28,
    size: 2.8,
    opacity: 0.53,
    delay: -1.038,
    duration: 11.5,
    driftX: 4.9,
    driftY: 13.65,
    hue: "violet",
  },
  {
    id: 7,
    x: 71.49,
    y: 40.01,
    size: 1.2,
    opacity: 0.7,
    delay: -1.211,
    duration: 5.3,
    driftX: -11.9,
    driftY: -1.95,
    hue: "fuchsia",
  },
  {
    id: 8,
    x: 8.66,
    y: 1.74,
    size: 2.5,
    opacity: 0.26,
    delay: -1.384,
    duration: 8.2,
    driftX: 1.4,
    driftY: 13.0,
    hue: "cyan",
  },
  {
    id: 9,
    x: 45.83,
    y: 63.47,
    size: 0.9,
    opacity: 0.43,
    delay: -1.557,
    duration: 11.1,
    driftX: 14.7,
    driftY: -2.6,
    hue: "violet",
  },
  {
    id: 10,
    x: 83.0,
    y: 25.2,
    size: 2.2,
    opacity: 0.6,
    delay: -1.73,
    duration: 4.9,
    driftX: -2.1,
    driftY: 12.35,
    hue: "fuchsia",
  },
  {
    id: 11,
    x: 20.17,
    y: 86.93,
    size: 3.5,
    opacity: 0.16,
    delay: -1.903,
    duration: 7.8,
    driftX: 11.2,
    driftY: -3.25,
    hue: "cyan",
  },
  {
    id: 12,
    x: 57.34,
    y: 48.66,
    size: 1.9,
    opacity: 0.33,
    delay: -2.076,
    duration: 10.7,
    driftX: -5.6,
    driftY: 11.7,
    hue: "violet",
  },
  {
    id: 13,
    x: 94.51,
    y: 10.39,
    size: 3.2,
    opacity: 0.5,
    delay: -2.249,
    duration: 4.5,
    driftX: 7.7,
    driftY: -3.9,
    hue: "fuchsia",
  },
  {
    id: 14,
    x: 31.68,
    y: 72.12,
    size: 1.6,
    opacity: 0.67,
    delay: -2.422,
    duration: 7.4,
    driftX: -9.1,
    driftY: 11.05,
    hue: "cyan",
  },
  {
    id: 15,
    x: 68.85,
    y: 33.85,
    size: 2.9,
    opacity: 0.23,
    delay: -2.595,
    duration: 10.3,
    driftX: 4.2,
    driftY: -4.55,
    hue: "violet",
  },
  {
    id: 16,
    x: 6.02,
    y: 95.58,
    size: 1.3,
    opacity: 0.4,
    delay: -2.768,
    duration: 4.1,
    driftX: -12.6,
    driftY: 10.4,
    hue: "fuchsia",
  },
  {
    id: 17,
    x: 43.19,
    y: 57.31,
    size: 2.6,
    opacity: 0.57,
    delay: -2.941,
    duration: 7.0,
    driftX: 0.7,
    driftY: -5.2,
    hue: "cyan",
  },
  {
    id: 18,
    x: 80.36,
    y: 19.04,
    size: 1.0,
    opacity: 0.13,
    delay: -3.114,
    duration: 9.9,
    driftX: 14.0,
    driftY: 9.75,
    hue: "violet",
  },
  {
    id: 19,
    x: 17.53,
    y: 80.77,
    size: 2.3,
    opacity: 0.3,
    delay: -3.287,
    duration: 3.7,
    driftX: -2.8,
    driftY: -5.85,
    hue: "fuchsia",
  },
  {
    id: 20,
    x: 54.7,
    y: 42.5,
    size: 3.6,
    opacity: 0.47,
    delay: -3.46,
    duration: 6.6,
    driftX: 10.5,
    driftY: 9.1,
    hue: "cyan",
  },
  {
    id: 21,
    x: 91.87,
    y: 4.23,
    size: 2.0,
    opacity: 0.64,
    delay: -3.633,
    duration: 9.5,
    driftX: -6.3,
    driftY: -6.5,
    hue: "violet",
  },
  {
    id: 22,
    x: 29.04,
    y: 65.96,
    size: 3.3,
    opacity: 0.2,
    delay: -3.806,
    duration: 3.3,
    driftX: 7.0,
    driftY: 8.45,
    hue: "fuchsia",
  },
  {
    id: 23,
    x: 66.21,
    y: 27.69,
    size: 1.7,
    opacity: 0.37,
    delay: -3.979,
    duration: 6.2,
    driftX: -9.8,
    driftY: -7.15,
    hue: "cyan",
  },
  {
    id: 24,
    x: 3.38,
    y: 89.42,
    size: 3.0,
    opacity: 0.54,
    delay: -4.152,
    duration: 9.1,
    driftX: 3.5,
    driftY: 7.8,
    hue: "violet",
  },
  {
    id: 25,
    x: 40.55,
    y: 51.15,
    size: 1.4,
    opacity: 0.71,
    delay: -4.325,
    duration: 12.0,
    driftX: -13.3,
    driftY: -7.8,
    hue: "fuchsia",
  },
  {
    id: 26,
    x: 77.72,
    y: 12.88,
    size: 2.7,
    opacity: 0.27,
    delay: -4.498,
    duration: 5.8,
    driftX: 0.0,
    driftY: 7.15,
    hue: "cyan",
  },
  {
    id: 27,
    x: 14.89,
    y: 74.61,
    size: 1.1,
    opacity: 0.44,
    delay: -4.671,
    duration: 8.7,
    driftX: 13.3,
    driftY: -8.45,
    hue: "violet",
  },
  {
    id: 28,
    x: 52.06,
    y: 36.34,
    size: 2.4,
    opacity: 0.61,
    delay: -4.844,
    duration: 11.6,
    driftX: -3.5,
    driftY: 6.5,
    hue: "fuchsia",
  },
  {
    id: 29,
    x: 89.23,
    y: 98.07,
    size: 0.8,
    opacity: 0.17,
    delay: -5.017,
    duration: 5.4,
    driftX: 9.8,
    driftY: -9.1,
    hue: "cyan",
  },
  {
    id: 30,
    x: 26.4,
    y: 59.8,
    size: 2.1,
    opacity: 0.34,
    delay: -5.19,
    duration: 8.3,
    driftX: -7.0,
    driftY: 5.85,
    hue: "violet",
  },
  {
    id: 31,
    x: 63.57,
    y: 21.53,
    size: 3.4,
    opacity: 0.51,
    delay: -5.363,
    duration: 11.2,
    driftX: 6.3,
    driftY: -9.75,
    hue: "fuchsia",
  },
  {
    id: 32,
    x: 0.74,
    y: 83.26,
    size: 1.8,
    opacity: 0.68,
    delay: -5.536,
    duration: 5.0,
    driftX: -10.5,
    driftY: 5.2,
    hue: "cyan",
  },
  {
    id: 33,
    x: 37.91,
    y: 44.99,
    size: 3.1,
    opacity: 0.24,
    delay: -5.709,
    duration: 7.9,
    driftX: 2.8,
    driftY: -10.4,
    hue: "violet",
  },
  {
    id: 34,
    x: 75.08,
    y: 6.72,
    size: 1.5,
    opacity: 0.41,
    delay: -5.882,
    duration: 10.8,
    driftX: -14.0,
    driftY: 4.55,
    hue: "fuchsia",
  },
  {
    id: 35,
    x: 12.25,
    y: 68.45,
    size: 2.8,
    opacity: 0.58,
    delay: -6.055,
    duration: 4.6,
    driftX: -0.7,
    driftY: -11.05,
    hue: "cyan",
  },
  {
    id: 36,
    x: 49.42,
    y: 30.18,
    size: 1.2,
    opacity: 0.14,
    delay: -6.228,
    duration: 7.5,
    driftX: 12.6,
    driftY: 3.9,
    hue: "violet",
  },
  {
    id: 37,
    x: 86.59,
    y: 91.91,
    size: 2.5,
    opacity: 0.31,
    delay: -6.401,
    duration: 10.4,
    driftX: -4.2,
    driftY: -11.7,
    hue: "fuchsia",
  },
  {
    id: 38,
    x: 23.76,
    y: 53.64,
    size: 0.9,
    opacity: 0.48,
    delay: -6.574,
    duration: 4.2,
    driftX: 9.1,
    driftY: 3.25,
    hue: "cyan",
  },
  {
    id: 39,
    x: 60.93,
    y: 15.37,
    size: 2.2,
    opacity: 0.65,
    delay: -6.747,
    duration: 7.1,
    driftX: -7.7,
    driftY: -12.35,
    hue: "violet",
  },
  {
    id: 40,
    x: 98.1,
    y: 77.1,
    size: 3.5,
    opacity: 0.21,
    delay: -6.92,
    duration: 10.0,
    driftX: 5.6,
    driftY: 2.6,
    hue: "fuchsia",
  },
  {
    id: 41,
    x: 35.27,
    y: 38.83,
    size: 1.9,
    opacity: 0.38,
    delay: -7.093,
    duration: 3.8,
    driftX: -11.2,
    driftY: -13.0,
    hue: "cyan",
  },
  {
    id: 42,
    x: 72.44,
    y: 0.56,
    size: 3.2,
    opacity: 0.55,
    delay: -7.266,
    duration: 6.7,
    driftX: 2.1,
    driftY: 1.95,
    hue: "violet",
  },
  {
    id: 43,
    x: 9.61,
    y: 62.29,
    size: 1.6,
    opacity: 0.72,
    delay: -7.439,
    duration: 9.6,
    driftX: -14.7,
    driftY: -13.65,
    hue: "fuchsia",
  },
  {
    id: 44,
    x: 46.78,
    y: 24.02,
    size: 2.9,
    opacity: 0.28,
    delay: -7.612,
    duration: 3.4,
    driftX: -1.4,
    driftY: 1.3,
    hue: "cyan",
  },
  {
    id: 45,
    x: 83.95,
    y: 85.75,
    size: 1.3,
    opacity: 0.45,
    delay: -7.785,
    duration: 6.3,
    driftX: 11.9,
    driftY: -14.3,
    hue: "violet",
  },
  {
    id: 46,
    x: 21.12,
    y: 47.48,
    size: 2.6,
    opacity: 0.62,
    delay: -7.958,
    duration: 9.2,
    driftX: -4.9,
    driftY: 0.65,
    hue: "fuchsia",
  },
  {
    id: 47,
    x: 58.29,
    y: 9.21,
    size: 1.0,
    opacity: 0.18,
    delay: -8.131,
    duration: 12.1,
    driftX: 8.4,
    driftY: -14.95,
    hue: "cyan",
  },
  {
    id: 48,
    x: 95.46,
    y: 70.94,
    size: 2.3,
    opacity: 0.35,
    delay: -8.304,
    duration: 5.9,
    driftX: -8.4,
    driftY: 0.0,
    hue: "violet",
  },
  {
    id: 49,
    x: 32.63,
    y: 32.67,
    size: 3.6,
    opacity: 0.52,
    delay: -8.477,
    duration: 8.8,
    driftX: 4.9,
    driftY: 14.95,
    hue: "fuchsia",
  },
  {
    id: 50,
    x: 69.8,
    y: 94.4,
    size: 2.0,
    opacity: 0.69,
    delay: -8.65,
    duration: 11.7,
    driftX: -11.9,
    driftY: -0.65,
    hue: "cyan",
  },
  {
    id: 51,
    x: 6.97,
    y: 56.13,
    size: 3.3,
    opacity: 0.25,
    delay: -8.823,
    duration: 5.5,
    driftX: 1.4,
    driftY: 14.3,
    hue: "violet",
  },
  {
    id: 52,
    x: 44.14,
    y: 17.86,
    size: 1.7,
    opacity: 0.42,
    delay: -8.996,
    duration: 8.4,
    driftX: 14.7,
    driftY: -1.3,
    hue: "fuchsia",
  },
  {
    id: 53,
    x: 81.31,
    y: 79.59,
    size: 3.0,
    opacity: 0.59,
    delay: -9.169,
    duration: 11.3,
    driftX: -2.1,
    driftY: 13.65,
    hue: "cyan",
  },
  {
    id: 54,
    x: 18.48,
    y: 41.32,
    size: 1.4,
    opacity: 0.15,
    delay: -0.142,
    duration: 5.1,
    driftX: 11.2,
    driftY: -1.95,
    hue: "violet",
  },
  {
    id: 55,
    x: 55.65,
    y: 3.05,
    size: 2.7,
    opacity: 0.32,
    delay: -0.315,
    duration: 8.0,
    driftX: -5.6,
    driftY: 13.0,
    hue: "fuchsia",
  },
  {
    id: 56,
    x: 92.82,
    y: 64.78,
    size: 1.1,
    opacity: 0.49,
    delay: -0.488,
    duration: 10.9,
    driftX: 7.7,
    driftY: -2.6,
    hue: "cyan",
  },
  {
    id: 57,
    x: 29.99,
    y: 26.51,
    size: 2.4,
    opacity: 0.66,
    delay: -0.661,
    duration: 4.7,
    driftX: -9.1,
    driftY: 12.35,
    hue: "violet",
  },
  {
    id: 58,
    x: 67.16,
    y: 88.24,
    size: 0.8,
    opacity: 0.22,
    delay: -0.834,
    duration: 7.6,
    driftX: 4.2,
    driftY: -3.25,
    hue: "fuchsia",
  },
  {
    id: 59,
    x: 4.33,
    y: 49.97,
    size: 2.1,
    opacity: 0.39,
    delay: -1.007,
    duration: 10.5,
    driftX: -12.6,
    driftY: 11.7,
    hue: "cyan",
  },
  {
    id: 60,
    x: 41.5,
    y: 11.7,
    size: 3.4,
    opacity: 0.56,
    delay: -1.18,
    duration: 4.3,
    driftX: 0.7,
    driftY: -3.9,
    hue: "violet",
  },
  {
    id: 61,
    x: 78.67,
    y: 73.43,
    size: 1.8,
    opacity: 0.12,
    delay: -1.353,
    duration: 7.2,
    driftX: 14.0,
    driftY: 11.05,
    hue: "fuchsia",
  },
  {
    id: 62,
    x: 15.84,
    y: 35.16,
    size: 3.1,
    opacity: 0.29,
    delay: -1.526,
    duration: 10.1,
    driftX: -2.8,
    driftY: -4.55,
    hue: "cyan",
  },
  {
    id: 63,
    x: 53.01,
    y: 96.89,
    size: 1.5,
    opacity: 0.46,
    delay: -1.699,
    duration: 3.9,
    driftX: 10.5,
    driftY: 10.4,
    hue: "violet",
  },
  {
    id: 64,
    x: 90.18,
    y: 58.62,
    size: 2.8,
    opacity: 0.63,
    delay: -1.872,
    duration: 6.8,
    driftX: -6.3,
    driftY: -5.2,
    hue: "fuchsia",
  },
  {
    id: 65,
    x: 27.35,
    y: 20.35,
    size: 1.2,
    opacity: 0.19,
    delay: -2.045,
    duration: 9.7,
    driftX: 7.0,
    driftY: 9.75,
    hue: "cyan",
  },
  {
    id: 66,
    x: 64.52,
    y: 82.08,
    size: 2.5,
    opacity: 0.36,
    delay: -2.218,
    duration: 3.5,
    driftX: -9.8,
    driftY: -5.85,
    hue: "violet",
  },
  {
    id: 67,
    x: 1.69,
    y: 43.81,
    size: 0.9,
    opacity: 0.53,
    delay: -2.391,
    duration: 6.4,
    driftX: 3.5,
    driftY: 9.1,
    hue: "fuchsia",
  },
  {
    id: 68,
    x: 38.86,
    y: 5.54,
    size: 2.2,
    opacity: 0.7,
    delay: -2.564,
    duration: 9.3,
    driftX: -13.3,
    driftY: -6.5,
    hue: "cyan",
  },
  {
    id: 69,
    x: 76.03,
    y: 67.27,
    size: 3.5,
    opacity: 0.26,
    delay: -2.737,
    duration: 12.2,
    driftX: 0.0,
    driftY: 8.45,
    hue: "violet",
  },
  {
    id: 70,
    x: 13.2,
    y: 29.0,
    size: 1.9,
    opacity: 0.43,
    delay: -2.91,
    duration: 6.0,
    driftX: 13.3,
    driftY: -7.15,
    hue: "fuchsia",
  },
  {
    id: 71,
    x: 50.37,
    y: 90.73,
    size: 3.2,
    opacity: 0.6,
    delay: -3.083,
    duration: 8.9,
    driftX: -3.5,
    driftY: 7.8,
    hue: "cyan",
  },
  {
    id: 72,
    x: 87.54,
    y: 52.46,
    size: 1.6,
    opacity: 0.16,
    delay: -3.256,
    duration: 11.8,
    driftX: 9.8,
    driftY: -7.8,
    hue: "violet",
  },
  {
    id: 73,
    x: 24.71,
    y: 14.19,
    size: 2.9,
    opacity: 0.33,
    delay: -3.429,
    duration: 5.6,
    driftX: -7.0,
    driftY: 7.15,
    hue: "fuchsia",
  },
  {
    id: 74,
    x: 61.88,
    y: 75.92,
    size: 1.3,
    opacity: 0.5,
    delay: -3.602,
    duration: 8.5,
    driftX: 6.3,
    driftY: -8.45,
    hue: "cyan",
  },
  {
    id: 75,
    x: 99.05,
    y: 37.65,
    size: 2.6,
    opacity: 0.67,
    delay: -3.775,
    duration: 11.4,
    driftX: -10.5,
    driftY: 6.5,
    hue: "violet",
  },
  {
    id: 76,
    x: 36.22,
    y: 99.38,
    size: 1.0,
    opacity: 0.23,
    delay: -3.948,
    duration: 5.2,
    driftX: 2.8,
    driftY: -9.1,
    hue: "fuchsia",
  },
  {
    id: 77,
    x: 73.39,
    y: 61.11,
    size: 2.3,
    opacity: 0.4,
    delay: -4.121,
    duration: 8.1,
    driftX: -14.0,
    driftY: 5.85,
    hue: "cyan",
  },
  {
    id: 78,
    x: 10.56,
    y: 22.84,
    size: 3.6,
    opacity: 0.57,
    delay: -4.294,
    duration: 11.0,
    driftX: -0.7,
    driftY: -9.75,
    hue: "violet",
  },
  {
    id: 79,
    x: 47.73,
    y: 84.57,
    size: 2.0,
    opacity: 0.13,
    delay: -4.467,
    duration: 4.8,
    driftX: 12.6,
    driftY: 5.2,
    hue: "fuchsia",
  },
  {
    id: 80,
    x: 84.9,
    y: 46.3,
    size: 3.3,
    opacity: 0.3,
    delay: -4.64,
    duration: 7.7,
    driftX: -4.2,
    driftY: -10.4,
    hue: "cyan",
  },
  {
    id: 81,
    x: 22.07,
    y: 8.03,
    size: 1.7,
    opacity: 0.47,
    delay: -4.813,
    duration: 10.6,
    driftX: 9.1,
    driftY: 4.55,
    hue: "violet",
  },
  {
    id: 82,
    x: 59.24,
    y: 69.76,
    size: 3.0,
    opacity: 0.64,
    delay: -4.986,
    duration: 4.4,
    driftX: -7.7,
    driftY: -11.05,
    hue: "fuchsia",
  },
  {
    id: 83,
    x: 96.41,
    y: 31.49,
    size: 1.4,
    opacity: 0.2,
    delay: -5.159,
    duration: 7.3,
    driftX: 5.6,
    driftY: 3.9,
    hue: "cyan",
  },
  {
    id: 84,
    x: 33.58,
    y: 93.22,
    size: 2.7,
    opacity: 0.37,
    delay: -5.332,
    duration: 10.2,
    driftX: -11.2,
    driftY: -11.7,
    hue: "violet",
  },
  {
    id: 85,
    x: 70.75,
    y: 54.95,
    size: 1.1,
    opacity: 0.54,
    delay: -5.505,
    duration: 4.0,
    driftX: 2.1,
    driftY: 3.25,
    hue: "fuchsia",
  },
  {
    id: 86,
    x: 7.92,
    y: 16.68,
    size: 2.4,
    opacity: 0.71,
    delay: -5.678,
    duration: 6.9,
    driftX: -14.7,
    driftY: -12.35,
    hue: "cyan",
  },
  {
    id: 87,
    x: 45.09,
    y: 78.41,
    size: 0.8,
    opacity: 0.27,
    delay: -5.851,
    duration: 9.8,
    driftX: -1.4,
    driftY: 2.6,
    hue: "violet",
  },
  {
    id: 88,
    x: 82.26,
    y: 40.14,
    size: 2.1,
    opacity: 0.44,
    delay: -6.024,
    duration: 3.6,
    driftX: 11.9,
    driftY: -13.0,
    hue: "fuchsia",
  },
  {
    id: 89,
    x: 19.43,
    y: 1.87,
    size: 3.4,
    opacity: 0.61,
    delay: -6.197,
    duration: 6.5,
    driftX: -4.9,
    driftY: 1.95,
    hue: "cyan",
  },
  {
    id: 90,
    x: 56.6,
    y: 63.6,
    size: 1.8,
    opacity: 0.17,
    delay: -6.37,
    duration: 9.4,
    driftX: 8.4,
    driftY: -13.65,
    hue: "violet",
  },
  {
    id: 91,
    x: 93.77,
    y: 25.33,
    size: 3.1,
    opacity: 0.34,
    delay: -6.543,
    duration: 3.2,
    driftX: -8.4,
    driftY: 1.3,
    hue: "fuchsia",
  },
  {
    id: 92,
    x: 30.94,
    y: 87.06,
    size: 1.5,
    opacity: 0.51,
    delay: -6.716,
    duration: 6.1,
    driftX: 4.9,
    driftY: -14.3,
    hue: "cyan",
  },
  {
    id: 93,
    x: 68.11,
    y: 48.79,
    size: 2.8,
    opacity: 0.68,
    delay: -6.889,
    duration: 9.0,
    driftX: -11.9,
    driftY: 0.65,
    hue: "violet",
  },
  {
    id: 94,
    x: 5.28,
    y: 10.52,
    size: 1.2,
    opacity: 0.24,
    delay: -7.062,
    duration: 11.9,
    driftX: 1.4,
    driftY: -14.95,
    hue: "fuchsia",
  },
  {
    id: 95,
    x: 42.45,
    y: 72.25,
    size: 2.5,
    opacity: 0.41,
    delay: -7.235,
    duration: 5.7,
    driftX: 14.7,
    driftY: 0.0,
    hue: "cyan",
  },
  {
    id: 96,
    x: 79.62,
    y: 33.98,
    size: 0.9,
    opacity: 0.58,
    delay: -7.408,
    duration: 8.6,
    driftX: -2.1,
    driftY: 14.95,
    hue: "violet",
  },
  {
    id: 97,
    x: 16.79,
    y: 95.71,
    size: 2.2,
    opacity: 0.14,
    delay: -7.581,
    duration: 11.5,
    driftX: 11.2,
    driftY: -0.65,
    hue: "fuchsia",
  },
  {
    id: 98,
    x: 53.96,
    y: 57.44,
    size: 3.5,
    opacity: 0.31,
    delay: -7.754,
    duration: 5.3,
    driftX: -5.6,
    driftY: 14.3,
    hue: "cyan",
  },
  {
    id: 99,
    x: 91.13,
    y: 19.17,
    size: 1.9,
    opacity: 0.48,
    delay: -7.927,
    duration: 8.2,
    driftX: 7.7,
    driftY: -1.3,
    hue: "violet",
  },
  {
    id: 100,
    x: 28.3,
    y: 80.9,
    size: 3.2,
    opacity: 0.65,
    delay: -8.1,
    duration: 11.1,
    driftX: -9.1,
    driftY: 13.65,
    hue: "fuchsia",
  },
  {
    id: 101,
    x: 65.47,
    y: 42.63,
    size: 1.6,
    opacity: 0.21,
    delay: -8.273,
    duration: 4.9,
    driftX: 4.2,
    driftY: -1.95,
    hue: "cyan",
  },
  {
    id: 102,
    x: 2.64,
    y: 4.36,
    size: 2.9,
    opacity: 0.38,
    delay: -8.446,
    duration: 7.8,
    driftX: -12.6,
    driftY: 13.0,
    hue: "violet",
  },
  {
    id: 103,
    x: 39.81,
    y: 66.09,
    size: 1.3,
    opacity: 0.55,
    delay: -8.619,
    duration: 10.7,
    driftX: 0.7,
    driftY: -2.6,
    hue: "fuchsia",
  },
  {
    id: 104,
    x: 76.98,
    y: 27.82,
    size: 2.6,
    opacity: 0.72,
    delay: -8.792,
    duration: 4.5,
    driftX: 14.0,
    driftY: 12.35,
    hue: "cyan",
  },
  {
    id: 105,
    x: 14.15,
    y: 89.55,
    size: 1.0,
    opacity: 0.28,
    delay: -8.965,
    duration: 7.4,
    driftX: -2.8,
    driftY: -3.25,
    hue: "violet",
  },
  {
    id: 106,
    x: 51.32,
    y: 51.28,
    size: 2.3,
    opacity: 0.45,
    delay: -9.138,
    duration: 10.3,
    driftX: 10.5,
    driftY: 11.7,
    hue: "fuchsia",
  },
  {
    id: 107,
    x: 88.49,
    y: 13.01,
    size: 3.6,
    opacity: 0.62,
    delay: -0.111,
    duration: 4.1,
    driftX: -6.3,
    driftY: -3.9,
    hue: "cyan",
  },
  {
    id: 108,
    x: 25.66,
    y: 74.74,
    size: 2.0,
    opacity: 0.18,
    delay: -0.284,
    duration: 7.0,
    driftX: 7.0,
    driftY: 11.05,
    hue: "violet",
  },
  {
    id: 109,
    x: 62.83,
    y: 36.47,
    size: 3.3,
    opacity: 0.35,
    delay: -0.457,
    duration: 9.9,
    driftX: -9.8,
    driftY: -4.55,
    hue: "fuchsia",
  },
  {
    id: 110,
    x: 0.0,
    y: 98.2,
    size: 1.7,
    opacity: 0.52,
    delay: -0.63,
    duration: 3.7,
    driftX: 3.5,
    driftY: 10.4,
    hue: "cyan",
  },
  {
    id: 111,
    x: 37.17,
    y: 59.93,
    size: 3.0,
    opacity: 0.69,
    delay: -0.803,
    duration: 6.6,
    driftX: -13.3,
    driftY: -5.2,
    hue: "violet",
  },
  {
    id: 112,
    x: 74.34,
    y: 21.66,
    size: 1.4,
    opacity: 0.25,
    delay: -0.976,
    duration: 9.5,
    driftX: 0.0,
    driftY: 9.75,
    hue: "fuchsia",
  },
  {
    id: 113,
    x: 11.51,
    y: 83.39,
    size: 2.7,
    opacity: 0.42,
    delay: -1.149,
    duration: 3.3,
    driftX: 13.3,
    driftY: -5.85,
    hue: "cyan",
  },
  {
    id: 114,
    x: 48.68,
    y: 45.12,
    size: 1.1,
    opacity: 0.59,
    delay: -1.322,
    duration: 6.2,
    driftX: -3.5,
    driftY: 9.1,
    hue: "violet",
  },
  {
    id: 115,
    x: 85.85,
    y: 6.85,
    size: 2.4,
    opacity: 0.15,
    delay: -1.495,
    duration: 9.1,
    driftX: 9.8,
    driftY: -6.5,
    hue: "fuchsia",
  },
  {
    id: 116,
    x: 23.02,
    y: 68.58,
    size: 0.8,
    opacity: 0.32,
    delay: -1.668,
    duration: 12.0,
    driftX: -7.0,
    driftY: 8.45,
    hue: "cyan",
  },
  {
    id: 117,
    x: 60.19,
    y: 30.31,
    size: 2.1,
    opacity: 0.49,
    delay: -1.841,
    duration: 5.8,
    driftX: 6.3,
    driftY: -7.15,
    hue: "violet",
  },
  {
    id: 118,
    x: 97.36,
    y: 92.04,
    size: 3.4,
    opacity: 0.66,
    delay: -2.014,
    duration: 8.7,
    driftX: -10.5,
    driftY: 7.8,
    hue: "fuchsia",
  },
  {
    id: 119,
    x: 34.53,
    y: 53.77,
    size: 1.8,
    opacity: 0.22,
    delay: -2.187,
    duration: 11.6,
    driftX: 2.8,
    driftY: -7.8,
    hue: "cyan",
  },
  {
    id: 120,
    x: 71.7,
    y: 15.5,
    size: 3.1,
    opacity: 0.39,
    delay: -2.36,
    duration: 5.4,
    driftX: -14.0,
    driftY: 7.15,
    hue: "violet",
  },
  {
    id: 121,
    x: 8.87,
    y: 77.23,
    size: 1.5,
    opacity: 0.56,
    delay: -2.533,
    duration: 8.3,
    driftX: -0.7,
    driftY: -8.45,
    hue: "fuchsia",
  },
  {
    id: 122,
    x: 46.04,
    y: 38.96,
    size: 2.8,
    opacity: 0.12,
    delay: -2.706,
    duration: 11.2,
    driftX: 12.6,
    driftY: 6.5,
    hue: "cyan",
  },
  {
    id: 123,
    x: 83.21,
    y: 0.69,
    size: 1.2,
    opacity: 0.29,
    delay: -2.879,
    duration: 5.0,
    driftX: -4.2,
    driftY: -9.1,
    hue: "violet",
  },
  {
    id: 124,
    x: 20.38,
    y: 62.42,
    size: 2.5,
    opacity: 0.46,
    delay: -3.052,
    duration: 7.9,
    driftX: 9.1,
    driftY: 5.85,
    hue: "fuchsia",
  },
  {
    id: 125,
    x: 57.55,
    y: 24.15,
    size: 0.9,
    opacity: 0.63,
    delay: -3.225,
    duration: 10.8,
    driftX: -7.7,
    driftY: -9.75,
    hue: "cyan",
  },
  {
    id: 126,
    x: 94.72,
    y: 85.88,
    size: 2.2,
    opacity: 0.19,
    delay: -3.398,
    duration: 4.6,
    driftX: 5.6,
    driftY: 5.2,
    hue: "violet",
  },
  {
    id: 127,
    x: 31.89,
    y: 47.61,
    size: 3.5,
    opacity: 0.36,
    delay: -3.571,
    duration: 7.5,
    driftX: -11.2,
    driftY: -10.4,
    hue: "fuchsia",
  },
  {
    id: 128,
    x: 69.06,
    y: 9.34,
    size: 1.9,
    opacity: 0.53,
    delay: -3.744,
    duration: 10.4,
    driftX: 2.1,
    driftY: 4.55,
    hue: "cyan",
  },
  {
    id: 129,
    x: 6.23,
    y: 71.07,
    size: 3.2,
    opacity: 0.7,
    delay: -3.917,
    duration: 4.2,
    driftX: -14.7,
    driftY: -11.05,
    hue: "violet",
  },
  {
    id: 130,
    x: 43.4,
    y: 32.8,
    size: 1.6,
    opacity: 0.26,
    delay: -4.09,
    duration: 7.1,
    driftX: -1.4,
    driftY: 3.9,
    hue: "fuchsia",
  },
  {
    id: 131,
    x: 80.57,
    y: 94.53,
    size: 2.9,
    opacity: 0.43,
    delay: -4.263,
    duration: 10.0,
    driftX: 11.9,
    driftY: -11.7,
    hue: "cyan",
  },
  {
    id: 132,
    x: 17.74,
    y: 56.26,
    size: 1.3,
    opacity: 0.6,
    delay: -4.436,
    duration: 3.8,
    driftX: -4.9,
    driftY: 3.25,
    hue: "violet",
  },
  {
    id: 133,
    x: 54.91,
    y: 17.99,
    size: 2.6,
    opacity: 0.16,
    delay: -4.609,
    duration: 6.7,
    driftX: 8.4,
    driftY: -12.35,
    hue: "fuchsia",
  },
  {
    id: 134,
    x: 92.08,
    y: 79.72,
    size: 1.0,
    opacity: 0.33,
    delay: -4.782,
    duration: 9.6,
    driftX: -8.4,
    driftY: 2.6,
    hue: "cyan",
  },
  {
    id: 135,
    x: 29.25,
    y: 41.45,
    size: 2.3,
    opacity: 0.5,
    delay: -4.955,
    duration: 3.4,
    driftX: 4.9,
    driftY: -13.0,
    hue: "violet",
  },
  {
    id: 136,
    x: 66.42,
    y: 3.18,
    size: 3.6,
    opacity: 0.67,
    delay: -5.128,
    duration: 6.3,
    driftX: -11.9,
    driftY: 1.95,
    hue: "fuchsia",
  },
  {
    id: 137,
    x: 3.59,
    y: 64.91,
    size: 2.0,
    opacity: 0.23,
    delay: -5.301,
    duration: 9.2,
    driftX: 1.4,
    driftY: -13.65,
    hue: "cyan",
  },
  {
    id: 138,
    x: 40.76,
    y: 26.64,
    size: 3.3,
    opacity: 0.4,
    delay: -5.474,
    duration: 12.1,
    driftX: 14.7,
    driftY: 1.3,
    hue: "violet",
  },
  {
    id: 139,
    x: 77.93,
    y: 88.37,
    size: 1.7,
    opacity: 0.57,
    delay: -5.647,
    duration: 5.9,
    driftX: -2.1,
    driftY: -14.3,
    hue: "fuchsia",
  },
  {
    id: 140,
    x: 15.1,
    y: 50.1,
    size: 3.0,
    opacity: 0.13,
    delay: -5.82,
    duration: 8.8,
    driftX: 11.2,
    driftY: 0.65,
    hue: "cyan",
  },
  {
    id: 141,
    x: 52.27,
    y: 11.83,
    size: 1.4,
    opacity: 0.3,
    delay: -5.993,
    duration: 11.7,
    driftX: -5.6,
    driftY: -14.95,
    hue: "violet",
  },
  {
    id: 142,
    x: 89.44,
    y: 73.56,
    size: 2.7,
    opacity: 0.47,
    delay: -6.166,
    duration: 5.5,
    driftX: 7.7,
    driftY: 0.0,
    hue: "fuchsia",
  },
  {
    id: 143,
    x: 26.61,
    y: 35.29,
    size: 1.1,
    opacity: 0.64,
    delay: -6.339,
    duration: 8.4,
    driftX: -9.1,
    driftY: 14.95,
    hue: "cyan",
  },
  {
    id: 144,
    x: 63.78,
    y: 97.02,
    size: 2.4,
    opacity: 0.2,
    delay: -6.512,
    duration: 11.3,
    driftX: 4.2,
    driftY: -0.65,
    hue: "violet",
  },
  {
    id: 145,
    x: 0.95,
    y: 58.75,
    size: 0.8,
    opacity: 0.37,
    delay: -6.685,
    duration: 5.1,
    driftX: -12.6,
    driftY: 14.3,
    hue: "fuchsia",
  },
  {
    id: 146,
    x: 38.12,
    y: 20.48,
    size: 2.1,
    opacity: 0.54,
    delay: -6.858,
    duration: 8.0,
    driftX: 0.7,
    driftY: -1.3,
    hue: "cyan",
  },
  {
    id: 147,
    x: 75.29,
    y: 82.21,
    size: 3.4,
    opacity: 0.71,
    delay: -7.031,
    duration: 10.9,
    driftX: 14.0,
    driftY: 13.65,
    hue: "violet",
  },
  {
    id: 148,
    x: 12.46,
    y: 43.94,
    size: 1.8,
    opacity: 0.27,
    delay: -7.204,
    duration: 4.7,
    driftX: -2.8,
    driftY: -1.95,
    hue: "fuchsia",
  },
  {
    id: 149,
    x: 49.63,
    y: 5.67,
    size: 3.1,
    opacity: 0.44,
    delay: -7.377,
    duration: 7.6,
    driftX: 10.5,
    driftY: 13.0,
    hue: "cyan",
  },
  {
    id: 150,
    x: 86.8,
    y: 67.4,
    size: 1.5,
    opacity: 0.61,
    delay: -7.55,
    duration: 10.5,
    driftX: -6.3,
    driftY: -2.6,
    hue: "violet",
  },
  {
    id: 151,
    x: 23.97,
    y: 29.13,
    size: 2.8,
    opacity: 0.17,
    delay: -7.723,
    duration: 4.3,
    driftX: 7.0,
    driftY: 12.35,
    hue: "fuchsia",
  },
  {
    id: 152,
    x: 61.14,
    y: 90.86,
    size: 1.2,
    opacity: 0.34,
    delay: -7.896,
    duration: 7.2,
    driftX: -9.8,
    driftY: -3.25,
    hue: "cyan",
  },
  {
    id: 153,
    x: 98.31,
    y: 52.59,
    size: 2.5,
    opacity: 0.51,
    delay: -8.069,
    duration: 10.1,
    driftX: 3.5,
    driftY: 11.7,
    hue: "violet",
  },
  {
    id: 154,
    x: 35.48,
    y: 14.32,
    size: 0.9,
    opacity: 0.68,
    delay: -8.242,
    duration: 3.9,
    driftX: -13.3,
    driftY: -3.9,
    hue: "fuchsia",
  },
  {
    id: 155,
    x: 72.65,
    y: 76.05,
    size: 2.2,
    opacity: 0.24,
    delay: -8.415,
    duration: 6.8,
    driftX: 0.0,
    driftY: 11.05,
    hue: "cyan",
  },
  {
    id: 156,
    x: 9.82,
    y: 37.78,
    size: 3.5,
    opacity: 0.41,
    delay: -8.588,
    duration: 9.7,
    driftX: 13.3,
    driftY: -4.55,
    hue: "violet",
  },
  {
    id: 157,
    x: 46.99,
    y: 99.51,
    size: 1.9,
    opacity: 0.58,
    delay: -8.761,
    duration: 3.5,
    driftX: -3.5,
    driftY: 10.4,
    hue: "fuchsia",
  },
  {
    id: 158,
    x: 84.16,
    y: 61.24,
    size: 3.2,
    opacity: 0.14,
    delay: -8.934,
    duration: 6.4,
    driftX: 9.8,
    driftY: -5.2,
    hue: "cyan",
  },
  {
    id: 159,
    x: 21.33,
    y: 22.97,
    size: 1.6,
    opacity: 0.31,
    delay: -9.107,
    duration: 9.3,
    driftX: -7.0,
    driftY: 9.75,
    hue: "violet",
  },
  {
    id: 160,
    x: 58.5,
    y: 84.7,
    size: 2.9,
    opacity: 0.48,
    delay: -0.08,
    duration: 12.2,
    driftX: 6.3,
    driftY: -5.85,
    hue: "fuchsia",
  },
  {
    id: 161,
    x: 95.67,
    y: 46.43,
    size: 1.3,
    opacity: 0.65,
    delay: -0.253,
    duration: 6.0,
    driftX: -10.5,
    driftY: 9.1,
    hue: "cyan",
  },
  {
    id: 162,
    x: 32.84,
    y: 8.16,
    size: 2.6,
    opacity: 0.21,
    delay: -0.426,
    duration: 8.9,
    driftX: 2.8,
    driftY: -6.5,
    hue: "violet",
  },
  {
    id: 163,
    x: 70.01,
    y: 69.89,
    size: 1.0,
    opacity: 0.38,
    delay: -0.599,
    duration: 11.8,
    driftX: -14.0,
    driftY: 8.45,
    hue: "fuchsia",
  },
  {
    id: 164,
    x: 7.18,
    y: 31.62,
    size: 2.3,
    opacity: 0.55,
    delay: -0.772,
    duration: 5.6,
    driftX: -0.7,
    driftY: -7.15,
    hue: "cyan",
  },
  {
    id: 165,
    x: 44.35,
    y: 93.35,
    size: 3.6,
    opacity: 0.72,
    delay: -0.945,
    duration: 8.5,
    driftX: 12.6,
    driftY: 7.8,
    hue: "violet",
  },
  {
    id: 166,
    x: 81.52,
    y: 55.08,
    size: 2.0,
    opacity: 0.28,
    delay: -1.118,
    duration: 11.4,
    driftX: -4.2,
    driftY: -7.8,
    hue: "fuchsia",
  },
  {
    id: 167,
    x: 18.69,
    y: 16.81,
    size: 3.3,
    opacity: 0.45,
    delay: -1.291,
    duration: 5.2,
    driftX: 9.1,
    driftY: 7.15,
    hue: "cyan",
  },
  {
    id: 168,
    x: 55.86,
    y: 78.54,
    size: 1.7,
    opacity: 0.62,
    delay: -1.464,
    duration: 8.1,
    driftX: -7.7,
    driftY: -8.45,
    hue: "violet",
  },
  {
    id: 169,
    x: 93.03,
    y: 40.27,
    size: 3.0,
    opacity: 0.18,
    delay: -1.637,
    duration: 11.0,
    driftX: 5.6,
    driftY: 6.5,
    hue: "fuchsia",
  },
  {
    id: 170,
    x: 30.2,
    y: 2.0,
    size: 1.4,
    opacity: 0.35,
    delay: -1.81,
    duration: 4.8,
    driftX: -11.2,
    driftY: -9.1,
    hue: "cyan",
  },
  {
    id: 171,
    x: 67.37,
    y: 63.73,
    size: 2.7,
    opacity: 0.52,
    delay: -1.983,
    duration: 7.7,
    driftX: 2.1,
    driftY: 5.85,
    hue: "violet",
  },
  {
    id: 172,
    x: 4.54,
    y: 25.46,
    size: 1.1,
    opacity: 0.69,
    delay: -2.156,
    duration: 10.6,
    driftX: -14.7,
    driftY: -9.75,
    hue: "fuchsia",
  },
  {
    id: 173,
    x: 41.71,
    y: 87.19,
    size: 2.4,
    opacity: 0.25,
    delay: -2.329,
    duration: 4.4,
    driftX: -1.4,
    driftY: 5.2,
    hue: "cyan",
  },
  {
    id: 174,
    x: 78.88,
    y: 48.92,
    size: 0.8,
    opacity: 0.42,
    delay: -2.502,
    duration: 7.3,
    driftX: 11.9,
    driftY: -10.4,
    hue: "violet",
  },
  {
    id: 175,
    x: 16.05,
    y: 10.65,
    size: 2.1,
    opacity: 0.59,
    delay: -2.675,
    duration: 10.2,
    driftX: -4.9,
    driftY: 4.55,
    hue: "fuchsia",
  },
  {
    id: 176,
    x: 53.22,
    y: 72.38,
    size: 3.4,
    opacity: 0.15,
    delay: -2.848,
    duration: 4.0,
    driftX: 8.4,
    driftY: -11.05,
    hue: "cyan",
  },
  {
    id: 177,
    x: 90.39,
    y: 34.11,
    size: 1.8,
    opacity: 0.32,
    delay: -3.021,
    duration: 6.9,
    driftX: -8.4,
    driftY: 3.9,
    hue: "violet",
  },
  {
    id: 178,
    x: 27.56,
    y: 95.84,
    size: 3.1,
    opacity: 0.49,
    delay: -3.194,
    duration: 9.8,
    driftX: 4.9,
    driftY: -11.7,
    hue: "fuchsia",
  },
  {
    id: 179,
    x: 64.73,
    y: 57.57,
    size: 1.5,
    opacity: 0.66,
    delay: -3.367,
    duration: 3.6,
    driftX: -11.9,
    driftY: 3.25,
    hue: "cyan",
  },
];

const PLAY_RAY_PRESETS: PlayAmbientPreset[] = [
  {
    id: 0,
    x: 11.3,
    y: 7.9,
    size: 0.8,
    opacity: 0.12,
    delay: -0.0,
    duration: 3.2,
    driftX: -14.7,
    driftY: -14.95,
    hue: "violet",
  },
  {
    id: 1,
    x: 48.47,
    y: 69.63,
    size: 2.1,
    opacity: 0.29,
    delay: -0.173,
    duration: 6.1,
    driftX: -1.4,
    driftY: 0.0,
    hue: "fuchsia",
  },
  {
    id: 2,
    x: 85.64,
    y: 31.36,
    size: 3.4,
    opacity: 0.46,
    delay: -0.346,
    duration: 9.0,
    driftX: 11.9,
    driftY: 14.95,
    hue: "cyan",
  },
  {
    id: 3,
    x: 22.81,
    y: 93.09,
    size: 1.8,
    opacity: 0.63,
    delay: -0.519,
    duration: 11.9,
    driftX: -4.9,
    driftY: -0.65,
    hue: "violet",
  },
  {
    id: 4,
    x: 59.98,
    y: 54.82,
    size: 3.1,
    opacity: 0.19,
    delay: -0.692,
    duration: 5.7,
    driftX: 8.4,
    driftY: 14.3,
    hue: "fuchsia",
  },
  {
    id: 5,
    x: 97.15,
    y: 16.55,
    size: 1.5,
    opacity: 0.36,
    delay: -0.865,
    duration: 8.6,
    driftX: -8.4,
    driftY: -1.3,
    hue: "cyan",
  },
  {
    id: 6,
    x: 34.32,
    y: 78.28,
    size: 2.8,
    opacity: 0.53,
    delay: -1.038,
    duration: 11.5,
    driftX: 4.9,
    driftY: 13.65,
    hue: "violet",
  },
  {
    id: 7,
    x: 71.49,
    y: 40.01,
    size: 1.2,
    opacity: 0.7,
    delay: -1.211,
    duration: 5.3,
    driftX: -11.9,
    driftY: -1.95,
    hue: "fuchsia",
  },
  {
    id: 8,
    x: 8.66,
    y: 1.74,
    size: 2.5,
    opacity: 0.26,
    delay: -1.384,
    duration: 8.2,
    driftX: 1.4,
    driftY: 13.0,
    hue: "cyan",
  },
  {
    id: 9,
    x: 45.83,
    y: 63.47,
    size: 0.9,
    opacity: 0.43,
    delay: -1.557,
    duration: 11.1,
    driftX: 14.7,
    driftY: -2.6,
    hue: "violet",
  },
  {
    id: 10,
    x: 83.0,
    y: 25.2,
    size: 2.2,
    opacity: 0.6,
    delay: -1.73,
    duration: 4.9,
    driftX: -2.1,
    driftY: 12.35,
    hue: "fuchsia",
  },
  {
    id: 11,
    x: 20.17,
    y: 86.93,
    size: 3.5,
    opacity: 0.16,
    delay: -1.903,
    duration: 7.8,
    driftX: 11.2,
    driftY: -3.25,
    hue: "cyan",
  },
  {
    id: 12,
    x: 57.34,
    y: 48.66,
    size: 1.9,
    opacity: 0.33,
    delay: -2.076,
    duration: 10.7,
    driftX: -5.6,
    driftY: 11.7,
    hue: "violet",
  },
  {
    id: 13,
    x: 94.51,
    y: 10.39,
    size: 3.2,
    opacity: 0.5,
    delay: -2.249,
    duration: 4.5,
    driftX: 7.7,
    driftY: -3.9,
    hue: "fuchsia",
  },
  {
    id: 14,
    x: 31.68,
    y: 72.12,
    size: 1.6,
    opacity: 0.67,
    delay: -2.422,
    duration: 7.4,
    driftX: -9.1,
    driftY: 11.05,
    hue: "cyan",
  },
  {
    id: 15,
    x: 68.85,
    y: 33.85,
    size: 2.9,
    opacity: 0.23,
    delay: -2.595,
    duration: 10.3,
    driftX: 4.2,
    driftY: -4.55,
    hue: "violet",
  },
  {
    id: 16,
    x: 6.02,
    y: 95.58,
    size: 1.3,
    opacity: 0.4,
    delay: -2.768,
    duration: 4.1,
    driftX: -12.6,
    driftY: 10.4,
    hue: "fuchsia",
  },
  {
    id: 17,
    x: 43.19,
    y: 57.31,
    size: 2.6,
    opacity: 0.57,
    delay: -2.941,
    duration: 7.0,
    driftX: 0.7,
    driftY: -5.2,
    hue: "cyan",
  },
  {
    id: 18,
    x: 80.36,
    y: 19.04,
    size: 1.0,
    opacity: 0.13,
    delay: -3.114,
    duration: 9.9,
    driftX: 14.0,
    driftY: 9.75,
    hue: "violet",
  },
  {
    id: 19,
    x: 17.53,
    y: 80.77,
    size: 2.3,
    opacity: 0.3,
    delay: -3.287,
    duration: 3.7,
    driftX: -2.8,
    driftY: -5.85,
    hue: "fuchsia",
  },
  {
    id: 20,
    x: 54.7,
    y: 42.5,
    size: 3.6,
    opacity: 0.47,
    delay: -3.46,
    duration: 6.6,
    driftX: 10.5,
    driftY: 9.1,
    hue: "cyan",
  },
  {
    id: 21,
    x: 91.87,
    y: 4.23,
    size: 2.0,
    opacity: 0.64,
    delay: -3.633,
    duration: 9.5,
    driftX: -6.3,
    driftY: -6.5,
    hue: "violet",
  },
  {
    id: 22,
    x: 29.04,
    y: 65.96,
    size: 3.3,
    opacity: 0.2,
    delay: -3.806,
    duration: 3.3,
    driftX: 7.0,
    driftY: 8.45,
    hue: "fuchsia",
  },
  {
    id: 23,
    x: 66.21,
    y: 27.69,
    size: 1.7,
    opacity: 0.37,
    delay: -3.979,
    duration: 6.2,
    driftX: -9.8,
    driftY: -7.15,
    hue: "cyan",
  },
  {
    id: 24,
    x: 3.38,
    y: 89.42,
    size: 3.0,
    opacity: 0.54,
    delay: -4.152,
    duration: 9.1,
    driftX: 3.5,
    driftY: 7.8,
    hue: "violet",
  },
  {
    id: 25,
    x: 40.55,
    y: 51.15,
    size: 1.4,
    opacity: 0.71,
    delay: -4.325,
    duration: 12.0,
    driftX: -13.3,
    driftY: -7.8,
    hue: "fuchsia",
  },
  {
    id: 26,
    x: 77.72,
    y: 12.88,
    size: 2.7,
    opacity: 0.27,
    delay: -4.498,
    duration: 5.8,
    driftX: 0.0,
    driftY: 7.15,
    hue: "cyan",
  },
  {
    id: 27,
    x: 14.89,
    y: 74.61,
    size: 1.1,
    opacity: 0.44,
    delay: -4.671,
    duration: 8.7,
    driftX: 13.3,
    driftY: -8.45,
    hue: "violet",
  },
  {
    id: 28,
    x: 52.06,
    y: 36.34,
    size: 2.4,
    opacity: 0.61,
    delay: -4.844,
    duration: 11.6,
    driftX: -3.5,
    driftY: 6.5,
    hue: "fuchsia",
  },
  {
    id: 29,
    x: 89.23,
    y: 98.07,
    size: 0.8,
    opacity: 0.17,
    delay: -5.017,
    duration: 5.4,
    driftX: 9.8,
    driftY: -9.1,
    hue: "cyan",
  },
  {
    id: 30,
    x: 26.4,
    y: 59.8,
    size: 2.1,
    opacity: 0.34,
    delay: -5.19,
    duration: 8.3,
    driftX: -7.0,
    driftY: 5.85,
    hue: "violet",
  },
  {
    id: 31,
    x: 63.57,
    y: 21.53,
    size: 3.4,
    opacity: 0.51,
    delay: -5.363,
    duration: 11.2,
    driftX: 6.3,
    driftY: -9.75,
    hue: "fuchsia",
  },
  {
    id: 32,
    x: 0.74,
    y: 83.26,
    size: 1.8,
    opacity: 0.68,
    delay: -5.536,
    duration: 5.0,
    driftX: -10.5,
    driftY: 5.2,
    hue: "cyan",
  },
  {
    id: 33,
    x: 37.91,
    y: 44.99,
    size: 3.1,
    opacity: 0.24,
    delay: -5.709,
    duration: 7.9,
    driftX: 2.8,
    driftY: -10.4,
    hue: "violet",
  },
  {
    id: 34,
    x: 75.08,
    y: 6.72,
    size: 1.5,
    opacity: 0.41,
    delay: -5.882,
    duration: 10.8,
    driftX: -14.0,
    driftY: 4.55,
    hue: "fuchsia",
  },
  {
    id: 35,
    x: 12.25,
    y: 68.45,
    size: 2.8,
    opacity: 0.58,
    delay: -6.055,
    duration: 4.6,
    driftX: -0.7,
    driftY: -11.05,
    hue: "cyan",
  },
  {
    id: 36,
    x: 49.42,
    y: 30.18,
    size: 1.2,
    opacity: 0.14,
    delay: -6.228,
    duration: 7.5,
    driftX: 12.6,
    driftY: 3.9,
    hue: "violet",
  },
  {
    id: 37,
    x: 86.59,
    y: 91.91,
    size: 2.5,
    opacity: 0.31,
    delay: -6.401,
    duration: 10.4,
    driftX: -4.2,
    driftY: -11.7,
    hue: "fuchsia",
  },
  {
    id: 38,
    x: 23.76,
    y: 53.64,
    size: 0.9,
    opacity: 0.48,
    delay: -6.574,
    duration: 4.2,
    driftX: 9.1,
    driftY: 3.25,
    hue: "cyan",
  },
  {
    id: 39,
    x: 60.93,
    y: 15.37,
    size: 2.2,
    opacity: 0.65,
    delay: -6.747,
    duration: 7.1,
    driftX: -7.7,
    driftY: -12.35,
    hue: "violet",
  },
  {
    id: 40,
    x: 98.1,
    y: 77.1,
    size: 3.5,
    opacity: 0.21,
    delay: -6.92,
    duration: 10.0,
    driftX: 5.6,
    driftY: 2.6,
    hue: "fuchsia",
  },
  {
    id: 41,
    x: 35.27,
    y: 38.83,
    size: 1.9,
    opacity: 0.38,
    delay: -7.093,
    duration: 3.8,
    driftX: -11.2,
    driftY: -13.0,
    hue: "cyan",
  },
  {
    id: 42,
    x: 72.44,
    y: 0.56,
    size: 3.2,
    opacity: 0.55,
    delay: -7.266,
    duration: 6.7,
    driftX: 2.1,
    driftY: 1.95,
    hue: "violet",
  },
  {
    id: 43,
    x: 9.61,
    y: 62.29,
    size: 1.6,
    opacity: 0.72,
    delay: -7.439,
    duration: 9.6,
    driftX: -14.7,
    driftY: -13.65,
    hue: "fuchsia",
  },
  {
    id: 44,
    x: 46.78,
    y: 24.02,
    size: 2.9,
    opacity: 0.28,
    delay: -7.612,
    duration: 3.4,
    driftX: -1.4,
    driftY: 1.3,
    hue: "cyan",
  },
  {
    id: 45,
    x: 83.95,
    y: 85.75,
    size: 1.3,
    opacity: 0.45,
    delay: -7.785,
    duration: 6.3,
    driftX: 11.9,
    driftY: -14.3,
    hue: "violet",
  },
  {
    id: 46,
    x: 21.12,
    y: 47.48,
    size: 2.6,
    opacity: 0.62,
    delay: -7.958,
    duration: 9.2,
    driftX: -4.9,
    driftY: 0.65,
    hue: "fuchsia",
  },
  {
    id: 47,
    x: 58.29,
    y: 9.21,
    size: 1.0,
    opacity: 0.18,
    delay: -8.131,
    duration: 12.1,
    driftX: 8.4,
    driftY: -14.95,
    hue: "cyan",
  },
  {
    id: 48,
    x: 95.46,
    y: 70.94,
    size: 2.3,
    opacity: 0.35,
    delay: -8.304,
    duration: 5.9,
    driftX: -8.4,
    driftY: 0.0,
    hue: "violet",
  },
  {
    id: 49,
    x: 32.63,
    y: 32.67,
    size: 3.6,
    opacity: 0.52,
    delay: -8.477,
    duration: 8.8,
    driftX: 4.9,
    driftY: 14.95,
    hue: "fuchsia",
  },
  {
    id: 50,
    x: 69.8,
    y: 94.4,
    size: 2.0,
    opacity: 0.69,
    delay: -8.65,
    duration: 11.7,
    driftX: -11.9,
    driftY: -0.65,
    hue: "cyan",
  },
  {
    id: 51,
    x: 6.97,
    y: 56.13,
    size: 3.3,
    opacity: 0.25,
    delay: -8.823,
    duration: 5.5,
    driftX: 1.4,
    driftY: 14.3,
    hue: "violet",
  },
  {
    id: 52,
    x: 44.14,
    y: 17.86,
    size: 1.7,
    opacity: 0.42,
    delay: -8.996,
    duration: 8.4,
    driftX: 14.7,
    driftY: -1.3,
    hue: "fuchsia",
  },
  {
    id: 53,
    x: 81.31,
    y: 79.59,
    size: 3.0,
    opacity: 0.59,
    delay: -9.169,
    duration: 11.3,
    driftX: -2.1,
    driftY: 13.65,
    hue: "cyan",
  },
  {
    id: 54,
    x: 18.48,
    y: 41.32,
    size: 1.4,
    opacity: 0.15,
    delay: -0.142,
    duration: 5.1,
    driftX: 11.2,
    driftY: -1.95,
    hue: "violet",
  },
  {
    id: 55,
    x: 55.65,
    y: 3.05,
    size: 2.7,
    opacity: 0.32,
    delay: -0.315,
    duration: 8.0,
    driftX: -5.6,
    driftY: 13.0,
    hue: "fuchsia",
  },
  {
    id: 56,
    x: 92.82,
    y: 64.78,
    size: 1.1,
    opacity: 0.49,
    delay: -0.488,
    duration: 10.9,
    driftX: 7.7,
    driftY: -2.6,
    hue: "cyan",
  },
  {
    id: 57,
    x: 29.99,
    y: 26.51,
    size: 2.4,
    opacity: 0.66,
    delay: -0.661,
    duration: 4.7,
    driftX: -9.1,
    driftY: 12.35,
    hue: "violet",
  },
  {
    id: 58,
    x: 67.16,
    y: 88.24,
    size: 0.8,
    opacity: 0.22,
    delay: -0.834,
    duration: 7.6,
    driftX: 4.2,
    driftY: -3.25,
    hue: "fuchsia",
  },
  {
    id: 59,
    x: 4.33,
    y: 49.97,
    size: 2.1,
    opacity: 0.39,
    delay: -1.007,
    duration: 10.5,
    driftX: -12.6,
    driftY: 11.7,
    hue: "cyan",
  },
  {
    id: 60,
    x: 41.5,
    y: 11.7,
    size: 3.4,
    opacity: 0.56,
    delay: -1.18,
    duration: 4.3,
    driftX: 0.7,
    driftY: -3.9,
    hue: "violet",
  },
  {
    id: 61,
    x: 78.67,
    y: 73.43,
    size: 1.8,
    opacity: 0.12,
    delay: -1.353,
    duration: 7.2,
    driftX: 14.0,
    driftY: 11.05,
    hue: "fuchsia",
  },
  {
    id: 62,
    x: 15.84,
    y: 35.16,
    size: 3.1,
    opacity: 0.29,
    delay: -1.526,
    duration: 10.1,
    driftX: -2.8,
    driftY: -4.55,
    hue: "cyan",
  },
  {
    id: 63,
    x: 53.01,
    y: 96.89,
    size: 1.5,
    opacity: 0.46,
    delay: -1.699,
    duration: 3.9,
    driftX: 10.5,
    driftY: 10.4,
    hue: "violet",
  },
  {
    id: 64,
    x: 90.18,
    y: 58.62,
    size: 2.8,
    opacity: 0.63,
    delay: -1.872,
    duration: 6.8,
    driftX: -6.3,
    driftY: -5.2,
    hue: "fuchsia",
  },
  {
    id: 65,
    x: 27.35,
    y: 20.35,
    size: 1.2,
    opacity: 0.19,
    delay: -2.045,
    duration: 9.7,
    driftX: 7.0,
    driftY: 9.75,
    hue: "cyan",
  },
  {
    id: 66,
    x: 64.52,
    y: 82.08,
    size: 2.5,
    opacity: 0.36,
    delay: -2.218,
    duration: 3.5,
    driftX: -9.8,
    driftY: -5.85,
    hue: "violet",
  },
  {
    id: 67,
    x: 1.69,
    y: 43.81,
    size: 0.9,
    opacity: 0.53,
    delay: -2.391,
    duration: 6.4,
    driftX: 3.5,
    driftY: 9.1,
    hue: "fuchsia",
  },
  {
    id: 68,
    x: 38.86,
    y: 5.54,
    size: 2.2,
    opacity: 0.7,
    delay: -2.564,
    duration: 9.3,
    driftX: -13.3,
    driftY: -6.5,
    hue: "cyan",
  },
  {
    id: 69,
    x: 76.03,
    y: 67.27,
    size: 3.5,
    opacity: 0.26,
    delay: -2.737,
    duration: 12.2,
    driftX: 0.0,
    driftY: 8.45,
    hue: "violet",
  },
  {
    id: 70,
    x: 13.2,
    y: 29.0,
    size: 1.9,
    opacity: 0.43,
    delay: -2.91,
    duration: 6.0,
    driftX: 13.3,
    driftY: -7.15,
    hue: "fuchsia",
  },
  {
    id: 71,
    x: 50.37,
    y: 90.73,
    size: 3.2,
    opacity: 0.6,
    delay: -3.083,
    duration: 8.9,
    driftX: -3.5,
    driftY: 7.8,
    hue: "cyan",
  },
  {
    id: 72,
    x: 87.54,
    y: 52.46,
    size: 1.6,
    opacity: 0.16,
    delay: -3.256,
    duration: 11.8,
    driftX: 9.8,
    driftY: -7.8,
    hue: "violet",
  },
  {
    id: 73,
    x: 24.71,
    y: 14.19,
    size: 2.9,
    opacity: 0.33,
    delay: -3.429,
    duration: 5.6,
    driftX: -7.0,
    driftY: 7.15,
    hue: "fuchsia",
  },
  {
    id: 74,
    x: 61.88,
    y: 75.92,
    size: 1.3,
    opacity: 0.5,
    delay: -3.602,
    duration: 8.5,
    driftX: 6.3,
    driftY: -8.45,
    hue: "cyan",
  },
  {
    id: 75,
    x: 99.05,
    y: 37.65,
    size: 2.6,
    opacity: 0.67,
    delay: -3.775,
    duration: 11.4,
    driftX: -10.5,
    driftY: 6.5,
    hue: "violet",
  },
  {
    id: 76,
    x: 36.22,
    y: 99.38,
    size: 1.0,
    opacity: 0.23,
    delay: -3.948,
    duration: 5.2,
    driftX: 2.8,
    driftY: -9.1,
    hue: "fuchsia",
  },
  {
    id: 77,
    x: 73.39,
    y: 61.11,
    size: 2.3,
    opacity: 0.4,
    delay: -4.121,
    duration: 8.1,
    driftX: -14.0,
    driftY: 5.85,
    hue: "cyan",
  },
  {
    id: 78,
    x: 10.56,
    y: 22.84,
    size: 3.6,
    opacity: 0.57,
    delay: -4.294,
    duration: 11.0,
    driftX: -0.7,
    driftY: -9.75,
    hue: "violet",
  },
  {
    id: 79,
    x: 47.73,
    y: 84.57,
    size: 2.0,
    opacity: 0.13,
    delay: -4.467,
    duration: 4.8,
    driftX: 12.6,
    driftY: 5.2,
    hue: "fuchsia",
  },
  {
    id: 80,
    x: 84.9,
    y: 46.3,
    size: 3.3,
    opacity: 0.3,
    delay: -4.64,
    duration: 7.7,
    driftX: -4.2,
    driftY: -10.4,
    hue: "cyan",
  },
  {
    id: 81,
    x: 22.07,
    y: 8.03,
    size: 1.7,
    opacity: 0.47,
    delay: -4.813,
    duration: 10.6,
    driftX: 9.1,
    driftY: 4.55,
    hue: "violet",
  },
  {
    id: 82,
    x: 59.24,
    y: 69.76,
    size: 3.0,
    opacity: 0.64,
    delay: -4.986,
    duration: 4.4,
    driftX: -7.7,
    driftY: -11.05,
    hue: "fuchsia",
  },
  {
    id: 83,
    x: 96.41,
    y: 31.49,
    size: 1.4,
    opacity: 0.2,
    delay: -5.159,
    duration: 7.3,
    driftX: 5.6,
    driftY: 3.9,
    hue: "cyan",
  },
  {
    id: 84,
    x: 33.58,
    y: 93.22,
    size: 2.7,
    opacity: 0.37,
    delay: -5.332,
    duration: 10.2,
    driftX: -11.2,
    driftY: -11.7,
    hue: "violet",
  },
  {
    id: 85,
    x: 70.75,
    y: 54.95,
    size: 1.1,
    opacity: 0.54,
    delay: -5.505,
    duration: 4.0,
    driftX: 2.1,
    driftY: 3.25,
    hue: "fuchsia",
  },
  {
    id: 86,
    x: 7.92,
    y: 16.68,
    size: 2.4,
    opacity: 0.71,
    delay: -5.678,
    duration: 6.9,
    driftX: -14.7,
    driftY: -12.35,
    hue: "cyan",
  },
  {
    id: 87,
    x: 45.09,
    y: 78.41,
    size: 0.8,
    opacity: 0.27,
    delay: -5.851,
    duration: 9.8,
    driftX: -1.4,
    driftY: 2.6,
    hue: "violet",
  },
  {
    id: 88,
    x: 82.26,
    y: 40.14,
    size: 2.1,
    opacity: 0.44,
    delay: -6.024,
    duration: 3.6,
    driftX: 11.9,
    driftY: -13.0,
    hue: "fuchsia",
  },
  {
    id: 89,
    x: 19.43,
    y: 1.87,
    size: 3.4,
    opacity: 0.61,
    delay: -6.197,
    duration: 6.5,
    driftX: -4.9,
    driftY: 1.95,
    hue: "cyan",
  },
  {
    id: 90,
    x: 56.6,
    y: 63.6,
    size: 1.8,
    opacity: 0.17,
    delay: -6.37,
    duration: 9.4,
    driftX: 8.4,
    driftY: -13.65,
    hue: "violet",
  },
  {
    id: 91,
    x: 93.77,
    y: 25.33,
    size: 3.1,
    opacity: 0.34,
    delay: -6.543,
    duration: 3.2,
    driftX: -8.4,
    driftY: 1.3,
    hue: "fuchsia",
  },
  {
    id: 92,
    x: 30.94,
    y: 87.06,
    size: 1.5,
    opacity: 0.51,
    delay: -6.716,
    duration: 6.1,
    driftX: 4.9,
    driftY: -14.3,
    hue: "cyan",
  },
  {
    id: 93,
    x: 68.11,
    y: 48.79,
    size: 2.8,
    opacity: 0.68,
    delay: -6.889,
    duration: 9.0,
    driftX: -11.9,
    driftY: 0.65,
    hue: "violet",
  },
  {
    id: 94,
    x: 5.28,
    y: 10.52,
    size: 1.2,
    opacity: 0.24,
    delay: -7.062,
    duration: 11.9,
    driftX: 1.4,
    driftY: -14.95,
    hue: "fuchsia",
  },
  {
    id: 95,
    x: 42.45,
    y: 72.25,
    size: 2.5,
    opacity: 0.41,
    delay: -7.235,
    duration: 5.7,
    driftX: 14.7,
    driftY: 0.0,
    hue: "cyan",
  },
  {
    id: 96,
    x: 79.62,
    y: 33.98,
    size: 0.9,
    opacity: 0.58,
    delay: -7.408,
    duration: 8.6,
    driftX: -2.1,
    driftY: 14.95,
    hue: "violet",
  },
  {
    id: 97,
    x: 16.79,
    y: 95.71,
    size: 2.2,
    opacity: 0.14,
    delay: -7.581,
    duration: 11.5,
    driftX: 11.2,
    driftY: -0.65,
    hue: "fuchsia",
  },
  {
    id: 98,
    x: 53.96,
    y: 57.44,
    size: 3.5,
    opacity: 0.31,
    delay: -7.754,
    duration: 5.3,
    driftX: -5.6,
    driftY: 14.3,
    hue: "cyan",
  },
  {
    id: 99,
    x: 91.13,
    y: 19.17,
    size: 1.9,
    opacity: 0.48,
    delay: -7.927,
    duration: 8.2,
    driftX: 7.7,
    driftY: -1.3,
    hue: "violet",
  },
  {
    id: 100,
    x: 28.3,
    y: 80.9,
    size: 3.2,
    opacity: 0.65,
    delay: -8.1,
    duration: 11.1,
    driftX: -9.1,
    driftY: 13.65,
    hue: "fuchsia",
  },
  {
    id: 101,
    x: 65.47,
    y: 42.63,
    size: 1.6,
    opacity: 0.21,
    delay: -8.273,
    duration: 4.9,
    driftX: 4.2,
    driftY: -1.95,
    hue: "cyan",
  },
  {
    id: 102,
    x: 2.64,
    y: 4.36,
    size: 2.9,
    opacity: 0.38,
    delay: -8.446,
    duration: 7.8,
    driftX: -12.6,
    driftY: 13.0,
    hue: "violet",
  },
  {
    id: 103,
    x: 39.81,
    y: 66.09,
    size: 1.3,
    opacity: 0.55,
    delay: -8.619,
    duration: 10.7,
    driftX: 0.7,
    driftY: -2.6,
    hue: "fuchsia",
  },
  {
    id: 104,
    x: 76.98,
    y: 27.82,
    size: 2.6,
    opacity: 0.72,
    delay: -8.792,
    duration: 4.5,
    driftX: 14.0,
    driftY: 12.35,
    hue: "cyan",
  },
  {
    id: 105,
    x: 14.15,
    y: 89.55,
    size: 1.0,
    opacity: 0.28,
    delay: -8.965,
    duration: 7.4,
    driftX: -2.8,
    driftY: -3.25,
    hue: "violet",
  },
  {
    id: 106,
    x: 51.32,
    y: 51.28,
    size: 2.3,
    opacity: 0.45,
    delay: -9.138,
    duration: 10.3,
    driftX: 10.5,
    driftY: 11.7,
    hue: "fuchsia",
  },
  {
    id: 107,
    x: 88.49,
    y: 13.01,
    size: 3.6,
    opacity: 0.62,
    delay: -0.111,
    duration: 4.1,
    driftX: -6.3,
    driftY: -3.9,
    hue: "cyan",
  },
  {
    id: 108,
    x: 25.66,
    y: 74.74,
    size: 2.0,
    opacity: 0.18,
    delay: -0.284,
    duration: 7.0,
    driftX: 7.0,
    driftY: 11.05,
    hue: "violet",
  },
  {
    id: 109,
    x: 62.83,
    y: 36.47,
    size: 3.3,
    opacity: 0.35,
    delay: -0.457,
    duration: 9.9,
    driftX: -9.8,
    driftY: -4.55,
    hue: "fuchsia",
  },
  {
    id: 110,
    x: 0.0,
    y: 98.2,
    size: 1.7,
    opacity: 0.52,
    delay: -0.63,
    duration: 3.7,
    driftX: 3.5,
    driftY: 10.4,
    hue: "cyan",
  },
  {
    id: 111,
    x: 37.17,
    y: 59.93,
    size: 3.0,
    opacity: 0.69,
    delay: -0.803,
    duration: 6.6,
    driftX: -13.3,
    driftY: -5.2,
    hue: "violet",
  },
  {
    id: 112,
    x: 74.34,
    y: 21.66,
    size: 1.4,
    opacity: 0.25,
    delay: -0.976,
    duration: 9.5,
    driftX: 0.0,
    driftY: 9.75,
    hue: "fuchsia",
  },
  {
    id: 113,
    x: 11.51,
    y: 83.39,
    size: 2.7,
    opacity: 0.42,
    delay: -1.149,
    duration: 3.3,
    driftX: 13.3,
    driftY: -5.85,
    hue: "cyan",
  },
  {
    id: 114,
    x: 48.68,
    y: 45.12,
    size: 1.1,
    opacity: 0.59,
    delay: -1.322,
    duration: 6.2,
    driftX: -3.5,
    driftY: 9.1,
    hue: "violet",
  },
  {
    id: 115,
    x: 85.85,
    y: 6.85,
    size: 2.4,
    opacity: 0.15,
    delay: -1.495,
    duration: 9.1,
    driftX: 9.8,
    driftY: -6.5,
    hue: "fuchsia",
  },
  {
    id: 116,
    x: 23.02,
    y: 68.58,
    size: 0.8,
    opacity: 0.32,
    delay: -1.668,
    duration: 12.0,
    driftX: -7.0,
    driftY: 8.45,
    hue: "cyan",
  },
  {
    id: 117,
    x: 60.19,
    y: 30.31,
    size: 2.1,
    opacity: 0.49,
    delay: -1.841,
    duration: 5.8,
    driftX: 6.3,
    driftY: -7.15,
    hue: "violet",
  },
  {
    id: 118,
    x: 97.36,
    y: 92.04,
    size: 3.4,
    opacity: 0.66,
    delay: -2.014,
    duration: 8.7,
    driftX: -10.5,
    driftY: 7.8,
    hue: "fuchsia",
  },
  {
    id: 119,
    x: 34.53,
    y: 53.77,
    size: 1.8,
    opacity: 0.22,
    delay: -2.187,
    duration: 11.6,
    driftX: 2.8,
    driftY: -7.8,
    hue: "cyan",
  },
  {
    id: 120,
    x: 71.7,
    y: 15.5,
    size: 3.1,
    opacity: 0.39,
    delay: -2.36,
    duration: 5.4,
    driftX: -14.0,
    driftY: 7.15,
    hue: "violet",
  },
  {
    id: 121,
    x: 8.87,
    y: 77.23,
    size: 1.5,
    opacity: 0.56,
    delay: -2.533,
    duration: 8.3,
    driftX: -0.7,
    driftY: -8.45,
    hue: "fuchsia",
  },
  {
    id: 122,
    x: 46.04,
    y: 38.96,
    size: 2.8,
    opacity: 0.12,
    delay: -2.706,
    duration: 11.2,
    driftX: 12.6,
    driftY: 6.5,
    hue: "cyan",
  },
  {
    id: 123,
    x: 83.21,
    y: 0.69,
    size: 1.2,
    opacity: 0.29,
    delay: -2.879,
    duration: 5.0,
    driftX: -4.2,
    driftY: -9.1,
    hue: "violet",
  },
  {
    id: 124,
    x: 20.38,
    y: 62.42,
    size: 2.5,
    opacity: 0.46,
    delay: -3.052,
    duration: 7.9,
    driftX: 9.1,
    driftY: 5.85,
    hue: "fuchsia",
  },
  {
    id: 125,
    x: 57.55,
    y: 24.15,
    size: 0.9,
    opacity: 0.63,
    delay: -3.225,
    duration: 10.8,
    driftX: -7.7,
    driftY: -9.75,
    hue: "cyan",
  },
  {
    id: 126,
    x: 94.72,
    y: 85.88,
    size: 2.2,
    opacity: 0.19,
    delay: -3.398,
    duration: 4.6,
    driftX: 5.6,
    driftY: 5.2,
    hue: "violet",
  },
  {
    id: 127,
    x: 31.89,
    y: 47.61,
    size: 3.5,
    opacity: 0.36,
    delay: -3.571,
    duration: 7.5,
    driftX: -11.2,
    driftY: -10.4,
    hue: "fuchsia",
  },
  {
    id: 128,
    x: 69.06,
    y: 9.34,
    size: 1.9,
    opacity: 0.53,
    delay: -3.744,
    duration: 10.4,
    driftX: 2.1,
    driftY: 4.55,
    hue: "cyan",
  },
  {
    id: 129,
    x: 6.23,
    y: 71.07,
    size: 3.2,
    opacity: 0.7,
    delay: -3.917,
    duration: 4.2,
    driftX: -14.7,
    driftY: -11.05,
    hue: "violet",
  },
  {
    id: 130,
    x: 43.4,
    y: 32.8,
    size: 1.6,
    opacity: 0.26,
    delay: -4.09,
    duration: 7.1,
    driftX: -1.4,
    driftY: 3.9,
    hue: "fuchsia",
  },
  {
    id: 131,
    x: 80.57,
    y: 94.53,
    size: 2.9,
    opacity: 0.43,
    delay: -4.263,
    duration: 10.0,
    driftX: 11.9,
    driftY: -11.7,
    hue: "cyan",
  },
  {
    id: 132,
    x: 17.74,
    y: 56.26,
    size: 1.3,
    opacity: 0.6,
    delay: -4.436,
    duration: 3.8,
    driftX: -4.9,
    driftY: 3.25,
    hue: "violet",
  },
  {
    id: 133,
    x: 54.91,
    y: 17.99,
    size: 2.6,
    opacity: 0.16,
    delay: -4.609,
    duration: 6.7,
    driftX: 8.4,
    driftY: -12.35,
    hue: "fuchsia",
  },
  {
    id: 134,
    x: 92.08,
    y: 79.72,
    size: 1.0,
    opacity: 0.33,
    delay: -4.782,
    duration: 9.6,
    driftX: -8.4,
    driftY: 2.6,
    hue: "cyan",
  },
  {
    id: 135,
    x: 29.25,
    y: 41.45,
    size: 2.3,
    opacity: 0.5,
    delay: -4.955,
    duration: 3.4,
    driftX: 4.9,
    driftY: -13.0,
    hue: "violet",
  },
  {
    id: 136,
    x: 66.42,
    y: 3.18,
    size: 3.6,
    opacity: 0.67,
    delay: -5.128,
    duration: 6.3,
    driftX: -11.9,
    driftY: 1.95,
    hue: "fuchsia",
  },
  {
    id: 137,
    x: 3.59,
    y: 64.91,
    size: 2.0,
    opacity: 0.23,
    delay: -5.301,
    duration: 9.2,
    driftX: 1.4,
    driftY: -13.65,
    hue: "cyan",
  },
  {
    id: 138,
    x: 40.76,
    y: 26.64,
    size: 3.3,
    opacity: 0.4,
    delay: -5.474,
    duration: 12.1,
    driftX: 14.7,
    driftY: 1.3,
    hue: "violet",
  },
  {
    id: 139,
    x: 77.93,
    y: 88.37,
    size: 1.7,
    opacity: 0.57,
    delay: -5.647,
    duration: 5.9,
    driftX: -2.1,
    driftY: -14.3,
    hue: "fuchsia",
  },
  {
    id: 140,
    x: 15.1,
    y: 50.1,
    size: 3.0,
    opacity: 0.13,
    delay: -5.82,
    duration: 8.8,
    driftX: 11.2,
    driftY: 0.65,
    hue: "cyan",
  },
  {
    id: 141,
    x: 52.27,
    y: 11.83,
    size: 1.4,
    opacity: 0.3,
    delay: -5.993,
    duration: 11.7,
    driftX: -5.6,
    driftY: -14.95,
    hue: "violet",
  },
  {
    id: 142,
    x: 89.44,
    y: 73.56,
    size: 2.7,
    opacity: 0.47,
    delay: -6.166,
    duration: 5.5,
    driftX: 7.7,
    driftY: 0.0,
    hue: "fuchsia",
  },
  {
    id: 143,
    x: 26.61,
    y: 35.29,
    size: 1.1,
    opacity: 0.64,
    delay: -6.339,
    duration: 8.4,
    driftX: -9.1,
    driftY: 14.95,
    hue: "cyan",
  },
  {
    id: 144,
    x: 63.78,
    y: 97.02,
    size: 2.4,
    opacity: 0.2,
    delay: -6.512,
    duration: 11.3,
    driftX: 4.2,
    driftY: -0.65,
    hue: "violet",
  },
  {
    id: 145,
    x: 0.95,
    y: 58.75,
    size: 0.8,
    opacity: 0.37,
    delay: -6.685,
    duration: 5.1,
    driftX: -12.6,
    driftY: 14.3,
    hue: "fuchsia",
  },
  {
    id: 146,
    x: 38.12,
    y: 20.48,
    size: 2.1,
    opacity: 0.54,
    delay: -6.858,
    duration: 8.0,
    driftX: 0.7,
    driftY: -1.3,
    hue: "cyan",
  },
  {
    id: 147,
    x: 75.29,
    y: 82.21,
    size: 3.4,
    opacity: 0.71,
    delay: -7.031,
    duration: 10.9,
    driftX: 14.0,
    driftY: 13.65,
    hue: "violet",
  },
  {
    id: 148,
    x: 12.46,
    y: 43.94,
    size: 1.8,
    opacity: 0.27,
    delay: -7.204,
    duration: 4.7,
    driftX: -2.8,
    driftY: -1.95,
    hue: "fuchsia",
  },
  {
    id: 149,
    x: 49.63,
    y: 5.67,
    size: 3.1,
    opacity: 0.44,
    delay: -7.377,
    duration: 7.6,
    driftX: 10.5,
    driftY: 13.0,
    hue: "cyan",
  },
  {
    id: 150,
    x: 86.8,
    y: 67.4,
    size: 1.5,
    opacity: 0.61,
    delay: -7.55,
    duration: 10.5,
    driftX: -6.3,
    driftY: -2.6,
    hue: "violet",
  },
  {
    id: 151,
    x: 23.97,
    y: 29.13,
    size: 2.8,
    opacity: 0.17,
    delay: -7.723,
    duration: 4.3,
    driftX: 7.0,
    driftY: 12.35,
    hue: "fuchsia",
  },
  {
    id: 152,
    x: 61.14,
    y: 90.86,
    size: 1.2,
    opacity: 0.34,
    delay: -7.896,
    duration: 7.2,
    driftX: -9.8,
    driftY: -3.25,
    hue: "cyan",
  },
  {
    id: 153,
    x: 98.31,
    y: 52.59,
    size: 2.5,
    opacity: 0.51,
    delay: -8.069,
    duration: 10.1,
    driftX: 3.5,
    driftY: 11.7,
    hue: "violet",
  },
  {
    id: 154,
    x: 35.48,
    y: 14.32,
    size: 0.9,
    opacity: 0.68,
    delay: -8.242,
    duration: 3.9,
    driftX: -13.3,
    driftY: -3.9,
    hue: "fuchsia",
  },
  {
    id: 155,
    x: 72.65,
    y: 76.05,
    size: 2.2,
    opacity: 0.24,
    delay: -8.415,
    duration: 6.8,
    driftX: 0.0,
    driftY: 11.05,
    hue: "cyan",
  },
  {
    id: 156,
    x: 9.82,
    y: 37.78,
    size: 3.5,
    opacity: 0.41,
    delay: -8.588,
    duration: 9.7,
    driftX: 13.3,
    driftY: -4.55,
    hue: "violet",
  },
  {
    id: 157,
    x: 46.99,
    y: 99.51,
    size: 1.9,
    opacity: 0.58,
    delay: -8.761,
    duration: 3.5,
    driftX: -3.5,
    driftY: 10.4,
    hue: "fuchsia",
  },
  {
    id: 158,
    x: 84.16,
    y: 61.24,
    size: 3.2,
    opacity: 0.14,
    delay: -8.934,
    duration: 6.4,
    driftX: 9.8,
    driftY: -5.2,
    hue: "cyan",
  },
  {
    id: 159,
    x: 21.33,
    y: 22.97,
    size: 1.6,
    opacity: 0.31,
    delay: -9.107,
    duration: 9.3,
    driftX: -7.0,
    driftY: 9.75,
    hue: "violet",
  },
];

type EditorDraftMetadata = {
  songId: string;
  title: string;
  difficulty: Difficulty;
  duration: number;
  currentTime: number;
  audioName: string;
  savedAt: string;
  hasLocalAudio: boolean;
  charts: PublishedCharts;
};

type StoredDraftAudio = {
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
};

const KEYS: LaneKey[] = ["A", "K"];

// 자동 채보 생성은 사용하지 않는다.
// 아래 값은 과거 채보 호환 코드가 참조할 수 있어 유지하지만,
// 수동 작업/송출 과정에서는 노트 수를 강제하지 않는다.
const TARGET_NOTE_COUNTS: Record<Difficulty, number> = {
  easy: 400,
  normal: 750,
  hard: 1400,
};

const LANE_INDEX: Record<LaneKey, number> = {
  A: 0,
  K: 1,
};

const KEY_TO_LANE: Record<string, LaneKey | undefined> = {
  a: "A",
  k: "K",
};

function normalizeLaneKey(value: unknown): LaneKey | null {
  // 과거 A/S/K/L 또는 A/K 채보도 새 A/K 편집기에 불러온다.
  if (value === "A") return "A";
  if (value === "K") return "K";

  if (value === "D" || value === "S") return "A";
  if (value === "L") return "K";

  return null;
}

const STORAGE_KEY = "hoo-rhythm-v1";
const BEST_KEY = "hoo-rhythm-best-v1";
const COVER_KEY = "hoo-rhythm-covers-v1";
const PUBLISHED_CACHE_KEY = "hoo-rhythm-published-cache-v1";
const DRAFT_META_KEY = "hoo-rhythm-editor-draft-v2";
const DRAFT_DB_NAME = "hoo-rhythm-editor-drafts";
const DRAFT_DB_VERSION = 1;
const DRAFT_AUDIO_STORE = "audio";


const RHYTHM_BUCKET = "hoo-rhythm";
const RHYTHM_TABLE = "hoo_rhythm_songs";
const RHYTHM_ADMIN_TABLE = "hoo_rhythm_admins";

function editorDraftMetaKey(songId: string) {
  return `${DRAFT_META_KEY}:${songId}`;
}

function loadEditorDraftMetadata(
  songId: string,
): EditorDraftMetadata | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(
      editorDraftMetaKey(songId),
    );

    if (!raw) return null;

    const parsed = JSON.parse(
      raw,
    ) as EditorDraftMetadata;

    if (
      !parsed ||
      parsed.songId !== songId ||
      !parsed.charts ||
      !parsed.savedAt
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveEditorDraftMetadata(
  draft: EditorDraftMetadata,
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    editorDraftMetaKey(draft.songId),
    JSON.stringify(draft),
  );
}

function removeEditorDraftMetadata(
  songId: string,
) {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(
    editorDraftMetaKey(songId),
  );
}

function hasEditorDraft(songId: string) {
  if (typeof window === "undefined") return false;

  return (
    window.localStorage.getItem(
      editorDraftMetaKey(songId),
    ) !== null
  );
}

function openDraftDatabase(): Promise<IDBDatabase | null> {
  if (
    typeof window === "undefined" ||
    !("indexedDB" in window)
  ) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(
      DRAFT_DB_NAME,
      DRAFT_DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (
        !db.objectStoreNames.contains(
          DRAFT_AUDIO_STORE,
        )
      ) {
        db.createObjectStore(
          DRAFT_AUDIO_STORE,
        );
      }
    };

    request.onsuccess = () =>
      resolve(request.result);

    request.onerror = () =>
      reject(
        request.error ||
          new Error(
            "초안 저장소를 열지 못했습니다.",
          ),
      );
  });
}

async function saveDraftAudioFile(
  songId: string,
  file: File,
) {
  const db = await openDraftDatabase();

  if (!db) {
    throw new Error(
      "이 브라우저에서는 음원 초안 저장소를 사용할 수 없습니다.",
    );
  }

  const payload: StoredDraftAudio = {
    blob: file.slice(
      0,
      file.size,
      file.type,
    ),
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
  };

  await new Promise<void>(
    (resolve, reject) => {
      const transaction = db.transaction(
        DRAFT_AUDIO_STORE,
        "readwrite",
      );

      transaction
        .objectStore(
          DRAFT_AUDIO_STORE,
        )
        .put(payload, songId);

      transaction.oncomplete = () =>
        resolve();

      transaction.onerror = () =>
        reject(
          transaction.error ||
            new Error(
              "음원 초안 저장에 실패했습니다.",
            ),
        );

      transaction.onabort = () =>
        reject(
          transaction.error ||
            new Error(
              "음원 초안 저장이 중단되었습니다.",
            ),
        );
    },
  );

  db.close();
}

async function loadDraftAudioFile(
  songId: string,
): Promise<File | null> {
  const db = await openDraftDatabase();
  if (!db) return null;

  const stored =
    await new Promise<
      StoredDraftAudio | undefined
    >((resolve, reject) => {
      const transaction =
        db.transaction(
          DRAFT_AUDIO_STORE,
          "readonly",
        );

      const request = transaction
        .objectStore(
          DRAFT_AUDIO_STORE,
        )
        .get(songId);

      request.onsuccess = () =>
        resolve(
          request.result as
            | StoredDraftAudio
            | undefined,
        );

      request.onerror = () =>
        reject(
          request.error ||
            new Error(
              "저장된 음원을 읽지 못했습니다.",
            ),
        );
    });

  db.close();

  if (!stored?.blob) return null;

  return new File(
    [stored.blob],
    stored.name ||
      `${songId}.audio`,
    {
      type:
        stored.type ||
        stored.blob.type ||
        "audio/mpeg",
      lastModified:
        stored.lastModified ||
        Date.now(),
    },
  );
}

async function removeDraftAudioFile(
  songId: string,
) {
  const db = await openDraftDatabase();
  if (!db) return;

  await new Promise<void>(
    (resolve, reject) => {
      const transaction = db.transaction(
        DRAFT_AUDIO_STORE,
        "readwrite",
      );

      transaction
        .objectStore(
          DRAFT_AUDIO_STORE,
        )
        .delete(songId);

      transaction.oncomplete = () =>
        resolve();

      transaction.onerror = () =>
        reject(
          transaction.error ||
            new Error(
              "음원 초안 삭제에 실패했습니다.",
            ),
        );
    },
  );

  db.close();
}

function loadPublishedSongCache(): PublishedSongRow[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PUBLISHED_CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is PublishedSongRow =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof item.song_id === "string" &&
            typeof item.audio_url === "string" &&
            item.published === true,
        ),
    );
  } catch {
    return [];
  }
}

function savePublishedSongCache(rows: PublishedSongRow[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PUBLISHED_CACHE_KEY,
      JSON.stringify(rows),
    );
  } catch {
    // Cache failure must never block gameplay.
  }
}

function mergePublishedRows(
  current: PublishedSongRow[],
  incoming: PublishedSongRow[],
) {
  const map = new Map<string, PublishedSongRow>();

  for (const row of current) {
    if (row?.song_id) map.set(row.song_id, row);
  }

  for (const row of incoming) {
    if (!row?.song_id) continue;

    const previous = map.get(row.song_id);
    const previousTime = previous?.updated_at
      ? Date.parse(previous.updated_at)
      : 0;
    const nextTime = row.updated_at
      ? Date.parse(row.updated_at)
      : 0;

    if (!previous || nextTime >= previousTime) {
      map.set(row.song_id, row);
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      Number(a.sort_order || 0) - Number(b.sort_order || 0),
  );
}

function normalizePublishedChart(
  raw: unknown,
  song: Song,
  difficulty: Difficulty,
): Chart {
  if (!raw || typeof raw !== "object") {
    return defaultChart(song, difficulty);
  }

  const candidate = raw as Partial<Chart>;
  const notes: RhythmNote[] = [];
  const seen = new Set<string>();

  if (Array.isArray(candidate.notes)) {
    for (const rawNote of candidate.notes) {
      if (
        !rawNote ||
        typeof rawNote !== "object"
      ) {
        continue;
      }

      const source = rawNote as {
        id?: unknown;
        time?: unknown;
        lane?: unknown;
        duration?: unknown;
      };

      const lane = normalizeLaneKey(source.lane);
      const time = Number(source.time);
      const holdDuration = Number(source.duration);

      if (!lane || !Number.isFinite(time)) {
        continue;
      }

      const duplicateKey =
        `${time.toFixed(4)}:${lane}`;

      if (seen.has(duplicateKey)) continue;
      seen.add(duplicateKey);

      notes.push({
        id:
          typeof source.id === "string" &&
          source.id
            ? source.id
            : idForNote(time, lane),
        time,
        lane,
        duration:
          Number.isFinite(holdDuration) && holdDuration > 0.04
            ? holdDuration
            : undefined,
      });
    }
  }

  notes.sort(
    (a, b) =>
      a.time - b.time ||
      LANE_INDEX[a.lane] -
        LANE_INDEX[b.lane],
  );

  return {
    bpm: Number(candidate.bpm) || song.bpm,
    offset: Number(candidate.offset) || 0,
    notes,
    analyzedAt:
      typeof candidate.analyzedAt === "string"
        ? candidate.analyzedAt
        : undefined,
  };
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, payload] = dataUrl.split(",");
  if (!meta || !payload) throw new Error("커버 이미지 데이터를 읽지 못했습니다.");

  const mimeMatch = meta.match(/^data:([^;]+);base64$/i);
  const mime = mimeMatch?.[1] || "image/webp";
  const binary = window.atob(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

function safeStorageName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "asset";
}

const JUDGMENT_WINDOWS = {
  PERFECT: 0.045,
  GREAT: 0.09,
  GOOD: 0.145,
};

const EDITOR_UI_FRAME_MS = 33;
const PLAY_UI_FRAME_MS = 30;
const NOTE_LIST_PAGE_SIZE = 120;

const SONGS: Song[] = [
  {
    id: "season-of-stars",
    title: "별의 계절",
    subtitle: "푸른 밤이 지나, 다시 만날 계절",
    duration: 201,
    genre: "CINEMATIC POP",
    bpm: 128,
  },
  {
    id: "turn-around",
    title: "Turn Around",
    subtitle: "다시, 너에게 닿을 때까지",
    duration: 188,
    genre: "POP ROCK",
    bpm: 145,
  },
  {
    id: "dont-want-to-hear",
    title: "듣기 싫은 노래",
    subtitle: "지워지지 않는 마음에 대하여",
    duration: 212,
    genre: "RAP BALLAD",
    bpm: 102,
  },
  {
    id: "ghost-train",
    title: "Ghost Train",
    subtitle: "보름달 아래, 단 하루의 유령열차",
    duration: 216,
    genre: "DARK POP",
    bpm: 72,
  },
  {
    id: "forest-spirit",
    title: "Forest Spirit",
    subtitle: "잊힌 숲이 다시 노래할 때",
    duration: 198,
    genre: "DREAM FANTASY",
    bpm: 116,
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

type PlayPerspectiveLayout = {
  x: number;
  y: number;
  widthPercent: number;
  heightPx: number;
  depth: number;
  opacity: number;
};

function getPlayPerspectiveLayout(
  lane: LaneKey,
  rawTravel: number,
): PlayPerspectiveLayout {
  const travel = clamp(
    rawTravel,
    0,
    1,
  );

  // 실제 레인 사다리꼴과 같은 원근 곡선.
  // 위쪽에서는 중앙에 모이고, 판정선으로 갈수록 좌우로 벌어진다.
  const depth =
    Math.pow(
      travel,
      1.38,
    );

  const topLeftLaneCenter =
    45.15;
  const bottomLeftLaneCenter =
    29.75;

  const topRightLaneCenter =
    54.85;
  const bottomRightLaneCenter =
    70.25;

  const x =
    lane === "A"
      ? topLeftLaneCenter +
        (
          bottomLeftLaneCenter -
          topLeftLaneCenter
        ) *
          depth
      : topRightLaneCenter +
        (
          bottomRightLaneCenter -
          topRightLaneCenter
        ) *
          depth;

  const y =
    6 +
    depth *
      77;

  // 기존 대비 약 35% 확대하면서 가까워질수록 레인 폭에 맞춰 확대.
  const widthPercent =
    5.2 +
    depth *
      11.8;

  const heightPx =
    20 +
    depth *
      28;

  const opacity =
    0.42 +
    depth *
      0.58;

  return {
    x,
    y,
    widthPercent,
    heightPx,
    depth,
    opacity,
  };
}

type PlayComboMilestoneTier =
  | "standard"
  | "overdrive"
  | "century";

type PlayComboMilestoneFx = {
  serial: number;
  combo: number;
  tier: PlayComboMilestoneTier;
  stardustCount: number;
  rayCount: number;
  duration: number;
};

const PLAY_COMBO_MILESTONES_BELOW_200 =
  new Set([
    30,
    50,
    70,
    100,
    120,
    150,
    170,
    190,
  ]);

function isPlayComboMilestone(
  combo: number,
) {
  if (combo < 30) {
    return false;
  }

  if (combo >= 200) {
    return combo % 10 === 0;
  }

  return PLAY_COMBO_MILESTONES_BELOW_200.has(
    combo,
  );
}

function getPlayComboMilestoneTier(
  combo: number,
): PlayComboMilestoneTier {
  if (
    combo >= 100 &&
    combo % 100 === 0
  ) {
    return "century";
  }

  if (combo >= 200) {
    return "overdrive";
  }

  return "standard";
}

function getPlayComboMilestoneFx(
  combo: number,
  serial: number,
): PlayComboMilestoneFx {
  const tier =
    getPlayComboMilestoneTier(
      combo,
    );

  const is200Plus =
    combo >= 200;

  if (tier === "century") {
    return {
      serial,
      combo,
      tier,
      stardustCount:
        is200Plus ? 84 : 70,
      rayCount:
        is200Plus ? 34 : 28,
      duration:
        is200Plus ? 1760 : 1580,
    };
  }

  if (tier === "overdrive") {
    return {
      serial,
      combo,
      tier,
      stardustCount: 56,
      rayCount: 24,
      duration: 1420,
    };
  }

  return {
    serial,
    combo,
    tier,
    stardustCount:
      combo >= 150 ? 48 : 34,
    rayCount:
      combo >= 150 ? 24 : 18,
    duration: 1280,
  };
}

type PlayTrailTier = 0 | 1 | 2 | 3;

type PlayTrailTierConfig = {
  length: number;
  ribbonLayers: number;
  sparkCount: number;
  blurWidth: number;
  coreWidth: number;
  opacity: number;
  noteGlow: boolean;
  floorGlow: boolean;
};

const PLAY_TRAIL_TIER_CONFIG: Record<
  PlayTrailTier,
  PlayTrailTierConfig
> = {
  0: {
    length: 0,
    ribbonLayers: 0,
    sparkCount: 0,
    blurWidth: 0,
    coreWidth: 0,
    opacity: 0,
    noteGlow: false,
    floorGlow: false,
  },
  1: {
    length: 0.095,
    ribbonLayers: 2,
    sparkCount: 2,
    blurWidth: 11,
    coreWidth: 2.2,
    opacity: 0.30,
    noteGlow: false,
    floorGlow: false,
  },
  2: {
    length: 0.205,
    ribbonLayers: 3,
    sparkCount: 7,
    blurWidth: 18,
    coreWidth: 3.5,
    opacity: 0.46,
    noteGlow: false,
    floorGlow: false,
  },
  3: {
    length: 0.315,
    ribbonLayers: 4,
    sparkCount: 13,
    blurWidth: 25,
    coreWidth: 5.2,
    opacity: 0.68,
    noteGlow: true,
    floorGlow: true,
  },
};

function getPlayTrailTier(
  combo: number,
): PlayTrailTier {
  if (combo >= 31) return 3;
  if (combo >= 20) return 2;
  if (combo >= 10) return 1;
  return 0;
}

function getPlayTrailPolyline(
  lane: LaneKey,
  rawTravel: number,
  trailLength: number,
  samples = 12,
) {
  const points: string[] = [];

  for (
    let index = 0;
    index <= samples;
    index += 1
  ) {
    const ratio =
      index / samples;

    const travel =
      clamp(
        rawTravel -
          trailLength *
            (1 - ratio),
        0,
        1,
      );

    const point =
      getPlayPerspectiveLayout(
        lane,
        travel,
      );

    points.push(
      `${point.x.toFixed(3)},${point.y.toFixed(3)}`,
    );
  }

  return points.join(" ");
}


type PlayTrailGeometryPoint = {
  x: number;
  y: number;
  ratio: number;
};

type PlayTrailGeometry = {
  center: PlayTrailGeometryPoint[];
  left: PlayTrailGeometryPoint[];
  right: PlayTrailGeometryPoint[];
};



function tracePlayTrailRoundedBlock(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeWidth =
    Math.max(
      1,
      width,
    );

  const safeHeight =
    Math.max(
      1,
      height,
    );

  const safeRadius =
    Math.min(
      Math.max(
        0,
        radius,
      ),
      safeWidth / 2,
      safeHeight / 2,
    );

  const left =
    centerX -
    safeWidth / 2;

  const top =
    centerY -
    safeHeight / 2;

  const right =
    left +
    safeWidth;

  const bottom =
    top +
    safeHeight;

  context.beginPath();

  context.moveTo(
    left + safeRadius,
    top,
  );

  context.lineTo(
    right - safeRadius,
    top,
  );

  context.quadraticCurveTo(
    right,
    top,
    right,
    top + safeRadius,
  );

  context.lineTo(
    right,
    bottom - safeRadius,
  );

  context.quadraticCurveTo(
    right,
    bottom,
    right - safeRadius,
    bottom,
  );

  context.lineTo(
    left + safeRadius,
    bottom,
  );

  context.quadraticCurveTo(
    left,
    bottom,
    left,
    bottom - safeRadius,
  );

  context.lineTo(
    left,
    top + safeRadius,
  );

  context.quadraticCurveTo(
    left,
    top,
    left + safeRadius,
    top,
  );

  context.closePath();
}

function getPlayRoadSparkleCount(
  combo: number,
  quality: number,
) {
  if (combo < 10) {
    return 0;
  }

  // Continuous combo growth:
  // 10  combo ≈ 16 stars
  // 30  combo ≈ 29 stars
  // 50  combo ≈ 43 stars
  // 70  combo ≈ 58 stars
  // 100 combo ≈ 82 stars
  // 150 combo ≈ 112 stars
  // 200 combo ≈ 142 stars
  // 250+ gradually approaches the visual cap.
  const continuousGrowth =
    10 +
    combo *
      0.56 +
    Math.max(
      0,
      combo - 40,
    ) *
      0.12 +
    Math.max(
      0,
      combo - 90,
    ) *
      0.10 +
    Math.max(
      0,
      combo - 180,
    ) *
      0.06;

  const baseCount =
    Math.min(
      168,
      Math.round(
        continuousGrowth,
      ),
    );

  // Adaptive quality stays active so low-end devices can back off automatically.
  return Math.max(
    0,
    Math.round(
      baseCount *
        clamp(
          quality,
          0.56,
          1,
        ),
    ),
  );
}

function getPlayRoadHitBurstCount(
  combo: number,
  judgment: Judgment,
  quality: number,
) {
  const judgmentPower =
    judgment === "PERFECT"
      ? 1
      : judgment === "GREAT"
        ? 0.58
        : judgment === "GOOD"
          ? 0.28
          : 0;

  if (
    judgmentPower <= 0 ||
    combo < 1
  ) {
    return 0;
  }

  // Every successful hit produces a short extra burst.
  // The burst grows continuously with combo and is strongest on PERFECT.
  const base =
    5 +
    combo *
      0.075 +
    Math.max(
      0,
      combo - 100,
    ) *
      0.035;

  return Math.max(
    1,
    Math.min(
      34,
      Math.round(
        base *
          judgmentPower *
          clamp(
            quality,
            0.60,
            1,
          ),
      ),
    ),
  );
}



function getPlayRoadBoundsAtY(
  yPercent: number,
) {
  const depth =
    clamp(
      (
        yPercent -
        2
      ) /
        86,
      0,
      1,
    );

  const left =
    40.32 +
    (
      9.52 -
      40.32
    ) *
      depth;

  const right =
    59.68 +
    (
      90.48 -
      59.68
    ) *
      depth;

  return {
    left,
    right,
    depth,
  };
}

function getPlayRoadSparkleColor(
  xPercent: number,
  warmth: number,
  combo: number,
) {
  if (
    combo >= 100 &&
    warmth > 0.82
  ) {
    return {
      core:
        "255,248,214",
      glow:
        "250,204,21",
    };
  }

  if (
    xPercent <
    48
  ) {
    return {
      core:
        "207,250,254",
      glow:
        "34,211,238",
    };
  }

  if (
    xPercent >
    52
  ) {
    return {
      core:
        "250,232,255",
      glow:
        "217,70,239",
    };
  }

  return {
    core:
      "255,255,255",
    glow:
      "196,181,253",
  };
}

function getPlayTrailPresetOffset(
  noteId: string,
) {
  let hash = 0;

  for (
    let index = 0;
    index < noteId.length;
    index += 1
  ) {
    hash =
      (
        hash * 31 +
        noteId.charCodeAt(index)
      ) >>> 0;
  }

  return (
    hash %
    PLAY_EFFECT_PRESET_MOD
  );
}

type PlayTrailSparkPreset = {
  id: number;
  position: number;
  offsetX: number;
  offsetY: number;
  radius: number;
  opacity: number;
  delay: number;
  duration: number;
};

type PlayTrailMotionPreset = {
  id: number;
  phase: number;
  breathe: number;
  sweep: number;
  blur: number;
  widthBias: number;
  alphaBias: number;
  shimmer: number;
  dustBias: number;
};

type PlayComboStarDustPreset = {
  id: number;
  angle: number;
  distance: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
  tail: number;
  curve: number;
  spin: number;
  hue:
    | "cyan"
    | "violet"
    | "fuchsia"
    | "white"
    | "gold";
};

type PlayComboBurstPreset = {
  id: number;
  angle: number;
  length: number;
  thickness: number;
  opacity: number;
  delay: number;
  duration: number;
  radius: number;
};

const PLAY_EFFECT_PRESET_MOD =
  1024;

function getPlayTrailSparkPreset(
  rawIndex: number,
): PlayTrailSparkPreset {
  const index =
    Math.abs(
      Math.floor(rawIndex),
    ) %
    PLAY_EFFECT_PRESET_MOD;

  return {
    id: index,
    position:
      0.06 +
      (
        (
          index *
          37
        ) %
        91
      ) /
        100,
    offsetX:
      (
        (
          (
            index *
            19
          ) %
          41
        ) -
        20
      ) /
      10,
    offsetY:
      (
        (
          (
            index *
            23
          ) %
          31
        ) -
        15
      ) /
      10,
    radius:
      0.55 +
      (
        (
          index *
          17
        ) %
        18
      ) /
        10,
    opacity:
      0.22 +
      (
        (
          index *
          29
        ) %
        59
      ) /
        100,
    delay:
      -(
        (
          index *
          0.037
        ) %
        0.72
      ),
    duration:
      0.34 +
      (
        (
          index *
          13
        ) %
        38
      ) /
        100,
  };
}

function getPlayTrailMotionPreset(
  rawIndex: number,
): PlayTrailMotionPreset {
  const index =
    Math.abs(
      Math.floor(rawIndex),
    ) %
    PLAY_EFFECT_PRESET_MOD;

  return {
    id: index,
    phase:
      -(
        (
          index *
          0.037
        ) %
        1.7
      ),
    breathe:
      0.48 +
      (
        (
          index *
          17
        ) %
        41
      ) /
        100,
    sweep:
      0.38 +
      (
        (
          index *
          23
        ) %
        49
      ) /
        100,
    blur:
      3.2 +
      (
        (
          index *
          29
        ) %
        53
      ) /
        10,
    widthBias:
      0.88 +
      (
        (
          index *
          31
        ) %
        29
      ) /
        100,
    alphaBias:
      0.74 +
      (
        (
          index *
          19
        ) %
        24
      ) /
        100,
    shimmer:
      0.32 +
      (
        (
          index *
          13
        ) %
        46
      ) /
        100,
    dustBias:
      0.55 +
      (
        (
          index *
          11
        ) %
        38
      ) /
        100,
  };
}

function getPlayComboStarDustPreset(
  rawIndex: number,
): PlayComboStarDustPreset {
  const index =
    Math.abs(
      Math.floor(rawIndex),
    ) %
    PLAY_EFFECT_PRESET_MOD;

  const hues: PlayComboStarDustPreset["hue"][] =
    [
      "cyan",
      "violet",
      "fuchsia",
      "white",
      "gold",
    ];

  return {
    id: index,
    angle:
      (
        index *
          137.508 +
        (
          index %
          9
        ) *
          3.17
      ) %
      360,
    distance:
      58 +
      (
        index *
        37
      ) %
        188,
    size:
      1.1 +
      (
        (
          index *
          17
        ) %
        35
      ) /
        10,
    opacity:
      0.38 +
      (
        (
          index *
          29
        ) %
        60
      ) /
        100,
    delay:
      (
        index %
        23
      ) *
      0.011,
    duration:
      0.58 +
      (
        (
          index *
          31
        ) %
        67
      ) /
        100,
    tail:
      20 +
      (
        index *
        41
      ) %
        92,
    curve:
      (
        (
          (
            index *
            19
          ) %
          41
        ) -
        20
      ) /
      10,
    spin:
      (
        (
          (
            index *
            47
          ) %
          101
        ) -
        50
      ) *
      2.1,
    hue:
      hues[
        (
          index *
            7 +
          Math.floor(
            index /
              5,
          )
        ) %
          hues.length
      ],
  };
}

function getPlayComboBurstPreset(
  rawIndex: number,
): PlayComboBurstPreset {
  const index =
    Math.abs(
      Math.floor(rawIndex),
    ) %
    PLAY_EFFECT_PRESET_MOD;

  return {
    id: index,
    angle:
      (
        index *
          111.246 +
        (
          index %
          7
        ) *
          6.4
      ) %
      360,
    length:
      44 +
      (
        index *
        43
      ) %
        156,
    thickness:
      0.8 +
      (
        (
          index *
          13
        ) %
        28
      ) /
        10,
    opacity:
      0.26 +
      (
        (
          index *
          17
        ) %
        72
      ) /
        100,
    delay:
      (
        index %
        19
      ) *
      0.013,
    duration:
      0.48 +
      (
        (
          index *
          23
        ) %
        54
      ) /
        100,
    radius:
      22 +
      (
        index *
        31
      ) %
        116,
  };
}


// ============================================================
// HOO ROAD SPARKLE EFFECT BANK START
// Dedicated play-road sparkle / shockwave motion presets.
// Runtime uses only a small adaptive subset of these entries.
// ============================================================
type PlayRoadSparklePreset = {
  id: number;
  x: number;
  phase: number;
  speed: number;
  size: number;
  opacity: number;
  twinkle: number;
  drift: number;
  shockPhase: number;
  warmth: number;
  stretch: number;
};

const PLAY_ROAD_SPARKLE_PRESETS: PlayRoadSparklePreset[] = [
  {
    id: 0,
    x: 0.055,
    phase: 0.0,
    speed: 0.055,
    size: 0.72,
    opacity: 0.2,
    twinkle: 2.7,
    drift: -2.0,
    shockPhase: 0.0,
    warmth: 0.0,
    stretch: 0.8,
  },
  {
    id: 1,
    x: 0.092,
    phase: 0.0612,
    speed: 0.084,
    size: 2.42,
    opacity: 0.63,
    twinkle: 5.0,
    drift: 1.1,
    shockPhase: 0.47,
    warmth: 0.53,
    stretch: 2.1,
  },
  {
    id: 2,
    x: 0.129,
    phase: 0.1224,
    speed: 0.113,
    size: 1.02,
    opacity: 0.49,
    twinkle: 7.3,
    drift: 0.1,
    shockPhase: 0.94,
    warmth: 0.05,
    stretch: 3.4,
  },
  {
    id: 3,
    x: 0.166,
    phase: 0.1836,
    speed: 0.058,
    size: 2.72,
    opacity: 0.35,
    twinkle: 4.7,
    drift: -0.9,
    shockPhase: 1.41,
    warmth: 0.58,
    stretch: 1.9,
  },
  {
    id: 4,
    x: 0.203,
    phase: 0.2447,
    speed: 0.087,
    size: 1.32,
    opacity: 0.21,
    twinkle: 7.0,
    drift: -1.9,
    shockPhase: 1.88,
    warmth: 0.1,
    stretch: 3.2,
  },
  {
    id: 5,
    x: 0.24,
    phase: 0.3059,
    speed: 0.116,
    size: 3.02,
    opacity: 0.64,
    twinkle: 4.4,
    drift: 1.2,
    shockPhase: 2.35,
    warmth: 0.63,
    stretch: 1.7,
  },
  {
    id: 6,
    x: 0.277,
    phase: 0.3671,
    speed: 0.061,
    size: 1.62,
    opacity: 0.5,
    twinkle: 6.7,
    drift: 0.2,
    shockPhase: 2.82,
    warmth: 0.15,
    stretch: 3.0,
  },
  {
    id: 7,
    x: 0.314,
    phase: 0.4283,
    speed: 0.09,
    size: 3.32,
    opacity: 0.36,
    twinkle: 4.1,
    drift: -0.8,
    shockPhase: 3.29,
    warmth: 0.68,
    stretch: 1.5,
  },
  {
    id: 8,
    x: 0.351,
    phase: 0.4895,
    speed: 0.119,
    size: 1.92,
    opacity: 0.22,
    twinkle: 6.4,
    drift: -1.8,
    shockPhase: 3.76,
    warmth: 0.2,
    stretch: 2.8,
  },
  {
    id: 9,
    x: 0.388,
    phase: 0.5507,
    speed: 0.064,
    size: 3.62,
    opacity: 0.65,
    twinkle: 3.8,
    drift: 1.3,
    shockPhase: 4.23,
    warmth: 0.73,
    stretch: 1.3,
  },
  {
    id: 10,
    x: 0.425,
    phase: 0.6118,
    speed: 0.093,
    size: 2.22,
    opacity: 0.51,
    twinkle: 6.1,
    drift: 0.3,
    shockPhase: 4.7,
    warmth: 0.25,
    stretch: 2.6,
  },
  {
    id: 11,
    x: 0.462,
    phase: 0.673,
    speed: 0.122,
    size: 0.82,
    opacity: 0.37,
    twinkle: 3.5,
    drift: -0.7,
    shockPhase: 5.17,
    warmth: 0.78,
    stretch: 1.1,
  },
  {
    id: 12,
    x: 0.499,
    phase: 0.7342,
    speed: 0.067,
    size: 2.52,
    opacity: 0.23,
    twinkle: 5.8,
    drift: -1.7,
    shockPhase: 5.64,
    warmth: 0.3,
    stretch: 2.4,
  },
  {
    id: 13,
    x: 0.536,
    phase: 0.7954,
    speed: 0.096,
    size: 1.12,
    opacity: 0.66,
    twinkle: 3.2,
    drift: 1.4,
    shockPhase: 6.11,
    warmth: 0.83,
    stretch: 0.9,
  },
  {
    id: 14,
    x: 0.573,
    phase: 0.8566,
    speed: 0.125,
    size: 2.82,
    opacity: 0.52,
    twinkle: 5.5,
    drift: 0.4,
    shockPhase: 0.3,
    warmth: 0.35,
    stretch: 2.2,
  },
  {
    id: 15,
    x: 0.61,
    phase: 0.9178,
    speed: 0.07,
    size: 1.42,
    opacity: 0.38,
    twinkle: 2.9,
    drift: -0.6,
    shockPhase: 0.77,
    warmth: 0.88,
    stretch: 3.5,
  },
  {
    id: 16,
    x: 0.647,
    phase: 0.9789,
    speed: 0.099,
    size: 3.12,
    opacity: 0.24,
    twinkle: 5.2,
    drift: -1.6,
    shockPhase: 1.24,
    warmth: 0.4,
    stretch: 2.0,
  },
  {
    id: 17,
    x: 0.684,
    phase: 0.0401,
    speed: 0.128,
    size: 1.72,
    opacity: 0.67,
    twinkle: 7.5,
    drift: 1.5,
    shockPhase: 1.71,
    warmth: 0.93,
    stretch: 3.3,
  },
  {
    id: 18,
    x: 0.721,
    phase: 0.1013,
    speed: 0.073,
    size: 3.42,
    opacity: 0.53,
    twinkle: 4.9,
    drift: 0.5,
    shockPhase: 2.18,
    warmth: 0.45,
    stretch: 1.8,
  },
  {
    id: 19,
    x: 0.758,
    phase: 0.1625,
    speed: 0.102,
    size: 2.02,
    opacity: 0.39,
    twinkle: 7.2,
    drift: -0.5,
    shockPhase: 2.65,
    warmth: 0.98,
    stretch: 3.1,
  },
  {
    id: 20,
    x: 0.795,
    phase: 0.2237,
    speed: 0.131,
    size: 3.72,
    opacity: 0.25,
    twinkle: 4.6,
    drift: -1.5,
    shockPhase: 3.12,
    warmth: 0.5,
    stretch: 1.6,
  },
  {
    id: 21,
    x: 0.832,
    phase: 0.2849,
    speed: 0.076,
    size: 2.32,
    opacity: 0.68,
    twinkle: 6.9,
    drift: 1.6,
    shockPhase: 3.59,
    warmth: 0.02,
    stretch: 2.9,
  },
  {
    id: 22,
    x: 0.869,
    phase: 0.346,
    speed: 0.105,
    size: 0.92,
    opacity: 0.54,
    twinkle: 4.3,
    drift: 0.6,
    shockPhase: 4.06,
    warmth: 0.55,
    stretch: 1.4,
  },
  {
    id: 23,
    x: 0.906,
    phase: 0.4072,
    speed: 0.134,
    size: 2.62,
    opacity: 0.4,
    twinkle: 6.6,
    drift: -0.4,
    shockPhase: 4.53,
    warmth: 0.07,
    stretch: 2.7,
  },
  {
    id: 24,
    x: 0.943,
    phase: 0.4684,
    speed: 0.079,
    size: 1.22,
    opacity: 0.26,
    twinkle: 4.0,
    drift: -1.4,
    shockPhase: 5.0,
    warmth: 0.6,
    stretch: 1.2,
  },
  {
    id: 25,
    x: 0.089,
    phase: 0.5296,
    speed: 0.108,
    size: 2.92,
    opacity: 0.69,
    twinkle: 6.3,
    drift: 1.7,
    shockPhase: 5.47,
    warmth: 0.12,
    stretch: 2.5,
  },
  {
    id: 26,
    x: 0.126,
    phase: 0.5908,
    speed: 0.137,
    size: 1.52,
    opacity: 0.55,
    twinkle: 3.7,
    drift: 0.7,
    shockPhase: 5.94,
    warmth: 0.65,
    stretch: 1.0,
  },
  {
    id: 27,
    x: 0.163,
    phase: 0.652,
    speed: 0.082,
    size: 3.22,
    opacity: 0.41,
    twinkle: 6.0,
    drift: -0.3,
    shockPhase: 0.13,
    warmth: 0.17,
    stretch: 2.3,
  },
  {
    id: 28,
    x: 0.2,
    phase: 0.7131,
    speed: 0.111,
    size: 1.82,
    opacity: 0.27,
    twinkle: 3.4,
    drift: -1.3,
    shockPhase: 0.6,
    warmth: 0.7,
    stretch: 0.8,
  },
  {
    id: 29,
    x: 0.237,
    phase: 0.7743,
    speed: 0.056,
    size: 3.52,
    opacity: 0.7,
    twinkle: 5.7,
    drift: 1.8,
    shockPhase: 1.07,
    warmth: 0.22,
    stretch: 2.1,
  },
  {
    id: 30,
    x: 0.274,
    phase: 0.8355,
    speed: 0.085,
    size: 2.12,
    opacity: 0.56,
    twinkle: 3.1,
    drift: 0.8,
    shockPhase: 1.54,
    warmth: 0.75,
    stretch: 3.4,
  },
  {
    id: 31,
    x: 0.311,
    phase: 0.8967,
    speed: 0.114,
    size: 0.72,
    opacity: 0.42,
    twinkle: 5.4,
    drift: -0.2,
    shockPhase: 2.01,
    warmth: 0.27,
    stretch: 1.9,
  },
  {
    id: 32,
    x: 0.348,
    phase: 0.9579,
    speed: 0.059,
    size: 2.42,
    opacity: 0.28,
    twinkle: 2.8,
    drift: -1.2,
    shockPhase: 2.48,
    warmth: 0.8,
    stretch: 3.2,
  },
  {
    id: 33,
    x: 0.385,
    phase: 0.0191,
    speed: 0.088,
    size: 1.02,
    opacity: 0.71,
    twinkle: 5.1,
    drift: 1.9,
    shockPhase: 2.95,
    warmth: 0.32,
    stretch: 1.7,
  },
  {
    id: 34,
    x: 0.422,
    phase: 0.0802,
    speed: 0.117,
    size: 2.72,
    opacity: 0.57,
    twinkle: 7.4,
    drift: 0.9,
    shockPhase: 3.42,
    warmth: 0.85,
    stretch: 3.0,
  },
  {
    id: 35,
    x: 0.459,
    phase: 0.1414,
    speed: 0.062,
    size: 1.32,
    opacity: 0.43,
    twinkle: 4.8,
    drift: -0.1,
    shockPhase: 3.89,
    warmth: 0.37,
    stretch: 1.5,
  },
  {
    id: 36,
    x: 0.496,
    phase: 0.2026,
    speed: 0.091,
    size: 3.02,
    opacity: 0.29,
    twinkle: 7.1,
    drift: -1.1,
    shockPhase: 4.36,
    warmth: 0.9,
    stretch: 2.8,
  },
  {
    id: 37,
    x: 0.533,
    phase: 0.2638,
    speed: 0.12,
    size: 1.62,
    opacity: 0.72,
    twinkle: 4.5,
    drift: 2.0,
    shockPhase: 4.83,
    warmth: 0.42,
    stretch: 1.3,
  },
  {
    id: 38,
    x: 0.57,
    phase: 0.325,
    speed: 0.065,
    size: 3.32,
    opacity: 0.58,
    twinkle: 6.8,
    drift: 1.0,
    shockPhase: 5.3,
    warmth: 0.95,
    stretch: 2.6,
  },
  {
    id: 39,
    x: 0.607,
    phase: 0.3862,
    speed: 0.094,
    size: 1.92,
    opacity: 0.44,
    twinkle: 4.2,
    drift: 0.0,
    shockPhase: 5.77,
    warmth: 0.47,
    stretch: 1.1,
  },
  {
    id: 40,
    x: 0.644,
    phase: 0.4473,
    speed: 0.123,
    size: 3.62,
    opacity: 0.3,
    twinkle: 6.5,
    drift: -1.0,
    shockPhase: 6.24,
    warmth: 1.0,
    stretch: 2.4,
  },
  {
    id: 41,
    x: 0.681,
    phase: 0.5085,
    speed: 0.068,
    size: 2.22,
    opacity: 0.73,
    twinkle: 3.9,
    drift: -2.0,
    shockPhase: 0.43,
    warmth: 0.52,
    stretch: 0.9,
  },
  {
    id: 42,
    x: 0.718,
    phase: 0.5697,
    speed: 0.097,
    size: 0.82,
    opacity: 0.59,
    twinkle: 6.2,
    drift: 1.1,
    shockPhase: 0.9,
    warmth: 0.04,
    stretch: 2.2,
  },
  {
    id: 43,
    x: 0.755,
    phase: 0.6309,
    speed: 0.126,
    size: 2.52,
    opacity: 0.45,
    twinkle: 3.6,
    drift: 0.1,
    shockPhase: 1.37,
    warmth: 0.57,
    stretch: 3.5,
  },
  {
    id: 44,
    x: 0.792,
    phase: 0.6921,
    speed: 0.071,
    size: 1.12,
    opacity: 0.31,
    twinkle: 5.9,
    drift: -0.9,
    shockPhase: 1.84,
    warmth: 0.09,
    stretch: 2.0,
  },
  {
    id: 45,
    x: 0.829,
    phase: 0.7533,
    speed: 0.1,
    size: 2.82,
    opacity: 0.74,
    twinkle: 3.3,
    drift: -1.9,
    shockPhase: 2.31,
    warmth: 0.62,
    stretch: 3.3,
  },
  {
    id: 46,
    x: 0.866,
    phase: 0.8144,
    speed: 0.129,
    size: 1.42,
    opacity: 0.6,
    twinkle: 5.6,
    drift: 1.2,
    shockPhase: 2.78,
    warmth: 0.14,
    stretch: 1.8,
  },
  {
    id: 47,
    x: 0.903,
    phase: 0.8756,
    speed: 0.074,
    size: 3.12,
    opacity: 0.46,
    twinkle: 3.0,
    drift: 0.2,
    shockPhase: 3.25,
    warmth: 0.67,
    stretch: 3.1,
  },
  {
    id: 48,
    x: 0.94,
    phase: 0.9368,
    speed: 0.103,
    size: 1.72,
    opacity: 0.32,
    twinkle: 5.3,
    drift: -0.8,
    shockPhase: 3.72,
    warmth: 0.19,
    stretch: 1.6,
  },
  {
    id: 49,
    x: 0.086,
    phase: 0.998,
    speed: 0.132,
    size: 3.42,
    opacity: 0.75,
    twinkle: 2.7,
    drift: -1.8,
    shockPhase: 4.19,
    warmth: 0.72,
    stretch: 2.9,
  },
  {
    id: 50,
    x: 0.123,
    phase: 0.0592,
    speed: 0.077,
    size: 2.02,
    opacity: 0.61,
    twinkle: 5.0,
    drift: 1.3,
    shockPhase: 4.66,
    warmth: 0.24,
    stretch: 1.4,
  },
  {
    id: 51,
    x: 0.16,
    phase: 0.1204,
    speed: 0.106,
    size: 3.72,
    opacity: 0.47,
    twinkle: 7.3,
    drift: 0.3,
    shockPhase: 5.13,
    warmth: 0.77,
    stretch: 2.7,
  },
  {
    id: 52,
    x: 0.197,
    phase: 0.1815,
    speed: 0.135,
    size: 2.32,
    opacity: 0.33,
    twinkle: 4.7,
    drift: -0.7,
    shockPhase: 5.6,
    warmth: 0.29,
    stretch: 1.2,
  },
  {
    id: 53,
    x: 0.234,
    phase: 0.2427,
    speed: 0.08,
    size: 0.92,
    opacity: 0.76,
    twinkle: 7.0,
    drift: -1.7,
    shockPhase: 6.07,
    warmth: 0.82,
    stretch: 2.5,
  },
  {
    id: 54,
    x: 0.271,
    phase: 0.3039,
    speed: 0.109,
    size: 2.62,
    opacity: 0.62,
    twinkle: 4.4,
    drift: 1.4,
    shockPhase: 0.26,
    warmth: 0.34,
    stretch: 1.0,
  },
  {
    id: 55,
    x: 0.308,
    phase: 0.3651,
    speed: 0.138,
    size: 1.22,
    opacity: 0.48,
    twinkle: 6.7,
    drift: 0.4,
    shockPhase: 0.73,
    warmth: 0.87,
    stretch: 2.3,
  },
  {
    id: 56,
    x: 0.345,
    phase: 0.4263,
    speed: 0.083,
    size: 2.92,
    opacity: 0.34,
    twinkle: 4.1,
    drift: -0.6,
    shockPhase: 1.2,
    warmth: 0.39,
    stretch: 0.8,
  },
  {
    id: 57,
    x: 0.382,
    phase: 0.4875,
    speed: 0.112,
    size: 1.52,
    opacity: 0.2,
    twinkle: 6.4,
    drift: -1.6,
    shockPhase: 1.67,
    warmth: 0.92,
    stretch: 2.1,
  },
  {
    id: 58,
    x: 0.419,
    phase: 0.5486,
    speed: 0.057,
    size: 3.22,
    opacity: 0.63,
    twinkle: 3.8,
    drift: 1.5,
    shockPhase: 2.14,
    warmth: 0.44,
    stretch: 3.4,
  },
  {
    id: 59,
    x: 0.456,
    phase: 0.6098,
    speed: 0.086,
    size: 1.82,
    opacity: 0.49,
    twinkle: 6.1,
    drift: 0.5,
    shockPhase: 2.61,
    warmth: 0.97,
    stretch: 1.9,
  },
  {
    id: 60,
    x: 0.493,
    phase: 0.671,
    speed: 0.115,
    size: 3.52,
    opacity: 0.35,
    twinkle: 3.5,
    drift: -0.5,
    shockPhase: 3.08,
    warmth: 0.49,
    stretch: 3.2,
  },
  {
    id: 61,
    x: 0.53,
    phase: 0.7322,
    speed: 0.06,
    size: 2.12,
    opacity: 0.21,
    twinkle: 5.8,
    drift: -1.5,
    shockPhase: 3.55,
    warmth: 0.01,
    stretch: 1.7,
  },
  {
    id: 62,
    x: 0.567,
    phase: 0.7934,
    speed: 0.089,
    size: 0.72,
    opacity: 0.64,
    twinkle: 3.2,
    drift: 1.6,
    shockPhase: 4.02,
    warmth: 0.54,
    stretch: 3.0,
  },
  {
    id: 63,
    x: 0.604,
    phase: 0.8546,
    speed: 0.118,
    size: 2.42,
    opacity: 0.5,
    twinkle: 5.5,
    drift: 0.6,
    shockPhase: 4.49,
    warmth: 0.06,
    stretch: 1.5,
  },
  {
    id: 64,
    x: 0.641,
    phase: 0.9157,
    speed: 0.063,
    size: 1.02,
    opacity: 0.36,
    twinkle: 2.9,
    drift: -0.4,
    shockPhase: 4.96,
    warmth: 0.59,
    stretch: 2.8,
  },
  {
    id: 65,
    x: 0.678,
    phase: 0.9769,
    speed: 0.092,
    size: 2.72,
    opacity: 0.22,
    twinkle: 5.2,
    drift: -1.4,
    shockPhase: 5.43,
    warmth: 0.11,
    stretch: 1.3,
  },
  {
    id: 66,
    x: 0.715,
    phase: 0.0381,
    speed: 0.121,
    size: 1.32,
    opacity: 0.65,
    twinkle: 7.5,
    drift: 1.7,
    shockPhase: 5.9,
    warmth: 0.64,
    stretch: 2.6,
  },
  {
    id: 67,
    x: 0.752,
    phase: 0.0993,
    speed: 0.066,
    size: 3.02,
    opacity: 0.51,
    twinkle: 4.9,
    drift: 0.7,
    shockPhase: 0.09,
    warmth: 0.16,
    stretch: 1.1,
  },
  {
    id: 68,
    x: 0.789,
    phase: 0.1605,
    speed: 0.095,
    size: 1.62,
    opacity: 0.37,
    twinkle: 7.2,
    drift: -0.3,
    shockPhase: 0.56,
    warmth: 0.69,
    stretch: 2.4,
  },
  {
    id: 69,
    x: 0.826,
    phase: 0.2217,
    speed: 0.124,
    size: 3.32,
    opacity: 0.23,
    twinkle: 4.6,
    drift: -1.3,
    shockPhase: 1.03,
    warmth: 0.21,
    stretch: 0.9,
  },
  {
    id: 70,
    x: 0.863,
    phase: 0.2828,
    speed: 0.069,
    size: 1.92,
    opacity: 0.66,
    twinkle: 6.9,
    drift: 1.8,
    shockPhase: 1.5,
    warmth: 0.74,
    stretch: 2.2,
  },
  {
    id: 71,
    x: 0.9,
    phase: 0.344,
    speed: 0.098,
    size: 3.62,
    opacity: 0.52,
    twinkle: 4.3,
    drift: 0.8,
    shockPhase: 1.97,
    warmth: 0.26,
    stretch: 3.5,
  },
  {
    id: 72,
    x: 0.937,
    phase: 0.4052,
    speed: 0.127,
    size: 2.22,
    opacity: 0.38,
    twinkle: 6.6,
    drift: -0.2,
    shockPhase: 2.44,
    warmth: 0.79,
    stretch: 2.0,
  },
  {
    id: 73,
    x: 0.083,
    phase: 0.4664,
    speed: 0.072,
    size: 0.82,
    opacity: 0.24,
    twinkle: 4.0,
    drift: -1.2,
    shockPhase: 2.91,
    warmth: 0.31,
    stretch: 3.3,
  },
  {
    id: 74,
    x: 0.12,
    phase: 0.5276,
    speed: 0.101,
    size: 2.52,
    opacity: 0.67,
    twinkle: 6.3,
    drift: 1.9,
    shockPhase: 3.38,
    warmth: 0.84,
    stretch: 1.8,
  },
  {
    id: 75,
    x: 0.157,
    phase: 0.5888,
    speed: 0.13,
    size: 1.12,
    opacity: 0.53,
    twinkle: 3.7,
    drift: 0.9,
    shockPhase: 3.85,
    warmth: 0.36,
    stretch: 3.1,
  },
  {
    id: 76,
    x: 0.194,
    phase: 0.6499,
    speed: 0.075,
    size: 2.82,
    opacity: 0.39,
    twinkle: 6.0,
    drift: -0.1,
    shockPhase: 4.32,
    warmth: 0.89,
    stretch: 1.6,
  },
  {
    id: 77,
    x: 0.231,
    phase: 0.7111,
    speed: 0.104,
    size: 1.42,
    opacity: 0.25,
    twinkle: 3.4,
    drift: -1.1,
    shockPhase: 4.79,
    warmth: 0.41,
    stretch: 2.9,
  },
  {
    id: 78,
    x: 0.268,
    phase: 0.7723,
    speed: 0.133,
    size: 3.12,
    opacity: 0.68,
    twinkle: 5.7,
    drift: 2.0,
    shockPhase: 5.26,
    warmth: 0.94,
    stretch: 1.4,
  },
  {
    id: 79,
    x: 0.305,
    phase: 0.8335,
    speed: 0.078,
    size: 1.72,
    opacity: 0.54,
    twinkle: 3.1,
    drift: 1.0,
    shockPhase: 5.73,
    warmth: 0.46,
    stretch: 2.7,
  },
  {
    id: 80,
    x: 0.342,
    phase: 0.8947,
    speed: 0.107,
    size: 3.42,
    opacity: 0.4,
    twinkle: 5.4,
    drift: 0.0,
    shockPhase: 6.2,
    warmth: 0.99,
    stretch: 1.2,
  },
  {
    id: 81,
    x: 0.379,
    phase: 0.9559,
    speed: 0.136,
    size: 2.02,
    opacity: 0.26,
    twinkle: 2.8,
    drift: -1.0,
    shockPhase: 0.39,
    warmth: 0.51,
    stretch: 2.5,
  },
  {
    id: 82,
    x: 0.416,
    phase: 0.0171,
    speed: 0.081,
    size: 3.72,
    opacity: 0.69,
    twinkle: 5.1,
    drift: -2.0,
    shockPhase: 0.86,
    warmth: 0.03,
    stretch: 1.0,
  },
  {
    id: 83,
    x: 0.453,
    phase: 0.0782,
    speed: 0.11,
    size: 2.32,
    opacity: 0.55,
    twinkle: 7.4,
    drift: 1.1,
    shockPhase: 1.33,
    warmth: 0.56,
    stretch: 2.3,
  },
  {
    id: 84,
    x: 0.49,
    phase: 0.1394,
    speed: 0.055,
    size: 0.92,
    opacity: 0.41,
    twinkle: 4.8,
    drift: 0.1,
    shockPhase: 1.8,
    warmth: 0.08,
    stretch: 0.8,
  },
  {
    id: 85,
    x: 0.527,
    phase: 0.2006,
    speed: 0.084,
    size: 2.62,
    opacity: 0.27,
    twinkle: 7.1,
    drift: -0.9,
    shockPhase: 2.27,
    warmth: 0.61,
    stretch: 2.1,
  },
  {
    id: 86,
    x: 0.564,
    phase: 0.2618,
    speed: 0.113,
    size: 1.22,
    opacity: 0.7,
    twinkle: 4.5,
    drift: -1.9,
    shockPhase: 2.74,
    warmth: 0.13,
    stretch: 3.4,
  },
  {
    id: 87,
    x: 0.601,
    phase: 0.323,
    speed: 0.058,
    size: 2.92,
    opacity: 0.56,
    twinkle: 6.8,
    drift: 1.2,
    shockPhase: 3.21,
    warmth: 0.66,
    stretch: 1.9,
  },
  {
    id: 88,
    x: 0.638,
    phase: 0.3842,
    speed: 0.087,
    size: 1.52,
    opacity: 0.42,
    twinkle: 4.2,
    drift: 0.2,
    shockPhase: 3.68,
    warmth: 0.18,
    stretch: 3.2,
  },
  {
    id: 89,
    x: 0.675,
    phase: 0.4453,
    speed: 0.116,
    size: 3.22,
    opacity: 0.28,
    twinkle: 6.5,
    drift: -0.8,
    shockPhase: 4.15,
    warmth: 0.71,
    stretch: 1.7,
  },
  {
    id: 90,
    x: 0.712,
    phase: 0.5065,
    speed: 0.061,
    size: 1.82,
    opacity: 0.71,
    twinkle: 3.9,
    drift: -1.8,
    shockPhase: 4.62,
    warmth: 0.23,
    stretch: 3.0,
  },
  {
    id: 91,
    x: 0.749,
    phase: 0.5677,
    speed: 0.09,
    size: 3.52,
    opacity: 0.57,
    twinkle: 6.2,
    drift: 1.3,
    shockPhase: 5.09,
    warmth: 0.76,
    stretch: 1.5,
  },
  {
    id: 92,
    x: 0.786,
    phase: 0.6289,
    speed: 0.119,
    size: 2.12,
    opacity: 0.43,
    twinkle: 3.6,
    drift: 0.3,
    shockPhase: 5.56,
    warmth: 0.28,
    stretch: 2.8,
  },
  {
    id: 93,
    x: 0.823,
    phase: 0.6901,
    speed: 0.064,
    size: 0.72,
    opacity: 0.29,
    twinkle: 5.9,
    drift: -0.7,
    shockPhase: 6.03,
    warmth: 0.81,
    stretch: 1.3,
  },
  {
    id: 94,
    x: 0.86,
    phase: 0.7513,
    speed: 0.093,
    size: 2.42,
    opacity: 0.72,
    twinkle: 3.3,
    drift: -1.7,
    shockPhase: 0.22,
    warmth: 0.33,
    stretch: 2.6,
  },
  {
    id: 95,
    x: 0.897,
    phase: 0.8124,
    speed: 0.122,
    size: 1.02,
    opacity: 0.58,
    twinkle: 5.6,
    drift: 1.4,
    shockPhase: 0.69,
    warmth: 0.86,
    stretch: 1.1,
  },
  {
    id: 96,
    x: 0.934,
    phase: 0.8736,
    speed: 0.067,
    size: 2.72,
    opacity: 0.44,
    twinkle: 3.0,
    drift: 0.4,
    shockPhase: 1.16,
    warmth: 0.38,
    stretch: 2.4,
  },
  {
    id: 97,
    x: 0.08,
    phase: 0.9348,
    speed: 0.096,
    size: 1.32,
    opacity: 0.3,
    twinkle: 5.3,
    drift: -0.6,
    shockPhase: 1.63,
    warmth: 0.91,
    stretch: 0.9,
  },
  {
    id: 98,
    x: 0.117,
    phase: 0.996,
    speed: 0.125,
    size: 3.02,
    opacity: 0.73,
    twinkle: 2.7,
    drift: -1.6,
    shockPhase: 2.1,
    warmth: 0.43,
    stretch: 2.2,
  },
  {
    id: 99,
    x: 0.154,
    phase: 0.0572,
    speed: 0.07,
    size: 1.62,
    opacity: 0.59,
    twinkle: 5.0,
    drift: 1.5,
    shockPhase: 2.57,
    warmth: 0.96,
    stretch: 3.5,
  },
  {
    id: 100,
    x: 0.191,
    phase: 0.1184,
    speed: 0.099,
    size: 3.32,
    opacity: 0.45,
    twinkle: 7.3,
    drift: 0.5,
    shockPhase: 3.04,
    warmth: 0.48,
    stretch: 2.0,
  },
  {
    id: 101,
    x: 0.228,
    phase: 0.1795,
    speed: 0.128,
    size: 1.92,
    opacity: 0.31,
    twinkle: 4.7,
    drift: -0.5,
    shockPhase: 3.51,
    warmth: 0.0,
    stretch: 3.3,
  },
  {
    id: 102,
    x: 0.265,
    phase: 0.2407,
    speed: 0.073,
    size: 3.62,
    opacity: 0.74,
    twinkle: 7.0,
    drift: -1.5,
    shockPhase: 3.98,
    warmth: 0.53,
    stretch: 1.8,
  },
  {
    id: 103,
    x: 0.302,
    phase: 0.3019,
    speed: 0.102,
    size: 2.22,
    opacity: 0.6,
    twinkle: 4.4,
    drift: 1.6,
    shockPhase: 4.45,
    warmth: 0.05,
    stretch: 3.1,
  },
  {
    id: 104,
    x: 0.339,
    phase: 0.3631,
    speed: 0.131,
    size: 0.82,
    opacity: 0.46,
    twinkle: 6.7,
    drift: 0.6,
    shockPhase: 4.92,
    warmth: 0.58,
    stretch: 1.6,
  },
  {
    id: 105,
    x: 0.376,
    phase: 0.4243,
    speed: 0.076,
    size: 2.52,
    opacity: 0.32,
    twinkle: 4.1,
    drift: -0.4,
    shockPhase: 5.39,
    warmth: 0.1,
    stretch: 2.9,
  },
  {
    id: 106,
    x: 0.413,
    phase: 0.4855,
    speed: 0.105,
    size: 1.12,
    opacity: 0.75,
    twinkle: 6.4,
    drift: -1.4,
    shockPhase: 5.86,
    warmth: 0.63,
    stretch: 1.4,
  },
  {
    id: 107,
    x: 0.45,
    phase: 0.5466,
    speed: 0.134,
    size: 2.82,
    opacity: 0.61,
    twinkle: 3.8,
    drift: 1.7,
    shockPhase: 0.05,
    warmth: 0.15,
    stretch: 2.7,
  },
  {
    id: 108,
    x: 0.487,
    phase: 0.6078,
    speed: 0.079,
    size: 1.42,
    opacity: 0.47,
    twinkle: 6.1,
    drift: 0.7,
    shockPhase: 0.52,
    warmth: 0.68,
    stretch: 1.2,
  },
  {
    id: 109,
    x: 0.524,
    phase: 0.669,
    speed: 0.108,
    size: 3.12,
    opacity: 0.33,
    twinkle: 3.5,
    drift: -0.3,
    shockPhase: 0.99,
    warmth: 0.2,
    stretch: 2.5,
  },
  {
    id: 110,
    x: 0.561,
    phase: 0.7302,
    speed: 0.137,
    size: 1.72,
    opacity: 0.76,
    twinkle: 5.8,
    drift: -1.3,
    shockPhase: 1.46,
    warmth: 0.73,
    stretch: 1.0,
  },
  {
    id: 111,
    x: 0.598,
    phase: 0.7914,
    speed: 0.082,
    size: 3.42,
    opacity: 0.62,
    twinkle: 3.2,
    drift: 1.8,
    shockPhase: 1.93,
    warmth: 0.25,
    stretch: 2.3,
  },
  {
    id: 112,
    x: 0.635,
    phase: 0.8526,
    speed: 0.111,
    size: 2.02,
    opacity: 0.48,
    twinkle: 5.5,
    drift: 0.8,
    shockPhase: 2.4,
    warmth: 0.78,
    stretch: 0.8,
  },
  {
    id: 113,
    x: 0.672,
    phase: 0.9137,
    speed: 0.056,
    size: 3.72,
    opacity: 0.34,
    twinkle: 2.9,
    drift: -0.2,
    shockPhase: 2.87,
    warmth: 0.3,
    stretch: 2.1,
  },
  {
    id: 114,
    x: 0.709,
    phase: 0.9749,
    speed: 0.085,
    size: 2.32,
    opacity: 0.2,
    twinkle: 5.2,
    drift: -1.2,
    shockPhase: 3.34,
    warmth: 0.83,
    stretch: 3.4,
  },
  {
    id: 115,
    x: 0.746,
    phase: 0.0361,
    speed: 0.114,
    size: 0.92,
    opacity: 0.63,
    twinkle: 7.5,
    drift: 1.9,
    shockPhase: 3.81,
    warmth: 0.35,
    stretch: 1.9,
  },
  {
    id: 116,
    x: 0.783,
    phase: 0.0973,
    speed: 0.059,
    size: 2.62,
    opacity: 0.49,
    twinkle: 4.9,
    drift: 0.9,
    shockPhase: 4.28,
    warmth: 0.88,
    stretch: 3.2,
  },
  {
    id: 117,
    x: 0.82,
    phase: 0.1585,
    speed: 0.088,
    size: 1.22,
    opacity: 0.35,
    twinkle: 7.2,
    drift: -0.1,
    shockPhase: 4.75,
    warmth: 0.4,
    stretch: 1.7,
  },
  {
    id: 118,
    x: 0.857,
    phase: 0.2197,
    speed: 0.117,
    size: 2.92,
    opacity: 0.21,
    twinkle: 4.6,
    drift: -1.1,
    shockPhase: 5.22,
    warmth: 0.93,
    stretch: 3.0,
  },
  {
    id: 119,
    x: 0.894,
    phase: 0.2808,
    speed: 0.062,
    size: 1.52,
    opacity: 0.64,
    twinkle: 6.9,
    drift: 2.0,
    shockPhase: 5.69,
    warmth: 0.45,
    stretch: 1.5,
  },
  {
    id: 120,
    x: 0.931,
    phase: 0.342,
    speed: 0.091,
    size: 3.22,
    opacity: 0.5,
    twinkle: 4.3,
    drift: 1.0,
    shockPhase: 6.16,
    warmth: 0.98,
    stretch: 2.8,
  },
  {
    id: 121,
    x: 0.077,
    phase: 0.4032,
    speed: 0.12,
    size: 1.82,
    opacity: 0.36,
    twinkle: 6.6,
    drift: 0.0,
    shockPhase: 0.35,
    warmth: 0.5,
    stretch: 1.3,
  },
  {
    id: 122,
    x: 0.114,
    phase: 0.4644,
    speed: 0.065,
    size: 3.52,
    opacity: 0.22,
    twinkle: 4.0,
    drift: -1.0,
    shockPhase: 0.82,
    warmth: 0.02,
    stretch: 2.6,
  },
  {
    id: 123,
    x: 0.151,
    phase: 0.5256,
    speed: 0.094,
    size: 2.12,
    opacity: 0.65,
    twinkle: 6.3,
    drift: -2.0,
    shockPhase: 1.29,
    warmth: 0.55,
    stretch: 1.1,
  },
  {
    id: 124,
    x: 0.188,
    phase: 0.5868,
    speed: 0.123,
    size: 0.72,
    opacity: 0.51,
    twinkle: 3.7,
    drift: 1.1,
    shockPhase: 1.76,
    warmth: 0.07,
    stretch: 2.4,
  },
  {
    id: 125,
    x: 0.225,
    phase: 0.6479,
    speed: 0.068,
    size: 2.42,
    opacity: 0.37,
    twinkle: 6.0,
    drift: 0.1,
    shockPhase: 2.23,
    warmth: 0.6,
    stretch: 0.9,
  },
  {
    id: 126,
    x: 0.262,
    phase: 0.7091,
    speed: 0.097,
    size: 1.02,
    opacity: 0.23,
    twinkle: 3.4,
    drift: -0.9,
    shockPhase: 2.7,
    warmth: 0.12,
    stretch: 2.2,
  },
  {
    id: 127,
    x: 0.299,
    phase: 0.7703,
    speed: 0.126,
    size: 2.72,
    opacity: 0.66,
    twinkle: 5.7,
    drift: -1.9,
    shockPhase: 3.17,
    warmth: 0.65,
    stretch: 3.5,
  },
  {
    id: 128,
    x: 0.336,
    phase: 0.8315,
    speed: 0.071,
    size: 1.32,
    opacity: 0.52,
    twinkle: 3.1,
    drift: 1.2,
    shockPhase: 3.64,
    warmth: 0.17,
    stretch: 2.0,
  },
  {
    id: 129,
    x: 0.373,
    phase: 0.8927,
    speed: 0.1,
    size: 3.02,
    opacity: 0.38,
    twinkle: 5.4,
    drift: 0.2,
    shockPhase: 4.11,
    warmth: 0.7,
    stretch: 3.3,
  },
  {
    id: 130,
    x: 0.41,
    phase: 0.9539,
    speed: 0.129,
    size: 1.62,
    opacity: 0.24,
    twinkle: 2.8,
    drift: -0.8,
    shockPhase: 4.58,
    warmth: 0.22,
    stretch: 1.8,
  },
  {
    id: 131,
    x: 0.447,
    phase: 0.015,
    speed: 0.074,
    size: 3.32,
    opacity: 0.67,
    twinkle: 5.1,
    drift: -1.8,
    shockPhase: 5.05,
    warmth: 0.75,
    stretch: 3.1,
  },
  {
    id: 132,
    x: 0.484,
    phase: 0.0762,
    speed: 0.103,
    size: 1.92,
    opacity: 0.53,
    twinkle: 7.4,
    drift: 1.3,
    shockPhase: 5.52,
    warmth: 0.27,
    stretch: 1.6,
  },
  {
    id: 133,
    x: 0.521,
    phase: 0.1374,
    speed: 0.132,
    size: 3.62,
    opacity: 0.39,
    twinkle: 4.8,
    drift: 0.3,
    shockPhase: 5.99,
    warmth: 0.8,
    stretch: 2.9,
  },
  {
    id: 134,
    x: 0.558,
    phase: 0.1986,
    speed: 0.077,
    size: 2.22,
    opacity: 0.25,
    twinkle: 7.1,
    drift: -0.7,
    shockPhase: 0.18,
    warmth: 0.32,
    stretch: 1.4,
  },
  {
    id: 135,
    x: 0.595,
    phase: 0.2598,
    speed: 0.106,
    size: 0.82,
    opacity: 0.68,
    twinkle: 4.5,
    drift: -1.7,
    shockPhase: 0.65,
    warmth: 0.85,
    stretch: 2.7,
  },
  {
    id: 136,
    x: 0.632,
    phase: 0.321,
    speed: 0.135,
    size: 2.52,
    opacity: 0.54,
    twinkle: 6.8,
    drift: 1.4,
    shockPhase: 1.12,
    warmth: 0.37,
    stretch: 1.2,
  },
  {
    id: 137,
    x: 0.669,
    phase: 0.3821,
    speed: 0.08,
    size: 1.12,
    opacity: 0.4,
    twinkle: 4.2,
    drift: 0.4,
    shockPhase: 1.59,
    warmth: 0.9,
    stretch: 2.5,
  },
  {
    id: 138,
    x: 0.706,
    phase: 0.4433,
    speed: 0.109,
    size: 2.82,
    opacity: 0.26,
    twinkle: 6.5,
    drift: -0.6,
    shockPhase: 2.06,
    warmth: 0.42,
    stretch: 1.0,
  },
  {
    id: 139,
    x: 0.743,
    phase: 0.5045,
    speed: 0.138,
    size: 1.42,
    opacity: 0.69,
    twinkle: 3.9,
    drift: -1.6,
    shockPhase: 2.53,
    warmth: 0.95,
    stretch: 2.3,
  },
  {
    id: 140,
    x: 0.78,
    phase: 0.5657,
    speed: 0.083,
    size: 3.12,
    opacity: 0.55,
    twinkle: 6.2,
    drift: 1.5,
    shockPhase: 3.0,
    warmth: 0.47,
    stretch: 0.8,
  },
  {
    id: 141,
    x: 0.817,
    phase: 0.6269,
    speed: 0.112,
    size: 1.72,
    opacity: 0.41,
    twinkle: 3.6,
    drift: 0.5,
    shockPhase: 3.47,
    warmth: 1.0,
    stretch: 2.1,
  },
  {
    id: 142,
    x: 0.854,
    phase: 0.6881,
    speed: 0.057,
    size: 3.42,
    opacity: 0.27,
    twinkle: 5.9,
    drift: -0.5,
    shockPhase: 3.94,
    warmth: 0.52,
    stretch: 3.4,
  },
  {
    id: 143,
    x: 0.891,
    phase: 0.7492,
    speed: 0.086,
    size: 2.02,
    opacity: 0.7,
    twinkle: 3.3,
    drift: -1.5,
    shockPhase: 4.41,
    warmth: 0.04,
    stretch: 1.9,
  },
  {
    id: 144,
    x: 0.928,
    phase: 0.8104,
    speed: 0.115,
    size: 3.72,
    opacity: 0.56,
    twinkle: 5.6,
    drift: 1.6,
    shockPhase: 4.88,
    warmth: 0.57,
    stretch: 3.2,
  },
  {
    id: 145,
    x: 0.074,
    phase: 0.8716,
    speed: 0.06,
    size: 2.32,
    opacity: 0.42,
    twinkle: 3.0,
    drift: 0.6,
    shockPhase: 5.35,
    warmth: 0.09,
    stretch: 1.7,
  },
  {
    id: 146,
    x: 0.111,
    phase: 0.9328,
    speed: 0.089,
    size: 0.92,
    opacity: 0.28,
    twinkle: 5.3,
    drift: -0.4,
    shockPhase: 5.82,
    warmth: 0.62,
    stretch: 3.0,
  },
  {
    id: 147,
    x: 0.148,
    phase: 0.994,
    speed: 0.118,
    size: 2.62,
    opacity: 0.71,
    twinkle: 2.7,
    drift: -1.4,
    shockPhase: 0.01,
    warmth: 0.14,
    stretch: 1.5,
  },
  {
    id: 148,
    x: 0.185,
    phase: 0.0552,
    speed: 0.063,
    size: 1.22,
    opacity: 0.57,
    twinkle: 5.0,
    drift: 1.7,
    shockPhase: 0.48,
    warmth: 0.67,
    stretch: 2.8,
  },
  {
    id: 149,
    x: 0.222,
    phase: 0.1163,
    speed: 0.092,
    size: 2.92,
    opacity: 0.43,
    twinkle: 7.3,
    drift: 0.7,
    shockPhase: 0.95,
    warmth: 0.19,
    stretch: 1.3,
  },
  {
    id: 150,
    x: 0.259,
    phase: 0.1775,
    speed: 0.121,
    size: 1.52,
    opacity: 0.29,
    twinkle: 4.7,
    drift: -0.3,
    shockPhase: 1.42,
    warmth: 0.72,
    stretch: 2.6,
  },
  {
    id: 151,
    x: 0.296,
    phase: 0.2387,
    speed: 0.066,
    size: 3.22,
    opacity: 0.72,
    twinkle: 7.0,
    drift: -1.3,
    shockPhase: 1.89,
    warmth: 0.24,
    stretch: 1.1,
  },
  {
    id: 152,
    x: 0.333,
    phase: 0.2999,
    speed: 0.095,
    size: 1.82,
    opacity: 0.58,
    twinkle: 4.4,
    drift: 1.8,
    shockPhase: 2.36,
    warmth: 0.77,
    stretch: 2.4,
  },
  {
    id: 153,
    x: 0.37,
    phase: 0.3611,
    speed: 0.124,
    size: 3.52,
    opacity: 0.44,
    twinkle: 6.7,
    drift: 0.8,
    shockPhase: 2.83,
    warmth: 0.29,
    stretch: 0.9,
  },
  {
    id: 154,
    x: 0.407,
    phase: 0.4223,
    speed: 0.069,
    size: 2.12,
    opacity: 0.3,
    twinkle: 4.1,
    drift: -0.2,
    shockPhase: 3.3,
    warmth: 0.82,
    stretch: 2.2,
  },
  {
    id: 155,
    x: 0.444,
    phase: 0.4835,
    speed: 0.098,
    size: 0.72,
    opacity: 0.73,
    twinkle: 6.4,
    drift: -1.2,
    shockPhase: 3.77,
    warmth: 0.34,
    stretch: 3.5,
  },
  {
    id: 156,
    x: 0.481,
    phase: 0.5446,
    speed: 0.127,
    size: 2.42,
    opacity: 0.59,
    twinkle: 3.8,
    drift: 1.9,
    shockPhase: 4.24,
    warmth: 0.87,
    stretch: 2.0,
  },
  {
    id: 157,
    x: 0.518,
    phase: 0.6058,
    speed: 0.072,
    size: 1.02,
    opacity: 0.45,
    twinkle: 6.1,
    drift: 0.9,
    shockPhase: 4.71,
    warmth: 0.39,
    stretch: 3.3,
  },
  {
    id: 158,
    x: 0.555,
    phase: 0.667,
    speed: 0.101,
    size: 2.72,
    opacity: 0.31,
    twinkle: 3.5,
    drift: -0.1,
    shockPhase: 5.18,
    warmth: 0.92,
    stretch: 1.8,
  },
  {
    id: 159,
    x: 0.592,
    phase: 0.7282,
    speed: 0.13,
    size: 1.32,
    opacity: 0.74,
    twinkle: 5.8,
    drift: -1.1,
    shockPhase: 5.65,
    warmth: 0.44,
    stretch: 3.1,
  },
  {
    id: 160,
    x: 0.629,
    phase: 0.7894,
    speed: 0.075,
    size: 3.02,
    opacity: 0.6,
    twinkle: 3.2,
    drift: 2.0,
    shockPhase: 6.12,
    warmth: 0.97,
    stretch: 1.6,
  },
  {
    id: 161,
    x: 0.666,
    phase: 0.8506,
    speed: 0.104,
    size: 1.62,
    opacity: 0.46,
    twinkle: 5.5,
    drift: 1.0,
    shockPhase: 0.31,
    warmth: 0.49,
    stretch: 2.9,
  },
  {
    id: 162,
    x: 0.703,
    phase: 0.9117,
    speed: 0.133,
    size: 3.32,
    opacity: 0.32,
    twinkle: 2.9,
    drift: 0.0,
    shockPhase: 0.78,
    warmth: 0.01,
    stretch: 1.4,
  },
  {
    id: 163,
    x: 0.74,
    phase: 0.9729,
    speed: 0.078,
    size: 1.92,
    opacity: 0.75,
    twinkle: 5.2,
    drift: -1.0,
    shockPhase: 1.25,
    warmth: 0.54,
    stretch: 2.7,
  },
  {
    id: 164,
    x: 0.777,
    phase: 0.0341,
    speed: 0.107,
    size: 3.62,
    opacity: 0.61,
    twinkle: 7.5,
    drift: -2.0,
    shockPhase: 1.72,
    warmth: 0.06,
    stretch: 1.2,
  },
  {
    id: 165,
    x: 0.814,
    phase: 0.0953,
    speed: 0.136,
    size: 2.22,
    opacity: 0.47,
    twinkle: 4.9,
    drift: 1.1,
    shockPhase: 2.19,
    warmth: 0.59,
    stretch: 2.5,
  },
  {
    id: 166,
    x: 0.851,
    phase: 0.1565,
    speed: 0.081,
    size: 0.82,
    opacity: 0.33,
    twinkle: 7.2,
    drift: 0.1,
    shockPhase: 2.66,
    warmth: 0.11,
    stretch: 1.0,
  },
  {
    id: 167,
    x: 0.888,
    phase: 0.2177,
    speed: 0.11,
    size: 2.52,
    opacity: 0.76,
    twinkle: 4.6,
    drift: -0.9,
    shockPhase: 3.13,
    warmth: 0.64,
    stretch: 2.3,
  },
  {
    id: 168,
    x: 0.925,
    phase: 0.2788,
    speed: 0.055,
    size: 1.12,
    opacity: 0.62,
    twinkle: 6.9,
    drift: -1.9,
    shockPhase: 3.6,
    warmth: 0.16,
    stretch: 0.8,
  },
  {
    id: 169,
    x: 0.071,
    phase: 0.34,
    speed: 0.084,
    size: 2.82,
    opacity: 0.48,
    twinkle: 4.3,
    drift: 1.2,
    shockPhase: 4.07,
    warmth: 0.69,
    stretch: 2.1,
  },
  {
    id: 170,
    x: 0.108,
    phase: 0.4012,
    speed: 0.113,
    size: 1.42,
    opacity: 0.34,
    twinkle: 6.6,
    drift: 0.2,
    shockPhase: 4.54,
    warmth: 0.21,
    stretch: 3.4,
  },
  {
    id: 171,
    x: 0.145,
    phase: 0.4624,
    speed: 0.058,
    size: 3.12,
    opacity: 0.2,
    twinkle: 4.0,
    drift: -0.8,
    shockPhase: 5.01,
    warmth: 0.74,
    stretch: 1.9,
  },
  {
    id: 172,
    x: 0.182,
    phase: 0.5236,
    speed: 0.087,
    size: 1.72,
    opacity: 0.63,
    twinkle: 6.3,
    drift: -1.8,
    shockPhase: 5.48,
    warmth: 0.26,
    stretch: 3.2,
  },
  {
    id: 173,
    x: 0.219,
    phase: 0.5848,
    speed: 0.116,
    size: 3.42,
    opacity: 0.49,
    twinkle: 3.7,
    drift: 1.3,
    shockPhase: 5.95,
    warmth: 0.79,
    stretch: 1.7,
  },
  {
    id: 174,
    x: 0.256,
    phase: 0.6459,
    speed: 0.061,
    size: 2.02,
    opacity: 0.35,
    twinkle: 6.0,
    drift: 0.3,
    shockPhase: 0.14,
    warmth: 0.31,
    stretch: 3.0,
  },
  {
    id: 175,
    x: 0.293,
    phase: 0.7071,
    speed: 0.09,
    size: 3.72,
    opacity: 0.21,
    twinkle: 3.4,
    drift: -0.7,
    shockPhase: 0.61,
    warmth: 0.84,
    stretch: 1.5,
  },
  {
    id: 176,
    x: 0.33,
    phase: 0.7683,
    speed: 0.119,
    size: 2.32,
    opacity: 0.64,
    twinkle: 5.7,
    drift: -1.7,
    shockPhase: 1.08,
    warmth: 0.36,
    stretch: 2.8,
  },
  {
    id: 177,
    x: 0.367,
    phase: 0.8295,
    speed: 0.064,
    size: 0.92,
    opacity: 0.5,
    twinkle: 3.1,
    drift: 1.4,
    shockPhase: 1.55,
    warmth: 0.89,
    stretch: 1.3,
  },
  {
    id: 178,
    x: 0.404,
    phase: 0.8907,
    speed: 0.093,
    size: 2.62,
    opacity: 0.36,
    twinkle: 5.4,
    drift: 0.4,
    shockPhase: 2.02,
    warmth: 0.41,
    stretch: 2.6,
  },
  {
    id: 179,
    x: 0.441,
    phase: 0.9519,
    speed: 0.122,
    size: 1.22,
    opacity: 0.22,
    twinkle: 2.8,
    drift: -0.6,
    shockPhase: 2.49,
    warmth: 0.94,
    stretch: 1.1,
  },
  {
    id: 180,
    x: 0.478,
    phase: 0.013,
    speed: 0.067,
    size: 2.92,
    opacity: 0.65,
    twinkle: 5.1,
    drift: -1.6,
    shockPhase: 2.96,
    warmth: 0.46,
    stretch: 2.4,
  },
  {
    id: 181,
    x: 0.515,
    phase: 0.0742,
    speed: 0.096,
    size: 1.52,
    opacity: 0.51,
    twinkle: 7.4,
    drift: 1.5,
    shockPhase: 3.43,
    warmth: 0.99,
    stretch: 0.9,
  },
  {
    id: 182,
    x: 0.552,
    phase: 0.1354,
    speed: 0.125,
    size: 3.22,
    opacity: 0.37,
    twinkle: 4.8,
    drift: 0.5,
    shockPhase: 3.9,
    warmth: 0.51,
    stretch: 2.2,
  },
  {
    id: 183,
    x: 0.589,
    phase: 0.1966,
    speed: 0.07,
    size: 1.82,
    opacity: 0.23,
    twinkle: 7.1,
    drift: -0.5,
    shockPhase: 4.37,
    warmth: 0.03,
    stretch: 3.5,
  },
  {
    id: 184,
    x: 0.626,
    phase: 0.2578,
    speed: 0.099,
    size: 3.52,
    opacity: 0.66,
    twinkle: 4.5,
    drift: -1.5,
    shockPhase: 4.84,
    warmth: 0.56,
    stretch: 2.0,
  },
  {
    id: 185,
    x: 0.663,
    phase: 0.319,
    speed: 0.128,
    size: 2.12,
    opacity: 0.52,
    twinkle: 6.8,
    drift: 1.6,
    shockPhase: 5.31,
    warmth: 0.08,
    stretch: 3.3,
  },
  {
    id: 186,
    x: 0.7,
    phase: 0.3801,
    speed: 0.073,
    size: 0.72,
    opacity: 0.38,
    twinkle: 4.2,
    drift: 0.6,
    shockPhase: 5.78,
    warmth: 0.61,
    stretch: 1.8,
  },
  {
    id: 187,
    x: 0.737,
    phase: 0.4413,
    speed: 0.102,
    size: 2.42,
    opacity: 0.24,
    twinkle: 6.5,
    drift: -0.4,
    shockPhase: 6.25,
    warmth: 0.13,
    stretch: 3.1,
  },
  {
    id: 188,
    x: 0.774,
    phase: 0.5025,
    speed: 0.131,
    size: 1.02,
    opacity: 0.67,
    twinkle: 3.9,
    drift: -1.4,
    shockPhase: 0.44,
    warmth: 0.66,
    stretch: 1.6,
  },
  {
    id: 189,
    x: 0.811,
    phase: 0.5637,
    speed: 0.076,
    size: 2.72,
    opacity: 0.53,
    twinkle: 6.2,
    drift: 1.7,
    shockPhase: 0.91,
    warmth: 0.18,
    stretch: 2.9,
  },
  {
    id: 190,
    x: 0.848,
    phase: 0.6249,
    speed: 0.105,
    size: 1.32,
    opacity: 0.39,
    twinkle: 3.6,
    drift: 0.7,
    shockPhase: 1.38,
    warmth: 0.71,
    stretch: 1.4,
  },
  {
    id: 191,
    x: 0.885,
    phase: 0.6861,
    speed: 0.134,
    size: 3.02,
    opacity: 0.25,
    twinkle: 5.9,
    drift: -0.3,
    shockPhase: 1.85,
    warmth: 0.23,
    stretch: 2.7,
  },
  {
    id: 192,
    x: 0.922,
    phase: 0.7472,
    speed: 0.079,
    size: 1.62,
    opacity: 0.68,
    twinkle: 3.3,
    drift: -1.3,
    shockPhase: 2.32,
    warmth: 0.76,
    stretch: 1.2,
  },
  {
    id: 193,
    x: 0.068,
    phase: 0.8084,
    speed: 0.108,
    size: 3.32,
    opacity: 0.54,
    twinkle: 5.6,
    drift: 1.8,
    shockPhase: 2.79,
    warmth: 0.28,
    stretch: 2.5,
  },
  {
    id: 194,
    x: 0.105,
    phase: 0.8696,
    speed: 0.137,
    size: 1.92,
    opacity: 0.4,
    twinkle: 3.0,
    drift: 0.8,
    shockPhase: 3.26,
    warmth: 0.81,
    stretch: 1.0,
  },
  {
    id: 195,
    x: 0.142,
    phase: 0.9308,
    speed: 0.082,
    size: 3.62,
    opacity: 0.26,
    twinkle: 5.3,
    drift: -0.2,
    shockPhase: 3.73,
    warmth: 0.33,
    stretch: 2.3,
  },
  {
    id: 196,
    x: 0.179,
    phase: 0.992,
    speed: 0.111,
    size: 2.22,
    opacity: 0.69,
    twinkle: 2.7,
    drift: -1.2,
    shockPhase: 4.2,
    warmth: 0.86,
    stretch: 0.8,
  },
  {
    id: 197,
    x: 0.216,
    phase: 0.0532,
    speed: 0.056,
    size: 0.82,
    opacity: 0.55,
    twinkle: 5.0,
    drift: 1.9,
    shockPhase: 4.67,
    warmth: 0.38,
    stretch: 2.1,
  },
  {
    id: 198,
    x: 0.253,
    phase: 0.1143,
    speed: 0.085,
    size: 2.52,
    opacity: 0.41,
    twinkle: 7.3,
    drift: 0.9,
    shockPhase: 5.14,
    warmth: 0.91,
    stretch: 3.4,
  },
  {
    id: 199,
    x: 0.29,
    phase: 0.1755,
    speed: 0.114,
    size: 1.12,
    opacity: 0.27,
    twinkle: 4.7,
    drift: -0.1,
    shockPhase: 5.61,
    warmth: 0.43,
    stretch: 1.9,
  },
  {
    id: 200,
    x: 0.327,
    phase: 0.2367,
    speed: 0.059,
    size: 2.82,
    opacity: 0.7,
    twinkle: 7.0,
    drift: -1.1,
    shockPhase: 6.08,
    warmth: 0.96,
    stretch: 3.2,
  },
  {
    id: 201,
    x: 0.364,
    phase: 0.2979,
    speed: 0.088,
    size: 1.42,
    opacity: 0.56,
    twinkle: 4.4,
    drift: 2.0,
    shockPhase: 0.27,
    warmth: 0.48,
    stretch: 1.7,
  },
  {
    id: 202,
    x: 0.401,
    phase: 0.3591,
    speed: 0.117,
    size: 3.12,
    opacity: 0.42,
    twinkle: 6.7,
    drift: 1.0,
    shockPhase: 0.74,
    warmth: 0.0,
    stretch: 3.0,
  },
  {
    id: 203,
    x: 0.438,
    phase: 0.4203,
    speed: 0.062,
    size: 1.72,
    opacity: 0.28,
    twinkle: 4.1,
    drift: 0.0,
    shockPhase: 1.21,
    warmth: 0.53,
    stretch: 1.5,
  },
  {
    id: 204,
    x: 0.475,
    phase: 0.4814,
    speed: 0.091,
    size: 3.42,
    opacity: 0.71,
    twinkle: 6.4,
    drift: -1.0,
    shockPhase: 1.68,
    warmth: 0.05,
    stretch: 2.8,
  },
  {
    id: 205,
    x: 0.512,
    phase: 0.5426,
    speed: 0.12,
    size: 2.02,
    opacity: 0.57,
    twinkle: 3.8,
    drift: -2.0,
    shockPhase: 2.15,
    warmth: 0.58,
    stretch: 1.3,
  },
  {
    id: 206,
    x: 0.549,
    phase: 0.6038,
    speed: 0.065,
    size: 3.72,
    opacity: 0.43,
    twinkle: 6.1,
    drift: 1.1,
    shockPhase: 2.62,
    warmth: 0.1,
    stretch: 2.6,
  },
  {
    id: 207,
    x: 0.586,
    phase: 0.665,
    speed: 0.094,
    size: 2.32,
    opacity: 0.29,
    twinkle: 3.5,
    drift: 0.1,
    shockPhase: 3.09,
    warmth: 0.63,
    stretch: 1.1,
  },
  {
    id: 208,
    x: 0.623,
    phase: 0.7262,
    speed: 0.123,
    size: 0.92,
    opacity: 0.72,
    twinkle: 5.8,
    drift: -0.9,
    shockPhase: 3.56,
    warmth: 0.15,
    stretch: 2.4,
  },
  {
    id: 209,
    x: 0.66,
    phase: 0.7874,
    speed: 0.068,
    size: 2.62,
    opacity: 0.58,
    twinkle: 3.2,
    drift: -1.9,
    shockPhase: 4.03,
    warmth: 0.68,
    stretch: 0.9,
  },
  {
    id: 210,
    x: 0.697,
    phase: 0.8485,
    speed: 0.097,
    size: 1.22,
    opacity: 0.44,
    twinkle: 5.5,
    drift: 1.2,
    shockPhase: 4.5,
    warmth: 0.2,
    stretch: 2.2,
  },
  {
    id: 211,
    x: 0.734,
    phase: 0.9097,
    speed: 0.126,
    size: 2.92,
    opacity: 0.3,
    twinkle: 2.9,
    drift: 0.2,
    shockPhase: 4.97,
    warmth: 0.73,
    stretch: 3.5,
  },
  {
    id: 212,
    x: 0.771,
    phase: 0.9709,
    speed: 0.071,
    size: 1.52,
    opacity: 0.73,
    twinkle: 5.2,
    drift: -0.8,
    shockPhase: 5.44,
    warmth: 0.25,
    stretch: 2.0,
  },
  {
    id: 213,
    x: 0.808,
    phase: 0.0321,
    speed: 0.1,
    size: 3.22,
    opacity: 0.59,
    twinkle: 7.5,
    drift: -1.8,
    shockPhase: 5.91,
    warmth: 0.78,
    stretch: 3.3,
  },
  {
    id: 214,
    x: 0.845,
    phase: 0.0933,
    speed: 0.129,
    size: 1.82,
    opacity: 0.45,
    twinkle: 4.9,
    drift: 1.3,
    shockPhase: 0.1,
    warmth: 0.3,
    stretch: 1.8,
  },
  {
    id: 215,
    x: 0.882,
    phase: 0.1545,
    speed: 0.074,
    size: 3.52,
    opacity: 0.31,
    twinkle: 7.2,
    drift: 0.3,
    shockPhase: 0.57,
    warmth: 0.83,
    stretch: 3.1,
  },
  {
    id: 216,
    x: 0.919,
    phase: 0.2156,
    speed: 0.103,
    size: 2.12,
    opacity: 0.74,
    twinkle: 4.6,
    drift: -0.7,
    shockPhase: 1.04,
    warmth: 0.35,
    stretch: 1.6,
  },
  {
    id: 217,
    x: 0.065,
    phase: 0.2768,
    speed: 0.132,
    size: 0.72,
    opacity: 0.6,
    twinkle: 6.9,
    drift: -1.7,
    shockPhase: 1.51,
    warmth: 0.88,
    stretch: 2.9,
  },
  {
    id: 218,
    x: 0.102,
    phase: 0.338,
    speed: 0.077,
    size: 2.42,
    opacity: 0.46,
    twinkle: 4.3,
    drift: 1.4,
    shockPhase: 1.98,
    warmth: 0.4,
    stretch: 1.4,
  },
  {
    id: 219,
    x: 0.139,
    phase: 0.3992,
    speed: 0.106,
    size: 1.02,
    opacity: 0.32,
    twinkle: 6.6,
    drift: 0.4,
    shockPhase: 2.45,
    warmth: 0.93,
    stretch: 2.7,
  },
  {
    id: 220,
    x: 0.176,
    phase: 0.4604,
    speed: 0.135,
    size: 2.72,
    opacity: 0.75,
    twinkle: 4.0,
    drift: -0.6,
    shockPhase: 2.92,
    warmth: 0.45,
    stretch: 1.2,
  },
  {
    id: 221,
    x: 0.213,
    phase: 0.5216,
    speed: 0.08,
    size: 1.32,
    opacity: 0.61,
    twinkle: 6.3,
    drift: -1.6,
    shockPhase: 3.39,
    warmth: 0.98,
    stretch: 2.5,
  },
  {
    id: 222,
    x: 0.25,
    phase: 0.5827,
    speed: 0.109,
    size: 3.02,
    opacity: 0.47,
    twinkle: 3.7,
    drift: 1.5,
    shockPhase: 3.86,
    warmth: 0.5,
    stretch: 1.0,
  },
  {
    id: 223,
    x: 0.287,
    phase: 0.6439,
    speed: 0.138,
    size: 1.62,
    opacity: 0.33,
    twinkle: 6.0,
    drift: 0.5,
    shockPhase: 4.33,
    warmth: 0.02,
    stretch: 2.3,
  },
  {
    id: 224,
    x: 0.324,
    phase: 0.7051,
    speed: 0.083,
    size: 3.32,
    opacity: 0.76,
    twinkle: 3.4,
    drift: -0.5,
    shockPhase: 4.8,
    warmth: 0.55,
    stretch: 0.8,
  },
  {
    id: 225,
    x: 0.361,
    phase: 0.7663,
    speed: 0.112,
    size: 1.92,
    opacity: 0.62,
    twinkle: 5.7,
    drift: -1.5,
    shockPhase: 5.27,
    warmth: 0.07,
    stretch: 2.1,
  },
  {
    id: 226,
    x: 0.398,
    phase: 0.8275,
    speed: 0.057,
    size: 3.62,
    opacity: 0.48,
    twinkle: 3.1,
    drift: 1.6,
    shockPhase: 5.74,
    warmth: 0.6,
    stretch: 3.4,
  },
  {
    id: 227,
    x: 0.435,
    phase: 0.8887,
    speed: 0.086,
    size: 2.22,
    opacity: 0.34,
    twinkle: 5.4,
    drift: 0.6,
    shockPhase: 6.21,
    warmth: 0.12,
    stretch: 1.9,
  },
  {
    id: 228,
    x: 0.472,
    phase: 0.9498,
    speed: 0.115,
    size: 0.82,
    opacity: 0.2,
    twinkle: 2.8,
    drift: -0.4,
    shockPhase: 0.4,
    warmth: 0.65,
    stretch: 3.2,
  },
  {
    id: 229,
    x: 0.509,
    phase: 0.011,
    speed: 0.06,
    size: 2.52,
    opacity: 0.63,
    twinkle: 5.1,
    drift: -1.4,
    shockPhase: 0.87,
    warmth: 0.17,
    stretch: 1.7,
  },
  {
    id: 230,
    x: 0.546,
    phase: 0.0722,
    speed: 0.089,
    size: 1.12,
    opacity: 0.49,
    twinkle: 7.4,
    drift: 1.7,
    shockPhase: 1.34,
    warmth: 0.7,
    stretch: 3.0,
  },
  {
    id: 231,
    x: 0.583,
    phase: 0.1334,
    speed: 0.118,
    size: 2.82,
    opacity: 0.35,
    twinkle: 4.8,
    drift: 0.7,
    shockPhase: 1.81,
    warmth: 0.22,
    stretch: 1.5,
  },
  {
    id: 232,
    x: 0.62,
    phase: 0.1946,
    speed: 0.063,
    size: 1.42,
    opacity: 0.21,
    twinkle: 7.1,
    drift: -0.3,
    shockPhase: 2.28,
    warmth: 0.75,
    stretch: 2.8,
  },
  {
    id: 233,
    x: 0.657,
    phase: 0.2558,
    speed: 0.092,
    size: 3.12,
    opacity: 0.64,
    twinkle: 4.5,
    drift: -1.3,
    shockPhase: 2.75,
    warmth: 0.27,
    stretch: 1.3,
  },
  {
    id: 234,
    x: 0.694,
    phase: 0.317,
    speed: 0.121,
    size: 1.72,
    opacity: 0.5,
    twinkle: 6.8,
    drift: 1.8,
    shockPhase: 3.22,
    warmth: 0.8,
    stretch: 2.6,
  },
  {
    id: 235,
    x: 0.731,
    phase: 0.3781,
    speed: 0.066,
    size: 3.42,
    opacity: 0.36,
    twinkle: 4.2,
    drift: 0.8,
    shockPhase: 3.69,
    warmth: 0.32,
    stretch: 1.1,
  },
  {
    id: 236,
    x: 0.768,
    phase: 0.4393,
    speed: 0.095,
    size: 2.02,
    opacity: 0.22,
    twinkle: 6.5,
    drift: -0.2,
    shockPhase: 4.16,
    warmth: 0.85,
    stretch: 2.4,
  },
  {
    id: 237,
    x: 0.805,
    phase: 0.5005,
    speed: 0.124,
    size: 3.72,
    opacity: 0.65,
    twinkle: 3.9,
    drift: -1.2,
    shockPhase: 4.63,
    warmth: 0.37,
    stretch: 0.9,
  },
  {
    id: 238,
    x: 0.842,
    phase: 0.5617,
    speed: 0.069,
    size: 2.32,
    opacity: 0.51,
    twinkle: 6.2,
    drift: 1.9,
    shockPhase: 5.1,
    warmth: 0.9,
    stretch: 2.2,
  },
  {
    id: 239,
    x: 0.879,
    phase: 0.6229,
    speed: 0.098,
    size: 0.92,
    opacity: 0.37,
    twinkle: 3.6,
    drift: 0.9,
    shockPhase: 5.57,
    warmth: 0.42,
    stretch: 3.5,
  },
  {
    id: 240,
    x: 0.916,
    phase: 0.6841,
    speed: 0.127,
    size: 2.62,
    opacity: 0.23,
    twinkle: 5.9,
    drift: -0.1,
    shockPhase: 6.04,
    warmth: 0.95,
    stretch: 2.0,
  },
  {
    id: 241,
    x: 0.062,
    phase: 0.7452,
    speed: 0.072,
    size: 1.22,
    opacity: 0.66,
    twinkle: 3.3,
    drift: -1.1,
    shockPhase: 0.23,
    warmth: 0.47,
    stretch: 3.3,
  },
  {
    id: 242,
    x: 0.099,
    phase: 0.8064,
    speed: 0.101,
    size: 2.92,
    opacity: 0.52,
    twinkle: 5.6,
    drift: 2.0,
    shockPhase: 0.7,
    warmth: 1.0,
    stretch: 1.8,
  },
  {
    id: 243,
    x: 0.136,
    phase: 0.8676,
    speed: 0.13,
    size: 1.52,
    opacity: 0.38,
    twinkle: 3.0,
    drift: 1.0,
    shockPhase: 1.17,
    warmth: 0.52,
    stretch: 3.1,
  },
  {
    id: 244,
    x: 0.173,
    phase: 0.9288,
    speed: 0.075,
    size: 3.22,
    opacity: 0.24,
    twinkle: 5.3,
    drift: 0.0,
    shockPhase: 1.64,
    warmth: 0.04,
    stretch: 1.6,
  },
  {
    id: 245,
    x: 0.21,
    phase: 0.99,
    speed: 0.104,
    size: 1.82,
    opacity: 0.67,
    twinkle: 2.7,
    drift: -1.0,
    shockPhase: 2.11,
    warmth: 0.57,
    stretch: 2.9,
  },
  {
    id: 246,
    x: 0.247,
    phase: 0.0512,
    speed: 0.133,
    size: 3.52,
    opacity: 0.53,
    twinkle: 5.0,
    drift: -2.0,
    shockPhase: 2.58,
    warmth: 0.09,
    stretch: 1.4,
  },
  {
    id: 247,
    x: 0.284,
    phase: 0.1123,
    speed: 0.078,
    size: 2.12,
    opacity: 0.39,
    twinkle: 7.3,
    drift: 1.1,
    shockPhase: 3.05,
    warmth: 0.62,
    stretch: 2.7,
  },
  {
    id: 248,
    x: 0.321,
    phase: 0.1735,
    speed: 0.107,
    size: 0.72,
    opacity: 0.25,
    twinkle: 4.7,
    drift: 0.1,
    shockPhase: 3.52,
    warmth: 0.14,
    stretch: 1.2,
  },
  {
    id: 249,
    x: 0.358,
    phase: 0.2347,
    speed: 0.136,
    size: 2.42,
    opacity: 0.68,
    twinkle: 7.0,
    drift: -0.9,
    shockPhase: 3.99,
    warmth: 0.67,
    stretch: 2.5,
  },
  {
    id: 250,
    x: 0.395,
    phase: 0.2959,
    speed: 0.081,
    size: 1.02,
    opacity: 0.54,
    twinkle: 4.4,
    drift: -1.9,
    shockPhase: 4.46,
    warmth: 0.19,
    stretch: 1.0,
  },
  {
    id: 251,
    x: 0.432,
    phase: 0.3571,
    speed: 0.11,
    size: 2.72,
    opacity: 0.4,
    twinkle: 6.7,
    drift: 1.2,
    shockPhase: 4.93,
    warmth: 0.72,
    stretch: 2.3,
  },
  {
    id: 252,
    x: 0.469,
    phase: 0.4183,
    speed: 0.055,
    size: 1.32,
    opacity: 0.26,
    twinkle: 4.1,
    drift: 0.2,
    shockPhase: 5.4,
    warmth: 0.24,
    stretch: 0.8,
  },
  {
    id: 253,
    x: 0.506,
    phase: 0.4794,
    speed: 0.084,
    size: 3.02,
    opacity: 0.69,
    twinkle: 6.4,
    drift: -0.8,
    shockPhase: 5.87,
    warmth: 0.77,
    stretch: 2.1,
  },
  {
    id: 254,
    x: 0.543,
    phase: 0.5406,
    speed: 0.113,
    size: 1.62,
    opacity: 0.55,
    twinkle: 3.8,
    drift: -1.8,
    shockPhase: 0.06,
    warmth: 0.29,
    stretch: 3.4,
  },
  {
    id: 255,
    x: 0.58,
    phase: 0.6018,
    speed: 0.058,
    size: 3.32,
    opacity: 0.41,
    twinkle: 6.1,
    drift: 1.3,
    shockPhase: 0.53,
    warmth: 0.82,
    stretch: 1.9,
  },
  {
    id: 256,
    x: 0.617,
    phase: 0.663,
    speed: 0.087,
    size: 1.92,
    opacity: 0.27,
    twinkle: 3.5,
    drift: 0.3,
    shockPhase: 1.0,
    warmth: 0.34,
    stretch: 3.2,
  },
  {
    id: 257,
    x: 0.654,
    phase: 0.7242,
    speed: 0.116,
    size: 3.62,
    opacity: 0.7,
    twinkle: 5.8,
    drift: -0.7,
    shockPhase: 1.47,
    warmth: 0.87,
    stretch: 1.7,
  },
  {
    id: 258,
    x: 0.691,
    phase: 0.7854,
    speed: 0.061,
    size: 2.22,
    opacity: 0.56,
    twinkle: 3.2,
    drift: -1.7,
    shockPhase: 1.94,
    warmth: 0.39,
    stretch: 3.0,
  },
  {
    id: 259,
    x: 0.728,
    phase: 0.8465,
    speed: 0.09,
    size: 0.82,
    opacity: 0.42,
    twinkle: 5.5,
    drift: 1.4,
    shockPhase: 2.41,
    warmth: 0.92,
    stretch: 1.5,
  },
  {
    id: 260,
    x: 0.765,
    phase: 0.9077,
    speed: 0.119,
    size: 2.52,
    opacity: 0.28,
    twinkle: 2.9,
    drift: 0.4,
    shockPhase: 2.88,
    warmth: 0.44,
    stretch: 2.8,
  },
  {
    id: 261,
    x: 0.802,
    phase: 0.9689,
    speed: 0.064,
    size: 1.12,
    opacity: 0.71,
    twinkle: 5.2,
    drift: -0.6,
    shockPhase: 3.35,
    warmth: 0.97,
    stretch: 1.3,
  },
  {
    id: 262,
    x: 0.839,
    phase: 0.0301,
    speed: 0.093,
    size: 2.82,
    opacity: 0.57,
    twinkle: 7.5,
    drift: -1.6,
    shockPhase: 3.82,
    warmth: 0.49,
    stretch: 2.6,
  },
  {
    id: 263,
    x: 0.876,
    phase: 0.0913,
    speed: 0.122,
    size: 1.42,
    opacity: 0.43,
    twinkle: 4.9,
    drift: 1.5,
    shockPhase: 4.29,
    warmth: 0.01,
    stretch: 1.1,
  },
  {
    id: 264,
    x: 0.913,
    phase: 0.1525,
    speed: 0.067,
    size: 3.12,
    opacity: 0.29,
    twinkle: 7.2,
    drift: 0.5,
    shockPhase: 4.76,
    warmth: 0.54,
    stretch: 2.4,
  },
  {
    id: 265,
    x: 0.059,
    phase: 0.2136,
    speed: 0.096,
    size: 1.72,
    opacity: 0.72,
    twinkle: 4.6,
    drift: -0.5,
    shockPhase: 5.23,
    warmth: 0.06,
    stretch: 0.9,
  },
  {
    id: 266,
    x: 0.096,
    phase: 0.2748,
    speed: 0.125,
    size: 3.42,
    opacity: 0.58,
    twinkle: 6.9,
    drift: -1.5,
    shockPhase: 5.7,
    warmth: 0.59,
    stretch: 2.2,
  },
  {
    id: 267,
    x: 0.133,
    phase: 0.336,
    speed: 0.07,
    size: 2.02,
    opacity: 0.44,
    twinkle: 4.3,
    drift: 1.6,
    shockPhase: 6.17,
    warmth: 0.11,
    stretch: 3.5,
  },
  {
    id: 268,
    x: 0.17,
    phase: 0.3972,
    speed: 0.099,
    size: 3.72,
    opacity: 0.3,
    twinkle: 6.6,
    drift: 0.6,
    shockPhase: 0.36,
    warmth: 0.64,
    stretch: 2.0,
  },
  {
    id: 269,
    x: 0.207,
    phase: 0.4584,
    speed: 0.128,
    size: 2.32,
    opacity: 0.73,
    twinkle: 4.0,
    drift: -0.4,
    shockPhase: 0.83,
    warmth: 0.16,
    stretch: 3.3,
  },
  {
    id: 270,
    x: 0.244,
    phase: 0.5196,
    speed: 0.073,
    size: 0.92,
    opacity: 0.59,
    twinkle: 6.3,
    drift: -1.4,
    shockPhase: 1.3,
    warmth: 0.69,
    stretch: 1.8,
  },
  {
    id: 271,
    x: 0.281,
    phase: 0.5807,
    speed: 0.102,
    size: 2.62,
    opacity: 0.45,
    twinkle: 3.7,
    drift: 1.7,
    shockPhase: 1.77,
    warmth: 0.21,
    stretch: 3.1,
  },
  {
    id: 272,
    x: 0.318,
    phase: 0.6419,
    speed: 0.131,
    size: 1.22,
    opacity: 0.31,
    twinkle: 6.0,
    drift: 0.7,
    shockPhase: 2.24,
    warmth: 0.74,
    stretch: 1.6,
  },
  {
    id: 273,
    x: 0.355,
    phase: 0.7031,
    speed: 0.076,
    size: 2.92,
    opacity: 0.74,
    twinkle: 3.4,
    drift: -0.3,
    shockPhase: 2.71,
    warmth: 0.26,
    stretch: 2.9,
  },
  {
    id: 274,
    x: 0.392,
    phase: 0.7643,
    speed: 0.105,
    size: 1.52,
    opacity: 0.6,
    twinkle: 5.7,
    drift: -1.3,
    shockPhase: 3.18,
    warmth: 0.79,
    stretch: 1.4,
  },
  {
    id: 275,
    x: 0.429,
    phase: 0.8255,
    speed: 0.134,
    size: 3.22,
    opacity: 0.46,
    twinkle: 3.1,
    drift: 1.8,
    shockPhase: 3.65,
    warmth: 0.31,
    stretch: 2.7,
  },
  {
    id: 276,
    x: 0.466,
    phase: 0.8867,
    speed: 0.079,
    size: 1.82,
    opacity: 0.32,
    twinkle: 5.4,
    drift: 0.8,
    shockPhase: 4.12,
    warmth: 0.84,
    stretch: 1.2,
  },
  {
    id: 277,
    x: 0.503,
    phase: 0.9478,
    speed: 0.108,
    size: 3.52,
    opacity: 0.75,
    twinkle: 2.8,
    drift: -0.2,
    shockPhase: 4.59,
    warmth: 0.36,
    stretch: 2.5,
  },
  {
    id: 278,
    x: 0.54,
    phase: 0.009,
    speed: 0.137,
    size: 2.12,
    opacity: 0.61,
    twinkle: 5.1,
    drift: -1.2,
    shockPhase: 5.06,
    warmth: 0.89,
    stretch: 1.0,
  },
  {
    id: 279,
    x: 0.577,
    phase: 0.0702,
    speed: 0.082,
    size: 0.72,
    opacity: 0.47,
    twinkle: 7.4,
    drift: 1.9,
    shockPhase: 5.53,
    warmth: 0.41,
    stretch: 2.3,
  },
  {
    id: 280,
    x: 0.614,
    phase: 0.1314,
    speed: 0.111,
    size: 2.42,
    opacity: 0.33,
    twinkle: 4.8,
    drift: 0.9,
    shockPhase: 6.0,
    warmth: 0.94,
    stretch: 0.8,
  },
  {
    id: 281,
    x: 0.651,
    phase: 0.1926,
    speed: 0.056,
    size: 1.02,
    opacity: 0.76,
    twinkle: 7.1,
    drift: -0.1,
    shockPhase: 0.19,
    warmth: 0.46,
    stretch: 2.1,
  },
  {
    id: 282,
    x: 0.688,
    phase: 0.2538,
    speed: 0.085,
    size: 2.72,
    opacity: 0.62,
    twinkle: 4.5,
    drift: -1.1,
    shockPhase: 0.66,
    warmth: 0.99,
    stretch: 3.4,
  },
  {
    id: 283,
    x: 0.725,
    phase: 0.3149,
    speed: 0.114,
    size: 1.32,
    opacity: 0.48,
    twinkle: 6.8,
    drift: 2.0,
    shockPhase: 1.13,
    warmth: 0.51,
    stretch: 1.9,
  },
  {
    id: 284,
    x: 0.762,
    phase: 0.3761,
    speed: 0.059,
    size: 3.02,
    opacity: 0.34,
    twinkle: 4.2,
    drift: 1.0,
    shockPhase: 1.6,
    warmth: 0.03,
    stretch: 3.2,
  },
  {
    id: 285,
    x: 0.799,
    phase: 0.4373,
    speed: 0.088,
    size: 1.62,
    opacity: 0.2,
    twinkle: 6.5,
    drift: 0.0,
    shockPhase: 2.07,
    warmth: 0.56,
    stretch: 1.7,
  },
  {
    id: 286,
    x: 0.836,
    phase: 0.4985,
    speed: 0.117,
    size: 3.32,
    opacity: 0.63,
    twinkle: 3.9,
    drift: -1.0,
    shockPhase: 2.54,
    warmth: 0.08,
    stretch: 3.0,
  },
  {
    id: 287,
    x: 0.873,
    phase: 0.5597,
    speed: 0.062,
    size: 1.92,
    opacity: 0.49,
    twinkle: 6.2,
    drift: -2.0,
    shockPhase: 3.01,
    warmth: 0.61,
    stretch: 1.5,
  },
  {
    id: 288,
    x: 0.91,
    phase: 0.6209,
    speed: 0.091,
    size: 3.62,
    opacity: 0.35,
    twinkle: 3.6,
    drift: 1.1,
    shockPhase: 3.48,
    warmth: 0.13,
    stretch: 2.8,
  },
  {
    id: 289,
    x: 0.056,
    phase: 0.682,
    speed: 0.12,
    size: 2.22,
    opacity: 0.21,
    twinkle: 5.9,
    drift: 0.1,
    shockPhase: 3.95,
    warmth: 0.66,
    stretch: 1.3,
  },
  {
    id: 290,
    x: 0.093,
    phase: 0.7432,
    speed: 0.065,
    size: 0.82,
    opacity: 0.64,
    twinkle: 3.3,
    drift: -0.9,
    shockPhase: 4.42,
    warmth: 0.18,
    stretch: 2.6,
  },
  {
    id: 291,
    x: 0.13,
    phase: 0.8044,
    speed: 0.094,
    size: 2.52,
    opacity: 0.5,
    twinkle: 5.6,
    drift: -1.9,
    shockPhase: 4.89,
    warmth: 0.71,
    stretch: 1.1,
  },
  {
    id: 292,
    x: 0.167,
    phase: 0.8656,
    speed: 0.123,
    size: 1.12,
    opacity: 0.36,
    twinkle: 3.0,
    drift: 1.2,
    shockPhase: 5.36,
    warmth: 0.23,
    stretch: 2.4,
  },
  {
    id: 293,
    x: 0.204,
    phase: 0.9268,
    speed: 0.068,
    size: 2.82,
    opacity: 0.22,
    twinkle: 5.3,
    drift: 0.2,
    shockPhase: 5.83,
    warmth: 0.76,
    stretch: 0.9,
  },
  {
    id: 294,
    x: 0.241,
    phase: 0.988,
    speed: 0.097,
    size: 1.42,
    opacity: 0.65,
    twinkle: 2.7,
    drift: -0.8,
    shockPhase: 0.02,
    warmth: 0.28,
    stretch: 2.2,
  },
  {
    id: 295,
    x: 0.278,
    phase: 0.0491,
    speed: 0.126,
    size: 3.12,
    opacity: 0.51,
    twinkle: 5.0,
    drift: -1.8,
    shockPhase: 0.49,
    warmth: 0.81,
    stretch: 3.5,
  },
  {
    id: 296,
    x: 0.315,
    phase: 0.1103,
    speed: 0.071,
    size: 1.72,
    opacity: 0.37,
    twinkle: 7.3,
    drift: 1.3,
    shockPhase: 0.96,
    warmth: 0.33,
    stretch: 2.0,
  },
  {
    id: 297,
    x: 0.352,
    phase: 0.1715,
    speed: 0.1,
    size: 3.42,
    opacity: 0.23,
    twinkle: 4.7,
    drift: 0.3,
    shockPhase: 1.43,
    warmth: 0.86,
    stretch: 3.3,
  },
  {
    id: 298,
    x: 0.389,
    phase: 0.2327,
    speed: 0.129,
    size: 2.02,
    opacity: 0.66,
    twinkle: 7.0,
    drift: -0.7,
    shockPhase: 1.9,
    warmth: 0.38,
    stretch: 1.8,
  },
  {
    id: 299,
    x: 0.426,
    phase: 0.2939,
    speed: 0.074,
    size: 3.72,
    opacity: 0.52,
    twinkle: 4.4,
    drift: -1.7,
    shockPhase: 2.37,
    warmth: 0.91,
    stretch: 3.1,
  },
  {
    id: 300,
    x: 0.463,
    phase: 0.3551,
    speed: 0.103,
    size: 2.32,
    opacity: 0.38,
    twinkle: 6.7,
    drift: 1.4,
    shockPhase: 2.84,
    warmth: 0.43,
    stretch: 1.6,
  },
  {
    id: 301,
    x: 0.5,
    phase: 0.4162,
    speed: 0.132,
    size: 0.92,
    opacity: 0.24,
    twinkle: 4.1,
    drift: 0.4,
    shockPhase: 3.31,
    warmth: 0.96,
    stretch: 2.9,
  },
  {
    id: 302,
    x: 0.537,
    phase: 0.4774,
    speed: 0.077,
    size: 2.62,
    opacity: 0.67,
    twinkle: 6.4,
    drift: -0.6,
    shockPhase: 3.78,
    warmth: 0.48,
    stretch: 1.4,
  },
  {
    id: 303,
    x: 0.574,
    phase: 0.5386,
    speed: 0.106,
    size: 1.22,
    opacity: 0.53,
    twinkle: 3.8,
    drift: -1.6,
    shockPhase: 4.25,
    warmth: 0.0,
    stretch: 2.7,
  },
  {
    id: 304,
    x: 0.611,
    phase: 0.5998,
    speed: 0.135,
    size: 2.92,
    opacity: 0.39,
    twinkle: 6.1,
    drift: 1.5,
    shockPhase: 4.72,
    warmth: 0.53,
    stretch: 1.2,
  },
  {
    id: 305,
    x: 0.648,
    phase: 0.661,
    speed: 0.08,
    size: 1.52,
    opacity: 0.25,
    twinkle: 3.5,
    drift: 0.5,
    shockPhase: 5.19,
    warmth: 0.05,
    stretch: 2.5,
  },
  {
    id: 306,
    x: 0.685,
    phase: 0.7222,
    speed: 0.109,
    size: 3.22,
    opacity: 0.68,
    twinkle: 5.8,
    drift: -0.5,
    shockPhase: 5.66,
    warmth: 0.58,
    stretch: 1.0,
  },
  {
    id: 307,
    x: 0.722,
    phase: 0.7834,
    speed: 0.138,
    size: 1.82,
    opacity: 0.54,
    twinkle: 3.2,
    drift: -1.5,
    shockPhase: 6.13,
    warmth: 0.1,
    stretch: 2.3,
  },
  {
    id: 308,
    x: 0.759,
    phase: 0.8445,
    speed: 0.083,
    size: 3.52,
    opacity: 0.4,
    twinkle: 5.5,
    drift: 1.6,
    shockPhase: 0.32,
    warmth: 0.63,
    stretch: 0.8,
  },
  {
    id: 309,
    x: 0.796,
    phase: 0.9057,
    speed: 0.112,
    size: 2.12,
    opacity: 0.26,
    twinkle: 2.9,
    drift: 0.6,
    shockPhase: 0.79,
    warmth: 0.15,
    stretch: 2.1,
  },
  {
    id: 310,
    x: 0.833,
    phase: 0.9669,
    speed: 0.057,
    size: 0.72,
    opacity: 0.69,
    twinkle: 5.2,
    drift: -0.4,
    shockPhase: 1.26,
    warmth: 0.68,
    stretch: 3.4,
  },
  {
    id: 311,
    x: 0.87,
    phase: 0.0281,
    speed: 0.086,
    size: 2.42,
    opacity: 0.55,
    twinkle: 7.5,
    drift: -1.4,
    shockPhase: 1.73,
    warmth: 0.2,
    stretch: 1.9,
  },
  {
    id: 312,
    x: 0.907,
    phase: 0.0893,
    speed: 0.115,
    size: 1.02,
    opacity: 0.41,
    twinkle: 4.9,
    drift: 1.7,
    shockPhase: 2.2,
    warmth: 0.73,
    stretch: 3.2,
  },
  {
    id: 313,
    x: 0.944,
    phase: 0.1505,
    speed: 0.06,
    size: 2.72,
    opacity: 0.27,
    twinkle: 7.2,
    drift: 0.7,
    shockPhase: 2.67,
    warmth: 0.25,
    stretch: 1.7,
  },
  {
    id: 314,
    x: 0.09,
    phase: 0.2116,
    speed: 0.089,
    size: 1.32,
    opacity: 0.7,
    twinkle: 4.6,
    drift: -0.3,
    shockPhase: 3.14,
    warmth: 0.78,
    stretch: 3.0,
  },
  {
    id: 315,
    x: 0.127,
    phase: 0.2728,
    speed: 0.118,
    size: 3.02,
    opacity: 0.56,
    twinkle: 6.9,
    drift: -1.3,
    shockPhase: 3.61,
    warmth: 0.3,
    stretch: 1.5,
  },
  {
    id: 316,
    x: 0.164,
    phase: 0.334,
    speed: 0.063,
    size: 1.62,
    opacity: 0.42,
    twinkle: 4.3,
    drift: 1.8,
    shockPhase: 4.08,
    warmth: 0.83,
    stretch: 2.8,
  },
  {
    id: 317,
    x: 0.201,
    phase: 0.3952,
    speed: 0.092,
    size: 3.32,
    opacity: 0.28,
    twinkle: 6.6,
    drift: 0.8,
    shockPhase: 4.55,
    warmth: 0.35,
    stretch: 1.3,
  },
  {
    id: 318,
    x: 0.238,
    phase: 0.4564,
    speed: 0.121,
    size: 1.92,
    opacity: 0.71,
    twinkle: 4.0,
    drift: -0.2,
    shockPhase: 5.02,
    warmth: 0.88,
    stretch: 2.6,
  },
  {
    id: 319,
    x: 0.275,
    phase: 0.5176,
    speed: 0.066,
    size: 3.62,
    opacity: 0.57,
    twinkle: 6.3,
    drift: -1.2,
    shockPhase: 5.49,
    warmth: 0.4,
    stretch: 1.1,
  },
  {
    id: 320,
    x: 0.312,
    phase: 0.5787,
    speed: 0.095,
    size: 2.22,
    opacity: 0.43,
    twinkle: 3.7,
    drift: 1.9,
    shockPhase: 5.96,
    warmth: 0.93,
    stretch: 2.4,
  },
  {
    id: 321,
    x: 0.349,
    phase: 0.6399,
    speed: 0.124,
    size: 0.82,
    opacity: 0.29,
    twinkle: 6.0,
    drift: 0.9,
    shockPhase: 0.15,
    warmth: 0.45,
    stretch: 0.9,
  },
  {
    id: 322,
    x: 0.386,
    phase: 0.7011,
    speed: 0.069,
    size: 2.52,
    opacity: 0.72,
    twinkle: 3.4,
    drift: -0.1,
    shockPhase: 0.62,
    warmth: 0.98,
    stretch: 2.2,
  },
  {
    id: 323,
    x: 0.423,
    phase: 0.7623,
    speed: 0.098,
    size: 1.12,
    opacity: 0.58,
    twinkle: 5.7,
    drift: -1.1,
    shockPhase: 1.09,
    warmth: 0.5,
    stretch: 3.5,
  },
  {
    id: 324,
    x: 0.46,
    phase: 0.8235,
    speed: 0.127,
    size: 2.82,
    opacity: 0.44,
    twinkle: 3.1,
    drift: 2.0,
    shockPhase: 1.56,
    warmth: 0.02,
    stretch: 2.0,
  },
  {
    id: 325,
    x: 0.497,
    phase: 0.8847,
    speed: 0.072,
    size: 1.42,
    opacity: 0.3,
    twinkle: 5.4,
    drift: 1.0,
    shockPhase: 2.03,
    warmth: 0.55,
    stretch: 3.3,
  },
  {
    id: 326,
    x: 0.534,
    phase: 0.9458,
    speed: 0.101,
    size: 3.12,
    opacity: 0.73,
    twinkle: 2.8,
    drift: 0.0,
    shockPhase: 2.5,
    warmth: 0.07,
    stretch: 1.8,
  },
  {
    id: 327,
    x: 0.571,
    phase: 0.007,
    speed: 0.13,
    size: 1.72,
    opacity: 0.59,
    twinkle: 5.1,
    drift: -1.0,
    shockPhase: 2.97,
    warmth: 0.6,
    stretch: 3.1,
  },
  {
    id: 328,
    x: 0.608,
    phase: 0.0682,
    speed: 0.075,
    size: 3.42,
    opacity: 0.45,
    twinkle: 7.4,
    drift: -2.0,
    shockPhase: 3.44,
    warmth: 0.12,
    stretch: 1.6,
  },
  {
    id: 329,
    x: 0.645,
    phase: 0.1294,
    speed: 0.104,
    size: 2.02,
    opacity: 0.31,
    twinkle: 4.8,
    drift: 1.1,
    shockPhase: 3.91,
    warmth: 0.65,
    stretch: 2.9,
  },
  {
    id: 330,
    x: 0.682,
    phase: 0.1906,
    speed: 0.133,
    size: 3.72,
    opacity: 0.74,
    twinkle: 7.1,
    drift: 0.1,
    shockPhase: 4.38,
    warmth: 0.17,
    stretch: 1.4,
  },
  {
    id: 331,
    x: 0.719,
    phase: 0.2518,
    speed: 0.078,
    size: 2.32,
    opacity: 0.6,
    twinkle: 4.5,
    drift: -0.9,
    shockPhase: 4.85,
    warmth: 0.7,
    stretch: 2.7,
  },
  {
    id: 332,
    x: 0.756,
    phase: 0.3129,
    speed: 0.107,
    size: 0.92,
    opacity: 0.46,
    twinkle: 6.8,
    drift: -1.9,
    shockPhase: 5.32,
    warmth: 0.22,
    stretch: 1.2,
  },
  {
    id: 333,
    x: 0.793,
    phase: 0.3741,
    speed: 0.136,
    size: 2.62,
    opacity: 0.32,
    twinkle: 4.2,
    drift: 1.2,
    shockPhase: 5.79,
    warmth: 0.75,
    stretch: 2.5,
  },
  {
    id: 334,
    x: 0.83,
    phase: 0.4353,
    speed: 0.081,
    size: 1.22,
    opacity: 0.75,
    twinkle: 6.5,
    drift: 0.2,
    shockPhase: 6.26,
    warmth: 0.27,
    stretch: 1.0,
  },
  {
    id: 335,
    x: 0.867,
    phase: 0.4965,
    speed: 0.11,
    size: 2.92,
    opacity: 0.61,
    twinkle: 3.9,
    drift: -0.8,
    shockPhase: 0.45,
    warmth: 0.8,
    stretch: 2.3,
  },
  {
    id: 336,
    x: 0.904,
    phase: 0.5577,
    speed: 0.055,
    size: 1.52,
    opacity: 0.47,
    twinkle: 6.2,
    drift: -1.8,
    shockPhase: 0.92,
    warmth: 0.32,
    stretch: 0.8,
  },
  {
    id: 337,
    x: 0.941,
    phase: 0.6189,
    speed: 0.084,
    size: 3.22,
    opacity: 0.33,
    twinkle: 3.6,
    drift: 1.3,
    shockPhase: 1.39,
    warmth: 0.85,
    stretch: 2.1,
  },
  {
    id: 338,
    x: 0.087,
    phase: 0.68,
    speed: 0.113,
    size: 1.82,
    opacity: 0.76,
    twinkle: 5.9,
    drift: 0.3,
    shockPhase: 1.86,
    warmth: 0.37,
    stretch: 3.4,
  },
  {
    id: 339,
    x: 0.124,
    phase: 0.7412,
    speed: 0.058,
    size: 3.52,
    opacity: 0.62,
    twinkle: 3.3,
    drift: -0.7,
    shockPhase: 2.33,
    warmth: 0.9,
    stretch: 1.9,
  },
  {
    id: 340,
    x: 0.161,
    phase: 0.8024,
    speed: 0.087,
    size: 2.12,
    opacity: 0.48,
    twinkle: 5.6,
    drift: -1.7,
    shockPhase: 2.8,
    warmth: 0.42,
    stretch: 3.2,
  },
  {
    id: 341,
    x: 0.198,
    phase: 0.8636,
    speed: 0.116,
    size: 0.72,
    opacity: 0.34,
    twinkle: 3.0,
    drift: 1.4,
    shockPhase: 3.27,
    warmth: 0.95,
    stretch: 1.7,
  },
  {
    id: 342,
    x: 0.235,
    phase: 0.9248,
    speed: 0.061,
    size: 2.42,
    opacity: 0.2,
    twinkle: 5.3,
    drift: 0.4,
    shockPhase: 3.74,
    warmth: 0.47,
    stretch: 3.0,
  },
  {
    id: 343,
    x: 0.272,
    phase: 0.986,
    speed: 0.09,
    size: 1.02,
    opacity: 0.63,
    twinkle: 2.7,
    drift: -0.6,
    shockPhase: 4.21,
    warmth: 1.0,
    stretch: 1.5,
  },
  {
    id: 344,
    x: 0.309,
    phase: 0.0471,
    speed: 0.119,
    size: 2.72,
    opacity: 0.49,
    twinkle: 5.0,
    drift: -1.6,
    shockPhase: 4.68,
    warmth: 0.52,
    stretch: 2.8,
  },
  {
    id: 345,
    x: 0.346,
    phase: 0.1083,
    speed: 0.064,
    size: 1.32,
    opacity: 0.35,
    twinkle: 7.3,
    drift: 1.5,
    shockPhase: 5.15,
    warmth: 0.04,
    stretch: 1.3,
  },
  {
    id: 346,
    x: 0.383,
    phase: 0.1695,
    speed: 0.093,
    size: 3.02,
    opacity: 0.21,
    twinkle: 4.7,
    drift: 0.5,
    shockPhase: 5.62,
    warmth: 0.57,
    stretch: 2.6,
  },
  {
    id: 347,
    x: 0.42,
    phase: 0.2307,
    speed: 0.122,
    size: 1.62,
    opacity: 0.64,
    twinkle: 7.0,
    drift: -0.5,
    shockPhase: 6.09,
    warmth: 0.09,
    stretch: 1.1,
  },
  {
    id: 348,
    x: 0.457,
    phase: 0.2919,
    speed: 0.067,
    size: 3.32,
    opacity: 0.5,
    twinkle: 4.4,
    drift: -1.5,
    shockPhase: 0.28,
    warmth: 0.62,
    stretch: 2.4,
  },
  {
    id: 349,
    x: 0.494,
    phase: 0.3531,
    speed: 0.096,
    size: 1.92,
    opacity: 0.36,
    twinkle: 6.7,
    drift: 1.6,
    shockPhase: 0.75,
    warmth: 0.14,
    stretch: 0.9,
  },
  {
    id: 350,
    x: 0.531,
    phase: 0.4142,
    speed: 0.125,
    size: 3.62,
    opacity: 0.22,
    twinkle: 4.1,
    drift: 0.6,
    shockPhase: 1.22,
    warmth: 0.67,
    stretch: 2.2,
  },
  {
    id: 351,
    x: 0.568,
    phase: 0.4754,
    speed: 0.07,
    size: 2.22,
    opacity: 0.65,
    twinkle: 6.4,
    drift: -0.4,
    shockPhase: 1.69,
    warmth: 0.19,
    stretch: 3.5,
  },
  {
    id: 352,
    x: 0.605,
    phase: 0.5366,
    speed: 0.099,
    size: 0.82,
    opacity: 0.51,
    twinkle: 3.8,
    drift: -1.4,
    shockPhase: 2.16,
    warmth: 0.72,
    stretch: 2.0,
  },
  {
    id: 353,
    x: 0.642,
    phase: 0.5978,
    speed: 0.128,
    size: 2.52,
    opacity: 0.37,
    twinkle: 6.1,
    drift: 1.7,
    shockPhase: 2.63,
    warmth: 0.24,
    stretch: 3.3,
  },
  {
    id: 354,
    x: 0.679,
    phase: 0.659,
    speed: 0.073,
    size: 1.12,
    opacity: 0.23,
    twinkle: 3.5,
    drift: 0.7,
    shockPhase: 3.1,
    warmth: 0.77,
    stretch: 1.8,
  },
  {
    id: 355,
    x: 0.716,
    phase: 0.7202,
    speed: 0.102,
    size: 2.82,
    opacity: 0.66,
    twinkle: 5.8,
    drift: -0.3,
    shockPhase: 3.57,
    warmth: 0.29,
    stretch: 3.1,
  },
  {
    id: 356,
    x: 0.753,
    phase: 0.7813,
    speed: 0.131,
    size: 1.42,
    opacity: 0.52,
    twinkle: 3.2,
    drift: -1.3,
    shockPhase: 4.04,
    warmth: 0.82,
    stretch: 1.6,
  },
  {
    id: 357,
    x: 0.79,
    phase: 0.8425,
    speed: 0.076,
    size: 3.12,
    opacity: 0.38,
    twinkle: 5.5,
    drift: 1.8,
    shockPhase: 4.51,
    warmth: 0.34,
    stretch: 2.9,
  },
  {
    id: 358,
    x: 0.827,
    phase: 0.9037,
    speed: 0.105,
    size: 1.72,
    opacity: 0.24,
    twinkle: 2.9,
    drift: 0.8,
    shockPhase: 4.98,
    warmth: 0.87,
    stretch: 1.4,
  },
  {
    id: 359,
    x: 0.864,
    phase: 0.9649,
    speed: 0.134,
    size: 3.42,
    opacity: 0.67,
    twinkle: 5.2,
    drift: -0.2,
    shockPhase: 5.45,
    warmth: 0.39,
    stretch: 2.7,
  },
  {
    id: 360,
    x: 0.901,
    phase: 0.0261,
    speed: 0.079,
    size: 2.02,
    opacity: 0.53,
    twinkle: 7.5,
    drift: -1.2,
    shockPhase: 5.92,
    warmth: 0.92,
    stretch: 1.2,
  },
  {
    id: 361,
    x: 0.938,
    phase: 0.0873,
    speed: 0.108,
    size: 3.72,
    opacity: 0.39,
    twinkle: 4.9,
    drift: 1.9,
    shockPhase: 0.11,
    warmth: 0.44,
    stretch: 2.5,
  },
  {
    id: 362,
    x: 0.084,
    phase: 0.1484,
    speed: 0.137,
    size: 2.32,
    opacity: 0.25,
    twinkle: 7.2,
    drift: 0.9,
    shockPhase: 0.58,
    warmth: 0.97,
    stretch: 1.0,
  },
  {
    id: 363,
    x: 0.121,
    phase: 0.2096,
    speed: 0.082,
    size: 0.92,
    opacity: 0.68,
    twinkle: 4.6,
    drift: -0.1,
    shockPhase: 1.05,
    warmth: 0.49,
    stretch: 2.3,
  },
  {
    id: 364,
    x: 0.158,
    phase: 0.2708,
    speed: 0.111,
    size: 2.62,
    opacity: 0.54,
    twinkle: 6.9,
    drift: -1.1,
    shockPhase: 1.52,
    warmth: 0.01,
    stretch: 0.8,
  },
  {
    id: 365,
    x: 0.195,
    phase: 0.332,
    speed: 0.056,
    size: 1.22,
    opacity: 0.4,
    twinkle: 4.3,
    drift: 2.0,
    shockPhase: 1.99,
    warmth: 0.54,
    stretch: 2.1,
  },
  {
    id: 366,
    x: 0.232,
    phase: 0.3932,
    speed: 0.085,
    size: 2.92,
    opacity: 0.26,
    twinkle: 6.6,
    drift: 1.0,
    shockPhase: 2.46,
    warmth: 0.06,
    stretch: 3.4,
  },
  {
    id: 367,
    x: 0.269,
    phase: 0.4544,
    speed: 0.114,
    size: 1.52,
    opacity: 0.69,
    twinkle: 4.0,
    drift: 0.0,
    shockPhase: 2.93,
    warmth: 0.59,
    stretch: 1.9,
  },
  {
    id: 368,
    x: 0.306,
    phase: 0.5155,
    speed: 0.059,
    size: 3.22,
    opacity: 0.55,
    twinkle: 6.3,
    drift: -1.0,
    shockPhase: 3.4,
    warmth: 0.11,
    stretch: 3.2,
  },
  {
    id: 369,
    x: 0.343,
    phase: 0.5767,
    speed: 0.088,
    size: 1.82,
    opacity: 0.41,
    twinkle: 3.7,
    drift: -2.0,
    shockPhase: 3.87,
    warmth: 0.64,
    stretch: 1.7,
  },
  {
    id: 370,
    x: 0.38,
    phase: 0.6379,
    speed: 0.117,
    size: 3.52,
    opacity: 0.27,
    twinkle: 6.0,
    drift: 1.1,
    shockPhase: 4.34,
    warmth: 0.16,
    stretch: 3.0,
  },
  {
    id: 371,
    x: 0.417,
    phase: 0.6991,
    speed: 0.062,
    size: 2.12,
    opacity: 0.7,
    twinkle: 3.4,
    drift: 0.1,
    shockPhase: 4.81,
    warmth: 0.69,
    stretch: 1.5,
  },
  {
    id: 372,
    x: 0.454,
    phase: 0.7603,
    speed: 0.091,
    size: 0.72,
    opacity: 0.56,
    twinkle: 5.7,
    drift: -0.9,
    shockPhase: 5.28,
    warmth: 0.21,
    stretch: 2.8,
  },
  {
    id: 373,
    x: 0.491,
    phase: 0.8215,
    speed: 0.12,
    size: 2.42,
    opacity: 0.42,
    twinkle: 3.1,
    drift: -1.9,
    shockPhase: 5.75,
    warmth: 0.74,
    stretch: 1.3,
  },
  {
    id: 374,
    x: 0.528,
    phase: 0.8826,
    speed: 0.065,
    size: 1.02,
    opacity: 0.28,
    twinkle: 5.4,
    drift: 1.2,
    shockPhase: 6.22,
    warmth: 0.26,
    stretch: 2.6,
  },
  {
    id: 375,
    x: 0.565,
    phase: 0.9438,
    speed: 0.094,
    size: 2.72,
    opacity: 0.71,
    twinkle: 2.8,
    drift: 0.2,
    shockPhase: 0.41,
    warmth: 0.79,
    stretch: 1.1,
  },
  {
    id: 376,
    x: 0.602,
    phase: 0.005,
    speed: 0.123,
    size: 1.32,
    opacity: 0.57,
    twinkle: 5.1,
    drift: -0.8,
    shockPhase: 0.88,
    warmth: 0.31,
    stretch: 2.4,
  },
  {
    id: 377,
    x: 0.639,
    phase: 0.0662,
    speed: 0.068,
    size: 3.02,
    opacity: 0.43,
    twinkle: 7.4,
    drift: -1.8,
    shockPhase: 1.35,
    warmth: 0.84,
    stretch: 0.9,
  },
  {
    id: 378,
    x: 0.676,
    phase: 0.1274,
    speed: 0.097,
    size: 1.62,
    opacity: 0.29,
    twinkle: 4.8,
    drift: 1.3,
    shockPhase: 1.82,
    warmth: 0.36,
    stretch: 2.2,
  },
  {
    id: 379,
    x: 0.713,
    phase: 0.1886,
    speed: 0.126,
    size: 3.32,
    opacity: 0.72,
    twinkle: 7.1,
    drift: 0.3,
    shockPhase: 2.29,
    warmth: 0.89,
    stretch: 3.5,
  },
  {
    id: 380,
    x: 0.75,
    phase: 0.2497,
    speed: 0.071,
    size: 1.92,
    opacity: 0.58,
    twinkle: 4.5,
    drift: -0.7,
    shockPhase: 2.76,
    warmth: 0.41,
    stretch: 2.0,
  },
  {
    id: 381,
    x: 0.787,
    phase: 0.3109,
    speed: 0.1,
    size: 3.62,
    opacity: 0.44,
    twinkle: 6.8,
    drift: -1.7,
    shockPhase: 3.23,
    warmth: 0.94,
    stretch: 3.3,
  },
  {
    id: 382,
    x: 0.824,
    phase: 0.3721,
    speed: 0.129,
    size: 2.22,
    opacity: 0.3,
    twinkle: 4.2,
    drift: 1.4,
    shockPhase: 3.7,
    warmth: 0.46,
    stretch: 1.8,
  },
  {
    id: 383,
    x: 0.861,
    phase: 0.4333,
    speed: 0.074,
    size: 0.82,
    opacity: 0.73,
    twinkle: 6.5,
    drift: 0.4,
    shockPhase: 4.17,
    warmth: 0.99,
    stretch: 3.1,
  },
  {
    id: 384,
    x: 0.898,
    phase: 0.4945,
    speed: 0.103,
    size: 2.52,
    opacity: 0.59,
    twinkle: 3.9,
    drift: -0.6,
    shockPhase: 4.64,
    warmth: 0.51,
    stretch: 1.6,
  },
  {
    id: 385,
    x: 0.935,
    phase: 0.5557,
    speed: 0.132,
    size: 1.12,
    opacity: 0.45,
    twinkle: 6.2,
    drift: -1.6,
    shockPhase: 5.11,
    warmth: 0.03,
    stretch: 2.9,
  },
  {
    id: 386,
    x: 0.081,
    phase: 0.6169,
    speed: 0.077,
    size: 2.82,
    opacity: 0.31,
    twinkle: 3.6,
    drift: 1.5,
    shockPhase: 5.58,
    warmth: 0.56,
    stretch: 1.4,
  },
  {
    id: 387,
    x: 0.118,
    phase: 0.678,
    speed: 0.106,
    size: 1.42,
    opacity: 0.74,
    twinkle: 5.9,
    drift: 0.5,
    shockPhase: 6.05,
    warmth: 0.08,
    stretch: 2.7,
  },
  {
    id: 388,
    x: 0.155,
    phase: 0.7392,
    speed: 0.135,
    size: 3.12,
    opacity: 0.6,
    twinkle: 3.3,
    drift: -0.5,
    shockPhase: 0.24,
    warmth: 0.61,
    stretch: 1.2,
  },
  {
    id: 389,
    x: 0.192,
    phase: 0.8004,
    speed: 0.08,
    size: 1.72,
    opacity: 0.46,
    twinkle: 5.6,
    drift: -1.5,
    shockPhase: 0.71,
    warmth: 0.13,
    stretch: 2.5,
  },
  {
    id: 390,
    x: 0.229,
    phase: 0.8616,
    speed: 0.109,
    size: 3.42,
    opacity: 0.32,
    twinkle: 3.0,
    drift: 1.6,
    shockPhase: 1.18,
    warmth: 0.66,
    stretch: 1.0,
  },
  {
    id: 391,
    x: 0.266,
    phase: 0.9228,
    speed: 0.138,
    size: 2.02,
    opacity: 0.75,
    twinkle: 5.3,
    drift: 0.6,
    shockPhase: 1.65,
    warmth: 0.18,
    stretch: 2.3,
  },
  {
    id: 392,
    x: 0.303,
    phase: 0.984,
    speed: 0.083,
    size: 3.72,
    opacity: 0.61,
    twinkle: 2.7,
    drift: -0.4,
    shockPhase: 2.12,
    warmth: 0.71,
    stretch: 0.8,
  },
  {
    id: 393,
    x: 0.34,
    phase: 0.0451,
    speed: 0.112,
    size: 2.32,
    opacity: 0.47,
    twinkle: 5.0,
    drift: -1.4,
    shockPhase: 2.59,
    warmth: 0.23,
    stretch: 2.1,
  },
  {
    id: 394,
    x: 0.377,
    phase: 0.1063,
    speed: 0.057,
    size: 0.92,
    opacity: 0.33,
    twinkle: 7.3,
    drift: 1.7,
    shockPhase: 3.06,
    warmth: 0.76,
    stretch: 3.4,
  },
  {
    id: 395,
    x: 0.414,
    phase: 0.1675,
    speed: 0.086,
    size: 2.62,
    opacity: 0.76,
    twinkle: 4.7,
    drift: 0.7,
    shockPhase: 3.53,
    warmth: 0.28,
    stretch: 1.9,
  },
  {
    id: 396,
    x: 0.451,
    phase: 0.2287,
    speed: 0.115,
    size: 1.22,
    opacity: 0.62,
    twinkle: 7.0,
    drift: -0.3,
    shockPhase: 4.0,
    warmth: 0.81,
    stretch: 3.2,
  },
  {
    id: 397,
    x: 0.488,
    phase: 0.2899,
    speed: 0.06,
    size: 2.92,
    opacity: 0.48,
    twinkle: 4.4,
    drift: -1.3,
    shockPhase: 4.47,
    warmth: 0.33,
    stretch: 1.7,
  },
  {
    id: 398,
    x: 0.525,
    phase: 0.3511,
    speed: 0.089,
    size: 1.52,
    opacity: 0.34,
    twinkle: 6.7,
    drift: 1.8,
    shockPhase: 4.94,
    warmth: 0.86,
    stretch: 3.0,
  },
  {
    id: 399,
    x: 0.562,
    phase: 0.4122,
    speed: 0.118,
    size: 3.22,
    opacity: 0.2,
    twinkle: 4.1,
    drift: 0.8,
    shockPhase: 5.41,
    warmth: 0.38,
    stretch: 1.5,
  },
  {
    id: 400,
    x: 0.599,
    phase: 0.4734,
    speed: 0.063,
    size: 1.82,
    opacity: 0.63,
    twinkle: 6.4,
    drift: -0.2,
    shockPhase: 5.88,
    warmth: 0.91,
    stretch: 2.8,
  },
  {
    id: 401,
    x: 0.636,
    phase: 0.5346,
    speed: 0.092,
    size: 3.52,
    opacity: 0.49,
    twinkle: 3.8,
    drift: -1.2,
    shockPhase: 0.07,
    warmth: 0.43,
    stretch: 1.3,
  },
  {
    id: 402,
    x: 0.673,
    phase: 0.5958,
    speed: 0.121,
    size: 2.12,
    opacity: 0.35,
    twinkle: 6.1,
    drift: 1.9,
    shockPhase: 0.54,
    warmth: 0.96,
    stretch: 2.6,
  },
  {
    id: 403,
    x: 0.71,
    phase: 0.657,
    speed: 0.066,
    size: 0.72,
    opacity: 0.21,
    twinkle: 3.5,
    drift: 0.9,
    shockPhase: 1.01,
    warmth: 0.48,
    stretch: 1.1,
  },
  {
    id: 404,
    x: 0.747,
    phase: 0.7182,
    speed: 0.095,
    size: 2.42,
    opacity: 0.64,
    twinkle: 5.8,
    drift: -0.1,
    shockPhase: 1.48,
    warmth: 0.0,
    stretch: 2.4,
  },
  {
    id: 405,
    x: 0.784,
    phase: 0.7793,
    speed: 0.124,
    size: 1.02,
    opacity: 0.5,
    twinkle: 3.2,
    drift: -1.1,
    shockPhase: 1.95,
    warmth: 0.53,
    stretch: 0.9,
  },
  {
    id: 406,
    x: 0.821,
    phase: 0.8405,
    speed: 0.069,
    size: 2.72,
    opacity: 0.36,
    twinkle: 5.5,
    drift: 2.0,
    shockPhase: 2.42,
    warmth: 0.05,
    stretch: 2.2,
  },
  {
    id: 407,
    x: 0.858,
    phase: 0.9017,
    speed: 0.098,
    size: 1.32,
    opacity: 0.22,
    twinkle: 2.9,
    drift: 1.0,
    shockPhase: 2.89,
    warmth: 0.58,
    stretch: 3.5,
  },
  {
    id: 408,
    x: 0.895,
    phase: 0.9629,
    speed: 0.127,
    size: 3.02,
    opacity: 0.65,
    twinkle: 5.2,
    drift: 0.0,
    shockPhase: 3.36,
    warmth: 0.1,
    stretch: 2.0,
  },
  {
    id: 409,
    x: 0.932,
    phase: 0.0241,
    speed: 0.072,
    size: 1.62,
    opacity: 0.51,
    twinkle: 7.5,
    drift: -1.0,
    shockPhase: 3.83,
    warmth: 0.63,
    stretch: 3.3,
  },
  {
    id: 410,
    x: 0.078,
    phase: 0.0853,
    speed: 0.101,
    size: 3.32,
    opacity: 0.37,
    twinkle: 4.9,
    drift: -2.0,
    shockPhase: 4.3,
    warmth: 0.15,
    stretch: 1.8,
  },
  {
    id: 411,
    x: 0.115,
    phase: 0.1464,
    speed: 0.13,
    size: 1.92,
    opacity: 0.23,
    twinkle: 7.2,
    drift: 1.1,
    shockPhase: 4.77,
    warmth: 0.68,
    stretch: 3.1,
  },
  {
    id: 412,
    x: 0.152,
    phase: 0.2076,
    speed: 0.075,
    size: 3.62,
    opacity: 0.66,
    twinkle: 4.6,
    drift: 0.1,
    shockPhase: 5.24,
    warmth: 0.2,
    stretch: 1.6,
  },
  {
    id: 413,
    x: 0.189,
    phase: 0.2688,
    speed: 0.104,
    size: 2.22,
    opacity: 0.52,
    twinkle: 6.9,
    drift: -0.9,
    shockPhase: 5.71,
    warmth: 0.73,
    stretch: 2.9,
  },
  {
    id: 414,
    x: 0.226,
    phase: 0.33,
    speed: 0.133,
    size: 0.82,
    opacity: 0.38,
    twinkle: 4.3,
    drift: -1.9,
    shockPhase: 6.18,
    warmth: 0.25,
    stretch: 1.4,
  },
  {
    id: 415,
    x: 0.263,
    phase: 0.3912,
    speed: 0.078,
    size: 2.52,
    opacity: 0.24,
    twinkle: 6.6,
    drift: 1.2,
    shockPhase: 0.37,
    warmth: 0.78,
    stretch: 2.7,
  },
  {
    id: 416,
    x: 0.3,
    phase: 0.4524,
    speed: 0.107,
    size: 1.12,
    opacity: 0.67,
    twinkle: 4.0,
    drift: 0.2,
    shockPhase: 0.84,
    warmth: 0.3,
    stretch: 1.2,
  },
  {
    id: 417,
    x: 0.337,
    phase: 0.5135,
    speed: 0.136,
    size: 2.82,
    opacity: 0.53,
    twinkle: 6.3,
    drift: -0.8,
    shockPhase: 1.31,
    warmth: 0.83,
    stretch: 2.5,
  },
  {
    id: 418,
    x: 0.374,
    phase: 0.5747,
    speed: 0.081,
    size: 1.42,
    opacity: 0.39,
    twinkle: 3.7,
    drift: -1.8,
    shockPhase: 1.78,
    warmth: 0.35,
    stretch: 1.0,
  },
  {
    id: 419,
    x: 0.411,
    phase: 0.6359,
    speed: 0.11,
    size: 3.12,
    opacity: 0.25,
    twinkle: 6.0,
    drift: 1.3,
    shockPhase: 2.25,
    warmth: 0.88,
    stretch: 2.3,
  },
  {
    id: 420,
    x: 0.448,
    phase: 0.6971,
    speed: 0.055,
    size: 1.72,
    opacity: 0.68,
    twinkle: 3.4,
    drift: 0.3,
    shockPhase: 2.72,
    warmth: 0.4,
    stretch: 0.8,
  },
  {
    id: 421,
    x: 0.485,
    phase: 0.7583,
    speed: 0.084,
    size: 3.42,
    opacity: 0.54,
    twinkle: 5.7,
    drift: -0.7,
    shockPhase: 3.19,
    warmth: 0.93,
    stretch: 2.1,
  },
  {
    id: 422,
    x: 0.522,
    phase: 0.8195,
    speed: 0.113,
    size: 2.02,
    opacity: 0.4,
    twinkle: 3.1,
    drift: -1.7,
    shockPhase: 3.66,
    warmth: 0.45,
    stretch: 3.4,
  },
  {
    id: 423,
    x: 0.559,
    phase: 0.8806,
    speed: 0.058,
    size: 3.72,
    opacity: 0.26,
    twinkle: 5.4,
    drift: 1.4,
    shockPhase: 4.13,
    warmth: 0.98,
    stretch: 1.9,
  },
  {
    id: 424,
    x: 0.596,
    phase: 0.9418,
    speed: 0.087,
    size: 2.32,
    opacity: 0.69,
    twinkle: 2.8,
    drift: 0.4,
    shockPhase: 4.6,
    warmth: 0.5,
    stretch: 3.2,
  },
  {
    id: 425,
    x: 0.633,
    phase: 0.003,
    speed: 0.116,
    size: 0.92,
    opacity: 0.55,
    twinkle: 5.1,
    drift: -0.6,
    shockPhase: 5.07,
    warmth: 0.02,
    stretch: 1.7,
  },
  {
    id: 426,
    x: 0.67,
    phase: 0.0642,
    speed: 0.061,
    size: 2.62,
    opacity: 0.41,
    twinkle: 7.4,
    drift: -1.6,
    shockPhase: 5.54,
    warmth: 0.55,
    stretch: 3.0,
  },
  {
    id: 427,
    x: 0.707,
    phase: 0.1254,
    speed: 0.09,
    size: 1.22,
    opacity: 0.27,
    twinkle: 4.8,
    drift: 1.5,
    shockPhase: 6.01,
    warmth: 0.07,
    stretch: 1.5,
  },
  {
    id: 428,
    x: 0.744,
    phase: 0.1866,
    speed: 0.119,
    size: 2.92,
    opacity: 0.7,
    twinkle: 7.1,
    drift: 0.5,
    shockPhase: 0.2,
    warmth: 0.6,
    stretch: 2.8,
  },
  {
    id: 429,
    x: 0.781,
    phase: 0.2477,
    speed: 0.064,
    size: 1.52,
    opacity: 0.56,
    twinkle: 4.5,
    drift: -0.5,
    shockPhase: 0.67,
    warmth: 0.12,
    stretch: 1.3,
  },
  {
    id: 430,
    x: 0.818,
    phase: 0.3089,
    speed: 0.093,
    size: 3.22,
    opacity: 0.42,
    twinkle: 6.8,
    drift: -1.5,
    shockPhase: 1.14,
    warmth: 0.65,
    stretch: 2.6,
  },
  {
    id: 431,
    x: 0.855,
    phase: 0.3701,
    speed: 0.122,
    size: 1.82,
    opacity: 0.28,
    twinkle: 4.2,
    drift: 1.6,
    shockPhase: 1.61,
    warmth: 0.17,
    stretch: 1.1,
  },
  {
    id: 432,
    x: 0.892,
    phase: 0.4313,
    speed: 0.067,
    size: 3.52,
    opacity: 0.71,
    twinkle: 6.5,
    drift: 0.6,
    shockPhase: 2.08,
    warmth: 0.7,
    stretch: 2.4,
  },
  {
    id: 433,
    x: 0.929,
    phase: 0.4925,
    speed: 0.096,
    size: 2.12,
    opacity: 0.57,
    twinkle: 3.9,
    drift: -0.4,
    shockPhase: 2.55,
    warmth: 0.22,
    stretch: 0.9,
  },
  {
    id: 434,
    x: 0.075,
    phase: 0.5537,
    speed: 0.125,
    size: 0.72,
    opacity: 0.43,
    twinkle: 6.2,
    drift: -1.4,
    shockPhase: 3.02,
    warmth: 0.75,
    stretch: 2.2,
  },
  {
    id: 435,
    x: 0.112,
    phase: 0.6148,
    speed: 0.07,
    size: 2.42,
    opacity: 0.29,
    twinkle: 3.6,
    drift: 1.7,
    shockPhase: 3.49,
    warmth: 0.27,
    stretch: 3.5,
  },
  {
    id: 436,
    x: 0.149,
    phase: 0.676,
    speed: 0.099,
    size: 1.02,
    opacity: 0.72,
    twinkle: 5.9,
    drift: 0.7,
    shockPhase: 3.96,
    warmth: 0.8,
    stretch: 2.0,
  },
  {
    id: 437,
    x: 0.186,
    phase: 0.7372,
    speed: 0.128,
    size: 2.72,
    opacity: 0.58,
    twinkle: 3.3,
    drift: -0.3,
    shockPhase: 4.43,
    warmth: 0.32,
    stretch: 3.3,
  },
  {
    id: 438,
    x: 0.223,
    phase: 0.7984,
    speed: 0.073,
    size: 1.32,
    opacity: 0.44,
    twinkle: 5.6,
    drift: -1.3,
    shockPhase: 4.9,
    warmth: 0.85,
    stretch: 1.8,
  },
  {
    id: 439,
    x: 0.26,
    phase: 0.8596,
    speed: 0.102,
    size: 3.02,
    opacity: 0.3,
    twinkle: 3.0,
    drift: 1.8,
    shockPhase: 5.37,
    warmth: 0.37,
    stretch: 3.1,
  },
  {
    id: 440,
    x: 0.297,
    phase: 0.9208,
    speed: 0.131,
    size: 1.62,
    opacity: 0.73,
    twinkle: 5.3,
    drift: 0.8,
    shockPhase: 5.84,
    warmth: 0.9,
    stretch: 1.6,
  },
  {
    id: 441,
    x: 0.334,
    phase: 0.9819,
    speed: 0.076,
    size: 3.32,
    opacity: 0.59,
    twinkle: 2.7,
    drift: -0.2,
    shockPhase: 0.03,
    warmth: 0.42,
    stretch: 2.9,
  },
  {
    id: 442,
    x: 0.371,
    phase: 0.0431,
    speed: 0.105,
    size: 1.92,
    opacity: 0.45,
    twinkle: 5.0,
    drift: -1.2,
    shockPhase: 0.5,
    warmth: 0.95,
    stretch: 1.4,
  },
  {
    id: 443,
    x: 0.408,
    phase: 0.1043,
    speed: 0.134,
    size: 3.62,
    opacity: 0.31,
    twinkle: 7.3,
    drift: 1.9,
    shockPhase: 0.97,
    warmth: 0.47,
    stretch: 2.7,
  },
  {
    id: 444,
    x: 0.445,
    phase: 0.1655,
    speed: 0.079,
    size: 2.22,
    opacity: 0.74,
    twinkle: 4.7,
    drift: 0.9,
    shockPhase: 1.44,
    warmth: 1.0,
    stretch: 1.2,
  },
  {
    id: 445,
    x: 0.482,
    phase: 0.2267,
    speed: 0.108,
    size: 0.82,
    opacity: 0.6,
    twinkle: 7.0,
    drift: -0.1,
    shockPhase: 1.91,
    warmth: 0.52,
    stretch: 2.5,
  },
  {
    id: 446,
    x: 0.519,
    phase: 0.2879,
    speed: 0.137,
    size: 2.52,
    opacity: 0.46,
    twinkle: 4.4,
    drift: -1.1,
    shockPhase: 2.38,
    warmth: 0.04,
    stretch: 1.0,
  },
  {
    id: 447,
    x: 0.556,
    phase: 0.349,
    speed: 0.082,
    size: 1.12,
    opacity: 0.32,
    twinkle: 6.7,
    drift: 2.0,
    shockPhase: 2.85,
    warmth: 0.57,
    stretch: 2.3,
  },
  {
    id: 448,
    x: 0.593,
    phase: 0.4102,
    speed: 0.111,
    size: 2.82,
    opacity: 0.75,
    twinkle: 4.1,
    drift: 1.0,
    shockPhase: 3.32,
    warmth: 0.09,
    stretch: 0.8,
  },
  {
    id: 449,
    x: 0.63,
    phase: 0.4714,
    speed: 0.056,
    size: 1.42,
    opacity: 0.61,
    twinkle: 6.4,
    drift: 0.0,
    shockPhase: 3.79,
    warmth: 0.62,
    stretch: 2.1,
  },
  {
    id: 450,
    x: 0.667,
    phase: 0.5326,
    speed: 0.085,
    size: 3.12,
    opacity: 0.47,
    twinkle: 3.8,
    drift: -1.0,
    shockPhase: 4.26,
    warmth: 0.14,
    stretch: 3.4,
  },
  {
    id: 451,
    x: 0.704,
    phase: 0.5938,
    speed: 0.114,
    size: 1.72,
    opacity: 0.33,
    twinkle: 6.1,
    drift: -2.0,
    shockPhase: 4.73,
    warmth: 0.67,
    stretch: 1.9,
  },
  {
    id: 452,
    x: 0.741,
    phase: 0.655,
    speed: 0.059,
    size: 3.42,
    opacity: 0.76,
    twinkle: 3.5,
    drift: 1.1,
    shockPhase: 5.2,
    warmth: 0.19,
    stretch: 3.2,
  },
  {
    id: 453,
    x: 0.778,
    phase: 0.7161,
    speed: 0.088,
    size: 2.02,
    opacity: 0.62,
    twinkle: 5.8,
    drift: 0.1,
    shockPhase: 5.67,
    warmth: 0.72,
    stretch: 1.7,
  },
  {
    id: 454,
    x: 0.815,
    phase: 0.7773,
    speed: 0.117,
    size: 3.72,
    opacity: 0.48,
    twinkle: 3.2,
    drift: -0.9,
    shockPhase: 6.14,
    warmth: 0.24,
    stretch: 3.0,
  },
  {
    id: 455,
    x: 0.852,
    phase: 0.8385,
    speed: 0.062,
    size: 2.32,
    opacity: 0.34,
    twinkle: 5.5,
    drift: -1.9,
    shockPhase: 0.33,
    warmth: 0.77,
    stretch: 1.5,
  },
  {
    id: 456,
    x: 0.889,
    phase: 0.8997,
    speed: 0.091,
    size: 0.92,
    opacity: 0.2,
    twinkle: 2.9,
    drift: 1.2,
    shockPhase: 0.8,
    warmth: 0.29,
    stretch: 2.8,
  },
  {
    id: 457,
    x: 0.926,
    phase: 0.9609,
    speed: 0.12,
    size: 2.62,
    opacity: 0.63,
    twinkle: 5.2,
    drift: 0.2,
    shockPhase: 1.27,
    warmth: 0.82,
    stretch: 1.3,
  },
  {
    id: 458,
    x: 0.072,
    phase: 0.0221,
    speed: 0.065,
    size: 1.22,
    opacity: 0.49,
    twinkle: 7.5,
    drift: -0.8,
    shockPhase: 1.74,
    warmth: 0.34,
    stretch: 2.6,
  },
  {
    id: 459,
    x: 0.109,
    phase: 0.0832,
    speed: 0.094,
    size: 2.92,
    opacity: 0.35,
    twinkle: 4.9,
    drift: -1.8,
    shockPhase: 2.21,
    warmth: 0.87,
    stretch: 1.1,
  },
];
// HOO ROAD SPARKLE EFFECT BANK END

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function formatTimePrecise(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const milliseconds = Math.floor((safe - Math.floor(safe)) * 1000);

  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function cloneChart(chart: Chart): Chart {
  return {
    ...chart,
    notes: chart.notes.map((note) => ({ ...note })),
  };
}

function lowerBoundNoteTime(
  notes: RhythmNote[],
  time: number,
) {
  let low = 0;
  let high = notes.length;

  while (low < high) {
    const middle = (low + high) >> 1;

    if (notes[middle].time < time) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function notesInTimeRange(
  notes: RhythmNote[],
  startTime: number,
  endTime: number,
) {
  if (!notes.length) return [] as RhythmNote[];

  const startIndex = lowerBoundNoteTime(
    notes,
    startTime,
  );
  const endIndex = lowerBoundNoteTime(
    notes,
    endTime + 0.000001,
  );

  return notes.slice(
    startIndex,
    endIndex,
  );
}

function insertNoteSorted(
  notes: RhythmNote[],
  note: RhythmNote,
) {
  const insertIndex = lowerBoundNoteTime(
    notes,
    note.time,
  );

  let before = insertIndex - 1;

  while (
    before >= 0 &&
    note.time -
      notes[before].time <=
      0.02
  ) {
    if (
      notes[before].lane ===
        note.lane &&
      Math.abs(
        notes[before].time -
          note.time,
      ) <= 0.018
    ) {
      return null;
    }

    before -= 1;
  }

  let after = insertIndex;

  while (
    after < notes.length &&
    notes[after].time -
      note.time <=
      0.02
  ) {
    if (
      notes[after].lane ===
        note.lane &&
      Math.abs(
        notes[after].time -
          note.time,
      ) <= 0.018
    ) {
      return null;
    }

    after += 1;
  }

  const next = notes.slice();
  next.splice(
    insertIndex,
    0,
    note,
  );

  return next;
}

function findNearestPlayableNote(
  notes: RhythmNote[],
  lane: LaneKey,
  time: number,
  windowSize: number,
  hitNotes: Set<string>,
  missedNotes: Set<string>,
) {
  const startIndex = lowerBoundNoteTime(
    notes,
    time - windowSize,
  );

  let candidate: RhythmNote | null = null;
  let bestDelta = Infinity;

  for (
    let index = startIndex;
    index < notes.length;
    index += 1
  ) {
    const note = notes[index];

    if (
      note.time >
      time + windowSize
    ) {
      break;
    }

    if (
      note.lane !== lane ||
      hitNotes.has(note.id) ||
      missedNotes.has(note.id)
    ) {
      continue;
    }

    const delta = Math.abs(
      time - note.time,
    );

    if (delta < bestDelta) {
      candidate = note;
      bestDelta = delta;
    }
  }

  return {
    candidate,
    bestDelta,
  };
}

function snapTimeToGrid(
  time: number,
  bpmInput: number,
  division: SnapDivision,
  offsetInput: number,
) {
  const bpm = clamp(Number(bpmInput) || 120, 30, 300);
  const beat = 60 / bpm;
  const quantum = beat * (4 / division);
  const offset = Number(offsetInput) || 0;

  if (!Number.isFinite(quantum) || quantum <= 0) {
    return Math.max(0, time);
  }

  const relative = time - offset;
  const snapped = Math.round(relative / quantum) * quantum + offset;
  return Math.max(0, snapped);
}

async function buildWaveformData(
  buffer: ArrayBuffer,
  binCount = 420,
) {
  const Context =
    window.AudioContext ||
    (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

  if (!Context) return [] as number[];

  const context = new Context();

  try {
    const audioBuffer = await context.decodeAudioData(buffer.slice(0));
    const channels = Math.max(1, audioBuffer.numberOfChannels);
    const totalSamples = Math.max(1, audioBuffer.length);
    const bins = Math.max(80, Math.min(900, Math.floor(binCount)));
    const values = new Array<number>(bins).fill(0);

    for (let bin = 0; bin < bins; bin += 1) {
      const start = Math.floor((bin / bins) * totalSamples);
      const end = Math.max(
        start + 1,
        Math.floor(((bin + 1) / bins) * totalSamples),
      );
      const sampleStride = Math.max(1, Math.floor((end - start) / 48));
      let peak = 0;

      for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
        const channel = audioBuffer.getChannelData(channelIndex);

        for (let sample = start; sample < end; sample += sampleStride) {
          peak = Math.max(peak, Math.abs(channel[sample] || 0));
        }
      }

      values[bin] = peak;
    }

    const maximum = Math.max(...values, 0.00001);

    return values.map((value) =>
      Math.pow(clamp(value / maximum, 0, 1), 0.7),
    );
  } finally {
    void context.close();
  }
}

function idForNote(time: number, lane: LaneKey) {
  return `${time.toFixed(4)}-${lane}-${Math.random().toString(36).slice(2, 7)}`;
}

function chartStorageKey(songId: string, difficulty: Difficulty) {
  return `${STORAGE_KEY}:${songId}:${difficulty}`;
}

function fitNotesToTargetCount(
  sourceNotes: RhythmNote[],
  durationInput: number,
  difficulty: Difficulty,
  bpmInput: number,
): RhythmNote[] {
  const target = TARGET_NOTE_COUNTS[difficulty];
  const duration = Math.max(8, Number(durationInput) || 8);
  const bpm = clamp(
    Math.round(Number(bpmInput) || 120),
    50,
    240,
  );

  const start = Math.min(
    0.75,
    Math.max(0.2, duration * 0.015),
  );
  const end = Math.max(
    start + 1,
    duration - 0.35,
  );
  const range = Math.max(1, end - start);

  const seen = new Set<string>();
  const cleaned: RhythmNote[] = [];

  for (const note of sourceNotes || []) {
    if (!note || !Number.isFinite(note.time)) {
      continue;
    }

    const lane =
      normalizeLaneKey(
        (note as RhythmNote & {
          lane: unknown;
        }).lane,
      );

    if (!lane) continue;

    const time = clamp(
      Number(note.time),
      start,
      end,
    );
    const key = `${time.toFixed(4)}:${lane}`;

    if (seen.has(key)) continue;
    seen.add(key);

    cleaned.push({
      id: note.id || idForNote(time, lane),
      time,
      lane,
    });
  }

  cleaned.sort(
    (a, b) =>
      a.time - b.time ||
      LANE_INDEX[a.lane] - LANE_INDEX[b.lane],
  );

  // 분석 노트가 목표보다 많으면 곡 전체 구간을 고르게 보존하며 축소한다.
  if (cleaned.length > target) {
    const sampled: RhythmNote[] = [];

    for (let index = 0; index < target; index += 1) {
      const sourceIndex = Math.min(
        cleaned.length - 1,
        Math.floor(
          ((index + 0.5) * cleaned.length) /
            target,
        ),
      );

      sampled.push(cleaned[sourceIndex]);
    }

    return sampled.sort(
      (a, b) =>
        a.time - b.time ||
        LANE_INDEX[a.lane] -
          LANE_INDEX[b.lane],
    );
  }

  const notes = [...cleaned];
  const missing = target - notes.length;

  if (missing <= 0) return notes;

  const beat = 60 / bpm;
  const baseSubdivision =
    difficulty === "easy"
      ? 2
      : difficulty === "normal"
        ? 4
        : 8;

  // 곡이 짧거나 BPM이 느려도 목표 노트 수를 만들 수 있도록
  // 필요한 경우 자동으로 비트 세분화를 더 촘촘하게 만든다.
  const requiredSubdivision = Math.ceil(
    ((target + 24) * beat) / range,
  );
  const subdivision = Math.max(
    baseSubdivision,
    requiredSubdivision,
  );
  const gridStep = beat / subdivision;
  const gridCount = Math.max(
    target + 24,
    Math.floor(range / gridStep) + 1,
  );

  const lanePatterns: Record<
    Difficulty,
    LaneKey[]
  > = {
    easy: [
      "A",
      "K",
      "A",
      "K",
      "A",
      "K",
    ],
    normal: [
      "A",
      "K",
      "A",
      "A",
      "K",
      "A",
      "K",
      "K",
    ],
    hard: [
      "A",
      "K",
      "A",
      "K",
      "K",
      "A",
      "A",
      "K",
      "A",
      "K",
    ],
  };

  const pattern = lanePatterns[difficulty];

  const tryAdd = (
    timeInput: number,
    patternIndex: number,
  ) => {
    const time = clamp(
      timeInput,
      start,
      end,
    );

    // 같은 시간/레인 중복을 피하면서 필요하면 다른 레인을 사용한다.
    for (
      let laneOffset = 0;
      laneOffset < KEYS.length;
      laneOffset += 1
    ) {
      const lane =
        pattern[
          (patternIndex + laneOffset) %
            pattern.length
        ];

      const key = `${time.toFixed(4)}:${lane}`;

      if (seen.has(key)) continue;

      seen.add(key);
      notes.push({
        id: idForNote(time, lane),
        time,
        lane,
      });
      return true;
    }

    return false;
  };

  // 1차: BPM 기반 그리드에서 곡 전체에 고르게 보충한다.
  for (
    let index = 0;
    index < missing &&
    notes.length < target;
    index += 1
  ) {
    const normalized =
      missing <= 1
        ? 0.5
        : index / (missing - 1);

    const gridIndex = Math.min(
      gridCount - 1,
      Math.round(
        normalized * (gridCount - 1),
      ),
    );

    const time =
      start + gridIndex * gridStep;

    tryAdd(time, index);
  }

  // 2차 안전 보충:
  // 기존 분석 노트와 겹쳐 1차에서 부족해진 경우 미세한 균등 그리드로 채운다.
  let safetyIndex = 0;
  const safetyLimit = target * 12;

  while (
    notes.length < target &&
    safetyIndex < safetyLimit
  ) {
    const normalized =
      (safetyIndex + 0.5) / safetyLimit;

    const time =
      start + normalized * range;

    tryAdd(
      time,
      safetyIndex + notes.length,
    );

    safetyIndex += 1;
  }

  // 극단적으로 짧은 음원에서도 정확한 목표 개수를 보장한다.
  let emergencyIndex = 0;

  while (
    notes.length < target &&
    emergencyIndex < target * 8
  ) {
    const normalized =
      ((emergencyIndex % (target * 2)) +
        0.5) /
      (target * 2);

    const microOffset =
      Math.floor(
        emergencyIndex / (target * 2),
      ) * 0.0001;

    const time = clamp(
      start + normalized * range + microOffset,
      start,
      end,
    );

    tryAdd(
      time,
      emergencyIndex * 3,
    );

    emergencyIndex += 1;
  }

  return notes
    .slice(0, target)
    .sort(
      (a, b) =>
        a.time - b.time ||
        LANE_INDEX[a.lane] -
          LANE_INDEX[b.lane],
    );
}

function hasSavedChart(songId: string, difficulty: Difficulty) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(chartStorageKey(songId, difficulty)) !== null;
}

function defaultChart(
  song: Song,
  _difficulty: Difficulty,
): Chart {
  return {
    bpm: song.bpm,
    offset: 0,
    notes: [],
  };
}

function loadChart(
  song: Song,
  difficulty: Difficulty,
): Chart {
  if (typeof window === "undefined") {
    return defaultChart(song, difficulty);
  }

  try {
    const raw = window.localStorage.getItem(
      chartStorageKey(
        song.id,
        difficulty,
      ),
    );

    if (!raw) {
      return defaultChart(song, difficulty);
    }

    const parsed = JSON.parse(raw) as {
      bpm?: unknown;
      offset?: unknown;
      notes?: unknown;
      analyzedAt?: unknown;
    };

    if (!Array.isArray(parsed.notes)) {
      return defaultChart(song, difficulty);
    }

    const notes: RhythmNote[] = [];
    const seen = new Set<string>();

    for (const rawNote of parsed.notes) {
      if (
        !rawNote ||
        typeof rawNote !== "object"
      ) {
        continue;
      }

      const source = rawNote as {
        id?: unknown;
        time?: unknown;
        lane?: unknown;
        duration?: unknown;
      };

      const lane = normalizeLaneKey(source.lane);
      const time = Number(source.time);
      const holdDuration = Number(source.duration);

      if (!lane || !Number.isFinite(time)) {
        continue;
      }

      const duplicateKey =
        `${time.toFixed(4)}:${lane}`;

      if (seen.has(duplicateKey)) continue;
      seen.add(duplicateKey);

      notes.push({
        id:
          typeof source.id === "string" &&
          source.id
            ? source.id
            : idForNote(time, lane),
        time,
        lane,
        duration:
          Number.isFinite(holdDuration) && holdDuration > 0.04
            ? holdDuration
            : undefined,
      });
    }

    notes.sort(
      (a, b) =>
        a.time - b.time ||
        LANE_INDEX[a.lane] -
          LANE_INDEX[b.lane],
    );

    return {
      bpm: Number(parsed.bpm) || song.bpm,
      offset: Number(parsed.offset) || 0,
      notes,
      analyzedAt:
        typeof parsed.analyzedAt === "string"
          ? parsed.analyzedAt
          : undefined,
    };
  } catch {
    return defaultChart(song, difficulty);
  }
}

function saveChart(songId: string, difficulty: Difficulty, chart: Chart) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(chartStorageKey(songId, difficulty), JSON.stringify(chart));
}

function loadBest(songId: string, difficulty: Difficulty) {
  if (typeof window === "undefined") return { score: 0, combo: 0 };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BEST_KEY) || "{}") as Record<
      string,
      { score: number; combo: number }
    >;
    return parsed[`${songId}:${difficulty}`] || { score: 0, combo: 0 };
  } catch {
    return { score: 0, combo: 0 };
  }
}

function saveBest(songId: string, difficulty: Difficulty, result: ResultStats) {
  if (typeof window === "undefined") return;
  let parsed: Record<string, { score: number; combo: number }> = {};
  try {
    parsed = JSON.parse(window.localStorage.getItem(BEST_KEY) || "{}");
  } catch {
    parsed = {};
  }
  const key = `${songId}:${difficulty}`;
  const before = parsed[key] || { score: 0, combo: 0 };
  parsed[key] = {
    score: Math.max(before.score, result.score),
    combo: Math.max(before.combo, result.maxCombo),
  };
  window.localStorage.setItem(BEST_KEY, JSON.stringify(parsed));
}

function loadSongCovers(): Record<string, SongCoverAsset> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(COVER_KEY) || "{}") as Record<
      string,
      SongCoverAsset
    >;
  } catch {
    return {};
  }
}

function saveSongCovers(covers: Record<string, SongCoverAsset>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COVER_KEY, JSON.stringify(covers));
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("이미지를 읽지 못했습니다."));
    };
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 해석하지 못했습니다."));
    image.src = src;
  });
}

async function optimizeCoverImage(file: File) {
  const source = await readImageFile(file);
  const image = await loadImageElement(source);

  const MAX_WIDTH = 1400;
  const MAX_HEIGHT = 1750;
  const baseScale = Math.min(
    1,
    MAX_WIDTH / Math.max(1, image.naturalWidth),
    MAX_HEIGHT / Math.max(1, image.naturalHeight),
  );

  const render = (scaleMultiplier: number, quality: number) => {
    const width = Math.max(
      1,
      Math.round(image.naturalWidth * baseScale * scaleMultiplier),
    );
    const height = Math.max(
      1,
      Math.round(image.naturalHeight * baseScale * scaleMultiplier),
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("커버 이미지를 처리하지 못했습니다.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/webp", quality);
  };

  let optimized = render(1, 0.86);

  // localStorage를 과도하게 차지하지 않도록 큰 이미지는 한 번 더 압축한다.
  if (optimized.length > 1_250_000) {
    optimized = render(0.82, 0.78);
  }

  if (optimized.length > 1_650_000) {
    optimized = render(0.68, 0.72);
  }

  return optimized;
}

async function analyzeAudioFile(file: File) {
  const buffer = await file.arrayBuffer();
  const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) throw new Error("이 브라우저는 Web Audio API를 지원하지 않습니다.");
  const ctx = new Context();
  try {
    const audio = await ctx.decodeAudioData(buffer.slice(0));
    const sampleRate = audio.sampleRate;
    const channel = audio.getChannelData(0);
    const hop = 1024;
    const windowSize = 2048;
    const energies: number[] = [];

    for (let start = 0; start + windowSize < channel.length; start += hop) {
      let sum = 0;
      for (let i = start; i < start + windowSize; i += 4) {
        const value = channel[i];
        sum += value * value;
      }
      energies.push(Math.sqrt(sum / (windowSize / 4)));
    }

    const novelty: number[] = new Array(energies.length).fill(0);
    for (let i = 1; i < energies.length; i++) {
      novelty[i] = Math.max(0, energies[i] - energies[i - 1]);
    }

    const sorted = novelty.slice().sort((a, b) => a - b);
    const threshold = sorted[Math.floor(sorted.length * 0.88)] || 0;
    const rawOnsets: { time: number; strength: number }[] = [];
    let lastTime = -1;
    for (let i = 2; i < novelty.length - 2; i++) {
      const value = novelty[i];
      if (
        value > threshold &&
        value >= novelty[i - 1] &&
        value >= novelty[i + 1]
      ) {
        const time = (i * hop) / sampleRate;
        if (time - lastTime >= 0.09) {
          rawOnsets.push({ time, strength: value });
          lastTime = time;
        }
      }
    }

    const candidates: number[] = [];
    for (let i = 1; i < rawOnsets.length; i++) {
      const delta = rawOnsets[i].time - rawOnsets[i - 1].time;
      if (delta >= 0.24 && delta <= 1.2) {
        let bpm = 60 / delta;
        while (bpm < 70) bpm *= 2;
        while (bpm > 190) bpm /= 2;
        candidates.push(bpm);
      }
    }

    let bpm = 120;
    if (candidates.length) {
      const histogram = new Map<number, number>();
      for (const candidate of candidates) {
        const bucket = Math.round(candidate / 2) * 2;
        histogram.set(bucket, (histogram.get(bucket) || 0) + 1);
      }
      bpm = [...histogram.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    const maxStrength = Math.max(...rawOnsets.map((item) => item.strength), 0.0001);
    return {
      bpm,
      duration: audio.duration,
      onsets: rawOnsets.map((item) => ({
        time: item.time,
        strength: item.strength / maxStrength,
      })),
    };
  } finally {
    void ctx.close();
  }
}

function buildChartFromAnalysis(
  analysis: {
    bpm: number;
    duration?: number;
    onsets: { time: number; strength: number }[];
  },
  difficulty: Difficulty,
): Chart {
  const threshold = difficulty === "easy" ? 0.58 : difficulty === "normal" ? 0.38 : 0.22;
  const minGap = difficulty === "easy" ? 0.34 : difficulty === "normal" ? 0.2 : 0.11;
  const beat = 60 / analysis.bpm;
  const quantum = difficulty === "hard" ? beat / 4 : beat / 2;
  const notes: RhythmNote[] = [];
  let lastTime = -10;
  let laneSeed = 0;

  for (const onset of analysis.onsets) {
    if (onset.strength < threshold) continue;
    const snapped = Math.max(0, Math.round(onset.time / quantum) * quantum);
    if (snapped - lastTime < minGap) continue;
    const lane = KEYS[(laneSeed * 3 + Math.floor(snapped / beat)) % KEYS.length];
    notes.push({ id: idForNote(snapped, lane), time: snapped, lane });
    laneSeed += 1;
    lastTime = snapped;

    if (
      difficulty === "hard" &&
      onset.strength > 0.86 &&
      laneSeed % 6 === 0
    ) {
      const secondLane =
        KEYS[
          (LANE_INDEX[lane] + 1) %
            KEYS.length
        ];

      notes.push({
        id: idForNote(
          snapped,
          secondLane,
        ),
        time: snapped,
        lane: secondLane,
      });
    }
  }

  const duration =
    Math.max(
      8,
      Number(analysis.duration) ||
        (analysis.onsets.length
          ? analysis.onsets[
              analysis.onsets.length - 1
            ].time + 1
          : 180),
    );

  return {
    bpm: analysis.bpm,
    offset: 0,
    notes: fitNotesToTargetCount(
      notes,
      duration,
      difficulty,
      analysis.bpm,
    ),
    analyzedAt: new Date().toISOString(),
  };
}

type ChartCheckResult = {
  ok: boolean;
  noteCount: number;
  invalidCount: number;
  duplicateCount: number;
  density: number;
  message: string;
};

function checkChartQuality(
  chart: Chart,
  duration: number,
  difficulty: Difficulty,
): ChartCheckResult {
  const safeDuration = Math.max(1, Number(duration) || 1);
  const seen = new Set<string>();
  let invalidCount = 0;
  let duplicateCount = 0;
  let validCount = 0;

  for (const note of chart.notes) {
    if (
      !note ||
      !KEYS.includes(note.lane) ||
      !Number.isFinite(note.time) ||
      note.time < 0 ||
      note.time > safeDuration + 0.75
    ) {
      invalidCount += 1;
      continue;
    }

    const key = `${note.time.toFixed(4)}:${note.lane}`;
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(key);
    validCount += 1;
  }

  const density = validCount / safeDuration;
  const target = TARGET_NOTE_COUNTS[difficulty];

  const ok =
    validCount === target &&
    invalidCount === 0 &&
    duplicateCount === 0 &&
    Number.isFinite(chart.bpm) &&
    chart.bpm >= 50 &&
    chart.bpm <= 240;

  const issues: string[] = [];
  if (validCount !== target) {
    issues.push(
      `노트 수 ${validCount}/${target}`,
    );
  }
  if (invalidCount) issues.push(`비정상 노트 ${invalidCount}`);
  if (duplicateCount) issues.push(`중복 노트 ${duplicateCount}`);
  if (!Number.isFinite(chart.bpm) || chart.bpm < 50 || chart.bpm > 240) {
    issues.push(`BPM 비정상 ${Math.round(chart.bpm || 0)}`);
  }

  return {
    ok,
    noteCount: validCount,
    invalidCount,
    duplicateCount,
    density,
    message: ok ? "PASS" : issues.join(" · "),
  };
}

function sanitizeChart(
  chart: Chart,
  duration: number,
  fallbackBpm: number,
): Chart {
  const safeDuration = Math.max(1, Number(duration) || 1);
  const seen = new Set<string>();
  const notes: RhythmNote[] = [];

  for (const note of chart.notes || []) {
    if (
      !note ||
      !Number.isFinite(note.time) ||
      note.time < 0 ||
      note.time > safeDuration + 0.75
    ) {
      continue;
    }

    const lane =
      normalizeLaneKey(
        (note as RhythmNote & {
          lane: unknown;
        }).lane,
      );

    if (!lane) continue;

    const time = Math.max(
      0,
      Math.min(
        safeDuration,
        Number(note.time),
      ),
    );

    const duplicateKey =
      `${time.toFixed(4)}:${lane}`;

    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);

    const holdDuration = Number(note.duration);

    notes.push({
      id: note.id || idForNote(time, lane),
      time,
      lane,
      duration:
        Number.isFinite(holdDuration) && holdDuration > 0.04
          ? Math.min(holdDuration, Math.max(0, safeDuration - time))
          : undefined,
    });
  }

  notes.sort(
    (a, b) =>
      a.time - b.time ||
      LANE_INDEX[a.lane] - LANE_INDEX[b.lane],
  );

  const bpm =
    Number.isFinite(chart.bpm) && chart.bpm >= 50 && chart.bpm <= 240
      ? chart.bpm
      : fallbackBpm;

  return {
    bpm,
    offset: Number(chart.offset) || 0,
    notes,
    analyzedAt: chart.analyzedAt,
  };
}

function buildFullLengthFallbackChart(
  bpmInput: number,
  durationInput: number,
  difficulty: Difficulty,
): Chart {
  const bpm = clamp(
    Math.round(Number(bpmInput) || 120),
    60,
    220,
  );
  const duration = Math.max(
    8,
    Number(durationInput) || 8,
  );

  return {
    bpm,
    offset: 0,
    notes: fitNotesToTargetCount(
      [],
      duration,
      difficulty,
      bpm,
    ),
    analyzedAt: new Date().toISOString(),
  };
}

function ensurePlayableChart(
  chart: Chart,
  duration: number,
  difficulty: Difficulty,
  fallbackBpm: number,
) {
  const cleaned = sanitizeChart(
    chart,
    duration,
    fallbackBpm,
  );
  const before = checkChartQuality(
    cleaned,
    duration,
    difficulty,
  );

  const fittedChart: Chart = {
    ...cleaned,
    notes: fitNotesToTargetCount(
      cleaned.notes,
      duration,
      difficulty,
      cleaned.bpm || fallbackBpm,
    ),
  };

  const check = checkChartQuality(
    fittedChart,
    duration,
    difficulty,
  );

  return {
    chart: fittedChart,
    check,
    repaired:
      cleaned.notes.length !==
      TARGET_NOTE_COUNTS[difficulty],
    before,
  };
}

function inferAudioContentType(file: File) {
  const type =
    (file.type || "")
      .toLowerCase();

  const extension =
    safeStorageName(
      file.name,
    )
      .split(".")
      .pop()
      ?.toLowerCase() ||
    "";

  // 확장자를 먼저 본다.
  // 브라우저는 .mp4 파일을 보통 video/mp4로 넘기지만,
  // HOO RHYTHM에서는 영상 컨테이너의 오디오 트랙을 음원으로 사용한다.
  // Supabase 버킷의 audio/mp4 허용 규칙과 맞추기 위해 audio/mp4로 저장한다.
  if (extension === "mp4") {
    return "audio/mp4";
  }

  if (extension === "m4a") {
    return "audio/mp4";
  }

  if (extension === "mp3") {
    return "audio/mpeg";
  }

  if (extension === "wav") {
    return "audio/wav";
  }

  if (extension === "aac") {
    return "audio/aac";
  }

  if (extension === "flac") {
    return "audio/flac";
  }

  if (
    extension === "ogg" ||
    extension === "oga"
  ) {
    return "audio/ogg";
  }

  if (extension === "opus") {
    return "audio/opus";
  }

  if (extension === "webm") {
    return "audio/webm";
  }

  if (
    extension === "aif" ||
    extension === "aiff"
  ) {
    return "audio/aiff";
  }

  // 확장자가 없거나 모호한 경우에만 브라우저 MIME 사용.
  if (
    type.startsWith("audio/")
  ) {
    return type;
  }

  if (type === "video/mp4") {
    return "audio/mp4";
  }

  if (type === "video/webm") {
    return "audio/webm";
  }

  return "application/octet-stream";
}


export default function HooRhythmGame({ onExit, onRecordSaved }: HooRhythmGameProps) {
  const supabase = useMemo(() => createClient(), []);
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [songId, setSongId] = useState(SONGS[0].id);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [chart, setChart] = useState<Chart>(() => defaultChart(SONGS[0], "normal"));
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string>("");
  const [songCovers, setSongCovers] = useState<Record<string, SongCoverAsset>>({});
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverMessage, setCoverMessage] = useState("");
  const [duration, setDuration] = useState(SONGS[0].duration);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pressed, setPressed] = useState<Set<LaneKey>>(new Set());
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [stats, setStats] = useState<ResultStats>({
    score: 0,
    maxCombo: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
  });
  const [hitNotes, setHitNotes] = useState<Set<string>>(new Set());
  const [missedNotes, setMissedNotes] = useState<Set<string>>(new Set());
  const [best, setBest] = useState({ score: 0, combo: 0 });
  const [playImpactFx, setPlayImpactFx] = useState<PlayImpactFx | null>(null);
  const [playComboMilestone, setPlayComboMilestone] =
    useState<PlayComboMilestoneFx | null>(null);
  const [selectedEditorNoteId, setSelectedEditorNoteId] = useState<string | null>(null);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedEditorNoteIds, setSelectedEditorNoteIds] = useState<Set<string>>(new Set());
  const [publishedSongs, setPublishedSongs] = useState<PublishedSongRow[]>([]);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMessage, setCloudMessage] = useState("");
  const [playBusy, setPlayBusy] = useState(false);
  const [songSyncState, setSongSyncState] = useState<
    "idle" | "syncing" | "published" | "missing" | "error"
  >("idle");
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [publishStage, setPublishStage] = useState("");
  const [chartCheckMessage, setChartCheckMessage] = useState("");
  const [publishTitle, setPublishTitle] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [pendingAudioSongId, setPendingAudioSongId] = useState<string | null>(null);

  // Manual editor workspace state
  const [editorTool, setEditorTool] = useState<EditorTool>("select");
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [snapDivision, setSnapDivision] = useState<SnapDivision>(16);
  const [showBeatGrid, setShowBeatGrid] = useState(true);
  const [showWaveform, setShowWaveform] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [editorVolume, setEditorVolume] = useState(0.9);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [editorDirty, setEditorDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [noteListFilter, setNoteListFilter] = useState<NoteListFilter>("all");
  const [noteListScope, setNoteListScope] = useState<NoteListScope>("nearby");
  const [noteListPage, setNoteListPage] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(8);
  const [editorNotice, setEditorNotice] = useState(
    "진행바에서 원하는 위치로 이동한 뒤 A/K를 눌러 직접 노트를 기록하세요.",
  );

  const [draftBusy, setDraftBusy] = useState(false);
  const [libraryActionBusyId, setLibraryActionBusyId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playBackgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const playTrailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const playTrailTierRef = useRef<PlayTrailTier>(0);
  const playTrailTierEnteredAtRef = useRef(0);
  const playTrailFrameRef = useRef<number | null>(null);
  const playTrailLastDrawAtRef = useRef(0);
  const playTrailCostEmaRef = useRef(0);
  const playTrailQualityRef = useRef(1);
  const playTrailCanvasSizeRef = useRef({
    width: 0,
    height: 0,
    dpr: 1,
  });
  const hitNotesRef = useRef<Set<string>>(new Set());
  const missedNotesRef = useRef<Set<string>>(new Set());
  const frameRef = useRef<number | null>(null);
  const judgmentTimerRef = useRef<number | null>(null);
  const playImpactTimerRef = useRef<number | null>(null);
  const playImpactSerialRef = useRef(0);
  const playImpactFxRef = useRef<PlayImpactFx | null>(null);
  const comboMilestoneTimerRef = useRef<number | null>(null);
  const comboMilestoneSerialRef = useRef(0);
  const comboRef = useRef(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const coverFileRef = useRef<HTMLInputElement | null>(null);
  const undoStackRef = useRef<Chart[]>([]);
  const redoStackRef = useRef<Chart[]>([]);
  const waveformSourceRef = useRef<string | null>(null);
  const localAudioSessionSongRef = useRef<string | null>(null);
  const mediaDurationRef = useRef<{
    source: string | null;
    duration: number;
  }>({
    source: null,
    duration: 0,
  });
  const lastUiUpdateAtRef = useRef(0);
  const missCursorRef = useRef(0);
  const chartPersistTimerRef = useRef<number | null>(null);
  const pendingChartPersistRef = useRef<{
    songId: string;
    difficulty: Difficulty;
    chart: Chart;
  } | null>(null);
  const activeHoldRef = useRef<
    Partial<Record<LaneKey, { noteId: string; endTime: number }>>
  >({});

  const restoredDraftSongRef = useRef<string | null>(null);

  const publishedSongMap = useMemo(() => {
    const map: Record<string, PublishedSongRow> = {};
    for (const item of publishedSongs) map[item.song_id] = item;
    return map;
  }, [publishedSongs]);

  const availableSongs = useMemo(
    () =>
      publishedSongs
        .filter((published) => {
          if (!published?.published) return false;
          if (!published.audio_url) return false;

          const easyNotes = published.charts?.easy?.notes;
          const normalNotes = published.charts?.normal?.notes;
          const hardNotes = published.charts?.hard?.notes;

          return (
            Array.isArray(easyNotes) &&
            easyNotes.length > 0 &&
            Array.isArray(normalNotes) &&
            normalNotes.length > 0 &&
            Array.isArray(hardNotes) &&
            hardNotes.length > 0
          );
        })
        .map((published) => ({
          id: published.song_id,
          title: published.title || "UNTITLED",
          subtitle:
            published.subtitle || "HOO RHYTHM OFFICIAL TRACK",
          genre: published.genre || "HOO RHYTHM",
          bpm: Number(published.bpm) || 120,
          duration: Number(published.duration) || 1,
          coverUrl: published.cover_url || undefined,
        })),
    [publishedSongs],
  );

  // 관리자 작업실의 로컬 초안 편집용 슬롯.
  // 플레이어 곡 목록에는 사용하지 않는다.
  const adminDraftSong = useMemo(
    () => SONGS.find((item) => item.id === songId) || SONGS[0],
    [songId],
  );

  const song = useMemo(
    () =>
      availableSongs.find((item) => item.id === songId) ||
      availableSongs[0] ||
      adminDraftSong,
    [adminDraftSong, availableSongs, songId],
  );

  const currentPublishedSong = publishedSongMap[song.id] || null;

  const rememberMediaDuration = useCallback(
    (
      rawDuration: number,
      sourceOverride?: string | null,
    ) => {
      const nextDuration =
        Number(rawDuration);

      if (
        !Number.isFinite(nextDuration) ||
        nextDuration <= 0
      ) {
        return;
      }

      const source =
        sourceOverride ||
        audioRef.current?.currentSrc ||
        audioRef.current?.src ||
        audioUrl ||
        null;

      mediaDurationRef.current = {
        source,
        duration: nextDuration,
      };

      setDuration(nextDuration);
    },
    [audioUrl],
  );

  const getEffectiveDuration = useCallback(() => {
    const liveDuration =
      Number(
        audioRef.current?.duration,
      );

    if (
      Number.isFinite(liveDuration) &&
      liveDuration > 0
    ) {
      return liveDuration;
    }

    const remembered =
      mediaDurationRef.current;

    if (
      remembered.duration > 0 &&
      (
        !audioUrl ||
        !remembered.source ||
        remembered.source === audioUrl ||
        remembered.source ===
          audioRef.current?.currentSrc ||
        remembered.source ===
          audioRef.current?.src
      )
    ) {
      return remembered.duration;
    }

    return Math.max(
      1,
      Number(duration) || 1,
    );
  }, [
    audioUrl,
    duration,
  ]);

  useEffect(() => {
    setPublishTitle(
      currentPublishedSong?.title || song.title,
    );
  }, [
    currentPublishedSong?.title,
    song.id,
    song.title,
  ]);

  useEffect(() => {
    if (screen !== "select" && screen !== "detail") return;
    if (availableSongs.length === 0) return;

    const exists = availableSongs.some(
      (item) => item.id === songId,
    );

    if (!exists) {
      setSongId(availableSongs[0].id);
    }
  }, [availableSongs, screen, songId]);
  const currentLocalCover = songCovers[song.id] || null;
  const currentCover: SongCoverAsset | null = currentLocalCover
    ? currentLocalCover
    : currentPublishedSong?.cover_url
      ? {
          dataUrl: currentPublishedSong.cover_url,
          fileName: "공개 커버 이미지",
          updatedAt: currentPublishedSong.updated_at,
        }
      : null;

  const refreshPublishedSongs = useCallback(async () => {
    setCloudBusy(true);

    try {
      const { data, error } = await supabase
        .from(RHYTHM_TABLE)
        .select(
          "song_id,title,subtitle,genre,bpm,duration,audio_path,audio_url,cover_path,cover_url,charts,published,sort_order,published_by,published_at,updated_at",
        )
        .eq("published", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const rows = ((data || []) as PublishedSongRow[]).filter(
        (row) => row.published === true,
      );

      setPublishedSongs(rows);

      setCloudMessage(
        rows.length === 0
          ? "아직 송출된 공식 곡이 없습니다."
          : "",
      );
    } catch (error) {
      setPublishedSongs([]);
      setCloudMessage(
        error instanceof Error
          ? `공식 곡 목록을 불러오지 못했습니다. · ${error.message}`
          : "공식 곡 목록을 불러오지 못했습니다.",
      );
    } finally {
      setCloudBusy(false);
    }
  }, [supabase]);

  const syncPublishedSong = useCallback(
    async (
      targetSongId: string,
      options?: { silent?: boolean },
    ): Promise<PublishedSongRow | null> => {
      setSongSyncState("syncing");

      try {
        const { data, error } = await supabase
          .from(RHYTHM_TABLE)
          .select(
            "song_id,title,subtitle,genre,bpm,duration,audio_path,audio_url,cover_path,cover_url,charts,published,sort_order,published_by,published_at,updated_at",
          )
          .eq("song_id", targetSongId)
          .eq("published", true)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          setSongSyncState("missing");

          if (!options?.silent) {
            setCloudMessage(
              "이 곡은 아직 공식 송출 상태가 아닙니다.",
            );
          }

          return null;
        }

        const row = data as PublishedSongRow;

        setPublishedSongs((previous) => {
          const next = previous.filter(
            (item) => item.song_id !== row.song_id,
          );
          next.push(row);
          return next.sort(
            (a, b) =>
              Number(a.sort_order || 0) -
              Number(b.sort_order || 0),
          );
        });

        setSongSyncState("published");

        if (!options?.silent) setCloudMessage("");

        return row;
      } catch (error) {
        setSongSyncState("error");

        if (!options?.silent) {
          setCloudMessage(
            error instanceof Error
              ? `공개 곡 동기화 실패 · ${error.message}`
              : "공개 곡 동기화에 실패했습니다.",
          );
        }

        return null;
      }
    },
    [supabase],
  );

  const refreshAdminStatus = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from(RHYTHM_ADMIN_TABLE)
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setIsAdmin(Boolean(data?.user_id));
    } catch {
      setIsAdmin(false);
    } finally {
      setAdminChecked(true);
    }
  }, [supabase]);

  useEffect(() => {
    setMounted(true);
    setSongCovers(loadSongCovers());
    void refreshPublishedSongs();
    void refreshAdminStatus();
  }, [refreshAdminStatus, refreshPublishedSongs]);


  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshAdminStatus();
    });

    return () => subscription.unsubscribe();
  }, [refreshAdminStatus, supabase]);

  useEffect(() => {
    if (screen !== "select" && screen !== "detail") return;

    void syncPublishedSong(song.id, {
      silent: true,
    });
  }, [screen, song.id, syncPublishedSong]);


  useEffect(() => {
    if (screen !== "detail") return;
    if (!currentPublishedSong?.published) return;
    if (!currentPublishedSong.audio_url) return;

    const publishedChart =
      currentPublishedSong.charts?.[difficulty];

    if (
      publishedChart &&
      Array.isArray(publishedChart.notes) &&
      publishedChart.notes.length > 0
    ) {
      const officialSong: Song = {
        id: currentPublishedSong.song_id,
        title: currentPublishedSong.title || song.title,
        subtitle:
          currentPublishedSong.subtitle || song.subtitle,
        genre: currentPublishedSong.genre || song.genre,
        bpm:
          Number(currentPublishedSong.bpm) ||
          song.bpm,
        duration:
          Number(currentPublishedSong.duration) ||
          song.duration,
        coverUrl:
          currentPublishedSong.cover_url || undefined,
      };

      const normalized = normalizePublishedChart(
        publishedChart,
        officialSong,
        difficulty,
      );

      setChart(normalized);
      setDuration(
        Number(currentPublishedSong.duration) ||
          song.duration,
      );
    }

    setAudioUrl(currentPublishedSong.audio_url);
    setAudioName(
      currentPublishedSong.audio_path?.split("/").pop() ||
        `${currentPublishedSong.title || song.title}.audio`,
    );

    const audio = audioRef.current;

    if (audio) {
      const resolved = new URL(
        currentPublishedSong.audio_url,
        window.location.href,
      ).href;

      if (audio.src !== resolved) {
        audio.src = currentPublishedSong.audio_url;
        audio.load();
      }
    }
  }, [
    currentPublishedSong,
    difficulty,
    screen,
    song,
  ]);

  useEffect(() => {
    if (
      !mounted ||
      screen !== "editor"
    ) {
      return;
    }

    if (
      restoredDraftSongRef.current ===
      song.id
    ) {
      return;
    }

    const draft =
      loadEditorDraftMetadata(
        song.id,
      );

    if (!draft) {
      restoredDraftSongRef.current =
        song.id;
      return;
    }

    let cancelled = false;

    const restore = async () => {
      try {
        for (const level of [
          "easy",
          "normal",
          "hard",
        ] as Difficulty[]) {
          const savedChart =
            draft.charts?.[level];

          if (savedChart) {
            saveChart(
              song.id,
              level,
              savedChart,
            );
          }
        }

        if (cancelled) return;

        setPublishTitle(
          draft.title ||
            currentPublishedSong?.title ||
            song.title,
        );
        setDuration(
          Math.max(
            1,
            Number(draft.duration) ||
              song.duration,
          ),
        );
        setDifficulty(
          draft.difficulty ||
            "normal",
        );
        setCurrentTime(
          Math.max(
            0,
            Number(
              draft.currentTime,
            ) || 0,
          ),
        );

        const restoredChart =
          draft.charts?.[
            draft.difficulty ||
              "normal"
          ];

        if (restoredChart) {
          setChart(
            cloneChart(
              restoredChart,
            ),
          );
        }

        if (
          draft.hasLocalAudio
        ) {
          const restoredFile =
            await loadDraftAudioFile(
              song.id,
            );

          if (
            restoredFile &&
            !cancelled
          ) {
            setAudioUrl(
              (previous) => {
                if (
                  previous?.startsWith(
                    "blob:",
                  )
                ) {
                  URL.revokeObjectURL(
                    previous,
                  );
                }

                return URL.createObjectURL(
                  restoredFile,
                );
              },
            );

            setAudioName(
              restoredFile.name,
            );
            setPendingAudioFile(
              restoredFile,
            );
            setPendingAudioSongId(
              song.id,
            );
          }
        } else if (
          currentPublishedSong?.audio_url
        ) {
          setAudioUrl(
            currentPublishedSong.audio_url,
          );
          setAudioName(
            currentPublishedSong.audio_path
              ?.split("/")
              .pop() ||
              draft.audioName ||
              `${song.title}.audio`,
          );
        }

        if (cancelled) return;

        const savedAt =
          new Date(
            draft.savedAt,
          ).toLocaleTimeString(
            "ko-KR",
            {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            },
          );

        setLastSavedAt(savedAt);
        setEditorDirty(false);
        setEditorNotice(
          `저장된 작업을 불러왔습니다 · ${savedAt} · ${draft.difficulty.toUpperCase()} 이어서 작업`,
        );
        restoredDraftSongRef.current =
          song.id;
      } catch (error) {
        if (cancelled) return;

        setEditorNotice(
          error instanceof Error
            ? `저장된 작업 불러오기 실패 · ${error.message}`
            : "저장된 작업을 불러오지 못했습니다.",
        );
        restoredDraftSongRef.current =
          song.id;
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [
    currentPublishedSong,
    mounted,
    screen,
    song,
  ]);

  useEffect(() => {
    hitNotesRef.current = hitNotes;
  }, [hitNotes]);

  useEffect(() => {
    missedNotesRef.current = missedNotes;
  }, [missedNotes]);

  useEffect(() => {
    const published = publishedSongMap[song.id];
    const publishedChart = published?.charts?.[difficulty];
    const hasPendingAudioForSong =
      (
        pendingAudioSongId === song.id &&
        Boolean(pendingAudioFile)
      ) ||
      localAudioSessionSongRef.current === song.id;

    if (screen === "editor") {
      // 새 음원을 등록한 순간부터는 서버의 이전 공개 채보를 자동 복원하지 않는다.
      // 로컬에 저장된 수동 채보(새 음원 등록 시 빈 채보로 초기화됨)만 사용한다.
      if (hasPendingAudioForSong) {
        setChart(loadChart(song, difficulty));
      } else if (publishedChart && !hasSavedChart(song.id, difficulty)) {
        const officialChart = normalizePublishedChart(
          publishedChart,
          song,
          difficulty,
        );
        saveChart(song.id, difficulty, officialChart);
        setChart(officialChart);
      } else {
        setChart(loadChart(song, difficulty));
      }
    } else if (publishedChart) {
      setChart(normalizePublishedChart(publishedChart, song, difficulty));
    } else {
      setChart(loadChart(song, difficulty));
    }

    setBest(loadBest(song.id, difficulty));

    const fallbackDuration =
      Number(published?.duration) ||
      song.duration;

    const rememberedDuration =
      mediaDurationRef.current;

    const currentSource =
      hasPendingAudioForSong
        ? audioUrl
        : published?.audio_url ||
          audioUrl;

    const hasMatchingRememberedDuration =
      rememberedDuration.duration > 0 &&
      (
        !currentSource ||
        !rememberedDuration.source ||
        rememberedDuration.source ===
          currentSource
      );

    if (hasMatchingRememberedDuration) {
      setDuration(
        rememberedDuration.duration,
      );
    } else if (!hasPendingAudioForSong) {
      setDuration(
        fallbackDuration,
      );
    }

    setCurrentTime(0);
    setCoverMessage("");

    if (screen === "editor") {
      setEditorDirty(false);
      setSelectedEditorNoteId(null);
      setSelectedEditorNoteIds(new Set());
      setBulkDeleteMode(false);
      undoStackRef.current = [];
      redoStackRef.current = [];
    }

    if (!hasPendingAudioForSong) {
      setAudioUrl((previous) => {
        if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
        return published?.audio_url || null;
      });
      setAudioName(
        published?.audio_path
          ? published.audio_path.split("/").pop() || `${song.title}.audio`
          : "",
      );
    }
  }, [
    difficulty,
    pendingAudioFile,
    pendingAudioSongId,
    publishedSongMap,
    screen,
    song,
    audioUrl,
  ]);

  useEffect(() => {
    const remembered =
      mediaDurationRef.current;

    if (
      remembered.source &&
      audioUrl &&
      remembered.source !== audioUrl
    ) {
      mediaDurationRef.current = {
        source: null,
        duration: 0,
      };
    }
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (audioUrl?.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (judgmentTimerRef.current !== null) window.clearTimeout(judgmentTimerRef.current);
      if (playImpactTimerRef.current !== null) {
        window.clearTimeout(playImpactTimerRef.current);
      }
      if (comboMilestoneTimerRef.current !== null) {
        window.clearTimeout(comboMilestoneTimerRef.current);
      }
      if (chartPersistTimerRef.current !== null) {
        window.clearTimeout(chartPersistTimerRef.current);
      }
    };
  }, [audioUrl]);


  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = playbackRate;
    audio.volume = editorVolume;
  }, [editorVolume, playbackRate, audioUrl]);

  useEffect(() => {
    if (screen !== "editor" || !audioUrl) {
      if (!audioUrl) {
        setWaveform([]);
        waveformSourceRef.current = null;
      }
      return;
    }

    if (waveformSourceRef.current === audioUrl && waveform.length) return;

    let cancelled = false;
    waveformSourceRef.current = audioUrl;

    void (async () => {
      try {
        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error("waveform fetch failed");
        const buffer = await response.arrayBuffer();
        const nextWaveform = await buildWaveformData(buffer, 400);

        if (!cancelled) {
          setWaveform(nextWaveform);
        }
      } catch {
        if (!cancelled) {
          setWaveform([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioUrl, screen, waveform.length]);

  const flashJudgment = useCallback((next: Judgment) => {
    setJudgment(next);
    if (judgmentTimerRef.current !== null) window.clearTimeout(judgmentTimerRef.current);
    judgmentTimerRef.current = window.setTimeout(() => setJudgment(null), 420);
  }, []);

  const triggerPlayImpact = useCallback(
    (
      lane: LaneKey | null,
      nextJudgment: Judgment,
      deltaMs: number,
      nextCombo: number,
    ) => {
      playImpactSerialRef.current += 1;

      const impact: PlayImpactFx = {
        id: playImpactSerialRef.current,
        lane,
        judgment: nextJudgment,
        deltaMs,
        combo: nextCombo,
        createdAt:
          typeof performance !== "undefined"
            ? performance.now()
            : Date.now(),
      };

      setPlayImpactFx(impact);
      playImpactFxRef.current = impact;

      if (
        playImpactTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          playImpactTimerRef.current,
        );
      }

      playImpactTimerRef.current =
        window.setTimeout(() => {
          setPlayImpactFx((current) =>
            current?.id === impact.id
              ? null
              : current,
          );

          if (
            playImpactFxRef.current?.id ===
            impact.id
          ) {
            playImpactFxRef.current =
              null;
          }
        }, 560);
    },
    [],
  );

  const stopFrameLoop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const finishGame = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    stopFrameLoop();
    setIsPlaying(false);
    setScreen("result");
    setStats((previous) => {
      const finalStats = {
        ...previous,
        score,
        maxCombo,
      };
      saveBest(song.id, difficulty, finalStats);
      return finalStats;
    });
    setBest((previous) => ({ score: Math.max(previous.score, score), combo: Math.max(previous.combo, maxCombo) }));
    onRecordSaved?.();
  }, [difficulty, maxCombo, onRecordSaved, score, song.id, stopFrameLoop]);

  const updatePlayhead = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let now = audio.currentTime;

    if (
      screen === "editor" &&
      loopEnabled &&
      loopEnd >
        loopStart + 0.05 &&
      now >= loopEnd
    ) {
      audio.currentTime =
        loopStart;
      now = loopStart;
    }

    // 전체 1만행 컴포넌트를 60fps로 다시 그리지 않는다.
    // 판정은 audio.currentTime을 직접 사용하고 UI 위치만 30~40fps로 제한한다.
    const frameNow =
      typeof performance !==
      "undefined"
        ? performance.now()
        : Date.now();

    const uiFrameMs =
      screen === "editor"
        ? EDITOR_UI_FRAME_MS
        : PLAY_UI_FRAME_MS;

    if (
      frameNow -
        lastUiUpdateAtRef.current >=
        uiFrameMs ||
      !isPlaying
    ) {
      lastUiUpdateAtRef.current =
        frameNow;
      setCurrentTime(now);
    }

    if (screen === "play") {
      for (const lane of KEYS) {
        const activeHold =
          activeHoldRef.current[
            lane
          ];

        if (
          activeHold &&
          now >= activeHold.endTime
        ) {
          delete activeHoldRef.current[
            lane
          ];
        }
      }

      // chart.notes 전체를 매 프레임 순회하지 않고,
      // 아직 지나가지 않은 노트부터 한 번만 앞으로 스캔한다.
      let cursor =
        missCursorRef.current;
      let missedCount = 0;
      let lastMissedLane:
        | LaneKey
        | null = null;
      let nextMissed:
        | Set<string>
        | null = null;

      while (
        cursor <
          chart.notes.length &&
        now -
          chart.notes[cursor].time >
          JUDGMENT_WINDOWS.GOOD
      ) {
        const note =
          chart.notes[cursor];

        if (
          !hitNotesRef.current.has(
            note.id,
          ) &&
          !missedNotesRef.current.has(
            note.id,
          )
        ) {
          if (!nextMissed) {
            nextMissed =
              new Set(
                missedNotesRef.current,
              );
          }

          nextMissed.add(
            note.id,
          );
          lastMissedLane =
            note.lane;
          missedCount += 1;
        }

        cursor += 1;
      }

      missCursorRef.current =
        cursor;

      if (
        nextMissed &&
        missedCount > 0
      ) {
        missedNotesRef.current =
          nextMissed;
        setMissedNotes(
          new Set(nextMissed),
        );
        comboRef.current = 0;
        setCombo(0);
        triggerPlayImpact(
          lastMissedLane,
          "MISS",
          0,
          0,
        );
        setStats((previous) => ({
          ...previous,
          miss:
            previous.miss +
            missedCount,
        }));
        flashJudgment("MISS");
      }
    }

    if (
      !audio.paused &&
      !audio.ended
    ) {
      frameRef.current =
        requestAnimationFrame(
          updatePlayhead,
        );
    }
  }, [
    chart.notes,
    flashJudgment,
    isPlaying,
    loopEnabled,
    loopEnd,
    loopStart,
    screen,
    triggerPlayImpact,
  ]);

  const resetPlay = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    stopFrameLoop();
    setCurrentTime(0);
    setIsPlaying(false);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    hitNotesRef.current = new Set();
    missedNotesRef.current = new Set();
    activeHoldRef.current = {};
    comboRef.current = 0;
    setPlayImpactFx(null);
    playImpactFxRef.current = null;
    setPlayComboMilestone(null);
    missCursorRef.current = 0;
    lastUiUpdateAtRef.current = 0;
    setHitNotes(new Set());
    setMissedNotes(new Set());
    setJudgment(null);
    setStats({ score: 0, maxCombo: 0, perfect: 0, great: 0, good: 0, miss: 0 });
  }, [stopFrameLoop]);

  const beginPlay = useCallback(() => {
    if (playBusy) return;

    const official =
      publishedSongMap[song.id] || null;

    if (!official?.published || !official.audio_url) {
      setAnalysisMessage(
        "이 곡은 아직 공식 송출 음원이 연결되지 않았습니다.",
      );
      void syncPublishedSong(song.id);
      return;
    }

    const officialChartRaw =
      official.charts?.[difficulty];

    if (
      !officialChartRaw ||
      !Array.isArray(officialChartRaw.notes) ||
      officialChartRaw.notes.length === 0
    ) {
      setAnalysisMessage(
        `${difficulty.toUpperCase()} 공식 채보가 없습니다. 관리자 작업실에서 채보를 만든 뒤 다시 송출해주세요.`,
      );
      return;
    }

    const officialSong: Song = {
      id: official.song_id,
      title: official.title || song.title,
      subtitle: official.subtitle || song.subtitle,
      genre: official.genre || song.genre,
      bpm: Number(official.bpm) || song.bpm,
      duration:
        Number(official.duration) || song.duration,
      coverUrl: official.cover_url || undefined,
    };

    const officialChart = normalizePublishedChart(
      officialChartRaw,
      officialSong,
      difficulty,
    );

    if (!officialChart.notes.length) {
      setAnalysisMessage(
        `${difficulty.toUpperCase()} 공식 채보에 유효한 노트가 없습니다.`,
      );
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      setAnalysisMessage(
        "오디오 플레이어를 준비하지 못했습니다. 페이지를 새로고침해주세요.",
      );
      return;
    }

    setPlayBusy(true);
    setAnalysisMessage("");

    resetPlay();

    setChart(officialChart);
    setDuration(
      Number(official.duration) || song.duration,
    );
    setAudioUrl(official.audio_url);
    setAudioName(
      official.audio_path?.split("/").pop() ||
        `${official.title || song.title}.audio`,
    );

    audio.src = official.audio_url;
    audio.currentTime = 0;
    audio.load();

    const playPromise = audio.play();

    setScreen("play");

    void playPromise
      .then(() => {
        setIsPlaying(true);
        setSongSyncState("published");
        stopFrameLoop();
        frameRef.current =
          requestAnimationFrame(updatePlayhead);
      })
      .catch((error) => {
        setIsPlaying(false);
        setAnalysisMessage(
          error instanceof Error
            ? `음원 재생 실패 · ${error.message}`
            : "음원 재생에 실패했습니다.",
        );
      })
      .finally(() => {
        setPlayBusy(false);
      });
  }, [
    difficulty,
    playBusy,
    publishedSongMap,
    resetPlay,
    song,
    stopFrameLoop,
    syncPublishedSong,
    updatePlayhead,
  ]);

  const toggleAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    audio.playbackRate = playbackRate;
    audio.volume = editorVolume;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
        stopFrameLoop();
        frameRef.current = requestAnimationFrame(updatePlayhead);
      } catch {
        setEditorNotice("브라우저가 음원 재생을 막았습니다. 화면을 한 번 클릭한 뒤 다시 재생해주세요.");
      }
    } else {
      audio.pause();
      setIsPlaying(false);
      stopFrameLoop();
    }
  }, [
    audioUrl,
    editorVolume,
    playbackRate,
    stopFrameLoop,
    updatePlayhead,
  ]);

  const flushPendingChartPersist = useCallback(() => {
    if (chartPersistTimerRef.current !== null) {
      window.clearTimeout(
        chartPersistTimerRef.current,
      );
      chartPersistTimerRef.current = null;
    }

    const pending =
      pendingChartPersistRef.current;

    if (!pending) return;

    saveChart(
      pending.songId,
      pending.difficulty,
      pending.chart,
    );

    pendingChartPersistRef.current =
      null;
  }, []);

  const scheduleChartPersist = useCallback(
    (nextChart: Chart) => {
      pendingChartPersistRef.current = {
        songId: song.id,
        difficulty,
        chart: nextChart,
      };

      if (
        chartPersistTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          chartPersistTimerRef.current,
        );
      }

      chartPersistTimerRef.current =
        window.setTimeout(
          flushPendingChartPersist,
          450,
        );
    },
    [
      difficulty,
      flushPendingChartPersist,
      song.id,
    ],
  );

  useEffect(() => {
    return () => {
      flushPendingChartPersist();
    };
  }, [flushPendingChartPersist]);

  const commitEditorChart = useCallback(
    (producer: (previous: Chart) => Chart) => {
      let changed = false;

      setChart((previous) => {
        const next = producer(previous);
        if (next === previous) return previous;

        undoStackRef.current = [
          ...undoStackRef.current.slice(-59),
          cloneChart(previous),
        ];
        redoStackRef.current = [];
        scheduleChartPersist(next);
        changed = true;
        return next;
      });

      if (changed) {
        setEditorDirty(true);
      } else {
        // React state updater is evaluated synchronously in the common editor path,
        // but mark dirty defensively for mutation commands.
        setEditorDirty(true);
      }
    },
    [scheduleChartPersist],
  );

  const snapEditorTime = useCallback(
    (time: number) => {
      const mediaDuration =
        getEffectiveDuration();

      const safeTime = clamp(
        Number(time) || 0,
        0,
        Math.max(
          0,
          mediaDuration,
        ),
      );

      if (!snapEnabled) return safeTime;

      return clamp(
        snapTimeToGrid(
          safeTime,
          chart.bpm || song.bpm,
          snapDivision,
          chart.offset || 0,
        ),
        0,
        Math.max(
          0,
          mediaDuration,
        ),
      );
    },
    [
      chart.bpm,
      chart.offset,
      getEffectiveDuration,
      snapDivision,
      snapEnabled,
      song.bpm,
    ],
  );

  const addEditorNoteAt = useCallback(
    (lane: LaneKey, rawTime: number) => {
      if (!audioUrl) return;

      const time = snapEditorTime(rawTime);
      const noteId = idForNote(time, lane);
      let inserted = false;

      commitEditorChart((previous) => {
        const note: RhythmNote = {
          id: noteId,
          time,
          lane,
        };

        const notes = insertNoteSorted(
          previous.notes,
          note,
        );

        if (!notes) {
          return previous;
        }

        inserted = true;

        return {
          ...previous,
          notes,
        };
      });

      if (inserted) {
        setSelectedEditorNoteId(noteId);
        setEditorNotice(`${formatTimePrecise(time)} · ${lane} 노트 추가`);
      }
    },
    [audioUrl, commitEditorChart, snapEditorTime],
  );

  const undoEditor = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) {
      setEditorNotice("되돌릴 작업이 없습니다.");
      return;
    }

    setChart((current) => {
      redoStackRef.current = [
        ...redoStackRef.current.slice(-59),
        cloneChart(current),
      ];
      scheduleChartPersist(previous);
      return cloneChart(previous);
    });

    setSelectedEditorNoteId(null);
    setEditorDirty(true);
    setEditorNotice("한 단계 되돌렸습니다.");
  }, [scheduleChartPersist]);

  const redoEditor = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) {
      setEditorNotice("다시 실행할 작업이 없습니다.");
      return;
    }

    setChart((current) => {
      undoStackRef.current = [
        ...undoStackRef.current.slice(-59),
        cloneChart(current),
      ];
      scheduleChartPersist(next);
      return cloneChart(next);
    });

    setSelectedEditorNoteId(null);
    setEditorDirty(true);
    setEditorNotice("되돌린 작업을 다시 적용했습니다.");
  }, [scheduleChartPersist]);

  const saveEditorCheckpoint = useCallback(async () => {
    if (draftBusy) return;

    setDraftBusy(true);

    try {
      if (chartPersistTimerRef.current !== null) {
        window.clearTimeout(
          chartPersistTimerRef.current,
        );
        chartPersistTimerRef.current = null;
      }
      pendingChartPersistRef.current = null;

      // 현재 난이도는 상태의 최신 값을 먼저 저장한다.
      saveChart(
        song.id,
        difficulty,
        chart,
      );

      const charts: PublishedCharts = {
        easy:
          difficulty === "easy"
            ? cloneChart(chart)
            : loadChart(
                song,
                "easy",
              ),
        normal:
          difficulty === "normal"
            ? cloneChart(chart)
            : loadChart(
                song,
                "normal",
              ),
        hard:
          difficulty === "hard"
            ? cloneChart(chart)
            : loadChart(
                song,
                "hard",
              ),
      };

      const savedAtIso =
        new Date().toISOString();

      // 새로 불러온 로컬 음원은 IndexedDB에 바이너리 자체를 저장한다.
      // 브라우저를 닫았다 열어도 blob URL이 사라지는 문제를 방지한다.
      let hasLocalAudio = false;

      if (
        pendingAudioFile &&
        pendingAudioSongId ===
          song.id
      ) {
        await saveDraftAudioFile(
          song.id,
          pendingAudioFile,
        );
        hasLocalAudio = true;
      } else {
        hasLocalAudio =
          Boolean(
            await loadDraftAudioFile(
              song.id,
            ),
          );
      }

      const draft: EditorDraftMetadata = {
        songId: song.id,
        title:
          publishTitle.trim() ||
          song.title,
        difficulty,
        duration:
          Math.max(
            1,
            getEffectiveDuration(),
          ),
        currentTime:
          clamp(
            currentTime,
            0,
            Math.max(
              0,
              getEffectiveDuration(),
            ),
          ),
        audioName,
        savedAt: savedAtIso,
        hasLocalAudio,
        charts,
      };

      saveEditorDraftMetadata(
        draft,
      );

      const savedAt =
        new Date(
          savedAtIso,
        ).toLocaleTimeString(
          "ko-KR",
          {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          },
        );

      setLastSavedAt(savedAt);
      setEditorDirty(false);
      setPublishMessage(
        `작업 초안 저장 완료 · EASY ${charts.easy.notes.length} / NORMAL ${charts.normal.notes.length} / HARD ${charts.hard.notes.length} · ${savedAt}`,
      );
      setEditorNotice(
        hasLocalAudio
          ? "채보와 음원까지 브라우저에 저장했습니다. 다음에 작업실을 열면 이어서 작업할 수 있습니다."
          : "채보 작업을 저장했습니다. 공개 음원을 편집 중인 경우 다음 접속에도 그대로 이어집니다.",
      );
    } catch (error) {
      setEditorNotice(
        error instanceof Error
          ? `초안 저장 실패 · ${error.message}`
          : "초안 저장에 실패했습니다.",
      );
      setPublishMessage(
        error instanceof Error
          ? `저장 실패 · ${error.message}`
          : "저장에 실패했습니다.",
      );
    } finally {
      setDraftBusy(false);
    }
  }, [
    audioName,
    chart,
    currentTime,
    difficulty,
    draftBusy,
    getEffectiveDuration,
    pendingAudioFile,
    pendingAudioSongId,
    publishTitle,
    song,
  ]);

  const judgeLane = useCallback(
    (lane: LaneKey) => {
      if (screen === "editor") {
        const audio = audioRef.current;
        if (!audio || !audioUrl) return;

        addEditorNoteAt(lane, audio.currentTime);
        return;
      }

      if (screen !== "play") return;
      const audio = audioRef.current;
      if (!audio) return;
      const now = audio.currentTime;

      const {
        candidate,
        bestDelta,
      } = findNearestPlayableNote(
        chart.notes,
        lane,
        now,
        JUDGMENT_WINDOWS.GOOD,
        hitNotesRef.current,
        missedNotesRef.current,
      );

      if (!candidate) return;

      const holdDuration = Math.max(0, Number(candidate.duration) || 0);

      let nextJudgment: Judgment;
      let points: number;
      if (bestDelta <= JUDGMENT_WINDOWS.PERFECT) {
        nextJudgment = "PERFECT";
        points = 1000;
      } else if (bestDelta <= JUDGMENT_WINDOWS.GREAT) {
        nextJudgment = "GREAT";
        points = 700;
      } else {
        nextJudgment = "GOOD";
        points = 300;
      }

      hitNotesRef.current = new Set(hitNotesRef.current).add(candidate.id);
      setHitNotes(new Set(hitNotesRef.current));

      if (holdDuration > 0.04) {
        activeHoldRef.current[lane] = {
          noteId: candidate.id,
          endTime: candidate.time + holdDuration,
        };
      }
      const nextCombo =
        comboRef.current + 1;

      comboRef.current =
        nextCombo;

      setCombo(nextCombo);
      setMaxCombo((before) =>
        Math.max(
          before,
          nextCombo,
        ),
      );

      if (
        isPlayComboMilestone(
          nextCombo,
        )
      ) {
        comboMilestoneSerialRef.current +=
          1;

        const serial =
          comboMilestoneSerialRef.current;

        const milestone =
          getPlayComboMilestoneFx(
            nextCombo,
            serial,
          );

        setPlayComboMilestone(
          milestone,
        );

        if (
          comboMilestoneTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            comboMilestoneTimerRef.current,
          );
        }

        comboMilestoneTimerRef.current =
          window.setTimeout(
            () => {
              setPlayComboMilestone(
                (current) =>
                  current?.serial ===
                  serial
                    ? null
                    : current,
              );
            },
            milestone.duration,
          );
      }

      triggerPlayImpact(
        lane,
        nextJudgment,
        Math.round(
          (now - candidate.time) *
            1000,
        ),
        nextCombo,
      );

      setScore((previous) => previous + points);
      setStats((previous) => ({
        ...previous,
        [nextJudgment.toLowerCase()]: previous[nextJudgment.toLowerCase() as "perfect" | "great" | "good"] + 1,
      }));
      flashJudgment(nextJudgment);
    },
    [
      addEditorNoteAt,
      audioUrl,
      chart.notes,
      flashJudgment,
      screen,
      triggerPlayImpact,
    ],
  );

  const releaseHoldLane = useCallback(
    (lane: LaneKey) => {
      if (screen !== "play") return;

      const activeHold = activeHoldRef.current[lane];
      if (!activeHold) return;

      const audio = audioRef.current;
      const now = audio?.currentTime || 0;

      if (now < activeHold.endTime - JUDGMENT_WINDOWS.GOOD) {
        comboRef.current = 0;
        setCombo(0);
        triggerPlayImpact(
          lane,
          "MISS",
          0,
          0,
        );
        setStats((previous) => ({
          ...previous,
          miss: previous.miss + 1,
        }));
        flashJudgment("MISS");
      }

      delete activeHoldRef.current[lane];
    },
    [
      flashJudgment,
      screen,
      triggerPlayImpact,
    ],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const lane = KEY_TO_LANE[event.key.toLowerCase()];
      if (!lane) return;
      event.preventDefault();
      setPressed((previous) => new Set(previous).add(lane));
      judgeLane(lane);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const lane = KEY_TO_LANE[event.key.toLowerCase()];
      if (!lane) return;
      releaseHoldLane(lane);
      setPressed((previous) => {
        const next = new Set(previous);
        next.delete(lane);
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [judgeLane, releaseHoldLane]);

  const openAudioPicker = useCallback(() => {
    const input = fileRef.current;

    if (!input || analysisBusy) {
      return;
    }

    // 같은 파일을 다시 선택해도 change 이벤트가 반드시 발생하게 한다.
    input.value = "";

    const picker = input as HTMLInputElement & {
      showPicker?: () => void;
    };

    try {
      if (typeof picker.showPicker === "function") {
        picker.showPicker();
        return;
      }
    } catch {
      // 브라우저가 showPicker를 제한하면 일반 click으로 폴백한다.
    }

    input.click();
  }, [analysisBusy]);

  const importAudioFile = useCallback(
    async (file: File) => {
      if (analysisBusy) {
        return;
      }

      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase() || "";

      const supportedExtensions = new Set([
        "wav",
        "mp3",
        "m4a",
        "mp4",
        "aac",
        "flac",
        "ogg",
        "oga",
        "opus",
        "webm",
        "aif",
        "aiff",
      ]);

      const looksLikeAudio =
        file.type.startsWith("audio/") ||
        file.type === "video/mp4" ||
        supportedExtensions.has(extension);

      if (!looksLikeAudio) {
        const message =
          "지원되는 파일을 선택해주세요. WAV, MP3, M4A, MP4, AAC, FLAC, OGG, OPUS, WebM, AIFF를 사용할 수 있습니다. MP4는 파일 안의 오디오 트랙을 사용합니다.";

        setAnalysisMessage(message);
        setEditorNotice(message);
        return;
      }

      if (file.size <= 0) {
        const message =
          "선택한 음원 파일이 비어 있습니다. 다른 파일을 선택해주세요.";

        setAnalysisMessage(message);
        setEditorNotice(message);
        return;
      }

      const levels = [
        "easy",
        "normal",
        "hard",
      ] as Difficulty[];

      const existingNoteCount =
        levels.reduce(
          (sum, level) => {
            const localCount =
              hasSavedChart(
                song.id,
                level,
              )
                ? loadChart(
                    song,
                    level,
                  ).notes.length
                : 0;

            const publishedCount =
              currentPublishedSong
                ?.charts?.[
                  level
                ]?.notes?.length ||
              0;

            return (
              sum +
              Math.max(
                localCount,
                publishedCount,
              )
            );
          },
          0,
        );

      if (
        existingNoteCount > 0 &&
        !window.confirm(
          `새 음원을 등록하면 현재 곡의 EASY / NORMAL / HARD 수동 채보를 모두 빈 상태로 초기화합니다.\n\n현재 확인되는 노트: ${existingNoteCount}개\n\n계속할까요?`,
        )
      ) {
        return;
      }

      setAnalysisBusy(true);
      setAnalysisMessage(
        `음원 불러오는 중 · ${file.name}`,
      );
      setEditorNotice(
        "음원 파일을 작업실에 연결하고 있습니다…",
      );

      let nextUrl: string | null =
        null;

      try {
        // 재생 중이었다면 먼저 정지해 이전 음원과 새 음원이 섞이지 않게 한다.
        const audio =
          audioRef.current;

        if (audio) {
          audio.pause();
        }

        setIsPlaying(false);
        stopFrameLoop();
        setCurrentTime(0);

        const previousAudioUrl =
          audioUrl;

        nextUrl =
          URL.createObjectURL(
            file,
          );

        // state가 커밋되기 전에 effect가 실행되는 경우까지 막는다.
        localAudioSessionSongRef.current =
          song.id;

        const baseBpm = clamp(
          Number(chart.bpm) ||
            Number(song.bpm) ||
            120,
          30,
          300,
        );

        // 파일 등록은 자동채보 없이 세 난이도 모두 빈 수동 채보로 시작.
        for (const level of levels) {
          saveChart(
            song.id,
            level,
            {
              bpm: baseBpm,
              offset: 0,
              notes: [],
            },
          );
        }

        const blankChart: Chart = {
          bpm: baseBpm,
          offset: 0,
          notes: [],
        };

        setChart(blankChart);
        setAudioUrl(nextUrl);
        setAudioName(file.name);
        setPendingAudioFile(file);
        setPendingAudioSongId(
          song.id,
        );

        setSelectedEditorNoteId(
          null,
        );
        setSelectedEditorNoteIds(
          new Set(),
        );
        setBulkDeleteMode(false);
        undoStackRef.current = [];
        redoStackRef.current = [];
        setEditorDirty(true);
        setLastSavedAt(null);

        removeEditorDraftMetadata(
          song.id,
        );

        // 새 음원을 선택한 즉시 IndexedDB에도 저장한다.
        // 저장 버튼을 누르기 전 브라우저가 리렌더되어도 파일 자체가 사라지지 않는다.
        let draftAudioSaved =
          false;

        try {
          await saveDraftAudioFile(
            song.id,
            file,
          );
          draftAudioSaved = true;
        } catch {
          // IndexedDB 용량/권한 문제는 작업실 연결 자체를 막지 않는다.
          draftAudioSaved = false;
        }

        if (
          !currentPublishedSong
        ) {
          const inferredTitle =
            file.name
              .replace(
                /\.[^.]+$/,
                "",
              )
              .trim();

          setPublishTitle(
            inferredTitle ||
              song.title,
          );
        }

        setChartCheckMessage(
          "MANUAL CHART · 0 NOTES · AUTO OFF",
        );

        setPublishMessage(
          "새 음원 등록 완료 · EASY / NORMAL / HARD 채보를 빈 상태로 시작합니다.",
        );

        setPublishStage("");

        // 파일의 실제 길이를 먼저 읽는다.
        const detectedDuration =
          await new Promise<
            number | null
          >((resolve) => {
            const probe =
              document.createElement(
                "audio",
              );

            let settled = false;

            const finish = (
              value: number | null,
            ) => {
              if (settled) {
                return;
              }

              settled = true;
              probe.onloadedmetadata =
                null;
              probe.onerror = null;
              resolve(value);
            };

            const timer =
              window.setTimeout(
                () => {
                  finish(null);
                },
                7000,
              );

            probe.preload =
              "metadata";

            probe.onloadedmetadata =
              () => {
                window.clearTimeout(
                  timer,
                );

                const value =
                  Number(
                    probe.duration,
                  );

                finish(
                  Number.isFinite(
                    value,
                  ) &&
                    value > 0
                    ? value
                    : null,
                );
              };

            probe.onerror = () => {
              window.clearTimeout(
                timer,
              );
              finish(null);
            };

            probe.src =
              nextUrl as string;
            probe.load();
          });

        if (
          detectedDuration &&
          nextUrl
        ) {
          rememberMediaDuration(
            detectedDuration,
            nextUrl,
          );
        }

        // React의 <audio src>가 바뀐 뒤 브라우저에 명시적으로 새 소스를 로드시킨다.
        window.requestAnimationFrame(
          () => {
            const target =
              audioRef.current;

            if (!target) {
              return;
            }

            try {
              target.load();
            } catch {
              // load 실패 시 onError가 상세 메시지를 표시한다.
            }
          },
        );

        // 이전 blob은 새 URL이 state에 연결된 뒤에 해제한다.
        if (
          previousAudioUrl?.startsWith(
            "blob:",
          ) &&
          previousAudioUrl !==
            nextUrl
        ) {
          window.setTimeout(
            () => {
              URL.revokeObjectURL(
                previousAudioUrl,
              );
            },
            0,
          );
        }

        const isMp4 =
          extension === "mp4" ||
          file.type === "video/mp4";

        setAnalysisMessage(
          detectedDuration
            ? `음원 등록 완료 · ${file.name} · ${formatTime(detectedDuration)}${isMp4 ? " · MP4 오디오 트랙 사용" : ""}`
            : `음원 등록 완료 · ${file.name}${isMp4 ? " · MP4 오디오 트랙 사용" : ""}`,
        );

        setEditorNotice(
          draftAudioSaved
            ? "음원이 정상적으로 들어왔습니다. 자동채보 없이 0 NOTES에서 바로 작업할 수 있습니다. 음원 파일도 임시 저장했습니다."
            : "음원이 정상적으로 들어왔습니다. 자동채보 없이 0 NOTES에서 바로 작업할 수 있습니다.",
        );
      } catch (error) {
        localAudioSessionSongRef.current =
          null;

        if (nextUrl) {
          URL.revokeObjectURL(
            nextUrl,
          );
        }

        const message =
          error instanceof Error
            ? `음원 등록 실패 · ${error.message}`
            : "음원 등록에 실패했습니다.";

        setAnalysisMessage(
          message,
        );
        setEditorNotice(
          message,
        );
      } finally {
        setAnalysisBusy(false);
      }
    },
    [
      analysisBusy,
      audioUrl,
      chart.bpm,
      currentPublishedSong,
      rememberMediaDuration,
      song,
      stopFrameLoop,
    ],
  );

  async function handleAudioFile(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const input =
      event.currentTarget;

    const file =
      input.files?.[0];

    // 다음에 같은 파일을 선택해도 change 이벤트를 받을 수 있도록 즉시 비운다.
    input.value = "";

    if (!file) {
      return;
    }

    await importAudioFile(
      file,
    );
  }


  async function handleCoverFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validType =
      file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file.name);

    if (!validType) {
      setCoverMessage("JPG, PNG, WebP 플레이 이미지를 선택해주세요.");
      event.target.value = "";
      return;
    }

    setCoverBusy(true);
    setCoverMessage("플레이 이미지를 최적화하고 있어요…");

    try {
      const dataUrl = await optimizeCoverImage(file);
      const nextAsset: SongCoverAsset = {
        dataUrl,
        fileName: file.name,
        updatedAt: new Date().toISOString(),
      };
      const nextCovers = {
        ...songCovers,
        [song.id]: nextAsset,
      };

      saveSongCovers(nextCovers);
      setSongCovers(nextCovers);
      setEditorDirty(true);
      setCoverMessage(`플레이 이미지 적용 완료 · ${file.name}`);
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "브라우저 저장 공간이 부족합니다. 더 작은 이미지를 사용해주세요."
          : error instanceof Error
            ? error.message
            : "플레이 이미지 등록에 실패했습니다.";
      setCoverMessage(message);
    } finally {
      setCoverBusy(false);
      event.target.value = "";
    }
  }

  function removeCurrentCover() {
    if (!songCovers[song.id]) return;

    const nextCovers = { ...songCovers };
    delete nextCovers[song.id];

    try {
      saveSongCovers(nextCovers);
      setSongCovers(nextCovers);
      setEditorDirty(true);
      setCoverMessage("플레이 이미지를 제거했습니다. 기본 아트가 다시 표시됩니다.");
    } catch {
      setCoverMessage("커버 이미지 제거에 실패했습니다.");
    }
  }

  async function publishCurrentSong() {
    setPublishBusy(true);
    setPublishStage("1/5 · 관리자 권한 확인");
    setPublishMessage("관리자 세션과 송출 권한을 확인하고 있어요…");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw new Error(`로그인 확인 실패 · ${userError.message}`);
      if (!user) {
        throw new Error(
          "관리자 로그인이 확인되지 않았습니다. 후사이트 로그인 후 다시 시도해주세요.",
        );
      }

      // 화면의 isAdmin 값이 오래되었을 수 있으므로 송출 순간에 다시 확인한다.
      const { data: adminRow, error: adminError } = await supabase
        .from(RHYTHM_ADMIN_TABLE)
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError) {
        throw new Error(`관리자 권한 조회 실패 · ${adminError.message}`);
      }

      if (!adminRow?.user_id) {
        throw new Error(
          `현재 로그인 계정(${user.email || user.id})이 hoo_rhythm_admins에 등록되어 있지 않습니다.`,
        );
      }

      setIsAdmin(true);

      const finalPublishTitle =
        publishTitle.trim();

      if (!finalPublishTitle) {
        throw new Error(
          "사람들에게 표시할 송출 제목을 입력해주세요.",
        );
      }

      const existing = publishedSongMap[song.id] || null;
      const safeDuration = Math.max(
        1,
        getEffectiveDuration(),
        Number(existing?.duration) || 0,
        Number(song.duration) || 0,
      );

      setPublishStage(
        "2/5 · 수동 채보 확인",
      );
      setPublishMessage(
        "직접 작성한 EASY · NORMAL · HARD 채보를 확인하고 있어요…",
      );

      const chartForPublish = (
        level: Difficulty,
      ): Chart => {
        if (difficulty === level) {
          return chart;
        }

        if (
          hasSavedChart(
            song.id,
            level,
          )
        ) {
          return loadChart(
            song,
            level,
          );
        }

        const publishedChart =
          existing?.charts?.[level];

        if (publishedChart) {
          return normalizePublishedChart(
            publishedChart,
            song,
            level,
          );
        }

        return {
          bpm:
            chart.bpm ||
            song.bpm,
          offset: 0,
          notes: [],
        };
      };

      const charts: PublishedCharts = {
        easy: sanitizeChart(
          chartForPublish("easy"),
          safeDuration,
          chart.bpm || song.bpm,
        ),
        normal: sanitizeChart(
          chartForPublish("normal"),
          safeDuration,
          chart.bpm || song.bpm,
        ),
        hard: sanitizeChart(
          chartForPublish("hard"),
          safeDuration,
          chart.bpm || song.bpm,
        ),
      };

      const missingLevels = (
        [
          "easy",
          "normal",
          "hard",
        ] as Difficulty[]
      ).filter(
        (level) =>
          charts[level].notes.length === 0,
      );

      if (missingLevels.length) {
        throw new Error(
          `${missingLevels
            .map(
              (level) =>
                level.toUpperCase(),
            )
            .join(
              ", ",
            )} 채보가 비어 있습니다. 자동생성 없이 각 난이도를 직접 작성한 뒤 송출해주세요.`,
        );
      }

      for (const level of [
        "easy",
        "normal",
        "hard",
      ] as Difficulty[]) {
        saveChart(
          song.id,
          level,
          charts[level],
        );
      }

      const chartSummary =
        `EASY ${charts.easy.notes.length} / ` +
        `NORMAL ${charts.normal.notes.length} / ` +
        `HARD ${charts.hard.notes.length}`;

      setChartCheckMessage(
        `수동 채보 확인 완료 · ${chartSummary}`,
      );

      let nextAudioPath = existing?.audio_path || "";
      let nextAudioUrl = existing?.audio_url || "";
      let nextCoverPath = existing?.cover_path || null;
      let nextCoverUrl = existing?.cover_url || null;
      const uploadVersion = Date.now();

      setPublishStage("3/5 · 음원·커버 업로드");

      if (
        pendingAudioFile &&
        pendingAudioSongId === song.id
      ) {
        const extension =
          safeStorageName(pendingAudioFile.name)
            .split(".")
            .pop()
            ?.toLowerCase() || "mp3";

        nextAudioPath =
          `audio/${song.id}/master-${uploadVersion}.${extension}`;

        const uploadContentType =
          inferAudioContentType(
            pendingAudioFile,
          );

        setPublishMessage(
          `음원 업로드 중 · ${pendingAudioFile.name} · ${uploadContentType}`,
        );

        const { error: audioUploadError } =
          await supabase.storage
            .from(RHYTHM_BUCKET)
            .upload(nextAudioPath, pendingAudioFile, {
              upsert: false,
              cacheControl: "31536000",
              contentType:
                uploadContentType,
            });

        if (audioUploadError) {
          const rawMessage =
            audioUploadError.message ||
            "알 수 없는 업로드 오류";

          const mimeHint =
            /mime type/i.test(
              rawMessage,
            )
              ? ` · 현재 업로드 MIME: ${uploadContentType}`
              : "";

          throw new Error(
            `음원 업로드 실패 · ${rawMessage}${mimeHint}`,
          );
        }

        nextAudioUrl = supabase.storage
          .from(RHYTHM_BUCKET)
          .getPublicUrl(nextAudioPath).data.publicUrl;
      }

      if (!nextAudioPath || !nextAudioUrl) {
        throw new Error(
          "송출할 음원이 없습니다. 관리자 작업실에서 음원을 먼저 등록해주세요.",
        );
      }

      if (currentLocalCover?.dataUrl) {
        const coverBlob = dataUrlToBlob(
          currentLocalCover.dataUrl,
        );
        nextCoverPath =
          `covers/${song.id}/cover-${uploadVersion}.webp`;

        setPublishMessage("커버 이미지 업로드 중…");

        const { error: coverUploadError } =
          await supabase.storage
            .from(RHYTHM_BUCKET)
            .upload(nextCoverPath, coverBlob, {
              upsert: false,
              cacheControl: "31536000",
              contentType: coverBlob.type || "image/webp",
            });

        if (coverUploadError) {
          throw new Error(
            `커버 업로드 실패 · ${coverUploadError.message}`,
          );
        }

        nextCoverUrl = supabase.storage
          .from(RHYTHM_BUCKET)
          .getPublicUrl(nextCoverPath).data.publicUrl;
      }

      setPublishStage("4/5 · 공식 곡 데이터 송출");
      setPublishMessage(
        `Supabase에 공식 곡과 채보 저장 중 · ${chartSummary}`,
      );

      const now = new Date().toISOString();
      const payload = {
        song_id: song.id,
        title: finalPublishTitle,
        subtitle: song.subtitle,
        genre: song.genre,
        bpm: Math.round(
          charts.normal.bpm ||
            charts.easy.bpm ||
            chart.bpm ||
            song.bpm,
        ),
        duration: safeDuration,
        audio_path: nextAudioPath,
        audio_url: nextAudioUrl,
        cover_path: nextCoverPath,
        cover_url: nextCoverUrl,
        charts,
        published: true,
        sort_order: Math.max(
          0,
          SONGS.findIndex((item) => item.id === song.id),
        ),
        published_by: user.id,
        published_at: existing?.published_at || now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from(RHYTHM_TABLE)
        .upsert(payload, {
          onConflict: "song_id",
        })
        .select(
          "song_id,title,subtitle,genre,bpm,duration,audio_path,audio_url,cover_path,cover_url,charts,published,sort_order,published_by,published_at,updated_at",
        )
        .single();

      if (error) {
        throw new Error(
          `곡 데이터 저장 실패 · ${error.message}`,
        );
      }

      setPublishStage("5/5 · 송출 검증");
      setPublishMessage(
        "공개 데이터를 다시 읽어서 송출 상태를 확인하고 있어요…",
      );

      const { data: verifyRow, error: verifyError } =
        await supabase
          .from(RHYTHM_TABLE)
          .select(
            "song_id,published,audio_url,charts,updated_at",
          )
          .eq("song_id", song.id)
          .eq("published", true)
          .maybeSingle();

      if (verifyError) {
        throw new Error(
          `송출 검증 실패 · ${verifyError.message}`,
        );
      }

      if (
        !verifyRow?.published ||
        !verifyRow.audio_url ||
        !verifyRow.charts
      ) {
        throw new Error(
          "송출 데이터가 저장되었지만 공개 상태 검증에 실패했습니다.",
        );
      }

      setPublishedSongs((previous) => {
        const next = previous.filter(
          (item) => item.song_id !== song.id,
        );
        next.push(data as PublishedSongRow);
        return next.sort(
          (a, b) =>
            Number(a.sort_order || 0) -
            Number(b.sort_order || 0),
        );
      });

      // 버전 경로를 사용하므로 새 송출은 브라우저 캐시에 묶이지 않는다.
      if (
        pendingAudioFile &&
        existing?.audio_path &&
        existing.audio_path !== nextAudioPath
      ) {
        void supabase.storage
          .from(RHYTHM_BUCKET)
          .remove([existing.audio_path]);
      }

      if (
        currentLocalCover?.dataUrl &&
        existing?.cover_path &&
        existing.cover_path !== nextCoverPath
      ) {
        void supabase.storage
          .from(RHYTHM_BUCKET)
          .remove([existing.cover_path]);
      }

      setPendingAudioFile(null);
      setPendingAudioSongId(null);
      localAudioSessionSongRef.current = null;
      removeEditorDraftMetadata(song.id);
      await removeDraftAudioFile(song.id).catch(() => undefined);
      setEditorDirty(false);
      setLastSavedAt(null);
      setAudioUrl(nextAudioUrl);
      setAudioName(
        nextAudioPath.split("/").pop() ||
          `${song.title}.audio`,
      );

      // 공개 직후에는 전체 목록 조회보다 해당 곡 직접 동기화를 먼저 수행한다.
      // 전체 조회가 RLS/네트워크 지연으로 0개를 돌려도 방금 송출한 곡 상태를 잃지 않는다.
      await syncPublishedSong(song.id, {
        silent: true,
      });
      void refreshPublishedSongs();

      setPublishTitle(
        (data as PublishedSongRow).title ||
          finalPublishTitle,
      );
      setPublishStage("송출 완료");
      setPublishMessage(
        `송출 완료 · ${finalPublishTitle} · ${chartSummary} · 모든 이용자에게 공개됨`,
      );

      // 송출 성공 후 작업실에 그대로 남아있던 문제 수정.
      // 방금 송출한 곡을 선택 상태로 잡고 곡 선택 화면으로 즉시 이동한다.
      setIsRecording(false);
      setSelectedEditorNoteId(null);
      setSongId((data as PublishedSongRow).song_id);
      setScreen("select");
    } catch (error) {
      setPublishStage("송출 실패");
      setPublishMessage(
        error instanceof Error
          ? `송출 실패 · ${error.message}`
          : "송출에 실패했습니다.",
      );
    } finally {
      setPublishBusy(false);
    }
  }

  const openPublishedSongForEdit = useCallback(
    async (
      targetSongId: string,
    ) => {
      if (!isAdmin) return;

      const row =
        publishedSongMap[
          targetSongId
        ];

      if (!row) {
        setCloudMessage(
          "수정할 공식 곡 정보를 찾지 못했습니다.",
        );
        return;
      }

      setLibraryActionBusyId(
        targetSongId,
      );

      try {
        resetPlay();

        const officialSong: Song = {
          id: row.song_id,
          title:
            row.title ||
            "UNTITLED",
          subtitle:
            row.subtitle ||
            "HOO RHYTHM OFFICIAL TRACK",
          genre:
            row.genre ||
            "HOO RHYTHM",
          bpm:
            Number(
              row.bpm,
            ) || 120,
          duration:
            Number(
              row.duration,
            ) || 1,
          coverUrl:
            row.cover_url ||
            undefined,
        };

        for (const level of [
          "easy",
          "normal",
          "hard",
        ] as Difficulty[]) {
          const raw =
            row.charts?.[
              level
            ];

          const normalized = raw
            ? normalizePublishedChart(
                raw,
                officialSong,
                level,
              )
            : {
                bpm:
                  officialSong.bpm,
                offset: 0,
                notes: [],
              };

          saveChart(
            row.song_id,
            level,
            normalized,
          );
        }

        setSongId(
          row.song_id,
        );
        setPublishTitle(
          row.title ||
            officialSong.title,
        );
        setDuration(
          officialSong.duration,
        );
        setDifficulty(
          "normal",
        );
        setChart(
          row.charts?.normal
            ? normalizePublishedChart(
                row.charts.normal,
                officialSong,
                "normal",
              )
            : {
                bpm:
                  officialSong.bpm,
                offset: 0,
                notes: [],
              },
        );

        setPendingAudioFile(
          null,
        );
        setPendingAudioSongId(
          null,
        );
        setAudioUrl(
          row.audio_url,
        );
        setAudioName(
          row.audio_path
            ?.split("/")
            .pop() ||
            `${row.title}.audio`,
        );
        setCurrentTime(0);
        setSelectedEditorNoteId(
          null,
        );
        setSelectedEditorNoteIds(
          new Set(),
        );
        setBulkDeleteMode(
          false,
        );
        setEditorDirty(
          false,
        );
        setLastSavedAt(
          null,
        );
        setEditorNotice(
          hasEditorDraft(
            row.song_id,
          )
            ? "이 곡의 저장된 초안이 있습니다. 작업실에서 자동으로 초안을 불러옵니다."
            : "공식 송출본을 작업실로 불러왔습니다. 수정 후 저장하거나 다시 송출할 수 있습니다.",
        );

        restoredDraftSongRef.current =
          null;
        setScreen(
          "editor",
        );
      } finally {
        setLibraryActionBusyId(
          null,
        );
      }
    },
    [
      isAdmin,
      publishedSongMap,
      resetPlay,
    ],
  );

  const deletePublishedSong = useCallback(
    async (
      targetSongId: string,
    ) => {
      if (!isAdmin) return;

      const row =
        publishedSongMap[
          targetSongId
        ];

      if (!row) return;

      const confirmed =
        window.confirm(
          `"${row.title}"을(를) 이용자 곡 목록에서 삭제할까요?\n\n공식 송출 데이터와 연결된 음원/커버도 삭제합니다. 이 작업은 되돌릴 수 없습니다.`,
        );

      if (!confirmed) return;

      setLibraryActionBusyId(
        targetSongId,
      );
      setCloudMessage(
        `"${row.title}" 삭제 중…`,
      );

      try {
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error(
            "관리자 로그인이 필요합니다.",
          );
        }

        const {
          data: adminRow,
          error: adminError,
        } = await supabase
          .from(
            RHYTHM_ADMIN_TABLE,
          )
          .select("user_id")
          .eq(
            "user_id",
            user.id,
          )
          .maybeSingle();

        if (adminError) {
          throw new Error(
            `관리자 권한 확인 실패 · ${adminError.message}`,
          );
        }

        if (!adminRow?.user_id) {
          throw new Error(
            "현재 계정은 HOO RHYTHM 관리자로 등록되어 있지 않습니다.",
          );
        }

        const {
          error: deleteError,
        } = await supabase
          .from(
            RHYTHM_TABLE,
          )
          .delete()
          .eq(
            "song_id",
            targetSongId,
          );

        if (deleteError) {
          throw new Error(
            `곡 삭제 실패 · ${deleteError.message}`,
          );
        }

        const storagePaths = [
          row.audio_path,
          row.cover_path,
        ].filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        );

        if (
          storagePaths.length
        ) {
          const {
            error:
              storageDeleteError,
          } =
            await supabase.storage
              .from(
                RHYTHM_BUCKET,
              )
              .remove(
                storagePaths,
              );

          if (
            storageDeleteError
          ) {
            // 곡 목록 삭제는 이미 성공했으므로 파일 정리 실패는 경고만 남긴다.
            setCloudMessage(
              `곡은 삭제됐지만 저장소 파일 일부를 정리하지 못했습니다 · ${storageDeleteError.message}`,
            );
          }
        }

        for (const level of [
          "easy",
          "normal",
          "hard",
        ] as Difficulty[]) {
          if (
            typeof window !==
            "undefined"
          ) {
            window.localStorage.removeItem(
              chartStorageKey(
                targetSongId,
                level,
              ),
            );
          }
        }

        removeEditorDraftMetadata(
          targetSongId,
        );
        await removeDraftAudioFile(
          targetSongId,
        ).catch(
          () => undefined,
        );

        setPublishedSongs(
          (previous) =>
            previous.filter(
              (item) =>
                item.song_id !==
                targetSongId,
            ),
        );

        if (
          songId ===
          targetSongId
        ) {
          const nextSong =
            publishedSongs.find(
              (item) =>
                item.song_id !==
                targetSongId,
            );

          if (nextSong) {
            setSongId(
              nextSong.song_id,
            );
          } else {
            setAudioUrl(
              null,
            );
            setAudioName(
              "",
            );
          }
        }

        setCloudMessage(
          `"${row.title}" 삭제 완료`,
        );

        void refreshPublishedSongs();
      } catch (error) {
        setCloudMessage(
          error instanceof Error
            ? `삭제 실패 · ${error.message}`
            : "곡 삭제에 실패했습니다.",
        );
      } finally {
        setLibraryActionBusyId(
          null,
        );
      }
    },
    [
      isAdmin,
      publishedSongMap,
      publishedSongs,
      refreshPublishedSongs,
      songId,
      supabase,
    ],
  );

  function toggleBulkDeleteNote(noteId: string) {
    setSelectedEditorNoteIds((previous) => {
      const next = new Set(previous);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }

  function selectCurrentWindowForDelete() {
    const ids = new Set(editorWindowNotes.map((note) => note.id));
    setSelectedEditorNoteIds(ids);
    setBulkDeleteMode(true);
    setEditorNotice(
      ids.size
        ? `현재 보이는 구간의 ${ids.size}개 노트를 선택했습니다.`
        : "현재 보이는 구간에 선택할 노트가 없습니다.",
    );
  }

  function deleteSelectedEditorNotes() {
    const count = selectedEditorNoteIds.size;
    if (!count) {
      setEditorNotice("삭제할 노트를 먼저 선택해주세요.");
      return;
    }

    commitEditorChart((previous) => ({
      ...previous,
      notes: previous.notes.filter(
        (note) => !selectedEditorNoteIds.has(note.id),
      ),
    }));

    setSelectedEditorNoteId(null);
    setSelectedEditorNoteIds(new Set());
    setEditorNotice(`선택한 ${count}개 노트를 삭제했습니다.`);
  }

  function deleteCurrentEditorWindowNotes() {
    const ids = new Set(editorWindowNotes.map((note) => note.id));
    if (!ids.size) {
      setEditorNotice("현재 보이는 구간에 삭제할 노트가 없습니다.");
      return;
    }

    if (
      !window.confirm(
        `현재 타임라인 구간의 노트 ${ids.size}개를 모두 삭제할까요?\n\n${formatTimePrecise(editorWindowStart)} ~ ${formatTimePrecise(editorWindowEnd)}`,
      )
    ) {
      return;
    }

    commitEditorChart((previous) => ({
      ...previous,
      notes: previous.notes.filter((note) => !ids.has(note.id)),
    }));

    setSelectedEditorNoteId(null);
    setSelectedEditorNoteIds(new Set());
    setEditorNotice(`현재 구간의 ${ids.size}개 노트를 삭제했습니다.`);
  }

  function deleteAllEditorNotes() {
    const count = chart.notes.length;
    if (!count) {
      setEditorNotice("현재 난이도에는 삭제할 노트가 없습니다.");
      return;
    }

    if (
      !window.confirm(
        `${difficulty.toUpperCase()} 난이도의 노트 ${count}개를 전부 삭제할까요?\n\n되돌리기(Ctrl+Z)로 복구할 수 있습니다.`,
      )
    ) {
      return;
    }

    commitEditorChart((previous) => ({
      ...previous,
      notes: [],
    }));

    setSelectedEditorNoteId(null);
    setSelectedEditorNoteIds(new Set());
    setBulkDeleteMode(false);
    setEditorNotice(`${difficulty.toUpperCase()} 노트 ${count}개를 전체 삭제했습니다.`);
  }

  function removeEditorNote(noteId: string) {
    commitEditorChart((previous) => ({
      ...previous,
      notes: previous.notes.filter((note) => note.id !== noteId),
    }));

    setSelectedEditorNoteId((previous) =>
      previous === noteId ? null : previous,
    );
    setSelectedEditorNoteIds((previous) => {
      const next = new Set(previous);
      next.delete(noteId);
      return next;
    });
    setEditorNotice("선택 노트를 삭제했습니다.");
  }

  function nudgeEditorNote(noteId: string, delta: number) {
    commitEditorChart((previous) => ({
      ...previous,
      notes: previous.notes
        .map((note) =>
          note.id === noteId
            ? {
                ...note,
                time: clamp(
                  note.time + delta,
                  0,
                  Math.max(0, duration),
                ),
              }
            : note,
        )
        .sort((a, b) => a.time - b.time),
    }));
  }

  function setEditorNoteTime(noteId: string, nextTime: number) {
    commitEditorChart((previous) => ({
      ...previous,
      notes: previous.notes
        .map((note) =>
          note.id === noteId
            ? {
                ...note,
                time: clamp(
                  Number(nextTime) || 0,
                  0,
                  Math.max(0, duration),
                ),
              }
            : note,
        )
        .sort(
          (a, b) =>
            a.time - b.time ||
            LANE_INDEX[a.lane] - LANE_INDEX[b.lane],
        ),
    }));
  }

  function setEditorNoteLane(noteId: string, lane: LaneKey) {
    commitEditorChart((previous) => ({
      ...previous,
      notes: previous.notes
        .map((note) =>
          note.id === noteId ? { ...note, lane } : note,
        )
        .sort(
          (a, b) =>
            a.time - b.time ||
            LANE_INDEX[a.lane] - LANE_INDEX[b.lane],
        ),
    }));
  }


  function setEditorNoteDuration(noteId: string, nextDuration: number) {
    commitEditorChart((previous) => ({
      ...previous,
      notes: previous.notes.map((note) => {
        if (note.id !== noteId) return note;

        const durationValue = clamp(
          Number(nextDuration) || 0,
          0,
          Math.max(0, duration - note.time),
        );

        return {
          ...note,
          duration: durationValue > 0.04 ? durationValue : undefined,
        };
      }),
    }));
  }

  function quantizeSelectedEditorNote() {
    if (!selectedEditorNoteId) return;

    commitEditorChart((previous) => ({
      ...previous,
      notes: previous.notes
        .map((note) =>
          note.id === selectedEditorNoteId
            ? {
                ...note,
                time: clamp(
                  snapTimeToGrid(
                    note.time,
                    previous.bpm || song.bpm,
                    snapDivision,
                    previous.offset || 0,
                  ),
                  0,
                  Math.max(0, duration),
                ),
              }
            : note,
        )
        .sort((a, b) => a.time - b.time),
    }));

    setEditorNotice(`선택 노트를 1/${snapDivision} 그리드에 맞췄습니다.`);
  }

  function quantizeAllEditorNotes() {
    if (!chart.notes.length) return;

    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `현재 ${difficulty.toUpperCase()}의 ${chart.notes.length}개 노트를 1/${snapDivision} 그리드에 맞출까요?`,
      )
    ) {
      return;
    }

    commitEditorChart((previous) => {
      const seen = new Set<string>();
      const notes: RhythmNote[] = [];

      for (const note of previous.notes) {
        const time = clamp(
          snapTimeToGrid(
            note.time,
            previous.bpm || song.bpm,
            snapDivision,
            previous.offset || 0,
          ),
          0,
          Math.max(0, duration),
        );
        const key = `${time.toFixed(4)}:${note.lane}`;
        if (seen.has(key)) continue;
        seen.add(key);
        notes.push({ ...note, time });
      }

      notes.sort(
        (a, b) =>
          a.time - b.time ||
          LANE_INDEX[a.lane] - LANE_INDEX[b.lane],
      );

      return {
        ...previous,
        notes,
      };
    });

    setEditorNotice(`전체 노트를 1/${snapDivision} 그리드에 맞췄습니다.`);
  }

  function updateEditorTiming(
    nextBpm: number,
    nextOffset: number,
  ) {
    commitEditorChart((previous) => ({
      ...previous,
      bpm: clamp(Number(nextBpm) || song.bpm, 30, 300),
      offset: clamp(Number(nextOffset) || 0, -5, 5),
    }));
  }

  const effectiveDuration =
    getEffectiveDuration();

  const visibleNotes = useMemo(() => {
    const leadTime = 2.55;
    const trailTime = 0.20;

    return notesInTimeRange(
      chart.notes,
      currentTime - trailTime,
      currentTime + leadTime,
    );
  }, [
    chart.notes,
    currentTime,
  ]);

  const editorWindowSpan = clamp(
    16 / timelineZoom,
    2,
    Math.max(
      2,
      effectiveDuration || 16,
    ),
  );

  // 편집창 자체가 30fps로 계속 미끄러지면 모든 노트/파형의
  // 위치가 매 프레임 바뀌므로, 창의 시작점은 작은 구간 단위로만 이동한다.
  const editorWindowPanStep =
    clamp(
      editorWindowSpan / 32,
      0.25,
      1,
    );

  const rawEditorWindowStart =
    clamp(
      currentTime -
        editorWindowSpan *
          0.35,
      0,
      Math.max(
        0,
        effectiveDuration -
          editorWindowSpan,
      ),
    );

  const editorWindowStart =
    clamp(
      Math.floor(
        rawEditorWindowStart /
          editorWindowPanStep,
      ) *
        editorWindowPanStep,
      0,
      Math.max(
        0,
        effectiveDuration -
          editorWindowSpan,
      ),
    );

  const editorWindowEnd =
    Math.min(
      effectiveDuration ||
        editorWindowStart +
          editorWindowSpan,
      editorWindowStart +
        editorWindowSpan,
    );

  const editorWindowDuration =
    Math.max(
      0.001,
      editorWindowEnd -
        editorWindowStart,
    );

  const editorWindowNotes =
    useMemo(
      () =>
        notesInTimeRange(
          chart.notes,
          editorWindowStart,
          editorWindowEnd,
        ),
      [
        chart.notes,
        editorWindowEnd,
        editorWindowStart,
      ],
    );

  const editorBeatLines = useMemo(() => {
    if (!showBeatGrid) return [] as { time: number; major: boolean }[];

    const bpm = clamp(Number(chart.bpm) || song.bpm, 30, 300);
    const beat = 60 / bpm;
    const offset = Number(chart.offset) || 0;
    const lines: { time: number; major: boolean }[] = [];
    const firstIndex = Math.floor((editorWindowStart - offset) / beat) - 1;
    const lastIndex = Math.ceil((editorWindowEnd - offset) / beat) + 1;

    for (let index = firstIndex; index <= lastIndex; index += 1) {
      const time = offset + index * beat;
      if (time < editorWindowStart - 0.001 || time > editorWindowEnd + 0.001) continue;

      lines.push({
        time,
        major: ((index % 4) + 4) % 4 === 0,
      });
    }

    return lines;
  }, [
    chart.bpm,
    chart.offset,
    editorWindowEnd,
    editorWindowStart,
    showBeatGrid,
    song.bpm,
  ]);

  const editorWaveformBars = useMemo(() => {
    if (
      !showWaveform ||
      !waveform.length ||
      effectiveDuration <= 0
    ) {
      return [] as number[];
    }

    const bars = 110;
    return Array.from({ length: bars }, (_, index) => {
      const ratio = index / Math.max(1, bars - 1);
      const time = editorWindowStart + ratio * editorWindowDuration;
      const waveformIndex = clamp(
        Math.floor(
          (time /
            effectiveDuration) *
            waveform.length,
        ),
        0,
        waveform.length - 1,
      );
      return waveform[waveformIndex] || 0;
    });
  }, [
    effectiveDuration,
    editorWindowDuration,
    editorWindowStart,
    showWaveform,
    waveform,
  ]);

  const fullWaveformBars = useMemo(() => {
    if (!waveform.length) return [] as number[];
    const bars = 120;
    return Array.from({ length: bars }, (_, index) => {
      const waveformIndex = clamp(
        Math.floor((index / Math.max(1, bars - 1)) * waveform.length),
        0,
        waveform.length - 1,
      );
      return waveform[waveformIndex] || 0;
    });
  }, [waveform]);

  const noteListAnchorTime =
    Math.floor(
      currentTime * 2,
    ) / 2;

  const laneFilteredEditorNotes =
    useMemo(
      () =>
        noteListFilter === "all"
          ? chart.notes
          : chart.notes.filter(
              (note) =>
                note.lane ===
                noteListFilter,
            ),
      [
        chart.notes,
        noteListFilter,
      ],
    );

  const filteredEditorNotes =
    useMemo(() => {
      if (
        noteListScope === "all"
      ) {
        return laneFilteredEditorNotes;
      }

      return notesInTimeRange(
        laneFilteredEditorNotes,
        noteListAnchorTime - 8,
        noteListAnchorTime + 8,
      );
    }, [
      laneFilteredEditorNotes,
      noteListAnchorTime,
      noteListScope,
    ]);

  const noteIndexById = useMemo(() => {
    const map = new Map<
      string,
      number
    >();

    chart.notes.forEach(
      (note, index) => {
        map.set(
          note.id,
          index + 1,
        );
      },
    );

    return map;
  }, [chart.notes]);

  const noteListPageCount =
    Math.max(
      1,
      Math.ceil(
        filteredEditorNotes.length /
          NOTE_LIST_PAGE_SIZE,
      ),
    );

  const safeNoteListPage =
    Math.min(
      noteListPage,
      noteListPageCount - 1,
    );

  const pagedEditorNotes =
    useMemo(() => {
      const start =
        safeNoteListPage *
        NOTE_LIST_PAGE_SIZE;

      return filteredEditorNotes.slice(
        start,
        start +
          NOTE_LIST_PAGE_SIZE,
      );
    }, [
      filteredEditorNotes,
      safeNoteListPage,
    ]);

  useEffect(() => {
    setNoteListPage(0);
  }, [
    difficulty,
    noteListFilter,
    noteListScope,
  ]);

  const selectedEditorNote =
    useMemo(
      () =>
        chart.notes.find(
          (note) =>
            note.id ===
            selectedEditorNoteId,
        ) || null,
      [
        chart.notes,
        selectedEditorNoteId,
      ],
    );
    chart.notes.find((note) => note.id === selectedEditorNoteId) || null;

  const progress =
    effectiveDuration > 0
      ? clamp(
          currentTime /
            effectiveDuration,
          0,
          1,
        )
      : 0;

  const difficultyNoteCounts =
    useMemo(
      () => ({
        easy:
          difficulty === "easy"
            ? chart.notes.length
            : loadChart(
                song,
                "easy",
              ).notes.length,
        normal:
          difficulty === "normal"
            ? chart.notes.length
            : loadChart(
                song,
                "normal",
              ).notes.length,
        hard:
          difficulty === "hard"
            ? chart.notes.length
            : loadChart(
                song,
                "hard",
              ).notes.length,
      }),
      [
        chart.notes.length,
        difficulty,
        song.id,
      ],
    );

  const seekEditor = useCallback(
    (nextTime: number) => {
      const safeTime = clamp(
        Number(nextTime) || 0,
        0,
        Math.max(
          0,
          getEffectiveDuration(),
        ),
      );

      const audio = audioRef.current;
      if (audio) audio.currentTime = safeTime;
      setCurrentTime(safeTime);
    },
    [getEffectiveDuration],
  );

  useEffect(() => {
    if (screen !== "play") return;

    const onPlayShortcut = (
      event: KeyboardEvent,
    ) => {
      const target =
        event.target as
          | HTMLElement
          | null;

      if (
        target &&
        [
          "INPUT",
          "TEXTAREA",
          "SELECT",
        ].includes(
          target.tagName,
        )
      ) {
        return;
      }

      if (
        event.code === "Space" ||
        event.key === " "
      ) {
        event.preventDefault();

        if (event.repeat) return;

        void toggleAudio();
      }
    };

    window.addEventListener(
      "keydown",
      onPlayShortcut,
      {
        passive: false,
      },
    );

    return () => {
      window.removeEventListener(
        "keydown",
        onPlayShortcut,
      );
    };
  }, [
    screen,
    toggleAudio,
  ]);

  useEffect(() => {
    if (screen !== "editor") return;

    const onEditorShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      if (typing) return;

      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveEditorCheckpoint();
        return;
      }

      if (mod && event.key === "Enter") {
        event.preventDefault();
        void publishCurrentSong();
        return;
      }

      if (mod && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redoEditor();
        return;
      }

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoEditor();
        return;
      }

      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoEditor();
        return;
      }

      if (
        event.code === "Space" ||
        event.key === " "
      ) {
        event.preventDefault();

        if (event.repeat) return;

        if (!audioUrl) {
          setEditorNotice(
            "먼저 음원을 등록해주세요.",
          );
          return;
        }

        void toggleAudio();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekEditor(currentTime - (event.shiftKey ? 1 : 0.1));
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        seekEditor(currentTime + (event.shiftKey ? 1 : 0.1));
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (bulkDeleteMode && selectedEditorNoteIds.size > 0) {
          event.preventDefault();
          deleteSelectedEditorNotes();
          return;
        }

        if (selectedEditorNoteId) {
          event.preventDefault();
          removeEditorNote(selectedEditorNoteId);
        }
      }
    };

    window.addEventListener("keydown", onEditorShortcut, { passive: false });
    return () => window.removeEventListener("keydown", onEditorShortcut);
  }, [
    audioUrl,
    bulkDeleteMode,
    currentTime,
    redoEditor,
    saveEditorCheckpoint,
    screen,
    seekEditor,
    selectedEditorNoteId,
    selectedEditorNoteIds,
    toggleAudio,
    undoEditor,
  ]);

  const playJudgedCount =
    stats.perfect +
    stats.great +
    stats.good +
    stats.miss;

  const playWeightedHits =
    stats.perfect * 1 +
    stats.great * 0.84 +
    stats.good * 0.58;

  const playAccuracy =
    playJudgedCount > 0
      ? clamp(
          (playWeightedHits /
            playJudgedCount) *
            100,
          0,
          100,
        )
      : 100;

  const playRank =
    playAccuracy >= 99
      ? "S+"
      : playAccuracy >= 96
        ? "S"
        : playAccuracy >= 91
          ? "A"
          : playAccuracy >= 84
            ? "B"
            : playAccuracy >= 74
              ? "C"
              : "D";

  const playFlow =
    clamp(
      combo / 40,
      0,
      1,
    );

  const playComboTier =
    combo >= 100
      ? "OVERDRIVE"
      : combo >= 50
        ? "FEVER"
        : combo >= 25
          ? "FLOW"
          : combo >= 10
            ? "CHAIN"
            : "SYNC";

  const playBeatDuration =
    60 /
    clamp(
      Number(chart.bpm) || 120,
      30,
      300,
    );

  const playBeatPhase =
    playBeatDuration > 0
      ? (
          (
            currentTime -
            (Number(chart.offset) ||
              0)
          ) %
            playBeatDuration +
          playBeatDuration
        ) %
          playBeatDuration /
        playBeatDuration
      : 0;

  const playBeatPulse =
    1 -
    Math.min(
      playBeatPhase,
      1 - playBeatPhase,
    ) *
      2;

  const playProgressPercent =
    clamp(
      progress * 100,
      0,
      100,
    );

  const playUpcomingCount =
    visibleNotes.filter(
      (note) =>
        note.time >= currentTime,
    ).length;

  const playImpactLaneX =
    playImpactFx?.lane === "A"
      ? 29.75
      : playImpactFx?.lane === "K"
        ? 70.25
        : 50;

  const playTrailTier =
    getPlayTrailTier(combo);

  const playTrailConfig =
    PLAY_TRAIL_TIER_CONFIG[
      playTrailTier
    ];

  const playFloorLevel =
    combo >= 200
      ? 4
      : combo >= 100
        ? 3
        : combo >= 70
          ? 2
          : combo >= 30
            ? 1
            : 0;

  const playFloorOpacity =
    playFloorLevel === 4
      ? 0.34
      : playFloorLevel === 3
        ? 0.29
        : playFloorLevel === 2
          ? 0.24
          : playFloorLevel === 1
            ? 0.18
            : 0;

  const playRoadEdgeComboProgress =
    clamp(
      (combo - 4) /
        180,
      0,
      1,
    );

  const playRoadEdgeIntensity =
    playRoadEdgeComboProgress **
    1.12;

  const playRoadEdgeCoreOpacity =
    0.015 +
    playRoadEdgeIntensity *
      0.92;

  const playRoadEdgeHaloOpacity =
    0.008 +
    playRoadEdgeIntensity *
      0.56;

  const playRoadEdgeWidth =
    0.22 +
    playRoadEdgeIntensity *
      2.25;

  const playRoadEdgeGlow =
    0.8 +
    playRoadEdgeIntensity *
      22;

  const playBackgroundMediaUrl =
    currentPublishedSong?.audio_url ||
    audioUrl ||
    null;

  const playBackgroundMediaPath =
    currentPublishedSong?.audio_path ||
    "";

  const playBackgroundIsMp4 =
    Boolean(
      playBackgroundMediaUrl,
    ) &&
    (
      /\.mp4(?:$|[?#])/i.test(
        playBackgroundMediaPath,
      ) ||
      /\.mp4(?:$|[?#])/i.test(
        playBackgroundMediaUrl ||
          "",
      )
    );

  useEffect(() => {
    const video =
      playBackgroundVideoRef.current;

    const audio =
      audioRef.current;

    if (
      screen !== "play" ||
      !playBackgroundIsMp4 ||
      !playBackgroundMediaUrl ||
      !video ||
      !audio
    ) {
      if (video) {
        video.pause();
      }

      return;
    }

    let intervalId:
      | number
      | null = null;

    const hardSync = () => {
      if (
        !Number.isFinite(
          audio.currentTime,
        )
      ) {
        return;
      }

      const drift =
        Math.abs(
          video.currentTime -
            audio.currentTime,
        );

      if (
        drift > 0.18 ||
        video.currentTime === 0
      ) {
        try {
          video.currentTime =
            audio.currentTime;
        } catch {
          // Metadata may not be ready yet.
        }
      }

      video.playbackRate =
        audio.playbackRate ||
        1;

      if (
        audio.paused ||
        audio.ended
      ) {
        video.pause();
      } else if (
        video.paused
      ) {
        void video
          .play()
          .catch(
            () => undefined,
          );
      }
    };

    hardSync();

    if (!audio.paused) {
      intervalId =
        window.setInterval(
          hardSync,
          900,
        );
    }

    return () => {
      if (
        intervalId !==
        null
      ) {
        window.clearInterval(
          intervalId,
        );
      }
    };
  }, [
    isPlaying,
    playBackgroundIsMp4,
    playBackgroundMediaUrl,
    screen,
  ]);

  useEffect(() => {
    if (screen !== "play") {
      return;
    }

    const canvas =
      playTrailCanvasRef.current;

    if (!canvas) {
      return;
    }

    const resizeCanvas = () => {
      const host =
        canvas.parentElement;

      if (!host) {
        return;
      }

      const width =
        host.clientWidth;
      const height =
        host.clientHeight;

      const rawDpr =
        Math.max(
          1,
          window.devicePixelRatio ||
            1,
        );

      const area =
        width *
        height;

      const dpr =
        Math.min(
          rawDpr,
          area > 900000
            ? 1
            : area > 620000
              ? 1.1
              : 1.25,
        );

      playTrailCanvasSizeRef.current = {
        width,
        height,
        dpr,
      };

      const nextWidth =
        Math.max(
          1,
          Math.round(
            width *
              dpr,
          ),
        );

      const nextHeight =
        Math.max(
          1,
          Math.round(
            height *
              dpr,
          ),
        );

      if (
        canvas.width !==
          nextWidth ||
        canvas.height !==
          nextHeight
      ) {
        canvas.width =
          nextWidth;
        canvas.height =
          nextHeight;
      }
    };

    resizeCanvas();

    const host =
      canvas.parentElement;

    const observer =
      typeof ResizeObserver !==
        "undefined" &&
      host
        ? new ResizeObserver(
            resizeCanvas,
          )
        : null;

    if (
      observer &&
      host
    ) {
      observer.observe(
        host,
      );
    }

    window.addEventListener(
      "resize",
      resizeCanvas,
    );

    return () => {
      observer?.disconnect();

      window.removeEventListener(
        "resize",
        resizeCanvas,
      );
    };
  }, [screen]);

  useEffect(() => {
    const canvas =
      playTrailCanvasRef.current;

    if (
      screen !== "play" ||
      !canvas
    ) {
      return;
    }

    const context =
      canvas.getContext(
        "2d",
        {
          alpha: true,
          desynchronized: true,
        },
      );

    if (!context) {
      return;
    }

    let cancelled =
      false;

    const drawTrailFrame = (
      frameNow: number,
    ) => {
      if (cancelled) {
        return;
      }

      const {
        width,
        height,
        dpr,
      } =
        playTrailCanvasSizeRef.current;

      if (
        width <= 0 ||
        height <= 0
      ) {
        playTrailFrameRef.current =
          requestAnimationFrame(
            drawTrailFrame,
          );
        return;
      }

      const audio =
        audioRef.current;

      const liveTime =
        audio
          ? audio.currentTime
          : currentTime;

      const liveTier =
        getPlayTrailTier(
          comboRef.current,
        );

      if (
        playTrailTierRef.current !==
        liveTier
      ) {
        playTrailTierRef.current =
          liveTier;

        playTrailTierEnteredAtRef.current =
          frameNow;
      }

      const quality =
        playTrailQualityRef.current;

      const targetFrameMs =
        quality >= 0.82
          ? 30
          : quality >= 0.66
            ? 36
            : 44;

      const paused =
        !audio ||
        audio.paused;

      const pausedFrameMs =
        180;

      const neededFrameMs =
        paused
          ? pausedFrameMs
          : targetFrameMs;

      if (
        frameNow -
          playTrailLastDrawAtRef.current <
        neededFrameMs
      ) {
        playTrailFrameRef.current =
          requestAnimationFrame(
            drawTrailFrame,
          );
        return;
      }

      playTrailLastDrawAtRef.current =
        frameNow;

      const drawStartedAt =
        typeof performance !==
        "undefined"
          ? performance.now()
          : Date.now();

      context.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0,
      );

      context.clearRect(
        0,
        0,
        width,
        height,
      );

      // 0~9 COMBO: road is intentionally clean.
      // From 10 COMBO the trail tier and road sparkle field activate together.
      if (
        liveTier === 0
      ) {
        playTrailFrameRef.current =
          requestAnimationFrame(
            drawTrailFrame,
          );
        return;
      }

      const config =
        PLAY_TRAIL_TIER_CONFIG[
          liveTier
        ];

      const tierFade =
        clamp(
          (
            frameNow -
            playTrailTierEnteredAtRef.current
          ) /
            (
              liveTier === 1
                ? 700
                : liveTier === 2
                  ? 560
                  : 460
            ),
          0,
          1,
        );

      const maxTrailNotes =
        quality >= 0.82
          ? 8
          : quality >= 0.66
            ? 6
            : 4;

      const candidateNotes =
        notesInTimeRange(
          chart.notes,
          liveTime - 0.10,
          liveTime + 2.55,
        );

      const trailNotes =
        candidateNotes
          .filter(
            (note) =>
              !hitNotesRef.current.has(
                note.id,
              ) &&
              !missedNotesRef.current.has(
                note.id,
              ),
          )
          .slice(
            0,
            maxTrailNotes,
          );

      const animationTime =
        frameNow /
        1000;

      context.save();

      context.globalCompositeOperation =
        "lighter";

      // ======================================================
      // ROAD SPARKLE FIELD
      // Combo grows continuously -> more stars rise from the play road.
      // Every successful combo also adds a short extra stardust burst.
      // Every successful hit sends a shockwave through them.
      // PERFECT has the strongest displacement.
      // This is canvas-only: no React particle DOM nodes.
      // ======================================================
      const liveCombo =
        comboRef.current;

      const roadSparkleCount =
        getPlayRoadSparkleCount(
          liveCombo,
          quality,
        );

      if (
        roadSparkleCount >
        0
      ) {
        const impact =
          playImpactFxRef.current;

        const impactAge =
          impact
            ? Math.max(
                0,
                frameNow -
                  impact.createdAt,
              )
            : 9999;

        const impactStrength =
          impact &&
          impactAge <
            520
            ? impact.judgment ===
                "PERFECT"
              ? 1
              : impact.judgment ===
                  "GREAT"
                ? 0.52
                : impact.judgment ===
                    "GOOD"
                  ? 0.24
                  : 0
            : 0;

        const shockProgress =
          impactStrength >
          0
            ? clamp(
                impactAge /
                  520,
                0,
                1,
              )
            : 1;

        // Shock begins at the judgment line and travels upward.
        const shockFrontY =
          86 -
          shockProgress *
            72;

        const impactLaneCenter =
          impact?.lane ===
          "A"
            ? 29.75
            : impact?.lane ===
                "K"
              ? 70.25
              : 50;

        for (
          let sparkleIndex =
            0;
          sparkleIndex <
          roadSparkleCount;
          sparkleIndex += 1
        ) {
          // Spread selection through the large quality bank
          // instead of always reading the first adjacent entries.
          const presetIndex =
            (
              sparkleIndex *
                17 +
              (
                Math.floor(
                  liveTime *
                    2,
                ) %
                23
              ) *
                11
            ) %
            PLAY_ROAD_SPARKLE_PRESETS.length;

          const preset =
            PLAY_ROAD_SPARKLE_PRESETS[
              presetIndex
            ];

          const risePhase =
            (
              preset.phase +
              animationTime *
                preset.speed *
                (
                  0.82 +
                  Math.min(
                    1.9,
                    liveCombo /
                      180,
                  ) *
                    0.24
                )
            ) %
            1;

          // Bottom -> top movement inside the road.
          const yPercent =
            86 -
            risePhase *
              78;

          const bounds =
            getPlayRoadBoundsAtY(
              yPercent,
            );

          const roadWidth =
            bounds.right -
            bounds.left;

          const baseXPercent =
            bounds.left +
            roadWidth *
              preset.x;

          const lateralDrift =
            Math.sin(
              animationTime *
                (
                  0.72 +
                  preset.speed *
                    5
                ) +
                preset.shockPhase,
            ) *
            preset.drift *
            0.16 *
            (
              0.35 +
              bounds.depth *
                0.65
            );

          let xPercent =
            baseXPercent +
            lateralDrift;

          let displacedYPercent =
            yPercent;

          let shockBoost =
            0;

          if (
            impactStrength >
            0 &&
            impact
          ) {
            const waveDistance =
              Math.abs(
                yPercent -
                  shockFrontY,
              );

            if (
              waveDistance <
              12.5
            ) {
              const wavePower =
                (
                  1 -
                  waveDistance /
                    12.5
                ) *
                impactStrength *
                Math.pow(
                  1 -
                    shockProgress,
                  0.30,
                );

              const laneDistance =
                Math.abs(
                  baseXPercent -
                    impactLaneCenter,
                );

              const laneWeight =
                clamp(
                  1 -
                    laneDistance /
                      48,
                  0.28,
                  1,
                );

              const wobble =
                Math.sin(
                  preset.shockPhase +
                    shockProgress *
                      22 +
                    sparkleIndex *
                      0.71,
                );

              xPercent +=
                wobble *
                wavePower *
                laneWeight *
                (
                  0.85 +
                  Math.min(
                    2.2,
                    liveCombo /
                      110,
                  ) *
                    0.48
                );

              displacedYPercent +=
                Math.cos(
                  preset.shockPhase +
                    shockProgress *
                      18,
                ) *
                wavePower *
                0.72;

              shockBoost =
                wavePower *
                laneWeight;
            }
          }

          const x =
            (
              xPercent /
              100
            ) *
            width;

          const y =
            (
              displacedYPercent /
              100
            ) *
            height;

          const twinkleWave =
            (
              Math.sin(
                animationTime *
                  preset.twinkle +
                  preset.shockPhase,
              ) +
              1
            ) /
            2;

          const twinkle =
            0.18 +
            Math.pow(
              twinkleWave,
              3.4,
            ) *
              1.08;

          const sparklePeak =
            Math.pow(
              twinkleWave,
              6.2,
            );

          const comboEnergy =
            clamp(
              (
                liveCombo -
                10
              ) /
                150,
              0,
              1,
            );

          const depthScale =
            0.55 +
            bounds.depth *
              0.80;

          const radius =
            Math.max(
              0.55,
              preset.size *
                depthScale *
                (
                  0.58 +
                  comboEnergy *
                    0.26
                ),
            );

          const alpha =
            clamp(
              preset.opacity *
                twinkle *
                (
                  0.31 +
                  comboEnergy *
                    0.52
                ) +
                shockBoost *
                  0.42,
              0.035,
              0.92,
            );

          const colors =
            getPlayRoadSparkleColor(
              xPercent,
              preset.warmth,
              liveCombo,
            );

          // Small concentrated halo.
          context.beginPath();

          context.arc(
            x,
            y,
            radius *
              (
                1.42 +
                shockBoost *
                  0.56
              ),
            0,
            Math.PI *
              2,
          );

          context.fillStyle =
            `rgba(${colors.glow},${
              alpha *
              (
                0.085 +
                sparklePeak *
                  0.14
              )
            })`;

          context.fill();

          // Diamond star core.
          const coreRadius =
            radius *
            (
              0.48 +
              sparklePeak *
                0.32 +
              shockBoost *
                0.10
            );

          context.save();
          context.translate(
            x,
            y,
          );
          context.rotate(
            Math.PI /
              4,
          );

          context.fillStyle =
            `rgba(${colors.core},${Math.min(
              1,
              alpha *
                (
                  0.78 +
                  sparklePeak *
                    0.60
                ),
            )})`;

          context.fillRect(
            -coreRadius /
              2,
            -coreRadius /
              2,
            coreRadius,
            coreRadius,
          );

          context.restore();

          // Four-point flare.
          const mainGlint =
            radius *
            (
              2.5 +
              comboEnergy *
                2.2 +
              sparklePeak *
                3.4 +
              shockBoost *
                2.8
            );

          const verticalGlint =
            mainGlint *
            (
              1.18 +
              preset.stretch *
                0.24
            );

          const horizontalGlint =
            mainGlint *
            0.62;

          context.lineCap =
            "round";

          context.strokeStyle =
            `rgba(${colors.core},${
              Math.min(
                1,
                alpha *
                  (
                    0.30 +
                    sparklePeak *
                      0.86
                  ),
              )
            })`;

          context.lineWidth =
            Math.max(
              0.48,
              radius *
                0.15,
            );

          context.beginPath();

          context.moveTo(
            x,
            y -
              verticalGlint,
          );
          context.lineTo(
            x,
            y +
              verticalGlint,
          );

          context.moveTo(
            x -
              horizontalGlint,
            y,
          );
          context.lineTo(
            x +
              horizontalGlint,
            y,
          );

          context.stroke();

          // Diagonal rays become visible at the sparkle peak and at higher combos.
          if (
            sparklePeak >
              0.30 ||
            shockBoost >
              0.14 ||
            liveCombo >=
              100
          ) {
            const diagonal =
              mainGlint *
              (
                0.28 +
                sparklePeak *
                  0.24
              );

            context.strokeStyle =
              `rgba(${colors.core},${
                Math.min(
                  0.74,
                  alpha *
                    (
                      0.14 +
                      sparklePeak *
                        0.46
                    ),
                )
              })`;

            context.lineWidth =
              Math.max(
                0.38,
                radius *
                  0.095,
              );

            context.beginPath();

            context.moveTo(
              x -
                diagonal,
              y -
                diagonal,
            );
            context.lineTo(
              x +
                diagonal,
              y +
                diagonal,
            );

            context.moveTo(
              x +
                diagonal,
              y -
                diagonal,
            );
            context.lineTo(
              x -
                diagonal,
              y +
                diagonal,
            );

            context.stroke();
          }

          // White-hot center point.
          context.beginPath();

          context.arc(
            x,
            y,
            Math.max(
              0.42,
              radius *
                0.22,
            ),
            0,
            Math.PI *
              2,
          );

          context.fillStyle =
            `rgba(255,255,255,${
              Math.min(
                1,
                alpha *
                  (
                    0.68 +
                    sparklePeak *
                      0.58
                  ),
              )
            })`;

          context.fill();
        }

        // ====================================================
        // HIT STARDUST BURST
        // Each successful key hit throws additional star dust from the road.
        // Higher combo = more particles. PERFECT is the strongest.
        // Kept in the same Canvas for performance.
        // ====================================================
        if (
          impact &&
          impactStrength >
            0 &&
          impactAge <
            460
        ) {
          const burstCount =
            getPlayRoadHitBurstCount(
              Math.max(
                1,
                impact.combo,
              ),
              impact.judgment,
              quality,
            );

          const burstProgress =
            clamp(
              impactAge /
                460,
              0,
              1,
            );

          const burstLaneX =
            impact.lane === "A"
              ? 29.75
              : impact.lane === "K"
                ? 70.25
                : 50;

          const burstOriginY =
            84.5;

          for (
            let burstIndex =
              0;
            burstIndex <
            burstCount;
            burstIndex += 1
          ) {
            const preset =
              PLAY_ROAD_SPARKLE_PRESETS[
                (
                  impact.id *
                    31 +
                  burstIndex *
                    13
                ) %
                  PLAY_ROAD_SPARKLE_PRESETS.length
              ];

            const angle =
              (
                -112 +
                (
                  burstIndex /
                  Math.max(
                    1,
                    burstCount -
                      1,
                  )
                ) *
                  44
              ) +
              preset.drift *
                1.8;

            const angleRad =
              (
                angle *
                Math.PI
              ) /
              180;

            const burstDistance =
              (
                4 +
                preset.size *
                  1.7 +
                impact.combo *
                  0.018
              ) *
              (
                0.26 +
                burstProgress *
                  1.12
              );

            const sideBias =
              impact.lane === "A"
                ? -1
                : impact.lane === "K"
                  ? 1
                  : 0;

            const xPercent =
              burstLaneX +
              Math.cos(
                angleRad,
              ) *
                burstDistance *
                0.66 +
              sideBias *
                burstProgress *
                0.42;

            const yPercent =
              burstOriginY +
              Math.sin(
                angleRad,
              ) *
                burstDistance *
                0.76 -
              burstProgress *
                (
                  3.5 +
                  preset.speed *
                    14
                );

            const bounds =
              getPlayRoadBoundsAtY(
                yPercent,
              );

            if (
              xPercent <
                bounds.left -
                  1 ||
              xPercent >
                bounds.right +
                  1
            ) {
              continue;
            }

            const x =
              (
                xPercent /
                100
              ) *
              width;

            const y =
              (
                yPercent /
                100
              ) *
              height;

            const fade =
              Math.pow(
                1 -
                  burstProgress,
                0.72,
              );

            const twinkle =
              0.74 +
              Math.sin(
                animationTime *
                  preset.twinkle +
                  preset.shockPhase,
              ) *
                0.22;

            const alpha =
              clamp(
                preset.opacity *
                  fade *
                  twinkle *
                  (
                    impact.judgment ===
                    "PERFECT"
                      ? 1.24
                      : impact.judgment ===
                          "GREAT"
                        ? 0.88
                        : 0.62
                  ),
                0,
                1,
              );

            const size =
              Math.max(
                0.8,
                preset.size *
                  (
                    0.72 +
                    impact.combo *
                      0.0018
                  ) *
                  (
                    1 -
                    burstProgress *
                      0.28
                  ),
              );

            const colors =
              getPlayRoadSparkleColor(
                xPercent,
                preset.warmth,
                impact.combo,
              );

            // Glow body.
            context.beginPath();

            context.arc(
              x,
              y,
              size *
                2.1,
              0,
              Math.PI *
                2,
            );

            context.fillStyle =
              `rgba(${colors.glow},${
                alpha *
                0.16
              })`;

            context.fill();

            // Bright star core: diamond + cross flare.
            context.save();

            context.translate(
              x,
              y,
            );

            context.rotate(
              Math.PI /
                4,
            );

            context.fillStyle =
              `rgba(${colors.core},${alpha})`;

            context.fillRect(
              -size *
                0.34,
              -size *
                0.34,
              size *
                0.68,
              size *
                0.68,
            );

            context.restore();

            const burstGlint =
              size *
              (
                1.70 +
                impact.combo *
                  0.0028
              );

            context.strokeStyle =
              `rgba(${colors.core},${
                alpha *
                0.66
              })`;

            context.lineWidth =
              Math.max(
                0.42,
                size *
                  0.15,
              );

            context.beginPath();

            context.moveTo(
              x,
              y -
                burstGlint *
                  1.26,
            );
            context.lineTo(
              x,
              y +
                burstGlint *
                  1.26,
            );

            context.moveTo(
              x -
                burstGlint,
              y,
            );
            context.lineTo(
              x +
                burstGlint,
              y,
            );

            context.stroke();

            // Short moving trail behind each burst particle.
            if (
              burstIndex %
                (
                  impact.combo >=
                  150
                    ? 2
                    : 3
                ) ===
              0
            ) {
              const tailLength =
                size *
                (
                  3.2 +
                  impact.combo *
                    0.008
                );

              context.strokeStyle =
                `rgba(${colors.core},${
                  alpha *
                  0.38
                })`;

              context.lineWidth =
                Math.max(
                  0.5,
                  size *
                    0.22,
                );

              context.beginPath();

              context.moveTo(
                x,
                y,
              );

              context.lineTo(
                x -
                  Math.cos(
                    angleRad,
                  ) *
                    tailLength,
                y -
                  Math.sin(
                    angleRad,
                  ) *
                    tailLength,
              );

              context.stroke();
            }
          }
        }
      }

      trailNotes.forEach(
        (note) => {
          const remaining =
            note.time -
            liveTime;

          const rawTravel =
            clamp(
              1 -
                remaining /
                  2.55,
              0,
              1,
            );

          if (
            rawTravel <=
            0.018
          ) {
            return;
          }

          const presetOffset =
            getPlayTrailPresetOffset(
              note.id,
            );

          const motionPreset =
            getPlayTrailMotionPreset(
              presetOffset,
            );

          const laneRgb =
            note.lane ===
            "A"
              ? "34,211,238"
              : "217,70,239";

          const laneBrightRgb =
            note.lane ===
            "A"
              ? "207,250,254"
              : "250,232,255";

          const trailLength =
            Math.min(
              config.length *
                (
                  0.94 +
                  motionPreset.widthBias *
                    0.06
                ),
              rawTravel *
                0.91,
            );

          if (
            trailLength <=
            0.006
          ) {
            return;
          }

          const baseGhostCount =
            liveTier === 1
              ? 5
              : liveTier === 2
                ? 7
                : 9;

          const ghostCount =
            Math.max(
              3,
              Math.round(
                baseGhostCount *
                  quality,
              ),
            );

          const phase =
            (
              animationTime /
                Math.max(
                  0.38,
                  motionPreset.sweep,
                ) +
              (
                presetOffset %
                31
              ) /
                31
            ) %
            1;

          const breathe =
            0.94 +
            Math.sin(
              animationTime *
                (
                  4.8 +
                  motionPreset.shimmer *
                    1.4
                ) +
                presetOffset *
                  0.11,
            ) *
              0.06;

          // One broad bloom near the block instead of shadowBlur on every ghost.
          // This keeps the source attached to the block while avoiding a huge paint cost.
          const liveLayout =
            getPlayPerspectiveLayout(
              note.lane,
              rawTravel,
            );

          const liveX =
            (
              liveLayout.x /
              100
            ) *
            width;

          const liveY =
            (
              liveLayout.y /
              100
            ) *
            height;

          const liveWidth =
            (
              liveLayout.widthPercent /
              100
            ) *
            width;

          const liveHeight =
            liveLayout.heightPx;

          tracePlayTrailRoundedBlock(
            context,
            liveX,
            liveY,
            liveWidth *
              1.10,
            liveHeight *
              1.14,
            Math.max(
              4,
              liveHeight *
                0.30,
            ),
          );

          context.fillStyle =
            `rgba(${laneRgb},${
              (
                0.040 +
                liveTier *
                  0.018
              ) *
              tierFade
            })`;

          context.shadowColor =
            `rgba(${laneRgb},${
              0.18 +
              liveTier *
                0.05
            })`;

          context.shadowBlur =
            (
              9 +
              liveTier *
                4
            ) *
            quality;

          context.fill();

          context.shadowBlur =
            0;

          // Main motion persistence: actual block silhouettes only.
          for (
            let ghostIndex = 0;
            ghostIndex <
            ghostCount;
            ghostIndex += 1
          ) {
            const ratio =
              clamp(
                (
                  ghostIndex +
                  0.46 +
                  phase *
                    0.14
                ) /
                  (
                    ghostCount +
                    0.60
                  ),
                0.03,
                0.985,
              );

            const ghostTravel =
              clamp(
                rawTravel -
                  trailLength *
                    ratio,
                0,
                rawTravel,
              );

            if (
              ghostTravel <=
              0.002
            ) {
              continue;
            }

            const ghostLayout =
              getPlayPerspectiveLayout(
                note.lane,
                ghostTravel,
              );

            const centerX =
              (
                ghostLayout.x /
                100
              ) *
              width;

            const centerY =
              (
                ghostLayout.y /
                100
              ) *
              height;

            const ghostWidth =
              (
                ghostLayout.widthPercent /
                100
              ) *
              width *
              (
                0.995 -
                ratio *
                  0.030
              );

            const ghostHeight =
              ghostLayout.heightPx *
              (
                0.975 -
                ratio *
                  0.030
              );

            const fade =
              Math.pow(
                1 -
                  ratio,
                2.05,
              );

            const alpha =
              fade *
              (
                liveTier === 1
                  ? 0.105
                  : liveTier === 2
                    ? 0.145
                    : 0.185
              ) *
              tierFade *
              breathe *
              motionPreset.alphaBias;

            if (
              alpha <=
              0.003
            ) {
              continue;
            }

            tracePlayTrailRoundedBlock(
              context,
              centerX,
              centerY,
              ghostWidth,
              ghostHeight,
              Math.max(
                4,
                ghostHeight *
                  0.26,
              ),
            );

            context.fillStyle =
              ghostIndex <= 1
                ? `rgba(${laneBrightRgb},${alpha * 0.68})`
                : `rgba(${laneRgb},${alpha})`;

            context.fill();

            if (
              ghostIndex <= 1 &&
              quality >= 0.70
            ) {
              context.strokeStyle =
                `rgba(${laneBrightRgb},${alpha * 0.42})`;

              context.lineWidth =
                ghostIndex === 0
                  ? 0.9
                  : 0.65;

              context.stroke();
            }
          }

          // One moving block-shaped highlight, not a line.
          if (
            liveTier >= 2 &&
            quality >= 0.62
          ) {
            const highlightPhase =
              (
                phase *
                  0.92 +
                0.08
              ) %
              1;

            const highlightTravel =
              clamp(
                rawTravel -
                  trailLength *
                    (
                      0.10 +
                      highlightPhase *
                        0.54
                    ),
                0,
                rawTravel,
              );

            const highlightLayout =
              getPlayPerspectiveLayout(
                note.lane,
                highlightTravel,
              );

            const highlightX =
              (
                highlightLayout.x /
                100
              ) *
              width;

            const highlightY =
              (
                highlightLayout.y /
                100
              ) *
              height;

            const highlightWidth =
              (
                highlightLayout.widthPercent /
                100
              ) *
              width *
              0.72;

            const highlightHeight =
              highlightLayout.heightPx *
              0.40;

            tracePlayTrailRoundedBlock(
              context,
              highlightX,
              highlightY,
              highlightWidth,
              highlightHeight,
              Math.max(
                3,
                highlightHeight *
                  0.35,
              ),
            );

            context.fillStyle =
              `rgba(255,255,255,${
                (
                  1 -
                  highlightPhase
                ) *
                0.055 *
                tierFade *
                motionPreset.shimmer
              })`;

            context.fill();
          }

          // Tiny canvas dust only at high tiers and only when quality allows it.
          if (
            liveTier >= 2 &&
            quality >= 0.72
          ) {
            const dustCount =
              liveTier === 2
                ? 1
                : 2;

            for (
              let dustIndex = 0;
              dustIndex <
              dustCount;
              dustIndex += 1
            ) {
              const dustPreset =
                getPlayTrailSparkPreset(
                  presetOffset +
                    dustIndex *
                      17,
                );

              const dustPhase =
                (
                  animationTime /
                    Math.max(
                      0.40,
                      dustPreset.duration,
                    ) +
                  dustIndex *
                    0.29 +
                  presetOffset *
                    0.009
                ) %
                1;

              const dustTravel =
                clamp(
                  rawTravel -
                    trailLength *
                      (
                        0.20 +
                        dustPhase *
                          0.60
                      ),
                  0,
                  rawTravel,
                );

              const dustPoint =
                getPlayPerspectiveLayout(
                  note.lane,
                  dustTravel,
                );

              const x =
                (
                  dustPoint.x /
                  100
                ) *
                  width +
                dustPreset.offsetX *
                  0.46;

              const y =
                (
                  dustPoint.y /
                  100
                ) *
                  height -
                dustPhase *
                  3;

              context.beginPath();

              context.arc(
                x,
                y,
                Math.max(
                  0.55,
                  dustPreset.radius *
                    0.48,
                ),
                0,
                Math.PI *
                  2,
              );

              context.fillStyle =
                `rgba(${laneBrightRgb},${
                  (
                    1 -
                    dustPhase
                  ) *
                  0.14 *
                  tierFade
                })`;

              context.fill();
            }
          }
        },
      );

      context.restore();

      const drawFinishedAt =
        typeof performance !==
        "undefined"
          ? performance.now()
          : Date.now();

      const cost =
        Math.max(
          0,
          drawFinishedAt -
            drawStartedAt,
        );

      const previousCost =
        playTrailCostEmaRef.current;

      const nextCost =
        previousCost <= 0
          ? cost
          : previousCost *
              0.86 +
            cost *
              0.14;

      playTrailCostEmaRef.current =
        nextCost;

      // Adaptive quality: reacts slowly, so visual level doesn't visibly flicker.
      if (
        nextCost > 11.5 &&
        playTrailQualityRef.current >
          0.58
      ) {
        playTrailQualityRef.current =
          Math.max(
            0.56,
            playTrailQualityRef.current -
              0.035,
          );
      } else if (
        nextCost < 6.5 &&
        playTrailQualityRef.current <
          1
      ) {
        playTrailQualityRef.current =
          Math.min(
            1,
            playTrailQualityRef.current +
              0.008,
          );
      }

      playTrailFrameRef.current =
        requestAnimationFrame(
          drawTrailFrame,
        );
    };

    playTrailLastDrawAtRef.current =
      0;

    playTrailCostEmaRef.current =
      0;

    playTrailFrameRef.current =
      requestAnimationFrame(
        drawTrailFrame,
      );

    return () => {
      cancelled =
        true;

      if (
        playTrailFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          playTrailFrameRef.current,
        );

        playTrailFrameRef.current =
          null;
      }

      context.setTransform(
        1,
        0,
        0,
        1,
        0,
        0,
      );

      context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height,
      );
    };
  }, [
    chart.notes,
    screen,
  ]);

  const playImpactTone =
    playImpactFx?.judgment ===
    "PERFECT"
      ? "violet"
      : playImpactFx?.judgment ===
          "GREAT"
        ? "cyan"
        : playImpactFx?.judgment ===
            "GOOD"
          ? "amber"
          : "rose";

  if (!mounted) return null;

  return createPortal(
    <section className="fixed inset-0 z-[1000000] overflow-hidden bg-[#050712] text-white">
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        preload="metadata"
        onCanPlay={() => {
          if (
            screen === "editor" &&
            pendingAudioSongId ===
              song.id
          ) {
            setAnalysisMessage(
              `재생 준비 완료 · ${audioName || "등록한 음원"}`,
            );
          }
        }}
        onError={(event) => {
          if (screen !== "editor") {
            return;
          }

          const mediaError =
            event.currentTarget.error;

          const detail =
            mediaError?.message ||
            (
              mediaError?.code === 4
                ? "브라우저가 이 파일의 오디오 코덱을 재생할 수 없습니다. MP4라면 AAC 오디오 트랙이 포함된 파일을 권장합니다."
                : mediaError?.code === 3
                  ? "음원 파일을 디코딩하지 못했습니다."
                  : mediaError?.code === 2
                    ? "음원 데이터를 읽는 중 오류가 발생했습니다."
                    : "음원을 재생할 수 없습니다."
            );

          setAnalysisMessage(
            `음원 재생 오류 · ${detail}`,
          );
          setEditorNotice(
            `파일은 선택됐지만 재생 준비에 실패했습니다. ${detail}`,
          );
        }}
        onSeeked={(event) => {
          const video =
            playBackgroundVideoRef.current;

          if (
            screen === "play" &&
            playBackgroundIsMp4 &&
            video
          ) {
            try {
              video.currentTime =
                event.currentTarget.currentTime;
            } catch {
              // Video metadata may still be loading.
            }
          }
        }}
        onLoadedMetadata={(event) => {
          if (
            Number.isFinite(
              event.currentTarget.duration,
            ) &&
            event.currentTarget.duration > 0
          ) {
            rememberMediaDuration(
              event.currentTarget.duration,
              event.currentTarget.currentSrc ||
                event.currentTarget.src ||
                audioUrl,
            );
          }

          event.currentTarget.playbackRate =
            playbackRate;
          event.currentTarget.volume =
            editorVolume;
        }}
        onEnded={() => {
          if (screen === "play") finishGame();
          else {
            setIsPlaying(false);
            stopFrameLoop();
          }
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,video/mp4,.wav,.mp3,.m4a,.mp4,.aac,.flac,.ogg,.oga,.opus,.webm,.aif,.aiff"
        className="absolute h-px w-px -translate-x-[9999px] opacity-0"
        tabIndex={-1}
        onClick={(event) => {
          event.currentTarget.value = "";
        }}
        onChange={handleAudioFile}
      />
      <input
        ref={coverFileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleCoverFile}
      />

      {screen !== "play" && (
        <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(117,88,220,0.28),transparent_38%),radial-gradient(circle_at_82%_72%,rgba(59,130,246,0.16),transparent_28%),linear-gradient(180deg,#060917_0%,#0b1022_45%,#070812_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle,#fff_0.8px,transparent_0.9px)] [background-size:36px_36px]" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />

        </>
      )}

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        {screen !== "home" && screen !== "select" && screen !== "play" && (
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/10 px-4 py-3 sm:px-7 lg:px-10">
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-[0.34em] text-violet-200/60 sm:text-xs">HOO RHYTHM</p>
              <h1 className="truncate text-lg font-black tracking-[0.06em] sm:text-2xl">
                {screen === "editor" ? "수동 리듬 작업실" : "음악이 머무는 또 하나의 밤"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { resetPlay(); setIsRecording(false); setScreen("home"); }} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white/70 transition hover:bg-white/10 sm:text-sm">메인</button>
              <button
                type="button"
                onClick={() => {
                  resetPlay();
                  setIsRecording(false);
                  setScreen("select");
                }}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white/80 transition hover:bg-white/10 sm:text-sm"
              >
                곡 선택
              </button>
              <button type="button" onClick={() => { resetPlay(); onExit(); }} className="rounded-full border border-white/20 bg-black/20 px-4 py-2 text-xs font-black transition hover:bg-white/10 sm:text-sm">나가기</button>
            </div>
          </header>
        )}

        {screen === "home" && (
          <main className="relative min-h-0 flex-1 overflow-hidden bg-[#02030a]">
            <style>{`
              @keyframes hooMainNebulaA {
                0%, 100% { transform: translate3d(-50%, 0, 0) scale(1); opacity: .82; }
                50% { transform: translate3d(-50%, 18px, 0) scale(1.045); opacity: 1; }
              }

              @keyframes hooMainNebulaB {
                0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
                50% { transform: translate3d(20px, -14px, 0) scale(1.055); }
              }

              @keyframes hooMainStarsNear {
                from { transform: translate3d(0, 0, 0); }
                to { transform: translate3d(-36px, 36px, 0); }
              }

              @keyframes hooMainStarsFar {
                from { transform: translate3d(0, 0, 0); }
                to { transform: translate3d(64px, -22px, 0); }
              }

              @keyframes hooMainPortalBreath {
                0%, 100% { transform: scale(1); filter: brightness(.97) saturate(.98); }
                50% { transform: scale(1.014); filter: brightness(1.055) saturate(1.04); }
              }

              @keyframes hooMainCorePulse {
                0%, 100% { opacity: .82; transform: translate(-50%, -50%) scale(.94); }
                50% { opacity: 1; transform: translate(-50%, -50%) scale(1.07); }
              }

              @keyframes hooMainFlareX {
                0%, 100% { opacity: .20; transform: translate(-50%, -50%) scaleX(.72); }
                50% { opacity: .52; transform: translate(-50%, -50%) scaleX(1.06); }
              }

              @keyframes hooMainFlareY {
                0%, 100% { opacity: .14; transform: translate(-50%, -50%) scaleY(.74); }
                50% { opacity: .38; transform: translate(-50%, -50%) scaleY(1.05); }
              }

              @keyframes hooMainOrbitA {
                from { transform: translate(-50%, -50%) rotate(-18deg); }
                to { transform: translate(-50%, -50%) rotate(342deg); }
              }

              @keyframes hooMainOrbitB {
                from { transform: translate(-50%, -50%) rotate(42deg); }
                to { transform: translate(-50%, -50%) rotate(-318deg); }
              }

              @keyframes hooMainOrbitC {
                from { transform: translate(-50%, -50%) rotate(91deg); }
                to { transform: translate(-50%, -50%) rotate(451deg); }
              }

              @keyframes hooMainOrbitDot {
                0%, 100% { opacity: .15; transform: translateY(-50%) scale(.7); }
                50% { opacity: .85; transform: translateY(-50%) scale(1.15); }
              }

              @keyframes hooMainBeamLeft {
                0%, 100% { transform: translateX(-50%) rotate(-8deg) scaleX(.96); opacity: .54; }
                50% { transform: translateX(-50%) rotate(8deg) scaleX(1.04); opacity: .78; }
              }

              @keyframes hooMainBeamLeftSoft {
                0%, 100% { transform: translateX(-50%) rotate(-14deg) scaleX(1); opacity: .32; }
                50% { transform: translateX(-50%) rotate(2deg) scaleX(1.06); opacity: .54; }
              }

              @keyframes hooMainBeamCenter {
                0%, 100% { transform: translateX(-50%) rotate(-2deg) scaleX(.97); opacity: .48; }
                50% { transform: translateX(-50%) rotate(3deg) scaleX(1.03); opacity: .72; }
              }

              @keyframes hooMainBeamRight {
                0%, 100% { transform: translateX(-50%) rotate(8deg) scaleX(.96); opacity: .54; }
                50% { transform: translateX(-50%) rotate(-8deg) scaleX(1.04); opacity: .78; }
              }

              @keyframes hooMainBeamRightSoft {
                0%, 100% { transform: translateX(-50%) rotate(14deg) scaleX(1); opacity: .32; }
                50% { transform: translateX(-50%) rotate(-2deg) scaleX(1.06); opacity: .54; }
              }

              @keyframes hooMainStageBreathe {
                0%, 100% { opacity: .78; transform: translateX(-50%) scale(1); }
                50% { opacity: .98; transform: translateX(-50%) scale(1.018); }
              }

              @keyframes hooMainFootLight {
                0%, 100% { opacity: .34; transform: scale(.9); }
                50% { opacity: .76; transform: scale(1.08); }
              }

              @keyframes hooMainFogLeft {
                0%, 100% { transform: translateX(-6%) scaleX(1); opacity: .12; }
                50% { transform: translateX(7%) scaleX(1.08); opacity: .24; }
              }

              @keyframes hooMainFogRight {
                0%, 100% { transform: translateX(5%) scaleX(1); opacity: .10; }
                50% { transform: translateX(-7%) scaleX(1.06); opacity: .22; }
              }

              @keyframes hooMainParticle {
                0%, 100% { transform: translate3d(0, 0, 0) scale(.75); opacity: .08; }
                25% { opacity: .55; }
                50% { transform: translate3d(8px, -12px, 0) scale(1); opacity: .30; }
                78% { opacity: .42; }
              }

              @keyframes hooMainWave {
                0%, 100% { opacity: .24; transform: scaleY(.68); }
                50% { opacity: .64; transform: scaleY(1); }
              }

              @keyframes hooMainKeyLine {
                0%, 100% { opacity: .18; transform: scaleX(.72); }
                50% { opacity: .48; transform: scaleX(1); }
              }

              @keyframes hooMainShimmer {
                0% { transform: translateX(-170%) skewX(-18deg); opacity: 0; }
                20% { opacity: .24; }
                56% { opacity: .07; }
                100% { transform: translateX(285%) skewX(-18deg); opacity: 0; }
              }

              @keyframes hooMainTwinkle {
                0%, 100% { opacity: .20; transform: scale(.78); }
                45% { opacity: .95; transform: scale(1.08); }
                60% { opacity: .52; transform: scale(.92); }
              }

              @keyframes hooMainGalaxyDrift {
                0%, 100% { transform: translate3d(-50%, 0, 0) rotate(-13deg) scale(1); opacity: .32; }
                50% { transform: translate3d(-50%, -10px, 0) rotate(-11deg) scale(1.035); opacity: .44; }
              }

              @keyframes hooMainShootingStar {
                0%, 74% {
                  opacity: 0;
                  transform: translate3d(0, 0, 0) rotate(-19deg) scaleX(.2);
                }
                78% { opacity: .9; }
                92% {
                  opacity: .06;
                  transform: translate3d(280px, 98px, 0) rotate(-19deg) scaleX(1);
                }
                100% { opacity: 0; }
              }

              @keyframes hooMainPlanetFloat {
                0%, 100% { transform: translateY(0) rotate(-10deg); }
                50% { transform: translateY(-8px) rotate(-8deg); }
              }

              @keyframes hooMainConstellationPulse {
                0%, 100% { opacity: .10; }
                50% { opacity: .26; }
              }

              .hoo-main-nebula-a { animation: hooMainNebulaA 13s ease-in-out infinite; }
              .hoo-main-nebula-b { animation: hooMainNebulaB 16s ease-in-out infinite; }
              .hoo-main-stars-near { animation: hooMainStarsNear 46s linear infinite; }
              .hoo-main-stars-far { animation: hooMainStarsFar 80s linear infinite; }
              .hoo-main-portal { animation: hooMainPortalBreath 7s ease-in-out infinite; transform-origin: 50% 50%; }
              .hoo-main-core { animation: hooMainCorePulse 3.6s ease-in-out infinite; }
              .hoo-main-flare-x { animation: hooMainFlareX 3.6s ease-in-out infinite; }
              .hoo-main-flare-y { animation: hooMainFlareY 3.6s ease-in-out infinite; }
              .hoo-main-orbit-a { animation: hooMainOrbitA 34s linear infinite; }
              .hoo-main-orbit-b { animation: hooMainOrbitB 46s linear infinite; }
              .hoo-main-orbit-c { animation: hooMainOrbitC 64s linear infinite; }
              .hoo-main-orbit-dot { animation: hooMainOrbitDot 3.8s ease-in-out infinite; }
              .hoo-main-beam-left { animation: hooMainBeamLeft 8.2s ease-in-out infinite; transform-origin: 50% 100%; }
              .hoo-main-beam-left-soft { animation: hooMainBeamLeftSoft 11s ease-in-out infinite; transform-origin: 50% 100%; }
              .hoo-main-beam-center { animation: hooMainBeamCenter 10.8s ease-in-out infinite; transform-origin: 50% 100%; }
              .hoo-main-beam-right { animation: hooMainBeamRight 8.6s ease-in-out infinite; transform-origin: 50% 100%; }
              .hoo-main-beam-right-soft { animation: hooMainBeamRightSoft 11.5s ease-in-out infinite; transform-origin: 50% 100%; }
              .hoo-main-stage { animation: hooMainStageBreathe 5.8s ease-in-out infinite; }
              .hoo-main-footlight { animation: hooMainFootLight 4.2s ease-in-out infinite; }
              .hoo-main-fog-left { animation: hooMainFogLeft 15s ease-in-out infinite; }
              .hoo-main-fog-right { animation: hooMainFogRight 17s ease-in-out infinite; }
              .hoo-main-particle { animation: hooMainParticle 5.8s ease-in-out infinite; }
              .hoo-main-wave { animation: hooMainWave 2.9s ease-in-out infinite; transform-origin: bottom; }
              .hoo-main-key-line { animation: hooMainKeyLine 4s ease-in-out infinite; }
              .hoo-main-shimmer { animation: hooMainShimmer 3.8s ease-in-out infinite; }
              .hoo-main-twinkle { animation: hooMainTwinkle 3.6s ease-in-out infinite; }
              .hoo-main-galaxy { animation: hooMainGalaxyDrift 18s ease-in-out infinite; }
              .hoo-main-shooting-star { animation: hooMainShootingStar 10s ease-out infinite; }
              .hoo-main-planet { animation: hooMainPlanetFloat 9s ease-in-out infinite; }
              .hoo-main-constellation { animation: hooMainConstellationPulse 7s ease-in-out infinite; }

              @media (prefers-reduced-motion: reduce) {
                .hoo-main-nebula-a,
                .hoo-main-nebula-b,
                .hoo-main-stars-near,
                .hoo-main-stars-far,
                .hoo-main-portal,
                .hoo-main-core,
                .hoo-main-flare-x,
                .hoo-main-flare-y,
                .hoo-main-orbit-a,
                .hoo-main-orbit-b,
                .hoo-main-orbit-c,
                .hoo-main-orbit-dot,
                .hoo-main-beam-left,
                .hoo-main-beam-left-soft,
                .hoo-main-beam-center,
                .hoo-main-beam-right,
                .hoo-main-beam-right-soft,
                .hoo-main-stage,
                .hoo-main-footlight,
                .hoo-main-fog-left,
                .hoo-main-fog-right,
                .hoo-main-particle,
                .hoo-main-wave,
                .hoo-main-key-line,
                .hoo-main-shimmer,
                .hoo-main-twinkle,
                .hoo-main-galaxy,
                .hoo-main-shooting-star,
                .hoo-main-planet,
                .hoo-main-constellation {
                  animation: none !important;
                }
              }
            `}</style>

            {/* =========================================================
                SPACE / HOO WORLD NIGHT
            ========================================================== */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#02030a_0%,#050817_34%,#07111f_68%,#020409_100%)]" />
              <div className="absolute inset-y-0 left-1/2 w-[70%] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(76,29,149,.045),rgba(37,99,235,.024),rgba(124,58,237,.036),transparent)]" />
              <div className="hoo-main-nebula-a absolute left-1/2 top-[-34%] h-[900px] w-[1320px] rounded-full bg-violet-500/[0.11] blur-[182px]" />
              <div className="hoo-main-nebula-b absolute -left-72 top-[18%] h-[700px] w-[700px] rounded-full bg-cyan-500/[0.04] blur-[176px]" />
              <div className="hoo-main-nebula-b absolute -right-72 top-[18%] h-[720px] w-[720px] rounded-full bg-fuchsia-500/[0.038] blur-[182px]" style={{ animationDelay: "2.2s" }} />

              <div className="hoo-main-stars-far absolute -inset-[96px] opacity-[0.30] [background-image:radial-gradient(circle,rgba(255,255,255,.96)_0_.72px,transparent_1px)] [background-size:39px_39px]" />
              <div className="hoo-main-stars-near absolute -inset-[96px] opacity-[0.18] [background-image:radial-gradient(circle,rgba(196,181,253,.95)_0_1.05px,transparent_1.3px)] [background-position:24px_17px] [background-size:96px_96px]" />

              {/* =========================================================
                  DEEP SPACE LAYER
                  이번 버전은 일부러 눈에 보이게 우주 밀도를 올린다.
              ========================================================== */}

              {/* 큰 은하수 띠 */}
              <div
                className="hoo-main-galaxy absolute left-1/2 top-[18%] h-[330px] w-[132%] -translate-x-1/2 mix-blend-screen"
                style={{
                  background:
                    "linear-gradient(90deg,transparent 0%,rgba(14,165,233,.035) 12%,rgba(99,102,241,.12) 30%,rgba(196,181,253,.26) 44%,rgba(255,255,255,.20) 50%,rgba(216,180,254,.23) 57%,rgba(147,51,234,.12) 70%,rgba(37,99,235,.045) 87%,transparent 100%)",
                  filter: "blur(30px)",
                  WebkitMaskImage:
                    "linear-gradient(180deg,transparent 0%,rgba(0,0,0,.28) 12%,rgba(0,0,0,1) 47%,rgba(0,0,0,.46) 82%,transparent 100%)",
                  maskImage:
                    "linear-gradient(180deg,transparent 0%,rgba(0,0,0,.28) 12%,rgba(0,0,0,1) 47%,rgba(0,0,0,.46) 82%,transparent 100%)",
                }}
              />

              {/* 은하수의 먼지 결 */}
              <div
                className="absolute left-1/2 top-[15%] h-[390px] w-[125%] -translate-x-1/2 -rotate-[12deg] opacity-[0.34] mix-blend-screen"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse at 18% 48%,rgba(59,130,246,.17),transparent 30%),radial-gradient(ellipse at 36% 42%,rgba(139,92,246,.19),transparent 28%),radial-gradient(ellipse at 52% 50%,rgba(255,255,255,.12),transparent 24%),radial-gradient(ellipse at 68% 46%,rgba(217,70,239,.16),transparent 28%),radial-gradient(ellipse at 84% 52%,rgba(56,189,248,.13),transparent 30%)",
                  filter: "blur(18px)",
                }}
              />

              {/* 좌우 성운 덩어리 */}
              <div className="absolute -left-[8%] top-[9%] h-[420px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(14,165,233,.12),rgba(37,99,235,.055)_38%,transparent_72%)] blur-[36px]" />
              <div className="absolute -right-[7%] top-[12%] h-[430px] w-[540px] rounded-full bg-[radial-gradient(circle_at_center,rgba(168,85,247,.14),rgba(217,70,239,.055)_40%,transparent_72%)] blur-[38px]" />

              {/* 화면 전체에 보이는 실제 별들 */}
              {[
                ["4%","12%",2,"#ffffff","0s"], ["8%","31%",3,"#dbeafe","1.1s"],
                ["12%","19%",2,"#ede9fe","2.1s"], ["16%","47%",2,"#ffffff",".5s"],
                ["20%","10%",3,"#ffffff","2.8s"], ["23%","36%",2,"#bae6fd","1.6s"],
                ["27%","22%",4,"#ffffff","3.2s"], ["31%","52%",2,"#ddd6fe",".8s"],
                ["35%","14%",2,"#ffffff","1.9s"], ["39%","30%",3,"#e0e7ff","2.5s"],
                ["43%","8%",2,"#ffffff",".4s"], ["47%","39%",2,"#bae6fd","3.0s"],
                ["53%","18%",3,"#ffffff","1.3s"], ["57%","34%",2,"#f5d0fe","2.2s"],
                ["61%","11%",2,"#ffffff","3.4s"], ["65%","46%",3,"#ddd6fe",".7s"],
                ["69%","25%",2,"#bae6fd","1.8s"], ["73%","8%",4,"#ffffff","2.7s"],
                ["77%","37%",2,"#f5d0fe",".3s"], ["81%","20%",3,"#ffffff","3.1s"],
                ["85%","49%",2,"#bae6fd","1.2s"], ["89%","13%",2,"#ffffff","2.4s"],
                ["93%","30%",3,"#ede9fe",".9s"], ["96%","18%",2,"#ffffff","3.6s"],
                ["6%","58%",2,"#bae6fd","2.6s"], ["14%","62%",2,"#ffffff","1.4s"],
                ["22%","69%",3,"#ddd6fe",".6s"], ["32%","61%",2,"#ffffff","3.2s"],
                ["68%","63%",2,"#bae6fd","1.0s"], ["78%","70%",3,"#ffffff","2.0s"],
                ["88%","60%",2,"#f5d0fe","3.0s"], ["95%","67%",2,"#ffffff",".2s"],
              ].map(([left, top, size, color, delay], index) => (
                <span
                  key={`space-star-${index}`}
                  className="hoo-main-twinkle absolute rounded-full"
                  style={{
                    left: String(left),
                    top: String(top),
                    width: `${Number(size)}px`,
                    height: `${Number(size)}px`,
                    background: String(color),
                    animationDelay: String(delay),
                    boxShadow: `0 0 ${Number(size) * 3}px ${String(color)},0 0 ${Number(size) * 7}px rgba(129,140,248,.18)`,
                  }}
                />
              ))}

              {/* 큰 십자형 별 */}
              {[
                ["10%","25%","0s","#bae6fd",22],
                ["29%","12%","1.7s","#ffffff",18],
                ["72%","28%","2.9s","#ddd6fe",22],
                ["87%","16%","1.0s","#ffffff",19],
                ["93%","44%","3.2s","#f5d0fe",16],
              ].map(([left, top, delay, color, size], index) => (
                <span
                  key={`space-cross-${index}`}
                  className="hoo-main-twinkle absolute"
                  style={{
                    left: String(left),
                    top: String(top),
                    width: `${Number(size)}px`,
                    height: `${Number(size)}px`,
                    animationDelay: String(delay),
                  }}
                >
                  <span
                    className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2"
                    style={{ background: `linear-gradient(to bottom,transparent,${String(color)},transparent)` }}
                  />
                  <span
                    className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2"
                    style={{ background: `linear-gradient(to right,transparent,${String(color)},transparent)` }}
                  />
                  <span
                    className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ background: String(color), boxShadow: `0 0 14px ${String(color)},0 0 30px ${String(color)}55` }}
                  />
                </span>
              ))}

              {/* 유성 */}
              <div className="hoo-main-shooting-star absolute left-[7%] top-[10%] h-px w-40 origin-left bg-gradient-to-r from-transparent via-cyan-100/68 to-white shadow-[0_0_10px_rgba(186,230,253,.40)]" />
              <div
                className="hoo-main-shooting-star absolute right-[25%] top-[7%] h-px w-32 origin-left bg-gradient-to-r from-transparent via-violet-100/62 to-white/92 shadow-[0_0_10px_rgba(221,214,254,.34)]"
                style={{ animationDelay: "4.4s", animationDuration: "12.5s" }}
              />

              {/* 우측 상단 고리행성 */}
              <div className="hoo-main-planet absolute right-[7%] top-[11%] h-28 w-28 opacity-80 sm:h-32 sm:w-32">
                <div className="absolute inset-[18%] rounded-full border border-white/[0.10] bg-[radial-gradient(circle_at_30%_25%,rgba(226,232,240,.25),rgba(99,102,241,.13)_34%,rgba(4,6,17,.95)_74%)] shadow-[inset_-14px_-18px_32px_rgba(0,0,0,.60),0_0_42px_rgba(99,102,241,.10)]" />
                <div className="absolute left-1/2 top-1/2 h-[24px] w-[118%] -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] rounded-[50%] border border-violet-100/[0.16]" />
                <div className="absolute left-1/2 top-1/2 h-[8px] w-[112%] -translate-x-1/2 -translate-y-1/2 -rotate-[14deg] rounded-[50%] border border-white/[0.06]" />
              </div>

              {/* 좌측 작은 푸른 행성 */}
              <div className="hoo-main-planet absolute left-[7%] top-[18%] h-16 w-16 opacity-58" style={{ animationDelay: "2.5s" }}>
                <div className="absolute inset-0 rounded-full border border-cyan-100/[0.08] bg-[radial-gradient(circle_at_34%_28%,rgba(186,230,253,.18),rgba(14,165,233,.08)_40%,rgba(2,6,18,.96)_76%)] shadow-[inset_-8px_-10px_18px_rgba(0,0,0,.55),0_0_28px_rgba(14,165,233,.08)]" />
              </div>

              {/* 배경 성좌 */}
              <div className="hoo-main-constellation absolute left-[8%] top-[38%] h-28 w-48">
                <span className="absolute left-[8%] top-[56%] h-1.5 w-1.5 rounded-full bg-cyan-50/70 shadow-[0_0_8px_rgba(207,250,254,.42)]" />
                <span className="absolute left-[38%] top-[28%] h-1 w-1 rounded-full bg-white/70" />
                <span className="absolute left-[66%] top-[47%] h-1.5 w-1.5 rounded-full bg-violet-50/66 shadow-[0_0_7px_rgba(237,233,254,.34)]" />
                <span className="absolute left-[88%] top-[18%] h-1 w-1 rounded-full bg-white/62" />
                <span className="absolute left-[13%] top-[51%] h-px w-[31%] rotate-[-24deg] bg-gradient-to-r from-white/25 to-white/8" />
                <span className="absolute left-[41%] top-[35%] h-px w-[29%] rotate-[18deg] bg-gradient-to-r from-white/20 to-white/7" />
                <span className="absolute left-[67%] top-[38%] h-px w-[25%] rotate-[-30deg] bg-gradient-to-r from-white/18 to-white/6" />
              </div>

              <div className="absolute inset-y-[4%] left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-violet-100/[0.035] to-transparent" />
              <div className="absolute inset-x-[12%] top-0 h-px bg-gradient-to-r from-transparent via-violet-100/[0.10] to-transparent" />

              {/* subtle particles */}
              {[
                ["8%", "72%", "0s"], ["15%", "64%", "1.3s"], ["24%", "75%", "2.2s"],
                ["76%", "72%", ".7s"], ["85%", "64%", "2.6s"], ["92%", "72%", "3.5s"],
              ].map(([left, top, delay], index) => (
                <span
                  key={`particle-${index}`}
                  className="hoo-main-particle absolute h-[3px] w-[3px] rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,.36),0_0_16px_rgba(191,219,254,.15)]"
                  style={{ left, top, animationDelay: delay }}
                />
              ))}

              {/* =========================================================
                  PORTAL / RECORD
              ========================================================== */}
              <div className="absolute left-1/2 top-[30.5%] h-[345px] w-[345px] -translate-x-1/2 sm:h-[420px] sm:w-[420px] lg:h-[480px] lg:w-[480px]">
                <div className="hoo-main-portal absolute inset-0">
                  <div className="absolute -inset-[18%] rounded-full bg-violet-400/[0.024] blur-[56px]" />
                  <div className="absolute -inset-[10%] rounded-full border border-violet-100/[0.023]" />
                  <div className="absolute -inset-[5%] rounded-full border border-indigo-100/[0.028]" />

                  <div className="absolute inset-0 rounded-full border border-violet-100/[0.10] bg-[radial-gradient(circle_at_50%_50%,rgba(1,3,10,1)_0_25%,rgba(3,5,15,.99)_26_34%,rgba(13,14,42,.96)_35_43%,rgba(37,31,82,.70)_47%,rgba(83,55,166,.16)_58%,transparent_74%)] shadow-[0_0_88px_rgba(99,102,241,.06),inset_0_0_45px_rgba(124,58,237,.05)]" />

                  {[7, 12, 17, 22, 27, 32].map((inset) => (
                    <div
                      key={`record-ring-${inset}`}
                      className="absolute rounded-full border border-white/[0.021]"
                      style={{ inset: `${inset}%` }}
                    />
                  ))}

                  <div className="absolute inset-[18%] rounded-full border border-violet-100/[0.038]" />
                  <div className="absolute inset-[29%] rounded-full border border-indigo-100/[0.028]" />
                  <div className="absolute inset-[35%] rounded-full border border-violet-100/[0.042] bg-[radial-gradient(circle_at_40%_35%,#0b1024_0%,#040611_48%,#010207_100%)] shadow-[inset_-22px_-25px_48px_rgba(0,0,0,.8),0_0_40px_rgba(124,58,237,.055)]" />

                  <div className="hoo-main-flare-x absolute left-1/2 top-1/2 h-px w-[166%] bg-gradient-to-r from-transparent via-violet-100/22 to-transparent" />
                  <div className="hoo-main-flare-y absolute left-1/2 top-1/2 h-[166%] w-px bg-gradient-to-b from-transparent via-violet-100/17 to-transparent" />

                  <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-300/[0.042] blur-2xl" />
                  <div className="hoo-main-core absolute left-1/2 top-1/2 h-[48px] w-[48px]">
                    <div
                      className="absolute inset-0 bg-white"
                      style={{
                        clipPath:
                          "polygon(50% 0%, 60% 39%, 100% 50%, 60% 61%, 50% 100%, 40% 61%, 0% 50%, 40% 39%)",
                        filter:
                          "drop-shadow(0 0 8px rgba(255,255,255,.82)) drop-shadow(0 0 17px rgba(196,181,253,.56)) drop-shadow(0 0 28px rgba(124,58,237,.28))",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* =========================================================
                  3 ROTATING LASER / ORBIT LINES
                  the effect user liked, polished
              ========================================================== */}
              {[
                { cls: "hoo-main-orbit-a", width: "72vw", max: 1160, color: "rgba(255,255,255,.43)", dot: "rgba(255,255,255,.85)", delay: "0s" },
                { cls: "hoo-main-orbit-b", width: "65vw", max: 1040, color: "rgba(221,214,254,.34)", dot: "rgba(221,214,254,.80)", delay: ".9s" },
                { cls: "hoo-main-orbit-c", width: "58vw", max: 930, color: "rgba(186,230,253,.25)", dot: "rgba(186,230,253,.72)", delay: "1.8s" },
              ].map((orbit, index) => (
                <div
                  key={`orbit-${index}`}
                  className={`${orbit.cls} absolute left-1/2 top-[47%] h-px`}
                  style={{
                    width: orbit.width,
                    maxWidth: `${orbit.max}px`,
                    background: `linear-gradient(90deg, transparent 0%, ${orbit.color} 36%, ${orbit.color} 64%, transparent 100%)`,
                    transformOrigin: "50% 50%",
                  }}
                >
                  <span
                    className="hoo-main-orbit-dot absolute right-[18%] top-1/2 h-1.5 w-1.5 rounded-full"
                    style={{
                      background: orbit.dot,
                      boxShadow: `0 0 8px ${orbit.dot}`,
                      animationDelay: orbit.delay,
                    }}
                  />
                </div>
              ))}

              {/* =========================================================
                  STAGE SPOTLIGHTS — NO HARD TRIANGLES
                  radial + mask, so only light is visible
              ========================================================== */}
              <div className="absolute inset-0">
                {/* LEFT CYAN */}
                <div
                  className="hoo-main-beam-left-soft absolute bottom-[12%] left-[27%] h-[76%] w-[42%] -translate-x-1/2"
                  style={{
                    background:
                      "radial-gradient(ellipse at 50% 100%, rgba(103,232,249,.22) 0%, rgba(56,189,248,.12) 24%, rgba(125,211,252,.055) 45%, rgba(255,255,255,0) 73%)",
                    WebkitMaskImage:
                      "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,.92) 34%, rgba(0,0,0,.40) 68%, transparent 100%)",
                    maskImage:
                      "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,.92) 34%, rgba(0,0,0,.40) 68%, transparent 100%)",
                    filter: "blur(10px)",
                  }}
                />
                <div
                  className="hoo-main-beam-left absolute bottom-[12%] left-[29%] h-[75%] w-[28%] -translate-x-1/2"
                  style={{
                    background:
                      "radial-gradient(ellipse at 50% 100%, rgba(224,242,254,.24) 0%, rgba(103,232,249,.13) 22%, rgba(56,189,248,.050) 48%, rgba(255,255,255,0) 72%)",
                    WebkitMaskImage:
                      "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,.86) 37%, rgba(0,0,0,.32) 70%, transparent 100%)",
                    maskImage:
                      "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,.86) 37%, rgba(0,0,0,.32) 70%, transparent 100%)",
                    filter: "blur(6px)",
                  }}
                />

                {/* CENTER WHITE/VIOLET */}
                <div
                  className="hoo-main-beam-center absolute bottom-[10%] left-1/2 h-[83%] w-[35%] -translate-x-1/2"
                  style={{
                    background:
                      "radial-gradient(ellipse at 50% 100%, rgba(255,255,255,.21) 0%, rgba(221,214,254,.15) 20%, rgba(167,139,250,.060) 48%, rgba(255,255,255,0) 74%)",
                    WebkitMaskImage:
                      "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,.90) 36%, rgba(0,0,0,.34) 71%, transparent 100%)",
                    maskImage:
                      "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,.90) 36%, rgba(0,0,0,.34) 71%, transparent 100%)",
                    filter: "blur(7px)",
                  }}
                />

                {/* RIGHT VIOLET */}
                <div
                  className="hoo-main-beam-right-soft absolute bottom-[12%] left-[73%] h-[76%] w-[42%] -translate-x-1/2"
                  style={{
                    background:
                      "radial-gradient(ellipse at 50% 100%, rgba(233,213,255,.20) 0%, rgba(192,132,252,.11) 24%, rgba(217,70,239,.048) 45%, rgba(255,255,255,0) 73%)",
                    WebkitMaskImage:
                      "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,.92) 34%, rgba(0,0,0,.40) 68%, transparent 100%)",
                    maskImage:
                      "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,.92) 34%, rgba(0,0,0,.40) 68%, transparent 100%)",
                    filter: "blur(10px)",
                  }}
                />
                <div
                  className="hoo-main-beam-right absolute bottom-[12%] left-[71%] h-[75%] w-[28%] -translate-x-1/2"
                  style={{
                    background:
                      "radial-gradient(ellipse at 50% 100%, rgba(250,232,255,.22) 0%, rgba(216,180,254,.12) 22%, rgba(192,132,252,.045) 48%, rgba(255,255,255,0) 72%)",
                    WebkitMaskImage:
                      "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,.86) 37%, rgba(0,0,0,.32) 70%, transparent 100%)",
                    maskImage:
                      "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,.86) 37%, rgba(0,0,0,.32) 70%, transparent 100%)",
                    filter: "blur(6px)",
                  }}
                />
              </div>

              {/* =========================================================
                  STAGE DECK — buttons live on this
              ========================================================== */}
              <div className="absolute inset-x-0 bottom-0 h-[43%]">
                {/* subtle fog */}
                <div className="hoo-main-fog-left absolute bottom-[34%] left-[-10%] h-24 w-[55%] rounded-[50%] bg-cyan-50/[0.018] blur-[38px]" />
                <div className="hoo-main-fog-right absolute bottom-[30%] right-[-10%] h-28 w-[58%] rounded-[50%] bg-violet-50/[0.018] blur-[40px]" />

                {/* perspective deck */}
                <div
                  className="absolute bottom-[-4%] left-1/2 h-[92%] w-[88%] -translate-x-1/2"
                  style={{
                    clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
                    background:
                      "linear-gradient(180deg,rgba(15,19,37,.015) 0%,rgba(10,14,29,.18) 34%,rgba(5,8,18,.62) 100%)",
                  }}
                >
                  <div className="absolute inset-x-[12%] top-[18%] h-px bg-gradient-to-r from-transparent via-white/[0.045] to-transparent" />
                  <div className="absolute inset-x-[8%] top-[38%] h-px bg-gradient-to-r from-transparent via-white/[0.038] to-transparent" />
                  <div className="absolute inset-x-[4%] top-[61%] h-px bg-gradient-to-r from-transparent via-white/[0.032] to-transparent" />
                  <div className="absolute inset-x-0 top-[82%] h-px bg-gradient-to-r from-transparent via-white/[0.026] to-transparent" />
                  <div className="absolute inset-y-0 left-[26%] w-px bg-gradient-to-b from-white/[0.018] to-cyan-100/[0.042]" />
                  <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-violet-100/[0.025] to-violet-100/[0.060]" />
                  <div className="absolute inset-y-0 left-[74%] w-px bg-gradient-to-b from-white/[0.018] to-fuchsia-100/[0.040]" />
                </div>

                {/* stage halo */}
                <div className="hoo-main-stage absolute left-1/2 bottom-[15%] h-[220px] w-[84%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,.030),rgba(99,102,241,.055)_18%,rgba(59,130,246,.033)_34%,rgba(5,9,21,.13)_58%,transparent_79%)]" />
                <div className="absolute left-1/2 bottom-[17.5%] h-px w-[64%] -translate-x-1/2 bg-gradient-to-r from-transparent via-violet-100/[0.17] to-transparent" />
                <div className="absolute left-1/2 bottom-[14%] h-[112px] w-[72%] -translate-x-1/2 rounded-[50%] border border-white/[0.035] opacity-52" />
                <div className="absolute left-1/2 bottom-[10.5%] h-[154px] w-[90%] -translate-x-1/2 rounded-[50%] border border-white/[0.020] opacity-34" />

                {/* stage front */}
                <div
                  className="absolute bottom-[-2%] left-1/2 h-[18%] w-[86%] -translate-x-1/2"
                  style={{
                    clipPath: "polygon(5% 0%, 95% 0%, 100% 100%, 0% 100%)",
                    background: "linear-gradient(180deg,rgba(12,16,31,.74),rgba(2,4,10,.96))",
                    boxShadow: "0 -1px 0 rgba(255,255,255,.05),0 -16px 60px rgba(99,102,241,.045)",
                  }}
                />
                <div className="absolute bottom-[15.5%] left-1/2 h-px w-[75%] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/[0.095] to-transparent" />

                {/* footlights aligned with stage */}
                {[
                  ["22%", "rgba(103,232,249,.34)", "0s"],
                  ["35%", "rgba(191,219,254,.30)", ".7s"],
                  ["50%", "rgba(196,181,253,.40)", "1.2s"],
                  ["65%", "rgba(216,180,254,.30)", ".5s"],
                  ["78%", "rgba(245,208,254,.32)", "1.5s"],
                ].map(([left, glow, delay], index) => (
                  <div
                    key={`foot-light-${index}`}
                    className="hoo-main-footlight absolute bottom-[12.7%] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white"
                    style={{
                      left,
                      animationDelay: delay,
                      boxShadow: `0 0 8px rgba(255,255,255,.64),0 0 26px ${glow},0 0 50px ${glow}`,
                    }}
                  />
                ))}

                <div className="absolute inset-y-0 left-0 w-[18%] bg-gradient-to-r from-[#010208]/86 to-transparent" />
                <div className="absolute inset-y-0 right-0 w-[18%] bg-gradient-to-l from-[#010208]/86 to-transparent" />
              </div>

              <div className="absolute inset-x-0 bottom-0 h-[26%] bg-gradient-to-b from-transparent via-[#02030a]/10 to-[#010207]" />
            </div>

            {/* =========================================================
                CONTENT
            ========================================================== */}
            <div className="relative z-10 mx-auto flex h-full min-h-[700px] w-full max-w-[1880px] flex-col px-5 py-5 sm:px-8 sm:py-6 lg:px-10">
              <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center pb-2 pt-2 text-center">
                {/* title */}
                <section className="relative mt-1">
                  <div className="mx-auto flex items-center justify-center gap-3">
                    <span className="h-px w-8 bg-gradient-to-r from-transparent to-violet-100/[0.17]" />
                    <p className="text-[9px] font-black tracking-[0.52em] text-violet-100/34 sm:text-[11px]">
                      2 KEY MANUAL RHYTHM
                    </p>
                    <span className="h-px w-8 bg-gradient-to-l from-transparent to-violet-100/[0.17]" />
                  </div>

                  <div className="relative mt-3">
                    <div className="absolute inset-x-[11%] top-1/2 h-14 -translate-y-1/2 rounded-full bg-violet-300/[0.032] blur-3xl" />
                    <h1
                      className="relative text-5xl font-black tracking-[0.10em] text-[#f8f7ff] sm:text-7xl lg:text-[6rem]"
                      style={{
                        textShadow:
                          "0 0 16px rgba(255,255,255,.04),0 0 30px rgba(196,181,253,.075),0 0 58px rgba(99,102,241,.035)",
                      }}
                    >
                      HOO RHYTHM
                    </h1>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-4 sm:gap-6">
                    <span className="h-px w-14 bg-gradient-to-r from-transparent to-violet-100/[0.20] sm:w-24" />
                    <p className="whitespace-nowrap text-sm font-bold tracking-[0.24em] text-white/58 sm:text-base">
                      음악이 머무는 또 하나의 밤
                    </p>
                    <span className="h-px w-14 bg-gradient-to-l from-transparent to-violet-100/[0.17] sm:w-24" />
                  </div>

                  <div className="mt-4 flex h-5 items-end justify-center gap-1.5 opacity-42">
                    {[7, 11, 5, 14, 9, 16, 7, 12, 5, 10, 7].map((height, index) => (
                      <span
                        key={`${height}-${index}`}
                        className="hoo-main-wave w-[2px] rounded-full bg-gradient-to-b from-violet-50/56 to-violet-400/10"
                        style={{ height: `${height}px`, animationDelay: `${index * 0.11}s` }}
                      />
                    ))}
                  </div>
                </section>

                {/* stage menu */}
                <section className="mt-auto w-full pt-14 sm:pt-16">
                  <div className="mx-auto grid w-full max-w-[1180px] gap-3 sm:grid-cols-3 lg:gap-4">
                    {/* START */}
                    <button
                      type="button"
                      onClick={() => setScreen("select")}
                      className="group relative isolate overflow-hidden rounded-[24px] border border-cyan-100/[0.15] bg-[#06101f]/40 text-left shadow-[0_18px_50px_rgba(0,0,0,.30),0_0_34px_rgba(34,211,238,.030)] transition-all duration-300 hover:-translate-y-1.5 hover:border-cyan-50/[0.32] hover:bg-[#08162a]/62 hover:shadow-[0_22px_60px_rgba(0,0,0,.34),0_0_40px_rgba(34,211,238,.065)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/26"
                    >
                      <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(34,211,238,.060),transparent_43%)] opacity-70" />
                      <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-50/34 to-transparent" />
                      <span className="absolute bottom-0 left-[9%] h-px w-[43%] bg-gradient-to-r from-cyan-200/20 to-transparent" />
                      <span className="hoo-main-shimmer absolute -left-[58%] top-0 h-full w-[46%] rotate-[12deg] bg-gradient-to-r from-transparent via-white/[0.040] to-transparent" />
                      <span className="relative flex min-h-[110px] items-center gap-4 px-5 py-5">
                        <span className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full border border-cyan-50/[0.14] bg-cyan-200/[0.028] text-lg text-white shadow-[inset_0_1px_0_rgba(255,255,255,.065),0_0_22px_rgba(34,211,238,.045)]">
                          <span className="absolute inset-1.5 rounded-full border border-cyan-50/[0.04]" />
                          <span className="relative ml-0.5">▶</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-black tracking-[-0.025em] text-white sm:text-lg">게임 시작</span>
                          <span className="mt-1 block text-[11px] font-bold tracking-[-0.01em] text-white/35 sm:text-xs">리듬의 세계로 떠나요</span>
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.042] bg-black/10 text-xl text-white/25 transition-all duration-300 group-hover:translate-x-1 group-hover:border-cyan-50/[0.12] group-hover:bg-cyan-50/[0.018] group-hover:text-white/68">›</span>
                      </span>
                    </button>

                    {/* SELECT */}
                    <button
                      type="button"
                      onClick={() => setScreen("select")}
                      className="group relative isolate overflow-hidden rounded-[24px] border border-violet-100/[0.10] bg-[#080b19]/38 text-left shadow-[0_18px_48px_rgba(0,0,0,.25)] transition-all duration-300 hover:-translate-y-1.5 hover:border-violet-100/[0.20] hover:bg-violet-300/[0.032] hover:shadow-[0_22px_58px_rgba(0,0,0,.29),0_0_32px_rgba(139,92,246,.032)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200/24"
                    >
                      <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(139,92,246,.052),transparent_43%)] opacity-70" />
                      <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-violet-50/[0.18] to-transparent" />
                      <span className="hoo-main-shimmer absolute -left-[58%] top-0 h-full w-[46%] rotate-[12deg] bg-gradient-to-r from-transparent via-white/[0.036] to-transparent" />
                      <span className="relative flex min-h-[110px] items-center gap-4 px-5 py-5">
                        <span className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full border border-violet-100/[0.095] bg-violet-200/[0.018] text-[24px] text-violet-50/84 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]">
                          <span className="absolute inset-1.5 rounded-full border border-violet-50/[0.028]" />
                          <span className="relative">♫</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-black tracking-[-0.025em] text-white sm:text-lg">곡 선택</span>
                          <span className="mt-1 block text-[11px] font-bold tracking-[-0.01em] text-white/35 sm:text-xs">다양한 음악을 만나보세요</span>
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.040] bg-black/10 text-xl text-white/23 transition-all duration-300 group-hover:translate-x-1 group-hover:border-violet-50/[0.10] group-hover:text-white/64">›</span>
                      </span>
                    </button>
                    {/* STUDIO */}
                    <button
                      type="button"
                      onClick={() => {
                        resetPlay();
                        setIsRecording(false);
                        setScreen("editor");
                      }}
                      className="group relative isolate overflow-hidden rounded-[24px] border border-fuchsia-100/[0.085] bg-[#0a0918]/38 text-left shadow-[0_18px_48px_rgba(0,0,0,.25)] transition-all duration-300 hover:-translate-y-1.5 hover:border-fuchsia-100/[0.18] hover:bg-fuchsia-200/[0.025] hover:shadow-[0_22px_58px_rgba(0,0,0,.29),0_0_32px_rgba(217,70,239,.030)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-200/20"
                    >
                      <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(217,70,239,.040),transparent_43%)] opacity-80" />
                      <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-50/[0.16] to-transparent" />
                      <span className="hoo-main-shimmer absolute -left-[58%] top-0 h-full w-[46%] rotate-[12deg] bg-gradient-to-r from-transparent via-white/[0.034] to-transparent" />
                      <span className="relative flex min-h-[110px] items-center gap-4 px-5 py-5">
                        <span className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full border border-fuchsia-100/[0.08] bg-fuchsia-100/[0.017] text-xl text-fuchsia-50/78 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
                          <span className="absolute inset-1.5 rounded-full border border-fuchsia-50/[0.022]" />
                          <span className="relative">⚒</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="block text-base font-black tracking-[-0.025em] text-white sm:text-lg">
                              관리자 작업실
                            </span>
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[7px] font-black tracking-[0.08em] ${
                                !adminChecked
                                  ? "border-white/[0.07] text-white/25"
                                  : isAdmin
                                    ? "border-emerald-200/[0.10] text-emerald-100/42"
                                    : "border-amber-200/[0.10] text-amber-100/42"
                              }`}
                            >
                              {!adminChecked ? "CHECK" : isAdmin ? "ADMIN" : "LOCAL"}
                            </span>
                          </span>
                          <span className="mt-1 block text-[11px] font-bold tracking-[-0.01em] text-white/35 sm:text-xs">
                            음원·커버·채보를 제작해요
                          </span>
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.040] bg-black/10 text-xl text-white/23 transition-all duration-300 group-hover:translate-x-1 group-hover:border-fuchsia-50/[0.09] group-hover:text-white/64">›</span>
                      </span>
                    </button>
                  </div>

                  <div className="mt-6 flex flex-col items-center">
                    <div className="flex items-center gap-4">
                      <span className="h-px w-12 bg-gradient-to-r from-transparent to-white/[0.11] sm:w-24" />
                      <div className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-cyan-50/20" />
                        <p className="text-[10px] font-bold tracking-[0.18em] text-white/29 sm:text-[11px]">A · K 두 키로 플레이하세요</p>
                        <span className="h-1 w-1 rounded-full bg-fuchsia-50/20" />
                      </div>
                      <span className="h-px w-12 bg-gradient-to-l from-transparent to-white/[0.11] sm:w-24" />
                    </div>

                    <div className="mt-3 flex gap-2">
                      {KEYS.map((key, index) => {
                        const cool = index === 0;
                        return (
                          <div
                            key={key}
                            className={`relative flex h-10 w-14 items-center justify-center overflow-hidden rounded-[11px] border bg-[#070915]/60 text-sm font-black shadow-[inset_0_1px_0_rgba(255,255,255,.026),0_8px_24px_rgba(0,0,0,.18)] backdrop-blur-md sm:h-11 sm:w-16 ${
                              cool ? "border-cyan-100/[0.10] text-cyan-50/78" : "border-violet-100/[0.10] text-violet-50/78"
                            }`}
                          >
                            <span
                              className={`hoo-main-key-line absolute inset-x-2 bottom-0 h-px ${
                                cool ? "bg-cyan-200/17" : "bg-violet-200/16"
                              }`}
                              style={{ animationDelay: `${index * 0.42}s` }}
                            />
                            <span className="absolute inset-x-1 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.035] to-transparent" />
                            <span className="relative">{key}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </div>

              <footer className="mt-3 shrink-0 text-[10px] font-bold tracking-[0.12em] text-white/[0.14] sm:text-[11px]">
                <span>ver 1.0.0</span>
              </footer>
            </div>
          </main>
        )}

        {screen === "select" && (() => {

          const selectSongArtist: Record<string, string> = {
            "season-of-stars": "STARRIVER",
            "turn-around": "LUNA MODE",
            "dont-want-to-hear": "MOONCHILD",
            "ghost-train": "NEON DRIVE",
            "forest-spirit": "ELYSIUM",
          };

          const selectSongEnglishTitle: Record<string, string> = {
            "season-of-stars": "STAR SEASON",
            "turn-around": "TURN AROUND",
            "dont-want-to-hear": "SILENT SIGNAL",
            "ghost-train": "GHOST TRAIN",
            "forest-spirit": "FOREST SPIRIT",
          };

          const selectSongDescription: Record<string, string> = {
            "season-of-stars":
              "흘러가는 계절 속에서도 우리는 다시, 같은 별을 바라본다. 푸른 밤과 빛의 궤적이 천천히 무대를 채우는 시네마틱 리듬 스테이지.",
            "turn-around":
              "멀어졌던 시간과 마음을 다시 되돌아보는 순간. 선명한 비트와 직선적인 에너지가 밤의 무대를 가로지른다.",
            "dont-want-to-hear":
              "지우고 싶을수록 더 선명해지는 기억. 낮게 깔린 박자와 절제된 빛이 감정의 파동을 따라 움직인다.",
            "ghost-train":
              "보름달 아래 단 하루만 나타나는 유령열차. 느린 박자 사이로 어둠과 빛이 교차하는 특별한 밤의 스테이지.",
            "forest-spirit":
              "잊힌 숲이 다시 노래하기 시작하는 순간. 차가운 별빛과 부드러운 생명의 빛이 함께 흐르는 몽환적인 리듬 스테이지.",
          };

          const selectSongAccent: Record<
            string,
            {
              primary: string;
              secondary: string;
              tertiary: string;
              glow: string;
              dark: string;
            }
          > = {
            "season-of-stars": {
              primary: "#67e8f9",
              secondary: "#818cf8",
              tertiary: "#c084fc",
              glow: "rgba(103,232,249,.48)",
              dark: "#071326",
            },
            "turn-around": {
              primary: "#60a5fa",
              secondary: "#8b5cf6",
              tertiary: "#e879f9",
              glow: "rgba(96,165,250,.45)",
              dark: "#081124",
            },
            "dont-want-to-hear": {
              primary: "#a78bfa",
              secondary: "#7c3aed",
              tertiary: "#f0abfc",
              glow: "rgba(167,139,250,.44)",
              dark: "#120b28",
            },
            "ghost-train": {
              primary: "#c084fc",
              secondary: "#ec4899",
              tertiary: "#60a5fa",
              glow: "rgba(192,132,252,.44)",
              dark: "#16081f",
            },
            "forest-spirit": {
              primary: "#5eead4",
              secondary: "#22c55e",
              tertiary: "#818cf8",
              glow: "rgba(94,234,212,.40)",
              dark: "#071b18",
            },
          };

          const selectedArtist = selectSongArtist[song.id] || "HOO RHYTHM";
          const selectedEnglishTitle =
            selectSongEnglishTitle[song.id] || song.title.toUpperCase();
          const selectedDescription =
            selectSongDescription[song.id] || song.subtitle;
          const selectedCover =
            songCovers[song.id] ||
            (publishedSongMap[song.id]?.cover_url
              ? {
                  dataUrl: publishedSongMap[song.id].cover_url as string,
                  fileName: "공개 커버 이미지",
                  updatedAt: publishedSongMap[song.id].updated_at,
                }
              : null);
          const selectedAccent =
            selectSongAccent[song.id] || {
              primary: "#67e8f9",
              secondary: "#818cf8",
              tertiary: "#c084fc",
              glow: "rgba(103,232,249,.48)",
              dark: "#071326",
            };

          const selectBestGrade =
            best.score >= 950000
              ? "S+"
              : best.score >= 850000
                ? "S"
                : best.score >= 700000
                  ? "A"
                  : best.score >= 500000
                    ? "B"
                    : best.score > 0
                      ? "C"
                      : "--";

          const selectStarColor = (tone: string, alpha: number) => {
            if (tone === "cyan") return `rgba(186,230,253,${alpha})`;
            if (tone === "violet") return `rgba(221,214,254,${alpha})`;
            if (tone === "pink") return `rgba(245,208,254,${alpha})`;
            return `rgba(255,255,255,${alpha})`;
          };

          const renderSelectSongThumbnail = (item: Song) => {
            if (item.id === "season-of-stars") {
              return (
                <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#071636_0%,#11165a_52%,#160d3d_100%)]">
                  <div className="absolute inset-0 opacity-55 [background-image:radial-gradient(circle,rgba(255,255,255,.95)_0_.7px,transparent_1px)] [background-size:12px_12px]" />

                  <div className="absolute left-1/2 top-[44%] h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/28 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.08),rgba(59,130,246,.24)_38%,rgba(139,92,246,.12)_58%,transparent_72%)] shadow-[0_0_18px_rgba(96,165,250,.24)]" />

                  <div className="absolute inset-x-[-12%] bottom-[19%] h-[28px] bg-[linear-gradient(135deg,transparent_0_8%,#070c25_9%_17%,transparent_18%_25%,#0a1230_26%_38%,transparent_39%_47%,#090d28_48%_61%,transparent_62%_72%,#071025_73%_82%,transparent_83%)] opacity-95" />

                  <div className="absolute inset-x-0 bottom-0 h-[23%] bg-gradient-to-b from-blue-500/12 via-violet-500/20 to-black/80" />

                  <div className="absolute left-1/2 top-[45%] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2">
                    <div
                      className="absolute inset-0 bg-white"
                      style={{
                        clipPath:
                          "polygon(50% 0%,60% 39%,100% 50%,60% 61%,50% 100%,40% 61%,0% 50%,40% 39%)",
                        filter:
                          "drop-shadow(0 0 5px rgba(255,255,255,.9))",
                      }}
                    />
                  </div>
                </div>
              );
            }

            if (item.id === "turn-around") {
              return (
                <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#071023,#11185a_48%,#190b43_100%)]">
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-cyan-100/60 via-violet-300/70 to-fuchsia-300/45 shadow-[0_0_9px_rgba(129,140,248,.6)]" />

                  <div className="absolute inset-y-0 left-[31%] w-px bg-gradient-to-b from-transparent via-blue-300/32 to-transparent" />

                  <div className="absolute inset-y-0 right-[31%] w-px bg-gradient-to-b from-transparent via-fuchsia-300/28 to-transparent" />

                  <div className="absolute left-1/2 top-[65%] h-[56%] w-[115%] -translate-x-1/2 bg-[linear-gradient(90deg,transparent_0_6%,rgba(96,165,250,.22)_7%_8%,transparent_9%_22%,rgba(167,139,250,.24)_23%_24%,transparent_25%_46%,rgba(236,72,153,.22)_47%_48%,transparent_49%_100%)] [clip-path:polygon(45%_0,55%_0,100%_100%,0_100%)]" />

                  <div className="absolute inset-x-0 bottom-0 h-[28%] bg-black/55" />
                </div>
              );
            }

            if (item.id === "dont-want-to-hear") {
              return (
                <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(160deg,#090d25,#171052_48%,#220e42)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(96,165,250,.20),transparent_28%),radial-gradient(circle_at_70%_65%,rgba(217,70,239,.16),transparent_32%)]" />

                  <div className="absolute inset-x-[12%] top-[34%] flex h-[34%] items-end justify-between gap-[2px] opacity-70">
                    {[6, 14, 9, 22, 15, 28, 12, 19, 8, 24, 17, 10].map(
                      (height, index) => (
                        <span
                          key={index}
                          className="w-[3px] rounded-full bg-gradient-to-b from-violet-100/80 to-fuchsia-400/30"
                          style={{
                            height: `${height}px`,
                          }}
                        />
                      ),
                    )}
                  </div>

                  <div className="absolute left-[14%] top-[16%] h-1.5 w-1.5 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,.45)]" />

                  <div className="absolute right-[18%] top-[25%] h-1 w-1 rounded-full bg-violet-100/80 shadow-[0_0_7px_rgba(221,214,254,.45)]" />
                </div>
              );
            }

            if (item.id === "ghost-train") {
              return (
                <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#060816,#170925_52%,#24051f_100%)]">
                  <div className="absolute inset-0 opacity-45 [background-image:radial-gradient(circle,rgba(255,255,255,.9)_0_.6px,transparent_.9px)] [background-size:14px_14px]" />

                  <div className="absolute inset-x-[-18%] bottom-[18%] h-[44%] bg-[linear-gradient(90deg,transparent_0_6%,rgba(236,72,153,.20)_7%_8%,transparent_9%_26%,rgba(192,132,252,.22)_27%_28%,transparent_29%_56%,rgba(59,130,246,.18)_57%_58%,transparent_59%_100%)] [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]" />

                  <div className="absolute bottom-[16%] left-[18%] h-[30px] w-[64%] rounded-[6px] border border-fuchsia-200/18 bg-black/40 shadow-[0_0_12px_rgba(236,72,153,.10)]">
                    <div className="absolute inset-x-[10%] top-[22%] flex gap-1">
                      {[0, 1, 2, 3, 4].map((windowIndex) => (
                        <span
                          key={windowIndex}
                          className="h-2 flex-1 rounded-[2px] bg-fuchsia-200/30"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#05151c,#082524_48%,#061221_100%)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(94,234,212,.17),transparent_20%),radial-gradient(circle_at_45%_56%,rgba(34,197,94,.10),transparent_34%)]" />

                {[12, 27, 42, 59, 74, 88].map((x, index) => (
                  <div
                    key={index}
                    className="absolute bottom-0 w-[10px] bg-black/52"
                    style={{
                      left: `${x}%`,
                      height: `${48 + (index % 3) * 14}%`,
                      clipPath:
                        "polygon(50% 0%,64% 26%,58% 26%,76% 51%,64% 49%,88% 80%,67% 76%,94% 100%,6% 100%,33% 76%,12% 80%,36% 49%,24% 51%,42% 26%,36% 26%)",
                    }}
                  />
                ))}

                <div className="absolute left-1/2 top-[39%] h-2 w-2 -translate-x-1/2 rounded-full bg-teal-100/80 shadow-[0_0_12px_rgba(94,234,212,.65)]" />
              </div>
            );
          };

          const selectBackgroundStars = [
            {
              id: "selectBackgroundStars-000",
              left: "2.69%",
              top: "93.05%",
              size: 2.20,
              alpha: 0.66,
              delay: 0.84,
              duration: 5.33,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-001",
              left: "83.89%",
              top: "28.26%",
              size: 1.95,
              alpha: 0.53,
              delay: 3.13,
              duration: 4.53,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-002",
              left: "44.29%",
              top: "24.93%",
              size: 0.75,
              alpha: 0.36,
              delay: 4.87,
              duration: 3.69,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-003",
              left: "77.58%",
              top: "88.54%",
              size: 1.20,
              alpha: 0.40,
              delay: 1.28,
              duration: 5.43,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-004",
              left: "87.69%",
              top: "43.41%",
              size: 2.23,
              alpha: 0.90,
              delay: 5.78,
              duration: 3.53,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-005",
              left: "54.81%",
              top: "65.26%",
              size: 1.68,
              alpha: 0.30,
              delay: 1.59,
              duration: 3.99,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-006",
              left: "50.74%",
              top: "83.82%",
              size: 1.90,
              alpha: 0.56,
              delay: 4.56,
              duration: 6.59,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-007",
              left: "11.51%",
              top: "44.42%",
              size: 0.69,
              alpha: 0.44,
              delay: 1.10,
              duration: 5.29,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-008",
              left: "89.96%",
              top: "48.55%",
              size: 2.06,
              alpha: 0.78,
              delay: 2.17,
              duration: 6.62,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-009",
              left: "37.99%",
              top: "3.01%",
              size: 2.01,
              alpha: 0.72,
              delay: 1.44,
              duration: 4.47,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-010",
              left: "37.44%",
              top: "1.01%",
              size: 1.15,
              alpha: 0.29,
              delay: 1.69,
              duration: 4.12,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-011",
              left: "51.40%",
              top: "14.02%",
              size: 1.68,
              alpha: 0.66,
              delay: 0.15,
              duration: 5.65,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-012",
              left: "66.91%",
              top: "50.14%",
              size: 1.02,
              alpha: 0.69,
              delay: 3.26,
              duration: 3.75,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-013",
              left: "50.33%",
              top: "93.41%",
              size: 1.25,
              alpha: 0.56,
              delay: 0.63,
              duration: 5.91,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-014",
              left: "87.96%",
              top: "38.89%",
              size: 1.72,
              alpha: 0.34,
              delay: 2.61,
              duration: 4.71,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-015",
              left: "89.86%",
              top: "28.24%",
              size: 2.20,
              alpha: 0.67,
              delay: 0.89,
              duration: 6.39,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-016",
              left: "48.98%",
              top: "97.01%",
              size: 1.66,
              alpha: 0.40,
              delay: 4.87,
              duration: 4.87,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-017",
              left: "30.83%",
              top: "97.09%",
              size: 0.94,
              alpha: 0.23,
              delay: 4.90,
              duration: 3.87,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-018",
              left: "10.97%",
              top: "32.36%",
              size: 1.35,
              alpha: 0.71,
              delay: 2.51,
              duration: 3.97,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-019",
              left: "36.44%",
              top: "94.68%",
              size: 2.18,
              alpha: 0.86,
              delay: 3.34,
              duration: 3.63,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-020",
              left: "8.30%",
              top: "68.96%",
              size: 1.03,
              alpha: 0.72,
              delay: 5.15,
              duration: 5.39,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-021",
              left: "85.91%",
              top: "97.93%",
              size: 1.79,
              alpha: 0.46,
              delay: 3.87,
              duration: 4.97,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-022",
              left: "24.47%",
              top: "53.69%",
              size: 0.78,
              alpha: 0.59,
              delay: 2.36,
              duration: 5.55,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-023",
              left: "52.78%",
              top: "59.52%",
              size: 1.85,
              alpha: 0.84,
              delay: 5.02,
              duration: 3.55,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-024",
              left: "34.38%",
              top: "48.69%",
              size: 1.31,
              alpha: 0.44,
              delay: 0.93,
              duration: 5.15,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-025",
              left: "92.52%",
              top: "68.29%",
              size: 1.89,
              alpha: 0.23,
              delay: 4.12,
              duration: 4.85,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-026",
              left: "72.59%",
              top: "49.95%",
              size: 1.43,
              alpha: 0.51,
              delay: 5.54,
              duration: 4.00,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-027",
              left: "16.48%",
              top: "66.54%",
              size: 1.30,
              alpha: 0.44,
              delay: 4.77,
              duration: 4.17,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-028",
              left: "3.28%",
              top: "40.70%",
              size: 2.10,
              alpha: 0.83,
              delay: 0.30,
              duration: 4.66,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-029",
              left: "47.16%",
              top: "23.84%",
              size: 1.13,
              alpha: 0.38,
              delay: 1.02,
              duration: 6.33,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-030",
              left: "27.22%",
              top: "86.73%",
              size: 0.72,
              alpha: 0.71,
              delay: 2.46,
              duration: 6.16,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-031",
              left: "81.60%",
              top: "30.52%",
              size: 1.87,
              alpha: 0.55,
              delay: 2.75,
              duration: 3.44,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-032",
              left: "62.87%",
              top: "37.90%",
              size: 1.06,
              alpha: 0.26,
              delay: 2.24,
              duration: 5.36,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-033",
              left: "55.61%",
              top: "34.14%",
              size: 0.87,
              alpha: 0.67,
              delay: 0.17,
              duration: 6.48,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-034",
              left: "2.72%",
              top: "64.21%",
              size: 1.02,
              alpha: 0.66,
              delay: 4.25,
              duration: 6.79,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-035",
              left: "79.83%",
              top: "48.92%",
              size: 1.75,
              alpha: 0.54,
              delay: 1.88,
              duration: 4.76,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-036",
              left: "17.33%",
              top: "95.06%",
              size: 1.99,
              alpha: 0.42,
              delay: 1.39,
              duration: 5.57,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-037",
              left: "29.29%",
              top: "50.47%",
              size: 1.81,
              alpha: 0.26,
              delay: 2.00,
              duration: 4.14,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-038",
              left: "47.69%",
              top: "77.94%",
              size: 1.14,
              alpha: 0.48,
              delay: 4.45,
              duration: 4.72,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-039",
              left: "32.51%",
              top: "88.12%",
              size: 2.29,
              alpha: 0.71,
              delay: 3.11,
              duration: 5.80,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-040",
              left: "65.82%",
              top: "39.95%",
              size: 1.56,
              alpha: 0.77,
              delay: 4.86,
              duration: 3.61,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-041",
              left: "66.45%",
              top: "54.69%",
              size: 0.94,
              alpha: 0.71,
              delay: 4.54,
              duration: 3.97,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-042",
              left: "64.55%",
              top: "43.95%",
              size: 1.30,
              alpha: 0.41,
              delay: 1.73,
              duration: 4.97,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-043",
              left: "2.38%",
              top: "58.37%",
              size: 1.52,
              alpha: 0.27,
              delay: 1.43,
              duration: 5.87,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-044",
              left: "17.03%",
              top: "21.12%",
              size: 1.46,
              alpha: 0.44,
              delay: 5.26,
              duration: 5.45,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-045",
              left: "7.90%",
              top: "94.88%",
              size: 1.96,
              alpha: 0.34,
              delay: 2.73,
              duration: 4.42,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-046",
              left: "60.48%",
              top: "64.78%",
              size: 2.09,
              alpha: 0.68,
              delay: 4.42,
              duration: 6.32,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-047",
              left: "37.53%",
              top: "56.51%",
              size: 2.34,
              alpha: 0.55,
              delay: 0.52,
              duration: 3.98,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-048",
              left: "3.24%",
              top: "98.59%",
              size: 2.15,
              alpha: 0.58,
              delay: 4.69,
              duration: 5.68,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-049",
              left: "29.89%",
              top: "59.43%",
              size: 1.07,
              alpha: 0.52,
              delay: 2.15,
              duration: 5.32,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-050",
              left: "75.04%",
              top: "51.71%",
              size: 2.27,
              alpha: 0.33,
              delay: 3.73,
              duration: 6.18,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-051",
              left: "92.73%",
              top: "5.75%",
              size: 1.99,
              alpha: 0.52,
              delay: 0.41,
              duration: 4.49,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-052",
              left: "42.60%",
              top: "33.12%",
              size: 0.94,
              alpha: 0.22,
              delay: 1.99,
              duration: 6.45,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-053",
              left: "48.13%",
              top: "62.02%",
              size: 1.14,
              alpha: 0.69,
              delay: 1.52,
              duration: 3.45,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-054",
              left: "97.30%",
              top: "38.36%",
              size: 1.52,
              alpha: 0.47,
              delay: 5.47,
              duration: 6.63,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-055",
              left: "50.07%",
              top: "72.62%",
              size: 2.13,
              alpha: 0.56,
              delay: 0.12,
              duration: 5.95,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-056",
              left: "85.89%",
              top: "77.84%",
              size: 0.88,
              alpha: 0.91,
              delay: 1.81,
              duration: 6.16,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-057",
              left: "55.16%",
              top: "15.66%",
              size: 0.85,
              alpha: 0.71,
              delay: 3.17,
              duration: 6.75,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-058",
              left: "69.90%",
              top: "47.46%",
              size: 1.41,
              alpha: 0.78,
              delay: 5.50,
              duration: 5.77,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-059",
              left: "73.60%",
              top: "76.60%",
              size: 2.32,
              alpha: 0.77,
              delay: 1.62,
              duration: 4.86,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-060",
              left: "84.69%",
              top: "14.70%",
              size: 1.80,
              alpha: 0.66,
              delay: 5.60,
              duration: 5.53,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-061",
              left: "3.70%",
              top: "57.40%",
              size: 2.06,
              alpha: 0.24,
              delay: 0.90,
              duration: 4.23,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-062",
              left: "84.92%",
              top: "27.51%",
              size: 1.92,
              alpha: 0.57,
              delay: 1.81,
              duration: 5.33,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-063",
              left: "77.26%",
              top: "15.66%",
              size: 1.84,
              alpha: 0.76,
              delay: 3.05,
              duration: 6.51,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-064",
              left: "89.13%",
              top: "82.24%",
              size: 2.02,
              alpha: 0.61,
              delay: 5.46,
              duration: 4.19,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-065",
              left: "50.39%",
              top: "32.15%",
              size: 1.62,
              alpha: 0.37,
              delay: 2.08,
              duration: 4.67,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-066",
              left: "43.36%",
              top: "80.86%",
              size: 1.85,
              alpha: 0.86,
              delay: 4.56,
              duration: 6.35,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-067",
              left: "15.08%",
              top: "5.64%",
              size: 1.15,
              alpha: 0.41,
              delay: 1.83,
              duration: 6.73,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-068",
              left: "72.79%",
              top: "50.04%",
              size: 1.28,
              alpha: 0.41,
              delay: 2.98,
              duration: 4.98,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-069",
              left: "91.48%",
              top: "4.95%",
              size: 0.76,
              alpha: 0.77,
              delay: 4.33,
              duration: 6.06,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-070",
              left: "34.06%",
              top: "68.70%",
              size: 1.65,
              alpha: 0.79,
              delay: 2.60,
              duration: 4.74,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-071",
              left: "30.74%",
              top: "46.55%",
              size: 0.93,
              alpha: 0.31,
              delay: 5.21,
              duration: 5.14,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-072",
              left: "40.67%",
              top: "85.03%",
              size: 2.11,
              alpha: 0.44,
              delay: 0.48,
              duration: 4.68,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-073",
              left: "46.52%",
              top: "89.59%",
              size: 0.96,
              alpha: 0.63,
              delay: 0.97,
              duration: 4.33,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-074",
              left: "56.19%",
              top: "67.40%",
              size: 0.68,
              alpha: 0.29,
              delay: 5.63,
              duration: 6.10,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-075",
              left: "70.84%",
              top: "28.33%",
              size: 0.88,
              alpha: 0.45,
              delay: 2.69,
              duration: 5.60,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-076",
              left: "87.75%",
              top: "14.47%",
              size: 2.28,
              alpha: 0.83,
              delay: 1.33,
              duration: 5.30,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-077",
              left: "54.79%",
              top: "67.41%",
              size: 1.59,
              alpha: 0.24,
              delay: 2.15,
              duration: 5.09,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-078",
              left: "85.93%",
              top: "45.49%",
              size: 2.13,
              alpha: 0.62,
              delay: 0.06,
              duration: 3.89,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-079",
              left: "80.14%",
              top: "54.62%",
              size: 1.00,
              alpha: 0.33,
              delay: 0.28,
              duration: 5.50,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-080",
              left: "38.32%",
              top: "24.51%",
              size: 0.68,
              alpha: 0.67,
              delay: 4.24,
              duration: 6.30,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-081",
              left: "44.59%",
              top: "9.65%",
              size: 0.72,
              alpha: 0.51,
              delay: 1.81,
              duration: 6.47,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-082",
              left: "49.61%",
              top: "93.80%",
              size: 1.30,
              alpha: 0.40,
              delay: 2.70,
              duration: 5.71,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-083",
              left: "32.31%",
              top: "85.48%",
              size: 2.03,
              alpha: 0.82,
              delay: 5.15,
              duration: 4.88,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-084",
              left: "61.28%",
              top: "50.38%",
              size: 1.43,
              alpha: 0.25,
              delay: 4.20,
              duration: 3.47,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-085",
              left: "58.62%",
              top: "34.96%",
              size: 0.90,
              alpha: 0.53,
              delay: 0.36,
              duration: 4.43,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-086",
              left: "70.87%",
              top: "35.88%",
              size: 0.77,
              alpha: 0.68,
              delay: 4.09,
              duration: 4.40,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-087",
              left: "4.79%",
              top: "71.52%",
              size: 1.53,
              alpha: 0.43,
              delay: 3.43,
              duration: 6.02,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-088",
              left: "44.37%",
              top: "9.62%",
              size: 1.13,
              alpha: 0.55,
              delay: 4.82,
              duration: 6.63,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-089",
              left: "20.46%",
              top: "39.38%",
              size: 2.15,
              alpha: 0.57,
              delay: 2.62,
              duration: 4.89,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-090",
              left: "73.14%",
              top: "39.42%",
              size: 1.13,
              alpha: 0.48,
              delay: 0.35,
              duration: 3.74,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-091",
              left: "85.36%",
              top: "14.91%",
              size: 1.66,
              alpha: 0.36,
              delay: 3.02,
              duration: 6.16,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-092",
              left: "4.60%",
              top: "23.78%",
              size: 0.88,
              alpha: 0.59,
              delay: 0.17,
              duration: 6.34,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-093",
              left: "88.62%",
              top: "27.96%",
              size: 2.04,
              alpha: 0.75,
              delay: 2.31,
              duration: 3.80,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-094",
              left: "96.16%",
              top: "77.16%",
              size: 1.71,
              alpha: 0.63,
              delay: 1.41,
              duration: 6.40,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-095",
              left: "97.44%",
              top: "24.19%",
              size: 2.16,
              alpha: 0.45,
              delay: 0.44,
              duration: 4.62,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-096",
              left: "19.25%",
              top: "2.99%",
              size: 1.23,
              alpha: 0.56,
              delay: 3.02,
              duration: 5.33,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-097",
              left: "36.35%",
              top: "11.41%",
              size: 1.27,
              alpha: 0.41,
              delay: 4.04,
              duration: 4.21,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-098",
              left: "83.84%",
              top: "47.59%",
              size: 0.92,
              alpha: 0.54,
              delay: 3.80,
              duration: 5.18,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-099",
              left: "27.26%",
              top: "84.32%",
              size: 0.84,
              alpha: 0.58,
              delay: 0.49,
              duration: 3.89,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-100",
              left: "52.34%",
              top: "38.17%",
              size: 1.88,
              alpha: 0.41,
              delay: 0.27,
              duration: 5.87,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-101",
              left: "59.88%",
              top: "68.03%",
              size: 2.04,
              alpha: 0.69,
              delay: 4.26,
              duration: 3.70,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-102",
              left: "83.69%",
              top: "95.24%",
              size: 0.96,
              alpha: 0.45,
              delay: 3.36,
              duration: 4.32,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-103",
              left: "89.30%",
              top: "95.70%",
              size: 0.91,
              alpha: 0.43,
              delay: 0.60,
              duration: 5.33,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-104",
              left: "36.43%",
              top: "38.09%",
              size: 1.46,
              alpha: 0.80,
              delay: 0.89,
              duration: 4.87,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-105",
              left: "7.54%",
              top: "16.34%",
              size: 0.96,
              alpha: 0.49,
              delay: 2.36,
              duration: 5.68,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-106",
              left: "47.40%",
              top: "88.51%",
              size: 2.30,
              alpha: 0.76,
              delay: 4.40,
              duration: 3.79,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-107",
              left: "82.23%",
              top: "6.57%",
              size: 2.12,
              alpha: 0.78,
              delay: 2.00,
              duration: 5.01,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-108",
              left: "18.66%",
              top: "59.97%",
              size: 0.98,
              alpha: 0.42,
              delay: 0.65,
              duration: 4.88,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-109",
              left: "81.42%",
              top: "81.88%",
              size: 1.60,
              alpha: 0.84,
              delay: 5.54,
              duration: 5.31,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-110",
              left: "29.64%",
              top: "56.70%",
              size: 1.17,
              alpha: 0.64,
              delay: 2.16,
              duration: 4.13,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-111",
              left: "31.28%",
              top: "15.66%",
              size: 1.35,
              alpha: 0.24,
              delay: 2.62,
              duration: 6.60,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-112",
              left: "86.07%",
              top: "13.83%",
              size: 1.34,
              alpha: 0.35,
              delay: 4.05,
              duration: 4.18,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-113",
              left: "70.66%",
              top: "35.24%",
              size: 0.82,
              alpha: 0.61,
              delay: 3.60,
              duration: 3.78,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-114",
              left: "73.85%",
              top: "87.49%",
              size: 0.67,
              alpha: 0.42,
              delay: 1.46,
              duration: 4.78,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-115",
              left: "12.75%",
              top: "30.45%",
              size: 0.75,
              alpha: 0.54,
              delay: 5.73,
              duration: 3.76,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-116",
              left: "57.35%",
              top: "72.62%",
              size: 2.10,
              alpha: 0.25,
              delay: 5.69,
              duration: 6.22,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-117",
              left: "60.09%",
              top: "31.47%",
              size: 1.83,
              alpha: 0.90,
              delay: 1.97,
              duration: 3.43,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-118",
              left: "5.64%",
              top: "65.88%",
              size: 0.66,
              alpha: 0.43,
              delay: 0.30,
              duration: 5.49,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-119",
              left: "63.30%",
              top: "49.36%",
              size: 2.33,
              alpha: 0.61,
              delay: 1.41,
              duration: 5.08,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-120",
              left: "39.33%",
              top: "36.91%",
              size: 1.51,
              alpha: 0.63,
              delay: 3.60,
              duration: 4.30,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-121",
              left: "70.84%",
              top: "18.41%",
              size: 2.32,
              alpha: 0.85,
              delay: 1.96,
              duration: 5.68,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-122",
              left: "52.95%",
              top: "30.51%",
              size: 1.83,
              alpha: 0.23,
              delay: 3.90,
              duration: 4.99,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-123",
              left: "63.99%",
              top: "74.08%",
              size: 1.29,
              alpha: 0.49,
              delay: 0.03,
              duration: 4.70,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-124",
              left: "14.05%",
              top: "89.60%",
              size: 1.47,
              alpha: 0.31,
              delay: 2.38,
              duration: 3.63,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-125",
              left: "41.88%",
              top: "1.04%",
              size: 1.33,
              alpha: 0.34,
              delay: 2.58,
              duration: 5.21,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-126",
              left: "16.50%",
              top: "68.06%",
              size: 1.69,
              alpha: 0.74,
              delay: 3.63,
              duration: 6.78,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-127",
              left: "68.82%",
              top: "95.72%",
              size: 1.16,
              alpha: 0.72,
              delay: 0.15,
              duration: 5.80,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-128",
              left: "20.95%",
              top: "79.49%",
              size: 1.77,
              alpha: 0.54,
              delay: 4.08,
              duration: 3.86,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-129",
              left: "15.80%",
              top: "64.52%",
              size: 0.68,
              alpha: 0.73,
              delay: 1.03,
              duration: 3.70,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-130",
              left: "9.51%",
              top: "31.50%",
              size: 0.92,
              alpha: 0.49,
              delay: 0.50,
              duration: 5.54,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-131",
              left: "61.01%",
              top: "72.14%",
              size: 1.62,
              alpha: 0.66,
              delay: 2.40,
              duration: 3.52,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-132",
              left: "55.89%",
              top: "39.41%",
              size: 1.45,
              alpha: 0.88,
              delay: 2.01,
              duration: 4.19,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-133",
              left: "37.02%",
              top: "95.44%",
              size: 1.71,
              alpha: 0.90,
              delay: 0.68,
              duration: 6.73,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-134",
              left: "96.72%",
              top: "80.67%",
              size: 1.08,
              alpha: 0.71,
              delay: 1.05,
              duration: 4.94,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-135",
              left: "16.20%",
              top: "64.62%",
              size: 1.61,
              alpha: 0.71,
              delay: 2.91,
              duration: 4.81,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-136",
              left: "42.23%",
              top: "24.48%",
              size: 1.47,
              alpha: 0.80,
              delay: 5.07,
              duration: 3.60,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-137",
              left: "76.75%",
              top: "60.30%",
              size: 1.44,
              alpha: 0.49,
              delay: 0.03,
              duration: 5.99,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-138",
              left: "34.54%",
              top: "70.62%",
              size: 1.55,
              alpha: 0.85,
              delay: 4.36,
              duration: 3.88,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-139",
              left: "12.24%",
              top: "48.38%",
              size: 1.96,
              alpha: 0.33,
              delay: 3.46,
              duration: 4.90,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-140",
              left: "42.10%",
              top: "16.84%",
              size: 1.46,
              alpha: 0.29,
              delay: 4.64,
              duration: 5.36,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-141",
              left: "48.46%",
              top: "42.82%",
              size: 2.30,
              alpha: 0.46,
              delay: 0.75,
              duration: 4.02,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-142",
              left: "18.02%",
              top: "87.27%",
              size: 0.96,
              alpha: 0.34,
              delay: 1.17,
              duration: 5.20,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-143",
              left: "71.04%",
              top: "77.15%",
              size: 0.92,
              alpha: 0.52,
              delay: 2.82,
              duration: 4.04,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-144",
              left: "91.75%",
              top: "93.89%",
              size: 2.24,
              alpha: 0.84,
              delay: 2.74,
              duration: 4.01,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-145",
              left: "8.27%",
              top: "85.95%",
              size: 2.09,
              alpha: 0.45,
              delay: 1.88,
              duration: 4.99,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-146",
              left: "45.58%",
              top: "18.25%",
              size: 1.97,
              alpha: 0.43,
              delay: 4.91,
              duration: 5.26,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-147",
              left: "84.03%",
              top: "73.97%",
              size: 1.21,
              alpha: 0.68,
              delay: 3.11,
              duration: 4.85,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-148",
              left: "51.42%",
              top: "84.47%",
              size: 0.80,
              alpha: 0.72,
              delay: 0.42,
              duration: 5.40,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-149",
              left: "77.45%",
              top: "17.85%",
              size: 0.89,
              alpha: 0.83,
              delay: 4.52,
              duration: 3.90,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-150",
              left: "79.76%",
              top: "4.28%",
              size: 1.42,
              alpha: 0.90,
              delay: 1.78,
              duration: 4.65,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-151",
              left: "43.86%",
              top: "64.27%",
              size: 0.86,
              alpha: 0.25,
              delay: 4.45,
              duration: 3.96,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-152",
              left: "3.88%",
              top: "37.44%",
              size: 0.81,
              alpha: 0.32,
              delay: 1.18,
              duration: 5.45,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-153",
              left: "31.22%",
              top: "57.22%",
              size: 1.46,
              alpha: 0.82,
              delay: 2.84,
              duration: 4.54,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-154",
              left: "96.52%",
              top: "61.83%",
              size: 1.17,
              alpha: 0.38,
              delay: 0.56,
              duration: 5.70,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-155",
              left: "57.46%",
              top: "64.08%",
              size: 1.91,
              alpha: 0.35,
              delay: 1.65,
              duration: 4.25,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-156",
              left: "94.77%",
              top: "97.31%",
              size: 0.72,
              alpha: 0.29,
              delay: 0.56,
              duration: 3.85,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-157",
              left: "69.24%",
              top: "73.73%",
              size: 1.23,
              alpha: 0.51,
              delay: 0.11,
              duration: 3.69,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-158",
              left: "91.36%",
              top: "53.56%",
              size: 2.25,
              alpha: 0.42,
              delay: 4.32,
              duration: 6.66,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-159",
              left: "33.51%",
              top: "50.33%",
              size: 1.20,
              alpha: 0.56,
              delay: 3.54,
              duration: 5.44,
              tone: "white",
            },
            {
              id: "selectBackgroundStars-160",
              left: "68.81%",
              top: "30.70%",
              size: 1.49,
              alpha: 0.39,
              delay: 0.20,
              duration: 6.41,
              tone: "cyan",
            },
            {
              id: "selectBackgroundStars-161",
              left: "28.57%",
              top: "7.05%",
              size: 1.49,
              alpha: 0.47,
              delay: 0.97,
              duration: 3.55,
              tone: "pink",
            },
            {
              id: "selectBackgroundStars-162",
              left: "88.35%",
              top: "81.83%",
              size: 2.29,
              alpha: 0.89,
              delay: 4.76,
              duration: 4.88,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-163",
              left: "29.70%",
              top: "1.18%",
              size: 1.02,
              alpha: 0.64,
              delay: 2.33,
              duration: 6.45,
              tone: "violet",
            },
            {
              id: "selectBackgroundStars-164",
              left: "25.07%",
              top: "17.80%",
              size: 2.11,
              alpha: 0.28,
              delay: 5.26,
              duration: 4.08,
              tone: "violet",
            },
          ];

          const selectCoverStars = [
            {
              id: "selectCoverStars-000",
              left: "79.09%",
              top: "78.32%",
              size: 1.88,
              alpha: 0.83,
              delay: 4.21,
              duration: 4.81,
              tone: "pink",
            },
            {
              id: "selectCoverStars-001",
              left: "61.92%",
              top: "76.82%",
              size: 1.52,
              alpha: 0.92,
              delay: 0.94,
              duration: 4.16,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-002",
              left: "56.12%",
              top: "75.06%",
              size: 1.59,
              alpha: 0.77,
              delay: 4.52,
              duration: 6.42,
              tone: "violet",
            },
            {
              id: "selectCoverStars-003",
              left: "1.46%",
              top: "61.73%",
              size: 1.07,
              alpha: 0.44,
              delay: 4.01,
              duration: 5.64,
              tone: "violet",
            },
            {
              id: "selectCoverStars-004",
              left: "92.98%",
              top: "55.15%",
              size: 0.92,
              alpha: 0.87,
              delay: 3.63,
              duration: 5.00,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-005",
              left: "77.52%",
              top: "33.48%",
              size: 1.70,
              alpha: 0.51,
              delay: 2.42,
              duration: 6.39,
              tone: "white",
            },
            {
              id: "selectCoverStars-006",
              left: "80.69%",
              top: "67.18%",
              size: 1.21,
              alpha: 0.34,
              delay: 1.65,
              duration: 6.75,
              tone: "pink",
            },
            {
              id: "selectCoverStars-007",
              left: "80.28%",
              top: "75.31%",
              size: 0.84,
              alpha: 0.56,
              delay: 1.50,
              duration: 4.88,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-008",
              left: "6.29%",
              top: "35.78%",
              size: 0.86,
              alpha: 0.60,
              delay: 2.14,
              duration: 3.59,
              tone: "pink",
            },
            {
              id: "selectCoverStars-009",
              left: "86.15%",
              top: "80.97%",
              size: 0.57,
              alpha: 0.42,
              delay: 0.82,
              duration: 6.16,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-010",
              left: "94.01%",
              top: "87.67%",
              size: 1.88,
              alpha: 0.49,
              delay: 4.53,
              duration: 6.77,
              tone: "violet",
            },
            {
              id: "selectCoverStars-011",
              left: "93.00%",
              top: "74.86%",
              size: 1.91,
              alpha: 0.37,
              delay: 0.18,
              duration: 4.04,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-012",
              left: "39.92%",
              top: "12.11%",
              size: 1.95,
              alpha: 0.61,
              delay: 0.69,
              duration: 4.07,
              tone: "white",
            },
            {
              id: "selectCoverStars-013",
              left: "38.14%",
              top: "79.68%",
              size: 0.98,
              alpha: 0.66,
              delay: 0.37,
              duration: 4.03,
              tone: "violet",
            },
            {
              id: "selectCoverStars-014",
              left: "3.86%",
              top: "48.77%",
              size: 1.05,
              alpha: 0.60,
              delay: 0.16,
              duration: 3.75,
              tone: "pink",
            },
            {
              id: "selectCoverStars-015",
              left: "93.16%",
              top: "24.14%",
              size: 0.89,
              alpha: 0.24,
              delay: 1.04,
              duration: 5.05,
              tone: "violet",
            },
            {
              id: "selectCoverStars-016",
              left: "49.63%",
              top: "87.61%",
              size: 1.10,
              alpha: 0.67,
              delay: 0.14,
              duration: 5.89,
              tone: "pink",
            },
            {
              id: "selectCoverStars-017",
              left: "71.54%",
              top: "68.51%",
              size: 1.77,
              alpha: 0.67,
              delay: 4.97,
              duration: 5.08,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-018",
              left: "51.79%",
              top: "3.20%",
              size: 1.90,
              alpha: 0.46,
              delay: 0.71,
              duration: 3.96,
              tone: "violet",
            },
            {
              id: "selectCoverStars-019",
              left: "92.19%",
              top: "72.14%",
              size: 0.67,
              alpha: 0.43,
              delay: 0.97,
              duration: 4.34,
              tone: "pink",
            },
            {
              id: "selectCoverStars-020",
              left: "92.39%",
              top: "38.43%",
              size: 1.77,
              alpha: 0.39,
              delay: 1.96,
              duration: 5.93,
              tone: "violet",
            },
            {
              id: "selectCoverStars-021",
              left: "31.80%",
              top: "51.27%",
              size: 1.15,
              alpha: 0.58,
              delay: 5.27,
              duration: 3.54,
              tone: "pink",
            },
            {
              id: "selectCoverStars-022",
              left: "18.30%",
              top: "6.10%",
              size: 0.85,
              alpha: 0.90,
              delay: 1.16,
              duration: 6.15,
              tone: "white",
            },
            {
              id: "selectCoverStars-023",
              left: "14.97%",
              top: "50.72%",
              size: 0.64,
              alpha: 0.90,
              delay: 0.99,
              duration: 3.59,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-024",
              left: "90.57%",
              top: "24.06%",
              size: 1.51,
              alpha: 0.24,
              delay: 2.98,
              duration: 6.46,
              tone: "violet",
            },
            {
              id: "selectCoverStars-025",
              left: "80.74%",
              top: "78.81%",
              size: 1.33,
              alpha: 0.56,
              delay: 1.23,
              duration: 4.61,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-026",
              left: "41.13%",
              top: "84.52%",
              size: 1.42,
              alpha: 0.24,
              delay: 5.15,
              duration: 5.52,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-027",
              left: "57.61%",
              top: "52.56%",
              size: 1.49,
              alpha: 0.40,
              delay: 3.88,
              duration: 5.92,
              tone: "violet",
            },
            {
              id: "selectCoverStars-028",
              left: "12.60%",
              top: "87.59%",
              size: 1.76,
              alpha: 0.59,
              delay: 2.25,
              duration: 6.59,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-029",
              left: "79.15%",
              top: "50.65%",
              size: 1.40,
              alpha: 0.38,
              delay: 4.29,
              duration: 3.92,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-030",
              left: "24.95%",
              top: "13.37%",
              size: 1.92,
              alpha: 0.37,
              delay: 4.12,
              duration: 5.95,
              tone: "pink",
            },
            {
              id: "selectCoverStars-031",
              left: "17.41%",
              top: "88.24%",
              size: 1.52,
              alpha: 0.56,
              delay: 4.21,
              duration: 6.53,
              tone: "pink",
            },
            {
              id: "selectCoverStars-032",
              left: "19.23%",
              top: "41.61%",
              size: 1.31,
              alpha: 0.33,
              delay: 1.63,
              duration: 3.63,
              tone: "white",
            },
            {
              id: "selectCoverStars-033",
              left: "66.94%",
              top: "24.17%",
              size: 1.60,
              alpha: 0.29,
              delay: 1.40,
              duration: 5.51,
              tone: "white",
            },
            {
              id: "selectCoverStars-034",
              left: "70.83%",
              top: "35.38%",
              size: 1.44,
              alpha: 0.75,
              delay: 4.26,
              duration: 4.48,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-035",
              left: "71.75%",
              top: "86.43%",
              size: 1.01,
              alpha: 0.80,
              delay: 1.56,
              duration: 6.21,
              tone: "pink",
            },
            {
              id: "selectCoverStars-036",
              left: "46.99%",
              top: "23.99%",
              size: 1.15,
              alpha: 0.56,
              delay: 4.35,
              duration: 4.15,
              tone: "white",
            },
            {
              id: "selectCoverStars-037",
              left: "68.83%",
              top: "13.77%",
              size: 1.26,
              alpha: 0.61,
              delay: 1.48,
              duration: 5.59,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-038",
              left: "20.98%",
              top: "83.73%",
              size: 0.84,
              alpha: 0.78,
              delay: 2.73,
              duration: 6.15,
              tone: "violet",
            },
            {
              id: "selectCoverStars-039",
              left: "78.15%",
              top: "23.62%",
              size: 1.56,
              alpha: 0.37,
              delay: 4.30,
              duration: 6.09,
              tone: "pink",
            },
            {
              id: "selectCoverStars-040",
              left: "74.87%",
              top: "13.51%",
              size: 0.75,
              alpha: 0.58,
              delay: 5.23,
              duration: 3.74,
              tone: "white",
            },
            {
              id: "selectCoverStars-041",
              left: "63.77%",
              top: "84.36%",
              size: 0.73,
              alpha: 0.49,
              delay: 3.29,
              duration: 6.68,
              tone: "violet",
            },
            {
              id: "selectCoverStars-042",
              left: "18.44%",
              top: "94.05%",
              size: 1.22,
              alpha: 0.71,
              delay: 4.35,
              duration: 6.53,
              tone: "white",
            },
            {
              id: "selectCoverStars-043",
              left: "83.40%",
              top: "40.73%",
              size: 1.67,
              alpha: 0.55,
              delay: 4.91,
              duration: 6.71,
              tone: "white",
            },
            {
              id: "selectCoverStars-044",
              left: "77.23%",
              top: "18.40%",
              size: 1.79,
              alpha: 0.63,
              delay: 1.19,
              duration: 3.74,
              tone: "violet",
            },
            {
              id: "selectCoverStars-045",
              left: "70.09%",
              top: "49.72%",
              size: 0.68,
              alpha: 0.44,
              delay: 2.80,
              duration: 4.80,
              tone: "white",
            },
            {
              id: "selectCoverStars-046",
              left: "31.47%",
              top: "51.72%",
              size: 1.87,
              alpha: 0.88,
              delay: 3.74,
              duration: 4.89,
              tone: "pink",
            },
            {
              id: "selectCoverStars-047",
              left: "28.85%",
              top: "76.68%",
              size: 0.57,
              alpha: 0.48,
              delay: 1.96,
              duration: 5.84,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-048",
              left: "59.13%",
              top: "71.75%",
              size: 1.05,
              alpha: 0.47,
              delay: 4.38,
              duration: 4.30,
              tone: "white",
            },
            {
              id: "selectCoverStars-049",
              left: "77.77%",
              top: "65.09%",
              size: 1.82,
              alpha: 0.63,
              delay: 1.79,
              duration: 6.37,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-050",
              left: "75.12%",
              top: "14.68%",
              size: 1.36,
              alpha: 0.22,
              delay: 5.52,
              duration: 3.69,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-051",
              left: "31.09%",
              top: "78.15%",
              size: 1.23,
              alpha: 0.33,
              delay: 5.20,
              duration: 4.21,
              tone: "white",
            },
            {
              id: "selectCoverStars-052",
              left: "52.98%",
              top: "67.32%",
              size: 1.44,
              alpha: 0.71,
              delay: 1.42,
              duration: 5.39,
              tone: "violet",
            },
            {
              id: "selectCoverStars-053",
              left: "53.45%",
              top: "34.75%",
              size: 1.13,
              alpha: 0.67,
              delay: 1.19,
              duration: 6.12,
              tone: "pink",
            },
            {
              id: "selectCoverStars-054",
              left: "3.22%",
              top: "47.97%",
              size: 2.07,
              alpha: 0.53,
              delay: 3.01,
              duration: 3.71,
              tone: "violet",
            },
            {
              id: "selectCoverStars-055",
              left: "35.31%",
              top: "21.92%",
              size: 2.09,
              alpha: 0.71,
              delay: 1.25,
              duration: 3.77,
              tone: "violet",
            },
            {
              id: "selectCoverStars-056",
              left: "68.39%",
              top: "52.54%",
              size: 0.62,
              alpha: 0.87,
              delay: 3.19,
              duration: 4.03,
              tone: "pink",
            },
            {
              id: "selectCoverStars-057",
              left: "27.80%",
              top: "47.13%",
              size: 1.91,
              alpha: 0.55,
              delay: 3.05,
              duration: 6.02,
              tone: "pink",
            },
            {
              id: "selectCoverStars-058",
              left: "50.67%",
              top: "49.91%",
              size: 0.73,
              alpha: 0.34,
              delay: 1.59,
              duration: 4.31,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-059",
              left: "36.70%",
              top: "63.98%",
              size: 0.93,
              alpha: 0.24,
              delay: 3.44,
              duration: 4.05,
              tone: "violet",
            },
            {
              id: "selectCoverStars-060",
              left: "12.50%",
              top: "42.49%",
              size: 1.76,
              alpha: 0.83,
              delay: 5.12,
              duration: 4.16,
              tone: "white",
            },
            {
              id: "selectCoverStars-061",
              left: "96.00%",
              top: "32.35%",
              size: 1.20,
              alpha: 0.77,
              delay: 2.71,
              duration: 4.90,
              tone: "white",
            },
            {
              id: "selectCoverStars-062",
              left: "38.06%",
              top: "38.93%",
              size: 2.04,
              alpha: 0.71,
              delay: 0.33,
              duration: 4.82,
              tone: "violet",
            },
            {
              id: "selectCoverStars-063",
              left: "28.79%",
              top: "53.80%",
              size: 1.04,
              alpha: 0.91,
              delay: 4.52,
              duration: 5.76,
              tone: "white",
            },
            {
              id: "selectCoverStars-064",
              left: "52.56%",
              top: "51.44%",
              size: 0.66,
              alpha: 0.63,
              delay: 4.81,
              duration: 5.80,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-065",
              left: "28.97%",
              top: "68.19%",
              size: 0.63,
              alpha: 0.81,
              delay: 2.84,
              duration: 5.47,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-066",
              left: "27.37%",
              top: "60.31%",
              size: 0.91,
              alpha: 0.82,
              delay: 2.45,
              duration: 4.68,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-067",
              left: "39.67%",
              top: "84.89%",
              size: 1.28,
              alpha: 0.71,
              delay: 1.94,
              duration: 4.16,
              tone: "white",
            },
            {
              id: "selectCoverStars-068",
              left: "91.50%",
              top: "27.03%",
              size: 1.55,
              alpha: 0.37,
              delay: 0.04,
              duration: 3.91,
              tone: "white",
            },
            {
              id: "selectCoverStars-069",
              left: "79.76%",
              top: "8.56%",
              size: 1.79,
              alpha: 0.88,
              delay: 0.30,
              duration: 5.89,
              tone: "pink",
            },
            {
              id: "selectCoverStars-070",
              left: "23.94%",
              top: "82.74%",
              size: 0.97,
              alpha: 0.90,
              delay: 5.59,
              duration: 6.51,
              tone: "white",
            },
            {
              id: "selectCoverStars-071",
              left: "11.33%",
              top: "30.21%",
              size: 2.02,
              alpha: 0.71,
              delay: 3.99,
              duration: 5.11,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-072",
              left: "38.85%",
              top: "82.73%",
              size: 1.77,
              alpha: 0.24,
              delay: 2.90,
              duration: 4.01,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-073",
              left: "16.34%",
              top: "15.00%",
              size: 1.50,
              alpha: 0.88,
              delay: 4.74,
              duration: 6.30,
              tone: "white",
            },
            {
              id: "selectCoverStars-074",
              left: "88.85%",
              top: "53.20%",
              size: 1.94,
              alpha: 0.91,
              delay: 0.42,
              duration: 4.60,
              tone: "violet",
            },
            {
              id: "selectCoverStars-075",
              left: "25.41%",
              top: "42.00%",
              size: 1.87,
              alpha: 0.35,
              delay: 3.78,
              duration: 5.99,
              tone: "cyan",
            },
            {
              id: "selectCoverStars-076",
              left: "72.54%",
              top: "39.55%",
              size: 2.06,
              alpha: 0.29,
              delay: 3.43,
              duration: 4.34,
              tone: "white",
            },
            {
              id: "selectCoverStars-077",
              left: "32.89%",
              top: "11.94%",
              size: 1.62,
              alpha: 0.49,
              delay: 0.46,
              duration: 3.57,
              tone: "violet",
            },
            {
              id: "selectCoverStars-078",
              left: "18.31%",
              top: "44.36%",
              size: 1.27,
              alpha: 0.68,
              delay: 3.75,
              duration: 4.04,
              tone: "violet",
            },
            {
              id: "selectCoverStars-079",
              left: "61.18%",
              top: "83.67%",
              size: 1.72,
              alpha: 0.73,
              delay: 4.64,
              duration: 5.16,
              tone: "violet",
            },
            {
              id: "selectCoverStars-080",
              left: "28.71%",
              top: "56.60%",
              size: 1.14,
              alpha: 0.92,
              delay: 1.59,
              duration: 6.17,
              tone: "violet",
            },
            {
              id: "selectCoverStars-081",
              left: "82.97%",
              top: "88.50%",
              size: 1.71,
              alpha: 0.51,
              delay: 0.73,
              duration: 5.23,
              tone: "violet",
            },
            {
              id: "selectCoverStars-082",
              left: "54.80%",
              top: "85.67%",
              size: 1.92,
              alpha: 0.73,
              delay: 5.40,
              duration: 6.80,
              tone: "violet",
            },
            {
              id: "selectCoverStars-083",
              left: "37.19%",
              top: "54.58%",
              size: 1.78,
              alpha: 0.81,
              delay: 2.12,
              duration: 5.90,
              tone: "cyan",
            },
          ];

          const selectConstellationPoints = [
            {
              id: "constellation-point-00",
              left: "10.00%",
              top: "12.00%",
              delay: 0.00,
            },
            {
              id: "constellation-point-01",
              left: "27.00%",
              top: "41.00%",
              delay: 0.31,
            },
            {
              id: "constellation-point-02",
              left: "44.00%",
              top: "70.00%",
              delay: 0.62,
            },
            {
              id: "constellation-point-03",
              left: "61.00%",
              top: "27.00%",
              delay: 0.93,
            },
            {
              id: "constellation-point-04",
              left: "78.00%",
              top: "56.00%",
              delay: 1.24,
            },
            {
              id: "constellation-point-05",
              left: "16.00%",
              top: "13.00%",
              delay: 1.55,
            },
            {
              id: "constellation-point-06",
              left: "33.00%",
              top: "42.00%",
              delay: 1.86,
            },
            {
              id: "constellation-point-07",
              left: "50.00%",
              top: "71.00%",
              delay: 2.17,
            },
            {
              id: "constellation-point-08",
              left: "67.00%",
              top: "28.00%",
              delay: 2.48,
            },
            {
              id: "constellation-point-09",
              left: "84.00%",
              top: "57.00%",
              delay: 2.79,
            },
            {
              id: "constellation-point-10",
              left: "22.00%",
              top: "14.00%",
              delay: 3.10,
            },
            {
              id: "constellation-point-11",
              left: "39.00%",
              top: "43.00%",
              delay: 3.41,
            },
            {
              id: "constellation-point-12",
              left: "56.00%",
              top: "72.00%",
              delay: 3.72,
            },
            {
              id: "constellation-point-13",
              left: "73.00%",
              top: "29.00%",
              delay: 4.03,
            },
            {
              id: "constellation-point-14",
              left: "11.00%",
              top: "58.00%",
              delay: 4.34,
            },
            {
              id: "constellation-point-15",
              left: "28.00%",
              top: "15.00%",
              delay: 4.65,
            },
            {
              id: "constellation-point-16",
              left: "45.00%",
              top: "44.00%",
              delay: 0.16,
            },
            {
              id: "constellation-point-17",
              left: "62.00%",
              top: "73.00%",
              delay: 0.47,
            },
            {
              id: "constellation-point-18",
              left: "79.00%",
              top: "30.00%",
              delay: 0.78,
            },
            {
              id: "constellation-point-19",
              left: "17.00%",
              top: "59.00%",
              delay: 1.09,
            },
            {
              id: "constellation-point-20",
              left: "34.00%",
              top: "16.00%",
              delay: 1.40,
            },
            {
              id: "constellation-point-21",
              left: "51.00%",
              top: "45.00%",
              delay: 1.71,
            },
            {
              id: "constellation-point-22",
              left: "68.00%",
              top: "74.00%",
              delay: 2.02,
            },
            {
              id: "constellation-point-23",
              left: "85.00%",
              top: "31.00%",
              delay: 2.33,
            },
            {
              id: "constellation-point-24",
              left: "23.00%",
              top: "60.00%",
              delay: 2.64,
            },
            {
              id: "constellation-point-25",
              left: "40.00%",
              top: "17.00%",
              delay: 2.95,
            },
            {
              id: "constellation-point-26",
              left: "57.00%",
              top: "46.00%",
              delay: 3.26,
            },
            {
              id: "constellation-point-27",
              left: "74.00%",
              top: "75.00%",
              delay: 3.57,
            },
            {
              id: "constellation-point-28",
              left: "12.00%",
              top: "32.00%",
              delay: 3.88,
            },
            {
              id: "constellation-point-29",
              left: "29.00%",
              top: "61.00%",
              delay: 4.19,
            },
            {
              id: "constellation-point-30",
              left: "46.00%",
              top: "18.00%",
              delay: 4.50,
            },
            {
              id: "constellation-point-31",
              left: "63.00%",
              top: "47.00%",
              delay: 0.01,
            },
          ];

          if (availableSongs.length === 0) {
            return (
              <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:px-6">
                <div className="pointer-events-none fixed inset-0 overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,#02030a_0%,#050817_44%,#06101d_76%,#020409_100%)]" />
                  <div className="absolute left-1/2 top-[18%] h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-violet-500/[0.07] blur-[150px]" />
                  <div className="absolute inset-0 opacity-[0.14] [background-image:radial-gradient(circle,rgba(255,255,255,.88)_0_.7px,transparent_1px)] [background-size:48px_48px]" />
                </div>

                <section className="relative z-10 w-full max-w-[760px] rounded-[30px] border border-violet-200/[0.10] bg-[#070a18]/72 px-6 py-12 text-center shadow-[0_34px_110px_rgba(0,0,0,.42),0_0_70px_rgba(99,102,241,.05)] sm:px-10">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-violet-100/[0.12] bg-violet-300/[0.025] shadow-[0_0_36px_rgba(139,92,246,.08)]">
                    <span className="text-3xl text-violet-50/78">♫</span>
                  </div>

                  <p className="mt-7 text-[9px] font-black tracking-[0.34em] text-violet-100/34">
                    HOO RHYTHM OFFICIAL LIBRARY
                  </p>

                  <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
                    아직 송출된 곡이 없습니다
                  </h2>

                  <p className="mx-auto mt-4 max-w-[520px] text-[12px] font-bold leading-6 text-white/38">
                    관리자 작업실에서 음원을 등록하고 실제 채보를 만든 뒤
                    <strong className="text-white/62"> 전체 이용자에게 송출</strong>한 곡만
                    이 목록에 표시됩니다.
                  </p>

                  {cloudBusy ? (
                    <div className="mt-7 rounded-[16px] border border-violet-200/[0.08] bg-violet-300/[0.025] px-4 py-3 text-[10px] font-black text-violet-100/52">
                      공식 곡 목록을 확인하고 있어요…
                    </div>
                  ) : cloudMessage ? (
                    <div className="mt-7 rounded-[16px] border border-amber-200/[0.08] bg-amber-300/[0.025] px-4 py-3 text-[10px] font-bold leading-5 text-amber-100/55">
                      {cloudMessage}
                    </div>
                  ) : null}

                  <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => void refreshPublishedSongs()}
                      className="rounded-[14px] border border-violet-200/[0.14] bg-violet-300/[0.035] px-5 py-3 text-[10px] font-black text-violet-50/72 transition hover:border-violet-200/24 hover:bg-violet-300/[0.06]"
                    >
                      공식 목록 새로고침
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setScreen("editor")}
                        className="rounded-[14px] border border-fuchsia-200/[0.12] bg-fuchsia-300/[0.03] px-5 py-3 text-[10px] font-black text-fuchsia-50/62 transition hover:border-fuchsia-200/22 hover:bg-fuchsia-300/[0.06]"
                      >
                        저장된 작업 이어하기
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setScreen("home")}
                      className="rounded-[14px] border border-white/[0.07] bg-white/[0.02] px-5 py-3 text-[10px] font-black text-white/48 transition hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-white/70"
                    >
                      메인으로
                    </button>
                  </div>
                </section>
              </main>
            );
          }

          return (
          <main className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:py-6">
            <style>{`
              @keyframes hooSelectPremiumTwinkle {
                0%, 100% {
                  opacity: .22;
                  transform: scale(.78);
                }
                42% {
                  opacity: .92;
                  transform: scale(1.08);
                }
                62% {
                  opacity: .48;
                  transform: scale(.92);
                }
              }

              @keyframes hooSelectPremiumGalaxy {
                0%, 100% {
                  transform: translate3d(-50%, 0, 0) rotate(-11deg) scale(1);
                  opacity: .56;
                }
                50% {
                  transform: translate3d(-50%, -10px, 0) rotate(-9deg) scale(1.035);
                  opacity: .76;
                }
              }

              @keyframes hooSelectPremiumOrbitA {
                from {
                  transform: translate(-50%, -50%) rotate(-7deg);
                }
                to {
                  transform: translate(-50%, -50%) rotate(353deg);
                }
              }

              @keyframes hooSelectPremiumOrbitB {
                from {
                  transform: translate(-50%, -50%) rotate(11deg);
                }
                to {
                  transform: translate(-50%, -50%) rotate(-349deg);
                }
              }

              @keyframes hooSelectPremiumBreath {
                0%, 100% {
                  transform: translate(-50%, -50%) scale(.98);
                  opacity: .78;
                }
                50% {
                  transform: translate(-50%, -50%) scale(1.035);
                  opacity: 1;
                }
              }

              @keyframes hooSelectPremiumCore {
                0%, 100% {
                  transform: translate(-50%, -50%) scale(.92);
                  opacity: .82;
                }
                50% {
                  transform: translate(-50%, -50%) scale(1.08);
                  opacity: 1;
                }
              }

              @keyframes hooSelectPremiumDust {
                0%, 100% {
                  transform: translate3d(0, 0, 0);
                  opacity: .18;
                }
                50% {
                  transform: translate3d(8px, -10px, 0);
                  opacity: .54;
                }
              }

              @keyframes hooSelectPremiumLogo {
                0%, 100% {
                  text-shadow:
                    0 0 14px rgba(255,255,255,.05),
                    0 0 28px rgba(196,181,253,.09),
                    0 0 55px rgba(99,102,241,.04);
                }
                50% {
                  text-shadow:
                    0 0 18px rgba(255,255,255,.08),
                    0 0 34px rgba(196,181,253,.14),
                    0 0 68px rgba(99,102,241,.08);
                }
              }

              @keyframes hooSelectPremiumSweep {
                0% {
                  transform: translateX(-170%) skewX(-18deg);
                  opacity: 0;
                }
                20% {
                  opacity: .22;
                }
                55% {
                  opacity: .06;
                }
                100% {
                  transform: translateX(290%) skewX(-18deg);
                  opacity: 0;
                }
              }

              .hoo-select-premium-star {
                animation: hooSelectPremiumTwinkle 4.2s ease-in-out infinite;
              }

              .hoo-select-premium-galaxy {
                animation: hooSelectPremiumGalaxy 20s ease-in-out infinite;
              }

              .hoo-select-premium-orbit-a {
                animation: hooSelectPremiumOrbitA 42s linear infinite;
              }

              .hoo-select-premium-orbit-b {
                animation: hooSelectPremiumOrbitB 58s linear infinite;
              }

              .hoo-select-premium-breath {
                animation: hooSelectPremiumBreath 6.8s ease-in-out infinite;
              }

              .hoo-select-premium-core {
                animation: hooSelectPremiumCore 3.6s ease-in-out infinite;
              }

              .hoo-select-premium-dust {
                animation: hooSelectPremiumDust 6.4s ease-in-out infinite;
              }

              .hoo-select-premium-logo {
                animation: hooSelectPremiumLogo 5.6s ease-in-out infinite;
              }

              .hoo-select-premium-sweep {
                animation: hooSelectPremiumSweep 4.4s ease-in-out infinite;
              }

              @media (prefers-reduced-motion: reduce) {
                .hoo-select-premium-star,
                .hoo-select-premium-galaxy,
                .hoo-select-premium-orbit-a,
                .hoo-select-premium-orbit-b,
                .hoo-select-premium-breath,
                .hoo-select-premium-core,
                .hoo-select-premium-dust,
                .hoo-select-premium-logo,
                .hoo-select-premium-sweep {
                  animation: none !important;
                }
              }
            `}</style>

            <div className="pointer-events-none fixed inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#02030a_0%,#050817_34%,#07111f_68%,#020409_100%)]" />

              <div className="absolute inset-y-0 left-1/2 w-[72%] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(76,29,149,.05),rgba(37,99,235,.026),rgba(124,58,237,.04),transparent)]" />

              <div className="absolute left-1/2 top-[-28%] h-[820px] w-[1320px] -translate-x-1/2 rounded-full bg-violet-500/[0.09] blur-[175px]" />

              <div className="absolute -left-72 top-[24%] h-[620px] w-[620px] rounded-full bg-cyan-500/[0.038] blur-[160px]" />

              <div className="absolute -right-72 top-[18%] h-[680px] w-[680px] rounded-full bg-fuchsia-500/[0.035] blur-[170px]" />

              <div
                className="hoo-select-premium-galaxy absolute left-1/2 top-[17%] h-[310px] w-[135%] -translate-x-1/2 mix-blend-screen"
                style={{
                  background:
                    "linear-gradient(90deg,transparent 0%,rgba(14,165,233,.025) 12%,rgba(99,102,241,.10) 31%,rgba(196,181,253,.22) 44%,rgba(255,255,255,.16) 50%,rgba(216,180,254,.20) 58%,rgba(147,51,234,.10) 72%,rgba(37,99,235,.035) 87%,transparent 100%)",
                  filter: "blur(30px)",
                  WebkitMaskImage:
                    "linear-gradient(180deg,transparent 0%,rgba(0,0,0,.25) 12%,rgba(0,0,0,1) 48%,rgba(0,0,0,.42) 82%,transparent 100%)",
                  maskImage:
                    "linear-gradient(180deg,transparent 0%,rgba(0,0,0,.25) 12%,rgba(0,0,0,1) 48%,rgba(0,0,0,.42) 82%,transparent 100%)",
                }}
              />

              {selectBackgroundStars.map((star, index) => (
                <span
                  key={star.id}
                  className={`absolute rounded-full ${
                    index % 6 === 0 ? "hoo-select-premium-star" : ""
                  }`}
                  style={{
                    left: star.left,
                    top: star.top,
                    width: `${star.size}px`,
                    height: `${star.size}px`,
                    opacity: star.alpha,
                    background: selectStarColor(star.tone, 1),
                    animationDelay: `${star.delay}s`,
                    animationDuration: `${star.duration}s`,
                    boxShadow:
                      index % 11 === 0
                        ? `0 0 ${star.size * 4}px ${selectStarColor(
                            star.tone,
                            .64,
                          )},0 0 ${star.size * 8}px rgba(129,140,248,.12)`
                        : undefined,
                  }}
                />
              ))}

              <div className="absolute inset-x-[8%] top-0 h-px bg-gradient-to-r from-transparent via-violet-100/[0.10] to-transparent" />
            </div>

            <header className="relative z-10 mx-auto flex w-[89%] max-w-[1440px] items-center justify-between pb-4 pt-1 sm:pb-5">
              <div className="hidden min-w-[180px] items-center gap-3 lg:flex">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-violet-200/[0.16] bg-violet-300/[0.035] shadow-[0_0_22px_rgba(139,92,246,.06)]">
                  <div className="absolute inset-[7px] rounded-full border border-white/[0.055]" />
                  <span className="relative text-lg text-white/86">✦</span>
                </div>

                <div>
                  <p className="text-[9px] font-black tracking-[0.28em] text-violet-100/42">
                    HOO RHYTHM
                  </p>

                  <p className="mt-0.5 text-[10px] font-bold text-white/34">
                    MUSIC SELECT STAGE
                  </p>
                </div>
              </div>

              <div className="mx-auto text-center lg:absolute lg:left-1/2 lg:-translate-x-1/2">
                <p className="text-[8px] font-black tracking-[0.48em] text-violet-100/34 sm:text-[9px]">
                  2 KEY MANUAL RHYTHM
                </p>

                <h1 className="hoo-select-premium-logo mt-1 text-3xl font-black tracking-[0.12em] text-white sm:text-4xl lg:text-[44px]">
                  HOO RHYTHM
                </h1>

                <div className="mt-1.5 flex items-center justify-center gap-3">
                  <span className="h-px w-10 bg-gradient-to-r from-transparent to-violet-100/20" />

                  <p className="text-[9px] font-bold tracking-[0.20em] text-white/48 sm:text-[10px]">
                    음악이 머무는 또 하나의 밤
                  </p>

                  <span className="h-px w-10 bg-gradient-to-l from-transparent to-violet-100/20" />
                </div>
              </div>

              <div className="flex min-w-[180px] justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetPlay();
                    setIsRecording(false);
                    setScreen("home");
                  }}
                  className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3.5 py-2 text-[10px] font-black text-white/55 transition hover:border-violet-100/18 hover:bg-white/[0.05] hover:text-white/80"
                >
                  메인
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetPlay();
                    onExit();
                  }}
                  className="rounded-full border border-white/[0.10] bg-black/18 px-3.5 py-2 text-[10px] font-black text-white/74 transition hover:border-white/[0.18] hover:bg-white/[0.055] hover:text-white"
                >
                  나가기
                </button>
              </div>
            </header>

            {/* SELECT SCREEN FRAME */}
            <section className="relative mx-auto mb-5 w-[89%] max-w-[1440px] overflow-hidden rounded-[28px] border border-violet-200/[0.12] bg-[#070a18]/66 shadow-[0_30px_100px_rgba(0,0,0,.34),0_0_70px_rgba(99,102,241,.05),inset_0_1px_0_rgba(255,255,255,.035)]">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,14,34,.58),rgba(5,8,19,.78))]" />
                <div className="absolute left-[28%] top-[-30%] h-[420px] w-[720px] rounded-full bg-violet-500/[0.06] blur-[120px]" />
                <div className="absolute right-[-10%] top-[20%] h-[440px] w-[520px] rounded-full bg-fuchsia-500/[0.045] blur-[130px]" />
                <div className="absolute left-[-12%] bottom-[-22%] h-[420px] w-[520px] rounded-full bg-cyan-500/[0.035] blur-[120px]" />
                <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle,rgba(255,255,255,.9)_0_.7px,transparent_1px)] [background-size:34px_34px]" />
              </div>

              {/* TOP SELECT BAR */}
              <div className="relative z-10 flex flex-col gap-3 border-b border-white/[0.055] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setScreen("home")}
                    className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-violet-200/[0.18] bg-violet-300/[0.045] text-xl text-white/90 shadow-[0_0_18px_rgba(139,92,246,.05)] transition hover:border-violet-100/30 hover:bg-violet-300/[0.08]"
                    aria-label="메인으로"
                  >
                    ‹
                  </button>

                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black sm:text-2xl">곡 선택</h2>
                    <span className="hidden h-5 w-px bg-white/12 sm:block" />
                    <p className="hidden text-[10px] font-bold text-white/38 sm:block">
                      플레이할 곡을 선택하세요
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {["전체", "오리지널", "인기순", "난이도순"].map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      className={`rounded-[12px] border px-3.5 py-2 text-[10px] font-black transition ${
                        index === 0
                          ? "border-violet-300/40 bg-violet-400/[0.13] text-white shadow-[0_0_20px_rgba(139,92,246,.10)]"
                          : "border-white/[0.07] bg-white/[0.022] text-white/48 hover:border-violet-200/18 hover:bg-white/[0.04] hover:text-white/72"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/[0.07] bg-white/[0.022] text-sm text-white/50 transition hover:border-violet-200/18 hover:bg-white/[0.04] hover:text-white/75"
                    aria-label="필터"
                  >
                    ≡
                  </button>

                  <button
                    type="button"
                    onClick={() => void refreshPublishedSongs()}
                    disabled={cloudBusy}
                    className="flex h-9 items-center justify-center rounded-[12px] border border-cyan-200/[0.08] bg-cyan-300/[0.02] px-3 text-[9px] font-black text-cyan-100/42 transition hover:border-cyan-200/16 hover:bg-cyan-300/[0.04] disabled:opacity-40"
                    title="공식 송출 곡 목록 새로고침"
                  >
                    {cloudBusy ? "SYNC…" : "SYNC"}
                  </button>
                </div>
              </div>

              {/* MAIN 3-COLUMN COMPOSITION */}
              <div className="relative z-10 grid gap-3 p-3 sm:p-4 lg:grid-cols-[0.94fr_0.78fr_1.18fr] lg:gap-4 lg:p-4">
                {/* LEFT : SONG LIST */}
                <section className="min-h-0">
                  <div className="space-y-2">
                    {availableSongs.map((item, index) => {
                      const selected = item.id === song.id;
                      const artist =
                        selectSongArtist[item.id] || "HOO RHYTHM";
                      const itemCover =
                        songCovers[item.id] ||
                        (publishedSongMap[item.id]?.cover_url
                          ? {
                              dataUrl: publishedSongMap[item.id].cover_url as string,
                              fileName: "공개 커버 이미지",
                              updatedAt: publishedSongMap[item.id].updated_at,
                            }
                          : null);

                      return (
                        <div
                          key={item.id}
                          className={`group relative overflow-hidden rounded-[17px] border transition-all duration-300 ${
                            selected
                              ? "border-cyan-200/45 bg-[linear-gradient(90deg,rgba(34,211,238,.08),rgba(59,130,246,.055),rgba(139,92,246,.04))] shadow-[0_0_22px_rgba(34,211,238,.10),inset_0_1px_0_rgba(255,255,255,.04)]"
                              : "border-violet-200/[0.08] bg-black/[0.16] hover:border-violet-200/18 hover:bg-violet-300/[0.025]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (item.id === song.id) return;
                              if (audioUrl?.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
                              setPendingAudioFile(null);
                              setPendingAudioSongId(null);
                              localAudioSessionSongRef.current = null;
                              setAudioUrl(null);
                              setAudioName("");
                              setAnalysisMessage("");
                              setSongId(item.id);
                            }}
                            className="relative flex w-full items-center gap-3 px-3 py-2.5 text-left"
                          >
                          {selected && (
                            <>
                              <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/70 to-transparent" />
                              <span className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-cyan-200/70 via-blue-400/60 to-violet-400/50 shadow-[0_0_12px_rgba(34,211,238,.35)]" />
                            </>
                          )}

                          <div className="relative w-8 shrink-0 text-center">
                            <span className={`text-sm font-black ${selected ? "text-cyan-100/90" : "text-violet-100/45"}`}>
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          </div>

                          <div
                            className={`relative h-[58px] w-[58px] shrink-0 overflow-hidden rounded-[12px] border shadow-[inset_0_1px_0_rgba(255,255,255,.04)] ${
                              selected
                                ? "border-cyan-200/24 shadow-[0_0_18px_rgba(34,211,238,.06)]"
                                : "border-white/[0.065]"
                            }`}
                          >
                            {itemCover ? (
                              <>
                                <img
                                  src={itemCover.dataUrl}
                                  alt={`${item.title} cover`}
                                  className="absolute inset-0 h-full w-full object-cover"
                                  draggable={false}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-white/[0.025]" />
                              </>
                            ) : (
                              renderSelectSongThumbnail(item)
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[14px] font-black text-white sm:text-[15px]">
                              {item.title}
                            </h3>
                            <p className="mt-0.5 truncate text-[9px] font-bold tracking-[0.10em] text-violet-100/42 sm:text-[10px]">
                              {artist}
                            </p>
                          </div>

                          <div className="hidden items-center gap-1.5 sm:flex">
                            {[0, 1, 2, 3].map((dot) => (
                              <span
                                key={dot}
                                className={`h-2 w-2 rotate-45 border ${
                                  dot < Math.max(1, Math.min(4, Math.round(item.bpm / 50)))
                                    ? selected
                                      ? "border-cyan-100/80 bg-cyan-300/75 shadow-[0_0_6px_rgba(34,211,238,.35)]"
                                      : "border-violet-100/70 bg-violet-300/70"
                                    : "border-white/[0.18] bg-transparent"
                                }`}
                              />
                            ))}
                          </div>

                          <span className={`ml-1 text-xl transition-transform duration-300 group-hover:translate-x-0.5 ${
                            selected ? "text-cyan-100/90" : "text-white/35"
                          }`}>
                            ›
                          </span>
                          </button>

                          {isAdmin && (
                            <div className="flex items-center gap-1 border-t border-white/[0.045] bg-black/[0.10] px-2.5 py-1.5">
                              <span className="mr-auto text-[7px] font-black tracking-[0.10em] text-emerald-100/36">
                                ADMIN · {hasEditorDraft(item.id) ? "저장된 초안 있음" : "공식 송출본"}
                              </span>

                              <button
                                type="button"
                                onClick={() => void openPublishedSongForEdit(item.id)}
                                disabled={libraryActionBusyId === item.id}
                                className="rounded-[7px] border border-violet-200/[0.10] bg-violet-300/[0.03] px-2.5 py-1.5 text-[7px] font-black text-violet-50/58 transition hover:border-violet-200/22 hover:bg-violet-300/[0.07] disabled:opacity-35"
                              >
                                {hasEditorDraft(item.id) ? "이어하기" : "수정"}
                              </button>

                              <button
                                type="button"
                                onClick={() => void deletePublishedSong(item.id)}
                                disabled={libraryActionBusyId === item.id}
                                className="rounded-[7px] border border-rose-200/[0.10] bg-rose-300/[0.025] px-2.5 py-1.5 text-[7px] font-black text-rose-100/48 transition hover:border-rose-200/22 hover:bg-rose-300/[0.07] disabled:opacity-35"
                              >
                                {libraryActionBusyId === item.id ? "처리 중" : "삭제"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* CENTER : COVER + SCORE */}
                <section className="flex min-h-0 flex-col gap-3">
                  <div className="relative overflow-hidden rounded-[20px] border border-violet-200/[0.14] bg-black/[0.18] p-1.5 shadow-[0_0_24px_rgba(139,92,246,.06)]">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[16px] border border-violet-200/[0.12] bg-[radial-gradient(circle_at_58%_34%,rgba(255,255,255,.10),transparent_6%),radial-gradient(circle_at_50%_34%,rgba(59,130,246,.30),transparent_28%),radial-gradient(circle_at_55%_58%,rgba(139,92,246,.28),transparent_34%),linear-gradient(180deg,#09122f,#15123a_55%,#050815)]">
                      <div className="absolute inset-0 opacity-[0.30] [background-image:radial-gradient(circle,rgba(255,255,255,.92)_0_.7px,transparent_1px)] [background-size:26px_26px]" />

                      {selectedCover && (
                        <>
                          <img
                            src={selectedCover.dataUrl}
                            alt={`${song.title} cover`}
                            className="absolute inset-0 z-20 h-full w-full object-cover object-center"
                            draggable={false}
                          />

                          <div className="absolute inset-0 z-[21] bg-[linear-gradient(180deg,rgba(2,4,12,.03)_0%,transparent_52%,rgba(2,3,10,.35)_78%,rgba(2,3,10,.88)_100%)]" />

                          <div className="absolute inset-x-[8%] top-0 z-[22] h-px bg-gradient-to-r from-transparent via-white/28 to-transparent" />
                        </>
                      )}

                      {selectCoverStars.map((star, index) => (
                        <span
                          key={star.id}
                          className={`absolute rounded-full ${
                            index % 7 === 0 ? "hoo-select-premium-star" : ""
                          }`}
                          style={{
                            left: star.left,
                            top: star.top,
                            width: `${star.size}px`,
                            height: `${star.size}px`,
                            opacity: Math.min(.92, star.alpha + .08),
                            background: selectStarColor(star.tone, 1),
                            animationDelay: `${star.delay}s`,
                            animationDuration: `${star.duration}s`,
                            boxShadow:
                              index % 13 === 0
                                ? `0 0 ${star.size * 4}px ${selectStarColor(
                                    star.tone,
                                    .60,
                                  )}`
                                : undefined,
                          }}
                        />
                      ))}

                      <div
                        className="hoo-select-premium-breath absolute left-1/2 top-[36%] h-[70%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{
                          background:
                            `radial-gradient(circle_at_center,rgba(255,255,255,.035) 0 10%,${selectedAccent.primary}18 28%,${selectedAccent.secondary}24 43%,${selectedAccent.tertiary}12 56%,transparent 72%)`,
                          filter: "blur(2px)",
                        }}
                      />

                      <div
                        className="hoo-select-premium-orbit-a absolute left-1/2 top-[36%] h-[35%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border"
                        style={{
                          borderColor: `${selectedAccent.primary}2b`,
                        }}
                      />

                      <div
                        className="hoo-select-premium-orbit-b absolute left-1/2 top-[36%] h-[25%] w-[69%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border"
                        style={{
                          borderColor: `${selectedAccent.tertiary}24`,
                        }}
                      />

                      <div className="absolute left-1/2 top-[36%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07] bg-[radial-gradient(circle_at_42%_35%,rgba(255,255,255,.055),rgba(7,9,24,.78)_45%,rgba(2,3,10,.98)_78%)] shadow-[inset_-20px_-22px_40px_rgba(0,0,0,.72),0_0_48px_rgba(99,102,241,.14)]">
                        <div className="absolute inset-[14%] rounded-full border border-white/[0.055]" />
                        <div className="absolute inset-[29%] rounded-full border border-violet-100/[0.08]" />
                        <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2">
                          <div
                            className="absolute inset-0 bg-white"
                            style={{
                              clipPath:
                                "polygon(50% 0%,60% 39%,100% 50%,60% 61%,50% 100%,40% 61%,0% 50%,40% 39%)",
                              filter:
                                "drop-shadow(0 0 8px rgba(255,255,255,.9)) drop-shadow(0 0 18px rgba(196,181,253,.6))",
                            }}
                          />
                        </div>
                      </div>

                      {selectConstellationPoints.map((point, index) => (
                        <span
                          key={point.id}
                          className="hoo-select-premium-dust absolute h-1 w-1 rounded-full bg-white/42"
                          style={{
                            left: point.left,
                            top: point.top,
                            animationDelay: `${point.delay}s`,
                            boxShadow:
                              index % 4 === 0
                                ? `0 0 8px ${selectedAccent.primary}88`
                                : undefined,
                          }}
                        />
                      ))}

                      <div className="absolute inset-x-[-10%] bottom-[18%] h-[28%]">
                        <div
                          className="absolute bottom-0 left-0 h-full w-[36%]"
                          style={{
                            background: selectedAccent.dark,
                            clipPath:
                              "polygon(0 100%,0 68%,10% 58%,17% 72%,28% 40%,38% 61%,49% 30%,58% 57%,70% 38%,81% 70%,90% 47%,100% 78%,100% 100%)",
                          }}
                        />

                        <div
                          className="absolute bottom-0 right-0 h-full w-[40%]"
                          style={{
                            background: selectedAccent.dark,
                            clipPath:
                              "polygon(0 78%,10% 52%,22% 70%,31% 33%,42% 62%,54% 41%,64% 66%,77% 28%,86% 63%,100% 47%,100% 100%,0 100%)",
                          }}
                        />
                      </div>

                      <div className="absolute inset-x-0 bottom-0 z-[23] h-[38%] bg-[linear-gradient(180deg,transparent,rgba(3,6,15,.10),rgba(2,4,10,.82))]" />
                      <div className="absolute inset-x-0 bottom-6 z-[24] text-center">
                        <p className="text-[9px] font-black tracking-[0.45em] text-white/70">
                          {selectedEnglishTitle}
                        </p>
                        <p className="mt-1 text-[8px] font-bold tracking-[0.32em] text-violet-100/44">
                          {selectedArtist}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[16px] border border-amber-200/[0.10] bg-black/[0.16] p-3">
                      <p className="text-[8px] font-black tracking-[0.14em] text-amber-100/55">BEST SCORE</p>
                      <div className="mt-1 flex items-end justify-between gap-2">
                        <p className="truncate text-xl font-black tracking-[-0.03em] text-white">
                          {best.score.toLocaleString()}
                        </p>

                        <span className="text-lg font-black text-amber-200/78">
                          {selectBestGrade}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-[16px] border border-cyan-200/[0.10] bg-black/[0.16] p-3">
                      <p className="text-[8px] font-black tracking-[0.14em] text-cyan-100/55">MAX COMBO</p>
                      <div className="mt-1 flex items-end justify-between gap-2">
                        <p className="truncate text-xl font-black tracking-[-0.03em] text-white">
                          {best.combo.toLocaleString()}
                        </p>

                        <span className="text-[10px] font-black text-cyan-100/52">
                          {best.combo > 0 ? "BEST" : "--"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setScreen("detail")}
                    className="mt-auto flex items-center justify-between rounded-[15px] border border-violet-200/[0.12] bg-violet-300/[0.03] px-4 py-3 text-[11px] font-black text-white/78 transition hover:border-violet-200/22 hover:bg-violet-300/[0.055]"
                  >
                    <span>곡 상세</span>
                    <span className="text-lg text-violet-100/60">›</span>
                  </button>
                </section>

                {/* RIGHT : SONG INFO + DIFFICULTY */}
                <section className="flex min-h-0 flex-col">
                  <div className="border-b border-white/[0.055] pb-4">
                    <p className="text-[9px] font-black tracking-[0.24em] text-violet-100/48">
                      {song.genre}
                    </p>
                    <h2 className="mt-1.5 text-3xl font-black tracking-[-0.035em] text-white sm:text-[36px]">
                      {song.title}
                    </h2>
                    <p
                      className="mt-1 text-[12px] font-bold tracking-[0.12em]"
                      style={{
                        color: `${selectedAccent.secondary}b8`,
                      }}
                    >
                      {selectedArtist}
                    </p>
                    <p className="mt-4 max-w-lg text-[11px] font-bold leading-5 text-white/48">
                      {selectedDescription}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-b border-white/[0.055] py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl text-violet-100/70">♫</span>
                      <div>
                        <p className="text-[8px] font-bold text-white/30">BPM</p>
                        <p className="text-sm font-black">{song.bpm}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl text-violet-100/70">◉</span>
                      <div>
                        <p className="text-[8px] font-bold text-white/30">장르</p>
                        <p className="truncate text-[10px] font-black text-white/72">{song.genre}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl text-violet-100/70">◷</span>
                      <div>
                        <p className="text-[8px] font-bold text-white/30">재생 시간</p>
                        <p className="text-sm font-black">{formatTime(song.duration)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {([
                      ["easy", "EASY", "가볍게 즐기는 리듬", "3"],
                      ["normal", "NORMAL", "표준적인 플레이 경험", "6"],
                      ["hard", "HARD", "도전하는 당신을 위해", "9"],
                    ] as const).map(([level, label, desc, levelNo]) => {
                      const active = difficulty === level;
                      const accent =
                        level === "easy"
                          ? "cyan"
                          : level === "normal"
                            ? "violet"
                            : "fuchsia";

                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setDifficulty(level)}
                          className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[16px] border px-3 py-2.5 text-left transition-all ${
                            active
                              ? level === "easy"
                                ? "border-cyan-200/45 bg-cyan-300/[0.075] shadow-[0_0_20px_rgba(34,211,238,.10)]"
                                : level === "normal"
                                  ? "border-violet-200/50 bg-violet-300/[0.09] shadow-[0_0_24px_rgba(139,92,246,.12)]"
                                  : "border-fuchsia-200/48 bg-fuchsia-300/[0.08] shadow-[0_0_22px_rgba(217,70,239,.10)]"
                              : "border-white/[0.07] bg-white/[0.018] hover:border-white/[0.13] hover:bg-white/[0.035]"
                          }`}
                        >
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
                              accent === "cyan"
                                ? "border-cyan-200/25 bg-cyan-300/[0.04] text-cyan-100"
                                : accent === "violet"
                                  ? "border-violet-200/25 bg-violet-300/[0.04] text-violet-100"
                                  : "border-fuchsia-200/25 bg-fuchsia-300/[0.04] text-fuchsia-100"
                            }`}
                          >
                            ✦
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-black text-white">{label}</p>
                            <p className="mt-0.5 text-[9px] font-bold text-white/38">{desc}</p>
                          </div>

                          <div className="hidden items-center gap-2 sm:flex">
                            <span className="text-[9px] font-black text-white/40">난이도 {levelNo}</span>
                            <div className="flex gap-1">
                              {[0, 1, 2, 3, 4].map((dot) => (
                                <span
                                  key={dot}
                                  className={`h-2 w-2 rotate-45 border ${
                                    dot < (level === "easy" ? 1 : level === "normal" ? 3 : 4)
                                      ? accent === "cyan"
                                        ? "border-cyan-100/80 bg-cyan-300/75"
                                        : accent === "violet"
                                          ? "border-violet-100/80 bg-violet-300/75"
                                          : "border-fuchsia-100/80 bg-fuchsia-300/75"
                                      : "border-white/[0.16] bg-transparent"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {analysisMessage && (
                    <p className="mt-3 rounded-[12px] border border-amber-200/[0.08] bg-amber-300/[0.025] px-3 py-2 text-[9px] font-bold leading-5 text-amber-100/56">
                      {analysisMessage}
                    </p>
                  )}

                  {cloudMessage && (
                    <p className="mt-2 rounded-[12px] border border-violet-200/[0.07] bg-violet-300/[0.02] px-3 py-2 text-[8px] font-bold leading-5 text-violet-100/42">
                      {cloudMessage}
                    </p>
                  )}

                  {audioName && (
                    <p className="mt-2 truncate text-[9px] font-bold text-emerald-100/55">
                      연결된 음원 · {audioName}
                    </p>
                  )}

                  <div className="mt-auto pt-4">
                    <button
                      type="button"
                      onClick={beginPlay}
                      disabled={
                        playBusy ||
                        !currentPublishedSong?.audio_url ||
                        !currentPublishedSong?.charts?.[difficulty]?.notes?.length
                      }
                      className="relative w-full overflow-hidden rounded-[15px] border border-violet-200/35 bg-[linear-gradient(90deg,rgba(79,70,229,.82),rgba(147,51,234,.86),rgba(217,70,239,.88))] px-5 py-3 text-sm font-black tracking-[0.08em] text-white shadow-[0_0_24px_rgba(139,92,246,.22),inset_0_1px_0_rgba(255,255,255,.10)] transition hover:scale-[1.015] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
                    >
                      <span className="relative flex items-center justify-center gap-2">
                        <span>{playBusy ? "◌" : "▶"}</span>
                        <span>{playBusy ? "공식 곡 확인 중" : "PLAY"}</span>
                        <span>{playBusy ? "" : "›"}</span>
                      </span>
                    </button>

                    <div className="mt-2 flex items-center justify-center gap-2 text-[8px] font-bold tracking-[0.08em]">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          currentPublishedSong?.audio_url
                            ? "bg-emerald-300/70 shadow-[0_0_7px_rgba(110,231,183,.35)]"
                            : songSyncState === "syncing"
                              ? "bg-violet-300/70"
                              : "bg-white/20"
                        }`}
                      />
                      <span
                        className={
                          currentPublishedSong?.audio_url
                            ? "text-emerald-100/42"
                            : "text-white/22"
                        }
                      >
                        {currentPublishedSong?.audio_url &&
                        currentPublishedSong?.charts?.[difficulty]?.notes?.length
                          ? "공식 음원 · 현재 난이도 채보 연결됨"
                          : "공식 음원 또는 현재 난이도 채보를 확인해주세요"}
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              <div className="relative z-10 border-t border-white/[0.04] bg-black/[0.10] px-4 py-2 sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-100/38 shadow-[0_0_8px_rgba(221,214,254,.22)]" />

                    <p className="text-[8px] font-black tracking-[0.16em] text-white/26">
                      HOO RHYTHM · MUSIC SELECT
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-[8px] font-bold text-white/24">
                    <span>A · K</span>
                    <span>2 KEY</span>
                    <span>{difficulty.toUpperCase()}</span>
                    <span>BPM {song.bpm}</span>
                  </div>
                </div>
              </div>
            </section>
          </main>
          );
        })()}

        {screen === "detail" && (
          <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-8">
            <section className="w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.055] shadow-2xl">
              <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
                <div className="relative min-h-[340px] overflow-hidden bg-[radial-gradient(circle_at_50%_40%,rgba(167,139,250,0.28),transparent_28%),linear-gradient(150deg,#111936,#26153b)] p-8 sm:min-h-[520px]">
                  <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-violet-300/5 shadow-[0_0_100px_rgba(139,92,246,0.22)]" />
                  <div className="relative flex h-full flex-col justify-between">
                    <p className="text-xs font-black tracking-[0.24em] text-violet-200/50">HOO RHYTHM</p>
                    <div><p className="text-sm font-bold text-white/45">{song.subtitle}</p><h2 className="mt-2 text-4xl font-black sm:text-5xl">{song.title}</h2></div>
                  </div>
                </div>
                <div className="p-5 sm:p-8 lg:p-10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-black tracking-[0.22em] text-violet-200/50">
                      SONG DETAIL
                    </p>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[8px] font-black tracking-[0.12em] ${
                        currentPublishedSong?.published
                          ? "border-emerald-200/[0.12] bg-emerald-300/[0.03] text-emerald-100/62"
                          : "border-amber-200/[0.12] bg-amber-300/[0.03] text-amber-100/62"
                      }`}
                    >
                      {currentPublishedSong?.published
                        ? "OFFICIAL PUBLISHED"
                        : "DRAFT / NOT PUBLISHED"}
                    </span>
                  </div>
                  <h3 className="mt-2 text-3xl font-black">
                    난이도를 선택하세요
                  </h3>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {(["easy", "normal", "hard"] as Difficulty[]).map((level, idx) => (
                      <button key={level} type="button" onClick={() => setDifficulty(level)} className={`rounded-[22px] border p-5 text-left transition ${difficulty === level ? "border-violet-300/50 bg-violet-400/16 shadow-[0_0_35px_rgba(139,92,246,0.12)]" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.07]"}`}>
                        <p className="text-xs font-black tracking-[0.14em] text-white/45">{level.toUpperCase()}</p>
                        <p className="mt-4 text-lg font-black">{"★".repeat(idx + 1)}<span className="text-white/15">{"★".repeat(2 - idx)}</span></p>
                        <p className="mt-3 text-xs font-bold leading-6 text-white/45">{level === "easy" ? "핵심 박자 중심" : level === "normal" ? "멜로디와 박자의 균형" : "세부 리듬과 빠른 교차"}</p>
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 rounded-[22px] border border-white/10 bg-black/15 p-5">
                    <div><p className="text-[10px] font-black tracking-[0.16em] text-white/35">BEST SCORE</p><p className="mt-1 text-2xl font-black">{best.score.toLocaleString()}</p></div>
                    <div><p className="text-[10px] font-black tracking-[0.16em] text-white/35">MAX COMBO</p><p className="mt-1 text-2xl font-black">{best.combo}</p></div>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-[0.72fr_1.28fr]">
                    <button
                      type="button"
                      onClick={() => setScreen("select")}
                      className="rounded-2xl border border-white/12 bg-white/[0.04] py-3.5 text-sm font-black text-white/65 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                    >
                      곡 선택으로
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (playBusy) return;

                        if (!currentPublishedSong?.published) {
                          setAnalysisMessage(
                            "이 화면은 아직 송출 전 초안입니다. 관리자 작업실에서 '전체 이용자에게 송출'을 완료한 뒤 곡 선택 목록에서 다시 들어와주세요.",
                          );
                          return;
                        }

                        if (!currentPublishedSong.audio_url) {
                          setAnalysisMessage(
                            "공식 곡 데이터는 있지만 음원 URL이 없습니다. 관리자 작업실에서 음원을 다시 등록하고 송출해주세요.",
                          );
                          return;
                        }

                        const officialNotes =
                          currentPublishedSong.charts?.[
                            difficulty
                          ]?.notes;

                        if (
                          !Array.isArray(officialNotes) ||
                          officialNotes.length === 0
                        ) {
                          setAnalysisMessage(
                            `${difficulty.toUpperCase()} 공식 채보가 없습니다. 해당 난이도 채보를 만든 뒤 다시 송출해주세요.`,
                          );
                          return;
                        }

                        beginPlay();
                      }}
                      className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3.5 text-sm font-black text-white shadow-[0_12px_35px_rgba(139,92,246,0.28)] transition hover:brightness-110 active:scale-[0.99]"
                    >
                      {playBusy ? "공식 음원 준비 중…" : "▶ PLAY"}
                    </button>
                  </div>
                  <div
                    className={`mt-3 rounded-[14px] border px-3 py-2.5 text-center text-[10px] font-black ${
                      currentPublishedSong?.published &&
                      currentPublishedSong?.audio_url &&
                      currentPublishedSong?.charts?.[
                        difficulty
                      ]?.notes?.length
                        ? "border-emerald-200/[0.10] bg-emerald-300/[0.025] text-emerald-100/58"
                        : "border-amber-200/[0.10] bg-amber-300/[0.025] text-amber-100/58"
                    }`}
                  >
                    {currentPublishedSong?.published &&
                    currentPublishedSong?.audio_url &&
                    currentPublishedSong?.charts?.[
                      difficulty
                    ]?.notes?.length
                      ? `공식 송출 연결 완료 · ${difficulty.toUpperCase()} ${currentPublishedSong.charts[difficulty].notes.length} NOTES`
                      : "공식 송출 데이터가 연결되지 않았습니다."}
                  </div>

                  {analysisMessage && (
                    <p className="mt-2 rounded-[12px] border border-rose-200/[0.10] bg-rose-300/[0.025] px-3 py-2 text-center text-[10px] font-bold leading-5 text-rose-100/65">
                      {analysisMessage}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-white/40">
                    <span>BPM {Math.round(chart.bpm)}</span>
                    <span>{formatTime(effectiveDuration)}</span>
                    <span>{chart.notes.length} NOTES</span>
                    <span>KEY A K</span>
                  </div>
                </div>
              </div>
            </section>
          </main>
        )}

        {screen === "play" && (
          <main
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-black"
          >
            <style>{`

              @keyframes hooStageStarFloat {
                0% {
                  transform:
                    translate3d(
                      0,
                      0,
                      0
                    )
                    scale(.82);
                  opacity: .14;
                }
                45% {
                  opacity: .7;
                }
                100% {
                  transform:
                    translate3d(
                      var(--dx),
                      var(--dy),
                      0
                    )
                    scale(1.12);
                  opacity: .08;
                }
              }

              @keyframes hooStageDustFloat {
                0% {
                  transform:
                    translate3d(
                      0,
                      0,
                      0
                    )
                    rotate(0deg);
                  opacity: .06;
                }
                50% {
                  opacity: .25;
                }
                100% {
                  transform:
                    translate3d(
                      var(--dx),
                      var(--dy),
                      0
                    )
                    rotate(42deg);
                  opacity: .04;
                }
              }

              @keyframes hooStageAuroraA {
                0%,
                100% {
                  transform:
                    translate3d(
                      -50%,
                      0,
                      0
                    )
                    rotate(-5deg)
                    scale(1);
                  opacity: .34;
                }
                50% {
                  transform:
                    translate3d(
                      -50%,
                      14px,
                      0
                    )
                    rotate(-2deg)
                    scale(1.045);
                  opacity: .56;
                }
              }

              @keyframes hooStageAuroraB {
                0%,
                100% {
                  transform:
                    translate3d(
                      -50%,
                      0,
                      0
                    )
                    rotate(7deg)
                    scale(1.03);
                  opacity: .22;
                }
                50% {
                  transform:
                    translate3d(
                      -50%,
                      -18px,
                      0
                    )
                    rotate(4deg)
                    scale(.98);
                  opacity: .44;
                }
              }

              @keyframes hooStageHorizon {
                0%,
                100% {
                  opacity: .16;
                  transform:
                    translateX(-50%)
                    scaleX(.86);
                }
                50% {
                  opacity: .46;
                  transform:
                    translateX(-50%)
                    scaleX(1.04);
                }
              }

              @keyframes hooStageLaneBreath {
                0%,
                100% {
                  opacity: .12;
                }
                50% {
                  opacity: .24;
                }
              }

              @keyframes hooStageLaneCurrent {
                0% {
                  transform:
                    translateY(-100%);
                  opacity: 0;
                }
                18% {
                  opacity: .44;
                }
                100% {
                  transform:
                    translateY(170%);
                  opacity: 0;
                }
              }

              @keyframes hooStageHitLine {
                0%,
                100% {
                  opacity: .46;
                  filter:
                    brightness(.92);
                }
                50% {
                  opacity: .88;
                  filter:
                    brightness(1.18);
                }
              }

              @keyframes hooStageKeyPulse {
                0% {
                  transform:
                    scale(.93);
                  opacity: .36;
                }
                45% {
                  transform:
                    scale(1.05);
                  opacity: .78;
                }
                100% {
                  transform:
                    scale(1.18);
                  opacity: 0;
                }
              }

              @keyframes hooTrailTierEnter {
                0% {
                  opacity: 0;
                  filter:
                    brightness(.58)
                    saturate(.72);
                }
                45% {
                  opacity: .68;
                }
                100% {
                  opacity: 1;
                  filter:
                    brightness(1)
                    saturate(1);
                }
              }

              @keyframes hooTrailAfterimageBreath {
                0%,
                100% {
                  opacity:
                    calc(
                      var(--trail-opacity) *
                      .66
                    );
                  filter:
                    brightness(.92);
                }
                50% {
                  opacity:
                    var(--trail-opacity);
                  filter:
                    brightness(1.24);
                }
              }

              @keyframes hooTrailAfterimageFloat {
                0% {
                  opacity: .16;
                  transform:
                    scaleY(.90);
                }
                38% {
                  opacity: .72;
                  transform:
                    scaleY(1.015);
                }
                100% {
                  opacity: .20;
                  transform:
                    scaleY(.965);
                }
              }

              @keyframes hooTrailAfterimageSweep {
                0% {
                  opacity: 0;
                  filter:
                    brightness(.75);
                }
                22% {
                  opacity: .64;
                }
                56% {
                  opacity: .92;
                  filter:
                    brightness(1.48);
                }
                100% {
                  opacity: 0;
                  filter:
                    brightness(.86);
                }
              }

              @keyframes hooTrailSparkFloat {
                0% {
                  opacity: 0;
                  transform:
                    translate3d(
                      0,
                      3px,
                      0
                    )
                    scale(.42);
                }
                22% {
                  opacity:
                    var(--spark-opacity);
                }
                100% {
                  opacity: 0;
                  transform:
                    translate3d(
                      var(--spark-drift-x),
                      var(--spark-drift-y),
                      0
                    )
                    scale(.08);
                }
              }

              @keyframes hooTrailNoteNeon {
                0%,
                100% {
                  filter:
                    brightness(1)
                    saturate(1.08);
                }
                50% {
                  filter:
                    brightness(1.25)
                    saturate(1.30);
                }
              }

              @keyframes hooTrailFloorNeon {
                0%,
                100% {
                  opacity: .52;
                  filter:
                    brightness(.96);
                }
                50% {
                  opacity: .84;
                  filter:
                    brightness(1.22);
                }
              }

              @keyframes hooTrailFloorFlow {
                0% {
                  transform:
                    translateY(-115%);
                  opacity: 0;
                }
                14% {
                  opacity: .68;
                }
                50% {
                  opacity: .34;
                }
                100% {
                  transform:
                    translateY(135%);
                  opacity: 0;
                }
              }

              @keyframes hooFloorInputFlash {
                0% {
                  opacity: 0;
                  filter:
                    brightness(.86)
                    saturate(.90);
                }
                12% {
                  opacity: .92;
                  filter:
                    brightness(1.55)
                    saturate(1.34);
                }
                42% {
                  opacity: .40;
                }
                100% {
                  opacity: 0;
                  filter:
                    brightness(1);
                }
              }

              @keyframes hooFloorTravelSweep {
                0% {
                  transform:
                    translateY(-115%);
                  opacity: 0;
                }
                14% {
                  opacity: .26;
                }
                72% {
                  opacity: .14;
                }
                100% {
                  transform:
                    translateY(132%);
                  opacity: 0;
                }
              }

              @keyframes hooDirectNoteGlowA {
                0%,
                100% {
                  filter:
                    brightness(1.10)
                    saturate(1.12);
                  box-shadow:
                    0 0 9px
                    rgba(103,232,249,.58),
                    0 0 22px
                    rgba(34,211,238,.36),
                    inset 0 0 12px
                    rgba(207,250,254,.14);
                }
                50% {
                  filter:
                    brightness(1.28)
                    saturate(1.26);
                  box-shadow:
                    0 0 13px
                    rgba(207,250,254,.82),
                    0 0 34px
                    rgba(34,211,238,.52),
                    inset 0 0 17px
                    rgba(207,250,254,.22);
                }
              }

              @keyframes hooDirectNoteGlowK {
                0%,
                100% {
                  filter:
                    brightness(1.10)
                    saturate(1.12);
                  box-shadow:
                    0 0 9px
                    rgba(240,171,252,.56),
                    0 0 22px
                    rgba(217,70,239,.35),
                    inset 0 0 12px
                    rgba(250,232,255,.13);
                }
                50% {
                  filter:
                    brightness(1.28)
                    saturate(1.26);
                  box-shadow:
                    0 0 13px
                    rgba(250,232,255,.80),
                    0 0 34px
                    rgba(217,70,239,.50),
                    inset 0 0 17px
                    rgba(250,232,255,.21);
                }
              }

              .hoo-floor-input-flash {
                animation:
                  hooFloorInputFlash
                  .52s
                  cubic-bezier(.13,.82,.20,1)
                  both;
              }

              .hoo-floor-travel-sweep {
                animation:
                  hooFloorTravelSweep
                  2.1s
                  linear
                  infinite;
              }

              .hoo-note-direct-glow-a {
                filter:
                  brightness(1.16)
                  saturate(1.18);
                box-shadow:
                  0 0 10px rgba(207,250,254,.72),
                  0 0 27px rgba(34,211,238,.43),
                  inset 0 0 14px rgba(207,250,254,.17);
              }

              .hoo-note-direct-glow-k {
                filter:
                  brightness(1.16)
                  saturate(1.18);
                box-shadow:
                  0 0 10px rgba(250,232,255,.70),
                  0 0 27px rgba(217,70,239,.42),
                  inset 0 0 14px rgba(250,232,255,.16);
              }

              @keyframes hooCombo30Flash {
                0% {
                  opacity: 0;
                }
                8% {
                  opacity: .82;
                }
                26% {
                  opacity: .24;
                }
                100% {
                  opacity: 0;
                }
              }

              @keyframes hooCombo30Text {
                0% {
                  opacity: 0;
                  transform:
                    translate(-50%,-50%)
                    scale(.52);
                  letter-spacing: .42em;
                  filter:
                    blur(8px);
                }
                14% {
                  opacity: 1;
                  transform:
                    translate(-50%,-50%)
                    scale(1.12);
                  letter-spacing: .14em;
                  filter:
                    blur(0);
                }
                56% {
                  opacity: 1;
                  transform:
                    translate(-50%,-50%)
                    scale(1);
                }
                100% {
                  opacity: 0;
                  transform:
                    translate(-50%,-58%)
                    scale(.92);
                  letter-spacing: .24em;
                  filter:
                    blur(2px);
                }
              }

              @keyframes hooCombo30Ring {
                0% {
                  opacity: .96;
                  transform:
                    translate(-50%,-50%)
                    scale(.15);
                }
                100% {
                  opacity: 0;
                  transform:
                    translate(-50%,-50%)
                    scale(3.4);
                }
              }

              @keyframes hooCombo30Ray {
                0% {
                  opacity: 0;
                  transform:
                    translate(-50%,-50%)
                    rotate(var(--combo-angle))
                    scaleX(.08);
                }
                16% {
                  opacity:
                    var(--combo-opacity);
                }
                100% {
                  opacity: 0;
                  transform:
                    translate(-50%,-50%)
                    rotate(var(--combo-angle))
                    scaleX(1);
                }
              }

              @keyframes hooCombo30FloorSurge {
                0% {
                  opacity: 0;
                  filter:
                    brightness(.72)
                    saturate(.85);
                }
                12% {
                  opacity: 1;
                  filter:
                    brightness(1.72)
                    saturate(1.44);
                }
                44% {
                  opacity: .82;
                  filter:
                    brightness(1.32)
                    saturate(1.25);
                }
                100% {
                  opacity: .12;
                  filter:
                    brightness(1)
                    saturate(1);
                }
              }

              @keyframes hooCombo30FloorWave {
                0% {
                  opacity: 0;
                  transform:
                    translateY(105%)
                    scaleY(.25);
                }
                18% {
                  opacity: .92;
                }
                100% {
                  opacity: 0;
                  transform:
                    translateY(-122%)
                    scaleY(1.06);
                }
              }

              .hoo-trail-tier-enter {
                animation:
                  hooTrailTierEnter
                  .62s
                  ease-out
                  both;
              }

              .hoo-trail-afterimage-outer {
                animation:
                  hooTrailAfterimageBreath
                  var(--trail-breathe-duration)
                  ease-in-out
                  infinite;
                transform-box:
                  fill-box;
                transform-origin:
                  center bottom;
              }

              .hoo-trail-afterimage-main {
                animation:
                  hooTrailAfterimageFloat
                  var(--trail-float-duration)
                  ease-in-out
                  infinite
                  alternate;
                transform-box:
                  fill-box;
                transform-origin:
                  center bottom;
              }

              .hoo-trail-afterimage-sweep {
                animation:
                  hooTrailAfterimageSweep
                  var(--trail-sweep-duration)
                  ease-in-out
                  infinite;
                transform-box:
                  fill-box;
                transform-origin:
                  center bottom;
              }

              .hoo-trail-spark {
                animation:
                  hooTrailSparkFloat
                  var(--trail-spark-duration)
                  ease-out
                  infinite;
              }

              .hoo-trail-note-neon {
                animation:
                  hooTrailNoteNeon
                  1.08s
                  ease-in-out
                  infinite;
              }

              .hoo-trail-floor-neon {
                opacity: 1;
              }

              .hoo-trail-floor-flow {
                animation:
                  hooTrailFloorFlow
                  1.45s
                  linear
                  infinite;
              }

              .hoo-combo30-flash {
                animation:
                  hooCombo30Flash
                  1.05s
                  ease-out
                  both;
              }

              .hoo-combo30-text {
                animation:
                  hooCombo30Text
                  1.12s
                  cubic-bezier(.13,.84,.20,1)
                  both;
              }

              .hoo-combo30-ring {
                animation:
                  hooCombo30Ring
                  .88s
                  cubic-bezier(.11,.70,.20,1)
                  both;
              }

              .hoo-combo30-ray {
                transform-origin:
                  0 50%;
                animation:
                  hooCombo30Ray
                  var(--combo-duration)
                  cubic-bezier(.14,.74,.22,1)
                  both;
              }

              .hoo-combo30-floor-surge {
                animation:
                  hooCombo30FloorSurge
                  1.12s
                  cubic-bezier(.13,.84,.20,1)
                  both;
              }

              .hoo-combo30-floor-wave {
                animation:
                  hooCombo30FloorWave
                  .98s
                  cubic-bezier(.16,.76,.22,1)
                  both;
              }

              @keyframes hooComboMilestoneText {
                0% {
                  opacity: 0;
                  transform:
                    translate(-50%,-50%)
                    scale(.46);
                  letter-spacing: .40em;
                  filter:
                    blur(10px)
                    brightness(.7);
                }
                12% {
                  opacity: 1;
                  transform:
                    translate(-50%,-50%)
                    scale(1.14);
                  letter-spacing: .12em;
                  filter:
                    blur(0)
                    brightness(1.46);
                }
                48% {
                  opacity: 1;
                  transform:
                    translate(-50%,-50%)
                    scale(1);
                  filter:
                    brightness(1.08);
                }
                100% {
                  opacity: 0;
                  transform:
                    translate(-50%,-62%)
                    scale(.94);
                  letter-spacing: .24em;
                  filter:
                    blur(2px)
                    brightness(.9);
                }
              }

              @keyframes hooComboCenturyText {
                0% {
                  opacity: 0;
                  transform:
                    translate(-50%,-50%)
                    scale(.38);
                  filter:
                    blur(14px)
                    brightness(.6)
                    saturate(.8);
                }
                10% {
                  opacity: 1;
                  transform:
                    translate(-50%,-50%)
                    scale(1.20);
                  filter:
                    blur(0)
                    brightness(2)
                    saturate(1.55);
                }
                32% {
                  transform:
                    translate(-50%,-50%)
                    scale(.98);
                  filter:
                    brightness(1.48)
                    saturate(1.32);
                }
                62% {
                  opacity: 1;
                  transform:
                    translate(-50%,-52%)
                    scale(1.04);
                }
                100% {
                  opacity: 0;
                  transform:
                    translate(-50%,-68%)
                    scale(.90);
                  filter:
                    blur(3px)
                    brightness(1);
                }
              }

              @keyframes hooComboStarDustFly {
                0% {
                  opacity: 0;
                  transform:
                    translate(-50%,-50%)
                    rotate(var(--star-angle))
                    translateX(0)
                    rotate(var(--star-spin-start))
                    scale(.18);
                  filter:
                    brightness(.9);
                }
                9% {
                  opacity:
                    var(--star-opacity);
                }
                26% {
                  filter:
                    brightness(1.85);
                }
                100% {
                  opacity: 0;
                  transform:
                    translate(-50%,-50%)
                    rotate(
                      calc(
                        var(--star-angle) +
                        var(--star-curve)
                      )
                    )
                    translateX(
                      var(--star-distance)
                    )
                    rotate(var(--star-spin-end))
                    scale(.05);
                  filter:
                    brightness(.8);
                }
              }

              @keyframes hooComboStarDustHead {
                0% {
                  opacity: .12;
                  transform:
                    translateX(-45%)
                    scale(.45);
                }
                20% {
                  opacity: 1;
                  transform:
                    translateX(0)
                    scale(1.18);
                }
                100% {
                  opacity: 0;
                  transform:
                    translateX(34%)
                    scale(.10);
                }
              }

              @keyframes hooComboStarCloud {
                0% {
                  opacity: 0;
                  transform:
                    translate(-50%,-50%)
                    scale(.3);
                }
                18% {
                  opacity: .66;
                }
                100% {
                  opacity: 0;
                  transform:
                    translate(-50%,-50%)
                    scale(2.1);
                }
              }

              @keyframes hooComboPrismSweep {
                0% {
                  background-position:
                    0% 50%;
                }
                100% {
                  background-position:
                    200% 50%;
                }
              }

              .hoo-combo-milestone-text {
                animation:
                  hooComboMilestoneText
                  1.24s
                  cubic-bezier(.13,.84,.20,1)
                  both;
              }

              .hoo-combo-century-text {
                animation:
                  hooComboCenturyText
                  1.68s
                  cubic-bezier(.13,.84,.20,1)
                  both;
              }

              .hoo-combo-century-prism {
                background:
                  linear-gradient(
                    90deg,
                    #67e8f9,
                    #ffffff,
                    #fde68a,
                    #f0abfc,
                    #ffffff,
                    #67e8f9
                  );
                background-size:
                  200%
                  100%;
                -webkit-background-clip:
                  text;
                background-clip:
                  text;
                color:
                  transparent;
                animation:
                  hooComboPrismSweep
                  .72s
                  linear
                  infinite;
              }

              .hoo-combo-stardust {
                transform-origin:
                  left center;
                animation:
                  hooComboStarDustFly
                  var(--star-duration)
                  cubic-bezier(.12,.70,.18,1)
                  both;
                will-change:
                  transform,
                  opacity;
              }

              @keyframes hooComboStarHeadTwinkle {
                0% {
                  filter:
                    brightness(.92);
                  transform:
                    scale(.70)
                    rotate(0deg);
                }
                30% {
                  filter:
                    brightness(1.72);
                  transform:
                    scale(1.24)
                    rotate(45deg);
                }
                68% {
                  filter:
                    brightness(1.18);
                  transform:
                    scale(.94)
                    rotate(45deg);
                }
                100% {
                  filter:
                    brightness(.86);
                  transform:
                    scale(.18)
                    rotate(90deg);
                }
              }

              .hoo-combo-stardust-head {
                clip-path:
                  polygon(
                    50% 0%,
                    61% 39%,
                    100% 50%,
                    61% 61%,
                    50% 100%,
                    39% 61%,
                    0% 50%,
                    39% 39%
                  );
                animation:
                  hooComboStarHeadTwinkle
                  calc(
                    var(--star-duration) *
                    .82
                  )
                  ease-in-out
                  both;
              }

              .hoo-combo-star-cloud {
                animation:
                  hooComboStarCloud
                  1.32s
                  ease-out
                  both;
              }

              @keyframes hooStageImpactFlash {
                0% {
                  transform:
                    translate(-50%,-50%)
                    scale(.35);
                  opacity: 0;
                }
                10% {
                  opacity: .96;
                }
                32% {
                  transform:
                    translate(-50%,-50%)
                    scale(1.08);
                  opacity: .72;
                }
                100% {
                  transform:
                    translate(-50%,-50%)
                    scale(1.7);
                  opacity: 0;
                }
              }

              @keyframes hooStageImpactBeam {
                0% {
                  transform:
                    translateX(-50%)
                    scaleY(.05);
                  opacity: 0;
                  filter: blur(10px);
                }
                12% {
                  transform:
                    translateX(-50%)
                    scaleY(1);
                  opacity: .92;
                  filter: blur(1px);
                }
                100% {
                  transform:
                    translateX(-50%)
                    scaleY(1.12);
                  opacity: 0;
                  filter: blur(8px);
                }
              }

              @keyframes hooStageImpactShock {
                0% {
                  transform:
                    translate(-50%,-50%)
                    scale(.08);
                  opacity: 1;
                }
                20% {
                  opacity: .86;
                }
                100% {
                  transform:
                    translate(-50%,-50%)
                    scale(4.6);
                  opacity: 0;
                }
              }

              @keyframes hooStageImpactSpark {
                0% {
                  transform:
                    translate(-50%,-50%)
                    rotate(var(--angle))
                    translateX(4px)
                    scale(.65);
                  opacity: 0;
                }
                12% {
                  opacity: 1;
                }
                100% {
                  transform:
                    translate(-50%,-50%)
                    rotate(var(--angle))
                    translateX(var(--distance))
                    scale(.08);
                  opacity: 0;
                }
              }

              @keyframes hooStageMissSlashA {
                0% {
                  transform:
                    translate(-50%,-50%)
                    rotate(45deg)
                    scaleX(.12);
                  opacity: 0;
                }
                16% {
                  opacity: 1;
                }
                100% {
                  transform:
                    translate(-50%,-50%)
                    rotate(45deg)
                    scaleX(1.25);
                  opacity: 0;
                }
              }

              @keyframes hooStageMissSlashB {
                0% {
                  transform:
                    translate(-50%,-50%)
                    rotate(-45deg)
                    scaleX(.12);
                  opacity: 0;
                }
                16% {
                  opacity: 1;
                }
                100% {
                  transform:
                    translate(-50%,-50%)
                    rotate(-45deg)
                    scaleX(1.25);
                  opacity: 0;
                }
              }

              @keyframes hooStageMissText {
                0% {
                  transform:
                    translateY(14px)
                    scale(.68);
                  opacity: 0;
                  letter-spacing: .34em;
                }
                16% {
                  transform:
                    translateY(-4px)
                    scale(1.14);
                  opacity: 1;
                  letter-spacing: .16em;
                }
                58% {
                  opacity: 1;
                }
                100% {
                  transform:
                    translateY(-28px)
                    scale(.95);
                  opacity: 0;
                  letter-spacing: .28em;
                }
              }

              @keyframes hooStagePerfectFlash {
                0% {
                  opacity: 0;
                }
                8% {
                  opacity: .18;
                }
                28% {
                  opacity: .08;
                }
                100% {
                  opacity: 0;
                }
              }

              @keyframes hooStageImpactCore {
                0% {
                  transform:
                    translate(-50%,-50%)
                    scale(.35);
                  opacity: 0;
                }
                12% {
                  opacity: 1;
                }
                52% {
                  transform:
                    translate(-50%,-50%)
                    scale(1.06);
                  opacity: .88;
                }
                100% {
                  transform:
                    translate(-50%,-50%)
                    scale(1.42);
                  opacity: 0;
                }
              }

              @keyframes hooStageImpactRing {
                0% {
                  transform:
                    translate(-50%,-50%)
                    scale(.25);
                  opacity: .96;
                }
                100% {
                  transform:
                    translate(-50%,-50%)
                    scale(2.35);
                  opacity: 0;
                }
              }

              @keyframes hooStageImpactRingWide {
                0% {
                  transform:
                    translate(-50%,-50%)
                    scale(.42);
                  opacity: .72;
                }
                100% {
                  transform:
                    translate(-50%,-50%)
                    scale(3.2);
                  opacity: 0;
                }
              }

              @keyframes hooStageImpactRay {
                0% {
                  transform:
                    translate(-50%,-50%)
                    rotate(var(--angle))
                    scaleX(.08);
                  opacity: 0;
                }
                18% {
                  opacity: .95;
                }
                100% {
                  transform:
                    translate(-50%,-50%)
                    rotate(var(--angle))
                    scaleX(1);
                  opacity: 0;
                }
              }

              @keyframes hooStageChromatic {
                0% {
                  opacity: .0;
                  transform:
                    translate3d(0,0,0);
                }
                14% {
                  opacity: .65;
                  transform:
                    translate3d(-2px,0,0);
                }
                32% {
                  opacity: .34;
                  transform:
                    translate3d(2px,0,0);
                }
                100% {
                  opacity: 0;
                  transform:
                    translate3d(0,0,0);
                }
              }

              @keyframes hooStageJudgment {
                0% {
                  transform:
                    translateY(10px)
                    scale(.78);
                  opacity: 0;
                  letter-spacing: .30em;
                }
                20% {
                  transform:
                    translateY(-2px)
                    scale(1.11);
                  opacity: 1;
                  letter-spacing: .18em;
                }
                72% {
                  opacity: .96;
                }
                100% {
                  transform:
                    translateY(-18px)
                    scale(.98);
                  opacity: 0;
                  letter-spacing: .24em;
                }
              }

              @keyframes hooStageDelta {
                0% {
                  transform:
                    translateY(6px);
                  opacity: 0;
                }
                24% {
                  opacity: .72;
                }
                100% {
                  transform:
                    translateY(-9px);
                  opacity: 0;
                }
              }

              @keyframes hooStageComboPop {
                0% {
                  transform:
                    scale(.82);
                  opacity: .28;
                }
                36% {
                  transform:
                    scale(1.08);
                  opacity: 1;
                }
                100% {
                  transform:
                    scale(1);
                  opacity: .92;
                }
              }

              @keyframes hooStageMilestone {
                0% {
                  transform:
                    translate(-50%,-50%)
                    scale(.68);
                  opacity: 0;
                }
                18% {
                  transform:
                    translate(-50%,-50%)
                    scale(1.08);
                  opacity: .94;
                }
                72% {
                  opacity: .62;
                }
                100% {
                  transform:
                    translate(-50%,-50%)
                    scale(1.16);
                  opacity: 0;
                }
              }

              @keyframes hooStageVignetteHit {
                0% {
                  opacity: 0;
                }
                20% {
                  opacity: .42;
                }
                100% {
                  opacity: 0;
                }
              }

              @keyframes hooStageVignetteMiss {
                0% {
                  opacity: 0;
                }
                20% {
                  opacity: .62;
                }
                100% {
                  opacity: 0;
                }
              }

              @keyframes hooStageShakeSoft {
                0% {
                  transform:
                    translate3d(
                      0,
                      0,
                      0
                    );
                }
                18% {
                  transform:
                    translate3d(
                      -1px,
                      1px,
                      0
                    );
                }
                35% {
                  transform:
                    translate3d(
                      1.4px,
                      -.7px,
                      0
                    );
                }
                55% {
                  transform:
                    translate3d(
                      -.8px,
                      .45px,
                      0
                    );
                }
                100% {
                  transform:
                    translate3d(
                      0,
                      0,
                      0
                    );
                }
              }

              @keyframes hooStageShakeStrong {
                0% {
                  transform:
                    translate3d(
                      0,
                      0,
                      0
                    );
                }
                16% {
                  transform:
                    translate3d(
                      -2px,
                      1px,
                      0
                    );
                }
                31% {
                  transform:
                    translate3d(
                      2.5px,
                      -1px,
                      0
                    );
                }
                48% {
                  transform:
                    translate3d(
                      -1.6px,
                      .7px,
                      0
                    );
                }
                67% {
                  transform:
                    translate3d(
                      1px,
                      -.4px,
                      0
                    );
                }
                100% {
                  transform:
                    translate3d(
                      0,
                      0,
                      0
                    );
                }
              }

              @keyframes hooStageNoteGlowA {
                0%,
                100% {
                  box-shadow:
                    0 0 12px
                    rgba(34,211,238,.22);
                }
                50% {
                  box-shadow:
                    0 0 22px
                    rgba(34,211,238,.42);
                }
              }

              @keyframes hooStageNoteGlowK {
                0%,
                100% {
                  box-shadow:
                    0 0 12px
                    rgba(217,70,239,.22);
                }
                50% {
                  box-shadow:
                    0 0 22px
                    rgba(217,70,239,.42);
                }
              }

              @keyframes hooStageHoldShimmer {
                0% {
                  background-position:
                    0 0;
                }
                100% {
                  background-position:
                    0 80px;
                }
              }

              @keyframes hooStageScorePulse {
                0% {
                  transform:
                    scale(1);
                }
                42% {
                  transform:
                    scale(1.035);
                }
                100% {
                  transform:
                    scale(1);
                }
              }

              @keyframes hooStageAccuracyPulse {
                0%,
                100% {
                  opacity: .48;
                }
                50% {
                  opacity: .74;
                }
              }

              @keyframes hooStagePauseBreath {
                0%,
                100% {
                  opacity: .42;
                  transform:
                    scale(.98);
                }
                50% {
                  opacity: .72;
                  transform:
                    scale(1.02);
                }
              }

              @keyframes hooStageScan {
                0% {
                  transform:
                    translateY(-120%);
                  opacity: 0;
                }
                12% {
                  opacity: .16;
                }
                100% {
                  transform:
                    translateY(620%);
                  opacity: 0;
                }
              }

              @keyframes hooStageSpectrum {
                0%,
                100% {
                  transform:
                    scaleY(.38);
                  opacity: .22;
                }
                50% {
                  transform:
                    scaleY(1);
                  opacity: .52;
                }
              }

              .hoo-stage-star {
                animation:
                  hooStageStarFloat
                  var(--dur)
                  ease-in-out
                  infinite
                  alternate;
              }

              .hoo-stage-dust {
                animation:
                  hooStageDustFloat
                  var(--dur)
                  ease-in-out
                  infinite
                  alternate;
              }

              .hoo-stage-aurora-a {
                animation:
                  hooStageAuroraA
                  12s
                  ease-in-out
                  infinite;
              }

              .hoo-stage-aurora-b {
                animation:
                  hooStageAuroraB
                  16s
                  ease-in-out
                  infinite;
              }

              .hoo-stage-horizon {
                animation:
                  hooStageHorizon
                  3.4s
                  ease-in-out
                  infinite;
              }

              .hoo-stage-lane-breath {
                animation:
                  hooStageLaneBreath
                  4.6s
                  ease-in-out
                  infinite;
              }

              .hoo-stage-lane-current {
                animation:
                  hooStageLaneCurrent
                  2.7s
                  linear
                  infinite;
              }

              .hoo-stage-hit-line {
                animation:
                  hooStageHitLine
                  2.5s
                  ease-in-out
                  infinite;
              }

              .hoo-stage-key-pulse {
                animation:
                  hooStageKeyPulse
                  .38s
                  ease-out
                  both;
              }

              .hoo-stage-impact-flash {
                animation:
                  hooStageImpactFlash
                  .42s
                  cubic-bezier(.12,.82,.20,1)
                  both;
              }

              .hoo-stage-impact-beam {
                transform-origin:
                  center bottom;
                animation:
                  hooStageImpactBeam
                  .44s
                  cubic-bezier(.12,.82,.20,1)
                  both;
              }

              .hoo-stage-impact-shock {
                animation:
                  hooStageImpactShock
                  .54s
                  ease-out
                  both;
              }

              .hoo-stage-impact-spark {
                animation:
                  hooStageImpactSpark
                  .50s
                  cubic-bezier(.14,.76,.22,1)
                  both;
              }

              .hoo-stage-miss-slash-a {
                animation:
                  hooStageMissSlashA
                  .52s
                  ease-out
                  both;
              }

              .hoo-stage-miss-slash-b {
                animation:
                  hooStageMissSlashB
                  .52s
                  ease-out
                  both;
              }

              .hoo-stage-miss-text {
                animation:
                  hooStageMissText
                  .74s
                  cubic-bezier(.17,.84,.22,1)
                  both;
              }

              .hoo-stage-perfect-flash {
                animation:
                  hooStagePerfectFlash
                  .44s
                  ease-out
                  both;
              }

              .hoo-stage-impact-core {
                animation:
                  hooStageImpactCore
                  .46s
                  cubic-bezier(.17,.84,.22,1)
                  both;
              }

              .hoo-stage-impact-ring {
                animation:
                  hooStageImpactRing
                  .5s
                  ease-out
                  both;
              }

              .hoo-stage-impact-ring-wide {
                animation:
                  hooStageImpactRingWide
                  .58s
                  ease-out
                  both;
              }

              .hoo-stage-impact-ray {
                transform-origin:
                  0 50%;
                animation:
                  hooStageImpactRay
                  .46s
                  cubic-bezier(.17,.84,.22,1)
                  both;
              }

              .hoo-stage-chromatic {
                animation:
                  hooStageChromatic
                  .34s
                  ease-out
                  both;
              }

              .hoo-stage-judgment {
                animation:
                  hooStageJudgment
                  .56s
                  cubic-bezier(.17,.84,.22,1)
                  both;
              }

              .hoo-stage-delta {
                animation:
                  hooStageDelta
                  .52s
                  ease-out
                  both;
              }

              .hoo-stage-combo-pop {
                animation:
                  hooStageComboPop
                  .25s
                  ease-out
                  both;
              }

              .hoo-stage-milestone {
                animation:
                  hooStageMilestone
                  .8s
                  ease-out
                  both;
              }

              .hoo-stage-vignette-hit {
                animation:
                  hooStageVignetteHit
                  .42s
                  ease-out
                  both;
              }

              .hoo-stage-vignette-miss {
                animation:
                  hooStageVignetteMiss
                  .58s
                  ease-out
                  both;
              }

              .hoo-stage-shake-soft {
                animation:
                  hooStageShakeSoft
                  .22s
                  linear
                  both;
              }

              .hoo-stage-shake-strong {
                animation:
                  hooStageShakeStrong
                  .30s
                  linear
                  both;
              }

              .hoo-stage-note-a {
                animation:
                  hooStageNoteGlowA
                  1.8s
                  ease-in-out
                  infinite;
              }

              .hoo-stage-note-k {
                animation:
                  hooStageNoteGlowK
                  1.8s
                  ease-in-out
                  infinite;
              }

              .hoo-stage-hold {
                background-size:
                  100% 34px;
                animation:
                  hooStageHoldShimmer
                  .9s
                  linear
                  infinite;
              }

              .hoo-stage-score {
                animation:
                  hooStageScorePulse
                  .42s
                  ease-out;
              }

              .hoo-stage-accuracy {
                animation:
                  hooStageAccuracyPulse
                  3.4s
                  ease-in-out
                  infinite;
              }

              .hoo-stage-pause-title {
                animation:
                  hooStagePauseBreath
                  2.2s
                  ease-in-out
                  infinite;
              }

              .hoo-stage-scan {
                animation:
                  hooStageScan
                  7s
                  linear
                  infinite;
              }

              .hoo-stage-spectrum {
                animation:
                  hooStageSpectrum
                  var(--spec-dur)
                  ease-in-out
                  infinite
                  alternate;
              }

              @keyframes hooFocusPadIdle {
                0%,
                100% {
                  filter:
                    brightness(.94);
                }
                50% {
                  filter:
                    brightness(1.06);
                }
              }

              @media (
                prefers-reduced-motion:
                reduce
              ) {
                .hoo-stage-star,
                .hoo-stage-dust,
                .hoo-stage-aurora-a,
                .hoo-stage-aurora-b,
                .hoo-stage-horizon,
                .hoo-stage-lane-breath,
                .hoo-stage-lane-current,
                .hoo-stage-hit-line,
                .hoo-stage-key-pulse,
                .hoo-trail-tier-enter,
                .hoo-trail-afterimage-outer,
                .hoo-trail-afterimage-main,
                .hoo-trail-afterimage-sweep,
                .hoo-trail-floor-neon,
                .hoo-trail-floor-flow,
                .hoo-combo30-floor-surge,
                .hoo-combo30-floor-wave,
                .hoo-floor-input-flash,
                .hoo-floor-travel-sweep,
                .hoo-note-direct-glow-a,
                .hoo-note-direct-glow-k,
                .hoo-combo-milestone-text,
                .hoo-combo-century-text,
                .hoo-combo-century-prism,
                .hoo-combo-stardust,
                .hoo-combo-stardust-head,
                .hoo-combo-star-cloud,
                .hoo-trail-spark,
                .hoo-trail-note-neon,
                .hoo-combo30-flash,
                .hoo-combo30-text,
                .hoo-combo30-ring,
                .hoo-combo30-ray,
                .hoo-stage-impact-flash,
                .hoo-stage-impact-beam,
                .hoo-stage-impact-shock,
                .hoo-stage-impact-spark,
                .hoo-stage-miss-slash-a,
                .hoo-stage-miss-slash-b,
                .hoo-stage-miss-text,
                .hoo-stage-perfect-flash,
                .hoo-stage-impact-core,
                .hoo-stage-impact-ring,
                .hoo-stage-impact-ring-wide,
                .hoo-stage-impact-ray,
                .hoo-stage-chromatic,
                .hoo-stage-judgment,
                .hoo-stage-delta,
                .hoo-stage-combo-pop,
                .hoo-stage-milestone,
                .hoo-stage-vignette-hit,
                .hoo-stage-vignette-miss,
                .hoo-stage-shake-soft,
                .hoo-stage-shake-strong,
                .hoo-stage-note-a,
                .hoo-stage-note-k,
                .hoo-stage-hold,
                .hoo-stage-score,
                .hoo-stage-accuracy,
                .hoo-stage-pause-title,
                .hoo-stage-scan,
                .hoo-stage-spectrum {
                  animation:
                    none
                    !important;
                }
              }

            `}</style>

            {/* =====================================================
                PLAY BACKGROUND MEDIA
                - Cover image by default
                - MP4 video frame when the published source is .mp4
                - Soft blur + four-edge black vignette
            ====================================================== */}
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-black">
              {playBackgroundIsMp4 &&
              playBackgroundMediaUrl ? (
                <video
                  ref={playBackgroundVideoRef}
                  src={playBackgroundMediaUrl}
                  poster={
                    currentCover?.dataUrl ||
                    undefined
                  }
                  muted
                  playsInline
                  preload="metadata"
                  disablePictureInPicture
                  controls={false}
                  className="absolute inset-[-3%] h-[106%] w-[106%] object-cover opacity-[0.58] blur-[5px] saturate-[0.88] brightness-[0.74] contrast-[1.04]"
                  onLoadedMetadata={(event) => {
                    const audio =
                      audioRef.current;

                    if (
                      audio &&
                      Number.isFinite(
                        audio.currentTime,
                      )
                    ) {
                      try {
                        event.currentTarget.currentTime =
                          audio.currentTime;
                      } catch {
                        // Safe fallback: poster/first frame remains visible.
                      }
                    }

                    if (
                      audio &&
                      !audio.paused
                    ) {
                      void event.currentTarget
                        .play()
                        .catch(
                          () => undefined,
                        );
                    }
                  }}
                />
              ) : currentCover ? (
                <img
                  src={currentCover.dataUrl}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="absolute inset-[-3%] h-[106%] w-[106%] object-cover opacity-[0.40] blur-[7px] saturate-[0.78] brightness-[0.58]"
                />
              ) : null}

              {/* Keep the middle visible, fade every edge into pure black. */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,.08) 0%, rgba(0,0,0,.14) 34%, rgba(0,0,0,.44) 66%, rgba(0,0,0,.88) 88%, #000 100%)",
                }}
              />

              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.88)_0%,rgba(0,0,0,.18)_20%,rgba(0,0,0,.08)_50%,rgba(0,0,0,.24)_78%,rgba(0,0,0,.92)_100%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.92)_0%,rgba(0,0,0,.24)_17%,rgba(0,0,0,.04)_50%,rgba(0,0,0,.24)_83%,rgba(0,0,0,.92)_100%)]" />

              {/* Final gameplay contrast veil. */}
              <div className="absolute inset-0 bg-black/14" />
            </div>

            {/* Very subtle center separation for note readability. */}
            <div className="pointer-events-none absolute left-1/2 top-[-18%] z-[1] h-[660px] w-[820px] -translate-x-1/2 rounded-full bg-violet-500/[0.025] blur-[150px]" />

            {/* =====================================================
                TOP PROGRESS
            ====================================================== */}
            <div className="pointer-events-none absolute left-1/2 top-5 z-50 w-[34%] min-w-[360px] max-w-[650px] -translate-x-1/2">
              <div className="flex items-center gap-3">
                <span className="w-11 text-right font-mono text-[11px] font-black text-white/48">
                  {formatTime(currentTime)}
                </span>

                <div className="relative h-[7px] flex-1 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.055]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 shadow-[0_0_20px_rgba(56,189,248,.38)]"
                    style={{
                      width: `${playProgressPercent}%`,
                    }}
                  />
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white shadow-[0_0_18px_rgba(255,255,255,.82)]"
                    style={{
                      left: `${playProgressPercent}%`,
                    }}
                  />
                </div>

                <span className="w-11 font-mono text-[11px] font-black text-white/48">
                  {formatTime(effectiveDuration)}
                </span>
              </div>
            </div>

            {/* =====================================================
                SONG INFO · TOP LEFT
                요청 구조: 사진 → 제목 → 현재 난이도
            ====================================================== */}
            <aside className="absolute left-5 top-5 z-50 w-[330px] sm:left-7 sm:top-6 sm:w-[370px] xl:left-9 xl:top-7 xl:w-[410px]">
              <div className="w-[180px] sm:w-[200px] xl:w-[220px]">
                <div className="relative aspect-square overflow-hidden rounded-[28px] border border-white/[0.14] bg-[#050811] shadow-[0_0_44px_rgba(34,211,238,.10),0_20px_60px_rgba(0,0,0,.42)]">
                  {currentCover ? (
                    <img
                      src={currentCover.dataUrl}
                      alt={`${song.title} cover`}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_42%,rgba(99,102,241,.26),transparent_30%),linear-gradient(145deg,#03050c,#091020)]">
                      <span className="text-4xl text-cyan-100/72">✦</span>
                      <span className="absolute inset-x-[18%] bottom-[22%] h-px bg-gradient-to-r from-transparent via-violet-100/34 to-transparent" />
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/18 to-transparent" />
                </div>

                <h2 className="mt-5 min-w-[310px] truncate text-[30px] font-black tracking-[-0.035em] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,.78)] sm:min-w-[345px] sm:text-[34px] xl:min-w-[390px] xl:text-[38px]">
                  {song.title}
                </h2>

                <div
                  className={`mt-3 inline-flex rounded-full border px-5 py-2 text-[15px] font-black tracking-[0.10em] shadow-[0_8px_24px_rgba(0,0,0,.24)] ${
                    difficulty === "easy"
                      ? "border-cyan-200/30 bg-cyan-300/[0.08] text-cyan-100"
                      : difficulty === "normal"
                        ? "border-blue-200/28 bg-blue-300/[0.08] text-blue-100"
                        : "border-fuchsia-200/28 bg-fuchsia-300/[0.08] text-fuchsia-100"
                  }`}
                >
                  {difficulty.toUpperCase()}
                </div>
              </div>
            </aside>

            {/* =====================================================
                LEFT HUD · COMBO
            ====================================================== */}
            <aside className="pointer-events-none absolute left-5 top-[55%] z-40 hidden w-[276px] -translate-y-1/2 lg:block xl:left-7 xl:w-[305px]">
              <div
                className="overflow-hidden rounded-[18px] border border-cyan-100/[0.16] bg-black/72 shadow-[0_0_30px_rgba(34,211,238,.055)]"
              >
                <div className="px-6 py-5">
                  <p className="text-[16px] font-black tracking-[0.14em] text-white/58">
                    COMBO
                  </p>
                  <p className="mt-1 text-[61px] font-black leading-none tracking-[-0.055em] text-cyan-50 drop-shadow-[0_0_16px_rgba(34,211,238,.54)]">
                    {combo}
                  </p>
                </div>

                <div className="border-t border-white/[0.08] px-6 py-4.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-black tracking-[0.10em] text-white/46">
                        MAX COMBO
                      </p>
                      <p className="mt-1 text-[38px] font-black leading-none text-white/86">
                        {maxCombo}
                      </p>
                    </div>
                    <span className="text-[29px] text-amber-200/80">♛</span>
                  </div>
                </div>
              </div>
            </aside>

            {/* =====================================================
                RIGHT HUD · SCORE / ACCURACY / JUDGMENT
            ====================================================== */}
            <aside className="pointer-events-none absolute right-5 top-[24%] z-40 hidden w-[305px] -translate-y-1/4 lg:block xl:right-7 xl:w-[334px]">
              <div
                className="rounded-[24px] border border-cyan-100/[0.16] bg-black/76 px-6 py-5 text-right shadow-[0_0_30px_rgba(59,130,246,.055)]"
              >
                <p className="text-left text-[16px] font-black tracking-[0.12em] text-white/58">
                  SCORE
                </p>
                <p className="mt-1 text-[49px] font-black leading-none tracking-[-0.045em] text-white drop-shadow-[0_0_14px_rgba(96,165,250,.34)]">
                  {score.toLocaleString()}
                </p>
              </div>

              <div className="mt-4 rounded-[24px] border border-violet-100/[0.16] bg-black/76 px-6 py-5">
                <p className="text-[16px] font-black tracking-[0.12em] text-white/58">
                  ACCURACY
                </p>

                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-[42px] font-black tracking-[-0.04em] text-white">
                    {playAccuracy.toFixed(1)}%
                  </p>

                  <div className="flex h-[70px] w-[70px] items-center justify-center rounded-full border border-violet-200/34 bg-violet-300/[0.06] text-[35px] font-black text-violet-50 shadow-[0_0_22px_rgba(168,85,247,.20)]">
                    {playRank}
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[24px] border border-blue-100/[0.15] bg-black/78">
                <div className="grid grid-cols-[1fr_auto] items-center border-b border-white/[0.08] px-6 py-4">
                  <span className="text-[19px] font-black text-cyan-300">
                    PERFECT
                  </span>
                  <span className="text-[26px] font-black text-white/88">
                    {stats.perfect}
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto] items-center border-b border-white/[0.08] px-6 py-4">
                  <span className="text-[19px] font-black text-emerald-300">
                    GREAT
                  </span>
                  <span className="text-[26px] font-black text-white/88">
                    {stats.great}
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto] items-center border-b border-white/[0.08] px-6 py-4">
                  <span className="text-[19px] font-black text-amber-300">
                    GOOD
                  </span>
                  <span className="text-[26px] font-black text-white/88">
                    {stats.good}
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto] items-center px-6 py-4">
                  <span className="text-[19px] font-black text-rose-400">
                    MISS
                  </span>
                  <span className="text-[26px] font-black text-white/88">
                    {stats.miss}
                  </span>
                </div>
              </div>
            </aside>

            {/* =====================================================
                CENTRAL PLAY FIELD
            ====================================================== */}
            <div className="absolute inset-0 z-20 flex items-stretch justify-center px-2 pb-2 pt-[62px] sm:px-3 sm:pb-3 lg:px-[215px] xl:px-[245px]">
              <section
                className={`relative h-full min-h-[675px] w-full max-w-[1066px] overflow-hidden bg-transparent [contain:layout_paint_style] ${
                  playImpactFx?.judgment === "PERFECT"
                    ? "hoo-stage-shake-soft"
                    : playImpactFx?.judgment === "MISS"
                      ? "hoo-stage-shake-strong"
                      : ""
                }`}
              >
                {/* 레인 외부는 완전히 검은색 */}
                <div className="pointer-events-none absolute inset-0 bg-black/26" />

                {/* 레인 후광 */}
                <div className="pointer-events-none absolute bottom-[12%] left-[29.75%] top-[4%] w-[35%] -translate-x-1/2 bg-gradient-to-t from-cyan-400/[0.095] via-cyan-400/[0.026] to-transparent blur-[18px]" />
                <div className="pointer-events-none absolute bottom-[12%] left-[70.25%] top-[4%] w-[35%] -translate-x-1/2 bg-gradient-to-t from-fuchsia-400/[0.095] via-fuchsia-400/[0.026] to-transparent blur-[18px]" />

                {/* 원근 플레이 보드 */}
                <div
                  className="pointer-events-none absolute bottom-[12%] left-1/2 top-[2%] w-[88%] -translate-x-1/2 overflow-hidden"
                  style={{
                    clipPath:
                      "polygon(39% 0,61% 0,96% 100%,4% 100%)",
                  }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,10,19,.95)_0%,rgba(4,13,27,.88)_49.7%,rgba(20,4,24,.88)_50.3%,rgba(18,2,23,.95)_100%)] shadow-[0_0_70px_rgba(0,0,0,.48)]" />

                  {/* 30 COMBO부터 노트가 내려오는 바닥 자체가 계속 켜져 있다.
                      기본 광원은 절대 꺼졌다 켜지지 않고,
                      입력 / 마일스톤 때만 위에 추가 플래시가 겹친다. */}
                  {playFloorLevel > 0 && (
                    <>
                      <div
                        className="absolute inset-0 transition-opacity duration-500"
                        style={{
                          opacity:
                            playFloorOpacity,
                          background:
                            playFloorLevel >= 3
                              ? "linear-gradient(90deg,rgba(34,211,238,.58) 0%,rgba(34,211,238,.19) 43%,rgba(255,255,255,.07) 49.7%,rgba(217,70,239,.19) 50.3%,rgba(217,70,239,.58) 100%)"
                              : "linear-gradient(90deg,rgba(34,211,238,.44) 0%,rgba(34,211,238,.12) 43%,rgba(255,255,255,.035) 49.7%,rgba(217,70,239,.12) 50.3%,rgba(217,70,239,.44) 100%)",
                          boxShadow:
                            playFloorLevel >= 3
                              ? "inset 0 0 70px rgba(34,211,238,.20), inset 0 0 70px rgba(217,70,239,.19)"
                              : "inset 0 0 44px rgba(34,211,238,.12), inset 0 0 44px rgba(217,70,239,.11)",
                        }}
                      />

                      {/* 바닥의 광량은 유지하고, 아주 얇은 빛만 계속 앞으로 흐른다. */}
                      <div
                        className="hoo-floor-travel-sweep absolute inset-x-[4%] top-0 h-[28%] bg-gradient-to-b from-transparent via-white/[0.055] to-transparent blur-[1px]"
                        style={{
                          animationDuration:
                            playFloorLevel >= 3
                              ? "1.55s"
                              : "2.1s",
                        }}
                      />
                    </>
                  )}

                  {/* 사용자가 A/K를 입력하면 해당 레인 바닥 전체가 타격과 함께 반짝인다. */}
                  {playFloorLevel > 0 &&
                    (
                      pressed.has("A") ||
                      playImpactFx?.lane === "A"
                    ) && (
                    <div
                      key={`floor-input-a-${playImpactFx?.lane === "A" ? playImpactFx.id : "pressed"}`}
                      className="hoo-floor-input-flash absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(90deg,rgba(103,232,249,.28),rgba(34,211,238,.15)_56%,transparent)] shadow-[inset_0_0_64px_rgba(34,211,238,.22)]"
                    />
                  )}

                  {playFloorLevel > 0 &&
                    (
                      pressed.has("K") ||
                      playImpactFx?.lane === "K"
                    ) && (
                    <div
                      key={`floor-input-k-${playImpactFx?.lane === "K" ? playImpactFx.id : "pressed"}`}
                      className="hoo-floor-input-flash absolute inset-y-0 right-0 w-1/2 bg-[linear-gradient(270deg,rgba(240,171,252,.27),rgba(217,70,239,.15)_56%,transparent)] shadow-[inset_0_0_64px_rgba(217,70,239,.21)]"
                    />
                  )}

                  {/* 콤보 마일스톤 순간 판 전체가 한 번 강하게 켜진다. */}
                  {playComboMilestone && (
                    <>
                      <div
                        key={`floor-surge-${playComboMilestone.serial}`}
                        className={`hoo-combo30-floor-surge absolute inset-0 ${
                          playComboMilestone.tier === "century"
                            ? "bg-[linear-gradient(90deg,rgba(34,211,238,.48)_0%,rgba(255,255,255,.20)_30%,rgba(250,204,21,.13)_50%,rgba(255,255,255,.20)_70%,rgba(217,70,239,.48)_100%)] shadow-[inset_0_0_120px_rgba(34,211,238,.30),inset_0_0_120px_rgba(217,70,239,.30)]"
                            : "bg-[linear-gradient(90deg,rgba(34,211,238,.34)_0%,rgba(56,189,248,.13)_42%,rgba(255,255,255,.11)_50%,rgba(192,132,252,.14)_58%,rgba(217,70,239,.34)_100%)] shadow-[inset_0_0_90px_rgba(34,211,238,.23),inset_0_0_90px_rgba(217,70,239,.22)]"
                        }`}
                      />

                      <div
                        key={`floor-wave-${playComboMilestone.serial}`}
                        className="hoo-combo30-floor-wave absolute inset-x-[4%] bottom-0 h-[28%] bg-gradient-to-t from-white/[0.20] via-violet-200/[0.10] to-transparent blur-[3px]"
                      />
                    </>
                  )}

                  {/* 길 양 사이드 원근 하얀 빛줄기.
                      움직이지 않는다.
                      콤보가 쌓일수록 선 자체와 halo가 점점 강해진다. */}
                  <svg
                    className="pointer-events-none absolute inset-0 z-[9] h-full w-full overflow-visible"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient
                        id="hooRoadEdgeStaticWhite"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="white"
                          stopOpacity=".18"
                        />
                        <stop
                          offset="42%"
                          stopColor="white"
                          stopOpacity=".56"
                        />
                        <stop
                          offset="100%"
                          stopColor="white"
                          stopOpacity="1"
                        />
                      </linearGradient>

                      <linearGradient
                        id="hooRoadEdgeStaticHalo"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="white"
                          stopOpacity="0"
                        />
                        <stop
                          offset="44%"
                          stopColor="white"
                          stopOpacity=".20"
                        />
                        <stop
                          offset="100%"
                          stopColor="white"
                          stopOpacity=".72"
                        />
                      </linearGradient>
                    </defs>

                    {/* left halo */}
                    <line
                      x1="39"
                      y1="0"
                      x2="4"
                      y2="100"
                      stroke="url(#hooRoadEdgeStaticHalo)"
                      strokeWidth={playRoadEdgeWidth * 4.4}
                      vectorEffect="non-scaling-stroke"
                      style={{
                        opacity:
                          playRoadEdgeHaloOpacity,
                        filter:
                          `blur(${0.8 + playRoadEdgeIntensity * 5.2}px)`,
                      }}
                    />

                    {/* right halo */}
                    <line
                      x1="61"
                      y1="0"
                      x2="96"
                      y2="100"
                      stroke="url(#hooRoadEdgeStaticHalo)"
                      strokeWidth={playRoadEdgeWidth * 4.4}
                      vectorEffect="non-scaling-stroke"
                      style={{
                        opacity:
                          playRoadEdgeHaloOpacity,
                        filter:
                          `blur(${0.8 + playRoadEdgeIntensity * 5.2}px)`,
                      }}
                    />

                    {/* left core */}
                    <line
                      x1="39"
                      y1="0"
                      x2="4"
                      y2="100"
                      stroke="url(#hooRoadEdgeStaticWhite)"
                      strokeWidth={playRoadEdgeWidth}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      style={{
                        opacity:
                          playRoadEdgeCoreOpacity,
                        filter:
                          `drop-shadow(0 0 ${playRoadEdgeGlow}px rgba(255,255,255,${0.08 + playRoadEdgeIntensity * 0.78}))`,
                      }}
                    />

                    {/* right core */}
                    <line
                      x1="61"
                      y1="0"
                      x2="96"
                      y2="100"
                      stroke="url(#hooRoadEdgeStaticWhite)"
                      strokeWidth={playRoadEdgeWidth}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      style={{
                        opacity:
                          playRoadEdgeCoreOpacity,
                        filter:
                          `drop-shadow(0 0 ${playRoadEdgeGlow}px rgba(255,255,255,${0.08 + playRoadEdgeIntensity * 0.78}))`,
                      }}
                    />
                  </svg>

                  {/* 아주 얇은 깊이 그리드 */}
                  {[8, 17, 28, 40, 53, 67, 81, 93].map((y, index) => (
                    <div
                      key={`focus-depth-${y}`}
                      className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/[0.045] to-transparent"
                      style={{
                        top: `${y}%`,
                        opacity:
                          0.28 + index * 0.035,
                      }}
                    />
                  ))}

                  {/* 중앙 분리선 */}
                  <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-violet-100/[0.04] via-white/[0.13] to-white/[0.28]" />

                  {/* 레인 라인 */}
                  <div className="absolute inset-y-0 left-[7%] w-px bg-gradient-to-b from-cyan-100/[0.05] via-cyan-200/[0.16] to-cyan-100/60" />
                  <div className="absolute inset-y-0 left-[49.5%] w-px bg-gradient-to-b from-cyan-100/[0.03] via-cyan-200/[0.10] to-cyan-100/30" />
                  <div className="absolute inset-y-0 right-[49.5%] w-px bg-gradient-to-b from-fuchsia-100/[0.03] via-fuchsia-200/[0.10] to-fuchsia-100/30" />
                  <div className="absolute inset-y-0 right-[7%] w-px bg-gradient-to-b from-fuchsia-100/[0.05] via-fuchsia-200/[0.16] to-fuchsia-100/60" />
                </div>

                {/* =================================================
                    FALLING NOTES · COMBO EVOLUTION TRAIL
                    0~9   : plain block only
                    10~19 : soft short ribbon
                    20~30 : long ribbon + particles
                    31+   : full neon ribbon + luminous block
                ================================================== */}
                <div className="absolute inset-0 z-20">
                  {/* 고성능 BLOCK PERSISTENCE 잔상 레이어.
                      잔상의 기본 도형은 항상 실제 노트 블록의 rounded-rectangle silhouette다.
                      선 / 레이저 / ribbon stroke는 사용하지 않는다.
                      모든 visible note 잔상을 단 하나의 Canvas에서 합성한다. */}
                  <canvas
                    ref={playTrailCanvasRef}
                    className="pointer-events-none absolute inset-0 z-[17] h-full w-full"
                    aria-hidden="true"
                  />

                  {/* 실제 노트 */}
                  {visibleNotes.map((note) => {
                    if (
                      hitNotes.has(note.id) ||
                      missedNotes.has(note.id)
                    ) {
                      return null;
                    }

                    const leadTime =
                      2.55;

                    const remaining =
                      note.time -
                      currentTime;

                    const rawTravel =
                      clamp(
                        1 -
                          remaining /
                            leadTime,
                        0,
                        1,
                      );

                    const layout =
                      getPlayPerspectiveLayout(
                        note.lane,
                        rawTravel,
                      );

                    const holdDuration =
                      Math.max(
                        0,
                        Number(
                          note.duration,
                        ) || 0,
                      );

                    const holdPixels =
                      clamp(
                        (
                          holdDuration /
                          leadTime
                        ) *
                          560 *
                          (
                            0.62 +
                            layout.depth *
                              0.38
                          ),
                        0,
                        455,
                      );

                    const nearHit =
                      Math.abs(
                        remaining,
                      ) <
                      JUDGMENT_WINDOWS.GOOD *
                        1.75;

                    const noteGlow =
                      playTrailConfig.noteGlow;

                    return (
                      <div
                        key={note.id}
                        className="pointer-events-none absolute z-20"
                        style={{
                          left: `${layout.x}%`,
                          top: `${layout.y}%`,
                          width: `${layout.widthPercent}%`,
                          transform:
                            "translate3d(-50%,-50%,0)",
                          opacity:
                            remaining <
                            -0.2
                              ? 0
                              : layout.opacity,
                        }}
                      >
                        {holdDuration >
                          0.04 && (
                          <div
                            className={`hoo-stage-hold absolute bottom-1/2 left-1/2 -translate-x-1/2 rounded-full border ${
                              note.lane ===
                              "A"
                                ? "border-cyan-100/24 bg-[linear-gradient(180deg,rgba(165,243,252,.24),rgba(34,211,238,.05),rgba(34,211,238,.20))]"
                                : "border-fuchsia-100/24 bg-[linear-gradient(180deg,rgba(245,208,254,.24),rgba(217,70,239,.05),rgba(217,70,239,.20))]"
                            }`}
                            style={{
                              width: `${Math.max(
                                12,
                                15 +
                                  layout.depth *
                                    10,
                              )}px`,
                              height: `${holdPixels}px`,
                              transformOrigin:
                                "bottom center",
                              transform:
                                `translateX(-50%) rotate(${
                                  note.lane ===
                                  "A"
                                    ? 3.5 -
                                      layout.depth *
                                        2
                                    : -3.5 +
                                      layout.depth *
                                        2
                                }deg)`,
                            }}
                          />
                        )}

                        {/* 31 COMBO부터 빛은 블록 자체의 border / surface / shadow에서 직접 나온다.
                            블록 뒤에 별도의 원형 glow 오브젝트를 만들지 않는다. */}
                        <div
                          className={`relative flex w-full items-center justify-center overflow-hidden rounded-[9px] border font-black tracking-[0.12em] text-white ${
                            note.lane ===
                            "A"
                              ? `${
                                  noteGlow
                                    ? "hoo-note-direct-glow-a"
                                    : ""
                                } border-cyan-100/62 bg-[linear-gradient(180deg,rgba(207,250,254,.34),rgba(8,145,178,.44))] ${
                                  nearHit
                                    ? "ring-2 ring-cyan-100/48"
                                    : ""
                                }`
                              : `${
                                  noteGlow
                                    ? "hoo-note-direct-glow-k"
                                    : ""
                                } border-fuchsia-100/62 bg-[linear-gradient(180deg,rgba(250,232,255,.32),rgba(162,28,175,.42))] ${
                                  nearHit
                                    ? "ring-2 ring-fuchsia-100/46"
                                    : ""
                                }`
                          }`}
                          style={{
                            height: `${layout.heightPx}px`,
                            fontSize: `${Math.max(
                              8,
                              8 +
                                layout.depth *
                                  5,
                            )}px`,
                            boxShadow:
                              noteGlow
                                ? undefined
                                : nearHit
                                  ? note.lane === "A"
                                    ? "0 0 15px rgba(34,211,238,.22)"
                                    : "0 0 15px rgba(217,70,239,.21)"
                                  : "none",
                          }}
                        >
                          <span className="absolute inset-x-[12%] top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />
                          <span className="absolute inset-x-[18%] bottom-0 h-px bg-white/13" />
                          <span className="relative drop-shadow-[0_0_8px_rgba(255,255,255,.40)]">
                            {note.lane}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* =================================================
                    HIT LINE
                ================================================== */}
                <div className="pointer-events-none absolute inset-x-[1.5%] bottom-[12%] z-30">
                  <div className="h-px bg-gradient-to-r from-transparent via-white/95 to-transparent shadow-[0_0_18px_rgba(255,255,255,.55),0_0_34px_rgba(167,139,250,.24)]" />
                  <div className="mx-auto mt-[-1px] h-[4px] w-[88%] bg-gradient-to-r from-cyan-300/0 via-white/42 to-fuchsia-300/0 blur-[2px]" />
                </div>

                {/* =================================================
                    COMBO MILESTONE FX
                    30 / 50 / 70 / 100 / 120 / 150 / 170 / 190
                    200+ every 10 combo.
                    Every 100 combo = stronger prism text + stardust.
                ================================================== */}
                {playComboMilestone && (
                  <div
                    key={`combo-milestone-${playComboMilestone.serial}`}
                    className="pointer-events-none absolute inset-0 z-[75] overflow-hidden"
                  >
                    <div
                      className={`hoo-combo30-flash absolute inset-0 ${
                        playComboMilestone.tier === "century"
                          ? "bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,.34)_0%,rgba(250,204,21,.12)_14%,rgba(103,232,249,.15)_26%,rgba(217,70,239,.14)_42%,transparent_70%)]"
                          : "bg-[radial-gradient(circle_at_50%_54%,rgba(255,255,255,.20)_0%,rgba(103,232,249,.10)_18%,rgba(217,70,239,.10)_35%,transparent_68%)]"
                      }`}
                    />

                    {/* century / 200+ stardust cloud */}
                    {(playComboMilestone.tier === "century" ||
                      playComboMilestone.combo >= 200) && (
                      <div className="hoo-combo-star-cloud absolute left-1/2 top-[49%] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.20),rgba(103,232,249,.08)_28%,rgba(217,70,239,.07)_48%,transparent_72%)] blur-[4px]" />
                    )}

                    {/* layered rings */}
                    {[0, 1, 2, 3].map((ringIndex) => (
                      <div
                        key={`milestone-ring-${playComboMilestone.serial}-${ringIndex}`}
                        className={`hoo-combo30-ring absolute left-1/2 top-[53%] rounded-full border ${
                          playComboMilestone.tier === "century"
                            ? ringIndex % 2 === 0
                              ? "border-cyan-100/58 shadow-[0_0_40px_rgba(34,211,238,.32)]"
                              : "border-fuchsia-100/54 shadow-[0_0_40px_rgba(217,70,239,.30)]"
                            : "border-violet-100/34"
                        }`}
                        style={{
                          width: `${150 + ringIndex * 48}px`,
                          height: `${150 + ringIndex * 48}px`,
                          animationDelay: `${ringIndex * 0.055}s`,
                        }}
                      />
                    ))}

                    {/* radial streaks */}
                    {Array.from(
                      {
                        length:
                          playComboMilestone.rayCount,
                      },
                      (_, index) =>
                        getPlayComboBurstPreset(
                          index,
                        ),
                    ).map((ray) => (
                        <span
                          key={`milestone-ray-${playComboMilestone.serial}-${ray.id}`}
                          className={`hoo-combo30-ray absolute left-1/2 top-[53%] origin-left ${
                            playComboMilestone.tier === "century"
                              ? "bg-gradient-to-r from-white via-cyan-100/72 to-transparent"
                              : "bg-gradient-to-r from-white/78 via-violet-100/54 to-transparent"
                          }`}
                          style={{
                            width: `${ray.length}px`,
                            height: `${ray.thickness}px`,
                            ["--combo-angle" as string]:
                              `${ray.angle}deg`,
                            ["--combo-opacity" as string]:
                              String(ray.opacity),
                            ["--combo-duration" as string]:
                              `${ray.duration}s`,
                            animationDelay:
                              `${ray.delay}s`,
                            boxShadow:
                              playComboMilestone.tier === "century"
                                ? "0 0 11px rgba(255,255,255,.48)"
                                : "0 0 7px rgba(196,181,253,.34)",
                          }}
                        />
                      ))}

                    {/* stardust with its own motion trails.
                        At 100-combo multiples it becomes much denser/brighter.
                        From 200 onward this appears every 10 combo. */}
                    {Array.from(
                      {
                        length:
                          playComboMilestone.stardustCount,
                      },
                      (_, index) =>
                        getPlayComboStarDustPreset(
                          index,
                        ),
                    ).map((star) => {
                        const isCentury =
                          playComboMilestone.tier === "century";

                        const hueClass =
                          star.hue === "cyan"
                            ? "from-cyan-50 via-cyan-200/80"
                            : star.hue === "fuchsia"
                              ? "from-fuchsia-50 via-fuchsia-200/80"
                              : star.hue === "gold"
                                ? "from-amber-50 via-yellow-200/85"
                                : star.hue === "white"
                                  ? "from-white via-white/82"
                                  : "from-violet-50 via-violet-200/82";

                        return (
                          <span
                            key={`milestone-star-${playComboMilestone.serial}-${star.id}`}
                            className="hoo-combo-stardust absolute left-1/2 top-[53%] h-[3px] origin-left"
                            style={{
                              width: `${star.tail * (isCentury ? 1.18 : 0.88)}px`,
                              ["--star-angle" as string]:
                                `${star.angle}deg`,
                              ["--star-distance" as string]:
                                `${star.distance * (isCentury ? 1.18 : 1)}px`,
                              ["--star-opacity" as string]:
                                String(
                                  Math.min(
                                    1,
                                    star.opacity *
                                      (isCentury ? 1.16 : 0.90),
                                  ),
                                ),
                              ["--star-duration" as string]:
                                `${star.duration * (isCentury ? 1.06 : 0.92)}s`,
                              ["--star-curve" as string]:
                                `${star.curve}deg`,
                              ["--star-spin-start" as string]:
                                `${star.spin * -0.18}deg`,
                              ["--star-spin-end" as string]:
                                `${star.spin}deg`,
                              animationDelay:
                                `${star.delay}s`,
                            }}
                          >
                            <span
                              className={`absolute inset-0 rounded-full bg-gradient-to-r ${hueClass} to-transparent blur-[0.4px]`}
                            />

                            <span
                              className={`hoo-combo-stardust-head absolute right-0 top-1/2 rounded-full ${
                                star.hue === "cyan"
                                  ? "bg-cyan-50 shadow-[0_0_11px_rgba(103,232,249,.95)]"
                                  : star.hue === "fuchsia"
                                    ? "bg-fuchsia-50 shadow-[0_0_11px_rgba(240,171,252,.95)]"
                                    : star.hue === "gold"
                                      ? "bg-amber-50 shadow-[0_0_11px_rgba(253,230,138,.95)]"
                                      : "bg-white shadow-[0_0_12px_rgba(255,255,255,.96)]"
                              }`}
                              style={{
                                width: `${star.size * 1.22}px`,
                                height: `${star.size * 1.22}px`,
                                marginTop: `${-(star.size * 1.22) / 2}px`,
                              }}
                            />
                          </span>
                        );
                      })}

                    {/* milestone text */}
                    <div
                      className={`absolute left-1/2 top-[43%] text-center ${
                        playComboMilestone.tier === "century"
                          ? "hoo-combo-century-text"
                          : "hoo-combo-milestone-text"
                      }`}
                    >
                      <p
                        className={`whitespace-nowrap font-black tracking-[0.08em] ${
                          playComboMilestone.tier === "century"
                            ? "hoo-combo-century-prism text-[68px] drop-shadow-[0_0_22px_rgba(255,255,255,.85)] sm:text-[96px]"
                            : playComboMilestone.combo >= 200
                              ? "text-[58px] text-white drop-shadow-[0_0_22px_rgba(167,139,250,.78)] sm:text-[84px]"
                              : "text-[54px] text-white drop-shadow-[0_0_18px_rgba(255,255,255,.76)] sm:text-[78px]"
                        }`}
                      >
                        {playComboMilestone.combo} COMBO!!
                      </p>

                      <div
                        className={`mx-auto mt-3 h-[3px] ${
                          playComboMilestone.tier === "century"
                            ? "w-[90%] bg-gradient-to-r from-cyan-300 via-yellow-100 to-fuchsia-300 shadow-[0_0_24px_rgba(255,255,255,.62)]"
                            : "w-[74%] bg-gradient-to-r from-cyan-300 via-white to-fuchsia-300 shadow-[0_0_18px_rgba(167,139,250,.52)]"
                        }`}
                      />

                      <p
                        className={`mt-3 font-black tracking-[0.42em] ${
                          playComboMilestone.tier === "century"
                            ? "text-[13px] text-amber-100/76 sm:text-[15px]"
                            : playComboMilestone.combo >= 200
                              ? "text-[11px] text-violet-100/68 sm:text-[13px]"
                              : "text-[10px] text-violet-100/56 sm:text-[12px]"
                        }`}
                      >
                        {playComboMilestone.tier === "century"
                          ? "STAR CENTURY"
                          : playComboMilestone.combo >= 200
                            ? "OVERDRIVE"
                            : "NEON DRIVE"}
                      </p>
                    </div>
                  </div>
                )}

                {/* =================================================
                    HIT / MISS IMPACT
                ================================================== */}
                {playImpactFx && (
                  <div
                    key={`focused-impact-${playImpactFx.id}`}
                    className="pointer-events-none absolute bottom-[12%] z-50"
                    style={{
                      left: `${playImpactLaneX}%`,
                    }}
                  >
                    {playImpactFx.judgment !== "MISS" ? (
                      <>
                        <div
                          className={`hoo-stage-impact-beam absolute bottom-[-2px] left-0 h-[648px] w-[86px] -translate-x-1/2 rounded-[50%] ${
                            playImpactFx.lane === "A"
                              ? "bg-gradient-to-t from-cyan-50/76 via-cyan-300/24 to-transparent shadow-[0_0_68px_rgba(34,211,238,.54)]"
                              : "bg-gradient-to-t from-fuchsia-50/74 via-fuchsia-300/24 to-transparent shadow-[0_0_68px_rgba(217,70,239,.52)]"
                          }`}
                        />

                        <div
                          className={`hoo-stage-impact-flash absolute left-0 top-0 h-[216px] w-[216px] rounded-full blur-[7px] ${
                            playImpactFx.lane === "A"
                              ? "bg-cyan-100/52 shadow-[0_0_120px_rgba(34,211,238,.88)]"
                              : "bg-fuchsia-100/50 shadow-[0_0_120px_rgba(217,70,239,.86)]"
                          }`}
                        />

                        {[0, 1, 2].map((ringIndex) => (
                          <div
                            key={`focus-ring-${playImpactFx.id}-${ringIndex}`}
                            className={`hoo-stage-impact-shock absolute left-0 top-0 rounded-full border ${
                              playImpactFx.lane === "A"
                                ? "border-cyan-50/74"
                                : "border-fuchsia-50/74"
                            }`}
                            style={{
                              width: `${73 + ringIndex * 31}px`,
                              height: `${73 + ringIndex * 31}px`,
                              animationDelay:
                                `${ringIndex * 0.045}s`,
                            }}
                          />
                        ))}

                        {PLAY_RAY_PRESETS
                          .slice(0, 10)
                          .map((ray, index) => (
                            <span
                              key={`focus-ray-${playImpactFx.id}-${ray.id}`}
                              className={`hoo-stage-impact-ray absolute left-0 top-0 h-[2px] origin-left ${
                                playImpactFx.lane === "A"
                                  ? "bg-gradient-to-r from-white via-cyan-100/88 to-transparent"
                                  : "bg-gradient-to-r from-white via-fuchsia-100/88 to-transparent"
                              }`}
                              style={{
                                width: `${59 + (index % 7) * 13}px`,
                                ["--angle" as string]:
                                  `${(360 / 30) * index}deg`,
                                animationDelay:
                                  `${(index % 6) * 0.006}s`,
                              }}
                            />
                          ))}
                      </>
                    ) : (
                      <>
                        <div className="hoo-stage-impact-flash absolute left-0 top-0 h-[194px] w-[194px] rounded-full bg-rose-500/[0.25] shadow-[0_0_110px_rgba(244,63,94,.72)] blur-[8px]" />

                        <div className="hoo-stage-impact-shock absolute left-0 top-0 h-[108px] w-[108px] rounded-full border-2 border-rose-200/68" />

                        <span className="hoo-stage-miss-slash-a absolute left-0 top-0 h-[5px] w-[151px] bg-gradient-to-r from-transparent via-rose-100 to-transparent shadow-[0_0_24px_rgba(251,113,133,.95)]" />
                        <span className="hoo-stage-miss-slash-b absolute left-0 top-0 h-[5px] w-[151px] bg-gradient-to-r from-transparent via-rose-100 to-transparent shadow-[0_0_24px_rgba(251,113,133,.95)]" />

                        {PLAY_DUST_PRESETS
                          .slice(0, 18)
                          .map((spark, index) => (
                            <span
                              key={`focus-miss-spark-${playImpactFx.id}-${spark.id}`}
                              className="hoo-stage-impact-spark absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-rose-100 shadow-[0_0_10px_rgba(251,113,133,.95)]"
                              style={{
                                ["--angle" as string]:
                                  `${(360 / 18) * index}deg`,
                                ["--distance" as string]:
                                  `${38 + (index % 6) * 12}px`,
                                animationDelay:
                                  `${(index % 4) * 0.008}s`,
                              }}
                            />
                          ))}
                      </>
                    )}
                  </div>
                )}

                {/* =================================================
                    JUDGMENT TEXT
                ================================================== */}
                {playImpactFx && (
                  <div
                    key={`focus-judgment-${playImpactFx.id}`}
                    className={`pointer-events-none absolute inset-x-0 bottom-[27%] z-50 text-center ${
                      playImpactFx.judgment === "MISS"
                        ? "hoo-stage-miss-text"
                        : "hoo-stage-judgment"
                    }`}
                  >
                    <p
                      className={`font-black tracking-[0.16em] ${
                        playImpactFx.judgment === "PERFECT"
                          ? "text-[41px] text-white drop-shadow-[0_0_24px_rgba(255,255,255,.70)] sm:text-[65px]"
                          : playImpactFx.judgment === "GREAT"
                            ? "text-[41px] text-cyan-100 drop-shadow-[0_0_22px_rgba(34,211,238,.68)] sm:text-[65px]"
                            : playImpactFx.judgment === "GOOD"
                              ? "text-[41px] text-amber-200 drop-shadow-[0_0_22px_rgba(251,191,36,.62)] sm:text-[65px]"
                              : "text-[41px] text-rose-300 drop-shadow-[0_0_28px_rgba(244,63,94,.90)] sm:text-[65px]"
                      }`}
                    >
                      {playImpactFx.judgment}
                    </p>

                    {playImpactFx.judgment === "MISS" ? (
                      <p className="mt-1 text-[12px] font-black tracking-[0.22em] text-rose-100/60">
                        COMBO BREAK
                      </p>
                    ) : (
                      <p className="mt-1 font-mono text-[12px] font-black tracking-[0.10em] text-white/36">
                        {playImpactFx.deltaMs > 0 ? "+" : ""}
                        {playImpactFx.deltaMs}ms
                      </p>
                    )}
                  </div>
                )}

                {/* =================================================
                    BOTTOM KEY PADS
                ================================================== */}
                <div className="absolute inset-x-[3%] bottom-[1.2%] z-50 grid grid-cols-2 gap-4">
                  {KEYS.map((lane) => {
                    const active =
                      pressed.has(lane);
                    const leftLane =
                      lane === "A";

                    return (
                      <button
                        key={lane}
                        type="button"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setPressed((previous) =>
                            new Set(previous).add(lane),
                          );
                          judgeLane(lane);
                        }}
                        onPointerUp={() => {
                          releaseHoldLane(lane);
                          setPressed((previous) => {
                            const next =
                              new Set(previous);
                            next.delete(lane);
                            return next;
                          });
                        }}
                        onPointerCancel={() => {
                          releaseHoldLane(lane);
                          setPressed((previous) => {
                            const next =
                              new Set(previous);
                            next.delete(lane);
                            return next;
                          });
                        }}
                        className={`relative min-h-[100px] overflow-hidden rounded-[24px] border text-[51px] font-black transition-[transform,background-color,border-color,box-shadow] duration-75 ${
                          playTrailConfig.floorGlow
                            ? leftLane
                              ? "hoo-trail-note-neon shadow-[0_0_38px_rgba(34,211,238,.30),inset_0_0_22px_rgba(34,211,238,.08)] "
                              : "hoo-trail-note-neon shadow-[0_0_38px_rgba(217,70,239,.28),inset_0_0_22px_rgba(217,70,239,.08)] "
                            : ""
                        }${
                          active
                            ? leftLane
                              ? "translate-y-[-3px] border-cyan-50/80 bg-cyan-300/[0.18] text-white shadow-[0_0_44px_rgba(34,211,238,.34),inset_0_0_32px_rgba(34,211,238,.08)]"
                              : "translate-y-[-3px] border-fuchsia-50/80 bg-fuchsia-300/[0.18] text-white shadow-[0_0_44px_rgba(217,70,239,.32),inset_0_0_32px_rgba(217,70,239,.08)]"
                            : leftLane
                              ? "border-cyan-100/38 bg-[linear-gradient(180deg,rgba(8,145,178,.07),rgba(2,6,23,.78))] text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,.10)]"
                              : "border-fuchsia-100/38 bg-[linear-gradient(180deg,rgba(162,28,175,.07),rgba(2,6,23,.78))] text-fuchsia-50 shadow-[0_0_26px_rgba(217,70,239,.10)]"
                        }`}
                      >
                        <span
                          className={`absolute inset-x-[10%] bottom-0 h-px ${
                            leftLane
                              ? "bg-cyan-100/70"
                              : "bg-fuchsia-100/70"
                          }`}
                        />
                        <span className="relative">
                          {lane}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* =================================================
                    MOBILE COMPACT HUD
                ================================================== */}
                <div className="pointer-events-none absolute inset-x-3 top-3 z-50 flex justify-between lg:hidden">
                  <div className="rounded-[15px] border border-cyan-100/[0.16] bg-black/72 px-4 py-3">
                    <p className="text-[11px] font-black tracking-[0.12em] text-white/36">
                      COMBO
                    </p>
                    <p className="text-[28px] font-black text-cyan-50">
                      {combo}
                    </p>
                  </div>

                  <div className="rounded-[15px] border border-violet-100/[0.16] bg-black/72 px-4 py-3 text-right">
                    <p className="text-[11px] font-black tracking-[0.12em] text-white/36">
                      SCORE
                    </p>
                    <p className="text-[28px] font-black">
                      {score.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* =================================================
                    PAUSE OVERLAY
                ================================================== */}
                {!isPlaying &&
                  currentTime > 0 &&
                  currentTime < effectiveDuration && (
                    <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/78 backdrop-blur-[3px]">
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => void toggleAudio()}
                          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/16 bg-white/[0.055] text-xl font-black text-white shadow-[0_0_36px_rgba(167,139,250,.16)] transition hover:bg-white/[0.09]"
                        >
                          ▶
                        </button>

                        <p className="mt-4 text-2xl font-black tracking-[0.18em] text-white/88">
                          PAUSED
                        </p>

                        <p className="mt-2 text-[10px] font-black tracking-[0.12em] text-white/34">
                          SPACE · 계속
                        </p>

                        <div className="mt-5 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              resetPlay();
                              setScreen("select");
                            }}
                            className="rounded-[10px] border border-white/[0.10] bg-white/[0.035] px-4 py-2 text-[10px] font-black text-white/56 hover:bg-white/[0.07]"
                          >
                            곡 선택
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              resetPlay();
                              onExit();
                            }}
                            className="rounded-[10px] border border-white/[0.10] bg-white/[0.035] px-4 py-2 text-[10px] font-black text-white/56 hover:bg-white/[0.07]"
                          >
                            나가기
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
              </section>
            </div>
          </main>
        )}

        {screen === "result" && (
          <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-8">
            <section className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-white/[0.055] p-6 text-center shadow-2xl sm:p-10">
              <p className="text-xs font-black tracking-[0.28em] text-violet-200/50">RESULT</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">{song.title}</h2>
              <p className="mt-2 text-sm font-bold text-white/40">{difficulty.toUpperCase()}</p>
              <p className="mt-8 text-5xl font-black tracking-tight sm:text-7xl">{score.toLocaleString()}</p>
              <p className="mt-2 text-xs font-black tracking-[0.16em] text-white/35">SCORE</p>
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[['PERFECT', stats.perfect], ['GREAT', stats.great], ['GOOD', stats.good], ['MISS', stats.miss], ['MAX COMBO', maxCombo]].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] font-black tracking-[0.12em] text-white/35">{label}</p><p className="mt-2 text-lg font-black">{value}</p></div>
                ))}
              </div>
              <div className={`mt-8 grid gap-3 ${isAdmin ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}><button type="button" onClick={() => { resetPlay(); setScreen("select"); }} className="rounded-2xl border border-white/15 bg-white/[0.05] py-3.5 text-sm font-black">곡 선택</button>{isAdmin && <button type="button" onClick={() => setScreen("editor")} className="rounded-2xl border border-violet-300/25 bg-violet-400/10 py-3.5 text-sm font-black">관리자 채보 수정</button>}<button type="button" onClick={beginPlay} className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3.5 text-sm font-black">다시 플레이</button></div>
            </section>
          </main>
        )}

        {screen === "editor" && (
          <main className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 lg:px-6">
            <style>{`
              .hoo-editor-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
              .hoo-editor-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,.025); border-radius: 999px; }
              .hoo-editor-scroll::-webkit-scrollbar-thumb { background: rgba(167,139,250,.18); border-radius: 999px; }
              .hoo-editor-scroll::-webkit-scrollbar-thumb:hover { background: rgba(167,139,250,.30); }
              .hoo-editor-range { appearance: none; -webkit-appearance: none; background: transparent; }
              .hoo-editor-range::-webkit-slider-thumb {
                appearance: none; -webkit-appearance: none;
                width: 13px; height: 13px; border-radius: 999px;
                background: #d9d6ff; border: 2px solid #7c6df0;
                box-shadow: 0 0 0 4px rgba(124,109,240,.13), 0 0 18px rgba(124,109,240,.42);
                cursor: pointer;
              }
              .hoo-editor-range::-moz-range-thumb {
                width: 13px; height: 13px; border-radius: 999px;
                background: #d9d6ff; border: 2px solid #7c6df0;
                box-shadow: 0 0 0 4px rgba(124,109,240,.13), 0 0 18px rgba(124,109,240,.42);
                cursor: pointer;
              }
            `}</style>

            <div className="mx-auto grid w-full max-w-[1660px] gap-3 xl:grid-cols-[minmax(0,1fr)_310px]">
              {/* =====================================================
                  LEFT · MANUAL WORKSPACE
              ====================================================== */}
              <section className="min-w-0 space-y-3">
                {/* MEDIA / SONG */}
                <section className="overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#0b0f20]/86 shadow-[0_18px_60px_rgba(0,0,0,.22)]">
                  <div className="flex items-center justify-between border-b border-white/[0.055] px-3 py-2.5 sm:px-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-[7px] border border-violet-200/[0.10] bg-violet-400/[0.06] text-[10px] text-violet-100/65">
                        ◫
                      </span>
                      <div>
                        <p className="text-[10px] font-black text-white/72">영상/음원</p>
                        <p className="text-[9px] font-bold text-white/24">음악을 들으며 바로 아래 타임라인에 노트를 입력합니다.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={openAudioPicker}
                        disabled={analysisBusy}
                        className="rounded-[8px] border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] font-black text-white/56 transition hover:border-violet-200/18 hover:bg-violet-300/[0.04] hover:text-white/82 disabled:cursor-wait disabled:opacity-35"
                      >
                        {analysisBusy
                          ? "음원 불러오는 중…"
                          : audioUrl
                            ? "음원 교체"
                            : "음원 등록"}
                      </button>
                      <button
                        type="button"
                        onClick={() => coverFileRef.current?.click()}
                        disabled={coverBusy}
                        className="rounded-[8px] border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[9px] font-black text-white/40 transition hover:text-white/70 disabled:opacity-30"
                      >
                        {currentCover ? "이미지 교체" : "이미지 설정"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
                    {/* visual */}
                    <div
                      className="relative min-h-[178px] overflow-hidden border-b border-white/[0.055] bg-[#060814] lg:border-b-0 lg:border-r"
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();

                        const file =
                          event.dataTransfer.files?.[0];

                        if (file) {
                          void importAudioFile(file);
                        }
                      }}
                    >
                      {currentCover ? (
                        <img
                          src={currentCover.dataUrl}
                          alt={`${song.title} cover`}
                          className="absolute inset-0 h-full w-full object-cover opacity-74"
                          draggable={false}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_38%,rgba(139,92,246,.28),transparent_30%),radial-gradient(circle_at_70%_24%,rgba(59,130,246,.15),transparent_24%),linear-gradient(145deg,#0a0d1c,#050711)]" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-[#050712] via-[#050712]/10 to-black/10" />
                      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle,#fff_0.7px,transparent_0.8px)] [background-size:26px_26px]" />

                      <button
                        type="button"
                        onClick={() => {
                          if (!audioUrl) {
                            openAudioPicker();
                            return;
                          }

                          void toggleAudio();
                        }}
                        disabled={analysisBusy}
                        className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.20] bg-black/35 text-[13px] font-black text-white/84 shadow-[0_0_28px_rgba(124,109,240,.28)] backdrop-blur-md transition hover:scale-105 hover:bg-black/50 disabled:opacity-20"
                      >
                        {analysisBusy
                          ? "…"
                          : audioUrl
                            ? isPlaying
                              ? "Ⅱ"
                              : "▶"
                            : "+"}
                      </button>

                      {!audioUrl && !analysisBusy && (
                        <button
                          type="button"
                          onClick={openAudioPicker}
                          className="absolute left-1/2 top-[66%] -translate-x-1/2 rounded-full border border-violet-200/[0.10] bg-black/36 px-3 py-1.5 text-[9px] font-black text-violet-50/54 backdrop-blur-md transition hover:border-violet-200/22 hover:text-violet-50/82"
                        >
                          클릭 또는 파일 드롭
                        </button>
                      )}

                      <div className="absolute inset-x-0 bottom-0 p-3.5">
                        <p className="text-[9px] font-black tracking-[0.18em] text-violet-100/48">HOO RHYTHM MANUAL</p>
                        <p className="mt-0.5 truncate text-sm font-black text-white/88">{publishTitle.trim() || song.title}</p>
                        <p className="mt-0.5 truncate text-[9px] font-bold text-white/34">{audioName || "음원 미등록"}</p>
                      </div>
                    </div>

                    {/* controls */}
                    <div className="min-w-0 p-3.5 sm:p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-xl font-black tracking-[-0.03em] text-white/92">{publishTitle.trim() || song.title}</h2>
                          <p className="mt-0.5 truncate text-[10px] font-bold text-white/40">{audioName || "음원을 등록해주세요"} · A / K 직접 입력</p>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[9px] font-black text-white/35">{formatTime(effectiveDuration)}</span>
                            <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[9px] font-black text-white/35">BPM {Math.round(chart.bpm || song.bpm)}</span>
                            <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[9px] font-black text-white/35">A / K</span>
                            <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${editorDirty ? "border-amber-200/[0.12] bg-amber-300/[0.03] text-amber-100/58" : "border-emerald-200/[0.10] bg-emerald-300/[0.025] text-emerald-100/50"}`}>
                              {editorDirty ? "변경사항 있음" : lastSavedAt ? `저장됨 ${lastSavedAt}` : "저장됨"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {[0.5, 0.75, 1, 1.25].map((rate) => (
                            <button
                              key={rate}
                              type="button"
                              onClick={() => setPlaybackRate(rate)}
                              className={`rounded-[7px] border px-2 py-1.5 text-[9px] font-black ${playbackRate === rate ? "border-violet-200/22 bg-violet-400/[0.10] text-violet-50/75" : "border-white/[0.055] bg-white/[0.02] text-white/40 hover:text-white/55"}`}
                            >
                              {rate}×
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1 flex items-end justify-between gap-2">
                          <p className="font-mono text-base font-black text-white/82">
                            {formatTimePrecise(currentTime)}
                            <span className="ml-1.5 text-[11px] text-white/24">/ {formatTime(effectiveDuration)}</span>
                          </p>
                          <span className="text-[9px] font-black text-white/24">{Math.round(progress * 100)}%</span>
                        </div>

                        <div className="relative h-10 overflow-hidden rounded-[9px] border border-white/[0.055] bg-black/[0.18] px-1.5">
                          {fullWaveformBars.length > 0 && (
                            <div className="pointer-events-none absolute inset-0 flex items-center gap-[1px] px-1.5 opacity-55">
                              {fullWaveformBars.map((value, index) => (
                                <span
                                  key={`full-wave-${index}`}
                                  className={`flex-1 rounded-full ${index / fullWaveformBars.length <= progress ? "bg-violet-300/50" : "bg-white/[0.13]"}`}
                                  style={{ height: `${Math.max(6, value * 82)}%` }}
                                />
                              ))}
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-y-0 left-0 bg-violet-400/[0.055]" style={{ width: `${progress * 100}%` }} />
                          <input
                            type="range"
                            min={0}
                            max={Math.max(effectiveDuration, 0.01)}
                            step={0.001}
                            value={Math.min(currentTime, Math.max(effectiveDuration, 0.01))}
                            onChange={(event) => seekEditor(Number(event.target.value))}
                            className="hoo-editor-range absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                            aria-label="곡 전체 진행 위치"
                          />
                          <div className="pointer-events-none absolute inset-y-1 z-[5] w-[2px] rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,.55)]" style={{ left: `calc(${progress * 100}% - 1px)` }} />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => seekEditor(currentTime - 5)} disabled={!audioUrl} className="rounded-[8px] border border-white/[0.055] bg-white/[0.02] px-2.5 py-2 text-[10px] font-black text-white/36 disabled:opacity-25">-5s</button>
                          <button type="button" onClick={() => seekEditor(currentTime - 1)} disabled={!audioUrl} className="rounded-[8px] border border-white/[0.055] bg-white/[0.02] px-2.5 py-2 text-[10px] font-black text-white/36 disabled:opacity-25">-1s</button>
                          <button type="button" onClick={() => void toggleAudio()} disabled={!audioUrl} className="min-w-[72px] rounded-[9px] border border-violet-200/[0.16] bg-violet-400/[0.08] px-4 py-2 text-[10px] font-black text-violet-50/74 shadow-[0_0_20px_rgba(139,92,246,.09)] disabled:opacity-25">{isPlaying ? "PAUSE" : "PLAY"}</button>
                          <button type="button" onClick={() => seekEditor(currentTime + 1)} disabled={!audioUrl} className="rounded-[8px] border border-white/[0.055] bg-white/[0.02] px-2.5 py-2 text-[10px] font-black text-white/36 disabled:opacity-25">+1s</button>
                          <button type="button" onClick={() => seekEditor(currentTime + 5)} disabled={!audioUrl} className="rounded-[8px] border border-white/[0.055] bg-white/[0.02] px-2.5 py-2 text-[10px] font-black text-white/36 disabled:opacity-25">+5s</button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-white/22">VOL</span>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={editorVolume}
                            onChange={(event) => setEditorVolume(Number(event.target.value))}
                            className="w-24 accent-violet-400"
                            aria-label="편집 음량"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* NOTE EDITOR */}
                <section className="rounded-[18px] border border-white/[0.09] bg-[#0b0f20]/88 p-3 shadow-[0_18px_60px_rgba(0,0,0,.20)] sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-[7px] border border-blue-200/[0.10] bg-blue-400/[0.06] text-[11px] text-blue-100/65">▦</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-[11px] font-black text-white/78">노트 편집</h3>
                          <span className="rounded-full border border-white/[0.055] bg-white/[0.02] px-2 py-0.5 text-[9px] font-black text-white/24">{difficulty.toUpperCase()} · {chart.notes.length} NOTES</span>
                        </div>
                        <p className="text-[9px] font-bold text-white/23">자동생성 없음 · 재생 중 A/K 입력 또는 타임라인 도구로 원하는 위치에 직접 배치합니다.</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="flex items-center rounded-[9px] border border-white/[0.055] bg-black/[0.10] p-0.5">
                        {(["select", "A", "K"] as EditorTool[]).map((tool) => (
                          <button
                            key={tool}
                            type="button"
                            onClick={() => setEditorTool(tool)}
                            className={`rounded-[7px] px-2.5 py-1.5 text-[9px] font-black transition ${editorTool === tool ? tool === "A" ? "bg-cyan-400/[0.15] text-cyan-50/80" : tool === "K" ? "bg-fuchsia-400/[0.15] text-fuchsia-50/80" : "bg-white/[0.08] text-white/72" : "text-white/40 hover:text-white/50"}`}
                          >
                            {tool === "select" ? "선택/이동" : `${tool} 찍기`}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1 rounded-[9px] border border-rose-200/[0.07] bg-rose-400/[0.025] p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setBulkDeleteMode((value) => !value);
                            setSelectedEditorNoteIds(new Set());
                            setEditorTool("select");
                          }}
                          className={`rounded-[7px] px-2 py-1.5 text-[9px] font-black transition ${bulkDeleteMode ? "bg-rose-400/[0.16] text-rose-50/80" : "text-rose-100/42 hover:text-rose-50/70"}`}
                        >
                          {bulkDeleteMode ? "부분선택 ON" : "부분삭제"}
                        </button>

                        {bulkDeleteMode && (
                          <>
                            <button
                              type="button"
                              onClick={selectCurrentWindowForDelete}
                              className="rounded-[7px] px-2 py-1.5 text-[9px] font-black text-white/38 hover:bg-white/[0.04] hover:text-white/65"
                            >
                              구간 선택
                            </button>
                            <button
                              type="button"
                              onClick={deleteSelectedEditorNotes}
                              disabled={!selectedEditorNoteIds.size}
                              className="rounded-[7px] bg-rose-500/[0.13] px-2 py-1.5 text-[9px] font-black text-rose-50/72 disabled:opacity-25"
                            >
                              선택 삭제 {selectedEditorNoteIds.size || ""}
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={deleteCurrentEditorWindowNotes}
                          disabled={!editorWindowNotes.length}
                          className="rounded-[7px] px-2 py-1.5 text-[9px] font-black text-rose-100/38 hover:bg-rose-400/[0.05] hover:text-rose-50/65 disabled:opacity-20"
                        >
                          현재 구간 삭제
                        </button>
                        <button
                          type="button"
                          onClick={deleteAllEditorNotes}
                          disabled={!chart.notes.length}
                          className="rounded-[7px] bg-rose-500/[0.08] px-2 py-1.5 text-[9px] font-black text-rose-100/56 hover:bg-rose-500/[0.14] hover:text-rose-50/80 disabled:opacity-20"
                        >
                          전체 삭제
                        </button>
                      </div>

                      <div className="flex items-center rounded-[9px] border border-white/[0.055] bg-black/[0.10] p-0.5">
                        <button type="button" onClick={() => setTimelineZoom((value) => clamp(value / 2, 0.5, 4))} className="rounded-[7px] px-2 py-1.5 text-[10px] font-black text-white/34 hover:text-white/60">−</button>
                        <span className="min-w-[40px] text-center text-[9px] font-black text-white/46">{Math.round(timelineZoom * 100)}%</span>
                        <button type="button" onClick={() => setTimelineZoom((value) => clamp(value * 2, 0.5, 4))} className="rounded-[7px] px-2 py-1.5 text-[10px] font-black text-white/34 hover:text-white/60">＋</button>
                      </div>

                      <button type="button" onClick={() => setShowBeatGrid((value) => !value)} className={`rounded-[8px] border px-2.5 py-1.5 text-[9px] font-black ${showBeatGrid ? "border-blue-200/[0.14] bg-blue-400/[0.07] text-blue-50/65" : "border-white/[0.055] bg-white/[0.02] text-white/40"}`}>그리드</button>
                      <button type="button" onClick={() => setShowWaveform((value) => !value)} className={`rounded-[8px] border px-2.5 py-1.5 text-[9px] font-black ${showWaveform ? "border-violet-200/[0.14] bg-violet-400/[0.07] text-violet-50/65" : "border-white/[0.055] bg-white/[0.02] text-white/40"}`}>파형</button>
                      <button type="button" onClick={() => setSnapEnabled((value) => !value)} className={`rounded-[8px] border px-2.5 py-1.5 text-[9px] font-black ${snapEnabled ? "border-fuchsia-200/[0.16] bg-fuchsia-400/[0.08] text-fuchsia-50/70" : "border-white/[0.055] bg-white/[0.02] text-white/40"}`}>스냅 {snapEnabled ? "ON" : "OFF"}</button>
                      <select value={snapDivision} onChange={(event) => setSnapDivision(Number(event.target.value) as SnapDivision)} className="rounded-[8px] border border-white/[0.055] bg-[#0b0f20] px-2 py-1.5 text-[9px] font-black text-white/44 outline-none">
                        <option value={4}>1/4</option>
                        <option value={8}>1/8</option>
                        <option value={16}>1/16</option>
                        <option value={32}>1/32</option>
                      </select>
                    </div>
                  </div>

                  {/* timeline ruler */}
                  <div className="mt-3 rounded-[14px] border border-white/[0.065] bg-[#050814] p-2.5">
                    <div className="ml-[46px] flex justify-between font-mono text-[9px] font-bold text-white/38">
                      {Array.from({ length: 9 }, (_, index) => {
                        const time = editorWindowStart + (index / 8) * editorWindowDuration;
                        return <span key={`ruler-${index}`}>{formatTimePrecise(time).slice(0, 5)}</span>;
                      })}
                    </div>

                    <div className="mt-1 grid grid-cols-[42px_minmax(0,1fr)] gap-1.5">
                      <div className="grid h-[176px] grid-rows-2 gap-1.5">
                        <button type="button" onClick={() => setEditorTool("A")} className={`rounded-[9px] border text-base font-black ${editorTool === "A" ? "border-cyan-100/35 bg-cyan-400/22 text-white shadow-[0_0_22px_rgba(34,211,238,.18)]" : "border-cyan-100/[0.10] bg-cyan-400/[0.06] text-cyan-100/72"}`}>A</button>
                        <button type="button" onClick={() => setEditorTool("K")} className={`rounded-[9px] border text-base font-black ${editorTool === "K" ? "border-fuchsia-100/35 bg-fuchsia-400/22 text-white shadow-[0_0_22px_rgba(217,70,239,.18)]" : "border-fuchsia-100/[0.10] bg-fuchsia-400/[0.06] text-fuchsia-100/72"}`}>K</button>
                      </div>

                      <div
                        className="relative h-[176px] cursor-crosshair overflow-hidden rounded-[10px] border border-white/[0.045] bg-[#050711] [contain:layout_paint]"
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
                          const time = editorWindowStart + ratio * editorWindowDuration;

                          if (editorTool === "A" || editorTool === "K") {
                            addEditorNoteAt(editorTool, time);
                          } else {
                            seekEditor(time);
                          }
                        }}
                      >
                        {/* waveform */}
                        {editorWaveformBars.length > 0 && (
                          <div className="pointer-events-none absolute inset-0 flex items-center gap-[1px] px-1 opacity-32">
                            {editorWaveformBars.map((value, index) => (
                              <span key={`editor-wave-${index}`} className="flex-1 rounded-full bg-violet-200/28" style={{ height: `${Math.max(4, value * 86)}%` }} />
                            ))}
                          </div>
                        )}

                        {/* beat grid */}
                        {editorBeatLines.map((line, index) => {
                          const x = ((line.time - editorWindowStart) / editorWindowDuration) * 100;
                          return (
                            <div key={`beat-${index}`} className={`pointer-events-none absolute inset-y-0 w-px ${line.major ? "bg-violet-100/[0.15]" : "bg-white/[0.055]"}`} style={{ left: `${x}%` }} />
                          );
                        })}

                        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/[0.075]" />
                        <div className="pointer-events-none absolute inset-x-0 top-1/4 border-t border-dashed border-cyan-200/[0.11]" />
                        <div className="pointer-events-none absolute inset-x-0 top-3/4 border-t border-dashed border-fuchsia-200/[0.11]" />

                        {/* loop range */}
                        {loopEnabled && loopEnd > loopStart && loopEnd >= editorWindowStart && loopStart <= editorWindowEnd && (
                          <div
                            className="pointer-events-none absolute inset-y-0 border-x border-violet-200/24 bg-violet-400/[0.055]"
                            style={{
                              left: `${clamp((Math.max(loopStart, editorWindowStart) - editorWindowStart) / editorWindowDuration, 0, 1) * 100}%`,
                              width: `${clamp((Math.min(loopEnd, editorWindowEnd) - Math.max(loopStart, editorWindowStart)) / editorWindowDuration, 0, 1) * 100}%`,
                            }}
                          />
                        )}

                        {/* notes */}
                        {editorWindowNotes.map((note) => {
                          const x = ((note.time - editorWindowStart) / editorWindowDuration) * 100;
                          const top = note.lane === "A" ? 25 : 75;
                          const selected = selectedEditorNoteId === note.id;
                          const bulkSelected = selectedEditorNoteIds.has(note.id);

                          const holdDuration = Math.max(0, Number(note.duration) || 0);
                          const holdWidth =
                            holdDuration > 0
                              ? clamp((holdDuration / editorWindowDuration) * 100, 0.7, 100 - x)
                              : 0;

                          return (
                            <div key={note.id}>
                              {holdDuration > 0.04 && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (bulkDeleteMode) {
                                      toggleBulkDeleteNote(note.id);
                                      return;
                                    }
                                    setSelectedEditorNoteId(note.id);
                                    setEditorTool("select");
                                    seekEditor(note.time);
                                  }}
                                  className={`absolute z-10 h-2 -translate-y-1/2 rounded-full border ${note.lane === "A" ? "border-cyan-100/30 bg-cyan-400/25" : "border-fuchsia-100/30 bg-fuchsia-400/25"}`}
                                  style={{
                                    left: `${x}%`,
                                    top: `${top}%`,
                                    width: `${holdWidth}%`,
                                  }}
                                  title={`홀드 ${holdDuration.toFixed(3)}s`}
                                />
                              )}

                              <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (bulkDeleteMode) {
                                      toggleBulkDeleteNote(note.id);
                                      return;
                                    }
                                    setSelectedEditorNoteId(note.id);
                                    setEditorTool("select");
                                    seekEditor(note.time);
                                  }}
                                className={`absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border transition ${bulkSelected ? "scale-125 border-rose-100 bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,.65)]" : selected ? "scale-125 border-white bg-white shadow-[0_0_18px_rgba(255,255,255,.55)]" : note.lane === "A" ? "border-cyan-50/60 bg-cyan-400/75 shadow-[0_0_10px_rgba(34,211,238,.25)] hover:scale-110" : "border-fuchsia-50/60 bg-fuchsia-400/75 shadow-[0_0_10px_rgba(217,70,239,.23)] hover:scale-110"}`}
                                style={{ left: `${x}%`, top: `${top}%` }}
                                title={`${formatTimePrecise(note.time)} · ${note.lane}${holdDuration > 0 ? ` · HOLD ${holdDuration.toFixed(3)}s` : ""}`}
                              />
                            </div>
                          );
                        })}

                        {/* playhead */}
                        <div
                          className="pointer-events-none absolute inset-y-0 z-30 w-[2px] bg-cyan-100/90 shadow-[0_0_14px_rgba(103,232,249,.65)] will-change-transform"
                          style={{ left: `${clamp((currentTime - editorWindowStart) / editorWindowDuration, 0, 1) * 100}%` }}
                        >
                          <div className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent border-t-cyan-100" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.045] pt-2">
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={undoEditor} className="rounded-[7px] border border-white/[0.055] bg-white/[0.02] px-2 py-1.5 text-[9px] font-black text-white/34 hover:text-white/60">↶ 되돌리기</button>
                        <button type="button" onClick={redoEditor} className="rounded-[7px] border border-white/[0.055] bg-white/[0.02] px-2 py-1.5 text-[9px] font-black text-white/34 hover:text-white/60">↷ 다시</button>
                        <button type="button" onClick={quantizeAllEditorNotes} disabled={!chart.notes.length} className="rounded-[7px] border border-white/[0.055] bg-white/[0.02] px-2 py-1.5 text-[9px] font-black text-white/34 hover:text-white/60 disabled:opacity-20">전체 1/{snapDivision} 정렬</button>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[9px] font-black text-white/40">
                        <span>{formatTimePrecise(editorWindowStart)} — {formatTimePrecise(editorWindowEnd)}</span>
                        <span>구간 {editorWindowNotes.length} NOTES</span>
                      </div>
                    </div>
                  </div>

                  {/* A/K input */}
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-white/52">노트 입력</p>
                        <p className="text-[9px] font-bold text-white/22">키보드 A / K 또는 아래 버튼 · 재생/정지 상태 모두 입력 가능</p>
                      </div>
                      <span className="font-mono text-[10px] font-black text-violet-100/45">INSERT @ {formatTimePrecise(currentTime)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => addEditorNoteAt("A", currentTime)}
                        disabled={!audioUrl}
                        className={`relative overflow-hidden rounded-[12px] border py-3.5 text-lg font-black transition ${pressed.has("A") ? "border-white/40 bg-cyan-400/20 text-white" : "border-cyan-200/[0.14] bg-gradient-to-r from-cyan-500/[0.08] to-blue-500/[0.055] text-cyan-50/76 hover:border-cyan-100/25 hover:bg-cyan-400/[0.10]"} disabled:opacity-25`}
                      >
                        A
                        <span className="ml-2 text-[9px] font-black text-white/24">현재 위치에 노트 추가</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => addEditorNoteAt("K", currentTime)}
                        disabled={!audioUrl}
                        className={`relative overflow-hidden rounded-[12px] border py-3.5 text-lg font-black transition ${pressed.has("K") ? "border-white/40 bg-fuchsia-400/20 text-white" : "border-fuchsia-200/[0.14] bg-gradient-to-r from-violet-500/[0.055] to-fuchsia-500/[0.08] text-fuchsia-50/76 hover:border-fuchsia-100/25 hover:bg-fuchsia-400/[0.10]"} disabled:opacity-25`}
                      >
                        K
                        <span className="ml-2 text-[9px] font-black text-white/24">현재 위치에 노트 추가</span>
                      </button>
                    </div>
                  </div>
                </section>

                {/* NOTE LIST */}
                <section className="rounded-[18px] border border-white/[0.08] bg-[#0b0f20]/82 p-3 shadow-[0_14px_50px_rgba(0,0,0,.16)] sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[10px] font-black text-white/68">노트 목록</h3>
                        <span className="text-[9px] font-bold text-white/24">총 {chart.notes.length}개 · {difficulty.toUpperCase()}</span>
                        {bulkDeleteMode && (
                          <span className="rounded-full border border-rose-200/[0.10] bg-rose-400/[0.05] px-2 py-0.5 text-[9px] font-black text-rose-100/58">삭제 선택 {selectedEditorNoteIds.size}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[9px] font-bold text-white/20">행을 클릭하면 해당 노트 위치로 이동하고 타임라인에서 선택됩니다.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="flex rounded-[8px] border border-white/[0.055] bg-black/[0.10] p-0.5">
                        {(["all", "A", "K"] as NoteListFilter[]).map((filter) => (
                          <button key={filter} type="button" onClick={() => setNoteListFilter(filter)} className={`rounded-[6px] px-2 py-1 text-[9px] font-black ${noteListFilter === filter ? "bg-white/[0.08] text-white/68" : "text-white/24"}`}>{filter === "all" ? "전체" : filter}</button>
                        ))}
                      </div>
                      <div className="flex rounded-[8px] border border-white/[0.055] bg-black/[0.10] p-0.5">
                        <button type="button" onClick={() => setNoteListScope("nearby")} className={`rounded-[6px] px-2 py-1 text-[9px] font-black ${noteListScope === "nearby" ? "bg-violet-400/[0.10] text-violet-50/64" : "text-white/24"}`}>현재 ±8초</button>
                        <button type="button" onClick={() => setNoteListScope("all")} className={`rounded-[6px] px-2 py-1 text-[9px] font-black ${noteListScope === "all" ? "bg-violet-400/[0.10] text-violet-50/64" : "text-white/24"}`}>전체</button>
                      </div>

                      {noteListPageCount > 1 && (
                        <div className="flex items-center gap-1 rounded-[8px] border border-white/[0.055] bg-black/[0.10] p-0.5">
                          <button
                            type="button"
                            onClick={() => setNoteListPage((page) => Math.max(0, page - 1))}
                            disabled={safeNoteListPage <= 0}
                            className="rounded-[6px] px-2 py-1 text-[9px] font-black text-white/38 disabled:opacity-20"
                          >
                            이전
                          </button>
                          <span className="min-w-[58px] text-center text-[9px] font-black text-white/34">
                            {safeNoteListPage + 1} / {noteListPageCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setNoteListPage((page) => Math.min(noteListPageCount - 1, page + 1))}
                            disabled={safeNoteListPage >= noteListPageCount - 1}
                            className="rounded-[6px] px-2 py-1 text-[9px] font-black text-white/38 disabled:opacity-20"
                          >
                            다음
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="hoo-editor-scroll mt-2 max-h-[155px] overflow-auto rounded-[10px] border border-white/[0.045] [contain:layout_paint]">
                    <div className="sticky top-0 z-10 grid grid-cols-[44px_110px_70px_minmax(0,1fr)_70px] border-b border-white/[0.05] bg-[#101426]/96 px-2 py-1.5 text-[9px] font-black text-white/24 backdrop-blur-md">
                      <span>#</span>
                      <span>시간</span>
                      <span>레인</span>
                      <span>상태</span>
                      <span className="text-right">관리</span>
                    </div>

                    {filteredEditorNotes.length === 0 ? (
                      <p className="px-3 py-8 text-center text-[10px] font-bold text-white/20">조건에 맞는 노트가 없습니다.</p>
                    ) : (
                      pagedEditorNotes.map((note) => {
                        const absoluteIndex = noteIndexById.get(note.id) || 0;
                        const selected = selectedEditorNoteId === note.id;
                        const bulkSelected = selectedEditorNoteIds.has(note.id);

                        return (
                          <button
                            key={note.id}
                            type="button"
                            onClick={() => {
                              if (bulkDeleteMode) {
                                toggleBulkDeleteNote(note.id);
                                return;
                              }
                              setSelectedEditorNoteId(note.id);
                              setEditorTool("select");
                              seekEditor(note.time);
                            }}
                            className={`grid w-full grid-cols-[44px_110px_70px_minmax(0,1fr)_70px] items-center border-b border-white/[0.032] px-2 py-1.5 text-left text-[10px] last:border-b-0 ${bulkSelected ? "bg-rose-400/[0.10]" : selected ? "bg-violet-400/[0.09]" : "hover:bg-white/[0.018]"}`}
                          >
                            <span className="font-mono text-white/24">{absoluteIndex}</span>
                            <span className="font-mono font-black text-white/52">{note.time.toFixed(3)}s</span>
                            <span className={`w-fit rounded-[5px] px-2 py-0.5 font-black ${note.lane === "A" ? "bg-cyan-400/[0.13] text-cyan-50/68" : "bg-fuchsia-400/[0.13] text-fuchsia-50/68"}`}>{note.lane}</span>
                            <span className="text-white/26">{Number(note.duration) > 0.04 ? `홀드 ${Number(note.duration).toFixed(3)}s` : "일반 노트"}</span>
                            <span className="text-right font-black text-white/24">이동</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              </section>

              {/* =====================================================
                  RIGHT SIDEBAR
              ====================================================== */}
              <aside className="space-y-3 xl:sticky xl:top-0 xl:self-start">
                {/* SAVE */}
                <button
                  type="button"
                  onClick={() => void saveEditorCheckpoint()}
                  disabled={draftBusy}
                  className="group w-full overflow-hidden rounded-[18px] border border-violet-200/[0.18] bg-gradient-to-br from-violet-500/[0.20] to-violet-950/[0.15] p-3.5 text-left shadow-[0_16px_38px_rgba(93,63,211,.10)] transition hover:border-violet-100/28 hover:brightness-110"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-violet-100/20 bg-violet-400/20 text-xl shadow-[0_0_24px_rgba(139,92,246,.20)]">▣</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-black text-white/88">{draftBusy ? "저장 중…" : "저장하기"}</h3>
                        <span className="rounded-[6px] border border-white/[0.07] bg-black/[0.12] px-1.5 py-1 text-[9px] font-black text-white/40">Ctrl + S</span>
                      </div>
                      <p className="mt-0.5 text-[9px] font-bold text-white/38">미완성 상태 그대로 3난이도 채보와 로컬 음원을 저장해 다음에 이어서 작업합니다.</p>
                    </div>
                  </div>
                </button>

                {/* PUBLISH */}
                <button
                  type="button"
                  onClick={() => void publishCurrentSong()}
                  disabled={publishBusy}
                  className="group w-full overflow-hidden rounded-[18px] border border-blue-200/[0.18] bg-gradient-to-br from-blue-500/[0.22] via-indigo-500/[0.15] to-violet-950/[0.15] p-3.5 text-left shadow-[0_16px_42px_rgba(37,99,235,.12)] transition hover:border-blue-100/30 hover:brightness-110 disabled:cursor-wait disabled:opacity-45"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-blue-100/22 bg-blue-400/20 text-xl shadow-[0_0_24px_rgba(59,130,246,.22)]">↑</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-black text-white/88">{publishBusy ? "송출 중…" : "송출하기"}</h3>
                        <span className="rounded-[6px] border border-white/[0.07] bg-black/[0.12] px-1.5 py-1 text-[9px] font-black text-white/40">Ctrl + Enter</span>
                      </div>
                      <p className="mt-0.5 text-[9px] font-bold text-white/38">송출 성공 즉시 이용자 곡 목록에 나타나며 바로 플레이할 수 있습니다.</p>
                    </div>
                  </div>
                </button>

                {/* DIFFICULTY */}
                <section className="rounded-[16px] border border-white/[0.075] bg-[#0d1120]/88 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black tracking-[0.14em] text-white/23">DIFFICULTY</p>
                      <h3 className="mt-0.5 text-[11px] font-black text-white/68">난이도 선택</h3>
                    </div>
                    <span className="text-[9px] font-black text-white/20">현재 편집</span>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {(["easy", "normal", "hard"] as Difficulty[]).map((level) => {
                      const count = difficultyNoteCounts[level];
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => {
                            if (editorDirty) void saveEditorCheckpoint();
                            setDifficulty(level);
                            setSelectedEditorNoteId(null);
                          }}
                          className={`rounded-[9px] border px-1 py-2 text-center transition ${difficulty === level ? "border-violet-200/24 bg-violet-400/[0.12] text-white" : "border-white/[0.055] bg-white/[0.018] text-white/40 hover:text-white/52"}`}
                        >
                          <p className="text-[10px] font-black">{level.toUpperCase()}</p>
                          <p className="mt-0.5 text-[6px] font-bold opacity-55">{count} NOTES</p>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* CURRENT POSITION / LOOP */}
                <section className="rounded-[16px] border border-white/[0.075] bg-[#0d1120]/88 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black tracking-[0.14em] text-white/23">POSITION</p>
                      <h3 className="mt-0.5 text-[11px] font-black text-white/68">현재 구간</h3>
                    </div>
                    <span className="rounded-full border border-white/[0.055] bg-white/[0.02] px-2 py-1 text-[9px] font-black text-white/42">{difficulty.toUpperCase()} · {chart.notes.length}</span>
                  </div>

                  <p className="mt-2 font-mono text-xl font-black tracking-[-0.03em] text-white/84">{formatTimePrecise(currentTime)} <span className="text-[11px] text-white/22">/ {formatTime(effectiveDuration)}</span></p>

                  <div className="mt-2 grid grid-cols-5 gap-1">
                    {[
                      { label: "-10", delta: -10 },
                      { label: "-1", delta: -1 },
                      { label: isPlaying ? "Ⅱ" : "▶", delta: 0 },
                      { label: "+1", delta: 1 },
                      { label: "+10", delta: 10 },
                    ].map((control) => (
                      <button
                        key={control.label}
                        type="button"
                        onClick={() => control.delta === 0 ? void toggleAudio() : seekEditor(currentTime + control.delta)}
                        disabled={!audioUrl}
                        className={`rounded-[8px] border py-2 text-[10px] font-black disabled:opacity-20 ${control.delta === 0 ? "border-violet-200/[0.17] bg-violet-400/[0.09] text-violet-50/72" : "border-white/[0.05] bg-white/[0.018] text-white/44"}`}
                      >
                        {control.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 rounded-[10px] border border-white/[0.05] bg-black/[0.10] p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-black text-white/40">구간 반복</span>
                      <button type="button" onClick={() => setLoopEnabled((value) => !value)} className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${loopEnabled ? "border-violet-200/18 bg-violet-400/[0.10] text-violet-50/64" : "border-white/[0.05] text-white/25"}`}>{loopEnabled ? "ON" : "OFF"}</button>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      <button type="button" onClick={() => { setLoopStart(currentTime); if (loopEnd <= currentTime) setLoopEnd(Math.min(duration, currentTime + 4)); }} className="rounded-[7px] border border-white/[0.05] bg-white/[0.018] py-1.5 text-[9px] font-black text-white/42">시작 {formatTime(loopStart)}</button>
                      <button type="button" onClick={() => { setLoopEnd(Math.max(loopStart + 0.1, currentTime)); setLoopEnabled(true); }} className="rounded-[7px] border border-white/[0.05] bg-white/[0.018] py-1.5 text-[9px] font-black text-white/42">끝 {formatTime(loopEnd)}</button>
                    </div>
                  </div>
                </section>

                {/* TIMING */}
                <section className="rounded-[16px] border border-white/[0.075] bg-[#0d1120]/88 p-3">
                  <p className="text-[9px] font-black tracking-[0.14em] text-white/23">TIMING</p>
                  <h3 className="mt-0.5 text-[11px] font-black text-white/68">그리드 기준</h3>

                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <label className="rounded-[8px] border border-white/[0.05] bg-black/[0.10] p-2">
                      <span className="block text-[6px] font-black text-white/22">BPM</span>
                      <input
                        type="number"
                        min={30}
                        max={300}
                        step={1}
                        value={Math.round(chart.bpm || song.bpm)}
                        onChange={(event) => updateEditorTiming(Number(event.target.value), chart.offset)}
                        className="mt-0.5 w-full bg-transparent text-[10px] font-black text-white/68 outline-none"
                      />
                    </label>
                    <label className="rounded-[8px] border border-white/[0.05] bg-black/[0.10] p-2">
                      <span className="block text-[6px] font-black text-white/22">OFFSET (sec)</span>
                      <input
                        type="number"
                        min={-5}
                        max={5}
                        step={0.001}
                        value={Number(chart.offset || 0).toFixed(3)}
                        onChange={(event) => updateEditorTiming(chart.bpm, Number(event.target.value))}
                        className="mt-0.5 w-full bg-transparent text-[10px] font-black text-white/68 outline-none"
                      />
                    </label>
                  </div>

                  <div className="mt-2 flex items-center justify-between rounded-[8px] border border-white/[0.045] bg-white/[0.015] px-2 py-1.5">
                    <span className="text-[9px] font-bold text-white/24">스냅 기준</span>
                    <span className="text-[9px] font-black text-violet-100/48">1/{snapDivision} · {snapEnabled ? "ON" : "OFF"}</span>
                  </div>
                </section>

                {/* SELECTED NOTE */}
                <section className="rounded-[16px] border border-white/[0.075] bg-[#0d1120]/88 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black tracking-[0.14em] text-white/23">SELECTED NOTE</p>
                      <h3 className="mt-0.5 text-[11px] font-black text-white/68">선택 노트</h3>
                    </div>
                    {selectedEditorNote && <span className={`rounded-[6px] px-2 py-1 text-[10px] font-black ${selectedEditorNote.lane === "A" ? "bg-cyan-400/[0.12] text-cyan-50/65" : "bg-fuchsia-400/[0.12] text-fuchsia-50/65"}`}>{selectedEditorNote.lane}</span>}
                  </div>

                  {selectedEditorNote ? (
                    <div className="mt-2 space-y-2">
                      <label className="block rounded-[8px] border border-white/[0.05] bg-black/[0.10] p-2">
                        <span className="block text-[6px] font-black text-white/22">TIME (sec)</span>
                        <input
                          type="number"
                          min={0}
                          max={duration}
                          step={0.001}
                          value={selectedEditorNote.time.toFixed(3)}
                          onChange={(event) => setEditorNoteTime(selectedEditorNote.id, Number(event.target.value))}
                          className="mt-0.5 w-full bg-transparent font-mono text-[11px] font-black text-white/72 outline-none"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-1.5">
                        {KEYS.map((lane) => (
                          <button
                            key={lane}
                            type="button"
                            onClick={() => setEditorNoteLane(selectedEditorNote.id, lane)}
                            className={`rounded-[8px] border py-2 text-[11px] font-black ${selectedEditorNote.lane === lane ? lane === "A" ? "border-cyan-100/22 bg-cyan-400/[0.12] text-cyan-50/72" : "border-fuchsia-100/22 bg-fuchsia-400/[0.12] text-fuchsia-50/72" : "border-white/[0.05] bg-white/[0.018] text-white/40"}`}
                          >
                            {lane}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditorNoteDuration(selectedEditorNote.id, 0)}
                          className={`rounded-[8px] border py-2 text-[9px] font-black ${!selectedEditorNote.duration || selectedEditorNote.duration <= 0.04 ? "border-violet-200/16 bg-violet-400/[0.08] text-violet-50/62" : "border-white/[0.05] bg-white/[0.018] text-white/38"}`}
                        >
                          일반 노트
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorNoteDuration(selectedEditorNote.id, Math.max(0.5, Number(selectedEditorNote.duration) || 0.5))}
                          className={`rounded-[8px] border py-2 text-[9px] font-black ${Number(selectedEditorNote.duration) > 0.04 ? "border-fuchsia-200/16 bg-fuchsia-400/[0.08] text-fuchsia-50/62" : "border-white/[0.05] bg-white/[0.018] text-white/38"}`}
                        >
                          홀드 노트
                        </button>
                      </div>

                      {Number(selectedEditorNote.duration) > 0.04 && (
                        <label className="block rounded-[8px] border border-white/[0.05] bg-black/[0.10] p-2">
                          <span className="block text-[6px] font-black text-white/22">HOLD LENGTH (sec)</span>
                          <input
                            type="number"
                            min={0.05}
                            max={Math.max(0.05, duration - selectedEditorNote.time)}
                            step={0.01}
                            value={Number(selectedEditorNote.duration || 0.5).toFixed(2)}
                            onChange={(event) => setEditorNoteDuration(selectedEditorNote.id, Number(event.target.value))}
                            className="mt-0.5 w-full bg-transparent font-mono text-[11px] font-black text-white/72 outline-none"
                          />
                        </label>
                      )}

                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { label: "-50", delta: -0.05 },
                          { label: "-10", delta: -0.01 },
                          { label: "+10", delta: 0.01 },
                          { label: "+50", delta: 0.05 },
                        ].map((control) => (
                          <button key={control.label} type="button" onClick={() => nudgeEditorNote(selectedEditorNote.id, control.delta)} className="rounded-[7px] border border-white/[0.05] bg-white/[0.018] py-1.5 text-[9px] font-black text-white/42">{control.label}ms</button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button type="button" onClick={quantizeSelectedEditorNote} className="rounded-[8px] border border-violet-200/[0.08] bg-violet-400/[0.035] py-2 text-[9px] font-black text-violet-50/48">1/{snapDivision} 정렬</button>
                        <button type="button" onClick={() => removeEditorNote(selectedEditorNote.id)} className="rounded-[8px] border border-rose-200/[0.08] bg-rose-400/[0.025] py-2 text-[9px] font-black text-rose-100/45">삭제</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-[10px] border border-dashed border-white/[0.07] bg-black/[0.08] px-3 py-6 text-center">
                      <p className="text-xl text-white/18">⌖</p>
                      <p className="mt-1 text-[10px] font-black text-white/42">선택된 노트가 없습니다.</p>
                      <p className="mt-1 text-[9px] font-bold leading-4 text-white/18">타임라인 또는 노트 목록에서 노트를 클릭하세요.</p>
                    </div>
                  )}
                </section>

                {/* PLAY IMAGE */}
                <section className="overflow-hidden rounded-[16px] border border-white/[0.075] bg-[#0d1120]/88">
                  <div className="border-b border-white/[0.055] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black tracking-[0.14em] text-white/23">
                          PLAY IMAGE
                        </p>
                        <h3 className="mt-0.5 text-[12px] font-black text-white/72">
                          노래 이미지 설정
                        </h3>
                      </div>

                      <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[8px] font-black text-white/28">
                        JPG · PNG · WEBP
                      </span>
                    </div>

                    <p className="mt-1.5 text-[9px] font-bold leading-4 text-white/30">
                      이 이미지는 곡 목록·플레이 화면 좌상단 사진·정적 배경에 함께 사용됩니다.
                      MP4 곡은 플레이 중 영상이 배경으로 나오고, 이 이미지는 곡 사진과 영상 포스터로 유지됩니다.
                    </p>
                  </div>

                  <div className="p-3">
                    <button
                      type="button"
                      onClick={() => coverFileRef.current?.click()}
                      disabled={coverBusy}
                      className="group relative block aspect-[16/9] w-full overflow-hidden rounded-[12px] border border-dashed border-white/[0.10] bg-black/20 text-left transition hover:border-violet-200/22 disabled:cursor-wait disabled:opacity-45"
                    >
                      {currentCover ? (
                        <>
                          <img
                            src={currentCover.dataUrl}
                            alt={`${publishTitle.trim() || song.title} 플레이 이미지`}
                            draggable={false}
                            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.015]"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/10 to-black/10" />

                          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
                            <div className="min-w-0">
                              <p className="truncate text-[10px] font-black text-white/86">
                                {currentCover.fileName}
                              </p>
                              <p className="mt-0.5 text-[8px] font-bold text-white/38">
                                클릭해서 이미지 교체
                              </p>
                            </div>

                            <span className="shrink-0 rounded-[8px] border border-white/[0.10] bg-black/35 px-2 py-1 text-[9px] font-black text-white/62">
                              변경
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(139,92,246,.13),transparent_36%),linear-gradient(145deg,#090c17,#05060b)] px-4 text-center">
                          <span className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-violet-200/[0.12] bg-violet-400/[0.07] text-lg text-violet-100/52">
                            ＋
                          </span>
                          <p className="mt-2 text-[11px] font-black text-white/58">
                            플레이 이미지 등록
                          </p>
                          <p className="mt-1 text-[8px] font-bold text-white/24">
                            클릭해서 JPG / PNG / WebP 선택
                          </p>
                        </div>
                      )}

                      {coverBusy && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                          <span className="text-[10px] font-black text-violet-100/72">
                            이미지 처리 중…
                          </span>
                        </div>
                      )}
                    </button>

                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => coverFileRef.current?.click()}
                        disabled={coverBusy}
                        className="rounded-[8px] border border-violet-200/[0.10] bg-violet-400/[0.04] py-2 text-[9px] font-black text-violet-50/58 transition hover:border-violet-200/22 hover:bg-violet-400/[0.08] hover:text-violet-50/82 disabled:opacity-30"
                      >
                        {currentCover ? "이미지 교체" : "이미지 등록"}
                      </button>

                      <button
                        type="button"
                        onClick={removeCurrentCover}
                        disabled={!currentLocalCover || coverBusy}
                        className="rounded-[8px] border border-rose-200/[0.07] bg-rose-400/[0.025] py-2 text-[9px] font-black text-rose-100/42 transition hover:border-rose-200/[0.16] hover:text-rose-100/68 disabled:cursor-not-allowed disabled:opacity-20"
                      >
                        이미지 제거
                      </button>
                    </div>

                    <div className="mt-2 rounded-[8px] border border-white/[0.045] bg-black/[0.08] px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[8px] font-black text-white/24">
                          플레이 배경
                        </span>
                        <span
                          className={`text-[8px] font-black ${
                            playBackgroundIsMp4
                              ? "text-cyan-200/60"
                              : currentCover
                                ? "text-violet-100/54"
                                : "text-white/24"
                          }`}
                        >
                          {playBackgroundIsMp4
                            ? "MP4 VIDEO"
                            : currentCover
                              ? "IMAGE"
                              : "DEFAULT"}
                        </span>
                      </div>

                      <p className="mt-1 text-[8px] font-bold leading-4 text-white/25">
                        {playBackgroundIsMp4
                          ? "플레이 시 MP4 영상이 흐릿한 배경으로 재생됩니다. 설정 이미지는 좌상단 곡 사진과 포스터로 사용됩니다."
                          : currentCover
                            ? "플레이 시 설정 이미지가 흐릿한 전체 배경으로 표시되고, 사면은 검게 페이드됩니다."
                            : "이미지를 등록하면 플레이 배경과 곡 사진에 바로 적용됩니다."}
                      </p>
                    </div>

                    {coverMessage && (
                      <p className="mt-2 truncate text-[8px] font-bold text-white/30">
                        {coverMessage}
                      </p>
                    )}
                  </div>
                </section>

                {/* TITLE / STATUS */}
                <section className="rounded-[16px] border border-white/[0.075] bg-[#0d1120]/88 p-3">
                  <p className="text-[9px] font-black tracking-[0.14em] text-white/23">PUBLISH INFO</p>
                  <label className="mt-2 block">
                    <span className="text-[9px] font-black text-white/25">이용자에게 표시될 제목</span>
                    <input
                      type="text"
                      value={publishTitle}
                      onChange={(event) => {
                        setPublishTitle(event.target.value);
                        setEditorDirty(true);
                      }}
                      maxLength={80}
                      className="mt-1 w-full rounded-[8px] border border-white/[0.055] bg-black/[0.10] px-2.5 py-2 text-[11px] font-black text-white/60 outline-none focus:border-violet-200/18"
                    />
                  </label>

                  <div className="mt-2 rounded-[8px] border border-white/[0.045] bg-white/[0.015] px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-black text-white/22">상태</span>
                      <span className="text-[9px] font-black text-violet-100/48">{publishStage || (currentPublishedSong ? "PUBLISHED" : "DRAFT")}</span>
                    </div>
                  </div>

                  <p className="hoo-editor-scroll mt-2 max-h-20 overflow-auto rounded-[8px] border border-white/[0.045] bg-black/[0.08] px-2 py-1.5 text-[9px] font-bold leading-4 text-white/40">
                    {publishMessage || analysisMessage || cloudMessage || editorNotice}
                  </p>
                </section>

                <div className="rounded-[12px] border border-white/[0.055] bg-white/[0.018] px-3 py-2 text-[9px] font-bold leading-4 text-white/25">
                  <span className="font-black text-white/42">단축키</span> · A/K 노트 입력 · Space 재생/일시정지 · ←/→ 0.1초 이동 · Shift+←/→ 1초 · Ctrl+Z 되돌리기 · Ctrl+S 저장 · Ctrl+Enter 송출
                </div>
              </aside>
            </div>
          </main>
        )}
      </div>
    </section>,
    document.body,
  );
}

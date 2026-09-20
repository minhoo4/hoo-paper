export type MusicPick = {
  id: string;
  userId: string;
  nickname: string;
  title: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  createdAt: string;
  /** True only when the current signed-in user owns this recommendation. */
  canManage?: boolean;
};

export type MusicPalette = {
  accent: string;
  accentSoft: string;
  accentBright: string;
  accentDeep: string;
  warm: string;
  warmSoft: string;
  paper: string;
  ink: string;
};

const PALETTES: readonly MusicPalette[] = [
  {
    accent: "#ad81dd",
    accentSoft: "#d6b5f7",
    accentBright: "#f0dcff",
    accentDeep: "#573267",
    warm: "#c98246",
    warmSoft: "#f9c890",
    paper: "#fff4e7",
    ink: "#151115",
  },
  {
    accent: "#987ddb",
    accentSoft: "#c3b0f0",
    accentBright: "#e9e0ff",
    accentDeep: "#4c346e",
    warm: "#c58951",
    warmSoft: "#efc38e",
    paper: "#fbefe3",
    ink: "#171218",
  },
  {
    accent: "#b27ed0",
    accentSoft: "#d6acec",
    accentBright: "#f2deff",
    accentDeep: "#65406c",
    warm: "#ce8156",
    warmSoft: "#efb286",
    paper: "#fff0e7",
    ink: "#171115",
  },
  {
    accent: "#8b86db",
    accentSoft: "#c0b9f2",
    accentBright: "#e5e0ff",
    accentDeep: "#46416c",
    warm: "#c98f5a",
    warmSoft: "#efbc7e",
    paper: "#fff1df",
    ink: "#12151d",
  },
  {
    accent: "#9d79cc",
    accentSoft: "#c9a5e6",
    accentBright: "#e6d6f5",
    accentDeep: "#50366e",
    warm: "#d39b67",
    warmSoft: "#f2c894",
    paper: "#fff5e8",
    ink: "#161118",
  },
  {
    accent: "#9679c9",
    accentSoft: "#c6abea",
    accentBright: "#e8d5ff",
    accentDeep: "#4a3471",
    warm: "#b9794f",
    warmSoft: "#e2aa76",
    paper: "#f9ebdc",
    ink: "#151115",
  },
];

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getMusicPalette(seed: string | null | undefined): MusicPalette {
  return PALETTES[
    hashString(seed?.trim() || "hoo-music-community") % PALETTES.length
  ]!;
}

export function isYouTubeVideoId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value);
}

export function extractYouTubeVideoId(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  try {
    const url = new URL(
      /^https?:\/\//i.test(input) ? input : `https://${input}`,
    );
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    if (host === "youtu.be")
      return isYouTubeVideoId(parts[0]) ? parts[0] : null;
    if (
      ![
        "youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtube-nocookie.com",
      ].includes(host)
    )
      return null;
    const queryId = url.searchParams.get("v");
    if (
      (url.pathname === "/watch" || url.pathname === "/") &&
      isYouTubeVideoId(queryId)
    )
      return queryId;
    if (
      ["shorts", "live", "embed"].includes(parts[0] ?? "") &&
      isYouTubeVideoId(parts[1])
    )
      return parts[1];
  } catch {
    return null;
  }
  return null;
}

export function getYouTubeThumbnail(
  videoId: string,
  quality: "default" | "mq" | "hq" | "sd" | "max" = "hq",
): string {
  const names = {
    default: "default.jpg",
    mq: "mqdefault.jpg",
    hq: "hqdefault.jpg",
    sd: "sddefault.jpg",
    max: "maxresdefault.jpg",
  };
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${names[quality]}`;
}

export function buildYouTubeEmbedUrl(
  videoId: string,
  autoplay: boolean,
  origin?: string,
): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    controls: "1",
    enablejsapi: "1",
    playsinline: "1",
    rel: "0",
  });
  if (origin) params.set("origin", origin);
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

export function formatPickDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function formatRelativePickDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const difference = Math.max(0, Date.now() - date.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (difference < minute) return "방금 전";
  if (difference < hour) return `${Math.floor(difference / minute)}분 전`;
  if (difference < day) return `${Math.floor(difference / hour)}시간 전`;
  if (difference < day * 7) return `${Math.floor(difference / day)}일 전`;
  return formatPickDate(value);
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = String(rounded % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(
    minimum,
    Math.min(maximum, Number.isFinite(value) ? value : minimum),
  );
}

export function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function getInitialLetter(value: string | null | undefined): string {
  return Array.from(value?.trim() || "H")[0]!.toUpperCase();
}

export function getRecordCatalogNumber(pick: MusicPick | null): string {
  return `HOO-${String(hashString(pick?.youtubeVideoId ?? "HOO-MUSIC") % 9999).padStart(4, "0")}`;
}

export function getPickIndex(
  picks: MusicPick[],
  selectedPickId: string | null,
): number {
  if (!picks.length) return -1;
  const index = picks.findIndex((pick) => pick.id === selectedPickId);
  return index >= 0 ? index : 0;
}

export function getAdjacentPick(
  picks: MusicPick[],
  selectedPickId: string | null,
  direction: "previous" | "next",
): MusicPick | null {
  if (!picks.length) return null;
  const index = getPickIndex(picks, selectedPickId);
  return (
    picks[
      (index + (direction === "next" ? 1 : -1) + picks.length) % picks.length
    ] ?? null
  );
}

export function getCollectionSummary(picks: MusicPick[]) {
  return {
    total: picks.length,
    uniquePeople: new Set(picks.map((pick) => pick.userId)).size,
    latest: picks[0] ?? null,
  };
}

/** Validate API responses before they reach render/playback code. */
export function isMusicPick(value: unknown): value is MusicPick {
  if (!value || typeof value !== "object") return false;
  const pick = value as Record<string, unknown>;
  return (
    ["id", "userId", "nickname", "title", "youtubeUrl", "createdAt"].every(
      (key) => typeof pick[key] === "string",
    ) &&
    Boolean(pick.id) &&
    Boolean(pick.title) &&
    isYouTubeVideoId(pick.youtubeVideoId) &&
    (typeof pick.canManage === "undefined" || typeof pick.canManage === "boolean")
  );
}

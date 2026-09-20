"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import HooTurntable, {
  PosterFoliage,
  ToneArm,
  VinylRecord,
} from "./HooTurntable";
import {
  clamp,
  extractYouTubeVideoId,
  formatPickDate,
  getAdjacentPick,
  getInitialLetter,
  getMusicPalette,
  getYouTubeThumbnail,
  isMusicPick,
  normalizeTitle,
  type MusicPick,
} from "./hooMusicCommunityVisuals";
import styles from "./HooMusicCommunity.module.css";

// Keep the existing public exports and parent component contract.
export * from "./hooMusicCommunityVisuals";
export type HooMusicCommunityProps = {
  isLoggedIn: boolean;
  nickname: string | null;
  /** Controls foreground-only UI/data refresh; audio playback is allowed to continue off-screen. */
  isActive?: boolean;
};

const PICKS_ENDPOINT = "/api/community/music-picks";
const PLAYLIST_LIMIT = 60;
const FAVORITES_KEY = "hoo-music-favorites:v1";
const REFRESH_INTERVAL = 30_000;

type IconName =
  | "play"
  | "pause"
  | "previous"
  | "next"
  | "arrow"
  | "back"
  | "plus"
  | "close"
  | "search"
  | "refresh"
  | "heart"
  | "shuffle"
  | "repeat"
  | "volume"
  | "mute"
  | "external";
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    play: "M8 5v14l11-7Z",
    pause: "M8 5v14M16 5v14",
    previous: "M6 5v14M18 5 8 12l10 7Z",
    next: "M18 5v14M6 5l10 7-10 7Z",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    back: "M20 12H4m6-6-6 6 6 6",
    plus: "M12 5v14M5 12h14",
    close: "m6 6 12 12M18 6 6 18",
    search: "M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
    refresh:
      "M20 10a8 8 0 0 0-14-4L3 9m0-6v6h6M4 14a8 8 0 0 0 14 4l3-3m0 6v-6h-6",
    heart:
      "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
    shuffle:
      "M3 5h3c5 0 7 14 12 14h3m-4-4 4 4-4 4M3 19h3c2 0 4-3 5-5m2-4c2-3 3-5 5-5h3m-4-4 4 4-4 4",
    repeat:
      "m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3",
    volume: "M3 9v6h4l5 4V5L7 9Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14",
    mute: "M3 9v6h4l5 4V5L7 9Zm13 0 5 6m0-6-5 6",
    external:
      "M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill={name === "play" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={name === "pause" ? 3.5 : 1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span
      className={styles.equalizer}
      data-playing={playing}
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function Artwork({ videoId }: { videoId: string }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  return (
    <span className={styles.artwork} aria-hidden="true">
      {failedId === videoId ? (
        <span className={styles.artworkFallback}>HOO</span>
      ) : (
        <img
          src={getYouTubeThumbnail(videoId, "mq")}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedId(videoId)}
        />
      )}
    </span>
  );
}

type YouTubePlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getVideoUrl(): string;
  setVolume(value: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
};
type YouTubeEvent = { target: YouTubePlayer; data: number };
type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      videoId?: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: { target: YouTubePlayer }) => void;
        onStateChange: (event: YouTubeEvent) => void;
        onError: (event: YouTubeEvent) => void;
        onAutoplayBlocked: () => void;
      };
    },
  ) => YouTubePlayer;
};
type YouTubeWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};
let youtubeApiPromise: Promise<YouTubeApi> | null = null;

/** One shared API script; do not overwrite a player loaded elsewhere in HOO. */
function loadYouTubeApi(): Promise<YouTubeApi> {
  const page = window as YouTubeWindow;
  if (page.YT?.Player) return Promise.resolve(page.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousReady = page.onYouTubeIframeAPIReady;
    let finished = false;
    let poll = 0;
    let timeout = 0;
    let script = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    const owned = !script;
    function finish(error?: Error) {
      if (finished) return;
      if (!error && !page.YT?.Player) return;
      finished = true;
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      script?.removeEventListener("error", onError);
      if (page.onYouTubeIframeAPIReady === ready)
        page.onYouTubeIframeAPIReady = previousReady;
      if (error) {
        if (owned) script?.remove();
        reject(error);
      } else if (page.YT) resolve(page.YT);
    }
    function onError() {
      finish(new Error("YouTube에 연결하지 못했어요. 다시 시도해주세요."));
    }
    function ready() {
      try {
        previousReady?.();
      } finally {
        finish();
      }
    }
    page.onYouTubeIframeAPIReady = ready;
    poll = window.setInterval(() => finish(), 100);
    timeout = window.setTimeout(onError, 15_000);
    if (!script) {
      script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.addEventListener("error", onError, { once: true });
      document.head.appendChild(script);
    } else script.addEventListener("error", onError, { once: true });
  }).catch((error: unknown) => {
    youtubeApiPromise = null;
    throw error;
  });
  return youtubeApiPromise;
}

type PlaybackState = {
  ready: boolean;
  playing: boolean;
  buffering: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  blocked: boolean;
  error: string;
};
const INITIAL_PLAYBACK: PlaybackState = {
  ready: false,
  playing: false,
  buffering: false,
  time: 0,
  duration: 0,
  volume: 76,
  muted: false,
  blocked: false,
  error: "",
};

function useYouTubePlayer(
  active: boolean,
  videoId: string | undefined,
  onEnded: () => void,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const readyRef = useRef(false);
  const desired = useRef<{ id: string | undefined; play: boolean }>({
    id: videoId,
    play: false,
  });
  const settings = useRef({ volume: 76, muted: false });
  const ended = useRef(onEnded);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<PlaybackState>(INITIAL_PLAYBACK);
  useEffect(() => {
    ended.current = onEnded;
  }, [onEnded]);

  const select = useCallback((id: string, play: boolean) => {
    desired.current = { id, play };
    setState((s) => ({
      ...s,
      time: 0,
      duration: 0,
      playing: false,
      buffering: play,
      error: "",
      blocked: false,
    }));
    const player = playerRef.current;
    if (player && readyRef.current) {
      if (play) player.loadVideoById(id);
      else player.cueVideoById(id);
    }
  }, []);

  useEffect(() => {
    if (videoId && desired.current.id !== videoId) select(videoId, false);
    if (!videoId) {
      desired.current = { id: undefined, play: false };
      if (readyRef.current) playerRef.current?.pauseVideo();
      setState((s) => ({
        ...s,
        playing: false,
        buffering: false,
        time: 0,
        duration: 0,
      }));
    }
  }, [videoId, select]);

  useEffect(() => {
    if (!active) {
      setState((s) => ({
        ...s,
        ready: false,
        playing: false,
        buffering: false,
        time: 0,
        duration: 0,
      }));
      return;
    }
    if (!hostRef.current) return;
    const host = hostRef.current;
    const node = document.createElement("div");
    host.replaceChildren(node);
    let disposed = false;
    let instance: YouTubePlayer | null = null;
    let tick = 0;
    let readyTimeout = 0;
    setState((s) => ({
      ...s,
      ready: false,
      playing: false,
      buffering: false,
      error: "",
      blocked: false,
    }));
    function sync() {
      if (disposed || !readyRef.current || !instance || document.hidden) return;
      const time = instance.getCurrentTime();
      const duration = instance.getDuration();
      const volume = instance.getVolume();
      const muted = instance.isMuted();
      setState((s) => ({
        ...s,
        time: Number.isFinite(time) ? time : 0,
        duration: Number.isFinite(duration) ? duration : 0,
        volume: Number.isFinite(volume) ? volume : s.volume,
        muted,
      }));
      settings.current = { volume, muted };
    }
    void loadYouTubeApi()
      .then((api) => {
        if (disposed) return;
        readyTimeout = window.setTimeout(() => {
          if (!disposed && !readyRef.current)
            setState((s) => ({
              ...s,
              playing: false,
              buffering: false,
              error:
                "영상 플레이어가 응답하지 않아요. 다시 연결하거나 YouTube에서 들어주세요.",
            }));
        }, 18_000);
        instance = new api.Player(node, {
          width: "100%",
          height: "100%",
          videoId: desired.current.id,
          playerVars: {
            autoplay: 0,
            playsinline: 1,
            controls: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: ({ target }) => {
              if (disposed) return;
              window.clearTimeout(readyTimeout);
              playerRef.current = target;
              readyRef.current = true;
              const frame = target.getIframe();
              frame.title = "HOO MUSIC PICK · YouTube 원본 영상";
              frame.setAttribute(
                "referrerpolicy",
                "strict-origin-when-cross-origin",
              );
              target.setVolume(settings.current.volume);
              if (settings.current.muted) target.mute();
              const request = desired.current;
              if (request.id) {
                if (request.play)
                  target.loadVideoById(request.id);
                else target.cueVideoById(request.id);
              }
              setState((s) => ({ ...s, ready: true }));
              tick = window.setInterval(sync, 400);
              sync();
            },
            onStateChange: ({ data, target }) => {
              if (disposed) return;
              const currentId = extractYouTubeVideoId(target.getVideoUrl());
              if (currentId && currentId !== desired.current.id) return;
              setState((s) => ({
                ...s,
                playing: data === 1,
                buffering: data === 3,
                blocked: data === 1 ? false : s.blocked,
                error: data === 1 ? "" : s.error,
              }));
              sync();
              if (data === 0) ended.current();
            },
            onError: ({ data }) => {
              if (disposed) return;
              window.clearTimeout(readyTimeout);
              const messages: Record<number, string> = {
                2: "영상 링크를 확인해주세요.",
                5: "이 브라우저에서 영상을 재생할 수 없어요.",
                100: "삭제되었거나 비공개인 영상이에요.",
                101: "외부 재생이 제한된 곡이에요. YouTube에서 들어주세요.",
                150: "외부 재생이 제한된 곡이에요. YouTube에서 들어주세요.",
                153: "YouTube가 사이트 정보를 확인하지 못했어요. 원본 링크로 들어주세요.",
              };
              desired.current.play = false;
              setState((s) => ({
                ...s,
                playing: false,
                buffering: false,
                error:
                  messages[data] ??
                  "영상을 재생하지 못했어요. 다른 곡을 선택해주세요.",
              }));
            },
            onAutoplayBlocked: () => {
              if (!disposed)
                setState((s) => ({
                  ...s,
                  playing: false,
                  buffering: false,
                  blocked: true,
                }));
            },
          },
        });
      })
      .catch((error: unknown) => {
        if (!disposed)
          setState((s) => ({
            ...s,
            playing: false,
            buffering: false,
            error:
              error instanceof Error
                ? error.message
                : "YouTube 연결에 실패했어요.",
          }));
      });
    return () => {
      disposed = true;
      readyRef.current = false;
      desired.current.play = false;
      window.clearInterval(tick);
      window.clearTimeout(readyTimeout);
      instance?.destroy();
      playerRef.current = null;
      host.replaceChildren();
    };
  }, [active, retry]);

  function toggle() {
    const player = playerRef.current;
    if (!videoId || !player || !readyRef.current) return;
    if (player.getPlayerState() === 1 || player.getPlayerState() === 3) {
      desired.current.play = false;
      player.pauseVideo();
    } else {
      desired.current.play = true;
      setState((s) => ({ ...s, blocked: false, error: "" }));
      player.playVideo();
    }
  }
  function seek(seconds: number) {
    if (!readyRef.current || state.duration <= 0) return;
    const time = clamp(seconds, 0, state.duration);
    playerRef.current?.seekTo(time, true);
    setState((s) => ({ ...s, time }));
  }
  function setVolume(volume: number) {
    if (!readyRef.current) return;
    const next = clamp(volume, 0, 100);
    settings.current = { volume: next, muted: next === 0 };
    playerRef.current?.setVolume(next);
    if (next > 0) playerRef.current?.unMute();
    else playerRef.current?.mute();
    setState((s) => ({ ...s, volume: next, muted: next === 0 }));
  }
  function toggleMute() {
    if (!readyRef.current) return;
    if (state.muted || state.volume === 0) {
      if (state.volume === 0) setVolume(76);
      playerRef.current?.unMute();
      settings.current.muted = false;
      setState((s) => ({ ...s, muted: false }));
    } else {
      playerRef.current?.mute();
      settings.current.muted = true;
      setState((s) => ({ ...s, muted: true }));
    }
  }
  return {
    ...state,
    hostRef,
    select,
    toggle,
    seek,
    setVolume,
    toggleMute,
    reconnect: () => setRetry((n) => n + 1),
  };
}

function requestLogin() {
  window.dispatchEvent(
    new CustomEvent("hoo-open-auth-modal", { detail: { mode: "login" } }),
  );
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  if (
    !(response.headers.get("content-type") ?? "").includes("application/json")
  )
    throw new Error("서버 응답을 확인할 수 없어요. 잠시 뒤 다시 시도해주세요.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("서버 응답 형식이 올바르지 않아요.");
  return data as Record<string, unknown>;
}

function Composer({
  nickname,
  isLoggedIn,
  onClose,
  onSaved,
}: {
  nickname: string | null;
  isLoggedIn: boolean;
  onClose: () => void;
  onSaved: (pick: MusicPick) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const modalRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const titleId = useId();
  const errorId = useId();
  const videoId = extractYouTubeVideoId(url);
  const displayNickname = nickname?.trim() || "HOO";
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    mounted.current = true;
    const prior =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = modalRef.current;
    dialog?.showModal();
    return () => {
      mounted.current = false;
      abort.current?.abort();
      dialog?.close();
      prior?.focus({ preventScroll: true });
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    if (!isLoggedIn) {
      onClose();
      requestLogin();
      return;
    }
    const cleanTitle = normalizeTitle(title);
    if (!cleanTitle || cleanTitle.length > 80 || !videoId) {
      setError("80자 이내의 제목과 올바른 YouTube 링크를 입력해주세요.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    abort.current = new AbortController();
    try {
      const response = await fetch(PICKS_ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        signal: abort.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        }),
      });
      if (response.status === 401) {
        onClose();
        requestLogin();
        return;
      }
      const data = await readJson(response);
      if (!response.ok || !isMusicPick(data.pick))
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "추천곡을 등록하지 못했어요.",
        );
      if (mounted.current) onSaved(data.pick);
    } catch (caught) {
      if (
        mounted.current &&
        !(caught instanceof DOMException && caught.name === "AbortError")
      )
        setError(
          caught instanceof Error
            ? caught.message
            : "추천곡을 등록하지 못했어요.",
        );
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return createPortal(
    <dialog
      ref={modalRef}
      className={styles.composer}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!savingRef.current) closeRef.current();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || savingRef.current) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <div className={styles.composerHeading}>
        <div>
          <p className={styles.eyebrow}>당신의 노래추천</p>
          <h2 id={titleId}>{displayNickname}의 추천곡</h2>
          <p>누군가의 하루에, 당신의 음악을.</p>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="등록 창 닫기"
          disabled={saving}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <form onSubmit={submit} className={styles.composerForm}>
        <label className={styles.field}>
          <span>
            곡 제목 <small>{title.length}/80</small>
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="이 곡에 붙일 제목"
            required
            autoFocus
            disabled={saving}
          />
        </label>
        <label className={styles.field}>
          <span>YouTube 링크</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtu.be/..."
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            maxLength={2048}
            required
            disabled={saving}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(url && !videoId)}
          />
        </label>
        <div className={styles.composerPreview}>
          {videoId ? (
            <Artwork videoId={videoId} />
          ) : (
            <span className={styles.previewRecord} />
          )}
          <div>
            <strong>
              {normalizeTitle(title) || "당신의 노래추천"}
            </strong>
            <span>{displayNickname}의 추천곡</span>
          </div>
        </div>
        {error && (
          <p className={styles.formError} id={errorId} role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className={styles.submitButton}
          disabled={saving || !videoId || !normalizeTitle(title)}
        >
          <span>{saving ? "레코드를 올리는 중…" : "추천곡 남기기"}</span>
          <Icon name="arrow" />
        </button>
      </form>
    </dialog>,
    document.body,
  );
}

export default function HooMusicCommunity({
  isLoggedIn,
  nickname,
  isActive = true,
}: HooMusicCommunityProps) {
  const [view, setView] = useState<"landing" | "player">("landing");
  const [picks, setPicks] = useState<MusicPick[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"all" | "one" | "off">("all");
  const [toast, setToast] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const historyRef = useRef<string[]>([]);
  const selected =
    picks.find((pick) => pick.id === selectedId) ?? picks[0] ?? null;
  const palette = getMusicPalette(selected?.youtubeVideoId);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const visiblePicks = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("ko-KR");
    return picks.filter(
      (pick) =>
        (!savedOnly || favoriteSet.has(pick.id)) &&
        (!search ||
          `${pick.title} ${pick.nickname}`
            .toLocaleLowerCase("ko-KR")
            .includes(search)),
    );
  }, [query, picks, savedOnly, favoriteSet]);

  function nextAfterEnd() {
    if (!selected) return;
    if (repeat === "one") {
      playback.select(selected.youtubeVideoId, true);
      return;
    }
    if (!shuffle && repeat === "off" && picks.at(-1)?.id === selected.id)
      return;
    if (picks.length === 1 && repeat === "off") return;
    move("next");
  }
  const playback = useYouTubePlayer(
    view === "player",
    selected?.youtubeVideoId,
    nextAfterEnd,
  );

  const loadPicks = useCallback(async (initial = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const generation = ++generationRef.current;
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const response = await fetch(
        `${PICKS_ENDPOINT}?limit=${PLAYLIST_LIMIT}`,
        {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        },
      );
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "추천곡을 불러오지 못했어요.",
        );
      if (!Array.isArray(data.picks))
        throw new Error("추천곡 목록의 형식이 올바르지 않아요.");
      const unique = new Map<string, MusicPick>();
      for (const pick of data.picks)
        if (isMusicPick(pick)) unique.set(pick.id, pick);
      const next = [...unique.values()].slice(0, PLAYLIST_LIMIT);
      if (
        controller.signal.aborted ||
        !mountedRef.current ||
        generation !== generationRef.current
      )
        return;
      setPicks(next);
      setSelectedId((current) =>
        next.some((p) => p.id === current) ? current : (next[0]?.id ?? null),
      );
      setLoadError("");
    } catch (caught) {
      if (
        !controller.signal.aborted &&
        mountedRef.current &&
        generation === generationRef.current
      )
        setLoadError(
          caught instanceof Error
            ? caught.message
            : "추천곡을 불러오지 못했어요.",
        );
    } finally {
      if (mountedRef.current && generation === generationRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!isActive) return;
    void loadPicks(true);
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadPicks();
    }, REFRESH_INTERVAL);
    function onVisible() {
      if (!document.hidden) void loadPicks();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      requestRef.current?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadPicks, isActive]);
  useEffect(() => {
    function restore() {
      try {
        const saved: unknown = JSON.parse(
          localStorage.getItem(FAVORITES_KEY) || "[]",
        );
        setFavorites(
          Array.isArray(saved)
            ? saved
                .filter((id): id is string => typeof id === "string")
                .slice(0, 500)
            : [],
        );
      } catch {
        setFavorites([]);
      }
    }
    function sync(event: StorageEvent) {
      if (event.key === FAVORITES_KEY) restore();
    }
    restore();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3300);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!isActive) setComposerOpen(false);
  }, [isActive]);

  function select(pick: MusicPick) {
    if (selected?.id === pick.id) {
      if (playback.ready) playback.toggle();
      else playback.select(pick.youtubeVideoId, true);
      return;
    }
    if (selected)
      historyRef.current = [...historyRef.current.slice(-199), selected.id];
    setSelectedId(pick.id);
    playback.select(pick.youtubeVideoId, true);
  }
  function move(direction: "previous" | "next") {
    if (!selected) return;
    if (direction === "previous" && playback.time > 3) {
      playback.seek(0);
      return;
    }
    let next: MusicPick | null = null;
    if (direction === "previous" && shuffle) {
      while (historyRef.current.length && !next) {
        const previousId = historyRef.current.pop();
        next = picks.find((pick) => pick.id === previousId) ?? null;
      }
    }
    if (!next && shuffle && direction === "next" && picks.length > 1) {
      const choices = picks.filter((pick) => pick.id !== selected.id);
      next = choices[Math.floor(Math.random() * choices.length)] ?? null;
    }
    next ??= getAdjacentPick(picks, selected.id, direction);
    if (!next) return;
    if (direction === "next")
      historyRef.current = [...historyRef.current.slice(-199), selected.id];
    setSelectedId(next.id);
    playback.select(next.youtubeVideoId, true);
  }
  function toggleFavorite(id: string) {
    const next = favoriteSet.has(id)
      ? favorites.filter((value) => value !== id)
      : [...favorites, id].slice(-500);
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      setToast(
        "지금은 보관함을 저장할 수 없어요. 브라우저 저장 공간을 확인해주세요.",
      );
    }
  }
  function openComposer() {
    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    setComposerOpen(true);
  }
  function saved(pick: MusicPick) {
    // Invalidate an older GET so it cannot erase the just-created record.
    requestRef.current?.abort();
    generationRef.current += 1;
    setLoading(false);
    setRefreshing(false);
    setPicks((current) =>
      [pick, ...current.filter((p) => p.id !== pick.id)].slice(
        0,
        PLAYLIST_LIMIT,
      ),
    );
    setSelectedId(pick.id);
    playback.select(pick.youtubeVideoId, false);
    setComposerOpen(false);
    setView("player");
    setSavedOnly(false);
    setQuery("");
    setLoadError("");
    setToast("당신의 한 곡이 레코드 선반에 놓였어요.");
  }
  function enter() {
    setView("player");
    window.requestAnimationFrame(() =>
      titleRef.current?.focus({ preventScroll: true }),
    );
  }
  function leave() {
    setView("landing");
    window.requestAnimationFrame(() =>
      enterRef.current?.focus({ preventScroll: true }),
    );
  }
  const status = playback.error
    ? "재생 확인 필요"
    : playback.buffering
      ? "불러오는 중"
      : playback.playing
        ? "NOW PLAYING"
        : "PRESS PLAY";
  const rootStyle = {
    "--music-accent": palette.accent,
    "--music-accent-soft": palette.accentSoft,
    "--music-accent-bright": palette.accentBright,
    "--music-accent-deep": palette.accentDeep,
    "--music-warm": palette.warm,
    "--music-warm-soft": palette.warmSoft,
  } as CSSProperties;

  return (
    <section
      ref={rootRef}
      className={styles.root}
      style={rootStyle}
      data-view={view}
      aria-label="HOO 음악 커뮤니티"
    >
      <div className={styles.ambient} aria-hidden="true" />
      {view === "landing" ? (
        <div className={styles.landing}>
          <div className={styles.landingCopy}>
            <p className={styles.eyebrow}>HOO COMMUNITY</p>
            <h2 className={styles.landingTitle}>
              HOO-PLAY <span>LIST</span>
            </h2>
            <p className={styles.landingSubtitle}>
              (후플리) · 음악으로 이어지는 새로운 공간
            </p>
            <button
              ref={enterRef}
              type="button"
              className={styles.enterButton}
              onClick={enter}
            >
              <span>지금, 음악과 연결되기</span>
              <Icon name="arrow" />
            </button>
          </div>
          <div className={styles.posterColumn}>
            <article
              className={styles.poster}
              aria-label="Music Connects Us 레코드 포스터"
            >
              <div className={styles.posterGrain} aria-hidden="true" />
              <header className={styles.posterHeader}>
                <span>HOO COMMUNITY</span>
                <span>
                  GOOD
                  <br />
                  MUSIC
                  <br />
                  BETTER
                  <br />
                  PEOPLE
                </span>
              </header>
              <p className={styles.posterScript}>
                Music
                <br />
                <span>Connects Us</span>
              </p>
              <div className={styles.posterRecord}>
                <VinylRecord />
              </div>
              <div className={styles.posterArm}>
                <ToneArm engaged />
              </div>
              <PosterFoliage />
              <span className={styles.posterBottomLight} aria-hidden="true" />
            </article>
          </div>
        </div>
      ) : (
        <div className={styles.playerLayout}>
          <header className={styles.playerIntro}>
            <button
              type="button"
              onClick={leave}
              className={styles.returnButton}
            >
              <Icon name="back" />
              <span>HOO COMMUNITY</span>
            </button>
            <h2 ref={titleRef} tabIndex={-1} className={styles.playerTitle}>
              MUSIC <span>PICK</span>
            </h2>
            <p>좋은 음악이, 좋은 사람을 만듭니다.</p>
          </header>

          <aside className={styles.playlist} aria-label="추천곡 목록">
            <div className={styles.playlistHeading}>
              <div className={styles.listTabs}>
                <button
                  type="button"
                  className={styles.listTab}
                  aria-pressed={!savedOnly}
                  onClick={() => setSavedOnly(false)}
                >
                  추천곡 <small>{picks.length}</small>
                </button>
                <button
                  type="button"
                  className={styles.savedTab}
                  aria-label="이 기기에 보관한 곡"
                  title="이 기기에 보관한 곡"
                  aria-pressed={savedOnly}
                  onClick={() => setSavedOnly((v) => !v)}
                >
                  <Icon name="heart" />
                </button>
              </div>
              <div className={styles.listActions}>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="곡 검색"
                  aria-expanded={searchOpen}
                  onClick={() => setSearchOpen((v) => !v)}
                >
                  <Icon name="search" />
                </button>
                <button
                  type="button"
                  className={`${styles.iconButton} ${refreshing ? styles.refreshing : ""}`}
                  aria-label="추천곡 새로고침"
                  disabled={refreshing || loading}
                  onClick={() => void loadPicks()}
                >
                  <Icon name="refresh" />
                </button>
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={openComposer}
                >
                  <Icon name="plus" />
                  <span>곡 남기기</span>
                </button>
              </div>
            </div>
            {searchOpen && (
              <div className={styles.searchBox}>
                <Icon name="search" />
                <input
                  aria-label="제목 또는 추천자 검색"
                  placeholder="곡 제목 또는 추천자"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="검색 닫기"
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                >
                  <Icon name="close" />
                </button>
              </div>
            )}
            {loadError && (
              <div className={styles.listError} role="alert">
                <p>{loadError}</p>
                <button type="button" onClick={() => void loadPicks()}>
                  다시 불러오기
                </button>
              </div>
            )}
            <div
              className={styles.playlistScroll}
              onWheel={(event) => event.stopPropagation()}
            >
              {loading && !picks.length ? (
                <div
                  className={styles.loadingRows}
                  role="status"
                  aria-label="추천곡을 불러오는 중"
                >
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} />
                  ))}
                </div>
              ) : visiblePicks.length ? (
                <ul className={styles.trackList}>
                  {visiblePicks.map((pick) => {
                    const chosen = selected?.id === pick.id;
                    const playing = chosen && playback.playing;
                    return (
                      <li
                        key={pick.id}
                        className={styles.trackRow}
                        data-selected={chosen}
                      >
                        <button
                          type="button"
                          className={styles.trackSelect}
                          onClick={() => select(pick)}
                          aria-label={`${pick.title} · ${pick.nickname} ${playing ? "일시정지" : "재생"}`}
                          aria-pressed={chosen}
                        >
                          <span className={styles.trackCover}>
                            <Artwork videoId={pick.youtubeVideoId} />
                            <span className={styles.trackPlay}>
                              <Icon name={playing ? "pause" : "play"} />
                            </span>
                          </span>
                          <span className={styles.trackCopy}>
                            <span className={styles.trackTitle}>
                              {pick.title}
                            </span>
                            <span className={styles.trackByline}>
                              <span className={styles.avatar}>
                                {getInitialLetter(pick.nickname)}
                              </span>
                              <span>{pick.nickname}</span>
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.favoriteButton}
                          aria-label={`${pick.title} ${favoriteSet.has(pick.id) ? "보관 해제" : "이 기기에 보관"}`}
                          aria-pressed={favoriteSet.has(pick.id)}
                          onClick={() => toggleFavorite(pick.id)}
                        >
                          <Icon name="heart" />
                        </button>
                        <span
                          className={styles.trackEnd}
                          title={formatPickDate(pick.createdAt)}
                        >
                          {chosen ? (
                            <Equalizer playing={playing} />
                          ) : (
                            <span className={styles.trackDots}>···</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                !loadError && (
                  <div className={styles.emptyState}>
                    <span className={styles.previewRecord} aria-hidden="true" />
                    <p>
                      {query
                        ? "찾는 곡이 아직 없어요."
                        : savedOnly
                          ? "마음에 드는 곡을 보관해보세요."
                          : "첫 번째 레코드의 주인공이 되어주세요."}
                    </p>
                    {!query && !savedOnly && (
                      <button type="button" onClick={openComposer}>
                        첫 곡 남기기 <Icon name="arrow" />
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
            <p className={styles.playlistFootnote}>
              {savedOnly
                ? "이 브라우저에 보관한 음악"
                : "오늘 누군가의 플레이리스트가 되는 곳"}
            </p>
          </aside>

          <div className={styles.turntablePanel}>
            <HooTurntable
              pick={selected}
              palette={palette}
              isPlaying={playback.playing}
              currentTime={playback.time}
              duration={playback.duration}
              onSeek={playback.seek}
            />
            <div className={styles.transport} aria-label="재생 제어">
              <button
                type="button"
                className={styles.transportSmall}
                aria-label="셔플"
                aria-pressed={shuffle}
                disabled={picks.length < 2}
                onClick={() => setShuffle((v) => !v)}
              >
                <Icon name="shuffle" />
              </button>
              <button
                type="button"
                className={styles.transportSkip}
                aria-label="이전 곡"
                disabled={!selected || !playback.ready}
                onClick={() => move("previous")}
              >
                <Icon name="previous" />
              </button>
              <button
                type="button"
                className={styles.playButton}
                aria-label={
                  playback.playing || playback.buffering ? "일시정지" : "재생"
                }
                disabled={!selected || !playback.ready}
                onClick={playback.toggle}
                data-loading={playback.buffering}
              >
                <Icon
                  name={
                    playback.playing || playback.buffering ? "pause" : "play"
                  }
                />
              </button>
              <button
                type="button"
                className={styles.transportSkip}
                aria-label="다음 곡"
                disabled={!selected || !playback.ready}
                onClick={() => move("next")}
              >
                <Icon name="next" />
              </button>
              <button
                type="button"
                className={styles.transportSmall}
                aria-label={`반복: ${repeat === "all" ? "전체" : repeat === "one" ? "한 곡" : "꺼짐"}`}
                aria-pressed={repeat !== "off"}
                onClick={() =>
                  setRepeat((v) =>
                    v === "all" ? "one" : v === "one" ? "off" : "all",
                  )
                }
              >
                <Icon name="repeat" />
                {repeat === "one" && (
                  <span className={styles.repeatOne}>1</span>
                )}
              </button>
            </div>
            <div className={styles.playbackMeta}>
              <span
                className={styles.playbackStatus}
                data-playing={playback.playing}
              >
                <i />
                {status}
              </span>
              <div className={styles.volumeControl}>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={playback.muted ? "음소거 해제" : "음소거"}
                  aria-pressed={playback.muted}
                  disabled={!playback.ready}
                  onClick={playback.toggleMute}
                >
                  <Icon
                    name={
                      playback.muted || playback.volume === 0
                        ? "mute"
                        : "volume"
                    }
                  />
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={playback.muted ? 0 : playback.volume}
                  aria-label="음량"
                  disabled={!playback.ready}
                  onChange={(e) => playback.setVolume(Number(e.target.value))}
                />
              </div>
            </div>
            {(playback.error || playback.blocked) && (
              <p className={styles.playerNotice} role="status">
                {playback.error ||
                  "재생 버튼이나 아래 YouTube 영상의 재생 버튼을 눌러주세요."}
                {playback.error && (
                  <button type="button" onClick={playback.reconnect}>
                    다시 연결
                  </button>
                )}
              </p>
            )}
          </div>

          <aside className={styles.sourcePanel} aria-label="YouTube 원본 영상">
            <div className={styles.sourceHeading}>
              <span>YouTube</span>
              {selected && (
                <a
                  href={`https://www.youtube.com/watch?v=${selected.youtubeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube에서 원본 열기"
                >
                  <Icon name="external" />
                </a>
              )}
            </div>
            <div className={styles.sourceScreen}>
              <div ref={playback.hostRef} className={styles.sourceHost} />
              {!selected && (
                <div className={styles.sourceEmpty}>한 곡을 골라주세요.</div>
              )}
            </div>
            <p className={styles.sourceCaption}>함께 듣는 오늘의 음악</p>
            <p className={styles.sleeveSignature}>
              Good Music.
              <br />
              Better People.
            </p>
          </aside>
        </div>
      )}
      {toast && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}
      {composerOpen && (
        <Composer
          nickname={nickname}
          isLoggedIn={isLoggedIn}
          onClose={() => setComposerOpen(false)}
          onSaved={saved}
        />
      )}
    </section>
  );
}

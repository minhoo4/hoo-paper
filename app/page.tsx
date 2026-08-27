"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";
import FocusMode from "@/components/FocusMode/FocusMode";

import HooCommunityPanel from "@/components/HooCommunityPanel";

import {
  useHooWorldPresence,
} from "@/components/HooWorld/hooks/useHooWorldPresence";

import BackgroundSettings from "@/components/BackgroundSettings";

import PushNotificationButton from "./PushNotificationButton";

import Hoo2048Game from "@/components/Hoo2048Game";
import HooShisenGame from "@/components/HooShisenGame";
import Hoo1952Game from "@/components/Hoo1952Game";
import HooBubbleGame from "@/components/HooBubbleGame";
import {
  createPuzzleId,
  submitSudokuCompletion,
} from "@/lib/community";

import { createClient } from "@/lib/supabase/client";

import {
  createScheduleDates,
  type ScheduleRepeatType,
} from "./utils/scheduleRepeat";

import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Settings,
  X,
} from "lucide-react";

/* ─────────────────────────────
   타입
───────────────────────────── */

type ScheduleStickerColor =
  | "yellow"
  | "green"
  | "pink"
  | "blue"
  | "purple"
  | "orange";

type Schedule = {
  id: string;
  groupId: string;
  title: string;
  content: string;
  date: string;
  repeatType: ScheduleRepeatType;
  createdAt: string;
  isSecret: boolean;

  /*
   * 기존에 저장된 일정에는 색상값이 없으므로
   * 마이그레이션 전까지 선택값으로 처리한다.
   */
  stickerColor?:
    ScheduleStickerColor;
};

type ScheduleMap = Record<string, Schedule[]>;

type Memo = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  isSecret: boolean;
};

type Notice = {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};
type Favorite = {
  id: number;
  name: string;
  url: string;
  icon: string;
};

type TodoTaskType =
  | "manual"
  | "schedule"
  | "preparation"
  | "recommendation";

type TodoItem = {
  id: string;
  content: string;
  completed: boolean;
  source: "user" | "hoo";
  taskDate?: string;
  taskType?: TodoTaskType;
  gameId?: string;
  scheduleId?: string;
  generatedAt?: string;
  archivedAt?: string;
  generationReason?: string;
  createdAt: string;
};

type HooBriefingStatus =
  | "pending"
  | "generating"
  | "completed"
  | "failed";

type HooDailyBriefing = {
  id: string;
  briefingDate: string;

  morningTitle: string;
  morningContent: string;
  morningGeneratedAt?: string;
  morningReadAt?: string;
  morningStatus: HooBriefingStatus;

  eveningTitle?: string;
  eveningContent?: string;
  eveningGeneratedAt?: string;
  eveningReadAt?: string;
  eveningStatus?: HooBriefingStatus;

  totalTodoCount: number;
  completedTodoCount: number;
  incompleteTodoCount: number;
  completionRate: number;
};


type HooContextMessageType =
  | "schedule_preparation"
  | "weather_care"
  | "sunset"
  | "routine_respect"
  | "condition_care"
  | "gentle_encouragement";


type HooContextMessageStatus =
  | "pending"
  | "delivered"
  | "read"
  | "dismissed"
  | "expired";

type HooContextMessage = {
  id: string;
  messageDate: string;
  messageType: HooContextMessageType;
  title: string;
  content: string;
  scheduledFor: string;
  expiresAt: string;
  priority: number;
  status: HooContextMessageStatus;
  dedupeKey: string;
};


type HooRoutineCandidate = {
  id: string;
  name: string;

  routineType:
    | "commute"
    | "work"
    | "study"
    | "sleep"
    | "meal"
    | "exercise"
    | "social"
    | "care"
    | "protected"
    | "other";

  daysOfWeek: number[];

  startTime?: string;
  endTime?: string;

  confidence: number;

  status:
    | "candidate"
    | "needs_confirmation"
    | "confirmed"
    | "rejected"
    | "inactive";

  protectFromSuggestions: boolean;
  observationCount: number;

  inferenceReason?: string;
};


type HooWeatherPreference = {
  weatherEnabled: boolean;

  /*
   * 서버에는 정확한 원본 위치가 아닌
   * 소수점 둘째 자리의 대략적 좌표만 저장한다.
   */
  latitude?: number;
  longitude?: number;

  locationName?: string;
  timezone: string;

  locationSource:
    HooWeatherLocationSource;

  backgroundWeatherEnabled: boolean;

  locationProcessingMode:
    | "ephemeral_coarse"
    | "persisted_coarse";

  /*
   * 정확한 원본 위치는 최대 60초 동안만
   * 브라우저 메모리에서 처리한다.
   */
  rawLocationRetentionSeconds: number;

  storeLocationHistory: false;

  consentedAt?: string;
};

type HooWeatherPermissionStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

type HooLiveLocationStatus =
  | "inactive"
  | "starting"
  | "active"
  | "paused"
  | "error";

type HooSessionLocation = {
  /*
   * 정확한 GPS 좌표가 아니라
   * 약 1km 단위로 낮춘 좌표만
   * 메모리에 잠시 보관한다.
   */
  latitude: number;
  longitude: number;

  accuracyMeters: number;
  capturedAt: string;
  expiresAt: string;
};

type HooWeatherLocationSource =
  | "browser"
  | "manual"
  | "default"
  | "device_ephemeral"
  | "device_coarse";


type HooWeatherSnapshot = {
  forecastAt: string;
  provider: string;
  weatherCode?: number;
  temperatureCelsius?: number;
  apparentTemperatureCelsius?: number;
  relativeHumidity?: number;
  precipitationProbability?: number;
  cloudCover?: number;
  windSpeedKmh?: number;
  isDay?: boolean;
  sunriseAt?: string;
  sunsetAt?: string;
};

type HooRecommendedTask = {
  gameId: string;
  gameName: string;
  content: string;
  enabled: boolean;
};

type SudokuDifficulty = "easy" | "normal" | "hard";
type SudokuBoard = number[][];
type SudokuCell = { row: number; column: number };

type SudokuBestTimes = Record<
  SudokuDifficulty,
  number | null
>;

type MinigameScreen =
  | "menu"
  | "sudoku"
  | "2048"
  | "shisen"
  | "1952"
  | "bubble";

type Hoo2048Difficulty =
  | "easy"
  | "normal"
  | "hard"
  | "buddha";

type Hoo2048BestScores = Record<
  Hoo2048Difficulty,
  number
>;

/* ─────────────────────────────
   기본값
───────────────────────────── */

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const SCHEDULE_STORAGE_KEY =
  "hoo-calendar-schedules";

const MEMO_STORAGE_KEY =
  "hoo-memos";

const UI_OPACITY_STORAGE_KEY =
  "hoo-ui-opacity";

const FOCUS_ALARM_VOLUME_STORAGE_KEY =
  "hoo-focus-alarm-volume";

const SECRET_PIN_STORAGE_KEY =
  "hoo-secret-pin";
  
const FAVORITE_STORAGE_KEY = "hoo-favorites";

const TODO_STORAGE_KEY = "hoo-todos";

const SUDOKU_BEST_TIMES_STORAGE_KEY =
  "hoo-sudoku-best-times";

  const HOO2048_BEST_SCORES_STORAGE_KEY =
  "hoo-2048-best-scores";

const RECOMMENDED_TODO_STORAGE_KEY =
  "hoo-recommended-todo-completed";

  const MINIGAME_COMPLETION_COUNT_STORAGE_KEY =
  "hoo-minigame-completion-count";

  const MINIGAME_COMPLETION_DATE_STORAGE_KEY =
  "hoo-minigame-completion-date";

const HOO_RECOMMENDED_TASKS: HooRecommendedTask[] = [
  {
    gameId: "minigame",
    gameName: "미니게임",
    content: "미니게임 2판하기",
    enabled: true,
  },
];

/* ─────────────────────────────
   공통 함수
───────────────────────────── */

function getTodayStorageDate() {
  const koreaDateParts =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

  const year = Number(
    koreaDateParts.find(
      (part) => part.type === "year",
    )?.value,
  );

  const month = Number(
    koreaDateParts.find(
      (part) => part.type === "month",
    )?.value,
  );

  const day = Number(
    koreaDateParts.find(
      (part) => part.type === "day",
    )?.value,
  );

  return createDateKey(
    year,
    month - 1,
    day,
  );
}

function isHooEveningBriefingTime() {
  if (
    typeof window !== "undefined" &&
    process.env.NODE_ENV === "development" &&
    window.localStorage.getItem(
      "hoo-evening-briefing-test",
    ) === "true"
  ) {
    return true;
  }

  const koreaHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );

  return koreaHour >= 21;
}


function createId() {
  if (
    typeof window !== "undefined" &&
    window.crypto?.randomUUID
  ) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function createDateKey(
  year: number,
  month: number,
  day: number,
) {
  return `${year}-${String(month + 1).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return {
    year,
    month,
    day,
  };
}

function formatTimer(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

const SCHEDULE_STICKER_COLORS: Array<{
  value: ScheduleStickerColor;
  label: string;
  previewClassName: string;
}> = [
  {
    value: "yellow",
    label: "노란색",
    previewClassName:
      "bg-[#ffe48c]",
  },
  {
    value: "green",
    label: "초록색",
    previewClassName:
      "bg-[#bdecc8]",
  },
  {
    value: "pink",
    label: "분홍색",
    previewClassName:
      "bg-[#ffc4d8]",
  },
  {
    value: "blue",
    label: "파란색",
    previewClassName:
      "bg-[#cbd9ff]",
  },
  {
    value: "purple",
    label: "보라색",
    previewClassName:
      "bg-[#d8c7ff]",
  },
  {
    value: "orange",
    label: "주황색",
    previewClassName:
      "bg-[#ffc98f]",
  },
];

function getStickerClass(
  stickerColorOrIndex:
    | ScheduleStickerColor
    | number = "yellow",
  index = 0,
) {
  const rotationClasses = [
    "-rotate-1",
    "rotate-1",
    "-rotate-[0.5deg]",
    "rotate-[0.5deg]",
  ];

  const colorClasses: Record<
    ScheduleStickerColor,
    string
  > = {
    yellow:
      "bg-[#ffe48c]",
    green:
      "bg-[#bdecc8]",
    pink:
      "bg-[#ffc4d8]",
    blue:
      "bg-[#cbd9ff]",
    purple:
      "bg-[#d8c7ff]",
    orange:
      "bg-[#ffc98f]",
  };

  /*
   * 기존 호출:
   * getStickerClass(index)
   *
   * 새 호출:
   * getStickerClass(
   *   schedule.stickerColor,
   *   index,
   * )
   */
  const isLegacyCall =
    typeof stickerColorOrIndex ===
    "number";

  const resolvedIndex =
    isLegacyCall
      ? stickerColorOrIndex
      : index;

  const legacyColors:
    ScheduleStickerColor[] = [
      "yellow",
      "green",
      "pink",
      "blue",
    ];

  const resolvedColor:
    ScheduleStickerColor =
      isLegacyCall
        ? legacyColors[
            resolvedIndex %
              legacyColors.length
          ]
        : stickerColorOrIndex;

  return [
    colorClasses[
      resolvedColor
    ],
    rotationClasses[
      resolvedIndex %
        rotationClasses.length
    ],
  ].join(" ");
}

function getScheduleVisual(
  schedule: Schedule,
) {
  const colorClasses: Record<
    ScheduleStickerColor,
    string
  > = {
    yellow:
      "border-[#e2c45d] bg-[#ffe48c] text-[#66531d]",

    green:
      "border-[#83c99a] bg-[#bdecc8] text-[#285f3b]",

    pink:
      "border-[#e89ab6] bg-[#ffc4d8] text-[#7a3550]",

    blue:
      "border-[#96addf] bg-[#cbd9ff] text-[#304d83]",

    purple:
      "border-[#ad91df] bg-[#d8c7ff] text-[#533c82]",

    orange:
      "border-[#e9a966] bg-[#ffc98f] text-[#75441d]",
  };

  const stickerColor =
    schedule.stickerColor ??
    "yellow";

  const className =
    colorClasses[
      stickerColor
    ] ??
    colorClasses.yellow;

  switch (
    schedule.repeatType
  ) {
    case "dailyRange":
      return {
        icon: "━",
        label: "연속 일정",
        className,
      };

    case "weekly":
      return {
        icon: "↻",
        label: "매주 반복",
        className,
      };

    case "monthly":
      return {
        icon: "▣",
        label: "매달 반복",
        className,
      };

    default:
      return {
        icon: "",
        label: "하루 일정",
        className,
      };
  }
}


function createDefaultFavorites(): Favorite[] {
  return Array.from({ length: 8 }, (_, index) => ({
    id: index,
    name: "",
    url: "",
    icon: "",
  }));
}

function normalizeFavorites(value: unknown): Favorite[] {
  const savedFavorites = Array.isArray(value) ? value : [];

  return Array.from({ length: 8 }, (_, index) => {
    const savedFavorite = savedFavorites[index];

    if (
      savedFavorite &&
      typeof savedFavorite === "object"
    ) {
      const favorite = savedFavorite as Partial<Favorite>;

      return {
        id: index,
        name:
          typeof favorite.name === "string"
            ? favorite.name
            : "",
        url:
          typeof favorite.url === "string"
            ? favorite.url
            : "",
        icon:
          typeof favorite.icon === "string"
            ? favorite.icon
            : "",
      };
    }

    return {
      id: index,
      name: "",
      url: "",
      icon: "",
    };
  });
}

/* ─────────────────────────────
   스도쿠 함수
───────────────────────────── */

const SUDOKU_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function copySudokuBoard(board: SudokuBoard): SudokuBoard {
  return board.map((row) => [...row]);
}

function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [
      result[randomIndex],
      result[index],
    ];
  }

  return result;
}

function createSudokuSolution(): SudokuBoard {
  const base = 3;
  const side = base * base;
  const pattern = (row: number, column: number) =>
    (base * (row % base) + Math.floor(row / base) + column) % side;

  const rowGroups = shuffleArray([0, 1, 2]);
  const columnGroups = shuffleArray([0, 1, 2]);
  const rows = rowGroups.flatMap((group) =>
    shuffleArray([0, 1, 2]).map((row) => group * base + row),
  );
  const columns = columnGroups.flatMap((group) =>
    shuffleArray([0, 1, 2]).map((column) => group * base + column),
  );
  const numbers = shuffleArray(SUDOKU_NUMBERS);

  return rows.map((row) =>
    columns.map((column) => numbers[pattern(row, column)]),
  );
}

function getSudokuEmptyCount(difficulty: SudokuDifficulty) {
  if (difficulty === "hard") return 52;
  if (difficulty === "normal") return 44;
  return 36;
}

function generateSudokuGame(difficulty: SudokuDifficulty) {
  const solution = createSudokuSolution();
  const puzzle = copySudokuBoard(solution);
  const positions = shuffleArray(
    Array.from({ length: 81 }, (_, index) => index),
  );

  positions
    .slice(0, getSudokuEmptyCount(difficulty))
    .forEach((position) => {
      puzzle[Math.floor(position / 9)][position % 9] = 0;
    });

  return { puzzle, solution };
}

function formatSudokuTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getSudokuDifficultyLabel(difficulty: SudokuDifficulty) {
  if (difficulty === "hard") return "어려움";
  if (difficulty === "normal") return "보통";
  return "쉬움";
}

/* ─────────────────────────────
   메인
───────────────────────────── */


export default function Home() {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

 const [
  isLoggedIn,
  setIsLoggedIn,
] = useState(false);

const [
  loggedInNickname,
  setLoggedInNickname,
] = useState<string | null>(
  null,
);

const [
  profileImageUrl,
  setProfileImageUrl,
] = useState<string | null>(
  null,
);

/*
 * HOO WORLD 권한 설정
 *
 * null  = 로그인/권한 확인 중
 * true  = HOO WORLD 권한 수락
 * false = HOO WORLD 권한 미수락
 *
 * 권한을 수락한 사용자는 /hoo-world 페이지에
 * 직접 들어가지 않아도 Presence에 계속 존재한다.
 */
const [
  isHooWorldConnected,
  setIsHooWorldConnected,
] = useState<boolean | null>(null);

const [
  isHooWorldJoinPromptOpen,
  setIsHooWorldJoinPromptOpen,
] = useState(false);

const HOO_WORLD_PERMISSION_KEY =
  "hoo-world-permission";

const HOO_WORLD_PROMPT_DISABLED_KEY =
  "hoo-world-prompt-disabled";


  useEffect(() => {
    let cancelled = false;

    async function loadLoginProfile() {
      try {
        const {
          data: {
            session,
          },
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const user =
          session?.user ?? null;

        if (!user) {
          if (!cancelled) {
            setIsLoggedIn(false);
            setLoggedInNickname(null);
            setProfileImageUrl(null);
          }

          return;
        }

        const {
          data: profile,
          error: profileError,
        } =
          await supabase
            .from("profiles")
            .select(
              `
                nickname,
                profile_image_url
              `,
            )
            .eq(
              "id",
              user.id,
            )
            .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (cancelled) {
          return;
        }

        setIsLoggedIn(true);

        setLoggedInNickname(
          typeof profile?.nickname ===
            "string" &&
            profile.nickname.trim()
            ? profile.nickname.trim()
            : user.email?.split("@")[0] ??
                "MY PROFILE",
        );

        setProfileImageUrl(
          typeof profile?.profile_image_url ===
            "string" &&
            profile.profile_image_url.trim()
            ? profile.profile_image_url.trim()
            : null,
        );
      } catch (error) {
        console.error(
          "로그인 사용자 정보를 불러오지 못했습니다.",
          error,
        );

        if (!cancelled) {
          setIsLoggedIn(false);
          setLoggedInNickname(null);
          setProfileImageUrl(null);
        }
      }
    }

    void loadLoginProfile();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        () => {
          void loadLoginProfile();
        },
      );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };


 }, [
  supabase,
]);

/* ─────────────────────────────
   HOO WORLD 권한 상태
───────────────────────────── */

useEffect(() => {
  if (!isLoggedIn) {
    setIsHooWorldConnected(null);
    setIsHooWorldJoinPromptOpen(false);
    return;
  }

  const savedPermission =
    window.localStorage.getItem(
      HOO_WORLD_PERMISSION_KEY,
    );

  if (savedPermission === "accepted") {
    setIsHooWorldConnected(true);
    setIsHooWorldJoinPromptOpen(false);
    return;
  }

  const promptDisabled =
    window.localStorage.getItem(
      HOO_WORLD_PROMPT_DISABLED_KEY,
    ) === "true";

  if (
    savedPermission === "declined" ||
    promptDisabled
  ) {
    setIsHooWorldConnected(false);
    setIsHooWorldJoinPromptOpen(false);
    return;
  }

  setIsHooWorldConnected(null);
  setIsHooWorldJoinPromptOpen(true);
}, [isLoggedIn]);

function handleJoinHooWorld() {
  window.localStorage.setItem(
    HOO_WORLD_PERMISSION_KEY,
    "accepted",
  );

  window.localStorage.removeItem(
    HOO_WORLD_PROMPT_DISABLED_KEY,
  );

  setIsHooWorldConnected(true);
  setIsHooWorldJoinPromptOpen(false);
}

function handleSkipHooWorld() {
  setIsHooWorldConnected(false);
  setIsHooWorldJoinPromptOpen(false);
}

function handleDisableHooWorldPrompt() {
  window.localStorage.setItem(
    HOO_WORLD_PERMISSION_KEY,
    "declined",
  );

  window.localStorage.setItem(
    HOO_WORLD_PROMPT_DISABLED_KEY,
    "true",
  );

  setIsHooWorldConnected(false);
  setIsHooWorldJoinPromptOpen(false);
}

/*
 * HOO WORLD 실시간 Presence
 *
 * isHooWorldConnected가 true일 때만
 * Supabase Realtime 채널에 접속한다.
 */
const {
  players: hooWorldPlayers,
  onlineCount: hooWorldOnlineCount,
  isConnected:
    isHooWorldPresenceConnected,
  status: hooWorldStatus,
  updateStatus:
    updateHooWorldStatus,
  updatePosition:
    updateHooWorldPosition,
} = useHooWorldPresence({
  enabled:
    isHooWorldConnected === true,

  nickname:
    loggedInNickname,
});

const today = useMemo(
  () => new Date(),
  [],
);


/* ─────────────────────────────
   프로필 닉네임 실시간 반영
───────────────────────────── */

/* 가로 스크롤 */

const horizontalSectionRef =
  useRef<HTMLElement | null>(null);

 const searchToggleButtonRef =
  useRef<HTMLButtonElement | null>(null);

const floatingButtonsTimerRef =
  useRef<number | null>(null);

const [floatingButtonsTarget, setFloatingButtonsTarget] =
  useState({
    x: 0,
    y: 0,
  });


  const [horizontalProgress, setHorizontalProgress] =
    useState(0);

  const [horizontalPage, setHorizontalPage] =
  useState<-1 | 0 | 1 | 2>(0);

  const isHorizontalAnimatingRef = useRef(false);



const [showMissionCompleteToast,
  setShowMissionCompleteToast] =
  useState(false);

  const [showTodoCompleteCelebration,
  setShowTodoCompleteCelebration] =
  useState(false);

  const [isSearchBarCollapsed, setIsSearchBarCollapsed] =
  useState(false);

 const [floatingButtonsDirection, setFloatingButtonsDirection] =
  useState<"toSearch" | "fromSearch" | null>(null);

const [showFloatingButtons, setShowFloatingButtons] =
  useState(true);
  
  const [showStickyHeader, setShowStickyHeader] =
    useState(false);

     const [backgroundUrl, setBackgroundUrl] =
    useState<string | null>(null);

  /* UI 및 포커스 알람 설정 */

const [
  isUiOpacityOpen,
  setIsUiOpacityOpen,
] = useState(false);

const [
  uiOpacity,
  setUiOpacity,
] = useState(100);

const [
  focusAlarmVolume,
  setFocusAlarmVolume,
] = useState(100);

const uiOpacityPanelRef =
  useRef<HTMLDivElement | null>(
    null,
  );

const uiOpacityButtonRef =
  useRef<HTMLButtonElement | null>(
    null,
  );

  /* 즐겨찾기 */

  const [favorites, setFavorites] = useState<Favorite[]>(
    createDefaultFavorites,
  );

  /* 투두리스트 */

const [todos, setTodos] =
  useState<TodoItem[]>([]);

const [todoContent, setTodoContent] =
  useState("");

const [
  isTodoCloudReady,
  setIsTodoCloudReady,
] = useState(false);

/*
 * HOO 아침 브리핑
 */
const [
  morningBriefing,
  setMorningBriefing,
] =
  useState<HooDailyBriefing | null>(
    null,
  );

const [
  isMorningBriefingLoading,
  setIsMorningBriefingLoading,
] = useState(true);

const [
  isMorningBriefingOpen,
  setIsMorningBriefingOpen,
] = useState(true);

/*
 * 메인 화면 중앙 브리핑 모달
 */
const [
  isBriefingModalOpen,
  setIsBriefingModalOpen,
] = useState(false);

const lastAutoBriefingKeyRef =
  useRef<string | null>(null);


  /*
 * HOO 예약 컨텍스트 메시지
 */
const [
  contextMessage,
  setContextMessage,
] =
  useState<HooContextMessage | null>(
    null,
  );

const [
  isContextMessageOpen,
  setIsContextMessageOpen,
] = useState(false);

const [
  isContextMessageLoading,
  setIsContextMessageLoading,
] = useState(false);

/*
 * 현재 메시지를 처리한 뒤
 * 다음 예약 메시지를 다시 조회하게 한다.
 */
const [
  contextMessageRefreshKey,
  setContextMessageRefreshKey,
] = useState(0);

/*
 * 같은 메시지가 한 화면에서
 * 반복적으로 열리는 것을 방지한다.
 */
const lastOpenedContextMessageIdRef =
  useRef<string | null>(null);

/*
 * 예약 시각에 다시 조회하기 위한 타이머다.
 */
const contextMessageTimerRef =
  useRef<number | null>(null);

/*
 * React 개발 모드나 탭 복귀 이벤트로
 * 메시지 조회가 동시에 실행되는 것을 막는다.
 */
const contextMessageLoadInFlightRef =
  useRef(false);


/*
 * HOO 반복 생활 후보
 */
const [
  routineCandidates,
  setRoutineCandidates,
] =
  useState<HooRoutineCandidate[]>(
    [],
  );

const [
  selectedRoutineCandidate,
  setSelectedRoutineCandidate,
] =
  useState<HooRoutineCandidate | null>(
    null,
  );

const [
  isRoutineConfirmationOpen,
  setIsRoutineConfirmationOpen,
] = useState(false);

const [
  routineStartTime,
  setRoutineStartTime,
] = useState("");

const [
  routineEndTime,
  setRoutineEndTime,
] = useState("");

const [
  shouldProtectRoutineTime,
  setShouldProtectRoutineTime,
] = useState(true);

const [
  isRoutineSaving,
  setIsRoutineSaving,
] = useState(false);


/*
 * HOO 날씨·위치 설정
 */
const [
  weatherPreference,
  setWeatherPreference,
] =
  useState<HooWeatherPreference | null>(
    null,
  );

const [
  currentWeather,
  setCurrentWeather,
] =
  useState<HooWeatherSnapshot | null>(
    null,
  );

const [
  weatherPermissionStatus,
  setWeatherPermissionStatus,
] =
  useState<HooWeatherPermissionStatus>(
    "idle",
  );

const [
  isWeatherConsentOpen,
  setIsWeatherConsentOpen,
] = useState(false);

const [
  isWeatherPreferenceLoading,
  setIsWeatherPreferenceLoading,
] = useState(true);

const [
  isWeatherLoading,
  setIsWeatherLoading,
] = useState(false);

const [
  weatherErrorMessage,
  setWeatherErrorMessage,
] = useState("");


/*
 * HOO 임시 위치 처리
 *
 * 위치는 메모리에만 존재하며
 * 최대 60초 후 자동으로 폐기한다.
 */
const [
  liveLocationStatus,
  setLiveLocationStatus,
] =
  useState<HooLiveLocationStatus>(
    "inactive",
  );

const [
  sessionLocation,
  setSessionLocation,
] =
  useState<HooSessionLocation | null>(
    null,
  );

/*
 * 브라우저 위치 감시 ID
 *
 * 현재 웹에서는 실시간 감시를
 * 바로 시작하지 않지만, 명시적인
 * 중단과 앱 확장을 위해 준비한다.
 */
const locationWatchIdRef =
  useRef<number | null>(null);

/*
 * 임시 위치 자동 폐기 타이머
 */
const locationExpiryTimerRef =
  useRef<number | null>(null);

/*
 * 너무 잦은 날씨 요청을 막기 위한
 * 마지막 갱신 시각
 */
const lastWeatherRefreshAtRef =
  useRef(0);

/*
 * 현재 화면에서 마지막으로 날씨를
 * 갱신한 날짜를 기억한다.
 *
 * 사이트 진입 시 한 번 갱신하고,
 * 화면을 계속 열어 둔 상태에서 날짜가 바뀌면
 * 새로운 위치를 단발성으로 다시 확인한다.
 */
const weatherRefreshDateRef =
  useRef("");



const [
  draggingTodoId,
  setDraggingTodoId,
] = useState<string | null>(null);

const [
  dragOverTodoId,
  setDragOverTodoId,
] = useState<string | null>(null);

const todoOrderDuringDragRef =
  useRef<TodoItem[] | null>(null);

const [isRecommendedTodoCompleted, setIsRecommendedTodoCompleted] =
  useState(false);

  const [minigameCompletionCount, setMinigameCompletionCount] =
  useState(0);

  /* 현재 시각 */

  const [currentTime, setCurrentTime] =
    useState<Date | null>(null);

  /* 캘린더 */

  const [currentYear, setCurrentYear] = useState(
    today.getFullYear(),
  );

  const [currentMonth, setCurrentMonth] = useState(
    today.getMonth(),
  );

  const [selectedDate, setSelectedDate] = useState(() =>
    createDateKey(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ),
  );

 const [schedules, setSchedules] =
  useState<ScheduleMap>({});

const [
  isScheduleCloudReady,
  setIsScheduleCloudReady,
] = useState(false);

const [selectedScheduleId, setSelectedScheduleId] =
  useState<string | null>(null);

  const [
  editingScheduleId,
  setEditingScheduleId,
] = useState<string | null>(null);

const scheduleDragStartXRef =
  useRef<number | null>(null);

const scheduleDragCurrentXRef =
  useRef<number | null>(null);

  const [scheduleSlideDirection, setScheduleSlideDirection] =
  useState<"left" | "right" | null>(null);

const [previousSchedule, setPreviousSchedule] =
  useState<Schedule | null>(null);

const [isScheduleSliding, setIsScheduleSliding] =
  useState(false);

const [
  scheduleTitle,
  setScheduleTitle,
] = useState("");

const [
  scheduleContent,
  setScheduleContent,
] = useState("");

const [
  scheduleStickerColor,
  setScheduleStickerColor,
] =
  useState<ScheduleStickerColor>(
    "yellow",
  );

const [
  isScheduleSecret,
  setIsScheduleSecret,
] = useState(false);


const [isSecretLayerOn, setIsSecretLayerOn] =
  useState(true);

  const [secretPin, setSecretPin] =
  useState("1234");

const [secretPinInput, setSecretPinInput] =
  useState("");

const [isSecretPinModalOpen, setIsSecretPinModalOpen] =
  useState(false);

  const [
  isSecretPinChangeModalOpen,
  setIsSecretPinChangeModalOpen,
] = useState(false);

const [currentSecretPinInput, setCurrentSecretPinInput] =
  useState("");

const [newSecretPinInput, setNewSecretPinInput] =
  useState("");

const [confirmSecretPinInput, setConfirmSecretPinInput] =
  useState("");

    const [
  scheduleRepeatType,
  setScheduleRepeatType,
] =
  useState<ScheduleRepeatType>("none");

const [
  scheduleEndDate,
  setScheduleEndDate,
] = useState("");

const [
  scheduleRepeatUntil,
  setScheduleRepeatUntil,
] = useState("");

const [
  isRepeatScheduleModalOpen,
  setIsRepeatScheduleModalOpen,
] = useState(false);

const [
  repeatScheduleModalType,
  setRepeatScheduleModalType,
] =
  useState<ScheduleRepeatType>(
    "dailyRange",
  );

  /* 메모 */

const [memos, setMemos] =
  useState<Memo[]>([]);

const [memoTitle, setMemoTitle] =
  useState("");

const [
  isMemoCloudReady,
  setIsMemoCloudReady,
] = useState(false);

const [isMemoSecret, setIsMemoSecret] =
  useState(false);

 /* 전달사항 */

const [notices, setNotices] = useState<Notice[]>([]);
const [isNoticesLoading, setIsNoticesLoading] =
  useState(true);
const [selectedNotice, setSelectedNotice] =
  useState<Notice | null>(null);
  const [isNoticeOpen, setIsNoticeOpen] =
  useState(false);
  
  const noticeRef = useRef<HTMLDivElement>(null);

const [hasUnreadNotice, setHasUnreadNotice] =
  useState(false);
  
const [isFeedbackOpen, setIsFeedbackOpen] =
  useState(false);

const feedbackRef = useRef<HTMLDivElement>(null);

const [feedbackContent, setFeedbackContent] =
  useState("");

  useEffect(() => {
  function handleFeedbackClickOutside(event: MouseEvent) {
    if (
      feedbackRef.current &&
      !feedbackRef.current.contains(event.target as Node)
    ) {
      setIsFeedbackOpen(false);
    }
  }

  document.addEventListener(
    "mousedown",
    handleFeedbackClickOutside,
  );

  return () => {
    document.removeEventListener(
      "mousedown",
      handleFeedbackClickOutside,
    );
  };
}, []);

/* ─────────────────────────────
   UI 불투명도 패널 닫기
───────────────────────────── */

useEffect(() => {
  function handleUiOpacityClickOutside(
    event: MouseEvent,
  ) {
    const target = event.target as Node;

    if (
      uiOpacityPanelRef.current &&
      !uiOpacityPanelRef.current.contains(target) &&
      uiOpacityButtonRef.current &&
      !uiOpacityButtonRef.current.contains(target)
    ) {
      setIsUiOpacityOpen(false);
    }
  }

  function handleUiOpacityEscape(
    event: KeyboardEvent,
  ) {
    if (event.key === "Escape") {
      setIsUiOpacityOpen(false);
    }
  }

  document.addEventListener(
    "mousedown",
    handleUiOpacityClickOutside,
  );

  document.addEventListener(
    "keydown",
    handleUiOpacityEscape,
  );

  return () => {
    document.removeEventListener(
      "mousedown",
      handleUiOpacityClickOutside,
    );

    document.removeEventListener(
      "keydown",
      handleUiOpacityEscape,
    );
  };
}, []);

  const [memoContent, setMemoContent] = useState("");
  const [editingMemoId, setEditingMemoId] = useState<
    string | null
  >(null);

  /* 타이머 */

  const [timerHours, setTimerHours] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);

  const [timerRemaining, setTimerRemaining] =
    useState(0);

  const [timerInitialSeconds, setTimerInitialSeconds] =
    useState(0);

  const [isTimerRunning, setIsTimerRunning] =
    useState(false);


/* 미니게임 화면 */

const [minigameScreen, setMinigameScreen] =
  useState<MinigameScreen>("menu");
const minigameLaunchTokenRef = useRef(0);

function openMinigame(
  target: Exclude<MinigameScreen, "menu">,
) {
  // 포털 기반 게임을 먼저 완전히 언마운트한 뒤 다음 프레임에
  // 선택한 게임만 마운트한다. 이전 1952 포털이 남는 현상을 차단한다.
  const launchToken = minigameLaunchTokenRef.current + 1;
  minigameLaunchTokenRef.current = launchToken;
  setMinigameScreen("menu");

  requestAnimationFrame(() => {
    if (minigameLaunchTokenRef.current !== launchToken) {
      return;
    }

    setMinigameScreen(target);
  });
}

function closeMinigame() {
  minigameLaunchTokenRef.current += 1;
  setMinigameScreen("menu");
}

useEffect(() => {
  if (minigameScreen !== "sudoku") {
    return;
  }

  const previousBodyOverflow =
    document.body.style.overflow;
  const previousHtmlOverflow =
    document.documentElement.style.overflow;

  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  return () => {
    document.body.style.overflow =
      previousBodyOverflow;
    document.documentElement.style.overflow =
      previousHtmlOverflow;
  };
}, [minigameScreen]);

const [hoo2048Difficulty, setHoo2048Difficulty] =
  useState<Hoo2048Difficulty>("easy");

const [hoo2048BestScores, setHoo2048BestScores] =
  useState<Hoo2048BestScores>({
    easy: 0,
    normal: 0,
    hard: 0,
    buddha: 0,
  });

  /* 스도쿠 */

  const [sudokuBestTimes, setSudokuBestTimes] =
  useState<SudokuBestTimes>({
    easy: null,
    normal: null,
    hard: null,
  });

  const [sudokuDifficulty, setSudokuDifficulty] =
    useState<SudokuDifficulty>("easy");

  const [sudokuPuzzle, setSudokuPuzzle] =
    useState<SudokuBoard>([]);

  const [sudokuBoard, setSudokuBoard] =
    useState<SudokuBoard>([]);

  const [sudokuSolution, setSudokuSolution] =
    useState<SudokuBoard>([]);

  const [selectedSudokuCell, setSelectedSudokuCell] =
    useState<SudokuCell | null>(null);

  const [sudokuHintCount, setSudokuHintCount] = useState(3);
  const [sudokuSeconds, setSudokuSeconds] = useState(0);
  const [isSudokuRunning, setIsSudokuRunning] = useState(false);
  const [isSudokuCompleted, setIsSudokuCompleted] = useState(false);
  const [sudokuPuzzleId, setSudokuPuzzleId] = useState("");
  const [sudokuSaveMessage, setSudokuSaveMessage] = useState("");
  const [isSudokuSaving, setIsSudokuSaving] = useState(false);
  const [communityRefreshKey, setCommunityRefreshKey] = useState(0);
  const submittedSudokuIdRef = useRef<string | null>(null);

  /* 저장소 로딩 */

  const [isLoaded, setIsLoaded] = useState(false);

  /* ─────────────────────────────
     현재 시각
  ───────────────────────────── */

  useEffect(() => {
    setCurrentTime(new Date());

    const clockInterval = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      window.clearInterval(clockInterval);
    };
  }, []);

  /* ─────────────────────────────
   사용자 배경 불러오기
───────────────────────────── */

useEffect(() => {
  let cancelled = false;

  const restoreDefaultBackground = () => {
    window.localStorage.removeItem(
      "hoo-background-url",
    );

    if (!cancelled) {
      setBackgroundUrl(null);
    }
  };

  async function loadBackground() {
    const cachedBackgroundUrl =
      window.localStorage.getItem(
        "hoo-background-url",
      );

    if (cachedBackgroundUrl) {
      setBackgroundUrl(
        cachedBackgroundUrl,
      );
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        return;
      }

      const { data, error } =
        await supabase
          .from("profiles")
          .select("background_url")
          .eq("id", user.id)
          .single();

      if (error) {
        console.warn(
          "저장된 배경 정보를 불러오지 못해 기본 배경을 사용합니다.",
          error,
        );
        restoreDefaultBackground();
        return;
      }

      const savedPath =
        data?.background_url;

      if (!savedPath) {
        window.localStorage.removeItem(
          "hoo-background-url",
        );

        if (!cancelled) {
          setBackgroundUrl(null);
        }

        return;
      }

      const {
        data: signedUrlData,
        error: signedUrlError,
      } = await supabase.storage
        .from("backgrounds")
        .createSignedUrl(
          savedPath,
          60 * 60 * 24 * 365,
        );

      if (
        signedUrlError ||
        !signedUrlData?.signedUrl
      ) {
        console.warn(
          "배경 이미지 주소를 만들지 못해 기본 배경을 사용합니다.",
          signedUrlError,
        );
        restoreDefaultBackground();
        return;
      }

      const latestBackgroundUrl =
        signedUrlData.signedUrl;

      const backgroundImage =
        new Image();

      backgroundImage.onload = () => {
        if (cancelled) {
          return;
        }

        window.localStorage.setItem(
          "hoo-background-url",
          latestBackgroundUrl,
        );

        setBackgroundUrl(
          latestBackgroundUrl,
        );
      };

      backgroundImage.onerror = () => {
        console.warn(
          "저장된 배경 이미지가 만료되었거나 존재하지 않아 기본 배경으로 복구합니다.",
        );
        restoreDefaultBackground();
      };

      backgroundImage.src =
        latestBackgroundUrl;
    } catch (error) {
      console.warn(
        "배경을 불러오는 중 문제가 발생해 기본 배경으로 복구합니다.",
        error,
      );
      restoreDefaultBackground();
    }
  }

  void loadBackground();

  return () => {
    cancelled = true;
  };
}, [supabase]);


/* ─────────────────────────────
   전달사항 불러오기
───────────────────────────── */

useEffect(() => {
  let cancelled = false;

  async function loadNotices() {
    try {
      const response = await fetch("/api/notices", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "공지를 불러오지 못했습니다.",
        );
      }

     if (!cancelled) {
  const loadedNotices = Array.isArray(data.notices)
    ? data.notices
    : [];

  const latestNotice = loadedNotices[0] ?? null;

setNotices(loadedNotices);
setSelectedNotice(latestNotice);

if (latestNotice) {
  const lastReadId = localStorage.getItem(
    "lastReadNoticeId",
  );

  setHasUnreadNotice(
    String(latestNotice.id) !== lastReadId,
  );
} else {
  setHasUnreadNotice(false);
}
}
    } catch (error) {
      console.error("전달사항 조회 실패:", error);

      if (!cancelled) {
        setNotices([]);
      }
    } finally {
      if (!cancelled) {
        setIsNoticesLoading(false);
      }
    }
  }

  void loadNotices();

  return () => {
    cancelled = true;
  };
}, []);

useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (
      noticeRef.current &&
      !noticeRef.current.contains(
        event.target as Node,
      )
    ) {
      setIsNoticeOpen(false);
    }
  }

  document.addEventListener(
    "mousedown",
    handleClickOutside,
  );

  return () => {
    document.removeEventListener(
      "mousedown",
      handleClickOutside,
    );
  };
}, []);

  /* ─────────────────────────────
     고정 헤더
  ───────────────────────────── */

  useEffect(() => {
  function handleScroll() {
    const shouldShowStickyHeader =
      window.scrollY > 420;

    setShowStickyHeader(
      shouldShowStickyHeader,
    );

    if (!shouldShowStickyHeader) {
      if (
        floatingButtonsTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          floatingButtonsTimerRef.current,
        );

        floatingButtonsTimerRef.current =
          null;
      }

      setIsSearchBarCollapsed(false);
      setShowFloatingButtons(true);
      setFloatingButtonsDirection(null);
    }
  }

  handleScroll();

  window.addEventListener(
    "scroll",
    handleScroll,
    {
      passive: true,
    },
  );

  return () => {
    window.removeEventListener(
      "scroll",
      handleScroll,
    );
  };
}, []);

  /* ─────────────────────────────
     캘린더 고정 및 가로 화면 전환
  ───────────────────────────── */

useEffect(() => {
  function handleWheel(event: WheelEvent) {
    const eventTarget =
      event.target instanceof Element
        ? event.target
        : null;

    const verticalScrollArea =
      eventTarget?.closest<HTMLElement>(
        '[data-hoo-vertical-scroll="true"]',
      );

    if (verticalScrollArea) {
      const canScrollUp =
        verticalScrollArea.scrollTop > 1;
      const canScrollDown =
        verticalScrollArea.scrollTop +
          verticalScrollArea.clientHeight <
        verticalScrollArea.scrollHeight - 1;

      if (
        (event.deltaY < 0 && canScrollUp) ||
        (event.deltaY > 0 && canScrollDown)
      ) {
        return;
      }
    }

    const section = horizontalSectionRef.current;

    if (!section) {
      return;
    }

    const sectionTop = section.offsetTop;
    const currentScroll = window.scrollY;
    const pinTolerance = 12;

    const enteringHorizontalSection =
      event.deltaY > 0 &&
      currentScroll >=
        sectionTop - window.innerHeight * 0.25 &&
      currentScroll < sectionTop - pinTolerance;

    if (enteringHorizontalSection) {
      event.preventDefault();

      setHorizontalPage(0);
      setHorizontalProgress(0);

      window.scrollTo({
        top: sectionTop,
        behavior: "auto",
      });

      return;
    }

    const isPinned =
      Math.abs(currentScroll - sectionTop) <=
      pinTolerance;

    if (!isPinned) {
      return;
    }

    event.preventDefault();

    window.scrollTo({
      top: sectionTop,
      behavior: "auto",
    });

    if (isHorizontalAnimatingRef.current) {
      return;
    }

    if (event.deltaY > 0 && horizontalPage < 2) {
      const nextPage = (horizontalPage + 1) as
        | -1
        | 0
        | 1
        | 2;

      isHorizontalAnimatingRef.current = true;
      setHorizontalPage(nextPage);
      setHorizontalProgress(nextPage);

      window.setTimeout(() => {
        isHorizontalAnimatingRef.current = false;
      }, 750);

      return;
    }

    if (event.deltaY < 0 && horizontalPage > -1) {
      const previousPage = (horizontalPage - 1) as
        | -1
        | 0
        | 1
        | 2;

      isHorizontalAnimatingRef.current = true;
      setHorizontalPage(previousPage);
      setHorizontalProgress(previousPage);

      window.setTimeout(() => {
        isHorizontalAnimatingRef.current = false;
      }, 750);

      return;
    }

    if (event.deltaY < 0 && horizontalPage === -1) {
      window.scrollTo({
        top: Math.max(
          0,
          sectionTop - window.innerHeight,
        ),
        behavior: "smooth",
      });
    }
  }

  window.addEventListener("wheel", handleWheel, {
    passive: false,
  });

  return () => {
    window.removeEventListener("wheel", handleWheel);
  };
}, [horizontalPage]);



  /* ─────────────────────────────
     저장 데이터 불러오기
  ───────────────────────────── */

  useEffect(() => {
    try {
      const savedSchedules = window.localStorage.getItem(
        SCHEDULE_STORAGE_KEY,
      );

      const savedMemos = window.localStorage.getItem(
        MEMO_STORAGE_KEY,
      );

     const savedUiOpacity =
  window.localStorage.getItem(
    UI_OPACITY_STORAGE_KEY,
  );

const savedFocusAlarmVolume =
  window.localStorage.getItem(
    FOCUS_ALARM_VOLUME_STORAGE_KEY,
  );

const savedSecretPin =
  window.localStorage.getItem(
    SECRET_PIN_STORAGE_KEY,
  );


      const savedFavorites = window.localStorage.getItem(
        FAVORITE_STORAGE_KEY,
      );

      const savedSudokuBestTimes =
  window.localStorage.getItem(
    SUDOKU_BEST_TIMES_STORAGE_KEY,
  );

  const savedHoo2048BestScores =
  window.localStorage.getItem(
    HOO2048_BEST_SCORES_STORAGE_KEY,
  );

  if (savedSudokuBestTimes) {
  const parsedBestTimes = JSON.parse(
    savedSudokuBestTimes,
  ) as Partial<SudokuBestTimes>;

  setSudokuBestTimes({
    easy:
      typeof parsedBestTimes.easy === "number"
        ? parsedBestTimes.easy
        : null,
    normal:
      typeof parsedBestTimes.normal === "number"
        ? parsedBestTimes.normal
        : null,
    hard:
      typeof parsedBestTimes.hard === "number"
        ? parsedBestTimes.hard
        : null,
  });
}

if (savedHoo2048BestScores) {
  const parsedBestScores = JSON.parse(
    savedHoo2048BestScores,
  ) as Partial<Hoo2048BestScores>;

  setHoo2048BestScores({
    easy:
      typeof parsedBestScores.easy === "number"
        ? parsedBestScores.easy
        : 0,

    normal:
      typeof parsedBestScores.normal === "number"
        ? parsedBestScores.normal
        : 0,

    hard:
      typeof parsedBestScores.hard === "number"
        ? parsedBestScores.hard
        : 0,

    buddha:
      typeof parsedBestScores.buddha === "number"
        ? parsedBestScores.buddha
        : 0,
  });
}

      const savedTodos = window.localStorage.getItem(
  TODO_STORAGE_KEY,
);
const savedRecommendedTodo =
  window.localStorage.getItem(
    RECOMMENDED_TODO_STORAGE_KEY,
  );

  const savedMinigameCompletionCount =
  window.localStorage.getItem(
    MINIGAME_COMPLETION_COUNT_STORAGE_KEY,
  );

  const savedMinigameCompletionDate =
  window.localStorage.getItem(
    MINIGAME_COMPLETION_DATE_STORAGE_KEY,
  );

      if (savedSchedules) {
        setSchedules(JSON.parse(savedSchedules));
      }

      if (savedMemos) {
        setMemos(JSON.parse(savedMemos));
      }

     if (savedUiOpacity !== null) {
  const parsedUiOpacity =
    Number(savedUiOpacity);

  if (
    Number.isFinite(
      parsedUiOpacity,
    )
  ) {
    setUiOpacity(
      Math.max(
        0,
        Math.min(
          100,
          parsedUiOpacity,
        ),
      ),
    );
  }
}

if (
  savedFocusAlarmVolume !== null
) {
  const parsedFocusAlarmVolume =
    Number(
      savedFocusAlarmVolume,
    );

  if (
    Number.isFinite(
      parsedFocusAlarmVolume,
    )
  ) {
    setFocusAlarmVolume(
      Math.max(
        0,
        Math.min(
          100,
          parsedFocusAlarmVolume,
        ),
      ),
    );
  }
}

if (
  savedSecretPin &&
  /^\d{4}$/.test(savedSecretPin)
) {
  setSecretPin(
    savedSecretPin,
  );
}


      if (savedFavorites) {
        setFavorites(
          normalizeFavorites(JSON.parse(savedFavorites)),
        );
      }

      if (savedTodos) {
  const parsedTodos = JSON.parse(savedTodos);

  if (Array.isArray(parsedTodos)) {
    setTodos(parsedTodos);
  }
}

if (savedRecommendedTodo !== null) {
  setIsRecommendedTodoCompleted(
    savedRecommendedTodo === "true",
  );
}

const todayStorageDate = getTodayStorageDate();

if (savedMinigameCompletionDate === todayStorageDate) {
  const parsedCount = Number(
    savedMinigameCompletionCount,
  );

  if (Number.isFinite(parsedCount)) {
    const safeCount = Math.max(0, parsedCount);

    setMinigameCompletionCount(safeCount);
    setIsRecommendedTodoCompleted(safeCount >= 2);
  }
} else {
  setMinigameCompletionCount(0);
  setIsRecommendedTodoCompleted(false);

  window.localStorage.setItem(
    MINIGAME_COMPLETION_DATE_STORAGE_KEY,
    todayStorageDate,
  );
}

    } catch (error) {
      console.error(
        "저장된 데이터를 불러오지 못했어요.",
        error,
      );
    } finally {
      setIsLoaded(true);
    }
  }, []);
/* ─────────────────────────────
   일정 클라우드 불러오기
   기존 localStorage 기록 자동 이전
───────────────────────────── */


useEffect(() => {
  let cancelled = false;

  function normalizeStickerColor(
    value: unknown,
  ): ScheduleStickerColor {
    if (
      value === "yellow" ||
      value === "green" ||
      value === "pink" ||
      value === "blue" ||
      value === "purple" ||
      value === "orange"
    ) {
      return value;
    }

    return "yellow";
  }

  async function loadCloudSchedules() {
    try {
      const {
        data: {
          session,
        },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const user =
        session?.user ?? null;

      /*
       * 비로그인 상태에서는
       * 기존 localStorage 일정을 사용한다.
       */
      if (!user) {
        return;
      }

      const {
        data: cloudSchedules,
        error: cloudScheduleError,
      } =
        await supabase
          .from("schedules")
          .select(
            `
              id,
              group_id,
              title,
              content,
              schedule_date,
              repeat_type,
              sticker_color,
              is_secret,
              created_at
            `,
          )
          .eq(
            "user_id",
            user.id,
          )
          .order(
            "schedule_date",
            {
              ascending: true,
            },
          )
          .order(
            "created_at",
            {
              ascending: true,
            },
          );

      if (cloudScheduleError) {
        throw cloudScheduleError;
      }

      /*
       * 서버에 일정이 있으면
       * 서버 데이터를 최우선으로 사용한다.
       */
      if (
        Array.isArray(
          cloudSchedules,
        ) &&
        cloudSchedules.length > 0
      ) {
        const normalizedSchedules =
          cloudSchedules.reduce<
            ScheduleMap
          >(
            (
              result,
              schedule,
            ) => {
              const date =
                typeof schedule
                  .schedule_date ===
                "string"
                  ? schedule
                      .schedule_date
                  : "";

              if (!date) {
                return result;
              }

              const normalizedSchedule:
                Schedule = {
                  id:
                    schedule.id,

                  groupId:
                    typeof schedule
                      .group_id ===
                    "string"
                      ? schedule
                          .group_id
                      : schedule.id,

                  title:
                    typeof schedule
                      .title ===
                    "string"
                      ? schedule.title
                      : "제목 없는 일정",

                  content:
                    typeof schedule
                      .content ===
                    "string"
                      ? schedule.content
                      : "",

                  date,

                  repeatType:
                    schedule
                      .repeat_type ===
                        "dailyRange" ||
                    schedule
                      .repeat_type ===
                        "weekly" ||
                    schedule
                      .repeat_type ===
                        "monthly"
                      ? schedule
                          .repeat_type
                      : "none",

                  stickerColor:
                    normalizeStickerColor(
                      schedule
                        .sticker_color,
                    ),

                  createdAt:
                    schedule
                      .created_at ??
                    new Date()
                      .toISOString(),

                  isSecret:
                    schedule
                      .is_secret ===
                    true,
                };

              result[date] = [
                ...(result[
                  date
                ] ?? []),
                normalizedSchedule,
              ];

              return result;
            },
            {},
          );

        if (cancelled) {
          return;
        }

        setSchedules(
          normalizedSchedules,
        );

        window.localStorage.setItem(
          SCHEDULE_STORAGE_KEY,
          JSON.stringify(
            normalizedSchedules,
          ),
        );

        return;
      }

      /*
       * 서버에 일정이 없으면
       * 브라우저의 기존 일정을 서버로 이전한다.
       */
      const savedSchedules =
        window.localStorage.getItem(
          SCHEDULE_STORAGE_KEY,
        );

      if (!savedSchedules) {
        if (!cancelled) {
          setSchedules({});
        }

        return;
      }

      const parsedValue: unknown =
        JSON.parse(
          savedSchedules,
        );

      if (
        !parsedValue ||
        typeof parsedValue !==
          "object" ||
        Array.isArray(
          parsedValue,
        )
      ) {
        if (!cancelled) {
          setSchedules({});
        }

        return;
      }

      const localScheduleMap =
        parsedValue as Record<
          string,
          unknown
        >;

      const normalizedSchedules:
        ScheduleMap = {};

      Object.entries(
        localScheduleMap,
      ).forEach(
        ([
          dateKey,
          value,
        ]) => {
          if (
            !Array.isArray(
              value,
            )
          ) {
            return;
          }

          const dateSchedules =
            value.reduce<
              Schedule[]
            >(
              (
                result,
                scheduleValue,
              ) => {
                if (
                  !scheduleValue ||
                  typeof scheduleValue !==
                    "object"
                ) {
                  return result;
                }

                const schedule =
                  scheduleValue as
                    Partial<Schedule>;

                const title =
                  typeof schedule
                    .title ===
                  "string"
                    ? schedule
                        .title
                        .trim()
                    : "";

                if (!title) {
                  return result;
                }

                const normalizedSchedule:
                  Schedule = {
                    id:
                      typeof schedule
                        .id ===
                      "string"
                        ? schedule.id
                        : createId(),

                    groupId:
                      typeof schedule
                        .groupId ===
                      "string"
                        ? schedule
                            .groupId
                        : createId(),

                    title,

                    content:
                      typeof schedule
                        .content ===
                      "string"
                        ? schedule
                            .content
                        : "",

                    date:
                      typeof schedule
                        .date ===
                      "string"
                        ? schedule.date
                        : dateKey,

                    repeatType:
                      schedule
                        .repeatType ===
                          "dailyRange" ||
                      schedule
                        .repeatType ===
                          "weekly" ||
                      schedule
                        .repeatType ===
                          "monthly"
                        ? schedule
                            .repeatType
                        : "none",

                    stickerColor:
                      normalizeStickerColor(
                        schedule
                          .stickerColor,
                      ),

                    createdAt:
                      typeof schedule
                        .createdAt ===
                      "string"
                        ? schedule
                            .createdAt
                        : new Date()
                            .toISOString(),

                    isSecret:
                      schedule
                        .isSecret ===
                      true,
                  };

                result.push(
                  normalizedSchedule,
                );

                return result;
              },
              [],
            );

          if (
            dateSchedules.length >
            0
          ) {
            normalizedSchedules[
              dateKey
            ] = dateSchedules;
          }
        },
      );

      const localSchedules =
        Object.values(
          normalizedSchedules,
        ).flat();

      if (
        localSchedules.length ===
        0
      ) {
        if (!cancelled) {
          setSchedules({});
        }

        return;
      }

      const migrationRows =
        localSchedules.map(
          (schedule) => ({
            id:
              schedule.id,

            user_id:
              user.id,

            group_id:
              schedule.groupId,

            title:
              schedule.title,

            content:
              schedule.content,

            schedule_date:
              schedule.date,

            repeat_type:
              schedule.repeatType,

            sticker_color:
              schedule
                .stickerColor ??
              "yellow",

            is_secret:
              schedule.isSecret,

            created_at:
              schedule.createdAt,

            updated_at:
              schedule.createdAt,
          }),
        );

      const {
        error: migrationError,
      } =
        await supabase
          .from("schedules")
          .insert(
            migrationRows,
          );

      if (migrationError) {
        throw migrationError;
      }

      if (!cancelled) {
        setSchedules(
          normalizedSchedules,
        );

        console.log(
          `${localSchedules.length}개의 기존 일정을 서버로 이전했습니다.`,
        );
      }
    } catch (error) {
      console.error(
        "일정 클라우드 불러오기 실패:",
        error,
      );
    } finally {
      if (!cancelled) {
        setIsScheduleCloudReady(
          true,
        );
      }
    }
  }

  void loadCloudSchedules();

  return () => {
    cancelled = true;
  };
}, [supabase]);


/* ─────────────────────────────
   일정 로컬 캐시 저장
───────────────────────────── */

useEffect(() => {
  if (
    !isLoaded ||
    !isScheduleCloudReady
  ) {
    return;
  }

  window.localStorage.setItem(
    SCHEDULE_STORAGE_KEY,
    JSON.stringify(schedules),
  );
}, [
  schedules,
  isLoaded,
  isScheduleCloudReady,
]);


/* ─────────────────────────────
   메모 클라우드 불러오기
   기존 localStorage 기록 자동 이전
───────────────────────────── */

useEffect(() => {
  let cancelled = false;

  async function loadCloudMemos() {
    try {
     const {
  data: {
    session,
  },
  error: sessionError,
} =
  await supabase.auth.getSession();

if (sessionError) {
  throw sessionError;
}

const user =
  session?.user ?? null;

/*
 * 비로그인 상태에서는
 * 기존 localStorage 메모를 그대로 사용한다.
 */
if (!user) {
  if (!cancelled) {
    setIsMemoCloudReady(true);
  }

  return;
}

      const {
        data: cloudMemos,
        error: cloudMemoError,
      } = await supabase
        .from("memos")
        .select(
          `
            id,
            title,
            content,
            is_secret,
            updated_at
          `,
        )
        .eq("user_id", user.id)
        .order("updated_at", {
          ascending: false,
        });

      if (cloudMemoError) {
        throw cloudMemoError;
      }

      /*
       * 서버에 메모가 있으면
       * 서버 데이터를 우선 사용한다.
       */
      if (
        Array.isArray(cloudMemos) &&
        cloudMemos.length > 0
      ) {
        const normalizedMemos: Memo[] =
          cloudMemos.map((memo) => ({
            id: memo.id,

            title:
              typeof memo.title === "string"
                ? memo.title
                : "제목 없는 메모",

            content:
              typeof memo.content === "string"
                ? memo.content
                : "",

            updatedAt:
              memo.updated_at ??
              new Date().toISOString(),

            isSecret:
              memo.is_secret === true,
          }));

        if (cancelled) {
          return;
        }

        setMemos(normalizedMemos);

        window.localStorage.setItem(
          MEMO_STORAGE_KEY,
          JSON.stringify(normalizedMemos),
        );

        return;
      }

      /*
       * 서버에 메모가 없으면
       * 브라우저의 기존 메모를 서버로 이전한다.
       */
      const savedMemos =
        window.localStorage.getItem(
          MEMO_STORAGE_KEY,
        );

      if (!savedMemos) {
        if (!cancelled) {
          setMemos([]);
        }

        return;
      }

      const parsedValue: unknown =
        JSON.parse(savedMemos);

      if (!Array.isArray(parsedValue)) {
        if (!cancelled) {
          setMemos([]);
        }

        return;
      }

      const localMemos =
        parsedValue.reduce<Memo[]>(
          (result, value, index) => {
            if (
              !value ||
              typeof value !== "object"
            ) {
              return result;
            }

            const memo =
              value as Partial<Memo>;

            const title =
              typeof memo.title === "string"
                ? memo.title.trim()
                : "";

            const content =
              typeof memo.content === "string"
                ? memo.content
                : "";

            if (
              !title &&
              !content.trim()
            ) {
              return result;
            }

            const normalizedMemo: Memo = {
              id:
                typeof memo.id === "string"
                  ? memo.id
                  : createId(),

              title:
                title ||
                "제목 없는 메모",

              content,

              updatedAt:
                typeof memo.updatedAt ===
                "string"
                  ? memo.updatedAt
                  : new Date(
                      Date.now() + index,
                    ).toISOString(),

              isSecret:
                memo.isSecret === true,
            };

            result.push(
              normalizedMemo,
            );

            return result;
          },
          [],
        );

      if (localMemos.length === 0) {
        if (!cancelled) {
          setMemos([]);
        }

        return;
      }

      const migrationRows =
        localMemos.map((memo) => ({
          id: memo.id,
          user_id: user.id,
          title: memo.title,
          content: memo.content,
          is_secret: memo.isSecret,
          created_at: memo.updatedAt,
          updated_at: memo.updatedAt,
        }));

      const { error: migrationError } =
        await supabase
          .from("memos")
          .insert(migrationRows);

      if (migrationError) {
        throw migrationError;
      }

      if (!cancelled) {
        setMemos(localMemos);

        console.log(
          `${localMemos.length}개의 기존 메모를 서버로 이전했습니다.`,
        );
      }
    } catch (error) {
      console.error(
        "메모 클라우드 불러오기 실패:",
        error,
      );
    } finally {
      if (!cancelled) {
        setIsMemoCloudReady(true);
      }
    }
  }

  void loadCloudMemos();

  return () => {
    cancelled = true;
  };
}, [supabase]);

/* ─────────────────────────────
   메모 로컬 캐시 저장
───────────────────────────── */

useEffect(() => {
  if (
    !isLoaded ||
    !isMemoCloudReady
  ) {
    return;
  }

  window.localStorage.setItem(
    MEMO_STORAGE_KEY,
    JSON.stringify(memos),
  );
}, [
  memos,
  isLoaded,
  isMemoCloudReady,
]);

/* ─────────────────────────────
   UI 및 알람 설정 자동 저장
───────────────────────────── */

useEffect(() => {
  if (!isLoaded) {
    return;
  }

  window.localStorage.setItem(
    UI_OPACITY_STORAGE_KEY,
    String(uiOpacity),
  );
}, [
  uiOpacity,
  isLoaded,
]);

useEffect(() => {
  if (!isLoaded) {
    return;
  }

  window.localStorage.setItem(
    FOCUS_ALARM_VOLUME_STORAGE_KEY,
    String(focusAlarmVolume),
  );
}, [
  focusAlarmVolume,
  isLoaded,
]);

/* ─────────────────────────────
   시크릿 PIN 자동 저장
───────────────────────────── */

useEffect(() => {
  if (!isLoaded) {
    return;
  }

  window.localStorage.setItem(
    SECRET_PIN_STORAGE_KEY,
    secretPin,
  );
}, [secretPin, isLoaded]);

/* ─────────────────────────────
   Focus Mode 메모 실시간 동기화
───────────────────────────── */

useEffect(() => {
  let cancelled = false;

  async function reloadFocusMemos() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      /*
       * 비로그인 상태에서는
       * 기존 localStorage 데이터를 사용한다.
       */
      if (!user) {
        const savedMemos =
          window.localStorage.getItem(
            MEMO_STORAGE_KEY,
          );

        const parsedValue: unknown =
          savedMemos
            ? JSON.parse(savedMemos)
            : [];

        if (
          !cancelled &&
          Array.isArray(parsedValue)
        ) {
          setMemos(
            parsedValue as Memo[],
          );
        }

        return;
      }

      /*
       * 로그인 상태에서는
       * Supabase 메모를 다시 불러온다.
       */
      const {
        data: cloudMemos,
        error: cloudMemoError,
      } = await supabase
        .from("memos")
        .select(
          `
            id,
            title,
            content,
            is_secret,
            updated_at
          `,
        )
        .eq("user_id", user.id)
        .order("updated_at", {
          ascending: false,
        });

      if (cloudMemoError) {
        throw cloudMemoError;
      }

      const normalizedMemos: Memo[] =
        Array.isArray(cloudMemos)
          ? cloudMemos.map((memo) => ({
              id: memo.id,

              title:
                typeof memo.title ===
                "string"
                  ? memo.title
                  : "제목 없는 메모",

              content:
                typeof memo.content ===
                "string"
                  ? memo.content
                  : "",

              updatedAt:
                memo.updated_at ??
                new Date().toISOString(),

              isSecret:
                memo.is_secret === true,
            }))
          : [];

      if (cancelled) {
        return;
      }

      setMemos(
        normalizedMemos,
      );

      window.localStorage.setItem(
        MEMO_STORAGE_KEY,
        JSON.stringify(
          normalizedMemos,
        ),
      );
    } catch (error) {
      console.error(
        "집중 메모를 동기화하지 못했어요.",
        error,
      );
    }
  }

  function handleFocusMemoUpdate() {
    void reloadFocusMemos();
  }

  window.addEventListener(
    "hoo-memos-updated",
    handleFocusMemoUpdate,
  );

  return () => {
    cancelled = true;

    window.removeEventListener(
      "hoo-memos-updated",
      handleFocusMemoUpdate,
    );
  };
}, [supabase]);


/* ─────────────────────────────
   HOO 오늘의 아침 브리핑 불러오기
───────────────────────────── */
/* ─────────────────────────────
   HOO 오늘의 아침 브리핑 불러오기
───────────────────────────── */
useEffect(() => {
  let cancelled = false;
  let briefingTimer: number | null = null;
  let isLoadingMorningBriefing = false;
  let authRetryCount = 0;

  const maximumAuthRetryCount = 5;

  function clearBriefingTimer() {
    if (briefingTimer === null) {
      return;
    }

    window.clearTimeout(briefingTimer);
    briefingTimer = null;
  }

  function scheduleBriefingLoad(
    delayMilliseconds: number,
  ) {
    clearBriefingTimer();

    briefingTimer = window.setTimeout(() => {
      void loadMorningBriefing();
    }, delayMilliseconds);
  }

  function scheduleAuthRetry() {
    if (
      authRetryCount >=
      maximumAuthRetryCount
    ) {
      return;
    }

    authRetryCount += 1;

    scheduleBriefingLoad(
      Math.min(
        5000,
        authRetryCount * 1000,
      ),
    );
  }

  async function loadMorningBriefing() {
    if (
      cancelled ||
      isLoadingMorningBriefing
    ) {
      return;
    }

    isLoadingMorningBriefing = true;

    try {
      const now = new Date();

      /*
       * 오전 4시 전에는 전날 브리핑을
       * 화면에 표시하지 않는다.
       */
      if (now.getHours() < 4) {
        if (!cancelled) {
          setMorningBriefing(null);
          setIsMorningBriefingLoading(
            false,
          );
        }

        const nextMorning = new Date(
          now,
        );

        nextMorning.setHours(
          4,
          0,
          5,
          0,
        );

        scheduleBriefingLoad(
          Math.max(
            1000,
            nextMorning.getTime() -
              now.getTime(),
          ),
        );

        return;
      }

      if (!cancelled) {
        setIsMorningBriefingLoading(
          true,
        );
      }

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        console.warn(
          "HOO 브리핑 사용자 확인 실패:",
          userError,
        );
      }

      if (!user) {
        if (!cancelled) {
          setMorningBriefing(null);
          setIsMorningBriefingLoading(
            false,
          );
        }

        scheduleAuthRetry();

        return;
      }

      authRetryCount = 0;

      const today =
        getTodayStorageDate();

      const {
        data: briefing,
        error: briefingError,
      } = await supabase
        .from("hoo_daily_briefings")
        .select(
          `
            id,
            briefing_date,

            morning_title,
            morning_content,
            morning_generated_at,
            morning_read_at,
            morning_status,

            evening_title,
            evening_content,
            evening_generated_at,
            evening_read_at,
            evening_status,

            total_todo_count,
            completed_todo_count,
            incomplete_todo_count,
            completion_rate
          `,
        )
        .eq("user_id", user.id)
        .eq(
          "briefing_date",
          today,
        )
        .maybeSingle();

      if (briefingError) {
        throw briefingError;
      }

      if (
        !briefing ||
        briefing.morning_status !==
          "completed" ||
        typeof briefing.morning_title !==
          "string" ||
        briefing.morning_title.trim()
          .length === 0 ||
        typeof briefing.morning_content !==
          "string" ||
        briefing.morning_content.trim()
          .length === 0
      ) {
        if (!cancelled) {
          setMorningBriefing(null);
        }

        /*
         * 오전 4시 크론 생성이 늦어질 경우
         * 30초 후 다시 확인한다.
         */
        scheduleBriefingLoad(30_000);

        return;
      }

      const normalizedBriefing:
        HooDailyBriefing = {
          id: briefing.id,

          briefingDate:
            typeof briefing.briefing_date ===
            "string"
              ? briefing.briefing_date
              : today,

          morningTitle:
            briefing.morning_title,

          morningContent:
            briefing.morning_content,

          morningGeneratedAt:
            typeof briefing.morning_generated_at ===
            "string"
              ? briefing.morning_generated_at
              : undefined,

          morningReadAt:
            typeof briefing.morning_read_at ===
            "string"
              ? briefing.morning_read_at
              : undefined,

          morningStatus:
            "completed",

          eveningTitle:
            typeof briefing.evening_title ===
            "string"
              ? briefing.evening_title
              : undefined,

          eveningContent:
            typeof briefing.evening_content ===
            "string"
              ? briefing.evening_content
              : undefined,

          eveningGeneratedAt:
            typeof briefing.evening_generated_at ===
            "string"
              ? briefing.evening_generated_at
              : undefined,

          eveningReadAt:
            typeof briefing.evening_read_at ===
            "string"
              ? briefing.evening_read_at
              : undefined,

          eveningStatus:
            briefing.evening_status ===
              "generating" ||
            briefing.evening_status ===
              "completed" ||
            briefing.evening_status ===
              "failed"
              ? briefing.evening_status
              : "pending",

          totalTodoCount:
            Number(
              briefing.total_todo_count ??
                0,
            ),

          completedTodoCount:
            Number(
              briefing.completed_todo_count ??
                0,
            ),

          incompleteTodoCount:
            Number(
              briefing.incomplete_todo_count ??
                0,
            ),

          completionRate:
            Number(
              briefing.completion_rate ??
                0,
            ),
        };

      if (cancelled) {
        return;
      }

      setMorningBriefing(
        normalizedBriefing,
      );

      setIsMorningBriefingOpen(true);

      /*
       * 다음 날 자정 이후 데이터가 바뀔 수
       * 있으므로 다음 오전 4시에 재조회한다.
       */
      const currentTime = new Date();
      const nextMorning = new Date(
        currentTime,
      );

      nextMorning.setDate(
        nextMorning.getDate() + 1,
      );

      nextMorning.setHours(
        4,
        0,
        5,
        0,
      );

      scheduleBriefingLoad(
        Math.max(
          1000,
          nextMorning.getTime() -
            currentTime.getTime(),
        ),
      );
    } catch (error) {
      console.error(
        "HOO 아침 브리핑을 불러오지 못했습니다.",
        error,
      );

      if (!cancelled) {
        setMorningBriefing(null);
      }

      scheduleBriefingLoad(60_000);
    } finally {
      isLoadingMorningBriefing = false;

      if (!cancelled) {
        setIsMorningBriefingLoading(
          false,
        );
      }
    }
  }

  function handleVisibilityChange() {
    if (
      document.visibilityState ===
      "visible"
    ) {
      void loadMorningBriefing();
    }
  }

  const {
    data: { subscription },
  } =
    supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) {
          return;
        }

        if (session?.user) {
          authRetryCount = 0;
          void loadMorningBriefing();

          return;
        }

        setMorningBriefing(null);
        setIsMorningBriefingLoading(
          false,
        );
      },
    );

  void loadMorningBriefing();

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange,
  );

  return () => {
    cancelled = true;

    clearBriefingTimer();

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    subscription.unsubscribe();
  };
}, [supabase]);

/* ─────────────────────────────
   HOO 오후 9시 브리핑 자동 감지
───────────────────────────── */

useEffect(() => {
  let cancelled = false;

  let eveningBriefingLoaded =
    false;

  async function loadEveningBriefingIfReady() {
  /*
   * 이미 저녁 브리핑을 불러왔거나
   * effect가 종료된 경우 추가 요청하지 않는다.
   */
  if (
    cancelled ||
    eveningBriefingLoaded
  ) {
    return;
  }

  /*
   * 한국시간 오후 9시 전에는
   * Supabase 인증 및 브리핑 조회를 실행하지 않는다.
   */
  if (!isHooEveningBriefingTime()) {
    return;
  }

  const todayBriefingDate =
    getTodayStorageDate();

  try {

      const {
  data: { session },
  error: sessionError,
} =
  await supabase.auth.getSession();

if (sessionError) {
  throw sessionError;
}

const user =
  session?.user ?? null;

if (
  !user ||
  cancelled ||
  eveningBriefingLoaded
) {
  return;
}


      const {
        data: briefing,
        error: briefingError,
      } = await supabase
        .from("hoo_daily_briefings")
        .select(
          `
            evening_title,
            evening_content,
            evening_generated_at,
            evening_read_at,
            evening_status,
            total_todo_count,
            completed_todo_count,
            incomplete_todo_count,
            completion_rate
          `,
        )
        .eq("user_id", user.id)
        .eq(
          "briefing_date",
          todayBriefingDate,
        )
        .maybeSingle();

      if (briefingError) {
        throw briefingError;
      }

      if (
        cancelled ||
        !briefing ||
        briefing.evening_status !==
          "completed" ||
        typeof briefing.evening_content !==
          "string" ||
        briefing.evening_content.trim()
          .length === 0
      ) {
        return;
      }

      eveningBriefingLoaded = true;

      setMorningBriefing(
        (previousBriefing) => {
          if (!previousBriefing) {
            return previousBriefing;
          }

          return {
            ...previousBriefing,

            eveningTitle:
              typeof briefing.evening_title ===
              "string"
                ? briefing.evening_title
                : "오늘 하루도 수고했어요.",

            eveningContent:
              briefing.evening_content,

            eveningGeneratedAt:
              typeof briefing.evening_generated_at ===
              "string"
                ? briefing.evening_generated_at
                : undefined,

            eveningReadAt:
              typeof briefing.evening_read_at ===
              "string"
                ? briefing.evening_read_at
                : undefined,

            eveningStatus:
              "completed",

            totalTodoCount:
              Number(
                briefing.total_todo_count ??
                  0,
              ),

            completedTodoCount:
              Number(
                briefing.completed_todo_count ??
                  0,
              ),

            incompleteTodoCount:
              Number(
                briefing.incomplete_todo_count ??
                  0,
              ),

            completionRate:
              Number(
                briefing.completion_rate ??
                  0,
              ),
          };
        },
      );

      setIsMorningBriefingOpen(true);
    } catch (error) {
      console.error(
        "HOO 저녁 브리핑 자동 확인 실패:",
        error,
      );
    }
  }

  /*
   * 페이지를 열었을 때 즉시 확인한다.
   */
  void loadEveningBriefingIfReady();

  /*
   * 오후 9시가 지나면 최대 30초 안에
   * 생성된 브리핑을 감지한다.
   */
  const eveningBriefingInterval =
    window.setInterval(() => {
      void loadEveningBriefingIfReady();
    }, 30_000);

  function handleVisibilityChange() {
    if (
      document.visibilityState ===
      "visible"
    ) {
      void loadEveningBriefingIfReady();
    }
  }

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange,
  );

  return () => {
    cancelled = true;

    window.clearInterval(
      eveningBriefingInterval,
    );

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
  };
}, [supabase]);


/* ─────────────────────────────
   HOO 예약 컨텍스트 메시지 자동 감지
───────────────────────────── */

useEffect(() => {
  let cancelled = false;

  function clearContextMessageTimer() {
    if (
      contextMessageTimerRef.current ===
      null
    ) {
      return;
    }

    window.clearTimeout(
      contextMessageTimerRef.current,
    );

    contextMessageTimerRef.current =
      null;
  }

  function scheduleContextMessageLoad(
    delayMilliseconds: number,
  ) {
    clearContextMessageTimer();

    if (cancelled) {
      return;
    }

    /*
     * 브라우저 setTimeout의 최대 안전 범위를
     * 넘지 않도록 제한한다.
     */
    const safeDelay =
      Math.min(
        Math.max(
          delayMilliseconds,
          1000,
        ),
        2_147_000_000,
      );

    contextMessageTimerRef.current =
      window.setTimeout(() => {
        contextMessageTimerRef.current =
          null;

        void loadContextMessage();
      }, safeDelay);
  }

function normalizeContextMessageType(
  value: unknown,
): HooContextMessageType {
  if (
    value ===
      "schedule_preparation" ||
    value === "weather_care" ||
    value === "sunset" ||
    value === "routine_respect" ||
    value === "condition_care" ||
    value ===
      "gentle_encouragement"
  ) {
    return value;
  }

  return "gentle_encouragement";
}

  function normalizeContextMessageStatus(
    value: unknown,
  ): HooContextMessageStatus {
    if (
      value === "delivered" ||
      value === "read" ||
      value === "dismissed" ||
      value === "expired"
    ) {
      return value;
    }

    return "pending";
  }

  async function scheduleNextPendingMessage(
    userId: string,
  ) {
    if (cancelled) {
      return;
    }

    const now =
      new Date();

    const {
      data: nextMessage,
      error: nextMessageError,
    } =
      await supabase
        .from("hoo_context_messages")
        .select(
          `
            id,
            scheduled_for,
            expires_at
          `,
        )
        .eq(
          "user_id",
          userId,
        )
        .eq(
          "status",
          "pending",
        )
        .gt(
          "scheduled_for",
          now.toISOString(),
        )
        .gt(
          "expires_at",
          now.toISOString(),
        )
        .order(
          "scheduled_for",
          {
            ascending: true,
          },
        )
        .limit(1)
        .maybeSingle();

    if (nextMessageError) {
      throw nextMessageError;
    }

    if (
      cancelled ||
      !nextMessage ||
      typeof nextMessage.scheduled_for !==
        "string"
    ) {
      /*
       * 아직 다음 메시지가 없어도 날씨 갱신이나
       * 새 메시지 생성을 감지할 수 있도록
       * 5분 후 다시 확인한다.
       */
      scheduleContextMessageLoad(
        5 * 60 * 1000,
      );

      return;
    }

    const scheduledTime =
      new Date(
        nextMessage.scheduled_for,
      ).getTime();

    if (
      !Number.isFinite(
        scheduledTime,
      )
    ) {
      scheduleContextMessageLoad(
        60 * 1000,
      );

      return;
    }

    scheduleContextMessageLoad(
      scheduledTime -
        Date.now() +
        500,
    );
  }


async function loadContextMessage() {
  clearContextMessageTimer();

  if (cancelled) {
    return;
  }

  /*
   * 아침·저녁 브리핑이 열려 있으면
   * 예약 메시지는 브리핑이 닫힌 뒤 표시한다.
   */
  if (isBriefingModalOpen) {
    setIsContextMessageLoading(false);

    scheduleContextMessageLoad(
      30 * 1000,
    );

    return;
  }

  /*
   * 현재 메시지 카드가 열려 있으면
   * 다음 메시지를 조회하거나 delivered로 변경하지 않는다.
   *
   * 사용자가 현재 메시지를 처리하면
   * refreshKey를 통해 다음 메시지를 조회한다.
   */
  if (
    isContextMessageOpen &&
    contextMessage
  ) {
    setIsContextMessageLoading(false);

    return;
  }

  /*
   * 개발 모드, 탭 복귀, 예약 타이머가
   * 동시에 실행돼도 DB 조회는 한 번만 수행한다.
   */
  if (
    contextMessageLoadInFlightRef.current
  ) {
    scheduleContextMessageLoad(500);

    return;
  }

  if (!isLoggedIn) {
    setContextMessage(null);
    setIsContextMessageOpen(false);
    setIsContextMessageLoading(false);

    return;
  }

  contextMessageLoadInFlightRef.current =
    true;

  setIsContextMessageLoading(true);

  try {
    /*
     * 인증 서버를 매번 호출하지 않고
     * 현재 브라우저 세션을 재사용한다.
     */
    const {
      data: { session },
      error: sessionError,
    } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const user =
      session?.user ?? null;

    if (!user) {
      if (!cancelled) {
        setContextMessage(null);
        setIsContextMessageOpen(false);
        setIsContextMessageLoading(false);
      }

      return;
    }

    if (cancelled) {
      return;
    }

    const nowIso =
      new Date().toISOString();

    /*
     * 유효시간이 지난 pending 메시지는
     * 화면에 표시하지 않고 expired 처리한다.
     */
    const {
      error: expirationError,
    } =
      await supabase
        .from("hoo_context_messages")
        .update({
          status: "expired",
          updated_at: nowIso,
        })
        .eq("user_id", user.id)
        .eq("status", "pending")
        .lte("expires_at", nowIso);

    if (expirationError) {
      throw expirationError;
    }

    if (cancelled) {
      return;
    }

    /*
     * 현재 송출 가능한 메시지 중
     * 우선순위가 가장 높은 한 건만 가져온다.
     */
    const {
      data: pendingMessage,
      error: pendingMessageError,
    } =
      await supabase
        .from("hoo_context_messages")
        .select(
          `
            id,
            message_date,
            message_type,
            title,
            content,
            scheduled_for,
            expires_at,
            priority,
            status,
            dedupe_key
          `,
        )
        .eq("user_id", user.id)
        .eq("status", "pending")
        .lte("scheduled_for", nowIso)
        .gt("expires_at", nowIso)
        .order("priority", {
          ascending: false,
        })
        .order("scheduled_for", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

    if (pendingMessageError) {
      throw pendingMessageError;
    }

    if (cancelled) {
      return;
    }

    if (!pendingMessage) {
      setIsContextMessageLoading(false);

      await scheduleNextPendingMessage(
        user.id,
      );

      return;
    }

    /*
     * 여러 탭이 같은 메시지를 조회해도
     * 한 곳에서만 delivered로 변경한다.
     */
    const {
      data: deliveredMessage,
      error: deliveryError,
    } =
      await supabase
        .from("hoo_context_messages")
        .update({
          status: "delivered",
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", pendingMessage.id)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .select(
          `
            id,
            message_date,
            message_type,
            title,
            content,
            scheduled_for,
            expires_at,
            priority,
            status,
            dedupe_key
          `,
        )
        .maybeSingle();

    if (deliveryError) {
      throw deliveryError;
    }

    if (cancelled) {
      return;
    }

    /*
     * 다른 탭이 먼저 상태를 변경한 경우
     * 잠시 후 다음 메시지를 확인한다.
     */
    if (!deliveredMessage) {
      scheduleContextMessageLoad(1000);

      return;
    }

    const normalizedMessage:
      HooContextMessage = {
        id:
          String(deliveredMessage.id),

        messageDate:
          typeof deliveredMessage.message_date ===
          "string"
            ? deliveredMessage.message_date
            : getTodayStorageDate(),

        messageType:
          normalizeContextMessageType(
            deliveredMessage.message_type,
          ),

        title:
          typeof deliveredMessage.title ===
          "string"
            ? deliveredMessage.title
            : "HOO가 전해드려요.",

        content:
          typeof deliveredMessage.content ===
          "string"
            ? deliveredMessage.content
            : "",

        scheduledFor:
          typeof deliveredMessage.scheduled_for ===
          "string"
            ? deliveredMessage.scheduled_for
            : nowIso,

        expiresAt:
          typeof deliveredMessage.expires_at ===
          "string"
            ? deliveredMessage.expires_at
            : nowIso,

        priority:
          Number(
            deliveredMessage.priority ?? 0,
          ),

        status:
          normalizeContextMessageStatus(
            deliveredMessage.status,
          ),

        dedupeKey:
          typeof deliveredMessage.dedupe_key ===
          "string"
            ? deliveredMessage.dedupe_key
            : String(deliveredMessage.id),
      };

    /*
     * 같은 페이지 실행 중 이미 열었던
     * 메시지는 다시 표시하지 않는다.
     */
    if (
      lastOpenedContextMessageIdRef.current ===
      normalizedMessage.id
    ) {
      await scheduleNextPendingMessage(
        user.id,
      );

      return;
    }

    lastOpenedContextMessageIdRef.current =
      normalizedMessage.id;

    setContextMessage(normalizedMessage);
    setIsContextMessageOpen(true);
    setIsContextMessageLoading(false);
  } catch (error) {
    console.error(
      "HOO 예약 메시지를 불러오지 못했습니다.",
      error,
    );

    if (!cancelled) {
      setIsContextMessageLoading(false);

      /*
       * 일시적인 네트워크 오류가 발생하면
       * 30초 후 다시 확인한다.
       */
      scheduleContextMessageLoad(
        30 * 1000,
      );
    }
  } finally {
    contextMessageLoadInFlightRef.current =
      false;
  }
}


  function handleContextMessageVisibilityChange() {
    if (
      document.visibilityState ===
      "visible"
    ) {
      void loadContextMessage();
    }
  }

  void loadContextMessage();

  document.addEventListener(
    "visibilitychange",
    handleContextMessageVisibilityChange,
  );

  return () => {
    cancelled = true;

    clearContextMessageTimer();

    document.removeEventListener(
      "visibilitychange",
      handleContextMessageVisibilityChange,
    );
  };

}, [
  supabase,
  isLoggedIn,
  contextMessageRefreshKey,
  isBriefingModalOpen,
]);
  

/* ─────────────────────────────
   HOO 날씨·위치 설정 불러오기
───────────────────────────── */

useEffect(() => {
  let cancelled = false;

  async function loadWeatherPreference() {
    setIsWeatherPreferenceLoading(
      true,
    );

    try {
      const {
        data: authData,
        error: authError,
      } =
        await supabase.auth.getUser();

      if (
        cancelled ||
        authError ||
        !authData.user
      ) {
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from(
          "hoo_weather_preferences",
        )
        .select(
          `
            weather_enabled,
            latitude,
            longitude,
            location_name,
            timezone,
            location_source,
            background_weather_enabled,
            location_processing_mode,
            raw_location_retention_seconds,
            store_location_history,
            consented_at
          `,
        )
        .eq(
          "user_id",
          authData.user.id,
        )
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        throw error;
      }

      /*
       * 아직 이용자가 선택하지 않았다면
       * 위치를 요청하지 않고 안내창만 연다.
       */
      if (!data) {
        setWeatherPreference(null);

        setWeatherPermissionStatus(
          "idle",
        );

        setIsWeatherConsentOpen(
          true,
        );

        return;
      }

      const loadedPreference:
        HooWeatherPreference = {
          weatherEnabled:
            Boolean(
              data.weather_enabled,
            ),

          /*
           * 좌표가 존재하더라도 DB에서
           * 이미 약 1km 단위로 제한되어 있다.
           */
          latitude:
            data.latitude === null
              ? undefined
              : Number(data.latitude),

          longitude:
            data.longitude === null
              ? undefined
              : Number(data.longitude),

          locationName:
            data.location_name ??
            undefined,

          timezone:
            data.timezone ??
            "Asia/Seoul",

          locationSource:
            (
              data.location_source ??
              "device_ephemeral"
            ) as HooWeatherLocationSource,

          backgroundWeatherEnabled:
            Boolean(
              data.background_weather_enabled,
            ),

        locationProcessingMode:
  data.location_processing_mode ===
  "persisted_coarse"
    ? "persisted_coarse"
    : "ephemeral_coarse",

          rawLocationRetentionSeconds:
            Math.min(
              60,
              Math.max(
                1,
                Number(
                  data.raw_location_retention_seconds ??
                    60,
                ),
              ),
            ),

          /*
           * DB 제약조건상 항상 false다.
           * 위치 기록 저장 기능은 제공하지 않는다.
           */
          storeLocationHistory:
            false,

          consentedAt:
            data.consented_at ??
            undefined,
        };

      setWeatherPreference(
        loadedPreference,
      );

      setWeatherPermissionStatus(
        loadedPreference.weatherEnabled
          ? "granted"
          : "denied",
      );

      setIsWeatherConsentOpen(false);
    } catch (error) {
      if (cancelled) {
        return;
      }

      console.error(
        "HOO 날씨 설정을 불러오지 못했습니다.",
        error,
      );

      setWeatherErrorMessage(
        "날씨 설정을 불러오지 못했어요.",
      );

      setWeatherPermissionStatus(
        "error",
      );
    } finally {
      if (!cancelled) {
        setIsWeatherPreferenceLoading(
          false,
        );
      }
    }
  }

  void loadWeatherPreference();

  return () => {
    cancelled = true;
  };
}, [supabase]);
/* ─────────────────────────────
   HOO 사이트 진입·날짜 변경 시
   날씨를 단발성으로 갱신
───────────────────────────── */

useEffect(() => {
  if (isWeatherPreferenceLoading) {
    return;
  }

  if (!weatherPreference?.weatherEnabled) {
    return;
  }

  const supportedLocationSources = [
    "device_ephemeral",
    "device_coarse",
  ];

  if (
    !supportedLocationSources.includes(
      weatherPreference.locationSource,
    )
  ) {
    return;
  }

  let isEffectActive = true;
  let isRefreshInFlight = false;

  async function refreshCurrentWeather() {
    if (
      !isEffectActive ||
      isRefreshInFlight
    ) {
      return;
    }

    isRefreshInFlight = true;

    try {
      /*
       * 기존 화면의 날씨는 유지하면서
       * 현재 위치와 날씨만 새로 갱신한다.
       */
      await enableHooWeatherWithCurrentLocation();

      if (
        isEffectActive &&
        lastWeatherRefreshAtRef.current > 0
      ) {
        weatherRefreshDateRef.current =
          getTodayStorageDate();
      }
    } catch (error) {
      console.error(
        "HOO 최신 날씨 자동 갱신 실패:",
        error,
      );
    } finally {
      isRefreshInFlight = false;
    }
  }

  /*
   * 사이트 진입 1초 후 즉시 갱신한다.
   */
  const initialRefreshTimer =
    window.setTimeout(() => {
      void refreshCurrentWeather();
    }, 1_000);

 /*
 * HOO를 실행 중인 동안 5분마다
 * 날씨·기온·체감온도를 갱신한다.
 */
 const weatherRefreshInterval =
  window.setInterval(() => {
    void refreshCurrentWeather();
  }, 5 * 60 * 1000);

  /*
   * 다른 화면에서 HOO로 돌아왔을 때도
   * 최신 날씨를 다시 확인한다.
   */
  
  function handleVisibilityChange() {
    if (
      document.visibilityState ===
      "visible"
    ) {
      void refreshCurrentWeather();
    }
  }

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange,
  );

  return () => {
    isEffectActive = false;

    window.clearTimeout(
      initialRefreshTimer,
    );

    window.clearInterval(
      weatherRefreshInterval,
    );

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  isWeatherPreferenceLoading,
  weatherPreference?.weatherEnabled,
  weatherPreference?.locationSource,
]);

/* ─────────────────────────────
   HOO 반복 생활 확인 후보 불러오기
───────────────────────────── */

useEffect(() => {
  let cancelled = false;

  async function loadRoutineCandidates() {
    const {
      data: authData,
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      cancelled ||
      authError ||
      !authData.user
    ) {
      if (!cancelled) {
        setRoutineCandidates([]);
      }

      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from("hoo_user_routines")
      .select(
        `
          id,
          name,
          routine_type,
          days_of_week,
          start_time,
          end_time,
          confidence,
          status,
          protect_from_suggestions,
          observation_count,
          inference_reason
        `,
      )
      .eq(
        "user_id",
        authData.user.id,
      )
      .eq(
        "status",
        "needs_confirmation",
      )
      .order(
        "confidence",
        {
          ascending: false,
        },
      )
      .order(
        "observation_count",
        {
          ascending: false,
        },
      );

    if (cancelled) {
      return;
    }

    if (error) {
      console.error(
        "HOO 반복 생활 후보를 불러오지 못했습니다.",
        error,
      );

      setRoutineCandidates([]);
      return;
    }

    const candidates: HooRoutineCandidate[] =
      (data ?? []).map(
        (routine) => ({
          id: routine.id,
          name:
            routine.name ??
            "반복 생활",
          routineType:
            routine.routine_type as
              HooRoutineCandidate["routineType"],
          daysOfWeek:
            Array.isArray(
              routine.days_of_week,
            )
              ? routine.days_of_week
              : [],
          startTime:
            routine.start_time
              ? String(
                  routine.start_time,
                ).slice(0, 5)
              : undefined,
          endTime:
            routine.end_time
              ? String(
                  routine.end_time,
                ).slice(0, 5)
              : undefined,
          confidence:
            Number(
              routine.confidence ??
                0,
            ),
          status:
            routine.status as
              HooRoutineCandidate["status"],
          protectFromSuggestions:
            Boolean(
              routine
                .protect_from_suggestions,
            ),
          observationCount:
            Number(
              routine.observation_count ??
                0,
            ),
          inferenceReason:
            routine.inference_reason ??
            undefined,
        }),
      );

    setRoutineCandidates(
      candidates,
    );
  }

  void loadRoutineCandidates();

  return () => {
    cancelled = true;
  };
}, [supabase]);

function openRoutineConfirmation(
  candidate: HooRoutineCandidate,
) {
  setSelectedRoutineCandidate(
    candidate,
  );

  setRoutineStartTime(
    candidate.startTime ?? "",
  );

  setRoutineEndTime(
    candidate.endTime ?? "",
  );

  setShouldProtectRoutineTime(
    candidate.protectFromSuggestions ??
      true,
  );

  setIsRoutineConfirmationOpen(
    true,
  );
}

function closeRoutineConfirmation() {
  if (isRoutineSaving) {
    return;
  }

  setIsRoutineConfirmationOpen(
    false,
  );

  setSelectedRoutineCandidate(
    null,
  );

  setRoutineStartTime("");
  setRoutineEndTime("");

  setShouldProtectRoutineTime(
    true,
  );
}


async function confirmRoutineCandidate() {
  if (
    !selectedRoutineCandidate ||
    isRoutineSaving
  ) {
    return;
  }

  setIsRoutineSaving(true);

  try {
    const {
      error,
    } = await supabase.rpc(
      "confirm_hoo_routine",
      {
        p_routine_id:
          selectedRoutineCandidate.id,
        p_start_time:
          routineStartTime.trim() ||
          null,
        p_end_time:
          routineEndTime.trim() ||
          null,
        p_protect_from_suggestions:
          shouldProtectRoutineTime,
      },
    );

    if (error) {
      throw error;
    }

    /*
     * 확정된 후보는 확인 대기 목록에서 제거한다.
     */
    setRoutineCandidates(
      (previousCandidates) =>
        previousCandidates.filter(
          (candidate) =>
            candidate.id !==
            selectedRoutineCandidate.id,
        ),
    );

    setIsRoutineConfirmationOpen(
      false,
    );

    setSelectedRoutineCandidate(
      null,
    );

    setRoutineStartTime("");
    setRoutineEndTime("");

    setShouldProtectRoutineTime(
      true,
    );
  } catch (error) {
    console.error(
      "HOO 반복 생활 확정 실패:",
      error,
    );

    window.alert(
      "반복 생활을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
  } finally {
    setIsRoutineSaving(false);
  }
}

async function rejectRoutineCandidate() {
  if (
    !selectedRoutineCandidate ||
    isRoutineSaving
  ) {
    return;
  }

  const rejectedRoutineId =
    selectedRoutineCandidate.id;

  setIsRoutineSaving(true);

  try {
    const {
      error,
    } = await supabase.rpc(
      "reject_hoo_routine",
      {
        p_routine_id:
          rejectedRoutineId,
      },
    );

    if (error) {
      throw error;
    }

    /*
     * 거절된 후보도 확인 대기 목록에서 제거한다.
     */
    setRoutineCandidates(
      (previousCandidates) =>
        previousCandidates.filter(
          (candidate) =>
            candidate.id !==
            rejectedRoutineId,
        ),
    );

    setIsRoutineConfirmationOpen(
      false,
    );

    setSelectedRoutineCandidate(
      null,
    );

    setRoutineStartTime("");
    setRoutineEndTime("");

    setShouldProtectRoutineTime(
      true,
    );
  } catch (error) {
    console.error(
      "HOO 반복 생활 거절 실패:",
      error,
    );

    window.alert(
      "반복 생활 후보를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
  } finally {
    setIsRoutineSaving(false);
  }
}


async function disableHooWeather() {
  if (isWeatherLoading) {
    return;
  }

  setIsWeatherLoading(true);
  setWeatherErrorMessage("");

  try {
    const {
      data: authData,
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !authData.user
    ) {
      throw new Error(
        "로그인이 필요합니다.",
      );
    }

    const disabledPreference:
      HooWeatherPreference = {
        weatherEnabled: false,

        timezone:
          Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone ||
          "Asia/Seoul",

        locationSource:
          "device_ephemeral",

        backgroundWeatherEnabled:
          false,

        locationProcessingMode:
          "ephemeral_coarse",

        rawLocationRetentionSeconds:
          60,

        storeLocationHistory:
          false,
      };

    const {
      error,
    } = await supabase
      .from(
        "hoo_weather_preferences",
      )
      .upsert(
        {
          user_id:
            authData.user.id,

          weather_enabled:
            false,

          latitude: null,
          longitude: null,
          location_name: null,

          timezone:
            disabledPreference.timezone,

          location_source:
            "device_ephemeral",

          background_weather_enabled:
            false,

          location_processing_mode:
            "ephemeral_coarse",

          raw_location_retention_seconds:
            60,

          store_location_history:
            false,

          consented_at: null,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

    if (error) {
      throw error;
    }

    setWeatherPreference(
      disabledPreference,
    );

    setCurrentWeather(null);

    setWeatherPermissionStatus(
      "denied",
    );

    setIsWeatherConsentOpen(false);
  } catch (error) {
    console.error(
      "HOO 날씨 사용 안 함 저장 실패:",
      error,
    );

    setWeatherErrorMessage(
      "날씨 설정을 저장하지 못했어요.",
    );

    setWeatherPermissionStatus(
      "error",
    );
  } finally {
    setIsWeatherLoading(false);
  }
}
async function enableHooWeatherWithCurrentLocation() {
  if (isWeatherLoading) {
    return;
  }

  setWeatherErrorMessage("");

  if (
    typeof navigator ===
      "undefined" ||
    !navigator.geolocation
  ) {
    setWeatherPermissionStatus(
      "unsupported",
    );

    setWeatherErrorMessage(
      "이 브라우저에서는 현재 위치를 사용할 수 없어요.",
    );

    return;
  }

  setIsWeatherLoading(true);

  setWeatherPermissionStatus(
    "requesting",
  );

  setLiveLocationStatus(
    "starting",
  );

  try {
    /*
     * 브라우저에서 받은 정확한 위치는
     * 콜백 안에서 즉시 소수점 둘째 자리,
     * 약 1km 단위로 축소한다.
     *
     * 정확한 GeolocationPosition 객체는
     * 상태, 로컬 저장소 또는 DB에 저장하지 않는다.
     */
    const coarseLocation =
      await new Promise<HooSessionLocation>(
        (
          resolve,
          reject,
        ) => {
          navigator.geolocation.getCurrentPosition(
            (
              position,
            ) => {
              const reducedLocation =
                rememberHooLocationForWeather(
                  position,
                );

              resolve(
                reducedLocation,
              );
            },
            reject,
          {
  /*
   * 오래된 네트워크 위치를 사용하지 않고
   * 기기에서 받을 수 있는 가장 정확한 위치를 요청한다.
   */
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
},
          );
        },
      );

    const {
      data: authData,
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !authData.user
    ) {
      throw new Error(
        "로그인이 필요합니다.",
      );
    }

    const timezone =
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      "Asia/Seoul";

    const consentedAt =
      new Date().toISOString();

    const enabledPreference:
      HooWeatherPreference = {
        weatherEnabled: true,

        /*
         * 원본 GPS 좌표가 아니라 이미 축소된
         * 소수점 둘째 자리 좌표만 사용한다.
         */
        latitude:
          coarseLocation.latitude,

        longitude:
          coarseLocation.longitude,

        locationName:
          "대략적인 현재 위치",

        timezone,

        locationSource:
          "device_coarse",

        /*
         * 저장된 대략적 위치를 이용해 서버가
         * 앱 종료 후에도 날씨를 갱신할 수 있다.
         */
        backgroundWeatherEnabled:
          true,

        locationProcessingMode:
          "persisted_coarse",

        /*
         * 정확한 원본 위치는 브라우저 메모리에서만
         * 최대 60초 동안 처리한다.
         */
        rawLocationRetentionSeconds:
          60,

        storeLocationHistory:
          false,

        consentedAt,
      };

    const {
      error,
    } = await supabase
      .from(
        "hoo_weather_preferences",
      )
      .upsert(
        {
          user_id:
            authData.user.id,

          weather_enabled:
            true,

          /*
           * 정확한 원본 위치가 아닌
           * 약 1km 단위 좌표만 저장한다.
           */
          latitude:
            coarseLocation.latitude,

          longitude:
            coarseLocation.longitude,

          location_name:
            "대략적인 현재 위치",

          timezone,

          location_source:
            "device_coarse",

          background_weather_enabled:
            true,

          location_processing_mode:
            "persisted_coarse",

          raw_location_retention_seconds:
            60,

          store_location_history:
            false,

          consented_at:
            consentedAt,

          updated_at:
            consentedAt,
        },
        {
          onConflict:
            "user_id",
        },
      );

    if (error) {
      throw error;
    }

    setWeatherPreference(
      enabledPreference,
    );

    setWeatherPermissionStatus(
      "granted",
    );

    /*
     * 저장된 것과 동일한 대략적 위치로
     * 현재 날씨를 즉시 한 번 갱신한다.
     */
    await fetchHooWeatherForLocation(
      coarseLocation,
    );

    setIsWeatherConsentOpen(false);
  } catch {
    /*
     * 위치 권한 거부, GPS 시간 초과, 개발자 도구의 위치 미지원은
     * 예상 가능한 사용자 환경이므로 console.error를 출력하지 않는다.
     * Next.js 개발 오류창 대신 아래 상태 메시지만 표시한다.
     */
    stopHooLiveLocation();

    setWeatherPermissionStatus(
      "denied",
    );

    setLiveLocationStatus(
      "error",
    );

    setWeatherErrorMessage(
      "위치 권한을 허용하지 않았거나 현재 위치의 날씨를 확인하지 못했어요.",
    );
  } finally {
    setIsWeatherLoading(false);
  }
}

function rememberHooLocationForWeather(
  position: GeolocationPosition,
) {
  /*
   * 정확한 위도·경도를 약 1km 단위인
   * 소수점 둘째 자리로 즉시 축소한다.
   *
   * 원본 position은 이 함수가 끝나면
   * 별도로 보관하지 않는다.
   */
  const coarseLatitude =
    Math.round(
      position.coords.latitude *
        100,
    ) / 100;

  const coarseLongitude =
    Math.round(
      position.coords.longitude *
        100,
    ) / 100;

  const capturedAtDate =
    new Date();

  const expiresAtDate =
    new Date(
      capturedAtDate.getTime() +
        60_000,
    );

  const temporaryLocation:
    HooSessionLocation = {
      latitude:
        coarseLatitude,

      longitude:
        coarseLongitude,

      accuracyMeters:
        Math.round(
          position.coords.accuracy,
        ),

      capturedAt:
        capturedAtDate.toISOString(),

      expiresAt:
        expiresAtDate.toISOString(),
    };

  /*
   * 축소된 위치만 메모리에 보관한다.
   * localStorage와 DB에는 저장하지 않는다.
   */
  setSessionLocation(
    temporaryLocation,
  );

  setLiveLocationStatus(
    "active",
  );

  /*
   * 기존 폐기 예약이 있으면 제거하고
   * 마지막 위치 확인 시점부터 60초를 다시 계산한다.
   */
  if (
    locationExpiryTimerRef.current !==
    null
  ) {
    window.clearTimeout(
      locationExpiryTimerRef.current,
    );
  }

  locationExpiryTimerRef.current =
    window.setTimeout(() => {
      /*
       * 임시 좌표를 메모리에서 폐기한다.
       */
      setSessionLocation(null);

      locationExpiryTimerRef.current =
        null;

      /*
       * 새 위치가 들어오지 않았다면
       * 위치 사용을 일시 중지 상태로 바꾼다.
       */
      setLiveLocationStatus(
        "paused",
      );
    }, 60_000);

  return temporaryLocation;
}

function stopHooLiveLocation() {
  /*
   * 브라우저 위치 감시가 실행 중이면
   * 즉시 명시적으로 중단한다.
   */
  if (
    typeof navigator !==
      "undefined" &&
    navigator.geolocation &&
    locationWatchIdRef.current !==
      null
  ) {
    navigator.geolocation.clearWatch(
      locationWatchIdRef.current,
    );

    locationWatchIdRef.current =
      null;
  }

  /*
   * 예약된 자동 폐기 타이머도 제거한다.
   */
  if (
    locationExpiryTimerRef.current !==
    null
  ) {
    window.clearTimeout(
      locationExpiryTimerRef.current,
    );

    locationExpiryTimerRef.current =
      null;
  }

  /*
   * 메모리에 남은 대략적 위치와
   * 현재 날씨도 즉시 제거한다.
   */
  setSessionLocation(null);
  setCurrentWeather(null);

  setLiveLocationStatus(
    "inactive",
  );

  lastWeatherRefreshAtRef.current =
    0;
}


async function fetchHooWeatherForLocation(
  location: HooSessionLocation,
) {
  /*
   * 위치가 이미 폐기 시각을 지났다면
   * 외부 요청을 보내지 않는다.
   */
  if (
    new Date(
      location.expiresAt,
    ).getTime() <= Date.now()
  ) {
    setSessionLocation(null);

    setLiveLocationStatus(
      "paused",
    );

    return null;
  }

  /*
   * 같은 위치 세션에서 지나치게 자주
   * 날씨를 요청하지 않도록 제한한다.
   */
  const millisecondsSinceLastRefresh =
    Date.now() -
    lastWeatherRefreshAtRef.current;

  if (
    millisecondsSinceLastRefresh <
      5 * 60 * 1000 &&
    currentWeather
  ) {
    return currentWeather;
  }

  setIsWeatherLoading(true);
  setWeatherErrorMessage("");

  try {
    /*
     * Open-Meteo에는 이미 약 1km 단위로
     * 축소된 좌표만 전달한다.
     */
    const weatherUrl =
      new URL(
        "https://api.open-meteo.com/v1/forecast",
      );

    weatherUrl.searchParams.set(
      "latitude",
      String(location.latitude),
    );

    weatherUrl.searchParams.set(
      "longitude",
      String(location.longitude),
    );

    weatherUrl.searchParams.set(
      "current",
      [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "weather_code",
        "cloud_cover",
        "wind_speed_10m",
      ].join(","),
    );

    weatherUrl.searchParams.set(
      "hourly",
      "precipitation_probability",
    );

    weatherUrl.searchParams.set(
      "daily",
      "sunrise,sunset",
    );

   /*
 * 현재 위치의 실제 시간대를 Open-Meteo가
 * 자동으로 선택하게 한다.
 *
 * 다른 지역으로 이동해도 해당 지역의
 * 날짜와 일출·일몰을 받을 수 있다.
 */
weatherUrl.searchParams.set(
  "timezone",
  "auto",
);

weatherUrl.searchParams.set(
  "forecast_days",
  "2",
);

    const weatherResponse =
      await fetch(
        weatherUrl.toString(),
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept:
              "application/json",
          },
        },
      );

    if (!weatherResponse.ok) {
      throw new Error(
        `날씨 API 응답 오류: ${weatherResponse.status}`,
      );
    }

    const weatherPayload =
  (await weatherResponse.json()) as {
    timezone?: string;
    utc_offset_seconds?: number;

    current?: {
      time?: string;
      temperature_2m?: number;
      relative_humidity_2m?: number;
      apparent_temperature?: number;
      is_day?: number;
      precipitation?: number;
      weather_code?: number;
      cloud_cover?: number;
      wind_speed_10m?: number;
    };

    hourly?: {
      time?: string[];
      precipitation_probability?:
        Array<number | null>;
    };

    daily?: {
      sunrise?: string[];
      sunset?: string[];
    };
  };

   const weatherCurrent =
  weatherPayload.current;

if (
  !weatherCurrent ||
  !weatherCurrent.time
) {
  throw new Error(
    "현재 날씨 정보가 없습니다.",
  );
}

/*
 * Open-Meteo가 반환한 현지 시각을
 * 정확한 UTC 시각으로 변환한다.
 */
function parseHooWeatherTime(
  value?: string,
) {
  if (!value) {
    return undefined;
  }

  /*
   * 이미 UTC 또는 시간대 정보가 포함된 값은
   * 그대로 해석한다.
   */
  if (
    value.endsWith("Z") ||
    /[+-]\d{2}:\d{2}$/.test(
      value,
    )
  ) {
    const parsedDate =
      new Date(value);

    if (
      Number.isNaN(
        parsedDate.getTime(),
      )
    ) {
      return undefined;
    }

    return parsedDate.toISOString();
  }

  /*
   * 시간대 정보가 없는 현지 시각은
   * Open-Meteo가 제공한 UTC 오프셋을 이용해
   * 정확한 UTC 시각으로 변환한다.
   */
  const utcOffsetSeconds =
    typeof weatherPayload
      .utc_offset_seconds ===
      "number"
      ? weatherPayload
          .utc_offset_seconds
      : 0;

  const localTimestamp =
    new Date(
      `${value}Z`,
    ).getTime();

  if (
    Number.isNaN(
      localTimestamp,
    )
  ) {
    return undefined;
  }

  return new Date(
    localTimestamp -
      utcOffsetSeconds * 1000,
  ).toISOString();
}

const forecastAt =
  parseHooWeatherTime(
    weatherCurrent.time,
  ) ??
  new Date().toISOString();

const forecastTimestamp =
  new Date(
    forecastAt,
  ).getTime();

const hourlyTimes =
  weatherPayload.hourly?.time ??
  [];

const hourlyRainProbabilities =
  weatherPayload.hourly
    ?.precipitation_probability ??
  [];

let nearestHourlyIndex = -1;

let nearestHourlyDifference =
  Number.POSITIVE_INFINITY;

hourlyTimes.forEach(
  (
    hourlyTime,
    index,
  ) => {
    const parsedHourlyTime =
      parseHooWeatherTime(
        hourlyTime,
      );

    if (!parsedHourlyTime) {
      return;
    }

    const difference =
      Math.abs(
        new Date(
          parsedHourlyTime,
        ).getTime() -
          forecastTimestamp,
      );

    if (
      difference <
      nearestHourlyDifference
    ) {
      nearestHourlyDifference =
        difference;

      nearestHourlyIndex =
        index;
    }
  },
);

const precipitationProbability =
  nearestHourlyIndex >= 0
    ? hourlyRainProbabilities[
        nearestHourlyIndex
      ]
    : undefined;

/*
 * timezone=auto를 사용하므로 첫 번째 값은
 * 현재 위치 기준 오늘의 일출·일몰이다.
 */
const sunriseAt =
  parseHooWeatherTime(
    weatherPayload.daily
      ?.sunrise?.[0],
  );

const sunsetAt =
  parseHooWeatherTime(
    weatherPayload.daily
      ?.sunset?.[0],
  );

  const weatherSnapshot:
  HooWeatherSnapshot = {


        forecastAt,
        provider:
          "open-meteo",

        weatherCode:
          weatherCurrent.weather_code,

        temperatureCelsius:
          weatherCurrent
            .temperature_2m,

        apparentTemperatureCelsius:
          weatherCurrent
            .apparent_temperature,

        relativeHumidity:
          weatherCurrent
            .relative_humidity_2m,

        precipitationProbability:
          typeof precipitationProbability ===
          "number"
            ? precipitationProbability
            : undefined,

        cloudCover:
          weatherCurrent.cloud_cover,

        windSpeedKmh:
          weatherCurrent
            .wind_speed_10m,

        isDay:
          typeof weatherCurrent.is_day ===
          "number"
            ? weatherCurrent.is_day ===
              1
            : undefined,

        sunriseAt,
        sunsetAt,
      };

    const {
      data: authData,
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !authData.user
    ) {
      throw new Error(
        "로그인이 필요합니다.",
      );
    }

    /*
     * 서버에는 좌표나 위치명이 아니라
     * 날씨 결과만 저장한다.
     */
    const {
      error: snapshotError,
    } = await supabase
      .from(
        "hoo_weather_snapshots",
      )
      .upsert(
        {
          user_id:
            authData.user.id,

          forecast_at:
            forecastAt,

          provider:
            weatherSnapshot.provider,

          weather_code:
            weatherSnapshot.weatherCode ??
            null,

          temperature_celsius:
            weatherSnapshot.temperatureCelsius ??
            null,

          apparent_temperature_celsius:
            weatherSnapshot.apparentTemperatureCelsius ??
            null,

          relative_humidity:
            weatherSnapshot.relativeHumidity ??
            null,

          precipitation_probability:
            weatherSnapshot.precipitationProbability ??
            null,

          cloud_cover:
            weatherSnapshot.cloudCover ??
            null,

          wind_speed_kmh:
            weatherSnapshot.windSpeedKmh ??
            null,

          is_day:
            weatherSnapshot.isDay ??
            null,

          sunrise_at:
            weatherSnapshot.sunriseAt ??
            null,

          sunset_at:
            weatherSnapshot.sunsetAt ??
            null,

          /*
           * raw_data에도 좌표나 API 원본 전체를
           * 넣지 않고 필요한 상태만 보관한다.
           */
          raw_data: {
            sourceTime:
              weatherCurrent.time,

            precipitation:
              weatherCurrent.precipitation ??
              null,
          },

          fetched_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "user_id,forecast_at,provider",
        },
      );

   if (snapshotError) {
  throw snapshotError;
}

/*
 * 저장된 날씨 결과를 오늘의
 * 아침·저녁 브리핑에 각각 반영한다.
 */
const todayBriefingDate =
  getTodayStorageDate();

const [
  morningWeatherResult,
  eveningWeatherResult,
  contextMessageResult,
] = await Promise.all([
  supabase.rpc(
    "apply_hoo_weather_to_morning_briefing",
    {
      p_briefing_date:
        todayBriefingDate,
    },
  ),

  supabase.rpc(
    "apply_hoo_weather_to_evening_briefing",
    {
      p_briefing_date:
        todayBriefingDate,
    },
  ),

  /*
   * 현재 날씨를 기준으로
   * 오늘의 상황형 메시지를 생성한다.
   */
  supabase.rpc(
    "generate_hoo_weather_context_messages",
    {
      p_message_date:
        todayBriefingDate,
    },
  ),
]);

if (morningWeatherResult.error) {
  /*
   * 아침 브리핑 결합에 실패해도
   * 날씨 확인 자체는 정상으로 유지한다.
   */
  console.error(
    "HOO 아침 날씨 브리핑 반영 실패:",
    morningWeatherResult.error,
  );
}

if (eveningWeatherResult.error) {
  /*
   * 저녁 브리핑이 아직 생성되지 않았거나
   * 결합에 실패하더라도 날씨 확인은 유지한다.
   */
  console.error(
    "HOO 저녁 날씨 브리핑 반영 실패:",
    eveningWeatherResult.error,
  );
}

if (contextMessageResult.error) {
  /*
   * 상황형 메시지 생성에 실패하더라도
   * 기본 날씨와 브리핑 기능은 정상 유지한다.
   */

  console.error(
    "HOO 상황형 메시지 생성 실패:",
    contextMessageResult.error,
  );
}

/*
 * DB에서 날씨가 반영된 최신 아침·저녁 본문을
 * 다시 읽어 새로고침 없이 화면에 적용한다.
 */
const {
  data: updatedBriefing,
  error: updatedBriefingError,
} = await supabase
  .from(
    "hoo_daily_briefings",
  )
  .select(
    `
      morning_content,
      morning_generated_at,
      evening_content,
      evening_generated_at,
      evening_status
    `,
  )
  .eq(
    "user_id",
    authData.user.id,
  )
  .eq(
    "briefing_date",
    todayBriefingDate,
  )
  .maybeSingle();

if (updatedBriefingError) {
  console.error(
    "HOO 날씨 브리핑 다시 불러오기 실패:",
    updatedBriefingError,
  );
}

if (updatedBriefing) {
  setMorningBriefing(
    (previousBriefing) => {
      if (
        !previousBriefing ||
        previousBriefing.briefingDate !==
          todayBriefingDate
      ) {
        return previousBriefing;
      }

      return {
        ...previousBriefing,

        morningContent:
          updatedBriefing.morning_content ??
          previousBriefing.morningContent,

        morningGeneratedAt:
          updatedBriefing.morning_generated_at ??
          previousBriefing.morningGeneratedAt,

        eveningContent:
          updatedBriefing.evening_content ??
          previousBriefing.eveningContent,

        eveningGeneratedAt:
          updatedBriefing.evening_generated_at ??
          previousBriefing.eveningGeneratedAt,

        eveningStatus:
          updatedBriefing.evening_status ===
          "completed"
            ? "completed"
            : previousBriefing.eveningStatus,
      };
    },
  );
}

setCurrentWeather(
  weatherSnapshot,
);

lastWeatherRefreshAtRef.current =
  Date.now();

return weatherSnapshot;


  } catch (error) {
    console.error(
      "HOO 날씨 확인 실패:",
      error,
    );

    setWeatherErrorMessage(
      "현재 지역의 날씨를 확인하지 못했어요.",
    );

    setLiveLocationStatus(
      "error",
    );

    return null;
  } finally {
    setIsWeatherLoading(false);
  }
}

/* ─────────────────────────────
   HOO 오늘의 일정 성격 분석
───────────────────────────── */


useEffect(() => {
  let cancelled = false;

  async function analyzeTodaySchedules() {
    /*
     * 사용자의 기기 시간대와 관계없이
     * 한국시간을 기준으로 실행 여부를 판단한다.
     */
    const koreaHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date()),
    );

    /*
     * 한국시간 자정부터 새벽 4시까지는
     * 새로운 일정 분석을 실행하지 않는다.
     */
    if (koreaHour < 4) {
      return;
    }

    const todayScheduleDate =
      getTodayStorageDate();

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        cancelled ||
        sessionError ||
        !session?.user
      ) {
        return;
      }

      const user = session.user;

      /*
       * 1. 오늘 일정의 성격을 분석한다.
       */
      const {
        data: analyzedCount,
        error: analysisError,
      } = await supabase.rpc(
        "analyze_hoo_daily_schedules",
        {
          p_schedule_date:
            todayScheduleDate,
        },
      );

      if (analysisError) {
        throw analysisError;
      }

      if (cancelled) {
        return;
      }

      /*
       * 2. 분석 결과를 아침 브리핑에 반영한다.
       */
      const {
        data: briefingRefreshed,
        error: briefingRefreshError,
      } = await supabase.rpc(
        "refresh_hoo_morning_briefing_from_insights",
        {
          p_briefing_date:
            todayScheduleDate,
        },
      );

      if (briefingRefreshError) {
        throw briefingRefreshError;
      }

      if (
        cancelled ||
        briefingRefreshed !== true
      ) {
        return;
      }

      /*
       * 3. 일정 분석 과정에서 아침 본문이 변경됐으므로
       * 최신 날씨를 다시 결합한다.
       */
      const {
        error: weatherRefreshError,
      } = await supabase.rpc(
        "apply_hoo_weather_to_morning_briefing",
        {
          p_briefing_date:
            todayScheduleDate,
        },
      );

      if (weatherRefreshError) {
        /*
         * 날씨 결합에 실패해도 일정 분석 브리핑은
         * 정상적으로 표시한다.
         */
        console.warn(
          "HOO 아침 브리핑 날씨 재반영 실패:",
          weatherRefreshError,
        );
      }

      if (cancelled) {
        return;
      }

      /*
       * 4. 일정과 날씨가 모두 반영된
       * 최신 아침 브리핑을 다시 불러온다.
       */
      const {
        data: updatedBriefing,
        error: updatedBriefingError,
      } = await supabase
        .from("hoo_daily_briefings")
        .select(
          `
            morning_title,
            morning_content,
            morning_generated_at,
            morning_read_at,
            morning_status,

            total_todo_count,
            completed_todo_count,
            incomplete_todo_count,
            completion_rate
          `,
        )
        .eq("user_id", user.id)
        .eq(
          "briefing_date",
          todayScheduleDate,
        )
        .maybeSingle();

      if (updatedBriefingError) {
        throw updatedBriefingError;
      }

      if (
        cancelled ||
        !updatedBriefing ||
        updatedBriefing.morning_status !==
          "completed" ||
        typeof updatedBriefing.morning_content !==
          "string"
      ) {
        return;
      }

      /*
       * 5. 페이지 전체를 새로고침하지 않고
       * 현재 브리핑 카드에 최신 내용을 반영한다.
       */
      setMorningBriefing(
        (previousBriefing) => {
          if (!previousBriefing) {
            return previousBriefing;
          }

          return {
            ...previousBriefing,

            morningTitle:
              typeof updatedBriefing.morning_title ===
              "string"
                ? updatedBriefing.morning_title
                : "좋은 아침이에요.",

            morningContent:
              updatedBriefing.morning_content,

            morningGeneratedAt:
              typeof updatedBriefing.morning_generated_at ===
              "string"
                ? updatedBriefing.morning_generated_at
                : undefined,

            morningReadAt:
              typeof updatedBriefing.morning_read_at ===
              "string"
                ? updatedBriefing.morning_read_at
                : undefined,

            morningStatus:
              "completed",

            totalTodoCount:
              Number(
                updatedBriefing.total_todo_count ??
                  previousBriefing.totalTodoCount,
              ),

            completedTodoCount:
              Number(
                updatedBriefing.completed_todo_count ??
                  previousBriefing.completedTodoCount,
              ),

            incompleteTodoCount:
              Number(
                updatedBriefing.incomplete_todo_count ??
                  previousBriefing.incompleteTodoCount,
              ),

            completionRate:
              Number(
                updatedBriefing.completion_rate ??
                  previousBriefing.completionRate,
              ),
          };
        },
      );

      setIsMorningBriefingOpen(true);

      const safeAnalyzedCount =
        typeof analyzedCount === "number"
          ? analyzedCount
          : Number(analyzedCount ?? 0);

      if (
        Number.isFinite(
          safeAnalyzedCount,
        ) &&
        safeAnalyzedCount > 0
      ) {
        console.log(
          `HOO가 오늘 일정 ${safeAnalyzedCount}개를 분석해 브리핑에 반영했습니다.`,
        );
      }
    } catch (error) {
      console.error(
        "HOO 오늘의 일정 분석 및 브리핑 반영 실패:",
        error,
      );

      /*
       * 분석에 실패해도 캘린더와 투두는
       * 기존 방식으로 정상 작동한다.
       */
    }
  }

  void analyzeTodaySchedules();

  return () => {
    cancelled = true;
  };
}, [
  schedules,
  supabase,
]);


async function handleBriefingRead() {
  if (!morningBriefing) {
    setIsBriefingModalOpen(false);
    return;
  }

  const isEveningBriefing =
    isHooEveningBriefingTime() &&
    morningBriefing.eveningStatus ===
      "completed" &&
    typeof morningBriefing.eveningContent ===
      "string" &&
    morningBriefing.eveningContent.trim()
      .length > 0;

  const readAt =
    new Date().toISOString();

  const readColumn =
    isEveningBriefing
      ? "evening_read_at"
      : "morning_read_at";

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
        "로그인 사용자를 확인할 수 없습니다.",
      );
    }

    const {
      data: updatedBriefings,
      error: updateError,
    } = await supabase
      .from("hoo_daily_briefings")
      .update({
        [readColumn]: readAt,
      })
      .eq("user_id", user.id)
      .eq(
        "briefing_date",
        morningBriefing.briefingDate,
      )
      .select(`
        id,
        morning_read_at,
        evening_read_at
      `);

    if (updateError) {
      throw updateError;
    }

    if (
      !updatedBriefings ||
      updatedBriefings.length === 0
    ) {
      throw new Error(
        "읽음 처리할 오늘의 브리핑을 찾지 못했습니다.",
      );
    }

    setMorningBriefing(
      (previousBriefing) => {
        if (!previousBriefing) {
          return previousBriefing;
        }

        return isEveningBriefing
          ? {
              ...previousBriefing,
              eveningReadAt: readAt,
            }
          : {
              ...previousBriefing,
              morningReadAt: readAt,
            };
      },
    );
  } catch (error) {
    console.error(
      "HOO 브리핑 읽음 기록 실패:",
      error,
    );
  } finally {
    setIsBriefingModalOpen(false);
  }
}

/* ─────────────────────────────
   HOO 브리핑 최초 자동 열기
───────────────────────────── */

useEffect(() => {
  if (
    isMorningBriefingLoading ||
    !morningBriefing
  ) {
    return;
  }

  const now = new Date();

  const hasEveningBriefing =
    isHooEveningBriefingTime() &&
    morningBriefing.eveningStatus ===
      "completed" &&
    typeof morningBriefing.eveningContent ===
      "string" &&
    morningBriefing.eveningContent.trim()
      .length > 0;

  const briefingPhase =
    hasEveningBriefing
      ? "evening"
      : "morning";

  const briefingKey =
    `${morningBriefing.briefingDate}:${briefingPhase}`;

  /*
   * 같은 렌더링 과정에서 중복 실행되는 것을 막는다.
   */
  if (
    lastAutoBriefingKeyRef.current ===
    briefingKey
  ) {
    return;
  }

  lastAutoBriefingKeyRef.current =
    briefingKey;

  const viewedStorageKey =
    `hoo-briefing-viewed:${briefingKey}`;

  const hasAlreadyViewed =
    window.localStorage.getItem(
      viewedStorageKey,
    ) === "true";

  /*
   * 오늘 해당 브리핑을 처음 불러온 경우에만
   * 중앙 모달을 자동으로 연다.
   */
  if (!hasAlreadyViewed) {
    setIsBriefingModalOpen(true);

    /*
     * 모달이 열린 순간 확인 기록을 남긴다.
     * 따라서 열린 상태에서 새로고침해도
     * 다시 자동 실행되지 않는다.
     */
    window.localStorage.setItem(
      viewedStorageKey,
      "true",
    );
  }
}, [
  isMorningBriefingLoading,
  morningBriefing,
]);

/* ─────────────────────────────
   HOO 브리핑 모달 제어
───────────────────────────── */

useEffect(() => {
  if (!isBriefingModalOpen) {
    return;
  }

  const previousBodyOverflow =
    document.body.style.overflow;

  /*
   * 모달이 열리면 뒤쪽 페이지 스크롤을 막는다.
   */
  document.body.style.overflow =
    "hidden";

  function handleBriefingKeyDown(
    event: KeyboardEvent,
  ) {
    if (event.key !== "Escape") {
      return;
    }

    setIsBriefingModalOpen(false);
  }

  window.addEventListener(
    "keydown",
    handleBriefingKeyDown,
  );

  return () => {
    document.body.style.overflow =
      previousBodyOverflow;

    window.removeEventListener(
      "keydown",
      handleBriefingKeyDown,
    );
  };
}, [isBriefingModalOpen]);


/* ─────────────────────────────
   HOO 반복 생활 확인 모달 제어
───────────────────────────── */

useEffect(() => {
  if (
    !isRoutineConfirmationOpen
  ) {
    return;
  }

  const previousBodyOverflow =
    document.body.style.overflow;

  /*
   * 반복 생활 확인창이 열려 있는 동안
   * 뒤쪽 메인화면의 스크롤을 막는다.
   */
  document.body.style.overflow =
    "hidden";

  function handleRoutineKeyDown(
    event: KeyboardEvent,
  ) {
    if (
      event.key !== "Escape" ||
      isRoutineSaving
    ) {
      return;
    }

    setIsRoutineConfirmationOpen(
      false,
    );

    setSelectedRoutineCandidate(
      null,
    );

    setRoutineStartTime("");
    setRoutineEndTime("");

    setShouldProtectRoutineTime(
      true,
    );
  }

  window.addEventListener(
    "keydown",
    handleRoutineKeyDown,
  );

  return () => {
    document.body.style.overflow =
      previousBodyOverflow;

    window.removeEventListener(
      "keydown",
      handleRoutineKeyDown,
    );
  };
}, [
  isRoutineConfirmationOpen,
  isRoutineSaving,
]);

/* ─────────────────────────────
   HOO 오늘의 일정 투두 생성
───────────────────────────── */
useEffect(() => {
  let cancelled = false;

  async function generateTodayScheduleTodos() {
    const now = new Date();

    /*
     * 자정부터 새벽 4시까지는
     * 투두와 브리핑을 동기화하지 않는다.
     */
    if (now.getHours() < 4) {
      return;
    }

    const todayTaskDate =
      getTodayStorageDate();

    function normalizeBriefingStatus(
      value: unknown,
    ): HooBriefingStatus {
      if (
        value === "generating" ||
        value === "completed" ||
        value === "failed"
      ) {
        return value;
      }

      return "pending";
    }

    try {
      /*
       * getUser()를 바로 호출하면
       * 로그인 세션이 없는 상태에서
       * AuthSessionMissingError가 발생할 수 있다.
       *
       * 먼저 로컬 세션 존재 여부를 확인하고,
       * 로그인 사용자가 있을 때만
       * 서버 동기화를 진행한다.
       */
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.user ||
        cancelled
      ) {
        return;
      }

      const user = session.user;

      /*
       * 캘린더 일정, 오늘의 투두,
       * 아침 브리핑을 서버에서 동기화한다.
       */
      const {
        data: changedTodoCount,
        error: generationError,
      } =
        await supabase.rpc(
          "generate_hoo_daily_todos",
          {
            p_task_date:
              todayTaskDate,
          },
        );

      if (generationError) {
        throw generationError;
      }

      if (cancelled) {
        return;
      }

      const safeChangedTodoCount =
        typeof changedTodoCount === "number"
          ? changedTodoCount
          : Number(
              changedTodoCount ?? 0,
            );

      /*
       * 실제 일정 변경이 없다면
       * 추가 조회를 실행하지 않는다.
       */
      if (
        !Number.isFinite(
          safeChangedTodoCount,
        ) ||
        safeChangedTodoCount <= 0
      ) {
        return;
      }

      /*
       * 최신 투두와 최신 브리핑을
       * 동시에 다시 불러온다.
       */
      const [
        updatedTodosResult,
        updatedBriefingResult,
      ] = await Promise.all([
        supabase
          .from("todos")
          .select(
            `
              id,
              content,
              completed,
              source,
              task_date,
              task_type,
              game_id,
              schedule_id,
              generated_at,
              archived_at,
              generation_reason,
              sort_order,
              created_at
            `,
          )
          .eq("user_id", user.id)
          .eq(
            "task_date",
            todayTaskDate,
          )
          .is("archived_at", null)
          .order("sort_order", {
            ascending: true,
          })
          .order("created_at", {
            ascending: true,
          }),

        supabase
          .from("hoo_daily_briefings")
          .select(
            `
              id,
              briefing_date,

              morning_title,
              morning_content,
              morning_generated_at,
              morning_read_at,
              morning_status,

              evening_title,
              evening_content,
              evening_generated_at,
              evening_read_at,
              evening_status,

              total_todo_count,
              completed_todo_count,
              incomplete_todo_count,
              completion_rate
            `,
          )
          .eq("user_id", user.id)
          .eq(
            "briefing_date",
            todayTaskDate,
          )
          .maybeSingle(),
      ]);

      if (updatedTodosResult.error) {
        throw updatedTodosResult.error;
      }

      if (updatedBriefingResult.error) {
        throw updatedBriefingResult.error;
      }

      if (cancelled) {
        return;
      }

      /*
       * 최신 투두를 화면에 반영한다.
       */
      const updatedTodos =
        updatedTodosResult.data;

      if (Array.isArray(updatedTodos)) {
        const normalizedTodos:
          TodoItem[] =
          updatedTodos.map((todo) => {
            const taskType: TodoTaskType =
              todo.task_type === "schedule" ||
              todo.task_type ===
                "preparation" ||
              todo.task_type ===
                "recommendation"
                ? todo.task_type
                : "manual";

            return {
              id: todo.id,
              content: todo.content,

              completed:
                todo.completed === true,

              source:
                todo.source === "hoo"
                  ? "hoo"
                  : "user",

              taskDate:
                typeof todo.task_date ===
                "string"
                  ? todo.task_date
                  : todayTaskDate,

              taskType,

              gameId:
                typeof todo.game_id ===
                "string"
                  ? todo.game_id
                  : undefined,

              scheduleId:
                typeof todo.schedule_id ===
                "string"
                  ? todo.schedule_id
                  : undefined,

              generatedAt:
                typeof todo.generated_at ===
                "string"
                  ? todo.generated_at
                  : undefined,

              archivedAt:
                typeof todo.archived_at ===
                "string"
                  ? todo.archived_at
                  : undefined,

              generationReason:
                typeof todo.generation_reason ===
                "string"
                  ? todo.generation_reason
                  : undefined,

              createdAt:
                typeof todo.created_at ===
                "string"
                  ? todo.created_at
                  : new Date().toISOString(),
            };
          });

        setTodos(normalizedTodos);

        window.localStorage.setItem(
          TODO_STORAGE_KEY,
          JSON.stringify(normalizedTodos),
        );
      }

      /*
       * 최신 아침·저녁 브리핑을 화면에 반영한다.
       */
      const updatedBriefing =
        updatedBriefingResult.data;

      if (updatedBriefing) {
        const normalizedBriefing:
          HooDailyBriefing = {
          id: updatedBriefing.id,

          briefingDate:
            typeof updatedBriefing.briefing_date ===
            "string"
              ? updatedBriefing.briefing_date
              : todayTaskDate,

          morningTitle:
            typeof updatedBriefing.morning_title ===
            "string"
              ? updatedBriefing.morning_title
              : "좋은 아침이에요.",

          morningContent:
            typeof updatedBriefing.morning_content ===
            "string"
              ? updatedBriefing.morning_content
              : "",

          morningGeneratedAt:
            typeof updatedBriefing.morning_generated_at ===
            "string"
              ? updatedBriefing.morning_generated_at
              : undefined,

          morningReadAt:
            typeof updatedBriefing.morning_read_at ===
            "string"
              ? updatedBriefing.morning_read_at
              : undefined,

          morningStatus:
            normalizeBriefingStatus(
              updatedBriefing.morning_status,
            ),

          eveningTitle:
            typeof updatedBriefing.evening_title ===
            "string"
              ? updatedBriefing.evening_title
              : undefined,

          eveningContent:
            typeof updatedBriefing.evening_content ===
            "string"
              ? updatedBriefing.evening_content
              : undefined,

          eveningGeneratedAt:
            typeof updatedBriefing.evening_generated_at ===
            "string"
              ? updatedBriefing.evening_generated_at
              : undefined,

          eveningReadAt:
            typeof updatedBriefing.evening_read_at ===
            "string"
              ? updatedBriefing.evening_read_at
              : undefined,

          eveningStatus:
            normalizeBriefingStatus(
              updatedBriefing.evening_status,
            ),

          totalTodoCount:
            Number(
              updatedBriefing.total_todo_count ??
                0,
            ),

          completedTodoCount:
            Number(
              updatedBriefing.completed_todo_count ??
                0,
            ),

          incompleteTodoCount:
            Number(
              updatedBriefing.incomplete_todo_count ??
                0,
            ),

          completionRate:
            Number(
              updatedBriefing.completion_rate ??
                0,
            ),
        };

        setMorningBriefing(
          normalizedBriefing,
        );

        setIsMorningBriefingOpen(true);
      }
    } catch (error) {
      console.error(
        "HOO 오늘의 일정과 브리핑 동기화 실패:",
        error,
      );

      /*
       * 자동 동기화가 실패해도
       * 현재 화면과 기존 기능은 유지한다.
       */
    }
  }

  void generateTodayScheduleTodos();

  return () => {
    cancelled = true;
  };
}, [
  schedules,
  supabase,
]);

/* ─────────────────────────────
   투두리스트 클라우드 불러오기
   기존 localStorage 기록 자동 이전
───────────────────────────── */

useEffect(() => {
  let cancelled = false;

 async function loadCloudTodos() {
  const now = new Date();
  const todayTaskDate =
    getTodayStorageDate();

  /*
   * 자정부터 새벽 4시까지는
   * 전날과 오늘의 투두를 모두 숨긴다.
   */
  if (now.getHours() < 4) {
    if (!cancelled) {
      setTodos([]);
      setIsTodoCloudReady(true);
    }

    return;
  }

  /*
   * 기존 로컬 투두 또는 서버 투두를
   * 현재 TodoItem 형식으로 변환한다.
   */
  function normalizeLocalTodos(
    value: unknown,
  ): TodoItem[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.reduce<TodoItem[]>(
      (result, item, index) => {
        if (
          !item ||
          typeof item !== "object"
        ) {
          return result;
        }

        const todo =
          item as Partial<TodoItem>;

        const content =
          typeof todo.content === "string"
            ? todo.content.trim()
            : "";

        if (!content) {
          return result;
        }

        /*
         * 개편 이전 투두에는 날짜가 없으므로
         * 최초 이전 시 오늘 날짜를 부여한다.
         */
        const taskDate =
          typeof todo.taskDate === "string"
            ? todo.taskDate
            : todayTaskDate;

        /*
         * 오늘 날짜가 아닌 투두는
         * 기록에서 삭제하지 않고 화면에서만 제외한다.
         */
        if (taskDate !== todayTaskDate) {
          return result;
        }

        const taskType: TodoTaskType =
          todo.taskType === "schedule" ||
          todo.taskType === "preparation" ||
          todo.taskType ===
            "recommendation"
            ? todo.taskType
            : "manual";

        result.push({
          id:
            typeof todo.id === "string"
              ? todo.id
              : createId(),

          content,

          completed:
            todo.completed === true,

          source:
            todo.source === "hoo"
              ? "hoo"
              : "user",

          taskDate,
          taskType,

          gameId:
            typeof todo.gameId === "string"
              ? todo.gameId
              : undefined,

          scheduleId:
            typeof todo.scheduleId === "string"
              ? todo.scheduleId
              : undefined,

          generatedAt:
            typeof todo.generatedAt === "string"
              ? todo.generatedAt
              : undefined,

          archivedAt:
            typeof todo.archivedAt === "string"
              ? todo.archivedAt
              : undefined,

          generationReason:
            typeof todo.generationReason ===
            "string"
              ? todo.generationReason
              : undefined,

          createdAt:
            typeof todo.createdAt === "string"
              ? todo.createdAt
              : new Date(
                  Date.now() + index,
                ).toISOString(),
        });

        return result;
      },
      [],
    );
  }

  try {
    const {
      data: { session },
      error: sessionError,
    } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const user =
      session?.user ?? null;

    /*
     * 비로그인 사용자는 로컬 데이터에서
     * 오늘 날짜의 투두만 불러온다.
     */
    if (!user) {
      const savedTodos =
        window.localStorage.getItem(
          TODO_STORAGE_KEY,
        );

      const localTodos =
        savedTodos
          ? normalizeLocalTodos(
              JSON.parse(savedTodos),
            )
          : [];

      if (!cancelled) {
        setTodos(localTodos);

        window.localStorage.setItem(
          TODO_STORAGE_KEY,
          JSON.stringify(localTodos),
        );
      }

      return;
    }

    /*
     * 로그인 사용자는 서버에서
     * 오늘 날짜의 활성 투두만 불러온다.
     */
    const {
      data: cloudTodos,
      error: cloudTodoError,
    } = await supabase
      .from("todos")
      .select(
        `
          id,
          content,
          completed,
          source,
          task_date,
          task_type,
          game_id,
          schedule_id,
          generated_at,
          archived_at,
          generation_reason,
          sort_order,
          created_at
        `,
      )
      .eq("user_id", user.id)
      .eq("task_date", todayTaskDate)
      .is("archived_at", null)
      .order("sort_order", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      });

    if (cloudTodoError) {
      throw cloudTodoError;
    }

    /*
     * 서버에 오늘의 투두가 있으면
     * 서버 데이터를 최우선으로 사용한다.
     */
    if (
      Array.isArray(cloudTodos) &&
      cloudTodos.length > 0
    ) {
      const normalizedTodos: TodoItem[] =
        cloudTodos.map((todo) => {
          const taskType: TodoTaskType =
            todo.task_type === "schedule" ||
            todo.task_type ===
              "preparation" ||
            todo.task_type ===
              "recommendation"
              ? todo.task_type
              : "manual";

          return {
            id: todo.id,
            content: todo.content,
            completed:
              todo.completed === true,

            source:
              todo.source === "hoo"
                ? "hoo"
                : "user",

            taskDate:
              typeof todo.task_date === "string"
                ? todo.task_date
                : todayTaskDate,

            taskType,

            gameId:
              typeof todo.game_id === "string"
                ? todo.game_id
                : undefined,

            scheduleId:
              typeof todo.schedule_id === "string"
                ? todo.schedule_id
                : undefined,

            generatedAt:
              typeof todo.generated_at === "string"
                ? todo.generated_at
                : undefined,

            archivedAt:
              typeof todo.archived_at === "string"
                ? todo.archived_at
                : undefined,

            generationReason:
              typeof todo.generation_reason ===
              "string"
                ? todo.generation_reason
                : undefined,

            createdAt:
              typeof todo.created_at === "string"
                ? todo.created_at
                : new Date().toISOString(),
          };
        });

      if (cancelled) {
        return;
      }

      setTodos(normalizedTodos);

      window.localStorage.setItem(
        TODO_STORAGE_KEY,
        JSON.stringify(normalizedTodos),
      );

      return;
    }

    /*
     * 서버에 오늘의 투두가 없다면
     * 기존 브라우저 투두를 오늘 날짜로 이전한다.
     */
    const savedTodos =
      window.localStorage.getItem(
        TODO_STORAGE_KEY,
      );

    const localTodos =
      savedTodos
        ? normalizeLocalTodos(
            JSON.parse(savedTodos),
          )
        : [];

    if (localTodos.length === 0) {
      if (!cancelled) {
        setTodos([]);
      }

      return;
    }

    const migrationRows =
      localTodos.map((todo, index) => ({
        id: todo.id,
        user_id: user.id,
        content: todo.content,
        completed: todo.completed,
        source: todo.source,
        task_date:
          todo.taskDate ?? todayTaskDate,
        task_type:
          todo.taskType ?? "manual",
        game_id:
          todo.gameId ?? null,
        schedule_id:
          todo.scheduleId ?? null,
        generated_at:
          todo.generatedAt ?? null,
        archived_at:
          todo.archivedAt ?? null,
        generation_reason:
          todo.generationReason ?? null,
        sort_order: index,
        created_at: todo.createdAt,
        updated_at:
          new Date().toISOString(),
      }));

    const { error: migrationError } =
      await supabase
        .from("todos")
        .upsert(migrationRows, {
          onConflict: "id",
        });

    if (migrationError) {
      throw migrationError;
    }

    if (!cancelled) {
      setTodos(localTodos);

      window.localStorage.setItem(
        TODO_STORAGE_KEY,
        JSON.stringify(localTodos),
      );

      console.log(
        `${localTodos.length}개의 기존 투두를 오늘 날짜로 이전했습니다.`,
      );
    }
  } catch (error) {
    console.error(
      "오늘의 투두리스트 불러오기 실패:",
      error,
    );

    /*
     * 서버 연결 실패 시에도
     * 이미 표시된 로컬 데이터는 삭제하지 않는다.
     */
  } finally {
    if (!cancelled) {
      setIsTodoCloudReady(true);
    }
  }
}

  void loadCloudTodos();

  return () => {
    cancelled = true;
  };
}, [supabase]);

/* ─────────────────────────────
   투두리스트 로컬 캐시 저장
───────────────────────────── */

useEffect(() => {
  if (
    !isLoaded ||
    !isTodoCloudReady
  ) {
    return;
  }

  window.localStorage.setItem(
    TODO_STORAGE_KEY,
    JSON.stringify(todos),
  );

}, [
  todos,
  isLoaded,
  isTodoCloudReady,
]);


/* ─────────────────────────────
   HOO 투두 날짜 자동 전환
   00:00 종료 · 04:00 시작
───────────────────────────── */

useEffect(() => {
  let previousDate =
    getTodayStorageDate();

  let previousPhase:
    | "preparing"
    | "active" =
    new Date().getHours() < 4
      ? "preparing"
      : "active";

  let scheduledReloadTimer:
    number | null = null;

  function clearScheduledReload() {
    if (
      scheduledReloadTimer === null
    ) {
      return;
    }

    window.clearTimeout(
      scheduledReloadTimer,
    );

    scheduledReloadTimer =
      null;
  }

  function scheduleTodoReload() {
    if (
      scheduledReloadTimer !== null
    ) {
      return;
    }

    /*
     * 새벽 4시 크론과 브라우저 새로고침이
     * 동시에 실행되는 경쟁 상태를 방지한다.
     *
     * 크론이 오늘의 투두와 브리핑을 저장할
     * 시간을 확보한 뒤 화면을 새로 불러온다.
     */
    scheduledReloadTimer =
      window.setTimeout(() => {
        scheduledReloadTimer =
          null;

        window.location.reload();
      }, 10_000);
  }

  function handleTodoDayCycle() {
    const now =
      new Date();

    const currentDate =
      getTodayStorageDate();

    const currentPhase:
      | "preparing"
      | "active" =
      now.getHours() < 4
        ? "preparing"
        : "active";

    const dateChanged =
      currentDate !== previousDate;

    const phaseChanged =
      currentPhase !== previousPhase;

    /*
     * 자정이 지나 날짜가 바뀌면
     * 전날 투두를 화면에서 즉시 종료한다.
     *
     * 서버의 기존 기록은 삭제하지 않는다.
     */
    if (
      dateChanged &&
      currentPhase === "preparing"
    ) {
      clearScheduledReload();

      setTodos([]);

      previousDate =
        currentDate;

      previousPhase =
        currentPhase;

      return;
    }

    /*
     * 새벽 4시가 되면 크론 작업이 끝날 시간을
     * 확보한 뒤 오늘 투두를 다시 불러온다.
     */
    if (
      phaseChanged &&
      currentPhase === "active"
    ) {
      previousDate =
        currentDate;

      previousPhase =
        currentPhase;

      scheduleTodoReload();

      return;
    }

    /*
     * 컴퓨터 절전 등으로 자정과 새벽 4시를
     * 모두 건너뛴 경우에도 오늘 화면으로 전환한다.
     */
    if (
      dateChanged &&
      currentPhase === "active"
    ) {
      previousDate =
        currentDate;

      previousPhase =
        currentPhase;

      scheduleTodoReload();

      return;
    }

    previousDate =
      currentDate;

    previousPhase =
      currentPhase;
  }

  /*
   * 브라우저 시간의 경계 오차를 줄이기 위해
   * 30초마다 날짜와 현재 단계를 확인한다.
   */
  const todoDayCycleInterval =
    window.setInterval(
      handleTodoDayCycle,
      30_000,
    );

  /*
   * 브라우저가 백그라운드에 있다가
   * 다시 열렸을 때 즉시 날짜를 확인한다.
   */
  function handleVisibilityChange() {
    if (
      document.visibilityState ===
      "visible"
    ) {
      handleTodoDayCycle();
    }
  }

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange,
  );

  return () => {
    clearScheduledReload();

    window.clearInterval(
      todoDayCycleInterval,
    );

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
  };
}, []);

/* ─────────────────────────────
   추천 투두 자동 저장
───────────────────────────── */

/* ─────────────────────────────
   미니게임 2판 완료 시 추천 투두 자동 완료
───────────────────────────── */
useEffect(() => {
  if (minigameCompletionCount >= 2) {
    setIsRecommendedTodoCompleted(true);
    setShowMissionCompleteToast(true);

    const timer = setTimeout(() => {
      setShowMissionCompleteToast(false);
    }, 2200);

    return () => clearTimeout(timer);
  }

  setIsRecommendedTodoCompleted(false);
  setShowMissionCompleteToast(false);
}, [minigameCompletionCount]);

/* ─────────────────────────────
   미니게임 완료 횟수 자동 저장
───────────────────────────── */

useEffect(() => {
  if (!isLoaded) {
    return;
  }

  window.localStorage.setItem(
    MINIGAME_COMPLETION_COUNT_STORAGE_KEY,
    String(minigameCompletionCount),
  );

  window.localStorage.setItem(
    MINIGAME_COMPLETION_DATE_STORAGE_KEY,
    getTodayStorageDate(),
  );
}, [minigameCompletionCount, isLoaded]);

useEffect(() => {
  if (!isLoaded) {
    return;
  }

  window.localStorage.setItem(
    RECOMMENDED_TODO_STORAGE_KEY,
    String(isRecommendedTodoCompleted),
  );
}, [isRecommendedTodoCompleted, isLoaded]);

  /* ─────────────────────────────
     즐겨찾기 자동 저장
  ───────────────────────────── */

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    window.localStorage.setItem(
      FAVORITE_STORAGE_KEY,
      JSON.stringify(favorites),
    );
  }, [favorites, isLoaded]);

  /* ─────────────────────────────
     타이머 작동
  ───────────────────────────── */

  useEffect(() => {
    if (!isTimerRunning) {
      return;
    }

    const timerInterval = window.setInterval(() => {
      setTimerRemaining((previousSeconds) => {
     if (previousSeconds <= 1) {
  window.clearInterval(timerInterval);
  setIsTimerRunning(false);

  playTimerAlarm();

  return 0;
}

        return previousSeconds - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timerInterval);
    };
  }, [isTimerRunning]);

  /* ─────────────────────────────
     스도쿠 타이머
  ───────────────────────────── */

  useEffect(() => {
    if (!isSudokuRunning) {
      return;
    }

    const sudokuInterval = window.setInterval(() => {
      setSudokuSeconds((previous) => previous + 1);
    }, 1000);

    return () => {
      window.clearInterval(sudokuInterval);
    };
  }, [isSudokuRunning]);


  /* ─────────────────────────────
   스도쿠 최고기록 자동 저장
───────────────────────────── */

useEffect(() => {
  if (!isLoaded) {
    return;
  }

  window.localStorage.setItem(
    SUDOKU_BEST_TIMES_STORAGE_KEY,
    JSON.stringify(sudokuBestTimes),
  );
}, [sudokuBestTimes, isLoaded]);


useEffect(() => {
  if (!isLoaded) {
    return;
  }

  window.localStorage.setItem(
    HOO2048_BEST_SCORES_STORAGE_KEY,
    JSON.stringify(hoo2048BestScores),
  );
}, [hoo2048BestScores, isLoaded]);

  /* ─────────────────────────────
     스도쿠 완료 기록 저장
  ───────────────────────────── */

useEffect(() => {
  if (!isSudokuCompleted || !sudokuPuzzleId) {
    return;
  }

  setSudokuBestTimes((previousBestTimes) => {
  const previousTime =
    previousBestTimes[sudokuDifficulty];

  if (
    previousTime !== null &&
    sudokuSeconds >= previousTime
  ) {
    return previousBestTimes;
  }

  return {
    ...previousBestTimes,
    [sudokuDifficulty]: sudokuSeconds,
  };
});

  if (submittedSudokuIdRef.current === sudokuPuzzleId) {
    return;
  }

  submittedSudokuIdRef.current = sudokuPuzzleId;

  setMinigameCompletionCount((previous) => previous + 1);

console.log("SAVE:", {
  puzzleId: sudokuPuzzleId,
  difficulty: sudokuDifficulty,
});

setIsSudokuSaving(true);
setSudokuSaveMessage("기록을 저장하고 있어요...");

void submitSudokuCompletion({
  puzzleId: sudokuPuzzleId,
  difficulty: sudokuDifficulty,
  elapsedSeconds: sudokuSeconds,
  hintsUsed: 3 - sudokuHintCount,
})
      .then((result) => {
        if (result.alreadyCompleted) {
          setSudokuSaveMessage("이미 점수를 받은 퍼즐이에요.");
          return;
        }

        setSudokuSaveMessage(
          `랭킹에 ${result.score}점이 저장됐어요!`,
        );
        setCommunityRefreshKey((previous) => previous + 1);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : "기록을 저장하지 못했어요.";

        if (message.includes("로그인이 필요")) {
          setSudokuSaveMessage(
            "로그인하면 이번 기록부터 랭킹 점수로 저장할 수 있어요.",
          );
          return;
        }

        setSudokuSaveMessage(message);
      })
      .finally(() => {
        setIsSudokuSaving(false);
      });
  }, [
    isSudokuCompleted,
    sudokuDifficulty,
    sudokuHintCount,
    sudokuPuzzleId,
    sudokuSeconds,
  ]);

  /* ─────────────────────────────
     달력 날짜 생성
  ───────────────────────────── */

  const calendarDays = useMemo(() => {
    const firstWeekDay = new Date(
      currentYear,
      currentMonth,
      1,
    ).getDay();

    const lastDate = new Date(
      currentYear,
      currentMonth + 1,
      0,
    ).getDate();

    const days: Array<number | null> = [];

    for (
      let emptyIndex = 0;
      emptyIndex < firstWeekDay;
      emptyIndex += 1
    ) {
      days.push(null);
    }

    for (let day = 1; day <= lastDate; day += 1) {
      days.push(day);
    }

    while (days.length < 42) {
      days.push(null);
    }

    return days;
  }, [currentYear, currentMonth]);

  /* ─────────────────────────────
     선택 날짜·일정
  ───────────────────────────── */

  const selectedDateInfo = useMemo(
    () => parseDateKey(selectedDate),
    [selectedDate],
  );

  const selectedDateLabel = useMemo(() => {
    const date = new Date(
      selectedDateInfo.year,
      selectedDateInfo.month - 1,
      selectedDateInfo.day,
    );

    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(date);
  }, [selectedDateInfo]);

 const selectedSchedules = (
  schedules[selectedDate] ?? []
).filter(
  (schedule) =>
    !isSecretLayerOn ||
    !schedule.isSecret,
);

  const selectedSchedule =
    selectedSchedules.find(
      (schedule) =>
        schedule.id === selectedScheduleId,
    ) ?? null;

    const visibleMemos = memos.filter(
  (memo) =>
    !isSecretLayerOn ||
    !memo.isSecret,
);

  useEffect(() => {
    if (selectedSchedules.length === 0) {
      setSelectedScheduleId(null);
      return;
    }

    const scheduleExists = selectedSchedules.some(
      (schedule) =>
        schedule.id === selectedScheduleId,
    );

    if (!scheduleExists) {
      setSelectedScheduleId(selectedSchedules[0].id);
    }
  }, [selectedSchedules, selectedScheduleId]);


function moveSelectedSchedule(
  direction: "previous" | "next",
) {
  if (
    selectedSchedules.length <= 1 ||
    isScheduleSliding
  ) {
    return;
  }

  const currentIndex =
    selectedSchedules.findIndex(
      (schedule) =>
        schedule.id === selectedScheduleId,
    );

  const safeCurrentIndex =
    currentIndex >= 0 ? currentIndex : 0;

  const currentSchedule =
    selectedSchedules[safeCurrentIndex];

  const nextIndex =
    direction === "next"
      ? (safeCurrentIndex + 1) %
        selectedSchedules.length
      : (
          safeCurrentIndex -
          1 +
          selectedSchedules.length
        ) %
        selectedSchedules.length;

  setPreviousSchedule(currentSchedule);

  setScheduleSlideDirection(
    direction === "next"
      ? "left"
      : "right",
  );

  setIsScheduleSliding(true);

  setSelectedScheduleId(
    selectedSchedules[nextIndex].id,
  );

  window.setTimeout(() => {
    setPreviousSchedule(null);
    setScheduleSlideDirection(null);
    setIsScheduleSliding(false);
  }, 320);
}

function startScheduleEditing(
  schedule: Schedule,
) {
  setEditingScheduleId(
    schedule.id,
  );

  setSelectedScheduleId(
    schedule.id,
  );

  setScheduleTitle(
    schedule.title,
  );

  setScheduleContent(
    schedule.content,
  );

  setScheduleStickerColor(
    schedule.stickerColor ??
      "yellow",
  );

  setScheduleRepeatType(
    schedule.repeatType,
  );

  setIsScheduleSecret(
    schedule.isSecret,
  );

  setScheduleEndDate("");
  setScheduleRepeatUntil("");
  setIsRepeatScheduleModalOpen(false);
}

function cancelScheduleEditing() {
  setEditingScheduleId(null);

  setScheduleTitle("");
  setScheduleContent("");

  setScheduleStickerColor(
    "yellow",
  );

  setScheduleRepeatType("none");
  setScheduleEndDate("");
  setScheduleRepeatUntil("");
  setIsScheduleSecret(false);
}


  /* ─────────────────────────────
     캘린더 이동
  ───────────────────────────── */

  function movePreviousMonth() {
    if (currentMonth === 0) {
      setCurrentYear((year) => year - 1);
      setCurrentMonth(11);
      return;
    }

    setCurrentMonth((month) => month - 1);
  }

  function moveNextMonth() {
    if (currentMonth === 11) {
      setCurrentYear((year) => year + 1);
      setCurrentMonth(0);
      return;
    }

    setCurrentMonth((month) => month + 1);
  }

  function moveToday() {
    const now = new Date();

    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());

    setSelectedDate(
      createDateKey(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ),
    );
  }

  function isToday(day: number) {
    return (
      currentYear === today.getFullYear() &&
      currentMonth === today.getMonth() &&
      day === today.getDate()
    );
  }

  /* ─────────────────────────────
     일정 저장·삭제
  ───────────────────────────── */

async function addSchedule(
  event?: FormEvent<HTMLFormElement>,
  requestedRepeatType?: ScheduleRepeatType,
) {
  event?.preventDefault();

  const title =
    scheduleTitle.trim();

  const content =
    scheduleContent.trim();

  if (!title) {
    return;
  }

  /*
   * 기존 일정 수정
   */
  if (editingScheduleId) {
    const targetSchedule =
      Object.values(schedules)
        .flat()
        .find(
          (schedule) =>
            schedule.id ===
            editingScheduleId,
        );

    if (!targetSchedule) {
      cancelScheduleEditing();
      return;
    }

    const updatedSchedule: Schedule = {
      ...targetSchedule,
      title,
      content,

      stickerColor:
        scheduleStickerColor,

      isSecret:
        isScheduleSecret,
    };

    /*
     * 화면에 먼저 수정 내용을 반영한다.
     */
    setSchedules(
      (previousSchedules) => {
        const nextSchedules:
          ScheduleMap = {};

        Object.entries(
          previousSchedules,
        ).forEach(
          ([
            dateKey,
            dateSchedules,
          ]) => {
            nextSchedules[dateKey] =
              dateSchedules.map(
                (schedule) =>
                  schedule.id ===
                  editingScheduleId
                    ? updatedSchedule
                    : schedule,
              );
          },
        );

        return nextSchedules;
      },
    );

    cancelScheduleEditing();

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      /*
       * 비로그인 상태에서는
       * localStorage에만 저장한다.
       */
      if (!user) {
        return;
      }

      const {
        error: updateError,
      } =
        await supabase
          .from("schedules")
          .update({
            title:
              updatedSchedule.title,

            content:
              updatedSchedule.content,

            sticker_color:
              updatedSchedule
                .stickerColor ??
              "yellow",

            is_secret:
              updatedSchedule.isSecret,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            editingScheduleId,
          )
          .eq(
            "user_id",
            user.id,
          );

      if (updateError) {
        throw updateError;
      }
    } catch (error) {
      console.error(
        "일정 수정 서버 저장 실패:",
        error,
      );

      /*
       * 서버 수정 실패 시
       * 원래 일정으로 되돌린다.
       */
      setSchedules(
        (previousSchedules) => {
          const nextSchedules:
            ScheduleMap = {};

          Object.entries(
            previousSchedules,
          ).forEach(
            ([
              dateKey,
              dateSchedules,
            ]) => {
              nextSchedules[dateKey] =
                dateSchedules.map(
                  (schedule) =>
                    schedule.id ===
                    targetSchedule.id
                      ? targetSchedule
                      : schedule,
                );
            },
          );

          return nextSchedules;
        },
      );

      window.alert(
        "일정 수정 내용을 서버에 저장하지 못했습니다.",
      );
    }

    return;
  }

  /*
   * 여기부터 새 일정 추가
   */
  const activeRepeatType =
    requestedRepeatType ??
    scheduleRepeatType;

  if (
    activeRepeatType ===
      "dailyRange" &&
    !scheduleEndDate
  ) {
    window.alert(
      "일별 묶기의 마지막 날짜를 선택해주세요.",
    );

    return;
  }

  if (
    (
      activeRepeatType ===
        "weekly" ||
      activeRepeatType ===
        "monthly"
    ) &&
    !scheduleRepeatUntil
  ) {
    window.alert(
      "반복 종료 날짜를 선택해주세요.",
    );

    return;
  }

  const scheduleDates =
    createScheduleDates({
      startDate:
        selectedDate,

      endDate:
        scheduleEndDate,

      repeatUntil:
        scheduleRepeatUntil,

      repeatType:
        activeRepeatType,
    });

  if (!event) {
    setIsRepeatScheduleModalOpen(
      false,
    );
  }

  const groupId =
    createId();

  const createdAt =
    new Date().toISOString();

  const newSchedules =
    scheduleDates.map(
      (date): Schedule => ({
        id:
          createId(),

        groupId,

        title,

        content,

        date,

        repeatType:
          activeRepeatType,

        createdAt,

        stickerColor:
          scheduleStickerColor,

        isSecret:
          isScheduleSecret,
      }),
    );

  /*
   * 화면에 먼저 추가한다.
   */
  setSchedules(
    (previousSchedules) => {
      const nextSchedules = {
        ...previousSchedules,
      };

      newSchedules.forEach(
        (schedule) => {
          const schedulesForDate =
            nextSchedules[
              schedule.date
            ] ?? [];

          nextSchedules[
            schedule.date
          ] = [
            ...schedulesForDate,
            schedule,
          ];
        },
      );

      return nextSchedules;
    },
  );

  const selectedDateSchedule =
    newSchedules.find(
      (schedule) =>
        schedule.date ===
        selectedDate,
    );

  setSelectedScheduleId(
    selectedDateSchedule?.id ??
      newSchedules[0]?.id ??
      null,
  );

  setScheduleTitle("");
  setScheduleContent("");

  setScheduleStickerColor(
    "yellow",
  );

  setScheduleRepeatType("none");
  setScheduleEndDate("");
  setScheduleRepeatUntil("");
  setIsScheduleSecret(false);

  /*
   * 서버에도 추가한다.
   */
  try {
    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    /*
     * 비로그인 상태에서는
     * localStorage에만 저장한다.
     */
    if (!user) {
      return;
    }

    const rows =
      newSchedules.map(
        (schedule) => ({
          id:
            schedule.id,

          user_id:
            user.id,

          group_id:
            schedule.groupId,

          title:
            schedule.title,

          content:
            schedule.content,

          schedule_date:
            schedule.date,

          repeat_type:
            schedule.repeatType,

          sticker_color:
            schedule.stickerColor ??
            "yellow",

          is_secret:
            schedule.isSecret,

          created_at:
            schedule.createdAt,

          updated_at:
            schedule.createdAt,
        }),
      );

    const {
      error: insertError,
    } =
      await supabase
        .from("schedules")
        .insert(rows);

    if (insertError) {
      throw insertError;
    }
  } catch (error) {
    console.error(
      "일정 서버 저장 실패:",
      error,
    );

    /*
     * 서버 추가 실패 시
     * 방금 추가한 일정을 화면에서도 제거한다.
     */
    const newScheduleIds =
      new Set(
        newSchedules.map(
          (schedule) =>
            schedule.id,
        ),
      );

    setSchedules(
      (previousSchedules) => {
        const nextSchedules:
          ScheduleMap = {};

        Object.entries(
          previousSchedules,
        ).forEach(
          ([
            dateKey,
            dateSchedules,
          ]) => {
            const filteredSchedules =
              dateSchedules.filter(
                (schedule) =>
                  !newScheduleIds.has(
                    schedule.id,
                  ),
              );

            if (
              filteredSchedules.length >
              0
            ) {
              nextSchedules[dateKey] =
                filteredSchedules;
            }
          },
        );

        return nextSchedules;
      },
    );

    setSelectedScheduleId(null);

    window.alert(
      "일정을 서버에 저장하지 못했습니다.",
    );
  }
}

async function deleteSchedule(
  scheduleId: string,
) {
  
  const targetSchedule =
  schedules[selectedDate]?.find(
    (schedule) =>
      schedule.id === scheduleId,
  );

  if (!targetSchedule) {
    return;
  }

  const isRepeatedSchedule =
  Boolean(targetSchedule.groupId) &&
  targetSchedule.repeatType !== undefined &&
  targetSchedule.repeatType !== "none";

  let deleteWholeGroup = false;

  if (isRepeatedSchedule) {
    deleteWholeGroup =
      window.confirm(
        "반복 일정 전체를 삭제할까요?\n\n확인: 반복 일정 전체 삭제\n취소: 선택한 일정만 삭제",
      );
  }

  setSchedules(
    (previousSchedules) => {
      const nextSchedules: ScheduleMap =
        {};

      Object.entries(
        previousSchedules,
      ).forEach(
        ([dateKey, dateSchedules]) => {
          const filteredSchedules =
            dateSchedules.filter(
              (schedule) => {
                if (deleteWholeGroup) {
                  return (
                    schedule.groupId !==
                    targetSchedule.groupId
                  );
                }

                return (
                  schedule.id !==
                  scheduleId
                );
              },
            );

          if (
            filteredSchedules.length > 0
          ) {
            nextSchedules[dateKey] =
              filteredSchedules;
          }
        },
      );

      return nextSchedules;
    },
  );

 setSelectedScheduleId(null);

/*
 * 서버에서도 삭제한다.
 */
try {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  /*
   * 비로그인 상태에서는
   * localStorage만 사용한다.
   */
  if (!user) {
    return;
  }

  if (deleteWholeGroup) {
    const { error: deleteError } =
      await supabase
        .from("schedules")
        .delete()
        .eq(
          "group_id",
          targetSchedule.groupId,
        )
        .eq(
          "user_id",
          user.id,
        );

    if (deleteError) {
      throw deleteError;
    }
  } else {
    const { error: deleteError } =
      await supabase
        .from("schedules")
        .delete()
        .eq(
          "id",
          scheduleId,
        )
        .eq(
          "user_id",
          user.id,
        );

    if (deleteError) {
      throw deleteError;
    }
  }
} catch (error) {
  console.error(
    "일정 서버 삭제 실패:",
    error,
  );

  window.alert(
    "일정을 서버에서 삭제하지 못했습니다.",
  );
}

}


  /* ─────────────────────────────
     메모 저장·수정·삭제
  ───────────────────────────── */
async function saveMemo(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  const title = memoTitle.trim();
  const content = memoContent.trim();

  if (!title && !content) {
    return;
  }

  const updatedAt =
    new Date().toISOString();

  /*
   * 기존 메모 수정
   */
  if (editingMemoId) {
    const previousMemo =
      memos.find(
        (memo) =>
          memo.id === editingMemoId,
      );

    if (!previousMemo) {
      cancelMemoEditing();
      return;
    }

    const updatedMemo: Memo = {
      ...previousMemo,
      title:
        title ||
        "제목 없는 메모",
      content,
      updatedAt,
      isSecret: isMemoSecret,
    };

    /*
     * 화면에 먼저 반영
     */
    setMemos((previousMemos) => [
      updatedMemo,
      ...previousMemos.filter(
        (memo) =>
          memo.id !== editingMemoId,
      ),
    ]);

    cancelMemoEditing();

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      /*
       * 비로그인 사용자는
       * localStorage만 사용
       */
      if (!user) {
        return;
      }

      const { error: updateError } =
        await supabase
          .from("memos")
          .update({
            title:
              updatedMemo.title,
            content:
              updatedMemo.content,
            is_secret:
              updatedMemo.isSecret,
            updated_at:
              updatedMemo.updatedAt,
          })
          .eq(
            "id",
            editingMemoId,
          )
          .eq(
            "user_id",
            user.id,
          );

      if (updateError) {
        throw updateError;
      }
    } catch (error) {
      console.error(
        "메모 수정 서버 저장 실패:",
        error,
      );

      /*
       * 서버 저장 실패 시
       * 이전 메모 상태 복원
       */
      setMemos((previousMemos) => {
        const withoutUpdatedMemo =
          previousMemos.filter(
            (memo) =>
              memo.id !==
              previousMemo.id,
          );

        const restoredMemos = [
          previousMemo,
          ...withoutUpdatedMemo,
        ];

        return restoredMemos.sort(
          (firstMemo, secondMemo) =>
            new Date(
              secondMemo.updatedAt,
            ).getTime() -
            new Date(
              firstMemo.updatedAt,
            ).getTime(),
        );
      });

      window.alert(
        "메모 수정 내용을 서버에 저장하지 못했습니다.",
      );
    }

    return;
  }

  /*
   * 새 메모 추가
   */
  const newMemo: Memo = {
    id: createId(),
    title:
      title ||
      "제목 없는 메모",
    content,
    updatedAt,
    isSecret: isMemoSecret,
  };

  /*
   * 화면에 먼저 반영
   */
  setMemos((previousMemos) => [
    newMemo,
    ...previousMemos,
  ]);

  cancelMemoEditing();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    /*
     * 비로그인 사용자는
     * localStorage만 사용
     */
    if (!user) {
      return;
    }

    const { error: insertError } =
      await supabase
        .from("memos")
        .insert({
          id: newMemo.id,
          user_id: user.id,
          title: newMemo.title,
          content: newMemo.content,
          is_secret:
            newMemo.isSecret,
          created_at:
            newMemo.updatedAt,
          updated_at:
            newMemo.updatedAt,
        });

    if (insertError) {
      throw insertError;
    }
  } catch (error) {
    console.error(
      "메모 추가 서버 저장 실패:",
      error,
    );

    /*
     * 서버 저장 실패 시
     * 새 메모 제거
     */
    setMemos((previousMemos) =>
      previousMemos.filter(
        (memo) =>
          memo.id !== newMemo.id,
      ),
    );

    window.alert(
      "메모를 서버에 저장하지 못했습니다.",
    );
  }
}


function startMemoEditing(
  memo: Memo,
) {
  setEditingMemoId(
    memo.id,
  );

  setMemoTitle(
    memo.title,
  );

  setMemoContent(
    memo.content,
  );

  setIsMemoSecret(
    memo.isSecret ?? false,
  );
}

function cancelMemoEditing() {
  setEditingMemoId(null);
  setMemoTitle("");
  setMemoContent("");
  setIsMemoSecret(false);
}

async function deleteMemo(
  memoId: string,
) {
  const targetMemo =
    memos.find(
      (memo) =>
        memo.id === memoId,
    );

  if (!targetMemo) {
    return;
  }

  const targetIndex =
    memos.findIndex(
      (memo) =>
        memo.id === memoId,
    );

  /*
   * 화면에서는 즉시 삭제한다.
   */
  setMemos((previousMemos) =>
    previousMemos.filter(
      (memo) =>
        memo.id !== memoId,
    ),
  );

  if (editingMemoId === memoId) {
    cancelMemoEditing();
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    /*
     * 비로그인 사용자는
     * localStorage만 사용한다.
     */
    if (!user) {
      return;
    }

    const { error: deleteError } =
      await supabase
        .from("memos")
        .delete()
        .eq("id", memoId)
        .eq("user_id", user.id);

    if (deleteError) {
      throw deleteError;
    }
  } catch (error) {
    console.error(
      "메모 삭제 서버 반영 실패:",
      error,
    );

    /*
     * 서버 삭제 실패 시
     * 기존 위치에 메모를 복원한다.
     */
    setMemos((previousMemos) => {
      const nextMemos = [
        ...previousMemos,
      ];

      nextMemos.splice(
        Math.max(
          0,
          targetIndex,
        ),
        0,
        targetMemo,
      );

      return nextMemos;
    });

    window.alert(
      "메모를 서버에서 삭제하지 못했습니다.",
    );
  }
}

  /* ─────────────────────────────
     즐겨찾기
  ───────────────────────────── */

  function editFavorite(index: number) {
    const currentFavorite = favorites[index];

    const name = window.prompt(
      "즐겨찾기 이름을 입력하세요.",
      currentFavorite.name,
    );

    if (name === null) {
      return;
    }

    const url = window.prompt(
      "사이트 주소를 입력하세요.",
      currentFavorite.url || "https://",
    );

    if (url === null) {
      return;
    }

    const icon = window.prompt(
      "아이콘으로 사용할 이모지를 입력하세요.",
      currentFavorite.icon || "⭐",
    );

    if (icon === null) {
      return;
    }

    setFavorites((previousFavorites) =>
      previousFavorites.map(
        (favorite, favoriteIndex) =>
          favoriteIndex === index
            ? {
                ...favorite,
                name: name.trim(),
                url: url.trim(),
                icon: icon.trim() || "⭐",
              }
            : favorite,
      ),
    );
  }

  function openFavorite(favorite: Favorite) {
    if (!favorite.url) {
      return;
    }

    const normalizedUrl =
      favorite.url.startsWith("http://") ||
      favorite.url.startsWith("https://")
        ? favorite.url
        : `https://${favorite.url}`;

    window.open(
      normalizedUrl,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function clearFavorite(index: number) {
    setFavorites((previousFavorites) =>
      previousFavorites.map(
        (favorite, favoriteIndex) =>
          favoriteIndex === index
            ? {
                ...favorite,
                name: "",
                url: "",
                icon: "",
              }
            : favorite,
      ),
    );
  }
async function addTodo(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  const content = todoContent.trim();

  if (!content) {
    return;
  }

  const now = new Date();

  /*
   * 자정부터 새벽 4시까지는 하루 전환 시간이다.
   * 이 시간에는 새로운 투두를 생성하지 않는다.
   */
  if (now.getHours() < 4) {
    window.alert(
      "HOO가 새로운 하루를 준비하고 있어요. 오늘의 투두는 새벽 4시부터 작성할 수 있습니다.",
    );

    return;
  }

  const todayTaskDate =
    getTodayStorageDate();

  const createdAt =
    now.toISOString();

  const newTodo: TodoItem = {
    id: createId(),
    content,
    completed: false,
    source: "user",
    taskDate: todayTaskDate,
    taskType: "manual",
    createdAt,
  };

  /*
   * 화면에는 즉시 투두를 추가한다.
   */
  setTodos((previousTodos) => [
    ...previousTodos,
    newTodo,
  ]);

  setTodoContent("");

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    /*
     * 비로그인 사용자는
     * 날짜 정보가 포함된 상태로 localStorage에 저장한다.
     */
    if (!user) {
      return;
    }

    const { error: insertError } =
      await supabase
        .from("todos")
        .insert({
          id: newTodo.id,
          user_id: user.id,
          content: newTodo.content,
          completed: newTodo.completed,
          source: newTodo.source,
          task_date: todayTaskDate,
          task_type: "manual",
          game_id: null,
          schedule_id: null,
          generated_at: null,
          archived_at: null,
          generation_reason: null,
          sort_order: todos.length,
          created_at: createdAt,
          updated_at: createdAt,
        });

    if (insertError) {
      throw insertError;
    }
  } catch (error) {
    console.error(
      "오늘의 투두 추가 서버 저장 실패:",
      error,
    );

    /*
     * 서버 저장에 실패하면
     * 화면에서도 새 투두를 제거한다.
     */
    setTodos((previousTodos) =>
      previousTodos.filter(
        (todo) => todo.id !== newTodo.id,
      ),
    );

    window.alert(
      "오늘의 투두를 서버에 저장하지 못했습니다.",
    );
  }
}


async function toggleTodo(
  todoId: string,
) {
  const targetTodo =
    todos.find(
      (todo) => todo.id === todoId,
    );

  if (!targetTodo) {
    return;
  }

  const nextCompleted =
    !targetTodo.completed;

  /*
   * 화면에는 즉시 완료 상태를 반영한다.
   */
  setTodos((previousTodos) =>
    previousTodos.map((todo) =>
      todo.id === todoId
        ? {
            ...todo,
            completed: nextCompleted,
          }
        : todo,
    ),
  );

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return;
    }

    const { error: updateError } =
      await supabase
        .from("todos")
        .update({
          completed: nextCompleted,
        })
        .eq("id", todoId)
        .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }
  } catch (error) {
    console.error(
      "투두 완료 상태 저장 실패:",
      error,
    );

    /*
     * 서버 저장 실패 시
     * 이전 완료 상태로 되돌린다.
     */
    setTodos((previousTodos) =>
      previousTodos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              completed:
                targetTodo.completed,
            }
          : todo,
      ),
    );

    window.alert(
      "투두 완료 상태를 저장하지 못했습니다.",
    );
  }
}


async function deleteTodo(
  todoId: string,
) {
  const targetTodo =
    todos.find(
      (todo) => todo.id === todoId,
    );

  if (!targetTodo) {
    return;
  }

  const targetIndex =
    todos.findIndex(
      (todo) => todo.id === todoId,
    );

  /*
   * 화면에서는 즉시 삭제한다.
   */
  setTodos((previousTodos) =>
    previousTodos.filter(
      (todo) => todo.id !== todoId,
    ),
  );

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return;
    }

    const { error: deleteError } =
      await supabase
        .from("todos")
        .delete()
        .eq("id", todoId)
        .eq("user_id", user.id);

    if (deleteError) {
      throw deleteError;
    }
  } catch (error) {
    console.error(
      "투두 삭제 서버 반영 실패:",
      error,
    );

    /*
     * 서버 삭제 실패 시
     * 기존 위치에 투두를 복원한다.
     */
    setTodos((previousTodos) => {
      const nextTodos = [
        ...previousTodos,
      ];

      nextTodos.splice(
        Math.max(0, targetIndex),
        0,
        targetTodo,
      );

      return nextTodos;
    });

    window.alert(
      "투두를 서버에서 삭제하지 못했습니다.",
    );
  }
}

async function saveTodoOrder(
  orderedTodos: TodoItem[],
) {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    /*
     * 비로그인 상태에서는
     * localStorage 저장만 사용한다.
     */
    if (!user) {
      return;
    }

    const updateResults =
      await Promise.all(
        orderedTodos.map(
          async (todo, index) => {
            const { error } =
              await supabase
                .from("todos")
                .update({
                  sort_order: index,
                  updated_at:
                    new Date().toISOString(),
                })
                .eq("id", todo.id)
                .eq("user_id", user.id);

            return error;
          },
        ),
      );

    const firstError =
      updateResults.find(
        (error) => error !== null,
      );

    if (firstError) {
      throw firstError;
    }
  } catch (error) {
    console.error(
      "투두 순서 서버 저장 실패:",
      error,
    );

    window.alert(
      "변경한 투두 순서를 서버에 저장하지 못했습니다.",
    );
  }
}

function handleTodoDragStart(
  event: React.DragEvent<HTMLElement>,
  todoId: string,
) {
  event.dataTransfer.effectAllowed =
    "move";

  event.dataTransfer.setData(
    "text/plain",
    todoId,
  );

  /*
   * Firefox에서도 드래그가 시작되도록
   * 반드시 전송 데이터를 함께 설정한다.
   */
  setDraggingTodoId(todoId);
  setDragOverTodoId(todoId);

  todoOrderDuringDragRef.current = [
    ...todos,
  ];
}

function handleTodoDragOver(
  event: React.DragEvent<HTMLElement>,
) {
  event.preventDefault();
  event.dataTransfer.dropEffect =
    "move";
}

function handleTodoDragEnter(
  targetTodoId: string,
) {
  if (
    !draggingTodoId ||
    draggingTodoId === targetTodoId ||
    dragOverTodoId === targetTodoId
  ) {
    return;
  }

  setDragOverTodoId(targetTodoId);

  setTodos((previousTodos) => {
    const draggedIndex =
      previousTodos.findIndex(
        (todo) =>
          todo.id === draggingTodoId,
      );

    const targetIndex =
      previousTodos.findIndex(
        (todo) =>
          todo.id === targetTodoId,
      );

    if (
      draggedIndex < 0 ||
      targetIndex < 0
    ) {
      return previousTodos;
    }

    const nextTodos = [
      ...previousTodos,
    ];

    const [draggedTodo] =
      nextTodos.splice(
        draggedIndex,
        1,
      );

    nextTodos.splice(
      targetIndex,
      0,
      draggedTodo,
    );

    todoOrderDuringDragRef.current =
      nextTodos;

    return nextTodos;
  });
}

function finishTodoDrag() {
  const orderedTodos =
    todoOrderDuringDragRef.current;

  setDraggingTodoId(null);
  setDragOverTodoId(null);
  todoOrderDuringDragRef.current = null;

  if (!orderedTodos) {
    return;
  }

  /*
   * 화면에는 이미 순서가 반영되어 있으므로
   * 드래그 종료 시 서버 순서만 저장한다.
   */
  void saveTodoOrder(
    orderedTodos,
  );
}

function handleTodoDrop(
  event: React.DragEvent<HTMLElement>,
) {
  event.preventDefault();
  event.stopPropagation();

  finishTodoDrag();
}

function handleTodoDragEnd() {
  finishTodoDrag();
}


function moveHorizontalPage(
  direction: "prev" | "next",
) {
  if (isHorizontalAnimatingRef.current) {
    return;
  }

  const nextPage =
    direction === "next"
      ? Math.min(horizontalPage + 1, 2)
      : Math.max(horizontalPage - 1, -1);

  if (nextPage === horizontalPage) {
    return;
  }

  isHorizontalAnimatingRef.current = true;

  setHorizontalPage(
    nextPage as -1 | 0 | 1 | 2,
  );

  setHorizontalProgress(nextPage);

  const section =
    horizontalSectionRef.current;

  if (section) {
    window.scrollTo({
      top: section.offsetTop,
      behavior: "auto",
    });
  }

  window.setTimeout(() => {
    isHorizontalAnimatingRef.current =
      false;
  }, 750);
}

function toggleSearchBar() {
  if (floatingButtonsDirection !== null) {
    return;
  }

  if (floatingButtonsTimerRef.current !== null) {
    window.clearTimeout(
      floatingButtonsTimerRef.current,
    );

    floatingButtonsTimerRef.current = null;
  }

  const searchButton =
    searchToggleButtonRef.current;

  if (searchButton) {
    const rect =
      searchButton.getBoundingClientRect();

    setFloatingButtonsTarget({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }

  if (!isSearchBarCollapsed) {
    setIsUiOpacityOpen(false);

    setFloatingButtonsDirection(
      "toSearch",
    );

    floatingButtonsTimerRef.current =
      window.setTimeout(() => {
        setIsSearchBarCollapsed(true);
        setShowFloatingButtons(false);
        setFloatingButtonsDirection(null);

        floatingButtonsTimerRef.current =
          null;
      }, 900);

    return;
  }

  setIsSearchBarCollapsed(false);
  setShowFloatingButtons(true);
  setFloatingButtonsDirection(
    "fromSearch",
  );

  floatingButtonsTimerRef.current =
    window.setTimeout(() => {
      setFloatingButtonsDirection(null);

      floatingButtonsTimerRef.current =
        null;
    }, 900);
}
  /* ─────────────────────────────
     타이머
  ───────────────────────────── */

  function playTimerAlarm() {
  const AudioContextClass =
    window.AudioContext ||
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();

  function beep(
    startTime: number,
    frequency: number,
    duration: number,
  ) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      frequency,
      startTime,
    );

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(
      0.18,
      startTime + 0.01,
    );
    gainNode.gain.linearRampToValueAtTime(
      0,
      startTime + duration,
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  const now = audioContext.currentTime;

  beep(now, 880, 0.13);
  beep(now + 0.18, 1100, 0.16);

  window.setTimeout(() => {
    void audioContext.close();
  }, 700);
}
  function applyTimerSetting() {
    const safeHours = Math.max(
      0,
      Math.min(99, Number(timerHours) || 0),
    );

    const safeMinutes = Math.max(
      0,
      Math.min(59, Number(timerMinutes) || 0),
    );

    const safeSeconds = Math.max(
      0,
      Math.min(59, Number(timerSeconds) || 0),
    );

    const totalSeconds =
      safeHours * 3600 +
      safeMinutes * 60 +
      safeSeconds;

    setTimerHours(safeHours);
    setTimerMinutes(safeMinutes);
    setTimerSeconds(safeSeconds);

    setTimerInitialSeconds(totalSeconds);
    setTimerRemaining(totalSeconds);
    setIsTimerRunning(false);
  }

  function startOrPauseTimer() {
    if (!isTimerRunning && timerRemaining === 0) {
      const totalSeconds =
        timerHours * 3600 +
        timerMinutes * 60 +
        timerSeconds;

      if (totalSeconds <= 0) {
        return;
      }

      setTimerInitialSeconds(totalSeconds);
      setTimerRemaining(totalSeconds);
    }

    setIsTimerRunning((previous) => !previous);
  }

  function resetTimer() {
    setIsTimerRunning(false);

    setTimerHours(0);
    setTimerMinutes(0);
    setTimerSeconds(0);

    setTimerInitialSeconds(0);
    setTimerRemaining(0);
  }

  const timerProgress =
    timerInitialSeconds > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (timerRemaining / timerInitialSeconds) * 100,
          ),
        )
      : 0;

  function startSudokuGame(difficulty: SudokuDifficulty) {
      console.log("START SUDOKU:", difficulty);
    const game = generateSudokuGame(difficulty);
    const puzzleId = createPuzzleId(difficulty);

    submittedSudokuIdRef.current = null;
    setSudokuPuzzleId(puzzleId);
    setSudokuSaveMessage("");
    setIsSudokuSaving(false);
    setSudokuDifficulty(difficulty);
    setSudokuPuzzle(game.puzzle);
    setSudokuBoard(copySudokuBoard(game.puzzle));
    setSudokuSolution(game.solution);
    setSelectedSudokuCell(null);
    setSudokuHintCount(3);
    setSudokuSeconds(0);
    setIsSudokuCompleted(false);
    setIsSudokuRunning(true);
  }

  function selectSudokuNumber(value: number) {
    if (!selectedSudokuCell || isSudokuCompleted) {
      return;
    }

    const { row, column } = selectedSudokuCell;

    if (sudokuPuzzle[row]?.[column] !== 0) {
      return;
    }

    const nextBoard = copySudokuBoard(sudokuBoard);
    nextBoard[row][column] = value;
    setSudokuBoard(nextBoard);

    const completed = nextBoard.every((boardRow, rowIndex) =>
      boardRow.every(
        (cellValue, columnIndex) =>
          cellValue === sudokuSolution[rowIndex][columnIndex],
      ),
    );

    if (completed) {
      setIsSudokuCompleted(true);
      setIsSudokuRunning(false);
    }
  }

  function useSudokuHint() {
    if (sudokuHintCount <= 0 || isSudokuCompleted) {
      return;
    }

    const availableCells: SudokuCell[] = [];

    sudokuBoard.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        if (value !== sudokuSolution[rowIndex][columnIndex]) {
          availableCells.push({ row: rowIndex, column: columnIndex });
        }
      });
    });

    if (availableCells.length === 0) {
      return;
    }

    const target =
      availableCells[Math.floor(Math.random() * availableCells.length)];
    const nextBoard = copySudokuBoard(sudokuBoard);
    nextBoard[target.row][target.column] =
      sudokuSolution[target.row][target.column];

    setSudokuBoard(nextBoard);
    setSelectedSudokuCell(target);
    setSudokuHintCount((previous) => previous - 1);

    const completed = nextBoard.every((boardRow, rowIndex) =>
      boardRow.every(
        (cellValue, columnIndex) =>
          cellValue === sudokuSolution[rowIndex][columnIndex],
      ),
    );

    if (completed) {
      setIsSudokuCompleted(true);
      setIsSudokuRunning(false);
    }
  }


async function submitFeedback() {
  const content = feedbackContent.trim();

  if (!content) {
    window.alert("내용을 입력해주세요.");
    return;
  }


  if (content.length > 100) {
    window.alert("피드백은 100자 이하로 입력해주세요.");
    return;
  }

  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: null,
        content,
      }),
    });

    const responseText = await response.text();

    let data: {
      success?: boolean;
      feedbackId?: string;
      error?: string;
    } = {};

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error(
          "피드백 API가 JSON이 아닌 응답을 반환했습니다:",
          responseText,
        );

        throw new Error(
          `피드백 서버 연결 오류가 발생했습니다. (${response.status})`,
        );
      }
    }

    if (!response.ok) {
      throw new Error(
        data.error ??
          `피드백을 전송하지 못했습니다. (${response.status})`,
      );
    }

    window.alert("피드백이 전송되었습니다.");

    setFeedbackContent("");
    setIsFeedbackOpen(false);
  } catch (error) {
    console.error("피드백 전송 실패:", error);

    const message =
      error instanceof Error
        ? error.message
        : "피드백 전송에 실패했습니다.";

    window.alert(message);
  }
}
const handleBackgroundUpload = async (file: File) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.alert("로그인 후 배경을 변경할 수 있습니다.");
      return;
    }

    const fileExt =
      file.name.split(".").pop() || "jpg";

    const filePath =
      `${user.id}/background-${Date.now()}.${fileExt}`;

    const {
      data: uploadData,
      error: uploadError,
    } = await supabase.storage
      .from("backgrounds")
      .upload(filePath, file, {
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: signedUrlData,
      error: signedUrlError,
    } = await supabase.storage
      .from("backgrounds")
      .createSignedUrl(
        uploadData.path,
        60 * 60 * 24 * 365,
      );

    if (signedUrlError) {
      throw signedUrlError;
    }

 window.localStorage.setItem(
  "hoo-background-url",
  signedUrlData.signedUrl,
);

setBackgroundUrl(
  signedUrlData.signedUrl,
);


    const { error: profileError } =
      await supabase
        .from("profiles")
        .update({
          background_url:
            uploadData.path,
        })
        .eq("id", user.id);

    if (profileError) {
      throw profileError;
    }
  } catch (error) {
    console.error(
      "배경 업로드 실패:",
      error,
    );

    window.alert(
      "배경 업로드에 실패했습니다.",
    );
  }
};

const handleBackgroundReset = () => {
  window.localStorage.removeItem(
    "hoo-background-url",
  );

  setBackgroundUrl(null);
};



  /* ─────────────────────────────
     화면
  ───────────────────────────── */

  const completedTodoCount =
  todos.filter((todo) => todo.completed).length +
  (isRecommendedTodoCompleted ? 1 : 0);

const totalTodoCount = todos.length + 1;


const todoProgressPercent = Math.round(
  (completedTodoCount / totalTodoCount) * 100,
);

const safeTodoProgressPercent =
  Number.isFinite(todoProgressPercent)
    ? todoProgressPercent
    : 0;

const todoProgressMessage =
  todoProgressPercent === 100
    ? "오늘의 목표를 모두 완료했어요! 🎉"
    : todoProgressPercent >= 75
      ? "거의 다 왔어요. 마지막까지 힘내요!"
      : todoProgressPercent >= 50
        ? "절반을 넘었어요. 좋은 흐름이에요!"
        : todoProgressPercent >= 25
          ? "차근차근 잘 해내고 있어요."
          : "작은 목표 하나부터 시작해보세요.";

const todoProgressStyle =
  todoProgressPercent === 100
    ? {
        text: "text-[#25955a]",
        bar: "bg-[#49bd7b]",
        card: "bg-[#effdf5]",
        border: "border-[#9be0b8]",
      }
    : todoProgressPercent >= 75
      ? {
          text: "text-[#3579c7]",
          bar: "bg-[#5597df]",
          card: "bg-[#f0f7ff]",
          border: "border-[#b8d8f5]",
        }
      : todoProgressPercent >= 50
        ? {
            text: "text-[#6659bf]",
            bar: "bg-[#7467d8]",
            card: "bg-[#f7f5ff]",
            border: "border-[#d8d0ff]",
          }
        : {
            text: "text-[#8c849d]",
            bar: "bg-[#aaa4b8]",
            card: "bg-[#faf9fc]",
            border: "border-[#e3deea]",
          };

useEffect(() => {
  if (safeTodoProgressPercent !== 100) {
    setShowTodoCompleteCelebration(false);
    return;
  }

  setShowTodoCompleteCelebration(true);

  const timer = window.setTimeout(() => {
    setShowTodoCompleteCelebration(false);
  }, 2500);

  return () => {
    window.clearTimeout(timer);
  };
}, [safeTodoProgressPercent]);

async function updateContextMessageStatus(
  nextStatus:
    | "read"
    | "dismissed",
) {
  if (!contextMessage) {
    return;
  }

  const targetMessageId =
    contextMessage.id;

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
        "로그인이 필요합니다.",
      );
    }

    const {
      data: updatedMessages,
      error: updateError,
    } = await supabase
      .from("hoo_context_messages")
      .update({
        status: nextStatus,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        targetMessageId,
      )
      .eq(
        "user_id",
        user.id,
      )
      .select(`
        id,
        status,
        updated_at
      `);

    if (updateError) {
      throw updateError;
    }

    if (
      !updatedMessages ||
      updatedMessages.length === 0
    ) {
      throw new Error(
        "상태를 변경할 예약 메시지를 찾지 못했습니다.",
      );
    }

    setContextMessage(null);
    setIsContextMessageOpen(false);

    setContextMessageRefreshKey(
      (previousKey) =>
        previousKey + 1,
    );
  } catch (error) {
    console.error(
      "HOO 예약 메시지 상태를 변경하지 못했습니다.",
      error,
    );

    window.alert(
      "메시지를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
  }
}

async function handleContextMessageRead() {
  await updateContextMessageStatus(
    "read",
  );
}

async function handleContextMessageDismiss() {
  await updateContextMessageStatus(
    "dismissed",
  );
}

async function handleContextMessageDoNotShowAgain() {
  if (!contextMessage) {
    return;
  }

  const targetMessageDate =
    contextMessage.messageDate;

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
        "로그인이 필요합니다.",
      );
    }

    /*
     * 오늘 표시 중인 메시지와
     * 아직 표시되지 않은 메시지를 모두 숨긴다.
     */
    const {
      data: dismissedMessages,
      error: dismissError,
    } = await supabase
      .from("hoo_context_messages")
      .update({
        status: "dismissed",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "user_id",
        user.id,
      )
      .eq(
        "message_date",
        targetMessageDate,
      )
      .in(
        "status",
        [
          "pending",
          "ready",
          "delivered",
          "displayed",
        ],
      )
      .select(`
        id,
        status
      `);

    if (dismissError) {
      throw dismissError;
    }

    if (
      !dismissedMessages ||
      dismissedMessages.length === 0
    ) {
      throw new Error(
        "오늘 숨길 예약 메시지를 찾지 못했습니다.",
      );
    }

    setContextMessage(null);
    setIsContextMessageOpen(false);

    /*
     * 오늘 메시지가 모두 dismissed 상태이므로
     * 다음 예약일의 메시지를 확인한다.
     */
    setContextMessageRefreshKey(
      (previousKey) =>
        previousKey + 1,
    );
  } catch (error) {
    console.error(
      "오늘의 HOO 메시지 숨김 처리 실패:",
      error,
    );

    window.alert(
      "오늘의 메시지를 숨기지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
  }
}


return (
  <main
    className="relative min-h-[100dvh] overflow-x-hidden bg-[#102f24] text-[#332f45]"
    style={{
      fontFamily:
        '"Arial Rounded MT Bold", "Trebuchet MS", "Malgun Gothic", sans-serif',

      backgroundImage: backgroundUrl
        ? `url("${backgroundUrl}")`
        : 'url("/hoo-bg.png")',

      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundAttachment: "fixed",
    }}
  >
{isSecretPinModalOpen && (
  <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 px-5 backdrop-blur-sm">
    <div className="w-full max-w-sm rounded-[28px] bg-white p-7 shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-[#7467d8]">
            SECRET LAYER
          </p>

          <h2 className="mt-1 text-xl font-black text-[#332f45]">
            PIN 번호 입력
          </h2>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsSecretPinModalOpen(false);
            setSecretPinInput("");
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1eff7] text-xl font-black text-[#777083] transition hover:bg-[#e5e1ef]"
          aria-label="PIN 입력창 닫기"
        >
          ×
        </button>
      </div>

      <p className="mt-3 text-sm font-bold leading-6 text-[#8b849d]">
  시크릿 일정과 메모를 표시하려면 PIN을 입력하세요.
</p>

      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();

          if (secretPinInput !== secretPin) {
            window.alert("PIN 번호가 올바르지 않습니다.");
            setSecretPinInput("");
            return;
          }

          setIsSecretLayerOn(false);
setIsSecretPinModalOpen(false);
setSecretPinInput("");
        }}
      >
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={4}
          value={secretPinInput}
          onChange={(event) => {
            const nextValue =
              event.target.value.replace(
                /[^0-9]/g,
                "",
              );

            setSecretPinInput(nextValue);
          }}
          placeholder="4자리 PIN"
          className="w-full rounded-2xl border border-[#ded8ef] bg-[#faf9ff] px-5 py-4 text-center text-2xl font-black tracking-[0.5em] text-[#5145b5] outline-none transition focus:border-[#7467d8]"
        />

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setIsSecretPinModalOpen(false);
              setSecretPinInput("");
            }}
            className="flex-1 rounded-2xl border border-[#ded8ef] bg-white px-4 py-3 text-sm font-black text-[#777083] transition hover:bg-[#f7f5ff]"
          >
            취소
          </button>

          <button
            type="submit"
            disabled={secretPinInput.length !== 4}
            className="flex-1 rounded-2xl bg-[#7467d8] px-4 py-3 text-sm font-black text-white transition hover:bg-[#6255c7] disabled:cursor-not-allowed disabled:bg-[#c9c4df]"
          >
            확인
          </button>
        </div>
      </form>

       <button
        type="button"
        onClick={() => {
          setIsSecretPinModalOpen(false);
          setSecretPinInput("");
          setCurrentSecretPinInput("");
          setNewSecretPinInput("");
          setConfirmSecretPinInput("");
          setIsSecretPinChangeModalOpen(true);
        }}
        className="mt-4 w-full text-center text-xs font-black text-[#7467d8] transition hover:text-[#5145b5]"
      >
        PIN 번호 변경
      </button>
    </div>
  </div>
)}

{isSecretPinChangeModalOpen && (
  <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 px-5 backdrop-blur-sm">
    <div className="w-full max-w-sm rounded-[28px] bg-white p-7 shadow-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-[#332f45]">
          PIN 번호 변경
        </h2>

        <button
          type="button"
          onClick={() => {
            setIsSecretPinChangeModalOpen(false);
            setCurrentSecretPinInput("");
            setNewSecretPinInput("");
            setConfirmSecretPinInput("");
          }}
        >
          ×
        </button>
      </div>

      <form
        className="mt-6 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();

          if (currentSecretPinInput !== secretPin) {
            window.alert("현재 PIN 번호가 올바르지 않습니다.");
            setCurrentSecretPinInput("");
            return;
          }

          if (!/^\d{4}$/.test(newSecretPinInput)) {
            window.alert("새 PIN은 숫자 4자리로 입력해주세요.");
            return;
          }

          if (
            newSecretPinInput !==
            confirmSecretPinInput
          ) {
            window.alert("새 PIN 번호가 서로 다릅니다.");
            setConfirmSecretPinInput("");
            return;
          }

          setSecretPin(newSecretPinInput);
          setIsSecretPinChangeModalOpen(false);
          setCurrentSecretPinInput("");
          setNewSecretPinInput("");
          setConfirmSecretPinInput("");

          window.alert("PIN 번호가 변경되었습니다.");
        }}
      >
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={currentSecretPinInput}
          onChange={(event) =>
            setCurrentSecretPinInput(
              event.target.value.replace(/[^0-9]/g, ""),
            )
          }
          placeholder="현재 PIN"
          className="w-full rounded-2xl border px-5 py-4 text-center"
        />

        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={newSecretPinInput}
          onChange={(event) =>
            setNewSecretPinInput(
              event.target.value.replace(/[^0-9]/g, ""),
            )
          }
          placeholder="새 PIN"
          className="w-full rounded-2xl border px-5 py-4 text-center"
        />

        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={confirmSecretPinInput}
          onChange={(event) =>
            setConfirmSecretPinInput(
              event.target.value.replace(/[^0-9]/g, ""),
            )
          }
          placeholder="새 PIN 확인"
          className="w-full rounded-2xl border px-5 py-4 text-center"
        />

        <button
          type="submit"
          className="w-full rounded-2xl bg-[#7467d8] px-4 py-3 font-black text-white"
        >
          변경
        </button>
      </form>
    </div>
  </div>
)}

      {isRepeatScheduleModalOpen && (
  <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 backdrop-blur-sm">
    <div className="w-full max-w-2xl rounded-[32px] bg-white p-8 shadow-2xl">

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">

          {repeatScheduleModalType === "dailyRange" &&
            "연속 일정 만들기"}

          {repeatScheduleModalType === "weekly" &&
            "주간 일정 만들기"}

          {repeatScheduleModalType === "monthly" &&
            "월간 일정 만들기"}

        </h2>

        <button
  type="button"
  onClick={() => {
    setIsRepeatScheduleModalOpen(false);
    setIsScheduleSecret(false);
  }}
>
  ×
</button>

      </div>

     <p className="mt-2 text-sm font-bold text-[#8b849d]">
  {repeatScheduleModalType === "dailyRange" &&
    "시작일부터 종료일까지 이어지는 일정을 설정합니다."}

  {repeatScheduleModalType === "weekly" &&
    "시작 날짜의 요일을 기준으로 매주 반복합니다."}

  {repeatScheduleModalType === "monthly" &&
    "시작 날짜의 주차와 요일을 기준으로 매달 반복합니다."}
</p>

<div className="mt-7 space-y-5">
  <div>
    <label className="mb-2 block text-sm font-black text-[#423c55]">
      일정 제목
    </label>

    <input
      type="text"
      value={scheduleTitle}
      maxLength={50}
      onChange={(event) =>
        setScheduleTitle(event.target.value)
      }
      placeholder="일정 제목을 입력하세요."
      className="w-full rounded-2xl border border-[#ded8ef] bg-[#faf9ff] px-5 py-3 text-sm font-bold outline-none transition focus:border-[#7467d8]"
    />
  </div>

  <div>
    <label className="mb-2 block text-sm font-black text-[#423c55]">
      일정 내용
    </label>

   <textarea
  value={scheduleContent}
  maxLength={300}
  onChange={(event) =>
    setScheduleContent(
      event.target.value,
    )
  }
  placeholder="일정 내용을 입력하세요."
  rows={4}
  className="w-full resize-none rounded-2xl border border-[#ded8ef] bg-[#faf9ff] px-5 py-3 text-sm font-bold leading-6 outline-none transition focus:border-[#7467d8]"
/>

<div className="mt-4 rounded-2xl border border-[#ded8ef] bg-[#faf9ff] p-4">
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-sm font-black text-[#423c55]">
        스티커 색상
      </p>

      <p className="mt-1 text-[11px] font-bold text-[#8b849d]">
        반복 일정 전체에 같은 색상이 적용됩니다.
      </p>
    </div>

    <span className="text-[11px] font-black text-[#7467d8]">
      {
        SCHEDULE_STICKER_COLORS.find(
          (color) =>
            color.value ===
            scheduleStickerColor,
        )?.label
      }
    </span>
  </div>

  <div className="mt-4 grid grid-cols-6 gap-2">
    {SCHEDULE_STICKER_COLORS.map(
      (color) => {
        const isSelected =
          scheduleStickerColor ===
          color.value;

        return (
          <button
            key={color.value}
            type="button"
            onClick={() =>
              setScheduleStickerColor(
                color.value,
              )
            }
            title={color.label}
            aria-label={`${color.label} 스티커 선택`}
            aria-pressed={
              isSelected
            }
            className={`relative flex aspect-square min-h-9 items-center justify-center rounded-xl border-2 transition ${
              color.previewClassName
            } ${
              isSelected
                ? "scale-110 border-[#5c4fb5] shadow-[0_5px_14px_rgba(92,79,181,0.3)]"
                : "border-transparent hover:scale-105 hover:border-white"
            }`}
          >
            {isSelected && (
              <span className="text-base font-black text-[#403761]">
                ✓
              </span>
            )}
          </button>
        );
      },
    )}
  </div>
</div>
  </div>

  <div className="grid gap-4 sm:grid-cols-2">
    
    <div>
      <label className="mb-2 block text-sm font-black text-[#423c55]">
        시작 날짜
      </label>

      <input
        type="date"
        value={selectedDate}
        readOnly
        className="w-full rounded-2xl border border-[#ded8ef] bg-[#f1eff7] px-5 py-3 text-sm font-bold text-[#716a82] outline-none"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-black text-[#423c55]">
        종료 날짜
      </label>

      {repeatScheduleModalType === "dailyRange" ? (
        <input
          type="date"
          value={scheduleEndDate}
          min={selectedDate}
          onChange={(event) =>
            setScheduleEndDate(
              event.target.value,
            )
          }
          className="w-full rounded-2xl border border-[#ded8ef] bg-white px-5 py-3 text-sm font-bold outline-none transition focus:border-[#7467d8]"
        />
      ) : (
        <input
          type="date"
          value={scheduleRepeatUntil}
          min={selectedDate}
          onChange={(event) =>
            setScheduleRepeatUntil(
              event.target.value,
            )
          }
          className="w-full rounded-2xl border border-[#ded8ef] bg-white px-5 py-3 text-sm font-bold outline-none transition focus:border-[#7467d8]"
        />
      )}
    </div>
  </div>
</div>

<button
  type="button"
  onClick={() =>
    setIsScheduleSecret(
      (previous) => !previous,
    )
  }
  className={`mt-5 flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${
    isScheduleSecret
      ? "border-[#7467d8] bg-[#eeeaff] text-[#5145b5]"
      : "border-[#ded8ef] bg-[#faf9ff] text-[#777083]"
  }`}
>
  <div>
    <p className="text-sm font-black">
      시크릿레이어에 저장
    </p>

    <p className="mt-1 text-xs font-bold text-white/70">
      생성되는 반복 일정 전체가 시크릿으로 저장됩니다.
    </p>
  </div>

  <span
    className={`flex h-6 w-11 items-center rounded-full p-1 transition ${
      isScheduleSecret
        ? "justify-end bg-[#7467d8]"
        : "justify-start bg-[#d7d2df]"
    }`}
  >
    <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
  </span>
</button>

<div className="mt-8 flex justify-end gap-3">
 
 <button
  type="button"
  onClick={() => {
    setIsRepeatScheduleModalOpen(false);
    setIsScheduleSecret(false);
  }}
  className="rounded-2xl border border-[#ded8ef] bg-white px-5 py-3 text-sm font-black text-[#ECECEC] transition hover:bg-[#f7f5ff]"
>
  취소
</button>

<button
  type="button"
  onClick={() =>
    addSchedule(
      undefined,
      repeatScheduleModalType,
    )
  }
  className="rounded-2xl bg-[#7467d8] px-6 py-3 text-sm font-black text-white transition hover:bg-[#6255c7]"
>
  {repeatScheduleModalType === "dailyRange" &&
    "연속 일정 만들기"}

  {repeatScheduleModalType === "weekly" &&
    "주간 일정 만들기"}

  {repeatScheduleModalType === "monthly" &&
    "월간 일정 만들기"}
</button>
</div>
    </div>
  </div>
)}

      
      {showTodoCompleteCelebration && (
  <div className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center">
    <div className="hoo-todo-celebration rounded-[32px] border border-[#9be0b8] bg-white/95 px-10 py-8 text-center shadow-[0_25px_80px_rgba(37,149,90,0.35)] backdrop-blur-xl">
      <p className="text-5xl">🏆</p>

      <p className="mt-4 text-2xl font-black text-[#25955a]">
        오늘의 목표 완료!
      </p>

      <p className="mt-2 text-sm font-bold text-[#6d7d72]">
        오늘의 모든 목표를 멋지게 해냈어요!
      </p>
    </div>
  </div>
)}


   {/* 고정 배경 */}
<div
  aria-hidden="true"
  className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#102f24]"
>
  <div
    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
    style={{
      backgroundImage: backgroundUrl
        ? `url("${backgroundUrl}")`
        : 'url("/hoo-bg.png")',
    }}
  />

  <div className="absolute inset-0 bg-gradient-to-b from-[#020714]/35 via-transparent to-[#102f24]/35" />
</div>

      {/* 스크롤 시 나타나는 헤더 */}
      <header
        className={`fixed left-0 right-0 top-0 z-[9999] transition-all duration-300 ${
          showStickyHeader
            ? "translate-y-0 opacity-100"
            : "-translate-y-full pointer-events-none opacity-0"
        }`}


      >
     <div
  className={`relative mt-3 flex max-w-7xl items-center gap-4 rounded-2xl border border-white/20 bg-slate-900/80 px-5 py-3 shadow-2xl backdrop-blur-xl transition-[left,width,transform] duration-500 ease-in-out ${
    isSearchBarCollapsed
      ? "left-3 w-[calc(100%_-_24px)] -translate-x-[calc(100%_+_24px)] md:w-[300px] md:translate-x-0"
      : "left-1/2 w-[95%] -translate-x-1/2"
  }`}
>


          <button
            type="button"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              })
            }
            className="text-2xl font-black tracking-wider text-white"
          >
            HOO
          </button>

          <div className="min-w-[120px] text-center">
            <p className="text-xl font-bold text-white">
              {currentTime
                ? currentTime.toLocaleTimeString("ko-KR", {
                    hour12: false,
                  })
                : "00:00:00"}
            </p>
          </div>
<div
  className={`flex items-center transition-all duration-300 ${
    isSearchBarCollapsed
      ? "w-9 flex-none"
      : "min-w-0 flex-1 gap-2"
  }`}
>
 <form
  action="https://www.google.com/search"
  method="GET"
  target="_blank"
  className={`max-md:hidden md:flex md:overflow-hidden md:rounded-full md:bg-white md:transition-all md:duration-300 ${
    isSearchBarCollapsed
      ? "pointer-events-none md:w-0 md:opacity-0"
      : "md:min-w-0 md:flex-1 md:opacity-100"
  }`}
>
  <input
    type="search"
    name="q"
    placeholder="Google 검색"
    className="min-w-0 flex-1 px-5 py-2 text-black outline-none"
  />

  <button
    type="submit"
    className="shrink-0 bg-blue-600 px-6 text-white transition hover:bg-blue-700"
  >
    검색
  </button>
</form>


<div className="relative shrink-0">
  <button
    ref={uiOpacityButtonRef}
    type="button"
    onClick={() =>
      setIsUiOpacityOpen(
        (previous) => !previous,
      )
    }
    className={`flex h-9 w-9 items-center justify-center rounded-full border text-white shadow-lg transition ${
      isUiOpacityOpen
        ? "border-[#8f7cff] bg-[#7467d8] shadow-[0_0_22px_rgba(116,103,216,0.65)]"
        : "border-white/20 bg-slate-800 hover:border-[#8f7cff] hover:bg-slate-700"
    }`}
    aria-label="설정 열기"
    aria-expanded={isUiOpacityOpen}
  >
    <Settings
      size={18}
      strokeWidth={2.4}
    />
  </button>
</div>

<button
  ref={searchToggleButtonRef}
  type="button"
  onClick={toggleSearchBar}
  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-slate-800 text-xs font-black text-white shadow-lg transition hover:bg-slate-700"
 
  aria-label={
    isSearchBarCollapsed
      ? "검색창 펼치기"
      : "검색창 접기"
  }
>
  {isSearchBarCollapsed ? "▶" : "◀"}
</button>
</div>


        </div>

        {isSearchBarCollapsed && (
          <button
            ref={searchToggleButtonRef}
            type="button"
            onClick={toggleSearchBar}
            className="fixed left-0 top-[calc(18px+var(--hoo-safe-top))] z-[10001] flex h-12 w-11 items-center justify-center rounded-r-2xl border border-l-0 border-white/20 bg-slate-900/90 text-base font-black text-white shadow-2xl backdrop-blur-xl transition active:scale-95 md:hidden"
            aria-label="상단 검색바 펼치기"
          >
            ▶
          </button>
        )}
      </header>

      {isUiOpacityOpen && (
  <div
    ref={uiOpacityPanelRef}
    className="fixed right-4 top-[74px] z-[10020] max-h-[calc(100dvh-90px)] w-[calc(100vw-32px)] max-w-[360px] overflow-y-auto overscroll-contain rounded-[26px] border border-[#8f7cff]/80 bg-[#111522]/95 px-5 pb-6 pt-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.5),0_0_28px_rgba(116,103,216,0.25)] backdrop-blur-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:right-[5.2%] md:w-[210px]"
  >

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black tracking-[0.18em] text-white/45">
                SETTINGS
              </p>

              <h2 className="mt-1 text-base font-black">
                설정
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                setIsUiOpacityOpen(false)
              }
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/75 transition hover:bg-white/15 hover:text-white"
              aria-label="설정 닫기"
            >
              <X
                size={17}
                strokeWidth={2.5}
              />
            </button>
          </div>

          <div className="mt-5 border-t border-white/10 pt-5 md:hidden">
            <p className="text-[10px] font-black tracking-[0.16em] text-white/40">
              SERVICE
            </p>

            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => {
                  const latestNotice = notices[0];

                  if (latestNotice) {
                    localStorage.setItem(
                      "lastReadNoticeId",
                      String(latestNotice.id),
                    );
                  }

                  setHasUnreadNotice(false);
                  setIsUiOpacityOpen(false);
                  setIsFeedbackOpen(false);
                  setIsNoticeOpen(true);
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition active:scale-[0.98]"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7467d8]/25 text-lg">
                    📢
                  </span>

                  <span>
                    <span className="block text-sm font-black">
                      공지사항
                    </span>
                    <span className="mt-0.5 block text-[10px] font-bold text-white/45">
                      HOO의 새로운 소식을 확인합니다.
                    </span>
                  </span>
                </span>

                <span className="flex items-center gap-2">
                  {hasUnreadNotice && notices.length > 0 && (
                    <span className="rounded-full bg-rose-500 px-2 py-1 text-[9px] font-black text-white">
                      NEW
                    </span>
                  )}
                  <ChevronRight size={16} className="text-white/35" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsUiOpacityOpen(false);
                  setIsNoticeOpen(false);
                  setIsFeedbackOpen(true);
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition active:scale-[0.98]"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7467d8]/25 text-lg">
                    💬
                  </span>

                  <span>
                    <span className="block text-sm font-black">
                      피드백 보내기
                    </span>
                    <span className="mt-0.5 block text-[10px] font-bold text-white/45">
                      문의사항이나 의견을 전달합니다.
                    </span>
                  </span>
                </span>

                <ChevronRight size={16} className="text-white/35" />
              </button>
            </div>
          </div>

          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="text-[10px] font-black tracking-[0.16em] text-white/40">
              NOTIFICATION
            </p>

            <div className="mt-3">
              <PushNotificationButton />
            </div>
          </div>

          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="text-[10px] font-black tracking-[0.16em] text-white/40">
              BACKGROUND
            </p>

            <div className="mt-3">
              <BackgroundSettings
                onUpload={handleBackgroundUpload}
                onReset={handleBackgroundReset}
              />
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-[10px] font-black tracking-[0.16em] text-white/40">
              UI APPEARANCE
            </p>

            <h3 className="mt-1 text-sm font-black">
              UI 불투명도
            </h3>
          </div>

          <div className="mt-5 flex justify-center">
            <div className="rounded-xl bg-[#7467d8] px-3 py-2 text-sm font-black shadow-[0_8px_22px_rgba(116,103,216,0.38)]">
              {uiOpacity}%
            </div>
          </div>

          <div className="mt-5 flex h-[290px] items-center justify-center">
            <div className="relative flex h-full w-[72px] flex-col items-center justify-between py-1">
              <span className="text-xs font-black text-white/80">
                100%
              </span>

              <div className="relative flex h-[225px] w-full items-center justify-center">
                <div className="absolute h-[225px] w-2 rounded-full bg-white/10" />

                <div
                  className="absolute bottom-0 w-2 rounded-full bg-gradient-to-t from-[#1677ff] via-[#6559e8] to-[#8f7cff]"
                  style={{
                    height: `${uiOpacity}%`,
                  }}
                />

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={uiOpacity}
                  onChange={(event) =>
                    setUiOpacity(
                      Number(event.target.value),
                    )
                  }
                  aria-label="전체 UI 불투명도"
                  aria-valuetext={`${uiOpacity}%`}
                  className="absolute h-8 w-[225px] -rotate-90 cursor-pointer opacity-0"
                />

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 h-6 w-6 -translate-x-1/2 rounded-full border-4 border-white bg-[#eeeaff] shadow-[0_4px_14px_rgba(0,0,0,0.45)] transition-[bottom] duration-75"
                  style={{
                    bottom: `calc(${uiOpacity}% - 12px)`,
                  }}
                />
              </div>

              <span className="text-xs font-black text-white/55">
                0%
              </span>
            </div>
          </div>

         <p className="mt-3 text-center text-[11px] font-bold leading-5 text-white/45">
  어두운 패널 배경만 조절되며
  <br />
  글자와 버튼은 선명하게 유지됩니다.
</p>

<div className="mt-6 border-t border-white/10 pt-5">
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-[10px] font-black tracking-[0.16em] text-white/40">
        FOCUS ALARM
      </p>

      <h3 className="mt-1 text-sm font-black">
        종료 알람 음량
      </h3>
    </div>

    <span className="shrink-0 rounded-xl bg-[#7467d8] px-3 py-1.5 text-xs font-black">
      {focusAlarmVolume === 0
        ? "무음"
        : `${focusAlarmVolume}%`}
    </span>
  </div>

  <input
    type="range"
    min={0}
    max={100}
    step={1}
    value={focusAlarmVolume}
    onChange={(event) =>
      setFocusAlarmVolume(
        Number(
          event.target.value,
        ),
      )
    }
    aria-label="포커스 종료 알람 음량"
    aria-valuetext={
      focusAlarmVolume === 0
        ? "무음"
        : `${focusAlarmVolume}%`
    }
    className="mt-5 h-2 w-full cursor-pointer accent-[#8f7cff]"
  />

  <div className="mt-2 flex items-center justify-between text-[10px] font-black text-white/35">
    <span>무음</span>
    <span>최대</span>
  </div>

  <p className="mt-3 text-center text-[11px] font-bold leading-5 text-white/40">
    포커스 시간이 끝날 때 울리는
    <br />
    알람의 크기를 조절합니다.
  </p>
</div>

        </div>
      )}

     {/* 첫 화면 */}
<section className="relative z-10 flex min-h-[100dvh] items-start justify-center px-4 pb-[calc(24px+var(--hoo-safe-bottom))] pt-[calc(112px+var(--hoo-safe-top))] text-white sm:px-5 sm:pt-20">
  <div className="relative flex w-full min-w-0 max-w-3xl flex-col items-center">
          <h1 className="text-5xl font-black tracking-[-0.08em] drop-shadow-[0_7px_20px_rgba(0,0,0,0.7)] sm:text-7xl md:text-8xl">
            HOO
          </h1>

          <p className="mt-2 text-2xl font-black tracking-[0.06em] drop-shadow-[0_5px_15px_rgba(0,0,0,0.75)] sm:text-3xl md:text-4xl">
            {currentTime
              ? currentTime.toLocaleTimeString("ko-KR", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "00:00:00"}
          </p>

          <p className="mt-2 text-sm font-black text-white/80 drop-shadow-md">
            {currentTime
              ? currentTime.toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })
              : ""}
          </p>

          <form
            action="https://www.google.com/search"
            method="GET"
            target="_blank"
           className="mt-6 flex w-full max-w-md overflow-hidden rounded-full border border-white/45 bg-white/90 p-1 shadow-[0_16px_45px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:mt-7 sm:p-1.5"
          >
            <input
              type="search"
              name="q"
              required
              placeholder="Google에서 검색"
              aria-label="Google 검색"
              className="min-w-0 flex-1 bg-transparent px-5 py-2.5 text-sm font-bold text-[#332f45] outline-none placeholder:text-[#777187]"
            />

            <button
              type="submit"
            className="min-h-11 shrink-0 rounded-full bg-[#5967a9] px-4 py-2.5 text-sm font-black text-white transition active:scale-[0.98] md:px-5 md:hover:scale-[1.03] md:hover:bg-[#475795]"
            >
              검색
            </button>
          </form>

        {/* 즐겨찾기 8칸 */}
<div className="mt-6 grid w-full max-w-xl grid-cols-4 gap-2 sm:mt-7 sm:gap-3">
  {favorites.map((favorite, index) => {
    const isConfigured =
      Boolean(favorite.name) &&
      Boolean(favorite.url);

    return (
      <div
        key={favorite.id}
        className="group relative"
      >
        <button
          type="button"
          onClick={() => {
            if (isConfigured) {
              openFavorite(favorite);
              return;
            }

            editFavorite(index);
          }}
          className="flex h-[68px] w-full min-w-0 flex-col items-center justify-center rounded-xl border border-white/35 bg-white/[0.06] px-1 text-center text-white shadow-[0_8px_26px_rgba(0,0,0,0.12)] backdrop-blur-[2px] transition duration-300 active:scale-[0.97] sm:h-20 sm:rounded-2xl sm:px-2 md:hover:-translate-y-1 md:hover:border-white/75 md:hover:bg-white/[0.13]"
          aria-label={
            isConfigured
              ? `${favorite.name} 열기`
              : `즐겨찾기 ${index + 1} 설정`
          }
        >
          {isConfigured ? (
            <>
              <span className="text-2xl drop-shadow-md">
                {favorite.icon || "⭐"}
              </span>

              <span className="mt-1.5 max-w-full truncate text-[11px] font-black drop-shadow-md">
                {favorite.name}
              </span>
            </>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/40 text-2xl font-light text-white/60 transition-all duration-300 group-hover:scale-110 group-hover:border-white group-hover:text-white">
              +
            </span>
          )}
        </button>

       {isConfigured && (
  <div className="absolute -right-2 -top-2 z-20 hidden gap-1 opacity-0 transition md:flex md:group-hover:opacity-100">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                editFavorite(index);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-xs font-black text-[#413b58] shadow-lg"
              aria-label={`${favorite.name} 수정`}
            >
              ✎
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                clearFavorite(index);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/95 text-sm font-black text-white shadow-lg"
              aria-label={`${favorite.name} 삭제`}
            >
              ×
            </button>
          </div>
        )}
      </div>
    );
  })}
</div>
            

     <button
  type="button"
  onClick={() => {
    if (!morningBriefing) {
      return;
    }

    setIsBriefingModalOpen(true);
  }}
  disabled={!morningBriefing}
  className={`group mt-4 flex min-h-16 w-full max-w-xl items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-left text-white shadow-[0_12px_35px_rgba(0,0,0,0.18)] backdrop-blur-md transition duration-300 sm:mt-5 sm:px-5 sm:py-3.5 ${
    morningBriefing
      ? "cursor-pointer border-white/45 bg-white/[0.10] hover:-translate-y-0.5 hover:border-white/80 hover:bg-white/[0.18]"
      : "cursor-default border-white/30 bg-white/[0.07]"
  }`}
  aria-label={
    morningBriefing
      ? "오늘의 HOO 브리핑 열기"
      : "오늘의 HOO 브리핑 준비 중"
  }
>
  <div className="flex min-w-0 items-center gap-3">
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl shadow-[0_8px_20px_rgba(40,30,100,0.35)] transition-transform duration-300 ${
        morningBriefing
          ? "bg-[#7467d8] group-hover:scale-105"
          : "animate-pulse bg-[#7467d8]/70"
      }`}
    >
      {morningBriefing ? "◉" : "○"}
    </span>

    <span className="min-w-0">
      <span className="block text-[10px] font-bold tracking-[0.16em] text-white/70 [text-shadow:none]">
        HOO AI 1.0
      </span>

      <span className="mt-0.5 block truncate text-sm font-bold text-white [text-shadow:none]">
        {morningBriefing
          ? "오늘의 브리핑"
          : "오늘의 브리핑을 준비하고 있어요"}
      </span>
    </span>
  </div>

  <span className="shrink-0 text-[11px] font-semibold text-white/75 [text-shadow:none] sm:text-xs">
    {morningBriefing
      ? "다시 보기 →"
      : "새벽 4시 공개"}
  </span>
</button>

{routineCandidates.length > 0 && (
  <button
    type="button"
    onClick={() => {
      const firstCandidate =
        routineCandidates[0];

      if (!firstCandidate) {
        return;
      }

      openRoutineConfirmation(
        firstCandidate,
      );
    }}
    className="group mt-3 flex w-full max-w-xl items-center justify-between rounded-2xl border border-[#f0d49b]/70 bg-[#2f291f]/75 px-5 py-3.5 text-left text-white shadow-[0_12px_35px_rgba(0,0,0,0.2)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-[#ffe0a2] hover:bg-[#3a3123]/90"
    aria-label="HOO가 발견한 반복 생활 확인하기"
  >
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e2ad52] text-xl text-[#2f2414] shadow-[0_8px_20px_rgba(85,55,10,0.3)] transition-transform duration-300 group-hover:scale-105">
        ↻

        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#fff4da] px-1 text-[10px] font-black text-[#6c4a12]">
          {routineCandidates.length}
        </span>
      </span>

      <span className="min-w-0">
        <span className="block text-[10px] font-bold tracking-[0.16em] text-[#f5d99f] [text-shadow:none]">
          HOO ROUTINE
        </span>

        <span className="mt-0.5 block truncate text-sm font-bold text-white [text-shadow:none]">
          반복되는 생활을 발견했어요
        </span>
      </span>
    </div>

    <span className="shrink-0 text-xs font-semibold text-[#f8dfaa] [text-shadow:none]">
      확인하기 →
    </span>
  </button>
)}

<div className="mt-5 flex flex-col items-center gap-1 text-[10px] font-black tracking-[0.14em] text-white/75 sm:mt-6 sm:gap-2 sm:text-xs sm:tracking-[0.18em]">
  <span>SCROLL TO EXPLORE</span>
  <span className="animate-bounce text-xl">↓</span>
</div>
        </div>
      </section>

      {/* 가로 스크롤 영역 */}
      <section
        ref={horizontalSectionRef}
        className="relative z-10 h-[105vh]"
      >
        <div className="sticky top-0 h-screen overflow-hidden">
          <div
            className="hoo-dark-opacity-scope flex h-full w-[400vw] transition-transform duration-700 ease-in-out will-change-transform"
            style={{
              transform: `translate3d(-${
                (horizontalProgress + 1) * 100
              }vw, 0, 0)`,
              "--hoo-dark-panel-alpha": String(
                0.08 + (uiOpacity / 100) * 0.72,
              ),
              "--hoo-dark-card-alpha": String(
                0.12 + (uiOpacity / 100) * 0.55,
              ),
              "--hoo-dark-soft-alpha": String(
                0.10 + (uiOpacity / 100) * 0.42,
              ),
            } as React.CSSProperties}
          >

          {/* 왼쪽 패널: 투두리스트 */}

<section className="flex h-[100dvh] w-screen shrink-0 items-start overflow-x-hidden overflow-y-auto px-3 pb-[calc(24px+var(--hoo-safe-bottom))] pt-[calc(92px+var(--hoo-safe-top))] sm:px-4 md:px-7 xl:items-center xl:overflow-hidden xl:py-16">
  <div className="mx-auto w-full max-w-[1380px]">
   <section className="grid w-full overflow-hidden rounded-[24px] border border-white/55 bg-white/90 shadow-[0_30px_100px_rgba(5,35,26,0.4)] backdrop-blur-xl sm:rounded-[34px] md:min-h-[630px] xl:grid-cols-[1.3fr_0.7fr]">
     <article className="min-w-0 border-b border-[#dedaf0] p-4 sm:p-6 md:p-8 xl:border-b-0 xl:border-r">
      
        <header>
  <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
    HOO TO DO
  </p>

  <h2 className="mt-1 text-2xl font-black text-[#332f45] sm:text-3xl">
  오늘의 할 일
</h2>

  <p className="mt-2 text-sm font-bold text-[#8b849d]">
    작은 목표부터 하나씩 완료해보세요.
  </p>
</header>

        <form
          onSubmit={addTodo}
          className="mt-6 flex gap-2"
        >
          <input
            type="text"
            value={todoContent}
            maxLength={100}
            onChange={(event) =>
              setTodoContent(event.target.value)
            }
            placeholder="오늘 할 일을 입력하세요."
            className="min-w-0 flex-1 rounded-2xl border border-[#ded8ef] bg-white px-5 py-3 text-sm font-bold outline-none focus:border-[#7467d8]"
          />

          <button
            type="submit"
           className="min-h-12 shrink-0 rounded-2xl bg-[#7467d8] px-4 py-3 text-sm font-black text-white transition active:scale-[0.98] sm:px-6 md:hover:bg-[#6255c7]"
          >
            추가
          </button>
        </form>

        <div
          className="mt-5 max-h-[400px] space-y-3 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {todos.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-3xl border-2 border-dashed border-[#ded8ef] bg-[#faf9ff] px-5 text-center text-sm font-bold text-[#aaa4b8]">
              오늘의 첫 번째 할 일을 추가해보세요.
            </div>
          ) : (

        todos.map((todo, index) => {
  const isHooScheduleTodo =
    todo.source === "hoo" &&
    todo.taskType === "schedule";

  return (
    <article
      key={todo.id}
      onDragOver={handleTodoDragOver}
      onDragEnter={() =>
        handleTodoDragEnter(todo.id)
      }
      onDrop={handleTodoDrop}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
        draggingTodoId === todo.id
          ? "scale-[0.98] border-2 border-dashed border-[#7467d8] bg-[#eeeaff] opacity-60"
          : dragOverTodoId === todo.id
            ? "border-2 border-[#a99df0] bg-[#f2efff]"
            : isHooScheduleTodo
              ? "border-2 border-[#c9c0ff] bg-gradient-to-r from-[#f2efff] to-[#faf9ff] shadow-sm hover:border-[#9f92e8]"
              : "border-2 border-transparent bg-[#faf9ff] hover:border-[#d8d0ff] hover:bg-[#f7f5ff]"
      }`}
    >
      <div
        draggable
        onDragStart={(event) =>
          handleTodoDragStart(
            event,
            todo.id,
          )
        }
        onDragEnd={handleTodoDragEnd}
        className="flex w-7 shrink-0 cursor-grab select-none flex-col items-center justify-center gap-[3px] rounded-lg py-2 text-[#aaa4b8] transition hover:bg-[#eeeaff] hover:text-[#7467d8] active:cursor-grabbing"
        aria-label={`${todo.content} 순서 변경`}
        title="잡고 끌어서 순서 변경"
      >
        <span className="h-[2px] w-4 rounded-full bg-current" />
        <span className="h-[2px] w-4 rounded-full bg-current" />
        <span className="h-[2px] w-4 rounded-full bg-current" />
      </div>

      <button
        type="button"
        onClick={() =>
          toggleTodo(todo.id)
        }
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black transition ${
          todo.completed
            ? "border-[#7467d8] bg-[#7467d8] text-white"
            : isHooScheduleTodo
              ? "border-[#9f92e8] bg-white text-transparent"
              : "border-[#cfc9df] bg-white text-transparent"
        }`}
        aria-label={`${todo.content} 완료 상태 변경`}
      >
        ✓
      </button>

      <div className="min-w-0 flex-1">
        {isHooScheduleTodo && (
          <div className="mb-1 flex items-center gap-1.5">
            <span className="rounded-full bg-[#7467d8] px-2 py-0.5 text-[9px] font-black tracking-wide text-white">
              HOO 일정
            </span>

            <span className="truncate text-[10px] font-bold text-[#8b83a3]">
              캘린더에서 자동 생성
            </span>
          </div>
        )}

      <p
  className={`break-words text-sm font-black ${
    todo.completed
      ? "line-through"
      : ""
  }`}
  style={{
    color: todo.completed
      ? isHooScheduleTodo
        ? "#8f899d"
        : "#aaa6b5"
      : isHooScheduleTodo
        ? "#17141f"
        : "#ffffff",
  }}
  title={
    isHooScheduleTodo
      ? todo.generationReason ??
        "캘린더에 등록된 오늘의 일정"
      : undefined
  }
>
  {index + 1}.{" "}
  {todo.content}
</p>

      </div>

      {isHooScheduleTodo ? (
  <span
    className="shrink-0 rounded-full border border-white/20 bg-[#77777d] px-3 py-1.5 text-[10px] font-black text-white"
    title="이 투두는 캘린더 일정과 연결되어 있습니다."
  >
    캘린더
  </span>
) : (
  <button
    type="button"
    onClick={() =>
      deleteTodo(todo.id)
    }
    className="shrink-0 rounded-full border border-white/20 bg-[#77777d] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#626268]"
  >
    삭제
  </button>
)}

    </article>
  );
})
            
          )}
        </div>

  <div
  className={`mt-5 rounded-3xl border p-5 shadow-sm transition-all duration-500 ${
    isRecommendedTodoCompleted
      ? "hoo-mission-complete-animation border-[#6dd39b] bg-[#effdf5] shadow-[0_0_25px_rgba(109,211,155,0.25)]"
      : "border-[#d8d0ff] bg-[#f8f6ff]"
  }`}
>

  {showMissionCompleteToast && (
  <div className="mb-4 rounded-2xl border border-[#8ce0af] bg-[#ecfff3] px-4 py-3 animate-[fadeInUp_0.4s_ease]">
    <p className="text-sm font-black text-[#27955b]">
      🏆 MISSION COMPLETE!
    </p>

    <p className="mt-1 text-xs font-bold text-[#4d6b58]">
      오늘의 추천 미션을 완료했는!
    </p>
  </div>
)}


  <div className="flex items-start justify-between">

    <div className="flex gap-4">

      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 text-xl transition ${
          isRecommendedTodoCompleted
            ? "border-[#7467d8] bg-[#7467d8] text-white"
            : "border-[#d7cffc] bg-white text-[#7467d8]"
        }`}
      >
       {isRecommendedTodoCompleted ? "🏆" : "🎮"}
      </span>

      <div>

      <p
  className={`text-[11px] font-black tracking-[0.18em] ${
    isRecommendedTodoCompleted
      ? "text-[#39a86b]"
      : "text-[#8b83b7]"
  }`}
>
  {isRecommendedTodoCompleted
    ? "MISSION COMPLETE"
    : "HOO DAILY MISSION"}
</p>

        <h3
          className={`mt-1 text-lg font-black ${
            isRecommendedTodoCompleted
              ? "line-through text-[#9e98b3]"
              : "text-[#332f45]"
          }`}
        >
          {HOO_RECOMMENDED_TASKS[0].content}
        </h3>

        <p className="mt-2 text-xs font-bold text-[#938cb0]">
          미니게임을 플레이하면 자동으로 진행됩니다.
        </p>

<div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#e8e3f8]">
  <div
    className="h-full rounded-full bg-[#7467d8] transition-all duration-500"
    style={{
      width: `${
        (Math.min(minigameCompletionCount, 2) / 2) *
        100
      }%`,
    }}
  />
</div>

      </div>

    </div>

    <div className="text-right">

      <div
  className={`rounded-full border px-4 py-1 transition-all ${
    isRecommendedTodoCompleted
      ? "border-[#6dd39b] bg-[#dcfaea]"
      : "border-[#d9d3ff] bg-white"
  }`}
>

       <span
  className={`text-sm font-black ${
    isRecommendedTodoCompleted
      ? "text-[#25955a]"
      : "text-[#7467d8]"
  }`}
>

          {Math.min(minigameCompletionCount, 2)} / 2

        </span>

      </div>

      <p className="mt-2 text-[11px] font-black text-[#9b95b4]">

        {isRecommendedTodoCompleted
          ? "MISSION COMPLETE"
          : "진행 중"}

      </p>

    </div>

  </div>

</div>

      </article>

      <aside className="bg-[#f7f5ff] p-6 md:p-8">
        <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
          TODAY PROGRESS
        </p>

        <h3 className="mt-1 text-2xl font-black text-[#332f45]">
          오늘의 달성률
        </h3>

        <div
  className={`mt-7 rounded-[28px] border p-6 text-center shadow-inner transition-all duration-500 ${todoProgressStyle.card} ${todoProgressStyle.border}`}
>

          <p
  className={`text-5xl font-black transition-colors ${todoProgressStyle.text}`}
>

         {safeTodoProgressPercent}
            %
          </p>

          <p className="mt-3 text-sm font-bold text-[#928ba8]">

          {completedTodoCount}
개 완료 · {totalTodoCount}개 목표

          </p>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#e7e3f1]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${todoProgressStyle.bar}`}


              style={{
              width: `${safeTodoProgressPercent}%`,
              }}
            />
          </div>
        </div>

        <div
  className={`mt-5 rounded-3xl border p-5 transition-all duration-500 ${todoProgressStyle.card} ${todoProgressStyle.border}`}
>
  <p
    className={`text-sm font-black ${todoProgressStyle.text}`}
  >
    {todoProgressMessage}
  </p>

  <p className="mt-2 text-xs font-bold leading-6 text-[#7d768d]">
    목표는 완벽함이 아니라 꾸준함입니다.
    오늘도 한 걸음씩 앞으로 나아가 보세요.
  </p>
</div>

      </aside>
    </section>
  </div>
</section>


            {/* 첫 번째 패널: 캘린더 */}
        <section className="flex h-[100dvh] w-screen shrink-0 items-start overflow-x-hidden overflow-y-auto px-3 pb-[calc(24px+var(--hoo-safe-bottom))] pt-[calc(92px+var(--hoo-safe-top))] sm:px-4 md:px-7 xl:items-center xl:overflow-hidden xl:py-16">
              <div className="mx-auto w-full max-w-[1380px]">
               <section className="grid overflow-hidden rounded-[34px] border border-white/55 bg-white/88 shadow-[0_30px_100px_rgba(5,35,26,0.4)] backdrop-blur-xl xl:max-h-[calc(100dvh-128px)] xl:grid-cols-[1.15fr_0.85fr]">
                  <article className="border-b border-[#dedaf0] xl:border-b-0 xl:border-r">
                    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dedaf0] px-5 py-4 md:px-7">
                      <div>
                        <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
                          HOO CALENDAR
                        </p>

                        <h2 className="mt-1 text-3xl font-black text-[#332f45]">
                          {currentYear}년 {currentMonth + 1}월
                        </h2>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={movePreviousMonth}
                          className="h-10 w-10 rounded-full bg-[#eeeafd] text-lg font-black transition hover:scale-105 hover:bg-[#ddd7fa]"
                        >
                          ←
                        </button>

<button
  type="button"

 onClick={() => {
  if (!isSecretLayerOn) {
    setIsSecretLayerOn(true);
    return;
  }

  setSecretPinInput("");
  setIsSecretPinModalOpen(true);
}}

  className={`rounded-full border px-4 py-2.5 text-xs font-black transition hover:scale-105 ${
    isSecretLayerOn
      ? "border-[#5145b5] bg-[#5145b5] text-white"
      : "border-[#d8d2ec] bg-[#f3f0ff] text-[#6255b5]"
  }`}
  aria-pressed={isSecretLayerOn}
>
  {isSecretLayerOn
    ? "시크릿 ON"
    : "시크릿 OFF"}
</button>

                        <button
                          type="button"
                          onClick={moveToday}
                          className="rounded-full bg-[#7467d8] px-5 py-2.5 text-sm font-black text-white transition hover:scale-105"
                        >
                          오늘
                        </button>

                        <button
                          type="button"
                          onClick={moveNextMonth}
                          className="h-10 w-10 rounded-full bg-[#eeeafd] text-lg font-black transition hover:scale-105 hover:bg-[#ddd7fa]"
                        >
                          →
                        </button>
                      </div>
                    </header>

                    <div className="grid grid-cols-7 border-b border-[#dedaf0] bg-[#faf9ff]">
                      {WEEK_DAYS.map((weekDay, index) => (
                        <div
                          key={weekDay}
                          className={`py-2.5 text-center text-xs font-black ${
                            index === 0
                              ? "text-[#ee7184]"
                              : index === 6
                                ? "text-[#657cda]"
                                : "text-[#756f87]"
                          }`}
                        >
                          {weekDay}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7">
                      {calendarDays.map((day, index) => {
                        if (day === null) {
                          return (
                            <div
                              key={`empty-${index}`}
                              className="min-h-20 border-b border-r border-[#eeebf7] bg-[#faf9fd]/60"
                            />
                          );
                        }

                        const dateKey = createDateKey(
                          currentYear,
                          currentMonth,
                          day,
                        );

                        const dateSchedules = (
  schedules[dateKey] ?? []
).filter(
  (schedule) =>
    !isSecretLayerOn ||
    !schedule.isSecret,
);

                        const selected =
                          dateKey === selectedDate;

                        return (
                          <button
                            type="button"
                            key={dateKey}
                            onClick={() => {
                              setSelectedDate(dateKey);
                              setSelectedScheduleId(
                                dateSchedules[0]?.id ?? null,
                              );
                            }}
                            className={`relative min-h-20 overflow-hidden border-b border-r border-[#eeebf7] p-2 text-left transition ${
                              selected
                                ? "bg-[#7467d8] text-white"
                                : "bg-white hover:bg-[#f4f1ff]"
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                                isToday(day) && !selected
                                  ? "bg-[#ff9cb3] text-white"
                                  : ""
                              }`}
                            >
                              {day}
                            </span>

                            <div className="mt-1 space-y-1">

                             {dateSchedules
  .slice(0, 2)
  .map((schedule) => {
    const scheduleVisual =
      getScheduleVisual(schedule);

    return (
      <div
        key={schedule.id}
        className={`truncate rounded-md border px-1.5 py-1 text-[9px] font-black shadow-sm ${scheduleVisual.className}`}
        title={scheduleVisual.label}
      >
        {scheduleVisual.icon && (
          <span className="mr-1">
            {scheduleVisual.icon}
          </span>
        )}

        {schedule.title}
      </div>
    );
  })}

                              {dateSchedules.length > 2 && (
                                <p className="text-[9px] font-black opacity-70">
                                  + {dateSchedules.length - 2}개
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </article>

                <aside className="flex min-h-[600px] flex-col bg-[#fbfaff] xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:[scrollbar-color:rgba(116,103,216,0.55)_rgba(255,255,255,0.08)] xl:[scrollbar-width:thin]">
                    <header className="border-b border-[#dedaf0] px-6 py-5">
                      <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
                        SELECTED DATE
                      </p>

                      <h2 className="mt-1 text-3xl font-black">
                        {selectedDateInfo.day}일
                      </h2>

                      <p className="mt-1 text-sm font-bold text-[#827b95]">
                        {selectedDateLabel}
                      </p>
                    </header>

                    <section className="min-h-0 flex-1 overflow-y-auto border-b border-[#dedaf0] px-6 py-4">
                      
                     <div className="flex items-center justify-between gap-3">
  <h3 className="text-xl font-black">
    {editingScheduleId
      ? "일정 수정 중"
      : "일정 내용"}
  </h3>

  {selectedSchedule && (
    <div className="flex items-center gap-2">
      {editingScheduleId ===
      selectedSchedule.id ? (
        <button
          type="button"
          onClick={
            cancelScheduleEditing
          }
          className="rounded-full bg-[#ece9f7] px-4 py-2 text-xs font-black text-[#69627b] transition hover:bg-[#ded8ef]"
        >
          수정 취소
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            startScheduleEditing(
              selectedSchedule,
            );
          }}
          className="rounded-full bg-[#e9e5ff] px-4 py-2 text-xs font-black text-[#6254bd] transition hover:bg-[#dcd5ff]"
        >
          일정 수정
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          deleteSchedule(
            selectedSchedule.id,
          );
        }}
        disabled={
          editingScheduleId !== null
        }
        className="rounded-full bg-[#ffe2e8] px-4 py-2 text-xs font-black text-[#d94f6b] transition hover:bg-[#ffcbd6] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {selectedSchedule.repeatType ===
        "none"
          ? "일정 삭제"
          : "반복 일정 삭제"}
      </button>
    </div>
  )}
</div>


               {selectedSchedule ? (
  <div
    className="relative mt-3 min-h-[180px] overflow-hidden rounded-3xl"
    onMouseDown={(event) => {
      if (isScheduleSliding) {
        return;
      }

      scheduleDragStartXRef.current =
        event.clientX;

      scheduleDragCurrentXRef.current =
        event.clientX;
    }}
    onMouseMove={(event) => {
      if (
        scheduleDragStartXRef.current === null ||
        isScheduleSliding
      ) {
        return;
      }

      scheduleDragCurrentXRef.current =
        event.clientX;
    }}
    onMouseUp={() => {
      if (
        scheduleDragStartXRef.current === null ||
        scheduleDragCurrentXRef.current === null ||
        isScheduleSliding
      ) {
        scheduleDragStartXRef.current = null;
        scheduleDragCurrentXRef.current = null;
        return;
      }

      const dragDistance =
        scheduleDragCurrentXRef.current -
        scheduleDragStartXRef.current;

      if (dragDistance >= 80) {
        moveSelectedSchedule("previous");
      }

      if (dragDistance <= -80) {
        moveSelectedSchedule("next");
      }

      scheduleDragStartXRef.current = null;
      scheduleDragCurrentXRef.current = null;
    }}
    onMouseLeave={() => {
      scheduleDragStartXRef.current = null;
      scheduleDragCurrentXRef.current = null;
    }}
  >
    {previousSchedule &&
      scheduleSlideDirection && (
        <article
          className={`pointer-events-none absolute inset-0 z-10 cursor-grab select-none rounded-3xl border p-5 shadow-sm ${
            scheduleSlideDirection === "left"
              ? "hoo-schedule-previous-to-left"
              : "hoo-schedule-previous-to-right"
          } ${
            getScheduleVisual(previousSchedule)
              .className
          }`}
        >
         <div className="flex items-start justify-between gap-3">
  <div className="min-w-0">
    <p className="text-xs font-black opacity-70">
      {
        getScheduleVisual(
          selectedSchedule,
        ).label
      }
    </p>

    <div className="mt-3 flex flex-wrap items-center gap-2">
  <h4 className="break-words text-xl font-black">
    {selectedSchedule.title}
  </h4>

  {selectedSchedule.isSecret && (
    <span className="rounded-full bg-[#5145b5] px-2.5 py-1 text-[10px] font-black text-white">
      SECRET
    </span>
  )}
</div>
  </div>

  {selectedSchedules.length > 1 && (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        disabled={isScheduleSliding}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          moveSelectedSchedule("previous");
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-sm font-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="이전 일정"
      >
        ◀
      </button>

      <span className="min-w-[52px] rounded-full bg-white/70 px-3 py-1 text-center text-xs font-black">
        {selectedSchedules.findIndex(
          (schedule) =>
            schedule.id ===
            selectedSchedule.id,
        ) + 1}
        {" / "}
        {selectedSchedules.length}
      </span>

      <button
        type="button"
        disabled={isScheduleSliding}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          moveSelectedSchedule("next");
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-sm font-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="다음 일정"
      >
        ▶
      </button>
    </div>
  )}
</div>

         <p className="mt-3 whitespace-pre-wrap break-words text-sm font-bold leading-7 text-[#ECECEC]">
            {previousSchedule.content ||
              "상세 내용이 작성되지 않았어요."}
          </p>

          {selectedSchedules.length > 1 && (
           <p className="mt-4 text-center text-[11px] font-black text-white/70">
              좌우로 드래그하여 다른 일정을
              확인하세요.
            </p>
          )}
        </article>
      )}

    <article
      className={`relative z-20 min-h-[180px] cursor-grab select-none rounded-3xl border p-5 shadow-sm active:cursor-grabbing ${
        scheduleSlideDirection === "left"
          ? "hoo-schedule-current-from-right"
          : scheduleSlideDirection === "right"
            ? "hoo-schedule-current-from-left"
            : ""
      } ${
        getScheduleVisual(selectedSchedule)
          .className
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black opacity-70">
            {
              getScheduleVisual(
                selectedSchedule,
              ).label
            }
          </p>

          <h4 className="mt-3 break-words text-xl font-black">
            {selectedSchedule.title}
          </h4>
        </div>

      {selectedSchedules.length > 1 && (
  <div className="flex shrink-0 items-center gap-2">
    <button
      type="button"
      disabled={isScheduleSliding}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        moveSelectedSchedule("previous");
      }}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-[#5c4fb5] transition hover:bg-white disabled:opacity-50"
      aria-label="이전 일정"
    >
      <ChevronLeft
        size={15}
        strokeWidth={3}
      />
    </button>

    <span className="min-w-[46px] rounded-full bg-white/70 px-3 py-1 text-center text-xs font-black">
      {selectedSchedules.findIndex(
        (schedule) =>
          schedule.id ===
          selectedSchedule.id,
      ) + 1}
      {" / "}
      {selectedSchedules.length}
    </span>

    <button
      type="button"
      disabled={isScheduleSliding}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        moveSelectedSchedule("next");
      }}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-[#5c4fb5] transition hover:bg-white disabled:opacity-50"
      aria-label="다음 일정"
    >
      <ChevronRight
        size={15}
        strokeWidth={3}
      />
    </button>
  </div>
)}
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-sm font-bold leading-7 text-[#ECECEC]">
        {selectedSchedule.content ||
          "상세 내용이 작성되지 않았어요."}
      </p>

      {selectedSchedules.length > 1 && (
        <p className="mt-4 text-center text-[11px] font-black opacity-60">
          좌우로 드래그하여 다른 일정을 확인하세요.
        </p>
      )}
    </article>
  </div>
) : (
  <div className="mt-3 flex min-h-28 items-center justify-center rounded-3xl bg-white px-5 text-center text-sm font-bold text-[#aaa4b8]">
    확인할 일정을 선택해 주세요.
  </div>
)}


                    </section>

                    <form
                      onSubmit={addSchedule}
                      className="bg-[#f5f2ff] px-6 py-4"
                    >
                      <h3 className="text-lg font-black">
                        {editingScheduleId
                          ? "일정 수정하기"
                          : "새 일정 만들기"}
                      </h3>

                      <input
                        type="text"
                        value={scheduleTitle}
                        maxLength={40}
                        onChange={(event) =>
                          setScheduleTitle(
                            event.target.value,
                          )
                        }
                        placeholder="일정 제목"
                      className="mt-3 w-full rounded-2xl border border-[#ded8ef] bg-white px-4 py-2.5 text-sm font-bold text-[#ECECEC] placeholder:text-white/55 outline-none focus:border-[#7467d8]"
                      />

                    <textarea
  value={scheduleContent}
  maxLength={1000}
  rows={2}
  onChange={(event) =>
    setScheduleContent(
      event.target.value,
    )
  }
  placeholder="일정 내용을 적어주세요."
  className="mt-2 w-full resize-none rounded-2xl border border-[#ded8ef] bg-white px-4 py-3 text-sm font-bold leading-6 text-[#ECECEC] placeholder:text-white/55 outline-none focus:border-[#7467d8]"
/>

<section className="mt-3 rounded-2xl border border-[#ded8ef] bg-white px-4 py-4">
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-sm font-black text-[#423c55]">
        스티커 색상
      </p>

      <p className="mt-1 text-[11px] font-bold text-[#8b849d]">
        캘린더에 표시할 색상을 선택하세요.
      </p>
    </div>

    <span className="shrink-0 rounded-full bg-[#eeeaff] px-3 py-1 text-[11px] font-black text-[#5c4fb5]">
      {
        SCHEDULE_STICKER_COLORS.find(
          (color) =>
            color.value ===
            scheduleStickerColor,
        )?.label ?? "노란색"
      }
    </span>
  </div>

  <div className="mt-4 grid grid-cols-6 gap-2">
    {SCHEDULE_STICKER_COLORS.map(
      (color) => {
        const isSelected =
          scheduleStickerColor ===
          color.value;

        return (
          <button
            key={color.value}
            type="button"
            onClick={() =>
              setScheduleStickerColor(
                color.value,
              )
            }
            title={color.label}
            aria-label={`${color.label} 스티커 선택`}
            aria-pressed={
              isSelected
            }
            className={`flex h-10 w-full items-center justify-center rounded-xl border-2 transition ${
              color.previewClassName
            } ${
              isSelected
                ? "scale-105 border-[#5c4fb5] shadow-[0_5px_14px_rgba(92,79,181,0.32)]"
                : "border-black/5 hover:scale-105 hover:border-[#8f7cff]"
            }`}
          >
            {isSelected && (
              <span className="text-base font-black text-[#403761]">
                ✓
              </span>
            )}
          </button>
        );
      },
    )}
  </div>
</section>

<button
  type="button"
  onClick={() =>
    setIsScheduleSecret(
      (previous) => !previous,
    )
  }
  className={`mt-3 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
    isScheduleSecret
      ? "border-[#7467d8] bg-[#eeeaff] text-[#5145b5]"
      : "border-[#ded8ef] bg-white text-[#777083]"
  }`}
>
  <div>
    <p className="text-sm font-black">
      시크릿레이어에 저장
    </p>

    <p className="mt-1 text-[11px] font-bold text-white/70">
      시크릿 ON 상태에서는 화면에 표시되지 않습니다.
    </p>
  </div>

  <span
    className={`flex h-6 w-11 items-center rounded-full p-1 transition ${
      isScheduleSecret
        ? "justify-end bg-[#7467d8]"
        : "justify-start bg-[#d7d2df]"
    }`}
  >
    <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
  </span>
</button>



                      <div className="mt-5 space-y-4">

  <div>

    <p className="mb-2 text-sm font-bold">
      반복
    </p>

   <div className="grid grid-cols-2 gap-3">
  {[
    {
      value: "none",
      icon: "•",
      title: "하루만",
      description: "선택한 날짜에만 등록",
    },
    {
      value: "dailyRange",
      icon: "━",
      title: "일별 묶기",
      description: "연속된 날짜를 한 묶음으로",
    },
    {
      value: "weekly",
      icon: "↻",
      title: "주간 반복",
      description: "매주 같은 요일에 반복",
    },
    {
      value: "monthly",
      icon: "▣",
      title: "월간 반복",
      description: "매달 같은 주차·요일에 반복",
    },
  ].map((option) => {
    const isSelected =
      scheduleRepeatType ===
      option.value;

    return (
      <button
        key={option.value}
        type="button"
      onClick={() => {
  if (option.value === "none") {
    setScheduleRepeatType("none");
    return;
  }

  setRepeatScheduleModalType(
    option.value as ScheduleRepeatType,
  );

  setIsRepeatScheduleModalOpen(true);
}}
        className={`rounded-2xl border p-4 text-left transition ${
          isSelected
            ? "border-[#7467d8] bg-[#eeeafd] shadow-[0_8px_20px_rgba(116,103,216,0.18)]"
            : "border-[#ded8ef] bg-white hover:border-[#bdb4e8] hover:bg-[#faf9ff]"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-black ${
              isSelected
                ? "bg-[#7467d8] text-white"
                : "bg-[#f0edfa] text-[#7467d8]"
            }`}
          >
            {option.icon}
          </span>

          <div className="min-w-0">
            <p
              className={`text-sm font-black ${
                isSelected
                  ? "text-[#4f43b4]"
                  : "text-[#ECECEC]"
              }`}
            >
              {option.title}
            </p>

            <p className="mt-1 text-[11px] font-bold leading-4 text-[text-white/70]">
              {option.description}
            </p>
          </div>
        </div>
      </button>
    );
  })}
</div>
  </div>


</div>

                     <button
  type="submit"
  disabled={
    !editingScheduleId &&
    scheduleRepeatType !== "none"
  }
  className={`mt-3 w-full rounded-2xl py-3 text-sm font-black text-white transition ${
    editingScheduleId ||
    scheduleRepeatType === "none"
      ? "bg-[#7467d8] hover:scale-[1.01] hover:bg-[#6255c7]"
      : "cursor-not-allowed bg-[#c9c5dd]"
  }`}
>
  {editingScheduleId
    ? "수정 저장"
    : scheduleRepeatType === "none"
      ? "일정 저장"
      : "반복 일정은 팝업에서 생성됩니다."}
</button>

                    </form>

                  </aside>
                </section>
              </div>
            </section>

            {/* 두 번째 패널: 메모 + 타이머 */}

        <section className="flex h-[100dvh] w-screen shrink-0 items-start overflow-x-hidden overflow-y-auto px-3 pb-[calc(24px+var(--hoo-safe-bottom))] pt-[calc(92px+var(--hoo-safe-top))] sm:px-4 md:px-7 xl:items-center xl:overflow-hidden xl:py-16">
             <div className="mx-auto grid w-full max-w-[1380px] items-stretch gap-7 xl:grid-cols-[1.35fr_0.65fr]">
                <article className="overflow-hidden rounded-[30px] border border-white/55 bg-white/88 shadow-[0_25px_80px_rgba(5,35,26,0.3)] backdrop-blur-xl">
                 
                 <header className="flex items-center justify-between gap-4 border-b border-[#e5e1ef] px-6 py-5">
  <div>
    <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
      HOO MEMO
    </p>

    <h2 className="mt-1 text-2xl font-black">
      메모장
    </h2>
  </div>

  <button
    type="button"
    onClick={() => {
      if (!isSecretLayerOn) {
        setIsSecretLayerOn(true);
        return;
      }

      setSecretPinInput("");
      setIsSecretPinModalOpen(true);
    }}
    className={`rounded-full border px-4 py-2.5 text-xs font-black transition hover:scale-105 ${
      isSecretLayerOn
        ? "border-[#5145b5] bg-[#5145b5] text-white"
        : "border-[#d8d2ec] bg-[#f3f0ff] text-[#6255b5]"
    }`}
    aria-pressed={isSecretLayerOn}
  >
    {isSecretLayerOn
      ? "시크릿 ON"
      : "시크릿 OFF"}
  </button>
</header>

                  <div className="grid min-h-[560px] md:grid-cols-[0.9fr_1.1fr]">
                    <form
                      onSubmit={saveMemo}
                      className="border-b border-[#e5e1ef] bg-[#fff8d9] p-6 md:border-b-0 md:border-r"
                    >
                      <p className="text-sm font-black text-[#7d7142]">
                        {editingMemoId
                          ? "메모 수정하기"
                          : "새 메모 작성하기"}
                      </p>

                      <input
                        type="text"
                        value={memoTitle}
                        maxLength={50}
                        onChange={(event) =>
                          setMemoTitle(event.target.value)
                        }
                        placeholder="메모 제목"
                        className="mt-4 w-full rounded-2xl border border-[#eadb9c] bg-white/80 px-4 py-3 text-sm font-black outline-none focus:border-[#d1ac37]"
                      />

                      <textarea
                        value={memoContent}
                        maxLength={3000}
                        onChange={(event) =>
                          setMemoContent(event.target.value)
                        }
                        placeholder="기억하고 싶은 내용을 적어보세요."
                        className="mt-3 h-72 w-full resize-none rounded-2xl border border-[#eadb9c] bg-white/80 px-4 py-4 text-sm font-bold leading-7 outline-none focus:border-[#d1ac37]"
                      />
                      
                      <button
  type="button"
  onClick={() =>
    setIsMemoSecret(
      (previous) => !previous,
    )
  }
  className={`mt-3 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
    isMemoSecret
      ? "border-[#7467d8] bg-[#eeeaff] text-[#5145b5]"
      : "border-[#e4d99f] bg-white/70 text-[#7d7142]"
  }`}
>
  <div>
    <p className="text-sm font-black">
      시크릿레이어에 저장
    </p>

    <p className="mt-1 text-[11px] font-bold text-white/70">
      시크릿 ON 상태에서는 메모 목록에서 숨겨집니다.
    </p>
  </div>

  <span
    className={`flex h-6 w-11 items-center rounded-full p-1 transition ${
      isMemoSecret
        ? "justify-end bg-[#7467d8]"
        : "justify-start bg-[#d7d2df]"
    }`}
  >
    <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
  </span>
</button>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="submit"
                          className="flex-1 rounded-2xl bg-[#e3b936] py-3 text-sm font-black text-white transition hover:scale-[1.01]"
                        >
                          {editingMemoId
                            ? "수정 완료"
                            : "메모 저장"}
                        </button>

                        {editingMemoId && (
                          <button
                            type="button"
                            onClick={cancelMemoEditing}
                            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#8b7a43]"
                          >
                            취소
                          </button>
                        )}
                      </div>
                    </form>

                    <section className="min-h-0 bg-[#fffefa] p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black">
                          저장된 메모
                        </h3>

                        <span className="rounded-full bg-[#fff0a9] px-3 py-1 text-xs font-black text-[#93751d]">
                          {visibleMemos.length}개
                        </span>
                      </div>

                     {visibleMemos.length === 0 ? (
                        <div className="mt-4 flex min-h-80 items-center justify-center rounded-3xl border-2 border-dashed border-[#e5dfc6] text-sm font-bold text-[#aaa18a]">
                          {isSecretLayerOn
  ? "표시할 메모가 없어요."
  : "저장된 메모가 없어요."}
                        </div>
                      ) : (
                        <div className="mt-4 max-h-[440px] space-y-3 overflow-y-auto pr-2">
                         {visibleMemos.map((memo, index) => (
                            <article
                              key={memo.id}
                              className={`rounded-3xl p-4 shadow-sm ${getStickerClass(
                                index,
                              )}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
  <div className="flex flex-wrap items-center gap-2">
    <h4 className="break-words text-base font-black text-[#453e3b]">
      {memo.title}
    </h4>

    {memo.isSecret && (
      <span className="rounded-full bg-[#5145b5] px-2 py-1 text-[9px] font-black text-white">
        SECRET
      </span>
    )}
  </div>
</div>

                                <div className="flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startMemoEditing(memo)
                                    }
                                    className="rounded-full bg-white/75 px-3 py-1.5 text-[11px] font-black text-[#625a68]"
                                  >
                                    수정
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      deleteMemo(memo.id)
                                    }
                                    className="rounded-full bg-white/75 px-3 py-1.5 text-[11px] font-black text-[#d34e67]"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>

                          <p className="mt-3 whitespace-pre-wrap break-words text-sm font-bold leading-7 text-black [text-shadow:none] [-webkit-text-stroke:0px]">
  {memo.content ||
    "작성된 내용이 없어요."}
</p>

                              <p className="mt-3 text-[10px] font-black text-black/35">
                                {new Date(
                                  memo.updatedAt,
                                ).toLocaleString("ko-KR")}
                              </p>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </article>

                <article className="rounded-[30px] border border-white/55 bg-[#dcd8ff]/90 p-6 shadow-[0_25px_80px_rgba(5,35,26,0.3)] backdrop-blur-xl">
                  <p className="text-xs font-black tracking-[0.18em] text-[#77709c]">
                    HOO TIMER
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    자유 타이머
                  </h2>

                  <div className="mt-7 rounded-[28px] bg-white/75 p-6 text-center shadow-inner">
                    <p
                      className={`text-5xl font-black tracking-[0.05em] ${
                        timerRemaining === 0
                          ? "text-[#e45e7e]"
                          : "text-[#4e4767]"
                      }`}
                    >
                      {formatTimer(timerRemaining)}
                    </p>

                    <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#ddd8ef]">
                      <div
                        className="h-full rounded-full bg-[#7467d8] transition-all duration-500"
                        style={{
                          width: `${timerProgress}%`,
                        }}
                      />
                    </div>

                    <p className="mt-3 text-xs font-black text-[#8e87a2]">
                      {timerRemaining === 0
                        ? "시간이 끝났는!"
                        : isTimerRunning
                          ? "타이머가 작동 중이예요."
                          : "타이머가 잠시 쉬고 있어요."}
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-2">
                    <label className="text-center">
                      <span className="text-xs font-black text-[#77709c]">
                        시
                      </span>

                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={timerHours}
                        disabled={isTimerRunning}
                        onChange={(event) =>
                          setTimerHours(
                            Number(event.target.value),
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-[#c8c1e9] bg-white/80 px-2 py-3 text-center text-lg font-black outline-none disabled:opacity-50"
                      />
                    </label>

                    <label className="text-center">
                      <span className="text-xs font-black text-[#77709c]">
                        분
                      </span>

                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={timerMinutes}
                        disabled={isTimerRunning}
                        onChange={(event) =>
                          setTimerMinutes(
                            Number(event.target.value),
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-[#c8c1e9] bg-white/80 px-2 py-3 text-center text-lg font-black outline-none disabled:opacity-50"
                      />
                    </label>

                    <label className="text-center">
                      <span className="text-xs font-black text-[#77709c]">
                        초
                      </span>

                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={timerSeconds}
                        disabled={isTimerRunning}
                        onChange={(event) =>
                          setTimerSeconds(
                            Number(event.target.value),
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-[#c8c1e9] bg-white/80 px-2 py-3 text-center text-lg font-black outline-none disabled:opacity-50"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={applyTimerSetting}
                    disabled={isTimerRunning}
                    className="mt-3 w-full rounded-2xl bg-white/80 py-3 text-sm font-black text-[#665e82] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    입력한 시간 적용
                  </button>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={startOrPauseTimer}
                      className="rounded-2xl bg-[#7467d8] py-3 text-sm font-black text-white transition hover:scale-[1.02] hover:bg-[#6255c7]"
                    >
                      {isTimerRunning
                        ? "일시정지"
                        : "시작"}
                    </button>

                    <button
                      type="button"
                      onClick={resetTimer}
                      className="rounded-2xl bg-[#f0edff] py-3 text-sm font-black text-[#665e82] transition hover:scale-[1.02]"
                    >
                      초기화
                    </button>
                  </div>
                </article>
              </div>
            </section>

                   {/* 세 번째 패널: 미니게임 */}
<section
  className={`flex h-[100dvh] w-screen shrink-0 items-start overflow-x-hidden overflow-y-auto xl:items-center xl:overflow-hidden xl:py-16 ${
    minigameScreen === "2048"
      ? "px-0 pb-0 pt-0 sm:px-4 sm:pb-[calc(24px+var(--hoo-safe-bottom))] sm:pt-[calc(92px+var(--hoo-safe-top))] md:px-7"
      : "px-3 pb-[calc(24px+var(--hoo-safe-bottom))] pt-[calc(92px+var(--hoo-safe-top))] sm:px-4 md:px-7"
  }`}
>
  <div
    className={`mx-auto w-full max-w-[1380px] ${
      minigameScreen === "2048"
        ? "max-md:mx-0 max-md:max-w-none"
        : ""
    }`}
  >
    {minigameScreen === "menu" && (
      <section className="grid h-[calc(100dvh_-_116px_-_var(--hoo-safe-top)_-_var(--hoo-safe-bottom))] min-h-[540px] items-stretch gap-4 sm:gap-7 xl:h-[625px] xl:grid-cols-[1.35fr_0.65fr]">


        {/* 왼쪽: 게임 선택 */}
     <article className="flex h-full min-h-0 flex-col rounded-[26px] border border-white/55 bg-white/90 p-4 shadow-[0_30px_100px_rgba(5,35,26,0.4)] backdrop-blur-xl sm:rounded-[34px] sm:p-6 md:p-8">
          <header className="shrink-0">
            <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
              HOO MINI GAME
            </p>

            <h2 className="mt-1 text-2xl font-black text-[#332f45] sm:text-3xl">
              게임 선택
            </h2>

            <p className="mt-1 text-xs font-bold text-[#8b849d] sm:mt-2 sm:text-sm">
              원하는 게임과 난이도를 선택해 플레이하세요.
            </p>
          </header>

          <div
            data-hoo-vertical-scroll="true"
            className="isolate mt-4 grid h-0 min-h-0 flex-1 touch-pan-y gap-4 overflow-y-scroll overscroll-contain pb-8 pr-0.5 sm:mt-7 sm:gap-5 sm:pr-1 lg:grid-cols-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {/* 스도쿠 카드 */}
            <article className="rounded-[22px] border border-[#ded8ef] bg-[#faf9ff] p-4 shadow-sm sm:rounded-[28px] sm:p-6">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eeeafd] text-3xl">
                  🧩
                </span>

                <div>
                  <p className="text-[11px] font-black tracking-[0.16em] text-[#928ba8]">
                    NUMBER PUZZLE
                  </p>

                  <h3 className="text-2xl font-black text-[#332f45]">
                    스도쿠
                  </h3>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-6">
                {(["easy", "normal", "hard"] as SudokuDifficulty[]).map(
                  (difficulty) => (
                    <button
                      key={difficulty}
                      type="button"
                      onClick={() =>
                        setSudokuDifficulty(difficulty)
                      }
                      className={`rounded-xl py-2 text-xs font-black transition ${
                        sudokuDifficulty === difficulty
                          ? "bg-[#7467d8] text-white"
                          : "bg-white text-[#827b95] hover:bg-[#eeeafd]"
                      }`}
                    >
                      {getSudokuDifficultyLabel(difficulty)}
                    </button>
                  ),
                )}
              </div>

              <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 sm:mt-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#928ba8]">
                    최고기록
                  </span>

                 <strong className="text-lg font-black text-[#332f45]">
  {sudokuBestTimes[sudokuDifficulty] === null
    ? "--:--"
    : formatSudokuTime(
        sudokuBestTimes[sudokuDifficulty] as number,
      )}
</strong>

                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#928ba8]">
                    타임어택
                  </span>

                  <strong className="text-sm font-black text-[#7467d8]">
                    10:00
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  startSudokuGame(sudokuDifficulty);
                  openMinigame("sudoku");
                }}
                className="mt-4 w-full rounded-2xl bg-[#7467d8] py-3.5 text-sm font-black text-white transition hover:scale-[1.02] hover:bg-[#6255c7] sm:mt-6"
              >
                스도쿠 플레이
              </button>
            </article>

           {/* 2048 카드 */}

<article
  className={`rounded-[22px] p-4 shadow-sm transition-all duration-300 sm:rounded-[28px] sm:p-6 ${
    hoo2048Difficulty === "buddha"
      ? "border border-white/10 bg-black text-white shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
      : "border border-[#ded8ef] bg-[#faf9ff]"
  }`}
>
  {hoo2048Difficulty === "buddha" && (
    <div className="mb-6 rounded-[20px] border border-red-700/70 bg-red-950/30 px-5 py-4 text-center shadow-[0_0_26px_rgba(220,38,38,0.12)]">
      <p className="text-sm font-black leading-7 text-red-50">
        이 모드는 절대 못 깹니다.
        <br />
        도전하시겠습니까?
      </p>
    </div>
  )}

  <div className="flex items-center gap-4">
    <span
      className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl transition-all ${
        hoo2048Difficulty === "buddha"
          ? "bg-white text-black"
          : "bg-[#fff0d9]"
      }`}
    >
      {hoo2048Difficulty === "buddha"
        ? "☯"
        : "🔢"}
    </span>

    <div>
      <p
        className={`text-[11px] font-black tracking-[0.16em] ${
          hoo2048Difficulty === "buddha"
            ? "text-white/40"
            : "text-[#928ba8]"
        }`}
      >
        NUMBER MERGE
      </p>

      <h3
        className={`text-2xl font-black ${
          hoo2048Difficulty === "buddha"
            ? "text-white"
            : "text-[#332f45]"
        }`}
      >
        HOO 2048
      </h3>
    </div>
  </div>

  <div className="mt-6 grid grid-cols-4 gap-2">
    {(
      [
        ["easy", "쉬움"],
        ["normal", "보통"],
        ["hard", "어려움"],
        ["buddha", "부처"],
      ] as const
    ).map(([difficulty, label]) => {
      const isSelected =
        hoo2048Difficulty === difficulty;

      const isBuddhaCard =
        hoo2048Difficulty === "buddha";

      return (
        <button
          key={difficulty}
          type="button"
          onClick={() =>
            setHoo2048Difficulty(
              difficulty,
            )
          }
          className={`rounded-xl py-2 text-xs font-black transition ${
            isSelected
              ? difficulty === "buddha"
                ? "bg-white text-black shadow-[0_8px_20px_rgba(255,255,255,0.12)]"
                : "bg-[#7467d8] text-white"
              : isBuddhaCard
                ? "border border-white/10 bg-white/[0.04] text-white/40 hover:bg-white/10 hover:text-white"
                : difficulty === "buddha"
                  ? "border border-black bg-white text-black hover:bg-black hover:text-white"
                  : "bg-white text-[#827b95] hover:bg-[#eeeafd]"
          }`}
        >
          {label}
        </button>
      );
    })}
  </div>

  <div
    className={`mt-6 space-y-3 rounded-2xl p-4 ${
      hoo2048Difficulty === "buddha"
        ? "border border-white/10 bg-white/[0.055]"
        : "bg-white"
    }`}
  >
    <div className="flex items-center justify-between">
      <span
        className={`text-xs font-bold ${
          hoo2048Difficulty === "buddha"
            ? "text-white/45"
            : "text-[#928ba8]"
        }`}
      >
        최고점수
      </span>

      <strong
        className={`text-lg font-black ${
          hoo2048Difficulty === "buddha"
            ? "text-white"
            : "text-[#332f45]"
        }`}
      >
        {hoo2048BestScores[
          hoo2048Difficulty
        ].toLocaleString("ko-KR")}
      </strong>
    </div>

    <div className="flex items-center justify-between">
      <span
        className={`text-xs font-bold ${
          hoo2048Difficulty === "buddha"
            ? "text-white/45"
            : "text-[#928ba8]"
        }`}
      >
        타임어택
      </span>

      <strong
        className={`text-sm font-black ${
          hoo2048Difficulty === "buddha"
            ? "text-red-400"
            : "text-[#7467d8]"
        }`}
      >
        제한 없음
      </strong>
    </div>
  </div>

  <button
  type="button"
  onClick={() => {
    if (
      hoo2048Difficulty === "buddha" &&
      !document.fullscreenElement
    ) {
      void document.documentElement
        .requestFullscreen()
        .catch((error) => {
          console.warn(
            "전체화면 진입에 실패했습니다:",
            error,
          );
        });
    }

    openMinigame("2048");
  }}
  className={`mt-6 w-full rounded-2xl border py-3.5 text-sm font-black text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
    hoo2048Difficulty === "buddha"
      ? "border-orange-300/70 bg-[#ff7a1a] shadow-[0_10px_30px_rgba(255,122,26,0.42)] hover:bg-[#ff8a33] hover:shadow-[0_14px_38px_rgba(255,122,26,0.55)] active:bg-[#ed6d0d]"
      : "border-[#f0a33a]/60 bg-[#f0a33a] hover:bg-[#df9027]"
  }`}
>
  {hoo2048Difficulty === "buddha"
    ? "깰 게임이면 안 왔다. 도전!"
    : "HOO 2048 플레이"}
</button>

</article>

            {/* HOO 1952 카드 — 두 번째 줄 오른쪽 */}
            <article className="relative z-0 order-4 flex min-h-[360px] flex-col overflow-hidden rounded-[22px] border border-[#555] bg-[#111] p-4 text-white shadow-sm sm:rounded-[28px] sm:p-6">
              <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:repeating-linear-gradient(0deg,transparent,transparent_4px,#fff_5px)]" />
              <div className="relative flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white text-3xl grayscale">
                  ✈️
                </span>
                <div>
                  <p className="text-[11px] font-black tracking-[0.16em] text-white/40">
                    CLASSIC AIR SHOOTER
                  </p>
                  <h3 className="text-2xl font-black tracking-[0.08em] text-white">
                    HOO 1952
                  </h3>
                </div>
              </div>

              <div className="relative mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:mt-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-white/45">조작 방식</span>
                  <strong className="text-right text-sm font-black text-white">드래그 · 자동 사격</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-white/45">작전 모드</span>
                  <strong className="text-right text-sm font-black text-white">무한 웨이브</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-white/45">랭킹 점수</span>
                  <strong className="text-right text-sm font-black text-white">생존 30초마다 +10점</strong>
                </div>
              </div>

              <button
                type="button"
                data-game-id="1952"
                onClick={(event) => {
                  event.stopPropagation();
                  openMinigame("1952");
                }}
                className="relative mt-auto w-full rounded-2xl border border-white/70 bg-white/10 py-3.5 text-sm font-black tracking-[0.08em] !text-white transition hover:scale-[1.02] hover:bg-white/20"
              >
                HOO 1952 출격
              </button>
            </article>

            {/* 사천성 카드 */}
            <article className="order-3 rounded-[22px] border border-[#ded8ef] bg-[#faf9ff] p-4 shadow-sm sm:rounded-[28px] sm:p-6">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#efe8ff] text-3xl">
                  🀄
                </span>

                <div>
                  <p className="text-[11px] font-black tracking-[0.16em] text-[#928ba8]">
                    TILE CONNECT
                  </p>

                  <h3 className="text-2xl font-black text-[#332f45]">
                    HOO 사천성
                  </h3>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white p-4 sm:mt-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#928ba8]">
                    전체 스테이지
                  </span>

                  <strong className="text-lg font-black text-[#332f45]">
                    100
                  </strong>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#928ba8]">
                    시작 보드
                  </span>

                  <strong className="text-sm font-black text-[#7467d8]">
                    4×4
                  </strong>
                </div>
              </div>

              <button
                type="button"
                data-game-id="shisen"
                onClick={(event) => {
                  event.stopPropagation();
                  openMinigame("shisen");
                }}
                className="mt-4 w-full rounded-2xl bg-[#8b63dc] py-3.5 text-sm font-black text-white transition hover:scale-[1.02] hover:bg-[#7650c9] sm:mt-6"
              >
                HOO 사천성 플레이
              </button>
            </article>

                      {/* HOO BUBBLE 카드 */}
            <article className="relative z-20 order-5 flex min-h-[360px] flex-col overflow-hidden rounded-[22px] border border-[#59634e] bg-[#141713] p-4 text-white shadow-sm sm:rounded-[28px] sm:p-6">
              <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:repeating-linear-gradient(0deg,transparent,transparent_5px,#dfe7d2_6px)]" />

              <div className="relative flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#aab59a]/40 bg-[#252b22] text-3xl">
                  🦎
                </span>

                <div>
                  <p className="text-[11px] font-black tracking-[0.16em] text-[#aab59a]">
                    CLASSIC BUBBLE ACTION
                  </p>

                  <h3 className="font-mono text-2xl font-black tracking-[0.06em] text-white">
                    HOO BUBBLE
                  </h3>
                </div>
              </div>

              <div className="relative mt-4 space-y-3 rounded-2xl border border-[#aab59a]/20 bg-black/25 p-4 sm:mt-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-white/45">
                    주인공
                  </span>

                  <strong className="text-right text-sm font-black text-[#dfe7d2]">
                    하찮은 두 발 도마뱀
                  </strong>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-white/45">
                    조작 방식
                  </span>

                  <strong className="text-right text-sm font-black text-white">
                    4방향 · 버블 발사
                  </strong>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-white/45">
                    플레이
                  </span>

                  <strong className="text-right text-sm font-black text-white">
                    버블 포획 · 연속 스테이지
                  </strong>
                </div>
              </div>

              <button
                type="button"
                data-game-id="bubble"
                aria-label="HOO BUBBLE 게임 열기"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  openMinigame("bubble");
                }}
                className="relative z-30 mt-auto w-full touch-manipulation rounded-2xl border border-[#cfd8c2]/60 bg-[#59634e] py-3.5 font-mono text-sm font-black tracking-[0.08em] text-white transition hover:scale-[1.02] hover:bg-[#6b765e] active:scale-[0.98]"
              >
                HOO BUBBLE 플레이
              </button>
            </article>

            {/* HOO WORLD 카드 */}
            <article className="relative order-6 flex min-h-[360px] flex-col overflow-hidden rounded-[22px] border border-[#b8d6aa] bg-gradient-to-b from-[#f5fbef] to-[#e3f0d8] p-4 shadow-sm sm:rounded-[28px] sm:p-6">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/45" />
              <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-[#bdd9aa]/30" />

              <div className="relative flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#b8d6aa] bg-white/80 text-3xl shadow-sm">
                  🏡
                </span>

                <div>
                  <p className="text-[11px] font-black tracking-[0.16em] text-[#79906d]">
                    HEALING LIFE WORLD
                  </p>

                  <h3 className="text-2xl font-black text-[#34452f]">
                    HOO WORLD
                  </h3>
                </div>
              </div>

              <p className="relative mt-5 text-sm font-bold leading-6 text-[#6c8063]">
                나만의 작은 집을 꾸미고,
                다른 이용자들과 함께 머무는
                HOO의 생활 공간입니다.
              </p>

              <div className="relative mt-5 space-y-3 rounded-2xl border border-white/70 bg-white/65 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#84977b]">
                    현재 접속
                  </span>

                  <strong className="text-sm font-black text-[#40553a]">
                    {isHooWorldPresenceConnected
                      ? `${hooWorldOnlineCount}명`
                      : "오프라인"}
                  </strong>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#84977b]">
                    콘텐츠
                  </span>

                  <strong className="text-right text-sm font-black text-[#40553a]">
                    하우징 · 생활 · 멀티
                  </strong>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#84977b]">
                    성장
                  </span>

                  <strong className="text-right text-sm font-black text-[#40553a]">
                    HOO COIN
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    "/hoo-world";
                }}
                className="relative z-10 mt-auto w-full rounded-2xl border border-[#8fb27f] bg-[#6f9360] py-3.5 text-sm font-black tracking-[0.06em] text-white transition hover:scale-[1.02] hover:bg-[#628653] active:scale-[0.98]"
              >
                HOO WORLD 입장
              </button>
            </article>

          </div>
        </article>

      <div className="hidden h-full min-h-0 xl:block">
        <div className="hoo-community-readable h-full">
          <HooCommunityPanel
            refreshKey={communityRefreshKey}
          />
        </div>
      </div>
      </section>
    )}

    {minigameScreen === "2048" && (
      <section className="grid min-h-[100dvh] items-start gap-0 md:min-h-0 md:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="min-h-[100dvh] w-full rounded-none border-0 bg-white/90 px-4 pb-[calc(24px+var(--hoo-safe-bottom))] pt-[calc(20px+var(--hoo-safe-top))] shadow-none backdrop-blur-xl sm:min-h-0 sm:rounded-[34px] sm:border sm:border-white/55 sm:p-6 sm:shadow-[0_30px_100px_rgba(5,35,26,0.4)] md:p-8">
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
                HOO MINI GAME
              </p>

              <h2 className="mt-1 text-3xl font-black text-[#332f45]">
                HOO 2048
              </h2>
            </div>

            <button
              type="button"
              onClick={closeMinigame}
              className="rounded-full bg-[#eeeafd] px-5 py-2.5 text-sm font-black text-[#665e82] transition hover:bg-[#ddd7fa]"
            >
              ← 게임 선택
            </button>
          </header>

          <div className="mt-6">
         
 <Hoo2048Game
  difficulty={hoo2048Difficulty}
  autoStartBuddha={
    hoo2048Difficulty === "buddha"
  }
  bestScore={
    hoo2048BestScores[
      hoo2048Difficulty
    ]
  }
  onScoreChange={(score) => {
    setHoo2048BestScores(
      (previousScores) => {
        if (
          score <=
          previousScores[
            hoo2048Difficulty
          ]
        ) {
          return previousScores;
        }

        return {
          ...previousScores,
          [hoo2048Difficulty]: score,
        };
      },
    );
  }}
  onRecordSaved={() => {
    setCommunityRefreshKey(
      (previous) => previous + 1,
    );
  }}
  onBackToMenu={closeMinigame}
/>

          </div>
        </article>

        <div className="min-h-0">
          <HooCommunityPanel
            refreshKey={communityRefreshKey}
          />
        </div>
      </section>
    )}

    {(() => {
      switch (minigameScreen) {
        case "shisen":
          return (
            <HooShisenGame
              key="hoo-shisen-game"
              onExit={closeMinigame}
            />
          );

        case "1952":
          return (
            <Hoo1952Game
              key="hoo-1952-game"
              onExit={closeMinigame}
              onRecordSaved={() => {
                setCommunityRefreshKey((previous) => previous + 1);
              }}
            />
          );

        case "bubble":
          return (
            <HooBubbleGame
              key="hoo-bubble-game"
              onExit={closeMinigame}
              onRecordSaved={() => {
                setCommunityRefreshKey((previous) => previous + 1);
              }}
            />
          );

        default:
          return null;
      }
    })()}

    {minigameScreen === "sudoku" &&
      createPortal(
      <section className="fixed inset-0 z-[999999] h-[100dvh] w-[100dvw] overflow-y-auto overscroll-none bg-black text-white">
        <div className="mx-auto min-h-full w-full max-w-[1100px] px-3 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] sm:px-6 sm:pb-8 sm:pt-5">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 sm:pb-5">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-white/40 sm:text-xs">
              HOO MINI GAME
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-[0.08em] text-white sm:text-4xl">
              스도쿠
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsSudokuRunning(false);
              closeMinigame();
            }}
            className="flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-black px-4 py-2 text-sm font-black text-white transition active:scale-[0.97] sm:px-6 sm:py-3 sm:text-base md:hover:border-white/60 md:hover:bg-white/5"
          >
            나가기

            <span className="text-xl font-light leading-none sm:text-2xl">
              ×
            </span>
          </button>
        </header>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
  {/* 왼쪽: 스도쿠 게임판 */}
  <article className="rounded-[28px] border border-[#ded8ef] bg-[#faf9ff] p-5 md:p-7">
    <div className="mx-auto grid w-full max-w-[540px] grid-cols-9 overflow-hidden rounded-2xl border-4 border-[#4f4965] bg-[#4f4965]">
      {sudokuBoard.map((row, rowIndex) =>
        row.map((value, columnIndex) => {
          const isFixed =
            sudokuPuzzle[rowIndex]?.[columnIndex] !== 0;

          const isSelected =
            selectedSudokuCell?.row === rowIndex &&
            selectedSudokuCell?.column === columnIndex;

          const isIncorrect =
            value !== 0 &&
            value !==
              sudokuSolution[rowIndex]?.[columnIndex];

          const thickRightBorder =
            columnIndex === 2 || columnIndex === 5;

          const thickBottomBorder =
            rowIndex === 2 || rowIndex === 5;

          return (
            <button
              key={`${rowIndex}-${columnIndex}`}
              type="button"
              disabled={isFixed || isSudokuCompleted}
              onClick={() =>
                setSelectedSudokuCell({
                  row: rowIndex,
                  column: columnIndex,
                })
              }
              className={`aspect-square border border-[#d9d4e7] text-base font-black transition md:text-xl ${
                thickRightBorder
                  ? "border-r-[3px] border-r-[#4f4965]"
                  : ""
              } ${
                thickBottomBorder
                  ? "border-b-[3px] border-b-[#4f4965]"
                  : ""
              } ${
                isFixed
                  ? "bg-[#eeeafd] text-[#3f3955]"
                  : isSelected
                    ? "bg-[#dcd5ff] text-[#6255c7]"
                    : "bg-white text-[#7467d8] hover:bg-[#f5f2ff]"
              } ${
                isIncorrect
                  ? "bg-[#ffe3e8] text-[#d94f6b]"
                  : ""
              }`}
            >
              {value === 0 ? "" : value}
            </button>
          );
        }),
      )}
    </div>

    {/* 숫자 선택 */}
    <div className="mx-auto mt-6 grid w-full max-w-[540px] grid-cols-9 gap-2">
      {SUDOKU_NUMBERS.map((number) => (
        <button
          key={number}
          type="button"
          disabled={
            !selectedSudokuCell || isSudokuCompleted
          }
          onClick={() => selectSudokuNumber(number)}
          className="aspect-square rounded-xl bg-[#7467d8] text-sm font-black text-white transition hover:scale-105 hover:bg-[#6255c7] disabled:cursor-not-allowed disabled:bg-[#c9c4d8]"
        >
          {number}
        </button>
      ))}
    </div>
  </article>

  {/* 오른쪽: 게임 정보 */}
  <aside className="rounded-[28px] border border-[#ded8ef] bg-[#f7f5ff] p-6">
    <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
      GAME STATUS
    </p>

    <h3 className="mt-1 text-2xl font-black text-[#332f45]">
      게임 정보
    </h3>

    <div className="mt-6 rounded-2xl bg-white p-5 text-center">
      <p className="text-xs font-bold text-[#928ba8]">
        진행 시간
      </p>

      <p className="mt-2 text-4xl font-black text-[#7467d8]">
        {formatSudokuTime(sudokuSeconds)}
      </p>
    </div>

    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between rounded-2xl bg-white p-4">
        <span className="text-xs font-bold text-[#928ba8]">
          난이도
        </span>

        <strong className="text-sm font-black text-[#332f45]">
          {getSudokuDifficultyLabel(sudokuDifficulty)}
        </strong>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white p-4">
        <span className="text-xs font-bold text-[#928ba8]">
          남은 힌트
        </span>

        <strong className="text-sm font-black text-[#f0a33a]">
          {sudokuHintCount}개
        </strong>
      </div>
    </div>

    <button
      type="button"
      disabled={
        sudokuHintCount <= 0 || isSudokuCompleted
      }
      onClick={useSudokuHint}
      className="mt-5 w-full rounded-2xl bg-[#f0a33a] py-3.5 text-sm font-black text-white transition hover:bg-[#df9027] disabled:cursor-not-allowed disabled:bg-[#c9c4d8]"
    >
      힌트 사용
    </button>

    <button
      type="button"
      onClick={() =>
        startSudokuGame(sudokuDifficulty)
      }
      className="mt-3 w-full rounded-2xl bg-[#eeeafd] py-3.5 text-sm font-black text-[#665e82] transition hover:bg-[#ddd7fa]"
    >
      다시 시작
    </button>

    {isSudokuCompleted && (
      <div className="mt-5 rounded-2xl border border-[#8ce0af] bg-[#ecfff3] p-4 text-center">
        <p className="text-xl font-black text-[#27955b]">
          🎉 스도쿠 완료!
        </p>

        <p className="mt-2 text-xs font-bold text-[#557061]">
          기록 {formatSudokuTime(sudokuSeconds)}
        </p>
      </div>
    )}

    {sudokuSaveMessage && (
      <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-center text-xs font-bold text-[#746d83]">
        {isSudokuSaving
          ? "기록 저장 중..."
          : sudokuSaveMessage}
      </p>
    )}
  </aside>
</div>
        </div>
      </section>
      ,
      document.body,
    )}
  </div>
</section>

          </div>
          

{/* 가로 화면 이동 화살표 */}

{horizontalPage > -1 && (
  <button
    type="button"
    onClick={() => moveHorizontalPage("prev")}
    className="group absolute left-3 top-1/2 z-50 flex h-28 w-16 -translate-y-1/2 items-center justify-center rounded-r-3xl bg-black/0 transition hover:bg-black/15 focus:outline-none md:left-6"
    aria-label={
      horizontalPage === 0
        ? "투두리스트 화면으로 이동"
        : horizontalPage === 1
          ? "캘린더 화면으로 이동"
          : "메모와 타이머 화면으로 이동"
    }
  >
    <span className="h-0 w-0 border-y-[15px] border-r-[23px] border-y-transparent border-r-white/55 drop-shadow-[0_3px_8px_rgba(0,0,0,0.55)] transition duration-300 group-hover:-translate-x-1 group-hover:border-r-white/95" />
  </button>
)}

{horizontalPage < 2 && (
  <button
    type="button"
    onClick={() => moveHorizontalPage("next")}
    className="group absolute right-3 top-1/2 z-50 flex h-28 w-16 -translate-y-1/2 items-center justify-center rounded-l-3xl bg-black/0 transition hover:bg-black/15 focus:outline-none md:right-6"
    aria-label={
      horizontalPage === -1
        ? "캘린더 화면으로 이동"
        : horizontalPage === 0
          ? "메모와 타이머 화면으로 이동"
          : "미니게임 화면으로 이동"
    }
  >
    <span className="h-0 w-0 border-y-[15px] border-l-[23px] border-y-transparent border-l-white/55 drop-shadow-[0_3px_8px_rgba(0,0,0,0.55)] transition duration-300 group-hover:translate-x-1 group-hover:border-l-white/95" />
  </button>
)}

 </div>
      </section>

{/* HOO 날씨 위치 사용 동의 모달 */}

{isWeatherConsentOpen &&
  !isWeatherPreferenceLoading && (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-[#090711]/80 px-4 py-6 backdrop-blur-md"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="hoo-weather-consent-title"
        className="w-full max-w-[560px] overflow-hidden rounded-[32px] border border-[#ddd6ff] bg-[#faf9ff] shadow-[0_35px_120px_rgba(0,0,0,0.55)]"
      >
        <header className="border-b border-[#e7e2f2] bg-gradient-to-r from-[#f1efff] via-[#faf8ff] to-[#eef7ff] px-6 py-7 text-center md:px-8">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#7467d8] text-3xl shadow-[0_12px_30px_rgba(70,55,170,0.28)]">
            ☀
          </span>

          <p className="mt-5 text-[11px] font-black tracking-[0.2em] text-[#7569bd]">
            HOO WEATHER BRIEFING
          </p>

          <h2
            id="hoo-weather-consent-title"
            className="mt-2 text-2xl font-black text-[#302b40] md:text-3xl"
          >
            오늘의 날씨도 함께 볼까요?
          </h2>
        </header>

        <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-6 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:px-8">
          <p className="text-center text-[15px] font-semibold leading-7 text-[#625c71]">
            현재 지역의 날씨를 일정과
            함께 분석해 더 자연스러운
            브리핑을 전해드릴게요.
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-[#e0daf0] bg-white p-4">
              <p className="text-sm font-black text-[#403a50]">
                최소한의 위치만 사용해요
              </p>

              <p className="mt-1 text-xs font-semibold leading-5 text-[#817a8e]">
                정확한 주소나 이동 경로는
                저장하지 않아요. 날씨 확인에
                필요한 대략적인 좌표만 한 번
                확인합니다.
              </p>
            </div>

            <div className="rounded-2xl border border-[#e0daf0] bg-white p-4">
              <p className="text-sm font-black text-[#403a50]">
                계속 추적하지 않아요
              </p>

              <p className="mt-1 text-xs font-semibold leading-5 text-[#817a8e]">
                위치를 실시간으로 추적하지
                않고, 저장된 지역의 날씨만
                확인합니다.
              </p>
            </div>

            <div className="rounded-2xl border border-[#e0daf0] bg-white p-4">
              <p className="text-sm font-black text-[#403a50]">
                언제든 변경할 수 있어요
              </p>

              <p className="mt-1 text-xs font-semibold leading-5 text-[#817a8e]">
                날씨 브리핑을 사용하지 않아도
                일정과 투두 기능은 동일하게
                이용할 수 있어요.
              </p>
            </div>
          </div>

          {weatherErrorMessage && (
            <p
              role="alert"
              className="mt-5 rounded-2xl border border-[#f1caca] bg-[#fff2f2] px-4 py-3 text-center text-sm font-bold leading-6 text-[#a34f4f]"
            >
              {weatherErrorMessage}
            </p>
          )}

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={
                disableHooWeather
              }
              disabled={isWeatherLoading}
              className="rounded-2xl border border-[#ddd7e8] bg-white px-5 py-3.5 text-sm font-black text-[#726b7e] transition hover:bg-[#f1eef6] disabled:cursor-wait disabled:opacity-50"
            >
              날씨 없이 이용하기
            </button>

            <button
              type="button"
              onClick={
                enableHooWeatherWithCurrentLocation
              }
              disabled={isWeatherLoading}
              className="rounded-2xl bg-[#7365d7] px-5 py-3.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(73,60,170,0.28)] transition hover:bg-[#6254c9] disabled:cursor-wait disabled:opacity-60"
            >
              {weatherPermissionStatus ===
              "requesting"
                ? "현재 위치 확인 중..."
                : "현재 위치로 시작"}
            </button>
          </div>

          <p className="mt-4 text-center text-[11px] font-semibold leading-5 text-[#9690a1]">
            현재 위치를 선택하면 브라우저의
            위치 권한 확인창이 표시됩니다.
          </p>
        </div>
      </section>
    </div>
  )}

{/* HOO 반복 생활 확인 모달 */}


{isRoutineConfirmationOpen &&
  selectedRoutineCandidate && (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-[#090711]/80 px-4 py-6 backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          closeRoutineConfirmation();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="hoo-routine-title"
        className="w-full max-w-[620px] overflow-hidden rounded-[32px] border border-[#ddd6ff] bg-[#faf9ff] shadow-[0_35px_120px_rgba(0,0,0,0.55)]"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="flex items-start justify-between border-b border-[#e6e1f3] bg-gradient-to-r from-[#f2efff] to-[#fffaf0] px-6 py-6 md:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#e2ad52] text-2xl font-black text-[#352711] shadow-[0_10px_25px_rgba(107,72,15,0.22)]">
              ↻
            </span>

            <div className="min-w-0">
              <p className="text-[11px] font-black tracking-[0.2em] text-[#8a7044]">
                HOO ROUTINE
              </p>

              <h2
                id="hoo-routine-title"
                className="mt-1 text-xl font-black text-[#302b40] md:text-2xl"
              >
                반복되는 생활을 발견했어요
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={
              closeRoutineConfirmation
            }
            disabled={isRoutineSaving}
            className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ddd7eb] bg-white text-xl font-bold text-[#625c72] shadow-sm transition hover:bg-[#f1eef8] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="반복 생활 확인창 닫기"
          >
            ×
          </button>
        </header>

        <div className="max-h-[calc(100vh-210px)] overflow-y-auto px-6 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:px-8">
          <p className="text-[15px] font-semibold leading-7 text-[#5d576d]">
            최근 일정에서 아래 생활이
            반복되는 것을 확인했어요.
            이용자의 시간을 임의로 채우지
            않도록, 먼저 확인을 요청드려요.
          </p>

          <div className="mt-6 rounded-3xl border border-[#ddd6f6] bg-[#f3f0ff] p-5">
            <p className="text-[11px] font-black tracking-[0.18em] text-[#7568c9]">
              발견한 생활
            </p>

            <h3 className="mt-2 text-2xl font-black text-[#332e45]">
              {
                selectedRoutineCandidate.name
              }
            </h3>

            <div className="mt-4 flex flex-wrap gap-2">
              {selectedRoutineCandidate.daysOfWeek.map(
                (day) => {
                  const dayNames = [
                    "일요일",
                    "월요일",
                    "화요일",
                    "수요일",
                    "목요일",
                    "금요일",
                    "토요일",
                  ];

                  return (
                    <span
                      key={day}
                      className="rounded-full border border-[#cec5f4] bg-white px-3 py-1.5 text-xs font-bold text-[#5c50ae]"
                    >
                      {dayNames[day] ??
                        `${day}요일`}
                    </span>
                  );
                },
              )}

              <span className="rounded-full border border-[#e1d5bc] bg-[#fffaf0] px-3 py-1.5 text-xs font-bold text-[#806333]">
                {
                  selectedRoutineCandidate.observationCount
                }
                회 관찰
              </span>

              <span className="rounded-full border border-[#ddd8e8] bg-white px-3 py-1.5 text-xs font-bold text-[#70697e]">
                신뢰도{" "}
                {Math.round(
                  selectedRoutineCandidate.confidence *
                    100,
                )}
                %
              </span>
            </div>

            {selectedRoutineCandidate.inferenceReason && (
              <p className="mt-4 text-sm font-semibold leading-6 text-[#746d82]">
                {
                  selectedRoutineCandidate.inferenceReason
                }
              </p>
            )}
          </div>

          <div className="mt-6">
            <p className="text-sm font-black text-[#403a50]">
              보통 어느 시간에
              이루어지나요?
            </p>

            <p className="mt-1 text-xs font-semibold text-[#8a8496]">
              정확하지 않아도 괜찮아요.
              나중에 다시 조정할 수 있어요.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-[#777082]">
                  시작 시간
                </span>

                <input
                  type="time"
                  value={routineStartTime}
                  onChange={(event) =>
                    setRoutineStartTime(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-2xl border border-[#dcd6e8] bg-white px-4 py-3 text-sm font-bold text-[#393345] outline-none transition focus:border-[#7668db] focus:ring-2 focus:ring-[#7668db]/15"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-[#777082]">
                  종료 시간
                </span>

                <input
                  type="time"
                  value={routineEndTime}
                  onChange={(event) =>
                    setRoutineEndTime(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-2xl border border-[#dcd6e8] bg-white px-4 py-3 text-sm font-bold text-[#393345] outline-none transition focus:border-[#7668db] focus:ring-2 focus:ring-[#7668db]/15"
                />
              </label>
            </div>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#ddd7ec] bg-white p-4">
            <input
              type="checkbox"
              checked={
                shouldProtectRoutineTime
              }
              onChange={(event) =>
                setShouldProtectRoutineTime(
                  event.target.checked,
                )
              }
              className="mt-1 h-5 w-5 shrink-0 accent-[#7365d7]"
            />

            <span>
              <span className="block text-sm font-black text-[#40394f]">
                이 시간대를 존중해 주세요
              </span>

              <span className="mt-1 block text-xs font-semibold leading-5 text-[#81798e]">
                HOO가 빈 시간으로 판단해
                새로운 할 일을 권하지
                않도록 보호합니다.
              </span>
            </span>
          </label>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={
                rejectRoutineCandidate
              }
              disabled={isRoutineSaving}
              className="rounded-2xl border border-[#ddd7e8] bg-white px-5 py-3.5 text-sm font-black text-[#726b7e] transition hover:bg-[#f1eef6] disabled:cursor-wait disabled:opacity-50"
            >
              내 반복 생활이 아니에요
            </button>

            <button
              type="button"
              onClick={
                confirmRoutineCandidate
              }
              disabled={isRoutineSaving}
              className="rounded-2xl bg-[#7365d7] px-5 py-3.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(73,60,170,0.28)] transition hover:bg-[#6254c9] disabled:cursor-wait disabled:opacity-60"
            >
              {isRoutineSaving
                ? "저장하고 있어요..."
                : "내 생활로 확인"}
            </button>
          </div>
        </div>
      </section>
    </div>
  )}


{/* HOO 예약 컨텍스트 메시지 */}

{isContextMessageOpen &&
  contextMessage &&
  (() => {
  const messageDesignByType: Record<
  HooContextMessageType,
  {
    icon: string;
    label: string;
    header: string;
    iconBackground: string;
    labelColor: string;
    titleColor: string;
    contentColor: string;
    border: string;
    button: string;
    shadow: string;
  }
> = {
  schedule_preparation: {
    icon: "◷",
    label: "HOO SCHEDULE",
    header:
      "from-[#e5e0ff] via-[#f3f0ff] to-white",
    iconBackground:
      "bg-[#7467d8]",
    labelColor:
      "text-[#6558c5]",
    titleColor:
      "text-[#37304f]",
    contentColor:
      "text-[#5d5670]",
    border:
      "border-[#d8d0f3]",
    button:
      "bg-[#7467d8] hover:bg-[#6255c7]",
    shadow:
      "shadow-[0_30px_90px_rgba(76,62,150,0.3)]",
  },

  weather_care: {
    icon: "☂",
    label: "HOO WEATHER CARE",
    header:
      "from-[#dcecff] via-[#eef6ff] to-white",
    iconBackground:
      "bg-[#4f8fd8]",
    labelColor:
      "text-[#3977bd]",
    titleColor:
      "text-[#263d58]",
    contentColor:
      "text-[#4c6077]",
    border:
      "border-[#c8def3]",
    button:
      "bg-[#4f8fd8] hover:bg-[#3f7fc8]",
    shadow:
      "shadow-[0_30px_90px_rgba(35,86,140,0.3)]",
  },

  sunset: {
    icon: "☀",
    label: "HOO SUNSET",
    header:
      "from-[#f2dcff] via-[#fff0ec] to-white",
    iconBackground:
      "bg-gradient-to-br from-[#dd7f72] to-[#8c68cb]",
    labelColor:
      "text-[#9a5c9d]",
    titleColor:
      "text-[#49354f]",
    contentColor:
      "text-[#66526c]",
    border:
      "border-[#e6cfea]",
    button:
      "bg-[#8d68c6] hover:bg-[#7957b3]",
    shadow:
      "shadow-[0_30px_90px_rgba(90,54,120,0.32)]",
  },

  routine_respect: {
    icon: "⌁",
    label: "HOO ROUTINE",
    header:
      "from-[#e1f3ec] via-[#f1faf6] to-white",
    iconBackground:
      "bg-[#4f9b7c]",
    labelColor:
      "text-[#3e856b]",
    titleColor:
      "text-[#29483d]",
    contentColor:
      "text-[#526d63]",
    border:
      "border-[#cce5db]",
    button:
      "bg-[#4f9b7c] hover:bg-[#40886b]",
    shadow:
      "shadow-[0_30px_90px_rgba(42,105,80,0.3)]",
  },

  condition_care: {
    icon: "♡",
    label: "HOO CONDITION CARE",
    header:
      "from-[#fff0d8] via-[#fff8ed] to-white",
    iconBackground:
      "bg-[#ed9b50]",
    labelColor:
      "text-[#c37431]",
    titleColor:
      "text-[#55402d]",
    contentColor:
      "text-[#705b49]",
    border:
      "border-[#efd9bd]",
    button:
      "bg-[#e99145] hover:bg-[#d88038]",
    shadow:
      "shadow-[0_30px_90px_rgba(125,78,34,0.3)]",
  },

  gentle_encouragement: {
    icon: "✦",
    label: "HOO WITH YOU",
    header:
      "from-[#eee9ff] via-[#f8f6ff] to-white",
    iconBackground:
      "bg-[#8b78dc]",
    labelColor:
      "text-[#7663c8]",
    titleColor:
      "text-[#403755]",
    contentColor:
      "text-[#625972]",
    border:
      "border-[#ddd5f2]",
    button:
      "bg-[#8b78dc] hover:bg-[#7865c8]",
    shadow:
      "shadow-[0_30px_90px_rgba(85,68,145,0.3)]",
  },
};

const messageDesign =
  messageDesignByType[
    contextMessage.messageType
  ];

    return (
      <div
        className="fixed inset-0 z-[12100] flex items-center justify-center bg-[#11101b]/45 px-4 py-8 backdrop-blur-[3px]"
        role="presentation"
        onMouseDown={(event) => {
          if (
            event.target ===
            event.currentTarget
          ) {
            void handleContextMessageDismiss();
          }
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="hoo-context-message-title"
          className={`relative w-full max-w-lg overflow-hidden rounded-[30px] border bg-white ${messageDesign.border} ${messageDesign.shadow} [&_*]:[text-shadow:none] [&_*]:[-webkit-text-stroke:0px]`}
          style={{
            fontFamily:
              '"Pretendard Variable", Pretendard, "Noto Sans KR", "Malgun Gothic", sans-serif',
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={() => {
              void handleContextMessageDismiss();
            }}
            className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/85 text-[#625b70] shadow-sm transition hover:bg-white hover:text-[#302a3d]"
            aria-label="메시지 닫기"
          >
            <X
              size={19}
              strokeWidth={2.2}
            />
          </button>

          <header
            className={`bg-gradient-to-br px-7 pb-7 pt-8 md:px-9 md:pb-8 md:pt-9 ${messageDesign.header}`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] text-3xl text-white shadow-[0_12px_28px_rgba(0,0,0,0.16)] ${messageDesign.iconBackground}`}
                aria-hidden="true"
              >
                {messageDesign.icon}
              </div>

              <div className="min-w-0 pr-9">
                <p
                  className={`text-[10px] font-black tracking-[0.17em] ${messageDesign.labelColor}`}
                >
                  {messageDesign.label}
                </p>

                <h2
                  id="hoo-context-message-title"
                  className={`mt-3 break-keep text-[23px] font-bold leading-[1.35] tracking-[-0.035em] md:text-[26px] ${messageDesign.titleColor}`}
                >
                  {contextMessage.title}
                </h2>
              </div>
            </div>
          </header>

          <div className="px-7 py-7 md:px-9 md:py-8">
            <p
              className={`break-keep text-[16px] font-medium leading-[1.9] tracking-[-0.015em] md:text-[17px] ${messageDesign.contentColor}`}
            >
              {contextMessage.content}
            </p>

            <div className="mt-6 flex items-center gap-2 text-[11px] font-semibold text-[#948c9e]">
              <span>
                {new Date(
                  contextMessage.scheduledFor,
                ).toLocaleTimeString(
                  "ko-KR",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
              </span>

              <span aria-hidden="true">
                ·
              </span>

              <span>
                HOO AI 1.0
              </span>
            </div>

            <div className="mt-7 border-t border-[#ebe7ef] pt-5">
              <p className="text-right text-[12px] font-semibold text-[#8b8494]">
                일상에 필요한 순간만 조용히
                알려드릴게요. — HOO
              </p>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void handleContextMessageDoNotShowAgain();
                  }}
                  className="rounded-2xl border border-[#ddd7e5] bg-white px-5 py-3 text-sm font-semibold text-[#685f72] transition hover:bg-[#f6f3f8]"
                >
                  오늘 다시 보지 않기
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleContextMessageRead();
                  }}
                  className={`rounded-2xl px-7 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition ${messageDesign.button}`}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  })()}



{/* HOO AI 중앙 브리핑 모달 */}

{isBriefingModalOpen &&
  morningBriefing &&
  (() => {
    const isEveningBriefing =
      isHooEveningBriefingTime() &&
      morningBriefing.eveningStatus ===
        "completed" &&
      typeof morningBriefing.eveningContent ===
        "string" &&
      morningBriefing.eveningContent.trim()
        .length > 0;

    const briefingTitle =
      isEveningBriefing
        ? morningBriefing.eveningTitle ??
          "오늘 하루도 수고했어요."
        : morningBriefing.morningTitle;

    const briefingContent =
      isEveningBriefing
        ? morningBriefing.eveningContent ??
          ""
        : morningBriefing.morningContent;

    const briefingGeneratedAt =
      isEveningBriefing
        ? morningBriefing.eveningGeneratedAt
        : morningBriefing.morningGeneratedAt;

    return (
     <div
  className="fixed inset-0 z-[12000] flex items-center justify-center bg-[#080713]/75 p-0 backdrop-blur-[6px] sm:px-4 sm:py-6 md:py-8"       onMouseDown={(event) => {
          if (
            event.target ===
            event.currentTarget
          ) {
            setIsBriefingModalOpen(
              false,
            );
          }
        }}
        role="presentation"
      >
     <section
  role="dialog"
  aria-modal="true"
  aria-labelledby="hoo-briefing-modal-title"
  className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden border-0 border-white/70 bg-[#fbfaff] shadow-[0_35px_120px_rgba(0,0,0,0.55)] [&_*]:[text-shadow:none] [&_*]:[-webkit-text-stroke:0px] sm:h-auto sm:max-h-[92dvh] sm:rounded-[28px] sm:border md:max-h-[88dvh] md:rounded-[32px]"
  style={{
    fontFamily:
      '"Pretendard Variable", Pretendard, "Noto Sans KR", "Malgun Gothic", sans-serif',
  }}
  onMouseDown={(event) =>
    event.stopPropagation()
  }
>
  <button
  type="button"
  onClick={() => {
    setIsBriefingModalOpen(false);
  }}
 className="absolute right-3 top-[calc(12px+var(--hoo-safe-top))] z-20 flex h-11 w-11 items-center justify-center rounded-full border border-[#ded8ef] bg-white text-xl font-medium text-[#625b75] shadow-sm transition active:scale-95 sm:right-5 sm:top-5 md:hover:bg-[#eeeaff] md:hover:text-[#5144b8]"
  aria-label="브리핑 닫기"
>
  ×
</button>

        <header
  className={`shrink-0 px-4 pb-5 pt-[calc(18px+var(--hoo-safe-top))] sm:rounded-t-[28px] sm:px-7 sm:pb-7 sm:pt-8 md:rounded-t-[32px] md:px-10 md:pb-9 md:pt-10 ${
    isEveningBriefing
      ? "bg-gradient-to-br from-[#393359] via-[#4f467f] to-[#665a98] text-white"
      : "bg-gradient-to-br from-[#ede9ff] via-[#f7f5ff] to-white text-[#332d48]"
  }`}
>
            <div className="flex items-center gap-4">
              <div
               className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] text-2xl sm:h-16 sm:w-16 sm:rounded-[22px] sm:text-3xl ${
                  isEveningBriefing
                    ? "bg-white/15 text-white shadow-[0_12px_35px_rgba(0,0,0,0.22)]"
                    : "bg-[#7467d8] text-white shadow-[0_12px_35px_rgba(116,103,216,0.32)]"
                }`}
              >
                {isEveningBriefing
                  ? "☾"
                  : "☀"}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.16em] ${
                      isEveningBriefing
                        ? "bg-white/15 text-white"
                        : "bg-[#7467d8] text-white"
                    }`}
                  >
                    {isEveningBriefing
                      ? "HOO EVENING BRIEFING"
                      : "HOO MORNING BRIEFING"}
                  </span>

                  {briefingGeneratedAt && (
                    <span
                      className={`text-[11px] font-semibold ${
                        isEveningBriefing
                          ? "text-white/70"
                          : "text-[#756e88]"
                      }`}
                    >
                      {new Date(
                        briefingGeneratedAt,
                      ).toLocaleTimeString(
                        "ko-KR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  )}
                </div>

                <h2
                  id="hoo-briefing-modal-title"
                 className="mt-2 break-keep pr-10 text-xl font-bold leading-[1.35] tracking-[-0.03em] sm:mt-3 sm:text-2xl md:text-3xl"
                >
                  {briefingTitle}
                </h2>
              </div>
            </div>
          </header>

         <div
  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(18px+var(--hoo-safe-bottom))] pt-5 sm:px-7 sm:py-8 md:px-10 md:py-10 [&::-webkit-scrollbar]:hidden"
  style={{
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  }}
>
   {(() => {
  /*
   * 저녁 마무리 문장은 본문에서 제거하고
   * 모달 최하단에서 한 번만 표시한다.
   */
  const eveningClosingSentence =
    "오늘의 기록은 내일을 더 잘 이해하는 데 사용할게요.";

  const normalizedBriefingContent =
    isEveningBriefing
      ? briefingContent
          .split(
            eveningClosingSentence,
          )
          .join(" ")
          .replace(
            /\s+/g,
            " ",
          )
          .trim()
      : briefingContent
          .replace(
            /\s+/g,
            " ",
          )
          .trim();

  /*
   * 첫 문장은 TODAY 요약으로 분리한다.
   */
  const firstSentenceMatch =
    normalizedBriefingContent.match(
      /^.*?[.!?](?:\s|$)/,
    );

  const briefingOpening =
    firstSentenceMatch
      ? firstSentenceMatch[0].trim()
      : normalizedBriefingContent;

  const remainingBriefingContent =
    firstSentenceMatch
      ? normalizedBriefingContent
          .slice(
            firstSentenceMatch[0]
              .length,
          )
          .trim()
      : "";

  /*
   * 날씨가 중복 저장된 경우를 대비한다.
   *
   * 첫 번째 "현재 지역" 앞까지만
   * HOO 권고 문단으로 사용하고,
   *
   * 마지막 "현재 지역"부터 끝까지만
   * 가장 최신 날씨 문단으로 사용한다.
   */
  const firstWeatherStartIndex =
    remainingBriefingContent.indexOf(
      "현재 지역",
    );

  const lastWeatherStartIndex =
    remainingBriefingContent.lastIndexOf(
      "현재 지역",
    );

  const briefingAdvice =
    firstWeatherStartIndex >= 0
      ? remainingBriefingContent
          .slice(
            0,
            firstWeatherStartIndex,
          )
          .trim()
      : remainingBriefingContent;

  const briefingWeather =
    lastWeatherStartIndex >= 0
      ? remainingBriefingContent
          .slice(
            lastWeatherStartIndex,
          )
          .trim()
      : "";

  const calendarTodos =
    todos.filter(
      (todo) =>
        todo.source === "hoo" &&
        todo.taskType ===
          "schedule",
    );

  return (
    <div className="space-y-7">
      {/* 오늘 요약 */}

      <section>
        <p className="text-[11px] font-bold tracking-[0.14em] text-[#8c84a2]">
          TODAY
        </p>

        <p className="mt-2 break-keep text-[17px] font-semibold leading-[1.85] tracking-[-0.02em] text-[#393248] md:text-[18px]">
          {briefingOpening}
        </p>
      </section>

      {/* 아침 일정 안내 */}

      {!isEveningBriefing && (
        <section>
          <p className="text-[11px] font-bold tracking-[0.14em] text-[#8c84a2]">
            TODAY&apos;S SCHEDULE
          </p>

          {calendarTodos.length >
          0 ? (
            <ul className="mt-3 space-y-2">
              {calendarTodos.map(
                (todo) => (
                  <li
                    key={todo.id}
                    className="flex items-center gap-3 rounded-2xl border border-[#ddd6f6] bg-[#f5f2ff] px-4 py-3"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7467d8] text-[11px] font-bold text-white">
                      ✓
                    </span>

                    <span className="break-words text-[15px] font-semibold text-[#443d58]">
                      {todo.content}
                    </span>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p className="mt-3 rounded-2xl border border-[#e2ddea] bg-[#f8f7fa] px-4 py-3 text-[14px] font-medium text-[#746d82]">
              오늘 등록된 일정은 없어요.
            </p>
          )}
        </section>
      )}

      {/* HOO 권고 문단 */}

      {briefingAdvice && (
        <section className="rounded-[22px] border border-[#d8d0f5] bg-gradient-to-br from-[#f3f0ff] to-[#faf9ff] px-5 py-5">
          <p className="text-[11px] font-bold tracking-[0.14em] text-[#7467d8]">
            HOO ADVICE
          </p>

          <p className="mt-3 break-keep text-[15px] font-medium leading-[1.9] tracking-[-0.015em] text-[#514a64] md:text-[16px]">
            {briefingAdvice}
          </p>
        </section>
      )}

      {/* 현재 날씨 문단 */}

      {briefingWeather && (
        <section className="rounded-[22px] border border-[#cfd9ef] bg-gradient-to-br from-[#f0f5ff] to-[#fafcff] px-5 py-5">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6e78cc] text-sm text-white"
            >
              {isEveningBriefing
                ? "☾"
                : "☀"}
            </span>

            <p className="text-[11px] font-bold tracking-[0.14em] text-[#6670bd]">
              HOO WEATHER
            </p>
          </div>

          <p className="mt-3 break-keep text-[15px] font-medium leading-[1.9] tracking-[-0.015em] text-[#4e566d] md:text-[16px]">
            {briefingWeather}
          </p>
        </section>
      )}
    </div>
  );
})()}

            {isEveningBriefing ? (
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#b8dfc7] bg-[#eefaf3] p-4 text-center">
                  <p className="text-[11px] font-semibold text-[#5b8069]">
                    완료
                  </p>

                  <p className="mt-1 text-2xl font-bold text-[#397454]">
                    {
                      morningBriefing.completedTodoCount
                    }
                  </p>
                </div>

                <div className="rounded-2xl border border-[#efc8d0] bg-[#fff2f4] p-4 text-center">
                  <p className="text-[11px] font-semibold text-[#9b6872]">
                    미완료
                  </p>

                  <p className="mt-1 text-2xl font-bold text-[#ad5062]">
                    {
                      morningBriefing.incompleteTodoCount
                    }
                  </p>
                </div>

                <div className="rounded-2xl border border-[#c8c0ed] bg-[#f1efff] p-4 text-center">
                  <p className="text-[11px] font-semibold text-[#71689a]">
                    달성률
                  </p>

                  <p className="mt-1 text-2xl font-bold text-[#5548ae]">
                    {Math.round(
                      morningBriefing.completionRate,
                    )}
                    %
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-7 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#b9adf3] bg-[#eeeaff] px-4 py-2 text-[12px] font-bold text-[#5144b8]">
                  오늘의 투두{" "}
                  {todos.length}개
                </span>

                <span className="rounded-full border border-[#d9d4e5] bg-[#f7f6fa] px-4 py-2 text-[12px] font-semibold text-[#625c70]">
                  {
                    morningBriefing.briefingDate
                  }
                </span>
              </div>
            )}

         <div className="sticky bottom-[calc(-18px-var(--hoo-safe-bottom))] z-10 -mx-4 mt-8 border-t border-[#e7e2ef] bg-[#fbfaff]/95 px-4 pb-[calc(18px+var(--hoo-safe-bottom))] pt-4 shadow-[0_-12px_30px_rgba(51,47,69,0.08)] backdrop-blur-xl sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-6 sm:shadow-none sm:backdrop-blur-none">
  <p className="text-right text-[13px] font-semibold text-[#746d88]">
    {isEveningBriefing
      ? "오늘의 기록은 내일을 더 잘 이해하는 데 사용할게요. — HOO"
      : "오늘도 조용히 함께할게요. — HOO"}
  </p>

  <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:flex sm:flex-row sm:justify-end">
    <button
      type="button"
      onClick={() => {
        void handleBriefingRead();
      }}
      className="min-h-12 rounded-2xl border border-[#d8d0e6] bg-white px-3 py-3 text-[13px] font-semibold text-[#625b75] transition active:scale-[0.98] sm:px-5 sm:text-sm md:hover:bg-[#f4f1fa]"
    >
      오늘 다시 보지 않기
    </button>

    <button
      type="button"
      onClick={() => {
        void handleBriefingRead();
      }}
      className="min-h-12 rounded-2xl bg-[#7467d8] px-3 py-3 text-[13px] font-bold text-white shadow-[0_10px_25px_rgba(116,103,216,0.28)] transition active:scale-[0.98] sm:px-6 sm:text-sm md:hover:bg-[#6255c7]"
    >
      브리핑 닫기
       </button>
  </div>
</div>
</div>
</section>
</div>
);
})()}



      {/* 왼쪽 하단 전달사항 */}
<div
  ref={noticeRef}
className="fixed bottom-[calc(16px+var(--hoo-safe-bottom))] left-4 z-[10010] flex items-end gap-3 sm:bottom-6 sm:left-6"
>
 <button
  type="button"
 onClick={() => {
  setIsNoticeOpen((previous) => !previous);

  const latestNotice = notices[0];

  if (latestNotice) {
    localStorage.setItem(
      "lastReadNoticeId",
      String(latestNotice.id),
    );
  }

  setHasUnreadNotice(false);
}}
 className={`relative hidden h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/45 text-3xl text-white shadow-2xl backdrop-blur-xl transition hover:scale-105 hover:bg-black/60 md:flex ${
  hasUnreadNotice && notices.length > 0
    ? "animate-bounce"
    : ""
}`}
  aria-label="전달사항 열기"
>

    📢

{hasUnreadNotice && notices.length > 0 && (
  <span className="absolute -right-1 -top-1 flex h-7 min-w-7 animate-pulse items-center justify-center rounded-full bg-rose-500 px-2 text-sm font-black text-white shadow-lg">
    1
  </span>
)}
  </button>

<div ref={feedbackRef} className="relative">
  <button
    type="button"
    onClick={() =>
      setIsFeedbackOpen((previous) => !previous)
    }
    className="hidden h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/45 text-3xl text-white shadow-2xl backdrop-blur-xl transition hover:scale-105 hover:bg-black/60 md:flex"
    aria-label="피드백 열기"
  >
    💬
  </button>


   {isFeedbackOpen && (
  <div className="fixed left-1/2 top-1/2 z-[10020] max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-white/20 bg-black/80 p-5 text-white shadow-2xl backdrop-blur-2xl">
    <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black">
            피드백 보내기
          </h3>

          <p className="mt-1 text-xs text-white/70">
            궁금한 점, 문의사항, 건의사항을 남겨주세요.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFeedbackOpen(false)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl font-black text-white transition hover:bg-white/20"
          aria-label="피드백 창 닫기"
        >
          ×
        </button>
      </header>

      <textarea
        value={feedbackContent}
        onChange={(event) =>
          setFeedbackContent(event.target.value)
        }
        maxLength={100}
        rows={4}
        placeholder="100자 이하로 입력해주세요."
        className="mt-4 w-full resize-none rounded-2xl border border-white/20 bg-white/10 p-3 text-sm text-white outline-none placeholder:text-white/40"
      />

      <div className="mt-2 flex justify-end text-xs text-white/60">
        {feedbackContent.length}/100
      </div>

      <button
        type="button"
        onClick={submitFeedback}
        className="mt-4 w-full rounded-2xl bg-blue-500 py-3 text-sm font-black text-white transition hover:bg-blue-600"
      >
        보내기
      </button>
    </div>
  )}
</div>

  {isNoticeOpen && (
   <section className="fixed left-1/2 top-1/2 z-[10020] flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-white/20 bg-black/80 text-white shadow-2xl backdrop-blur-2xl">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h3 className="text-xl font-black">
          📢 전달사항
        </h3>

        <button
          type="button"
          onClick={() => setIsNoticeOpen(false)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl font-black transition hover:bg-white/20"
          aria-label="전달사항 닫기"
        >
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isNoticesLoading ? (
          <p className="text-base font-bold text-white/60">
            불러오는 중...
          </p>
        ) : notices.length === 0 ? (
          <p className="text-base font-bold text-white/60">
            등록된 전달사항이 없습니다.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {notices.slice(0, 5).map((notice) => (
                <button
                  key={notice.id}
                  type="button"
                  onClick={() =>
                    setSelectedNotice(notice)
                  }
                  className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                    selectedNotice?.id === notice.id
                      ? "bg-white/20"
                      : "bg-white/10 hover:bg-white/15"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
  <div className="flex items-center gap-2">
    <span className="truncate text-base font-black">
      {notice.title}
    </span>

   {hasUnreadNotice &&
  notice.id === notices[0]?.id && (
    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
      NEW
    </span>
  )}
  </div>
</div>

                    <span className="shrink-0 text-xs font-bold text-white/55">
                      {new Date(
                        notice.created_at,
                      ).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {selectedNotice && (
              <article className="mt-4 rounded-2xl bg-white/10 p-4">
                <h4 className="text-lg font-black">
                  {selectedNotice.title}
                </h4>

                <p className="mt-3 whitespace-pre-wrap break-words text-base font-bold leading-7 text-white/80">
                  {selectedNotice.content}
                </p>
              </article>
            )}
          </>
        )}
      </div>
       </section>
  )}
</div>

{isHooWorldConnected === true && (
  <button
    type="button"
    onClick={() => {
      window.location.href =
        "/hoo-world";
    }}
    className="fixed right-4 top-4 z-[10020] rounded-2xl border border-white/20 bg-black/65 px-4 py-3 text-left text-white shadow-xl backdrop-blur-xl transition hover:bg-black/75 active:scale-[0.98] sm:right-6 sm:top-6"
  >
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          isHooWorldPresenceConnected
            ? "bg-emerald-400"
            : "bg-amber-400"
        }`}
      />

      <div>
        <p className="text-[10px] font-black tracking-[0.16em] text-white/60">
          HOO WORLD
        </p>

        <p className="mt-0.5 text-sm font-bold">
          {isHooWorldPresenceConnected
            ? `온라인 ${hooWorldOnlineCount}명`
            : "접속 중..."}
        </p>
      </div>
    </div>
  </button>
)}



<FocusMode
  isLoggedIn={
    isLoggedIn
  }

  focusAlarmVolume={
    focusAlarmVolume
  }

  showWeather={
    Boolean(
      weatherPreference?.weatherEnabled,
    )
  }

  weatherCode={
    currentWeather?.weatherCode
  }

  temperatureCelsius={
    currentWeather?.temperatureCelsius
  }

  apparentTemperatureCelsius={
    currentWeather?.apparentTemperatureCelsius
  }

  weatherIsDay={
    currentWeather?.isDay
  }

  isWeatherLoading={
    isWeatherLoading
  }

  loggedInNickname={
    loggedInNickname
  }

  onNicknameUpdated={
    setLoggedInNickname
  }

  profileImageUrl={
    profileImageUrl
  }

  onProfileImageUpdated={
    setProfileImageUrl
  }

  floatingButtonsDirection={
    showStickyHeader
      ? floatingButtonsDirection
      : null
  }

  showFloatingButtons={
    !showStickyHeader ||
    showFloatingButtons
  }

  floatingButtonsTarget={
    floatingButtonsTarget
  }

  onFocusRunningChange={(
    isRunning,
  ) => {
    if (
      isHooWorldConnected !== true
    ) {
      return;
    }

    void (async () => {
      /*
       * HOO WORLD에서 포커스모드로 넘어온 경우:
       * 실제 집중 타이머가 시작되는 순간
       * 월드에서 멈춘 위치를 먼저 Presence에 복원한다.
       */
      if (isRunning) {
        const savedPosition =
          window.sessionStorage.getItem(
            "hoo-world-focus-position",
          );

        if (savedPosition) {
          try {
            const parsedPosition:
              unknown =
              JSON.parse(
                savedPosition,
              );

            if (
              parsedPosition &&
              typeof parsedPosition ===
                "object"
            ) {
              const position =
                parsedPosition as {
                  x?: unknown;
                  y?: unknown;
                };

              const x =
                Number(position.x);

              const y =
                Number(position.y);

              if (
                Number.isFinite(x) &&
                Number.isFinite(y)
              ) {
                await updateHooWorldPosition(
                  x,
                  y,
                );
              }
            }
          } catch {
            /*
             * 임시 저장 좌표가 손상된 경우에는
             * 기존 Presence 위치를 그대로 사용한다.
             */
          }
        }
      }

      await updateHooWorldStatus(
        isRunning
          ? "focusing"
          : "idle",
      );

      /*
       * 포커스모드가 종료되거나 중단되면
       * 이번 전환에 사용한 임시 좌표는 정리한다.
       */
      if (!isRunning) {
        window.sessionStorage.removeItem(
          "hoo-world-focus-position",
        );
      }
    })();
  }}
/>



{isLoggedIn &&
  isHooWorldJoinPromptOpen && (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
      <section className="w-full max-w-[430px] rounded-[30px] border border-white/20 bg-[#17171c]/95 p-6 text-white shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#7467d8] text-3xl shadow-[0_12px_35px_rgba(116,103,216,0.4)]">
            🏡
          </div>

          <p className="mt-5 text-[11px] font-black tracking-[0.2em] text-[#a99eff]">
            HOO WORLD
          </p>

          <h2 className="mt-2 text-2xl font-black">
            HOO WORLD에 접속할까요?
          </h2>

          <p className="mt-3 text-sm font-semibold leading-6 text-white/65">
            접속하면 다른 이용자들과 같은 공간에서
            함께 시간을 보낼 수 있어요.
          </p>

          <p className="mt-2 text-sm font-semibold leading-6 text-white/65">
            포커스모드를 시작하면 캐릭터도 자리에 앉아
            함께 집중하기 시작합니다.
          </p>
        </div>

        <div className="mt-7 space-y-2">
          <button
            type="button"
            onClick={handleJoinHooWorld}
            className="min-h-13 w-full rounded-2xl bg-[#7467d8] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#6659c8] active:scale-[0.98]"
          >
            HOO WORLD 접속하기
          </button>

          <button
            type="button"
            onClick={handleSkipHooWorld}
            className="min-h-13 w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
          >
            이번에는 접속하지 않기
          </button>

          <button
            type="button"
            onClick={
              handleDisableHooWorldPrompt
            }
            className="w-full px-4 py-3 text-xs font-semibold text-white/45 transition hover:text-white/75"
          >
            다음부터 묻지 않기
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] leading-5 text-white/35">
          이 설정은 나중에 HOO WORLD에서
          언제든 다시 변경할 수 있습니다.
        </p>
      </section>
    </div>
  )}

<style jsx global>{`

      /*
       * HOO Dark Translucent UI
       * 패널 배경만 어둡게 투명해지고 글자·버튼·윤곽선은 항상 선명합니다.
       */
      .hoo-dark-opacity-scope {
        opacity: 1;
        color: rgba(255, 255, 255, 0.98);
      }

      /* 전체 패널 배경 */
      .hoo-dark-opacity-scope [class~="bg-white/95"],
      .hoo-dark-opacity-scope [class~="bg-white/90"],
      .hoo-dark-opacity-scope [class~="bg-white/88"],
      .hoo-dark-opacity-scope [class~="bg-white/85"],
      .hoo-dark-opacity-scope [class~="bg-white/80"],
      .hoo-dark-opacity-scope [class~="bg-white/75"] {
        background-color: rgba(
          20,
          20,
          22,
          var(--hoo-dark-panel-alpha)
        ) !important;
      }

      /* 카드와 입력 영역 */
      .hoo-dark-opacity-scope [class~="bg-white"],
      .hoo-dark-opacity-scope [class~="bg-white/70"],
      .hoo-dark-opacity-scope [class~="bg-white/60"],
      .hoo-dark-opacity-scope [class~="bg-white/50"],
      .hoo-dark-opacity-scope [class~="bg-[#faf9ff]"],
      .hoo-dark-opacity-scope [class~="bg-[#faf9fd]/60"],
      .hoo-dark-opacity-scope [class~="bg-[#fbfaff]"],
      .hoo-dark-opacity-scope [class~="bg-[#fffefa]"],
      .hoo-dark-opacity-scope [class~="bg-[#f8f6ff]"],
      .hoo-dark-opacity-scope [class~="bg-[#f7f5ff]"],
      .hoo-dark-opacity-scope [class~="bg-[#f5f2ff]"],
      .hoo-dark-opacity-scope [class~="bg-[#f3f0ff]"],
      .hoo-dark-opacity-scope [class~="bg-[#f1eff7]"],
      .hoo-dark-opacity-scope [class~="bg-[#f0edfa]"],
      .hoo-dark-opacity-scope [class~="bg-[#effdf5]"],
      .hoo-dark-opacity-scope [class~="bg-[#f0f7ff]"],
      .hoo-dark-opacity-scope [class~="bg-[#faf9fc]"],
      .hoo-dark-opacity-scope [class~="bg-[#fff8d9]"] {
        background-color: rgba(
          54,
          54,
          58,
          var(--hoo-dark-card-alpha)
        ) !important;
      }

      /* 더 옅은 내부 배경 */
      .hoo-dark-opacity-scope [class*="bg-[#eee"],
      .hoo-dark-opacity-scope [class*="bg-[#eaf"],
      .hoo-dark-opacity-scope [class*="bg-[#f3e"],
      .hoo-dark-opacity-scope [class*="bg-[#fff4"] {
        background-color: rgba(
          74,
          74,
          80,
          var(--hoo-dark-soft-alpha)
        ) !important;
      }

      /* 유리 효과 제거 */
      .hoo-dark-opacity-scope [class*="backdrop-blur"] {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      /* 윤곽선 고정 */
      .hoo-dark-opacity-scope [class*="border-white/"],
      .hoo-dark-opacity-scope [class*="border-[#ded"],
      .hoo-dark-opacity-scope [class*="border-[#d8"],
      .hoo-dark-opacity-scope [class*="border-[#e3"],
      .hoo-dark-opacity-scope [class*="border-[#e5"],
      .hoo-dark-opacity-scope [class*="border-[#ee"],
      .hoo-dark-opacity-scope [class*="border-[#f0"] {
        border-color: rgba(255, 255, 255, 0.34) !important;
      }

      .hoo-dark-opacity-scope [class*="grid-cols-7"] > * {
        border-color: rgba(255, 255, 255, 0.24) !important;
      }

      /* 글자와 숫자는 항상 선명 */
      .hoo-dark-opacity-scope h1,
      .hoo-dark-opacity-scope h2,
      .hoo-dark-opacity-scope h3,
      .hoo-dark-opacity-scope h4,
      .hoo-dark-opacity-scope h5,
      .hoo-dark-opacity-scope h6,
      .hoo-dark-opacity-scope p,
      .hoo-dark-opacity-scope span,
      .hoo-dark-opacity-scope label,
      .hoo-dark-opacity-scope strong,
      .hoo-dark-opacity-scope small,
      .hoo-dark-opacity-scope li,
      .hoo-dark-opacity-scope td,
      .hoo-dark-opacity-scope th,
      .hoo-dark-opacity-scope button,
      .hoo-dark-opacity-scope svg {
        opacity: 1 !important;
      }

      .hoo-dark-opacity-scope [class*="text-[#332f45]"],
      .hoo-dark-opacity-scope [class*="text-[#423c55]"],
      .hoo-dark-opacity-scope [class*="text-[#5145b5]"],
      .hoo-dark-opacity-scope [class*="text-[#6255b5]"],
      .hoo-dark-opacity-scope [class*="text-[#625a68]"],
      .hoo-dark-opacity-scope [class*="text-[#716a82]"],
      .hoo-dark-opacity-scope [class*="text-[#777083]"],
      .hoo-dark-opacity-scope [class*="text-[#8b849d]"],
      .hoo-dark-opacity-scope [class*="text-[#8c849d]"],
      .hoo-dark-opacity-scope [class*="text-[#aaa4b8]"] {
        color: rgba(255, 255, 255, 0.97) !important;
      }

      .hoo-dark-opacity-scope [class*="text-[#8b849d]"],
      .hoo-dark-opacity-scope [class*="text-[#8c849d]"],
      .hoo-dark-opacity-scope [class*="text-[#aaa4b8]"] {
        color: rgba(255, 255, 255, 0.76) !important;
      }

      .hoo-dark-opacity-scope h1,
.hoo-dark-opacity-scope h2,
.hoo-dark-opacity-scope h3,
.hoo-dark-opacity-scope [class*="font-black"],
.hoo-dark-opacity-scope [class*="font-bold"] {
  text-shadow: none !important;
  -webkit-text-stroke: 0 !important;
}

      /* 입력창 */
      .hoo-dark-opacity-scope input,
      .hoo-dark-opacity-scope textarea,
      .hoo-dark-opacity-scope select {
        color: rgba(255, 255, 255, 0.98) !important;
        -webkit-text-fill-color: rgba(255, 255, 255, 0.98);
        border-color: rgba(255, 255, 255, 0.34) !important;
        opacity: 1 !important;
        caret-color: #ffffff;
      }

      .hoo-dark-opacity-scope input::placeholder,
      .hoo-dark-opacity-scope textarea::placeholder {
        color: rgba(255, 255, 255, 0.62) !important;
        -webkit-text-fill-color: rgba(255, 255, 255, 0.62);
        opacity: 1 !important;
      }

      /* 포인트 버튼 유지 */
      .hoo-dark-opacity-scope [class*="bg-[#7467d8]"],
      .hoo-dark-opacity-scope [class*="bg-[#6255c7]"],
      .hoo-dark-opacity-scope [class*="bg-[#5145b5]"],
      .hoo-dark-opacity-scope [class*="bg-[#5967a9]"],
      .hoo-dark-opacity-scope [class*="bg-[#f5a623]"],
      .hoo-dark-opacity-scope [class*="bg-[#f6a62e]"] {
        opacity: 1 !important;
        color: #ffffff !important;
        -webkit-text-fill-color: #ffffff;
      }

      .hoo-dark-opacity-scope button:disabled {
        opacity: 0.55 !important;
      }

      .hoo-dark-opacity-scope :focus-visible {
        outline: 2px solid rgba(116, 103, 216, 0.95);
        outline-offset: 2px;
      }

      /*
       * 미니게임 랭킹 커뮤니티 전용 가독성 강화
       * 패널 투명도는 유지하고 글자·숫자·아이콘만 선명하게 표시합니다.
       */
      .hoo-community-readable,
      .hoo-community-readable * {
        opacity: 1 !important;
      }

     .hoo-community-readable h1,
.hoo-community-readable h2,
.hoo-community-readable h3,
.hoo-community-readable h4,
.hoo-community-readable p,
.hoo-community-readable span,
.hoo-community-readable strong,
.hoo-community-readable small,
.hoo-community-readable label,
.hoo-community-readable li,
.hoo-community-readable button {
  color: rgba(255, 255, 255, 0.98) !important;
  -webkit-text-fill-color: rgba(255, 255, 255, 0.98);
  text-shadow: none !important;
  -webkit-text-stroke: 0 !important;
}
  

      /* 보라색 닉네임, 점수, 레벨과 강조 텍스트는 색 유지 */
      .hoo-community-readable [class*="text-[#7467d8]"],
      .hoo-community-readable [class*="text-[#6255c7]"],
      .hoo-community-readable [class*="text-[#6659bf]"],
      .hoo-community-readable [class*="text-[#5145b5]"],
      .hoo-community-readable [class*="text-purple"],
      .hoo-community-readable [class*="text-violet"] {
        color: #9b8cff !important;
        -webkit-text-fill-color: #9b8cff;
        text-shadow:
          0 1px 2px rgba(0, 0, 0, 0.9),
          0 0 7px rgba(116, 103, 216, 0.28);
      }

      /* 설명과 보조 정보도 너무 흐려지지 않도록 유지 */
      .hoo-community-readable [class*="text-[#8b849d]"],
      .hoo-community-readable [class*="text-[#8c849d]"],
      .hoo-community-readable [class*="text-[#aaa4b8]"],
      .hoo-community-readable [class*="text-white/40"],
      .hoo-community-readable [class*="text-white/50"],
      .hoo-community-readable [class*="text-white/60"],
      .hoo-community-readable [class*="text-white/70"] {
        color: rgba(255, 255, 255, 0.82) !important;
        -webkit-text-fill-color: rgba(255, 255, 255, 0.82);
      }

      /* 랭킹 행 안의 핵심 숫자와 닉네임 */
      .hoo-community-readable [class*="font-black"],
      .hoo-community-readable [class*="font-extrabold"],
      .hoo-community-readable [class*="font-bold"] {
        opacity: 1 !important;
        filter: none !important;
      }

      /* 커뮤니티 내부 SVG와 이모지 */
      .hoo-community-readable svg,
      .hoo-community-readable img {
        opacity: 1 !important;
        filter: none !important;
      }

      /* 비활성 탭만 최소한으로 구분 */
      .hoo-community-readable button:disabled {
        opacity: 0.72 !important;
      }
    `}</style>

  </main>
);
}

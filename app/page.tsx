"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import FocusMode from "@/components/FocusMode/FocusMode";
import HooCommunityPanel from "@/components/HooCommunityPanel";

import BackgroundSettings from "@/components/BackgroundSettings";

import Hoo2048Game from "@/components/Hoo2048Game";
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
  Settings,
  X,
} from "lucide-react";

/* ─────────────────────────────
   타입
───────────────────────────── */


type Schedule = {
  id: string;
  groupId: string;
  title: string;
  content: string;
  date: string;
  repeatType: ScheduleRepeatType;
  createdAt: string;
  isSecret: boolean;
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

type TodoItem = {
  id: string;
  content: string;
  completed: boolean;
  source: "user" | "hoo";
  gameId?: string;
  createdAt: string;
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

type MinigameScreen = "menu" | "sudoku" | "2048";

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

const SCHEDULE_STORAGE_KEY = "hoo-calendar-schedules";
const MEMO_STORAGE_KEY = "hoo-memos";

const UI_OPACITY_STORAGE_KEY =
  "hoo-ui-opacity";

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
  const now = new Date();

  return createDateKey(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
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

function getStickerClass(index: number) {
  const stickerClasses = [
    "bg-[#ffe48c] -rotate-1",
    "bg-[#bdecc8] rotate-1",
    "bg-[#ffc4d8] -rotate-[0.5deg]",
    "bg-[#cbd9ff] rotate-[0.5deg]",
  ];

  return stickerClasses[index % stickerClasses.length];
}

function getScheduleVisual(schedule: Schedule) {
  switch (schedule.repeatType) {
    case "dailyRange":
      return {
        icon: "━",
        label: "연속 일정",
        className:
          "border-[#c8bdf7] bg-[#eee9ff] text-[#5c4fb5]",
      };

    case "weekly":
      return {
        icon: "↻",
        label: "매주 반복",
        className:
          "border-[#b9d8f7] bg-[#eaf5ff] text-[#3473a8]",
      };

    case "monthly":
      return {
        icon: "▣",
        label: "매달 반복",
        className:
          "border-[#d9c3f2] bg-[#f3eaff] text-[#7951a8]",
      };

    default:
      return {
        icon: "",
        label: "하루 일정",
        className:
          "border-[#f0d590] bg-[#fff4c9] text-[#776021]",
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

  const today = useMemo(() => new Date(), []);

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

  /* UI 불투명도 */

  const [isUiOpacityOpen, setIsUiOpacityOpen] =
    useState(false);

  const [uiOpacity, setUiOpacity] =
    useState(100);

  const uiOpacityPanelRef =
    useRef<HTMLDivElement | null>(null);

  const uiOpacityButtonRef =
    useRef<HTMLButtonElement | null>(null);


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

const [scheduleTitle, setScheduleTitle] = useState("");

  const [scheduleContent, setScheduleContent] =
    useState("");

    const [isScheduleSecret, setIsScheduleSecret] =
  useState(false);

const [isSecretLayerOn, setIsSecretLayerOn] =
  useState(false);

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
        console.error(
          "배경 정보 불러오기 실패:",
          error,
        );
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
        console.error(
          "배경 이미지 URL 생성 실패:",
          signedUrlError,
        );
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
        console.error(
          "배경 이미지 로딩에 실패했습니다.",
        );
      };

      backgroundImage.src =
        latestBackgroundUrl;
    } catch (error) {
      console.error(
        "배경 불러오기 실패:",
        error,
      );
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

        if (Number.isFinite(parsedUiOpacity)) {
          setUiOpacity(
            Math.max(
              0,
              Math.min(100, parsedUiOpacity),
            ),
          );
        }
      }

      if (
  savedSecretPin &&
  /^\d{4}$/.test(savedSecretPin)
) {
  setSecretPin(savedSecretPin);
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

  async function loadCloudSchedules() {
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
       * 기존 localStorage 일정을 그대로 사용한다.
       */
      if (!user) {
        return;
      }

      const {
        data: cloudSchedules,
        error: cloudScheduleError,
      } = await supabase
        .from("schedules")
        .select(
          `
            id,
            group_id,
            title,
            content,
            schedule_date,
            repeat_type,
            is_secret,
            created_at
          `,
        )
        .eq("user_id", user.id)
        .order("schedule_date", {
          ascending: true,
        })
        .order("created_at", {
          ascending: true,
        });

      if (cloudScheduleError) {
        throw cloudScheduleError;
      }

      /*
       * 서버에 일정이 있으면
       * 서버 데이터를 최우선으로 사용한다.
       */
      if (
        Array.isArray(cloudSchedules) &&
        cloudSchedules.length > 0
      ) {
        const normalizedSchedules =
          cloudSchedules.reduce<ScheduleMap>(
            (result, schedule) => {
              const date =
                typeof schedule.schedule_date ===
                "string"
                  ? schedule.schedule_date
                  : "";

              if (!date) {
                return result;
              }

              const normalizedSchedule: Schedule = {
                id: schedule.id,

                groupId:
                  typeof schedule.group_id ===
                    "string"
                    ? schedule.group_id
                    : schedule.id,

                title:
                  typeof schedule.title ===
                    "string"
                    ? schedule.title
                    : "제목 없는 일정",

                content:
                  typeof schedule.content ===
                    "string"
                    ? schedule.content
                    : "",

                date,

                repeatType:
                  schedule.repeat_type ===
                    "dailyRange" ||
                  schedule.repeat_type ===
                    "weekly" ||
                  schedule.repeat_type ===
                    "monthly"
                    ? schedule.repeat_type
                    : "none",

                createdAt:
                  schedule.created_at ??
                  new Date().toISOString(),

                isSecret:
                  schedule.is_secret === true,
              };

              result[date] = [
                ...(result[date] ?? []),
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
        JSON.parse(savedSchedules);

      if (
        !parsedValue ||
        typeof parsedValue !== "object" ||
        Array.isArray(parsedValue)
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

      const normalizedSchedules: ScheduleMap =
        {};

      Object.entries(
        localScheduleMap,
      ).forEach(
        ([dateKey, value]) => {
          if (!Array.isArray(value)) {
            return;
          }

          const dateSchedules =
            value.reduce<Schedule[]>(
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
                  scheduleValue as Partial<Schedule>;

                const title =
                  typeof schedule.title ===
                    "string"
                    ? schedule.title.trim()
                    : "";

                if (!title) {
                  return result;
                }

                const normalizedSchedule: Schedule = {
                  id:
                    typeof schedule.id ===
                      "string"
                      ? schedule.id
                      : createId(),

                  groupId:
                    typeof schedule.groupId ===
                      "string"
                      ? schedule.groupId
                      : createId(),

                  title,

                  content:
                    typeof schedule.content ===
                      "string"
                      ? schedule.content
                      : "",

                  date:
                    typeof schedule.date ===
                      "string"
                      ? schedule.date
                      : dateKey,

                  repeatType:
                    schedule.repeatType ===
                      "dailyRange" ||
                    schedule.repeatType ===
                      "weekly" ||
                    schedule.repeatType ===
                      "monthly"
                      ? schedule.repeatType
                      : "none",

                  createdAt:
                    typeof schedule.createdAt ===
                      "string"
                      ? schedule.createdAt
                      : new Date().toISOString(),

                  isSecret:
                    schedule.isSecret === true,
                };

                result.push(
                  normalizedSchedule,
                );

                return result;
              },
              [],
            );

          if (
            dateSchedules.length > 0
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

      if (localSchedules.length === 0) {
        if (!cancelled) {
          setSchedules({});
        }

        return;
      }

      const migrationRows =
        localSchedules.map(
          (schedule) => ({
            id: schedule.id,
            user_id: user.id,
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
            is_secret:
              schedule.isSecret,
            created_at:
              schedule.createdAt,
            updated_at:
              schedule.createdAt,
          }),
        );

      const { error: migrationError } =
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
        setIsScheduleCloudReady(true);
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
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

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
   UI 불투명도 자동 저장
───────────────────────────── */

useEffect(() => {
  if (!isLoaded) {
    return;
  }

  window.localStorage.setItem(
    UI_OPACITY_STORAGE_KEY,
    String(uiOpacity),
  );
}, [uiOpacity, isLoaded]);


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
   투두리스트 클라우드 불러오기
   기존 localStorage 기록 자동 이전
───────────────────────────── */

useEffect(() => {
  let cancelled = false;

  async function loadCloudTodos() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      /*
       * 로그인하지 않은 사용자는
       * 기존 localStorage 투두를 그대로 사용한다.
       */
      if (!user) {
        if (!cancelled) {
          setIsTodoCloudReady(true);
        }

        return;
      }

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
            game_id,
            sort_order,
            created_at
          `,
        )
        .eq("user_id", user.id)
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
       * 서버에 투두가 있다면
       * 서버 데이터를 최우선으로 사용한다.
       */
      if (
        Array.isArray(cloudTodos) &&
        cloudTodos.length > 0
      ) {
        const normalizedTodos: TodoItem[] =
          cloudTodos.map((todo) => ({
            id: todo.id,
            content: todo.content,
            completed: todo.completed,
            source:
              todo.source === "hoo"
                ? "hoo"
                : "user",
            gameId:
              typeof todo.game_id === "string"
                ? todo.game_id
                : undefined,
            createdAt:
              todo.created_at ??
              new Date().toISOString(),
          }));

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
       * 서버에 기록이 없으면
       * 현재 브라우저의 기존 투두를 서버로 이전한다.
       */
      const savedTodos =
        window.localStorage.getItem(
          TODO_STORAGE_KEY,
        );

      if (!savedTodos) {
        if (!cancelled) {
          setTodos([]);
        }

        return;
      }

      const parsedValue: unknown =
        JSON.parse(savedTodos);

      if (!Array.isArray(parsedValue)) {
        if (!cancelled) {
          setTodos([]);
        }

        return;
      }

     const localTodos =
  parsedValue.reduce<TodoItem[]>(
    (result, value, index) => {
      if (
        !value ||
        typeof value !== "object"
      ) {
        return result;
      }

      const todo =
        value as Partial<TodoItem>;

      const content =
        typeof todo.content === "string"
          ? todo.content.trim()
          : "";

      if (!content) {
        return result;
      }

      const normalizedTodo: TodoItem = {
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

        gameId:
          typeof todo.gameId === "string"
            ? todo.gameId
            : undefined,

        createdAt:
          typeof todo.createdAt === "string"
            ? todo.createdAt
            : new Date(
                Date.now() + index,
              ).toISOString(),
      };

      result.push(normalizedTodo);

      return result;
    },
    [],
  );


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
          game_id: todo.gameId ?? null,
          sort_order: index,
          created_at: todo.createdAt,
          updated_at: new Date().toISOString(),
        }));

      const { error: migrationError } =
        await supabase
          .from("todos")
          .insert(migrationRows);

      if (migrationError) {
        throw migrationError;
      }

      if (!cancelled) {
        setTodos(localTodos);

        console.log(
          `${localTodos.length}개의 기존 투두를 서버로 이전했습니다.`,
        );
      }
    } catch (error) {
      console.error(
        "투두리스트 클라우드 불러오기 실패:",
        error,
      );

      /*
       * 서버 연결이 실패해도
       * 기존 localStorage 투두는 유지한다.
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

  const title = scheduleTitle.trim();
  const content = scheduleContent.trim();

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
      isSecret:
        isScheduleSecret,
    };

    /*
     * 화면에 먼저 수정 내용을 반영한다.
     */
    setSchedules(
      (previousSchedules) => {
        const nextSchedules: ScheduleMap =
          {};

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

      const { error: updateError } =
        await supabase
          .from("schedules")
          .update({
            title:
              updatedSchedule.title,

            content:
              updatedSchedule.content,

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
          const nextSchedules: ScheduleMap =
            {};

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

  const groupId = createId();

  const createdAt =
    new Date().toISOString();

  const newSchedules =
    scheduleDates.map(
      (date): Schedule => ({
        id: createId(),

        groupId,

        title,

        content,

        date,

        repeatType:
          activeRepeatType,

        createdAt,

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

          is_secret:
            schedule.isSecret,

          created_at:
            schedule.createdAt,

          updated_at:
            schedule.createdAt,
        }),
      );

    const { error: insertError } =
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
        const nextSchedules: ScheduleMap =
          {};

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

  const newTodo: TodoItem = {
    id: createId(),
    content,
    completed: false,
    source: "user",
    createdAt: new Date().toISOString(),
  };

  /*
   * 화면에는 즉시 추가한다.
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
     * 비로그인 사용자는 localStorage만 사용한다.
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
          game_id: newTodo.gameId ?? null,
          sort_order: todos.length,
          created_at: newTodo.createdAt,
          updated_at: newTodo.createdAt,
        });

    if (insertError) {
      throw insertError;
    }
  } catch (error) {
    console.error(
      "투두 추가 서버 저장 실패:",
      error,
    );

    /*
     * 서버 저장에 실패하면
     * 화면에서도 추가 내용을 되돌린다.
     */
    setTodos((previousTodos) =>
      previousTodos.filter(
        (todo) => todo.id !== newTodo.id,
      ),
    );

    window.alert(
      "투두를 서버에 저장하지 못했습니다.",
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

return (
  <main
    className="relative min-h-screen overflow-x-hidden bg-[#102f24] text-[#332f45]"
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
    <BackgroundSettings
      onUpload={handleBackgroundUpload}
      onReset={handleBackgroundReset}
    />

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
        setScheduleContent(event.target.value)
      }
      placeholder="일정 내용을 입력하세요."
      rows={4}
      className="w-full resize-none rounded-2xl border border-[#ded8ef] bg-[#faf9ff] px-5 py-3 text-sm font-bold leading-6 outline-none transition focus:border-[#7467d8]"
    />
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
      ? "left-3 w-[300px] translate-x-0"
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
    className={`flex overflow-hidden rounded-full bg-white transition-all duration-300 ${
      isSearchBarCollapsed
        ? "pointer-events-none w-0 opacity-0"
        : "min-w-0 flex-1 opacity-100"
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
    aria-label="UI 불투명도 설정"
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
      </header>

      {isUiOpacityOpen && (
        <div
          ref={uiOpacityPanelRef}
          className="fixed right-[5.2%] top-[74px] z-[10020] w-[190px] rounded-[26px] border border-[#8f7cff]/80 bg-[#111522]/95 px-5 pb-6 pt-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.5),0_0_28px_rgba(116,103,216,0.25)] backdrop-blur-2xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black tracking-[0.18em] text-white/45">
                UI APPEARANCE
              </p>

              <h2 className="mt-1 text-base font-black">
                UI 불투명도
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                setIsUiOpacityOpen(false)
              }
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/75 transition hover:bg-white/15 hover:text-white"
              aria-label="UI 불투명도 패널 닫기"
            >
              <X
                size={17}
                strokeWidth={2.5}
              />
            </button>
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
        </div>
      )}

      {/* 첫 화면 */}
      <section className="relative z-10 flex min-h-screen items-start justify-center px-5 pt-20 text-white">
        <div className="relative flex w-full max-w-3xl flex-col items-center">
          <h1 className="text-7xl font-black tracking-[-0.08em] drop-shadow-[0_7px_20px_rgba(0,0,0,0.7)] md:text-8xl">
            HOO
          </h1>

          <p className="mt-2 text-3xl font-black tracking-[0.08em] drop-shadow-[0_5px_15px_rgba(0,0,0,0.75)] md:text-4xl">
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
            className="mt-7 flex w-full max-w-md overflow-hidden rounded-full border border-white/45 bg-white/90 p-1.5 shadow-[0_16px_45px_rgba(0,0,0,0.34)] backdrop-blur-xl"
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
              className="shrink-0 rounded-full bg-[#5967a9] px-5 py-2.5 text-sm font-black text-white transition hover:scale-[1.03] hover:bg-[#475795]"
            >
              검색
            </button>
          </form>

          {/* 즐겨찾기 8칸 */}
          <div className="mt-7 grid w-full max-w-xl grid-cols-4 gap-3">
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
                    className="flex h-20 w-full flex-col items-center justify-center rounded-2xl border border-white/35 bg-white/[0.04] px-2 text-center text-white shadow-[0_8px_26px_rgba(0,0,0,0.12)] backdrop-blur-[2px] transition duration-300 hover:-translate-y-1 hover:border-white/75 hover:bg-white/[0.13]"
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
                      <>
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/40 text-2xl font-light text-white/60 transition-all duration-300 group-hover:scale-110 group-hover:border-white group-hover:text-white">
                           +
                        </span>

                      </>
                    )}
                  </button>

                  {isConfigured && (
                    <div className="absolute -right-2 -top-2 z-20 flex gap-1 opacity-0 transition group-hover:opacity-100">
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

          <div className="mt-7 flex flex-col items-center gap-2 text-xs font-black tracking-[0.18em] text-white/75">
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

<section className="flex h-screen w-screen shrink-0 items-center overflow-hidden px-4 py-16 md:px-7">
  <div className="mx-auto w-full max-w-[1380px]">
    <section className="grid min-h-[630px] overflow-hidden rounded-[34px] border border-white/55 bg-white/90 shadow-[0_30px_100px_rgba(5,35,26,0.4)] backdrop-blur-xl xl:grid-cols-[1.3fr_0.7fr]">
      <article className="border-b border-[#dedaf0] p-6 md:p-8 xl:border-b-0 xl:border-r">
        <header>
          <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
            HOO TO DO
          </p>

          <h2 className="mt-1 text-3xl font-black text-[#332f45]">
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
            className="shrink-0 rounded-2xl bg-[#7467d8] px-6 py-3 text-sm font-black text-white transition hover:bg-[#6255c7]"
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

          todos.map((todo, index) => (
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
          : "border-[#cfc9df] bg-white text-transparent"
      }`}
      aria-label={`${todo.content} 완료 상태 변경`}
    >
      ✓
    </button>

    <div className="min-w-0 flex-1">
      <p
        className={`break-words text-sm font-black ${
          todo.completed
            ? "text-[#aaa4b8] line-through"
            : "text-[#423c55]"
        }`}
      >
        {index + 1}.{" "}
        {todo.content}
      </p>
    </div>

    <button
      type="button"
      onClick={() =>
        deleteTodo(todo.id)
      }
      className="shrink-0 rounded-full bg-[#ffe2e8] px-3 py-1.5 text-xs font-black text-[#d94f6b]"
    >
      삭제
    </button>
  </article>
))
            
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
           <section className="flex h-screen w-screen shrink-0 items-center overflow-hidden px-4 py-16 md:px-7">
              <div className="mx-auto w-full max-w-[1380px]">
                <section className="grid overflow-hidden rounded-[34px] border border-white/55 bg-white/88 shadow-[0_30px_100px_rgba(5,35,26,0.4)] backdrop-blur-xl xl:grid-cols-[1.15fr_0.85fr]">
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

                  <aside className="flex min-h-[600px] flex-col bg-[#fbfaff]">
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

           <section className="flex h-screen w-screen shrink-0 items-center overflow-hidden px-4 py-16 md:px-7">
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

                              <p className="mt-3 whitespace-pre-wrap break-words text-sm font-bold leading-7 text-[#ECECEC]">
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
<section className="flex h-screen w-screen shrink-0 items-center overflow-hidden px-4 py-16 md:px-7">
  <div className="mx-auto w-full max-w-[1380px]">
    {minigameScreen === "menu" && (
      <section className="grid h-[625px] items-stretch gap-7 xl:grid-cols-[1.35fr_0.65fr]">


        {/* 왼쪽: 게임 선택 */}
     <article className="h-full rounded-[34px] border border-white/55 bg-white/90 p-6 shadow-[0_30px_100px_rgba(5,35,26,0.4)] backdrop-blur-xl md:p-8">
          <header>
            <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
              HOO MINI GAME
            </p>

            <h2 className="mt-1 text-3xl font-black text-[#332f45]">
              게임 선택
            </h2>

            <p className="mt-2 text-sm font-bold text-[#8b849d]">
              원하는 게임과 난이도를 선택해 플레이하세요.
            </p>
          </header>

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            {/* 스도쿠 카드 */}
            <article className="rounded-[28px] border border-[#ded8ef] bg-[#faf9ff] p-6 shadow-sm">
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

              <div className="mt-6 grid grid-cols-3 gap-2">
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

              <div className="mt-6 space-y-3 rounded-2xl bg-white p-4">
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
                  setMinigameScreen("sudoku");
                }}
                className="mt-6 w-full rounded-2xl bg-[#7467d8] py-3.5 text-sm font-black text-white transition hover:scale-[1.02] hover:bg-[#6255c7]"
              >
                스도쿠 플레이
              </button>
            </article>

           {/* 2048 카드 */}

<article
  className={`rounded-[28px] p-6 shadow-sm transition-all duration-300 ${
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

    setMinigameScreen("2048");
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
          </div>
        </article>

      <div className="h-full">
        
  <div className="hoo-community-readable">
<HooCommunityPanel
    refreshKey={communityRefreshKey}
  />
</div>
</div>

              <p className="mt-1 text-2xl font-black text-[#332f45]">
                -위
              </p>
      </section>
    )}

    {minigameScreen === "2048" && (
      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-[34px] border border-white/55 bg-white/90 p-6 shadow-[0_30px_100px_rgba(5,35,26,0.4)] backdrop-blur-xl md:p-8">
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
              onClick={() => setMinigameScreen("menu")}
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
  onBackToMenu={() => {
    setMinigameScreen("menu");
  }}
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

    {minigameScreen === "sudoku" && (
      <section className="rounded-[34px] border border-white/55 bg-white/90 p-8 shadow-[0_30px_100px_rgba(5,35,26,0.4)] backdrop-blur-xl">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
              HOO MINI GAME
            </p>

            <h2 className="mt-1 text-3xl font-black text-[#332f45]">
              스도쿠
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsSudokuRunning(false);
              setMinigameScreen("menu");
            }}
            className="rounded-full bg-[#eeeafd] px-5 py-2.5 text-sm font-black text-[#665e82] transition hover:bg-[#ddd7fa]"
          >
            ← 게임 선택
          </button>
        </header>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
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
      </section>
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


      {/* 왼쪽 하단 전달사항 */}
<div
  ref={noticeRef}
className="fixed bottom-6 left-6 z-[9980] flex items-end gap-3"
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
 className={`relative flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/45 text-3xl text-white shadow-2xl backdrop-blur-xl transition hover:scale-105 hover:bg-black/60 ${
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
    className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/45 text-3xl text-white shadow-2xl backdrop-blur-xl transition hover:scale-105 hover:bg-black/60"
    aria-label="피드백 열기"
  >
    💬
  </button>

  {isFeedbackOpen && (
    <div className="absolute bottom-20 left-0 z-[9990] w-[340px] rounded-3xl border border-white/20 bg-black/60 p-5 text-white shadow-2xl backdrop-blur-xl">
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
    <section className="absolute bottom-20 left-0 w-[400px] overflow-hidden rounded-3xl border border-white/20 bg-black/55 text-white shadow-2xl backdrop-blur-2xl">
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

      <div className="max-h-[460px] overflow-y-auto p-4">
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
<FocusMode
  floatingButtonsDirection={
    showStickyHeader
      ? floatingButtonsDirection
      : null
  }
  showFloatingButtons={
    !showStickyHeader || showFloatingButtons
  }
  floatingButtonsTarget={floatingButtonsTarget}
/>

  




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
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
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
        text-shadow:
          0 1px 2px rgba(0, 0, 0, 0.88),
          0 0 5px rgba(0, 0, 0, 0.32);
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
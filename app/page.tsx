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
import {
  createPuzzleId,
  submitSudokuCompletion,
} from "@/lib/community";

/* ─────────────────────────────
   타입
───────────────────────────── */

type Schedule = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

type ScheduleMap = Record<string, Schedule[]>;

type Memo = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
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

type SudokuDifficulty = "easy" | "normal" | "hard";
type SudokuBoard = number[][];
type SudokuCell = { row: number; column: number };

/* ─────────────────────────────
   기본값
───────────────────────────── */

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const SCHEDULE_STORAGE_KEY = "hoo-calendar-schedules";
const MEMO_STORAGE_KEY = "hoo-memos";
const FAVORITE_STORAGE_KEY = "hoo-favorites";

/* ─────────────────────────────
   공통 함수
───────────────────────────── */

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
  
  const today = useMemo(() => new Date(), []);

  /* 가로 스크롤 */

  const horizontalSectionRef =
    useRef<HTMLElement | null>(null);

  const [horizontalProgress, setHorizontalProgress] =
    useState(0);

  const [horizontalPage, setHorizontalPage] =
    useState<0 | 1 | 2>(0);

  const isHorizontalAnimatingRef = useRef(false);
  const [showStickyHeader, setShowStickyHeader] =
    useState(false);

  /* 즐겨찾기 */

  const [favorites, setFavorites] = useState<Favorite[]>(
    createDefaultFavorites,
  );

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

  const [selectedScheduleId, setSelectedScheduleId] =
    useState<string | null>(null);

  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleContent, setScheduleContent] =
    useState("");

  /* 메모 */

  const [memos, setMemos] = useState<Memo[]>([]);
  const [memoTitle, setMemoTitle] = useState("");

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

  /* 스도쿠 */

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
      setShowStickyHeader(window.scrollY > 420);
    }

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
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

      if (event.deltaY < 0 && horizontalPage > 0) {
        const previousPage = (horizontalPage - 1) as
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

      if (event.deltaY < 0 && horizontalPage === 0) {
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

      const savedFavorites = window.localStorage.getItem(
        FAVORITE_STORAGE_KEY,
      );

      if (savedSchedules) {
        setSchedules(JSON.parse(savedSchedules));
      }

      if (savedMemos) {
        setMemos(JSON.parse(savedMemos));
      }

      if (savedFavorites) {
        setFavorites(
          normalizeFavorites(JSON.parse(savedFavorites)),
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
     일정 자동 저장
  ───────────────────────────── */

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    window.localStorage.setItem(
      SCHEDULE_STORAGE_KEY,
      JSON.stringify(schedules),
    );
  }, [schedules, isLoaded]);

  /* ─────────────────────────────
     메모 자동 저장
  ───────────────────────────── */

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    window.localStorage.setItem(
      MEMO_STORAGE_KEY,
      JSON.stringify(memos),
    );
  }, [memos, isLoaded]);
/* ─────────────────────────────
   Focus Mode 메모 실시간 동기화
───────────────────────────── */

useEffect(() => {
  function handleFocusMemoUpdate(event: Event) {
    const customEvent = event as CustomEvent<Memo[]>;

    if (Array.isArray(customEvent.detail)) {
      setMemos(customEvent.detail);
      return;
    }

    try {
      const savedMemos = window.localStorage.getItem(
        MEMO_STORAGE_KEY,
      );

      setMemos(
        savedMemos
          ? JSON.parse(savedMemos)
          : [],
      );
    } catch (error) {
      console.error(
        "집중 메모를 동기화하지 못했어요.",
        error,
      );
    }
  }

  window.addEventListener(
    "hoo-memos-updated",
    handleFocusMemoUpdate,
  );

  return () => {
    window.removeEventListener(
      "hoo-memos-updated",
      handleFocusMemoUpdate,
    );
  };
}, []);
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
     스도쿠 완료 기록 저장
  ───────────────────────────── */

  useEffect(() => {
    if (!isSudokuCompleted || !sudokuPuzzleId) {
      return;
    }
submittedSudokuIdRef.current = sudokuPuzzleId;

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

  const selectedSchedules =
    schedules[selectedDate] ?? [];

  const selectedSchedule =
    selectedSchedules.find(
      (schedule) =>
        schedule.id === selectedScheduleId,
    ) ?? null;

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

  function addSchedule(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const title = scheduleTitle.trim();
    const content = scheduleContent.trim();

    if (!title) {
      return;
    }

    const newSchedule: Schedule = {
      id: createId(),
      title,
      content,
      createdAt: new Date().toISOString(),
    };

    setSchedules((previousSchedules) => ({
      ...previousSchedules,
      [selectedDate]: [
        ...(previousSchedules[selectedDate] ?? []),
        newSchedule,
      ],
    }));

    setSelectedScheduleId(newSchedule.id);
    setScheduleTitle("");
    setScheduleContent("");
  }

  function deleteSchedule(scheduleId: string) {
    setSchedules((previousSchedules) => {
      const remainingSchedules = (
        previousSchedules[selectedDate] ?? []
      ).filter(
        (schedule) => schedule.id !== scheduleId,
      );

      const nextSchedules = {
        ...previousSchedules,
      };

      if (remainingSchedules.length === 0) {
        delete nextSchedules[selectedDate];
      } else {
        nextSchedules[selectedDate] =
          remainingSchedules;
      }

      return nextSchedules;
    });
  }

  /* ─────────────────────────────
     메모 저장·수정·삭제
  ───────────────────────────── */

  function saveMemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = memoTitle.trim();
    const content = memoContent.trim();

    if (!title && !content) {
      return;
    }

    if (editingMemoId) {
      setMemos((previousMemos) =>
        previousMemos.map((memo) =>
          memo.id === editingMemoId
            ? {
                ...memo,
                title: title || "제목 없는 메모",
                content,
                updatedAt: new Date().toISOString(),
              }
            : memo,
        ),
      );
    } else {
      const newMemo: Memo = {
        id: createId(),
        title: title || "제목 없는 메모",
        content,
        updatedAt: new Date().toISOString(),
      };

      setMemos((previousMemos) => [
        newMemo,
        ...previousMemos,
      ]);
    }

    cancelMemoEditing();
  }

  function startMemoEditing(memo: Memo) {
    setEditingMemoId(memo.id);
    setMemoTitle(memo.title);
    setMemoContent(memo.content);
  }

  function cancelMemoEditing() {
    setEditingMemoId(null);
    setMemoTitle("");
    setMemoContent("");
  }

  function deleteMemo(memoId: string) {
    setMemos((previousMemos) =>
      previousMemos.filter((memo) => memo.id !== memoId),
    );

    if (editingMemoId === memoId) {
      cancelMemoEditing();
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

function moveHorizontalPage(nextPage: 0 | 1 | 2) {
  if (isHorizontalAnimatingRef.current) {
    return;
  }

  const section = horizontalSectionRef.current;

  if (section) {
    window.scrollTo({
      top: section.offsetTop,
      behavior: "auto",
    });
  }

  isHorizontalAnimatingRef.current = true;
  setHorizontalPage(nextPage);
  setHorizontalProgress(nextPage);

  window.setTimeout(() => {
    isHorizontalAnimatingRef.current = false;
  }, 750);
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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ?? "피드백을 전송하지 못했습니다.",
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
  /* ─────────────────────────────
     화면
  ───────────────────────────── */

  return (
    <main
      className="relative min-h-screen overflow-x-hidden bg-[#102f24] text-[#332f45]"
      style={{
        fontFamily:
          '"Arial Rounded MT Bold", "Trebuchet MS", "Malgun Gothic", sans-serif',
      }}
    >
      {/* 고정 배경 */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#102f24]"
      >
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url("/hoo-bg.png")',
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
        <div className="mx-auto mt-3 flex w-[95%] max-w-7xl items-center gap-4 rounded-2xl border border-white/20 bg-slate-900/80 px-5 py-3 shadow-2xl backdrop-blur-xl">
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

          <form
            action="https://www.google.com/search"
            method="GET"
            target="_blank"
            className="flex flex-1 overflow-hidden rounded-full bg-white"
          >
            <input
              type="search"
              name="q"
              placeholder="Google 검색"
              className="flex-1 px-5 py-2 text-black outline-none"
            />

            <button
              type="submit"
              className="bg-blue-600 px-6 text-white transition hover:bg-blue-700"
            >
              검색
            </button>
          </form>

          <button
            type="button"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              })
            }
            className="rounded-full bg-white/20 px-4 py-2 text-white transition hover:bg-white/30"
          >
            ↑
          </button>
        </div>
      </header>

      {/* 첫 화면 */}
      <section className="relative z-10 flex min-h-screen items-start justify-center px-5 pt-20 text-white">
        <div className="flex w-full max-w-3xl flex-col items-center">
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
           className="flex h-full w-[300vw] transition-transform duration-700 ease-in-out will-change-transform"
            style={{
              transform: `translate3d(-${
                horizontalProgress * 100
              }vw, 0, 0)`,
            }}
          >
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

                        const dateSchedules =
                          schedules[dateKey] ?? [];

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
                                .map(
                                  (
                                    schedule,
                                    scheduleIndex,
                                  ) => (
                                    <div
                                      key={schedule.id}
                                      className={`truncate rounded-md px-1.5 py-1 text-[9px] font-black text-[#423d53] shadow-sm ${getStickerClass(
                                        scheduleIndex,
                                      )}`}
                                    >
                                      {schedule.title}
                                    </div>
                                  ),
                                )}

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
                          일정 내용
                        </h3>

                        {selectedSchedule && (
                          <button
                            type="button"
                            onClick={() =>
                              deleteSchedule(
                                selectedSchedule.id,
                              )
                            }
                            className="rounded-full bg-[#ffe2e8] px-4 py-2 text-xs font-black text-[#d94f6b] transition hover:bg-[#ffcbd6]"
                          >
                            삭제
                          </button>
                        )}
                      </div>

                      {selectedSchedule ? (
                        <article className="mt-3 rounded-3xl bg-white p-5 shadow-sm">
                          <h4 className="text-xl font-black">
                            {selectedSchedule.title}
                          </h4>

                          <p className="mt-3 whitespace-pre-wrap break-words text-sm font-bold leading-7 text-[#777083]">
                            {selectedSchedule.content ||
                              "상세 내용이 작성되지 않았어요."}
                          </p>
                        </article>
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
                        새 일정 만들기
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
                        className="mt-3 w-full rounded-2xl border border-[#ded8ef] bg-white px-4 py-2.5 text-sm font-bold outline-none focus:border-[#7467d8]"
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
                        className="mt-2 w-full resize-none rounded-2xl border border-[#ded8ef] bg-white px-4 py-3 text-sm font-bold leading-6 outline-none focus:border-[#7467d8]"
                      />

                      <button
                        type="submit"
                        className="mt-3 w-full rounded-2xl bg-[#7467d8] py-3 text-sm font-black text-white transition hover:scale-[1.01] hover:bg-[#6255c7]"
                      >
                        일정 저장
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
                  <header className="border-b border-[#e5e1ef] px-6 py-5">
                    <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
                      HOO MEMO
                    </p>

                    <h2 className="mt-1 text-2xl font-black">
                      메모장
                    </h2>
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
                          {memos.length}개
                        </span>
                      </div>

                      {memos.length === 0 ? (
                        <div className="mt-4 flex min-h-80 items-center justify-center rounded-3xl border-2 border-dashed border-[#e5dfc6] text-sm font-bold text-[#aaa18a]">
                          저장된 메모가 없어요.
                        </div>
                      ) : (
                        <div className="mt-4 max-h-[440px] space-y-3 overflow-y-auto pr-2">
                          {memos.map((memo, index) => (
                            <article
                              key={memo.id}
                              className={`rounded-3xl p-4 shadow-sm ${getStickerClass(
                                index,
                              )}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <h4 className="min-w-0 flex-1 break-words text-base font-black text-[#453e3b]">
                                  {memo.title}
                                </h4>

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

                              <p className="mt-3 whitespace-pre-wrap break-words text-sm font-bold leading-6 text-[#625a58]">
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

            {/* 세 번째 패널: 스도쿠 */}

            <section className="flex h-screen w-screen shrink-0 items-center overflow-hidden px-4 py-16 md:px-7">
              <div className="mx-auto grid w-full max-w-[1500px] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <article className="rounded-[34px] border border-white/55 bg-white/90 p-6 shadow-[0_30px_100px_rgba(5,35,26,0.4)] backdrop-blur-xl md:p-8">
                  <header className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-black tracking-[0.18em] text-[#928ba8]">
                        HOO MINI GAME
                      </p>
                      <h2 className="mt-1 text-3xl font-black text-[#332f45]">
                        스도쿠
                      </h2>
                    </div>

                    {sudokuBoard.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                        <span className="rounded-full bg-[#eeeafd] px-4 py-2 text-[#6659bf]">
                          {getSudokuDifficultyLabel(sudokuDifficulty)}
                        </span>
                        <span className="rounded-full bg-[#e6f6ed] px-4 py-2 text-[#39775a]">
                          {formatSudokuTime(sudokuSeconds)}
                        </span>
                        <span className="rounded-full bg-[#fff0c7] px-4 py-2 text-[#987019]">
                          힌트 {sudokuHintCount}
                        </span>
                      </div>
                    )}
                  </header>

                  {sudokuBoard.length === 0 ? (
                    <div className="mt-6 flex min-h-[500px] flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-[#d9d4eb] bg-[#faf9ff] px-5 text-center">
                      <p className="text-6xl">🧩</p>
                      <p className="mt-5 text-xl font-black text-[#554e6b]">
                        난이도를 선택해 게임을 시작하세요
                      </p>
                      <div className="mt-7 flex flex-wrap justify-center gap-3">
                        {(["easy", "normal", "hard"] as SudokuDifficulty[]).map(
                          (difficulty) => (
                            <button
                              key={difficulty}
                              type="button"
                              onClick={() => startSudokuGame(difficulty)}
                              className="rounded-2xl bg-[#7467d8] px-7 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#6255c7]"
                            >
                              {getSudokuDifficultyLabel(difficulty)}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 grid items-center gap-7 lg:grid-cols-[minmax(0,620px)_1fr]">
                      <div>
                        <div className="mx-auto grid aspect-square w-full max-w-[620px] grid-cols-9 overflow-hidden rounded-2xl border-[3px] border-[#4f4964] bg-white">
                          {sudokuBoard.map((row, rowIndex) =>
                            row.map((value, columnIndex) => {
                              const fixed = sudokuPuzzle[rowIndex][columnIndex] !== 0;
                              const selected =
                                selectedSudokuCell?.row === rowIndex &&
                                selectedSudokuCell?.column === columnIndex;
                              const related =
                                selectedSudokuCell !== null &&
                                (selectedSudokuCell.row === rowIndex ||
                                  selectedSudokuCell.column === columnIndex ||
                                  (Math.floor(selectedSudokuCell.row / 3) ===
                                    Math.floor(rowIndex / 3) &&
                                    Math.floor(selectedSudokuCell.column / 3) ===
                                      Math.floor(columnIndex / 3)));
                              const incorrect =
                                value !== 0 &&
                                value !== sudokuSolution[rowIndex][columnIndex];

                              return (
                                <button
                                  key={`${rowIndex}-${columnIndex}`}
                                  type="button"
                                  onClick={() =>
                                    setSelectedSudokuCell({
                                      row: rowIndex,
                                      column: columnIndex,
                                    })
                                  }
                                  className={`relative flex items-center justify-center border-[#cfc9dc] text-lg font-black transition md:text-2xl ${
                                    columnIndex % 3 === 2 && columnIndex !== 8
                                      ? "border-r-[3px] border-r-[#6a637e]"
                                      : "border-r"
                                  } ${
                                    rowIndex % 3 === 2 && rowIndex !== 8
                                      ? "border-b-[3px] border-b-[#6a637e]"
                                      : "border-b"
                                  } ${
                                    selected
                                      ? "bg-[#7467d8] text-white"
                                      : related
                                        ? "bg-[#f0edff]"
                                        : "bg-white"
                                  } ${
                                    fixed
                                      ? "text-[#332f45]"
                                      : incorrect
                                        ? "text-[#e05370]"
                                        : "text-[#6659bf]"
                                  }`}
                                  aria-label={`${rowIndex + 1}행 ${columnIndex + 1}열`}
                                >
                                  {value || ""}
                                </button>
                              );
                            }),
                          )}
                        </div>
                      </div>

                      <div className="max-h-[calc(100vh-170px)] space-y-4 overflow-y-auto pr-1">
                        <aside className="rounded-[28px] bg-[#f7f5ff] p-5">
                        {isSudokuCompleted ? (
                          <div className="rounded-2xl bg-[#e5f7eb] px-4 py-5 text-center">
                            <p className="text-3xl">✨</p>
                            <p className="mt-2 text-xl font-black text-[#39775a]">
                              완성했습니다!
                            </p>
                            <p className="mt-1 text-sm font-bold text-[#609071]">
                              기록 {formatSudokuTime(sudokuSeconds)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-center text-sm font-black text-[#756e8b]">
                            빈칸을 선택한 뒤 숫자를 눌러주세요.
                          </p>
                        )}

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          {SUDOKU_NUMBERS.map((number) => (
                            <button
                              key={number}
                              type="button"
                              onClick={() => selectSudokuNumber(number)}
                              className="rounded-2xl bg-white py-4 text-xl font-black text-[#5d538f] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#eeeafd]"
                            >
                              {number}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => selectSudokuNumber(0)}
                          className="mt-2 w-full rounded-2xl bg-white py-3 text-sm font-black text-[#827a96] transition hover:bg-[#eeeafd]"
                        >
                          선택한 숫자 지우기
                        </button>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={useSudokuHint}
                            disabled={sudokuHintCount <= 0 || isSudokuCompleted}
                            className="rounded-2xl bg-[#e3b936] py-3 text-sm font-black text-white transition hover:bg-[#cfaa2f] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            힌트
                          </button>
                          <button
                            type="button"
                            onClick={() => startSudokuGame(sudokuDifficulty)}
                            className="rounded-2xl bg-[#7467d8] py-3 text-sm font-black text-white transition hover:bg-[#6255c7]"
                          >
                            새 게임
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {(["easy", "normal", "hard"] as SudokuDifficulty[]).map(
                            (difficulty) => (
                              <button
                                key={difficulty}
                                type="button"
                                onClick={() => startSudokuGame(difficulty)}
                                className={`rounded-xl py-2 text-xs font-black transition ${
                                  sudokuDifficulty === difficulty
                                    ? "bg-[#51479a] text-white"
                                    : "bg-white text-[#6f6785] hover:bg-[#eeeafd]"
                                }`}
                              >
                                {getSudokuDifficultyLabel(difficulty)}
                              </button>
                            ),
                          )}
                        </div>
                        </aside>

                        {(isSudokuCompleted || sudokuSaveMessage) && (
                          <div
                            className={`rounded-2xl px-4 py-3 text-center text-xs font-black ${
                              isSudokuSaving
                                ? "bg-[#eeeafd] text-[#6659bf]"
                                : sudokuSaveMessage.includes("저장됐어요")
                                  ? "bg-[#e5f7eb] text-[#39775a]"
                                  : "bg-[#fff8dc] text-[#8a6a20]"
                            }`}
                          >
                            {sudokuSaveMessage}
                          </div>
                        )}

                        <HooCommunityPanel
                          refreshKey={communityRefreshKey}
                        />
                      </div>
                    </div>
                                  )}
                </article>

                <div className="min-h-0">
                  <HooCommunityPanel />
                </div>
              </div>
            </section>

          </div>
          

          {/* 가로 화면 이동 화살표 */}
          {horizontalPage > 0 && (
            <button
              type="button"
              onClick={() =>
                moveHorizontalPage(
                  (horizontalPage - 1) as 0 | 1 | 2,
                )
              }
              className="group absolute left-3 top-1/2 z-50 flex h-28 w-16 -translate-y-1/2 items-center justify-center rounded-r-3xl bg-black/0 transition hover:bg-black/15 focus:outline-none md:left-6"
              aria-label={
                horizontalPage === 2
                  ? "메모와 타이머 화면으로 이동"
                  : "캘린더 화면으로 이동"
              }
            >
              <span className="h-0 w-0 border-y-[15px] border-r-[23px] border-y-transparent border-r-white/55 drop-shadow-[0_3px_8px_rgba(0,0,0,0.55)] transition duration-300 group-hover:-translate-x-1 group-hover:border-r-white/95" />
            </button>
          )}

          {horizontalPage < 2 && (
            <button
              type="button"
              onClick={() =>
                moveHorizontalPage(
                  (horizontalPage + 1) as 0 | 1 | 2,
                )
              }
              className="group absolute right-3 top-1/2 z-50 flex h-28 w-16 -translate-y-1/2 items-center justify-center rounded-l-3xl bg-black/0 transition hover:bg-black/15 focus:outline-none md:right-6"
              aria-label={
                horizontalPage === 0
                  ? "메모와 타이머 화면으로 이동"
                  : "스도쿠 화면으로 이동"
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
 <FocusMode />
    </main>
  );
}
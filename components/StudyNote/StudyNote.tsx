"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "hoo-study-notes-v1";
const DELETED_CATEGORY_STORAGE_KEY = "hoo-study-note-deleted-categories-v1";
const CUSTOM_CATEGORY_STORAGE_KEY = "hoo-study-note-custom-categories-v1";
const STUDY_DB_NAME = "hoo-study-note-db";
const STUDY_DB_VERSION = 2;
const STUDY_NOTE_STORE = "notes";
const STUDY_TOMBSTONE_STORE = "tombstones";
const PAGE_LINE_LIMIT = 29;
const ROW_HEIGHT = 28;

const HIGHLIGHT_COLOR = "rgba(255, 224, 92, 0.38)";

const FONT_SIZE_OPTIONS = [
  14,
  16,
  18,
  20,
  22,
  24,
  28,
  30,
  32,
  34,
  36,
  40,
] as const;

const FONT_COLOR_OPTIONS = [
  "#111827",
  "#374151",
  "#6B7280",
  "#FFFFFF",
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#EAB308",
  "#84CC16",
  "#22C55E",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
  "#0EA5E9",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
] as const;
const DEFAULT_CATEGORIES = ["스터디", "오답노트"];
const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

type ImageSize = "small" | "medium" | "large";

type StudyTextBlock = {
  id: string;
  type: "text";
  html: string;
  units: number;
  brace: boolean;
  annotation?: {
    quote: string;
    text: string;
    anchorPercent?: number;
  };
};

type StudyImageBlock = {
  id: string;
  type: "image";
  src: string;
  alt: string;
  size: ImageSize;
  units: number;
  widthPercent?: number;
  aspectRatio?: number;
  layout?: "block" | "float-right" | "free";
  positionXPercent?: number;
  positionYPx?: number;
  pageAnchorIndex?: number;
  storagePath?: string;
};

type StudyBlock = StudyTextBlock | StudyImageBlock;

type StudyNoteRecord = {
  id: string;
  date: string;
  title: string;
  category: string;
  blocks: StudyBlock[];
  lastPageHtml: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

type StudyNoteTombstone = {
  id: string;
  deletedAt: string;
};

type StudyContentSearchResult = {
  id: string;
  noteId: string;
  noteTitle: string;
  category: string;
  date: string;
  source: "body" | "annotation" | "lastPage";
  blockId: string | null;
  pageIndex: number | null;
  lineNumber: number | null;
  matchStart: number;
  matchText: string;
  excerpt: string;
  locationLabel: string;
};

type RemoteStudyNoteRow = {
  id: string;
  user_id: string;
  note_date: string;
  title: string;
  category: string;
  blocks: Array<Record<string, unknown>>;
  version: number;
  client_updated_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type StudyNoteProps = {
  active: boolean;
};

type DeleteDragTarget =
  | {
      kind: "note";
      id: string;
      label: string;
    }
  | {
      kind: "category";
      category: string;
      label: string;
    }
  | {
      kind: "date";
      date: string;
      label: string;
    }
  | {
      kind: "image";
      noteId: string;
      blockId: string;
      label: string;
    };

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function stripHtml(value: string) {
  if (typeof document === "undefined") {
    return value
      .replace(/<[^>]*>/g, " ")
      .replace(/\u200B/g, "");
  }

  const element = document.createElement("div");
  element.innerHTML = value;

  return (
    element.textContent ?? ""
  ).replace(/\u200B/g, "");
}


function openStudyNoteDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(STUDY_DB_NAME, STUDY_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STUDY_NOTE_STORE)) {
        const store = database.createObjectStore(STUDY_NOTE_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("category", "category", { unique: false });
      }

      if (!database.objectStoreNames.contains(STUDY_TOMBSTONE_STORE)) {
        database.createObjectStore(STUDY_TOMBSTONE_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB를 열 수 없습니다."));
  });
}

async function loadNotesFromIndexedDb() {
  const database = await openStudyNoteDb();

  try {
    return await new Promise<StudyNoteRecord[]>((resolve, reject) => {
      const transaction = database.transaction(STUDY_NOTE_STORE, "readonly");
      const request = transaction.objectStore(STUDY_NOTE_STORE).getAll();

      request.onsuccess = () => {
        const records = Array.isArray(request.result)
          ? (request.result as StudyNoteRecord[])
          : [];

        resolve(
          records
            .map((record) => ({
              ...record,
              lastPageHtml:
                typeof record.lastPageHtml === "string"
                  ? record.lastPageHtml
                  : "",
              version: Number(record.version) || 1,
            }))
            .sort((first, second) =>
              second.updatedAt.localeCompare(first.updatedAt),
            ),
        );
      };
      request.onerror = () => reject(request.error ?? new Error("IndexedDB 기록을 읽을 수 없습니다."));
    });
  } finally {
    database.close();
  }
}

async function replaceNotesInIndexedDb(notes: StudyNoteRecord[]) {
  const database = await openStudyNoteDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STUDY_NOTE_STORE, "readwrite");
      const store = transaction.objectStore(STUDY_NOTE_STORE);

      store.clear();
      notes.forEach((note) => store.put(note));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB 기록을 저장할 수 없습니다."));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB 저장이 중단되었습니다."));
    });
  } finally {
    database.close();
  }
}


async function loadStudyNoteTombstones() {
  const database = await openStudyNoteDb();

  try {
    return await new Promise<StudyNoteTombstone[]>((resolve, reject) => {
      const transaction = database.transaction(STUDY_TOMBSTONE_STORE, "readonly");
      const request = transaction.objectStore(STUDY_TOMBSTONE_STORE).getAll();

      request.onsuccess = () => {
        resolve(
          Array.isArray(request.result)
            ? (request.result as StudyNoteTombstone[])
            : [],
        );
      };
      request.onerror = () =>
        reject(request.error ?? new Error("삭제 대기 기록을 읽을 수 없습니다."));
    });
  } finally {
    database.close();
  }
}

async function replaceStudyNoteTombstones(tombstones: StudyNoteTombstone[]) {
  const database = await openStudyNoteDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STUDY_TOMBSTONE_STORE, "readwrite");
      const store = transaction.objectStore(STUDY_TOMBSTONE_STORE);

      store.clear();
      tombstones.forEach((item) => store.put(item));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("삭제 대기 기록을 저장할 수 없습니다."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("삭제 대기 저장이 중단되었습니다."));
    });
  } finally {
    database.close();
  }
}

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? "image/jpeg";
  const binary = window.atob(encoded ?? "");
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function migrateLocalStorageNotesToIndexedDb() {
  const savedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!savedValue) {
    return [] as StudyNoteRecord[];
  }

  try {
    const parsedValue = JSON.parse(savedValue) as StudyNoteRecord[];
    if (!Array.isArray(parsedValue) || parsedValue.length === 0) {
      return [] as StudyNoteRecord[];
    }

    const normalizedValue = parsedValue.map((note) => ({
      ...note,
      lastPageHtml:
        typeof note.lastPageHtml === "string"
          ? note.lastPageHtml
          : "",
      version: Number(note.version) || 1,
    }));

    await replaceNotesInIndexedDb(normalizedValue);
    window.localStorage.removeItem(STORAGE_KEY);
    return normalizedValue;
  } catch (error) {
    console.error("기존 HOO터디 노트 기록 마이그레이션 실패:", error);
    return [] as StudyNoteRecord[];
  }
}

function createTextBlock(): StudyTextBlock {
  return {
    id: createId(),
    type: "text",
    html: "",
    units: 1,
    brace: false,
  };
}

function createEmptyNote(category = DEFAULT_CATEGORIES[0]): StudyNoteRecord {
  const now = new Date().toISOString();

  return {
    id: createId(),
    date: getLocalDateValue(),
    title: "새로운 기록",
    category,
    blocks: [createTextBlock()],
    lastPageHtml: "",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function getBlockUnits(block: StudyBlock) {
  if (block.type === "image") {
    return block.units;
  }

  return Math.min(
    PAGE_LINE_LIMIT,
    Math.max(1, block.units) + (block.annotation ? 1 : 0),
  );
}

function paginateBlocks(blocks: StudyBlock[]) {
  const pages: StudyBlock[][] = [];
  const freeImages: Array<{
    block: StudyImageBlock;
    pageIndex: number;
  }> = [];

  let page: StudyBlock[] = [];
  let usedUnits = 0;

  blocks.forEach((block) => {
    const blockUnits = Math.min(
      PAGE_LINE_LIMIT,
      Math.max(1, getBlockUnits(block)),
    );

    const isFloatingImage =
      block.type === "image" &&
      block.layout === "float-right";

    const isFreeImage =
      block.type === "image" &&
      block.layout === "free";

    /*
     * 자유 배치 사진은 텍스트 pagination에서 완전히 분리한다.
     * pageAnchorIndex가 있으면 그 페이지에 계속 고정되고,
     * 기존 저장 데이터처럼 anchor가 아직 없으면 현재 흐름상
     * 위치한 페이지 번호를 임시로 사용한다.
     */
    if (isFreeImage) {
      freeImages.push({
        block,
        pageIndex:
          Number.isFinite(
            block.pageAnchorIndex,
          )
            ? Math.max(
                0,
                Math.floor(
                  block.pageAnchorIndex ??
                    0,
                ),
              )
            : pages.length,
      });
      return;
    }

    /*
     * 오른쪽 여백 배치 사진은 기존처럼 텍스트 줄을 소비하지 않는다.
     */
    if (isFloatingImage) {
      if (
        page.length > 0 &&
        usedUnits + blockUnits >
          PAGE_LINE_LIMIT
      ) {
        pages.push(page);
        page = [block];
        usedUnits = 0;
        return;
      }

      page.push(block);
      return;
    }

    if (
      block.type === "image" &&
      page.length > 0 &&
      usedUnits + blockUnits >
        PAGE_LINE_LIMIT
    ) {
      pages.push(page);
      page = [block];
      usedUnits = blockUnits;
      return;
    }

    if (
      page.length > 0 &&
      usedUnits + blockUnits >
        PAGE_LINE_LIMIT
    ) {
      pages.push(page);
      page = [];
      usedUnits = 0;
    }

    page.push(block);
    usedUnits += blockUnits;
  });

  if (page.length > 0) {
    pages.push(page);
  }

  if (pages.length === 0) {
    pages.push([createTextBlock()]);
  }

  /*
   * 텍스트 페이지 구성이 끝난 뒤 자유 배치 사진을
   * 지정된 페이지에 얹는다.
   * 이후 마지막 줄에서 글자가 늘어나 텍스트가 다음 페이지로
   * 재배치되어도 사진의 페이지는 바뀌지 않는다.
   */
  freeImages.forEach(
    ({ block, pageIndex }) => {
      while (
        pages.length <= pageIndex
      ) {
        pages.push([]);
      }

      pages[pageIndex].push(block);
    },
  );

  return pages;
}

async function getImageAspectRatio(src: string) {
  return new Promise<number>((resolve) => {
    const image = new Image();

    image.onload = () => {
      const width = Math.max(1, image.naturalWidth || image.width);
      const height = Math.max(1, image.naturalHeight || image.height);
      resolve(width / height);
    };

    image.onerror = () => resolve(1);
    image.src = src;
  });
}

async function compressImage(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = dataUrl;
  });

  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function StudyNote({ active }: StudyNoteProps) {
  const supabase = useMemo(() => createClient(), []);
  const [notes, setNotes] = useState<StudyNoteRecord[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [saveLabel, setSaveLabel] = useState("자동 저장");
  const [viewMode, setViewMode] = useState<"home" | "category" | "editor">("home");
  const [toolTab, setToolTab] = useState<"text" | "page">("text");
  const [isEditorToolbarCollapsed, setIsEditorToolbarCollapsed] =
    useState(false);
  const [editorPageZoom, setEditorPageZoom] =
    useState(1);
  const editorViewportRef =
    useRef<HTMLElement | null>(null);
  const editorPageCanvasRef =
    useRef<HTMLDivElement | null>(null);
  const [editorPageCanvasHeight, setEditorPageCanvasHeight] =
    useState(0);
  const [editorMaxPageZoom, setEditorMaxPageZoom] =
    useState(1);
  const [isBoldFormatActive, setIsBoldFormatActive] =
    useState(false);
  const [isItalicFormatActive, setIsItalicFormatActive] =
    useState(false);
  const [isUnderlineFormatActive, setIsUnderlineFormatActive] =
    useState(false);
  const [isUnderlineColorPaletteOpen, setIsUnderlineColorPaletteOpen] =
    useState(false);
  const [activeUnderlineColor, setActiveUnderlineColor] =
    useState("currentColor");
  const [isStrikeFormatActive, setIsStrikeFormatActive] =
    useState(false);
  const [isStrikeColorPaletteOpen, setIsStrikeColorPaletteOpen] =
    useState(false);
  const [activeStrikeColor, setActiveStrikeColor] =
    useState("currentColor");
  const [isHighlightFormatActive, setIsHighlightFormatActive] =
    useState(false);
  const [isFontColorPaletteOpen, setIsFontColorPaletteOpen] =
    useState(false);
  const [activeFontColor, setActiveFontColor] =
    useState("#FFFFFF");
  const [isFontSizeMenuOpen, setIsFontSizeMenuOpen] =
    useState(false);
  const [activeFontSize, setActiveFontSize] =
    useState(14);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [tombstones, setTombstones] = useState<StudyNoteTombstone[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [draggingDeleteTarget, setDraggingDeleteTarget] =
    useState<DeleteDragTarget | null>(null);
  const [selectedImageDeleteTarget, setSelectedImageDeleteTarget] =
    useState<Extract<DeleteDragTarget, { kind: "image" }> | null>(null);
  const [resizingImageTarget, setResizingImageTarget] =
    useState<{ noteId: string; blockId: string } | null>(null);
  const [isTrashDragOver, setIsTrashDragOver] = useState(false);
  const [isNoteNameOpen, setIsNoteNameOpen] = useState(false);
  const [noteNameDraft, setNoteNameDraft] = useState("");
  const [pendingNoteCategory, setPendingNoteCategory] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authMode, setAuthMode] =
    useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authNickname, setAuthNickname] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const lastPageEditableRef = useRef<HTMLDivElement | null>(null);
  const trashBinRef = useRef<HTMLButtonElement | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const selectedBlockIdsRef = useRef<string[]>([]);
  const lastSelectedTextBlockIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const syncInProgressRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const notesRef = useRef<StudyNoteRecord[]>([]);
  const activeFontSizeRef = useRef(14);
  const typingFontSizeRef = useRef(14);
  const undoHistoryRef = useRef<
    Map<string, StudyNoteRecord[]>
  >(new Map());

  useEffect(() => {
    let isCancelled = false;

    async function hydrateStudyNote() {
      try {
        const savedTheme = window.localStorage.getItem("hoo-study-note-theme");
        if (savedTheme === "dark" || savedTheme === "light") {
          setIsDarkMode(savedTheme === "dark");
        } else {
          setIsDarkMode(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
        }

        const savedHiddenCategories = window.localStorage.getItem(
          DELETED_CATEGORY_STORAGE_KEY,
        );

        if (savedHiddenCategories) {
          try {
            const parsedHiddenCategories = JSON.parse(
              savedHiddenCategories,
            );

            if (Array.isArray(parsedHiddenCategories)) {
              setHiddenCategories(
                parsedHiddenCategories.filter(
                  (value): value is string =>
                    typeof value === "string" &&
                    value.trim().length > 0,
                ),
              );
            }
          } catch (error) {
            console.warn(
              "삭제된 카테고리 목록 불러오기 실패:",
              error,
            );
          }
        }

        const savedCustomCategories =
          window.localStorage.getItem(
            CUSTOM_CATEGORY_STORAGE_KEY,
          );

        if (savedCustomCategories) {
          try {
            const parsedCustomCategories =
              JSON.parse(savedCustomCategories);

            if (Array.isArray(parsedCustomCategories)) {
              setCustomCategories(
                parsedCustomCategories.filter(
                  (value): value is string =>
                    typeof value === "string" &&
                    value.trim().length > 0,
                ),
              );
            }
          } catch (error) {
            console.warn(
              "사용자 카테고리 목록 불러오기 실패:",
              error,
            );
          }
        }

        let savedNotes = await loadNotesFromIndexedDb();
        const savedTombstones = await loadStudyNoteTombstones();

        if (savedNotes.length === 0) {
          savedNotes = await migrateLocalStorageNotesToIndexedDb();
        }

        if (isCancelled) {
          return;
        }

        setNotes(savedNotes);
        setTombstones(savedTombstones);
        setSelectedNoteId(savedNotes[0]?.id ?? null);
      } catch (error) {
        console.error("HOO터디 노트 IndexedDB 불러오기 실패:", error);

        if (!isCancelled) {
          setNotes([]);
          setSelectedNoteId(null);
        }
      } finally {
        if (!isCancelled) {
          setIsHydrated(true);
        }
      }
    }

    void hydrateStudyNote();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    setSaveLabel("저장 중...");

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void replaceNotesInIndexedDb(notes)
        .then(() => {
          setSaveLabel(navigator.onLine ? "로컬 저장됨" : "오프라인 저장됨");

          if (navigator.onLine) {
            if (syncTimerRef.current !== null) {
              window.clearTimeout(syncTimerRef.current);
            }

            syncTimerRef.current = window.setTimeout(() => {
              void syncStudyNotes(notesRef.current);
            }, 900);
          }
        })
        .catch((error) => {
          console.error("HOO터디 노트 IndexedDB 저장 실패:", error);
          setSaveLabel("저장 실패");
        });
    }, 350);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [isHydrated, notes]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    window.localStorage.setItem(
      "hoo-study-note-theme",
      isDarkMode ? "dark" : "light",
    );
  }, [isDarkMode, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(
      DELETED_CATEGORY_STORAGE_KEY,
      JSON.stringify(hiddenCategories),
    );
  }, [hiddenCategories, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(
      CUSTOM_CATEGORY_STORAGE_KEY,
      JSON.stringify(customCategories),
    );
  }, [customCategories, isHydrated]);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("HOO터디 노트 로그인 상태 확인 실패:", error);
        setSignedInEmail(null);
        return;
      }
      setSignedInEmail(data.session?.user?.email ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setSignedInEmail(session?.user?.email ?? null);
      if (session?.user && navigator.onLine) {
        window.setTimeout(() => { void syncStudyNotes(); }, 0);
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleStudyNoteLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSigningIn) {
      return;
    }

    const email = authEmail.trim().toLowerCase();

    if (!email) {
      setAuthMessage("이메일을 입력해 주세요.");
      return;
    }

    if (authPassword.length < 6) {
      setAuthMessage("비밀번호는 6자 이상 입력해 주세요.");
      return;
    }

    setIsSigningIn(true);
    setAuthMessage(
      authMode === "signup"
        ? "HOO 계정을 만드는 중..."
        : "로그인 중...",
    );

    try {
      if (authMode === "signup") {
        const nickname =
          authNickname.trim();

        if (!nickname) {
          setAuthMessage("닉네임을 입력해 주세요.");
          return;
        }

        /*
         * HOO 본사이트와 동일한 Supabase Auth 프로젝트를 사용한다.
         * 따라서 여기에서 만든 계정은 HOO 사이트에서도
         * 그대로 로그인할 수 있는 동일 HOO 계정이다.
         */
        const { data, error } =
          await supabase.auth.signUp({
            email,
            password: authPassword,
            options: {
              data: {
                nickname,
              },
              emailRedirectTo:
                `${window.location.origin}/study-note`,
            },
          });

        if (error) {
          setAuthMessage(error.message);
          return;
        }

        if (!data.session) {
          setAuthMessage(
            "가입 확인 메일을 보냈습니다. 메일 인증 후 같은 계정으로 HOO 사이트와 HOO터디 노트에 로그인할 수 있어요.",
          );
          setAuthMode("login");
          setAuthPassword("");
          return;
        }

        setSignedInEmail(
          data.user?.email ?? email,
        );
        setAuthMessage(
          "HOO 계정 생성 완료 · 노트 동기화를 시작합니다.",
        );
        setAuthPassword("");
        setIsLoginOpen(false);

        if (navigator.onLine) {
          window.setTimeout(() => {
            void syncStudyNotes();
          }, 0);
        }

        return;
      }

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password: authPassword,
        });

      if (error || !data.user) {
        setAuthMessage(
          error?.message ??
            "로그인하지 못했어요.",
        );
        return;
      }

      setSignedInEmail(
        data.user.email ?? email,
      );
      setAuthPassword("");
      setAuthMessage(
        "로그인 완료 · 동기화를 시작합니다.",
      );
      setIsLoginOpen(false);

      if (navigator.onLine) {
        window.setTimeout(() => {
          void syncStudyNotes();
        }, 0);
      }
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleStudyNoteLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      window.alert("로그아웃하지 못했어요. 다시 시도해 주세요.");
      return;
    }
    setSignedInEmail(null);
    setAuthPassword("");
    setAuthMessage("");
  }

  useEffect(() => {
    if (!active) {
      return;
    }

    const clampEditorPageZoom = (
      value: number,
    ) => {
      const maximumZoom =
        Math.min(
          2.2,
          Math.max(
            0.7,
            editorMaxPageZoom,
          ),
        );

      return Math.min(
        maximumZoom,
        Math.max(
          0.7,
          Math.round(value * 10) / 10,
        ),
      );
    };

    const changeEditorPageZoom = (
      delta: number,
    ) => {
      if (viewMode !== "editor") {
        return;
      }

      setEditorPageZoom(
        (previous) =>
          clampEditorPageZoom(
            previous + delta,
          ),
      );
    };

    function handleZoomWheel(
      event: WheelEvent,
    ) {
      if (
        !event.ctrlKey &&
        !event.metaKey
      ) {
        return;
      }

      /*
       * 브라우저 전체 확대는 막고,
       * 페이지 + 마지막 페이지가 에디터 화면 안에 들어가는 범위까지만
       * 노트 캔버스를 확대한다.
       */
      event.preventDefault();

      if (viewMode !== "editor") {
        return;
      }

      changeEditorPageZoom(
        event.deltaY < 0
          ? 0.1
          : -0.1,
      );
    }

    function handleZoomKeyDown(
      event: globalThis.KeyboardEvent,
    ) {
      if (
        !event.ctrlKey &&
        !event.metaKey
      ) {
        return;
      }

      const key =
        event.key.toLowerCase();

      const isZoomIn =
        key === "+" ||
        key === "=";

      const isZoomOut =
        key === "-";

      const isZoomReset =
        key === "0";

      if (
        !isZoomIn &&
        !isZoomOut &&
        !isZoomReset
      ) {
        return;
      }

      event.preventDefault();

      if (viewMode !== "editor") {
        return;
      }

      if (isZoomReset) {
        setEditorPageZoom(
          clampEditorPageZoom(1),
        );
        return;
      }

      changeEditorPageZoom(
        isZoomIn
          ? 0.1
          : -0.1,
      );
    }

    window.addEventListener(
      "wheel",
      handleZoomWheel,
      {
        passive: false,
      },
    );

    window.addEventListener(
      "keydown",
      handleZoomKeyDown,
    );

    return () => {
      window.removeEventListener(
        "wheel",
        handleZoomWheel,
      );

      window.removeEventListener(
        "keydown",
        handleZoomKeyDown,
      );
    };
  }, [
    active,
    viewMode,
    editorMaxPageZoom,
  ]);

  useEffect(() => {
    if (
      !active ||
      viewMode !== "editor"
    ) {
      return;
    }

    const viewport =
      editorViewportRef.current;

    const canvas =
      editorPageCanvasRef.current;

    if (
      !viewport ||
      !canvas
    ) {
      return;
    }

    const measureCanvas = () => {
      setEditorPageCanvasHeight(
        canvas.offsetHeight,
      );

      const viewportStyle =
        window.getComputedStyle(
          viewport,
        );

      const paddingLeft =
        Number.parseFloat(
          viewportStyle.paddingLeft,
        ) || 0;

      const paddingRight =
        Number.parseFloat(
          viewportStyle.paddingRight,
        ) || 0;

      /*
       * 8px의 안전 여백을 남겨 마지막 픽셀에서 가로 스크롤이
       * 생기는 것도 막는다.
       */
      const availableWidth =
        Math.max(
          1,
          viewport.clientWidth -
            paddingLeft -
            paddingRight -
            8,
        );

      /*
       * transform은 offsetWidth를 바꾸지 않으므로
       * canvas.offsetWidth는 항상 100% 기준의 논리 페이지 폭이다.
       * 이 폭과 현재 화면의 실제 사용 가능 폭을 비교해
       * "밀림이 시작되기 직전" 배율을 계산한다.
       */
      const canvasWidth =
        Math.max(
          1,
          canvas.offsetWidth,
        );

      const fitZoom =
        Math.min(
          2.2,
          Math.max(
            0.7,
            Math.floor(
              (
                availableWidth /
                canvasWidth
              ) * 100,
            ) / 100,
          ),
        );

      setEditorMaxPageZoom(
        fitZoom,
      );

      /*
       * 브라우저 창을 줄여 현재 배율이 새 최대치를 넘게 되면
       * 즉시 화면 안에 들어오는 크기로 복귀시킨다.
       */
      setEditorPageZoom(
        (previous) =>
          Math.min(
            previous,
            fitZoom,
          ),
      );
    };

    measureCanvas();

    const observer =
      new ResizeObserver(
        measureCanvas,
      );

    observer.observe(
      viewport,
    );

    observer.observe(
      canvas,
    );

    window.addEventListener(
      "resize",
      measureCanvas,
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "resize",
        measureCanvas,
      );
    };
  }, [
    active,
    viewMode,
    selectedNoteId,
  ]);

  useEffect(() => {
    function handleFindShortcut(event: globalThis.KeyboardEvent) {
      if (!active || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "f") {
        return;
      }

      event.preventDefault();
      setIsSearchOpen(true);
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }

    window.addEventListener("keydown", handleFindShortcut);
    return () => window.removeEventListener("keydown", handleFindShortcut);
  }, [active]);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  useEffect(() => {
    const editable = lastPageEditableRef.current;

    if (!editable || viewMode !== "editor") {
      return;
    }

    /*
     * 마지막 페이지 입력 중에는 React 상태 갱신 때문에 DOM의 innerHTML을
     * 다시 덮어쓰지 않는다. 포커스가 빠졌거나 다른 노트를 열었을 때만
     * 저장된 lastPageHtml을 DOM에 반영한다.
     */
    if (document.activeElement === editable) {
      return;
    }

    const savedHtml = selectedNote?.lastPageHtml ?? "";

    if (editable.innerHTML !== savedHtml) {
      editable.innerHTML = savedHtml;
    }
  }, [
    selectedNote?.id,
    selectedNote?.lastPageHtml,
    viewMode,
  ]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_CATEGORIES,
          ...customCategories,
          ...notes.map((note) => note.category).filter(Boolean),
        ]),
      ).filter(
        (category) =>
          !hiddenCategories.includes(category),
      ),
    [customCategories, hiddenCategories, notes],
  );

  const visibleNotes = useMemo(
    () =>
      [...notes]
        .filter(
          (note) =>
            categoryFilter === "전체" ||
            note.category === categoryFilter,
        )
        .sort((first, second) =>
          second.updatedAt.localeCompare(
            first.updatedAt,
          ),
        ),
    [categoryFilter, notes],
  );

  const contentSearchResults =
    useMemo<StudyContentSearchResult[]>(() => {
      const rawQuery =
        searchQuery.trim();

      const normalizedQuery =
        rawQuery.toLowerCase();

      if (!normalizedQuery) {
        return [];
      }

      const results:
        StudyContentSearchResult[] = [];

      const pushMatches = ({
        note,
        source,
        blockId,
        pageIndex,
        lineNumber,
        sourceText,
        locationLabel,
      }: {
        note: StudyNoteRecord;
        source:
          | "body"
          | "annotation"
          | "lastPage";
        blockId: string | null;
        pageIndex: number | null;
        lineNumber: number | null;
        sourceText: string;
        locationLabel: string;
      }) => {
        const normalizedSource =
          sourceText.toLowerCase();

        let searchFrom = 0;
        let occurrence = 0;

        while (searchFrom <= normalizedSource.length) {
          const matchStart =
            normalizedSource.indexOf(
              normalizedQuery,
              searchFrom,
            );

          if (matchStart < 0) {
            break;
          }

          const matchEnd =
            matchStart + rawQuery.length;

          const excerptStart =
            Math.max(
              0,
              matchStart - 18,
            );

          const excerptEnd =
            Math.min(
              sourceText.length,
              matchEnd + 26,
            );

          const excerpt =
            `${
              excerptStart > 0
                ? "…"
                : ""
            }${sourceText
              .slice(
                excerptStart,
                excerptEnd,
              )
              .replace(/\s+/g, " ")
              .trim()}${
              excerptEnd <
              sourceText.length
                ? "…"
                : ""
            }`;

          results.push({
            id: `${note.id}:${source}:${blockId ?? "last"}:${matchStart}:${occurrence}`,
            noteId: note.id,
            noteTitle: note.title,
            category: note.category,
            date: note.date,
            source,
            blockId,
            pageIndex,
            lineNumber,
            matchStart,
            matchText:
              sourceText.slice(
                matchStart,
                matchEnd,
              ),
            excerpt,
            locationLabel,
          });

          occurrence += 1;
          searchFrom =
            Math.max(
              matchEnd,
              matchStart + 1,
            );
        }
      };

      [...notes]
        .sort((first, second) =>
          second.updatedAt.localeCompare(
            first.updatedAt,
          ),
        )
        .forEach((note) => {
          const pages =
            paginateBlocks(
              note.blocks,
            );

          pages.forEach(
            (
              pageBlocks,
              pageIndex,
            ) => {
              let lineCursor = 1;

              pageBlocks.forEach(
                (block) => {
                  if (
                    block.type !==
                    "text"
                  ) {
                    return;
                  }

                  const bodyText =
                    stripHtml(
                      block.html,
                    );

                  pushMatches({
                    note,
                    source: "body",
                    blockId: block.id,
                    pageIndex,
                    lineNumber:
                      lineCursor,
                    sourceText:
                      bodyText,
                    locationLabel:
                      `본문 ${pageIndex + 1}P · ${lineCursor}줄`,
                  });

                  if (
                    block.annotation
                  ) {
                    const annotationText =
                      block.annotation.text;

                    pushMatches({
                      note,
                      source:
                        "annotation",
                      blockId:
                        block.id,
                      pageIndex,
                      lineNumber:
                        lineCursor + 1,
                      sourceText:
                        annotationText,
                      locationLabel:
                        `본문 ${pageIndex + 1}P · ${lineCursor + 1}줄 주석`,
                    });
                  }

                  lineCursor +=
                    Math.max(
                      1,
                      getBlockUnits(
                        block,
                      ),
                    );
                },
              );
            },
          );

          pushMatches({
            note,
            source:
              "lastPage",
            blockId: null,
            pageIndex: null,
            lineNumber: null,
            sourceText:
              stripHtml(
                note.lastPageHtml ??
                  "",
              ),
            locationLabel:
              "마지막 페이지",
          });
        });

      return results;
    }, [notes, searchQuery]);

  const notePages = useMemo(
    () => paginateBlocks(selectedNote?.blocks ?? []),
    [selectedNote?.blocks],
  );

  useEffect(() => {


  if (!selectedNote) {
      return;
    }

    const missingAnchors =
      new Map<string, number>();

    notePages.forEach(
      (pageBlocks, pageIndex) => {
        pageBlocks.forEach((block) => {
          if (
            block.type === "image" &&
            block.layout === "free" &&
            !Number.isFinite(
              block.pageAnchorIndex,
            )
          ) {
            missingAnchors.set(
              block.id,
              pageIndex,
            );
          }
        });
      },
    );

    if (
      missingAnchors.size === 0
    ) {
      return;
    }

    updateSelectedNote((note) => ({
      ...note,
      blocks: note.blocks.map(
        (block) =>
          block.type === "image" &&
          block.layout === "free" &&
          missingAnchors.has(
            block.id,
          )
            ? {
                ...block,
                pageAnchorIndex:
                  missingAnchors.get(
                    block.id,
                  ) ?? 0,
              }
            : block,
      ),
    }));
    // 기존 자유 배치 사진은 노트를 열었을 때 현재 페이지에 한 번만 고정한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNote?.id]);

  const recentNotes = useMemo(
    () => [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
    [notes],
  );

  const recentModifiedNotes = useMemo(
    () =>
      [...notes].sort((first, second) =>
        second.updatedAt.localeCompare(
          first.updatedAt,
        ),
      ),
    [notes],
  );

  function formatModifiedDateTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  function formatDateWithDay(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) {
      return value;
    }
    const weekday = WEEK_DAYS[new Date(year, month - 1, day).getDay()];
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} (${weekday})`;
  }

  function getCategoryCount(category: string) {
    return notes.filter((note) => note.category === category).length;
  }

  function cloneStudyNote(
    note: StudyNoteRecord,
  ): StudyNoteRecord {
    return {
      ...note,
      blocks: note.blocks.map((block) =>
        block.type === "text"
          ? {
              ...block,
              annotation:
                block.annotation
                  ? {
                      ...block.annotation,
                    }
                  : undefined,
            }
          : {
              ...block,
            },
      ),
    };
  }

  function getUndoSignature(
    note: StudyNoteRecord,
  ) {
    /*
     * updatedAt / version은 저장 메타데이터이므로 실행취소 단계로
     * 취급하지 않는다. 실제 화면 내용만 비교한다.
     */
    return JSON.stringify({
      date: note.date,
      title: note.title,
      category: note.category,
      blocks: note.blocks,
      lastPageHtml: note.lastPageHtml,
    });
  }

  function pushUndoSnapshot(
    note: StudyNoteRecord,
  ) {
    const currentStack =
      undoHistoryRef.current.get(
        note.id,
      ) ?? [];

    const lastSnapshot =
      currentStack.at(-1);

    /*
     * React 개발모드나 연속 상태 갱신에서 같은 상태가 여러 번
     * 들어와도 실행취소 단계는 한 번만 만든다.
     */
    if (
      lastSnapshot &&
      getUndoSignature(lastSnapshot) ===
        getUndoSignature(note)
    ) {
      return;
    }

    const nextStack = [
      ...currentStack,
      cloneStudyNote(note),
    ];

    if (nextStack.length > 100) {
      nextStack.splice(
        0,
        nextStack.length - 100,
      );
    }

    undoHistoryRef.current.set(
      note.id,
      nextStack,
    );
  }

  function undoSelectedNote() {
    const noteId =
      selectedNote?.id ??
      selectedNoteId;

    if (!noteId) {
      return;
    }

    const currentNote =
      notesRef.current.find(
        (note) => note.id === noteId,
      );

    if (!currentNote) {
      return;
    }

    const history =
      undoHistoryRef.current.get(
        noteId,
      ) ?? [];

    if (history.length === 0) {
      return;
    }

    const currentSignature =
      getUndoSignature(currentNote);

    /*
     * 기존 히스토리에 같은 상태가 여러 번 들어가 있더라도
     * Ctrl+Z 한 번에 실제로 화면이 달라지는 이전 상태까지
     * 바로 건너뛴다.
     */
    let snapshotIndex =
      history.length - 1;

    while (
      snapshotIndex >= 0 &&
      getUndoSignature(
        history[snapshotIndex],
      ) === currentSignature
    ) {
      snapshotIndex -= 1;
    }

    if (snapshotIndex < 0) {
      undoHistoryRef.current.set(
        noteId,
        [],
      );
      return;
    }

    const previousSnapshot =
      history[snapshotIndex];

    undoHistoryRef.current.set(
      noteId,
      history.slice(
        0,
        snapshotIndex,
      ),
    );

    const activeEditable =
      document.activeElement instanceof
        HTMLElement
        ? document.activeElement
        : null;

    const activeBlockId =
      activeEditable?.dataset
        .studyEditableId ?? null;

    if (
      activeEditable?.isContentEditable
    ) {
      activeEditable.blur();
    }

    const restoredNote: StudyNoteRecord = {
      ...cloneStudyNote(
        previousSnapshot,
      ),
      updatedAt:
        new Date().toISOString(),
      version:
        Math.max(
          Number(currentNote.version) ||
            1,
          Number(
            previousSnapshot.version,
          ) || 1,
        ) + 1,
    };

    const nextNotes =
      notesRef.current.map((note) =>
        note.id === noteId
          ? restoredNote
          : note,
      );

    notesRef.current = nextNotes;
    setNotes(nextNotes);

    setSelectedImageDeleteTarget(null);
    setResizingImageTarget(null);

    const restoreTarget =
      restoredNote.blocks.find(
        (
          block,
        ): block is StudyTextBlock =>
          block.type === "text" &&
          block.id === activeBlockId,
      ) ??
      restoredNote.blocks
        .filter(
          (
            block,
          ): block is StudyTextBlock =>
            block.type === "text" &&
            isEditableTextBlock(
              block,
            ),
        )
        .at(-1) ??
      null;

    lastSelectedTextBlockIdRef.current =
      restoreTarget?.id ?? null;

    selectedBlockIdsRef.current =
      restoreTarget
        ? [restoreTarget.id]
        : [];

    selectionRangeRef.current = null;

    if (restoreTarget) {
      window.setTimeout(() => {
        const editable =
          document.querySelector<HTMLElement>(
            `[data-study-editable-id="${restoreTarget.id}"]`,
          );

        if (!editable) {
          return;
        }

        editable.innerHTML =
          restoreTarget.html;
        editable.focus();

        const selection =
          window.getSelection();

        if (!selection) {
          return;
        }

        const range =
          document.createRange();

        range.selectNodeContents(
          editable,
        );
        range.collapse(false);

        selection.removeAllRanges();
        selection.addRange(range);

        selectionRangeRef.current =
          range.cloneRange();
      }, 0);
    }
  }

  function updateSelectedNote(
    updater: (note: StudyNoteRecord) => StudyNoteRecord,
  ) {
    const targetNoteId =
      selectedNote?.id ??
      selectedNoteId;

    if (!targetNoteId) {
      return;
    }

    const currentNotes =
      notesRef.current.length > 0
        ? notesRef.current
        : notes;

    const currentNote =
      currentNotes.find(
        (note) =>
          note.id === targetNoteId,
      );

    if (!currentNote) {
      return;
    }

    /*
     * setState 함수 내부에서 히스토리를 수정하면 React Strict Mode가
     * updater를 재실행할 때 같은 undo 단계가 여러 번 쌓일 수 있다.
     * 스냅샷은 여기서 딱 한 번만 기록한다.
     */
    pushUndoSnapshot(currentNote);

    const updatedNote =
      updater(currentNote);

    const nextNote: StudyNoteRecord = {
      ...updatedNote,
      updatedAt:
        new Date().toISOString(),
      version:
        Math.max(
          1,
          Number(
            currentNote.version,
          ) || 1,
        ) + 1,
    };

    const nextNotes =
      currentNotes.map((note) =>
        note.id === targetNoteId
          ? nextNote
          : note,
      );

    notesRef.current = nextNotes;
    setNotes(nextNotes);
  }

  function createNewNote(
    category = DEFAULT_CATEGORIES[0],
    title = "새로운 기록",
  ) {
    const nextNote = {
      ...createEmptyNote(category),
      title: title.trim() || "새로운 기록",
    };

    const currentNotes =
      notesRef.current.length > 0
        ? notesRef.current
        : notes;

    const nextNotes = [
      nextNote,
      ...currentNotes.filter(
        (note) => note.id !== nextNote.id,
      ),
    ];

    /*
     * 새 노트를 만든 직후 편집기로 전환할 때 selectedNote가
     * 잠깐 null이 되는 것을 막기 위해 ref/state를 동시에 갱신한다.
     * IndexedDB에도 즉시 저장해서 화면 전환 직후 동기화가 끼어들어도
     * 새 노트가 사라지지 않게 한다.
     */
    notesRef.current = nextNotes;
    undoHistoryRef.current.set(
      nextNote.id,
      [],
    );

    const firstTextBlock =
      nextNote.blocks.find(
        (
          block,
        ): block is StudyTextBlock =>
          block.type === "text",
      ) ?? null;

    lastSelectedTextBlockIdRef.current =
      firstTextBlock?.id ?? null;
    selectedBlockIdsRef.current =
      firstTextBlock
        ? [firstTextBlock.id]
        : [];
    selectionRangeRef.current = null;

    setNotes(nextNotes);
    setSelectedNoteId(nextNote.id);
    setCategoryFilter(category);
    setToolTab("text");
    setViewMode("editor");

    if (firstTextBlock) {
      window.setTimeout(() => {
        document
          .querySelector<HTMLElement>(
            `[data-study-editable-id="${firstTextBlock.id}"]`,
          )
          ?.focus();
      }, 0);
    }

    setHiddenCategories((previous) =>
      previous.filter(
        (item) => item !== category,
      ),
    );

    setCustomCategories((previous) =>
      Array.from(
        new Set([...previous, category]),
      ),
    );

    void replaceNotesInIndexedDb(nextNotes)
      .then(() => {
        setSaveLabel(
          navigator.onLine
            ? "로컬 저장됨"
            : "오프라인 저장됨",
        );

        if (navigator.onLine) {
          if (syncTimerRef.current !== null) {
            window.clearTimeout(syncTimerRef.current);
          }

          syncTimerRef.current = window.setTimeout(() => {
            void syncStudyNotes(nextNotes);
          }, 900);
        }
      })
      .catch((error) => {
        console.error(
          "새 HOO터디 노트 저장 실패:",
          error,
        );
        setSaveLabel("저장 실패");
      });
  }

  function requestCreateNote(category: string) {
    setPendingNoteCategory(category);
    setNoteNameDraft("");
    setIsNoteNameOpen(true);
  }

  function handleCreateNoteSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const title = noteNameDraft.trim();
    const category =
      pendingNoteCategory ?? categoryFilter;

    if (!title) {
      return;
    }

    setIsNoteNameOpen(false);
    setPendingNoteCategory(null);
    setNoteNameDraft("");

    createNewNote(category, title);
  }

  function openNote(noteId: string) {
    const targetNote =
      notesRef.current.find(
        (note) => note.id === noteId,
      ) ??
      notes.find(
        (note) => note.id === noteId,
      );

    const lastFocusableTextBlock =
      targetNote?.blocks
        .filter(
          (
            block,
          ): block is StudyTextBlock =>
            block.type === "text" &&
            !(
              stripHtml(block.html).trim() === "" &&
              !block.annotation &&
              !block.brace &&
              block.units > 1
            ),
        )
        .at(-1) ?? null;

    lastSelectedTextBlockIdRef.current =
      lastFocusableTextBlock?.id ?? null;
    selectedBlockIdsRef.current =
      lastFocusableTextBlock
        ? [lastFocusableTextBlock.id]
        : [];
    selectionRangeRef.current = null;

    setSelectedNoteId(noteId);
    setViewMode("editor");
    setToolTab("text");

    if (lastFocusableTextBlock) {
      window.setTimeout(() => {
        const editable =
          document.querySelector<HTMLElement>(
            `[data-study-editable-id="${lastFocusableTextBlock.id}"]`,
          );

        if (!editable) {
          return;
        }

        editable.focus();

        const selection =
          window.getSelection();

        if (selection) {
          const range =
            document.createRange();

          range.selectNodeContents(editable);
          range.collapse(false);

          selection.removeAllRanges();
          selection.addRange(range);

          selectionRangeRef.current =
            range.cloneRange();
        }
      }, 0);
    }
  }

  function selectSearchTextInEditable(
    editable: HTMLElement,
    query: string,
    preferredStart: number,
  ) {
    const fullText =
      editable.textContent ?? "";

    const normalizedText =
      fullText.toLowerCase();

    const normalizedQuery =
      query.toLowerCase();

    let matchStart =
      preferredStart;

    if (
      matchStart < 0 ||
      normalizedText.slice(
        matchStart,
        matchStart +
          normalizedQuery.length,
      ) !== normalizedQuery
    ) {
      matchStart =
        normalizedText.indexOf(
          normalizedQuery,
        );
    }

    if (matchStart < 0) {
      editable.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return false;
    }

    const matchEnd =
      matchStart + query.length;

    const walker =
      document.createTreeWalker(
        editable,
        NodeFilter.SHOW_TEXT,
      );

    let cursor = 0;
    let startNode:
      | Text
      | null = null;
    let startOffset = 0;
    let endNode:
      | Text
      | null = null;
    let endOffset = 0;

    while (walker.nextNode()) {
      const node =
        walker.currentNode as Text;

      const nodeLength =
        node.data.length;

      if (
        !startNode &&
        matchStart <=
          cursor + nodeLength
      ) {
        startNode = node;
        startOffset =
          Math.max(
            0,
            matchStart - cursor,
          );
      }

      if (
        startNode &&
        matchEnd <=
          cursor + nodeLength
      ) {
        endNode = node;
        endOffset =
          Math.max(
            0,
            matchEnd - cursor,
          );
        break;
      }

      cursor += nodeLength;
    }

    if (
      !startNode ||
      !endNode
    ) {
      editable.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return false;
    }

    editable.focus();

    const range =
      document.createRange();

    range.setStart(
      startNode,
      Math.min(
        startOffset,
        startNode.data.length,
      ),
    );

    range.setEnd(
      endNode,
      Math.min(
        endOffset,
        endNode.data.length,
      ),
    );

    const selection =
      window.getSelection();

    if (!selection) {
      return false;
    }

    selection.removeAllRanges();
    selection.addRange(range);

    selectionRangeRef.current =
      range.cloneRange();

    editable.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    return true;
  }

  function openContentSearchResult(
    result: StudyContentSearchResult,
  ) {
    const targetNote =
      notesRef.current.find(
        (note) =>
          note.id ===
          result.noteId,
      ) ??
      notes.find(
        (note) =>
          note.id ===
          result.noteId,
      );

    if (!targetNote) {
      return;
    }

    setSearchQuery("");

    setSelectedNoteId(
      result.noteId,
    );
    setViewMode("editor");
    setToolTab("text");

    lastSelectedTextBlockIdRef.current =
      result.blockId;

    selectedBlockIdsRef.current =
      result.blockId
        ? [result.blockId]
        : [];

    selectionRangeRef.current =
      null;

    /*
     * 에디터가 해당 노트로 렌더된 다음,
     * 정확한 페이지/줄로 스크롤하고 검색어를 선택 상태로 만든다.
     */
    window.setTimeout(() => {
      if (
        result.source ===
        "lastPage"
      ) {
        const lastPage =
          document.querySelector<HTMLElement>(
            `[data-study-last-page-id="${result.noteId}"]`,
          );

        if (!lastPage) {
          return;
        }

        selectSearchTextInEditable(
          lastPage,
          result.matchText,
          result.matchStart,
        );

        return;
      }

      if (!result.blockId) {
        return;
      }

      if (
        result.source ===
        "annotation"
      ) {
        const annotationInput =
          document.querySelector<HTMLInputElement>(
            `[data-study-annotation-id="${result.blockId}"]`,
          );

        if (annotationInput) {
          const value =
            annotationInput.value;

          const normalizedValue =
            value.toLowerCase();

          const normalizedQuery =
            result.matchText.toLowerCase();

          let start =
            normalizedValue.indexOf(
              normalizedQuery,
            );

          if (start < 0) {
            start = 0;
          }

          annotationInput.focus();
          annotationInput.setSelectionRange(
            start,
            Math.min(
              value.length,
              start +
                result.matchText
                  .length,
            ),
          );

          annotationInput.scrollIntoView(
            {
              behavior: "smooth",
              block: "center",
            },
          );

          return;
        }
      }

      const editable =
        document.querySelector<HTMLElement>(
          `[data-study-editable-id="${result.blockId}"]`,
        );

      if (!editable) {
        return;
      }

      selectSearchTextInEditable(
        editable,
        result.matchText,
        result.matchStart,
      );
    }, 80);
  }

  function openCategory(category: string) {
    setCategoryFilter(category);
    setSelectedNoteId(null);
    setSearchQuery("");
    setViewMode("category");
  }

  function removeNotesByIds(noteIds: string[]) {
    if (noteIds.length === 0) {
      return;
    }

    const deletedAt = new Date().toISOString();
    const deletedIdSet = new Set(noteIds);

    const nextNotes = notesRef.current.filter(
      (note) => !deletedIdSet.has(note.id),
    );

    const nextTombstones = [
      ...tombstones.filter(
        (item) => !deletedIdSet.has(item.id),
      ),
      ...noteIds.map((id) => ({
        id,
        deletedAt,
      })),
    ];

    notesRef.current = nextNotes;
    setNotes(nextNotes);
    setTombstones(nextTombstones);

    void Promise.all([
      replaceNotesInIndexedDb(nextNotes),
      replaceStudyNoteTombstones(
        nextTombstones,
      ),
    ])
      .then(() => {
        if (navigator.onLine) {
          window.setTimeout(() => {
            void syncStudyNotes(nextNotes);
          }, 150);
        }
      })
      .catch((error) => {
        console.error(
          "HOO터디 노트 삭제 저장 실패:",
          error,
        );
        setSaveLabel("삭제 저장 실패");
      });
  }

  function deleteNoteById(noteId: string) {
    const targetNote =
      notes.find((note) => note.id === noteId);

    if (!targetNote) {
      return;
    }

    if (
      !window.confirm(
        `“${targetNote.title}” 노트 파일을 삭제할까요?`,
      )
    ) {
      return;
    }

    removeNotesByIds([noteId]);

    if (selectedNoteId === noteId) {
      const nextSelectedNote =
        notes.find((note) => note.id !== noteId);

      setSelectedNoteId(
        nextSelectedNote?.id ?? null,
      );
      setViewMode("home");
    }
  }

  function deleteSelectedNote() {
    if (!selectedNote) {
      return;
    }

    deleteNoteById(selectedNote.id);
  }

  function deleteCategory(category: string) {
    const categoryNotes = notes.filter(
      (note) => note.category === category,
    );

    const message =
      categoryNotes.length > 0
        ? `“${category}” 폴더와 안의 ${categoryNotes.length}개 노트를 모두 삭제할까요?`
        : `“${category}” 폴더를 삭제할까요?`;

    if (!window.confirm(message)) {
      return;
    }

    const categoryNoteIds =
      categoryNotes.map((note) => note.id);

    if (categoryNoteIds.length > 0) {
      removeNotesByIds(categoryNoteIds);
    }

    setHiddenCategories((previous) =>
      Array.from(
        new Set([...previous, category]),
      ),
    );

    setCustomCategories((previous) =>
      previous.filter(
        (item) => item !== category,
      ),
    );

    if (categoryFilter === category) {
      setCategoryFilter("전체");
      setSelectedNoteId(null);
      setViewMode("home");
      return;
    }

    if (
      selectedNote &&
      selectedNote.category === category
    ) {
      setSelectedNoteId(null);
      setViewMode("home");
    }
  }

  function deleteDate(date: string) {
    const dateNotes = notes.filter(
      (note) => note.date === date,
    );

    if (dateNotes.length === 0) {
      return;
    }

    const message =
      dateNotes.length === 1
        ? `${formatDateWithDay(date)}의 노트를 삭제할까요?`
        : `${formatDateWithDay(date)}의 ${dateNotes.length}개 노트를 모두 삭제할까요?`;

    if (!window.confirm(message)) {
      return;
    }

    removeNotesByIds(
      dateNotes.map((note) => note.id),
    );

    if (
      selectedNote &&
      selectedNote.date === date
    ) {
      setSelectedNoteId(null);
      setViewMode("home");
    }
  }

  function deleteImageBlock(
    noteId: string,
    blockId: string,
    _label: string,
  ) {
    const targetNote =
      notesRef.current.find(
        (note) => note.id === noteId,
      );

    const targetImage =
      targetNote?.blocks.find(
        (block) =>
          block.type === "image" &&
          block.id === blockId,
      );

    if (
      !targetNote ||
      !targetImage ||
      targetImage.type !== "image"
    ) {
      return;
    }

    /*
     * 이미 사진을 한 번 클릭해서 삭제 상태로 만든 뒤
     * '삭제'를 누르는 흐름이므로 추가 확인창 없이 바로 제거한다.
     * 사진 삭제도 Ctrl+Z로 되살릴 수 있도록 삭제 직전 상태를 보관한다.
     */
    pushUndoSnapshot(targetNote);

    const nextNotes =
      notesRef.current.map((note) =>
        note.id === noteId
          ? {
              ...note,
              blocks: note.blocks.filter(
                (block) =>
                  block.id !== blockId,
              ),
              updatedAt:
                new Date().toISOString(),
              version:
                Math.max(
                  1,
                  Number(note.version) || 1,
                ) + 1,
            }
          : note,
      );

    notesRef.current = nextNotes;
    setNotes(nextNotes);
    setSelectedImageDeleteTarget(null);
    setResizingImageTarget((current) =>
      current?.noteId === noteId &&
      current.blockId === blockId
        ? null
        : current,
    );

    void replaceNotesInIndexedDb(nextNotes)
      .then(() => {
        setSaveLabel(
          navigator.onLine
            ? "로컬 저장됨"
            : "오프라인 저장됨",
        );

        if (navigator.onLine) {
          if (
            syncTimerRef.current !== null
          ) {
            window.clearTimeout(
              syncTimerRef.current,
            );
          }

          syncTimerRef.current =
            window.setTimeout(() => {
              void syncStudyNotes(
                notesRef.current,
              );
            }, 900);
        }
      })
      .catch((error) => {
        console.error(
          "HOO터디 노트 사진 삭제 저장 실패:",
          error,
        );
        setSaveLabel("삭제 저장 실패");
      });
  }

  function beginDeleteDrag(
    event: DragEvent<HTMLElement>,
    target: DeleteDragTarget,
  ) {
    setDraggingDeleteTarget(target);
    setIsTrashDragOver(false);

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/x-hoo-study-note-delete-target",
      JSON.stringify(target),
    );
  }

  function finishDeleteDrag() {
    setDraggingDeleteTarget(null);
    setIsTrashDragOver(false);
  }

  function handleTrashDrop(
    event: DragEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();

    let target = draggingDeleteTarget;

    if (!target) {
      const serializedTarget =
        event.dataTransfer.getData(
          "application/x-hoo-study-note-delete-target",
        );

      if (serializedTarget) {
        try {
          const parsedTarget = JSON.parse(
            serializedTarget,
          ) as DeleteDragTarget;

          if (
            parsedTarget?.kind === "note" ||
            parsedTarget?.kind === "category" ||
            parsedTarget?.kind === "date" ||
            parsedTarget?.kind === "image"
          ) {
            target = parsedTarget;
          }
        } catch {
          target = null;
        }
      }
    }

    finishDeleteDrag();

    if (!target) {
      return;
    }

    if (target.kind === "note") {
      deleteNoteById(target.id);
      return;
    }

    if (target.kind === "date") {
      deleteDate(target.date);
      return;
    }

    if (target.kind === "image") {
      deleteImageBlock(
        target.noteId,
        target.blockId,
        target.label,
      );
      return;
    }

    deleteCategory(target.category);
  }

  function createCategory() {
    const category = window.prompt(
      "새 카테고리 이름을 입력하세요.",
    )?.trim();

    if (!category) {
      return;
    }

    if (
      categories.some(
        (item) =>
          item.toLowerCase() ===
          category.toLowerCase(),
      )
    ) {
      window.alert(
        "이미 같은 이름의 카테고리가 있어요.",
      );
      openCategory(category);
      return;
    }

    setCustomCategories((previous) =>
      Array.from(
        new Set([...previous, category]),
      ),
    );

    setHiddenCategories((previous) =>
      previous.filter(
        (item) => item !== category,
      ),
    );

    setCategoryFilter(category);
    setSelectedNoteId(null);
    setSearchQuery("");
    setViewMode("category");
  }

  function updateBlock(blockId: string, updater: (block: StudyBlock) => StudyBlock) {
    updateSelectedNote((note) => ({
      ...note,
      blocks: note.blocks.map((block) => (block.id === blockId ? updater(block) : block)),
    }));
  }

  function updateLastPageHtml(html: string) {
    updateSelectedNote((note) => ({
      ...note,
      lastPageHtml: html,
    }));
  }

  function insertTextBlock(afterBlockId?: string) {
    if (!selectedNote) {
      return;
    }

    const nextBlock = createTextBlock();

    updateSelectedNote((note) => {
      const nextBlocks = [...note.blocks];
      const targetIndex = afterBlockId
        ? nextBlocks.findIndex((block) => block.id === afterBlockId)
        : nextBlocks.length - 1;
      nextBlocks.splice(Math.max(0, targetIndex + 1), 0, nextBlock);
      return { ...note, blocks: nextBlocks };
    });

    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-study-editable-id="${nextBlock.id}"]`)?.focus();
    }, 0);
  }

  function appendNewPage() {
    if (!selectedNote) {
      return;
    }

    const currentPages = paginateBlocks(selectedNote.blocks);
    const lastPage = currentPages.at(-1) ?? [];
    const usedUnits = lastPage.reduce(
      (sum, block) => sum + getBlockUnits(block),
      0,
    );
    const remainingUnits = Math.max(
      0,
      PAGE_LINE_LIMIT - usedUnits,
    );

    /*
     * 새 페이지를 만들기 위해 빈 text block을 여러 개 생성하지 않는다.
     * 현재 페이지의 남은 줄은 하나의 spacer block으로 정확히 채우고,
     * 그 다음에 실제 입력용 첫 줄을 추가한다.
     *
     * 결과:
     * - 29줄 경계가 정확하게 유지됨
     * - 페이지를 추가할 때 불필요한 빈 block이 수십 개 생기지 않음
     * - 2/2, 3/3 페이지가 하나의 노트 blocks 안에 안정적으로 유지됨
     * - IndexedDB/Supabase/정리본에서 페이지 이후 내용을 추적하기 쉬워짐
     */
    const spacerBlock: StudyTextBlock | null =
      remainingUnits > 0
        ? {
            id: createId(),
            type: "text",
            html: "",
            units: remainingUnits,
            brace: false,
          }
        : null;

    const focusBlock = createTextBlock();

    updateSelectedNote((note) => ({
      ...note,
      blocks: [
        ...note.blocks,
        ...(spacerBlock ? [spacerBlock] : []),
        focusBlock,
      ],
    }));

    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(
          `[data-study-editable-id="${focusBlock.id}"]`,
        )
        ?.focus();
    }, 0);
  }

  function isEditableTextBlock(
    block: StudyTextBlock,
  ) {
    /*
     * 실제 페이지의 모든 text block은 항상 편집 가능하다.
     * 페이지를 강제로 넘기기 위해 내부적으로 만든 큰 spacer만 제외한다.
     */
    const isPageSpacer =
      stripHtml(block.html)
        .replace(/\u00a0/g, " ")
        .trim().length === 0 &&
      !block.annotation &&
      !block.brace &&
      block.units > 1;

    return !isPageSpacer;
  }

  function focusTextBlock(
    blockId: string,
    caret: "start" | "end" = "end",
  ) {
    const editable =
      document.querySelector<HTMLElement>(
        `[data-study-editable-id="${blockId}"]`,
      );

    if (!editable) {
      return false;
    }

    lastSelectedTextBlockIdRef.current =
      blockId;
    selectedBlockIdsRef.current = [
      blockId,
    ];

    editable.focus();

    const selection =
      window.getSelection();

    if (selection) {
      const range =
        document.createRange();

      range.selectNodeContents(editable);
      range.collapse(caret === "start");

      selection.removeAllRanges();
      selection.addRange(range);

      selectionRangeRef.current =
        range.cloneRange();
    }

    return true;
  }

  function focusActiveTextBlockAtEnd() {
    const activeBlockId =
      lastSelectedTextBlockIdRef.current;

    if (!activeBlockId) {
      return false;
    }

    return focusTextBlock(
      activeBlockId,
      "end",
    );
  }

  function focusAdjacentEditableTextBlock(
    currentBlockId: string,
    direction: "previous" | "next",
  ) {
    if (!selectedNote) {
      return false;
    }

    const activatedTextBlocks =
      selectedNote.blocks.filter(
        (
          item,
        ): item is StudyTextBlock =>
          item.type === "text" &&
          isEditableTextBlock(item),
      );

    const currentIndex =
      activatedTextBlocks.findIndex(
        (item) =>
          item.id === currentBlockId,
      );

    if (currentIndex < 0) {
      return false;
    }

    const targetIndex =
      direction === "next"
        ? currentIndex + 1
        : currentIndex - 1;

    const targetBlock =
      activatedTextBlocks[targetIndex];

    if (!targetBlock) {
      return false;
    }

    return focusTextBlock(
      targetBlock.id,
      direction === "next"
        ? "start"
        : "end",
    );
  }

  function captureTypingFormatSnapshot() {
    let fontColor = "";
    let highlightColor = "";

    try {
      fontColor =
        String(
          document.queryCommandValue(
            "foreColor",
          ) || "",
        ).trim();

      highlightColor =
        String(
          document.queryCommandValue(
            "hiliteColor",
          ) || "",
        ).trim();
    } catch {
      fontColor = "";
      highlightColor = "";
    }

    return {
      bold:
        document.queryCommandState(
          "bold",
        ),
      italic:
        document.queryCommandState(
          "italic",
        ),
      underline:
        document.queryCommandState(
          "underline",
        ),
      underlineColor:
        activeUnderlineColor,
      strikeThrough:
        document.queryCommandState(
          "strikeThrough",
        ),
      strikeColor:
        activeStrikeColor,
      highlight:
        isHighlightColorActive(
          highlightColor,
        ),
      fontColor,
      fontSize:
        typingFontSizeRef.current,
    };
  }

  function restoreTypingFormatSnapshot(
    snapshot: ReturnType<
      typeof captureTypingFormatSnapshot
    >,
  ) {
    /*
     * 줄바꿈 뒤의 새 contentEditable에서도 직전 커서의 입력 서식을
     * 그대로 유지한다.
     *
     * 특히 fontSize는 빈 contentEditable의 collapsed caret에
     * execCommand("fontSize")만 호출하면 브라우저가 다음 입력에서
     * 기본 14px로 되돌리는 경우가 있어서, 새 줄에 보이지 않는
     * zero-width seed span을 만들고 커서를 그 span 안에 둔다.
     * 이후 입력은 정확한 px 크기를 그대로 상속한다.
     */
    const selection =
      window.getSelection();

    if (
      selection &&
      selection.rangeCount > 0 &&
      selection.isCollapsed
    ) {
      const range =
        selection.getRangeAt(0);

      const startElement =
        range.startContainer instanceof
        HTMLElement
          ? range.startContainer
          : range.startContainer
              .parentElement;

      const editable =
        startElement?.closest<HTMLElement>(
          "[data-study-editable-id]",
        );

      if (
        editable &&
        stripHtml(
          editable.innerHTML,
        ).trim() === ""
      ) {
        let fontSizeSeed =
          editable.querySelector<HTMLElement>(
            "[data-hoo-font-size-seed='true']",
          );

        if (!fontSizeSeed) {
          fontSizeSeed =
            document.createElement(
              "span",
            );

          fontSizeSeed.dataset.hooFontSizeSeed =
            "true";
          fontSizeSeed.textContent =
            "\u200B";

          editable.innerHTML = "";
          editable.appendChild(
            fontSizeSeed,
          );
        }

        fontSizeSeed.style.fontSize =
          `${snapshot.fontSize}px`;

        if (snapshot.underline) {
          fontSizeSeed.style.textDecorationLine =
            "underline";
          fontSizeSeed.style.textDecorationColor =
            snapshot.underlineColor;
          fontSizeSeed.style.textDecorationThickness =
            "1px";
        } else {
          fontSizeSeed.style.textDecorationLine =
            "";
          fontSizeSeed.style.textDecorationColor =
            "";
          fontSizeSeed.style.textDecorationThickness =
            "";
        }

        let caretSeedElement =
          fontSizeSeed;

        if (snapshot.strikeThrough) {
          const strikeSeed =
            document.createElement(
              "span",
            );

          strikeSeed.dataset.hooStrikeColor =
            "true";
          strikeSeed.style.textDecorationLine =
            "line-through";
          strikeSeed.style.textDecorationColor =
            snapshot.strikeColor;
          strikeSeed.style.textDecorationThickness =
            "1px";
          strikeSeed.textContent =
            "\u200B";

          fontSizeSeed.textContent = "";
          fontSizeSeed.appendChild(
            strikeSeed,
          );

          caretSeedElement =
            strikeSeed;
        }

        const seedRange =
          document.createRange();

        seedRange.selectNodeContents(
          caretSeedElement,
        );
        seedRange.collapse(false);

        selection.removeAllRanges();
        selection.addRange(seedRange);

        selectionRangeRef.current =
          seedRange.cloneRange();
      }
    }

    const ensureCommandState = (
      command:
        | "bold"
        | "italic"
        | "underline"
        | "strikeThrough",
      shouldBeActive: boolean,
    ) => {
      const isActive =
        document.queryCommandState(
          command,
        );

      if (
        isActive !==
        shouldBeActive
      ) {
        document.execCommand(
          command,
          false,
        );
      }
    };

    ensureCommandState(
      "bold",
      snapshot.bold,
    );
    ensureCommandState(
      "italic",
      snapshot.italic,
    );
    ensureCommandState(
      "underline",
      snapshot.underline,
    );
    ensureCommandState(
      "strikeThrough",
      snapshot.strikeThrough,
    );

    const currentHighlight =
      String(
        document.queryCommandValue(
          "hiliteColor",
        ) || "",
      ).trim();

    const isCurrentHighlightActive =
      isHighlightColorActive(
        currentHighlight,
      );

    if (
      isCurrentHighlightActive !==
      snapshot.highlight
    ) {
      const highlightColor =
        snapshot.highlight
          ? HIGHLIGHT_COLOR
          : "transparent";

      const applied =
        document.execCommand(
          "hiliteColor",
          false,
          highlightColor,
        );

      if (!applied) {
        document.execCommand(
          "backColor",
          false,
          highlightColor,
        );
      }
    }

    setIsHighlightFormatActive(
      snapshot.highlight,
    );

    if (snapshot.fontColor) {
      document.execCommand(
        "foreColor",
        false,
        snapshot.fontColor,
      );
      setActiveFontColor(
        snapshot.fontColor,
      );
    }

    /*
     * 중요:
     * 여기서 syncPrimaryTextFormatState()를 다시 호출하면
     * 새 빈 줄의 computed font-size가 잠깐 기본 14px로 잡히는 순간
     * activeFontSizeRef까지 14로 덮어써질 수 있다.
     *
     * 그러면 첫 Enter까지는 seed span 덕분에 정상 크기로 보이지만,
     * 두 번째 Enter부터 snapshot.fontSize가 14가 되어 기능이 꺼진다.
     *
     * 따라서 Enter 직후에는 DOM 재측정으로 상태를 덮어쓰지 않고,
     * Enter 이전의 typing snapshot을 그대로 다음 줄 상태로 유지한다.
     */
    activeFontSizeRef.current =
      snapshot.fontSize;
    typingFontSizeRef.current =
      snapshot.fontSize;

    setActiveFontSize(
      snapshot.fontSize,
    );

    setIsBoldFormatActive(
      snapshot.bold,
    );
    setIsItalicFormatActive(
      snapshot.italic,
    );
    setIsUnderlineFormatActive(
      snapshot.underline,
    );
    setActiveUnderlineColor(
      snapshot.underlineColor,
    );
    setIsStrikeFormatActive(
      snapshot.strikeThrough,
    );
    setActiveStrikeColor(
      snapshot.strikeColor,
    );

    if (snapshot.fontColor) {
      setActiveFontColor(
        snapshot.fontColor,
      );
    }
  }

  function handleTextKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    block: StudyTextBlock,
  ) {
    if (event.key === "Enter") {
      const typingFormatSnapshot =
        captureTypingFormatSnapshot();

      event.preventDefault();

      const editable = event.currentTarget;
      const selection = window.getSelection();

      let beforeHtml = editable.innerHTML;
      let afterHtml = "";

      /*
       * Enter를 누른 실제 커서 위치에서 문단을 둘로 나눈다.
       * 형광펜/밑줄처럼 HTML로 저장된 서식도 DocumentFragment로
       * 함께 이동하므로 줄바꿈 뒤에도 최대한 그대로 유지된다.
       */
      if (
        selection &&
        selection.rangeCount > 0 &&
        editable.contains(
          selection.getRangeAt(0).startContainer,
        )
      ) {
        const caretRange = selection.getRangeAt(0);
        const afterRange = document.createRange();

        afterRange.selectNodeContents(editable);
        afterRange.setStart(
          caretRange.startContainer,
          caretRange.startOffset,
        );

        const afterFragment =
          afterRange.extractContents();
        const afterContainer =
          document.createElement("div");

        afterContainer.appendChild(afterFragment);

        beforeHtml = editable.innerHTML;
        afterHtml = afterContainer.innerHTML;
      }

      const currentMeasuredUnits = Math.max(
        1,
        Math.min(
          PAGE_LINE_LIMIT,
          Math.ceil(
            editable.scrollHeight /
              ROW_HEIGHT,
          ),
        ),
      );

      const nextBlock: StudyTextBlock = {
        ...createTextBlock(),
        html: afterHtml,
      };

      updateSelectedNote((note) => {
        const targetIndex =
          note.blocks.findIndex(
            (item) => item.id === block.id,
          );

        if (targetIndex < 0) {
          return note;
        }

        const nextBlocks =
          note.blocks.map((item) =>
            item.id === block.id &&
            item.type === "text"
              ? {
                  ...item,
                  html: beforeHtml,
                  units:
                    currentMeasuredUnits,
                }
              : item,
          );

        nextBlocks.splice(
          targetIndex + 1,
          0,
          nextBlock,
        );

        return {
          ...note,
          blocks: nextBlocks,
        };
      });

      window.setTimeout(() => {
        const nextEditable =
          document.querySelector<HTMLElement>(
            `[data-study-editable-id="${nextBlock.id}"]`,
          );

        if (!nextEditable) {
          return;
        }

        const nextMeasuredUnits = Math.max(
          1,
          Math.min(
            PAGE_LINE_LIMIT,
            Math.ceil(
              nextEditable.scrollHeight /
                ROW_HEIGHT,
            ),
          ),
        );

        if (
          nextMeasuredUnits !==
          nextBlock.units
        ) {
          updateBlock(
            nextBlock.id,
            (currentBlock) =>
              currentBlock.type === "text"
                ? {
                    ...currentBlock,
                    units:
                      nextMeasuredUnits,
                  }
                : currentBlock,
          );
        }

        lastSelectedTextBlockIdRef.current =
          nextBlock.id;
        selectedBlockIdsRef.current = [
          nextBlock.id,
        ];

        nextEditable.focus();

        const nextSelection =
          window.getSelection();

        if (nextSelection) {
          const nextRange =
            document.createRange();

          nextRange.selectNodeContents(
            nextEditable,
          );
          nextRange.collapse(true);

          nextSelection.removeAllRanges();
          nextSelection.addRange(nextRange);

          /*
           * 굵게 / 기울임 / 밑줄 / 삭제선 / 폰트 색상 / 폰트 크기를
           * Enter 이전 상태 그대로 새 줄의 커서에 이어 붙인다.
           */
          restoreTypingFormatSnapshot(
            typingFormatSnapshot,
          );

          const restoredSelection =
            window.getSelection();

          if (
            restoredSelection &&
            restoredSelection.rangeCount > 0
          ) {
            selectionRangeRef.current =
              restoredSelection
                .getRangeAt(0)
                .cloneRange();
          } else {
            selectionRangeRef.current =
              nextRange.cloneRange();
          }
        }
      }, 0);

      return;
    }

    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown"
    ) {
      const moved =
        focusAdjacentEditableTextBlock(
          block.id,
          event.key === "ArrowUp"
            ? "previous"
            : "next",
        );

      if (moved) {
        event.preventDefault();
        return;
      }
    }

    if (
      event.key === "Backspace" &&
      stripHtml(
        event.currentTarget.innerHTML,
      ).trim() === "" &&
      selectedNote &&
      selectedNote.blocks.length > 1
    ) {
      event.preventDefault();

      const targetIndex =
        selectedNote.blocks.findIndex(
          (item) => item.id === block.id,
        );

      const immediatePrevious =
        targetIndex > 0
          ? selectedNote.blocks[
              targetIndex - 1
            ]
          : null;

      /*
       * "새 페이지"가 만든 큰 빈 spacer 바로 뒤의 첫 빈 줄에서
       * Backspace를 누르면 spacer도 함께 제거한다.
       * 그러면 다음 페이지 내용이 자동으로 앞 페이지로 당겨진다.
       */
      const previousIsPageSpacer =
        immediatePrevious?.type ===
          "text" &&
        stripHtml(
          immediatePrevious.html,
        ).trim() === "" &&
        !immediatePrevious.annotation &&
        !immediatePrevious.brace &&
        immediatePrevious.units > 1;

      const removeIds = new Set([
        block.id,
        ...(previousIsPageSpacer &&
        immediatePrevious
          ? [immediatePrevious.id]
          : []),
      ]);

      const focusSearchEnd =
        previousIsPageSpacer
          ? targetIndex - 1
          : targetIndex;

      const previousTextBlock =
        selectedNote.blocks
          .slice(
            0,
            Math.max(
              0,
              focusSearchEnd,
            ),
          )
          .reverse()
          .find(
            (
              item,
            ): item is StudyTextBlock =>
              item.type === "text" &&
              !removeIds.has(item.id),
          );

      updateSelectedNote((note) => ({
        ...note,
        blocks: note.blocks.filter(
          (item) =>
            !removeIds.has(item.id),
        ),
      }));

      window.setTimeout(() => {
        if (!previousTextBlock) {
          return;
        }

        const previousEditable =
          document.querySelector<HTMLElement>(
            `[data-study-editable-id="${previousTextBlock.id}"]`,
          );

        if (!previousEditable) {
          return;
        }

        lastSelectedTextBlockIdRef.current =
          previousTextBlock.id;
        selectedBlockIdsRef.current = [
          previousTextBlock.id,
        ];

        previousEditable.focus();

        const previousSelection =
          window.getSelection();

        if (previousSelection) {
          const previousRange =
            document.createRange();

          previousRange.selectNodeContents(
            previousEditable,
          );
          previousRange.collapse(false);

          previousSelection.removeAllRanges();
          previousSelection.addRange(
            previousRange,
          );
        }
      }, 0);
    }
  }

  function captureSelection(fallbackBlockId?: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (fallbackBlockId) {
        lastSelectedTextBlockIdRef.current = fallbackBlockId;
        selectedBlockIdsRef.current = [fallbackBlockId];
      }
      return;
    }

    const range = selection.getRangeAt(0);
    const editorRoot = document.querySelector("[data-study-editor-root]");

    if (!editorRoot || !editorRoot.contains(range.commonAncestorContainer)) {
      return;
    }

    const selectedIds = Array.from(
      editorRoot.querySelectorAll<HTMLElement>("[data-study-block-id]"),
    )
      .filter((element) => {
        try {
          return range.intersectsNode(element);
        } catch {
          return false;
        }
      })
      .map((element) => element.dataset.studyBlockId)
      .filter((value): value is string => Boolean(value));

    selectionRangeRef.current = range.cloneRange();
    selectedBlockIdsRef.current = selectedIds;
    lastSelectedTextBlockIdRef.current = selectedIds[0] ?? fallbackBlockId ?? null;
  }

  function restoreSelection() {
    const range = selectionRangeRef.current;
    if (!range) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection) {
      return false;
    }

    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function syncSelectedEditableHtml() {
    const selectedIds = selectedBlockIdsRef.current;
    if (selectedIds.length === 0) {
      return;
    }

    updateSelectedNote((note) => ({
      ...note,
      blocks: note.blocks.map((block) => {
        if (block.type !== "text" || !selectedIds.includes(block.id)) {
          return block;
        }

        const editable = document.querySelector<HTMLElement>(
          `[data-study-editable-id="${block.id}"]`,
        );

        return editable ? { ...block, html: editable.innerHTML } : block;
      }),
    }));
  }

  function isHighlightColorActive(
    value: string,
  ) {
    const normalized =
      value
        .replace(/\s+/g, "")
        .toLowerCase();

    return (
      normalized !== "" &&
      normalized !== "transparent" &&
      normalized !==
        "rgba(0,0,0,0)"
    );
  }

  function syncPrimaryTextFormatState() {
    try {
      setIsBoldFormatActive(
        document.queryCommandState("bold"),
      );
      setIsItalicFormatActive(
        document.queryCommandState("italic"),
      );
      setIsUnderlineFormatActive(
        document.queryCommandState("underline"),
      );
      setIsStrikeFormatActive(
        document.queryCommandState("strikeThrough"),
      );

      const highlightColor =
        String(
          document.queryCommandValue(
            "hiliteColor",
          ) || "",
        ).trim();

      setIsHighlightFormatActive(
        isHighlightColorActive(
          highlightColor,
        ),
      );

      const commandColor =
        String(
          document.queryCommandValue(
            "foreColor",
          ) || "",
        ).trim();

      if (commandColor) {
        setActiveFontColor(commandColor);
      }

      const selection =
        window.getSelection();

      const anchorElement =
        selection?.anchorNode instanceof HTMLElement
          ? selection.anchorNode
          : selection?.anchorNode?.parentElement;

      if (anchorElement) {
        const computedSize =
          Number.parseFloat(
            window
              .getComputedStyle(anchorElement)
              .fontSize,
          );

        if (Number.isFinite(computedSize)) {
          const nearestSize =
            FONT_SIZE_OPTIONS.reduce(
              (closest, candidate) =>
                Math.abs(
                  candidate -
                    computedSize,
                ) <
                Math.abs(
                  closest -
                    computedSize,
                )
                  ? candidate
                  : closest,
              FONT_SIZE_OPTIONS[0],
            );

          activeFontSizeRef.current =
            nearestSize;
          setActiveFontSize(
            nearestSize,
          );
        }
      }
    } catch {
      setIsBoldFormatActive(false);
      setIsItalicFormatActive(false);
      setIsUnderlineFormatActive(false);
      setIsStrikeFormatActive(false);
      setIsHighlightFormatActive(false);
    }
  }

  function togglePrimaryTextFormat(
    command:
      | "bold"
      | "italic"
      | "underline"
      | "strikeThrough",
  ) {
    const selection =
      window.getSelection();

    if (
      !selection ||
      selection.rangeCount === 0
    ) {
      return;
    }

    const range =
      selection.getRangeAt(0);

    const editorRoot =
      document.querySelector<HTMLElement>(
        "[data-study-editor-root]",
      );

    if (
      !editorRoot ||
      !editorRoot.contains(
        range.commonAncestorContainer,
      )
    ) {
      const activeBlockId =
        lastSelectedTextBlockIdRef.current;

      if (!activeBlockId) {
        return;
      }

      const editable =
        document.querySelector<HTMLElement>(
          `[data-study-editable-id="${activeBlockId}"]`,
        );

      if (!editable) {
        return;
      }

      editable.focus();

      const fallbackSelection =
        window.getSelection();

      if (!fallbackSelection) {
        return;
      }

      const fallbackRange =
        document.createRange();

      fallbackRange.selectNodeContents(
        editable,
      );
      fallbackRange.collapse(false);

      fallbackSelection.removeAllRanges();
      fallbackSelection.addRange(
        fallbackRange,
      );
    }

    /*
     * 선택 영역이 있으면 선택한 부분만 토글하고,
     * 커서만 있는 상태면 그 시점부터 입력될 텍스트 스타일을 토글한다.
     * contentEditable의 HTML에 굵게/기울임/밑줄/삭제선 상태가 남기 때문에
     * 기존에 작성한 서식도 노트 데이터에 그대로 저장된다.
     */
    document.execCommand(
      command,
      false,
    );

    const nextSelection =
      window.getSelection();

    if (
      nextSelection &&
      nextSelection.rangeCount > 0
    ) {
      const nextRange =
        nextSelection.getRangeAt(0);

      selectionRangeRef.current =
        nextRange.cloneRange();

      const selectedIds = Array.from(
        editorRoot?.querySelectorAll<HTMLElement>(
          "[data-study-editable-id]",
        ) ?? [],
      )
        .filter((editable) => {
          try {
            return nextRange.intersectsNode(
              editable,
            );
          } catch {
            return false;
          }
        })
        .map(
          (editable) =>
            editable.dataset
              .studyEditableId,
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        );

      if (selectedIds.length > 0) {
        selectedBlockIdsRef.current =
          selectedIds;
      }
    }

    syncSelectedEditableHtml();
    syncPrimaryTextFormatState();
  }

  function applyUnderlineColor(
    color: string,
  ) {
    let selection =
      window.getSelection();

    let range =
      selection &&
      selection.rangeCount > 0
        ? selection.getRangeAt(0)
        : null;

    const editorRoot =
      document.querySelector<HTMLElement>(
        "[data-study-editor-root]",
      );

    if (!editorRoot) {
      return;
    }

    if (
      !range ||
      !editorRoot.contains(
        range.commonAncestorContainer,
      )
    ) {
      const activeBlockId =
        lastSelectedTextBlockIdRef.current;

      if (!activeBlockId) {
        return;
      }

      const editable =
        document.querySelector<HTMLElement>(
          `[data-study-editable-id="${activeBlockId}"]`,
        );

      if (!editable) {
        return;
      }

      editable.focus();

      selection =
        window.getSelection();

      if (!selection) {
        return;
      }

      range =
        document.createRange();

      range.selectNodeContents(
        editable,
      );
      range.collapse(false);

      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (!selection || !range) {
      return;
    }

    const startElement =
      range.startContainer instanceof HTMLElement
        ? range.startContainer
        : range.startContainer.parentElement;

    const endElement =
      range.endContainer instanceof HTMLElement
        ? range.endContainer
        : range.endContainer.parentElement;

    const startEditable =
      startElement?.closest<HTMLElement>(
        "[data-study-editable-id]",
      );

    const endEditable =
      endElement?.closest<HTMLElement>(
        "[data-study-editable-id]",
      );

    if (range.collapsed) {
      if (
        !document.queryCommandState(
          "underline",
        )
      ) {
        document.execCommand(
          "underline",
          false,
        );
      }

      const seed =
        document.createElement(
          "span",
        );

      seed.dataset.hooUnderlineColor =
        "true";
      seed.style.textDecorationLine =
        "underline";
      seed.style.textDecorationColor =
        color;
      seed.style.textDecorationThickness =
        "1px";
      seed.textContent = "\u200B";

      range.insertNode(seed);

      const seedRange =
        document.createRange();

      seedRange.selectNodeContents(
        seed,
      );
      seedRange.collapse(false);

      selection.removeAllRanges();
      selection.addRange(seedRange);

      selectionRangeRef.current =
        seedRange.cloneRange();

      setIsUnderlineFormatActive(
        true,
      );
      setActiveUnderlineColor(color);
      setIsUnderlineColorPaletteOpen(
        false,
      );

      return;
    }

    if (
      startEditable &&
      startEditable === endEditable
    ) {
      const underlineSpan =
        document.createElement(
          "span",
        );

      underlineSpan.dataset.hooUnderlineColor =
        "true";
      underlineSpan.style.textDecorationLine =
        "underline";
      underlineSpan.style.textDecorationColor =
        color;
      underlineSpan.style.textDecorationThickness =
        "1px";

      const fragment =
        range.extractContents();

      underlineSpan.appendChild(
        fragment,
      );

      range.insertNode(
        underlineSpan,
      );

      const selectedRange =
        document.createRange();

      selectedRange.selectNodeContents(
        underlineSpan,
      );

      selection.removeAllRanges();
      selection.addRange(
        selectedRange,
      );

      selectionRangeRef.current =
        selectedRange.cloneRange();

      const editableId =
        startEditable.dataset
          .studyEditableId;

      if (editableId) {
        selectedBlockIdsRef.current = [
          editableId,
        ];
      }

      setIsUnderlineFormatActive(
        true,
      );
      setActiveUnderlineColor(color);
      setIsUnderlineColorPaletteOpen(
        false,
      );

      syncSelectedEditableHtml();

      return;
    }

    if (
      !document.queryCommandState(
        "underline",
      )
    ) {
      document.execCommand(
        "underline",
        false,
      );
    }

    const currentSelection =
      window.getSelection();

    if (
      currentSelection &&
      currentSelection.rangeCount > 0
    ) {
      const currentRange =
        currentSelection.getRangeAt(0);

      editorRoot
        .querySelectorAll<HTMLElement>(
          "u, [data-hoo-underline-color='true']",
        )
        .forEach((element) => {
          try {
            if (
              currentRange.intersectsNode(
                element,
              )
            ) {
              element.style.textDecorationColor =
                color;
              element.style.textDecorationThickness =
                "1px";
            }
          } catch {
            // 선택 범위 밖 요소는 무시
          }
        });

      selectionRangeRef.current =
        currentRange.cloneRange();
    }

    setIsUnderlineFormatActive(
      true,
    );
    setActiveUnderlineColor(color);
    setIsUnderlineColorPaletteOpen(
      false,
    );

    syncSelectedEditableHtml();
  }

  function applyStrikeColor(
    color: string,
  ) {
    let selection =
      window.getSelection();

    let range =
      selection &&
      selection.rangeCount > 0
        ? selection.getRangeAt(0)
        : null;

    const editorRoot =
      document.querySelector<HTMLElement>(
        "[data-study-editor-root]",
      );

    if (!editorRoot) {
      return;
    }

    if (
      !range ||
      !editorRoot.contains(
        range.commonAncestorContainer,
      )
    ) {
      const activeBlockId =
        lastSelectedTextBlockIdRef.current;

      if (!activeBlockId) {
        return;
      }

      const editable =
        document.querySelector<HTMLElement>(
          `[data-study-editable-id="${activeBlockId}"]`,
        );

      if (!editable) {
        return;
      }

      editable.focus();

      selection =
        window.getSelection();

      if (!selection) {
        return;
      }

      range =
        document.createRange();

      range.selectNodeContents(
        editable,
      );
      range.collapse(false);

      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (!selection || !range) {
      return;
    }

    const startElement =
      range.startContainer instanceof HTMLElement
        ? range.startContainer
        : range.startContainer.parentElement;

    const endElement =
      range.endContainer instanceof HTMLElement
        ? range.endContainer
        : range.endContainer.parentElement;

    const startEditable =
      startElement?.closest<HTMLElement>(
        "[data-study-editable-id]",
      );

    const endEditable =
      endElement?.closest<HTMLElement>(
        "[data-study-editable-id]",
      );

    /*
     * 커서 상태:
     * 색상을 고른 시점부터 삭제선이 켜지고,
     * 이후 입력되는 글자도 같은 삭제선 색상을 이어받는다.
     */
    if (range.collapsed) {
      if (
        !document.queryCommandState(
          "strikeThrough",
        )
      ) {
        document.execCommand(
          "strikeThrough",
          false,
        );
      }

      const seed =
        document.createElement(
          "span",
        );

      seed.dataset.hooStrikeColor =
        "true";
      seed.style.textDecorationLine =
        "line-through";
      seed.style.textDecorationColor =
        color;
      seed.style.textDecorationThickness =
        "1px";
      seed.textContent = "\u200B";

      range.insertNode(seed);

      const seedRange =
        document.createRange();

      seedRange.selectNodeContents(
        seed,
      );
      seedRange.collapse(false);

      selection.removeAllRanges();
      selection.addRange(seedRange);

      selectionRangeRef.current =
        seedRange.cloneRange();

      setIsStrikeFormatActive(true);
      setActiveStrikeColor(color);
      setIsStrikeColorPaletteOpen(
        false,
      );

      return;
    }

    /*
     * 한 줄 안에서 드래그한 경우에는 선택 영역만 감싸서
     * 글자색과 독립된 삭제선 색상을 적용한다.
     */
    if (
      startEditable &&
      startEditable === endEditable
    ) {
      const strikeSpan =
        document.createElement(
          "span",
        );

      strikeSpan.dataset.hooStrikeColor =
        "true";
      strikeSpan.style.textDecorationLine =
        "line-through";
      strikeSpan.style.textDecorationColor =
        color;
      strikeSpan.style.textDecorationThickness =
        "1px";

      const fragment =
        range.extractContents();

      strikeSpan.appendChild(fragment);
      range.insertNode(strikeSpan);

      const selectedRange =
        document.createRange();

      selectedRange.selectNodeContents(
        strikeSpan,
      );

      selection.removeAllRanges();
      selection.addRange(
        selectedRange,
      );

      selectionRangeRef.current =
        selectedRange.cloneRange();

      const editableId =
        startEditable.dataset
          .studyEditableId;

      if (editableId) {
        selectedBlockIdsRef.current = [
          editableId,
        ];
      }

      setIsStrikeFormatActive(true);
      setActiveStrikeColor(color);
      setIsStrikeColorPaletteOpen(
        false,
      );

      syncSelectedEditableHtml();

      return;
    }

    /*
     * 여러 줄 선택은 브라우저의 strikeThrough 명령으로
     * 선택 영역에 삭제선을 만든 뒤 생성된 요소에 같은 색을 입힌다.
     */
    if (
      !document.queryCommandState(
        "strikeThrough",
      )
    ) {
      document.execCommand(
        "strikeThrough",
        false,
      );
    }

    const currentSelection =
      window.getSelection();

    if (
      currentSelection &&
      currentSelection.rangeCount > 0
    ) {
      const currentRange =
        currentSelection.getRangeAt(0);

      editorRoot
        .querySelectorAll<HTMLElement>(
          "strike, s, del, [data-hoo-strike-color='true']",
        )
        .forEach((element) => {
          try {
            if (
              currentRange.intersectsNode(
                element,
              )
            ) {
              element.style.textDecorationColor =
                color;
              element.style.textDecorationThickness =
                "1px";
            }
          } catch {
            // 선택 범위 밖 요소는 무시
          }
        });

      selectionRangeRef.current =
        currentRange.cloneRange();
    }

    setIsStrikeFormatActive(true);
    setActiveStrikeColor(color);
    setIsStrikeColorPaletteOpen(false);

    syncSelectedEditableHtml();
  }

  function applyFontColor(
    color: string,
  ) {
    let selection =
      window.getSelection();

    let range =
      selection &&
      selection.rangeCount > 0
        ? selection.getRangeAt(0)
        : null;

    const editorRoot =
      document.querySelector<HTMLElement>(
        "[data-study-editor-root]",
      );

    if (!editorRoot) {
      return;
    }

    if (
      !range ||
      !editorRoot.contains(
        range.commonAncestorContainer,
      )
    ) {
      const activeBlockId =
        lastSelectedTextBlockIdRef.current;

      if (!activeBlockId) {
        return;
      }

      const editable =
        document.querySelector<HTMLElement>(
          `[data-study-editable-id="${activeBlockId}"]`,
        );

      if (!editable) {
        return;
      }

      editable.focus();

      selection =
        window.getSelection();

      if (!selection) {
        return;
      }

      range =
        document.createRange();

      range.selectNodeContents(
        editable,
      );
      range.collapse(false);

      selection.removeAllRanges();
      selection.addRange(range);
    }

    /*
     * 드래그 선택 상태면 선택한 텍스트만 색상을 변경하고,
     * 커서만 있는 상태면 현재 커서 이후 입력되는 글자부터
     * 선택한 색상으로 작성된다.
     */
    document.execCommand(
      "foreColor",
      false,
      color,
    );

    const nextSelection =
      window.getSelection();

    if (
      nextSelection &&
      nextSelection.rangeCount > 0
    ) {
      const nextRange =
        nextSelection.getRangeAt(0);

      selectionRangeRef.current =
        nextRange.cloneRange();

      const selectedIds =
        Array.from(
          editorRoot.querySelectorAll<HTMLElement>(
            "[data-study-editable-id]",
          ),
        )
          .filter((editable) => {
            try {
              return nextRange.intersectsNode(
                editable,
              );
            } catch {
              return false;
            }
          })
          .map(
            (editable) =>
              editable.dataset
                .studyEditableId,
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          );

      if (selectedIds.length > 0) {
        selectedBlockIdsRef.current =
          selectedIds;
      }
    }

    setActiveFontColor(color);
    setIsFontColorPaletteOpen(false);

    syncSelectedEditableHtml();
    syncPrimaryTextFormatState();
  }

  function toggleHighlightFormat() {
    let selection =
      window.getSelection();

    let range =
      selection &&
      selection.rangeCount > 0
        ? selection.getRangeAt(0)
        : null;

    const editorRoot =
      document.querySelector<HTMLElement>(
        "[data-study-editor-root]",
      );

    if (!editorRoot) {
      return;
    }

    if (
      !range ||
      !editorRoot.contains(
        range.commonAncestorContainer,
      )
    ) {
      const activeBlockId =
        lastSelectedTextBlockIdRef.current;

      if (!activeBlockId) {
        return;
      }

      const editable =
        document.querySelector<HTMLElement>(
          `[data-study-editable-id="${activeBlockId}"]`,
        );

      if (!editable) {
        return;
      }

      editable.focus();

      selection =
        window.getSelection();

      if (!selection) {
        return;
      }

      range =
        document.createRange();

      range.selectNodeContents(
        editable,
      );
      range.collapse(false);

      selection.removeAllRanges();
      selection.addRange(range);
    }

    const currentHighlight =
      String(
        document.queryCommandValue(
          "hiliteColor",
        ) || "",
      ).trim();

    const shouldTurnOff =
      isHighlightColorActive(
        currentHighlight,
      );

    /*
     * 굵게와 동일한 동작:
     * - 드래그 선택 상태: 선택 영역만 형광펜 토글
     * - 커서 상태: 그 시점부터 입력되는 텍스트에 형광펜 토글
     * - 다시 누르면 해당 시점부터 형광펜 해제
     */
    const nextColor =
      shouldTurnOff
        ? "transparent"
        : HIGHLIGHT_COLOR;

    const applied =
      document.execCommand(
        "hiliteColor",
        false,
        nextColor,
      );

    if (!applied) {
      document.execCommand(
        "backColor",
        false,
        nextColor,
      );
    }

    const nextSelection =
      window.getSelection();

    if (
      nextSelection &&
      nextSelection.rangeCount > 0
    ) {
      const nextRange =
        nextSelection.getRangeAt(0);

      selectionRangeRef.current =
        nextRange.cloneRange();

      const selectedIds =
        Array.from(
          editorRoot.querySelectorAll<HTMLElement>(
            "[data-study-editable-id]",
          ),
        )
          .filter((editable) => {
            try {
              return nextRange.intersectsNode(
                editable,
              );
            } catch {
              return false;
            }
          })
          .map(
            (editable) =>
              editable.dataset
                .studyEditableId,
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          );

      if (selectedIds.length > 0) {
        selectedBlockIdsRef.current =
          selectedIds;
      }
    }

    setIsHighlightFormatActive(
      !shouldTurnOff,
    );

    syncSelectedEditableHtml();
  }

  function normalizeFontSizeMarkup(
    root: HTMLElement,
    fontSize: number,
  ) {
    /*
     * execCommand("fontSize")는 1~7 단계만 지원하므로
     * 임시 size="7" 태그를 만든 뒤 정확한 px 값으로 변환한다.
     */
    root
      .querySelectorAll<HTMLElement>(
        'font[size="7"]',
      )
      .forEach((element) => {
        element.style.fontSize =
          `${fontSize}px`;
        element.removeAttribute(
          "size",
        );
      });
  }

  function applyFontSize(
    fontSize: number,
  ) {
    let selection =
      window.getSelection();

    let range =
      selection &&
      selection.rangeCount > 0
        ? selection.getRangeAt(0)
        : null;

    const editorRoot =
      document.querySelector<HTMLElement>(
        "[data-study-editor-root]",
      );

    if (!editorRoot) {
      return;
    }

    if (
      !range ||
      !editorRoot.contains(
        range.commonAncestorContainer,
      )
    ) {
      const activeBlockId =
        lastSelectedTextBlockIdRef.current;

      if (!activeBlockId) {
        return;
      }

      const editable =
        document.querySelector<HTMLElement>(
          `[data-study-editable-id="${activeBlockId}"]`,
        );

      if (!editable) {
        return;
      }

      editable.focus();

      selection =
        window.getSelection();

      if (!selection) {
        return;
      }

      range =
        document.createRange();

      range.selectNodeContents(
        editable,
      );
      range.collapse(false);

      selection.removeAllRanges();
      selection.addRange(range);
    }

    /*
     * 굵게 기능과 같은 동작 규칙:
     * 1) 드래그 선택 상태 -> 선택한 글자만 즉시 크기 변경
     * 2) 커서만 있는 상태 -> 그 시점 이후 입력되는 글자부터 크기 변경
     * 3) 이미 작성된 다른 크기의 글자는 그대로 유지
     */
    activeFontSizeRef.current =
      fontSize;
    typingFontSizeRef.current =
      fontSize;
    setActiveFontSize(fontSize);

    document.execCommand(
      "styleWithCSS",
      false,
      "false",
    );

    document.execCommand(
      "fontSize",
      false,
      "7",
    );

    const nextSelection =
      window.getSelection();

    if (
      nextSelection &&
      nextSelection.rangeCount > 0
    ) {
      const nextRange =
        nextSelection.getRangeAt(0);

      const affectedEditables =
        Array.from(
          editorRoot.querySelectorAll<HTMLElement>(
            "[data-study-editable-id]",
          ),
        ).filter((editable) => {
          try {
            return nextRange.intersectsNode(
              editable,
            );
          } catch {
            return false;
          }
        });

      affectedEditables.forEach(
        (editable) =>
          normalizeFontSizeMarkup(
            editable,
            fontSize,
          ),
      );

      const selectedIds =
        affectedEditables
          .map(
            (editable) =>
              editable.dataset
                .studyEditableId,
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          );

      if (selectedIds.length > 0) {
        selectedBlockIdsRef.current =
          selectedIds;
      }

      selectionRangeRef.current =
        nextRange.cloneRange();
    }

    setIsFontSizeMenuOpen(false);

    /*
     * 선택 영역에 실제 DOM 변경이 생긴 경우에는 바로 노트 HTML에 저장한다.
     * 커서 상태에서는 다음 입력의 onInput에서 정확한 px 값으로 저장된다.
     */
    syncSelectedEditableHtml();
  }

  function addAnnotation() {
    const blockId =
      lastSelectedTextBlockIdRef.current;

    const savedRange =
      selectionRangeRef.current;

    const quote =
      savedRange
        ?.toString()
        .trim() ?? "";

    if (!blockId || !savedRange || !quote) {
      window.alert(
        "주석을 연결할 내용을 먼저 드래그해 주세요.",
      );
      return;
    }

    const editable =
      document.querySelector<HTMLElement>(
        `[data-study-editable-id="${blockId}"]`,
      );

    if (!editable) {
      return;
    }

    const editableRect =
      editable.getBoundingClientRect();

    const selectionRect =
      savedRange.getBoundingClientRect();

    const selectionCenterX =
      selectionRect.left +
      selectionRect.width / 2;

    const anchorPercent =
      editableRect.width > 0
        ? Math.min(
            84,
            Math.max(
              3,
              ((selectionCenterX -
                editableRect.left) /
                editableRect.width) *
                100,
            ),
          )
        : 50;

    /*
     * 드래그한 문장의 가로 중앙 위치를 저장한다.
     * 주석 줄의 화살표는 이 위치 바로 아래에 표시된다.
     */
    updateBlock(
      blockId,
      (block) =>
        block.type === "text"
          ? {
              ...block,
              annotation: {
                quote,
                text:
                  block.annotation
                    ?.text ?? "",
                anchorPercent,
              },
            }
          : block,
    );

    window.setTimeout(() => {
      document
        .querySelector<HTMLInputElement>(
          `[data-study-annotation-id="${blockId}"]`,
        )
        ?.focus();
    }, 0);
  }

  function handleAnnotationKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    block: StudyTextBlock,
  ) {
    if (
      event.key !== "Enter" ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    /*
     * 큰 폰트가 들어간 한 줄은 scrollHeight 때문에
     * 실제로 한 줄인데도 block.units가 2~3줄로 남을 수 있다.
     * 주석에서 Enter를 누를 때 실제 렌더된 텍스트 줄 수를 다시 계산해서
     * 주석 아래에 불필요한 빈 줄이 생기지 않게 정리한다.
     */
    const editable =
      document.querySelector<HTMLElement>(
        `[data-study-editable-id="${block.id}"]`,
      );

    let visualLineUnits = 1;

    if (editable) {
      const measureRange =
        document.createRange();

      measureRange.selectNodeContents(
        editable,
      );

      const lineTops: number[] = [];

      Array.from(
        measureRange.getClientRects(),
      ).forEach((rect) => {
        if (
          rect.width <= 0 ||
          rect.height <= 0
        ) {
          return;
        }

        const top =
          Math.round(rect.top);

        if (
          !lineTops.some(
            (value) =>
              Math.abs(
                value - top,
              ) <= 2,
          )
        ) {
          lineTops.push(top);
        }
      });

      visualLineUnits =
        Math.max(
          1,
          lineTops.length,
        );
    }

    updateBlock(
      block.id,
      (currentBlock) =>
        currentBlock.type === "text"
          ? {
              ...currentBlock,
              units:
                visualLineUnits,
            }
          : currentBlock,
    );

    /*
     * units가 먼저 정리되어 화면 간격이 재배치된 뒤
     * 바로 다음 활성 본문 줄로 이동한다.
     */
    window.setTimeout(() => {
      if (
        focusAdjacentEditableTextBlock(
          block.id,
          "next",
        )
      ) {
        return;
      }

      /*
       * 다음 활성 줄이 아직 없다면 주석 바로 다음 위치에
       * 새 본문 한 줄을 만든다.
       */
      const nextBlock =
        createTextBlock();

      updateSelectedNote((note) => {
        const targetIndex =
          note.blocks.findIndex(
            (item) =>
              item.id === block.id,
          );

        if (targetIndex < 0) {
          return note;
        }

        const nextBlocks = [
          ...note.blocks,
        ];

        nextBlocks.splice(
          targetIndex + 1,
          0,
          nextBlock,
        );

        return {
          ...note,
          blocks: nextBlocks,
        };
      });

      window.setTimeout(() => {
        focusTextBlock(
          nextBlock.id,
          "start",
        );
      }, 0);
    }, 0);
  }

  function estimateImageUnits(
    widthPercent: number,
    aspectRatio: number,
    pageBody?: HTMLElement | null,
  ) {
    const targetPageBody =
      pageBody ??
      document.querySelector<HTMLElement>(
        "[data-study-page-body='true']",
      );

    const pageWidth =
      targetPageBody?.clientWidth ??
      720;

    const usableWidth =
      Math.max(240, pageWidth - 80);

    const imageWidth =
      usableWidth *
      (Math.min(
        100,
        Math.max(10, widthPercent),
      ) /
        100);

    const imageHeight =
      imageWidth /
      Math.max(0.15, aspectRatio);

    return Math.min(
      PAGE_LINE_LIMIT,
      Math.max(
        4,
        Math.ceil(
          (imageHeight + 8) /
            ROW_HEIGHT,
        ),
      ),
    );
  }

  async function insertImageForResize(
    file: File,
    alt = file.name || "붙여넣은 사진",
  ) {
    if (!selectedNote) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      window.alert("이미지 파일만 넣을 수 있어요.");
      return;
    }

    try {
      const src = await compressImage(file);
      const aspectRatio =
        await getImageAspectRatio(src);
      const widthPercent = 65;
      const afterBlockId =
        lastSelectedTextBlockIdRef.current;

      const activeEditable =
        afterBlockId
          ? document.querySelector<HTMLElement>(
              `[data-study-editable-id="${afterBlockId}"]`,
            )
          : null;

      const activePageBody =
        activeEditable?.closest<HTMLElement>(
          "[data-study-page-body='true']",
        ) ??
        document.querySelector<HTMLElement>(
          "[data-study-page-body='true']",
        );

      const pageRect =
        activePageBody?.getBoundingClientRect();

      const editableRect =
        activeEditable?.getBoundingClientRect();

      const pageAnchorIndex =
        Math.max(
          0,
          Number(
            activePageBody?.dataset
              .studyPageIndex ??
              0,
          ) || 0,
        );

      const positionXPercent =
        pageRect && editableRect
          ? Math.max(
              0,
              Math.min(
                90,
                ((editableRect.left -
                  pageRect.left) /
                  Math.max(
                    1,
                    pageRect.width,
                  )) *
                  100,
              ),
            )
          : 7;

      const editorScale =
        Math.max(
          0.01,
          editorPageZoom,
        );

      const positionYPx =
        pageRect && editableRect
          ? Math.max(
              0,
              (editableRect.bottom -
                pageRect.top) /
                editorScale,
            )
          : 0;

      const imageBlock: StudyImageBlock = {
        id: createId(),
        type: "image",
        src,
        alt,
        size: "medium",
        widthPercent,
        aspectRatio,
        layout: "free",
        positionXPercent,
        positionYPx,
        pageAnchorIndex,
        units: estimateImageUnits(
          widthPercent,
          aspectRatio,
        ),
      };

      updateSelectedNote((note) => {
        const nextBlocks = [
          ...note.blocks,
        ];

        const targetIndex =
          afterBlockId
            ? nextBlocks.findIndex(
                (block) =>
                  block.id ===
                  afterBlockId,
              )
            : nextBlocks.length - 1;

        nextBlocks.splice(
          Math.max(
            0,
            targetIndex + 1,
          ),
          0,
          imageBlock,
        );

        return {
          ...note,
          blocks: nextBlocks,
        };
      });

      /*
       * 붙여넣는 순간 페이지 안에 사진을 바로 표시하고 선택 상태로 만든다.
       * 별도의 설정 모달은 열지 않는다.
       */
      setSelectedImageDeleteTarget(null);
      setResizingImageTarget({
        noteId: selectedNote.id,
        blockId: imageBlock.id,
      });

      window.setTimeout(() => {
        document
          .querySelector<HTMLElement>(
            `[data-study-image-wrapper-id="${imageBlock.id}"]`,
          )
          ?.scrollIntoView({
            block: "nearest",
          });
      }, 0);
    } catch (error) {
      console.error(
        "HOO터디 노트 이미지 처리 실패:",
        error,
      );
      window.alert("사진을 불러오지 못했어요.");
    }
  }

  async function handleImageChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    await insertImageForResize(file);
  }

  async function handleEditorPaste(
    event: ClipboardEvent<HTMLDivElement>,
  ) {
    if (!selectedNote) {
      return;
    }

    const clipboardItems =
      event.clipboardData.items;

    let imageItem:
      | DataTransferItem
      | null = null;

    for (
      let index = 0;
      index < clipboardItems.length;
      index += 1
    ) {
      const item =
        clipboardItems[index];

      if (
        item.type.startsWith(
          "image/",
        )
      ) {
        imageItem = item;
        break;
      }
    }

    if (!imageItem) {
      return;
    }

    const file =
      imageItem.getAsFile();

    if (!file) {
      return;
    }

    /*
     * contentEditable 내부의 브라우저 기본 이미지 붙여넣기는 막고,
     * 현재 활성 줄 다음에 HOO 이미지 블록으로 바로 삽입한다.
     */
    event.preventDefault();
    event.stopPropagation();

    await insertImageForResize(
      file,
      `스크린캡쳐-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.png`,
    );
  }

  function getFreeImageTextWrapStyle(
    pageBlocks: StudyBlock[],
    textBlock: StudyTextBlock,
  ): CSSProperties {
    let flowUnitsBeforeText = 0;

    for (const pageBlock of pageBlocks) {
      if (pageBlock.id === textBlock.id) {
        break;
      }

      if (
        pageBlock.type === "image" &&
        (
          pageBlock.layout === "free" ||
          pageBlock.layout === "float-right"
        )
      ) {
        continue;
      }

      flowUnitsBeforeText +=
        getBlockUnits(pageBlock);
    }

    const textTop =
      flowUnitsBeforeText *
      ROW_HEIGHT;
    const textBottom =
      textTop +
      getBlockUnits(textBlock) *
        ROW_HEIGHT;

    const occupiedIntervals = pageBlocks
      .filter(
        (
          pageBlock,
        ): pageBlock is StudyImageBlock =>
          pageBlock.type === "image" &&
          pageBlock.layout === "free",
      )
      .filter((imageBlock) => {
        const imageTop =
          imageBlock.positionYPx ?? 0;
        const imageBottom =
          imageTop +
          Math.max(
            ROW_HEIGHT,
            imageBlock.units *
              ROW_HEIGHT,
          );

        return (
          imageBottom > textTop &&
          imageTop < textBottom
        );
      })
      .map((imageBlock) => {
        const gapPercent = 1.5;
        const left =
          Math.max(
            0,
            (imageBlock.positionXPercent ??
              0) -
              gapPercent,
          );
        const right =
          Math.min(
            100,
            left +
              (imageBlock.widthPercent ??
                65) +
              gapPercent * 2,
          );

        return {
          left,
          right,
        };
      })
      .sort(
        (first, second) =>
          first.left - second.left,
      );

    if (
      occupiedIntervals.length === 0
    ) {
      return {};
    }

    const mergedIntervals: Array<{
      left: number;
      right: number;
    }> = [];

    for (const interval of occupiedIntervals) {
      const previous =
        mergedIntervals.at(-1);

      if (
        previous &&
        interval.left <=
          previous.right
      ) {
        previous.right =
          Math.max(
            previous.right,
            interval.right,
          );
        continue;
      }

      mergedIntervals.push({
        ...interval,
      });
    }

    const freeSegments: Array<{
      left: number;
      right: number;
    }> = [];

    let cursor = 0;

    for (const interval of mergedIntervals) {
      if (interval.left > cursor) {
        freeSegments.push({
          left: cursor,
          right: interval.left,
        });
      }

      cursor =
        Math.max(
          cursor,
          interval.right,
        );
    }

    if (cursor < 100) {
      freeSegments.push({
        left: cursor,
        right: 100,
      });
    }

    const widestSegment =
      freeSegments.sort(
        (first, second) =>
          second.right -
          second.left -
          (first.right -
            first.left),
      )[0];

    /*
     * 사진 때문에 남는 가로 여백이 너무 좁으면
     * 억지로 한두 글자 폭을 만들지 않는다.
     */
    if (
      !widestSegment ||
      widestSegment.right -
        widestSegment.left <
        12
    ) {
      return {};
    }

    return {
      boxSizing: "border-box",
      paddingLeft:
        widestSegment.left > 0
          ? `${widestSegment.left}%`
          : undefined,
      paddingRight:
        widestSegment.right < 100
          ? `${
              100 -
              widestSegment.right
            }%`
          : undefined,
    };
  }

  function handleImageBlockMovePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    block: StudyImageBlock,
  ) {
    if (
      event.button !== 0 ||
      block.layout !== "free"
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const figure =
      document.querySelector<HTMLElement>(
        `[data-study-image-figure-id="${block.id}"]`,
      );

    const pageBody =
      figure?.closest<HTMLElement>(
        "[data-study-page-body='true']",
      );

    if (!figure || !pageBody) {
      return;
    }

    /*
     * 사진 위치값은 브라우저에 보이는 확대된 픽셀이 아니라
     * 항상 100% 페이지의 논리 좌표로 저장한다.
     * 따라서 이후 줌인/줌아웃해도 사진이 텍스트와 섞이거나
     * 페이지 안에서 위치가 변하지 않는다.
     */
    const movableFigure = figure;
    const visualScale =
      Math.max(
        0.01,
        editorPageZoom,
      );

    const pageWidth =
      Math.max(
        1,
        pageBody.clientWidth,
      );

    const figureWidth =
      Math.max(
        1,
        movableFigure.offsetWidth,
      );

    const figureHeight =
      Math.max(
        1,
        movableFigure.offsetHeight,
      );

    const pageRect =
      pageBody.getBoundingClientRect();

    const figureRect =
      movableFigure.getBoundingClientRect();

    const startX = event.clientX;
    const startY = event.clientY;

    const startLeft =
      Number.isFinite(
        block.positionXPercent,
      )
        ? ((
            block.positionXPercent ??
            0
          ) /
            100) *
          pageWidth
        : (figureRect.left -
            pageRect.left) /
          visualScale;

    const startTop =
      Number.isFinite(
        block.positionYPx,
      )
        ? block.positionYPx ?? 0
        : (figureRect.top -
            pageRect.top) /
          visualScale;

    let latestXPercent =
      (startLeft /
        pageWidth) *
      100;

    let latestYPx =
      startTop;

    function updatePreview(
      clientX: number,
      clientY: number,
    ) {
      const deltaX =
        (clientX - startX) /
        visualScale;

      const deltaY =
        (clientY - startY) /
        visualScale;

      const nextLeft =
        Math.min(
          Math.max(
            0,
            pageWidth -
              figureWidth,
          ),
          Math.max(
            0,
            startLeft +
              deltaX,
          ),
        );

      const pageHeight =
        PAGE_LINE_LIMIT *
        ROW_HEIGHT;

      const nextTop =
        Math.min(
          Math.max(
            0,
            pageHeight -
              figureHeight,
          ),
          Math.max(
            0,
            startTop +
              deltaY,
          ),
        );

      latestXPercent =
        (nextLeft /
          pageWidth) *
        100;

      latestYPx =
        nextTop;

      movableFigure.style.left =
        `${latestXPercent}%`;

      movableFigure.style.top =
        `${latestYPx}px`;
    }

    function handleMove(
      moveEvent: PointerEvent,
    ) {
      moveEvent.preventDefault();

      updatePreview(
        moveEvent.clientX,
        moveEvent.clientY,
      );
    }

    function handleUp(
      upEvent: PointerEvent,
    ) {
      updatePreview(
        upEvent.clientX,
        upEvent.clientY,
      );

      window.removeEventListener(
        "pointermove",
        handleMove,
      );
      window.removeEventListener(
        "pointerup",
        handleUp,
      );
      window.removeEventListener(
        "pointercancel",
        handleCancel,
      );

      updateBlock(
        block.id,
        (currentBlock) =>
          currentBlock.type === "image"
            ? {
                ...currentBlock,
                layout: "free",
                positionXPercent:
                  latestXPercent,
                positionYPx:
                  latestYPx,
              }
            : currentBlock,
      );
    }

    function handleCancel() {
      movableFigure.style.left =
        `${
          block.positionXPercent ??
          7
        }%`;

      movableFigure.style.top =
        `${
          block.positionYPx ??
          0
        }px`;

      window.removeEventListener(
        "pointermove",
        handleMove,
      );
      window.removeEventListener(
        "pointerup",
        handleUp,
      );
      window.removeEventListener(
        "pointercancel",
        handleCancel,
      );
    }

    window.addEventListener(
      "pointermove",
      handleMove,
      { passive: false },
    );

    window.addEventListener(
      "pointerup",
      handleUp,
    );

    window.addEventListener(
      "pointercancel",
      handleCancel,
    );
  }

  function handleImageBlockResizePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    block: StudyImageBlock,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const wrapper =
      document.querySelector<HTMLElement>(
        `[data-study-image-wrapper-id="${block.id}"]`,
      );

    const figure =
      document.querySelector<HTMLElement>(
        `[data-study-image-figure-id="${block.id}"]`,
      );

    if (!wrapper || !figure) {
      return;
    }

    const pageBody =
      wrapper.closest<HTMLElement>(
        "[data-study-page-body='true']",
      );

    if (!pageBody) {
      return;
    }

    const pageRect =
      pageBody.getBoundingClientRect();

    /*
     * free 배치 사진은 실제 폭을 figure가 가지고 있으므로
     * wrapper가 아니라 figure 자체를 늘려야 페이지 전체 폭까지 커진다.
     */
    const resizeElement =
      block.layout === "free"
        ? figure
        : wrapper;

    const resizeRect =
      resizeElement.getBoundingClientRect();

    const fixedLeft =
      resizeRect.left;

    const availablePixelWidth =
      Math.max(
        pageRect.width * 0.1,
        pageRect.right -
          fixedLeft -
          4,
      );

    const maxWidthPercent =
      Math.min(
        100,
        (availablePixelWidth /
          Math.max(
            1,
            pageRect.width,
          )) *
          100,
      );

    let latestWidthPercent =
      Math.min(
        maxWidthPercent,
        Math.max(
          10,
          block.widthPercent ?? 65,
        ),
      );

    const updatePreview = (
      clientX: number,
    ) => {
      const pixelWidth =
        Math.min(
          availablePixelWidth,
          Math.max(
            pageRect.width * 0.1,
            clientX - fixedLeft,
          ),
        );

      latestWidthPercent =
        Math.min(
          maxWidthPercent,
          Math.max(
            10,
            (pixelWidth /
              Math.max(
                1,
                pageRect.width,
              )) *
              100,
          ),
        );

      resizeElement.style.width =
        `${latestWidthPercent}%`;
    };

    function handleMove(
      moveEvent: PointerEvent,
    ) {
      moveEvent.preventDefault();

      updatePreview(
        moveEvent.clientX,
      );
    }

    function handleUp(
      upEvent: PointerEvent,
    ) {
      updatePreview(
        upEvent.clientX,
      );

      window.removeEventListener(
        "pointermove",
        handleMove,
      );
      window.removeEventListener(
        "pointerup",
        handleUp,
      );
      window.removeEventListener(
        "pointercancel",
        handleCancel,
      );

      const aspectRatio =
        block.aspectRatio ?? 1;

      updateBlock(
        block.id,
        (currentBlock) =>
          currentBlock.type === "image"
            ? {
                ...currentBlock,
                widthPercent:
                  latestWidthPercent,
                aspectRatio,
                layout:
                  currentBlock.layout ===
                  "free"
                    ? "free"
                    : latestWidthPercent <=
                        48
                      ? "float-right"
                      : "block",
                units:
                  estimateImageUnits(
                    latestWidthPercent,
                    aspectRatio,
                    pageBody,
                  ),
              }
            : currentBlock,
      );
    }

    function handleCancel() {
      resizeElement.style.width =
        `${block.widthPercent ?? 65}%`;

      window.removeEventListener(
        "pointermove",
        handleMove,
      );
      window.removeEventListener(
        "pointerup",
        handleUp,
      );
      window.removeEventListener(
        "pointercancel",
        handleCancel,
      );
    }

    window.addEventListener(
      "pointermove",
      handleMove,
      { passive: false },
    );
    window.addEventListener(
      "pointerup",
      handleUp,
    );
    window.addEventListener(
      "pointercancel",
      handleCancel,
    );
  }

  function finishImageResizeMode() {
    setResizingImageTarget(null);
  }

  function handleEditorPointerDownCapture(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const target =
      event.target as HTMLElement;

    if (resizingImageTarget) {
      const resizeWrapper =
        target.closest(
          `[data-study-image-wrapper-id="${resizingImageTarget.blockId}"]`,
        );

      if (!resizeWrapper) {
        finishImageResizeMode();
      }
    }

    if (selectedImageDeleteTarget) {
      const selectedWrapper =
        target.closest(
          `[data-study-image-wrapper-id="${selectedImageDeleteTarget.blockId}"]`,
        );

      if (!selectedWrapper) {
        setSelectedImageDeleteTarget(null);
      }
    }
  }

  function selectAllTextInCurrentPage(
    eventTarget: EventTarget | null,
  ) {
    const target =
      eventTarget instanceof HTMLElement
        ? eventTarget
        : null;

    const pageBody =
      target?.closest<HTMLElement>(
        "[data-study-page-body='true']",
      );

    if (!pageBody) {
      return false;
    }

    const editables = Array.from(
      pageBody.querySelectorAll<HTMLElement>(
        "[data-study-editable-id]",
      ),
    );

    if (editables.length === 0) {
      return false;
    }

    const firstEditable =
      editables[0];
    const lastEditable =
      editables[
        editables.length - 1
      ];

    const range =
      document.createRange();

    /*
     * 한 줄짜리 contentEditable마다 Ctrl+A가 끊기지 않도록
     * 현재 페이지의 첫 줄부터 마지막 줄까지 하나의 Selection으로 묶는다.
     */
    range.setStartBefore(
      firstEditable,
    );
    range.setEndAfter(
      lastEditable,
    );

    const selection =
      window.getSelection();

    if (!selection) {
      return false;
    }

    selection.removeAllRanges();
    selection.addRange(range);

    const selectedIds =
      editables
        .map(
          (editable) =>
            editable.dataset
              .studyEditableId,
        )
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        );

    selectionRangeRef.current =
      range.cloneRange();
    selectedBlockIdsRef.current =
      selectedIds;
    lastSelectedTextBlockIdRef.current =
      selectedIds[0] ?? null;

    return true;
  }

  function deleteCurrentEditorSelection() {
    const selection =
      window.getSelection();

    if (
      !selection ||
      selection.rangeCount === 0 ||
      selection.isCollapsed
    ) {
      return false;
    }

    const range =
      selection.getRangeAt(0);

    const editorRoot =
      document.querySelector<HTMLElement>(
        "[data-study-editor-root]",
      );

    if (
      !editorRoot ||
      !editorRoot.contains(
        range.commonAncestorContainer,
      )
    ) {
      return false;
    }

    const selectedEditables =
      Array.from(
        editorRoot.querySelectorAll<HTMLElement>(
          "[data-study-editable-id]",
        ),
      ).filter((editable) => {
        try {
          return range.intersectsNode(
            editable,
          );
        } catch {
          return false;
        }
      });

    if (
      selectedEditables.length === 0
    ) {
      return false;
    }

    const firstEditable =
      selectedEditables[0];

    const deletedHtmlById =
      new Map<string, string>();

    for (
      const editable of
      selectedEditables
    ) {
      const editableId =
        editable.dataset
          .studyEditableId;

      if (!editableId) {
        continue;
      }

      const localRange =
        document.createRange();

      localRange.selectNodeContents(
        editable,
      );

      if (
        editable.contains(
          range.startContainer,
        )
      ) {
        localRange.setStart(
          range.startContainer,
          range.startOffset,
        );
      }

      if (
        editable.contains(
          range.endContainer,
        )
      ) {
        localRange.setEnd(
          range.endContainer,
          range.endOffset,
        );
      }

      localRange.deleteContents();

      const normalizedHtml =
        editable.innerHTML === "<br>"
          ? ""
          : editable.innerHTML;

      if (
        normalizedHtml !==
        editable.innerHTML
      ) {
        editable.innerHTML =
          normalizedHtml;
      }

      deletedHtmlById.set(
        editableId,
        normalizedHtml,
      );
    }

    /*
     * 여러 줄을 선택해도 note 업데이트는 한 번만 수행한다.
     * 그래서 Ctrl+Z 역시 한 번에 선택 삭제 전체를 되돌린다.
     */
    updateSelectedNote((note) => ({
      ...note,
      blocks: note.blocks.map(
        (block) => {
          if (
            block.type !== "text"
          ) {
            return block;
          }

          const nextHtml =
            deletedHtmlById.get(
              block.id,
            );

          if (
            nextHtml === undefined
          ) {
            return block;
          }

          return {
            ...block,
            html: nextHtml,
            units: 1,
          };
        },
      ),
    }));

    const firstId =
      firstEditable.dataset
        .studyEditableId;

    if (firstId) {
      lastSelectedTextBlockIdRef.current =
        firstId;
      selectedBlockIdsRef.current = [
        firstId,
      ];
    }

    firstEditable.focus();

    const nextSelection =
      window.getSelection();

    if (nextSelection) {
      const nextRange =
        document.createRange();

      nextRange.selectNodeContents(
        firstEditable,
      );
      nextRange.collapse(false);

      nextSelection.removeAllRanges();
      nextSelection.addRange(
        nextRange,
      );

      selectionRangeRef.current =
        nextRange.cloneRange();
    }

    return true;
  }

  function handleEditorKeyDownCapture(
    event: KeyboardEvent<HTMLDivElement>,
  ) {
    const hasCommandKey =
      event.ctrlKey ||
      event.metaKey;

    const isUndoShortcut =
      hasCommandKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === "z";

    if (isUndoShortcut) {
      event.preventDefault();
      event.stopPropagation();
      undoSelectedNote();
      return;
    }

    const isSelectAllShortcut =
      hasCommandKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === "a";

    if (
      isSelectAllShortcut &&
      selectAllTextInCurrentPage(
        event.target,
      )
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const isSelectionDeleteKey =
      event.key === "Backspace" ||
      event.key === "Delete";

    if (
      isSelectionDeleteKey &&
      deleteCurrentEditorSelection()
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (
      resizingImageTarget &&
      event.key === "Enter"
    ) {
      event.preventDefault();
      event.stopPropagation();
      finishImageResizeMode();
    }
  }

  async function syncStudyNotes(
    preferredLocalNotes?: StudyNoteRecord[],
  ) {
    if (!isHydrated || !navigator.onLine) {
      return;
    }

    if (syncInProgressRef.current) {
      syncQueuedRef.current = true;
      return;
    }

    syncInProgressRef.current = true;
    syncQueuedRef.current = false;
    setSaveLabel("동기화 중...");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setSaveLabel("로그인 후 동기화");
        return;
      }

      const userId = user.id;

      const sourceNotes =
        preferredLocalNotes ??
        (notesRef.current.length > 0
          ? notesRef.current
          : await loadNotesFromIndexedDb());

      /*
       * 예전 로컬 기록에 UUID가 아닌 id가 남아 있으면
       * Supabase uuid PK에 insert가 실패한다.
       * 서버에 올리기 전에 로컬 id를 안전한 UUID로 정규화한다.
       */
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      const idMap = new Map<string, string>();

      const normalizedLocalNotes = sourceNotes.map((note) => {
        if (uuidPattern.test(note.id)) {
          return note;
        }

        const nextId = crypto.randomUUID();
        idMap.set(note.id, nextId);

        return {
          ...note,
          id: nextId,
          blocks: note.blocks.map((block) => ({
            ...block,
            id:
              uuidPattern.test(block.id)
                ? block.id
                : crypto.randomUUID(),
          })) as StudyBlock[],
          updatedAt: new Date().toISOString(),
          version: Math.max(1, Number(note.version) || 1) + 1,
        };
      });

      if (idMap.size > 0) {
        notesRef.current = normalizedLocalNotes;
        await replaceNotesInIndexedDb(normalizedLocalNotes);

        setNotes(normalizedLocalNotes);

        setSelectedNoteId((previousId) => {
          if (!previousId) {
            return normalizedLocalNotes[0]?.id ?? null;
          }

          return idMap.get(previousId) ?? previousId;
        });
      }

      const currentTombstones = await loadStudyNoteTombstones();
      const remainingTombstones: StudyNoteTombstone[] = [];

      for (const tombstone of currentTombstones) {
        /*
         * UUID가 아닌 옛 삭제 ID는 서버에 존재할 수 없으므로 로컬에서 정리한다.
         */
        if (!uuidPattern.test(tombstone.id)) {
          continue;
        }

        const { error: deleteError } = await supabase
          .from("hoo_study_notes")
          .update({
            deleted_at: tombstone.deletedAt,
          })
          .eq("user_id", userId)
          .eq("id", tombstone.id);

        if (deleteError) {
          remainingTombstones.push(tombstone);
          console.warn("HOO터디 노트 삭제 동기화 대기:", {
            id: tombstone.id,
            message: deleteError.message,
            code: deleteError.code,
          });
        }
      }

      let pushedCount = 0;
      let failedCount = 0;
      let firstFailureMessage = "";

      const syncedNotes: StudyNoteRecord[] = [];

      for (const note of normalizedLocalNotes) {
        try {
          const localBlocks: StudyBlock[] = [];
          const remoteBlocks: Array<Record<string, unknown>> = [];

          for (const block of note.blocks) {
            if (block.type === "text") {
              localBlocks.push(block);
              remoteBlocks.push({
                id: block.id,
                type: "text",
                html: block.html,
                units: block.units,
                brace: block.brace,
                annotation: block.annotation,
              });
              continue;
            }

            let storagePath = block.storagePath;

            if (!storagePath && block.src.startsWith("data:")) {
              const candidatePath =
                `${userId}/${note.id}/${block.id}.jpg`;

              try {
                const imageBlob = dataUrlToBlob(block.src);

                const { error: uploadError } = await supabase.storage
                  .from("hoo-study-note-images")
                  .upload(candidatePath, imageBlob, {
                    upsert: true,
                    contentType: imageBlob.type || "image/jpeg",
                  });

                if (!uploadError) {
                  storagePath = candidatePath;
                } else {
                  console.warn("HOO터디 노트 사진 동기화 대기:", {
                    noteId: note.id,
                    blockId: block.id,
                    message: uploadError.message,
                  });
                }
              } catch (imageError) {
                console.warn(
                  "HOO터디 노트 사진 동기화 대기:",
                  imageError,
                );
              }
            }

            localBlocks.push({
              ...block,
              storagePath,
            });

            if (storagePath) {
              remoteBlocks.push({
                id: block.id,
                type: "image",
                alt: block.alt,
                size: block.size,
                units: block.units,
                widthPercent:
                  block.widthPercent,
                aspectRatio:
                  block.aspectRatio,
                layout:
                  block.layout,
                positionXPercent:
                  block.positionXPercent,
                positionYPx:
                  block.positionYPx,
                pageAnchorIndex:
                  block.pageAnchorIndex,
                storagePath,
              });
            }
          }

          /*
           * 마지막 페이지는 본문 blocks와 분리해서 작성하지만,
           * 서버에는 blocks 배열의 가장 마지막 객체로 넣는다.
           * 따라서 본문 페이지가 늘어나도 항상 파일의 최종 페이지로 유지된다.
           */
          remoteBlocks.push({
            id: `${note.id}-last-page`,
            type: "last-page",
            html: note.lastPageHtml ?? "",
            role: "last-page",
          });

          /*
           * merge 판단보다 먼저 현재 로컬 노트를 확실히 upsert한다.
           * 이어서 select("id")를 받아 실제 DB 반영까지 검증한다.
           */
          const nextVersion = Math.max(
            1,
            Number(note.version) || 1,
          );

          const {
            data: verifiedRow,
            error: upsertError,
          } = await supabase
            .from("hoo_study_notes")
            .upsert(
              {
                id: note.id,
                user_id: userId,
                note_date: note.date,
                title: note.title,
                category: note.category,
                blocks: remoteBlocks,
                version: nextVersion,
                deleted_at: null,
              },
              { onConflict: "id" },
            )
            .select("id")
            .single();

          if (upsertError) {
            throw upsertError;
          }

          if (!verifiedRow?.id) {
            throw new Error("Supabase 저장 검증 결과가 없습니다.");
          }

          pushedCount += 1;

          syncedNotes.push({
            ...note,
            blocks: localBlocks,
            version: nextVersion,
          });
        } catch (noteError: unknown) {
          failedCount += 1;

          const errorInfo = noteError as {
            message?: string;
            code?: string;
            details?: string;
            hint?: string;
          };

          const message =
            errorInfo?.message ||
            errorInfo?.details ||
            "알 수 없는 기록 동기화 오류";

          if (!firstFailureMessage) {
            firstFailureMessage = message;
          }

          console.warn("HOO터디 노트 개별 기록 동기화 실패:", {
            noteId: note.id,
            title: note.title,
            message,
            code: errorInfo?.code ?? "",
            details: errorInfo?.details ?? "",
            hint: errorInfo?.hint ?? "",
          });

          syncedNotes.push(note);
        }
      }

      /*
       * 동기화가 시작된 뒤 사용자가 계속 타이핑했을 수 있다.
       * 이때 sync 시작 시점의 syncedNotes를 그대로 setNotes 하면
       * 몇 초 전에 쓴 내용으로 되돌아가면서 마지막 페이지 글이
       * 대부분 사라지는 현상이 생긴다.
       *
       * 항상 현재 notesRef.current와 다시 비교해서 더 최신인 로컬
       * 편집본을 우선하고, 동기화 중 새로 얻은 이미지 storagePath만
       * 안전하게 합친다.
       */
      const latestLocalNotes =
        notesRef.current;

      const syncedById = new Map(
        syncedNotes.map((note) => [
          note.id,
          note,
        ]),
      );

      const latestById = new Map(
        latestLocalNotes.map((note) => [
          note.id,
          note,
        ]),
      );

      const reconciledNotes: StudyNoteRecord[] =
        syncedNotes.map((syncedNote) => {
          const latestNote =
            latestById.get(syncedNote.id);

          if (!latestNote) {
            return syncedNote;
          }

          const latestIsNewer =
            Number(latestNote.version) >
              Number(syncedNote.version) ||
            Date.parse(latestNote.updatedAt) >
              Date.parse(syncedNote.updatedAt);

          if (!latestIsNewer) {
            return syncedNote;
          }

          const syncedImageById = new Map(
            syncedNote.blocks
              .filter(
                (
                  block,
                ): block is StudyImageBlock =>
                  block.type === "image",
              )
              .map((block) => [
                block.id,
                block,
              ]),
          );

          const mergedBlocks =
            latestNote.blocks.map((block) => {
              if (block.type !== "image") {
                return block;
              }

              const syncedImage =
                syncedImageById.get(block.id);

              if (
                block.storagePath ||
                !syncedImage?.storagePath
              ) {
                return block;
              }

              return {
                ...block,
                storagePath:
                  syncedImage.storagePath,
              };
            });

          return {
            ...latestNote,
            blocks: mergedBlocks,
          };
        });

      /*
       * 동기화 도중 새 노트를 만들었으면 syncedNotes에는 없을 수 있으므로
       * 그 노트도 그대로 유지한다.
       */
      for (const latestNote of latestLocalNotes) {
        if (!syncedById.has(latestNote.id)) {
          reconciledNotes.push(latestNote);
        }
      }

      await replaceNotesInIndexedDb(
        reconciledNotes,
      );
      await replaceStudyNoteTombstones(
        remainingTombstones,
      );

      notesRef.current = reconciledNotes;

      setNotes((previousNotes) => {
        const previousSignature =
          JSON.stringify(previousNotes);
        const nextSignature =
          JSON.stringify(reconciledNotes);

        return previousSignature === nextSignature
          ? previousNotes
          : reconciledNotes;
      });

      setTombstones(remainingTombstones);

      if (failedCount === 0) {
        setSaveLabel(`동기화 완료 · ${pushedCount}개`);
      } else if (pushedCount > 0) {
        setSaveLabel(
          `일부 동기화 · ${pushedCount}/${syncedNotes.length}`,
        );
      } else {
        setSaveLabel(
          `동기화 실패 · ${firstFailureMessage.slice(0, 34)}`,
        );
      }
    } catch (error: unknown) {
      const syncError = error as {
        message?: string;
        code?: string;
        details?: string;
        hint?: string;
      };

      const message =
        syncError?.message ||
        syncError?.details ||
        "알 수 없는 Supabase 오류";

      console.warn("HOO터디 노트 Supabase 동기화 실패:", {
        message,
        code: syncError?.code ?? "",
        details: syncError?.details ?? "",
        hint: syncError?.hint ?? "",
      });

      setSaveLabel(
        `동기화 실패 · ${message.slice(0, 34)}`,
      );
    } finally {
      syncInProgressRef.current = false;

      if (
        syncQueuedRef.current &&
        navigator.onLine
      ) {
        syncQueuedRef.current = false;

        window.setTimeout(() => {
          void syncStudyNotes(notesRef.current);
        }, 150);
      }
    }
  }

  function renderLoginModal() {
    if (!isLoginOpen) {
      return null;
    }

    return (
      <div
        className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setIsLoginOpen(false);
          }
        }}
      >
        <form
          onSubmit={handleStudyNoteLogin}
          className={`w-full max-w-[390px] rounded-[18px] border p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] ${
            isDarkMode
              ? "border-[#3a3d43] bg-[#17191d] text-white"
              : "border-[#e3e3de] bg-white text-[#222]"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black tracking-[0.18em] opacity-40">HOO ACCOUNT</p>
              <h2 className="mt-1 text-[21px] font-black">
                {authMode === "signup"
                  ? "HOO 계정 만들기"
                  : "HOO터디 노트 로그인"}
              </h2>
              <p className="mt-2 text-[11px] font-bold leading-5 opacity-45">
                하나의 HOO 계정으로 HOO 사이트와 설치된 HOO터디 노트를 함께 사용합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsLoginOpen(false)}
              className="text-xl font-black opacity-45 transition hover:opacity-100"
              aria-label="로그인 창 닫기"
            >
              ×
            </button>
          </div>

          <div
            className={`mt-5 grid grid-cols-2 rounded-lg border p-1 ${
              isDarkMode
                ? "border-[#35383e] bg-[#111316]"
                : "border-[#ddddda] bg-[#fafaf8]"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthMessage("");
              }}
              className={`rounded-md px-3 py-2 text-[11px] font-black transition ${
                authMode === "login"
                  ? "bg-[#7467d8] text-white"
                  : "opacity-45 hover:opacity-80"
              }`}
            >
              로그인
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setAuthMessage("");
              }}
              className={`rounded-md px-3 py-2 text-[11px] font-black transition ${
                authMode === "signup"
                  ? "bg-[#7467d8] text-white"
                  : "opacity-45 hover:opacity-80"
              }`}
            >
              새 계정
            </button>
          </div>

          {authMode === "signup" && (
            <>
              <label className="mt-4 block text-[11px] font-black opacity-60">
                닉네임
              </label>
              <input
                type="text"
                autoComplete="nickname"
                maxLength={24}
                value={authNickname}
                onChange={(event) =>
                  setAuthNickname(
                    event.target.value,
                  )
                }
                placeholder="HOO에서 사용할 닉네임"
                className={`mt-2 w-full rounded-lg border px-3 py-3 text-[13px] font-bold outline-none ${
                  isDarkMode
                    ? "border-[#35383e] bg-[#111316] text-white placeholder:text-white/25 focus:border-[#7467d8]"
                    : "border-[#ddddda] bg-[#fafaf8] text-[#222] placeholder:text-[#aaa] focus:border-[#7467d8]"
                }`}
              />
            </>
          )}

          <label className="mt-4 block text-[11px] font-black opacity-60">이메일</label>
          <input
            type="email"
            autoComplete="email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="HOO 계정 이메일"
            className={`mt-2 w-full rounded-lg border px-3 py-3 text-[13px] font-bold outline-none ${
              isDarkMode
                ? "border-[#35383e] bg-[#111316] text-white placeholder:text-white/25 focus:border-[#7467d8]"
                : "border-[#ddddda] bg-[#fafaf8] text-[#222] placeholder:text-[#aaa] focus:border-[#7467d8]"
            }`}
          />

          <label className="mt-4 block text-[11px] font-black opacity-60">비밀번호</label>
          <input
            type="password"
            autoComplete="current-password"
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            placeholder="비밀번호"
            className={`mt-2 w-full rounded-lg border px-3 py-3 text-[13px] font-bold outline-none ${
              isDarkMode
                ? "border-[#35383e] bg-[#111316] text-white placeholder:text-white/25 focus:border-[#7467d8]"
                : "border-[#ddddda] bg-[#fafaf8] text-[#222] placeholder:text-[#aaa] focus:border-[#7467d8]"
            }`}
          />

          {authMessage && (
            <p className="mt-3 text-[10px] font-black text-[#d6a915]">{authMessage}</p>
          )}

          <button
            type="submit"
            disabled={isSigningIn}
            className="mt-5 w-full rounded-lg bg-[#7467d8] px-4 py-3 text-[12px] font-black text-white transition hover:bg-[#675bc9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSigningIn
              ? authMode === "signup"
                ? "계정 만드는 중..."
                : "로그인 중..."
              : authMode === "signup"
                ? "HOO 계정 만들기"
                : "로그인"}
          </button>
        </form>
      </div>
    );
  }

  function renderNoteNameModal() {
    if (!isNoteNameOpen) {
      return null;
    }

    return (
      <div
        className="fixed inset-0 z-[12010] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setIsNoteNameOpen(false);
            setPendingNoteCategory(null);
            setNoteNameDraft("");
          }
        }}
      >
        <form
          onSubmit={handleCreateNoteSubmit}
          className={`w-full max-w-[420px] rounded-[18px] border p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] ${
            isDarkMode
              ? "border-[#3a3d43] bg-[#17191d] text-white"
              : "border-[#e3e3de] bg-white text-[#222]"
          }`}
        >
          <p className="text-[10px] font-black tracking-[0.16em] opacity-40">
            NEW NOTE
          </p>

          <h2 className="mt-1 text-[21px] font-black">
            새 노트 이름
          </h2>

          <p className="mt-2 text-[11px] font-bold opacity-45">
            {pendingNoteCategory ?? categoryFilter} 카테고리에 만들 노트 이름을 정하세요.
          </p>

          <input
            autoFocus
            type="text"
            maxLength={80}
            value={noteNameDraft}
            onChange={(event) =>
              setNoteNameDraft(event.target.value)
            }
            placeholder="예: 자바스크립트 배열 정리"
            className={`mt-5 w-full rounded-lg border px-4 py-3 text-[14px] font-bold outline-none ${
              isDarkMode
                ? "border-[#35383e] bg-[#111316] text-white placeholder:text-white/25 focus:border-[#d6b522]"
                : "border-[#deded9] bg-[#fafaf8] text-[#222] placeholder:text-[#aaa] focus:border-[#d6b522]"
            }`}
          />

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsNoteNameOpen(false);
                setPendingNoteCategory(null);
                setNoteNameDraft("");
              }}
              className={`rounded-lg px-4 py-2.5 text-[11px] font-black transition ${
                isDarkMode
                  ? "bg-white/10 hover:bg-white/15"
                  : "bg-[#f0f0ed] hover:bg-[#e7e7e3]"
              }`}
            >
              취소
            </button>

            <button
              type="submit"
              disabled={!noteNameDraft.trim()}
              className="rounded-lg bg-[#6a5410] px-5 py-2.5 text-[11px] font-black text-[#ffe48a] transition hover:bg-[#7a6214] disabled:cursor-not-allowed disabled:opacity-35"
            >
              노트 만들기
            </button>
          </div>
        </form>
      </div>
    );
  }

  function renderTrashBin() {
    const hasSelectedImage =
      selectedImageDeleteTarget !== null;

    return (
      <button
        ref={trashBinRef}
        type="button"
        aria-label="노트, 폴더, 사진 삭제 휴지통"
        title={
          selectedImageDeleteTarget
            ? `${selectedImageDeleteTarget.label} 삭제`
            : draggingDeleteTarget
              ? `${draggingDeleteTarget.label} · 여기에 놓아 삭제`
              : "폴더/파일은 끌어다 놓고, 사진은 선택 후 클릭해서 삭제합니다"
        }
        onClick={() => {
          if (!selectedImageDeleteTarget) {
            return;
          }

          deleteImageBlock(
            selectedImageDeleteTarget.noteId,
            selectedImageDeleteTarget.blockId,
            selectedImageDeleteTarget.label,
          );
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (draggingDeleteTarget) {
            setIsTrashDragOver(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          if (draggingDeleteTarget) {
            setIsTrashDragOver(true);
          }
        }}
        onDragLeave={(event) => {
          if (
            !event.currentTarget.contains(
              event.relatedTarget as Node | null,
            )
          ) {
            setIsTrashDragOver(false);
          }
        }}
        onDrop={handleTrashDrop}
        className={`fixed bottom-5 right-5 z-[11990] flex h-12 w-12 items-center justify-center rounded-full border text-[20px] shadow-lg transition-all duration-150 ${
          isTrashDragOver
            ? "scale-110 border-[#ff6f85] bg-[#5f1f2a] text-white shadow-[0_10px_30px_rgba(223,102,122,0.35)]"
            : hasSelectedImage
              ? "scale-105 border-[#ff6f85] bg-[#5f1f2a] text-white opacity-100 shadow-[0_10px_30px_rgba(223,102,122,0.28)]"
              : draggingDeleteTarget
                ? "border-[#df667a]/70 bg-[#2c1c21] text-[#ff9bad] opacity-100"
                : isDarkMode
                  ? "border-white/15 bg-[#202226]/95 text-white/45 opacity-70 hover:opacity-100"
                  : "border-black/10 bg-white/95 text-black/40 opacity-70 hover:opacity-100"
        }`}
      >
        🗑
      </button>
    );
  }

  function handleSidebarBack() {
    /*
     * 에디터에서는 현재 노트가 속한 카테고리로,
     * 카테고리 화면에서는 메인으로,
     * 메인에서는 이전 페이지(HOO)로 돌아간다.
     */
    if (viewMode === "editor") {
      const currentNote =
        selectedNote ??
        notesRef.current.find(
          (note) =>
            note.id === selectedNoteId,
        );

      if (currentNote) {
        setCategoryFilter(
          currentNote.category,
        );
        setSelectedNoteId(null);
        setSearchQuery("");
        setViewMode("category");
        return;
      }
    }

    if (viewMode === "category") {
      setCategoryFilter("전체");
      setSelectedNoteId(null);
      setSearchQuery("");
      setViewMode("home");
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.history.length > 1
    ) {
      window.history.back();
      return;
    }

    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }

  function renderSidebar() {
    return (
      <aside
        className={`flex min-h-0 flex-col border-r p-4 ${
          isDarkMode
            ? "border-[#34373d] bg-[#15171a] text-white"
            : "border-[#e2e2df] bg-[#fafaf8] text-[#242424]"
        }`}
      >
        {viewMode === "home" ? (
          <button
            type="button"
            onClick={createCategory}
            className={`flex h-10 items-center justify-center rounded-md text-sm font-black transition ${
              isDarkMode
                ? "bg-[#2c2f34] text-white hover:bg-[#373a40]"
                : "bg-[#2d2d2d] text-white hover:bg-black"
            }`}
            title="새 카테고리"
            aria-label="새 카테고리"
          >
            ＋ 새 카테고리
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSidebarBack}
            className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-black transition ${
              isDarkMode
                ? "bg-[#2c2f34] text-white hover:bg-[#373a40]"
                : "bg-[#2d2d2d] text-white hover:bg-black"
            }`}
            title="돌아가기"
            aria-label="돌아가기"
          >
            <span
              aria-hidden="true"
              className="text-[16px]"
            >
              ←
            </span>
            <span>돌아가기</span>
          </button>
        )}

        <div className="relative mt-4 z-[12000]">
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value,
              )
            }
            placeholder="내용 검색"
            className={`relative z-20 w-full rounded-md border px-3 py-2.5 pr-9 text-xs font-bold outline-none ${
              isDarkMode
                ? "border-[#34373d] bg-[#111316] text-white placeholder:text-white/35 focus:border-[#6f63d9]"
                : "border-[#deded9] bg-white text-[#2d2d2d] placeholder:text-[#a3a3a0] focus:border-[#e1bf46]"
            }`}
          />

          <span className="pointer-events-none absolute right-3 top-2.5 z-30 text-sm opacity-55">
            ⌕
          </span>

          {searchQuery.trim() && (
            <div
              className={`absolute left-0 top-[calc(100%+8px)] z-[12010] flex max-h-[calc(70vh-130px)] w-[min(310px,calc(100vw-24px))] flex-col overflow-hidden rounded-[10px] border shadow-2xl ${
                isDarkMode
                  ? "border-[#3a3d43] bg-[#111316] text-white shadow-black/45"
                  : "border-[#deded9] bg-white text-[#242424] shadow-black/15"
              }`}
            >
              <div
                className={`flex shrink-0 items-center justify-between border-b px-3 py-2 ${
                  isDarkMode
                    ? "border-[#2b2e33]"
                    : "border-[#ecece8]"
                }`}
              >
                <div className="min-w-0">
                  <span className="block text-[14px] font-black opacity-70">
                    전체 기록 검색
                  </span>
                  <span className="mt-0.5 block text-[11px] font-bold opacity-45">
                    결과를 누르면 정확한 위치로 이동합니다.
                  </span>
                </div>

                <div className="ml-3 flex shrink-0 items-center gap-2">
                  <span className="text-[14px] font-black opacity-55">
                    {contentSearchResults.length}
                  </span>

                  <button
                    type="button"
                    onMouseDown={(event) =>
                      event.preventDefault()
                    }
                    onClick={() =>
                      setSearchQuery("")
                    }
                    className={`flex h-7 w-7 items-center justify-center rounded text-[17px] font-black transition ${
                      isDarkMode
                        ? "hover:bg-white/10"
                        : "hover:bg-black/5"
                    }`}
                    title="검색창 닫기"
                    aria-label="검색창 닫기"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
                {contentSearchResults.length > 0 ? (
                  contentSearchResults.map(
                    (result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() =>
                          openContentSearchResult(
                            result,
                          )
                        }
                        className={`flex w-full items-start gap-2 rounded px-2.5 py-2.5 text-left transition ${
                          isDarkMode
                            ? "hover:bg-white/5"
                            : "hover:bg-black/[0.035]"
                        }`}
                      >
                        <span className="mt-0.5 text-[12px] opacity-50">
                          □
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-black">
                            {result.noteTitle}
                          </span>

                          <span className="mt-0.5 block text-[12px] font-black text-[#d6b522]">
                            {result.locationLabel}
                          </span>

                          <span className="mt-1 block whitespace-normal break-words text-[12px] font-bold leading-[1.5] opacity-70">
                            {result.excerpt}
                          </span>

                          <span className="mt-1 block truncate text-[11px] font-bold opacity-40">
                            {result.category} · {result.date}
                          </span>
                        </span>
                      </button>
                    ),
                  )
                ) : (
                  <p className="px-3 py-4 text-center text-[12px] font-bold opacity-40">
                    일치하는 내용이 없어요.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <h3 className="text-xs font-black">카테고리</h3>
          <button
            type="button"
            onClick={createCategory}
            className="text-lg font-bold opacity-70 transition hover:opacity-100"
            title="카테고리 추가"
          >
            ＋
          </button>
        </div>

        <div className="mt-2 space-y-1">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter("전체");
              setSelectedNoteId(null);
              setSearchQuery("");
              setViewMode("home");
            }}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-bold transition ${
              categoryFilter === "전체"
                ? isDarkMode
                  ? "bg-[#45370b] text-[#ffe48a]"
                  : "bg-[#fff3bf] text-[#6d5614]"
                : isDarkMode
                  ? "hover:bg-white/5"
                  : "hover:bg-black/[0.035]"
            }`}
          >
            <span>▣</span>
            <span className="flex-1">전체 노트</span>
            <span className="opacity-55">{notes.length}</span>
          </button>

          {categories.map((category) => (
            <div
              key={category}
              draggable
              onDragStart={(event) =>
                beginDeleteDrag(event, {
                  kind: "category",
                  category,
                  label: category,
                })
              }
              onDragEnd={finishDeleteDrag}
              className="cursor-grab active:cursor-grabbing"
              title="끌어서 오른쪽 아래 휴지통에 놓으면 삭제됩니다"
            >
              <button
                type="button"
                draggable={false}
                onClick={() => openCategory(category)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-bold transition ${
                  categoryFilter === category
                    ? isDarkMode
                      ? "bg-[#45370b] text-[#ffe48a]"
                      : "bg-[#fff3bf] text-[#6d5614]"
                    : isDarkMode
                      ? "hover:bg-white/5"
                      : "hover:bg-black/[0.035]"
                }`}
              >
                <span>□</span>
                <span className="min-w-0 flex-1 truncate">{category}</span>
                <span className="opacity-55">{getCategoryCount(category)}</span>
              </button>
            </div>
          ))}
        </div>

        <div className={`mt-5 border-t pt-4 ${isDarkMode ? "border-[#303238]" : "border-[#e3e1db]"}`}>
          <h3 className="text-xs font-black">최근 노트</h3>
          <div className="mt-2 space-y-1">
            {recentNotes.map((note) => (
              <div
                key={note.id}
                draggable
                onDragStart={(event) =>
                  beginDeleteDrag(event, {
                    kind: "note",
                    id: note.id,
                    label: note.title,
                  })
                }
                onDragEnd={finishDeleteDrag}
                className="cursor-grab active:cursor-grabbing"
                title="끌어서 오른쪽 아래 휴지통에 놓으면 삭제됩니다"
              >
                <button
                  type="button"
                  draggable={false}
                  onClick={() => openNote(note.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11px] font-bold transition ${
                    isDarkMode
                      ? "hover:bg-white/5"
                      : "hover:bg-black/[0.035]"
                  }`}
                >
                  <span>□</span>
                  <span className="min-w-0 flex-1 truncate">{note.title}</span>
                  <span className="opacity-45">☆</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-4">
          {signedInEmail ? (
            <div
              className={`mb-3 rounded-lg border px-3 py-2.5 ${
                isDarkMode
                  ? "border-[#34373d] bg-[#111316]"
                  : "border-[#e2e2df] bg-white"
              }`}
            >
              <p className="truncate text-[10px] font-black opacity-55">로그인됨</p>
              <p className="mt-0.5 truncate text-[11px] font-black">{signedInEmail}</p>
              <button
                type="button"
                onClick={() => void handleStudyNoteLogout()}
                className={`mt-2 w-full rounded-md px-2 py-2 text-[10px] font-black transition ${
                  isDarkMode
                    ? "bg-white/10 hover:bg-white/15"
                    : "bg-[#f2f2ef] hover:bg-[#e9e9e5]"
                }`}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthMessage("");
                setIsLoginOpen(true);
              }}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#675bc9] bg-[#7467d8] px-3 py-2.5 text-[11px] font-black text-white transition hover:bg-[#6659ca]"
            >
              <span className="text-[13px]">↪</span>
              HOO 로그인
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                isDarkMode ? "hover:bg-white/10" : "hover:bg-black/5"
              }`}
              title="설정"
            >
              ⚙
            </button>
            <button
              type="button"
              onClick={() => setIsDarkMode((previous) => !previous)}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                isDarkMode ? "hover:bg-white/10" : "hover:bg-black/5"
              }`}
              title={isDarkMode ? "라이트 모드" : "다크 모드"}
            >
              {isDarkMode ? "☀" : "☾"}
            </button>
          </div>
        </div>
      </aside>
    );
  }

  if (!isHydrated) {
    return (
      <section className="flex h-[100dvh] w-screen shrink-0 items-center justify-center px-4">
        <div className="rounded-3xl border border-white/55 bg-white/90 px-8 py-7 font-black text-[#7467d8] shadow-2xl">
          HOO터디 노트를 불러오는 중...
        </div>
      </section>
    );
  }

  function renderCompactEditorToolbar() {
    const baseButtonClass = `flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md border px-2 text-[13px] font-black transition ${
      isDarkMode
        ? "border-[#34373d] bg-[#1d1f23] text-white hover:bg-[#25282d]"
        : "border-[#e3e3df] bg-white text-[#292929] hover:bg-[#f7f5ee]"
    }`;

    const toolbarSurfaceClass =
      isDarkMode
        ? "border-[#303238] bg-[#17191d] text-white"
        : "border-[#deded9] bg-white text-[#2a2a2a]";

    return (
      <div className="sticky top-0 z-[500] h-0 -mx-1 overflow-visible px-1">
        <div className="pointer-events-auto absolute left-1 right-1 top-1 flex h-[44px] min-w-0 items-center overflow-hidden">
          <button
            type="button"
            onClick={() =>
              setIsEditorToolbarCollapsed(
                (previous) => !previous,
              )
            }
            className={`${baseButtonClass} relative z-20 transition-all duration-300 ${
              isEditorToolbarCollapsed
                ? "border-[#d6b522] text-[#ffe66d]"
                : ""
            }`}
            title={
              isEditorToolbarCollapsed
                ? "툴바 열기"
                : "툴바 닫기"
            }
            aria-label={
              isEditorToolbarCollapsed
                ? "툴바 열기"
                : "툴바 닫기"
            }
          >
            <span
              aria-hidden="true"
              className={`block h-0 w-0 border-y-[5px] border-y-transparent border-r-[8px] border-r-current transition-transform duration-300 ease-out ${
                isEditorToolbarCollapsed
                  ? "rotate-180"
                  : "rotate-0"
              }`}
            />
          </button>

          <div
            className={`flex h-[44px] min-w-0 items-center gap-1 overflow-x-auto rounded-[9px] border transition-[max-width,transform,opacity,margin,padding,border-color] duration-300 ease-out ${toolbarSurfaceClass} ${
              isEditorToolbarCollapsed
                ? "pointer-events-none ml-0 max-w-0 translate-x-8 border-transparent px-0 opacity-0"
                : "ml-1 max-w-[calc(100%-36px)] flex-1 translate-x-0 px-2 opacity-100"
            }`}
          >
            <button
              type="button"
              onClick={() => setToolTab("text")}
              className={`${baseButtonClass} ${
                toolTab === "text"
                  ? "border-[#d6b522] bg-[#3a310d] text-[#ffe66d]"
                  : ""
              }`}
              title="텍스트 도구"
              aria-label="텍스트 도구"
            >
              T
            </button>

            <button
              type="button"
              onClick={() => setToolTab("page")}
              className={`${baseButtonClass} ${
                toolTab === "page"
                  ? "border-[#d6b522] bg-[#3a310d] text-[#ffe66d]"
                  : ""
              }`}
              title="페이지 도구"
              aria-label="페이지 도구"
            >
              ▤
            </button>

            <span
              className={`mx-1 h-5 w-px shrink-0 ${
                isDarkMode
                  ? "bg-white/10"
                  : "bg-black/10"
              }`}
            />

            {toolTab === "text" ? (
              <>
                <button
                  type="button"
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  onClick={() =>
                    togglePrimaryTextFormat(
                      "bold",
                    )
                  }
                  className={`${baseButtonClass} ${
                    isBoldFormatActive
                      ? "border-[#d6b522] bg-[#3a310d] text-[#ffe66d]"
                      : ""
                  }`}
                  title="텍스트 굵게"
                  aria-label="텍스트 굵게"
                  aria-pressed={
                    isBoldFormatActive
                  }
                >
                  B
                </button>

                <button
                  type="button"
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  onClick={() =>
                    togglePrimaryTextFormat(
                      "italic",
                    )
                  }
                  className={`${baseButtonClass} ${
                    isItalicFormatActive
                      ? "border-[#d6b522] bg-[#3a310d] text-[#ffe66d]"
                      : ""
                  }`}
                  title="텍스트 기울임"
                  aria-label="텍스트 기울임"
                  aria-pressed={
                    isItalicFormatActive
                  }
                >
                  <span
                    className="inline-block"
                    style={{
                      transform:
                        "skewX(-25deg)",
                    }}
                  >
                    I
                  </span>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onMouseDown={(event) =>
                      event.preventDefault()
                    }
                    onClick={() => {
                      /*
                       * U 아이콘을 누르는 순간에는 밑줄을 적용하지 않는다.
                       * 먼저 색상 팔레트만 열고, 실제 밑줄 적용은
                       * 사용자가 색상을 선택한 순간 applyUnderlineColor()에서 처리한다.
                       */
                      setIsUnderlineColorPaletteOpen(
                        (previous) =>
                          !previous,
                      );
                      setIsFontColorPaletteOpen(
                        false,
                      );
                      setIsStrikeColorPaletteOpen(
                        false,
                      );
                      setIsFontSizeMenuOpen(
                        false,
                      );
                    }}
                    className={`${baseButtonClass} ${
                      isUnderlineFormatActive ||
                      isUnderlineColorPaletteOpen
                        ? "border-[#d6b522] bg-[#3a310d] text-[#ffe66d]"
                        : ""
                    }`}
                    title="밑줄 색상 선택"
                    aria-label="밑줄 색상 선택"
                    aria-pressed={
                      isUnderlineFormatActive
                    }
                    aria-expanded={
                      isUnderlineColorPaletteOpen
                    }
                  >
                    <span className="relative inline-flex h-[18px] min-w-[15px] items-center justify-center pb-[3px]">
                      U
                      <span
                        className="absolute inset-x-0 bottom-0 h-px"
                        style={{
                          backgroundColor:
                            activeUnderlineColor,
                        }}
                      />
                    </span>
                  </button>

                  {isUnderlineColorPaletteOpen && (
                    <div
                      className={`flex h-8 shrink-0 items-center gap-1 rounded-md border px-1.5 ${
                        isDarkMode
                          ? "border-[#34373d] bg-[#1d1f23]"
                          : "border-[#e3e3df] bg-white"
                      }`}
                      aria-label="밑줄 색상 20색 팔레트"
                    >
                      <button
                        type="button"
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          applyUnderlineColor(
                            "currentColor",
                          )
                        }
                        className={`flex h-5 min-w-[26px] items-center justify-center rounded border text-[8px] font-black ${
                          isDarkMode
                            ? "border-white/15 text-white/70"
                            : "border-black/15 text-black/65"
                        }`}
                        title="기본 밑줄 색상"
                        aria-label="기본 밑줄 색상"
                      >
                        기본
                      </button>

                      {FONT_COLOR_OPTIONS.map(
                        (color) => (
                          <button
                            key={color}
                            type="button"
                            onMouseDown={(
                              event,
                            ) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              applyUnderlineColor(
                                color,
                              )
                            }
                            className="h-5 w-5 shrink-0 rounded-full border border-black/25 shadow-sm transition hover:scale-110"
                            style={{
                              backgroundColor:
                                color,
                            }}
                            title={`밑줄 색상 ${color}`}
                            aria-label={`밑줄 색상 ${color}`}
                          />
                        ),
                      )}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onMouseDown={(event) =>
                      event.preventDefault()
                    }
                    onClick={() => {
                      /*
                       * 밑줄과 동일하게 S를 누르는 순간에는
                       * 삭제선을 적용하지 않고 색상 팔레트만 먼저 연다.
                       * 실제 삭제선 적용은 색상을 선택한 순간 처리한다.
                       */
                      setIsStrikeColorPaletteOpen(
                        (previous) =>
                          !previous,
                      );
                      setIsUnderlineColorPaletteOpen(
                        false,
                      );
                      setIsFontColorPaletteOpen(
                        false,
                      );
                      setIsFontSizeMenuOpen(
                        false,
                      );
                    }}
                    className={`${baseButtonClass} ${
                      isStrikeFormatActive ||
                      isStrikeColorPaletteOpen
                        ? "border-[#d6b522] bg-[#3a310d] text-[#ffe66d]"
                        : ""
                    }`}
                    title="삭제선 색상 선택"
                    aria-label="삭제선 색상 선택"
                    aria-pressed={
                      isStrikeFormatActive
                    }
                    aria-expanded={
                      isStrikeColorPaletteOpen
                    }
                  >
                    <span className="relative inline-flex h-[18px] min-w-[15px] items-center justify-center">
                      S
                      <span
                        className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
                        style={{
                          backgroundColor:
                            activeStrikeColor,
                        }}
                      />
                    </span>
                  </button>

                  {isStrikeColorPaletteOpen && (
                    <div
                      className={`flex h-8 shrink-0 items-center gap-1 rounded-md border px-1.5 ${
                        isDarkMode
                          ? "border-[#34373d] bg-[#1d1f23]"
                          : "border-[#e3e3df] bg-white"
                      }`}
                      aria-label="삭제선 색상 20색 팔레트"
                    >
                      <button
                        type="button"
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          applyStrikeColor(
                            "currentColor",
                          )
                        }
                        className={`flex h-5 min-w-[26px] items-center justify-center rounded border text-[8px] font-black ${
                          isDarkMode
                            ? "border-white/15 text-white/70"
                            : "border-black/15 text-black/65"
                        }`}
                        title="기본 삭제선 색상"
                        aria-label="기본 삭제선 색상"
                      >
                        기본
                      </button>

                      {FONT_COLOR_OPTIONS.map(
                        (color) => (
                          <button
                            key={color}
                            type="button"
                            onMouseDown={(
                              event,
                            ) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              applyStrikeColor(
                                color,
                              )
                            }
                            className="h-5 w-5 shrink-0 rounded-full border border-black/25 shadow-sm transition hover:scale-110"
                            style={{
                              backgroundColor:
                                color,
                            }}
                            title={`삭제선 색상 ${color}`}
                            aria-label={`삭제선 색상 ${color}`}
                          />
                        ),
                      )}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onMouseDown={(event) =>
                      event.preventDefault()
                    }
                    onClick={() => {
                      setIsFontColorPaletteOpen(
                        (previous) =>
                          !previous,
                      );
                      setIsUnderlineColorPaletteOpen(
                        false,
                      );
                      setIsStrikeColorPaletteOpen(
                        false,
                      );
                      setIsFontSizeMenuOpen(
                        false,
                      );
                    }}
                    className={`${baseButtonClass} relative ${
                      isFontColorPaletteOpen
                        ? "border-[#d6b522] bg-[#3a310d]"
                        : ""
                    }`}
                    title="폰트 색상"
                    aria-label="폰트 색상"
                    aria-expanded={
                      isFontColorPaletteOpen
                    }
                  >
                    <span
                      className="relative inline-flex h-[18px] min-w-[15px] items-center justify-center pb-[3px]"
                    >
                      A
                      <span
                        className="absolute inset-x-0 bottom-0 h-[2px] rounded-full"
                        style={{
                          backgroundColor:
                            activeFontColor,
                        }}
                      />
                    </span>
                  </button>

                  {isFontColorPaletteOpen && (
                    <div
                      className={`flex h-8 shrink-0 items-center gap-1 rounded-md border px-1.5 ${
                        isDarkMode
                          ? "border-[#34373d] bg-[#1d1f23]"
                          : "border-[#e3e3df] bg-white"
                      }`}
                      aria-label="폰트 색상 20색 팔레트"
                    >
                      <button
                        type="button"
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          applyFontColor(
                            isDarkMode
                              ? "#EFEFEF"
                              : "#302B27",
                          )
                        }
                        className={`flex h-5 min-w-[26px] items-center justify-center rounded border text-[8px] font-black ${
                          isDarkMode
                            ? "border-white/15 text-white/70"
                            : "border-black/15 text-black/65"
                        }`}
                        title="기본 폰트 색상"
                        aria-label="기본 폰트 색상"
                      >
                        기본
                      </button>

                      {FONT_COLOR_OPTIONS.map(
                        (color) => (
                          <button
                            key={color}
                            type="button"
                            onMouseDown={(
                              event,
                            ) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              applyFontColor(
                                color,
                              )
                            }
                            className="h-5 w-5 shrink-0 rounded-full border border-black/25 shadow-sm transition hover:scale-110"
                            style={{
                              backgroundColor:
                                color,
                            }}
                            title={`폰트 색상 ${color}`}
                            aria-label={`폰트 색상 ${color}`}
                          />
                        ),
                      )}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onMouseDown={(event) =>
                      event.preventDefault()
                    }
                    onClick={() => {
                      setIsFontSizeMenuOpen(
                        (previous) =>
                          !previous,
                      );
                      setIsFontColorPaletteOpen(
                        false,
                      );
                      setIsUnderlineColorPaletteOpen(
                        false,
                      );
                      setIsStrikeColorPaletteOpen(
                        false,
                      );
                    }}
                    className={`${baseButtonClass} min-w-[46px] text-[11px] ${
                      isFontSizeMenuOpen
                        ? "border-[#d6b522] bg-[#3a310d] text-[#ffe66d]"
                        : ""
                    }`}
                    title="폰트 크기"
                    aria-label="폰트 크기"
                    aria-expanded={
                      isFontSizeMenuOpen
                    }
                  >
                    {activeFontSize}
                    <span className="ml-0.5 text-[8px]">
                      ▼
                    </span>
                  </button>

                  {isFontSizeMenuOpen && (
                    <div
                      className={`flex h-8 shrink-0 items-center gap-0.5 rounded-md border px-1 ${
                        isDarkMode
                          ? "border-[#34373d] bg-[#1d1f23]"
                          : "border-[#e3e3df] bg-white"
                      }`}
                      aria-label="폰트 크기 선택"
                    >
                      {FONT_SIZE_OPTIONS.map(
                        (fontSize) => (
                          <button
                            key={fontSize}
                            type="button"
                            onMouseDown={(
                              event,
                            ) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              applyFontSize(
                                fontSize,
                              )
                            }
                            className={`flex h-6 min-w-[30px] items-center justify-center rounded px-1 text-[9px] font-black transition ${
                              activeFontSize ===
                              fontSize
                                ? "bg-[#d6b522] text-black"
                                : isDarkMode
                                  ? "text-white/70 hover:bg-white/10"
                                  : "text-black/65 hover:bg-black/5"
                            }`}
                            title={`${fontSize}px`}
                            aria-label={`${fontSize}px`}
                          >
                            {fontSize}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>

                <span
                  className={`mx-1 h-5 w-px shrink-0 ${
                    isDarkMode
                      ? "bg-white/10"
                      : "bg-black/10"
                  }`}
                />

                <button
                  type="button"
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  onClick={toggleHighlightFormat}
                  className={`${baseButtonClass} ${
                    isHighlightFormatActive
                      ? "border-[#d6b522] bg-[#3a310d] text-[#ffe15a]"
                      : ""
                  }`}
                  title="형광펜"
                  aria-label="형광펜"
                  aria-pressed={
                    isHighlightFormatActive
                  }
                >
                  <span
                    className="relative block h-[18px] w-[18px]"
                    aria-hidden="true"
                  >
                    <span
                      className="absolute left-[7px] top-[1px] h-[12px] w-[5px] rotate-[-35deg] rounded-[1px] bg-current"
                    />
                    <span
                      className="absolute left-[4px] top-[13px] h-[2px] w-[10px] rotate-[-35deg] rounded-full"
                      style={{
                        backgroundColor:
                          HIGHLIGHT_COLOR,
                      }}
                    />
                  </span>
                </button>

                <button
                  type="button"
                  onMouseDown={(event) =>
                    event.preventDefault()
                  }
                  onClick={addAnnotation}
                  className={baseButtonClass}
                  title="주석"
                  aria-label="주석"
                >
                  ↗
                </button>

              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={appendNewPage}
                  className={baseButtonClass}
                  title="새 페이지"
                  aria-label="새 페이지"
                >
                  ＋
                </button>

                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  className={baseButtonClass}
                  title="사진 넣기"
                  aria-label="사진 넣기"
                >
                  ▧
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />

              </>
            )}

            <span className="min-w-2 flex-1" />
          </div>
        </div>
      </div>
    );
  }


  if (viewMode === "home") {
    const folderColors = [
      ["#f8dda0", "#9a6b12"],
      ["#dcead8", "#365f3a"],
      ["#dce7f6", "#3e5878"],
      ["#e5dcf4", "#5c4a7d"],
      ["#eadbc7", "#775834"],
      ["#f4d8d8", "#8a4545"],
    ];

    return (
      <section className="flex h-[100dvh] w-screen shrink-0 overflow-hidden bg-[#f4f4f1] p-0">
        {renderLoginModal()}

        {renderTrashBin()}

        <div
          className={`grid h-full w-full min-h-0 grid-rows-[66px_minmax(0,1fr)] overflow-hidden border ${
            isDarkMode
              ? "border-[#303238] bg-[#15171a] text-[#f1f1f1]"
              : "border-[#e6e6e2] bg-[#fbfbfa] text-[#222]"
          }`}
        >
          <header
            className={`grid grid-cols-[266px_minmax(0,1fr)] border-b ${
              isDarkMode ? "border-[#303238]" : "border-[#e6e6e2]"
            }`}
          >
            <div
              className={`flex items-center gap-4 border-r px-6 ${
                isDarkMode ? "border-[#303238]" : "border-[#e6e6e2]"
              }`}
            >
              <button
                type="button"
                className="text-[22px] leading-none opacity-80"
                title="메뉴"
              >
                ☰
              </button>
              <h1 className="text-[17px] font-black tracking-[-0.03em]">HOO터디 노트</h1>
            </div>

            <div aria-hidden="true" />
          </header>

          <div className="grid min-h-0 grid-cols-[266px_minmax(0,1fr)]">
            {renderSidebar()}

            <main
              data-hoo-vertical-scroll="true"
              className={`min-h-0 overflow-y-auto px-10 pb-10 pt-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                isDarkMode ? "bg-[#17191c]" : "bg-[#fdfdfc]"
              }`}
            >
              <div className="mx-auto max-w-[1170px]">
                <div className="pt-1 text-center">
                  <div
                    className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
                      isDarkMode ? "bg-[#4b3d10] text-[#f5cf4f]" : "bg-[#fff0bf] text-[#806616]"
                    }`}
                  >
                    ✎
                  </div>
                  <h2 className="mt-5 text-[29px] font-black tracking-[-0.04em]">
                    HOO터디 노트에 오신 것을 환영합니다!
                  </h2>
                  <p className="mt-3 text-[13px] font-bold opacity-45">
                    카테고리 또는 날짜를 선택하여 노트를 열어보세요.
                  </p>
                </div>

                <section className="mt-14">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[20px]">□</span>
                      <h3 className="text-[18px] font-black">카테고리</h3>
                      <span className="text-[11px] font-bold opacity-35">클릭하면 카테고리 폴더로 이동</span>
                    </div>
                    <span className="text-2xl opacity-60">›</span>
                  </div>

                  <div
                    className={`rounded-[11px] border p-5 ${
                      isDarkMode ? "border-[#33363b] bg-[#1a1c20]" : "border-[#e9e9e5] bg-white"
                    }`}
                  >
                    <div className="grid grid-cols-6 gap-4">
                      {categories.map((category, index) => {
                        const [folderColor, iconColor] = folderColors[index % folderColors.length];
                        const icons = ["⌂", "✓", "▤", "✧", "▭", "✎"];

                        return (
                          <div
                            key={category}
                            draggable
                            onDragStart={(event) =>
                              beginDeleteDrag(event, {
                                kind: "category",
                                category,
                                label: category,
                              })
                            }
                            onDragEnd={finishDeleteDrag}
                            className="cursor-grab active:cursor-grabbing"
                            title="끌어서 오른쪽 아래 휴지통에 놓으면 삭제됩니다"
                          >
                            <button
                              type="button"
                              draggable={false}
                              onClick={() => openCategory(category)}
                              className={`group min-h-[186px] w-full rounded-[11px] border px-4 pb-4 pt-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg ${
                                isDarkMode ? "border-[#35383d] bg-[#202226]" : "border-[#ecece8] bg-[#fff]"
                              }`}
                            >
                              <div
                                className="relative mx-auto mt-2 h-[88px] w-[124px]"
                                style={{ color: iconColor }}
                              >
                                {/* 폴더 뒤판 */}
                                <div
                                  className="absolute inset-x-0 bottom-0 h-[76px] rounded-[9px] border border-black/5 shadow-[0_5px_10px_rgba(0,0,0,0.07)]"
                                  style={{ backgroundColor: folderColor }}
                                >
                                  <span
                                    className="absolute -top-[13px] left-[8px] h-[20px] w-[46px] rounded-t-[8px] border border-b-0 border-black/5"
                                    style={{ backgroundColor: folderColor }}
                                  />
                                </div>

                                {/* 마우스를 올리면 안쪽 종이가 살짝 올라와 열린 느낌 */}
                                <div
                                  className={`absolute left-[10px] right-[10px] top-[20px] h-[54px] rounded-t-[6px] border transition-all duration-200 ease-out group-hover:-translate-y-[9px] ${
                                    isDarkMode
                                      ? "border-white/10 bg-[#f1ead8]"
                                      : "border-black/10 bg-[#fffdf5]"
                                  }`}
                                >
                                  <span className="absolute left-3 right-3 top-3 h-px bg-black/10" />
                                  <span className="absolute left-3 right-6 top-6 h-px bg-black/10" />
                                </div>

                                {/* 앞판이 아래로 살짝 내려가며 반쯤 열린 폴더처럼 보임 */}
                                <div
                                  className="absolute inset-x-0 bottom-0 flex h-[62px] items-center justify-center rounded-[9px] border border-black/5 transition-all duration-200 ease-out group-hover:translate-y-[7px] group-hover:scale-y-[0.92]"
                                  style={{
                                    backgroundColor: folderColor,
                                    boxShadow: "0 4px 8px rgba(0,0,0,0.08)",
                                    transformOrigin: "bottom center",
                                  }}
                                >
                                  <span className="relative text-[29px] transition-transform duration-200 group-hover:-translate-y-[2px]">
                                    {icons[index] ?? "□"}
                                  </span>
                                </div>
                              </div>
                              <p className="mt-4 truncate text-[15px] font-black">{category}</p>
                              <p className="mt-1 text-[11px] font-bold opacity-40">{getCategoryCount(category)}개 노트</p>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section className="mt-8">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[20px]">▣</span>
                      <h3 className="text-[18px] font-black">최근 수정 파일</h3>
                      <span className="text-[11px] font-bold opacity-35">
                        가장 최근에 수정한 파일부터 왼쪽에 표시
                      </span>
                    </div>
                    <span className="text-2xl opacity-60">›</span>
                  </div>

                  <div
                    className={`rounded-[11px] border p-5 ${
                      isDarkMode ? "border-[#33363b] bg-[#1a1c20]" : "border-[#e9e9e5] bg-white"
                    }`}
                  >
                    {recentModifiedNotes.length > 0 ? (
                      <div className="grid grid-cols-5 gap-6">
                        {recentModifiedNotes.map((note) => (
                          <div
                            key={note.id}
                            draggable
                            onDragStart={(event) =>
                              beginDeleteDrag(event, {
                                kind: "note",
                                id: note.id,
                                label: note.title,
                              })
                            }
                            onDragEnd={finishDeleteDrag}
                            className="cursor-grab active:cursor-grabbing"
                            title="클릭하면 열리고, 끌어서 오른쪽 아래 휴지통에 놓으면 삭제됩니다"
                          >
                            <button
                              type="button"
                              draggable={false}
                              onClick={() => openNote(note.id)}
                              className={`group relative min-h-[140px] w-full overflow-hidden rounded-[8px] border px-5 pb-5 pt-6 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                                isDarkMode
                                  ? "border-[#383b41] bg-[#202226] text-white"
                                  : "border-[#e5e5e0] bg-[#fffef9] text-[#262626]"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="truncate text-[10px] font-black opacity-45">
                                  {note.category}
                                </span>
                              </div>

                              <p className="mt-4 line-clamp-2 min-h-[42px] text-[15px] font-black leading-5">
                                {note.title}
                              </p>

                              <p className="mt-4 text-[10px] font-bold opacity-45">
                                {formatModifiedDateTime(note.updatedAt)}
                              </p>

                              <span
                                className={`absolute bottom-0 right-0 h-0 w-0 border-l-[20px] border-t-[20px] border-l-transparent ${
                                  isDarkMode
                                    ? "border-t-[#31343a]"
                                    : "border-t-[#ece8d9]"
                                }`}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className={`flex min-h-[140px] w-full items-center justify-center rounded-lg border border-dashed text-sm font-black ${
                          isDarkMode ? "border-[#3b3d43] text-white/35" : "border-[#dedbd2] text-[#8f8a7e]"
                        }`}
                      >
                        아직 작성된 노트가 없어요.
                      </div>
                    )}
                  </div>
                </section>

                <p className="mt-8 text-center text-[11px] font-bold opacity-35">
                  ☼ 왼쪽의 “＋ 새 카테고리”로 폴더를 만든 뒤, 폴더 안에서 새 노트를 추가하세요.
                </p>
              </div>
            </main>
          </div>
        </div>
      </section>
    );
  }

  if (viewMode === "category") {
    const folderNotes = visibleNotes.filter(
      (note) => note.category === categoryFilter,
    );

    return (
      <section className="flex h-[100dvh] w-screen shrink-0 overflow-hidden bg-[#f4f4f1] p-0">
        {renderLoginModal()}
        {renderNoteNameModal()}
        {renderTrashBin()}

        <div
          className={`grid h-full w-full min-h-0 grid-rows-[66px_minmax(0,1fr)] overflow-hidden border ${
            isDarkMode
              ? "border-[#303238] bg-[#15171a] text-[#f1f1f1]"
              : "border-[#e6e6e2] bg-[#fbfbfa] text-[#222]"
          }`}
        >
          <header
            className={`grid grid-cols-[266px_minmax(0,1fr)] border-b ${
              isDarkMode ? "border-[#303238]" : "border-[#e6e6e2]"
            }`}
          >
            <div
              className={`flex items-center gap-4 border-r px-6 ${
                isDarkMode ? "border-[#303238]" : "border-[#e6e6e2]"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("전체");
                  setSelectedNoteId(null);
                  setSearchQuery("");
                  setViewMode("home");
                }}
                className="text-[22px] leading-none opacity-80"
                title="메인으로"
              >
                ☰
              </button>
              <h1 className="text-[17px] font-black tracking-[-0.03em]">
                HOO터디 노트
              </h1>
            </div>

            <div className="flex min-w-0 items-center justify-between gap-4 px-7">
              <div className="min-w-0">
                <p className="text-[10px] font-black tracking-[0.14em] opacity-35">
                  CATEGORY
                </p>
                <p className="truncate text-[18px] font-black">
                  {categoryFilter}
                </p>
              </div>

              <button
                type="button"
                onClick={() => requestCreateNote(categoryFilter)}
                className={`shrink-0 rounded-lg px-5 py-2.5 text-[12px] font-black transition ${
                  isDarkMode
                    ? "bg-[#3a3d43] text-white hover:bg-[#454950]"
                    : "bg-[#2d2d2d] text-white hover:bg-black"
                }`}
              >
                ＋ 새 노트
              </button>
            </div>
          </header>

          <div className="grid min-h-0 grid-cols-[266px_minmax(0,1fr)]">
            {renderSidebar()}

            <main
              data-hoo-vertical-scroll="true"
              className={`min-h-0 overflow-y-auto px-10 pb-10 pt-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                isDarkMode ? "bg-[#17191c]" : "bg-[#fdfdfc]"
              }`}
            >
              <div className="mx-auto max-w-[1170px]">
                <div className="flex items-end justify-between gap-5">
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter("전체");
                        setSelectedNoteId(null);
                        setSearchQuery("");
                        setViewMode("home");
                      }}
                      className="text-[11px] font-black opacity-45 transition hover:opacity-90"
                    >
                      ← 전체 카테고리
                    </button>

                    <div className="mt-5 flex items-center gap-4">
                      <div
                        className={`flex h-16 w-20 items-center justify-center rounded-[10px] text-[28px] ${
                          isDarkMode
                            ? "bg-[#5a4814] text-[#f6d367]"
                            : "bg-[#f8dda0] text-[#9a6b12]"
                        }`}
                      >
                        □
                      </div>
                      <div>
                        <h2 className="text-[26px] font-black tracking-[-0.04em]">
                          {categoryFilter}
                        </h2>
                        <p className="mt-1 text-[11px] font-bold opacity-40">
                          {notes.filter((note) => note.category === categoryFilter).length}개 노트
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => requestCreateNote(categoryFilter)}
                    className={`rounded-xl px-5 py-3 text-[12px] font-black transition ${
                      isDarkMode
                        ? "bg-[#4b3d10] text-[#ffe389] hover:bg-[#5a4913]"
                        : "bg-[#fff0bf] text-[#765e14] hover:bg-[#ffe8a1]"
                    }`}
                  >
                    ＋ 새 노트 추가
                  </button>
                </div>

                <section
                  className={`mt-8 rounded-[12px] border p-5 ${
                    isDarkMode
                      ? "border-[#33363b] bg-[#1a1c20]"
                      : "border-[#e9e9e5] bg-white"
                  }`}
                >
                  {folderNotes.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {folderNotes.map((note) => (
                        <div
                          key={note.id}
                          draggable
                          onDragStart={(event) =>
                            beginDeleteDrag(event, {
                              kind: "note",
                              id: note.id,
                              label: note.title,
                            })
                          }
                          onDragEnd={finishDeleteDrag}
                          className="cursor-grab active:cursor-grabbing"
                          title="끌어서 오른쪽 아래 휴지통에 놓으면 삭제됩니다"
                        >
                          <button
                            type="button"
                            draggable={false}
                            onClick={() => openNote(note.id)}
                            className={`w-full rounded-[10px] border p-4 text-left transition hover:-translate-y-0.5 ${
                              isDarkMode
                                ? "border-[#35383d] bg-[#202226] hover:bg-[#25282d]"
                                : "border-[#ecece8] bg-[#fffdf7] hover:bg-[#fffaf0]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[10px] font-black opacity-40">
                                {formatDateWithDay(note.date)}
                              </span>
                              <span className="text-[10px] opacity-30">▤</span>
                            </div>
                            <p className="mt-3 truncate text-[14px] font-black">
                              {note.title}
                            </p>
                            <p className="mt-2 text-[10px] font-bold opacity-35">
                              v{note.version} · {note.blocks.length}개 블록
                            </p>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => requestCreateNote(categoryFilter)}
                      className={`flex min-h-[260px] w-full flex-col items-center justify-center rounded-[10px] border border-dashed transition ${
                        isDarkMode
                          ? "border-[#3b3d43] text-white/35 hover:bg-white/[0.025]"
                          : "border-[#dedbd2] text-[#8f8a7e] hover:bg-[#faf8ef]"
                      }`}
                    >
                      <span className="text-[30px]">＋</span>
                      <span className="mt-3 text-[14px] font-black">
                        이 카테고리에 첫 노트를 추가하세요.
                      </span>
                    </button>
                  )}
                </section>
              </div>
            </main>
          </div>
        </div>
      </section>
    );
  }

  if (!selectedNote) {
    return (
      <section className="flex h-[100dvh] w-screen items-center justify-center bg-[#f4f4f1]">
        <button
          type="button"
          onClick={() => setViewMode("home")}
          className="rounded-xl bg-white px-6 py-4 text-sm font-black text-[#40392f] shadow-xl"
        >
          홈으로 돌아가기
        </button>
      </section>
    );
  }

  return (

    
    <section className="flex h-[100dvh] w-screen shrink-0 overflow-hidden bg-[#f4f4f1] p-0">
        {renderLoginModal()}
        {renderTrashBin()}
      <div
        className={`grid h-full w-full min-h-0 grid-rows-[66px_minmax(0,1fr)] overflow-hidden border ${
          isDarkMode
            ? "border-[#303238] bg-[#15171a] text-[#f1f1f1]"
            : "border-[#e6e6e2] bg-[#fbfbfa] text-[#222]"
        }`}
      >
        <header
          className={`grid grid-cols-[266px_minmax(0,1fr)] border-b ${
            isDarkMode ? "border-[#303238]" : "border-[#e6e6e2]"
          }`}
        >
          <div
            className={`flex items-center gap-4 border-r px-6 ${
              isDarkMode ? "border-[#303238]" : "border-[#e6e6e2]"
            }`}
          >
            <button
              type="button"
              onClick={() => setViewMode("home")}
              className="text-[22px] leading-none opacity-80"
              title="메인으로"
            >
              ☰
            </button>
            <h1 className="text-[17px] font-black tracking-[-0.03em]">HOO터디 노트</h1>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-4 px-7">
            <p className="truncate text-[18px] font-black">{formatDateWithDay(selectedNote.date)}</p>
            <div className="flex shrink-0 items-center gap-6 text-[18px] opacity-70">
              <span
                className="text-[9px] font-black opacity-70"
                title={saveLabel}
              >
                {saveLabel}
              </span>
              <span>☆</span>
              <span>♧</span>
              <span>⋮</span>
            </div>
          </div>

        </header>

        <div className="grid min-h-0 grid-cols-[266px_minmax(0,1fr)]">
          {renderSidebar()}

          <main
            ref={editorViewportRef}
            data-hoo-vertical-scroll="true"
            className={`min-h-0 overflow-x-auto overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isDarkMode ? "bg-[#111316]" : "bg-[#f8f8f6]"}`}
          >
            {renderCompactEditorToolbar()}

            <div className="mx-auto max-w-[1340px] overflow-visible">
              <div
                className="relative mx-auto w-full overflow-visible"
                style={{
                  height:
                    editorPageCanvasHeight > 0
                      ? `${editorPageCanvasHeight * editorPageZoom}px`
                      : undefined,
                }}
              >
                <div
                  ref={editorPageCanvasRef}
                  className="origin-top"
                  style={{
                    width: "100%",
                    minWidth: 0,
                    transform: `scale(${editorPageZoom})`,
                    transformOrigin: "top center",
                    willChange: "transform",
                  } as CSSProperties}
                >
                <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_286px]">
                  <div className="min-w-0 space-y-4">
                    <div
                      className={`relative flex min-h-[76px] w-full items-center justify-center border px-7 py-4 ${
                        isDarkMode
                          ? "border-[#303238] bg-[#17191d] text-[#efefef]"
                          : "border-[#deded9] bg-white text-[#2a2a2a]"
                      }`}
                    >
                      <div className="relative inline-block max-w-[70%]">
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          ref={(element) => {
                            if (
                              !element ||
                              document.activeElement === element
                            ) {
                              return;
                            }

                            if (
                              (element.textContent ?? "") !==
                              selectedNote.title
                            ) {
                              element.textContent =
                                selectedNote.title;
                            }
                          }}
                          onInput={(event) => {
                            const nextTitle =
                              (
                                event.currentTarget
                                  .textContent ?? ""
                              )
                                .replace(/[\r\n]+/g, " ")
                                .slice(0, 80);

                            if (
                              nextTitle !==
                              event.currentTarget.textContent
                            ) {
                              event.currentTarget.textContent =
                                nextTitle;
                            }

                            updateSelectedNote((note) => ({
                              ...note,
                              title: nextTitle,
                            }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                            }
                          }}
                          className={`inline-block min-w-[1ch] max-w-full break-words bg-transparent text-center text-[24px] font-black leading-[1.35] outline-none ${
                            isDarkMode
                              ? "text-white"
                              : "text-[#2a2a2a]"
                          }`}
                          role="textbox"
                          aria-label="노트 제목"
                          data-placeholder="기록 제목"
                        />

                        <span className="absolute bottom-0 left-[calc(100%+10px)] inline-flex shrink-0 flex-col items-start whitespace-nowrap leading-none opacity-45">
                          <span className="mb-1 text-[8px] font-black">
                            (최종 수정)
                          </span>
                          <span className="text-[13px] font-bold">
                            - {formatModifiedDateTime(selectedNote.updatedAt)}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div
                      data-study-editor-root
                      className="space-y-4"
                onPaste={handleEditorPaste}
                onPointerDownCapture={
                  handleEditorPointerDownCapture
                }
                onKeyDownCapture={
                  handleEditorKeyDownCapture
                }
              >
                {notePages.map((pageBlocks, pageIndex) => (
                  <article
                    key={`${selectedNote.id}-page-${pageIndex}`}
                    className={`overflow-hidden border ${
                      isDarkMode
                        ? "border-[#303238] bg-[#17191d] text-[#efefef]"
                        : "border-[#deded9] bg-[#fff] text-[#2a2a2a]"
                    }`}
                  >
                    <div
                      data-study-page-body="true"
                      data-study-page-index={pageIndex}
                      className="relative pl-[60px] pr-5"
                      style={{
                        minHeight: PAGE_LINE_LIMIT * ROW_HEIGHT,
                        backgroundImage: isDarkMode
                          ? "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(255,255,255,0.075) 27px, rgba(255,255,255,0.075) 28px)"
                          : "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(112,102,86,0.16) 27px, rgba(112,102,86,0.16) 28px)",
                      }}
                      onPointerDown={(event) => {
                        if (
                          event.target ===
                          event.currentTarget
                        ) {
                          event.preventDefault();
                          focusActiveTextBlockAtEnd();
                        }
                      }}
                    >
                      <div
                        className={`pointer-events-none absolute bottom-0 left-0 top-0 w-[43px] border-r text-right text-[9px] font-bold opacity-35 ${
                          isDarkMode ? "border-[#303238]" : "border-[#e8e8e3]"
                        }`}
                      >
                        {Array.from({ length: PAGE_LINE_LIMIT }, (_, lineIndex) => (
                          <div key={lineIndex} className="h-7 pr-3 leading-7">{lineIndex + 1}</div>
                        ))}
                      </div>

                      {pageBlocks.map((block) => {
                        if (block.type === "image") {
                          const isResizingImage =
                            resizingImageTarget?.noteId ===
                              selectedNote.id &&
                            resizingImageTarget.blockId ===
                              block.id;

                          const isSelectedForDelete =
                            selectedImageDeleteTarget?.noteId ===
                              selectedNote.id &&
                            selectedImageDeleteTarget.blockId ===
                              block.id;

                          const isFreeImage =
                            block.layout === "free";

                          const isFloatRight =
                            !isResizingImage &&
                            block.layout ===
                              "float-right";

                          return (
                            <figure
                              key={block.id}
                              data-study-block-id={block.id}
                              data-study-image-figure-id={
                                block.id
                              }
                              className={
                                isFreeImage
                                  ? "group absolute z-20 m-0 select-none p-0"
                                  : isFloatRight
                                    ? "group relative float-right mb-2 ml-4 select-none py-1"
                                    : "group relative flex select-none items-start justify-start py-1"
                              }
                              style={
                                isFreeImage
                                  ? {
                                      left: `${
                                        block.positionXPercent ??
                                        7
                                      }%`,
                                      top: `${
                                        block.positionYPx ??
                                        0
                                      }px`,
                                      width: `${
                                        block.widthPercent ??
                                        65
                                      }%`,
                                      minHeight: 0,
                                      userSelect:
                                        "none",
                                      WebkitUserSelect:
                                        "none",
                                    }
                                  : isFloatRight
                                    ? {
                                        width: `${
                                          block.widthPercent ??
                                          48
                                        }%`,
                                        minHeight: 0,
                                        userSelect:
                                          "none",
                                        WebkitUserSelect:
                                          "none",
                                      }
                                    : {
                                        minHeight:
                                          block.units *
                                          ROW_HEIGHT,
                                        userSelect:
                                          "none",
                                        WebkitUserSelect:
                                          "none",
                                      }
                              }
                            >
                              <div
                                data-study-image-wrapper-id={
                                  block.id
                                }
                                className="relative inline-flex max-w-full items-start justify-start rounded-[9px]"
                                style={{
                                  width:
                                    isFreeImage ||
                                    isFloatRight
                                      ? "100%"
                                      : `${
                                          block.widthPercent ??
                                          65
                                        }%`,
                                  boxShadow:
                                    isResizingImage ||
                                    isSelectedForDelete
                                      ? "0 0 0 3px #ff4f6d"
                                      : "none",
                                  backgroundColor:
                                    isResizingImage ||
                                    isSelectedForDelete
                                      ? "rgba(255, 79, 109, 0.06)"
                                      : "transparent",
                                }}
                              >
                                <img
                                  data-study-image-source="true"
                                  src={block.src}
                                  alt={block.alt}
                                  draggable={false}
                                  className={`pointer-events-none block h-auto w-full select-none rounded-[7px] object-contain shadow-sm ${
                                    isDarkMode
                                      ? "bg-white/5"
                                      : "bg-[#f2eee6]"
                                  }`}
                                  style={{
                                    userSelect: "none",
                                    WebkitUserSelect:
                                      "none",
                                  }}
                                />

                                <button
                                  type="button"
                                  aria-label={
                                    isResizingImage
                                      ? "사진 위치 이동"
                                      : "사진 선택"
                                  }
                                  draggable={false}
                                  onPointerDown={
                                    isResizingImage &&
                                    isFreeImage
                                      ? (event) =>
                                          handleImageBlockMovePointerDown(
                                            event,
                                            block,
                                          )
                                      : undefined
                                  }
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();

                                    if (isResizingImage) {
                                      return;
                                    }

                                    setSelectedImageDeleteTarget(
                                      (current) =>
                                        current?.noteId ===
                                          selectedNote.id &&
                                        current.blockId ===
                                          block.id
                                          ? null
                                          : {
                                              kind: "image",
                                              noteId:
                                                selectedNote.id,
                                              blockId:
                                                block.id,
                                              label:
                                                block.alt ||
                                                "사진",
                                            },
                                    );
                                  }}
                                  className={`absolute inset-0 z-10 rounded-[9px] bg-transparent ${
                                    isResizingImage &&
                                    isFreeImage
                                      ? "cursor-move"
                                      : "cursor-pointer"
                                  }`}
                                  style={{
                                    touchAction:
                                      isResizingImage &&
                                      isFreeImage
                                        ? "none"
                                        : undefined,
                                  }}
                                  title={
                                    isResizingImage &&
                                    isFreeImage
                                      ? "사진을 잡아 원하는 위치로 이동하세요"
                                      : isResizingImage
                                        ? "사진 밖을 클릭하거나 Enter를 누르면 크기가 확정됩니다"
                                        : "사진을 클릭하면 삭제 상태가 됩니다"
                                  }
                                />

                                {isResizingImage && (
                                  <button
                                    type="button"
                                    aria-label="사진 크기 조절"
                                    draggable={false}
                                    onPointerDown={(
                                      event,
                                    ) =>
                                      handleImageBlockResizePointerDown(
                                        event,
                                        block,
                                      )
                                    }
                                    className="absolute -bottom-3 -right-3 z-40 flex h-7 w-7 cursor-se-resize items-center justify-center rounded-full border-2 border-white bg-[#ffca28] text-[12px] font-black text-black shadow-lg"
                                    style={{
                                      touchAction:
                                        "none",
                                    }}
                                    title="오른쪽 아래 모서리를 움직여 크기를 조절하세요"
                                  >
                                    ↘
                                  </button>
                                )}

                                {isSelectedForDelete && (
                                  <button
                                    type="button"
                                    draggable={false}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();

                                      deleteImageBlock(
                                        selectedNote.id,
                                        block.id,
                                        block.alt ||
                                          "사진",
                                      );
                                    }}
                                    className="absolute left-2 top-2 z-30 rounded-full bg-[#5f1f2a]/95 px-3 py-1 text-[9px] font-black text-[#ffd9df] shadow-lg transition hover:bg-[#7a2635]"
                                    title="사진 삭제"
                                  >
                                    🗑 삭제
                                  </button>
                                )}
                              </div>
                            </figure>
                          );
                        }

                        return (
                          <div
                            key={block.id}
                            data-study-block-id={block.id}
                            className="relative"
                            style={{ minHeight: getBlockUnits(block) * ROW_HEIGHT }}
                          >
                            <div
                              ref={(element) => {
                                if (!element) {
                                  return;
                                }

                                /*
                                 * 입력 중 React 재렌더링이 contentEditable의 innerHTML을
                                 * 다시 덮어쓰면 커서가 맨 앞으로 이동하면서 새 글자가
                                 * 왼쪽에 계속 쌓이는 현상이 생긴다.
                                 *
                                 * 편집 중에는 브라우저 DOM을 그대로 유지하고,
                                 * 포커스가 없을 때만 저장된 HTML과 동기화한다.
                                 */
                                if (
                                  document.activeElement !== element &&
                                  element.innerHTML !== block.html
                                ) {
                                  element.innerHTML = block.html;
                                }
                              }}
                              data-study-editable-id={block.id}
                              contentEditable
                              suppressContentEditableWarning
                              dir="ltr"
                              style={
                                getFreeImageTextWrapStyle(
                                  pageBlocks,
                                  block,
                                )
                              }
                              onPointerDown={(event) => {
                                /*
                                 * 실제 text block으로 존재하는 줄은 이미 Enter로
                                 * 활성화된 줄이므로 클릭 이동을 허용한다.
                                 *
                                 * 새 페이지를 맞추기 위해 만든 큰 빈 spacer만
                                 * 편집 줄이 아니므로 클릭 진입을 차단한다.
                                 */
                                if (
                                  !isEditableTextBlock(
                                    block,
                                  )
                                ) {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  focusActiveTextBlockAtEnd();
                                }
                              }}
                              onFocus={(event) => {
                                if (
                                  !isEditableTextBlock(
                                    block,
                                  )
                                ) {
                                  event.currentTarget.blur();

                                  window.setTimeout(() => {
                                    focusActiveTextBlockAtEnd();
                                  }, 0);

                                  return;
                                }

                                lastSelectedTextBlockIdRef.current =
                                  block.id;
                                selectedBlockIdsRef.current = [
                                  block.id,
                                ];
                              }}
                              onMouseUp={() => {
                                captureSelection(
                                  block.id,
                                );
                                syncPrimaryTextFormatState();
                              }}
                              onKeyUp={() => {
                                captureSelection(
                                  block.id,
                                );
                                syncPrimaryTextFormatState();
                              }}
                              onKeyDown={(event) => handleTextKeyDown(event, block)}
                              onInput={(event) => {
                                const element = event.currentTarget;

                                normalizeFontSizeMarkup(
                                  element,
                                  typingFontSizeRef.current,
                                );

                                const measuredUnits = Math.max(
                                  1,
                                  Math.min(
                                    PAGE_LINE_LIMIT,
                                    Math.ceil(
                                      element.scrollHeight /
                                        ROW_HEIGHT,
                                    ),
                                  ),
                                );

                                updateBlock(
                                  block.id,
                                  (currentBlock) =>
                                    currentBlock.type === "text"
                                      ? {
                                          ...currentBlock,
                                          html: element.innerHTML,
                                          units: measuredUnits,
                                        }
                                      : currentBlock,
                                );
                              }}
                              className={`min-h-7 whitespace-pre-wrap break-words text-left text-[14px] font-medium leading-7 outline-none ${
                                isDarkMode
                                  ? "text-[#efefef]"
                                  : "text-[#302b27]"
                              }`}
                            />

                            {block.annotation && (
                              <div
                                className={`relative h-7 text-[13px] ${
                                  isDarkMode
                                    ? "text-[#d9d9d9]"
                                    : "text-[#5b554c]"
                                }`}
                              >
                                <div
                                  className="pointer-events-none absolute top-[4px] h-[18px]"
                                  style={{
                                    left: `${
                                      block.annotation
                                        .anchorPercent ??
                                      50
                                    }%`,
                                    width: "28px",
                                  }}
                                  title={
                                    block.annotation.quote
                                  }
                                >
                                  <svg
                                    viewBox="0 0 28 18"
                                    className="h-[18px] w-[28px] overflow-visible"
                                    aria-hidden="true"
                                  >
                                    <path
                                      d="M4 1.5 V9.5 Q4 13 7.5 13 H19"
                                      fill="none"
                                      stroke="#d6a800"
                                      strokeWidth="2.2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <path
                                      d="M15.5 9.8 L19.5 13 L15.5 16.2"
                                      fill="none"
                                      stroke="#d6a800"
                                      strokeWidth="2.2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </div>

                                <input
                                  data-study-annotation-id={
                                    block.id
                                  }
                                  value={
                                    block.annotation.text
                                  }
                                  onKeyDown={(event) =>
                                    handleAnnotationKeyDown(
                                      event,
                                      block,
                                    )
                                  }
                                  onChange={(event) =>
                                    updateBlock(
                                      block.id,
                                      (
                                        currentBlock,
                                      ) =>
                                        currentBlock.type ===
                                          "text" &&
                                        currentBlock.annotation
                                          ? {
                                              ...currentBlock,
                                              annotation:
                                                {
                                                  ...currentBlock.annotation,
                                                  text: event
                                                    .target
                                                    .value,
                                                },
                                            }
                                          : currentBlock,
                                    )
                                  }
                                  placeholder={
                                    block.annotation.quote
                                      ? `“${block.annotation.quote}” 주석 입력`
                                      : "주석 입력"
                                  }
                                  className="absolute top-0 h-7 bg-transparent pr-7 font-bold outline-none placeholder:opacity-35"
                                  style={{
                                    left: `calc(${block.annotation.anchorPercent ?? 50}% + 30px)`,
                                    width: `calc(100% - (${block.annotation.anchorPercent ?? 50}% + 38px))`,
                                  }}
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateBlock(
                                      block.id,
                                      (
                                        currentBlock,
                                      ) => {
                                        if (
                                          currentBlock.type !==
                                          "text"
                                        ) {
                                          return currentBlock;
                                        }

                                        const {
                                          annotation:
                                            _annotation,
                                          ...remainingBlock
                                        } = currentBlock;

                                        return remainingBlock;
                                      },
                                    )
                                  }
                                  className="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-black opacity-40"
                                  title="주석 삭제"
                                  aria-label="주석 삭제"
                                >
                                  ×
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
                    </div>
                  </div>

              <aside
                className={`sticky top-0 overflow-hidden border ${
                  isDarkMode
                    ? "border-[#303238] bg-[#17191d] text-white"
                    : "border-[#deded9] bg-[#fff] text-[#302b27]"
                }`}
              >
                <div
                  className={`flex h-[48px] items-center justify-between border-b px-5 ${
                    isDarkMode ? "border-[#303238]" : "border-[#e4e4e0]"
                  }`}
                >
                  <h3 className="text-[13px] font-black">마지막 페이지 📌</h3>
                  <span className="text-[9px] font-black opacity-35">
                    본문 {notePages.length}P 뒤
                  </span>
                </div>

                <div
                  data-hoo-vertical-scroll="true"
                  className="max-h-[calc(100dvh-135px)] overflow-y-auto px-5 py-5"
                >
                  <div
                    ref={lastPageEditableRef}
                    data-study-last-page-id={selectedNote.id}
                    contentEditable
                    suppressContentEditableWarning
                    dir="ltr"
                    onInput={(event) =>
                      updateLastPageHtml(
                        event.currentTarget.innerHTML,
                      )
                    }
                    className={`min-h-[300px] whitespace-pre-wrap break-words rounded-[8px] border px-3 py-3 text-left text-[12px] font-medium leading-6 outline-none transition ${
                      isDarkMode
                        ? "border-white/10 bg-white/[0.025] text-[#efefef] empty:before:text-white/20 focus:border-[#d6b522]/60"
                        : "border-black/10 bg-[#fffdf7] text-[#302b27] empty:before:text-black/25 focus:border-[#d6b522]"
                    } empty:before:pointer-events-none empty:before:content-['자유롭게_기록하세요.']`}
                  />

                  <div
                    className={`mt-5 border-t pt-4 text-[9px] font-bold leading-5 opacity-40 ${
                      isDarkMode ? "border-white/10" : "border-black/10"
                    }`}
                  >
                    <p>본문과 별도로 자유롭게 작성됩니다.</p>
                    <p>본문 페이지가 늘어나도 항상 파일의 마지막 페이지로 유지됩니다.</p>
                    <p className="mt-2 font-black">(무한 기록 가능)</p>
                  </div>
                </div>
              </aside>
                </div>
                </div>
              </div>
            </div>
          </main>

        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type StudyTextBlock = {
  id: string;
  type: "text";
  html?: string;
  text?: string;
  units?: number;
  brace?: boolean;
  annotation?: {
    quote?: string;
    text?: string;
  };
};

type StudyImageBlock = {
  id: string;
  type: "image";
  alt?: string;
  src?: string;
  size?: "small" | "medium" | "large";
  units?: number;
  storagePath?: string;
};

type StudyLastPageBlock = {
  id: string;
  type: "last-page";
  html?: string;
  role?: "last-page";
};

type StudyBlock =
  | StudyTextBlock
  | StudyImageBlock
  | StudyLastPageBlock;

type StudyNoteRow = {
  id: string;
  note_date: string;
  title: string;
  category: string;
  blocks: StudyBlock[];
  version: number;
  updated_at: string;
};

const CATEGORY_DOT_COLORS = [
  "#7c5cff",
  "#30c46c",
  "#f0c52a",
  "#ff9f1c",
  "#53b7ff",
  "#ff6b8a",
] as const;

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function formatDateWithDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[new Date(year, month - 1, day).getDay()];

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} (${weekday})`;
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function htmlToText(value: string) {
  if (typeof document === "undefined") {
    return value.replace(/<[^>]*>/g, " ");
  }

  const element = document.createElement("div");
  element.innerHTML = value;
  return element.textContent ?? "";
}

function getTextBlockContent(
  block: StudyTextBlock | StudyLastPageBlock,
) {
  if (block.type === "last-page") {
    return htmlToText(block.html ?? "");
  }

  return block.text ?? htmlToText(block.html ?? "");
}

function getSafeStudyHtml(value: string) {
  if (typeof document === "undefined") {
    return value
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
      .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "");
  }

  const root = document.createElement("div");
  root.innerHTML = value;

  root
    .querySelectorAll("script, iframe, object, embed, style, link")
    .forEach((element) => element.remove());

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const attributeValue = attribute.value.trim().toLowerCase();

      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (
        (name === "href" || name === "src") &&
        attributeValue.startsWith("javascript:")
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  return root.innerHTML;
}

function buildLocalStudyBlocks(
  record: Record<string, unknown>,
): StudyBlock[] {
  const bodyBlocks = Array.isArray(record.blocks)
    ? (record.blocks as StudyBlock[]).filter(
        (block) => block.type !== "last-page",
      )
    : [];

  const lastPageHtml =
    typeof record.lastPageHtml === "string"
      ? record.lastPageHtml
      : "";

  if (!htmlToText(lastPageHtml).trim()) {
    return bodyBlocks;
  }

  return [
    ...bodyBlocks,
    {
      id: `${String(record.id ?? "local")}-last-page`,
      type: "last-page",
      html: lastPageHtml,
      role: "last-page",
    },
  ];
}

function getNotePreview(note: StudyNoteRow) {
  const text = note.blocks
    .flatMap((block) => {
      if (block.type === "image") {
        return [];
      }

      if (block.type === "last-page") {
        return [
          getTextBlockContent(block).trim(),
        ];
      }

      return [
        getTextBlockContent(block).trim(),
        block.annotation?.text?.trim() ?? "",
      ];
    })
    .filter(Boolean)
    .join(" / ")
    .replace(/\s+/g, " ")
    .trim();

  return text || "기록된 내용을 열어보세요.";
}

function getContinuousReaderBlocks(blocks: StudyBlock[]) {
  const continuousBlocks: StudyBlock[] = [];
  let pendingEmptyBlock: StudyTextBlock | null = null;

  for (const block of blocks) {
    if (block.type === "image") {
      if (pendingEmptyBlock && continuousBlocks.length > 0) {
        continuousBlocks.push(pendingEmptyBlock);
      }

      pendingEmptyBlock = null;
      continuousBlocks.push(block);
      continue;
    }

    if (block.type === "last-page") {
      /*
       * 마지막 페이지 앞에는 29줄 페이지를 만들기 위한 spacer를
       * 끌고 오지 않는다. 본문이 끝나는 즉시 전용 이중선 뒤로
       * 마지막 페이지를 연속 문서처럼 표시한다.
       */
      pendingEmptyBlock = null;

      if (getTextBlockContent(block).trim()) {
        continuousBlocks.push(block);
      }

      continue;
    }

    const hasText =
      getTextBlockContent(block).trim().length > 0;

    const hasAnnotation =
      Boolean(block.annotation?.quote?.trim()) ||
      Boolean(block.annotation?.text?.trim());

    const isMeaningful =
      hasText ||
      hasAnnotation ||
      Boolean(block.brace);

    if (!isMeaningful) {
      /*
       * 작성 화면의 "새 페이지"는 남은 줄 수만큼 빈 text block을
       * 채워서 다음 29줄 페이지로 넘긴다.
       * 정리본에서는 이 연속 빈 줄을 한 줄로만 압축한다.
       */
      pendingEmptyBlock ??= block;
      continue;
    }

    if (pendingEmptyBlock && continuousBlocks.length > 0) {
      continuousBlocks.push(pendingEmptyBlock);
    }

    pendingEmptyBlock = null;
    continuousBlocks.push(block);
  }

  /*
   * 문서 끝에 남은 페이지 채움용 빈 줄은 정리본에 표시하지 않는다.
   */
  return continuousBlocks;
}

export default function StudyNoteSummary() {
  const supabase = useMemo(() => createClient(), []);

  const [notes, setNotes] = useState<StudyNoteRow[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [summaryView, setSummaryView] = useState<"home" | "files" | "reader">("home");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isCancelled = false;
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    async function clearRealtimeChannel() {
      if (!realtimeChannel) {
        return;
      }

      const channel = realtimeChannel;
      realtimeChannel = null;
      await supabase.removeChannel(channel);
    }

    async function loadNotes() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (!isCancelled) {
          setNotes([]);
          setImageUrls({});
          setIsLoading(false);
          setErrorMessage(
            "로그인하면 후터디노트 기록을 볼 수 있어요.",
          );
        }
        return null;
      }

      /*
       * HOO 메인과 /study-note는 같은 origin을 사용하므로
       * 같은 IndexedDB의 후터디노트 기록도 읽을 수 있다.
       *
       * Supabase가 아직 반영되지 않았거나 Realtime 반영이 늦어도
       * 현재 기기의 작성 기록은 정리본에서 즉시 보이게 한다.
       */
      async function loadLocalStudyNotes(): Promise<StudyNoteRow[]> {
        if (
          typeof window === "undefined" ||
          !("indexedDB" in window)
        ) {
          return [];
        }

        try {
          const database = await new Promise<IDBDatabase>(
            (resolve, reject) => {
              const request = window.indexedDB.open(
                "hoo-study-note-db",
                2,
              );

              request.onsuccess = () =>
                resolve(request.result);

              request.onerror = () =>
                reject(
                  request.error ??
                    new Error(
                      "후터디노트 IndexedDB를 열 수 없습니다.",
                    ),
                );
            },
          );

          try {
            if (
              !database.objectStoreNames.contains("notes")
            ) {
              return [];
            }

            const records =
              await new Promise<Array<Record<string, unknown>>>(
                (resolve, reject) => {
                  const transaction =
                    database.transaction(
                      "notes",
                      "readonly",
                    );

                  const request =
                    transaction
                      .objectStore("notes")
                      .getAll();

                  request.onsuccess = () => {
                    resolve(
                      Array.isArray(request.result)
                        ? (request.result as Array<
                            Record<string, unknown>
                          >)
                        : [],
                    );
                  };

                  request.onerror = () =>
                    reject(
                      request.error ??
                        new Error(
                          "후터디노트 IndexedDB 기록을 읽을 수 없습니다.",
                        ),
                    );
                },
              );

            return records.map((record) => ({
              id: String(record.id ?? ""),
              note_date:
                typeof record.date === "string"
                  ? record.date
                  : "",
              title:
                typeof record.title === "string" &&
                record.title.trim()
                  ? record.title
                  : "제목 없는 기록",
              category:
                typeof record.category === "string" &&
                record.category.trim()
                  ? record.category
                  : "미분류",
              blocks:
                buildLocalStudyBlocks(
                  record,
                ),
              version:
                Number(record.version) || 1,
              updated_at:
                typeof record.updatedAt === "string"
                  ? record.updatedAt
                  : new Date(0).toISOString(),
            }));
          } finally {
            database.close();
          }
        } catch (localError) {
          console.warn(
            "후터디노트 로컬 정리본 불러오기 실패:",
            localError,
          );
          return [];
        }
      }

      const [
        localNotes,
        remoteResult,
      ] = await Promise.all([
        loadLocalStudyNotes(),
        supabase
          .from("hoo_study_notes")
          .select(`
            id,
            note_date,
            title,
            category,
            blocks,
            version,
            updated_at
          `)
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("updated_at", {
            ascending: false,
          })
          .limit(200),
      ]);

      const {
        data,
        error,
      } = remoteResult;

      /*
       * 서버 조회가 실패해도 현재 기기의 IndexedDB 기록은
       * 정리본에서 계속 보여준다.
       */
      if (error) {
        console.warn(
          "후터디노트 정리본 서버 불러오기 실패:",
          {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          },
        );
      }

      const remoteNotes: StudyNoteRow[] =
        !error && Array.isArray(data)
          ? data.map((note) => ({
              id: note.id,
              note_date: note.note_date,
              title:
                typeof note.title === "string" &&
                note.title.trim()
                  ? note.title
                  : "제목 없는 기록",
              category:
                typeof note.category === "string" &&
                note.category.trim()
                  ? note.category
                  : "미분류",
              blocks: Array.isArray(note.blocks)
                ? (note.blocks as StudyBlock[])
                : [],
              version:
                Number(note.version) || 1,
              updated_at: note.updated_at,
            }))
          : [];

      /*
       * 같은 기기에서는 IndexedDB의 로컬 노트가 실제 작성 원본이다.
       * Supabase updated_at이 더 늦다는 이유만으로 원격 blocks를 선택하면
       * 동기화 실패/지연 시 2페이지 이후 블록이나 로컬 사진(src)이 사라질 수 있다.
       *
       * 따라서:
       * - 같은 id의 로컬 기록이 있으면 로컬 blocks를 우선 사용한다.
       * - 원격 기록은 로컬 이미지에 빠진 storagePath만 보충한다.
       * - 다른 기기처럼 로컬 기록이 없는 노트는 Supabase 기록을 그대로 사용한다.
       */
      const mergedById =
        new Map<string, StudyNoteRow>();

      for (const note of remoteNotes) {
        mergedById.set(note.id, note);
      }

      for (const localNote of localNotes) {
        if (!localNote.id) {
          continue;
        }

        const remoteNote =
          mergedById.get(localNote.id);

        if (!remoteNote) {
          mergedById.set(
            localNote.id,
            localNote,
          );
          continue;
        }

        const remoteImageById = new Map(
          remoteNote.blocks
            .filter(
              (block): block is StudyImageBlock =>
                block.type === "image",
            )
            .map((block) => [block.id, block]),
        );

        const mergedLocalBlocks =
          localNote.blocks.map((block) => {
            if (block.type !== "image") {
              return block;
            }

            const remoteImage =
              remoteImageById.get(block.id);

            if (
              block.storagePath ||
              !remoteImage?.storagePath
            ) {
              return block;
            }

            return {
              ...block,
              storagePath:
                remoteImage.storagePath,
            };
          });

        const localHasLastPage =
          mergedLocalBlocks.some(
            (block) =>
              block.type === "last-page" &&
              getTextBlockContent(block).trim().length > 0,
          );

        const remoteLastPage =
          remoteNote.blocks.find(
            (block): block is StudyLastPageBlock =>
              block.type === "last-page" &&
              getTextBlockContent(block).trim().length > 0,
          );

        const mergedLocalBlocksWithLastPage =
          !localHasLastPage &&
          remoteLastPage
            ? [
                ...mergedLocalBlocks,
                remoteLastPage,
              ]
            : mergedLocalBlocks;

        mergedById.set(localNote.id, {
          ...remoteNote,
          ...localNote,
          blocks:
            mergedLocalBlocksWithLastPage.length > 0
              ? mergedLocalBlocksWithLastPage
              : remoteNote.blocks,
          version: Math.max(
            Number(localNote.version) || 1,
            Number(remoteNote.version) || 1,
          ),
          updated_at:
            Date.parse(localNote.updated_at) >=
            Date.parse(remoteNote.updated_at)
              ? localNote.updated_at
              : remoteNote.updated_at,
        });
      }

      const normalizedNotes =
        Array.from(
          mergedById.values(),
        ).sort(
          (first, second) =>
            second.updated_at.localeCompare(
              first.updated_at,
            ),
        );

      const storagePaths = Array.from(
        new Set(
          normalizedNotes.flatMap((note) =>
            note.blocks.flatMap((block) =>
              block.type === "image" &&
              block.storagePath
                ? [block.storagePath]
                : [],
            ),
          ),
        ),
      );

      let nextImageUrls:
        Record<string, string> = {};

      if (storagePaths.length > 0) {
        const {
          data: signedImages,
          error: signedImageError,
        } =
          await supabase.storage
            .from("hoo-study-note-images")
            .createSignedUrls(
              storagePaths,
              60 * 60,
            );

        if (signedImageError) {
          console.warn(
            "후터디노트 사진 URL 생성 실패:",
            {
              message:
                signedImageError.message,
            },
          );
        } else {
          nextImageUrls =
            (signedImages ?? []).reduce<
              Record<string, string>
            >(
              (result, image) => {
                if (
                  image.path &&
                  image.signedUrl
                ) {
                  result[image.path] =
                    image.signedUrl;
                }

                return result;
              },
              {},
            );
        }
      }

      if (!isCancelled) {
        setNotes(normalizedNotes);
        setImageUrls(nextImageUrls);
        setIsLoading(false);

        if (
          normalizedNotes.length === 0 &&
          error
        ) {
          setErrorMessage(
            "정리본을 불러오지 못했어요.",
          );
        } else {
          setErrorMessage("");
        }
      }

      return user;
    }

    let realtimeStartSequence = 0;

    async function startRealtime() {
      const startSequence = ++realtimeStartSequence;

      await clearRealtimeChannel();

      const user = await loadNotes();

      if (
        !user ||
        isCancelled ||
        startSequence !== realtimeStartSequence
      ) {
        return;
      }

      const channel = supabase.channel(
        `hoo-study-note-summary-${user.id}-${startSequence}-${Date.now()}`,
      );

      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hoo_study_notes",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadNotes();
        },
      );

      if (
        isCancelled ||
        startSequence !== realtimeStartSequence
      ) {
        void supabase.removeChannel(channel);
        return;
      }

      realtimeChannel = channel;
      realtimeChannel.subscribe();
    }

    void startRealtime();

    function refreshSummaryFromLocal() {
      if (isCancelled) {
        return;
      }

      /*
       * 후터디노트 작성 탭/페이지에서 HOO 메인으로 돌아오는 순간
       * IndexedDB를 다시 읽는다.
       *
       * Supabase 동기화가 실패해도 2페이지, 사진, 최신 본문이
       * 현재 기기 정리본에 즉시 반영된다.
       */
      void loadNotes();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshSummaryFromLocal();
      }
    }

    window.addEventListener("focus", refreshSummaryFromLocal);
    window.addEventListener("pageshow", refreshSummaryFromLocal);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (isCancelled) {
        return;
      }

      setIsLoading(true);
      setSelectedNoteId(null);
      setSelectedCategory("전체");
      setSummaryView("home");
      void startRealtime();
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();

      window.removeEventListener(
        "focus",
        refreshSummaryFromLocal,
      );
      window.removeEventListener(
        "pageshow",
        refreshSummaryFromLocal,
      );
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      if (realtimeChannel) {
        void supabase.removeChannel(realtimeChannel);
      }
    };
  }, [supabase]);

  const categories = useMemo(
    () => Array.from(new Set(notes.map((note) => note.category))).sort(),
    [notes],
  );

  const categoryColorMap = useMemo(() => {
    return categories.reduce<Record<string, string>>((result, category, index) => {
      result[category] =
        CATEGORY_DOT_COLORS[index % CATEGORY_DOT_COLORS.length] ?? "#7c5cff";
      return result;
    }, {});
  }, [categories]);

  const visibleNotes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return notes.filter((note) => {
      if (selectedCategory !== "전체" && note.category !== selectedCategory) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        note.note_date,
        note.title,
        note.category,
        ...note.blocks.flatMap((block) => {
          if (block.type === "text") {
            return [
              getTextBlockContent(block),
              block.annotation?.quote ?? "",
              block.annotation?.text ?? "",
            ];
          }

          if (block.type === "last-page") {
            return [
              getTextBlockContent(block),
            ];
          }

          return [block.alt ?? ""];
        }),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [notes, searchQuery, selectedCategory]);

  const categoryCounts = useMemo(
    () =>
      categories.reduce<Record<string, number>>((result, category) => {
        result[category] = notes.filter((note) => note.category === category).length;
        return result;
      }, {}),
    [categories, notes],
  );

  const categoryFiles = useMemo(() => {
    if (selectedCategory === "전체") {
      return visibleNotes;
    }

    return visibleNotes.filter((note) => note.category === selectedCategory);
  }, [selectedCategory, visibleNotes]);

  const recentFiles = useMemo(
    () => [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5),
    [notes],
  );

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  const continuousReaderBlocks = useMemo(
    () =>
      getContinuousReaderBlocks(
        selectedNote?.blocks ?? [],
      ),
    [selectedNote?.blocks],
  );

  function openFolder(category: string) {
    setSelectedCategory(category);
    setSelectedNoteId(null);
    setSummaryView("files");
  }

  function openFile(noteId: string) {
    setSelectedNoteId(noteId);
    setSummaryView("reader");
  }

  function goHome() {
    setSelectedCategory("전체");
    setSelectedNoteId(null);
    setSearchQuery("");
    setSummaryView("home");
  }

  function goBack() {
    if (summaryView === "reader") {
      setSelectedNoteId(null);
      setSummaryView("files");
      return;
    }

    if (summaryView === "files") {
      setSelectedCategory("전체");
      setSelectedNoteId(null);
      setSearchQuery("");
      setSummaryView("home");
    }
  }

  return (
    <article className="flex h-[660px] min-h-[660px] max-h-[660px] min-w-0 flex-col overflow-hidden rounded-[30px] border border-white/20 bg-[#15171d]/95 text-white shadow-[0_25px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl">
      <header className="shrink-0 border-b border-white/10 px-6 py-5">
        <div className="relative min-h-[72px]">
          <div
            className={`min-w-0 ${
              summaryView === "home"
                ? "pr-[210px]"
                : "pr-[96px]"
            }`}
          >
            <p className="text-[10px] font-black tracking-[0.18em] text-[#8f91a8]">
              HOO STUDY NOTE
            </p>

            <h2 className="mt-1 truncate text-[22px] font-black tracking-[-0.04em] text-white">
              후터디노트 정리본
            </h2>

            {summaryView !== "home" && (
              <div className="mt-2 flex items-center gap-2 text-[9px] font-black text-white/35">
                <button
                  type="button"
                  onClick={goHome}
                  className="transition hover:text-white/70"
                >
                  홈
                </button>
                <span>›</span>
                <span className="truncate">
                  {selectedCategory === "전체" ? "전체 파일" : selectedCategory}
                </span>
                {summaryView === "reader" && selectedNote && (
                  <>
                    <span>›</span>
                    <span className="max-w-[130px] truncate">
                      {selectedNote.title}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {summaryView === "home" ? (
            <a
              href="/study-note"
              style={{
                position: "absolute",
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
              }}
              className="shrink-0 rounded-xl border border-white/80 bg-white/5 px-8 py-5 text-[15px] font-black text-white shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition hover:bg-white/10 active:scale-95"
            >
              HOO노트 입장
            </a>
          ) : (
            <button
              type="button"
              onClick={goBack}
              className="absolute right-0 top-0 shrink-0 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black text-white/80 transition hover:bg-white/15"
            >
              ← 뒤로가기
            </button>
          )}
        </div>
      </header>

      <section
        data-hoo-vertical-scroll="true"
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5 [scrollbar-color:rgba(124,92,255,0.55)_transparent] [scrollbar-width:thin]"
      >
        {isLoading && (
          <div className="flex min-h-52 items-center justify-center text-center text-xs font-black text-white/40">
            정리본을 불러오는 중...
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="flex min-h-52 items-center justify-center text-center text-xs font-black leading-6 text-white/40">
            {errorMessage}
          </div>
        )}

        {!isLoading && !errorMessage && notes.length === 0 && (
          <div className="flex min-h-52 items-center justify-center text-center text-xs font-black leading-6 text-white/40">
            표시할 기록이 없어요.
            <br />
            후터디노트에서 첫 기록을 작성해 보세요.
          </div>
        )}

        {!isLoading && !errorMessage && notes.length > 0 && summaryView === "home" && (
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black tracking-[0.14em] text-white/30">
                    CATEGORY
                  </p>
                  <h3 className="mt-1 text-[14px] font-black text-white/85">
                    폴더
                  </h3>
                </div>
                <span className="text-[9px] font-bold text-white/25">
                  폴더를 누르면 파일이 열립니다
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => openFolder("전체")}
                  className="group rounded-[18px] border border-white/10 bg-white/[0.045] p-4 text-left transition hover:bg-white/[0.075]"
                >
                  <div className="relative h-12">
                    <div className="absolute left-1 top-1 h-4 w-12 rounded-t-md bg-[#7765dd]/75" />
                    <div className="absolute inset-x-0 bottom-0 h-10 rounded-lg bg-[#6f5bd7]/90 shadow-[0_8px_24px_rgba(111,91,215,0.18)]" />
                  </div>
                  <p className="mt-3 text-[12px] font-black text-white">전체 노트</p>
                  <p className="mt-1 text-[9px] font-bold text-white/35">{notes.length}개 파일</p>
                </button>

                {categories.map((category, index) => {
                  const dotColor =
                    categoryColorMap[category] ??
                    CATEGORY_DOT_COLORS[index % CATEGORY_DOT_COLORS.length];

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => openFolder(category)}
                      className="group rounded-[18px] border border-white/10 bg-white/[0.045] p-4 text-left transition hover:bg-white/[0.075]"
                    >
                      <div className="relative h-12">
                        <div
                          className="absolute left-1 top-1 h-4 w-12 rounded-t-md opacity-70"
                          style={{ backgroundColor: dotColor }}
                        />
                        <div
                          className="absolute inset-x-0 bottom-0 h-10 rounded-lg opacity-85 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
                          style={{ backgroundColor: dotColor }}
                        />
                      </div>
                      <p className="mt-3 truncate text-[12px] font-black text-white">
                        {category}
                      </p>
                      <p className="mt-1 text-[9px] font-bold text-white/35">
                        {categoryCounts[category] ?? 0}개 파일
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-3">
                <p className="text-[9px] font-black tracking-[0.14em] text-white/30">
                  RECENT FILES
                </p>
                <h3 className="mt-1 text-[14px] font-black text-white/85">
                  최근 파일
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {recentFiles.map((note) => {
                  const dotColor =
                    categoryColorMap[note.category] ?? CATEGORY_DOT_COLORS[0];

                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => openFile(note.id)}
                      className="group flex items-center gap-3 rounded-[14px] border border-white/10 bg-black/15 px-4 py-3 text-left transition hover:bg-white/[0.05]"
                    >
                      <div className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.05]">
                        <span className="text-[14px] text-white/45">▤</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                          <p className="truncate text-[11px] font-black text-white/80">
                            {note.title}
                          </p>
                        </div>
                        <p className="mt-1 truncate text-[8px] font-bold text-white/30">
                          {formatDateWithDay(note.note_date)} · {note.category}
                        </p>
                      </div>

                      <span className="text-lg text-white/20 transition group-hover:text-white/45">
                        ›
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {!isLoading && !errorMessage && notes.length > 0 && summaryView === "files" && (
          <div>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-black tracking-[0.14em] text-white/30">
                  FILES
                </p>
                <h3 className="mt-1 text-[16px] font-black text-white">
                  {selectedCategory === "전체" ? "전체 파일" : selectedCategory}
                </h3>
              </div>

              <span className="text-[9px] font-black text-white/30">
                {categoryFiles.length}개
              </span>
            </div>

            <div className="space-y-2">
              {categoryFiles.map((note) => {
                const dotColor =
                  categoryColorMap[note.category] ?? CATEGORY_DOT_COLORS[0];

                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => openFile(note.id)}
                    className="group block w-full rounded-[14px] border border-white/10 bg-white/[0.035] px-4 py-3 text-left transition hover:bg-white/[0.065]"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />
                      <span className="text-[11px] font-black text-white/75">
                        {formatDateWithDay(note.note_date)}
                      </span>
                      <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-black text-white/45">
                        {note.category}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-black text-white">
                          {note.title}
                        </p>
                        <p className="mt-1 truncate text-[9px] font-bold text-white/35">
                          {getNotePreview(note)}
                        </p>
                      </div>

                      <span className="shrink-0 text-lg text-white/20 transition group-hover:text-white/50">
                        ›
                      </span>
                    </div>
                  </button>
                );
              })}

              {categoryFiles.length === 0 && (
                <div className="py-16 text-center text-[11px] font-black text-white/35">
                  이 폴더에는 표시할 파일이 없어요.
                </div>
              )}
            </div>
          </div>
        )}

        {!isLoading &&
          !errorMessage &&
          notes.length > 0 &&
          summaryView === "reader" &&
          selectedNote && (
            <div>
              <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-black text-white/35">
                      {formatDateWithDay(selectedNote.note_date)}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-black text-white/45">
                      {selectedNote.category}
                    </span>
                  </div>
                  <h3 className="mt-2 truncate text-[16px] font-black text-white">
                    {selectedNote.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setSummaryView("files")}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[9px] font-black text-white/55 transition hover:bg-white/10"
                >
                  파일 목록
                </button>
              </div>

              <div className="space-y-1.5">
                {continuousReaderBlocks.map((block) => {
                  if (block.type === "last-page") {
                    const lastPageHtml =
                      typeof block.html === "string"
                        ? block.html
                        : "";

                    if (
                      !getTextBlockContent(
                        block,
                      ).trim()
                    ) {
                      return null;
                    }

                    return (
                      <section
                        key={block.id}
                        className="mt-5"
                      >
                        <div
                          className="mb-3 space-y-[3px]"
                          aria-hidden="true"
                        >
                          <div className="h-px w-full bg-white/20" />
                          <div className="h-px w-full bg-white/10" />
                        </div>

                        <div
                          className="
                            whitespace-pre-wrap break-words
                            text-[8.5px] font-medium leading-[1.65] text-white/75
                            [&_u]:decoration-[#f5d83b] [&_u]:decoration-[1.5px] [&_u]:underline-offset-[2px]
                            [&_span[style*='background-color']]:rounded-[2px]
                            [&_span[style*='background-color']]:px-[1px]
                            [&_span[style*='background-color']]:text-[#171717]
                            [&_[style*='background-color']]:rounded-[2px]
                            [&_[style*='background-color']]:px-[1px]
                            [&_[style*='background-color']]:text-[#171717]
                          "
                          dangerouslySetInnerHTML={{
                            __html:
                              getSafeStudyHtml(
                                lastPageHtml,
                              ),
                          }}
                        />
                      </section>
                    );
                  }

                  if (block.type === "image") {
                    const signedUrl = block.storagePath
                      ? imageUrls[block.storagePath]
                      : undefined;

                    const imageSource =
                      signedUrl ||
                      (typeof block.src === "string" && block.src
                        ? block.src
                        : undefined);

                    const imageHeightClass =
                      block.size === "small"
                        ? "max-h-[130px]"
                        : block.size === "large"
                          ? "max-h-[320px]"
                          : "max-h-[220px]";

                    return imageSource ? (
                      <figure
                        key={block.id}
                        className="my-2 overflow-hidden rounded-[10px] border border-white/10 bg-black/20"
                      >
                        <img
                          src={imageSource}
                          alt={block.alt ?? "후터디노트 사진"}
                          className={`w-full object-contain ${imageHeightClass}`}
                        />
                        {block.alt && (
                          <figcaption className="border-t border-white/[0.06] px-2 py-1 text-[7px] font-bold text-white/25">
                            {block.alt}
                          </figcaption>
                        )}
                      </figure>
                    ) : (
                      <div
                        key={block.id}
                        className="my-2 flex h-20 items-center justify-center rounded-[10px] border border-dashed border-white/10 text-[8px] font-bold text-white/25"
                      >
                        사진 불러오는 중
                      </div>
                    );
                  }

                  const rawHtml =
                    typeof block.html === "string"
                      ? block.html
                      : "";

                  const fallbackText =
                    typeof block.text === "string"
                      ? block.text
                      : "";

                  const hasContent =
                    getTextBlockContent(block).trim().length > 0;

                  const annotationText =
                    block.annotation?.text?.trim() ?? "";

                  const annotationQuote =
                    block.annotation?.quote?.trim() ?? "";

                  if (
                    !hasContent &&
                    !annotationText &&
                    !annotationQuote
                  ) {
                    return (
                      <div
                        key={block.id}
                        className="h-[8px] border-b border-white/[0.035]"
                      />
                    );
                  }

                  return (
                    <div
                      key={block.id}
                      className={`relative border-b border-white/[0.035] py-1 ${
                        block.brace
                          ? "ml-2 rounded-l-[12px] border-l-2 border-l-[#f0c52a] pl-3"
                          : ""
                      }`}
                    >
                      {block.brace && (
                        <>
                          <span className="pointer-events-none absolute -left-[2px] top-0 h-2 w-2 rounded-tl-[8px] border-l-2 border-t-2 border-[#f0c52a]" />
                          <span className="pointer-events-none absolute -bottom-[1px] -left-[2px] h-2 w-2 rounded-bl-[8px] border-b-2 border-l-2 border-[#f0c52a]" />
                        </>
                      )}

                      {hasContent && rawHtml ? (
                        <div
                          className="
                            break-words whitespace-pre-wrap
                            text-[8.5px] font-medium leading-[1.55] text-white/75
                            [&_u]:decoration-[#f5d83b] [&_u]:decoration-[1.5px] [&_u]:underline-offset-[2px]
                            [&_span[style*='background-color']]:rounded-[2px]
                            [&_span[style*='background-color']]:px-[1px]
                            [&_span[style*='background-color']]:text-[#171717]
                            [&_[style*='background-color']]:rounded-[2px]
                            [&_[style*='background-color']]:px-[1px]
                            [&_[style*='background-color']]:text-[#171717]
                          "
                          dangerouslySetInnerHTML={{
                            __html: getSafeStudyHtml(rawHtml),
                          }}
                        />
                      ) : hasContent ? (
                        <p className="whitespace-pre-wrap break-words text-[8.5px] font-medium leading-[1.55] text-white/75">
                          {fallbackText}
                        </p>
                      ) : null}

                      {(annotationText || annotationQuote) && (
                        <div className="mt-1.5 rounded-[7px] border border-[#e3bd2b]/25 bg-[#e3bd2b]/[0.055] px-2 py-1.5">
                          {annotationQuote && (
                            <p className="truncate text-[7px] font-black text-[#f2d75e]/70">
                              ↳ {annotationQuote}
                            </p>
                          )}

                          {annotationText && (
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-[8px] font-bold leading-[1.45] text-white/55">
                              {annotationText}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-white/10 pt-3 text-right text-[7px] font-black text-white/20">
                읽기 전용 · v{selectedNote.version} ·{" "}
                {new Date(selectedNote.updated_at).toLocaleString("ko-KR")}
              </div>
            </div>
          )}
      </section>

      <footer className="shrink-0 border-t border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-[10px] font-black text-white/55">
            총 {notes.length}개 기록
          </span>

          <div className="relative min-w-0 flex-1">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => {
                if (summaryView === "home") {
                  setSelectedCategory("전체");
                  setSummaryView("files");
                }
              }}
              placeholder="키워드로 검색 (Ctrl + F)"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 pr-9 text-[10px] font-bold text-white outline-none placeholder:text-white/25 focus:border-[#6f5bd7]"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/30">
              ⌕
            </span>
          </div>
        </div>
      </footer>
    </article>
  );
}

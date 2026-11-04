"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Props = {
  isDarkMode: boolean;
  children: ReactNode;
};

export default function StudyNoteCollapsibleSidebar({
  isDarkMode,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function onOutsideClick(event: MouseEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        !rootRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onOutsideClick);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onOutsideClick);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 ease-out ${
        open ? "w-[266px]" : "w-[44px]"
      } ${
        isDarkMode
          ? "border-[#34373d] bg-[#15171a] text-white"
          : "border-[#e2e2df] bg-[#fafaf8] text-[#242424]"
      }`}
    >
      <div className="flex h-12 shrink-0 items-center gap-2 px-1">
        <button
          type="button"
          aria-label={
            open ? "카테고리 닫기" : "카테고리 열기"
          }
          aria-expanded={open}
          onClick={() => setOpen((previous) => !previous)}
          title={open ? "카테고리 닫기" : "카테고리 열기"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg transition ${
            isDarkMode
              ? "hover:bg-white/10"
              : "hover:bg-black/10"
          }`}
        >
          ☰
        </button>

        {open && (
          <>
            <span className="min-w-0 flex-1 truncate text-xs font-black">
              카테고리
            </span>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="카테고리 닫기"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </>
        )}
      </div>

      {open && (
        <div
          role="region"
          aria-label="카테고리 패널"
          className="min-h-0 flex-1 overflow-y-auto [&>aside]:min-h-full [&>aside]:w-full"
        >
          {children}
        </div>
      )}
    </div>
  );
}

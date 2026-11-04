"use client";

import { useEffect, useState, type ReactNode } from "react";

type Props = {
  isDarkMode: boolean;
  children: ReactNode;
};

export default function StudyNoteCollapsibleSidebar({
  isDarkMode,
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <>
      <nav
        aria-label="카테고리 메뉴"
        className={`flex min-h-0 flex-col items-center border-r pt-3 ${
          isDarkMode
            ? "border-[#34373d] bg-[#15171a]"
            : "border-[#e2e2df] bg-[#fafaf8]"
        }`}
      >
        <button
          type="button"
          aria-label="카테고리 열기"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-white/10"
        >
          ☰
        </button>
      </nav>

      {open && (
        <button
          type="button"
          aria-label="카테고리 닫기"
          onClick={() => setOpen(false)}
          className="absolute inset-0 z-[90] bg-black/35"
        />
      )}

      <div
        role="region"
        aria-label="카테고리 패널"
        aria-hidden={!open}
        inert={!open}
        className={`absolute inset-y-0 left-0 z-[100] flex min-h-0 w-[266px] max-w-[calc(100vw-8px)] flex-col overflow-hidden shadow-2xl transition-transform duration-200 ease-out ${
          open
            ? "translate-x-0"
            : "pointer-events-none -translate-x-full"
        } ${
          isDarkMode
            ? "bg-[#15171a] text-white"
            : "bg-[#fafaf8] text-[#242424]"
        }`}
      >
        <div className={`flex h-12 shrink-0 items-center justify-between border-b px-4 ${
          isDarkMode
            ? "border-[#34373d]"
            : "border-[#e2e2df]"
        }`}>
          <span className="text-xs font-black">
            카테고리
          </span>

          <button
            type="button"
            aria-label="카테고리 닫기"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl hover:bg-white/10"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto [&>aside]:h-full [&>aside]:w-full">
          {children}
        </div>
      </div>
    </>
  );
}

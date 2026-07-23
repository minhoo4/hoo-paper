"use client";

import type {
  ProfileTab,
} from "../types/focus";

type ProfileNavigationProps = {
  activeTab: ProfileTab;
  onChange:
    (tab: ProfileTab) => void;
};

export default function ProfileNavigation({
  activeTab,
  onChange,
}: ProfileNavigationProps) {
  const profileTab = activeTab;
  const setProfileTab = onChange;

  return (
<nav className="mt-7 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.035] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {([
                  ["overview", "OVERVIEW"],
                  ["calendar", "CALENDAR"],
                  ["achievements", "ACHIEVEMENTS"],
                ] as const).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setProfileTab(tab)}
                    className={`min-w-fit flex-1 rounded-xl px-4 py-3 text-[11px] font-black tracking-[0.16em] transition ${
                      profileTab === tab
                        ? "bg-[#7869e8] text-white shadow-[0_10px_28px_rgba(70,57,160,0.35)]"
                        : "text-white/45 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
  );
}

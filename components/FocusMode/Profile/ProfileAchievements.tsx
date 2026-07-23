"use client";

import type {
  FocusStatistics,
} from "../types/focus";

type ProfileAchievementsProps = {
  statistics: FocusStatistics | null;
};

export default function ProfileAchievements({
  statistics,
}: ProfileAchievementsProps) {
  const profileTab = "achievements";
  const profileStatistics =
    statistics;

  return (
    <>
{profileTab === "achievements" && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["첫걸음", "첫 집중을 완료하세요.", "✦"],
                    ["꾸준한 불씨", "3일 연속 집중하세요.", "♨"],
                    ["몰입의 시간", "누적 10시간을 달성하세요.", "◷"],
                    ["긴 호흡", "한 번에 2시간 집중하세요.", "◇"],
                    ["일주일의 약속", "7일 연속 집중하세요.", "◆"],
                    ["백 번의 시작", "집중 세션 100회를 완료하세요.", "◎"],
                  ].map(([title, description, icon], index) => (
                    <article
                      key={title}
                      className={`rounded-[24px] border p-5 ${
                        index === 0 &&
                        (profileStatistics?.totalSessions ?? 0) > 0
                          ? "border-[#8d7cff]/55 bg-[#7667e8]/15"
                          : "border-white/10 bg-white/[0.035]"
                      }`}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-xl text-[#a99cff]">
                        {icon}
                      </div>
                      <h3 className="mt-4 text-lg font-black">
                        {title}
                      </h3>
                      <p className="mt-2 text-xs font-bold leading-5 text-white/40">
                        {description}
                      </p>
                      <p className="mt-5 text-[10px] font-black tracking-[0.14em] text-white/28">
                        {index === 0 &&
                        (profileStatistics?.totalSessions ?? 0) > 0
                          ? "UNLOCKED"
                          : "LOCKED"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
    </>
  );
}

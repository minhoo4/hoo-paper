"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import HooWorldPlayer from "@/components/HooWorld/HooWorldPlayer";
import {
  useHooWorldPresence,
} from "@/components/HooWorld/hooks/useHooWorldPresence";

export default function HooWorldPage() {
  const [
    nickname,
    setNickname,
  ] = useState<string | null>(null);

  const {
    onlineCount,
    isConnected,
    status,
  } = useHooWorldPresence({
    enabled: true,
    nickname,
  });

  useEffect(() => {
    async function loadNickname() {
      try {
        const response =
          await fetch(
            "/api/admin/me",
            {
              cache: "no-store",
            },
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        if (
          typeof data?.nickname ===
            "string" &&
          data.nickname.trim()
        ) {
          setNickname(
            data.nickname.trim(),
          );
        }
      } catch (error) {
        console.error(
          "HOO WORLD 사용자 정보를 불러오지 못했습니다.",
          error,
        );
      }
    }

    void loadNickname();
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#d8e6ce] text-[#25231f]">
      {/* 하늘 */}
      <div className="absolute inset-x-0 top-0 h-[48%] bg-gradient-to-b from-[#b9d9ed] to-[#e7f1df]" />

      {/* 바닥 */}
      <div className="absolute inset-x-0 bottom-0 h-[58%] bg-[#a9c98f]" />

      {/* 멀리 보이는 언덕 */}
      <div className="absolute left-[-10%] top-[35%] h-56 w-[55%] rounded-[50%] bg-[#8fb77b]" />

      <div className="absolute right-[-12%] top-[31%] h-64 w-[58%] rounded-[50%] bg-[#98bd82]" />

      {/* 상단 HUD */}
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between p-5 sm:p-7">
        <Link
          href="/"
          className="rounded-2xl border border-white/40 bg-white/75 px-4 py-2.5 text-sm font-black shadow-lg backdrop-blur-xl transition hover:bg-white"
        >
          ← HOO
        </Link>

        <div className="rounded-2xl border border-white/40 bg-black/65 px-4 py-3 text-white shadow-lg backdrop-blur-xl">
          <p className="text-[10px] font-black tracking-[0.18em] text-white/55">
            HOO WORLD
          </p>

          <p className="mt-0.5 text-sm font-black">
            {isConnected
              ? `온라인 ${onlineCount}명`
              : "접속 중..."}
          </p>
        </div>
      </header>

      {/* 월드 이름 */}
      <div className="absolute left-1/2 top-[12%] z-10 -translate-x-1/2 text-center">
        <p className="text-xs font-black tracking-[0.35em] text-black/45">
          HOO WORLD
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
          나의 작은 공간
        </h1>

        <p className="mt-2 text-sm font-bold text-black/50">
          천천히 머물고,
          함께 성장하는 공간
        </p>
      </div>

      {/* 임시 집 */}
      <div className="absolute bottom-[18%] left-[15%] z-10 hidden sm:block">
        <div className="relative h-[180px] w-[230px]">
          <div className="absolute bottom-0 h-[135px] w-full rounded-[24px] bg-[#f3e3c5] shadow-xl" />

          <div className="absolute left-[-18px] top-0 h-[110px] w-[265px] rotate-[-2deg] rounded-[30px] bg-[#a9755e]" />

          <div className="absolute bottom-0 left-[90px] h-[82px] w-[52px] rounded-t-2xl bg-[#8a6049]" />

          <div className="absolute bottom-[56px] left-[30px] h-12 w-12 rounded-xl border-4 border-white/70 bg-[#a9d5e8]" />

          <div className="absolute bottom-[56px] right-[30px] h-12 w-12 rounded-xl border-4 border-white/70 bg-[#a9d5e8]" />
        </div>
      </div>

      {/* 내 캐릭터 */}
      <div className="absolute bottom-[14%] left-1/2 z-20 -translate-x-1/2">
        <HooWorldPlayer
          nickname={
            nickname ??
            "HOO"
          }
          status={
            status
          }
        />
      </div>

      {/* 현재 상태 */}
      <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/40 bg-white/75 px-5 py-2.5 text-xs font-black shadow-lg backdrop-blur-xl">
        {status === "focusing"
          ? "💻 집중하고 있어요"
          : "🌿 HOO WORLD에서 쉬는 중"}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import HooContestHud from "@/components/HooWorld/HooContestHud";
import { createHooContestApi } from "@/lib/hoo-contest/client";
import type {
  ContestInfo,
  ContestRank,
  HooContestApi,
} from "@/lib/hoo-contest/contracts";

// 실제 서버 API는 아직 비활성화
const realApi = createHooContestApi();

// V7.2: 운영 HUD는 조회 전용. 참가 요청은 차단.
const displayOnlyApi: HooContestApi = {
  ...realApi,
  join: async () => {
    throw new Error("대회 참가 기능은 아직 준비 중입니다.");
  },
};

const demoCreatedAt = Date.now();

const demoContest: ContestInfo = {
  id: "local-demo-contest",
  title: "후레이딩 월드 챔피언십 (미리보기)",
  phase: "active",
  startsAt: new Date(
    demoCreatedAt - 60 * 60 * 1000
  ).toISOString(),
  endsAt: new Date(
    demoCreatedAt +
      (3 * 24 + 12) * 60 * 60 * 1000 +
      45 * 60 * 1000
  ).toISOString(),
  prizesHoo: {
    first: 3000,
    second: 1500,
    third: 500,
  },
};

const demoRanks: ContestRank[] = Array.from(
  { length: 20 },
  (_, i) => ({
    rank: i + 1,
    nickname: `샘플 참가자 ${String(i + 1).padStart(2, "0")}`,
    roiPercent: Math.round((18 - i * 1.45) * 100) / 100,
    realizedPnlHoo: 240 - i * 15,
  })
);

let demoJoined = false;

// 외부 API 호출·Supabase 데이터 변경 없음
const previewApi: HooContestApi = {
  overview: async () => ({
    contest: demoContest,
    viewer: { joined: demoJoined },
    // HOO_CONTEST_DEMO_POSTER_V1
    presentation: {
      headline: "HOO WORLD CHAMPIONSHIP",
      body: "차트 위에서 실력을 증명하라!`n가상 참가자 20명 · 무료 참가 · 상금 총 5,000 HOO",
      posterPath: null,
      posterUrl: "/hoo-contest-preview-poster.svg",
    },
    serverNow: new Date().toISOString(),
  }),

  leaderboard: async (contestId, mode) => ({
    contestId,
    rows: demoRanks.map((row) =>
      mode === "fresh"
        ? {
            ...row,
            roiPercent: (row.roiPercent ?? 0) + 0.01,
          }
        : row
    ),
    snapshotAt: new Date().toISOString(),
    source: mode === "fresh" ? "personal" : "hourly",
    official: false,
  }),

  history: async () => [
    {
      contestId: "local-demo-history",
      title: "제0회 HOO CONTEST (가상 데이터)",
      endedAt: new Date(
        demoCreatedAt - 24 * 60 * 60 * 1000
      ).toISOString(),
      official: true,
      top: demoRanks.slice(0, 3),
    },
  ],

  join: async () => {
    demoJoined = true;
    return { joined: true };
  },
};

export default function HooContestStageGate() {
  const [localPreview, setLocalPreview] = useState(false);

  useEffect(() => {
    setLocalPreview(
      process.env.NODE_ENV === "development" &&
        ["localhost", "127.0.0.1"].includes(
          window.location.hostname
        ) &&
        new URLSearchParams(window.location.search).get(
          "hooContestPreview"
        ) === "1"
    );
  }, []);

  // 운영 환경에서는 대회 UI 계속 비활성화
  if (!localPreview) {
    return (
      <HooContestHud
        api={displayOnlyApi}
        enabled={
          process.env.NEXT_PUBLIC_HOO_CONTEST_HUD_ENABLED === "true"
        }
      />
    );
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 0,
          zIndex: 900,
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <HooContestHud api={previewApi} enabled allowJoin allowRanking />
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 103,
          transform: "translateX(-50%)",
          zIndex: 901,
          background: "#6b4a1a",
          color: "white",
          padding: "3px 8px",
          borderRadius: 8,
          fontSize: 10,
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        🧪 로컬 미리보기 · 가상 데이터 · 실제 참가 X
      </div>
    </>
  );
}

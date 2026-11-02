
import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedClient,
  isUuid,
  jsonError,
  noStore,
  readsEnabled,
  safeDecimal,
  unavailable,
} from "../_lib/common";

export const dynamic = "force-dynamic";

type RawRank = {
  preview_rank?: number | string;
  nickname?: string;
  roi_percent?: number | string | null;
  profit_hoo?: number | string;
};

type ProvisionalSnapshot = {
  top20: unknown;
  snapshot_hour?: string;
  snapshot_at?: string;
};

function formatRows(value: unknown) {
  if (!Array.isArray(value)) return null;

  return value
    .slice(0, 20)
    .map((item: RawRank) => ({
      rank: Number(item?.preview_rank),
      nickname:
        typeof item?.nickname === "string"
          ? item.nickname
          : "참가자",
      roiPercent:
        item?.roi_percent == null
          ? null
          : safeDecimal(item.roi_percent),
      realizedPnlHoo: safeDecimal(item?.profit_hoo),
    }))
    .filter(
      (row) =>
        Number.isInteger(row.rank) &&
        row.rank >= 1 &&
        row.rank <= 20
    );
}

export async function GET(request: NextRequest) {
  // 1. 대회 조회 기능이 잠겨 있으면 차단
  if (!readsEnabled()) return unavailable();

  // Capture V2 / ROI V6 검증 완료 전 전체 랭킹 차단
  if (process.env.HOO_CONTEST_RANKING_V3_ENABLED !== "true") {
    return jsonError("대회 랭킹은 아직 검증 중입니다.", 423);
  }

  const auth = await getAuthenticatedClient();

  if (!auth.ok) return auth.response;

  const { supabase } = auth;

  const contestId =
    request.nextUrl.searchParams.get("contestId");

  const mode =
    request.nextUrl.searchParams.get("mode");

  if (
    !isUuid(contestId) ||
    (mode !== "cached" && mode !== "fresh")
  ) {
    return jsonError(
      "랭킹 요청 형식이 올바르지 않습니다.",
      400
    );
  }

  // 2. RLS 정책으로 공개 가능한 대회인지 확인
  const contestResult = await supabase
    .from("hoo_trading_contests")
    .select("id,status,ends_at")
    .eq("id", contestId)
    .maybeSingle();

  if (contestResult.error) {
    return jsonError(
      "대회 정보를 확인할 수 없습니다.",
      503
    );
  }

  const contest = contestResult.data;

  if (!contest) {
    return jsonError(
      "조회 가능한 대회가 아닙니다.",
      404
    );
  }

  // 3. 최종 확정 대회는 검증된 공식 결과만 표시
  if (contest.status === "finalized") {
    const official = await supabase
      .from("hoo_trading_contest_results")
      .select(
        "official_rank,nickname_snapshot,official_roi_percent,official_profit_tc,archived_at"
      )
      .eq("contest_id", contestId)
      .eq("verification_status", "verified")
      .not("official_rank", "is", null)
      .order("official_rank", { ascending: true })
      .limit(20);

    if (official.error) {
      return jsonError(
        "공식 결과를 확인할 수 없습니다.",
        503
      );
    }

    const rows = (official.data ?? []).map((row) => ({
      rank: Number(row.official_rank),
      nickname: row.nickname_snapshot,
      roiPercent:
        row.official_roi_percent == null
          ? null
          : safeDecimal(row.official_roi_percent),
      realizedPnlHoo:
        safeDecimal(row.official_profit_tc) / 1000,
    }));

    return NextResponse.json(
      {
        contestId,
        rows,
        snapshotAt:
          official.data?.[0]?.archived_at ??
          contest.ends_at,
        source: "final",
        official: true,
      },
      { headers: noStore }
    );
  }

  // 4. 사용자 직접 클릭: 개인 수동 새로고침
  if (mode === "fresh") {
    // DB 함수에서 사용자별/대회별 15분 제한 적용
    // 공용 시간별 스냅샷은 덮어쓰지 않음
    const refreshed = await supabase.rpc(
      "hoo_trading_contest_personal_refresh_v3",
      {
        p_contest_id: contestId,
      }
    );

    if (refreshed.error) {
      if (
        (refreshed.error.message ?? "").includes(
          "REFRESH_COOLDOWN_15_MIN"
        )
      ) {
        return jsonError(
          "수동 갱신은 15분마다 한 번 가능합니다.",
          429
        );
      }

      return jsonError(
        "개인 최신 랭킹을 갱신할 수 없습니다.",
        503
      );
    }

    const freshData =
      refreshed.data as ProvisionalSnapshot | null;

    const rows = formatRows(freshData?.top20);

    if (
      !rows ||
      !freshData?.snapshot_at ||
      Number.isNaN(Date.parse(freshData.snapshot_at))
    ) {
      return jsonError(
        "랭킹 응답 형식이 올바르지 않습니다.",
        503
      );
    }

    return NextResponse.json(
      {
        contestId,
        rows,
        snapshotAt: freshData.snapshot_at,
        source: "personal",
        official: false,
      },
      { headers: noStore }
    );
  }

  // 5. 공용 랭킹: 안전 조회 함수만 사용
  // 원본 스냅샷 테이블 직접 조회 금지
  const cached = await supabase.rpc(
    "hoo_trading_contest_cached_ranking_v1",
    { p_contest_id: contestId }
  );

  if (cached.error) {
    return jsonError(
      "공용 랭킹을 확인할 수 없습니다.",
      503
    );
  }

  const snapshot = cached.data as
    (ProvisionalSnapshot & {
      available?: boolean;
      score_policy?: string;
    }) | null;

  if (!snapshot || snapshot.available !== true) {
    return jsonError(
      "첫 번째 공용 랭킹 집계를 기다리고 있어요.",
      503
    );
  }

  if (
    snapshot.score_policy !==
    "LINKED_REALIZED_PNL_EVENT_TIME_V6"
  ) {
    return jsonError(
      "공용 랭킹 계산 정책이 일치하지 않습니다.",
      503
    );
  }

  const rows = formatRows(snapshot.top20);

  if (
    !rows ||
    !snapshot.snapshot_hour ||
    Number.isNaN(Date.parse(snapshot.snapshot_hour))
  ) {
    return jsonError(
      "공용 랭킹 데이터가 올바르지 않습니다.",
      503
    );
  }

  return NextResponse.json(
    {
      contestId,
      rows,
      snapshotAt: snapshot.snapshot_hour,
      source: "hourly",
      official: false,
    },
    { headers: noStore }
  );
}

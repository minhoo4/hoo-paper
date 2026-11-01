import { NextResponse } from "next/server";
import { getAuthenticatedClient, jsonError, noStore, readsEnabled, safeDecimal, unavailable } from "../_lib/common";

export const dynamic = "force-dynamic";

type HistoryContestRow = { id: string; title: string; status: string; ends_at: string };

export async function GET() {
  if (!readsEnabled()) return unavailable();
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  // Read-only: all history rows are filtered by the verified-results RLS policy.
  const { data: contests, error } = await supabase
    .from("hoo_trading_contests")
    .select("id,title,status,ends_at")
    .in("status", ["ended", "finalized"])
    .order("ends_at", { ascending: false })
    .limit(20);
  if (error) return jsonError("지난 대회 목록을 확인할 수 없어요.", 503);
  const selectedContests = (contests ?? []) as HistoryContestRow[];
  if (!selectedContests.length) return NextResponse.json([], { headers: noStore });

  // No provisional result rows are exposed as if official.
  const ids = selectedContests.filter(c => c.status === "finalized").map(c => c.id);
  let results: Array<{
    contest_id: string; nickname_snapshot: string; official_rank: number | null;
    official_profit_tc: number | string | null; official_roi_percent: number | string | null;
  }> = [];
  if (ids.length) {
    const fetched = await supabase
      .from("hoo_trading_contest_results")
      .select("contest_id,nickname_snapshot,official_rank,official_profit_tc,official_roi_percent")
      .in("contest_id", ids)
      .eq("verification_status", "verified")
      .not("official_rank", "is", null)
      .order("official_rank", { ascending: true })
      .limit(400);
    if (fetched.error) return jsonError("지난 대회 결과를 확인할 수 없어요.", 503);
    results = fetched.data ?? [];
  }

  return NextResponse.json(selectedContests.map(c => ({
    contestId: c.id,
    title: c.title,
    endedAt: c.ends_at,
    official: c.status === "finalized",
    top: results.filter(r => r.contest_id === c.id).slice(0, 20).map(r => ({
      rank: r.official_rank,
      nickname: r.nickname_snapshot,
      roiPercent: r.official_roi_percent === null ? null : safeDecimal(r.official_roi_percent),
      realizedPnlHoo: safeDecimal(r.official_profit_tc) / 1000,
    })),
  })), { headers: noStore });
}

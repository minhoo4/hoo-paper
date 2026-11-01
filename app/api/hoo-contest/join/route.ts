import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient, isUuid, joinEnabled, jsonError, noStore, unavailable } from "../_lib/common";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Independent server-side kill switch, off by default. The DB release guard
  // remains authoritative, and this route NEVER toggles that guard.
  if (!joinEnabled()) return unavailable();
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const raw = await request.json().catch(() => null) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return jsonError("잘못된 요청입니다.", 400);
  const contestId = (raw as { contestId?: unknown }).contestId;
  if (!isUuid(contestId)) return jsonError("대회 식별자가 올바르지 않습니다.", 400);

  // CONTEST_PUBLICATION_CHECK_V1
  const nowIso = new Date().toISOString();

  const ongoing = await supabase
    .from("hoo_trading_contests")
    .select("id")
    .eq("id", contestId)
    .eq("status", "active")
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .maybeSingle();

  if (ongoing.error) {
    return jsonError("대회 상태 확인 실패", 503);
  }
  if (!ongoing.data) {
    return jsonError("진행 중인 대회만 참가할 수 있습니다.", 403);
  }

  const publication = await supabase
    .from("hoo_trading_contest_presentations")
    .select("contest_id")
    .eq("contest_id", contestId)
    .eq("is_published", true)
    .maybeSingle();

  if (publication.error) {
    return jsonError("대회 공개 상태 확인 실패", 503);
  }
  if (!publication.data) {
    return jsonError("공개되지 않은 대회입니다.", 403);
  }

  // DB function uses auth.uid(), an advisory transaction lock and a unique
  // participant baseline. Only return joined:true AFTER RPC commits successfully.
  const { data, error } = await supabase.rpc("hoo_trading_contest_join_v2", { p_contest_id: contestId });
  if (error) return jsonError("현재 대회 참가를 처리할 수 없어요.", 409);
  const result = data as { success?: unknown; contest_id?: unknown } | null;
  if (result?.success !== true || result.contest_id !== contestId) {
    return jsonError("참가 완료 여부를 확인할 수 없어요.", 503);
  }
  return NextResponse.json({ joined: true }, { headers: noStore });
}

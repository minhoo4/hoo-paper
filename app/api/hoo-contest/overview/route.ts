import { NextResponse } from "next/server";
import { getAuthenticatedClient, jsonError, noStore, readsEnabled, safeNumber, unavailable } from "../_lib/common";

export const dynamic = "force-dynamic";

type ContestRow = {
  id: string; title: string; status: string; starts_at: string; ends_at: string;
  prize_1_hoo: number | string; prize_2_hoo: number | string; prize_3_hoo: number | string;
};

export async function GET() {
  if (!readsEnabled()) return unavailable();
  const auth = await getAuthenticatedClient();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;
  const nowIso = new Date().toISOString();

  // The RLS policy exposes only scheduled/active/ended/finalized contests.
  // One bounded fetch; no Realtime subscriptions, polling, or side effects.
  const { data, error } = await supabase
    .from("hoo_trading_contests")
    .select("id,title,status,starts_at,ends_at,prize_1_hoo,prize_2_hoo,prize_3_hoo")
    .eq("status", "active")
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .order("starts_at", { ascending: false })
    .limit(30);

  if (error) return jsonError("대회 정보를 확인할 수 없어요.", 503);

  const priority: Record<string, number> = { active: 0, scheduled: 1, ended: 2, finalized: 3 };
  const ordered = [...((data ?? []) as ContestRow[])].sort((a, b) =>
    (priority[a.status] ?? 9) - (priority[b.status] ?? 9) ||
    Date.parse(b.starts_at) - Date.parse(a.starts_at),
  );
  let picked: ContestRow | null = null;

  // HOO_CONTEST_POSTER_RENDER_V3
  let presentation: {
    headline: string | null;
    body: string | null;
    posterPath: string | null;
    posterUrl: string | null;
  } | null = null;

  if (ordered.length > 0) {
    const published = await supabase
      .from("hoo_trading_contest_presentations")
      .select("contest_id,headline,body,poster_path,poster_verified_at")
      .in("contest_id", ordered.map(c => c.id))
      .eq("is_published", true);

    if (published.error) {
      return jsonError("대회 공개 상태를 확인할 수 없어요.", 503);
    }

    const publishedIds = new Set(
      (published.data ?? []).map(r => r.contest_id)
    );

    picked = ordered.find(c => publishedIds.has(c.id)) ?? null;

    if (picked) {
      const row = (published.data ?? []).find(
        r => r.contest_id === picked?.id
      );

      if (row) {
        const rawPath = row.poster_path;
        const prefix = `contests/${picked.id}/`;

        const safePath =
          row.poster_verified_at != null &&
          typeof rawPath === "string" &&
          rawPath.startsWith(prefix) &&
          /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(
            rawPath.slice(prefix.length)
          )
            ? rawPath
            : null;

        const posterUrl = safePath
          ? supabase.storage
              .from("hoo-contest-posters")
              .getPublicUrl(safePath).data.publicUrl
          : null;

        presentation = {
          headline: row.headline ?? null,
          body: row.body ?? null,
          posterPath: safePath,
          posterUrl,
        };
      }
    }
  }

  if (!picked || Date.parse(picked.ends_at) <= Date.now()) {
    return NextResponse.json({ contest: null, viewer: { joined: false }, serverNow: new Date().toISOString() }, { headers: noStore });
  }

  const { data: membership, error: participantError } = await supabase
    .from("hoo_trading_contest_participants")
    .select("contest_id")
    .eq("contest_id", picked.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (participantError) return jsonError("참가 상태를 확인할 수 없어요.", 503);

  const phase = picked.status === "ended" ? "review" : picked.status === "finalized" ? "official" : picked.status;
  return NextResponse.json({
    presentation,
    contest: {
      id: picked.id,
      title: picked.title,
      phase,
      startsAt: picked.starts_at,
      endsAt: picked.ends_at,
      prizesHoo: {
        first: safeNumber(picked.prize_1_hoo),
        second: safeNumber(picked.prize_2_hoo),
        third: safeNumber(picked.prize_3_hoo),
      },
    },
    viewer: { joined: Boolean(membership) },
    serverNow: new Date().toISOString(),
  }, { headers: noStore });
}

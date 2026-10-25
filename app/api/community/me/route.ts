import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// P1.1 temporary compatibility bridge:
// Read historic achievements and nickname tag through the original RPC.
// Do not reuse retired Sudoku/Shisen/Bubble scores in active rankings.
type HistoricProfile = Record<string, unknown>;

const safeScore = (value: unknown): number => {
  const score = Number(value);
  return Number.isSafeInteger(score) && score >= 0 ? score : 0;
};

function historicRecord(value: unknown): HistoricProfile | null {
  const item = Array.isArray(value) ? (value[0] ?? null) : value;
  return item && typeof item === "object" && !Array.isArray(item)
    ? (item as HistoricProfile)
    : null;
}

function historicFields(value: HistoricProfile):
  | { nicknameTag: number; achievements: string[] | null }
  | null {
  const rawTag = value.nickname_tag ?? value.nicknameTag;
  if (rawTag === null || rawTag === undefined || rawTag === "") return null;
  const tag = Number(rawTag);
  const hasAchievements = Object.prototype.hasOwnProperty.call(value, "achievements");
  const achievements = value.achievements;
  if (!Number.isSafeInteger(tag) || tag < 0 || !hasAchievements) return null;
  if (achievements !== null &&
      !(Array.isArray(achievements) && achievements.every((a) => typeof a === "string"))) {
    return null;
  }
  return { nicknameTag: tag, achievements: achievements as string[] | null };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ stats: null }, { headers: { "Cache-Control": "no-store" } });
    }

    const [historic, profile, mini, game2048] = await Promise.all([
      // Original, already deployed READ path. Requires schema/RPC audit before DB cleanup.
      supabase.rpc("get_my_sudoku_stats"),
      supabase.from("profiles")
        .select("nickname,avatar_emoji")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("hoo_minigame_scores")
        .select("score")
        .eq("user_id", user.id)
        .eq("game", "hoo1952"),
      supabase.from("hoo2048_scores")
        .select("awarded_score")
        .eq("user_id", user.id)
        .gt("awarded_score", 0),
    ]);

    if (historic.error || profile.error || mini.error || game2048.error) {
      console.error("HOO community/me compatibility data query failed", {
        historic: historic.error?.code,
        profile: profile.error?.code,
        mini: mini.error?.code,
        game2048: game2048.error?.code,
      });
      return NextResponse.json(
        { error: "기존 프로필/업적 기록을 확인하지 못했습니다.", code: "PROFILE_HISTORY_UNAVAILABLE" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const raw = historicRecord(historic.data);
    // Original route returned stats:null for accounts with no historical RPC row.
    // Never synthesize an earned-achievements history for a missing record.
    if (!raw) {
      return NextResponse.json({ stats: null }, { headers: { "Cache-Control": "no-store" } });
    }

    const historicData = historicFields(raw);
    if (!historicData) {
      console.error("HOO community/me legacy RPC contract mismatch (tag/achievements)");
      return NextResponse.json(
        { error: "기존 업적 데이터 형식을 확인해야 합니다.", code: "PROFILE_HISTORY_SCHEMA_MISMATCH" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const score1952 = (mini.data ?? []).reduce((sum, row) => sum + safeScore(row.score), 0);
    const score2048 = (game2048.data ?? []).reduce((sum, row) => sum + safeScore(row.awarded_score), 0);

    return NextResponse.json({
      stats: {
        nickname: profile.data?.nickname ?? (typeof raw.nickname === "string" ? raw.nickname : "HOO"),
        nickname_tag: historicData.nicknameTag,
        avatar_emoji: profile.data?.avatar_emoji ?? (typeof raw.avatar_emoji === "string" ? raw.avatar_emoji : "🦉"),
        achievements: historicData.achievements,
        // Only the two retained games contribute to CURRENT total_score.
        total_score: score1952 + score2048,
        score1952,
        score2048,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("HOO community/me unexpected error", error);
    return NextResponse.json(
      { error: "내 정보를 불러오지 못했습니다." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLevelProgress } from "@/lib/community";

type UserScore = { userId: string; nickname: string; avatarEmoji: string; score1952: number; score2048: number };
const safeScore = (value: unknown) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
};
export async function GET(request: NextRequest) {
  try {
    const n = Number(request.nextUrl.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(n) ? Math.min(100, Math.max(1, Math.floor(n))) : 100;
    const supabase = await createClient();
    const [mini, game2048] = await Promise.all([
      supabase.from("hoo_minigame_scores").select("user_id,score").eq("game", "hoo1952"),
      supabase.from("hoo2048_scores").select("user_id,awarded_score").gt("awarded_score", 0),
    ]);
    if (mini.error || game2048.error) {
      console.error("HOO remaining game ranking query failed", mini.error, game2048.error);
      return NextResponse.json({ error: "랭킹을 불러오지 못했습니다." }, { status: 500 });
    }
    const users = new Map<string, UserScore>();
    const ensure = (userId: string) => {
      let u = users.get(userId);
      if (!u) { u = { userId, nickname: "HOO", avatarEmoji: "🦉", score1952: 0, score2048: 0 }; users.set(userId,u); }
      return u;
    };
    for (const row of mini.data ?? []) if (row.user_id) ensure(row.user_id).score1952 += safeScore(row.score);
    for (const row of game2048.data ?? []) if (row.user_id) ensure(row.user_id).score2048 += safeScore(row.awarded_score);
    // Only displayed ranking rows need a profile lookup. Score sorting and
    // slicing must precede this query, because profile data does not affect rank.
    const rankings = [...users.values()].map(u=>{
      const totalScore=u.score1952+u.score2048;
      return { userId:u.userId,nickname:u.nickname,avatarEmoji:u.avatarEmoji,totalScore,level:getLevelProgress(totalScore).level };
    }).filter(u=>u.totalScore>0).sort((a,b)=>b.totalScore-a.totalScore).slice(0,limit);
    const ids = rankings.map(u=>u.userId);
    if (ids.length) {
      const { data: profiles, error } = await supabase.from("profiles").select("id,nickname,avatar_emoji").in("id",ids);
      if (error) console.warn("HOO ranking profile lookup failed", error);
      const rankedById = new Map(rankings.map(u=>[u.userId,u]));
      for (const profile of profiles ?? []) {
        const user = rankedById.get(profile.id);
        if (user) { user.nickname = profile.nickname ?? user.nickname; user.avatarEmoji = profile.avatar_emoji ?? user.avatarEmoji; }
      }
    }
    // Daily/weekly period semantics remain OPEN pending trusted timestamp source.
    return NextResponse.json({ rankings }, { headers: { "Cache-Control":"no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error("HOO ranking unexpected error",error);
    return NextResponse.json({error:"랭킹을 불러오지 못했습니다."},{status:500});
  }
}

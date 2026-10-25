import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ scores: { hoo1952: 0 }, authenticated: false, miniGameTotal: 0 });
    const { data, error } = await supabase.from("hoo_minigame_scores").select("score").eq("user_id",user.id).eq("game","hoo1952");
    if (error) throw error;
    const score = (data ?? []).reduce((sum,row)=> {
      const n = Number(row.score);
      return sum+(Number.isSafeInteger(n)&&n>=0?n:0);
    }, 0);
    return NextResponse.json({ scores: { hoo1952: score }, authenticated: true, miniGameTotal: score });
  } catch (error) {
    console.error("HOO 1952 score query failed",error);
    return NextResponse.json({ error:"점수를 불러오지 못했습니다." },{status:500});
  }
}
export async function POST() {
  // 삭제한 사천성·후버블의 점수가 더 이상 재생성되지 않게 기존 쓰기 API를 폐쇄한다.
  return NextResponse.json({error:"해당 게임 점수 저장 기능은 종료됐습니다."},{status:410});
}

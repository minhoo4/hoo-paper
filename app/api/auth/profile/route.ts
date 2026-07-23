import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]{2,16}$/;

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { nickname, avatarEmoji } = (await request.json()) as {
      nickname?: string;
      avatarEmoji?: string;
    };

    const cleanNickname = nickname?.trim();
    if (!cleanNickname || !NICKNAME_PATTERN.test(cleanNickname)) {
      return NextResponse.json(
        { error: "닉네임은 한글·영문·숫자·밑줄 2~16자로 입력해주세요." },
        { status: 400 },
      );
    }

    const cleanEmoji = (avatarEmoji ?? "🦉").slice(0, 8);
    const { data, error } = await supabase
      .from("profiles")
      .update({ nickname: cleanNickname, avatar_emoji: cleanEmoji })
      .eq("id", user.id)
      .select("id,nickname,avatar_emoji")
      .single();

    if (error) {
  if (error.code === "23505") {
    return NextResponse.json(
      {
        error: "이미 사용 중인 닉네임입니다.",
      },
      {
        status: 409,
      },
    );
  }

  console.error("프로필 저장 오류:", error);

  return NextResponse.json(
    {
      error: "닉네임을 저장하지 못했습니다. 잠시 후 다시 시도해주시는.",
    },
    {
      status: 500,
    },
  );
}

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("PATCH /api/auth/profile", error);
    return NextResponse.json({ error: "프로필을 저장하지 못했습니다." }, { status: 500 });
  }
}

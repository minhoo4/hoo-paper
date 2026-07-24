import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        isLoggedIn: false,
        isAdmin: false,
        canManage: false,
      });
    }

    const { data: isAdmin, error: adminError } =
      await supabase.rpc("is_admin");

    const { data: canManage, error: manageError } =
      await supabase.rpc("can_manage_admin_content");

    if (adminError || manageError) {
      console.error({
        adminError,
        manageError,
      });
    }

    return NextResponse.json({
      isLoggedIn: true,
      isAdmin: isAdmin === true,
      canManage: canManage === true,
      userId: user.id,
    });
  } catch (error) {
    console.error("관리자 확인 API 오류:", error);

    return NextResponse.json(
      {
        isLoggedIn: false,
        isAdmin: false,
        canManage: false,
      },
      { status: 500 },
    );
  }
}
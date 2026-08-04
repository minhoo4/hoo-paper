import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function getStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    const vapidPublicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey =
      process.env.VAPID_PRIVATE_KEY;
    const vapidSubject =
      process.env.VAPID_SUBJECT;

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !vapidPublicKey ||
      !vapidPrivateKey ||
      !vapidSubject
    ) {
      return NextResponse.json(
        {
          error: "푸시 서버 환경변수가 설정되지 않았습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const authorization =
      request.headers.get("authorization");

    const accessToken =
      authorization?.startsWith("Bearer ")
        ? authorization.slice(7)
        : null;

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "로그인이 필요합니다.",
        },
        {
          status: 401,
        },
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "유효하지 않은 로그인 정보입니다.",
        },
        {
          status: 401,
        },
      );
    }

    const {
      data,
      error: subscriptionError,
    } = await supabaseAdmin
      .from("hoo_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (subscriptionError) {
      throw subscriptionError;
    }

    const subscriptions =
      (data ?? []) as PushSubscriptionRow[];

    if (subscriptions.length === 0) {
      return NextResponse.json(
        {
          error: "활성화된 푸시 구독이 없습니다.",
        },
        {
          status: 404,
        },
      );
    }

    webPush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey,
    );

    const payload = JSON.stringify({
      title: "HOO 테스트",
      body: "서버에서 보낸 푸시 알림에 성공했어요.",
      url: "/",
      tag: `hoo-test-${user.id}`,
    });

    let successCount = 0;
    let failureCount = 0;

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payload,
          );

          successCount += 1;
        } catch (error) {
          failureCount += 1;

          const statusCode = getStatusCode(error);

          if (statusCode === 404 || statusCode === 410) {
            await supabaseAdmin
              .from("hoo_push_subscriptions")
              .update({
                is_active: false,
                updated_at: new Date().toISOString(),
              })
              .eq("id", subscription.id);
          }

          console.error(
            "개별 푸시 발송 실패:",
            error,
          );
        }
      }),
    );

    return NextResponse.json({
      success: successCount > 0,
      successCount,
      failureCount,
    });
  } catch (error) {
    console.error("테스트 푸시 API 오류:", error);

    return NextResponse.json(
      {
        error: "테스트 푸시 발송에 실패했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}
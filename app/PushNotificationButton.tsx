"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4,
  );

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((character) =>
      character.charCodeAt(0),
    ),
  );
}

export default function PushNotificationButton() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const checkPushSubscription = async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return;
      }

      setIsSupported(true);

      const registration =
        await navigator.serviceWorker.ready;

      const subscription =
        await registration.pushManager.getSubscription();

      setIsSubscribed(Boolean(subscription));
    };

    void checkPushSubscription();
  }, []);

  const subscribeToPush = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setMessage("");

    try {
      const vapidPublicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        throw new Error(
          "VAPID 공개 키가 설정되지 않았습니다.",
        );
      }

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage("알림 권한이 허용되지 않았어요.");
        return;
      }

      const registration =
        await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToUint8Array(vapidPublicKey),
          });
      }

      const subscriptionData = subscription.toJSON();
      const endpoint = subscriptionData.endpoint;
      const p256dh = subscriptionData.keys?.p256dh;
      const auth = subscriptionData.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        throw new Error(
          "푸시 구독 정보가 완전하지 않습니다.",
        );
      }

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "로그인 후 알림을 설정해주세요.",
        );
      }

      const { error: saveError } = await supabase
        .from("hoo_push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
            user_agent: navigator.userAgent,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "endpoint",
          },
        );

      if (saveError) {
        throw saveError;
      }

      setIsSubscribed(true);
      setMessage("HOO 알림이 연결됐어요.");
    } catch (error) {
      console.error("푸시 알림 구독 실패:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "알림 연결에 실패했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestPush = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error(
          "로그인 후 테스트해주세요.",
        );
      }

      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "테스트 알림 발송에 실패했습니다.",
        );
      }

      setMessage(
        `테스트 알림 ${result.successCount}건을 발송했어요.`,
      );
    } catch (error) {
      console.error("테스트 푸시 발송 실패:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "테스트 알림 발송에 실패했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="fixed right-4 top-20 z-[10000] flex flex-col items-end gap-2">
      {!isSubscribed ? (
        <button
          type="button"
          onClick={() => {
            void subscribeToPush();
          }}
          disabled={isLoading}
          className="min-h-12 rounded-xl bg-[#7467d8] px-4 py-3 text-sm font-black text-white shadow-lg transition hover:bg-[#6558ca] disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading
            ? "연결 중..."
            : "HOO 알림 켜기"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            void sendTestPush();
          }}
          disabled={isLoading}
          className="min-h-12 rounded-xl bg-[#7467d8] px-4 py-3 text-sm font-black text-white shadow-lg transition hover:bg-[#6558ca] disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading
            ? "발송 중..."
            : "테스트 알림 보내기"}
        </button>
      )}

      {message && (
        <p className="max-w-64 rounded-lg bg-black/80 px-3 py-2 text-xs font-bold text-white">
          {message}
        </p>
      )}
    </div>
  );
}
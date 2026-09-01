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
  const [isSupported, setIsSupported] =
    useState(false);

  const [isSubscribed, setIsSubscribed] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    const checkPushSubscription =
      async () => {
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

        setIsSubscribed(
          Boolean(subscription),
        );
      };

    void checkPushSubscription();
  }, []);

  const subscribeToPush = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setMessage("");

    try {
      const vapidPublicKey =
        process.env
          .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        throw new Error(
          "VAPID 공개 키가 설정되지 않았습니다.",
        );
      }

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage(
          "알림 권한이 허용되지 않았어요.",
        );
        return;
      }

      const registration =
        await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe(
            {
              userVisibleOnly: true,
              applicationServerKey:
                urlBase64ToUint8Array(
                  vapidPublicKey,
                ),
            },
          );
      }

      const subscriptionData =
        subscription.toJSON();

      const endpoint =
        subscriptionData.endpoint;

      const p256dh =
        subscriptionData.keys?.p256dh;

      const auth =
        subscriptionData.keys?.auth;

      if (
        !endpoint ||
        !p256dh ||
        !auth
      ) {
        throw new Error(
          "푸시 구독 정보가 완전하지 않습니다.",
        );
      }

      const supabase =
        createClient();

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "로그인 후 알림을 설정해주세요.",
        );
      }

      const { error: saveError } =
        await supabase
          .from(
            "hoo_push_subscriptions",
          )
          .upsert(
            {
              user_id: user.id,
              endpoint,
              p256dh,
              auth,
              user_agent:
                navigator.userAgent,
              is_active: true,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict: "endpoint",
            },
          );

      if (saveError) {
        throw saveError;
      }

      setIsSubscribed(true);
      setMessage(
        "HOO 알림이 연결됐어요.",
      );
    } catch (error) {
      console.error(
        "푸시 알림 구독 실패:",
        error,
      );

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
      const supabase =
        createClient();

      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session
      ) {
        throw new Error(
          "로그인 후 테스트해주세요.",
        );
      }

      const response =
        await fetch(
          "/api/push/test",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
          },
        );

      const result =
        await response.json();

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
      console.error(
        "테스트 푸시 발송 실패:",
        error,
      );

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
    <div>
      <button
        type="button"
        onClick={() => {
          if (isSubscribed) {
            void sendTestPush();
            return;
          }

          void subscribeToPush();
        }}
        disabled={isLoading}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7467d8]/25 text-lg">
            🔔
          </span>

          <span className="min-w-0">
            <span className="block whitespace-nowrap text-sm font-black text-white">
              {isLoading
                ? isSubscribed
                  ? "발송 중..."
                  : "연결 중..."
                : isSubscribed
                  ? "테스트 알림"
                  : "HOO 알림 켜기"}
            </span>

            <span className="mt-0.5 block text-[10px] font-bold text-white/45">
              {isSubscribed
                ? "연결된 기기로 테스트 알림을 발송합니다."
                : "이 기기에서 HOO 알림을 받습니다."}
            </span>
          </span>
        </span>

        <span className="shrink-0 text-base font-black text-white/35">
          ›
        </span>
      </button>

      {message && (
        <p className="mt-2 rounded-xl bg-black/35 px-3 py-2 text-[10px] font-bold leading-4 text-white/75">
          {message}
        </p>
      )}
    </div>
  );
}
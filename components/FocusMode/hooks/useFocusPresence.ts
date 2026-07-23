"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  RealtimeChannel,
} from "@supabase/supabase-js";
import {
  getSupabaseBrowserClient,
} from "../lib/supabaseClient";

const FOCUS_PRESENCE_CHANNEL =
  "hoo:focus-presence";

const FOCUS_PRESENCE_ID_KEY =
  "hoo-focus-presence-id";

type FocusPresenceStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "unavailable"
  | "error";

type FocusPresenceMetadata = {
  status: "focusing";
  startedAt: string;
  lastChangedAt: string;
};

function createPresenceId() {
  if (
    typeof window !== "undefined" &&
    window.crypto?.randomUUID
  ) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getOrCreatePresenceId() {
  try {
    const savedId =
      window.localStorage.getItem(
        FOCUS_PRESENCE_ID_KEY,
      );

    if (savedId) {
      return savedId;
    }

    const newId = createPresenceId();

    window.localStorage.setItem(
      FOCUS_PRESENCE_ID_KEY,
      newId,
    );

    return newId;
  } catch {
    return createPresenceId();
  }
}

function countPresenceKeys(
  state: Record<
    string,
    FocusPresenceMetadata[]
  >,
) {
  return Object.keys(state).length;
}

export function useFocusPresence(
  isFocusing: boolean,
) {
  const [
    focusedPeopleCount,
    setFocusedPeopleCount,
  ] = useState(0);

  const [
    presenceStatus,
    setPresenceStatus,
  ] =
    useState<FocusPresenceStatus>(
      "idle",
    );

  const channelRef =
    useRef<RealtimeChannel | null>(
      null,
    );

  useEffect(() => {
    if (!isFocusing) {
      setFocusedPeopleCount(0);
      setPresenceStatus("idle");
      return;
    }

    const supabase =
      getSupabaseBrowserClient();

    if (!supabase) {
      setPresenceStatus(
        "unavailable",
      );
      return;
    }

    let isDisposed = false;
    const presenceId =
      getOrCreatePresenceId();

    setPresenceStatus(
      "connecting",
    );

    const channel = supabase.channel(
      FOCUS_PRESENCE_CHANNEL,
      {
        config: {
          presence: {
            key: presenceId,
          },
        },
      },
    );

    channelRef.current = channel;

    const updateCount = () => {
      if (isDisposed) {
        return;
      }

      const state =
        channel.presenceState<
          FocusPresenceMetadata
        >();

      setFocusedPeopleCount(
        countPresenceKeys(state),
      );
    };

    channel
      .on(
        "presence",
        {
          event: "sync",
        },
        updateCount,
      )
      .on(
        "presence",
        {
          event: "join",
        },
        updateCount,
      )
      .on(
        "presence",
        {
          event: "leave",
        },
        updateCount,
      )
      .subscribe(
        async (status, error) => {
          if (isDisposed) {
            return;
          }

          if (
            status === "SUBSCRIBED"
          ) {
            const now =
              new Date().toISOString();

            const trackResult =
              await channel.track({
                status: "focusing",
                startedAt: now,
                lastChangedAt: now,
              } satisfies FocusPresenceMetadata);

            if (
              trackResult === "ok"
            ) {
              setPresenceStatus(
                "connected",
              );
              updateCount();
            } else {
              console.error(
                "집중 Presence 등록 실패:",
                trackResult,
              );
              setPresenceStatus(
                "error",
              );
            }

            return;
          }

          if (
            status ===
              "CHANNEL_ERROR" ||
            status === "TIMED_OUT"
          ) {
            console.error(
              "집중 Presence 연결 오류:",
              status,
              error,
            );
            setPresenceStatus("error");
          }
        },
      );

    return () => {
      isDisposed = true;
      channelRef.current = null;

      void channel
        .untrack()
        .catch((error) => {
          console.error(
            "집중 Presence 해제 실패:",
            error,
          );
        })
        .finally(() => {
          void supabase.removeChannel(
            channel,
          );
        });
    };
  }, [isFocusing]);

  return {
    focusedPeopleCount,
    presenceStatus,
    isPresenceConnected:
      presenceStatus === "connected",
  };
}

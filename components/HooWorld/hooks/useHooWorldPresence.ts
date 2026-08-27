"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  RealtimeChannel,
} from "@supabase/supabase-js";

import {
  createClient,
} from "@/lib/supabase/client";

export type HooWorldPlayerStatus =
  | "idle"
  | "focusing"
  | "fishing"
  | "cooking"
  | "playing_music"
  | "resting";

export type HooWorldPresencePlayer = {
  userId: string;
  nickname: string;
  status: HooWorldPlayerStatus;
  fieldId: number;
  joinedAt: string;
  onlineAt: string;

  /*
   * 다른 이용자의 캐릭터 이미지 슬롯.
   *
   * Presence 갱신 시점이나 기존 세션에는
   * 값이 없을 수도 있으므로 optional로 둔다.
   *
   * 값이 없으면 HOO WORLD에서
   * 기본 user-4 캐릭터를 사용한다.
   */
  characterSlot?: number;

  /*
   * M핀 운영자 스킨 여부.
   *
   * 기존 Presence 세션과의 호환을 위해
   * optional로 유지한다.
   * 값이 없으면 일반 유저로 처리한다.
   */
  operatorSkin?: boolean;

  /*
   * HOO WORLD에서 마지막으로 확정된 위치.
   *
   * 포커스모드로 전환되면
   * 이 좌표에서 캐릭터가 멈춰 있게 된다.
   */
  x?: number;
  y?: number;

  /*
   * 다른 이용자의 실시간 이동 방향.
   *
   * 기존 Presence 세션에는 값이 없을 수 있으므로
   * optional로 유지한다.
   */
  facing?:
    | "left"
    | "right"
    | "up"
    | "down";

  /*
   * 현재 캐릭터가 실제로 이동 중인지 여부.
   *
   * true  = 걷는 중
   * false = 정지
   */
  moving?: boolean;
};




type UseHooWorldPresenceOptions = {
  enabled: boolean;
  nickname: string | null;
};

type HooWorldPresenceState = Record<
  string,
  HooWorldPresencePlayer[]
>;

const HOO_WORLD_FIELD_CAPACITY = 25;
const HOO_WORLD_DIRECTORY_CHANNEL =
  "hoo-world-directory";

function normalizePresencePlayers(
  presenceState: HooWorldPresenceState,
): HooWorldPresencePlayer[] {
  const playerMap =
    new Map<
      string,
      HooWorldPresencePlayer
    >();

  for (
    const player of Object.values(
      presenceState,
    ).flat()
  ) {
    if (!player?.userId) {
      continue;
    }

    const previous =
      playerMap.get(
        player.userId,
      );

    if (
      !previous ||
      player.onlineAt >
        previous.onlineAt
    ) {
      playerMap.set(
        player.userId,
        player,
      );
    }
  }

  return Array.from(
    playerMap.values(),
  );
}

function countPlayersByField(
  players: HooWorldPresencePlayer[],
  excludeUserId?: string,
) {
  const counts =
    new Map<number, number>();

  for (const player of players) {
    if (
      excludeUserId &&
      player.userId ===
        excludeUserId
    ) {
      continue;
    }

    const fieldId =
      Number(
        player.fieldId,
      );

    if (
      !Number.isFinite(
        fieldId,
      ) ||
      fieldId < 1
    ) {
      continue;
    }

    counts.set(
      fieldId,
      (
        counts.get(
          fieldId,
        ) ?? 0
      ) + 1,
    );
  }

  return counts;
}

function findAvailableFieldId(
  players: HooWorldPresencePlayer[],
  {
    excludeUserId,
    startAt = 1,
  }: {
    excludeUserId?: string;
    startAt?: number;
  } = {},
): number {
  const counts =
    countPlayersByField(
      players,
      excludeUserId,
    );

  let fieldId =
    Math.max(
      1,
      Math.floor(
        startAt,
      ),
    );

  while (
    (
      counts.get(
        fieldId,
      ) ?? 0
    ) >=
    HOO_WORLD_FIELD_CAPACITY
  ) {
    fieldId += 1;
  }

  return fieldId;
}

function sortFieldPlayers(
  players: HooWorldPresencePlayer[],
) {
  return [
    ...players,
  ].sort(
    (
      first,
      second,
    ) => {
      const joinedCompare =
        first.joinedAt.localeCompare(
          second.joinedAt,
        );

      if (
        joinedCompare !== 0
      ) {
        return joinedCompare;
      }

      return first.userId.localeCompare(
        second.userId,
      );
    },
  );
}

export function useHooWorldPresence({
  enabled,
  nickname,
}: UseHooWorldPresenceOptions) {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [
    players,
    setPlayers,
  ] = useState<
    HooWorldPresencePlayer[]
  >([]);

  const [
    fieldId,
    setFieldId,
  ] = useState<number | null>(
    null,
  );

  const [
    totalOnlineCount,
    setTotalOnlineCount,
  ] = useState(0);

  const [
    status,
    setStatus,
  ] = useState<HooWorldPlayerStatus>(
    "idle",
  );

  const [
    isConnected,
    setIsConnected,
  ] = useState(false);

  const directoryChannelRef =
    useRef<RealtimeChannel | null>(
      null,
    );

 const fieldChannelRef =
  useRef<RealtimeChannel | null>(
    null,
  );

/*
 * 캐릭터 이동은 Presence track과 분리한다.
 *
 * Presence:
 * - 온라인 여부
 * - 스킨
 * - 포커스 상태
 *
 * Broadcast:
 * - 실시간 좌표
 * - 이동 방향
 * - 이동 중 여부
 */
const movementChannelRef =
  useRef<RealtimeChannel | null>(
    null,
  );

const fieldIdRef =
  useRef<number | null>(
    null,
  );


  const joinedAtRef =
    useRef<string | null>(
      null,
    );

  const userIdRef =
    useRef<string | null>(
      null,
    );

  const statusRef =
    useRef<HooWorldPlayerStatus>(
      "idle",
    );

  const positionRef =
    useRef({
      x: 50,
      y: 78,
    });

  const nicknameRef =
    useRef<string | null>(
      nickname,
    );

  const switchingFieldRef =
    useRef(false);

  useEffect(() => {
    nicknameRef.current =
      nickname;
  }, [nickname]);

  useEffect(() => {
    if (!enabled) {
      setPlayers([]);
      setFieldId(null);
      setTotalOnlineCount(
        0,
      );
      setIsConnected(false);

      fieldIdRef.current =
        null;

      return;
    }

    let active = true;

    let directoryChannel:
      RealtimeChannel | null = null;

    let fieldChannel:
      RealtimeChannel | null = null;

    let currentFieldId:
      number | null = null;

    let reconnectTimer:
      number | null = null;

    let reconnectAttempt = 0;

    let connecting = false;

    function isCurrentChannel(
      channel: RealtimeChannel,
    ) {
      return (
        directoryChannelRef.current ===
          channel ||
        fieldChannelRef.current ===
          channel
      );
    }

    async function removeChannelSafely(
      channel:
        | RealtimeChannel
        | null,
    ) {
      if (!channel) {
        return;
      }

      try {
        await channel.untrack();
      } catch {
        // 이미 끊긴 Presence는 무시
      }

      try {
        await supabase.removeChannel(
          channel,
        );
      } catch {
        // 이미 제거된 채널은 무시
      }
    }

    async function clearCurrentChannels() {
      const currentFieldChannel =
        fieldChannel;

      const currentDirectoryChannel =
        directoryChannel;

      fieldChannel = null;
      directoryChannel = null;

      currentFieldId = null;

      if (
        fieldChannelRef.current ===
        currentFieldChannel
      ) {
        fieldChannelRef.current =
          null;
      }

      if (
        directoryChannelRef.current ===
        currentDirectoryChannel
      ) {
        directoryChannelRef.current =
          null;
      }

      fieldIdRef.current =
        null;

      await Promise.all([
        removeChannelSafely(
          currentFieldChannel,
        ),
        removeChannelSafely(
          currentDirectoryChannel,
        ),
      ]);
    }

    function scheduleReconnect() {
      if (
        !active ||
        reconnectTimer !==
          null
      ) {
        return;
      }

      setIsConnected(false);

      reconnectAttempt += 1;

      const delay =
        Math.min(
          600 *
            2 **
              Math.min(
                reconnectAttempt -
                  1,
                3,
              ),
          4000,
        );

      reconnectTimer =
        window.setTimeout(
          () => {
            reconnectTimer =
              null;

            void connect();
          },
          delay,
        );
    }

    function getDirectoryPlayers() {
      if (
        !directoryChannel
      ) {
        return [];
      }

      return normalizePresencePlayers(
        directoryChannel.presenceState<
          HooWorldPresencePlayer
        >() as HooWorldPresenceState,
      );
    }

    async function waitForSubscribed(
      channel: RealtimeChannel,
    ) {
      return await new Promise<boolean>(
        (resolve) => {
          let settled = false;

          const finishResolve = (
            value: boolean,
          ) => {
            if (settled) {
              return;
            }

            settled = true;

            window.clearTimeout(
              timeout,
            );

            resolve(value);
          };

          const finishDisconnected =
            () => {
              if (
                !active ||
                !isCurrentChannel(
                  channel,
                )
              ) {
                finishResolve(
                  false,
                );

                return;
              }

              setIsConnected(false);

              scheduleReconnect();

              finishResolve(
                false,
              );
            };

          const timeout =
            window.setTimeout(
              () => {
                finishDisconnected();
              },
              8000,
            );

          channel.subscribe(
            (
              subscriptionStatus,
            ) => {
              if (
                subscriptionStatus ===
                  "SUBSCRIBED"
              ) {
                finishResolve(
                  true,
                );

                return;
              }

              if (
                subscriptionStatus !==
                  "CHANNEL_ERROR" &&
                subscriptionStatus !==
                  "TIMED_OUT" &&
                subscriptionStatus !==
                  "CLOSED"
              ) {
                return;
              }

              /*
               * CLOSED / TIMED_OUT / CHANNEL_ERROR는
               * throw/reject하지 않는다.
               * 현재 채널이면 자동 재연결,
               * cleanup으로 폐기된 채널이면 조용히 종료한다.
               */
              finishDisconnected();
            },
          );
        },
      );
    }

    async function makePayload(
      nextFieldId: number,
    ): Promise<HooWorldPresencePlayer | null> {
      const userId =
        userIdRef.current;

      if (!userId) {
        return null;
      }

      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      if (
        !user ||
        user.id !==
          userId
      ) {
        return null;
      }

      const [
        profileResult,
        operatorSkinResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "hoo_world_accessory_slot",
          )
          .eq(
            "id",
            userId,
          )
          .maybeSingle(),

        supabase.rpc(
          "has_hoo_world_operator_skin",
        ),
      ]);

      const rawCharacterSlot =
        Number(
          profileResult.data
            ?.hoo_world_accessory_slot,
        );

      const characterSlot =
        Number.isInteger(
          rawCharacterSlot,
        ) &&
        rawCharacterSlot >= 1 &&
        rawCharacterSlot <= 7
          ? rawCharacterSlot
          : 4;

      const operatorSkin =
        operatorSkinResult.error
          ? false
          : operatorSkinResult.data ===
              true;

      const now =
        new Date().toISOString();

      return {
        userId,
        nickname:
          nicknameRef.current?.trim() ||
          user.email?.split(
            "@",
          )[0] ||
          "HOO",
        status:
          statusRef.current,
        fieldId:
          nextFieldId,
        joinedAt:
          joinedAtRef.current ??
          now,
        onlineAt: now,
        characterSlot,
        operatorSkin,
        x: positionRef.current.x,
        y: positionRef.current.y,
      };
    }

    async function joinField(
      nextFieldId: number,
    ) {
      if (
        !active ||
        !directoryChannel ||
        !userIdRef.current
      ) {
        return false;
      }

      const previousChannel =
        fieldChannel;

      if (previousChannel) {
        if (
          fieldChannelRef.current ===
          previousChannel
        ) {
          fieldChannelRef.current =
            null;
        }

        fieldChannel =
          null;

        await removeChannelSafely(
          previousChannel,
        );
      }

      if (!active) {
        return false;
      }

      currentFieldId =
        nextFieldId;

      fieldIdRef.current =
        nextFieldId;

      setFieldId(
        nextFieldId,
      );

      const nextChannel =
        supabase.channel(
          `hoo-world-field-${nextFieldId}`,
          {
            config: {
              presence: {
                key:
                  userIdRef.current,
              },
            },
          },
        );

      fieldChannel =
        nextChannel;

      fieldChannelRef.current =
        nextChannel;

      nextChannel.on(
        "presence",
        {
          event: "sync",
        },
        () => {
          if (
            !active ||
            fieldChannel !==
              nextChannel ||
            currentFieldId !==
              nextFieldId
          ) {
            return;
          }

          const nextPlayers =
            normalizePresencePlayers(
              nextChannel.presenceState<
                HooWorldPresencePlayer
              >() as HooWorldPresenceState,
            ).filter(
              (player) =>
                player.fieldId ===
                nextFieldId,
            );

          setPlayers(
            nextPlayers,
          );

          if (
            nextPlayers.length <=
              HOO_WORLD_FIELD_CAPACITY ||
            switchingFieldRef.current
          ) {
            return;
          }

          const currentUserId =
            userIdRef.current;

          if (
            !currentUserId
          ) {
            return;
          }

          const allowedPlayers =
            sortFieldPlayers(
              nextPlayers,
            ).slice(
              0,
              HOO_WORLD_FIELD_CAPACITY,
            );

          const isAllowed =
            allowedPlayers.some(
              (player) =>
                player.userId ===
                currentUserId,
            );

          if (isAllowed) {
            return;
          }

          switchingFieldRef.current =
            true;

          const directoryPlayers =
            getDirectoryPlayers();

          const spillFieldId =
            findAvailableFieldId(
              directoryPlayers,
              {
                excludeUserId:
                  currentUserId,
                startAt:
                  nextFieldId +
                  1,
              },
            );

          void joinField(
            spillFieldId,
          )
            .catch(
              () => {
                scheduleReconnect();
              },
            )
            .finally(
              () => {
                switchingFieldRef.current =
                  false;
              },
            );
        },
      );

      const subscribed =
        await waitForSubscribed(
          nextChannel,
        );

      if (
        !subscribed ||
        !active ||
        fieldChannel !==
          nextChannel ||
        !directoryChannel
      ) {
        return false;
      }

      const payload =
        await makePayload(
          nextFieldId,
        );

      if (!payload) {
        return false;
      }

      await Promise.all([
        directoryChannel.track(
          payload,
        ),
        nextChannel.track(
          payload,
        ),
      ]);

      if (
        active &&
        fieldChannel ===
          nextChannel
      ) {
        reconnectAttempt = 0;

        setIsConnected(true);
      }

      return true;
    }

    async function connect() {
      if (
        !active ||
        connecting
      ) {
        return;
      }

      connecting = true;

      try {
        await clearCurrentChannels();

        if (!active) {
          return;
        }

        const {
          data: {
            user,
          },
          error,
        } =
          await supabase.auth.getUser();

        if (
          error ||
          !user ||
          !active
        ) {
          return;
        }

        userIdRef.current =
          user.id;

        if (
          !joinedAtRef.current
        ) {
          joinedAtRef.current =
            new Date().toISOString();
        }

        let directorySyncResolved =
          false;

        let resolveDirectorySync:
          (() => void) | null =
            null;

        const directorySyncPromise =
          new Promise<void>(
            (resolve) => {
              resolveDirectorySync =
                resolve;
            },
          );

        const nextDirectoryChannel =
          supabase.channel(
            HOO_WORLD_DIRECTORY_CHANNEL,
            {
              config: {
                presence: {
                  key:
                    user.id,
                },
              },
            },
          );

        directoryChannel =
          nextDirectoryChannel;

        directoryChannelRef.current =
          nextDirectoryChannel;

        nextDirectoryChannel.on(
          "presence",
          {
            event: "sync",
          },
          () => {
            if (
              !active ||
              directoryChannel !==
                nextDirectoryChannel
            ) {
              return;
            }

            const directoryPlayers =
              normalizePresencePlayers(
                nextDirectoryChannel.presenceState<
                  HooWorldPresencePlayer
                >() as HooWorldPresenceState,
              );

            setTotalOnlineCount(
              directoryPlayers.length,
            );

            if (
              !directorySyncResolved
            ) {
              directorySyncResolved =
                true;

              resolveDirectorySync?.();
            }
          },
        );

        const subscribed =
          await waitForSubscribed(
            nextDirectoryChannel,
          );

        if (
          !subscribed ||
          !active ||
          directoryChannel !==
            nextDirectoryChannel
        ) {
          return;
        }

        await Promise.race([
          directorySyncPromise,
          new Promise<void>(
            (resolve) => {
              window.setTimeout(
                resolve,
                700,
              );
            },
          ),
        ]);

        if (
          !active ||
          directoryChannel !==
            nextDirectoryChannel
        ) {
          return;
        }

        const directoryPlayers =
          getDirectoryPlayers();

        const initialFieldId =
          findAvailableFieldId(
            directoryPlayers,
            {
              excludeUserId:
                user.id,
            },
          );

        const joined =
          await joinField(
            initialFieldId,
          );

        if (
          !joined &&
          active
        ) {
          scheduleReconnect();
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setIsConnected(false);

        /*
         * 개발 모드에서 console.error는 Next.js 오류 오버레이를 띄울 수 있다.
         * Realtime의 일시적인 CLOSED / TIMED_OUT은 자동 재연결 대상으로 처리한다.
         */
        console.warn(
          "HOO WORLD Realtime 재연결을 시도합니다.",
          error,
        );

        scheduleReconnect();
      } finally {
        connecting = false;
      }
    }

    void connect();

    return () => {
      active = false;

      switchingFieldRef.current =
        false;

      setIsConnected(false);

      if (
        reconnectTimer !==
        null
      ) {
        window.clearTimeout(
          reconnectTimer,
        );

        reconnectTimer =
          null;
      }

      const currentFieldChannel =
        fieldChannelRef.current;

      const currentDirectoryChannel =
        directoryChannelRef.current;

      fieldChannelRef.current =
        null;

      directoryChannelRef.current =
        null;

      fieldIdRef.current =
        null;

      fieldChannel = null;
      directoryChannel = null;

      if (
        currentFieldChannel
      ) {
        void removeChannelSafely(
          currentFieldChannel,
        );
      }

      if (
        currentDirectoryChannel
      ) {
        void removeChannelSafely(
          currentDirectoryChannel,
        );
      }
    };
  }, [
    enabled,
    supabase,
  ]);

  /*
 * HOO WORLD 실시간 이동 전용 Broadcast
 *
 * Presence와 이동 스트림을 분리해서
 * 빠른 좌표 갱신 때문에 Presence 연결이
 * 과도하게 갱신되지 않도록 한다.
 */
useEffect(() => {
  if (
    !enabled ||
    !isConnected ||
    fieldId === null
  ) {
    return;
  }

  const movementChannel =
    supabase.channel(
      `hoo-world-field-${fieldId}-movement`,
    );

movementChannel.on(
  "broadcast",
  {
    event: "player-move",
  },
  ({
    payload,
  }: {
    payload: {
      userId?: string;
      x?: number;
      y?: number;
      facing?:
        | "left"
        | "right"
        | "up"
        | "down";
      moving?: boolean;
    };
  }) => {
    const userId =
      payload?.userId;

    const x =
      Number(
        payload?.x,
      );

    const y =
      Number(
        payload?.y,
      );

    const facing =
      payload?.facing;

    const moving =
      payload?.moving ===
      true;

    if (
      !userId ||
      userId ===
        userIdRef.current ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return;
    }

    setPlayers(
      (currentPlayers) =>
        currentPlayers.map(
          (player) =>
            player.userId ===
            userId
              ? {
                  ...player,
                  x,
                  y,
                  facing:
                    facing ??
                    player.facing ??
                    "down",
                  moving,
                }
              : player,
        ),
    );
  },
);



  movementChannel.subscribe(
    (subscriptionStatus) => {
      if (
        subscriptionStatus ===
        "SUBSCRIBED"
      ) {
        movementChannelRef.current =
          movementChannel;
      }
    },
  );

  return () => {
    if (
      movementChannelRef.current ===
      movementChannel
    ) {
      movementChannelRef.current =
        null;
    }

    void supabase.removeChannel(
      movementChannel,
    );
  };
}, [
  enabled,
  fieldId,
  isConnected,
  supabase,
]);


  /*
   * 닉네임 변경 때문에 Realtime effect 전체를 끊었다가 다시 연결하지 않는다.
   * 이미 연결된 Presence payload만 가볍게 갱신한다.
   */
  useEffect(() => {
    if (
      !enabled ||
      !isConnected
    ) {
      return;
    }

    const nextFieldId =
      fieldIdRef.current;

    const directoryChannel =
      directoryChannelRef.current;

    const fieldChannel =
      fieldChannelRef.current;

    if (
      nextFieldId === null ||
      !directoryChannel ||
      !fieldChannel
    ) {
      return;
    }

    /*
     * async 함수 경계를 넘어가면 TypeScript가
     * 바깥쪽 null narrowing을 보존하지 않을 수 있다.
     * guard 직후 확정 타입의 로컬 상수로 고정한다.
     */
    const activeFieldId: number =
      nextFieldId;

    const activeDirectoryChannel:
      RealtimeChannel =
      directoryChannel;

    const activeFieldChannel:
      RealtimeChannel =
      fieldChannel;

    let cancelled = false;

    async function refreshNickname() {
      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      if (
        cancelled ||
        !user
      ) {
        return;
      }

      const now =
        new Date().toISOString();

      const payload:
        HooWorldPresencePlayer =
        {
          userId:
            user.id,

          nickname:
            nicknameRef.current?.trim() ||
            user.email?.split(
              "@",
            )[0] ||
            "HOO",

          status:
            statusRef.current,

          fieldId:
            activeFieldId,

          joinedAt:
            joinedAtRef.current ??
            now,

          onlineAt:
            now,

          x:
            positionRef.current.x,

          y:
            positionRef.current.y,
        };

      try {
        await Promise.all([
          activeDirectoryChannel.track(
            payload,
          ),
          activeFieldChannel.track(
            payload,
          ),
        ]);
      } catch {
        if (!cancelled) {
          setIsConnected(false);
        }
      }
    }

    void refreshNickname();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    isConnected,
    nickname,
    supabase,
  ]);

  async function updateStatus(
    nextStatus:
      HooWorldPlayerStatus,
  ) {
    setStatus(nextStatus);

    statusRef.current =
      nextStatus;

    if (!enabled) {
      return;
    }

    const nextFieldId =
      fieldIdRef.current;

    const directoryChannel =
      directoryChannelRef.current;

    const fieldChannel =
      fieldChannelRef.current;

    if (
      !nextFieldId ||
      !directoryChannel ||
      !fieldChannel
    ) {
      return;
    }

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const [
      profileResult,
      operatorSkinResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "hoo_world_accessory_slot",
        )
        .eq(
          "id",
          user.id,
        )
        .maybeSingle(),

      supabase.rpc(
        "has_hoo_world_operator_skin",
      ),
    ]);

    const rawCharacterSlot =
      Number(
        profileResult.data
          ?.hoo_world_accessory_slot,
      );

    const characterSlot =
      Number.isInteger(
        rawCharacterSlot,
      ) &&
      rawCharacterSlot >= 1 &&
      rawCharacterSlot <= 7
        ? rawCharacterSlot
        : 4;

    const operatorSkin =
      operatorSkinResult.error
        ? false
        : operatorSkinResult.data ===
            true;

    const now =
      new Date().toISOString();

    const payload:
      HooWorldPresencePlayer =
      {
        userId:
          user.id,

        nickname:
          nicknameRef.current?.trim() ||
          user.email?.split(
            "@",
          )[0] ||
          "HOO",

        status:
          nextStatus,

        fieldId:
          nextFieldId,

        joinedAt:
          joinedAtRef.current ??
          now,

        onlineAt:
          now,

        characterSlot,

        operatorSkin,

        x:
          positionRef.current.x,

        y:
          positionRef.current.y,
      };

    try {
      await Promise.all([
        directoryChannel.track(
          payload,
        ),
        fieldChannel.track(
          payload,
        ),
      ]);
    } catch {
      setIsConnected(false);
    }
  }

async function updatePosition(
  x: number,
  y: number,
  facing:
    | "left"
    | "right"
    | "up"
    | "down" = "down",
  moving = true,
) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return;
  }

  const nextX =
    Math.max(
      0,
      Math.min(
        100,
        x,
      ),
    );

  const nextY =
    Math.max(
      0,
      Math.min(
        100,
        y,
      ),
    );

  /*
   * 현재 클라이언트의 마지막 위치는
   * 항상 로컬 ref에 즉시 반영한다.
   *
   * 이후 포커스모드 전환이나
   * Presence 상태 갱신에서도
   * 이 좌표를 그대로 사용할 수 있다.
   */
  positionRef.current = {
    x: nextX,
    y: nextY,
  };

  if (!enabled) {
    return;
  }

  const movementChannel =
    movementChannelRef.current;

  const currentUserId =
    userIdRef.current;

  if (
    !movementChannel ||
    !currentUserId
  ) {
    return;
  }

  try {
    /*
     * 빠른 이동 상태는 Presence가 아니라
     * 같은 필드의 Broadcast 채널로 전송한다.
     *
     * 좌표 + 방향 + 이동 여부를 함께 보내서
     * 다른 이용자 화면에서도 같은 움직임을
     * 재현할 수 있도록 한다.
     */
    await movementChannel.send({
      type: "broadcast",
      event: "player-move",
      payload: {
        userId:
          currentUserId,
        x:
          nextX,
        y:
          nextY,
        facing,
        moving,
      },
    });
  } catch {
    /*
     * 한 번의 이동 패킷 실패는
     * 전체 HOO WORLD 연결 실패로 처리하지 않는다.
     *
     * 다음 이동 상태 전송에서
     * 자연스럽게 다시 동기화한다.
     */
  }
}


  return {
    players,

    onlineCount:
      players.length,

    totalOnlineCount,

    fieldId,

    fieldCapacity:
      HOO_WORLD_FIELD_CAPACITY,

    isConnected,

    status,

    updateStatus,

    updatePosition,
  };
}

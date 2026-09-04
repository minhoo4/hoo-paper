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

const HOO_WORLD_FOCUS_POSITION_KEY =
  "hoo-world-focus-position";

const HOO_WORLD_FOCUS_OPEN_KEY =
  "hoo-world-open-focus";

const HOO_WORLD_FOCUS_FIELD_KEY =
  "hoo-world-focus-field-id";

const HOO_WORLD_FOCUS_FACING_KEY =
  "hoo-world-focus-facing";

const HOO_WORLD_FOCUS_CHARACTER_SLOT_KEY =
  "hoo-world-focus-character-slot";

const HOO_WORLD_FOCUS_OPERATOR_SKIN_KEY =
  "hoo-world-focus-operator-skin";

const HOO_WORLD_FOCUS_READY_KEY =
  "hoo-world-focus-presence-ready";

const HOO_WORLD_FOCUS_READY_EVENT =
  "hoo-world:focus-presence-ready";

const HOO_WORLD_FOCUS_HANDOFF_GRACE_MS =
  20000;

type HooWorldFocusHandoff = {
  x: number;
  y: number;
  fieldId?: number;
  facing?:
    | "left"
    | "right"
    | "up"
    | "down";
  characterSlot?: number;
  operatorSkin?: boolean;
};

type HooWorldMovementSnapshot = {
  joinedAt: string;
  x: number;
  y: number;
  facing:
    | "left"
    | "right"
    | "up"
    | "down";
  moving: boolean;
};

function readHooWorldFocusHandoff():
  HooWorldFocusHandoff | null {
  if (
    typeof window === "undefined" ||
    window.sessionStorage.getItem(
      HOO_WORLD_FOCUS_OPEN_KEY,
    ) !== "true"
  ) {
    return null;
  }

  const savedPosition =
    window.sessionStorage.getItem(
      HOO_WORLD_FOCUS_POSITION_KEY,
    );

  if (!savedPosition) {
    return null;
  }

  try {
    const parsed:
      unknown =
      JSON.parse(
        savedPosition,
      );

    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      return null;
    }

    const position =
      parsed as {
        x?: unknown;
        y?: unknown;
      };

    const x =
      Number(
        position.x,
      );

    const y =
      Number(
        position.y,
      );

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return null;
    }

    const rawFieldId =
      Number(
        window.sessionStorage.getItem(
          HOO_WORLD_FOCUS_FIELD_KEY,
        ),
      );

    const storedFacing =
      window.sessionStorage.getItem(
        HOO_WORLD_FOCUS_FACING_KEY,
      );

    const facing:
      HooWorldFocusHandoff["facing"] =
      storedFacing === "left" ||
      storedFacing === "right" ||
      storedFacing === "up" ||
      storedFacing === "down"
        ? storedFacing
        : undefined;

    const rawCharacterSlot =
      Number(
        window.sessionStorage.getItem(
          HOO_WORLD_FOCUS_CHARACTER_SLOT_KEY,
        ),
      );

    const characterSlot =
      Number.isInteger(
        rawCharacterSlot,
      ) &&
      rawCharacterSlot >= 1 &&
      rawCharacterSlot <= 7
        ? rawCharacterSlot
        : undefined;

    const storedOperatorSkin =
      window.sessionStorage.getItem(
        HOO_WORLD_FOCUS_OPERATOR_SKIN_KEY,
      );

    const operatorSkin:
      boolean | undefined =
      storedOperatorSkin === "true"
        ? true
        : storedOperatorSkin === "false"
          ? false
          : undefined;

    return {
      x: Math.max(
        0,
        Math.min(
          100,
          x,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          100,
          y,
        ),
      ),
      fieldId:
        Number.isInteger(
          rawFieldId,
        ) &&
        rawFieldId >= 1
          ? rawFieldId
          : undefined,
      facing,
      characterSlot,
      operatorSkin,
    };
  } catch {
    return null;
  }
}

function normalizeHooWorldCharacterSlot(
  value: unknown,
  fallback = 4,
) {
  const slot = Number(value);

  return Number.isInteger(slot) &&
    slot >= 1 &&
    slot <= 7
    ? slot
    : fallback;
}

function getPresenceTimestamp(
  player: HooWorldPresencePlayer,
) {
  const onlineAt =
    Date.parse(
      typeof player.onlineAt === "string"
        ? player.onlineAt
        : "",
    );

  if (Number.isFinite(onlineAt)) {
    return onlineAt;
  }

  const joinedAt =
    Date.parse(
      typeof player.joinedAt === "string"
        ? player.joinedAt
        : "",
    );

  return Number.isFinite(joinedAt)
    ? joinedAt
    : 0;
}

function getPresenceCompletenessScore(
  player: HooWorldPresencePlayer,
) {
  let score = 0;

  if (
    Number.isInteger(
      player.characterSlot,
    )
  ) {
    score += 1;
  }

  if (
    Number.isFinite(
      Number(player.x),
    ) &&
    Number.isFinite(
      Number(player.y),
    )
  ) {
    score += 2;
  }

  if (player.facing) {
    score += 1;
  }

  if (
    typeof player.moving ===
    "boolean"
  ) {
    score += 1;
  }

  return score;
}

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

    if (!previous) {
      playerMap.set(
        player.userId,
        player,
      );
      continue;
    }

    const playerTimestamp =
      getPresenceTimestamp(
        player,
      );

    const previousTimestamp =
      getPresenceTimestamp(
        previous,
      );

    if (
      playerTimestamp >
        previousTimestamp ||
      (
        playerTimestamp ===
          previousTimestamp &&
        getPresenceCompletenessScore(
          player,
        ) >
          getPresenceCompletenessScore(
            previous,
          )
      )
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

  /*
   * Broadcast는 과거 메시지를 새 입장자에게 재전송하지 않는다.
   * 따라서 방향/정지 상태도 Presence에 남길 수 있도록
   * 현재 이동 스냅샷을 ref에 보관한다.
   */
  const facingRef =
    useRef<
      | "left"
      | "right"
      | "up"
      | "down"
    >("down");

  const movingRef =
    useRef(false);

  /*
   * 프로필 조회가 순간적으로 실패해도 상대 화면의 스킨이
   * user-4 기본값으로 튀지 않도록 마지막 정상 값을 보관한다.
   */
  const characterSlotRef =
    useRef(4);

  const operatorSkinRef =
    useRef(false);

  /*
   * HOO WORLD -> Focus Mode 전환 때 사용하던 필드.
   * 페이지가 바뀌어 훅이 다시 생성되어도 같은 필드로 복귀한다.
   */
  const preferredFieldIdRef =
    useRef<number | null>(
      null,
    );

  /*
   * Presence sync가 느린 좌표로 최신 Broadcast 좌표를
   * 되돌리지 못하도록 원격 이동 스냅샷을 보관한다.
   */
  const movementSnapshotByUserRef =
    useRef(
      new Map<
        string,
        HooWorldMovementSnapshot
      >(),
    );

  /*
   * 필드 Presence가 순간적으로 비는 경우에도
   * directory Presence에 남아 있는 이용자는 계속 표시한다.
   *
   * 특히 Focus Mode 이용자는 새 입장자가 과거 Broadcast를
   * 받을 수 없으므로 directory의 durable snapshot이 fallback이 된다.
   */
  const directoryPlayersRef =
    useRef<
      HooWorldPresencePlayer[]
    >([]);

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

      preferredFieldIdRef.current =
        null;

      movementSnapshotByUserRef.current.clear();

      directoryPlayersRef.current =
        [];

      return;
    }

    /*
     * HOO WORLD에서 Focus Mode로 넘어온 경우
     * Realtime 연결보다 먼저 마지막 월드 좌표와 focusing 상태를 복원한다.
     *
     * 첫 Presence payload부터 정확한 좌표/focusing으로 송출되므로
     * 기본 리스폰 좌표(50, 78)를 잠깐 거치는 현상을 막는다.
     */
    const focusHandoff =
      readHooWorldFocusHandoff();

    if (focusHandoff) {
      positionRef.current = {
        x: focusHandoff.x,
        y: focusHandoff.y,
      };

      statusRef.current =
        "focusing";

      setStatus(
        "focusing",
      );

      movingRef.current =
        false;

      if (focusHandoff.facing) {
        facingRef.current =
          focusHandoff.facing;
      }

      preferredFieldIdRef.current =
        focusHandoff.fieldId ??
        null;

      if (
        focusHandoff.characterSlot
      ) {
        characterSlotRef.current =
          focusHandoff.characterSlot;
      }

      if (
        typeof focusHandoff.operatorSkin ===
        "boolean"
      ) {
        operatorSkinRef.current =
          focusHandoff.operatorSkin;
      }
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

        /*
         * 재연결 직전에 Focus handoff를 다시 읽는다.
         *
         * 네트워크가 잠깐 끊겼거나
         * Presence 채널이 재생성되는 동안에도
         * focusing 상태와 마지막 월드 좌표가
         * 기본 리스폰 값으로 되돌아가지 않게 한다.
         */
        const focusHandoff =
          readHooWorldFocusHandoff();

        if (focusHandoff) {
          positionRef.current = {
            x: focusHandoff.x,
            y: focusHandoff.y,
          };

          statusRef.current =
            "focusing";

          setStatus(
            "focusing",
          );

          movingRef.current =
            false;

          if (
            focusHandoff.facing
          ) {
            facingRef.current =
              focusHandoff.facing;
          }

          if (
            focusHandoff.fieldId
          ) {
            preferredFieldIdRef.current =
              focusHandoff.fieldId;
          }

          if (
            focusHandoff.characterSlot
          ) {
            characterSlotRef.current =
              focusHandoff.characterSlot;
          }

          if (
            typeof focusHandoff.operatorSkin ===
            "boolean"
          ) {
            operatorSkinRef.current =
              focusHandoff.operatorSkin;
          }
        }

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

      let characterSlot =
        characterSlotRef.current;

      if (!profileResult.error) {
        characterSlot =
          normalizeHooWorldCharacterSlot(
            profileResult.data
              ?.hoo_world_accessory_slot,
            4,
          );

        characterSlotRef.current =
          characterSlot;
      }

      let operatorSkin =
        operatorSkinRef.current;

      if (!operatorSkinResult.error) {
        operatorSkin =
          operatorSkinResult.data ===
          true;

        operatorSkinRef.current =
          operatorSkin;
      }

      /*
       * Focus Mode 전환 중이거나 이미 focusing 상태라면
       * 매 Presence payload 생성 직전에 handoff 좌표를 다시 확인한다.
       *
       * 재연결/track 타이밍이 겹쳐도 기본 리스폰(50, 78)이
       * 잠깐 송출되는 것을 막는다.
       */
      if (
        statusRef.current ===
        "focusing"
      ) {
        const focusHandoff =
          readHooWorldFocusHandoff();

        if (focusHandoff) {
          positionRef.current = {
            x: focusHandoff.x,
            y: focusHandoff.y,
          };

          movingRef.current =
            false;

          if (
            focusHandoff.facing
          ) {
            facingRef.current =
              focusHandoff.facing;
          }

          if (
            focusHandoff.fieldId
          ) {
            preferredFieldIdRef.current =
              focusHandoff.fieldId;
          }

          if (
            focusHandoff.characterSlot
          ) {
            characterSlot =
              focusHandoff.characterSlot;

            characterSlotRef.current =
              focusHandoff.characterSlot;
          }

          if (
            typeof focusHandoff.operatorSkin ===
            "boolean"
          ) {
            operatorSkin =
              focusHandoff.operatorSkin;

            operatorSkinRef.current =
              focusHandoff.operatorSkin;
          }
        }
      }

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
        facing:
          facingRef.current,
        moving:
          movingRef.current,
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

      /*
       * 새 필드 채널의 SUBSCRIBED를 기다리기 전에
       * directory Presence에 먼저 현재 사용자를 등록한다.
       *
       * 기존 구조에서는 field subscribe가 느리거나 재연결 중이면
       * directory.track()도 함께 늦어져서,
       * 새로 HOO WORLD에 들어온 이용자가
       * 이미 포커스 중인 이용자를 온라인 목록에서 보지 못할 수 있었다.
       *
       * directory에는 x/y/status/facing/moving까지 포함된
       * durable snapshot을 먼저 올려 둔다.
       * 따라서 늦게 입장한 이용자도 첫 directory sync에서
       * 포커스 중 이용자와 마지막 좌표를 바로 받을 수 있다.
       */
      const payload =
        await makePayload(
          nextFieldId,
        );

      if (
        !payload ||
        !active ||
        !directoryChannel
      ) {
        return false;
      }

      await directoryChannel.track(
        payload,
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

          const fieldPresencePlayers =
            normalizePresencePlayers(
              nextChannel.presenceState<
                HooWorldPresencePlayer
              >() as HooWorldPresenceState,
            ).filter(
              (player) =>
                player.fieldId ===
                nextFieldId,
            );

          /*
           * 같은 필드의 directory Presence를 fallback으로 합친다.
           *
           * Supabase field Presence sync가 순간적으로 비어도
           * directory에 정상적으로 살아 있는 사용자는 사라지지 않는다.
           *
           * 새로 HOO WORLD에 들어온 사람도 이미 focusing 중인 사용자의
           * x/y/status/facing/moving을 directory snapshot으로 즉시 받는다.
           */
          const mergedPlayerMap =
            new Map<
              string,
              HooWorldPresencePlayer
            >();

          for (
            const player of
            directoryPlayersRef.current
          ) {
            if (
              player.fieldId ===
              nextFieldId
            ) {
              mergedPlayerMap.set(
                player.userId,
                player,
              );
            }
          }

          for (
            const player of
            fieldPresencePlayers
          ) {
            const directoryPlayer =
              mergedPlayerMap.get(
                player.userId,
              );

            /*
             * field Presence가 더 최신이면 field 값을 사용하고,
             * directory가 더 최신이면 directory 값을 유지한다.
             */
            if (
              !directoryPlayer ||
              player.onlineAt >=
                directoryPlayer.onlineAt
            ) {
              mergedPlayerMap.set(
                player.userId,
                player,
              );
            }
          }

          const presencePlayers =
            Array.from(
              mergedPlayerMap.values(),
            );

          const activeUserIds =
            new Set(
              presencePlayers.map(
                (player) =>
                  player.userId,
              ),
            );

          for (
            const userId of
            movementSnapshotByUserRef.current.keys()
          ) {
            if (
              !activeUserIds.has(
                userId,
              )
            ) {
              movementSnapshotByUserRef.current.delete(
                userId,
              );
            }
          }

          /*
           * 동일 joinedAt 세션에서 이미 Broadcast 좌표를 받았다면
           * 느린 Presence sync가 최신 위치를 과거 좌표로 되돌리지 않는다.
           *
           * joinedAt이 바뀐 경우에는 재접속한 새 세션이므로
           * 이전 Broadcast 스냅샷을 버리고 새 Presence를 사용한다.
           */
          const nextPlayers =
            presencePlayers.map(
              (player) => {
                const snapshot =
                  movementSnapshotByUserRef.current.get(
                    player.userId,
                  );

                if (!snapshot) {
                  return player;
                }

                if (
                  snapshot.joinedAt !==
                  player.joinedAt
                ) {
                  movementSnapshotByUserRef.current.delete(
                    player.userId,
                  );

                  return player;
                }

                return {
                  ...player,
                  x:
                    snapshot.x,
                  y:
                    snapshot.y,
                  facing:
                    snapshot.facing,
                  moving:
                    snapshot.moving,
                };
              },
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

      /*
       * directory에는 위에서 이미 같은 payload를 등록했다.
       * field Presence에는 채널 구독이 완료된 뒤 동일 snapshot을 등록한다.
       */
      await nextChannel.track(
        payload,
      );

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

            directoryPlayersRef.current =
              directoryPlayers;

            setTotalOnlineCount(
              directoryPlayers.length,
            );

            /*
             * directory Presence는
             * HOO WORLD 전체 이용자의 durable snapshot이다.
             *
             * 기존에는 여기서 ref와 인원수만 갱신했기 때문에
             * field Presence sync가 먼저 끝난 경우,
             * 늦게 들어온 focusing 이용자가 화면에 반영되지 않는
             * 타이밍 문제가 발생할 수 있었다.
             *
             * 이제 directory sync가 발생할 때마다
             * 현재 필드의 이용자 목록도 즉시 다시 만든다.
             */
            const activeFieldId =
              fieldIdRef.current ??
              currentFieldId;

            if (activeFieldId !== null) {
              const directoryFieldPlayers =
                directoryPlayers.filter(
                  (player) =>
                    player.fieldId ===
                    activeFieldId,
                );

              const activeUserIds =
                new Set(
                  directoryFieldPlayers.map(
                    (player) =>
                      player.userId,
                  ),
                );

              /*
               * 현재 directory에 없는 이용자의
               * 오래된 이동 스냅샷은 제거한다.
               */
              for (
                const userId of
                movementSnapshotByUserRef.current.keys()
              ) {
                if (
                  !activeUserIds.has(
                    userId,
                  )
                ) {
                  movementSnapshotByUserRef.current.delete(
                    userId,
                  );
                }
              }

              /*
               * 이미 Broadcast로 최신 좌표를 받은 이용자는
               * directory의 오래된 좌표 대신
               * 최신 이동 스냅샷을 유지한다.
               *
               * focusing 유저는 Broadcast가 없어도
               * directory에 저장된 마지막 좌표가 그대로 사용된다.
               */
              const nextPlayers =
                directoryFieldPlayers.map(
                  (player) => {
                    const snapshot =
                      movementSnapshotByUserRef.current.get(
                        player.userId,
                      );

                    if (!snapshot) {
                      return player;
                    }

                    if (
                      snapshot.joinedAt !==
                      player.joinedAt
                    ) {
                      movementSnapshotByUserRef.current.delete(
                        player.userId,
                      );

                      return player;
                    }

                    return {
                      ...player,
                      x: snapshot.x,
                      y: snapshot.y,
                      facing:
                        snapshot.facing,
                      moving:
                        snapshot.moving,
                    };
                  },
                );

              setPlayers(
                nextPlayers,
              );
            }

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

        const preferredFieldId =
          preferredFieldIdRef.current;

        const fieldCounts =
          countPlayersByField(
            directoryPlayers,
            user.id,
          );

        const canUsePreferredField =
          preferredFieldId !== null &&
          (
            fieldCounts.get(
              preferredFieldId,
            ) ?? 0
          ) <
            HOO_WORLD_FIELD_CAPACITY;

        const initialFieldId =
          canUsePreferredField
            ? preferredFieldId
            : findAvailableFieldId(
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

      directoryPlayersRef.current =
        [];

      /*
       * /hoo-world -> 메인 Focus Mode 전환은 같은 브라우저 안의
       * Next.js 라우트 전환으로 처리한다.
       *
       * 이 순간 기존 Presence를 즉시 untrack하면
       * 새 메인 페이지의 Presence가 SUBSCRIBED 되기 전에
       * 다른 이용자에게 "leave"가 먼저 전달되어 캐릭터가 사라진다.
       *
       * Focus handoff가 살아 있는 경우에만 기존 채널을 8초 동안
       * 겹쳐 유지한다. 새 페이지가 같은 userId로 Presence를 올리면
       * 두 meta는 normalizePresencePlayers에서 한 사용자로 합쳐지고,
       * 8초 뒤 이전 채널만 정리되므로 화면에서 끊김이 없다.
       */
      const shouldGraceFocusHandoff =
        readHooWorldFocusHandoff() !==
        null;

      let released = false;
      let graceTimer:
        number | null = null;
      let readyPollTimer:
        number | null = null;

      const releasePreviousChannels =
        () => {
          if (released) {
            return;
          }

          released = true;

          window.removeEventListener(
            HOO_WORLD_FOCUS_READY_EVENT,
            releasePreviousChannels,
          );

          if (graceTimer !== null) {
            window.clearTimeout(
              graceTimer,
            );
          }

          if (readyPollTimer !== null) {
            window.clearInterval(
              readyPollTimer,
            );
          }

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

      if (shouldGraceFocusHandoff) {
        const isNextPresenceReady =
          () =>
            window.sessionStorage.getItem(
              HOO_WORLD_FOCUS_READY_KEY,
            ) === "true";

        if (isNextPresenceReady()) {
          releasePreviousChannels();
        } else {
          window.addEventListener(
            HOO_WORLD_FOCUS_READY_EVENT,
            releasePreviousChannels,
            { once: true },
          );

          readyPollTimer =
            window.setInterval(
              () => {
                if (
                  isNextPresenceReady()
                ) {
                  releasePreviousChannels();
                }
              },
              250,
            );

          graceTimer =
            window.setTimeout(
              releasePreviousChannels,
              HOO_WORLD_FOCUS_HANDOFF_GRACE_MS,
            );
        }
      } else {
        releasePreviousChannels();
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
      (currentPlayers) => {
        const currentPlayer =
          currentPlayers.find(
            (player) =>
              player.userId ===
              userId,
          );

        if (!currentPlayer) {
          return currentPlayers;
        }

        const resolvedFacing:
          | "left"
          | "right"
          | "up"
          | "down" =
          facing ??
          currentPlayer.facing ??
          "down";

        movementSnapshotByUserRef.current.set(
          userId,
          {
            joinedAt:
              currentPlayer.joinedAt,
            x,
            y,
            facing:
              resolvedFacing,
            moving,
          },
        );

        return currentPlayers.map(
          (player) =>
            player.userId ===
            userId
              ? {
                  ...player,
                  x,
                  y,
                  facing:
                    resolvedFacing,
                  moving,
                }
              : player,
        );
      },
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
   *
   * 중요:
   * Presence payload를 다시 track할 때 characterSlot/operatorSkin까지
   * 항상 같이 넣는다. 일부 필드만 다시 track하면 기존 스킨 메타데이터가
   * 사라져 상대 화면에서 user-4 기본 캐릭터로 떨어질 수 있다.
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

      if (cancelled) {
        return;
      }

      let characterSlot =
        characterSlotRef.current;

      if (!profileResult.error) {
        characterSlot =
          normalizeHooWorldCharacterSlot(
            profileResult.data
              ?.hoo_world_accessory_slot,
            4,
          );

        characterSlotRef.current =
          characterSlot;
      }

      let operatorSkin =
        operatorSkinRef.current;

      if (!operatorSkinResult.error) {
        operatorSkin =
          operatorSkinResult.data ===
          true;

        operatorSkinRef.current =
          operatorSkin;
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

          characterSlot,

          operatorSkin,

          x:
            positionRef.current.x,

          y:
            positionRef.current.y,

          facing:
            facingRef.current,

          moving:
            movingRef.current,
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

  async function trackPresencePayloadWithRetry(
    payload: HooWorldPresencePlayer,
  ) {
    for (
      let attempt = 0;
      attempt < 3;
      attempt += 1
    ) {
      const directoryChannel =
        directoryChannelRef.current;

      const fieldChannel =
        fieldChannelRef.current;

      if (
        !directoryChannel ||
        !fieldChannel
      ) {
        return false;
      }

      try {
        await Promise.all([
          directoryChannel.track(
            payload,
          ),
          fieldChannel.track(
            payload,
          ),
        ]);

        return true;
      } catch {
        if (attempt >= 2) {
          break;
        }

        await new Promise<void>(
          (resolve) => {
            window.setTimeout(
              resolve,
              150 *
                (attempt + 1),
            );
          },
        );
      }
    }

    /*
     * track 단발 실패만으로 연결 전체를 끊지는 않는다.
     * 실제 채널 CLOSED / TIMED_OUT / CHANNEL_ERROR는
     * subscribe 상태 콜백이 기존 재연결 로직으로 처리한다.
     */
    console.warn(
      "HOO WORLD Presence 상태 송출을 재시도했지만 완료하지 못했습니다.",
    );

    return false;
  }

  /*
   * 캐릭터 스킨/프로필 값이 바뀐 직후 현재 Presence를
   * 즉시 다시 송출하기 위한 명시적 갱신 함수.
   *
   * 페이지를 재접속하거나 status가 바뀔 때까지 기다리지 않고
   * 현재 x/y/status/facing을 유지한 채 최신 characterSlot을
   * directory + field Presence 양쪽에 동시에 반영한다.
   */
  async function refreshPresence(
    characterSlotOverride?: number,
  ) {
    if (
      !enabled ||
      !isConnected
    ) {
      return false;
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
      return false;
    }

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const normalizedOverride =
      normalizeHooWorldCharacterSlot(
        characterSlotOverride,
        0,
      );

    if (normalizedOverride !== 0) {
      characterSlotRef.current =
        normalizedOverride;
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

    let characterSlot =
      characterSlotRef.current;

    if (normalizedOverride !== 0) {
      characterSlot =
        normalizedOverride;
    } else if (!profileResult.error) {
      characterSlot =
        normalizeHooWorldCharacterSlot(
          profileResult.data
            ?.hoo_world_accessory_slot,
          4,
        );
    }

    characterSlotRef.current =
      characterSlot;

    let operatorSkin =
      operatorSkinRef.current;

    if (!operatorSkinResult.error) {
      operatorSkin =
        operatorSkinResult.data ===
        true;

      operatorSkinRef.current =
        operatorSkin;
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

        facing:
          facingRef.current,

        moving:
          movingRef.current,
      };

    return await trackPresencePayloadWithRetry(
      payload,
    );
  }

  async function updateStatus(
    nextStatus:
      HooWorldPlayerStatus,
  ) {
    setStatus(nextStatus);

    statusRef.current =
      nextStatus;

    if (
      nextStatus ===
      "focusing"
    ) {
      movingRef.current =
        false;

      /*
       * Focus Mode 버튼을 누른 바로 그 좌표를
       * Presence payload의 단일 기준점으로 확정한다.
       */
      const focusHandoff =
        readHooWorldFocusHandoff();

      if (focusHandoff) {
        positionRef.current = {
          x: focusHandoff.x,
          y: focusHandoff.y,
        };

        if (
          focusHandoff.facing
        ) {
          facingRef.current =
            focusHandoff.facing;
        }

        if (
          focusHandoff.fieldId
        ) {
          preferredFieldIdRef.current =
            focusHandoff.fieldId;
        }
      }
    }

    if (!enabled) {
      return false;
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
      return false;
    }

    /*
     * 페이지 전환 후 새 훅이 첫 Presence부터 같은 필드와 방향을 사용하도록
     * Focus Mode handoff 메타데이터를 세션에 보관한다.
     */
    if (
      typeof window !==
      "undefined"
    ) {
      if (
        nextStatus ===
        "focusing"
      ) {
        preferredFieldIdRef.current =
          nextFieldId;

        window.sessionStorage.setItem(
          HOO_WORLD_FOCUS_FIELD_KEY,
          String(
            nextFieldId,
          ),
        );

        window.sessionStorage.setItem(
          HOO_WORLD_FOCUS_FACING_KEY,
          facingRef.current,
        );
      } else {
        preferredFieldIdRef.current =
          null;

        window.sessionStorage.removeItem(
          HOO_WORLD_FOCUS_FIELD_KEY,
        );

        window.sessionStorage.removeItem(
          HOO_WORLD_FOCUS_FACING_KEY,
        );

        window.sessionStorage.removeItem(
          HOO_WORLD_FOCUS_CHARACTER_SLOT_KEY,
        );

        window.sessionStorage.removeItem(
          HOO_WORLD_FOCUS_OPERATOR_SKIN_KEY,
        );
      }
    }

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return false;
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

    let characterSlot =
      characterSlotRef.current;

    if (!profileResult.error) {
      characterSlot =
        normalizeHooWorldCharacterSlot(
          profileResult.data
            ?.hoo_world_accessory_slot,
          4,
        );

      characterSlotRef.current =
        characterSlot;
    }

    let operatorSkin =
      operatorSkinRef.current;

    if (!operatorSkinResult.error) {
      operatorSkin =
        operatorSkinResult.data ===
        true;

      operatorSkinRef.current =
        operatorSkin;
    }

    if (
      typeof window !== "undefined" &&
      nextStatus === "focusing"
    ) {
      window.sessionStorage.setItem(
        HOO_WORLD_FOCUS_CHARACTER_SLOT_KEY,
        String(characterSlot),
      );

      window.sessionStorage.setItem(
        HOO_WORLD_FOCUS_OPERATOR_SKIN_KEY,
        String(operatorSkin),
      );
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

        facing:
          facingRef.current,

        moving:
          movingRef.current,
      };

    const tracked =
      await trackPresencePayloadWithRetry(
        payload,
      );

    if (!tracked) {
      return false;
    }

    /*
     * 이미 월드에 있는 이용자는 Broadcast로 즉시 정지 좌표를 받는다.
     * Presence sync를 기다리지 않고 포커스 시작 지점에서 바로 멈춘다.
     *
     * Broadcast 한 번의 실패가 Presence 성공까지 무효화하지 않도록
     * 별도 best-effort 처리한다.
     */
    if (
      nextStatus ===
      "focusing"
    ) {
      const movementChannel =
        movementChannelRef.current;

      if (movementChannel) {
        try {
          await movementChannel.send({
            type: "broadcast",
            event: "player-move",
            payload: {
              userId:
                user.id,
              x:
                positionRef.current.x,
              y:
                positionRef.current.y,
              facing:
                facingRef.current,
              moving:
                false,
            },
          });
        } catch {
          // Presence가 성공했다면 이동 Broadcast 단발 실패는 무시한다.
        }
      }
    }

    return true;
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

  facingRef.current =
    facing;

  movingRef.current =
    moving;

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

    refreshPresence,
  };
}


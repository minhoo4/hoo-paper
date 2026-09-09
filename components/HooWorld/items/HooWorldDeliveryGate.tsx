"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createPortal,
} from "react-dom";

import HooWorldItem from "@/components/HooWorld/items/HooWorldItem";
import HooWorldFoodItem from "@/components/HooWorld/items/HooWorldFoodItem";
import HooWorldFireworksItem, {
  HOO_WORLD_FIREWORKS_INTERACTION_DISTANCE_PX,
} from "@/components/HooWorld/items/HooWorldFireworksItem";

import {
  getHooWorldFoodDefinition,
  HOO_WORLD_FOOD_CATALOG,
  HOO_WORLD_FOOD_INTERACTION_DISTANCE_PX,
  type HooWorldFoodId,
} from "@/components/HooWorld/items/hooWorldFoodCatalog";

import type {
  MutableRefObject,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

type DeliveryRpcPayload = {
  has_delivery?: unknown;
  deliveries?: unknown;
};

type DeliveryItem = {
  deliveryItemId: string;
  slotIndex: number;
  itemType: string;
  itemName: string;
  itemImageUrl: string | null;
  itemMetadata: Record<string, unknown>;
};

type DeliveryBox = {
  deliveryId: string;
  status: string;
  arrivedAt: string | null;
  items: DeliveryItem[];
};

type DeliveredFieldItem = {
  itemId: string;
  itemType: string;
  x: number;
  y: number;
  revision: number;
  itemName: string;
  itemImageUrl: string | null;
  width: number;
  height: number;
  collisionBottomRatio: number;
  zIndex: number;

  /*
   * itemType === "food"일 때만 사용한다.
   * 실제 상호작용 정의는 공통 음식 카탈로그에서 가져온다.
   */
  foodId: string | null;

  foodInteractionType:
    | "single"
    | "group";

  /*
   * 불꽃놀이 배송 아이템.
   * item_type 또는 delivery metadata의 interaction_type으로 복구한다.
   */
  isFireworks: boolean;
};

export type HooWorldDeliveredFoodConsumedPayload = {
  itemId: string;
  foodId: string;
};

export type HooWorldDeliveredGroupFoodRequestedPayload = {
  itemId: string;
  foodId: string;
  x: number;
  y: number;
};

export type HooWorldDeliveredFireworksRequestedPayload = {
  itemId: string;
  x: number;
  y: number;
};

type HooWorldDeliveryGateProps = {
  playerPositionRef: MutableRefObject<{
    x: number;
    y: number;
  }>;
  interactionLocked?: boolean;
  onFoodConsumed?: (
    payload: HooWorldDeliveredFoodConsumedPayload,
  ) => void;
  onGroupFoodRequested?: (
    payload: HooWorldDeliveredGroupFoodRequestedPayload,
  ) =>
    | boolean
    | Promise<boolean>;
  onFireworksRequested?: (
    payload: HooWorldDeliveredFireworksRequestedPayload,
  ) =>
    | boolean
    | Promise<boolean>;
};

function getRecord(
  value: unknown,
): Record<string, unknown> {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    ? value as Record<
        string,
        unknown
      >
    : {};
}

function getBoundedNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue,
    )
  ) {
    return fallback;
  }

  return Math.max(
    min,
    Math.min(
      max,
      numericValue,
    ),
  );
}

function parseDeliveredFieldItem(
  value: unknown,
): (
  DeliveredFieldItem & {
    isInstalled: boolean;
  }
) | null {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  const metadata =
    getRecord(
      row.metadata,
    );

  if (
    metadata.source !==
    "delivery"
  ) {
    return null;
  }

  const itemId =
    typeof row.item_id ===
    "string"
      ? row.item_id
      : "";

  const itemType =
    typeof row.item_type ===
    "string"
      ? row.item_type
      : "generic";

  const x =
    Number(
      row.x,
    );

  const y =
    Number(
      row.y,
    );

  const revision =
    Number(
      row.revision ?? 0,
    );

  if (
    !itemId ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(
      revision,
    )
  ) {
    return null;
  }

  const deliveryItemMetadata =
    getRecord(
      metadata.delivery_item_metadata,
    );

  const itemName =
    typeof metadata.item_name ===
    "string" &&
    metadata.item_name.trim()
      ? metadata.item_name.trim()
      : "배송 아이템";

  const itemImageUrl =
    typeof metadata.item_image_url ===
    "string" &&
    metadata.item_image_url.trim()
      ? metadata.item_image_url.trim()
      : null;

  const metadataFoodId =
    typeof deliveryItemMetadata.food_id ===
      "string" &&
    deliveryItemMetadata.food_id.trim()
      ? deliveryItemMetadata.food_id.trim()
      : null;

  const metadataInteractionType =
    typeof deliveryItemMetadata.interaction_type ===
      "string"
      ? deliveryItemMetadata.interaction_type.trim()
      : "";

  /*
   * 음식 판정은 DB item_type 하나에만 의존하지 않는다.
   *
   * 운영자 음식 배송은 정상적으로 item_type=food가 저장되어도
   * 기존 클라이언트 상태 / Realtime 타이밍 때문에 잠깐 generic으로
   * 남아 있을 수 있다.
   *
   * 따라서 다음 순서로 food를 복구한다.
   * 1) delivery_item_metadata.food_id
   * 2) 카탈로그에 등록된 음식 이름
   *
   * 최종적으로 유효한 카탈로그 food가 확인되면
   * 클라이언트에서는 무조건 itemType을 food로 정규화한다.
   */
  const foodByMetadata =
    metadataFoodId
      ? getHooWorldFoodDefinition(
          metadataFoodId,
        )
      : null;

  const foodByName =
    Object.values(
      HOO_WORLD_FOOD_CATALOG,
    ).find(
      (food) =>
        food.name ===
        itemName,
    ) ?? null;

  const resolvedFood =
    foodByMetadata ??
    (
      itemType ===
        "food" ||
      metadataInteractionType ===
        "food"
        ? foodByName
        : null
    ) ??
    /*
     * 마지막 복구 경로.
     * 현재처럼 DB에는 food인데 기존 화면에 일반 📦 아이템으로
     * 남은 상태도 등록된 음식 이름으로 즉시 복구한다.
     */
    foodByName;

  const foodId =
    resolvedFood?.id ??
    null;

  const normalizedItemType =
    foodId
      ? "food"
      : itemType;

  const foodInteractionType:
    | "single"
    | "group" =
      metadataInteractionType ===
        "group_food" ||
      metadataInteractionType ===
        "group_eating"
        ? "group"
        : "single";

  const isFireworks =
    normalizedItemType ===
      "fireworks" ||
    metadataInteractionType ===
      "fireworks";

  return {
    itemId,
    itemType:
      normalizedItemType,
    x,
    y,
    revision:
      Math.max(
        0,
        Math.floor(
          revision,
        ),
      ),
    itemName,
    itemImageUrl,
    width:
      getBoundedNumber(
        deliveryItemMetadata.width ??
          deliveryItemMetadata.display_width,
        86,
        36,
        320,
      ),
    height:
      getBoundedNumber(
        deliveryItemMetadata.height ??
          deliveryItemMetadata.display_height,
        86,
        36,
        320,
      ),
    collisionBottomRatio:
      getBoundedNumber(
        deliveryItemMetadata.collision_bottom_ratio,
        0.18,
        0.08,
        0.8,
      ),
    zIndex:
      Math.round(
        getBoundedNumber(
          deliveryItemMetadata.z_index,
          14,
          8,
          30,
        ),
      ),
    foodId,
    foodInteractionType,
    isFireworks,
    isInstalled:
      row.is_installed !==
      false,
  };
}

function isEditableTarget(
  target: EventTarget | null,
) {
  if (
    !(target instanceof HTMLElement)
  ) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

function parseDeliveryBoxes(
  deliveries: unknown,
): DeliveryBox[] {
  if (!Array.isArray(deliveries)) {
    return [];
  }

  return deliveries
    .map(
      (
        rawDelivery,
      ): DeliveryBox | null => {
        if (
          !rawDelivery ||
          typeof rawDelivery !==
            "object" ||
          Array.isArray(
            rawDelivery,
          )
        ) {
          return null;
        }

        const delivery =
          rawDelivery as Record<
            string,
            unknown
          >;

        const deliveryId =
          typeof delivery.delivery_id ===
          "string"
            ? delivery.delivery_id
            : "";

        if (!deliveryId) {
          return null;
        }

        const rawItems =
          Array.isArray(
            delivery.items,
          )
            ? delivery.items
            : [];

        const items =
          rawItems
            .map(
              (
                rawItem,
              ): DeliveryItem | null => {
                if (
                  !rawItem ||
                  typeof rawItem !==
                    "object" ||
                  Array.isArray(
                    rawItem,
                  )
                ) {
                  return null;
                }

                const item =
                  rawItem as Record<
                    string,
                    unknown
                  >;

                const deliveryItemId =
                  typeof item.delivery_item_id ===
                  "string"
                    ? item.delivery_item_id
                    : "";

                const itemType =
                  typeof item.item_type ===
                  "string"
                    ? item.item_type
                    : "";

                const itemName =
                  typeof item.item_name ===
                  "string"
                    ? item.item_name
                    : "";

                const slotIndex =
                  Number(
                    item.slot_index,
                  );

                if (
                  !deliveryItemId ||
                  !itemType ||
                  !itemName ||
                  !Number.isFinite(
                    slotIndex,
                  )
                ) {
                  return null;
                }

                const itemMetadata =
                  (
                    item.item_metadata &&
                    typeof item.item_metadata ===
                      "object" &&
                    !Array.isArray(
                      item.item_metadata,
                    )
                  )
                    ? item.item_metadata as Record<
                        string,
                        unknown
                      >
                    : {};

                return {
                  deliveryItemId,
                  slotIndex:
                    Math.max(
                      1,
                      Math.min(
                        5,
                        Math.floor(
                          slotIndex,
                        ),
                      ),
                    ),
                  itemType,
                  itemName,
                  itemImageUrl:
                    typeof item.item_image_url ===
                    "string" &&
                    item.item_image_url.trim()
                      ? item.item_image_url
                      : null,
                  itemMetadata,
                };
              },
            )
            .filter(
              (
                item,
              ): item is DeliveryItem =>
                item !== null,
            )
            .sort(
              (
                first,
                second,
              ) =>
                first.slotIndex -
                second.slotIndex,
            )
            .slice(
              0,
              5,
            );

        return {
          deliveryId,
          status:
            typeof delivery.status ===
            "string"
              ? delivery.status
              : "arrived",
          arrivedAt:
            typeof delivery.arrived_at ===
            "string"
              ? delivery.arrived_at
              : null,
          items,
        };
      },
    )
    .filter(
      (
        delivery,
      ): delivery is DeliveryBox =>
        delivery !== null,
    );
}

function countUnclaimedItems(
  deliveries: unknown,
) {
  if (!Array.isArray(deliveries)) {
    return 0;
  }

  return deliveries.reduce(
    (
      total,
      delivery,
    ) => {
      if (
        !delivery ||
        typeof delivery !==
          "object" ||
        Array.isArray(delivery)
      ) {
        return total;
      }

      const items =
        (
          delivery as Record<
            string,
            unknown
          >
        ).items;

      return (
        total +
        (
          Array.isArray(items)
            ? items.length
            : 0
        )
      );
    },
    0,
  );
}

export default function HooWorldDeliveryGate({
  playerPositionRef,
  interactionLocked = false,
  onFoodConsumed,
  onGroupFoodRequested,
  onFireworksRequested,
}: HooWorldDeliveryGateProps) {
  const supabase =
    useMemo(
      () => createClient(),
      [],
    );

  const [
    hasDelivery,
    setHasDelivery,
  ] = useState(false);

  const [
    deliveryCount,
    setDeliveryCount,
  ] = useState(0);

  const [
    itemCount,
    setItemCount,
  ] = useState(0);

  const [
    deliveryBoxes,
    setDeliveryBoxes,
  ] = useState<DeliveryBox[]>(
    [],
  );

  const [
    isPlayerNearBox,
    setIsPlayerNearBox,
  ] = useState(false);

  const [
    boxPromptPosition,
    setBoxPromptPosition,
  ] = useState<{
    left: number;
    top: number;
  } | null>(
    null,
  );

  const [
    activeDeliveryId,
    setActiveDeliveryId,
  ] = useState<string | null>(
    null,
  );

  const [
    deliveredFieldItems,
    setDeliveredFieldItems,
  ] = useState<DeliveredFieldItem[]>(
    [],
  );

  const [
    claimingDeliveryItemId,
    setClaimingDeliveryItemId,
  ] = useState<string | null>(
    null,
  );

  const [
    claimMessage,
    setClaimMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    consumingFoodItemId,
    setConsumingFoodItemId,
  ] = useState<string | null>(
    null,
  );

  const [
    activatingFireworksItemId,
    setActivatingFireworksItemId,
  ] = useState<string | null>(
    null,
  );

  /*
   * 배송 상자에서 꺼내져 실제 필드에 설치된 모든 배송 아이템.
   *
   * 배송 상자는 개인 전용이지만,
   * 상자에서 꺼낸 뒤의 월드 아이템은 다른 이용자도 함께 본다.
   */
  const refreshDeliveredFieldItems =
    useCallback(
      async () => {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              "hoo_world_item_states",
            )
            .select(
              "item_id, item_type, x, y, is_installed, revision, metadata",
            )
            .eq(
              "is_installed",
              true,
            )
            .contains(
              "metadata",
              {
                source:
                  "delivery",
              },
            );

        if (error) {
          console.warn(
            "HOO WORLD 배송 필드 아이템을 불러오지 못했습니다.",
            error,
          );

          return;
        }

        const nextItems =
          (
            data ?? []
          )
            .map(
              parseDeliveredFieldItem,
            )
            .filter(
              (
                item,
              ): item is (
                DeliveredFieldItem & {
                  isInstalled: boolean;
                }
              ) =>
                item !== null &&
                item.isInstalled,
            )
            .map(
              (item) => ({
                itemId:
                  item.itemId,
                itemType:
                  item.itemType,
                x:
                  item.x,
                y:
                  item.y,
                revision:
                  item.revision,
                itemName:
                  item.itemName,
                itemImageUrl:
                  item.itemImageUrl,
                width:
                  item.width,
                height:
                  item.height,
                collisionBottomRatio:
                  item.collisionBottomRatio,
                zIndex:
                  item.zIndex,
                foodId:
                  item.foodId,
                foodInteractionType:
                  item.foodInteractionType,
                isFireworks:
                  item.isFireworks,
              }),
            )
            .sort(
              (
                first,
                second,
              ) =>
                first.itemId.localeCompare(
                  second.itemId,
                ),
            );

        setDeliveredFieldItems(
          nextItems,
        );
      },
      [
        supabase,
      ],
    );

  const refreshDeliveryState =
    useCallback(
      async () => {
        const {
          data: sessionData,
        } =
          await supabase.auth.getSession();

        if (
          !sessionData.session
        ) {
          setHasDelivery(
            false,
          );

          setDeliveryCount(
            0,
          );

          setItemCount(
            0,
          );

          setDeliveryBoxes(
            [],
          );

          setActiveDeliveryId(
            null,
          );

          return;
        }

        const {
          data,
          error,
        } =
          await supabase.rpc(
            "get_hoo_world_public_deliveries",
          );

        if (error) {
          console.warn(
            "HOO WORLD 공용 배송 상태를 불러오지 못했습니다.",
            error,
          );

          return;
        }

        const payload =
          (
            data &&
            typeof data ===
              "object" &&
            !Array.isArray(data)
          )
            ? data as DeliveryRpcPayload
            : null;

        const deliveries =
          Array.isArray(
            payload?.deliveries,
          )
            ? payload.deliveries
            : [];

        const nextDeliveryBoxes =
          parseDeliveryBoxes(
            deliveries,
          );

        const nextHasDelivery =
          payload?.has_delivery ===
            true &&
          nextDeliveryBoxes.length > 0;

        setHasDelivery(
          nextHasDelivery,
        );

        setDeliveryBoxes(
          nextHasDelivery
            ? nextDeliveryBoxes
            : [],
        );

        setDeliveryCount(
          nextHasDelivery
            ? nextDeliveryBoxes.length
            : 0,
        );

        setItemCount(
          nextHasDelivery
            ? countUnclaimedItems(
                deliveries,
              )
            : 0,
        );
      },
      [
        supabase,
      ],
    );

  /*
   * 배송으로 꺼낸 월드 아이템 최초 로드 + Realtime.
   *
   * HooWorldItem 자체도 좌표 Realtime을 처리하지만,
   * 여기서는 "새 아이템이 필드에 생김 / 사라짐" 목록을 동기화한다.
   */
  useEffect(() => {
    void refreshDeliveredFieldItems();

    const channel =
      supabase
        .channel(
          "hoo-world-delivered-field-items",
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "hoo_world_item_states",
          },
          (
            payload,
          ) => {
            if (
              payload.eventType ===
              "DELETE"
            ) {
              const oldRow =
                (
                  payload.old &&
                  typeof payload.old ===
                    "object"
                )
                  ? payload.old as Record<
                      string,
                      unknown
                    >
                  : null;

              const deletedItemId =
                typeof oldRow?.item_id ===
                "string"
                  ? oldRow.item_id
                  : "";

              if (
                deletedItemId
              ) {
                setDeliveredFieldItems(
                  (current) =>
                    current.filter(
                      (item) =>
                        item.itemId !==
                        deletedItemId,
                    ),
                );
              }

              return;
            }

            const parsed =
              parseDeliveredFieldItem(
                payload.new,
              );

            if (!parsed) {
              return;
            }

            setDeliveredFieldItems(
              (current) => {
                if (
                  !parsed.isInstalled
                ) {
                  return current.filter(
                    (item) =>
                      item.itemId !==
                      parsed.itemId,
                  );
                }

                const nextItem: DeliveredFieldItem = {
                  itemId:
                    parsed.itemId,
                  itemType:
                    parsed.itemType,
                  x:
                    parsed.x,
                  y:
                    parsed.y,
                  revision:
                    parsed.revision,
                  itemName:
                    parsed.itemName,
                  itemImageUrl:
                    parsed.itemImageUrl,
                  width:
                    parsed.width,
                  height:
                    parsed.height,
                  collisionBottomRatio:
                    parsed.collisionBottomRatio,
                  zIndex:
                    parsed.zIndex,
                  foodId:
                    parsed.foodId,
                  foodInteractionType:
                    parsed.foodInteractionType,
                  isFireworks:
                    parsed.isFireworks,
                };

                const existingIndex =
                  current.findIndex(
                    (item) =>
                      item.itemId ===
                      parsed.itemId,
                  );

                if (
                  existingIndex === -1
                ) {
                  return [
                    ...current,
                    nextItem,
                  ].sort(
                    (
                      first,
                      second,
                    ) =>
                      first.itemId.localeCompare(
                        second.itemId,
                      ),
                  );
                }

                if (
                  current[
                    existingIndex
                  ].revision >
                  parsed.revision
                ) {
                  return current;
                }

                const next = [
                  ...current,
                ];

                next[
                  existingIndex
                ] =
                  nextItem;

                return next;
              },
            );
          },
        )
        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel,
      );
    };
  }, [
    refreshDeliveredFieldItems,
    supabase,
  ]);

  /*
   * 배송은 이제 HOO WORLD 공용 상태다.
   *
   * - 누가 주문했는지와 관계없이 로그인한 모든 이용자가
   *   같은 열린 대문 / 같은 배송 상자를 본다.
   * - hoo_world_delivery_world_state가 변경되면 즉시 다시 조회한다.
   * - 다른 이용자가 상자에서 아이템을 꺼내도
   *   남은 아이템 수 / 상자 사라짐이 모두에게 바로 반영된다.
   * - Realtime이 잠깐 끊겨도 4초 polling으로 자동 복구한다.
   */
  useEffect(() => {
    void refreshDeliveryState();

    const deliveryStateChannel =
      supabase
        .channel(
          "hoo-world-public-delivery-state",
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "hoo_world_delivery_world_state",
            filter:
              "state_id=eq.world",
          },
          () => {
            void refreshDeliveryState();
          },
        )
        .subscribe();

    const timer =
      window.setInterval(
        () => {
          void refreshDeliveryState();
        },
        4000,
      );

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void refreshDeliveryState();
      }
    }

    function handleWindowFocus() {
      void refreshDeliveryState();
    }

    window.addEventListener(
      "focus",
      handleWindowFocus,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.clearInterval(
        timer,
      );

      window.removeEventListener(
        "focus",
        handleWindowFocus,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      void supabase.removeChannel(
        deliveryStateChannel,
      );
    };
  }, [
    refreshDeliveryState,
    supabase,
  ]);

  /*
   * 배송 상자와 로컬 캐릭터 거리 감지.
   *
   * 상자 가까이에 왔을 때만 F 안내를 띄운다.
   * 공용 배송 상자이므로 어떤 이용자든 가까이 오면 열 수 있다.
   */
  useEffect(() => {
    let frameId:
      number | null =
      null;

    function refreshBoxProximity() {
      if (!hasDelivery) {
        setIsPlayerNearBox(
          false,
        );

        setBoxPromptPosition(
          null,
        );

        frameId =
          window.requestAnimationFrame(
            refreshBoxProximity,
          );

        return;
      }

      const playerElement =
        document.querySelector<HTMLElement>(
          '[data-hoo-world-local-player="true"]',
        );

      const boxElement =
        document.querySelector<HTMLElement>(
          '[data-hoo-world-delivery-box="true"]',
        );

      if (
        !playerElement ||
        !boxElement
      ) {
        setIsPlayerNearBox(
          false,
        );

        setBoxPromptPosition(
          null,
        );

        frameId =
          window.requestAnimationFrame(
            refreshBoxProximity,
          );

        return;
      }

      const playerRect =
        playerElement.getBoundingClientRect();

      const boxRect =
        boxElement.getBoundingClientRect();

      const playerX =
        playerRect.left +
        playerRect.width /
          2;

      const playerY =
        playerRect.bottom;

      const boxX =
        boxRect.left +
        boxRect.width /
          2;

      const boxY =
        boxRect.top +
        boxRect.height *
          0.66;

      const distance =
        Math.hypot(
          playerX -
            boxX,
          playerY -
            boxY,
        );

      const nextIsNear =
        distance <= 130;

      setIsPlayerNearBox(
        (
          current,
        ) =>
          current ===
          nextIsNear
            ? current
            : nextIsNear,
      );

      if (nextIsNear) {
        const nextPosition = {
          left:
            boxRect.left +
            boxRect.width /
              2,
          top:
            boxRect.top -
            12,
        };

        setBoxPromptPosition(
          (
            current,
          ) => {
            if (
              current &&
              Math.abs(
                current.left -
                  nextPosition.left,
              ) < 0.5 &&
              Math.abs(
                current.top -
                  nextPosition.top,
              ) < 0.5
            ) {
              return current;
            }

            return nextPosition;
          },
        );
      } else {
        setBoxPromptPosition(
          null,
        );
      }

      frameId =
        window.requestAnimationFrame(
          refreshBoxProximity,
        );
    }

    frameId =
      window.requestAnimationFrame(
        refreshBoxProximity,
      );

    return () => {
      if (
        frameId !==
        null
      ) {
        window.cancelAnimationFrame(
          frameId,
        );
      }
    };
  }, [
    hasDelivery,
  ]);

  /*
   * HOO DELIVERY 공용 통합 상자.
   *
   * 서버에서는 배송 건(delivery)이 여러 개로 나뉘어 있어도
   * 후월드 화면에서는 항상 "상자 1개"로 합쳐 보여준다.
   *
   * - 배송 1건 = 상자 1개가 아님
   * - 도착한 모든 미수령 아이템을 한 리스트로 합친다.
   * - 통합 리스트의 순번을 slotIndex로 다시 부여해서
   *   여러 배송의 SLOT 1 아이템들이 필드에서 같은 좌표에 겹치지 않게 한다.
   * - 실제 수령 RPC는 deliveryItemId를 사용하므로 DB 구조는 그대로 유지된다.
   */
  const activeDelivery =
    useMemo(
      () => {
        if (
          !activeDeliveryId ||
          deliveryBoxes.length ===
            0
        ) {
          return null;
        }

        const mergedItems =
          deliveryBoxes
            .flatMap(
              (delivery) =>
                delivery.items,
            )
            .map(
              (
                item,
                index,
              ) => ({
                ...item,
                slotIndex:
                  index + 1,
              }),
            );

        return {
          deliveryId:
            "hoo-world-unified-delivery-box",
          status:
            "arrived",
          arrivedAt:
            deliveryBoxes[0]
              ?.arrivedAt ??
            null,
          items:
            mergedItems,
        } satisfies DeliveryBox;
      },
      [
        activeDeliveryId,
        deliveryBoxes,
      ],
    );

  async function consumeDeliveredFood(
    item: DeliveredFieldItem,
  ) {
    if (
      consumingFoodItemId ||
      interactionLocked ||
      !item.foodId
    ) {
      return;
    }

    const food =
      getHooWorldFoodDefinition(
        item.foodId,
      );

    if (!food) {
      return;
    }

    setConsumingFoodItemId(
      item.itemId,
    );

    try {
      /*
       * 단체 음식은 DeliveryGate에서 바로 소비하지 않는다.
       *
       * 현재 필드 Presence를 알고 있는 HooWorldPage가
       * 참여자(본인 + 가장 가까운 최대 3명)를 먼저 선정하고,
       * 전용 RPC가 음식 소비 + 단체 세션 생성을 하나의 트랜잭션으로 처리한다.
       */
      if (
        item.foodInteractionType ===
          "group"
      ) {
        if (
          !onGroupFoodRequested
        ) {
          return;
        }

        const started =
          await onGroupFoodRequested({
            itemId:
              item.itemId,
            foodId:
              food.id,
            x:
              item.x,
            y:
              item.y,
          });

        if (started) {
          setDeliveredFieldItems(
            (current) =>
              current.filter(
                (currentItem) =>
                  currentItem.itemId !==
                  item.itemId,
              ),
          );
        }

        return;
      }

      const {
        data,
        error,
      } =
        await supabase.rpc(
          "consume_hoo_world_delivered_food",
          {
            p_item_id:
              item.itemId,
          },
        );

      if (error) {
        const errorMessage =
          error.message ?? "";

        if (
          errorMessage.includes(
            "FOOD_ALREADY_CONSUMED",
          ) ||
          errorMessage.includes(
            "FOOD_NOT_FOUND",
          )
        ) {
          await refreshDeliveredFieldItems();
          return;
        }

        console.warn(
          `HOO WORLD 배송 음식 소비 RPC 실패 | ${errorMessage}`,
        );

        return;
      }

      const result =
        data &&
        typeof data ===
          "object" &&
        !Array.isArray(data)
          ? data as Record<
              string,
              unknown
            >
          : null;

      if (
        result?.ok ===
        false
      ) {
        const errorCode =
          typeof result.error_code ===
            "string"
            ? result.error_code
            : "FOOD_CONSUME_FAILED";

        const errorMessage =
          typeof result.error_message ===
            "string"
            ? result.error_message
            : "배송 음식을 먹지 못했습니다.";

        console.warn(
          `HOO WORLD 배송 음식 소비 실패 | code=${errorCode} | message=${errorMessage}`,
        );

        if (
          errorCode ===
            "FOOD_ALREADY_CONSUMED" ||
          errorCode ===
            "FOOD_NOT_FOUND"
        ) {
          await refreshDeliveredFieldItems();
        }

        return;
      }

      const resolvedFoodId =
        typeof result?.food_id ===
          "string" &&
        result.food_id.trim()
          ? result.food_id.trim()
          : food.id;

      setDeliveredFieldItems(
        (current) =>
          current.filter(
            (currentItem) =>
              currentItem.itemId !==
              item.itemId,
          ),
      );

      onFoodConsumed?.({
        itemId:
          item.itemId,
        foodId:
          resolvedFoodId,
      });
    } finally {
      setConsumingFoodItemId(
        null,
      );
    }
  }

  async function startDeliveredFireworks(
    item: DeliveredFieldItem,
  ) {
    if (
      activatingFireworksItemId ||
      interactionLocked ||
      !item.isFireworks ||
      !onFireworksRequested
    ) {
      return;
    }

    setActivatingFireworksItemId(
      item.itemId,
    );

    try {
      const started =
        await onFireworksRequested({
          itemId:
            item.itemId,
          x:
            item.x,
          y:
            item.y,
        });

      if (!started) {
        return;
      }

      /*
       * 서버 RPC가 hoo_world_item_states.is_installed=false로
       * 바꾸기 때문에 Realtime에서도 사라진다.
       * 성공 직후 로컬에서도 먼저 제거해 점화 지연을 없앤다.
       */
      setDeliveredFieldItems(
        (current) =>
          current.filter(
            (currentItem) =>
              currentItem.itemId !==
              item.itemId,
          ),
      );
    } finally {
      setActivatingFireworksItemId(
        null,
      );
    }
  }

  /*
   * 배송 상자에서 꺼낸 음식 / 불꽃놀이 F 상호작용.
   *
   * - 가장 가까운 상호작용 아이템 1개만 선택
   * - 음식: 기존 먹기 / 단체 식사
   * - 불꽃놀이: 서버에서 1회 점화 세션 시작
   */
  useEffect(() => {
    function handleDeliveredItemKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.code !== "KeyF" ||
        event.repeat ||
        activeDeliveryId ||
        interactionLocked ||
        consumingFoodItemId ||
        activatingFireworksItemId ||
        isEditableTarget(
          event.target,
        ) ||
        typeof window ===
          "undefined"
      ) {
        return;
      }

      const player =
        playerPositionRef.current;

      let nearest:
        | (
            DeliveredFieldItem & {
              distance: number;
            }
          )
        | null =
        null;

      for (
        const item of
        deliveredFieldItems
      ) {
        const isFood =
          Boolean(
            item.foodId &&
            getHooWorldFoodDefinition(
              item.foodId,
            ),
          );

        if (
          !isFood &&
          !item.isFireworks
        ) {
          continue;
        }

        const deltaX =
          (
            player.x -
            item.x
          ) /
          100 *
          window.innerWidth;

        const deltaY =
          (
            player.y -
            item.y
          ) /
          100 *
          window.innerHeight;

        const distance =
          Math.hypot(
            deltaX,
            deltaY,
          );

        const interactionDistance =
          item.isFireworks
            ? HOO_WORLD_FIREWORKS_INTERACTION_DISTANCE_PX
            : HOO_WORLD_FOOD_INTERACTION_DISTANCE_PX;

        if (
          distance >
            interactionDistance ||
          (
            nearest &&
            nearest.distance <=
              distance
          )
        ) {
          continue;
        }

        nearest = {
          ...item,
          distance,
        };
      }

      if (!nearest) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (
        nearest.isFireworks
      ) {
        void startDeliveredFireworks(
          nearest,
        );
        return;
      }

      void consumeDeliveredFood(
        nearest,
      );
    }

    window.addEventListener(
      "keydown",
      handleDeliveredItemKeyDown,
      true,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleDeliveredItemKeyDown,
        true,
      );
    };
  }, [
    activeDeliveryId,
    activatingFireworksItemId,
    consumingFoodItemId,
    deliveredFieldItems,
    interactionLocked,
    playerPositionRef,
  ]);

  async function claimDeliveryItem(
    item: DeliveryItem,
  ) {
    if (
      claimingDeliveryItemId
    ) {
      return;
    }

    setClaimingDeliveryItemId(
      item.deliveryItemId,
    );

    setClaimMessage(
      null,
    );

    try {
      /*
       * 상자 바로 안쪽의 작은 배송 하역 구역에 슬롯별로 펼쳐 놓는다.
       * 이후 사용자가 X + WASD로 자유롭게 원하는 곳으로 이동한다.
       */
      const spawnX =
        18 +
        (
          item.slotIndex -
          1
        ) *
          2.05;

      const spawnY =
        24.5 +
        (
          (
            item.slotIndex -
            1
          ) %
          2
        ) *
          1.7;

      const {
        data,
        error,
      } =
        await supabase.rpc(
          "claim_hoo_world_delivery_item",
          {
            p_delivery_item_id:
              item.deliveryItemId,
            p_x:
              spawnX,
            p_y:
              spawnY,
          },
        );

      if (error) {
        const errorMessage =
          error.message ?? "";

        if (
          errorMessage.includes(
            "DELIVERY_ITEM_ALREADY_CLAIMED",
          )
        ) {
          setClaimMessage(
            "이미 꺼낸 아이템이에요.",
          );

          await refreshDeliveryState();

          return;
        }

        if (
          errorMessage.includes(
            "DELIVERY_ITEM_NOT_FOUND",
          )
        ) {
          setClaimMessage(
            "이 배송 아이템을 찾을 수 없어요.",
          );

          await refreshDeliveryState();

          return;
        }

        if (
          errorMessage.includes(
            "AUTH_REQUIRED",
          )
        ) {
          setClaimMessage(
            "로그인 후 이용할 수 있어요.",
          );

          return;
        }

        console.error(
          "HOO WORLD 배송 아이템을 꺼내지 못했습니다.",
          error,
        );

        setClaimMessage(
          "아이템을 꺼내지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );

        return;
      }

      const result =
        (
          data &&
          typeof data ===
            "object" &&
          !Array.isArray(data)
        )
          ? data as Record<
              string,
              unknown
            >
          : {};

      const claimedItemName =
        typeof result.item_name ===
        "string" &&
        result.item_name.trim()
          ? result.item_name.trim()
          : item.itemName;

      const isFireworksDeliveryItem =
        item.itemType ===
          "fireworks" ||
        item.itemMetadata.interaction_type ===
          "fireworks";

      setClaimMessage(
        item.itemType ===
          "food"
          ? `${claimedItemName}을(를) 입구에 꺼냈어요. X로 옮긴 뒤 가까이에서 F로 먹을 수 있어요.`
          : isFireworksDeliveryItem
            ? `${claimedItemName}을(를) 필드에 꺼냈어요. X로 원하는 위치까지 옮긴 뒤 F로 점화할 수 있어요.`
            : `${claimedItemName}을(를) 필드에 꺼냈어요. 상자를 닫고 X로 이동할 수 있어요.`,
      );

      /*
       * RPC 직후 즉시 갱신한다.
       * Realtime 수신을 기다리지 않아도 상자/필드가 바로 반영된다.
       */
      await Promise.all([
        refreshDeliveryState(),
        refreshDeliveredFieldItems(),
      ]);
    } catch (error) {
      console.error(
        "HOO WORLD 배송 아이템 수령 중 오류가 발생했습니다.",
        error,
      );

      setClaimMessage(
        "아이템을 꺼내지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setClaimingDeliveryItemId(
        null,
      );
    }
  }

  /*
   * 상자 근처에서 F:
   * - 배송 상자 UI 열기
   *
   * 상자 UI가 열린 동안:
   * - WASD / 방향키 / F / X 입력을 월드까지 전달하지 않는다.
   * - ESC로 닫는다.
   */
  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        activeDeliveryId
      ) {
        if (
          event.code ===
          "Escape"
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();

          setActiveDeliveryId(
            null,
          );

          return;
        }

        if (
          [
            "KeyW",
            "KeyA",
            "KeyS",
            "KeyD",
            "ArrowUp",
            "ArrowLeft",
            "ArrowDown",
            "ArrowRight",
            "KeyF",
            "KeyX",
          ].includes(
            event.code,
          )
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }

        return;
      }

      if (
        event.code !== "KeyF" ||
        event.repeat ||
        isEditableTarget(
          event.target,
        ) ||
        !isPlayerNearBox
      ) {
        return;
      }

      if (
        deliveryBoxes.length ===
          0
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      setClaimMessage(
        null,
      );

      /*
       * 실제 delivery_id 하나를 여는 것이 아니라
       * 현재 도착한 모든 배송을 합친 공용 상자를 연다.
       */
      setActiveDeliveryId(
        "hoo-world-unified-delivery-box",
      );
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
      true,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
        true,
      );
    };
  }, [
    activeDeliveryId,
    deliveryBoxes,
    isPlayerNearBox,
  ]);

  useEffect(() => {
    if (
      activeDeliveryId &&
      !activeDelivery
    ) {
      setActiveDeliveryId(
        null,
      );
    }
  }, [
    activeDelivery,
    activeDeliveryId,
  ]);

  return (
    <>
      {/* ─────────────────────────
          상자에서 꺼내진 실제 월드 아이템

          일반 아이템:
          - 기존 HooWorldItem 이동/충돌/Reatime 시스템 유지

          음식:
          - HooWorldItem 이동 시스템 + HooWorldFoodItem 시각/F 상호작용

          불꽃놀이:
          - HooWorldItem으로 X + WASD 이동
          - 가까이에서 F → 서버 1회 점화 세션
      ───────────────────────── */}
      {deliveredFieldItems.map(
        (
          item,
        ) => {
          if (
            item.foodId
          ) {
            const food =
              getHooWorldFoodDefinition(
                item.foodId,
              );

            if (!food) {
              return null;
            }

            const isGroupFood =
              item.foodInteractionType ===
                "group";

            /*
             * 음식도 일반 월드 아이템과 동일한 이동 시스템을 사용한다.
             *
             * - X: 이동 모드 ON/OFF
             * - WASD / 방향키: 음식 이동
             * - 이동 좌표는 HooWorldItem의 기존 RPC + Realtime으로 공유
             * - F: 기존 음식 먹기 / 단체 음식 시작 그대로 유지
             *
             * HooWorldFoodItem은 embedded 모드로 시각과 F 안내만 담당하고,
             * 실제 좌표/충돌/이동은 바깥 HooWorldItem이 담당한다.
             */
            return (
              <HooWorldItem
                key={
                  item.itemId
                }
                itemId={
                  item.itemId
                }
                itemType={
                  item.itemType
                }
                x={
                  item.x
                }
                y={
                  item.y
                }
                width={
                  62
                }
                height={
                  54
                }
                movable
                collision
                collisionBottomRatio={
                  item.collisionBottomRatio
                }
                zIndex={
                  item.zIndex
                }
                onPositionChange={(
                  position,
                ) => {
                  setDeliveredFieldItems(
                    (current) =>
                      current.map(
                        (
                          currentItem,
                        ) =>
                          currentItem.itemId ===
                          item.itemId
                            ? {
                                ...currentItem,
                                x:
                                  position.x,
                                y:
                                  position.y,
                              }
                            : currentItem,
                      ),
                  );
                }}
              >
                <div
                  className="relative h-full w-full"
                  data-hoo-world-group-food-size={
                    isGroupFood
                      ? "4x"
                      : "1x"
                  }
                >
                  <HooWorldFoodItem
                    item={{
                      itemId:
                        item.itemId,
                      foodId:
                        food.id as HooWorldFoodId,
                      x:
                        item.x,
                      y:
                        item.y,
                    }}
                    food={
                      food
                    }
                    playerPositionRef={
                      playerPositionRef
                    }
                    interactionLocked={
                      interactionLocked ||
                      consumingFoodItemId !==
                        null
                    }
                    embedded
                  />

                  {isGroupFood ? (
                    <style>{`
                      [data-hoo-world-group-food-size="4x"]
                      > [data-hoo-world-food-item="true"]
                      > [data-hoo-world-collision-anchor="true"] {
                        background: transparent;
                        border-color: transparent;
                        box-shadow: none;
                        border-radius: 0;
                      }

                      [data-hoo-world-group-food-size="4x"]
                      > [data-hoo-world-food-item="true"]
                      > [data-hoo-world-collision-anchor="true"]
                      > div:first-child {
                        display: none;
                      }

                      [data-hoo-world-group-food-size="4x"]
                      > [data-hoo-world-food-item="true"]
                      > [data-hoo-world-collision-anchor="true"]
                      > img,
                      [data-hoo-world-group-food-size="4x"]
                      > [data-hoo-world-food-item="true"]
                      > [data-hoo-world-collision-anchor="true"]
                      > span {
                        transform: scale(4);
                        transform-origin: 50% 50%;
                      }
                    `}</style>
                  ) : null}
                </div>
              </HooWorldItem>
            );
          }

          if (
            item.isFireworks
          ) {
            return (
              <HooWorldItem
                key={
                  item.itemId
                }
                itemId={
                  item.itemId
                }
                itemType={
                  "fireworks"
                }
                x={
                  item.x
                }
                y={
                  item.y
                }
                width={
                  item.width
                }
                height={
                  item.height
                }
                movable
                collision
                collisionBottomRatio={
                  item.collisionBottomRatio
                }
                zIndex={
                  item.zIndex
                }
                onPositionChange={(
                  position,
                ) => {
                  setDeliveredFieldItems(
                    (current) =>
                      current.map(
                        (
                          currentItem,
                        ) =>
                          currentItem.itemId ===
                          item.itemId
                            ? {
                                ...currentItem,
                                x:
                                  position.x,
                                y:
                                  position.y,
                              }
                            : currentItem,
                      ),
                  );
                }}
              >
                <HooWorldFireworksItem
                  itemId={
                    item.itemId
                  }
                  x={
                    item.x
                  }
                  y={
                    item.y
                  }
                  playerPositionRef={
                    playerPositionRef
                  }
                  interactionLocked={
                    interactionLocked ||
                    activatingFireworksItemId !==
                      null
                  }
                />
              </HooWorldItem>
            );
          }

          return (
            <HooWorldItem
              key={
                item.itemId
              }
              itemId={
                item.itemId
              }
              itemType={
                item.itemType
              }
              x={
                item.x
              }
              y={
                item.y
              }
              width={
                item.width
              }
              height={
                item.height
              }
              movable
              collision
              collisionBottomRatio={
                item.collisionBottomRatio
              }
              zIndex={
                item.zIndex
              }
              onPositionChange={(
                position,
              ) => {
                setDeliveredFieldItems(
                  (current) =>
                    current.map(
                      (
                        currentItem,
                      ) =>
                        currentItem.itemId ===
                        item.itemId
                          ? {
                              ...currentItem,
                              x:
                                position.x,
                              y:
                                position.y,
                            }
                          : currentItem,
                    ),
                );
              }}
            >
              <div
                data-hoo-world-delivered-item="true"
                className="relative h-full w-full"
              >
                <div
                  data-hoo-world-collision-anchor="true"
                  className="pointer-events-none absolute bottom-[6%] left-1/2 h-[9%] w-[72%] -translate-x-1/2"
                />

                <div className="pointer-events-none absolute bottom-[1%] left-1/2 h-[18%] w-[72%] -translate-x-1/2 rounded-[50%] bg-[#28392a]/18 blur-[4px]" />

                <div className="pointer-events-none absolute inset-x-[5%] bottom-[12%] top-[4%] flex items-center justify-center">
                  {item.itemImageUrl ? (
                    <img
                      src={
                        item.itemImageUrl
                      }
                      alt={
                        item.itemName
                      }
                      draggable={
                        false
                      }
                      className="max-h-full max-w-full select-none object-contain drop-shadow-[0_4px_5px_rgba(39,32,26,0.18)]"
                    />
                  ) : (
                    <div className="flex h-[72%] w-[72%] items-center justify-center rounded-[22%] border border-[#805d43]/35 bg-gradient-to-br from-[#d7aa70] to-[#8f6544] text-[clamp(18px,3vw,34px)] shadow-[0_5px_10px_rgba(49,39,29,0.18)]">
                      📦
                    </div>
                  )}
                </div>

                <div className="pointer-events-none absolute left-1/2 top-full mt-[-2px] max-w-[150%] -translate-x-1/2 whitespace-nowrap rounded-full border border-white/35 bg-[#33462f]/72 px-2 py-0.5 text-[7px] font-black text-white/90 shadow-sm backdrop-blur-[2px]">
                  {item.itemName}
                </div>
              </div>
            </HooWorldItem>
          );
        },
      )}

      {/* ─────────────────────────
          HOO WORLD 배송 대문
          배송 없음: 닫힘
          배송 있음: 양쪽 문이 활짝 열림
      ───────────────────────── */}
      <div
        data-hoo-world-delivery-gate="true"
        data-hoo-world-delivery-open={
          hasDelivery
            ? "true"
            : "false"
        }
        data-hoo-world-delivery-count={
          deliveryCount
        }
        data-hoo-world-delivery-item-count={
          itemCount
        }
        className="pointer-events-none absolute left-[12%] top-[8.5%] z-[16] h-[132px] w-[190px] -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
      >
        {/* 땅 그림자 */}
        <div className="absolute bottom-[4px] left-1/2 h-[20px] w-[150px] -translate-x-1/2 rounded-[50%] bg-[#263b25]/20 blur-[7px]" />

        {/* 좌우 기둥 */}
        <div className="absolute bottom-[15px] left-[18px] h-[103px] w-[18px] rounded-[8px_8px_3px_3px] border border-[#4a3426]/55 bg-gradient-to-r from-[#5b3e2d] via-[#916544] to-[#513728] shadow-[3px_4px_7px_rgba(41,35,27,0.22)]">
          <span className="absolute left-[5px] top-[9px] h-[73px] w-[3px] rounded-full bg-[#c58a5b]/18" />
        </div>

        <div className="absolute bottom-[15px] right-[18px] h-[103px] w-[18px] rounded-[8px_8px_3px_3px] border border-[#4a3426]/55 bg-gradient-to-r from-[#513728] via-[#916544] to-[#5b3e2d] shadow-[-3px_4px_7px_rgba(41,35,27,0.22)]">
          <span className="absolute right-[5px] top-[9px] h-[73px] w-[3px] rounded-full bg-[#c58a5b]/18" />
        </div>

        {/* 상단 가로보 */}
        <div className="absolute left-1/2 top-[5px] h-[23px] w-[174px] -translate-x-1/2 rounded-[7px] border border-[#4d3526]/60 bg-gradient-to-b from-[#9d704d] via-[#765039] to-[#5b3d2c] shadow-[0_4px_7px_rgba(45,37,28,0.20)]">
          <span className="absolute left-[14px] top-[5px] h-[3px] w-[106px] rounded-full bg-[#d19b69]/16" />
        </div>

        {/* 작은 대문 명패 */}
        <div className="absolute left-1/2 top-[17px] z-[3] -translate-x-1/2 rounded-[4px] border border-[#59412f]/50 bg-[#6d4a34] px-[9px] py-[3px] text-[6px] font-black tracking-[0.18em] text-[#f0d8ad] shadow-sm">
          HOO DELIVERY
        </div>

        {/* 왼쪽 문짝 */}
        <div
          className="absolute bottom-[17px] left-[36px] h-[83px] w-[59px] origin-left overflow-hidden rounded-[4px] border border-[#4e3729]/58 bg-gradient-to-r from-[#6d4933] via-[#9a6a49] to-[#745038] shadow-[0_4px_8px_rgba(42,34,27,0.22)]"
          style={{
            transform:
              hasDelivery
                ? "translateX(-18px) rotate(-78deg)"
                : "translateX(0) rotate(0deg)",
            transition:
              "transform 850ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {[18, 39].map(
            (left) => (
              <span
                key={`delivery-left-door-board-${left}`}
                className="absolute bottom-0 top-0 w-[1px] bg-[#4e3428]/32"
                style={{
                  left,
                }}
              />
            ),
          )}

          <span className="absolute left-[7px] right-[7px] top-[15px] h-[5px] rounded bg-[#513629]/30" />
          <span className="absolute bottom-[17px] left-[7px] right-[7px] h-[5px] rounded bg-[#513629]/30" />
        </div>

        {/* 오른쪽 문짝 */}
        <div
          className="absolute bottom-[17px] right-[36px] h-[83px] w-[59px] origin-right overflow-hidden rounded-[4px] border border-[#4e3729]/58 bg-gradient-to-l from-[#6d4933] via-[#9a6a49] to-[#745038] shadow-[0_4px_8px_rgba(42,34,27,0.22)]"
          style={{
            transform:
              hasDelivery
                ? "translateX(18px) rotate(78deg)"
                : "translateX(0) rotate(0deg)",
            transition:
              "transform 850ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {[18, 39].map(
            (left) => (
              <span
                key={`delivery-right-door-board-${left}`}
                className="absolute bottom-0 top-0 w-[1px] bg-[#4e3428]/32"
                style={{
                  left,
                }}
              />
            ),
          )}

          <span className="absolute left-[7px] right-[7px] top-[15px] h-[5px] rounded bg-[#513629]/30" />
          <span className="absolute bottom-[17px] left-[7px] right-[7px] h-[5px] rounded bg-[#513629]/30" />
        </div>

        {/* 배송 도착 시 문 안쪽에 보이는 길 */}
        <div
          className="absolute bottom-[5px] left-1/2 h-[28px] w-[91px] -translate-x-1/2 rounded-[50%_50%_38%_38%] bg-[#b18a62]/24 blur-[1px]"
          style={{
            opacity:
              hasDelivery
                ? 1
                : 0,
            transition:
              "opacity 650ms ease 260ms",
          }}
        />
      </div>

      {/* ─────────────────────────
          배송 상자
          배송이 존재할 때만 대문 안쪽 필드에 나타난다.
          상자 가까이에서 F로 열고 아이템을 필드에 꺼낼 수 있다.
      ───────────────────────── */}
      <div
        data-hoo-world-delivery-box="true"
        data-hoo-world-delivery-visible={
          hasDelivery
            ? "true"
            : "false"
        }
        className="pointer-events-none absolute left-[14.2%] top-[18.5%] z-[15] h-[58px] w-[74px] -translate-x-1/2 -translate-y-1/2"
        style={{
          opacity:
            hasDelivery
              ? 1
              : 0,
          transform:
            hasDelivery
              ? "translate(-50%, -50%) translateY(0) scale(1)"
              : "translate(-50%, -50%) translateY(-22px) scale(0.86)",
          transition:
            "opacity 520ms ease 420ms, transform 720ms cubic-bezier(0.22, 1, 0.36, 1) 320ms",
        }}
        aria-hidden="true"
      >
        <div className="absolute bottom-[-5px] left-1/2 h-[12px] w-[64px] -translate-x-1/2 rounded-[50%] bg-[#31432b]/22 blur-[4px]" />

        {/* 상자 몸통 */}
        <div className="absolute bottom-[3px] left-1/2 h-[42px] w-[70px] -translate-x-1/2 overflow-hidden rounded-[5px] border border-[#5a3c28]/65 bg-gradient-to-br from-[#c18a56] via-[#9f6b42] to-[#795036] shadow-[0_5px_9px_rgba(53,41,31,0.22)]">
          <span className="absolute left-[9px] top-0 h-full w-[3px] bg-[#5f412f]/28" />
          <span className="absolute right-[9px] top-0 h-full w-[3px] bg-[#5f412f]/28" />
          <span className="absolute left-0 right-0 top-[12px] h-[3px] bg-[#5d3f2d]/24" />
          <span className="absolute left-0 right-0 bottom-[9px] h-[3px] bg-[#5d3f2d]/24" />

          <span className="absolute left-1/2 top-[17px] -translate-x-1/2 rounded-[3px] border border-[#735039]/35 bg-[#ead3a6]/82 px-[7px] py-[2px] text-[6px] font-black tracking-[0.15em] text-[#67462f]">
            HOO
          </span>
        </div>

        {/* 뚜껑 */}
        <div className="absolute left-1/2 top-[4px] h-[16px] w-[76px] -translate-x-1/2 -rotate-[2deg] rounded-[5px] border border-[#583b29]/65 bg-gradient-to-b from-[#c8925d] to-[#8e5d3b] shadow-[0_3px_5px_rgba(48,37,28,0.20)]">
          <span className="absolute left-[8px] right-[8px] top-[4px] h-[2px] rounded-full bg-[#e4b07b]/20" />
        </div>

        {/* 최대 5개 아이템을 상징하는 작은 표시 */}
        <div className="absolute -right-[10px] -top-[8px] flex h-[24px] min-w-[24px] items-center justify-center rounded-full border border-[#e8cf9d]/55 bg-[#574333]/92 px-[6px] text-[7px] font-black text-[#ffe6b3] shadow-[0_3px_7px_rgba(31,26,22,0.26)]">
          {itemCount}
        </div>
      </div>

      {/* 상자 가까이 왔을 때 F 열기 안내 */}
      {hasDelivery &&
      isPlayerNearBox &&
      boxPromptPosition &&
      !activeDelivery &&
      typeof document !==
        "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[9998] -translate-x-1/2 -translate-y-full rounded-full border border-[#f4ddb0]/55 bg-[#4b3a2d]/92 px-3 py-1.5 text-[10px] font-black text-[#fff0ca] shadow-[0_5px_15px_rgba(25,22,18,0.28)] backdrop-blur-[2px]"
              style={{
                left:
                  boxPromptPosition.left,
                top:
                  boxPromptPosition.top,
              }}
              aria-hidden="true"
            >
              <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-[#fff0ba] px-1 text-[10px] text-[#4b3a2d]">
                F
              </span>
              배송 상자 열기
            </div>,
            document.body,
          )
        : null}

      {/* 배송 상자 내부 보기 */}
      {activeDelivery &&
      typeof document !==
        "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/48 px-4 backdrop-blur-[2px]"
              onMouseDown={(
                event,
              ) => {
                if (
                  event.target ===
                  event.currentTarget
                ) {
                  setActiveDeliveryId(
                    null,
                  );
                }
              }}
            >
              <dialog
                open
                className="relative m-0 w-[min(92vw,560px)] overflow-hidden rounded-[28px] border border-[#6c4c35]/45 bg-[#efe0c2] p-0 text-[#493726] shadow-[0_30px_90px_rgba(28,22,17,0.42)]"
              >
                <div className="border-b border-[#76533a]/30 bg-gradient-to-b from-[#9a6948] to-[#765039] px-6 py-5 text-[#fff0ce]">
                  <p className="text-[10px] font-black tracking-[0.2em] text-[#ead0a3]/72">
                    HOO DELIVERY
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    배송 상자
                  </h2>

                  <p className="mt-1 text-xs font-bold text-[#f0d9b5]/72">
                    도착한 모든 배송이 이 상자 하나에 모여 있어요. 누구나 열어보고 꺼낼 수 있어요.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveDeliveryId(
                        null,
                      );
                    }}
                    className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/10 text-lg font-black text-white/85 transition hover:bg-black/20"
                    aria-label="배송 상자 닫기"
                  >
                    ×
                  </button>
                </div>

                <div className="max-h-[min(68vh,620px)] overflow-y-auto px-5 py-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeDelivery.items.length >
                    0 ? (
                      activeDelivery.items
                        .map(
                          (
                            item,
                          ) => (
                            <div
                              key={
                                item.deliveryItemId
                              }
                              className="flex min-h-[104px] items-center gap-3 rounded-[18px] border border-[#9a7555]/25 bg-[#fff8e9]/72 p-3 shadow-[0_5px_14px_rgba(77,58,42,0.08)]"
                            >
                              <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-[15px] border border-[#9b7658]/25 bg-[#e8d2ad]">
                                {item.itemImageUrl ? (
                                  <img
                                    src={
                                      item.itemImageUrl
                                    }
                                    alt={
                                      item.itemName
                                    }
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <span
                                    className="text-2xl"
                                    aria-hidden="true"
                                  >
                                    {item.itemType ===
                                      "food" &&
                                    typeof item.itemMetadata.fallback_emoji ===
                                      "string" &&
                                    item.itemMetadata.fallback_emoji.trim()
                                      ? item.itemMetadata.fallback_emoji
                                      : item.itemType ===
                                            "fireworks" ||
                                          item.itemMetadata.interaction_type ===
                                            "fireworks"
                                        ? "🎆"
                                        : "📦"}
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-black tracking-[0.13em] text-[#a18265]">
                                  ITEM{" "}
                                  {item.slotIndex}
                                </p>

                                <p className="mt-1 truncate text-sm font-black text-[#4f3b2c]">
                                  {
                                    item.itemName
                                  }
                                </p>

                                <button
                                  type="button"
                                  disabled={
                                    claimingDeliveryItemId !==
                                    null
                                  }
                                  onClick={() => {
                                    void claimDeliveryItem(
                                      item,
                                    );
                                  }}
                                  className="mt-2 inline-flex min-h-8 items-center justify-center rounded-[10px] border border-[#6d4b34]/25 bg-[#755139] px-3 text-[10px] font-black text-[#fff0cd] shadow-sm transition hover:bg-[#674530] disabled:cursor-wait disabled:opacity-55"
                                >
                                  {claimingDeliveryItemId ===
                                  item.deliveryItemId
                                    ? "꺼내는 중..."
                                    : "필드에 꺼내기"}
                                </button>
                              </div>
                            </div>
                          ),
                        )
                    ) : (
                      <div className="col-span-full rounded-[18px] border border-dashed border-[#967354]/35 bg-[#fff7e7]/55 px-5 py-8 text-center text-sm font-black text-[#80664e]">
                        상자가 비어 있어요.
                      </div>
                    )}
                  </div>

                  {claimMessage ? (
                    <div className="mt-4 rounded-[16px] border border-[#7e684d]/22 bg-[#fff3d6]/72 px-4 py-3 text-[11px] font-black leading-5 text-[#6c513a]">
                      {claimMessage}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[16px] border border-[#a98564]/20 bg-[#dfc59d]/22 px-4 py-3 text-[11px] font-bold leading-5 text-[#765c45]">
                      여러 번 도착한 배송도 이 상자 하나에 모두 합쳐서 표시됩니다.
                      누구나 먼저 꺼낼 수 있고, 필드에 나온 순간 모든 이용자에게 보입니다.
                      한 번 꺼낸 아이템은 다시 상자에 넣을 수 없습니다.
                    </div>
                  )}
                </div>
              </dialog>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

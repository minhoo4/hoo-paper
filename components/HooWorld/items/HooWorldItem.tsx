"use client";

import {
  forwardRef,
  type CSSProperties,
  type ForwardedRef,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

export type HooWorldItemPosition = {
  x: number;
  y: number;
};

type HooWorldItemProps = {
  itemId: string;
  itemType?: string;

  /*
   * x / y는 "최초 기본 위치"이자
   * 로컬에서 이동을 요청할 때 전달되는 좌표다.
   *
   * DB에 이미 저장된 좌표가 있으면
   * 저장된 좌표가 최종 표시 위치가 된다.
   */
  x: number;
  y: number;

  width: number | string;
  height: number | string;
  children: ReactNode;

  movable?: boolean;
  collision?: boolean;
  collisionBottomRatio?: number;
  interactive?: boolean;

  /*
   * Realtime으로 다른 사용자의 이동을 받았을 때
   * 부모 컴포넌트도 자기 좌표 ref/state를 맞춰야 하는 경우 사용한다.
   *
   * 가판대처럼 자체 이동 로직을 가진 아이템은
   * 다음 단계에서 이 콜백을 연결하면 된다.
   */
  onPositionChange?: (
    position: HooWorldItemPosition,
  ) => void;

  zIndex?: number;
  className?: string;
  style?: CSSProperties;
  pointerEvents?: "none" | "auto";
};

type HooWorldItemRow = {
  item_id: string;
  item_type: string;
  x: number;
  y: number;
  is_movable: boolean;
  is_installed: boolean;
  revision: number;
};

function normalizePosition(
  x: number,
  y: number,
): HooWorldItemPosition {
  const safeX =
    Number.isFinite(x)
      ? x
      : 50;

  const safeY =
    Number.isFinite(y)
      ? y
      : 50;

  return {
    x: Math.max(
      0,
      Math.min(
        100,
        safeX,
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        100,
        safeY,
      ),
    ),
  };
}

function isSamePosition(
  first: HooWorldItemPosition,
  second: HooWorldItemPosition,
) {
  return (
    Math.abs(
      first.x -
        second.x,
    ) <
      0.0001 &&
    Math.abs(
      first.y -
        second.y,
    ) <
      0.0001
  );
}

function parseItemRow(
  value: unknown,
): HooWorldItemRow | null {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return null;
  }

  const row =
    value as Record<
      string,
      unknown
    >;

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
    !Number.isFinite(y)
  ) {
    return null;
  }

  return {
    item_id: itemId,
    item_type: itemType,
    x,
    y,
    is_movable:
      row.is_movable ===
      true,
    is_installed:
      row.is_installed !==
      false,
    revision:
      Number.isFinite(
        revision,
      )
        ? revision
        : 0,
  };
}

/*
 * 현재 이 브라우저에서 X 이동모드를 사용 중인 아이템.
 *
 * 각 HooWorldItem은 독립 컴포넌트지만,
 * 동시에 둘 이상의 아이템이 방향키를 가져가지 않도록
 * 모듈 단위에서 활성 아이템 하나만 허용한다.
 */
let activeKeyboardMoveItemId:
  string | null =
  null;

const HOO_WORLD_ITEM_MOVE_EVENT =
  "hoo-world:item-move-mode";

function assignForwardedRef<T>(
  ref: ForwardedRef<T>,
  value: T | null,
) {
  if (
    typeof ref ===
    "function"
  ) {
    ref(value);
    return;
  }

  if (ref) {
    ref.current =
      value;
  }
}

function isTypingTarget(
  target: EventTarget | null,
) {
  return (
    target instanceof
      HTMLInputElement ||
    target instanceof
      HTMLTextAreaElement ||
    target instanceof
      HTMLSelectElement ||
    (
      target instanceof
        HTMLElement &&
      target.isContentEditable
    )
  );
}

function getLocalPlayerElement() {
  return document.querySelector<HTMLElement>(
    '[data-hoo-world-local-player="true"]',
  );
}

function getItemMoveDistanceScore(
  itemElement: HTMLElement,
  playerElement: HTMLElement,
) {
  const itemRect =
    itemElement.getBoundingClientRect();

  const playerRect =
    playerElement.getBoundingClientRect();

  if (
    itemRect.width <= 0 ||
    itemRect.height <= 0 ||
    playerRect.width <= 0 ||
    playerRect.height <= 0
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const playerX =
    playerRect.left +
    playerRect.width /
      2;

  /*
   * 캐릭터는 몸 중심보다 발 위치가 상호작용 기준으로 자연스럽다.
   */
  const playerY =
    playerRect.bottom -
    Math.min(
      18,
      playerRect.height *
        0.08,
    );

  const itemX =
    itemRect.left +
    itemRect.width /
      2;

  const itemY =
    itemRect.bottom -
    Math.min(
      18,
      itemRect.height *
        0.08,
    );

  const radiusX =
    Math.max(
      100,
      itemRect.width *
        0.82,
    );

  const radiusY =
    Math.max(
      82,
      itemRect.height *
        0.5,
    );

  const normalizedX =
    (
      playerX -
      itemX
    ) /
    radiusX;

  const normalizedY =
    (
      playerY -
      itemY
    ) /
    radiusY;

  return (
    normalizedX *
      normalizedX +
    normalizedY *
      normalizedY
  );
}

function getClosestMovableItemId() {
  const playerElement =
    getLocalPlayerElement();

  if (!playerElement) {
    return null;
  }

  const movableItems =
    document.querySelectorAll<HTMLElement>(
      '[data-hoo-world-item="true"][data-hoo-world-movable="true"]',
    );

  let closestItemId:
    string | null =
    null;

  let closestScore =
    Number.POSITIVE_INFINITY;

  movableItems.forEach(
    (itemElement) => {
      const score =
        getItemMoveDistanceScore(
          itemElement,
          playerElement,
        );

      /*
       * score <= 1인 아이템만 X 상호작용 가능 범위다.
       */
      if (
        score > 1 ||
        score >=
          closestScore
      ) {
        return;
      }

      const candidateItemId =
        itemElement.dataset
          .hooWorldItemId;

      if (!candidateItemId) {
        return;
      }

      closestScore =
        score;

      closestItemId =
        candidateItemId;
    },
  );

  return closestItemId;
}

const HooWorldItem = forwardRef<
  HTMLDivElement,
  HooWorldItemProps
>(
  function HooWorldItem(
    {
      itemId,
      itemType = "generic",
      x,
      y,
      width,
      height,
      children,
      movable = false,
      collision = false,
      collisionBottomRatio = 1,
      interactive = false,
      onPositionChange,
      zIndex = 12,
      className = "",
      style,
      pointerEvents = "none",
    },
    ref,
  ) {
    const supabase =
      useMemo(
        () => createClient(),
        [],
      );

    const itemElementRef =
      useRef<HTMLDivElement | null>(
        null,
      );

    const [
      isMoveMode,
      setIsMoveMode,
    ] = useState(false);

    const [
      isInstalled,
      setIsInstalled,
    ] = useState(true);

    const isMoveModeRef =
      useRef(false);

    const [
      isNearForMove,
      setIsNearForMove,
    ] = useState(false);

    const isNearForMoveRef =
      useRef(false);

    const initialPosition =
      useMemo(
        () =>
          normalizePosition(
            x,
            y,
          ),
        [
          x,
          y,
        ],
      );

    const [
      position,
      setPosition,
    ] =
      useState<HooWorldItemPosition>(
        initialPosition,
      );

    const positionRef =
      useRef<HooWorldItemPosition>(
        initialPosition,
      );

    /*
     * 부모 콜백은 Realtime subscription을
     * 매 렌더마다 다시 만들지 않도록 ref로 유지한다.
     */
    const onPositionChangeRef =
      useRef(
        onPositionChange,
      );

    onPositionChangeRef.current =
      onPositionChange;

    /*
     * 서버가 마지막으로 확정한 위치.
     *
     * Realtime으로 받은 좌표를 부모가 다시 x/y로 넘겨도
     * 같은 좌표를 move RPC로 재저장하지 않도록 사용한다.
     */
    const serverPositionRef =
      useRef<HooWorldItemPosition>(
        initialPosition,
      );

    const revisionRef =
      useRef(0);

    const hydratedItemIdRef =
      useRef<string | null>(
        null,
      );

    /*
     * 부모에서 마지막으로 전달된 x/y.
     *
     * DB hydration 때문에 내부 position만 바뀐 경우와
     * 실제 로컬 이동으로 x/y prop이 바뀐 경우를 구분한다.
     */
    const lastInputPositionRef =
      useRef<HooWorldItemPosition>(
        initialPosition,
      );

    const pendingMovePositionRef =
      useRef<HooWorldItemPosition | null>(
        null,
      );

    const moveTimerRef =
      useRef<number | null>(
        null,
      );

    /*
     * HooWorldItem 공용 좌표 저장 함수.
     *
     * 부모 컴포넌트의 별도 이동 로직 없이도
     * X 이동모드가 직접 이 함수를 사용해 Supabase에 저장한다.
     * 80ms trailing으로 연속 방향키 입력의 RPC 폭주를 막는다.
     */
    const queuePositionSave =
      useCallback(
        (
          requestedPosition:
            HooWorldItemPosition,
        ) => {
          if (
            !movable ||
            hydratedItemIdRef.current !==
              itemId
          ) {
            return;
          }

          pendingMovePositionRef.current =
            requestedPosition;

          if (
            moveTimerRef.current !==
            null
          ) {
            window.clearTimeout(
              moveTimerRef.current,
            );
          }

          moveTimerRef.current =
            window.setTimeout(
              () => {
                moveTimerRef.current =
                  null;

                const positionToSave =
                  pendingMovePositionRef.current;

                pendingMovePositionRef.current =
                  null;

                if (!positionToSave) {
                  return;
                }

                void (
                  async () => {
                    const {
                      data,
                      error,
                    } =
                      await supabase.rpc(
                        "move_hoo_world_item",
                        {
                          p_item_id:
                            itemId,
                          p_x:
                            positionToSave.x,
                          p_y:
                            positionToSave.y,
                        },
                      );

                    if (error) {
                      console.error(
                        `HOO WORLD 아이템(${itemId}) 위치 저장에 실패했습니다.`,
                        error,
                      );

                      return;
                    }

                    const rawResult =
                      Array.isArray(data)
                        ? data[0]
                        : data;

                    const row =
                      parseItemRow(
                        rawResult,
                      );

                    if (!row) {
                      return;
                    }

                    const confirmedPosition =
                      normalizePosition(
                        row.x,
                        row.y,
                      );

                    revisionRef.current =
                      Math.max(
                        revisionRef.current,
                        row.revision,
                      );

                    serverPositionRef.current =
                      confirmedPosition;

                    /*
                     * 내가 아직 X 이동 중이면
                     * 80ms 전의 서버 확인 좌표가 현재 드래그 위치를
                     * 뒤로 끌어당기지 않게 화면 적용은 생략한다.
                     */
                    if (
                      isMoveModeRef.current
                    ) {
                      return;
                    }

                    positionRef.current =
                      confirmedPosition;

                    setPosition(
                      confirmedPosition,
                    );

                    onPositionChangeRef.current?.(
                      confirmedPosition,
                    );
                  }
                )();
              },
              80,
            );
        },
        [
          itemId,
          movable,
          supabase,
        ],
      );

    const normalizedCollisionBottomRatio =
      Math.max(
        0.01,
        Math.min(
          1,
          collisionBottomRatio,
        ),
      );

    /*
     * 공용 DB 등록 + 최초 위치 복원 + Realtime 구독.
     *
     * 새 아이템:
     * - itemId가 DB에 없으면 x/y를 기본 좌표로 자동 등록.
     *
     * 기존 아이템:
     * - DB에 저장된 좌표를 불러와 그 자리에서 렌더링.
     *
     * 다른 이용자가 이동:
     * - UPDATE Realtime 이벤트로 즉시 같은 좌표를 반영.
     */
    useEffect(() => {
      let cancelled = false;

      hydratedItemIdRef.current =
        null;

      revisionRef.current =
        0;

      const fallbackPosition =
        normalizePosition(
          x,
          y,
        );

      serverPositionRef.current =
        fallbackPosition;

      lastInputPositionRef.current =
        fallbackPosition;

      positionRef.current =
        fallbackPosition;

      setPosition(
        fallbackPosition,
      );

      function applyItemRow(
        row: HooWorldItemRow,
      ) {
        const nextPosition =
          normalizePosition(
            row.x,
            row.y,
          );

        revisionRef.current =
          row.revision;

        serverPositionRef.current =
          nextPosition;

        hydratedItemIdRef.current =
          itemId;

        positionRef.current =
          nextPosition;

        setPosition(
          nextPosition,
        );

        setIsInstalled(
          row.is_installed,
        );

        onPositionChangeRef.current?.(
          nextPosition,
        );
      }

      /*
       * 초기 위치는 먼저 SELECT로 확인한다.
       *
       * 이미 등록된 아이템이라면 ensure RPC를 매번 호출할 필요가 없고,
       * 로그인 세션이 브라우저에서 복원되기 전 RPC가 먼저 실행되어
       * AUTH_REQUIRED가 나는 문제도 방지한다.
       */
      async function ensureItem() {
        const {
          data: sessionData,
        } =
          await supabase.auth.getSession();

        if (
          cancelled
        ) {
          return;
        }

        /*
         * 세션 복원 전에는 RPC를 호출하지 않는다.
         * onAuthStateChange에서 세션이 준비되는 즉시 다시 실행된다.
         */
        if (
          !sessionData.session
        ) {
          return;
        }

        const {
          data: existingData,
          error: existingError,
        } =
          await supabase
            .from(
              "hoo_world_item_states",
            )
            .select(
              "item_id, item_type, x, y, is_movable, is_installed, revision",
            )
            .eq(
              "item_id",
              itemId,
            )
            .maybeSingle();

        if (
          cancelled
        ) {
          return;
        }

        if (
          !existingError &&
          existingData
        ) {
          const existingRow =
            parseItemRow(
              existingData,
            );

          if (existingRow) {
            applyItemRow(
              existingRow,
            );

            return;
          }
        }

        /*
         * SELECT가 실패했거나 아직 행이 없을 때만
         * 최초 등록 RPC를 호출한다.
         */
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "ensure_hoo_world_item",
            {
              p_item_id:
                itemId,
              p_item_type:
                itemType,
              p_default_x:
                fallbackPosition.x,
              p_default_y:
                fallbackPosition.y,
              p_is_movable:
                movable,
            },
          );

        if (
          cancelled
        ) {
          return;
        }

        if (error) {
          /*
           * 초기화 실패는 월드 렌더링을 막는 치명적 오류가 아니다.
           * 기본 좌표로 계속 사용할 수 있으므로 dev overlay를 띄우는
           * console.error 대신 warning으로 남긴다.
           */
          console.warn(
            `HOO WORLD 아이템(${itemId}) 초기 동기화를 건너뜁니다.`,
            error,
          );

          hydratedItemIdRef.current =
            itemId;

          return;
        }

        const rawResult =
          Array.isArray(data)
            ? data[0]
            : data;

        const row =
          parseItemRow(
            rawResult,
          );

        if (!row) {
          hydratedItemIdRef.current =
            itemId;

          return;
        }

        applyItemRow(
          row,
        );
      }

      const channel =
        supabase
          .channel(
            `hoo-world-item:${itemId}`,
          )
          .on(
            "postgres_changes",
            {
              event:
                "UPDATE",
              schema:
                "public",
              table:
                "hoo_world_item_states",
              filter:
                `item_id=eq.${itemId}`,
            },
            (payload) => {
              if (
                cancelled
              ) {
                return;
              }

              const row =
                parseItemRow(
                  payload.new,
                );

              if (
                !row ||
                row.item_id !==
                  itemId
              ) {
                return;
              }

              /*
               * 늦게 도착한 예전 이벤트가
               * 최신 좌표를 덮어쓰지 않도록 revision 비교.
               */
              if (
                row.revision <
                revisionRef.current
              ) {
                return;
              }

              revisionRef.current =
                row.revision;

              setIsInstalled(
                row.is_installed,
              );

              /*
               * 소비/회수 등으로 월드에서 제거된 아이템은
               * 이동모드를 즉시 종료한다.
               */
              if (
                !row.is_installed &&
                activeKeyboardMoveItemId ===
                  itemId
              ) {
                activeKeyboardMoveItemId =
                  null;

                isMoveModeRef.current =
                  false;

                setIsMoveMode(
                  false,
                );

                window.dispatchEvent(
                  new CustomEvent(
                    HOO_WORLD_ITEM_MOVE_EVENT,
                    {
                      detail: {
                        active:
                          false,
                        itemId,
                      },
                    },
                  ),
                );
              }

              const nextPosition =
                normalizePosition(
                  row.x,
                  row.y,
                );

              serverPositionRef.current =
                nextPosition;

              /*
               * 내가 이 아이템을 옮기는 동안에는
               * 내 직전 RPC의 Realtime echo가 현재 키보드 위치를
               * 뒤로 당기지 않도록 화면 좌표는 건드리지 않는다.
               */
              if (
                isMoveModeRef.current &&
                activeKeyboardMoveItemId ===
                  itemId
              ) {
                return;
              }

              positionRef.current =
                nextPosition;

              setPosition(
                nextPosition,
              );

              onPositionChangeRef.current?.(
                nextPosition,
              );
            },
          )
          .subscribe();

      /*
       * getSession() 자체가 Supabase Auth 초기화 완료를 기다린다.
       *
       * 따라서 onAuthStateChange(INITIAL_SESSION) 콜백 안에서
       * 다시 ensureItem() -> getSession()을 호출하면,
       * 아이템이 여러 개 렌더링될 때 Auth의 _initialize()가
       * 자기 초기화를 다시 기다리는 재귀 구조가 생길 수 있다.
       *
       * 월드 아이템 초기화는 최초 1회 ensureItem()만 실행한다.
       */
      void ensureItem();

      return () => {
        cancelled = true;

        if (
          moveTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            moveTimerRef.current,
          );

          moveTimerRef.current =
            null;
        }

        pendingMovePositionRef.current =
          null;

        void supabase.removeChannel(
          channel,
        );
      };
    }, [
      itemId,
      itemType,
      movable,
      supabase,
    ]);

    /*
     * 부모 x/y가 실제로 바뀌는 기존 사용 방식도 계속 지원한다.
     *
     * 새 공용 X 이동은 HooWorldItem 내부에서 직접 움직이지만,
     * 외부에서 x/y를 제어하는 기존 아이템도 깨지지 않는다.
     */
    useEffect(() => {
      const nextInputPosition =
        normalizePosition(
          x,
          y,
        );

      const previousInputPosition =
        lastInputPositionRef.current;

      lastInputPositionRef.current =
        nextInputPosition;

      if (
        isSamePosition(
          previousInputPosition,
          nextInputPosition,
        )
      ) {
        return;
      }

      if (
        hydratedItemIdRef.current !==
        itemId
      ) {
        return;
      }

      if (
        isSamePosition(
          serverPositionRef.current,
          nextInputPosition,
        )
      ) {
        positionRef.current =
          nextInputPosition;

        setPosition(
          nextInputPosition,
        );

        return;
      }

      if (!movable) {
        return;
      }

      positionRef.current =
        nextInputPosition;

      setPosition(
        nextInputPosition,
      );

      queuePositionSave(
        nextInputPosition,
      );
    }, [
      itemId,
      movable,
      queuePositionSave,
      x,
      y,
    ]);

    /*
     * movable 아이템 공용 X 이동모드.
     *
     * - 로컬 플레이어와 가까운 가장 가까운 movable 아이템만 X 선택 가능
     * - X: 이동 시작 / 완료
     * - 방향키 / WASD: 누르고 있는 동안 부드럽게 연속 이동
     * - Shift + 방향키 / WASD: 빠른 연속 이동
     * - 위치 저장 / Realtime은 HooWorldItem 자체가 처리
     *
     * 키보드 OS repeat 속도에 의존하지 않고 requestAnimationFrame으로
     * 이동시키기 때문에 첫 입력 뒤 멈칫하지 않고 바로 이어진다.
     */
    useEffect(() => {
      if (!movable) {
        isNearForMoveRef.current =
          false;

        setIsNearForMove(
          false,
        );

        return;
      }

      const itemElement =
        itemElementRef.current;

      if (!itemElement) {
        return;
      }

      const activeItemElement =
        itemElement;

      /*
       * 현재 눌려 있는 방향키/WASD만 기억한다.
       * 실제 이동은 keydown 이벤트가 아니라 RAF 루프에서 처리한다.
       */
      const pressedMoveKeys =
        new Set<string>();

      let isFastMovePressed =
        false;

      let proximityFrame:
        number | null =
        null;

      let movementFrame:
        number | null =
        null;

      let lastMovementTimestamp:
        number | null =
        null;

      function updateProximity() {
        const playerElement =
          getLocalPlayerElement();

        const nextIsNear =
          playerElement
            ? getItemMoveDistanceScore(
                activeItemElement,
                playerElement,
              ) <= 1
            : false;

        if (
          nextIsNear !==
          isNearForMoveRef.current
        ) {
          isNearForMoveRef.current =
            nextIsNear;

          setIsNearForMove(
            nextIsNear,
          );
        }

        proximityFrame =
          requestAnimationFrame(
            updateProximity,
          );
      }

      function dispatchMoveModeEvent(
        active: boolean,
      ) {
        window.dispatchEvent(
          new CustomEvent(
            HOO_WORLD_ITEM_MOVE_EVENT,
            {
              detail: {
                active,
                itemId,
              },
            },
          ),
        );
      }

      function dispatchMoveStepEvent(
        deltaX: number,
        deltaY: number,
        nextPosition:
          HooWorldItemPosition,
      ) {
        if (
          Math.abs(deltaX) <
            0.0001 &&
          Math.abs(deltaY) <
            0.0001
        ) {
          return;
        }

        window.dispatchEvent(
          new CustomEvent(
            "hoo-world:item-move-step",
            {
              detail: {
                itemId,
                itemType,
                deltaX,
                deltaY,
                x:
                  nextPosition.x,
                y:
                  nextPosition.y,
              },
            },
          ),
        );
      }

      function isMoveKey(
        code: string,
      ) {
        return (
          code === "ArrowLeft" ||
          code === "ArrowRight" ||
          code === "ArrowUp" ||
          code === "ArrowDown" ||
          code === "KeyA" ||
          code === "KeyD" ||
          code === "KeyW" ||
          code === "KeyS"
        );
      }

      function isFastMoveKey(
        code: string,
      ) {
        return (
          code === "ShiftLeft" ||
          code === "ShiftRight"
        );
      }

      function finishMoveMode() {
        if (
          activeKeyboardMoveItemId !==
            itemId
        ) {
          return;
        }

        pressedMoveKeys.clear();

        isFastMovePressed =
          false;

        lastMovementTimestamp =
          null;

        activeKeyboardMoveItemId =
          null;

        isMoveModeRef.current =
          false;

        setIsMoveMode(
          false,
        );

        queuePositionSave(
          positionRef.current,
        );

        dispatchMoveModeEvent(
          false,
        );
      }

      function applyContinuousMovement(
        timestamp: number,
      ) {
        const isActive =
          activeKeyboardMoveItemId ===
            itemId &&
          isMoveModeRef.current;

        if (!isActive) {
          lastMovementTimestamp =
            timestamp;

          movementFrame =
            requestAnimationFrame(
              applyContinuousMovement,
            );

          return;
        }

        const moveX =
          Number(
            pressedMoveKeys.has(
              "ArrowRight",
            ) ||
              pressedMoveKeys.has(
                "KeyD",
              ),
          ) -
          Number(
            pressedMoveKeys.has(
              "ArrowLeft",
            ) ||
              pressedMoveKeys.has(
                "KeyA",
              ),
          );

        const moveY =
          Number(
            pressedMoveKeys.has(
              "ArrowDown",
            ) ||
              pressedMoveKeys.has(
                "KeyS",
              ),
          ) -
          Number(
            pressedMoveKeys.has(
              "ArrowUp",
            ) ||
              pressedMoveKeys.has(
                "KeyW",
              ),
          );

        const previousTimestamp =
          lastMovementTimestamp ??
          timestamp;

        /*
         * 탭 복귀 등으로 큰 deltaTime이 들어와
         * 아이템이 한 번에 순간이동하지 않도록 최대 50ms까지만 반영한다.
         */
        const deltaSeconds =
          Math.min(
            0.05,
            Math.max(
              0,
              (
                timestamp -
                previousTimestamp
              ) / 1000,
            ),
          );

        lastMovementTimestamp =
          timestamp;

        if (
          moveX === 0 &&
          moveY === 0
        ) {
          movementFrame =
            requestAnimationFrame(
              applyContinuousMovement,
            );

          return;
        }

        /*
         * 기존 키 반복 입력 체감 속도를 초당 이동량으로 환산했다.
         * 일반 약 10.5 / sec, Shift 약 30 / sec.
         */
        const moveSpeed =
          isFastMovePressed
            ? 30
            : 10.5;

        const magnitude =
          Math.hypot(
            moveX,
            moveY,
          ) || 1;

        const deltaX =
          (
            moveX /
            magnitude
          ) *
          moveSpeed *
          deltaSeconds;

        const deltaY =
          (
            moveY /
            magnitude
          ) *
          moveSpeed *
          deltaSeconds;

        const current =
          positionRef.current;

        const nextPosition =
          normalizePosition(
            Math.max(
              5,
              Math.min(
                95,
                current.x +
                  deltaX,
              ),
            ),
            Math.max(
              9,
              Math.min(
                93,
                current.y +
                  deltaY,
              ),
            ),
          );

        const actualDeltaX =
          nextPosition.x -
          current.x;

        const actualDeltaY =
          nextPosition.y -
          current.y;

        if (
          Math.abs(actualDeltaX) >=
            0.0001 ||
          Math.abs(actualDeltaY) >=
            0.0001
        ) {
          positionRef.current =
            nextPosition;

          /*
           * 부모가 좌표 state를 가진 기존 아이템도
           * 동일 좌표를 유지하도록 맞춘다.
           */
          lastInputPositionRef.current =
            nextPosition;

          setPosition(
            nextPosition,
          );

          onPositionChangeRef.current?.(
            nextPosition,
          );

          /*
           * 연속 이동 중에는 trailing save가 계속 최신 좌표로 갱신되고,
           * 키를 놓거나 이동모드를 끝낸 뒤 최종 좌표가 저장된다.
           */
          queuePositionSave(
            nextPosition,
          );

          /*
           * 아이템이 실제로 움직인 만큼
           * 로컬 캐릭터도 같은 프레임에서 함께 움직인다.
           */
          dispatchMoveStepEvent(
            actualDeltaX,
            actualDeltaY,
            nextPosition,
          );
        }

        movementFrame =
          requestAnimationFrame(
            applyContinuousMovement,
          );
      }

      function handleMoveKeyboard(
        event: KeyboardEvent,
      ) {
        if (
          isTypingTarget(
            event.target,
          )
        ) {
          return;
        }

        /*
         * 다른 모달 기능을 사용하는 중에는
         * 월드 아이템 이동모드를 시작하지 않는다.
         */
        if (
          !isMoveModeRef.current &&
          document.querySelector(
            "dialog[open]",
          )
        ) {
          return;
        }

        if (
          event.code ===
            "KeyX"
        ) {
          if (event.repeat) {
            return;
          }

          if (
            activeKeyboardMoveItemId
          ) {
            if (
              activeKeyboardMoveItemId !==
                itemId
            ) {
              return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();

            finishMoveMode();

            return;
          }

          if (
            !isNearForMoveRef.current ||
            getClosestMovableItemId() !==
              itemId
          ) {
            return;
          }

          event.preventDefault();
          event.stopImmediatePropagation();

          pressedMoveKeys.clear();

          isFastMovePressed =
            event.shiftKey;

          lastMovementTimestamp =
            null;

          activeKeyboardMoveItemId =
            itemId;

          isMoveModeRef.current =
            true;

          setIsMoveMode(
            true,
          );

          dispatchMoveModeEvent(
            true,
          );

          return;
        }

        if (
          activeKeyboardMoveItemId !==
            itemId ||
          !isMoveModeRef.current
        ) {
          return;
        }

        if (
          isFastMoveKey(
            event.code,
          )
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();

          isFastMovePressed =
            true;

          return;
        }

        if (
          !isMoveKey(
            event.code,
          )
        ) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        /*
         * OS key-repeat과 무관하게 Set에 "눌림 상태"만 저장한다.
         * 이동 자체는 RAF 루프가 담당한다.
         */
        pressedMoveKeys.add(
          event.code,
        );

        if (event.shiftKey) {
          isFastMovePressed =
            true;
        }
      }

      function handleMoveKeyboardUp(
        event: KeyboardEvent,
      ) {
        if (
          activeKeyboardMoveItemId !==
            itemId ||
          !isMoveModeRef.current
        ) {
          return;
        }

        if (
          isFastMoveKey(
            event.code,
          )
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();

          /*
           * 다른 Shift 키가 남아있는 경우 event.shiftKey가 true다.
           */
          isFastMovePressed =
            event.shiftKey;

          return;
        }

        if (
          !isMoveKey(
            event.code,
          )
        ) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        pressedMoveKeys.delete(
          event.code,
        );

        /*
         * 모든 방향키를 놓은 순간 기준 시간을 리셋해
         * 다음 입력 때 누적 deltaTime으로 튀지 않게 한다.
         */
        if (
          pressedMoveKeys.size ===
          0
        ) {
          lastMovementTimestamp =
            null;
        }
      }

      function handleWindowBlur() {
        pressedMoveKeys.clear();

        isFastMovePressed =
          false;

        lastMovementTimestamp =
          null;

        finishMoveMode();
      }

      window.addEventListener(
        "keydown",
        handleMoveKeyboard,
        true,
      );

      window.addEventListener(
        "keyup",
        handleMoveKeyboardUp,
        true,
      );

      window.addEventListener(
        "blur",
        handleWindowBlur,
      );

      proximityFrame =
        requestAnimationFrame(
          updateProximity,
        );

      movementFrame =
        requestAnimationFrame(
          applyContinuousMovement,
        );

      return () => {
        pressedMoveKeys.clear();

        isFastMovePressed =
          false;

        if (
          proximityFrame !==
            null
        ) {
          cancelAnimationFrame(
            proximityFrame,
          );
        }

        if (
          movementFrame !==
            null
        ) {
          cancelAnimationFrame(
            movementFrame,
          );
        }

        window.removeEventListener(
          "keydown",
          handleMoveKeyboard,
          true,
        );

        window.removeEventListener(
          "keyup",
          handleMoveKeyboardUp,
          true,
        );

        window.removeEventListener(
          "blur",
          handleWindowBlur,
        );

        if (
          activeKeyboardMoveItemId ===
            itemId
        ) {
          activeKeyboardMoveItemId =
            null;

          dispatchMoveModeEvent(
            false,
          );
        }
      };
    }, [
      itemId,
      movable,
      queuePositionSave,
    ]);



    if (!isInstalled) {
      return null;
    }

    return (
      <div
        ref={(node) => {
          itemElementRef.current =
            node;

          assignForwardedRef(
            ref,
            node,
          );
        }}
        data-hoo-world-item="true"
        data-hoo-world-item-id={
          itemId
        }
        data-hoo-world-item-type={
          itemType
        }
        data-hoo-world-item-x={
          position.x
        }
        data-hoo-world-item-y={
          position.y
        }
        data-hoo-world-movable={
          movable
            ? "true"
            : "false"
        }
        data-hoo-world-collision-object={
          collision
            ? "true"
            : "false"
        }
        data-hoo-world-collision-bottom-ratio={
          normalizedCollisionBottomRatio
        }
        data-hoo-world-interactive={
          interactive
            ? "true"
            : "false"
        }
        data-hoo-world-item-move-mode={
          isMoveMode
            ? "true"
            : "false"
        }
        className={`absolute left-0 top-0${
          isMoveMode
            ? " drop-shadow-[0_0_8px_rgba(255,244,173,0.9)]"
            : ""
        }${
          className
            ? ` ${className}`
            : ""
        }`}
        style={{
          width,
          height,
          zIndex,
          pointerEvents,
          transform: `translate3d(${position.x}vw, ${position.y}vh, 0) translate(-50%, -50%)`,
          ...style,
        }}
      >
        {children}

        {movable ? (
          <div
            data-hoo-world-move-prompt="true"
            aria-hidden={
              !(
                isMoveMode ||
                isNearForMove
              )
            }
            className="pointer-events-none absolute -bottom-[44px] left-1/2 z-[80] -translate-x-1/2 items-center gap-[5px] whitespace-nowrap rounded-full border border-white/35 bg-[#2f3228]/88 px-[9px] py-[5px] shadow-[0_3px_8px_rgba(39,43,33,0.20)] backdrop-blur-sm"
            style={{
              display:
                isMoveMode ||
                isNearForMove
                  ? "flex"
                  : "none",
            }}
          >
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-[#fff2ad] text-[9px] font-black text-[#4a4023]">
              X
            </span>

            <span className="text-[7px] font-black text-white">
              {isMoveMode
                ? "이동 중 · 방향키/WASD / X 완료"
                : "이동"}
            </span>
          </div>
        ) : null}
      </div>
    );
  },
);

HooWorldItem.displayName =
  "HooWorldItem";

export default HooWorldItem;

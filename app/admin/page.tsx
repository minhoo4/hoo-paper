"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

type AdminStatus = {
  isLoggedIn: boolean;
  isAdmin: boolean;
  canManage: boolean;
};

type CoffeeRecord = {
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  approvedAt: string;
};

type CoffeeData = {
  ok: boolean;
  stats: {
    today: {
      count: number;
      amount: number;
    };
    month: {
      count: number;
      amount: number;
    };
  };
  recent: CoffeeRecord[];
  error?: string;
};

type HooWorldItemRequestStatus =
  | "requested"
  | "making"
  | "delivered"
  | "rejected";

type HooWorldItemRequest = {
  id: string;
  userId: string;
  nickname: string;
  requestText: string;
  offeredHooCoin: number;
  productionHooCoin: number | null;
  status: HooWorldItemRequestStatus;
  createdAt: string;
};

type HooWorldItemRequestRow = {
  id: string;
  user_id: string;
  request_text: string;
  offered_hoo_coin: number | string;
  production_hoo_coin: number | string | null;
  status: string;
  created_at: string;
};

type HooWorldDistributionDraft = {
  requestId: string;
  itemType: string;
  itemName: string;
  itemImageUrl: string;
  productionHooCoin: string;
  width: string;
  height: string;
};

function formatMoney(
  value: number,
) {
  return `${value.toLocaleString(
    "ko-KR",
  )}원`;
}

function formatApprovedAt(
  value: string,
) {
  try {
    return new Intl.DateTimeFormat(
      "ko-KR",
      {
        timeZone: "Asia/Seoul",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
    ).format(new Date(value));
  } catch {
    return "-";
  }
}

function shortenOrderId(
  orderId: string,
) {
  if (orderId.length <= 18) {
    return orderId;
  }

  return `${orderId.slice(
    0,
    10,
  )}…${orderId.slice(-6)}`;
}

function formatRequestCreatedAt(
  value: string,
) {
  try {
    return new Intl.DateTimeFormat(
      "ko-KR",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      },
    ).format(new Date(value));
  } catch {
    return "-";
  }
}

function getRequestStatusLabel(
  status: HooWorldItemRequestStatus,
) {
  switch (status) {
    case "making":
      return "제작중";

    case "delivered":
      return "배포완료";

    case "rejected":
      return "거절";

    case "requested":
    default:
      return "신규 요청";
  }
}

function getRequestStatusColor(
  status: HooWorldItemRequestStatus,
) {
  switch (status) {
    case "making":
      return "#e7bc82";

    case "delivered":
      return "#83d7a2";

    case "rejected":
      return "#ff9d9d";

    case "requested":
    default:
      return "#9fc6ff";
  }
}

export default function AdminPage() {
  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [status, setStatus] =
    useState<AdminStatus | null>(
      null,
    );

  const [coffeeData, setCoffeeData] =
    useState<CoffeeData | null>(
      null,
    );

  const [coffeeLoading, setCoffeeLoading] =
    useState(true);

  const [coffeeError, setCoffeeError] =
    useState("");

  const [title, setTitle] =
    useState("");

  const [content, setContent] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [
    hooWorldItemRequests,
    setHooWorldItemRequests,
  ] =
    useState<HooWorldItemRequest[]>(
      [],
    );

  const [
    hooWorldItemRequestsLoading,
    setHooWorldItemRequestsLoading,
  ] =
    useState(true);

  const [
    hooWorldItemRequestsError,
    setHooWorldItemRequestsError,
  ] =
    useState("");

  const [
    hooWorldItemRequestsRealtimeConnected,
    setHooWorldItemRequestsRealtimeConnected,
  ] =
    useState(false);

  const [
    hooWorldItemRequestActionId,
    setHooWorldItemRequestActionId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    hooWorldItemRequestActionMessage,
    setHooWorldItemRequestActionMessage,
  ] =
    useState("");

  const [
    hooWorldStallTotal,
    setHooWorldStallTotal,
  ] =
    useState<number | null>(
      null,
    );

  const [
    hooWorldStallTotalLoading,
    setHooWorldStallTotalLoading,
  ] =
    useState(true);

  const [
    hooWorldDistributionDraft,
    setHooWorldDistributionDraft,
  ] =
    useState<HooWorldDistributionDraft | null>(
      null,
    );

  useEffect(() => {
    fetch("/api/admin/me", {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then(
        (
          result: AdminStatus,
        ) => {
          setStatus(result);
        },
      )
      .catch(() =>
        setStatus({
          isLoggedIn: false,
          isAdmin: false,
          canManage: false,
        }),
      );
  }, []);

  useEffect(() => {
    if (
      !status?.isLoggedIn ||
      !status.isAdmin
    ) {
      return;
    }

    let cancelled = false;

    async function loadCoffee() {
      setCoffeeLoading(true);
      setCoffeeError("");

      try {
        const response =
          await fetch(
            "/api/admin/coffee",
            {
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as
            CoffeeData;

        if (
          !response.ok ||
          !data.ok
        ) {
          throw new Error(
            data.error ??
              "커피 기록을 불러오지 못했습니다.",
          );
        }

        if (!cancelled) {
          setCoffeeData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setCoffeeError(
            error instanceof Error
              ? error.message
              : "커피 기록을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setCoffeeLoading(false);
        }
      }
    }

    void loadCoffee();

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (
      !status?.isLoggedIn ||
      !status.isAdmin ||
      !status.canManage
    ) {
      setHooWorldItemRequests(
        [],
      );

      setHooWorldItemRequestsLoading(
        false,
      );

      setHooWorldItemRequestsRealtimeConnected(
        false,
      );

      return;
    }

    let cancelled = false;

    let refreshTimer:
      ReturnType<
        typeof setTimeout
      > | null = null;

    async function loadRequests(
      showLoading = false,
    ) {
      if (showLoading) {
        setHooWorldItemRequestsLoading(
          true,
        );
      }

      try {
        setHooWorldItemRequestsError(
          "",
        );

        const {
          data: requestRows,
          error: requestError,
        } =
          await supabase
            .from(
              "hoo_world_item_requests",
            )
            .select(
              `
                id,
                user_id,
                request_text,
                offered_hoo_coin,
                production_hoo_coin,
                status,
                created_at
              `,
            )
            .order(
              "created_at",
              {
                ascending: false,
              },
            )
            .limit(100);

        if (requestError) {
          throw requestError;
        }

        if (cancelled) {
          return;
        }

        const rows =
          (
            requestRows ?? []
          ) as HooWorldItemRequestRow[];

        const userIds =
          Array.from(
            new Set(
              rows.map(
                (row) =>
                  row.user_id,
              ),
            ),
          ).filter(Boolean);

        const nicknameByUserId =
          new Map<string, string>();

        if (
          userIds.length > 0
        ) {
          const {
            data: profileRows,
            error: profileError,
          } =
            await supabase
              .from("profiles")
              .select(
                "id, nickname",
              )
              .in(
                "id",
                userIds,
              );

          if (profileError) {
            console.warn(
              "제작 요청 신청자 닉네임을 불러오지 못했습니다.",
              profileError,
            );
          } else {
            (
              profileRows ?? []
            ).forEach(
              (profile) => {
                if (
                  typeof profile.id ===
                    "string" &&
                  typeof profile.nickname ===
                    "string"
                ) {
                  nicknameByUserId.set(
                    profile.id,
                    profile.nickname,
                  );
                }
              },
            );
          }
        }

        if (cancelled) {
          return;
        }

        const normalizedRequests =
          rows.map(
            (
              row,
            ): HooWorldItemRequest => {
              const rawStatus =
                row.status;

              const normalizedStatus:
                HooWorldItemRequestStatus =
                  rawStatus ===
                    "making" ||
                  rawStatus ===
                    "delivered" ||
                  rawStatus ===
                    "rejected"
                    ? rawStatus
                    : "requested";

              const offeredHooCoin =
                Number(
                  row.offered_hoo_coin,
                );

              const productionHooCoin =
                row.production_hoo_coin ===
                null
                  ? null
                  : Number(
                      row.production_hoo_coin,
                    );

              return {
                id: row.id,
                userId:
                  row.user_id,
                nickname:
                  nicknameByUserId.get(
                    row.user_id,
                  ) ??
                  "닉네임 없음",
                requestText:
                  row.request_text,
                offeredHooCoin:
                  Number.isFinite(
                    offeredHooCoin,
                  )
                    ? Math.max(
                        0,
                        Math.floor(
                          offeredHooCoin,
                        ),
                      )
                    : 0,
                productionHooCoin:
                  productionHooCoin !==
                    null &&
                  Number.isFinite(
                    productionHooCoin,
                  )
                    ? Math.max(
                        0,
                        Math.floor(
                          productionHooCoin,
                        ),
                      )
                    : null,
                status:
                  normalizedStatus,
                createdAt:
                  row.created_at,
              };
            },
          );

        setHooWorldItemRequests(
          normalizedRequests,
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "후월드 제작 요청을 불러오지 못했습니다.",
            error,
          );

          setHooWorldItemRequestsError(
            error instanceof Error
              ? error.message
              : "후월드 제작 요청을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (
          showLoading &&
          !cancelled
        ) {
          setHooWorldItemRequestsLoading(
            false,
          );
        }
      }
    }

    function scheduleRefresh() {
      if (
        refreshTimer
      ) {
        clearTimeout(
          refreshTimer,
        );
      }

      refreshTimer =
        setTimeout(
          () => {
            refreshTimer =
              null;

            void loadRequests(
              false,
            );
          },
          120,
        );
    }

    void loadRequests(
      true,
    );

    const channel =
      supabase
        .channel(
          "admin-hoo-world-item-requests",
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "hoo_world_item_requests",
          },
          () => {
            scheduleRefresh();
          },
        )
        .subscribe(
          (subscriptionStatus) => {
            if (cancelled) {
              return;
            }

            setHooWorldItemRequestsRealtimeConnected(
              subscriptionStatus ===
                "SUBSCRIBED",
            );
          },
        );

    const fallbackTimer =
      window.setInterval(
        () => {
          void loadRequests(
            false,
          );
        },
        15000,
      );

    return () => {
      cancelled = true;

      if (
        refreshTimer
      ) {
        clearTimeout(
          refreshTimer,
        );
      }

      window.clearInterval(
        fallbackTimer,
      );

      void supabase.removeChannel(
        channel,
      );
    };
  }, [
    status,
    supabase,
  ]);

  useEffect(() => {
    if (
      !status?.isLoggedIn ||
      !status.isAdmin ||
      !status.canManage
    ) {
      setHooWorldStallTotal(
        null,
      );

      setHooWorldStallTotalLoading(
        false,
      );

      return;
    }

    let cancelled = false;

    async function loadHooWorldStallTotal(
      showLoading = false,
    ) {
      if (showLoading) {
        setHooWorldStallTotalLoading(
          true,
        );
      }

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "get_hoo_world_stall_state",
          );

        if (
          cancelled
        ) {
          return;
        }

        if (error) {
          console.warn(
            "후월드 공동 모금액을 불러오지 못했습니다.",
            error,
          );

          return;
        }

        const result =
          data &&
          typeof data ===
            "object" &&
          !Array.isArray(data)
            ? (
                data as {
                  total_hoo_coin?: unknown;
                }
              )
            : null;

        const nextTotal =
          Number(
            result?.total_hoo_coin ??
              0,
          );

        setHooWorldStallTotal(
          Number.isFinite(
            nextTotal,
          )
            ? Math.max(
                0,
                Math.floor(
                  nextTotal,
                ),
              )
            : 0,
        );
      } finally {
        if (
          showLoading &&
          !cancelled
        ) {
          setHooWorldStallTotalLoading(
            false,
          );
        }
      }
    }

    void loadHooWorldStallTotal(
      true,
    );

    const timer =
      window.setInterval(
        () => {
          void loadHooWorldStallTotal(
            false,
          );
        },
        5000,
      );

    return () => {
      cancelled = true;

      window.clearInterval(
        timer,
      );
    };
  }, [
    status,
    supabase,
  ]);

  async function startHooWorldItemRequestMaking(
    requestId: string,
  ) {
    if (
      hooWorldItemRequestActionId
    ) {
      return;
    }

    setHooWorldItemRequestActionId(
      requestId,
    );

    setHooWorldItemRequestActionMessage(
      "",
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_start_hoo_world_item_request",
          {
            p_request_id:
              requestId,
          },
        );

      if (error) {
        const errorMessage =
          error.message ?? "";

        if (
          errorMessage.includes(
            "AUTH_REQUIRED",
          )
        ) {
          setHooWorldItemRequestActionMessage(
            "로그인이 필요합니다.",
          );

          return;
        }

        if (
          errorMessage.includes(
            "ADMIN_REQUIRED",
          )
        ) {
          setHooWorldItemRequestActionMessage(
            "관리자 권한이 없습니다.",
          );

          return;
        }

        if (
          errorMessage.includes(
            "REQUEST_NOT_FOUND",
          )
        ) {
          setHooWorldItemRequestActionMessage(
            "제작 요청을 찾을 수 없습니다.",
          );

          return;
        }

        if (
          errorMessage.includes(
            "INVALID_REQUEST_STATUS",
          )
        ) {
          setHooWorldItemRequestActionMessage(
            "이미 처리된 제작 요청입니다.",
          );

          return;
        }

        console.error(
          "후월드 제작 시작 처리 실패:",
          error,
        );

        setHooWorldItemRequestActionMessage(
          "제작 시작 처리에 실패했습니다.",
        );

        return;
      }

      const result =
        data &&
        typeof data ===
          "object" &&
        !Array.isArray(data)
          ? (
              data as {
                request_id?: unknown;
                status?: unknown;
              }
            )
          : null;

      const resultRequestId =
        typeof result?.request_id ===
        "string"
          ? result.request_id
          : requestId;

      setHooWorldItemRequests(
        (current) =>
          current.map(
            (request) =>
              request.id ===
              resultRequestId
                ? {
                    ...request,
                    status:
                      "making",
                  }
                : request,
          ),
      );

      setHooWorldItemRequestActionMessage(
        "제작중 상태로 변경했습니다.",
      );
    } catch (error) {
      console.error(
        "후월드 제작 시작 처리 중 오류:",
        error,
      );

      setHooWorldItemRequestActionMessage(
        "제작 시작 처리 중 서버 오류가 발생했습니다.",
      );
    } finally {
      setHooWorldItemRequestActionId(
        null,
      );
    }
  }

  function openHooWorldDistribution(
    request: HooWorldItemRequest,
  ) {
    if (
      request.status !==
      "making"
    ) {
      return;
    }

    setHooWorldItemRequestActionMessage(
      "",
    );

    setHooWorldDistributionDraft({
      requestId:
        request.id,

      itemType:
        "generic",

      itemName:
        request.requestText
          .trim()
          .slice(
            0,
            80,
          ) || "배송 아이템",

      itemImageUrl:
        "",

      /*
       * 이용자의 제시 금액을 초기값으로만 넣는다.
       * 관리자가 실제 제작비를 자유롭게 바꿀 수 있다.
       */
      productionHooCoin:
        String(
          request.offeredHooCoin,
        ),

      width:
        "86",

      height:
        "86",
    });
  }

  async function distributeHooWorldItemRequest() {
    const draft =
      hooWorldDistributionDraft;

    if (
      !draft ||
      hooWorldItemRequestActionId
    ) {
      return;
    }

    const request =
      hooWorldItemRequests.find(
        (item) =>
          item.id ===
          draft.requestId,
      );

    if (
      !request ||
      request.status !==
        "making"
    ) {
      setHooWorldItemRequestActionMessage(
        "현재 제작중인 요청을 찾을 수 없습니다.",
      );

      setHooWorldDistributionDraft(
        null,
      );

      return;
    }

    const productionHooCoin =
      Number(
        draft.productionHooCoin,
      );

    const width =
      Number(
        draft.width,
      );

    const height =
      Number(
        draft.height,
      );

    const itemType =
      draft.itemType.trim();

    const itemName =
      draft.itemName.trim();

    const itemImageUrl =
      draft.itemImageUrl.trim();

    if (
      !Number.isSafeInteger(
        productionHooCoin,
      ) ||
      productionHooCoin < 0
    ) {
      setHooWorldItemRequestActionMessage(
        "실제 제작비는 0 이상의 정수로 입력해 주세요.",
      );

      return;
    }

    if (
      hooWorldStallTotal !==
        null &&
      productionHooCoin >
        hooWorldStallTotal
    ) {
      setHooWorldItemRequestActionMessage(
        "공동 모금액보다 큰 제작비는 배포할 수 없습니다.",
      );

      return;
    }

    if (
      !itemType ||
      itemType.length > 60
    ) {
      setHooWorldItemRequestActionMessage(
        "아이템 타입은 1~60자로 입력해 주세요.",
      );

      return;
    }

    if (
      !itemName ||
      itemName.length > 80
    ) {
      setHooWorldItemRequestActionMessage(
        "아이템 이름은 1~80자로 입력해 주세요.",
      );

      return;
    }

    if (
      itemImageUrl.length >
      2000
    ) {
      setHooWorldItemRequestActionMessage(
        "이미지 경로가 너무 깁니다.",
      );

      return;
    }

    if (
      !Number.isFinite(width) ||
      width < 36 ||
      width > 320 ||
      !Number.isFinite(height) ||
      height < 36 ||
      height > 320
    ) {
      setHooWorldItemRequestActionMessage(
        "아이템 크기는 가로/세로 각각 36~320으로 입력해 주세요.",
      );

      return;
    }

    setHooWorldItemRequestActionId(
      request.id,
    );

    setHooWorldItemRequestActionMessage(
      "",
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_distribute_hoo_world_item_request",
          {
            p_request_id:
              request.id,

            p_production_hoo_coin:
              productionHooCoin,

            p_item_type:
              itemType,

            p_item_name:
              itemName,

            p_item_image_url:
              itemImageUrl ||
              null,

            p_item_metadata: {
              display_width:
                Math.round(
                  width,
                ),

              display_height:
                Math.round(
                  height,
                ),

              collision_bottom_ratio:
                0.18,

              z_index:
                14,
            },
          },
        );

      if (error) {
        const errorMessage =
          error.message ?? "";

        if (
          errorMessage.includes(
            "AUTH_REQUIRED",
          )
        ) {
          setHooWorldItemRequestActionMessage(
            "로그인이 필요합니다.",
          );

          return;
        }

        if (
          errorMessage.includes(
            "ADMIN_REQUIRED",
          )
        ) {
          setHooWorldItemRequestActionMessage(
            "관리자 권한이 없습니다.",
          );

          return;
        }

        if (
          errorMessage.includes(
            "INSUFFICIENT_COMMUNITY_HOO_COIN",
          )
        ) {
          setHooWorldItemRequestActionMessage(
            "공동 모금함의 HOO COIN이 부족합니다.",
          );

          return;
        }

        if (
          errorMessage.includes(
            "REQUEST_NOT_FOUND",
          )
        ) {
          setHooWorldItemRequestActionMessage(
            "제작 요청을 찾을 수 없습니다.",
          );

          return;
        }

        if (
          errorMessage.includes(
            "INVALID_REQUEST_STATUS",
          ) ||
          errorMessage.includes(
            "REQUEST_ALREADY_HAS_DELIVERY",
          )
        ) {
          setHooWorldItemRequestActionMessage(
            "이미 배포되었거나 현재 배포할 수 없는 요청입니다.",
          );

          return;
        }

        console.error(
          "후월드 제작 및 배포 처리 실패:",
          error,
        );

        setHooWorldItemRequestActionMessage(
          "제작 및 배포 처리에 실패했습니다.",
        );

        return;
      }

      const result =
        data &&
        typeof data ===
          "object" &&
        !Array.isArray(data)
          ? (
              data as {
                request_id?: unknown;
                status?: unknown;
                remaining_community_hoo_coin?: unknown;
              }
            )
          : null;

      const resultRequestId =
        typeof result?.request_id ===
        "string"
          ? result.request_id
          : request.id;

      const nextStallTotal =
        Number(
          result?.remaining_community_hoo_coin,
        );

      setHooWorldItemRequests(
        (current) =>
          current.map(
            (currentRequest) =>
              currentRequest.id ===
              resultRequestId
                ? {
                    ...currentRequest,
                    status:
                      "delivered",
                    productionHooCoin:
                      productionHooCoin,
                  }
                : currentRequest,
          ),
      );

      if (
        Number.isFinite(
          nextStallTotal,
        )
      ) {
        setHooWorldStallTotal(
          Math.max(
            0,
            Math.floor(
              nextStallTotal,
            ),
          ),
        );
      }

      setHooWorldDistributionDraft(
        null,
      );

      setHooWorldItemRequestActionMessage(
        `배포 완료 · 공동 모금함에서 ${productionHooCoin.toLocaleString(
          "ko-KR",
        )} HOO를 사용했습니다.`,
      );
    } catch (error) {
      console.error(
        "후월드 제작 및 배포 처리 중 오류:",
        error,
      );

      setHooWorldItemRequestActionMessage(
        "제작 및 배포 처리 중 서버 오류가 발생했습니다.",
      );
    } finally {
      setHooWorldItemRequestActionId(
        null,
      );
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !title.trim() ||
      !content.trim()
    ) {
      setMessage(
        "제목과 내용을 입력해주세요.",
      );

      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/notices",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              title,
              content,
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.error ??
            "공지 등록에 실패했습니다.",
        );

        return;
      }

      setTitle("");
      setContent("");
      setMessage(
        "공지가 등록되었습니다.",
      );
    } catch {
      setMessage(
        "서버 연결에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!status) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 40,
          background: "#090909",
          color: "#ffffff",
        }}
      >
        관리자 확인 중...
      </main>
    );
  }

  if (!status.isLoggedIn) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 40,
          background: "#090909",
          color: "#ffffff",
        }}
      >
        로그인이 필요합니다.
      </main>
    );
  }

  if (!status.isAdmin) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 40,
          background: "#090909",
          color: "#ffffff",
        }}
      >
        관리자 권한이 없습니다.
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px",
        background: "#090909",
        color: "#ffffff",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 920,
        }}
      >
        <h1
          style={{
            marginBottom: 8,
          }}
        >
          관리자 페이지
        </h1>

        <p
          style={{
            marginBottom: 32,
            color: "#b5b5b5",
          }}
        >
          HOO 운영 현황과 공지사항을
          관리할 수 있습니다.
        </p>

        {/* 김미썸커피 */}
        <section
          style={{
            marginBottom: 32,
            padding: 24,
            border:
              "1px solid #2d2d2d",
            borderRadius: 18,
            background: "#121212",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  color: "#d5a66c",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing:
                    "0.12em",
                  marginBottom: 6,
                }}
              >
                GIMME SOME COFFEE
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                }}
              >
                ☕ 김미썸커피
              </h2>
            </div>

            <div
              style={{
                color: "#777777",
                fontSize: 12,
              }}
            >
              관리자 전용
            </div>
          </div>

          {coffeeLoading ? (
            <div
              style={{
                padding: "36px 0",
                textAlign: "center",
                color: "#777777",
              }}
            >
              커피 기록 불러오는 중...
            </div>
          ) : coffeeError ? (
            <div
              style={{
                padding: 16,
                border:
                  "1px solid #5b2929",
                borderRadius: 12,
                background:
                  "#241313",
                color: "#ffb3b3",
              }}
            >
              {coffeeError}
            </div>
          ) : coffeeData ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    padding: 20,
                    border:
                      "1px solid #2d2d2d",
                    borderRadius: 14,
                    background:
                      "#0b0b0b",
                  }}
                >
                  <div
                    style={{
                      marginBottom: 8,
                      color:
                        "#8b8b8b",
                      fontSize: 12,
                    }}
                  >
                    오늘 받은 커피
                  </div>

                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                    }}
                  >
                    {
                      coffeeData.stats
                        .today.count
                    }
                    잔
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      color:
                        "#e7bc82",
                      fontWeight: 700,
                    }}
                  >
                    {formatMoney(
                      coffeeData.stats
                        .today.amount,
                    )}
                  </div>
                </div>

                <div
                  style={{
                    padding: 20,
                    border:
                      "1px solid #2d2d2d",
                    borderRadius: 14,
                    background:
                      "#0b0b0b",
                  }}
                >
                  <div
                    style={{
                      marginBottom: 8,
                      color:
                        "#8b8b8b",
                      fontSize: 12,
                    }}
                  >
                    이번 달 받은 커피
                  </div>

                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                    }}
                  >
                    {
                      coffeeData.stats
                        .month.count
                    }
                    잔
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      color:
                        "#e7bc82",
                      fontWeight: 700,
                    }}
                  >
                    {formatMoney(
                      coffeeData.stats
                        .month.amount,
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 22,
                }}
              >
                <div
                  style={{
                    marginBottom: 12,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  최근 기록
                </div>

                {coffeeData.recent
                  .length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign:
                        "center",
                      border:
                        "1px solid #252525",
                      borderRadius: 12,
                      color:
                        "#707070",
                      background:
                        "#0b0b0b",
                    }}
                  >
                    아직 커피 기록이
                    없습니다.
                  </div>
                ) : (
                  <div
                    style={{
                      overflow:
                        "hidden",
                      border:
                        "1px solid #252525",
                      borderRadius: 12,
                      background:
                        "#0b0b0b",
                    }}
                  >
                    {coffeeData.recent.map(
                      (
                        record,
                        index,
                      ) => (
                        <div
                          key={
                            record.orderId
                          }
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "110px 1fr 100px 70px",
                            alignItems:
                              "center",
                            gap: 12,
                            padding:
                              "14px 16px",
                            borderBottom:
                              index ===
                              coffeeData
                                .recent
                                .length -
                                1
                                ? "none"
                                : "1px solid #202020",
                          }}
                        >
                          <span
                            style={{
                              color:
                                "#8a8a8a",
                              fontSize:
                                12,
                            }}
                          >
                            {formatApprovedAt(
                              record.approvedAt,
                            )}
                          </span>

                          <span
                            title={
                              record.orderId
                            }
                            style={{
                              minWidth: 0,
                              overflow:
                                "hidden",
                              textOverflow:
                                "ellipsis",
                              whiteSpace:
                                "nowrap",
                              color:
                                "#777777",
                              fontSize:
                                12,
                              fontFamily:
                                "monospace",
                            }}
                          >
                            {shortenOrderId(
                              record.orderId,
                            )}
                          </span>

                          <strong
                            style={{
                              textAlign:
                                "right",
                              color:
                                "#e7bc82",
                            }}
                          >
                            {formatMoney(
                              record.amount,
                            )}
                          </strong>

                          <span
                            style={{
                              textAlign:
                                "right",
                              color:
                                record.status ===
                                "DONE"
                                  ? "#83d7a2"
                                  : "#cccccc",
                              fontSize:
                                12,
                              fontWeight:
                                700,
                            }}
                          >
                            {record.status ===
                            "DONE"
                              ? "완료"
                              : record.status}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>

        {/* 후월드 제작 요청 실시간 감시 */}
        <section
          style={{
            marginBottom: 32,
            padding: 24,
            border:
              "1px solid #2d2d2d",
            borderRadius: 18,
            background: "#121212",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "flex-start",
              justifyContent:
                "space-between",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  color: "#8eb7f0",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing:
                    "0.12em",
                  marginBottom: 6,
                }}
              >
                HOO WORLD REQUESTS
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                }}
              >
                📦 후월드 제작 요청
              </h2>

              <p
                style={{
                  margin:
                    "8px 0 0",
                  color: "#8b8b8b",
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                가판대에서 들어온
                아이템 정보와 제시
                HOO COIN을 실시간으로
                확인합니다.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: 7,
                flexShrink: 0,
                color:
                  hooWorldItemRequestsRealtimeConnected
                    ? "#83d7a2"
                    : "#d7b56d",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius:
                    "999px",
                  background:
                    hooWorldItemRequestsRealtimeConnected
                      ? "#83d7a2"
                      : "#d7b56d",
                  boxShadow:
                    hooWorldItemRequestsRealtimeConnected
                      ? "0 0 10px rgba(131,215,162,.45)"
                      : "none",
                }}
              />

              {hooWorldItemRequestsRealtimeConnected
                ? "실시간 연결"
                : "연결 중"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap: 16,
              marginBottom: 12,
              padding:
                "13px 15px",
              border:
                "1px solid #3d3524",
              borderRadius: 12,
              background:
                "#17140d",
            }}
          >
            <div>
              <div
                style={{
                  marginBottom: 4,
                  color:
                    "#8d8066",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing:
                    "0.08em",
                }}
              >
                COMMUNITY FUND
              </div>

              <strong
                style={{
                  color:
                    "#f1d394",
                  fontSize: 13,
                }}
              >
                공동 모금함
              </strong>
            </div>

            <strong
              style={{
                color:
                  "#f0bd62",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              {hooWorldStallTotalLoading
                ? "불러오는 중..."
                : `${(
                    hooWorldStallTotal ??
                    0
                  ).toLocaleString(
                    "ko-KR",
                  )} HOO`}
            </strong>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3, minmax(0, 1fr))",
              gap: 10,
              marginBottom: 18,
            }}
          >
            {(
              [
                [
                  "신규",
                  hooWorldItemRequests.filter(
                    (request) =>
                      request.status ===
                      "requested",
                  ).length,
                  "#9fc6ff",
                ],
                [
                  "제작중",
                  hooWorldItemRequests.filter(
                    (request) =>
                      request.status ===
                      "making",
                  ).length,
                  "#e7bc82",
                ],
                [
                  "배포완료",
                  hooWorldItemRequests.filter(
                    (request) =>
                      request.status ===
                      "delivered",
                  ).length,
                  "#83d7a2",
                ],
              ] as const
            ).map(
              ([
                label,
                count,
                color,
              ]) => (
                <div
                  key={label}
                  style={{
                    padding:
                      "12px 14px",
                    border:
                      "1px solid #292929",
                    borderRadius: 12,
                    background:
                      "#0b0b0b",
                  }}
                >
                  <div
                    style={{
                      color:
                        "#777777",
                      fontSize: 11,
                      marginBottom: 5,
                    }}
                  >
                    {label}
                  </div>

                  <strong
                    style={{
                      color,
                      fontSize: 21,
                    }}
                  >
                    {count}
                  </strong>
                </div>
              ),
            )}
          </div>

          {hooWorldItemRequestActionMessage ? (
            <div
              style={{
                marginBottom: 14,
                padding:
                  "11px 13px",
                border:
                  "1px solid #344252",
                borderRadius: 11,
                background:
                  "#101820",
                color:
                  "#b8d2f2",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {
                hooWorldItemRequestActionMessage
              }
            </div>
          ) : null}

          {hooWorldItemRequestsLoading ? (
            <div
              style={{
                padding: "36px 0",
                textAlign: "center",
                color: "#777777",
              }}
            >
              제작 요청 불러오는 중...
            </div>
          ) : hooWorldItemRequestsError ? (
            <div
              style={{
                padding: 16,
                border:
                  "1px solid #5b2929",
                borderRadius: 12,
                background:
                  "#241313",
                color: "#ffb3b3",
              }}
            >
              {hooWorldItemRequestsError}
            </div>
          ) : hooWorldItemRequests.length ===
            0 ? (
            <div
              style={{
                padding: "34px 18px",
                textAlign: "center",
                border:
                  "1px solid #252525",
                borderRadius: 14,
                background:
                  "#0b0b0b",
                color: "#707070",
              }}
            >
              아직 들어온 제작 요청이
              없습니다.
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1fr) 150px 160px",
                  gap: 14,
                  padding:
                    "0 14px 8px",
                  color:
                    "#6f6f6f",
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                <span>
                  요청내용
                </span>

                <span
                  style={{
                    textAlign:
                      "right",
                  }}
                >
                  코인
                </span>

                <span
                  style={{
                    textAlign:
                      "center",
                  }}
                >
                  상태
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection:
                    "column",
                  gap: 8,
                }}
              >
                {hooWorldItemRequests.map(
                  (request) => (
                    <article
                      key={
                        request.id
                      }
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "minmax(0, 1fr) 150px 160px",
                        alignItems:
                          "center",
                        gap: 14,
                        minHeight: 64,
                        padding:
                          "11px 14px",
                        border:
                          request.status ===
                          "requested"
                            ? "1px solid #365477"
                            : "1px solid #292929",
                        borderRadius: 12,
                        background:
                          request.status ===
                          "requested"
                            ? "#0c131b"
                            : "#0b0b0b",
                      }}
                    >
                      <div
                        style={{
                          minWidth: 0,
                        }}
                      >
                        <strong
                          style={{
                            display:
                              "block",
                            color:
                              "#f0f0f0",
                            fontSize: 15,
                            fontWeight: 900,
                            lineHeight: 1.5,
                            whiteSpace:
                              "pre-wrap",
                            wordBreak:
                              "break-word",
                            overflowWrap:
                              "anywhere",
                          }}
                        >
                          {
                            request.requestText
                          }
                        </strong>

                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: 7,
                            marginTop: 5,
                            overflow:
                              "hidden",
                            color:
                              "#656565",
                            fontSize: 10,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          <span>
                            {
                              request.nickname
                            }
                          </span>

                          <span>
                            ·
                          </span>

                          <span>
                            {formatRequestCreatedAt(
                              request.createdAt,
                            )}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          textAlign:
                            "right",
                        }}
                      >
                        <div
                          style={{
                            color:
                              "#8d8066",
                            fontSize: 9,
                            fontWeight: 800,
                            marginBottom: 2,
                          }}
                        >
                          제시
                        </div>

                        <div>
                          <strong
                            style={{
                              color:
                                "#f0bd62",
                              fontSize: 18,
                              fontWeight: 900,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {request.offeredHooCoin.toLocaleString(
                              "ko-KR",
                            )}
                          </strong>

                          <span
                            style={{
                              marginLeft: 5,
                              color:
                                "#967749",
                              fontSize: 10,
                              fontWeight: 800,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            HOO
                          </span>
                        </div>

                        {typeof request.productionHooCoin ===
                        "number" ? (
                          <div
                            style={{
                              marginTop: 6,
                              paddingTop: 6,
                              borderTop:
                                "1px solid #29251d",
                            }}
                          >
                            <div
                              style={{
                                color:
                                  "#648b72",
                                fontSize: 9,
                                fontWeight: 800,
                                marginBottom: 2,
                              }}
                            >
                              실제
                            </div>

                            <strong
                              style={{
                                color:
                                  "#83d7a2",
                                fontSize: 15,
                                fontWeight: 900,
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {request.productionHooCoin.toLocaleString(
                                "ko-KR",
                              )}{" "}
                              HOO
                            </strong>
                          </div>
                        ) : null}
                      </div>

                      {request.status ===
                      "requested" ? (
                        <button
                          type="button"
                          onClick={() => {
                            void startHooWorldItemRequestMaking(
                              request.id,
                            );
                          }}
                          disabled={
                            hooWorldItemRequestActionId !==
                            null
                          }
                          style={{
                            minHeight: 38,
                            width:
                              "100%",
                            border:
                              "1px solid #49657f",
                            borderRadius: 10,
                            background:
                              hooWorldItemRequestActionId ===
                              request.id
                                ? "#26333f"
                                : "#18324a",
                            color:
                              "#dcecff",
                            fontSize: 12,
                            fontWeight: 900,
                            cursor:
                              hooWorldItemRequestActionId !==
                              null
                                ? "wait"
                                : "pointer",
                            opacity:
                              hooWorldItemRequestActionId !==
                                null &&
                              hooWorldItemRequestActionId !==
                                request.id
                                ? 0.48
                                : 1,
                          }}
                        >
                          {hooWorldItemRequestActionId ===
                          request.id
                            ? "처리 중..."
                            : "제작 시작"}
                        </button>
                      ) : request.status ===
                        "making" ? (
                        <button
                          type="button"
                          onClick={() => {
                            openHooWorldDistribution(
                              request,
                            );
                          }}
                          disabled={
                            hooWorldItemRequestActionId !==
                            null
                          }
                          style={{
                            minHeight: 38,
                            width:
                              "100%",
                            border:
                              "1px solid #715a37",
                            borderRadius: 10,
                            background:
                              hooWorldDistributionDraft?.requestId ===
                              request.id
                                ? "#3a2c18"
                                : "#241d12",
                            color:
                              "#f1cd91",
                            fontSize: 12,
                            fontWeight: 900,
                            cursor:
                              hooWorldItemRequestActionId !==
                              null
                                ? "wait"
                                : "pointer",
                          }}
                        >
                          제작 및 배포
                        </button>
                      ) : (
                        <div
                          style={{
                            display:
                              "flex",
                            minHeight: 38,
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            border:
                              "1px solid #2f2f2f",
                            borderRadius: 10,
                            background:
                              "#111111",
                            color:
                              getRequestStatusColor(
                                request.status,
                              ),
                            fontSize: 12,
                            fontWeight: 900,
                          }}
                        >
                          {getRequestStatusLabel(
                            request.status,
                          )}
                        </div>
                      )}
                    </article>
                  ),
                )}
              </div>

              {hooWorldDistributionDraft ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: 16,
                    border:
                      "1px solid #5a472c",
                    borderRadius: 13,
                    background:
                      "#17130d",
                  }}
                >
                  {(() => {
                    const selectedRequest =
                      hooWorldItemRequests.find(
                        (request) =>
                          request.id ===
                          hooWorldDistributionDraft.requestId,
                      );

                    if (!selectedRequest) {
                      return null;
                    }

                    const updateDraft = (
                      patch: Partial<HooWorldDistributionDraft>,
                    ) => {
                      setHooWorldDistributionDraft(
                        (current) =>
                          current
                            ? {
                                ...current,
                                ...patch,
                              }
                            : current,
                      );
                    };

                    return (
                      <>
                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "flex-start",
                            justifyContent:
                              "space-between",
                            gap: 14,
                            marginBottom: 14,
                          }}
                        >
                          <div>
                            <strong
                              style={{
                                display:
                                  "block",
                                marginBottom: 4,
                                color:
                                  "#f1cd91",
                                fontSize: 14,
                              }}
                            >
                              제작 및 배포
                            </strong>

                            <div
                              style={{
                                color:
                                  "#8d8066",
                                fontSize: 11,
                                lineHeight: 1.5,
                              }}
                            >
                              제시{" "}
                              {selectedRequest.offeredHooCoin.toLocaleString(
                                "ko-KR",
                              )}{" "}
                              HOO · 실제 차감액은 아래에서 결정
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setHooWorldDistributionDraft(
                                null,
                              )
                            }
                            disabled={
                              hooWorldItemRequestActionId !==
                              null
                            }
                            style={{
                              border:
                                "1px solid #3e372b",
                              borderRadius: 8,
                              padding:
                                "7px 10px",
                              background:
                                "#11100d",
                              color:
                                "#a69a85",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor:
                                "pointer",
                            }}
                          >
                            닫기
                          </button>
                        </div>

                        <div
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "repeat(2, minmax(0, 1fr))",
                            gap: 10,
                          }}
                        >
                          <label>
                            <div
                              style={{
                                marginBottom: 6,
                                color:
                                  "#8d8066",
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              실제 제작비
                            </div>

                            <input
                              value={
                                hooWorldDistributionDraft.productionHooCoin
                              }
                              onChange={(
                                event,
                              ) =>
                                updateDraft({
                                  productionHooCoin:
                                    event.target.value.replace(
                                      /[^\d]/g,
                                      "",
                                    ),
                                })
                              }
                              inputMode="numeric"
                              placeholder="0"
                              style={{
                                width:
                                  "100%",
                                padding:
                                  "10px 11px",
                                border:
                                  "1px solid #4b3d28",
                                borderRadius: 9,
                                background:
                                  "#0d0c09",
                                color:
                                  "#f0bd62",
                                outline:
                                  "none",
                                fontWeight: 900,
                              }}
                            />
                          </label>

                          <label>
                            <div
                              style={{
                                marginBottom: 6,
                                color:
                                  "#8d8066",
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              아이템 타입
                            </div>

                            <input
                              value={
                                hooWorldDistributionDraft.itemType
                              }
                              onChange={(
                                event,
                              ) =>
                                updateDraft({
                                  itemType:
                                    event.target.value,
                                })
                              }
                              maxLength={60}
                              placeholder="generic"
                              style={{
                                width:
                                  "100%",
                                padding:
                                  "10px 11px",
                                border:
                                  "1px solid #3e392f",
                                borderRadius: 9,
                                background:
                                  "#0d0c09",
                                color:
                                  "#e8e2d7",
                                outline:
                                  "none",
                              }}
                            />
                          </label>

                          <label
                            style={{
                              gridColumn:
                                "1 / -1",
                            }}
                          >
                            <div
                              style={{
                                marginBottom: 6,
                                color:
                                  "#8d8066",
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              아이템 이름
                            </div>

                            <input
                              value={
                                hooWorldDistributionDraft.itemName
                              }
                              onChange={(
                                event,
                              ) =>
                                updateDraft({
                                  itemName:
                                    event.target.value,
                                })
                              }
                              maxLength={80}
                              placeholder="배송 아이템 이름"
                              style={{
                                width:
                                  "100%",
                                padding:
                                  "10px 11px",
                                border:
                                  "1px solid #3e392f",
                                borderRadius: 9,
                                background:
                                  "#0d0c09",
                                color:
                                  "#ffffff",
                                outline:
                                  "none",
                              }}
                            />
                          </label>

                          <label
                            style={{
                              gridColumn:
                                "1 / -1",
                            }}
                          >
                            <div
                              style={{
                                marginBottom: 6,
                                color:
                                  "#8d8066",
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              이미지 경로 · 선택사항
                            </div>

                            <input
                              value={
                                hooWorldDistributionDraft.itemImageUrl
                              }
                              onChange={(
                                event,
                              ) =>
                                updateDraft({
                                  itemImageUrl:
                                    event.target.value,
                                })
                              }
                              maxLength={2000}
                              placeholder="/hoo-world/items/example.png"
                              style={{
                                width:
                                  "100%",
                                padding:
                                  "10px 11px",
                                border:
                                  "1px solid #3e392f",
                                borderRadius: 9,
                                background:
                                  "#0d0c09",
                                color:
                                  "#d8d8d8",
                                outline:
                                  "none",
                              }}
                            />
                          </label>

                          <label>
                            <div
                              style={{
                                marginBottom: 6,
                                color:
                                  "#8d8066",
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              가로 크기
                            </div>

                            <input
                              value={
                                hooWorldDistributionDraft.width
                              }
                              onChange={(
                                event,
                              ) =>
                                updateDraft({
                                  width:
                                    event.target.value.replace(
                                      /[^\d.]/g,
                                      "",
                                    ),
                                })
                              }
                              inputMode="decimal"
                              style={{
                                width:
                                  "100%",
                                padding:
                                  "10px 11px",
                                border:
                                  "1px solid #3e392f",
                                borderRadius: 9,
                                background:
                                  "#0d0c09",
                                color:
                                  "#e8e2d7",
                                outline:
                                  "none",
                              }}
                            />
                          </label>

                          <label>
                            <div
                              style={{
                                marginBottom: 6,
                                color:
                                  "#8d8066",
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              세로 크기
                            </div>

                            <input
                              value={
                                hooWorldDistributionDraft.height
                              }
                              onChange={(
                                event,
                              ) =>
                                updateDraft({
                                  height:
                                    event.target.value.replace(
                                      /[^\d.]/g,
                                      "",
                                    ),
                                })
                              }
                              inputMode="decimal"
                              style={{
                                width:
                                  "100%",
                                padding:
                                  "10px 11px",
                                border:
                                  "1px solid #3e392f",
                                borderRadius: 9,
                                background:
                                  "#0d0c09",
                                color:
                                  "#e8e2d7",
                                outline:
                                  "none",
                              }}
                            />
                          </label>
                        </div>

                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "space-between",
                            gap: 12,
                            marginTop: 14,
                          }}
                        >
                          <div
                            style={{
                              color:
                                "#8d8066",
                              fontSize: 11,
                              lineHeight: 1.5,
                            }}
                          >
                            현재 공동 모금함{" "}
                            <strong
                              style={{
                                color:
                                  "#f0bd62",
                              }}
                            >
                              {(
                                hooWorldStallTotal ??
                                0
                              ).toLocaleString(
                                "ko-KR",
                              )}{" "}
                              HOO
                            </strong>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              void distributeHooWorldItemRequest();
                            }}
                            disabled={
                              hooWorldItemRequestActionId !==
                              null
                            }
                            style={{
                              minWidth: 150,
                              minHeight: 40,
                              border:
                                "1px solid #8a6636",
                              borderRadius: 10,
                              background:
                                hooWorldItemRequestActionId ===
                                selectedRequest.id
                                  ? "#3b3020"
                                  : "#5b3d16",
                              color:
                                "#ffe3ae",
                              fontSize: 12,
                              fontWeight: 900,
                              cursor:
                                hooWorldItemRequestActionId !==
                                null
                                  ? "wait"
                                  : "pointer",
                            }}
                          >
                            {hooWorldItemRequestActionId ===
                            selectedRequest.id
                              ? "배포 중..."
                              : "배포 확정"}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* 기존 공지사항 */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 24,
            border:
              "1px solid #2d2d2d",
            borderRadius: 16,
            background: "#121212",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 20,
            }}
          >
            공지사항 작성
          </h2>

          <label>
            <div
              style={{
                marginBottom: 8,
              }}
            >
              제목
            </div>

            <input
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value,
                )
              }
              maxLength={100}
              placeholder="공지 제목을 입력하세요."
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 10,
                border:
                  "1px solid #3a3a3a",
                background:
                  "#0b0b0b",
                color: "#ffffff",
                outline: "none",
              }}
            />
          </label>

          <label>
            <div
              style={{
                marginBottom: 8,
              }}
            >
              내용
            </div>

            <textarea
              value={content}
              onChange={(event) =>
                setContent(
                  event.target.value,
                )
              }
              maxLength={5000}
              rows={10}
              placeholder="공지 내용을 입력하세요."
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 10,
                border:
                  "1px solid #3a3a3a",
                background:
                  "#0b0b0b",
                color: "#ffffff",
                resize:
                  "vertical",
                outline: "none",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={
              submitting ||
              !status.canManage
            }
            style={{
              padding: 14,
              border: 0,
              borderRadius: 10,
              cursor:
                submitting ||
                !status.canManage
                  ? "not-allowed"
                  : "pointer",
              background:
                "#ffffff",
              color: "#000000",
              fontWeight: 700,
              opacity:
                submitting ||
                !status.canManage
                  ? 0.5
                  : 1,
            }}
          >
            {submitting
              ? "등록 중..."
              : "공지 등록"}
          </button>

          {message && (
            <p
              style={{
                margin: 0,
                color:
                  "#d7d7d7",
              }}
            >
              {message}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
import {
  createHash,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CoffeePaymentRow = {
  order_id: string;
  payment_key_hash: string;
  amount: number;
  currency: string;
  status: string;
  balance_amount: number;
  canceled_amount: number;
};

type TossWebhookBody = {
  eventType?: unknown;
  createdAt?: unknown;
  data?: unknown;
};

type TossPayment = {
  paymentKey?: unknown;
  orderId?: unknown;
  currency?: unknown;
  status?: unknown;
  totalAmount?: unknown;
  balanceAmount?: unknown;
};

const SYNCABLE_STATUSES =
  new Set([
    "DONE",
    "PARTIAL_CANCELED",
    "CANCELED",
  ]);

function hashPaymentKey(
  paymentKey: string,
) {
  return createHash(
    "sha256",
  )
    .update(
      paymentKey,
      "utf8",
    )
    .digest("hex");
}

function okResponse(
  body: Record<
    string,
    unknown
  >,
) {
  const response =
    NextResponse.json({
      ok: true,
      ...body,
    });

  response.headers.set(
    "Cache-Control",
    "no-store",
  );

  return response;
}

export async function POST(
  request: NextRequest,
) {
  const tossSecretKey =
    process.env
      .TOSS_SECRET_KEY;

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !tossSecretKey ||
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    console.error(
      "[Coffee Webhook] missing server secrets",
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "웹훅 서버 설정이 완료되지 않았습니다.",
      },
      {
        status: 500,
      },
    );
  }

  /*
   * =========================================================
   * 1. 웹훅 본문 읽기
   * =========================================================
   */

  let body: TossWebhookBody;

  try {
    body =
      (await request.json()) as
        TossWebhookBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "잘못된 웹훅 요청입니다.",
      },
      {
        status: 400,
      },
    );
  }

  /*
   * 우리가 사용하는 이벤트가 아니면
   * 재전송이 일어나지 않도록 200으로 종료한다.
   */
  if (
    body.eventType !==
    "PAYMENT_STATUS_CHANGED"
  ) {
    return okResponse({
      ignored: true,
      reason:
        "unsupported_event",
    });
  }

  if (
    !body.data ||
    typeof body.data !==
      "object"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "결제 상태 정보가 없습니다.",
      },
      {
        status: 400,
      },
    );
  }

  const webhookPayment =
    body.data as Record<
      string,
      unknown
    >;

  const orderId =
    typeof webhookPayment
      .orderId === "string"
      ? webhookPayment.orderId
      : "";

  if (
    !/^[A-Za-z0-9_-]{6,64}$/.test(
      orderId,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "웹훅 주문번호가 올바르지 않습니다.",
      },
      {
        status: 400,
      },
    );
  }

  /*
   * =========================================================
   * 2. Service Role DB 연결
   * =========================================================
   */

  const supabase =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken:
            false,
          persistSession:
            false,
        },
      },
    );

  /*
   * =========================================================
   * 3. HOO에서 관리하는 결제인지 확인
   * =========================================================
   */

  const {
    data: storedPaymentData,
    error: storedPaymentError,
  } = await supabase
    .from(
      "hoo_coffee_payments",
    )
    .select(
      `
        order_id,
        payment_key_hash,
        amount,
        currency,
        status,
        balance_amount,
        canceled_amount
      `,
    )
    .eq(
      "order_id",
      orderId,
    )
    .maybeSingle();

  if (storedPaymentError) {
    console.error(
      "[Coffee Webhook] DB lookup failed",
      storedPaymentError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "결제 기록 확인에 실패했습니다.",
      },
      {
        status: 500,
      },
    );
  }

  /*
   * 다른 서비스의 결제이거나
   * HOO에 없는 주문이라면 무시.
   */
  if (!storedPaymentData) {
    return okResponse({
      ignored: true,
      reason:
        "unknown_order",
    });
  }

  const storedPayment =
    storedPaymentData as
      CoffeePaymentRow;

  /*
   * =========================================================
   * 4. 토스 서버에 직접 결제 재조회
   * =========================================================
   *
   * 웹훅 body 자체를 신뢰하지 않는다.
   * orderId만 단서로 사용한다.
   */

  const authorization =
    Buffer.from(
      `${tossSecretKey}:`,
      "utf8",
    ).toString(
      "base64",
    );

  let tossResponse: Response;

  try {
    tossResponse =
      await fetch(
        `https://api.tosspayments.com/v1/payments/orders/${encodeURIComponent(
          orderId,
        )}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Basic ${authorization}`,
          },

          cache:
            "no-store",
        },
      );
  } catch (error) {
    console.error(
      "[Coffee Webhook] Toss lookup network error",
      error,
    );

    /*
     * 200이 아니면 토스가 웹훅을 재전송하므로
     * 일시적 네트워크 오류에서는 실패 응답을 준다.
     */
    return NextResponse.json(
      {
        ok: false,
        message:
          "토스 결제 조회에 실패했습니다.",
      },
      {
        status: 502,
      },
    );
  }

  const tossResult =
    (await tossResponse.json()) as
      TossPayment &
      Record<
        string,
        unknown
      >;

  if (!tossResponse.ok) {
    console.error(
      "[Coffee Webhook] Toss lookup failed",
      tossResult,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "토스 결제 정보를 확인하지 못했습니다.",
      },
      {
        status:
          tossResponse.status >=
          500
            ? 502
            : 400,
      },
    );
  }

  /*
   * =========================================================
   * 5. 토스 결제 정보 검증
   * =========================================================
   */

  const confirmedOrderId =
    typeof tossResult.orderId ===
    "string"
      ? tossResult.orderId
      : "";

  const paymentKey =
    typeof tossResult.paymentKey ===
    "string"
      ? tossResult.paymentKey
      : "";

  const currency =
    typeof tossResult.currency ===
    "string"
      ? tossResult.currency
      : "";

  const status =
    typeof tossResult.status ===
    "string"
      ? tossResult.status
      : "";

  const totalAmount =
    Number(
      tossResult.totalAmount,
    );

  const balanceAmount =
    Number(
      tossResult.balanceAmount,
    );

  if (
    confirmedOrderId !==
      storedPayment.order_id ||
    !paymentKey ||
    hashPaymentKey(
      paymentKey,
    ) !==
      storedPayment
        .payment_key_hash ||
    currency !==
      storedPayment.currency ||
    totalAmount !==
      Number(
        storedPayment.amount,
      )
  ) {
    console.error(
      "[Coffee Webhook] payment verification mismatch",
      {
        orderId,
        confirmedOrderId,
        currency,
        totalAmount,
      },
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "토스 결제 검증에 실패했습니다.",
      },
      {
        status: 409,
      },
    );
  }

  /*
   * READY / IN_PROGRESS / EXPIRED 등은
   * 커피 정산 DB 상태로 저장하지 않는다.
   */
  if (
    !SYNCABLE_STATUSES.has(
      status,
    )
  ) {
    return okResponse({
      ignored: true,
      reason:
        "non_settlement_status",
      status,
    });
  }

  if (
    !Number.isInteger(
      balanceAmount,
    ) ||
    balanceAmount < 0 ||
    balanceAmount >
      totalAmount
  ) {
    console.error(
      "[Coffee Webhook] invalid balance amount",
      {
        orderId,
        totalAmount,
        balanceAmount,
      },
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "토스 잔액 정보가 올바르지 않습니다.",
      },
      {
        status: 502,
      },
    );
  }

  const canceledAmount =
    totalAmount -
    balanceAmount;

  /*
   * 상태와 잔액의 논리적 일치도 확인한다.
   */
  if (
    (
      status === "DONE" &&
      balanceAmount !==
        totalAmount
    ) ||
    (
      status ===
        "CANCELED" &&
      balanceAmount !== 0
    ) ||
    (
      status ===
        "PARTIAL_CANCELED" &&
      (
        balanceAmount <= 0 ||
        balanceAmount >=
          totalAmount
      )
    )
  ) {
    console.error(
      "[Coffee Webhook] invalid status balance combination",
      {
        orderId,
        status,
        totalAmount,
        balanceAmount,
      },
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "결제 상태와 잔액이 일치하지 않습니다.",
      },
      {
        status: 502,
      },
    );
  }

  /*
   * =========================================================
   * 6. DB 상태 동기화
   * =========================================================
   */

  const updatedAt =
    new Date()
      .toISOString();

  const {
    error: updateError,
  } = await supabase
    .from(
      "hoo_coffee_payments",
    )
    .update({
      status,

      balance_amount:
        balanceAmount,

      canceled_amount:
        canceledAmount,

      updated_at:
        updatedAt,
    })
    .eq(
      "order_id",
      storedPayment.order_id,
    )
    .eq(
      "payment_key_hash",
      storedPayment
        .payment_key_hash,
    );

  if (updateError) {
    console.error(
      "[Coffee Webhook] payment update failed",
      updateError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "결제 상태 저장에 실패했습니다.",
      },
      {
        status: 500,
      },
    );
  }

  return okResponse({
    synced: true,

    orderId:
      storedPayment.order_id,

    status,

    amount:
      totalAmount,

    balanceAmount,

    canceledAmount,
  });
}
import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

const COOKIE_NAME =
  "hoo_coffee_order";

const ORDER_TTL_MS =
  10 * 60 * 1000;

const COFFEE_AMOUNTS =
  new Set([
    2000,
    5000,
    10000,
  ]);

type SignedOrder = {
  orderId: string;
  amount: number;
  issuedAt: number;
  idempotencyKey: string;
  signature: string;
};

type CoffeePaymentRow = {
  order_id: string;
  payment_key_hash: string;
  amount: number;
  currency: string;
  status: string;
  approved_at: string;
};

function signatureSource(
  order: Omit<
    SignedOrder,
    "signature"
  >,
) {
  return [
    order.orderId,
    order.amount,
    order.issuedAt,
    order.idempotencyKey,
  ].join(":");
}

function expectedSignature(
  order: Omit<
    SignedOrder,
    "signature"
  >,
  secret: string,
) {
  return createHmac(
    "sha256",
    secret,
  )
    .update(
      signatureSource(order),
    )
    .digest("hex");
}

function isValidSignature(
  order: SignedOrder,
  secret: string,
) {
  const expected =
    expectedSignature(
      {
        orderId:
          order.orderId,
        amount:
          order.amount,
        issuedAt:
          order.issuedAt,
        idempotencyKey:
          order.idempotencyKey,
      },
      secret,
    );

  if (
    order.signature.length !==
    expected.length
  ) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(
        order.signature,
        "hex",
      ),
      Buffer.from(
        expected,
        "hex",
      ),
    );
  } catch {
    return false;
  }
}

function readSignedOrder(
  request: NextRequest,
): SignedOrder | null {
  const token =
    request.cookies.get(
      COOKIE_NAME,
    )?.value;

  if (!token) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(
        Buffer.from(
          token,
          "base64url",
        ).toString("utf8"),
      ) as SignedOrder;

    if (
      typeof parsed.orderId !==
        "string" ||
      typeof parsed.amount !==
        "number" ||
      typeof parsed.issuedAt !==
        "number" ||
      typeof parsed.idempotencyKey !==
        "string" ||
      typeof parsed.signature !==
        "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

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

function clearOrderCookie(
  response: NextResponse,
) {
  response.headers.set(
    "Cache-Control",
    "no-store",
  );

  response.cookies.set(
    COOKIE_NAME,
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  );

  return response;
}

function successResponse(
  payment: {
    orderId: string;
    amount: number;
    status: string;
    approvedAt: string | null;
    method?: string | null;
    alreadyConfirmed?: boolean;
  },
) {
  return clearOrderCookie(
    NextResponse.json({
      ok: true,
      orderId:
        payment.orderId,
      amount:
        payment.amount,
      status:
        payment.status,
      method:
        payment.method ?? null,
      approvedAt:
        payment.approvedAt,
      alreadyConfirmed:
        payment.alreadyConfirmed ??
        false,
    }),
  );
}

export async function POST(
  request: NextRequest,
) {
  const signingSecret =
    process.env
      .COFFEE_ORDER_SIGNING_SECRET;

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
    !signingSecret ||
    !tossSecretKey ||
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    console.error(
      "[GimmeSomeCoffee] missing server secrets",
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "결제 서버 설정이 완료되지 않았습니다.",
      },
      {
        status: 500,
      },
    );
  }

  let body: {
    paymentKey?: unknown;
    orderId?: unknown;
    amount?: unknown;
  };

  try {
    body =
      (await request.json()) as
        typeof body;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "잘못된 결제 승인 요청입니다.",
      },
      {
        status: 400,
      },
    );
  }

  const paymentKey =
    typeof body.paymentKey ===
    "string"
      ? body.paymentKey
      : "";

  const orderId =
    typeof body.orderId ===
    "string"
      ? body.orderId
      : "";

  const amount =
    Number(body.amount);

  if (
    !paymentKey ||
    paymentKey.length > 200 ||
    !/^[A-Za-z0-9_-]{6,64}$/.test(
      orderId,
    ) ||
    !Number.isInteger(amount) ||
    !COFFEE_AMOUNTS.has(amount)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "결제 승인 정보가 올바르지 않습니다.",
      },
      {
        status: 400,
      },
    );
  }

  const paymentKeyHash =
    hashPaymentKey(
      paymentKey,
    );

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

  const {
    data: existingPaymentData,
    error: existingPaymentError,
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
        approved_at
      `,
    )
    .eq(
      "order_id",
      orderId,
    )
    .maybeSingle();

  if (existingPaymentError) {
    console.error(
      "[GimmeSomeCoffee] existing payment lookup failed",
      existingPaymentError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "결제 기록을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
      },
      {
        status: 500,
      },
    );
  }

  const existingPayment =
    existingPaymentData as
      CoffeePaymentRow | null;

  if (existingPayment) {
    const samePayment =
      existingPayment
        .payment_key_hash ===
        paymentKeyHash &&
      Number(
        existingPayment.amount,
      ) === amount;

    if (!samePayment) {
      console.error(
        "[GimmeSomeCoffee] duplicate order mismatch",
        {
          orderId,
          expectedAmount:
            existingPayment.amount,
          requestedAmount:
            amount,
        },
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "이미 처리된 주문번호와 결제 정보가 일치하지 않습니다.",
        },
        {
          status: 409,
        },
      );
    }

    if (
      existingPayment.status ===
      "DONE"
    ) {
      return successResponse({
        orderId:
          existingPayment.order_id,
        amount:
          Number(
            existingPayment.amount,
          ),
        status:
          existingPayment.status,
        approvedAt:
          existingPayment
            .approved_at,
        alreadyConfirmed:
          true,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "이미 처리된 주문입니다.",
      },
      {
        status: 409,
      },
    );
  }

  const {
    data: existingPaymentKey,
    error:
      existingPaymentKeyError,
  } = await supabase
    .from(
      "hoo_coffee_payments",
    )
    .select(
      `
        order_id,
        amount,
        status
      `,
    )
    .eq(
      "payment_key_hash",
      paymentKeyHash,
    )
    .maybeSingle();

  if (existingPaymentKeyError) {
    console.error(
      "[GimmeSomeCoffee] payment key lookup failed",
      existingPaymentKeyError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "결제 기록을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
      },
      {
        status: 500,
      },
    );
  }

  if (existingPaymentKey) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "이미 사용된 결제 정보입니다.",
      },
      {
        status: 409,
      },
    );
  }

  const signedOrder =
    readSignedOrder(request);

  if (!signedOrder) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "후원 주문 정보를 찾을 수 없습니다. 다시 시도해주세요.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !isValidSignature(
      signedOrder,
      signingSecret,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "후원 주문 검증에 실패했습니다.",
      },
      {
        status: 400,
      },
    );
  }

  const now = Date.now();

  if (
    signedOrder.issuedAt >
      now + 60_000 ||
    now -
      signedOrder.issuedAt >
      ORDER_TTL_MS
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "후원 주문 시간이 만료되었습니다. 다시 시도해주세요.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    signedOrder.orderId !==
      orderId ||
    signedOrder.amount !==
      amount
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "결제 금액 또는 주문번호가 변경되어 승인을 중단했습니다.",
      },
      {
        status: 400,
      },
    );
  }

  const authorization =
    Buffer.from(
      `${tossSecretKey}:`,
      "utf8",
    ).toString("base64");

  let tossResponse: Response;

  try {
    tossResponse = await fetch(
      "https://api.tosspayments.com/v1/payments/confirm",
      {
        method: "POST",
        headers: {
          Authorization:
            `Basic ${authorization}`,
          "Content-Type":
            "application/json",
          "Idempotency-Key":
            signedOrder
              .idempotencyKey,
        },
        body: JSON.stringify({
          paymentKey,
          orderId:
            signedOrder.orderId,
          amount:
            signedOrder.amount,
        }),
        cache: "no-store",
      },
    );
  } catch (error) {
    console.error(
      "[GimmeSomeCoffee] Toss confirm network error",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "결제사와 통신하지 못했습니다. 결제내역을 확인한 뒤 다시 시도해주세요.",
      },
      {
        status: 502,
      },
    );
  }

  const result =
    (await tossResponse.json()) as
      Record<string, unknown>;

  if (!tossResponse.ok) {
    const code =
      typeof result.code ===
      "string"
        ? result.code
        : "TOSS_CONFIRM_FAILED";

    const message =
      typeof result.message ===
      "string"
        ? result.message
        : "결제 승인에 실패했습니다.";

    return NextResponse.json(
      {
        ok: false,
        code,
        message,
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

  const confirmedOrderId =
    typeof result.orderId ===
    "string"
      ? result.orderId
      : "";

  const confirmedPaymentKey =
    typeof result.paymentKey ===
    "string"
      ? result.paymentKey
      : "";

  const totalAmount =
    Number(
      result.totalAmount,
    );

  const currency =
    typeof result.currency ===
    "string"
      ? result.currency
      : "KRW";

  const status =
    typeof result.status ===
    "string"
      ? result.status
      : "";

  const method =
    typeof result.method ===
    "string"
      ? result.method
      : null;

  const approvedAt =
    typeof result.approvedAt ===
      "string" &&
    result.approvedAt
      ? result.approvedAt
      : new Date()
          .toISOString();

  if (
    confirmedOrderId !==
      signedOrder.orderId ||
    (
      confirmedPaymentKey &&
      confirmedPaymentKey !==
        paymentKey
    ) ||
    totalAmount !==
      signedOrder.amount ||
    currency !== "KRW"
  ) {
    console.error(
      "[GimmeSomeCoffee] confirmed payment mismatch",
      {
        expectedOrderId:
          signedOrder.orderId,
        confirmedOrderId,
        expectedAmount:
          signedOrder.amount,
        totalAmount,
        currency,
      },
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "결제 승인 결과 검증에 실패했습니다.",
      },
      {
        status: 502,
      },
    );
  }

  if (status !== "DONE") {
    console.error(
      "[GimmeSomeCoffee] unexpected confirmed status",
      {
        orderId:
          signedOrder.orderId,
        status,
      },
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "결제가 완료 상태가 아닙니다.",
      },
      {
        status: 502,
      },
    );
  }

  const nowIso =
  new Date().toISOString();

const {
  data: insertedPaymentData,
  error: insertError,
} = await supabase
  .from(
    "hoo_coffee_payments",
  )
  .insert({
    order_id:
      signedOrder.orderId,
    payment_key_hash:
      paymentKeyHash,

    amount:
      signedOrder.amount,

    balance_amount:
      signedOrder.amount,

    canceled_amount:
      0,

    currency:
      "KRW",

    status:
      "DONE",

    approved_at:
      approvedAt,

    updated_at:
      nowIso,
  })
  .select(
    `
      order_id,
      payment_key_hash,
      amount,
      currency,
      status,
      approved_at
    `,
  )
  .single();

  

  if (insertError) {
    if (
      insertError.code ===
      "23505"
    ) {
      const {
        data:
          concurrentPaymentData,
        error:
          concurrentLookupError,
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
            approved_at
          `,
        )
        .eq(
          "order_id",
          signedOrder.orderId,
        )
        .maybeSingle();

      const concurrentPayment =
        concurrentPaymentData as
          CoffeePaymentRow | null;

      if (
        !concurrentLookupError &&
        concurrentPayment &&
        concurrentPayment
          .payment_key_hash ===
          paymentKeyHash &&
        Number(
          concurrentPayment.amount,
        ) ===
          signedOrder.amount &&
        concurrentPayment.status ===
          "DONE"
      ) {
        return successResponse({
          orderId:
            concurrentPayment
              .order_id,
          amount:
            Number(
              concurrentPayment
                .amount,
            ),
          status:
            concurrentPayment
              .status,
          approvedAt:
            concurrentPayment
              .approved_at,
          alreadyConfirmed:
            true,
        });
      }
    }

    console.error(
      "[GimmeSomeCoffee] payment record insert failed",
      insertError,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "결제는 승인되었지만 기록 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
      },
      {
        status: 500,
      },
    );
  }

  const insertedPayment =
    insertedPaymentData as
      CoffeePaymentRow;

  return successResponse({
    orderId:
      insertedPayment.order_id,
    amount:
      Number(
        insertedPayment.amount,
      ),
    status:
      insertedPayment.status,
    approvedAt:
      insertedPayment
        .approved_at,
    method,
    alreadyConfirmed:
      false,
  });
}

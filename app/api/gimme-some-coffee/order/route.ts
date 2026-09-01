import {
  createHmac,
  randomUUID,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

const ALLOWED_AMOUNTS =
  new Set([
    2000,
    5000,
    10000,
  ]);

const COOKIE_NAME =
  "hoo_coffee_order";

const COOKIE_TTL_SECONDS =
  10 * 60;

type SignedOrderPayload = {
  orderId: string;
  amount: number;
  issuedAt: number;
  idempotencyKey: string;
};

function signOrder(
  payload: SignedOrderPayload,
  secret: string,
) {
  return createHmac(
    "sha256",
    secret,
  )
    .update(
      [
        payload.orderId,
        payload.amount,
        payload.issuedAt,
        payload.idempotencyKey,
      ].join(":"),
    )
    .digest("hex");
}

export async function POST(
  request: Request,
) {
  const signingSecret =
    process.env
      .COFFEE_ORDER_SIGNING_SECRET;

  if (!signingSecret) {
    console.error(
      "[GimmeSomeCoffee] missing COFFEE_ORDER_SIGNING_SECRET",
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "잘못된 요청입니다.",
      },
      {
        status: 400,
      },
    );
  }

  const amount =
    Number(
      (
        body as {
          amount?: unknown;
        }
      )?.amount,
    );

  if (
    !Number.isInteger(amount) ||
    !ALLOWED_AMOUNTS.has(
      amount,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "허용되지 않은 후원 금액입니다.",
      },
      {
        status: 400,
      },
    );
  }

  const orderId =
    `coffee-${randomUUID()
      .replaceAll("-", "")
      .slice(0, 28)}`;

  const payload: SignedOrderPayload =
    {
      orderId,
      amount,
      issuedAt: Date.now(),
      idempotencyKey:
        randomUUID(),
    };

  const signature =
    signOrder(
      payload,
      signingSecret,
    );

  const token =
    Buffer.from(
      JSON.stringify({
        ...payload,
        signature,
      }),
      "utf8",
    ).toString("base64url");

  const response =
    NextResponse.json({
      ok: true,
      orderId,
      amount,
    });

  response.headers.set(
    "Cache-Control",
    "no-store",
  );

  response.cookies.set(
    COOKIE_NAME,
    token,
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge:
        COOKIE_TTL_SECONDS,
    },
  );

  return response;
}

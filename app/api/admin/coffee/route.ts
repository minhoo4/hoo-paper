import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient,
} from "@supabase/supabase-js";

const KST_OFFSET_MS =
  9 * 60 * 60 * 1000;

type AdminStatus = {
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  canManage?: boolean;
};

type CoffeePaymentRow = {
  order_id: string;
  amount: number | string;
  currency: string;
  status: string;
  approved_at: string | null;
};

function getKstBoundaries() {
  const nowKst =
    new Date(
      Date.now() + KST_OFFSET_MS,
    );

  const year =
    nowKst.getUTCFullYear();
  const month =
    nowKst.getUTCMonth();
  const day =
    nowKst.getUTCDate();

  const todayStart =
    new Date(
      Date.UTC(
        year,
        month,
        day,
      ) - KST_OFFSET_MS,
    );

  const tomorrowStart =
    new Date(
      todayStart.getTime() +
        24 * 60 * 60 * 1000,
    );

  const monthStart =
    new Date(
      Date.UTC(
        year,
        month,
        1,
      ) - KST_OFFSET_MS,
    );

  const nextMonthStart =
    new Date(
      Date.UTC(
        year,
        month + 1,
        1,
      ) - KST_OFFSET_MS,
    );

  return {
    todayStart,
    tomorrowStart,
    monthStart,
    nextMonthStart,
  };
}

function sumAmounts(
  rows: Array<{
    amount: number | string;
  }>,
) {
  return rows.reduce(
    (sum, row) => {
      const amount = Number(row.amount);

      return (
        sum +
        (
          Number.isFinite(amount)
            ? amount
            : 0
        )
      );
    },
    0,
  );
}

async function verifyAdmin(
  request: NextRequest,
) {
  const meUrl =
    new URL(
      "/api/admin/me",
      request.url,
    );

  const cookie =
    request.headers.get("cookie") ??
    "";

  const response =
    await fetch(meUrl, {
      cache: "no-store",
      headers: {
        cookie,
      },
    });

  if (!response.ok) {
    return null;
  }

  const contentType =
    response.headers.get(
      "content-type",
    ) ?? "";

  if (
    !contentType.includes(
      "application/json",
    )
  ) {
    return null;
  }

  return (
    await response.json()
  ) as AdminStatus;
}

export async function GET(
  request: NextRequest,
) {
  try {
    const adminStatus =
      await verifyAdmin(request);

    if (
      !adminStatus?.isLoggedIn
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "로그인이 필요합니다.",
        },
        {
          status: 401,
        },
      );
    }

    if (
      !adminStatus.isAdmin ||
      adminStatus.canManage === false
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "관리자 권한이 없습니다.",
        },
        {
          status: 403,
        },
      );
    }

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Supabase 관리자 환경변수가 설정되지 않았습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );

    const {
      todayStart,
      tomorrowStart,
      monthStart,
      nextMonthStart,
    } = getKstBoundaries();

    const [
      todayResult,
      monthResult,
      recentResult,
    ] = await Promise.all([
      supabase
        .from("hoo_coffee_payments")
        .select("amount")
        .eq("status", "DONE")
        .gte(
          "approved_at",
          todayStart.toISOString(),
        )
        .lt(
          "approved_at",
          tomorrowStart.toISOString(),
        ),

      supabase
        .from("hoo_coffee_payments")
        .select("amount")
        .eq("status", "DONE")
        .gte(
          "approved_at",
          monthStart.toISOString(),
        )
        .lt(
          "approved_at",
          nextMonthStart.toISOString(),
        ),

      supabase
        .from("hoo_coffee_payments")
        .select(
          `
            order_id,
            amount,
            currency,
            status,
            approved_at
          `,
        )
        .order("approved_at", {
          ascending: false,
        })
        .limit(20),
    ]);

    const firstError =
      todayResult.error ??
      monthResult.error ??
      recentResult.error;

    if (firstError) {
      console.error(
        "GET /api/admin/coffee",
        firstError,
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "커피 기록을 불러오지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const todayRows =
      todayResult.data ?? [];
    const monthRows =
      monthResult.data ?? [];
    const recentRows =
      (recentResult.data ?? []) as
        CoffeePaymentRow[];

    return NextResponse.json({
      ok: true,
      stats: {
        today: {
          count: todayRows.length,
          amount:
            sumAmounts(todayRows),
        },
        month: {
          count: monthRows.length,
          amount:
            sumAmounts(monthRows),
        },
      },
      recent: recentRows.map(
        (row) => ({
          orderId: row.order_id,
          amount:
            Number(row.amount) || 0,
          currency:
            row.currency || "KRW",
          status: row.status,
          approvedAt:
            row.approved_at ?? "",
        }),
      ),
    });
  } catch (error) {
    console.error(
      "GET /api/admin/coffee unexpected error",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "커피 기록 API 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}

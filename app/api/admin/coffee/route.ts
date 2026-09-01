import { NextResponse } from "next/server";

import {
  createClient as createServerClient,
} from "@/lib/supabase/server";

import {
  createClient as createServiceClient,
} from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KST_OFFSET_MS =
  9 * 60 * 60 * 1000;

type CoffeePaymentRow = {
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  approved_at: string;
};

function getKstBoundaries() {
  const now = Date.now();

  const kstNow =
    new Date(
      now + KST_OFFSET_MS,
    );

  const year =
    kstNow.getUTCFullYear();

  const month =
    kstNow.getUTCMonth();

  const day =
    kstNow.getUTCDate();

  const todayStartUtc =
    Date.UTC(
      year,
      month,
      day,
      0,
      0,
      0,
    ) - KST_OFFSET_MS;

  const monthStartUtc =
    Date.UTC(
      year,
      month,
      1,
      0,
      0,
      0,
    ) - KST_OFFSET_MS;

  return {
    todayStartIso:
      new Date(
        todayStartUtc,
      ).toISOString(),

    monthStartIso:
      new Date(
        monthStartUtc,
      ).toISOString(),
  };
}

export async function GET() {
  try {
    /*
     * ========================================
     * 1. 로그인 + 관리자 권한 확인
     * ========================================
     */

    const userSupabase =
      await createServerClient();

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await userSupabase.auth.getUser();

    if (
      userError ||
      !user
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

    const {
      data: isAdmin,
      error: adminError,
    } =
      await userSupabase.rpc(
        "is_admin",
      );

    if (adminError) {
      console.error(
        "[Admin Coffee] 관리자 권한 확인 실패:",
        adminError,
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "관리자 권한을 확인하지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    if (isAdmin !== true) {
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

    /*
     * ========================================
     * 2. Service Role 준비
     * ========================================
     *
     * hoo_coffee_payments는
     * anon/authenticated 직접 접근을 막았기 때문에
     * 관리자 인증이 끝난 서버에서만 읽는다.
     */

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
      console.error(
        "[Admin Coffee] Supabase server env missing",
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "관리자 서버 설정이 완료되지 않았습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const adminSupabase =
      createServiceClient(
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
     * ========================================
     * 3. 한국시간 오늘 / 이번 달 기준
     * ========================================
     */

    const {
      todayStartIso,
      monthStartIso,
    } =
      getKstBoundaries();

    /*
     * ========================================
     * 4. 이번 달 완료 결제 조회
     * ========================================
     */

    const {
      data: monthPayments,
      error:
        monthPaymentsError,
    } =
      await adminSupabase
        .from(
          "hoo_coffee_payments",
        )
        .select(
          `
            order_id,
            amount,
            currency,
            status,
            approved_at
          `,
        )
        .eq(
          "status",
          "DONE",
        )
        .gte(
          "approved_at",
          monthStartIso,
        )
        .order(
          "approved_at",
          {
            ascending:
              false,
          },
        );

    if (monthPaymentsError) {
      console.error(
        "[Admin Coffee] 월간 결제 조회 실패:",
        monthPaymentsError,
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "커피 결제 기록을 불러오지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    const payments =
      (
        monthPayments ??
        []
      ) as CoffeePaymentRow[];

    /*
     * ========================================
     * 5. 오늘 통계
     * ========================================
     */

    const todayPayments =
      payments.filter(
        (payment) =>
          payment.approved_at >=
          todayStartIso,
      );

    const todayCount =
      todayPayments.length;

    const todayAmount =
      todayPayments.reduce(
        (
          total,
          payment,
        ) =>
          total +
          Number(
            payment.amount,
          ),
        0,
      );

    /*
     * ========================================
     * 6. 이번 달 통계
     * ========================================
     */

    const monthCount =
      payments.length;

    const monthAmount =
      payments.reduce(
        (
          total,
          payment,
        ) =>
          total +
          Number(
            payment.amount,
          ),
        0,
      );

    /*
     * ========================================
     * 7. 최근 결제 20건
     * ========================================
     *
     * payment_key_hash는 관리자 화면에도
     * 굳이 노출하지 않는다.
     */

    const {
      data: recentPayments,
      error:
        recentPaymentsError,
    } =
      await adminSupabase
        .from(
          "hoo_coffee_payments",
        )
        .select(
          `
            order_id,
            amount,
            currency,
            status,
            approved_at
          `,
        )
        .order(
          "approved_at",
          {
            ascending:
              false,
          },
        )
        .limit(20);

    if (recentPaymentsError) {
      console.error(
        "[Admin Coffee] 최근 결제 조회 실패:",
        recentPaymentsError,
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "최근 커피 기록을 불러오지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * ========================================
     * 8. 관리자에게 필요한 정보만 반환
     * ========================================
     */

    const recent =
      (
        recentPayments ??
        []
      ).map(
        (payment) => ({
          orderId:
            payment.order_id,

          amount:
            Number(
              payment.amount,
            ),

          currency:
            payment.currency,

          status:
            payment.status,

          approvedAt:
            payment.approved_at,
        }),
      );

    const response =
      NextResponse.json({
        ok: true,

        stats: {
          today: {
            count:
              todayCount,
            amount:
              todayAmount,
          },

          month: {
            count:
              monthCount,
            amount:
              monthAmount,
          },
        },

        recent,
      });

    response.headers.set(
      "Cache-Control",
      "no-store",
    );

    return response;
  } catch (error) {
    console.error(
      "[Admin Coffee] API 오류:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "커피 관리자 정보를 불러오지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}
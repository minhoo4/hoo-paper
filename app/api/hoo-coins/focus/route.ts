import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

import {
  createClient,
} from "@/lib/supabase/server";


type FocusCoinRequestBody = {
  startedAt?: unknown;
  actualSeconds?: unknown;
};


export async function POST(
  request: NextRequest,
) {
  try {
    /*
     * 1. 현재 로그인 사용자 확인
     */
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "로그인이 필요합니다.",
        },
        {
          status: 401,
        },
      );
    }


    /*
     * 2. 요청 데이터 확인
     */
    const body =
      (await request.json()) as
        FocusCoinRequestBody;

    const startedAt =
      typeof body.startedAt ===
      "string"
        ? body.startedAt
        : "";

    const actualSeconds =
      Number(body.actualSeconds);


    if (!startedAt) {
      return NextResponse.json(
        {
          error:
            "집중 시작 시간이 없습니다.",
        },
        {
          status: 400,
        },
      );
    }


    const startedAtTime =
      new Date(startedAt).getTime();

    if (
      !Number.isFinite(
        startedAtTime,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "집중 시작 시간이 올바르지 않습니다.",
        },
        {
          status: 400,
        },
      );
    }


    if (
      !Number.isFinite(
        actualSeconds,
      ) ||
      actualSeconds < 0
    ) {
      return NextResponse.json(
        {
          error:
            "집중 시간이 올바르지 않습니다.",
        },
        {
          status: 400,
        },
      );
    }


    /*
     * 비정상적으로 큰 요청 방지.
     *
     * 기존 Focus Mode 최대시간보다
     * 넉넉하게 24시간까지만 허용한다.
     */
    const safeActualSeconds =
      Math.min(
        24 * 60 * 60,
        Math.floor(
          actualSeconds,
        ),
      );


    /*
     * 3. 10분마다 후코인 1개
     *
     * 599초  = 0
     * 600초  = 1
     * 1500초 = 2
     * 3600초 = 6
     */
    const earnedCoins =
      Math.floor(
        safeActualSeconds /
          (10 * 60),
      );


    /*
     * 10분 미만이면 지급하지 않는다.
     */
    if (earnedCoins < 1) {
      return NextResponse.json({
        success: true,
        applied: false,
        earnedCoins: 0,
        reason:
          "FOCUS_TIME_UNDER_10_MINUTES",
      });
    }


    /*
     * 4. 중복 지급 방지 키
     *
     * 사용자 + 집중 시작시간을 기준으로
     * 동일 세션에는 한 번만 지급된다.
     */
    const normalizedStartedAt =
      new Date(
        startedAtTime,
      ).toISOString();

    const dedupeKey =
      `focus:${user.id}:${normalizedStartedAt}`;


    /*
     * 5. Service Role 클라이언트 생성
     *
     * apply_hoo_coin_transaction 함수는
     * 일반 authenticated 사용자가 직접
     * 실행할 수 없도록 막아둔 상태다.
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
        "Supabase Service Role 환경변수가 없습니다.",
      );

      return NextResponse.json(
        {
          error:
            "후코인 서버 설정이 완료되지 않았습니다.",
        },
        {
          status: 500,
        },
      );
    }


    const admin =
      createAdminClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );


    /*
     * 6. 후코인 지급
     */
    const {
      data,
      error,
    } =
      await admin.rpc(
        "apply_hoo_coin_transaction",
        {
          p_user_id:
            user.id,

          p_amount:
            earnedCoins,

          p_transaction_type:
            "earn",

          p_source:
            "focus",

          p_dedupe_key:
            dedupeKey,

          p_metadata: {
            startedAt:
              normalizedStartedAt,

            actualSeconds:
              safeActualSeconds,

            rewardUnitSeconds:
              600,

            rewardCoins:
              earnedCoins,
          },
        },
      );


    if (error) {
      console.error(
        "포커스 후코인 지급 실패:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "후코인을 지급하지 못했습니다.",
        },
        {
          status: 500,
        },
      );
    }


    /*
     * RPC는 TABLE 형태를 반환하므로
     * 첫 번째 행을 사용한다.
     */
    const result =
      Array.isArray(data)
        ? data[0]
        : data;


    return NextResponse.json({
      success: true,

      applied:
        Boolean(
          result?.applied,
        ),

      earnedCoins,

      balance:
        Number(
          result?.new_balance ??
            0,
        ),

      transactionId:
        result
          ?.transaction_id ??
        null,
    });
  } catch (error) {
    console.error(
      "포커스 후코인 API 오류:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "후코인 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      },
    );
  }
}
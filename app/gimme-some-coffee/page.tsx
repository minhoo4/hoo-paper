"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ANONYMOUS,
  loadTossPayments,
} from "@tosspayments/tosspayments-sdk";

const COFFEE_AMOUNTS = [
  {
    value: 2000,
    label: "가볍게 한 잔",
    emoji: "☕",
  },
  {
    value: 5000,
    label: "오늘도 일해라",
    emoji: "☕☕",
  },
  {
    value: 10000,
    label: "야근 확정",
    emoji: "☕☕☕",
  },
] as const;

type TossWidgets = {
  setAmount: (amount: {
    currency: "KRW";
    value: number;
  }) => Promise<void>;
  renderPaymentMethods: (options: {
    selector: string;
    variantKey: string;
  }) => Promise<unknown>;
  renderAgreement: (options: {
    selector: string;
    variantKey: string;
  }) => Promise<unknown>;
  requestPayment: (options: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
  }) => Promise<unknown>;
};

type CreateOrderResponse = {
  ok: boolean;
  orderId?: string;
  amount?: number;
  message?: string;
};

export default function GimmeSomeCoffeePage() {
  const [amount, setAmount] =
    useState<number>(5000);

  const [widgets, setWidgets] =
    useState<TossWidgets | null>(null);

  const [ready, setReady] =
    useState(false);

  const [paying, setPaying] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  const initializingRef =
    useRef(false);

  const clientKey =
    process.env
      .NEXT_PUBLIC_TOSS_CLIENT_KEY;

  useEffect(() => {
    if (
      initializingRef.current ||
      !clientKey
    ) {
      return;
    }

    initializingRef.current = true;

    async function initialize() {
      try {
        const tossPayments =
          await loadTossPayments(
            clientKey!,
          );

        const instance =
          tossPayments.widgets({
            customerKey: ANONYMOUS,
          }) as unknown as TossWidgets;

        await instance.setAmount({
          currency: "KRW",
          value: 5000,
        });

        await Promise.all([
          instance.renderPaymentMethods({
            selector:
              "#coffee-payment-method",
            variantKey: "DEFAULT",
          }),

          instance.renderAgreement({
            selector:
              "#coffee-agreement",
            variantKey: "AGREEMENT",
          }),
        ]);

        setWidgets(instance);
        setReady(true);
      } catch (error) {
        console.error(
          "[GimmeSomeCoffee] widget init failed",
          error,
        );

        setErrorMessage(
          "결제창을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
    }

    void initialize();
  }, [clientKey]);

  async function selectAmount(
    nextAmount: number,
  ) {
    setAmount(nextAmount);
    setErrorMessage(null);

    if (!widgets) {
      return;
    }

    try {
      await widgets.setAmount({
        currency: "KRW",
        value: nextAmount,
      });
    } catch (error) {
      console.error(
        "[GimmeSomeCoffee] amount update failed",
        error,
      );

      setErrorMessage(
        "금액 변경에 실패했습니다.",
      );
    }
  }

  async function requestPayment() {
    if (
      !widgets ||
      !ready ||
      paying
    ) {
      return;
    }

    setPaying(true);
    setErrorMessage(null);

    try {
      await widgets.setAmount({
        currency: "KRW",
        value: amount,
      });

      const response =
        await fetch(
          "/api/gimme-some-coffee/order",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              amount,
            }),
          },
        );

      const order =
        (await response.json()) as
          CreateOrderResponse;

      if (
        !response.ok ||
        !order.ok ||
        !order.orderId ||
        order.amount !== amount
      ) {
        throw new Error(
          order.message ??
            "커피 주문 생성에 실패했습니다.",
        );
      }

      const origin =
        window.location.origin;

      await widgets.requestPayment({
        orderId: order.orderId,
        orderName:
          "HOO 김미썸커피",
        successUrl:
          `${origin}/gimme-some-coffee/success`,
        failUrl:
          `${origin}/gimme-some-coffee/fail`,
      });
    } catch (error) {
      console.error(
        "[GimmeSomeCoffee] payment request failed",
        error,
      );

      setPaying(false);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "결제를 시작하지 못했습니다.",
      );
    }
  }

  if (!clientKey) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#090807] px-4 py-10 text-white sm:px-6 sm:py-16">
        <div className="pointer-events-none absolute left-1/2 top-[-240px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#9b6a31]/15 blur-[120px]" />

        <div className="relative mx-auto max-w-xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.08em] text-white/45 transition hover:text-white/80"
          >
            <span>←</span>
            <span>HOO로 돌아가기</span>
          </Link>

          <section className="mt-6 rounded-[30px] border border-white/10 bg-white/[0.045] p-7 text-center shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-9">
            <img
              src="/gimme-some-coffee-icon.png"
              alt="커피먹고 일해라"
              draggable={false}
              className="mx-auto w-[180px] select-none drop-shadow-[0_18px_35px_rgba(0,0,0,0.28)] sm:w-[210px]"
            />

            <h1 className="mt-6 text-2xl font-black tracking-[-0.04em]">
              결제 준비가 아직 안 됐어요
            </h1>

            <p className="mt-3 text-sm font-medium leading-6 text-white/45">
              NEXT_PUBLIC_TOSS_CLIENT_KEY
              환경변수를 설정하면
              김미썸커피 결제를 사용할 수 있습니다.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090807] px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[#c98a42]/14 blur-[120px]" />

      <div className="pointer-events-none absolute bottom-[-220px] right-[-160px] h-[440px] w-[440px] rounded-full bg-[#667a35]/10 blur-[130px]" />

      <div className="relative mx-auto w-full max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.08em] text-white/40 transition hover:text-white/80"
        >
          <span>←</span>
          <span>HOO로 돌아가기</span>
        </Link>

        <section className="mt-5 overflow-hidden rounded-[32px] border border-white/10 bg-[#12100e]/90 shadow-[0_35px_100px_rgba(0,0,0,0.48)] backdrop-blur-xl">
          <header className="px-6 pb-8 pt-7 text-center sm:px-9 sm:pb-10 sm:pt-9">
            <img
              src="/gimme-some-coffee-icon.png"
              alt="커피먹고 일해라"
              draggable={false}
              className="mx-auto w-[190px] select-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.30)] sm:w-[230px]"
            />

            <p className="mt-5 text-[10px] font-black tracking-[0.26em] text-[#d1a56c]/70">
              GIMME SOME COFFEE
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-[-0.055em] sm:text-4xl">
              커피먹고 일해라
            </h1>

            <p className="mx-auto mt-4 max-w-md text-sm font-medium leading-6 text-white/46">
              HOO가 마음에 드셨나요?
              <br className="hidden sm:block" />
              받은 커피는 개발과 운영에 보탬이 됩니다.
            </p>
          </header>

          <div className="border-t border-white/[0.07] px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.18em] text-white/30">
                  COFFEE
                </p>

                <h2 className="mt-1 text-base font-black">
                  얼마나 진하게?
                </h2>
              </div>

              <p className="text-lg font-black text-[#e6bc83]">
                {amount.toLocaleString(
                  "ko-KR",
                )}
                원
              </p>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {COFFEE_AMOUNTS.map(
                (coffee) => {
                  const selected =
                    amount ===
                    coffee.value;

                  return (
                    <button
                      key={coffee.value}
                      type="button"
                      onClick={() =>
                        void selectAmount(
                          coffee.value,
                        )
                      }
                      className={[
                        "relative overflow-hidden rounded-[20px] border px-4 py-4 text-left transition duration-200 active:scale-[0.98]",
                        selected
                          ? "border-[#d8aa6c]/70 bg-[#e7bc82] text-[#24170d] shadow-[0_12px_32px_rgba(183,126,62,0.20)]"
                          : "border-white/10 bg-white/[0.035] text-white hover:border-white/20 hover:bg-white/[0.06]",
                      ].join(" ")}
                    >
                      {selected ? (
                        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#24170d]/10 text-[10px] font-black">
                          ✓
                        </span>
                      ) : null}

                      <div className="text-base tracking-[-0.12em]">
                        {coffee.emoji}
                      </div>

                      <div className="mt-4 text-lg font-black tracking-[-0.03em]">
                        {coffee.value.toLocaleString(
                          "ko-KR",
                        )}
                        원
                      </div>

                      <div
                        className={[
                          "mt-1 text-[11px] font-bold",
                          selected
                            ? "text-[#24170d]/55"
                            : "text-white/35",
                        ].join(" ")}
                      >
                        {coffee.label}
                      </div>
                    </button>
                  );
                },
              )}
            </div>

            <div className="mt-7">
              <p className="mb-3 text-[10px] font-black tracking-[0.18em] text-white/30">
                PAYMENT
              </p>

              <div className="overflow-hidden rounded-[22px] bg-white p-1.5 text-black shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
                <div
                  id="coffee-payment-method"
                />

                <div
                  id="coffee-agreement"
                />
              </div>
            </div>

            {errorMessage ? (
              <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold leading-5 text-red-100">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="button"
              disabled={
                !ready || paying
              }
              onClick={() =>
                void requestPayment()
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#e7bc82] px-5 py-4 text-base font-black text-[#24170d] shadow-[0_14px_34px_rgba(183,126,62,0.22)] transition hover:bg-[#efc994] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span>
                {paying
                  ? "결제창 여는 중..."
                  : `${amount.toLocaleString(
                      "ko-KR",
                    )}원 커피 보내기`}
              </span>

              {!paying ? (
                <span aria-hidden="true">
                  →
                </span>
              ) : null}
            </button>

            <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3">
              <span
                aria-hidden="true"
                className="mt-[1px] text-xs"
              >
                🔒
              </span>

              <p className="text-[10px] font-semibold leading-5 text-white/32">
                HOO는 카드번호와 개발자의
                정산 계좌번호를 직접 저장하지
                않습니다. 결제는 등록된
                결제사를 통해 처리됩니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

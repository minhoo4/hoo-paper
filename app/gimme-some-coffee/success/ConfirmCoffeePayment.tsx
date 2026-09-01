'use client';

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
} from "react";

type ConfirmCoffeePaymentProps = {
  paymentKey: string;
  orderId: string;
  amount: number;
};

type ConfirmResponse = {
  ok: boolean;
  amount?: number;
  status?: string | null;
  message?: string;
};

export default function ConfirmCoffeePayment({
  paymentKey,
  orderId,
  amount,
}: ConfirmCoffeePaymentProps) {
  const startedRef = useRef(false);

  const [state, setState] = useState<
    "confirming" | "success" | "error"
  >("confirming");

  const [message, setMessage] = useState(
    "결제를 확인하고 있습니다.",
  );

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    async function confirm() {
      try {
        const response = await fetch(
          "/api/gimme-some-coffee/confirm",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              paymentKey,
              orderId,
              amount,
            }),
          },
        );

        const result =
          (await response.json()) as ConfirmResponse;

        if (!response.ok || !result.ok) {
          throw new Error(
            result.message ??
              "결제 승인에 실패했습니다.",
          );
        }

        if (
          result.status &&
          result.status !== "DONE"
        ) {
          throw new Error(
            "결제가 아직 완료 상태가 아닙니다.",
          );
        }

        setState("success");
        setMessage(
          "커피 잘 마시고 다시 구르러 가겠습니다.",
        );
      } catch (error) {
        console.error(
          "[GimmeSomeCoffee] confirm failed",
          error,
        );

        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "결제 확인 중 문제가 발생했습니다.",
        );
      }
    }

    void confirm();
  }, [paymentKey, orderId, amount]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080706] px-4 py-10 text-white">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d49a50]/10 blur-[155px]" />

      <div className="pointer-events-none absolute bottom-[-220px] right-[-180px] h-[460px] w-[460px] rounded-full bg-[#70813b]/10 blur-[140px]" />

      <div className="relative w-full max-w-[640px]">
        <section className="w-full overflow-hidden rounded-[36px] border border-white/10 bg-[#12100e]/95 shadow-[0_40px_120px_rgba(0,0,0,0.58)] backdrop-blur-xl">
          {state === "success" ? (
            <div className="px-7 pb-10 pt-8 text-center sm:px-12 sm:pb-12 sm:pt-10">
              <img
                src="/gimme-some-coffee-success.png"
                alt="커피를 받고 놀란 HOO 캐릭터"
                draggable={false}
                className="mx-auto block h-auto w-full max-w-[360px] select-none drop-shadow-[0_25px_55px_rgba(0,0,0,0.4)]"
              />

              <p className="mt-4 text-[10px] font-black tracking-[0.28em] text-[#d5a66c]/70">
                COFFEE RECEIVED
              </p>

              <h1 className="mt-3 text-[34px] font-black tracking-[-0.055em] sm:text-[40px]">
                비상!!
              </h1>

              <p className="mt-5 text-[14px] font-semibold leading-7 text-white/50 sm:text-[15px]">
                쉬고 있을 수 없지
                <br />
                다시 구르러 가겠습니다.
              </p>

              <div className="mt-7">
                <span className="inline-flex min-w-[120px] items-center justify-center rounded-full border border-[#d5a66c]/25 bg-[#d5a66c]/10 px-6 py-3 text-xl font-black text-[#e8bd83]">
                  {amount.toLocaleString("ko-KR")}원
                </span>
              </div>

              <div className="mt-9">
                <Link
                  href="/"
                  className="inline-flex min-w-[210px] items-center justify-center rounded-[18px] bg-[#e7bc82] px-7 py-4 text-sm font-black text-[#24170d] shadow-[0_14px_36px_rgba(183,126,62,0.24)] transition hover:-translate-y-0.5 hover:bg-[#efc994] active:translate-y-0 active:scale-[0.98]"
                >
                  HOO로 돌아가기
                </Link>
              </div>
            </div>
          ) : state === "error" ? (
            <div className="px-8 py-12 text-center sm:px-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-red-400/20 bg-red-400/10 text-2xl font-black text-red-200">
                !
              </div>

              <h1 className="mt-5 text-2xl font-black tracking-[-0.04em]">
                결제를 확인해주세요
              </h1>

              <p className="mt-4 text-sm font-medium leading-6 text-white/50">
                {message}
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/gimme-some-coffee"
                  className="rounded-[16px] border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white/75 transition hover:bg-white/[0.08]"
                >
                  다시 시도
                </Link>

                <Link
                  href="/"
                  className="rounded-[16px] bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-white/90"
                >
                  HOO로 돌아가기
                </Link>
              </div>
            </div>
          ) : (
            <div className="px-8 py-16 text-center sm:px-12">
              <div className="mx-auto h-11 w-11 animate-spin rounded-full border-2 border-white/10 border-t-[#e7bc82]" />

              <h1 className="mt-7 text-2xl font-black tracking-[-0.04em]">
                커피 확인 중...
              </h1>

              <p className="mt-3 text-sm font-medium text-white/40">
                잠깐만 기다려주세요.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

import ConfirmCoffeePayment from "./ConfirmCoffeePayment";

type SearchParams = Promise<
  Record<
    string,
    string |
    string[] |
    undefined
  >
>;

export default async function GimmeSomeCoffeeSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params =
    await searchParams;

  const paymentKey =
    typeof params.paymentKey ===
    "string"
      ? params.paymentKey
      : "";

  const orderId =
    typeof params.orderId ===
    "string"
      ? params.orderId
      : "";

  const amount =
    Number(params.amount);

  if (
    !paymentKey ||
    !orderId ||
    !Number.isInteger(amount)
  ) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-lg rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center">
          <div className="text-4xl">
            !
          </div>
          <h1 className="mt-5 text-2xl font-semibold">
            결제 정보를 확인할 수 없습니다
          </h1>
          <p className="mt-4 text-sm leading-6 text-white/60">
            결제내역을 확인한 뒤
            김미썸커피 페이지에서 다시
            시도해주세요.
          </p>
        </div>
      </main>
    );
  }

  return (
    <ConfirmCoffeePayment
      paymentKey={paymentKey}
      orderId={orderId}
      amount={amount}
    />
  );
}

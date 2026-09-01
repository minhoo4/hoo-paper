import Link from "next/link";

type SearchParams = Promise<
  Record<
    string,
    string |
    string[] |
    undefined
  >
>;

export default async function GimmeSomeCoffeeFailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params =
    await searchParams;

  const message =
    typeof params.message ===
    "string"
      ? params.message
      : "결제가 취소되었거나 완료되지 않았습니다.";

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-16 text-white">
      <div className="mx-auto max-w-lg rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center">
        <div className="text-4xl">
          ☕
        </div>

        <h1 className="mt-5 text-2xl font-semibold">
          커피 전송이 완료되지 않았어요
        </h1>

        <p className="mt-4 text-sm leading-6 text-white/60">
          {message}
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/gimme-some-coffee"
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
          >
            다시 시도
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/80"
          >
            HOO로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}


"use client";

import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type ContestRow = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string;
};

type RpcOutput = {
  success?: boolean;
  contest_id?: string;
  status?: string;
  is_published?: boolean;
};

const writeEnabled =
  process.env.NEXT_PUBLIC_HOO_CONTEST_ADMIN_WRITE_ENABLED === "true";

const inputStyle =
  "w-full rounded-xl border border-white/20 bg-[#1c1c1c] px-3 py-2 text-sm text-white outline-none focus:border-amber-400";

const buttonStyle =
  "rounded-xl border border-white/20 bg-[#303030] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40";

function assertSuccess(
  data: unknown,
  error: { message: string } | null
): RpcOutput {
  if (error) {
    throw new Error(error.message);
  }

  const result = data as RpcOutput | null;

  if (result?.success !== true) {
    throw new Error("RPC 응답을 확인할 수 없습니다.");
  }

  return result;
}

function prizeNumber(value: string): number {
  const n = Number(value);

  if (
    !Number.isSafeInteger(n) ||
    n < 0 ||
    value.trim() === ""
  ) {
    throw new Error("상금은 0 이상의 정수로 입력해 주세요.");
  }

  return n;
}

export default function HooContestAdminPanel() {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [prizes, setPrizes] = useState([
    "0",
    "0",
    "0",
  ]);

  const [contestId, setContestId] = useState("");

  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [posterPath, setPosterPath] = useState("");

  const [recentPublication, setRecentPublication] =
    useState<boolean | null>(null);

  const [items, setItems] = useState<ContestRow[]>([]);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const posterFileInputRef = useRef<HTMLInputElement>(null);
  // HOO_CONTEST_LOCAL_POSTER_PREVIEW_V1
  const [posterPreview, setPosterPreview] = useState("");
  const requestRef = useRef<{
    signature: string;
    id: string;
  } | null>(null);

  async function run(
    label: string,
    operation: () => Promise<void>,
    requiresWrite = true
  ) {
    if (busy) return;

    if (requiresWrite && !writeEnabled) {
      setMessage(
        "운영 잠금 상태입니다. 데이터 변경은 아직 허용되지 않습니다."
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await operation();
      setMessage(`${label} 완료`);
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "작업에 실패했습니다."
      );
    } finally {
      setBusy(false);
    }
  }

  async function createContest(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    await run("대회 생성", async () => {
      const start = new Date(startsAt);
      const end = new Date(endsAt);

      if (
        !title.trim() ||
        title.trim().length > 120
      ) {
        throw new Error(
          "대회 제목은 1~120자입니다."
        );
      }

      if (
        !Number.isFinite(start.getTime()) ||
        start.getTime() <= Date.now() ||
        !Number.isFinite(end.getTime()) ||
        end <= start
      ) {
        throw new Error(
          "시작 시각은 미래, 종료 시각은 시작 이후여야 합니다."
        );
      }

      const amounts = prizes.map(prizeNumber);

      const signature = JSON.stringify([
        title.trim(),
        start.toISOString(),
        end.toISOString(),
        amounts,
      ]);

      if (
        requestRef.current?.signature !== signature
      ) {
        requestRef.current = {
          signature,
          id: crypto.randomUUID(),
        };
      }

      const { data, error } =
        await createClient().rpc(
          "hoo_trading_contest_admin_create_v1",
          {
            p_request_id: requestRef.current.id,
            p_title: title.trim(),
            p_starts_at: start.toISOString(),
            p_ends_at: end.toISOString(),
            p_prize_1_hoo: amounts[0],
            p_prize_2_hoo: amounts[1],
            p_prize_3_hoo: amounts[2],
          }
        );

      const result = assertSuccess(data, error);

      if (!result.contest_id) {
        throw new Error(
          "생성된 대회 ID가 없습니다."
        );
      }

      setContestId(result.contest_id);
      setRecentPublication(null);
    });
  }

  function validId(): string {
    const id = contestId.trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      throw new Error(
        "대회 UUID를 먼저 선택하거나 입력해 주세요."
      );
    }

    return id;
  }

  function savePresentation(publish: boolean) {
    void run(
      publish
        ? "대회 공개"
        : "안내 저장 / 비공개",
      async () => {
        const id = validId();

        const { data, error } =
          await createClient().rpc(
            "hoo_trading_contest_admin_presentation_v1",
            {
              p_contest_id: id,
              p_headline: headline.trim(),
              p_body: body.trim(),
              p_poster_path:
                posterPath.trim() || null,
              p_publish: publish,
            }
          );

        assertSuccess(data, error);

        setRecentPublication(publish);
      }
    );
  }

  // HOO_CONTEST_POSTER_UPLOAD_V1
  async function uploadPoster(file: File) {
    await run(
      "포스터 이미지 업로드",
      async () => {
        const id = validId().toLowerCase();

        const types: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };

        const extension = types[file.type];

        if (!extension) {
          throw new Error("JPG, PNG, WEBP만 업로드할 수 있습니다.");
        }

        if (file.size === 0 || file.size > 5 * 1024 * 1024) {
          throw new Error("이미지 크기는 5MB 이하여야 합니다.");
        }

        const path =
          `contests/${id}/${crypto.randomUUID()}.${extension}`;

        const { error } = await createClient()
          .storage
          .from("hoo-contest-posters")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
            cacheControl: "3600",
          });

        if (error) {
          throw new Error(error.message);
        }

        setPosterPath(path);
        setRecentPublication(null);
      },
      true
    );
  }
  // HOO_CONTEST_POSTER_VERIFY_BUTTON_V1
  function verifyPoster() {
    void run("포스터 검증", async () => {
      const id = validId();

      const { data, error } = await createClient().rpc(
        "hoo_trading_contest_admin_verify_poster_v1",
        {
          p_contest_id: id,
        }
      );

      assertSuccess(data, error);
    });
  }
  function changeStatus(
    kind: "start" | "end"
  ) {
    const confirmed = window.confirm(
      kind === "start"
        ? "이 대회를 시작 처리할까요?"
        : "이 대회를 종료 처리할까요?"
    );

    if (!confirmed) return;

    void run(
      kind === "start"
        ? "대회 시작"
        : "대회 종료",
      async () => {
        const id = validId();

        const functionName =
          kind === "start"
            ? "hoo_trading_contest_admin_start_v1"
            : "hoo_trading_contest_admin_end_v1";

        const { data, error } =
          await createClient().rpc(
            functionName,
            {
              p_contest_id: id,
            }
          );

        assertSuccess(data, error);
      }
    );
  }

  function loadList() {
    void run(
      "대회 목록 조회",
      async () => {
        const { data, error } =
          await createClient()
            .from("hoo_trading_contests")
            .select(
              "id,title,status,starts_at,ends_at"
            )
            .order("created_at", {
              ascending: false,
            })
            .limit(30);

        if (error) {
          throw new Error(error.message);
        }

        setItems(
          (data ?? []) as ContestRow[]
        );
      },
      false
    );
  }

  return (
    <section className="mx-auto mb-8 w-full rounded-[18px] border border-[#2d2d2d] bg-[#121212] p-5 text-white sm:w-[80%]">

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">
          🏆 HOO CONTEST 관리
        </h2>

        <span className="rounded-lg bg-white/10 px-2 py-1 text-xs">
          {writeEnabled
            ? "쓰기 스위치 ON · DB 잠금 별도 적용"
            : "개발 모드 · DB 쓰기 비활성"}
        </span>
      </div>

      <p className="mb-5 text-xs text-white/60">
        대회가 공개되고 status=active이며
        설정된 대회 기간 내일 때만
        HOO WORLD에 표시됩니다.
        자동 시작·종료 스케줄은
        별도 개발 대상입니다.
      </p>

      <form
        onSubmit={(e) => void createContest(e)}
        className="space-y-3"
      >
        <h3 className="font-semibold text-amber-200">
          1. 대회 생성
        </h3>

        <label className="block text-sm">
          대회 제목

          <input
            className={inputStyle}
            value={title}
            maxLength={120}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            placeholder="제1회 HOO TRADING CONTEST"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">

          <label className="block text-sm">
            시작 일시

            <input
              className={inputStyle}
              type="datetime-local"
              value={startsAt}
              onChange={(e) =>
                setStartsAt(e.target.value)
              }
            />
          </label>

          <label className="block text-sm">
            종료 일시

            <input
              className={inputStyle}
              type="datetime-local"
              value={endsAt}
              onChange={(e) =>
                setEndsAt(e.target.value)
              }
            />
          </label>

        </div>

        <div className="grid grid-cols-3 gap-3">
          {prizes.map((value, i) => (
            <label
              className="block text-xs"
              key={i}
            >
              {i + 1}등 상금 (HOO)

              <input
                className={inputStyle}
                type="number"
                min="0"
                step="1"
                value={value}
                onChange={(e) =>
                  setPrizes((prev) =>
                    prev.map((v, j) =>
                      i === j
                        ? e.target.value
                        : v
                    )
                  )
                }
              />
            </label>
          ))}
        </div>

        <button
          className={buttonStyle}
          type="submit"
          disabled={!writeEnabled || busy}
        >
          대회 생성
        </button>
      </form>

      <div className="my-5 border-t border-white/15" />

      <div className="space-y-3">

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-amber-200">
            2. 대회 선택 및 관리
          </h3>

          <button
            type="button"
            className={buttonStyle}
            onClick={loadList}
            disabled={busy}
          >
            대회 목록 1회 조회
          </button>
        </div>

        {items.length > 0 && (
          <div className="max-h-40 space-y-1 overflow-auto rounded-lg bg-white/5 p-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="block w-full rounded p-2 text-left text-xs hover:bg-white/10"
                onClick={() => {
                  setContestId(item.id);
                  setRecentPublication(null);
                }}
              >
                {item.title}
                {" · "}
                {item.status}
                {" · "}
                {new Date(
                  item.starts_at
                ).toLocaleString("ko-KR")}
              </button>
            ))}
          </div>
        )}

        <label className="block text-sm">
          선택한 대회 UUID

          <input
            className={inputStyle}
            value={contestId}
            onChange={(e) => {
              setContestId(e.target.value);
              setRecentPublication(null);
            }}
            placeholder="대회 생성 후 자동 입력"
          />
        </label>

        <label className="block text-sm">
          포스터 제목 / 헤드라인

          <input
            className={inputStyle}
            value={headline}
            maxLength={120}
            onChange={(e) =>
              setHeadline(e.target.value)
            }
          />
        </label>

        <label className="block text-sm">
          대회 안내 내용

          <textarea
            className={inputStyle}
            value={body}
            maxLength={4000}
            rows={3}
            onChange={(e) =>
              setBody(e.target.value)
            }
          />
        </label>

        <label className="block text-sm">
          포스터 파일 경로

          <input
            className={inputStyle}
            value={posterPath}
            onChange={(e) =>
              setPosterPath(e.target.value)
            }
            placeholder="contests/대회UUID/poster.webp"
          />

          <span className="mt-1 block text-xs text-white/40">
            선택 사항 · 검증된 이미지 경로만 공개 가능
          </span>
        </label>

        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 text-sm font-semibold">
            포스터 이미지 미리보기
          </p>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-white/70"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;

              if (
                !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
                file.size === 0 ||
                file.size > 5 * 1024 * 1024
              ) {
                setMessage("JPG, PNG, WEBP / 최대 5MB 이미지만 선택해 주세요.");
                setPosterPreview("");
                return;
              }

              const reader = new FileReader();

              reader.onload = () => {
                if (typeof reader.result === "string") {
                  setPosterPreview(reader.result);
                }
              };

              reader.onerror = () => {
                setMessage("이미지를 읽지 못했습니다.");
              };

              reader.readAsDataURL(file);
            }}
          />

          {posterPreview && (
            <div className="mt-4">
              <img
                src={posterPreview}
                alt="대회 포스터 미리보기"
                className="max-h-[400px] w-full rounded-lg object-contain"
              />
            </div>
          )}

          <p className="mt-2 text-xs text-white/40">
            로컬 미리보기 전용 · 서버 업로드 및 공개 없음
          </p>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            ref={posterFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void uploadPoster(file);
            }}
          />

          <button
            type="button"
            className={buttonStyle}
            disabled={!writeEnabled || busy || !contestId.trim()}
            onClick={() => posterFileInputRef.current?.click()}
          >
            포스터 이미지 업로드
          </button>

          <span className="text-xs text-white/50">
            JPG · PNG · WEBP / 최대 5MB
          </span>
        </div>
        <div className="flex flex-wrap gap-2">

          <button
            type="button"
            className={buttonStyle}
            disabled={!writeEnabled || busy}
            onClick={() =>
              savePresentation(false)
            }
          >
            비공개로 저장
          </button>

          <button
            type="button"
            className={buttonStyle}
            disabled={!writeEnabled || busy}
            onClick={() =>
              savePresentation(true)
            }
          >
            대회 공개
          </button>

          <button
            type="button"
            className={buttonStyle}
            disabled={
              !writeEnabled ||
              busy ||
              !contestId.trim() ||
              !posterPath.trim()
            }
            onClick={verifyPoster}
          >
            포스터 검증
          </button>
          <button
            type="button"
            className={buttonStyle}
            disabled={!writeEnabled || busy}
            onClick={() =>
              changeStatus("start")
            }
          >
            시작 처리
          </button>

          <button
            type="button"
            className={buttonStyle}
            disabled={!writeEnabled || busy}
            onClick={() =>
              changeStatus("end")
            }
          >
            종료 처리
          </button>

        </div>

        {recentPublication !== null && (
          <p className="text-xs text-white/60">
            마지막 저장 공개 상태:{" "}
            {recentPublication
              ? "공개"
              : "비공개"}
          </p>
        )}
      </div>

      {message && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-white/10 p-3 text-sm"
        >
          {message}
        </p>
      )}

      <p className="mt-4 text-xs text-white/50">
        DB 기능 잠금(trading_contest=false)은
        별도로 유지합니다.
        실제 포스터 업로드·검증,
        자동 시작·종료는 아직 연결 전입니다.
      </p>

    </section>
  );
}

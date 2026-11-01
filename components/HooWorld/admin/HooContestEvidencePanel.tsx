"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EvidenceEntry = {
  id: number;
  check_key: string;
  evidence_detail: string;
  recorded_at: string;
  verification_status: string;
};

type EvidenceResponse = {
  success?: boolean;
  entries?: EvidenceEntry[];
};

const checkOptions = [
  { value: "position_linkage", label: "포지션 연결 검증" },
  { value: "entry_baseline", label: "참가 기준자본 검증" },
  { value: "trade_timing", label: "거래 시각 검증" },
  { value: "roi_formula", label: "ROI 공식 검증" },
  { value: "candidate_results", label: "TOP20 후보 검증" },
];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const writeEnabled =
  process.env.NEXT_PUBLIC_HOO_CONTEST_EVIDENCE_WRITE_ENABLED === "true";

export default function HooContestEvidencePanel() {
  const [contestId, setContestId] = useState("");
  const [checkKey, setCheckKey] = useState("position_linkage");
  const [detail, setDetail] = useState("");
  const [entries, setEntries] = useState<EvidenceEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function getContestId() {
    const id = contestId.trim();

    if (!uuidPattern.test(id)) {
      throw new Error("올바른 대회 UUID를 입력해 주세요.");
    }

    return id;
  }

  async function fetchEvidence(id: string) {
    const { data, error: rpcError } =
      await createClient().rpc(
        "hoo_trading_contest_admin_list_evidence_v1",
        { p_contest_id: id }
      );

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    const result = data as EvidenceResponse | null;

    if (
      result?.success !== true ||
      !Array.isArray(result.entries)
    ) {
      throw new Error("증거 조회 응답이 올바르지 않습니다.");
    }

    return result.entries;
  }

  async function loadEvidence() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const id = getContestId();
      const rows = await fetchEvidence(id);

      setEntries(rows);
      setLoaded(true);
      setMessage(`증거 기록 ${rows.length}건 조회 완료`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "조회 실패"
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveEvidence() {
    if (!writeEnabled) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const id = getContestId();
      const content = detail.trim();

      if (content.length < 20 || content.length > 2000) {
        throw new Error("증빙은 20~2000자로 작성해 주세요.");
      }

      if (
        !window.confirm(
          "증거 기록을 추가할까요? 기존 기록은 수정하거나 삭제할 수 없습니다."
        )
      ) {
        return;
      }

      const { data, error: rpcError } =
        await createClient().rpc(
          "hoo_trading_contest_admin_record_evidence_v1",
          {
            p_contest_id: id,
            p_check_key: checkKey,
            p_evidence_detail: content,
          }
        );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const saved = data as { success?: boolean } | null;

      if (saved?.success !== true) {
        throw new Error("증거 기록 응답이 올바르지 않습니다.");
      }

      setDetail("");

      // 실제 변경 이후에만 목록 1회 갱신
      setEntries(await fetchEvidence(id));
      setLoaded(true);

      setMessage(
        "증거 기록 완료. 공식 검증 완료를 의미하지 않습니다."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "기록 실패"
      );
    } finally {
      setBusy(false);
    }
  }

  function checkLabel(key: string) {
    return (
      checkOptions.find((item) => item.value === key)?.label ??
      key
    );
  }

  return (
    <section className="mx-auto mt-5 w-full rounded-2xl border border-white/20 bg-neutral-900 p-5 text-white sm:w-[80%]">
      <h3 className="text-lg font-bold">
        HOO CONTEST 검증 증거 관리
      </h3>

      <p className="mt-2 text-sm text-neutral-300">
        포지션·기준자본·거래 시각·ROI·후보 순위의
        검증 근거를 기록하고 조회합니다.
        증거 등록은 공식 승인이 아닙니다.
      </p>

      <div className="mt-4 space-y-4">
        <label className="block text-sm">
          대회 UUID
          <input
            value={contestId}
            disabled={busy}
            onChange={(event) => {
              setContestId(event.target.value);
              setEntries([]);
              setLoaded(false);
              setMessage("");
              setError("");
            }}
            placeholder="대회 UUID 입력"
            className="mt-2 w-full rounded-lg border border-white/20 bg-black/40 p-3"
          />
        </label>

        <label className="block text-sm">
          검증 항목
          <select
            value={checkKey}
            disabled={busy}
            onChange={(event) => setCheckKey(event.target.value)}
            className="mt-2 w-full rounded-lg border border-white/20 bg-neutral-800 p-3"
          >
            {checkOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          검증 증거 (20~2000자)
          <textarea
            value={detail}
            disabled={busy || !writeEnabled}
            maxLength={2000}
            onChange={(event) => setDetail(event.target.value)}
            rows={5}
            placeholder="검증 방법, 사용 자료, 계산 결과, 확인 근거를 작성하세요."
            className="mt-2 w-full rounded-lg border border-white/20 bg-black/40 p-3 disabled:opacity-50"
          />
          <span className="mt-1 block text-right text-xs text-neutral-400">
            {detail.trim().length} / 2000자
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadEvidence()}
            disabled={busy || !contestId.trim()}
            className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            증거 기록 조회
          </button>

          <button
            type="button"
            onClick={() => void saveEvidence()}
            disabled={
              busy ||
              !writeEnabled ||
              !contestId.trim() ||
              detail.trim().length < 20
            }
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            증거 기록 추가
          </button>
        </div>

        {!writeEnabled && (
          <p className="text-xs text-amber-300">
            증거 기록 기능은 현재 잠겨 있습니다.
            조회만 가능합니다.
          </p>
        )}

        <div aria-live="polite">
          {error && (
            <p className="text-sm text-red-300">{error}</p>
          )}
          {message && (
            <p className="text-sm text-green-300">{message}</p>
          )}
        </div>

        {/* HOO_CONTEST_EVIDENCE_COVERAGE_V1 */}
        {loaded && (
          <div className="rounded-xl border border-white/15 bg-black/20 p-4">
            <h4 className="mb-3 text-sm font-bold">
              검증 항목별 증거 현황
            </h4>

            <div className="space-y-2">
              {checkOptions.map((item) => {
                const count = entries.filter(
                  (entry) => entry.check_key === item.value
                ).length;

                return (
                  <div
                    key={item.value}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 py-2 text-sm"
                  >
                    <span>{item.label}</span>
                    <span
                      className={
                        count > 0
                          ? "text-amber-300"
                          : "text-red-300"
                      }
                    >
                      {count > 0
                        ? `기록 ${count}건 · 미검증`
                        : "증거 없음"}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-neutral-400">
              증거 기록 여부만 확인합니다.
              실제 검증 통과, 공식 승인 및 상금 지급을
              허용하지 않습니다.
            </p>
          </div>
        )}
        {entries.length > 0 && (
          <div className="space-y-3 border-t border-white/15 pt-4">
            <h4 className="font-semibold">
              증거 기록 ({entries.length}건)
            </h4>

            {entries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-xl border border-white/15 bg-black/20 p-3 text-sm"
              >
                <p className="font-semibold">
                  {checkLabel(entry.check_key)}
                </p>

                <p className="mt-1 text-xs text-amber-300">
                  {entry.verification_status}
                </p>

                <p className="mt-3 whitespace-pre-wrap break-words">
                  {entry.evidence_detail}
                </p>

                <p className="mt-3 text-xs text-neutral-400">
                  기록 #{entry.id} ·{" "}
                  {new Date(entry.recorded_at).toLocaleString("ko-KR")}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
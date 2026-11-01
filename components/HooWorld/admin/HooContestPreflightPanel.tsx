"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type PreflightResult = {
  success?: boolean;
  reason?: string;
  contest_status?: string;
  candidate_count?: number;
  pending_count?: number;
  rejected_count?: number;
  verified_count?: number;
  score_mismatch_count?: number;
  structural_pass?: boolean;
  blockers?: string[];
  manual_evidence_required?: boolean;
  objective_audit?: {
    success?: boolean;
    position_linkage?: { structural_ok?: boolean };
    entry_baseline?: { structural_ok?: boolean };
    trade_timing?: { structural_ok?: boolean };
    roi_formula?: { arithmetic_ok?: boolean };
    candidate_results?: { structural_ok?: boolean };
  };
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function HooContestPreflightPanel() {
  const [contestId, setContestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [error, setError] = useState("");

  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const id = contestId.trim();

    setResult(null);
    setError("");

    if (!uuidPattern.test(id)) {
      setError("올바른 대회 UUID를 입력해 주세요.");
      return;
    }

    setBusy(true);

    try {
      const { data, error: rpcError } =
        await createClient().rpc(
          "hoo_trading_contest_admin_preflight_v2",
          { p_contest_id: id }
        );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
      ) {
        throw new Error("사전심사 응답 형식이 올바르지 않습니다.");
      }

      setResult(data as PreflightResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "사전심사 요청에 실패했습니다."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-white/20 bg-neutral-900 p-5 text-white">
      <h3 className="text-lg font-bold">
        HOO CONTEST 공식 결과 사전심사
      </h3>

      <p className="mt-2 text-sm text-neutral-300">
        읽기 전용 점검입니다. 공식 승인, 결과 수정,
        포지션 청산, 상금 지급은 실행하지 않습니다.
      </p>

      <form onSubmit={inspect} className="mt-4 space-y-3">
        <label className="block text-sm">
          대회 ID (UUID)
          <input
            type="text"
            value={contestId}
            onChange={(event) => {
              setContestId(event.target.value);
              setResult(null);
              setError("");
            }}
            placeholder="대회 UUID 입력"
            className="mt-2 w-full rounded-lg border border-white/20 bg-black/40 p-3 text-white"
            autoComplete="off"
          />
        </label>

        <button
          type="submit"
          disabled={busy || !contestId.trim()}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "검사 중..." : "공식 결과 사전심사 실행"}
        </button>
      </form>

      <div aria-live="polite">
        {error && (
          <p className="mt-4 text-sm text-red-300">
            검사 오류: {error}
          </p>
        )}

        {result && (
          <div className="mt-5 space-y-3 rounded-xl border border-white/15 p-4 text-sm">
            <p className="font-semibold">
              구조 검증:{" "}
              {result.structural_pass === true
                ? "PASS (구조 검사 통과)"
                : "BLOCKED / 미검증"}
            </p>

            {result.reason && (
              <p>사유: {result.reason}</p>
            )}

            <p>대회 상태: {result.contest_status ?? "-"}</p>
            {/* HOO_CONTEST_OBJECTIVE_AUDIT_UI_V1 */}
            {result.objective_audit?.success === true && (
              <div className="mt-4 space-y-2 rounded-xl border border-white/15 p-4">
                <h4 className="font-bold">5개 자동 무결성 검사</h4>

                <p>포지션 연결: {result.objective_audit.position_linkage?.structural_ok === true ? "구조 통과" : "검토 필요"}</p>
                <p>기준자본: {result.objective_audit.entry_baseline?.structural_ok === true ? "구조 통과" : "검토 필요"}</p>
                <p>거래 시각: {result.objective_audit.trade_timing?.structural_ok === true ? "구조 통과" : "검토 필요"}</p>
                <p>ROI 산술: {result.objective_audit.roi_formula?.arithmetic_ok === true ? "산술 통과" : "검토 필요"}</p>
                <p>TOP20 후보: {result.objective_audit.candidate_results?.structural_ok === true ? "구조 통과" : "검토 필요"}</p>

                <p className="pt-3 text-xs text-amber-300">
                  구조 검사는 공식 승인이나 실제 ROI 인증을 의미하지 않습니다.
                </p>
              </div>
            )}
            <p>후보 수: {result.candidate_count ?? "-"}</p>
            <p>검토 대기: {result.pending_count ?? "-"}</p>
            <p>반려: {result.rejected_count ?? "-"}</p>
            <p>승인 기록: {result.verified_count ?? "-"}</p>
            <p>
              점수 불일치: {result.score_mismatch_count ?? "-"}
            </p>

            {Array.isArray(result.blockers) &&
              result.blockers.length > 0 && (
                <div>
                  <p className="font-semibold text-amber-300">
                    차단 사유
                  </p>
                  <ul className="mt-2 list-disc pl-5">
                    {result.blockers.map((item, index) => (
                      <li key={`${item}-${index}`}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <p className="border-t border-white/15 pt-3 text-xs text-neutral-400">
              이 검사 통과는 공식 승인이나 ROI
              종단간 검증 완료를 의미하지 않습니다.
              승인 증거는 별도로 확인해야 합니다.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HooContestPoster from "@/components/HooContestPoster";
import {
  toContestInstant,
  type ContestPosterData,
} from "@/lib/hooContestPoster";
import styles from "./HooContestAdminPreview.module.css";

/**
 * ADMIN PREVIEW ADAPTER
 * - Reads the EXISTING creation form only when the admin presses Apply.
 * - Renders an always-visible poster, without fetching, polling or writing to DB.
 * - The bottom create button delegates to the EXISTING create handler, preserving
 *   its disabled state, server-side authorization and API implementation.
 * - If the expected legacy form isn't found, actions fail closed.
 */
const INITIAL: ContestPosterData = {
  title: "제1회 HOO TRADING CONTEST",
  startsAt: null,
  endsAt: null,
  prizesHoo: { first: 0, second: 0, third: 0 },
  phase: "draft",
};

type FormElements = {
  title: HTMLInputElement;
  start: HTMLInputElement;
  end: HTMLInputElement;
  prizes: [HTMLInputElement, HTMLInputElement, HTMLInputElement];
};

function normalize(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, "").trim();
}

function findCreateHost(): HTMLElement | null {
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,strong,b,div,span")
  );
  const heading = headings.find((node) => normalize(node.textContent) === "1.대회생성");
  if (!heading) return null;
  let current: HTMLElement | null = heading;
  while (current && current !== document.body) {
    if (
      current.querySelectorAll('input[type="datetime-local"]').length >= 2 &&
      current.querySelectorAll('input[type="number"]').length >= 3
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function getFields(host: HTMLElement): FormElements | null {
  const dates = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]'));
  const numbers = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="number"]'));
  if (dates.length < 2 || numbers.length < 3) return null;

  const all = Array.from(host.querySelectorAll<HTMLInputElement>("input"));
  const firstDateIndex = all.indexOf(dates[0]);
  const earlierInputs = all.slice(0, firstDateIndex);
  const title = earlierInputs.find((el) =>
    (el.type === "text" || !el.getAttribute("type")) && !el.disabled
  );
  if (!title) return null;
  return {
    title,
    start: dates[0],
    end: dates[1],
    prizes: [numbers[0], numbers[1], numbers[2]],
  };
}

function readDraft(host: HTMLElement): { value?: ContestPosterData; error?: string } {
  const fields = getFields(host);
  if (!fields) return { error: "기존 대회 생성 입력 필드 6개를 확인하지 못했습니다." };
  const title = fields.title.value.trim();
  if (!title || title.length > 80) return { error: "대회 제목을 1~80자로 입력해 주세요." };
  const startsAt = fields.start.value || null;
  const endsAt = fields.end.value || null;
  const start = toContestInstant(startsAt);
  const end = toContestInstant(endsAt);
  if (!start || !end) return { error: "대회 시작·종료 일시를 모두 선택해 주세요." };
  if (end.getTime() <= start.getTime()) return { error: "종료 일시는 시작 일시보다 늦어야 합니다." };
  const prizes = fields.prizes.map((field) =>
    field.value.trim() === "" ? NaN : Number(field.value)
  );
  if (prizes.some((n) => !Number.isSafeInteger(n) || n < 0)) {
    return { error: "1~3등 상금은 0 이상의 정수로 입력해 주세요." };
  }
  return {
    value: {
      title,
      startsAt,
      endsAt,
      prizesHoo: { first: prizes[0], second: prizes[1], third: prizes[2] },
      // Preview only, never claim a contest has started without server confirmation.
      phase: "scheduled",
    },
  };
}

function originalCreateButton(host: HTMLElement): HTMLButtonElement | null {
  const matches = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).filter(
    (button) => normalize(button.textContent) === "대회생성"
  );
  return matches.length === 1 ? matches[0] : null;
}

export default function HooContestAdminPreview() {
  const [poster, setPoster] = useState<ContestPosterData>(INITIAL);
  const [applied, setApplied] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const hostRef = useRef<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const host = findCreateHost();
    hostRef.current = host;
    if (!host) {
      setError("기존 대회 생성 양식을 찾지 못했습니다. 데이터 저장은 차단됩니다.");
      return;
    }
    const original = originalCreateButton(host);
    buttonRef.current = original;
    if (!original) {
      setError("기존 대회 생성 버튼을 찾지 못했습니다. 데이터 저장은 차단됩니다.");
      return;
    }
    // Retain the actual button and handler. Only move the visual action below poster.
    const previousDisplay = original.style.display;
    original.style.display = "none";
    setCanCreate(!original.disabled);

    const onInput = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement)) return;
      const fields = getFields(host);
      if (!fields || ![
        fields.title, fields.start, fields.end, ...fields.prizes,
      ].includes(event.target)) return;
      setDirty(true);
      setNotice("");
    };
    host.addEventListener("input", onInput);
    host.addEventListener("change", onInput);
    const observer = new MutationObserver(() => setCanCreate(!original.disabled));
    observer.observe(original, { attributes: true, attributeFilter: ["disabled"] });
    return () => {
      host.removeEventListener("input", onInput);
      host.removeEventListener("change", onInput);
      observer.disconnect();
      original.style.display = previousDisplay;
      buttonRef.current = null;
      hostRef.current = null;
    };
  }, []);

  const apply = useCallback(() => {
    const host = hostRef.current;
    if (!host) return setError("기존 대회 생성 양식을 확인할 수 없습니다.");
    const draft = readDraft(host);
    if (!draft.value) return setError(draft.error ?? "입력 내용을 확인해 주세요.");
    setPoster(draft.value);
    setApplied(true);
    setDirty(false);
    setError("");
    setNotice("포스터에 입력 내용을 반영했습니다. 서버에는 아직 저장하지 않았습니다.");
  }, []);

  const create = useCallback(() => {
    const host = hostRef.current;
    const button = buttonRef.current;
    if (!host || !button || !host.contains(button)) {
      return setError("기존 대회 생성 기능을 확인할 수 없어 요청을 중단했습니다.");
    }
    const current = readDraft(host);
    if (!current.value) return setError(current.error ?? "입력을 확인해 주세요.");
    if (!applied || dirty || JSON.stringify(current.value) !== JSON.stringify(poster)) {
      return setError("변경된 내용을 먼저 '반영하기'로 포스터에 적용해 주세요.");
    }
    if (button.disabled) {
      return setError("기존 대회 생성 기능이 비활성화되어 있습니다. 운영자 권한·DB 쓰기 게이트를 확인해 주세요.");
    }
    const form = button.form;

    if (!form) {
      setError("기존 대회 생성 폼을 찾을 수 없습니다.");
      return;
    }

    if (!form.reportValidity()) {
      setError("대회 입력값을 확인해 주세요.");
      return;
    }

    setError("");

    // 기존 React onSubmit -> createContest -> Supabase RPC 실행.
    // 관리자 권한과 DB 쓰기 제한은 그대로 적용.
    form.requestSubmit();

    setNotice("대회 생성 요청을 제출했습니다. 실제 처리 결과는 관리자 메시지에서 확인해 주세요.");
  }, [applied, dirty, poster]);

  return (
    <section className={styles.panel} aria-label="대회 생성 포스터 미리보기">
      <div className={styles.head}>
        <div>
          <h3>대회 포스터 미리보기</h3>
          <p>설산 기본 이미지는 항상 표시됩니다. 작성한 정보를 반영한 후 대회를 생성하세요.</p>
        </div>
        <span className={styles.tag}>{!applied ? "미반영" : dirty ? "수정 사항 미반영" : "미리보기 반영 완료"}</span>
      </div>
      <button type="button" className={styles.apply} onClick={apply}>반영하기</button>
      <div className={styles.posterWrap}>
        <HooContestPoster contest={poster} />
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!error && notice && <p className={styles.notice} role="status">{notice}</p>}
      <div className={styles.footer}>
        <div className={styles.help}>반영이 완료되면 생성 버튼이 활성화됩니다. 실제 생성 요청은 기존 관리자 권한·DB 쓰기 게이트를 통과해야 합니다.</div>
        <button
          type="button"
          className={styles.create}
          disabled={!applied || dirty}
          title={!canCreate ? "관리자 DB 쓰기 게이트가 꺼져 있으면 실제 생성은 차단됩니다." : undefined}
          onClick={create}
        >대회 생성</button>
      </div>
    </section>
  );
}

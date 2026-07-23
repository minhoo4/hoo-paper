import {
  HOO_MEMO_STORAGE_KEY,
} from "../constants/focus";
import type {
  HooMemo,
} from "../types/focus";

export function saveHooMemo(memo: HooMemo) {
  const savedMemos =
    window.localStorage.getItem(
      HOO_MEMO_STORAGE_KEY,
    );

  const parsedMemos: HooMemo[] = savedMemos
    ? JSON.parse(savedMemos)
    : [];

  const nextMemos = [memo, ...parsedMemos];

  window.localStorage.setItem(
    HOO_MEMO_STORAGE_KEY,
    JSON.stringify(nextMemos),
  );

  window.dispatchEvent(
    new CustomEvent("hoo-memos-updated", {
      detail: nextMemos,
    }),
  );
}

export function deleteHooMemo(memoId: string) {
  const savedMemos =
    window.localStorage.getItem(
      HOO_MEMO_STORAGE_KEY,
    );

  const parsedMemos: HooMemo[] = savedMemos
    ? JSON.parse(savedMemos)
    : [];

  const nextMemos = parsedMemos.filter(
    (memo) => memo.id !== memoId,
  );

  window.localStorage.setItem(
    HOO_MEMO_STORAGE_KEY,
    JSON.stringify(nextMemos),
  );

  window.dispatchEvent(
    new CustomEvent("hoo-memos-updated", {
      detail: nextMemos,
    }),
  );
}

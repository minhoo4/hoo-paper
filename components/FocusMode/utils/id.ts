export function createFocusMemoId() {
  if (
    typeof window !== "undefined" &&
    window.crypto?.randomUUID
  ) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

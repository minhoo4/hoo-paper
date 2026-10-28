/* HOO-CHANGE-0002: display-only cache, never used to approve a donation. */
export function parseStallTotal(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^(0|[1-9]\d*)$/.test(value)) return null;
  const total = Number(value);
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

/**
 * Updates from donations and Realtime can arrive out of order. With no
 * verified server revision, a lower pushed total is ambiguous (stale event or
 * administrator reset). Invalidate rather than silently going backwards.
 * An explicit server read may authoritatively resolve a legitimate reset.
 */
export class StallTotalCache {
  private value: number | null = null;
  private dirty = true;
  private epoch = 0;

  snapshot() { return { total: this.value, dirty: this.dirty, epoch: this.epoch }; }
  beginRead(): number { return this.epoch; }
  invalidate(): void { this.dirty = true; this.epoch++; }

  acceptPush(raw: unknown): 'accepted' | 'stale' | 'invalid' {
    const next = parseStallTotal(raw);
    if (next === null) { this.invalidate(); return 'invalid'; }
    if (this.value !== null && next < this.value) {
      this.invalidate(); return 'stale';
    }
    if (this.value === next && !this.dirty) return 'accepted';
    this.value = next;
    this.dirty = false;
    this.epoch++;
    return 'accepted';
  }

  acceptRead(raw: unknown, startedAt: number): 'accepted' | 'outdated' | 'invalid' {
    if (startedAt !== this.epoch) return 'outdated';
    const next = parseStallTotal(raw);
    if (next === null) { this.invalidate(); return 'invalid'; }
    this.value = next; // direct server read can confirm a reset
    this.dirty = false;
    this.epoch++;
    return 'accepted';
  }
}

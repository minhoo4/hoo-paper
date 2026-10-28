/* HOO-CHANGE-0001: display synchronization only. Never authorizes spending. */
export type WalletDependencies = {
  readWallet: (userId: string) => Promise<number>;
  readOpenPositionCount: (userId: string) => Promise<number>;
  onBalance: (userId: string, balance: number) => void;
};

const QUIET_MS = 60_000;
function safeBalance(input: number): number {
  if (!Number.isFinite(input) || input < 0) throw new Error('INVALID_HOO_WALLET_BALANCE');
  return input;
}
function safeCount(input: number): number {
  if (!Number.isSafeInteger(input) || input < 0) throw new Error('INVALID_HOO_POSITION_COUNT');
  return input;
}

export class HooWalletSync {
  private userId: string | null = null;
  private balance: number | null = null;
  private openPositions: number | null = null;
  private pending = false;
  private lastChange = 0;
  private epoch = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private disposed = false;
  private channel: BroadcastChannel | null = null;

  constructor(private readonly dependencies: WalletDependencies) {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('hoo:wallet-invalidation:v1');
        this.channel.onmessage = (event: MessageEvent) => {
          const data = event.data as { userId?: unknown; type?: unknown } | null;
          if (data?.type === 'wallet-changed' && data.userId === this.userId) {
            this.invalidate(this.userId!, false);
          }
        };
      } catch { this.channel = null; }
    }
  }

  setUser(userId: string | null) {
    if (this.disposed || userId === this.userId) return;
    this.stopTimer();
    this.epoch++;
    this.userId = userId;
    this.balance = null;
    this.openPositions = null;
    this.pending = false;
    this.lastChange = 0;
    // In-flight reads check both the epoch and the UID before publishing.
  }

  acceptInitial(userId: string, confirmedBalance: number) {
    if (this.disposed || userId !== this.userId || this.pending || this.balance !== null) return;
    this.balance = safeBalance(confirmedBalance);
    this.dependencies.onBalance(userId, this.balance);
  }

  commit(userId: string, confirmedBalance: number) {
    if (this.disposed || userId !== this.userId) return;
    const next = safeBalance(confirmedBalance);
    if (this.balance === next) return; // Duplicate event: no timer reset.
    this.balance = next;
    this.dependencies.onBalance(userId, next);
    this.invalidate(userId, true);
  }

  reportPositions(userId: string, confirmedCount: number) {
    if (this.disposed || this.userId !== userId) return;
    const next = safeCount(confirmedCount);
    const wasOpen = this.openPositions !== null && this.openPositions > 0;
    this.openPositions = next;
    if (next > 0) {
      this.stopTimer(); // No wallet SELECT while a position is open.
      return;
    }
    if (wasOpen) {
      // Last position was verified closed; wait a full 60s even if P&L is unchanged.
      this.pending = true;
      this.lastChange = Date.now();
      this.epoch++;
    }
    this.schedule();
  }

  invalidate(userId: string, publish = false) {
    if (this.disposed || userId !== this.userId) return;
    this.pending = true;
    this.lastChange = Date.now();
    this.epoch++;
    this.schedule();
    if (publish) {
      try { this.channel?.postMessage({ type: 'wallet-changed', userId }); } catch {}
    }
  }

  // Only resumes a pending verification; never establishes a recurring poll.
  resume() { if (!this.disposed && this.pending) this.schedule(); }

  private stopTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule() {
    this.stopTimer();
    if (this.disposed || !this.userId || !this.pending || this.openPositions !== 0 && this.openPositions !== null) return;
    if (this.running) return; // A running check will schedule new changes in finally.
    const wait = Math.max(0, this.lastChange + QUIET_MS - Date.now());
    this.timer = setTimeout(() => { this.timer = null; void this.verify(); }, wait);
  }

  private async verify() {
    if (this.disposed || this.running || !this.pending || !this.userId ||
        this.openPositions !== null && this.openPositions !== 0) return;
    const uid = this.userId;
    const version = this.epoch;
    this.running = true;
    try {
      if (this.openPositions === null) {
        const count = safeCount(await this.dependencies.readOpenPositionCount(uid));
        if (version !== this.epoch || uid !== this.userId || this.disposed) return;
        this.openPositions = count;
        if (count > 0) return; // Wait for a server-confirmed final close.
      }
      const next = safeBalance(await this.dependencies.readWallet(uid));
      if (version !== this.epoch || uid !== this.userId || this.disposed) return;
      this.balance = next;
      this.pending = false;
      this.dependencies.onBalance(uid, next);
    } catch (error) {
      // No runaway retry. A subsequent user action / reconnect may invalidate again.
      if (version === this.epoch) {
        this.pending = false;
        console.warn('HOO wallet one-time verification deferred', error);
      }
    } finally {
      this.running = false;
      // A new change while the request was running supersedes the old result.
      if (this.pending && version !== this.epoch) this.schedule();
    }
  }

  dispose() {
    this.disposed = true;
    this.stopTimer();
    this.epoch++;
    this.channel?.close();
    this.channel = null;
  }
}

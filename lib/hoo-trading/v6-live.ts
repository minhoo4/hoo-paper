/** HOO P2: V6 live OHLCV bridge. Rebase-aware anchor handling; no auto-reset. */
import 'server-only';
import { randomUUID } from 'node:crypto';
import { V6Engine, type Checkpoint } from './v6-engine';
import type { SupabaseClient } from '@supabase/supabase-js';
import { marketSecond } from './market';

// The engine sources (v6-engine, v6-shocks, v6-patterns, v6-random) are UNCHANGED.
export const APPROVED_V6_SOURCE_DIGEST = 'a09600c5d837780c7b9fb2f1e3b1a9e461c82816ee18cee53c9556e596ce1c9c';
export const V6_ANCHORS = { HOO: 58_000_000, EGG: 12_500_000, COAL: 4_000_000 } as const;
export type V6PriceAnchors = { HOO: number; EGG: number; COAL: number };

type V6Stream = {
  mode: string;
  start_second: number|string;
  last_second: number|string;
  build_digest: string;
  checkpoint: Checkpoint;
  anchor_prices: Record<string, unknown> | null;
};

const secret = (): string => {
  const value = process.env.HOO_MARKET_SECRET;
  if (!value || value.length < 24) throw new Error('V6_PRIVATE_MARKET_SECRET_REQUIRED');
  return value;
};

export function validateV6Anchors(input: unknown): V6PriceAnchors {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('V6_ANCHOR_MISSING');
  const p = input as Record<string, unknown>;
  const prices = { HOO: Number(p.HOO), EGG: Number(p.EGG), COAL: Number(p.COAL) };
  if (Object.keys(prices).some(s => !(prices[s as keyof V6PriceAnchors] > 0)
      || !Number.isFinite(prices[s as keyof V6PriceAnchors])))
    throw new Error('V6_ANCHOR_INVALID');
  return prices;
}

function makeEngine(startSecond: number, checkpoint?: Checkpoint,
                    prices: V6PriceAnchors = V6_ANCHORS): V6Engine {
  return new V6Engine({
    buildDigest: APPROVED_V6_SOURCE_DIGEST,
    secret: secret(), startSecond, prices, checkpoint
  });
}

export function createV6Anchor(second: number): Checkpoint {
  if (!Number.isSafeInteger(second)) throw new Error('V6_INVALID_ANCHOR_TIME');
  return makeEngine(second).checkpoint();
}

function parsedStream(value: unknown): {
  last: number; start: number; checkpoint: Checkpoint; prices: V6PriceAnchors;
} {
  const r = value as V6Stream;
  if (!r || r.mode !== 'active' || r.build_digest !== APPROVED_V6_SOURCE_DIGEST)
    throw new Error('V6_ENGINE_VERSION_MISMATCH');
  const start = Number(r.start_second), last = Number(r.last_second);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(last) || last < start ||
      !r.checkpoint || Number(r.checkpoint.second) !== last)
    throw new Error('V6_CHECKPOINT_UNTRUSTED');
  // Null is NOT silently interpreted as the original anchor: migration must be present.
  return { start, last, checkpoint: r.checkpoint, prices: validateV6Anchors(r.anchor_prices) };
}

/** Replay unsaved minutes, never silently skip or rewrite traded OHLCV. */
export async function catchUpV6(db: SupabaseClient, maxTicks: number): Promise<{
  caughtUp: boolean; remaining: number; lastSecond: number;
}> {
  const leaseToken = randomUUID();
  const lease = await db.rpc('hootrading_v6_try_lease', { p_token: leaseToken });
  if (lease.error) throw new Error(`V6_LEASE_FAILED:${lease.error.message}`);

  if (lease.data !== true) {
    const { data, error } = await db.from('hootrading_v6_stream')
      .select('last_second').eq('id', 1).single();
    if (error) throw new Error(`V6_CLOCK_FAILED:${error.message}`);
    const last = Number(data.last_second), target = marketSecond();
    if (!Number.isSafeInteger(last) || last < 0 || last > target + 2)
      throw new Error('V6_INVALID_CLOCK');
    return { caughtUp: last >= target - 1,
      remaining: Math.max(0, target - last), lastSecond: last };
  }

  try {
    const budget = Math.min(720, Math.max(1, Math.trunc(maxTicks)));
    const deadline = Date.now() + 5000;
    let produced = 0, completed = 0;
    while (produced < budget && Date.now() < deadline) {
      const { data, error } = await db.from('hootrading_v6_stream')
        .select('mode,start_second,last_second,build_digest,checkpoint,anchor_prices')
        .eq('id', 1).single();
      if (error) throw new Error(`V6_LOAD_FAILED:${error.message}`);
      const row = parsedStream(data);
      const target = marketSecond();
      if (row.last >= target - 1) { completed = row.last; break; }
      const count = Math.min(45, budget - produced, Math.max(0, target - row.last));
      if (count < 1) { completed = row.last; break; }
      // CRITICAL: Rebase epochs must use their STORED starting anchors, not V6_ANCHORS.
      const engine = makeEngine(row.start, row.checkpoint, row.prices);
      const batch: Array<{ second: number; quotes: Record<string, unknown> }> = [];
      for (let k = 0; k < count; k++) {
        const quote = engine.next();
        batch.push({ second: engine.second, quotes: quote });
      }
      const next = engine.checkpoint();
      const result = await db.rpc('hootrading_v6_advance_atomic', {
        p_expected_second: row.last, p_batch: batch, p_checkpoint: next
      });
      if (result.error) {
        if (result.error.message.includes('V6_REPLAY_CONFLICT')) continue;
        throw new Error(`V6_ADVANCE_FAILED:${result.error.message}`);
      }
      const accepted = Number(result.data);
      if (!Number.isSafeInteger(accepted) || accepted !== engine.second)
        throw new Error('V6_COMMIT_MISMATCH');
      completed = accepted;
      produced += count;
    }
    const target = marketSecond();
    if (completed === 0) {
      const { data, error } = await db.from('hootrading_v6_stream')
        .select('last_second').eq('id', 1).single();
      if (error) throw new Error(`V6_CLOCK_FAILED:${error.message}`);
      completed = Number(data.last_second);
    }
    return { caughtUp: completed >= target - 1,
      remaining: Math.max(0, target - completed), lastSecond: completed };
  } finally {
    const { error } = await db.rpc('hootrading_v6_release_lease', { p_token: leaseToken });
    if (error) console.error('V6_LEASE_RELEASE_FAILED', error.message);
  }
}

One-shot, explicit admin-armed recovery for a stalled V6 market.
 * Invoked by authenticated Vercel cron only. Does not unlock the economy.
 * No checkpoint/secret is emitted in responses or logs.
 */
import 'server-only';
import { V6Engine } from './v6-engine';
import { APPROVED_V6_SOURCE_DIGEST, validateV6Anchors } from './v6-live';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function applyArmedV6Rebase(db: SupabaseClient): Promise<
  { applied: false } | { applied: true; fromSecond: number; toSecond: number }
> {
  const preview = await db.rpc('hootrading_v6_rebase_armed');
  if (preview.error) throw new Error(`V6_REBASE_PREVIEW_FAILED:${preview.error.message}`);
  if (preview.data == null) return { applied: false };
  const state = preview.data as {
    last_second: number|string; build_digest: string; prices: Record<string,unknown>;
  };
  const last = Number(state.last_second);
  if (!Number.isSafeInteger(last) || state.build_digest !== APPROVED_V6_SOURCE_DIGEST)
    throw new Error('V6_REBASE_PREVIEW_INVALID');
  const prices = validateV6Anchors(state.prices);
  const now = Math.floor(Date.now() / 1000);
  if (!(now - last > 60)) throw new Error('V6_REBASE_NOT_STALE');
  const secret = process.env.HOO_MARKET_SECRET;
  if (!secret || secret.length < 24) throw new Error('V6_PRIVATE_MARKET_SECRET_REQUIRED');
  const settings = {
    secret, buildDigest: APPROVED_V6_SOURCE_DIGEST,
    startSecond: now, prices
  };
  const checkpoint = new V6Engine(settings).checkpoint();
  // Verify from checkpoint with the same engine code/secret; SQL cannot access the secret.
  new V6Engine({ ...settings, checkpoint });

  const result = await db.rpc('hootrading_v6_rebase_atomic', {
    p_expected_second: last,
    p_new_second: now,
    p_anchor_prices: prices,
    p_checkpoint: checkpoint
  });
  if (result.error) throw new Error(`V6_REBASE_COMMIT_FAILED:${result.error.message}`);
  if (result.data?.ok !== true || Number(result.data?.oldSecond) !== last ||
      Number(result.data?.newSecond) !== now)
    throw new Error('V6_REBASE_RESPONSE_INVALID');
  return { applied: true, fromSecond: last, toSecond: now };
}

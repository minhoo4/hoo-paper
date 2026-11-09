/** One-shot price-preserving V6 market rebase. Never modifies the economy gate. */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { V6Engine } from './v6-engine';
import { APPROVED_V6_SOURCE_DIGEST, validateV6Anchors } from './v6-live';
import { marketSecond } from './market';

type ArmedRebase = {
  last_second: number | string;
  build_digest: string;
  prices: Record<string, unknown>;
};

type RebaseResult =
  | { applied: false }
  | { applied: true; fromSecond: number; toSecond: number };

export async function applyArmedV6Rebase(db: SupabaseClient): Promise<RebaseResult> {
  // The DB refuses an unarmed request, changed market clocks and non-service roles.
  const { data, error } = await db.rpc('hootrading_v6_rebase_armed');
  if (error) throw new Error(`V6_REBASE_ARM_CHECK_FAILED:${error.code ?? 'UNKNOWN'}`);
  if (data == null) return { applied: false };

  const armed = data as ArmedRebase;
  const fromSecond = Number(armed.last_second);
  if (!Number.isSafeInteger(fromSecond) ||
      armed.build_digest !== APPROVED_V6_SOURCE_DIGEST) {
    throw new Error('V6_REBASE_ARM_STATE_INVALID');
  }
  const prices = validateV6Anchors(armed.prices);
  const toSecond = marketSecond() - 3;
  if (!Number.isSafeInteger(toSecond) || toSecond <= fromSecond + 60) {
    throw new Error('V6_REBASE_TARGET_INVALID');
  }

  const secret = process.env.HOO_MARKET_SECRET;
  if (!secret || secret.length < 24) throw new Error('V6_PRIVATE_MARKET_SECRET_REQUIRED');

  // A new start second and the preserved prices produce a NEW signed namespace.
  // SQL cannot derive or validate this HMAC namespace without the server secret.
  const options = {
    buildDigest: APPROVED_V6_SOURCE_DIGEST,
    secret,
    startSecond: toSecond,
    prices,
  };
  const checkpoint = new V6Engine(options).checkpoint();
  new V6Engine({ ...options, checkpoint }); // Full V6 checkpoint validation.

  const committed = await db.rpc('hootrading_v6_rebase_atomic', {
    p_expected_second: fromSecond,
    p_new_second: toSecond,
    p_anchor_prices: prices,
    p_checkpoint: checkpoint,
  });
  if (committed.error) {
    throw new Error(`V6_REBASE_COMMIT_FAILED:${committed.error.code ?? 'UNKNOWN'}`);
  }
  if (committed.data?.ok !== true ||
      Number(committed.data.oldSecond) !== fromSecond ||
      Number(committed.data.newSecond) !== toSecond) {
    throw new Error('V6_REBASE_COMMIT_RESPONSE_INVALID');
  }
  return { applied: true, fromSecond, toSecond };
}

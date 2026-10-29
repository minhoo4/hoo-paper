/** HOO V6 market-only fresh reset. Does not open the economy or clear wallets.
 * Requires the previously installed fresh-reset RPCs and a fresh, explicit arm.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { catchUp } from '../../../../lib/hoo-trading/server';
import {
  APPROVED_V6_SOURCE_DIGEST,
  createV6Anchor,
} from '../../../../lib/hoo-trading/v6-live';
import { marketSecond } from '../../../../lib/hoo-trading/market';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('V6_SERVICE_CREDENTIALS_REQUIRED');

    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: pending, error: pendingError } = await db.rpc(
      'hootrading_v6_fresh_reset_pending'
    );
    if (pendingError) throw new Error(`V6_RESET_CHECK_FAILED:${pendingError.message}`);

    if (pending !== null && pending !== undefined) {
      const request = pending as {
        expected_last_second: number | string;
        build_digest: string;
      };
      const expected = Number(request.expected_last_second);
      if (
        !Number.isSafeInteger(expected) ||
        request.build_digest !== APPROVED_V6_SOURCE_DIGEST
      ) {
        throw new Error('V6_RESET_BUILD_OR_CLOCK_MISMATCH');
      }

      const newSecond = marketSecond();
      if (!Number.isSafeInteger(newSecond) || newSecond <= expected + 60) {
        throw new Error('V6_RESET_REQUIRES_STALE_MARKET');
      }

      // This is created server-side. Never expose the checkpoint or market secret.
      const checkpoint = createV6Anchor(newSecond);
      const { data: result, error: resetError } = await db.rpc(
        'hootrading_v6_fresh_reset_atomic',
        {
          p_expected_second: expected,
          p_new_second: newSecond,
          p_checkpoint: checkpoint,
        }
      );
      if (resetError) throw new Error(`V6_RESET_COMMIT_FAILED:${resetError.message}`);
      if (result?.ok !== true || Number(result?.newSecond) !== newSecond) {
        throw new Error('V6_RESET_UNEXPECTED_RESULT');
      }

      // Next cron invocation starts creating new market candles.
      return NextResponse.json(
        { ok: true, marketFreshReset: true, fromSecond: expected,
          toSecond: newSecond, economyStillPaused: true },
        { headers: noStore }
      );
    }

    // Do not replay days of stale candles accidentally while reset is unarmed.
    const { data: stream, error: clockError } = await db
      .from('hootrading_v6_stream')
      .select('last_second')
      .eq('id', 1)
      .single();
    if (clockError || !stream) throw new Error('V6_CLOCK_READ_FAILED');
    const lastSecond = Number(stream.last_second);
    const nowSecond = marketSecond();
    if (!Number.isSafeInteger(lastSecond) || lastSecond > nowSecond + 2) {
      throw new Error('V6_CLOCK_INVALID');
    }
    if (nowSecond - lastSecond > 1800) {
      return NextResponse.json(
        { ok: false, error: 'V6_MARKET_STALE_RESET_NOT_ARMED',
          lagSeconds: nowSecond - lastSecond },
        { status: 409, headers: noStore }
      );
    }

    const clock = await catchUp(720);
    return NextResponse.json({ ok: true, ...clock }, { headers: noStore });
  } catch (error) {
    console.error('HOO V6 cron/reset:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'V6_MARKET_PROCESSING_FAILED' },
      { status: 500, headers: noStore }
    );
  }
}

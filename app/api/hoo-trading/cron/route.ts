/**
 * HOO V6 market cron: one-shot approved fresh reset + controlled recovery.
 *
 * After the reset, if the market is > 30 min behind, we allow catch-up only
 * when the database's service-role-only recovery policy explicitly approves.
 * Economy unlocks, wallet changes and new resets are NOT performed here.
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
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: noStore });
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('V6_SERVICE_CREDENTIALS_REQUIRED');

    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Keep the installed one-shot reset flow intact. A completed reset returns null.
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

      return NextResponse.json(
        {
          ok: true,
          marketFreshReset: true,
          fromSecond: expected,
          toSecond: newSecond,
          economyStillPaused: true,
        },
        { headers: noStore }
      );
    }

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

    const lagSeconds = nowSecond - lastSecond;
    let recoveryAuthorized = false;
    if (lagSeconds > 1800) {
      // Do not raise the global lag limit. Ask the dedicated, tightly gated DB
      // policy, which checks pause, positions, reset audit and max 6h lag.
      const { data: permitted, error: recoveryError } = await db.rpc(
        'hootrading_v6_recovery_permitted',
        { p_expected_second: lastSecond }
      );
      if (recoveryError) {
        throw new Error(`V6_RECOVERY_CHECK_FAILED:${recoveryError.message}`);
      }
      if (permitted !== true) {
        return NextResponse.json(
          {
            ok: false,
            error: 'V6_MARKET_STALE_RECOVERY_NOT_PERMITTED',
            lagSeconds,
          },
          { status: 409, headers: noStore }
        );
      }
      recoveryAuthorized = true;
    }

    const clock = await catchUp(720);
    return NextResponse.json(
      { ok: true, ...clock, recoveryAuthorized },
      { headers: noStore }
    );
  } catch (error) {
    console.error('HOO V6 cron/reset:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'V6_MARKET_PROCESSING_FAILED' },
      { status: 500, headers: noStore }
    );
  }
}

/**
 * Place at: app/api/hoo-trading/advance-second/route.ts
 * HOO V6: guarded 1-second engine advancement for a single trusted worker.
 * This endpoint MUST NOT be added to vercel.json crons or called by browsers.
 * Existing v6-live.ts/catchUpV6, DB lease, checkpoint, atomic RPC, order,
 * settlement, and the original minute cron stay unchanged.
 */
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { admin } from '../../../../lib/hoo-trading/server';
import { catchUpV6 } from '../../../../lib/hoo-trading/v6-live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const headers = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'X-Content-Type-Options': 'nosniff',
};

function authorized(request: Request): boolean {
  const secret = process.env.HOO_V6_1S_WORKER_SECRET;
  if (!secret || secret.length < 32) return false;
  const supplied = request.headers.get('authorization');
  if (!supplied?.startsWith('Bearer ')) return false;
  const expected = Buffer.from(secret, 'utf8');
  const actual = Buffer.from(supplied.slice(7), 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  // Both conditions must hold. Not enabled by merely deploying the file.
  if (process.env.HOO_V6_1S_ENABLE !== '1') {
    return NextResponse.json({ error: 'SECOND_WORKER_DISABLED' }, { status: 503, headers });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers });
  }

  const started = Date.now();
  try {
    // 45 is a bounded catch-up budget, NOT 45 new future seconds.
    // catchUpV6 advances only to the current real clock, preserving the
    // sequence of all historical ticks and existing automatic liquidation.
    // The DB lease and p_expected_second CAS in the existing functions
    // serialize competing invocations and the old minute cron.
    const result = await catchUpV6(admin(), 45);
    const nowSecond = Math.floor(Date.now() / 1000);
    return NextResponse.json({
      ok: true,
      caughtUp: result.caughtUp,
      remaining: result.remaining,
      lastSecond: result.lastSecond,
      lagSeconds: Math.max(0, nowSecond - result.lastSecond),
      elapsedMs: Date.now() - started,
    }, { headers });
  } catch (error) {
    // No checkpoint/secret/SQL details in public API responses or logs.
    console.error('HOO_V6_1S_ADVANCE_FAILED', error instanceof Error ? error.name : 'UNKNOWN');
    return NextResponse.json({ error: 'SECOND_WORKER_FAILED' }, { status: 503, headers });
  }
}

// GET remains disallowed. No trade user or public read may trigger market writes.

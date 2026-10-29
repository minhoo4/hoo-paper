/** Vercel cron: normal catch-up plus explicitly armed one-shot V6 rebase. */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { catchUp } from '../../../../lib/hoo-trading/server';
import { applyArmedV6Rebase } from '../../../../lib/hoo-trading/v6-rebase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authorized = !!process.env.CRON_SECRET &&
    req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!authorized) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('V6_SERVER_CREDENTIALS_REQUIRED');
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const recovery = await applyArmedV6Rebase(db);
    if (recovery.applied) {
      // Do not perform normal market catch-up in the same request as a rebase.
      return NextResponse.json({ ok: true, marketRebased: true,
        fromSecond: recovery.fromSecond, toSecond: recovery.toSecond },
        { headers: { 'Cache-Control': 'no-store' } });
    }
    const clock = await catchUp(720);
    return NextResponse.json({ ok: true, ...clock },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    // Never log/return checkpoint/entropy/secret, only a generic error marker.
    console.error('HOO_V6_CRON_RECOVERY_ERROR');
    return NextResponse.json({ error: 'market-worker-failed' }, { status: 500 });
  }
}

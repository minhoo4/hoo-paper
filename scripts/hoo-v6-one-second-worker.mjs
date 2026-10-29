
/**
 * Place at: scripts/hoo-v6-one-second-worker.mjs
 * Run ONLY in a persistent Node.js 20+ process (not in Vercel Functions).
 * No Supabase credentials needed here: authenticated Next.js route runs engine.
 * HOO_V6_1S_ENABLE is a server-side endpoint switch, not the worker's command.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const SECRET_ENV = 'HOO_V6_1S_WORKER_SECRET';
const ORIGIN_ENV = 'HOO_V6_1S_ORIGIN';
const URI = '/api/hoo-trading/advance-second';
const SILENT = process.env.HOO_V6_1S_QUIET === '1';

export function workerConfig(env) {
  const secret = env[SECRET_ENV] ?? '';
  if (secret.length < 32) throw Error('MISSING_OR_SHORT_HOO_V6_1S_WORKER_SECRET');
  const input = env[ORIGIN_ENV];
  if (!input) throw Error('MISSING_HOO_V6_1S_ORIGIN');
  const origin = new URL(input);
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' &&
      ['127.0.0.1', 'localhost'].includes(origin.hostname))) {
    throw Error('WORKER_ORIGIN_REQUIRES_HTTPS');
  }
  if (origin.username || origin.password || origin.search || origin.hash ||
      origin.pathname !== '/') throw Error('WORKER_ORIGIN_MUST_BE_BARE_ORIGIN');
  return { origin: origin.origin, secret };
}

export async function tick(config, fetchFn = fetch, timeoutMs = 8000) {
  const response = await fetchFn(config.origin + URI, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.secret}`, 'Cache-Control': 'no-store' },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 401 || response.status === 403)
    throw Error('WORKER_AUTH_DENIED_STOP');
  if (response.status === 404) throw Error('WORKER_ENDPOINT_MISSING_STOP');
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (body.error === 'SECOND_WORKER_DISABLED')
      throw Error('WORKER_DISABLED_STOP');
    throw Error(`WORKER_HTTP_${response.status}`);
  }
  const result = await response.json();
  if (result.ok !== true || !Number.isSafeInteger(result.lastSecond) ||
      !Number.isFinite(result.lagSeconds)) throw Error('WORKER_BAD_RECEIPT');
  return result;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function run(config, { fetchFn = fetch, onLog = console.log,
                                   onError = console.error, signal } = {}) {
  let errors = 0, unhealthy = 0, calls = 0;
  // Safe default: finish a one-minute smoke test and stop automatically.
  // Set HOO_V6_1S_MAX_REQUESTS=0 explicitly for continuous production mode.
  const configuredLimit = process.env.HOO_V6_1S_MAX_REQUESTS ?? '60';
  if (!/^(0|[1-9]\d{0,5})$/.test(configuredLimit))
    throw Error('INVALID_HOO_V6_1S_MAX_REQUESTS');
  const maxRequests = Number(configuredLimit);
  while (!signal?.aborted && (maxRequests === 0 || calls < maxRequests)) {
    // A minute-long cron or another worker may hold the lease.
    // No overlapping local requests; next attempt on a later second.
    const wait = Math.max(1, 1000 - (Date.now() % 1000) + 80);
    await sleep(wait);
    if (signal?.aborted) return;
    try {
      const r = await tick(config, fetchFn);
      errors = 0;
      calls++;
      unhealthy = r.lagSeconds > 10 ? unhealthy + 1 : 0;
      if (!SILENT && (calls % 10 === 0 || r.lagSeconds > 3))
        onLog(`HOO_V6_1S_OK last=${r.lastSecond} lag=${r.lagSeconds}s elapsed=${r.elapsedMs}ms`);
      if (unhealthy >= 12) throw Error('WORKER_LAG_PERSISTENT_STOP');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'UNKNOWN';
      if (message.endsWith('_STOP')) throw e;
      errors++;
      onError(`HOO_V6_1S_ERROR ${message} streak=${errors}`);
      if (errors >= 5) throw Error('WORKER_REPEATED_FAILURE_STOP');
      await sleep(Math.min(5000, errors * 600));
    }
  }
}

async function main() {
  const config = workerConfig(process.env);
  const controller = new AbortController();
  for (const event of ['SIGINT', 'SIGTERM']) {
    process.once(event, () => controller.abort());
  }
  console.log('HOO V6: persistent 1-second worker started; Vercel minute cron untouched.');
  try {
    await run(config, { signal: controller.signal });
    console.log('HOO V6: worker stopped (limit or signal). Existing minute cron remains the fallback.');
  } catch (e) {
    console.error('HOO V6: worker stopped due to', e instanceof Error ? e.message : 'UNKNOWN');
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}


/**
 * HOO V6 guarded five-second market worker.
 * Place at: scripts/hoo-v6-five-second-worker.mjs
 * Start from ONE Node 20+ terminal/process. Do not start the legacy 1s worker.
 * Reuses /api/hoo-trading/advance-second (POST) and the existing DB lease +
 * atomic market advancement. Does not read/write the DB directly.
 *
 * Environment:
 * HOO_V6_1S_WORKER_SECRET = same secret set on Vercel Production
 * HOO_V6_1S_ORIGIN        = https://hoo.ai.kr
 * HOO_V6_5S_MAX_REQUESTS = 12 (default: 12 calls ~ 1 minute, 0 = continuous)
 *
 * The API remains OFF until HOO_V6_1S_ENABLE=1 is set on Vercel and redeployed.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const API_PATH = '/api/hoo-trading/advance-second';
export const INTERVAL_MS = 5_000;
const TIMEOUT_MS = 9_000;

export function configFromEnv(env) {
  const secret = env.HOO_V6_1S_WORKER_SECRET || '';
  if (secret.length < 32) throw new Error('MISSING_OR_SHORT_WORKER_SECRET');
  const rawOrigin = env.HOO_V6_1S_ORIGIN || 'https://hoo.ai.kr';
  let url;
  try { url = new URL(rawOrigin); } catch { throw new Error('INVALID_WORKER_ORIGIN'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search ||
      url.hash || url.pathname !== '/') throw new Error('WORKER_ORIGIN_MUST_BE_HTTPS_ORIGIN');
  const limitText = env.HOO_V6_5S_MAX_REQUESTS ?? '12';
  if (!/^(0|[1-9]\d{0,5})$/.test(limitText)) throw new Error('INVALID_MAX_REQUESTS');
  return { origin: url.origin, secret, maxRequests: Number(limitText) };
}

export async function advanceOnce(config, fetchFn = fetch) {
  const response = await fetchFn(config.origin + API_PATH, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.secret}`,
      'Cache-Control': 'no-store',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 401 || response.status === 403)
    throw new Error('AUTH_DENIED_STOP');
  if (response.status === 404) throw new Error('ADVANCE_ENDPOINT_NOT_DEPLOYED_STOP');
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (payload.error === 'SECOND_WORKER_DISABLED')
      throw new Error('ADVANCE_ENDPOINT_DISABLED_STOP');
    throw new Error(`ADVANCE_HTTP_${response.status}`);
  }
  const receipt = await response.json();
  if (receipt.ok !== true || !Number.isSafeInteger(receipt.lastSecond) ||
      !Number.isFinite(receipt.lagSeconds) || receipt.lagSeconds < 0)
    throw new Error('INVALID_ADVANCE_RECEIPT_STOP');
  return receipt;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runWorker(config, {
  fetchFn = fetch,
  sleepFn = sleep,
  nowFn = Date.now,
  signal,
  onLog = console.log,
  onError = console.error,
} = {}) {
  let successes = 0;
  let consecutiveErrors = 0;
  let staleStreak = 0;
  while (!signal?.aborted && (config.maxRequests === 0 || successes < config.maxRequests)) {
    const startedAt = nowFn();
    try {
      const receipt = await advanceOnce(config, fetchFn);
      successes += 1;
      consecutiveErrors = 0;
      staleStreak = receipt.lagSeconds > 15 ? staleStreak + 1 : 0;
      onLog(`HOO_5S_OK request=${successes} last=${receipt.lastSecond} lag=${receipt.lagSeconds}s elapsed=${receipt.elapsedMs ?? '?'}ms`);
      if (staleStreak >= 3) throw new Error('MARKET_LAG_PERSISTENT_STOP');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      onError(`HOO_5S_ERROR ${message}`);
      if (message.endsWith('_STOP')) throw error;
      consecutiveErrors += 1;
      if (consecutiveErrors >= 3) throw new Error('REPEATED_WORKER_FAILURE_STOP');
    }
    if (signal?.aborted || (config.maxRequests !== 0 && successes >= config.maxRequests)) break;
    // Do not overlap requests. Slow requests postpone the next tick; never burst.
    const pauseMs = Math.max(0, INTERVAL_MS - (nowFn() - startedAt));
    await sleepFn(pauseMs);
  }
  return successes;
}

async function main() {
  const config = configFromEnv(process.env);
  const abort = new AbortController();
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => abort.abort());
  console.log(`HOO V6 5s worker starting; max successful calls=${config.maxRequests || 'continuous'}; 1s worker MUST be stopped.`);
  try {
    const total = await runWorker(config, { signal: abort.signal });
    console.log(`HOO V6 5s worker stopped normally, successful calls=${total}. Existing market cron unchanged.`);
  } catch (error) {
    console.error('HOO V6 5s worker STOPPED:', error instanceof Error ? error.message : 'UNKNOWN');
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

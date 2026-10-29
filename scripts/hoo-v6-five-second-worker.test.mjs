
/** Offline tests. No external HTTP or database calls. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  configFromEnv,
  advanceOnce,
  runWorker,
  INTERVAL_MS
} from './hoo-v6-five-second-worker.mjs';

const baseEnv = {
  HOO_V6_1S_WORKER_SECRET: 'x'.repeat(64),
  HOO_V6_1S_ORIGIN: 'https://hoo.ai.kr',
};

const receipt = {
  ok: true,
  lastSecond: 1793271185,
  lagSeconds: 1,
  elapsedMs: 25
};

const successResponse = () => ({
  ok: true,
  status: 200,
  json: async () => receipt
});

test('default is bounded to 12 5-second calls', () => {
  const c = configFromEnv(baseEnv);
  assert.equal(c.maxRequests, 12);
  assert.equal(INTERVAL_MS, 5000);
});

test('invalid configuration is rejected', () => {
  assert.throws(() => configFromEnv({
    ...baseEnv,
    HOO_V6_1S_WORKER_SECRET: ''
  }));
  assert.throws(() => configFromEnv({
    ...baseEnv,
    HOO_V6_1S_ORIGIN: 'http://hoo.ai.kr'
  }));
  assert.throws(() => configFromEnv({
    ...baseEnv,
    HOO_V6_5S_MAX_REQUESTS: 'infinite'
  }));
});

test('HTTP POST and bearer authorization', async () => {
  let captured;
  const r = await advanceOnce(
    configFromEnv(baseEnv),
    async (url, opt) => {
      captured = { url, opt };
      return successResponse();
    }
  );

  assert.equal(r.lagSeconds, 1);
  assert.equal(
    captured.url,
    'https://hoo.ai.kr/api/hoo-trading/advance-second'
  );
  assert.equal(captured.opt.method, 'POST');
  assert.equal(
    captured.opt.headers.Authorization,
    'Bearer ' + baseEnv.HOO_V6_1S_WORKER_SECRET
  );
});

test('disabled endpoint stops safely', async () => {
  await assert.rejects(
    advanceOnce(configFromEnv(baseEnv), async () => ({
      ok: false,
      status: 503,
      json: async () => ({
        error: 'SECOND_WORKER_DISABLED'
      })
    })),
    /DISABLED_STOP/
  );
});

test('12 calls do not overlap', async () => {
  let active = 0;
  let peak = 0;
  let count = 0;
  const pauses = [];

  const result = await runWorker(configFromEnv(baseEnv), {
    fetchFn: async () => {
      active++;
      peak = Math.max(peak, active);
      count++;
      active--;
      return successResponse();
    },
    sleepFn: async ms => pauses.push(ms),
    nowFn: () => 10000,
    onLog: () => {},
    onError: () => assert.fail('Unexpected error')
  });

  assert.equal(result, 12);
  assert.equal(count, 12);
  assert.equal(peak, 1);
  assert.deepEqual(pauses, Array(11).fill(5000));
});

test('persistent market lag stops worker', async () => {
  await assert.rejects(
    runWorker(configFromEnv(baseEnv), {
      fetchFn: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ...receipt,
          lagSeconds: 20
        })
      }),
      sleepFn: async () => {},
      onLog: () => {},
      onError: () => {}
    }),
    /MARKET_LAG_PERSISTENT_STOP/
  );
});


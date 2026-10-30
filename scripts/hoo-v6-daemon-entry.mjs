import { configFromEnv, runWorker } from './hoo-v6-five-second-worker.mjs';

const controller = new AbortController();
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, () => controller.abort());
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

console.log('HOO 5S daemon initialized');

while (!controller.signal.aborted) {
  if (process.env.HOO_V6_5S_DAEMON_ENABLE !== '1') {
    await sleep(30000);
    continue;
  }

  try {
    const config = configFromEnv({
      ...process.env,
      HOO_V6_5S_MAX_REQUESTS: '0'
    });

    await runWorker(config, {
      signal: controller.signal,
      onLog: () => {}
    });
  } catch (error) {
    console.error('HOO daemon paused:', error.message);
    if (!controller.signal.aborted) await sleep(900000);
  }
}

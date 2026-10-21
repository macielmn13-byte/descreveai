/**
 * Worker de processamento (BullMQ). Rode quantas instâncias quiser:
 *   npm run start:worker
 */
import { Worker } from 'bullmq';
import { getConfig } from './core/config.js';
import { logger } from './core/logger.js';
import { migrate, closeDb } from './core/database.js';
import { QUEUE_NAME, getRedisConnection, closeQueue } from './queue.js';
import { processDocument } from './pipeline.js';

const cfg = getConfig();

if (cfg.QUEUE_MODE !== 'bullmq') {
  logger.error('O worker exige QUEUE_MODE=bullmq (no modo inline o processamento ocorre na API).');
  process.exit(1);
}

if (cfg.DB_AUTO_MIGRATE) await migrate();

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const status = await processDocument(job.data.documentId);
    return { status };
  },
  {
    connection: await getRedisConnection(),
    concurrency: cfg.WORKER_CONCURRENCY,
    lockDuration: cfg.JOB_TIMEOUT_SECONDS * 1000,
    stalledInterval: 60_000,
    maxStalledCount: 2,
  },
);

worker.on('ready', () => logger.info({ concurrency: cfg.WORKER_CONCURRENCY }, 'Worker pronto'));
worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Job falhou'));
worker.on('error', (err) => logger.error({ err: err.message }, 'Erro no worker'));

async function shutdown(signal) {
  logger.info({ signal }, 'Encerrando worker (aguardando jobs em andamento)...');
  await worker.close();
  await closeQueue();
  await closeDb();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

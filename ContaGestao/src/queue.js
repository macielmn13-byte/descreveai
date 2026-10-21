/**
 * Fila de processamento.
 *
 * - bullmq (produção): o upload só registra o documento e enfileira; o
 *   worker (src/worker.js) processa em segundo plano, com Redis.
 * - inline (desenvolvimento/testes): processa na própria requisição, sem
 *   Redis. Não use em produção.
 */
import { getConfig } from './core/config.js';
import { logger } from './core/logger.js';

export const QUEUE_NAME = 'contagestao-documentos';

let queue = null;
let connection = null;

export async function getRedisConnection() {
  if (!connection) {
    const { Redis } = await import('ioredis');
    connection = new Redis(getConfig().REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true });
    connection.on('error', (err) => logger.error({ err: err.message }, 'Erro de conexão com o Redis'));
  }
  return connection;
}

async function getQueue() {
  if (!queue) {
    const { Queue } = await import('bullmq');
    queue = new Queue(QUEUE_NAME, {
      connection: await getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 7 * 24 * 3600, count: 10_000 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    });
  }
  return queue;
}

export async function enqueueProcessing(documentId) {
  if (getConfig().QUEUE_MODE === 'inline') {
    const { processDocument } = await import('./pipeline.js');
    await processDocument(documentId);
    return;
  }
  const q = await getQueue();
  await q.add('processar', { documentId }, { jobId: `${documentId}-${Date.now()}` });
}

export async function checkQueue() {
  if (getConfig().QUEUE_MODE === 'inline') return true;
  try {
    return (await (await getRedisConnection()).ping()) === 'PONG';
  } catch {
    return false;
  }
}

export async function closeQueue() {
  if (queue) await queue.close();
  if (connection) await connection.quit().catch(() => {});
  queue = null;
  connection = null;
}

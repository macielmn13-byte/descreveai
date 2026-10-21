/**
 * Ponto de entrada da API HTTP.
 *   npm start          (produção)
 *   npm run dev        (desenvolvimento, reinicia ao salvar)
 */
import { getConfig } from './core/config.js';
import { logger } from './core/logger.js';
import { migrate, closeDb } from './core/database.js';
import { closeQueue } from './queue.js';
import { createApp } from './app.js';

const cfg = getConfig();

if (cfg.DB_AUTO_MIGRATE) await migrate();

const app = createApp();
const server = app.listen(cfg.PORT, cfg.HOST, () => {
  logger.info(
    { porta: cfg.PORT, ambiente: cfg.NODE_ENV, fila: cfg.QUEUE_MODE, llm: cfg.LLM_PROVIDER, ocr: cfg.OCR_ENGINE },
    'ContaGestão – Soluções Inteligentes: API no ar',
  );
});

// Uploads grandes + OCR inline podem demorar; evita cortes prematuros
server.requestTimeout = 10 * 60 * 1000;
server.headersTimeout = 65_000;
server.keepAliveTimeout = 61_000;

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  logger.info({ signal }, 'Encerrando API...');
  server.close(async () => {
    await closeQueue();
    await closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 30_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Promise rejeitada sem tratamento'));

/**
 * Saúde do serviço (para Docker, balanceadores e monitoramento).
 *   GET /health        -> o processo está de pé (liveness)
 *   GET /health/ready  -> banco, fila, armazenamento e OCR respondendo (readiness)
 */
import { Router } from 'express';
import { checkDb } from '../core/database.js';
import { checkQueue } from '../queue.js';
import { checkStorage } from '../ingestion/storage_service.js';
import { checkOcr } from '../extraction/ocr_engine.js';
import { getConfig } from '../core/config.js';

const VERSION = '1.0.0';

export function healthRouter() {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', versao: VERSION, uptimeSegundos: Math.round(process.uptime()) });
  });

  router.get('/health/ready', async (_req, res) => {
    const cfg = getConfig();
    const [banco, fila, armazenamento, ocr] = await Promise.all([checkDb(), checkQueue(), checkStorage(), checkOcr()]);
    const checks = { banco, fila, armazenamento, ocr };
    const ok = Object.values(checks).every(Boolean);
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degradado',
      checks,
      modoFila: cfg.QUEUE_MODE,
      provedorLlm: cfg.LLM_PROVIDER,
      motorOcr: cfg.OCR_ENGINE,
    });
  });

  return router;
}

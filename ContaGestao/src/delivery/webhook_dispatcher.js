/**
 * Notificação em tempo real para sistemas externos (ERP/CRM).
 *
 * Cada URL em WEBHOOK_URLS recebe um POST JSON quando um documento termina
 * de ser processado. Cabeçalhos enviados:
 *   X-ContaGestao-Event:      documento.concluido | documento.revisao | documento.erro
 *   X-ContaGestao-Timestamp:  segundos Unix
 *   X-ContaGestao-Signature:  sha256=<HMAC-SHA256(WEBHOOK_SECRET, "<timestamp>.<corpo>")>
 *   X-ContaGestao-Delivery:   id único da entrega (idempotência no receptor)
 *
 * Tentativas com espera exponencial; cada entrega fica registrada no banco.
 */
import crypto from 'node:crypto';
import { getConfig } from '../core/config.js';
import { signPayload } from '../core/security.js';
import { logger } from '../core/logger.js';
import { insertWebhookDelivery } from '../core/repository.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function deliver(url, event, body, cfg, fetchImpl) {
  const deliveryId = crypto.randomUUID();
  let lastError = null;
  let statusCode = null;
  const attemptsMax = Math.max(1, cfg.WEBHOOK_MAX_RETRIES);

  for (let attempt = 1; attempt <= attemptsMax; attempt += 1) {
    const ts = String(Math.floor(Date.now() / 1000));
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ContaGestao-Webhook/1.0',
          'X-ContaGestao-Event': event,
          'X-ContaGestao-Timestamp': ts,
          'X-ContaGestao-Delivery': deliveryId,
          ...(cfg.WEBHOOK_SECRET ? { 'X-ContaGestao-Signature': signPayload(body, cfg.WEBHOOK_SECRET, ts) } : {}),
        },
        body,
        signal: AbortSignal.timeout(cfg.WEBHOOK_TIMEOUT_SECONDS * 1000),
      });
      statusCode = res.status;
      if (res.ok) return { success: true, statusCode, attempts: attempt, lastError: null };
      lastError = `HTTP ${res.status}`;
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        return { success: false, statusCode, attempts: attempt, lastError }; // erro do receptor: não insiste
      }
    } catch (err) {
      lastError = err.name === 'TimeoutError' ? 'Tempo esgotado' : err.message;
    }
    if (attempt < attemptsMax) await sleep(cfg.WEBHOOK_RETRY_BASE_MS * 2 ** (attempt - 1));
  }
  return { success: false, statusCode, attempts: attemptsMax, lastError };
}

/**
 * Envia o evento para todas as URLs configuradas. Nunca lança exceção:
 * falhas de entrega não podem derrubar o processamento do documento.
 */
export async function dispatchEvent(documentId, event, payload, { fetchImpl = globalThis.fetch } = {}) {
  const cfg = getConfig();
  if (!cfg.WEBHOOK_URLS.length) return [];
  const body = JSON.stringify({ evento: event, enviadoEm: new Date().toISOString(), ...payload });

  const results = await Promise.all(
    cfg.WEBHOOK_URLS.map(async (url) => {
      const r = await deliver(url, event, body, cfg, fetchImpl);
      try {
        await insertWebhookDelivery({ documentId, event, url, ...r });
      } catch (err) {
        logger.error({ err, documentId }, 'Falha ao registrar entrega de webhook');
      }
      if (!r.success) logger.warn({ documentId, url, ...r }, 'Webhook não entregue');
      return { url, ...r };
    }),
  );
  return results;
}

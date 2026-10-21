/**
 * Webhook para capturar anexos de e-mails automaticamente.
 *
 * Compatível com os "inbound parse" mais comuns (SendGrid, Mailgun, Postmark
 * via conversor, Zapier, Make, n8n): recebe multipart/form-data com campos de
 * texto ("from"/"sender", "subject") e um ou mais arquivos anexos (qualquer
 * nome de campo).
 *
 * POST /api/v1/email/entrada
 *   Autenticação: cabeçalho  X-Webhook-Token: <EMAIL_WEBHOOK_SECRET>
 *                 ou query   ?token=<EMAIL_WEBHOOK_SECRET>  (para provedores
 *                 que não permitem cabeçalhos personalizados)
 */
import { Router } from 'express';
import multer from 'multer';
import { getConfig } from '../core/config.js';
import { safeIncludes } from '../core/security.js';
import { logger } from '../core/logger.js';
import { enqueueProcessing } from '../queue.js';
import { ingestFile, IntakeError } from './intake.js';

const SUBJECT_HINTS = [
  [/\b(nota fiscal|nf-?e|nfs-?e|fatura|boleto|danfe|cobran[çc]a)\b/i, 'fatura'],
  [/\b(contrato|aditivo|termo de)\b/i, 'contrato'],
  [/\b(formul[áa]rio|ficha|cadastro|requerimento)\b/i, 'formulario'],
];

export function guessTypeFromSubject(subject = '') {
  for (const [re, tipo] of SUBJECT_HINTS) if (re.test(subject)) return tipo;
  return 'auto';
}

function extractSender(body) {
  const raw = String(body.from ?? body.sender ?? body.From ?? '').trim();
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).slice(0, 320) || null;
}

export function emailRouter() {
  const cfg = getConfig();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: cfg.maxUploadBytes, files: cfg.MAX_FILES_PER_EMAIL, fields: 200, fieldSize: 2 * 1024 * 1024 },
  });

  const router = Router();

  router.post(
    '/email/entrada',
    (req, res, next) => {
      const token = req.get('x-webhook-token') ?? req.query.token;
      if (!cfg.EMAIL_WEBHOOK_SECRET) {
        return res.status(503).json({ erro: 'Recebimento por e-mail desativado (defina EMAIL_WEBHOOK_SECRET)' });
      }
      if (!safeIncludes(String(token ?? ''), [cfg.EMAIL_WEBHOOK_SECRET])) {
        return res.status(401).json({ erro: 'Token do webhook inválido' });
      }
      return next();
    },
    upload.any(),
    async (req, res) => {
      const files = req.files ?? [];
      const sender = extractSender(req.body ?? {});
      const subject = String(req.body?.subject ?? req.body?.Subject ?? '');
      const requestedType = guessTypeFromSubject(subject);

      const aceitos = [];
      const recusados = [];
      for (const f of files) {
        try {
          const { document, duplicate } = await ingestFile({
            filename: f.originalname,
            content: f.buffer,
            source: 'email',
            requestedType,
            sender,
          });
          if (!duplicate) await enqueueProcessing(document.id);
          aceitos.push({ arquivo: document.nomeArquivo, documentoId: document.id, duplicado: duplicate });
        } catch (err) {
          if (!(err instanceof IntakeError)) throw err;
          recusados.push({ arquivo: f.originalname, motivo: err.message });
        }
      }
      logger.info({ sender, aceitos: aceitos.length, recusados: recusados.length }, 'E-mail recebido');
      // 200 mesmo com recusas: evita que o provedor reenvie o e-mail em loop.
      res.status(200).json({ remetente: sender, assunto: subject, aceitos, recusados });
    },
  );

  return router;
}

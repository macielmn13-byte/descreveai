/**
 * Aplicação HTTP (Express 5). Exportada separadamente do servidor para que
 * os testes possam usá-la sem abrir porta.
 */
import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { pinoHttp } from 'pino-http';
import { ZodError } from 'zod';
import { getConfig } from './core/config.js';
import { logger } from './core/logger.js';
import { requireApiKey } from './api/auth.js';
import { healthRouter } from './api/health_routes.js';
import { documentsRouter } from './api/documents_routes.js';
import { uploadRouter } from './ingestion/api_handler.js';
import { emailRouter } from './ingestion/email_listener.js';
import { IntakeError } from './ingestion/intake.js';

export function createApp() {
  const cfg = getConfig();
  const app = express();

  app.disable('x-powered-by');
  if (cfg.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = req.get('x-request-id') || crypto.randomUUID();
        res.set('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url.startsWith('/health') },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    }),
  );
  app.use(helmet());
 app.use(cors({ origin: cfg.CORS_ORIGINS.length ? cfg.CORS_ORIGINS : false }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    res.json({
      nome: 'ContaGestão',
      slogan: 'Soluções Inteligentes',
      versao: '1.0.0',
      documentacao: '/docs/api-endpoints.md',
    });
  });
  app.use(healthRouter());

  const limiter = rateLimit({
    windowMs: 60_000,
    limit: cfg.RATE_LIMIT_PER_MINUTE,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { erro: 'Muitas requisições. Tente novamente em instantes.' },
  });

  // Webhook de e-mail tem autenticação própria (token do provedor)
  app.use('/api/v1', limiter, emailRouter());
  app.use('/api/v1', limiter, requireApiKey, uploadRouter(), documentsRouter());

  app.use((req, res) => res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.path}` }));

  app.use((err, req, res, _next) => {
    if (err instanceof IntakeError) return res.status(err.statusCode).json({ erro: err.message });
    if (err instanceof ZodError) {
      return res.status(400).json({
        erro: 'Parâmetros inválidos',
        detalhes: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
      });
    }
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? `Arquivo excede o limite de ${cfg.MAX_UPLOAD_MB} MB`
          : err.code === 'LIMIT_UNEXPECTED_FILE'
            ? `Campo de arquivo inesperado: ${err.field} (use "arquivo")`
            : err.message;
      return res.status(status).json({ erro: msg });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido' });
    req.log?.error({ err }, 'Erro não tratado');
    return res.status(500).json({ erro: 'Erro interno', requestId: req.id });
  });

  return app;
}

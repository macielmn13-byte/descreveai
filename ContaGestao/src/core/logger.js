/**
 * Logs estruturados (JSON) com pino. Em desenvolvimento, use LOG_PRETTY=true
 * junto com o pacote opcional pino-pretty para saída legível.
 */
import pino from 'pino';
import { getConfig } from './config.js';

function build() {
  const cfg = getConfig();
  const options = {
    level: cfg.LOG_LEVEL,
    base: { app: 'contagestao' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ['req.headers["x-api-key"]', 'req.headers.authorization', 'req.headers["x-webhook-token"]'],
      censor: '[oculto]',
    },
  };
  if (cfg.LOG_PRETTY) {
    options.transport = { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } };
  }
  return pino(options);
}

export const logger = build();

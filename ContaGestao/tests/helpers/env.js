/**
 * Ambiente isolado para os testes. Importe ANTES de qualquer módulo de src/.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'contagestao-test-'));

Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'sqlite::memory:',
  DB_AUTO_MIGRATE: 'true',
  QUEUE_MODE: 'inline',
  STORAGE_BACKEND: 'local',
  STORAGE_LOCAL_PATH: path.join(tmp, 'storage'),
  LLM_PROVIDER: 'none',
  API_KEYS: 'chave-de-teste-com-mais-de-32-caracteres-123',
  ENCRYPTION_KEYS: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
  EMAIL_WEBHOOK_SECRET: 'segredo-email-teste',
  WEBHOOK_URLS: '',
  WEBHOOK_RETRY_BASE_MS: '10',
  RATE_LIMIT_PER_MINUTE: '10000',
});

export const TEST_API_KEY = process.env.API_KEYS;
export const TMP_DIR = tmp;

/**
 * Configuração central do ContaGestão.
 *
 * Todas as variáveis vêm do ambiente (ou do arquivo .env na raiz do projeto).
 * O esquema abaixo valida tipos e, em produção, exige os itens de segurança.
 */
import 'dotenv/config';
import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const bool = (def) =>
  z
    .string()
    .default(String(def))
    .transform((v) => ['1', 'true', 'yes', 'sim', 'on'].includes(v.trim().toLowerCase()));

const int = (def) => z.coerce.number().int().nonnegative().default(def);

const schema = z.object({
  // ---------------------------------------------------------------- App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('ContaGestão – Soluções Inteligentes'),
  PORT: int(8000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: bool(false),
  CORS_ORIGINS: csv,
  TRUST_PROXY: bool(false),
  RATE_LIMIT_PER_MINUTE: int(120),

  // ---------------------------------------------------------- Segurança
  API_KEYS: csv,
  ENCRYPTION_KEYS: csv, // base64 de 32 bytes; a 1ª criptografa, todas descriptografam
  EMAIL_WEBHOOK_SECRET: z.string().default(''),

  // ------------------------------------------------------ Banco de dados
  DATABASE_URL: z.string().default('sqlite:./data/contagestao.db'),
  DB_POOL_MAX: int(10),
  DB_AUTO_MIGRATE: bool(true),

  // --------------------------------------------------------------- Fila
  QUEUE_MODE: z.enum(['bullmq', 'inline']).default('inline'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  WORKER_CONCURRENCY: int(2),
  JOB_TIMEOUT_SECONDS: int(900),

  // ------------------------------------------------------ Armazenamento
  STORAGE_BACKEND: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./data/storage'),
  S3_BUCKET: z.string().default(''),
  S3_PREFIX: z.string().default('documentos/'),
  S3_ENDPOINT_URL: z.string().default(''),
  S3_FORCE_PATH_STYLE: bool(false),
  AWS_REGION: z.string().default('sa-east-1'),

  // ------------------------------------------------------------- Upload
  MAX_UPLOAD_MB: int(25),
  MAX_PAGES: int(50),
  MAX_FILES_PER_EMAIL: int(10),
  ALLOWED_EXTENSIONS: z
    .string()
    .default('pdf,png,jpg,jpeg,tif,tiff')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim().toLowerCase().replace(/^\./, ''))
        .filter(Boolean),
    ),

  // ---------------------------------------------------------------- OCR
  OCR_ENGINE: z.enum(['tesseract', 'textract']).default('tesseract'),
  TESSERACT_CMD: z.string().default('tesseract'),
  TESSERACT_LANG: z.string().default('por+eng'),
  TESSERACT_PSM: int(3),
  OCR_DPI: int(300),
  OCR_AUTO_ROTATE: bool(true),
  ENHANCE_BINARIZE: bool(false),
  NATIVE_TEXT_MIN_CHARS: int(80),

  // ---------------------------------------------------------------- LLM
  LLM_PROVIDER: z.enum(['anthropic', 'openai', 'azure', 'none']).default('anthropic'),
  LLM_MAX_TOKENS: int(4096),
  LLM_TIMEOUT_SECONDS: int(120),
  LLM_MAX_RETRIES: int(3),
  LLM_MAX_INPUT_CHARS: int(60000),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  AZURE_OPENAI_ENDPOINT: z.string().default(''),
  AZURE_OPENAI_API_KEY: z.string().default(''),
  AZURE_OPENAI_DEPLOYMENT: z.string().default(''),
  AZURE_OPENAI_API_VERSION: z.string().default('2024-10-21'),

  // -------------------------------------------------------- Integrações
  WEBHOOK_URLS: csv,
  WEBHOOK_SECRET: z.string().default(''),
  WEBHOOK_TIMEOUT_SECONDS: int(15),
  WEBHOOK_MAX_RETRIES: int(3),
  WEBHOOK_RETRY_BASE_MS: int(1000),
});

function productionProblems(c) {
  const p = [];
  if (!c.API_KEYS.length) p.push('API_KEYS é obrigatório');
  if (c.API_KEYS.some((k) => k.length < 32)) p.push('cada chave em API_KEYS precisa de 32+ caracteres');
  if (!c.ENCRYPTION_KEYS.length) p.push('ENCRYPTION_KEYS é obrigatório');
  if (c.DATABASE_URL.startsWith('sqlite')) p.push('use PostgreSQL em produção (DATABASE_URL)');
  if (c.QUEUE_MODE !== 'bullmq') p.push('use QUEUE_MODE=bullmq em produção');
  if (c.STORAGE_BACKEND === 's3' && !c.S3_BUCKET) p.push('S3_BUCKET é obrigatório com STORAGE_BACKEND=s3');
  if (c.WEBHOOK_URLS.length && !c.WEBHOOK_SECRET) p.push('WEBHOOK_SECRET é obrigatório com WEBHOOK_URLS');
  if (c.LLM_PROVIDER === 'anthropic' && !c.ANTHROPIC_API_KEY) p.push('ANTHROPIC_API_KEY é obrigatório');
  if (c.LLM_PROVIDER === 'openai' && !c.OPENAI_API_KEY) p.push('OPENAI_API_KEY é obrigatório');
  if (c.LLM_PROVIDER === 'azure' && !(c.AZURE_OPENAI_ENDPOINT && c.AZURE_OPENAI_API_KEY && c.AZURE_OPENAI_DEPLOYMENT)) {
    p.push('variáveis AZURE_OPENAI_* incompletas');
  }
  return p;
}

let cached = null;

/** Lê e valida a configuração (resultado em cache). */
export function getConfig() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msgs = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuração inválida:\n - ${msgs.join('\n - ')}`);
  }
  const c = parsed.data;
  if (c.NODE_ENV === 'production') {
    const problems = productionProblems(c);
    if (problems.length) {
      throw new Error(`Configuração inválida para produção:\n - ${problems.join('\n - ')}`);
    }
  }
  c.isProduction = c.NODE_ENV === 'production';
  c.maxUploadBytes = c.MAX_UPLOAD_MB * 1024 * 1024;
  cached = Object.freeze(c);
  return cached;
}

/** Apenas para testes: força nova leitura do ambiente. */
export function resetConfig() {
  cached = null;
}

/**
 * Segurança: criptografia de documentos confidenciais, hashes e assinaturas.
 *
 * - Arquivos e textos de OCR são criptografados em repouso com AES-256-GCM
 *   (confidencialidade + integridade).
 * - Rotação de chaves: ENCRYPTION_KEYS aceita várias chaves separadas por
 *   vírgula. A primeira criptografa; qualquer uma descriptografa (o cabeçalho
 *   de cada conteúdo guarda o identificador da chave usada).
 * - Webhooks de saída são assinados com HMAC-SHA256 sobre "<timestamp>.<corpo>".
 */
import crypto from 'node:crypto';
import { getConfig } from './config.js';
import { logger } from './logger.js';

const MAGIC = Buffer.from('CG1'); // formato v1
const IV_LEN = 12;
const TAG_LEN = 16;
const KID_LEN = 4;

export class DecryptionError extends Error {}

function keyId(key) {
  return crypto.createHash('sha256').update(key).digest().subarray(0, KID_LEN);
}

let keyring = null;

function getKeyring() {
  if (keyring) return keyring;
  let raw = getConfig().ENCRYPTION_KEYS;
  if (!raw.length) {
    logger.warn('ENCRYPTION_KEYS não definida: usando chave de DESENVOLVIMENTO (nunca use em produção).');
    raw = [crypto.createHash('sha256').update('contagestao-dev-only').digest('base64')];
  }
  const keys = raw.map((b64) => {
    const key = Buffer.from(b64, 'base64');
    if (key.length !== 32) {
      throw new Error('Cada chave em ENCRYPTION_KEYS deve ter 32 bytes em base64 (use npm run gerar-chaves)');
    }
    return { id: keyId(key), key };
  });
  keyring = { primary: keys[0], all: keys };
  return keyring;
}

/** Apenas para testes. */
export function resetKeyring() {
  keyring = null;
}

export function encryptBuffer(plain) {
  const { primary } = getKeyring();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', primary.key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, primary.id, iv, cipher.getAuthTag(), ct]);
}

export function decryptBuffer(blob) {
  if (!Buffer.isBuffer(blob) || blob.length < MAGIC.length + KID_LEN + IV_LEN + TAG_LEN) {
    throw new DecryptionError('Conteúdo criptografado inválido');
  }
  if (!blob.subarray(0, 3).equals(MAGIC)) throw new DecryptionError('Formato de criptografia desconhecido');
  let off = 3;
  const kid = blob.subarray(off, (off += KID_LEN));
  const iv = blob.subarray(off, (off += IV_LEN));
  const tag = blob.subarray(off, (off += TAG_LEN));
  const ct = blob.subarray(off);
  const entry = getKeyring().all.find((k) => k.id.equals(kid));
  if (!entry) throw new DecryptionError('Chave de criptografia não encontrada (verifique ENCRYPTION_KEYS)');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', entry.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch {
    throw new DecryptionError('Falha ao descriptografar (dado corrompido ou chave incorreta)');
  }
}

export const encryptText = (text) => encryptBuffer(Buffer.from(text, 'utf8')).toString('base64');
export const decryptText = (b64) => decryptBuffer(Buffer.from(b64, 'base64')).toString('utf8');

export const sha256Hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export const generateEncryptionKey = () => crypto.randomBytes(32).toString('base64');
export const generateApiKey = () => crypto.randomBytes(36).toString('base64url');

/** Compara uma credencial com uma lista em tempo constante. */
export function safeIncludes(candidate, allowed) {
  if (typeof candidate !== 'string') return false;
  const c = crypto.createHash('sha256').update(candidate).digest();
  let found = false;
  for (const value of allowed) {
    const v = crypto.createHash('sha256').update(value).digest();
    if (crypto.timingSafeEqual(c, v)) found = true;
  }
  return found;
}

export function signPayload(body, secret, timestamp) {
  const mac = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
  return `sha256=${mac}`;
}

export function verifySignature(body, secret, timestamp, signature) {
  const expected = Buffer.from(signPayload(body, secret, timestamp));
  const given = Buffer.from(String(signature ?? ''));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

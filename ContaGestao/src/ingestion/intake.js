/**
 * Regras comuns de recebimento de arquivos (upload manual e e-mail):
 * validação de extensão e conteúdo real, limite de tamanho, deduplicação,
 * criptografia, armazenamento e registro no banco.
 */
import path from 'node:path';
import { getConfig } from '../core/config.js';
import { sha256Hex } from '../core/security.js';
import { logger } from '../core/logger.js';
import { insertDocument, findProcessedBySha, newId, TIPOS } from '../core/repository.js';
import { buildKey, saveFile } from './storage_service.js';

export class IntakeError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.expose = true;
  }
}

const EXT_TO_MIME = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

const SIGNATURES = {
  'application/pdf': [Buffer.from('%PDF-')],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/tiff': [Buffer.from('II*\0', 'binary'), Buffer.from('MM\0*', 'binary')],
};

export function sanitizeFilename(name) {
  // multer entrega nomes em latin1; converte para UTF-8 (acentos corretos)
  let decoded = String(name ?? '');
  try {
    const utf8 = Buffer.from(decoded, 'latin1').toString('utf8');
    if (!utf8.includes('\uFFFD')) decoded = utf8;
  } catch {
    /* mantém original */
  }
  const base = path
    .basename(decoded.replaceAll('\\', '/'))
    .replace(/\p{Cc}/gu, '')
    .trim();
  return (base || 'documento').slice(0, 255);
}

export function detectMime(filename, content) {
  const cfg = getConfig();
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  if (!cfg.ALLOWED_EXTENSIONS.includes(ext) || !EXT_TO_MIME[ext]) {
    throw new IntakeError(`Extensão ".${ext}" não permitida. Aceitas: ${cfg.ALLOWED_EXTENSIONS.join(', ')}`, 415);
  }
  const mime = EXT_TO_MIME[ext];
  const ok = SIGNATURES[mime].some((sig) => content.subarray(0, sig.length).equals(sig));
  if (!ok) throw new IntakeError('O conteúdo do arquivo não corresponde à extensão informada', 415);
  return { mime, ext };
}

/**
 * Valida, criptografa, armazena e registra um arquivo. Não enfileira.
 * @returns {Promise<{document: object, duplicate: boolean}>}
 */
export async function ingestFile({ filename, content, source = 'upload', requestedType = 'auto', sender = null }) {
  const cfg = getConfig();
  if (!content?.length) throw new IntakeError('Arquivo vazio');
  if (content.length > cfg.maxUploadBytes) {
    throw new IntakeError(`Arquivo excede o limite de ${cfg.MAX_UPLOAD_MB} MB`, 413);
  }
  if (!TIPOS.includes(requestedType)) {
    throw new IntakeError(`tipo_documento inválido. Use: ${TIPOS.join(', ')}`);
  }

  const safeName = sanitizeFilename(filename);
  const { mime, ext } = detectMime(safeName, content);
  const sha256 = sha256Hex(content);

  const existing = await findProcessedBySha(sha256);
  if (existing) {
    logger.info({ documentId: existing.id }, 'Arquivo duplicado: reaproveitando processamento anterior');
    return { document: existing, duplicate: true };
  }

  const id = newId();
  const storageKey = await saveFile(buildKey(id, ext), content);
  const document = await insertDocument({
    id,
    filename: safeName,
    contentType: mime,
    sizeBytes: content.length,
    sha256,
    storageKey,
    source,
    sender,
    requestedType,
  });
  logger.info({ documentId: id, mime, bytes: content.length, source }, 'Documento recebido');
  return { document, duplicate: false };
}

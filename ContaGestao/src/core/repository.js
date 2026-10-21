/**
 * Acesso a dados dos documentos e resultados (camada única de SQL).
 */
import crypto from 'node:crypto';
import { getDb, nowIso, toJson, fromJson, toIso } from './database.js';
import { encryptText, decryptText } from './security.js';

export const STATUS = Object.freeze({
  RECEBIDO: 'recebido',
  PROCESSANDO: 'processando',
  CONCLUIDO: 'concluido',
  REVISAO: 'revisao', // extraído, mas reprovado em regra de negócio
  ERRO: 'erro',
});

export const TIPOS = Object.freeze(['auto', 'fatura', 'contrato', 'formulario']);

export const newId = () => crypto.randomUUID();

// ------------------------------------------------------------ documentos

export async function insertDocument(doc) {
  const now = nowIso();
  const row = {
    id: doc.id ?? newId(),
    filename: doc.filename,
    content_type: doc.contentType,
    size_bytes: doc.sizeBytes,
    sha256: doc.sha256,
    storage_key: doc.storageKey,
    source: doc.source ?? 'upload',
    sender: doc.sender ?? null,
    requested_type: doc.requestedType ?? 'auto',
    status: STATUS.RECEBIDO,
    used_native_text: false,
    created_at: now,
    updated_at: now,
  };
  await getDb()('documents').insert(row);
  return getDocument(row.id);
}

export async function getDocument(id, { withText = false } = {}) {
  const row = await getDb()('documents').where({ id }).first();
  return row ? mapDocument(row, withText) : null;
}

export async function findProcessedBySha(sha256) {
  const row = await getDb()('documents')
    .where({ sha256 })
    .whereIn('status', [STATUS.CONCLUIDO, STATUS.REVISAO])
    .orderBy('created_at', 'desc')
    .first();
  return row ? mapDocument(row) : null;
}

export async function updateDocument(id, fields) {
  const patch = { updated_at: nowIso() };
  const map = {
    status: 'status',
    errorMessage: 'error_message',
    documentType: 'document_type',
    pages: 'pages',
    ocrConfidence: 'ocr_confidence',
    usedNativeText: 'used_native_text',
    processedAt: 'processed_at',
  };
  for (const [k, col] of Object.entries(map)) if (k in fields) patch[col] = fields[k];
  if ('ocrText' in fields) patch.ocr_text = fields.ocrText == null ? null : encryptText(fields.ocrText);
  await getDb()('documents').where({ id }).update(patch);
}

export async function listDocuments({ status, tipo, desde, ate, limite = 50, deslocamento = 0 } = {}) {
  const q = getDb()('documents');
  if (status) q.where('status', status);
  if (tipo) q.where('document_type', tipo);
  if (desde) q.where('created_at', '>=', desde);
  if (ate) q.where('created_at', '<=', ate);
  const [{ total }] = await q.clone().count({ total: '*' });
  const rows = await q.orderBy('created_at', 'desc').limit(limite).offset(deslocamento);
  return { total: Number(total), itens: rows.map((r) => mapDocument(r)) };
}

export async function deleteDocument(id) {
  return getDb()('documents').where({ id }).delete();
}

function mapDocument(r, withText = false) {
  const doc = {
    id: r.id,
    nomeArquivo: r.filename,
    tipoConteudo: r.content_type,
    tamanhoBytes: Number(r.size_bytes),
    sha256: r.sha256,
    storageKey: r.storage_key,
    origem: r.source,
    remetente: r.sender,
    tipoSolicitado: r.requested_type,
    tipoDocumento: r.document_type,
    status: r.status,
    erro: r.error_message,
    paginas: r.pages == null ? null : Number(r.pages),
    confiancaOcr: r.ocr_confidence == null ? null : Number(r.ocr_confidence),
    textoNativo: Boolean(r.used_native_text),
    criadoEm: toIso(r.created_at),
    atualizadoEm: toIso(r.updated_at),
    processadoEm: toIso(r.processed_at),
  };
  if (withText) doc.textoOcr = r.ocr_text ? decryptText(r.ocr_text) : null;
  return doc;
}

/** Remove campos internos antes de responder ao cliente. */
export function publicDocument(doc) {
  const { storageKey: _k, textoOcr: _t, ...rest } = doc;
  return rest;
}

// ------------------------------------------------------------ resultados

export async function upsertResult(documentId, { data, errors, warnings, isValid, provider, model }) {
  const db = getDb();
  const now = nowIso();
  const values = {
    data: toJson(data),
    errors: toJson(errors),
    warnings: toJson(warnings),
    is_valid: Boolean(isValid),
    llm_provider: provider,
    llm_model: model ?? null,
    updated_at: now,
  };
  const existing = await db('extraction_results').where({ document_id: documentId }).first('id');
  if (existing) {
    await db('extraction_results').where({ id: existing.id }).update(values);
  } else {
    await db('extraction_results').insert({ id: newId(), document_id: documentId, created_at: now, ...values });
  }
}

export async function deleteResult(documentId) {
  await getDb()('extraction_results').where({ document_id: documentId }).delete();
}

export async function getResult(documentId) {
  const r = await getDb()('extraction_results').where({ document_id: documentId }).first();
  return r ? mapResult(r) : null;
}

export async function listResultsWithDocuments(filters = {}) {
  const q = getDb()('extraction_results as r')
    .join('documents as d', 'd.id', 'r.document_id')
    .select('r.*', 'd.filename', 'd.document_type', 'd.status', 'd.created_at as doc_created_at');
  if (filters.status) q.where('d.status', filters.status);
  if (filters.tipo) q.where('d.document_type', filters.tipo);
  if (filters.desde) q.where('d.created_at', '>=', filters.desde);
  if (filters.ate) q.where('d.created_at', '<=', filters.ate);
  const rows = await q.orderBy('d.created_at', 'asc').limit(filters.limite ?? 10000);
  return rows.map((r) => ({
    ...mapResult(r),
    nomeArquivo: r.filename,
    tipoDocumento: r.document_type,
    status: r.status,
    recebidoEm: toIso(r.doc_created_at),
  }));
}

function mapResult(r) {
  return {
    documentoId: r.document_id,
    dados: fromJson(r.data, {}),
    erros: fromJson(r.errors, []),
    avisos: fromJson(r.warnings, []),
    valido: Boolean(r.is_valid),
    provedorLlm: r.llm_provider,
    modeloLlm: r.llm_model,
    criadoEm: toIso(r.created_at),
    atualizadoEm: toIso(r.updated_at),
  };
}

// -------------------------------------------------------------- webhooks

export async function insertWebhookDelivery(d) {
  await getDb()('webhook_deliveries').insert({
    id: newId(),
    document_id: d.documentId,
    event: d.event,
    url: d.url,
    success: Boolean(d.success),
    status_code: d.statusCode ?? null,
    attempts: d.attempts,
    last_error: d.lastError ?? null,
    created_at: nowIso(),
  });
}

export async function listWebhookDeliveries(documentId) {
  const rows = await getDb()('webhook_deliveries').where({ document_id: documentId }).orderBy('created_at');
  return rows.map((r) => ({
    evento: r.event,
    url: r.url,
    sucesso: Boolean(r.success),
    statusHttp: r.status_code,
    tentativas: r.attempts,
    ultimoErro: r.last_error,
    criadoEm: toIso(r.created_at),
  }));
}

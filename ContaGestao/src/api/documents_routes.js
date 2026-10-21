/**
 * Consulta, reprocessamento, exclusão e exportação de documentos.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  STATUS,
  TIPOS,
  getDocument,
  listDocuments,
  publicDocument,
  getResult,
  deleteDocument,
  deleteResult,
  updateDocument,
  listResultsWithDocuments,
  listWebhookDeliveries,
} from '../core/repository.js';
import { loadFile, deleteFile } from '../ingestion/storage_service.js';
import { enqueueProcessing } from '../queue.js';
import { exportResults, FORMATOS } from '../delivery/exporter.js';
import { logger } from '../core/logger.js';

const STATUS_VALUES = Object.values(STATUS);
const TIPOS_REAIS = TIPOS.filter((t) => t !== 'auto');

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'use AAAA-MM-DD')
  .optional();

const listQuery = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  tipo: z.enum(TIPOS_REAIS).optional(),
  desde: dateParam,
  ate: dateParam,
  limite: z.coerce.number().int().min(1).max(200).default(50),
  deslocamento: z.coerce.number().int().min(0).default(0),
});

const exportQuery = z.object({
  formato: z.enum(Object.keys(FORMATOS)).default('xlsx'),
  status: z.enum(STATUS_VALUES).optional(),
  tipo: z.enum(TIPOS_REAIS).optional(),
  desde: dateParam,
  ate: dateParam,
});

const idParam = z.string().uuid('id inválido');

/** "ate" inclusivo: 2026-10-31 -> até 2026-10-31T23:59:59.999Z */
const endOfDay = (d) => (d && d.length === 10 ? `${d}T23:59:59.999Z` : d);

async function loadDoc(req, res) {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ erro: 'id inválido' });
    return null;
  }
  const doc = await getDocument(id.data);
  if (!doc) {
    res.status(404).json({ erro: 'Documento não encontrado' });
    return null;
  }
  return doc;
}

export function documentsRouter() {
  const router = Router();

  router.get('/documentos', async (req, res) => {
    const q = listQuery.parse(req.query);
    const { total, itens } = await listDocuments({ ...q, ate: endOfDay(q.ate) });
    res.json({ total, limite: q.limite, deslocamento: q.deslocamento, itens: itens.map(publicDocument) });
  });

  router.get('/documentos/:id', async (req, res) => {
    const doc = await loadDoc(req, res);
    if (!doc) return;
    res.json({ ...publicDocument(doc), webhooks: await listWebhookDeliveries(doc.id) });
  });

  router.get('/documentos/:id/resultado', async (req, res) => {
    const doc = await loadDoc(req, res);
    if (!doc) return;
    const result = await getResult(doc.id);
    if (!result) {
      return res.status(409).json({ erro: 'Resultado ainda não disponível', status: doc.status, detalhe: doc.erro });
    }
    return res.json({ documento: publicDocument(doc), ...result });
  });

  router.get('/documentos/:id/texto', async (req, res) => {
    const doc = await loadDoc(req, res);
    if (!doc) return;
    const full = await getDocument(doc.id, { withText: true });
    if (!full.textoOcr) return res.status(409).json({ erro: 'Texto ainda não disponível', status: doc.status });
    return res.type('text/plain; charset=utf-8').send(full.textoOcr);
  });

  router.get('/documentos/:id/arquivo', async (req, res) => {
    const doc = await loadDoc(req, res);
    if (!doc) return;
    const content = await loadFile(doc.storageKey);
    res
      .type(doc.tipoConteudo)
      .set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.nomeArquivo)}`)
      .send(content);
  });

  router.post('/documentos/:id/reprocessar', async (req, res) => {
    const doc = await loadDoc(req, res);
    if (!doc) return;
    if (doc.status === STATUS.PROCESSANDO) {
      return res.status(409).json({ erro: 'O documento já está em processamento' });
    }
    await deleteResult(doc.id);
    await updateDocument(doc.id, { status: STATUS.RECEBIDO, errorMessage: null });
    await enqueueProcessing(doc.id);
    return res.status(202).json(publicDocument(await getDocument(doc.id)));
  });

  router.delete('/documentos/:id', async (req, res) => {
    const doc = await loadDoc(req, res);
    if (!doc) return;
    await deleteFile(doc.storageKey);
    await deleteDocument(doc.id); // resultado e webhooks saem em cascata
    logger.info({ documentId: doc.id }, 'Documento excluído (arquivo e dados)');
    res.status(204).end();
  });

  router.get('/exportacoes', async (req, res) => {
    const q = exportQuery.parse(req.query);
    const results = await listResultsWithDocuments({ ...q, ate: endOfDay(q.ate) });
    const buffer = await exportResults(results, q.formato);
    const { mime, ext } = FORMATOS[q.formato];
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res
      .type(mime)
      .set('Content-Disposition', `attachment; filename="contagestao-${stamp}.${ext}"`)
      .set('X-Total-Documentos', String(results.length))
      .send(buffer);
  });

  return router;
}

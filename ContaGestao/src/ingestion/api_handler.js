/**
 * Endpoints de upload manual de PDF/imagens.
 *
 * POST /api/v1/documentos   (multipart/form-data)
 *   arquivo          -> o arquivo (PDF, PNG, JPG, TIFF)
 *   tipo_documento   -> auto | fatura | contrato | formulario (opcional)
 */
import { Router } from 'express';
import multer from 'multer';
import { getConfig } from '../core/config.js';
import { publicDocument } from '../core/repository.js';
import { enqueueProcessing } from '../queue.js';
import { ingestFile, IntakeError } from './intake.js';

export function uploadRouter() {
  const cfg = getConfig();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: cfg.maxUploadBytes, files: 1, fields: 10 },
  });

  const router = Router();

  router.post('/documentos', upload.single('arquivo'), async (req, res) => {
    if (!req.file) throw new IntakeError('Envie o arquivo no campo "arquivo" (multipart/form-data)');
    const requestedType = String(req.body?.tipo_documento ?? 'auto').toLowerCase();

    const { document, duplicate } = await ingestFile({
      filename: req.file.originalname,
      content: req.file.buffer,
      source: 'upload',
      requestedType,
    });

    if (!duplicate) await enqueueProcessing(document.id);

    res
      .status(duplicate ? 200 : 202)
      .location(`/api/v1/documentos/${document.id}`)
      .json({ duplicado: duplicate, documento: publicDocument(document) });
  });

  return router;
}

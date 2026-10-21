/**
 * Gravação dos dados estruturados no banco relacional e atualização do
 * status final do documento.
 */
import { nowIso } from '../core/database.js';
import { STATUS, updateDocument, upsertResult } from '../core/repository.js';

/**
 * @param {string} documentId
 * @param {{tipo: string, data: object, report: {errors: string[], warnings: string[], isValid: boolean},
 *          provider: string, model: string|null}} result
 * @returns {Promise<string>} status final
 */
export async function saveExtraction(documentId, { tipo, data, report, provider, model }) {
  await upsertResult(documentId, {
    data,
    errors: report.errors,
    warnings: report.warnings,
    isValid: report.isValid,
    provider,
    model,
  });
  const status = report.isValid ? STATUS.CONCLUIDO : STATUS.REVISAO;
  await updateDocument(documentId, {
    status,
    documentType: tipo,
    errorMessage: null,
    processedAt: nowIso(),
  });
  return status;
}

export async function markFailed(documentId, message) {
  await updateDocument(documentId, {
    status: STATUS.ERRO,
    errorMessage: String(message).slice(0, 2000),
    processedAt: nowIso(),
  });
}

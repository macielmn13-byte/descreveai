/**
 * Orquestração do processamento de um documento (executada pelo worker):
 *
 *   1. carrega o arquivo (descriptografa)
 *   2. converte em páginas (texto nativo do PDF ou imagem)
 *   3. pré-processa as imagens e aplica OCR
 *   4. classifica o tipo (quando "auto")
 *   5. extrai os dados com LLM (ou heurística)
 *   6. normaliza (esquema) e valida (regras de negócio)
 *   7. grava no banco e notifica os webhooks
 */
import { logger } from './core/logger.js';
import { getDocument, updateDocument, STATUS } from './core/repository.js';
import { loadFile } from './ingestion/storage_service.js';
import { convertDocument } from './processing/pdf_converter.js';
import { enhanceForOcr } from './processing/image_enhancer.js';
import { runOcr } from './extraction/ocr_engine.js';
import { classifyDocument } from './extraction/classifier.js';
import { parseWithLlm } from './extraction/llm_parser.js';
import { normalizeExtraction } from './validation/schemas.js';
import { applyBusinessRules } from './validation/business_rules.js';
import { saveExtraction, markFailed } from './delivery/db_writer.js';
import { dispatchEvent } from './delivery/webhook_dispatcher.js';

export async function extractText(buffer, mime) {
  const pages = await convertDocument(buffer, mime);
  const texts = [];
  const confidences = [];
  let ocrPages = 0;
  for (const page of pages) {
    if (page.nativeText) {
      texts.push(page.nativeText);
      continue;
    }
    const { image } = await enhanceForOcr(page.image);
    const ocr = await runOcr(image);
    ocrPages += 1;
    texts.push(ocr.text);
    if (ocr.confidence !== null) confidences.push(ocr.confidence);
  }
  const text = texts.map((t, i) => `--- Página ${i + 1} ---\n${t}`).join('\n\n');
  return {
    text,
    pages: pages.length,
    usedNativeText: ocrPages === 0,
    confidence: confidences.length
      ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 10) / 10
      : null,
  };
}

/**
 * Processa um documento. Não lança exceção para erros de negócio/conteúdo:
 * o documento fica com status "erro" e a mensagem registrada.
 * @returns {Promise<string>} status final
 */
export async function processDocument(documentId) {
  const log = logger.child({ documentId });
  const doc = await getDocument(documentId);
  if (!doc) {
    log.warn('Documento não encontrado para processamento');
    return 'inexistente';
  }

  const started = Date.now();
  await updateDocument(documentId, { status: STATUS.PROCESSANDO, errorMessage: null });

  try {
    const buffer = await loadFile(doc.storageKey);
    const extracted = await extractText(buffer, doc.tipoConteudo);
    if (!extracted.text.replace(/---.*---/g, '').trim()) {
      throw new Error('Nenhum texto legível encontrado no documento');
    }
    await updateDocument(documentId, {
      pages: extracted.pages,
      ocrText: extracted.text,
      ocrConfidence: extracted.confidence,
      usedNativeText: extracted.usedNativeText,
    });

    const tipo = doc.tipoSolicitado === 'auto' ? classifyDocument(extracted.text).tipo : doc.tipoSolicitado;
    const llm = await parseWithLlm(tipo, extracted.text);
    const { data, issues } = normalizeExtraction(tipo, llm.data);
    const report = applyBusinessRules(tipo, data);
    report.warnings.push(...issues);
    if (extracted.confidence !== null && extracted.confidence < 60) {
      report.warnings.push(`Baixa confiança do OCR (${extracted.confidence}%): confira o documento original`);
    }

    const status = await saveExtraction(documentId, { tipo, data, report, provider: llm.provider, model: llm.model });
    log.info({ status, tipo, ms: Date.now() - started, paginas: extracted.pages }, 'Documento processado');

    await dispatchEvent(documentId, `documento.${status}`, {
      documentoId: documentId,
      arquivo: doc.nomeArquivo,
      tipo,
      status,
      valido: report.isValid,
      dados: data,
      erros: report.errors,
      avisos: report.warnings,
    });
    return status;
  } catch (err) {
    log.error({ err }, 'Falha no processamento do documento');
    await markFailed(documentId, err.message);
    await dispatchEvent(documentId, 'documento.erro', {
      documentoId: documentId,
      arquivo: doc.nomeArquivo,
      status: STATUS.ERRO,
      erro: err.message,
    });
    return STATUS.ERRO;
  }
}

/**
 * Conversão de documentos em páginas prontas para OCR.
 *
 * - PDF: lê a camada de texto nativa de cada página (PDFs gerados por sistema
 *   não precisam de OCR — mais rápido e 100% fiel). Só as páginas sem texto
 *   suficiente (digitalizadas) são renderizadas em imagem de alta resolução.
 * - Imagens: PNG/JPEG/TIFF (inclusive TIFF de várias páginas).
 */
import sharp from 'sharp';
import { getConfig } from '../core/config.js';

let pdfjsPromise = null;
const loadPdfjs = () => (pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs'));

export class ConversionError extends Error {}

/**
 * @typedef {object} PageInput
 * @property {number} pageNumber
 * @property {string|null} nativeText  texto embutido (quando suficiente)
 * @property {Buffer|null} image       PNG da página (quando precisa de OCR)
 */

/** @returns {Promise<PageInput[]>} */
export async function convertDocument(buffer, mime) {
  if (mime === 'application/pdf') return convertPdf(buffer);
  if (mime.startsWith('image/')) return convertImage(buffer);
  throw new ConversionError(`Tipo de conteúdo não suportado: ${mime}`);
}

async function convertPdf(buffer) {
  const cfg = getConfig();
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
  });
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (err) {
    await loadingTask.destroy();
    throw new ConversionError(`PDF inválido ou protegido: ${err.message}`);
  }

  try {
    if (pdf.numPages > cfg.MAX_PAGES) {
      throw new ConversionError(`O documento tem ${pdf.numPages} páginas; o limite é ${cfg.MAX_PAGES}`);
    }
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const nativeText = await extractPageText(page);
      if (nativeText.replace(/\s/g, '').length >= cfg.NATIVE_TEXT_MIN_CHARS) {
        pages.push({ pageNumber: n, nativeText, image: null });
      } else {
        pages.push({ pageNumber: n, nativeText: null, image: await renderPage(pdf, page, cfg.OCR_DPI) });
      }
      page.cleanup();
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

async function extractPageText(page) {
  const content = await page.getTextContent();
  let text = '';
  for (const item of content.items) {
    if (!('str' in item)) continue;
    text += item.str;
    text += item.hasEOL ? '\n' : ' ';
  }
  return text
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

async function renderPage(pdf, page, dpi) {
  const viewport = page.getViewport({ scale: dpi / 72 });
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);
  const { canvas, context } = pdf.canvasFactory.create(width, height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  await page.render({ canvasContext: context, canvas, viewport }).promise;
  const png = canvas.toBuffer('image/png');
  pdf.canvasFactory.destroy({ canvas, context });
  return png;
}

async function convertImage(buffer) {
  const cfg = getConfig();
  let meta;
  try {
    meta = await sharp(buffer, { failOn: 'error' }).metadata();
  } catch (err) {
    throw new ConversionError(`Imagem inválida: ${err.message}`);
  }
  const count = meta.pages ?? 1;
  if (count > cfg.MAX_PAGES) {
    throw new ConversionError(`A imagem tem ${count} páginas; o limite é ${cfg.MAX_PAGES}`);
  }
  const pages = [];
  for (let i = 0; i < count; i += 1) {
    const png = await sharp(buffer, { page: i }).rotate().png().toBuffer(); // rotate() aplica EXIF
    pages.push({ pageNumber: i + 1, nativeText: null, image: png });
  }
  return pages;
}

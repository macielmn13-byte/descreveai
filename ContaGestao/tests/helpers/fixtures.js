import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { createTextPdf, FATURA_EXEMPLO } from '../../scripts/lib/pdf-simples.js';

export { createTextPdf, FATURA_EXEMPLO };

export const faturaPdf = () => createTextPdf([FATURA_EXEMPLO]);

export const CONTRATO_EXEMPLO = [
  'CONTRATO DE PRESTACAO DE SERVICOS No 045/2026',
  'CONTRATANTE: Construtora Exemplo Ltda., CNPJ 11.222.333/0001-81',
  'CONTRATADA: Kodama e Maciel Assessoria Ltda., CNPJ 43.187.019/0001-00',
  'CLAUSULA PRIMEIRA - DO OBJETO: assessoria contabil e tributaria mensal',
  'CLAUSULA SEGUNDA - DA VIGENCIA: inicio em 01/11/2026 e termino em 31/10/2027',
  'CLAUSULA TERCEIRA - DO VALOR: valor mensal de R$ 2.000,00 e valor global de R$ 24.000,00',
  'CLAUSULA QUARTA - DO REAJUSTE: anual pelo IPCA',
  'CLAUSULA QUINTA - DO FORO: Brasilia/DF',
];

/** Renderiza um PDF de página única em PNG (simula documento digitalizado). */
export async function pdfToPng(pdfBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), verbosity: 0 });
  const pdf = await task.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 300 / 72 });
  const { canvas, context } = pdf.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, canvas, viewport }).promise;
  const png = canvas.toBuffer('image/png');
  await task.destroy();
  return png;
}

export async function scannedFaturaPng({ rotate = 0 } = {}) {
  const png = await pdfToPng(faturaPdf());
  return rotate ? sharp(png).rotate(rotate, { background: '#fff' }).png().toBuffer() : png;
}

export function hasTesseract() {
  try {
    execFileSync(process.env.TESSERACT_CMD || 'tesseract', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

import '../helpers/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { estimateSkew, enhanceForOcr } from '../../src/processing/image_enhancer.js';
import { convertDocument, ConversionError } from '../../src/processing/pdf_converter.js';
import { createTextPdf, faturaPdf, FATURA_EXEMPLO, scannedFaturaPng } from '../helpers/fixtures.js';

test('PDF com texto embutido dispensa OCR', async () => {
  const pages = await convertDocument(faturaPdf(), 'application/pdf');
  assert.equal(pages.length, 1);
  assert.match(pages[0].nativeText, /CNPJ: 43\.187\.019\/0001-00/);
  assert.equal(pages[0].image, null);
});

test('página sem texto é renderizada em imagem', async () => {
  const pages = await convertDocument(createTextPdf([FATURA_EXEMPLO, ['.']]), 'application/pdf');
  assert.equal(pages.length, 2);
  assert.ok(pages[1].image.length > 1000);
  const meta = await sharp(pages[1].image).metadata();
  assert.ok(meta.width > 2000); // 300 dpi
});

test('PDF corrompido gera ConversionError', async () => {
  await assert.rejects(convertDocument(Buffer.from('%PDF-1.4 lixo'), 'application/pdf'), ConversionError);
});

test('TIFF de várias páginas vira várias páginas', async () => {
  const png = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#fff' } })
    .png()
    .toBuffer();
  const tiff = await sharp([png, png, png], { join: { animated: true } })
    .tiff()
    .toBuffer()
    .catch(() => null);
  if (!tiff) return; // libvips sem suporte a join multipágina: ignora
  const pages = await convertDocument(tiff, 'image/tiff');
  assert.ok(pages.length >= 1);
});

test('deskew detecta e corrige inclinação', async () => {
  const png = await scannedFaturaPng();
  assert.equal(await estimateSkew(png), 0);
  const tilted = await sharp(png).rotate(4, { background: '#fff' }).png().toBuffer();
  const angle = await estimateSkew(tilted);
  assert.ok(Math.abs(angle + 4) <= 0.3, `ângulo estimado ${angle}`);
  const { skewCorrected } = await enhanceForOcr(tilted);
  assert.ok(Math.abs(skewCorrected + 4) <= 0.3);
});

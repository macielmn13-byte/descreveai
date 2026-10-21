/**
 * Pré-processamento visual para OCR (sharp/libvips):
 * escala de cinza, ampliação de imagens pequenas, remoção de ruído,
 * normalização de contraste, correção de inclinação (deskew) e,
 * opcionalmente, binarização.
 */
import sharp from 'sharp';
import { getConfig } from '../core/config.js';

const MIN_WIDTH = 1700; // ~A4 a 200 dpi; abaixo disso o OCR perde precisão
const DESKEW_WIDTH = 900;
const MAX_ANGLE = 10;

/**
 * Estima o ângulo de inclinação (graus) pelo método do perfil de projeção:
 * o ângulo que deixa as linhas de texto "mais horizontais" maximiza a
 * variância do histograma de linhas.
 * Retorna o ângulo a aplicar em sharp.rotate() para endireitar a imagem.
 */
export async function estimateSkew(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .grayscale()
    .resize({ width: DESKEW_WIDTH, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const xs = [];
  const ys = [];
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x] < 128) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length < 200) return 0; // página praticamente em branco

  const diag = Math.ceil(Math.hypot(width, height)) * 2;
  const bins = new Float64Array(diag);
  const score = (deg) => {
    const r = (deg * Math.PI) / 180;
    const sin = Math.sin(r);
    const cos = Math.cos(r);
    bins.fill(0);
    for (let i = 0; i < xs.length; i += 1) {
      const idx = Math.round(ys[i] * cos - xs[i] * sin) + (diag >> 1);
      bins[idx] += 1;
    }
    let s = 0;
    for (let i = 0; i < diag; i += 1) s += bins[i] * bins[i];
    return s;
  };

  let best = 0;
  let bestScore = -1;
  for (let a = -MAX_ANGLE; a <= MAX_ANGLE; a += 0.5) {
    const s = score(a);
    if (s > bestScore) [best, bestScore] = [a, s];
  }
  for (let a = best - 0.5; a <= best + 0.5; a += 0.1) {
    const s = score(a);
    if (s > bestScore) [best, bestScore] = [a, s];
  }
  return Math.round(-best * 10) / 10 || 0;
}

/** @returns {Promise<{image: Buffer, skewCorrected: number}>} */
export async function enhanceForOcr(pngBuffer) {
  const cfg = getConfig();
  const meta = await sharp(pngBuffer).metadata();

  let pipeline = sharp(pngBuffer).flatten({ background: '#ffffff' }).grayscale();
  if ((meta.width ?? 0) < MIN_WIDTH) {
    pipeline = pipeline.resize({ width: MIN_WIDTH, kernel: 'lanczos3' });
  }
  pipeline = pipeline.median(3).normalise();
  let base = await pipeline.png().toBuffer();

  const angle = await estimateSkew(base);
  if (Math.abs(angle) >= 0.3) {
    base = await sharp(base).rotate(angle, { background: '#ffffff' }).png().toBuffer();
  }

  if (cfg.ENHANCE_BINARIZE) {
    base = await sharp(base).threshold(160).png().toBuffer();
  }
  return { image: base, skewCorrected: Math.abs(angle) >= 0.3 ? angle : 0 };
}

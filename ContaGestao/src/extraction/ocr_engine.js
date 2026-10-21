/**
 * Mecanismo de OCR.
 *
 * - tesseract (padrão): executa o Tesseract 5 instalado no sistema
 *   (no Docker já vem com o idioma português). Saída TSV com confiança.
 * - textract: AWS Textract (DetectDocumentText), para alto volume ou
 *   documentos muito degradados.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { getConfig } from '../core/config.js';
import { logger } from '../core/logger.js';

const run = promisify(execFile);
const EXEC_OPTS = { maxBuffer: 64 * 1024 * 1024, timeout: 180_000 };

export class OcrError extends Error {}

/**
 * @typedef {object} OcrPage
 * @property {string} text
 * @property {number|null} confidence  0–100
 */

// ------------------------------------------------------------- Tesseract

let langCache = null;

export async function resolveTesseractLang() {
  if (langCache) return langCache;
  const cfg = getConfig();
  const wanted = cfg.TESSERACT_LANG.split('+').filter(Boolean);
  let available = [];
  try {
    const { stdout, stderr } = await run(cfg.TESSERACT_CMD, ['--list-langs'], EXEC_OPTS);
    available = `${stdout}\n${stderr}`
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('List of'));
  } catch (err) {
    throw new OcrError(`Tesseract não encontrado ("${cfg.TESSERACT_CMD}"): ${err.message}`);
  }
  const usable = wanted.filter((l) => available.includes(l));
  if (usable.length !== wanted.length) {
    logger.warn(
      { wanted, available },
      'Idiomas do Tesseract ausentes (instale tesseract-ocr-por). Usando os disponíveis.',
    );
  }
  langCache = (usable.length ? usable : available.filter((l) => l !== 'osd').slice(0, 1)).join('+');
  if (!langCache) throw new OcrError('Nenhum idioma do Tesseract instalado');
  return langCache;
}

async function withTempFile(buffer, fn) {
  const file = path.join(os.tmpdir(), `cg-ocr-${crypto.randomUUID()}.png`);
  await fs.writeFile(file, buffer, { mode: 0o600 });
  try {
    return await fn(file);
  } finally {
    await fs.rm(file, { force: true });
  }
}

/** Corrige páginas giradas 90/180/270° (detecção de orientação do Tesseract). */
async function autoRotate(image) {
  const cfg = getConfig();
  try {
    const { stdout } = await withTempFile(image, (file) =>
      run(cfg.TESSERACT_CMD, [file, 'stdout', '--psm', '0'], EXEC_OPTS),
    );
    const rotate = Number(stdout.match(/Rotate:\s*(\d+)/)?.[1] ?? 0);
    const conf = Number(stdout.match(/Orientation confidence:\s*([\d.]+)/)?.[1] ?? 0);
    if (rotate && conf >= 2) {
      logger.debug({ rotate, conf }, 'Página girada automaticamente');
      return sharp(image).rotate(rotate).png().toBuffer();
    }
  } catch {
    /* pouca área de texto para detectar orientação: segue sem girar */
  }
  return image;
}

export function parseTesseractTsv(tsv) {
  const lines = new Map();
  const confs = [];
  for (const row of tsv.split('\n').slice(1)) {
    const cols = row.split('\t');
    if (cols.length < 12 || cols[0] !== '5') continue; // nível 5 = palavra
    const word = cols[11].trim();
    const conf = Number(cols[10]);
    if (!word) continue;
    const key = `${cols[2]}-${cols[3]}-${cols[4]}`; // bloco-parágrafo-linha
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(word);
    if (conf >= 0) confs.push(conf);
  }
  const text = [...lines.values()].map((w) => w.join(' ')).join('\n');
  const confidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null;
  return { text, confidence };
}

async function tesseractOcr(image) {
  const cfg = getConfig();
  const lang = await resolveTesseractLang();
  const img = cfg.OCR_AUTO_ROTATE ? await autoRotate(image) : image;
  try {
    const { stdout } = await withTempFile(img, (file) =>
      run(
        cfg.TESSERACT_CMD,
        [
          file,
          'stdout',
          '-l',
          lang,
          '--oem',
          '1',
          '--psm',
          String(cfg.TESSERACT_PSM),
          '-c',
          'preserve_interword_spaces=1',
          'tsv',
        ],
        EXEC_OPTS,
      ),
    );
    return parseTesseractTsv(stdout);
  } catch (err) {
    throw new OcrError(`Falha no Tesseract: ${err.message}`);
  }
}

// --------------------------------------------------------------- Textract

let textractClient = null;

async function textractOcr(image) {
  const { TextractClient, DetectDocumentTextCommand } = await import('@aws-sdk/client-textract');
  textractClient ??= new TextractClient({ region: getConfig().AWS_REGION });
  let bytes = image;
  if (bytes.length > 9.5 * 1024 * 1024) {
    bytes = await sharp(image).jpeg({ quality: 85 }).toBuffer(); // limite síncrono: 10 MB
  }
  try {
    const out = await textractClient.send(new DetectDocumentTextCommand({ Document: { Bytes: bytes } }));
    const lines = (out.Blocks ?? []).filter((b) => b.BlockType === 'LINE');
    const text = lines.map((b) => b.Text).join('\n');
    const confidence = lines.length ? lines.reduce((a, b) => a + (b.Confidence ?? 0), 0) / lines.length : null;
    return { text, confidence };
  } catch (err) {
    throw new OcrError(`Falha no AWS Textract: ${err.message}`);
  }
}

/** @returns {Promise<OcrPage>} */
export async function runOcr(image) {
  return getConfig().OCR_ENGINE === 'textract' ? textractOcr(image) : tesseractOcr(image);
}

export async function checkOcr() {
  if (getConfig().OCR_ENGINE === 'textract') return true;
  try {
    await resolveTesseractLang();
    return true;
  } catch {
    return false;
  }
}

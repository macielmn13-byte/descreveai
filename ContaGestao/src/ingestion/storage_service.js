/**
 * Armazenamento dos arquivos originais (disco local ou S3 compatível).
 *
 * Todo arquivo é criptografado pela aplicação (AES-256-GCM) ANTES de ser
 * gravado, em qualquer backend. No S3 também é pedida criptografia SSE.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '../core/config.js';
import { encryptBuffer, decryptBuffer } from '../core/security.js';
import { logger } from '../core/logger.js';

export class StorageError extends Error {}

export function buildKey(documentId, extension) {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${day}/${documentId}.${extension.toLowerCase()}.enc`;
}

class LocalStorage {
  constructor(root) {
    this.root = path.resolve(root);
  }

  resolve(key) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new StorageError('Chave de armazenamento inválida');
    return full;
  }

  async put(key, data) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.tmp`;
    await fs.writeFile(tmp, data, { mode: 0o600 });
    await fs.rename(tmp, full); // escrita atômica
  }

  async get(key) {
    try {
      return await fs.readFile(this.resolve(key));
    } catch (err) {
      if (err.code === 'ENOENT') throw new StorageError(`Arquivo não encontrado: ${key}`);
      throw err;
    }
  }

  async remove(key) {
    await fs.rm(this.resolve(key), { force: true });
  }

  async check() {
    await fs.mkdir(this.root, { recursive: true });
    await fs.access(this.root, fs.constants.W_OK);
    return true;
  }
}

class S3Storage {
  constructor(cfg) {
    this.cfg = cfg;
    this.bucket = cfg.S3_BUCKET;
    this.prefix = cfg.S3_PREFIX;
    this.sse = !cfg.S3_ENDPOINT_URL; // MinIO local nem sempre suporta SSE
    this.clientPromise = import('@aws-sdk/client-s3').then((m) => {
      this.cmd = m;
      return new m.S3Client({
        region: cfg.AWS_REGION,
        ...(cfg.S3_ENDPOINT_URL ? { endpoint: cfg.S3_ENDPOINT_URL } : {}),
        forcePathStyle: cfg.S3_FORCE_PATH_STYLE,
      });
    });
  }

  async put(key, data) {
    const client = await this.clientPromise;
    await client.send(
      new this.cmd.PutObjectCommand({
        Bucket: this.bucket,
        Key: this.prefix + key,
        Body: data,
        ...(this.sse ? { ServerSideEncryption: 'AES256' } : {}),
      }),
    );
  }

  async get(key) {
    const client = await this.clientPromise;
    try {
      const out = await client.send(new this.cmd.GetObjectCommand({ Bucket: this.bucket, Key: this.prefix + key }));
      return Buffer.from(await out.Body.transformToByteArray());
    } catch (err) {
      if (err.name === 'NoSuchKey') throw new StorageError(`Arquivo não encontrado: ${key}`);
      throw err;
    }
  }

  async remove(key) {
    const client = await this.clientPromise;
    await client.send(new this.cmd.DeleteObjectCommand({ Bucket: this.bucket, Key: this.prefix + key }));
  }

  async check() {
    const client = await this.clientPromise;
    await client.send(new this.cmd.HeadBucketCommand({ Bucket: this.bucket }));
    return true;
  }
}

let backend = null;

function getBackend() {
  if (backend) return backend;
  const cfg = getConfig();
  if (cfg.STORAGE_BACKEND === 's3') {
    logger.info({ bucket: cfg.S3_BUCKET }, 'Armazenamento: S3');
    backend = new S3Storage(cfg);
  } else {
    logger.info({ path: cfg.STORAGE_LOCAL_PATH }, 'Armazenamento: local');
    backend = new LocalStorage(cfg.STORAGE_LOCAL_PATH);
  }
  return backend;
}

/** Apenas para testes. */
export function resetStorage() {
  backend = null;
}

export async function saveFile(key, data) {
  await getBackend().put(key, encryptBuffer(data));
  return key;
}

export async function loadFile(key) {
  return decryptBuffer(await getBackend().get(key));
}

export async function deleteFile(key) {
  await getBackend().remove(key);
}

export async function checkStorage() {
  try {
    return await getBackend().check();
  } catch {
    return false;
  }
}

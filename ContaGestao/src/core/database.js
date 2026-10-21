/**
 * Conexão com o banco de dados (Knex).
 * PostgreSQL em produção; SQLite (better-sqlite3) em desenvolvimento e testes.
 *
 * DATABASE_URL:
 *   postgres://usuario:senha@host:5432/contagestao
 *   sqlite:./data/contagestao.db      (arquivo)
 *   sqlite::memory:                   (memória — testes)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import knexFactory from 'knex';
import { getConfig } from './config.js';
import { logger } from './logger.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const MIGRATIONS_DIR = path.join(ROOT, 'migrations');

export function buildKnexConfig(url = getConfig().DATABASE_URL) {
  const cfg = getConfig();
  const migrations = { directory: MIGRATIONS_DIR, loadExtensions: ['.js'], tableName: 'knex_migrations' };

  if (url.startsWith('sqlite:')) {
    const file = url.slice('sqlite:'.length) || ':memory:';
    if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    return {
      client: 'better-sqlite3',
      connection: { filename: file },
      useNullAsDefault: true,
      pool: {
        min: 1,
        max: 1, // SQLite: uma conexão (necessário para :memory:)
        afterCreate: (conn, done) => {
          conn.pragma('foreign_keys = ON');
          if (file !== ':memory:') conn.pragma('journal_mode = WAL');
          done();
        },
      },
      migrations,
    };
  }

  return {
    client: 'pg',
    connection: url,
    pool: { min: 0, max: cfg.DB_POOL_MAX },
    acquireConnectionTimeout: 15000,
    migrations,
  };
}

let instance = null;

export function getDb() {
  if (!instance) instance = knexFactory(buildKnexConfig());
  return instance;
}

export async function migrate() {
  const [batch, applied] = await getDb().migrate.latest();
  if (applied.length) logger.info({ batch, applied }, 'Migrações aplicadas');
}

export async function checkDb() {
  try {
    await getDb().raw('select 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeDb() {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}

// ----------------------------------------------------------- utilidades

export const nowIso = () => new Date().toISOString();

/** JSON portátil entre PostgreSQL (jsonb) e SQLite (texto). */
export const toJson = (value) => JSON.stringify(value ?? null);
export function fromJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

export const toIso = (value) => (value instanceof Date ? value.toISOString() : (value ?? null));

/**
 * Aplica as migrações pendentes do banco (npm run migrate).
 * Use "npm run migrate -- --rollback" para desfazer o último lote.
 */
import { getDb, migrate, closeDb } from '../src/core/database.js';
import { logger } from '../src/core/logger.js';

try {
  if (process.argv.includes('--rollback')) {
    const [batch, log] = await getDb().migrate.rollback();
    logger.info({ batch, desfeitas: log }, 'Rollback concluído');
  } else {
    await migrate();
    const [done, pending] = await getDb().migrate.list();
    logger.info({ aplicadas: done.length, pendentes: pending.length }, 'Banco atualizado');
  }
  await closeDb();
} catch (err) {
  logger.error({ err }, 'Falha na migração');
  await closeDb();
  process.exit(1);
}

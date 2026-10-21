/**
 * Estrutura inicial do banco do ContaGestão.
 * Compatível com PostgreSQL e SQLite.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('documents', (t) => {
    t.string('id', 36).primary();
    t.string('filename', 255).notNullable();
    t.string('content_type', 100).notNullable();
    t.integer('size_bytes').notNullable();
    t.string('sha256', 64).notNullable().index();
    t.string('storage_key', 512).notNullable();
    t.string('source', 20).notNullable().defaultTo('upload');
    t.string('sender', 320);
    t.string('requested_type', 20).notNullable().defaultTo('auto');
    t.string('document_type', 20).index();
    t.string('status', 20).notNullable().defaultTo('recebido').index();
    t.text('error_message');
    t.integer('pages');
    t.text('ocr_text'); // criptografado (AES-256-GCM) pela aplicação
    t.float('ocr_confidence');
    t.boolean('used_native_text').notNullable().defaultTo(false);
    t.timestamp('created_at', { useTz: true }).notNullable().index();
    t.timestamp('updated_at', { useTz: true }).notNullable();
    t.timestamp('processed_at', { useTz: true });
  });

  await knex.schema.createTable('extraction_results', (t) => {
    t.string('id', 36).primary();
    t.string('document_id', 36).notNullable().unique().references('id').inTable('documents').onDelete('CASCADE');
    t.json('data').notNullable();
    t.json('errors').notNullable();
    t.json('warnings').notNullable();
    t.boolean('is_valid').notNullable().defaultTo(false);
    t.string('llm_provider', 30).notNullable();
    t.string('llm_model', 100);
    t.timestamp('created_at', { useTz: true }).notNullable();
    t.timestamp('updated_at', { useTz: true }).notNullable();
  });

  await knex.schema.createTable('webhook_deliveries', (t) => {
    t.string('id', 36).primary();
    t.string('document_id', 36).notNullable().references('id').inTable('documents').onDelete('CASCADE').index();
    t.string('event', 50).notNullable();
    t.string('url', 1000).notNullable();
    t.boolean('success').notNullable().defaultTo(false);
    t.integer('status_code');
    t.integer('attempts').notNullable().defaultTo(0);
    t.text('last_error');
    t.timestamp('created_at', { useTz: true }).notNullable();
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('webhook_deliveries');
  await knex.schema.dropTableIfExists('extraction_results');
  await knex.schema.dropTableIfExists('documents');
}

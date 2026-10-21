import { TEST_API_KEY } from '../helpers/env.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { migrate, closeDb } from '../../src/core/database.js';
import { createApp } from '../../src/app.js';
import { faturaPdf, createTextPdf, CONTRATO_EXEMPLO } from '../helpers/fixtures.js';

let app;
const auth = { 'X-API-Key': TEST_API_KEY };

before(async () => {
  await migrate();
  app = createApp();
});
after(closeDb);

test('health e readiness', async () => {
  const h = await request(app).get('/health');
  assert.equal(h.status, 200);
  assert.equal(h.body.status, 'ok');
  const r = await request(app).get('/health/ready');
  assert.equal(r.body.checks.banco, true);
  assert.equal(r.body.checks.armazenamento, true);
});

test('rotas da API exigem chave', async () => {
  assert.equal((await request(app).get('/api/v1/documentos')).status, 401);
  assert.equal((await request(app).get('/api/v1/documentos').set('X-API-Key', 'errada')).status, 401);
  assert.equal((await request(app).get('/api/v1/documentos').set(auth)).status, 200);
});

test('fluxo completo: upload -> processamento -> resultado -> exportação -> exclusão', async () => {
  const pdf = faturaPdf();
  const up = await request(app).post('/api/v1/documentos').set(auth).attach('arquivo', pdf, 'Nota fiscal nº 123.pdf');
  assert.equal(up.status, 202, JSON.stringify(up.body));
  assert.equal(up.body.duplicado, false);
  assert.equal(up.body.documento.nomeArquivo, 'Nota fiscal nº 123.pdf');
  assert.equal(up.body.documento.storageKey, undefined);
  const id = up.body.documento.id;

  const doc = await request(app).get(`/api/v1/documentos/${id}`).set(auth);
  assert.equal(doc.body.status, 'concluido', doc.body.erro);
  assert.equal(doc.body.tipoDocumento, 'fatura');
  assert.equal(doc.body.textoNativo, true);

  const res = await request(app).get(`/api/v1/documentos/${id}/resultado`).set(auth);
  assert.equal(res.status, 200);
  assert.equal(res.body.valido, true);
  assert.equal(res.body.dados.emitente.cnpj, '43187019000100');
  assert.equal(res.body.dados.valor_total, 1500);
  assert.equal(res.body.provedorLlm, 'heuristico');

  const txt = await request(app).get(`/api/v1/documentos/${id}/texto`).set(auth);
  assert.match(txt.text, /NOTA FISCAL/);

  const file = await request(app)
    .get(`/api/v1/documentos/${id}/arquivo`)
    .set(auth)
    .buffer(true)
    .parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
  assert.ok(Buffer.compare(file.body, pdf) === 0, 'arquivo baixado difere do original');

  const dup = await request(app).post('/api/v1/documentos').set(auth).attach('arquivo', pdf, 'copia.pdf');
  assert.equal(dup.status, 200);
  assert.equal(dup.body.duplicado, true);
  assert.equal(dup.body.documento.id, id);

  const list = await request(app).get('/api/v1/documentos?status=concluido&tipo=fatura').set(auth);
  assert.equal(list.body.total, 1);

  const csv = await request(app).get('/api/v1/exportacoes?formato=csv').set(auth);
  assert.equal(csv.status, 200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.match(csv.text, /43187019000100/);

  const xlsx = await request(app)
    .get('/api/v1/exportacoes?formato=xlsx')
    .set(auth)
    .buffer(true)
    .parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsx.body);
  assert.equal(wb.getWorksheet('Documentos').rowCount, 2);

  const rep = await request(app).post(`/api/v1/documentos/${id}/reprocessar`).set(auth);
  assert.equal(rep.status, 202);
  assert.equal(rep.body.status, 'concluido');

  assert.equal((await request(app).delete(`/api/v1/documentos/${id}`).set(auth)).status, 204);
  assert.equal((await request(app).get(`/api/v1/documentos/${id}`).set(auth)).status, 404);
});

test('contrato com tipo informado', async () => {
  const up = await request(app)
    .post('/api/v1/documentos')
    .set(auth)
    .field('tipo_documento', 'contrato')
    .attach('arquivo', createTextPdf([CONTRATO_EXEMPLO]), 'contrato.pdf');
  assert.equal(up.status, 202);
  const res = await request(app).get(`/api/v1/documentos/${up.body.documento.id}/resultado`).set(auth);
  assert.equal(res.body.documento.tipoDocumento, 'contrato');
  assert.equal(res.body.dados.valor_global, 24000);
  assert.equal(res.body.dados.partes.length, 2);
});

test('validações de upload', async () => {
  const noFile = await request(app).post('/api/v1/documentos').set(auth);
  assert.equal(noFile.status, 400);

  const badExt = await request(app).post('/api/v1/documentos').set(auth).attach('arquivo', Buffer.from('x'), 'a.exe');
  assert.equal(badExt.status, 415);

  const fake = await request(app)
    .post('/api/v1/documentos')
    .set(auth)
    .attach('arquivo', Buffer.from('não sou pdf'), 'a.pdf');
  assert.equal(fake.status, 415);

  const badType = await request(app)
    .post('/api/v1/documentos')
    .set(auth)
    .field('tipo_documento', 'boleto')
    .attach('arquivo', faturaPdf(), 'b.pdf');
  assert.equal(badType.status, 400);

  const badQuery = await request(app).get('/api/v1/documentos?status=xyz').set(auth);
  assert.equal(badQuery.status, 400);

  const badId = await request(app).get('/api/v1/documentos/123').set(auth);
  assert.equal(badId.status, 400);
});

test('PDF ilegível fica com status erro', async () => {
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('conteudo quebrado')]);
  const up = await request(app).post('/api/v1/documentos').set(auth).attach('arquivo', pdf, 'quebrado.pdf');
  const doc = await request(app).get(`/api/v1/documentos/${up.body.documento.id}`).set(auth);
  assert.equal(doc.body.status, 'erro');
  assert.match(doc.body.erro, /PDF inválido/);
  const res = await request(app).get(`/api/v1/documentos/${up.body.documento.id}/resultado`).set(auth);
  assert.equal(res.status, 409);
});

test('webhook de e-mail: token e anexos', async () => {
  const semToken = await request(app).post('/api/v1/email/entrada').attach('attachment1', faturaPdf(), 'n.pdf');
  assert.equal(semToken.status, 401);

  const ok = await request(app)
    .post('/api/v1/email/entrada')
    .set('X-Webhook-Token', 'segredo-email-teste')
    .field('from', 'Fornecedor <financeiro@fornecedor.com.br>')
    .field('subject', 'Envio de contrato assinado')
    .attach('attachment1', createTextPdf([[...CONTRATO_EXEMPLO, 'Recebido por e-mail']]), 'contrato-email.pdf')
    .attach('attachment2', Buffer.from('texto'), 'leiame.txt');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.remetente, 'financeiro@fornecedor.com.br');
  assert.equal(ok.body.aceitos.length, 1);
  assert.equal(ok.body.recusados.length, 1);

  const doc = await request(app).get(`/api/v1/documentos/${ok.body.aceitos[0].documentoId}`).set(auth);
  assert.equal(doc.body.origem, 'email');
  assert.equal(doc.body.tipoSolicitado, 'contrato');
});

test('rota inexistente devolve 404 em JSON', async () => {
  const r = await request(app).get('/nao-existe');
  assert.equal(r.status, 404);
  assert.match(r.body.erro, /Rota não encontrada/);
});

import '../helpers/env.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { resetConfig } from '../../src/core/config.js';
import { migrate, closeDb } from '../../src/core/database.js';
import { verifySignature } from '../../src/core/security.js';
import { getResult, listWebhookDeliveries } from '../../src/core/repository.js';
import { ingestFile } from '../../src/ingestion/intake.js';
import { processDocument } from '../../src/pipeline.js';
import { setLlmClientForTests, resetLlmClients } from '../../src/extraction/llm_parser.js';
import { faturaPdf, scannedFaturaPng, hasTesseract } from '../helpers/fixtures.js';

let server;
let received = [];
let failNext = 0;

before(async () => {
  await migrate();
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (failNext > 0) {
        failNext -= 1;
        res.writeHead(503).end();
        return;
      }
      received.push({ headers: req.headers, body });
      res.writeHead(200).end('ok');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.WEBHOOK_URLS = `http://127.0.0.1:${server.address().port}/hook`;
  process.env.WEBHOOK_SECRET = 'segredo-webhook';
  resetConfig();
});

after(async () => {
  server.close();
  await closeDb();
});

test(
  'documento digitalizado (imagem inclinada) passa por OCR real',
  { skip: !hasTesseract() && 'Tesseract não instalado' },
  async () => {
    const png = await scannedFaturaPng({ rotate: 3 });
    const { document } = await ingestFile({ filename: 'digitalizada.png', content: png });
    const status = await processDocument(document.id);
    const result = await getResult(document.id);
    assert.ok(['concluido', 'revisao'].includes(status), JSON.stringify(result?.erros));
    assert.equal(result.valido, status === 'concluido');
    assert.match(result.dados.emitente.razao_social, /Kodama/i);
    assert.equal(result.dados.valor_total, 1500);
  },
);

test('LLM simulado + webhook assinado com nova tentativa', async () => {
  process.env.LLM_PROVIDER = 'anthropic';
  resetConfig();
  setLlmClientForTests('anthropic', {
    messages: {
      create: async () => ({
        model: 'claude-teste',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              tipo_documento: 'NFS-e',
              numero: '123',
              data_emissao: '2026-10-05',
              emitente: { razao_social: 'Kodama', cnpj: '43187019000100' },
              destinatario: { nome: 'Construtora', cpf_cnpj: '11222333000181' },
              itens: [{ descricao: 'Assessoria', quantidade: 1, valor_unitario: 1500, valor_total: 1500 }],
              valor_produtos_servicos: 1500,
              valor_total: 1500,
            }),
          },
        ],
      }),
    },
  });
  received = [];
  failNext = 1; // primeira tentativa falha (503), a segunda entrega

  const pdf = Buffer.concat([faturaPdf(), Buffer.from('\n% variante\n')]);
  const { document } = await ingestFile({ filename: 'nota.pdf', content: pdf });
  assert.equal(await processDocument(document.id), 'concluido');

  const result = await getResult(document.id);
  assert.equal(result.provedorLlm, 'anthropic');
  assert.equal(result.modeloLlm, 'claude-teste');
  assert.equal(result.dados.itens.length, 1);

  assert.equal(received.length, 1);
  const { headers, body } = received[0];
  assert.equal(headers['x-contagestao-event'], 'documento.concluido');
  assert.ok(
    verifySignature(body, 'segredo-webhook', headers['x-contagestao-timestamp'], headers['x-contagestao-signature']),
  );
  assert.equal(JSON.parse(body).dados.valor_total, 1500);

  const deliveries = await listWebhookDeliveries(document.id);
  assert.equal(deliveries[0].sucesso, true);
  assert.equal(deliveries[0].tentativas, 2);

  process.env.LLM_PROVIDER = 'none';
  resetConfig();
  resetLlmClients();
});

test('documento reprovado nas regras vai para revisão', async () => {
  const { createTextPdf, FATURA_EXEMPLO } = await import('../helpers/fixtures.js');
  const linhas = FATURA_EXEMPLO.map((l) => l.replace('43.187.019/0001-00', '43.187.019/0001-99'));
  const { document } = await ingestFile({ filename: 'cnpj-errado.pdf', content: createTextPdf([linhas]) });
  assert.equal(await processDocument(document.id), 'revisao');
  const result = await getResult(document.id);
  assert.ok(result.erros.some((e) => e.includes('CNPJ do emitente inválido')));
});

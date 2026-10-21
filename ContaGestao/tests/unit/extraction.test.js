import '../helpers/env.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetConfig } from '../../src/core/config.js';
import { classifyDocument } from '../../src/extraction/classifier.js';
import { heuristicExtract } from '../../src/extraction/heuristic_parser.js';
import {
  extractJson,
  buildMessages,
  loadPrompt,
  parseWithLlm,
  setLlmClientForTests,
  resetLlmClients,
} from '../../src/extraction/llm_parser.js';
import { parseTesseractTsv } from '../../src/extraction/ocr_engine.js';
import { FATURA_EXEMPLO, CONTRATO_EXEMPLO } from '../helpers/fixtures.js';

afterEach(() => {
  process.env.LLM_PROVIDER = 'none';
  resetConfig();
  resetLlmClients();
});

test('classificador identifica fatura, contrato e formulário', () => {
  assert.equal(classifyDocument(FATURA_EXEMPLO.join('\n')).tipo, 'fatura');
  assert.equal(classifyDocument(CONTRATO_EXEMPLO.join('\n')).tipo, 'contrato');
  assert.equal(classifyDocument('FICHA CADASTRAL\nNome: Ana\nTelefone: 61 9999').tipo, 'formulario');
});

test('extração heurística de fatura', () => {
  const d = heuristicExtract('fatura', FATURA_EXEMPLO.join('\n'));
  assert.equal(d.emitente.cnpj, '43.187.019/0001-00');
  assert.equal(d.destinatario.cpf_cnpj, '11.222.333/0001-81');
  assert.equal(d.valor_total, '1.500,00');
  assert.equal(d.data_vencimento, '20/10/2026');
  assert.equal(d.tipo_documento, 'NFS-e');
});

test('extração heurística de contrato', () => {
  const d = heuristicExtract('contrato', CONTRATO_EXEMPLO.join('\n'));
  assert.equal(d.partes.length, 2);
  assert.equal(d.partes[0].papel, 'contratante');
  assert.equal(d.valor_global, '24.000,00');
  assert.equal(d.valor_mensal, '2.000,00');
  assert.equal(d.indice_reajuste, 'IPCA');
});

test('extractJson aceita blocos ```json e texto ao redor', () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJson('```json\n{"a":2}\n```'), { a: 2 });
  assert.deepEqual(extractJson('Segue:\n{"a":3}\nFim.'), { a: 3 });
  assert.throws(() => extractJson('sem json'), /JSON válido/);
});

test('prompts carregam e as mensagens incluem esquema e texto', () => {
  for (const tipo of ['fatura', 'contrato', 'formulario']) {
    const p = loadPrompt(tipo);
    assert.equal(p.tipo, tipo);
    assert.ok(p.sistema && p.instrucoes.length && p.esquema);
  }
  const { system, user } = buildMessages('fatura', 'TEXTO-OCR');
  assert.match(system, /documentos fiscais/);
  assert.match(user, /<documento>\nTEXTO-OCR\n<\/documento>/);
  assert.match(user, /"chave_acesso"/);
});

test('texto muito longo é truncado preservando início e fim', () => {
  process.env.LLM_MAX_INPUT_CHARS = '100';
  resetConfig();
  const { user } = buildMessages('fatura', `INICIO${'x'.repeat(500)}FIM`);
  assert.match(user, /INICIO/);
  assert.match(user, /FIM/);
  assert.match(user, /trecho omitido/);
  delete process.env.LLM_MAX_INPUT_CHARS;
});

test('provedor Anthropic (cliente simulado)', async () => {
  process.env.LLM_PROVIDER = 'anthropic';
  resetConfig();
  let captured;
  setLlmClientForTests('anthropic', {
    messages: {
      create: async (args) => {
        captured = args;
        return { model: 'claude-teste', stop_reason: 'end_turn', content: [{ type: 'text', text: '{"numero":"77"}' }] };
      },
    },
  });
  const out = await parseWithLlm('fatura', 'texto');
  assert.deepEqual(out, { data: { numero: '77' }, provider: 'anthropic', model: 'claude-teste' });
  assert.equal(captured.model, 'claude-sonnet-5-5');
  assert.equal(captured.messages[0].role, 'user');
});

test('provedor OpenAI (cliente simulado) e falha vira LlmError', async () => {
  process.env.LLM_PROVIDER = 'openai';
  resetConfig();
  setLlmClientForTests('openai', {
    chat: {
      completions: { create: async () => ({ model: 'gpt-teste', choices: [{ message: { content: '{"x":1}' } }] }) },
    },
  });
  assert.deepEqual((await parseWithLlm('contrato', 't')).data, { x: 1 });
  setLlmClientForTests('openai', {
    chat: {
      completions: {
        create: async () => {
          throw new Error('429');
        },
      },
    },
  });
  await assert.rejects(parseWithLlm('contrato', 't'), /Falha na chamada ao LLM/);
});

test('parse do TSV do Tesseract reconstrói linhas e confiança', () => {
  const tsv = [
    'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
    '5\t1\t1\t1\t1\t1\t0\t0\t1\t1\t90\tNOTA',
    '5\t1\t1\t1\t1\t2\t0\t0\t1\t1\t80\tFISCAL',
    '5\t1\t1\t1\t2\t1\t0\t0\t1\t1\t70\tCNPJ',
    '4\t1\t1\t1\t2\t0\t0\t0\t1\t1\t-1\t',
  ].join('\n');
  const r = parseTesseractTsv(tsv);
  assert.equal(r.text, 'NOTA FISCAL\nCNPJ');
  assert.equal(r.confidence, 80);
});

import '../helpers/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, parseDate, normalizeExtraction } from '../../src/validation/schemas.js';

test('parseMoney: formatos brasileiros e internacionais', () => {
  assert.equal(parseMoney('R$ 1.234,56'), 1234.56);
  assert.equal(parseMoney('1234,5'), 1234.5);
  assert.equal(parseMoney('1.500'), 1500);
  assert.equal(parseMoney('1,234.56'), 1234.56);
  assert.equal(parseMoney('12.5'), 12.5);
  assert.equal(parseMoney(99.999), 100);
  assert.equal(parseMoney('-10,00'), -10);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('abc'), null);
});

test('parseDate: dd/mm/aaaa, ISO e datas impossíveis', () => {
  assert.equal(parseDate('05/10/2026'), '2026-10-05');
  assert.equal(parseDate('2026-10-05'), '2026-10-05');
  assert.equal(parseDate('5-1-26'), '2026-01-05');
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate('ontem'), null);
});

test('normalizeExtraction preenche ausentes com null e normaliza documentos', () => {
  const { data, issues } = normalizeExtraction('fatura', { emitente: { cnpj: '11.222.333/0001-81' } });
  assert.equal(data.emitente.cnpj, '11222333000181');
  assert.equal(data.valor_total, null);
  assert.deepEqual(data.itens, []);
  assert.deepEqual(issues, []);
});

test('normalizeExtraction tolera campos com tipo errado', () => {
  const { data, issues } = normalizeExtraction('contrato', { prazo_meses: 'doze', valor_global: '24.000,00' });
  assert.equal(data.prazo_meses, null);
  assert.equal(data.valor_global, 24000);
  assert.equal(issues.length, 1);
});

test('formulário: assinatura textual vira booleano', () => {
  assert.equal(normalizeExtraction('formulario', { assinatura_presente: 'sim' }).data.assinatura_presente, true);
  assert.equal(normalizeExtraction('formulario', { assinatura_presente: 'não' }).data.assinatura_presente, false);
});

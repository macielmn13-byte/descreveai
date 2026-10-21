import '../helpers/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCpf,
  isValidCnpj,
  isValidCpfCnpj,
  isValidChaveAcesso,
  isValidLinhaDigitavel,
  applyBusinessRules,
} from '../../src/validation/business_rules.js';
import { normalizeExtraction } from '../../src/validation/schemas.js';

test('CPF: válidos e inválidos', () => {
  assert.ok(isValidCpf('529.982.247-25'));
  assert.ok(!isValidCpf('529.982.247-24'));
  assert.ok(!isValidCpf('111.111.111-11'));
  assert.ok(!isValidCpf('123'));
});

test('CNPJ numérico e alfanumérico (IN RFB 2.229/2024)', () => {
  assert.ok(isValidCnpj('11.222.333/0001-81'));
  assert.ok(isValidCnpj('43187019000100'));
  assert.ok(isValidCnpj('12.ABC.345/01DE-35'));
  assert.ok(!isValidCnpj('11.222.333/0001-82'));
  assert.ok(!isValidCnpj('00000000000000'));
  assert.ok(isValidCpfCnpj('52998224725'));
  assert.ok(isValidCpfCnpj('11222333000181'));
});

test('chave de acesso NF-e (módulo 11)', () => {
  const base = '3526100000000000000055001000000123100000001'; // 43 dígitos
  let sum = 0;
  let w = 2;
  for (let i = 42; i >= 0; i -= 1) {
    sum += Number(base[i]) * w;
    w = w === 9 ? 2 : w + 1;
  }
  const r = sum % 11;
  const dv = r < 2 ? 0 : 11 - r;
  assert.ok(isValidChaveAcesso(base + dv));
  assert.ok(!isValidChaveAcesso(base + ((dv + 1) % 10)));
});

test('linha digitável de boleto (módulo 10 por campo)', () => {
  assert.ok(isValidLinhaDigitavel('00190000090114971860168524522114675860000102656'));
  assert.ok(!isValidLinhaDigitavel('00190000080114971860168524522114675860000102656'));
  assert.ok(!isValidLinhaDigitavel('123'));
});

const fatura = (over = {}) =>
  normalizeExtraction('fatura', {
    emitente: { cnpj: '11.222.333/0001-81' },
    destinatario: { cpf_cnpj: '529.982.247-25' },
    data_emissao: '05/10/2026',
    data_vencimento: '20/10/2026',
    itens: [
      { descricao: 'A', quantidade: 2, valor_unitario: '100,00', valor_total: '200,00' },
      { descricao: 'B', quantidade: 1, valor_unitario: 50, valor_total: 50 },
    ],
    valor_produtos_servicos: 250,
    valor_desconto: '10,00',
    valor_total: 'R$ 240,00',
    ...over,
  }).data;

test('fatura consistente passa sem erros', () => {
  const r = applyBusinessRules('fatura', fatura());
  assert.deepEqual(r.errors, []);
  assert.equal(r.isValid, true);
});

test('fatura: soma dos itens, vencimento e CNPJ inválido geram erros', () => {
  const r = applyBusinessRules(
    'fatura',
    fatura({ emitente: { cnpj: '11.222.333/0001-82' }, data_vencimento: '01/10/2026', valor_produtos_servicos: 999 }),
  );
  assert.equal(r.isValid, false);
  assert.ok(r.errors.some((e) => e.includes('CNPJ do emitente')));
  assert.ok(r.errors.some((e) => e.includes('Vencimento')));
  assert.ok(r.errors.some((e) => e.includes('Soma dos itens')));
});

test('fatura: quantidade × unitário divergente', () => {
  const r = applyBusinessRules(
    'fatura',
    fatura({
      itens: [{ quantidade: 3, valor_unitario: 10, valor_total: 25 }],
      valor_produtos_servicos: 25,
      valor_total: 25,
      valor_desconto: 0,
    }),
  );
  assert.ok(r.errors.some((e) => e.startsWith('Item 1')));
});

test('contrato: vigência invertida e mensal > global', () => {
  const { data } = normalizeExtraction('contrato', {
    partes: [{ papel: 'contratante', nome: 'X', cpf_cnpj: '11222333000181' }],
    vigencia_inicio: '2027-01-01',
    vigencia_fim: '2026-01-01',
    valor_global: 1000,
    valor_mensal: 2000,
  });
  const r = applyBusinessRules('contrato', data);
  assert.ok(r.errors.some((e) => e.includes('Fim da vigência')));
  assert.ok(r.errors.some((e) => e.includes('Valor mensal maior')));
});

test('formulário: CPF inválido', () => {
  const { data } = normalizeExtraction('formulario', {
    cpf: '123.456.789-00',
    campos: [{ rotulo: 'Nome', valor: 'Ana' }],
  });
  const r = applyBusinessRules('formulario', data);
  assert.ok(r.errors.some((e) => e.includes('CPF inválido')));
});

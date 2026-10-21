import '../helpers/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { exportResults, flatten } from '../../src/delivery/exporter.js';

const results = [
  {
    documentoId: 'd1',
    nomeArquivo: 'nota.pdf',
    tipoDocumento: 'fatura',
    status: 'concluido',
    valido: true,
    recebidoEm: '2026-10-18T00:00:00.000Z',
    dados: {
      numero: '=HYPERLINK("x")',
      emitente: { cnpj: '11222333000181' },
      valor_total: 10.5,
      itens: [{ descricao: 'A; B', quantidade: 1, valor_unitario: 10.5, valor_total: 10.5 }],
    },
    erros: [],
    avisos: ['aviso 1'],
  },
];

test('flatten achata objetos aninhados', () => {
  assert.deepEqual(flatten({ a: { b: 1 }, c: [1], d: null }), { 'a.b': 1, c: '[1]', d: '' });
});

test('CSV com BOM, separador ";" e proteção contra fórmulas', async () => {
  const csv = (await exportResults(results, 'csv')).toString('utf8');
  assert.ok(csv.startsWith('\uFEFF'));
  const [header, row] = csv.slice(1).trim().split('\r\n');
  assert.ok(header.includes('emitente.cnpj'));
  assert.ok(row.includes(`"'=HYPERLINK(""x"")"`));
});

test('XLSX com abas Documentos, Itens e Validacao', async () => {
  const buf = await exportResults(results, 'xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    ['Documentos', 'Itens', 'Validacao'],
  );
  assert.equal(wb.getWorksheet('Itens').rowCount, 2);
  assert.equal(wb.getWorksheet('Validacao').getRow(2).getCell(4).value, 'aviso 1');
});

test('JSON completo', async () => {
  const json = JSON.parse((await exportResults(results, 'json')).toString());
  assert.equal(json[0].dados.valor_total, 10.5);
});

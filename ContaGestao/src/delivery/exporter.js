/**
 * Geração de arquivos de saída (CSV, JSON e Excel) com os dados extraídos.
 *
 * - JSON: estrutura completa.
 * - CSV:  uma linha por documento, campos aninhados "achatados"
 *         (ex.: emitente.cnpj). Separador ";" e BOM UTF-8 (abre direto no
 *         Excel em português). Listas vão serializadas em JSON na célula.
 * - XLSX: aba "Documentos" (uma linha por documento) + aba "Itens" (itens
 *         de faturas e partes de contratos) + aba "Validacao".
 */
import ExcelJS from 'exceljs';

export const FORMATOS = Object.freeze({
  json: { mime: 'application/json; charset=utf-8', ext: 'json' },
  csv: { mime: 'text/csv; charset=utf-8', ext: 'csv' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
});

export function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) out[key] = v.length ? JSON.stringify(v) : '';
    else if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v ?? '';
  }
  return out;
}

function baseRow(r) {
  return {
    documento_id: r.documentoId,
    arquivo: r.nomeArquivo,
    tipo: r.tipoDocumento,
    status: r.status,
    valido: r.valido ? 'sim' : 'nao',
    recebido_em: r.recebidoEm,
  };
}

function toRows(results) {
  const rows = results.map((r) => ({ ...baseRow(r), ...flatten(r.dados) }));
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return { rows, columns };
}

function csvCell(v) {
  const s = String(v ?? '');
  // Neutraliza fórmulas (CSV injection) e escapa aspas/separadores
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(results) {
  const { rows, columns } = toRows(results);
  const lines = [columns.join(';'), ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(';'))];
  return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

async function toXlsx(results) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ContaGestão – Soluções Inteligentes';
  wb.created = new Date();

  const { rows, columns } = toRows(results);
  const docs = wb.addWorksheet('Documentos', { views: [{ state: 'frozen', ySplit: 1 }] });
  docs.columns = columns.map((c) => ({ header: c, key: c, width: Math.min(Math.max(c.length + 2, 14), 50) }));
  rows.forEach((row) => docs.addRow(row));
  docs.getRow(1).font = { bold: true };
  if (rows.length) docs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const itens = wb.addWorksheet('Itens', { views: [{ state: 'frozen', ySplit: 1 }] });
  itens.columns = [
    { header: 'documento_id', key: 'documento_id', width: 38 },
    { header: 'arquivo', key: 'arquivo', width: 30 },
    { header: 'tipo_linha', key: 'tipo_linha', width: 12 },
    { header: 'descricao_ou_nome', key: 'descricao', width: 50 },
    { header: 'quantidade_ou_papel', key: 'quantidade', width: 18 },
    { header: 'valor_unitario_ou_documento', key: 'valor_unitario', width: 22 },
    { header: 'valor_total', key: 'valor_total', width: 16 },
  ];
  for (const r of results) {
    for (const it of r.dados?.itens ?? []) {
      itens.addRow({
        documento_id: r.documentoId,
        arquivo: r.nomeArquivo,
        tipo_linha: 'item',
        descricao: it.descricao,
        quantidade: it.quantidade,
        valor_unitario: it.valor_unitario,
        valor_total: it.valor_total,
      });
    }
    for (const p of r.dados?.partes ?? []) {
      itens.addRow({
        documento_id: r.documentoId,
        arquivo: r.nomeArquivo,
        tipo_linha: 'parte',
        descricao: p.nome,
        quantidade: p.papel,
        valor_unitario: p.cpf_cnpj,
      });
    }
  }
  itens.getRow(1).font = { bold: true };

  const val = wb.addWorksheet('Validacao', { views: [{ state: 'frozen', ySplit: 1 }] });
  val.columns = [
    { header: 'documento_id', key: 'id', width: 38 },
    { header: 'arquivo', key: 'arquivo', width: 30 },
    { header: 'nivel', key: 'nivel', width: 10 },
    { header: 'mensagem', key: 'msg', width: 90 },
  ];
  for (const r of results) {
    r.erros.forEach((msg) => val.addRow({ id: r.documentoId, arquivo: r.nomeArquivo, nivel: 'erro', msg }));
    r.avisos.forEach((msg) => val.addRow({ id: r.documentoId, arquivo: r.nomeArquivo, nivel: 'aviso', msg }));
  }
  val.getRow(1).font = { bold: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** @returns {Promise<Buffer>} */
export async function exportResults(results, formato) {
  if (formato === 'json') return Buffer.from(JSON.stringify(results, null, 2), 'utf8');
  if (formato === 'csv') return toCsv(results);
  if (formato === 'xlsx') return toXlsx(results);
  throw new Error(`Formato não suportado: ${formato}`);
}

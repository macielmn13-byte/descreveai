/**
 * Esquemas de dados (zod) dos documentos extraídos.
 *
 * Os pré-processadores normalizam o que vem do LLM/OCR:
 *  - valores monetários "R$ 1.234,56" -> 1234.56
 *  - datas "31/12/2026" -> "2026-12-31"
 *  - CPF/CNPJ -> somente dígitos (ou alfanumérico, no CNPJ novo)
 */
import { z } from 'zod';

// ------------------------------------------------------------- parsers

export function parseMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  let s = String(value)
    .replace(/R\$|\s/gi, '')
    .replace(/[^\d,.-]/g, '');
  if (!s || s === '-') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // o último separador é o decimal
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ''); // "1.500" no padrão brasileiro = mil e quinhentos
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  let y;
  let m;
  let d;
  let match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) [, y, m, d] = match;
  else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [, d, m, y] = match;
  else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/))) {
    [, d, m, y] = match;
    y = `20${y}`;
  } else return null;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function normalizeDocNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value)
    .toUpperCase()
    .replace(/[.\-/\s]/g, '');
  return s || null;
}

export function normalizeDigits(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/\D/g, '');
  return s || null;
}

// ------------------------------------------------------------ builders

const toNull = (v) => (v === undefined || v === '' ? null : v);
const opt = (schema) => z.preprocess(toNull, schema.nullable());
const text = () => opt(z.coerce.string().trim());
const money = () => z.preprocess(parseMoney, z.number().nullable());
const date = () => z.preprocess(parseDate, z.string().nullable());
const docNumber = () => z.preprocess(normalizeDocNumber, z.string().nullable());
const digits = () => z.preprocess(normalizeDigits, z.string().nullable());
const list = (item) => z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(item));
const obj = (shape) => z.preprocess((v) => (v && typeof v === 'object' ? v : {}), z.object(shape));
const bool = () =>
  z.preprocess((v) => {
    if (typeof v === 'boolean') return v;
    if (v === null || v === undefined || v === '') return null;
    return ['sim', 'true', 's', 'yes', '1'].includes(String(v).trim().toLowerCase());
  }, z.boolean().nullable());

// ------------------------------------------------------------- schemas

export const FaturaSchema = z.object({
  tipo_documento: text(), // NF-e, NFS-e, fatura, boleto, recibo...
  numero: text(),
  serie: text(),
  data_emissao: date(),
  data_vencimento: date(),
  competencia: text(),
  emitente: obj({
    razao_social: text(),
    cnpj: docNumber(),
    inscricao_estadual: text(),
    inscricao_municipal: text(),
    endereco: text(),
  }),
  destinatario: obj({
    nome: text(),
    cpf_cnpj: docNumber(),
    endereco: text(),
  }),
  itens: list(
    z.object({
      descricao: text(),
      quantidade: money(),
      valor_unitario: money(),
      valor_total: money(),
    }),
  ),
  valor_produtos_servicos: money(),
  valor_desconto: money(),
  valor_frete: money(),
  impostos: obj({
    icms: money(),
    ipi: money(),
    pis: money(),
    cofins: money(),
    iss: money(),
    irrf: money(),
    csll: money(),
    inss: money(),
  }),
  valor_total: money(),
  valor_liquido: money(),
  chave_acesso: digits(),
  linha_digitavel: digits(),
  forma_pagamento: text(),
  observacoes: text(),
});

export const ContratoSchema = z.object({
  numero_contrato: text(),
  objeto: text(),
  partes: list(
    z.object({
      papel: text(), // contratante | contratada | interveniente | fiador
      nome: text(),
      cpf_cnpj: docNumber(),
    }),
  ),
  data_assinatura: date(),
  vigencia_inicio: date(),
  vigencia_fim: date(),
  prazo_meses: opt(z.coerce.number().int()),
  valor_global: money(),
  valor_mensal: money(),
  indice_reajuste: text(),
  data_base_reajuste: text(),
  garantia_percentual: money(),
  multas: text(),
  foro: text(),
  clausulas_relevantes: list(z.coerce.string()),
});

export const FormularioSchema = z.object({
  titulo: text(),
  nome: text(),
  cpf: docNumber(),
  cnpj: docNumber(),
  data: date(),
  assinatura_presente: bool(),
  campos: list(z.object({ rotulo: text(), valor: text() })),
});

export const SCHEMAS = { fatura: FaturaSchema, contrato: ContratoSchema, formulario: FormularioSchema };

/** Valida e normaliza os dados extraídos para o tipo informado. */
export function normalizeExtraction(tipo, raw) {
  const schema = SCHEMAS[tipo];
  if (!schema) throw new Error(`Tipo de documento desconhecido: ${tipo}`);
  const parsed = schema.safeParse(raw ?? {});
  if (parsed.success) return { data: parsed.data, issues: [] };
  // Campos com tipo errado viram null e o resto é aproveitado.
  const issues = parsed.error.issues.map((i) => `Campo "${i.path.join('.')}" ignorado: ${i.message}`);
  const cleaned = structuredClone(raw ?? {});
  for (const issue of parsed.error.issues) {
    let ref = cleaned;
    const p = issue.path;
    for (let i = 0; i < p.length - 1 && ref; i += 1) ref = ref[p[i]];
    if (ref && p.length) ref[p.at(-1)] = null;
  }
  const retry = schema.safeParse(cleaned);
  return { data: retry.success ? retry.data : schema.parse({}), issues };
}

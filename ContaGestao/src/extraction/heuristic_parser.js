/**
 * Extração heurística (expressões regulares), sem LLM.
 *
 * Usada com LLM_PROVIDER=none: desenvolvimento sem chave de API, testes
 * automatizados e contingência. Captura os campos principais; para extração
 * completa (itens, cláusulas, campos livres) use um provedor de LLM.
 */

const CNPJ_RE = /\b([0-9A-Z]{2}\.?[0-9A-Z]{3}\.?[0-9A-Z]{3}\/?[0-9A-Z]{4}-?\d{2})\b/g;
const CPF_RE = /\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/g;
const DATE_RE = /\b(\d{2}\/\d{2}\/\d{4})\b/;
const MONEY = String.raw`(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})`;

const lines = (text) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

function afterLabel(text, labelRe, valueRe) {
  for (const line of lines(text)) {
    const m = line.match(labelRe);
    if (!m) continue;
    const rest = line.slice(m.index + m[0].length);
    const v = rest.match(valueRe);
    if (v) return v[1];
  }
  return null;
}

const moneyAfter = (text, label) => afterLabel(text, label, new RegExp(MONEY));
const dateAfter = (text, label) => afterLabel(text, label, DATE_RE);

function allMatches(re, text) {
  return [...text.matchAll(re)].map((m) => m[1]);
}

function nameNear(text, labelRe) {
  const m = afterLabel(text, labelRe, /[:\s-]*(.+)/);
  return m ? m.replace(/\s+(CNPJ|CPF)\b.*$/i, '').trim() || null : null;
}

function parseFatura(text) {
  const cnpjs = allMatches(CNPJ_RE, text).filter((c) => /\d/.test(c) && c.replace(/\W/g, '').length === 14);
  const chave = text.replace(/[ .]/g, '').match(/(?<!\d)(\d{44})(?!\d)/);
  const linha = text.match(/(\d{5}\.?\d{5}\s?\d{5}\.?\d{6}\s?\d{5}\.?\d{6}\s?\d\s?\d{14})/);
  return {
    tipo_documento: /nfs-?e|servi[çc]os/i.test(text)
      ? 'NFS-e'
      : /nf-?e|danfe/i.test(text)
        ? 'NF-e'
        : /boleto/i.test(text)
          ? 'boleto'
          : 'fatura',
    numero: afterLabel(text, /\bn[úu]mero\b|\bn[º°o]\.?\s/i, /[:\s]*([\w/.-]+)/),
    serie: afterLabel(text, /\bs[ée]rie\b/i, /[:\s]*(\w+)/),
    data_emissao: dateAfter(text, /emiss[ãa]o/i) ?? text.match(DATE_RE)?.[1] ?? null,
    data_vencimento: dateAfter(text, /vencimento/i),
    emitente: {
      razao_social: nameNear(text, /\b(prestador|emitente|fornecedor|benefici[áa]rio)\b/i),
      cnpj: cnpjs[0] ?? null,
    },
    destinatario: {
      nome: nameNear(text, /\b(tomador|destinat[áa]rio|cliente|pagador|sacado)\b/i),
      cpf_cnpj: cnpjs[1] ?? allMatches(CPF_RE, text)[0] ?? null,
    },
    itens: [],
    valor_produtos_servicos: moneyAfter(text, /valor (dos|total dos) (servi[çc]os|produtos)/i),
    valor_desconto: moneyAfter(text, /desconto/i),
    valor_total: moneyAfter(text, /valor (total|do documento|a pagar)/i),
    valor_liquido: moneyAfter(text, /valor l[íi]quido/i),
    impostos: {
      iss: moneyAfter(text, /\biss\b/i),
      icms: moneyAfter(text, /valor do icms|\bicms\b/i),
    },
    chave_acesso: chave?.[1] ?? null,
    linha_digitavel: linha?.[1] ?? null,
  };
}

function parseContrato(text) {
  const docs = [...allMatches(CNPJ_RE, text).filter((c) => /\d/.test(c)), ...allMatches(CPF_RE, text)];
  const partes = [];
  const contratante = nameNear(text, /\bcontratante\b/i);
  const contratada = nameNear(text, /\bcontratad[ao]\b/i);
  if (contratante || docs[0]) partes.push({ papel: 'contratante', nome: contratante, cpf_cnpj: docs[0] ?? null });
  if (contratada || docs[1]) partes.push({ papel: 'contratada', nome: contratada, cpf_cnpj: docs[1] ?? null });
  return {
    numero_contrato: afterLabel(text, /contrato\s+(n[º°o]\.?|n[úu]mero)/i, /[:\s]*([\w/.-]+)/),
    objeto: afterLabel(text, /\bobjeto\b/i, /[:\s-]*(.{10,})/),
    partes,
    data_assinatura: dateAfter(text, /assinatura|assinado em/i),
    vigencia_inicio: dateAfter(text, /in[íi]cio|a partir de/i),
    vigencia_fim: dateAfter(text, /t[ée]rmino|at[ée]|fim/i),
    valor_global: moneyAfter(text, /valor (global|total)/i),
    valor_mensal: moneyAfter(text, /valor mensal/i),
    indice_reajuste: text.match(/\b(IPCA|IGP-?M|INPC|IPC-?FIPE)\b/i)?.[1]?.toUpperCase() ?? null,
    foro: afterLabel(text, /\bforo\b/i, /[:\s-]*(?:da comarca de\s*)?(.{3,})/i),
    clausulas_relevantes: [],
  };
}

function parseFormulario(text) {
  const campos = [];
  for (const line of lines(text)) {
    const m = line.match(/^([A-Za-zÀ-ú][\wÀ-ú ./()-]{1,40}):\s*(.*)$/);
    if (m) campos.push({ rotulo: m[1].trim(), valor: m[2].trim() || null });
  }
  return {
    titulo: lines(text)[0] ?? null,
    nome: afterLabel(text, /\bnome( completo)?\b/i, /[:\s]*(.+)/),
    cpf: allMatches(CPF_RE, text)[0] ?? null,
    cnpj: allMatches(CNPJ_RE, text).find((c) => /\d/.test(c)) ?? null,
    data: text.match(DATE_RE)?.[1] ?? null,
    assinatura_presente: /assinado digitalmente|assinatura:\s*\S+/i.test(text) ? true : null,
    campos,
  };
}

const PARSERS = { fatura: parseFatura, contrato: parseContrato, formulario: parseFormulario };

export function heuristicExtract(tipo, text) {
  return PARSERS[tipo](String(text ?? ''));
}

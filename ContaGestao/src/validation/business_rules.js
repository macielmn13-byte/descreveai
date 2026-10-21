/**
 * Regras de negócio (verificação cruzada) sobre os dados extraídos.
 *
 * Erros   -> o documento vai para "revisao" (precisa de conferência humana).
 * Avisos  -> informativos; não bloqueiam a conclusão.
 */

const TOL = 0.05; // tolerância de arredondamento (R$)

// ---------------------------------------------------------- documentos

export function isValidCpf(value) {
  const cpf = String(value ?? '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

/**
 * CNPJ numérico e alfanumérico (IN RFB nº 2.229/2024, a partir de jul/2026):
 * 12 posições [0-9A-Z] + 2 dígitos verificadores; valor de cada caractere
 * = código ASCII − 48.
 */
export function isValidCnpj(value) {
  const cnpj = String(value ?? '')
    .toUpperCase()
    .replace(/[.\-/\s]/g, '');
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const val = (ch) => ch.charCodeAt(0) - 48;
  const dv = (len) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += val(cnpj[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(cnpj[12]) && dv(13) === Number(cnpj[13]);
}

export function isValidCpfCnpj(value) {
  const s = String(value ?? '').replace(/[.\-/\s]/g, '');
  return s.length === 11 ? isValidCpf(s) : isValidCnpj(s);
}

/** Chave de acesso NF-e/NFC-e/CT-e (44 dígitos, DV módulo 11). */
export function isValidChaveAcesso(value) {
  const k = String(value ?? '').replace(/\D/g, '');
  if (k.length !== 44) return false;
  let sum = 0;
  let w = 2;
  for (let i = 42; i >= 0; i -= 1) {
    sum += Number(k[i]) * w;
    w = w === 9 ? 2 : w + 1;
  }
  const r = sum % 11;
  const dv = r < 2 ? 0 : 11 - r;
  return dv === Number(k[43]);
}

function mod10(numbers) {
  let sum = 0;
  let w = 2;
  for (let i = numbers.length - 1; i >= 0; i -= 1) {
    let p = Number(numbers[i]) * w;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    sum += p;
    w = w === 2 ? 1 : 2;
  }
  const r = sum % 10;
  return r === 0 ? 0 : 10 - r;
}

/** Linha digitável de boleto bancário (47 dígitos; DVs dos 3 campos em módulo 10). */
export function isValidLinhaDigitavel(value) {
  const l = String(value ?? '').replace(/\D/g, '');
  if (l.length !== 47) return false;
  const campos = [
    [l.slice(0, 9), l[9]],
    [l.slice(10, 20), l[20]],
    [l.slice(21, 31), l[31]],
  ];
  return campos.every(([num, dv]) => mod10(num) === Number(dv));
}

// ------------------------------------------------------------- helpers

const near = (a, b) => Math.abs(a - b) <= TOL;
const fmt = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, d) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);

// --------------------------------------------------------------- regras

function rulesFatura(d, errors, warnings) {
  if (!d.emitente.cnpj) warnings.push('CNPJ do emitente não encontrado');
  else if (!isValidCnpj(d.emitente.cnpj)) errors.push(`CNPJ do emitente inválido: ${d.emitente.cnpj}`);

  if (d.destinatario.cpf_cnpj && !isValidCpfCnpj(d.destinatario.cpf_cnpj)) {
    errors.push(`CPF/CNPJ do destinatário inválido: ${d.destinatario.cpf_cnpj}`);
  }

  if (!d.data_emissao) warnings.push('Data de emissão não encontrada');
  else if (d.data_emissao > addDays(todayIso(), 1)) errors.push(`Data de emissão no futuro: ${d.data_emissao}`);

  if (d.data_emissao && d.data_vencimento && d.data_vencimento < d.data_emissao) {
    errors.push(`Vencimento (${d.data_vencimento}) anterior à emissão (${d.data_emissao})`);
  }

  if (d.valor_total === null) errors.push('Valor total não encontrado');
  else if (d.valor_total < 0) errors.push('Valor total negativo');

  d.itens.forEach((it, i) => {
    if (it.quantidade !== null && it.valor_unitario !== null && it.valor_total !== null) {
      const calc = Math.round(it.quantidade * it.valor_unitario * 100) / 100;
      if (Math.abs(calc - it.valor_total) > Math.max(TOL, it.valor_total * 0.001)) {
        errors.push(
          `Item ${i + 1}: quantidade × valor unitário (${fmt(calc)}) ≠ valor do item (${fmt(it.valor_total)})`,
        );
      }
    }
  });

  const somaItens = d.itens.reduce((s, it) => s + (it.valor_total ?? 0), 0);
  if (d.itens.length && d.valor_produtos_servicos !== null && !near(somaItens, d.valor_produtos_servicos)) {
    errors.push(`Soma dos itens (${fmt(somaItens)}) ≠ valor dos produtos/serviços (${fmt(d.valor_produtos_servicos)})`);
  }

  if (d.valor_produtos_servicos !== null && d.valor_total !== null) {
    const esperado = d.valor_produtos_servicos - (d.valor_desconto ?? 0) + (d.valor_frete ?? 0) + (d.impostos.ipi ?? 0);
    if (!near(esperado, d.valor_total)) {
      warnings.push(
        `Valor total (${fmt(d.valor_total)}) difere de produtos − desconto + frete + IPI (${fmt(esperado)})`,
      );
    }
  }

  if (d.valor_liquido !== null && d.valor_total !== null && d.valor_liquido > d.valor_total + TOL) {
    errors.push('Valor líquido maior que o valor total');
  }

  if (d.chave_acesso && !isValidChaveAcesso(d.chave_acesso))
    errors.push('Chave de acesso com dígito verificador inválido');
  if (d.linha_digitavel && !isValidLinhaDigitavel(d.linha_digitavel)) {
    errors.push('Linha digitável do boleto com dígito verificador inválido');
  }
}

function rulesContrato(d, errors, warnings) {
  if (!d.partes.length) warnings.push('Partes do contrato não identificadas');
  d.partes.forEach((p, i) => {
    if (p.cpf_cnpj && !isValidCpfCnpj(p.cpf_cnpj)) {
      errors.push(`CPF/CNPJ inválido na parte ${i + 1} (${p.nome ?? 'sem nome'}): ${p.cpf_cnpj}`);
    }
  });
  if (d.vigencia_inicio && d.vigencia_fim && d.vigencia_fim < d.vigencia_inicio) {
    errors.push('Fim da vigência anterior ao início');
  }
  if (d.data_assinatura && d.vigencia_fim && d.data_assinatura > d.vigencia_fim) {
    warnings.push('Data de assinatura posterior ao fim da vigência');
  }
  if (d.valor_global !== null && d.valor_mensal !== null && d.valor_mensal > d.valor_global + TOL) {
    errors.push('Valor mensal maior que o valor global');
  }
  if (d.valor_global !== null && d.valor_mensal !== null && d.prazo_meses) {
    const esperado = d.valor_mensal * d.prazo_meses;
    if (!near(esperado, d.valor_global)) {
      warnings.push(`Valor global (${fmt(d.valor_global)}) ≠ mensal × prazo (${fmt(esperado)})`);
    }
  }
  if (d.vigencia_fim && d.vigencia_fim < todayIso())
    warnings.push(`Contrato com vigência encerrada em ${d.vigencia_fim}`);
}

function rulesFormulario(d, errors, warnings) {
  if (d.cpf && !isValidCpf(d.cpf)) errors.push(`CPF inválido: ${d.cpf}`);
  if (d.cnpj && !isValidCnpj(d.cnpj)) errors.push(`CNPJ inválido: ${d.cnpj}`);
  if (d.data && d.data > addDays(todayIso(), 1)) warnings.push(`Data no futuro: ${d.data}`);
  if (d.assinatura_presente === false) warnings.push('Formulário sem assinatura');
  if (!d.campos.length && !d.nome) warnings.push('Nenhum campo preenchido identificado');
}

const RULES = { fatura: rulesFatura, contrato: rulesContrato, formulario: rulesFormulario };

/** @returns {{errors: string[], warnings: string[], isValid: boolean}} */
export function applyBusinessRules(tipo, data) {
  const errors = [];
  const warnings = [];
  RULES[tipo]?.(data, errors, warnings);
  return { errors, warnings, isValid: errors.length === 0 };
}

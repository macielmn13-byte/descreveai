/**
 * Classificação do tipo de documento por palavras-chave (determinística,
 * sem custo de LLM). Usada quando o tipo solicitado é "auto".
 */

const KEYWORDS = {
  fatura: [
    [/nota fiscal/gi, 3],
    [/\bnf-?e\b|\bnfs-?e\b|\bnfc-?e\b|danfe/gi, 4],
    [/chave de acesso/gi, 4],
    [/\bfatura\b|duplicata/gi, 3],
    [/boleto|linha digit[áa]vel|benefici[áa]rio|sacado|pagador/gi, 2],
    [/valor total|valor l[íi]quido|vencimento/gi, 1],
    [/\bicms\b|\biss\b|\bipi\b|cofins/gi, 1],
    [/prestador|tomador|emitente|destinat[áa]rio/gi, 1],
  ],
  contrato: [
    [/\bcontrato\b|termo aditivo|\baditivo\b/gi, 3],
    [/cl[áa]usula/gi, 3],
    [/contratante|contratada/gi, 3],
    [/vig[êe]ncia|rescis[ãa]o|reajuste|\bforo\b/gi, 2],
    [/objeto do contrato|das obriga[çc][õo]es|testemunhas/gi, 2],
  ],
  formulario: [
    [/formul[áa]rio|ficha (cadastral|de inscri[çc][ãa]o)|requerimento/gi, 4],
    [/preencher|preenchimento|campo obrigat[óo]rio/gi, 2],
    [/\bnome( completo)?:|\bendere[çc]o:|\btelefone:|\be-?mail:|\brg:/gi, 1],
    [/assinatura do (requerente|candidato|titular)/gi, 2],
  ],
};

/** @returns {{tipo: 'fatura'|'contrato'|'formulario', scores: object}} */
export function classifyDocument(text) {
  const sample = String(text ?? '').slice(0, 20000);
  const scores = {};
  for (const [tipo, rules] of Object.entries(KEYWORDS)) {
    scores[tipo] = rules.reduce((sum, [re, w]) => sum + Math.min((sample.match(re) ?? []).length, 5) * w, 0);
  }
  const [best, bestScore] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return { tipo: bestScore > 0 ? best : 'formulario', scores };
}

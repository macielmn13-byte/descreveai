/**
 * Gerador mínimo de PDF (texto em Helvetica, sem dependências).
 * Usado pelo script de exemplo e pelos testes automatizados.
 */

function escapePdf(text) {
  // WinAnsi: converte para latin1 e escapa caracteres especiais do PDF
  return Buffer.from(text, 'latin1')
    .toString('latin1')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * @param {string[][]} pages  Cada página é uma lista de linhas de texto.
 * @returns {Buffer}
 */
export function createTextPdf(pages) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };

  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const pagesId = objects.length + 1 + pages.length * 2; // reservado ao final
  const pageIds = [];

  for (const lines of pages) {
    let stream = 'BT /F1 11 Tf 14 TL 50 790 Td\n';
    for (const line of lines) stream += `(${escapePdf(line)}) Tj T*\n`;
    stream += 'ET';
    const len = Buffer.byteLength(stream, 'latin1');
    const contentId = add(`<< /Length ${len} >>\nstream\n${stream}\nendstream`);
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] ` +
          `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
  }
  add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Linhas de uma fatura fictícia (CNPJs e chave de acesso com dígitos válidos). */
export const FATURA_EXEMPLO = [
  'NOTA FISCAL DE SERVICOS ELETRONICA - NFS-e',
  'Numero: 2026/000123   Serie: 1',
  'Data de Emissao: 05/10/2026',
  'Vencimento: 20/10/2026',
  'PRESTADOR: Kodama e Maciel Assessoria e Consultoria Tributaria Ltda.',
  'CNPJ: 43.187.019/0001-00',
  'TOMADOR: Construtora Exemplo Ltda.',
  'CNPJ: 11.222.333/0001-81',
  'Descricao dos servicos: Assessoria contabil mensal',
  'Valor dos Servicos: R$ 1.500,00',
  'Desconto: R$ 0,00',
  'Valor Total: R$ 1.500,00',
];

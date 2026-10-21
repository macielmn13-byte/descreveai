/**
 * Cria exemplos/fatura-exemplo.pdf para testar o sistema (npm run exemplo:pdf).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createTextPdf, FATURA_EXEMPLO } from './lib/pdf-simples.js';

const out = path.resolve('exemplos/fatura-exemplo.pdf');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, createTextPdf([FATURA_EXEMPLO]));
console.log(`PDF de exemplo criado em ${out}`);

/**
 * Integração com LLM (Claude, GPT-4o ou Azure OpenAI) para transformar o
 * texto do OCR em JSON estruturado, guiado pelos prompts em ./prompts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../core/config.js';
import { logger } from '../core/logger.js';
import { heuristicExtract } from './heuristic_parser.js';

const PROMPTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prompts');
const PROMPT_FILES = { fatura: 'faturas.json', contrato: 'contratos.json', formulario: 'formularios.json' };

export class LlmError extends Error {}

const promptCache = new Map();

export function loadPrompt(tipo) {
  if (!promptCache.has(tipo)) {
    const file = PROMPT_FILES[tipo];
    if (!file) throw new LlmError(`Sem prompt para o tipo "${tipo}"`);
    promptCache.set(tipo, JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, file), 'utf8')));
  }
  return promptCache.get(tipo);
}

export function buildMessages(tipo, ocrText) {
  const cfg = getConfig();
  const p = loadPrompt(tipo);
  let text = ocrText;
  if (text.length > cfg.LLM_MAX_INPUT_CHARS) {
    // mantém início e fim (cabeçalho e totais costumam estar nas pontas)
    const half = Math.floor(cfg.LLM_MAX_INPUT_CHARS / 2);
    text = `${text.slice(0, half)}\n[...trecho omitido...]\n${text.slice(-half)}`;
  }
  const user = [
    'Regras:',
    ...p.instrucoes.map((i) => `- ${i}`),
    '',
    'Devolva exatamente esta estrutura JSON (mesmas chaves):',
    JSON.stringify(p.esquema, null, 2),
    '',
    'Texto do documento (OCR), entre as marcações:',
    '<documento>',
    text,
    '</documento>',
  ].join('\n');
  return { system: p.sistema, user };
}

/** Extrai o primeiro objeto JSON de uma resposta (tolera ```json ... ```). */
export function extractJson(raw) {
  const s = String(raw ?? '').trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : s;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        /* cai no erro abaixo */
      }
    }
  }
  throw new LlmError('A resposta do LLM não contém JSON válido');
}

// --------------------------------------------------------------- clientes

let clients = {};

/** Apenas para testes: injeta um cliente falso. */
export function setLlmClientForTests(provider, client) {
  clients[provider] = client;
}
export function resetLlmClients() {
  clients = {};
}

async function anthropicCall(system, user) {
  const cfg = getConfig();
  if (!clients.anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    clients.anthropic = new Anthropic({
      apiKey: cfg.ANTHROPIC_API_KEY,
      maxRetries: cfg.LLM_MAX_RETRIES,
      timeout: cfg.LLM_TIMEOUT_SECONDS * 1000,
    });
  }
  const res = await clients.anthropic.messages.create({
    model: cfg.ANTHROPIC_MODEL,
    max_tokens: cfg.LLM_MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: user }],
  });
  if (res.stop_reason === 'max_tokens') logger.warn('Resposta do LLM truncada (aumente LLM_MAX_TOKENS)');
  return {
    text: (res.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(''),
    model: res.model ?? cfg.ANTHROPIC_MODEL,
  };
}

async function openaiCall(system, user, azure = false) {
  const cfg = getConfig();
  const key = azure ? 'azure' : 'openai';
  if (!clients[key]) {
    const mod = await import('openai');
    clients[key] = azure
      ? new mod.AzureOpenAI({
          endpoint: cfg.AZURE_OPENAI_ENDPOINT,
          apiKey: cfg.AZURE_OPENAI_API_KEY,
          apiVersion: cfg.AZURE_OPENAI_API_VERSION,
          deployment: cfg.AZURE_OPENAI_DEPLOYMENT,
          maxRetries: cfg.LLM_MAX_RETRIES,
          timeout: cfg.LLM_TIMEOUT_SECONDS * 1000,
        })
      : new mod.default({
          apiKey: cfg.OPENAI_API_KEY,
          maxRetries: cfg.LLM_MAX_RETRIES,
          timeout: cfg.LLM_TIMEOUT_SECONDS * 1000,
        });
  }
  const model = azure ? cfg.AZURE_OPENAI_DEPLOYMENT : cfg.OPENAI_MODEL;
  const res = await clients[key].chat.completions.create({
    model,
    max_tokens: cfg.LLM_MAX_TOKENS,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return { text: res.choices?.[0]?.message?.content ?? '', model: res.model ?? model };
}

/**
 * @returns {Promise<{data: object, provider: string, model: string|null}>}
 */
export async function parseWithLlm(tipo, ocrText) {
  const cfg = getConfig();
  const provider = cfg.LLM_PROVIDER;

  if (provider === 'none') {
    return { data: heuristicExtract(tipo, ocrText), provider: 'heuristico', model: null };
  }

  const { system, user } = buildMessages(tipo, ocrText);
  let out;
  try {
    if (provider === 'anthropic') out = await anthropicCall(system, user);
    else out = await openaiCall(system, user, provider === 'azure');
  } catch (err) {
    throw new LlmError(`Falha na chamada ao LLM (${provider}): ${err.message}`);
  }
  return { data: extractJson(out.text), provider, model: out.model };
}

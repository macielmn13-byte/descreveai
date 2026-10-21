# ContaGestão – Arquitetura

## Visão geral

```
                 ┌───────────────┐        ┌──────────────────┐
 Upload (API) ──▶│               │        │  Armazenamento   │
                 │   API HTTP    │──────▶ │  local ou S3     │  (arquivos sempre
 E-mail (webhook)│  Express 5    │        │  AES-256-GCM     │   criptografados)
             ───▶│               │        └──────────────────┘
                 └──────┬────────┘
                        │ enfileira (BullMQ / Redis)
                        ▼
                 ┌───────────────────────────────────────────────────────────┐
                 │ WORKER (N instâncias)                                      │
                 │  1 processing/pdf_converter  texto nativo ou imagem 300dpi │
                 │  2 processing/image_enhancer cinza, ruído, contraste,      │
                 │                              deskew                        │
                 │  3 extraction/ocr_engine     Tesseract (por) ou Textract   │
                 │  4 extraction/classifier     fatura/contrato/formulário    │
                 │  5 extraction/llm_parser     Claude / GPT-4o / Azure → JSON│
                 │  6 validation/schemas        normalização (zod)            │
                 │    validation/business_rules CNPJ, DVs, somas, datas       │
                 │  7 delivery/db_writer        PostgreSQL                    │
                 │    delivery/webhook_dispatcher ERP/CRM (HMAC)              │
                 └───────────────────────────────────────────────────────────┘
                        │
                        ▼
              API de consulta  ·  delivery/exporter (XLSX / CSV / JSON)
```

## Componentes

| pasta                            | responsabilidade                                                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core`                       | configuração validada (`config.js`), criptografia e assinaturas (`security.js`), banco Knex (`database.js`), acesso a dados (`repository.js`), logs JSON (`logger.js`)                                      |
| `src/ingestion`                  | upload (`api_handler.js`), webhook de e-mail (`email_listener.js`), regras de recebimento (`intake.js`: extensão + assinatura binária, tamanho, deduplicação SHA-256), armazenamento (`storage_service.js`) |
| `src/processing`                 | PDF → páginas (`pdf_converter.js`, pdf.js), melhoria de imagem (`image_enhancer.js`, sharp/libvips)                                                                                                         |
| `src/extraction`                 | OCR (`ocr_engine.js`), classificação (`classifier.js`), LLM (`llm_parser.js`), extração por regras sem LLM (`heuristic_parser.js`), prompts (`prompts/*.json`)                                              |
| `src/validation`                 | esquemas e normalização (`schemas.js`), regras de negócio (`business_rules.js`)                                                                                                                             |
| `src/delivery`                   | gravação (`db_writer.js`), webhooks (`webhook_dispatcher.js`), exportação (`exporter.js`)                                                                                                                   |
| `src/api`                        | autenticação, rotas de consulta e saúde                                                                                                                                                                     |
| `src/pipeline.js`                | orquestra os 7 passos                                                                                                                                                                                       |
| `src/queue.js` / `src/worker.js` | fila BullMQ e worker                                                                                                                                                                                        |
| `migrations/`                    | estrutura do banco (Knex), válida para PostgreSQL e SQLite                                                                                                                                                  |

## Decisões de projeto

- **Texto nativo antes de OCR.** PDFs gerados por sistemas (NF-e, NFS-e, contratos em Word) já têm texto: é lido direto, sem perda e em milissegundos. Só páginas digitalizadas passam por OCR.
- **Fila separada da API.** Upload responde em milissegundos (`202`); o processamento pesado roda no worker, que escala horizontalmente (`WORKER_REPLICAS`). Em desenvolvimento, `QUEUE_MODE=inline` dispensa o Redis.
- **LLM só para estruturar.** O LLM recebe o texto (não a imagem), o que reduz custo e permite trocar de provedor por variável de ambiente. Sem chave de API, `LLM_PROVIDER=none` usa regras (útil em testes e contingência).
- **Validação independente do LLM.** Todo dado passa por esquema e regras determinísticas; o LLM nunca é a última palavra. Reprovações viram `revisao`, não descarte.
- **Criptografia na aplicação.** Arquivos e textos de OCR são cifrados com AES-256-GCM antes de sair do processo, inclusive no S3 (onde também se pede SSE). Rotação de chaves sem reprocessar: a chave nova entra na frente em `ENCRYPTION_KEYS`, as antigas continuam lendo.
- **Idempotência.** Arquivo idêntico (SHA-256) já processado não é reprocessado; webhooks levam `X-ContaGestao-Delivery` para o receptor descartar repetições.

## Segurança (resumo)

- Chave de API em tempo constante; várias chaves simultâneas (rotação sem parada).
- Limite de requisições por minuto, cabeçalhos de segurança (helmet), CORS fechado por padrão.
- Validação do conteúdo real do arquivo (assinatura binária), não só da extensão.
- Nome de arquivo sanitizado; proteção contra _path traversal_ no armazenamento local.
- Segredos mascarados nos logs; contêiner roda como usuário sem privilégios.
- Em produção a aplicação **recusa iniciar** sem chaves, sem criptografia, com SQLite ou com fila inline.
- Exclusão definitiva por documento (`DELETE`) para atender a LGPD.

## Escalabilidade

| volume               | sugestão                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| até ~2 mil docs/dia  | 1 VPS 4 vCPU / 8 GB, 1 worker com `WORKER_CONCURRENCY=2`                                                 |
| até ~20 mil docs/dia | `WORKER_REPLICAS=3–4`, PostgreSQL gerenciado, `STORAGE_BACKEND=s3`                                       |
| acima                | workers em máquinas separadas apontando para o mesmo Redis/Postgres/S3; considerar `OCR_ENGINE=textract` |

O gargalo costuma ser o OCR (CPU). Documentos com texto nativo praticamente não consomem CPU.

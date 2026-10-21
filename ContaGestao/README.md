# ContaGestão — Soluções Inteligentes

Captura, OCR e extração inteligente de documentos (faturas/NF-e/NFS-e/boletos, contratos e formulários), com validação de regras de negócio brasileiras e entrega para ERP/CRM.

**Stack:** Node.js 22 · Express 5 · BullMQ/Redis · PostgreSQL (Knex) · pdf.js · sharp · Tesseract 5 / AWS Textract · Claude / GPT-4o / Azure OpenAI · Docker

> 📘 **Guia completo em português (instalação, produção, manutenção): [LEIAME.md](LEIAME.md)**

## Início rápido (desenvolvimento)

```bash
npm ci
npm ci --prefix frontend
cp .env.example .env          # Windows: copy .env.example .env
npm run gerar-chaves          # cole as chaves no .env
npm run dev                   # API em http://localhost:8000
```

Em outro terminal, inicie a interface com `npm --prefix frontend run dev` (Vite). O frontend encaminha `/api` para a API local; defina `VITE_API_BASE_URL` no `.env` somente se a API estiver em outra origem. Configure `CORS_ORIGINS` para essa origem quando necessário. Para OCR de documentos digitalizados, instale Tesseract com o idioma português (veja o LEIAME).

## Produção (Docker)

```bash
cp .env.example .env          # preencha (NODE_ENV=production etc.)
npm run docker:prod
```

## Comandos

| comando                             | o que faz                                                  |
| ----------------------------------- | ---------------------------------------------------------- |
| `npm run dev` / `npm start`         | API (desenvolvimento / produção)                           |
| `npm run start:worker`              | worker da fila (produção)                                  |
| `npm run migrate`                   | aplica migrações do banco                                  |
| `npm test`                          | testes automatizados (unitários + integração com OCR real) |
| `npm run lint`                      | análise estática                                           |
| `npm run lint:frontend`              | análise estática do frontend                               |
| `npm run build:frontend`             | valida e gera o build do frontend                          |
| `npm run gerar-chaves`              | gera API key, chave de criptografia e segredos             |
| `npm run exemplo:pdf`               | cria `exemplos/fatura-exemplo.pdf`                         |
| `npm run docker:up` / `docker:prod` | sobe o ambiente completo em Docker                         |

## Documentação

- [docs/api-endpoints.md](docs/api-endpoints.md) — referência da API
- [docs/arquitetura.md](docs/arquitetura.md) — arquitetura e decisões
- [docs/checklist-projeto.md](docs/checklist-projeto.md) — checklist de configuração, validação e publicação
- [docs/variaveis-de-ambiente.md](docs/variaveis-de-ambiente.md) — lista completa de variáveis e onde preencher cada uma

© Kodama e Maciel Assessoria e Consultoria Tributária Ltda. Uso restrito.

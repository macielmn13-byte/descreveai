# ContaGestão — Soluções Inteligentes

## Guia de orientação (LEIAME)

Este guia explica o que é o sistema, o que foi corrigido em relação à árvore original, como rodar no seu computador, como colocar em produção e como mantê-lo. Siga as seções na ordem na primeira vez.

---

## 1. O que o sistema faz

O ContaGestão recebe documentos (PDF ou imagem) por **upload na API** ou **por e-mail**, lê o conteúdo (texto embutido do PDF ou **OCR** em português), identifica se é **fatura** (NF-e, NFS-e, boleto, recibo), **contrato** ou **formulário**, extrai os dados com **IA** (Claude, GPT-4o ou Azure) em formato estruturado, **valida** com regras brasileiras (CNPJ — inclusive o novo alfanumérico —, CPF, chave de acesso, linha digitável, somas, datas, vigências) e **entrega**: banco de dados, exportação Excel/CSV/JSON e aviso automático (webhook) para o seu ERP/CRM.

Fluxo resumido:

```
upload / e-mail → armazenamento criptografado → fila → worker:
   PDF→páginas → melhoria da imagem → OCR → classificação → IA → validação
→ banco + webhook ERP/CRM → consulta pela API / exportação Excel
```

---

## 2. O que foi corrigido na árvore original

A árvore enviada era um esboço em Python; a pedido, o sistema foi construído em **JavaScript (Node.js)**, mantendo os mesmos 5 módulos e os mesmos nomes de arquivo sempre que possível.

| na árvore original                              | problema                                                                | como ficou                                                                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_init_.py` em cada pasta                       | nome errado (precisaria de `__init__.py`) e desnecessário em JavaScript | removidos — em Node.js cada arquivo `.js` já é um módulo                                                                                                  |
| `requirements.txt` (cortado em `# D`)           | arquivo incompleto; formato de Python                                   | `package.json` + `package-lock.json` (versões travadas e testadas)                                                                                        |
| sem ponto de entrada                            | não havia como iniciar a API nem o processamento                        | `src/server.js` (API), `src/worker.js` (processamento), `src/pipeline.js` (orquestra os 7 passos), `src/queue.js` (fila)                                  |
| `core/database.py` sem estrutura de tabelas     | nenhuma definição de banco                                              | `migrations/` (criação das tabelas, PostgreSQL e SQLite) + `core/repository.js`                                                                           |
| sem autenticação                                | API aberta                                                              | `api/auth.js` (chave `X-API-Key`), limite de requisições, cabeçalhos de segurança                                                                         |
| upload síncrono implícito                       | OCR + IA dentro da requisição derruba a API sob carga                   | fila **BullMQ/Redis** + worker separado e escalável                                                                                                       |
| `config.py` com chaves "OpenAI/AWS/Azure"       | faltavam Anthropic (Claude), validação e travas de produção             | `core/config.js` valida tudo e **recusa iniciar em produção** sem os itens de segurança                                                                   |
| `security.py` sem especificação                 | —                                                                       | AES-256-GCM com rotação de chaves, HMAC nos webhooks, comparação em tempo constante                                                                       |
| OpenCV (`image_enhancer.py`)                    | OpenCV em Node é pesado e frágil                                        | `sharp` (libvips): cinza, ruído, contraste, **correção de inclinação** testada                                                                            |
| `pdf_converter.py` convertia todo PDF em imagem | lento e perde precisão em PDFs digitais                                 | lê o **texto nativo** primeiro; só faz OCR nas páginas digitalizadas                                                                                      |
| `docker/docker-compose.yml` sem banco/fila      | —                                                                       | PostgreSQL, Redis, serviço de migração, API, worker; arquivo extra de produção com **Nginx + HTTPS**                                                      |
| `.github/workflows/deploy.yml` sozinho          | sem testes antes de publicar                                            | `ci.yml` (lint + 47 testes + build) e `deploy.yml` (publica imagem e atualiza o servidor)                                                                 |
| testes com 2 arquivos                           | cobertura mínima                                                        | 7 arquivos, **47 testes**, incluindo OCR real de imagem inclinada                                                                                         |
| —                                               | faltavam                                                                | `.dockerignore`, `.nvmrc`, `eslint.config.js`, `.prettierrc.json`, `scripts/` (chaves, migração, backup, PDF de exemplo), `docs/` completos e este LEIAME |

---

## 3. Estrutura final

```
ContaGestao/
├── .github/workflows/
│   ├── ci.yml                    # testes a cada push/PR
│   └── deploy.yml                # publica imagem e atualiza o servidor
├── docs/
│   ├── arquitetura.md
│   └── api-endpoints.md          # referência completa da API
├── docker/
│   ├── Dockerfile                # imagem única (API e worker), Tesseract em português
│   ├── docker-compose.yml        # PostgreSQL + Redis + migração + API + worker
│   ├── docker-compose.prod.yml   # produção: Nginx/HTTPS, limites, logs
│   └── nginx/
│       ├── nginx.conf
│       ├── certs/                # certificados HTTPS (você coloca)
│       └── acme/                 # validação Let's Encrypt
├── migrations/
│   └── 20261018000000_estrutura_inicial.js
├── scripts/
│   ├── gerar-chaves.js           # npm run gerar-chaves
│   ├── migrar.js                 # npm run migrate
│   ├── backup.sh                 # backup do banco + documentos
│   ├── criar-pdf-exemplo.js      # npm run exemplo:pdf
│   └── lib/pdf-simples.js
├── src/
│   ├── server.js                 # inicia a API
│   ├── worker.js                 # inicia o processamento em fila
│   ├── app.js                    # rotas, segurança, tratamento de erros
│   ├── pipeline.js               # os 7 passos do processamento
│   ├── queue.js                  # fila (BullMQ ou inline)
│   ├── core/
│   │   ├── config.js             # variáveis de ambiente (validadas)
│   │   ├── security.js           # criptografia AES-256-GCM, HMAC
│   │   ├── database.js           # conexão (PostgreSQL / SQLite)
│   │   ├── repository.js         # leitura e gravação no banco
│   │   └── logger.js             # logs em JSON
│   ├── api/
│   │   ├── auth.js               # X-API-Key
│   │   ├── documents_routes.js   # consulta, reprocessar, excluir, exportar
│   │   └── health_routes.js      # /health e /health/ready
│   ├── ingestion/                # MÓDULO 1 – captura
│   │   ├── api_handler.js        # upload manual
│   │   ├── email_listener.js     # webhook de e-mail
│   │   ├── intake.js             # validações de recebimento e deduplicação
│   │   └── storage_service.js    # disco local ou S3 (criptografado)
│   ├── processing/               # MÓDULO 2 – pré-processamento
│   │   ├── pdf_converter.js
│   │   └── image_enhancer.js
│   ├── extraction/               # MÓDULO 3 – IA e OCR
│   │   ├── ocr_engine.js         # Tesseract / AWS Textract
│   │   ├── llm_parser.js         # Claude / GPT-4o / Azure
│   │   ├── heuristic_parser.js   # extração sem IA (contingência/testes)
│   │   ├── classifier.js         # fatura × contrato × formulário
│   │   └── prompts/
│   │       ├── faturas.json
│   │       ├── contratos.json
│   │       └── formularios.json
│   ├── validation/               # MÓDULO 4 – validação
│   │   ├── schemas.js
│   │   └── business_rules.js
│   └── delivery/                 # MÓDULO 5 – entrega
│       ├── db_writer.js
│       ├── webhook_dispatcher.js
│       └── exporter.js
├── tests/
│   ├── helpers/                  # ambiente e arquivos de teste
│   ├── unit/                     # regras, esquemas, segurança, IA, imagem, exportação
│   └── integration/              # API completa e pipeline com OCR real
├── .env.example                  # modelo das variáveis (copie para .env)
├── .gitignore  .dockerignore  .nvmrc  .prettierrc.json  eslint.config.js
├── package.json  package-lock.json
├── README.md
└── LEIAME.md                     # este guia
```

---

## 4. Requisitos

**No computador (desenvolvimento):**

- **Node.js 22 LTS** — https://nodejs.org (versão "LTS")
- **Windows:** Python 3 e Visual Studio 2022 Build Tools com a carga de trabalho **Desenvolvimento para desktop com C++** são necessários se o `better-sqlite3` precisar ser compilado durante a instalação.
- **Tesseract OCR 5 com português**
  - Windows: instalador da UB Mannheim (https://github.com/UB-Mannheim/tesseract/wiki). Na instalação, em _Additional language data_, marque **Portuguese**.
  - Ubuntu/Debian: `sudo apt install tesseract-ocr tesseract-ocr-por`
  - macOS: `brew install tesseract tesseract-lang`
- (Opcional) **Docker Desktop**, para rodar o ambiente completo igual ao de produção.

**No servidor (produção):** VPS Linux (Ubuntu 24.04 recomendado) com 4 vCPU e 8 GB de RAM para começar, **Docker** instalado, um **domínio** (ex.: `api.contagestao.com.br`) apontando para o IP do servidor.

**Conta de IA:** chave da Anthropic (https://console.anthropic.com) — ou OpenAI / Azure OpenAI. Sem chave, o sistema funciona em modo `LLM_PROVIDER=none` (regras), com extração mais simples.

---

## 5. Rodar no seu computador

### 5.1 Windows (PowerShell)

```powershell
# 1. Descompacte o ContaGestao.zip e entre na pasta
cd C:\Projetos\ContaGestao

# 2. Instale as dependências
npm install
npm install --prefix frontend

# 3. Crie o .env
copy .env.example .env

# 4. Gere as chaves e cole os valores no .env (Bloco de Notas: notepad .env)
npm run gerar-chaves
```

No `.env`, ajuste no mínimo:

```
API_KEYS=<valor gerado>
ENCRYPTION_KEYS=<valor gerado>
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

(Sem chave de IA ainda? Use `LLM_PROVIDER=none`.)

```powershell
# 5. Rode os testes (devem passar todos)
npm test

# 6. Suba a API
npm run dev
```

Em um segundo terminal, inicie a interface web:

```powershell
npm --prefix frontend run dev
```

O endereço local da interface é exibido pelo Vite (normalmente `http://localhost:5173`). Por padrão, o Vite encaminha `/api` e `/health` para `http://localhost:8000`. Se a API estiver em outra origem, preencha `VITE_API_BASE_URL` e libere a origem do frontend em `CORS_ORIGINS`.

A API fica em `http://localhost:8000`. Em desenvolvimento usa SQLite (`data/contagestao.db`) e processa na própria requisição (`QUEUE_MODE=inline`), sem precisar de PostgreSQL nem Redis.

### 5.2 Linux / macOS

```bash
npm ci
npm ci --prefix frontend
cp .env.example .env
npm run gerar-chaves      # cole no .env
npm test
npm run dev
```

Em outro terminal, rode `npm --prefix frontend run dev` para abrir a interface web.

### 5.3 Primeiro teste

Crie um PDF de exemplo e envie:

```powershell
npm run exemplo:pdf
curl.exe -H "X-API-Key: SUA_CHAVE" -F "arquivo=@exemplos/fatura-exemplo.pdf" http://localhost:8000/api/v1/documentos
```

A resposta traz o `id`. Consulte o resultado:

```powershell
curl.exe -H "X-API-Key: SUA_CHAVE" http://localhost:8000/api/v1/documentos/ID/resultado
```

Baixe tudo em Excel:

```powershell
curl.exe -H "X-API-Key: SUA_CHAVE" "http://localhost:8000/api/v1/exportacoes?formato=xlsx" -o resultado.xlsx
```

> No PowerShell use **`curl.exe`** (com `.exe`); `curl` sozinho é um apelido de outro comando.
> Ferramentas visuais como **Postman** ou **Insomnia** também funcionam: método POST, corpo _form-data_, campo `arquivo` do tipo _File_, cabeçalho `X-API-Key`.

Todas as rotas estão em **docs/api-endpoints.md**.

---

## 6. Variáveis de ambiente que mais importam

| variável                          | desenvolvimento                | produção                               |
| --------------------------------- | ------------------------------ | -------------------------------------- |
| `NODE_ENV`                        | `development`                  | `production`                           |
| `API_KEYS`                        | opcional                       | **obrigatório**, 32+ caracteres        |
| `ENCRYPTION_KEYS`                 | opcional (usa chave de teste)  | **obrigatório** — guarde cópia segura  |
| `DATABASE_URL`                    | `sqlite:./data/contagestao.db` | definido pelo Docker (PostgreSQL)      |
| `QUEUE_MODE`                      | `inline`                       | `bullmq` (o Docker já define)          |
| `POSTGRES_PASSWORD`               | —                              | **obrigatório** (senha do banco)       |
| `LLM_PROVIDER` + chave            | `none` ou `anthropic`          | `anthropic` / `openai` / `azure`       |
| `STORAGE_BACKEND`                 | `local`                        | `local` (volume Docker) ou `s3`        |
| `EMAIL_WEBHOOK_SECRET`            | se for testar e-mail           | se usar recebimento por e-mail         |
| `WEBHOOK_URLS` + `WEBHOOK_SECRET` | —                              | se integrar com ERP/CRM                |
| `CORS_ORIGINS`                    | vazio                          | o domínio do seu painel web, se houver |

O arquivo `.env.example` explica cada uma. Em produção, se faltar algo essencial, o sistema **não inicia** e mostra exatamente o que corrigir.

---

## 7. Colocar em produção (servidor com Docker)

### 7.1 Preparar o servidor (uma vez)

```bash
# acesse o servidor
ssh root@IP_DO_SERVIDOR

# Docker
curl -fsSL https://get.docker.com | sh

# usuário para o sistema
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy

# firewall: só SSH, HTTP e HTTPS
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

### 7.2 Enviar o projeto

Recomendado: suba o projeto para um repositório **privado** no GitHub e clone no servidor:

```bash
su - deploy
sudo mkdir -p /opt/contagestao && sudo chown deploy /opt/contagestao
git clone git@github.com:SUA_CONTA/contagestao.git /opt/contagestao
cd /opt/contagestao
```

(Alternativa sem GitHub: copie o zip com `scp ContaGestao.zip deploy@IP:/opt/` e descompacte.)

### 7.3 Configurar o `.env` de produção

```bash
cp .env.example .env
docker run --rm -v "$PWD":/app -w /app node:22-slim node scripts/gerar-chaves.js
nano .env
```

Preencha: `NODE_ENV=production`, `API_KEYS`, `ENCRYPTION_KEYS`, `POSTGRES_PASSWORD`, `LLM_PROVIDER` e a chave da IA, `TRUST_PROXY=true`. Os demais podem ficar no padrão.

> ⚠️ **Copie a `ENCRYPTION_KEYS` para um cofre de senhas** (Bitwarden, 1Password, KeePass) **antes** de continuar. Sem ela, nenhum documento armazenado pode ser lido — nem com backup.

```bash
chmod 600 .env
```

### 7.4 Certificado HTTPS (Let's Encrypt)

1. No seu provedor de domínio, crie um registro **A** `api.seudominio.com.br → IP do servidor`.
2. Troque `seu-dominio.com.br` pelo seu domínio em `docker/nginx/nginx.conf` (2 lugares).
3. Emita o certificado (com a porta 80 ainda livre):

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d api.seudominio.com.br
sudo cp -L /etc/letsencrypt/live/api.seudominio.com.br/fullchain.pem docker/nginx/certs/
sudo cp -L /etc/letsencrypt/live/api.seudominio.com.br/privkey.pem  docker/nginx/certs/
sudo chown deploy docker/nginx/certs/*.pem
```

4. Renovação automática (o certificado vale 90 dias). Execute `sudo crontab -e` e adicione:

```
0 3 * * 1 certbot renew --webroot -w /opt/contagestao/docker/nginx/acme --deploy-hook "cp -L /etc/letsencrypt/live/api.seudominio.com.br/*.pem /opt/contagestao/docker/nginx/certs/ && docker exec contagestao-nginx-1 nginx -s reload" >> /var/log/certbot-renew.log 2>&1
```

### 7.5 Subir o sistema

```bash
cd /opt/contagestao
docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d --build
```

O primeiro build leva alguns minutos. Na sequência sobem: banco → migração (cria as tabelas e encerra) → Redis → API → worker → Nginx.

### 7.6 Conferir

```bash
docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml ps
curl https://api.seudominio.com.br/health/ready
```

O `/health/ready` deve responder `"status":"ok"` com `banco`, `fila`, `armazenamento` e `ocr` em `true`. Envie um documento de teste como na seção 5.3, trocando o endereço.

Logs:

```bash
docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml logs -f api worker
```

> Dica: crie um atalho no servidor para não digitar o comando longo:
> `echo 'alias cg="docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml"' >> ~/.bashrc && source ~/.bashrc`
> Depois: `cg ps`, `cg logs -f worker`, `cg restart api`.

### 7.7 Mais capacidade de processamento

No `.env`: `WORKER_REPLICAS=3` (vários workers) e/ou `WORKER_CONCURRENCY=3` (documentos simultâneos por worker). Depois `cg up -d`.

---

## 8. Atualizar o sistema

**Manual (no servidor):**

```bash
cd /opt/contagestao && git pull && cg up -d --build
```

As migrações de banco rodam sozinhas a cada subida (serviço `migrate`).

**Automático (GitHub Actions):** a cada `git push`, o `ci.yml` roda lint e os testes. Para publicar uma versão:

1. No GitHub, em _Settings → Secrets and variables → Actions_, crie: `DEPLOY_HOST` (IP), `DEPLOY_USER` (`deploy`), `DEPLOY_SSH_KEY` (chave privada SSH com acesso ao servidor) e `DEPLOY_PATH` (`/opt/contagestao`).
2. Em _Settings → Environments_, crie o ambiente `producao` (pode exigir aprovação manual).
3. Publique: `git tag v1.0.1 && git push --tags`.

O `deploy.yml` gera a imagem, envia ao GitHub Container Registry e atualiza o servidor. Para o servidor baixar imagens de repositório privado, faça uma vez no servidor: `docker login ghcr.io -u SEU_USUARIO` (senha = _Personal Access Token_ com permissão `read:packages`).

---

## 9. Backup e restauração

**Backup diário automático** (banco + documentos, mantém 30 dias):

```bash
crontab -e
0 2 * * * cd /opt/contagestao && bash scripts/backup.sh >> /var/log/contagestao-backup.log 2>&1
```

Os arquivos ficam em `/opt/contagestao/backups/`. **Copie-os para fora do servidor** (outro provedor, S3, Google Drive) — backup no mesmo servidor não protege contra perda do servidor.

**Restaurar:**

```bash
cg stop api worker
cg exec -T db pg_restore -U contagestao -d contagestao --clean --if-exists < backups/banco-AAAAMMDD-HHMMSS.dump
cg run --rm --no-deps -T --entrypoint tar api -xzf - -C /app/data < backups/documentos-AAAAMMDD-HHMMSS.tar.gz
cg start api worker
```

A restauração exige a mesma `ENCRYPTION_KEYS` da época do backup.

---

## 10. Segurança, LGPD e chaves

- **Trocar a chave de API de um cliente sem parar o sistema:** adicione a nova em `API_KEYS` (separada por vírgula), `cg up -d`, avise o cliente, depois remova a antiga.
- **Trocar a chave de criptografia:** gere uma nova e coloque-a **na frente**: `ENCRYPTION_KEYS=NOVA,ANTIGA`. Novos documentos usam a nova; os antigos continuam legíveis. Nunca remova a antiga enquanto houver documentos cifrados com ela.
- **Pedido de exclusão (LGPD):** `DELETE /api/v1/documentos/{id}` apaga arquivo, texto, dados e histórico.
- Arquivos e textos ficam **criptografados** (AES-256-GCM) no disco/S3; o banco e o Redis não ficam expostos na internet; só o Nginx (80/443) é público.
- Ao usar IA externa, o texto do documento é enviado ao provedor escolhido. Verifique os termos de uso e registre isso na sua política de privacidade/contratos com clientes. Para documentos que não podem sair do ambiente, use `LLM_PROVIDER=none`.

---

## 11. Recebimento por e-mail

1. Defina `EMAIL_WEBHOOK_SECRET` no `.env` (o `gerar-chaves` cria um).
2. No seu provedor de _inbound parse_ (SendGrid Inbound Parse, Mailgun Routes, Zapier/Make/n8n), aponte para:
   `https://api.seudominio.com.br/api/v1/email/entrada?token=SEU_EMAIL_WEBHOOK_SECRET`
3. Envie um e-mail com o PDF anexado para o endereço configurado no provedor.

Os anexos válidos entram como documentos (origem `email`, com o remetente registrado); os inválidos são listados em `recusados`. O assunto ajuda a escolher o tipo (ex.: "Nota fiscal outubro" → fatura).

---

## 12. Integração com ERP/CRM

Preencha `WEBHOOK_URLS` (uma ou mais URLs, separadas por vírgula) e `WEBHOOK_SECRET`. Cada documento finalizado gera um POST com os dados extraídos, assinado com HMAC-SHA256. O exemplo de validação da assinatura está em **docs/api-endpoints.md**. O histórico de entregas aparece em `GET /api/v1/documentos/{id}` (campo `webhooks`).

Alternativa sem webhook: o ERP consulta `GET /api/v1/documentos?status=concluido&desde=AAAA-MM-DD` periodicamente, ou importa o Excel de `/api/v1/exportacoes`.

---

## 13. Escolha do provedor de IA e custos

| `LLM_PROVIDER`                                   | quando usar                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `anthropic` (padrão, modelo `claude-sonnet-5-5`) | melhor equilíbrio entre precisão e custo para documentos fiscais e contratos      |
| `openai` (`gpt-4o`)                              | se você já tem contrato com a OpenAI                                              |
| `azure`                                          | quando o cliente exige dados em nuvem Microsoft                                   |
| `none`                                           | sem custo; extrai os campos principais por regras; bom para testes e contingência |

Para trocar, mude a variável e reinicie (`cg up -d`). Documentos já processados podem ser refeitos com `POST /api/v1/documentos/{id}/reprocessar`.

Para reduzir custo: PDFs com texto embutido não passam por OCR; documentos idênticos não são reprocessados; textos muito longos são cortados (`LLM_MAX_INPUT_CHARS`) mantendo início e fim, onde ficam cabeçalho e totais.

---

## 14. Monitoramento

- `GET /health/ready` a cada 1 minuto em um monitor gratuito (UptimeRobot, Better Stack). Ele avisa por e-mail/WhatsApp se cair.
- Logs em JSON (`cg logs -f api worker`), cada requisição com `X-Request-Id`. Para busca centralizada, envie a saída do Docker para Grafana Loki, Better Stack ou Datadog.
- Documentos em `revisao` precisam de conferência humana: liste com `GET /api/v1/documentos?status=revisao`.

---

## 15. Problemas comuns

| sintoma                                            | causa provável                                     | solução                                                                                                |
| -------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/health/ready` com `"ocr": false`                 | Tesseract não encontrado                           | instale-o; no Windows ajuste `TESSERACT_CMD` com o caminho completo do `tesseract.exe`                 |
| log "Idiomas do Tesseract ausentes"                | falta o português                                  | Windows: reinstale marcando _Portuguese_; Linux: `apt install tesseract-ocr-por`                       |
| "Configuração inválida para produção" ao iniciar   | faltou variável obrigatória                        | a mensagem lista o que falta; corrija o `.env`                                                         |
| `required variable POSTGRES_PASSWORD is missing`   | `.env` não encontrado pelo Docker                  | rode da raiz do projeto e use `--env-file .env` (os atalhos `npm run docker:*` e o `cg` já fazem isso) |
| documento fica em `recebido`                       | worker parado ou sem Redis                         | `cg ps` e `cg logs worker`                                                                             |
| status `erro` "Falha na chamada ao LLM"            | chave da IA inválida, sem crédito ou limite de uso | confira a chave/créditos e use _reprocessar_                                                           |
| status `revisao`                                   | alguma regra falhou                                | veja `erros` em `/resultado`; pode ser erro do documento (CNPJ errado de fato) ou do OCR (imagem ruim) |
| `413` no upload                                    | arquivo maior que `MAX_UPLOAD_MB`                  | aumente a variável (e `client_max_body_size` no `nginx.conf`)                                          |
| "Chave de criptografia não encontrada"             | `ENCRYPTION_KEYS` foi trocada sem manter a antiga  | recoloque a chave antiga depois da nova, separadas por vírgula                                         |
| `npm install` falha no Windows em `better-sqlite3` | Python ou ferramentas de compilação nativa ausentes | use Node 22, instale Python 3 e Visual Studio 2022 Build Tools com **Desenvolvimento para desktop com C++** |

---

## 16. Checklist antes de liberar para clientes

- [ ] `npm test` passando (47 testes)
- [ ] `npm run lint`, `npm run lint:frontend` e `npm run build:frontend` passando
- [ ] Frontend apontando para a API correta por `VITE_API_BASE_URL` (ou proxy same-origin)
- [ ] `.env` de produção com `NODE_ENV=production`, chaves novas e `chmod 600`
- [ ] `ENCRYPTION_KEYS` guardada em cofre de senhas, fora do servidor
- [ ] Domínio com HTTPS válido e renovação automática agendada
- [ ] `/health/ready` respondendo `ok` e monitor externo configurado
- [ ] Backup diário agendado **e cópia externa** testada com uma restauração
- [ ] Firewall com apenas 22, 80 e 443 abertas
- [ ] Chave de IA com limite de gasto configurado no painel do provedor
- [ ] Política de privacidade/contratos mencionando o uso de IA externa (LGPD)
- [ ] Teste real com uma NF-e, uma NFS-e, um contrato e um documento digitalizado do seu dia a dia
- [ ] Conferir o [checklist geral do projeto](docs/checklist-projeto.md), incluindo os itens de configuração manual e deploy

---

**ContaGestão — Soluções Inteligentes** · versão 1.0.0
Kodama e Maciel Assessoria e Consultoria Tributária Ltda.

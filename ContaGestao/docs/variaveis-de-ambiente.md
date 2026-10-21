# Variáveis do ContaGestão: lista e locais de preenchimento

Este guia descreve as variáveis de `.env.example`, as variáveis de implantação que ficam fora do `.env` e o local correto de cada configuração. Os valores indicados são padrões ou exemplos, não credenciais. **Não publique nem envie o arquivo `.env`**, pois ele contém segredos.

## Como preencher

1. Na pasta raiz do projeto, crie o arquivo local com `copy .env.example .env` (PowerShell) ou `cp .env.example .env` (Linux/macOS).
2. Abra o `.env` em um editor de texto e altere somente o que se aplica ao seu ambiente. Mantenha `NOME_DA_VARIAVEL=valor`, sem aspas, a menos que o valor exija formatação específica.
3. Gere os segredos com `npm run gerar-chaves` e copie cada linha gerada para a variável de mesmo nome no `.env`. Não compartilhe a saída.
4. Salve o `.env`. O frontend local também lê variáveis `VITE_*` desse arquivo; **nunca** coloque segredos em variáveis `VITE_*`, pois podem ser incluídas no JavaScript público.
5. Reinicie a API e o frontend após alterar variáveis. Mudanças de variáveis do frontend exigem novo `npm run build:frontend`.

**Obrigatórias para produção:** `API_KEYS`, `ENCRYPTION_KEYS`, `DATABASE_URL` PostgreSQL, `QUEUE_MODE=bullmq`, `REDIS_URL` funcional e as credenciais do provedor escolhido em `LLM_PROVIDER`. `POSTGRES_PASSWORD` é exigida pelos arquivos Docker Compose. Se usar webhooks, também preencha `WEBHOOK_SECRET`; se usar S3, `S3_BUCKET`.

## 1. Aplicação e interface

| Variável | Valor inicial | O que preencher e onde |
|---|---|---|
| `NODE_ENV` | `development` | Mantenha no desenvolvimento/testes locais. Em produção Docker, use `production`; ativa as validações de segurança obrigatórias. |
| `APP_NAME` | `ContaGestão – Soluções Inteligentes` | Valor aceito pela configuração central. O rótulo exibido pela API ainda é fixo; por enquanto, mantenha o padrão. |
| `PORT` | `8000` | Porta interna em que a API Node escuta. Normalmente mantenha; se alterar no Docker, alinhe porta, healthcheck, Nginx e mapeamento. |
| `HOST` | `0.0.0.0` | Interface de rede da API. Mantenha `0.0.0.0` no Docker para permitir acesso pela rede do contêiner. |
| `LOG_LEVEL` | `info` | Nível de log: `fatal`, `error`, `warn`, `info`, `debug`, `trace` ou `silent`. Use `info` normalmente e evite `trace` em produção. |
| `LOG_PRETTY` | `false` | Use `true` para logs coloridos no desenvolvimento; deixe `false` em produção. |
| `CORS_ORIGINS` | vazio | Origens do navegador autorizadas, separadas por vírgula (ex.: `https://app.exemplo.com`). Necessário quando frontend e API estão em origens diferentes; não inclua caminhos. |
| `VITE_API_BASE_URL` | vazio | URL base pública da API usada pelo frontend quando não estiver na mesma origem (ex.: `https://api.exemplo.com`). Vazio usa caminho relativo/proxy local. Não é segredo. |
| `TRUST_PROXY` | `false` | Use `true` se a API estiver atrás do Nginx ou balanceador configurado para encaminhar IPs. |
| `RATE_LIMIT_PER_MINUTE` | `120` | Limite de requisições por minuto por cliente. Ajuste conforme tráfego e capacidade. |

## 2. Segurança e autenticação

| Variável | Valor inicial | O que preencher e onde |
|---|---|---|
| `API_KEYS` | vazio | Chave(s) para o cabeçalho `X-API-Key`, separadas por vírgula. Gere com `npm run gerar-chaves`. Em produção, cada chave precisa ter pelo menos 32 caracteres. Cadastre a chave de acesso do painel/integração aqui. |
| `ENCRYPTION_KEYS` | vazio | Chave(s) AES-256 em Base64, geradas com `npm run gerar-chaves`. A primeira cifra novos dados; mantenha as antigas depois de uma vírgula durante rotação. Guarde uma cópia segura fora do servidor: perder a chave impede descriptografar documentos existentes. Obrigatória em produção. |
| `EMAIL_WEBHOOK_SECRET` | vazio | Segredo criado/gerado para autenticar o endpoint de entrada de e-mail. Configure o mesmo token no provedor, enviando `X-Webhook-Token` ou `?token=`. |

## 3. Banco de dados e Docker Compose

| Variável | Valor inicial | O que preencher e onde |
|---|---|---|
| `DATABASE_URL` | `sqlite:./data/contagestao.db` | Desenvolvimento local usa SQLite. Produção usa URL PostgreSQL no formato `postgres://usuario:senha@servidor:5432/banco`; no Compose a URL é montada automaticamente com `POSTGRES_PASSWORD`. |
| `DB_POOL_MAX` | `10` | Número máximo de conexões PostgreSQL no pool. Ajuste junto ao limite de conexões do banco. |
| `DB_AUTO_MIGRATE` | `true` | Desenvolvimento: `true` aplica migrações automaticamente. Produção Compose: mantenha `false`; o serviço `migrate` executa as migrações antes da API. |
| `POSTGRES_PASSWORD` | vazio | Crie uma senha forte para o usuário do banco gerenciado pelo Compose. Preencha no `.env` antes de usar `docker compose`; a mesma senha é injetada no PostgreSQL e na conexão da aplicação. |

## 4. Fila e workers

| Variável | Valor inicial | O que preencher e onde |
|---|---|---|
| `QUEUE_MODE` | `inline` | Desenvolvimento sem Redis: `inline`. Produção: `bullmq` e worker separado, obrigatório para o modo de produção. |
| `REDIS_URL` | `redis://localhost:6379` | Endereço do Redis. Local: padrão. Compose: o serviço injeta `redis://redis:6379`. Produção fora do Compose: informe o endereço e credenciais do Redis, se houver. |
| `WORKER_CONCURRENCY` | `2` | Número de documentos processados simultaneamente por instância de worker. Dimensione conforme CPU, memória e limites do provedor de OCR/IA. |
| `JOB_TIMEOUT_SECONDS` | `900` | Tempo máximo configurado para o processamento de um job, em segundos. |

## 5. Armazenamento e AWS

| Variável | Valor inicial | O que preencher e onde |
|---|---|---|
| `STORAGE_BACKEND` | `local` | `local` grava no disco/volume; `s3` usa bucket compatível. Produção pode usar volume persistente ou S3. |
| `STORAGE_LOCAL_PATH` | `./data/storage` | Pasta local dos arquivos criptografados. No Compose o caminho é `/app/data/storage` e o volume persiste os documentos. |
| `S3_BUCKET` | vazio | Nome do bucket. Obrigatório ao selecionar `STORAGE_BACKEND=s3`. |
| `S3_PREFIX` | `documentos/` | Prefixo/caminho dentro do bucket. Opcional; evite remover arquivos existentes sem planejar migração. |
| `S3_ENDPOINT_URL` | vazio | Endpoint personalizado para MinIO, R2 ou outro S3 compatível. Para AWS S3 padrão, deixe vazio. |
| `S3_FORCE_PATH_STYLE` | `false` | Use `true` quando o provedor compatível exigir endereçamento path-style; normalmente deixe `false` para AWS. |
| `AWS_REGION` | `sa-east-1` | Região AWS do bucket e/ou Textract, por exemplo `sa-east-1`. Use a região real dos serviços. |
| `AWS_ACCESS_KEY_ID` | vazio | Credencial AWS com permissões mínimas necessárias para S3/Textract. Opcional se usar IAM Role ou credenciais padrão do ambiente. |
| `AWS_SECRET_ACCESS_KEY` | vazio | Chave secreta correspondente ao `AWS_ACCESS_KEY_ID`. Mantenha apenas no `.env/cofre de segredos`; não use credenciais pessoais com privilégios amplos. |

## 6. Upload e limites

| Variável | Valor inicial | O que preencher e onde |
|---|---|---|
| `MAX_UPLOAD_MB` | `25` | Tamanho máximo de cada arquivo em MB. Em produção, alinhe com `client_max_body_size` do Nginx e os limites do proxy. |
| `MAX_PAGES` | `50` | Número máximo de páginas por documento. Aumentar pode elevar tempo e custo de processamento. |
| `MAX_FILES_PER_EMAIL` | `10` | Máximo de anexos aceitos em cada chamada do webhook de e-mail. |
| `ALLOWED_EXTENSIONS` | `pdf,png,jpg,jpeg,tif,tiff` | Extensões aceitas, separadas por vírgula. O servidor também confere o conteúdo real do arquivo. |

## 7. OCR

| Variável | Valor inicial | O que preencher e onde |
|---|---|---|
| `OCR_ENGINE` | `tesseract` | `tesseract` para OCR local; `textract` para AWS Textract. |
| `TESSERACT_CMD` | `tesseract` | Comando/caminho do executável. No Windows, use o caminho completo, por exemplo `C:\Program Files\Tesseract-OCR\tesseract.exe`. |
| `TESSERACT_LANG` | `por+eng` | Idiomas instalados no Tesseract; para português e inglês use `por+eng`. |
| `TESSERACT_PSM` | `3` | Modo de segmentação de página do Tesseract. Mantenha o padrão salvo se tiver uma configuração validada para seus documentos. |
| `OCR_DPI` | `300` | Resolução de renderização de páginas PDF para OCR. Maior pode melhorar leitura, consumindo mais memória e CPU. |
| `OCR_AUTO_ROTATE` | `true` | Tenta identificar e corrigir orientação da página antes do OCR do Tesseract. |
| `ENHANCE_BINARIZE` | `false` | Ativa limiarização preto/branco no pré-processamento. Teste com documentos reais antes de habilitar. |
| `NATIVE_TEXT_MIN_CHARS` | `80` | Quantidade mínima de caracteres do texto nativo por página PDF para dispensar OCR. |

## 8. LLM / extração

| Variável | Valor inicial | O que preencher e onde |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | Escolha `anthropic`, `openai`, `azure` ou `none`. `none` usa extração heurística sem chave externa; é mais limitada. |
| `LLM_MAX_TOKENS` | `4096` | Limite de tokens da resposta do modelo. Ajuste se respostas forem truncadas, observando custo e limites do modelo. |
| `LLM_TIMEOUT_SECONDS` | `120` | Tempo limite das chamadas ao provedor de LLM. |
| `LLM_MAX_RETRIES` | `3` | Tentativas configuradas no cliente do provedor para falhas transitórias. |
| `LLM_MAX_INPUT_CHARS` | `60000` | Limite de caracteres de OCR enviados ao modelo; textos maiores são reduzidos mantendo início e fim. |
| `ANTHROPIC_API_KEY` | vazio | Preencha com a chave obtida no console Anthropic somente se `LLM_PROVIDER=anthropic`. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Identificador do modelo Anthropic habilitado na sua conta. Confirme disponibilidade e nome no provedor antes de produção. |
| `OPENAI_API_KEY` | vazio | Preencha com a chave da OpenAI somente se `LLM_PROVIDER=openai`. |
| `OPENAI_MODEL` | `gpt-4o` | Identificador de modelo disponível na conta OpenAI. |
| `AZURE_OPENAI_ENDPOINT` | vazio | Endpoint do recurso Azure OpenAI, por exemplo `https://recurso.openai.azure.com`. Necessário no modo `azure`. |
| `AZURE_OPENAI_API_KEY` | vazio | Chave do recurso Azure OpenAI. Necessária no modo `azure`. |
| `AZURE_OPENAI_DEPLOYMENT` | vazio | Nome exato do deployment criado no Azure. Necessário no modo `azure`. |
| `AZURE_OPENAI_API_VERSION` | `2024-10-21` | Versão da API aceita pelo recurso Azure. Altere somente se seu deployment exigir outra versão suportada. |

Preencha somente a chave do provedor selecionado. Chaves e chamadas a modelos podem gerar custos; configure limites de uso no painel do provedor.

## 9. Webhooks de saída (ERP/CRM)

| Variável | Valor inicial | O que preencher e onde |
|---|---|---|
| `WEBHOOK_URLS` | vazio | URL(s) HTTPS que recebem documentos processados, separadas por vírgula. Deixe vazio para desativar as notificações de saída. |
| `WEBHOOK_SECRET` | vazio | Segredo HMAC compartilhado entre ContaGestão e o receptor para verificar assinatura. Obrigatório quando `WEBHOOK_URLS` estiver preenchido. |
| `WEBHOOK_TIMEOUT_SECONDS` | `15` | Tempo máximo de espera por tentativa de entrega. |
| `WEBHOOK_MAX_RETRIES` | `3` | Número máximo de tentativas de entrega por URL. |
| `WEBHOOK_RETRY_BASE_MS` | `1000` | Atraso inicial entre tentativas, em milissegundos; as esperas aumentam exponencialmente. |

## 10. Variáveis usadas somente pelo Docker Compose

| Variável | Valor inicial | O que preencher e onde |
|---|---|---|
| `API_PORT` | `8000` | Porta do host para acessar a API no Compose de desenvolvimento. Pode ser diferente da porta interna. |
| `WORKER_REPLICAS` | `1` | Quantidade de réplicas de worker no Compose de produção. Aumente conforme capacidade e carga. |
| `IMAGE` | `contagestao:latest` | Nome/tag da imagem Docker. Normalmente automático no deploy; ajuste apenas para usar outra imagem. |

## 11. GitHub Actions, backup e domínio — preencher fora do `.env`

| Nome | Local correto | O que inserir |
|---|---|---|
| `DEPLOY_HOST` | GitHub → Settings → Secrets and variables → Actions secrets | IP ou hostname do servidor de produção. |
| `DEPLOY_USER` | Mesmo local, como secret | Usuário SSH de deploy, com permissões mínimas. |
| `DEPLOY_SSH_KEY` | Mesmo local, como secret | Chave privada SSH completa correspondente ao usuário de deploy. Não coloque no `.env` nem no repositório. |
| `DEPLOY_PATH` | Mesmo local, como secret | Caminho absoluto do projeto no servidor, por exemplo `/opt/contagestao`. |
| `GITHUB_TOKEN` | Fornecido automaticamente pelo GitHub Actions | O workflow usa o token embutido para publicar imagem no GHCR; não é necessário cadastrar manualmente. |
| `BACKUP_DIR` | Ambiente do shell que executa `scripts/backup.sh` | Pasta de destino dos backups; padrão `./backups`. |
| `BACKUP_RETENCAO_DIAS` | Ambiente do shell que executa `scripts/backup.sh` | Dias de retenção de backups; padrão `30`. |
| Domínio do Nginx | `docker/nginx/nginx.conf` | Troque `seu-dominio.com.br` pelo domínio real e instale `fullchain.pem` e `privkey.pem` em `docker/nginx/certs/`. |

As variáveis de backup são variáveis de shell, não configurações lidas pelo servidor Node. Os quatro `DEPLOY_*` são secrets do GitHub Actions, não valores do `.env` do aplicativo. Não cadastre secrets no GitHub enquanto o deploy automático não for usado.

## Combinações comuns

### Desenvolvimento local, sem serviços externos

Mantenha os padrões locais, gere `API_KEYS` e `ENCRYPTION_KEYS`, use `QUEUE_MODE=inline`, `STORAGE_BACKEND=local` e `LLM_PROVIDER=none` (ou escolha um LLM e preencha sua chave). Instale Tesseract com o idioma português para processar documentos digitalizados; PDFs com texto nativo podem ser lidos sem OCR.

### Produção com Docker, PostgreSQL e Redis

Configure `NODE_ENV=production`, `API_KEYS`, `ENCRYPTION_KEYS`, `POSTGRES_PASSWORD`, um provedor LLM e mantenha os serviços Compose usando PostgreSQL e BullMQ. Configure domínio/certificados do Nginx. Preencha `CORS_ORIGINS`/`VITE_API_BASE_URL` conforme a hospedagem do frontend; a composição atual do Docker não serve automaticamente os arquivos do frontend.

### Integração opcional

- AWS Textract: `OCR_ENGINE=textract`, `AWS_REGION` e credenciais AWS ou IAM Role.
- S3: `STORAGE_BACKEND=s3`, `S3_BUCKET`, região e, se necessário, endpoint/credenciais.
- E-mail de entrada: `EMAIL_WEBHOOK_SECRET` e o mesmo token no provedor.
- ERP/CRM de saída: `WEBHOOK_URLS` e `WEBHOOK_SECRET`.

# Checklist geral do ContaGestão

Legenda: `[x]` verificado no código ou por comando; `[ ]` requer configuração, serviço externo ou validação no ambiente de destino.

## Estrutura e componentes

- [x] API Express, autenticação por chave e rotas de saúde.
- [x] Ingestão por upload e webhook de e-mail, com limite, validação do conteúdo e deduplicação.
- [x] Armazenamento local/S3 com criptografia e suporte a rotação de chaves.
- [x] Processamento de PDF/imagem, OCR, classificação, extração por LLM/regras e validação de negócio.
- [x] Persistência por Knex, migração inicial, fila BullMQ/Redis e modo local inline.
- [x] Consulta, reprocessamento, exclusão, exportação e entrega por webhook.
- [x] Interface conectada ao contrato da API; URL sem hardcode e upload com tipos aceitos pelo backend.
- [x] Dependências instaladas e consistentes com os manifests (`npm ls --depth=0` nos dois projetos).

## Verificações executadas

- [x] Backend: `npm test` — 46 aprovados, 0 falhas; 1 teste de OCR real ignorado porque Tesseract não está instalado neste computador.
- [x] Backend: `npm run lint`.
- [x] Frontend: `npm --prefix frontend run lint`.
- [x] Frontend: `npm --prefix frontend run build`.
- [ ] OCR de imagem digitalizada: instalar Tesseract 5 e idioma português e executar novamente `npm test`.
- [ ] Docker, Redis, PostgreSQL, S3/Textract, provedores LLM, webhooks e deploy: validar com credenciais e serviços do ambiente de destino.

## Preenchimento manual

1. Consulte a [lista completa de variáveis e seus locais de preenchimento](./variaveis-de-ambiente.md). Copie `.env.example` para `.env`; nunca coloque segredos no Git.
2. Gere valores aleatórios com `npm run gerar-chaves` e copie para `API_KEYS`, `ENCRYPTION_KEYS`, `EMAIL_WEBHOOK_SECRET`, `WEBHOOK_SECRET` e `POSTGRES_PASSWORD`. Guarde `ENCRYPTION_KEYS` em local seguro: perder a chave impede ler arquivos já criptografados.
3. Selecione o provedor em `LLM_PROVIDER` e preencha somente a chave correspondente (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` ou os campos `AZURE_OPENAI_*`). Para não usar serviço externo, selecione `none`.
4. Para AWS/Textract ou S3, preencha apenas as credenciais, região, bucket e endpoint necessários; em produção AWS, prefira IAM Role.
5. Preencha `WEBHOOK_URLS` e `WEBHOOK_SECRET` somente se houver integração ERP/CRM.
6. `VITE_API_BASE_URL` pode ficar vazio para usar a mesma origem/proxy local. Se o frontend e a API estiverem em origens diferentes, informe a URL base da API e inclua a origem do frontend em `CORS_ORIGINS`.
7. Para produção, configure também `NODE_ENV=production`, PostgreSQL, Redis/fila BullMQ, armazenamento persistente, domínio/certificados em `docker/nginx/nginx.conf` e os segredos `DEPLOY_*` do GitHub Actions.

## Antes de liberar para uso real

- [ ] Confirmar que `.env` contém todas as chaves necessárias ao modo escolhido, sem compartilhar o arquivo.
- [ ] Rodar `npm run lint`, `npm run lint:frontend`, `npm test` e `npm run build:frontend`.
- [ ] Conferir `/health/ready` com os serviços reais e testar o upload até o resultado.
- [ ] Testar um PDF digital, uma imagem digitalizada, um arquivo rejeitado e cada tipo de documento aceito.
- [ ] Conferir permissões de API, CORS, HTTPS, rotação/backup das chaves e restauração do backup.
- [ ] Validar a extração com documentos reais e revisar manualmente os resultados; OCR/LLM não substitui conferência fiscal ou jurídica.
- [ ] Confirmar a hospedagem do frontend: o Compose atual publica API/worker e Nginx reverso; o build do frontend é gerado separadamente.

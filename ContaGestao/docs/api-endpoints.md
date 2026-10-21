# ContaGestão – Referência da API (v1)

Base: `https://seu-dominio.com.br` (desenvolvimento: `http://localhost:8000`)

Todas as rotas em `/api/v1` exigem o cabeçalho **`X-API-Key`**, exceto o webhook de e-mail (que usa token próprio). Respostas em JSON (UTF-8). Datas em ISO 8601 (UTC). Cada resposta traz `X-Request-Id`, útil para localizar o atendimento nos logs.

## Status de um documento

| status        | significado                                                                   |
| ------------- | ----------------------------------------------------------------------------- |
| `recebido`    | arquivo armazenado, aguardando o worker                                       |
| `processando` | OCR / extração em andamento                                                   |
| `concluido`   | dados extraídos e aprovados em todas as regras de negócio                     |
| `revisao`     | dados extraídos, mas alguma regra falhou (ver `erros`) — conferir manualmente |
| `erro`        | não foi possível processar (ver `erro`) — corrija e use _reprocessar_         |

---

## Saúde

### `GET /health`

Processo no ar. `200 {"status":"ok","versao":"1.0.0","uptimeSegundos":12}`

### `GET /health/ready`

Banco, fila, armazenamento e OCR. `200` quando tudo ok; `503` com `checks` indicando o que falhou.

---

## Documentos

### `POST /api/v1/documentos` — enviar arquivo

`multipart/form-data`

| campo            | obrigatório | descrição                                             |
| ---------------- | ----------- | ----------------------------------------------------- |
| `arquivo`        | sim         | PDF, PNG, JPG/JPEG ou TIFF (até `MAX_UPLOAD_MB`)      |
| `tipo_documento` | não         | `auto` (padrão), `fatura`, `contrato` ou `formulario` |

Respostas:

- `202` — recebido e enfileirado: `{"duplicado": false, "documento": {...}}`
- `200` — o mesmo arquivo já tinha sido processado: `{"duplicado": true, "documento": {...}}`
- `400` campo ausente / tipo inválido · `401` chave inválida · `413` arquivo grande demais · `415` extensão não permitida ou conteúdo diferente da extensão

```bash
curl -H "X-API-Key: $CHAVE" -F "arquivo=@nota.pdf" -F "tipo_documento=fatura" \
     https://seu-dominio.com.br/api/v1/documentos
```

### `GET /api/v1/documentos` — listar

Parâmetros (todos opcionais): `status`, `tipo` (`fatura|contrato|formulario`), `desde` e `ate` (`AAAA-MM-DD`, inclusivos), `limite` (1–200, padrão 50), `deslocamento` (paginação).

`200 {"total": 134, "limite": 50, "deslocamento": 0, "itens": [ ...documentos ]}`

### `GET /api/v1/documentos/{id}` — situação do documento

Inclui `webhooks` (histórico de entregas para ERP/CRM).

```json
{
  "id": "1ae5208c-...",
  "nomeArquivo": "nota.pdf",
  "tipoConteudo": "application/pdf",
  "tamanhoBytes": 1243,
  "sha256": "…",
  "origem": "upload",
  "remetente": null,
  "tipoSolicitado": "auto",
  "tipoDocumento": "fatura",
  "status": "concluido",
  "erro": null,
  "paginas": 1,
  "confiancaOcr": null,
  "textoNativo": true,
  "criadoEm": "…",
  "atualizadoEm": "…",
  "processadoEm": "…",
  "webhooks": []
}
```

`confiancaOcr` (0–100) só existe quando houve OCR; `textoNativo: true` indica PDF com texto embutido (sem OCR).

### `GET /api/v1/documentos/{id}/resultado` — dados extraídos

`200`:

```json
{
  "documento": { ... },
  "dados": { "...": "conforme o tipo (abaixo)" },
  "erros": [],
  "avisos": ["Valor total (R$ 240,00) difere de ..."],
  "valido": true,
  "provedorLlm": "anthropic",
  "modeloLlm": "claude-sonnet-5-5"
}
```

`409` enquanto o resultado não existe (ainda processando ou com erro).

### `GET /api/v1/documentos/{id}/texto`

Texto bruto do OCR (`text/plain`), separado por página. `409` se ainda não houver.

### `GET /api/v1/documentos/{id}/arquivo`

Baixa o arquivo original (descriptografado na hora).

### `POST /api/v1/documentos/{id}/reprocessar`

Apaga o resultado anterior e processa de novo (ex.: após trocar de provedor de LLM). `202`; `409` se já estiver processando.

### `DELETE /api/v1/documentos/{id}`

Exclui definitivamente arquivo, texto, resultado e histórico (atende pedidos de eliminação da LGPD). `204`.

---

## Exportação

### `GET /api/v1/exportacoes`

| parâmetro                        | valores                        |
| -------------------------------- | ------------------------------ |
| `formato`                        | `xlsx` (padrão), `csv`, `json` |
| `status`, `tipo`, `desde`, `ate` | mesmos filtros da listagem     |

- **XLSX**: abas _Documentos_ (uma linha por documento, campos achatados como `emitente.cnpj`), _Itens_ (itens das faturas e partes dos contratos) e _Validacao_ (erros e avisos).
- **CSV**: separador `;`, UTF-8 com BOM (abre direto no Excel em português), proteção contra injeção de fórmulas.
- Cabeçalho `X-Total-Documentos` informa a quantidade exportada.

---

## Recebimento por e-mail

### `POST /api/v1/email/entrada`

Para o _inbound parse_ do seu provedor (SendGrid, Mailgun, Zapier, Make, n8n…).
Autenticação: cabeçalho `X-Webhook-Token: <EMAIL_WEBHOOK_SECRET>` **ou** `?token=<EMAIL_WEBHOOK_SECRET>` na URL.

Corpo `multipart/form-data`: campos `from`/`sender`, `subject` e os anexos em qualquer campo de arquivo. O assunto ajuda a escolher o tipo (“nota fiscal”, “boleto” → fatura; “contrato”, “aditivo” → contrato; “ficha”, “formulário” → formulário).

`200`:

```json
{
  "remetente": "financeiro@fornecedor.com.br",
  "assunto": "NF outubro",
  "aceitos": [{ "arquivo": "nf.pdf", "documentoId": "…", "duplicado": false }],
  "recusados": [{ "arquivo": "assinatura.txt", "motivo": "Extensão \".txt\" não permitida..." }]
}
```

Sempre `200` mesmo com anexos recusados, para o provedor não reenviar o e-mail em loop.

---

## Webhooks de saída (para ERP/CRM)

Configure `WEBHOOK_URLS` e `WEBHOOK_SECRET`. Ao terminar cada documento é enviado um `POST` JSON:

```json
{ "evento": "documento.concluido", "enviadoEm": "…", "documentoId": "…", "arquivo": "nota.pdf",
  "tipo": "fatura", "status": "concluido", "valido": true, "dados": { ... }, "erros": [], "avisos": [] }
```

Eventos: `documento.concluido`, `documento.revisao`, `documento.erro`.

Cabeçalhos: `X-ContaGestao-Event`, `X-ContaGestao-Timestamp`, `X-ContaGestao-Delivery` (id único — use para ignorar repetições) e `X-ContaGestao-Signature: sha256=<hex>`.

**Validar a assinatura no seu sistema** (Node.js):

```js
import crypto from 'node:crypto';
const esperado =
  'sha256=' +
  crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${req.headers['x-contagestao-timestamp']}.${corpoBruto}`)
    .digest('hex');
const ok = crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(req.headers['x-contagestao-signature']));
// Recuse também timestamps com mais de 5 minutos (proteção contra reenvio).
```

Novas tentativas com espera exponencial em falhas de rede, 5xx, 408 e 429 (`WEBHOOK_MAX_RETRIES`). Outros 4xx não são repetidos.

---

## Campos extraídos por tipo

**fatura** — `tipo_documento`, `numero`, `serie`, `data_emissao`, `data_vencimento`, `competencia`, `emitente{razao_social, cnpj, inscricao_estadual, inscricao_municipal, endereco}`, `destinatario{nome, cpf_cnpj, endereco}`, `itens[{descricao, quantidade, valor_unitario, valor_total}]`, `valor_produtos_servicos`, `valor_desconto`, `valor_frete`, `impostos{icms, ipi, pis, cofins, iss, irrf, csll, inss}`, `valor_total`, `valor_liquido`, `chave_acesso`, `linha_digitavel`, `forma_pagamento`, `observacoes`.

**contrato** — `numero_contrato`, `objeto`, `partes[{papel, nome, cpf_cnpj}]`, `data_assinatura`, `vigencia_inicio`, `vigencia_fim`, `prazo_meses`, `valor_global`, `valor_mensal`, `indice_reajuste`, `data_base_reajuste`, `garantia_percentual`, `multas`, `foro`, `clausulas_relevantes[]`.

**formulario** — `titulo`, `nome`, `cpf`, `cnpj`, `data`, `assinatura_presente`, `campos[{rotulo, valor}]`.

Valores monetários são números (`1500.00`), datas `AAAA-MM-DD`, CPF/CNPJ só com dígitos (CNPJ alfanumérico com letras maiúsculas). Campos não encontrados vêm `null`.

## Regras de negócio aplicadas

| tipo       | erro (→ `revisao`)                                                                                                                                                                                                                                                                              | aviso                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| fatura     | CNPJ do emitente ou CPF/CNPJ do destinatário inválido; emissão no futuro; vencimento antes da emissão; valor total ausente/negativo; quantidade × unitário ≠ total do item; soma dos itens ≠ valor dos produtos/serviços; líquido > total; DV inválido na chave de acesso ou na linha digitável | CNPJ/data de emissão não encontrados; total ≠ produtos − desconto + frete + IPI              |
| contrato   | CPF/CNPJ inválido em alguma parte; fim da vigência antes do início; valor mensal > global                                                                                                                                                                                                       | partes não identificadas; global ≠ mensal × prazo; assinatura após o fim; vigência encerrada |
| formulario | CPF/CNPJ inválido                                                                                                                                                                                                                                                                               | data no futuro; sem assinatura; nenhum campo identificado                                    |

Todos os tipos recebem aviso quando a confiança média do OCR fica abaixo de 60%.

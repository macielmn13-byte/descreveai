# 🔒 Auditoria de Segurança — DescreveAí

Revisão de todas as rotas de API pra garantir isolamento entre usuários.

---

## 📊 Legenda

- ✅ **OK** — Sem riscos
- ⚠️ **Atenção** — Pequeno ajuste necessário
- ❌ **CRÍTICO** — Precisa corrigir urgente

---

## 🔍 RESULTADOS

### 1. `app/api/cadastro/route.ts`

- **Autenticação:** ✅ OK (cria usuário + login automático)
- **Filtro user_id:** ✅ N/A (novo usuário)
- **Validação:** ⚠️ Básica (só obrigatoriedade + min 6)
- **Vazamento:** ⚠️ ATENÇÃO (revela email existente via `err.message`)
- **Rate limiting:** ❌ CRÍTICO (não tem)
- **Status:** ⚠️ **Precisa ajustes** (3 correções)

**Correções necessárias:**

1. ❌ Retornar erro genérico "Erro ao cadastrar" (nunca revelar se email existe)
2. ⚠️ Validar formato de email (regex simples)
3. ❌ Adicionar rate limiting (limite de cadastros por IP)

---

### 2. `app/api/exportar/route.ts`

- **Autenticação:** ⏳ Pendente
- **Filtro user_id:** ⏳ Pendente
- **Validação:** ⏳ Pendente
- **Vazamento:** ⏳ Pendente
- **Status:** ⏳ Pendente

---

### 3. `app/api/gerar/route.ts`

- **Autenticação:** ⏳ Pendente
- **Filtro user_id:** ⏳ Pendente
- **Validação:** ⏳ Pendente
- **Vazamento:** ⏳ Pendente
- **Status:** ⏳ Pendente

---

### 4. `app/api/login/route.ts`

- **Autenticação:** ✅ OK (valida email/senha)
- **Filtro user_id:** ✅ N/A (não busca dados)
- **Validação:** ⚠️ Básica (só obrigatoriedade)
- **Vazamento:** ⚠️ ATENÇÃO (vaza existência de email via `err.message`)
- **Rate limiting:** ❌ CRÍTICO (não tem)
- **Status:** ⚠️ **Precisa ajustes** (3 correções)

**Correções necessárias:**

1. ❌ Retornar erro genérico "Email ou senha inválidos" (nunca revelar se email existe)
2. ⚠️ Validar formato de email (regex simples)
3. ❌ Adicionar rate limiting (limite de tentativas por IP)

---

### 5. `app/api/logout/route.ts`

- **Autenticação:** ✅ N/A (logout não precisa validar user)
- **Filtro user_id:** ✅ N/A
- **Validação:** ✅ N/A (sem body)
- **Vazamento:** ✅ OK (não retorna dados sensíveis)
- **Rate limiting:** ✅ N/A (não faz sentido)
- **Status:** ✅ **OK — Sem riscos**

---

### 6. `app/api/perfil/senha/route.ts`

- **Autenticação:** ✅ OK
- **Filtro user_id:** ✅ OK (`user.id` vem da sessão, não do body)
- **Validação:** ⚠️ Básica (só obrigatoriedade)
- **Vazamento:** ⚠️ ATENÇÃO (`err.message` revela motivo)
- **Rate limiting:** ❌ CRÍTICO (força bruta possível)
- **Status:** ⚠️ **Precisa ajustes** (2 correções)

**Correções necessárias:**

1. ❌ Retornar erro genérico "Erro ao mudar senha"
2. ❌ Adicionar rate limiting (evitar força bruta)
3. ⚠️ Validar força da nova senha (min 8 caracteres)

---

### 7. `app/api/stripe/webhook/route.ts`

- **Autenticação:** ⏳ Pendente
- **Filtro user_id:** ⏳ Pendente
- **Validação:** ⏳ Pendente
- **Vazamento:** ⏳ Pendente
- **Status:** ⏳ Pendente

---

## 📝 OBSERVAÇÕES

Anotações gerais da auditoria:

- Os arquivos `login/route.ts` e `cadastro/route.ts` precisam de **rate limiting**.
- Todos os endpoints precisam retornar **erros genéricos** (sem revelar detalhes técnicos).
- Nenhuma rota deve retornar `err.message` do backend direto pro cliente.

---

## ✅ AÇÕES CORRETIVAS (LISTA MESTRA)

- [ ] Criar helper de rate limiting (limite por IP)
- [ ] Corrigir `login/route.ts` (erro genérico + validação)
- [ ] Corrigir `cadastro/route.ts` (erro genérico + validação)
- [ ] Auditar `gerar/route.ts`
- [ ] Auditar `exportar/route.ts`
- [ ] Auditar `logout/route.ts`
- [ ] Auditar `perfil/senha/route.ts`
- [ ] Auditar `stripe/webhook/route.ts`

---

**Última atualização:** Outubro 2026

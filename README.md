# 🎯 DescreveAí

> **Descrições de produto que vendem, em 3 segundos.**

SaaS que gera descrições de produto otimizadas para SEO e conversão usando Inteligência Artificial (Google Gemini).

![Landing page do DescreveAí](docs/screenshot-landing.png)

---

## ✨ Funcionalidades

- **Geração de descrição com IA** — Cole nome + características do produto, escolha o tom, e a IA gera uma descrição otimizada
- **Autenticação completa** — Login e cadastro com e-mail/senha via Supabase Auth
- **Dashboard do usuário** — Painel com perfil, plano e contador de gerações
- **Sistema de planos** — Free (5 gerações/mês) e Pro (200 gerações/mês)
- **Histórico de gerações** — Todas as descrições ficam salvas no banco
- **Fallback de modelos IA** — Tenta 3 modelos do Gemini em sequência

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Framework** | Next.js 16 (App Router + TypeScript) |
| **Estilização** | Tailwind CSS |
| **IA** | Google Gemini 2.5 Flash |
| **Banco de dados** | Supabase (PostgreSQL) |
| **Autenticação** | Supabase Auth |
| **Deploy** | Vercel |
| **Versionamento** | Git + GitHub |

---

## 🚀 Como rodar localmente

### Pré-requisitos
- Node.js 20+
- Conta no [Supabase](https://supabase.com)
- API Key do [Google AI Studio](https://aistudio.google.com)

### Passo a passo

```bash
# 1. Clonar o repositório
git clone https://github.com/macielmn13-byte/descreveai.git
cd descreveai

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas chaves

# 4. Rodar o servidor de desenvolvimento
npm run dev
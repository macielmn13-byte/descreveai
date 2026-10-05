# 📚 Comandos — DescreveAí (Cola Pessoal)

> Guia rápido de todos os comandos usados no projeto.
> Salvo no VS Code pra consulta rápida.

---

## 🖥️ POWERSHELL BÁSICO

### Navegação
```powershell
pwd                          # Mostra onde você está
cd C:\Users\macie\Downloads\descreveai   # Entra na pasta
cd ..                        # Sobe uma pasta
dir                          # Lista arquivos
dir /a                       # Lista incluindo ocultos
dir *.txt                    # Lista só arquivos .txt
cls                          # Limpa tela
```

### Ver conteúdo de arquivo
```powershell
type arquivo.txt             # Mostra conteúdo
Get-Content arquivo.txt      # Mostra conteúdo (PowerShell)
Get-Content arquivo.txt -TotalCount 10   # Primeiras 10 linhas
```

### Criar pastas e arquivos
```powershell
New-Item -ItemType Directory -Path pasta          # Cria pasta
New-Item -ItemType File -Path arquivo.txt         # Cria arquivo
New-Item -ItemType Directory -Force -Path app\api\stripe\webhook   # Cria estrutura completa
```

### Deletar
```powershell
Remove-Item arquivo.txt                       # Deleta arquivo
Remove-Item pasta -Recurse -Force             # Deleta pasta + conteúdo
Remove-Item arquivo.txt -ErrorAction SilentlyContinue  # Ignora se não existir
```

### Renomear e mover
```powershell
Rename-Item arquivo.txt novo.txt              # Renomeia
Move-Item pasta_origem pasta_destino          # Move
```

### Abrir no VS Code
```powershell
code .                        # Abre VS Code na pasta atual
code arquivo.txt              # Abre arquivo específico
code app\dashboard\page.tsx   # Abre arquivo específico
```

---

## 📦 NPM (Node Package Manager)

### Instalação
```powershell
npm install                          # Instala tudo do package.json
npm install pacote                   # Instala um pacote
npm install pacote@3.4.19            # Instala versão específica
npm install -D pacote                # Instala como devDependency
npm install pacote --legacy-peer-deps   # Ignora conflitos de peer deps
npm approve-scripts pacote           # Aprova scripts bloqueados
```

### Rodar o projeto
```powershell
npm run dev                          # Sobe servidor de desenvolvimento
npm run build                        # Cria build de produção
npm run start                        # Roda build de produção
npm run lint                         # Roda ESLint
```

### Ver pacotes instalados
```powershell
npm list                             # Lista tudo
npm list tailwindcss                 # Versão de pacote específico
npm outdated                         # Mostra pacotes desatualizados
```

### Desinstalar
```powershell
npm uninstall pacote                 # Remove pacote
npm uninstall pacote --legacy-peer-deps   # Ignora conflitos
```

### Resolver problemas comuns
```powershell
npm cache clean --force              # Limpa cache do npm
Remove-Item -Recurse -Force node_modules   # Deleta node_modules
npm install                          # Reinstala tudo
```

---

## 🔧 NEXT.JS

### Reiniciar servidor limpo
```powershell
Ctrl + C                             # Para o servidor
Remove-Item -Recurse -Force .next    # Apaga cache
npm run dev                          # Sobe de novo
```

### Matar processos Node travados
```powershell
taskkill /F /IM node.exe             # Mata TODOS os processos Node
taskkill /PID 12345 /F               # Mata processo específico
```

### Verificar TypeScript
```powershell
npx tsc --noEmit                     # Verifica erros sem gerar arquivo
```

---

## 🌿 GIT (Controle de versão)

### Configuração inicial (uma vez só)
```powershell
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
```

### Iniciar repositório
```powershell
git init                             # Inicia Git na pasta
git branch -M main                   # Renomeia branch pra main
git remote add origin https://github.com/usuario/repo.git   # Conecta ao GitHub
```

### Fluxo do dia a dia
```powershell
git status                           # Ver o que mudou
git add .                            # Adiciona tudo
git add arquivo.txt                  # Adiciona específico
git commit -m "Mensagem do commit"   # Cria commit
git push                             # Envia pro GitHub
git push -u origin main              # Primeira vez (com upstream)
```

### Ver histórico
```powershell
git log                              # Histórico completo
git log --oneline -5                 # Últimos 5 commits (resumido)
git log --oneline --all              # Todos os commits
```

### Desfazer / corrigir
```powershell
git checkout HEAD -- arquivo.txt     # Restaura arquivo do último commit
git restore arquivo.txt              # Desfaz mudanças (Git novo)
git rm --cached arquivo.txt          # Remove do Git (mas mantém no disco)
git reset HEAD arquivo.txt           # Desmarca antes do commit
```

### Pull (baixar do GitHub)
```powershell
git pull                             # Baixa + merge automático
git pull origin main --no-rebase     # Baixa sem rebase
```

### Emergências
```powershell
git push --force origin main         # Força push (cuidado!)
git rm --cached -r .git              # Remove do Git
Remove-Item -Recurse -Force .git     # Deleta histórico Git (recomeço)
```

### Ignorar arquivos (.gitignore)
```
node_modules
.next
.env*
.env.local
.vercel
*.tsbuildinfo
next-env.d.ts
projetoContagestao.txt
senha*.txt
audit.txt
fix.js
```

---

## 🚀 VERCEL (Deploy)

### Via terminal (opcional)
```powershell
npm i -g vercel                      # Instala CLI
vercel                               # Deploy
vercel --prod                        # Deploy em produção
```

### Fluxo normal (web)
1. Cada `git push` → deploy automático
2. Ver em: https://vercel.com/dashboard

### Forçar novo deploy
```powershell
git commit --allow-empty -m "Trigger deploy"
git push
```

### Problemas comuns
- **Build falha:** ver logs em Deployments → Build Logs
- **Variáveis não aplicadas:** ver Settings → Environment Variables
- **Código antigo:** Redeploy (Deployments → ... → Redeploy)

---

## 🗄️ NEON (Banco de dados)

### URL do painel
```
https://console.neon.tech
```

### SQL úteis (no SQL Editor)

**Listar usuários:**
```sql
SELECT id, email FROM usuarios;
```

**Ver perfis:**
```sql
SELECT * FROM perfis;
```

**Marcar usuário como PRO:**
```sql
UPDATE perfis
SET plano = 'pro', limite_geracoes = 200
WHERE user_id = (SELECT id FROM usuarios WHERE email = 'email@exemplo.com');
```

**Ver últimas gerações:**
```sql
SELECT id, produto, criado_em FROM geracoes ORDER BY criado_em DESC LIMIT 10;
```

---

## 💳 STRIPE (Pagamentos)

### Painel
```
https://dashboard.stripe.com/test/apikeys        # Chaves
https://dashboard.stripe.com/test/webhooks       # Webhooks
https://dashboard.stripe.com/test/payments       # Pagamentos
https://dashboard.stripe.com/test/settings/branding   # Branding
```

### Testar pagamento
- **Cartão de teste:** `4242 4242 4242 4242`
- **Validade:** `12 / 34` (qualquer data futura)
- **CVC:** `123` (qualquer 3 dígitos)

### Chaves (formato)
- **Publishable:** `pk_test_...` (pública)
- **Secret:** `sk_test_...` (privada)
- **Webhook:** `whsec_...` (assinatura)

---

## 🧪 DEBUG (Resolver problemas)

### Verificar variáveis de ambiente
```powershell
Get-Content .env.local               # Vê o arquivo
Get-Content .env.local | Select-String "NOME"   # Busca variável específica
```

### Testar se URL responde
```powershell
nslookup dominio.com 8.8.8.8         # Verifica DNS
curl https://api.exemplo.com         # Faz requisição
```

### Limpar cache DNS (Windows)
```powershell
ipconfig /flushdns
```

### Ver logs do servidor
- Ficam no terminal onde `npm run dev` está rodando
- Logs do deploy: Vercel → Deployments → Logs

---

## 📝 VS CODE — ATALHOS

| Atalho | Função |
|--------|--------|
| `Ctrl + ` ` | Abre/fecha terminal |
| `Ctrl + P` | Busca arquivo por nome |
| `Ctrl + Shift + P` | Paleta de comandos |
| `Ctrl + B` | Mostra/esconde sidebar |
| `Ctrl + S` | Salva arquivo |
| `Ctrl + Z` | Desfaz |
| `Ctrl + Shift + F` | Busca em todos os arquivos |
| `Ctrl + /` | Comenta linha |
| `Ctrl + D` | Seleciona próxima ocorrência |
| `Alt + ↑/↓` | Move linha |
| `F2` | Renomeia símbolo |

---

## 🎯 FLUXO DO DIA A DIA

### 1. Começar a trabalhar
```powershell
cd C:\Users\macie\Downloads\descreveai
code .
npm run dev
```

### 2. Testar
```
http://localhost:3000
```

### 3. Fazer mudanças
- Edita arquivo no VS Code
- Salva (`Ctrl + S`)
- Testa no navegador (`Ctrl + Shift + R`)

### 4. Commit + Push
```powershell
git add .
git commit -m "Descrição do que mudou"
git push
```

### 5. Vercel faz deploy automático
- Aguarda ~2 min
- Testa em produção

### 6. Fechar o dia
```powershell
Ctrl + C                             # Para o servidor
# Pode fechar VS Code tranquilo
```

---

## 🚨 RESOLVER PROBLEMAS COMUNS

### "Module not found"
```powershell
npm install                          # Instala dependências
```

### "Porta 3000 em uso"
```powershell
taskkill /F /IM node.exe
npm run dev
```

### "Next.js bugou / cache"
```powershell
Ctrl + C
Remove-Item -Recurse -Force .next
npm run dev
```

### "Build da Vercel falha"
1. Ver logs em Vercel → Deployments
2. Rodar `npx tsc --noEmit` local
3. Corrigir e fazer `git push` de novo

### "Git push rejeitado"
```powershell
git pull origin main --no-rebase
# Resolver conflitos se houver
git push
```

---

## 📞 LINKS IMPORTANTES

- **App em produção:** https://descreveai.vercel.app
- **GitHub:** https://github.com/macielmn13-byte/descreveai
- **Vercel:** https://vercel.com/dashboard
- **Neon:** https://console.neon.tech
- **Stripe:** https://dashboard.stripe.com
- **Google AI Studio:** https://aistudio.google.com/apikey

---

## ✅ RESUMO EXECUTIVO

**Todo dia quando voltar:**

1. `cd C:\Users\macie\Downloads\descreveai`
2. `code .`
3. `npm run dev`
4. Trabalha...
5. `git add . && git commit -m "..." && git push`

**Quando algo der errado:**

1. `Ctrl + C`
2. `Remove-Item -Recurse -Force .next`
3. `npm run dev`

**Quando a Vercel não atualizar:**

1. Verifica se `git push` funcionou
2. Vai em Vercel → Deployments
3. Espera ~2 min

---

**Salvo em:** `C:\Users\macie\Downloads\descreveai\COMANDOS.md`
**Atualizado em:** Outubro 2026
**Por:** Maciel + IA (Capitã) 🦅
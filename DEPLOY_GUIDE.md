# 🚀 Guia de Deploy - Vercel (Admin, Site e Backend)

Este guia explica como fazer deploy completo do projeto na **Vercel** - **100% gratuito, sem cartão de crédito e muito rápido**!

## 📋 Índice
1. [Por que Vercel?](#por-que-vercel)
2. [Pré-requisitos](#pré-requisitos)
3. [Deploy do Backend no Vercel](#deploy-do-backend-no-vercel)
4. [Deploy do Admin no Vercel](#deploy-do-admin-no-vercel)
5. [Deploy do Site no Vercel](#deploy-do-site-no-vercel)
6. [Configuração Final](#configuração-final)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Por que Vercel?

### ✅ Vantagens
- **100% Gratuito** - Sem limites de tempo, sem expiração
- **Sem Cartão de Crédito** - Não precisa cadastrar cartão
- **Muito Rápido** - Deploys instantâneos, sem delay do Render
- **CDN Global** - Conteúdo entregue rapidamente em todo o mundo
- **Serverless Functions** - Backend escalável e rápido
- **Auto-deploy** - Deploy automático a cada push no GitHub

### 🆚 Comparação com Render
| Recurso | Render | Vercel |
|---------|--------|--------|
| Gratuito | ✅ | ✅ |
| Sem cartão | ✅ | ✅ |
| Velocidade | ❌ Lento (1+ min delay) | ✅ Instantâneo |
| CDN | ❌ Limitado | ✅ Global |
| Serverless | ❌ Não | ✅ Sim |
| Deploy | ⚠️ Lento | ✅ Rápido |

---

## ✅ Pré-requisitos

1. **Conta no Vercel**:
   - Acesse [vercel.com](https://vercel.com)
   - Faça login com GitHub (gratuito, sem cartão)

2. **Repositório GitHub**:
   - Certifique-se de que o código está no GitHub (branch `master` ou `main`)

3. **Backup**:
   - ⚠️ **IMPORTANTE**: Faça backup das variáveis de ambiente do Render antes de deletar os serviços

---

## 🔧 Deploy do Backend no Vercel

### Passo 1: Criar novo projeto no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **"Add New..."** > **"Project"**
3. Escolha o repositório `nova-versao-liga-do-bem`

### Passo 2: Configurar o Backend

Na tela de configuração:

⚠️ **IMPORTANTE**: Configure assim:

- **Framework Preset**: Other (ou None)
- **Root Directory**: `backend` (⚠️ IMPORTANTE: clique em "Edit" ao lado do root directory)
- **Build Command**: (DELETE TUDO - deixe COMPLETAMENTE VAZIO)
- **Output Directory**: (DELETE TUDO - deixe COMPLETAMENTE VAZIO)
- **Install Command**: (DELETE TUDO - deixe COMPLETAMENTE VAZIO)

⚠️ **CRÍTICO - DEIXE TODOS OS CAMPOS VAZIOS NO DASHBOARD**: 
1. **Install Command**: DELETE tudo - deixe completamente VAZIO
2. **Build Command**: DELETE tudo - deixe completamente VAZIO  
3. **Output Directory**: DELETE tudo - deixe completamente VAZIO
4. O Vercel faz `npm install` automaticamente
5. O Vercel executa o script `postinstall` do `package.json` automaticamente (que roda `prisma generate`)
6. O Vercel detecta a pasta `api/` e compila TypeScript automaticamente usando `@vercel/node`
7. **NÃO configure nada no dashboard** - o `vercel.json` já configura tudo!

**Como funciona:**
- O `package.json` tem `"postinstall": "prisma generate"` 
- Quando o Vercel faz `npm install`, ele executa `postinstall` automaticamente
- O Prisma Client é gerado automaticamente
- O `vercel.json` define que `api/index.ts` usa `@vercel/node` runtime
- O Vercel compila TypeScript automaticamente para serverless functions
- O `vercel.json` define as rotas para redirecionar tudo para `/api/index.ts`
- **Não precisa configurar Build Command, Install Command ou Output Directory no dashboard!**

**IMPORTANTE**: 
- Para serverless functions, o Vercel NÃO precisa de Output Directory
- O Vercel compila TypeScript automaticamente usando `@vercel/node`
- O `vercel.json` já configura tudo, não precisa configurar no dashboard
- Se o Vercel ainda tentar executar `npm run build`, ignore - o `vercel.json` sobrescreve isso

Se você já adicionou algo no dashboard, VÁ NAS CONFIGURAÇÕES E DELETE TUDO DOS CAMPOS!

### Passo 3: Configurar variáveis de ambiente

Em **Environment Variables**, adicione todas as variáveis:

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres.ushdgkfnxrxwqrnicdns:Onigui1973!@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.ushdgkfnxrxwqrnicdns:Onigui1973!@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
JWT_SECRET=liga-do-bem-jwt-secret-key-2024-production
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://nova-versao-liga-do-bem-web.vercel.app
MOBILE_URL=exp://localhost:19000
ADMIN_URL=https://nova-versao-liga-do-bem-admin.vercel.app
WEB_URL=https://nova-versao-liga-do-bem-web.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

⚠️ **Nota**: Você vai atualizar `ADMIN_URL` e `WEB_URL` depois que fizer o deploy do admin e site.

### Passo 4: Deploy

1. Clique em **"Deploy"**
2. Aguarde alguns segundos (muito mais rápido que Render!)
3. Vercel vai gerar uma URL: `nova-versao-liga-do-bem-api.vercel.app`

### Passo 5: Verificar se está funcionando

1. Acesse: `https://nova-versao-liga-do-bem-api.vercel.app/api/test`
2. Deve retornar: `{"message":"Server is working!","timestamp":"...","platform":"Vercel Serverless",...}`

⚠️ **ANOTE ESTA URL** - você precisará dela nos próximos passos!

---

## 🌐 Deploy do Admin no Vercel

### Passo 1: Criar novo projeto no Vercel

1. No Vercel, clique em **"Add New..."** > **"Project"**
2. Escolha o mesmo repositório `nova-versao-liga-do-bem`

### Passo 2: Configurar o Admin

- **Framework Preset**: Other
- **Root Directory**: `admin` (⚠️ IMPORTANTE!)
- **Build Command**: (deixe vazio - é HTML estático)
- **Output Directory**: `.`

### Passo 3: Adicionar variável de ambiente

Em **Environment Variables**, adicione:

```
API_BASE_URL=https://nova-versao-liga-do-bem-api.vercel.app
```

⚠️ **Substitua** pela URL real do backend que você anotou!

### Passo 4: Deploy

1. Clique em **"Deploy"**
2. Aguarde alguns segundos
3. URL gerada: `nova-versao-liga-do-bem-admin.vercel.app`

---

## 🌍 Deploy do Site no Vercel

### Passo 1: Criar novo projeto (mesmo processo)

1. No Vercel, clique em **"Add New..."** > **"Project"**
2. Escolha o mesmo repositório `nova-versao-liga-do-bem`

### Passo 2: Configurar o Site

- **Framework Preset**: Other
- **Root Directory**: `web` (⚠️ IMPORTANTE!)
- **Build Command**: (deixe vazio)
- **Output Directory**: `.`

### Passo 3: Adicionar variável de ambiente

```
API_BASE_URL=https://nova-versao-liga-do-bem-api.vercel.app
```

### Passo 4: Deploy

1. Clique em **"Deploy"**
2. URL gerada: `nova-versao-liga-do-bem-web.vercel.app`

---

## ⚙️ Configuração Final

### 1. Atualizar URLs no Backend

Agora que você tem os URLs do admin e site, atualize as variáveis no backend:

1. Vá no projeto do backend no Vercel
2. Vá em **Settings** > **Environment Variables**
3. Atualize:
   - `ADMIN_URL=https://nova-versao-liga-do-bem-admin.vercel.app`
   - `WEB_URL=https://nova-versao-liga-do-bem-web.vercel.app`
   - `FRONTEND_URL=https://nova-versao-liga-do-bem-web.vercel.app`

4. Faça um **Redeploy** (Settings > Redeploy)

### 2. Atualizar URLs nos arquivos (opcional)

Os arquivos já foram atualizados com fallback para Vercel, mas você pode atualizar manualmente se quiser:

1. **Admin**: `admin/index.html` linha 1866
2. **Web**: `web/index.html` linha 1414
3. **Mobile**: `mobile/src/config/apiConfig.js` linha 17

### 3. Testar tudo

1. **Admin**: `https://nova-versao-liga-do-bem-admin.vercel.app/login.html`
   - Login: `admin@ligadobem.com` / Senha: `admin123`

2. **Site**: `https://nova-versao-liga-do-bem-web.vercel.app`

3. **API**: `https://nova-versao-liga-do-bem-api.vercel.app/api/test`

### 4. Configurar auto-deploy

Vercel já faz auto-deploy do branch `master`/`main` por padrão quando você faz push no GitHub.

---

## 🐛 Troubleshooting

### Erro: "No Output Directory named `.` found" ou "missing-public-directory"

**Causa**: O Vercel está tentando executar `npm run build` automaticamente e procurando um Output Directory. Para serverless functions, isso NÃO é necessário.

**Solução**:
1. Vá no projeto no Vercel Dashboard
2. Vá em **Settings** > **General**
3. Procure pelo campo **"Output Directory"**:
   - **DELETE tudo** que estiver lá (incluindo "." ou qualquer texto)
   - Deixe o campo **completamente VAZIO**
4. Procure pelo campo **"Build Command"**:
   - **DELETE tudo** que estiver lá (incluindo "npm run build" ou qualquer texto)
   - Deixe o campo **completamente VAZIO**
5. Procure pelo campo **"Install Command"**:
   - **DELETE tudo** que estiver lá
   - Deixe o campo **completamente VAZIO**
6. Clique em **Save**
7. Faça um novo deploy

⚠️ **IMPORTANTE**: 
- Para serverless functions, o Vercel NÃO precisa de Output Directory!
- O `vercel.json` usa a configuração `builds` e `routes` (formato antigo mas mais confiável)
- O script `vercel-build` foi REMOVIDO do `package.json` (não é necessário)
- O script `build` no `package.json` foi modificado para não fazer nada (apenas imprime mensagem)
- O Vercel compila TypeScript automaticamente usando `@vercel/node` quando detecta a pasta `api/`
- **Deixe todos os campos vazios no dashboard do Vercel!**

**Por que funciona agora:**
- O `vercel.json` usa `builds` e `routes` (formato mais direto para serverless functions)
- Não há script `vercel-build` no `package.json`, então o Vercel não tenta executá-lo
- O Vercel compila TypeScript automaticamente na pasta `api/` usando `@vercel/node`
- Para builds locais, use `npm run build:local` (que executa `tsc`)

**Se o erro persistir:**
1. **VERIFIQUE NO DASHBOARD DO VERCEL:**
   - Vá em **Settings** > **General**
   - DELETE tudo dos campos **Install Command**, **Build Command** e **Output Directory**
   - Deixe todos os campos **completamente VAZIOS**
   - Clique em **Save**
2. Certifique-se de que o `package.json` está commitado no GitHub (SEM o script `vercel-build`)
3. Certifique-se de que o `vercel.json` está commitado no GitHub (com `builds` e `routes`)
4. Faça um **push** das alterações para o GitHub
5. O Vercel vai fazer deploy automaticamente

### Erro: "up: command not found" ou "added: command not found" ou "Command exited with 127"

**Causa**: Problema no Build Command ou Install Command do Vercel.

**Solução**:
1. Vá no projeto no Vercel
2. Vá em **Settings** > **General**
3. DELETE tudo dos campos **Install Command**, **Build Command** e **Output Directory**
4. Deixe todos os campos **completamente VAZIOS**
5. Clique em **Save**
6. Faça um novo deploy

⚠️ **O Vercel faz `npm install` automaticamente** e executa `postinstall` automaticamente! Não precisa configurar nada no dashboard!

**Alternativa**: Se ainda não funcionar, remova o Build Command também e deixe o Vercel usar apenas o `vercel.json`.

### Backend não está funcionando

1. Verifique os logs no Vercel:
   - Vá em **Deployments** > **View Logs**

2. Verifique se todas as variáveis estão configuradas:
   - Vá em **Settings** > **Environment Variables**

3. Teste a conexão com Supabase:
   - `DATABASE_URL` e `DIRECT_URL` estão corretos?

### CORS errors

1. Verifique se `ADMIN_URL` e `WEB_URL` estão configurados no backend
2. Verifique se as URLs no backend batem com as URLs do admin/site
3. Faça um redeploy após mudar variáveis

### Admin/Site não carregam

1. Verifique se o **Root Directory** está correto no Vercel (`admin` ou `web`)
2. Verifique os logs no Vercel: **Deployments** > **View Logs**
3. Certifique-se de que os arquivos HTML estão no diretório correto

### API retorna 404

1. Verifique se o backend está deployado
2. Teste: `https://sua-url-api.vercel.app/api/test`
3. Verifique se as rotas estão configuradas corretamente em `backend/api/index.ts`

### Erro de build no Vercel

1. Verifique os logs de build
2. Certifique-se de que `prisma generate` está sendo executado no build
3. Verifique se todas as dependências estão no `package.json`

---

## 💰 Limites do Tier Gratuito Vercel

### Vercel Free Tier
- ✅ **Deploys ilimitados**
- ✅ **100GB bandwidth/mês**
- ✅ **100GB storage**
- ✅ **CDN global**
- ✅ **Serverless Functions**: 100GB-hours/mês
- ✅ **Sem limite de tempo**
- ✅ **Sem necessidade de cartão**

### Comparação de Performance

| Métrica | Render | Vercel |
|---------|--------|--------|
| Tempo de deploy | 5-10 min | 10-30 seg |
| Cold start | 30-60 seg | 100-500 ms |
| Latência | Alta | Baixa |
| CDN | Limitado | Global |

---

## 📝 Checklist Final

- [ ] Backend deployado no Vercel e funcionando
- [ ] Admin deployado no Vercel e funcionando
- [ ] Site deployado no Vercel e funcionando
- [ ] CORS configurado corretamente
- [ ] URLs atualizados em todos os arquivos
- [ ] Testes realizados em todos os ambientes
- [ ] Variáveis de ambiente configuradas corretamente
- [ ] Auto-deploy configurado (já vem por padrão)

---

## 🎉 Próximos Passos

1. **Domínios customizados** (opcional):
   - Configure domínios próprios no Vercel
   - Exemplo: `admin.ligadobem.com`, `api.ligadobem.com`

2. **Monitoramento**:
   - Vercel Analytics (gratuito)
   - Vercel Speed Insights (gratuito)

3. **Cleanup**:
   - Após confirmar que tudo funciona, pode deletar os serviços antigos no Render
   - ⚠️ **Mas faça backup das variáveis de ambiente antes!**

---

## 🚀 Comandos Úteis

```bash
# Instalar Vercel CLI (opcional)
npm i -g vercel

# Fazer deploy manual (opcional)
cd backend
vercel

# Ver logs (opcional)
vercel logs
```

---

**🎉 Parabéns! Sua plataforma está rodando 100% gratuito, rápido e sem cartão de crédito!**

**URLs Finais:**
- 🌐 Admin: `https://nova-versao-liga-do-bem-admin.vercel.app`
- 🌍 Site: `https://nova-versao-liga-do-bem-web.vercel.app`
- ⚙️ API: `https://nova-versao-liga-do-bem-api.vercel.app`

---

**Boa sorte com a migração! 🚀**

Tudo 100% gratuito, rápido e sem cartão! 🎉

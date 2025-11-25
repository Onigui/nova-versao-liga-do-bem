# 🔧 Configurar Backend no Vercel

## ⚠️ Problema Identificado

O backend não está fazendo deploy porque precisa estar configurado como um **projeto separado** no Vercel, ou o projeto principal precisa estar configurado corretamente.

## ✅ Solução: Criar Projeto Separado para Backend

### Passo 1: Verificar se já existe projeto backend no Vercel

1. Acesse: https://vercel.com/dashboard
2. Procure por um projeto chamado: **nova-versao-liga-do-bem** (backend)
3. Se **NÃO existir**, continue com o Passo 2

### Passo 2: Criar Novo Projeto no Vercel para Backend

1. **Acesse o Vercel Dashboard**
   - Vá para: https://vercel.com/dashboard
   - Clique em **"Add New..."** → **"Project"**

2. **Conectar Repositório**
   - Selecione: **Onigui/nova-versao-liga-do-bem**
   - Clique em **"Import"**

3. **Configurar o Projeto Backend**
   - **Project Name**: `nova-versao-liga-do-bem` (ou `nova-versao-liga-do-bem-backend`)
   - **Framework Preset**: Deixe como **"Other"** ou **"No Framework"**
   - **Root Directory**: `backend` ⚠️ **IMPORTANTE: Configure como `backend`**
   - **Build Command**: Deixe **VAZIO** (o Vercel compila TypeScript automaticamente)
   - **Output Directory**: Deixe **VAZIO**
   - **Install Command**: `npm install` (ou deixe padrão)

4. **Configurar Variáveis de Ambiente**
   - Clique em **"Environment Variables"**
   - Adicione estas variáveis:
     ```
     DATABASE_URL=postgresql://postgres.ushdgkfnxrxwqrnicdns:SUA_SENHA@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
     DIRECT_URL=postgresql://postgres.ushdgkfnxrxwqrnicdns:SUA_SENHA@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
     JWT_SECRET=liga-do-bem-jwt-secret-key-2024-production
     NODE_ENV=production
     ```
   - ⚠️ **IMPORTANTE**: Substitua `SUA_SENHA` pela senha real do Supabase
   - Marque todas como disponíveis para: **Production**, **Preview** e **Development**

5. **Deploy**
   - Clique em **"Deploy"**
   - Aguarde o deploy completar

### Passo 3: Verificar Deploy

1. Após o deploy, você verá uma URL como:
   ```
   https://nova-versao-liga-do-bem.vercel.app
   ```

2. **Teste o endpoint ping:**
   ```
   https://nova-versao-liga-do-bem.vercel.app/api/ping
   ```
   Deve retornar: `{"status":"ok","message":"Backend is alive!",...}`

3. **Verifique os logs:**
   - Vá em **Deployments** → deployment mais recente
   - Clique em **Functions** → `api/index.ts`
   - Procure por logs: `🚀 [INIT] Carregando módulos...`

## 🔍 Verificar Configuração Atual

Se o projeto já existe, verifique:

1. **Root Directory está como `backend`?**
   - Settings → General → Root Directory deve ser: `backend`

2. **Build Command está vazio?**
   - Settings → General → Build Command deve estar **VAZIO**

3. **Output Directory está vazio?**
   - Settings → General → Output Directory deve estar **VAZIO**

4. **Variáveis de ambiente configuradas?**
   - Settings → Environment Variables
   - Verifique se `DATABASE_URL`, `JWT_SECRET`, etc. estão configuradas

## 📋 Checklist

- [ ] Projeto backend criado no Vercel
- [ ] Root Directory configurado como `backend`
- [ ] Build Command vazio
- [ ] Output Directory vazio
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy realizado com sucesso
- [ ] `/api/ping` responde corretamente
- [ ] Logs mostram inicialização do servidor

## 🚨 Problemas Comuns

### Problema: "No Output Directory found"
**Solução**: Deixe Output Directory **VAZIO** no Vercel

### Problema: "Build failed"
**Solução**: 
- Verifique se `Root Directory` está como `backend`
- Verifique se `package.json` existe em `backend/`
- Verifique logs do build

### Problema: "Function timeout"
**Solução**: 
- Verifique se `DATABASE_URL` está configurada
- Verifique logs para ver onde está travando

---

**Última atualização**: Após identificar que backend precisa de projeto separado


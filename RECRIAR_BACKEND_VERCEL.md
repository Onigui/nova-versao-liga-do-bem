# 🔄 Recriar Backend no Vercel - Passo a Passo Completo

## ⚠️ IMPORTANTE: Antes de Começar

**Anote TODAS as variáveis de ambiente do projeto atual antes de deletar!**

1. Acesse: https://vercel.com/dashboard
2. Abra o projeto: **nova-versao-liga-do-bem**
3. Vá em **Settings** → **Environment Variables**
4. **ANOTE TODAS** as variáveis (ou tire print):
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `JWT_SECRET`
   - `NODE_ENV`
   - `CLOUDINARY_CLOUD_NAME` (se existir)
   - `CLOUDINARY_API_KEY` (se existir)
   - `CLOUDINARY_API_SECRET` (se existir)
   - Qualquer outra variável que aparecer

## 🗑️ Passo 1: Deletar o Projeto Atual

1. **Acesse o Dashboard do Vercel**
   - https://vercel.com/dashboard
   - Encontre o projeto: **nova-versao-liga-do-bem**

2. **Deletar o Projeto**
   - Clique no projeto
   - Vá em **Settings** → role até o final
   - Procure por **"Danger Zone"**
   - Clique em **"Delete Project"**
   - Digite o nome do projeto para confirmar: `nova-versao-liga-do-bem`
   - Clique em **"Delete"**

## ✅ Passo 2: Criar Novo Projeto

1. **Criar Novo Projeto**
   - No Dashboard, clique em **"Add New..."** → **"Project"**
   - Ou clique no botão **"Add New..."** no canto superior direito

2. **Conectar Repositório**
   - Selecione: **Onigui/nova-versao-liga-do-bem**
   - Clique em **"Import"**

3. **Configurar o Projeto**
   
   **⚠️ ATENÇÃO: Configure EXATAMENTE assim:**
   
   - **Project Name**: `nova-versao-liga-do-bem`
   - **Framework Preset**: **Other** (ou deixe como detectado)
   - **Root Directory**: **`backend`** ⚠️ **CRÍTICO - DEVE SER `backend`**
   - **Build Command**: **DEIXE VAZIO** (o Vercel usa o `vercel-build` do package.json)
   - **Output Directory**: **DEIXE VAZIO**
   - **Install Command**: Deixe como padrão (`npm install`)

4. **NÃO clique em Deploy ainda!** Primeiro vamos configurar as variáveis.

## 🔐 Passo 3: Configurar Variáveis de Ambiente

1. **Antes de fazer Deploy, clique em "Environment Variables"**

2. **Adicione TODAS as variáveis que você anotou:**
   
   Clique em **"Add New"** para cada uma:
   
   ```
   DATABASE_URL
   Valor: [cole o valor que você anotou]
   Environments: ✅ Production ✅ Preview ✅ Development
   
   DIRECT_URL
   Valor: [cole o valor que você anotou]
   Environments: ✅ Production ✅ Preview ✅ Development
   
   JWT_SECRET
   Valor: [cole o valor que você anotou]
   Environments: ✅ Production ✅ Preview ✅ Development
   
   NODE_ENV
   Valor: production
   Environments: ✅ Production ✅ Preview ✅ Development
   ```
   
   **IMPORTANTE**: Marque TODAS as opções (Production, Preview, Development) para cada variável!

3. **Se você tinha variáveis do Cloudinary, adicione também:**
   ```
   CLOUDINARY_CLOUD_NAME
   CLOUDINARY_API_KEY
   CLOUDINARY_API_SECRET
   ```

## 🚀 Passo 4: Fazer Deploy

1. **Após adicionar TODAS as variáveis, clique em "Deploy"**

2. **Aguarde o deploy completar** (pode levar 2-5 minutos)

3. **Verifique os logs:**
   - Clique no deployment
   - Vá em **"Build Logs"**
   - Verifique se não há erros
   - Deve aparecer algo como:
     ```
     Installing dependencies...
     Running "vercel-build" script...
     Generating Prisma Client...
     ```

## ✅ Passo 5: Verificar se Está Funcionando

1. **Testar endpoint ping:**
   ```
   https://nova-versao-liga-do-bem.vercel.app/api/ping
   ```
   Deve retornar: `{"status":"ok","timestamp":"...","hasDb":true}`

2. **Testar endpoint de atualização:**
   ```
   https://nova-versao-liga-do-bem.vercel.app/api/app/update/check?version=1.2.3&versionCode=5
   ```
   Deve retornar informações sobre atualizações

3. **Verificar logs:**
   - Vá em **Deployments** → deployment mais recente
   - Clique em **Functions** → `api/index.ts`
   - Deve aparecer logs de inicialização

## 🔍 Passo 6: Verificar Configurações Finais

Após o deploy, verifique se está tudo correto:

1. **Settings → General**
   - ✅ Root Directory: `backend`
   - ✅ Framework Preset: `Other` (ou o que foi detectado)
   - ✅ Build Command: (vazio ou usando vercel-build)
   - ✅ Output Directory: (vazio)

2. **Settings → Environment Variables**
   - ✅ Todas as variáveis estão configuradas
   - ✅ Todas marcadas para Production, Preview e Development

3. **Deployments**
   - ✅ Último deployment está com data/hora atual
   - ✅ Status: "Ready" (verde)

## 🚨 Se Algo Der Errado

### Erro: "Could not find a production build"
**Solução**: Verifique se Root Directory está como `backend`

### Erro: "Prisma Client not generated"
**Solução**: Verifique se o script `vercel-build` existe no `package.json` (deve ter `"vercel-build": "prisma generate"`)

### Erro: "Database connection failed"
**Solução**: Verifique se `DATABASE_URL` e `DIRECT_URL` estão corretas nas variáveis de ambiente

### Erro: "Function timeout"
**Solução**: Verifique se `maxDuration: 60` está no `vercel.json` (já está configurado)

## 📋 Checklist Final

- [ ] Variáveis de ambiente anotadas antes de deletar
- [ ] Projeto antigo deletado
- [ ] Novo projeto criado
- [ ] Root Directory configurado como `backend`
- [ ] Build Command está vazio
- [ ] Output Directory está vazio
- [ ] TODAS as variáveis de ambiente adicionadas
- [ ] Todas as variáveis marcadas para Production, Preview e Development
- [ ] Deploy realizado com sucesso
- [ ] Endpoint `/api/ping` responde corretamente
- [ ] Endpoint `/api/app/update/check` funciona
- [ ] Logs não mostram erros

---

**Após seguir todos os passos, o backend deve estar funcionando perfeitamente e sincronizado com o GitHub!**


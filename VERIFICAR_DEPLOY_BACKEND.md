# 🔍 Verificar e Corrigir Deploy do Backend no Vercel

## ⚠️ Problema: Backend não está atualizando automaticamente

Se o backend não está fazendo deploy junto com os outros projetos, siga estes passos:

## ✅ Passo 1: Verificar Configuração do Projeto no Vercel

1. **Acesse o Dashboard do Vercel**
   - Vá para: https://vercel.com/dashboard
   - Encontre o projeto: **nova-versao-liga-do-bem**

2. **Verificar Root Directory**
   - Clique no projeto → **Settings** → **General**
   - Procure por **"Root Directory"**
   - ⚠️ **DEVE estar configurado como: `backend`**
   - Se estiver vazio ou com outro valor, **CLIQUE EM "Edit"** e configure como `backend`
   - **Salve as alterações**

3. **Verificar Build & Development Settings**
   - Na mesma página, role até **"Build & Development Settings"**
   - **Framework Preset**: Deve estar como **"Other"** ou pode estar vazio
   - **Build Command**: Deve estar **VAZIO** (o Vercel usa o script `vercel-build` do package.json)
   - **Output Directory**: Deve estar **VAZIO**
   - **Install Command**: Deve estar como `npm install` ou vazio (usa o padrão)

## ✅ Passo 2: Verificar que o Código Está Atualizado

1. **Verificar último commit**
   - No projeto no Vercel, vá em **Deployments**
   - Veja a data/hora do último deployment
   - Compare com o último commit no GitHub

2. **Se o deployment estiver desatualizado:**
   - Clique nos **três pontos** do deployment mais recente
   - Selecione **"Redeploy"**
   - Ou selecione **"Create Deployment"**
   - Escolha a branch **`master`** e confirme

## ✅ Passo 3: Verificar Logs do Build

1. **Acessar logs do deployment**
   - Vá em **Deployments** → Clique no deployment mais recente
   - Clique na aba **"Build Logs"** ou **"Function Logs"**
   - Verifique se há erros

2. **Erros comuns:**
   - ❌ `Error: Could not find a production build` → Root Directory não está como `backend`
   - ❌ `Error: Cannot find module` → Dependências não instaladas
   - ❌ `Error: Prisma Client` → Prisma não foi gerado (verificar script `vercel-build`)

## ✅ Passo 4: Testar se Está Funcionando

1. **Testar endpoint ping:**
   ```
   https://nova-versao-liga-do-bem.vercel.app/api/ping
   ```
   Deve retornar: `{"status":"ok",...}`

2. **Testar endpoint de atualização:**
   ```
   https://nova-versao-liga-do-bem.vercel.app/api/app/update/check?version=1.2.3&versionCode=5
   ```
   Deve retornar informações sobre atualizações

## 🔧 Se Ainda Não Funcionar

### Opção 1: Recriar o Projeto no Vercel

1. **Anotar variáveis de ambiente**
   - Settings → Environment Variables
   - Anote TODAS as variáveis (DATABASE_URL, JWT_SECRET, etc.)

2. **Deletar o projeto atual**
   - Settings → Danger Zone → Delete Project
   - Confirme a deleção

3. **Criar novo projeto**
   - Dashboard → Add New → Project
   - Conecte ao repositório: `Onigui/nova-versao-liga-do-bem`
   - Configure:
     - **Project Name**: `nova-versao-liga-do-bem`
     - **Root Directory**: `backend` ⚠️ IMPORTANTE
     - **Framework Preset**: Other
     - **Build Command**: (deixe vazio)
     - **Output Directory**: (deixe vazio)
   - Adicione TODAS as variáveis de ambiente novamente
   - Clique em Deploy

### Opção 2: Verificar se há múltiplos projetos

Pode haver confusão entre projetos. Verifique se existe:
- `nova-versao-liga-do-bem` (backend)
- `nova-versao-liga-do-bem-admin` (admin)
- `nova-versao-liga-do-bem-web` (web)

Certifique-se de estar editando o projeto correto (o backend).

## 📋 Checklist Final

- [ ] Root Directory configurado como `backend`
- [ ] Build Command está vazio
- [ ] Output Directory está vazio
- [ ] Variáveis de ambiente configuradas
- [ ] Último deployment está atualizado (data/hora correta)
- [ ] Endpoint `/api/ping` responde corretamente
- [ ] Logs não mostram erros

---

**Última atualização**: Após correção do vercel.json


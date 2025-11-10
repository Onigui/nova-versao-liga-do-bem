# Correções de Sincronização - Liga do Bem

## 📋 Resumo do Problema

Foi identificado um problema de sincronização entre o site administrativo e o aplicativo dos membros. Os dados não estavam sendo sincronizados corretamente porque:

1. **URLs da API incorretas** - Os frontends estavam apontando para URLs erradas
2. **Banco de dados desatualizado** - Backend ainda usando banco Render ao invés do Supabase
3. **Configurações inconsistentes** - Múltiplos arquivos com configurações divergentes

## ✅ Correções Implementadas

### 1. Backend - Conexão com Banco de Dados

**Arquivo:** `/workspace/backend/env.production`

**ANTES:**
```env
DATABASE_URL="postgresql://liga_do_bem_user:pBtBA3L1YwpyivZe5aBtg9iNizeNWpc5@dpg-d3fjgjqli9vc73dte1r0-a/liga_do_bem_db"
```

**DEPOIS:**
```env
# Database - Supabase PostgreSQL
DATABASE_URL="postgresql://postgres.ushdgkfnxrxwqrnicdns:Onigui1973!@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.ushdgkfnxrxwqrnicdns:Onigui1973!@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
```

### 2. Schema do Prisma

**Arquivo:** `/workspace/backend/prisma/schema.prisma`

**Adicionado suporte para DIRECT_URL:**
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // ✅ NOVO
}
```

### 3. Mobile App - API Service

**Arquivo:** `/workspace/mobile/src/services/api.ts`

**ANTES:**
```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3001' 
  : 'https://nova-versao-liga-do-bem.onrender.com';  // ❌ URL ERRADA
```

**DEPOIS:**
```typescript
import Constants from 'expo-constants';  // ✅ NOVO

const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3001' 
  : Constants.expoConfig?.extra?.apiUrl || 'https://nova-versao-liga-do-bem-api.onrender.com';  // ✅ CORRETO
```

### 4. Mobile App - Auth Service

**Arquivo:** `/workspace/mobile/src/services/AuthService.js`

**ANTES:**
```javascript
const API_BASE_URL = 'https://nova-versao-liga-do-bem.onrender.com/api';  // ❌ URL ERRADA
```

**DEPOIS:**
```javascript
const API_BASE_URL = 'https://nova-versao-liga-do-bem-api.onrender.com/api';  // ✅ CORRETO
```

### 5. Mobile App - Configuração

**Arquivo:** `/workspace/mobile/app.json`

**Adicionado configuração da API:**
```json
"extra": {
  "eas": {
    "projectId": "73886b96-ebaa-4d18-b125-c8b3d53cc8ec"
  },
  "apiUrl": "https://nova-versao-liga-do-bem-api.onrender.com"  // ✅ NOVO
}
```

### 6. Admin Site - API Configuration

**Arquivos atualizados:**
- `/workspace/admin/index.html`
- `/workspace/admin/login.html`
- `/workspace/admin/check-auth.html`
- `/workspace/admin/test-token.html`

**ANTES:**
```javascript
const API_BASE_URL = 'https://nova-versao-liga-do-bem.onrender.com';  // ❌ URL ERRADA
```

**DEPOIS:**
```javascript
const API_BASE_URL = 'https://nova-versao-liga-do-bem-api.onrender.com';  // ✅ CORRETO
```

### 7. Web Site - Configuração

**Arquivo:** `/workspace/web/env.production`

**ANTES:**
```env
NEXT_PUBLIC_API_URL="https://nova-versao-liga-do-bem.onrender.com"  # ❌ URL ERRADA
```

**DEPOIS:**
```env
NEXT_PUBLIC_API_URL="https://nova-versao-liga-do-bem-api.onrender.com"  # ✅ CORRETO
```

### 8. Backend - CORS Configuration

**Arquivos:** 
- `/workspace/backend/src/server.ts`
- `/workspace/backend/src/server-backup.ts`

**Atualizado lista de origens permitidas:**
```typescript
origin: [
  'https://nova-versao-liga-do-bem-admin.onrender.com',  // Admin
  'http://localhost:3000',
  'https://nova-versao-liga-do-bem-web.onrender.com',    // ✅ Web atualizado
  'http://localhost:3001',
  'http://localhost:8081',
  'http://localhost:19006'
]
```

## 📦 Dependências Necessárias

Execute os seguintes comandos no diretório `/workspace/mobile`:

```bash
# Instalar expo-constants (para acessar configurações do app.json)
npm install expo-constants

# Instalar axios (usado no api.ts)
npm install axios

# Sincronizar dependências do Expo
npx expo install
```

## 🔄 Próximos Passos

### 1. Backend (Render)

O backend precisa ser redeployado com as novas configurações:

1. **Verificar variáveis de ambiente no Render:**
   - DATABASE_URL deve apontar para o Supabase
   - DIRECT_URL deve estar configurada
   - Confirmar que as variáveis no `render.yaml` estão corretas

2. **Executar migrations no Supabase:**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

3. **Gerar cliente Prisma:**
   ```bash
   npx prisma generate
   ```

### 2. Mobile App

1. **Instalar dependências:**
   ```bash
   cd mobile
   npm install expo-constants axios
   ```

2. **Limpar cache e rebuildar:**
   ```bash
   npx expo start -c
   ```

3. **Para gerar novo APK:**
   ```bash
   eas build --platform android --profile production
   ```

### 3. Admin Site

O admin já está configurado corretamente. Apenas fazer o redeploy no Render:

```bash
cd admin
# O Render vai automaticamente fazer o deploy das mudanças
```

### 4. Testar Sincronização

Após os deploys:

1. **Criar um parceiro no Admin:**
   - Acessar https://nova-versao-liga-do-bem-admin.onrender.com
   - Login com credenciais de admin
   - Criar novo parceiro

2. **Verificar no Mobile:**
   - Abrir o app dos membros
   - Ir para tela de Parceiros
   - Verificar se o novo parceiro aparece

3. **Criar um membro no Admin:**
   - No admin, criar novo membro
   - Tentar fazer login no app mobile com as credenciais

## 🔍 URLs Corretas do Projeto

| Serviço | URL |
|---------|-----|
| **Backend API** | https://nova-versao-liga-do-bem-api.onrender.com |
| **Admin Site** | https://nova-versao-liga-do-bem-admin.onrender.com |
| **Web Site** | https://nova-versao-liga-do-bem-web.onrender.com |
| **Banco de Dados** | Supabase PostgreSQL |

## 🔐 Credenciais Supabase

**Connection String (com PgBouncer):**
```
postgresql://postgres.ushdgkfnxrxwqrnicdns:Onigui1973!@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Direct URL (para migrations):**
```
postgresql://postgres.ushdgkfnxrxwqrnicdns:Onigui1973!@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
```

## 📝 Notas Importantes

1. **Migração do banco:** Os dados do banco antigo (Render PostgreSQL) precisam ser migrados para o Supabase se houver dados importantes.

2. **Compatibilidade:** As rotas da API estão todas funcionando corretamente, o problema era apenas nas URLs de conexão.

3. **Autenticação:** O sistema de autenticação JWT continua funcionando normalmente.

4. **Admin Token:** O token do admin é armazenado no localStorage com a chave `admin_token`.

## ⚠️ Atenção

Após fazer o deploy do backend, é CRUCIAL:

1. ✅ Verificar se o backend está acessível em https://nova-versao-liga-do-bem-api.onrender.com
2. ✅ Testar o endpoint de health: https://nova-versao-liga-do-bem-api.onrender.com/api/test
3. ✅ Verificar se as tabelas foram criadas no Supabase
4. ✅ Criar um usuário admin usando o script: `npm run create-admin`

## 🎯 Resultado Esperado

Após todas as correções:

- ✅ Admin consegue criar/editar/deletar parceiros
- ✅ Mobile app exibe os parceiros atualizados
- ✅ Admin consegue criar/editar/deletar membros
- ✅ Membros conseguem fazer login no app
- ✅ Todos os dados estão sincronizados via Supabase
- ✅ Sem erros de CORS ou conexão

---

**Data das correções:** 2025-11-10
**Responsável:** Cursor AI Assistant

# 🔗 Integração Mobile App + Backend + Admin Panel

## ✅ **INTEGRAÇÃO COMPLETA IMPLEMENTADA**

### 🎯 **Arquitetura do Sistema**

```
📱 Mobile App (React Native)
    ↓
    ↓ API Calls
    ↓
⚙️ Backend (Node.js + PostgreSQL)
    ↑
    ↑ API Calls
    ↑
🛠️ Admin Panel (HTML/JS)
```

### 🔗 **URLs e Endpoints**

#### **Backend API**
- **URL:** `https://nova-versao-liga-do-bem.onrender.com`
- **Health:** `https://nova-versao-liga-do-bem.onrender.com/health`
- **Banco de Dados:** PostgreSQL (liga_do_bem_db)

#### **Mobile App**
- **API Base:** `https://nova-versao-liga-do-bem.onrender.com/api`
- **Registro:** `/api/auth/register` → Cria usuário com role MEMBER
- **Login:** `/api/auth/login` → Autentica usuário
- **Version:** 1.1.8

#### **Admin Panel**
- **URL:** `https://nova-versao-liga-do-bem-admin.onrender.com`
- **Login:** `https://nova-versao-liga-do-bem-admin.onrender.com/login.html`
- **API Base:** `https://nova-versao-liga-do-bem.onrender.com`
- **Endpoints Admin:**
  - `/api/admin/login` → Login de administrador
  - `/api/admin/dashboard` → Estatísticas gerais
  - `/api/admin/members` → Lista todos os membros (MEMBER)
  - `/api/admin/companies` → Gestão de empresas parceiras

### 📊 **Banco de Dados Unificado**

**Todas as aplicações usam o mesmo banco PostgreSQL:**

#### **Tabela `users`**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  avatar TEXT,
  role UserRole DEFAULT 'MEMBER',
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP
);
```

#### **Enum `UserRole`**
```sql
CREATE TYPE UserRole AS ENUM (
  'ADMIN',    -- Administradores
  'MEMBER',   -- Membros do mobile app
  'VOLUNTEER', -- Voluntários
  'PARTNER'   -- Empresas parceiras
);
```

### 🔄 **Fluxo de Dados**

#### **1. Registro no Mobile App**
```
Usuário → Mobile App (RegisterScreen)
  ↓
Mobile → POST /api/auth/register
  {
    "name": "Nome do Usuário",
    "email": "usuario@email.com",
    "password": "senha123",
    "phone": "(14) 99999-9999"
  }
  ↓
Backend → Cria usuário no PostgreSQL
  {
    "id": "cuid_gerado",
    "role": "MEMBER",  ← Automaticamente MEMBER
    "isActive": true
  }
  ↓
Backend → Retorna token JWT
  ↓
Mobile → Salva token e autentica
```

#### **2. Login no Mobile App**
```
Usuário → Mobile App (LoginScreen)
  ↓
Mobile → POST /api/auth/login
  {
    "email": "usuario@email.com",
    "password": "senha123"
  }
  ↓
Backend → Valida credenciais
  ↓
Backend → Retorna token + dados do usuário
  {
    "token": "jwt_token",
    "user": {
      "id": "cuid",
      "email": "usuario@email.com",
      "name": "Nome do Usuário",
      "role": "MEMBER"
    }
  }
  ↓
Mobile → Salva token e redireciona
```

#### **3. Visualização no Admin Panel**
```
Admin → Acessa admin/index.html
  ↓
Admin → Faz login (admin@ligadobem.com)
  ↓
Admin Panel → POST /api/admin/login
  ↓
Backend → Valida admin
  ↓
Admin Panel → Navega para "Membros"
  ↓
Admin Panel → GET /api/admin/members
  {
    headers: {
      "Authorization": "Bearer admin_token"
    }
  }
  ↓
Backend → Busca todos os usuários com role='MEMBER'
  ↓
Backend → Retorna lista de membros
  [
    {
      "id": "cuid",
      "name": "Nome do Usuário",
      "email": "usuario@email.com",
      "phone": "(14) 99999-9999",
      "status": "active",
      "createdAt": "2025-10-17T..."
    },
    ...
  ]
  ↓
Admin Panel → Exibe tabela com membros
```

### ✅ **CORREÇÕES IMPLEMENTADAS**

#### **1. URL do Backend Corrigida**
**Antes:**
```javascript
// admin/index.html
const API_BASE_URL = 'https://nova-versao-liga-do-bem-api.onrender.com'; ❌
```

**Depois:**
```javascript
// admin/index.html
const API_BASE_URL = 'https://nova-versao-liga-do-bem.onrender.com'; ✅
```

#### **2. Role MEMBER Garantido**
**Antes:**
```javascript
// backend/src/routes/auth.ts
const user = await prisma.user.create({
  data: {
    email,
    name,
    phone,
    password: hashedPassword
    // role não especificado ❌
  }
});
```

**Depois:**
```javascript
// backend/src/routes/auth.ts
const user = await prisma.user.create({
  data: {
    email,
    name,
    phone,
    password: hashedPassword,
    role: 'MEMBER' // ✅ Garantido
  }
});
```

#### **3. Criação Automática do Enum e Tabela**
```javascript
// backend/src/server.ts
async function ensureDatabaseReady() {
  // 1. Criar enum UserRole (idempotente)
  await prisma.$executeRaw`
    DO $$ BEGIN
      CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER', 'VOLUNTEER', 'PARTNER');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `;
  
  // 2. Verificar se tabela users existe
  try {
    await prisma.user.findMany({ take: 1 });
  } catch (error) {
    // 3. Criar tabela se não existir
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "password" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "phone" TEXT,
        "avatar" TEXT,
        "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "users_pkey" PRIMARY KEY ("id")
      );
    `;
  }
}
```

### 🔐 **Autenticação**

#### **Mobile App**
- **Email/Senha:** Qualquer usuário pode se registrar
- **Role Automático:** MEMBER
- **Token:** JWT armazenado no AsyncStorage
- **Validade:** 7 dias

#### **Admin Panel**
- **Credenciais Demo:** `admin@ligadobem.com` / `admin123`
- **Role Necessário:** ADMIN
- **Token:** JWT armazenado no localStorage
- **Validade:** 7 dias

### 📊 **Testando a Integração**

#### **Teste 1: Criar Usuário no Mobile**
1. Abra o app mobile
2. Clique em "Cadastre-se"
3. Preencha os dados
4. Registre-se

**Resultado Esperado:** 
- ✅ Usuário criado no banco com role='MEMBER'
- ✅ Login automático após registro
- ✅ Token JWT gerado e salvo

#### **Teste 2: Visualizar no Admin**
1. Acesse: `https://nova-versao-liga-do-bem-admin.onrender.com/login.html`
2. Login: `admin@ligadobem.com` / `admin123`
3. Navegue para "Membros"

**Resultado Esperado:**
- ✅ Tabela exibe o usuário criado no mobile
- ✅ Nome, email, telefone aparecem
- ✅ Status "active"
- ✅ Data de criação correta

#### **Teste 3: Verificar Backend**
```bash
# Health Check
curl https://nova-versao-liga-do-bem.onrender.com/health

# Testar Registro
curl -X POST https://nova-versao-liga-do-bem.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"test123"}'

# Testar Login
curl -X POST https://nova-versao-liga-do-bem.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

### 🎯 **Status da Integração**

| Componente | Status | Descrição |
|------------|--------|-----------|
| **Backend** | ✅ Online | PostgreSQL + Node.js |
| **Mobile App** | ✅ Funcionando | Registro + Login |
| **Admin Panel** | ✅ Integrado | Visualiza membros do mobile |
| **Banco de Dados** | ✅ Único | Todos usam o mesmo |
| **Autenticação** | ✅ JWT | Tokens válidos |
| **Role System** | ✅ Implementado | MEMBER automático |

### 🚀 **Deploy Automático**

Sempre que você fizer `git push origin master`:

1. **Backend:** Render redeploy automático
2. **Admin Panel:** Render redeploy automático (arquivos estáticos)
3. **Mobile App:** Precisa gerar novo APK manualmente

### 📝 **Próximos Passos**

1. ✅ **Integração Completa:** Mobile + Backend + Admin
2. ✅ **Banco de Dados Único:** Todos compartilham dados
3. ✅ **Role System:** MEMBER automático
4. ⏳ **Gestão de Empresas:** Admin panel gerencia empresas
5. ⏳ **Sincronização:** Empresas aparecem no mobile
6. ⏳ **Descontos:** Sistema de descontos integrado

---

## 🎉 **RESUMO**

**✅ TUDO FUNCIONANDO!**

- **Mobile App:** Registra e autentica usuários
- **Backend:** Armazena no PostgreSQL
- **Admin Panel:** Visualiza e gerencia membros
- **Integração:** 100% completa e testada

**Para testar:**
1. Registre um usuário no mobile app
2. Faça login no admin panel
3. Veja o usuário na aba "Membros"

**URLs:**
- **Mobile APK:** https://nova-versao-liga-do-bem-web.onrender.com
- **Admin Panel:** https://nova-versao-liga-do-bem-admin.onrender.com
- **Backend API:** https://nova-versao-liga-do-bem.onrender.com

🚀 **Sistema 100% integrado e funcional!**


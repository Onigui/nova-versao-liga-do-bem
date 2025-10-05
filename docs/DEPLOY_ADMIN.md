# 🚀 Deploy da Área Administrativa no Render

## 📋 **Configuração no Render**

### 1. **Criar Novo Serviço**
- Acesse: https://dashboard.render.com
- Clique em "New +" → "Static Site"

### 2. **Configurar o Serviço**
- **Name:** `nova-versao-liga-do-bem-admin`
- **Environment:** `Static Site`
- **Build Command:** (deixe vazio)
- **Publish Directory:** `admin`
- **Root Directory:** (deixe vazio)
- **Branch:** `master`

### 3. **Conectar ao GitHub**
- **Repository:** `Onigui/nova-versao-liga-do-bem`
- **Branch:** `master`
- **Auto-Deploy:** `Yes`

### 4. **Configurar Domínio Personalizado (Opcional)**
- **Custom Domain:** `admin.ligadobembotucatu.org.br`
- **SSL:** Automático (gratuito)

## 🔐 **Configurações de Segurança**

### **Autenticação**
- Implementar sistema de login
- Controle de acesso por perfil
- Sessões protegidas com JWT

### **Variáveis de Ambiente**
```
API_URL=https://nova-versao-liga-do-bem-api.onrender.com
JWT_SECRET=seu_jwt_secret_aqui
ADMIN_EMAIL=admin@ligadobembotucatu.org.br
```

## 📱 **URLs dos Serviços**

### **Produção**
- **Frontend Web:** https://nova-versao-liga-do-bem-web.onrender.com
- **Backend API:** https://nova-versao-liga-do-bem-api.onrender.com
- **Área Admin:** https://nova-versao-liga-do-bem-admin.onrender.com
- **Mobile App:** (APK em desenvolvimento)

### **Estrutura Completa**
```
🌐 Frontend Web (Landing Page)
├── 📱 App Mobile (React Native)
├── ⚙️ Backend API (Node.js + PostgreSQL)
└── 🛠️ Área Administrativa (Painel de Controle)
```

## 🔧 **Funcionalidades da Área Admin**

### **✅ Implementadas**
- Dashboard com métricas
- Gestão de empresas parceiras
- Gestão de membros
- Configuração de GPS e horários
- Design moderno responsivo

### **⏳ Em Desenvolvimento**
- Sistema de autenticação
- Relatórios avançados
- Configuração de descontos
- Integração com backend

---

**Status:** ✅ Pronto para deploy  
**Próximo:** Configurar autenticação e integração com API

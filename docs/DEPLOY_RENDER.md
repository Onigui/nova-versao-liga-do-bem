# 🚀 Guia Completo - Deploy no Render.com

Este guia te levará passo a passo para fazer o deploy completo da plataforma Liga do Bem no Render.com.

## 📋 Pré-requisitos

- ✅ Conta no GitHub
- ✅ Conta no Render.com
- ✅ Código commitado no repositório GitHub
- ✅ PostgreSQL (será criado no Render)

## 🗄️ PASSO 1: Criar Banco de Dados PostgreSQL

1. **Acesse o Render Dashboard**
   - Vá para [render.com](https://render.com)
   - Faça login na sua conta

2. **Criar novo PostgreSQL Database**
   - Clique em "New +"
   - Selecione "PostgreSQL"
   - Configure:
     ```
     Name: liga-do-bem-db
     Database: liga_do_bem_db
     User: liga_do_bem_user
     Region: US East (ou sua preferência)
     PostgreSQL Version: 14
     ```
   - Clique em "Create Database"

3. **Anotar as credenciais**
   - Aguarde a criação (pode levar alguns minutos)
   - Anote as informações de conexão:
     ```
     Host: dpg-xxxxx-a.oregon-postgres.render.com
     Port: 5432
     Database: liga_do_bem_db
     Username: liga_do_bem_user
     Password: [senha gerada]
     ```
   - **Importante**: A URL completa estará no formato:
     ```
     postgresql://liga_do_bem_user:[password]@dpg-xxxxx-a.oregon-postgres.render.com:5432/liga_do_bem_db
     ```

## ⚙️ PASSO 2: Deploy do Backend API

1. **Criar novo Web Service**
   - Clique em "New +"
   - Selecione "Web Service"
   - Conecte com seu repositório GitHub
   - Selecione: `Onigui/nova-versao-liga-do-bem`

2. **Configurar o Backend**
   ```
   Name: liga-do-bem-api
   Environment: Node
   Region: US East (mesma do banco)
   Branch: main
   Root Directory: backend
   Build Command: npm install && npx prisma generate && npx prisma migrate deploy
   Start Command: npm start
   ```

3. **Variáveis de Ambiente**
   Adicione as seguintes variáveis:
   ```
   DATABASE_URL = postgresql://liga_do_bem_user:[password]@dpg-xxxxx-a.oregon-postgres.render.com:5432/liga_do_bem_db
   
   JWT_SECRET = sua-chave-secreta-jwt-muito-forte-aqui
   
   NODE_ENV = production
   
   PORT = 10000
   
   FRONTEND_URL = https://liga-do-bem-web.onrender.com
   
   MOBILE_URL = exp://localhost:19000
   
   # Firebase (configure depois)
   FIREBASE_PROJECT_ID = seu-projeto-firebase
   FIREBASE_PRIVATE_KEY = sua-chave-privada-firebase
   FIREBASE_CLIENT_EMAIL = seu-email-firebase
   
   # OAuth (configure depois)
   GOOGLE_CLIENT_ID = seu-google-client-id
   GOOGLE_CLIENT_SECRET = seu-google-client-secret
   
   # Email (configure depois)
   SMTP_HOST = smtp.gmail.com
   SMTP_PORT = 587
   SMTP_USER = seu-email@gmail.com
   SMTP_PASS = sua-senha-app
   
   # Rate Limiting
   RATE_LIMIT_WINDOW_MS = 900000
   RATE_LIMIT_MAX_REQUESTS = 100
   ```

4. **Deploy**
   - Clique em "Create Web Service"
   - Aguarde o build e deploy (pode levar 5-10 minutos)
   - Anote a URL: `https://liga-do-bem-api.onrender.com`

## 🌐 PASSO 3: Deploy do Frontend Web

1. **Criar novo Static Site**
   - Clique em "New +"
   - Selecione "Static Site"
   - Conecte com seu repositório GitHub
   - Selecione: `Onigui/nova-versao-liga-do-bem`

2. **Configurar o Frontend**
   ```
   Name: liga-do-bem-web
   Branch: main
   Root Directory: web
   Build Command: npm install && npm run build
   Publish Directory: out
   ```

3. **Variáveis de Ambiente**
   ```
   NEXT_PUBLIC_API_URL = https://liga-do-bem-api.onrender.com
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = sua-chave-google-maps
   ```

4. **Deploy**
   - Clique em "Create Static Site"
   - Aguarde o build e deploy
   - Anote a URL: `https://liga-do-bem-web.onrender.com`

## 📱 PASSO 4: Configurar Mobile App

1. **Atualizar URLs da API**
   - No arquivo `mobile/src/services/api.ts`
   - Alterar a URL base para: `https://liga-do-bem-api.onrender.com`

2. **Build do APK**
   ```bash
   cd mobile
   expo build:android
   ```

## 🔧 PASSO 5: Configurações Adicionais

### Firebase (Notificações Push)
1. **Criar projeto no Firebase**
   - Vá para [console.firebase.google.com](https://console.firebase.google.com)
   - Crie um novo projeto: "Liga do Bem Botucatu"

2. **Configurar Authentication**
   - Ative Google Sign-In
   - Configure domínios autorizados

3. **Configurar Cloud Messaging**
   - Ative FCM
   - Baixe o arquivo de configuração
   - Adicione as credenciais no Render

### Google OAuth
1. **Google Cloud Console**
   - Vá para [console.cloud.google.com](https://console.cloud.google.com)
   - Crie um novo projeto
   - Ative Google+ API
   - Configure OAuth consent screen
   - Crie credenciais OAuth 2.0

2. **Adicionar URIs autorizados**
   ```
   https://liga-do-bem-web.onrender.com
   https://liga-do-bem-api.onrender.com
   ```

### Google Maps API
1. **Ativar APIs necessárias**
   - Maps JavaScript API
   - Places API
   - Geocoding API

2. **Configurar restrições**
   - Adicionar domínios autorizados
   - Configurar quotas

## 🧪 PASSO 6: Testar o Deploy

### 1. Testar Backend
```bash
# Health check
curl https://liga-do-bem-api.onrender.com/health

# Deve retornar:
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "production"
}
```

### 2. Testar Frontend
- Acesse: `https://liga-do-bem-web.onrender.com`
- Verifique se carrega corretamente
- Teste os formulários

### 3. Testar Mobile
- Instale o APK no celular
- Teste login e funcionalidades
- Verifique notificações push

## 📊 PASSO 7: Monitoramento

### Render Dashboard
- Monitore logs em tempo real
- Configure alertas de uptime
- Acompanhe métricas de performance

### Logs Úteis
```bash
# Ver logs do backend
# No Render Dashboard > Seu serviço > Logs

# Comandos úteis para debug
npm run prisma:migrate
npm run prisma:studio
```

## 🔄 PASSO 8: CI/CD Automático

O Render já faz deploy automático quando você faz push para o branch `main`.

### Fluxo de Deploy
1. Push para GitHub
2. Render detecta mudanças
3. Build automático
4. Deploy automático
5. Health check

### Branches
- `main`: Deploy automático para produção
- `develop`: Deploy para ambiente de teste (opcional)

## 🚨 Troubleshooting

### Problemas Comuns

#### 1. Erro de Conexão com Banco
```bash
# Verificar DATABASE_URL
echo $DATABASE_URL

# Testar conexão
psql $DATABASE_URL
```

#### 2. Build Falha
```bash
# Verificar logs no Render
# Comum: dependências não instaladas

# Solução: verificar package.json
npm install
```

#### 3. CORS Error
```bash
# Verificar FRONTEND_URL no backend
# Deve ser: https://liga-do-bem-web.onrender.com
```

#### 4. JWT Error
```bash
# Verificar JWT_SECRET
# Deve ser uma string forte
```

## 📈 Próximos Passos

1. **Configurar domínio personalizado**
2. **Implementar CDN**
3. **Configurar SSL**
4. **Backup automático do banco**
5. **Monitoramento avançado**
6. **Testes automatizados**

## 🆘 Suporte

Se encontrar problemas:
1. Verifique os logs no Render Dashboard
2. Teste localmente primeiro
3. Verifique as variáveis de ambiente
4. Consulte a documentação do Render

---

**🎉 Parabéns! Sua plataforma Liga do Bem está no ar!**

**URLs Finais:**
- 🌐 Website: `https://liga-do-bem-web.onrender.com`
- ⚙️ API: `https://liga-do-bem-api.onrender.com`
- 📱 Mobile: APK instalado no celular

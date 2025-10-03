# 🔐 Suas Credenciais - Liga do Bem

## 📊 Banco de Dados PostgreSQL (Render)

```
Host: dpg-d3fjgjqli9vc73dte1r0-a
Port: 5432
Database: liga_do_bem_db
Username: liga_do_bem_user
Password: pBtBA3L1YwpyivZe5aBtg9iNizeNWpc5
```

**URL Completa:**
```
postgresql://liga_do_bem_user:pBtBA3L1YwpyivZe5aBtg9iNizeNWpc5@dpg-d3fjgjqli9vc73dte1r0-a/liga_do_bem_db
```

## 🌐 URLs dos Serviços

### Backend API
```
https://nova-versao-liga-do-bem-api.onrender.com
```

### Frontend Web (ainda não criado)
```
https://nova-versao-liga-do-bem-web.onrender.com
```

## 📋 Próximos Passos

### 1. ✅ Banco de Dados - CONCLUÍDO
- ✅ PostgreSQL criado no Render
- ✅ Credenciais anotadas

### 2. ✅ Backend API - CONCLUÍDO
- ✅ URL da API: https://nova-versao-liga-do-bem-api.onrender.com
- ✅ Conectado ao banco

### 3. 🔄 Frontend Web - PRÓXIMO
Agora você precisa criar o Static Site no Render:

1. **Render Dashboard** → "New +" → "Static Site"
2. **Conectar GitHub**: `Onigui/nova-versao-liga-do-bem`
3. **Configurações:**
   ```
   Name: nova-versao-liga-do-bem-web
   Branch: main
   Root Directory: web
   Build Command: npm install && npm run build
   Publish Directory: out
   ```
4. **Variáveis de Ambiente:**
   ```
   NEXT_PUBLIC_API_URL = https://nova-versao-liga-do-bem-api.onrender.com
   ```

### 4. 📱 Mobile App - DEPOIS
1. Atualizar URL da API no mobile
2. Build do APK
3. Teste no celular

## 🧪 Testar API

Teste se sua API está funcionando:

```bash
curl https://nova-versao-liga-do-bem-api.onrender.com/health
```

Deve retornar:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "production"
}
```

## ⚠️ Importante

- **Guarde estas credenciais** em local seguro
- **NÃO compartilhe** a senha do banco publicamente
- **Configure as variáveis** nos serviços do Render
- **Teste cada etapa** antes de prosseguir

## 🆘 Suporte

Se precisar de ajuda:
1. Verifique os logs no Render Dashboard
2. Teste a API primeiro
3. Siga o guia em `docs/DEPLOY_RENDER.md`

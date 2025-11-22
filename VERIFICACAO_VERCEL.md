# 🔍 Verificação do Deploy no Vercel

## ✅ Correções Aplicadas

1. **Removidas rotas que travavam o servidor**: Todas as rotas que inicializavam Prisma no nível do módulo foram comentadas temporariamente
2. **Rota admin corrigida**: Agora usa `getPrisma()` lazy do arquivo `utils/prisma.ts`
3. **Endpoints de teste**: `/api/ping` e `/api/quick-test` devem responder imediatamente

## 🔗 URLs dos Projetos

- **Backend API**: https://nova-versao-liga-do-bem.vercel.app
- **Admin Dashboard**: https://nova-versao-liga-do-bem-pufx.vercel.app
- **Web Frontend**: https://nova-versao-liga-do-bem-web.vercel.app

## ⚙️ Configuração Necessária no Vercel

### 1. Verificar Variáveis de Ambiente no Backend

No projeto **nova-versao-liga-do-bem** (backend), você DEVE ter estas variáveis configuradas:

```
DATABASE_URL=postgresql://postgres.ushdgkfnxrxwqrnicdns:SUA_SENHA@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.ushdgkfnxrxwqrnicdns:SUA_SENHA@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
JWT_SECRET=liga-do-bem-jwt-secret-key-2024-production
NODE_ENV=production
```

**⚠️ IMPORTANTE**: Substitua `SUA_SENHA` pela senha real do seu Supabase.

### 2. Como Obter a Senha do Supabase

1. Acesse: https://supabase.com/dashboard/project/ushdgkfnxrxwqrnicdns
2. Vá em **Settings** → **Database**
3. Procure por **Connection string** ou **Database password**
4. Copie a senha e use na `DATABASE_URL`

### 3. Como Configurar no Vercel

1. Acesse: https://vercel.com/dashboard
2. Clique no projeto **nova-versao-liga-do-bem** (backend)
3. Vá em **Settings** → **Environment Variables**
4. Adicione/verifique todas as variáveis acima
5. **IMPORTANTE**: Marque todas como disponíveis para **Production**, **Preview** e **Development**
6. Clique em **Save**
7. Faça um novo deploy (ou aguarde o redeploy automático)

## 🧪 Testes para Verificar

### 1. Teste Básico (deve responder imediatamente)

```bash
curl https://nova-versao-liga-do-bem.vercel.app/api/ping
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "message": "Backend is alive!",
  "timestamp": "..."
}
```

### 2. Teste de Empresas (requer autenticação)

No admin, ao clicar em "Empresas Parceiras", deve:
- Fazer requisição para: `GET https://nova-versao-liga-do-bem.vercel.app/api/admin/companies`
- Com header: `Authorization: Bearer SEU_TOKEN`
- Retornar lista de empresas do Supabase

### 3. Verificar Logs no Vercel

1. Acesse o projeto no Vercel
2. Vá em **Deployments**
3. Clique no deployment mais recente
4. Vá em **Functions** → `api/index.ts`
5. Verifique os logs para erros

## 🐛 Problemas Comuns

### Backend não responde (timeout)

**Causa**: Variáveis de ambiente não configuradas ou rotas travando

**Solução**:
1. Verifique se `DATABASE_URL` está configurada no Vercel
2. Verifique os logs do deployment
3. Teste o endpoint `/api/ping` primeiro

### CORS errors

**Causa**: Headers CORS não configurados corretamente

**Solução**: Já está configurado no `vercel.json`, mas verifique se o deployment foi atualizado

### Empresas não aparecem

**Causa**: 
1. `DATABASE_URL` não configurada
2. Banco de dados vazio
3. Erro na conexão com Supabase

**Solução**:
1. Verifique `DATABASE_URL` no Vercel
2. Teste a conexão com Supabase diretamente
3. Verifique se há empresas cadastradas no banco

## 📋 Checklist Final

- [ ] `DATABASE_URL` configurada no Vercel (backend)
- [ ] `DIRECT_URL` configurada no Vercel (backend)
- [ ] `JWT_SECRET` configurada no Vercel (backend)
- [ ] Endpoint `/api/ping` responde
- [ ] Endpoint `/api/admin/companies` responde (com token)
- [ ] Empresas aparecem no admin
- [ ] Logs do Vercel não mostram erros críticos

## 🚀 Próximos Passos

Depois que o backend estiver funcionando:

1. **Reativar outras rotas**: Corrigir todas as rotas para usar `getPrisma()` lazy
2. **Testar todas as funcionalidades**: Login, empresas, membros, etc.
3. **Monitorar logs**: Verificar se há erros recorrentes

---

**Última atualização**: Após correção de inicialização lazy do Prisma


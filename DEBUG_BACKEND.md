# 🐛 Debug do Backend - Problema de Timeout

## 📋 Situação Atual

O backend está dando timeout de 15 segundos ao tentar acessar `/api/admin/companies`.

## ✅ Correções Aplicadas

1. **Lazy Loading de Rotas**: Rota admin agora é carregada apenas quando necessário
2. **Logs Detalhados**: Adicionados logs em cada etapa da inicialização
3. **Endpoints de Teste**: `/api/ping` e `/api/quick-test` devem responder imediatamente
4. **Prisma Lazy**: Todas as rotas usam `getPrisma()` lazy

## 🔍 Como Diagnosticar

### 1. Verificar se o Servidor Está Iniciando

Acesse os logs do Vercel:
1. Vá em: https://vercel.com/dashboard
2. Clique no projeto **nova-versao-liga-do-bem** (backend)
3. Vá em **Deployments** → Clique no deployment mais recente
4. Vá em **Functions** → `api/index.ts`
5. Procure por estes logs:
   - `🚀 Iniciando servidor Express...`
   - `✅ Express app criado`
   - `✅ Configurando handler serverless...`
   - `✅ Handler serverless criado - servidor pronto!`

**Se NÃO aparecer esses logs**: O servidor não está iniciando (erro de compilação ou import)

### 2. Testar Endpoint Básico

Abra no navegador ou use curl:
```
https://nova-versao-liga-do-bem.vercel.app/api/ping
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "message": "Backend is alive!",
  "timestamp": "...",
  "server": "Vercel Serverless"
}
```

**Se não responder**: O servidor não está iniciando ou há erro de roteamento

### 3. Verificar Erros de Compilação

Nos logs do Vercel, procure por:
- `Error:` ou `❌`
- `Failed to compile`
- `Module not found`
- `Cannot find module`

### 4. Verificar Variáveis de Ambiente

No Vercel, verifique se estas variáveis estão configuradas:
- `DATABASE_URL` (não precisa estar para `/api/ping` funcionar)
- `JWT_SECRET`
- `NODE_ENV=production`

## 🚨 Possíveis Problemas

### Problema 1: Servidor Não Inicia

**Sintomas:**
- Timeout em todos os endpoints
- Nenhum log aparece no Vercel
- Erro 502 ou 503

**Soluções:**
1. Verificar erros de compilação TypeScript
2. Verificar se todas as dependências estão instaladas
3. Verificar se `package.json` tem `postinstall: prisma generate`

### Problema 2: Rota Admin Travando

**Sintomas:**
- `/api/ping` funciona
- `/api/admin/*` dá timeout

**Soluções:**
1. Verificar logs quando acessa `/api/admin/companies`
2. Verificar se `getPrisma()` está retornando null
3. Verificar se há timeout na conexão com Supabase

### Problema 3: CORS

**Sintomas:**
- Erro "CORS policy" no console do navegador
- Requisição não chega ao servidor

**Soluções:**
- Já está configurado no `vercel.json` e no código
- Verificar se o deployment foi atualizado

## 📝 Próximos Passos

1. **Aguardar redeploy** (1-2 minutos após push)
2. **Testar `/api/ping`** primeiro
3. **Verificar logs no Vercel** para ver onde está travando
4. **Testar `/api/admin/companies`** com token válido

## 🔧 Comandos de Teste

### Teste 1: Ping (deve funcionar sempre)
```bash
curl https://nova-versao-liga-do-bem.vercel.app/api/ping
```

### Teste 2: Quick Test
```bash
curl https://nova-versao-liga-do-bem.vercel.app/api/quick-test
```

### Teste 3: Test Companies (sem auth)
```bash
curl https://nova-versao-liga-do-bem.vercel.app/api/test-companies
```

### Teste 4: Admin Companies (com token)
```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
  https://nova-versao-liga-do-bem.vercel.app/api/admin/companies
```

## 📊 Checklist de Diagnóstico

- [ ] Logs do Vercel mostram inicialização do servidor
- [ ] `/api/ping` responde corretamente
- [ ] `/api/quick-test` responde corretamente
- [ ] `/api/test-companies` responde (mesmo que vazio)
- [ ] `/api/admin/companies` responde (com token)
- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] Deployment mais recente está ativo
- [ ] Não há erros de compilação nos logs

---

**Última atualização**: Após implementar lazy loading de rotas


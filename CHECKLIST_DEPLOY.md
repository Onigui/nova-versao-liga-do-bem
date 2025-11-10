# ✅ Checklist de Deploy - Liga do Bem

Use este checklist para garantir que todas as alterações sejam deployadas corretamente.

## 📋 Pré-Deploy

- [ ] Todas as alterações foram salvas
- [ ] Dependências do mobile foram atualizadas (`package.json`)
- [ ] URLs da API foram corrigidas em todos os arquivos
- [ ] Banco de dados migrado para Supabase

## 🔧 Deploy do Backend

### Opção 1: Via Render Dashboard (RECOMENDADO)

- [ ] Acessar https://render.com
- [ ] Fazer login na conta
- [ ] Selecionar o serviço `nova-versao-liga-do-bem-api`
- [ ] Ir em "Environment"
- [ ] Atualizar variáveis:
  - [ ] `DATABASE_URL` = `postgresql://postgres.ushdgkfnxrxwqrnicdns:Onigui1973!@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
  - [ ] `DIRECT_URL` = `postgresql://postgres.ushdgkfnxrxwqrnicdns:Onigui1973!@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`
- [ ] Salvar variáveis
- [ ] Clicar em "Manual Deploy"
- [ ] Selecionar "Deploy latest commit"
- [ ] Aguardar deploy finalizar (5-10 minutos)
- [ ] Verificar logs por erros

### Opção 2: Via Git Push

```bash
cd /workspace
git add .
git commit -m "fix: corrige sincronização e migra para Supabase"
git push origin main
```

- [ ] Fazer push das alterações
- [ ] Aguardar deploy automático no Render
- [ ] Verificar logs no dashboard do Render

## 🗄️ Configurar Banco de Dados

- [ ] Executar migrations:
```bash
cd /workspace/backend
npx prisma migrate deploy
```

- [ ] Gerar cliente Prisma:
```bash
npx prisma generate
```

- [ ] Criar usuário admin:
```bash
npm run create-admin
```

- [ ] Verificar tabelas no Supabase Dashboard

## 📱 Deploy do Mobile App

- [ ] Instalar dependências:
```bash
cd /workspace/mobile
npm install
```

- [ ] Limpar cache:
```bash
npx expo start -c
```

- [ ] Testar em desenvolvimento primeiro
- [ ] Gerar novo APK:
```bash
eas build --platform android --profile production
```

- [ ] Aguardar build (20-30 minutos)
- [ ] Baixar APK gerado
- [ ] Fazer upload para `/web/downloads/`
- [ ] Atualizar link no site

## 🌐 Deploy do Admin Site

- [ ] As alterações já foram feitas nos arquivos HTML
- [ ] Se estiver no Render, o deploy é automático
- [ ] Verificar se o admin está acessível
- [ ] Testar login no admin

## 🧪 Testes de Validação

### Teste 1: Backend API
```bash
curl https://nova-versao-liga-do-bem-api.onrender.com/api/test
```
- [ ] Resposta 200 OK recebida
- [ ] JSON com mensagem de sucesso

### Teste 2: Listar Parceiros
```bash
curl https://nova-versao-liga-do-bem-api.onrender.com/api/partners
```
- [ ] Resposta 200 OK
- [ ] Lista de parceiros retornada

### Teste 3: Admin Login
- [ ] Acessar https://nova-versao-liga-do-bem-admin.onrender.com
- [ ] Fazer login com `admin@ligadobem.com` / `demo123`
- [ ] Dashboard carrega corretamente
- [ ] Consegue ver lista de parceiros
- [ ] Consegue ver lista de membros

### Teste 4: Criar Parceiro
- [ ] No admin, ir em "Empresas Parceiras"
- [ ] Clicar em "Cadastrar Nova Empresa"
- [ ] Preencher formulário
- [ ] Salvar
- [ ] Parceiro aparece na lista
- [ ] Verificar no banco Supabase se foi salvo

### Teste 5: Mobile App
- [ ] Abrir o app
- [ ] Ir para tela "Parceiros"
- [ ] O novo parceiro criado aparece
- [ ] Clicar no parceiro para ver detalhes
- [ ] Informações estão corretas

### Teste 6: Criar Membro
- [ ] No admin, ir em "Membros"
- [ ] Clicar em "Cadastrar Novo Membro"
- [ ] Preencher dados: email, senha, nome
- [ ] Salvar
- [ ] Verificar se foi criado

### Teste 7: Login Mobile
- [ ] No app, fazer logout (se logado)
- [ ] Tentar login com o membro criado
- [ ] Login deve funcionar
- [ ] Dados do usuário aparecem
- [ ] Carteirinha é exibida

## 🔍 Verificações Finais

- [ ] API está respondendo (sem 404 ou 500)
- [ ] CORS não está bloqueando requisições
- [ ] Admin consegue criar/editar/deletar dados
- [ ] Mobile consegue listar dados atualizados
- [ ] Autenticação funciona em ambos
- [ ] Sem erros no console do navegador
- [ ] Sem erros nos logs do Render
- [ ] Banco Supabase tem os dados corretos

## 📊 Monitoramento

### Logs do Backend (Render)
- [ ] Acessar https://render.com
- [ ] Ir no serviço `nova-versao-liga-do-bem-api`
- [ ] Clicar em "Logs"
- [ ] Verificar se há erros
- [ ] Procurar por:
  - Erros de conexão com DB
  - Erros de CORS
  - Erros 500

### Console do Admin
- [ ] Abrir admin no navegador
- [ ] Abrir DevTools (F12)
- [ ] Ir em "Console"
- [ ] Procurar por erros
- [ ] Ir em "Network"
- [ ] Verificar status das requisições

### Logs do Mobile
- [ ] Terminal onde o expo está rodando
- [ ] Procurar por erros de API
- [ ] Procurar por erros de autenticação
- [ ] Verificar se requisições estão sendo feitas para URL correta

## ⚠️ Se Algo Der Errado

### Problema: API retorna 404
**Solução:**
1. [ ] Verificar se o deploy do backend foi feito
2. [ ] Confirmar URL no código: `nova-versao-liga-do-bem-api.onrender.com`
3. [ ] Checar logs do Render por erros de build

### Problema: Erro de CORS
**Solução:**
1. [ ] Verificar `server.ts` tem as URLs corretas
2. [ ] Fazer redeploy do backend
3. [ ] Limpar cache do navegador

### Problema: Banco de dados vazio
**Solução:**
1. [ ] Executar `npx prisma migrate deploy`
2. [ ] Executar `npx prisma db push`
3. [ ] Executar `npm run create-admin`
4. [ ] Verificar no Supabase Dashboard

### Problema: Mobile não conecta
**Solução:**
1. [ ] Verificar URL em `api.ts` e `AuthService.js`
2. [ ] Instalar dependências: `npm install axios expo-constants`
3. [ ] Limpar cache: `npx expo start -c`
4. [ ] Verificar se o backend está no ar

### Problema: Admin não salva dados
**Solução:**
1. [ ] Fazer logout e login novamente
2. [ ] Verificar token no localStorage
3. [ ] Verificar console por erros de API
4. [ ] Testar a API manualmente com curl

## 📈 Métricas de Sucesso

Após o deploy completo:

- [ ] ✅ Backend API responde em < 2 segundos
- [ ] ✅ Admin carrega em < 3 segundos
- [ ] ✅ Mobile lista parceiros em < 2 segundos
- [ ] ✅ Criação de dados é instantânea
- [ ] ✅ Sincronização funciona em tempo real
- [ ] ✅ 0 erros no console
- [ ] ✅ 0 erros nos logs

## 🎉 Deploy Completo!

Quando todos os itens estiverem marcados, o deploy está completo e a sincronização deve estar funcionando perfeitamente!

## 📚 Documentação de Referência

- `CORRECOES_SINCRONIZACAO.md` - Detalhes técnicos
- `RESUMO_SOLUCAO.md` - Visão geral da solução
- `test-api-sync.sh` - Script de teste da API

---

**Última atualização:** 2025-11-10
**Status:** 🟡 Aguardando Deploy

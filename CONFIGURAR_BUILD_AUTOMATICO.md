# 🤖 Configuração do Build Automático com GitHub Actions

## 📋 Visão Geral

Configurei um workflow do GitHub Actions que automaticamente gera o APK do aplicativo usando **EAS Build** (Expo Application Services).

### ✨ Características

- ✅ Build automático ao fazer push na branch `main`
- ✅ Build manual através do GitHub Actions
- ✅ Upload automático do APK como artifact
- ✅ Criação automática de releases no GitHub
- ✅ Notificações de status do build
- ✅ Suporte para profiles (production/preview)

## 🔧 Configuração Inicial

### Passo 1: Criar Conta no Expo

1. Acesse https://expo.dev
2. Faça login ou crie uma conta
3. Anote seu nome de usuário

### Passo 2: Instalar EAS CLI (Local)

```bash
npm install -g eas-cli
```

### Passo 3: Fazer Login no EAS

```bash
cd /workspace/mobile
eas login
```

Use as mesmas credenciais da conta Expo.

### Passo 4: Configurar o Projeto

```bash
# Verificar se o projeto já está configurado
eas whoami

# Se necessário, configurar o projeto
eas build:configure
```

### Passo 5: Gerar Token do Expo

Este token será usado pelo GitHub Actions:

```bash
# Gerar um token de acesso
eas build:configure

# Ou gerar manualmente em:
# https://expo.dev/accounts/[seu-usuario]/settings/access-tokens
```

1. Acesse https://expo.dev
2. Vá em "Settings" → "Access Tokens"
3. Clique em "Create Token"
4. Nome: `GITHUB_ACTIONS_TOKEN`
5. Copie o token gerado (você só verá uma vez!)

## 🔑 Configurar Secrets no GitHub

### Passo 1: Acessar o Repositório

1. Vá para o repositório no GitHub
2. Clique em **Settings** (configurações)
3. No menu lateral, clique em **Secrets and variables** → **Actions**

### Passo 2: Adicionar Secrets

Clique em **New repository secret** e adicione:

#### EXPO_TOKEN (OBRIGATÓRIO)

- **Name:** `EXPO_TOKEN`
- **Value:** Cole o token gerado no Expo
- Clique em **Add secret**

**Este é o único secret necessário!** O `GITHUB_TOKEN` já vem configurado automaticamente.

## 🚀 Como Usar

### Opção 1: Build Automático (Push)

Simplesmente faça push das mudanças para a branch `main`:

```bash
git add .
git commit -m "feat: nova versão do app"
git push origin main
```

O workflow será acionado automaticamente e:
1. Instalará as dependências
2. Fará o build do APK
3. Criará uma release no GitHub
4. Disponibilizará o APK para download

### Opção 2: Build Manual

1. Acesse o repositório no GitHub
2. Vá em **Actions**
3. Clique em **🤖 Build Android APK**
4. Clique em **Run workflow**
5. Selecione:
   - **Branch:** main
   - **Profile:** production (ou preview)
6. Clique em **Run workflow**

### Opção 3: Build Local (para testes)

```bash
cd /workspace/mobile
eas build --platform android --profile production
```

## 📥 Baixar o APK Gerado

### Método 1: Artifacts do Workflow

1. Vá em **Actions** no GitHub
2. Clique no workflow que executou
3. Role até o final da página
4. Em **Artifacts**, clique em `liga-do-bem-botucatu-vXXX`
5. O APK será baixado como ZIP

### Método 2: Releases

1. Vá em **Releases** no GitHub
2. Clique na release mais recente
3. Baixe o arquivo `liga-do-bem-botucatu.apk`

### Método 3: EAS Dashboard

1. Acesse https://expo.dev
2. Vá em **Projects** → **liga-do-bem-botucatu**
3. Clique em **Builds**
4. Clique no build mais recente
5. Clique em **Download** para baixar o APK

## 📊 Profiles de Build

O projeto está configurado com 3 profiles:

### Production (Padrão)

- Build otimizado
- Sem logs de debug
- Tamanho reduzido
- Usa variáveis de produção

```bash
eas build --platform android --profile production
```

### Preview

- Build mais rápido
- Para testes internos
- Gera APK direto (não AAB)

```bash
eas build --platform android --profile preview
```

### Development

- Para desenvolvimento local
- Inclui debug tools
- Desenvolvimento com Expo Go

```bash
eas build --platform android --profile development
```

## 🔄 Fluxo Completo

```
┌─────────────────────┐
│  1. Fazer Mudanças  │
│     no Código       │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  2. Commit & Push   │
│     para main       │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  3. GitHub Actions  │
│  detecta mudanças   │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  4. Instala         │
│     Dependências    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  5. EAS Build       │
│  (20-30 minutos)    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  6. Download APK    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  7. Upload como     │
│     Artifact        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  8. Criar Release   │
│     no GitHub       │
└─────────────────────┘
```

## 📝 Estrutura de Versões

O projeto usa versionamento semântico:

- `package.json`: `"version": "1.2.2"`
- `app.json`: `"version": "1.2.2"`
- `app.json`: `"versionCode": 4` (Android)

### Como Incrementar Versões

**Patch (1.2.2 → 1.2.3)** - Correções de bugs
```bash
npm version patch
```

**Minor (1.2.3 → 1.3.0)** - Novas funcionalidades
```bash
npm version minor
```

**Major (1.3.0 → 2.0.0)** - Mudanças breaking
```bash
npm version major
```

Depois de incrementar, não esqueça de atualizar:
1. `versionCode` no `app.json` (incrementar em 1)
2. Fazer commit e push

## 🐛 Troubleshooting

### Erro: "EXPO_TOKEN not found"

**Causa:** Secret não configurado no GitHub

**Solução:**
1. Gere o token no Expo
2. Adicione o secret no GitHub (Settings → Secrets)
3. Rode o workflow novamente

### Erro: "Build failed"

**Causa:** Erro no código ou configuração

**Solução:**
1. Verifique os logs do workflow no GitHub Actions
2. Teste o build localmente: `eas build --platform android --profile production`
3. Corrija os erros e faça push novamente

### Erro: "Unable to download APK"

**Causa:** Build pode ter falhado ou timeout

**Solução:**
1. Verifique se o build completou no EAS Dashboard
2. Verifique os logs do workflow
3. Se o build demorou mais de 40 minutos, ajuste o timeout no workflow

### Workflow não dispara automaticamente

**Causa:** Mudanças fora do diretório `mobile/`

**Solução:**
- O workflow só dispara com mudanças em `mobile/**`
- Ou dispare manualmente via GitHub Actions UI

### APK não instala no Android

**Causa:** Certificado de debug ou versão incompatível

**Solução:**
1. Habilite "Fontes Desconhecidas" no Android
2. Desinstale versões antigas
3. Verifique se o build foi production (não development)

## 🔐 Segurança

### Secrets Necessários

- ✅ `EXPO_TOKEN` - Para autenticação no EAS Build
- ✅ `GITHUB_TOKEN` - Já vem configurado (automático)

### Não Commitar

⚠️ **NUNCA commite no git:**
- Tokens do Expo
- Credenciais de API
- Arquivos `.env`
- Keystores
- Senhas

Todos esses devem estar em secrets do GitHub.

## 📚 Documentação Adicional

### Links Úteis

- **EAS Build:** https://docs.expo.dev/build/introduction/
- **GitHub Actions:** https://docs.github.com/en/actions
- **Expo Dashboard:** https://expo.dev
- **Workflow File:** `.github/workflows/build-android.yml`

### Arquivos Relacionados

- `/workspace/.github/workflows/build-android.yml` - Workflow principal
- `/workspace/mobile/eas.json` - Configuração do EAS
- `/workspace/mobile/app.json` - Configuração do Expo
- `/workspace/mobile/package.json` - Dependências e versão

## ✅ Checklist de Verificação

Antes de fazer o primeiro build:

- [ ] Conta criada no Expo
- [ ] EAS CLI instalado
- [ ] Login feito no EAS
- [ ] Token gerado no Expo
- [ ] Secret `EXPO_TOKEN` adicionado no GitHub
- [ ] Versão atualizada no `package.json` e `app.json`
- [ ] `versionCode` incrementado
- [ ] Mudanças commitadas e pushed

## 🎉 Resultado Esperado

Após configurar tudo:

✅ Build automático ao fazer push  
✅ APK gerado em 20-30 minutos  
✅ Release criada automaticamente  
✅ APK disponível para download  
✅ Notificações de status  
✅ Histórico de builds no Expo  

## 📞 Precisa de Ajuda?

Se encontrar problemas:

1. Verifique os logs no GitHub Actions
2. Consulte o EAS Dashboard
3. Verifique se os secrets estão configurados
4. Teste build local primeiro
5. Consulte a documentação do Expo

---

**🎯 Próximo Passo:**

Execute o workflow manualmente pela primeira vez para testar!

1. Vá em **Actions** no GitHub
2. Clique em **🤖 Build Android APK**
3. Clique em **Run workflow**
4. Aguarde ~30 minutos
5. Baixe o APK gerado!

---

**Versão:** 1.2.2  
**Data:** 2025-11-10  
**Configurado por:** Cursor AI Assistant

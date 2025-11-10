# 🎯 COMECE AQUI - Build Automático de APK

> **Você pediu para configurar build automático com GitHub Actions. Está PRONTO! ✅**

---

## 🎉 O Que Foi Feito

✅ **Configurado build automático** com GitHub Actions + EAS Build  
✅ **Criados 2 workflows** (build + verificações)  
✅ **Versão atualizada** para 1.2.2 (versionCode 4)  
✅ **Documentação completa** em 4 arquivos  

---

## 📚 Qual Documento Ler?

### 🚀 Quero Começar AGORA!
**👉 [`INICIAR_BUILD_APK.md`](./INICIAR_BUILD_APK.md)**

Setup em 5 minutos com checklist simples.

### 📖 Quero Entender Tudo Primeiro
**👉 [`CONFIGURAR_BUILD_AUTOMATICO.md`](./CONFIGURAR_BUILD_AUTOMATICO.md)**

Guia completo com todas as explicações.

### 📊 Quero Apenas Ver o Resumo
**👉 [`BUILD_APK_RESUMO.md`](./BUILD_APK_RESUMO.md)**

Visão geral executiva do que foi configurado.

### 🗺️ Quero Ver o Índice Geral
**👉 [`README_BUILD_APK.md`](./README_BUILD_APK.md)**

Índice completo de toda a documentação.

---

## ⚡ Início Super Rápido (TL;DR)

Se você já tem experiência com Expo/EAS:

```bash
# 1. Gerar token
# https://expo.dev → Settings → Access Tokens → Create

# 2. Adicionar secret no GitHub
# Repo → Settings → Secrets → New: EXPO_TOKEN

# 3. Disparar build
# GitHub → Actions → 🤖 Build Android APK → Run workflow

# 4. Aguardar 30 min e baixar APK
```

---

## 📝 Checklist Rápido

- [ ] Ler documentação (escolha uma acima)
- [ ] Criar conta Expo (https://expo.dev)
- [ ] Gerar token de acesso
- [ ] Adicionar secret `EXPO_TOKEN` no GitHub
- [ ] Disparar primeira build
- [ ] Baixar e testar APK

---

## 🎯 Workflows Criados

### 1. 🤖 Build Android APK
**Arquivo:** `.github/workflows/build-android.yml`

**Trigger:**
- Push na branch `main`
- Mudanças em `mobile/**`
- Manual via GitHub Actions

**Resultado:**
- APK gerado e disponível em Artifacts
- Release criada automaticamente
- Build disponível no Expo Dashboard

### 2. 🔍 Check Mobile App
**Arquivo:** `.github/workflows/check-mobile.yml`

**Trigger:**
- Pull Requests para `main`

**Resultado:**
- Verifica configurações
- Valida versões
- Rápido (~2 minutos)

---

## 📱 Versão Atual

- **App:** 1.2.2
- **Android versionCode:** 4
- **Mudanças:**
  - URLs da API corrigidas
  - Supabase integrado
  - Build automático configurado

---

## 🔑 Requisito ÚNICO

**Você precisa adicionar UM secret no GitHub:**

```
Nome: EXPO_TOKEN
Valor: [token gerado no Expo]
```

**Como obter o token:**
1. https://expo.dev
2. Settings → Access Tokens
3. Create Token
4. Copiar o token

**Como adicionar no GitHub:**
1. Seu repositório → Settings
2. Secrets and variables → Actions
3. New repository secret
4. Nome: `EXPO_TOKEN`
5. Valor: [colar token]

---

## 🚀 Como Usar Após Configurar

### Opção 1: Build Automático
```bash
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
```
→ Build automático em ~30 min

### Opção 2: Build Manual
1. GitHub → Actions
2. 🤖 Build Android APK
3. Run workflow
4. Aguardar ~30 min
5. Baixar dos Artifacts

---

## 📥 Baixar o APK

### Após o workflow completar:

**Artifacts:**
```
Actions → [Workflow] → Artifacts → Download
```

**Releases:**
```
Releases → [Versão] → Assets → Download APK
```

**Expo Dashboard:**
```
expo.dev → Builds → Download
```

---

## 🎨 Fluxo Visual

```
1. Push código → 2. GitHub Actions → 3. EAS Build → 4. APK Pronto
                       (auto)           (30 min)       (download)
```

---

## 📊 Estrutura da Documentação

```
📁 Docs de Build APK
│
├── 🎯 COMECE_AQUI_BUILD.md ← VOCÊ ESTÁ AQUI
│   └── Navegação e início
│
├── 🚀 INICIAR_BUILD_APK.md ⭐ RECOMENDADO
│   └── Guia rápido (5 min)
│
├── 📖 CONFIGURAR_BUILD_AUTOMATICO.md
│   └── Guia completo (15 min)
│
├── 📊 BUILD_APK_RESUMO.md
│   └── Resumo executivo
│
└── 🗺️ README_BUILD_APK.md
    └── Índice geral
```

---

## ✅ O Que Verificar

Antes de disparar a primeira build:

1. ✅ Workflows estão no repositório (`.github/workflows/`)
2. ✅ Versão atualizada (1.2.2)
3. ⏳ Conta Expo criada
4. ⏳ Token gerado
5. ⏳ Secret adicionado no GitHub

---

## 🆘 Se Tiver Problemas

1. **Erro de autenticação**
   → Verificar se o secret `EXPO_TOKEN` está correto

2. **Build falhou**
   → Ver logs no GitHub Actions
   → Testar build local: `eas build --platform android`

3. **Timeout**
   → Builds demoram 30-40 minutos, é normal

4. **Outras dúvidas**
   → Consultar `CONFIGURAR_BUILD_AUTOMATICO.md` → Troubleshooting

---

## 🎯 Seu Próximo Passo

**Escolha UMA opção:**

### A) Setup Rápido (5 minutos)
👉 Abra **[`INICIAR_BUILD_APK.md`](./INICIAR_BUILD_APK.md)**

### B) Entender Primeiro (15 minutos)
👉 Abra **[`CONFIGURAR_BUILD_AUTOMATICO.md`](./CONFIGURAR_BUILD_AUTOMATICO.md)**

### C) Ver Apenas Resumo
👉 Abra **[`BUILD_APK_RESUMO.md`](./BUILD_APK_RESUMO.md)**

---

## 💡 Dicas Importantes

⚠️ **NUNCA commite:**
- Tokens do Expo
- Arquivos `.env`
- Credenciais
- Keystores

✅ **SEMPRE:**
- Use GitHub Secrets
- Incremente versões
- Teste localmente primeiro

---

## 🎊 Está Pronto!

Tudo o que você precisa para buildar automaticamente está configurado.

**Agora é só:**
1. Adicionar o secret `EXPO_TOKEN`
2. Disparar o workflow
3. Aguardar o build
4. Baixar e testar o APK

**Boa sorte! 🚀**

---

**📞 Suporte:**
- Documentação completa nos arquivos listados acima
- Expo Docs: https://docs.expo.dev/build/
- GitHub Actions: https://docs.github.com/actions

**📅 Data:** 2025-11-10  
**✨ Configurado por:** Cursor AI Assistant

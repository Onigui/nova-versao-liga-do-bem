# 🚀 Build Automático de APK - Liga do Bem

> **Sistema completo de CI/CD para gerar APK automaticamente usando GitHub Actions + EAS Build**

## 📖 Índice de Documentação

### 🎯 Escolha seu caminho:

#### Para Começar AGORA (Setup em 5 minutos)
**👉 [`INICIAR_BUILD_APK.md`](./INICIAR_BUILD_APK.md)**
- Checklist de 5 passos
- TL;DR com comandos copy-paste
- Guia visual passo a passo

#### Para Entender TUDO (Leitura de 15 minutos)
**📚 [`CONFIGURAR_BUILD_AUTOMATICO.md`](./CONFIGURAR_BUILD_AUTOMATICO.md)**
- Explicação completa do sistema
- Configurações avançadas
- Troubleshooting detalhado
- Profiles de build

#### Para Visão Geral Rápida
**📊 [`BUILD_APK_RESUMO.md`](./BUILD_APK_RESUMO.md)**
- Resumo executivo
- O que foi configurado
- Como usar em 3 passos
- Comparação antes/depois

---

## 🎯 O Que Foi Feito

### ✅ Workflows Criados

1. **🤖 Build Android APK** (`.github/workflows/build-android.yml`)
   - Build completo do APK
   - Upload automático
   - Criação de releases
   - Trigger: Push na main ou manual

2. **🔍 Check Mobile App** (`.github/workflows/check-mobile.yml`)
   - Verificações rápidas
   - Validação de versões
   - Trigger: Pull Requests

### ✅ Versão Atualizada

- `mobile/package.json`: **v1.2.2**
- `mobile/app.json`: **v1.2.2** (versionCode: 4)

### ✅ Documentação Criada

- `INICIAR_BUILD_APK.md` - Guia rápido
- `CONFIGURAR_BUILD_AUTOMATICO.md` - Guia completo
- `BUILD_APK_RESUMO.md` - Resumo executivo
- `README_BUILD_APK.md` - Este arquivo (índice)

---

## 🚀 Início Ultrarrápido

Se você já sabe o que está fazendo:

```bash
# 1. Login no Expo
eas login

# 2. Gerar token em: https://expo.dev → Settings → Access Tokens

# 3. Adicionar secret no GitHub
# Repo → Settings → Secrets → New: EXPO_TOKEN

# 4. Disparar build
# GitHub → Actions → 🤖 Build Android APK → Run workflow

# 5. Aguardar 30 min e baixar APK dos Artifacts
```

**Nunca usou antes?** 👉 Leia [`INICIAR_BUILD_APK.md`](./INICIAR_BUILD_APK.md)

---

## 📱 Fluxo Completo

```
DESENVOLVEDOR                    GITHUB ACTIONS                 RESULTADO
─────────────                    ──────────────                 ─────────

1. Código atualizado
   ↓
2. git push main        →     3. Workflow dispara
                                  ↓
                              4. Instala dependências
                                  ↓
                              5. EAS Build (30 min)
                                  ↓
                              6. Upload APK            →    7. APK Disponível
                                  ↓                              - Artifacts
                              8. Cria Release          →         - Releases
                                                                 - Expo Dashboard
```

---

## 🎓 Estrutura da Documentação

```
📁 Documentação Build APK
│
├── 📄 README_BUILD_APK.md (VOCÊ ESTÁ AQUI)
│   └── Índice e navegação
│
├── 📄 INICIAR_BUILD_APK.md ⭐ RECOMENDADO PARA COMEÇAR
│   ├── Setup em 5 passos
│   ├── Checklist visual
│   └── Comandos copy-paste
│
├── 📄 CONFIGURAR_BUILD_AUTOMATICO.md ⭐ REFERÊNCIA COMPLETA
│   ├── Explicação detalhada
│   ├── Configurações avançadas
│   ├── Profiles (production/preview)
│   ├── Troubleshooting completo
│   └── Segurança e boas práticas
│
├── 📄 BUILD_APK_RESUMO.md
│   ├── Resumo executivo
│   ├── 3 passos para começar
│   └── Comparação antes/depois
│
└── 📂 .github/workflows/
    ├── build-android.yml (Build principal)
    └── check-mobile.yml (Verificações rápidas)
```

---

## 🎯 Casos de Uso

### 1. Primeira Configuração
**👉 Leia:** `INICIAR_BUILD_APK.md`
- Nunca usou EAS Build
- Primeira vez com GitHub Actions
- Quer começar rápido

### 2. Build para Produção
**👉 Leia:** `CONFIGURAR_BUILD_AUTOMATICO.md` → Seção "Profiles"
- Release oficial
- APK otimizado
- Distribuição pública

### 3. Build para Testes
**👉 Leia:** `CONFIGURAR_BUILD_AUTOMATICO.md` → Seção "Preview Profile"
- Testes internos
- Build mais rápido
- Validação de funcionalidades

### 4. Problemas no Build
**👉 Leia:** `CONFIGURAR_BUILD_AUTOMATICO.md` → Seção "Troubleshooting"
- Build falhou
- Erros de autenticação
- Timeout ou outros problemas

### 5. Referência Rápida
**👉 Leia:** `BUILD_APK_RESUMO.md`
- Apenas relembrar os passos
- Verificar versões
- Ver fluxo visual

---

## 📊 Versões e Status

| Item | Versão/Status |
|------|---------------|
| **App Version** | 1.2.2 |
| **Android Version Code** | 4 |
| **Workflow Build** | ✅ Configurado |
| **Workflow Check** | ✅ Configurado |
| **Documentação** | ✅ Completa |
| **Secrets** | ⏳ Pendente configuração |

---

## ✅ Checklist de Configuração

Use este checklist para verificar se tudo está configurado:

### Pré-requisitos
- [ ] Conta criada no Expo (https://expo.dev)
- [ ] EAS CLI instalado (`npm install -g eas-cli`)
- [ ] Login feito no EAS (`eas login`)

### Configuração GitHub
- [ ] Token gerado no Expo
- [ ] Secret `EXPO_TOKEN` adicionado no GitHub
- [ ] Workflows commitados (já estão!)

### Primeiro Build
- [ ] Workflow executado (manual ou automático)
- [ ] Build completado com sucesso
- [ ] APK baixado
- [ ] APK testado em dispositivo Android

---

## 🎯 Próximos Passos

1. **Agora** (5 minutos)
   - [ ] Abra `INICIAR_BUILD_APK.md`
   - [ ] Siga o checklist de 5 passos
   - [ ] Configure o `EXPO_TOKEN`

2. **Hoje** (30 minutos de espera)
   - [ ] Dispare a primeira build
   - [ ] Aguarde o build completar (~30 min)
   - [ ] Baixe o APK gerado

3. **Esta Semana**
   - [ ] Teste o APK no celular
   - [ ] Valide todas as funcionalidades
   - [ ] Compartilhe com testadores

4. **Próximas Iterações**
   - [ ] Configure builds para iOS (opcional)
   - [ ] Adicione notificações de build
   - [ ] Configure deploy automático para Play Store

---

## 🆘 Precisa de Ajuda?

### Documentação
1. **Setup rápido:** `INICIAR_BUILD_APK.md`
2. **Referência completa:** `CONFIGURAR_BUILD_AUTOMATICO.md`
3. **Troubleshooting:** Seção no guia completo

### Links Úteis
- **Expo Dashboard:** https://expo.dev
- **EAS Build Docs:** https://docs.expo.dev/build/
- **GitHub Actions Docs:** https://docs.github.com/actions

### Workflow Files
- **Build Principal:** `.github/workflows/build-android.yml`
- **Verificações:** `.github/workflows/check-mobile.yml`

---

## 🎉 O Que Acontece Agora

Depois de configurar tudo:

✅ **Push na main** → Build automático  
✅ **Pull Request** → Verificações automáticas  
✅ **Build manual** → Sempre disponível  
✅ **APK pronto** → Em 30 minutos  
✅ **Releases** → Automáticas no GitHub  
✅ **Histórico** → Todas builds rastreadas  

---

## 📈 Melhorias Futuras

Considere implementar:

- [ ] Build para iOS
- [ ] Deploy automático para Play Store
- [ ] Notificações (Slack, Discord)
- [ ] Testes automatizados antes do build
- [ ] Múltiplos flavors (dev, staging, prod)
- [ ] Screenshots automáticos

---

## 🎊 Pronto para Começar!

**👉 Próximo passo:** Abra [`INICIAR_BUILD_APK.md`](./INICIAR_BUILD_APK.md)

Lá você encontrará o guia completo de 5 passos para fazer sua primeira build!

---

**Data de criação:** 2025-11-10  
**Versão da documentação:** 1.0  
**Configurado por:** Cursor AI Assistant  
**Status:** ✅ Pronto para uso

---

## 📝 Notas Importantes

> **🔒 Segurança:** Nunca commite tokens ou credenciais. Use apenas GitHub Secrets.

> **⏱️ Tempo:** Primeira build demora 30-40 minutos. Builds subsequentes podem ser mais rápidas.

> **💰 Custo:** EAS Build tem plano gratuito com limites. Verifique em https://expo.dev/pricing

> **📱 Dispositivos:** APK funciona em Android 5.0+ (API 21+)

---

**Boa sorte com seus builds! 🚀**

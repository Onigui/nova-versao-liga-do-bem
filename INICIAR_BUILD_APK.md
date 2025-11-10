# 🚀 Iniciar Build Automático - Guia Rápido

## ⚡ TL;DR - Setup Rápido (5 minutos)

```bash
# 1. Instalar EAS CLI
npm install -g eas-cli

# 2. Login no Expo
cd /workspace/mobile
eas login

# 3. Gerar token (copie o resultado)
# Acesse: https://expo.dev/accounts/[seu-usuario]/settings/access-tokens
# Crie um token chamado "GITHUB_ACTIONS_TOKEN"

# 4. Adicionar secret no GitHub
# GitHub Repo → Settings → Secrets → New secret
# Name: EXPO_TOKEN
# Value: [cole o token aqui]

# 5. Testar build local (opcional)
eas build --platform android --profile production

# 6. Fazer push para disparar build automático
git add .
git commit -m "feat: configuração de build automático"
git push origin main
```

## 📋 Checklist de 5 Passos

### ✅ Passo 1: Criar Conta no Expo (2 minutos)

- [ ] Acessar https://expo.dev
- [ ] Criar conta ou fazer login
- [ ] Anotar seu nome de usuário

### ✅ Passo 2: Instalar e Configurar EAS (1 minuto)

```bash
# Instalar globalmente
npm install -g eas-cli

# Verificar instalação
eas --version

# Fazer login
eas login
```

### ✅ Passo 3: Gerar Token do Expo (1 minuto)

**Opção A: Via Website (RECOMENDADO)**

1. Acesse https://expo.dev
2. Clique no seu perfil (canto superior direito)
3. **Settings** → **Access Tokens**
4. **Create Token**
   - Name: `GITHUB_ACTIONS_TOKEN`
   - Permissions: Todas marcadas
5. **Create**
6. **COPIE O TOKEN** (você só verá uma vez!)

**Opção B: Via CLI**

```bash
eas token:create
# Copie o token mostrado
```

### ✅ Passo 4: Configurar Secret no GitHub (1 minuto)

1. Acesse seu repositório no GitHub
2. **Settings** (configurações do repositório)
3. **Secrets and variables** → **Actions**
4. **New repository secret**
5. Preencha:
   - **Name:** `EXPO_TOKEN`
   - **Secret:** [cole o token do Expo]
6. **Add secret**

### ✅ Passo 5: Disparar o Build (30 segundos)

**Opção A: Build Manual (primeira vez recomendado)**

1. Vá em **Actions** no GitHub
2. Clique em **🤖 Build Android APK**
3. **Run workflow**
4. Selecione **main** branch
5. **Profile:** production
6. **Run workflow**
7. Aguarde ~30 minutos
8. Baixe o APK dos **Artifacts**

**Opção B: Build Automático (push)**

```bash
git add .
git commit -m "feat: primeira versão com build automático"
git push origin main
```

O workflow será executado automaticamente!

## 📥 Baixar o APK

Após o build completar (20-40 minutos):

### Método 1: Artifacts (Imediato)

1. GitHub → **Actions**
2. Clique no workflow executado
3. Role até o final
4. **Artifacts** → Download `liga-do-bem-botucatu-vXXX.zip`
5. Extraia o ZIP para obter o APK

### Método 2: Releases (Se foi push na main)

1. GitHub → **Releases**
2. Clique na release mais recente
3. Download `liga-do-bem-botucatu.apk`

### Método 3: Expo Dashboard

1. https://expo.dev
2. **Projects** → **liga-do-bem-botucatu**
3. **Builds**
4. Clique no build mais recente
5. **Download APK**

## 🎯 Primeira Build - Passo a Passo Visual

```
📱 VOCÊ ESTÁ AQUI
    │
    ├─► 1. Criar conta Expo (https://expo.dev)
    │       ⏱️  2 minutos
    │
    ├─► 2. Instalar EAS CLI
    │       $ npm install -g eas-cli
    │       ⏱️  1 minuto
    │
    ├─► 3. Fazer login
    │       $ eas login
    │       ⏱️  30 segundos
    │
    ├─► 4. Gerar token no Expo
    │       https://expo.dev → Settings → Access Tokens
    │       ⏱️  1 minuto
    │
    ├─► 5. Adicionar secret EXPO_TOKEN no GitHub
    │       Settings → Secrets → New secret
    │       ⏱️  1 minuto
    │
    ├─► 6. Disparar workflow (Manual ou Push)
    │       Actions → Run workflow
    │       ⏱️  30 segundos
    │
    └─► 7. Aguardar build (☕ tomar café)
            ⏱️  20-30 minutos
            │
            └─► 8. Baixar APK ✅
                    Artifacts ou Releases
```

## 🔍 Verificar Status do Build

### Durante o Build

```bash
# Ver builds em andamento
eas build:list --platform android --limit 5

# Ver status de um build específico
eas build:view [BUILD_ID]

# Ou via web
# https://expo.dev/accounts/[usuario]/projects/liga-do-bem-botucatu/builds
```

### No GitHub Actions

1. GitHub → **Actions**
2. Veja o workflow em execução
3. Clique para ver logs em tempo real
4. Cada step mostra o progresso

## ⏱️ Tempo Estimado

| Etapa | Tempo |
|-------|-------|
| Setup inicial (conta, CLI, token) | 5 minutos |
| Configurar secret no GitHub | 1 minuto |
| Disparar workflow | 30 segundos |
| **Build do APK** | **20-40 minutos** ⏳ |
| Download do APK | 1 minuto |
| **TOTAL** | **~30-45 minutos** |

💡 **Dica:** A primeira build demora mais. As próximas serão mais rápidas.

## 🎉 Quando Está Pronto?

Você saberá que o build terminou quando:

✅ O workflow no GitHub Actions mostrar ✅ verde  
✅ Aparecer um artifact `liga-do-bem-botucatu-vXXX`  
✅ (Se foi push na main) Uma release foi criada  
✅ O EAS Dashboard mostrar "Build successful"  

## 🧪 Testar o APK

1. **Baixar** o APK
2. **Transferir** para o celular Android
3. **Habilitar** instalação de fontes desconhecidas:
   - Configurações → Segurança → Fontes desconhecidas
4. **Instalar** o APK
5. **Abrir** o app
6. **Testar**:
   - Login/Cadastro
   - Lista de parceiros
   - Carteirinha digital
   - QR Code
   - Notificações

## 🔄 Builds Subsequentes

Depois da primeira build configurada, é só:

```bash
# Fazer mudanças no código
vim mobile/src/...

# Commit
git add .
git commit -m "feat: nova funcionalidade"

# Push (dispara build automático)
git push origin main
```

Ou manualmente via GitHub Actions quando quiser!

## 💡 Dicas Importantes

### ✅ Boas Práticas

- Sempre teste localmente antes de fazer push
- Incremente a versão antes de cada build pública
- Use profile `preview` para testes internos
- Use profile `production` para releases

### ⚠️ Evite

- Fazer push de código não testado
- Esquecer de incrementar `versionCode`
- Deixar logs de debug em produção
- Commitar secrets ou tokens

### 🚀 Otimizações

- Builds em pull requests só fazem verificações (não gera APK)
- Builds automáticas só na branch main
- Artifacts são mantidos por 30 dias
- Use cache para acelerar builds

## 🆘 Problemas Comuns

### "Workflow not found"

**Solução:** Faça push do arquivo `.github/workflows/build-android.yml`

### "EXPO_TOKEN not found"

**Solução:** Adicione o secret no GitHub (Settings → Secrets)

### "Build failed"

**Solução:** 
1. Veja os logs no GitHub Actions
2. Teste build local: `eas build --platform android --profile production`

### "Unable to authenticate"

**Solução:** 
1. Verifique se o token está correto
2. Gere um novo token no Expo
3. Atualize o secret no GitHub

## 📚 Próximos Passos

Depois da primeira build bem-sucedida:

1. ✅ Teste o APK no celular
2. ✅ Compartilhe com testadores
3. ✅ Configure notificações de build (opcional)
4. ✅ Automatize deploy para Play Store (futuro)

## 🎓 Recursos Adicionais

- **Documentação Completa:** `CONFIGURAR_BUILD_AUTOMATICO.md`
- **Workflow File:** `.github/workflows/build-android.yml`
- **EAS Docs:** https://docs.expo.dev/build/introduction/
- **GitHub Actions:** https://docs.github.com/en/actions

## ✅ Checklist Final

Antes de considerar configurado:

- [ ] Conta Expo criada
- [ ] EAS CLI instalado e login feito
- [ ] Token gerado no Expo
- [ ] Secret EXPO_TOKEN adicionado no GitHub
- [ ] Primeira build executada com sucesso
- [ ] APK baixado e testado
- [ ] App instala e funciona no celular

---

## 🎊 Tudo Configurado!

Se você chegou até aqui e marcou tudo, **parabéns!** 🎉

Seu build automático está funcionando!

Agora toda vez que fizer push na `main`, um novo APK será gerado automaticamente.

---

**📞 Precisa de ajuda?** Consulte `CONFIGURAR_BUILD_AUTOMATICO.md` para troubleshooting detalhado.

**🚀 Vamos fazer a primeira build?** Execute o workflow agora no GitHub Actions!

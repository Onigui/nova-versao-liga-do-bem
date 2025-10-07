# 🎯 GERAR APK - Comandos Manuais

## ✅ Projeto EAS Criado com Sucesso!

**Status:**
- ✅ Projeto criado: `@onigui/liga-do-bem-botucatu`
- ✅ Project ID: `73886b96-ebaa-4d18-b125-c8b3d53cc8ec`
- ✅ Link: https://expo.dev/accounts/onigui/projects/liga-do-bem-botucatu

---

## 🚀 PRÓXIMO PASSO: Gerar APK

### **Opção 1: Via Terminal Interativo (CMD ou Git Bash)**

Abra um **CMD** ou **Git Bash** (não PowerShell) e execute:

```bash
cd C:\Users\Onigu\OneDrive\Desktop\nova-versao-liga-do-bem\mobile
eas build --platform android --profile preview
```

**O que vai acontecer:**
1. Vai perguntar: "Generate a new Android Keystore?" → Digite **Y**
2. Vai fazer upload do código (2-3 min)
3. Vai iniciar build na nuvem (20-25 min)
4. Vai mostrar link para acompanhar
5. Quando terminar, vai mostrar link para download do APK

---

### **Opção 2: Via Interface Web do Expo**

1. **Acesse:** https://expo.dev/accounts/onigui/projects/liga-do-bem-botucatu

2. **Clique em "Builds"**

3. **Clique em "Create a build"**

4. **Escolha:**
   - Platform: **Android**
   - Build profile: **preview**

5. **Clique em "Build"**

6. **Aguarde** 20-25 minutos

7. **Baixe o APK** quando terminar

---

### **Opção 3: Via VSCode Terminal**

Se estiver usando VSCode:

1. **Abra novo terminal** (Terminal > New Terminal)
2. **Mude para CMD:** Clique na seta ao lado do "+" e escolha "Command Prompt"
3. **Execute:**
```bash
cd mobile
eas build --platform android --profile preview
```

---

## 📋 CHECKLIST PÓS-BUILD

Quando o APK estiver pronto:

### **1. Baixar APK**
- Clique no link fornecido
- Salve como: `liga-do-bem-v1.0.0.apk`

### **2. Testar no Celular**
```bash
# Via ADB (se tiver Android Studio)
adb install liga-do-bem-v1.0.0.apk

# Ou manualmente:
# - Transfira APK para o celular
# - Abra o arquivo
# - Instale
```

### **3. Disponibilizar no Site**
```bash
# Copiar APK para pasta web
mkdir ../web/downloads
copy liga-do-bem-v1.0.0.apk ../web/downloads/

# Commit e push
git add .
git commit -m "Feat: Adicionar APK v1.0.0 para download"
git push origin master
```

### **4. Atualizar Link no Site**
Edite `web/index.html` e adicione link de download:
```html
<a href="downloads/liga-do-bem-v1.0.0.apk" download>
  Download App Android
</a>
```

---

## 🎬 ALTERNATIVA: Build Via GitHub Actions

Se preferir automatizar, posso criar um workflow do GitHub Actions que:
- Faz build automaticamente a cada push
- Gera APK
- Cria release no GitHub

**Quer que eu configure?**

---

## 📱 TESTANDO O APP

Depois de instalar no celular:

### **Testes Básicos:**
1. ✅ App abre corretamente
2. ✅ Tela de login aparece
3. ✅ Consegue fazer login
4. ✅ Dashboard carrega

### **Testes de Funcionalidades:**
1. ✅ Cartão de membro (QR Code)
2. ✅ Mapa de parceiros
3. ✅ GPS e navegação
4. ✅ Notificações push
5. ✅ Buscar por CNPJ
6. ✅ Ver adoções
7. ✅ Fazer doação

---

## 🐛 SOLUÇÃO DE PROBLEMAS

### **Build falha com erro de Keystore:**
```bash
# Gerar keystore localmente
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000

# Fazer upload para EAS
eas credentials
```

### **Build falha com erro de Gradle:**
É normal, o EAS usa Java 17 automaticamente na nuvem.

### **APK muito grande:**
```bash
# Usar perfil production com compressão
eas build --platform android --profile production
```

---

## ⏱️ TEMPO ESTIMADO

- **Setup:** ✅ Já feito!
- **Comando build:** 2 minutos
- **Build na nuvem:** 20-25 minutos
- **Download APK:** 1 minuto
- **Teste:** 5 minutos
- **Publicar no site:** 5 minutos
- **TOTAL: ~35 minutos**

---

## 🎯 VOCÊ ESTÁ AQUI:

```
[✅] Código completo
[✅] Backend deployed
[✅] Frontend deployed
[✅] Admin deployed
[✅] Projeto EAS criado
[⏳] Build do APK ← VOCÊ ESTÁ AQUI
[ ] Testar APK
[ ] Publicar no site
[ ] 🎉 COMPLETO!
```

---

## 💪 PRÓXIMA AÇÃO:

**Execute em um terminal CMD:**
```bash
cd C:\Users\Onigu\OneDrive\Desktop\nova-versao-liga-do-bem\mobile
eas build --platform android --profile preview
```

**OU**

**Acesse:** https://expo.dev/accounts/onigui/projects/liga-do-bem-botucatu/builds

**E clique em "Create a build"**

---

## 📞 PRECISA DE AJUDA?

Se encontrar algum erro:
1. Copie a mensagem de erro
2. Me mostre
3. Vou te ajudar a resolver

**Você está a 25 minutos do APK pronto!** 🚀


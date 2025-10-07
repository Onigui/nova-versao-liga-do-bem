# 🚀 Gerar APK - Método Mais Simples

## ❌ Problema Atual
Seu sistema tem Java 22, mas o Gradle precisa de Java 17.

## ✅ Solução Mais Simples: EAS Build (Nuvem)

### **Por que EAS Build?**
- ✅ Não precisa instalar Java
- ✅ Build feito na nuvem
- ✅ APK pronto em 20-30 minutos
- ✅ Grátis

### **Como usar:**

1. **Criar projeto EAS (apenas 1 vez):**
```bash
cd mobile
eas init --id
```

2. **Fazer o build:**
```bash
eas build --platform android --profile preview
```

3. **Aguardar:**
- O EAS vai compilar na nuvem
- Você receberá um link para download
- Exemplo: `https://expo.dev/accounts/onigui/projects/liga-do-bem/builds/...`

4. **Baixar APK:**
- Clique no link
- Baixe o arquivo `.apk`
- Teste no seu celular

---

## 🔄 Alternativa: Usar Java 17

Se preferir fazer build local:

### **Opção A: Baixar e instalar Java 17**

1. **Download:**
   - https://adoptium.net/temurin/releases/?version=17
   - Escolha: Windows x64 MSI

2. **Instalar:**
   - Execute o instalador
   - Marque "Add to PATH"
   - Marque "Set JAVA_HOME"

3. **Verificar:**
```bash
java -version
# Deve mostrar: openjdk version "17.x.x"
```

4. **Build:**
```bash
cd mobile/android
./gradlew assembleRelease
```

### **Opção B: Usar SDKMAN (Gerenciador de Java)**

1. **Instalar SDKMAN:**
```bash
# No PowerShell
iex (new-object net.webclient).downloadstring('https://get.sdkman.io')
```

2. **Instalar Java 17:**
```bash
sdk install java 17.0.8-tem
```

3. **Usar Java 17:**
```bash
sdk use java 17.0.8-tem
```

4. **Build:**
```bash
cd mobile/android
./gradlew assembleRelease
```

---

## 🎯 Minha Recomendação

**Use EAS Build!** É muito mais simples e confiável.

### **Comandos completos:**

```bash
# 1. Ir para pasta mobile
cd mobile

# 2. Login no Expo (se não estiver logado)
npx expo login

# 3. Iniciar projeto EAS
eas init --id

# 4. Fazer build
eas build --platform android --profile preview

# 5. Aguardar (20-30 min)
# Você verá o progresso no terminal
# E receberá um link quando terminar
```

---

## 📱 Testando o APK

Depois de baixar o APK:

1. **Transferir para o celular:**
   - Via USB
   - Via WhatsApp
   - Via email
   - Via Google Drive

2. **Instalar:**
   - Abra o arquivo `.apk`
   - Autorize "Instalar de fontes desconhecidas"
   - Clique em "Instalar"

3. **Testar:**
   - Abra o app
   - Faça login
   - Teste todas as funcionalidades

---

## 🐛 Solução de Problemas

### **Erro: "eas command not found"**
```bash
npm install -g eas-cli
```

### **Erro: "Invalid UUID appId"**
```bash
# Remover projectId do app.json
# Depois executar:
eas init --id
```

### **Erro: "Project not found"**
```bash
# Criar novo projeto
eas init --id
```

---

## ⏱️ Tempo Estimado

- **EAS Build:** 5 min setup + 20-30 min build = **~35 minutos**
- **Build Local (com Java 17 já instalado):** **5 minutos**
- **Instalar Java 17 + Build:** 10 min instalação + 5 min build = **15 minutos**

---

## 💡 Dica Final

**Se você quer o APK HOJE:**
1. Use EAS Build (mais confiável)
2. Enquanto espera o build, prepare o site para o download
3. Quando o APK estiver pronto, teste e disponibilize

**Precisa de ajuda?**
- Estou aqui para te guiar em cada passo
- Posso acompanhar o processo de build
- Posso ajudar com qualquer erro que aparecer

**Pronto para começar?** 🚀


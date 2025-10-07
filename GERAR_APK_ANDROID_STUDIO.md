# 🎯 GERAR APK COM ANDROID STUDIO - Passo a Passo

## ✅ Você já tem Android Studio instalado!

Perfeito! Agora vamos gerar o APK.

---

## 📝 COMANDOS CORRETOS

### **1. Abrir PowerShell na pasta do projeto:**

**Opção A - Pelo Explorador de Arquivos (MAIS FÁCIL):**
1. Abra o Explorador de Arquivos
2. Navegue até: `C:\Users\Onigu\OneDrive\Desktop\nova-versao-liga-do-bem\mobile`
3. **Shift + Clique direito** na pasta vazia
4. Escolha "Abrir janela do PowerShell aqui" ou "Abrir no Terminal"

**Opção B - Pelo PowerShell:**
```powershell
cd C:\Users\Onigu\OneDrive\Desktop\nova-versao-liga-do-bem\mobile
```

---

### **2. Executar os comandos (UM DE CADA VEZ):**

```powershell
# 1. Gerar pasta Android
npx expo prebuild --platform android --clean

# 2. Entrar na pasta android
cd android

# 3. Fazer o build (pode demorar 5-10 minutos)
.\gradlew assembleRelease
```

**Nota:** Use `.\gradlew` com **ponto e barra** no PowerShell!

---

## 🎬 PASSO A PASSO COMPLETO

### **Passo 1: Navegar até a pasta**
```powershell
cd C:\Users\Onigu\OneDrive\Desktop\nova-versao-liga-do-bem\mobile
```

**Verificar se está na pasta correta:**
```powershell
dir
```
Deve mostrar: `App.js`, `package.json`, etc.

---

### **Passo 2: Gerar estrutura Android**
```powershell
npx expo prebuild --platform android --clean
```

**O que vai acontecer:**
- ✅ Instala dependências necessárias
- ✅ Cria pasta `android/`
- ✅ Configura o projeto
- ⏱️ Tempo: 2-3 minutos

---

### **Passo 3: Entrar na pasta Android**
```powershell
cd android
```

---

### **Passo 4: Build do APK**
```powershell
.\gradlew assembleRelease
```

**O que vai acontecer:**
- ✅ Download de dependências (primeira vez demora)
- ✅ Compila o app
- ✅ Gera o APK
- ⏱️ Tempo: 5-10 minutos (primeira vez)

---

### **Passo 5: Localizar o APK**

O APK estará em:
```
C:\Users\Onigu\OneDrive\Desktop\nova-versao-liga-do-bem\mobile\android\app\build\outputs\apk\release\app-release.apk
```

---

## ⚠️ POSSÍVEIS ERROS E SOLUÇÕES

### **Erro: "expo is not installed"**
```powershell
npm install
```

### **Erro: "Java version"**
Precisa ter Java 17 instalado:
- Download: https://adoptium.net/temurin/releases/?version=17
- Definir JAVA_HOME apontando para Java 17

### **Erro: "Android SDK not found"**
Abra o Android Studio uma vez para configurar o SDK automaticamente.

### **Erro: "gradlew: command not found"**
Use `.\gradlew` (com ponto e barra) no PowerShell.

---

## 📋 CHECKLIST

```
[ ] Naveguei até C:\Users\Onigu\...\mobile
[ ] Executei: npx expo prebuild --platform android --clean
[ ] Entrei na pasta android
[ ] Executei: .\gradlew assembleRelease
[ ] APK gerado em: android/app/build/outputs/apk/release/
```

---

## 🎯 COMANDOS COMPLETOS (COPIAR E COLAR)

```powershell
# Navegar até o projeto
cd C:\Users\Onigu\OneDrive\Desktop\nova-versao-liga-do-bem\mobile

# Gerar estrutura Android
npx expo prebuild --platform android --clean

# Entrar na pasta android
cd android

# Fazer build do APK
.\gradlew assembleRelease

# Abrir pasta onde está o APK
explorer app\build\outputs\apk\release
```

---

## 🚀 APÓS GERAR O APK

### **1. Testar no celular:**
```powershell
# Se tiver celular conectado via USB
adb install app\build\outputs\apk\release\app-release.apk
```

### **2. Copiar para o site:**
```powershell
# Voltar para a raiz do projeto
cd ..\..

# Criar pasta downloads
mkdir web\downloads

# Copiar APK
copy mobile\android\app\build\outputs\apk\release\app-release.apk web\downloads\liga-do-bem-v1.0.0.apk
```

### **3. Commit e push:**
```powershell
git add .
git commit -m "Feat: Adicionar APK v1.0.0 para download"
git push origin master
```

---

## 💡 DICAS

1. **Primeira compilação demora:** 10-15 minutos (baixa dependências)
2. **Próximas compilações:** 2-3 minutos
3. **Se der erro de memória:** Feche outros programas
4. **APK gerado tem ~50MB:** É normal

---

## ✨ PRONTO!

Depois que o APK for gerado, você terá:
- ✅ App instalável no Android
- ✅ Todas as funcionalidades funcionando
- ✅ Pronto para distribuir

---

**Vamos começar? Execute os comandos e me avise se der algum erro!** 🚀


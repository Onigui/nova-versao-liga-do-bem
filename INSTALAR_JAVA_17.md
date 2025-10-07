# 🔧 INSTALAR JAVA 17 - Solução para o Erro de Build

## ❌ Problema Identificado:

```
Error while executing process C:\Program Files\Java\jdk-22\bin\jlink.exe
```

**Você tem Java 22, mas o Gradle precisa de Java 17!**

---

## ✅ SOLUÇÃO: Instalar Java 17

### **Passo 1: Baixar Java 17**

1. **Acesse:** https://adoptium.net/temurin/releases/?version=17
2. **Escolha:**
   - **Operating System:** Windows
   - **Architecture:** x64
   - **Package Type:** JDK
   - **Version:** 17 - LTS
3. **Clique em:** `.msi` (Windows Installer)
4. **Aguarde o download**

---

### **Passo 2: Instalar Java 17**

1. **Execute o arquivo baixado** (`OpenJDK17U-jdk_x64_windows_hotspot_17.0.X.msi`)
2. **Durante a instalação:**
   - ✅ Marque: **"Add to PATH"**
   - ✅ Marque: **"Set JAVA_HOME variable"**
   - ✅ Marque: **"Associate .jar files"**
3. **Clique em "Next" e depois "Install"**
4. **Aguarde a instalação** (1-2 minutos)
5. **Clique em "Finish"**

---

### **Passo 3: Verificar Instalação**

Abra um **NOVO PowerShell** (feche o antigo) e execute:

```powershell
java -version
```

**Deve mostrar:**
```
openjdk version "17.0.X"
```

**Se ainda mostrar Java 22:**
```powershell
# Ver onde está o Java
where java

# Deve mostrar algo como:
# C:\Program Files\Eclipse Adoptium\jdk-17.X.X-hotspot\bin\java.exe
```

---

### **Passo 4: Configurar JAVA_HOME (Se necessário)**

**Se o Java 17 não for detectado automaticamente:**

1. **Abra as Variáveis de Ambiente:**
   - Pressione `Win + R`
   - Digite: `sysdm.cpl`
   - Enter
   - Clique na aba **"Avançado"**
   - Clique em **"Variáveis de Ambiente"**

2. **Editar JAVA_HOME:**
   - Em "Variáveis do sistema", encontre `JAVA_HOME`
   - Clique em **"Editar"**
   - Altere para: `C:\Program Files\Eclipse Adoptium\jdk-17.X.X-hotspot`
   - Clique em **"OK"**

3. **Editar PATH:**
   - Em "Variáveis do sistema", encontre `Path`
   - Clique em **"Editar"**
   - Remova ou mova para baixo: `C:\Program Files\Java\jdk-22\bin`
   - Adicione no topo: `%JAVA_HOME%\bin`
   - Clique em **"OK"**

4. **Aplicar mudanças:**
   - Clique em **"OK"** em todas as janelas
   - **Feche TODOS os PowerShells e CMD abertos**
   - Abra um **NOVO PowerShell**

---

### **Passo 5: Tentar Build Novamente**

```powershell
# Navegar até o projeto
cd C:\Users\Onigu\OneDrive\Desktop\nova-versao-liga-do-bem\mobile

# Limpar cache do Gradle
cd android
.\gradlew clean

# Fazer build novamente
.\gradlew assembleRelease
```

---

## 🎯 PASSO A PASSO COMPLETO

### **Resumo dos Comandos:**

```powershell
# 1. Baixar e instalar Java 17 (usar o link acima)

# 2. Fechar TODOS os terminais

# 3. Abrir NOVO PowerShell

# 4. Verificar versão
java -version

# 5. Navegar até o projeto
cd C:\Users\Onigu\OneDrive\Desktop\nova-versao-liga-do-bem\mobile\android

# 6. Limpar cache
.\gradlew clean

# 7. Fazer build
.\gradlew assembleRelease
```

---

## ⏱️ TEMPO ESTIMADO

- Download Java 17: **2 minutos**
- Instalação: **2 minutos**
- Configuração: **1 minuto**
- Build do APK: **5-10 minutos**
- **TOTAL: ~15 minutos**

---

## 🐛 SOLUÇÃO DE PROBLEMAS

### **Problema 1: Java 22 ainda aparece**
```powershell
# Ver todas as instalações de Java
dir "C:\Program Files\Java\"
dir "C:\Program Files\Eclipse Adoptium\"

# Desinstalar Java 22 (opcional)
# Vá em Painel de Controle > Programas > Desinstalar
```

### **Problema 2: Gradle ainda usa Java 22**
```powershell
# Forçar Gradle a usar Java 17
cd mobile\android
echo "org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.XX-hotspot" >> gradle.properties
```

### **Problema 3: PATH não atualiza**
```powershell
# Atualizar variáveis de ambiente sem reiniciar
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.XX-hotspot"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
```

---

## 📱 APÓS INSTALAR JAVA 17

O build vai funcionar! O APK será gerado em:
```
mobile\android\app\build\outputs\apk\release\app-release.apk
```

---

## 💡 POR QUE JAVA 17?

- ✅ **Android Gradle Plugin 8.x** requer Java 17
- ✅ **React Native** funciona melhor com Java 17
- ✅ **Gradle 8.x** é otimizado para Java 17
- ❌ **Java 22** é muito novo e causa incompatibilidades

---

## 🎯 PRÓXIMOS PASSOS

1. **Baixar Java 17** (link acima)
2. **Instalar** (marcar todas as opções)
3. **Verificar** (`java -version`)
4. **Build APK** (`.\gradlew assembleRelease`)
5. **🎉 APK PRONTO!**

---

**Depois de instalar o Java 17, me avise e vamos gerar o APK!** 🚀




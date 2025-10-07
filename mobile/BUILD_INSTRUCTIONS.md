# 📱 Instruções para Gerar o APK - Liga do Bem Botucatu

## 🎯 Status Atual

✅ **Completo:**
- App móvel configurado com todas as funcionalidades
- Firebase configurado (google-services.json)
- Backend integrado com notificações push
- Design clean e moderno
- Todas as telas implementadas

⚠️ **Pendente:**
- Build do APK (requer configuração adicional)

## 🚀 Método Recomendado: Expo EAS Build (Cloud)

### **Opção 1: Build na nuvem (Mais simples)**

1. **Criar projeto no EAS:**
   ```bash
   cd mobile
   eas init --non-interactive
   ```

2. **Fazer o build:**
   ```bash
   eas build --platform android --profile preview --non-interactive
   ```

3. **Aguardar o build** (15-30 minutos)
   - O EAS irá compilar na nuvem
   - Você receberá um link para download do APK

### **Opção 2: Build local (Requer Android Studio)**

#### **Requisitos:**
- Java JDK 17 (não 21 ou 22)
- Android Studio ou Android SDK
- Gradle

#### **Passos:**

1. **Instalar Java 17:**
   - Baixe: https://adoptium.net/temurin/releases/?version=17
   - Configure JAVA_HOME apontando para Java 17

2. **Verificar Java:**
   ```bash
   java -version
   # Deve mostrar version 17.x.x
   ```

3. **Fazer prebuild:**
   ```bash
   cd mobile
   npx expo prebuild --clean
   ```

4. **Gerar APK:**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

5. **APK estará em:**
   ```
   mobile/android/app/build/outputs/apk/release/app-release.apk
   ```

## 🔧 Método Alternativo: Expo Go (Teste Rápido)

### **Para testar sem gerar APK:**

1. **Iniciar o app:**
   ```bash
   cd mobile
   npx expo start
   ```

2. **Escanear QR code com Expo Go:**
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent
   - iOS: https://apps.apple.com/app/expo-go/id982107779

⚠️ **Limitação:** Expo Go não suporta módulos nativos como Firebase. Apenas para testes básicos.

## 🌐 Método Simplificado: APK via Web

### **Gerar APK online (sem instalar nada):**

1. **Usar Expo Snack:**
   - Acesse: https://snack.expo.dev
   - Faça upload do código
   - Clique em "Download APK"

2. **Usar App Builder Online:**
   - https://appetize.io (simulador)
   - https://appcircle.io (build online)

## 📝 Configuração Atual

**App Info:**
- Nome: Liga do Bem Botucatu
- Package: com.ligadobem.botucatu
- Versão: 1.0.0
- Firebase Project: liga-do-bem-botucatu

**Credenciais Expo:**
- Usuário: Onigui
- (senha configurada)

**Backend API:**
- URL: https://liga-do-bem-backend.onrender.com

## 🎨 Funcionalidades Implementadas

✅ **Telas:**
- Home (Dashboard)
- Cartão de Membro (QR Code)
- Parceiros (Mapa + Lista + GPS)
- Adoções
- Doações
- Notificações
- Sobre
- Buscar por CNPJ

✅ **Recursos:**
- Autenticação (Google, Facebook, Apple)
- Notificações Push (Firebase)
- Localização GPS
- Scanner QR Code
- Design responsivo
- Integração completa com backend

## 🐛 Problemas Conhecidos

### **Java Version Error:**
```
Unsupported class file major version 66
```
**Solução:** Usar Java 17 em vez de Java 21+

### **EAS Build Error:**
```
Experience with id '...' does not exist
```
**Solução:** Remover projectId do app.json e executar `eas init`

## 📞 Próximos Passos

### **Para ter o APK hoje:**

1. **Opção A - Build na nuvem (Recomendado):**
   - Execute: `eas build -p android --profile preview`
   - Aguarde 20-30 minutos
   - Baixe o APK do link fornecido

2. **Opção B - Build local:**
   - Instale Java 17
   - Execute: `cd android && ./gradlew assembleRelease`
   - APK estará em `android/app/build/outputs/apk/release/`

3. **Opção C - Ajuda externa:**
   - Envie o código para alguém com Android Studio configurado
   - Eles podem gerar o APK em 10 minutos

## 🚀 Após Gerar o APK

1. **Testar instalação:**
   ```bash
   adb install app-release.apk
   ```

2. **Disponibilizar no site:**
   - Copie o APK para `web/downloads/`
   - Atualize o link no site

3. **Teste completo:**
   - Login com Google/Facebook
   - Notificações push
   - GPS e mapa de parceiros
   - QR Code scanner

## 💡 Dicas

- **APK vs AAB:** APK é para instalação direta, AAB é para Play Store
- **Assinatura:** APK de release precisa ser assinado para produção
- **Firebase:** Notificações push funcionam apenas no APK release
- **Permissões:** Aceite as permissões de câmera e localização

## 📧 Suporte

Se precisar de ajuda:
1. Verifique os logs: `npx expo start`
2. Limpe o cache: `npx expo start --clear`
3. Reinstale dependências: `npm install`
4. Faça prebuild: `npx expo prebuild --clean`

---

**Última atualização:** 07/10/2025
**Status:** Pronto para build
**Próximo passo:** Gerar APK com EAS Build ou Android Studio


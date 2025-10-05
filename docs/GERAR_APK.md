# 📱 Como Gerar APK do App Liga do Bem

## 🚀 **Métodos Disponíveis**

### **1. ✅ Expo Go (Recomendado para Teste)**
O método mais rápido para testar o app:

#### **Passos:**
1. **Baixe o Expo Go** na Play Store ou App Store
2. **Execute o comando:**
   ```bash
   cd mobile
   npx expo start
   ```
3. **Escaneie o QR code** com o Expo Go
4. **Teste todas as funcionalidades** do app

#### **Vantagens:**
- ✅ Rápido e fácil
- ✅ Teste imediato no celular
- ✅ Hot reload para desenvolvimento
- ✅ Não precisa compilar

### **2. 🔧 EAS Build (Para APK Real)**
Para gerar um APK instalável:

#### **Configuração Inicial:**
```bash
cd mobile
npm install -g @expo/cli
npx eas build:configure
```

#### **Gerar APK:**
```bash
npx eas build --platform android --profile preview
```

#### **Vantagens:**
- ✅ APK real instalável
- ✅ Distribuição independente
- ✅ Performance otimizada
- ✅ Sem dependência do Expo Go

### **3. 📦 Build Local (Avançado)**
Para desenvolvedores experientes:

#### **Pré-requisitos:**
- Android Studio instalado
- Android SDK configurado
- Java Development Kit (JDK)

#### **Comandos:**
```bash
cd mobile
npx expo run:android
```

## 🛠️ **Resolução de Problemas**

### **Erro: "Cannot determine Expo SDK version"**
**Solução:**
```bash
cd mobile
npm install --legacy-peer-deps
npx expo install --fix
```

### **Erro: "react-native-reanimated/plugin not found"**
**Solução:**
```bash
npm install react-native-reanimated --legacy-peer-deps
```

### **Conflitos de Dependências**
**Solução:**
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## 📋 **Checklist para APK**

### **✅ Antes de Gerar:**
- [ ] Todas as dependências instaladas
- [ ] App testado no Expo Go
- [ ] Funcionalidades principais funcionando
- [ ] Design responsivo verificado
- [ ] Conexão com API testada

### **✅ Após Gerar:**
- [ ] APK instalado no dispositivo
- [ ] Login funcionando
- [ ] QR code funcionando
- [ ] Navegação entre telas
- [ ] Notificações funcionando

## 🎯 **Funcionalidades do App**

### **✅ Implementadas:**
- 🏠 **Tela Inicial** com dashboard
- 💳 **Cartão de Membro** digital com QR code
- 🏢 **Empresas Parceiras** com descontos
- 🐕 **Seção de Adoção** de animais
- 🛡️ **Voluntários** e informações
- 📅 **Eventos** da Liga do Bem
- 💰 **Doações** e transparência
- ℹ️ **Sobre Nós** e contato

### **🔧 Tecnologias:**
- **React Native** com Expo
- **React Navigation** para navegação
- **Expo Camera** para QR scanner
- **Expo Location** para GPS
- **React Native QR Code** para geração
- **Expo Linear Gradient** para design
- **Vector Icons** para ícones

## 📱 **Como Testar**

### **1. Usando Expo Go:**
```bash
cd mobile
npx expo start
# Escaneie o QR code com o app Expo Go
```

### **2. Usando Emulador Android:**
```bash
cd mobile
npx expo start --android
```

### **3. Usando Simulador iOS (Mac):**
```bash
cd mobile
npx expo start --ios
```

## 🚀 **Próximos Passos**

### **Imediato:**
1. ✅ Testar app no Expo Go
2. ✅ Verificar todas as funcionalidades
3. ✅ Ajustar design se necessário
4. ✅ Testar integração com API

### **Futuro:**
1. 🔧 Gerar APK com EAS Build
2. 📱 Distribuir para beta testers
3. 🏪 Publicar na Play Store
4. 🍎 Publicar na App Store

---

## 📞 **Suporte**

**Problemas comuns:**
- Verifique se está na pasta `mobile/`
- Execute `npm install --legacy-peer-deps`
- Use `npx expo doctor` para diagnóstico
- Consulte logs de erro para detalhes

**Status:** ✅ App funcional no Expo Go  
**Próximo:** Gerar APK definitivo

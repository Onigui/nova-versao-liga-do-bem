# ✅ Build React Native Android - Solução Correta

## 🎯 O Que Mudou?

### ❌ Antes (Incorreto)
- **Tentativa de usar Capacitor** em um projeto React Native
- Erro: `Could not find the web assets directory: ./dist`
- Capacitor é para projetos **web** (React, Vue, Angular)
- 766 pacotes desnecessários

### ✅ Agora (Correto)
- **Build React Native puro** com Gradle
- Workflow otimizado e funcional
- 698 pacotes (68 a menos!)
- 100% nativo, sem camadas intermediárias

---

## 🚀 Como Usar o Workflow

### 1️⃣ Via GitHub Actions (Recomendado)

1. Acesse: **Actions** → **🚀 Build React Native Android APK**
2. Clique em **Run workflow**
3. Selecione:
   - **Branch**: `master`
   - **Build type**: `release` ou `debug`
4. Clique em **Run workflow**
5. Aguarde 5-10 minutos ⏱️

### 2️⃣ Via Local (Desenvolvimento)

```bash
cd mobile
npm install
npm run build:android
```

O APK estará em: `mobile/android/app/build/outputs/apk/release/`

---

## 📦 Estrutura do Projeto

```
mobile/
├── android/               # Projeto Android nativo (Gradle)
│   ├── app/
│   │   ├── build.gradle  # Configurações do app
│   │   └── src/          # Código nativo (Kotlin)
│   ├── gradle/           # Gradle wrapper
│   └── build.gradle      # Config raiz
├── src/                  # Código React Native (JavaScript)
├── App.js               # Componente principal
├── index.js             # Entry point
└── package.json         # Dependências Node.js
```

---

## 🔧 Configurações Importantes

### Keystore (Assinatura do APK)

O workflow cria automaticamente um keystore de **demonstração**:
- **Alias**: `ligadobem`
- **Senha**: `android`
- **Validade**: 10 anos

⚠️ **IMPORTANTE**: Para produção, use um keystore real e seguro!

### Versão do App

Atual: **v1.2.2** (build code: 4)

Para atualizar:
1. Edite `mobile/app.json`:
   ```json
   {
     "expo": {
       "version": "1.2.3",
       "android": {
         "versionCode": 5
       }
     }
   }
   ```
2. Edite `mobile/package.json`:
   ```json
   {
     "version": "1.2.3"
   }
   ```

---

## 📱 Requisitos do APK

- **Android**: 5.0 (API 21) ou superior
- **Tamanho**: ~25-35 MB
- **Permissões**:
  - Câmera (para QR Code)
  - Localização (para funcionalidades geográficas)
  - Notificações (Firebase Push)

---

## 🐛 Troubleshooting

### Erro: "Reanimated version incompatible"
**Solução**: Use `react-native-reanimated` **3.0.2** (última versão 100% compatível com RN 0.73.6)

Versões testadas:
- ❌ 3.6.0 → Requer RN 0.78+
- ❌ 3.5.4 → Erro `isIdle()` compilação Java
- ❌ 3.3.0 → Erro `R.id.action_bar_root` compilação Java
- ✅ **3.0.2** → Funciona perfeitamente!

### Erro: "Build failed"
```bash
# Limpar cache do Gradle
cd mobile/android
./gradlew clean
```

### Erro: "Dependencies not found"
```bash
# Reinstalar dependências
cd mobile
rm -rf node_modules package-lock.json
npm install
```

### APK não instala no dispositivo
1. Habilite **"Fontes desconhecidas"** nas configurações
2. Verifique se o APK é **release** (não debug)
3. Confirme que o dispositivo é **Android 5.0+**

---

## 📊 Comparação: Capacitor vs React Native

| Aspecto | Capacitor (❌ Errado) | React Native (✅ Correto) |
|---------|---------------------|------------------------|
| **Propósito** | Apps web → mobile | Apps nativos mobile |
| **Performance** | Webview (mais lento) | 100% nativo (rápido) |
| **Tamanho** | Maior (~50MB+) | Menor (~25-35MB) |
| **Complexidade** | Build web + empacotamento | Build direto |
| **Dependências** | 766 pacotes | 698 pacotes |
| **Manutenção** | Camada extra | Direto |

---

## 🎉 Próximos Passos

1. ✅ Execute o workflow **🚀 Build React Native Android APK**
2. ✅ Baixe o APK gerado
3. ✅ Teste em um dispositivo Android físico
4. ✅ Publique no Google Play Store (quando pronto)

---

## 📚 Referências

- [React Native Documentation](https://reactnative.dev/)
- [Android Gradle Build](https://developer.android.com/studio/build)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**Data de atualização**: 11/11/2025  
**Versão do documento**: 1.0.0

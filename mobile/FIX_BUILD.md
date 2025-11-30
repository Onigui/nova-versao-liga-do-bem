# Correção do Erro de Build - react-native-svg

## Problema
O build do Android está falhando com erros de compilação Java relacionados ao `react-native-svg`:
- `Dynamic cannot be converted to float`
- `translation is not public`
- `rotationDegrees is not public`
- `scale is not public`
- `perspective is not public`

## Solução Aplicada
1. **Versão do react-native-svg atualizada**: Alterado de `^15.8.0` para `15.2.0` (versão estável compatível com React Native 0.74.5)

## Passos para Resolver

### 1. Limpar o cache do npm/node_modules
```bash
cd mobile
rm -rf node_modules
rm -rf package-lock.json
npm install
```

### 2. Limpar o cache do Gradle e build do Android
```bash
cd android
./gradlew clean
cd ..
```

No Windows (PowerShell):
```powershell
cd android
.\gradlew.bat clean
cd ..
```

### 3. Limpar o cache do Metro Bundler
```bash
npm start -- --reset-cache
```

### 4. Rebuild do Android
```bash
cd android
./gradlew assembleDebug
```

Ou no Windows:
```powershell
cd android
.\gradlew.bat assembleDebug
```

## Se o problema persistir

### Alternativa 1: Atualizar para versão mais recente
Se a versão 15.2.0 ainda tiver problemas, tente:
```bash
npm install react-native-svg@latest
```

### Alternativa 2: Verificar compatibilidade
Verifique se há uma versão específica recomendada para React Native 0.74.5:
- Consulte: https://github.com/software-mansion/react-native-svg/releases
- Verifique issues relacionadas ao React Native 0.74

### Alternativa 3: Limpar tudo e começar do zero
```bash
cd mobile
rm -rf node_modules
rm -rf android/build
rm -rf android/app/build
rm -rf android/.gradle
npm install
cd android
./gradlew clean
```

## Notas
- A versão 15.2.0 do react-native-svg é conhecida por funcionar bem com React Native 0.74.x
- Se você estiver usando `react-native-qrcode-svg`, certifique-se de que ele também é compatível
- Sempre limpe o cache após alterar versões de dependências nativas


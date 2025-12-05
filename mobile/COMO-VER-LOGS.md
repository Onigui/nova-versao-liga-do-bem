# 📱 Como Verificar Logs do App no Celular

Existem várias formas de ver os logs do aplicativo React Native instalado no celular:

## 🎯 Método 1: React Native Log (Mais Simples)

### Android:
```bash
# No terminal, na pasta do projeto mobile
cd mobile
npx react-native log-android
```

Isso mostrará todos os logs do app em tempo real, incluindo:
- `console.log()`
- `console.error()`
- Erros do React Native
- Logs do sistema Android

### iOS:
```bash
npx react-native log-ios
```

## 🎯 Método 2: Android Logcat (Android)

Se você tem o Android SDK instalado:

```bash
# Ver todos os logs do dispositivo
adb logcat

# Ver apenas logs do seu app
adb logcat | grep -i "ReactNativeJS"

# Ver logs com filtro específico
adb logcat | grep -E "Liga|Configurações|Logo"
```

## 🎯 Método 3: Chrome DevTools (Modo Debug)

1. **Conecte o celular via USB** ou na mesma rede Wi-Fi
2. **Abra o app** no celular
3. **Agite o celular** (shake gesture) ou pressione `Ctrl+M` (Android) / `Cmd+D` (iOS)
4. Selecione **"Debug"** ou **"Open Debugger"**
5. Isso abrirá o Chrome DevTools no computador
6. Vá na aba **"Console"** para ver os logs

### Para habilitar o menu de debug:
- **Android**: Agite o celular ou `adb shell input keyevent 82`
- **iOS**: Agite o celular ou `Cmd+D` no simulador

## 🎯 Método 4: Flipper (Recomendado para Desenvolvimento)

O Flipper é uma ferramenta visual muito útil:

1. Instale o Flipper: https://fbflipper.com/
2. Conecte o celular
3. Abra o app
4. Os logs aparecerão no Flipper em tempo real

## 🎯 Método 5: Logs no Terminal do Metro Bundler

Se você estiver rodando o Metro Bundler (`npm start`), os logs também aparecem lá:

```bash
cd mobile
npm start
```

## 🔍 O que procurar nos logs:

Quando você abrir o app, procure por estas mensagens:

```
🔄 Carregando configurações do app de: https://...
📡 Resposta do servidor: 200 OK
✅ Configurações recebidas: {...}
📝 Configurações aplicadas: {...}
🖼️ Logo URL: Configurado
✅ Logo carregado com sucesso: https://...
```

Ou mensagens de erro:
```
❌ Erro ao carregar configurações do app: ...
❌ Erro ao carregar logo da API: ...
```

## 💡 Dica Rápida

A forma mais simples é usar o **React Native Log**:

```bash
cd mobile
npx react-native log-android
```

Deixe esse comando rodando e abra o app no celular. Todos os logs aparecerão em tempo real!

## 📝 Adicionar mais logs

Se quiser adicionar mais logs para debug, você pode usar:

```javascript
console.log('🔍 Minha mensagem de debug:', variavel);
console.error('❌ Erro:', erro);
console.warn('⚠️ Aviso:', aviso);
```

Esses logs aparecerão em todos os métodos acima.


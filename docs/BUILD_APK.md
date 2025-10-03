# 📱 Build do APK - Liga do Bem

## ✅ Status Atual
- ✅ Backend API: https://nova-versao-liga-do-bem-api.onrender.com
- ✅ Frontend Web: https://nova-versao-liga-do-bem-web.onrender.com
- ✅ Mobile App: Configurado para conectar com a API

## 🚀 Build do APK

### Opção 1: Build Local (Recomendado)

```bash
# 1. Instalar Expo CLI globalmente (se ainda não tiver)
npm install -g @expo/cli

# 2. Navegar para o diretório mobile
cd mobile

# 3. Instalar dependências
npm install

# 4. Fazer login no Expo
expo login

# 5. Build do APK
expo build:android --type apk
```

### Opção 2: EAS Build (Mais Moderno)

```bash
# 1. Instalar EAS CLI
npm install -g @expo/eas-cli

# 2. Login no Expo
eas login

# 3. Configurar EAS
eas build:configure

# 4. Build do APK
eas build --platform android --profile preview
```

## 📋 Configurações Importantes

### Package Name
- **iOS**: `com.novaversao.ligadobem.app`
- **Android**: `com.novaversao.ligadobem.app`

### API URL
- **Produção**: `https://nova-versao-liga-do-bem-api.onrender.com`
- **Desenvolvimento**: `http://localhost:3001`

## 🧪 Teste do APK

### 1. Download
- O APK será gerado e você receberá um link para download
- Baixe o arquivo `.apk`

### 2. Instalação no Android
```bash
# Habilitar instalação de fontes desconhecidas
# Configurações > Segurança > Fontes Desconhecidas

# Instalar via ADB (opcional)
adb install app-release.apk
```

### 3. Testes Essenciais
- ✅ Login/Registro
- ✅ Carteirinha digital
- ✅ QR Code scanner
- ✅ Lista de parceiros
- ✅ Galeria de animais
- ✅ Sistema de doações
- ✅ Notificações push

## 🔧 Troubleshooting

### Erro: "Expo CLI not found"
```bash
npm install -g @expo/cli
```

### Erro: "Not logged in"
```bash
expo login
# Digite suas credenciais do Expo
```

### Erro: "Build failed"
```bash
# Limpar cache
expo r -c

# Verificar dependências
npm install

# Tentar novamente
expo build:android --type apk
```

### Erro: "API connection failed"
```bash
# Verificar se a API está funcionando
curl https://nova-versao-liga-do-bem-api.onrender.com/health

# Verificar URL no código
# mobile/src/services/api.ts
```

## 📊 Monitoramento

### Logs do App
```bash
# Ver logs em tempo real
expo logs

# Logs específicos do build
expo build:status
```

### API Health Check
```bash
curl https://nova-versao-liga-do-bem-api.onrender.com/health
```

## 🎯 Próximos Passos

### 1. ✅ Build do APK
- Gerar APK para teste
- Instalar no celular
- Testar todas as funcionalidades

### 2. 🔄 Melhorias (Opcional)
- Configurar Firebase para notificações
- Adicionar Google Maps
- Implementar OAuth (Google/Facebook)
- Configurar sistema de pagamentos

### 3. 📱 Deploy na Play Store (Futuro)
- Criar conta de desenvolvedor Google Play
- Gerar APK assinado
- Submeter para revisão

## 🆘 Suporte

Se encontrar problemas:
1. Verifique os logs do build
2. Teste a API primeiro
3. Verifique as configurações do Expo
4. Consulte a documentação oficial

---

**🎉 Sua plataforma Liga do Bem está 95% completa!**

**URLs Finais:**
- 🌐 Website: https://nova-versao-liga-do-bem-web.onrender.com
- ⚙️ API: https://nova-versao-liga-do-bem-api.onrender.com
- 📱 Mobile: APK para teste

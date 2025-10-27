# 📱 Gerar Novo APK - v1.2.0

## ✅ Correções Aplicadas

1. **PartnersScreen** - Corrigido erro ao carregar parceiros da API
2. **MembershipCardScreen** - Removido QRCode que causava crash, substituído por placeholder

## 🚀 Como Gerar o APK

### Opção 1: EAS Build (Recomendado)

```bash
# 1. Navegar para o diretório mobile
cd mobile

# 2. Instalar EAS CLI (se ainda não tiver)
npm install -g eas-cli

# 3. Login no Expo
eas login

# 4. Gerar APK de preview (mais rápido)
eas build --platform android --profile preview

# Ou gerar APK de produção
eas build --platform android --profile production
```

### Opção 2: Build Local com Android Studio

```bash
# 1. Navegar para o diretório mobile
cd mobile

# 2. Instalar dependências
npm install

# 3. Build local
npx expo prebuild --clean

# 4. Abrir Android Studio
npx open android

# 5. No Android Studio, Build > Generate Signed Bundle / APK
```

### Opção 3: Expo Build Service (Antiga)

```bash
# 1. Navegar para o diretório mobile
cd mobile

# 2. Instalar Expo CLI
npm install -g @expo/cli

# 3. Login
npx expo login

# 4. Build
npx expo build:android -t apk
```

## 📋 Informações do APK

- **Versão:** 1.2.0
- **API Backend:** https://nova-versao-liga-do-bem.onrender.com
- **Banco de Dados:** Supabase PostgreSQL
- **Changelog:**
  - ✅ Corrigido carregamento de parceiros da API
  - ✅ Corrigido crash na tela "Meu Cartão"
  - ✅ Integração completa com banco de dados online

## ⚠️ Notas Importantes

1. **Primeira vez:** EAS CLI requer login no Expo
2. **Tempo de build:** 10-20 minutos
3. **Download:** Link será enviado por email após conclusão
4. **Testar:** Instalar no dispositivo Android e testar todas as telas

## 🧪 Testes Essenciais

Após instalar o APK, testar:

1. ✅ Login/Registro funciona?
2. ✅ Aba "Parceiros" carrega empresas?
3. ✅ Aba "Meu Cartão" não fecha o app?
4. ✅ Navegação entre abas funciona?
5. ✅ Dados vêm do banco online?




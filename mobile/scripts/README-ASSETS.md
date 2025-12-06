# 🖼️ Sistema de Assets Embarcados

Este sistema permite que o logo e o ícone do aplicativo sejam baixados durante o build do APK e embarcados diretamente no aplicativo, eliminando o delay de carregamento.

## 📋 Como Funciona

1. **Durante o Build**: O script `update-app-assets.js` é executado automaticamente pelo GitHub Actions
2. **Download**: O script busca as configurações da API (`/api/app/config`) e baixa:
   - Logo da página inicial (`app.logoUrl`) → `src/assets/images/app-logo.png`
   - Logo do login (`login.logoUrl` ou `app.logoUrl`) → `src/assets/images/login-logo.png`
   - Ícone (`login.iconImage`) → `src/assets/images/app-icon.png`
   - Configuração do ícone emoji (`login.icon`) → `src/assets/images/icon-config.json`
3. **Embarcado no APK**: Esses arquivos são incluídos no build do React Native
4. **Uso no App**: As telas verificam primeiro se os assets locais existem, usando-os instantaneamente. Se não existirem, fazem fallback para a API.

## 🎯 Vantagens

- ✅ **Carregamento instantâneo**: Sem delay ao abrir o app
- ✅ **Funciona offline**: Assets já estão no APK
- ✅ **Fallback inteligente**: Se assets não existirem, usa API
- ✅ **Atualização automática**: Cada build baixa as configurações mais recentes do admin

## 📁 Estrutura de Arquivos

```
mobile/
├── scripts/
│   ├── update-app-assets.js    # Script que baixa os assets
│   └── README-ASSETS.md         # Este arquivo
└── src/
    └── assets/
        └── images/
            ├── app-logo.png          # Logo da página inicial
            ├── login-logo.png        # Logo da tela de login
            ├── app-icon.png          # Ícone do app
            └── icon-config.json      # Configuração do ícone emoji
```

## 🔧 Configuração no Admin

1. Acesse a aba "Configurações do App" no painel admin
2. Configure:
   - **Logo da Página Inicial**: URL ou upload de imagem
   - **Logo do Login**: URL ou upload de imagem (opcional, usa logo da página inicial se não configurado)
   - **Ícone**: Emoji/texto ou imagem (URL ou upload)
3. Salve as configurações
4. Faça um novo build do APK - os assets serão atualizados automaticamente

## 🚀 Build

O script é executado automaticamente durante o build do GitHub Actions:

```yaml
- name: 🖼️ Atualizar Assets do App (Logo e Ícone)
  working-directory: ./mobile
  run: node scripts/update-app-assets.js
  env:
    API_BASE_URL: https://nova-versao-liga-do-bem.vercel.app
```

## 📱 Uso nas Telas

As telas (`HomeScreen`, `LoginScreen`, `MembershipCardScreen`) verificam automaticamente:

1. **Primeiro**: Tentam usar o asset local (se existir)
2. **Segundo**: Se não existir, fazem fetch da API
3. **Terceiro**: Se falhar, mostram texto/emoji padrão

## ⚠️ Notas Importantes

- Os assets são atualizados **apenas durante o build**
- Para ver mudanças no app, é necessário fazer um novo build do APK
- Se o script falhar, o build continua (não quebra o build)
- Os assets locais têm prioridade sobre a API

## 🐛 Troubleshooting

**Problema**: Assets não aparecem no app
- **Solução**: Verifique se o build foi executado após configurar no admin
- **Solução**: Verifique os logs do GitHub Actions para erros no script

**Problema**: Assets aparecem, mas são antigos
- **Solução**: Faça um novo build - os assets são atualizados a cada build

**Problema**: Script falha durante o build
- **Solução**: O build continua normalmente, mas usa fallback para API
- **Solução**: Verifique se a API está acessível e retornando as configurações corretas


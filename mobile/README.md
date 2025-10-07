# Liga do Bem Botucatu - App Móvel

Aplicativo móvel para Android e iOS da Liga do Bem Botucatu, desenvolvido com React Native e Expo.

## 📱 Funcionalidades

- **Dashboard**: Visão geral da plataforma e estatísticas
- **Cartão Digital**: QR Code para validação em estabelecimentos parceiros
- **Parceiros**: Lista de estabelecimentos com descontos exclusivos
- **Adoções**: Galeria de animais disponíveis para adoção
- **Doações**: Sistema de doações integrado
- **Sobre Nós**: Informações da organização

## 🛠️ Tecnologias

- **React Native**: Framework para desenvolvimento móvel
- **Expo**: Plataforma de desenvolvimento e build
- **React Navigation**: Navegação entre telas
- **Expo Linear Gradient**: Gradientes personalizados
- **React Native QR Code SVG**: Geração de QR codes
- **Expo Location**: Acesso à localização GPS
- **Expo Camera**: Scanner de QR codes
- **Expo Notifications**: Notificações push

## 🚀 Como executar

### Pré-requisitos

1. **Node.js** (versão 16 ou superior)
2. **Expo CLI**: `npm install -g @expo/cli`
3. **Conta Expo**: Crie em [expo.dev](https://expo.dev)

### Instalação

1. **Clone o repositório e navegue para a pasta mobile:**
   ```bash
   cd mobile
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Execute o projeto:**
   ```bash
   npx expo start
   ```

4. **Instale o Expo Go no seu dispositivo:**
   - [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS](https://apps.apple.com/app/expo-go/id982107779)

5. **Escaneie o QR code** que aparece no terminal ou navegador

## 📦 Gerar APK

### Método 1: Script Automatizado
```bash
node scripts/build-apk.js
```

### Método 2: Manual
```bash
# 1. Fazer login no Expo
npx expo login

# 2. Configurar o projeto
npx expo build:configure

# 3. Gerar APK
npx expo build:android --type apk
```

## 🔧 Configurações

### Firebase (Notificações Push)

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com)
2. Adicione um app Android com package name: `com.ligadobem.botucatu`
3. Baixe o arquivo `google-services.json`
4. Coloque na pasta `mobile/`
5. Configure as credenciais no `app.json`

### Google Maps

1. Obtenha uma API key no [Google Cloud Console](https://console.cloud.google.com)
2. Configure a chave no `app.json`
3. Adicione as restrições necessárias

## 📁 Estrutura do Projeto

```
mobile/
├── App.js                    # Componente principal
├── app.json                  # Configuração Expo
├── package.json              # Dependências
├── src/
│   ├── screens/             # Telas do app
│   │   ├── HomeScreen.js
│   │   ├── MembershipCardScreen.js
│   │   ├── PartnersScreen.js
│   │   ├── AdoptionsScreen.js
│   │   ├── DonationScreen.js
│   │   └── AboutScreen.js
│   ├── services/            # Serviços (API, auth)
│   ├── components/          # Componentes reutilizáveis
│   ├── navigation/          # Configuração de navegação
│   └── utils/               # Utilitários
├── assets/                  # Imagens, ícones, fontes
└── scripts/                 # Scripts de build
```

## 🎨 Design

O app segue um design clean e moderno inspirado em bancos digitais:

- **Cores principais**: Roxo (#8B5CF6), Verde (#10B981), Branco (#FFFFFF)
- **Tipografia**: Roboto (Android), SF Pro (iOS)
- **Layout**: Cards com sombras suaves, gradientes, ícones Material Design

## 📱 Funcionalidades por Tela

### HomeScreen
- Dashboard com estatísticas
- Ações rápidas
- Informações da missão

### MembershipCardScreen
- Cartão digital com QR Code
- Informações do membro
- Status da mensalidade

### PartnersScreen
- Lista de estabelecimentos parceiros
- Filtros por categoria
- Navegação GPS

### AdoptionsScreen
- Galeria de animais (em desenvolvimento)
- Filtros e busca
- Formulário de interesse

### DonationScreen
- Valores pré-definidos
- Valor personalizado
- Informações sobre transparência

### AboutScreen
- Missão e valores
- Informações de contato
- Redes sociais

## 🔗 Integração com Backend

O app se conecta com a API backend através de:

- **Base URL**: `https://liga-do-bem-backend.onrender.com/api`
- **Autenticação**: JWT + OAuth (Google, Facebook)
- **Endpoints**: Usuários, parceiros, adoções, doações, notificações

## 📋 TODO

- [ ] Implementar autenticação completa
- [ ] Adicionar scanner de QR code
- [ ] Integrar GPS para localização
- [ ] Implementar notificações push
- [ ] Adicionar galeria de animais
- [ ] Sistema de doações integrado
- [ ] Testes automatizados

## 🐛 Problemas Conhecidos

- Scanner de QR code ainda não implementado
- Autenticação em desenvolvimento
- Algumas telas mostram "Em Breve"

## 📞 Suporte

Para dúvidas ou problemas:

- **Email**: contato@ligadobem.com
- **Telefone**: (14) 99999-9999
- **Website**: https://ligadobem.com

## 📄 Licença

© 2025 Liga do Bem Botucatu. Todos os direitos reservados.

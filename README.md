# 🐾 Liga do Bem - Plataforma Completa

Plataforma completa para a ONG Liga do Bem Botucatu, incluindo aplicativo mobile, site institucional, API backend e sistema de gestão.

## 📱 Componentes da Plataforma

- **📱 Mobile App** - React Native + TypeScript (Android/iOS)
- **🌐 Website** - Next.js + TypeScript (Site institucional)
- **⚙️ Backend API** - Node.js + Express + TypeScript
- **🗄️ Database** - PostgreSQL + Prisma ORM
- **📧 Notifications** - Firebase FCM
- **🚀 Deploy** - Render.com

## 🚀 Quick Start

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- PostgreSQL 14+
- Expo CLI
- Git

### Instalação

```bash
# Clone o repositório
git clone https://github.com/Onigui/nova-versao-liga-do-bem.git
cd nova-versao-liga-do-bem

# Instalar dependências do backend
cd backend
npm install

# Instalar dependências do frontend web
cd ../web
npm install

# Instalar dependências do mobile
cd ../mobile
npm install

# Configurar banco de dados
cd ../backend
npx prisma migrate dev
npx prisma generate
```

### Executar localmente

```bash
# Backend (porta 3001)
cd backend
npm run dev

# Frontend Web (porta 3000)
cd web
npm run dev

# Mobile App
cd mobile
npm start
```

## 🏗️ Arquitetura

```
├── mobile/                 # App React Native
│   ├── src/
│   │   ├── screens/       # Telas do app
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── services/      # API calls
│   │   └── utils/         # Utilitários
│   └── package.json
│
├── web/                   # Site Next.js
│   ├── src/
│   │   ├── pages/         # Páginas do site
│   │   ├── components/    # Componentes
│   │   ├── styles/        # Estilos
│   │   └── utils/         # Utilitários
│   └── package.json
│
├── backend/               # API Node.js
│   ├── src/
│   │   ├── controllers/   # Controllers
│   │   ├── models/        # Models Prisma
│   │   ├── routes/        # Rotas da API
│   │   ├── middleware/    # Middlewares
│   │   └── utils/         # Utilitários
│   ├── prisma/            # Schema do banco
│   └── package.json
│
├── database/              # Scripts do banco
├── docker/               # Configurações Docker
├── docs/                 # Documentação
└── deploy/               # Scripts de deploy
```

## 📊 Funcionalidades

### 📱 Mobile App
- ✅ Sistema de membros com carteirinha digital
- ✅ QR Code para validação em parceiros
- ✅ Galeria de animais para adoção
- ✅ Sistema de voluntários
- ✅ Eventos e campanhas
- ✅ Doações integradas
- ✅ Transparência financeira
- ✅ Notificações push

### 🌐 Website
- ✅ Site institucional responsivo
- ✅ Formulários de contato
- ✅ Galeria de animais
- ✅ Blog de notícias
- ✅ Área de transparência
- ✅ Sistema de doações

### ⚙️ Backend API
- ✅ Autenticação JWT + OAuth
- ✅ CRUD completo de entidades
- ✅ Upload de imagens
- ✅ Sistema de notificações
- ✅ Relatórios e analytics
- ✅ Integração com pagamentos

## 🚀 Deploy

### Render.com
Veja o guia completo em [DEPLOY.md](./docs/DEPLOY.md)

### Variáveis de Ambiente
Configure as variáveis necessárias em cada ambiente:

```env
# Backend
DATABASE_URL=
JWT_SECRET=
FIREBASE_SERVER_KEY=
OAUTH_CLIENT_ID=
OAUTH_CLIENT_SECRET=

# Mobile
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

## 📱 Build APK

```bash
cd mobile
expo build:android
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📞 Suporte

- **Email**: administrativo@ligadobembotucatu.org.br
- **Telefone**: (14) 99822-5023
- **Website**: https://ligadobembotucatu.org.br

## 📄 Licença

Este projeto é propriedade da Liga do Bem Botucatu.

---

**Liga do Bem Botucatu** - Transformando vidas, uma pata de cada vez! 🐾
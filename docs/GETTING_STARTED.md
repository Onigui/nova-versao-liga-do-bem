# 🚀 Guia de Início Rápido - Liga do Bem

Este guia te ajudará a configurar e executar toda a plataforma Liga do Bem localmente.

## 📋 Pré-requisitos

- ✅ Node.js 18+
- ✅ npm ou yarn
- ✅ PostgreSQL 14+
- ✅ Git
- ✅ Expo CLI (para mobile)

## 🏗️ Estrutura do Projeto

```
nova-versao-liga-do-bem/
├── 📱 mobile/          # App React Native
├── 🌐 web/            # Site Next.js
├── ⚙️ backend/        # API Node.js
├── 🗄️ database/       # Scripts do banco
├── 🐳 docker/         # Configurações Docker
├── 📚 docs/           # Documentação
└── 🚀 scripts/        # Scripts de automação
```

## ⚡ Configuração Rápida

### 1. Clone o Repositório
```bash
git clone https://github.com/Onigui/nova-versao-liga-do-bem.git
cd nova-versao-liga-do-bem
```

### 2. Execute o Script de Configuração
```bash
# Linux/Mac
./scripts/setup-local.sh

# Windows (PowerShell)
# Execute manualmente os comandos abaixo
```

### 3. Configure o Banco de Dados

#### Opção A: PostgreSQL Local
```bash
# Instalar PostgreSQL
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql

# Windows
# Baixe do site oficial: https://www.postgresql.org/download/windows/

# Criar banco
sudo -u postgres createdb liga_do_bem_db
sudo -u postgres createuser liga_do_bem_user
sudo -u postgres psql -c "ALTER USER liga_do_bem_user PASSWORD 'liga_do_bem_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE liga_do_bem_db TO liga_do_bem_user;"
```

#### Opção B: Docker (Mais Fácil)
```bash
cd docker
docker-compose up -d postgres
```

### 4. Configure as Variáveis de Ambiente

#### Backend (`backend/.env`)
```env
DATABASE_URL="postgresql://liga_do_bem_user:liga_do_bem_password@localhost:5432/liga_do_bem_db"
JWT_SECRET="sua-chave-secreta-jwt-muito-forte"
NODE_ENV="development"
PORT=3001
FRONTEND_URL="http://localhost:3000"
MOBILE_URL="exp://localhost:19000"
```

#### Frontend Web (`web/.env.local`)
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="sua-chave-google-maps"
```

#### Mobile (`mobile/.env`)
```env
EXPO_PUBLIC_API_URL="http://localhost:3001"
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="sua-chave-google-maps"
```

### 5. Execute as Migrações do Banco
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed
```

### 6. Inicie os Serviços

#### Terminal 1: Backend
```bash
cd backend
npm run dev
```

#### Terminal 2: Frontend Web
```bash
cd web
npm run dev
```

#### Terminal 3: Mobile
```bash
cd mobile
npm start
```

## 🧪 Testando a Instalação

### 1. Backend API
```bash
curl http://localhost:3001/health
# Deve retornar: {"status":"OK","timestamp":"...","uptime":...,"environment":"development"}
```

### 2. Frontend Web
- Acesse: http://localhost:3000
- Deve carregar o site institucional

### 3. Mobile App
- Escaneie o QR code com Expo Go
- Deve carregar o app no celular

## 🐳 Usando Docker (Alternativa)

Se preferir usar Docker para tudo:

```bash
# Na raiz do projeto
docker-compose -f docker/docker-compose.yml up --build

# Isso iniciará:
# - PostgreSQL na porta 5432
# - Backend na porta 3001
# - Frontend na porta 3000
```

## 📱 Build do APK

Para gerar o APK para teste no celular:

```bash
# Linux/Mac
./scripts/build-apk.sh

# Windows (PowerShell)
cd mobile
expo build:android --type apk
```

## 🚀 Deploy no Render

Siga o guia completo em [DEPLOY_RENDER.md](./DEPLOY_RENDER.md)

## 🔧 Troubleshooting

### Problema: Erro de conexão com banco
```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql  # Linux
brew services list | grep postgres  # macOS

# Verificar conexão
psql -h localhost -U liga_do_bem_user -d liga_do_bem_db
```

### Problema: Porta já em uso
```bash
# Encontrar processo usando a porta
lsof -i :3001  # Linux/Mac
netstat -ano | findstr :3001  # Windows

# Matar processo
kill -9 [PID]  # Linux/Mac
taskkill /PID [PID] /F  # Windows
```

### Problema: Dependências não instaladas
```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Problema: Prisma não funciona
```bash
# Regenerar Prisma client
npx prisma generate
npx prisma db push
```

## 📚 Comandos Úteis

```bash
# Backend
npm run dev          # Desenvolvimento
npm run build        # Build para produção
npm run start        # Executar build
npm run test         # Executar testes
npx prisma studio    # Interface visual do banco
npx prisma migrate dev  # Criar migração
npx prisma db seed   # Popular banco com dados

# Frontend Web
npm run dev          # Desenvolvimento
npm run build        # Build para produção
npm run start        # Executar build
npm run lint         # Verificar código

# Mobile
npm start            # Iniciar Expo
expo build:android   # Build APK
expo build:ios       # Build iOS
expo publish         # Publicar atualização
```

## 🆘 Suporte

Se encontrar problemas:

1. **Verifique os logs** nos terminais
2. **Consulte a documentação** em `/docs`
3. **Verifique as issues** no GitHub
4. **Entre em contato** com a equipe

## 📞 Contato

- **Email**: administrativo@ligadobembotucatu.org.br
- **Telefone**: (14) 99822-5023
- **GitHub**: [Onigui/nova-versao-liga-do-bem](https://github.com/Onigui/nova-versao-liga-do-bem)

---

**🐾 Liga do Bem Botucatu** - Transformando vidas, uma pata de cada vez!

#!/bin/bash

# Script para configurar ambiente local da Liga do Bem
echo "🐾 Configurando ambiente local da Liga do Bem..."

# Verificar se está na raiz do projeto
if [ ! -f "README.md" ]; then
    echo "❌ Erro: Execute este script na raiz do projeto"
    exit 1
fi

# Verificar Node.js
echo "📦 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 18+ primeiro."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js versão 18+ é necessário. Versão atual: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) encontrado"

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado"
    exit 1
fi

echo "✅ npm $(npm -v) encontrado"

# Criar arquivos .env se não existirem
echo "📝 Configurando arquivos de ambiente..."

# Backend .env
if [ ! -f "backend/.env" ]; then
    echo "Criando backend/.env..."
    cp backend/env.example backend/.env
    echo "⚠️  Configure as variáveis em backend/.env"
fi

# Web .env.local
if [ ! -f "web/.env.local" ]; then
    echo "Criando web/.env.local..."
    cat > web/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
EOF
    echo "⚠️  Configure as variáveis em web/.env.local"
fi

# Mobile .env
if [ ! -f "mobile/.env" ]; then
    echo "Criando mobile/.env..."
    cat > mobile/.env << EOF
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
EOF
    echo "⚠️  Configure as variáveis em mobile/.env"
fi

# Instalar dependências do backend
echo "📦 Instalando dependências do backend..."
cd backend
npm install

# Gerar Prisma client
echo "🗄️ Configurando Prisma..."
npx prisma generate

cd ..

# Instalar dependências do frontend web
echo "📦 Instalando dependências do frontend web..."
cd web
npm install
cd ..

# Instalar dependências do mobile
echo "📦 Instalando dependências do mobile..."
cd mobile
npm install
cd ..

# Verificar Docker (opcional)
if command -v docker &> /dev/null; then
    echo "🐳 Docker encontrado. Você pode usar 'docker-compose up' para executar tudo"
else
    echo "⚠️  Docker não encontrado. Instale para usar containerização"
fi

# Verificar Expo CLI
if ! command -v expo &> /dev/null; then
    echo "📱 Instalando Expo CLI..."
    npm install -g @expo/cli
fi

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure as variáveis de ambiente nos arquivos .env"
echo "2. Configure o banco de dados PostgreSQL"
echo "3. Execute as migrações: cd backend && npx prisma migrate dev"
echo "4. Inicie o backend: cd backend && npm run dev"
echo "5. Inicie o frontend web: cd web && npm run dev"
echo "6. Inicie o mobile: cd mobile && npm start"
echo ""
echo "🔗 URLs locais:"
echo "  Backend API: http://localhost:3001"
echo "  Frontend Web: http://localhost:3000"
echo "  Mobile: Expo Dev Tools"
echo ""
echo "🐾 Liga do Bem - Ambiente configurado com sucesso!"

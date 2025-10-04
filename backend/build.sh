#!/bin/bash

echo "🚀 Iniciando build do backend Liga do Bem..."

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Gerar Prisma client
echo "🗄️ Gerando Prisma client..."
npx prisma generate

# Executar migrações
echo "🔄 Executando migrações..."
npx prisma migrate deploy

# Build TypeScript
echo "🔨 Fazendo build TypeScript..."
npm run build

# Seed do banco (apenas se necessário)
echo "🌱 Executando seed do banco..."
npx prisma db seed || echo "Seed já executado ou erro ignorado"

echo "✅ Build concluído com sucesso!"

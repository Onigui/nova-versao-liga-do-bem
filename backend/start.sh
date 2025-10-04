#!/bin/bash

echo "🚀 Iniciando servidor Liga do Bem..."

# Verificar se o build existe
if [ ! -d "dist" ]; then
    echo "❌ Build não encontrado. Executando build..."
    npm run build
fi

# Iniciar servidor
echo "🌐 Iniciando servidor na porta ${PORT:-10000}..."
npm start

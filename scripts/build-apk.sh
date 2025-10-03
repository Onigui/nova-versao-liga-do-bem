#!/bin/bash

# Script para build do APK da Liga do Bem
echo "🚀 Iniciando build do APK Liga do Bem..."

# Verificar se está no diretório correto
if [ ! -f "mobile/package.json" ]; then
    echo "❌ Erro: Execute este script na raiz do projeto"
    exit 1
fi

# Navegar para o diretório mobile
cd mobile

# Verificar se o Expo CLI está instalado
if ! command -v expo &> /dev/null; then
    echo "📦 Instalando Expo CLI..."
    npm install -g @expo/cli
fi

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Verificar se está logado no Expo
echo "🔐 Verificando login no Expo..."
if ! expo whoami &> /dev/null; then
    echo "❌ Você precisa fazer login no Expo"
    echo "Execute: expo login"
    exit 1
fi

# Build para Android
echo "🔨 Iniciando build para Android..."
expo build:android --type apk

# Verificar se o build foi bem-sucedido
if [ $? -eq 0 ]; then
    echo "✅ Build concluído com sucesso!"
    echo "📱 APK disponível em: mobile/build/app-release.apk"
    echo ""
    echo "📋 Próximos passos:"
    echo "1. Baixe o APK do link fornecido pelo Expo"
    echo "2. Instale no seu dispositivo Android"
    echo "3. Teste todas as funcionalidades"
    echo "4. Compartilhe com a equipe para testes"
else
    echo "❌ Erro no build do APK"
    echo "Verifique os logs acima para mais detalhes"
    exit 1
fi

echo "🐾 Liga do Bem - APK pronto para teste!"

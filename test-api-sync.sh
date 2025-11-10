#!/bin/bash

# Script para testar a sincronização da API

echo "🔍 Testando Sincronização da API - Liga do Bem"
echo "=============================================="
echo ""

API_URL="https://nova-versao-liga-do-bem-api.onrender.com"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Teste 1: Health Check
echo "📡 Teste 1: Health Check da API"
echo "URL: ${API_URL}/api/test"
response=$(curl -s -w "\n%{http_code}" "${API_URL}/api/test" 2>/dev/null)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ API está respondendo!${NC}"
    echo "Resposta: $body"
else
    echo -e "${RED}❌ API não está respondendo (HTTP ${http_code})${NC}"
    echo "Resposta: $body"
fi
echo ""

# Teste 2: Listar Parceiros (GET)
echo "🏢 Teste 2: Listando Parceiros"
echo "URL: ${API_URL}/api/partners"
response=$(curl -s -w "\n%{http_code}" "${API_URL}/api/partners" 2>/dev/null)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ Endpoint de parceiros está funcionando!${NC}"
    partner_count=$(echo "$body" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
    echo "Total de parceiros: ${partner_count:-0}"
else
    echo -e "${RED}❌ Erro ao listar parceiros (HTTP ${http_code})${NC}"
fi
echo ""

# Teste 3: Verificar CORS
echo "🔐 Teste 3: Verificando CORS"
cors_headers=$(curl -s -I -X OPTIONS "${API_URL}/api/partners" \
    -H "Origin: https://nova-versao-liga-do-bem-admin.onrender.com" \
    -H "Access-Control-Request-Method: GET" 2>/dev/null | grep -i "access-control")

if [ ! -z "$cors_headers" ]; then
    echo -e "${GREEN}✅ CORS configurado!${NC}"
    echo "$cors_headers"
else
    echo -e "${YELLOW}⚠️  Headers CORS não detectados${NC}"
fi
echo ""

# Teste 4: Verificar Database Connection
echo "🗄️  Teste 4: Conexão com Banco de Dados"
echo "Verificando se as tabelas existem..."
# Este teste precisa ser feito através da API
response=$(curl -s -w "\n%{http_code}" "${API_URL}/api/partners" 2>/dev/null)
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ Banco de dados conectado e operacional!${NC}"
else
    echo -e "${RED}❌ Possível problema com banco de dados${NC}"
fi
echo ""

# Resumo
echo "=============================================="
echo "📊 Resumo dos Testes"
echo "=============================================="
echo ""
echo "APIs testadas:"
echo "  - Backend API: ${API_URL}"
echo "  - Admin Site: https://nova-versao-liga-do-bem-admin.onrender.com"
echo "  - Web Site: https://nova-versao-liga-do-bem-web.onrender.com"
echo ""
echo "Próximos passos:"
echo "  1. Testar login no admin site"
echo "  2. Criar um parceiro no admin"
echo "  3. Verificar se aparece no mobile app"
echo "  4. Testar criação de membro"
echo ""
echo "Para mais detalhes, consulte: CORRECOES_SINCRONIZACAO.md"
echo ""

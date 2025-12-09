#!/usr/bin/env node

/**
 * Script para executar migrations do Prisma manualmente
 * Uso: node scripts/run-migration.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔄 Executando migrations do Prisma...\n');

try {
  // Navegar para o diretório do backend
  const backendDir = path.join(__dirname, '..');
  process.chdir(backendDir);

  // Executar prisma migrate deploy
  console.log('📦 Executando: npx prisma migrate deploy\n');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });

  console.log('\n✅ Migrations executadas com sucesso!');
} catch (error) {
  console.error('\n❌ Erro ao executar migrations:', error.message);
  process.exit(1);
}


const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando build do APK para Liga do Bem Botucatu...\n');

try {
  // Verificar se estamos na pasta correta
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json não encontrado. Execute este script na pasta mobile/');
  }

  console.log('📦 Instalando dependências...');
  execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

  console.log('🔧 Configurando Expo...');
  execSync('npx expo install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

  console.log('📱 Gerando APK...');
  console.log('⚠️  Isso pode levar alguns minutos...\n');
  
  // Gerar APK usando Expo Build
  execSync('npx expo build:android --type apk', { 
    stdio: 'inherit', 
    cwd: path.join(__dirname, '..') 
  });

  console.log('\n✅ APK gerado com sucesso!');
  console.log('📁 O arquivo APK estará disponível em:');
  console.log('   https://expo.dev/accounts/[seu-usuario]/projects/liga-do-bem-botucatu/builds');
  console.log('\n📱 Para instalar no seu dispositivo:');
  console.log('   1. Baixe o APK do link acima');
  console.log('   2. Ative "Fontes desconhecidas" nas configurações do Android');
  console.log('   3. Instale o APK');
  
} catch (error) {
  console.error('\n❌ Erro durante o build:', error.message);
  console.log('\n🔧 Soluções possíveis:');
  console.log('   1. Verifique se você tem uma conta Expo');
  console.log('   2. Execute: npx expo login');
  console.log('   3. Configure o app.json com suas credenciais');
  console.log('   4. Tente novamente');
  
  process.exit(1);
}
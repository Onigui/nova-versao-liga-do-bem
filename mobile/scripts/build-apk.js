const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando build do APK da Liga do Bem...');

try {
  // Verificar se estamos no diretório correto
  if (!fs.existsSync('App.js')) {
    console.error('❌ App.js não encontrado. Execute este script na pasta mobile/');
    process.exit(1);
  }

  console.log('📱 Configurando Expo...');
  
  // Configurar o projeto Expo
  execSync('npx expo install --fix', { stdio: 'inherit' });
  
  console.log('🔧 Configurando dependências...');
  
  // Instalar dependências específicas se necessário
  const dependencies = [
    '@react-navigation/native',
    '@react-navigation/stack',
    'react-native-screens',
    'react-native-safe-area-context'
  ];
  
  dependencies.forEach(dep => {
    try {
      execSync(`npm install ${dep}`, { stdio: 'inherit' });
    } catch (error) {
      console.warn(`⚠️  Não foi possível instalar ${dep}`);
    }
  });

  console.log('📦 Gerando bundle...');
  
  // Gerar bundle para Android
  execSync('npx expo export --platform android', { stdio: 'inherit' });
  
  console.log('✅ Build concluído!');
  console.log('📁 Arquivos gerados na pasta dist/');
  console.log('');
  console.log('📱 Para gerar APK, você pode:');
  console.log('1. Usar o Expo Application Services (EAS): npx eas build --platform android');
  console.log('2. Usar o Expo Go app para testar: npx expo start');
  console.log('3. Usar o Android Studio para compilar o bundle');
  
} catch (error) {
  console.error('❌ Erro durante o build:', error.message);
  process.exit(1);
}

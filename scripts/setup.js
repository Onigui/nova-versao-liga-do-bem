#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Configurando o projeto Liga do Bem...\n');

// Verificar se o Node.js está na versão correta
const nodeVersion = process.version;
console.log(`📦 Node.js version: ${nodeVersion}`);

// Verificar se o npm está disponível
const npmVersion = require('child_process').execSync('npm --version', { encoding: 'utf8' }).trim();
console.log(`📦 npm version: ${npmVersion}\n`);

// Criar diretórios necessários se não existirem
const directories = [
  'assets/images',
  'assets/icons',
  'src/components',
  'src/utils',
  'src/constants'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Criado diretório: ${dir}`);
  }
});

// Criar arquivo de constantes
const constantsContent = `// Constantes da aplicação Liga do Bem

export const COLORS = {
  primary: '#4CAF50',
  secondary: '#FF9800',
  accent: '#2196F3',
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#333333',
  textSecondary: '#666666',
  error: '#FF5722',
  success: '#4CAF50',
  warning: '#FF9800',
};

export const SIZES = {
  // Font sizes
  small: 12,
  medium: 14,
  large: 16,
  xlarge: 18,
  xxlarge: 24,
  
  // Spacing
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  
  // Border radius
  radius: 8,
  radiusLarge: 12,
  radiusXLarge: 16,
};

export const API_ENDPOINTS = {
  base: 'https://api.ligadobembotucatu.org.br',
  partners: '/partners',
  animals: '/animals',
  events: '/events',
  donations: '/donations',
  volunteers: '/volunteers',
};

export const ORGANIZATION_INFO = {
  name: 'Liga do Bem Botucatu',
  cnpj: '27.644.955/0001-38',
  address: 'Rua Brasílio Panhozzi, 186 - Jardim Eldorado',
  city: 'Botucatu - SP',
  phone: '(14) 99822-5023',
  email: 'administrativo@ligadobembotucatu.org.br',
};
`;

fs.writeFileSync('src/constants/index.js', constantsContent);
console.log('📄 Criado arquivo de constantes');

console.log('\n✅ Configuração concluída!');
console.log('\n📋 Próximos passos:');
console.log('1. Execute: npm install');
console.log('2. Execute: npm start');
console.log('3. Escaneie o QR code com o app Expo Go');
console.log('\n🐾 Liga do Bem - Transformando vidas, uma pata de cada vez!');

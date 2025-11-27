// Script para substituir todas as inicializações de Prisma no nível do módulo
// por getPrisma() lazy

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const routesDir = join(__dirname, '../src/routes');
const files = [
  'partners.ts',
  'auth.ts',
  'users.ts',
  'animals.ts',
  'adoptions.ts',
  'events.ts',
  'donations.ts',
  'volunteers.ts',
  'notifications.ts',
  'payments.ts',
  'transparency.ts'
];

files.forEach(file => {
  const filePath = join(routesDir, file);
  let content = readFileSync(filePath, 'utf-8');
  
  // Substituir import do PrismaClient
  if (content.includes("import { PrismaClient } from '@prisma/client';")) {
    content = content.replace(
      "import { PrismaClient } from '@prisma/client';",
      "import { getPrisma } from '../utils/prisma';"
    );
  }
  
  // Substituir const prisma = new PrismaClient();
  if (content.includes("const prisma = new PrismaClient();")) {
    content = content.replace(
      /const prisma = new PrismaClient\(\);?/g,
      ""
    );
  }
  
  // Substituir todas as referências a prisma. por getPrisma()?. 
  // Mas isso é mais complexo, melhor fazer manualmente
  
  writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ Atualizado: ${file}`);
});

console.log('✅ Todos os arquivos atualizados!');



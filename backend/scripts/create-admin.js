// Script para criar usuário admin no banco
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('🔐 Criando usuário admin...');
    
    // Verificar se já existe
    const existing = await prisma.user.findUnique({
      where: { email: 'admin@ligadobem.com' }
    });

    if (existing) {
      console.log('⚠️  Admin já existe, atualizando...');
      
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await prisma.user.update({
        where: { email: 'admin@ligadobem.com' },
        data: {
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true
        }
      });
      
      console.log('✅ Admin atualizado com sucesso!');
      return;
    }

    // Criar novo admin
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@ligadobem.com',
        name: 'Administrador',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true
      }
    });

    console.log('✅ Admin criado com sucesso!');
    console.log('Email:', admin.email);
    console.log('ID:', admin.id);
  } catch (error) {
    console.error('❌ Erro ao criar admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();


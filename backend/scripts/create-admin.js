// Script para criar usuário admin no banco
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Uso: ADMIN_EMAIL=voce@dominio.org ADMIN_PASSWORD='senha-forte' node scripts/create-admin.js
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');

async function createAdmin() {
  if (!ADMIN_EMAIL || ADMIN_PASSWORD.length < 12) {
    console.error('❌ Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres).');
    process.exit(1);
  }
  try {
    console.log('🔐 Criando usuário admin...');
    
    // Verificar se já existe
    const existing = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL }
    });

    if (existing) {
      console.log('⚠️  Admin já existe, atualizando...');
      
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
      
      await prisma.user.update({
        where: { email: ADMIN_EMAIL },
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
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
    
    const admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
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


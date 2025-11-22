// Utilitário para inicialização lazy do Prisma Client
// Evita travamento na inicialização do servidor quando DATABASE_URL não está configurada

import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient | null {
  // Se não tiver DATABASE_URL, não inicializar Prisma
  if (!process.env.DATABASE_URL) {
    return null;
  }
  
  // Inicializar apenas uma vez
  if (!prismaInstance) {
    try {
      prismaInstance = new PrismaClient({
        log: ['error', 'warn'],
      });
    } catch (error) {
      console.error('❌ Erro ao inicializar Prisma:', error);
      return null;
    }
  }
  
  return prismaInstance;
}

// Função helper para executar queries com tratamento de erro
export async function withPrisma<T>(
  callback: (prisma: PrismaClient) => Promise<T>,
  fallback: T
): Promise<T> {
  const prisma = getPrisma();
  if (!prisma) {
    return fallback;
  }
  
  try {
    return await callback(prisma);
  } catch (error: any) {
    console.error('❌ Erro ao executar query Prisma:', error?.message || error);
    return fallback;
  }
}


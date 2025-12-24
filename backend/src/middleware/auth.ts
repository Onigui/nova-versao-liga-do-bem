import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { getPrisma } from '../utils/prisma';

dotenv.config();

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}


export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Pular autenticação para requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    const token = (req as Request).headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Token de acesso necessário'
      });
    }

    // Verify token
    const JWT_SECRET = process.env.JWT_SECRET || 'liga-do-bem-secret-key';
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Check if it's a demo admin user - SKIP DATABASE
    // Aceitar tanto 'demo-admin' quanto 'admin-demo-id' para compatibilidade
    if ((decoded.userId === 'admin-demo-id' || decoded.userId === 'demo-admin') && decoded.role === 'admin') {
      console.log('✅ Usuário demo admin autenticado - SEM CONSULTA BANCO');
      console.log('📋 Token info:', { userId: decoded.userId, email: decoded.email, role: decoded.role });
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: 'ADMIN'
      };
      return next();
    }

    // For real users, try database lookup with timeout
    const prisma = getPrisma();
    if (!prisma) {
      // Se Prisma não estiver disponível e for admin@ligadobem.com, permitir acesso demo
      if (decoded.email === 'admin@ligadobem.com' && decoded.role === 'admin') {
        console.log('⚠️ Prisma não disponível, permitindo acesso demo como fallback');
        req.user = {
          id: 'admin-demo-id',
          email: decoded.email,
          role: 'ADMIN'
        };
        return next();
      }
      // Para outros usuários, rejeitar se não houver banco
      return res.status(503).json({
        error: 'Database not available',
        message: 'Unable to verify user. Database connection not configured.'
      });
    }

    try {
      // Timeout de 3 segundos para consulta no banco
      const queryPromise = prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), 3000);
      });

      const user = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (!user || !user.isActive) {
        return res.status(401).json({
          error: 'Usuário não encontrado ou inativo'
        });
      }

      req.user = user;
      next();
    } catch (dbError: any) {
      console.error('❌ Erro ao consultar banco:', dbError?.message || dbError);
      // Se der erro no banco E for admin@ligadobem.com, permitir acesso demo
      if (decoded.email === 'admin@ligadobem.com' && decoded.role === 'admin') {
        console.log('⚠️ Erro no banco, permitindo acesso demo como fallback');
        req.user = {
          id: 'admin-demo-id',
          email: decoded.email,
          role: 'ADMIN'
        };
        return next();
      }
      // Para outros usuários, retornar erro
      return res.status(503).json({
        error: 'Database connection error',
        message: 'Unable to verify user. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      error: 'Token inválido'
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuário não autenticado'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Acesso negado. Permissões insuficientes'
      });
    }

    next();
  };
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = (req as Request).headers.authorization?.replace('Bearer ', '');

    if (token) {
      const JWT_SECRET = process.env.JWT_SECRET || 'liga-do-bem-secret-key';
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      const prisma = getPrisma();
      if (prisma) {
        try {
          // Timeout de 2 segundos
          const queryPromise = prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true
            }
          });

          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 2000);
          });

          const user = await Promise.race([queryPromise, timeoutPromise]) as any;

          if (user && user.isActive) {
            req.user = user;
          }
        } catch (error) {
          // Ignorar erros e continuar sem usuário
          console.warn('⚠️ Erro ao buscar usuário em optionalAuth:', error);
        }
      }
    }

    next();
  } catch (error) {
    // Token inválido, mas continua sem usuário
    next();
  }
};

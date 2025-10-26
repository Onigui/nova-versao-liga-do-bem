import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}


export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    if (decoded.userId === 'admin-demo-id' && decoded.role === 'ADMIN') {
      console.log('✅ Usuário demo admin autenticado - SEM CONSULTA BANCO');
      req.user = {
        id: 'admin-demo-id',
        email: decoded.email,
        role: 'ADMIN'
      };
      return next();
    }

    // For real users, try database lookup
    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true
        }
      });

      if (!user || !user.isActive) {
        return res.status(401).json({
          error: 'Usuário não encontrado ou inativo'
        });
      }

      req.user = user;
      next();
    } catch (dbError) {
      console.error('❌ Erro ao consultar banco:', dbError);
      // Se der erro no banco E for admin@ligadobem.com, permitir acesso demo
      if (decoded.email === 'admin@ligadobem.com' && decoded.role === 'ADMIN') {
        console.log('⚠️ Erro no banco, permitindo acesso demo como fallback');
        req.user = {
          id: 'admin-demo-id',
          email: decoded.email,
          role: 'ADMIN'
        };
        return next();
      }
      throw dbError;
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
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true
        }
      });

      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Token inválido, mas continua sem usuário
    next();
  }
};

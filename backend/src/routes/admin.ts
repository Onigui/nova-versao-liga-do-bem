import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateToken, verifyToken } from '../utils/jwt';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Interface para dados de admin
interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Login do administrador
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email e senha são obrigatórios' 
      });
    }

    // Buscar usuário admin (em produção, isso seria uma tabela separada)
    const user = await prisma.user.findFirst({
      where: {
        email: email,
        role: 'ADMIN' // Assumindo que temos um role ADMIN
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        password: true,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({ 
        message: 'Credenciais inválidas' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Conta desativada' 
      });
    }

    // Em produção, usar bcrypt para comparar senhas
    // Por enquanto, vamos aceitar qualquer senha para admin
    if (password !== 'admin123') {
      return res.status(401).json({ 
        message: 'Credenciais inválidas' 
      });
    }

    // Gerar token JWT
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const token = generateToken(tokenPayload);

    // Retornar dados do usuário (sem senha)
    const userData: AdminUser = {
      id: user.id,
      name: user.name || 'Administrador',
      email: user.email,
      role: user.role
    };

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: userData
    });

  } catch (error) {
    console.error('Erro no login admin:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Verificar token do admin
router.get('/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    if (!user || !user.isActive || user.role !== 'ADMIN') {
      return res.status(401).json({ 
        message: 'Acesso não autorizado' 
      });
    }

    const userData: AdminUser = {
      id: user.id,
      name: user.name || 'Administrador',
      email: user.email,
      role: user.role
    };

    res.json({
      message: 'Token válido',
      user: userData
    });

  } catch (error) {
    console.error('Erro na verificação:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Logout (em produção, implementar blacklist de tokens)
router.post('/logout', (req: Request, res: Response) => {
  res.json({ 
    message: 'Logout realizado com sucesso' 
  });
});

// Dashboard - estatísticas gerais
router.get('/dashboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(401).json({ 
        message: 'Acesso não autorizado' 
      });
    }

    // Buscar estatísticas
    const [
      totalUsers,
      totalCompanies,
      totalAnimals,
      totalDonations,
      recentUsers,
      recentCompanies
    ] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.animal.count(),
      prisma.donation.count(),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true
        }
      }),
      prisma.company.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          category: true,
          status: true,
          createdAt: true
        }
      })
    ]);

    // Calcular crescimento mensal (simulado)
    const monthlyGrowth = {
      users: Math.floor(Math.random() * 20) + 5, // 5-25%
      companies: Math.floor(Math.random() * 30) + 10, // 10-40%
      donations: Math.floor(Math.random() * 40) + 15, // 15-55%
      qrScans: Math.floor(Math.random() * 50) + 20 // 20-70%
    };

    res.json({
      stats: {
        totalUsers,
        totalCompanies,
        totalAnimals,
        totalDonations,
        monthlyGrowth
      },
      recent: {
        users: recentUsers,
        companies: recentCompanies
      }
    });

  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Listar todas as empresas (para admin)
router.get('/companies', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(401).json({ 
        message: 'Acesso não autorizado' 
      });
    }

    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        partnerDiscounts: true,
        _count: {
          select: {
            partnerDiscounts: true
          }
        }
      }
    });

    res.json({
      companies: companies.map(company => ({
        id: company.id,
        name: company.name,
        category: company.category,
        status: company.status,
        discount: company.partnerDiscounts[0]?.discountPercentage || 0,
        location: company.address,
        hours: company.businessHours,
        phone: company.phone,
        email: company.email,
        createdAt: company.createdAt,
        discountCount: company._count.partnerDiscounts
      }))
    });

  } catch (error) {
    console.error('Erro ao buscar empresas:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Listar todos os membros (para admin)
router.get('/members', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(401).json({ 
        message: 'Acesso não autorizado' 
      });
    }

    const members = await prisma.user.findMany({
      where: {
        role: 'MEMBER' // Assumindo que temos roles diferentes
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            donations: true,
            partnerValidations: true
          }
        }
      }
    });

    res.json({
      members: members.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        status: member.isActive ? 'active' : 'inactive',
        points: member._count.donations * 10 + member._count.partnerValidations * 5, // Cálculo simulado
        createdAt: member.createdAt,
        donationsCount: member._count.donations,
        validationsCount: member._count.partnerValidations
      }))
    });

  } catch (error) {
    console.error('Erro ao buscar membros:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

export default router;

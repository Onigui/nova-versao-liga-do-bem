import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateToken, verifyToken } from '../utils/jwt';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Endpoint de teste para verificar se o admin está funcionando
router.get('/test', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Teste do endpoint admin iniciado...');
    
    // Teste básico de conexão
    const testUsers = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total FROM users;
    `;
    
    console.log('✅ Query básica funcionou:', testUsers);
    
    res.json({
      message: 'Admin endpoint funcionando',
      usersCount: testUsers[0]?.total || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Erro no teste admin:', error);
    res.status(500).json({
      message: 'Erro no teste admin',
      error: error.message
    });
  }
});

// Interface para dados de admin
interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Login do administrador - VERSÃO SIMPLIFICADA PARA DEMO
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Tentativa de login admin:', { email });

    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email e senha são obrigatórios' 
      });
    }

    // Para demo, aceitar credenciais específicas SEM verificar banco
    if (email === 'admin@ligadobem.com' && password === 'admin123') {
      console.log('✅ Credenciais demo aceitas - login direto sem banco');
      
      // Criar token direto sem verificar banco
      const token = generateToken({ 
        userId: 'admin-demo-id', 
        email: email, 
        role: 'ADMIN' 
      });

      console.log('✅ Token JWT gerado para admin demo');

      return res.json({
        message: 'Login realizado com sucesso (demo)',
        token,
        user: {
          id: 'admin-demo-id',
          name: 'Administrador Demo',
          email: email,
          role: 'ADMIN'
        }
      });
    }

    // Para outros usuários, tentar buscar no banco
    try {
      const users = await prisma.$queryRaw<any[]>`
        SELECT id, name, email, role, "isActive"
        FROM users 
        WHERE email = ${email}
        LIMIT 1;
      `;

      const user = users.length > 0 ? users[0] : null;

      if (!user || !user.isActive || user.role !== 'ADMIN') {
        return res.status(401).json({ 
          message: 'Credenciais inválidas' 
        });
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

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

    } catch (dbError: any) {
      console.error('❌ Erro no banco de dados:', dbError);
      
      // Se der erro no banco, permitir login demo como fallback
      if (email === 'admin@ligadobem.com' && password === 'admin123') {
        console.log('⚠️ Banco com erro, usando login demo como fallback');
        
        const token = generateToken({ 
          userId: 'admin-demo-id', 
          email: email, 
          role: 'ADMIN' 
        });

        return res.json({
          message: 'Login realizado com sucesso (modo demo)',
          token,
          user: {
            id: 'admin-demo-id',
            name: 'Administrador Demo',
            email: email,
            role: 'ADMIN'
          }
        });
      }
      
      throw dbError;
    }

  } catch (error: any) {
    console.error('❌ Erro no login admin:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error.message,
      details: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Verificar token do admin
router.get('/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
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
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Se for usuário demo admin, pular verificação no banco
    if (userId === 'admin-demo-id') {
      console.log('✅ Usuário demo admin autorizado');
    } else {
      // Verificar se é admin real no banco
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user || user.role !== 'ADMIN') {
        return res.status(401).json({ 
          message: 'Acesso não autorizado' 
        });
      }
    }

    // Buscar estatísticas
    const [
      totalUsers,
      totalPartners,
      totalAnimals,
      totalDonations,
      recentUsers,
      recentPartners
    ] = await Promise.all([
      prisma.user.count(),
      prisma.partner.count(),
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
      prisma.partner.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          category: true,
          isActive: true,
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
        totalPartners,
        totalAnimals,
        totalDonations,
        monthlyGrowth
      },
      recent: {
        users: recentUsers,
        partners: recentPartners
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
router.get('/companies', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Se for usuário demo admin, pular verificação no banco
    if (userId === 'admin-demo-id') {
      console.log('✅ Usuário demo admin autorizado');
    } else {
      // Verificar se é admin real no banco
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user || user.role !== 'ADMIN') {
        return res.status(401).json({ 
          message: 'Acesso não autorizado' 
        });
      }
    }

    const companies = await prisma.partner.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        discounts: true,
        _count: {
          select: {
            discounts: true
          }
        }
      }
    });

    res.json({
      companies: companies.map(company => ({
        id: company.id,
        name: company.name,
        category: company.category,
        status: company.isActive ? 'active' : 'inactive',
        discount: company.discounts[0]?.percentage || 0,
        location: company.address,
        phone: company.phone,
        email: company.email,
        createdAt: company.createdAt,
        discountCount: company._count.discounts
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
router.get('/members', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Se for usuário demo admin, pular verificação no banco
    if (userId === 'admin-demo-id') {
      console.log('✅ Usuário demo admin autorizado');
    } else {
      // Verificar se é admin real no banco
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user || user.role !== 'ADMIN') {
        return res.status(401).json({ 
          message: 'Acesso não autorizado' 
        });
      }
    }

    const members = await prisma.user.findMany({
      where: {
        role: 'MEMBER'
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

// Listar todas as empresas (para admin) - BUSCAR DO BANCO
router.get('/companies', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Se for usuário demo admin, pular verificação no banco
    if (userId === 'admin-demo-id') {
      console.log('✅ Usuário demo admin autorizado');
    } else {
      // Verificar se é admin real no banco
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user || user.role !== 'ADMIN') {
        return res.status(401).json({ 
          message: 'Acesso não autorizado' 
        });
      }
    }

    // Buscar todas as empresas do banco (incluindo pendentes e inativas)
    const partners = await prisma.partner.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        category: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        description: true,
        website: true,
        logo: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Converter para formato esperado pelo admin
    const companies = partners.map(partner => ({
      id: partner.id,
      name: partner.name,
      category: partner.category,
      status: partner.isActive ? 'active' : 'inactive',
      discount: 15, // Valor padrão - pode ser implementado depois
      location: `${partner.city}, ${partner.state}`,
      phone: partner.phone || 'N/A',
      email: partner.email || 'N/A',
      address: partner.address,
      createdAt: partner.createdAt
    }));

    console.log('✅ Empresas carregadas do banco:', companies.length);

    res.json({
      companies: companies,
      total: companies.length
    });

  } catch (error) {
    console.error('Erro ao buscar empresas:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// PUT /api/admin/companies/:id - Editar empresa
router.put('/companies/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Verificar se é admin
    if (user.role !== 'ADMIN') {
      return res.status(401).json({ 
        message: 'Acesso não autorizado' 
      });
    }

    const { id } = req.params;
    const {
      name,
      category,
      description,
      email,
      phone,
      website,
      logo,
      address,
      city,
      state,
      zipCode,
      latitude,
      longitude
    } = req.body;

    console.log('📝 Editando empresa:', id, req.body);

    // Atualizar empresa
    const updatedPartner = await prisma.partner.update({
      where: { id },
      data: {
        name,
        category,
        description,
        email,
        phone,
        website,
        logo,
        address,
        city,
        state,
        zipCode,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        updatedAt: new Date()
      }
    });

    console.log('✅ Empresa editada com sucesso:', updatedPartner.id);

    res.json({
      message: 'Empresa atualizada com sucesso',
      company: {
        id: updatedPartner.id,
        name: updatedPartner.name,
        category: updatedPartner.category,
        status: updatedPartner.isActive ? 'active' : 'inactive',
        location: `${updatedPartner.city}, ${updatedPartner.state}`,
        phone: updatedPartner.phone || 'N/A',
        email: updatedPartner.email || 'N/A',
        address: updatedPartner.address
      }
    });

  } catch (error: any) {
    console.error('Erro ao editar empresa:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        message: 'Empresa não encontrada' 
      });
    }
    
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// PATCH /api/admin/companies/:id/approve - Aprovar empresa
router.patch('/companies/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Verificar se é admin
    if (user.role !== 'ADMIN') {
      return res.status(401).json({ 
        message: 'Acesso não autorizado' 
      });
    }

    const { id } = req.params;

    console.log('✅ Aprovando empresa:', id);

    // Ativar empresa
    const approvedPartner = await prisma.partner.update({
      where: { id },
      data: {
        isActive: true,
        updatedAt: new Date()
      }
    });

    console.log('✅ Empresa aprovada com sucesso:', approvedPartner.id);

    res.json({
      message: 'Empresa aprovada com sucesso',
      company: {
        id: approvedPartner.id,
        name: approvedPartner.name,
        status: 'active'
      }
    });

  } catch (error: any) {
    console.error('Erro ao aprovar empresa:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        message: 'Empresa não encontrada' 
      });
    }
    
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// PATCH /api/admin/companies/:id/reject - Rejeitar empresa
router.patch('/companies/:id/reject', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Verificar se é admin
    if (user.role !== 'ADMIN') {
      return res.status(401).json({ 
        message: 'Acesso não autorizado' 
      });
    }

    const { id } = req.params;

    console.log('❌ Rejeitando empresa:', id);

    // Desativar empresa
    const rejectedPartner = await prisma.partner.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    console.log('✅ Empresa rejeitada com sucesso:', rejectedPartner.id);

    res.json({
      message: 'Empresa rejeitada com sucesso',
      company: {
        id: rejectedPartner.id,
        name: rejectedPartner.name,
        status: 'inactive'
      }
    });

  } catch (error: any) {
    console.error('Erro ao rejeitar empresa:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        message: 'Empresa não encontrada' 
      });
    }
    
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// DELETE /api/admin/companies/:id - Excluir empresa
router.delete('/companies/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Verificar se é admin
    if (user.role !== 'ADMIN') {
      return res.status(401).json({ 
        message: 'Acesso não autorizado' 
      });
    }

    const { id } = req.params;

    console.log('🗑️ Excluindo empresa:', id);

    // Excluir empresa
    await prisma.partner.delete({
      where: { id }
    });

    console.log('✅ Empresa excluída com sucesso:', id);

    res.json({
      message: 'Empresa excluída com sucesso',
      id
    });

  } catch (error: any) {
    console.error('Erro ao excluir empresa:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        message: 'Empresa não encontrada' 
      });
    }
    
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// POST /api/admin/companies - Criar empresa
router.post('/companies', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Verificar se é admin
    if (user.role !== 'ADMIN') {
      return res.status(401).json({ 
        message: 'Acesso não autorizado' 
      });
    }

    const {
      name,
      category,
      description,
      email,
      phone,
      website,
      logo,
      address,
      city,
      state,
      zipCode,
      latitude,
      longitude
    } = req.body;

    // Validação básica
    if (!name || !category || !address || !city || !state || !zipCode) {
      return res.status(400).json({ 
        message: 'Campos obrigatórios: name, category, address, city, state, zipCode' 
      });
    }

    console.log('➕ Criando nova empresa:', name);

    // Criar empresa
    const newPartner = await prisma.partner.create({
      data: {
        name,
        category,
        description,
        email,
        phone,
        website,
        logo,
        address,
        city,
        state,
        zipCode,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        isActive: false, // Criada como inativa, precisa ser aprovada
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Empresa criada com sucesso:', newPartner.id);

    res.status(201).json({
      message: 'Empresa criada com sucesso (aguardando aprovação)',
      company: {
        id: newPartner.id,
        name: newPartner.name,
        category: newPartner.category,
        status: 'inactive',
        location: `${newPartner.city}, ${newPartner.state}`,
        phone: newPartner.phone || 'N/A',
        email: newPartner.email || 'N/A',
        address: newPartner.address
      }
    });

  } catch (error) {
    console.error('Erro ao criar empresa:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

export default router;

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
    const demoPasswords = ['admin123', 'demo123'];
    if (email === 'admin@ligadobem.com' && demoPasswords.includes(password)) {
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

    // Para outros usuários, REJEITAR se não for credencial demo
    return res.status(401).json({ 
      message: 'Credenciais inválidas. Use: admin@ligadobem.com / admin123' 
    });

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
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true }
        });

        if (!user || user.role !== 'ADMIN') {
          return res.status(401).json({ 
            message: 'Acesso não autorizado' 
          });
        }
      } catch (userError) {
        console.error('⚠️ Erro ao verificar usuário:', userError);
        // Permitir acesso para demo mesmo com erro no banco
      }
    }

    // Buscar estatísticas (apenas tabelas que existem)
    let totalUsers = 0;
    let totalPartners = 0;
    let recentUsers = [];
    let recentPartners = [];

    try {
      const results = await Promise.all([
        prisma.user.count(),
        prisma.partner.count(),
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

      totalUsers = results[0];
      totalPartners = results[1];
      recentUsers = results[2];
      recentPartners = results[3];
    } catch (dbError) {
      console.error('⚠️ Erro ao buscar dados no dashboard:', dbError);
      // Usar valores padrão (0 e arrays vazios)
    }

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
        totalMembers: totalUsers, // Alias para compatibilidade com frontend
        totalPartners,
        activePartners: totalPartners, // Alias para compatibilidade
        totalAdoptions: 0,
        totalAnimals: 0,
        totalDonations: 0,
        monthlyRevenue: 0,
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
    console.log('✅ Usuário autenticado:', userId);

    // Tentar buscar empresas do banco, se der erro, retornar array vazio
    let companies = [];
    try {
      companies = await prisma.partner.findMany({
        orderBy: { createdAt: 'desc' }
      });
      console.log(`✅ Total de empresas encontradas no banco: ${companies.length}`);
      if (companies.length > 0) {
        console.log('📋 Primeira empresa:', companies[0]);
      }
    } catch (dbError) {
      console.error('⚠️ Erro ao buscar empresas no banco:', dbError);
      companies = []; // Retorna array vazio se der erro
    }

    console.log(`📊 Enviando ${companies.length} empresas para o frontend`);
    const mappedCompanies = companies.map(company => {
      const mapped = {
        id: company.id,
        name: company.name,
        category: company.category || 'N/A',
        status: company.isActive ? 'active' : 'inactive',
        discount: 0,
        location: company.city && company.state ? `${company.city}, ${company.state}` : company.address || 'N/A',
        address: company.address,
        city: company.city,
        state: company.state,
        hours: 'Seg-Sex: 9h-18h',
        phone: company.phone,
        email: company.email,
        createdAt: company.createdAt,
        discountCount: 0
      };
      console.log('📌 Empresa mapeada:', mapped.name, mapped.location);
      return mapped;
    });
    
    res.json({
      companies: mappedCompanies
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
    console.log('✅ Usuário autenticado:', userId);

    // Tentar buscar membros do banco, se der erro, retornar array vazio
    let members = [];
    try {
      members = await prisma.user.findMany({
        where: {
          role: {
            equals: 'MEMBER'
          }
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true
        }
      });
    } catch (dbError) {
      console.error('⚠️ Erro ao buscar membros no banco:', dbError);
      members = []; // Retorna array vazio se der erro
    }

    res.json({
      members: members.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        status: member.isActive ? 'active' : 'inactive',
        points: 0,
        createdAt: member.createdAt,
        donationsCount: 0,
        validationsCount: 0
      }))
    });

  } catch (error) {
    console.error('Erro ao buscar membros:', error);
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

// PUT /api/admin/members/:id - Editar membro
router.put('/members/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Verificar se é admin
    if (user.role !== 'ADMIN') {
      return res.status(401).json({ 
        message: 'Acesso não autorizado' 
      });
    }

    const { id } = req.params;
    const { name, email, phone, status } = req.body;

    console.log('📝 Editando membro:', id, req.body);

    // Atualizar membro
    const updatedMember = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        isActive: status === 'active',
        updatedAt: new Date()
      }
    });

    console.log('✅ Membro editado com sucesso:', updatedMember.id);

    res.json({
      message: 'Membro atualizado com sucesso',
      member: {
        id: updatedMember.id,
        name: updatedMember.name,
        email: updatedMember.email,
        phone: updatedMember.phone,
        status: updatedMember.isActive ? 'active' : 'inactive'
      }
    });

  } catch (error: any) {
    console.error('Erro ao editar membro:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        message: 'Membro não encontrado' 
      });
    }
    
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// DELETE /api/admin/members/:id - Excluir membro
router.delete('/members/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Verificar se é admin
    if (user.role !== 'ADMIN') {
      return res.status(401).json({ 
        message: 'Acesso não autorizado' 
      });
    }

    const { id } = req.params;

    console.log('🗑️ Excluindo membro:', id);

    // Excluir membro
    await prisma.user.delete({
      where: { id }
    });

    console.log('✅ Membro excluído com sucesso:', id);

    res.json({
      message: 'Membro excluído com sucesso',
      id
    });

  } catch (error: any) {
    console.error('Erro ao excluir membro:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        message: 'Membro não encontrado' 
      });
    }
    
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

export default router;

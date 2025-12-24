import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { getPrisma } from '../utils/prisma';
import { generateToken, verifyToken } from '../utils/jwt';
import { authenticate } from '../middleware/auth';

// Configurar multer para upload de APKs
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Criar pasta uploads/apks se não existir
    const uploadsDir = path.resolve(__dirname, '../../uploads/apks');
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      cb(error as Error, uploadsDir);
    }
  },
  filename: (req, file, cb) => {
    // Nome do arquivo: liga-do-bem-v{version}.apk
    const version = req.body.version || 'latest';
    const timestamp = Date.now();
    const filename = `liga-do-bem-v${version}-${timestamp}.apk`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas arquivos .apk
    if (file.mimetype === 'application/vnd.android.package-archive' || 
        file.originalname.toLowerCase().endsWith('.apk')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos APK são permitidos'));
    }
  }
});

const router = Router();

// Endpoint de teste para verificar se o admin está funcionando
router.get('/test', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Teste do endpoint admin iniciado...');
    
    const prisma = getPrisma();
    if (!prisma) {
      return res.json({
        message: 'Admin endpoint funcionando (sem banco)',
        usersCount: 0,
        timestamp: new Date().toISOString(),
        warning: 'Database not configured'
      });
    }
    
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
    
    // Se for demo admin, retornar direto
    if (userId === 'admin-demo-id' || userId === 'demo-admin') {
      return res.json({
        message: 'Token válido (demo)',
        user: {
          id: userId,
          name: 'Administrador Demo',
          email: 'admin@ligadobem.com',
          role: 'ADMIN'
        }
      });
    }
    
    const prisma = getPrisma();
    if (!prisma) {
      return res.status(503).json({
        message: 'Database not available'
      });
    }
    
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
    
    // Se for usuário demo admin, retornar dados mock
    if (userId === 'admin-demo-id' || userId === 'demo-admin') {
      console.log('✅ Usuário demo admin - retornando dados mock');
      return res.json({
        totalUsers: 0,
        totalPartners: 0,
        recentUsers: [],
        recentPartners: [],
        message: 'Demo mode - database not available'
      });
    }
    
    const prisma = getPrisma();
    if (!prisma) {
      return res.json({
        totalUsers: 0,
        totalPartners: 0,
        recentUsers: [],
        recentPartners: [],
        warning: 'Database not configured'
      });
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
  const startTime = Date.now();
  try {
    const userId = (req as any).user?.id;
    console.log('🔍 [COMPANIES] Iniciando busca de empresas...');
    console.log('🔍 [COMPANIES] Usuário autenticado:', userId);
    console.log('🔍 [COMPANIES] DATABASE_URL configurada?', !!process.env.DATABASE_URL);

    // Obter Prisma (lazy initialization)
    const prisma = getPrisma();
    
    // Se Prisma não estiver disponível, retornar array vazio imediatamente
    if (!prisma) {
      console.warn('⚠️ [COMPANIES] Prisma não disponível - retornando array vazio');
      const responseTime = Date.now() - startTime;
      console.log(`⏱️ [COMPANIES] Resposta em ${responseTime}ms (sem banco)`);
      return res.json({
        companies: [],
        warning: 'Database not configured. Please set DATABASE_URL in Vercel settings.',
        responseTime: `${responseTime}ms`
      });
    }

    // Tentar buscar empresas do banco com timeout reduzido
    let companies = [];
    try {
      console.log('🔄 [COMPANIES] Tentando buscar empresas do banco...');
      
      // Timeout de 3 segundos (mais rápido)
      const queryPromise = prisma.partner.findMany({
        orderBy: { createdAt: 'desc' }
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout after 3s')), 3000);
      });
      
      companies = await Promise.race([queryPromise, timeoutPromise]) as any[];
      console.log(`✅ [COMPANIES] Total de empresas encontradas: ${companies.length}`);
    } catch (dbError: any) {
      console.error('⚠️ [COMPANIES] Erro ao buscar empresas:', dbError?.message || dbError);
      // Em caso de erro, retornar array vazio (não travar)
      companies = [];
    }

    // Mapear empresas
    const mappedCompanies = companies.map(company => ({
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
    }));
    
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ [COMPANIES] Resposta em ${responseTime}ms com ${mappedCompanies.length} empresas`);
    
    // Sempre retornar resposta rapidamente
    res.json({
      companies: mappedCompanies,
      responseTime: `${responseTime}ms`
    });

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('❌ [COMPANIES] Erro geral ao buscar empresas:', error?.message || error);
    console.error('❌ [COMPANIES] Stack:', error?.stack);
    // Retornar array vazio em caso de erro
    res.json({
      companies: [],
      error: error?.message || 'Unknown error',
      responseTime: `${responseTime}ms`
    });
  }
});

// Listar todos os membros (para admin)
router.get('/members', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    console.log('✅ Usuário autenticado:', userId);

    const prisma = getPrisma();
    if (!prisma) {
      return res.json({
        members: [],
        warning: 'Database not configured'
      });
    }

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

// Handler para OPTIONS (preflight) do upload - DEVE vir ANTES do authenticate
router.options('/app/upload-apk', (req: Request, res: Response) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, x-admin-token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas
  return res.status(200).end();
});

// Endpoint para upload de APK e criação de versão
router.post('/app/upload-apk', authenticate, upload.single('apk'), async (req: Request, res: Response) => {
  // Adicionar headers CORS na resposta
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'Arquivo APK não fornecido'
      });
    }

    const { version, versionCode, releaseNotes, isMandatory } = req.body;

    if (!version || !versionCode) {
      // Deletar arquivo se validação falhar
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        message: 'Versão e código de versão são obrigatórios'
      });
    }

    const prisma = getPrisma();
    if (!prisma) {
      // Deletar arquivo se banco não estiver disponível
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(503).json({
        message: 'Database not available'
      });
    }

    // Verificar se já existe versão com mesmo versionCode
    const existingVersion = await prisma.appVersion.findUnique({
      where: { versionCode: parseInt(versionCode, 10) }
    });

    if (existingVersion) {
      // Deletar arquivo se versão já existe
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        message: `Já existe uma versão com código ${versionCode}`
      });
    }

    // Obter tamanho do arquivo
    const stats = await fs.stat(req.file.path);
    const apkSize = stats.size;

    // Caminho relativo para salvar no banco (relativo ao projeto)
    const apkUrl = `uploads/apks/${req.file.filename}`;

    // Criar versão no banco
    const newVersion = await prisma.appVersion.create({
      data: {
        version: version,
        versionCode: parseInt(versionCode, 10),
        apkUrl: apkUrl,
        apkSize: apkSize,
        releaseNotes: releaseNotes || null,
        isMandatory: isMandatory === 'true' || isMandatory === true,
        isActive: true,
        platform: 'android'
      }
    });

    console.log('✅ APK uploadado e versão criada:', newVersion.id);

    // Adicionar headers CORS na resposta
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    res.json({
      message: 'APK uploadado com sucesso',
      version: {
        id: newVersion.id,
        version: newVersion.version,
        versionCode: newVersion.versionCode,
        apkSize: newVersion.apkSize,
        releaseNotes: newVersion.releaseNotes,
        isMandatory: newVersion.isMandatory
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao fazer upload de APK:', error);
    
    // Deletar arquivo em caso de erro
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({
      message: 'Erro ao fazer upload de APK',
      error: error.message
    });
  }
});

// Endpoint para listar versões
router.get('/app/versions', authenticate, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return res.status(503).json({
        message: 'Database not available'
      });
    }

    const versions = await prisma.appVersion.findMany({
      where: {
        platform: 'android'
      },
      orderBy: {
        versionCode: 'desc'
      }
    });

    res.json({
      versions: versions.map(v => ({
        id: v.id,
        version: v.version,
        versionCode: v.versionCode,
        apkSize: v.apkSize,
        releaseNotes: v.releaseNotes,
        isMandatory: v.isMandatory,
        isActive: v.isActive,
        createdAt: v.createdAt
      }))
    });

  } catch (error: any) {
    console.error('❌ Erro ao listar versões:', error);
    res.status(500).json({
      message: 'Erro ao listar versões',
      error: error.message
    });
  }
});

export default router;

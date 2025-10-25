import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Configuração CORS
app.use(cors({
  origin: [
    'https://nova-versao-liga-do-bem-admin.onrender.com',
    'https://nova-versao-liga-do-bem.onrender.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8081',
    'http://localhost:19006'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token']
}));

// Middleware para parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para lidar com preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Inicializar banco de dados
async function initializeDatabase() {
  try {
    console.log('🔧 Inicializando banco de dados...');
    
    // Verificar se existe admin
    const adminExists = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminExists) {
      console.log('👤 Criando usuário admin...');
      await prisma.user.create({
        data: {
          email: 'admin@ligadobem.com',
          password: 'admin123',
          name: 'Administrador',
          role: 'ADMIN',
          isActive: true
        }
      });
    }

    // Verificar se existem parceiros
    const partnersCount = await prisma.partner.count();
    if (partnersCount === 0) {
      console.log('🏢 Criando parceiros de exemplo...');
      await prisma.partner.createMany({
        data: [
          {
            name: 'Pet Shop Amigo',
            description: 'Pet shop especializado em cuidados para animais',
            category: 'Pet Shop',
            email: 'contato@petshopamigo.com.br',
            phone: '(14) 99876-5432',
            address: 'Rua das Flores, 123',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-000',
            latitude: -22.8858,
            longitude: -48.4440,
            isActive: true
          },
          {
            name: 'Clínica Veterinária São Francisco',
            description: 'Clínica veterinária completa com emergência 24h',
            category: 'Veterinária',
            email: 'contato@vetsaofrancisco.com.br',
            phone: '(14) 3812-3456',
            address: 'Av. São Francisco, 456',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-100',
            latitude: -22.8758,
            longitude: -48.4340,
            isActive: true
          },
          {
            name: 'Hotel para Cães e Gatos',
            description: 'Hotel e creche para pets com atividades recreativas',
            category: 'Hotel Pet',
            email: 'reservas@hotelpet.com.br',
            phone: '(14) 3812-7890',
            address: 'Rua dos Animais, 789',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-200',
            latitude: -22.8658,
            longitude: -48.4240,
            isActive: true
          },
          {
            name: 'Adoção Responsável Botucatu',
            description: 'ONG especializada em adoção de animais abandonados',
            category: 'ONG',
            email: 'adocao@botucatu.com.br',
            phone: '(14) 3812-1111',
            address: 'Rua da Solidariedade, 321',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-300',
            latitude: -22.8558,
            longitude: -48.4140,
            isActive: true
          },
          {
            name: 'Farmácia Veterinária Central',
            description: 'Farmácia especializada em medicamentos veterinários',
            category: 'Farmácia',
            email: 'farmacia@veterinaria.com.br',
            phone: '(14) 3812-2222',
            address: 'Rua Central, 654',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-400',
            latitude: -22.8458,
            longitude: -48.4040,
            isActive: false
          },
          {
            name: 'Pet Grooming Elegance',
            description: 'Salão de beleza e tosa para pets',
            category: 'Tosa',
            email: 'contato@petgrooming.com.br',
            phone: '(14) 3812-3333',
            address: 'Rua da Beleza, 987',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-500',
            latitude: -22.8358,
            longitude: -48.3940,
            isActive: true
          },
          {
            name: 'Loja de Ração Premium',
            description: 'Especializada em rações premium e acessórios',
            category: 'Pet Shop',
            email: 'vendas@racao.com.br',
            phone: '(14) 3812-4444',
            address: 'Rua das Rações, 147',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-600',
            latitude: -22.8258,
            longitude: -48.3840,
            isActive: false
          },
          {
            name: 'Centro de Adestramento Canino',
            description: 'Adestramento profissional e comportamento animal',
            category: 'Adestramento',
            email: 'adestramento@canino.com.br',
            phone: '(14) 3812-5555',
            address: 'Rua do Adestramento, 258',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-700',
            latitude: -22.8158,
            longitude: -48.3740,
            isActive: true
          }
        ]
      });
    }

    // Verificar se existem membros
    const membersCount = await prisma.user.count({
      where: { role: 'MEMBER' }
    });
    if (membersCount === 0) {
      console.log('👥 Criando membros de exemplo...');
      await prisma.user.createMany({
        data: [
          {
            email: 'joao@email.com',
            password: 'senha123',
            name: 'João Silva',
            phone: '(14) 99999-9999',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'maria@email.com',
            password: 'senha123',
            name: 'Maria Santos',
            phone: '(14) 98888-8888',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'pedro@email.com',
            password: 'senha123',
            name: 'Pedro Oliveira',
            phone: '(14) 97777-7777',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'ana@email.com',
            password: 'senha123',
            name: 'Ana Costa',
            phone: '(14) 96666-6666',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'carlos@email.com',
            password: 'senha123',
            name: 'Carlos Ferreira',
            phone: '(14) 95555-5555',
            role: 'MEMBER',
            isActive: false
          },
          {
            email: 'lucia@email.com',
            password: 'senha123',
            name: 'Lucia Rodrigues',
            phone: '(14) 94444-4444',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'roberto@email.com',
            password: 'senha123',
            name: 'Roberto Alves',
            phone: '(14) 93333-3333',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'fernanda@email.com',
            password: 'senha123',
            name: 'Fernanda Lima',
            phone: '(14) 92222-2222',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'marcos@email.com',
            password: 'senha123',
            name: 'Marcos Pereira',
            phone: '(14) 91111-1111',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'juliana@email.com',
            password: 'senha123',
            name: 'Juliana Martins',
            phone: '(14) 90000-0000',
            role: 'MEMBER',
            isActive: false
          }
        ]
      });
    }

    console.log('✅ Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
  }
}

// Middleware de autenticação admin
function verifyAdminToken(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-admin-token'];
  
  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'liga-do-bem-secret-key';
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Para demo, aceitar qualquer token válido
    if (decoded && decoded.userId) {
      console.log('✅ Token admin válido:', decoded.userId);
      req.userId = decoded.userId;
      next();
    } else {
      return res.status(401).json({ message: 'Token inválido' });
    }
  } catch (error) {
    console.error('❌ Erro ao verificar token:', error);
    return res.status(401).json({ message: 'Token inválido' });
  }
}

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

// Admin test endpoint
app.get('/api/admin/test', verifyAdminToken, (req, res) => {
  res.json({ 
    message: 'Admin endpoint working!', 
    userId: req.userId,
    timestamp: new Date().toISOString() 
  });
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Tentativa de login admin:', email);

    // Demo admin
    if (email === 'admin@ligadobem.com' && password === 'demo123') {
      const token = jwt.sign(
        { userId: 'admin-demo-id', email: 'admin@ligadobem.com', role: 'ADMIN' },
        process.env.JWT_SECRET || 'liga-do-bem-secret-key',
        { expiresIn: '24h' }
      );

      return res.json({
        message: 'Login realizado com sucesso',
        token,
        user: {
          id: 'admin-demo-id',
          email: 'admin@ligadobem.com',
          name: 'Administrador Demo',
          role: 'ADMIN'
        }
      });
    }

    // Admin real do banco
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, password: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Verificar senha (em produção, usar hash)
    if (user.password !== password) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'liga-do-bem-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Dashboard
app.get('/api/admin/dashboard', verifyAdminToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Se for demo admin, pular verificação do banco
    if (userId === 'admin-demo-id') {
      console.log('✅ Usuário demo admin autorizado');
    } else {
      // Verificar se é admin real no banco
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      if (!user || user.role !== 'ADMIN') {
        return res.status(401).json({ message: 'Acesso não autorizado' });
      }
    }

    // Buscar estatísticas do banco
    const totalMembers = await prisma.user.count({
      where: { role: 'MEMBER' }
    });

    const activePartners = await prisma.partner.count({
      where: { isActive: true }
    });

    const totalPartners = await prisma.partner.count();

    res.json({
      stats: {
        totalMembers,
        activePartners,
        totalAdoptions: 5,
        monthlyRevenue: 15680,
        totalUsers: totalMembers,
        totalPartners,
        totalAnimals: 0,
        totalDonations: 0,
        monthlyGrowth: {
          users: 15,
          companies: 25,
          donations: 35,
          qrScans: 45
        }
      },
      recent: {
        members: [],
        companies: [],
        donations: []
      }
    });

  } catch (error) {
    console.error('❌ Erro no dashboard:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Get all companies
app.get('/api/admin/companies', verifyAdminToken, async (req, res) => {
  try {
    const companies = await prisma.partner.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Converter para formato esperado pelo frontend
    const formattedCompanies = companies.map(company => ({
      id: company.id,
      name: company.name,
      description: company.description,
      category: company.category,
      email: company.email,
      phone: company.phone,
      address: company.address,
      city: company.city,
      state: company.state,
      zipCode: company.zipCode,
      latitude: company.latitude,
      longitude: company.longitude,
      status: company.isActive ? 'active' : 'inactive',
      isActive: company.isActive,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString()
    }));

    res.json(formattedCompanies);

  } catch (error) {
    console.error('❌ Erro ao buscar empresas:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Update company
app.put('/api/admin/companies/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('✏️ Atualizando empresa:', id, updateData);

    const updatedCompany = await prisma.partner.update({
      where: { id },
      data: {
        name: updateData.name,
        description: updateData.description,
        category: updateData.category,
        email: updateData.email,
        phone: updateData.phone,
        address: updateData.address,
        city: updateData.city,
        state: updateData.state,
        zipCode: updateData.zipCode,
        latitude: updateData.latitude,
        longitude: updateData.longitude
      }
    });

    res.json({
      message: 'Empresa atualizada com sucesso',
      company: {
        id: updatedCompany.id,
        name: updatedCompany.name,
        description: updatedCompany.description,
        category: updatedCompany.category,
        email: updatedCompany.email,
        phone: updatedCompany.phone,
        address: updatedCompany.address,
        city: updatedCompany.city,
        state: updatedCompany.state,
        zipCode: updatedCompany.zipCode,
        latitude: updatedCompany.latitude,
        longitude: updatedCompany.longitude,
        status: updatedCompany.isActive ? 'active' : 'inactive',
        isActive: updatedCompany.isActive,
        createdAt: updatedCompany.createdAt.toISOString(),
        updatedAt: updatedCompany.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar empresa:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Approve company
app.patch('/api/admin/companies/:id/approve', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('✅ Aprovando empresa:', id);

    const approvedCompany = await prisma.partner.update({
      where: { id },
      data: { isActive: true }
    });

    res.json({
      message: 'Empresa aprovada com sucesso',
      company: {
        id: approvedCompany.id,
        name: approvedCompany.name,
        description: approvedCompany.description,
        category: approvedCompany.category,
        email: approvedCompany.email,
        phone: approvedCompany.phone,
        address: approvedCompany.address,
        city: approvedCompany.city,
        state: approvedCompany.state,
        zipCode: approvedCompany.zipCode,
        latitude: approvedCompany.latitude,
        longitude: approvedCompany.longitude,
        status: 'active',
        isActive: true,
        createdAt: approvedCompany.createdAt.toISOString(),
        updatedAt: approvedCompany.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao aprovar empresa:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Reject company
app.patch('/api/admin/companies/:id/reject', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('❌ Rejeitando empresa:', id);

    const rejectedCompany = await prisma.partner.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      message: 'Empresa rejeitada com sucesso',
      company: {
        id: rejectedCompany.id,
        name: rejectedCompany.name,
        description: rejectedCompany.description,
        category: rejectedCompany.category,
        email: rejectedCompany.email,
        phone: rejectedCompany.phone,
        address: rejectedCompany.address,
        city: rejectedCompany.city,
        state: rejectedCompany.state,
        zipCode: rejectedCompany.zipCode,
        latitude: rejectedCompany.latitude,
        longitude: rejectedCompany.longitude,
        status: 'inactive',
        isActive: false,
        createdAt: rejectedCompany.createdAt.toISOString(),
        updatedAt: rejectedCompany.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao rejeitar empresa:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Delete company
app.delete('/api/admin/companies/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Excluindo empresa:', id);

    await prisma.partner.delete({
      where: { id }
    });

    res.json({
      message: 'Empresa excluída com sucesso',
      id
    });

  } catch (error) {
    console.error('❌ Erro ao excluir empresa:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Create company
app.post('/api/admin/companies', verifyAdminToken, async (req, res) => {
  try {
    const newCompany = req.body;

    console.log('➕ Criando nova empresa:', newCompany);

    const company = await prisma.partner.create({
      data: {
        name: newCompany.name,
        description: newCompany.description,
        category: newCompany.category,
        email: newCompany.email,
        phone: newCompany.phone,
        address: newCompany.address,
        city: newCompany.city,
        state: newCompany.state,
        zipCode: newCompany.zipCode,
        latitude: newCompany.latitude,
        longitude: newCompany.longitude,
        isActive: newCompany.status === 'active'
      }
    });

    res.json({
      message: 'Empresa criada com sucesso',
      company: {
        id: company.id,
        name: company.name,
        description: company.description,
        category: company.category,
        email: company.email,
        phone: company.phone,
        address: company.address,
        city: company.city,
        state: company.state,
        zipCode: company.zipCode,
        latitude: company.latitude,
        longitude: company.longitude,
        status: company.isActive ? 'active' : 'inactive',
        isActive: company.isActive,
        createdAt: company.createdAt.toISOString(),
        updatedAt: company.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar empresa:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Get all members
app.get('/api/admin/members', verifyAdminToken, async (req, res) => {
  try {
    const members = await prisma.user.findMany({
      where: { role: 'MEMBER' },
      orderBy: { createdAt: 'desc' }
    });

    // Converter para formato esperado pelo frontend
    const formattedMembers = members.map(member => ({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      isActive: member.isActive,
      points: 0, // TODO: implementar sistema de pontos
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString()
    }));

    res.json(formattedMembers);

  } catch (error) {
    console.error('❌ Erro ao buscar membros:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Create member
app.post('/api/admin/members', verifyAdminToken, async (req, res) => {
  try {
    const newMember = req.body;

    console.log('➕ Criando novo membro:', newMember);

    const member = await prisma.user.create({
      data: {
        name: newMember.name,
        email: newMember.email,
        phone: newMember.phone,
        password: 'senha123', // TODO: gerar senha segura
        role: 'MEMBER',
        isActive: newMember.status === 'active'
      }
    });

    res.json({
      message: 'Membro criado com sucesso',
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        isActive: member.isActive,
        points: 0,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar membro:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Update member
app.put('/api/admin/members/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('✏️ Atualizando membro:', id, updateData);

    const updatedMember = await prisma.user.update({
      where: { id },
      data: {
        name: updateData.name,
        email: updateData.email,
        phone: updateData.phone,
        isActive: updateData.status === 'active'
      }
    });

    res.json({
      message: 'Membro atualizado com sucesso',
      member: {
        id: updatedMember.id,
        name: updatedMember.name,
        email: updatedMember.email,
        phone: updatedMember.phone,
        role: updatedMember.role,
        isActive: updatedMember.isActive,
        points: 0,
        createdAt: updatedMember.createdAt.toISOString(),
        updatedAt: updatedMember.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar membro:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Delete member
app.delete('/api/admin/members/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Excluindo membro:', id);

    await prisma.user.delete({
      where: { id }
    });

    res.json({
      message: 'Membro excluído com sucesso',
      id
    });

  } catch (error) {
    console.error('❌ Erro ao excluir membro:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// API para o app mobile - Get active partners
app.get('/api/partners', async (req, res) => {
  try {
    const partners = await prisma.partner.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    res.json(partners);

  } catch (error) {
    console.error('❌ Erro ao buscar parceiros:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Inicializar banco
initializeDatabase();

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor com banco de dados rodando na porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
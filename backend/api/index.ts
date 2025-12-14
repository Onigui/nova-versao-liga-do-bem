// Vercel Serverless Function - Com Prisma

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Cloudinary para upload de imagens
let cloudinary: any = null;
function getCloudinary() {
  if (!cloudinary && process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    } catch (error) {
      console.warn('⚠️ Cloudinary não configurado:', error);
    }
  }
  return cloudinary;
}

let prisma: PrismaClient | null = null;

const JWT_SECRET = process.env.JWT_SECRET || 'liga-do-bem-secret-key';

function getPrisma() {
  if (!prisma && process.env.DATABASE_URL) {
    prisma = new PrismaClient();
  }
  return prisma;
}

function generateToken(payload: any) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export default async function handler(req: any, res: any) {
  // CORS
  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, x-admin-token, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Parse body if present
  let body = req.body;
  if (req.method !== 'GET' && req.method !== 'HEAD' && typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // Body might already be parsed
    }
  }
  if (!body) body = {};

  // Get path - Vercel may pass different path formats
  // Try multiple sources: req.url, req.path, or query parameter
  let path = req.url?.replace(/\?.*$/, '') || req.path || req.query?.path || '/';
  const method = req.method || 'GET';

  // Log all available path information
  console.log(`🔍 Path debug:`, {
    'req.url': req.url,
    'req.path': req.path,
    'req.query': req.query,
    'raw path': path
  });

  // Normalize path - Vercel routes /api/(.*) to /api/index.ts
  // The path might come as /api/admin/companies/... or /admin/companies/...
  // Always normalize to include /api/ prefix for consistency
  if (!path.startsWith('/api/') && !path.startsWith('/ping')) {
    // If path starts with /admin/, add /api/ prefix
    if (path.startsWith('/admin/')) {
      path = '/api' + path;
    }
    // If path is just /, keep it
    else if (path !== '/') {
      // For other paths, try to add /api/ if it looks like an API route
      path = '/api' + (path.startsWith('/') ? '' : '/') + path;
    }
  }

  console.log(`📥 ${method} ${path}`);
  
  // Store parsed body
  req.body = body;

  try {
    // Ping
    if (path === '/api/ping' || path === '/ping') {
      return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), hasDb: !!process.env.DATABASE_URL });
    }

    // Admin login
    if (path === '/api/admin/login' && method === 'POST') {
      const { email, password } = body;
      if (email === 'admin@ligadobem.com' && (password === 'admin123' || password === 'demo123')) {
        return res.status(200).json({
          success: true,
          token: 'demo-token-' + Date.now(),
          user: { id: 'demo-1', name: 'Admin Demo', email, role: 'admin' }
        });
      }
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Public stats endpoint (for mobile app)
    if (path === '/api/stats' && method === 'GET') {
      console.log('📊 Public stats request');
      const db = getPrisma();
      if (db) {
        try {
          const [totalAdoptions, totalAnimals, totalDonations, activePartners] = await Promise.all([
            db.adoption.count({ where: { status: 'COMPLETED' } }).catch((e) => { console.error('Error counting adoptions:', e); return 0; }),
            db.animal.count({ where: { isActive: true, isAdopted: false } }).catch((e) => { console.error('Error counting animals:', e); return 0; }),
            db.donation.aggregate({ 
              where: { status: 'APPROVED' },
              _sum: { amount: true } 
            }).catch((e) => { console.error('Error summing donations:', e); return { _sum: { amount: 0 } }; }),
            db.partner.count({ where: { isActive: true } }).catch((e) => { console.error('Error counting partners:', e); return 0; })
          ]);
          const donationTotal = totalDonations?._sum?.amount ? parseFloat(totalDonations._sum.amount.toString()) : 0;
          const response = {
            stats: {
              totalAdoptions: totalAdoptions || 0,
              totalAnimals: totalAnimals || 0,
              totalDonations: donationTotal || 0,
              totalPartners: activePartners || 0,
            }
          };
          console.log('✅ Public stats response:', response);
          return res.status(200).json(response);
        } catch (error: any) {
          console.error('❌ Public stats error:', error);
          return res.status(200).json({
            stats: {
              totalAdoptions: 0,
              totalAnimals: 0,
              totalDonations: 0,
              totalPartners: 0,
            }
          });
        }
      }
      console.log('⚠️ Public stats: No database');
      return res.status(200).json({
        stats: {
          totalAdoptions: 0,
          totalAnimals: 0,
          totalDonations: 0,
          totalPartners: 0,
        }
      });
    }

    // Admin dashboard
    if (path === '/api/admin/dashboard' && method === 'GET') {
      console.log('📊 Dashboard request');
      const db = getPrisma();
      if (db) {
        try {
          const [totalMembers, activePartners, totalAdoptions, totalAnimals, totalDonations] = await Promise.all([
            db.user.count().catch((e) => { console.error('Error counting users:', e); return 0; }),
            db.partner.count({ where: { isActive: true } }).catch((e) => { console.error('Error counting partners:', e); return 0; }),
            db.adoption.count({ where: { status: 'COMPLETED' } }).catch((e) => { console.error('Error counting adoptions:', e); return 0; }),
            db.animal.count({ where: { isActive: true, isAdopted: false } }).catch((e) => { console.error('Error counting animals:', e); return 0; }),
            db.donation.aggregate({ _sum: { amount: true } }).catch((e) => { console.error('Error summing donations:', e); return { _sum: { amount: 0 } }; })
          ]);
          const donationTotal = totalDonations?._sum?.amount ? parseFloat(totalDonations._sum.amount.toString()) : 0;
          const response = {
            stats: {
              totalMembers,
              activePartners,
              totalAdoptions,
              totalAnimals: totalAnimals || 0,
              totalPartners: activePartners || 0,
              totalDonations: donationTotal || 0,
              monthlyRevenue: 0
            }
          };
          console.log('✅ Dashboard response:', response);
          return res.status(200).json(response);
        } catch (error: any) {
          console.error('❌ Dashboard error:', error);
          return res.status(200).json({
            stats: {
              totalMembers: 0,
              activePartners: 0,
              totalAdoptions: 0,
              monthlyRevenue: 0
            }
          });
        }
      }
      console.log('⚠️ Dashboard: No database');
      return res.status(200).json({
        stats: {
          totalMembers: 0,
          activePartners: 0,
          totalAdoptions: 0,
          monthlyRevenue: 0
        }
      });
    }

    // Admin companies (partners) - GET all
    if (path === '/api/admin/companies' && method === 'GET') {
      const db = getPrisma();
      if (db) {
        const partners = await db.partner.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            discounts: true
          }
        });
        // Map to expected format
        const companies = partners.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          status: p.isActive ? 'active' : 'inactive',
          discount: p.discounts?.[0]?.percentage ? `${p.discounts[0].percentage}%` : 'N/A',
          location: p.city || p.address,
          email: p.email,
          phone: p.phone,
          description: p.description
        }));
        return res.status(200).json({ companies, total: companies.length });
      }
      return res.status(200).json({ companies: [], total: 0, error: 'Database not configured' });
    }

    // Admin companies - POST (create)
    if (path === '/api/admin/companies' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { name, category, address, latitude, longitude, phone, email, description, status } = body;
        if (!name || !category) {
          return res.status(400).json({ error: 'Nome e categoria são obrigatórios' });
        }
        // Parse address to get city and state if needed
        const city = 'Botucatu'; // Default
        const state = 'SP'; // Default
        const zipCode = '18608-000'; // Default
        
        const partner = await db.partner.create({
          data: {
            name,
            category,
            address: address || 'Não informado',
            city,
            state,
            zipCode,
            latitude: latitude || null,
            longitude: longitude || null,
            phone: phone || null,
            email: email || null,
            description: description || null,
            isActive: status === 'active' || status === undefined
          }
        });
        return res.status(201).json({ message: 'Empresa cadastrada com sucesso', company: partner });
      } catch (error: any) {
        console.error('❌ Erro ao criar empresa:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao criar empresa' });
      }
    }

    // Admin companies - PATCH approve (check BEFORE generic routes)
    if ((path.includes('/api/admin/companies/') || path.includes('/admin/companies/')) && path.endsWith('/approve') && method === 'PATCH') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/companies\/([^\/]+)\/approve$/);
        if (!match) match = path.match(/\/admin\/companies\/([^\/]+)\/approve$/);
        const companyId = match?.[1];
        if (!companyId) {
          return res.status(400).json({ error: 'ID da empresa é obrigatório' });
        }
        const partner = await db.partner.update({
          where: { id: companyId },
          data: { isActive: true }
        });
        return res.status(200).json({ message: 'Empresa aprovada com sucesso', company: partner });
      } catch (error: any) {
        console.error('❌ Erro ao aprovar empresa:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao aprovar empresa' });
      }
    }

    // Admin companies - PATCH reject (check BEFORE generic routes)
    if ((path.includes('/api/admin/companies/') || path.includes('/admin/companies/')) && path.endsWith('/reject') && method === 'PATCH') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/companies\/([^\/]+)\/reject$/);
        if (!match) match = path.match(/\/admin\/companies\/([^\/]+)\/reject$/);
        const companyId = match?.[1];
        if (!companyId) {
          return res.status(400).json({ error: 'ID da empresa é obrigatório' });
        }
        const partner = await db.partner.update({
          where: { id: companyId },
          data: { isActive: false }
        });
        return res.status(200).json({ message: 'Empresa rejeitada com sucesso', company: partner });
      } catch (error: any) {
        console.error('❌ Erro ao rejeitar empresa:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao rejeitar empresa' });
      }
    }

    // Admin companies - PUT (update by ID)
    if ((path.startsWith('/api/admin/companies/') || path.match(/^\/api\/admin\/companies\/[^\/]+$/)) && method === 'PUT') {
      console.log('🔧 PUT /api/admin/companies/:id detected');
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        // Try multiple regex patterns to extract ID
        let match = path.match(/\/api\/admin\/companies\/([^\/]+)$/);
        if (!match) {
          match = path.match(/\/admin\/companies\/([^\/]+)$/);
        }
        if (!match) {
          match = path.match(/\/companies\/([^\/]+)$/);
        }
        
        const companyId = match?.[1];
        console.log(`🔍 Extracted company ID: ${companyId} from path: ${path}`);
        
        if (!companyId) {
          return res.status(400).json({ error: 'ID da empresa é obrigatório', path, match });
        }
        const { name, category, city, state, zipCode, address, email, phone, description } = body;
        
        console.log(`💾 Updating company ${companyId} with data:`, { name, category, city, state });
        
        const updateData: any = {};
        if (name) updateData.name = name;
        if (category) updateData.category = category;
        if (city) updateData.city = city;
        if (state) updateData.state = state;
        if (zipCode) updateData.zipCode = zipCode;
        if (address) updateData.address = address;
        if (email !== undefined) updateData.email = email || null;
        if (phone !== undefined) updateData.phone = phone || null;
        if (description !== undefined) updateData.description = description || null;
        
        const partner = await db.partner.update({
          where: { id: companyId },
          data: updateData
        });
        console.log('✅ Company updated successfully:', partner.id);
        return res.status(200).json({ message: 'Empresa atualizada com sucesso', company: partner });
      } catch (error: any) {
        console.error('❌ Erro ao atualizar empresa:', error);
        console.error('❌ Error details:', { message: error?.message, code: error?.code, path });
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao atualizar empresa' });
      }
    }

    // Admin companies - DELETE
    if ((path.startsWith('/api/admin/companies/') || path.match(/^\/api\/admin\/companies\/[^\/]+$/)) && method === 'DELETE') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/companies\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/companies\/([^\/]+)$/);
        const companyId = match?.[1];
        if (!companyId) {
          return res.status(400).json({ error: 'ID da empresa é obrigatório' });
        }
        await db.partner.delete({
          where: { id: companyId }
        });
        return res.status(200).json({ message: 'Empresa deletada com sucesso' });
      } catch (error: any) {
        console.error('❌ Erro ao deletar empresa:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao deletar empresa' });
      }
    }

    // Admin members - GET all
    if (path === '/api/admin/members' && method === 'GET') {
      const db = getPrisma();
      if (db) {
        const members = await db.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            avatar: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          }
        });
        return res.status(200).json({ members, total: members.length });
      }
      return res.status(200).json({ members: [], total: 0 });
    }

    // Admin members - PUT (update by ID)
    if ((path.startsWith('/api/admin/members/') || path.match(/^\/api\/admin\/members\/[^\/]+$/)) && method === 'PUT') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/members\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/members\/([^\/]+)$/);
        const memberId = match?.[1];
        if (!memberId) {
          return res.status(400).json({ error: 'ID do membro é obrigatório' });
        }
        const { name, email, phone, role, status, points } = body;
        
        const updateData: any = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone || null;
        if (role) updateData.role = role;
        // Map status to isActive
        if (status !== undefined) {
          updateData.isActive = status === 'active' || status === true;
        }
        // Note: points field doesn't exist in User model, so we ignore it
        
        const member = await db.user.update({
          where: { id: memberId },
          data: updateData
        });
        return res.status(200).json({ message: 'Membro atualizado com sucesso', member });
      } catch (error: any) {
        console.error('❌ Erro ao atualizar membro:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Membro não encontrado' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao atualizar membro' });
      }
    }

    // Admin members - DELETE
    if ((path.startsWith('/api/admin/members/') || path.match(/^\/api\/admin\/members\/[^\/]+$/)) && method === 'DELETE') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/members\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/members\/([^\/]+)$/);
        const memberId = match?.[1];
        if (!memberId) {
          return res.status(400).json({ error: 'ID do membro é obrigatório' });
        }
        await db.user.delete({
          where: { id: memberId }
        });
        return res.status(200).json({ message: 'Membro deletado com sucesso' });
      } catch (error: any) {
        console.error('❌ Erro ao deletar membro:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Membro não encontrado' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao deletar membro' });
      }
    }

    // Auth - Login
    if (path === '/api/auth/login' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { email, password } = body;
        
        if (!email || !password) {
          return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        console.log('🔐 Login attempt:', email);

        // Find user (tentar buscar cpf se coluna existir)
        let user: any;
        try {
          user = await db.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              password: true,
              name: true,
              phone: true,
              avatar: true,
              notificationsEnabled: true,
              locationEnabled: true,
              role: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
              cpf: true, // Tentar buscar CPF
            }
          });
        } catch (error: any) {
          // Se colunas não existirem, buscar sem elas
          if (error.message?.includes('cpf') || error.message?.includes('notificationsEnabled') || error.message?.includes('locationEnabled') || error.code === 'P2021') {
            console.warn('⚠️ Algumas colunas não existem ainda, buscando usuário sem elas');
            user = await db.user.findUnique({
              where: { email },
              select: {
                id: true,
                email: true,
                password: true,
                name: true,
                phone: true,
                avatar: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              }
            });
            if (user) {
              (user as any).cpf = null;
              (user as any).notificationsEnabled = true; // Default
              (user as any).locationEnabled = true; // Default
            }
          } else {
            throw error;
          }
        }

        if (!user) {
          console.log('❌ User not found:', email);
          return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        console.log('👤 User found:', { id: user.id, email: user.email, isActive: user.isActive });
        console.log('🔑 Password hash starts with:', user.password.substring(0, 10));

        // Check if password is hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
        const isPasswordHashed = user.password.startsWith('$2a$') || 
                                 user.password.startsWith('$2b$') || 
                                 user.password.startsWith('$2y$');

        let isPasswordValid = false;

        if (isPasswordHashed) {
          // Password is hashed, use bcrypt.compare
          console.log('🔐 Comparing with bcrypt (hashed password)');
          isPasswordValid = await bcrypt.compare(password, user.password);
        } else {
          // Password is not hashed (legacy user), compare directly
          console.log('⚠️ Password is not hashed (legacy user), comparing directly');
          isPasswordValid = password === user.password;
          
          // If direct comparison works, hash the password for future use
          if (isPasswordValid) {
            console.log('✅ Legacy password match, updating to hashed password...');
            const hashedPassword = await bcrypt.hash(password, 12);
            await db.user.update({
              where: { id: user.id },
              data: { password: hashedPassword }
            });
            console.log('✅ Password updated to hashed format');
          }
        }

        if (!isPasswordValid) {
          console.log('❌ Invalid password for:', email);
          return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Check if user is active
        if (!user.isActive) {
          return res.status(401).json({ error: 'Usuário inativo' });
        }

        // Generate JWT
        const token = generateToken({
          userId: user.id,
          email: user.email,
          role: user.role
        });

        console.log('✅ Login successful:', user.id);

        // Preparar dados do usuário para retorno
        const userData: any = {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role
        };
        
        // Adicionar CPF se existir e for válido (não pode ser zeros ou vazio)
        if ('cpf' in user && user.cpf && user.cpf.trim() !== '' && user.cpf !== '00000000000') {
          userData.cpf = user.cpf;
        } else {
          userData.cpf = null;
        }

        return res.status(200).json({
          message: 'Login realizado com sucesso',
          user: userData,
          token
        });
      } catch (error: any) {
        console.error('❌ Login error:', error);
        return res.status(500).json({ error: error?.message || 'Erro interno do servidor' });
      }
    }

    // Auth - Register
    if (path === '/api/auth/register' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { email, name, phone, password, cpf } = body;
        
        // Validações obrigatórias
        if (!email || !name || !password) {
          return res.status(400).json({ error: 'Email, nome e senha são obrigatórios' });
        }

        // CPF é obrigatório no cadastro
        if (!cpf || !cpf.trim()) {
          return res.status(400).json({ error: 'CPF é obrigatório para cadastro' });
        }

        // Validar formato do CPF (11 dígitos)
        const cpfClean = cpf.replace(/\D/g, '');
        if (cpfClean.length !== 11) {
          return res.status(400).json({ error: 'CPF inválido. Deve conter 11 dígitos' });
        }

        console.log('📝 Register attempt:', email, 'CPF:', cpfClean);

        // Verificar se email já existe
        const existingUserByEmail = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
          }
        });

        if (existingUserByEmail) {
          return res.status(400).json({ error: 'Usuário já existe com este email' });
        }

        // Verificar se CPF já está em uso (só se coluna existir)
        try {
          const existingUserByCpf = await db.user.findFirst({
            where: { cpf: cpfClean },
            select: {
              id: true,
              email: true,
            }
          });

          if (existingUserByCpf) {
            return res.status(400).json({ error: 'CPF já cadastrado. Este CPF já está em uso por outra conta' });
          }
        } catch (error: any) {
          // Se coluna cpf não existir ainda, apenas logar aviso
          if (error.message?.includes('cpf') || error.code === 'P2021') {
            console.warn('⚠️ Coluna cpf não existe ainda, pulando verificação de duplicidade de CPF');
          } else {
            throw error;
          }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user com CPF
        const userData: any = {
          email,
          name,
          phone: phone || null,
          password: hashedPassword,
          role: 'MEMBER'
        };

        // Adicionar CPF ao userData
        userData.cpf = cpfClean;

        console.log('🔄 Criando usuário com dados:', { email, name, hasCpf: !!cpfClean });

        // Tentar criar usuário com CPF
        let user;
        try {
          user = await db.user.create({
            data: userData,
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              cpf: true,
              role: true,
              createdAt: true
            }
          });
          console.log('✅ Usuário criado com sucesso:', user.id);
        } catch (error: any) {
          // Se erro for relacionado a coluna cpf não existir, criar sem cpf
          if (error.message?.includes('cpf') || error.code === 'P2021') {
            console.warn('⚠️ Coluna cpf não existe ainda, criando usuário sem cpf');
            const { cpf: _, ...userDataWithoutCpf } = userData;
            user = await db.user.create({
              data: userDataWithoutCpf,
              select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                createdAt: true
              }
            });
            (user as any).cpf = null;
            console.log('✅ Usuário criado sem CPF (coluna não existe):', user.id);
          } else {
            console.error('❌ Erro ao criar usuário:', error);
            throw error;
          }
        }

        // Generate JWT
        const token = generateToken({
          userId: user.id,
          email: user.email,
          role: user.role
        });

        console.log('✅ User registered:', user.id);

        return res.status(201).json({
          message: 'Usuário criado com sucesso',
          user,
          token
        });
      } catch (error: any) {
        console.error('❌ Register error:', error);
        return res.status(500).json({ error: error?.message || 'Erro interno do servidor' });
      }
    }

    // Partners - GET all (public, only active)
    if (path === '/api/partners' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(200).json({ partners: [] });
      }
      try {
        const partners = await db.partner.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            discounts: {
              where: {
                validFrom: { lte: new Date() },
                validUntil: { gte: new Date() }
              },
              take: 1
            }
          }
        });

        // Map to expected format
        const formattedPartners = partners.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description || 'Parceiro da Liga do Bem',
          address: p.address || `${p.city || ''}${p.state ? ` - ${p.state}` : ''}`.trim(),
          phone: p.phone,
          email: p.email,
          latitude: p.latitude ? parseFloat(p.latitude.toString()) : null,
          longitude: p.longitude ? parseFloat(p.longitude.toString()) : null,
          city: p.city,
          state: p.state,
          discount: p.discounts?.[0]?.percentage ? `${p.discounts[0].percentage}%` : null
        }));

        console.log(`✅ Partners loaded: ${formattedPartners.length}`);
        return res.status(200).json({ partners: formattedPartners });
      } catch (error: any) {
        console.error('❌ Error loading partners:', error);
        return res.status(200).json({ partners: [] });
      }
    }

    // --- Admin Animals Endpoints ---
    // GET all animals (admin)
    if (path === '/api/admin/animals' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const animals = await db.animal.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            adoptions: {
              where: { status: 'PENDING' },
              take: 1
            }
          }
        });
        return res.status(200).json({ animals, total: animals.length });
      } catch (error: any) {
        console.error('❌ Erro ao listar animais:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao listar animais' });
      }
    }

    // POST create animal (admin)
    if (path === '/api/admin/animals' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { name, species, breed, age, gender, size, description, image, isVaccinated, isCastrated, hasSpecialNeeds, specialNeeds, isActive } = body;
        if (!name || !species || !gender || !size) {
          return res.status(400).json({ error: 'Nome, espécie, gênero e porte são obrigatórios' });
        }
        const animal = await db.animal.create({
          data: {
            name,
            species,
            breed: breed || null,
            age: age ? parseInt(age) : null,
            gender,
            size,
            description: description || null,
            image: image || null,
            isVaccinated: isVaccinated || false,
            isCastrated: isCastrated || false,
            hasSpecialNeeds: hasSpecialNeeds || false,
            specialNeeds: specialNeeds || null,
            isActive: isActive !== undefined ? isActive : true,
            isAdopted: false
          }
        });
        return res.status(201).json({ message: 'Animal cadastrado com sucesso', animal });
      } catch (error: any) {
        console.error('❌ Erro ao criar animal:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao criar animal' });
      }
    }

    // PUT update animal (admin)
    if ((path.startsWith('/api/admin/animals/') || path.match(/^\/api\/admin\/animals\/[^\/]+$/)) && method === 'PUT') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/animals\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/animals\/([^\/]+)$/);
        const animalId = match?.[1];
        if (!animalId) {
          return res.status(400).json({ error: 'ID do animal é obrigatório' });
        }
        const { name, species, breed, age, gender, size, description, image, isVaccinated, isCastrated, hasSpecialNeeds, specialNeeds, isActive, isAdopted } = body;
        const updateData: any = {};
        if (name) updateData.name = name;
        if (species) updateData.species = species;
        if (breed !== undefined) updateData.breed = breed || null;
        if (age !== undefined) updateData.age = age ? parseInt(age) : null;
        if (gender) updateData.gender = gender;
        if (size) updateData.size = size;
        if (description !== undefined) updateData.description = description || null;
        if (image !== undefined) updateData.image = image || null;
        if (isVaccinated !== undefined) updateData.isVaccinated = isVaccinated;
        if (isCastrated !== undefined) updateData.isCastrated = isCastrated;
        if (hasSpecialNeeds !== undefined) updateData.hasSpecialNeeds = hasSpecialNeeds;
        if (specialNeeds !== undefined) updateData.specialNeeds = specialNeeds || null;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (isAdopted !== undefined) updateData.isAdopted = isAdopted;
        const animal = await db.animal.update({
          where: { id: animalId },
          data: updateData
        });
        return res.status(200).json({ message: 'Animal atualizado com sucesso', animal });
      } catch (error: any) {
        console.error('❌ Erro ao atualizar animal:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Animal não encontrado' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao atualizar animal' });
      }
    }

    // DELETE animal (admin)
    if ((path.startsWith('/api/admin/animals/') || path.match(/^\/api\/admin\/animals\/[^\/]+$/)) && method === 'DELETE') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/animals\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/animals\/([^\/]+)$/);
        const animalId = match?.[1];
        if (!animalId) {
          return res.status(400).json({ error: 'ID do animal é obrigatório' });
        }
        await db.animal.delete({ where: { id: animalId } });
        return res.status(200).json({ message: 'Animal deletado com sucesso' });
      } catch (error: any) {
        console.error('❌ Erro ao deletar animal:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Animal não encontrado' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao deletar animal' });
      }
    }

    // --- Public Animals Endpoint (for mobile app) ---
    if (path === '/api/animals' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(200).json({ animals: [] });
      }
      try {
        const animals = await db.animal.findMany({
          where: { 
            isActive: true,
            isAdopted: false
          },
          orderBy: { createdAt: 'desc' }
        });
        // Format for mobile app
        const formattedAnimals = animals.map(a => ({
          id: a.id,
          name: a.name,
          species: a.species === 'DOG' ? 'Cachorro' : a.species === 'CAT' ? 'Gato' : a.species === 'BIRD' ? 'Ave' : a.species === 'RABBIT' ? 'Coelho' : 'Outro',
          breed: a.breed || 'Vira-Lata',
          age: a.age ? `${Math.floor(a.age / 12)} ${Math.floor(a.age / 12) === 1 ? 'ano' : 'anos'}` : 'N/A',
          gender: a.gender === 'MALE' ? 'Macho' : 'Fêmea',
          size: a.size === 'SMALL' ? 'Pequeno' : a.size === 'MEDIUM' ? 'Médio' : 'Grande',
          photo: a.image || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400',
          photos: a.image ? [a.image] : ['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'],
          vaccinated: a.isVaccinated,
          neutered: a.isCastrated,
          description: a.description || 'Este animal está procurando um lar cheio de amor!',
          color: 'Não informado', // Campo não existe no schema, mas pode ser adicionado depois
          rescueDate: a.createdAt.toISOString().split('T')[0],
          hasSpecialNeeds: a.hasSpecialNeeds || false,
          specialNeeds: a.specialNeeds || null
        }));
        return res.status(200).json({ animals: formattedAnimals, total: formattedAnimals.length });
      } catch (error: any) {
        console.error('❌ Erro ao listar animais públicos:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao listar animais' });
      }
    }

    // --- Admin Events Endpoints ---
    // GET all events (admin)
    if (path === '/api/admin/events' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const events = await db.event.findMany({
          orderBy: { startDate: 'desc' },
          include: {
            registrations: {
              where: { status: 'REGISTERED' },
            }
          }
        });
        return res.status(200).json({ events, total: events.length });
      } catch (error: any) {
        console.error('❌ Erro ao listar eventos:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao listar eventos' });
      }
    }

    // POST create event (admin)
    if (path === '/api/admin/events' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { title, description, type, startDate, endDate, location, address, latitude, longitude, maxAttendees, image, isActive } = body;
        if (!title || !type || !startDate) {
          return res.status(400).json({ error: 'Título, tipo e data de início são obrigatórios' });
        }
        const event = await db.event.create({
          data: {
            title,
            description: description || null,
            type,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            location: location || null,
            address: address || null,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
            image: image || null,
            isActive: isActive !== undefined ? isActive : true,
            currentAttendees: 0
          }
        });
        return res.status(201).json({ message: 'Evento cadastrado com sucesso', event });
      } catch (error: any) {
        console.error('❌ Erro ao criar evento:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao criar evento' });
      }
    }

    // PUT update event (admin)
    if ((path.startsWith('/api/admin/events/') || path.match(/^\/api\/admin\/events\/[^\/]+$/)) && method === 'PUT') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/events\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/events\/([^\/]+)$/);
        const eventId = match?.[1];
        if (!eventId) {
          return res.status(400).json({ error: 'ID do evento é obrigatório' });
        }
        const { title, description, type, startDate, endDate, location, address, latitude, longitude, maxAttendees, image, isActive } = body;
        const updateData: any = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description || null;
        if (type) updateData.type = type;
        if (startDate) updateData.startDate = new Date(startDate);
        if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
        if (location !== undefined) updateData.location = location || null;
        if (address !== undefined) updateData.address = address || null;
        if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null;
        if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null;
        if (maxAttendees !== undefined) updateData.maxAttendees = maxAttendees ? parseInt(maxAttendees) : null;
        if (image !== undefined) updateData.image = image || null;
        if (isActive !== undefined) updateData.isActive = isActive;
        const event = await db.event.update({
          where: { id: eventId },
          data: updateData
        });
        return res.status(200).json({ message: 'Evento atualizado com sucesso', event });
      } catch (error: any) {
        console.error('❌ Erro ao atualizar evento:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao atualizar evento' });
      }
    }

    // DELETE event (admin)
    if ((path.startsWith('/api/admin/events/') || path.match(/^\/api\/admin\/events\/[^\/]+$/)) && method === 'DELETE') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/events\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/events\/([^\/]+)$/);
        const eventId = match?.[1];
        if (!eventId) {
          return res.status(400).json({ error: 'ID do evento é obrigatório' });
        }
        await db.event.delete({
          where: { id: eventId }
        });
        return res.status(200).json({ message: 'Evento excluído com sucesso' });
      } catch (error: any) {
        console.error('❌ Erro ao excluir evento:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao excluir evento' });
      }
    }

    // --- Public Events Endpoint (for mobile app) ---
    if (path === '/api/events' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(200).json({ events: [] });
      }
      try {
        const events = await db.event.findMany({
          where: { 
            isActive: true,
            startDate: { gte: new Date() } // Apenas eventos futuros
          },
          orderBy: { startDate: 'asc' },
          include: {
            registrations: {
              where: { status: 'REGISTERED' },
            }
          }
        });
        // Format for mobile app
        const formattedEvents = events.map(e => {
          const startDate = new Date(e.startDate);
          const endDate = e.endDate ? new Date(e.endDate) : null;
          const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
          const monthAbbr = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
          
          const categoryMap: any = {
            'ADOPTION_FAIR': 'Adoção',
            'FUNDRAISING': 'Arrecadação',
            'VOLUNTEER_MEETING': 'Voluntariado',
            'MEDICAL_CAMPAIGN': 'Saúde',
            'EDUCATION': 'Educação',
            'OTHER': 'Outro'
          };

          // Formatar horários usando timezone do Brasil
          // O JavaScript converte automaticamente de UTC para o timezone especificado
          let timeStr = '';
          if (endDate) {
            const startTime = startDate.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo'
            });
            const endTime = endDate.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo'
            });
            timeStr = `${startTime} - ${endTime}`;
          } else {
            timeStr = startDate.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo'
            });
          }

          // Formatar data também usando timezone do Brasil
          const dateStr = startDate.toLocaleDateString('en-CA', { 
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });

          // Obter mês e dia usando timezone do Brasil
          const startDateBrazil = new Date(startDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

          return {
            id: e.id,
            title: e.title,
            description: e.description || 'Participe e faça a diferença!',
            date: dateStr,
            time: timeStr,
            location: e.location || 'Local a definir',
            address: e.address || null,
            category: categoryMap[e.type] || 'Outro',
            type: e.type,
            vacancies: e.maxAttendees || 0,
            registered: e.registrations.length,
            image: e.image || 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400',
            month: monthNames[startDateBrazil.getMonth()],
            monthAbbr: monthAbbr[startDateBrazil.getMonth()],
            day: startDateBrazil.getDate(),
          };
        });
        return res.status(200).json({ events: formattedEvents, total: formattedEvents.length });
      } catch (error: any) {
        console.error('❌ Erro ao listar eventos públicos:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao listar eventos' });
      }
    }

    // --- Event Registration Endpoints (for mobile app) ---
    // GET check if user is registered in event
    if (path.startsWith('/api/events/') && path.endsWith('/registration') && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        // Extract event ID from path
        const eventId = path.replace('/api/events/', '').replace('/registration', '');
        
        // Get user from token
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        let userId = null;
        if (token) {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            userId = decoded.userId || decoded.id;
          } catch (e) {
            // Token inválido, continuar sem userId
          }
        }
        
        if (!userId) {
          return res.status(200).json({ isRegistered: false });
        }
        
        const registration = await db.eventRegistration.findUnique({
          where: {
            eventId_userId: {
              eventId,
              userId
            }
          }
        });
        
        return res.status(200).json({ 
          isRegistered: !!registration && registration.status === 'REGISTERED',
          registration: registration ? {
            id: registration.id,
            status: registration.status,
            createdAt: registration.createdAt
          } : null
        });
      } catch (error: any) {
        console.error('❌ Erro ao verificar registro:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao verificar registro' });
      }
    }

    // POST register for event
    if (path.startsWith('/api/events/') && path.endsWith('/register') && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        // Extract event ID from path
        const eventId = path.replace('/api/events/', '').replace('/register', '');
        
        // Get user from token
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        // Check if event exists
        const event = await db.event.findUnique({
          where: { id: eventId }
        });
        
        if (!event) {
          return res.status(404).json({ error: 'Evento não encontrado' });
        }
        
        if (!event.isActive) {
          return res.status(400).json({ error: 'Evento não está mais ativo' });
        }
        
        if (new Date(event.startDate) < new Date()) {
          return res.status(400).json({ error: 'Evento já começou' });
        }
        
        // Check if event has capacity
        if (event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
          return res.status(400).json({ error: 'Evento lotado' });
        }
        
        // Check if user is already registered
        const existingRegistration = await db.eventRegistration.findUnique({
          where: {
            eventId_userId: {
              eventId,
              userId
            }
          }
        });
        
        if (existingRegistration) {
          if (existingRegistration.status === 'REGISTERED') {
            return res.status(400).json({ error: 'Você já está inscrito neste evento' });
          } else {
            // Re-register if previously cancelled
            await db.eventRegistration.update({
              where: { id: existingRegistration.id },
              data: { status: 'REGISTERED' }
            });
            await db.event.update({
              where: { id: eventId },
              data: { currentAttendees: { increment: 1 } }
            });
            return res.status(200).json({ 
              message: 'Inscrição realizada com sucesso',
              registration: existingRegistration
            });
          }
        }
        
        // Create registration
        const registration = await db.eventRegistration.create({
          data: {
            eventId,
            userId,
            status: 'REGISTERED',
            notes: body.notes || null
          }
        });
        
        // Update event attendee count
        await db.event.update({
          where: { id: eventId },
          data: {
            currentAttendees: { increment: 1 }
          }
        });
        
        return res.status(201).json({ 
          message: 'Inscrição realizada com sucesso! Nos vemos lá! 🎉',
          registration 
        });
      } catch (error: any) {
        console.error('❌ Erro ao registrar em evento:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao registrar em evento' });
      }
    }

    // DELETE cancel event registration
    if (path.startsWith('/api/events/') && path.endsWith('/register') && method === 'DELETE') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        // Extract event ID from path
        const eventId = path.replace('/api/events/', '').replace('/register', '');
        
        // Get user from token
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        // Find registration
        const registration = await db.eventRegistration.findUnique({
          where: {
            eventId_userId: {
              eventId,
              userId
            }
          }
        });
        
        if (!registration || registration.status !== 'REGISTERED') {
          return res.status(404).json({ error: 'Inscrição não encontrada' });
        }
        
        // Update registration status to CANCELLED
        await db.eventRegistration.update({
          where: { id: registration.id },
          data: { status: 'CANCELLED' }
        });
        
        // Decrease event attendee count
        await db.event.update({
          where: { id: eventId },
          data: {
            currentAttendees: { decrement: 1 }
          }
        });
        
        return res.status(200).json({ 
          message: 'Inscrição cancelada com sucesso',
          registration 
        });
      } catch (error: any) {
        console.error('❌ Erro ao cancelar inscrição:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao cancelar inscrição' });
      }
    }

    // --- Event Registrations List (admin) ---
    if (path.startsWith('/api/admin/events/') && path.endsWith('/registrations') && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        // Extract event ID from path
        const eventId = path.replace('/api/admin/events/', '').replace('/registrations', '');
        
        const registrations = await db.eventRegistration.findMany({
          where: {
            eventId,
            status: 'REGISTERED'
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            },
            event: {
              select: {
                title: true,
                startDate: true,
                location: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });
        
        return res.status(200).json({ 
          registrations: registrations.map(r => ({
            id: r.id,
            userId: r.userId,
            userName: r.user.name,
            userEmail: r.user.email,
            userPhone: r.user.phone,
            status: r.status,
            notes: r.notes,
            createdAt: r.createdAt,
            eventTitle: r.event.title,
            eventDate: r.event.startDate,
            eventLocation: r.event.location
          })),
          total: registrations.length
        });
      } catch (error: any) {
        console.error('❌ Erro ao listar inscrições:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao listar inscrições' });
      }
    }

    // --- Adoption Request Endpoint (for mobile app) ---
    if (path === '/api/adoptions/request' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { animalId, userId, name, email, phone, message, visitDate } = body;
        if (!animalId || (!userId && (!name || !email))) {
          return res.status(400).json({ error: 'ID do animal e dados de contato são obrigatórios' });
        }
        // Se userId não foi fornecido, criar ou buscar usuário pelo email
        let finalUserId = userId;
        if (!userId && email) {
          let user = await db.user.findUnique({ 
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              role: true,
            }
          });
          if (!user) {
            // Criar usuário temporário (sem senha, apenas para registro de interesse)
            user = await db.user.create({
              data: {
                email,
                name: name || 'Visitante',
                phone: phone || null,
                password: 'temp-' + Date.now(), // Senha temporária
                role: 'MEMBER',
                isActive: true
              }
            });
          }
          finalUserId = user.id;
        }
        if (!finalUserId) {
          return res.status(400).json({ error: 'Não foi possível identificar o usuário' });
        }
        // Criar registro de adoção
        const adoption = await db.adoption.create({
          data: {
            animalId,
            userId: finalUserId,
            status: 'PENDING',
            notes: message || `Interesse em visitar. ${visitDate ? `Data sugerida: ${visitDate}` : ''}`
          }
        });
        return res.status(201).json({ 
          message: 'Solicitação de visita registrada com sucesso! Um voluntário entrará em contato em breve.',
          adoption 
        });
      } catch (error: any) {
        console.error('❌ Erro ao registrar interesse em adoção:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao registrar interesse' });
      }
    }

    // ==========================================
    // APP CONFIGURATION ENDPOINTS
    // ==========================================

    // GET app configuration (public endpoint for mobile app)
    if (path === '/api/app/config' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const configs = await db.systemConfig.findMany({
          where: { isPublic: true },
        });
        console.log('📊 Configurações públicas encontradas:', configs.length);
        const configObject: any = {};
        configs.forEach((config) => {
          if (config.type === 'JSON') {
            try {
              configObject[config.key] = JSON.parse(config.value);
            } catch {
              configObject[config.key] = config.value;
            }
          } else if (config.type === 'BOOLEAN') {
            configObject[config.key] = config.value === 'true';
          } else if (config.type === 'NUMBER') {
            configObject[config.key] = parseFloat(config.value);
          } else {
            configObject[config.key] = config.value;
          }
        });
        console.log('✅ Configurações retornadas:', Object.keys(configObject));
        return res.status(200).json(configObject);
      } catch (error: any) {
        console.error('❌ Error loading app config:', error);
        return res.status(500).json({ error: 'Error loading configuration' });
      }
    }

    // GET app configuration (admin - all configs)
    if (path === '/api/admin/app/config' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        // Aceitar token demo ou JWT válido
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
            }
          } catch {
            // Token inválido
          }
        }
        if (!isAuthorized) {
          return res.status(401).json({ error: 'Invalid token' });
        }

        const configs = await db.systemConfig.findMany({
          orderBy: { key: 'asc' },
        });
        const configObject: any = {};
        configs.forEach((config) => {
          if (config.type === 'JSON') {
            try {
              configObject[config.key] = JSON.parse(config.value);
            } catch {
              configObject[config.key] = config.value;
            }
          } else if (config.type === 'BOOLEAN') {
            configObject[config.key] = config.value === 'true';
          } else if (config.type === 'NUMBER') {
            configObject[config.key] = parseFloat(config.value);
          } else {
            configObject[config.key] = config.value;
          }
        });
        return res.status(200).json(configObject);
      } catch (error: any) {
        console.error('❌ Error loading admin app config:', error);
        return res.status(500).json({ error: 'Error loading configuration' });
      }
    }

    // PUT app configuration (admin only)
    if (path === '/api/admin/app/config' && method === 'PUT') {
      console.log('📝 PUT /api/admin/app/config - Request received');
      const db = getPrisma();
      if (!db) {
        console.error('❌ Database not configured');
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          console.error('❌ No token provided');
          return res.status(401).json({ error: 'Unauthorized' });
        }
        // Aceitar token demo ou JWT válido
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
          console.log('✅ Demo token accepted');
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
              console.log('✅ Token verified, role:', decoded.role);
            }
          } catch {
            console.error('❌ Invalid token');
          }
        }
        if (!isAuthorized) {
          return res.status(401).json({ error: 'Invalid token' });
        }

        const { logoUrl, appName, appSubtitle, loginLogoUrl, loginAppName, loginIcon, loginIconImage } = body;

        // Update or create configs
        const configsToUpdate = [
          { key: 'app.logoUrl', value: logoUrl || '', type: 'STRING', isPublic: true },
          { key: 'app.name', value: appName || 'Liga do Bem', type: 'STRING', isPublic: true },
          { key: 'app.subtitle', value: appSubtitle || 'Botucatu', type: 'STRING', isPublic: true },
          { key: 'login.logoUrl', value: loginLogoUrl || '', type: 'STRING', isPublic: true },
          { key: 'login.appName', value: loginAppName || 'Liga do Bem', type: 'STRING', isPublic: true },
          { key: 'login.icon', value: loginIcon || '🐾', type: 'STRING', isPublic: true },
          { key: 'login.iconImage', value: loginIconImage || '', type: 'STRING', isPublic: true },
        ];

        for (const config of configsToUpdate) {
          await db.systemConfig.upsert({
            where: { key: config.key },
            update: {
              value: config.value,
              type: config.type as any,
              isPublic: config.isPublic,
            },
            create: {
              key: config.key,
              value: config.value,
              type: config.type as any,
              isPublic: config.isPublic,
            },
          });
        }

        return res.status(200).json({ message: 'Configuration updated successfully' });
      } catch (error: any) {
        console.error('❌ Error updating app config:', error);
        return res.status(500).json({ error: 'Error updating configuration' });
      }
    }

    // POST logs from mobile app
    if (path === '/api/logs' && method === 'POST') {
      try {
        const { logs } = body;
        if (Array.isArray(logs)) {
          // Logar os logs recebidos do app
          console.log('📱 Logs recebidos do app:', logs.length, 'logs');
          logs.forEach((log) => {
            const logData = log.data ? (typeof log.data === 'string' ? JSON.parse(log.data) : log.data) : null;
            console.log(`[${log.level.toUpperCase()}] ${log.timestamp} - ${log.message}`, logData || '');
          });
          return res.status(200).json({ message: 'Logs recebidos', count: logs.length });
        }
        return res.status(400).json({ error: 'Invalid logs format' });
      } catch (error: any) {
        console.error('❌ Error processing logs:', error);
        return res.status(500).json({ error: 'Error processing logs' });
      }
    }

    // --- User Profile Endpoints ---
    
    // GET user profile
    if (path === '/api/user/profile' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        // Buscar usuário COM CPF - usar select para garantir campos corretos
        let user: any;
        try {
          user = await db.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              avatar: true,
              notificationsEnabled: true,
              locationEnabled: true,
              role: true,
              createdAt: true,
              updatedAt: true,
              cpf: true, // Incluir CPF explicitamente
            }
          });
          
          console.log('🔍 GET /api/user/profile: CPF do Prisma:', user?.cpf, 'Tipo:', typeof user?.cpf);
          
        } catch (error: any) {
          // Se coluna CPF não existir, buscar sem ela
          if (error.message?.includes('cpf') || error.code === 'P2021') {
            console.warn('⚠️ Coluna cpf não existe, buscando sem ela');
            user = await db.user.findUnique({
              where: { id: userId },
              select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                avatar: true,
                notificationsEnabled: true,
                locationEnabled: true,
                role: true,
                createdAt: true,
                updatedAt: true,
              }
            });
            if (user) {
              (user as any).cpf = null;
            }
          } else {
            console.error('❌ GET /api/user/profile: Erro ao buscar usuário:', error);
            throw error;
          }
        }
        
        if (!user) {
          return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Serializar datas corretamente e garantir que todos os campos sejam JSON-safe
        const userResponse = {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone || null,
          avatar: user.avatar || null,
          notificationsEnabled: user.notificationsEnabled ?? true,
          locationEnabled: user.locationEnabled ?? true,
          role: user.role,
          createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
          updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
          cpf: user.cpf || null,
        };
        
        // Log do CPF
        console.log('📋 GET /api/user/profile: CPF retornado:', userResponse.cpf);
        
        // Retornar usuário serializado
        return res.status(200).json(userResponse);
      } catch (error: any) {
        console.error('❌ Erro ao buscar perfil:', error);
        console.error('❌ Erro detalhado:', {
          message: error?.message,
          code: error?.code,
          stack: error?.stack,
        });
        return res.status(500).json({ 
          error: 'Erro interno do servidor',
          details: process.env.NODE_ENV === 'development' ? error?.message : undefined
        });
      }
    }

    // PUT user profile
    if (path === '/api/user/profile' && method === 'PUT') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        // Verificar token em múltiplos lugares (header Authorization ou x-auth-token)
        const token = req.headers?.authorization?.replace('Bearer ', '') || 
                     req.headers?.['x-auth-token'] || 
                     req.headers?.['authorization']?.replace('Bearer ', '') ||
                     null;
        
        if (!token) {
          console.error('❌ PUT /api/user/profile: Token não fornecido');
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) {
            console.error('❌ PUT /api/user/profile: userId não encontrado no token', decoded);
            return res.status(401).json({ error: 'Token inválido - userId não encontrado' });
          }
        } catch (e: any) {
          console.error('❌ PUT /api/user/profile: Erro ao verificar token', e.message);
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }
        
        const { name, phone, cpf, avatar } = body;
        
        // BLOQUEAR ALTERAÇÃO DE CPF - CPF não pode ser alterado após cadastro
        if (cpf !== undefined) {
          // Buscar usuário atual para verificar se já tem CPF
          const currentUser = await db.user.findUnique({
            where: { id: userId },
            select: {
              cpf: true,
            }
          });

          if (currentUser) {
            const currentCpf = currentUser.cpf;
            const newCpf = cpf ? cpf.replace(/\D/g, '') : null;

            // Se usuário já tem CPF e está tentando alterar, bloquear
            if (currentCpf && newCpf && currentCpf !== newCpf) {
              return res.status(403).json({ 
                error: 'CPF não pode ser alterado após o cadastro. Esta medida previne fraudes.' 
              });
            }

            // Se usuário não tem CPF e está tentando adicionar, permitir (caso de migração)
            // Mas validar formato
            if (!currentCpf && newCpf) {
              if (newCpf.length !== 11) {
                return res.status(400).json({ error: 'CPF inválido. Deve conter 11 dígitos' });
              }

              // Verificar se CPF já está em uso por outro usuário
              try {
                const existingUser = await db.user.findFirst({
                  where: {
                    cpf: newCpf,
                    id: { not: userId }
                  }
                });
                
                if (existingUser) {
                  return res.status(400).json({ error: 'CPF já cadastrado para outro usuário' });
                }
              } catch (error: any) {
                if (error.message?.includes('cpf') || error.code === 'P2021') {
                  console.warn('⚠️ Coluna cpf não existe ainda, pulando verificação');
                } else {
                  throw error;
                }
              }
            }
          }
        }
        
        const updateData: any = {};
        if (name && name.trim()) {
          updateData.name = name.trim();
        }
        if (phone !== undefined) {
          updateData.phone = phone ? phone.trim() : null;
        }
        // CPF só pode ser adicionado se usuário não tiver CPF ainda (migração)
        // Nunca pode ser alterado se já existir
        if (cpf !== undefined) {
          const currentUser = await db.user.findUnique({
            where: { id: userId },
            select: { cpf: true }
          });
          
          // Só permitir adicionar CPF se não existir ainda
          if (!currentUser?.cpf && cpf) {
            const cpfClean = cpf.replace(/\D/g, '');
            if (cpfClean.length === 11) {
              updateData.cpf = cpfClean;
            }
          }
          // Se já tem CPF, não fazer nada (não atualizar)
        }
        if (avatar !== undefined) {
          updateData.avatar = avatar ? avatar.trim() : null;
        }
        
        console.log('🔄 PUT /api/user/profile: Atualizando perfil', { userId, updateData });
        
        // Tentar atualizar com cpf, mas tratar erro se coluna não existir
        let updatedUser;
        try {
          updatedUser = await db.user.update({
            where: { id: userId },
            data: updateData,
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              cpf: true,
              avatar: true,
              notificationsEnabled: true,
              locationEnabled: true,
              role: true,
            }
          });
        } catch (error: any) {
          // Se erro for relacionado a colunas não existirem, atualizar sem elas
          if (error.message?.includes('cpf') || error.message?.includes('notificationsEnabled') || error.message?.includes('locationEnabled') || error.code === 'P2021' || error.code === 'P2002') {
            console.warn('⚠️ Algumas colunas não existem ainda, atualizando sem elas');
            // Remover campos que não existem do updateData
            const { cpf: _, notificationsEnabled: __, locationEnabled: ___, ...updateDataWithoutNewFields } = updateData;
            updatedUser = await db.user.update({
              where: { id: userId },
              data: updateDataWithoutNewFields,
              select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                avatar: true,
                role: true,
              }
            });
            // Adicionar campos como null/default na resposta
            (updatedUser as any).cpf = null;
            (updatedUser as any).notificationsEnabled = true;
            (updatedUser as any).locationEnabled = true;
          } else {
            throw error;
          }
        }
        
        console.log('✅ PUT /api/user/profile: Perfil atualizado com sucesso', updatedUser.id);
        
        return res.status(200).json({
          message: 'Perfil atualizado com sucesso',
          user: updatedUser
        });
      } catch (error: any) {
        console.error('❌ Erro ao atualizar perfil:', error);
        // Se for erro do Prisma, retornar mensagem mais específica
        if (error.code === 'P2002') {
          return res.status(400).json({ error: 'CPF já cadastrado para outro usuário' });
        }
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        return res.status(500).json({ error: error?.message || 'Erro interno do servidor' });
      }
    }

    // GET user donations
    if (path === '/api/user/donations' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        const donations = await db.donation.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            description: true,
            createdAt: true,
          }
        });
        
        return res.status(200).json({ donations, total: donations.length });
      } catch (error: any) {
        console.error('❌ Erro ao buscar doações:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }

    // GET user adoptions
    if (path === '/api/user/adoptions' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        const adoptions = await db.adoption.findMany({
          where: { userId },
          include: {
            animal: {
              select: {
                id: true,
                name: true,
                species: true,
                breed: true,
                image: true,
              }
            }
          },
          orderBy: { applicationDate: 'desc' }
        });
        
        return res.status(200).json({ adoptions, total: adoptions.length });
      } catch (error: any) {
        console.error('❌ Erro ao buscar adoções:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }

    // GET user events
    if (path === '/api/user/events' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        const registrations = await db.eventRegistration.findMany({
          where: { userId },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                description: true,
                type: true,
                startDate: true,
                endDate: true,
                location: true,
                address: true,
                image: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        
        return res.status(200).json({ events: registrations, total: registrations.length });
      } catch (error: any) {
        console.error('❌ Erro ao buscar eventos:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }

    // POST user avatar upload
    if (path === '/api/user/avatar/upload' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        const { imageBase64 } = body;
        
        if (!imageBase64) {
          return res.status(400).json({ error: 'Imagem não fornecida' });
        }
        
        // Verificar se Cloudinary está configurado
        const cloudinaryInstance = getCloudinary();
        if (!cloudinaryInstance) {
          // Se Cloudinary não estiver configurado, retornar erro ou usar URL direta
          return res.status(503).json({ 
            error: 'Serviço de upload de imagens não configurado. Configure Cloudinary nas variáveis de ambiente.' 
          });
        }
        
        // Upload para Cloudinary
        try {
          const uploadResult = await new Promise((resolve, reject) => {
            cloudinaryInstance.uploader.upload(
              imageBase64,
              {
                folder: 'liga-do-bem/avatars',
                public_id: `avatar_${userId}_${Date.now()}`,
                overwrite: true,
                resource_type: 'image',
                transformation: [
                  { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                  { quality: 'auto' },
                ],
              },
              (error: any, result: any) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
          });
          
          const avatarUrl = (uploadResult as any).secure_url;
          
          // Atualizar avatar do usuário no banco
          await db.user.update({
            where: { id: userId },
            data: { avatar: avatarUrl },
          });
          
          return res.status(200).json({
            success: true,
            avatarUrl: avatarUrl,
            message: 'Avatar atualizado com sucesso',
          });
        } catch (uploadError: any) {
          console.error('❌ Erro ao fazer upload para Cloudinary:', uploadError);
          return res.status(500).json({ 
            error: 'Erro ao fazer upload da imagem',
            details: uploadError.message 
          });
        }
      } catch (error: any) {
        console.error('❌ Erro ao fazer upload de avatar:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }

    // GET user stats
    if (path === '/api/user/stats' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        const [donationsCount, donationsTotal, adoptionsCount, volunteerWorks] = await Promise.all([
          db.donation.count({ where: { userId, status: 'APPROVED' } }),
          db.donation.aggregate({
            where: { userId, status: 'APPROVED' },
            _sum: { amount: true }
          }),
          db.adoption.count({ where: { userId, status: 'COMPLETED' } }),
          db.volunteerWork.findMany({
            where: { userId, isActive: true },
            select: { startDate: true, endDate: true }
          }).catch(() => [])
        ]);
        
        const totalDonations = donationsTotal._sum.amount ? parseFloat(donationsTotal._sum.amount.toString()) : 0;
        
        // Calcular horas de voluntariado (simulado - baseado em trabalhos ativos)
        // Se não houver campo hours, usar contagem de trabalhos ativos
        const volunteerHours = volunteerWorks.length; // Simplificado por enquanto
        
        return res.status(200).json({
          donations: donationsCount,
          donationsTotal: totalDonations,
          adoptions: adoptionsCount,
          volunteerHours: volunteerHours,
        });
      } catch (error: any) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }

    // POST /api/admin/migrate - Executar migrations (apenas para administradores)
    if (path === '/api/admin/migrate' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      
      try {
        // Verificar token administrativo
        const adminToken = req.headers?.['x-admin-token'] || req.headers?.['authorization']?.replace('Bearer ', '');
        const validAdminTokens = [
          'demo-token-admin',
          'liga-do-bem-admin-2024',
          process.env.ADMIN_TOKEN || 'admin-secret-token'
        ];
        
        if (!adminToken || !validAdminTokens.includes(adminToken)) {
          return res.status(401).json({ error: 'Token administrativo inválido' });
        }

        console.log('🔄 Executando migration para adicionar coluna CPF...');
        
        // Executar SQL diretamente via Prisma
        try {
          // Verificar se a coluna já existe
          const checkColumn = await db.$queryRaw`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'cpf'
          ` as any[];
          
          if (checkColumn && checkColumn.length > 0) {
            console.log('✅ Coluna CPF já existe');
            return res.status(200).json({
              success: true,
              message: 'Coluna CPF já existe no banco de dados',
              alreadyExists: true
            });
          }
          
          // Adicionar coluna CPF
          await db.$executeRaw`
            ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cpf" TEXT
          `;
          
          // Criar índice único para CPF
          await db.$executeRaw`
            CREATE UNIQUE INDEX IF NOT EXISTS "users_cpf_key" 
            ON "users"("cpf") WHERE "cpf" IS NOT NULL
          `;
          
          console.log('✅ Migration executada com sucesso - Coluna CPF adicionada');
          
          return res.status(200).json({
            success: true,
            message: 'Migration executada com sucesso - Coluna CPF adicionada ao banco de dados',
            alreadyExists: false
          });
        } catch (migrationError: any) {
          // Se a coluna já existe ou o índice já existe, isso é OK
          if (migrationError.message?.includes('already exists') || 
              migrationError.message?.includes('duplicate key')) {
            console.log('✅ Coluna ou índice já existe');
            return res.status(200).json({
              success: true,
              message: 'Coluna CPF ou índice já existe',
              alreadyExists: true
            });
          }
          
          console.error('❌ Erro ao executar migration:', migrationError);
          return res.status(500).json({
            success: false,
            error: 'Erro ao executar migration',
            message: migrationError.message
          });
        }
      } catch (error: any) {
        console.error('❌ Erro ao executar migrations:', error);
        return res.status(500).json({ error: error?.message || 'Erro interno do servidor' });
      }
    }

    // 404 - Must be last, after all endpoints
    return res.status(404).json({ error: 'Not found', path });

  } catch (error: any) {
    console.error('❌ Error:', error?.message);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}


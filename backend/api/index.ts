// Vercel Serverless Function - Com Prisma

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

    // Admin dashboard
    if (path === '/api/admin/dashboard' && method === 'GET') {
      console.log('📊 Dashboard request');
      const db = getPrisma();
      if (db) {
        try {
          const [totalMembers, activePartners, totalAdoptions] = await Promise.all([
            db.user.count().catch((e) => { console.error('Error counting users:', e); return 0; }),
            db.partner.count({ where: { isActive: true } }).catch((e) => { console.error('Error counting partners:', e); return 0; }),
            db.adoption.count().catch((e) => { console.error('Error counting adoptions:', e); return 0; })
          ]);
          const response = {
            stats: {
              totalMembers,
              activePartners,
              totalAdoptions,
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
          take: 100
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

        // Find user
        const user = await db.user.findUnique({
          where: { email }
        });

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

        return res.status(200).json({
          message: 'Login realizado com sucesso',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role
          },
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
        const { email, name, phone, password } = body;
        
        if (!email || !name || !password) {
          return res.status(400).json({ error: 'Email, nome e senha são obrigatórios' });
        }

        console.log('📝 Register attempt:', email);

        // Check if user already exists
        const existingUser = await db.user.findUnique({
          where: { email }
        });

        if (existingUser) {
          return res.status(400).json({ error: 'Usuário já existe com este email' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await db.user.create({
          data: {
            email,
            name,
            phone: phone || null,
            password: hashedPassword,
            role: 'MEMBER'
          },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            createdAt: true
          }
        });

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

    // 404
    return res.status(404).json({ error: 'Not found', path });

  } catch (error: any) {
    console.error('❌ Error:', error?.message);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}

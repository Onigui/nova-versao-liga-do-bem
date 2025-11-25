// Vercel Serverless Function handler
// Este arquivo adapta o Express para funcionar no Vercel usando serverless-http

import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// NÃO importar rotas no topo - fazer lazy loading para evitar travamento
// import adminRoutes from '../src/routes/admin'; // Comentado - será carregado lazy
// import partnersRoutes from '../src/routes/partners'; // Comentado - Prisma no nível do módulo
// import authRoutes from '../src/routes/auth'; // Comentado - Prisma no nível do módulo
// import usersRoutes from '../src/routes/users'; // Comentado - Prisma no nível do módulo
// import animalsRoutes from '../src/routes/animals'; // Comentado - Prisma no nível do módulo
// import adoptionsRoutes from '../src/routes/adoptions'; // Comentado - Prisma no nível do módulo
// import eventsRoutes from '../src/routes/events'; // Comentado - Prisma no nível do módulo
// import donationsRoutes from '../src/routes/donations'; // Comentado - Prisma no nível do módulo
// import volunteersRoutes from '../src/routes/volunteers'; // Comentado - Prisma no nível do módulo
// import notificationsRoutes from '../src/routes/notifications'; // Comentado - Prisma no nível do módulo
// import paymentsRoutes from '../src/routes/payments'; // Comentado - Prisma no nível do módulo
// import transparencyRoutes from '../src/routes/transparency'; // Comentado - Prisma no nível do módulo

// Load environment variables
dotenv.config();

console.log('🚀 Iniciando servidor Express...');
console.log('📋 DATABASE_URL configurada?', !!process.env.DATABASE_URL);
console.log('📋 NODE_ENV:', process.env.NODE_ENV || 'not set');

const app = express();
console.log('✅ Express app criado');

// Handler explícito para OPTIONS (preflight) - DEVE vir ANTES de tudo
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, x-admin-token, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  return res.status(204).end();
});

// Middleware CORS
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || origin.includes('.vercel.app') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'x-admin-token', 'Accept']
}));

// Middleware adicional para garantir headers CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, x-admin-token, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== ENDPOINTS DE TESTE (SEMPRE RESPONDEM PRIMEIRO) ==========
// Estes endpoints DEVEM responder mesmo se tudo mais falhar

app.get('/api/ping', (req, res) => {
  console.log('🏓 Ping recebido');
  res.json({ 
    status: 'ok',
    message: 'Backend is alive!',
    timestamp: new Date().toISOString(),
    server: 'Vercel Serverless'
  });
});

app.get('/api/quick-test', (req, res) => {
  console.log('⚡ Quick test recebido');
  res.json({ 
    status: 'ok',
    message: 'Server is responding immediately',
    timestamp: new Date().toISOString(),
    server: 'Vercel Serverless'
  });
});

// Endpoint de teste para empresas SEM autenticação (apenas diagnóstico)
app.get('/api/test-companies', async (req, res) => {
  try {
    console.log('🔍 [TEST-COMPANIES] Iniciando teste...');
    const { getPrisma } = await import('../src/utils/prisma');
    const prisma = getPrisma();
    
    if (!prisma) {
      return res.json({
        error: 'Prisma not available',
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        companies: []
      });
    }
    
    const queryPromise = prisma.partner.findMany({ take: 5 });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 3000);
    });
    
    const companies = await Promise.race([queryPromise, timeoutPromise]) as any[];
    
    res.json({
      status: 'ok',
      companiesCount: companies.length,
      companies: companies.map(c => ({ id: c.id, name: c.name, category: c.category }))
    });
  } catch (error: any) {
    console.error('❌ [TEST-COMPANIES] Erro:', error.message);
    res.json({
      error: error.message,
      companies: []
    });
  }
});

// Test endpoint para empresas SEM autenticação
app.get('/api/test-companies', async (req, res) => {
  try {
    const { getPrisma } = await import('../src/utils/prisma');
    const prisma = getPrisma();
    
    if (!prisma) {
      return res.json({
        error: 'Prisma not available',
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        companies: []
      });
    }
    
    const queryPromise = prisma.partner.findMany({ take: 5 });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 3000);
    });
    
    const companies = await Promise.race([queryPromise, timeoutPromise]) as any[];
    
    res.json({
      status: 'ok',
      companiesCount: companies.length,
      companies: companies.map(c => ({ id: c.id, name: c.name, category: c.category }))
    });
  } catch (error: any) {
    res.json({
      error: error.message,
      companies: []
    });
  }
});

// ========== ROTAS PRINCIPAIS ==========
// Carregar rotas de forma lazy (só quando necessário) para evitar travamento na inicialização

// Variável para cache da rota admin (carregada uma vez)
let adminRoutesCache: any = null;

// Função para carregar rota admin lazy
async function loadAdminRoutes() {
  if (!adminRoutesCache) {
    try {
      console.log('🔄 Carregando rota admin (lazy)...');
      const module = await import('../src/routes/admin');
      adminRoutesCache = module.default;
      console.log('✅ Rota admin carregada (lazy)');
    } catch (error: any) {
      console.error('❌ Erro ao carregar rota admin:', error.message);
      throw error;
    }
  }
  return adminRoutesCache;
}

// Middleware para rota admin com lazy loading
app.use('/api/admin', async (req, res, next) => {
  try {
    const adminRoutes = await loadAdminRoutes();
    // Usar o router como middleware
    adminRoutes(req, res, next);
  } catch (error: any) {
    console.error('❌ Erro ao processar rota admin:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to load admin routes', 
        message: error.message 
      });
    }
  }
});

// app.use('/api/partners', partnersRoutes); // Comentado temporariamente - Prisma no nível do módulo
// app.use('/api/auth', authRoutes); // Comentado temporariamente - Prisma no nível do módulo
// app.use('/api/users', usersRoutes); // Comentado temporariamente - Prisma no nível do módulo
// app.use('/api/animals', animalsRoutes); // Comentado temporariamente - Prisma no nível do módulo
// app.use('/api/adoptions', adoptionsRoutes); // Comentado temporariamente - Prisma no nível do módulo
// app.use('/api/events', eventsRoutes); // Comentado temporariamente - Prisma no nível do módulo
// app.use('/api/donations', donationsRoutes); // Comentado temporariamente - Prisma no nível do módulo
// app.use('/api/volunteers', volunteersRoutes); // Comentado temporariamente - Prisma no nível do módulo
// app.use('/api/notifications', notificationsRoutes); // Comentado temporariamente - Prisma no nível do módulo
// app.use('/api/payments', paymentsRoutes); // Comentado temporariamente - Prisma no nível do módulo
// app.use('/api/transparency', transparencyRoutes); // Comentado temporariamente - Prisma no nível do módulo

// ========== HANDLERS DE ERRO ==========

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ [ERROR]', err?.message || err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// ========== EXPORT HANDLER ==========

console.log('✅ Configurando handler serverless...');

const handler = serverless(app, {
  binary: ['image/*', 'application/pdf']
});

console.log('✅ Handler serverless criado - servidor pronto!');

export default handler;

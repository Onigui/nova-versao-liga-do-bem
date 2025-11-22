// Vercel Serverless Function handler
// Este arquivo adapta o Express para funcionar no Vercel usando serverless-http

import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables PRIMEIRO
dotenv.config();

const app = express();

// Handler explícito para OPTIONS (preflight) - DEVE vir ANTES de tudo
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  console.log('🔍 OPTIONS request recebida de:', origin);
  
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

// Middleware CORS - Configuração permissiva para Vercel
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (origin.includes('.vercel.app') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'x-admin-token', 'Accept'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Middleware adicional para garantir headers CORS em TODAS as respostas
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
  res.setHeader('Access-Control-Max-Age', '86400');
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== ENDPOINTS DE TESTE (SEM DEPENDÊNCIAS) ==========

// Ping - SEMPRE deve responder rapidamente
app.get('/api/ping', (req, res) => {
  console.log('🏓 Ping recebido');
  res.json({ 
    status: 'ok',
    message: 'Backend is alive!',
    timestamp: new Date().toISOString()
  });
});

// Quick test
app.get('/api/quick-test', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Server is responding immediately',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint para empresas SEM autenticação (apenas para diagnóstico)
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
    
    const queryPromise = prisma.partner.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 3000);
    });
    
    const companies = await Promise.race([queryPromise, timeoutPromise]) as any[];
    
    res.json({
      status: 'ok',
      companiesCount: companies.length,
      companies: companies.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category
      }))
    });
  } catch (error: any) {
    console.error('❌ [TEST-COMPANIES] Erro:', error.message);
    res.json({
      error: error.message,
      companies: []
    });
  }
});

// Health check básico
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server is working!', 
    timestamp: new Date().toISOString(),
    env: {
      nodeEnv: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasDirectUrl: !!process.env.DIRECT_URL
    }
  });
});

// ========== CARREGAR ROTAS ==========
// Importar rotas de forma segura para não travar o servidor

let routesLoaded = false;

async function loadRoutes() {
  if (routesLoaded) return;
  
  try {
    console.log('📦 Carregando rotas...');
    
    const adminRoutes = (await import('../src/routes/admin')).default;
    const partnersRoutes = (await import('../src/routes/partners')).default;
    const authRoutes = (await import('../src/routes/auth')).default;
    const usersRoutes = (await import('../src/routes/users')).default;
    const animalsRoutes = (await import('../src/routes/animals')).default;
    const adoptionsRoutes = (await import('../src/routes/adoptions')).default;
    const eventsRoutes = (await import('../src/routes/events')).default;
    const donationsRoutes = (await import('../src/routes/donations')).default;
    const volunteersRoutes = (await import('../src/routes/volunteers')).default;
    const notificationsRoutes = (await import('../src/routes/notifications')).default;
    const paymentsRoutes = (await import('../src/routes/payments')).default;
    const transparencyRoutes = (await import('../src/routes/transparency')).default;

    app.use('/api/admin', adminRoutes);
    app.use('/api/partners', partnersRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/users', usersRoutes);
    app.use('/api/animals', animalsRoutes);
    app.use('/api/adoptions', adoptionsRoutes);
    app.use('/api/events', eventsRoutes);
    app.use('/api/donations', donationsRoutes);
    app.use('/api/volunteers', volunteersRoutes);
    app.use('/api/notifications', notificationsRoutes);
    app.use('/api/payments', paymentsRoutes);
    app.use('/api/transparency', transparencyRoutes);
    
    routesLoaded = true;
    console.log('✅ Rotas carregadas com sucesso');
  } catch (error: any) {
    console.error('❌ Erro ao carregar rotas:', error);
    // Continuar mesmo com erro - endpoints básicos funcionam
  }
}

// Carregar rotas de forma assíncrona após inicialização básica
loadRoutes().catch(err => {
  console.error('❌ Erro fatal ao carregar rotas:', err);
});

// ========== HANDLERS DE ERRO ==========

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Error handler global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ [GLOBAL ERROR]', err?.message || err);
  console.error('❌ [GLOBAL ERROR] Stack:', err?.stack);
  
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// ========== EXPORT HANDLER ==========

const handler = serverless(app, {
  binary: ['image/*', 'application/pdf']
});

export default handler;

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
// Importar rotas de forma síncrona (necessário no Vercel)
// Mas o Prisma dentro das rotas é lazy, então não trava

try {
  import('../src/routes/admin').then(module => {
    app.use('/api/admin', module.default);
  }).catch(err => console.error('❌ Erro ao carregar admin routes:', err));
  
  import('../src/routes/partners').then(module => {
    app.use('/api/partners', module.default);
  }).catch(err => console.error('❌ Erro ao carregar partners routes:', err));
  
  import('../src/routes/auth').then(module => {
    app.use('/api/auth', module.default);
  }).catch(err => console.error('❌ Erro ao carregar auth routes:', err));
  
  import('../src/routes/users').then(module => {
    app.use('/api/users', module.default);
  }).catch(err => console.error('❌ Erro ao carregar users routes:', err));
  
  import('../src/routes/animals').then(module => {
    app.use('/api/animals', module.default);
  }).catch(err => console.error('❌ Erro ao carregar animals routes:', err));
  
  import('../src/routes/adoptions').then(module => {
    app.use('/api/adoptions', module.default);
  }).catch(err => console.error('❌ Erro ao carregar adoptions routes:', err));
  
  import('../src/routes/events').then(module => {
    app.use('/api/events', module.default);
  }).catch(err => console.error('❌ Erro ao carregar events routes:', err));
  
  import('../src/routes/donations').then(module => {
    app.use('/api/donations', module.default);
  }).catch(err => console.error('❌ Erro ao carregar donations routes:', err));
  
  import('../src/routes/volunteers').then(module => {
    app.use('/api/volunteers', module.default);
  }).catch(err => console.error('❌ Erro ao carregar volunteers routes:', err));
  
  import('../src/routes/notifications').then(module => {
    app.use('/api/notifications', module.default);
  }).catch(err => console.error('❌ Erro ao carregar notifications routes:', err));
  
  import('../src/routes/payments').then(module => {
    app.use('/api/payments', module.default);
  }).catch(err => console.error('❌ Erro ao carregar payments routes:', err));
  
  import('../src/routes/transparency').then(module => {
    app.use('/api/transparency', module.default);
  }).catch(err => console.error('❌ Erro ao carregar transparency routes:', err));
} catch (error: any) {
  console.error('❌ Erro ao importar rotas:', error);
}

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

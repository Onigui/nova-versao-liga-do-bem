// Vercel Serverless Function handler
// Este arquivo adapta o Express para funcionar no Vercel usando serverless-http

import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Importar rotas de forma síncrona (normal)
// O Prisma dentro das rotas é lazy (getPrisma()), então não trava na inicialização
import adminRoutes from '../src/routes/admin';
import partnersRoutes from '../src/routes/partners';
import authRoutes from '../src/routes/auth';
import usersRoutes from '../src/routes/users';
import animalsRoutes from '../src/routes/animals';
import adoptionsRoutes from '../src/routes/adoptions';
import eventsRoutes from '../src/routes/events';
import donationsRoutes from '../src/routes/donations';
import volunteersRoutes from '../src/routes/volunteers';
import notificationsRoutes from '../src/routes/notifications';
import paymentsRoutes from '../src/routes/payments';
import transparencyRoutes from '../src/routes/transparency';

// Load environment variables
dotenv.config();

const app = express();

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

app.get('/api/ping', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Backend is alive!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/quick-test', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Server is responding immediately',
    timestamp: new Date().toISOString()
  });
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

export default serverless(app, {
  binary: ['image/*', 'application/pdf']
});

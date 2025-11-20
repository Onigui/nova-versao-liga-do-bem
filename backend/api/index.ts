// Vercel Serverless Function handler
// Este arquivo adapta o Express para funcionar no Vercel usando serverless-http

import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Importar rotas
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

// Middleware CORS - Configuração permissiva para Vercel (incluindo preview deployments)
app.use(cors({
  origin: function(origin, callback) {
    // Permitir requisições sem origin (mobile apps, Postman, etc)
    if (!origin) {
      return callback(null, true);
    }
    
    // Permitir qualquer URL do Vercel (incluindo preview deployments como -pufx.vercel.app)
    if (origin.includes('.vercel.app') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Permitir tudo para facilitar (pode restringir depois)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'x-admin-token', 'Accept'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Middleware adicional para garantir headers CORS em TODAS as respostas (backup)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Sempre adicionar headers CORS
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

// Health check - SEM dependências
app.get('/api/test', (req, res) => {
  try {
    res.json({ 
      message: 'Server is working!', 
      timestamp: new Date().toISOString(),
      platform: 'Vercel Serverless',
      database: 'PostgreSQL via Prisma',
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasDirectUrl: !!process.env.DIRECT_URL
      }
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

// Health check com Prisma
app.get('/api/test-db', async (req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      await prisma.$connect();
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      await prisma.$disconnect();
      
      res.json({
        message: 'Database connection successful!',
        timestamp: new Date().toISOString(),
        test: result
      });
    } catch (dbError: any) {
      await prisma.$disconnect();
      res.status(500).json({
        error: 'Database connection failed',
        message: dbError.message
      });
    }
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to initialize Prisma',
      message: error.message
    });
  }
});

// Routes
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error:', err);
  console.error('❌ Error name:', err.name);
  console.error('❌ Error message:', err.message);
  console.error('❌ Error stack:', err.stack);
  
  // Se for erro de conexão do Prisma, retornar erro mais amigável
  if (err.name === 'PrismaClientInitializationError' || err.message?.includes('Can\'t reach database server')) {
    return res.status(503).json({
      error: 'Database connection error',
      message: 'Unable to connect to database. Please check environment variables.',
      ...(process.env.NODE_ENV !== 'production' && { 
        details: err.message,
        stack: err.stack 
      })
    });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Export handler for Vercel using serverless-http
export default serverless(app);


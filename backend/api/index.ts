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

// Health check - SEM dependências (sem autenticação)
app.get('/api/test', (req, res) => {
  try {
    console.log('✅ Health check chamado');
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
    console.error('❌ Erro no health check:', error);
    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

// Test endpoint para verificar se o backend está respondendo (sem autenticação)
app.get('/api/ping', (req, res) => {
  console.log('🏓 Ping recebido');
  res.json({ 
    status: 'ok',
    message: 'Backend is alive!',
    timestamp: new Date().toISOString()
  });
});

// Health check com Prisma
app.get('/api/test-db', async (req, res) => {
  try {
    console.log('🔍 Testando conexão com banco...');
    console.log('📋 DATABASE_URL existe?', !!process.env.DATABASE_URL);
    console.log('📋 DIRECT_URL existe?', !!process.env.DIRECT_URL);
    
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        error: 'DATABASE_URL não configurada',
        message: 'A variável de ambiente DATABASE_URL não está definida no Vercel'
      });
    }
    
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
    
    try {
      // Timeout de 5 segundos para conexão
      const connectPromise = prisma.$connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout after 5s')), 5000);
      });
      
      await Promise.race([connectPromise, timeoutPromise]);
      console.log('✅ Conectado ao banco');
      
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      await prisma.$disconnect();
      
      res.json({
        message: 'Database connection successful!',
        timestamp: new Date().toISOString(),
        test: result,
        databaseUrl: process.env.DATABASE_URL ? 'Configurada (oculta)' : 'Não configurada'
      });
    } catch (dbError: any) {
      console.error('❌ Erro na conexão:', dbError.message);
      try {
        await prisma.$disconnect();
      } catch (e) {
        // Ignorar erro ao desconectar
      }
      res.status(500).json({
        error: 'Database connection failed',
        message: dbError.message,
        hint: 'Verifique se DATABASE_URL está configurada no Vercel'
      });
    }
  } catch (error: any) {
    console.error('❌ Erro ao inicializar Prisma:', error.message);
    res.status(500).json({
      error: 'Failed to initialize Prisma',
      message: error.message
    });
  }
});

// Endpoint de diagnóstico completo
app.get('/api/diagnostic', async (req, res) => {
  const diagnostic: any = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'not set',
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasDirectUrl: !!process.env.DIRECT_URL,
      hasJwtSecret: !!process.env.JWT_SECRET,
      databaseUrlLength: process.env.DATABASE_URL?.length || 0
    },
    prisma: {
      status: 'unknown'
    }
  };
  
  // Testar Prisma
  try {
    if (!process.env.DATABASE_URL) {
      diagnostic.prisma.status = 'DATABASE_URL not configured';
      diagnostic.prisma.error = 'DATABASE_URL environment variable is missing';
    } else {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      try {
        const connectPromise = prisma.$connect();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 3000);
        });
        
        await Promise.race([connectPromise, timeoutPromise]);
        diagnostic.prisma.status = 'connected';
        
        // Tentar uma query simples
        const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`;
        diagnostic.prisma.tables = result;
        
        await prisma.$disconnect();
      } catch (dbError: any) {
        diagnostic.prisma.status = 'connection failed';
        diagnostic.prisma.error = dbError.message;
        try {
          await prisma.$disconnect();
        } catch (e) {
          // Ignorar
        }
      }
    }
  } catch (error: any) {
    diagnostic.prisma.status = 'initialization failed';
    diagnostic.prisma.error = error.message;
  }
  
  res.json(diagnostic);
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


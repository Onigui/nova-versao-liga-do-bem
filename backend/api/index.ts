// Vercel Serverless Function handler - VERSÃO ULTRA MINIMALISTA
// Garante que o servidor SEMPRE responde

console.log('🚀 [INIT] Carregando módulos...');

// Importar apenas o essencial de forma síncrona
import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

console.log('✅ Módulos carregados');

// Configurar dotenv
dotenv.config();

console.log('✅ Dotenv configurado');
console.log('📋 DATABASE_URL:', !!process.env.DATABASE_URL ? 'Configurada' : 'NÃO configurada');

// Criar app Express
const app = express();

console.log('✅ Express app criado');

// CORS básico
app.use(cors({
  origin: true,
  credentials: true
}));

// Headers CORS em todas as respostas
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

// Handler OPTIONS
app.options('*', (req, res) => {
  res.status(204).end();
});

// Endpoint ping - SEMPRE responde primeiro
app.get('/api/ping', (req, res) => {
  console.log('🏓 Ping recebido');
  res.json({ 
    status: 'ok',
    message: 'Backend is alive!',
    timestamp: new Date().toISOString()
  });
});

app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is alive!' });
});

// Carregar rota admin lazy (só quando necessário)
let adminRouter: any = null;

app.use('/api/admin', async (req, res, next) => {
  try {
    if (!adminRouter) {
      console.log('🔄 Carregando rota admin (lazy)...');
      const adminModule = await import('../src/routes/admin');
      adminRouter = adminModule.default;
      console.log('✅ Rota admin carregada');
    }
    adminRouter(req, res, next);
  } catch (error: any) {
    console.error('❌ Erro ao carregar/admin:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to load admin routes', 
        message: error.message 
      });
    }
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('❌ Error:', err?.message || err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error'
    });
  }
});

// Criar handler serverless
console.log('✅ Criando handler serverless...');

const handler = serverless(app, {
  binary: ['image/*', 'application/pdf']
});

console.log('✅ Handler serverless criado - PRONTO!');

export default handler;

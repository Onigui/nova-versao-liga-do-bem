// Vercel Serverless Function handler - VERSÃO SEM PRISMA
// Para diagnosticar se o problema é o Prisma

console.log('🚀 [INIT] Iniciando servidor...');

import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';

console.log('✅ Módulos básicos carregados');

const app = express();

// CORS
app.use(cors({ origin: true, credentials: true }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, x-admin-token, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

app.use(express.json());

// OPTIONS handler
app.options('*', (req, res) => res.status(204).end());

// Ping - resposta imediata
app.get('/api/ping', (req, res) => {
  console.log('🏓 Ping!');
  res.json({ 
    status: 'ok',
    message: 'Backend alive!',
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV
    }
  });
});

app.get('/ping', (req, res) => {
  res.json({ status: 'ok' });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Test OK',
    timestamp: new Date().toISOString()
  });
});

// Admin login - versão demo sem banco
app.post('/api/admin/login', (req, res) => {
  console.log('🔐 Login attempt');
  const { email, password } = req.body;
  
  // Demo login
  if (email === 'admin@ligadobem.com' && (password === 'admin123' || password === 'demo123')) {
    res.json({
      success: true,
      token: 'demo-token-' + Date.now(),
      user: {
        id: 'demo-1',
        name: 'Admin Demo',
        email: email,
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({ error: 'Credenciais inválidas' });
  }
});

// Admin companies - dados demo
app.get('/api/admin/companies', (req, res) => {
  console.log('🏢 Get companies');
  res.json({
    companies: [
      { id: '1', name: 'Empresa Demo 1', category: 'Restaurante', status: 'active', discount: '10%' },
      { id: '2', name: 'Empresa Demo 2', category: 'Pet Shop', status: 'pending', discount: '15%' }
    ],
    total: 2
  });
});

// 404
app.use((req, res) => {
  console.log('❌ 404:', req.method, req.path);
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('❌ Error:', err?.message);
  res.status(500).json({ error: err?.message || 'Internal error' });
});

console.log('✅ Servidor configurado');

const handler = serverless(app);

console.log('✅ Handler pronto!');

export default handler;

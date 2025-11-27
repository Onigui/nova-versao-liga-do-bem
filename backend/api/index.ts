// Vercel Serverless Function handler

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

// Log all requests
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} (originalUrl: ${req.originalUrl})`);
  next();
});

// OPTIONS handler
app.options('*', (req, res) => res.status(204).end());

// Root
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Liga do Bem API' });
});

// Ping
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin login
app.post('/admin/login', (req, res) => {
  console.log('🔐 Login attempt');
  const { email, password } = req.body;
  
  if (email === 'admin@ligadobem.com' && (password === 'admin123' || password === 'demo123')) {
    res.json({
      success: true,
      token: 'demo-token-' + Date.now(),
      user: { id: 'demo-1', name: 'Admin Demo', email, role: 'admin' }
    });
  } else {
    res.status(401).json({ error: 'Credenciais inválidas' });
  }
});

// Admin dashboard
app.get('/admin/dashboard', (req, res) => {
  res.json({
    totalCompanies: 2,
    totalMembers: 10,
    pendingApprovals: 1,
    revenue: 5000
  });
});

// Admin companies
app.get('/admin/companies', (req, res) => {
  console.log('🏢 Get companies');
  res.json({
    companies: [
      { id: '1', name: 'Empresa Demo 1', category: 'Restaurante', status: 'active', discount: '10%', location: 'Centro' },
      { id: '2', name: 'Empresa Demo 2', category: 'Pet Shop', status: 'pending', discount: '15%', location: 'Zona Sul' }
    ],
    total: 2
  });
});

// Admin members
app.get('/admin/members', (req, res) => {
  res.json({
    members: [
      { id: '1', name: 'Membro 1', email: 'membro1@test.com', status: 'active' },
      { id: '2', name: 'Membro 2', email: 'membro2@test.com', status: 'active' }
    ],
    total: 2
  });
});

// 404
app.use((req, res) => {
  console.log('❌ 404:', req.method, req.path);
  res.status(404).json({ error: 'Not found', path: req.path, originalUrl: req.originalUrl });
});

console.log('✅ Servidor configurado');

const handler = serverless(app, { basePath: '/api' });

console.log('✅ Handler pronto!');

export default handler;

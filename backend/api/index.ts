// Vercel Serverless Function handler - VERSÃO MINIMALISTA
// Garante que o servidor SEMPRE responde, mesmo se houver erro

console.log('🚀 [INIT] Iniciando handler do Vercel...');

// Handler mínimo que SEMPRE responde
export default async function handler(req: any, res: any) {
  console.log('📥 [HANDLER] Requisição recebida:', req.method, req.url);
  
  try {
    // Carregar tudo de forma lazy
    const serverless = (await import('serverless-http')).default;
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;
    const dotenv = (await import('dotenv')).default;
    
    dotenv.config();
    
    const app = express();
    
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
    
    // Carregar rota admin lazy
    let adminRoutesLoaded = false;
    app.use('/api/admin', async (req, res, next) => {
      if (!adminRoutesLoaded) {
        try {
          console.log('🔄 Carregando rota admin...');
          const { default: adminRoutes } = await import('../src/routes/admin');
          app.use('/api/admin', adminRoutes);
          adminRoutesLoaded = true;
          console.log('✅ Rota admin carregada');
          // Reprocessar requisição
          adminRoutes(req, res, next);
        } catch (error: any) {
          console.error('❌ Erro ao carregar admin:', error.message);
          res.status(500).json({ error: 'Failed to load admin routes', message: error.message });
        }
      } else {
        next();
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
    const serverlessHandler = serverless(app, {
      binary: ['image/*', 'application/pdf']
    });
    
    console.log('✅ Handler serverless criado');
    
    // Executar handler
    return serverlessHandler(req, res);
    
  } catch (error: any) {
    console.error('❌ Erro crítico no handler:', error?.message || error);
    console.error('❌ Stack:', error?.stack);
    
    // SEMPRE responder, mesmo com erro
    if (!res.headersSent) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      res.status(500).json({
        error: 'Server initialization error',
        message: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
}

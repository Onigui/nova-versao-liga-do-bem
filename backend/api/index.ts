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

// Middleware CORS
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.ADMIN_URL,
      process.env.WEB_URL,
      'https://nova-versao-liga-do-bem-admin.vercel.app',
      'https://nova-versao-liga-do-bem-web.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
      'http://localhost:19006'
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('.vercel.app')) {
      callback(null, true);
    } else {
      callback(null, true); // Permitir tudo
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'x-admin-token', 'Accept'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server is working!', 
    timestamp: new Date().toISOString(),
    platform: 'Vercel Serverless',
    database: 'PostgreSQL via Prisma'
  });
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
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Export handler for Vercel using serverless-http
export default serverless(app);


import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import animalRoutes from './routes/animals';
import adoptionRoutes from './routes/adoptions';
import partnerRoutes from './routes/partners';
import eventRoutes from './routes/events';
import donationRoutes from './routes/donations';
import volunteerRoutes from './routes/volunteers';
import notificationRoutes from './routes/notifications';
import paymentRoutes from './routes/payments';
import transparencyRoutes from './routes/transparency';
import adminRoutes from './routes/admin';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// Load environment variables
dotenv.config();

// Import Prisma client
import { PrismaClient } from '@prisma/client';

// Initialize Prisma client
const prisma = new PrismaClient();

// Function to ensure database is ready
async function ensureDatabaseReady() {
  try {
    console.log('🔍 Verificando banco de dados...');
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Conexão com banco de dados estabelecida');
    
    // Check if users table exists by trying a simple query
    try {
      await prisma.user.findMany({ take: 1 });
      console.log('✅ Tabela users existe');
    } catch (error: any) {
      if (error.code === 'P2021') {
        console.log('⚠️ Tabela users não existe, criando...');
        
        // Create users table manually
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "users" (
            "id" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "password" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "phone" TEXT,
            "avatar" TEXT,
            "role" TEXT NOT NULL DEFAULT 'MEMBER',
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "users_pkey" PRIMARY KEY ("id")
          );
        `;
        
        // Create unique index for email
        await prisma.$executeRaw`
          CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
        `;
        
        console.log('✅ Tabela users criada com sucesso');
        
        // Test the table by inserting a test user
        try {
          await prisma.$executeRaw`
            INSERT INTO "users" ("id", "email", "password", "name", "role", "isActive", "createdAt", "updatedAt")
            VALUES ('test-id', 'test@test.com', 'hashed-password', 'Test User', 'MEMBER', true, NOW(), NOW())
            ON CONFLICT ("id") DO NOTHING;
          `;
          console.log('✅ Teste de inserção na tabela users funcionou');
        } catch (insertError) {
          console.log('⚠️ Erro ao testar inserção na tabela:', insertError);
        }
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar banco de dados:', error);
    process.exit(1);
  }
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.MOBILE_URL || 'exp://localhost:19000'
    ],
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    error: 'Muitas tentativas. Tente novamente em alguns minutos.'
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(limiter);
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.MOBILE_URL || 'exp://localhost:19000',
      'http://localhost:19000',
      'http://localhost:19001',
      'http://localhost:19002',
      'exp://localhost:19000',
      'exp://localhost:19001',
      'exp://localhost:19002'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/animals', animalRoutes);
app.use('/api/adoptions', adoptionRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/transparency', transparencyRoutes);
app.use('/api/admin', adminRoutes);

// Socket.io for real-time notifications
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-user-room', (userId: string) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Ensure database is ready before starting server
    await ensureDatabaseReady();
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

export default app;

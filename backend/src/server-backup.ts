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
import partnerRoutes from './routes/partners';
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
    
    // Always ensure UserRole enum exists first
    console.log('🔍 Verificando enum UserRole...');
    await prisma.$executeRaw`
      DO $$ BEGIN
        CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER', 'VOLUNTEER', 'PARTNER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('✅ Enum UserRole verificado/criado');
    
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
            "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
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
        
        // Criar tabela partners se não existir
        console.log('🔍 Verificando tabela partners...');
        try {
          await prisma.partner.findMany({ take: 1 });
          console.log('✅ Tabela partners existe');
        } catch (partnerError: any) {
          if (partnerError.code === 'P2021') {
            console.log('⚠️ Tabela partners não existe, criando...');
            
            await prisma.$executeRaw`
              CREATE TABLE IF NOT EXISTS "partners" (
                "id" TEXT NOT NULL,
                "name" TEXT NOT NULL,
                "description" TEXT,
                "category" TEXT NOT NULL,
                "email" TEXT,
                "phone" TEXT,
                "website" TEXT,
                "logo" TEXT,
                "address" TEXT NOT NULL,
                "latitude" DOUBLE PRECISION,
                "longitude" DOUBLE PRECISION,
                "city" TEXT NOT NULL,
                "state" TEXT NOT NULL,
                "zipCode" TEXT NOT NULL,
                "isActive" BOOLEAN NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL,
                CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
              );
            `;
            
            console.log('✅ Tabela partners criada com sucesso');
            
            // Inserir dados de exemplo
            await prisma.$executeRaw`
              INSERT INTO "partners" ("id", "name", "description", "category", "email", "phone", "address", "city", "state", "zipCode", "latitude", "longitude", "isActive", "createdAt", "updatedAt")
              VALUES 
                ('partner-1', 'Pet Shop Amigo', 'Pet shop especializado em cuidados para animais', 'Pet Shop', 'contato@petshopamigo.com.br', '(14) 99876-5432', 'Rua das Flores, 123', 'Botucatu', 'SP', '18608-000', -22.8858, -48.4440, true, NOW(), NOW()),
                ('partner-2', 'Clínica Veterinária Vida', 'Clínica veterinária 24h com emergência', 'Veterinário', 'contato@clinicavida.com.br', '(14) 99876-5433', 'Av. Principal, 456', 'Botucatu', 'SP', '18608-100', -22.8850, -48.4430, true, NOW(), NOW()),
                ('partner-3', 'Farmácia Animal', 'Farmácia especializada em medicamentos veterinários', 'Farmácia', 'contato@farmaciaanimal.com.br', '(14) 99876-5434', 'Rua Central, 789', 'Botucatu', 'SP', '18608-200', -22.8840, -48.4420, true, NOW(), NOW())
              ON CONFLICT ("id") DO NOTHING;
            `;
            
            console.log('✅ Dados de exemplo inseridos na tabela partners');
          } else {
            throw partnerError;
          }
        }
        
      } else {
        throw error;
      }
    }
    
    // Garantir que existe um usuário admin usando SQL direto
    console.log('🔍 Verificando usuário admin...');
    try {
      const adminCheck = await prisma.$queryRaw<any[]>`
        SELECT * FROM users WHERE email = 'admin@ligadobem.com' LIMIT 1;
      `;
      
      if (adminCheck.length === 0) {
        console.log('⚠️ Usuário admin não existe, criando...');
        
        await prisma.$executeRaw`
          INSERT INTO users (id, email, password, name, role, "isActive", "createdAt", "updatedAt")
          VALUES (
            gen_random_uuid()::text,
            'admin@ligadobem.com',
            'demo123',
            'Administrador',
            'ADMIN'::"UserRole",
            true,
            NOW(),
            NOW()
          )
          ON CONFLICT (email) DO NOTHING;
        `;
        
        console.log('✅ Usuário admin criado com sucesso');
      } else {
        console.log('✅ Usuário admin já existe:', adminCheck[0].id);
      }
    } catch (adminError: any) {
      console.error('⚠️ Erro ao verificar/criar admin:', adminError.message);
      // Não faz exit, apenas avisa
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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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
app.use('/api/partners', partnerRoutes);
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

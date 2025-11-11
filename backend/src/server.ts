import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Importar rotas
import adminRoutes from './routes/admin';
import partnersRoutes from './routes/partners';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import animalsRoutes from './routes/animals';
import adoptionsRoutes from './routes/adoptions';
import eventsRoutes from './routes/events';
import donationsRoutes from './routes/donations';
import volunteersRoutes from './routes/volunteers';
import notificationsRoutes from './routes/notifications';
import paymentsRoutes from './routes/payments';
import transparencyRoutes from './routes/transparency';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Middleware CORS mais permissivo - CORRIGIDO
app.use(cors({
  origin: function(origin, callback) {
    // Permitir requisições sem origin (como apps mobile, Postman, etc)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://nova-versao-liga-do-bem-admin.onrender.com',
      'https://nova-versao-liga-do-bem-web.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
      'http://localhost:19006'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Para desenvolvimento, permitir qualquer origin
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(null, true); // Temporariamente permitir tudo para debug
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'x-admin-token', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200
}));

// Middleware adicional para garantir headers CORS em todas as respostas
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, x-admin-token, Accept');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Função para inicializar o banco de dados
async function ensureDatabaseReady() {
  try {
    console.log('🔧 Verificando banco de dados...');
    
    // Verificar se as tabelas existem
    await prisma.$queryRaw`
      SELECT 1 FROM users LIMIT 1;
    `;
    
    console.log('✅ Tabela users existe');
    
    // Verificar se existe admin - usar ANY para evitar erro de tipo
    const adminExists = await prisma.user.findFirst({
      where: { 
        role: {
          equals: 'ADMIN'
        }
      }
    });

    if (!adminExists) {
      console.log('⚠️ Admin não existe ainda - use o script create-admin.js para criar');
      // Não criar aqui - já existe o script dedicado
    }

    // Verificar se existem parceiros
    const partnersCount = await prisma.partner.count();
    if (partnersCount === 0) {
      console.log('🏢 Criando parceiros de exemplo...');
      await prisma.partner.createMany({
        data: [
          {
            name: 'Pet Shop Amigo',
            description: 'Pet shop especializado em cuidados para animais',
            category: 'Pet Shop',
            email: 'contato@petshopamigo.com.br',
            phone: '(14) 99876-5432',
            address: 'Rua das Flores, 123',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-000',
            latitude: -22.8858,
            longitude: -48.4440,
            isActive: true
          },
          {
            name: 'Clínica Veterinária São Francisco',
            description: 'Clínica veterinária completa com emergência 24h',
            category: 'Veterinária',
            email: 'contato@vetsaofrancisco.com.br',
            phone: '(14) 3812-3456',
            address: 'Av. São Francisco, 456',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-100',
            latitude: -22.8758,
            longitude: -48.4340,
            isActive: true
          },
          {
            name: 'Hotel para Cães e Gatos',
            description: 'Hotel e creche para pets com atividades recreativas',
            category: 'Hotel Pet',
            email: 'reservas@hotelpet.com.br',
            phone: '(14) 3812-7890',
            address: 'Rua dos Animais, 789',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-200',
            latitude: -22.8658,
            longitude: -48.4240,
            isActive: true
          },
          {
            name: 'Adoção Responsável Botucatu',
            description: 'ONG especializada em adoção de animais abandonados',
            category: 'ONG',
            email: 'adocao@botucatu.com.br',
            phone: '(14) 3812-1111',
            address: 'Rua da Solidariedade, 321',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-300',
            latitude: -22.8558,
            longitude: -48.4140,
            isActive: true
          },
          {
            name: 'Farmácia Veterinária Central',
            description: 'Farmácia especializada em medicamentos veterinários',
            category: 'Farmácia',
            email: 'farmacia@veterinaria.com.br',
            phone: '(14) 3812-2222',
            address: 'Rua Central, 654',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-400',
            latitude: -22.8458,
            longitude: -48.4040,
            isActive: false
          },
          {
            name: 'Pet Grooming Elegance',
            description: 'Salão de beleza e tosa para pets',
            category: 'Tosa',
            email: 'contato@petgrooming.com.br',
            phone: '(14) 3812-3333',
            address: 'Rua da Beleza, 987',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-500',
            latitude: -22.8358,
            longitude: -48.3940,
            isActive: true
          },
          {
            name: 'Loja de Ração Premium',
            description: 'Especializada em rações premium e acessórios',
            category: 'Pet Shop',
            email: 'vendas@racao.com.br',
            phone: '(14) 3812-4444',
            address: 'Rua das Rações, 147',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-600',
            latitude: -22.8258,
            longitude: -48.3840,
            isActive: false
          },
          {
            name: 'Centro de Adestramento Canino',
            description: 'Adestramento profissional e comportamento animal',
            category: 'Adestramento',
            email: 'adestramento@canino.com.br',
            phone: '(14) 3812-5555',
            address: 'Rua do Adestramento, 258',
            city: 'Botucatu',
            state: 'SP',
            zipCode: '18608-700',
            latitude: -22.8158,
            longitude: -48.3740,
            isActive: true
          }
        ]
      });
      console.log('✅ Parceiros criados');
    }

    // Verificar se existem membros
    const membersCount = await prisma.user.count({
      where: { 
        role: {
          equals: 'MEMBER'
        }
      }
    });
    if (membersCount === 0) {
      console.log('👥 Criando membros de exemplo...');
      await prisma.user.createMany({
        data: [
          {
            email: 'joao@email.com',
            password: 'senha123',
            name: 'João Silva',
            phone: '(14) 99999-9999',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'maria@email.com',
            password: 'senha123',
            name: 'Maria Santos',
            phone: '(14) 98888-8888',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'pedro@email.com',
            password: 'senha123',
            name: 'Pedro Oliveira',
            phone: '(14) 97777-7777',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'ana@email.com',
            password: 'senha123',
            name: 'Ana Costa',
            phone: '(14) 96666-6666',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'carlos@email.com',
            password: 'senha123',
            name: 'Carlos Ferreira',
            phone: '(14) 95555-5555',
            role: 'MEMBER',
            isActive: false
          },
          {
            email: 'lucia@email.com',
            password: 'senha123',
            name: 'Lucia Rodrigues',
            phone: '(14) 94444-4444',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'roberto@email.com',
            password: 'senha123',
            name: 'Roberto Alves',
            phone: '(14) 93333-3333',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'fernanda@email.com',
            password: 'senha123',
            name: 'Fernanda Lima',
            phone: '(14) 92222-2222',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'marcos@email.com',
            password: 'senha123',
            name: 'Marcos Pereira',
            phone: '(14) 91111-1111',
            role: 'MEMBER',
            isActive: true
          },
          {
            email: 'juliana@email.com',
            password: 'senha123',
            name: 'Juliana Martins',
            phone: '(14) 90000-0000',
            role: 'MEMBER',
            isActive: false
          }
        ]
      });
      console.log('✅ Membros criados');
    }

    console.log('✅ Banco de dados pronto!');
  } catch (error) {
    console.error('❌ Erro ao verificar banco de dados:', error);
  }
}

// Endpoint de teste básico
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server is working!', 
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL via Prisma'
  });
});

// Usar as rotas
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

// Inicializar banco de dados
ensureDatabaseReady();

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ Banco: PostgreSQL via Prisma`);
});
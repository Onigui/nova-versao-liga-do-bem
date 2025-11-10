import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// Middleware CORS mais permissivo
app.use(cors({
  origin: [
    'https://nova-versao-liga-do-bem-admin.onrender.com',
    'http://localhost:3000',
    'https://nova-versao-liga-do-bem-web.onrender.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token'],
  optionsSuccessStatus: 200
}));

// Middleware para lidar com preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Armazenamento em memória para simular persistência
let companiesData = [
  {
    id: 'partner-1',
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
    status: 'active',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'partner-2',
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
    status: 'active',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'partner-3',
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
    status: 'active',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'partner-4',
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
    status: 'active',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'partner-5',
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
    status: 'pending',
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'partner-6',
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
    status: 'active',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'partner-7',
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
    status: 'inactive',
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'partner-8',
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
    status: 'active',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let membersData = [
  {
    id: 'user-1',
    name: 'João Silva',
    email: 'joao@email.com',
    phone: '(14) 99999-9999',
    role: 'MEMBER',
    isActive: true,
    points: 150,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'user-2',
    name: 'Maria Santos',
    email: 'maria@email.com',
    phone: '(14) 98888-8888',
    role: 'MEMBER',
    isActive: true,
    points: 320,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'user-3',
    name: 'Pedro Oliveira',
    email: 'pedro@email.com',
    phone: '(14) 97777-7777',
    role: 'MEMBER',
    isActive: true,
    points: 85,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'user-4',
    name: 'Ana Costa',
    email: 'ana@email.com',
    phone: '(14) 96666-6666',
    role: 'MEMBER',
    isActive: true,
    points: 450,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'user-5',
    name: 'Carlos Ferreira',
    email: 'carlos@email.com',
    phone: '(14) 95555-5555',
    role: 'MEMBER',
    isActive: false,
    points: 25,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'user-6',
    name: 'Lucia Rodrigues',
    email: 'lucia@email.com',
    phone: '(14) 94444-4444',
    role: 'MEMBER',
    isActive: true,
    points: 280,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'user-7',
    name: 'Roberto Alves',
    email: 'roberto@email.com',
    phone: '(14) 93333-3333',
    role: 'MEMBER',
    isActive: true,
    points: 195,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'user-8',
    name: 'Fernanda Lima',
    email: 'fernanda@email.com',
    phone: '(14) 92222-2222',
    role: 'MEMBER',
    isActive: true,
    points: 520,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'user-9',
    name: 'Marcos Pereira',
    email: 'marcos@email.com',
    phone: '(14) 91111-1111',
    role: 'MEMBER',
    isActive: true,
    points: 75,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'user-10',
    name: 'Juliana Martins',
    email: 'juliana@email.com',
    phone: '(14) 90000-0000',
    role: 'MEMBER',
    isActive: false,
    points: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

// Admin test endpoint
app.get('/api/admin/test', (req, res) => {
  res.json({ 
    message: 'Admin endpoint working!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Partners endpoint (simplified)
app.get('/api/partners', (req, res) => {
  res.json({
    partners: [
      {
        id: 'partner-1',
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
      }
    ]
  });
});

// Admin login (simplified)
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'admin@ligadobem.com' && password === 'demo123') {
    res.json({
      message: 'Login realizado com sucesso',
      token: 'demo-admin-token',
      user: {
        id: 'admin-demo-id',
        email: 'admin@ligadobem.com',
        name: 'Administrador',
        role: 'ADMIN'
      }
    });
  } else {
    res.status(401).json({ message: 'Credenciais inválidas' });
  }
});

// Middleware para verificar token admin
function verifyAdminToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-admin-token'];
  
  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }
  
  // Para o servidor simplificado, aceitar qualquer token que não seja vazio
  if (token && token.length > 0) {
    console.log('✅ Token admin válido:', token.substring(0, 10) + '...');
    next();
  } else {
    return res.status(401).json({ message: 'Token inválido' });
  }
}

// Admin dashboard (simplified)
app.get('/api/admin/dashboard', verifyAdminToken, (req, res) => {
  const activePartners = companiesData.filter(c => c.isActive).length;
  const totalMembers = membersData.length;
  
  res.json({
    stats: {
      totalMembers,
      activePartners,
      totalAdoptions: 5,
      monthlyRevenue: 15680,
      totalUsers: totalMembers,
      totalPartners: companiesData.length,
      totalAnimals: 0,
      totalDonations: 0,
      monthlyGrowth: {
        users: 15,
        companies: 25,
        donations: 35,
        qrScans: 45
      }
    },
    recent: {
      users: membersData.slice(-5),
      partners: companiesData.slice(-5)
    }
  });
});

// Admin members (simplified)
app.get('/api/admin/members', verifyAdminToken, (req, res) => {
  res.json({
    members: membersData
  });
});

// Admin companies (simplified)
app.get('/api/admin/companies', verifyAdminToken, (req, res) => {
  res.json({
    companies: companiesData
  });
});

// Update company
app.put('/api/admin/companies/:id', verifyAdminToken, (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  console.log('✏️ Atualizando empresa:', id, updateData);

  // Encontrar e atualizar empresa no array
  const companyIndex = companiesData.findIndex(c => c.id === id);
  if (companyIndex === -1) {
    return res.status(404).json({ message: 'Empresa não encontrada' });
  }

  // Atualizar dados da empresa
  const updatedCompany = {
    ...companiesData[companyIndex],
    ...updateData,
    updatedAt: new Date().toISOString()
  };
  companiesData[companyIndex] = updatedCompany;

  res.json({
    message: 'Empresa atualizada com sucesso',
    company: companiesData[companyIndex]
  });
});

// Approve company
app.patch('/api/admin/companies/:id/approve', verifyAdminToken, (req, res) => {
  const { id } = req.params;

  console.log('✅ Aprovando empresa:', id);

  // Encontrar e aprovar empresa no array
  const companyIndex = companiesData.findIndex(c => c.id === id);
  if (companyIndex === -1) {
    return res.status(404).json({ message: 'Empresa não encontrada' });
  }

  // Aprovar empresa
  const approvedCompany = {
    ...companiesData[companyIndex],
    status: 'active',
    isActive: true,
    updatedAt: new Date().toISOString()
  };
  companiesData[companyIndex] = approvedCompany;

  res.json({
    message: 'Empresa aprovada com sucesso',
    company: companiesData[companyIndex]
  });
});

// Reject company
app.patch('/api/admin/companies/:id/reject', verifyAdminToken, (req, res) => {
  const { id } = req.params;

  console.log('❌ Rejeitando empresa:', id);

  // Encontrar e rejeitar empresa no array
  const companyIndex = companiesData.findIndex(c => c.id === id);
  if (companyIndex === -1) {
    return res.status(404).json({ message: 'Empresa não encontrada' });
  }

  // Rejeitar empresa
  const rejectedCompany = {
    ...companiesData[companyIndex],
    status: 'inactive',
    isActive: false,
    updatedAt: new Date().toISOString()
  };
  companiesData[companyIndex] = rejectedCompany;

  res.json({
    message: 'Empresa rejeitada com sucesso',
    company: companiesData[companyIndex]
  });
});

// Delete company
app.delete('/api/admin/companies/:id', verifyAdminToken, (req, res) => {
  const { id } = req.params;

  console.log('🗑️ Excluindo empresa:', id);

  // Encontrar e remover empresa do array
  const companyIndex = companiesData.findIndex(c => c.id === id);
  if (companyIndex === -1) {
    return res.status(404).json({ message: 'Empresa não encontrada' });
  }

  // Remover empresa
  companiesData.splice(companyIndex, 1);

  res.json({
    message: 'Empresa excluída com sucesso',
    id
  });
});

// Create company
app.post('/api/admin/companies', verifyAdminToken, (req, res) => {
  const newCompany = req.body;

  console.log('➕ Criando nova empresa:', newCompany);

  // Criar nova empresa
  const company = {
    id: `partner-${Date.now()}`,
    ...newCompany,
    status: 'pending',
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Adicionar ao array
  companiesData.push(company);

  res.json({
    message: 'Empresa criada com sucesso',
    company
  });
});

// Create member
app.post('/api/admin/members', verifyAdminToken, (req, res) => {
  const newMember = req.body;

  console.log('➕ Criando novo membro:', newMember);

  // Criar novo membro
  const member = {
    id: `user-${Date.now()}`,
    ...newMember,
    role: 'MEMBER',
    isActive: newMember.status === 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Adicionar ao array
  membersData.push(member);

  res.json({
    message: 'Membro criado com sucesso',
    member
  });
});

// Update member
app.put('/api/admin/members/:id', verifyAdminToken, (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  console.log('✏️ Atualizando membro:', id, updateData);

  // Encontrar e atualizar membro no array
  const memberIndex = membersData.findIndex(m => m.id === id);
  if (memberIndex === -1) {
    return res.status(404).json({ message: 'Membro não encontrado' });
  }

  // Atualizar dados do membro
  const updatedMember = {
    ...membersData[memberIndex],
    ...updateData,
    isActive: updateData.status === 'active',
    updatedAt: new Date().toISOString()
  };
  membersData[memberIndex] = updatedMember;

  res.json({
    message: 'Membro atualizado com sucesso',
    member: updatedMember
  });
});

// Delete member
app.delete('/api/admin/members/:id', verifyAdminToken, (req, res) => {
  const { id } = req.params;

  console.log('🗑️ Excluindo membro:', id);

  // Encontrar e remover membro do array
  const memberIndex = membersData.findIndex(m => m.id === id);
  if (memberIndex === -1) {
    return res.status(404).json({ message: 'Membro não encontrado' });
  }

  // Remover membro
  membersData.splice(memberIndex, 1);

  res.json({
    message: 'Membro excluído com sucesso',
    id
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor simplificado rodando na porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

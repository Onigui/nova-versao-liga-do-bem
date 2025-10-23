import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: ['https://nova-versao-liga-do-bem-admin.onrender.com', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

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
    createdAt: new Date().toISOString()
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
    createdAt: new Date().toISOString()
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
  companiesData[companyIndex] = {
    ...companiesData[companyIndex],
    ...updateData,
    updatedAt: new Date().toISOString()
  };

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
  companiesData[companyIndex] = {
    ...companiesData[companyIndex],
    status: 'active',
    isActive: true,
    updatedAt: new Date().toISOString()
  };

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
  companiesData[companyIndex] = {
    ...companiesData[companyIndex],
    status: 'inactive',
    isActive: false,
    updatedAt: new Date().toISOString()
  };

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

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor simplificado rodando na porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

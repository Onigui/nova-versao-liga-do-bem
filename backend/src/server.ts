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

// Admin dashboard (simplified)
app.get('/api/admin/dashboard', (req, res) => {
  res.json({
    stats: {
      totalUsers: 10,
      totalPartners: 3,
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
      users: [],
      partners: []
    }
  });
});

// Admin members (simplified)
app.get('/api/admin/members', (req, res) => {
  res.json({
    members: [
      {
        id: 'user-1',
        name: 'João Silva',
        email: 'joao@email.com',
        phone: '(14) 99999-9999',
        role: 'MEMBER',
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ]
  });
});

// Admin companies (simplified)
app.get('/api/admin/companies', (req, res) => {
  res.json({
    companies: [
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
        status: 'active',
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ]
  });
});

// Update company
app.put('/api/admin/companies/:id', (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  
  console.log('✏️ Atualizando empresa:', id, updateData);
  
  res.json({
    message: 'Empresa atualizada com sucesso',
    company: {
      id,
      ...updateData,
      updatedAt: new Date().toISOString()
    }
  });
});

// Approve company
app.patch('/api/admin/companies/:id/approve', (req, res) => {
  const { id } = req.params;
  
  console.log('✅ Aprovando empresa:', id);
  
  res.json({
    message: 'Empresa aprovada com sucesso',
    company: {
      id,
      status: 'active',
      isActive: true,
      updatedAt: new Date().toISOString()
    }
  });
});

// Reject company
app.patch('/api/admin/companies/:id/reject', (req, res) => {
  const { id } = req.params;
  
  console.log('❌ Rejeitando empresa:', id);
  
  res.json({
    message: 'Empresa rejeitada com sucesso',
    company: {
      id,
      status: 'inactive',
      isActive: false,
      updatedAt: new Date().toISOString()
    }
  });
});

// Delete company
app.delete('/api/admin/companies/:id', (req, res) => {
  const { id } = req.params;
  
  console.log('🗑️ Excluindo empresa:', id);
  
  res.json({
    message: 'Empresa excluída com sucesso',
    id
  });
});

// Create company
app.post('/api/admin/companies', (req, res) => {
  const newCompany = req.body;
  
  console.log('➕ Criando nova empresa:', newCompany);
  
  res.json({
    message: 'Empresa criada com sucesso',
    company: {
      id: `partner-${Date.now()}`,
      ...newCompany,
      status: 'pending',
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor simplificado rodando na porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

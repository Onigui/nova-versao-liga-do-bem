// Vercel Serverless Function - Versão simples sem serverless-http

export default function handler(req: any, res: any) {
  // CORS
  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, x-admin-token, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const path = req.url?.replace(/\?.*$/, '') || '/';
  const method = req.method || 'GET';

  console.log(`📥 ${method} ${path}`);

  // Routes
  if (path === '/api/ping' || path === '/ping') {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  if (path === '/api/admin/login' && method === 'POST') {
    const { email, password } = req.body || {};
    if (email === 'admin@ligadobem.com' && (password === 'admin123' || password === 'demo123')) {
      return res.status(200).json({
        success: true,
        token: 'demo-token-' + Date.now(),
        user: { id: 'demo-1', name: 'Admin Demo', email, role: 'admin' }
      });
    }
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  if (path === '/api/admin/dashboard') {
    return res.status(200).json({
      totalCompanies: 2,
      totalMembers: 10,
      pendingApprovals: 1,
      revenue: 5000
    });
  }

  if (path === '/api/admin/companies') {
    return res.status(200).json({
      companies: [
        { id: '1', name: 'Empresa Demo 1', category: 'Restaurante', status: 'active', discount: '10%', location: 'Centro' },
        { id: '2', name: 'Empresa Demo 2', category: 'Pet Shop', status: 'pending', discount: '15%', location: 'Zona Sul' }
      ],
      total: 2
    });
  }

  if (path === '/api/admin/members') {
    return res.status(200).json({
      members: [
        { id: '1', name: 'Membro 1', email: 'membro1@test.com', status: 'active' },
        { id: '2', name: 'Membro 2', email: 'membro2@test.com', status: 'active' }
      ],
      total: 2
    });
  }

  // 404
  return res.status(404).json({ error: 'Not found', path });
}

import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(req: IncomingMessage & { method?: string; headers: any }, res: ServerResponse & { setHeader: any; status?: any; end: any }) {
  // CORS headers - Permitir subdomínios Vercel
  const origin = (req.headers as any).origin;
  
  let allowOrigin = '*';
  if (origin) {
    // Se for subdomínio Vercel, permitir
    if (origin.includes('.vercel.app') || origin.includes('vercel.app') || origin.includes('localhost')) {
      allowOrigin = origin;
    }
  }
  
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, x-admin-token, Accept, Content-Length');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  // Import and use main handler
  return import('../index').then(mod => mod.default(req as any, res as any));
}

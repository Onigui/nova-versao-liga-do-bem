import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(req: IncomingMessage & { method?: string; headers: any }, res: ServerResponse & { setHeader: any; status?: any; end: any }) {
  // CORS headers
  const origin = (req.headers as any).origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, x-admin-token, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // Import and use main handler
  return import('../index').then(mod => mod.default(req as any, res as any));
}

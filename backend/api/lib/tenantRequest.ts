/**
 * Decide, no começo de cada requisição, em qual ONG ela roda (fase 2 do multi-ONG).
 *
 * Com MULTI_ORG_ISOLATION desligada não faz nada: a requisição segue exatamente como antes.
 * Ligada:
 * - rotas de sistema (login, cadastro, webhooks, plataforma, links públicos) → modo sistema;
 * - com token → a ONG do token (a equipe da plataforma pode pedir outra com X-Org-Id);
 * - sem token → a ONG pedida em X-Org / X-Org-Id (slug ou id), senão a Liga;
 * - crons → rodam uma vez para cada ONG ativa, cada uma isolada;
 * - ONG suspensa → 403 (menos para a equipe da plataforma).
 */
import jwt from 'jsonwebtoken';
import { DEFAULT_ORG, isolationOn, runAsSystem, runWithOrg } from './tenant';
import { getOrgSecret, isPlatformAdmin, orgIdForRequest } from './orgs';

type Org = { id: string; slug: string; status: string };
let orgsCache: { at: number; list: Org[] } | null = null;
const ORGS_TTL = 60 * 1000;
const secretsCache = new Map<string, { at: number; secrets: Record<string, string | null> }>();

export function clearTenantCaches() {
  orgsCache = null;
  secretsCache.clear();
}

async function orgs(db: any): Promise<Org[]> {
  if (orgsCache && Date.now() - orgsCache.at < ORGS_TTL) return orgsCache.list;
  const list: Org[] = await runAsSystem(() => db.$queryRawUnsafe(`SELECT id, slug, status FROM organizations`)).catch(() => []);
  orgsCache = { at: Date.now(), list: list || [] };
  return orgsCache.list;
}

async function findOrg(db: any, ref: string | null | undefined): Promise<Org | null> {
  const r = String(ref || '').trim().toLowerCase();
  if (!r) return null;
  return (await orgs(db)).find((o) => o.id.toLowerCase() === r || String(o.slug || '').toLowerCase() === r) || null;
}

async function orgSecrets(db: any, orgId: string) {
  if (orgId === DEFAULT_ORG) return undefined; // a Liga usa as variáveis da Vercel
  const hit = secretsCache.get(orgId);
  if (hit && Date.now() - hit.at < ORGS_TTL) return hit.secrets;
  const secrets: Record<string, string | null> = {
    PAGBANK_TOKEN: await getOrgSecret(db, orgId, 'PAGBANK_TOKEN'),
    PAGBANK_SANDBOX_TOKEN: await getOrgSecret(db, orgId, 'PAGBANK_SANDBOX_TOKEN'),
    ASAAS_API_KEY: await getOrgSecret(db, orgId, 'ASAAS_API_KEY'),
    ASAAS_WALLET_ID: await getOrgSecret(db, orgId, 'ASAAS_WALLET_ID'),
  };
  secretsCache.set(orgId, { at: Date.now(), secrets });
  return secrets;
}

const SYSTEM_PREFIXES = ['/api/ong/', '/api/auth/', '/api/webhooks/', '/api/platform/', '/api/public/'];
const SYSTEM_EXACT = new Set(['/api/platform-digest', '/api/admin/login', '/api/admin/org', '/api/orgs', '/api/health', '/api/excluir-conta', '/api/privacidade']);

export function isSystemPath(path: string) {
  return SYSTEM_EXACT.has(path) || path.startsWith('/api/orgs/') || SYSTEM_PREFIXES.some((p) => path.startsWith(p));
}

function header(req: any, name: string) {
  const v = req?.headers?.[name];
  return Array.isArray(v) ? String(v[0] || '') : v ? String(v) : '';
}

/** Token de quem chama: Authorization ou X-Admin-Token (o painel usa os dois). */
function claimsOf(req: any, secret: string): any | null {
  if (!secret) return null;
  const candidates = [header(req, 'authorization').replace(/^Bearer\s+/i, '').trim(), header(req, 'x-admin-token').trim()];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const c: any = jwt.verify(raw, secret);
      if (c && (c.userId || c.id)) return c;
    } catch {
      /* próximo */
    }
  }
  return null;
}

function pathOf(req: any) {
  try {
    return new URL(String(req?.url || '/'), 'http://x').pathname.replace(/\/+$/, '') || '/';
  } catch {
    return String(req?.url || '/').split('?')[0];
  }
}

function queryOf(req: any, key: string) {
  if (req?.query && req.query[key] != null) return String(req.query[key]);
  try {
    return new URL(String(req?.url || '/'), 'http://x').searchParams.get(key) || '';
  } catch {
    return '';
  }
}

function bodyOf(req: any) {
  const b = req?.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return {};
    }
  }
  return {};
}

/** Resposta de mentira para rodar o cron uma vez por ONG e juntar os resultados. */
function collector() {
  const out: any = { statusCode: 200, body: undefined, headers: {} as Record<string, any> };
  const res: any = {
    statusCode: 200,
    setHeader: (k: string, v: any) => {
      out.headers[k.toLowerCase()] = v;
      return res;
    },
    getHeader: (k: string) => out.headers[k.toLowerCase()],
    removeHeader: (k: string) => delete out.headers[k.toLowerCase()],
    writeHead: (code: number) => {
      out.statusCode = code;
      return res;
    },
    status: (code: number) => {
      out.statusCode = code;
      res.statusCode = code;
      return res;
    },
    json: (b: any) => {
      out.body = b;
      return res;
    },
    send: (b: any) => {
      out.body = b;
      return res;
    },
    write: () => true,
    end: (b?: any) => {
      if (b !== undefined && out.body === undefined) out.body = String(b);
      return res;
    },
  };
  return { res, out };
}

export async function withTenant(
  req: any,
  res: any,
  handle: (req: any, res: any) => Promise<any>,
  getDb: () => any,
  jwtSecret: string,
) {
  if (!isolationOn()) return handle(req, res);
  const method = String(req?.method || 'GET').toUpperCase();
  const db = getDb();
  if (method === 'OPTIONS' || !db) return handle(req, res);
  const path = pathOf(req);

  // Crons: uma rodada por ONG ativa, cada uma presa na sua ONG
  if (path.startsWith('/api/cron/')) {
    const active = (await orgs(db)).filter((o) => o.status === 'ACTIVE').map((o) => o.id);
    if (!active.includes(DEFAULT_ORG)) active.unshift(DEFAULT_ORG);
    const results: Record<string, any> = {};
    let worst = 200;
    for (const orgId of active) {
      const { res: fake, out } = collector();
      try {
        const secrets = await orgSecrets(db, orgId);
        await runWithOrg(orgId, () => handle(req, fake), secrets);
      } catch (e: any) {
        out.statusCode = 500;
        out.body = { error: e?.message || String(e) };
      }
      results[orgId] = out.body;
      if (out.statusCode > worst) worst = out.statusCode;
    }
    return res.status(worst).json({ perOrg: results });
  }

  if (isSystemPath(path)) {
    let orgId: string | null = null;
    if (path === '/api/auth/register') {
      const b = bodyOf(req);
      const o = (await findOrg(db, b.org || b.orgId || header(req, 'x-org') || header(req, 'x-org-id'))) || null;
      if (o && o.status !== 'ACTIVE' && o.id !== DEFAULT_ORG) {
        return res.status(403).json({ error: 'Esta ONG ainda não está recebendo cadastros.' });
      }
      orgId = o?.id || DEFAULT_ORG;
    } else if (path.startsWith('/api/webhooks/')) {
      const o = await findOrg(db, queryOf(req, 'org'));
      orgId = o?.id || DEFAULT_ORG;
    }
    const secrets = orgId ? await orgSecrets(db, orgId) : undefined;
    return runAsSystem(() => handle(req, res), orgId, secrets);
  }

  const claims = claimsOf(req, jwtSecret);
  let orgId: string;
  let platform = false;
  if (claims) {
    const isAdmin = claims.role === 'ADMIN';
    const auth = { orgId: claims.orgId || DEFAULT_ORG, email: claims.email, role: claims.role };
    platform = isPlatformAdmin(auth, isAdmin);
    orgId = orgIdForRequest(req, auth, isAdmin);
  } else {
    orgId = (await findOrg(db, header(req, 'x-org') || header(req, 'x-org-id')))?.id || DEFAULT_ORG;
  }
  const org = await findOrg(db, orgId);
  if (orgId !== DEFAULT_ORG && (!org || org.status === 'SUSPENDED') && !platform) {
    const origin = header(req, 'origin');
    if (origin) res.setHeader?.('Access-Control-Allow-Origin', origin);
    return res.status(403).json({ error: 'Esta ONG está suspensa na plataforma.', code: 'ORG_SUSPENDED' });
  }
  const secrets = await orgSecrets(db, orgId);
  return runWithOrg(orgId, () => handle(req, res), secrets);
}

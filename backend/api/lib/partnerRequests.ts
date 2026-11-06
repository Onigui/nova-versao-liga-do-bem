/**
 * "Quero ser parceiro": a empresa escolhe a ONG no App Parceiros e manda os dados.
 * O pedido cai na ONG escolhida (aparece na central de pendências) e a equipe da plataforma
 * entra em contato e cadastra a empresa naquela ONG.
 *
 *   POST  /api/public/partner-requests          (sem login, limitado por IP)
 *   GET   /api/admin/partner-requests?status=   (painel, ONG selecionada)
 *   PATCH /api/admin/partner-requests/:id       { status, note }
 */
import crypto from 'crypto';
import { escapeHtml, sendEmail } from './email';
import { checkCnpj } from './orgs';
import { DEFAULT_ORG, runAsSystem } from './tenant';

type Ctx = { req: any; res: any; path: string; method: string; body: any; db: any; isAdmin: boolean; adminEmail?: string | null };

export const REQUEST_STATUS = ['NEW', 'CONTACTED', 'APPROVED', 'REJECTED'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v: any, max: number) => (v == null ? '' : String(v).trim().slice(0, max));

let ready: Promise<void> | null = null;
let readyDb: any = null;
export function ensurePartnerRequestsSchema(db: any) {
  if (ready && readyDb === db) return ready;
  readyDb = db;
  ready = runAsSystem(async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS partner_requests (
      id TEXT PRIMARY KEY,
      "orgId" TEXT NOT NULL DEFAULT '${DEFAULT_ORG}',
      company TEXT NOT NULL,
      cnpj TEXT,
      "contactName" TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT,
      state TEXT,
      category TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'NEW',
      note TEXT,
      "handledBy" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS partner_requests_org_status ON partner_requests ("orgId", status, "createdAt")`);
  }).catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

const attempts = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  list.push(now);
  attempts.set(ip, list);
  return list.length > 5;
}

export function isPartnerRequestPath(path: string) {
  return path === '/api/public/partner-requests' || path === '/api/admin/partner-requests' || /^\/api\/admin\/partner-requests\/[^/]+$/.test(path);
}

function view(r: any) {
  return {
    id: r.id,
    company: r.company,
    cnpj: r.cnpj,
    contactName: r.contactName,
    email: r.email,
    phone: r.phone,
    city: r.city,
    state: r.state,
    category: r.category,
    message: r.message,
    status: r.status,
    note: r.note,
    handledBy: r.handledBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function handlePartnerRequests(ctx: Ctx): Promise<boolean> {
  const { req, res, path, method, db } = ctx;
  if (!isPartnerRequestPath(path)) return false;
  if (!db) return res.status(503).json({ error: 'Banco indisponível' }), true;
  await ensurePartnerRequestsSchema(db);
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};

  if (path === '/api/public/partner-requests') {
    if (method !== 'POST') return res.status(405).json({ error: 'Método não permitido' }), true;
    const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || 'ip';
    if (limited(ip)) return res.status(429).json({ error: 'Muitos pedidos seguidos. Tente de novo mais tarde.' }), true;
    const data = {
      orgId: str(body.orgId || body.org, 64),
      company: str(body.company, 120),
      contactName: str(body.contactName, 120),
      email: str(body.email, 160).toLowerCase(),
      phone: str(body.phone, 40),
      city: str(body.city, 100),
      state: str(body.state, 2).toUpperCase(),
      category: str(body.category, 60),
      message: str(body.message, 1000),
    };
    if (!data.orgId) return res.status(400).json({ error: 'Escolha a ONG de que você quer ser parceiro.', field: 'orgId' }), true;
    if (data.company.length < 2) return res.status(400).json({ error: 'Informe o nome da empresa.', field: 'company' }), true;
    if (data.contactName.length < 2) return res.status(400).json({ error: 'Informe o seu nome.', field: 'contactName' }), true;
    if (!EMAIL_RE.test(data.email)) return res.status(400).json({ error: 'E-mail inválido.', field: 'email' }), true;
    if (data.phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Informe um telefone com DDD.', field: 'phone' }), true;
    let cnpj: string | null = null;
    if (str(body.cnpj, 30)) {
      const c = checkCnpj(body.cnpj);
      if (!c.ok) return res.status(400).json({ error: (c as any).error, field: 'cnpj' }), true;
      cnpj = (c as any).digits;

    }
    // Rota pública roda em modo sistema: confere a ONG e grava o "orgId" explicitamente
    const org: any[] = await db.$queryRawUnsafe(`SELECT id, name, status FROM organizations WHERE (id = $1 OR slug = $1) LIMIT 1`, data.orgId);
    if (!org[0] || (org[0].status !== 'ACTIVE' && org[0].id !== DEFAULT_ORG)) {
      return res.status(400).json({ error: 'Esta ONG não está recebendo parceiros agora.', field: 'orgId' }), true;
    }
    const dup: any[] = await db.$queryRawUnsafe(
      `SELECT id FROM partner_requests WHERE "orgId" = $1 AND lower(email) = $2 AND status IN ('NEW', 'CONTACTED') LIMIT 1`,
      org[0].id,
      data.email,
    );
    if (dup[0]) {
      return res.status(200).json({ ok: true, id: dup[0].id, message: 'Já recebemos seu pedido. Nossa equipe vai falar com você em breve.' }), true;
    }
    const id = crypto.randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO partner_requests (id, "orgId", company, cnpj, "contactName", email, phone, city, state, category, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      id,
      org[0].id,
      data.company,
      cnpj,
      data.contactName,
      data.email,
      data.phone,
      data.city || null,
      data.state || null,
      data.category || null,
      data.message || null,
    );
    // Confirmação para a empresa (se o e-mail estiver configurado; falha não atrapalha o pedido)
    sendEmail({
      to: data.email,
      subject: `Recebemos seu pedido para ser parceiro da ${org[0].name}`,
      text: `Olá, ${data.contactName}!\n\nRecebemos o pedido da ${data.company} para ser parceira da ${org[0].name} no SóciONG. Nossa equipe vai entrar em contato pelo telefone ou e-mail informados.\n\nEquipe SóciONG`,
      html: `<p>Olá, ${escapeHtml(data.contactName)}!</p><p>Recebemos o pedido da <strong>${escapeHtml(data.company)}</strong> para ser parceira da <strong>${escapeHtml(org[0].name)}</strong> no SóciONG. Nossa equipe vai entrar em contato pelo telefone ou e-mail informados.</p><p>Equipe SóciONG</p>`,
    }).catch(() => undefined);
    return res.status(201).json({ ok: true, id, message: `Pedido enviado! A equipe do SóciONG vai falar com você para concluir a parceria com a ${org[0].name}.` }), true;
  }

  // ---------- painel (ONG selecionada; com a separação ligada o banco já filtra pela ONG)
  if (!ctx.isAdmin) return res.status(401).json({ error: 'Não autorizado' }), true;
  if (path === '/api/admin/partner-requests' && method === 'GET') {
    const status = str(req.query?.status, 20).toUpperCase();
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT * FROM partner_requests ${REQUEST_STATUS.includes(status as any) ? 'WHERE status = $1' : ''} ORDER BY (status = 'NEW') DESC, "createdAt" DESC LIMIT 100`,
      ...(REQUEST_STATUS.includes(status as any) ? [status] : []),
    );
    const counts: any[] = await db.$queryRawUnsafe(`SELECT status, COUNT(*)::int AS n FROM partner_requests GROUP BY status`);
    return res.status(200).json({ requests: rows.map(view), counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) }), true;
  }
  const m = path.match(/^\/api\/admin\/partner-requests\/([^/]+)$/);
  if (m && method === 'PATCH') {
    const status = str(body.status, 20).toUpperCase();
    if (!REQUEST_STATUS.includes(status as any)) return res.status(400).json({ error: 'Situação inválida' }), true;
    if (status === 'REJECTED' && !str(body.note, 500)) return res.status(400).json({ error: 'Escreva o motivo da recusa.', field: 'note' }), true;
    const n = await db.$executeRawUnsafe(
      `UPDATE partner_requests SET status = $2, note = COALESCE($3, note), "handledBy" = $4, "updatedAt" = NOW() WHERE id = $1`,
      decodeURIComponent(m[1]),
      status,
      str(body.note, 500) || null,
      ctx.adminEmail || null,
    );
    if (!Number(n)) return res.status(404).json({ error: 'Pedido não encontrado' }), true;
    return res.status(200).json({ ok: true }), true;
  }
  return res.status(405).json({ error: 'Método não permitido' }), true;
}

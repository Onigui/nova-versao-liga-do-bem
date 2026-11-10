/**
 * Relatório da ONG (só leitura): a ONG acompanha ganhos e crescimento sem mexer em nada.
 *
 * Acesso próprio, separado dos usuários do app e do painel (tabela org_report_users):
 *   POST /api/ong/login            { email, password }      → token só de relatório
 *   POST /api/ong/senha            { token, password }      (convite ou "esqueci a senha")
 *   POST /api/ong/esqueci          { email }                → e-mail com link (resposta sempre igual)
 *   GET  /api/ong/relatorio        (token de relatório)     → números e 12 meses, só da ONG do token
 *
 * A equipe da plataforma cria e remove os acessos:
 *   GET    /api/platform/orgs/:id/report-users
 *   POST   /api/platform/orgs/:id/report-users      { email, name } → link de convite (e e-mail)
 *   DELETE /api/platform/orgs/:id/report-users/:uid
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { buildOverview } from './adminOverview';
import { escapeHtml, sendEmail } from './email';
import { DEFAULT_ORG, isolationOn, runAsSystem, runWithOrg } from './tenant';
import { feeRate, grossByMonth, listInvoices, syncFeeInvoices, withFee } from './platformFees';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TOKEN_KIND = 'ong_report';
const INVITE_HOURS = 72;
const ADMIN_URL = () => (process.env.ADMIN_URL || 'https://nova-versao-liga-do-bem-pufx.vercel.app').replace(/\/$/, '');
const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const num = (v: any) => Number(v || 0);
const money = (v: any) => Math.round(num(v) * 100) / 100;

let ready: Promise<void> | null = null;
let readyDb: any = null;
export function ensureOngReportSchema(db: any) {
  if (ready && readyDb === db) return ready;
  readyDb = db;
  ready = runAsSystem(async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS org_report_users (
      id TEXT PRIMARY KEY,
      "orgId" TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      "passwordHash" TEXT,
      "tokenHash" TEXT,
      "tokenExpiresAt" TIMESTAMP,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "lastLoginAt" TIMESTAMP,
      "createdBy" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
  }).catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

export function isOngReportPath(path: string) {
  return path.startsWith('/api/ong/') || /^\/api\/platform\/orgs\/[^/]+\/report-users(\/[^/]+)?$/.test(path);
}

// ---------------------------------------------------------------- números

/** Os números da ONG: indicadores de agora e os últimos 12 meses. Roda dentro da ONG. */
export async function buildOngReport(db: any, now = new Date()) {
  const ov: any = await buildOverview(db, now);
  // Cada número numa consulta própria: se uma tabela ainda não existe, só aquele vira zero
  const extra = async (sql: string) => {
    try {
      const rows: any[] = await db.$queryRawUnsafe(sql, now);
      return new Map(rows.map((r) => [r.month, num(r.v)]));
    } catch {
      return new Map<string, number>();
    }
  };
  const M = `WITH m AS (SELECT generate_series(date_trunc('month', $1::timestamp) - interval '11 months', date_trunc('month', $1::timestamp), interval '1 month') AS m)`;
  const inMonth = (col: string) => `${col} >= m.m AND ${col} < m.m + interval '1 month'`;
  const [newMembers, revenue, donations, cardUses, adoptions] = await Promise.all([
    extra(`${M} SELECT to_char(m.m, 'YYYY-MM') AS month, (SELECT COUNT(*)::int FROM users u WHERE u.role = 'MEMBER' AND ${inMonth('u."createdAt"')}) AS v FROM m`),
    extra(`${M} SELECT to_char(m.m, 'YYYY-MM') AS month, (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.status = 'APPROVED' AND p.type = 'MEMBERSHIP' AND ${inMonth('p."paidAt"')}) AS v FROM m`),
    extra(`${M} SELECT to_char(m.m, 'YYYY-MM') AS month, (SELECT COALESCE(SUM(d.amount), 0) FROM donations d WHERE d.status = 'APPROVED' AND ${inMonth('d."updatedAt"')}) AS v FROM m`),
    extra(`${M} SELECT to_char(m.m, 'YYYY-MM') AS month, (SELECT COUNT(*)::int FROM partner_validations v WHERE ${inMonth('v."validatedAt"')}) AS v FROM m`),
    extra(`${M} SELECT to_char(m.m, 'YYYY-MM') AS month, (SELECT COUNT(*)::int FROM adoptions a WHERE a.status IN ('APPROVED', 'COMPLETED') AND ${inMonth('COALESCE(a."completedDate", a."approvedDate", a."updatedAt")')}) AS v FROM m`),
  ]);
  const monthsList: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthsList.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const s = monthsList.map((month) => ({
    month,
    newMembers: num(newMembers.get(month)),
    revenue: money(revenue.get(month)),
    donations: money(donations.get(month)),
    cardUses: num(cardUses.get(month)),
    adoptions: num(adoptions.get(month)),
  }));
  const sum = (k: string) => s.reduce((a: number, r: any) => a + num(r[k]), 0);
  const k = ov.kpis || {};
  return {
    generatedAt: now.toISOString(),
    kpis: {
      activeMembers: k.activeMembers,
      newMembers30d: k.newMembers30d,
      newMembersTrend: k.newMembersTrend,
      revenueMonth: k.revenueMonth,
      revenueTrend: k.revenueTrend,
      donationsMonth: k.donationsMonth,
      cardUses30d: k.cardUses30d,
      membersUsingCard30d: k.membersUsingCard30d,
      activePartners: k.activePartners,
      adoptionsCompleted: k.adoptionsCompleted,
      animalsAvailable: k.animalsAvailable,
      reunions: k.reunions,
      nfpSupporters: k.nfpSupporters,
      ratingAvg: k.ratingAvg,
      ratingCount: k.ratingCount,
    },
    year: {
      revenue: money(sum('revenue')),
      donations: money(sum('donations')),
      newMembers: sum('newMembers'),
      cardUses: sum('cardUses'),
      adoptions: sum('adoptions'),
    },
    series: s,
  };
}

// ---------------------------------------------------------------- rotas

type Ctx = { req: any; res: any; path: string; method: string; body: any; db: any; jwtSecret: string; platformEmail?: string | null; isPlatform: boolean };

const attempts = new Map<string, number[]>();
function limited(key: string, max: number) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  list.push(now);
  attempts.set(key, list);
  return list.length > max;
}

async function issueLink(db: any, userId: string, email: string, orgName: string, kind: 'convite' | 'senha') {
  const token = crypto.randomBytes(24).toString('base64url');
  await db.$executeRawUnsafe(
    `UPDATE org_report_users SET "tokenHash" = $2, "tokenExpiresAt" = NOW() + ($3 || ' hours')::interval WHERE id = $1`,
    userId,
    hash(token),
    String(INVITE_HOURS),
  );
  const url = `${ADMIN_URL()}/ong.html#${kind}=${token}`;
  const title = kind === 'convite' ? `Seu acesso ao relatório da ${orgName}` : `Nova senha do relatório da ${orgName}`;
  const mail = await sendEmail({
    to: email,
    subject: `SóciONG: ${title}`,
    text: `${title}.\n\nCrie sua senha neste link (vale ${INVITE_HOURS} horas):\n${url}\n\nNo relatório você acompanha sócios, receita, doações e o crescimento da ONG. Equipe SóciONG`,
    html: `<p>${escapeHtml(title)}.</p><p><a href="${url}" style="background:#0E7C66;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Criar minha senha</a></p><p style="color:#4B5E59;font-size:13px">O link vale ${INVITE_HOURS} horas. No relatório você acompanha sócios, receita, doações e o crescimento da ONG.</p><p>Equipe SóciONG</p>`,
  }).catch(() => ({ ok: false }));
  return { url, emailed: !!(mail as any)?.ok };
}

function readToken(req: any, secret: string): any | null {
  const raw = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!raw) return null;
  try {
    const c: any = jwt.verify(raw, secret);
    return c?.kind === TOKEN_KIND ? c : null;
  } catch {
    return null;
  }
}

export async function handleOngReport(ctx: Ctx): Promise<boolean> {
  const { req, res, path, method, db, jwtSecret } = ctx;
  if (!isOngReportPath(path)) return false;
  if (!db) return res.status(503).json({ error: 'Banco indisponível' }), true;
  await ensureOngReportSchema(db);
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'ip').split(',')[0].trim();
  const sys = <T,>(fn: () => Promise<T>) => runAsSystem(fn);

  // ---------- equipe da plataforma: acessos de uma ONG
  const pm = path.match(/^\/api\/platform\/orgs\/([^/]+)\/report-users(?:\/([^/]+))?$/);
  if (pm) {
    if (!ctx.isPlatform) return res.status(403).json({ error: 'Só a equipe da plataforma' }), true;
    const orgId = decodeURIComponent(pm[1]);
    const org: any[] = await sys(() => db.$queryRawUnsafe(`SELECT id, name FROM organizations WHERE id = $1`, orgId));
    if (!org[0]) return res.status(404).json({ error: 'ONG não encontrada' }), true;
    if (!pm[2] && method === 'GET') {
      const rows: any[] = await sys(() =>
        db.$queryRawUnsafe(
          `SELECT id, email, name, "isActive", "lastLoginAt", "createdAt", ("passwordHash" IS NOT NULL) AS "hasPassword"
             FROM org_report_users WHERE "orgId" = $1 ORDER BY "createdAt"`,
          orgId,
        ),
      );
      return res.status(200).json({ users: rows }), true;
    }
    if (!pm[2] && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || '').trim().slice(0, 120) || null;
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'E-mail inválido', field: 'email' }), true;
      const exists: any[] = await sys(() => db.$queryRawUnsafe(`SELECT id, "orgId" FROM org_report_users WHERE email = $1`, email));
      if (exists[0] && exists[0].orgId !== orgId) return res.status(409).json({ error: 'Este e-mail já tem acesso ao relatório de outra ONG', field: 'email' }), true;
      const id = exists[0]?.id || crypto.randomUUID();
      await sys(() =>
        exists[0]
          ? db.$executeRawUnsafe(`UPDATE org_report_users SET "isActive" = true, name = COALESCE($2, name) WHERE id = $1`, id, name)
          : db.$executeRawUnsafe(
              `INSERT INTO org_report_users (id, "orgId", email, name, "createdBy") VALUES ($1, $2, $3, $4, $5)`,
              id,
              orgId,
              email,
              name,
              ctx.platformEmail || null,
            ),
      );
      const link = await sys(() => issueLink(db, id, email, org[0].name, 'convite'));
      return res.status(201).json({ ok: true, id, inviteUrl: link.url, emailed: link.emailed }), true;
    }
    if (pm[2] && method === 'DELETE') {
      const n = await sys(() =>
        db.$executeRawUnsafe(`UPDATE org_report_users SET "isActive" = false, "tokenHash" = NULL WHERE id = $1 AND "orgId" = $2`, decodeURIComponent(pm[2]), orgId),
      );
      return Number(n) ? (res.status(200).json({ ok: true }), true) : (res.status(404).json({ error: 'Acesso não encontrado' }), true);
    }
    return res.status(405).json({ error: 'Método não permitido' }), true;
  }

  // ---------- a ONG
  if (path === '/api/ong/login' && method === 'POST') {
    if (limited(`login:${ip}`, 10)) return res.status(429).json({ error: 'Muitas tentativas. Espere 15 minutos.' }), true;
    const email = String(body.email || '').trim().toLowerCase();
    const rows: any[] = await sys(() =>
      db.$queryRawUnsafe(
        `SELECT u.id, u."orgId", u.name, u."passwordHash", o.name AS "orgName"
           FROM org_report_users u JOIN organizations o ON o.id = u."orgId"
          WHERE u.email = $1 AND u."isActive" = true`,
        email,
      ),
    );
    const u = rows[0];
    const ok = !!(u?.passwordHash && (await bcrypt.compare(String(body.password || ''), u.passwordHash)));
    if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos' }), true;
    await sys(() => db.$executeRawUnsafe(`UPDATE org_report_users SET "lastLoginAt" = NOW() WHERE id = $1`, u.id));
    const token = jwt.sign({ kind: TOKEN_KIND, rid: u.id, orgId: u.orgId }, jwtSecret, { expiresIn: '7d' });
    return res.status(200).json({ token, name: u.name, org: { id: u.orgId, name: u.orgName } }), true;
  }

  if (path === '/api/ong/senha' && method === 'POST') {
    if (limited(`senha:${ip}`, 10)) return res.status(429).json({ error: 'Muitas tentativas. Espere 15 minutos.' }), true;
    const token = String(body.token || '');
    const password = String(body.password || '');
    if (password.length < 8) return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres', field: 'password' }), true;
    const rows: any[] = await sys(() =>
      db.$queryRawUnsafe(
        `SELECT id FROM org_report_users WHERE "tokenHash" = $1 AND "tokenExpiresAt" > NOW() AND "isActive" = true`,
        hash(token),
      ),
    );
    if (!rows[0]) return res.status(400).json({ error: 'Link inválido ou vencido. Peça um novo.' }), true;
    const ph = await bcrypt.hash(password, 10);
    await sys(() =>
      db.$executeRawUnsafe(`UPDATE org_report_users SET "passwordHash" = $2, "tokenHash" = NULL, "tokenExpiresAt" = NULL WHERE id = $1`, rows[0].id, ph),
    );
    return res.status(200).json({ ok: true }), true;
  }

  if (path === '/api/ong/esqueci' && method === 'POST') {
    const generic = { ok: true, message: 'Se este e-mail tiver acesso, enviamos um link para criar uma nova senha.' };
    if (limited(`esqueci:${ip}`, 5)) return res.status(200).json(generic), true;
    const email = String(body.email || '').trim().toLowerCase();
    const rows: any[] = await sys(() =>
      db.$queryRawUnsafe(
        `SELECT u.id, o.name AS "orgName" FROM org_report_users u JOIN organizations o ON o.id = u."orgId" WHERE u.email = $1 AND u."isActive" = true`,
        email,
      ),
    );
    if (rows[0]) await sys(() => issueLink(db, rows[0].id, email, rows[0].orgName, 'senha'));
    return res.status(200).json(generic), true;
  }

  if (path === '/api/ong/relatorio' && method === 'GET') {
    const claims = readToken(req, jwtSecret);
    if (!claims) return res.status(401).json({ error: 'Entre de novo' }), true;
    const rows: any[] = await sys(() =>
      db.$queryRawUnsafe(
        `SELECT u.id, u.name, o.id AS "orgId", o.name AS "orgName", o.branding, o.city, o.state
           FROM org_report_users u JOIN organizations o ON o.id = u."orgId" WHERE u.id = $1 AND u."isActive" = true`,
        claims.rid,
      ),
    );
    const u = rows[0];
    if (!u || u.orgId !== claims.orgId) return res.status(401).json({ error: 'Acesso removido' }), true;
    // Sem a separação ligada, o banco só tem os dados da Liga: outra ONG não pode ver números que não são dela
    if (!isolationOn() && u.orgId !== DEFAULT_ORG) {
      return res.status(409).json({ error: 'O relatório desta ONG abre quando ela entrar no ar na plataforma.' }), true;
    }
    const report = await runWithOrg(u.orgId, () => buildOngReport(db));
    // Taxa SóciONG: 10% do bruto de tudo o que entrou pelo app, mês a mês, e o que falta pagar
    const orgFees: any[] = await sys(() => db.$queryRawUnsafe(`SELECT fees FROM organizations WHERE id = $1`, u.orgId));
    const rate = feeRate(orgFees[0]?.fees);
    const months = withFee(await runWithOrg(u.orgId, () => grossByMonth(db, new Date(), 12)), rate);
    await syncFeeInvoices(db).catch(() => undefined);
    const invoices = (await listInvoices(db, u.orgId)).map((f) => ({ month: f.month, grossCents: f.grossCents, feeCents: f.feeCents, status: f.status, paidAt: f.paidAt }));
    const fees = { rate, months, invoices, dueCents: invoices.filter((f) => f.status === 'PENDING').reduce((a, f) => a + f.feeCents, 0) };
    return res.status(200).json({ org: { id: u.orgId, name: u.orgName, branding: u.branding || {}, city: u.city, state: u.state }, viewer: { name: u.name }, ...report, fees }), true;
  }

  return res.status(404).json({ error: 'Não encontrado' }), true;
}

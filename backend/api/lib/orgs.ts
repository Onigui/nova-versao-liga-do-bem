/**
 * Várias ONGs na mesma plataforma (fase 1: a base).
 *
 * - `organizations`: cada ONG. A Liga do Bem é a pioneira (id fixo `org_liga`).
 * - Toda tabela ganha a coluna "orgId" (padrão = Liga), então nada do que existe muda.
 * - `org_onboarding`: o checklist do Protocolo de entrada (mesmos códigos D1…O5).
 * - `org_secrets`: credenciais por ONG (token do PagBank etc.), criptografadas.
 * - Equipe da plataforma (/api/platform/*): cria ONG, acompanha o checklist, ativa, suspende.
 *
 * Isolamento de dados (fase 2): enquanto MULTI_ORG_ISOLATION != 'on', nenhuma ONG além
 * da Liga pode ser ativada — a trava de ativação confere isso.
 */
import crypto from 'crypto';
import { ensureIsolationSchema, isolationOn, isolationSelfTest, runAsSystem } from './tenant';

export const DEFAULT_ORG_ID = 'org_liga';

type Ctx = {
  req: any;
  res: any;
  path: string;
  method: string;
  body: any;
  db: any;
  isAdmin: boolean;
  /** Token decodificado de quem chama (ou null). */
  auth: () => { userId?: string; email?: string; role?: string; orgId?: string } | null;
};

// ---------------------------------------------------------------- checklist do protocolo
export type OnboardingItem = { key: string; group: string; label: string; required: boolean };
export const ONBOARDING_ITEMS: OnboardingItem[] = [
  { key: 'D1', group: 'Documentos', label: 'Cartão CNPJ com situação "Ativa"', required: true },
  { key: 'D2', group: 'Documentos', label: 'Estatuto social com a proteção animal entre as finalidades', required: true },
  { key: 'D3', group: 'Documentos', label: 'Ata de eleição da diretoria em vigor', required: true },
  { key: 'D4', group: 'Documentos', label: 'Responsável legal: nome, CPF, e-mail e celular', required: true },
  { key: 'D5', group: 'Documentos', label: 'Prestação de contas ou balanço dos últimos 12 meses', required: true },
  { key: 'D6', group: 'Documentos', label: 'Termo de adesão assinado, com o tratamento de dados (LGPD)', required: true },
  { key: 'I1', group: 'Identidade', label: 'Nome como aparece no app (até 30 caracteres)', required: true },
  { key: 'I2', group: 'Identidade', label: 'Logo em PNG, fundo transparente, mínimo 512 × 512 px', required: true },
  { key: 'I3', group: 'Identidade', label: 'Cor principal (e secundária, se houver)', required: true },
  { key: 'I4', group: 'Identidade', label: 'Texto "Quem somos" (até 500 caracteres)', required: true },
  { key: 'I5', group: 'Identidade', label: 'Cidades atendidas', required: true },
  { key: 'I6', group: 'Identidade', label: 'Foto de capa horizontal', required: false },
  { key: 'P1', group: 'Pagamentos', label: 'Conta PagBank PJ no CNPJ da ONG, conectada', required: true },
  { key: 'P2', group: 'Pagamentos', label: 'Chave PIX no CNPJ', required: true },
  { key: 'P3', group: 'Pagamentos', label: 'Planos e preços da mensalidade', required: true },
  { key: 'O1', group: 'Operação', label: 'De 1 a 3 administradores (nome, e-mail, CPF)', required: true },
  { key: 'O2', group: 'Operação', label: 'WhatsApp e e-mail de atendimento aos membros', required: true },
  { key: 'O3', group: 'Operação', label: 'Encarregado de dados (LGPD): nome e e-mail', required: true },
  { key: 'O4', group: 'Operação', label: 'Pelo menos 5 empresas convidadas para serem parceiras', required: true },
  { key: 'O5', group: 'Operação', label: 'Pessoa que participa do treinamento', required: true },
  { key: 'C1', group: 'Conteúdo', label: 'Animais para adoção, com fotos', required: false },
  { key: 'C2', group: 'Conteúdo', label: 'Próximos eventos', required: false },
  { key: 'C3', group: 'Conteúdo', label: 'CNPJ na Nota Fiscal Paulista (só SP)', required: false },
  // Feitos pela plataforma antes de ligar
  { key: 'T1', group: 'Plataforma', label: 'Pagamento de teste aprovado na conta da ONG', required: true },
  { key: 'T2', group: 'Plataforma', label: 'Termos de uso e política de privacidade da ONG publicados', required: true },
];
const ITEM_KEYS = new Set(ONBOARDING_ITEMS.map((i) => i.key));
export const ITEM_STATUSES = ['PENDING', 'RECEIVED', 'APPROVED', 'REJECTED'] as const;
export const ORG_STATUSES = ['DRAFT', 'ONBOARDING', 'ACTIVE', 'SUSPENDED'] as const;

// O que a Liga já tem hoje (o resto fica pendente para completar, sem tirá-la do ar)
const LIGA_ALREADY = ['I1', 'I3', 'I5', 'P1', 'P2', 'P3', 'T1', 'T2'];

// ---------------------------------------------------------------- CNPJ
export function checkCnpj(raw: any): { ok: true; digits: string } | { ok: false; error: string } {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length !== 14) return { ok: false, error: 'CNPJ precisa ter 14 números.' };
  if (/^(\d)\1{13}$/.test(d)) return { ok: false, error: 'CNPJ inválido.' };
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = w.reduce((a, x, i) => a + x * Number(d[i]), 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (calc(12) !== Number(d[12]) || calc(13) !== Number(d[13])) return { ok: false, error: 'CNPJ inválido (dígitos verificadores).' };
  return { ok: true, digits: d };
}

export function slugify(s: string) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

// ---------------------------------------------------------------- credenciais criptografadas
export const SECRET_KEYS = ['PAGBANK_TOKEN', 'PAGBANK_SANDBOX_TOKEN'] as const;
function secretKey() {
  const base = process.env.ORG_SECRETS_KEY || `${process.env.JWT_SECRET || ''}:org-secrets:v1`;
  return crypto.createHash('sha256').update(base).digest();
}
export function encryptSecret(plain: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}
export function decryptSecret(stored: string) {
  const [v, iv, tag, data] = String(stored || '').split('.');
  if (v !== 'v1') throw new Error('formato desconhecido');
  const d = crypto.createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}
/** Credencial de uma ONG; a Liga cai nas variáveis de ambiente de sempre se não tiver uma salva. */
export async function getOrgSecret(db: any, orgId: string, key: string): Promise<string | null> {
  try {
    await ensureOrgSchema(db);
    // org_secrets é fechada para as ONGs: só o sistema lê
    const r: any[] = await runAsSystem(() =>
      db.$queryRawUnsafe(`SELECT value FROM org_secrets WHERE "orgId" = $1 AND key = $2`, orgId, key),
    );
    if (r[0]?.value) return decryptSecret(r[0].value);
  } catch {
    /* sem credencial salva */
  }
  if (orgId === DEFAULT_ORG_ID) return (process.env[key] || '').trim() || null;
  return null;
}

// ---------------------------------------------------------------- esquema
const ORG_TABLES = new Set(['organizations', 'org_onboarding', 'org_secrets', '_prisma_migrations']);
let schemaReady: Promise<void> | null = null;
let schemaDb: any = null;

export function ensureOrgSchema(db: any): Promise<void> {
  if (schemaReady && schemaDb === db) return schemaReady;
  schemaDb = db;
  // Sempre em modo sistema: semeia organizations/org_onboarding, que as ONGs não podem gravar
  schemaReady = runAsSystem(async () => {
    for (const sql of [
      `CREATE TABLE IF NOT EXISTS organizations (
         id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, "legalName" TEXT,
         cnpj TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'DRAFT', city TEXT, state TEXT,
         "contactEmail" TEXT, branding JSONB NOT NULL DEFAULT '{}'::jsonb, contacts JSONB NOT NULL DEFAULT '{}'::jsonb,
         settings JSONB NOT NULL DEFAULT '{}'::jsonb, fees JSONB NOT NULL DEFAULT '{}'::jsonb,
         "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
         "activatedAt" TIMESTAMP, "suspendedAt" TIMESTAMP, "suspendReason" TEXT)`,
      `CREATE TABLE IF NOT EXISTS org_onboarding (
         "orgId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, item TEXT NOT NULL,
         status TEXT NOT NULL DEFAULT 'PENDING', note TEXT, "updatedBy" TEXT, "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
         PRIMARY KEY ("orgId", item))`,
      `CREATE TABLE IF NOT EXISTS org_secrets (
         "orgId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, key TEXT NOT NULL,
         value TEXT NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(), PRIMARY KEY ("orgId", key))`,
      `INSERT INTO organizations (id, slug, name, "legalName", cnpj, status, city, state, branding, fees, "activatedAt")
       VALUES ('${DEFAULT_ORG_ID}', 'liga-do-bem', 'Liga do Bem', 'Liga do Bem Botucatu', '27644955000138', 'ACTIVE', 'Botucatu', 'SP',
               '{"primary":"#6D28D9","dark":"#3B1A78"}'::jsonb, '{"rate":0.10,"donationRate":0.10,"capCents":2000000}'::jsonb, NOW())
       ON CONFLICT (id) DO NOTHING`,
    ]) {
      await db.$executeRawUnsafe(sql);
    }
    // Checklist da Liga, uma vez: o que já existe aprovado, o resto pendente
    const has: any[] = await db.$queryRawUnsafe(`SELECT 1 FROM org_onboarding WHERE "orgId" = $1 LIMIT 1`, DEFAULT_ORG_ID);
    if (!has[0]) await seedChecklist(db, DEFAULT_ORG_ID, LIGA_ALREADY, 'migração');
    // "orgId" em toda tabela que ainda não tem (padrão = Liga: nada muda para o que já existe)
    const missing: any[] = await db.$queryRawUnsafe(
      `SELECT t.table_name FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
          AND NOT EXISTS (SELECT 1 FROM information_schema.columns c
                           WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = 'orgId')`,
    );
    for (const { table_name } of missing) {
      if (ORG_TABLES.has(table_name) || !/^[a-z_][a-z0-9_]*$/i.test(table_name)) continue;
      await db.$executeRawUnsafe(`ALTER TABLE "${table_name}" ADD COLUMN IF NOT EXISTS "orgId" TEXT NOT NULL DEFAULT '${DEFAULT_ORG_ID}'`).catch((e: any) => {
        console.warn('⚠️ orgId não adicionado em', table_name, String(e?.message || e).slice(0, 100));
      });
    }
  }).catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

async function seedChecklist(db: any, orgId: string, approved: string[] = [], by = 'sistema') {
  for (const it of ONBOARDING_ITEMS) {
    await db.$executeRawUnsafe(
      `INSERT INTO org_onboarding ("orgId", item, status, "updatedBy") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      orgId,
      it.key,
      approved.includes(it.key) ? 'APPROVED' : 'PENDING',
      by,
    );
  }
}

// ---------------------------------------------------------------- quem é quem
/** E-mails da equipe da plataforma: PLATFORM_ADMIN_EMAILS, senão os admins da Liga (pioneira). */
export async function platformAdminEmails(db: any): Promise<string[]> {
  const list = platformEmails();
  if (list.length) return list;
  const rows: any[] = await runAsSystem(() =>
    db.$queryRawUnsafe(`SELECT email FROM users WHERE role = 'ADMIN' AND "isActive" = true AND COALESCE("orgId", $1) = $1`, DEFAULT_ORG_ID),
  ).catch(() => []);
  return rows.map((r) => String(r.email || '').trim().toLowerCase()).filter((e) => e.includes('@'));
}

function platformEmails() {
  return String(process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
/**
 * Equipe da plataforma: e-mails em PLATFORM_ADMIN_EMAILS. Enquanto a variável não existe
 * (só a Liga no ar), os administradores da Liga fazem esse papel — e nenhuma outra ONG
 * pode ser ativada assim (trava de ativação).
 */
export function isPlatformAdmin(auth: { email?: string; role?: string; orgId?: string } | null, isAdmin: boolean) {
  if (!isAdmin || !auth) return false;
  const list = platformEmails();
  if (list.length) return list.includes(String(auth.email || '').toLowerCase());
  return (auth.orgId || DEFAULT_ORG_ID) === DEFAULT_ORG_ID;
}

/** ONG de quem chama: a do token; a equipe da plataforma pode escolher outra (X-Org-Id). */
export function orgIdForRequest(req: any, auth: { orgId?: string; email?: string; role?: string } | null, isAdmin: boolean) {
  const own = auth?.orgId || DEFAULT_ORG_ID;
  const asked = String(req?.headers?.['x-org-id'] || '').trim();
  if (asked && asked !== own && isPlatformAdmin(auth, isAdmin)) return asked;
  return own;
}

/** ONG de um usuário (para colocar no token no login). */
export async function userOrgId(db: any, userId: string): Promise<string> {
  try {
    await ensureOrgSchema(db);
    const r: any[] = await runAsSystem(() => db.$queryRawUnsafe(`SELECT "orgId" FROM users WHERE id = $1`, userId));
    return r[0]?.orgId || DEFAULT_ORG_ID;
  } catch {
    return DEFAULT_ORG_ID;
  }
}

// ---------------------------------------------------------------- leitura
const PUBLIC_COLS = `id, slug, name, "legalName", cnpj, status, city, state, branding, contacts, settings`;

function publicOrg(o: any) {
  const contacts = o.contacts || {};
  return {
    id: o.id,
    slug: o.slug,
    name: o.name,
    legalName: o.legalName,
    cnpj: o.cnpj,
    city: o.city,
    state: o.state,
    branding: o.branding || {},
    about: (o.settings || {}).about || null,
    cities: (o.settings || {}).cities || (o.city ? [o.city] : []),
    contacts: { whatsapp: contacts.whatsapp || null, email: contacts.email || null, privacyEmail: contacts.privacyEmail || null },
    features: { nfp: o.state === 'SP' && (o.settings || {}).nfp !== false },
  };
}

async function checklist(db: any, orgId: string) {
  const rows: any[] = await db.$queryRawUnsafe(`SELECT item, status, note, "updatedBy", "updatedAt" FROM org_onboarding WHERE "orgId" = $1`, orgId);
  const by = new Map(rows.map((r) => [r.item, r]));
  const items = ONBOARDING_ITEMS.map((it) => ({ ...it, status: by.get(it.key)?.status || 'PENDING', note: by.get(it.key)?.note || null, updatedBy: by.get(it.key)?.updatedBy || null, updatedAt: by.get(it.key)?.updatedAt || null }));
  const req = items.filter((i) => i.required);
  return { items, approved: req.filter((i) => i.status === 'APPROVED').length, required: req.length };
}

/** Separação ligada E autoteste no banco de verdade passando. */
async function isolationCheck(db: any, isDefault: boolean) {
  const label = 'Separação de dados entre ONGs ligada e testada no banco';
  if (isDefault) return { key: 'isolation', ok: true, label, detail: null };
  if (!isolationOn()) {
    return { key: 'isolation', ok: false, label, detail: 'Ligue MULTI_ORG_ISOLATION=on na Vercel depois de o autoteste passar (Plataforma → Separação de dados)' };
  }
  const schema = await ensureIsolationSchema(db).catch((e: any) => ({ ok: false, errors: [e?.message] } as any));
  const test = await isolationSelfTest(db);
  const failed = test.checks.filter((c) => !c.ok).map((c) => (c.detail ? `${c.name} (${c.detail})` : c.name));
  const ok = schema.ok !== false && test.ok;
  return { key: 'isolation', ok, label, detail: ok ? null : `Autoteste falhou: ${failed.join('; ') || (schema.errors || []).join('; ')}` };
}

/** O que falta para ligar a ONG no app. Cada condição diz o que fazer. */
export async function activationChecks(db: any, orgId: string) {
  const list = await checklist(db, orgId);
  const pending = list.items.filter((i) => i.required && i.status !== 'APPROVED');
  const admins: any[] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM users WHERE "orgId" = $1 AND role::text = 'ADMIN' AND "isActive" = true`, orgId).catch(() => [{ c: 0 }]);
  const pagbank = await getOrgSecret(db, orgId, 'PAGBANK_TOKEN');
  const isDefault = orgId === DEFAULT_ORG_ID;
  const checks = [
    { key: 'checklist', ok: pending.length === 0, label: 'Todos os itens obrigatórios aprovados', detail: pending.length ? `Faltam: ${pending.map((p) => p.key).join(', ')}` : null },
    { key: 'pagbank', ok: !!pagbank, label: 'Conta PagBank da ONG conectada', detail: pagbank ? null : 'Salve o token do PagBank da ONG em Credenciais' },
    { key: 'admin', ok: (admins[0]?.c || 0) > 0, label: 'Pelo menos 1 administrador da ONG cadastrado', detail: (admins[0]?.c || 0) > 0 ? null : 'Cadastre um administrador para a ONG' },
    await isolationCheck(db, isDefault),
    { key: 'platform', ok: isDefault || platformEmails().length > 0, label: 'Equipe da plataforma definida (PLATFORM_ADMIN_EMAILS)', detail: isDefault || platformEmails().length > 0 ? null : 'Cadastre PLATFORM_ADMIN_EMAILS na Vercel para separar a equipe da plataforma dos administradores das ONGs' },
  ];
  return { ready: checks.every((c) => c.ok), checks, checklist: list };
}

// ---------------------------------------------------------------- rotas
export function isOrgPath(path: string) {
  return path === '/api/orgs' || path.startsWith('/api/orgs/') || path === '/api/admin/org' || path.startsWith('/api/platform/') || path === '/api/platform-digest';
}

const send = (res: any, status: number, body: any) => res.status(status).json(body);

export async function handleOrgs(ctx: Ctx): Promise<boolean> {
  const { path, method, res, db } = ctx;
  if (!isOrgPath(path)) return false;
  if (!db) return send(res, 503, { error: 'Database not configured' }), true;
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};
  let auth: any = null;
  try {
    auth = ctx.auth();
  } catch {
    auth = null;
  }
  await ensureOrgSchema(db);

  // ---------- agendador: resumo diário de pendências por e-mail (idempotente: um por dia)
  if (path === '/api/platform-digest' && method === 'POST') {
    const { runDailyDigest } = await import('./platformInbox');
    return send(res, 200, await runDailyDigest(db)), true;
  }

  // ---------- público: lista de ONGs ativas (escolha no cadastro) e a configuração de uma
  if (path === '/api/orgs' && method === 'GET') {
    const rows: any[] = await db.$queryRawUnsafe(`SELECT ${PUBLIC_COLS} FROM organizations WHERE status = 'ACTIVE' ORDER BY name`);
    return send(res, 200, { orgs: rows.map(publicOrg) }), true;
  }
  const pubMatch = path.match(/^\/api\/orgs\/([a-z0-9_-]{1,64})$/);
  if (pubMatch && method === 'GET') {
    const rows: any[] = await db.$queryRawUnsafe(`SELECT ${PUBLIC_COLS} FROM organizations WHERE (slug = $1 OR id = $1) AND status = 'ACTIVE' LIMIT 1`, pubMatch[1]);
    if (!rows[0]) return send(res, 404, { error: 'ONG não encontrada' }), true;
    return send(res, 200, { org: publicOrg(rows[0]) }), true;
  }

  // ---------- administrador da ONG: a própria ONG
  if (path === '/api/admin/org') {
    if (!ctx.isAdmin) return send(res, 401, { error: 'Não autorizado' }), true;
    const orgId = orgIdForRequest(ctx.req, auth, ctx.isAdmin);
    if (method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM organizations WHERE id = $1`, orgId);
      if (!rows[0]) return send(res, 404, { error: 'ONG não encontrada' }), true;
      return send(res, 200, { org: { ...publicOrg(rows[0]), status: rows[0].status }, platformAdmin: isPlatformAdmin(auth, ctx.isAdmin) }), true;
    }
    if (method === 'PATCH') {
      const patch = pickEditable(body, false);
      if (patch.error) return send(res, 400, { error: patch.error }), true;
      await applyPatch(db, orgId, patch.data);
      return send(res, 200, { ok: true }), true;
    }
  }

  // ---------- equipe da plataforma
  if (path.startsWith('/api/platform/')) {
    if (!isPlatformAdmin(auth, ctx.isAdmin)) return send(res, 403, { error: 'Só a equipe da plataforma' }), true;

    // Separação de dados (fase 2): estado, aplicar de novo e autoteste no banco de verdade (tudo desfeito)
    if (path === '/api/platform/isolation' && (method === 'GET' || method === 'POST')) {
      const schema = await ensureIsolationSchema(db, method === 'POST').catch((e: any) => ({ ok: false, errors: [e?.message || String(e)] }));
      const selfTest = await isolationSelfTest(db);
      return send(res, 200, { enabled: isolationOn(), schema, selfTest }), true;
    }

    // Central de pendências de todas as ONGs
    if (path === '/api/platform/inbox' && method === 'GET') {
      const { buildInbox } = await import('./platformInbox');
      return send(res, 200, await buildInbox(db)), true;
    }
    // Manda o resumo agora para quem chamou (teste)
    if (path === '/api/platform/digest/test' && method === 'POST') {
      const { buildInbox, digestContent } = await import('./platformInbox');
      const { sendEmail } = await import('./email');
      const to = String(auth?.email || '').trim();
      if (!to) return send(res, 400, { error: 'Sua conta não tem e-mail' }), true;
      const inbox = await buildInbox(db);
      const r = await sendEmail({ to, ...digestContent(inbox) });
      return send(res, r.ok ? 200 : 502, { ok: r.ok, to, total: inbox.total, error: r.error }), true;
    }

    if (path === '/api/platform/orgs' && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT o.id, o.slug, o.name, o.cnpj, o.status, o.city, o.state, o.branding, o."createdAt", o."activatedAt",
                (SELECT COUNT(*)::int FROM org_onboarding b WHERE b."orgId" = o.id AND b.status = 'APPROVED'
                   AND b.item = ANY($1::text[])) AS approved
           FROM organizations o ORDER BY (o.id = $2) DESC, o."createdAt"`,
        ONBOARDING_ITEMS.filter((i) => i.required).map((i) => i.key),
        DEFAULT_ORG_ID,
      );
      const required = ONBOARDING_ITEMS.filter((i) => i.required).length;
      return send(res, 200, { orgs: rows.map((r) => ({ ...r, required })), isolation: isolationOn() }), true;
    }

    if (path === '/api/platform/orgs' && method === 'POST') {
      const name = String(body.name || '').trim();
      if (name.length < 3 || name.length > 80) return send(res, 400, { error: 'Nome da ONG: de 3 a 80 caracteres', field: 'name' }), true;
      const cnpj = checkCnpj(body.cnpj);
      if (!cnpj.ok) return send(res, 400, { error: cnpj.error, field: 'cnpj' }), true;
      const email = String(body.contactEmail || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'E-mail do responsável inválido', field: 'contactEmail' }), true;
      const city = String(body.city || '').trim().slice(0, 80);
      const state = String(body.state || '').trim().toUpperCase().slice(0, 2);
      if (!city || !/^[A-Z]{2}$/.test(state)) return send(res, 400, { error: 'Informe a cidade e a UF', field: 'city' }), true;
      const dup: any[] = await db.$queryRawUnsafe(`SELECT id, name FROM organizations WHERE cnpj = $1`, cnpj.digits);
      if (dup[0]) return send(res, 409, { error: `Este CNPJ já é da ONG ${dup[0].name}`, field: 'cnpj' }), true;
      let slug = slugify(body.slug || name) || 'ong';
      const taken: any[] = await db.$queryRawUnsafe(`SELECT slug FROM organizations WHERE slug LIKE $1`, `${slug}%`);
      if (taken.some((t) => t.slug === slug)) slug = `${slug}-${taken.length + 1}`;
      const id = `org_${crypto.randomBytes(6).toString('hex')}`;
      await db.$executeRawUnsafe(
        `INSERT INTO organizations (id, slug, name, cnpj, status, city, state, "contactEmail", settings)
         VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8::jsonb)`,
        id, slug, name, cnpj.digits, city, state, email, JSON.stringify({ cities: [city] }),
      );
      await seedChecklist(db, id, [], auth?.email || 'plataforma');
      return send(res, 201, { org: { id, slug, name, status: 'DRAFT' } }), true;
    }

    const m = path.match(/^\/api\/platform\/orgs\/(org_[a-z0-9_]{1,40})(\/.*)?$/);
    if (m) {
      const orgId = m[1];
      const sub = m[2] || '';
      const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM organizations WHERE id = $1`, orgId);
      const org = rows[0];
      if (!org) return send(res, 404, { error: 'ONG não encontrada' }), true;

      if (!sub && method === 'GET') {
        const act = await activationChecks(db, orgId);
        const secrets: any[] = await db.$queryRawUnsafe(`SELECT key, "updatedAt" FROM org_secrets WHERE "orgId" = $1`, orgId);
        return send(res, 200, {
          org: { ...publicOrg(org), status: org.status, contactEmail: org.contactEmail, fees: org.fees, createdAt: org.createdAt, activatedAt: org.activatedAt, suspendReason: org.suspendReason },
          checklist: act.checklist,
          activation: { ready: act.ready, checks: act.checks },
          secrets: SECRET_KEYS.map((k) => ({ key: k, set: secrets.some((s) => s.key === k) || (orgId === DEFAULT_ORG_ID && !!process.env[k]) })),
        }), true;
      }
      if (!sub && method === 'PATCH') {
        const patch = pickEditable(body, true);
        if (patch.error) return send(res, 400, { error: patch.error }), true;
        await applyPatch(db, orgId, patch.data);
        return send(res, 200, { ok: true }), true;
      }
      const itemMatch = sub.match(/^\/onboarding\/([A-Z][0-9])$/);
      if (itemMatch && method === 'PUT') {
        const item = itemMatch[1];
        if (!ITEM_KEYS.has(item)) return send(res, 400, { error: 'Item desconhecido' }), true;
        const status = String(body.status || '').toUpperCase();
        if (!(ITEM_STATUSES as readonly string[]).includes(status)) return send(res, 400, { error: 'Situação inválida' }), true;
        if (status === 'REJECTED' && !String(body.note || '').trim()) return send(res, 400, { error: 'Diga o motivo da recusa na observação', field: 'note' }), true;
        await db.$executeRawUnsafe(
          `INSERT INTO org_onboarding ("orgId", item, status, note, "updatedBy", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT ("orgId", item) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW()`,
          orgId, item, status, String(body.note || '').trim().slice(0, 500) || null, auth?.email || 'plataforma',
        );
        if (org.status === 'DRAFT') await db.$executeRawUnsafe(`UPDATE organizations SET status = 'ONBOARDING', "updatedAt" = NOW() WHERE id = $1`, orgId);
        return send(res, 200, { ok: true }), true;
      }
      const secretMatch = sub.match(/^\/secrets\/([A-Z_]{3,40})$/);
      if (secretMatch && method === 'PUT') {
        const key = secretMatch[1];
        if (!(SECRET_KEYS as readonly string[]).includes(key)) return send(res, 400, { error: 'Credencial desconhecida' }), true;
        const value = String(body.value || '').trim();
        if (value.length < 10 || value.length > 4000) return send(res, 400, { error: 'Valor inválido' }), true;
        await db.$executeRawUnsafe(
          `INSERT INTO org_secrets ("orgId", key, value, "updatedAt") VALUES ($1, $2, $3, NOW())
           ON CONFLICT ("orgId", key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()`,
          orgId, key, encryptSecret(value),
        );
        console.log(`🔐 Credencial ${key} salva para ${orgId}`);
        return send(res, 200, { ok: true }), true;
      }
      if (sub === '/activation' && method === 'GET') {
        const act = await activationChecks(db, orgId);
        return send(res, 200, { ready: act.ready, checks: act.checks }), true;
      }
      if (sub === '/activate' && method === 'POST') {
        const act = await activationChecks(db, orgId);
        if (!act.ready) return send(res, 409, { error: 'Ainda não dá para ativar', checks: act.checks.filter((c) => !c.ok) }), true;
        await db.$executeRawUnsafe(`UPDATE organizations SET status = 'ACTIVE', "activatedAt" = COALESCE("activatedAt", NOW()), "suspendedAt" = NULL, "suspendReason" = NULL, "updatedAt" = NOW() WHERE id = $1`, orgId);
        console.log(`✅ ONG ativada: ${orgId} por ${auth?.email}`);
        return send(res, 200, { ok: true, status: 'ACTIVE' }), true;
      }
      if (sub === '/suspend' && method === 'POST') {
        if (orgId === DEFAULT_ORG_ID && body.confirm !== 'SUSPENDER LIGA') return send(res, 400, { error: 'Para suspender a ONG pioneira, confirme com "SUSPENDER LIGA"' }), true;
        const reason = String(body.reason || '').trim();
        if (reason.length < 5) return send(res, 400, { error: 'Diga o motivo da suspensão', field: 'reason' }), true;
        await db.$executeRawUnsafe(`UPDATE organizations SET status = 'SUSPENDED', "suspendedAt" = NOW(), "suspendReason" = $2, "updatedAt" = NOW() WHERE id = $1`, orgId, reason.slice(0, 500));
        console.log(`⛔ ONG suspensa: ${orgId} por ${auth?.email}`);
        return send(res, 200, { ok: true, status: 'SUSPENDED' }), true;
      }
    }
    return send(res, 404, { error: 'Rota da plataforma não encontrada' }), true;
  }

  return send(res, 405, { error: 'Método não permitido' }), true;
}

// Campos editáveis. A equipe da plataforma também mexe em nome, CNPJ, cidade/UF e taxa.
function pickEditable(b: any, platform: boolean): { data?: any; error?: string } {
  const out: any = { branding: {}, contacts: {}, settings: {} };
  const color = (v: any) => (v == null || v === '' ? null : /^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : undefined);
  if (b.branding) {
    for (const k of ['primary', 'dark']) {
      if (b.branding[k] !== undefined) {
        const c = color(b.branding[k]);
        if (c === undefined) return { error: `Cor inválida em ${k} (use #RRGGBB)` };
        out.branding[k] = c;
      }
    }
    if (b.branding.logo !== undefined) out.branding.logo = b.branding.logo ? String(b.branding.logo).slice(0, 500) : null;
    if (b.branding.cover !== undefined) out.branding.cover = b.branding.cover ? String(b.branding.cover).slice(0, 500) : null;
  }
  if (b.contacts) {
    if (b.contacts.whatsapp !== undefined) out.contacts.whatsapp = String(b.contacts.whatsapp || '').replace(/\D/g, '').slice(0, 13) || null;
    for (const k of ['email', 'privacyEmail', 'privacyName']) {
      if (b.contacts[k] !== undefined) out.contacts[k] = String(b.contacts[k] || '').trim().slice(0, 160) || null;
    }
  }
  if (b.about !== undefined) {
    const a = String(b.about || '').trim();
    if (a.length > 500) return { error: 'Texto "Quem somos": até 500 caracteres' };
    out.settings.about = a || null;
  }
  if (b.cities !== undefined) {
    if (!Array.isArray(b.cities) || b.cities.length > 30) return { error: 'Cidades: lista de até 30' };
    out.settings.cities = b.cities.map((c: any) => String(c).trim().slice(0, 80)).filter(Boolean);
  }
  if (platform) {
    if (b.name !== undefined) {
      const n = String(b.name).trim();
      if (n.length < 3 || n.length > 80) return { error: 'Nome: de 3 a 80 caracteres' };
      out.name = n;
    }
    if (b.legalName !== undefined) out.legalName = String(b.legalName || '').trim().slice(0, 160) || null;
    if (b.fees !== undefined) {
      const rate = Number(b.fees?.rate), donationRate = Number(b.fees?.donationRate ?? b.fees?.rate), capCents = Math.round(Number(b.fees?.capCents));
      if (!(rate >= 0 && rate <= 0.3) || !(donationRate >= 0 && donationRate <= 0.3) || !(capCents >= 0)) return { error: 'Taxa inválida (0 a 30%, teto em centavos)' };
      out.fees = { rate, donationRate, capCents };
    }
  }
  return { data: out };
}

async function applyPatch(db: any, orgId: string, d: any) {
  await db.$executeRawUnsafe(
    `UPDATE organizations SET
        branding = branding || $2::jsonb, contacts = contacts || $3::jsonb, settings = settings || $4::jsonb,
        name = COALESCE($5, name), "legalName" = COALESCE($6, "legalName"),
        fees = CASE WHEN $7::jsonb IS NULL THEN fees ELSE $7::jsonb END, "updatedAt" = NOW()
      WHERE id = $1`,
    orgId,
    JSON.stringify(d.branding || {}),
    JSON.stringify(d.contacts || {}),
    JSON.stringify(d.settings || {}),
    d.name ?? null,
    d.legalName ?? null,
    d.fees ? JSON.stringify(d.fees) : null,
  );
}

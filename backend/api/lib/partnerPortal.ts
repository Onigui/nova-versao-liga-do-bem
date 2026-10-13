/**
 * Portal do parceiro (backend do App Liga do Bem Parceiros) + gestão de acessos no admin.
 *
 * Um usuário é ligado a uma empresa parceira pela tabela partner_accounts
 * (OWNER = dono, pode editar tudo e cadastrar funcionários; STAFF = só valida carteirinhas).
 * O acesso depende dessa ligação, não do campo users.role.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { cardTokenSecret, issueCardToken, parseCardCode, CARD_CODE_ERRORS } from './cardToken';
import { isMembershipCurrentlyActive } from './membershipBilling';
import { sendEmail, isEmailDeliveryConfigured, escapeHtml } from './email';
import { handlePartnerPushRoutes, handleAdminPushRoutes } from './partnerPush';
import { issueManualAccessCode, accessCodeMessage } from './accessCode';

type Ctx = {
  req: any;
  res: any;
  path: string;
  method: string;
  body: any;
  db: any;
  jwtSecret: string;
  isAdmin: boolean;
  /** Lança erro com .status = 401 se não houver usuário autenticado. */
  authUser: () => { userId: string; email?: string; role?: string };
};

const MANUAL_LOOKUPS_PER_HOUR = 30;
const VALIDATIONS_PER_MINUTE = 30;
const EDIT_WINDOW_MINUTES = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------- schema

let schemaEnsuredAt = 0;
export async function ensurePartnerPortalSchema(db: any, force = false) {
  if (!force && Date.now() - schemaEnsuredAt < 6 * 60 * 60 * 1000) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS partner_accounts (
       id TEXT PRIMARY KEY,
       "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
       "userId" TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
       role TEXT NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER','STAFF')),
       "createdById" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS partner_accounts_partner_idx ON partner_accounts("partnerId")`,
    `CREATE TABLE IF NOT EXISTS partner_lookup_attempts (
       id TEXT PRIMARY KEY,
       "accountId" TEXT NOT NULL,
       method TEXT NOT NULL,
       ok BOOLEAN NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS partner_lookup_attempts_idx ON partner_lookup_attempts("accountId", "createdAt")`,
    `ALTER TABLE partner_validations ADD COLUMN IF NOT EXISTS "validatedById" TEXT`,
    `ALTER TABLE partner_validations ADD COLUMN IF NOT EXISTS method TEXT`,
    `ALTER TABLE partner_validations ADD COLUMN IF NOT EXISTS "memberId" TEXT`,
    `ALTER TABLE partner_validations ADD COLUMN IF NOT EXISTS "membershipActive" BOOLEAN NOT NULL DEFAULT true`,
    `CREATE INDEX IF NOT EXISTS partner_validations_partner_idx ON partner_validations("partnerId", "validatedAt")`,
    `ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`,
    `CREATE TABLE IF NOT EXISTS partner_logos (
       "partnerId" TEXT PRIMARY KEY REFERENCES partners(id) ON DELETE CASCADE,
       mime TEXT NOT NULL,
       data BYTEA NOT NULL,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3)`,
  ];
  for (const sql of statements) await db.$executeRawUnsafe(sql);
  schemaEnsuredAt = Date.now();
}

// ---------------------------------------------------------------- helpers

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

const str = (v: any, max: number) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  if (s.length > max) throw new HttpError(400, `Texto muito longo (máx. ${max} caracteres)`);
  return s;
};

function num(v: any, field: string, min: number, max: number) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${field} inválido`);
  return n;
}

function date(v: any, field: string) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${field} inválida`);
  return d;
}

async function partnerAccountOf(db: any, userId: string) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT a.id, a.role, a."partnerId", p."isActive" AS "partnerActive"
       FROM partner_accounts a JOIN partners p ON p.id = a."partnerId"
      WHERE a."userId" = $1 LIMIT 1`,
    userId,
  );
  const acc = rows?.[0];
  if (!acc) throw new HttpError(403, 'Este usuário não tem acesso de parceiro.', 'NOT_PARTNER');
  return acc as { id: string; role: 'OWNER' | 'STAFF'; partnerId: string; partnerActive: boolean };
}

function requireOwner(acc: { role: string }) {
  if (acc.role !== 'OWNER') throw new HttpError(403, 'Apenas o responsável pela empresa pode fazer isso.', 'OWNER_ONLY');
}

const PARTNER_FIELDS = `id, name, description, category, email, phone, website, logo, address,
  latitude, longitude, city, state, "zipCode", hours, "isActive", "updatedAt"`;

async function loadPartner(db: any, partnerId: string) {
  const rows: any[] = await db.$queryRawUnsafe(`SELECT ${PARTNER_FIELDS} FROM partners WHERE id = $1`, partnerId);
  return rows?.[0] || null;
}

function formatDiscount(d: any) {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    percentage: d.percentage != null ? Number(d.percentage) : null,
    fixedAmount: d.fixedAmount != null ? Number(d.fixedAmount) : null,
    isActive: d.isActive,
    validFrom: d.validFrom,
    validUntil: d.validUntil,
    /** Formato curto usado no selo do app do membro ("20%" → o app acrescenta "OFF"). */
    short:
      d.percentage != null
        ? `${Number(d.percentage)}%`
        : d.fixedAmount != null
          ? `R$ ${Number(d.fixedAmount).toFixed(2).replace('.', ',')}`
          : null,
    label:
      d.percentage != null
        ? `${Number(d.percentage)}% OFF`
        : d.fixedAmount != null
          ? `R$ ${Number(d.fixedAmount).toFixed(2).replace('.', ',')} OFF`
          : 'Benefício',
  };
}

/** Descontos que o membro vê no app principal agora. */
export async function listCurrentDiscounts(db: any, partnerIds?: string[]) {
  const params: any[] = [];
  let where = `"isActive" = true AND "archivedAt" IS NULL AND "validFrom" <= NOW()
               AND ("validUntil" IS NULL OR "validUntil" >= NOW())`;
  if (partnerIds) {
    if (!partnerIds.length) return [];
    params.push(partnerIds);
    where += ` AND "partnerId" = ANY($1::text[])`;
  }
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT * FROM partner_discounts WHERE ${where} ORDER BY "createdAt" DESC`,
    ...params,
  );
  return rows.map((r) => ({ ...formatDiscount(r), partnerId: r.partnerId }));
}

/** Cria (ou liga) o usuário de acesso de uma empresa e manda o e-mail de boas-vindas. */
export async function createPartnerAccess(
  db: any,
  opts: { partnerId: string; email: string; name?: string; role: 'OWNER' | 'STAFF'; createdById: string },
) {
  const email = String(opts.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Informe um e-mail válido');
  const role = opts.role === 'STAFF' ? 'STAFF' : 'OWNER';
  const partner = await loadPartner(db, opts.partnerId);
  if (!partner) throw new HttpError(404, 'Parceiro não encontrado');

  const users: any[] = await db.$queryRawUnsafe(
    `SELECT id, name, "isActive" FROM users WHERE lower(email) = $1 LIMIT 1`,
    email,
  );
  let userId = users?.[0]?.id as string | undefined;
  let created = false;
  if (userId) {
    const linked: any[] = await db.$queryRawUnsafe(
      `SELECT "partnerId" FROM partner_accounts WHERE "userId" = $1`,
      userId,
    );
    if (linked?.[0]) {
      if (linked[0].partnerId === opts.partnerId) throw new HttpError(409, 'Este e-mail já tem acesso a esta empresa.');
      throw new HttpError(409, 'Este e-mail já está ligado a outra empresa parceira.');
    }
    if (users[0].isActive === false) throw new HttpError(409, 'Este usuário está desativado.');
  } else {
    const name = String(opts.name || '').trim() || `${partner.name}`;
    userId = crypto.randomUUID();
    // Senha aleatória inutilizável: o parceiro define a dele pelo "Primeiro acesso" (código por e-mail).
    const unusable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    await db.$executeRawUnsafe(
      `INSERT INTO users (id, email, password, name, role, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'PARTNER', true, NOW(), NOW())`,
      userId,
      email,
      unusable,
      name.slice(0, 120),
    );
    created = true;
  }

  const accountId = crypto.randomUUID();
  await db.$executeRawUnsafe(
    `INSERT INTO partner_accounts (id, "partnerId", "userId", role, "createdById") VALUES ($1, $2, $3, $4, $5)`,
    accountId,
    opts.partnerId,
    userId,
    role,
    opts.createdById,
  );

  let emailSent = false;
  if (isEmailDeliveryConfigured()) {
    const appUrl = process.env.PARTNER_APP_URL || '';
    const pName = escapeHtml(partner.name);
    const steps = created
      ? `Para entrar, abra o app <strong>Liga do Bem Parceiros</strong>, toque em <strong>Primeiro acesso / Esqueci a senha</strong> e informe este e-mail. Você vai receber um código para criar sua senha.`
      : `Entre no app <strong>Liga do Bem Parceiros</strong> com o mesmo e-mail e senha que você já usa na Liga do Bem.`;
    const r = await sendEmail({
      to: email,
      subject: `Seu acesso de parceiro — ${partner.name}`,
      text:
        `Você recebeu acesso ${role === 'OWNER' ? 'de responsável' : 'de funcionário'} da empresa ${partner.name} na Liga do Bem.\n\n` +
        (created
          ? 'Para entrar, abra o app Liga do Bem Parceiros, toque em "Primeiro acesso / Esqueci a senha" e informe este e-mail. Você vai receber um código para criar sua senha.'
          : 'Entre no app Liga do Bem Parceiros com o mesmo e-mail e senha que você já usa na Liga do Bem.') +
        (appUrl ? `\n\nBaixe o app: ${appUrl}` : ''),
      html:
        `<p>Você recebeu acesso <strong>${role === 'OWNER' ? 'de responsável' : 'de funcionário'}</strong> da empresa <strong>${pName}</strong> na Liga do Bem.</p>` +
        `<p>${steps}</p>` +
        (appUrl ? `<p><a href="${escapeHtml(appUrl)}">Baixar o app Liga do Bem Parceiros</a></p>` : ''),
    });
    emailSent = r.ok;
    if (!r.ok) console.warn('⚠️ E-mail de acesso do parceiro não enviado:', r.error);
  }

  // Código de primeiro acesso: funciona mesmo se o e-mail não chegar (entregue por WhatsApp)
  // Conta que já existia: a pessoa entra com a senha que já tem (nada de código que troque a senha dela)
  if (!created) {
    return { accountId, userId, email, role, createdUser: false, emailSent, accessCode: null, accessCodeExpiresAt: null, shareMessage: null };
  }
  const access = await issueManualAccessCode(db, email, role === 'OWNER' ? 'ADMIN' : 'PARTNER_OWNER');
  const accName: any[] = await db.$queryRawUnsafe(`SELECT name FROM users WHERE id = $1`, userId);
  return {
    accountId, userId, email, role, createdUser: true, emailSent,
    accessCode: access.code,
    accessCodeExpiresAt: access.expiresAt,
    shareMessage: accessCodeMessage({ name: accName[0]?.name, email, code: access.code, app: 'partner', partnerName: partner.name }),
  };
}

const LOGO_MAX_BYTES = 400 * 1024;

/** Decodifica "data:image/png;base64,..." (ou base64 puro) e confere pelo conteúdo que é JPEG/PNG/WebP. */
export function decodeLogo(input: unknown): { mime: string; data: Buffer } | { error: string } {
  const raw = String(input || '');
  const m = raw.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  const b64 = (m ? m[2] : raw).replace(/\s/g, '');
  if (!b64 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return { error: 'Imagem inválida' };
  const data = Buffer.from(b64, 'base64');
  if (!data.length) return { error: 'Imagem inválida' };
  if (data.length > LOGO_MAX_BYTES) return { error: 'Imagem muito grande (máx. 400 KB). Escolha outra ou recorte.' };
  const hex = data.subarray(0, 12).toString('hex');
  let mime = '';
  if (hex.startsWith('ffd8ff')) mime = 'image/jpeg';
  else if (hex.startsWith('89504e470d0a1a0a')) mime = 'image/png';
  else if (hex.startsWith('52494646') && data.subarray(8, 12).toString() === 'WEBP') mime = 'image/webp';
  if (!mime) return { error: 'Use uma imagem JPG, PNG ou WebP' };
  return { mime, data };
}

function publicApiBase() {
  return (process.env.API_PUBLIC_URL || 'https://nova-versao-liga-do-bem.vercel.app').replace(/\/+$/, '');
}

/** Gera um código novo de primeiro acesso para uma conta de parceiro (admin ou responsável). */
async function newCodeForAccount(db: any, accountId: string, partnerId: string | null, source: 'ADMIN' | 'PARTNER_OWNER') {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT a.id, a."partnerId", u.email, u.name, u.role::text AS "userRole", p.name AS "partnerName"
       FROM partner_accounts a JOIN users u ON u.id = a."userId" JOIN partners p ON p.id = a."partnerId"
      WHERE a.id = $1 ${partnerId ? 'AND a."partnerId" = $2' : ''}`,
    ...(partnerId ? [accountId, partnerId] : [accountId]),
  );
  const a = rows?.[0];
  if (!a) throw new HttpError(404, 'Acesso não encontrado');
  // O responsável só gera código para contas criadas como parceiro (nunca para a conta de um membro)
  if (source === 'PARTNER_OWNER' && a.userRole !== 'PARTNER') {
    throw new HttpError(403, 'Esta pessoa já tem conta na Liga do Bem e entra com a própria senha. Se esqueceu, ela usa "Esqueci a senha".', 'EXISTING_ACCOUNT');
  }
  const c = await issueManualAccessCode(db, a.email, source);
  return {
    email: a.email,
    accessCode: c.code,
    accessCodeExpiresAt: c.expiresAt,
    shareMessage: accessCodeMessage({ name: a.name, email: a.email, code: c.code, app: 'partner', partnerName: a.partnerName }),
  };
}

// ---------------------------------------------------------------- validação

async function validateCard(ctx: Ctx, acc: { id: string; partnerId: string }, userId: string) {
  const { db, body } = ctx;
  const parsed = parseCardCode(body?.code, cardTokenSecret(ctx.jwtSecret));

  const recent: any[] = await db.$queryRawUnsafe(
    `SELECT
       (SELECT COUNT(*)::int FROM partner_lookup_attempts WHERE "accountId" = $1 AND "createdAt" > NOW() - INTERVAL '1 minute') AS minute,
       (SELECT COUNT(*)::int FROM partner_lookup_attempts WHERE "accountId" = $1 AND method = 'MANUAL' AND "createdAt" > NOW() - INTERVAL '1 hour') AS manual`,
    acc.id,
  );
  if ((recent?.[0]?.minute || 0) >= VALIDATIONS_PER_MINUTE) {
    throw new HttpError(429, 'Muitas validações seguidas. Aguarde um minuto.');
  }
  if (parsed.ok && parsed.kind === 'MANUAL' && (recent?.[0]?.manual || 0) >= MANUAL_LOOKUPS_PER_HOUR) {
    throw new HttpError(429, 'Limite de consultas digitadas atingido. Use a leitura do QR.');
  }

  const logAttempt = (method: string, ok: boolean) =>
    db.$executeRawUnsafe(
      `INSERT INTO partner_lookup_attempts (id, "accountId", method, ok) VALUES ($1, $2, $3, $4)`,
      crypto.randomUUID(),
      acc.id,
      method,
      ok,
    );

  if (parsed.ok === false) {
    const reason = (parsed as { reason: string }).reason;
    await logAttempt('INVALID', false);
    return { status: 200, json: { valid: false, reason, message: CARD_CODE_ERRORS[reason] } };
  }

  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT m.id, m."memberId", m."userId", m.status, m."endDate", m."planCode", m."planMonths",
            u.name, u.avatar, u."isActive" AS "userActive"
       FROM memberships m JOIN users u ON u.id = m."userId"
      WHERE upper(m."memberId") = upper($1) LIMIT 1`,
    parsed.memberId,
  );
  const m = rows?.[0];
  if (!m || (parsed.kind === 'LEGACY' && m.userId !== parsed.userId)) {
    await logAttempt(parsed.kind, false);
    return {
      status: 200,
      json: { valid: false, reason: 'NOT_FOUND', message: 'Carteirinha não encontrada. Não aceite esta carteirinha.' },
    };
  }
  await logAttempt(parsed.kind, true);

  const active = m.userActive !== false && isMembershipCurrentlyActive(m);
  const validationId = crypto.randomUUID();
  await db.$executeRawUnsafe(
    `INSERT INTO partner_validations
       (id, "partnerId", "userId", "discountId", amount, "validatedAt", "validatedById", method, "memberId", "membershipActive")
     VALUES ($1, $2, $3, NULL, 0, NOW(), $4, $5, $6, $7)`,
    validationId,
    acc.partnerId,
    m.userId,
    userId,
    parsed.kind,
    m.memberId,
    active,
  );

  const discounts = active ? await listCurrentDiscounts(db, [acc.partnerId]) : [];
  return {
    status: 200,
    json: {
      valid: active,
      reason: active ? null : 'MEMBERSHIP_INACTIVE',
      message: active
        ? 'Carteirinha ATIVA. Confira o nome com um documento.'
        : 'Carteirinha VENCIDA ou inativa. O desconto não se aplica.',
      method: parsed.kind,
      warning:
        parsed.kind === 'LEGACY'
          ? 'QR antigo (sem assinatura). Confira o documento e peça para o membro atualizar o app.'
          : parsed.kind === 'MANUAL'
            ? 'Número digitado: confira o nome com um documento com foto.'
            : null,
      validationId,
      member: {
        memberId: m.memberId,
        name: m.name,
        avatar: m.avatar || null,
        status: m.status,
        endDate: m.endDate,
        planCode: m.planCode,
      },
      discounts,
    },
  };
}

// ---------------------------------------------------------------- roteador

export async function handlePartnerPortal(ctx: Ctx): Promise<boolean> {
  const { path, method, res, db } = ctx;
  const isPartnerRoute = path.startsWith('/api/partner/');
  const isAdminRoute =
    /^\/api\/admin\/partners\/[^/]+\/accounts$/.test(path) ||
    /^\/api\/admin\/partner-accounts\/[^/]+(\/access-code)?$/.test(path) ||
    path === '/api/admin/partner-validations' ||
    path.startsWith('/api/admin/partner-push-');
  const isCardToken = path === '/api/membership/card-token';
  const logoMatch = path.match(/^\/api\/partners\/([^/]+)\/logo$/);
  if (!isPartnerRoute && !isAdminRoute && !isCardToken && !logoMatch) return false;

  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return true;
  }

  try {
    await ensurePartnerPortalSchema(db);
    const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};

    // ---------- público: logo da empresa (endereço versionado → cache longo)
    if (logoMatch && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT mime, data FROM partner_logos WHERE "partnerId" = $1`,
        logoMatch[1],
      );
      if (!rows?.[0]) {
        res.status(404).json({ error: 'Logo não encontrado' });
        return true;
      }
      res.setHeader('Content-Type', rows[0].mime);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.status(200).end(Buffer.from(rows[0].data));
      return true;
    }

    // ---------- membro: código do QR assinado
    if (isCardToken && method === 'GET') {
      const { userId } = ctx.authUser();
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT "memberId", status, "endDate" FROM memberships WHERE "userId" = $1 LIMIT 1`,
        userId,
      );
      const m = rows?.[0];
      if (!m?.memberId) throw new HttpError(404, 'Você ainda não tem carteirinha.', 'NO_MEMBERSHIP');
      const t = issueCardToken(cardTokenSecret(ctx.jwtSecret), m.memberId);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ ...t, memberId: m.memberId, active: isMembershipCurrentlyActive(m) });
      return true;
    }

    // ---------- admin
    if (isAdminRoute) {
      if (!ctx.isAdmin) throw new HttpError(401, 'Acesso restrito ao administrador');
      let adminId = 'admin';
      try {
        adminId = ctx.authUser().userId;
      } catch {
        /* token demo / x-admin-token */
      }

      const accMatch = path.match(/^\/api\/admin\/partners\/([^/]+)\/accounts$/);
      if (accMatch && method === 'GET') {
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT a.id, a.role, a."createdAt", u.id AS "userId", u.email, u.name
             FROM partner_accounts a JOIN users u ON u.id = a."userId"
            WHERE a."partnerId" = $1 ORDER BY a.role, a."createdAt"`,
          accMatch[1],
        );
        res.status(200).json({ accounts: rows });
        return true;
      }
      if (accMatch && method === 'POST') {
        const r = await createPartnerAccess(db, {
          partnerId: accMatch[1],
          email: body.email,
          name: body.name,
          role: body.role === 'STAFF' ? 'STAFF' : 'OWNER',
          createdById: adminId,
        });
        res.status(201).json({ message: 'Acesso criado', ...r });
        return true;
      }
      const codeMatch = path.match(/^\/api\/admin\/partner-accounts\/([^/]+)\/access-code$/);
      if (codeMatch && method === 'POST') {
        res.status(200).json(await newCodeForAccount(db, codeMatch[1], null, 'ADMIN'));
        return true;
      }
      const delMatch = path.match(/^\/api\/admin\/partner-accounts\/([^/]+)$/);
      if (delMatch && method === 'DELETE') {
        const n = await db.$executeRawUnsafe(`DELETE FROM partner_accounts WHERE id = $1`, delMatch[1]);
        if (!n) throw new HttpError(404, 'Acesso não encontrado');
        res.status(200).json({ message: 'Acesso removido' });
        return true;
      }
      if (path === '/api/admin/partner-validations' && method === 'GET') {
        const partnerId = ctx.req.query?.partnerId || null;
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT v.id, v."validatedAt", v.method, v."memberId", v."membershipActive", v.amount,
                  p.id AS "partnerId", p.name AS "partnerName", u.name AS "memberName", d.name AS "discountName"
             FROM partner_validations v
             JOIN partners p ON p.id = v."partnerId"
             JOIN users u ON u.id = v."userId"
             LEFT JOIN partner_discounts d ON d.id = v."discountId"
            WHERE ($1::text IS NULL OR v."partnerId" = $1)
            ORDER BY v."validatedAt" DESC LIMIT 200`,
          partnerId,
        );
        res.status(200).json({ validations: rows.map((r) => ({ ...r, amount: Number(r.amount || 0) })) });
        return true;
      }
      if (await handleAdminPushRoutes(ctx, adminId)) return true;
      throw new HttpError(404, 'Rota não encontrada');
    }

    // ---------- parceiro
    const { userId } = ctx.authUser();
    const acc = await partnerAccountOf(db, userId);
    if (!acc.partnerActive) {
      throw new HttpError(403, 'Esta empresa está desativada na Liga do Bem. Fale com a administração.', 'PARTNER_INACTIVE');
    }

    if (path === '/api/partner/me' && method === 'GET') {
      const partner = await loadPartner(db, acc.partnerId);
      const stats: any[] = await db.$queryRawUnsafe(
        `SELECT
           COUNT(*) FILTER (WHERE "validatedAt" >= date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')::int AS today,
           COUNT(*) FILTER (WHERE "validatedAt" >= NOW() - INTERVAL '30 days')::int AS last30,
           COUNT(*) FILTER (WHERE "validatedAt" >= NOW() - INTERVAL '30 days' AND "discountId" IS NOT NULL)::int AS "discountsUsed30"
         FROM partner_validations WHERE "partnerId" = $1`,
        acc.partnerId,
      );
      res.status(200).json({
        account: { id: acc.id, role: acc.role },
        partner,
        stats: stats?.[0] || { today: 0, last30: 0, discountsUsed30: 0 },
      });
      return true;
    }

    if (path === '/api/partner/me' && method === 'PUT') {
      requireOwner(acc);
      const fields: Record<string, any> = {
        name: str(body.name, 120),
        description: str(body.description, 2000),
        category: str(body.category, 60),
        email: str(body.email, 160),
        phone: str(body.phone, 40),
        website: str(body.website, 300),
        logo: str(body.logo, 1000),
        address: str(body.address, 300),
        city: str(body.city, 100),
        state: str(body.state, 2),
        zipCode: str(body.zipCode, 9),
        hours: str(body.hours, 300),
        latitude: num(body.latitude, 'Latitude', -90, 90),
        longitude: num(body.longitude, 'Longitude', -180, 180),
      };
      for (const req of ['name', 'category', 'address', 'city', 'state', 'zipCode']) {
        if (fields[req] !== undefined && !fields[req]) throw new HttpError(400, `O campo ${req} não pode ficar vazio`);
      }
      if (fields.email && !EMAIL_RE.test(fields.email)) throw new HttpError(400, 'E-mail inválido');
      if (fields.state) fields.state = fields.state.toUpperCase();
      if (fields.website && !/^https?:\/\//i.test(fields.website)) fields.website = `https://${fields.website}`;
      if (fields.logo && !/^https:\/\//i.test(fields.logo)) throw new HttpError(400, 'O logo precisa ser um link https');

      const sets: string[] = [];
      const params: any[] = [];
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue;
        params.push(v);
        sets.push(`"${k}" = $${params.length}`);
      }
      if (!sets.length) throw new HttpError(400, 'Nada para atualizar');
      params.push(acc.partnerId);
      await db.$executeRawUnsafe(
        `UPDATE partners SET ${sets.join(', ')}, "updatedAt" = NOW() WHERE id = $${params.length}`,
        ...params,
      );
      res.status(200).json({ message: 'Dados da empresa atualizados', partner: await loadPartner(db, acc.partnerId) });
      return true;
    }

    if (path === '/api/partner/logo' && (method === 'PUT' || method === 'POST')) {
      requireOwner(acc);
      const decoded = decodeLogo(body.imageBase64);
      if ('error' in decoded) throw new HttpError(400, decoded.error);
      await db.$executeRawUnsafe(
        `INSERT INTO partner_logos ("partnerId", mime, data, "updatedAt") VALUES ($1, $2, $3, NOW())
         ON CONFLICT ("partnerId") DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, "updatedAt" = NOW()`,
        acc.partnerId,
        decoded.mime,
        decoded.data,
      );
      const url = `${publicApiBase()}/api/partners/${acc.partnerId}/logo?v=${Date.now()}`;
      await db.$executeRawUnsafe(`UPDATE partners SET logo = $1, "updatedAt" = NOW() WHERE id = $2`, url, acc.partnerId);
      res.status(200).json({ message: 'Logo atualizado', logo: url, partner: await loadPartner(db, acc.partnerId) });
      return true;
    }
    if (path === '/api/partner/logo' && method === 'DELETE') {
      requireOwner(acc);
      await db.$executeRawUnsafe(`DELETE FROM partner_logos WHERE "partnerId" = $1`, acc.partnerId);
      await db.$executeRawUnsafe(`UPDATE partners SET logo = NULL, "updatedAt" = NOW() WHERE id = $1`, acc.partnerId);
      res.status(200).json({ message: 'Logo removido', partner: await loadPartner(db, acc.partnerId) });
      return true;
    }

    if (path === '/api/partner/discounts' && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT d.*, (SELECT COUNT(*)::int FROM partner_validations v WHERE v."discountId" = d.id) AS uses
           FROM partner_discounts d
          WHERE d."partnerId" = $1 AND d."archivedAt" IS NULL
          ORDER BY d."isActive" DESC, d."createdAt" DESC`,
        acc.partnerId,
      );
      res.status(200).json({ discounts: rows.map((r) => ({ ...formatDiscount(r), uses: r.uses })) });
      return true;
    }

    const discMatch = path.match(/^\/api\/partner\/discounts\/([^/]+)$/);
    if ((path === '/api/partner/discounts' && method === 'POST') || (discMatch && method === 'PUT')) {
      requireOwner(acc);
      const isNew = !discMatch;
      let current: any = null;
      if (!isNew) {
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT * FROM partner_discounts WHERE id = $1 AND "partnerId" = $2 AND "archivedAt" IS NULL`,
          discMatch![1],
          acc.partnerId,
        );
        current = rows?.[0];
        if (!current) throw new HttpError(404, 'Promoção não encontrada');
      }
      const name = str(body.name, 120);
      const description = str(body.description, 1000);
      const percentage = num(body.percentage, 'Percentual', 1, 100);
      const fixedAmount = num(body.fixedAmount, 'Valor do desconto', 0.01, 100000);
      const validFrom = date(body.validFrom, 'Data de início');
      const validUntil = date(body.validUntil, 'Data de fim');
      const isActive = body.isActive === undefined ? undefined : Boolean(body.isActive);

      const merged = {
        name: name !== undefined ? name : current?.name,
        description: description !== undefined ? description : current?.description ?? null,
        percentage: percentage !== undefined ? percentage : current?.percentage ?? null,
        fixedAmount: fixedAmount !== undefined ? fixedAmount : current?.fixedAmount ?? null,
        validFrom: validFrom !== undefined && validFrom !== null ? validFrom : current?.validFrom ?? new Date(),
        validUntil: validUntil !== undefined ? validUntil : current?.validUntil ?? null,
        isActive: isActive !== undefined ? isActive : current?.isActive ?? true,
      };
      // Percentual e valor fixo são excludentes: o que veio no corpo vence.
      if (percentage != null) merged.fixedAmount = null;
      else if (fixedAmount != null) merged.percentage = null;
      if (!merged.name) throw new HttpError(400, 'Dê um nome para a promoção');
      if (merged.validUntil && new Date(merged.validUntil) < new Date(merged.validFrom)) {
        throw new HttpError(400, 'A data de fim é anterior à de início');
      }

      if (isNew) {
        const id = crypto.randomUUID();
        await db.$executeRawUnsafe(
          `INSERT INTO partner_discounts
             (id, "partnerId", name, description, percentage, "fixedAmount", "isActive", "validFrom", "validUntil", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          id, acc.partnerId, merged.name, merged.description, merged.percentage, merged.fixedAmount,
          merged.isActive, merged.validFrom, merged.validUntil,
        );
        const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM partner_discounts WHERE id = $1`, id);
        res.status(201).json({ message: 'Promoção criada', discount: formatDiscount(rows[0]) });
      } else {
        await db.$executeRawUnsafe(
          `UPDATE partner_discounts SET name = $1, description = $2, percentage = $3, "fixedAmount" = $4,
                  "isActive" = $5, "validFrom" = $6, "validUntil" = $7, "updatedAt" = NOW()
            WHERE id = $8 AND "partnerId" = $9`,
          merged.name, merged.description, merged.percentage, merged.fixedAmount,
          merged.isActive, merged.validFrom, merged.validUntil, current.id, acc.partnerId,
        );
        const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM partner_discounts WHERE id = $1`, current.id);
        res.status(200).json({ message: 'Promoção atualizada', discount: formatDiscount(rows[0]) });
      }
      return true;
    }

    if (discMatch && method === 'DELETE') {
      requireOwner(acc);
      // Arquiva em vez de apagar: o histórico de validações continua apontando para ela.
      const n = await db.$executeRawUnsafe(
        `UPDATE partner_discounts SET "archivedAt" = NOW(), "isActive" = false, "updatedAt" = NOW()
          WHERE id = $1 AND "partnerId" = $2 AND "archivedAt" IS NULL`,
        discMatch[1],
        acc.partnerId,
      );
      if (!n) throw new HttpError(404, 'Promoção não encontrada');
      res.status(200).json({ message: 'Promoção removida' });
      return true;
    }

    if (path === '/api/partner/validate' && method === 'POST') {
      const r = await validateCard(ctx, acc, userId);
      res.status(r.status).json(r.json);
      return true;
    }

    const valMatch = path.match(/^\/api\/partner\/validations\/([^/]+)$/);
    if (valMatch && method === 'PATCH') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT id, "membershipActive", "validatedAt" FROM partner_validations
          WHERE id = $1 AND "partnerId" = $2
            AND "validatedAt" > NOW() - ($3 || ' minutes')::interval`,
        valMatch[1],
        acc.partnerId,
        String(EDIT_WINDOW_MINUTES),
      );
      const v = rows?.[0];
      if (!v) throw new HttpError(404, 'Validação não encontrada ou fora do prazo para registrar o desconto');
      if (!v.membershipActive) throw new HttpError(400, 'Carteirinha inativa: não é possível aplicar desconto');
      let discountId: string | null = null;
      if (body.discountId) {
        const ok: any[] = await db.$queryRawUnsafe(
          `SELECT id FROM partner_discounts WHERE id = $1 AND "partnerId" = $2 AND "archivedAt" IS NULL`,
          String(body.discountId),
          acc.partnerId,
        );
        if (!ok?.[0]) throw new HttpError(400, 'Promoção inválida');
        discountId = ok[0].id;
      }
      const amount = num(body.amount, 'Valor da compra', 0, 1000000) ?? 0;
      await db.$executeRawUnsafe(
        `UPDATE partner_validations SET "discountId" = $1, amount = $2 WHERE id = $3`,
        discountId,
        amount,
        v.id,
      );
      res.status(200).json({ message: 'Uso registrado' });
      return true;
    }

    if (path === '/api/partner/validations' && method === 'GET') {
      const limit = Math.min(Math.max(parseInt(ctx.req.query?.limit, 10) || 50, 1), 200);
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT v.id, v."validatedAt", v.method, v."memberId", v."membershipActive", v.amount,
                u.name AS "memberName", d.name AS "discountName", s.name AS "validatedByName"
           FROM partner_validations v
           JOIN users u ON u.id = v."userId"
           LEFT JOIN partner_discounts d ON d.id = v."discountId"
           LEFT JOIN users s ON s.id = v."validatedById"
          WHERE v."partnerId" = $1
          ORDER BY v."validatedAt" DESC LIMIT $2`,
        acc.partnerId,
        limit,
      );
      res.status(200).json({ validations: rows.map((r) => ({ ...r, amount: Number(r.amount || 0) })) });
      return true;
    }

    if (path === '/api/partner/staff' && method === 'GET') {
      requireOwner(acc);
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT a.id, a.role, a."createdAt", u.email, u.name
           FROM partner_accounts a JOIN users u ON u.id = a."userId"
          WHERE a."partnerId" = $1 ORDER BY a.role, a."createdAt"`,
        acc.partnerId,
      );
      res.status(200).json({ accounts: rows });
      return true;
    }
    if (path === '/api/partner/staff' && method === 'POST') {
      requireOwner(acc);
      const r = await createPartnerAccess(db, {
        partnerId: acc.partnerId,
        email: body.email,
        name: body.name,
        role: 'STAFF',
        createdById: userId,
      });
      res.status(201).json({ message: 'Funcionário cadastrado', ...r });
      return true;
    }
    const staffCode = path.match(/^\/api\/partner\/staff\/([^/]+)\/access-code$/);
    if (staffCode && method === 'POST') {
      requireOwner(acc);
      res.status(200).json(await newCodeForAccount(db, staffCode[1], acc.partnerId, 'PARTNER_OWNER'));
      return true;
    }
    const staffMatch = path.match(/^\/api\/partner\/staff\/([^/]+)$/);
    if (staffMatch && method === 'DELETE') {
      requireOwner(acc);
      if (staffMatch[1] === acc.id) throw new HttpError(400, 'Você não pode remover o próprio acesso');
      const n = await db.$executeRawUnsafe(
        `DELETE FROM partner_accounts WHERE id = $1 AND "partnerId" = $2 AND role = 'STAFF'`,
        staffMatch[1],
        acc.partnerId,
      );
      if (!n) throw new HttpError(404, 'Funcionário não encontrado');
      res.status(200).json({ message: 'Acesso removido' });
      return true;
    }

    if (await handlePartnerPushRoutes(ctx, acc, userId)) return true;

    throw new HttpError(404, 'Rota não encontrada');
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : e?.status || 500;
    if (status >= 500) console.error('❌ Portal do parceiro:', e);
    res.status(status).json({
      error: status >= 500 ? 'Erro interno no portal do parceiro' : e.message,
      code: e?.code,
    });
    return true;
  }
}

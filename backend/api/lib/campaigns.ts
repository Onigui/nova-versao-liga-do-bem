/**
 * Vaquinhas (campanhas de arrecadação) da ONG — ex.: "Cirurgia do Thor", ligada a um animal.
 *
 * - A ONG cria no admin: título, resumo, história, animal (opcional), meta, prazo, capa.
 * - Quem doa usa o checkout de doação de sempre, com campaignId: donations."campaignId".
 * - Arrecadado = doações APROVADAS da campanha + valor recebido por fora do app (lançado pela ONG).
 * - Encerramento automático (calculado na leitura, sem agendador): passou do prazo, ou bateu a
 *   meta quando a ONG não aceita passar da meta. A ONG também pode encerrar na mão.
 * - Atualizações ("o Thor operou hoje") mostram para o doador onde o dinheiro foi parar.
 *
 * Rifa não entra aqui de propósito: sorteio com venda de números precisa de autorização
 * do Ministério da Fazenda (Lei 5.768/71); sem ela é contravenção.
 */
import crypto from 'crypto';
import { markSchemaApplied, schemaApplied, schemaFingerprint } from './schemaOnce';

type Ctx = {
  req: any;
  res: any;
  path: string;
  method: string;
  body: any;
  db: any;
  isAdmin: boolean;
  authUser: () => { userId: string; email?: string; role?: string };
};

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const CAMPAIGN_STATUSES = ['DRAFT', 'ACTIVE', 'ENDED'] as const;
const TITLE_MAX = 80;
const SUMMARY_MAX = 160;
const STORY_MAX = 5000;
const UPDATE_MAX = 2000;
const MAX_GOAL = 10_000_000;
const COVER_MAX_BYTES = 2_500_000;

// ---------------------------------------------------------------- schema

let ensuredAt = 0;
export async function ensureCampaignSchema(db: any, force = false) {
  if (!force && Date.now() - ensuredAt < 6 * 60 * 60 * 1000) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS campaigns (
       id TEXT PRIMARY KEY,
       title TEXT NOT NULL,
       summary TEXT,
       story TEXT,
       "animalId" TEXT,
       "goalAmount" DECIMAL(12,2) NOT NULL,
       "offlineAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
       "endsAt" TIMESTAMP(3),
       status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','ENDED')),
       "allowOverGoal" BOOLEAN NOT NULL DEFAULT true,
       "showDonors" BOOLEAN NOT NULL DEFAULT true,
       "hasCover" BOOLEAN NOT NULL DEFAULT false,
       "publishedAt" TIMESTAMP(3),
       "closedAt" TIMESTAMP(3),
       "closedReason" TEXT,
       "createdById" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns(status, "createdAt")`,
    `CREATE TABLE IF NOT EXISTS campaign_covers (
       "campaignId" TEXT PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
       mime TEXT NOT NULL,
       data BYTEA NOT NULL,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS campaign_updates (
       id TEXT PRIMARY KEY,
       "campaignId" TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
       text TEXT NOT NULL,
       "createdById" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS campaign_updates_campaign_idx ON campaign_updates("campaignId", "createdAt")`,
    `ALTER TABLE donations ADD COLUMN IF NOT EXISTS "campaignId" TEXT`,
    `CREATE INDEX IF NOT EXISTS donations_campaign_idx ON donations("campaignId") WHERE "campaignId" IS NOT NULL`,
  ];
  const fp = schemaFingerprint(statements);
  if (force || !(await schemaApplied(db, 'campaigns', fp))) {
    for (const sql of statements) await db.$executeRawUnsafe(sql);
    await markSchemaApplied(db, 'campaigns', fp);
  }
  ensuredAt = Date.now();
}

// ---------------------------------------------------------------- regras

const money = (v: any) => Math.round(Number(v || 0) * 100) / 100;

/** Situação de verdade agora (o prazo e a meta encerram sozinhos). */
export function effectiveStatus(c: any, raised: number, now = Date.now()) {
  if (c.status === 'DRAFT') return { status: 'DRAFT', reason: null as string | null };
  if (c.status === 'ENDED') return { status: 'ENDED', reason: c.closedReason || 'MANUAL' };
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return { status: 'ENDED', reason: 'DEADLINE' };
  if (!c.allowOverGoal && raised >= money(c.goalAmount)) return { status: 'ENDED', reason: 'GOAL' };
  return { status: 'ACTIVE', reason: null };
}

function apiBase() {
  return (process.env.API_PUBLIC_URL || 'https://nova-versao-liga-do-bem.vercel.app').replace(/\/+$/, '');
}

const RAISED_SQL = `(SELECT COALESCE(SUM(d.amount), 0) FROM donations d WHERE d."campaignId" = c.id AND d.status = 'APPROVED')`;
const DONORS_SQL = `(SELECT COUNT(*)::int FROM donations d WHERE d."campaignId" = c.id AND d.status = 'APPROVED')`;
const BASE_SELECT = `SELECT c.*, ${RAISED_SQL} AS "raisedOnline", ${DONORS_SQL} AS "donorsCount",
       a.name AS "animalName", a.image AS "animalImage", a.species AS "animalSpecies", a."isAdopted" AS "animalAdopted"
  FROM campaigns c LEFT JOIN animals a ON a.id = c."animalId"`;

/** Foto do animal só se for link (data: URL gigante fica fora da lista). */
const linkOnly = (img: any) => (typeof img === 'string' && /^https?:\/\//i.test(img) ? img : null);

export function formatCampaign(r: any, opts: { admin?: boolean } = {}) {
  const online = money(r.raisedOnline);
  const offline = money(r.offlineAmount);
  const raised = money(online + offline);
  const goal = money(r.goalAmount);
  const eff = effectiveStatus(r, raised);
  const v = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
  const animalPhoto = r.animalId && r.animalImage ? (linkOnly(r.animalImage) || `${apiBase()}/api/campaigns/${r.id}/animal-photo?v=${v}`) : null;
  const out: any = {
    id: r.id,
    title: r.title,
    summary: r.summary || null,
    story: r.story || null,
    goal,
    raised,
    percent: goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0,
    remaining: Math.max(0, money(goal - raised)),
    donorsCount: Number(r.donorsCount) || 0,
    endsAt: r.endsAt || null,
    daysLeft: r.endsAt ? Math.max(0, Math.ceil((new Date(r.endsAt).getTime() - Date.now()) / 86400000)) : null,
    status: eff.status,
    closedReason: eff.reason,
    acceptingDonations: eff.status === 'ACTIVE',
    allowOverGoal: !!r.allowOverGoal,
    showDonors: !!r.showDonors,
    coverUrl: r.hasCover ? `${apiBase()}/api/campaigns/${r.id}/cover?v=${v}` : animalPhoto,
    animal: r.animalId
      ? { id: r.animalId, name: r.animalName || null, species: r.animalSpecies || null, photo: animalPhoto, adopted: !!r.animalAdopted }
      : null,
    publishedAt: r.publishedAt || null,
    createdAt: r.createdAt,
  };
  if (opts.admin) {
    out.savedStatus = r.status;
    out.raisedOnline = online;
    out.offlineAmount = offline;
    out.hasCover = !!r.hasCover;
    out.closedAt = r.closedAt || null;
  }
  return out;
}

async function loadCampaign(db: any, id: string) {
  const rows: any[] = await db.$queryRawUnsafe(`${BASE_SELECT} WHERE c.id = $1`, id);
  return rows?.[0] || null;
}

/** Usado pelo checkout de doação: a campanha existe e está aceitando doações? */
export async function campaignForDonation(db: any, id: string) {
  await ensureCampaignSchema(db);
  const r = await loadCampaign(db, String(id || ''));
  if (!r) throw new HttpError(404, 'Campanha não encontrada', 'CAMPAIGN_NOT_FOUND');
  const c = formatCampaign(r);
  if (!c.acceptingDonations) {
    throw new HttpError(
      409,
      c.closedReason === 'GOAL' ? 'Esta campanha já bateu a meta. Obrigado!' : 'Esta campanha já foi encerrada.',
      'CAMPAIGN_CLOSED',
    );
  }
  return c;
}

// ---------------------------------------------------------------- validação de entrada

const text = (v: any, max: number, field: string, required = false) => {
  if (v === undefined) return undefined;
  const s = v === null ? '' : String(v).trim();
  if (required && !s) throw new HttpError(400, `Informe ${field}`);
  if (s.length > max) throw new HttpError(400, `${field[0].toUpperCase()}${field.slice(1)}: máximo de ${max} caracteres`);
  return s || null;
};

/** 1500 | "1500" | "1.500,00" | "1500.5" → número. */
export function parseMoney(v: any): number {
  if (typeof v === 'number') return v;
  let t = String(v ?? '').trim().replace(/[R$\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return t === '' ? NaN : Number(t);
}

function amount(v: any, field: string, min: number) {
  if (v === undefined) return undefined;
  const n = parseMoney(v);
  if (!Number.isFinite(n) || n < min || n > MAX_GOAL) throw new HttpError(400, `${field} inválido`);
  return money(n);
}

function dateOrNull(v: any) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  // "2026-12-31" vale até o fim do dia em Brasília
  const s = String(v);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T23:59:59-03:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Prazo inválido');
  return d;
}

function decodeCover(b64: any): { mime: string; data: Buffer } {
  const raw = String(b64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!raw) throw new HttpError(400, 'Envie a imagem');
  const data = Buffer.from(raw, 'base64');
  if (data.length > COVER_MAX_BYTES) throw new HttpError(400, 'Imagem muito grande (máx. 2,5 MB)');
  const hex = data.subarray(0, 12).toString('hex');
  let mime = '';
  if (hex.startsWith('ffd8ff')) mime = 'image/jpeg';
  else if (hex.startsWith('89504e470d0a1a0a')) mime = 'image/png';
  else if (hex.startsWith('52494646') && data.subarray(8, 12).toString() === 'WEBP') mime = 'image/webp';
  if (!mime) throw new HttpError(400, 'Use uma imagem JPG, PNG ou WebP');
  return { mime, data };
}

async function saveCampaign(db: any, current: any | null, body: any, userId: string | null) {
  const title = text(body.title, TITLE_MAX, 'o título', !current);
  const summary = text(body.summary, SUMMARY_MAX, 'o resumo');
  const story = text(body.story, STORY_MAX, 'a história');
  const goal = amount(body.goalAmount ?? body.goal, 'Valor da meta', 1);
  const offline = amount(body.offlineAmount, 'Valor recebido por fora', 0);
  const endsAt = dateOrNull(body.endsAt);
  let animalId = body.animalId === undefined ? undefined : body.animalId ? String(body.animalId) : null;
  if (animalId) {
    const ok: any[] = await db.$queryRawUnsafe(`SELECT id FROM animals WHERE id = $1`, animalId);
    if (!ok?.[0]) throw new HttpError(400, 'Animal não encontrado');
  }
  const allowOverGoal = body.allowOverGoal === undefined ? undefined : !!body.allowOverGoal;
  const showDonors = body.showDonors === undefined ? undefined : !!body.showDonors;

  if (!current) {
    if (goal === undefined) throw new HttpError(400, 'Informe o valor da meta');
    if (endsAt && endsAt.getTime() < Date.now()) throw new HttpError(400, 'O prazo já passou');
    const id = crypto.randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO campaigns (id, title, summary, story, "animalId", "goalAmount", "offlineAmount", "endsAt",
                              "allowOverGoal", "showDonors", "createdById")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      id, title, summary ?? null, story ?? null, animalId ?? null, goal, offline ?? 0, endsAt ?? null,
      allowOverGoal ?? true, showDonors ?? true, userId,
    );
    return id;
  }
  const pick = (v: any, cur: any) => (v !== undefined ? v : cur);
  await db.$executeRawUnsafe(
    `UPDATE campaigns SET title = $2, summary = $3, story = $4, "animalId" = $5, "goalAmount" = $6,
            "offlineAmount" = $7, "endsAt" = $8, "allowOverGoal" = $9, "showDonors" = $10, "updatedAt" = NOW()
      WHERE id = $1`,
    current.id,
    pick(title, current.title),
    pick(summary, current.summary),
    pick(story, current.story),
    pick(animalId, current.animalId),
    pick(goal, current.goalAmount),
    pick(offline, current.offlineAmount),
    pick(endsAt, current.endsAt),
    pick(allowOverGoal, current.allowOverGoal),
    pick(showDonors, current.showDonors),
  );
  return current.id;
}

/** Nome para a lista pública de apoiadores: "Maria S." (anônimo vira "Anônimo"). */
export function donorDisplayName(name: any, anonymous: boolean) {
  if (anonymous) return 'Anônimo';
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Apoiador';
  const first = parts[0][0].toUpperCase() + parts[0].slice(1).toLowerCase();
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
}

// ---------------------------------------------------------------- rotas

export function isCampaignPath(path: string) {
  return path === '/api/campaigns' || path.startsWith('/api/campaigns/') || path === '/api/admin/campaigns' || path.startsWith('/api/admin/campaigns/');
}

export async function handleCampaigns(ctx: Ctx): Promise<boolean> {
  const { path, method, res, db, body } = ctx;
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return true;
  }
  try {
    await ensureCampaignSchema(db);

    // ---------------- públicas (app e site)
    if (path === '/api/campaigns' && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `${BASE_SELECT}
          WHERE c.status <> 'DRAFT'
            AND (c.status = 'ACTIVE' OR COALESCE(c."closedAt", c."endsAt", c."updatedAt") > NOW() - INTERVAL '30 days')
          ORDER BY c."publishedAt" DESC NULLS LAST, c."createdAt" DESC LIMIT 50`,
      );
      const list = rows.map((r) => formatCampaign(r)).map(({ story, ...c }) => c);
      // Abertas primeiro; encerradas recentes depois (para o doador ver o resultado)
      list.sort((a, b) => Number(b.acceptingDonations) - Number(a.acceptingDonations));
      const animalId = ctx.req?.query?.animalId ? String(ctx.req.query.animalId) : null;
      res.status(200).json({ campaigns: animalId ? list.filter((c) => c.animal?.id === animalId) : list });
      return true;
    }

    const cover = path.match(/^\/api\/campaigns\/([^/]+)\/(cover|animal-photo)$/);
    if (cover && method === 'GET') {
      let mime = '';
      let data: Buffer | null = null;
      if (cover[2] === 'cover') {
        const rows: any[] = await db.$queryRawUnsafe(`SELECT mime, data FROM campaign_covers WHERE "campaignId" = $1`, cover[1]);
        if (rows?.[0]) {
          mime = rows[0].mime;
          data = Buffer.from(rows[0].data);
        }
      } else {
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT a.image FROM campaigns c JOIN animals a ON a.id = c."animalId" WHERE c.id = $1 AND c.status <> 'DRAFT'`,
          cover[1],
        );
        const m = String(rows?.[0]?.image || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
        if (m) {
          mime = m[1];
          data = Buffer.from(m[2], 'base64');
        }
      }
      if (!data) {
        res.status(404).json({ error: 'Sem imagem' });
        return true;
      }
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.status(200).end(data);
      return true;
    }

    const pub = path.match(/^\/api\/campaigns\/([^/]+)$/);
    if (pub && method === 'GET') {
      const r = await loadCampaign(db, pub[1]);
      if (!r || r.status === 'DRAFT') throw new HttpError(404, 'Campanha não encontrada');
      const c = formatCampaign(r);
      const updates: any[] = await db.$queryRawUnsafe(
        `SELECT id, text, "createdAt" FROM campaign_updates WHERE "campaignId" = $1 ORDER BY "createdAt" DESC LIMIT 30`,
        r.id,
      );
      let donors: any[] = [];
      if (r.showDonors) {
        const d: any[] = await db.$queryRawUnsafe(
          `SELECT "donorName", "isAnonymous", amount, "createdAt" FROM donations
            WHERE "campaignId" = $1 AND status = 'APPROVED' ORDER BY "createdAt" DESC LIMIT 30`,
          r.id,
        );
        donors = d.map((x) => ({
          name: donorDisplayName(x.donorName, !!x.isAnonymous),
          // valor só de quem não é anônimo
          amount: x.isAnonymous ? null : money(x.amount),
          at: x.createdAt,
        }));
      }
      res.status(200).json({ campaign: { ...c, updates, donors } });
      return true;
    }

    // ---------------- admin (o guarda de /api/admin/ já exigiu login de administrador)
    if (!path.startsWith('/api/admin/campaigns')) return false;
    let userId: string | null = null;
    try {
      userId = ctx.authUser().userId;
    } catch {
      userId = null;
    }

    if (path === '/api/admin/campaigns' && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(`${BASE_SELECT} ORDER BY c."createdAt" DESC LIMIT 200`);
      res.status(200).json({ campaigns: rows.map((r) => formatCampaign(r, { admin: true })) });
      return true;
    }
    if (path === '/api/admin/campaigns' && method === 'POST') {
      const id = await saveCampaign(db, null, body || {}, userId);
      if (body?.publish) await publish(db, id);
      res.status(201).json({ message: 'Campanha criada', campaign: formatCampaign(await loadCampaign(db, id), { admin: true }) });
      return true;
    }

    const m = path.match(/^\/api\/admin\/campaigns\/([^/]+)(?:\/([a-z-]+))?(?:\/([^/]+))?$/);
    if (!m) return false;
    const current = await loadCampaign(db, m[1]);
    if (!current) throw new HttpError(404, 'Campanha não encontrada');
    const action = m[2] || '';

    if (!action && method === 'GET') {
      const donations: any[] = await db.$queryRawUnsafe(
        `SELECT id, "donorName", "donorEmail", "isAnonymous", amount, method::text AS method, status::text AS status, "createdAt"
           FROM donations WHERE "campaignId" = $1 ORDER BY "createdAt" DESC LIMIT 500`,
        current.id,
      );
      const updates: any[] = await db.$queryRawUnsafe(
        `SELECT id, text, "createdAt" FROM campaign_updates WHERE "campaignId" = $1 ORDER BY "createdAt" DESC`,
        current.id,
      );
      res.status(200).json({
        campaign: formatCampaign(current, { admin: true }),
        donations: donations.map((d) => ({ ...d, amount: money(d.amount) })),
        updates,
      });
      return true;
    }
    if (!action && method === 'PUT') {
      await saveCampaign(db, current, body || {}, userId);
      res.status(200).json({ message: 'Campanha atualizada', campaign: formatCampaign(await loadCampaign(db, current.id), { admin: true }) });
      return true;
    }
    if (!action && method === 'DELETE') {
      const paid: any[] = await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM donations WHERE "campaignId" = $1 AND status = 'APPROVED'`,
        current.id,
      );
      if ((paid?.[0]?.n || 0) > 0) {
        throw new HttpError(409, 'Esta campanha já recebeu doações. Encerre em vez de apagar (o histórico fica para a transparência).', 'HAS_DONATIONS');
      }
      await db.$executeRawUnsafe(`DELETE FROM campaigns WHERE id = $1`, current.id);
      res.status(200).json({ message: 'Campanha apagada' });
      return true;
    }
    if (action === 'publish' && method === 'POST') {
      if (current.status === 'ACTIVE') throw new HttpError(400, 'A campanha já está no ar');
      await publish(db, current.id);
      res.status(200).json({ message: 'Campanha publicada', campaign: formatCampaign(await loadCampaign(db, current.id), { admin: true }) });
      return true;
    }
    if (action === 'close' && method === 'POST') {
      await db.$executeRawUnsafe(
        `UPDATE campaigns SET status = 'ENDED', "closedAt" = NOW(), "closedReason" = 'MANUAL', "updatedAt" = NOW() WHERE id = $1`,
        current.id,
      );
      res.status(200).json({ message: 'Campanha encerrada', campaign: formatCampaign(await loadCampaign(db, current.id), { admin: true }) });
      return true;
    }
    if (action === 'reopen' && method === 'POST') {
      const endsAt = dateOrNull(body?.endsAt);
      if (current.endsAt && new Date(current.endsAt).getTime() < Date.now() && !endsAt) {
        throw new HttpError(400, 'O prazo já passou: informe um novo prazo para reabrir');
      }
      await db.$executeRawUnsafe(
        `UPDATE campaigns SET status = 'ACTIVE', "closedAt" = NULL, "closedReason" = NULL,
                "endsAt" = COALESCE($2, "endsAt"), "updatedAt" = NOW() WHERE id = $1`,
        current.id,
        endsAt ?? null,
      );
      res.status(200).json({ message: 'Campanha reaberta', campaign: formatCampaign(await loadCampaign(db, current.id), { admin: true }) });
      return true;
    }
    if (action === 'cover' && (method === 'PUT' || method === 'POST')) {
      const { mime, data } = decodeCover(body?.imageBase64);
      await db.$executeRawUnsafe(
        `INSERT INTO campaign_covers ("campaignId", mime, data, "updatedAt") VALUES ($1, $2, $3, NOW())
         ON CONFLICT ("campaignId") DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, "updatedAt" = NOW()`,
        current.id,
        mime,
        data,
      );
      await db.$executeRawUnsafe(`UPDATE campaigns SET "hasCover" = true, "updatedAt" = NOW() WHERE id = $1`, current.id);
      res.status(200).json({ message: 'Capa atualizada', campaign: formatCampaign(await loadCampaign(db, current.id), { admin: true }) });
      return true;
    }
    if (action === 'cover' && method === 'DELETE') {
      await db.$executeRawUnsafe(`DELETE FROM campaign_covers WHERE "campaignId" = $1`, current.id);
      await db.$executeRawUnsafe(`UPDATE campaigns SET "hasCover" = false, "updatedAt" = NOW() WHERE id = $1`, current.id);
      res.status(200).json({ message: 'Capa removida', campaign: formatCampaign(await loadCampaign(db, current.id), { admin: true }) });
      return true;
    }
    if (action === 'updates' && !m[3] && method === 'POST') {
      const t = text(body?.text, UPDATE_MAX, 'o texto da atualização', true);
      const id = crypto.randomUUID();
      await db.$executeRawUnsafe(
        `INSERT INTO campaign_updates (id, "campaignId", text, "createdById") VALUES ($1, $2, $3, $4)`,
        id,
        current.id,
        t,
        userId,
      );
      await db.$executeRawUnsafe(`UPDATE campaigns SET "updatedAt" = NOW() WHERE id = $1`, current.id);
      res.status(201).json({ message: 'Atualização publicada', update: { id, text: t } });
      return true;
    }
    if (action === 'updates' && m[3] && method === 'DELETE') {
      await db.$executeRawUnsafe(`DELETE FROM campaign_updates WHERE id = $1 AND "campaignId" = $2`, m[3], current.id);
      res.status(200).json({ message: 'Atualização apagada' });
      return true;
    }
    return false;
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : e?.status || 500;
    if (status >= 500) console.error('❌ Vaquinhas:', e);
    res.status(status).json({ error: status >= 500 ? 'Erro interno nas campanhas' : e.message, code: e?.code });
    return true;
  }
}

async function publish(db: any, id: string) {
  const rows: any[] = await db.$queryRawUnsafe(`SELECT "endsAt" FROM campaigns WHERE id = $1`, id);
  if (rows?.[0]?.endsAt && new Date(rows[0].endsAt).getTime() < Date.now()) {
    throw new HttpError(400, 'O prazo já passou: ajuste antes de publicar');
  }
  await db.$executeRawUnsafe(
    `UPDATE campaigns SET status = 'ACTIVE', "publishedAt" = COALESCE("publishedAt", NOW()), "closedAt" = NULL,
            "closedReason" = NULL, "updatedAt" = NOW() WHERE id = $1`,
    id,
  );
}

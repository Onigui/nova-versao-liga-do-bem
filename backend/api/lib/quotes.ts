/**
 * Orçamento em tempo real.
 *
 * 1. O membro (ou o veterinário, no atendimento) monta uma LISTA: itens do catálogo padrão ou
 *    texto livre, com quantidade. Opcional: pet (espécie/peso), receita (foto), prazo.
 * 2. Na hora: preço de TABELA dos parceiros (vitrine pública) para os itens do catálogo.
 * 3. Os parceiros das categorias da lista recebem o pedido e mandam uma PROPOSTA às cegas:
 *    cada um vê só o pedido (sem nome do tutor) e a própria proposta, NUNCA a dos outros.
 *    Proposta enviada não pode ser alterada (só retirada), para ninguém "cobrir" o outro.
 * 4. O membro compara: melhor loja (lista inteira num lugar só) e item a item (mais barato
 *    de cada item). Reserva numa loja → código que o caixa confere; o preço vale até a validade.
 */
import crypto from 'crypto';
import { sendFcmToTokens } from './push';
import { ensureCatalogSchema, itemLabel, CATALOG_CATEGORIES } from './catalog';
import { isMembershipCurrentlyActive } from './membershipBilling';
import { ensurePetHealthSchema } from './petHealth';
import { markSchemaApplied, schemaApplied, schemaFingerprint } from './schemaOnce';

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

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

const CAT_IDS = CATALOG_CATEGORIES.map((c) => c.id) as string[];
export const QUOTE_DEADLINES = [2, 24, 48];
const MAX_ITEMS = 25;
const MAX_OPEN_PER_USER = 5;
const RESPONSE_VALID_HOURS = [24, 48, 72];
const PHOTO_MAX = 800 * 1024;

let ensuredAt = 0;
export async function ensureQuoteSchema(db: any) {
  await ensureCatalogSchema(db);
  if (Date.now() - ensuredAt < 6 * 60 * 60 * 1000) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS quote_requests (
       id TEXT PRIMARY KEY,
       "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       "petId" TEXT,
       "createdByPartnerId" TEXT,
       "createdByUserId" TEXT,
       species TEXT,
       "petWeight" DOUBLE PRECISION,
       district TEXT,
       city TEXT,
       notes TEXT,
       "hasPrescription" BOOLEAN NOT NULL DEFAULT false,
       status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CANCELLED','CLOSED')),
       "expiresAt" TIMESTAMP(3) NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS quote_requests_user_idx ON quote_requests("userId", "createdAt")`,
    `CREATE TABLE IF NOT EXISTS quote_request_items (
       id TEXT PRIMARY KEY,
       "requestId" TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
       "itemId" TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
       label TEXT NOT NULL,
       category TEXT NOT NULL,
       quantity INTEGER NOT NULL DEFAULT 1,
       note TEXT,
       position INTEGER NOT NULL DEFAULT 0
     )`,
    `CREATE INDEX IF NOT EXISTS quote_request_items_req_idx ON quote_request_items("requestId")`,
    `CREATE TABLE IF NOT EXISTS quote_prescriptions (
       "requestId" TEXT PRIMARY KEY REFERENCES quote_requests(id) ON DELETE CASCADE,
       mime TEXT NOT NULL,
       data BYTEA NOT NULL
     )`,
    `CREATE TABLE IF NOT EXISTS quote_targets (
       "requestId" TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
       "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
       "seenAt" TIMESTAMP(3),
       PRIMARY KEY ("requestId", "partnerId")
     )`,
    `CREATE INDEX IF NOT EXISTS quote_targets_partner_idx ON quote_targets("partnerId")`,
    `CREATE TABLE IF NOT EXISTS quote_responses (
       id TEXT PRIMARY KEY,
       "requestId" TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
       "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
       "accountId" TEXT,
       note TEXT,
       "validUntil" TIMESTAMP(3) NOT NULL,
       status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','WITHDRAWN')),
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       UNIQUE ("requestId", "partnerId")
     )`,
    `CREATE TABLE IF NOT EXISTS quote_response_lines (
       "responseId" TEXT NOT NULL REFERENCES quote_responses(id) ON DELETE CASCADE,
       "requestItemId" TEXT NOT NULL REFERENCES quote_request_items(id) ON DELETE CASCADE,
       "unitPrice" DECIMAL(10,2),
       available BOOLEAN NOT NULL DEFAULT true,
       note TEXT,
       PRIMARY KEY ("responseId", "requestItemId")
     )`,
    `CREATE TABLE IF NOT EXISTS quote_reservations (
       id TEXT PRIMARY KEY,
       "requestId" TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
       "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
       "userId" TEXT NOT NULL,
       code TEXT NOT NULL,
       lines JSONB NOT NULL,
       total DECIMAL(10,2) NOT NULL,
       "validUntil" TIMESTAMP(3),
       status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','DONE','CANCELLED')),
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       "doneAt" TIMESTAMP(3),
       UNIQUE ("requestId", "partnerId")
     )`,
    `CREATE INDEX IF NOT EXISTS quote_reservations_partner_idx ON quote_reservations("partnerId", "createdAt")`,
  ];
  const fp = schemaFingerprint(statements);
  if (!(await schemaApplied(db, 'quotes', fp))) {
    for (const sql of statements) await db.$executeRawUnsafe(sql);
    await markSchemaApplied(db, 'quotes', fp);
  }
  ensuredAt = Date.now();
}

// ---------------------------------------------------------------- helpers

const money = (v: any) => (v == null ? null : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

function decodePhoto(input: any) {
  if (!input) return null;
  const raw = String(input);
  const m = raw.match(/^data:([^;]+);base64,(.*)$/);
  const data = Buffer.from((m ? m[2] : raw).replace(/\s/g, ''), 'base64');
  if (!data.length || data.length > PHOTO_MAX) throw new HttpError(400, 'Foto da receita inválida ou muito grande (máx. 800 KB)');
  const hex = data.subarray(0, 4).toString('hex');
  const mime = hex.startsWith('ffd8ff') ? 'image/jpeg' : hex.startsWith('89504e47') ? 'image/png' : null;
  if (!mime) throw new HttpError(400, 'Envie a receita como foto (JPG ou PNG)');
  return { mime, data };
}

async function notifyTokens(db: any, sql: string, params: any[], payload: { title: string; body: string; data: Record<string, string> }) {
  try {
    const rows: any[] = await db.$queryRawUnsafe(sql, ...params);
    if (rows.length) await sendFcmToTokens(rows.map((r) => r.token), payload);
  } catch (e: any) {
    console.warn('⚠️ Aviso de orçamento falhou:', e?.message);
  }
}

async function notifyMember(db: any, userId: string, title: string, message: string, data: Record<string, string>) {
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO notifications (id, "userId", title, message, type, data, "isRead", "sentAt")
       VALUES ($1, $2, $3, $4, 'GENERAL'::"NotificationType", $5::jsonb, false, NOW())`,
      crypto.randomUUID(), userId, title, message, JSON.stringify(data),
    );
  } catch (e: any) {
    console.warn('⚠️ Caixa de notificações:', e?.message);
  }
  await notifyTokens(
    db,
    `SELECT token FROM device_tokens WHERE "userId" = $1 AND "isActive" = true AND platform <> 'android-partner'`,
    [userId],
    { title, body: message, data },
  );
}

async function notifyPartners(db: any, partnerIds: string[], title: string, body: string, data: Record<string, string>) {
  if (!partnerIds.length) return;
  await notifyTokens(
    db,
    `SELECT t.token FROM device_tokens t JOIN partner_accounts a ON a."userId" = t."userId"
      WHERE a."partnerId" = ANY($1::text[]) AND t."isActive" = true AND t.platform = 'android-partner'`,
    [partnerIds],
    { title, body, data },
  );
}

async function partnerAccount(db: any, userId: string) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT a.id, a.role, a."partnerId", p.name AS "partnerName", p."isActive" AS "partnerActive"
       FROM partner_accounts a JOIN partners p ON p.id = a."partnerId" WHERE a."userId" = $1 LIMIT 1`,
    userId,
  );
  const acc = rows[0];
  if (!acc) throw new HttpError(403, 'Este usuário não tem acesso de parceiro.', 'NOT_PARTNER');
  if (!acc.partnerActive) throw new HttpError(403, 'Esta empresa está desativada na Liga do Bem.', 'PARTNER_INACTIVE');
  return acc;
}

/** Lê e valida os itens da lista. Itens do catálogo usam o nome padrão. */
async function readItems(db: any, raw: any) {
  if (!Array.isArray(raw) || !raw.length) throw new HttpError(400, 'Adicione pelo menos um item à lista');
  if (raw.length > MAX_ITEMS) throw new HttpError(400, `No máximo ${MAX_ITEMS} itens por orçamento`);
  const ids = raw.map((i: any) => i?.itemId).filter(Boolean).map(String);
  const cat: any[] = ids.length
    ? await db.$queryRawUnsafe(`SELECT * FROM catalog_items WHERE id = ANY($1::text[]) AND "isActive" = true AND "partnerId" IS NULL`, ids)
    : [];
  const byId = new Map(cat.map((c) => [c.id, c]));
  const out: any[] = [];
  const seen = new Set<string>();
  raw.forEach((i: any, idx: number) => {
    const quantity = Math.max(1, Math.min(99, parseInt(i?.quantity, 10) || 1));
    const note = String(i?.note || '').trim().slice(0, 120) || null;
    if (i?.itemId) {
      const c = byId.get(String(i.itemId));
      if (!c) throw new HttpError(400, 'Um dos itens não está mais no catálogo. Atualize a lista.');
      if (seen.has(c.id)) return;
      seen.add(c.id);
      out.push({ itemId: c.id, label: itemLabel(c), category: c.category, quantity, note, position: idx });
    } else {
      const label = String(i?.label || '').trim();
      const category = String(i?.category || '').toUpperCase();
      if (label.length < 3 || label.length > 80) throw new HttpError(400, 'Descreva cada item (3 a 80 letras)');
      if (!CAT_IDS.includes(category)) throw new HttpError(400, `Escolha a categoria de "${label}"`);
      out.push({ itemId: null, label, category, quantity, note, position: idx });
    }
  });
  return out;
}

/** Parceiros que recebem o pedido: os que atuam nas categorias da lista (têm preço nelas). */
async function pickTargets(db: any, categories: string[], extraPartnerId?: string | null) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT DISTINCT p.id FROM partners p
       JOIN partner_prices pp ON pp."partnerId" = p.id
       JOIN catalog_items i ON i.id = pp."itemId"
      WHERE p."isActive" = true AND i.category = ANY($1::text[])`,
    categories,
  );
  let ids = rows.map((r) => r.id);
  // Ninguém cadastrou preço nessas categorias ainda → manda para todos os parceiros ativos
  if (!ids.length) {
    const all: any[] = await db.$queryRawUnsafe(`SELECT id FROM partners WHERE "isActive" = true`);
    ids = all.map((r) => r.id);
  }
  if (extraPartnerId && !ids.includes(extraPartnerId)) ids.push(extraPartnerId);
  return ids;
}

async function createRequest(
  db: any,
  opts: { userId: string; petId?: string | null; createdByPartnerId?: string | null; createdByUserId?: string | null; body: any },
) {
  const { body } = opts;
  const items = await readItems(db, body.items);
  const hours = QUOTE_DEADLINES.includes(Number(body.expiresInHours)) ? Number(body.expiresInHours) : 24;
  let species: string | null = null;
  let weight: number | null = null;
  if (opts.petId) {
    const pets: any[] = await db.$queryRawUnsafe(`SELECT species, weight FROM pets WHERE id = $1 AND "userId" = $2`, opts.petId, opts.userId);
    if (!pets[0]) throw new HttpError(404, 'Pet não encontrado');
    species = pets[0].species;
    weight = pets[0].weight ?? null;
  }
  const notes = String(body.notes || '').trim().slice(0, 500) || null;
  const district = String(body.district || '').trim().slice(0, 80) || null;
  const city = String(body.city || '').trim().slice(0, 80) || null;
  const photo = decodePhoto(body.prescription);
  const id = crypto.randomUUID();
  await db.$executeRawUnsafe(
    `INSERT INTO quote_requests (id, "userId", "petId", "createdByPartnerId", "createdByUserId", species, "petWeight", district, city, notes, "hasPrescription", "expiresAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW() + ($12 || ' hours')::interval)`,
    id, opts.userId, opts.petId || null, opts.createdByPartnerId || null, opts.createdByUserId || null,
    species, weight, district, city, notes, !!photo, String(hours),
  );
  for (const it of items) {
    await db.$executeRawUnsafe(
      `INSERT INTO quote_request_items (id, "requestId", "itemId", label, category, quantity, note, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      crypto.randomUUID(), id, it.itemId, it.label, it.category, it.quantity, it.note, it.position,
    );
  }
  if (photo) {
    await db.$executeRawUnsafe(`INSERT INTO quote_prescriptions ("requestId", mime, data) VALUES ($1, $2, $3)`, id, photo.mime, photo.data);
  }
  const targets = await pickTargets(db, Array.from(new Set(items.map((i) => i.category))), opts.createdByPartnerId);
  for (const pid of targets) {
    await db.$executeRawUnsafe(`INSERT INTO quote_targets ("requestId", "partnerId") VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, pid);
  }
  await notifyPartners(
    db,
    targets,
    '🧾 Novo pedido de orçamento',
    `${items.length} item(ns)${species ? ` · ${species}` : ''}${district ? ` · ${district}` : ''}. Responda em até ${hours} h.`,
    { screen: 'QuoteRespond', requestId: id },
  );
  return { id, targets: targets.length };
}

/** Pedido + comparação (preço de tabela e propostas) — visão do MEMBRO. */
export async function loadComparison(db: any, requestId: string, userId: string) {
  const reqs: any[] = await db.$queryRawUnsafe(`SELECT * FROM quote_requests WHERE id = $1 AND "userId" = $2`, requestId, userId);
  const r = reqs[0];
  if (!r) throw new HttpError(404, 'Orçamento não encontrado');
  const items: any[] = await db.$queryRawUnsafe(
    `SELECT * FROM quote_request_items WHERE "requestId" = $1 ORDER BY position`,
    requestId,
  );
  const partners: any[] = await db.$queryRawUnsafe(
    `SELECT DISTINCT p.id, p.name, p.logo, p.address, p.city, p.latitude, p.longitude, p.hours, p.phone, p.category
       FROM partners p
      WHERE p."isActive" = true AND (
        p.id IN (SELECT "partnerId" FROM quote_responses WHERE "requestId" = $1 AND status = 'SUBMITTED')
        OR p.id IN (SELECT pp."partnerId" FROM partner_prices pp JOIN quote_request_items qi ON qi."itemId" = pp."itemId"
                     WHERE qi."requestId" = $1 AND pp.available = true))`,
    requestId,
  );
  const table: any[] = await db.$queryRawUnsafe(
    `SELECT pp."partnerId", qi.id AS "requestItemId", pp."memberPrice", pp.note
       FROM quote_request_items qi JOIN partner_prices pp ON pp."itemId" = qi."itemId"
      WHERE qi."requestId" = $1 AND pp.available = true`,
    requestId,
  );
  const responses: any[] = await db.$queryRawUnsafe(
    `SELECT r.*, l."requestItemId", l."unitPrice", l.available AS "lineAvailable", l.note AS "lineNote"
       FROM quote_responses r LEFT JOIN quote_response_lines l ON l."responseId" = r.id
      WHERE r."requestId" = $1 AND r.status = 'SUBMITTED'`,
    requestId,
  );
  const reservations: any[] = await db.$queryRawUnsafe(`SELECT * FROM quote_reservations WHERE "requestId" = $1`, requestId);
  const now = Date.now();

  const stores = partners.map((p) => {
    const resp = responses.filter((x) => x.partnerId === p.id);
    const quote = resp[0] && new Date(resp[0].validUntil).getTime() > now ? resp[0] : null;
    const lines = items.map((it) => {
      const q = quote ? resp.find((x) => x.requestItemId === it.id) : null;
      if (q && q.lineAvailable && q.unitPrice != null) {
        return { requestItemId: it.id, unitPrice: Number(q.unitPrice), total: round2(Number(q.unitPrice) * it.quantity), source: 'QUOTE', note: q.lineNote || null };
      }
      if (q && !q.lineAvailable) return { requestItemId: it.id, unitPrice: null, total: null, source: 'QUOTE', unavailable: true, note: q.lineNote || null };
      const t = table.find((x) => x.partnerId === p.id && x.requestItemId === it.id);
      if (t) return { requestItemId: it.id, unitPrice: Number(t.memberPrice), total: round2(Number(t.memberPrice) * it.quantity), source: 'TABLE', note: t.note || null };
      return { requestItemId: it.id, unitPrice: null, total: null, source: null };
    });
    const priced = lines.filter((l) => l.total != null);
    const rsv = reservations.find((x) => x.partnerId === p.id);
    return {
      partner: {
        id: p.id, name: p.name, logo: p.logo || null, address: p.address, city: p.city, category: p.category,
        latitude: p.latitude != null ? Number(p.latitude) : null, longitude: p.longitude != null ? Number(p.longitude) : null,
        hours: p.hours || null, phone: p.phone || null,
      },
      hasQuote: !!quote,
      quoteNote: quote?.note || null,
      validUntil: quote?.validUntil || null,
      lines,
      covered: priced.length,
      complete: priced.length === items.length,
      total: round2(priced.reduce((s, l) => s + (l.total || 0), 0)),
      reservation: rsv ? { id: rsv.id, code: rsv.code, status: rsv.status, total: Number(rsv.total) } : null,
    };
  }).filter((s) => s.covered > 0);

  stores.sort((a, b) => Number(b.complete) - Number(a.complete) || b.covered - a.covered || a.total - b.total);
  const bestStore = stores.find((s) => s.complete) || null;

  // Item a item: o menor preço de cada item entre todas as lojas
  const perItem = items.map((it) => {
    let best: any = null;
    for (const s of stores) {
      const l = s.lines.find((x) => x.requestItemId === it.id);
      if (l?.total != null && (!best || l.unitPrice < best.unitPrice)) best = { ...l, partnerId: s.partner.id, partnerName: s.partner.name };
    }
    return { requestItemId: it.id, best };
  });
  const perItemTotal = round2(perItem.reduce((s, x) => s + (x.best?.total || 0), 0));
  const perItemStores = new Set(perItem.filter((x) => x.best).map((x) => x.best.partnerId)).size;

  const status = r.status === 'OPEN' && new Date(r.expiresAt).getTime() < now ? 'EXPIRED' : r.status;
  const targets: any[] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM quote_targets WHERE "requestId" = $1`, requestId);
  return {
    request: {
      id: r.id, status, expiresAt: r.expiresAt, createdAt: r.createdAt, notes: r.notes, species: r.species, petWeight: r.petWeight,
      petId: r.petId, hasPrescription: r.hasPrescription, createdByPartnerId: r.createdByPartnerId,
      targets: targets[0]?.n || 0,
      quotes: responses.reduce((set, x) => set.add(x.partnerId), new Set()).size,
    },
    items: items.map((it) => ({ id: it.id, itemId: it.itemId, label: it.label, category: it.category, quantity: it.quantity, note: it.note })),
    stores,
    bestStore: bestStore ? { partnerId: bestStore.partner.id, total: bestStore.total } : null,
    perItem: { lines: perItem, total: perItemTotal, stores: perItemStores, covered: perItem.filter((x) => x.best).length },
  };
}

function genCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

// ---------------------------------------------------------------- roteador

export function isQuotePath(path: string) {
  return (
    path === '/api/quotes' ||
    path.startsWith('/api/quotes/') ||
    path === '/api/partner/quotes' ||
    path.startsWith('/api/partner/quotes/') ||
    path === '/api/partner/reservations' ||
    path.startsWith('/api/partner/reservations/') ||
    /^\/api\/partner\/pets\/visits\/[^/]+\/quote$/.test(path)
  );
}

export async function handleQuotes(ctx: Ctx): Promise<boolean> {
  const { path, method, res, db } = ctx;
  if (!isQuotePath(path)) return false;
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return true;
  }
  try {
    await ensureQuoteSchema(db);
    const { userId } = ctx.authUser();

    // ---------- membro
    if (path === '/api/quotes' && method === 'POST') {
      const open: any[] = await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM quote_requests WHERE "userId" = $1 AND status = 'OPEN' AND "expiresAt" > NOW()`,
        userId,
      );
      if ((open[0]?.n || 0) >= MAX_OPEN_PER_USER) {
        throw new HttpError(429, `Você já tem ${MAX_OPEN_PER_USER} orçamentos abertos. Encerre um antes de pedir outro.`, 'TOO_MANY');
      }
      const r = await createRequest(db, { userId, petId: body.petId ? String(body.petId) : null, body });
      res.status(201).json({ ...(await loadComparison(db, r.id, userId)) });
      return true;
    }
    if (path === '/api/quotes' && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT q.*, (SELECT COUNT(*)::int FROM quote_request_items i WHERE i."requestId" = q.id) AS items,
                (SELECT COUNT(*)::int FROM quote_responses r WHERE r."requestId" = q.id AND r.status = 'SUBMITTED') AS quotes,
                (SELECT string_agg(label, ', ' ORDER BY position) FROM (SELECT label, position FROM quote_request_items i WHERE i."requestId" = q.id ORDER BY position LIMIT 3) s) AS preview
           FROM quote_requests q WHERE q."userId" = $1 ORDER BY q."createdAt" DESC LIMIT 50`,
        userId,
      );
      const now = Date.now();
      res.status(200).json({
        quotes: rows.map((q) => ({
          id: q.id, createdAt: q.createdAt, expiresAt: q.expiresAt, items: q.items, quotes: q.quotes, preview: q.preview,
          fromVet: !!q.createdByPartnerId,
          status: q.status === 'OPEN' && new Date(q.expiresAt).getTime() < now ? 'EXPIRED' : q.status,
        })),
      });
      return true;
    }
    const mq = path.match(/^\/api\/quotes\/([^/]+)(\/cancel|\/reserve|\/prescription)?$/);
    if (mq) {
      if (!mq[2] && method === 'GET') {
        res.status(200).json(await loadComparison(db, mq[1], userId));
        return true;
      }
      const own: any[] = await db.$queryRawUnsafe(`SELECT * FROM quote_requests WHERE id = $1 AND "userId" = $2`, mq[1], userId);
      if (!own[0]) throw new HttpError(404, 'Orçamento não encontrado');
      if (mq[2] === '/prescription' && method === 'GET') {
        const ph: any[] = await db.$queryRawUnsafe(`SELECT mime, data FROM quote_prescriptions WHERE "requestId" = $1`, mq[1]);
        if (!ph[0]) throw new HttpError(404, 'Sem receita');
        res.setHeader('Content-Type', ph[0].mime);
        res.status(200).end(Buffer.from(ph[0].data));
        return true;
      }
      if (mq[2] === '/cancel' && method === 'POST') {
        await db.$executeRawUnsafe(`UPDATE quote_requests SET status = 'CANCELLED' WHERE id = $1 AND status = 'OPEN'`, mq[1]);
        res.status(200).json({ message: 'Pedido encerrado. Os parceiros não recebem mais.' });
        return true;
      }
      if (mq[2] === '/reserve' && method === 'POST') {
        const partnerId = String(body.partnerId || '');
        const cmp = await loadComparison(db, mq[1], userId);
        const store = cmp.stores.find((s) => s.partner.id === partnerId);
        if (!store) throw new HttpError(404, 'Esta loja não tem preço para a sua lista');
        if (store.reservation && store.reservation.status !== 'CANCELLED') {
          res.status(200).json({ reservation: store.reservation, already: true });
          return true;
        }
        const only: string[] | null = Array.isArray(body.requestItemIds) && body.requestItemIds.length ? body.requestItemIds.map(String) : null;
        const lines = store.lines
          .filter((l) => l.total != null && (!only || only.includes(l.requestItemId)))
          .map((l) => {
            const it = cmp.items.find((i) => i.id === l.requestItemId)!;
            return { requestItemId: l.requestItemId, label: it.label, quantity: it.quantity, unitPrice: l.unitPrice, total: l.total, source: l.source };
          });
        if (!lines.length) throw new HttpError(400, 'Escolha pelo menos um item com preço nesta loja');
        const total = round2(lines.reduce((s, l) => s + (l.total || 0), 0));
        const validUntil = store.validUntil || new Date(Date.now() + 48 * 3600e3);
        const id = crypto.randomUUID();
        const code = genCode();
        await db.$executeRawUnsafe(
          `INSERT INTO quote_reservations (id, "requestId", "partnerId", "userId", code, lines, total, "validUntil")
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
           ON CONFLICT ("requestId", "partnerId") DO UPDATE SET code = EXCLUDED.code, lines = EXCLUDED.lines, total = EXCLUDED.total,
             "validUntil" = EXCLUDED."validUntil", status = 'RESERVED', "createdAt" = NOW()`,
          id, mq[1], partnerId, userId, code, JSON.stringify(lines), total, validUntil,
        );
        const users: any[] = await db.$queryRawUnsafe(`SELECT name FROM users WHERE id = $1`, userId);
        await notifyPartners(
          db,
          [partnerId],
          '🛒 Reserva de orçamento',
          `${String(users[0]?.name || 'Um membro').split(' ')[0]} reservou ${lines.length} item(ns) · total ${total.toFixed(2).replace('.', ',')}. Código ${code}.`,
          { screen: 'Reservations' },
        );
        const saved: any[] = await db.$queryRawUnsafe(`SELECT * FROM quote_reservations WHERE "requestId" = $1 AND "partnerId" = $2`, mq[1], partnerId);
        res.status(201).json({ reservation: { id: saved[0].id, code: saved[0].code, status: saved[0].status, total: Number(saved[0].total), validUntil: saved[0].validUntil, lines } });
        return true;
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    // ---------- App Parceiros
    const acc = await partnerAccount(db, userId);

    // Veterinário monta a lista no atendimento (pet lido pelo QR)
    const visitM = path.match(/^\/api\/partner\/pets\/visits\/([^/]+)\/quote$/);
    if (visitM && method === 'POST') {
      await ensurePetHealthSchema(db);
      const vets: any[] = await db.$queryRawUnsafe(`SELECT * FROM partner_vets WHERE "accountId" = $1 AND status = 'APPROVED'`, acc.id);
      if (!vets[0]) throw new HttpError(403, 'Só veterinário com CRMV aprovado monta a lista.', 'VET_REQUIRED');
      const visits: any[] = await db.$queryRawUnsafe(
        `SELECT v.*, p."userId", p.name AS "petName" FROM pet_visits v JOIN pets p ON p.id = v."petId" WHERE v.id = $1 AND v."partnerId" = $2`,
        visitM[1],
        acc.partnerId,
      );
      const v = visits[0];
      if (!v) throw new HttpError(404, 'Atendimento não encontrado');
      if (new Date(v.expiresAt).getTime() < Date.now()) throw new HttpError(410, 'Atendimento expirado. Leia o QR do pet de novo.', 'VISIT_EXPIRED');
      const r = await createRequest(db, { userId: v.userId, petId: v.petId, createdByPartnerId: acc.partnerId, createdByUserId: userId, body });
      await notifyMember(
        db,
        v.userId,
        `📋 ${vets[0].fullName} montou a lista de ${v.petName}`,
        'Os parceiros já estão mandando orçamentos. Compare e escolha onde comprar.',
        { screen: 'QuoteDetail', id: r.id },
      );
      res.status(201).json({ id: r.id, targets: r.targets });
      return true;
    }

    if (path === '/api/partner/quotes' && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT q.id, q.species, q."petWeight", q.district, q.city, q."expiresAt", q."createdAt", q.status, q."hasPrescription",
                (q."createdByPartnerId" = $1) AS "fromUs",
                (SELECT COUNT(*)::int FROM quote_request_items i WHERE i."requestId" = q.id) AS items,
                (SELECT string_agg(label, ', ' ORDER BY position) FROM (SELECT label, position FROM quote_request_items i WHERE i."requestId" = q.id ORDER BY position LIMIT 3) s) AS preview,
                r.status AS "myStatus", rv.status AS "reservationStatus"
           FROM quote_targets t JOIN quote_requests q ON q.id = t."requestId"
           LEFT JOIN quote_responses r ON r."requestId" = q.id AND r."partnerId" = $1
           LEFT JOIN quote_reservations rv ON rv."requestId" = q.id AND rv."partnerId" = $1
          WHERE t."partnerId" = $1 AND q."createdAt" > NOW() - INTERVAL '30 days'
          ORDER BY (q.status = 'OPEN' AND q."expiresAt" > NOW() AND r.id IS NULL) DESC, q."createdAt" DESC LIMIT 100`,
        acc.partnerId,
      );
      const now = Date.now();
      res.status(200).json({
        quotes: rows.map((q) => ({
          ...q,
          open: q.status === 'OPEN' && new Date(q.expiresAt).getTime() > now,
          answered: q.myStatus === 'SUBMITTED',
        })),
        pending: rows.filter((q) => q.status === 'OPEN' && new Date(q.expiresAt).getTime() > now && !q.myStatus).length,
      });
      return true;
    }

    const pq = path.match(/^\/api\/partner\/quotes\/([^/]+)(\/response|\/prescription)?$/);
    if (pq) {
      const t: any[] = await db.$queryRawUnsafe(
        `SELECT q.* FROM quote_targets t JOIN quote_requests q ON q.id = t."requestId" WHERE t."requestId" = $1 AND t."partnerId" = $2`,
        pq[1],
        acc.partnerId,
      );
      const q = t[0];
      if (!q) throw new HttpError(404, 'Pedido não encontrado');
      const open = q.status === 'OPEN' && new Date(q.expiresAt).getTime() > Date.now();

      if (pq[2] === '/prescription' && method === 'GET') {
        const ph: any[] = await db.$queryRawUnsafe(`SELECT mime, data FROM quote_prescriptions WHERE "requestId" = $1`, q.id);
        if (!ph[0]) throw new HttpError(404, 'Sem receita');
        res.setHeader('Content-Type', ph[0].mime);
        res.status(200).end(Buffer.from(ph[0].data));
        return true;
      }

      if (!pq[2] && method === 'GET') {
        await db.$executeRawUnsafe(`UPDATE quote_targets SET "seenAt" = COALESCE("seenAt", NOW()) WHERE "requestId" = $1 AND "partnerId" = $2`, q.id, acc.partnerId);
        const items: any[] = await db.$queryRawUnsafe(
          `SELECT qi.*, pp."memberPrice" AS "myTablePrice", pp.available AS "myTableAvailable"
             FROM quote_request_items qi LEFT JOIN partner_prices pp ON pp."itemId" = qi."itemId" AND pp."partnerId" = $2
            WHERE qi."requestId" = $1 ORDER BY qi.position`,
          q.id,
          acc.partnerId,
        );
        const mine: any[] = await db.$queryRawUnsafe(
          `SELECT r.*, l."requestItemId", l."unitPrice", l.available AS "lineAvailable", l.note AS "lineNote"
             FROM quote_responses r LEFT JOIN quote_response_lines l ON l."responseId" = r.id
            WHERE r."requestId" = $1 AND r."partnerId" = $2`,
          q.id,
          acc.partnerId,
        );
        const rsv: any[] = await db.$queryRawUnsafe(`SELECT * FROM quote_reservations WHERE "requestId" = $1 AND "partnerId" = $2`, q.id, acc.partnerId);
        // Às cegas: nada sobre as propostas dos outros parceiros sai daqui
        res.status(200).json({
          request: {
            id: q.id, species: q.species, petWeight: q.petWeight, district: q.district, city: q.city, notes: q.notes,
            hasPrescription: q.hasPrescription, expiresAt: q.expiresAt, createdAt: q.createdAt, open,
            fromUs: q.createdByPartnerId === acc.partnerId,
          },
          items: items.map((i) => ({
            id: i.id, itemId: i.itemId, label: i.label, category: i.category, quantity: i.quantity, note: i.note,
            myTablePrice: i.myTablePrice != null && i.myTableAvailable !== false ? Number(i.myTablePrice) : null,
          })),
          myResponse: mine[0]
            ? {
                status: mine[0].status, note: mine[0].note, validUntil: mine[0].validUntil, createdAt: mine[0].createdAt,
                lines: mine.filter((m) => m.requestItemId).map((m) => ({ requestItemId: m.requestItemId, unitPrice: money(m.unitPrice), available: m.lineAvailable, note: m.lineNote })),
              }
            : null,
          reservation: rsv[0] ? { id: rsv[0].id, code: rsv[0].code, status: rsv[0].status, total: Number(rsv[0].total), lines: rsv[0].lines } : null,
        });
        return true;
      }

      if (pq[2] === '/response' && method === 'POST') {
        if (!open) throw new HttpError(410, 'Este pedido já encerrou.', 'CLOSED');
        const existing: any[] = await db.$queryRawUnsafe(`SELECT * FROM quote_responses WHERE "requestId" = $1 AND "partnerId" = $2`, q.id, acc.partnerId);
        if (existing[0]?.status === 'SUBMITTED') {
          throw new HttpError(409, 'Sua proposta já foi enviada e não pode ser alterada. Se precisar, retire e envie outra.', 'ALREADY_SENT');
        }
        const items: any[] = await db.$queryRawUnsafe(`SELECT id FROM quote_request_items WHERE "requestId" = $1`, q.id);
        const ids = new Set(items.map((i) => i.id));
        if (!Array.isArray(body.lines) || !body.lines.length) throw new HttpError(400, 'Informe o preço de pelo menos um item');
        const lines = body.lines
          .filter((l: any) => ids.has(String(l?.requestItemId)))
          .map((l: any) => {
            const available = l.available !== false;
            let unitPrice: number | null = null;
            if (available) {
              const raw = String(l.unitPrice ?? '').trim();
              const n = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
              if (!Number.isFinite(n) || n <= 0 || n > 100000) throw new HttpError(400, 'Preço inválido em um dos itens');
              unitPrice = round2(n);
            }
            return { requestItemId: String(l.requestItemId), unitPrice, available, note: String(l.note || '').trim().slice(0, 120) || null };
          });
        if (!lines.some((l: any) => l.available)) throw new HttpError(400, 'Marque pelo menos um item que você tem');
        const hours = RESPONSE_VALID_HOURS.includes(Number(body.validHours)) ? Number(body.validHours) : 48;
        const note = String(body.note || '').trim().slice(0, 300) || null;
        const rid = existing[0]?.id || crypto.randomUUID();
        if (existing[0]) {
          await db.$executeRawUnsafe(`DELETE FROM quote_response_lines WHERE "responseId" = $1`, rid);
          await db.$executeRawUnsafe(
            `UPDATE quote_responses SET status = 'SUBMITTED', note = $2, "validUntil" = NOW() + ($3 || ' hours')::interval, "accountId" = $4, "createdAt" = NOW() WHERE id = $1`,
            rid, note, String(hours), acc.id,
          );
        } else {
          await db.$executeRawUnsafe(
            `INSERT INTO quote_responses (id, "requestId", "partnerId", "accountId", note, "validUntil") VALUES ($1,$2,$3,$4,$5, NOW() + ($6 || ' hours')::interval)`,
            rid, q.id, acc.partnerId, acc.id, note, String(hours),
          );
        }
        for (const l of lines) {
          await db.$executeRawUnsafe(
            `INSERT INTO quote_response_lines ("responseId", "requestItemId", "unitPrice", available, note) VALUES ($1,$2,$3,$4,$5)`,
            rid, l.requestItemId, l.unitPrice, l.available, l.note,
          );
        }
        await notifyMember(
          db,
          q.userId,
          '💬 Nova proposta no seu orçamento',
          `${acc.partnerName} mandou uma proposta. Compare com as outras lojas.`,
          { screen: 'QuoteDetail', id: q.id },
        );
        res.status(201).json({ message: 'Proposta enviada', responseId: rid });
        return true;
      }
      if (pq[2] === '/response' && method === 'DELETE') {
        const rsv: any[] = await db.$queryRawUnsafe(
          `SELECT id FROM quote_reservations WHERE "requestId" = $1 AND "partnerId" = $2 AND status = 'RESERVED'`,
          q.id,
          acc.partnerId,
        );
        if (rsv.length) throw new HttpError(409, 'O membro já reservou com a sua proposta. Ela precisa ser honrada.', 'RESERVED');
        const n = await db.$executeRawUnsafe(
          `UPDATE quote_responses SET status = 'WITHDRAWN' WHERE "requestId" = $1 AND "partnerId" = $2 AND status = 'SUBMITTED'`,
          q.id,
          acc.partnerId,
        );
        if (!n) throw new HttpError(404, 'Nenhuma proposta para retirar');
        res.status(200).json({ message: 'Proposta retirada' });
        return true;
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    if (path === '/api/partner/reservations' && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT rv.*, u.name AS "memberName", m.status AS "mStatus", m."endDate" AS "mEndDate"
           FROM quote_reservations rv JOIN users u ON u.id = rv."userId" LEFT JOIN memberships m ON m."userId" = rv."userId"
          WHERE rv."partnerId" = $1 ORDER BY (rv.status = 'RESERVED') DESC, rv."createdAt" DESC LIMIT 100`,
        acc.partnerId,
      );
      res.status(200).json({
        reservations: rows.map((r) => ({
          id: r.id, code: r.code, status: r.status, total: Number(r.total), lines: r.lines, validUntil: r.validUntil, createdAt: r.createdAt,
          doneAt: r.doneAt, memberFirstName: String(r.memberName || '').split(' ')[0],
          memberActive: isMembershipCurrentlyActive({ status: r.mStatus, endDate: r.mEndDate }),
        })),
      });
      return true;
    }
    const rvM = path.match(/^\/api\/partner\/reservations\/([^/]+)\/(done|cancel)$/);
    if (rvM && method === 'POST') {
      const n = await db.$executeRawUnsafe(
        `UPDATE quote_reservations SET status = $3, "doneAt" = CASE WHEN $3 = 'DONE' THEN NOW() ELSE "doneAt" END
          WHERE id = $1 AND "partnerId" = $2 AND status = 'RESERVED'`,
        rvM[1],
        acc.partnerId,
        rvM[2] === 'done' ? 'DONE' : 'CANCELLED',
      );
      if (!n) throw new HttpError(404, 'Reserva não encontrada ou já encerrada');
      res.status(200).json({ message: rvM[2] === 'done' ? 'Reserva concluída' : 'Reserva cancelada' });
      return true;
    }

    throw new HttpError(404, 'Rota não encontrada');
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : e?.status || 500;
    if (status >= 500) console.error('❌ Orçamentos:', e);
    res.status(status).json({ error: status >= 500 ? 'Erro interno nos orçamentos' : e.message, code: e?.code });
    return true;
  }
}

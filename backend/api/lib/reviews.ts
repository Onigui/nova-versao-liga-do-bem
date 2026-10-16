/**
 * Avaliações dos parceiros, só de quem foi de verdade:
 *  - carteirinha validada na loja, reserva de orçamento concluída ou atendimento do pet (QR).
 * Uma avaliação por membro e empresa (pode editar). A empresa responde em público e pode
 * denunciar; quem decide esconder é a Liga (admin). A empresa nunca apaga nem edita nota.
 */
import crypto from 'crypto';
import { sendFcmToTokens } from './push';
import { markSchemaApplied, schemaApplied, schemaFingerprint } from './schemaOnce';
import { saveInbox } from './inbox';

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

export const REVIEW_TAGS = [
  { id: 'ATENDIMENTO', label: 'Bom atendimento' },
  { id: 'PRECO', label: 'Preço justo' },
  { id: 'CUIDADO', label: 'Cuidado com o pet' },
  { id: 'LIMPEZA', label: 'Lugar limpo' },
  { id: 'RAPIDEZ', label: 'Rapidez' },
  { id: 'DESCONTO', label: 'Respeitou o desconto' },
] as const;
const TAG_IDS = REVIEW_TAGS.map((t) => t.id) as string[];
const ELIGIBLE_DAYS = 180;
const PROMPT_MIN_HOURS = 2;
const PROMPT_MAX_DAYS = 7;
const MIN_TEXT_FOR_LOW = 10;

let ensuredAt = 0;
export async function ensureReviewSchema(db: any) {
  if (Date.now() - ensuredAt < 6 * 60 * 60 * 1000) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS partner_reviews (
       id TEXT PRIMARY KEY,
       "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
       "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
       comment TEXT,
       tags TEXT[] NOT NULL DEFAULT '{}',
       source TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'VISIBLE' CHECK (status IN ('VISIBLE','HIDDEN')),
       "hiddenReason" TEXT,
       reply TEXT,
       "replyAt" TIMESTAMP(3),
       "replyByAccountId" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       UNIQUE ("partnerId", "userId")
     )`,
    `CREATE INDEX IF NOT EXISTS partner_reviews_partner_idx ON partner_reviews("partnerId", status, "createdAt" DESC)`,
    `CREATE TABLE IF NOT EXISTS partner_review_reports (
       id TEXT PRIMARY KEY,
       "reviewId" TEXT NOT NULL REFERENCES partner_reviews(id) ON DELETE CASCADE,
       "accountId" TEXT,
       reason TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS partner_review_prompts (
       "userId" TEXT NOT NULL,
       "partnerId" TEXT NOT NULL,
       "promptedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       PRIMARY KEY ("userId", "partnerId")
     )`,
  ];
  const fp = schemaFingerprint(statements);
  if (!(await schemaApplied(db, 'reviews', fp))) {
    for (const sql of statements) await db.$executeRawUnsafe(sql);
    await markSchemaApplied(db, 'reviews', fp);
  }
  ensuredAt = Date.now();
}

// ---------------------------------------------------------------- helpers

async function tableExists(db: any, name: string) {
  const r: any[] = await db.$queryRawUnsafe(`SELECT to_regclass($1) IS NOT NULL AS ok`, `public.${name}`);
  return !!r[0]?.ok;
}

/**
 * Visitas comprovadas (membro × empresa) com a data mais recente.
 * Fonte: carteirinha validada, reserva concluída, atendimento do pet pelo QR.
 */
async function interactionsSql(db: any) {
  const parts = [`SELECT "userId", "partnerId", "validatedAt" AS at, 'VALIDATION' AS source FROM partner_validations`];
  if (await tableExists(db, 'quote_reservations')) {
    parts.push(`SELECT "userId", "partnerId", "doneAt" AS at, 'RESERVATION' AS source FROM quote_reservations WHERE status = 'DONE' AND "doneAt" IS NOT NULL`);
  }
  if (await tableExists(db, 'pet_visits')) {
    parts.push(`SELECT p."userId", v."partnerId", v."createdAt" AS at, 'VISIT' AS source FROM pet_visits v JOIN pets p ON p.id = v."petId"`);
  }
  return parts.join(' UNION ALL ');
}

export async function lastInteraction(db: any, userId: string, partnerId: string) {
  const sql = await interactionsSql(db);
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT at, source FROM (${sql}) i WHERE i."userId" = $1 AND i."partnerId" = $2 AND i.at > NOW() - INTERVAL '${ELIGIBLE_DAYS} days'
      ORDER BY at DESC LIMIT 1`,
    userId,
    partnerId,
  );
  return rows[0] || null;
}

function displayName(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Membro';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

function reviewView(r: any, opts: { mine?: boolean; admin?: boolean } = {}) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    tags: r.tags || [],
    author: displayName(r.userName),
    source: r.source,
    createdAt: r.createdAt,
    edited: new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime() > 60e3,
    reply: r.reply ? { text: r.reply, at: r.replyAt } : null,
    ...(opts.mine ? { mine: true } : {}),
    ...(opts.admin ? { status: r.status, hiddenReason: r.hiddenReason, partnerName: r.partnerName, userEmail: r.userEmail, reports: r.reports || 0 } : {}),
  };
}

/** Média e nº de avaliações visíveis por empresa (para a lista de parceiros). */
export async function partnerRatings(db: any, partnerIds: string[]) {
  await ensureReviewSchema(db);
  if (!partnerIds.length) return {} as Record<string, { rating: number; count: number }>;
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT "partnerId", ROUND(AVG(rating)::numeric, 1)::float8 AS rating, COUNT(*)::int AS count
       FROM partner_reviews WHERE status = 'VISIBLE' AND "partnerId" = ANY($1::text[]) GROUP BY "partnerId"`,
    partnerIds,
  );
  const out: Record<string, { rating: number; count: number }> = {};
  for (const r of rows) out[r.partnerId] = { rating: Number(r.rating), count: r.count };
  return out;
}

async function summary(db: any, partnerId: string) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT rating, COUNT(*)::int AS n FROM partner_reviews WHERE "partnerId" = $1 AND status = 'VISIBLE' GROUP BY rating`,
    partnerId,
  );
  const dist: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;
  for (const r of rows) {
    dist[r.rating] = r.n;
    count += r.n;
    sum += r.rating * r.n;
  }
  const tagRows: any[] = await db.$queryRawUnsafe(
    `SELECT t AS tag, COUNT(*)::int AS n FROM partner_reviews, unnest(tags) t WHERE "partnerId" = $1 AND status = 'VISIBLE' GROUP BY t ORDER BY n DESC`,
    partnerId,
  );
  return {
    rating: count ? Math.round((sum / count) * 10) / 10 : null,
    count,
    distribution: dist,
    tags: tagRows.map((t) => ({ id: t.tag, label: REVIEW_TAGS.find((x) => x.id === t.tag)?.label || t.tag, count: t.n })),
  };
}

async function notify(db: any, userId: string, title: string, message: string, data: Record<string, string>, partnerApp: boolean) {
  try {
    await saveInbox(db, [userId], title, message, data, partnerApp ? 'partner' : 'member');
    const tokens: any[] = await db.$queryRawUnsafe(
      `SELECT token FROM device_tokens WHERE "userId" = $1 AND "isActive" = true AND platform ${partnerApp ? "= 'android-partner'" : "<> 'android-partner'"}`,
      userId,
    );
    if (tokens.length) await sendFcmToTokens(tokens.map((t) => t.token), { title, body: message, data });
  } catch (e: any) {
    console.warn('⚠️ Aviso de avaliação falhou:', e?.message);
  }
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

/** Pede avaliação 2 h depois da visita (uma vez por empresa). Chamado pelo agendador. */
export async function sendReviewPrompts(db: any, max = 200, nowMs = Date.now()) {
  await ensureReviewSchema(db);
  // Só em horário comercial de Brasília (9h–20h): ninguém recebe pedido de avaliação de madrugada
  const brHour = (new Date(nowMs).getUTCHours() + 21) % 24;
  if (brHour < 9 || brHour >= 20) return { sent: 0, skipped: 'QUIET_HOURS' };
  const sql = await interactionsSql(db);
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT i."userId", i."partnerId", MAX(i.at) AS at, p.name AS "partnerName"
       FROM (${sql}) i JOIN partners p ON p.id = i."partnerId" AND p."isActive" = true
      WHERE i.at < NOW() - INTERVAL '${PROMPT_MIN_HOURS} hours' AND i.at > NOW() - INTERVAL '${PROMPT_MAX_DAYS} days'
        AND NOT EXISTS (SELECT 1 FROM partner_reviews r WHERE r."userId" = i."userId" AND r."partnerId" = i."partnerId")
        AND NOT EXISTS (SELECT 1 FROM partner_review_prompts q WHERE q."userId" = i."userId" AND q."partnerId" = i."partnerId")
        AND NOT EXISTS (SELECT 1 FROM partner_accounts a WHERE a."userId" = i."userId" AND a."partnerId" = i."partnerId")
      GROUP BY i."userId", i."partnerId", p.name ORDER BY MAX(i.at) LIMIT $1`,
    max,
  );
  let sent = 0;
  for (const r of rows) {
    const ins = await db.$executeRawUnsafe(
      `INSERT INTO partner_review_prompts ("userId", "partnerId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      r.userId,
      r.partnerId,
    );
    if (!ins) continue;
    await notify(db, r.userId, `⭐ Como foi na ${r.partnerName}?`, 'Sua avaliação ajuda outros tutores e a Liga a escolher bons parceiros.', { screen: 'ReviewForm', partnerId: String(r.partnerId), partnerName: String(r.partnerName) }, false);
    sent++;
  }
  return { sent };
}

// ---------------------------------------------------------------- roteador

export function isReviewPath(path: string) {
  return (
    /^\/api\/partners\/[^/]+\/reviews$/.test(path) ||
    path === '/api/reviews/pending' ||
    path === '/api/reviews/mine' ||
    /^\/api\/reviews\/[^/]+$/.test(path) ||
    path === '/api/partner/reviews' ||
    /^\/api\/partner\/reviews\/[^/]+\/(reply|report)$/.test(path) ||
    path === '/api/admin/reviews' ||
    /^\/api\/admin\/reviews\/[^/]+\/(hide|show)$/.test(path) ||
    path === '/api/cron/review-requests'
  );
}

function optionalUser(ctx: Ctx): string | null {
  const h = ctx.req?.headers?.authorization || ctx.req?.headers?.Authorization;
  if (!h) return null;
  try {
    return ctx.authUser().userId;
  } catch {
    return null;
  }
}

export async function handleReviews(ctx: Ctx): Promise<boolean> {
  const { path, method, res, db } = ctx;
  if (!isReviewPath(path)) return false;
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return true;
  }
  try {
    await ensureReviewSchema(db);

    if (path === '/api/cron/review-requests' && (method === 'GET' || method === 'POST')) {
      res.status(200).json(await sendReviewPrompts(db));
      return true;
    }

    // ---------- público (+ "minha avaliação" se logado)
    const pm = path.match(/^\/api\/partners\/([^/]+)\/reviews$/);
    if (pm && method === 'GET') {
      const partnerId = pm[1];
      const exists: any[] = await db.$queryRawUnsafe(`SELECT id FROM partners WHERE id = $1 AND "isActive" = true`, partnerId);
      if (!exists[0]) throw new HttpError(404, 'Parceiro não encontrado');
      const limit = Math.min(50, Math.max(1, parseInt(ctx.req?.query?.limit, 10) || 20));
      const offset = Math.max(0, parseInt(ctx.req?.query?.offset, 10) || 0);
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT r.*, u.name AS "userName" FROM partner_reviews r JOIN users u ON u.id = r."userId"
          WHERE r."partnerId" = $1 AND r.status = 'VISIBLE'
          ORDER BY (r.comment IS NOT NULL AND r.comment <> '') DESC, r."createdAt" DESC LIMIT $2 OFFSET $3`,
        partnerId,
        limit,
        offset,
      );
      const userId = optionalUser(ctx);
      let me: any = null;
      if (userId) {
        const mine: any[] = await db.$queryRawUnsafe(
          `SELECT r.*, u.name AS "userName" FROM partner_reviews r JOIN users u ON u.id = r."userId" WHERE r."partnerId" = $1 AND r."userId" = $2`,
          partnerId,
          userId,
        );
        const own: any[] = await db.$queryRawUnsafe(`SELECT 1 FROM partner_accounts WHERE "userId" = $1 AND "partnerId" = $2`, userId, partnerId);
        const visit = own[0] ? null : await lastInteraction(db, userId, partnerId);
        me = {
          review: mine[0] ? { ...reviewView(mine[0], { mine: true }), hidden: mine[0].status === 'HIDDEN' } : null,
          canReview: !!visit || !!mine[0],
          reason: own[0] ? 'OWN_COMPANY' : visit || mine[0] ? null : 'NO_VISIT',
        };
      }
      res.setHeader('Cache-Control', userId ? 'no-store' : 'public, max-age=60');
      res.status(200).json({ summary: await summary(db, partnerId), reviews: rows.map((r) => reviewView(r)), tags: REVIEW_TAGS, me });
      return true;
    }

    // ---------- membro
    if (pm && (method === 'POST' || method === 'PUT')) {
      const { userId } = ctx.authUser();
      const partnerId = pm[1];
      const partner: any[] = await db.$queryRawUnsafe(`SELECT id, name FROM partners WHERE id = $1 AND "isActive" = true`, partnerId);
      if (!partner[0]) throw new HttpError(404, 'Parceiro não encontrado');
      const own: any[] = await db.$queryRawUnsafe(`SELECT 1 FROM partner_accounts WHERE "userId" = $1 AND "partnerId" = $2`, userId, partnerId);
      if (own[0]) throw new HttpError(403, 'Você não pode avaliar a sua própria empresa.', 'OWN_COMPANY');
      const existing: any[] = await db.$queryRawUnsafe(`SELECT * FROM partner_reviews WHERE "partnerId" = $1 AND "userId" = $2`, partnerId, userId);
      const visit = await lastInteraction(db, userId, partnerId);
      if (!existing[0] && !visit) {
        throw new HttpError(
          403,
          'Só quem foi atendido pode avaliar: use a carteirinha na loja, conclua uma reserva ou leve o pet para o veterinário parceiro ler o QR.',
          'NO_VISIT',
        );
      }
      const rating = parseInt(body.rating, 10);
      if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, 'Dê uma nota de 1 a 5 estrelas');
      const comment = String(body.comment || '').trim().slice(0, 600) || null;
      if (rating <= 2 && (comment || '').length < MIN_TEXT_FOR_LOW) {
        throw new HttpError(400, 'Conte em poucas palavras o que aconteceu: ajuda a empresa a melhorar e a Liga a acompanhar.', 'COMMENT_REQUIRED');
      }
      const tags = Array.from(new Set((Array.isArray(body.tags) ? body.tags : []).map((t: any) => String(t).toUpperCase()).filter((t: string) => TAG_IDS.includes(t))));
      if (existing[0]) {
        await db.$executeRawUnsafe(
          `UPDATE partner_reviews SET rating = $2, comment = $3, tags = $4::text[], "updatedAt" = NOW() WHERE id = $1`,
          existing[0].id, rating, comment, tags,
        );
      } else {
        await db.$executeRawUnsafe(
          `INSERT INTO partner_reviews (id, "partnerId", "userId", rating, comment, tags, source) VALUES ($1,$2,$3,$4,$5,$6::text[],$7)`,
          crypto.randomUUID(), partnerId, userId, rating, comment, tags, visit.source,
        );
        // Avisa a empresa (App Parceiros)
        const accs: any[] = await db.$queryRawUnsafe(`SELECT "userId" FROM partner_accounts WHERE "partnerId" = $1 AND role = 'OWNER'`, partnerId);
        for (const a of accs) {
          await notify(db, a.userId, `${'⭐'.repeat(rating)} Nova avaliação`, comment ? `"${comment.slice(0, 80)}"` : `Um membro deu nota ${rating}.`, { screen: 'Reviews' }, true);
        }
      }
      const saved: any[] = await db.$queryRawUnsafe(
        `SELECT r.*, u.name AS "userName" FROM partner_reviews r JOIN users u ON u.id = r."userId" WHERE r."partnerId" = $1 AND r."userId" = $2`,
        partnerId,
        userId,
      );
      res.status(existing[0] ? 200 : 201).json({ review: reviewView(saved[0], { mine: true }), summary: await summary(db, partnerId) });
      return true;
    }

    if (path === '/api/reviews/pending' && method === 'GET') {
      const { userId } = ctx.authUser();
      const sql = await interactionsSql(db);
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT i."partnerId", MAX(i.at) AS at, p.name, p.logo, p.category
           FROM (${sql}) i JOIN partners p ON p.id = i."partnerId" AND p."isActive" = true
          WHERE i."userId" = $1 AND i.at > NOW() - INTERVAL '60 days'
            AND NOT EXISTS (SELECT 1 FROM partner_reviews r WHERE r."userId" = $1 AND r."partnerId" = i."partnerId")
            AND NOT EXISTS (SELECT 1 FROM partner_accounts a WHERE a."userId" = $1 AND a."partnerId" = i."partnerId")
          GROUP BY i."partnerId", p.name, p.logo, p.category ORDER BY MAX(i.at) DESC LIMIT 10`,
        userId,
      );
      res.status(200).json({ pending: rows.map((r) => ({ partnerId: r.partnerId, name: r.name, logo: r.logo, category: r.category, visitedAt: r.at })) });
      return true;
    }

    if (path === '/api/reviews/mine' && method === 'GET') {
      const { userId } = ctx.authUser();
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT r.*, u.name AS "userName", p.name AS "partnerName" FROM partner_reviews r JOIN users u ON u.id = r."userId" JOIN partners p ON p.id = r."partnerId"
          WHERE r."userId" = $1 ORDER BY r."updatedAt" DESC`,
        userId,
      );
      res.status(200).json({ reviews: rows.map((r) => ({ ...reviewView(r, { mine: true }), partnerId: r.partnerId, partnerName: r.partnerName, hidden: r.status === 'HIDDEN' })) });
      return true;
    }

    const rm = path.match(/^\/api\/reviews\/([^/]+)$/);
    if (rm && method === 'DELETE') {
      const { userId } = ctx.authUser();
      const n = await db.$executeRawUnsafe(`DELETE FROM partner_reviews WHERE id = $1 AND "userId" = $2`, rm[1], userId);
      if (!n) throw new HttpError(404, 'Avaliação não encontrada');
      res.status(200).json({ message: 'Avaliação apagada' });
      return true;
    }

    // ---------- admin
    if (path === '/api/admin/reviews' || path.startsWith('/api/admin/reviews/')) {
      if (!ctx.isAdmin) throw new HttpError(403, 'Acesso restrito');
      if (path === '/api/admin/reviews' && method === 'GET') {
        const q = ctx.req?.query || {};
        const where: string[] = [];
        if (q.status === 'HIDDEN' || q.status === 'VISIBLE') where.push(`r.status = '${q.status}'`);
        if (q.reported === '1') where.push(`EXISTS (SELECT 1 FROM partner_review_reports x WHERE x."reviewId" = r.id AND x.status = 'OPEN')`);
        if (q.low === '1') where.push('r.rating <= 2');
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT r.*, u.name AS "userName", u.email AS "userEmail", p.name AS "partnerName",
                  (SELECT COUNT(*)::int FROM partner_review_reports x WHERE x."reviewId" = r.id AND x.status = 'OPEN') AS reports,
                  (SELECT string_agg(x.reason, ' | ') FROM partner_review_reports x WHERE x."reviewId" = r.id AND x.status = 'OPEN') AS "reportReasons"
             FROM partner_reviews r JOIN users u ON u.id = r."userId" JOIN partners p ON p.id = r."partnerId"
            ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
            ORDER BY reports DESC, r."createdAt" DESC LIMIT 200`,
        );
        res.status(200).json({ reviews: rows.map((r) => ({ ...reviewView(r, { admin: true }), reportReasons: r.reportReasons || null, partnerId: r.partnerId })) });
        return true;
      }
      const am = path.match(/^\/api\/admin\/reviews\/([^/]+)\/(hide|show)$/);
      if (am && method === 'POST') {
        const hide = am[2] === 'hide';
        const reason = String(body.reason || '').trim().slice(0, 200);
        if (hide && reason.length < 3) throw new HttpError(400, 'Informe o motivo para esconder');
        const n = await db.$executeRawUnsafe(
          `UPDATE partner_reviews SET status = $2, "hiddenReason" = $3 WHERE id = $1`,
          am[1], hide ? 'HIDDEN' : 'VISIBLE', hide ? reason : null,
        );
        if (!n) throw new HttpError(404, 'Avaliação não encontrada');
        await db.$executeRawUnsafe(`UPDATE partner_review_reports SET status = 'RESOLVED' WHERE "reviewId" = $1`, am[1]);
        res.status(200).json({ message: hide ? 'Avaliação escondida' : 'Avaliação visível de novo' });
        return true;
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    // ---------- App Parceiros
    const { userId } = ctx.authUser();
    const acc = await partnerAccount(db, userId);
    if (path === '/api/partner/reviews' && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT r.*, u.name AS "userName",
                EXISTS (SELECT 1 FROM partner_review_reports x WHERE x."reviewId" = r.id AND x.status = 'OPEN') AS reported
           FROM partner_reviews r JOIN users u ON u.id = r."userId"
          WHERE r."partnerId" = $1 AND r.status = 'VISIBLE' ORDER BY r."createdAt" DESC LIMIT 200`,
        acc.partnerId,
      );
      res.status(200).json({
        summary: await summary(db, acc.partnerId),
        reviews: rows.map((r) => ({ ...reviewView(r), reported: !!r.reported })),
        canReply: acc.role === 'OWNER',
      });
      return true;
    }
    const prm = path.match(/^\/api\/partner\/reviews\/([^/]+)\/(reply|report)$/);
    if (prm && method === 'POST') {
      const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM partner_reviews WHERE id = $1 AND "partnerId" = $2`, prm[1], acc.partnerId);
      const r = rows[0];
      if (!r) throw new HttpError(404, 'Avaliação não encontrada');
      if (prm[2] === 'reply') {
        if (acc.role !== 'OWNER') throw new HttpError(403, 'Só o responsável pela empresa responde avaliações.', 'OWNER_ONLY');
        const text = String(body.text || '').trim().slice(0, 600);
        await db.$executeRawUnsafe(
          `UPDATE partner_reviews SET reply = $2, "replyAt" = CASE WHEN $2::text IS NULL THEN NULL ELSE NOW() END, "replyByAccountId" = $3 WHERE id = $1`,
          r.id, text || null, acc.id,
        );
        if (text && !r.reply) {
          await notify(db, r.userId, `💬 ${acc.partnerName} respondeu sua avaliação`, text.slice(0, 100), { screen: 'PartnerReviews', partnerId: String(acc.partnerId), partnerName: String(acc.partnerName) }, false);
        }
        res.status(200).json({ message: text ? 'Resposta publicada' : 'Resposta removida' });
        return true;
      }
      const reason = String(body.reason || '').trim().slice(0, 300);
      if (reason.length < 10) throw new HttpError(400, 'Explique o motivo da denúncia (mín. 10 letras)');
      const open: any[] = await db.$queryRawUnsafe(`SELECT 1 FROM partner_review_reports WHERE "reviewId" = $1 AND status = 'OPEN'`, r.id);
      if (open[0]) throw new HttpError(409, 'Esta avaliação já está em análise pela Liga.', 'ALREADY_REPORTED');
      await db.$executeRawUnsafe(
        `INSERT INTO partner_review_reports (id, "reviewId", "accountId", reason) VALUES ($1, $2, $3, $4)`,
        crypto.randomUUID(), r.id, acc.id, reason,
      );
      res.status(201).json({ message: 'Denúncia enviada. A Liga vai analisar; a avaliação continua visível até lá.' });
      return true;
    }

    throw new HttpError(404, 'Rota não encontrada');
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : e?.status || 500;
    if (status >= 500) console.error('❌ Avaliações:', e);
    res.status(status).json({ error: status >= 500 ? 'Erro interno nas avaliações' : e.message, code: e?.code });
    return true;
  }
}

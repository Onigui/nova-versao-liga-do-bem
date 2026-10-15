/**
 * Admin: painel inicial e acompanhamento de orçamentos.
 *
 * GET /api/admin/overview      → indicadores (membros, receita, uso da carteirinha, reencontros, NFP,
 *                                orçamentos, nota média), série dos últimos 6 meses e a lista
 *                                "precisa da sua atenção" com o atalho para a aba certa do admin.
 * GET /api/admin/quotes        → pedidos de orçamento (só leitura) com contagens e estatísticas.
 * GET /api/admin/quotes/:id    → um pedido: itens, propostas de cada loja (com total) e reservas.
 *
 * Várias tabelas são criadas sob demanda pelos módulos (achados e perdidos, NFP, avaliações…).
 * Cada consulta aqui é independente: se uma tabela ainda não existe, aquele número vem 0 e o
 * resto do painel continua funcionando.
 */

type Ctx = {
  req: any;
  res: any;
  path: string;
  method: string;
  db: any;
  isAdmin: boolean;
};

const num = (v: any) => (v == null ? 0 : Number(v) || 0);
const money = (v: any) => Math.round(num(v) * 100) / 100;

async function one(db: any, sql: string, ...params: any[]): Promise<any> {
  try {
    const rows: any[] = await db.$queryRawUnsafe(sql, ...params);
    return rows?.[0] || {};
  } catch {
    return {};
  }
}
async function many(db: any, sql: string, ...params: any[]): Promise<any[]> {
  try {
    return (await db.$queryRawUnsafe(sql, ...params)) || [];
  } catch {
    return [];
  }
}

const pct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** Itens da lista "precisa da sua atenção". section/sub = aba do admin que resolve. */
export const ATTENTION_DEFS = [
  { key: 'pixDonations', label: 'Doações por PIX que o doador disse ter pago', section: 'payments', sub: 'pagamentos', tone: 'warn' },
  { key: 'crmvPending', label: 'CRMV de veterinário para conferir', section: 'moderation', sub: 'crmv', tone: 'warn' },
  { key: 'reviewReports', label: 'Avaliações denunciadas por parceiros', section: 'moderation', sub: 'avaliacoes', tone: 'danger' },
  { key: 'lostFoundHidden', label: 'Avisos de achados e perdidos escondidos por denúncia', section: 'moderation', sub: 'achados', tone: 'danger' },
  { key: 'catalogSuggested', label: 'Itens sugeridos por parceiros para o catálogo', section: 'discounts', sub: 'catalogo', tone: 'info' },
  { key: 'nfpDeclared', label: 'Apoiadores da Nota Fiscal Paulista para conferir', section: 'nfp', sub: null, tone: 'info' },
  { key: 'adoptionsPending', label: 'Pedidos de adoção esperando resposta', section: 'animals', sub: null, tone: 'warn' },
  { key: 'membershipsExpiring', label: 'Carteirinhas que vencem nos próximos 7 dias', section: 'members', sub: null, tone: 'info' },
] as const;

export async function buildOverview(db: any, now = new Date()) {
  const [members, revenue, donations, uses, partners, lf, nfp, quotes, reviews, adoption] = await Promise.all([
    one(
      db,
      `SELECT COUNT(*) FILTER (WHERE status = 'ACTIVE' AND ("endDate" IS NULL OR "endDate" >= $1))::int AS active,
              COUNT(*) FILTER (WHERE status = 'ACTIVE' AND "endDate" >= $1 AND "endDate" < $1::timestamp + interval '7 days')::int AS expiring,
              (SELECT COUNT(*)::int FROM users WHERE role = 'MEMBER' AND "createdAt" >= $1::timestamp - interval '30 days') AS new30,
              (SELECT COUNT(*)::int FROM users WHERE role = 'MEMBER' AND "createdAt" >= $1::timestamp - interval '60 days' AND "createdAt" < $1::timestamp - interval '30 days') AS newprev,
              (SELECT COUNT(*)::int FROM users WHERE role = 'MEMBER') AS users
         FROM memberships`,
      now,
    ),
    one(
      db,
      `SELECT COALESCE(SUM(amount) FILTER (WHERE "paidAt" >= date_trunc('month', $1::timestamp)), 0) AS month,
              COALESCE(SUM(amount) FILTER (WHERE "paidAt" >= date_trunc('month', $1::timestamp) - interval '1 month'
                                             AND "paidAt" < date_trunc('month', $1::timestamp)), 0) AS prev
         FROM payments WHERE status = 'APPROVED' AND type = 'MEMBERSHIP'`,
      now,
    ),
    one(
      db,
      `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'APPROVED' AND "updatedAt" >= date_trunc('month', $1::timestamp)), 0) AS month,
              COUNT(*) FILTER (WHERE status = 'PENDING' AND method = 'PIX' AND "transactionId" LIKE 'PIX_CLAIMED_%')::int AS "pixPending"
         FROM donations`,
      now,
    ),
    one(
      db,
      `SELECT COUNT(*) FILTER (WHERE "validatedAt" >= $1::timestamp - interval '30 days')::int AS last30,
              COUNT(*) FILTER (WHERE "validatedAt" >= $1::timestamp - interval '60 days' AND "validatedAt" < $1::timestamp - interval '30 days')::int AS prev30,
              COUNT(DISTINCT "userId") FILTER (WHERE "validatedAt" >= $1::timestamp - interval '30 days')::int AS members30
         FROM partner_validations`,
      now,
    ),
    one(db, `SELECT COUNT(*) FILTER (WHERE "isActive")::int AS active FROM partners`),
    one(
      db,
      `SELECT COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS reunions,
              COUNT(*) FILTER (WHERE status = 'RESOLVED' AND "resolvedAt" >= $1::timestamp - interval '30 days')::int AS reunions30,
              COUNT(*) FILTER (WHERE status = 'ACTIVE' AND NOT hidden)::int AS active,
              COUNT(*) FILTER (WHERE hidden AND status = 'ACTIVE')::int AS hidden
         FROM lf_reports`,
      now,
    ),
    one(
      db,
      `SELECT COUNT(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed,
              COUNT(*) FILTER (WHERE status = 'DECLARED')::int AS declared
         FROM nfp_supporters`,
    ),
    one(
      db,
      `SELECT COUNT(*)::int AS requests30,
              COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM quote_responses s WHERE s."requestId" = q.id AND s.status = 'SUBMITTED'))::int AS answered30,
              (SELECT COUNT(*)::int FROM quote_reservations r WHERE r."createdAt" >= $1::timestamp - interval '30 days') AS reservations30
         FROM quote_requests q WHERE q."createdAt" >= $1::timestamp - interval '30 days'`,
      now,
    ),
    one(
      db,
      `SELECT ROUND(AVG(rating)::numeric, 2) AS avg, COUNT(*)::int AS n,
              (SELECT COUNT(*)::int FROM partner_review_reports WHERE status = 'OPEN') AS reports
         FROM partner_reviews WHERE status = 'VISIBLE'`,
    ),
    one(
      db,
      `SELECT (SELECT COUNT(*)::int FROM adoptions WHERE status = 'PENDING') AS pending,
              (SELECT COUNT(*)::int FROM adoptions WHERE status = 'COMPLETED') AS completed,
              (SELECT COUNT(*)::int FROM animals WHERE "isActive" AND NOT "isAdopted") AS available`,
    ),
  ]);
  const [crmv, catalog, series] = await Promise.all([
    one(db, `SELECT COUNT(*)::int AS n FROM partner_vets WHERE status = 'PENDING'`),
    one(db, `SELECT COUNT(*)::int AS n FROM catalog_items WHERE "partnerId" IS NOT NULL AND "isActive"`),
    many(
      db,
      `WITH m AS (SELECT generate_series(date_trunc('month', $1::timestamp) - interval '5 months', date_trunc('month', $1::timestamp), interval '1 month') AS m)
       SELECT to_char(m.m, 'YYYY-MM') AS month,
              (SELECT COUNT(*)::int FROM users u WHERE u.role = 'MEMBER' AND u."createdAt" >= m.m AND u."createdAt" < m.m + interval '1 month') AS "newMembers",
              (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.status = 'APPROVED' AND p.type = 'MEMBERSHIP'
                 AND p."paidAt" >= m.m AND p."paidAt" < m.m + interval '1 month') AS revenue,
              (SELECT COUNT(*)::int FROM partner_validations v WHERE v."validatedAt" >= m.m AND v."validatedAt" < m.m + interval '1 month') AS "cardUses"
         FROM m ORDER BY m.m`,
      now,
    ),
  ]);

  const counts: Record<string, number> = {
    pixDonations: num(donations.pixPending),
    crmvPending: num(crmv.n),
    reviewReports: num(reviews.reports),
    lostFoundHidden: num(lf.hidden),
    catalogSuggested: num(catalog.n),
    nfpDeclared: num(nfp.declared),
    adoptionsPending: num(adoption.pending),
    membershipsExpiring: num(members.expiring),
  };
  const attention = ATTENTION_DEFS.filter((d) => counts[d.key] > 0).map((d) => ({ ...d, count: counts[d.key] }));

  return {
    generatedAt: now.toISOString(),
    kpis: {
      activeMembers: num(members.active),
      users: num(members.users),
      newMembers30d: num(members.new30),
      newMembersTrend: pct(num(members.new30), num(members.newprev)),
      revenueMonth: money(revenue.month),
      revenueTrend: pct(num(revenue.month), num(revenue.prev)),
      donationsMonth: money(donations.month),
      cardUses30d: num(uses.last30),
      cardUsesTrend: pct(num(uses.last30), num(uses.prev30)),
      membersUsingCard30d: num(uses.members30),
      activePartners: num(partners.active),
      reunions: num(lf.reunions),
      reunions30d: num(lf.reunions30),
      lostFoundActive: num(lf.active),
      nfpSupporters: num(nfp.confirmed),
      quotes30d: num(quotes.requests30),
      quotesAnswered30d: num(quotes.answered30),
      reservations30d: num(quotes.reservations30),
      ratingAvg: reviews.avg == null ? null : Number(reviews.avg),
      ratingCount: num(reviews.n),
      adoptionsCompleted: num(adoption.completed),
      animalsAvailable: num(adoption.available),
    },
    series: series.map((s) => ({ month: s.month, newMembers: num(s.newMembers), revenue: money(s.revenue), cardUses: num(s.cardUses) })),
    attention,
    attentionTotal: attention.reduce((a, b) => a + b.count, 0),
  };
}

// ---------------------------------------------------------------- orçamentos

const QUOTE_FILTERS: Record<string, string> = {
  open: `q.status = 'OPEN' AND q."expiresAt" > NOW()`,
  expired: `q.status = 'OPEN' AND q."expiresAt" <= NOW()`,
  reserved: `EXISTS (SELECT 1 FROM quote_reservations r WHERE r."requestId" = q.id)`,
  unanswered: `NOT EXISTS (SELECT 1 FROM quote_responses s WHERE s."requestId" = q.id AND s.status = 'SUBMITTED')`,
  cancelled: `q.status = 'CANCELLED'`,
};

function quoteState(r: any, now = Date.now()) {
  if (num(r.reservations) > 0) return num(r.done) > 0 ? 'DONE' : 'RESERVED';
  if (r.status === 'CANCELLED') return 'CANCELLED';
  if (r.status === 'CLOSED') return 'CLOSED';
  if (new Date(r.expiresAt).getTime() <= now) return 'EXPIRED';
  return 'OPEN';
}

export async function listQuotesAdmin(db: any, opts: { filter?: string; page?: number; limit?: number; q?: string }) {
  const where: string[] = [];
  const params: any[] = [];
  if (opts.filter && QUOTE_FILTERS[opts.filter]) where.push(QUOTE_FILTERS[opts.filter]);
  if (opts.q) {
    params.push(`%${opts.q.toLowerCase()}%`);
    where.push(`(lower(u.name) LIKE $${params.length} OR lower(COALESCE(q.city,'')) LIKE $${params.length} OR lower(COALESCE(q.district,'')) LIKE $${params.length}
      OR EXISTS (SELECT 1 FROM quote_request_items i WHERE i."requestId" = q.id AND lower(i.label) LIKE $${params.length}))`);
  }
  const limit = Math.min(100, Math.max(1, opts.limit || 30));
  const page = Math.max(1, opts.page || 1);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT q.id, q.status, q."expiresAt", q."createdAt", q.city, q.district, q.species, q."hasPrescription",
            u.name AS "userName", cp.name AS "createdByPartner",
            (SELECT COUNT(*)::int FROM quote_request_items i WHERE i."requestId" = q.id) AS items,
            (SELECT string_agg(i.label, ' · ' ORDER BY i.position) FROM (SELECT label, position FROM quote_request_items WHERE "requestId" = q.id ORDER BY position LIMIT 3) i) AS preview,
            (SELECT COUNT(*)::int FROM quote_targets t WHERE t."requestId" = q.id) AS targets,
            (SELECT COUNT(*)::int FROM quote_targets t WHERE t."requestId" = q.id AND t."seenAt" IS NOT NULL) AS seen,
            (SELECT COUNT(*)::int FROM quote_responses s WHERE s."requestId" = q.id AND s.status = 'SUBMITTED') AS responses,
            (SELECT MIN(s."createdAt") FROM quote_responses s WHERE s."requestId" = q.id) AS "firstResponseAt",
            (SELECT COUNT(*)::int FROM quote_reservations r WHERE r."requestId" = q.id AND r.status <> 'CANCELLED') AS reservations,
            (SELECT COUNT(*)::int FROM quote_reservations r WHERE r."requestId" = q.id AND r.status = 'DONE') AS done,
            COUNT(*) OVER()::int AS total
       FROM quote_requests q
       JOIN users u ON u.id = q."userId"
       LEFT JOIN partners cp ON cp.id = q."createdByPartnerId"
       ${w}
      ORDER BY q."createdAt" DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    ...params,
  );
  const stats = await one(
    db,
    `SELECT COUNT(*)::int AS requests,
            COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM quote_responses s WHERE s."requestId" = q.id AND s.status = 'SUBMITTED'))::int AS answered,
            COALESCE(ROUND(AVG((SELECT COUNT(*) FROM quote_responses s WHERE s."requestId" = q.id AND s.status = 'SUBMITTED'))::numeric, 1), 0) AS "avgResponses",
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ((SELECT MIN(s."createdAt") FROM quote_responses s WHERE s."requestId" = q.id) - q."createdAt")) / 60)::numeric) AS "medianFirstResponseMin",
            (SELECT COUNT(*)::int FROM quote_reservations r WHERE r."createdAt" >= NOW() - interval '30 days' AND r.status <> 'CANCELLED') AS reservations,
            (SELECT COUNT(*)::int FROM quote_reservations r WHERE r."createdAt" >= NOW() - interval '30 days' AND r.status = 'DONE') AS done,
            (SELECT COALESCE(SUM(total), 0) FROM quote_reservations r WHERE r."createdAt" >= NOW() - interval '30 days' AND r.status = 'DONE') AS "doneTotal"
       FROM quote_requests q WHERE q."createdAt" >= NOW() - interval '30 days'`,
  );
  const topPartners = await many(
    db,
    `SELECT p.id, p.name,
            COUNT(DISTINCT t."requestId")::int AS received,
            COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'SUBMITTED')::int AS answered,
            COUNT(DISTINCT r.id) FILTER (WHERE r.status <> 'CANCELLED')::int AS reservations
       FROM quote_targets t
       JOIN quote_requests q ON q.id = t."requestId" AND q."createdAt" >= NOW() - interval '30 days'
       JOIN partners p ON p.id = t."partnerId"
       LEFT JOIN quote_responses s ON s."requestId" = t."requestId" AND s."partnerId" = t."partnerId"
       LEFT JOIN quote_reservations r ON r."requestId" = t."requestId" AND r."partnerId" = t."partnerId"
      GROUP BY p.id, p.name
      ORDER BY received DESC, answered DESC
      LIMIT 8`,
  );
  return {
    quotes: rows.map((r) => ({
      id: r.id,
      state: quoteState(r),
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      member: String(r.userName || '').trim().split(/\s+/)[0] || '—',
      createdByPartner: r.createdByPartner || null,
      place: [r.district, r.city].filter(Boolean).join(', ') || null,
      species: r.species || null,
      hasPrescription: !!r.hasPrescription,
      items: num(r.items),
      preview: r.preview || '',
      targets: num(r.targets),
      seen: num(r.seen),
      responses: num(r.responses),
      firstResponseMin: r.firstResponseAt ? Math.round((new Date(r.firstResponseAt).getTime() - new Date(r.createdAt).getTime()) / 60000) : null,
      reservations: num(r.reservations),
    })),
    total: num(rows[0]?.total),
    page,
    limit,
    stats: {
      requests30d: num(stats.requests),
      answered30d: num(stats.answered),
      answerRate: num(stats.requests) ? Math.round((num(stats.answered) / num(stats.requests)) * 100) : null,
      avgResponses: Number(stats.avgResponses || 0),
      medianFirstResponseMin: stats.medianFirstResponseMin == null ? null : num(stats.medianFirstResponseMin),
      reservations30d: num(stats.reservations),
      done30d: num(stats.done),
      doneTotal30d: money(stats.doneTotal),
    },
    topPartners: topPartners.map((p) => ({ id: p.id, name: p.name, received: num(p.received), answered: num(p.answered), reservations: num(p.reservations) })),
  };
}

export async function quoteDetailAdmin(db: any, id: string) {
  const reqs: any[] = await db.$queryRawUnsafe(
    `SELECT q.*, u.name AS "userName", cp.name AS "createdByPartner",
            (SELECT COUNT(*)::int FROM quote_reservations r WHERE r."requestId" = q.id AND r.status <> 'CANCELLED') AS reservations,
            (SELECT COUNT(*)::int FROM quote_reservations r WHERE r."requestId" = q.id AND r.status = 'DONE') AS done
       FROM quote_requests q JOIN users u ON u.id = q."userId" LEFT JOIN partners cp ON cp.id = q."createdByPartnerId"
      WHERE q.id = $1`,
    id,
  );
  const q = reqs[0];
  if (!q) return null;
  const [items, responses, lines, reservations, targets] = await Promise.all([
    db.$queryRawUnsafe(`SELECT id, label, category, quantity, note FROM quote_request_items WHERE "requestId" = $1 ORDER BY position`, id),
    db.$queryRawUnsafe(
      `SELECT s.id, s."partnerId", p.name AS partner, s.status, s.note, s."validUntil", s."createdAt"
         FROM quote_responses s JOIN partners p ON p.id = s."partnerId" WHERE s."requestId" = $1 ORDER BY s."createdAt"`,
      id,
    ),
    db.$queryRawUnsafe(
      `SELECT l."responseId", l."requestItemId", l."unitPrice", l.available FROM quote_response_lines l
         JOIN quote_responses s ON s.id = l."responseId" WHERE s."requestId" = $1`,
      id,
    ),
    db.$queryRawUnsafe(
      `SELECT r.id, p.name AS partner, r.status, r.total, r."createdAt", r."doneAt" FROM quote_reservations r
         JOIN partners p ON p.id = r."partnerId" WHERE r."requestId" = $1 ORDER BY r."createdAt"`,
      id,
    ),
    db.$queryRawUnsafe(
      `SELECT p.name AS partner, t."seenAt" FROM quote_targets t JOIN partners p ON p.id = t."partnerId" WHERE t."requestId" = $1 ORDER BY p.name`,
      id,
    ),
  ]);
  const qty: Record<string, number> = Object.fromEntries((items as any[]).map((i) => [i.id, num(i.quantity) || 1]));
  return {
    id: q.id,
    state: quoteState(q),
    createdAt: q.createdAt,
    expiresAt: q.expiresAt,
    member: String(q.userName || '').trim().split(/\s+/)[0] || '—',
    createdByPartner: q.createdByPartner || null,
    place: [q.district, q.city].filter(Boolean).join(', ') || null,
    species: q.species || null,
    petWeight: q.petWeight == null ? null : Number(q.petWeight),
    notes: q.notes || null,
    hasPrescription: !!q.hasPrescription,
    items: (items as any[]).map((i) => ({ id: i.id, label: i.label, category: i.category, quantity: num(i.quantity), note: i.note || null })),
    targets: (targets as any[]).map((t) => ({ partner: t.partner, seen: !!t.seenAt })),
    responses: (responses as any[]).map((s) => {
      const ls = (lines as any[]).filter((l) => l.responseId === s.id);
      const priced = ls.filter((l) => l.available && l.unitPrice != null);
      return {
        partner: s.partner,
        status: s.status,
        note: s.note || null,
        validUntil: s.validUntil,
        createdAt: s.createdAt,
        itemsPriced: priced.length,
        total: money(priced.reduce((a, l) => a + num(l.unitPrice) * (qty[l.requestItemId] || 1), 0)),
      };
    }),
    reservations: (reservations as any[]).map((r) => ({ partner: r.partner, status: r.status, total: money(r.total), createdAt: r.createdAt, doneAt: r.doneAt })),
  };
}

// ---------------------------------------------------------------- roteador

export function isAdminOverviewPath(path: string) {
  return path === '/api/admin/overview' || path === '/api/admin/quotes' || /^\/api\/admin\/quotes\/[^/]+$/.test(path);
}

export async function handleAdminOverview(ctx: Ctx): Promise<boolean> {
  const { req, res, path, method, db } = ctx;
  if (!isAdminOverviewPath(path)) return false;
  if (!ctx.isAdmin) {
    res.status(401).json({ error: 'Não autorizado' });
    return true;
  }
  if (method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido' });
    return true;
  }
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return true;
  }
  try {
    if (path === '/api/admin/overview') {
      res.status(200).json(await buildOverview(db));
      return true;
    }
    if (path === '/api/admin/quotes') {
      const q = req.query || {};
      const data = await listQuotesAdmin(db, {
        filter: String(q.filter || ''),
        page: parseInt(String(q.page || '1'), 10) || 1,
        limit: parseInt(String(q.limit || '30'), 10) || 30,
        q: String(q.q || '').trim().slice(0, 60),
      }).catch((e: any) => {
        // Tabelas de orçamento ainda não criadas (ninguém pediu orçamento) → lista vazia
        if (/does not exist/i.test(String(e?.message))) return { quotes: [], total: 0, page: 1, limit: 30, stats: null, topPartners: [] };
        throw e;
      });
      res.status(200).json(data);
      return true;
    }
    const id = decodeURIComponent(path.split('/').pop() || '');
    const detail = await quoteDetailAdmin(db, id);
    if (!detail) res.status(404).json({ error: 'Pedido de orçamento não encontrado' });
    else res.status(200).json({ quote: detail });
    return true;
  } catch (e: any) {
    console.error('❌ Admin overview/quotes:', e);
    res.status(500).json({ error: 'Erro interno no painel' });
    return true;
  }
}

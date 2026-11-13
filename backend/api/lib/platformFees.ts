/**
 * Taxa da plataforma SóciONG: 10% do valor BRUTO de tudo o que a ONG arrecada pelo app
 * (mensalidades dos sócios, doações e pagamentos dos parceiros), sem teto.
 *
 * - Calculada sozinha, mês a mês, dentro de cada ONG.
 * - Ao virar o mês, o mês fechado vira uma cobrança (platform_fee_invoices) "a pagar":
 *   aparece na central de pendências e no relatório da ONG, pronta para ela só pagar.
 * - A equipe marca como paga no painel (Plataforma → Taxas).
 * - Pagamentos pelo Asaas com split já entregam a taxa na hora: entram no bruto, mas a parte
 *   que já veio por split (splitCents) sai da cobrança do mês.
 */
import crypto from 'crypto';
import { DEFAULT_ORG, isolationOn, runAsSystem, runWithOrg } from './tenant';

export const DEFAULT_FEE_RATE = 0.1;
const num = (v: any) => Number(v || 0);

export function feeRate(fees: any) {
  const r = Number(fees?.rate);
  return r >= 0 && r <= 0.3 ? r : DEFAULT_FEE_RATE;
}

export function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function lastMonths(now: Date, n: number) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  return out;
}

/**
 * Arrecadação bruta por mês (em centavos), por origem. Roda DENTRO da ONG (runWithOrg):
 * com a separação ligada, o banco só devolve os dados dela.
 */
export async function grossByMonth(db: any, now = new Date(), months = 12) {
  const M = `WITH m AS (SELECT generate_series(date_trunc('month', $1::timestamp) - ($2 || ' months')::interval, date_trunc('month', $1::timestamp), interval '1 month') AS m)`;
  const inMonth = (col: string) => `${col} >= m.m AND ${col} < m.m + interval '1 month'`;
  const q = async (sub: string) => {
    try {
      const rows: any[] = await db.$queryRawUnsafe(`${M} SELECT to_char(m.m, 'YYYY-MM') AS month, (${sub}) AS v FROM m`, now, String(months - 1));
      return new Map(rows.map((r) => [r.month, Math.round(num(r.v))]));
    } catch {
      return new Map<string, number>();
    }
  };
  const [memberships, donations, partners, split] = await Promise.all([
    q(`SELECT COALESCE(SUM(p.amount), 0) * 100 FROM payments p WHERE p.status = 'APPROVED' AND p.type = 'MEMBERSHIP' AND ${inMonth('COALESCE(p."paidAt", p."createdAt")')}`),
    q(`SELECT COALESCE(SUM(d.amount), 0) * 100 FROM donations d WHERE d.status = 'APPROVED' AND ${inMonth('d."updatedAt"')}`),
    q(`SELECT COALESCE(SUM(c."priceCents"), 0) FROM partner_push_campaigns c WHERE c."paidAt" IS NOT NULL AND c.status <> 'REFUNDED' AND ${inMonth('c."paidAt"')}`),
    // Bruto que já pagou a taxa por split no Asaas
    q(`SELECT COALESCE(SUM(p.amount), 0) * 100 FROM payments p WHERE p.status = 'APPROVED' AND p.gateway = 'ASAAS' AND COALESCE((p."gatewayData"->>'splitFeeCents')::numeric, 0) > 0 AND ${inMonth('COALESCE(p."paidAt", p."createdAt")')}`),
  ]);
  return lastMonths(now, months).map((month) => {
    const m = memberships.get(month) || 0;
    const d = donations.get(month) || 0;
    const p = partners.get(month) || 0;
    const gross = m + d + p;
    return { month, membershipsCents: m, donationsCents: d, partnersCents: p, grossCents: gross, splitCents: Math.min(gross, split.get(month) || 0) };
  });
}

/** feeCents = o que ainda falta pagar (fora do split); splitFeeCents = o que já veio pelo Asaas. */
export function withFee<T extends { grossCents: number; splitCents?: number }>(rows: T[], rate: number) {
  return rows.map((r) => {
    const split = Math.max(0, Math.min(r.grossCents, r.splitCents || 0));
    return { ...r, feeCents: Math.round((r.grossCents - split) * rate), splitFeeCents: Math.round(split * rate) };
  });
}

// ---------------------------------------------------------------- cobranças dos meses fechados

let ready: Promise<void> | null = null;
let readyDb: any = null;
export function ensureFeeSchema(db: any) {
  if (ready && readyDb === db) return ready;
  readyDb = db;
  ready = runAsSystem(async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS platform_fee_invoices (
      id TEXT PRIMARY KEY,
      "orgId" TEXT NOT NULL,
      month TEXT NOT NULL,
      "membershipsCents" INTEGER NOT NULL DEFAULT 0,
      "donationsCents" INTEGER NOT NULL DEFAULT 0,
      "partnersCents" INTEGER NOT NULL DEFAULT 0,
      "grossCents" INTEGER NOT NULL DEFAULT 0,
      rate NUMERIC NOT NULL DEFAULT 0.1,
      "feeCents" INTEGER NOT NULL DEFAULT 0,
      "splitCents" INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING',
      "paidAt" TIMESTAMP,
      "paidNote" TEXT,
      "markedBy" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE ("orgId", month)
    )`);
    await db.$executeRawUnsafe(`ALTER TABLE platform_fee_invoices ADD COLUMN IF NOT EXISTS "splitCents" INTEGER NOT NULL DEFAULT 0`);
  }).catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

/**
 * Gera/atualiza as cobranças dos meses já fechados (até 3 para trás) de cada ONG ativa.
 * Cobrança paga não muda mais. Mês sem arrecadação não vira cobrança.
 */
export async function syncFeeInvoices(db: any, now = new Date()) {
  await ensureFeeSchema(db);
  const orgs: any[] = await runAsSystem(() => db.$queryRawUnsafe(`SELECT id, fees, status FROM organizations WHERE status = 'ACTIVE'`));
  const closed = lastMonths(now, 4).slice(0, 3); // os 3 meses antes do atual
  for (const o of orgs) {
    // Sem a separação ligada o banco só tem os dados da Liga: não dá para atribuir a outra ONG
    if (!isolationOn() && o.id !== DEFAULT_ORG) continue;
    const rate = feeRate(o.fees);
    const rows = withFee(await runWithOrg(o.id, () => grossByMonth(db, now, 4)), rate).filter((r) => closed.includes(r.month));
    for (const r of rows) {
      // Mês todo pago por split (Asaas) não vira cobrança
      if (r.grossCents <= 0 || r.feeCents <= 0) continue;
      await runAsSystem(() =>
        db.$executeRawUnsafe(
          `INSERT INTO platform_fee_invoices (id, "orgId", month, "membershipsCents", "donationsCents", "partnersCents", "grossCents", rate, "feeCents", "splitCents")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT ("orgId", month) DO UPDATE SET
             "membershipsCents" = EXCLUDED."membershipsCents", "donationsCents" = EXCLUDED."donationsCents",
             "partnersCents" = EXCLUDED."partnersCents", "grossCents" = EXCLUDED."grossCents",
             rate = EXCLUDED.rate, "feeCents" = EXCLUDED."feeCents", "splitCents" = EXCLUDED."splitCents", "updatedAt" = NOW()
           WHERE platform_fee_invoices.status = 'PENDING'`,
          crypto.randomUUID(),
          o.id,
          r.month,
          r.membershipsCents,
          r.donationsCents,
          r.partnersCents,
          r.grossCents,
          rate,
          r.feeCents,
          r.splitCents || 0,
        ),
      );
    }
  }
}

export async function listInvoices(db: any, orgId?: string | null) {
  await ensureFeeSchema(db);
  const rows: any[] = await runAsSystem(() =>
    db.$queryRawUnsafe(
      `SELECT f.*, o.name AS "orgName" FROM platform_fee_invoices f JOIN organizations o ON o.id = f."orgId"
        ${orgId ? 'WHERE f."orgId" = $1' : ''} ORDER BY f.month DESC, o.name LIMIT 200`,
      ...(orgId ? [orgId] : []),
    ),
  );
  return rows.map((r) => ({
    id: r.id,
    orgId: r.orgId,
    orgName: r.orgName,
    month: r.month,
    membershipsCents: num(r.membershipsCents),
    donationsCents: num(r.donationsCents),
    partnersCents: num(r.partnersCents),
    grossCents: num(r.grossCents),
    rate: Number(r.rate),
    feeCents: num(r.feeCents),
    splitCents: num(r.splitCents),
    status: r.status,
    paidAt: r.paidAt,
    paidNote: r.paidNote,
  }));
}

/** Rotas da equipe da plataforma (o chamador já conferiu que é a equipe). */
export async function handleFeeRoutes(ctx: { path: string; method: string; body: any; db: any; res: any; email?: string | null }) {
  const { path, method, db, res } = ctx;
  if (path === '/api/platform/fees' && method === 'GET') {
    await syncFeeInvoices(db);
    const invoices = await listInvoices(db);
    // Mês corrente (estimativa, ainda vai mudar)
    const orgs: any[] = await runAsSystem(() => db.$queryRawUnsafe(`SELECT id, name, fees FROM organizations WHERE status = 'ACTIVE' ORDER BY (id = $1) DESC, name`, DEFAULT_ORG));
    const current: any[] = [];
    for (const o of orgs) {
      if (!isolationOn() && o.id !== DEFAULT_ORG) continue;
      const rate = feeRate(o.fees);
      const [m] = withFee((await runWithOrg(o.id, () => grossByMonth(db, new Date(), 1))), rate);
      current.push({ orgId: o.id, orgName: o.name, rate, ...m });
    }
    return res.status(200).json({ rate: DEFAULT_FEE_RATE, current, invoices }), true;
  }
  const m = path.match(/^\/api\/platform\/fees\/([^/]+)\/(paid|pending)$/);
  if (m && method === 'POST') {
    await ensureFeeSchema(db);
    const paid = m[2] === 'paid';
    const n = await runAsSystem(() =>
      db.$executeRawUnsafe(
        `UPDATE platform_fee_invoices SET status = $2, "paidAt" = ${paid ? 'NOW()' : 'NULL'}, "paidNote" = $3, "markedBy" = $4, "updatedAt" = NOW() WHERE id = $1`,
        decodeURIComponent(m[1]),
        paid ? 'PAID' : 'PENDING',
        String(ctx.body?.note || '').slice(0, 300) || null,
        ctx.email || null,
      ),
    );
    return Number(n) ? (res.status(200).json({ ok: true }), true) : (res.status(404).json({ error: 'Cobrança não encontrada' }), true);
  }
  return false;
}

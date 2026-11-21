/**
 * Limite de uso das promoções dos parceiros.
 *
 * Cada promoção diz quantas vezes CADA associado pode aproveitar ("perMemberLimit", padrão 1)
 * e, opcionalmente, quantas existem no total ("totalLimit", ex.: "os 50 primeiros ganham o brinde").
 * Cada uso registrado no balcão vira uma linha em partner_discount_uses (com a quantidade).
 *
 * A conta é feita no servidor, dentro de uma transação com trava por associado+promoção:
 * mesmo que o app do parceiro esteja desatualizado, ou dois caixas registrem ao mesmo tempo,
 * ninguém passa do limite.
 */
import crypto from 'crypto';

export const DEFAULT_PER_MEMBER_LIMIT = 1;
export const MAX_PER_MEMBER_LIMIT = 99;
export const MAX_TOTAL_LIMIT = 100000;

export const PROMO_LIMIT_SCHEMA_SQL = [
  `ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS "perMemberLimit" INTEGER DEFAULT ${DEFAULT_PER_MEMBER_LIMIT}`,
  `ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS "totalLimit" INTEGER`,
  `CREATE TABLE IF NOT EXISTS partner_discount_uses (
     id TEXT PRIMARY KEY,
     "discountId" TEXT NOT NULL REFERENCES partner_discounts(id) ON DELETE CASCADE,
     "partnerId" TEXT NOT NULL,
     "userId" TEXT NOT NULL,
     "validationId" TEXT,
     quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
     "registeredById" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS partner_discount_uses_member_idx ON partner_discount_uses("discountId", "userId")`,
  `CREATE INDEX IF NOT EXISTS partner_discount_uses_validation_idx ON partner_discount_uses("validationId")`,
];

export class PromoLimitError extends Error {
  status = 409;
  constructor(message: string, public code: string, public discountId?: string) {
    super(message);
  }
}

/** null/undefined/'' → padrão (1). 0 ou "sem limite" não existe por associado: o pedido das ONGs é limitar sempre. */
export function normalizePerMemberLimit(v: any, current?: any): number {
  if (v === undefined) return current != null ? Number(current) : DEFAULT_PER_MEMBER_LIMIT;
  if (v === null || v === '') return DEFAULT_PER_MEMBER_LIMIT;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PER_MEMBER_LIMIT) {
    throw Object.assign(new Error(`Limite por associado deve ser de 1 a ${MAX_PER_MEMBER_LIMIT}`), { status: 400 });
  }
  return n;
}

/** null/'' → sem limite total. */
export function normalizeTotalLimit(v: any, current?: any): number | null {
  if (v === undefined) return current != null ? Number(current) : null;
  if (v === null || v === '' || v === 0 || v === '0') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > MAX_TOTAL_LIMIT) {
    throw Object.assign(new Error('Quantidade total inválida'), { status: 400 });
  }
  return n;
}

export const perMemberLimitOf = (d: any) => {
  const n = Number(d?.perMemberLimit);
  return Number.isInteger(n) && n >= 1 ? n : DEFAULT_PER_MEMBER_LIMIT;
};
export const totalLimitOf = (d: any) => {
  const n = Number(d?.totalLimit);
  return Number.isInteger(n) && n >= 1 ? n : null;
};

/** Texto curto para o cartão da promoção: "1 por associado", "Até 2 por associado · 50 no total". */
export function limitLabel(d: any): string {
  const per = perMemberLimitOf(d);
  const total = totalLimitOf(d);
  const a = per === 1 ? '1 por associado' : `Até ${per} por associado`;
  return total ? `${a} · ${total} no total` : a;
}

type Usage = { used: number; lastUsedAt: Date | null };

/** Quanto este associado já usou de cada promoção (ignorando, se quiser, um atendimento que está sendo editado). */
export async function memberUsage(db: any, userId: string, discountIds: string[], exceptValidationId?: string | null) {
  const out: Record<string, Usage> = {};
  if (!userId || !discountIds.length) return out;
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT "discountId", COALESCE(SUM(quantity), 0)::int AS used, MAX("createdAt") AS "lastUsedAt"
       FROM partner_discount_uses
      WHERE "userId" = $1 AND "discountId" = ANY($2::text[])
        AND ($3::text IS NULL OR "validationId" IS DISTINCT FROM $3)
      GROUP BY "discountId"`,
    userId,
    discountIds,
    exceptValidationId || null,
  );
  for (const r of rows) out[r.discountId] = { used: Number(r.used) || 0, lastUsedAt: r.lastUsedAt || null };
  return out;
}

/** Usos totais de cada promoção (para "quantidade total disponível"). */
export async function totalUsage(db: any, discountIds: string[], exceptValidationId?: string | null) {
  const out: Record<string, number> = {};
  if (!discountIds.length) return out;
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT "discountId", COALESCE(SUM(quantity), 0)::int AS used
       FROM partner_discount_uses
      WHERE "discountId" = ANY($1::text[])
        AND ($2::text IS NULL OR "validationId" IS DISTINCT FROM $2)
      GROUP BY "discountId"`,
    discountIds,
    exceptValidationId || null,
  );
  for (const r of rows) out[r.discountId] = Number(r.used) || 0;
  return out;
}

/**
 * Acrescenta a cada promoção (já formatada) o que vale para ESTE associado:
 * remainingForMember, usedByMember, lastUsedAt, remainingTotal, available e o motivo quando não pode.
 * Sem userId devolve só os limites (vitrine pública).
 */
export async function annotateWithUsage<T extends { id: string; perMemberLimit?: number; totalLimit?: number | null }>(
  db: any,
  discounts: T[],
  userId?: string | null,
) {
  const ids = discounts.map((d) => d.id);
  const withTotal = discounts.filter((d) => totalLimitOf(d) != null).map((d) => d.id);
  const [mine, totals] = await Promise.all([
    userId ? memberUsage(db, userId, ids) : Promise.resolve({} as Record<string, Usage>),
    totalUsage(db, withTotal),
  ]);
  return discounts.map((d) => {
    const per = perMemberLimitOf(d);
    const total = totalLimitOf(d);
    const used = mine[d.id]?.used || 0;
    const remainingTotal = total != null ? Math.max(0, total - (totals[d.id] || 0)) : null;
    const remainingForMember = Math.max(0, per - used);
    const soldOut = remainingTotal === 0;
    const exhausted = !!userId && remainingForMember === 0;
    return {
      ...d,
      perMemberLimit: per,
      totalLimit: total,
      limitLabel: limitLabel(d),
      remainingTotal,
      soldOut,
      ...(userId
        ? {
            usedByMember: used,
            remainingForMember: soldOut ? 0 : remainingForMember,
            lastUsedAt: mine[d.id]?.lastUsedAt || null,
            available: !soldOut && !exhausted,
            unavailableReason: soldOut ? 'SOLD_OUT' : exhausted ? 'MEMBER_LIMIT' : null,
          }
        : {}),
    };
  });
}

export type UseItem = { discountId: string; quantity: number };

/** Junta itens repetidos e valida quantidades. Aceita o formato antigo (discountId único). */
export function normalizeUseItems(body: any): UseItem[] {
  const raw: any[] = Array.isArray(body?.items)
    ? body.items
    : Array.isArray(body?.discountIds)
      ? body.discountIds.map((id: any) => ({ discountId: id, quantity: 1 }))
      : body?.discountId
        ? [{ discountId: body.discountId, quantity: body.quantity ?? 1 }]
        : [];
  const merged = new Map<string, number>();
  for (const it of raw) {
    const id = String(it?.discountId || '').trim();
    if (!id) continue;
    const q = it?.quantity == null || it.quantity === '' ? 1 : Number(it.quantity);
    if (!Number.isInteger(q) || q < 1 || q > MAX_PER_MEMBER_LIMIT) {
      throw Object.assign(new Error('Quantidade inválida'), { status: 400 });
    }
    merged.set(id, (merged.get(id) || 0) + q);
  }
  if (merged.size > 20) throw Object.assign(new Error('Promoções demais em um atendimento'), { status: 400 });
  return [...merged.entries()].map(([discountId, quantity]) => ({ discountId, quantity }));
}

/**
 * Grava os usos de um atendimento, substituindo o que já tinha sido registrado nele
 * (o parceiro pode corrigir dentro da janela de edição). Lança PromoLimitError se passar do limite.
 */
export async function registerUses(
  db: any,
  opts: { validationId: string; partnerId: string; userId: string; registeredById?: string | null; items: UseItem[] },
) {
  const { validationId, partnerId, userId, items } = opts;
  return db.$transaction(async (tx: any) => {
    // Trava por associado+promoção (e por promoção, se tiver total): dois caixas não furam o limite.
    // Ordem fixa evita impasse entre transações.
    const ids = [...new Set(items.map((i) => i.discountId))].sort();
    for (const id of ids) {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `promo:${id}:${userId}`);
    }

    const discounts: any[] = ids.length
      ? await tx.$queryRawUnsafe(
          `SELECT id, name, "perMemberLimit", "totalLimit", "isActive", "validFrom", "validUntil", "archivedAt"
             FROM partner_discounts WHERE id = ANY($1::text[]) AND "partnerId" = $2`,
          ids,
          partnerId,
        )
      : [];
    const byId = new Map(discounts.map((d) => [d.id, d]));
    for (const it of items) {
      if (!byId.has(it.discountId)) throw new PromoLimitError('Promoção inválida', 'INVALID_PROMO', it.discountId);
    }
    const withTotal = discounts.filter((d) => totalLimitOf(d) != null);
    for (const d of withTotal.map((x) => x.id).sort()) {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `promo-total:${d}`);
    }

    const mine = await memberUsage(tx, userId, ids, validationId);
    const totals = await totalUsage(tx, withTotal.map((d) => d.id), validationId);
    const now = Date.now();
    for (const it of items) {
      const d = byId.get(it.discountId);
      const active =
        d.isActive !== false &&
        !d.archivedAt &&
        (!d.validFrom || new Date(d.validFrom).getTime() <= now) &&
        (!d.validUntil || new Date(d.validUntil).getTime() >= now);
      if (!active) throw new PromoLimitError(`"${d.name}" não está valendo agora.`, 'PROMO_INACTIVE', d.id);
      const per = perMemberLimitOf(d);
      const left = per - (mine[d.id]?.used || 0);
      if (it.quantity > left) {
        throw new PromoLimitError(
          left <= 0
            ? `Este associado já usou "${d.name}"${per > 1 ? ` (${per} de ${per})` : ''}. Cada associado pode usar ${per === 1 ? 'uma vez' : `${per} vezes`}.`
            : `Para "${d.name}" este associado ainda pode usar ${left}.`,
          'MEMBER_LIMIT',
          d.id,
        );
      }
      const total = totalLimitOf(d);
      if (total != null) {
        const leftTotal = total - (totals[d.id] || 0);
        if (it.quantity > leftTotal) {
          throw new PromoLimitError(
            leftTotal <= 0 ? `"${d.name}" esgotou.` : `Restam só ${leftTotal} de "${d.name}".`,
            'SOLD_OUT',
            d.id,
          );
        }
      }
    }

    await tx.$executeRawUnsafe(`DELETE FROM partner_discount_uses WHERE "validationId" = $1`, validationId);
    for (const it of items) {
      await tx.$executeRawUnsafe(
        `INSERT INTO partner_discount_uses (id, "discountId", "partnerId", "userId", "validationId", quantity, "registeredById")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        crypto.randomUUID(),
        it.discountId,
        partnerId,
        userId,
        validationId,
        it.quantity,
        opts.registeredById || null,
      );
    }
    return { items };
  });
}

import {
  FALLBACK_MEMBERSHIP_PLANS,
  addMonths,
  planMonthsFromCode,
} from './membershipPlans';
import {
  getPagBankOrder,
  isPaidChargeStatus,
  mapPagBankStatusToPayment,
} from './pagbank';

export function isMembershipCurrentlyActive(membership: {
  status?: string | null;
  endDate?: Date | string | null;
}) {
  if (String(membership?.status || '') !== 'ACTIVE') return false;
  if (!membership?.endDate) return false;
  return new Date(membership.endDate).getTime() >= Date.now();
}

let schemaEnsuredAt = 0;
const SCHEMA_TTL_MS = 6 * 60 * 60 * 1000;

export async function ensureMembershipBillingSchema(db: any) {
  if (Date.now() - schemaEnsuredAt < SCHEMA_TTL_MS) return;

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      months INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "order" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )
  `);

  const alterStatements = [
    `ALTER TABLE memberships ADD COLUMN IF NOT EXISTS "planCode" TEXT`,
    `ALTER TABLE memberships ADD COLUMN IF NOT EXISTS "planMonths" INTEGER`,
    `ALTER TABLE memberships ADD COLUMN IF NOT EXISTS "lastPaymentId" TEXT`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS "membershipId" TEXT`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS method TEXT`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS "pixCopyPaste" TEXT`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS "boletoUrl" TEXT`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS "boletoBarcode" TEXT`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS "planCode" TEXT`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS "planMonths" INTEGER`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS "membershipAppliedAt" TIMESTAMP(3)`,
  ];

  for (const sql of alterStatements) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e) {
      // coluna pode já existir em alguns ambientes
    }
  }

  for (const plan of FALLBACK_MEMBERSHIP_PLANS) {
    await db.$executeRawUnsafe(
      `INSERT INTO subscription_plans
        (id, code, name, description, months, amount_cents, "isActive", "order", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW(), NOW())
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         months = EXCLUDED.months,
         amount_cents = EXCLUDED.amount_cents,
         "isActive" = true,
         "order" = EXCLUDED."order",
         "updatedAt" = NOW()`,
      `plan_${plan.code.toLowerCase()}`,
      plan.code,
      plan.name,
      plan.description,
      plan.months,
      plan.amountCents,
      plan.order,
    );
  }

  schemaEnsuredAt = Date.now();
}

/** Assinatura só fica ACTIVE com pagamento MEMBERSHIP aprovado. Doação não conta. */
export async function requirePaidMembership(db: any, membership: any, userId: string) {
  if (!membership) return membership;
  const status = String(membership.status || '');
  if (status !== 'ACTIVE') return membership;

  let paid: any[] = [];
  try {
    paid = await db.$queryRawUnsafe(
      `SELECT id FROM payments
       WHERE "userId" = $1 AND status = 'APPROVED' AND type = 'MEMBERSHIP'
       LIMIT 1`,
      userId,
    );
  } catch {
    paid = [];
  }

  const hasPaid = Boolean(membership.lastPaymentId || paid?.[0]?.id);
  const stillValid = isMembershipCurrentlyActive(membership);
  if (hasPaid && stillValid) return membership;

  try {
    await db.$executeRawUnsafe(
      `UPDATE memberships
       SET status = 'PENDING_PAYMENT', "endDate" = NULL, "updatedAt" = NOW()
       WHERE id = $1`,
      membership.id,
    );
  } catch {
    // ignore
  }

  return {
    ...membership,
    status: 'PENDING_PAYMENT',
    endDate: null,
  };
}

export async function listMembershipPlans(db: any) {
  try {
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT code, name, description, months, amount_cents as "amountCents", "order"
       FROM subscription_plans
       WHERE "isActive" = true
       ORDER BY "order" ASC`,
    );
    if (rows?.length) {
      return rows.map((r) => ({
        code: r.code,
        name: r.name,
        description: r.description,
        months: Number(r.months),
        amountCents: Number(r.amountCents),
        amount: Number(r.amountCents) / 100,
        order: Number(r.order),
      }));
    }
  } catch (e) {
    console.warn('⚠️ Falha ao listar planos no banco, usando fallback', e);
  }

  return FALLBACK_MEMBERSHIP_PLANS.map((p) => ({
    code: p.code,
    name: p.name,
    description: p.description,
    months: p.months,
    amountCents: p.amountCents,
    amount: p.amountCents / 100,
    order: p.order,
  }));
}

export async function getPlanByCode(db: any, code: string) {
  const plans = await listMembershipPlans(db);
  return plans.find((p) => p.code === String(code || '').toUpperCase()) || null;
}

/**
 * Credita os meses do plano a partir de um pagamento aprovado.
 *
 * Idempotente: cada pagamento credita no máximo UMA vez, mesmo que seja chamado em paralelo
 * pelo checkout (cartão aprovado na hora), pelo webhook do PagBank (que pode reenviar) e pelo
 * polling do app. A linha do pagamento é travada (FOR UPDATE) e marcada com
 * "membershipAppliedAt" na mesma transação que estende a assinatura.
 */
export async function activateMembershipFromPayment(db: any, paymentId: string) {
  const result = await db.$transaction(async (tx: any) => {
    const payments: any[] = await tx.$queryRawUnsafe(
      `SELECT id, "userId", "membershipId", status, type, "planCode", "planMonths", amount, method,
              "membershipAppliedAt"
       FROM payments WHERE id = $1 LIMIT 1 FOR UPDATE`,
      paymentId,
    );
    const payment = payments?.[0];
    if (!payment?.userId) {
      return { ok: false, reason: 'payment_not_found' };
    }
    if (String(payment.type) !== 'MEMBERSHIP') {
      return { ok: false, reason: 'not_membership_payment' };
    }

    if (payment.membershipAppliedAt) {
      const current: any[] = await tx.$queryRawUnsafe(
        `SELECT id, "endDate" FROM memberships WHERE "userId" = $1 LIMIT 1`,
        payment.userId,
      );
      return {
        ok: true,
        alreadyApplied: true,
        membershipId: current?.[0]?.id || payment.membershipId || null,
        endDate: current?.[0]?.endDate || null,
        planMonths: Number(payment.planMonths) || null,
      };
    }

    // Duração oficial do plano (ex.: ANNUAL = 12 meses inteiros)
    const monthsFromCode = planMonthsFromCode(payment.planCode);
    const months = Number(monthsFromCode || payment.planMonths || 1);
    if (!Number.isFinite(months) || months < 1) {
      return { ok: false, reason: 'invalid_plan_months' };
    }

    const memberships: any[] = await tx.$queryRawUnsafe(
      `SELECT id, "memberId", "endDate", "qrCode" FROM memberships WHERE "userId" = $1 LIMIT 1 FOR UPDATE`,
      payment.userId,
    );

    let membership = memberships?.[0];
    const now = new Date();

    if (!membership) {
      const membershipId = require('crypto').randomUUID();
      const memberId = `MEM${Date.now().toString().slice(-8)}`;
      const qrCode = `LIGADOBEM|${memberId}|${payment.userId}`;
      const endDate = addMonths(now, months);
      await tx.$executeRawUnsafe(
        `INSERT INTO memberships
          (id, "userId", "memberId", status, "startDate", "endDate",
           "monthlyFee", "nextPayment", "paymentMethod", "qrCode",
           "planCode", "planMonths", "lastPaymentId", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,'ACTIVE',$4,$5,$6,$5,$7,$8,$9,$10,$11,NOW(),NOW())`,
        membershipId,
        payment.userId,
        memberId,
        now,
        endDate,
        Number(payment.amount) || 19.9,
        payment.method || 'PIX',
        qrCode,
        payment.planCode || 'MONTHLY',
        months,
        payment.id,
      );
      membership = { id: membershipId, endDate, memberId, qrCode };
    } else {
      // Se ainda está no período ativo, acumula tempo a partir do fim atual.
      // Se já venceu, começa a contar a partir de agora.
      const currentEnd = membership.endDate ? new Date(membership.endDate) : null;
      const base =
        currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
      const endDate = addMonths(base, months);
      const qrCode =
        membership.qrCode ||
        `LIGADOBEM|${membership.memberId}|${payment.userId}`;

      await tx.$executeRawUnsafe(
        `UPDATE memberships
         SET status = 'ACTIVE',
             "endDate" = $1,
             "nextPayment" = $1,
             "paymentMethod" = $2,
             "monthlyFee" = $3,
             "planCode" = $4,
             "planMonths" = $5,
             "lastPaymentId" = $6,
             "qrCode" = $7,
             "updatedAt" = NOW()
         WHERE id = $8`,
        endDate,
        payment.method || 'PIX',
        Number(payment.amount) || 19.9,
        payment.planCode || 'MONTHLY',
        months,
        payment.id,
        qrCode,
        membership.id,
      );
      membership = { ...membership, endDate, qrCode };
    }

    await tx.$executeRawUnsafe(
      `UPDATE payments
       SET status = 'APPROVED',
           "paidAt" = COALESCE("paidAt", NOW()),
           "membershipId" = COALESCE("membershipId", $2),
           "planMonths" = $3,
           "membershipAppliedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE id = $1`,
      payment.id,
      membership.id,
      months,
    );

    return {
      ok: true,
      alreadyApplied: false,
      membershipId: membership.id,
      endDate: membership.endDate,
      planMonths: months,
      userId: payment.userId,
      amount: Number(payment.amount) || 0,
      planCode: payment.planCode || '',
    };
  });

  // Lançamento financeiro só quando o crédito acabou de acontecer (fora da transação:
  // a tabela transactions pode ter constraints diferentes por ambiente).
  if (result?.ok && result.alreadyApplied === false) {
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO transactions
          (id, "userId", amount, type, status, description, "paymentId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'MEMBERSHIP', 'COMPLETED', $4, $5, NOW(), NOW())`,
        require('crypto').randomUUID(),
        result.userId,
        result.amount,
        `Assinatura ${result.planCode} (${result.planMonths} meses)`.replace(/\s+/g, ' ').trim(),
        paymentId,
      );
    } catch {
      // transactions pode ter constraints diferentes
    }
  }

  if (!result?.ok) return result;
  return {
    ok: true,
    alreadyApplied: result.alreadyApplied,
    membershipId: result.membershipId,
    endDate: result.endDate,
    planMonths: result.planMonths,
  };
}

export async function syncPaymentFromPagBank(db: any, paymentId: string) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT id, "gatewayId", status FROM payments WHERE id = $1 LIMIT 1`,
    paymentId,
  );
  const payment = rows?.[0];
  if (!payment?.gatewayId) return { ok: false, reason: 'no_gateway' };

  const order = await getPagBankOrder(payment.gatewayId);
  const mapped = mapPagBankStatusToPayment(order.chargeStatus || order.status);

  if (mapped === 'APPROVED' || isPaidChargeStatus(order.chargeStatus)) {
    return activateMembershipFromPayment(db, payment.id);
  }

  if (mapped !== 'PENDING' && payment.status === 'PENDING') {
    await db.$executeRawUnsafe(
      `UPDATE payments SET status = $1::"PaymentStatus", "updatedAt" = NOW(), "gatewayData" = $2::jsonb WHERE id = $3`,
      mapped,
      JSON.stringify(order.raw || {}),
      payment.id,
    );
  }

  return { ok: true, status: mapped, order };
}

import {
  FALLBACK_MEMBERSHIP_PLANS,
  addMonths,
} from './membershipPlans';
import {
  getPagBankOrder,
  isPaidChargeStatus,
  mapPagBankStatusToPayment,
} from './pagbank';

export async function ensureMembershipBillingSchema(db: any) {
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
}

export async function listMembershipPlans(db: any) {
  try {
    await ensureMembershipBillingSchema(db);
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

export async function activateMembershipFromPayment(db: any, paymentId: string) {
  const payments: any[] = await db.$queryRawUnsafe(
    `SELECT id, "userId", "membershipId", status, "planCode", "planMonths", amount, method
     FROM payments WHERE id = $1 LIMIT 1`,
    paymentId,
  );
  const payment = payments?.[0];
  if (!payment?.userId) {
    return { ok: false, reason: 'payment_not_found' };
  }
  if (payment.status === 'APPROVED') {
    // já aprovado — ainda assim garantir membership ativa
  }

  const months = Number(payment.planMonths || 1);
  const memberships: any[] = await db.$queryRawUnsafe(
    `SELECT id, "endDate" FROM memberships WHERE "userId" = $1 LIMIT 1`,
    payment.userId,
  );

  let membership = memberships?.[0];
  if (!membership) {
    const membershipId = require('crypto').randomUUID();
    const memberId = `MEM${Date.now().toString().slice(-8)}`;
    const qrCode = `LIGADOBEM|${memberId}|${payment.userId}`;
    const endDate = addMonths(new Date(), months);
    await db.$executeRawUnsafe(
      `INSERT INTO memberships
        (id, "userId", "memberId", status, "startDate", "endDate",
         "monthlyFee", "nextPayment", "paymentMethod", "qrCode",
         "planCode", "planMonths", "lastPaymentId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,'ACTIVE',NOW(),$4,$5,$4,$6,$7,$8,$9,$10,NOW(),NOW())`,
      membershipId,
      payment.userId,
      memberId,
      endDate,
      Number(payment.amount) || 19.9,
      payment.method || 'PIX',
      qrCode,
      payment.planCode || 'MONTHLY',
      months,
      payment.id,
    );
    membership = { id: membershipId, endDate };
  } else {
    const base =
      membership.endDate && new Date(membership.endDate).getTime() > Date.now()
        ? new Date(membership.endDate)
        : new Date();
    const endDate = addMonths(base, months);
    await db.$executeRawUnsafe(
      `UPDATE memberships
       SET status = 'ACTIVE',
           "endDate" = $1,
           "nextPayment" = $1,
           "paymentMethod" = $2,
           "monthlyFee" = $3,
           "planCode" = $4,
           "planMonths" = $5,
           "lastPaymentId" = $6,
           "updatedAt" = NOW()
       WHERE id = $7`,
      endDate,
      payment.method || 'PIX',
      Number(payment.amount) || 19.9,
      payment.planCode || 'MONTHLY',
      months,
      payment.id,
      membership.id,
    );
  }

  await db.$executeRawUnsafe(
    `UPDATE payments
     SET status = 'APPROVED',
         "paidAt" = COALESCE("paidAt", NOW()),
         "membershipId" = COALESCE("membershipId", $2),
         "updatedAt" = NOW()
     WHERE id = $1`,
    payment.id,
    membership.id,
  );

  try {
    await db.$executeRawUnsafe(
      `INSERT INTO transactions
        (id, "userId", amount, type, status, description, "paymentId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'MEMBERSHIP', 'COMPLETED', $4, $5, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      require('crypto').randomUUID(),
      payment.userId,
      Number(payment.amount) || 0,
      `Assinatura ${payment.planCode || ''}`.trim(),
      payment.id,
    );
  } catch {
    // transactions pode ter constraints diferentes
  }

  return { ok: true, membershipId: membership.id };
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

/**
 * Doações pagas pelo PagBank (PIX, boleto, cartão).
 *
 * Fluxo: donations (PENDING) + payments (type DONATION, gatewayData.donationId) →
 * webhook/polling confirma no PagBank → approveDonationFromPayment marca os dois como
 * APPROVED e lança em transactions (transparência). Idempotente: a doação só passa para
 * APPROVED uma vez (UPDATE ... WHERE status <> 'APPROVED' RETURNING), dentro de transação
 * com a linha do pagamento travada.
 */

function donationIdFrom(gatewayData: any): string | null {
  if (!gatewayData) return null;
  const data = typeof gatewayData === 'string' ? safeJson(gatewayData) : gatewayData;
  return data?.donationId ? String(data.donationId) : null;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function approveDonationFromPayment(db: any, paymentId: string) {
  const result = await db.$transaction(async (tx: any) => {
    const rows: any[] = await tx.$queryRawUnsafe(
      `SELECT id, type, "userId", amount, "gatewayData" FROM payments WHERE id = $1 LIMIT 1 FOR UPDATE`,
      paymentId,
    );
    const payment = rows?.[0];
    if (!payment) return { ok: false, reason: 'payment_not_found' };
    if (String(payment.type) !== 'DONATION') return { ok: false, reason: 'not_donation_payment' };

    await tx.$executeRawUnsafe(
      `UPDATE payments SET status = 'APPROVED', "paidAt" = COALESCE("paidAt", NOW()), "updatedAt" = NOW()
       WHERE id = $1`,
      paymentId,
    );

    const donationId = donationIdFrom(payment.gatewayData) || '';
    const updated: any[] = await tx.$queryRawUnsafe(
      `UPDATE donations SET status = 'APPROVED', "updatedAt" = NOW()
       WHERE (id = $1 OR "transactionId" = $2) AND status <> 'APPROVED'
       RETURNING id, "userId", amount`,
      donationId,
      paymentId,
    );
    return {
      ok: true,
      newlyApproved: updated.length > 0,
      donationId: updated?.[0]?.id || donationId || null,
      userId: updated?.[0]?.userId || payment.userId || null,
      amount: Number(updated?.[0]?.amount ?? payment.amount) || 0,
    };
  });

  if (result?.ok && result.newlyApproved) {
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO transactions
          (id, "userId", amount, type, status, description, "paymentId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'DONATION', 'COMPLETED', $4, $5, NOW(), NOW())`,
        require('crypto').randomUUID(),
        result.userId,
        result.amount,
        'Doação via PagBank',
        paymentId,
      );
    } catch {
      // transactions pode ter constraints diferentes por ambiente
    }
  }
  return result;
}

/** Reflete na doação um status final que não é aprovação (recusado, cancelado, expirado). */
export async function syncDonationFailure(db: any, paymentId: string, status: string) {
  if (!['REJECTED', 'CANCELLED', 'EXPIRED'].includes(status)) return;
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT type, "gatewayData" FROM payments WHERE id = $1 LIMIT 1`,
    paymentId,
  );
  if (String(rows?.[0]?.type) !== 'DONATION') return;
  await db.$executeRawUnsafe(
    `UPDATE donations SET status = $1::"PaymentStatus", "updatedAt" = NOW()
     WHERE (id = $2 OR "transactionId" = $3) AND status = 'PENDING'`,
    status,
    donationIdFrom(rows[0].gatewayData) || '',
    paymentId,
  );
}

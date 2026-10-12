/**
 * Baixa de pagamento da notificação paga do parceiro (separado para não criar import circular
 * com membershipBilling, que despacha os pagamentos aprovados por tipo).
 */

/** Pagamento PARTNER_PUSH aprovado → campanha vai para a fila de aprovação do admin. Idempotente. */
export async function markPartnerPushPaid(db: any, paymentId: string) {
  return db.$transaction(async (tx: any) => {
    const rows: any[] = await tx.$queryRawUnsafe(
      `SELECT id, status, "gatewayData" FROM payments WHERE id = $1 FOR UPDATE`,
      paymentId,
    );
    const p = rows?.[0];
    if (!p) return { ok: false, reason: 'payment_not_found' };
    const campaignId = p.gatewayData?.campaignId;
    if (p.status !== 'APPROVED') {
      await tx.$executeRawUnsafe(
        `UPDATE payments SET status = 'APPROVED', "paidAt" = COALESCE("paidAt", NOW()), "updatedAt" = NOW() WHERE id = $1`,
        paymentId,
      );
    }
    if (!campaignId) return { ok: false, reason: 'no_campaign' };
    const upd: any[] = await tx.$queryRawUnsafe(
      `UPDATE partner_push_campaigns
          SET status = 'PENDING_REVIEW', "paidAt" = NOW(), "paymentId" = $2, "updatedAt" = NOW()
        WHERE id = $1 AND status = 'AWAITING_PAYMENT'
        RETURNING id`,
      campaignId,
      paymentId,
    );
    return { ok: true, campaignId, alreadyApplied: !upd?.length };
  });
}

/**
 * Notificação paga do parceiro: o parceiro escreve a mensagem, paga (PIX ou cartão pelo PagBank),
 * o admin aprova e ela vai para todos os membros (push + caixa de notificações do app).
 * Reprovada depois de paga → estorno automático no PagBank (ou aviso de estorno manual).
 *
 * Status: AWAITING_PAYMENT → PENDING_REVIEW → SENDING → SENT
 *                       ↘ CANCELLED          ↘ REJECTED (refundStatus: REFUNDED | REFUND_FAILED)
 */
import crypto from 'crypto';
import {
  createPagBankOrder,
  getPagBankConfig,
  getPagBankCardPublicKey,
  isPaidChargeStatus,
  cancelPagBankCharge,
} from './pagbank';
import { syncPaymentFromPagBank } from './membershipBilling';
import { markPartnerPushPaid } from './partnerPushSettle';
import { sendFcmToTokens } from './push';

export const PUSH_DEFAULTS = { priceCents: 2990, weeklyLimit: 1, enabled: true };
const TITLE_MAX = 50;
const BODY_MAX = 180;

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

let ensuredAt = 0;
export async function ensurePartnerPushSchema(db: any) {
  if (Date.now() - ensuredAt < 6 * 60 * 60 * 1000) return;
  // ADD VALUE não pode rodar dentro de transação: vai sozinho.
  await db.$executeRawUnsafe(`ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'PARTNER_PUSH'`);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS partner_push_campaigns (
      id TEXT PRIMARY KEY,
      "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      "createdById" TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      "discountId" TEXT,
      "priceCents" INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
      "paymentId" TEXT,
      "paidAt" TIMESTAMP(3),
      "reviewedById" TEXT,
      "reviewNote" TEXT,
      "reviewedAt" TIMESTAMP(3),
      "sentAt" TIMESTAMP(3),
      recipients INTEGER,
      "pushSuccess" INTEGER,
      "refundStatus" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )`);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS partner_push_campaigns_partner_idx ON partner_push_campaigns("partnerId", "createdAt")`,
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS partner_push_campaigns_status_idx ON partner_push_campaigns(status)`,
  );
  ensuredAt = Date.now();
}

// ---------------------------------------------------------------- configurações (system_config)

const KEYS = {
  priceCents: 'partner_push_price_cents',
  weeklyLimit: 'partner_push_weekly_limit',
  enabled: 'partner_push_enabled',
};

export async function getPushSettings(db: any) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT key, value FROM system_config WHERE key = ANY($1::text[])`,
    Object.values(KEYS),
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const price = parseInt(map[KEYS.priceCents], 10);
  const limit = parseInt(map[KEYS.weeklyLimit], 10);
  return {
    priceCents: Number.isFinite(price) && price >= 100 ? price : PUSH_DEFAULTS.priceCents,
    weeklyLimit: Number.isFinite(limit) && limit >= 1 ? limit : PUSH_DEFAULTS.weeklyLimit,
    enabled: map[KEYS.enabled] === undefined ? PUSH_DEFAULTS.enabled : map[KEYS.enabled] === 'true',
  };
}

async function setConfig(db: any, key: string, value: string, type: 'NUMBER' | 'BOOLEAN') {
  const n = await db.$executeRawUnsafe(
    `UPDATE system_config SET value = $2, "updatedAt" = NOW() WHERE key = $1`,
    key,
    value,
  );
  if (!n) {
    await db.$executeRawUnsafe(
      `INSERT INTO system_config (id, key, value, type, "isPublic", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::"ConfigType", false, NOW(), NOW())`,
      crypto.randomUUID(),
      key,
      value,
      type,
    );
  }
}

// ---------------------------------------------------------------- helpers

function formatCampaign(c: any) {
  return {
    id: c.id,
    title: c.title,
    body: c.body,
    discountId: c.discountId,
    priceCents: c.priceCents,
    price: c.priceCents / 100,
    status: c.status,
    paymentId: c.paymentId,
    paidAt: c.paidAt,
    reviewNote: c.reviewNote,
    reviewedAt: c.reviewedAt,
    sentAt: c.sentAt,
    recipients: c.recipients,
    refundStatus: c.refundStatus,
    createdAt: c.createdAt,
    partnerName: c.partnerName,
  };
}

/** Texto final do push: o nome da empresa vai no título (transparência para o membro). */
export function buildPushText(partnerName: string, title: string, body: string) {
  const t = `${partnerName} · ${title}`;
  return { title: t.length > 65 ? `${t.slice(0, 64)}…` : t, body };
}

async function nextAllowedAt(db: any, partnerId: string, weeklyLimit: number) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT "createdAt" FROM partner_push_campaigns
      WHERE "partnerId" = $1 AND status IN ('PENDING_REVIEW','SENDING','SENT')
        AND "createdAt" > NOW() - INTERVAL '7 days'
      ORDER BY "createdAt" ASC`,
    partnerId,
  );
  if (rows.length < weeklyLimit) return null;
  return new Date(new Date(rows[0].createdAt).getTime() + 7 * 864e5);
}

async function loadCampaign(db: any, id: string, partnerId?: string) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT c.*, p.name AS "partnerName" FROM partner_push_campaigns c JOIN partners p ON p.id = c."partnerId"
      WHERE c.id = $1 ${partnerId ? 'AND c."partnerId" = $2' : ''}`,
    ...(partnerId ? [id, partnerId] : [id]),
  );
  return rows?.[0] || null;
}

async function paymentView(db: any, paymentId: string | null) {
  if (!paymentId) return null;
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT id, status, method, amount, "pixCopyPaste", "qrCode", "expiresAt" FROM payments WHERE id = $1`,
    paymentId,
  );
  const p = rows?.[0];
  if (!p) return null;
  return {
    id: p.id,
    status: p.status,
    method: p.method,
    amount: Number(p.amount),
    pixCopyPaste: p.pixCopyPaste,
    pixQrImage: p.qrCode,
    pixExpiration: p.expiresAt,
  };
}

/** Avisa o parceiro no App Parceiros (só aparelhos android-partner). */
async function notifyPartner(db: any, partnerId: string, title: string, body: string) {
  try {
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT t.token FROM device_tokens t JOIN partner_accounts a ON a."userId" = t."userId"
        WHERE a."partnerId" = $1 AND t."isActive" = true AND t.platform = 'android-partner'`,
      partnerId,
    );
    await sendFcmToTokens(rows.map((r) => r.token), { title, body, data: { screen: 'PushCampaigns' } });
  } catch (e) {
    console.warn('⚠️ Aviso ao parceiro falhou:', (e as any)?.message);
  }
}

// ---------------------------------------------------------------- rotas do parceiro

export async function handlePartnerPushRoutes(
  ctx: { req: any; res: any; path: string; method: string; body: any; db: any },
  acc: { id: string; role: string; partnerId: string },
  userId: string,
): Promise<boolean> {
  const { path, method, res, db } = ctx;
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};
  const base = '/api/partner/push-campaigns';
  if (!path.startsWith(base) && path !== '/api/partner/card-public-key') return false;
  await ensurePartnerPushSchema(db);

  if (path === '/api/partner/card-public-key' && method === 'GET') {
    res.status(200).json({ publicKey: await getPagBankCardPublicKey(), env: getPagBankConfig().env });
    return true;
  }

  const settings = await getPushSettings(db);

  if (path === base && method === 'GET') {
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT * FROM partner_push_campaigns WHERE "partnerId" = $1 ORDER BY "createdAt" DESC LIMIT 50`,
      acc.partnerId,
    );
    const audience: any[] = await db.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT "userId")::int AS n FROM device_tokens WHERE "isActive" = true AND platform <> 'android-partner'`,
    );
    const next = await nextAllowedAt(db, acc.partnerId, settings.weeklyLimit);
    res.status(200).json({
      campaigns: rows.map(formatCampaign),
      settings: { ...settings, price: settings.priceCents / 100 },
      audience: audience?.[0]?.n || 0,
      nextAllowedAt: next,
      limits: { titleMax: TITLE_MAX, bodyMax: BODY_MAX },
    });
    return true;
  }

  if (acc.role !== 'OWNER') throw new HttpError(403, 'Apenas o responsável pela empresa pode fazer isso.', 'OWNER_ONLY');

  if (path === base && method === 'POST') {
    if (!settings.enabled) throw new HttpError(403, 'As notificações pagas estão pausadas no momento.', 'DISABLED');
    const title = String(body.title || '').trim();
    const text = String(body.body || '').trim();
    if (title.length < 3 || title.length > TITLE_MAX) throw new HttpError(400, `O título precisa ter de 3 a ${TITLE_MAX} caracteres.`);
    if (text.length < 10 || text.length > BODY_MAX) throw new HttpError(400, `A mensagem precisa ter de 10 a ${BODY_MAX} caracteres.`);
    if (/https?:\/\/|www\./i.test(`${title} ${text}`)) {
      throw new HttpError(400, 'Links não são permitidos na notificação. O membro abre a página da sua empresa no app.');
    }
    const open: any[] = await db.$queryRawUnsafe(
      `SELECT id FROM partner_push_campaigns WHERE "partnerId" = $1 AND status IN ('AWAITING_PAYMENT','PENDING_REVIEW','SENDING')`,
      acc.partnerId,
    );
    if (open.length) {
      throw new HttpError(409, 'Você já tem uma notificação em andamento. Conclua ou cancele antes de criar outra.', 'OPEN_CAMPAIGN');
    }
    const next = await nextAllowedAt(db, acc.partnerId, settings.weeklyLimit);
    if (next) {
      throw new HttpError(
        429,
        `Limite de ${settings.weeklyLimit} notificação(ões) por semana atingido. Próxima liberada em ${next.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
        'WEEKLY_LIMIT',
      );
    }
    let discountId: string | null = null;
    if (body.discountId) {
      const ok: any[] = await db.$queryRawUnsafe(
        `SELECT id FROM partner_discounts WHERE id = $1 AND "partnerId" = $2 AND "archivedAt" IS NULL`,
        String(body.discountId),
        acc.partnerId,
      );
      if (!ok[0]) throw new HttpError(400, 'Promoção inválida');
      discountId = ok[0].id;
    }
    const id = crypto.randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO partner_push_campaigns (id, "partnerId", "createdById", title, body, "discountId", "priceCents")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      id, acc.partnerId, userId, title, text, discountId, settings.priceCents,
    );
    res.status(201).json({ campaign: formatCampaign(await loadCampaign(db, id)) });
    return true;
  }

  const m = path.match(/^\/api\/partner\/push-campaigns\/([^/]+)(\/checkout|\/cancel)?$/);
  if (!m) throw new HttpError(404, 'Rota não encontrada');
  const campaign = await loadCampaign(db, m[1], acc.partnerId);
  if (!campaign) throw new HttpError(404, 'Notificação não encontrada');

  if (!m[2] && method === 'GET') {
    let c = campaign;
    let payment = await paymentView(db, c.paymentId);
    if (c.status === 'AWAITING_PAYMENT' && payment?.status === 'PENDING') {
      try {
        await syncPaymentFromPagBank(db, payment.id);
        c = await loadCampaign(db, c.id);
        payment = await paymentView(db, c.paymentId);
      } catch (e) {
        console.warn('⚠️ Sync do pagamento da notificação falhou:', (e as any)?.message);
      }
    }
    res.status(200).json({ campaign: formatCampaign(c), payment });
    return true;
  }

  if (m[2] === '/cancel' && method === 'POST') {
    const n = await db.$executeRawUnsafe(
      `UPDATE partner_push_campaigns SET status = 'CANCELLED', "updatedAt" = NOW() WHERE id = $1 AND status = 'AWAITING_PAYMENT'`,
      campaign.id,
    );
    if (!n) throw new HttpError(409, 'Só dá para cancelar antes do pagamento. Depois de pago, fale com a Liga do Bem.');
    res.status(200).json({ message: 'Notificação cancelada' });
    return true;
  }

  if (m[2] === '/checkout' && method === 'POST') {
    if (campaign.status !== 'AWAITING_PAYMENT') throw new HttpError(409, 'Esta notificação já foi paga ou encerrada.');
    if (!getPagBankConfig().configured) throw new HttpError(503, 'Pagamentos ainda não configurados.');
    const payMethod = String(body.method || 'PIX').toUpperCase();
    if (!['PIX', 'CREDIT_CARD'].includes(payMethod)) throw new HttpError(400, 'Use PIX ou cartão de crédito.');
    if (payMethod === 'CREDIT_CARD' && !body.card?.encrypted) throw new HttpError(400, 'Dados do cartão ausentes.', 'CARD_ENCRYPTION_REQUIRED');
    const taxId = String(body.taxId || '').replace(/\D/g, '');
    if (taxId.length !== 11 && taxId.length !== 14) throw new HttpError(400, 'Informe o CPF ou CNPJ de quem paga.', 'TAX_ID_REQUIRED');

    // Reaproveita um PIX ainda válido em vez de gerar outro
    if (payMethod === 'PIX' && campaign.paymentId) {
      const prev = await paymentView(db, campaign.paymentId);
      if (prev?.status === 'PENDING' && prev.method === 'PIX' && prev.pixCopyPaste &&
          (!prev.pixExpiration || new Date(prev.pixExpiration).getTime() > Date.now() + 60e3)) {
        res.status(200).json({ campaign: formatCampaign(campaign), payment: prev, reused: true });
        return true;
      }
    }

    const users: any[] = await db.$queryRawUnsafe(`SELECT name, email, phone FROM users WHERE id = $1`, userId);
    const payer = users[0];
    const amountCents = campaign.priceCents;
    const paymentId = crypto.randomUUID();
    const apiBase = process.env.API_PUBLIC_URL || process.env.BACKEND_URL || 'https://nova-versao-liga-do-bem.vercel.app';
    let order;
    try {
      order = await createPagBankOrder({
        referenceId: `PUSH-${paymentId.slice(0, 8)}`,
        amountCents,
        description: 'Notificação para membros — Liga do Bem',
        customer: { name: payer?.name || campaign.partnerName, email: payer?.email, taxId, phone: payer?.phone },
        method: payMethod as any,
        notificationUrl: `${apiBase.replace(/\/$/, '')}/api/webhooks/pagbank`,
        card: payMethod === 'CREDIT_CARD' ? { encrypted: body.card.encrypted, holderName: body.card.holderName || payer?.name } : undefined,
        installments: 1,
      });
    } catch (e: any) {
      console.error('❌ PagBank notificação paga:', e?.payload || e?.message);
      throw new HttpError(502, e?.message || 'Falha ao gerar o pagamento no PagBank');
    }
    const paid = isPaidChargeStatus(order.chargeStatus);
    const declined = ['DECLINED', 'CANCELED', 'CANCELLED'].includes(String(order.chargeStatus || '').toUpperCase());
    await db.$executeRawUnsafe(
      `INSERT INTO payments
        (id, amount, description, type, status, gateway, "gatewayId", "qrCode", "expiresAt", "gatewayData",
         "userEmail", "userName", "userPhone", "userId", method, "pixCopyPaste", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'PARTNER_PUSH', $4::"PaymentStatus", 'PAGBANK', $5, $6, $7, $8::jsonb,
         $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
      paymentId, amountCents / 100, `Notificação paga — ${campaign.partnerName}`, declined ? 'REJECTED' : 'PENDING',
      order.id, order.pixQrImage || null, order.pixExpiration ? new Date(order.pixExpiration) : null,
      JSON.stringify({ ...(order.raw || {}), campaignId: campaign.id, partnerId: acc.partnerId }),
      payer?.email || null, payer?.name || null, payer?.phone || null, userId, payMethod, order.pixCopyPaste || null,
    );
    await db.$executeRawUnsafe(
      `UPDATE partner_push_campaigns SET "paymentId" = $2, "updatedAt" = NOW() WHERE id = $1 AND status = 'AWAITING_PAYMENT'`,
      campaign.id,
      paymentId,
    );
    if (paid) await markPartnerPushPaid(db, paymentId);
    const c = await loadCampaign(db, campaign.id);
    res.status(200).json({
      campaign: formatCampaign(c),
      payment: await paymentView(db, paymentId),
      message: paid
        ? 'Pagamento aprovado! A Liga do Bem vai revisar e enviar sua notificação.'
        : declined
          ? 'Pagamento recusado pelo emissor do cartão.'
          : 'PIX gerado. A confirmação é automática assim que você pagar.',
    });
    return true;
  }

  throw new HttpError(404, 'Rota não encontrada');
}

// ---------------------------------------------------------------- rotas do admin

export async function handleAdminPushRoutes(
  ctx: { req: any; res: any; path: string; method: string; body: any; db: any },
  adminId: string,
): Promise<boolean> {
  const { path, method, res, db } = ctx;
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};
  if (!path.startsWith('/api/admin/partner-push-')) return false;
  await ensurePartnerPushSchema(db);

  if (path === '/api/admin/partner-push-settings' && method === 'GET') {
    res.status(200).json({ settings: await getPushSettings(db) });
    return true;
  }
  if (path === '/api/admin/partner-push-settings' && method === 'PUT') {
    if (body.priceCents !== undefined) {
      const v = parseInt(body.priceCents, 10);
      if (!Number.isFinite(v) || v < 100 || v > 1000000) throw new HttpError(400, 'Preço inválido (mínimo R$ 1,00)');
      await setConfig(db, KEYS.priceCents, String(v), 'NUMBER');
    }
    if (body.weeklyLimit !== undefined) {
      const v = parseInt(body.weeklyLimit, 10);
      if (!Number.isFinite(v) || v < 1 || v > 50) throw new HttpError(400, 'Limite semanal inválido (1 a 50)');
      await setConfig(db, KEYS.weeklyLimit, String(v), 'NUMBER');
    }
    if (body.enabled !== undefined) await setConfig(db, KEYS.enabled, body.enabled ? 'true' : 'false', 'BOOLEAN');
    res.status(200).json({ settings: await getPushSettings(db) });
    return true;
  }

  if (path === '/api/admin/partner-push-campaigns' && method === 'GET') {
    const status = ctx.req.query?.status ? String(ctx.req.query.status) : null;
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT c.*, p.name AS "partnerName" FROM partner_push_campaigns c JOIN partners p ON p.id = c."partnerId"
        WHERE ($1::text IS NULL OR c.status = $1) AND c.status <> 'CANCELLED'
        ORDER BY CASE c.status WHEN 'PENDING_REVIEW' THEN 0 ELSE 1 END, c."createdAt" DESC LIMIT 100`,
      status,
    );
    res.status(200).json({ campaigns: rows.map(formatCampaign) });
    return true;
  }

  const m = path.match(/^\/api\/admin\/partner-push-campaigns\/([^/]+)\/(approve|reject)$/);
  if (m && method === 'POST') {
    const id = m[1];
    if (m[2] === 'approve') {
      // Trava: só uma aprovação consegue mudar PENDING_REVIEW → SENDING
      const locked: any[] = await db.$queryRawUnsafe(
        `UPDATE partner_push_campaigns SET status = 'SENDING', "reviewedById" = $2, "reviewedAt" = NOW(), "updatedAt" = NOW()
          WHERE id = $1 AND status = 'PENDING_REVIEW' RETURNING id`,
        id,
        adminId,
      );
      if (!locked.length) throw new HttpError(409, 'Esta notificação não está aguardando aprovação.');
      const c = await loadCampaign(db, id);
      const text = buildPushText(c.partnerName, c.title, c.body);
      const data = { screen: 'Parceiros', partnerId: c.partnerId, campaignId: c.id };
      const recipients = await db.$executeRawUnsafe(
        `INSERT INTO notifications (id, "userId", title, message, type, data, "isRead", "sentAt")
         SELECT gen_random_uuid()::text, u.id, $1, $2, 'GENERAL'::"NotificationType", $3::jsonb, false, NOW()
           FROM users u WHERE u."isActive" = true AND u.role <> 'PARTNER'`,
        text.title,
        text.body,
        JSON.stringify(data),
      );
      const tokens: any[] = await db.$queryRawUnsafe(
        `SELECT t.token FROM device_tokens t JOIN users u ON u.id = t."userId"
          WHERE t."isActive" = true AND t.platform <> 'android-partner' AND u."isActive" = true`,
      );
      const push = await sendFcmToTokens(tokens.map((t) => t.token), {
        title: text.title,
        body: text.body,
        data: { type: 'GENERAL', screen: 'Parceiros', partnerId: String(c.partnerId) },
      });
      await db.$executeRawUnsafe(
        `UPDATE partner_push_campaigns SET status = 'SENT', "sentAt" = NOW(), recipients = $2, "pushSuccess" = $3, "updatedAt" = NOW() WHERE id = $1`,
        id,
        Number(recipients) || 0,
        push.success,
      );
      await notifyPartner(db, c.partnerId, 'Sua notificação foi enviada! 🎉', `"${c.title}" foi enviada para os membros da Liga do Bem.`);
      res.status(200).json({ message: 'Notificação enviada', recipients: Number(recipients) || 0, pushAttempted: push.attempted, pushSuccess: push.success });
      return true;
    }

    // reprovar + estornar
    const note = String(body.note || '').trim().slice(0, 300);
    if (note.length < 5) throw new HttpError(400, 'Explique o motivo para o parceiro (mín. 5 caracteres).');
    const locked: any[] = await db.$queryRawUnsafe(
      `UPDATE partner_push_campaigns SET status = 'REJECTED', "reviewNote" = $3, "reviewedById" = $2, "reviewedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = $1 AND status = 'PENDING_REVIEW' RETURNING id, "paymentId", "priceCents", "partnerId", title`,
      id,
      adminId,
      note,
    );
    if (!locked.length) throw new HttpError(409, 'Esta notificação não está aguardando aprovação.');
    const c = locked[0];
    let refundStatus = 'REFUND_FAILED';
    let refundError: string | null = null;
    try {
      const pay: any[] = await db.$queryRawUnsafe(`SELECT "gatewayData" FROM payments WHERE id = $1`, c.paymentId);
      const chargeId = pay?.[0]?.gatewayData?.charges?.[0]?.id;
      if (!chargeId) throw new Error('cobrança não encontrada no pagamento');
      const r = await cancelPagBankCharge(chargeId, c.priceCents);
      refundStatus = 'REFUNDED';
      await db.$executeRawUnsafe(
        `UPDATE payments SET status = 'CANCELLED', "updatedAt" = NOW(),
                "gatewayData" = COALESCE("gatewayData", '{}'::jsonb) || $2::jsonb WHERE id = $1`,
        c.paymentId,
        JSON.stringify({ refund: { at: new Date().toISOString(), status: r.status } }),
      );
    } catch (e: any) {
      refundError = e?.message || 'falha no estorno';
      console.error('❌ Estorno da notificação paga falhou:', refundError);
    }
    await db.$executeRawUnsafe(
      `UPDATE partner_push_campaigns SET "refundStatus" = $2, "updatedAt" = NOW() WHERE id = $1`,
      id,
      refundStatus,
    );
    await notifyPartner(
      db,
      c.partnerId,
      'Notificação não aprovada',
      `"${c.title}": ${note}${refundStatus === 'REFUNDED' ? ' O valor foi estornado.' : ''}`,
    );
    res.status(200).json({
      message: refundStatus === 'REFUNDED' ? 'Reprovada e estornada' : 'Reprovada, mas o estorno automático falhou: estorne manualmente no PagBank',
      refundStatus,
      refundError,
    });
    return true;
  }

  throw new HttpError(404, 'Rota não encontrada');
}

export { HttpError as PushHttpError };

/**
 * Notificação paga do parceiro: o parceiro escreve a mensagem, paga (PIX ou cartão pelo PagBank),
 * o admin aprova e ela vai para todos os membros (push + caixa de notificações do app).
 * Reprovada depois de paga → estorno automático no PagBank (ou aviso de estorno manual).
 *
 * Agendamento: o parceiro escolhe um HORÁRIO (vaga) — cada vaga recebe só UMA notificação, então
 * duas empresas nunca disparam juntas e o membro não recebe várias de uma vez. A vaga fica
 * reservada enquanto o PIX está válido; depois de paga, só sai da fila se for reprovada.
 * O envio acontece no horário pelo despachante (dispatchDuePushCampaigns), chamado por um
 * agendador externo (GitHub Actions, a cada 10 min) e também quando o app abre a lista de parceiros.
 *
 * Status: AWAITING_PAYMENT → PENDING_REVIEW → SCHEDULED → SENDING → SENT
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
import { markSchemaApplied, schemaApplied, schemaFingerprint } from './schemaOnce';

export const PUSH_DEFAULTS = {
  priceCents: 2990,
  weeklyLimit: 1,
  enabled: true,
  slots: ['09:00', '12:00', '15:00', '18:00', '20:00'],
};
/** Antecedência mínima para escolher um horário (pagar + a Liga revisar). */
export const SLOT_LEAD_HOURS = 3;
export const SLOT_DAYS_AHEAD = 14;
/** Quanto tempo a vaga fica guardada esperando o pagamento (o PIX vale 60 min). */
export const SLOT_HOLD_MINUTES = 70;
const BRT_OFFSET = '-03:00';
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
  const fp = schemaFingerprint(ensurePartnerPushSchema.toString());
  if (!(await schemaApplied(db, 'partnerPush', fp))) {
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
    await db.$executeRawUnsafe(`ALTER TABLE partner_push_campaigns ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3)`);
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS partner_push_campaigns_sched_idx ON partner_push_campaigns("scheduledFor")`,
    );
    await markSchemaApplied(db, 'partnerPush', fp);
  }
  ensuredAt = Date.now();
}

// ---------------------------------------------------------------- configurações (system_config)

const KEYS = {
  priceCents: 'partner_push_price_cents',
  weeklyLimit: 'partner_push_weekly_limit',
  enabled: 'partner_push_enabled',
  slots: 'partner_push_slots',
};

export function parseSlotTimes(v: any): string[] | null {
  const list = String(v || '')
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!list.length) return null;
  const ok = list.every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t));
  if (!ok) return null;
  return Array.from(new Set(list)).sort();
}

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
    slots: parseSlotTimes(map[KEYS.slots]) || PUSH_DEFAULTS.slots,
  };
}

async function setConfig(db: any, key: string, value: string, type: 'NUMBER' | 'BOOLEAN' | 'STRING') {
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
    scheduledFor: c.scheduledFor,
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
      WHERE "partnerId" = $1 AND status IN ('PENDING_REVIEW','SCHEDULED','SENDING','SENT')
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

// ---------------------------------------------------------------- horários (vagas)

/** Condição SQL de "vaga ocupada" (alias c): paga/agendada/enviada, ou reservada esperando o PIX. */
const SLOT_TAKEN_SQL = `(c.status IN ('PENDING_REVIEW','SCHEDULED','SENDING','SENT')
   OR (c.status = 'AWAITING_PAYMENT' AND c."createdAt" > NOW() - INTERVAL '${SLOT_HOLD_MINUTES} minutes'))`;

function brtDateKey(d: Date) {
  return new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
}

export function slotDate(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time}:00${BRT_OFFSET}`);
}

const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export function slotLabel(at: Date | string) {
  const d = new Date(at);
  const local = new Date(d.getTime() - 3 * 3600e3);
  const dd = String(local.getUTCDate()).padStart(2, '0');
  const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mi = String(local.getUTCMinutes()).padStart(2, '0');
  return `${WEEKDAY[local.getUTCDay()]}, ${dd}/${mm} às ${hh}:${mi}`;
}

/** Próximos dias com os horários e se cada um está livre. */
export async function listSlots(db: any, settings: { slots: string[] }, opts: { ignoreCampaignId?: string; nowMs?: number } = {}) {
  const now = opts.nowMs ?? Date.now();
  const minAt = now + SLOT_LEAD_HOURS * 3600e3;
  const until = new Date(now + (SLOT_DAYS_AHEAD + 1) * 864e5);
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT c."scheduledFor" FROM partner_push_campaigns c
      WHERE c."scheduledFor" >= NOW() - INTERVAL '1 hour' AND c."scheduledFor" <= $1 AND ${SLOT_TAKEN_SQL}
        AND ($2::text IS NULL OR c.id <> $2)`,
    until,
    opts.ignoreCampaignId || null,
  );
  const taken = new Set(rows.map((r) => new Date(r.scheduledFor).getTime()));
  const days: any[] = [];
  for (let i = 0; i <= SLOT_DAYS_AHEAD; i++) {
    const key = brtDateKey(new Date(now + i * 864e5));
    const slots = settings.slots
      .map((t) => {
        const at = slotDate(key, t);
        return { time: t, at: at.toISOString(), available: at.getTime() >= minAt && !taken.has(at.getTime()) };
      })
      .filter((x) => new Date(x.at).getTime() >= minAt);
    if (slots.length) days.push({ date: key, label: slotLabel(slotDate(key, '12:00')).split(' às ')[0], slots });
  }
  return days;
}

/** Valida que o horário é uma vaga oferecida e futura. */
function parseSlot(raw: any, settings: { slots: string[] }, nowMs = Date.now()): Date {
  const at = new Date(String(raw || ''));
  if (Number.isNaN(at.getTime())) throw new HttpError(400, 'Escolha o dia e o horário do envio.', 'SLOT_REQUIRED');
  const key = brtDateKey(at);
  const isOffered = settings.slots.some((t) => slotDate(key, t).getTime() === at.getTime());
  if (!isOffered) throw new HttpError(400, 'Horário inválido. Escolha um dos horários disponíveis.', 'SLOT_INVALID');
  if (at.getTime() < nowMs + SLOT_LEAD_HOURS * 3600e3) {
    throw new HttpError(400, `Escolha um horário com pelo menos ${SLOT_LEAD_HOURS} horas de antecedência.`, 'SLOT_TOO_SOON');
  }
  if (at.getTime() > nowMs + (SLOT_DAYS_AHEAD + 1) * 864e5) throw new HttpError(400, 'Agende em até 2 semanas.', 'SLOT_TOO_FAR');
  return at;
}

/** Próxima vaga livre a partir de `from` (para remarcar quando a original não serve mais). */
async function nextFreeSlot(db: any, settings: { slots: string[] }, fromMs: number, ignoreId?: string): Promise<Date | null> {
  const days = await listSlots(db, settings, { ignoreCampaignId: ignoreId });
  for (const d of days) {
    for (const s of d.slots) {
      if (s.available && new Date(s.at).getTime() >= fromMs) return new Date(s.at);
    }
  }
  return null;
}

/** Trava global curta para ninguém pegar a mesma vaga ao mesmo tempo. */
async function withSlotLock<T>(db: any, fn: (tx: any) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx: any) => {
    await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(918273645)`);
    return fn(tx);
  });
}

async function slotTaken(tx: any, at: Date, ignoreId?: string) {
  const rows: any[] = await tx.$queryRawUnsafe(
    `SELECT c.id FROM partner_push_campaigns c WHERE c."scheduledFor" = $1 AND ${SLOT_TAKEN_SQL} AND ($2::text IS NULL OR c.id <> $2) LIMIT 1`,
    at,
    ignoreId || null,
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------- envio

/** Envia uma campanha já travada como SENDING. */
async function sendCampaign(db: any, id: string) {
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
  return { recipients: Number(recipients) || 0, pushAttempted: push.attempted, pushSuccess: push.success };
}

/**
 * Envia as campanhas aprovadas cujo horário chegou. Seguro para chamar várias vezes ao mesmo
 * tempo: cada campanha só é enviada por quem conseguir mudar SCHEDULED → SENDING.
 * Campanhas presas em SENDING há mais de 15 min (função derrubada no meio) voltam para a fila.
 */
export async function dispatchDuePushCampaigns(db: any, max = 3) {
  await ensurePartnerPushSchema(db);
  await db.$executeRawUnsafe(
    `UPDATE partner_push_campaigns SET status = 'SCHEDULED', "updatedAt" = NOW()
      WHERE status = 'SENDING' AND "scheduledFor" IS NOT NULL AND "sentAt" IS NULL AND "updatedAt" < NOW() - INTERVAL '15 minutes'`,
  );
  const due: any[] = await db.$queryRawUnsafe(
    `SELECT id FROM partner_push_campaigns WHERE status = 'SCHEDULED' AND "scheduledFor" <= NOW()
      ORDER BY "scheduledFor" ASC LIMIT ${Math.max(1, Math.min(10, max))}`,
  );
  const sent: any[] = [];
  for (const d of due) {
    const locked: any[] = await db.$queryRawUnsafe(
      `UPDATE partner_push_campaigns SET status = 'SENDING', "updatedAt" = NOW() WHERE id = $1 AND status = 'SCHEDULED' RETURNING id`,
      d.id,
    );
    if (!locked.length) continue;
    try {
      sent.push({ id: d.id, ...(await sendCampaign(db, d.id)) });
    } catch (e: any) {
      console.error('❌ Envio agendado falhou:', e?.message);
      await db.$executeRawUnsafe(
        `UPDATE partner_push_campaigns SET status = 'SCHEDULED', "updatedAt" = NOW() WHERE id = $1 AND status = 'SENDING'`,
        d.id,
      );
    }
  }
  return { due: due.length, sent };
}

/** Pagamento confirmado depois que a reserva venceu e outra empresa pegou o horário → remarca. */
export async function resolveSlotAfterPayment(db: any, campaignId: string) {
  await ensurePartnerPushSchema(db);
  const settings = await getPushSettings(db);
  const moved = await withSlotLock(db, async (tx) => {
    const rows: any[] = await tx.$queryRawUnsafe(
      `SELECT id, "scheduledFor", "partnerId", title FROM partner_push_campaigns WHERE id = $1`,
      campaignId,
    );
    const c = rows[0];
    if (!c?.scheduledFor) return null;
    const at = new Date(c.scheduledFor);
    const stillOk = at.getTime() > Date.now() + 30 * 60e3 && !(await slotTaken(tx, at, c.id));
    if (stillOk) return null;
    const next = await nextFreeSlot(tx, settings, Math.max(at.getTime(), Date.now()), c.id);
    await tx.$executeRawUnsafe(
      `UPDATE partner_push_campaigns SET "scheduledFor" = $2, "updatedAt" = NOW() WHERE id = $1`,
      c.id,
      next,
    );
    return { partnerId: c.partnerId, title: c.title, next };
  });
  if (moved) {
    await notifyPartner(
      db,
      moved.partnerId,
      'Horário da notificação alterado',
      moved.next
        ? `"${moved.title}": o horário escolhido foi ocupado enquanto o pagamento era confirmado. Nova data: ${slotLabel(moved.next)}. Você pode trocar no app.`
        : `"${moved.title}": escolha um novo horário no app.`,
    );
  }
  return moved;
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
      settings: { ...settings, price: settings.priceCents / 100, leadHours: SLOT_LEAD_HOURS },
      audience: audience?.[0]?.n || 0,
      nextAllowedAt: next,
      limits: { titleMax: TITLE_MAX, bodyMax: BODY_MAX },
    });
    return true;
  }

  if (path === `${base}/slots` && method === 'GET') {
    const ignore = ctx.req?.query?.campaignId ? String(ctx.req.query.campaignId) : undefined;
    res.status(200).json({ days: await listSlots(db, settings, { ignoreCampaignId: ignore }), leadHours: SLOT_LEAD_HOURS });
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
      `SELECT id FROM partner_push_campaigns WHERE "partnerId" = $1 AND status IN ('AWAITING_PAYMENT','PENDING_REVIEW','SCHEDULED','SENDING')`,
      acc.partnerId,
    );
    if (open.length) {
      throw new HttpError(409, 'Você já tem uma notificação em andamento ou agendada. Espere ela ser enviada (ou cancele) antes de criar outra.', 'OPEN_CAMPAIGN');
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
    const at = parseSlot(body.scheduledFor, settings);
    const id = crypto.randomUUID();
    const reserved = await withSlotLock(db, async (tx) => {
      if (await slotTaken(tx, at)) return false;
      await tx.$executeRawUnsafe(
        `INSERT INTO partner_push_campaigns (id, "partnerId", "createdById", title, body, "discountId", "priceCents", "scheduledFor")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        id, acc.partnerId, userId, title, text, discountId, settings.priceCents, at,
      );
      return true;
    });
    if (!reserved) {
      throw new HttpError(409, 'Esse horário acabou de ser reservado por outra empresa. Escolha outro.', 'SLOT_TAKEN');
    }
    res.status(201).json({ campaign: formatCampaign(await loadCampaign(db, id)) });
    return true;
  }

  const m = path.match(/^\/api\/partner\/push-campaigns\/([^/]+)(\/checkout|\/cancel|\/reschedule)?$/);
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

  if (m[2] === '/reschedule' && method === 'POST') {
    if (!['AWAITING_PAYMENT', 'PENDING_REVIEW', 'SCHEDULED'].includes(campaign.status)) {
      throw new HttpError(409, 'Esta notificação não pode mais mudar de horário.');
    }
    const at = parseSlot(body.scheduledFor, settings);
    const ok = await withSlotLock(db, async (tx) => {
      if (await slotTaken(tx, at, campaign.id)) return false;
      await tx.$executeRawUnsafe(
        `UPDATE partner_push_campaigns SET "scheduledFor" = $2, "updatedAt" = NOW()
          WHERE id = $1 AND status IN ('AWAITING_PAYMENT','PENDING_REVIEW','SCHEDULED')`,
        campaign.id,
        at,
      );
      return true;
    });
    if (!ok) throw new HttpError(409, 'Esse horário já está ocupado. Escolha outro.', 'SLOT_TAKEN');
    res.status(200).json({ campaign: formatCampaign(await loadCampaign(db, campaign.id)), message: `Agendada para ${slotLabel(at)}` });
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
    if (campaign.scheduledFor) {
      const at = new Date(campaign.scheduledFor);
      const free = await withSlotLock(db, async (tx) => !(await slotTaken(tx, at, campaign.id)));
      if (!free || at.getTime() < Date.now() + 60 * 60e3) {
        throw new HttpError(409, 'O horário escolhido não está mais disponível. Escolha outro horário antes de pagar.', 'SLOT_EXPIRED');
      }
      // Renova a reserva enquanto o pagamento acontece
      await db.$executeRawUnsafe(`UPDATE partner_push_campaigns SET "createdAt" = GREATEST("createdAt", NOW() - INTERVAL '1 minute') WHERE id = $1`, campaign.id);
    }
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
    if (body.slots !== undefined) {
      const list = parseSlotTimes(Array.isArray(body.slots) ? body.slots.join(',') : body.slots);
      if (!list || list.length > 12) throw new HttpError(400, 'Horários inválidos (use HH:MM separados por vírgula, até 12).');
      await setConfig(db, KEYS.slots, list.join(','), 'STRING' as any);
    }
    res.status(200).json({ settings: await getPushSettings(db) });
    return true;
  }

  if (path === '/api/admin/partner-push-campaigns' && method === 'GET') {
    const status = ctx.req.query?.status ? String(ctx.req.query.status) : null;
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT c.*, p.name AS "partnerName" FROM partner_push_campaigns c JOIN partners p ON p.id = c."partnerId"
        WHERE ($1::text IS NULL OR c.status = $1) AND c.status <> 'CANCELLED'
        ORDER BY CASE c.status WHEN 'PENDING_REVIEW' THEN 0 WHEN 'SCHEDULED' THEN 1 ELSE 2 END,
                 CASE WHEN c.status IN ('PENDING_REVIEW','SCHEDULED') THEN c."scheduledFor" END ASC NULLS LAST,
                 c."createdAt" DESC LIMIT 100`,
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
      // Sem horário (criada antes do agendamento) → envia agora, como antes
      if (!c.scheduledFor) {
        const r = await sendCampaign(db, id);
        res.status(200).json({ message: 'Notificação enviada', ...r });
        return true;
      }
      let at = new Date(c.scheduledFor);
      let movedTo: Date | null = null;
      const takenByOther: any[] = await db.$queryRawUnsafe(
        `SELECT id FROM partner_push_campaigns WHERE "scheduledFor" = $1 AND id <> $2 AND status IN ('SCHEDULED','SENDING','SENT') LIMIT 1`,
        at,
        id,
      );
      if (at.getTime() <= Date.now() || takenByOther.length) {
        // A aprovação chegou depois do horário: vai para a próxima vaga livre
        const settings = await getPushSettings(db);
        movedTo = await withSlotLock(db, (tx) => nextFreeSlot(tx, settings, Date.now(), id));
        if (!movedTo) {
          await db.$executeRawUnsafe(`UPDATE partner_push_campaigns SET status = 'PENDING_REVIEW' WHERE id = $1`, id);
          throw new HttpError(409, 'Não há horário livre nas próximas 2 semanas. Aumente os horários nas configurações.');
        }
        at = movedTo;
      }
      await db.$executeRawUnsafe(
        `UPDATE partner_push_campaigns SET status = 'SCHEDULED', "scheduledFor" = $2, "updatedAt" = NOW() WHERE id = $1`,
        id,
        at,
      );
      await notifyPartner(
        db,
        c.partnerId,
        'Notificação aprovada ✅',
        `"${c.title}" será enviada ${slotLabel(at)}${movedTo ? ' (o horário original já tinha passado)' : ''}.`,
      );
      res.status(200).json({
        message: `Aprovada. Envio ${slotLabel(at)}.`,
        scheduledFor: at,
        moved: !!movedTo,
      });
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

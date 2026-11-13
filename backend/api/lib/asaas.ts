/**
 * Cliente Asaas (API v3): PIX, boleto e cartão (página segura do Asaas), com split da taxa da
 * plataforma direto na cobrança.
 *
 * - Cada ONG tem a SUA conta Asaas (PJ no CNPJ dela). O dinheiro cai na conta da ONG.
 * - A taxa SóciONG (10% do bruto) vai por split, na hora, para a carteira da plataforma
 *   (ASAAS_PLATFORM_WALLET_ID). Sem carteira definida, não há split e a taxa continua sendo
 *   cobrada pela fatura mensal (platformFees).
 * - Cartão: o app NÃO recebe o número do cartão. A cobrança gera a página de pagamento do Asaas
 *   (invoiceUrl) e o sócio digita o cartão lá. Nada de cartão passa pelo nosso servidor.
 * - Ambiente: deduzido da própria chave ($aact_prod_… = produção; $aact_hmlg_… = sandbox),
 *   com ASAAS_ENV como reserva.
 *
 * Docs: https://docs.asaas.com/reference
 */
import crypto from 'crypto';
import { currentOrgId, currentSecret, DEFAULT_ORG, isolationOn } from './tenant';
import type { CreateOrderInput, PagBankOrderResult } from './pagbank';

export type AsaasEnv = 'sandbox' | 'production';
export const ASAAS_MIN_CENTS = 500; // o Asaas não emite cobrança abaixo de R$ 5,00

const UA = 'SociONG/1.0 (+https://sociong.com.br)';

export function asaasEnvForKey(key: string): AsaasEnv {
  const k = String(key || '');
  if (k.includes('_hmlg_')) return 'sandbox';
  if (k.includes('_prod_')) return 'production';
  return (process.env.ASAAS_ENV || 'production').toLowerCase() === 'sandbox' ? 'sandbox' : 'production';
}
export function asaasBaseUrl(env: AsaasEnv) {
  return env === 'sandbox' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
}

/**
 * Token que o Asaas manda no header asaas-access-token. Derivado do segredo do servidor e do id
 * da ONG: não precisa ser guardado em lugar nenhum e é diferente para cada ONG.
 */
export function asaasWebhookToken(orgId: string) {
  const base = process.env.ORG_SECRETS_KEY || `${process.env.JWT_SECRET || ''}:org-secrets:v1`;
  return `whk_${crypto.createHmac('sha256', base).update(`asaas-webhook:${orgId || DEFAULT_ORG}`).digest('hex')}`;
}

/**
 * Conta da Liga conectada pela central (org_secrets), carregada no começo de cada requisição
 * enquanto a separação por ONG está desligada. A variável ASAAS_API_KEY da Vercel fica de reserva.
 */
let ligaAsaas: { apiKey: string; walletId: string; at: number } | null = null;
export async function primeLigaAsaas(db: any) {
  if (!db || (ligaAsaas && Date.now() - ligaAsaas.at < 60e3)) return;
  try {
    const { getOrgSecret } = await import('./orgs');
    ligaAsaas = {
      apiKey: String((await getOrgSecret(db, DEFAULT_ORG, 'ASAAS_API_KEY')) || ''),
      walletId: String((await getOrgSecret(db, DEFAULT_ORG, 'ASAAS_WALLET_ID')) || ''),
      at: Date.now(),
    };
  } catch {
    /* fica na variável da Vercel */
  }
}
export function resetLigaAsaas() {
  ligaAsaas = null;
}

/** Conta Asaas da ONG da requisição. Outras ONGs: org_secrets. Liga: conectada na central ou ASAAS_API_KEY. */
export function getAsaasConfig() {
  const orgId = currentOrgId();
  const otherOrg = isolationOn() && orgId !== DEFAULT_ORG;
  const pick = (key: 'ASAAS_API_KEY' | 'ASAAS_WALLET_ID', cached?: string) =>
    String((otherOrg ? currentSecret(key) : currentSecret(key) || cached || process.env[key]) || '').trim();
  const apiKey = pick('ASAAS_API_KEY', ligaAsaas?.apiKey);
  const walletId = pick('ASAAS_WALLET_ID', ligaAsaas?.walletId);
  const webhookToken = String((otherOrg ? '' : process.env.ASAAS_WEBHOOK_TOKEN) || '').trim() || asaasWebhookToken(otherOrg ? orgId : DEFAULT_ORG);
  const env = asaasEnvForKey(apiKey);
  return { apiKey, walletId, webhookToken, env, baseUrl: asaasBaseUrl(env), configured: Boolean(apiKey) };
}

/** Carteira da plataforma que recebe a taxa por split (vazia = sem split). */
export function platformWalletId() {
  return String(process.env.ASAAS_PLATFORM_WALLET_ID || '').trim();
}

export async function asaasRequest(apiKey: string, path: string, init: { method?: string; body?: any } = {}) {
  if (!apiKey) throw new Error('Conta Asaas da ONG não conectada');
  const method = String(init.method || 'GET').toUpperCase();
  const response = await fetch(`${asaasBaseUrl(asaasEnvForKey(apiKey))}${path}`, {
    method,
    headers: {
      access_token: apiKey,
      Accept: 'application/json',
      'User-Agent': UA,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const detail = (data?.errors || []).map((e: any) => e?.description || e?.code).filter(Boolean).join('; ') || text || `HTTP ${response.status}`;
    const err: any = new Error(`Asaas: ${detail}`);
    err.status = response.status;
    err.payload = data;
    throw err;
  }
  return data;
}

const call = (path: string, init?: { method?: string; body?: any }) => asaasRequest(getAsaasConfig().apiKey, path, init);

const onlyDigits = (v: any) => String(v || '').replace(/\D/g, '');

/** "Hoje + dias" no calendário de Brasília (UTC-3), formato AAAA-MM-DD. */
export function brtDate(days = 0) {
  const d = new Date(Date.now() + days * 86400e3 - 3 * 3600e3);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- clientes

const customerCache = new Map<string, { id: string; at: number }>();

async function ensureCustomer(c: CreateOrderInput['customer'], address?: CreateOrderInput['address'] | null) {
  const cpfCnpj = onlyDigits(c.taxId);
  const cacheKey = `${getAsaasConfig().apiKey.slice(-12)}:${cpfCnpj}`;
  const hit = customerCache.get(cacheKey);
  let id = hit && Date.now() - hit.at < 30 * 60e3 ? hit.id : '';
  if (!id) {
    const found = await call(`/customers?cpfCnpj=${cpfCnpj}&limit=1`);
    id = found?.data?.[0]?.id || '';
  }
  const phone = onlyDigits(c.phone);
  const fields: any = {
    name: String(c.name || 'Cliente').slice(0, 120),
    cpfCnpj,
    ...(c.email ? { email: c.email } : {}),
    ...(phone.length >= 10 ? { mobilePhone: phone.slice(-11) } : {}),
    // A ONG manda os avisos dela pelo app; e-mails/SMS do Asaas ficam desligados
    notificationDisabled: true,
    ...(address
      ? {
          postalCode: address.postalCode,
          address: address.street,
          addressNumber: address.number,
          ...(address.complement ? { complement: address.complement } : {}),
          province: address.locality,
        }
      : {}),
  };
  if (id) {
    if (address) await call(`/customers/${id}`, { method: 'PUT', body: fields }).catch(() => null);
  } else {
    id = (await call('/customers', { method: 'POST', body: fields }))?.id;
  }
  if (!id) throw new Error('Asaas não devolveu o cliente');
  customerCache.set(cacheKey, { id, at: Date.now() });
  return id;
}

// ---------------------------------------------------------------- cobranças

/** Taxa da plataforma desta cobrança (10% do bruto), em centavos. */
export function platformFeeCents(amountCents: number, rate = 0.1) {
  return Math.round(Math.max(0, amountCents) * rate);
}

function toResult(p: any, extra: Partial<PagBankOrderResult> = {}): PagBankOrderResult {
  return {
    id: p?.id,
    status: p?.status,
    raw: p,
    chargeId: p?.id || null,
    chargeStatus: p?.status || null,
    pixCopyPaste: null,
    pixQrImage: null,
    pixExpiration: null,
    boletoUrl: p?.bankSlipUrl || null,
    boletoImage: null,
    boletoBarcode: null,
    boletoFormattedBarcode: null,
    paymentLink: p?.invoiceUrl || null,
    ...extra,
  };
}

/**
 * Cria a cobrança na conta Asaas da ONG. Devolve o mesmo formato do PagBank, para o resto
 * do sistema não precisar saber qual é o gateway.
 * Cartão (crédito ou débito): sem dados de cartão; o sócio paga na página do Asaas (paymentLink).
 */
export async function createAsaasPayment(
  input: CreateOrderInput & { feeRate?: number },
): Promise<PagBankOrderResult & { splitFeeCents: number }> {
  const amountCents = Math.round(input.amountCents);
  if (amountCents < ASAAS_MIN_CENTS) throw Object.assign(new Error('O valor mínimo para pagar pelo app é R$ 5,00.'), { status: 400, code: 'MIN_AMOUNT' });
  const customer = await ensureCustomer(input.customer, input.method === 'BOLETO' ? input.address : null);
  const isCard = input.method === 'CREDIT_CARD' || input.method === 'DEBIT_CARD';
  const installments = input.method === 'CREDIT_CARD' ? Math.max(1, Math.min(12, input.installments || 1)) : 1;
  const value = amountCents / 100;

  const body: any = {
    customer,
    billingType: input.method === 'PIX' ? 'PIX' : input.method === 'BOLETO' ? 'BOLETO' : input.method === 'DEBIT_CARD' ? 'DEBIT_CARD' : 'CREDIT_CARD',
    dueDate: brtDate(input.method === 'BOLETO' ? 3 : input.method === 'PIX' ? 1 : 0),
    description: input.description.slice(0, 500),
    externalReference: input.referenceId.slice(0, 100),
  };
  if (installments > 1) {
    body.installmentCount = installments;
    body.totalValue = value;
  } else {
    body.value = value;
  }
  if (input.method === 'BOLETO') body.postalService = false;

  // Split da taxa: só quando a plataforma tem carteira e a cobrança não é na própria conta dela
  const wallet = platformWalletId();
  const own = getAsaasConfig().walletId;
  const splitFeeCents = wallet && wallet !== own ? platformFeeCents(amountCents, input.feeRate ?? 0.1) : 0;
  if (splitFeeCents > 0) {
    body.split = [installments > 1
      ? { walletId: wallet, totalFixedValue: splitFeeCents / 100 }
      : { walletId: wallet, fixedValue: splitFeeCents / 100 }];
  }

  let p: any;
  try {
    p = await call('/payments', { method: 'POST', body });
  } catch (e: any) {
    // Conta sem débito habilitado: cai para a página de cartão de crédito
    if (input.method === 'DEBIT_CARD' && e?.status === 400) {
      p = await call('/payments', { method: 'POST', body: { ...body, billingType: 'CREDIT_CARD' } });
    } else {
      throw e;
    }
  }
  const extra: Partial<PagBankOrderResult> = {};
  if (input.method === 'PIX') {
    const qr = await call(`/payments/${p.id}/pixQrCode`).catch(() => null);
    extra.pixCopyPaste = qr?.payload || null;
    extra.pixQrImage = qr?.encodedImage ? `data:image/png;base64,${qr.encodedImage}` : null;
    extra.pixExpiration = qr?.expirationDate ? new Date(String(qr.expirationDate).replace(' ', 'T') + '-03:00').toISOString() : null;
  } else if (input.method === 'BOLETO') {
    const line = await call(`/payments/${p.id}/identificationField`).catch(() => null);
    extra.boletoFormattedBarcode = line?.identificationField || null;
    extra.boletoBarcode = line?.barCode || null;
  } else if (isCard) {
    extra.paymentLink = p?.invoiceUrl || null;
  }
  return { ...toResult(p, extra), splitFeeCents };
}

export async function getAsaasPayment(id: string): Promise<PagBankOrderResult> {
  return toResult(await call(`/payments/${encodeURIComponent(id)}`));
}

export function isAsaasPaid(status?: string | null) {
  return ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(String(status || '').toUpperCase());
}

export function mapAsaasStatus(status?: string | null): 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' {
  const s = String(status || '').toUpperCase();
  if (isAsaasPaid(s)) return 'APPROVED';
  if (s === 'OVERDUE') return 'EXPIRED';
  if (['REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'DELETED'].includes(s)) return 'CANCELLED';
  return 'PENDING';
}

/** Estorno (total ou parcial). O split é desfeito proporcionalmente pelo Asaas. */
export async function refundAsaasPayment(id: string, amountCents?: number) {
  const data = await call(`/payments/${encodeURIComponent(id)}/refund`, {
    method: 'POST',
    body: amountCents ? { value: Math.round(amountCents) / 100 } : {},
  });
  return { status: String(data?.status || ''), raw: data };
}

/** Parcelas no cartão: sem juros para quem paga (a taxa de parcelamento do Asaas fica com a ONG). */
export function asaasInstallmentOptions(amountCents: number, maxInstallments: number) {
  const fmt = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const max = Math.max(1, Math.min(12, Math.floor(maxInstallments || 1), Math.floor(amountCents / ASAAS_MIN_CENTS) || 1));
  const out: any[] = [];
  for (let n = 1; n <= max; n++) {
    const installmentCents = Math.round(amountCents / n);
    out.push({
      installments: n,
      installmentCents,
      totalCents: amountCents,
      interestCents: 0,
      interestFree: true,
      buyerInterestTotalCents: 0,
      buyerInterestInstallments: 0,
      label: n === 1 ? `À vista — ${fmt(amountCents)}` : `${n}x de ${fmt(installmentCents)} sem juros`,
      source: 'asaas',
    });
  }
  return out;
}

// ---------------------------------------------------------------- webhook

export function verifyAsaasWebhook(expected: string, received: string) {
  if (!expected || !received) return false;
  const a = crypto.createHash('sha256').update(expected).digest();
  const b = crypto.createHash('sha256').update(received).digest();
  return crypto.timingSafeEqual(a, b);
}

export const ASAAS_WEBHOOK_EVENTS = [
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
];

export function asaasWebhookUrl(apiBase: string, orgId: string) {
  const base = `${String(apiBase || '').replace(/\/$/, '')}/api/webhooks/asaas`;
  return orgId && orgId !== DEFAULT_ORG ? `${base}?org=${encodeURIComponent(orgId)}` : base;
}

/**
 * Liga a conta Asaas de uma ONG: confere a chave, descobre a carteira (walletId) e cadastra o
 * webhook com um token novo. Devolve o que deve ser guardado (criptografado) em org_secrets.
 */
export async function connectAsaasAccount(apiKey: string, opts: { webhookUrl: string; orgId: string; email?: string | null }) {
  const account = await asaasRequest(apiKey, '/myAccount').catch(() => null);
  const wallets = await asaasRequest(apiKey, '/wallets');
  const walletId = String(wallets?.data?.[0]?.id || account?.walletId || '');
  if (!walletId) throw new Error('Não encontrei a carteira (walletId) desta conta Asaas');
  const webhookToken = asaasWebhookToken(opts.orgId);
  // Troca o webhook antigo do SóciONG, se houver
  const existing = await asaasRequest(apiKey, '/webhooks?limit=50').catch(() => null);
  for (const w of existing?.data || []) {
    if (String(w?.url || '').includes('/api/webhooks/asaas')) await asaasRequest(apiKey, `/webhooks/${w.id}`, { method: 'DELETE' }).catch(() => null);
  }
  await asaasRequest(apiKey, '/webhooks', {
    method: 'POST',
    body: {
      name: 'SóciONG',
      url: opts.webhookUrl,
      ...(opts.email ? { email: opts.email } : {}),
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken: webhookToken,
      sendType: 'SEQUENTIALLY',
      events: ASAAS_WEBHOOK_EVENTS,
    },
  });
  return {
    walletId,
    env: asaasEnvForKey(apiKey),
    accountName: account?.name || account?.companyName || null,
    cpfCnpj: account?.cpfCnpj || null,
  };
}

/**
 * Abre a conta Asaas da ONG como subconta da plataforma (chave da plataforma: ASAAS_PLATFORM_API_KEY).
 * O Asaas manda à ONG o e-mail de ativação; ela cria a senha e envia os documentos lá.
 * A chave da subconta só vem nesta resposta: quem chama precisa guardá-la na hora.
 */
export async function createAsaasSubaccount(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  companyType: 'ASSOCIATION' | 'LIMITED' | 'INDIVIDUAL' | 'MEI';
  incomeValue: number;
  mobilePhone: string;
  address: string;
  addressNumber: string;
  complement?: string | null;
  province: string;
  postalCode: string;
  webhookUrl: string;
  orgId: string;
}) {
  const platformKey = String(process.env.ASAAS_PLATFORM_API_KEY || '').trim();
  if (!platformKey) throw Object.assign(new Error('Defina ASAAS_PLATFORM_API_KEY na Vercel para abrir contas pela central'), { status: 503 });
  const webhookToken = asaasWebhookToken(input.orgId);
  const r = await asaasRequest(platformKey, '/accounts', {
    method: 'POST',
    body: {
      name: input.name,
      email: input.email,
      cpfCnpj: onlyDigits(input.cpfCnpj),
      companyType: input.companyType,
      incomeValue: input.incomeValue,
      mobilePhone: onlyDigits(input.mobilePhone),
      address: input.address,
      addressNumber: input.addressNumber,
      ...(input.complement ? { complement: input.complement } : {}),
      province: input.province,
      postalCode: onlyDigits(input.postalCode),
      webhooks: [
        {
          name: 'SóciONG',
          url: input.webhookUrl,
          email: input.email,
          enabled: true,
          interrupted: false,
          apiVersion: 3,
          authToken: webhookToken,
          sendType: 'SEQUENTIALLY',
          events: ASAAS_WEBHOOK_EVENTS,
        },
      ],
    },
  });
  if (!r?.apiKey || !r?.walletId) throw new Error('O Asaas não devolveu a chave da conta');
  return { id: r.id as string, apiKey: r.apiKey as string, walletId: r.walletId as string, env: asaasEnvForKey(platformKey) };
}

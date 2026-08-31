/**
 * Cliente PagBank Orders API (PIX, Boleto, Cartão).
 * Docs: https://developer.pagbank.com.br/reference/criar-pedido
 */

export type PagBankEnv = 'sandbox' | 'production';

export function getPagBankConfig() {
  const token = (process.env.PAGBANK_TOKEN || process.env.PAGSEGURO_TOKEN || '').trim();
  const env = ((process.env.PAGBANK_ENV || 'production').toLowerCase() === 'sandbox'
    ? 'sandbox'
    : 'production') as PagBankEnv;
  const baseUrl =
    env === 'sandbox'
      ? 'https://sandbox.api.pagseguro.com'
      : 'https://api.pagseguro.com';
  return { token, env, baseUrl, configured: Boolean(token) };
}

function onlyDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

export function splitPhone(phone?: string | null) {
  const digits = onlyDigits(phone);
  if (digits.length >= 10) {
    const national = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
    return {
      country: '55',
      area: national.slice(0, 2),
      number: national.slice(2),
      type: 'MOBILE' as const,
    };
  }
  return {
    country: '55',
    area: '14',
    number: '999999999',
    type: 'MOBILE' as const,
  };
}

export type CreateOrderInput = {
  referenceId: string;
  amountCents: number;
  description: string;
  customer: {
    name: string;
    email: string;
    taxId: string;
    phone?: string | null;
  };
  method: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD';
  notificationUrl: string;
  card?: {
    encrypted?: string;
    number?: string;
    expMonth?: string;
    expYear?: string;
    securityCode?: string;
    holderName?: string;
    store?: boolean;
  };
  installments?: number;
  /** Valor do item sem juros (plano). Se omitido, usa amountCents. */
  itemAmountCents?: number;
  /** Repasse de juros da API Fees do PagBank (charges.amount.fees.buyer.interest). */
  buyerInterest?: {
    total: number;
    installments: number;
  } | null;
};

export type PagBankOrderResult = {
  id: string;
  status?: string;
  raw: any;
  pixCopyPaste?: string | null;
  pixQrImage?: string | null;
  pixExpiration?: string | null;
  boletoUrl?: string | null;
  boletoBarcode?: string | null;
  boletoFormattedBarcode?: string | null;
  chargeId?: string | null;
  chargeStatus?: string | null;
  paymentLink?: string | null;
};

async function pagbankFetch(path: string, init: RequestInit = {}) {
  const { token, baseUrl, configured } = getPagBankConfig();
  if (!configured) {
    throw new Error('PAGBANK_TOKEN não configurado no servidor');
  }

  const method = String(init.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    method,
    headers,
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const detail =
      data?.error_messages?.map((e: any) => e.description || e.message)?.join('; ') ||
      data?.message ||
      text ||
      `HTTP ${response.status}`;
    const err: any = new Error(`PagBank: ${detail}`);
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  return data;
}

function buildCustomer(input: CreateOrderInput['customer']) {
  const taxId = onlyDigits(input.taxId);
  const phone = splitPhone(input.phone);
  return {
    name: input.name.slice(0, 120),
    email: input.email,
    tax_id: taxId,
    phones: [phone],
  };
}

function extractPaymentArtifacts(order: any): PagBankOrderResult {
  const qr = order?.qr_codes?.[0];
  const charge = order?.charges?.[0];
  const boleto = charge?.payment_method?.boleto;
  const links: any[] = [
    ...(Array.isArray(order?.links) ? order.links : []),
    ...(Array.isArray(charge?.links) ? charge.links : []),
    ...(Array.isArray(boleto?.links) ? boleto.links : []),
  ];

  const findLink = (...rels: string[]) => {
    const hit = links.find((l) => rels.includes(String(l?.rel || '').toUpperCase()));
    return hit?.href || null;
  };

  return {
    id: order.id,
    status: charge?.status || order?.charges?.[0]?.status,
    raw: order,
    pixCopyPaste: qr?.text || null,
    pixQrImage: qr?.links?.find((l: any) => l.rel === 'QRCODE.PNG')?.href || findLink('QRCODE.PNG'),
    pixExpiration: qr?.expiration_date || null,
    boletoUrl:
      findLink('PDF', 'BOLETO_PDF', 'SELF') ||
      boleto?.formatted_barcode ||
      null,
    boletoBarcode: boleto?.barcode || null,
    boletoFormattedBarcode: boleto?.formatted_barcode || null,
    chargeId: charge?.id || null,
    chargeStatus: charge?.status || null,
    paymentLink: findLink('PAY', 'PAYMENT'),
  };
}

export type PagBankInstallmentOption = {
  installments: number;
  installmentCents: number;
  totalCents: number;
  interestCents: number;
  interestFree: boolean;
  buyerInterestTotalCents: number;
  buyerInterestInstallments: number;
  label: string;
  source: 'pagbank' | 'fallback';
};

const installmentCache = new Map<string, { at: number; options: PagBankInstallmentOption[] }>();
const INSTALLMENT_CACHE_MS = 5 * 60 * 1000;

function formatBrlCents(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function cashInstallmentOption(amountCents: number): PagBankInstallmentOption {
  const totalCents = Math.max(0, Math.round(amountCents || 0));
  return {
    installments: 1,
    installmentCents: totalCents,
    totalCents,
    interestCents: 0,
    interestFree: true,
    buyerInterestTotalCents: 0,
    buyerInterestInstallments: 0,
    label: `À vista — ${formatBrlCents(totalCents)}`,
    source: 'fallback',
  };
}

function mapFeePlan(raw: any, originalCents: number): PagBankInstallmentOption | null {
  const installments = Math.round(Number(raw?.installments ?? raw?.quantity ?? 0));
  if (!installments) return null;
  const installmentCents = Math.round(
    Number(raw?.installment_value ?? raw?.installmentAmount ?? raw?.installment_amount ?? 0),
  );
  const totalCents = Math.round(
    Number(raw?.amount?.value ?? raw?.total_amount ?? raw?.totalAmount ?? installmentCents * installments),
  );
  const interestFree = Boolean(raw?.interest_free ?? raw?.interestFree);
  const buyerInterestTotalCents = Math.round(Number(raw?.amount?.fees?.buyer?.interest?.total || 0));
  const buyerInterestInstallments = Math.round(
    Number(raw?.amount?.fees?.buyer?.interest?.installments || 0),
  );
  const interestCents = buyerInterestTotalCents || Math.max(0, totalCents - originalCents);
  const installmentLabel = formatBrlCents(installmentCents || Math.round(totalCents / installments));
  const totalLabel = formatBrlCents(totalCents);
  const interestLabel = formatBrlCents(interestCents);
  return {
    installments,
    installmentCents: installmentCents || Math.round(totalCents / installments),
    totalCents,
    interestCents,
    interestFree,
    buyerInterestTotalCents,
    buyerInterestInstallments,
    label: interestFree || installments === 1
      ? `${installments === 1 ? 'À vista' : `${installments}x sem juros`} — ${totalLabel}`
      : `${installments}x de ${installmentLabel} (total ${totalLabel}, juros PagBank ${interestLabel})`,
    source: 'pagbank',
  };
}

function collectInstallmentPlans(node: any, acc: any[] = [], seen = new Set<any>()): any[] {
  if (!node || typeof node !== 'object' || seen.has(node)) return acc;
  seen.add(node);
  if (Array.isArray(node)) {
    const looksLikePlans = node.some(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item.installments != null || item.quantity != null) &&
        (item.installment_value != null || item.amount != null || item.installmentAmount != null),
    );
    if (looksLikePlans) {
      acc.push(...node);
      return acc;
    }
    for (const item of node) collectInstallmentPlans(item, acc, seen);
    return acc;
  }
  if (Array.isArray(node.installment_plans)) acc.push(...node.installment_plans);
  for (const value of Object.values(node)) {
    collectInstallmentPlans(value, acc, seen);
  }
  return acc;
}

function parseFeePlans(payload: any, originalCents: number): PagBankInstallmentOption[] {
  const mapped = collectInstallmentPlans(payload)
    .map((plan) => mapFeePlan(plan, originalCents))
    .filter(Boolean) as PagBankInstallmentOption[];
  const unique = new Map<number, PagBankInstallmentOption>();
  for (const option of mapped) {
    if (!unique.has(option.installments)) unique.set(option.installments, option);
  }
  return [...unique.values()].sort((a, b) => a.installments - b.installments);
}

async function fetchPagBankFeePayload(params: {
  valueCents: number;
  maxInstallments: number;
  noInterest: number;
  bin?: string;
}) {
  const qs = new URLSearchParams();
  qs.append('payment_methods', 'CREDIT_CARD');
  qs.set('value', String(params.valueCents));
  qs.set('max_installments', String(params.maxInstallments));
  qs.set('max_installments_no_interest', String(params.noInterest));
  if (params.bin && params.bin.length >= 6) {
    qs.set('credit_card_bin', params.bin);
  }
  return pagbankFetch(`/charges/fees/calculate?${qs.toString()}`, { method: 'GET' });
}

/** Consulta os planos reais de parcelamento na API Fees do PagBank. */
export async function getPagBankInstallmentPlans(params: {
  valueCents: number;
  cardBin?: string | null;
  maxInstallments?: number;
}): Promise<PagBankInstallmentOption[]> {
  const valueCents = Math.max(0, Math.round(Number(params.valueCents) || 0));
  if (!valueCents) return [];

  const maxInstallments = Math.max(1, Math.min(12, Number(params.maxInstallments || 12)));
  const noInterest = Math.max(
    1,
    Math.min(12, Number(process.env.PAGBANK_INTEREST_FREE_INSTALLMENTS || 1)),
  );
  const requestedBin = onlyDigits(params.cardBin || '').slice(0, 6);
  const defaultBin = onlyDigits(process.env.PAGBANK_DEFAULT_CARD_BIN || '552100').slice(0, 6);
  const binsToTry = [...new Set([requestedBin, defaultBin, ''].filter((bin) => bin.length === 0 || bin.length >= 6))];
  const cacheKey = `${valueCents}:${maxInstallments}:${noInterest}:${requestedBin || defaultBin}`;
  const cached = installmentCache.get(cacheKey);
  if (cached && Date.now() - cached.at < INSTALLMENT_CACHE_MS && cached.options.length > 1) {
    return cached.options;
  }

  let best: PagBankInstallmentOption[] = [];
  let lastError: any = null;
  for (const bin of binsToTry) {
    try {
      const payload = await fetchPagBankFeePayload({
        valueCents,
        maxInstallments,
        noInterest,
        bin,
      });
      const options = parseFeePlans(payload, valueCents);
      if (options.length > best.length) best = options;
      if (options.length > 1) break;
      if (options.length <= 1) {
        console.warn(
          '⚠️ PagBank fees retornou poucas parcelas',
          JSON.stringify({ bin, count: options.length, keys: payload && typeof payload === 'object' ? Object.keys(payload) : [] }),
        );
      }
    } catch (error: any) {
      lastError = error;
      console.warn('⚠️ PagBank fees/calculate falhou:', error?.message || error, error?.payload || '');
    }
  }

  if (best.length) {
    if (best.length > 1) {
      installmentCache.set(cacheKey, { at: Date.now(), options: best });
    }
    return best;
  }

  if (lastError) {
    throw lastError;
  }
  return [cashInstallmentOption(valueCents)];
}

export async function createPagBankOrder(input: CreateOrderInput): Promise<PagBankOrderResult> {
  const amount = Math.round(input.amountCents);
  const itemAmount = Math.round(input.itemAmountCents || amount);
  const customer = buildCustomer(input.customer);

  const body: any = {
    reference_id: input.referenceId.slice(0, 64),
    customer,
    items: [
      {
        reference_id: input.referenceId.slice(0, 64),
        name: input.description.slice(0, 100),
        quantity: 1,
        unit_amount: itemAmount,
      },
    ],
    notification_urls: [input.notificationUrl],
  };

  if (input.method === 'PIX') {
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    // PagBank espera offset -03:00 tipicamente
    const iso = expires.toISOString().replace('Z', '-03:00');
    body.qr_codes = [
      {
        amount: { value: amount },
        expiration_date: iso,
      },
    ];
  } else if (input.method === 'BOLETO') {
    const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const dueDate = due.toISOString().slice(0, 10);
    body.charges = [
      {
        reference_id: input.referenceId.slice(0, 64),
        description: input.description.slice(0, 64),
        amount: { value: amount, currency: 'BRL' },
        payment_method: {
          type: 'BOLETO',
          boleto: {
            due_date: dueDate,
            instruction_lines: {
              line_1: 'Pagamento da assinatura Liga do Bem',
              line_2: 'Em caso de dúvidas, contate a associação',
            },
            holder: {
              name: customer.name,
              tax_id: customer.tax_id,
              email: customer.email,
            },
          },
        },
      },
    ];
  } else {
    const type = input.method === 'DEBIT_CARD' ? 'DEBIT_CARD' : 'CREDIT_CARD';
    const card: any = {};
    const encryptedCard = input.card?.encrypted || (input.card as any)?.encrypted;
    if (encryptedCard) {
      card.encrypted = encryptedCard;
    } else {
      card.number = onlyDigits(input.card?.number);
      card.exp_month = String(input.card?.expMonth || '').padStart(2, '0');
      card.exp_year = String(input.card?.expYear || '');
      card.security_code = String(input.card?.securityCode || '');
      card.holder = { name: (input.card?.holderName || customer.name).slice(0, 30) };
    }
    if (input.card?.store) card.store = true;

    const chargeAmount: any = { value: amount, currency: 'BRL' };
    if (input.buyerInterest && input.buyerInterest.total > 0) {
      chargeAmount.fees = {
        buyer: {
          interest: {
            total: Math.round(input.buyerInterest.total),
            installments: Math.max(1, Math.round(input.buyerInterest.installments || 1)),
          },
        },
      };
    }

    body.charges = [
      {
        reference_id: input.referenceId.slice(0, 64),
        description: input.description.slice(0, 64),
        amount: chargeAmount,
        payment_method: {
          type,
          installments: Math.max(1, Math.min(12, input.installments || 1)),
          capture: true,
          card,
        },
      },
    ];
  }

  const order = await pagbankFetch('/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return extractPaymentArtifacts(order);
}

export async function getPagBankOrder(orderId: string): Promise<PagBankOrderResult> {
  const order = await pagbankFetch(`/orders/${orderId}`, { method: 'GET' });
  return extractPaymentArtifacts(order);
}

export function isPaidChargeStatus(status?: string | null) {
  const s = String(status || '').toUpperCase();
  return s === 'PAID' || s === 'AVAILABLE' || s === 'AUTHORIZED';
}

export function mapPagBankStatusToPayment(status?: string | null): 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' {
  const s = String(status || '').toUpperCase();
  if (isPaidChargeStatus(s)) return 'APPROVED';
  if (['DECLINED', 'UNAUTHORIZED'].includes(s)) return 'REJECTED';
  if (['CANCELED', 'CANCELLED'].includes(s)) return 'CANCELLED';
  if (s === 'WAITING') return 'PENDING';
  return 'PENDING';
}

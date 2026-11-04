/**
 * Homologação PagBank: roda no SANDBOX o mesmo código de pagamento do app (PIX, boleto,
 * cartão aprovado/recusado, consulta, estorno, chave pública e parcelas) e devolve todas
 * as requisições e respostas — é o "Anexo" que o PagBank pede para liberar a produção.
 *
 * - Usa só o token de sandbox (PAGBANK_SANDBOX_TOKEN), nunca o de produção.
 * - Dados fictícios da documentação do PagBank (CPF 123.456.789-09, cartões de teste).
 * - Nada é gravado em payments/memberships: não mexe em nenhum membro.
 * - Webhooks que o sandbox enviar para /api/webhooks/pagbank com referência LIGA-HOMOLOG
 *   ficam guardados e entram no relatório.
 *
 * Admin:
 *   POST /api/admin/pagbank/homologacao  → roda tudo e devolve { steps, text }
 *   GET  /api/admin/pagbank/homologacao  → último relatório + webhooks recebidos ({ text })
 */
import crypto from 'crypto';
import {
  PagBankCallLog,
  cancelPagBankCharge,
  createPagBankOrder,
  getPagBankCardPublicKey,
  getPagBankInstallmentPlans,
  getPagBankOrder,
  runWithPagBank,
} from './pagbank';

export const HOMOLOG_PREFIX = 'LIGA-HOMOLOG';
export const HOMOLOG_PATH = '/api/admin/pagbank/homologacao';

// Cartões de teste: https://developer.pagbank.com.br/docs/cartoes-de-teste (validade 12/2026)
const CARD_OK = { number: '4539620659922097', securityCode: '123', expMonth: '12', expYear: '2026', holderName: 'Jose da Silva', brand: 'VISA' };
const CARD_DECLINED = { number: '5530062640663264', securityCode: '123', expMonth: '12', expYear: '2026', holderName: 'Jose da Silva', brand: 'MASTERCARD' };
const CUSTOMER = { name: 'Jose da Silva', email: 'jose.silva@teste-ligadobem.com', taxId: '12345678909', phone: '14999999999' };
const ADDRESS = {
  street: 'Rua Major Matheus',
  number: '100',
  locality: 'Centro',
  city: 'Botucatu',
  regionCode: 'SP',
  postalCode: '18600000',
};

/**
 * Mesmo resultado do PagSeguro.encryptCard() do SDK oficial (usado no app):
 * RSA PKCS#1 v1.5 com a chave pública da conta sobre "número;cvv;mês;ano;titular;timestamp", em base64.
 */
export function encryptCardLikeSdk(publicKey: string, card: { number: string; securityCode: string; expMonth: string; expYear: string; holderName: string }) {
  const b64 = publicKey.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const pem = `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----\n`;
  const plain = [card.number, card.securityCode, card.expMonth, card.expYear, card.holderName, Date.now()].join(';');
  return crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(plain, 'utf8')).toString('base64');
}

type Step = { title: string; ok: boolean; note: string; calls: PagBankCallLog[] };

async function ensureTables(db: any) {
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS pagbank_homolog (
       id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload JSONB NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
     )`,
  );
}

/** Webhook do sandbox com a nossa referência de homologação: só guarda (nunca libera nada). */
export async function captureHomologWebhook(db: any, body: any, headers: any, signatureValidForSandbox: boolean | null) {
  const ref = String(body?.reference_id || body?.charges?.[0]?.reference_id || '');
  if (!ref.startsWith(HOMOLOG_PREFIX) || !db) return false;
  try {
    await ensureTables(db);
    await db.$executeRawUnsafe(
      `INSERT INTO pagbank_homolog (id, kind, payload) VALUES ($1, 'WEBHOOK', $2::jsonb)`,
      crypto.randomUUID(),
      JSON.stringify({
        receivedAt: new Date().toISOString(),
        headers: {
          'content-type': headers?.['content-type'] || null,
          'x-authenticity-token': headers?.['x-authenticity-token'] ? '(presente)' : '(ausente)',
        },
        signatureValidForSandbox,
        body,
      }),
    );
  } catch (e: any) {
    console.warn('⚠️ homologação: webhook não guardado:', e?.message);
  }
  return true;
}

export async function runHomologation(db: any, opts: { token: string; notificationUrl: string }) {
  const steps: Step[] = [];
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const ref = (s: string) => `${HOMOLOG_PREFIX}-${stamp}-${s}`;

  const step = async (title: string, fn: (note: (t: string) => void) => Promise<void>) => {
    const calls: PagBankCallLog[] = [];
    let note = '';
    let ok = true;
    try {
      await runWithPagBank({ token: opts.token, env: 'sandbox' }, (c) => calls.push(c), () => fn((t) => (note = t)));
    } catch (e: any) {
      ok = false;
      note = note ? `${note} — ${e?.message}` : String(e?.message || e);
    }
    steps.push({ title, ok, note, calls });
  };

  let publicKey = '';
  await step('1. Chave pública para criptografar o cartão (GET /public-keys/card)', async (note) => {
    publicKey = await getPagBankCardPublicKey();
    note('Chave obtida; o app criptografa o cartão no aparelho com PagSeguro.encryptCard().');
  });

  await step('2. Parcelas e juros do cartão (GET /charges/fees/calculate)', async (note) => {
    const plans = await getPagBankInstallmentPlans({ valueCents: 12000, cardBin: CARD_OK.number.slice(0, 6), maxInstallments: 12 });
    note(`${plans.length} opção(ões) de parcelamento para R$ 120,00.`);
  });

  let pixOrderId = '';
  await step('3. Pedido com PIX — mensalidade de membro (POST /orders)', async (note) => {
    const r = await createPagBankOrder({
      referenceId: ref('PIX'),
      amountCents: 2000,
      description: 'Liga do Bem - mensalidade de membro',
      customer: CUSTOMER,
      method: 'PIX',
      notificationUrl: opts.notificationUrl,
    } as any);
    pixOrderId = r.id;
    note(`Pedido ${r.id}; QR Code ${r.pixCopyPaste ? 'gerado' : 'NÃO gerado'}.`);
    if (!r.pixCopyPaste) throw new Error('Resposta sem QR Code PIX');
  });

  await step('4. Consulta do pedido PIX (GET /orders/{id})', async (note) => {
    if (!pixOrderId) throw new Error('Sem pedido PIX do passo anterior');
    const r = await getPagBankOrder(pixOrderId);
    note(`Situação: ${r.status || 'aguardando pagamento'}.`);
  });

  await step('5. Pedido com boleto — doação (POST /orders)', async (note) => {
    const r = await createPagBankOrder({
      referenceId: ref('BOLETO'),
      amountCents: 5000,
      description: 'Liga do Bem - doacao',
      customer: CUSTOMER,
      method: 'BOLETO',
      address: ADDRESS,
      notificationUrl: opts.notificationUrl,
    } as any);
    note(`Pedido ${r.id}; situação ${r.status}; boleto ${r.boletoUrl ? 'gerado' : 'sem link'}.`);
  });

  const payCard = async (card: typeof CARD_OK, suffix: string, amountCents: number) => {
    let usedEncrypted = false;
    let r: any;
    if (publicKey) {
      try {
        const encrypted = encryptCardLikeSdk(publicKey, card);
        usedEncrypted = true;
        r = await createPagBankOrder({
          referenceId: ref(suffix),
          amountCents,
          description: 'Liga do Bem - plano de membro',
          customer: CUSTOMER,
          method: 'CREDIT_CARD',
          installments: 1,
          card: { encrypted },
          notificationUrl: opts.notificationUrl,
        } as any);
      } catch (e: any) {
        // Se o sandbox recusar a criptografia feita no servidor, repete com o cartão de teste aberto
        if (!/encrypt/i.test(String(e?.message))) throw e;
        usedEncrypted = false;
      }
    }
    if (!r) {
      r = await createPagBankOrder({
        referenceId: ref(`${suffix}-B`),
        amountCents,
        description: 'Liga do Bem - plano de membro',
        customer: CUSTOMER,
        method: 'CREDIT_CARD',
        installments: 1,
        card: { number: card.number, expMonth: card.expMonth, expYear: card.expYear, securityCode: card.securityCode, holderName: card.holderName },
        notificationUrl: opts.notificationUrl,
      } as any);
    }
    return { r, usedEncrypted };
  };

  let paidChargeId = '';
  await step(`6. Cartão de crédito aprovado — ${CARD_OK.brand} de teste (POST /orders)`, async (note) => {
    const { r, usedEncrypted } = await payCard(CARD_OK, 'CARTAO-OK', 12000);
    const charge = r.raw?.charges?.[0];
    paidChargeId = charge?.id || '';
    note(`Pedido ${r.id}; cobrança ${charge?.id} = ${charge?.status} (${charge?.payment_response?.message || '-'}); cartão ${usedEncrypted ? 'criptografado (encrypted)' : 'de teste em aberto'}.`);
    if (!['PAID', 'AUTHORIZED'].includes(String(charge?.status))) throw new Error(`Esperado PAID/AUTHORIZED, veio ${charge?.status}`);
  });

  await step(`7. Cartão de crédito recusado — ${CARD_DECLINED.brand} de teste (POST /orders)`, async (note) => {
    const { r } = await payCard(CARD_DECLINED, 'CARTAO-RECUSADO', 12000);
    const charge = r.raw?.charges?.[0];
    note(`Cobrança ${charge?.id} = ${charge?.status} (${charge?.payment_response?.message || '-'}); o app mostra a recusa ao membro.`);
    if (String(charge?.status) !== 'DECLINED') throw new Error(`Esperado DECLINED, veio ${charge?.status}`);
  });

  await step('8. Estorno da cobrança aprovada (POST /charges/{id}/cancel)', async (note) => {
    if (!paidChargeId) throw new Error('Sem cobrança aprovada do passo 6');
    const r = await cancelPagBankCharge(paidChargeId, 12000);
    note(`Situação após estorno: ${r.status}.`);
  });

  const report = { generatedAt: new Date().toISOString(), env: 'sandbox', notificationUrl: opts.notificationUrl, steps };
  if (db) {
    try {
      await ensureTables(db);
      await db.$executeRawUnsafe(`INSERT INTO pagbank_homolog (id, kind, payload) VALUES ($1, 'REPORT', $2::jsonb)`, crypto.randomUUID(), JSON.stringify(report));
    } catch (e: any) {
      console.warn('⚠️ homologação: relatório não guardado:', e?.message);
    }
  }
  return report;
}

const json = (v: any) => JSON.stringify(v, null, 2);

export function reportToText(report: any, webhooks: any[] = []) {
  const out: string[] = [];
  out.push('LIGA DO BEM BOTUCATU — Integração PagBank (API de Pedidos)');
  out.push(`Ambiente: SANDBOX · gerado em ${report.generatedAt}`);
  out.push(`URL de notificação (webhook): ${report.notificationUrl}`);
  out.push('Token de autenticação mascarado em todas as requisições. Dados de cliente e cartões de teste da documentação PagBank.');
  out.push('');
  for (const s of report.steps || []) {
    out.push('='.repeat(78));
    out.push(`${s.title}  [${s.ok ? 'OK' : 'FALHOU'}]`);
    if (s.note) out.push(s.note);
    for (const c of s.calls || []) {
      out.push('-'.repeat(78));
      out.push(`REQUEST  ${c.method} ${c.url}   (${c.at})`);
      out.push(`Headers: ${json(c.requestHeaders)}`);
      if (c.requestBody != null) out.push(`Body:\n${json(c.requestBody)}`);
      out.push('');
      out.push(`RESPONSE ${c.status}   (${c.ms} ms)`);
      if (c.responseHeaders && Object.keys(c.responseHeaders).length) out.push(`Headers: ${json(c.responseHeaders)}`);
      out.push(`Body:\n${json(c.responseBody)}`);
    }
    out.push('');
  }
  out.push('='.repeat(78));
  out.push(`NOTIFICAÇÕES (WEBHOOK) RECEBIDAS DO SANDBOX: ${webhooks.length}`);
  for (const w of webhooks) {
    out.push('-'.repeat(78));
    out.push(`POST ${report.notificationUrl}   (${w.receivedAt})`);
    out.push(`Headers: ${json(w.headers)}`);
    out.push(`Body:\n${json(w.body)}`);
    out.push('RESPONSE 200 {"received":true}');
  }
  if (!webhooks.length) out.push('(Ainda nenhuma. O sandbox costuma enviar alguns segundos/minutos depois — gere o arquivo de novo pelo botão "Baixar relatório".)');
  return out.join('\n');
}

export async function loadLatest(db: any) {
  await ensureTables(db);
  const rep: any[] = await db.$queryRawUnsafe(`SELECT payload, "createdAt" FROM pagbank_homolog WHERE kind = 'REPORT' ORDER BY "createdAt" DESC LIMIT 1`);
  if (!rep[0]) return null;
  const since = rep[0].createdAt;
  const wh: any[] = await db.$queryRawUnsafe(
    `SELECT payload FROM pagbank_homolog WHERE kind = 'WEBHOOK' AND "createdAt" >= $1 ORDER BY "createdAt" ASC LIMIT 50`,
    since,
  );
  return { report: rep[0].payload, webhooks: wh.map((w) => w.payload) };
}

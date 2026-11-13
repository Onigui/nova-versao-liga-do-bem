/**
 * Qual gateway de pagamento a ONG da requisição usa, e funções que servem para os dois.
 *
 * Regra: Asaas é o padrão. A ONG com conta Asaas conectada cobra pelo Asaas; quem só tem
 * PagBank continua no PagBank. A Liga também é Asaas (PAYMENTS_PROVIDER=pagbank força a volta).
 * Cada pagamento guarda o seu gateway (coluna payments.gateway), então a consulta, o webhook
 * e o estorno sempre vão no gateway certo, mesmo depois de a ONG trocar.
 */
import { currentOrgId, DEFAULT_ORG, isolationOn } from './tenant';
import {
  cancelPagBankCharge,
  createPagBankOrder,
  getPagBankCardPublicKey,
  getPagBankConfig,
  getPagBankInstallmentPlans,
  getPagBankOrder,
  isPaidChargeStatus,
  mapPagBankStatusToPayment,
  pagbankWebhookUrl,
  type CreateOrderInput,
  type PagBankOrderResult,
} from './pagbank';
import {
  ASAAS_MIN_CENTS,
  asaasInstallmentOptions,
  createAsaasPayment,
  getAsaasConfig,
  getAsaasPayment,
  isAsaasPaid,
  mapAsaasStatus,
  refundAsaasPayment,
} from './asaas';

export type Gateway = 'ASAAS' | 'PAGBANK';

export function activeGateway(): Gateway {
  const isLiga = !isolationOn() || currentOrgId() === DEFAULT_ORG;
  const forced = String(process.env.PAYMENTS_PROVIDER || '').trim().toUpperCase();
  if (isLiga && (forced === 'PAGBANK' || forced === 'ASAAS')) return forced as Gateway;
  // Asaas para todas, Liga incluída. PAYMENTS_PROVIDER=pagbank só como volta de emergência.
  if (getAsaasConfig().configured) return 'ASAAS';
  if (getPagBankConfig().configured) return 'PAGBANK';
  return 'ASAAS';
}

export function paymentsReady() {
  return activeGateway() === 'ASAAS' ? getAsaasConfig().configured : getPagBankConfig().configured;
}

/** O que o app precisa saber para montar a tela de pagamento. */
export function paymentsInfo() {
  const gateway = activeGateway();
  const asaas = gateway === 'ASAAS';
  return {
    gateway,
    ready: paymentsReady(),
    env: asaas ? getAsaasConfig().env : getPagBankConfig().env,
    // Asaas: o cartão é digitado na página segura do Asaas, não no app
    hostedCard: asaas,
    minAmountCents: asaas ? ASAAS_MIN_CENTS : 100,
    gatewayName: asaas ? 'Asaas' : 'PagBank',
  };
}

export async function createGatewayOrder(input: CreateOrderInput & { feeRate?: number }): Promise<PagBankOrderResult & { gateway: Gateway; splitFeeCents: number }> {
  if (activeGateway() === 'ASAAS') {
    const r = await createAsaasPayment(input);
    return { ...r, gateway: 'ASAAS' };
  }
  const r = await createPagBankOrder(input);
  return { ...r, gateway: 'PAGBANK', splitFeeCents: 0 };
}

export async function getGatewayOrder(gateway: string | null | undefined, id: string): Promise<PagBankOrderResult> {
  return String(gateway || '').toUpperCase() === 'ASAAS' ? getAsaasPayment(id) : getPagBankOrder(id);
}

export function isPaidStatus(status?: string | null) {
  return isPaidChargeStatus(status) || isAsaasPaid(status);
}

export function mapGatewayStatus(gateway: string | null | undefined, status?: string | null) {
  return String(gateway || '').toUpperCase() === 'ASAAS' ? mapAsaasStatus(status) : mapPagBankStatusToPayment(status);
}

export function isDeclinedStatus(status?: string | null) {
  return ['DECLINED', 'CANCELED', 'CANCELLED', 'REFUSED'].includes(String(status || '').toUpperCase());
}

/** Estorno no gateway em que o pagamento foi feito. */
export async function refundGatewayCharge(gateway: string | null | undefined, chargeId: string, amountCents: number) {
  return String(gateway || '').toUpperCase() === 'ASAAS' ? refundAsaasPayment(chargeId, amountCents) : cancelPagBankCharge(chargeId, amountCents);
}

/** Opções de parcelamento do gateway atual. Asaas: sem juros, até `maxInstallments`. */
export async function gatewayInstallmentPlans(p: { valueCents: number; cardBin?: string; maxInstallments?: number }) {
  if (activeGateway() === 'ASAAS') return asaasInstallmentOptions(p.valueCents, p.maxInstallments ?? 12);
  return getPagBankInstallmentPlans({ valueCents: p.valueCents, cardBin: p.cardBin });
}

/** Chave para criptografar o cartão no aparelho. Asaas não usa (cartão na página do Asaas). */
export async function gatewayCardPublicKey(): Promise<string | null> {
  return activeGateway() === 'ASAAS' ? null : getPagBankCardPublicKey();
}

export function gatewayNotificationUrl(apiBase: string) {
  // O Asaas avisa pelo webhook cadastrado na conta; o PagBank, pela URL de cada pedido
  return pagbankWebhookUrl(apiBase);
}

/** Mensagem curta para quando o cartão é pago na página do gateway. */
export const HOSTED_CARD_MESSAGE = 'Abra a página segura de pagamento e digite o cartão lá. Esta tela atualiza sozinha quando o pagamento for aprovado.';

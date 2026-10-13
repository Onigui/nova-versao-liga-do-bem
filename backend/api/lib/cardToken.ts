/**
 * Código da carteirinha (QR) assinado e com validade curta.
 *
 * Formato: LDB2.<memberId>.<expiraEm (unix s)>.<assinatura>
 *   assinatura = HMAC-SHA256(segredo, "LDB2.<memberId>.<exp>") em base64url, 22 caracteres.
 *
 * O app do membro pede um código novo ao servidor e renova sozinho antes de expirar,
 * então um print ou foto da tela deixa de valer em poucos minutos.
 * O formato antigo (LIGADOBEM|memberId|userId) não tem assinatura e é RECUSADO,
 * a menos que CARD_QR_ACCEPT_LEGACY = 'true' (só para emergência).
 *
 * Sem câmera, o parceiro digita o número da carteirinha + o código de 6 números que aparece
 * embaixo do QR. Esse código também muda a cada 10 minutos (vale a janela atual e a anterior).
 */
import crypto from 'crypto';

export const CARD_TOKEN_PREFIX = 'LDB2';
export const CARD_TOKEN_TTL_SECONDS = 10 * 60;
const SIG_LEN = 22;
const MEMBER_ID_RE = /^[A-Za-z0-9_-]{3,40}$/;

/** Segredo próprio do QR, derivado do JWT_SECRET (não exige variável nova). */
export function cardTokenSecret(jwtSecret: string): Buffer {
  if (!jwtSecret) throw new Error('JWT_SECRET ausente');
  return crypto.createHmac('sha256', jwtSecret).update('liga-do-bem/card-qr/v2').digest();
}

function sign(secret: Buffer, memberId: string, exp: number): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${CARD_TOKEN_PREFIX}.${memberId}.${exp}`)
    .digest('base64url')
    .slice(0, SIG_LEN);
}

export function issueCardToken(
  secret: Buffer,
  memberId: string,
  nowMs = Date.now(),
  ttlSeconds = CARD_TOKEN_TTL_SECONDS,
): { code: string; expiresAt: string; ttlSeconds: number } {
  if (!MEMBER_ID_RE.test(memberId)) throw new Error('memberId inválido');
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  return {
    code: `${CARD_TOKEN_PREFIX}.${memberId}.${exp}.${sign(secret, memberId, exp)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
    ttlSeconds,
  };
}

export type ParsedCardCode =
  | { ok: true; kind: 'SIGNED'; memberId: string; expiresAt: string }
  | { ok: true; kind: 'LEGACY'; memberId: string; userId: string }
  | { ok: true; kind: 'MANUAL'; memberId: string }
  | {
      ok: false;
      reason: 'EXPIRED' | 'INVALID_SIGNATURE' | 'LEGACY_DISABLED' | 'UNRECOGNIZED' | 'CODE_REQUIRED' | 'WRONG_CODE';
      memberId?: string;
    };

export function legacyQrAccepted(): boolean {
  return String(process.env.CARD_QR_ACCEPT_LEGACY || '').toLowerCase() === 'true';
}

export const SHORT_CODE_WINDOW_SECONDS = 10 * 60;

/** Código de 6 números da janela de 10 min (para digitar quando a câmera não lê o QR). */
export function cardShortCode(secret: Buffer, memberId: string, nowMs = Date.now(), windowOffset = 0): string {
  const w = Math.floor(nowMs / 1000 / SHORT_CODE_WINDOW_SECONDS) + windowOffset;
  const h = crypto.createHmac('sha256', secret).update(`short.${memberId.toUpperCase()}.${w}`).digest();
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

/** Quando o código de 6 números atual deixa de valer (fim da janela seguinte). */
export function cardShortCodeExpiresAt(nowMs = Date.now()): string {
  const w = Math.floor(nowMs / 1000 / SHORT_CODE_WINDOW_SECONDS);
  return new Date((w + 2) * SHORT_CODE_WINDOW_SECONDS * 1000).toISOString();
}

function shortCodeMatches(secret: Buffer, memberId: string, code: string, nowMs: number): boolean {
  for (const off of [0, -1]) {
    const a = Buffer.from(cardShortCode(secret, memberId, nowMs, off));
    const b = Buffer.from(code);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Interpreta o que o parceiro escaneou ou digitou. Não consulta o banco. */
export function parseCardCode(raw: unknown, secret: Buffer, nowMs = Date.now()): ParsedCardCode {
  const text = String(raw ?? '').trim();
  if (!text || text.length > 200) return { ok: false, reason: 'UNRECOGNIZED' };

  if (text.startsWith(`${CARD_TOKEN_PREFIX}.`)) {
    const parts = text.split('.');
    if (parts.length !== 4) return { ok: false, reason: 'UNRECOGNIZED' };
    const [, memberId, expRaw, sig] = parts;
    const exp = Number(expRaw);
    if (!MEMBER_ID_RE.test(memberId) || !Number.isInteger(exp) || sig.length !== SIG_LEN) {
      return { ok: false, reason: 'UNRECOGNIZED' };
    }
    const expected = Buffer.from(sign(secret, memberId, exp));
    const got = Buffer.from(sig);
    if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) {
      return { ok: false, reason: 'INVALID_SIGNATURE' };
    }
    if (exp * 1000 < nowMs) return { ok: false, reason: 'EXPIRED' };
    return { ok: true, kind: 'SIGNED', memberId, expiresAt: new Date(exp * 1000).toISOString() };
  }

  if (text.startsWith('LIGADOBEM|')) {
    const [, memberId, userId] = text.split('|');
    if (!memberId || !userId || !MEMBER_ID_RE.test(memberId)) return { ok: false, reason: 'UNRECOGNIZED' };
    if (!legacyQrAccepted()) return { ok: false, reason: 'LEGACY_DISABLED' };
    return { ok: true, kind: 'LEGACY', memberId, userId };
  }

  // Digitado à mão: número da carteirinha + código de 6 números (ex.: "MEM12345678 482913")
  const typed = text.toUpperCase().replace(/[.\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const [first, ...rest] = typed.split(' ');
  let m: string[] | null = null;
  if (rest.length) {
    const code = rest.join('');
    if (/^MEM\d{4,20}$/.test(first) && /^\d{6}$/.test(code)) m = [typed, first, code];
    else if (/^MEM\d{4,20}$/.test(first) && !code) m = [typed, first, ''];
  } else if (/^MEM\d{14}$/.test(first)) {
    m = [first, first.slice(0, 11), first.slice(11)]; // MEM + 8 números + código colado
  } else if (/^MEM\d{4,20}$/.test(first)) {
    m = [first, first, ''];
  }
  if (m) {
    const memberId = m[1];
    if (!m[2]) return { ok: false, reason: 'CODE_REQUIRED', memberId };
    if (!shortCodeMatches(secret, memberId, m[2], nowMs)) return { ok: false, reason: 'WRONG_CODE', memberId };
    return { ok: true, kind: 'MANUAL', memberId };
  }

  return { ok: false, reason: 'UNRECOGNIZED' };
}

export const CARD_CODE_ERRORS: Record<string, string> = {
  EXPIRED: 'Este QR expirou. Peça para o membro abrir a carteirinha no app de novo.',
  INVALID_SIGNATURE: 'QR inválido ou adulterado. Não aceite esta carteirinha.',
  LEGACY_DISABLED: 'QR antigo não é mais aceito. Peça para o membro atualizar o app.',
  UNRECOGNIZED: 'Código não reconhecido. Escaneie o QR da carteirinha ou digite o número (MEM...) e o código de 6 números.',
  CODE_REQUIRED: 'Digite também o código de 6 números que aparece embaixo do QR, na carteirinha do membro.',
  WRONG_CODE: 'Código de 6 números incorreto ou vencido. Peça para o membro abrir a carteirinha de novo e confira.',
};

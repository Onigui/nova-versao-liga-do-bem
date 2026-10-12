/**
 * Código da carteirinha (QR) assinado e com validade curta.
 *
 * Formato: LDB2.<memberId>.<expiraEm (unix s)>.<assinatura>
 *   assinatura = HMAC-SHA256(segredo, "LDB2.<memberId>.<exp>") em base64url, 22 caracteres.
 *
 * O app do membro pede um código novo ao servidor e renova sozinho antes de expirar,
 * então um print ou foto da tela deixa de valer em poucos minutos.
 * O formato antigo (LIGADOBEM|memberId|userId) não tem assinatura e só é aceito
 * enquanto CARD_QR_ACCEPT_LEGACY != 'false' (transição para quem não atualizou o app).
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
  | { ok: false; reason: 'EXPIRED' | 'INVALID_SIGNATURE' | 'LEGACY_DISABLED' | 'UNRECOGNIZED' };

export function legacyQrAccepted(): boolean {
  return String(process.env.CARD_QR_ACCEPT_LEGACY || '').toLowerCase() !== 'false';
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

  // Número da carteirinha digitado à mão (ex.: MEM12345678)
  const typed = text.toUpperCase().replace(/\s+/g, '');
  if (/^MEM\d{4,20}$/.test(typed)) return { ok: true, kind: 'MANUAL', memberId: typed };

  return { ok: false, reason: 'UNRECOGNIZED' };
}

export const CARD_CODE_ERRORS: Record<string, string> = {
  EXPIRED: 'Este QR expirou. Peça para o membro abrir a carteirinha no app de novo.',
  INVALID_SIGNATURE: 'QR inválido ou adulterado. Não aceite esta carteirinha.',
  LEGACY_DISABLED: 'QR antigo não é mais aceito. Peça para o membro atualizar o app.',
  UNRECOGNIZED: 'Código não reconhecido. Escaneie o QR da carteirinha ou digite o número (MEM...).',
};

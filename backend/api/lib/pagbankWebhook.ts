/**
 * Autenticidade das notificações do PagBank.
 * O PagBank envia o header x-authenticity-token = SHA-256 (hex) de "{token}-{corpo cru}".
 * Doc: https://developer.pagbank.com.br/docs/confirmar-autenticidade-da-notificacao
 */
import crypto from 'crypto';

export function pagbankWebhookSignature(token: string, rawBody: string): string {
  return crypto.createHash('sha256').update(`${token}-${rawBody}`, 'utf8').digest('hex');
}

export function verifyPagBankWebhook(token: string, rawBody: string, received?: string | null): boolean {
  if (!token || !received) return false;
  const expected = Buffer.from(pagbankWebhookSignature(token, rawBody), 'utf8');
  const got = Buffer.from(String(received).trim().toLowerCase(), 'utf8');
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

/**
 * Lê o corpo cru da requisição. O runtime Node da Vercel guarda o corpo e o reapresenta
 * no stream (restoreBody), então os bytes são exatamente os que o PagBank assinou.
 * Retorna null se nada chegar em `timeoutMs`.
 */
export function readRawBody(req: any, timeoutMs = 2000): Promise<string | null> {
  if (typeof req?.rawBody === 'string') return Promise.resolve(req.rawBody);
  if (Buffer.isBuffer(req?.rawBody)) return Promise.resolve(req.rawBody.toString('utf8'));
  if (typeof req?.on !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(chunks.length ? Buffer.concat(chunks).toString('utf8') : null), timeoutMs);
    req.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => finish(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => finish(null));
  });
}

export type WebhookSignatureMode = 'monitor' | 'enforce' | 'off';

export function webhookSignatureMode(): WebhookSignatureMode {
  const v = String(process.env.PAGBANK_WEBHOOK_SIGNATURE || 'monitor').toLowerCase();
  return v === 'enforce' || v === 'off' ? v : 'monitor';
}

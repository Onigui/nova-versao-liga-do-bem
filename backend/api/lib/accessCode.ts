/**
 * Códigos de acesso de 6 dígitos (tabela password_reset_tokens), usados para:
 *  - "Esqueci a senha" (código enviado por e-mail, vale 15 min)
 *  - primeiro acesso gerado pelo admin ou pelo responsável do parceiro (vale 72 h),
 *    entregue por WhatsApp/pessoalmente — não depende de e-mail.
 * A troca de senha (/api/auth/reset-password) aceita qualquer código válido do e-mail.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const MAX_CODE_ATTEMPTS = 5;
export const ADMIN_CODE_TTL_HOURS = 72;

let ensured = false;
export async function ensureAccessCodeSchema(db: any) {
  if (ensured) return;
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY, email TEXT NOT NULL, code TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW())`);
  await db.$executeRawUnsafe(`ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0`);
  await db.$executeRawUnsafe(`ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS source TEXT`);
  ensured = true;
}

/** Cria um código novo para o e-mail. Os anteriores só morrem quando este for confirmado (onIssued). */
export async function createAccessCode(
  db: any,
  email: string,
  opts: { ttlMinutes: number; source: 'EMAIL' | 'ADMIN' | 'PARTNER_OWNER' },
) {
  await ensureAccessCodeSchema(db);
  const code = String(crypto.randomInt(100000, 1000000));
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + opts.ttlMinutes * 60 * 1000);
  await db.$executeRawUnsafe(
    `INSERT INTO password_reset_tokens (id, email, code, "expiresAt", "createdAt", source)
     VALUES ($1, $2, $3, $4, NOW(), $5)`,
    id,
    email.toLowerCase(),
    await bcrypt.hash(code, 10),
    expiresAt,
    opts.source,
  );
  return {
    id,
    code,
    expiresAt,
    /** Invalida os códigos anteriores do e-mail (chamar só depois que o novo foi entregue). */
    supersedeOthers: () =>
      db.$executeRawUnsafe(
        `UPDATE password_reset_tokens SET "usedAt" = NOW()
          WHERE lower(email) = lower($1) AND "usedAt" IS NULL AND id <> $2`,
        email,
        id,
      ),
    /** Descarta este código (entrega falhou). */
    discard: () => db.$executeRawUnsafe(`UPDATE password_reset_tokens SET "usedAt" = NOW() WHERE id = $1`, id),
  };
}

/** Código gerado por quem libera o acesso (admin/responsável): vale 72 h e substitui os anteriores. */
export async function issueManualAccessCode(db: any, email: string, source: 'ADMIN' | 'PARTNER_OWNER') {
  const c = await createAccessCode(db, email, { ttlMinutes: ADMIN_CODE_TTL_HOURS * 60, source });
  await c.supersedeOthers();
  return { code: c.code, expiresAt: c.expiresAt.toISOString() };
}

/**
 * Confere o código. Cada erro conta tentativa em todos os códigos pendentes do e-mail;
 * na 5ª tentativa errada eles são invalidados (impede adivinhar os 6 dígitos).
 */
export async function verifyAccessCode(db: any, email: string, code: string) {
  await ensureAccessCodeSchema(db);
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT id, code, attempts FROM password_reset_tokens
      WHERE lower(email) = lower($1) AND "usedAt" IS NULL AND "expiresAt" > NOW() AND attempts < $2
      ORDER BY "createdAt" DESC LIMIT 5`,
    email,
    MAX_CODE_ATTEMPTS,
  );
  for (const row of rows) {
    if (String(row.code || '').startsWith('$2') && (await bcrypt.compare(code, row.code))) {
      return { ok: true as const, tokenId: row.id };
    }
  }
  if (rows.length) {
    await db.$executeRawUnsafe(
      `UPDATE password_reset_tokens SET attempts = attempts + 1,
              "usedAt" = CASE WHEN attempts + 1 >= $2 THEN NOW() ELSE "usedAt" END
        WHERE lower(email) = lower($1) AND "usedAt" IS NULL`,
      email,
      MAX_CODE_ATTEMPTS,
    );
    const left = MAX_CODE_ATTEMPTS - (Math.max(...rows.map((r) => Number(r.attempts) || 0)) + 1);
    return { ok: false as const, attemptsLeft: Math.max(0, left) };
  }
  return { ok: false as const, attemptsLeft: 0 };
}

/** Mensagem pronta para mandar pelo WhatsApp. */
export function accessCodeMessage(opts: { name?: string | null; email: string; code: string; app: 'partner' | 'member'; partnerName?: string | null }) {
  const hello = opts.name ? `Olá, ${opts.name.split(' ')[0]}!` : 'Olá!';
  const appName = opts.app === 'partner' ? 'Liga do Bem Parceiros' : 'Liga do Bem';
  const where =
    opts.app === 'partner'
      ? `Abra o app ${appName}, toque em "Primeiro acesso / Esqueci a senha" e depois em "Já tenho um código".`
      : `Abra o app ${appName}, toque em "Esqueci minha senha" e depois em "Já tenho um código".`;
  return [
    hello,
    opts.partnerName ? `Seu acesso ao ${appName} (${opts.partnerName}) está liberado.` : `Seu acesso ao ${appName} está liberado.`,
    where,
    `E-mail: ${opts.email}`,
    `Código: ${opts.code}`,
    `O código vale por ${ADMIN_CODE_TTL_HOURS} horas. Depois é só criar sua senha.`,
  ].join('\n');
}

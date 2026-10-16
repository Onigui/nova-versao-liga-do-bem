/**
 * Caixa de avisos (sininho) dos dois apps. A tabela é a mesma (notifications, por usuário);
 * data.audience separa o que é do App Parceiros ('partner') do que é do app dos membros.
 */
import crypto from 'crypto';

export type Audience = 'member' | 'partner';

/** Filtro SQL para a coluna data (jsonb) de acordo com o app que está pedindo. */
export function audienceFilter(app: any, alias = '') {
  const col = `${alias ? `${alias}.` : ''}data`;
  return String(app || '').toLowerCase() === 'partner'
    ? `COALESCE(${col}->>'audience', 'member') = 'partner'`
    : `COALESCE(${col}->>'audience', 'member') <> 'partner'`;
}

export async function saveInbox(
  db: any,
  userIds: string[],
  title: string,
  message: string,
  data: Record<string, string>,
  audience: Audience,
) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  for (const uid of ids) {
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO notifications (id, "userId", title, message, type, data, "isRead", "sentAt")
         VALUES ($1, $2, $3, $4, 'GENERAL'::"NotificationType", $5::jsonb, false, NOW())`,
        crypto.randomUUID(),
        uid,
        title,
        message,
        JSON.stringify({...data, audience}),
      );
    } catch (e: any) {
      console.warn('⚠️ Caixa de avisos:', e?.message);
    }
  }
}

/** Usuários (logins) das empresas parceiras. */
export async function partnerUserIds(db: any, partnerIds: string[]): Promise<string[]> {
  if (!partnerIds.length) return [];
  try {
    const rows: any[] = await db.$queryRawUnsafe(
      `SELECT "userId" FROM partner_accounts WHERE "partnerId" = ANY($1::text[])`,
      partnerIds,
    );
    return rows.map((r) => String(r.userId));
  } catch {
    return [];
  }
}

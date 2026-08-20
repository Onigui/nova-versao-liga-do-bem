/**
 * Envio FCM (API legado). Configure FIREBASE_SERVER_KEY na Vercel.
 * Sem a chave, as notificações continuam sendo gravadas no app (in-app).
 */

export function getFirebaseServerKey() {
  return (
    process.env.FIREBASE_SERVER_KEY ||
    process.env.FCM_SERVER_KEY ||
    ''
  ).trim();
}

export async function sendFcmToTokens(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<{ attempted: number; success: number }> {
  const unique = [...new Set((tokens || []).filter(Boolean))];
  if (!unique.length) return { attempted: 0, success: 0 };

  const serverKey = getFirebaseServerKey();
  if (!serverKey) {
    console.warn('⚠️ FIREBASE_SERVER_KEY não configurada — push não enviado');
    return { attempted: unique.length, success: 0 };
  }

  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registration_ids: unique.slice(0, 1000),
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        priority: 'high',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('⚠️ FCM HTTP error:', response.status, text);
      return { attempted: unique.length, success: 0 };
    }

    const result: any = await response.json().catch(() => ({}));
    return {
      attempted: unique.length,
      success: Number(result.success || 0),
    };
  } catch (error) {
    console.warn('⚠️ FCM send failed:', error);
    return { attempted: unique.length, success: 0 };
  }
}

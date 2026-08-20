/**
 * Push via Firebase Cloud Messaging HTTP v1 (firebase-admin).
 * Android exige FCM da Google — não existe push “de verdade” no app fechado sem isso.
 * Configure na Vercel: FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço)
 * ou FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 */

let adminMod: any = null;
let initAttempted = false;

export const ALL_USERS_TOPIC = 'liga_do_bem_all';

function loadAdmin() {
  if (adminMod) return adminMod;
  try {
    adminMod = require('firebase-admin');
    return adminMod;
  } catch {
    console.warn('⚠️ firebase-admin não instalado');
    return null;
  }
}

function parseServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT não é um JSON válido');
    }
  }

  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  let privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  if (projectId && clientEmail && privateKey) {
    return { project_id: projectId, client_email: clientEmail, private_key: privateKey };
  }
  return null;
}

export function isPushConfigured() {
  return Boolean(parseServiceAccount());
}

function getMessaging() {
  const admin = loadAdmin();
  if (!admin) return null;
  const account = parseServiceAccount();
  if (!account) return null;

  if (!initAttempted) {
    initAttempted = true;
    if (!admin.apps?.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: account.project_id,
          clientEmail: account.client_email,
          privateKey: account.private_key,
        }),
      });
    }
  }

  if (!admin.apps?.length) return null;
  return admin.messaging();
}

function buildMessage(payload: {
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const data: Record<string, string> = {};
  Object.entries(payload.data || {}).forEach(([k, v]) => {
    data[k] = String(v ?? '');
  });
  return {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data,
    android: {
      priority: 'high' as const,
      notification: {
        channelId: 'liga-do-bem-default',
        sound: 'default',
      },
    },
  };
}

export async function subscribeTokenToAllTopic(token: string) {
  const messaging = getMessaging();
  if (!messaging || !token) return false;
  try {
    await messaging.subscribeToTopic([token], ALL_USERS_TOPIC);
    return true;
  } catch (error) {
    console.warn('⚠️ Falha ao inscrever token no tópico geral:', error);
    return false;
  }
}

export async function sendFcmToTopic(
  topic: string,
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<{ attempted: number; success: number }> {
  const messaging = getMessaging();
  if (!messaging) {
    console.warn('⚠️ Push não configurado (conta de serviço Firebase ausente)');
    return { attempted: 0, success: 0 };
  }
  try {
    await messaging.send({
      topic,
      ...buildMessage(payload),
    });
    return { attempted: 1, success: 1 };
  } catch (error) {
    console.warn('⚠️ FCM topic send failed:', error);
    return { attempted: 1, success: 0 };
  }
}

export async function sendFcmToTokens(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<{ attempted: number; success: number }> {
  const unique = [...new Set((tokens || []).filter(Boolean))];
  if (!unique.length) return { attempted: 0, success: 0 };

  const messaging = getMessaging();
  if (!messaging) {
    console.warn('⚠️ Push não configurado (conta de serviço Firebase ausente)');
    return { attempted: unique.length, success: 0 };
  }

  let success = 0;
  try {
    for (let i = 0; i < unique.length; i += 500) {
      const chunk = unique.slice(i, i + 500);
      const result = await messaging.sendEachForMulticast({
        tokens: chunk,
        ...buildMessage(payload),
      });
      success += Number(result.successCount || 0);
    }
    return { attempted: unique.length, success };
  } catch (error) {
    console.warn('⚠️ FCM send failed:', error);
    return { attempted: unique.length, success };
  }
}

/** @deprecated use isPushConfigured — mantido para compatibilidade */
export function getFirebaseServerKey() {
  return isPushConfigured() ? 'configured' : '';
}

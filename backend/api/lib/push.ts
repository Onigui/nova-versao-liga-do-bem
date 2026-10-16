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

export type FcmTokenResult = { token: string; ok: boolean; code?: string; message?: string; messageId?: string };

/** Códigos do Firebase que significam "este aparelho não existe mais" → desativar o token. */
const DEAD_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

let deadTokenHandler: ((tokens: string[]) => Promise<void> | void) | null = null;
/** index.ts registra aqui como desativar tokens mortos no banco. */
export function onDeadTokens(fn: (tokens: string[]) => Promise<void> | void) {
  deadTokenHandler = fn;
}

/** Envia e devolve o resultado de CADA aparelho (o Firebase não lança erro quando um aparelho recusa). */
export async function sendFcmDetailed(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<{ attempted: number; success: number; results: FcmTokenResult[]; error?: string }> {
  const unique = [...new Set((tokens || []).filter(Boolean))];
  if (!unique.length) return { attempted: 0, success: 0, results: [] };

  let messaging: any = null;
  try {
    messaging = getMessaging();
  } catch (e: any) {
    const msg = `Firebase não iniciou: ${e?.message || e}`;
    console.warn('⚠️ ' + msg);
    return { attempted: unique.length, success: 0, results: [], error: msg };
  }
  if (!messaging) {
    console.warn('⚠️ Push não configurado (conta de serviço Firebase ausente)');
    return { attempted: unique.length, success: 0, results: [], error: 'Push não configurado (conta de serviço Firebase ausente)' };
  }

  const results: FcmTokenResult[] = [];
  try {
    for (let i = 0; i < unique.length; i += 500) {
      const chunk = unique.slice(i, i + 500);
      const result = await messaging.sendEachForMulticast({
        tokens: chunk,
        ...buildMessage(payload),
      });
      (result.responses || []).forEach((r: any, idx: number) => {
        results.push(
          r.success
            ? { token: chunk[idx], ok: true, messageId: r.messageId }
            : { token: chunk[idx], ok: false, code: r.error?.code || r.error?.errorInfo?.code, message: r.error?.message },
        );
      });
    }
  } catch (error: any) {
    const msg = `${error?.code || ''} ${error?.message || error}`.trim();
    console.warn('⚠️ FCM send failed:', msg);
    return { attempted: unique.length, success: results.filter((r) => r.ok).length, results, error: msg };
  }

  const failed = results.filter((r) => !r.ok);
  const success = results.length - failed.length;
  if (failed.length) {
    const byCode: Record<string, number> = {};
    failed.forEach((f) => (byCode[f.code || 'desconhecido'] = (byCode[f.code || 'desconhecido'] || 0) + 1));
    console.warn(`⚠️ FCM: ${failed.length}/${results.length} aparelho(s) recusaram`, JSON.stringify(byCode), failed[0]?.message || '');
    const dead = failed.filter((f) => DEAD_CODES.has(String(f.code))).map((f) => f.token);
    if (dead.length && deadTokenHandler) {
      try {
        await deadTokenHandler(dead);
      } catch {
        /* ignora */
      }
    }
  } else {
    console.log(`📲 FCM: enviado para ${success} aparelho(s)`);
  }
  return { attempted: unique.length, success, results };
}

export async function sendFcmToTokens(
  tokens: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<{ attempted: number; success: number }> {
  const r = await sendFcmDetailed(tokens, payload);
  return { attempted: r.attempted, success: r.success };
}

/** Projeto Firebase do app (google-services.json). As credenciais da Vercel precisam ser deste projeto. */
export const EXPECTED_FIREBASE_PROJECT = 'liga-do-bem-botucatu-4c696';

/** Informações não secretas da configuração do push, para o diagnóstico no admin. */
export function pushConfigInfo() {
  const account: any = parseServiceAccount();
  const source = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim() ? 'FIREBASE_SERVICE_ACCOUNT' : account ? 'FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY' : null;
  const key = String(account?.private_key || '');
  return {
    configured: !!account,
    source,
    projectId: account?.project_id || null,
    expectedProjectId: EXPECTED_FIREBASE_PROJECT,
    projectMatches: account?.project_id === EXPECTED_FIREBASE_PROJECT,
    clientEmail: account?.client_email || null,
    clientEmailProject: String(account?.client_email || '').split('@')[1]?.split('.')[0] || null,
    privateKeyLooksValid: key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('-----END PRIVATE KEY-----') && key.includes('\n'),
  };
}

/** @deprecated use isPushConfigured — mantido para compatibilidade */
export function getFirebaseServerKey() {
  return isPushConfigured() ? 'configured' : '';
}

/**
 * Mantém a sessão viva. O token do login vale 7 dias; o app fica logado bem mais que isso.
 * Sem renovar, depois de 7 dias o servidor recusa tudo e o app mostrava "Conecte-se à internet"
 * no QR e "Quero ser membro" no Início, mesmo com a carteirinha ativa.
 *
 * - ensureFreshSession(): ao abrir/voltar ao app, troca o token por um novo (no máx. a cada 6 h).
 * - reportUnauthorized(): qualquer tela que receber 401 chama; renova uma vez e, se o servidor
 *   não aceitar mais a sessão, avisa o AuthProvider para levar ao login.
 *
 * Eventos (DeviceEventEmitter 'liga:session'): {type: 'refreshed', token, user} | {type: 'expired', message}
 */
import {DeviceEventEmitter} from 'react-native';
import {API_BASE_PATH} from '../config/apiConfig';

export const SESSION_EVENT = 'liga:session';
const LAST_KEY = 'auth_refreshed_at';
export const REFRESH_EVERY_MS = 6 * 60 * 60 * 1000;

let inFlight = null;

// require tardio: telas e contextos que só importam este módulo não precisam do módulo nativo
function storage() {
  const m = require('@react-native-async-storage/async-storage');
  return m.default || m;
}

async function doRefresh(fetchImpl) {
  const token = await storage().getItem('auth_token');
  if (!token) return {ok: false, reason: 'no-token'};
  let res;
  try {
    res = await fetchImpl(`${API_BASE_PATH}/auth/refresh`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${String(token).replace(/^Bearer\s+/i, '')}`},
      body: '{}',
    });
  } catch {
    return {ok: false, reason: 'offline'};
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok && data?.token) {
    await storage().setItem('auth_token', data.token);
    if (data.user) await storage().setItem('user_data', JSON.stringify(data.user));
    await storage().setItem(LAST_KEY, String(Date.now()));
    DeviceEventEmitter.emit(SESSION_EVENT, {type: 'refreshed', token: data.token, user: data.user || null});
    return {ok: true, token: data.token};
  }
  if (res.status === 401 || res.status === 403) {
    DeviceEventEmitter.emit(SESSION_EVENT, {
      type: 'expired',
      message: data?.error || 'Sua sessão expirou. Entre de novo.',
    });
    return {ok: false, reason: 'expired'};
  }
  return {ok: false, reason: `http-${res.status}`};
}

/** Renova agora (uma chamada por vez, mesmo se várias telas pedirem juntas). */
export function refreshSession(fetchImpl = fetch) {
  if (!inFlight) {
    inFlight = doRefresh(fetchImpl).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Renova se a última renovação foi há mais de 6 h (ou nunca). */
export async function ensureFreshSession(fetchImpl = fetch, now = Date.now()) {
  const last = Number((await storage().getItem(LAST_KEY)) || 0);
  if (last && now - last < REFRESH_EVERY_MS) return {ok: true, skipped: true};
  return refreshSession(fetchImpl);
}

/** Uma tela recebeu 401: tenta renovar; se não der, o AuthProvider leva ao login. */
export function reportUnauthorized(fetchImpl = fetch) {
  return refreshSession(fetchImpl);
}

export async function clearSessionMarks() {
  await storage().removeItem(LAST_KEY).catch(() => {});
}

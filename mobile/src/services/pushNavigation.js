/**
 * Toque na notificação push → abre a tela certa (data.screen + parâmetros).
 * Se o app estava fechado, guarda o destino e abre assim que a navegação e o login estiverem prontos.
 */
import {createNavigationContainerRef} from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

const ALIASES = {MembershipCard: 'Cartão'};
let pending = null;

export function targetFromMessage(remoteMessage) {
  const data = remoteMessage?.data || {};
  if (!data.screen) return null;
  const {screen, ...params} = data;
  return {name: ALIASES[screen] || screen, params};
}

function loggedIn() {
  const state = navigationRef.getRootState?.();
  return !!state?.routes?.some(r => r.name === 'App');
}

export function flushPendingNavigation() {
  if (!pending || !navigationRef.isReady() || !loggedIn()) return false;
  const t = pending;
  pending = null;
  try {
    navigationRef.navigate(t.name, t.params);
  } catch (e) {
    console.warn('Não foi possível abrir a tela da notificação:', e?.message);
  }
  return true;
}

export function openFromNotification(remoteMessage) {
  const t = targetFromMessage(remoteMessage);
  if (!t) return;
  pending = t;
  if (!flushPendingNavigation()) {
    // App ainda abrindo: tenta de novo por alguns segundos
    let tries = 0;
    const timer = setInterval(() => {
      if (flushPendingNavigation() || ++tries > 30) clearInterval(timer);
    }, 500);
  }
}

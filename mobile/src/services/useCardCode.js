/**
 * Código do QR da carteirinha, assinado pelo servidor e com validade curta (10 min).
 * Renova sozinho antes de vencer e quando o app volta para a frente. Sem internet, usa o
 * último código ainda válido; se não houver, cai no formato antigo (aceito na transição).
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_PATH} from '../config/apiConfig';

const CACHE_KEY = 'card_code_v2';
const RENEW_BEFORE_MS = 90 * 1000;
const MAX_REFRESH_MS = 4 * 60 * 1000;
const RETRY_MS = 30 * 1000;

export function nextRefreshDelay(expiresAt, now = Date.now()) {
  const exp = new Date(expiresAt).getTime();
  if (!Number.isFinite(exp)) return RETRY_MS;
  return Math.max(5000, Math.min(MAX_REFRESH_MS, exp - now - RENEW_BEFORE_MS));
}

export function isStillValid(entry, now = Date.now()) {
  return !!entry?.code && new Date(entry.expiresAt).getTime() - now > 15 * 1000;
}

export default function useCardCode({token, enabled, legacyCode, fetchImpl = fetch}) {
  const [state, setState] = useState({code: null, expiresAt: null, source: 'loading'});
  const timer = useRef(null);
  const alive = useRef(true);

  const schedule = useCallback(ms => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => refreshRef.current?.(), ms);
  }, []);

  const refreshRef = useRef(null);
  const refresh = useCallback(async () => {
    if (!enabled || !token) return;
    try {
      const res = await fetchImpl(`${API_BASE_PATH}/membership/card-token`, {
        headers: {Authorization: `Bearer ${token}`},
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.code) throw new Error('sem código');
      const entry = {code: data.code, expiresAt: data.expiresAt};
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry)).catch(() => {});
      if (!alive.current) return;
      setState({...entry, source: 'live'});
      schedule(nextRefreshDelay(entry.expiresAt));
    } catch {
      let cached = null;
      try {
        cached = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) || 'null');
      } catch {
        cached = null;
      }
      if (!alive.current) return;
      if (isStillValid(cached)) {
        setState({...cached, source: 'cached'});
      } else {
        setState({code: legacyCode || null, expiresAt: null, source: 'legacy'});
      }
      schedule(RETRY_MS);
    }
  }, [enabled, token, legacyCode, fetchImpl, schedule]);
  refreshRef.current = refresh;

  useEffect(() => {
    alive.current = true;
    refresh();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') refreshRef.current?.();
    });
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      sub?.remove?.();
    };
  }, [refresh]);

  return state;
}

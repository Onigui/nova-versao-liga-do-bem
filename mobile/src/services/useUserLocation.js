/**
 * Localização do membro para mostrar a distância até cada parceiro.
 *
 * - Mostra na hora a última posição conhecida (guardada no aparelho) e atualiza em seguida.
 * - Tenta GPS preciso; se demorar, aceita a localização aproximada (rede/Wi-Fi).
 * - Diferencia: permissão negada, negada para sempre (só nas configurações) e GPS desligado.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, Linking, PermissionsAndroid, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';

const CACHE_KEY = 'last_location_v1';
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

try {
  Geolocation.setRNConfiguration?.({
    skipPermissionRequests: true,
    authorizationLevel: 'whenInUse',
    locationProvider: 'auto',
  });
} catch {
  /* versões antigas da biblioteca */
}

function getPosition(options) {
  return new Promise((resolve, reject) =>
    Geolocation.getCurrentPosition(
      pos => resolve({latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy}),
      err => reject(err),
      options,
    ),
  );
}

async function checkPermission() {
  if (Platform.OS !== 'android') return 'granted';
  const fine = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  const coarse = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
  return fine || coarse ? 'granted' : 'unknown';
}

async function askPermission() {
  if (Platform.OS !== 'android') {
    return new Promise(resolve =>
      Geolocation.requestAuthorization(
        () => resolve('granted'),
        () => resolve('denied'),
      ),
    );
  }
  const r = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);
  const vals = Object.values(r);
  if (vals.includes(PermissionsAndroid.RESULTS.GRANTED)) return 'granted';
  if (vals.includes(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) return 'blocked';
  return 'denied';
}

/**
 * status: 'idle' | 'locating' | 'ok' | 'denied' | 'blocked' | 'off' | 'error'
 * `autoStart`: pede a permissão ao abrir (só se o membro não desligou a localização no perfil).
 */
export default function useUserLocation({autoStart = true} = {}) {
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState('idle');
  const alive = useRef(true);
  const busy = useRef(false);

  const locate = useCallback(async () => {
    try {
      const pos = await getPosition({enableHighAccuracy: true, timeout: 10000, maximumAge: 60000});
      return pos;
    } catch (e) {
      if (e?.code === 1) throw e;
      // GPS demorou ou está fraco (dentro de casa): aceita a posição aproximada
      return getPosition({enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000});
    }
  }, []);

  const refresh = useCallback(
    async ({ask = false} = {}) => {
      if (busy.current) return;
      busy.current = true;
      try {
        let perm = await checkPermission();
        if (perm !== 'granted') {
          if (!ask) {
            if (alive.current) setStatus(s => (s === 'ok' ? s : 'idle'));
            return;
          }
          perm = await askPermission();
        }
        if (perm !== 'granted') {
          if (alive.current) setStatus(perm === 'blocked' ? 'blocked' : 'denied');
          return;
        }
        if (alive.current) setStatus(s => (s === 'ok' ? 'ok' : 'locating'));
        const pos = await locate();
        if (!alive.current) return;
        setCoords(pos);
        setStatus('ok');
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify({...pos, at: Date.now()})).catch(() => {});
      } catch (e) {
        if (!alive.current) return;
        if (e?.code === 1) setStatus('denied');
        else if (e?.code === 2) setStatus(s => (s === 'ok' ? s : 'off'));
        else setStatus(s => (s === 'ok' ? s : 'error'));
      } finally {
        busy.current = false;
      }
    },
    [locate],
  );

  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const cached = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) || 'null');
        if (cached && Date.now() - cached.at < CACHE_MAX_AGE_MS && alive.current) {
          setCoords({latitude: cached.latitude, longitude: cached.longitude});
          setStatus('ok');
        }
      } catch {
        /* sem cache */
      }
      if (autoStart) refresh({ask: true});
      else refresh({ask: false});
    })();
    // Voltou das configurações (ligou o GPS ou deu a permissão): tenta de novo
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') refresh({ask: false});
    });
    return () => {
      alive.current = false;
      sub?.remove?.();
    };
  }, [autoStart, refresh]);

  const openSettings = useCallback(() => {
    if (Platform.OS === 'android' && status === 'off') {
      Linking.sendIntent?.('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings());
    } else {
      Linking.openSettings();
    }
  }, [status]);

  return {coords, status, request: () => refresh({ask: true}), openSettings};
}

/**
 * Dados do parceiro logado (empresa, papel, estatísticas) + cliente da API /api/partner/*.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {API_BASE_PATH} from '../config/apiConfig';
import {useAuth} from '../services/AuthService';

const PartnerContext = createContext(null);

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function makePartnerApi(token, fetchImpl = fetch) {
  return async function request(method, path, body) {
    let res;
    try {
      res = await fetchImpl(`${API_BASE_PATH}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new ApiError(0, 'Sem conexão com a internet. Tente de novo.');
    }
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) {
      throw new ApiError(
        res.status,
        data.error || data.message || `Erro ${res.status}`,
        data.code,
      );
    }
    return data;
  };
}

export function PartnerProvider({children}) {
  const {token, logout} = useAuth();
  const api = useMemo(() => makePartnerApi(token), [token]);
  const [state, setState] = useState({
    loading: true,
    error: null,
    partner: null,
    account: null,
    stats: null,
  });

  const refresh = useCallback(async () => {
    try {
      const data = await api('GET', '/partner/me');
      setState({
        loading: false,
        error: null,
        partner: data.partner,
        account: data.account,
        stats: data.stats,
      });
      return data;
    } catch (e) {
      if (e.status === 401) {
        // Sessão expirada: volta para o login
        logout();
        return null;
      }
      setState(s => ({...s, loading: false, error: e}));
      return null;
    }
  }, [api, logout]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      ...state,
      api,
      refresh,
      logout,
      isOwner: state.account?.role === 'OWNER',
      setPartner: partner => setState(s => ({...s, partner})),
    }),
    [state, api, refresh, logout],
  );
  return (
    <PartnerContext.Provider value={value}>{children}</PartnerContext.Provider>
  );
}

export function usePartner() {
  const ctx = useContext(PartnerContext);
  if (!ctx) throw new Error('usePartner fora do PartnerProvider');
  return ctx;
}

/** dd/mm/aaaa ⇄ Date */
export function formatDateBR(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', {timeZone: 'America/Sao_Paulo'});
}

export function formatDateTimeBR(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function maskDate(text) {
  const d = String(text || '')
    .replace(/\D/g, '')
    .slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/** "dd/mm/aaaa" → ISO (início ou fim do dia em Brasília). null se vazio, undefined se inválido. */
export function parseDateBR(text, endOfDay = false) {
  const t = String(text || '').trim();
  if (!t) return null;
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const [dd, mm, yyyy] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    probe.getUTCFullYear() !== yyyy ||
    probe.getUTCMonth() !== mm - 1 ||
    probe.getUTCDate() !== dd
  ) {
    return undefined; // ex.: 31/02
  }
  // Brasília = UTC-3 (sem horário de verão desde 2019)
  const ms =
    Date.UTC(
      yyyy,
      mm - 1,
      dd,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
    ) +
    3 * 3600e3;
  return new Date(ms).toISOString();
}

export const formatMoney = v =>
  `R$ ${Number(v || 0)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export const COLORS = {
  primary: '#0F766E',
  primaryDark: '#115E59',
  primarySoft: '#CCFBF1',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  ok: '#15803D',
  okSoft: '#DCFCE7',
  bad: '#B91C1C',
  badSoft: '#FEE2E2',
  warn: '#B45309',
  warnSoft: '#FEF3C7',
};

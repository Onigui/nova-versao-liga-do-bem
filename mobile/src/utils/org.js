/**
 * Dados da ONG de quem usa o app (nome, razão social, contatos, redes) e os textos editáveis
 * no painel (Sobre, termos, privacidade, adoção). Assim nenhum nome de ONG fica fixo no app.
 *
 * - GET /api/app/org e /api/app/docs/:kind (com o token, a API sabe de qual ONG é a pessoa).
 * - Cache em memória e no aparelho: a tela abre na hora com o último dado e atualiza por trás.
 */
import {useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_PATH} from '../config/apiConfig';

const ORG_KEY = 'org_info_v1';
const DOC_KEY = kind => `org_doc_v1_${kind}`;

/** Enquanto não carregou: genérico, nunca o nome de uma ONG específica. */
export const FALLBACK_ORG = {
  id: null,
  slug: null,
  name: 'sua ONG',
  legalName: 'sua ONG',
  cnpj: '',
  city: null,
  state: null,
  contacts: {},
  branding: {},
};

let memOrg = null;
let orgPromise = null;
const memDocs = {};

async function authHeaders() {
  try {
    const t = await AsyncStorage.getItem('auth_token');
    return t ? {Authorization: `Bearer ${t}`} : {};
  } catch {
    return {};
  }
}

async function readCache(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
async function writeCache(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sem cache */
  }
}

/** Busca a ONG na API (uma chamada por vez) e guarda no aparelho. */
export async function fetchOrg({fetchImpl = fetch, force = false} = {}) {
  if (memOrg && !force) return memOrg;
  if (orgPromise && !force) return orgPromise;
  orgPromise = (async () => {
    try {
      const r = await fetchImpl(`${API_BASE_PATH}/app/org`, {headers: await authHeaders()});
      const d = await r.json();
      if (r.ok && d?.org?.name) {
        memOrg = {...FALLBACK_ORG, ...d.org, contacts: d.org.contacts || {}};
        writeCache(ORG_KEY, memOrg);
        return memOrg;
      }
    } catch {
      /* sem rede: fica o cache */
    }
    return memOrg || (await readCache(ORG_KEY)) || FALLBACK_ORG;
  })();
  try {
    return await orgPromise;
  } finally {
    orgPromise = null;
  }
}

/** Esquece a ONG (troca de conta): a próxima tela busca de novo. */
export async function clearOrgCache() {
  memOrg = null;
  Object.keys(memDocs).forEach(k => delete memDocs[k]);
  try {
    const keys = ['about', 'terms', 'privacy', 'adoption'].map(DOC_KEY);
    await AsyncStorage.multiRemove([ORG_KEY, ...keys]);
  } catch {
    /* nada */
  }
}

/** Hook: devolve a ONG na hora (cache) e atualiza quando a API responder. */
export function useOrg({fetchImpl} = {}) {
  const [org, setOrg] = useState(memOrg || FALLBACK_ORG);
  useEffect(() => {
    let alive = true;
    if (!memOrg) {
      readCache(ORG_KEY).then(c => {
        if (alive && c && !memOrg) setOrg(c);
      });
    }
    fetchOrg({fetchImpl}).then(o => {
      if (alive && o) setOrg(o);
    });
    return () => {
      alive = false;
    };
  }, [fetchImpl]);
  return org;
}

/** Texto da ONG (Markdown já com os dados da ONG). */
export async function fetchDoc(kind, {fetchImpl = fetch} = {}) {
  try {
    const r = await fetchImpl(`${API_BASE_PATH}/app/docs/${kind}`, {headers: await authHeaders()});
    const d = await r.json();
    if (r.ok && d?.body) {
      memDocs[kind] = d;
      writeCache(DOC_KEY(kind), d);
      if (d.org?.name) memOrg = {...FALLBACK_ORG, ...d.org, contacts: d.org.contacts || {}};
      return d;
    }
  } catch {
    /* sem rede */
  }
  return memDocs[kind] || (await readCache(DOC_KEY(kind))) || null;
}

/** Hook: { doc, loading, error } para um texto. */
export function useDoc(kind, {fetchImpl} = {}) {
  const [state, setState] = useState({doc: memDocs[kind] || null, loading: !memDocs[kind], error: false});
  useEffect(() => {
    let alive = true;
    if (!memDocs[kind]) {
      readCache(DOC_KEY(kind)).then(c => {
        if (alive && c) setState(s => (s.doc ? s : {doc: c, loading: true, error: false}));
      });
    }
    fetchDoc(kind, {fetchImpl}).then(d => {
      if (alive) setState({doc: d, loading: false, error: !d});
    });
    return () => {
      alive = false;
    };
  }, [kind, fetchImpl]);
  return state;
}

/** "(14) 99999-9999" a partir de dígitos. */
export function formatPhone(p) {
  const d = String(p || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return d;
}

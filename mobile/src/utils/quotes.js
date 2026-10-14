/**
 * Orçamento em tempo real: utilitários compartilhados (app dos membros e App Parceiros).
 */
import {API_BASE_PATH} from '../config/apiConfig';

export const QUOTE_DEADLINES = [
  {hours: 2, label: 'Urgente (2 h)'},
  {hours: 24, label: '24 horas'},
  {hours: 48, label: '48 horas'},
];
export const RESPONSE_VALID_HOURS = [24, 48, 72];
export const MAX_ITEMS = 25;

/** Chamada autenticada do app dos membros (token salvo no login). */
export function memberApi(fetchImpl = fetch) {
  return async function request(method, path, body) {
    // require tardio: telas que só importam utilitários não precisam do módulo nativo
    const AsyncStorage = require('@react-native-async-storage/async-storage').default || require('@react-native-async-storage/async-storage');
    const token = await AsyncStorage.getItem('auth_token');
    let res;
    try {
      res = await fetchImpl(`${API_BASE_PATH}${path}`, {
        method,
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      const err = new Error('Sem conexão com a internet. Tente de novo.');
      err.status = 0;
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Erro ${res.status}`);
      err.status = res.status;
      err.code = data.code;
      throw err;
    }
    return data;
  };
}

/** "R$ 1.250,50" / "1250.5" / "99,9" → número (ou null). */
export function parseMoney(text) {
  const raw = String(text ?? '').replace(/[R$\s]/g, '');
  if (!raw) return null;
  const n = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function moneyInput(n) {
  return n == null ? '' : Number(n).toFixed(2).replace('.', ',');
}

/** "faltam 3 h", "faltam 25 min", "encerrado" */
export function timeLeft(date, now = Date.now()) {
  const ms = new Date(date).getTime() - now;
  if (!(ms > 0)) return 'encerrado';
  const min = Math.round(ms / 60000);
  if (min < 60) return `faltam ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `faltam ${h} h`;
  return `faltam ${Math.floor(h / 24)} dias`;
}

/** Validade de proposta/reserva: "válido até 16/10 às 18:00" */
export function validLabel(date) {
  if (!date) return '';
  const d = new Date(date);
  const p = n => String(n).padStart(2, '0');
  return `válido até ${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const STATUS_LABEL = {
  OPEN: {text: 'Recebendo propostas', tone: 'ok'},
  EXPIRED: {text: 'Prazo encerrado', tone: 'muted'},
  CANCELLED: {text: 'Encerrado', tone: 'muted'},
  CLOSED: {text: 'Encerrado', tone: 'muted'},
};

/** Itens da lista → corpo do POST (catálogo pelo id; texto livre com categoria). */
export function buildItems(list) {
  return list.map(i =>
    i.itemId
      ? {itemId: i.itemId, quantity: i.quantity || 1}
      : {label: i.label, category: i.category, quantity: i.quantity || 1},
  );
}

/** Agrupa o "item a item" por loja, para reservar em cada uma o que sai mais barato ali. */
export function groupPerItemByStore(perItem, items) {
  const groups = new Map();
  for (const l of perItem?.lines || []) {
    if (!l.best) continue;
    const g = groups.get(l.best.partnerId) || {partnerId: l.best.partnerId, partnerName: l.best.partnerName, requestItemIds: [], total: 0, labels: []};
    g.requestItemIds.push(l.requestItemId);
    g.total = Math.round((g.total + l.best.total) * 100) / 100;
    const it = (items || []).find(x => x.id === l.requestItemId);
    if (it) g.labels.push(it.label);
    groups.set(g.partnerId, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

/** Total da proposta do parceiro enquanto ele digita. */
export function responseTotal(items, form) {
  let total = 0;
  let count = 0;
  for (const it of items || []) {
    const f = form[it.id];
    if (!f || f.unavailable) continue;
    const n = parseMoney(f.price);
    if (n && n > 0) {
      total += n * (it.quantity || 1);
      count++;
    }
  }
  return {total: Math.round(total * 100) / 100, count};
}

/** Monta o corpo da proposta; devolve {error} se algo estiver errado. */
export function buildResponseBody(items, form, {validHours = 48, note = ''} = {}) {
  const lines = [];
  for (const it of items || []) {
    const f = form[it.id] || {};
    if (f.unavailable) {
      lines.push({requestItemId: it.id, available: false});
      continue;
    }
    const n = parseMoney(f.price);
    if (n == null || n <= 0) return {error: `Informe o preço de "${it.label}" ou marque "não tenho".`};
    lines.push({requestItemId: it.id, unitPrice: n, available: true, note: (f.note || '').trim() || undefined});
  }
  if (!lines.some(l => l.available)) return {error: 'Marque pelo menos um item que você tem.'};
  return {body: {lines, validHours, note: note.trim() || undefined}};
}

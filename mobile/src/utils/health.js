/**
 * Histórico de saúde do pet e avaliações: utilitários das telas (membro e parceiro).
 */

export const HEALTH_KINDS = [
  {id: 'CONSULTA', label: 'Consulta', icon: 'medkit', color: '#7C3AED'},
  {id: 'EXAME', label: 'Exame', icon: 'flask', color: '#2563EB'},
  {id: 'CIRURGIA', label: 'Cirurgia', icon: 'cut', color: '#DC2626'},
  {id: 'MEDICACAO', label: 'Medicação', icon: 'bandage', color: '#D97706'},
  {id: 'SINTOMA', label: 'Sintoma', icon: 'alert-circle', color: '#DB2777'},
  {id: 'PESO', label: 'Peso', icon: 'barbell', color: '#0D9488'},
  {id: 'OBSERVACAO', label: 'Anotação', icon: 'document-text', color: '#4B5563'},
];
const VACC = {
  VACCINE: {label: 'Vacina', icon: 'shield-checkmark', color: '#059669'},
  DEWORMER: {label: 'Vermífugo', icon: 'medical', color: '#059669'},
  ANTIPARASITIC: {label: 'Antipulgas', icon: 'bug', color: '#059669'},
};

export const HISTORY_FILTERS = [
  {id: 'ALL', label: 'Tudo'},
  {id: 'CONSULTA', label: 'Consultas'},
  {id: 'VACINAS', label: 'Vacinas'},
  {id: 'EXAME', label: 'Exames'},
  {id: 'MEDICACAO', label: 'Remédios'},
  {id: 'PESO', label: 'Peso'},
];

/** Rótulo, ícone e cor de um item da linha do tempo. */
export function kindInfo(item) {
  if (item.type === 'VACCINATION') return VACC[item.kind] || VACC.VACCINE;
  if (item.type === 'QUOTE_LIST') return {label: 'Lista do veterinário', icon: 'list', color: '#D97706'};
  return HEALTH_KINDS.find(k => k.id === item.kind) || HEALTH_KINDS[HEALTH_KINDS.length - 1];
}

export function filterHistory(items, filter) {
  if (!filter || filter === 'ALL') return items || [];
  return (items || []).filter(i => {
    if (filter === 'VACINAS') return i.type === 'VACCINATION';
    if (filter === 'PESO') return i.weight != null;
    if (filter === 'MEDICACAO') return i.kind === 'MEDICACAO' || i.type === 'QUOTE_LIST' || (i.type === 'VACCINATION' && i.kind !== 'VACCINE');
    return i.type === 'ENTRY' && i.kind === filter;
  });
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Agrupa por mês ("outubro de 2026"), mantendo a ordem (mais recente primeiro). */
export function groupByMonth(items) {
  const out = [];
  for (const it of items || []) {
    const d = new Date(it.date);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    let g = out[out.length - 1];
    if (!g || g.key !== key) {
      g = {key, title: `${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`, items: []};
      out.push(g);
    }
    g.items.push(it);
  }
  return out;
}

export function dayLabel(date) {
  const d = new Date(date);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function kg(n) {
  return n == null ? '' : `${String(Math.round(Number(n) * 100) / 100).replace('.', ',')} kg`;
}

/** Pontos do gráfico de peso (0..w, 0..h) + mín/máx e variação. */
export function weightChart(weights, w = 300, h = 120, pad = 8) {
  const pts = (weights || []).filter(x => x && x.weight != null);
  if (pts.length < 2) return null;
  const vals = pts.map(p => Number(p.weight));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const t0 = new Date(pts[0].date).getTime();
  const t1 = new Date(pts[pts.length - 1].date).getTime();
  const tspan = t1 - t0 || 1;
  const points = pts.map(p => ({
    x: pad + ((new Date(p.date).getTime() - t0) / tspan) * (w - 2 * pad),
    y: pad + (1 - (Number(p.weight) - min) / span) * (h - 2 * pad),
    weight: Number(p.weight),
    date: p.date,
  }));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const change = Math.round((vals[vals.length - 1] - vals[0]) * 100) / 100;
  return {points, path, min, max, change, first: pts[0], last: pts[pts.length - 1]};
}

/** Lê "AAAA-MM-DD" ou "DD/MM/AAAA" → "AAAA-MM-DD" (ou null). */
export function parseDateInput(text) {
  const s = String(text || '').trim();
  let y;
  let mo;
  let d;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) [, y, mo, d] = m.map(Number);
  else {
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function todayInput(now = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
}

// ---------------------------------------------------------------- avaliações

export function starsText(rating) {
  const r = Math.round(Number(rating) || 0);
  return '★'.repeat(r) + '☆'.repeat(Math.max(0, 5 - r));
}

export function ratingLabel(rating, count) {
  if (!count) return 'Sem avaliações ainda';
  return `${String(Number(rating).toFixed(1)).replace('.', ',')} · ${count} ${count === 1 ? 'avaliação' : 'avaliações'}`;
}

export const RATING_WORDS = {1: 'Muito ruim', 2: 'Ruim', 3: 'Regular', 4: 'Bom', 5: 'Excelente'};

export function relativeDay(date, now = Date.now()) {
  const days = Math.floor((now - new Date(date).getTime()) / 864e5);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  const m = Math.floor(days / 30);
  if (m < 12) return `há ${m} ${m === 1 ? 'mês' : 'meses'}`;
  const y = Math.floor(m / 12);
  return `há ${y} ${y === 1 ? 'ano' : 'anos'}`;
}

/**
 * Grade semanal de horário ⇄ texto salvo ("Seg-Sex: 08:00-18:00 | Sáb: 08:00-12:00").
 * O texto é o mesmo formato que o app dos membros lê (utils/openingHours) e que o admin gera.
 */
export const DAYS = [
  {key: 1, short: 'Seg', label: 'Segunda'},
  {key: 2, short: 'Ter', label: 'Terça'},
  {key: 3, short: 'Qua', label: 'Quarta'},
  {key: 4, short: 'Qui', label: 'Quinta'},
  {key: 5, short: 'Sex', label: 'Sexta'},
  {key: 6, short: 'Sáb', label: 'Sábado'},
  {key: 0, short: 'Dom', label: 'Domingo'},
];
const ORDER = DAYS.map(d => d.key);
const ALIASES = {
  dom: 0, domingo: 0, seg: 1, segunda: 1, ter: 2, terca: 2, qua: 3, quarta: 3,
  qui: 4, quinta: 4, sex: 5, sexta: 5, sab: 6, sabado: 6,
};

export const PRESETS = [
  {id: 'commercial', label: 'Seg a sex 8h–18h, sáb 8h–12h'},
  {id: 'everyday', label: 'Todos os dias 8h–20h'},
  {id: 'h24', label: '24 horas'},
];

export function emptyWeek() {
  const w = {};
  DAYS.forEach(d => (w[d.key] = {open: false, from: '08:00', to: '18:00'}));
  return w;
}

export function presetWeek(id) {
  const w = {};
  DAYS.forEach(d => {
    if (id === 'commercial') {
      w[d.key] = {open: d.key >= 1 && d.key <= 6, from: '08:00', to: d.key === 6 ? '12:00' : '18:00'};
    } else if (id === 'everyday') {
      w[d.key] = {open: true, from: '08:00', to: '20:00'};
    } else {
      w[d.key] = {open: true, from: '00:00', to: '23:59'};
    }
  });
  return w;
}

/** "8" → "08:00", "0830" → "08:30"; null se inválido. */
export function normalizeTime(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  let hh;
  let mm;
  if (d.length <= 2) {
    hh = Number(d);
    mm = 0;
  } else {
    hh = Number(d.slice(0, d.length - 2));
    mm = Number(d.slice(-2));
  }
  if (!Number.isInteger(hh) || hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Máscara de digitação HH:MM. */
export function maskTime(text) {
  const d = String(text || '').replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}

/** Erros por dia (abertura depois do fechamento, horário inválido). */
export function validateWeek(week) {
  const errors = {};
  DAYS.forEach(d => {
    const w = week[d.key];
    if (!w?.open) return;
    const from = normalizeTime(w.from);
    const to = normalizeTime(w.to);
    if (!from || !to) errors[d.key] = 'Horário inválido (use 08:00).';
    else if (from >= to) errors[d.key] = 'O fechamento precisa ser depois da abertura.';
  });
  return errors;
}

export function serializeWeek(week) {
  const groups = [];
  ORDER.forEach(key => {
    const w = week[key];
    if (!w?.open) {
      groups.push(null);
      return;
    }
    const from = normalizeTime(w.from) || w.from;
    const to = normalizeTime(w.to) || w.to;
    const last = groups[groups.length - 1];
    if (last && last.from === from && last.to === to) last.keys.push(key);
    else groups.push({keys: [key], from, to});
  });
  const short = k => DAYS.find(d => d.key === k).short;
  return groups
    .filter(Boolean)
    .map(g => {
      const days =
        g.keys.length === 1 ? short(g.keys[0]) : `${short(g.keys[0])}-${short(g.keys[g.keys.length - 1])}`;
      return `${days}: ${g.from}-${g.to}`;
    })
    .join(' | ');
}

/** Lê o texto salvo para a grade. null se for texto livre que não dá para interpretar. */
export function parseWeek(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const week = emptyWeek();
  const norm = s =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace('.', '').trim();
  let ok = false;
  for (const part of t.split(/\||\n|;/)) {
    const m = part.match(
      /^\s*([^:]+?)\s*:\s*(\d{1,2}(?::\d{2}|h\d{0,2})?)\s*(?:-|–|às|a)\s*(\d{1,2}(?::\d{2}|h\d{0,2})?)\s*$/i,
    );
    if (!m) {
      if (/fechado/i.test(part) || !part.trim()) continue;
      return null;
    }
    const range = m[1].split(/\s+(?:a|até)\s+|\s*[-–]\s*/i).map(norm);
    const from = normalizeTime(m[2].replace(/h$/i, ':00').replace('h', ':'));
    const to = normalizeTime(m[3].replace(/h$/i, ':00').replace('h', ':'));
    const a = ALIASES[range[0]];
    const b = ALIASES[range[range.length - 1]];
    if (a === undefined || b === undefined || !from || !to) return null;
    let i = ORDER.indexOf(a);
    for (let n = 0; n < 7; n++) {
      const key = ORDER[i % 7];
      week[key] = {open: true, from, to};
      if (key === b) break;
      i++;
    }
    ok = true;
  }
  return ok ? week : null;
}

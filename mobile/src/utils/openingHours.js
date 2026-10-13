const WEEKDAYS = [
  {key: 0, label: 'Domingo', short: 'Dom'},
  {key: 1, label: 'Segunda', short: 'Seg'},
  {key: 2, label: 'Terça', short: 'Ter'},
  {key: 3, label: 'Quarta', short: 'Qua'},
  {key: 4, label: 'Quinta', short: 'Qui'},
  {key: 5, label: 'Sexta', short: 'Sex'},
  {key: 6, label: 'Sábado', short: 'Sáb'},
];

const DAY_ALIASES = {
  dom: 0,
  domingo: 0,
  seg: 1,
  segunda: 1,
  'segunda-feira': 1,
  ter: 2,
  terca: 2,
  terça: 2,
  'terça-feira': 2,
  qua: 3,
  quarta: 3,
  'quarta-feira': 3,
  qui: 4,
  quinta: 4,
  'quinta-feira': 4,
  sex: 5,
  sexta: 5,
  'sexta-feira': 5,
  sab: 6,
  sáb: 6,
  sabado: 6,
  sábado: 6,
};

function normalizeTime(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .trim()
    .toLowerCase()
    .replace(/h/g, ':')
    .replace(/\s/g, '');
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return String(raw).trim();
  const hh = String(Number(match[1])).padStart(2, '0');
  const mm = String(match[2] || '00').padStart(2, '0');
  return `${hh}:${mm}`;
}

function dayRange(fromKey, toKey) {
  const days = [];
  let cursor = fromKey;
  for (let i = 0; i < 7; i += 1) {
    days.push(cursor);
    if (cursor === toKey) break;
    cursor = (cursor + 1) % 7;
  }
  return days;
}

function defaultWeek() {
  return WEEKDAYS.map(day => {
    if (day.key === 0) {
      return {...day, closed: true, range: 'Fechado'};
    }
    if (day.key === 6) {
      return {...day, closed: false, range: '09:00 – 13:00'};
    }
    return {...day, closed: false, range: '09:00 – 18:00'};
  });
}

/**
 * Converte textos como "Seg-Sex: 9h-18h | Sáb: 9h-13h" em grade semanal.
 */
export function parseOpeningHours(hoursText) {
  const week = defaultWeek().map(day => ({...day, closed: true, range: 'Fechado'}));
  const text = String(hoursText || '').trim();
  if (!text) return defaultWeek();

  const chunks = text.split(/[|\n;]+/).map(c => c.trim()).filter(Boolean);
  chunks.forEach(chunk => {
    const parts = chunk.split(':');
    if (parts.length < 2) return;
    const dayPart = parts[0].trim().toLowerCase();
    const timePart = parts.slice(1).join(':').trim();
    if (/fechad/.test(timePart)) {
      const keys = expandDayPart(dayPart);
      keys.forEach(key => {
        week[key] = {...week[key], closed: true, range: 'Fechado'};
      });
      return;
    }
    const times = timePart.split(/[-–—aà]/i).map(t => t.trim()).filter(Boolean);
    const open = normalizeTime(times[0]);
    const close = normalizeTime(times[1]);
    if (!open || !close) return;
    const range = `${open} – ${close}`;
    expandDayPart(dayPart).forEach(key => {
      week[key] = {...week[key], closed: false, range};
    });
  });

  const hasOpen = week.some(d => !d.closed);
  return hasOpen ? week : defaultWeek();
}

function expandDayPart(dayPart) {
  const cleaned = dayPart.replace(/\./g, '').trim();
  if (cleaned.includes('-') || cleaned.includes('–')) {
    const [fromRaw, toRaw] = cleaned.split(/[-–]/).map(s => s.trim());
    const from = DAY_ALIASES[fromRaw];
    const to = DAY_ALIASES[toRaw];
    if (from == null || to == null) return [];
    return dayRange(from, to);
  }
  const single = DAY_ALIASES[cleaned];
  return single == null ? [] : [single];
}

export function getTodayHours(hoursText) {
  const week = parseOpeningHours(hoursText);
  const today = new Date().getDay();
  return week.find(d => d.key === today) || week[0];
}

/** Grade por dia (0=domingo) com {from, to} em minutos; null se o texto não for um horário. */
export function parseHoursStrict(hoursText) {
  const text = String(hoursText || '').trim();
  if (!text) return null;
  const days = {};
  let found = false;
  text
    .split(/[|\n;]+/)
    .map(c => c.trim())
    .filter(Boolean)
    .forEach(chunk => {
      const idx = chunk.indexOf(':');
      if (idx < 0) return;
      const dayPart = chunk.slice(0, idx).trim().toLowerCase();
      const timePart = chunk.slice(idx + 1).trim();
      const keys = expandDayPart(dayPart);
      if (!keys.length) return;
      if (/fechad/i.test(timePart)) {
        keys.forEach(k => (days[k] = null));
        found = true;
        return;
      }
      const times = timePart.split(/\s*(?:-|–|—|às|as|a)\s*/i).map(t => t.trim()).filter(Boolean);
      const toMin = raw => {
        const t = normalizeTime(raw);
        const m = /^(\d{2}):(\d{2})$/.exec(t || '');
        return m ? Number(m[1]) * 60 + Number(m[2]) : null;
      };
      const from = toMin(times[0]);
      const to = toMin(times[1]);
      if (from == null || to == null) return;
      keys.forEach(k => (days[k] = {from, to}));
      found = true;
    });
  return found ? days : null;
}

const hhmm = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Situação agora: {open, label} — ou null quando o horário não foi informado / não dá para ler.
 * Considera horários que viram a madrugada (ex.: 18:00-02:00).
 */
export function openStatus(hoursText, now = new Date()) {
  const days = parseHoursStrict(hoursText);
  if (!days) return null;
  const day = now.getDay();
  const min = now.getHours() * 60 + now.getMinutes();
  const today = days[day];
  const yesterday = days[(day + 6) % 7];
  if (today) {
    const overnight = today.to <= today.from;
    if (today.from === 0 && today.to >= 1439) return {open: true, label: 'Aberto agora · 24 horas'};
    if (min >= today.from && (overnight || min < today.to)) {
      return {open: true, label: `Aberto agora · fecha às ${hhmm(today.to)}`};
    }
  }
  if (yesterday && yesterday.to <= yesterday.from && min < yesterday.to) {
    return {open: true, label: `Aberto agora · fecha às ${hhmm(yesterday.to)}`};
  }
  if (today && min < today.from) return {open: false, label: `Fechado · abre hoje às ${hhmm(today.from)}`};
  for (let i = 1; i <= 7; i++) {
    const d = days[(day + i) % 7];
    if (d) {
      const when = i === 1 ? 'amanhã' : WEEKDAYS[(day + i) % 7].label.toLowerCase();
      return {open: false, label: `Fechado · abre ${when} às ${hhmm(d.from)}`};
    }
  }
  return {open: false, label: 'Fechado'};
}

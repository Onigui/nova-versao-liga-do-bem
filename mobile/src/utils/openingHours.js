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

/**
 * Datas "de calendário" (nascimento, vacina, dia do evento) vêm do servidor como "2026-10-20"
 * ou "2026-10-20T00:00:00.000Z". Lidas com new Date(), viram meia-noite UTC = 21h do dia
 * anterior no Brasil — daí o "dia 19" no lugar do 20. Aqui elas viram o dia certo no fuso local.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00(?::00(?:\.0+)?)?(?:Z|[+-]00:?00)?)?$/;

export const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const WEEKDAYS_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const pad = n => String(n).padStart(2, '0');

/** Date local do dia de calendário (meio-dia, para não escorregar de dia), ou o instante exato se tiver hora. */
export function calendarDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const m = String(value).match(DATE_ONLY);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** "20/10/2026" */
export function formatBR(value) {
  const d = calendarDate(value);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
}

/** "20/10/2026 17:30" */
export function formatBRTime(value) {
  const d = calendarDate(value);
  return d ? `${formatBR(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}

/** "terça-feira, 20 de outubro" (+ " de 2026" com withYear) */
export function formatLong(value, withYear = false) {
  const d = calendarDate(value);
  if (!d) return '';
  return `${WEEKDAYS_PT[d.getDay()]}, ${d.getDate()} de ${MONTHS_PT[d.getMonth()]}${withYear ? ` de ${d.getFullYear()}` : ''}`;
}

/** "2026-10-20" (para mandar ao servidor uma data sem hora) */
export function toISODay(d) {
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null;
}

/** "20/10/2026" ou "20/10/2026 17:30" → Date local (null se inválida) */
export function parseBR(text) {
  const m = String(text || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), hh != null ? Number(hh) : 12, mi != null ? Number(mi) : 0);
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null;
  return d;
}

export const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

export function sameDay(a, b) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Dias de calendário de hoje até a data (negativo = já passou). */
export function daysUntil(value, now = Date.now()) {
  const d = calendarDate(value);
  if (!d) return null;
  const n = new Date(now);
  const a = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  const b = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / 864e5);
}

/** Idade em anos/meses a partir da data de nascimento. */
export function ageParts(birth, now = new Date()) {
  const b = calendarDate(birth);
  if (!b) return null;
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) return null;
  return {years: Math.floor(months / 12), months: months % 12, total: months};
}

/**
 * Eventos: "2026-10-20" (dia já no fuso do Brasil, vindo do servidor) é dia de calendário;
 * com hora ("2026-10-21T00:00:00Z" = 21h do dia 20 no Brasil) é um instante exato.
 */
export function eventDate(value) {
  if (value == null || value === '') return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

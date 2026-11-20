const TZ = 'America/Argentina/Buenos_Aires';
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function money(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n));
}

export function todayAR() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

export function dateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${DAYS[weekdayOf(dateStr)]} ${Number(d)}/${Number(m)}`;
}

// Partes de una fecha/hora en hora de Argentina, siempre en formato 24 h.
function partsAR(iso) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const g = (t) => parts.find((p) => p.type === t)?.value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
}

// «20/11 18:51»
export function dateTimeLabel(iso) {
  if (!iso) return '—';
  const { date, time } = partsAR(iso);
  const [, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)} ${time}`;
}

// «18:51»
export function timeLabel(iso) {
  if (!iso) return '—';
  return partsAR(iso).time;
}

// «hoy a las 18:51», «mañana a las 9:30», «el sáb 21/11 a las 18:51»
export function whenLabel(iso) {
  if (!iso) return '—';
  const { date, time } = partsAR(iso);
  const today = todayAR();
  if (date === today) return `hoy a las ${time}`;
  if (date === addDays(today, 1)) return `mañana (${dateLabel(date)}) a las ${time}`;
  return `el ${dateLabel(date)} a las ${time}`;
}

// Números con coma decimal, como se escriben en Argentina: 1,03 · 52,4 %
export function num(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(Number(n));
}

export function pct(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${num(n, digits)} %`;
}

export function parseNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[$\s]/g, '').trim();
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(s) {
  return normName(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export const STATUS_LABEL = {
  pendiente_sena: 'Esperando seña',
  confirmado: 'Confirmado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  vencido: 'Vencido',
};

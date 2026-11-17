// Calendario de pedidos en formato iCalendar (RFC 5545) para suscribirse desde
// Google Calendar, Apple Calendar u Outlook. Solo lectura: los cambios se hacen en AutoFlow.
import crypto from 'crypto';
import { appUrl } from './env';
import { money, addDays, todayAR } from './format';
import { balanceDue } from './balance';
import { optionsSummary } from './options';

export function newCalendarToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export function calendarUrl(token) {
  return `${appUrl()}/cal/${token}.ics`;
}

export const CAL_STATUSES = ['pendiente_sena', 'confirmado', 'entregado'];
export const CAL_DAYS_BACK = 30;
export const CAL_DAYS_AHEAD = 365;

export function calendarRange() {
  const today = todayAR();
  return { from: addDays(today, -CAL_DAYS_BACK), to: addDays(today, CAL_DAYS_AHEAD) };
}

function esc(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Corta líneas a 75 octetos sin partir caracteres UTF-8.
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = '';
  let curLen = 0;
  let limit = 75;
  for (const ch of line) {
    const n = Buffer.byteLength(ch, 'utf8');
    if (curLen + n > limit) {
      out.push(cur);
      cur = '';
      curLen = 0;
      limit = 74; // las líneas de continuación llevan un espacio adelante
    }
    cur += ch;
    curLen += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const pad = (n) => String(n).padStart(2, '0');

// Argentina no tiene horario de verano: hora local = UTC-3.
function utcStamp(dateStr, h, m) {
  const d = new Date(`${dateStr}T${pad(h)}:${pad(m)}:00-03:00`);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// "10:00 a 13:00", "10 a 13 hs", "16-20" → { start:[10,0], end:[13,0] }
export function parseSlot(slot) {
  const times = [...String(slot || '').matchAll(/(\d{1,2})(?:[:.h](\d{2}))?/g)]
    .map((m) => [Number(m[1]), Number(m[2] || 0)])
    .filter(([h, m]) => h <= 23 && m <= 59);
  if (!times.length) return null;
  const start = times[0];
  let end = times[1];
  if (!end || end[0] * 60 + end[1] <= start[0] * 60 + start[1]) {
    end = [Math.min(start[0] + 1, 23), start[0] >= 23 ? 59 : start[1]];
  }
  return { start, end };
}

function optionsText(order) {
  return Array.isArray(order.options) && order.options.length ? optionsSummary(order.options) : '';
}

function eventFor(bakery, order, stamp) {
  const lines = ['BEGIN:VEVENT', `UID:pedido-${order.id}@autoflow-cocina`, `DTSTAMP:${stamp}`];
  const slot = parseSlot(order.slot);
  if (slot) {
    lines.push(`DTSTART:${utcStamp(order.date, ...slot.start)}`, `DTEND:${utcStamp(order.date, ...slot.end)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${order.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(order.date, 1).replace(/-/g, '')}`);
  }

  const delivery = order.fulfillment === 'envio';
  const prefix = order.status === 'pendiente_sena' ? '⏳ ' : order.status === 'entregado' ? '✔ ' : '';
  const summary = `${prefix}${order.quantity > 1 ? `${order.quantity}× ` : ''}${order.product_name} – ${order.customer_name || 'Cliente'}${delivery ? ' (envío)' : ''}`;
  lines.push(`SUMMARY:${esc(summary)}`);

  const due = balanceDue(order);
  const desc = [
    order.status === 'pendiente_sena' ? 'Esperando seña' : order.status === 'entregado' ? 'Entregado' : 'Confirmado',
    order.slot && `Franja: ${order.slot}`,
    delivery ? 'Envío a domicilio' : 'Retiro',
    order.customer_phone && `Tel: ${order.customer_phone}`,
    optionsText(order) && `Opciones: ${optionsText(order)}`,
    order.dedication && `Dedicatoria: ${order.dedication}`,
    order.allergies && `⚠ Alergias: ${order.allergies}`,
    order.notes && `Notas: ${order.notes}`,
    `Total: ${money(order.total)}${due > 0 ? ` · Saldo a cobrar: ${money(due)}` : ' · Pagado'}`,
    `${appUrl()}/app/pedidos`,
  ].filter(Boolean).join('\n');
  lines.push(`DESCRIPTION:${esc(desc)}`);

  const location = delivery ? order.address : bakery.pickup_address;
  if (location) lines.push(`LOCATION:${esc(location)}`);
  lines.push(`STATUS:${order.status === 'pendiente_sena' ? 'TENTATIVE' : 'CONFIRMED'}`, 'TRANSP:OPAQUE', 'END:VEVENT');
  return lines;
}

export function buildCalendar(bakery, orders) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AutoFlow Cocina//Pedidos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(`Pedidos – ${bakery.name}`)}`,
    'X-WR-TIMEZONE:America/Argentina/Buenos_Aires',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];
  for (const o of orders) lines.push(...eventFor(bakery, o, stamp));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

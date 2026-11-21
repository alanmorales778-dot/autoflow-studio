// Resumen de la mañana: una vez por día (desde las 8 en Argentina) le cuenta al dueño lo que tiene.
import { notify } from './notifications';
import { balanceDue } from './balance';
import { money, todayAR, addDays } from './format';
import { rubroOf } from './rubros';

const hourAR = () => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date()));

export async function sendMorningDigests(admin) {
  if (hourAR() < 8) return 0;
  const today = todayAR();
  const { data: bakeries } = await admin.from('bakeries').select('*').or(`last_digest_date.is.null,last_digest_date.lt.${today}`).limit(200);
  let sent = 0;
  for (const bakery of bakeries || []) {
    // Se marca primero para no mandar dos veces si el cron corre en paralelo.
    const { data: claimed } = await admin.from('bakeries').update({ last_digest_date: today }).eq('id', bakery.id)
      .or(`last_digest_date.is.null,last_digest_date.lt.${today}`).select('id');
    if (!claimed?.length) continue;
    const T = rubroOf(bakery);
    const { data: orders } = await admin.from('orders').select('*').eq('bakery_id', bakery.id)
      .in('status', ['pendiente_sena', 'confirmado', 'entregado']).gte('date', addDays(today, -60)).lte('date', addDays(today, 1));
    const list = orders || [];
    const active = list.filter((o) => ['pendiente_sena', 'confirmado'].includes(o.status));
    const todays = active.filter((o) => o.date === today);
    const tomorrow = active.filter((o) => o.date === addDays(today, 1));
    const waiting = todays.filter((o) => o.status === 'pendiente_sena').length;
    const owed = list.filter((o) => o.date < today && ['confirmado', 'entregado'].includes(o.status)).reduce((t, o) => t + balanceDue(o), 0);
    if (!todays.length && !tomorrow.length && owed <= 0) continue;
    const orders1 = (n) => `${n} ${n === 1 ? T.order : T.orders.toLowerCase()}`;
    const title = todays.length ? `Buen día ☀️ Hoy tenés ${orders1(todays.length)}` : 'Buen día ☀️ Hoy tenés el día libre';
    const body = [
      waiting ? `${waiting} esperando seña` : null,
      tomorrow.length ? `mañana ${tomorrow.length}` : null,
      owed > 0 ? `te deben ${money(owed)}` : null,
    ].filter(Boolean).join(' · ') || 'Todo en orden.';
    await notify(admin, bakery, { kind: 'resumen', title, body, url: '/app' });
    sent += 1;
  }
  return sent;
}

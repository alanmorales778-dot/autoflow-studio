// Resumen de la mañana: una vez por día (desde las 8 en Argentina) le cuenta al dueño lo que tiene.
import { notify } from './notifications';
import { balanceDue } from './balance';
import { money, todayAR, addDays } from './format';
import { rubroOf } from './rubros';
import { mailEnabled, sendMail, ownerEmail } from './notify';
import { appUrl } from './env';

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

// Fin de la prueba gratis: aviso 3 días antes y el día que vence (el link deja de tomar pedidos).
// bakeries.trial_notice guarda el último aviso mandado para no repetir.
export async function sendTrialNotices(admin) {
  const now = Date.now();
  const soon = new Date(now + 3 * 86400000).toISOString();
  const { data: subs } = await admin.from('subscriptions').select('bakery_id,trial_ends_at,status').eq('status', 'trial').lte('trial_ends_at', soon).limit(300);
  let sent = 0;
  for (const s of subs || []) {
    const ends = new Date(s.trial_ends_at).getTime();
    const stage = ends <= now ? `fin:${s.trial_ends_at.slice(0, 10)}` : `3d:${s.trial_ends_at.slice(0, 10)}`;
    const { data: bakery } = await admin.from('bakeries').select('*').eq('id', s.bakery_id).maybeSingle();
    if (!bakery || bakery.is_test || bakery.trial_notice === stage) continue;
    // si ya venció hace más de 2 días no insistimos
    if (ends <= now - 2 * 86400000) continue;
    const { data: claimed } = await admin.from('bakeries').update({ trial_notice: stage }).eq('id', bakery.id)
      .or(`trial_notice.is.null,trial_notice.neq.${stage}`).select('id');
    if (!claimed?.length) continue;
    const days = Math.max(1, Math.ceil((ends - now) / 86400000));
    const ended = ends <= now;
    await notify(admin, bakery, {
      kind: 'sistema',
      title: ended ? 'Terminó tu prueba gratis: tu link dejó de tomar pedidos' : `Tu prueba gratis termina en ${days} ${days === 1 ? 'día' : 'días'}`,
      body: ended ? 'Elegí tu plan para que tus clientes puedan volver a pedir. Tus datos siguen guardados.' : 'Elegí tu plan para que tu link siga tomando pedidos sin cortes.',
      url: '/app/plan',
    });
    const to = mailEnabled() ? await ownerEmail(admin, bakery).catch(() => null) : null;
    if (to) {
      await sendMail({
        to,
        subject: ended ? 'Tu link de HakkiraApp dejó de tomar pedidos' : `Tu prueba de HakkiraApp termina en ${days} ${days === 1 ? 'día' : 'días'}`,
        text: `${ended ? 'Terminó tu prueba gratis y tu link ya no toma pedidos.' : `Tu prueba gratis termina en ${days} ${days === 1 ? 'día' : 'días'}.`} Elegí tu plan en ${appUrl()}/app/plan para seguir. Tus pedidos y recetas quedan guardados.`,
      }).catch(() => {});
    }
    sent += 1;
  }
  return sent;
}

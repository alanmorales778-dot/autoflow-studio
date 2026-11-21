// Notificaciones del negocio: se guardan para la campanita y, si el dueño activó avisos, llegan al celular.
import { sendWebPush, pushEnabled } from './webpush';
import { reportError } from './alerts';

const DEFAULT_PREFS = { nuevo: true, pagado: true, vencido: true, resumen: true };
export const prefsOf = (bakery) => ({ ...DEFAULT_PREFS, ...(bakery?.push_prefs || {}) });

export async function sendPushToBakery(admin, bakeryId, payload) {
  if (!pushEnabled()) return 0;
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('bakery_id', bakeryId);
  let sent = 0;
  for (const s of subs || []) {
    try {
      const r = await sendWebPush(s, payload);
      if (r.gone) await admin.from('push_subscriptions').delete().eq('id', s.id);
      else if (r.ok) {
        sent += 1;
        await admin.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', s.id);
      }
    } catch (e) {
      await reportError('push', e, { bakeryId });
    }
  }
  return sent;
}

// kind: nuevo | pagado | vencido | resumen | sistema
export async function notify(admin, bakery, { kind, title, body = '', url = '/app' }) {
  try {
    await admin.from('notifications').insert({
      bakery_id: bakery.id,
      kind,
      title: String(title).slice(0, 140),
      body: String(body).slice(0, 400),
      url: String(url).slice(0, 300),
    });
    if (prefsOf(bakery)[kind] !== false) {
      await sendPushToBakery(admin, bakery.id, { title, body, url, tag: `${kind}-${Date.now()}` });
    }
  } catch (e) {
    await reportError('notify', e, { bakeryId: bakery?.id });
  }
}

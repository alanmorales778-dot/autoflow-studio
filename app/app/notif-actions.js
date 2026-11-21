'use server';

import { revalidatePath } from 'next/cache';
import { requireBakery } from '@/lib/session';
import { createAdmin } from '@/lib/supabase';
import { sendPushToBakery } from '@/lib/notifications';

// Últimas notificaciones para la campanita (se llama al abrirla y cada minuto).
export async function fetchNotifications() {
  const { supabase, bakery } = await requireBakery();
  const { data } = await supabase.from('notifications').select('id,kind,title,body,url,read_at,created_at')
    .eq('bakery_id', bakery.id).order('created_at', { ascending: false }).limit(30);
  return data || [];
}

export async function markNotificationsRead(ids) {
  const { supabase, bakery } = await requireBakery();
  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('bakery_id', bakery.id).is('read_at', null);
  if (Array.isArray(ids) && ids.length) q = q.in('id', ids.filter((n) => Number.isInteger(n)).slice(0, 100));
  await q;
  return { ok: true };
}

// Guarda el permiso de avisos de este celular o computadora.
export async function savePushSubscription(sub, device) {
  const { bakery } = await requireBakery();
  const endpoint = String(sub?.endpoint || '');
  const p256dh = String(sub?.keys?.p256dh || '');
  const auth = String(sub?.keys?.auth || '');
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) return { ok: false };
  const admin = createAdmin();
  const { error } = await admin.from('push_subscriptions').upsert(
    { bakery_id: bakery.id, endpoint, p256dh, auth, device: String(device || '').slice(0, 120) },
    { onConflict: 'endpoint' },
  );
  return { ok: !error };
}

export async function removePushSubscription(endpoint) {
  const { bakery } = await requireBakery();
  const admin = createAdmin();
  await admin.from('push_subscriptions').delete().eq('bakery_id', bakery.id).eq('endpoint', String(endpoint || ''));
  return { ok: true };
}

export async function sendTestPush() {
  const { bakery } = await requireBakery();
  const admin = createAdmin();
  const sent = await sendPushToBakery(admin, bakery.id, { title: '¡Listo! 🔔', body: `Así te van a llegar los avisos de ${bakery.name}.`, url: '/app', tag: 'prueba' });
  return { ok: sent > 0, sent };
}

export async function savePushPrefs(fd) {
  const { bakery } = await requireBakery();
  const admin = createAdmin();
  const prefs = Object.fromEntries(['nuevo', 'pagado', 'vencido', 'resumen'].map((k) => [k, fd.get(k) === 'on']));
  await admin.from('bakeries').update({ push_prefs: prefs }).eq('id', bakery.id);
  revalidatePath('/app', 'layout');
  return { ok: true };
}

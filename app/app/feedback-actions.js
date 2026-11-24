'use server';

import { requireBakery } from '@/lib/session';
import { createAdmin } from '@/lib/supabase';

const KINDS = ['idea', 'error', 'elogio', 'otro'];

// Comentario de un negocio piloto o de prueba. Lo ve el equipo en /admin/pilotos.
export async function sendFeedback(prev, fd) {
  try {
    const { user, bakery } = await requireBakery();
    const message = String(fd.get('message') || '').trim().slice(0, 2000);
    if (message.length < 3) return { error: 'Contanos un poco más.' };
    const kind = KINDS.includes(String(fd.get('kind'))) ? String(fd.get('kind')) : 'otro';
    const r = parseInt(String(fd.get('rating') || ''), 10);
    const rating = r >= 1 && r <= 5 ? r : null;
    const page = String(fd.get('page') || '').slice(0, 120) || null;
    const admin = createAdmin();
    const { count } = await admin.from('pilot_feedback').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id).gte('created_at', new Date(Date.now() - 86400000).toISOString());
    if (count >= 30) return { error: 'Llegaste al máximo de comentarios por hoy. ¡Gracias!' };
    const { error } = await admin.from('pilot_feedback').insert({ bakery_id: bakery.id, user_id: user.id, kind, rating, message, page });
    if (error) return { error: 'No se pudo enviar. Probá de nuevo.' };
    return { ok: true, at: Date.now() };
  } catch (e) {
    if (e?.digest?.startsWith?.('NEXT_REDIRECT')) throw e;
    return { error: 'No se pudo enviar. Probá de nuevo.' };
  }
}

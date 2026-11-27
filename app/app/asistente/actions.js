'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireBakery } from '@/lib/session';

const HOME = '/app/asistente';
const internal = (path) => (typeof path === 'string' && path.startsWith('/app/asistente') && !path.startsWith('//') ? path : HOME);

function back(path, { error, ok } = {}) {
  path = internal(path);
  const p = new URLSearchParams();
  if (error) p.set('error', String(error).slice(0, 300));
  if (ok) p.set('ok', String(ok).slice(0, 300));
  const qs = p.toString();
  const [base, hash] = String(path).split('#');
  redirect(qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}${hash ? `#${hash}` : ''}` : path);
}

const str = (fd, k, n = 600) => String(fd.get(k) ?? '').trim().slice(0, n);
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ''));

async function guard() {
  const ctx = await requireBakery();
  if (!ctx.access.assistant) back('/app/asistente', { error: 'Activá el módulo Asistente IA para usarlo.' });
  return ctx;
}

// ---------- Ajustes ----------
export async function saveSettings(fd) {
  const { supabase, bakery } = await guard();
  const from = str(fd, 'back') || `${HOME}/entrenar`;
  const row = {
    bakery_id: bakery.id,
    enabled: fd.get('enabled') === 'on',
    name: str(fd, 'name', 40) || 'Asistente',
    greeting: str(fd, 'greeting', 300) || null,
    tone: str(fd, 'tone', 300) || null,
    instructions: str(fd, 'instructions', 1500) || null,
    ask_contact: fd.get('ask_contact') === 'on',
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('assistant_settings').upsert(row, { onConflict: 'bakery_id' });
  if (error) back(from, { error: 'No se pudo guardar. Probá de nuevo.' });
  revalidatePath(HOME, 'layout');
  back(from, { ok: row.enabled ? 'Listo: tu asistente ya usa estos ajustes.' : 'Asistente apagado: tu catálogo vuelve a mostrar solo el botón de WhatsApp.' });
}

export async function toggleEnabled(fd) {
  const { supabase, bakery } = await guard();
  const enabled = str(fd, 'enabled') === '1';
  const { data: cur } = await supabase.from('assistant_settings').select('bakery_id').eq('bakery_id', bakery.id).maybeSingle();
  const { error } = cur
    ? await supabase.from('assistant_settings').update({ enabled, updated_at: new Date().toISOString() }).eq('bakery_id', bakery.id)
    : await supabase.from('assistant_settings').insert({ bakery_id: bakery.id, enabled });
  if (error) back(HOME, { error: 'No se pudo cambiar. Probá de nuevo.' });
  revalidatePath(HOME, 'layout');
  back(str(fd, 'back') || HOME, { ok: enabled ? 'Asistente prendido: ya atiende en tu catálogo.' : 'Asistente apagado.' });
}

// ---------- Lo que sabe ----------
export async function addKnowledge(fd) {
  const { supabase, bakery } = await guard();
  const from = `${HOME}/entrenar#sabe`;
  const question = str(fd, 'question', 300) || null;
  const answer = str(fd, 'answer', 1000);
  if (!answer) back(from, { error: question ? 'Escribí la respuesta.' : 'Escribí qué querés que sepa.' });
  const { count } = await supabase.from('assistant_knowledge').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id);
  if ((count || 0) >= 200) back(from, { error: 'Llegaste a 200 cosas guardadas. Borrá las que ya no sirvan.' });
  const { error } = await supabase.from('assistant_knowledge').insert({ bakery_id: bakery.id, question, answer, source: question ? 'manual' : 'nota' });
  if (error) back(from, { error: 'No se pudo guardar.' });
  back(from, { ok: 'Aprendido. Ya lo usa en las próximas respuestas.' });
}

export async function updateKnowledge(fd) {
  const { supabase, bakery } = await guard();
  const id = str(fd, 'id');
  const from = `${HOME}/entrenar#sabe`;
  if (!isUuid(id)) back(from);
  const answer = str(fd, 'answer', 1000);
  if (!answer) back(from, { error: 'La respuesta no puede quedar vacía.' });
  await supabase.from('assistant_knowledge').update({ question: str(fd, 'question', 300) || null, answer, updated_at: new Date().toISOString() }).eq('id', id).eq('bakery_id', bakery.id);
  back(from, { ok: 'Actualizado.' });
}

export async function deleteKnowledge(fd) {
  const { supabase, bakery } = await guard();
  const id = str(fd, 'id');
  if (isUuid(id)) await supabase.from('assistant_knowledge').delete().eq('id', id).eq('bakery_id', bakery.id);
  back(`${HOME}/entrenar#sabe`, { ok: 'Borrado: ya no lo usa.' });
}

// ---------- Aprender de lo que no supo ----------
// El dueño responde una pregunta que la IA no supo: queda guardada y, si quiere, se la manda al cliente.
export async function teachAnswer(fd) {
  const { supabase, bakery } = await guard();
  const id = str(fd, 'message_id');
  const from = str(fd, 'back') || HOME;
  if (!isUuid(id)) back(from);
  const { data: msg } = await supabase.from('assistant_messages').select('id,conversation_id,meta').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
  if (!msg) back(from, { error: 'No encontré esa pregunta.' });
  const question = str(fd, 'question', 300) || msg.meta?.question || null;
  const answer = str(fd, 'answer', 1000);
  if (!answer) back(from, { error: 'Escribí la respuesta.' });
  await supabase.from('assistant_knowledge').insert({ bakery_id: bakery.id, question, answer, source: 'aprendida' });
  await supabase.from('assistant_messages').update({ learned: true }).eq('id', msg.id);
  if (fd.get('send') === 'on') {
    await supabase.from('assistant_messages').insert({ conversation_id: msg.conversation_id, bakery_id: bakery.id, role: 'dueno', text: answer });
    await supabase.from('assistant_conversations').update({ last_message_at: new Date().toISOString(), unread_owner: false }).eq('id', msg.conversation_id);
  }
  back(from, { ok: fd.get('send') === 'on' ? 'Aprendido y enviado al cliente.' : 'Aprendido. La próxima vez responde solo.' });
}

export async function dismissUnknown(fd) {
  const { supabase, bakery } = await guard();
  const id = str(fd, 'message_id');
  if (isUuid(id)) await supabase.from('assistant_messages').update({ learned: true }).eq('id', id).eq('bakery_id', bakery.id);
  back(str(fd, 'back') || HOME, { ok: 'Listo, no te la vuelvo a mostrar.' });
}

// ---------- Conversaciones ----------
// El dueño escribe en la charla: el cliente lo ve en el chat y la IA se calla 12 h en esa charla.
export async function ownerReply(fd) {
  const { supabase, bakery } = await guard();
  const id = str(fd, 'conversation_id');
  const from = `${HOME}/${id}`;
  if (!isUuid(id)) back(HOME);
  const text = str(fd, 'text', 1500);
  if (!text) back(from, { error: 'Escribí el mensaje.' });
  const { data: conv } = await supabase.from('assistant_conversations').select('id,messages_count').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
  if (!conv) back(HOME, { error: 'No encontré esa conversación.' });
  await supabase.from('assistant_messages').insert({ conversation_id: id, bakery_id: bakery.id, role: 'dueno', text });
  await supabase.from('assistant_conversations').update({
    last_message_at: new Date().toISOString(),
    messages_count: conv.messages_count + 1,
    unread_owner: false,
    paused_until: new Date(Date.now() + 12 * 3600000).toISOString(),
  }).eq('id', id);
  if (fd.get('save') === 'on') {
    const question = str(fd, 'question', 300) || null;
    await supabase.from('assistant_knowledge').insert({ bakery_id: bakery.id, question, answer: text.slice(0, 1000), source: 'aprendida' });
  }
  back(from, { ok: fd.get('save') === 'on' ? 'Enviado y guardado para la próxima.' : 'Enviado. La IA queda en pausa en esta charla por 12 horas.' });
}

export async function setConversation(fd) {
  const { supabase, bakery } = await guard();
  const id = str(fd, 'conversation_id');
  const what = str(fd, 'what');
  if (!isUuid(id)) back(HOME);
  const patch = what === 'resuelta' ? { status: 'resuelta', unread_owner: false }
    : what === 'ia' ? { status: 'ia', paused_until: null, unread_owner: false }
      : what === 'pausar' ? { paused_until: new Date(Date.now() + 12 * 3600000).toISOString() }
        : null;
  if (!patch) back(`${HOME}/${id}`);
  await supabase.from('assistant_conversations').update(patch).eq('id', id).eq('bakery_id', bakery.id);
  back(what === 'resuelta' ? HOME : `${HOME}/${id}`, { ok: what === 'resuelta' ? 'Marcada como resuelta.' : what === 'ia' ? 'La IA vuelve a atender esta charla.' : 'Tomaste la charla: la IA no contesta por 12 horas.' });
}

export async function deleteConversation(fd) {
  const { supabase, bakery } = await guard();
  const id = str(fd, 'conversation_id');
  if (isUuid(id)) await supabase.from('assistant_conversations').delete().eq('id', id).eq('bakery_id', bakery.id);
  back(HOME, { ok: 'Conversación borrada.' });
}

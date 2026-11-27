// Chat público del Asistente IA en el catálogo (/c/[slug]).
// GET  ?c=<conversación>&t=<token>&after=<fecha ISO>  → mensajes nuevos (para ver lo que respondió el dueño).
// POST { c?, t?, text?, contact?: { name, phone }, test? }  → guarda el mensaje del cliente y responde con la IA.
// El navegador del cliente guarda c y t; sin el token nadie puede leer una charla ajena.
import { NextResponse } from 'next/server';
import { createAdmin, createClient } from '@/lib/supabase';
import { moduleAccess, ASSISTANT_LIMITS } from '@/lib/modules';
import { loadSettings, monthUsage, aiReply, publicMessages, newToken } from '@/lib/assistant';
import { notify } from '@/lib/notifications';
import { reportError } from '@/lib/alerts';
import { hasAI } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const json = (body, status = 200) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ''));
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);

async function loadBakery(admin, slug) {
  const { data: bakery } = await admin.from('bakeries').select('*').eq('slug', String(slug).slice(0, 80)).maybeSingle();
  if (!bakery) return null;
  const { data: sub } = await admin.from('subscriptions').select('*').eq('bakery_id', bakery.id).maybeSingle();
  return { bakery, access: moduleAccess(sub, bakery) };
}

async function loadConversation(admin, bakeryId, c, t) {
  if (!isUuid(c) || !t) return null;
  const { data } = await admin.from('assistant_conversations').select('*').eq('id', c).eq('bakery_id', bakeryId).maybeSingle();
  return data && data.token === String(t) ? data : null;
}

async function isOwner(bakery) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !!user && user.id === bakery.owner_id;
  } catch {
    return false;
  }
}

export async function GET(req, { params }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const admin = createAdmin();
  const found = await loadBakery(admin, slug);
  if (!found) return json({ error: 'not_found' }, 404);
  const conv = await loadConversation(admin, found.bakery.id, url.searchParams.get('c'), url.searchParams.get('t'));
  if (!conv) return json({ error: 'not_found' }, 404);
  let q = admin.from('assistant_messages').select('id,role,text,meta,created_at').eq('conversation_id', conv.id).order('created_at').limit(80);
  const after = url.searchParams.get('after');
  if (after && !Number.isNaN(Date.parse(after))) q = q.gt('created_at', after);
  const { data } = await q;
  return json({ messages: publicMessages(data), status: conv.status, contact: !!(conv.customer_phone || conv.customer_name) });
}

export async function POST(req, { params }) {
  const { slug } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const admin = createAdmin();
  const found = await loadBakery(admin, slug);
  if (!found) return json({ error: 'not_found' }, 404);
  const { bakery, access } = found;
  const test = body?.test === true;
  if (test && !(await isOwner(bakery))) return json({ error: 'forbidden' }, 403);
  const settings = await loadSettings(admin, bakery.id);
  if (!access.assistant || (!settings.enabled && !test)) return json({ error: 'off' }, 403);

  try {
    let conv = await loadConversation(admin, bakery.id, body?.c, body?.t);

    // El cliente deja su nombre y WhatsApp para que el negocio le responda.
    if (body?.contact && conv) {
      const name = clean(body.contact.name, 80) || null;
      const phone = clean(body.contact.phone, 40).replace(/[^\d+\s()-]/g, '') || null;
      if (!phone) return json({ error: 'phone' }, 400);
      await admin.from('assistant_conversations').update({ customer_name: name, customer_phone: phone, unread_owner: true }).eq('id', conv.id);
      if (conv.channel === 'catalogo') {
        await notify(admin, bakery, { kind: 'asistente', title: `${name || 'Un cliente'} dejó su WhatsApp en el chat`, body: `Escribile al ${phone}.`, url: `/app/asistente/${conv.id}` });
      }
      return json({ ok: true });
    }

    const text = clean(body?.text, 600);
    if (!text) return json({ error: 'empty' }, 400);

    if (!conv) {
      if (!test) {
        const u = await monthUsage(admin, bakery.id, access);
        if (u.left <= 0) {
          return json({ messages: [{ id: 'limite', role: 'ia', text: `Ahora el chat no está disponible.${bakery.whatsapp_contact ? ' Escribinos por WhatsApp y te respondemos.' : ''}`, products: [], suggestions: [], handoff: true }], limit: true });
        }
        // Freno contra abuso: muchas charlas nuevas en pocos minutos.
        const since = new Date(Date.now() - 10 * 60000).toISOString();
        const { count } = await admin.from('assistant_conversations').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id).gte('created_at', since);
        if ((count || 0) >= 40) return json({ error: 'busy' }, 429);
      }
      const { data: created, error } = await admin.from('assistant_conversations')
        .insert({ bakery_id: bakery.id, token: newToken(), channel: test ? 'prueba' : 'catalogo' })
        .select().single();
      if (error) throw error;
      conv = created;
    } else {
      if (conv.messages_count >= ASSISTANT_LIMITS.perConversation * 2) {
        return json({ messages: [{ id: 'tope', role: 'ia', text: `Esta charla ya es muy larga.${bakery.whatsapp_contact ? ' Seguimos por WhatsApp así te atiende una persona.' : ' Le aviso al negocio para que te responda.'}`, products: [], suggestions: [], handoff: true }] });
      }
      const { data: last } = await admin.from('assistant_messages').select('created_at').eq('conversation_id', conv.id).eq('role', 'cliente').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (last && Date.now() - new Date(last.created_at).getTime() < 1500) return json({ error: 'slow_down' }, 429);
    }

    const { data: mine } = await admin.from('assistant_messages').insert({ conversation_id: conv.id, bakery_id: bakery.id, role: 'cliente', text }).select().single();
    const now = new Date().toISOString();
    await admin.from('assistant_conversations').update({ last_message_at: now, messages_count: conv.messages_count + 1, unread_owner: true, ...(conv.status === 'resuelta' ? { status: 'ia' } : {}) }).eq('id', conv.id);

    // El dueño tomó la charla: la IA no contesta hasta que se la devuelva (o pasen 12 h).
    if (conv.paused_until && new Date(conv.paused_until) > new Date()) {
      return json({ c: conv.id, t: conv.token, messages: publicMessages([mine]), waiting: true });
    }

    const { data: history } = await admin.from('assistant_messages').select('role,text').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(16);
    const reply = hasAI()
      ? await aiReply(admin, bakery, access, settings, (history || []).reverse())
      : { text: `El asistente todavía no está listo.${bakery.whatsapp_contact ? ' Escribinos por WhatsApp.' : ''}`, meta: { handoff: true, fallback: 'sin_ia', products: [], suggestions: [] } };

    const { data: theirs } = await admin.from('assistant_messages').insert({ conversation_id: conv.id, bakery_id: bakery.id, role: 'ia', text: reply.text, meta: reply.meta }).select().single();
    const needs = reply.meta.handoff;
    await admin.from('assistant_conversations').update({ last_message_at: new Date().toISOString(), messages_count: conv.messages_count + 2, ...(needs ? { status: 'necesita' } : {}) }).eq('id', conv.id);

    // Aviso al dueño la primera vez que la charla lo necesita o que la IA no supo algo.
    if (conv.channel === 'catalogo' && conv.status !== 'necesita' && (needs || reply.meta.unknown)) {
      await notify(admin, bakery, {
        kind: 'asistente',
        title: needs ? 'Un cliente del chat te necesita' : 'El asistente no supo responder algo',
        body: (reply.meta.question || text).slice(0, 200),
        url: `/app/asistente/${conv.id}`,
      });
    }

    return json({ c: conv.id, t: conv.token, messages: publicMessages([mine, theirs]), askContact: needs && settings.ask_contact && !conv.customer_phone });
  } catch (e) {
    await reportError('asistente', e, { bakeryId: bakery.id });
    return json({ error: 'server' }, 500);
  }
}

import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase';
import { verifyMetaSignature } from '@/lib/whatsapp';
import { handleIncoming } from '@/lib/bot';
import { moduleAccess } from '@/lib/modules';
import { safeEqual } from '@/lib/crypto';
import { reportError } from '@/lib/alerts';

export const maxDuration = 30;

// Verificación del webhook por parte de Meta
export async function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN && safeEqual(token, process.env.WHATSAPP_VERIFY_TOKEN)) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request) {
  const raw = await request.text();
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  const admin = createAdmin();

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const phoneId = value.metadata?.phone_number_id;
      if (!phoneId || !value.messages?.length) continue;
      const { data: bakery } = await admin.from('bakeries').select('*').eq('wa_phone_number_id', phoneId).maybeSingle();
      if (!bakery) continue;
      if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'), bakery.wa_app_secret_enc)) continue;
      const { data: sub } = await admin.from('subscriptions').select('*').eq('bakery_id', bakery.id).maybeSingle();
      if (!moduleAccess(sub).whatsapp) continue;
      const contactName = value.contacts?.[0]?.profile?.name || '';
      for (const msg of value.messages) {
        if (!['text', 'interactive', 'button'].includes(msg.type)) continue;
        try {
          await handleIncoming(admin, bakery, msg, contactName);
        } catch (e) {
          await reportError('bot-whatsapp', e, { bakeryId: bakery.id });
        }
      }
    }
  }
  return NextResponse.json({ ok: true });
}

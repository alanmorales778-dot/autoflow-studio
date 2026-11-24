import { NextResponse } from 'next/server';
import { reportError } from '@/lib/alerts';
import { createAdmin } from '@/lib/supabase';
import { getPreapproval } from '@/lib/mp';
import { applyPreapproval } from '@/lib/billing';

// Notificaciones de suscripciones de HakkiraApp (cuenta de Mercado Pago de la plataforma)
export async function POST(request) {
  const token = process.env.MP_PLATFORM_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ ok: true });
  const url = new URL(request.url);
  let body = {};
  try { body = await request.json(); } catch {}
  const type = body.type || body.topic || url.searchParams.get('type') || url.searchParams.get('topic');
  const id = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
  if (!id || !String(type || '').includes('preapproval')) return NextResponse.json({ ok: true });
  try {
    const pre = await getPreapproval(token, id);
    await applyPreapproval(createAdmin(), pre);
  } catch (e) {
    await reportError('webhook:mp-suscripciones', e, { preapprovalId: String(id) });
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

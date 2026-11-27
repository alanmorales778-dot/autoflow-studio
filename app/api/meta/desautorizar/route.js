// «Deauthorize callback» de Meta: si la persona quita el permiso desde Instagram o Facebook, desconectamos la cuenta.
import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase';
import { reportError } from '@/lib/alerts';
import { parseSignedRequest } from '@/lib/instagram';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const secrets = [process.env.INSTAGRAM_APP_SECRET, process.env.META_APP_SECRET].filter(Boolean);
  const data = secrets.map((s) => parseSignedRequest(String(form?.get('signed_request') || ''), s)).find(Boolean);
  if (!data?.user_id) return NextResponse.json({ error: 'signed_request inválido' }, { status: 400 });
  try {
    await createAdmin().from('social_accounts').delete().eq('external_id', String(data.user_id).slice(0, 100));
  } catch (e) {
    await reportError('meta:desautorizar', e);
  }
  return NextResponse.json({ ok: true });
}

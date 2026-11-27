// «Data Deletion Request callback» que exige Meta: cuando una persona pide borrar sus datos desde
// Instagram o Facebook, borramos la cuenta conectada y devolvemos un código para seguir el pedido.
import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase';
import { appUrl } from '@/lib/env';
import { reportError } from '@/lib/alerts';
import { parseSignedRequest } from '@/lib/instagram';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const secrets = [process.env.INSTAGRAM_APP_SECRET, process.env.META_APP_SECRET].filter(Boolean);
  const data = secrets.map((s) => parseSignedRequest(String(form?.get('signed_request') || ''), s)).find(Boolean);
  if (!data?.user_id) return NextResponse.json({ error: 'signed_request inválido' }, { status: 400 });
  const userId = String(data.user_id).slice(0, 100);
  const code = crypto.randomBytes(8).toString('hex');
  try {
    const admin = createAdmin();
    await admin.from('social_accounts').delete().eq('external_id', userId);
    await admin.from('data_deletion_requests').insert({ code, network: 'meta', external_id: userId, status: 'completado' });
  } catch (e) {
    await reportError('meta:borrado', e);
  }
  return NextResponse.json({ url: `${appUrl()}/legal/borrado?codigo=${code}`, confirmation_code: code });
}

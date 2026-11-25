import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const nextParam = url.searchParams.get('next') || '/app';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/app';
  const supabase = await createClient();

  let error = null;
  if (code) ({ error } = await supabase.auth.exchangeCodeForSession(code));
  else if (tokenHash && type) ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  else error = new Error('Link inválido');

  if (error) return NextResponse.redirect(new URL('/login?error=link', url.origin));

  // Registro con Google: el rubro, la invitación piloto y el referido vienen en una cookie corta.
  const res = NextResponse.redirect(new URL(next, url.origin));
  const raw = request.cookies.get('hk_signup')?.value;
  if (raw) {
    res.cookies.set('hk_signup', '', { path: '/', maxAge: 0 });
    try {
      const extra = JSON.parse(decodeURIComponent(raw));
      const { data: { user } } = await supabase.auth.getUser();
      const meta = user?.user_metadata || {};
      const clean = (v, n) => String(v || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, n);
      const patch = {};
      if (!meta.business_type && /^[a-z]{2,20}$/.test(extra.business_type || '')) patch.business_type = extra.business_type;
      if (!meta.pilot_code && clean(extra.pilot_code, 24).length >= 4) patch.pilot_code = clean(extra.pilot_code, 24);
      if (!meta.ref_code && clean(extra.ref_code, 12).length >= 4) patch.ref_code = clean(extra.ref_code, 12);
      if (user && Object.keys(patch).length) await supabase.auth.updateUser({ data: patch });
    } catch { /* cookie rota: se ignora */ }
  }
  return res;
}

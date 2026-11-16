import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { googleAuthUrl } from '@/lib/google';
import { sign } from '@/lib/crypto';

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));
  const { data: bakery } = await supabase.from('bakeries').select('id').eq('owner_id', user.id).maybeSingle();
  if (!bakery) return NextResponse.redirect(new URL('/app', request.url));
  if (!process.env.GOOGLE_CLIENT_ID) return NextResponse.redirect(new URL('/app/configuracion?error=Google+no+est%C3%A1+habilitado+todav%C3%ADa', request.url));
  const state = sign(`${bakery.id}:${Date.now()}`);
  return NextResponse.redirect(googleAuthUrl(state));
}

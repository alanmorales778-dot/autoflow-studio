// Empieza la conexión con Instagram: manda al dueño a autorizar con su cuenta profesional.
import { NextResponse } from 'next/server';
import { getContext } from '@/lib/session';
import { sign } from '@/lib/crypto';
import { appUrl } from '@/lib/env';
import { hasInstagram, igAuthorizeUrl } from '@/lib/instagram';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { bakery, access } = await getContext();
  const back = (msg) => NextResponse.redirect(`${appUrl()}/app/marketing/redes?error=${encodeURIComponent(msg)}`);
  if (!bakery) return NextResponse.redirect(`${appUrl()}/app`);
  if (!access.marketing) return back('Activá el módulo Marketing IA para conectar Instagram.');
  if (!hasInstagram()) return back('La conexión con Instagram todavía no está disponible.');
  const state = sign(`${bakery.id}.${Date.now()}`);
  return NextResponse.redirect(igAuthorizeUrl(state));
}

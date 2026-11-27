// Vuelta de Instagram: valida el «state», cambia el código por un token largo y guarda la cuenta (cifrada).
import { NextResponse } from 'next/server';
import { getContext } from '@/lib/session';
import { createAdmin } from '@/lib/supabase';
import { unsign } from '@/lib/crypto';
import { appUrl } from '@/lib/env';
import { reportError } from '@/lib/alerts';
import { hasInstagram, igExchangeCode, saveIgAccount } from '@/lib/instagram';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const to = (key, msg) => NextResponse.redirect(`${appUrl()}/app/marketing/redes?${key}=${encodeURIComponent(msg)}`);
  if (!hasInstagram()) return to('error', 'La conexión con Instagram todavía no está disponible.');
  if (url.searchParams.get('error')) return to('error', 'Cancelaste la conexión con Instagram. Podés intentarlo de nuevo cuando quieras.');

  const { bakery } = await getContext();
  const raw = unsign(url.searchParams.get('state') || '');
  const [bakeryId, ts] = String(raw || '').split('.');
  if (!bakery || !raw || bakeryId !== bakery.id || Date.now() - Number(ts) > 15 * 60000) {
    return to('error', 'El enlace de conexión venció. Tocá «Conectar Instagram» de nuevo.');
  }
  const code = url.searchParams.get('code');
  if (!code) return to('error', 'Instagram no devolvió la autorización. Probá de nuevo.');

  try {
    const acc = await igExchangeCode(code);
    await saveIgAccount(createAdmin(), bakery.id, acc);
    return to('ok', `Instagram conectado${acc.username ? `: @${acc.username}` : ''}.`);
  } catch (e) {
    await reportError('instagram:conectar', e, { bakeryId: bakery.id });
    return to('error', 'No pudimos conectar Instagram. Revisá que sea una cuenta profesional (de empresa o creador) y probá de nuevo.');
  }
}

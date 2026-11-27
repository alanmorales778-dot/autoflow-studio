import { NextResponse } from 'next/server';
import { requireBakery } from '@/lib/session';
import { newCalendarToken, googleCalendarAddUrl } from '@/lib/ics';

export const dynamic = 'force-dynamic';

// «Agregar a Google Calendar» con un toque: si el negocio todavía no tiene enlace de
// calendario lo crea en el momento y abre Google Calendar con el calendario listo para aceptar.
// Se usa con <a> común (no <Link>) para que no se precargue.
export async function GET(request) {
  const { supabase, bakery } = await requireBakery();
  let token = bakery.calendar_token;
  if (!token) {
    token = newCalendarToken();
    const { error } = await supabase.from('bakeries').update({ calendar_token: token }).eq('id', bakery.id);
    if (error) {
      const url = new URL('/app/configuracion', request.url);
      url.searchParams.set('error', 'No pudimos crear el enlace del calendario. Probá de nuevo.');
      url.hash = 'calendario';
      return NextResponse.redirect(url, 303);
    }
  }
  return NextResponse.redirect(googleCalendarAddUrl(token), 303);
}

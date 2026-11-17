import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase';
import { buildCalendar, calendarRange, CAL_STATUSES } from '@/lib/ics';
import { reportError } from '@/lib/alerts';

export const dynamic = 'force-dynamic';

// Feed privado de pedidos: /cal/<token>.ics. El token largo y aleatorio es la única llave;
// se puede regenerar desde Configuración para invalidar el enlace anterior.
export async function GET(request, { params }) {
  const { token: raw } = await params;
  const token = String(raw || '').replace(/\.ics$/i, '');
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) return new NextResponse('No encontrado', { status: 404 });

  try {
    const admin = createAdmin();
    const { data: bakery } = await admin
      .from('bakeries')
      .select('id,name,pickup_address')
      .eq('calendar_token', token)
      .maybeSingle();
    if (!bakery) return new NextResponse('No encontrado', { status: 404 });

    const { from, to } = calendarRange();
    const { data: orders, error } = await admin
      .from('orders')
      .select('id,date,slot,status,expires_at,fulfillment,address,quantity,product_name,customer_name,customer_phone,options,dedication,allergies,notes,total,deposit_amount,paid_at,balance_paid_at')
      .eq('bakery_id', bakery.id)
      .in('status', CAL_STATUSES)
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .limit(2000);
    if (error) throw error;

    const now = new Date();
    const visible = (orders || []).filter(
      (o) => o.status !== 'pendiente_sena' || !o.expires_at || new Date(o.expires_at) > now,
    );

    return new NextResponse(buildCalendar(bakery, visible), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="pedidos.ics"',
        'Cache-Control': 'private, max-age=300',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (e) {
    await reportError('cal_feed', e).catch(() => {});
    return new NextResponse('Error', { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { reportError } from '@/lib/alerts';
import { createAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { getPayment } from '@/lib/mp';
import { confirmPaidOrder } from '@/lib/lifecycle';
import { markBalancePaid } from '@/lib/balance';

// Notificaciones de pago de las señas. Cada negocio cobra con su propia cuenta de Mercado Pago,
// así que validamos consultando el pago a la API con el token de ese negocio.
export async function POST(request) {
  const url = new URL(request.url);
  const bakeryId = url.searchParams.get('b');
  let body = {};
  try { body = await request.json(); } catch {}
  const type = body.type || body.topic || url.searchParams.get('type') || url.searchParams.get('topic');
  const paymentId = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
  if (!bakeryId || type !== 'payment' || !paymentId) return NextResponse.json({ ok: true });

  const admin = createAdmin();
  const { data: bakery } = await admin.from('bakeries').select('id,mp_access_token_enc').eq('id', bakeryId).maybeSingle();
  if (!bakery?.mp_access_token_enc) return NextResponse.json({ ok: true });
  try {
    const pay = await getPayment(decrypt(bakery.mp_access_token_enc), paymentId);
    if (pay.status === 'approved' && pay.external_reference) {
      const [orderId, kind] = String(pay.external_reference).split(':');
      const { data: order } = await admin.from('orders').select('id,bakery_id').eq('id', orderId).maybeSingle();
      if (order && order.bakery_id === bakery.id) {
        if (kind === 'saldo') await markBalancePaid(admin, order.id);
        else await confirmPaidOrder(admin, order.id, pay.id);
      }
    }
  } catch (e) {
    await reportError('webhook:mp-senas', e, { bakeryId: bakery.id, paymentId: String(paymentId) });
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

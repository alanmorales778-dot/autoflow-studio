import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdmin } from '@/lib/supabase';
import { decrypt, safeEqual } from '@/lib/crypto';
import { getPayment } from '@/lib/mp';
import { confirmPaidOrder } from '@/lib/lifecycle';
import { money, dateLabel, dateTimeLabel } from '@/lib/format';
import { isHolding } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export default async function PedidoEstado({ params, searchParams }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const admin = createAdmin();
  const { data: bakery } = await admin.from('bakeries').select('*').eq('slug', slug).maybeSingle();
  if (!bakery) notFound();
  let { data: order } = await admin.from('orders').select('*').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
  if (!order || !safeEqual(order.public_token, sp.t)) notFound();

  // Volvió de Mercado Pago: verificamos el pago contra la API (no confiamos en los parámetros de la URL)
  const paymentId = sp.payment_id || sp.collection_id;
  if (paymentId && order.status !== 'confirmado' && bakery.mp_access_token_enc) {
    try {
      const pay = await getPayment(decrypt(bakery.mp_access_token_enc), paymentId);
      if (pay.status === 'approved' && pay.external_reference === order.id) {
        order = (await confirmPaidOrder(admin, order.id, pay.id)) || order;
      }
    } catch {}
  }

  const pendingValid = order.status === 'pendiente_sena' && isHolding(order);
  return (
    <main className="narrow">
      <Link href={`/c/${slug}`} className="logo">{bakery.name}</Link>
      <div className="card" style={{ marginTop: 20 }}>
        {order.status === 'confirmado' || order.status === 'entregado' ? (
          <div className="alert ok"><strong>¡Pedido confirmado!</strong> Gracias, {order.customer_name.split(' ')[0]}.</div>
        ) : order.status === 'pendiente_sena' ? (
          <div className="alert warn">
            <strong>Falta pagar la seña.</strong>
            {order.expires_at ? <> Tenés tiempo hasta las {dateTimeLabel(order.expires_at).split(', ').pop()}.</> : <> {bakery.name} te va a contactar para coordinar el pago.</>}
          </div>
        ) : (
          <div className="alert bad"><strong>Este pedido {order.status === 'vencido' ? 'venció porque no se pagó la seña a tiempo' : 'fue cancelado'}.</strong> Podés hacer uno nuevo.</div>
        )}
        <h2>Detalle</h2>
        <p>
          {order.quantity} × {order.product_name}<br />
          Fecha: {dateLabel(order.date)}{order.slot ? ` · ${order.slot}` : ''}<br />
          {order.fulfillment === 'envio' ? `Envío a: ${order.address}` : `Retiro${bakery.pickup_address ? ` en ${bakery.pickup_address}` : ''}`}<br />
          Total: {money(order.total)} · Seña: {money(order.deposit_amount)}{order.paid_at ? ' (pagada)' : ''}<br />
          Saldo a pagar: {money(Number(order.total) - (order.paid_at ? Number(order.deposit_amount) : 0))}
        </p>
        {pendingValid && order.payment_url && <a className="btn block" href={order.payment_url}>Pagar seña con Mercado Pago</a>}
        {['vencido', 'cancelado'].includes(order.status) && <Link className="btn block" href={`/c/${slug}`}>Hacer un pedido nuevo</Link>}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Guardá este link para ver el estado de tu pedido.</p>
    </main>
  );
}

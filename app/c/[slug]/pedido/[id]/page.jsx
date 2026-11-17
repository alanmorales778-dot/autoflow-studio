import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdmin } from '@/lib/supabase';
import { decrypt, safeEqual } from '@/lib/crypto';
import { getPayment } from '@/lib/mp';
import { confirmPaidOrder } from '@/lib/lifecycle';
import { markBalancePaid, balanceDue } from '@/lib/balance';
import { money, dateLabel, dateTimeLabel } from '@/lib/format';
import { optionsSummary } from '@/lib/options';
import { isHolding } from '@/lib/orders';
import { payBalance } from '../../actions';

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
  if (paymentId && bakery.mp_access_token_enc) {
    try {
      const pay = await getPayment(decrypt(bakery.mp_access_token_enc), paymentId);
      const [refId, kind] = String(pay.external_reference || '').split(':');
      if (pay.status === 'approved' && refId === order.id) {
        if (kind === 'saldo') order = (await markBalancePaid(admin, order.id)) || order;
        else if (order.status !== 'confirmado') order = (await confirmPaidOrder(admin, order.id, pay.id)) || order;
      }
    } catch {}
  }

  const pendingValid = order.status === 'pendiente_sena' && isHolding(order);
  const due = balanceDue(order);
  const canPayBalance = ['confirmado', 'entregado'].includes(order.status) && due > 0 && !!bakery.mp_access_token_enc;
  return (
    <main className="narrow">
      <Link href={`/c/${slug}`} className="logo">{bakery.name}</Link>
      <div className="card" style={{ marginTop: 20 }}>
        {sp.error && <div className="alert bad">{sp.error}</div>}
        {order.status === 'confirmado' || order.status === 'entregado' ? (
          <div className="alert ok"><strong>¡Pedido confirmado!</strong> Gracias, {order.customer_name.split(' ')[0]}.{order.balance_paid_at && ' Está todo pago.'}</div>
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
          {order.options?.length > 0 && <><small>{optionsSummary(order.options)}</small><br /></>}
          {order.dedication && <><small>Dedicatoria: «{order.dedication}»</small><br /></>}
          {order.allergies && <><small>Alergias / restricciones: {order.allergies}</small><br /></>}
          Fecha: {dateLabel(order.date)}{order.slot ? ` · ${order.slot}` : ''}<br />
          {order.fulfillment === 'envio' ? `Envío a: ${order.address}` : `Retiro${bakery.pickup_address ? ` en ${bakery.pickup_address}` : ''}`}<br />
          Total: {money(order.total)} · Seña: {money(order.deposit_amount)}{order.paid_at ? ' (pagada)' : ''}<br />
          Saldo a pagar: {money(due)}
        </p>
        {order.reference_photo_url && <img src={order.reference_photo_url} alt="Foto de referencia" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 12 }} />}
        {pendingValid && order.payment_url && <a className="btn block" href={order.payment_url}>Pagar seña con Mercado Pago</a>}
        {canPayBalance && (
          <form action={payBalance}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="t" value={order.public_token} />
            <button className="btn block">Pagar saldo de {money(due)} con Mercado Pago</button>
          </form>
        )}
        {['vencido', 'cancelado'].includes(order.status) && <Link className="btn block" href={`/c/${slug}`}>Hacer un pedido nuevo</Link>}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Guardá este link para ver el estado de tu pedido.</p>
    </main>
  );
}

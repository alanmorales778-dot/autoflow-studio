import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdmin } from '@/lib/supabase';
import { safeEqual } from '@/lib/crypto';
import { refreshFromMercadoPago } from '@/lib/recurring';
import { money, dateLabel, WEEKDAYS } from '@/lib/format';

export const dynamic = 'force-dynamic';

const LABEL = { pendiente: 'Pendiente de pago', activa: 'Activa', pausada: 'Pausada', cancelada: 'Cancelada' };

export default async function SuscripcionEstado({ params, searchParams }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const admin = createAdmin();
  const { data: bakery } = await admin.from('bakeries').select('*').eq('slug', slug).maybeSingle();
  if (!bakery) notFound();
  let { data: sub } = await admin.from('customer_subscriptions').select('*').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
  if (!sub || !safeEqual(sub.public_token, sp.t)) notFound();
  try {
    sub = await refreshFromMercadoPago(admin, bakery, sub);
  } catch {}

  return (
    <main className="narrow">
      <Link href={`/c/${slug}`} className="logo">{bakery.name}</Link>
      <div className="card" style={{ marginTop: 20 }}>
        {sub.status === 'activa' ? (
          <div className="alert ok"><strong>¡Suscripción activa!</strong> Primera entrega: {dateLabel(sub.next_date)}.</div>
        ) : sub.status === 'pendiente' ? (
          <div className="alert warn">
            <strong>{sub.payment_mode === 'mercadopago' ? 'Falta confirmar el pago en Mercado Pago.' : 'Recibimos tu pedido de suscripción.'}</strong>{' '}
            {sub.payment_mode === 'mercadopago' ? 'Si ya pagaste, esto se actualiza en unos minutos.' : `${bakery.name} te va a contactar para coordinar el pago.`}
          </div>
        ) : (
          <div className="alert bad">Suscripción {LABEL[sub.status].toLowerCase()}.</div>
        )}
        <h2>Detalle</h2>
        <p>
          {sub.quantity} × {sub.product_name} · {sub.frequency_days === 7 ? 'cada semana' : 'cada 15 días'}, los {WEEKDAYS[sub.weekday].toLowerCase()}{sub.slot ? ` (${sub.slot})` : ''}<br />
          {sub.fulfillment === 'envio' ? `Envío a: ${sub.address}` : `Retiro${bakery.pickup_address ? ` en ${bakery.pickup_address}` : ''}`}<br />
          Precio por entrega: {money(Number(sub.unit_price) * sub.quantity)}
        </p>
        {sub.status === 'pendiente' && sub.init_point && <a className="btn block" href={sub.init_point}>Completar pago en Mercado Pago</a>}
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Para pausar o cancelar, escribile a {bakery.name}{sub.payment_mode === 'mercadopago' ? ' o hacelo desde tu cuenta de Mercado Pago (Suscripciones)' : ''}.</p>
      </div>
    </main>
  );
}

import { rubroOf, mapsUrl } from '@/lib/rubros';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdmin } from '@/lib/supabase';
import { decrypt, safeEqual } from '@/lib/crypto';
import { getPayment } from '@/lib/mp';
import { confirmPaidOrder } from '@/lib/lifecycle';
import { markBalancePaid, balanceDue } from '@/lib/balance';
import { money, dateLabel, whenLabel } from '@/lib/format';
import { optionsSummary } from '@/lib/options';
import { isHolding } from '@/lib/orders';
import { payBalance, uploadReceipt, replyAttendance, submitReview, acceptQuote } from '../../actions';
import { transferEnabled } from '@/lib/receipts';
import { todayAR } from '@/lib/format';
import CopyLink from '@/app/app/copy-link';

export const dynamic = 'force-dynamic';

// Título propio (antes mostraba el de la página de venta de HakkiraApp) y fuera de los buscadores: es un link privado.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { data: b } = await createAdmin().from('bakeries').select('name').eq('slug', slug).maybeSingle();
  return { title: b?.name ? `Tu pedido · ${b.name}` : 'Tu pedido', robots: { index: false, follow: false } };
}

// «Agregar a mi calendario» (Google Calendar). Entiende «16:30», «10:00 a 13:00» o sin horario (todo el día).
function calendarUrl(bakery, order, T) {
  const d = order.date.replace(/-/g, '');
  const times = String(order.slot || '').match(/\d{1,2}[:.]\d{2}/g) || [];
  const hhmm = (t) => t.replace(/[:.]/, '').padStart(4, '0') + '00';
  let dates;
  if (times[0]) {
    const start = hhmm(times[0]);
    let end = times[1] ? hhmm(times[1]) : null;
    if (!end) { const h = Number(start.slice(0, 2)) + 1; end = `${String(Math.min(23, h)).padStart(2, '0')}${start.slice(2)}`; }
    dates = `${d}T${start}/${d}T${end}`;
  } else {
    const next = new Date(`${order.date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    dates = `${d}/${next.toISOString().slice(0, 10).replace(/-/g, '')}`;
  }
  const where = order.fulfillment === 'envio' ? order.address : bakery.pickup_address;
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `${T.orderCap}: ${order.product_name} · ${bakery.name}`, dates, ctz: 'America/Argentina/Buenos_Aires' });
  if (where) q.set('location', where);
  return `https://calendar.google.com/calendar/render?${q}`;
}

function waLink(num) {
  const digits = String(num || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith('54') ? digits : `549${digits.replace(/^0/, '')}`}`;
}

export default async function PedidoEstado({ params, searchParams }) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const admin = createAdmin();
  const { data: bakery } = await admin.from('bakeries').select('*').eq('slug', slug).maybeSingle();
  const T = rubroOf(bakery);
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
        else if (order.status !== 'confirmado') order = (await confirmPaidOrder(admin, order.id, pay.id, pay.transaction_amount)) || order;
      }
    } catch {}
  }

  const pendingValid = order.status === 'pendiente_sena' && isHolding(order);
  const due = balanceDue(order);
  const maps = mapsUrl(bakery.pickup_address);
  const wa = waLink(bakery.whatsapp_contact);
  const canPayBalance = ['confirmado', 'entregado'].includes(order.status) && due > 0 && !!bakery.mp_access_token_enc;
  const showTransfer = pendingValid && !order.payment_url && transferEnabled(bakery) && Number(order.deposit_amount) > 0;
  const canReply = ['confirmado', 'pendiente_sena'].includes(order.status) && order.date >= todayAR();
  const showQuote = order.quote_lines?.length > 0 && ['pendiente_sena', 'confirmado'].includes(order.status);
  let review = null;
  if (order.status === 'entregado') ({ data: review } = await admin.from('reviews').select('rating').eq('order_id', order.id).maybeSingle());
  const hidden = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={order.id} />
      <input type="hidden" name="t" value={order.public_token} />
    </>
  );
  return (
    <main className="narrow">
      <Link href={`/c/${slug}`} className="logo">{bakery.name}</Link>
      <div className="card" style={{ marginTop: 20 }}>
        {sp.error && <div className="alert bad">{sp.error}</div>}
        {sp.ok && <div className="alert ok">{sp.ok}</div>}
        {order.status === 'confirmado' || order.status === 'entregado' ? (
          <div className="alert ok"><strong>¡{T.orderCap} confirmado{T.order === 'reserva' ? 'a' : ''}!</strong> Gracias, {order.customer_name.split(' ')[0]}.{order.balance_paid_at && ' Está todo pago.'}</div>
        ) : order.status === 'pendiente_sena' ? (
          <div className="alert warn">
            <strong>Falta pagar la seña.</strong>
            {order.expires_at ? <> Tenés tiempo hasta {whenLabel(order.expires_at)}; si no, el lugar se libera.{!order.payment_url && (transferEnabled(bakery) ? <> Podés pagarla por transferencia acá abajo.</> : <> {bakery.name} te va a escribir por WhatsApp para coordinar el pago.</>)}</> : <> {bakery.name} te va a contactar para coordinar el pago.</>}
          </div>
        ) : (
          <div className="alert bad"><strong>{T.order === 'reserva' ? 'Esta' : 'Este'} {T.order} {order.status === 'vencido' ? 'venció porque no se pagó la seña a tiempo' : (T.order === 'reserva' ? 'fue cancelada' : 'fue cancelado')}.</strong></div>
        )}
        <div className="when-box">
          <span className="when-d">{dateLabel(order.date)}</span>
          {order.slot && <span className="when-t num">{order.slot}</span>}
        </div>
        <h2 style={{ marginTop: 16 }}>Detalle</h2>
        <p>
          {order.quantity > 1 ? `${order.quantity} × ` : ''}{order.product_name}<br />
          {order.options?.length > 0 && <><small>{optionsSummary(order.options)}</small><br /></>}
          {order.dedication && <><small>{T.note1.label}: «{order.dedication}»</small><br /></>}
          {order.allergies && <><small>{T.note2.label}: {order.allergies}</small><br /></>}
          {order.fulfillment === 'envio' ? `${T.envio}: ${order.address}` : `${T.retiro}${bakery.pickup_address ? ` · ${bakery.pickup_address}` : ' · te confirmamos la dirección por WhatsApp'}`}<br />
          {Number(order.discount) > 0 && <>Descuento{order.coupon_code ? ` (${order.coupon_code})` : ''}: −{money(order.discount)}<br /></>}
          {Number(order.delivery_fee) > 0 && <>Envío: {money(order.delivery_fee)}<br /></>}
          Total: {money(order.total)}<br />
          {order.status === 'pendiente_sena' && Number(order.deposit_amount) > 0 ? (
            <>Seña para reservar: <strong>{money(order.deposit_amount)}</strong> · Resto al {order.fulfillment === 'envio' ? 'recibir' : 'retirar'}: {money(Number(order.total) - Number(order.deposit_amount))}</>
          ) : (
            <>{Number(order.deposit_amount) > 0 && <>Seña: {money(order.deposit_amount)}{order.paid_at ? ' (pagada)' : ''} · </>}{due > 0 ? <>Saldo a pagar: {money(due)}</> : 'Todo pago'}</>
          )}
        </p>
        {order.reference_photo_url && <img src={order.reference_photo_url} alt="Foto adjunta" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 12 }} />}
        {pendingValid && order.payment_url && <a className="btn block" href={order.payment_url}>Pagar seña con Mercado Pago</a>}
        {showTransfer && (
          <div className="card" style={{ background: 'var(--bg)', marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>Pagá la seña por transferencia</h3>
            <p style={{ margin: '0 0 8px' }}>
              Transferí <strong>{money(order.deposit_amount)}</strong> al alias <strong className="mono">{bakery.transfer_alias}</strong>
              {bakery.transfer_holder ? <> (a nombre de {bakery.transfer_holder})</> : null}.
            </p>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <CopyLink value={bakery.transfer_alias} label="Copiar alias" />
              <CopyLink value={String(Math.round(Number(order.deposit_amount)))} label="Copiar monto" />
            </div>
            {order.receipt_path && !order.receipt_check?.ok ? (
              <p className="muted" style={{ margin: 0 }}>Recibimos tu comprobante. {bakery.name} lo revisa y te confirma. ¿Te equivocaste de archivo? Subilo de nuevo:</p>
            ) : (
              <p className="muted" style={{ margin: '0 0 6px' }}>Después subí acá la captura o el PDF del comprobante: lo verificamos al instante.</p>
            )}
            <form action={uploadReceipt}>
              {hidden}
              <div className="field"><label>Comprobante</label><input type="file" name="comprobante" accept="image/jpeg,image/png,image/webp,application/pdf" required /></div>
              <button className="btn block">Enviar comprobante</button>
            </form>
          </div>
        )}
        {showQuote && (
          <div className="card" style={{ background: 'var(--bg)', marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>Presupuesto</h3>
            <table className="table"><tbody>
              {order.quote_lines.map((l, i) => <tr key={i}><td>{l.label}</td><td className="num" style={{ textAlign: 'right' }}>{money(l.amount)}</td></tr>)}
              <tr><td><strong>Total</strong></td><td className="num" style={{ textAlign: 'right' }}><strong>{money(order.total)}</strong></td></tr>
            </tbody></table>
            {order.quote_accepted_at ? <div className="alert ok" style={{ marginTop: 8 }}>Aceptaste este presupuesto.</div> : (
              <form action={acceptQuote} style={{ marginTop: 8 }}>{hidden}<button className="btn block">Acepto el presupuesto</button></form>
            )}
          </div>
        )}
        {canReply && (
          order.customer_reply ? (
            <p className="muted">{order.customer_reply === 'voy' ? '✓ Confirmaste que vas.' : 'Avisaste que no podés.'} ¿Cambió algo?</p>
          ) : (
            <p style={{ marginBottom: 6 }}><strong>¿Vas a poder {T.link.mode === 'visita' ? 'recibirnos' : T.link.mode === 'turno' ? 'venir' : 'estar'}?</strong></p>
          )
        )}
        {canReply && (
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            {order.customer_reply !== 'voy' && <form action={replyAttendance}>{hidden}<input type="hidden" name="reply" value="voy" /><button className="btn small">Sí, confirmo</button></form>}
            {order.customer_reply !== 'no_puedo' && <form action={replyAttendance}>{hidden}<input type="hidden" name="reply" value="no_puedo" /><button className="btn secondary small">No puedo</button></form>}
          </div>
        )}
        {order.status === 'entregado' && (review ? (
          <p className="muted">Gracias por tu opinión: {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
        ) : (
          <form action={submitReview} className="card" style={{ background: 'var(--bg)', marginBottom: 12 }}>
            {hidden}
            <h3 style={{ marginTop: 0 }}>¿Qué te pareció?</h3>
            <div className="row" style={{ gap: 6, marginBottom: 8 }}>
              {[5, 4, 3, 2, 1].map((n) => (
                <label key={n} className="chip"><input type="radio" name="rating" value={n} required defaultChecked={n === 5} /> {'★'.repeat(n)}</label>
              ))}
            </div>
            <div className="field"><label>Contanos algo (opcional)</label><textarea name="comment" rows={2} maxLength={500} /></div>
            <button className="btn">Enviar</button>
          </form>
        ))}
        {canPayBalance && (
          <form action={payBalance}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="t" value={order.public_token} />
            <button className="btn block">Pagar saldo de {money(due)} con Mercado Pago</button>
          </form>
        )}
        {['confirmado', 'pendiente_sena'].includes(order.status) && (
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <a className="btn secondary small" href={calendarUrl(bakery, order, T)} target="_blank" rel="noreferrer">Agregar a mi calendario</a>
            {order.fulfillment !== 'envio' && maps && <a className="btn secondary small" href={maps} target="_blank" rel="noreferrer">Cómo llegar</a>}
            {wa && <a className="btn secondary small" href={wa} target="_blank" rel="noreferrer">Escribir por WhatsApp</a>}
          </div>
        )}
        {bakery.policy_text && <div className="policy" style={{ marginTop: 16 }}><strong>Condiciones</strong><p>{bakery.policy_text}</p></div>}
        {['vencido', 'cancelado'].includes(order.status) && <Link className="btn block" href={`/c/${slug}`}>Hacer {T.order === 'reserva' ? 'una' : 'uno'} {T.order === 'reserva' ? 'nueva' : 'nuevo'}</Link>}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Guardá este link para ver cómo va tu {T.order}.</p>
    </main>
  );
}

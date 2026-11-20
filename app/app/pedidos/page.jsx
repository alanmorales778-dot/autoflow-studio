import { rubroOf } from '@/lib/rubros';
import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { changeOrderStatus, createManualOrder, markBalance } from '../actions';
import { balanceDue, reminderLink } from '@/lib/balance';
import { optionsSummary } from '@/lib/options';
import { Flash, StatusBadge } from '../ui';
import ConfirmButton from '../confirm-button';
import { money, dateLabel, dateTimeLabel, todayAR, addDays, STATUS_LABEL } from '@/lib/format';

const FILTERS = [
  ['activos', 'Activos'],
  ['pendiente_sena', 'Esperando seña'],
  ['confirmado', 'Confirmados'],
  ['entregado', 'Entregados'],
  ['cancelado,vencido', 'Cancelados / vencidos'],
];

function Action({ id, status, label, cls = 'secondary', confirm }) {
  return (
    <form action={changeOrderStatus} style={{ display: 'inline' }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      {confirm ? <ConfirmButton className={`btn small ${cls}`} message={confirm}>{label}</ConfirmButton> : <button className={`btn small ${cls}`}>{label}</button>}
    </form>
  );
}

export default async function Pedidos({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery } = await requireBakery();
  const T = rubroOf(bakery);
  const filter = sp.f || 'activos';
  let q = supabase.from('orders').select('*').eq('bakery_id', bakery.id);
  if (filter === 'activos') q = q.in('status', ['pendiente_sena', 'confirmado']).gte('date', addDays(todayAR(), -7)).order('date');
  else q = q.in('status', filter.split(',')).order('date', { ascending: false });
  const [{ data: orders }, { data: products }] = await Promise.all([
    q.limit(300),
    supabase.from('products').select('id,name,price').eq('bakery_id', bakery.id).not('sheet_row', 'is', null).order('sheet_row'),
  ]);

  return (
    <>
      <Flash sp={sp} />
      <h1>Pedidos</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/app/pedidos?f=${k}`} className={`btn small ${filter === k ? '' : 'secondary'}`}>{label}</Link>
        ))}
      </div>

      <div className="card table-wrap">
        {!orders || orders.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No hay pedidos en esta vista.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Fecha</th><th>Pedido</th><th>Cliente</th><th>Entrega</th><th>Importe</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{dateLabel(o.date)}<br /><small>{o.slot || ''}</small></td>
                  <td>
                    {o.quantity} × {o.product_name}
                    {o.options?.length > 0 && <><br /><small>{optionsSummary(o.options)}</small></>}
                    {o.dedication && <><br /><small>{T.note1.label}: «{o.dedication}»</small></>}
                    {o.allergies && <><br /><span className="badge bad">⚠ {o.allergies}</span></>}
                    {o.reference_photo_url && <><br /><a href={o.reference_photo_url} target="_blank" rel="noreferrer"><small>Ver foto de referencia</small></a></>}
                    <br /><small>{{ whatsapp: 'WhatsApp', manual: 'Cargado a mano', suscripcion: 'Suscripción', web: 'Web' }[o.channel]} · {dateTimeLabel(o.created_at)}{o.occasion ? ` · ${o.occasion}` : ''}</small>
                    {o.notes ? <><br /><small>{o.notes}</small></> : null}
                  </td>
                  <td>{o.customer_name}<br /><small>{o.customer_phone || ''}</small></td>
                  <td>{o.fulfillment === 'envio' ? `${T.envio}: ${o.address}` : T.retiro}</td>
                  <td>
                    {money(o.total)}<br /><small>Seña {money(o.deposit_amount)}{o.paid_at ? ' ✓' : ' sin cobrar'}</small>
                    <br />{o.status === 'pendiente_sena' ? null : balanceDue(o) > 0 ? <small style={{ color: 'var(--warn)' }}>Saldo {money(balanceDue(o))}</small> : <small style={{ color: 'var(--ok)' }}>Pagado ✓</small>}
                  </td>
                  <td>
                    <StatusBadge status={o.status} />
                    {o.status === 'pendiente_sena' && o.expires_at && <><br /><small>vence {dateTimeLabel(o.expires_at)}</small></>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {o.status === 'pendiente_sena' && <Action id={o.id} status="confirmado" label="Seña cobrada" />}{' '}
                    {o.status === 'confirmado' && <Action id={o.id} status="entregado" label="Entregado" />}{' '}
                    {['pendiente_sena', 'confirmado'].includes(o.status) && <span style={{ marginLeft: 10 }}><Action id={o.id} status="cancelado" label="Cancelar" cls="danger" confirm={`¿Cancelar el pedido de ${o.customer_name} (${o.quantity} × ${o.product_name}, ${dateLabel(o.date)})?${o.paid_at ? ' Ya pagó la seña: acordá con el cliente la devolución.' : ''} Se libera el cupo.`} /></span>}
                    {o.status === 'vencido' && <Action id={o.id} status="confirmado" label="Confirmar igual" />}
                    {['confirmado', 'entregado'].includes(o.status) && (
                      <div className="row" style={{ gap: 6, marginTop: 6 }}>
                        {o.customer_phone && reminderLink(bakery, o) && <a className="btn secondary small" href={reminderLink(bakery, o)} target="_blank" rel="noreferrer">{balanceDue(o) > 0 ? 'Cobrar saldo por WhatsApp' : 'Recordar por WhatsApp'}</a>}
                        {balanceDue(o) > 0 && (
                          <form action={markBalance} style={{ display: 'inline' }}>
                            <input type="hidden" name="id" value={o.id} />
                            <button className="btn secondary small">Saldo cobrado</button>
                          </form>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" id="nuevo">
        <h2>Cargar pedido a mano</h2>
        <p className="muted">Para pedidos que te llegan por teléfono, Instagram o en persona. Ocupa cupo y stock igual que los pedidos online.</p>
        {!products || products.length === 0 ? (
          <p>Primero cargá tus productos en <a href="/app/productos">Productos</a> (subiendo un archivo o con Google Drive).</p>
        ) : (
          <form action={createManualOrder}>
            <div className="grid grid-3">
              <div className="field">
                <label>Producto</label>
                <select name="product_id" required>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({money(p.price)})</option>)}
                </select>
              </div>
              <div className="field"><label>Cantidad</label><input name="quantity" type="number" min="1" defaultValue="1" required /></div>
              <div className="field"><label>Fecha</label><input name="date" type="date" required defaultValue={addDays(todayAR(), 1)} /></div>
              <div className="field">
                <label>Horario</label>
                <select name="slot">{(bakery.slots || []).map((s) => <option key={s}>{s}</option>)}</select>
              </div>
              <div className="field">
                <label>Entrega</label>
                <select name="fulfillment"><option value="retiro">{T.retiro}</option>{bakery.delivery_enabled && <option value="envio">{T.envio}</option>}</select>
              </div>
              <div className="field"><label>Dirección (si es {T.envio.toLowerCase()})</label><input name="address" /></div>
              <div className="field"><label>Nombre del cliente</label><input name="customer_name" required /></div>
              <div className="field"><label>Teléfono</label><input name="customer_phone" /></div>
              <div className="field"><label>{T.note1.label}</label><input name="dedication" placeholder={T.note1.ph} /></div>
              <div className="field"><label>{T.note2.label}</label><input name="allergies" placeholder={T.note2.ph} /></div>
              <div className="field"><label>Notas</label><input name="notes" /></div>
            </div>
            <div className="row" style={{ marginBottom: 12 }}>
              <label className="inline-label"><input type="checkbox" name="deposit_paid" /> La seña ya está cobrada</label>
              <label className="inline-label"><input type="checkbox" name="force" /> Cargar aunque no haya cupo o stock</label>
            </div>
            <button className="btn">Guardar pedido</button>
          </form>
        )}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Estados: {Object.values(STATUS_LABEL).join(' · ')}.</p>
    </>
  );
}

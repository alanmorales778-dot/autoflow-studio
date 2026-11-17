import { requireBakery } from '@/lib/session';
import { changeCustomerSubscription, createManualSubscription } from '../actions';
import { Flash, Locked } from '../ui';
import { money, dateLabel, WEEKDAYS } from '@/lib/format';
import { subscriptionStatusUrl } from '@/lib/recurring';
import { appUrl } from '@/lib/env';

const LABEL = { pendiente: ['Pendiente', 'warn'], activa: ['Activa', 'ok'], pausada: ['Pausada', 'warn'], cancelada: ['Cancelada', 'bad'] };

function Btn({ id, status, label, cls = 'secondary' }) {
  return (
    <form action={changeCustomerSubscription} style={{ display: 'inline' }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`btn small ${cls}`}>{label}</button>
    </form>
  );
}

export default async function Suscripciones({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const [{ data: subs }, { data: products }] = await Promise.all([
    supabase.from('customer_subscriptions').select('*').eq('bakery_id', bakery.id).order('created_at', { ascending: false }),
    supabase.from('products').select('id,name,price,allow_subscription').eq('bakery_id', bakery.id).not('sheet_row', 'is', null).order('sheet_row'),
  ]);
  const active = (subs || []).filter((s) => s.status === 'activa');
  const weekly = active.reduce((sum, s) => sum + (Number(s.unit_price) * s.quantity * 7) / s.frequency_days, 0);
  const subProducts = (products || []).filter((p) => p.allow_subscription);

  return (
    <>
      <Flash sp={sp} />
      <h1>Pedidos recurrentes</h1>
      {!access.recurring && <Locked title="Módulo Pedidos recurrentes">Tus clientes se suscriben a viandas, cajas o budines semanales y los pedidos se generan solos.</Locked>}
      <div className="grid grid-3">
        <div className="card"><small className="muted">Suscripciones activas</small><div className="price">{active.length}</div></div>
        <div className="card"><small className="muted">Ingreso semanal asegurado</small><div className="price">{money(weekly)}</div></div>
        <div className="card"><small className="muted">Por mes (aprox.)</small><div className="price">{money(weekly * 4.33)}</div></div>
      </div>

      {subProducts.length === 0 ? (
        <div className="alert info">Para ofrecer suscripciones, entrá a un producto en <a href="/app/productos">Productos → Receta</a> y activá «Se puede pedir por suscripción». Aparece el botón «Suscribirme» en tu catálogo.</div>
      ) : (
        <div className="alert info">En tu catálogo ({appUrl()}/c/{bakery.slug}) tus clientes ven «Suscribirme» en: {subProducts.map((p) => p.name).join(', ')}.</div>
      )}

      <div className="card table-wrap">
        {!subs || subs.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Todavía no hay suscripciones.</p>
        ) : (
          <table>
            <thead><tr><th>Cliente</th><th>Qué y cuándo</th><th>Próxima entrega</th><th>Cobro</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>{s.customer_name}<br /><small>{s.customer_phone}</small></td>
                  <td>{s.quantity} × {s.product_name}<br /><small>{s.frequency_days === 7 ? 'Semanal' : 'Quincenal'}, {WEEKDAYS[s.weekday].toLowerCase()}{s.slot ? ` · ${s.slot}` : ''} · {s.fulfillment === 'envio' ? `envío a ${s.address}` : 'retira'}</small></td>
                  <td>{s.status === 'activa' ? dateLabel(s.next_date) : '—'}</td>
                  <td>{money(Number(s.unit_price) * s.quantity)}<br /><small>{s.payment_mode === 'mercadopago' ? 'Débito Mercado Pago' : 'Cobro a mano'}</small></td>
                  <td><span className={`badge ${LABEL[s.status][1]}`}>{LABEL[s.status][0]}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {(s.status === 'pendiente' && s.payment_mode === 'manual') && <Btn id={s.id} status="activa" label="Activar" cls="" />}{' '}
                    {s.status === 'activa' && <Btn id={s.id} status="pausada" label="Pausar" />}{' '}
                    {s.status === 'pausada' && <Btn id={s.id} status="activa" label="Reanudar" cls="" />}{' '}
                    {s.status !== 'cancelada' && <Btn id={s.id} status="cancelada" label="Cancelar" cls="danger" />}{' '}
                    <a className="btn secondary small" href={subscriptionStatusUrl(bakery, s)} target="_blank" rel="noreferrer">Ver</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {access.recurring && (products || []).length > 0 && (
        <div className="card">
          <h2>Cargar una suscripción a mano</h2>
          <p className="muted">Para clientes que ya te compran todas las semanas y te pagan por transferencia o en efectivo. Los pedidos se generan solos una semana antes de cada entrega, con el saldo pendiente.</p>
          <form action={createManualSubscription}>
            <div className="grid grid-3">
              <div className="field"><label>Producto</label><select name="product_id">{products.map((p) => <option key={p.id} value={p.id}>{p.name} ({money(p.price)})</option>)}</select></div>
              <div className="field"><label>Cantidad por entrega</label><input name="quantity" type="number" min="1" defaultValue="1" /></div>
              <div className="field"><label>Frecuencia</label><select name="frequency_days"><option value="7">Semanal</option><option value="14">Quincenal</option></select></div>
              <div className="field"><label>Día</label><select name="weekday" defaultValue="1">{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
              <div className="field"><label>Horario</label><select name="slot">{(bakery.slots || []).map((s) => <option key={s}>{s}</option>)}</select></div>
              <div className="field"><label>Entrega</label><select name="fulfillment"><option value="retiro">Retira</option>{bakery.delivery_enabled && <option value="envio">Envío</option>}</select></div>
              <div className="field"><label>Dirección (si es envío)</label><input name="address" /></div>
              <div className="field"><label>Cliente</label><input name="customer_name" required /></div>
              <div className="field"><label>WhatsApp</label><input name="customer_phone" required /></div>
            </div>
            <button className="btn">Crear suscripción</button>
          </form>
        </div>
      )}
    </>
  );
}

import { rubroOf } from '@/lib/rubros';
import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { changeOrderStatus, createManualOrder, markBalance, updateOrder } from '../actions';
import { balanceDue, reminderLink } from '@/lib/balance';
import { optionsSummary } from '@/lib/options';
import { normName } from '@/lib/format';
import { Flash, StatusBadge } from '../ui';
import ConfirmButton from '../confirm-button';
import { money, dateLabel, dateTimeLabel, todayAR, addDays } from '@/lib/format';

const FILTERS = [
  ['activos', 'Activos'],
  ['pendiente_sena', 'Esperando seña'],
  ['confirmado', 'Confirmados'],
  ['entregado', 'Entregados'],
  ['cancelado,vencido', 'Cancelados'],
];
const CHANNEL = { whatsapp: 'WhatsApp', manual: 'Cargado a mano', suscripcion: 'Recurrente', web: 'Tu link' };

function Action({ id, status, label, cls = 'secondary', confirm, back }) {
  return (
    <form action={changeOrderStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      {back && <input type="hidden" name="back" value={back} />}
      {confirm ? <ConfirmButton className={`btn small ${cls}`} message={confirm}>{label}</ConfirmButton> : <button className={`btn small ${cls}`}>{label}</button>}
    </form>
  );
}

function EditOrder({ o, bakery, T, open, back }) {
  return (
    <details className="fold" open={open}>
      <summary className="btn secondary small">Editar</summary>
      <form action={updateOrder} className="fold-body fold-wide">
        <input type="hidden" name="id" value={o.id} />
        <input type="hidden" name="back" value={back} />
        <div className="grid grid-3" style={{ gap: 10 }}>
          <div className="field"><label>Fecha</label><input type="date" name="date" defaultValue={o.date} required /></div>
          <div className="field">
            <label>Horario</label>
            <select name="slot" defaultValue={o.slot || ''}>
              <option value="">Sin horario</option>
              {[...new Set([...(bakery.slots || []), ...(o.slot ? [o.slot] : [])])].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field"><label>Cantidad</label><input type="number" name="quantity" min="1" max="999" defaultValue={o.quantity} required /></div>
          <div className="field"><label>Cliente</label><input name="customer_name" defaultValue={o.customer_name} required /></div>
          <div className="field"><label>Teléfono</label><input name="customer_phone" defaultValue={o.customer_phone || ''} inputMode="tel" /></div>
          <div className="field">
            <label>Entrega</label>
            <select name="fulfillment" defaultValue={o.fulfillment}>
              <option value="retiro">{T.retiro}</option>
              {(bakery.delivery_enabled || o.fulfillment === 'envio') && <option value="envio">{T.envio}</option>}
            </select>
          </div>
          <div className="field"><label>Dirección (si es {T.envio.toLowerCase()})</label><input name="address" defaultValue={o.address || ''} /></div>
          <div className="field"><label>{T.note1.label}</label><input name="dedication" defaultValue={o.dedication || ''} placeholder={T.note1.ph} /></div>
          <div className="field"><label>{T.note2.label}</label><input name="allergies" defaultValue={o.allergies || ''} placeholder={T.note2.ph} /></div>
        </div>
        <div className="field"><label>Notas</label><input name="notes" defaultValue={o.notes || ''} /></div>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>
          Precio por unidad: {money(o.unit_price ?? Number(o.total) / Math.max(1, o.quantity))}. Si cambiás la cantidad, el total se recalcula{o.paid_at ? ' (la seña ya cobrada no cambia)' : ''}.
        </p>
        <button className="btn small">Guardar cambios</button>
      </form>
      <div className="fold-actions">
        <span className="muted" style={{ fontSize: 13 }}>¿El cliente ya no lo quiere?</span>
        <Action id={o.id} status="cancelado" label={`Cancelar ${T.order}`} cls="danger" back={back} confirm={`¿Cancelar ${T.order === 'turno' ? 'el turno' : T.order === 'reserva' ? 'la reserva' : 'el ' + T.order} de ${o.customer_name} (${o.quantity} × ${o.product_name}, ${dateLabel(o.date)})?${o.paid_at ? ' Ya pagó la seña: acordá con el cliente la devolución.' : ''} Se libera el cupo.`} />
      </div>
    </details>
  );
}

export default async function Pedidos({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery } = await requireBakery();
  const T = rubroOf(bakery);
  const filter = FILTERS.some(([k]) => k === sp.f) ? sp.f : 'activos';
  const search = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : '';
  let q = supabase.from('orders').select('*').eq('bakery_id', bakery.id);
  if (filter === 'activos') q = q.in('status', ['pendiente_sena', 'confirmado']).gte('date', addDays(todayAR(), -7)).order('date').order('slot');
  else q = q.in('status', filter.split(',')).order('date', { ascending: false });
  const [{ data: rawOrders }, { data: products }] = await Promise.all([
    q.limit(300),
    supabase.from('products').select('id,name,price').eq('bakery_id', bakery.id).not('sheet_row', 'is', null).order('sheet_row'),
  ]);
  const needle = normName(search);
  const digits = search.replace(/\D/g, '');
  const orders = (rawOrders || []).filter((o) => !needle
    || normName(`${o.customer_name} ${o.product_name}`).includes(needle)
    || (digits.length >= 3 && String(o.customer_phone || '').replace(/\D/g, '').includes(digits)));
  const self = `/app/pedidos?${new URLSearchParams({ ...(filter !== 'activos' ? { f: filter } : {}), ...(search ? { q: search } : {}) })}`;
  const showNew = !!sp.nuevo;

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <h1>{T.orders}</h1>
        {!showNew && <Link href="/app/pedidos?nuevo=1#nuevo" className="btn small hide-mobile">+ Cargar {T.order}</Link>}
      </div>

      <details className="card fold" id="nuevo" open={showNew}>
        <summary><h2>Cargar {T.order} a mano</h2></summary>
        <p className="muted" style={{ marginTop: 8 }}>Para lo que te llega por teléfono, Instagram o en persona. Ocupa cupo y stock igual que lo que entra por tu link.</p>
        {!products || products.length === 0 ? (
          <p>Primero cargá tus productos en <Link href="/app/productos">Productos</Link>.</p>
        ) : (
          <form action={createManualOrder}>
            <div className="grid grid-3" style={{ gap: 10 }}>
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
              <div className="field"><label>Nombre del cliente</label><input name="customer_name" required /></div>
              <div className="field"><label>Teléfono</label><input name="customer_phone" inputMode="tel" /></div>
              <div className="field">
                <label>Entrega</label>
                <select name="fulfillment"><option value="retiro">{T.retiro}</option>{bakery.delivery_enabled && <option value="envio">{T.envio}</option>}</select>
              </div>
              <div className="field"><label>Dirección (si es {T.envio.toLowerCase()})</label><input name="address" /></div>
              <div className="field"><label>{T.note1.label}</label><input name="dedication" placeholder={T.note1.ph} /></div>
              <div className="field"><label>{T.note2.label}</label><input name="allergies" placeholder={T.note2.ph} /></div>
              <div className="field"><label>Notas</label><input name="notes" /></div>
            </div>
            <div className="row" style={{ marginBottom: 12 }}>
              <label className="inline-label"><input type="checkbox" name="deposit_paid" /> La seña ya está cobrada</label>
              <label className="inline-label"><input type="checkbox" name="force" /> Cargar aunque no haya cupo o stock</label>
            </div>
            <button className="btn">Guardar {T.order}</button>
          </form>
        )}
      </details>

      <div className="filters" role="navigation" aria-label="Filtrar">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/app/pedidos?${new URLSearchParams({ ...(k !== 'activos' ? { f: k } : {}), ...(search ? { q: search } : {}) })}`} className={`chip ${filter === k ? 'on' : ''}`} aria-current={filter === k ? 'page' : undefined}>{label}</Link>
        ))}
      </div>
      <form method="get" className="row" style={{ marginBottom: 12, gap: 8, flexWrap: 'nowrap' }}>
        {filter !== 'activos' && <input type="hidden" name="f" value={filter} />}
        <input type="search" name="q" defaultValue={search} placeholder="Buscar por cliente, teléfono o producto" aria-label="Buscar" />
        <button className="btn secondary">Buscar</button>
      </form>

      <div className="card">
        {orders.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{search ? `Nada coincide con «${search}».` : `No hay ${T.orders.toLowerCase()} en esta vista.`}</p>
        ) : (
          <ul className="items">
            {orders.map((o) => {
              const due = balanceDue(o);
              const link = o.customer_phone ? reminderLink(bakery, o) : null;
              const editable = ['pendiente_sena', 'confirmado'].includes(o.status);
              const extra = [optionsSummary(o.options), o.dedication && `${T.note1.label}: «${o.dedication}»`, o.notes].filter(Boolean);
              return (
                <li key={o.id} id={`p-${o.id}`} className={`item ${sp.editar === o.id ? 'highlight' : ''}`}>
                  <div className="item-head">
                    <div>
                      <div className="item-title">{o.quantity} × {o.product_name}</div>
                      <div className="item-sub">{dateLabel(o.date)}{o.slot ? ` · ${o.slot}` : ''} · {o.customer_name}{o.customer_phone ? ` · ${o.customer_phone}` : ''}</div>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="item-meta">
                    <span>{o.fulfillment === 'envio' ? `${T.envio}: ${o.address}` : T.retiro}</span>
                    <span>Total {money(o.total)}</span>
                    <span>Seña {money(o.deposit_amount)} {o.paid_at ? '✓' : 'sin cobrar'}</span>
                    {o.status !== 'pendiente_sena' && (due > 0 ? <span style={{ color: 'var(--warn)' }}>Saldo {money(due)}</span> : <span style={{ color: 'var(--ok)' }}>Pagado ✓</span>)}
                    {o.status === 'pendiente_sena' && o.expires_at && <span>Vence {dateTimeLabel(o.expires_at)}</span>}
                  </div>
                  {extra.length > 0 && <div className="item-sub">{extra.join(' · ')}</div>}
                  {(o.allergies || o.reference_photo_url) && (
                    <div className="item-meta">
                      {o.allergies && <span className="badge bad">⚠ {o.allergies}</span>}
                      {o.reference_photo_url && <a href={o.reference_photo_url} target="_blank" rel="noreferrer">Ver foto de referencia</a>}
                    </div>
                  )}
                  <div className="item-sub">{CHANNEL[o.channel] || o.channel} · {dateTimeLabel(o.created_at)}{o.occasion ? ` · ${o.occasion}` : ''}</div>
                  <div className="item-actions">
                    {o.status === 'pendiente_sena' && <Action id={o.id} status="confirmado" label="Seña cobrada" cls="" back={self} />}
                    {o.status === 'confirmado' && <Action id={o.id} status="entregado" label="Entregado" cls="" back={self} />}
                    {o.status === 'vencido' && <Action id={o.id} status="confirmado" label="Confirmar igual" back={self} />}
                    {['confirmado', 'entregado'].includes(o.status) && due > 0 && (
                      <form action={markBalance}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="back" value={self} />
                        <button className="btn secondary small">Saldo cobrado</button>
                      </form>
                    )}
                    {['confirmado', 'entregado'].includes(o.status) && link && <a className="btn secondary small" href={link} target="_blank" rel="noreferrer">{due > 0 ? 'Cobrar por WhatsApp' : 'WhatsApp'}</a>}
                    {editable && <EditOrder o={o} bakery={bakery} T={T} open={sp.editar === o.id} back={self} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

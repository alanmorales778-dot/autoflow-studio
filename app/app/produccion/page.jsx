import { rubroOf } from '@/lib/rubros';
import { requireBakery } from '@/lib/session';
import { Flash, Locked } from '../ui';
import PrintButton from '../print-button';
import { todayAR, addDays, dateLabel, money } from '@/lib/format';
import { productionOrders, groupByDay, shoppingList } from '@/lib/production';
import { optionsSummary } from '@/lib/options';

export default async function Produccion({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const T = rubroOf(bakery);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.desde || '') ? sp.desde : todayAR();
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.hasta || '') ? sp.hasta : addDays(from, 6);

  const orders = await productionOrders(supabase, bakery.id, from, to);
  const days = groupByDay(orders);
  let list = null;
  if (access.costs) {
    const productIds = [...new Set(orders.map((o) => o.product_id).filter(Boolean))];
    const [{ data: items }, { data: ingredients }] = await Promise.all([
      productIds.length ? supabase.from('recipe_items').select('*').in('product_id', productIds) : { data: [] },
      supabase.from('ingredients').select('*').eq('bakery_id', bakery.id),
    ]);
    list = shoppingList(orders, items || [], ingredients || []);
  }
  const totalEst = list ? list.rows.reduce((s, r) => s + (r.estCost || 0), 0) : 0;

  return (
    <>
      <Flash sp={sp} />
      <div className="row between">
        <h1 style={{ margin: 0 }}>Producción y compras</h1>
        <PrintButton label="Imprimir hoja" />
      </div>
      <form method="get" className="row no-print" style={{ margin: '12px 0' }}>
        <label style={{ margin: 0 }}>Desde</label><input type="date" name="desde" defaultValue={from} style={{ maxWidth: 170 }} />
        <label style={{ margin: 0 }}>Hasta</label><input type="date" name="hasta" defaultValue={to} style={{ maxWidth: 170 }} />
        <button className="btn secondary small">Ver</button>
      </form>
      <p className="muted">Incluye pedidos confirmados y los que esperan seña. Del {dateLabel(from)} al {dateLabel(to)}: {orders.length} pedidos.</p>

      <div className="grid grid-2">
        <div>
          <h2>Qué hacer cada día</h2>
          {days.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>No hay pedidos en estas fechas.</p></div>}
          {days.map((d) => (
            <div key={d.date} className="card day">
              <h3>{dateLabel(d.date)}</h3>
              {d.items.map((it) => (
                <div key={it.product_name} className="order-line">
                  <strong>{it.qty} × {it.product_name}</strong>
                  {it.orders.map((o) => {
                    const details = [optionsSummary(o.options), o.dedication && `${T.note1.label}: «${o.dedication}»`, o.notes].filter(Boolean).join(' · ');
                    return (
                      <div key={o.id} style={{ fontSize: 13, marginTop: 4 }}>
                        {o.quantity} para {o.customer_name}{o.slot ? ` (${o.slot})` : ''}{details ? ` — ${details}` : ''}
                        {o.allergies && <> <span className="badge bad">⚠ {o.allergies}</span></>}
                        {o.reference_photo_url && <> · <a href={o.reference_photo_url} target="_blank" rel="noreferrer">foto</a></>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div>
          <h2>Lista de compras</h2>
          {!access.costs ? (
            <Locked title="Lista de compras automática">Con el módulo de Costos, AutoFlow suma lo que lleva cada pedido y te dice qué comprar.</Locked>
          ) : (
            <div className="card table-wrap">
              {list.rows.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Nada para calcular{orders.length ? `: cargá qué lleva cada uno de tus ${T.items.toLowerCase()}.` : '.'}</p>
              ) : (
                <table>
                  <thead><tr><th>{T.insumo}</th><th>Necesitás</th><th>Comprar</th><th>Costo aprox.</th></tr></thead>
                  <tbody>
                    {list.rows.map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}{r.supplier && <><br /><small>{r.supplier}</small></>}{!r.known && <><br /><small style={{ color: 'var(--bad)' }}>No está en tu lista de {T.insumos.toLowerCase()}</small></>}</td>
                        <td>{r.needed}</td>
                        <td>{r.packLabel || '—'}</td>
                        <td>{r.estCost !== null ? money(r.estCost) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {list.rows.length > 0 && <p style={{ marginTop: 12 }}><strong>Total estimado: {money(totalEst)}</strong> <small className="muted">(comprando presentaciones completas; no descuenta lo que ya tengas en la alacena)</small></p>}
              {list.missing.length > 0 && <div className="alert warn" style={{ marginTop: 12 }}>Sin {T.receta.toLowerCase()} cargada (no se cuentan): {list.missing.join(', ')}.</div>}
              {list.warnings.map((w) => <div key={w} className="alert warn">{w}</div>)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

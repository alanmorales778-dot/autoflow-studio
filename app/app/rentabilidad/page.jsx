import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { Locked } from '../ui';
import { todayAR, money, pct } from '@/lib/format';
import { liveCosts } from '@/lib/sheets';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const from = `${ym}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from, to: `${ym}-${String(last).padStart(2, '0')}`, label: `${MONTHS[m - 1]} ${y}` };
}

function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export default async function Rentabilidad({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const ym = /^\d{4}-\d{2}$/.test(sp.mes || '') ? sp.mes : todayAR().slice(0, 7);
  const { from, to, label } = monthRange(ym);

  if (!access.costs) {
    return (
      <>
        <h1>Rentabilidad</h1>
        <Locked title="Rentabilidad por producto">Con el módulo de Costos ves cuánto ganaste con cada producto en el mes.</Locked>
      </>
    );
  }

  const [{ data: orders }, live] = await Promise.all([
    supabase.from('orders').select('product_id,product_name,quantity,total,status,options_total').eq('bakery_id', bakery.id).gte('date', from).lte('date', to).in('status', ['confirmado', 'entregado']),
    liveCosts(supabase, bakery),
  ]);
  // Costo con los precios de hoy: el mismo número que muestran Productos y Costos e inflación.
  const costById = new Map([...live].map(([id, c]) => [id, c.cost]));
  const reasonById = new Map([...live].map(([id, c]) => [id, c.error]));
  const rows = new Map();
  for (const o of orders || []) {
    const k = o.product_id || o.product_name;
    if (!rows.has(k)) rows.set(k, { id: o.product_id, name: o.product_name, units: 0, revenue: 0, cost: 0, costKnown: true });
    const r = rows.get(k);
    r.units += o.quantity;
    r.revenue += Number(o.total);
    const c = o.product_id ? costById.get(o.product_id) : null;
    if (c === null || c === undefined) r.costKnown = false;
    else r.cost += Number(c) * o.quantity;
  }
  const list = [...rows.values()].map((r) => ({ ...r, profit: r.costKnown ? r.revenue - r.cost : null, margin: r.costKnown && r.revenue ? Math.round(((r.revenue - r.cost) / r.revenue) * 1000) / 10 : null }));
  list.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));
  const revenue = list.reduce((s, r) => s + r.revenue, 0);
  const known = list.filter((r) => r.costKnown);
  const profit = known.reduce((s, r) => s + r.profit, 0);
  const knownRevenue = known.reduce((s, r) => s + r.revenue, 0);
  const target = Number(bakery.margin_percent);

  return (
    <>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Rentabilidad · {label}</h1>
        <div className="row">
          <Link className="btn secondary small" href={`/app/rentabilidad?mes=${shiftMonth(ym, -1)}`}>← Mes anterior</Link>
          <Link className="btn secondary small" href={`/app/rentabilidad?mes=${shiftMonth(ym, 1)}`}>Mes siguiente →</Link>
        </div>
      </div>
      <p className="muted">Pedidos confirmados y entregados del mes. El costo usa el costo actual de cada receta (con indirectos); los adicionales de personalización se cuentan como ingreso.</p>
      <div className="grid grid-3">
        <div className="card"><small className="muted">Ventas</small><div className="price">{money(revenue)}</div></div>
        <div className="card"><small className="muted">Ganancia estimada</small><div className="price">{money(profit)}</div>{knownRevenue < revenue && <small className="muted">sin contar los que no tienen costo calculado</small>}</div>
        <div className="card"><small className="muted">Margen promedio (objetivo {pct(target, 0)})</small><div className="price">{knownRevenue ? pct((profit / knownRevenue) * 100) : '—'}</div></div>
      </div>
      <div className="card table-wrap">
        {list.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Sin ventas confirmadas en este mes.</p>
        ) : (
          <table>
            <thead><tr><th>Producto</th><th>Unidades</th><th>Ventas</th><th>Costo</th><th>Ganancia</th><th>Margen</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{r.units}</td>
                  <td>{money(r.revenue)}</td>
                  <td>{r.costKnown ? money(r.cost) : r.id ? <Link href={`/app/productos/${r.id}`}><small>{reasonById.get(r.id) === 'Sin receta cargada' || !reasonById.has(r.id) ? 'sin receta' : 'receta incompleta'}</small></Link> : <small className="muted">producto borrado</small>}</td>
                  <td>{r.profit !== null ? money(r.profit) : '—'}</td>
                  <td>{r.margin !== null ? <span className={`badge ${r.margin < target ? 'bad' : 'ok'}`}>{pct(r.margin)}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

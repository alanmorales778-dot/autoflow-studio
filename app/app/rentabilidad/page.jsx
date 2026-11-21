import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { rubroOf } from '@/lib/rubros';
import { Locked } from '../ui';
import NumerosTabs from '../numeros-tabs';
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

function short(n) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')} M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)} mil`;
  return `$${Math.round(n)}`;
}

function Delta({ d, prevName, label }) {
  if (d === null) return <small>Sin datos de {prevName} para comparar</small>;
  if (d === 0) return <small className="delta">= igual que {label}</small>;
  return <small className={`delta ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '↑' : '↓'} {Math.abs(d)} % {d > 0 ? 'más' : 'menos'} que {label}</small>;
}

export default async function Rentabilidad({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const T = rubroOf(bakery);
  const ym = /^\d{4}-\d{2}$/.test(sp.mes || '') ? sp.mes : todayAR().slice(0, 7);
  const { from, to, label } = monthRange(ym);

  if (!access.costs) {
    return (
      <>
        <h1>Costos y ganancias</h1>
        <NumerosTabs active="ganancia" />
        <Locked title="Rentabilidad por producto">Con el módulo de Costos ves cuánto ganaste con cada producto en el mes.</Locked>
      </>
    );
  }

  // Traemos 6 meses de una vez: el mes elegido, el anterior para comparar y 4 más para el gráfico.
  const first = shiftMonth(ym, -5);
  const [{ data: allOrders }, live] = await Promise.all([
    supabase.from('orders').select('date,product_id,product_name,quantity,total,status,options_total,material_cost').eq('bakery_id', bakery.id).gte('date', `${first}-01`).lte('date', to).in('status', ['confirmado', 'entregado']).limit(5000),
    liveCosts(supabase, bakery),
  ]);
  // Costo con los precios de hoy: el mismo número que muestran Productos y Costos e inflación.
  const costById = new Map([...live].map(([id, c]) => [id, c.cost]));
  const reasonById = new Map([...live].map(([id, c]) => [id, c.error]));
  const orders = (allOrders || []).filter((o) => o.date >= from);
  // Costo de un pedido: lo gastado en materiales si se cargó (oficios), si no la receta con precios de hoy.
  const costOf = (o) => {
    if (o.material_cost !== null && o.material_cost !== undefined) return Number(o.material_cost);
    const c = o.product_id ? costById.get(o.product_id) : null;
    return c === null || c === undefined ? null : Number(c) * o.quantity;
  };
  const rows = new Map();
  for (const o of orders) {
    const k = o.product_id || o.product_name;
    if (!rows.has(k)) rows.set(k, { id: o.product_id, name: o.product_name, units: 0, revenue: 0, cost: 0, costKnown: true });
    const r = rows.get(k);
    r.units += o.quantity;
    r.revenue += Number(o.total);
    const c = costOf(o);
    if (c === null) r.costKnown = false;
    else r.cost += c;
  }
  const list = [...rows.values()].map((r) => ({ ...r, profit: r.costKnown ? r.revenue - r.cost : null, margin: r.costKnown && r.revenue ? Math.round(((r.revenue - r.cost) / r.revenue) * 1000) / 10 : null }));
  list.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));
  const revenue = list.reduce((s, r) => s + r.revenue, 0);
  const known = list.filter((r) => r.costKnown);
  const profit = known.reduce((s, r) => s + r.profit, 0);
  const knownRevenue = known.reduce((s, r) => s + r.revenue, 0);
  const target = Number(bakery.margin_percent);

  // Serie de 6 meses (ventas y ganancia) para el gráfico y la comparación.
  const series = [];
  for (let i = 5; i >= 0; i--) {
    const m = shiftMonth(ym, -i);
    let rev = 0, prof = 0;
    for (const o of allOrders || []) {
      if (o.date.slice(0, 7) !== m) continue;
      rev += Number(o.total);
      const c = costOf(o);
      if (c !== null) prof += Number(o.total) - c;
    }
    series.push({ m, rev, prof });
  }
  const prev = series[4];
  const prevName = MONTHS[Number(prev.m.slice(5)) - 1];
  const delta = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
  // Mes en curso: comparamos «a esta altura» (hasta el mismo día) para no comparar medio mes contra uno entero.
  const today = todayAR();
  const isCurrent = ym === today.slice(0, 7);
  const day = today.slice(8);
  const upTo = (m, dd) => {
    let rev = 0, prof = 0;
    for (const o of allOrders || []) {
      if (o.date.slice(0, 7) !== m || o.date.slice(8) > dd) continue;
      rev += Number(o.total);
      const c = costOf(o);
      if (c !== null) prof += Number(o.total) - c;
    }
    return { rev, prof };
  };
  const curCmp = isCurrent ? upTo(ym, day) : { rev: revenue, prof: profit };
  const prevCmp = isCurrent ? upTo(prev.m, day) : prev;
  const dRev = delta(curCmp.rev, prevCmp.rev);
  const dProf = delta(curCmp.prof, prevCmp.prof);
  const cmpLabel = isCurrent ? `a esta altura de ${prevName}` : `en ${prevName}`;
  const best = [...list].filter((r) => r.profit !== null)[0];
  const maxRev = Math.max(1, ...series.map((x) => x.rev));
  const hasHistory = series.slice(0, 5).some((x) => x.rev > 0);

  return (
    <>
      <h1>Costos y ganancias</h1>
      <NumerosTabs active="ganancia" />
      <div className="row between" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, textTransform: 'capitalize' }}>{label}</h2>
        <div className="row" style={{ gap: 6 }}>
          <a className="btn secondary small" href={`/api/export/ganancias?mes=${ym}`} download>Descargar Excel</a>
          <Link className="btn secondary small" href={`/app/rentabilidad?mes=${shiftMonth(ym, -1)}`} aria-label="Mes anterior">←</Link>
          <Link className="btn secondary small" href={`/app/rentabilidad?mes=${shiftMonth(ym, 1)}`} aria-label="Mes siguiente">→</Link>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Confirmados y entregados del mes. El costo usa los precios de hoy de tus {T.insumos.toLowerCase()} (con indirectos); los adicionales de personalización se cuentan como ingreso.</p>
      <div className="grid grid-3">
        <div className="card kpi">
          <span className="l">Ventas</span>
          <span className="v">{money(revenue)}</span>
          <Delta d={dRev} prevName={prevName} label={cmpLabel} />
        </div>
        <div className="card kpi">
          <span className="l">Ganancia estimada</span>
          <span className="v">{money(profit)}</span>
          {knownRevenue < revenue ? <small>sin contar los que no tienen costo calculado</small> : <Delta d={dProf} prevName={prevName} label={cmpLabel} />}
        </div>
        <div className="card kpi">
          <span className="l">De cada $100 que vendés, te quedan</span>
          <span className="v">{knownRevenue ? money((profit / knownRevenue) * 100) : '—'}</span>
          <small>Tu objetivo: {money(target)}{knownRevenue && (profit / knownRevenue) * 100 < target ? ' · estás por debajo' : ''}</small>
        </div>
      </div>

      {hasHistory && (
        <div className="card chart-card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Últimos 6 meses</h3>
            <div className="chart-legend"><span><i className="lg-rev" />Ventas</span><span><i className="lg-prof" />Ganancia</span></div>
          </div>
          <div className="bars" role="img" aria-label={series.map((x) => `${MONTHS[Number(x.m.slice(5)) - 1]}: ventas ${money(x.rev)}, ganancia ${money(x.prof)}`).join('; ')}>
            {series.map((x) => (
              <Link key={x.m} href={`/app/rentabilidad?mes=${x.m}`} className={`bar-col ${x.m === ym ? 'on' : ''}`} title={`Ventas ${money(x.rev)} · Ganancia ${money(x.prof)}`}>
                <span className="bar-val num">{x.rev ? short(x.rev) : ''}</span>
                <span className="bar-track">
                  <span className="bar-rev" style={{ height: `${(x.rev / maxRev) * 100}%` }}>
                    <span className="bar-prof" style={{ height: `${x.rev ? Math.max(0, (x.prof / x.rev) * 100) : 0}%` }} />
                  </span>
                </span>
                <span className="bar-m">{MONTHS[Number(x.m.slice(5)) - 1].slice(0, 3)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {best && list.length > 1 && (
        <p className="insight">Lo que más te dejó en {label.split(' ')[0]}: <strong>{best.name}</strong> ({money(best.profit)} de ganancia con {best.units} {best.units === 1 ? 'venta' : 'ventas'}).</p>
      )}

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
                  <td>{r.costKnown ? money(r.cost) : r.id ? <Link href={`/app/productos/${r.id}`}><small>{reasonById.get(r.id) === 'Sin receta cargada' || !reasonById.has(r.id) ? `sin ${T.receta.toLowerCase()}` : 'ficha incompleta'}</small></Link> : <small className="muted">producto borrado</small>}</td>
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

import Link from 'next/link';
import { rubroOf } from '@/lib/rubros';
import { requireBakery } from '@/lib/session';
import { Flash } from '../ui';
import PrintButton from '../print-button';
import ShoppingList from './shopping-list';
import { todayAR, addDays, dateLabel } from '@/lib/format';
import { productionOrders, groupByDay, shoppingList } from '@/lib/production';
import { optionsSummary } from '@/lib/options';
import p from './produccion.module.css';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MISSING_TABLE = ['42P01', 'PGRST205'];

export default async function Produccion({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const T = rubroOf(bakery);
  const today = todayAR();
  const from = DATE.test(sp.desde || '') ? sp.desde : today;
  const to = DATE.test(sp.hasta || '') && sp.hasta >= from ? sp.hasta : addDays(from, 6);
  const tab = sp.ver === 'compras' ? 'compras' : 'cocinar';

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

  // Lista de compras editable. Si la tabla todavía no existe (migración sin aplicar), se guarda en el dispositivo.
  const { data: shoppingRows, error: shoppingError } = await supabase
    .from('shopping_items')
    .select('id, name, qty, unit, category, est_cost, note, source, bought, bought_at, created_at')
    .eq('bakery_id', bakery.id)
    .order('created_at');
  const shoppingMode = shoppingError && MISSING_TABLE.includes(shoppingError.code) ? 'local' : 'db';
  const shoppingItems = (shoppingRows || []).map((r) => ({
    ...r,
    qty: r.qty === null ? null : Number(r.qty),
    est_cost: r.est_cost === null ? null : Number(r.est_cost),
  }));
  const pendingCount = shoppingItems.filter((i) => !i.bought).length;

  const href = (params) => {
    const q = new URLSearchParams({ desde: from, hasta: to, ...(tab === 'compras' ? { ver: 'compras' } : {}), ...params });
    if (q.get('ver') === 'cocinar') q.delete('ver');
    return `/app/produccion?${q}`;
  };
  const ranges = [
    { label: 'Hoy', desde: today, hasta: today },
    { label: 'Mañana', desde: addDays(today, 1), hasta: addDays(today, 1) },
    { label: '3 días', desde: today, hasta: addDays(today, 2) },
    { label: 'Semana', desde: today, hasta: addDays(today, 6) },
  ];
  const activeRange = ranges.find((r) => r.desde === from && r.hasta === to);
  const rangeText = from === to ? dateLabel(from) : `del ${dateLabel(from)} al ${dateLabel(to)}`;
  const totalUnits = orders.reduce((t, o) => t + (Number(o.quantity) || 0), 0);

  return (
    <>
      <Flash sp={sp} />
      <div className={p.header}>
        <h1 className={p.title}>{T.prodTitle}</h1>
        <PrintButton label="Imprimir" />
      </div>

      <nav className={`${p.tabs} no-print`} aria-label="Secciones">
        <Link href={href({ ver: 'cocinar' })} className={`${p.tab} ${tab === 'cocinar' ? p.tabOn : ''}`} aria-current={tab === 'cocinar' ? 'page' : undefined}>
          {T.prepTab} <span className={p.badge}>{orders.length}</span>
        </Link>
        <Link href={href({ ver: 'compras' })} className={`${p.tab} ${tab === 'compras' ? p.tabOn : ''}`} aria-current={tab === 'compras' ? 'page' : undefined}>
          Qué comprar {pendingCount > 0 && <span className={p.badge}>{pendingCount}</span>}
        </Link>
      </nav>

      {tab === 'cocinar' ? (
        <>
          <div className={`${p.ranges} no-print`}>
            {ranges.map((r) => (
              <Link key={r.label} href={href({ desde: r.desde, hasta: r.hasta })} className={`${p.chip} ${activeRange === r ? p.chipOn : ''}`} aria-current={activeRange === r ? 'true' : undefined}>
                {r.label}
              </Link>
            ))}
            <details className={p.custom} open={!activeRange}>
              <summary className={`${p.chip} ${!activeRange ? p.chipOn : ''}`}>Otras fechas</summary>
              <form method="get" className={p.customForm}>
                <label><span>Desde</span><input type="date" name="desde" defaultValue={from} /></label>
                <label><span>Hasta</span><input type="date" name="hasta" defaultValue={to} /></label>
                <button className="btn secondary small">Ver</button>
              </form>
            </details>
          </div>

          <p className={p.summary}>
            {orders.length === 0
              ? <>No hay {T.orders.toLowerCase()} {rangeText}.</>
              : <><strong>{orders.length} {orders.length === 1 ? T.order : T.orders.toLowerCase()}</strong> ({totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}) {rangeText}.</>}
            <span className={p.hint}> Cuenta los confirmados y los que esperan seña.</span>
          </p>

          <div className={p.days}>
            {days.map((d) => (
              <section key={d.date} className={`card ${p.day} ${d.date === today ? p.dayToday : ''}`}>
                <h2 className={p.dayTitle}>
                  {dateLabel(d.date)}
                  {d.date === today && <span className={p.todayTag}>Hoy</span>}
                  {d.date === addDays(today, 1) && <span className={p.tomorrowTag}>Mañana</span>}
                </h2>
                <ul className={p.products}>
                  {d.items.map((it) => (
                    <li key={it.product_name} className={p.product}>
                      <div className={p.productHead}>
                        <span className={p.qty}>{it.qty}</span>
                        <strong>{it.product_name}</strong>
                      </div>
                      <ul className={p.orders}>
                        {it.orders.map((o) => {
                          const details = [optionsSummary(o.options), o.dedication && `${T.note1.label}: «${o.dedication}»`, o.notes].filter(Boolean).join(' · ');
                          return (
                            <li key={o.id}>
                              <span className={p.who}>{o.quantity} · {o.customer_name}{o.slot ? ` · ${o.slot}` : ''}</span>
                              {details && <span className={p.detail}>{details}</span>}
                              {o.allergies && <span className="badge bad">⚠ {o.allergies}</span>}
                              {o.reference_photo_url && <a className={p.photo} href={o.reference_photo_url} target="_blank" rel="noreferrer">Ver foto</a>}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {orders.length > 0 && (
            <Link href={href({ ver: 'compras' })} className={`${p.nextStep} no-print`}>
              ¿Qué tenés que comprar para esto? <span aria-hidden="true">→</span>
            </Link>
          )}
        </>
      ) : (
        <div className={p.shopping}>
          <ShoppingList
            initialItems={shoppingItems}
            mode={shoppingMode}
            loadError={shoppingError && shoppingMode === 'db' ? shoppingError.message : null}
            bakeryId={bakery.id}
            suggestions={list ? list.rows : null}
            suggestionsLocked={!access.costs}
            labels={{ insumo: T.insumo, insumos: T.insumos, shopCats: T.shopCats, shopEx: T.shopEx, orders: T.orders.toLowerCase() }}
          />
          {list && orders.length > 0 && list.rows.length === 0 && (
            <p className={`${p.note} no-print`}>Para que AutoFlow te sugiera qué comprar, cargá qué lleva cada uno de tus {T.items.toLowerCase()}.</p>
          )}
          {list && list.missing.length > 0 && <p className={`${p.note} no-print`}>Sin {T.receta.toLowerCase()} cargada (no se sugieren sus {T.insumos.toLowerCase()}): {list.missing.join(', ')}.</p>}
          {list && list.warnings.map((w) => <p key={w} className={`${p.note} no-print`}>{w}</p>)}
          {list && (
            <p className={`${p.note} no-print`}>
              Las sugerencias salen de los {T.orders.toLowerCase()} {rangeText}. <Link href={href({ ver: 'cocinar' })}>Cambiar fechas</Link>
            </p>
          )}
        </div>
      )}
    </>
  );
}

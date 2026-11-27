import { rubroOf } from '@/lib/rubros';
import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { syncNow, importFile, saveIngredient, deleteIngredient } from '../actions';
import ConfirmButton from '../confirm-button';
import { Flash, Locked, UploadCard } from '../ui';
import ImportPreview from '../import-preview';
import { money, dateTimeLabel, dateLabel, todayAR, addDays, normName } from '@/lib/format';
import { loadRecipeItems } from '@/lib/recipes';
import { productionOrders, ingredientDemand, prettyQty, amountCost } from '@/lib/production';
import { sheetUrl } from '@/lib/google';
import { has } from '@/lib/env';
import { RECIPE_UNITS } from '@/lib/costs';

export default async function Insumos({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const T = rubroOf(bakery);
  const { data: ingredients } = await supabase.from('ingredients').select('*').eq('bakery_id', bakery.id).order('sheet_row');
  const fromDrive = !!bakery.sheet_insumos_id;
  const drive = has.google();

  // Cuánto de cada insumo piden los pedidos que vienen (confirmados y esperando seña).
  const RANGES = [['1', 'Hoy'], ['3', '3 días'], ['7', 'Semana'], ['14', '2 semanas']];
  const dias = RANGES.some(([k]) => k === sp.dias) ? sp.dias : '7';
  const onlyNeeded = sp.usar === '1';
  const today = todayAR();
  const to = addDays(today, Number(dias) - 1);
  let demand = null;
  let orders = [];
  if (access.costs) {
    orders = await productionOrders(supabase, bakery.id, today, to);
    const productIds = [...new Set(orders.map((o) => o.product_id).filter(Boolean))];
    const items = productIds.length ? await loadRecipeItems(supabase, productIds) : [];
    demand = ingredientDemand(orders, items || [], ingredients || []);
  }
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const needOf = (i) => demand?.need.get(normName(i.name)) || null;
  const notListed = demand ? [...demand.need.values()].filter((n) => !n.ingredient) : [];
  const neededCount = demand ? demand.need.size : 0;
  const totalCost = demand ? [...demand.need.values()].reduce((t, n) => t + (amountCost(n, n.amount) || 0), 0) : 0;
  const rangeText = dias === '1' ? 'de hoy' : `de los próximos ${dias} días`;
  const qs = (params) => {
    const all = { dias, usar: onlyNeeded ? '1' : '', ...params };
    if (all.dias === '7') delete all.dias;
    if (!all.usar) delete all.usar;
    const q = new URLSearchParams(all).toString();
    return `/app/insumos${q ? `?${q}` : ''}#para-pedidos`;
  };
  const shown = (ingredients || []).filter((i) => !onlyNeeded || needOf(i));

  return (
    <>
      <Flash sp={sp} />
      <div className="row between">
        <h1 style={{ margin: 0 }}>{T.insumos}</h1>
        <div className="row">
          {!fromDrive && !sp.nuevo && <Link className="btn small" href="/app/insumos?nuevo=1#nuevo">+ Agregar {T.insumo.toLowerCase()}</Link>}
          {bakery.sheet_insumos_id && <a className="btn secondary small" href={sheetUrl(bakery.sheet_insumos_id)} target="_blank" rel="noreferrer">Abrir planilla de {T.insumos.toLowerCase()} ↗</a>}
          {bakery.sheet_insumos_id && <form action={syncNow}><input type="hidden" name="back" value="/app/insumos" /><button className="btn small">Actualizar desde Drive</button></form>}
        </div>
      </div>
      <p className="muted">
        {fromDrive ? <>Última actualización: {dateTimeLabel(bakery.last_sync_at)}. HakkiraApp revisa tu planilla de Drive cada 10 minutos.</> : <>Cuando cambia un precio, cambialo acá y tocá «Guardar»: el costo de tus {T.items.toLowerCase()} se recalcula al instante. Si son muchos, subí un archivo{drive ? <> o <Link href="/app/configuracion#drive">conectá Google Drive</Link></> : ''}.</>}
      </p>
      {!access.costs && <Locked title="Módulo de Costos">Con el módulo de Costos, cada cambio de precio acá recalcula el costo de todos tus {T.items.toLowerCase()}.</Locked>}
      {bakery.last_sync_error && <div className="alert bad">{bakery.last_sync_error}</div>}

      <ImportPreview bakery={bakery} kind="insumos" id={sp.vista} />

      {demand && !sp.nuevo && !sp.vista && (
        <div className="card" id="para-pedidos">
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <h2 style={{ margin: 0 }}>Lo que necesitás para tus {T.orders.toLowerCase()}</h2>
            <div className="filters" role="navigation" aria-label="Período" style={{ margin: 0 }}>
              {RANGES.map(([k, label]) => (
                <Link key={k} href={qs({ dias: k })} className={`chip ${dias === k ? 'on' : ''}`} aria-current={dias === k ? 'true' : undefined}>{label}</Link>
              ))}
            </div>
          </div>
          {orders.length === 0 ? (
            <p className="muted" style={{ margin: '10px 0 0' }}>No hay {T.orders.toLowerCase()} {rangeText}. Cuando entre uno, acá vas a ver cuánto de cada {T.insumo.toLowerCase()} lleva.</p>
          ) : neededCount === 0 ? (
            <p className="muted" style={{ margin: '10px 0 0' }}>Tenés {orders.length} {orders.length === 1 ? T.order : T.orders.toLowerCase()} {rangeText}, pero sus {T.items.toLowerCase()} no tienen {T.receta.toLowerCase()} cargada. <Link href="/app/recetas">Cargar {T.receta.toLowerCase()}</Link></p>
          ) : (
            <>
              <p style={{ margin: '10px 0 0' }}>
                {orders.length === 1 ? <>Tu <strong>{T.order}</strong> {rangeText} usa</> : <>Tus <strong>{orders.length} {T.orders.toLowerCase()}</strong> {rangeText} usan</>} <strong>{neededCount} {neededCount === 1 ? T.insumo.toLowerCase() : T.insumos.toLowerCase()}</strong>{totalCost > 0 ? <> por unos <strong>{money(totalCost)}</strong></> : ''}. Lo ves debajo de cada uno.
              </p>
              <div className="row" style={{ marginTop: 10 }}>
                <Link className="btn small" href={`/app/produccion?${new URLSearchParams({ desde: today, hasta: to, ver: 'compras' })}`}>Armar la lista de compras →</Link>
                {onlyNeeded
                  ? <Link className="btn secondary small" href={qs({ usar: '' })}>Ver todos</Link>
                  : <Link className="btn secondary small" href={qs({ usar: '1' })}>Ver solo los que se usan</Link>}
              </div>
            </>
          )}
          {demand.missing.length > 0 && orders.length > 0 && neededCount > 0 && (
            <p className="muted" style={{ fontSize: 13, margin: '10px 0 0' }}>Sin {T.receta.toLowerCase()} (no se cuentan): {demand.missing.join(', ')}. <Link href="/app/recetas">Cargar</Link></p>
          )}
          {notListed.length > 0 && (
            <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
              Los usan tus {T.orders.toLowerCase()} pero no están en esta lista: {notListed.map((n) => `${n.name} (${prettyQty(n.amount, n.base)})`).join(', ')}. <Link href="/app/insumos?nuevo=1#nuevo">Agregar</Link>
            </p>
          )}
          {demand.warnings.map((w) => <p key={w} className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>⚠ {w}</p>)}
        </div>
      )}

      {!fromDrive && (!ingredients || ingredients.length === 0 || !!sp.nuevo) && (
        <details className="card fold" id="nuevo" open>
          <summary><h2>Agregar {T.insumo.toLowerCase()}</h2></summary>
          <form action={saveIngredient} style={{ marginTop: 12 }}>
            <IngredientFields T={T} />
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Ejemplo: un paquete de 1 kg de harina a $ 1.400 → cantidad 1000, unidad g, precio 1400.</p>
            <button className="btn">Agregar</button>
          </form>
        </details>
      )}

      <div className="card">
        {!ingredients || ingredients.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Sin {T.insumos.toLowerCase()} todavía.</p>
        ) : shown.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Ningún {T.insumo.toLowerCase()} de esta lista se usa en los {T.orders.toLowerCase()} {rangeText}.</p>
        ) : (
          <ul className="items">
            {shown.map((i) => (
              <li key={i.id} className="item">
                <div className="item-head">
                  <div>
                    <div className="item-title">{i.name}</div>
                    <div className="item-sub">
                      {i.purchase_unit ? `${i.purchase_unit} · ` : ''}{i.qty ?? '—'} {i.unit}{i.supplier ? ` · ${i.supplier}` : ''}{i.updated_label ? ` · actualizado ${i.updated_label}` : ''}
                    </div>
                  </div>
                  {i.error ? <span className="badge bad">{i.error}</span> : fromDrive ? <span className="item-title money-col">{money(i.price)}</span> : null}
                </div>
                <Need n={needOf(i)} i={i} T={T} rangeText={rangeText} orderById={orderById} />
                {!fromDrive && (
                  <div className="item-actions">
                    <form action={saveIngredient} className="row" style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                      <input type="hidden" name="id" value={i.id} />
                      <div style={{ position: 'relative', flex: '0 0 auto' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>$</span>
                        <input name="price" inputMode="decimal" defaultValue={i.price ?? ''} aria-label={`Precio de ${i.name}`} style={{ width: 120, paddingLeft: 24 }} />
                      </div>
                      <button className="btn secondary small">Guardar</button>
                    </form>
                    <details className="fold">
                      <summary className="btn secondary small">Editar</summary>
                      <div className="fold-body">
                        <form action={saveIngredient}>
                          <input type="hidden" name="id" value={i.id} />
                          <IngredientFields T={T} i={i} />
                          <button className="btn small">Guardar</button>
                        </form>
                        <form action={deleteIngredient} style={{ marginTop: 10 }}>
                          <input type="hidden" name="id" value={i.id} />
                          <ConfirmButton className="btn danger small" message={`¿Borrar ${i.name}? Si alguna receta lo usa, ese producto queda sin costo hasta que lo reemplaces.`}>Borrar {T.insumo.toLowerCase()}</ConfirmButton>
                        </form>
                      </div>
                    </details>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!sp.vista && (
        <details className="fold" style={{ marginTop: 8 }}>
          <summary className="btn secondary small">Cargar o descargar muchos con un Excel</summary>
          <div style={{ marginTop: 12 }}><UploadCard kind="insumos" action={importFile} driveConnected={!!bakery.sheet_insumos_id} /></div>
        </details>
      )}
    </>
  );
}

// Debajo de cada insumo: cuánto piden los pedidos del período y para cuáles.
function Need({ n, i, T, rangeText, orderById }) {
  if (!n) return null;
  const packs = n.usable ? Math.ceil(n.amount / n.perPack - 1e-9) : null;
  const rows = [...n.byOrder.entries()]
    .map(([id, amount]) => ({ o: orderById.get(id), amount }))
    .filter((r) => r.o)
    .sort((a, b) => a.o.date.localeCompare(b.o.date) || String(a.o.slot || '').localeCompare(String(b.o.slot || '')));
  return (
    <div className="need-box">
      <div>
        Para tus {T.orders.toLowerCase()} {rangeText}: <strong>{prettyQty(n.amount, n.base)}</strong>
        {packs ? <> · {packs} × {i.purchase_unit || `${i.qty} ${i.unit}`}</> : ''}
        {n.usable && <span className="muted"> · {money(amountCost(n, n.amount))}</span>}
      </div>
      <details className="fold">
        <summary className="need-link">Ver {rows.length === 1 ? `el ${T.order}` : `los ${rows.length} ${T.orders.toLowerCase()}`}</summary>
        <ul className="need-list">
          {rows.map(({ o, amount }) => (
            <li key={o.id}>
              <Link href={`/app/pedidos?editar=${o.id}#p-${o.id}`}>{dateLabel(o.date)}{o.slot ? ` · ${o.slot}` : ''} · {o.customer_name} · {o.quantity > 1 ? `${o.quantity} × ` : ''}{o.product_name}</Link>
              <strong>{prettyQty(amount, n.base)}</strong>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function IngredientFields({ T, i = {} }) {
  return (
    <div className="grid grid-3" style={{ gap: 10 }}>
      <div className="field"><label>Nombre</label><input name="name" required defaultValue={i.name || ''} placeholder="Ej: Harina 0000" /></div>
      <div className="field"><label>Presentación (opcional)</label><input name="purchase_unit" defaultValue={i.purchase_unit || ''} placeholder="Ej: Paquete 1 kg" /></div>
      <div className="field"><label>Proveedor (opcional)</label><input name="supplier" defaultValue={i.supplier || ''} /></div>
      <div className="field"><label>Merma (%)</label><input name="waste_percent" inputMode="decimal" defaultValue={Number(i.waste_percent) || ''} placeholder="0" /><div className="hint">Lo que se pierde al usarlo (cáscaras, recortes, lo que queda en el bowl). Encarece el costo y suma a la compra.</div></div>
      <div className="field"><label>Trae (cantidad)</label><input name="qty" required inputMode="decimal" defaultValue={i.qty ?? ''} placeholder="Ej: 1000" /></div>
      <div className="field"><label>Unidad</label><select name="unit" defaultValue={i.unit || 'g'}>{RECIPE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
      <div className="field"><label>Precio de la presentación</label><input name="price" required inputMode="decimal" defaultValue={i.price ?? ''} placeholder="Ej: 1400" /></div>
    </div>
  );
}

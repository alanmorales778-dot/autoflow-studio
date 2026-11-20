import { rubroOf } from '@/lib/rubros';
import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { applySuggestedPrice, syncNow, importFile, createProduct } from '../actions';
import { Flash, Locked, UploadCard } from '../ui';
import ImportPreview from '../import-preview';
import { money, pct } from '@/lib/format';
import { currentMargin, suggestedPrice } from '@/lib/costs';
import { reservedByProduct } from '@/lib/orders';
import { createAdmin } from '@/lib/supabase';
import { sheetUrl } from '@/lib/google';
import { liveCosts } from '@/lib/sheets';

export default async function Productos({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const T = rubroOf(bakery);
  const { data: rawProducts } = await supabase.from('products').select('*').eq('bakery_id', bakery.id).not('sheet_row', 'is', null).order('sheet_row');
  const [reserved, live] = await Promise.all([reservedByProduct(createAdmin(), bakery.id), liveCosts(supabase, bakery)]);
  // Costo calculado con los precios de hoy (igual que en Costos e inflación y Rentabilidad).
  const products = (rawProducts || []).map((p) => {
    const c = live.get(p.id);
    return c ? { ...p, cost: c.cost, min_price: c.min, cost_error: c.error } : p;
  });
  const fromDrive = !!bakery.sheet_productos_id;

  return (
    <>
      <Flash sp={sp} />
      <div className="row between">
        <h1 style={{ margin: 0 }}>{T.items}</h1>
        <div className="row">
          {bakery.sheet_productos_id && <a className="btn secondary small" href={sheetUrl(bakery.sheet_productos_id)} target="_blank" rel="noreferrer">Abrir planilla de productos ↗</a>}
          {bakery.sheet_productos_id && <form action={syncNow}><input type="hidden" name="back" value="/app/productos" /><button className="btn small">Actualizar desde Drive</button></form>}
        </div>
      </div>
      <p className="muted">{fromDrive ? 'Tus productos, precios y stock vienen de tu planilla de Google Drive.' : <>Agregá {T.items.toLowerCase()} de a uno <a href="#nuevo">acá abajo</a> o todos juntos subiendo un Excel/CSV.</>} Margen objetivo: {pct(bakery.margin_percent, 0)} · indirectos {pct(bakery.overhead_percent, 0)} (se cambian en Configuración).</p>
      {!access.costs && <Locked title="Costos y precio mínimo">Activá el módulo de Costos para ver cuánto te cuesta cada {T.item} y si estás ganando tu margen.</Locked>}

      <div className="card table-wrap">
        {!products || products.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Todavía no cargaste {T.items.toLowerCase()}. Agregá el primero abajo o subí tu lista en un Excel/CSV.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Producto</th><th>Precio</th><th>Stock</th>
                {access.costs && <><th>Costo</th><th>Precio mínimo</th><th>Margen</th></>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const res = reserved.get(p.id) || 0;
                const margin = currentMargin(p.price, p.cost);
                const below = p.min_price && Number(p.price) < Number(p.min_price);
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong><br /><small>{p.sku} · {p.category}{p.visible ? '' : ' · oculto'}</small></td>
                    <td>{money(p.price)}</td>
                    <td>{p.stock_loaded === null ? <small>A pedido</small> : <>{Math.max(0, p.stock_loaded - res)} disp.<br /><small>{p.stock_loaded} cargado · {res} reservado</small></>}</td>
                    {access.costs && (
                      <>
                        <td>{p.cost !== null ? money(p.cost) : <small className="muted">—</small>}{p.cost_error && <><br /><small style={{ color: p.cost_error === 'Sin receta cargada' ? 'var(--muted)' : 'var(--bad)' }}>{p.cost_error}</small></>}</td>
                        <td>{p.min_price ? money(p.min_price) : '—'}</td>
                        <td>{margin === null ? '—' : <span className={`badge ${below ? 'bad' : 'ok'}`}>{pct(margin)}</span>}</td>
                      </>
                    )}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link className="btn secondary small" href={`/app/productos/${p.id}`}>{access.costs ? `${T.key === 'cocina' ? 'Receta' : T.insumos} y opciones` : 'Opciones'}</Link>{' '}
                      {access.costs && below && (
                        <form action={applySuggestedPrice} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="btn small">Usar {money(suggestedPrice(p.min_price))}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {!fromDrive && (
        <div className="card" id="nuevo">
          <h2>Agregar {T.item}</h2>
          <form action={createProduct}>
            <div className="grid grid-3" style={{ gap: 8 }}>
              <div className="field"><label>Nombre</label><input name="name" required placeholder="Ej: Torta de chocolate 20 cm" /></div>
              <div className="field"><label>Precio</label><input name="price" required inputMode="decimal" placeholder="Ej: 38000" /></div>
              <div className="field"><label>Categoría</label><input name="category" placeholder="Ej: Tortas" list="categorias" /></div>
            </div>
            <datalist id="categorias">{[...new Set(products.map((p) => p.category).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist>
            <div className="grid grid-2" style={{ gap: 8 }}>
              <div className="field"><label>Descripción (opcional)</label><input name="description" placeholder="Qué incluye, porciones, tamaño" /></div>
              <div className="field"><label>Stock (vacío = a pedido)</label><input name="stock" inputMode="numeric" /></div>
            </div>
            <button className="btn">Agregar</button>
          </form>
        </div>
      )}
      <ImportPreview bakery={bakery} kind="productos" id={sp.vista} />
      {!sp.vista && <UploadCard kind="productos" action={importFile} driveConnected={!!bakery.sheet_productos_id} />}
    </>
  );
}

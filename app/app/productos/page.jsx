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
      <p className="muted">{fromDrive ? 'Tus productos, precios y stock vienen de tu planilla de Google Drive.' : <>Tocá «Editar» en cada uno para cambiar precio, foto, receta u opciones.</>} Margen objetivo: {pct(bakery.margin_percent, 0)} · indirectos {pct(bakery.overhead_percent, 0)} (<Link href="/app/configuracion">cambiar</Link>).</p>
      {!access.costs && <Locked title="Costos y precio mínimo">Activá el módulo de Costos para ver cuánto te cuesta cada {T.item} y si estás ganando tu margen.</Locked>}

      <div className="card">
        {!products || products.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Todavía no cargaste {T.items.toLowerCase()}. Agregá el primero abajo.</p>
        ) : (
          <ul className="items">
            {products.map((p) => {
              const res = reserved.get(p.id) || 0;
              const margin = currentMargin(p.price, p.cost);
              const below = p.min_price && Number(p.price) < Number(p.min_price);
              return (
                <li key={p.id} className="item">
                  <div className="item-head">
                    <div>
                      <div className="item-title">{p.name}</div>
                      <div className="item-sub">{[p.category, !p.visible && 'oculto en el catálogo', p.stock_loaded === null ? 'a pedido' : `${Math.max(0, p.stock_loaded - res)} disponibles (${res} reservados)`].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="item-title money-col">{money(p.price)}</div>
                  </div>
                  {access.costs && (
                    <div className="item-meta">
                      <span>Costo {p.cost !== null && p.cost !== undefined ? money(p.cost) : '—'}</span>
                      {p.min_price ? <span>Mínimo {money(p.min_price)}</span> : null}
                      {margin !== null && <span className={`badge ${below ? 'bad' : 'ok'}`}>Margen {pct(margin)}</span>}
                      {p.cost_error && <span style={{ color: p.cost_error === 'Sin receta cargada' ? 'var(--muted)' : 'var(--bad)' }}>{p.cost_error}</span>}
                    </div>
                  )}
                  <div className="item-actions">
                    <Link className="btn secondary small" href={`/app/productos/${p.id}`}>Editar</Link>
                    {access.costs && below && (
                      <form action={applySuggestedPrice}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn small">Subir a {money(suggestedPrice(p.min_price))}</button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {!fromDrive && (
        <details className="card fold" id="nuevo" open={!products || products.length === 0}>
          <summary><h2>Agregar {T.item}</h2></summary>
          <form action={createProduct} style={{ marginTop: 12 }}>
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
        </details>
      )}
      <ImportPreview bakery={bakery} kind="productos" id={sp.vista} />
      {!sp.vista && (
        <details className="fold" style={{ marginTop: 8 }}>
          <summary className="btn secondary small">Cargar o descargar muchos con un Excel</summary>
          <div style={{ marginTop: 12 }}><UploadCard kind="productos" action={importFile} driveConnected={!!bakery.sheet_productos_id} /></div>
        </details>
      )}
    </>
  );
}

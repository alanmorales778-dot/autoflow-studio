import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { applySuggestedPrice, syncNow, importFile } from '../actions';
import { Flash, Locked, UploadCard } from '../ui';
import ImportPreview from '../import-preview';
import { money } from '@/lib/format';
import { currentMargin, suggestedPrice } from '@/lib/costs';
import { reservedByProduct } from '@/lib/orders';
import { createAdmin } from '@/lib/supabase';
import { sheetUrl } from '@/lib/google';

export default async function Productos({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const { data: products } = await supabase.from('products').select('*').eq('bakery_id', bakery.id).not('sheet_row', 'is', null).order('sheet_row');
  const reserved = await reservedByProduct(createAdmin(), bakery.id);

  return (
    <>
      <Flash sp={sp} />
      <div className="row between">
        <h1 style={{ margin: 0 }}>Productos</h1>
        <div className="row">
          {bakery.sheet_productos_id && <a className="btn secondary small" href={sheetUrl(bakery.sheet_productos_id)} target="_blank" rel="noreferrer">Abrir planilla de productos ↗</a>}
          {bakery.sheet_productos_id && <form action={syncNow}><input type="hidden" name="back" value="/app/productos" /><button className="btn small">Actualizar desde Drive</button></form>}
        </div>
      </div>
      <p className="muted">Los productos, precios y stock se cargan con un archivo Excel/CSV o desde tu planilla de Google Drive. Margen objetivo: {Number(bakery.margin_percent)}% · indirectos {Number(bakery.overhead_percent)}% (se cambian en Configuración).</p>
      {!access.costs && <Locked title="Costos y precio mínimo">Activá el módulo de Costos para ver cuánto te cuesta cada producto y si estás ganando tu margen.</Locked>}

      <div className="card table-wrap">
        {!products || products.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Todavía no hay productos. Descargá la plantilla, completala y subila abajo, o conectá Google Drive en Configuración.</p>
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
                        <td>{p.cost !== null ? money(p.cost) : <small className="muted">—</small>}{p.cost_error && <><br /><small style={{ color: 'var(--bad)' }}>{p.cost_error}</small></>}</td>
                        <td>{p.min_price ? money(p.min_price) : '—'}</td>
                        <td>{margin === null ? '—' : <span className={`badge ${below ? 'bad' : 'ok'}`}>{margin}%</span>}</td>
                      </>
                    )}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link className="btn secondary small" href={`/app/productos/${p.id}`}>{access.costs ? 'Receta y opciones' : 'Opciones'}</Link>{' '}
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
      <ImportPreview bakery={bakery} kind="productos" id={sp.vista} />
      {!sp.vista && <UploadCard kind="productos" action={importFile} driveConnected={!!bakery.sheet_productos_id} />}
    </>
  );
}

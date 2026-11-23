import { rubroOf } from '@/lib/rubros';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireBakery } from '@/lib/session';
import { addRecipeItem, deleteRecipeItem, applySuggestedPrice, saveProductSettings, uploadProductPhoto, removeProductPhoto, updateProduct } from '../../actions';
import { liveCosts } from '@/lib/sheets';
import { formatOptionsText } from '@/lib/options';
import { Flash, Locked } from '../../ui';
import PhotoPicker from '../../photo-picker';
import MediaManager from './media-manager';
import TryonManager from './tryon-manager';
import { money, normName, pct } from '@/lib/format';
import { RECIPE_UNITS, normUnit, currentMargin, suggestedPrice } from '@/lib/costs';

export default async function Receta({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const T = rubroOf(bakery);
  const { data: stored } = await supabase.from('products').select('*').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
  if (!stored) notFound();
  // Costo con los precios de hoy, igual que en el resto de las pantallas.
  const live = (await liveCosts(supabase, bakery, [id])).get(id);
  const product = live ? { ...stored, cost: live.cost, min_price: live.min, cost_error: live.error } : stored;
  const fromDrive = !!bakery.sheet_productos_id;
  const [{ data: items }, { data: ingredients }] = await Promise.all([
    supabase.from('recipe_items').select('*').eq('product_id', id).order('ingredient_name'),
    supabase.from('ingredients').select('*').eq('bakery_id', bakery.id).order('name'),
  ]);
  const byName = new Map((ingredients || []).map((i) => [normName(i.name), i]));
  const lineCost = (it) => {
    const ing = byName.get(normName(it.ingredient_name));
    const iu = ing && normUnit(ing.unit);
    const ru = normUnit(it.unit);
    if (!ing || ing.error || !iu || !ru || iu.base !== ru.base) return null;
    return (Number(ing.price) / (Number(ing.qty) * iu.factor)) * Number(it.qty) * ru.factor;
  };
  const margin = currentMargin(product.price, product.cost);
  const below = product.min_price && Number(product.price) < Number(product.min_price);

  return (
    <>
      <Link href="/app/productos">← {T.items}</Link>
      <h1 style={{ marginTop: 12 }}>{product.name}</h1>
      <Flash sp={sp} />
      {!access.costs && <Locked title="Módulo de Costos">Cargá qué lleva cada {T.item} y calculá su costo real.</Locked>}

      <div className="grid grid-3">
        <div className="card"><small className="muted">Precio de venta</small><div className="price">{money(product.price)}</div></div>
        <div className="card"><small className="muted">Costo (con {pct(bakery.overhead_percent, 0)} de indirectos)</small><div className="price">{product.cost !== null ? money(product.cost) : '—'}</div></div>
        <div className="card">
          <small className="muted">Precio mínimo para {pct(bakery.margin_percent, 0)} de margen</small>
          <div className="price">{product.min_price ? money(product.min_price) : '—'}</div>
          {margin !== null && <span className={`badge ${below ? 'bad' : 'ok'}`}>Margen actual {pct(margin)}</span>}
          {below && (
            <form action={applySuggestedPrice} style={{ marginTop: 8 }}>
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="back" value={`/app/productos/${product.id}`} />
              <button className="btn small">Usar {money(suggestedPrice(product.min_price))}</button>
            </form>
          )}
        </div>
      </div>
      {product.cost_error && access.costs && <div className="alert warn">{product.cost_error === 'Sin receta cargada' ? <>Cargá abajo qué lleva para calcular el costo.</> : <>Para completar el cálculo: {product.cost_error}. <Link href="/app/insumos#nuevo">Agregar {T.insumo.toLowerCase()}</Link></>}</div>}

      {!fromDrive && (
        <div className="card" id="datos">
          <h2>Datos</h2>
          <form action={updateProduct}>
            <input type="hidden" name="id" value={product.id} />
            <div className="grid grid-3" style={{ gap: 8 }}>
              <div className="field"><label>Nombre</label><input name="name" required defaultValue={product.name} /></div>
              <div className="field"><label>Precio</label><input name="price" required inputMode="decimal" defaultValue={Number(product.price)} /></div>
              <div className="field"><label>Categoría</label><input name="category" defaultValue={product.category || ''} /></div>
            </div>
            <div className="grid grid-2" style={{ gap: 8 }}>
              <div className="field"><label>Descripción</label><input name="description" defaultValue={product.description || ''} /></div>
              <div className="field"><label>Stock (vacío = a pedido)</label><input name="stock" inputMode="numeric" defaultValue={product.stock_loaded ?? ''} /></div>
            </div>
            <label className="inline-label" style={{ marginBottom: 12 }}><input type="checkbox" name="visible" defaultChecked={product.visible} /> Se muestra en el catálogo</label>
            <div><button className="btn">Guardar cambios</button></div>
          </form>
        </div>
      )}

      <div className="card" id="foto">
        <h2>Fotos y video</h2>
        <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
          <div style={{ flex: '0 1 320px', minWidth: 220 }}>
            <PhotoPicker action={uploadProductPhoto} hidden={{ id: product.id }} current={product.photo_url} placeholder={product.name.charAt(0)} label="Elegir foto" changeLabel="Cambiar portada" maxSide={2400} />
          </div>
          <div style={{ flex: '1 1 240px' }}>
            <p className="muted" style={{ marginTop: 0 }}><strong style={{ color: 'var(--ink)' }}>Portada:</strong> es la que se ve primero en tu link. Se ve mejor apaisada.</p>
            {product.photo_url ? (
              <form action={removeProductPhoto}>
                <input type="hidden" name="id" value={product.id} />
                <button className="btn danger small">Quitar foto</button>
              </form>
            ) : <p className="muted" style={{ fontSize: 13 }}>Sin foto, el catálogo muestra la inicial del nombre.</p>}
          </div>
        </div>
        <div className="media-sep" />
        <MediaManager productId={product.id} items={Array.isArray(product.gallery) ? product.gallery : []} cover={product.photo_url} title={T.media.title} hint={T.media.hint} />
        {T.key === 'optica' && (
          <>
            <div className="media-sep" />
            <TryonManager productId={product.id} current={product.tryon_url} />
          </>
        )}
      </div>

      <div className="card table-wrap">
        <h2>{T.key === 'cocina' ? 'Ingredientes' : T.insumos} por unidad de «{product.name}»</h2>
        {!items || items.length === 0 ? (
          <p className="muted">Todavía no cargaste qué lleva.</p>
        ) : (
          <table>
            <thead><tr><th>{T.insumo}</th><th>Cantidad</th><th>Costo</th><th></th></tr></thead>
            <tbody>
              {items.map((it) => {
                const c = lineCost(it);
                return (
                  <tr key={it.id}>
                    <td>{it.ingredient_name}{!byName.get(normName(it.ingredient_name)) && <><br /><small style={{ color: 'var(--bad)' }}>No está en tu lista de {T.insumos.toLowerCase()}. <Link href="/app/insumos#nuevo">Agregalo</Link></small></>}</td>
                    <td>{Number(it.qty)} {it.unit}</td>
                    <td>{c === null ? '—' : money(c)}</td>
                    <td>
                      <form action={deleteRecipeItem}>
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="product_id" value={product.id} />
                        <button className="btn danger small">Quitar</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {access.costs && (
          <form action={addRecipeItem} style={{ marginTop: 16 }}>
            <input type="hidden" name="product_id" value={product.id} />
            <div className="grid grid-3">
              <div className="field">
                <label>{T.insumo}</label>
                <input name="ingredient_name" list="insumos" required placeholder="Elegí o escribí" />
                <datalist id="insumos">{(ingredients || []).map((i) => <option key={i.id} value={i.name} />)}</datalist>
              </div>
              <div className="field"><label>Cantidad</label><input name="qty" inputMode="decimal" required placeholder="Ej: 250" /></div>
              <div className="field">
                <label>Unidad</label>
                <select name="unit">{RECIPE_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
              </div>
            </div>
            <button className="btn">Agregar ingrediente</button>
          </form>
        )}
      </div>
      <div className="card">
        <h2>Duración, opciones y suscripción</h2>
        <p className="muted">
          Opciones que tu cliente elige al pedir, una por línea. Formato: <code>Grupo: opción | opción +precio extra</code>. Con <code>*</code> después del nombre es obligatoria.
        </p>
        <pre style={{ background: '#f6f1ec', padding: 10, borderRadius: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>{`Tamaño*: 15 cm (10 porciones) | 20 cm (20 porciones) +6000 | 25 cm (30 porciones) +12000
Relleno*: Dulce de leche | Mousse de chocolate +2000 | Frutos rojos +3500
Cobertura: Ganache | Merengue italiano +1500 | Fondant +5000`}</pre>
        <form action={saveProductSettings}>
          <input type="hidden" name="id" value={product.id} />
          <div className="field"><textarea name="options" rows={5} defaultValue={formatOptionsText(product.options)} /></div>
          <div className="field" style={{ maxWidth: 320 }}><label>Duración (minutos, opcional)</label><input name="duration_minutes" type="number" min="5" max="1440" step="5" defaultValue={product.duration_minutes ?? ''} placeholder="Ej: 90" />{bakery.slot_capacity ? <div className="hint">Un turno de este {T.item} ocupa los horarios que entran en ese tiempo.</div> : <div className="hint">Se usa cuando ponés «Clientes a la vez por horario» en Ajustes.</div>}</div>
          <label className="inline-label" style={{ marginBottom: 12 }}><input type="checkbox" name="allow_subscription" defaultChecked={product.allow_subscription} /> Se puede pedir por suscripción (semanal o quincenal)</label>
          <button className="btn">Guardar</button>
        </form>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>El catálogo además pide {T.note1.label.toLowerCase()}, {T.note2.label.toLowerCase()} y foto de referencia (opcionales) en todos los productos.</p>
      </div>

      <p className="muted" style={{ fontSize: 13 }}>Los precios salen de tu lista de {T.insumos.toLowerCase()}. Cuando cambiás un precio en <Link href="/app/insumos">{T.insumos}</Link>, este costo se recalcula al instante.</p>
    </>
  );
}

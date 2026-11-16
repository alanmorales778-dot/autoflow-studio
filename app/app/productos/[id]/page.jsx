import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireBakery } from '@/lib/session';
import { addRecipeItem, deleteRecipeItem, applySuggestedPrice } from '../../actions';
import { Flash, Locked } from '../../ui';
import { money, normName } from '@/lib/format';
import { RECIPE_UNITS, normUnit, currentMargin, suggestedPrice } from '@/lib/costs';

export default async function Receta({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const { data: product } = await supabase.from('products').select('*').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
  if (!product) notFound();
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
      <Link href="/app/productos">← Productos</Link>
      <h1 style={{ marginTop: 12 }}>Receta: {product.name}</h1>
      <Flash sp={sp} />
      {!access.costs && <Locked title="Módulo de Costos">Cargá recetas y calculá el costo real de cada producto.</Locked>}

      <div className="grid grid-3">
        <div className="card"><small className="muted">Precio de venta</small><div className="price">{money(product.price)}</div></div>
        <div className="card"><small className="muted">Costo (con {Number(bakery.overhead_percent)}% indirectos)</small><div className="price">{product.cost !== null ? money(product.cost) : '—'}</div></div>
        <div className="card">
          <small className="muted">Precio mínimo para {Number(bakery.margin_percent)}% de margen</small>
          <div className="price">{product.min_price ? money(product.min_price) : '—'}</div>
          {margin !== null && <span className={`badge ${below ? 'bad' : 'ok'}`}>Margen actual {margin}%</span>}
          {below && (
            <form action={applySuggestedPrice} style={{ marginTop: 8 }}>
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="back" value={`/app/productos/${product.id}`} />
              <button className="btn small">Usar {money(suggestedPrice(product.min_price))}</button>
            </form>
          )}
        </div>
      </div>
      {product.cost_error && <div className="alert warn">Para completar el cálculo: {product.cost_error}</div>}

      <div className="card table-wrap">
        <h2>Ingredientes por unidad de «{product.name}»</h2>
        {!items || items.length === 0 ? (
          <p className="muted">Todavía no cargaste la receta.</p>
        ) : (
          <table>
            <thead><tr><th>Insumo</th><th>Cantidad</th><th>Costo</th><th></th></tr></thead>
            <tbody>
              {items.map((it) => {
                const c = lineCost(it);
                return (
                  <tr key={it.id}>
                    <td>{it.ingredient_name}{!byName.get(normName(it.ingredient_name)) && <><br /><small style={{ color: 'var(--bad)' }}>No está en tu planilla de insumos</small></>}</td>
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
                <label>Insumo</label>
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
      <p className="muted" style={{ fontSize: 13 }}>Los precios de los insumos salen de tu planilla «Insumos». Cuando cambiás un precio ahí, este costo se recalcula solo (cada 10 minutos o con «Actualizar ahora»).</p>
    </>
  );
}

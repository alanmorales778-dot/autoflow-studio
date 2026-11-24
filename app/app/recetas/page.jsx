import Link from 'next/link';
import { rubroOf } from '@/lib/rubros';
import { requireBakery } from '@/lib/session';
import { createAdmin } from '@/lib/supabase';
import { liveCosts } from '@/lib/sheets';
import { money, pct, num, normName } from '@/lib/format';
import { currentMargin } from '@/lib/costs';
import { hasRecipeAI, previewRecipes, loadRecipeItems } from '@/lib/recipes';
import { Flash, Locked } from '../ui';
import PhotoPicker from '../photo-picker';
import RecipeEditor from './recipe-editor';
import { importRecipes, readRecipePhoto, applyRecipesImport, saveRecipeDraft, discardRecipeImport } from './actions';

export const maxDuration = 60; // leer una foto con IA puede tardar unos segundos

const recetasTitle = (T) => (T.key === 'cocina' ? 'Recetas' : 'Fichas de costo');

export default async function Recetas({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const T = rubroOf(bakery);
  const admin = createAdmin();
  const [{ data: products }, { data: ingredients }, live] = await Promise.all([
    supabase.from('products').select('id,name,price,category,recipe_yield,visible').eq('bakery_id', bakery.id).not('sheet_row', 'is', null).order('sheet_row'),
    supabase.from('ingredients').select('*').eq('bakery_id', bakery.id).order('name'),
    liveCosts(supabase, bakery),
  ]);
  const items = await loadRecipeItems(supabase, (products || []).map((p) => p.id));
  const count = new Map();
  (items || []).forEach((it) => count.set(it.product_id, (count.get(it.product_id) || 0) + 1));
  const list = (products || []).map((p) => ({ ...p, n: count.get(p.id) || 0, c: live.get(p.id) || {} }));
  const withRecipe = list.filter((p) => p.n > 0);
  const without = list.filter((p) => p.n === 0);
  const incomplete = withRecipe.filter((p) => p.c.error);
  const title = recetasTitle(T);
  const ai = hasRecipeAI();
  const filter = sp.ver === 'sin' ? 'sin' : sp.ver === 'revisar' ? 'revisar' : 'todas';
  const shown = filter === 'sin' ? without : filter === 'revisar' ? incomplete : list;

  return (
    <>
      <Flash sp={sp} />
      <div className="row between">
        <h1 style={{ margin: 0 }}>{title}</h1>
        <div className="row">
          {access.costs && <a className="btn small" href="#cargar">+ Cargar {T.key === 'cocina' ? 'recetas' : 'fichas'}</a>}
          <a className="btn secondary small" href="/api/export/recetas">Descargar (.xlsx)</a>
        </div>
      </div>
      <p className="muted">
        Qué lleva cada {T.item} y cuánto rinde. Con eso AutoFlow calcula el costo por unidad con los precios de tus <Link href="/app/insumos">{T.insumos.toLowerCase()}</Link>, arma la lista de compras y te avisa si vendés por debajo de tu margen ({pct(bakery.margin_percent, 0)}).
      </p>
      {!access.costs && <Locked title="Módulo de Costos y producción">Cargá tus recetas desde Excel, Google Drive o una foto, y sabé cuánto te cuesta cada {T.item}.</Locked>}

      {sp.vista && <ImportPreviewBlock bakery={bakery} id={sp.vista} T={T} admin={admin} />}
      {sp.borrador && <DraftBlock bakery={bakery} id={sp.borrador} T={T} admin={admin} products={products || []} ingredients={ingredients || []} />}

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card"><small className="muted">Con {T.key === 'cocina' ? 'receta' : 'ficha'}</small><div className="price">{withRecipe.length} <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>de {list.length}</span></div></div>
        <div className="card"><small className="muted">Sin cargar</small><div className="price">{without.length}</div></div>
        <div className="card"><small className="muted">Les falta un {T.insumo.toLowerCase()} o precio</small><div className="price" style={{ color: incomplete.length ? 'var(--warn)' : undefined }}>{incomplete.length}</div></div>
      </div>

      <div className="card table-wrap">
        <div className="row" style={{ gap: 6, marginBottom: 12 }}>
          {[['todas', `Todas (${list.length})`], ['sin', `Sin cargar (${without.length})`], ['revisar', `Para revisar (${incomplete.length})`]].map(([k, l]) => (
            <Link key={k} href={k === 'todas' ? '/app/recetas' : `/app/recetas?ver=${k}`} className={`chip ${filter === k ? 'on' : ''}`}>{l}</Link>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>{list.length === 0 ? <>Primero agregá tus {T.items.toLowerCase()} en <Link href="/app/productos">{T.items}</Link>, o subí un archivo de recetas abajo: los que no existan se crean.</> : 'No hay nada en esta lista.'}</p>
        ) : (
          <table>
            <thead><tr><th>{T.items === 'Servicios' ? 'Servicio' : 'Producto'}</th><th>{T.insumos}</th><th>Rinde</th><th>Costo x unidad</th><th>Precio</th><th>Margen</th><th></th></tr></thead>
            <tbody>
              {shown.map((p) => {
                const m = currentMargin(p.price, p.c.cost);
                const below = p.c.min && Number(p.price) < Number(p.c.min);
                return (
                  <tr key={p.id}>
                    <td><Link href={`/app/productos/${p.id}#receta`} style={{ fontWeight: 600 }}>{p.name}</Link>{!p.visible && <><br /><small className="muted">Oculto del catálogo</small></>}</td>
                    <td>{p.n || '—'}</td>
                    <td>{p.n ? num(p.recipe_yield, 2) : '—'}</td>
                    <td>{p.c.cost !== null && p.c.cost !== undefined ? money(p.c.cost) : '—'}</td>
                    <td>{Number(p.price) ? money(p.price) : <span className="badge warn">Sin precio</span>}</td>
                    <td>{m !== null ? <span className={`badge ${below ? 'bad' : 'ok'}`}>{pct(m)}</span> : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {p.n === 0 ? <Link className="btn small" href={`/app/productos/${p.id}#receta`}>Cargar</Link>
                        : p.c.error && p.c.error !== 'Sin receta cargada' ? <Link className="btn secondary small" href={`/app/productos/${p.id}#receta`} title={p.c.error}>Revisar</Link>
                        : <Link className="btn secondary small" href={`/app/productos/${p.id}#receta`}>Editar</Link>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {access.costs && (
        <div className="card" id="cargar">
          <h2>Cargar {T.key === 'cocina' ? 'recetas' : 'fichas'}</h2>
          <p className="muted" style={{ marginTop: -4 }}>Elegí cómo las tenés. Antes de guardar te mostramos lo que entendimos para que lo corrijas.</p>
          <div className="grid grid-3">
            <div className="upload-option">
              <h3>Excel o CSV</h3>
              <p className="muted">Una fila por {T.insumo.toLowerCase()}: Producto, {T.insumo}, Cantidad, Unidad y Rinde. Sirve para cargar muchas de una vez.</p>
              <form action={importRecipes}>
                <input type="file" name="file" accept=".xlsx,.csv,.txt" required />
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn">Subir y revisar</button>
                  <a className="btn secondary small" href="/api/export/recetas?plantilla=1">Plantilla</a>
                </div>
              </form>
            </div>
            <div className="upload-option">
              <h3>Google Drive</h3>
              <p className="muted">Pegá el link de una planilla, un documento, un PDF o una foto. Compartilo como «Cualquier persona con el enlace».</p>
              <form action={importRecipes}>
                <input name="link" type="url" required placeholder="https://docs.google.com/…" />
                <div style={{ marginTop: 10 }}><button className="btn">Traer de Drive</button></div>
              </form>
              {!ai && <p className="hint">Por ahora, desde Drive solo se pueden traer planillas.</p>}
            </div>
            <div className="upload-option">
              <h3>Foto de la receta</h3>
              {ai ? (
                <>
                  <p className="muted">Sacale una foto al cuaderno o subí una captura. La leemos y te la mostramos para que la corrijas.</p>
                  <PhotoPicker key={sp.error || 'foto'} action={readRecipePhoto} label="Elegir foto" changeLabel="Elegir otra" busyLabel="Leyendo la receta…" maxSide={2000} placeholder="📷" />
                </>
              ) : (
                <p className="muted">Próximamente: vas a poder subir una foto de tu cuaderno de recetas y la cargamos por vos.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

async function ImportPreviewBlock({ bakery, id, T, admin }) {
  const { data: pv } = await admin.from('import_previews').select('*').eq('id', id).eq('bakery_id', bakery.id).eq('kind', 'recetas').maybeSingle();
  if (!pv) return <div className="alert warn">Esa vista previa ya no está disponible. Volvé a subir el archivo.</div>;
  const recipes = Array.isArray(pv.rows) ? pv.rows : [];
  const d = await previewRecipes(admin, bakery, recipes);
  const fromDrive = !!bakery.sheet_productos_id;
  const L = ({ title, items, cls }) => (items.length ? (
    <div style={{ flex: '1 1 220px' }}>
      <div className="row" style={{ gap: 8, marginBottom: 6 }}><span className={`badge ${cls}`}>{items.length}</span><strong>{title}</strong></div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--ink-2)' }}>
        {items.slice(0, 8).map((t) => <li key={t}>{t}</li>)}
        {items.length > 8 && <li className="muted">y {items.length - 8} más</li>}
      </ul>
    </div>
  ) : null);
  return (
    <div className="card fade-in" id="importar" style={{ borderColor: 'var(--brand-line)', boxShadow: '0 0 0 3px rgba(194,65,12,.08)' }}>
      <h2>Revisá antes de guardar{pv.file_name ? ` · ${pv.file_name}` : ''}</h2>
      <p className="muted" style={{ marginTop: -4 }}>Encontramos {d.total} {d.total === 1 ? 'receta' : 'recetas'}. Todavía no se cambió nada.</p>
      <div className="row" style={{ alignItems: 'flex-start', gap: 20, margin: '14px 0' }}>
        <L title="Recetas nuevas" items={d.added} cls="ok" />
        <L title="Reemplazan la receta que ya tenían" items={d.replaced} cls="warn" />
        <L title={`${T.items} que no existen`} items={d.newProducts} cls="bad" />
        <L title={`${T.insumos} que no están en tu lista`} items={d.missingIngredients} cls="bad" />
      </div>
      {d.invalid.length > 0 && <div className="alert warn">No se entendió la cantidad o la unidad (se saltean): {d.invalid.slice(0, 6).join(' · ')}{d.invalid.length > 6 ? '…' : ''}</div>}
      <details className="fold" style={{ marginBottom: 12 }}>
        <summary className="btn secondary small">Ver lo que leímos</summary>
        <div className="fold-body">
          {recipes.slice(0, 30).map((r) => (
            <div key={r.name} style={{ marginBottom: 10 }}>
              <strong>{r.name}</strong> <span className="muted">· rinde {num(r.yield || 1, 2)}</span>
              <div className="muted" style={{ fontSize: 13 }}>{r.items.map((it) => `${it.name} ${num(it.qty, 3)} ${it.unit}`).join(' · ') || 'Sin ingredientes'}</div>
            </div>
          ))}
          {recipes.length > 30 && <p className="muted">y {recipes.length - 30} más.</p>}
        </div>
      </details>
      <form action={applyRecipesImport}>
        <input type="hidden" name="id" value={pv.id} />
        {d.newProducts.length > 0 && (fromDrive
          ? <p className="muted" style={{ fontSize: 13 }}>Los {T.items.toLowerCase()} que no existen no se cargan: tus {T.items.toLowerCase()} vienen de Google Drive.</p>
          : <label className="inline-label" style={{ display: 'block', marginBottom: 8 }}><input type="checkbox" name="create_products" defaultChecked /> Crear los {d.newProducts.length} {T.items.toLowerCase()} que no existen (quedan ocultos hasta que les pongas precio)</label>)}
        {d.missingIngredients.length > 0 && !bakery.sheet_insumos_id && <label className="inline-label" style={{ display: 'block', marginBottom: 12 }}><input type="checkbox" name="create_ingredients" defaultChecked /> Agregar los {d.missingIngredients.length} {T.insumos.toLowerCase()} que faltan a mi lista, sin precio, para completarlos</label>}
        <div className="row">
          <button className="btn">Guardar {d.total === 1 ? 'receta' : 'recetas'}</button>
        </div>
      </form>
      <form action={discardRecipeImport} style={{ marginTop: 8 }}><input type="hidden" name="id" value={pv.id} /><button className="btn secondary small">Cancelar</button></form>
    </div>
  );
}

async function DraftBlock({ bakery, id, T, admin, products, ingredients }) {
  const { data: pv } = await admin.from('import_previews').select('*').eq('id', id).eq('bakery_id', bakery.id).eq('kind', 'receta_foto').maybeSingle();
  if (!pv) return <div className="alert warn">Ese borrador ya no está. Volvé a subir la foto.</div>;
  const d = pv.rows || {};
  const guess = d.product_id || products.find((p) => normName(p.name) === normName(d.name))?.id || '';
  const known = new Set(ingredients.map((i) => normName(i.name)));
  const missing = (d.items || []).filter((it) => !known.has(normName(it.name)));
  return (
    <div className="card fade-in" id="borrador" style={{ borderColor: 'var(--brand-line)', boxShadow: '0 0 0 3px rgba(194,65,12,.08)' }}>
      <h2>Revisá la receta{d.name ? ` · ${d.name}` : ''}</h2>
      <p className="muted" style={{ marginTop: -4 }}>
        La leímos {d.source === 'foto' ? 'de tu foto' : 'de Google Drive'}. Corregí lo que haga falta y guardala.{d.doubts?.length ? ` Mirá bien las filas marcadas: eran medidas caseras o no se leían claro.` : ''}
      </p>
      <RecipeEditor
        action={saveRecipeDraft}
        hidden={{ draft_id: pv.id }}
        items={d.items || []}
        recipeYield={d.yield || 1}
        notes={d.notes || ''}
        ingredients={ingredients}
        T={T}
        overheadPercent={bakery.overhead_percent}
        extraRows={2}
        submitLabel="Guardar receta"
      >
        <div className="grid grid-3" style={{ gap: 10 }}>
          <div className="field">
            <label>¿De qué {T.item} es?</label>
            <select name="product_id" defaultValue={guess || 'nuevo'}>
              {!bakery.sheet_productos_id && <option value="nuevo">➕ Uno nuevo…</option>}
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {!bakery.sheet_productos_id && <div className="field"><label>Nombre (si es nuevo)</label><input name="new_name" defaultValue={guess ? '' : d.name || ''} placeholder="Ej: Alfajores de maicena" /></div>}
          {!bakery.sheet_productos_id && <div className="field"><label>Precio de venta (si es nuevo)</label><input name="new_price" inputMode="decimal" placeholder="Opcional" /></div>}
        </div>
        {missing.length > 0 && !bakery.sheet_insumos_id && (
          <label className="inline-label" style={{ display: 'block', marginBottom: 12 }}>
            <input type="checkbox" name="create_ingredients" defaultChecked /> Agregar a mi lista los {missing.length} {T.insumos.toLowerCase()} que no tengo ({missing.slice(0, 4).map((m) => m.name).join(', ')}{missing.length > 4 ? '…' : ''}), sin precio
          </label>
        )}
      </RecipeEditor>
      <form action={discardRecipeImport} style={{ marginTop: 8 }}><input type="hidden" name="id" value={pv.id} /><button className="btn secondary small">Descartar</button></form>
    </div>
  );
}

'use server';

import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireBakery } from '@/lib/session';
import { createAdmin } from '@/lib/supabase';
import { parseNum, normName } from '@/lib/format';
import { recomputeCosts, pushStockToSheet } from '@/lib/sheets';
import { parseUpload } from '@/lib/xlsx';
import { rowsToRecipes, fetchDriveRecipe, readRecipeWithAI, previewRecipes, replaceRecipe, MAX_RECIPE_LINES } from '@/lib/recipes';

const str = (fd, k) => String(fd.get(k) ?? '').trim();
const HOME = '/app/recetas';

function back(path, { error, ok } = {}) {
  const p = new URLSearchParams();
  if (error) p.set('error', String(error).slice(0, 300));
  if (ok) p.set('ok', String(ok).slice(0, 300));
  const qs = p.toString();
  const [base, hash] = String(path).split('#');
  redirect(qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}${hash ? `#${hash}` : ''}` : path);
}

// Solo rutas internas de la app como destino de vuelta.
const safeBack = (v, fallback) => (/^\/app(\/[\w\-/]*)?(\?[\w=&-]*)?(#[\w-]*)?$/.test(v || '') ? v : fallback);

async function ctx() {
  const c = await requireBakery();
  return { ...c, admin: createAdmin() };
}

function itemsFromForm(fd) {
  const names = fd.getAll('name').map((v) => String(v).trim());
  const qtys = fd.getAll('qty').map((v) => parseNum(String(v)));
  const units = fd.getAll('unit').map((v) => String(v));
  const items = [];
  const bad = [];
  names.forEach((name, i) => {
    if (!name) return;
    const qty = qtys[i];
    if (!qty || qty <= 0) { bad.push(name); return; }
    items.push({ name, qty, unit: units[i] || 'g' });
  });
  return { items: items.slice(0, MAX_RECIPE_LINES), bad };
}

async function nextSheetRow(admin, bakeryId) {
  const { data } = await admin.from('products').select('sheet_row').eq('bakery_id', bakeryId).not('sheet_row', 'is', null).order('sheet_row', { ascending: false }).limit(1);
  return Math.max(2, (data?.[0]?.sheet_row || 1) + 1);
}

async function createProductFor(admin, bakery, name, price) {
  const row = {
    bakery_id: bakery.id,
    sku: `P-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    name: name.slice(0, 120),
    category: 'General',
    price: price && price > 0 ? price : 0,
    visible: !!(price && price > 0), // sin precio no se muestra en el catálogo
    sheet_row: await nextSheetRow(admin, bakery.id),
  };
  const { data, error } = await admin.from('products').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}

// Los insumos que usan las recetas y no están en la lista se agregan sin precio, para que se completen.
async function addMissingIngredients(admin, bakery, names) {
  if (!names.length || bakery.sheet_insumos_id) return 0;
  const { data: existing } = await admin.from('ingredients').select('name,sheet_row').eq('bakery_id', bakery.id);
  const have = new Set((existing || []).map((i) => normName(i.name)));
  let row = Math.max(1, ...(existing || []).map((i) => i.sheet_row || 1)) + 1;
  const rows = [];
  for (const it of names) {
    const k = normName(it.name);
    if (have.has(k)) continue;
    have.add(k);
    rows.push({ bakery_id: bakery.id, name: it.name.slice(0, 120), qty: null, unit: it.unit, price: null, error: 'Falta presentación y precio', sheet_row: row++ });
  }
  if (rows.length) {
    const { error } = await admin.from('ingredients').insert(rows);
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

// ---------- Guardar una receta (desde la ficha del producto o desde la pantalla Recetas) ----------
export async function saveRecipe(fd) {
  const { bakery, access, admin } = await ctx();
  const productId = str(fd, 'product_id');
  const to = safeBack(str(fd, 'back'), `/app/productos/${productId}#receta`);
  if (!access.costs) back(to, { error: 'Activá el módulo de Costos para cargar recetas.' });
  const { data: p } = await admin.from('products').select('id,name').eq('id', productId).eq('bakery_id', bakery.id).maybeSingle();
  if (!p) back(HOME, { error: 'No encontramos ese producto.' });
  const { items, bad } = itemsFromForm(fd);
  const y = parseNum(str(fd, 'recipe_yield'));
  if (y !== null && (y <= 0 || y > 100000)) back(to, { error: 'El rinde tiene que ser un número mayor a 0.' });
  let err = null;
  let n = 0;
  try {
    n = await replaceRecipe(admin, p.id, items, { recipeYield: y || 1, notes: str(fd, 'recipe_notes') });
    await recomputeCosts(admin, bakery, [p.id]);
    await pushStockToSheet(admin, bakery, [p.id]);
  } catch (e) {
    err = e.message;
  }
  revalidatePath('/app', 'layout');
  if (err) back(to, { error: err });
  back(to, bad.length
    ? { error: `Se guardó la receta, pero faltó la cantidad en: ${bad.join(', ')}. Esas filas no se guardaron.` }
    : { ok: n ? `Receta de «${p.name}» guardada (${n} ${n === 1 ? 'ingrediente' : 'ingredientes'}).` : `La receta de «${p.name}» quedó vacía.` });
}

// ---------- Importar: archivo, link de Drive o foto ----------
async function storeDraft(admin, bakery, kind, rows, fileName) {
  await admin.from('import_previews').delete().eq('bakery_id', bakery.id).lt('created_at', new Date(Date.now() - 86400000).toISOString());
  const { data, error } = await admin.from('import_previews').insert({ bakery_id: bakery.id, kind, rows, replace: false, file_name: fileName ? String(fileName).slice(0, 120) : null }).select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function insumoNames(admin, bakery) {
  const { data } = await admin.from('ingredients').select('name').eq('bakery_id', bakery.id).limit(400);
  return (data || []).map((i) => i.name);
}

async function hintFor(admin, bakery, productId) {
  if (!productId) return '';
  const { data } = await admin.from('products').select('name').eq('id', productId).eq('bakery_id', bakery.id).maybeSingle();
  return data?.name || '';
}

// Archivo Excel/CSV, o link de Google Drive (planilla, documento, PDF o foto).
export async function importRecipes(fd) {
  const { bakery, access, admin } = await ctx();
  if (!access.costs) back(HOME, { error: 'Activá el módulo de Costos para cargar recetas.' });
  const link = str(fd, 'link');
  let dest = null;
  let err = null;
  try {
    if (link) {
      const got = await fetchDriveRecipe(link);
      if (got.rows) {
        const recipes = rowsToRecipes(got.rows);
        dest = `${HOME}?vista=${await storeDraft(admin, bakery, 'recetas', recipes, 'Google Drive')}#importar`;
      } else {
        const draft = await readRecipeWithAI(got, { insumos: await insumoNames(admin, bakery) });
        dest = `${HOME}?borrador=${await storeDraft(admin, bakery, 'receta_foto', { ...draft, source: 'Google Drive' }, 'Google Drive')}#borrador`;
      }
    } else {
      const file = fd.get('file');
      const rows = await parseUpload(file);
      const recipes = rowsToRecipes(rows);
      dest = `${HOME}?vista=${await storeDraft(admin, bakery, 'recetas', recipes, file?.name)}#importar`;
    }
  } catch (e) {
    err = e.message;
  }
  if (err) back(`${HOME}#cargar`, { error: err });
  redirect(dest);
}

// Foto de una receta (se achica en el navegador antes de subir).
export async function readRecipePhoto(fd) {
  const { bakery, access, admin } = await ctx();
  const productId = str(fd, 'product_id');
  const errTo = productId ? `/app/productos/${productId}#receta` : `${HOME}#cargar`;
  if (!access.costs) back(errTo, { error: 'Activá el módulo de Costos para cargar recetas.' });
  const file = fd.get('foto');
  let dest = null;
  let err = null;
  try {
    if (!file || typeof file.arrayBuffer !== 'function' || !file.size) throw new Error('Elegí una foto.');
    if (file.size > 5 * 1024 * 1024) throw new Error('La foto pesa mucho. Probá con otra o sacale una captura de pantalla.');
    const type = String(file.type || '').toLowerCase();
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) throw new Error('Esa foto está en un formato que no podemos leer. Probá con JPG o PNG (o una captura de pantalla).');
    const data = Buffer.from(await file.arrayBuffer()).toString('base64');
    const hint = await hintFor(admin, bakery, productId);
    const draft = await readRecipeWithAI({ media: { type, data } }, { insumos: await insumoNames(admin, bakery), hint });
    const id = await storeDraft(admin, bakery, 'receta_foto', { ...draft, product_id: productId || null, source: 'foto' }, file.name);
    dest = `${HOME}?borrador=${id}#borrador`;
  } catch (e) {
    err = e.message;
  }
  if (err) back(errTo, { error: err });
  redirect(dest);
}

// Confirmar un archivo de varias recetas.
export async function applyRecipesImport(fd) {
  const { bakery, access, admin } = await ctx();
  if (!access.costs) back(HOME, { error: 'Activá el módulo de Costos para cargar recetas.' });
  const { data: pv } = await admin.from('import_previews').select('*').eq('id', str(fd, 'id')).eq('bakery_id', bakery.id).eq('kind', 'recetas').maybeSingle();
  if (!pv) back(HOME, { error: 'La vista previa venció. Volvé a subir el archivo.' });
  const recipes = Array.isArray(pv.rows) ? pv.rows : [];
  const createProducts = fd.get('create_products') === 'on' && !bakery.sheet_productos_id;
  const createIngredients = fd.get('create_ingredients') === 'on';
  let msg = null;
  let err = null;
  try {
    const { data: products } = await admin.from('products').select('id,name').eq('bakery_id', bakery.id).not('sheet_row', 'is', null);
    const byName = new Map((products || []).map((p) => [normName(p.name), p.id]));
    const touched = [];
    let created = 0;
    let skipped = 0;
    for (const r of recipes) {
      let id = byName.get(normName(r.name));
      if (!id) {
        if (!createProducts) { skipped++; continue; }
        id = await createProductFor(admin, bakery, r.name, null);
        byName.set(normName(r.name), id);
        created++;
      }
      await replaceRecipe(admin, id, r.items || [], { recipeYield: r.yield || 1, ...(r.notes ? { notes: r.notes } : {}) });
      touched.push(id);
    }
    const addedIng = createIngredients ? await addMissingIngredients(admin, bakery, recipes.flatMap((r) => r.items || [])) : 0;
    if (touched.length) {
      await recomputeCosts(admin, bakery, touched);
      await pushStockToSheet(admin, bakery, touched);
    }
    await admin.from('import_previews').delete().eq('id', pv.id);
    msg = `Listo: ${touched.length} ${touched.length === 1 ? 'receta cargada' : 'recetas cargadas'}.`
      + (created ? ` Se crearon ${created} productos nuevos, ocultos del catálogo hasta que les pongas precio.` : '')
      + (skipped ? ` ${skipped} no se cargaron porque el producto no existe.` : '')
      + (addedIng ? ` Se agregaron ${addedIng} insumos sin precio: completalos en Insumos para ver el costo.` : '');
  } catch (e) {
    err = e.message;
  }
  revalidatePath('/app', 'layout');
  back(HOME, err ? { error: err } : { ok: msg });
}

// Guardar la receta leída de una foto / documento, después de corregirla.
export async function saveRecipeDraft(fd) {
  const { bakery, access, admin } = await ctx();
  if (!access.costs) back(HOME, { error: 'Activá el módulo de Costos para cargar recetas.' });
  const { data: pv } = await admin.from('import_previews').select('id').eq('id', str(fd, 'draft_id')).eq('bakery_id', bakery.id).eq('kind', 'receta_foto').maybeSingle();
  if (!pv) back(HOME, { error: 'Ese borrador ya no está. Volvé a subir la foto.' });
  const to = `${HOME}?borrador=${pv.id}#borrador`;
  const { items, bad } = itemsFromForm(fd);
  if (!items.length) back(to, { error: 'La receta no tiene ingredientes con cantidad.' });
  if (bad.length) back(to, { error: `Falta la cantidad en: ${bad.join(', ')}.` });
  const y = parseNum(str(fd, 'recipe_yield'));
  if (y !== null && (y <= 0 || y > 100000)) back(to, { error: 'El rinde tiene que ser un número mayor a 0.' });
  let productId = str(fd, 'product_id');
  const newName = str(fd, 'new_name');
  let err = null;
  let name = '';
  let created = false;
  try {
    if (productId === 'nuevo' || !productId) {
      if (!newName) throw new Error('Elegí a qué producto pertenece la receta o escribí el nombre de uno nuevo.');
      if (bakery.sheet_productos_id) throw new Error('Tus productos vienen de Google Drive: agregalo primero en tu planilla y después elegilo acá.');
      const { data: same } = await admin.from('products').select('id').eq('bakery_id', bakery.id).ilike('name', newName).not('sheet_row', 'is', null).maybeSingle();
      productId = same ? same.id : await createProductFor(admin, bakery, newName, parseNum(str(fd, 'new_price')));
      created = !same;
      name = newName;
    } else {
      const { data: p } = await admin.from('products').select('id,name').eq('id', productId).eq('bakery_id', bakery.id).maybeSingle();
      if (!p) throw new Error('No encontramos ese producto.');
      name = p.name;
    }
    await replaceRecipe(admin, productId, items, { recipeYield: y || 1, notes: str(fd, 'recipe_notes') });
    if (fd.get('create_ingredients') === 'on') await addMissingIngredients(admin, bakery, items);
    await recomputeCosts(admin, bakery, [productId]);
    await pushStockToSheet(admin, bakery, [productId]);
    await admin.from('import_previews').delete().eq('id', pv.id);
  } catch (e) {
    err = e.message;
  }
  revalidatePath('/app', 'layout');
  if (err) back(to, { error: err });
  back(`/app/productos/${productId}#receta`, { ok: `Receta de «${name}» guardada.${created ? ' El producto se creó; revisá su precio arriba.' : ''}` });
}

export async function discardRecipeImport(fd) {
  const { bakery, admin } = await ctx();
  await admin.from('import_previews').delete().eq('id', str(fd, 'id')).eq('bakery_id', bakery.id).in('kind', ['recetas', 'receta_foto']);
  back(HOME, { ok: 'Listo, no se cambió nada.' });
}

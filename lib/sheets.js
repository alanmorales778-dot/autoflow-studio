import { decrypt } from './crypto';
import { refreshAccessToken, createSpreadsheet, getFileMeta, readValues, batchWrite } from './google';
import { computeCost, currentMargin, subRecipeIngredient } from './costs';
import { applyInsumos, applyProductos } from './catalog';
import { normName } from './format';
import { reservedByProduct } from './orders';
import { loadRecipeItems } from './recipes';

export const INSUMOS_HEADER = ['Insumo', 'Unidad de compra', 'Cantidad', 'Unidad (g, kg, ml, l, u)', 'Precio ($)', 'Proveedor', 'Actualizado', 'Estado (HakkiraApp)'];
export const PRODUCTOS_HEADER = [
  'ID', 'Producto', 'Categoría', 'Precio de venta ($)', 'Stock cargado (vacío = a pedido)', 'Visible (Sí/No)', 'Foto (URL)', 'Descripción',
  'Reservado (HakkiraApp)', 'Disponible (HakkiraApp)', 'Costo (HakkiraApp)', 'Precio mínimo (HakkiraApp)', 'Margen actual % (HakkiraApp)',
];

export const EXAMPLE_INSUMOS = [
  ['Harina 000', 'Bolsa', 1, 'kg', 1200, 'Mayorista', ''],
  ['Manteca', 'Pan', 500, 'g', 4000, 'Mayorista', ''],
  ['Huevos', 'Maple', 30, 'u', 6000, 'Granja', ''],
  ['Azúcar', 'Paquete', 1, 'kg', 1500, 'Mayorista', ''],
  ['Chocolate semiamargo', 'Barra', 1, 'kg', 15000, 'Distribuidora', ''],
  ['Crema de leche', 'Pote', 500, 'ml', 3500, 'Mayorista', ''],
];

export const EXAMPLE_PRODUCTOS = [
  ['P-001', 'Torta de chocolate grande', 'Tortas grandes', 18000, '', 'Sí', '', 'Bizcochuelo húmedo, ganache y crema. 20 porciones.'],
  ['P-002', 'Docena de alfajores', 'Alfajores', 12500, 20, 'Sí', '', 'Alfajores caseros bañados en chocolate semiamargo.'],
];

export const EXAMPLE_RECIPES = {
  'P-001': [['Harina 000', 500, 'g'], ['Huevos', 6, 'u'], ['Manteca', 200, 'g'], ['Azúcar', 300, 'g'], ['Chocolate semiamargo', 300, 'g'], ['Crema de leche', 200, 'ml']],
  'P-002': [['Harina 000', 300, 'g'], ['Manteca', 150, 'g'], ['Azúcar', 100, 'g'], ['Huevos', 2, 'u'], ['Chocolate semiamargo', 250, 'g']],
};

export async function createTemplateSheets(token, bakeryName, sample = null) {
  const insumos = await createSpreadsheet(token, {
    title: `HakkiraApp – Insumos – ${bakeryName}`,
    sheetTitle: 'Insumos',
    header: INSUMOS_HEADER,
    rows: sample?.insumos || EXAMPLE_INSUMOS,
    appColumnsFrom: 7,
  });
  const productos = await createSpreadsheet(token, {
    title: `HakkiraApp – Productos y stock – ${bakeryName}`,
    sheetTitle: 'Productos',
    header: PRODUCTOS_HEADER,
    rows: sample?.productos || EXAMPLE_PRODUCTOS,
    appColumnsFrom: 8,
  });
  return { insumos, productos };
}

export async function accessTokenFor(bakery) {
  if (!bakery.google_refresh_token_enc) throw new Error('Google Drive no está conectado.');
  return refreshAccessToken(decrypt(bakery.google_refresh_token_enc));
}

export async function syncBakery(admin, bakery, { force = false } = {}) {
  if (!bakery.google_refresh_token_enc || !bakery.sheet_productos_id) return { skipped: true };
  try {
    const token = await accessTokenFor(bakery);
    const [mi, mp] = await Promise.all([
      bakery.sheet_insumos_id ? getFileMeta(token, bakery.sheet_insumos_id) : null,
      getFileMeta(token, bakery.sheet_productos_id),
    ]);
    const changed =
      force ||
      !bakery.sheet_productos_modified ||
      new Date(mp.modifiedTime) > new Date(bakery.sheet_productos_modified) ||
      (mi && (!bakery.sheet_insumos_modified || new Date(mi.modifiedTime) > new Date(bakery.sheet_insumos_modified)));

    if (!changed) {
      await admin.from('bakeries').update({ last_sync_at: new Date().toISOString(), last_sync_error: null }).eq('id', bakery.id);
      return { changed: false };
    }

    const writes = { insumos: [], productos: [] };

    if (bakery.sheet_insumos_id) {
      const rows = await readValues(token, bakery.sheet_insumos_id, 'Insumos!A2:G');
      const r = await applyInsumos(admin, bakery, rows);
      writes.insumos = r.statusWrites;
    }
    const prows = await readValues(token, bakery.sheet_productos_id, 'Productos!A2:H');
    const rp = await applyProductos(admin, bakery, prows);
    writes.productos = rp.idWrites;

    await recomputeCosts(admin, bakery);
    await writeBackProducts(admin, bakery, token, writes.productos);
    if (bakery.sheet_insumos_id) await batchWrite(token, bakery.sheet_insumos_id, writes.insumos);

    const [mi2, mp2] = await Promise.all([
      bakery.sheet_insumos_id ? getFileMeta(token, bakery.sheet_insumos_id) : null,
      getFileMeta(token, bakery.sheet_productos_id),
    ]);
    await admin
      .from('bakeries')
      .update({
        sheet_insumos_modified: mi2 ? mi2.modifiedTime : null,
        sheet_productos_modified: mp2.modifiedTime,
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq('id', bakery.id);
    return { changed: true, products: rp.count ?? null };
  } catch (e) {
    await admin.from('bakeries').update({ last_sync_at: new Date().toISOString(), last_sync_error: String(e.message || e).slice(0, 500) }).eq('id', bakery.id);
    return { error: String(e.message || e) };
  }
}

// Costo calculado en el momento con los precios actuales de insumos y las recetas.
// Todas las pantallas usan esto para que nunca muestren costos distintos entre sí.
export async function liveCosts(db, bakery, productIds = null) {
  const { data: ingredients } = await db.from('ingredients').select('*').eq('bakery_id', bakery.id);
  const byName = new Map((ingredients || []).map((i) => [normName(i.name), i]));
  let q = db.from('products').select('id').eq('bakery_id', bakery.id);
  if (productIds) q = q.in('id', productIds);
  const { data: products } = await q;
  const out = new Map();
  if (!products || !products.length) return out;
  const ids = products.map((p) => p.id);
  const items = await loadRecipeItems(db, ids);
  const grouped = new Map();
  (items || []).forEach((it) => {
    if (!grouped.has(it.product_id)) grouped.set(it.product_id, []);
    grouped.get(it.product_id).push(it);
  });
  // Sub-recetas: si un renglón de la receta se llama igual que otro producto con receta, se usa el
  // costo de ese producto (sin indirectos, para no sumarlos dos veces). Se resuelve en varias pasadas.
  const { data: allProducts } = await db.from('products').select('id,name').eq('bakery_id', bakery.id);
  const productByName = new Map((allProducts || []).map((p) => [normName(p.name), p]));
  const needsSub = (items) => (items || []).some((it) => !byName.has(normName(it.ingredient_name)) && productByName.has(normName(it.ingredient_name)));
  const subIds = new Set();
  grouped.forEach((items) => (items || []).forEach((it) => { const p = !byName.has(normName(it.ingredient_name)) && productByName.get(normName(it.ingredient_name)); if (p) subIds.add(p.id); }));
  const missingSub = [...subIds].filter((id) => !grouped.has(id) && !ids.includes(id));
  if (missingSub.length) {
    const extra = await loadRecipeItems(db, missingSub);
    (extra || []).forEach((it) => { if (!grouped.has(it.product_id)) grouped.set(it.product_id, []); grouped.get(it.product_id).push(it); });
  }
  const raw = new Map(); // costo sin indirectos por unidad del rinde
  const lookup = new Map(byName);
  for (let pass = 0; pass < 4; pass++) {
    for (const [pid, items] of grouped) {
      if (raw.has(pid)) continue;
      const usesPending = (items || []).some((it) => { const k = normName(it.ingredient_name); const p = !byName.has(k) && productByName.get(k); return p && !raw.has(p.id); });
      if (usesPending && pass < 3) continue;
      const r = computeCost(items, lookup, 0, 0);
      if (r.cost !== null) raw.set(pid, r.cost);
    }
    for (const [pid, c] of raw) {
      const p = (allProducts || []).find((x) => x.id === pid);
      if (!p) continue;
      const k = normName(p.name);
      if (byName.has(k)) continue; // un insumo real con el mismo nombre tiene prioridad
      const unit = [...grouped.values()].flat().find((it) => normName(it.ingredient_name) === k)?.unit || 'u';
      lookup.set(k, subRecipeIngredient(p, c, unit));
    }
  }
  ids.forEach((id) => out.set(id, computeCost(grouped.get(id) || [], needsSub(grouped.get(id)) ? lookup : byName, bakery.overhead_percent, bakery.margin_percent)));
  return out;
}

export async function recomputeCosts(admin, bakery, productIds = null) {
  const map = await liveCosts(admin, bakery, productIds);
  await Promise.all(
    [...map].map(([id, r]) => admin.from('products').update({ cost: r.cost, min_price: r.min, cost_error: r.error }).eq('id', id)),
  );
}

export async function writeBackProducts(admin, bakery, token, extra = [], onlyProductIds = null) {
  if (!bakery.sheet_productos_id) return;
  let q = admin.from('products').select('*').eq('bakery_id', bakery.id).not('sheet_row', 'is', null);
  if (onlyProductIds) q = q.in('id', onlyProductIds);
  const { data: products } = await q;
  const reserved = await reservedByProduct(admin, bakery.id);
  const data = [...extra];
  (products || []).forEach((p) => {
    const res = reserved.get(p.id) || 0;
    const disp = p.stock_loaded === null ? 'A pedido' : Math.max(0, p.stock_loaded - res);
    data.push({
      range: `Productos!I${p.sheet_row}:M${p.sheet_row}`,
      values: [[res, disp, p.cost ?? '', p.min_price ?? '', currentMargin(p.price, p.cost) ?? '']],
    });
  });
  await batchWrite(token, bakery.sheet_productos_id, data);
}

// Actualiza reservados/disponible en la planilla luego de un cambio en pedidos. Nunca rompe el flujo del pedido.
export async function pushStockToSheet(admin, bakery, productIds) {
  if (!bakery.google_refresh_token_enc || !bakery.sheet_productos_id) return;
  try {
    const token = await accessTokenFor(bakery);
    await writeBackProducts(admin, bakery, token, [], productIds);
  } catch (e) {
    await admin.from('bakeries').update({ last_sync_error: `Al actualizar stock: ${String(e.message || e).slice(0, 400)}` }).eq('id', bakery.id);
  }
}

export async function writeCells(bakery, data) {
  const token = await accessTokenFor(bakery);
  await batchWrite(token, bakery.sheet_productos_id, data);
}

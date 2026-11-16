import crypto from 'node:crypto';
import { decrypt } from './crypto';
import { refreshAccessToken, createSpreadsheet, getFileMeta, readValues, batchWrite } from './google';
import { computeCost, normUnit, currentMargin } from './costs';
import { parseNum, normName } from './format';
import { reservedByProduct } from './orders';

export const INSUMOS_HEADER = ['Insumo', 'Unidad de compra', 'Cantidad', 'Unidad (g, kg, ml, l, u)', 'Precio ($)', 'Proveedor', 'Actualizado', 'Estado (AutoFlow)'];
export const PRODUCTOS_HEADER = [
  'ID', 'Producto', 'Categoría', 'Precio de venta ($)', 'Stock cargado (vacío = a pedido)', 'Visible (Sí/No)', 'Foto (URL)', 'Descripción',
  'Reservado (AutoFlow)', 'Disponible (AutoFlow)', 'Costo (AutoFlow)', 'Precio mínimo (AutoFlow)', 'Margen actual % (AutoFlow)',
];

const EXAMPLE_INSUMOS = [
  ['Harina 000', 'Bolsa', 1, 'kg', 1200, 'Mayorista', ''],
  ['Manteca', 'Pan', 500, 'g', 4000, 'Mayorista', ''],
  ['Huevos', 'Maple', 30, 'u', 6000, 'Granja', ''],
  ['Azúcar', 'Paquete', 1, 'kg', 1500, 'Mayorista', ''],
  ['Chocolate semiamargo', 'Barra', 1, 'kg', 15000, 'Distribuidora', ''],
  ['Crema de leche', 'Pote', 500, 'ml', 3500, 'Mayorista', ''],
];

const EXAMPLE_PRODUCTOS = [
  ['P-001', 'Torta de chocolate grande', 'Tortas grandes', 18000, '', 'Sí', '', 'Bizcochuelo húmedo, ganache y crema. 20 porciones.'],
  ['P-002', 'Docena de alfajores', 'Alfajores', 9500, 20, 'Sí', '', 'Alfajores de maicena bañados en chocolate.'],
];

export const EXAMPLE_RECIPES = {
  'P-001': [['Harina 000', 500, 'g'], ['Huevos', 6, 'u'], ['Manteca', 200, 'g'], ['Azúcar', 300, 'g'], ['Chocolate semiamargo', 300, 'g'], ['Crema de leche', 200, 'ml']],
  'P-002': [['Harina 000', 300, 'g'], ['Manteca', 150, 'g'], ['Azúcar', 100, 'g'], ['Huevos', 2, 'u'], ['Chocolate semiamargo', 250, 'g']],
};

export async function createTemplateSheets(token, bakeryName) {
  const insumos = await createSpreadsheet(token, {
    title: `AutoFlow – Insumos – ${bakeryName}`,
    sheetTitle: 'Insumos',
    header: INSUMOS_HEADER,
    rows: EXAMPLE_INSUMOS,
    appColumnsFrom: 7,
  });
  const productos = await createSpreadsheet(token, {
    title: `AutoFlow – Productos y stock – ${bakeryName}`,
    sheetTitle: 'Productos',
    header: PRODUCTOS_HEADER,
    rows: EXAMPLE_PRODUCTOS,
    appColumnsFrom: 8,
  });
  return { insumos, productos };
}

export async function accessTokenFor(bakery) {
  if (!bakery.google_refresh_token_enc) throw new Error('Google Drive no está conectado.');
  return refreshAccessToken(decrypt(bakery.google_refresh_token_enc));
}

const cell = (row, i) => (row && row[i] !== undefined && row[i] !== null ? row[i] : '');

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

    // ---------- Insumos ----------
    if (bakery.sheet_insumos_id) {
      const rows = await readValues(token, bakery.sheet_insumos_id, 'Insumos!A2:G');
      const seen = new Map();
      rows.forEach((r, idx) => {
        const name = String(cell(r, 0)).trim();
        if (!name) return;
        const sheetRow = idx + 2;
        const qty = parseNum(cell(r, 2));
        const unit = String(cell(r, 3)).trim();
        const price = parseNum(cell(r, 4));
        let error = null;
        if (!qty || qty <= 0) error = 'falta la cantidad';
        else if (!normUnit(unit)) error = `unidad "${unit || 'vacía'}" no reconocida (usá g, kg, ml, l o u)`;
        else if (price === null || price < 0) error = 'falta el precio';
        const key = normName(name);
        if (seen.has(key)) error = 'insumo repetido (se usa la primera fila)';
        const item = {
          bakery_id: bakery.id, name, purchase_unit: String(cell(r, 1)).trim() || null, qty, unit, price,
          supplier: String(cell(r, 5)).trim() || null, updated_label: String(cell(r, 6)).trim() || null, error, sheet_row: sheetRow,
        };
        writes.insumos.push({ range: `Insumos!H${sheetRow}`, values: [[error ? `Revisar: ${error}` : 'OK']] });
        if (!seen.has(key)) seen.set(key, item);
      });
      const list = [...seen.values()];
      if (list.length) {
        const { error } = await admin.from('ingredients').upsert(list, { onConflict: 'bakery_id,name' });
        if (error) throw error;
      }
      const { data: existing } = await admin.from('ingredients').select('id,name').eq('bakery_id', bakery.id);
      const keep = new Set(list.map((i) => i.name));
      const toDelete = (existing || []).filter((i) => !keep.has(i.name)).map((i) => i.id);
      if (toDelete.length) await admin.from('ingredients').delete().in('id', toDelete);
    }

    // ---------- Productos ----------
    const prows = await readValues(token, bakery.sheet_productos_id, 'Productos!A2:H');
    const products = [];
    const skus = new Set();
    prows.forEach((r, idx) => {
      const name = String(cell(r, 1)).trim();
      if (!name) return;
      const sheetRow = idx + 2;
      let sku = String(cell(r, 0)).trim();
      if (!sku || skus.has(sku)) {
        sku = `P-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        writes.productos.push({ range: `Productos!A${sheetRow}`, values: [[sku]] });
      }
      skus.add(sku);
      const stockRaw = cell(r, 4);
      const stock = stockRaw === '' ? null : parseNum(stockRaw);
      const visRaw = normName(cell(r, 5));
      products.push({
        bakery_id: bakery.id,
        sku,
        name,
        category: String(cell(r, 2)).trim() || 'General',
        price: parseNum(cell(r, 3)) || 0,
        stock_loaded: stock === null ? null : Math.max(0, Math.floor(stock)),
        visible: !['no', 'n', 'false', '0', 'oculto'].includes(visRaw),
        photo_url: String(cell(r, 6)).trim() || null,
        description: String(cell(r, 7)).trim() || null,
        sheet_row: sheetRow,
      });
    });
    if (products.length) {
      const { error } = await admin.from('products').upsert(products, { onConflict: 'bakery_id,sku' });
      if (error) throw error;
    }
    // productos que ya no están en la planilla: se ocultan (no se borran, para conservar recetas y pedidos)
    const { data: allProducts } = await admin.from('products').select('id,sku').eq('bakery_id', bakery.id);
    const removed = (allProducts || []).filter((p) => !skus.has(p.sku)).map((p) => p.id);
    if (removed.length) await admin.from('products').update({ visible: false, sheet_row: null }).in('id', removed);

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
    return { changed: true, products: products.length };
  } catch (e) {
    await admin.from('bakeries').update({ last_sync_at: new Date().toISOString(), last_sync_error: String(e.message || e).slice(0, 500) }).eq('id', bakery.id);
    return { error: String(e.message || e) };
  }
}

export async function recomputeCosts(admin, bakery, productIds = null) {
  const { data: ingredients } = await admin.from('ingredients').select('*').eq('bakery_id', bakery.id);
  const byName = new Map((ingredients || []).map((i) => [normName(i.name), i]));
  let q = admin.from('products').select('id').eq('bakery_id', bakery.id);
  if (productIds) q = q.in('id', productIds);
  const { data: products } = await q;
  if (!products || !products.length) return;
  const ids = products.map((p) => p.id);
  const { data: items } = await admin.from('recipe_items').select('*').in('product_id', ids);
  const grouped = new Map();
  (items || []).forEach((it) => {
    if (!grouped.has(it.product_id)) grouped.set(it.product_id, []);
    grouped.get(it.product_id).push(it);
  });
  await Promise.all(
    ids.map((id) => {
      const r = computeCost(grouped.get(id) || [], byName, bakery.overhead_percent, bakery.margin_percent);
      return admin.from('products').update({ cost: r.cost, min_price: r.min, cost_error: r.error }).eq('id', id);
    }),
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

// Procesa filas de insumos y productos, vengan de Google Drive o de un archivo subido.
import crypto from 'node:crypto';
import { normUnit } from './costs';
import { parseNum, normName } from './format';

const cell = (row, i) => (row && row[i] !== undefined && row[i] !== null ? row[i] : '');

function excelDateLabel(v) {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }
  return String(v ?? '').trim();
}

// ---------- Mapeo de columnas de un archivo subido al orden estándar ----------
const MATCHERS = {
  insumos: [
    (h) => h === 'insumo' || h.startsWith('insumo') || h.startsWith('ingrediente') || h === 'nombre',
    (h) => h.startsWith('unidad de compra') || h.startsWith('presentacion') || h.startsWith('envase'),
    (h) => h.startsWith('cantidad'),
    (h) => (h.startsWith('unidad') && !h.startsWith('unidad de compra')) || h === 'medida',
    (h) => h.startsWith('precio') || h.startsWith('costo'),
    (h) => h.startsWith('proveedor'),
    (h) => h.startsWith('actualizado') || h.startsWith('fecha'),
  ],
  productos: [
    (h) => h === 'id' || h === 'codigo' || h === 'sku' || h === 'cod',
    (h) => h === 'producto' || h === 'nombre' || h.startsWith('producto'),
    (h) => h.startsWith('categoria') || h.startsWith('rubro'),
    (h) => h.startsWith('precio'),
    (h) => h.startsWith('stock'),
    (h) => h.startsWith('visible') || h.startsWith('mostrar'),
    (h) => h.startsWith('foto') || h.startsWith('imagen'),
    (h) => h.startsWith('descripcion') || h.startsWith('detalle'),
  ],
};

export function mapUploadedRows(kind, rows) {
  const matchers = MATCHERS[kind];
  const key = kind === 'insumos' ? 1 : 2; // columnas que tienen que estar sí o sí: nombre (+ precio en productos)
  let headerIdx = -1;
  let map = null;
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const headers = (rows[r] || []).map((h) => normName(h));
    const m = matchers.map((fn) => headers.findIndex((h) => h && !h.includes('autoflow') && fn(h)));
    const found = m.filter((x) => x >= 0).length;
    if (found >= key + 1 && m[kind === 'insumos' ? 0 : 1] >= 0) { headerIdx = r; map = m; break; }
  }
  if (!map) {
    throw new Error(
      kind === 'insumos'
        ? 'No encontré la fila de títulos. La primera fila tiene que tener al menos «Insumo», «Cantidad», «Unidad» y «Precio». Descargá la plantilla para ver el formato.'
        : 'No encontré la fila de títulos. La primera fila tiene que tener al menos «Producto» y «Precio de venta». Descargá la plantilla para ver el formato.',
    );
  }
  const out = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const mapped = map.map((ci) => (ci >= 0 ? cell(row, ci) : ''));
    if (mapped.every((v) => v === '' || v === null)) continue;
    out.push(mapped);
  }
  return out;
}

// ---------- Insumos ----------
// rows: arreglos en orden estándar; rowNumber(i) = número de fila en la planilla (para escribir el estado)
export async function applyInsumos(admin, bakery, rows, rowNumber = (i) => i + 2, { prune = true } = {}) {
  const seen = new Map();
  const statusWrites = [];
  rows.forEach((r, idx) => {
    const name = String(cell(r, 0)).trim();
    if (!name) return;
    const sheetRow = rowNumber(idx);
    const qty = parseNum(cell(r, 2));
    const unit = String(cell(r, 3)).trim();
    const price = parseNum(cell(r, 4));
    let error = null;
    if (!qty || qty <= 0) error = 'falta la cantidad';
    else if (!normUnit(unit)) error = `unidad "${unit || 'vacía'}" no reconocida (usá g, kg, ml, l o u)`;
    else if (price === null || price < 0) error = 'falta el precio';
    const k = normName(name);
    if (seen.has(k)) error = 'insumo repetido (se usa la primera fila)';
    statusWrites.push({ range: `Insumos!H${sheetRow}`, values: [[error ? `Revisar: ${error}` : 'OK']] });
    if (!seen.has(k)) {
      seen.set(k, {
        bakery_id: bakery.id, name, purchase_unit: String(cell(r, 1)).trim() || null, qty, unit, price,
        supplier: String(cell(r, 5)).trim() || null, updated_label: excelDateLabel(cell(r, 6)) || null, error, sheet_row: sheetRow,
      });
    }
  });
  const list = [...seen.values()];
  if (list.length) {
    const { error } = await admin.from('ingredients').upsert(list, { onConflict: 'bakery_id,name' });
    if (error) throw error;
  }
  let removed = 0;
  if (prune) {
    const { data: existing } = await admin.from('ingredients').select('id,name').eq('bakery_id', bakery.id);
    const keep = new Set(list.map((i) => i.name));
    const toDelete = (existing || []).filter((i) => !keep.has(i.name)).map((i) => i.id);
    if (toDelete.length) await admin.from('ingredients').delete().in('id', toDelete);
    removed = toDelete.length;
  }
  return { count: list.length, errors: list.filter((i) => i.error).length, removed, statusWrites };
}

// ---------- Productos ----------
export async function applyProductos(admin, bakery, rows, rowNumber = (i) => i + 2, { prune = true } = {}) {
  const { data: existing } = await admin.from('products').select('id,sku,name,photo_url').eq('bakery_id', bakery.id);
  const byName = new Map((existing || []).map((p) => [normName(p.name), p.sku]));
  const photoBySku = new Map((existing || []).map((p) => [p.sku, p.photo_url]));
  const products = [];
  const skus = new Set();
  const idWrites = [];
  rows.forEach((r, idx) => {
    const name = String(cell(r, 1)).trim();
    if (!name) return;
    const sheetRow = rowNumber(idx);
    let sku = String(cell(r, 0)).trim();
    if (!sku || skus.has(sku)) {
      // sin ID: si ya existía un producto con ese nombre, se reutiliza su ID (conserva receta y pedidos)
      const prev = byName.get(normName(name));
      sku = prev && !skus.has(prev) ? prev : `P-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      idWrites.push({ range: `Productos!A${sheetRow}`, values: [[sku]] });
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
      // foto vacía en el archivo: se conserva la que se subió desde el panel
      photo_url: String(cell(r, 6)).trim() || photoBySku.get(sku) || null,
      description: String(cell(r, 7)).trim() || null,
      sheet_row: sheetRow,
    });
  });
  if (products.length) {
    const { error } = await admin.from('products').upsert(products, { onConflict: 'bakery_id,sku' });
    if (error) throw error;
  }
  // los que ya no están: se ocultan (no se borran, para conservar recetas y pedidos)
  const removed = prune ? (existing || []).filter((p) => !skus.has(p.sku)).map((p) => p.id) : [];
  if (removed.length) await admin.from('products').update({ visible: false, sheet_row: null }).in('id', removed);
  return { count: products.length, removed: removed.length, idWrites };
}

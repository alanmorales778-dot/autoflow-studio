// Carga de insumos/productos desde un archivo (.xlsx o .csv) y exportación a .xlsx
import { mapUploadedRows, applyInsumos, applyProductos } from './catalog';
import { recomputeCosts, syncBakery, accessTokenFor, INSUMOS_HEADER, PRODUCTOS_HEADER, EXAMPLE_INSUMOS, EXAMPLE_PRODUCTOS } from './sheets';
import { batchWrite, clearRanges } from './google';
import { reservedByProduct } from './orders';
import { currentMargin } from './costs';
import { writeXlsx } from './xlsx';
import { normName, parseNum } from './format';
import { normUnit } from './costs';

export async function importRows(admin, bakery, kind, rawRows, { replace = false } = {}) {
  const rows = mapUploadedRows(kind, rawRows);
  if (!rows.length) throw new Error('El archivo no tiene filas con datos debajo de los títulos.');
  if (rows.length > 2000) throw new Error('Máximo 2000 filas por archivo.');

  const sheetId = kind === 'insumos' ? bakery.sheet_insumos_id : bakery.sheet_productos_id;
  if (bakery.google_refresh_token_enc && sheetId) {
    if (!replace) throw new Error('Tenés Google Drive conectado: el archivo reemplaza tu planilla completa. Tildá «Reemplazar la lista completa» para confirmar, o cambiá los datos directo en tu planilla.');
    // Con Drive conectado, el archivo reemplaza el contenido de la planilla y después se sincroniza:
    // así Drive y HakkiraApp quedan iguales.
    const token = await accessTokenFor(bakery);
    const tab = kind === 'insumos' ? 'Insumos' : 'Productos';
    await clearRanges(token, sheetId, [kind === 'insumos' ? `${tab}!A2:H` : `${tab}!A2:M`]);
    await batchWrite(token, sheetId, [{ range: `${tab}!A2`, values: rows }]);
    const r = await syncBakery(admin, bakery, { force: true });
    if (r.error) throw new Error(r.error);
    return { count: rows.length, drive: true };
  }

  const apply = kind === 'insumos' ? applyInsumos : applyProductos;
  const result = await apply(admin, bakery, rows, undefined, { prune: replace });
  await recomputeCosts(admin, bakery);
  await admin.from('bakeries').update({ last_sync_at: new Date().toISOString(), last_sync_error: null }).eq('id', bakery.id);
  return { count: result.count, errors: result.errors || 0, removed: result.removed || 0, drive: false };
}

export async function exportWorkbook(admin, bakery, kind) {
  if (kind === 'insumos') {
    const { data } = await admin.from('ingredients').select('*').eq('bakery_id', bakery.id).order('sheet_row');
    const rows = data && data.length
      ? data.map((i) => [i.name, i.purchase_unit || '', i.qty ?? '', i.unit || '', i.price ?? '', i.supplier || '', i.updated_label || '', i.error ? `Revisar: ${i.error}` : 'OK'])
      : EXAMPLE_INSUMOS.map((r) => [...r, '']);
    return writeXlsx('Insumos', [INSUMOS_HEADER, ...rows], { appColumnsFrom: 7 });
  }
  const { data } = await admin.from('products').select('*').eq('bakery_id', bakery.id).not('sheet_row', 'is', null).order('sheet_row');
  const reserved = await reservedByProduct(admin, bakery.id);
  const rows = data && data.length
    ? data.map((p) => {
        const res = reserved.get(p.id) || 0;
        return [
          p.sku, p.name, p.category, Number(p.price), p.stock_loaded ?? '', p.visible ? 'Sí' : 'No', p.photo_url || '', p.description || '',
          res, p.stock_loaded === null ? 'A pedido' : Math.max(0, p.stock_loaded - res), p.cost ?? '', p.min_price ?? '', currentMargin(p.price, p.cost) ?? '',
        ];
      })
    : EXAMPLE_PRODUCTOS;
  return writeXlsx('Productos', [PRODUCTOS_HEADER, ...rows], { appColumnsFrom: 8 });
}

// Vista previa: qué va a pasar si se aplica el archivo, sin tocar nada.
export async function previewImport(admin, bakery, kind, rawRows, { replace = false } = {}) {
  const rows = mapUploadedRows(kind, rawRows);
  if (!rows.length) throw new Error('El archivo no tiene filas con datos debajo de los títulos.');
  if (rows.length > 2000) throw new Error('Máximo 2000 filas por archivo.');
  const sheetId = kind === 'insumos' ? bakery.sheet_insumos_id : bakery.sheet_productos_id;
  const drive = !!(bakery.google_refresh_token_enc && sheetId);
  if (drive && !replace) throw new Error('Tenés Google Drive conectado: el archivo reemplaza tu planilla completa. Tildá «Reemplazar la lista completa» para confirmar, o cambiá los datos directo en tu planilla.');
  const c = (r, i) => (r[i] === undefined || r[i] === null ? '' : r[i]);
  const out = { kind, total: rows.length, added: [], changed: [], same: 0, removed: [], invalid: [], drive };

  if (kind === 'insumos') {
    const { data: existing } = await admin.from('ingredients').select('name,qty,unit,price').eq('bakery_id', bakery.id);
    const byName = new Map((existing || []).map((i) => [normName(i.name), i]));
    const seen = new Set();
    for (const r of rows) {
      const name = String(c(r, 0)).trim();
      if (!name) continue;
      const k = normName(name);
      if (seen.has(k)) continue;
      seen.add(k);
      const qty = parseNum(c(r, 2));
      const unit = String(c(r, 3)).trim();
      const price = parseNum(c(r, 4));
      if (!qty || qty <= 0 || !normUnit(unit) || price === null || price < 0) out.invalid.push(name);
      const prev = byName.get(k);
      if (!prev) out.added.push(name);
      else if (Number(prev.price) !== Number(price) || Number(prev.qty) !== Number(qty) || String(prev.unit) !== unit) out.changed.push(`${name}: ${prev.price !== null ? `$ ${Number(prev.price).toLocaleString('es-AR')}` : '—'} → ${price !== null ? `$ ${Number(price).toLocaleString('es-AR')}` : '—'}`);
      else out.same++;
    }
    if (replace) out.removed = (existing || []).filter((i) => !seen.has(normName(i.name))).map((i) => i.name);
  } else {
    const { data: existing } = await admin.from('products').select('sku,name,price,visible,sheet_row').eq('bakery_id', bakery.id);
    const bySku = new Map((existing || []).map((p) => [p.sku, p]));
    const byName = new Map((existing || []).map((p) => [normName(p.name), p]));
    const touched = new Set();
    for (const r of rows) {
      const name = String(c(r, 1)).trim();
      if (!name) continue;
      const sku = String(c(r, 0)).trim();
      const prev = (sku && bySku.get(sku)) || byName.get(normName(name));
      const price = parseNum(c(r, 3)) || 0;
      if (!price) out.invalid.push(name);
      if (!prev) out.added.push(name);
      else {
        touched.add(prev.sku);
        if (Number(prev.price) !== price) out.changed.push(`${name}: $ ${Number(prev.price).toLocaleString('es-AR')} → $ ${price.toLocaleString('es-AR')}`);
        else out.same++;
      }
    }
    if (replace) out.removed = (existing || []).filter((p) => p.sheet_row !== null && !touched.has(p.sku)).map((p) => p.name);
  }
  return out;
}

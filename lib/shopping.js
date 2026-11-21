// Lista de compras editable: constantes y funciones puras (se usan en el servidor y en el navegador).
import { num, parseNum, normName } from './format';

export const CATEGORIES = [
  { key: 'secos', label: 'Secos' },
  { key: 'frescos', label: 'Lácteos/Frescos' },
  { key: 'carnes', label: 'Carnes' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'otros', label: 'Otros' },
];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
export const categoryLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || 'Otros';

// Unidades que se entienden al escribir rápido («5 kg», «2 lts», «x30»)
const UNIT_ALIASES = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg',
  g: 'g', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g',
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  ml: 'ml', cc: 'ml',
  u: 'un', un: 'un', uni: 'un', unid: 'un', unidad: 'un', unidades: 'un',
  doc: 'doc', docena: 'doc', docenas: 'doc',
  paq: 'paq', paquete: 'paq', paquetes: 'paq',
  caja: 'caja', cajas: 'caja',
  bolsa: 'bolsa', bolsas: 'bolsa',
  maple: 'maple', maples: 'maple',
  atado: 'atado', atados: 'atado',
  lata: 'lata', latas: 'lata',
  frasco: 'frasco', frascos: 'frasco',
  rollo: 'rollo', rollos: 'rollo',
};

export function normUnitShort(u) {
  const s = normName(u).replace(/\.$/, '');
  if (!s) return '';
  return UNIT_ALIASES[s] || s.slice(0, 12);
}

// «5 kg» → { qty: 5, unit: 'kg' } · «2,5» → { qty: 2.5, unit: '' } · «x30» → { qty: 30, unit: 'un' } · «» → { qty: null, unit: '' }
export function parseQty(text) {
  const s = String(text || '').trim();
  if (!s) return { qty: null, unit: '' };
  const x = s.match(/^x\s*(\d+(?:[.,]\d+)?)$/i);
  if (x) return { qty: parseNum(x[1]), unit: 'un' };
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*([a-záéíóúñ.]*)$/i);
  if (!m) return null;
  const qty = parseNum(m[1]);
  if (qty === null || qty < 0) return null;
  return { qty, unit: normUnitShort(m[2]) };
}

// Si el nombre termina con una cantidad («Harina 0000 5 kg», «Pan de papa x30») la separa.
// Solo separa si hay una unidad conocida, para no partir nombres como «Harina 0000».
export function splitNameQty(text) {
  let s = String(text || '').trim().replace(/\s+/g, ' ');
  // Precio en cualquier lugar: «$6500», «$ 6.500», «$6.500,50»
  let est_cost = null;
  const p = s.match(/\$\s*(\d[\d.,]*)/);
  if (p) {
    est_cost = parseNum(p[1]);
    s = s.replace(p[0], ' ').replace(/\s+/g, ' ').trim();
  }
  const x = s.match(/^(.+?)\s+x\s*(\d+(?:[.,]\d+)?)$/i);
  if (x) return { name: x[1], qty: parseNum(x[2]), unit: 'un', est_cost };
  const m = s.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-záéíóúñ]+)\.?$/i);
  if (m && UNIT_ALIASES[normName(m[3])]) return { name: m[1], qty: parseNum(m[2]), unit: UNIT_ALIASES[normName(m[3])], est_cost };
  return { name: s, qty: null, unit: '', est_cost };
}

export function qtyLabel(qty, unit) {
  if (qty === null || qty === undefined || qty === '') return '';
  return `${num(qty, 2)}${unit ? ` ${unit}` : ''}`;
}

const KEYWORDS = {
  frescos: ['leche', 'crema', 'manteca', 'queso', 'cheddar', 'muzza', 'mozzarella', 'ricota', 'yogur', 'dulce de leche', 'huevo', 'maple', 'fruta', 'frutilla', 'banana', 'limon', 'naranja', 'tomate', 'lechuga', 'cebolla', 'papa', 'verdura', 'palta', 'pepino', 'levadura', 'queso crema', 'mascarpone'],
  carnes: ['carne', 'pollo', 'cerdo', 'bondiola', 'jamon', 'panceta', 'bacon', 'medallon', 'hamburguesa', 'vacio', 'molida', 'chorizo', 'salchicha', 'milanesa', 'pescado', 'atun', 'lomo', 'pechuga'],
  packaging: ['caja', 'bandeja', 'bolsa', 'film', 'papel', 'servilleta', 'vaso', 'tapa', 'envase', 'pote', 'blonda', 'cinta', 'etiqueta', 'sticker', 'cubierto', 'sorbete', 'aluminio', 'pirotin', 'packaging', 'base de torta', 'separador'],
  secos: ['harina', 'azucar', 'sal', 'cacao', 'chocolate', 'almidon', 'maicena', 'polvo de hornear', 'bicarbonato', 'avena', 'arroz', 'fideo', 'pan', 'galletita', 'coco', 'nuez', 'almendra', 'pasas', 'aceite', 'vainilla', 'esencia', 'gelatina', 'mermelada', 'sesamo', 'semilla', 'yerba', 'cafe', 'te ', 'especia', 'oregano', 'pimienta', 'pure', 'salsa', 'ketchup', 'mayonesa', 'mostaza', 'lata'],
};

export function guessCategory(name) {
  const n = ` ${normName(name)} `;
  for (const key of ['packaging', 'carnes', 'frescos', 'secos']) {
    if (KEYWORDS[key].some((k) => n.includes(` ${k}`))) return key;
  }
  return 'otros';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID.test(v);

function cleanNumber(v, max) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseNum(v);
  if (n === null || !Number.isFinite(n) || n < 0 || n > max) return undefined;
  return Math.round(n * 100) / 100;
}

const clip = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Valida un ítem completo (alta). Devuelve null si no es válido.
export function sanitizeItem(raw) {
  if (!raw || !isUuid(raw.id)) return null;
  const name = clip(raw.name, 80);
  if (!name) return null;
  const qty = cleanNumber(raw.qty, 1_000_000);
  const est_cost = cleanNumber(raw.est_cost, 1_000_000_000);
  if (qty === undefined || est_cost === undefined) return null;
  const bought = !!raw.bought;
  return {
    id: raw.id,
    name,
    qty,
    unit: qty === null ? '' : normUnitShort(raw.unit),
    category: CATEGORY_KEYS.includes(raw.category) ? raw.category : 'otros',
    est_cost,
    note: clip(raw.note, 140),
    source: raw.source === 'pedidos' ? 'pedidos' : 'manual',
    bought,
    bought_at: bought ? (raw.bought_at && !Number.isNaN(Date.parse(raw.bought_at)) ? raw.bought_at : new Date().toISOString()) : null,
  };
}

// Valida un cambio parcial (edición). Devuelve null si algún campo no es válido.
export function sanitizePatch(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  if ('name' in raw) { out.name = clip(raw.name, 80); if (!out.name) return null; }
  if ('qty' in raw) { const q = cleanNumber(raw.qty, 1_000_000); if (q === undefined) return null; out.qty = q; }
  if ('unit' in raw) out.unit = normUnitShort(raw.unit);
  if ('qty' in out && out.qty === null) out.unit = '';
  if ('category' in raw) { if (!CATEGORY_KEYS.includes(raw.category)) return null; out.category = raw.category; }
  if ('est_cost' in raw) { const c = cleanNumber(raw.est_cost, 1_000_000_000); if (c === undefined) return null; out.est_cost = c; }
  if ('note' in raw) out.note = clip(raw.note, 140);
  if ('bought' in raw) { out.bought = !!raw.bought; out.bought_at = out.bought ? new Date().toISOString() : null; }
  return Object.keys(out).length ? out : null;
}

// Convierte una fila de la lista calculada por pedidos (lib/production.js) en un ítem para agregar.
export function suggestionToItem(row, id) {
  const fromNeeded = parseQty(row.needed) || { qty: null, unit: '' };
  const byPacks = row.packs !== null && row.packs !== undefined;
  return {
    id,
    name: row.name,
    qty: byPacks ? row.packs : fromNeeded.qty,
    unit: byPacks ? 'un' : fromNeeded.unit,
    category: guessCategory(row.name),
    est_cost: row.estCost ?? null,
    note: [byPacks && row.packDesc, `necesitás ${row.needed}`, row.supplier].filter(Boolean).join(' · '),
    source: 'pedidos',
    bought: false,
    bought_at: null,
  };
}

export const sameName = (a, b) => normName(a) === normName(b);

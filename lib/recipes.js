// Recetas: carga (con rinde), importación desde Excel / Google Drive / foto, y lectura con IA.
import { normUnit } from './costs';
import { normName, parseNum } from './format';
import { parseXlsx, parseCsv } from './xlsx';

export const RECETAS_HEADER = ['Producto', 'Insumo', 'Cantidad', 'Unidad (g, kg, ml, l, u)', 'Rinde (unidades que da la receta)', 'Pasos (opcional)'];
export const MAX_RECIPE_LINES = 60;

// Ingredientes de las recetas, por UNIDAD de producto (cantidad de la receta ÷ rinde).
// Todo lo que calcula costos o compras tiene que leer por acá, así el rinde se respeta en todos lados.
export async function loadRecipeItems(db, productIds, { subRecipes = true } = {}) {
  if (!productIds || !productIds.length) return [];
  const [items, { data: products }] = await Promise.all([
    allRecipeRows(db, productIds),
    db.from('products').select('id,recipe_yield,name,bakery_id').in('id', productIds),
  ]);
  const yields = new Map((products || []).map((p) => [p.id, Number(p.recipe_yield) || 1]));
  const names = new Map((products || []).map((p) => [p.id, p.name]));
  let out = (items || []).map((it) => {
    const y = yields.get(it.product_id) || 1;
    return { ...it, product_name: names.get(it.product_id) || null, batch_qty: Number(it.qty), qty: Number(it.qty) / y };
  });
  // Sub-recetas: si un renglón se llama igual que otro producto del negocio, se traen también
  // sus renglones (hasta 2 niveles) para que la lista de compras y los costos los abran.
  if (subRecipes && products?.[0]?.bakery_id) {
    const { data: all } = await db.from('products').select('id,name').eq('bakery_id', products[0].bakery_id);
    const byName = new Map((all || []).map((p) => [normName(p.name), p.id]));
    const have = new Set(productIds);
    const subIds = [...new Set(out.map((it) => byName.get(normName(it.ingredient_name))).filter((id) => id && !have.has(id)))];
    if (subIds.length) out = out.concat(await loadRecipeItems(db, subIds, { subRecipes: false }));
  }
  return out;
}

// Supabase devuelve como máximo 1000 filas por consulta: se pide de a páginas (y de a 200 productos
// para no armar URLs gigantes con .in()).
async function allRecipeRows(db, productIds) {
  const out = [];
  for (let i = 0; i < productIds.length; i += 200) {
    const ids = productIds.slice(i, i + 200);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('recipe_items').select('*').in('product_id', ids).order('product_id').order('position').order('id').range(from, from + 999);
      if (error) throw new Error(error.message);
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

// Lleva cualquier unidad conocida (gr, kilo, cc, litro, docena…) a las de la receta: g, kg, ml, l, u.
export function toRecipeUnit(qty, unit) {
  const n = parseNum(qty);
  if (n === null || n <= 0) return null;
  const raw = normName(unit).replace(/\.$/, '');
  if (['g', 'kg', 'ml', 'l', 'u'].includes(raw)) return { qty: n, unit: raw };
  const u = normUnit(raw);
  if (!u) return null;
  if (u.base === 'u') return { qty: n * u.factor, unit: 'u' };
  if (u.factor === 1000) return { qty: n, unit: u.base === 'g' ? 'kg' : 'l' };
  return { qty: n * u.factor, unit: u.base };
}

const round3 = (n) => Math.round(n * 1000) / 1000;

// ---------- Archivo (Excel / CSV / planilla de Drive) → recetas ----------
const MATCH = [
  (h) => h === 'producto' || h.startsWith('producto') || h === 'receta' || h.startsWith('receta') || h === 'nombre del producto' || h === 'servicio' || h === 'articulo',
  (h) => h.startsWith('insumo') || h.startsWith('ingrediente') || h.startsWith('material'),
  (h) => h.startsWith('cantidad') || h === 'cant' || h === 'cant.',
  (h) => h.startsWith('unidad') || h === 'medida' || h === 'u.',
  (h) => h.startsWith('rinde') || h.startsWith('rendimiento') || h.startsWith('porciones'),
  (h) => h.startsWith('pasos') || h.startsWith('preparacion') || h.startsWith('procedimiento') || h.startsWith('notas'),
];

export function rowsToRecipes(rows) {
  let headerIdx = -1;
  let map = null;
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const headers = (rows[r] || []).map((h) => normName(h));
    const m = MATCH.map((fn) => headers.findIndex((h) => h && fn(h)));
    if (m[0] >= 0 && m[1] >= 0 && m[2] >= 0) { headerIdx = r; map = m; break; }
  }
  if (!map) throw new Error('No encontré la fila de títulos. Tiene que tener al menos «Producto», «Insumo» y «Cantidad» (y mejor «Unidad» y «Rinde»). Descargá la plantilla de recetas para ver el formato.');
  const get = (row, i) => (i >= 0 && row && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '');
  const byName = new Map();
  let current = '';
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    // El nombre del producto puede ir solo en la primera fila de cada receta (como se arma a mano en Excel).
    const prod = get(row, map[0]) || current;
    const ing = get(row, map[1]);
    if (!prod && !ing) continue;
    current = prod;
    if (!prod) continue;
    const key = normName(prod);
    if (!byName.has(key)) byName.set(key, { name: prod.slice(0, 120), yield: null, notes: '', items: [], invalid: [] });
    const rec = byName.get(key);
    const y = parseNum(get(row, map[4]));
    if (y && y > 0 && !rec.yield) rec.yield = y;
    const notes = get(row, map[5]);
    if (notes && !rec.notes) rec.notes = notes.slice(0, 6000);
    if (!ing) continue;
    const unitRaw = map[3] >= 0 ? get(row, map[3]) : '';
    const u = toRecipeUnit(get(row, map[2]), unitRaw || 'u');
    if (!u) { rec.invalid.push(`${ing} (${get(row, map[2]) || 'sin cantidad'} ${unitRaw})`.trim()); continue; }
    rec.items.push({ name: ing.slice(0, 120), qty: round3(u.qty), unit: u.unit });
  }
  const list = [...byName.values()];
  if (!list.length) throw new Error('El archivo no tiene recetas debajo de los títulos.');
  if (list.length > 300) throw new Error('Máximo 300 recetas por archivo.');
  for (const r of list) if (r.items.length > MAX_RECIPE_LINES) throw new Error(`«${r.name}» tiene más de ${MAX_RECIPE_LINES} ingredientes. Revisá que el nombre del producto esté bien en cada receta.`);
  return list;
}

// ---------- Google Drive (link compartido) ----------
export function parseDriveLink(link) {
  let u;
  try { u = new URL(String(link || '').trim()); } catch { return null; }
  if (!['docs.google.com', 'drive.google.com'].includes(u.hostname)) return null;
  const idFrom = (re) => (u.pathname.match(re) || [])[1];
  const sheet = idFrom(/\/spreadsheets\/d\/([\w-]{20,})/);
  if (sheet) {
    const gid = (u.hash.match(/gid=(\d+)/) || u.search.match(/gid=(\d+)/) || [])[1];
    return { type: 'sheet', url: `https://docs.google.com/spreadsheets/d/${sheet}/export?format=csv${gid ? `&gid=${gid}` : ''}` };
  }
  const doc = idFrom(/\/document\/d\/([\w-]{20,})/);
  if (doc) return { type: 'doc', url: `https://docs.google.com/document/d/${doc}/export?format=txt` };
  const file = idFrom(/\/file\/d\/([\w-]{20,})/) || (/^\/(open|uc)$/.test(u.pathname) ? u.searchParams.get('id') : null);
  if (file && /^[\w-]{20,}$/.test(file)) return { type: 'file', url: `https://drive.google.com/uc?export=download&id=${file}` };
  return null;
}

const NOT_SHARED = 'No pude abrir ese link. En Google Drive tocá «Compartir» → «Cualquier persona con el enlace» (lector) y volvé a pegarlo.';

// Devuelve { rows } si es una planilla, o { media: { type, data } } / { text } si hay que leerlo con IA.
export async function fetchDriveRecipe(link) {
  const d = parseDriveLink(link);
  if (!d) throw new Error('Pegá un link de Google Drive: una planilla de Google, un documento de Google, o un archivo (Excel, CSV, PDF o foto).');
  let res;
  try {
    res = await fetch(d.url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'HakkiraApp/1.0' } });
  } catch {
    throw new Error('Google Drive no respondió. Probá de nuevo en un rato.');
  }
  if (!res.ok) throw new Error(NOT_SHARED);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > 8 * 1024 * 1024) throw new Error('El archivo es muy grande (máximo 8 MB).');
  const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) throw new Error('El archivo es muy grande (máximo 8 MB).');
  if (type === 'text/html') throw new Error(NOT_SHARED);
  if (d.type === 'sheet' || type === 'text/csv') return { rows: parseCsv(buf.toString('utf8')) };
  if (d.type === 'doc' || type.startsWith('text/')) return { text: buf.toString('utf8').slice(0, 30000) };
  if (buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50) return { rows: parseXlsx(buf) };
  if (/^image\/(jpeg|png|webp|gif)$/.test(type) || type === 'application/pdf') {
    if (buf.length > 5 * 1024 * 1024) throw new Error('La foto pesa más de 5 MB. Subila desde «Foto de la receta»: ahí se achica sola.');
    return { media: { type, data: buf.toString('base64') } };
  }
  throw new Error('Ese archivo no es una planilla, un documento, un PDF ni una foto. Probá con otro.');
}

// ---------- Lectura con IA (foto, PDF o texto de una receta) ----------
// Funciona con Gemini (GEMINI_API_KEY) o con Claude (ANTHROPIC_API_KEY). Si están las dos, usa Gemini.
export const hasRecipeAI = () => !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    es_receta: { type: 'boolean', description: 'false si la imagen o el texto no tiene una receta o lista de insumos legible' },
    producto: { type: 'string', description: 'Nombre del producto final, corto (ej: «Torta de chocolate»). Vacío si no figura.' },
    rinde: { type: 'number', description: 'Cuántas unidades o porciones da la receta completa. 1 si no lo dice.' },
    ingredientes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          cantidad: { type: 'number', description: 'Cantidad en la unidad elegida, ya convertida' },
          unidad: { type: 'string', enum: ['g', 'kg', 'ml', 'l', 'u'] },
          original: { type: 'string', description: 'Cómo estaba escrito (ej: «2 tazas»)' },
          estimado: { type: 'boolean', description: 'true si convertiste una medida casera (taza, cucharada, pizca, «c/n») o adivinaste un número' },
        },
        required: ['nombre', 'cantidad', 'unidad'],
      },
    },
    pasos: { type: 'string', description: 'Pasos de preparación resumidos, uno por línea. Vacío si no hay.' },
  },
  required: ['es_receta', 'ingredientes'],
};

function recipePrompt(insumos, hint) {
  return [
    'Sos el asistente de HakkiraApp, una app para emprendedores de Argentina. Leé esta receta (puede ser manuscrita, una foto de cuaderno, una captura o un texto) y devolvé sus datos.',
    'Reglas:',
    '- Pasá cada cantidad a g, kg, ml, l o u (unidades). Huevos, latas, paquetes, frascos → u.',
    '- Medidas caseras: 1 taza harina ≈ 120 g, 1 taza azúcar ≈ 200 g, 1 taza líquido ≈ 240 ml, 1 cda ≈ 15 g o ml, 1 cdita ≈ 5 g o ml, 1 pizca ≈ 1 g. Marcalas como estimado.',
    '- «Cantidad necesaria» o «a gusto»: poné una cantidad chica razonable y marcala como estimado.',
    '- No inventes ingredientes que no estén escritos. Si un ingrediente aparece dos veces (ej. masa y relleno), sumalo en una sola línea.',
    insumos.length ? `- Si un ingrediente coincide con uno de estos insumos que ya tiene el negocio, usá exactamente ese nombre: ${insumos.slice(0, 300).join(' | ')}` : '',
    hint ? `- El producto es «${hint}».` : '',
  ].filter(Boolean).join('\n');
}

const TIMEOUT_MSG = 'No pudimos leer la receta (tardó demasiado). Probá de nuevo o con una foto más nítida.';
const FAIL_MSG = 'No pudimos leer la receta ahora. Probá de nuevo en un rato.';

// Gemini: https://ai.google.dev — modelo configurable con GEMINI_MODEL.
async function askGemini({ media, text }, prompt) {
  const parts = [];
  if (media) parts.push({ inline_data: { mime_type: media.type, data: media.data } });
  if (text) parts.push({ text: `Texto de la receta:\n"""\n${text}\n"""` });
  parts.push({ text: `${prompt}\nRespondé solo con un JSON con esta forma: ${JSON.stringify(RECIPE_SCHEMA)}` });
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const call = (withSchema) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4000, ...(withSchema ? { responseJsonSchema: RECIPE_SCHEMA } : {}) },
    }),
    signal: AbortSignal.timeout(50000),
  });
  let res;
  try {
    res = await call(true);
    // Si el modelo no acepta el esquema, se pide de nuevo solo con la instrucción del texto.
    if (res.status === 400) res = await call(false);
  } catch {
    throw new Error(TIMEOUT_MSG);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('recipe-ai gemini', res.status, body?.error?.message);
    throw new Error(FAIL_MSG);
  }
  const raw = (body?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  try {
    return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    console.error('recipe-ai gemini: respuesta no es JSON', raw.slice(0, 200));
    throw new Error(FAIL_MSG);
  }
}

async function askClaude({ media, text }, prompt) {
  const content = [];
  if (media) content.push(media.type === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: media.data } }
    : { type: 'image', source: { type: 'base64', media_type: media.type, data: media.data } });
  if (text) content.push({ type: 'text', text: `Texto de la receta:\n"""\n${text}\n"""` });
  content.push({ type: 'text', text: `${prompt}\nCargala con la herramienta guardar_receta.` });
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.RECIPE_AI_MODEL || 'claude-haiku-5-5',
        max_tokens: 3000,
        tools: [{ name: 'guardar_receta', description: 'Guarda la receta leída.', input_schema: RECIPE_SCHEMA }],
        tool_choice: { type: 'tool', name: 'guardar_receta' },
        messages: [{ role: 'user', content }],
      }),
      signal: AbortSignal.timeout(50000),
    });
  } catch {
    throw new Error(TIMEOUT_MSG);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('recipe-ai claude', res.status, body?.error?.message);
    throw new Error(FAIL_MSG);
  }
  return (body?.content || []).find((c) => c.type === 'tool_use')?.input;
}

export async function readRecipeWithAI(input, { insumos = [], hint = '' } = {}) {
  if (!hasRecipeAI()) throw new Error('La lectura de fotos todavía no está activada en esta cuenta.');
  const prompt = recipePrompt(insumos, hint);
  const out = process.env.GEMINI_API_KEY ? await askGemini(input, prompt) : await askClaude(input, prompt);
  return normalizeAIRecipe(out, hint);
}

// Deja la respuesta de la IA (de cualquier proveedor) en el formato del editor.
export function normalizeAIRecipe(out, hint = '') {
  if (!out || out.es_receta === false || !Array.isArray(out.ingredientes) || !out.ingredientes.length) {
    throw new Error('No encontramos una receta en la foto. Probá con más luz, de frente y que se lean las cantidades.');
  }
  const items = [];
  const doubts = [];
  for (const it of out.ingredientes.slice(0, MAX_RECIPE_LINES)) {
    const u = toRecipeUnit(it.cantidad, it.unidad);
    const name = String(it.nombre || '').trim().slice(0, 120);
    if (!name) continue;
    items.push({ name, qty: u ? round3(u.qty) : '', unit: u ? u.unit : 'g', estimated: !!it.estimado || !u, original: String(it.original || '').slice(0, 60) });
    if (it.estimado || !u) doubts.push(name);
  }
  return {
    name: String(out.producto || hint || '').trim().slice(0, 120),
    yield: Number(out.rinde) > 0 ? Number(out.rinde) : 1,
    notes: String(out.pasos || '').trim().slice(0, 6000),
    items,
    doubts,
  };
}

// ---------- Vista previa y aplicación de un archivo de recetas ----------
export async function previewRecipes(admin, bakery, recipes) {
  const [{ data: products }, { data: ingredients }] = await Promise.all([
    admin.from('products').select('id,name').eq('bakery_id', bakery.id).not('sheet_row', 'is', null),
    admin.from('ingredients').select('name').eq('bakery_id', bakery.id),
  ]);
  const prodByName = new Map((products || []).map((p) => [normName(p.name), p]));
  const ingNames = new Set((ingredients || []).map((i) => normName(i.name)));
  const ids = (products || []).map((p) => p.id);
  const { data: existing } = ids.length ? await admin.from('recipe_items').select('product_id').in('product_id', ids) : { data: [] };
  const withRecipe = new Set((existing || []).map((r) => r.product_id));
  const out = { total: recipes.length, replaced: [], added: [], newProducts: [], missingIngredients: [], invalid: [] };
  const missing = new Map();
  for (const r of recipes) {
    const p = prodByName.get(normName(r.name));
    if (!p) out.newProducts.push(r.name);
    else if (withRecipe.has(p.id)) out.replaced.push(r.name);
    else out.added.push(r.name);
    r.items.forEach((it) => { if (!ingNames.has(normName(it.name))) missing.set(normName(it.name), it.name); });
    r.invalid.forEach((x) => out.invalid.push(`${r.name}: ${x}`));
  }
  out.missingIngredients = [...missing.values()];
  return out;
}

export async function replaceRecipe(admin, productId, items, { recipeYield, notes } = {}) {
  const clean = items
    .map((it, i) => ({ product_id: productId, ingredient_name: String(it.name).trim().slice(0, 120), qty: Number(it.qty), unit: it.unit, position: i }))
    .filter((it) => it.ingredient_name && it.qty > 0 && ['g', 'kg', 'ml', 'l', 'u'].includes(it.unit));
  // Si hay ingredientes repetidos, se suman en una sola línea (misma unidad base).
  const merged = [];
  for (const it of clean) {
    const prev = merged.find((m) => normName(m.ingredient_name) === normName(it.ingredient_name));
    const a = prev && normUnit(prev.unit);
    const b = normUnit(it.unit);
    if (prev && a && b && a.base === b.base) prev.qty = round3((prev.qty * a.factor + it.qty * b.factor) / a.factor);
    else merged.push(it);
  }
  const patch = {};
  if (recipeYield !== undefined) patch.recipe_yield = recipeYield && recipeYield > 0 ? Math.min(recipeYield, 100000) : 1;
  if (notes !== undefined) patch.recipe_notes = notes ? String(notes).slice(0, 6000) : null;
  if (Object.keys(patch).length) {
    const { error } = await admin.from('products').update(patch).eq('id', productId);
    if (error) throw new Error(error.message);
  }
  const { error: delErr } = await admin.from('recipe_items').delete().eq('product_id', productId);
  if (delErr) throw new Error(delErr.message);
  if (merged.length) {
    const { error } = await admin.from('recipe_items').insert(merged);
    if (error) throw new Error(error.message);
  }
  return merged.length;
}

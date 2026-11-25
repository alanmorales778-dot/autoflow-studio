import { normName } from './format';

const UNITS = {
  g: { base: 'g', factor: 1 }, gr: { base: 'g', factor: 1 }, grs: { base: 'g', factor: 1 }, gramo: { base: 'g', factor: 1 }, gramos: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 }, kilo: { base: 'g', factor: 1000 }, kilos: { base: 'g', factor: 1000 }, kgs: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 }, cc: { base: 'ml', factor: 1 }, mililitros: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 }, lt: { base: 'ml', factor: 1000 }, lts: { base: 'ml', factor: 1000 }, litro: { base: 'ml', factor: 1000 }, litros: { base: 'ml', factor: 1000 },
  u: { base: 'u', factor: 1 }, un: { base: 'u', factor: 1 }, uni: { base: 'u', factor: 1 }, unidad: { base: 'u', factor: 1 }, unidades: { base: 'u', factor: 1 },
  docena: { base: 'u', factor: 12 }, docenas: { base: 'u', factor: 12 },
};

export const RECIPE_UNITS = ['g', 'kg', 'ml', 'l', 'u'];

export function normUnit(u) {
  const s = normName(u).replace(/\.$/, '');
  return UNITS[s] || null;
}

const round = (n) => Math.round(n * 100) / 100;

// Costo por unidad base (g, ml o u) de un insumo, sumando la merma: si se pierde el 10 %,
// cada gramo que llega a la receta cuesta 1/0,9 veces más.
function unitCost(ing, iu) {
  const waste = Math.min(89, Math.max(0, Number(ing.waste_percent) || 0));
  return Number(ing.price) / (Number(ing.qty) * iu.factor) / (1 - waste / 100);
}

// Una sub-receta (ej. «Relleno de dulce de leche») es un producto con receta que se usa como
// insumo de otro. Se arma un insumo virtual con su costo por unidad del rinde: si el rinde está en
// unidades sirve con «u», y si se usa por peso o volumen, el rinde se toma en g o ml.
export function subRecipeIngredient(product, costPerYieldUnit, unit) {
  const base = normUnit(unit)?.base || 'u';
  return { name: product.name, qty: 1, unit: base, price: costPerYieldUnit, error: null, virtual: true };
}

export function computeCost(items, ingredientsByName, overheadPct, marginPct) {
  if (!items || !items.length) return { cost: null, min: null, error: 'Sin receta cargada' };
  let total = 0;
  const errors = [];
  for (const it of items) {
    const ing = ingredientsByName.get(normName(it.ingredient_name));
    if (!ing) { errors.push(`falta «${it.ingredient_name}» en tu lista de insumos`); continue; }
    if (ing.error) { errors.push(`"${ing.name}": ${ing.error}`); continue; }
    const iu = normUnit(ing.unit);
    const ru = normUnit(it.unit);
    if (!iu || !ru) { errors.push(`unidad desconocida en "${it.ingredient_name}"`); continue; }
    if (iu.base !== ru.base) { errors.push(`"${ing.name}" se compra en ${ing.unit} y la receta usa ${it.unit}`); continue; }
    const perBase = unitCost(ing, iu);
    total += Number(it.qty) * ru.factor * perBase;
  }
  // Una receta con insumos faltantes o mal cargados no tiene costo confiable: mejor «sin costo»
  // que un costo parcial (o $0) que muestre márgenes falsos y esconda la venta a pérdida.
  if (errors.length) return { cost: null, min: null, error: errors.join('; ') };
  const cost = total * (1 + Number(overheadPct || 0) / 100);
  const margin = Math.min(Number(marginPct || 0), 95);
  const min = cost / (1 - margin / 100);
  return { cost: round(cost), min: round(min), error: null };
}

export function suggestedPrice(min) {
  if (!min) return null;
  return Math.ceil(min / 100) * 100;
}

export function currentMargin(price, cost) {
  if (!price || cost === null || cost === undefined) return null;
  return Math.round(((Number(price) - Number(cost)) / Number(price)) * 1000) / 10;
}

// Costo de cada insumo dentro de una receta (sin indirectos). Ignora los renglones con error:
// computeCost ya los informa.
export function costBreakdown(items, ingredientsByName) {
  const out = [];
  for (const it of items || []) {
    const ing = ingredientsByName.get(normName(it.ingredient_name));
    if (!ing || ing.error) continue;
    const iu = normUnit(ing.unit);
    const ru = normUnit(it.unit);
    if (!iu || !ru || iu.base !== ru.base) continue;
    const perBase = unitCost(ing, iu);
    const cost = Number(it.qty) * ru.factor * perBase;
    if (Number.isFinite(cost) && cost > 0) out.push({ key: normName(ing.name), name: ing.name, cost: round(cost) });
  }
  return out;
}

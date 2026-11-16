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

export function computeCost(items, ingredientsByName, overheadPct, marginPct) {
  if (!items || !items.length) return { cost: null, min: null, error: 'Sin receta cargada' };
  let total = 0;
  const errors = [];
  for (const it of items) {
    const ing = ingredientsByName.get(normName(it.ingredient_name));
    if (!ing) { errors.push(`falta el insumo "${it.ingredient_name}" en la planilla`); continue; }
    if (ing.error) { errors.push(`"${ing.name}": ${ing.error}`); continue; }
    const iu = normUnit(ing.unit);
    const ru = normUnit(it.unit);
    if (!iu || !ru) { errors.push(`unidad desconocida en "${it.ingredient_name}"`); continue; }
    if (iu.base !== ru.base) { errors.push(`"${ing.name}" se compra en ${ing.unit} y la receta usa ${it.unit}`); continue; }
    const perBase = Number(ing.price) / (Number(ing.qty) * iu.factor);
    total += Number(it.qty) * ru.factor * perBase;
  }
  const cost = total * (1 + Number(overheadPct || 0) / 100);
  const margin = Math.min(Number(marginPct || 0), 95);
  const min = cost / (1 - margin / 100);
  return { cost: round(cost), min: round(min), error: errors.length ? errors.join('; ') : null };
}

export function suggestedPrice(min) {
  if (!min) return null;
  return Math.ceil(min / 100) * 100;
}

export function currentMargin(price, cost) {
  if (!price || cost === null || cost === undefined) return null;
  return Math.round(((Number(price) - Number(cost)) / Number(price)) * 1000) / 10;
}

import { normName } from './format';
import { normUnit } from './costs';
import { isHolding } from './orders';

// Pedidos que hay que producir (confirmados o con seña pendiente vigente)
export async function productionOrders(supabase, bakeryId, from, to) {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('bakery_id', bakeryId)
    .gte('date', from)
    .lte('date', to)
    .in('status', ['pendiente_sena', 'confirmado'])
    .order('date')
    .order('slot');
  const now = new Date();
  return (data || []).filter((o) => isHolding(o, now));
}

export function groupByDay(orders) {
  const days = new Map();
  for (const o of orders) {
    if (!days.has(o.date)) days.set(o.date, new Map());
    const products = days.get(o.date);
    const key = o.product_id || o.product_name;
    if (!products.has(key)) products.set(key, { product_name: o.product_name, qty: 0, orders: [] });
    const p = products.get(key);
    p.qty += o.quantity;
    p.orders.push(o);
  }
  return [...days.entries()].map(([date, m]) => ({ date, items: [...m.values()] }));
}

function prettyQty(n, base) {
  if (base === 'g' && n >= 1000) return `${Math.round(n / 10) / 100} kg`;
  if (base === 'ml' && n >= 1000) return `${Math.round(n / 10) / 100} l`;
  return `${Math.round(n * 10) / 10} ${base}`;
}

// Lista de compras: suma de insumos de todas las recetas de los pedidos del período
export function shoppingList(orders, recipeItems, ingredients) {
  const byProduct = new Map();
  for (const it of recipeItems) {
    if (!byProduct.has(it.product_id)) byProduct.set(it.product_id, []);
    byProduct.get(it.product_id).push(it);
  }
  const ingByName = new Map(ingredients.map((i) => [normName(i.name), i]));
  const need = new Map();
  const missing = new Set();
  const warnings = new Set();
  for (const o of orders) {
    const items = o.product_id ? byProduct.get(o.product_id) : null;
    if (!items || !items.length) { missing.add(o.product_name); continue; }
    for (const it of items) {
      const ru = normUnit(it.unit);
      if (!ru) continue;
      const k = normName(it.ingredient_name);
      if (!need.has(k)) need.set(k, { name: it.ingredient_name, base: ru.base, amount: 0 });
      const n = need.get(k);
      if (n.base !== ru.base) { warnings.add(`«${it.ingredient_name}» tiene unidades distintas en dos recetas`); continue; }
      n.amount += Number(it.qty) * ru.factor * o.quantity;
    }
  }
  const rows = [...need.values()].map((n) => {
    const ing = ingByName.get(normName(n.name));
    const iu = ing && normUnit(ing.unit);
    let packs = null;
    let packLabel = null;
    let estCost = null;
    let exactCost = null;
    if (ing && !ing.error && iu && iu.base === n.base) {
      const perPack = Number(ing.qty) * iu.factor;
      packs = Math.ceil(n.amount / perPack - 1e-9);
      packLabel = `${packs} × ${ing.purchase_unit || 'unidad'} de ${ing.qty} ${ing.unit}`;
      estCost = packs * Number(ing.price);
      exactCost = (n.amount / perPack) * Number(ing.price);
    }
    return { name: ing ? ing.name : n.name, needed: prettyQty(n.amount, n.base), packs, packLabel, estCost, exactCost, supplier: ing?.supplier || '', known: !!ing };
  });
  rows.sort((a, b) => (a.supplier || 'zzz').localeCompare(b.supplier || 'zzz') || a.name.localeCompare(b.name));
  return { rows, missing: [...missing], warnings: [...warnings] };
}

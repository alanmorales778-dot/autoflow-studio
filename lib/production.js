import { normName, num } from './format';
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

export function prettyQty(n, base) {
  if (base === 'g' && n >= 1000) return `${num(n / 1000)} kg`;
  if (base === 'ml' && n >= 1000) return `${num(n / 1000)} l`;
  return `${num(n, 1)} ${base}`;
}

const wasteFactor = (ing) => 1 / (1 - Math.min(89, Math.max(0, Number(ing.waste_percent) || 0)) / 100);

// Cuánto de cada insumo lleva cada pedido. Abre sub-recetas, multiplica por la cantidad y por
// las opciones elegidas (ej. «25 cm x1.5») y suma la merma. Lo usan la lista de compras,
// la pantalla de Insumos y cada pedido, así los números coinciden en todos lados.
export function ingredientDemand(orders, recipeItems, ingredients) {
  const byProduct = new Map();
  for (const it of recipeItems) {
    if (!byProduct.has(it.product_id)) byProduct.set(it.product_id, []);
    byProduct.get(it.product_id).push(it);
  }
  const ingByName = new Map(ingredients.map((i) => [normName(i.name), i]));
  const need = new Map();
  const missing = new Set();
  const warnings = new Set();
  const factorOf = (o) => (o.options || []).reduce((f, op) => f * (Number(op.factor) > 0 ? Number(op.factor) : 1), 1);
  const productIdByName = new Map();
  for (const it of recipeItems) if (it.product_name) productIdByName.set(normName(it.product_name), it.product_id);
  const add = (o, it, mult, depth) => {
    const k = normName(it.ingredient_name);
    // Sub-receta: un renglón que es otro producto con receta se abre en sus insumos.
    const subId = !ingByName.has(k) && depth < 3 ? (productIdByName.get(k) || null) : null;
    if (subId && byProduct.get(subId)?.length) {
      const ru = normUnit(it.unit);
      const amount = Number(it.qty) * (ru ? ru.factor : 1) * mult; // unidades del rinde de la sub-receta
      for (const sub of byProduct.get(subId)) add(o, sub, amount, depth + 1);
      return;
    }
    const ru = normUnit(it.unit);
    if (!ru) return;
    if (!need.has(k)) need.set(k, { key: k, name: it.ingredient_name, base: ru.base, amount: 0, byOrder: new Map() });
    const n = need.get(k);
    if (n.base !== ru.base) { warnings.add(`«${it.ingredient_name}» tiene unidades distintas en dos recetas`); return; }
    const x = Number(it.qty) * ru.factor * mult;
    n.amount += x;
    n.byOrder.set(o.id, (n.byOrder.get(o.id) || 0) + x);
  };
  for (const o of orders) {
    const items = o.product_id ? byProduct.get(o.product_id) : null;
    if (!items || !items.length) { missing.add(o.product_name); continue; }
    for (const it of items) add(o, it, o.quantity * factorOf(o), 0);
  }
  for (const n of need.values()) {
    const ing = ingByName.get(n.key) || null;
    const iu = ing && normUnit(ing.unit);
    n.ingredient = ing;
    n.usable = !!(ing && !ing.error && iu && iu.base === n.base);
    if (n.usable) {
      // con merma hay que usar (y comprar) de más
      const f = wasteFactor(ing);
      n.amount *= f;
      for (const [id, a] of n.byOrder) n.byOrder.set(id, a * f);
      n.perPack = Number(ing.qty) * iu.factor;
    }
  }
  return { need, missing: [...missing], warnings: [...warnings] };
}

// Costo de una cantidad de insumo (en su unidad base) según el precio de la presentación.
export function amountCost(n, amount) {
  return n.usable ? (amount / n.perPack) * Number(n.ingredient.price) : null;
}

// Insumos de un pedido: [{ name, needed, amount, base, cost }]
export function orderIngredients(demand, orderId) {
  const out = [];
  for (const n of demand.need.values()) {
    const a = n.byOrder.get(orderId);
    if (!a) continue;
    out.push({ key: n.key, name: n.ingredient ? n.ingredient.name : n.name, amount: a, base: n.base, needed: prettyQty(a, n.base), cost: amountCost(n, a), known: !!n.ingredient });
  }
  return out.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

// Lista de compras: suma de insumos de todas las recetas de los pedidos del período
export function shoppingList(orders, recipeItems, ingredients) {
  const { need, missing, warnings } = ingredientDemand(orders, recipeItems, ingredients);
  const rows = [...need.values()].map((n) => {
    const ing = n.ingredient;
    let packs = null;
    let packLabel = null;
    let estCost = null;
    let exactCost = null;
    let packDesc = null;
    if (n.usable) {
      packs = Math.ceil(n.amount / n.perPack - 1e-9);
      packLabel = `${packs} × ${ing.purchase_unit || 'unidad'} de ${ing.qty} ${ing.unit}`;
      packDesc = `${ing.purchase_unit || 'unidad'} de ${ing.qty} ${ing.unit}`;
      estCost = packs * Number(ing.price);
      exactCost = amountCost(n, n.amount);
    }
    return { name: ing ? ing.name : n.name, needed: prettyQty(n.amount, n.base), packs, packLabel, packDesc, estCost, exactCost, supplier: ing?.supplier || '', known: !!ing };
  });
  rows.sort((a, b) => (a.supplier || 'zzz').localeCompare(b.supplier || 'zzz') || a.name.localeCompare(b.name));
  return { rows, missing, warnings };
}

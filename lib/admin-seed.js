// Datos de ejemplo para cuentas de prueba creadas desde /admin/pruebas.
// Usa los mismos ejemplos del rubro que el botón «Cargar ejemplo» del panel, y suma pedidos ficticios
// repartidos en los próximos días para que la agenda, compras y ganancias tengan algo que mostrar.
import { applyInsumos, applyProductos } from './catalog';
import { recomputeCosts } from './sheets';
import { rubroOf } from './rubros';
import { todayAR, addDays } from './format';

const CLIENTES = [
  ['Martina Gómez', '1155550101'],
  ['Lucas Fernández', '1155550102'],
  ['Sofía Ramírez', '1155550103'],
  ['Juan Pérez', '1155550104'],
  ['Valentina Díaz', '1155550105'],
  ['Tomás López', '1155550106'],
];

export async function seedTestBusiness(admin, bakery, { orders = true } = {}) {
  const rubro = rubroOf(bakery);
  const sample = rubro.sample;
  if (sample) {
    const { count: ingCount } = await admin.from('ingredients').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id);
    if (!ingCount) await applyInsumos(admin, bakery, sample.insumos);
    const { count: prodCount } = await admin.from('products').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id).not('sheet_row', 'is', null);
    if (!prodCount) {
      await applyProductos(admin, bakery, sample.productos);
      const { data: prods } = await admin.from('products').select('id,sku').eq('bakery_id', bakery.id).in('sku', Object.keys(sample.recipes || {}));
      const rows = [];
      for (const p of prods || []) (sample.recipes[p.sku] || []).forEach(([ingredient_name, qty, unit]) => rows.push({ product_id: p.id, ingredient_name, qty, unit }));
      if (rows.length) await admin.from('recipe_items').insert(rows);
    }
    await recomputeCosts(admin, bakery);
  }
  if (!orders) return;

  const { data: products } = await admin.from('products').select('id,name,price').eq('bakery_id', bakery.id).not('sheet_row', 'is', null).limit(5);
  if (!products?.length) return;
  const slots = bakery.slots?.length ? bakery.slots : rubro.slots || [null];
  const today = todayAR();
  // [días desde hoy, estado, cantidad]
  const plan = [[-3, 'entregado', 1], [-1, 'entregado', 2], [0, 'confirmado', 1], [1, 'pendiente_sena', 1], [2, 'confirmado', 2], [4, 'confirmado', 1], [6, 'pendiente_sena', 1], [-2, 'cancelado', 1]];
  const rows = plan.map(([d, status, qty], i) => {
    const p = products[i % products.length];
    const price = Number(p.price) || 10000;
    const total = price * qty;
    const deposit = Math.round(total * (bakery.deposit_percent ?? 50) / 100);
    const [customer_name, customer_phone] = CLIENTES[i % CLIENTES.length];
    return {
      bakery_id: bakery.id,
      product_id: p.id,
      product_name: p.name,
      quantity: qty,
      unit_price: price,
      total,
      deposit_amount: deposit,
      date: addDays(today, d),
      slot: slots[i % slots.length],
      fulfillment: 'retiro',
      customer_name,
      customer_phone,
      status,
      channel: i % 3 === 0 ? 'manual' : 'web',
      paid_at: ['confirmado', 'entregado'].includes(status) ? new Date().toISOString() : null,
      notes: 'Pedido de ejemplo (cuenta de prueba)',
    };
  });
  const { error } = await admin.from('orders').insert(rows);
  if (error) throw new Error(`pedidos de ejemplo: ${error.message}`);
}

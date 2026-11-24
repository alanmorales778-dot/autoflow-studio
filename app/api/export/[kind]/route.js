import { NextResponse } from 'next/server';
import { createClient, createAdmin } from '@/lib/supabase';
import { exportWorkbook } from '@/lib/imports';
import { writeXlsx } from '@/lib/xlsx';
import { liveCosts } from '@/lib/sheets';
import { rubroOf } from '@/lib/rubros';
import { slugify, todayAR, STATUS_LABEL } from '@/lib/format';
import { balanceDue } from '@/lib/balance';
import { RECETAS_HEADER, loadRecipeItems } from '@/lib/recipes';

export const dynamic = 'force-dynamic';

const KINDS = ['insumos', 'productos', 'pedidos', 'clientes', 'ganancias', 'recetas'];

const EJEMPLO_RECETAS = [
  ['Alfajores de maicena (docena)', 'Maicena', 300, 'g', 2, 'Batir manteca y azúcar, sumar yemas y secos. Estirar, cortar y hornear 10 min a 170 °C.'],
  ['', 'Harina 000', 200, 'g', '', ''],
  ['', 'Manteca', 200, 'g', '', ''],
  ['', 'Azúcar', 150, 'g', '', ''],
  ['', 'Huevos', 3, 'u', '', ''],
  ['', 'Dulce de leche', 500, 'g', '', ''],
  ['Torta de chocolate grande', 'Harina 000', 500, 'g', 1, ''],
  ['', 'Huevos', 6, 'u', '', ''],
  ['', 'Chocolate semiamargo', 300, 'g', '', ''],
  ['', 'Crema de leche', 200, 'ml', '', ''],
];

// Recetas: una fila por ingrediente; el producto, el rinde y los pasos van en la primera fila de cada receta.
async function recetas(admin, bakery, plantilla) {
  if (plantilla) return writeXlsx('Recetas', [RECETAS_HEADER, ...EJEMPLO_RECETAS]);
  const { data: products } = await admin.from('products').select('id,name,recipe_yield,recipe_notes').eq('bakery_id', bakery.id).not('sheet_row', 'is', null).order('sheet_row');
  const ids = (products || []).map((p) => p.id);
  const items = await loadRecipeItems(admin, ids);
  const byProduct = new Map();
  items.forEach((it) => { if (!byProduct.has(it.product_id)) byProduct.set(it.product_id, []); byProduct.get(it.product_id).push(it); });
  const rows = [];
  for (const p of products || []) {
    const list = byProduct.get(p.id) || [];
    list.forEach((it, i) => rows.push(i === 0
      ? [p.name, it.ingredient_name, it.batch_qty, it.unit, Number(p.recipe_yield) || 1, p.recipe_notes || '']
      : ['', it.ingredient_name, it.batch_qty, it.unit, '', '']));
  }
  return writeXlsx('Recetas', [RECETAS_HEADER, ...(rows.length ? rows : EJEMPLO_RECETAS)]);
}

function monthBounds(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}

// Pedidos: todos, con lo necesario para tener una copia propia.
async function pedidos(admin, bakery) {
  const T = rubroOf(bakery);
  const { data } = await admin.from('orders').select('*').eq('bakery_id', bakery.id).order('date', { ascending: false }).limit(20000);
  const head = ['Fecha', 'Horario', 'Estado', 'Cliente', 'WhatsApp', 'Producto', 'Cantidad', 'Total', 'Seña', 'Seña pagada', 'Saldo pendiente', 'Entrega', 'Dirección', T.note1.label, T.note2.label, 'Ocasión', 'Aclaraciones', 'Canal', 'Materiales'];
  const rows = (data || []).map((o) => [
    o.date, o.slot || '', STATUS_LABEL[o.status] || o.status, o.customer_name || '', o.customer_phone || '', o.product_name || '', o.quantity,
    Number(o.total) || 0, Number(o.deposit_amount) || 0, o.paid_at ? 'Sí' : 'No',
    ['confirmado', 'entregado'].includes(o.status) ? balanceDue(o) : '',
    o.fulfillment === 'envio' ? T.envio : T.retiro, o.address || '', o.dedication || '', o.allergies || '', o.occasion || '', o.notes || '', o.channel || '',
    o.material_cost ?? '',
  ]);
  return writeXlsx(T.orders, [head, ...rows]);
}

async function clientes(admin, bakery) {
  const [{ data: customers }, { data: orders }] = await Promise.all([
    admin.from('customers').select('*').eq('bakery_id', bakery.id).limit(10000),
    admin.from('orders').select('customer_id,date,total,product_name').eq('bakery_id', bakery.id).in('status', ['confirmado', 'entregado']).limit(20000),
  ]);
  const stats = new Map();
  for (const o of orders || []) {
    if (!o.customer_id) continue;
    const s = stats.get(o.customer_id) || { count: 0, spent: 0, last: '', lastProduct: '' };
    s.count += 1;
    s.spent += Number(o.total) || 0;
    if (o.date > s.last) { s.last = o.date; s.lastProduct = o.product_name || ''; }
    stats.set(o.customer_id, s);
  }
  const head = ['Nombre', 'WhatsApp', 'Email', 'Compras', 'Total gastado', 'Última compra', 'Último producto', 'Notas'];
  const rows = (customers || [])
    .map((c) => ({ c, s: stats.get(c.id) || { count: 0, spent: 0, last: '', lastProduct: '' } }))
    .sort((a, b) => b.s.spent - a.s.spent)
    .map(({ c, s }) => [c.name || '', c.phone || '', c.email || '', s.count, s.spent, s.last, s.lastProduct, c.notes || '']);
  return writeXlsx('Clientes', [head, ...rows]);
}

async function ganancias(admin, bakery, ym) {
  const T = rubroOf(bakery);
  const { from, to } = monthBounds(ym);
  const [{ data: orders }, live] = await Promise.all([
    admin.from('orders').select('product_id,product_name,quantity,total,material_cost').eq('bakery_id', bakery.id).gte('date', from).lte('date', to).in('status', ['confirmado', 'entregado']).limit(10000),
    liveCosts(admin, bakery),
  ]);
  const costById = new Map([...live].map(([id, c]) => [id, c.cost]));
  const rows = new Map();
  for (const o of orders || []) {
    const k = o.product_id || o.product_name;
    const r = rows.get(k) || { name: o.product_name, units: 0, revenue: 0, cost: 0, known: true };
    r.units += o.quantity;
    r.revenue += Number(o.total) || 0;
    const c = o.material_cost !== null && o.material_cost !== undefined ? Number(o.material_cost) / Math.max(1, o.quantity) : o.product_id ? costById.get(o.product_id) : null;
    if (c === null || c === undefined) r.known = false; else r.cost += Number(c) * o.quantity;
    rows.set(k, r);
  }
  const list = [...rows.values()].sort((a, b) => b.revenue - a.revenue);
  const head = [T.items === 'Servicios' ? 'Servicio' : 'Producto', 'Unidades', 'Ventas', 'Costo', 'Ganancia', 'Margen %'];
  const body = list.map((r) => [r.name, r.units, r.revenue, r.known ? Math.round(r.cost) : 'sin costo', r.known ? Math.round(r.revenue - r.cost) : '', r.known && r.revenue ? Math.round(((r.revenue - r.cost) / r.revenue) * 1000) / 10 : '']);
  const known = list.filter((r) => r.known);
  const tRev = list.reduce((s, r) => s + r.revenue, 0);
  const tCost = known.reduce((s, r) => s + r.cost, 0);
  const kRev = known.reduce((s, r) => s + r.revenue, 0);
  body.push([]);
  body.push(['TOTAL', list.reduce((s, r) => s + r.units, 0), tRev, Math.round(tCost), Math.round(kRev - tCost), kRev ? Math.round(((kRev - tCost) / kRev) * 1000) / 10 : '']);
  return writeXlsx(`Ganancias ${ym}`, [head, ...body]);
}

export async function GET(request, { params }) {
  const { kind } = await params;
  if (!KINDS.includes(kind)) return new NextResponse('No encontrado', { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));
  const { data: bakery } = await supabase.from('bakeries').select('*').eq('owner_id', user.id).maybeSingle();
  if (!bakery) return NextResponse.redirect(new URL('/app', request.url));
  const admin = createAdmin();
  const biz = slugify(bakery.name) || 'autoflow';
  const today = todayAR();
  let buf;
  let filename;
  if (kind === 'pedidos') { buf = await pedidos(admin, bakery); filename = `${slugify(rubroOf(bakery).orders)}-${biz}-${today}.xlsx`; }
  else if (kind === 'clientes') { buf = await clientes(admin, bakery); filename = `clientes-${biz}-${today}.xlsx`; }
  else if (kind === 'recetas') {
    const plantilla = new URL(request.url).searchParams.get('plantilla') === '1';
    buf = await recetas(admin, bakery, plantilla);
    filename = plantilla ? 'plantilla-recetas-autoflow.xlsx' : `recetas-${biz}-${today}.xlsx`;
  }
  else if (kind === 'ganancias') {
    const mes = new URL(request.url).searchParams.get('mes');
    const ym = /^\d{4}-\d{2}$/.test(mes || '') ? mes : today.slice(0, 7);
    buf = await ganancias(admin, bakery, ym);
    filename = `ganancias-${ym}-${biz}.xlsx`;
  } else {
    buf = await exportWorkbook(admin, bakery, kind);
    filename = `${kind === 'insumos' ? 'insumos' : 'productos-y-stock'}-${biz}.xlsx`;
  }
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

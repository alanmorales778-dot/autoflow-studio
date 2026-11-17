'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getContext, requireBakery } from '@/lib/session';
import { createAdmin, createClient } from '@/lib/supabase';
import { encrypt } from '@/lib/crypto';
import { slugify, parseNum } from '@/lib/format';
import { syncBakery, recomputeCosts, pushStockToSheet, writeCells, EXAMPLE_INSUMOS, EXAMPLE_PRODUCTOS, EXAMPLE_RECIPES } from '@/lib/sheets';
import { applyInsumos, applyProductos } from '@/lib/catalog';
import { setOrderStatus } from '@/lib/lifecycle';
import { createOrder } from '@/lib/orders';
import { testToken, createPreapproval } from '@/lib/mp';
import { suggestedPrice, RECIPE_UNITS } from '@/lib/costs';
import { PRICES } from '@/lib/modules';
import { appUrl } from '@/lib/env';
import { parseUpload } from '@/lib/xlsx';
import { importRows } from '@/lib/imports';
import { parseOptionsText } from '@/lib/options';
import { markBalancePaid } from '@/lib/balance';
import { createCustomerSubscription, changeSubscriptionStatus, generateRecurringOrders } from '@/lib/recurring';

function back(path, { error, ok } = {}) {
  const p = new URLSearchParams();
  if (error) p.set('error', String(error).slice(0, 300));
  if (ok) p.set('ok', String(ok).slice(0, 300));
  const qs = p.toString();
  redirect(qs ? `${path}?${qs}` : path);
}

const str = (fd, k) => String(fd.get(k) ?? '').trim();

// ---------- Onboarding ----------
export async function createBakery(fd) {
  const { supabase, user, bakery } = await getContext();
  if (bakery) redirect('/app');
  const name = str(fd, 'name');
  const slug = slugify(str(fd, 'slug') || name);
  if (!name) back('/app', { error: 'Poné el nombre de tu emprendimiento.' });
  if (slug.length < 3) back('/app', { error: 'El link tiene que tener al menos 3 letras.' });
  const { error } = await supabase.from('bakeries').insert({ owner_id: user.id, name, slug, whatsapp_contact: str(fd, 'whatsapp') || null });
  if (error) back('/app', { error: error.code === '23505' ? 'Ese link ya está en uso, elegí otro.' : error.message });
  back('/app', { ok: '¡Listo! Seguí los primeros pasos de abajo para empezar a tomar pedidos.' });
}

// Carga dos productos con receta e insumos de ejemplo para ver la app funcionando antes de cargar los propios.
export async function loadExampleData() {
  const { bakery } = await requireBakery();
  const admin = createAdmin();
  const { count } = await admin.from('products').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id).not('sheet_row', 'is', null);
  if (count) back('/app', { error: 'Ya tenés productos cargados.' });
  if (bakery.sheet_productos_id) back('/app', { error: 'Tus productos vienen de Google Drive: editalos en tu planilla.' });
  let err = null;
  try {
    const { count: ingCount } = await admin.from('ingredients').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id);
    if (!ingCount) await applyInsumos(admin, bakery, EXAMPLE_INSUMOS);
    await applyProductos(admin, bakery, EXAMPLE_PRODUCTOS);
    const { data: prods } = await admin.from('products').select('id,sku').eq('bakery_id', bakery.id).in('sku', Object.keys(EXAMPLE_RECIPES));
    const rows = [];
    for (const p of prods || []) {
      const { count: rc } = await admin.from('recipe_items').select('id', { count: 'exact', head: true }).eq('product_id', p.id);
      if (!rc) EXAMPLE_RECIPES[p.sku].forEach(([ingredient_name, qty, unit]) => rows.push({ product_id: p.id, ingredient_name, qty, unit }));
    }
    if (rows.length) await admin.from('recipe_items').insert(rows);
    await recomputeCosts(admin, bakery);
  } catch (e) {
    err = e.message;
  }
  revalidatePath('/app', 'layout');
  back('/app', err ? { error: err } : { ok: 'Cargamos 2 productos de ejemplo con receta. Cambiales nombre y precio, o reemplazalos subiendo tu planilla en Productos.' });
}

export async function dismissOnboarding() {
  const { supabase, bakery } = await requireBakery();
  await supabase.from('bakeries').update({ onboarding_dismissed_at: new Date().toISOString() }).eq('id', bakery.id);
  revalidatePath('/app');
  back('/app');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

// ---------- Configuración ----------
export async function saveSettings(fd) {
  const { supabase, bakery } = await requireBakery();
  const slots = str(fd, 'slots').split(/\n|,/).map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const patch = {
    name: str(fd, 'name') || bakery.name,
    slug: slugify(str(fd, 'slug')) || bakery.slug,
    whatsapp_contact: str(fd, 'whatsapp_contact') || null,
    pickup_address: str(fd, 'pickup_address') || null,
    delivery_enabled: fd.get('delivery_enabled') === 'on',
    deposit_percent: Math.min(100, Math.max(0, Math.round(parseNum(str(fd, 'deposit_percent')) ?? 50))),
    hold_minutes: Math.min(1440, Math.max(5, Math.round(parseNum(str(fd, 'hold_minutes')) ?? 30))),
    margin_percent: Math.min(90, Math.max(0, parseNum(str(fd, 'margin_percent')) ?? 40)),
    overhead_percent: Math.min(200, Math.max(0, parseNum(str(fd, 'overhead_percent')) ?? 10)),
    min_days_ahead: Math.min(60, Math.max(0, Math.round(parseNum(str(fd, 'min_days_ahead')) ?? 1))),
    max_days_ahead: Math.min(120, Math.max(1, Math.round(parseNum(str(fd, 'max_days_ahead')) ?? 21))),
    slots: slots.length ? slots : bakery.slots,
  };
  const { error } = await supabase.from('bakeries').update(patch).eq('id', bakery.id);
  if (error) back('/app/configuracion', { error: error.code === '23505' ? 'Ese link ya está en uso.' : error.message });
  if (patch.margin_percent !== Number(bakery.margin_percent) || patch.overhead_percent !== Number(bakery.overhead_percent)) {
    const admin = createAdmin();
    await recomputeCosts(admin, { ...bakery, ...patch });
    await pushStockToSheet(admin, { ...bakery, ...patch }, null);
  }
  revalidatePath('/app', 'layout');
  back('/app/configuracion', { ok: 'Configuración guardada.' });
}

export async function addCapacity(fd) {
  const { supabase, bakery } = await requireBakery();
  const category = str(fd, 'category') || '*';
  const max = Math.max(0, Math.round(parseNum(str(fd, 'max_units')) ?? 0));
  const wd = str(fd, 'weekday');
  const days = wd === 'all' ? [0, 1, 2, 3, 4, 5, 6] : [Number(wd)];
  const rows = days.map((weekday) => ({ bakery_id: bakery.id, category, weekday, max_units: max }));
  const { error } = await supabase.from('capacity_rules').upsert(rows, { onConflict: 'bakery_id,category,weekday' });
  if (error) back('/app/configuracion', { error: error.message });
  back('/app/configuracion', { ok: 'Cupo guardado.' });
}

export async function deleteCapacity(fd) {
  const { supabase } = await requireBakery();
  await supabase.from('capacity_rules').delete().eq('id', str(fd, 'id'));
  back('/app/configuracion');
}

export async function addBlocked(fd) {
  const { supabase, bakery } = await requireBakery();
  const date = str(fd, 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) back('/app/configuracion', { error: 'Fecha inválida.' });
  await supabase.from('blocked_dates').upsert({ bakery_id: bakery.id, date });
  back('/app/configuracion', { ok: 'Fecha bloqueada.' });
}

export async function deleteBlocked(fd) {
  const { supabase, bakery } = await requireBakery();
  await supabase.from('blocked_dates').delete().eq('bakery_id', bakery.id).eq('date', str(fd, 'date'));
  back('/app/configuracion');
}

export async function saveMpToken(fd) {
  const { supabase, bakery } = await requireBakery();
  const token = str(fd, 'mp_token');
  if (!token) back('/app/configuracion', { error: 'Pegá tu Access Token de producción.' });
  let msg = null;
  let nick = '';
  try {
    const me = await testToken(token);
    nick = me.nickname || me.email || '';
  } catch (e) {
    msg = 'Mercado Pago rechazó ese token. Revisá que sea el Access Token de PRODUCCIÓN.';
  }
  if (msg) back('/app/configuracion', { error: msg });
  await supabase.from('bakeries').update({ mp_access_token_enc: encrypt(token) }).eq('id', bakery.id);
  back('/app/configuracion', { ok: `Mercado Pago conectado${nick ? ` (${nick})` : ''}.` });
}

export async function removeMpToken() {
  const { supabase, bakery } = await requireBakery();
  await supabase.from('bakeries').update({ mp_access_token_enc: null }).eq('id', bakery.id);
  back('/app/configuracion', { ok: 'Mercado Pago desconectado.' });
}

export async function saveWhatsapp(fd) {
  const { supabase, bakery } = await requireBakery();
  const phoneId = str(fd, 'wa_phone_number_id');
  const token = str(fd, 'wa_token');
  const secret = str(fd, 'wa_app_secret');
  const patch = { wa_phone_number_id: phoneId || null };
  if (token) patch.wa_token_enc = encrypt(token);
  if (secret) patch.wa_app_secret_enc = encrypt(secret);
  if (!phoneId) Object.assign(patch, { wa_token_enc: null, wa_app_secret_enc: null });
  const { error } = await supabase.from('bakeries').update(patch).eq('id', bakery.id);
  if (error) back('/app/configuracion', { error: error.code === '23505' ? 'Ese número ya está conectado a otra cuenta.' : error.message });
  back('/app/configuracion', { ok: phoneId ? 'WhatsApp guardado.' : 'WhatsApp desconectado.' });
}

export async function disconnectGoogle() {
  const { supabase, bakery } = await requireBakery();
  await supabase
    .from('bakeries')
    .update({ google_refresh_token_enc: null, google_email: null, sheet_insumos_id: null, sheet_productos_id: null, sheet_insumos_modified: null, sheet_productos_modified: null })
    .eq('id', bakery.id);
  back('/app/configuracion', { ok: 'Google Drive desconectado. Tus planillas siguen en tu Drive.' });
}

export async function syncNow(fd) {
  const { bakery } = await requireBakery();
  const to = str(fd, 'back') || '/app/insumos';
  const r = await syncBakery(createAdmin(), bakery, { force: true });
  revalidatePath('/app', 'layout');
  if (r.error) back(to, { error: `No se pudo sincronizar: ${r.error}` });
  if (r.skipped) back(to, { error: 'Primero conectá Google Drive en Configuración.' });
  back(to, { ok: 'Planillas sincronizadas.' });
}

export async function importFile(fd) {
  const { bakery } = await requireBakery();
  const kind = str(fd, 'kind') === 'insumos' ? 'insumos' : 'productos';
  const to = kind === 'insumos' ? '/app/insumos' : '/app/productos';
  let msg = null;
  let err = null;
  try {
    const rows = await parseUpload(fd.get('file'));
    const r = await importRows(createAdmin(), bakery, kind, rows);
    msg = `Listo: ${r.count} ${kind === 'insumos' ? 'insumos' : 'productos'} actualizados${r.drive ? ' (también en tu planilla de Google Drive)' : ''}.${r.errors ? ` Hay ${r.errors} con datos para revisar.` : ''}`;
  } catch (e) {
    err = e.message;
  }
  revalidatePath('/app', 'layout');
  back(to, err ? { error: err } : { ok: msg });
}

// ---------- Pedidos ----------
export async function changeOrderStatus(fd) {
  const { bakery } = await requireBakery();
  const status = str(fd, 'status');
  if (!['confirmado', 'entregado', 'cancelado'].includes(status)) back('/app/pedidos');
  let err = null;
  try {
    await setOrderStatus(createAdmin(), bakery, str(fd, 'id'), status);
  } catch (e) {
    err = e.message;
  }
  revalidatePath('/app', 'layout');
  back(str(fd, 'back') || '/app/pedidos', err ? { error: err } : { ok: 'Pedido actualizado.' });
}

export async function createManualOrder(fd) {
  const { bakery } = await requireBakery();
  const admin = createAdmin();
  const { data: product } = await admin.from('products').select('*').eq('id', str(fd, 'product_id')).eq('bakery_id', bakery.id).maybeSingle();
  if (!product) back('/app/pedidos', { error: 'Elegí un producto.' });
  let err = null;
  try {
    await createOrder(admin, bakery, product, {
      quantity: str(fd, 'quantity'),
      date: str(fd, 'date'),
      slot: str(fd, 'slot'),
      fulfillment: str(fd, 'fulfillment'),
      address: str(fd, 'address'),
      customer_name: str(fd, 'customer_name'),
      customer_phone: str(fd, 'customer_phone'),
      notes: str(fd, 'notes'),
      dedication: str(fd, 'dedication'),
      allergies: str(fd, 'allergies'),
      channel: 'manual',
      deposit_paid: fd.get('deposit_paid') === 'on',
      force: fd.get('force') === 'on',
    });
    await pushStockToSheet(admin, bakery, [product.id]);
  } catch (e) {
    err = e.message;
  }
  revalidatePath('/app', 'layout');
  back('/app/pedidos', err ? { error: err } : { ok: 'Pedido cargado.' });
}

// ---------- Recetas y precios ----------
export async function addRecipeItem(fd) {
  const { supabase, bakery, access } = await requireBakery();
  const productId = str(fd, 'product_id');
  const path = `/app/productos/${productId}`;
  if (!access.costs) back(path, { error: 'Activá el módulo de Costos para cargar recetas.' });
  const qty = parseNum(str(fd, 'qty'));
  const unit = str(fd, 'unit');
  const name = str(fd, 'ingredient_name');
  if (!name || !qty || qty <= 0 || !RECIPE_UNITS.includes(unit)) back(path, { error: 'Completá insumo, cantidad y unidad.' });
  const { error } = await supabase.from('recipe_items').insert({ product_id: productId, ingredient_name: name, qty, unit });
  if (error) back(path, { error: error.message });
  const admin = createAdmin();
  await recomputeCosts(admin, bakery, [productId]);
  await pushStockToSheet(admin, bakery, [productId]);
  back(path, { ok: 'Ingrediente agregado.' });
}

export async function deleteRecipeItem(fd) {
  const { supabase, bakery } = await requireBakery();
  const productId = str(fd, 'product_id');
  await supabase.from('recipe_items').delete().eq('id', str(fd, 'id'));
  const admin = createAdmin();
  await recomputeCosts(admin, bakery, [productId]);
  await pushStockToSheet(admin, bakery, [productId]);
  back(`/app/productos/${productId}`);
}

export async function applySuggestedPrice(fd) {
  const { supabase, bakery } = await requireBakery();
  const id = str(fd, 'id');
  const backTo = str(fd, 'back') || '/app/productos';
  const { data: p } = await supabase.from('products').select('*').eq('id', id).single();
  const price = suggestedPrice(p?.min_price);
  if (!p || !price) back(backTo, { error: 'Ese producto no tiene precio mínimo calculado.' });
  await supabase.from('products').update({ price }).eq('id', id);
  let err = null;
  if (p.sheet_row && bakery.google_refresh_token_enc) {
    try {
      await writeCells(bakery, [{ range: `Productos!D${p.sheet_row}`, values: [[price]] }]);
      await pushStockToSheet(createAdmin(), bakery, [id]);
    } catch (e) {
      err = `Se actualizó en AutoFlow pero no en la planilla: ${e.message}`;
    }
  }
  revalidatePath('/app', 'layout');
  back(backTo, err ? { error: err } : { ok: `Nuevo precio de ${p.name}: $${price.toLocaleString('es-AR')}` });
}

// ---------- Personalización y suscripción por producto ----------
export async function saveProductSettings(fd) {
  const { supabase, bakery } = await requireBakery();
  const id = str(fd, 'id');
  const options = parseOptionsText(str(fd, 'options'));
  const { error } = await supabase
    .from('products')
    .update({ options, allow_subscription: fd.get('allow_subscription') === 'on' })
    .eq('id', id)
    .eq('bakery_id', bakery.id);
  back(`/app/productos/${id}`, error ? { error: error.message } : { ok: `Guardado: ${options.length} grupos de opciones.` });
}

// ---------- Saldo ----------
export async function markBalance(fd) {
  const { bakery } = await requireBakery();
  const admin = createAdmin();
  const { data: order } = await admin.from('orders').select('id').eq('id', str(fd, 'id')).eq('bakery_id', bakery.id).maybeSingle();
  if (order) await markBalancePaid(admin, order.id);
  revalidatePath('/app', 'layout');
  back(str(fd, 'back') || '/app/pedidos', { ok: 'Saldo marcado como cobrado.' });
}

// ---------- Suscripciones de clientes ----------
export async function changeCustomerSubscription(fd) {
  const { bakery } = await requireBakery();
  const status = str(fd, 'status');
  let err = null;
  if (!['activa', 'pausada', 'cancelada'].includes(status)) back('/app/suscripciones');
  try {
    await changeSubscriptionStatus(createAdmin(), bakery, str(fd, 'id'), status);
  } catch (e) {
    err = e.message;
  }
  back('/app/suscripciones', err ? { error: err } : { ok: 'Suscripción actualizada.' });
}

export async function createManualSubscription(fd) {
  const { bakery, access } = await requireBakery();
  if (!access.recurring) back('/app/suscripciones', { error: 'Activá el módulo de Pedidos recurrentes.' });
  const admin = createAdmin();
  const { data: product } = await admin.from('products').select('*').eq('id', str(fd, 'product_id')).eq('bakery_id', bakery.id).maybeSingle();
  if (!product) back('/app/suscripciones', { error: 'Elegí un producto.' });
  let err = null;
  try {
    await createCustomerSubscription(admin, bakery, product, {
      quantity: str(fd, 'quantity'),
      frequency_days: str(fd, 'frequency_days'),
      weekday: str(fd, 'weekday'),
      slot: str(fd, 'slot'),
      fulfillment: str(fd, 'fulfillment'),
      address: str(fd, 'address'),
      customer_name: str(fd, 'customer_name'),
      customer_phone: str(fd, 'customer_phone'),
      notes: str(fd, 'notes'),
      manual: true,
      activate: true,
    });
    await generateRecurringOrders(admin);
  } catch (e) {
    err = e.message;
  }
  revalidatePath('/app', 'layout');
  back('/app/suscripciones', err ? { error: err } : { ok: 'Suscripción creada. Los pedidos se generan solos cada semana.' });
}

// ---------- Plan ----------
export async function subscribe(fd) {
  const { user, bakery } = await requireBakery();
  if (!process.env.MP_PLATFORM_ACCESS_TOKEN) back('/app/plan', { error: 'Los pagos de suscripción todavía no están habilitados. Escribinos para activarla.' });
  const costs = fd.get('costs') === 'on';
  const wa = fd.get('whatsapp') === 'on';
  const rec = fd.get('recurring') === 'on';
  const amount = PRICES.base + (costs ? PRICES.costs : 0) + (wa ? PRICES.whatsapp : 0) + (rec ? PRICES.recurring : 0);
  const modules = ['Base', costs && 'Costos y producción', wa && 'WhatsApp', rec && 'Pedidos recurrentes'].filter(Boolean).join(' + ');
  let url = null;
  let err = null;
  try {
    const pre = await createPreapproval(process.env.MP_PLATFORM_ACCESS_TOKEN, {
      reason: `AutoFlow Cocina – ${modules}`,
      amount,
      payerEmail: user.email,
      externalReference: `${bakery.id}|${costs ? 1 : 0}|${wa ? 1 : 0}|${rec ? 1 : 0}`,
      backUrl: `${appUrl()}/app/plan`,
    });
    await createAdmin().from('subscriptions').update({ mp_preapproval_id: pre.id, amount, updated_at: new Date().toISOString() }).eq('bakery_id', bakery.id);
    url = pre.init_point;
  } catch (e) {
    err = e.message;
  }
  if (err) back('/app/plan', { error: err });
  redirect(url);
}

'use server';

import crypto from 'node:crypto';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getContext, requireBakery } from '@/lib/session';
import { createAdmin, createClient } from '@/lib/supabase';
import { encrypt } from '@/lib/crypto';
import { slugify, parseNum, todayAR, pct } from '@/lib/format';
import { syncBakery, recomputeCosts, pushStockToSheet, writeCells, EXAMPLE_INSUMOS, EXAMPLE_PRODUCTOS, EXAMPLE_RECIPES } from '@/lib/sheets';
import { applyInsumos, applyProductos } from '@/lib/catalog';
import { setOrderStatus } from '@/lib/lifecycle';
import { createOrder, capacityMap } from '@/lib/orders';
import { upsertCustomer, normPhone } from '@/lib/customers';
import { testToken, createPreapproval } from '@/lib/mp';
import { suggestedPrice, RECIPE_UNITS, normUnit } from '@/lib/costs';
import { PRICES } from '@/lib/modules';
import { appUrl } from '@/lib/env';
import { parseUpload } from '@/lib/xlsx';
import { importRows, previewImport } from '@/lib/imports';
import { parseOptionsText } from '@/lib/options';
import { markBalancePaid } from '@/lib/balance';
import { newCalendarToken } from '@/lib/ics';
import { rubroOf, RUBROS } from '@/lib/rubros';
import { createCustomerSubscription, changeSubscriptionStatus, generateRecurringOrders } from '@/lib/recurring';

function back(path, { error, ok } = {}) {
  const p = new URLSearchParams();
  if (error) p.set('error', String(error).slice(0, 300));
  if (ok) p.set('ok', String(ok).slice(0, 300));
  const qs = p.toString();
  // El mensaje va antes del #ancla: si queda después, el navegador no lo lee y no se ve el aviso.
  const [base, hash] = String(path).split('#');
  redirect(qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}${hash ? `#${hash}` : ''}` : path);
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
  const rubro = rubroOf(str(fd, 'business_type'));
  const { error } = await supabase.from('bakeries').insert({ owner_id: user.id, name, slug, whatsapp_contact: str(fd, 'whatsapp') || null, business_type: rubro.key, slots: rubro.slots, slot_capacity: rubro.slotCapacity || null });
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
    const sample = rubroOf(bakery).sample;
    if (!ingCount) await applyInsumos(admin, bakery, sample.insumos);
    await applyProductos(admin, bakery, sample.productos);
    const { data: prods } = await admin.from('products').select('id,sku').eq('bakery_id', bakery.id).in('sku', Object.keys(sample.recipes));
    const rows = [];
    for (const p of prods || []) {
      const { count: rc } = await admin.from('recipe_items').select('id', { count: 'exact', head: true }).eq('product_id', p.id);
      if (!rc) sample.recipes[p.sku].forEach(([ingredient_name, qty, unit]) => rows.push({ product_id: p.id, ingredient_name, qty, unit }));
    }
    if (rows.length) await admin.from('recipe_items').insert(rows);
    await recomputeCosts(admin, bakery);
  } catch (e) {
    err = e.message;
  }
  revalidatePath('/app', 'layout');
  back('/app', err ? { error: err } : { ok: `Cargamos 2 ${rubroOf(bakery).items.toLowerCase()} de ejemplo con sus ${rubroOf(bakery).insumos.toLowerCase()}. Cambiales nombre y precio, o reemplazalos subiendo tu planilla.` });
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
    manual_hold_hours: Math.min(168, Math.max(0, Math.round(parseNum(str(fd, 'manual_hold_hours')) ?? 24))),
    margin_percent: Math.min(90, Math.max(0, parseNum(str(fd, 'margin_percent')) ?? 40)),
    overhead_percent: Math.min(200, Math.max(0, parseNum(str(fd, 'overhead_percent')) ?? 10)),
    min_days_ahead: Math.min(60, Math.max(0, Math.round(parseNum(str(fd, 'min_days_ahead')) ?? 1))),
    max_days_ahead: Math.min(120, Math.max(1, Math.round(parseNum(str(fd, 'max_days_ahead')) ?? 21))),
    slots: slots.length ? slots : bakery.slots,
    business_type: fd.get('business_type') ? rubroOf(str(fd, 'business_type')).key : rubroOf(bakery).key,
    slot_capacity: fd.has('slot_capacity') ? (Math.round(parseNum(str(fd, 'slot_capacity')) || 0) >= 1 ? Math.min(100, Math.round(parseNum(str(fd, 'slot_capacity')))) : null) : bakery.slot_capacity ?? null,
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

export async function saveNotifications(fd) {
  const { supabase, bakery } = await requireBakery();
  const email = str(fd, 'notify_email').toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) back('/app/configuracion#avisos', { error: 'Revisá el email de los avisos.' });
  const { error } = await supabase.from('bakeries').update({ notify_orders: fd.get('notify_orders') === 'on', notify_email: email || null }).eq('id', bakery.id);
  if (error) back('/app/configuracion#avisos', { error: error.message });
  revalidatePath('/app/configuracion');
  back('/app/configuracion', { ok: 'Avisos guardados.' });
}

// Enlace privado del calendario (.ics). Crearlo o regenerarlo invalida el anterior.
export async function rotateCalendarToken() {
  const { supabase, bakery } = await requireBakery();
  const { error } = await supabase.from('bakeries').update({ calendar_token: newCalendarToken() }).eq('id', bakery.id);
  if (error) back('/app/configuracion#calendario', { error: error.message });
  revalidatePath('/app/configuracion');
  back('/app/configuracion', { ok: bakery.calendar_token ? 'Enlace regenerado: el anterior dejó de funcionar.' : 'Enlace de calendario creado.' });
}

export async function disableCalendar() {
  const { supabase, bakery } = await requireBakery();
  const { error } = await supabase.from('bakeries').update({ calendar_token: null }).eq('id', bakery.id);
  if (error) back('/app/configuracion', { error: error.message });
  revalidatePath('/app/configuracion');
  back('/app/configuracion', { ok: 'Calendario desactivado.' });
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
  let id = null;
  let err = null;
  try {
    const file = fd.get('file');
    const rows = await parseUpload(file);
    const replace = fd.get('replace') === 'on';
    const admin = createAdmin();
    await previewImport(admin, bakery, kind, rows, { replace }); // valida antes de guardar
    await admin.from('import_previews').delete().eq('bakery_id', bakery.id).lt('created_at', new Date(Date.now() - 86400000).toISOString());
    const { data, error } = await admin.from('import_previews').insert({ bakery_id: bakery.id, kind, rows, replace, file_name: String(file?.name || '').slice(0, 120) || null }).select('id').single();
    if (error) throw error;
    id = data.id;
  } catch (e) {
    err = e.message;
  }
  if (err) back(to, { error: err });
  redirect(`${to}?vista=${id}#importar`);
}

export async function applyImport(fd) {
  const { bakery } = await requireBakery();
  const admin = createAdmin();
  const { data: pv } = await admin.from('import_previews').select('*').eq('id', str(fd, 'id')).eq('bakery_id', bakery.id).maybeSingle();
  if (!pv) back('/app/insumos', { error: 'La vista previa venció. Volvé a subir el archivo.' });
  const kind = pv.kind;
  const to = kind === 'insumos' ? '/app/insumos' : '/app/productos';
  let msg = null;
  let err = null;
  try {
    const r = await importRows(admin, bakery, kind, pv.rows, { replace: pv.replace });
    const noun = kind === 'insumos' ? 'insumos' : 'productos';
    const gone = r.removed ? ` Se ${kind === 'insumos' ? 'borraron' : 'ocultaron'} ${r.removed} que no estaban en el archivo.` : pv.replace || r.drive ? '' : ' Lo que no estaba en el archivo quedó igual.';
    msg = `Listo: ${r.count} ${noun} actualizados${r.drive ? ' (también en tu planilla de Google Drive)' : ''}.${gone}${r.errors ? ` Hay ${r.errors} con datos para revisar.` : ''}`;
    await admin.from('import_previews').delete().eq('id', pv.id);
  } catch (e) {
    err = e.message;
  }
  revalidatePath('/app', 'layout');
  back(to, err ? { error: err } : { ok: msg });
}

export async function discardImport(fd) {
  const { bakery } = await requireBakery();
  const kind = str(fd, 'kind') === 'insumos' ? 'insumos' : 'productos';
  await createAdmin().from('import_previews').delete().eq('id', str(fd, 'id')).eq('bakery_id', bakery.id);
  back(kind === 'insumos' ? '/app/insumos' : '/app/productos', { ok: 'Importación cancelada: no se cambió nada.' });
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

// ---------- Productos e insumos desde la pantalla (sin planilla) ----------
async function nextSheetRow(admin, table, bakeryId) {
  const { data } = await admin.from(table).select('sheet_row').eq('bakery_id', bakeryId).not('sheet_row', 'is', null).order('sheet_row', { ascending: false }).limit(1);
  return Math.max(2, (data?.[0]?.sheet_row || 1) + 1);
}

const todayLabel = () => todayAR().split('-').reverse().join('/');

export async function createProduct(fd) {
  const { bakery } = await requireBakery();
  const T = rubroOf(bakery);
  if (bakery.sheet_productos_id) back('/app/productos', { error: `Tus ${T.items.toLowerCase()} vienen de Google Drive: agregalos en tu planilla.` });
  const name = str(fd, 'name').slice(0, 120);
  const price = parseNum(str(fd, 'price'));
  if (!name) back('/app/productos', { error: 'Poné el nombre.' });
  if (price === null || price < 0) back('/app/productos', { error: 'Poné un precio válido (solo números).' });
  const admin = createAdmin();
  const { data: same } = await admin.from('products').select('id').eq('bakery_id', bakery.id).ilike('name', name).not('sheet_row', 'is', null).maybeSingle();
  if (same) back('/app/productos', { error: `Ya tenés uno llamado «${name}».` });
  const stock = parseNum(str(fd, 'stock'));
  const row = {
    bakery_id: bakery.id,
    sku: `P-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    name,
    category: str(fd, 'category').slice(0, 60) || 'General',
    price,
    description: str(fd, 'description').slice(0, 500) || null,
    stock_loaded: stock === null ? null : Math.max(0, Math.round(stock)),
    visible: true,
    sheet_row: await nextSheetRow(admin, 'products', bakery.id),
  };
  const { data, error } = await admin.from('products').insert(row).select('id').single();
  if (error) back('/app/productos', { error: error.message });
  await recomputeCosts(admin, bakery, [data.id]);
  revalidatePath('/app', 'layout');
  back(`/app/productos/${data.id}`, { ok: `Listo, «${name}» ya está en tu catálogo.${T.key === 'cocina' ? ' Cargale la receta para saber cuánto te cuesta.' : ''}` });
}

export async function updateProduct(fd) {
  const { bakery } = await requireBakery();
  const id = str(fd, 'id');
  const path = `/app/productos/${id}`;
  const admin = createAdmin();
  const { data: p } = await admin.from('products').select('*').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
  if (!p) back('/app/productos', { error: 'No encontramos ese producto.' });
  if (bakery.sheet_productos_id) back(path, { error: 'Este producto viene de tu planilla de Google Drive: cambialo ahí.' });
  const name = str(fd, 'name').slice(0, 120);
  const price = parseNum(str(fd, 'price'));
  if (!name) back(path, { error: 'Poné el nombre.' });
  if (price === null || price < 0) back(path, { error: 'Poné un precio válido (solo números).' });
  const stockRaw = str(fd, 'stock');
  const stock = stockRaw === '' ? null : parseNum(stockRaw);
  const { error } = await admin.from('products').update({
    name,
    price,
    category: str(fd, 'category').slice(0, 60) || 'General',
    description: str(fd, 'description').slice(0, 500) || null,
    stock_loaded: stock === null ? null : Math.max(0, Math.round(stock)),
    visible: fd.get('visible') === 'on',
  }).eq('id', id);
  if (error) back(path, { error: error.message });
  revalidatePath('/app', 'layout');
  back(path, { ok: 'Cambios guardados.' });
}

export async function saveIngredient(fd) {
  const { bakery } = await requireBakery();
  const T = rubroOf(bakery);
  const path = '/app/insumos';
  if (bakery.sheet_insumos_id) back(path, { error: `Tus ${T.insumos.toLowerCase()} vienen de Google Drive: cambialos en tu planilla.` });
  const id = str(fd, 'id');
  const admin = createAdmin();
  const price = parseNum(str(fd, 'price'));
  if (price === null || price < 0) back(path, { error: 'Poné un precio válido (solo números).' });
  let patch = { price, updated_label: todayLabel(), error: null };
  let prev = null;
  if (id) {
    const { data } = await admin.from('ingredients').select('*').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
    if (!data) back(path, { error: 'No encontramos ese insumo.' });
    prev = data;
  }
  // Alta, o edición completa (si viene el nombre): validamos presentación y unidad.
  if (!id || fd.has('name')) {
    const name = str(fd, 'name').slice(0, 120);
    const qty = parseNum(str(fd, 'qty'));
    const unit = str(fd, 'unit');
    if (!name) back(path, { error: 'Poné el nombre.' });
    if (!qty || qty <= 0) back(path, { error: 'Poné cuánto trae la presentación que comprás (por ejemplo 1000 si es un paquete de 1 kg en gramos).' });
    if (!normUnit(unit)) back(path, { error: 'Elegí la unidad (g, kg, ml, l o u).' });
    const { data: same } = await admin.from('ingredients').select('id').eq('bakery_id', bakery.id).ilike('name', name).maybeSingle();
    if (same && same.id !== id) back(path, { error: `Ya tenés uno llamado «${name}».` });
    patch = { ...patch, name, qty, unit, purchase_unit: str(fd, 'purchase_unit').slice(0, 80) || null, supplier: str(fd, 'supplier').slice(0, 80) || null };
  }
  const { error } = id
    ? await admin.from('ingredients').update(patch).eq('id', id)
    : await admin.from('ingredients').insert({ ...patch, bakery_id: bakery.id, sheet_row: await nextSheetRow(admin, 'ingredients', bakery.id) });
  if (error) back(path, { error: error.message });
  await recomputeCosts(admin, bakery);
  revalidatePath('/app', 'layout');
  const name = patch.name || prev?.name;
  const change = prev && Number(prev.price) !== price && Number(prev.price) > 0 ? ` (${price > prev.price ? '+' : ''}${pct(((price - prev.price) / prev.price) * 100)})` : '';
  back(path, { ok: id ? `Nuevo precio de ${name}: $${price.toLocaleString('es-AR')}${change}. Los costos ya se recalcularon.` : `Agregamos ${name}.` });
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

// ---------- Fotos de productos ----------
async function setProductPhoto(bakery, product, url) {
  const admin = createAdmin();
  await admin.from('products').update({ photo_url: url }).eq('id', product.id).eq('bakery_id', bakery.id);
  if (product.sheet_row && bakery.google_refresh_token_enc && bakery.sheet_productos_id) {
    try {
      await writeCells(bakery, [{ range: `Productos!G${product.sheet_row}`, values: [[url || '']] }]);
    } catch {
      // la foto queda en AutoFlow aunque no se pueda escribir la planilla
    }
  }
}

export async function uploadProductPhoto(fd) {
  const { bakery } = await requireBakery();
  const id = str(fd, 'id');
  const to = `/app/productos/${id}#foto`;
  const admin = createAdmin();
  const { data: product } = await admin.from('products').select('id,sheet_row,photo_url').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
  if (!product) back('/app/productos', { error: 'No encontramos ese producto.' });
  const file = fd.get('foto');
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) back(to, { error: 'Elegí una foto.' });
  if (file.size > 5 * 1024 * 1024) back(to, { error: 'La foto es muy pesada (máximo 5 MB).' });
  const type = String(file.type || '');
  if (!/^image\/(jpeg|png|webp)$/.test(type)) back(to, { error: 'La foto tiene que ser JPG, PNG o WEBP.' });
  const ext = type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${bakery.id}/${product.id}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const { error } = await admin.storage.from('productos').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: type, upsert: false });
  if (error) back(to, { error: 'No se pudo subir la foto. Probá de nuevo.' });
  const url = admin.storage.from('productos').getPublicUrl(path).data.publicUrl;
  await setProductPhoto(bakery, product, url);
  const old = String(product.photo_url || '').split('/storage/v1/object/public/productos/')[1];
  if (old) await admin.storage.from('productos').remove([decodeURIComponent(old)]);
  revalidatePath('/app', 'layout');
  revalidatePath(`/c/${bakery.slug}`);
  back(to, { ok: 'Foto actualizada: ya se ve en tu catálogo.' });
}

// Logo del negocio: va al mismo depósito de fotos, en la carpeta del negocio.
export async function uploadLogo(fd) {
  const { bakery } = await requireBakery();
  const to = '/app/configuracion#negocio';
  const admin = createAdmin();
  const file = fd.get('foto');
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) back(to, { error: 'Elegí una imagen.' });
  if (file.size > 4 * 1024 * 1024) back(to, { error: 'La imagen es muy pesada (máximo 4 MB).' });
  const type = String(file.type || '');
  if (!/^image\/(jpeg|png|webp)$/.test(type)) back(to, { error: 'El logo tiene que ser JPG, PNG o WEBP.' });
  const ext = type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${bakery.id}/logo-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const { error } = await admin.storage.from('productos').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: type, upsert: false });
  if (error) back(to, { error: 'No se pudo subir el logo. Probá de nuevo.' });
  const url = admin.storage.from('productos').getPublicUrl(path).data.publicUrl;
  await admin.from('bakeries').update({ logo_url: url }).eq('id', bakery.id);
  const old = String(bakery.logo_url || '').split('/storage/v1/object/public/productos/')[1];
  if (old) await admin.storage.from('productos').remove([decodeURIComponent(old)]);
  revalidatePath('/app', 'layout');
  revalidatePath(`/c/${bakery.slug}`);
  back(to, { ok: 'Logo actualizado: ya se ve en tu catálogo.' });
}

export async function removeLogo() {
  const { bakery } = await requireBakery();
  const admin = createAdmin();
  const old = String(bakery.logo_url || '').split('/storage/v1/object/public/productos/')[1];
  await admin.from('bakeries').update({ logo_url: null }).eq('id', bakery.id);
  if (old) await admin.storage.from('productos').remove([decodeURIComponent(old)]);
  revalidatePath('/app', 'layout');
  revalidatePath(`/c/${bakery.slug}`);
  back('/app/configuracion#negocio', { ok: 'Quitamos el logo.' });
}

export async function removeProductPhoto(fd) {
  const { bakery } = await requireBakery();
  const id = str(fd, 'id');
  const admin = createAdmin();
  const { data: product } = await admin.from('products').select('id,sheet_row,photo_url').eq('id', id).eq('bakery_id', bakery.id).maybeSingle();
  if (!product) back('/app/productos', { error: 'No encontramos ese producto.' });
  await setProductPhoto(bakery, product, null);
  const old = String(product.photo_url || '').split('/storage/v1/object/public/productos/')[1];
  if (old) await admin.storage.from('productos').remove([decodeURIComponent(old)]);
  revalidatePath('/app', 'layout');
  back(`/app/productos/${id}#foto`, { ok: 'Foto quitada.' });
}

// Simulador de inflación: aplica los precios sugeridos que el usuario eligió.
export async function applySimulatedPrices(fd) {
  const { supabase, bakery } = await requireBakery();
  let wanted = [];
  try {
    wanted = JSON.parse(str(fd, 'prices') || '[]');
  } catch {
    back('/app/costos', { error: 'No se pudieron leer los precios.' });
  }
  wanted = (Array.isArray(wanted) ? wanted : [])
    .map((w) => ({ id: String(w.id || ''), price: Math.round(Number(w.price)) }))
    .filter((w) => w.id && Number.isFinite(w.price) && w.price > 0 && w.price < 100000000)
    .slice(0, 200);
  if (!wanted.length) back('/app/costos', { error: 'No hay precios para aplicar.' });
  const { data: own } = await supabase.from('products').select('id,name,sheet_row').eq('bakery_id', bakery.id).in('id', wanted.map((w) => w.id));
  const byId = new Map((own || []).map((p) => [p.id, p]));
  const valid = wanted.filter((w) => byId.has(w.id));
  for (const w of valid) await supabase.from('products').update({ price: w.price }).eq('id', w.id).eq('bakery_id', bakery.id);
  let err = null;
  const cells = valid.filter((w) => byId.get(w.id).sheet_row).map((w) => ({ range: `Productos!D${byId.get(w.id).sheet_row}`, values: [[w.price]] }));
  if (cells.length && bakery.google_refresh_token_enc) {
    try {
      await writeCells(bakery, cells);
      await pushStockToSheet(createAdmin(), bakery, valid.map((w) => w.id));
    } catch (e) {
      err = `Se actualizó en AutoFlow pero no en la planilla: ${e.message}`;
    }
  }
  revalidatePath('/app', 'layout');
  back('/app/costos', err ? { error: err } : { ok: `Actualizamos ${valid.length} ${valid.length === 1 ? 'precio' : 'precios'}. Tu catálogo ya muestra los nuevos.` });
}

// ---------- Personalización y suscripción por producto ----------
export async function saveProductSettings(fd) {
  const { supabase, bakery } = await requireBakery();
  const id = str(fd, 'id');
  const options = parseOptionsText(str(fd, 'options'));
  const patch = { options, allow_subscription: fd.get('allow_subscription') === 'on' };
  if (fd.has('duration_minutes')) {
    const d = Math.round(parseNum(str(fd, 'duration_minutes')) || 0);
    patch.duration_minutes = d >= 5 ? Math.min(d, 1440) : null;
  }
  const { error } = await supabase
    .from('products')
    .update(patch)
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

// Editar un pedido activo: fecha, horario, cantidad, entrega y datos del cliente.
// No bloquea por cupo (lo carga el dueño, como «Cargar aunque no haya cupo»), pero avisa si el día se pasó.
export async function updateOrder(fd) {
  const { bakery } = await requireBakery();
  const admin = createAdmin();
  const backTo = str(fd, 'back').startsWith('/app') ? str(fd, 'back') : '/app/pedidos';
  const { data: o } = await admin.from('orders').select('*').eq('id', str(fd, 'id')).eq('bakery_id', bakery.id).maybeSingle();
  if (!o) back(backTo, { error: 'No encontramos ese pedido.' });
  if (!['pendiente_sena', 'confirmado'].includes(o.status)) back(backTo, { error: 'Solo se pueden editar pedidos que esperan seña o están confirmados.' });

  const date = str(fd, 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) back(backTo, { error: 'Elegí una fecha válida.' });
  const quantity = Math.floor(Number(str(fd, 'quantity')));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) back(backTo, { error: 'La cantidad tiene que ser un número entre 1 y 999.' });
  const customerName = str(fd, 'customer_name').slice(0, 120);
  if (!customerName) back(backTo, { error: 'Falta el nombre del cliente.' });
  const fulfillment = str(fd, 'fulfillment') === 'envio' && bakery.delivery_enabled ? 'envio' : 'retiro';
  const address = str(fd, 'address').slice(0, 300);
  if (fulfillment === 'envio' && !address) back(backTo, { error: 'Falta la dirección de entrega.' });
  if (quantity !== o.quantity && o.payment_url && !o.paid_at) {
    back(backTo, { error: 'Este pedido ya tiene un link de pago de seña con el importe anterior. Para cambiar la cantidad, cancelalo y cargalo de nuevo.' });
  }

  const unitPrice = o.unit_price !== null && o.unit_price !== undefined ? Number(o.unit_price) : Number(o.total) / Math.max(1, o.quantity);
  const total = Math.round(unitPrice * quantity * 100) / 100;
  // La seña ya cobrada no cambia; si todavía no se cobró, se recalcula con el nuevo total.
  const deposit = o.paid_at ? Number(o.deposit_amount) : Math.round((total * Number(bakery.deposit_percent)) / 100);
  const phone = str(fd, 'customer_phone').slice(0, 40);
  const patch = {
    date,
    slot: str(fd, 'slot') || null,
    quantity,
    total,
    deposit_amount: deposit,
    fulfillment,
    address: fulfillment === 'envio' ? address : null,
    customer_name: customerName,
    customer_phone: phone || null,
    notes: str(fd, 'notes').slice(0, 500) || null,
    dedication: str(fd, 'dedication').slice(0, 200) || null,
    allergies: str(fd, 'allergies').slice(0, 300) || null,
  };
  // El link de Mercado Pago del saldo tenía el importe viejo: se arma de nuevo cuando haga falta.
  if (total !== Number(o.total)) patch.balance_payment_url = null;
  if (phone && phone !== (o.customer_phone || '')) {
    const customerId = await upsertCustomer(admin, bakery.id, { name: customerName, phone });
    if (customerId) patch.customer_id = customerId;
  }
  const { error } = await admin.from('orders').update(patch).eq('id', o.id);
  if (error) back(backTo, { error: error.message });
  if (quantity !== o.quantity && o.product_id) await pushStockToSheet(admin, bakery, [o.product_id]);

  let warn = '';
  if (date !== o.date || quantity !== o.quantity) {
    const cap = await capacityMap(admin, bakery, o.category, date, date);
    const day = cap.get(date);
    if (day?.blocked) warn = ' Ojo: ese día lo tenés marcado como sin pedidos.';
    else if (day && day.max !== null && day.used > day.max) warn = ` Ojo: ese día quedó con ${day.used} de ${day.max} de cupo.`;
  }
  revalidatePath('/app', 'layout');
  back(backTo, { ok: `Pedido de ${customerName} actualizado.${warn}` });
}

// Corregir nombre, teléfono o email de un cliente (los pedidos nuevos no lo pisan).
export async function updateCustomer(fd) {
  const { bakery } = await requireBakery();
  const admin = createAdmin();
  const path = '/app/clientes';
  const id = str(fd, 'id');
  const name = str(fd, 'name').slice(0, 120);
  const phone = str(fd, 'phone').slice(0, 40);
  const email = str(fd, 'email').slice(0, 160);
  const notes = str(fd, 'notes').slice(0, 300);
  if (!name) back(path, { error: 'Poné el nombre.' });
  const phone_norm = normPhone(phone);
  if (!phone_norm) back(path, { error: 'Revisá el teléfono: tiene que tener código de área (ej. 11 5555-5555).' });
  const { data: same } = await admin.from('customers').select('id,name').eq('bakery_id', bakery.id).eq('phone_norm', phone_norm).maybeSingle();
  if (same && same.id !== id) back(path, { error: `Ese teléfono ya es de ${same.name}.` });
  const { error } = await admin.from('customers').update({ name, phone, phone_norm, email: email || null, notes: notes || null }).eq('id', id).eq('bakery_id', bakery.id);
  if (error) back(path, { error: error.message });
  revalidatePath('/app/clientes');
  back(path, { ok: `Guardamos los datos de ${name}.` });
}

// Borrar un insumo. Si alguna receta lo usa, ese producto queda «sin costo» hasta que lo reemplaces.
export async function deleteIngredient(fd) {
  const { bakery } = await requireBakery();
  const T = rubroOf(bakery);
  const path = '/app/insumos';
  if (bakery.sheet_insumos_id) back(path, { error: `Tus ${T.insumos.toLowerCase()} vienen de Google Drive: borralos en tu planilla.` });
  const admin = createAdmin();
  const { data: ing } = await admin.from('ingredients').select('id,name').eq('id', str(fd, 'id')).eq('bakery_id', bakery.id).maybeSingle();
  if (!ing) back(path, { error: 'No encontramos ese insumo.' });
  const { error } = await admin.from('ingredients').delete().eq('id', ing.id);
  if (error) back(path, { error: error.message });
  await recomputeCosts(admin, bakery);
  revalidatePath('/app', 'layout');
  back(path, { ok: `Borramos ${ing.name}.` });
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
      reason: `AutoFlow – ${modules}`,
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

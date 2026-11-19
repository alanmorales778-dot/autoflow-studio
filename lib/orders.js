import { todayAR, addDays, weekdayOf } from './format';
import { decrypt } from './crypto';
import { createPreference } from './mp';
import { resolveSelection } from './options';
import { upsertCustomer } from './customers';

export const MAX_PENDING_PER_PHONE = 3;

export function isHolding(o, now = new Date()) {
  if (o.status === 'confirmado') return true;
  if (o.status === 'pendiente_sena') return !o.expires_at || new Date(o.expires_at) > now;
  return false;
}

// Unidades reservadas de stock: pedidos confirmados o con seña pendiente vigente (todavía no entregados)
export async function reservedByProduct(admin, bakeryId) {
  const { data } = await admin
    .from('orders')
    .select('product_id,quantity,status,expires_at')
    .eq('bakery_id', bakeryId)
    .in('status', ['pendiente_sena', 'confirmado']);
  const map = new Map();
  const now = new Date();
  (data || []).forEach((o) => {
    if (!o.product_id || !isHolding(o, now)) return;
    map.set(o.product_id, (map.get(o.product_id) || 0) + o.quantity);
  });
  return map;
}

// Uso de cupos por fecha para una categoría (incluye entregados: ya ocuparon el horno ese día)
export async function capacityMap(admin, bakery, category, from, to) {
  const [{ data: rules }, { data: blocked }, { data: orders }] = await Promise.all([
    admin.from('capacity_rules').select('*').eq('bakery_id', bakery.id),
    admin.from('blocked_dates').select('date').eq('bakery_id', bakery.id).gte('date', from).lte('date', to),
    admin
      .from('orders')
      .select('date,quantity,status,expires_at,category')
      .eq('bakery_id', bakery.id)
      .gte('date', from)
      .lte('date', to)
      .in('status', ['pendiente_sena', 'confirmado', 'entregado']),
  ]);
  const blockedSet = new Set((blocked || []).map((b) => b.date));
  const now = new Date();
  const result = new Map();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = weekdayOf(d);
    const rule =
      (rules || []).find((r) => r.category === category && r.weekday === wd) ||
      (rules || []).find((r) => r.category === '*' && r.weekday === wd);
    let used = 0;
    if (rule) {
      (orders || []).forEach((o) => {
        if (o.date !== d) return;
        if (o.status === 'pendiente_sena' && !isHolding(o, now)) return;
        if (rule.category === '*' || o.category === rule.category) used += o.quantity;
      });
    }
    result.set(d, { blocked: blockedSet.has(d), max: rule ? rule.max_units : null, used });
  }
  return result;
}

export async function availableDates(admin, bakery, product, qty) {
  const from = addDays(todayAR(), bakery.min_days_ahead ?? 1);
  const to = addDays(todayAR(), bakery.max_days_ahead ?? 21);
  if (to < from) return [];
  const cap = await capacityMap(admin, bakery, product.category, from, to);
  const out = [];
  for (const [date, c] of cap) {
    if (c.blocked) continue;
    if (c.max !== null && c.used + qty > c.max) continue;
    out.push({ date, left: c.max === null ? null : c.max - c.used });
  }
  return out;
}

export async function stockLeft(admin, bakery, product) {
  if (product.stock_loaded === null || product.stock_loaded === undefined) return null;
  const reserved = await reservedByProduct(admin, bakery.id);
  return Math.max(0, product.stock_loaded - (reserved.get(product.id) || 0));
}

export async function createOrder(admin, bakery, product, input) {
  const qty = Math.max(1, Math.floor(Number(input.quantity) || 1));
  const date = String(input.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Elegí una fecha válida.');
  if (!input.customer_name || !String(input.customer_name).trim()) throw new Error('Falta el nombre.');
  const fulfillment = input.fulfillment === 'envio' && bakery.delivery_enabled ? 'envio' : 'retiro';
  if (fulfillment === 'envio' && !String(input.address || '').trim()) throw new Error('Falta la dirección de entrega.');

  const publicChannel = ['web', 'whatsapp'].includes(input.channel || 'web') && !input.subscription_id;
  const phoneKey = String(input.customer_phone || '').replace(/\D/g, '').slice(-8);
  if (publicChannel && phoneKey.length >= 6) {
    // Antiabuso: como máximo 3 pedidos esperando seña por teléfono, para que nadie bloquee los cupos.
    const { data: pend } = await admin
      .from('orders')
      .select('customer_phone,expires_at,status')
      .eq('bakery_id', bakery.id)
      .eq('status', 'pendiente_sena')
      .limit(500);
    const mine = (pend || []).filter((o) => isHolding(o) && String(o.customer_phone || '').replace(/\D/g, '').slice(-8) === phoneKey);
    if (mine.length >= MAX_PENDING_PER_PHONE) throw new Error(`Ya tenés ${mine.length} pedidos esperando la seña. Pagá alguno o escribile al negocio antes de hacer otro.`);
  }

  if (!input.force) {
    const dates = await availableDates(admin, bakery, product, qty);
    if (!dates.find((d) => d.date === date)) throw new Error('Esa fecha ya no tiene cupo. Elegí otra.');
    const left = await stockLeft(admin, bakery, product);
    if (left !== null && left < qty) throw new Error(left === 0 ? 'Producto agotado.' : `Solo quedan ${left} unidades.`);
  }

  const options = input.selectedOptions ? resolveSelection(product.options, input.selectedOptions) : input.options || [];
  const optionsTotal = options.reduce((s, o) => s + (Number(o.delta) || 0), 0);
  const unitPrice = input.unit_price !== undefined ? Number(input.unit_price) : Number(product.price) + optionsTotal;
  const total = unitPrice * qty;
  let deposit = Math.round((total * Number(bakery.deposit_percent)) / 100);
  if (input.prepaid_total) deposit = total; // pagado completo (ej. suscripción cobrada por Mercado Pago)
  if (input.confirm_without_payment) deposit = 0; // confirmado, se cobra todo después
  const mpToken = bakery.mp_access_token_enc ? decrypt(bakery.mp_access_token_enc) : null;
  const paidUpfront = !!input.deposit_paid || deposit === 0 || !!input.prepaid_total || !!input.confirm_without_payment;
  const holdWithLink = !paidUpfront && !!mpToken;
  // Sin Mercado Pago, la seña se coordina a mano: el pedido reserva el cupo durante manual_hold_hours
  // (0 = no vence). Los pedidos cargados por el dueño no vencen.
  const manualExpiry = () => (publicChannel && Number(bakery.manual_hold_hours) > 0 ? new Date(Date.now() + Number(bakery.manual_hold_hours) * 3600000).toISOString() : null);
  const expiresAt = paidUpfront ? null : holdWithLink ? new Date(Date.now() + bakery.hold_minutes * 60000).toISOString() : manualExpiry();

  const customerId = await upsertCustomer(admin, bakery.id, { name: input.customer_name, phone: input.customer_phone, email: input.customer_email });

  const { data: order, error } = await admin
    .from('orders')
    .insert({
      bakery_id: bakery.id,
      product_id: product.id,
      product_name: product.name,
      category: product.category,
      quantity: qty,
      unit_price: unitPrice,
      total,
      options,
      options_total: optionsTotal,
      dedication: input.dedication ? String(input.dedication).trim().slice(0, 200) : null,
      allergies: input.allergies ? String(input.allergies).trim().slice(0, 300) : null,
      occasion: input.occasion ? String(input.occasion).trim().slice(0, 80) : null,
      reference_photo_url: input.reference_photo_url || null,
      customer_id: customerId,
      subscription_id: input.subscription_id || null,
      deposit_amount: deposit,
      date,
      slot: input.slot || null,
      fulfillment,
      address: fulfillment === 'envio' ? String(input.address).trim() : null,
      customer_name: String(input.customer_name).trim().slice(0, 120),
      customer_phone: input.customer_phone ? String(input.customer_phone).trim().slice(0, 40) : null,
      notes: input.notes ? String(input.notes).trim().slice(0, 500) : null,
      status: paidUpfront ? 'confirmado' : 'pendiente_sena',
      paid_at: paidUpfront && !input.confirm_without_payment ? new Date().toISOString() : null,
      balance_paid_at: input.prepaid_total ? new Date().toISOString() : null,
      channel: input.channel || 'web',
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error) throw error;

  if (holdWithLink) {
    try {
      const pref = await createPreference(mpToken, {
        order,
        bakery,
        title: `Seña ${product.name} x${qty} – ${bakery.name}`,
        amount: deposit,
        expiresAt,
      });
      await admin.from('orders').update({ payment_url: pref.init_point }).eq('id', order.id);
      order.payment_url = pref.init_point;
    } catch (e) {
      // sin link: el pedido queda pendiente para coordinar la seña a mano, con el vencimiento manual
      const exp = manualExpiry();
      await admin.from('orders').update({ expires_at: exp, notes: `${order.notes ? order.notes + ' | ' : ''}No se pudo generar el link de Mercado Pago` }).eq('id', order.id);
      order.expires_at = exp;
      order.payment_error = String(e.message || e);
    }
  }
  return order;
}

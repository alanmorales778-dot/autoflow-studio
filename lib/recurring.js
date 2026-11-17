// Suscripciones de clientes finales: pedidos que se repiten cada semana o cada 15 días
import { decrypt } from './crypto';
import { createPreapproval, getPreapproval, updatePreapproval } from './mp';
import { createOrder } from './orders';
import { upsertCustomer } from './customers';
import { todayAR, addDays, weekdayOf } from './format';
import { appUrl } from './env';
import { pushStockToSheet } from './sheets';

export function firstDeliveryDate(bakery, weekday) {
  let d = addDays(todayAR(), Math.max(1, bakery.min_days_ahead ?? 1));
  for (let i = 0; i < 7 && weekdayOf(d) !== Number(weekday); i++) d = addDays(d, 1);
  return d;
}

export function subscriptionStatusUrl(bakery, sub) {
  return `${appUrl()}/c/${bakery.slug}/suscripcion/${sub.id}?t=${sub.public_token}`;
}

export async function createCustomerSubscription(admin, bakery, product, input) {
  const qty = Math.max(1, Math.min(50, Math.floor(Number(input.quantity) || 1)));
  const freq = Number(input.frequency_days) === 14 ? 14 : 7;
  const weekday = Number(input.weekday);
  if (!(weekday >= 0 && weekday <= 6)) throw new Error('Elegí el día de entrega.');
  const name = String(input.customer_name || '').trim();
  if (!name) throw new Error('Falta el nombre.');
  if (!String(input.customer_phone || '').trim()) throw new Error('Falta el WhatsApp.');
  const fulfillment = input.fulfillment === 'envio' && bakery.delivery_enabled ? 'envio' : 'retiro';
  if (fulfillment === 'envio' && !String(input.address || '').trim()) throw new Error('Falta la dirección de entrega.');
  const mpToken = bakery.mp_access_token_enc ? decrypt(bakery.mp_access_token_enc) : null;
  const email = String(input.customer_email || '').trim();
  if (mpToken && !input.manual && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Necesitamos tu email para el débito automático de Mercado Pago.');

  const customerId = await upsertCustomer(admin, bakery.id, { name, phone: input.customer_phone, email });
  const { data: sub, error } = await admin
    .from('customer_subscriptions')
    .insert({
      bakery_id: bakery.id,
      customer_id: customerId,
      customer_name: name.slice(0, 120),
      customer_phone: String(input.customer_phone).trim().slice(0, 40),
      customer_email: email || null,
      product_id: product.id,
      product_name: product.name,
      quantity: qty,
      unit_price: Number(product.price),
      frequency_days: freq,
      weekday,
      slot: input.slot || null,
      fulfillment,
      address: fulfillment === 'envio' ? String(input.address).trim() : null,
      notes: input.notes ? String(input.notes).trim().slice(0, 300) : null,
      status: input.activate ? 'activa' : 'pendiente',
      payment_mode: mpToken && !input.manual ? 'mercadopago' : 'manual',
      next_date: firstDeliveryDate(bakery, weekday),
    })
    .select()
    .single();
  if (error) throw error;

  if (sub.payment_mode === 'mercadopago') {
    const pre = await createPreapproval(mpToken, {
      reason: `${product.name} x${qty} cada ${freq === 7 ? 'semana' : '15 días'} – ${bakery.name}`.slice(0, 250),
      amount: Number(product.price) * qty,
      payerEmail: email,
      externalReference: `sub:${sub.id}`,
      backUrl: subscriptionStatusUrl(bakery, sub),
      frequency: freq,
      frequencyType: 'days',
    });
    await admin.from('customer_subscriptions').update({ mp_preapproval_id: pre.id, init_point: pre.init_point }).eq('id', sub.id);
    sub.init_point = pre.init_point;
    sub.mp_preapproval_id = pre.id;
  }
  return sub;
}

const MP_TO_STATUS = { authorized: 'activa', paused: 'pausada', cancelled: 'cancelada' };

export async function refreshFromMercadoPago(admin, bakery, sub) {
  if (!sub.mp_preapproval_id || !bakery.mp_access_token_enc) return sub;
  const pre = await getPreapproval(decrypt(bakery.mp_access_token_enc), sub.mp_preapproval_id);
  const status = MP_TO_STATUS[pre.status];
  if (!status || status === sub.status) return sub;
  const { data } = await admin.from('customer_subscriptions').update({ status }).eq('id', sub.id).select().single();
  return data || sub;
}

export async function changeSubscriptionStatus(admin, bakery, subId, status) {
  const { data: sub } = await admin.from('customer_subscriptions').select('*').eq('id', subId).eq('bakery_id', bakery.id).single();
  if (!sub) throw new Error('Suscripción no encontrada');
  if (sub.mp_preapproval_id && bakery.mp_access_token_enc) {
    const mpStatus = { activa: 'authorized', pausada: 'paused', cancelada: 'cancelled' }[status];
    if (mpStatus) await updatePreapproval(decrypt(bakery.mp_access_token_enc), sub.mp_preapproval_id, mpStatus);
  }
  const patch = { status };
  if (status === 'activa' && sub.next_date < todayAR()) patch.next_date = firstDeliveryDate(bakery, sub.weekday);
  await admin.from('customer_subscriptions').update(patch).eq('id', sub.id);
}

// Crea los pedidos de la próxima semana para las suscripciones activas
export async function generateRecurringOrders(admin) {
  const horizon = addDays(todayAR(), 7);
  const { data: subs } = await admin
    .from('customer_subscriptions')
    .select('*')
    .eq('status', 'activa')
    .lte('next_date', horizon)
    .limit(200);
  let created = 0;
  const bakeries = new Map();
  for (const sub of subs || []) {
    if (!bakeries.has(sub.bakery_id)) {
      const { data } = await admin.from('bakeries').select('*').eq('id', sub.bakery_id).single();
      bakeries.set(sub.bakery_id, data);
    }
    const bakery = bakeries.get(sub.bakery_id);
    if (!bakery || !sub.product_id) continue;
    const { data: product } = await admin.from('products').select('*').eq('id', sub.product_id).maybeSingle();
    if (!product) continue;
    let next = sub.next_date;
    for (let i = 0; i < 3 && next <= horizon; i++) {
      if (next >= todayAR()) {
        try {
          await createOrder(admin, bakery, product, {
            quantity: sub.quantity,
            unit_price: sub.unit_price,
            date: next,
            slot: sub.slot,
            fulfillment: sub.fulfillment,
            address: sub.address,
            customer_name: sub.customer_name,
            customer_phone: sub.customer_phone,
            customer_email: sub.customer_email,
            notes: sub.notes ? `Suscripción · ${sub.notes}` : 'Suscripción',
            channel: 'suscripcion',
            subscription_id: sub.id,
            force: true,
            prepaid_total: sub.payment_mode === 'mercadopago',
            confirm_without_payment: sub.payment_mode === 'manual',
          });
          created++;
        } catch (e) {
          // índice único (suscripción, fecha): ya existía el pedido
        }
      }
      next = addDays(next, sub.frequency_days);
    }
    await admin.from('customer_subscriptions').update({ next_date: next }).eq('id', sub.id);
    await pushStockToSheet(admin, bakery, [product.id]);
  }
  return created;
}

export async function refreshPendingSubscriptions(admin) {
  const { data: subs } = await admin
    .from('customer_subscriptions')
    .select('*')
    .in('status', ['pendiente', 'activa', 'pausada'])
    .not('mp_preapproval_id', 'is', null)
    .limit(40);
  for (const sub of subs || []) {
    const { data: bakery } = await admin.from('bakeries').select('id,mp_access_token_enc,slug').eq('id', sub.bakery_id).single();
    try {
      await refreshFromMercadoPago(admin, bakery, sub);
    } catch {}
  }
}

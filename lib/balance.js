import { decrypt } from './crypto';
import { createPreference } from './mp';
import { appUrl } from './env';
import { money, dateLabel } from './format';
import { waMeLink } from './customers';

export function balanceDue(order) {
  if (order.balance_paid_at) return 0;
  const paidDeposit = order.paid_at ? Number(order.deposit_amount) : 0;
  return Math.max(0, Number(order.total) - paidDeposit);
}

export function orderStatusUrl(bakery, order) {
  return `${appUrl()}/c/${bakery.slug}/pedido/${order.id}?t=${order.public_token}`;
}

// Link de Mercado Pago para el saldo (sin vencimiento). Se reutiliza si ya existe.
export async function ensureBalanceLink(admin, bakery, order) {
  if (order.balance_payment_url) return order.balance_payment_url;
  const due = balanceDue(order);
  if (!due || !bakery.mp_access_token_enc) return null;
  const pref = await createPreference(decrypt(bakery.mp_access_token_enc), {
    order: { ...order, id: order.id },
    bakery,
    title: `Saldo ${order.product_name} x${order.quantity} – ${bakery.name}`,
    amount: due,
    expiresAt: null,
    reference: `${order.id}:saldo`,
  });
  await admin.from('orders').update({ balance_payment_url: pref.init_point }).eq('id', order.id);
  return pref.init_point;
}

export async function markBalancePaid(admin, orderId) {
  const { data } = await admin
    .from('orders')
    .update({ balance_paid_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('balance_paid_at', null)
    .select()
    .maybeSingle();
  return data;
}

// Mensaje de recordatorio para mandar desde el WhatsApp del negocio
export function reminderLink(bakery, order) {
  const due = balanceDue(order);
  const where = order.fulfillment === 'envio' ? `Te lo llevamos a ${order.address}` : `Lo retirás en ${bakery.pickup_address || 'nuestro local'}`;
  const text =
    `¡Hola ${String(order.customer_name).split(' ')[0]}! Te recordamos tu pedido de ${bakery.name}: ${order.quantity} × ${order.product_name} para el ${dateLabel(order.date)}${order.slot ? ` (${order.slot})` : ''}. ${where}.` +
    (due > 0 ? `\nSaldo a pagar: ${money(due)}. Podés pagarlo acá: ${orderStatusUrl(bakery, order)}` : '\n¡Ya está todo pago!') +
    '\n¡Gracias!';
  return waMeLink(order.customer_phone, text);
}

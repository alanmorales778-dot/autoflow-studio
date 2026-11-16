import { appUrl } from './env';

const API = 'https://api.mercadopago.com';

function mpDate(iso) {
  // Mercado Pago espera fechas con zona horaria explícita
  const d = new Date(new Date(iso).getTime() - 3 * 3600e3);
  return d.toISOString().replace('Z', '-03:00');
}

async function mpFetch(token, path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    cache: 'no-store',
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${json.message || json.error || res.statusText}`);
  return json;
}

export async function createPreference(token, { order, bakery, title, amount, expiresAt }) {
  const back = `${appUrl()}/c/${bakery.slug}/pedido/${order.id}?t=${order.public_token}`;
  const body = {
    items: [{ id: order.id, title: title.slice(0, 250), quantity: 1, unit_price: Number(amount), currency_id: 'ARS' }],
    external_reference: order.id,
    notification_url: `${appUrl()}/api/mp/webhook?b=${bakery.id}`,
    back_urls: { success: back, pending: back, failure: back },
    auto_return: 'approved',
    metadata: { order_id: order.id, bakery_id: bakery.id },
  };
  if (expiresAt) {
    body.expires = true;
    body.expiration_date_from = mpDate(new Date().toISOString());
    body.expiration_date_to = mpDate(expiresAt);
    body.date_of_expiration = mpDate(expiresAt);
  }
  return mpFetch(token, '/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `pref-${order.id}` },
    body: JSON.stringify(body),
  });
}

export function getPayment(token, id) {
  return mpFetch(token, `/v1/payments/${encodeURIComponent(id)}`);
}

export async function testToken(token) {
  return mpFetch(token, '/users/me');
}

export function createPreapproval(token, { reason, amount, payerEmail, externalReference, backUrl }) {
  return mpFetch(token, '/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason,
      external_reference: externalReference,
      payer_email: payerEmail,
      back_url: backUrl,
      status: 'pending',
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: Number(amount), currency_id: 'ARS' },
    }),
  });
}

export function getPreapproval(token, id) {
  return mpFetch(token, `/preapproval/${encodeURIComponent(id)}`);
}

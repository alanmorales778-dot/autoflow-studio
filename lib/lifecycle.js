import { pushStockToSheet, writeCells } from './sheets';
import { waSend, waText } from './whatsapp';
import { money, dateLabel } from './format';
import { appUrl } from './env';
import { notifyOwner } from './notify';
import { notify } from './notifications';

async function notifyCustomer(bakery, order, text) {
  if (order.channel !== 'whatsapp' || !order.customer_phone) return;
  try {
    await waSend(bakery, waText(order.customer_phone, text));
  } catch {
    // fuera de la ventana de 24 h WhatsApp puede rechazar mensajes libres; no es crítico
  }
}

export async function confirmPaidOrder(admin, orderId, paymentId) {
  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).single();
  if (!order) return null;
  if (!['pendiente_sena', 'vencido'].includes(order.status)) return order;
  const late = order.status === 'vencido';
  const { data: updated } = await admin
    .from('orders')
    .update({
      status: 'confirmado',
      paid_at: new Date().toISOString(),
      mp_payment_id: paymentId ? String(paymentId) : null,
      notes: late ? `${order.notes ? order.notes + ' | ' : ''}Pagó la seña después del vencimiento: revisar cupo` : order.notes,
    })
    .eq('id', orderId)
    .in('status', ['pendiente_sena', 'vencido'])
    .select()
    .single();
  if (!updated) return order;
  const { data: bakery } = await admin.from('bakeries').select('*').eq('id', order.bakery_id).single();
  if (bakery) {
    if (updated.product_id) await pushStockToSheet(admin, bakery, [updated.product_id]);
    await notifyOwner(admin, bakery, updated, 'pagado');
    await notifyCustomer(
      bakery,
      updated,
      `✅ ¡Listo! Recibimos tu seña de ${money(updated.deposit_amount)}.\n\nTu pedido: ${updated.quantity} × ${updated.product_name}\nFecha: ${dateLabel(updated.date)}${updated.slot ? ` (${updated.slot})` : ''}\n${updated.fulfillment === 'envio' ? `Envío a: ${updated.address}` : `Retiro en: ${bakery.pickup_address || 'a coordinar'}`}\nSaldo a pagar: ${money(updated.total - updated.deposit_amount)}\n\n¡Gracias! — ${bakery.name}`,
    );
  }
  return updated;
}

export async function setOrderStatus(admin, bakery, orderId, status) {
  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).eq('bakery_id', bakery.id).single();
  if (!order) throw new Error('Pedido no encontrado');
  const patch = { status };
  if (status === 'confirmado' && !order.paid_at) patch.paid_at = new Date().toISOString();
  await admin.from('orders').update(patch).eq('id', orderId);

  if (order.product_id) {
    if (status === 'entregado' && order.status !== 'entregado') {
      // descontar del stock cargado
      const { data: product } = await admin.from('products').select('*').eq('id', order.product_id).single();
      if (product && product.stock_loaded !== null) {
        const newStock = Math.max(0, product.stock_loaded - order.quantity);
        await admin.from('products').update({ stock_loaded: newStock }).eq('id', product.id);
        if (product.sheet_row && bakery.google_refresh_token_enc) {
          try {
            await writeCells(bakery, [{ range: `Productos!E${product.sheet_row}`, values: [[newStock]] }]);
          } catch {}
        }
      }
    }
    await pushStockToSheet(admin, bakery, [order.product_id]);
  }
  return order;
}

export async function expireDueOrders(admin) {
  const { data: due } = await admin
    .from('orders')
    .select('*')
    .eq('status', 'pendiente_sena')
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString())
    .limit(200);
  if (!due || !due.length) return 0;
  await admin.from('orders').update({ status: 'vencido' }).in('id', due.map((o) => o.id)).eq('status', 'pendiente_sena');
  const byBakery = new Map();
  due.forEach((o) => {
    if (!byBakery.has(o.bakery_id)) byBakery.set(o.bakery_id, []);
    byBakery.get(o.bakery_id).push(o);
  });
  for (const [bakeryId, orders] of byBakery) {
    const { data: bakery } = await admin.from('bakeries').select('*').eq('id', bakeryId).single();
    if (!bakery) continue;
    await pushStockToSheet(admin, bakery, [...new Set(orders.map((o) => o.product_id).filter(Boolean))]);
    await notify(admin, bakery, {
      kind: 'vencido',
      title: orders.length === 1 ? `Se venció la seña de ${orders[0].customer_name}` : `Se vencieron ${orders.length} señas`,
      body: orders.length === 1 ? `${orders[0].quantity} × ${orders[0].product_name} · ${dateLabel(orders[0].date)}. Liberamos el lugar.` : `${orders.map((o) => o.customer_name).slice(0, 3).join(', ')}. Liberamos los lugares.`,
      url: '/app/pedidos?f=cancelado%2Cvencido',
    });
    for (const o of orders) {
      await notifyCustomer(
        bakery,
        o,
        `⏰ Se venció el tiempo para pagar la seña de tu pedido (${o.quantity} × ${o.product_name} para el ${dateLabel(o.date)}), así que liberamos el cupo.\n\nSi todavía lo querés, escribí *hola* y lo armamos de nuevo. También podés pedir desde ${appUrl()}/c/${bakery.slug}`,
      );
    }
  }
  return due.length;
}

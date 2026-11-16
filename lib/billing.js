// Aplica el estado de una suscripción (preapproval) de Mercado Pago a la tabla subscriptions
export async function applyPreapproval(admin, pre) {
  if (!pre || !pre.external_reference) return null;
  const [bakeryId, costs, wa] = String(pre.external_reference).split('|');
  if (!bakeryId) return null;
  const map = { authorized: 'active', paused: 'paused', cancelled: 'cancelled' };
  const status = map[pre.status];
  if (!status) return null; // pending: todavía no pagó
  const { data } = await admin
    .from('subscriptions')
    .update({
      status,
      has_costs: costs === '1',
      has_whatsapp: wa === '1',
      amount: pre.auto_recurring?.transaction_amount ?? null,
      mp_preapproval_id: pre.id,
      updated_at: new Date().toISOString(),
    })
    .eq('bakery_id', bakeryId)
    .select()
    .single();
  return data;
}

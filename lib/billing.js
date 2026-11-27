// Aplica el estado de una suscripción (preapproval) de Mercado Pago a la tabla subscriptions
// external_reference = bakeryId|costos|whatsapp|recurrentes|periodo|marketing|base|asistente (1/0)
// Las suscripciones viejas no traen marketing, base ni asistente: se toman como sin Marketing, con Base y sin Asistente.
export async function applyPreapproval(admin, pre) {
  if (!pre || !pre.external_reference) return null;
  const [bakeryId, costs, wa, rec, period, mkt, base, asst] = String(pre.external_reference).split('|');
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
      has_recurring: rec === '1',
      has_marketing: mkt === '1',
      has_assistant: asst === '1',
      has_base: base !== '0',
      billing_period: period === 'anual' ? 'anual' : 'mensual',
      amount: pre.auto_recurring?.transaction_amount ?? null,
      mp_preapproval_id: pre.id,
      updated_at: new Date().toISOString(),
    })
    .eq('bakery_id', bakeryId)
    .select()
    .single();
  return data;
}

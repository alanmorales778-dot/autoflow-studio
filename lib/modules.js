export const PRICES = { base: 15000, costs: 9000, whatsapp: 25000, recurring: 9000 };

// bakery es opcional: si el equipo de HakkiraApp suspendió el negocio desde /admin, no tiene acceso a nada.
export function moduleAccess(sub, bakery = null) {
  if (bakery?.suspended_at) {
    return { base: false, costs: false, whatsapp: false, recurring: false, trial: false, active: false, trialEnds: sub ? sub.trial_ends_at : null, status: 'suspended' };
  }
  const now = new Date();
  const trial = !!(sub && sub.status === 'trial' && new Date(sub.trial_ends_at) > now);
  const active = !!(sub && sub.status === 'active');
  return {
    base: trial || active,
    costs: trial || (active && !!sub.has_costs),
    whatsapp: trial || (active && !!sub.has_whatsapp),
    recurring: trial || (active && !!sub.has_recurring),
    trial,
    active,
    trialEnds: sub ? sub.trial_ends_at : null,
    status: sub ? sub.status : 'none',
  };
}

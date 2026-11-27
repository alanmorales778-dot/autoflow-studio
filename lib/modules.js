// Marketing IA se puede contratar solo (sin la Base) o sumado a los demás módulos.
export const PRICES = { base: 15000, costs: 9000, whatsapp: 25000, recurring: 9000, marketing: 29000 };

// Límites del Agente de Marketing por mes calendario.
export const MARKETING_LIMITS = { pieces: 60, kits: 10, perDay: 25 };

// bakery es opcional: si el equipo de HakkiraApp suspendió el negocio desde /admin, no tiene acceso a nada.
export function moduleAccess(sub, bakery = null) {
  if (bakery?.suspended_at) {
    return { base: false, costs: false, whatsapp: false, recurring: false, marketing: false, marketingOnly: false, trial: false, active: false, trialEnds: sub ? sub.trial_ends_at : null, status: 'suspended' };
  }
  const now = new Date();
  const trial = !!(sub && sub.status === 'trial' && new Date(sub.trial_ends_at) > now);
  const active = !!(sub && sub.status === 'active');
  // Las suscripciones viejas no tienen has_base: cuentan como Base contratada.
  const paidBase = active && sub.has_base !== false;
  const base = trial || paidBase;
  const marketing = trial || (active && !!sub.has_marketing);
  return {
    base,
    costs: trial || (paidBase && !!sub.has_costs),
    whatsapp: trial || (paidBase && !!sub.has_whatsapp),
    recurring: trial || (paidBase && !!sub.has_recurring),
    marketing,
    // Contrató solo Marketing IA: la app muestra solo Marketing, productos, ajustes y plan.
    marketingOnly: !base && marketing,
    trial,
    active,
    trialEnds: sub ? sub.trial_ends_at : null,
    status: sub ? sub.status : 'none',
  };
}

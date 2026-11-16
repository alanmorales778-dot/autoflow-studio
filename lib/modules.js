export const PRICES = { base: 15000, costs: 9000, whatsapp: 25000 };

export function moduleAccess(sub) {
  const now = new Date();
  const trial = !!(sub && sub.status === 'trial' && new Date(sub.trial_ends_at) > now);
  const active = !!(sub && sub.status === 'active');
  return {
    base: trial || active,
    costs: trial || (active && !!sub.has_costs),
    whatsapp: trial || (active && !!sub.has_whatsapp),
    trial,
    active,
    trialEnds: sub ? sub.trial_ends_at : null,
    status: sub ? sub.status : 'none',
  };
}

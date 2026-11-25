// Recomendaciones entre negocios: cada negocio tiene un código (bakeries.referral_code).
// El que se registra con /registro?ref=CÓDIGO suma 14 días de prueba; el que lo recomendó suma 30
// (si está en prueba) o queda anotado para descontarle un mes (si ya paga).
import { notify } from './notifications';

export const REFERRAL_DAYS_NEW = 14;
export const REFERRAL_DAYS_REFERRER = 30;

async function extendTrial(admin, bakeryId, days) {
  const { data: sub } = await admin.from('subscriptions').select('status,trial_ends_at').eq('bakery_id', bakeryId).maybeSingle();
  if (!sub || sub.status !== 'trial') return false;
  const base = Math.max(Date.now(), new Date(sub.trial_ends_at || Date.now()).getTime());
  await admin.from('subscriptions').update({ trial_ends_at: new Date(base + days * 86400000).toISOString(), updated_at: new Date().toISOString() }).eq('bakery_id', bakeryId);
  return true;
}

export async function applyReferral(admin, newBakeryId, code) {
  const { data: referrer } = await admin.from('bakeries').select('*').eq('referral_code', code).maybeSingle();
  if (!referrer || referrer.id === newBakeryId) return '';
  const { data: mine } = await admin.from('bakeries').select('id,name,referred_by').eq('id', newBakeryId).maybeSingle();
  if (!mine || mine.referred_by) return '';
  await admin.from('bakeries').update({ referred_by: referrer.id }).eq('id', newBakeryId);
  await extendTrial(admin, newBakeryId, REFERRAL_DAYS_NEW);
  const inTrial = await extendTrial(admin, referrer.id, REFERRAL_DAYS_REFERRER);
  await notify(admin, referrer, {
    kind: 'sistema',
    title: `¡${mine.name} se sumó con tu recomendación!`,
    body: inTrial ? `Sumaste ${REFERRAL_DAYS_REFERRER} días gratis a tu prueba.` : 'Te descontamos un mes de tu plan: te escribimos para aplicarlo.',
    url: '/app/plan',
  });
  if (!inTrial) {
    await admin.from('admin_audit').insert({ action: 'referido_credito_pendiente', target: referrer.id, details: { nuevo: newBakeryId, nombre: mine.name } });
  }
  return ` Te recomendó ${referrer.name}: sumaste ${REFERRAL_DAYS_NEW} días de prueba.`;
}

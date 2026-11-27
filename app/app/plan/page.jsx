import CopyLink from '../copy-link';
import { appUrl } from '@/lib/env';
import { requireBakery } from '@/lib/session';
import { subscribe } from '../actions';
import { Flash } from '../ui';
import { PRICES, moduleAccess } from '@/lib/modules';
import { money, dateTimeLabel } from '@/lib/format';
import { createAdmin } from '@/lib/supabase';
import { getPreapproval } from '@/lib/mp';
import { applyPreapproval } from '@/lib/billing';

export default async function Plan({ searchParams }) {
  const sp = await searchParams;
  let { bakery, sub, access } = await requireBakery();

  // Al volver de Mercado Pago, sincronizar el estado sin esperar el webhook
  if (sub?.mp_preapproval_id && sub.status !== 'active' && process.env.MP_PLATFORM_ACCESS_TOKEN) {
    try {
      const pre = await getPreapproval(process.env.MP_PLATFORM_ACCESS_TOKEN, sub.mp_preapproval_id);
      const updated = await applyPreapproval(createAdmin(), pre);
      if (updated) {
        sub = updated;
        access = moduleAccess(sub, bakery);
      }
    } catch {}
  }

  return (
    <>
      <h1>Tu plan</h1>
      <Flash sp={sp} />
      <div className="card">
        {access.trial && <p>Estás en la <strong>prueba gratis</strong> con todos los módulos hasta el {dateTimeLabel(access.trialEnds)}.</p>}
        {access.active && (
          <p>
            Suscripción <span className="badge ok">activa</span>: {[sub.has_base !== false && 'Base', sub.has_base !== false && sub.has_costs && 'Costos y producción', sub.has_base !== false && sub.has_recurring && 'Pedidos recurrentes', sub.has_base !== false && sub.has_whatsapp && 'Bot de WhatsApp', sub.has_marketing && 'Marketing IA'].filter(Boolean).join(' + ')} · {money(sub.amount)} por mes.
            Para cambiar o cancelar, gestionala desde tu cuenta de Mercado Pago (Suscripciones).
          </p>
        )}
        {!access.trial && !access.active && <p><span className="badge bad">Sin plan activo</span> Tu catálogo y el bot no toman pedidos nuevos hasta que actives un plan.</p>}
      </div>

      {!access.active && (
        <div className="card">
          <h2>Elegí tus módulos</h2>
          <form action={subscribe}>
            <div className="stack">
              <label className="inline-label"><input type="radio" name="pack" value="completo" defaultChecked={!access.marketingOnly} /> <strong>HakkiraApp para tu negocio</strong>: la Base y los módulos que elijas abajo.</label>
              <label className="inline-label"><input type="radio" name="pack" value="marketing" defaultChecked={access.marketingOnly} /> <strong>Solo Marketing IA</strong> — {money(PRICES.marketing)}/mes. El agente que crea tus publicaciones, guiones y kits de venta, sin agenda ni pedidos.</label>
            </div>
            <h3 style={{ marginTop: 16 }}>Módulos (si elegiste HakkiraApp para tu negocio)</h3>
            <div className="stack">
              <label className="inline-label"><input type="checkbox" checked readOnly disabled /> Base: agenda, cupos, señas, saldo, clientes, catálogo con personalización y stock — {money(PRICES.base)}/mes</label>
              <label className="inline-label"><input type="checkbox" name="costs" defaultChecked /> Costos y producción: recetas, precio mínimo, hoja de producción, lista de compras y rentabilidad — +{money(PRICES.costs)}/mes</label>
              <label className="inline-label"><input type="checkbox" name="recurring" /> Pedidos recurrentes: suscripciones semanales con débito automático — +{money(PRICES.recurring)}/mes</label>
              <label className="inline-label"><input type="checkbox" name="whatsapp" /> Bot de WhatsApp — +{money(PRICES.whatsapp)}/mes (+ costo de mensajes de Meta)</label>
              <label className="inline-label"><input type="checkbox" name="marketing" /> Marketing IA: publicaciones, guiones de reels, kits de venta por producto y aprobación antes de publicar — +{money(PRICES.marketing)}/mes</label>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>¿Cómo querés pagar?</label>
              <div className="stack">
                <label className="inline-label"><input type="radio" name="period" value="mensual" defaultChecked /> Mensual: se cobra todos los meses, cancelás cuando quieras.</label>
                <label className="inline-label"><input type="radio" name="period" value="anual" /> Anual: pagás 10 meses y usás 12 (<strong>2 meses gratis</strong>).</label>
              </div>
            </div>
            <p className="muted">Se cobra con Mercado Pago.</p>
            <button className="btn">Suscribirme con Mercado Pago</button>
          </form>
        </div>
      )}

      {bakery.referral_code && (
        <div className="card">
          <h2>Recomendá HakkiraApp y ganá meses gratis</h2>
          <p className="muted">Por cada negocio que se suma con tu link: vos ganás <strong>30 días gratis</strong> (o un mes de descuento si ya pagás) y él empieza con <strong>14 días extra</strong> de prueba.</p>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <code className="mono" style={{ wordBreak: 'break-all' }}>{`${appUrl()}/registro?ref=${bakery.referral_code}`}</code>
            <CopyLink value={`${appUrl()}/registro?ref=${bakery.referral_code}`} label="Copiar mi link" />
          </div>
        </div>
      )}
    </>
  );
}

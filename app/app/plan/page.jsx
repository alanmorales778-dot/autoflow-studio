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
        access = moduleAccess(sub);
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
            Suscripción <span className="badge ok">activa</span>: Base{sub.has_costs ? ' + Costos' : ''}{sub.has_whatsapp ? ' + Bot de WhatsApp' : ''} · {money(sub.amount)} por mes.
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
              <label className="inline-label"><input type="checkbox" checked readOnly disabled /> Base: agenda, cupos, señas, catálogo y stock — {money(PRICES.base)}/mes</label>
              <label className="inline-label"><input type="checkbox" name="costs" defaultChecked /> Costos: recetas, precio mínimo y alertas — +{money(PRICES.costs)}/mes</label>
              <label className="inline-label"><input type="checkbox" name="whatsapp" /> Bot de WhatsApp — +{money(PRICES.whatsapp)}/mes (+ costo de mensajes de Meta)</label>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>Se cobra todos los meses con Mercado Pago. Cancelás cuando quieras.</p>
            <button className="btn">Suscribirme con Mercado Pago</button>
          </form>
        </div>
      )}
    </>
  );
}

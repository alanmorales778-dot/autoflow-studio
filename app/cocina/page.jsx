import { rubroOf } from '@/lib/rubros';
import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { todayAR, addDays, dateLabel } from '@/lib/format';
import { optionsSummary } from '@/lib/options';
import Board from './board';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pantalla del día · AutoFlow' };

export default async function Cocina({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const T = rubroOf(bakery);
  const today = todayAR();
  const day = sp.dia === 'manana' ? addDays(today, 1) : today;

  if (!access.costs) {
    return (
      <div className="kitchen">
        <p className="eyebrow disp" style={{ margin: 0, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>{T.workMode}</p>
        <h1 className="disp">Está incluido en el módulo Costos y producción.</h1>
        <div className="row"><Link href="/app/plan" className="btn large">Ver planes</Link><Link href="/app" className="btn kitchen-exit">Volver al panel</Link></div>
      </div>
    );
  }

  const { data } = await supabase
    .from('orders')
    .select('id,quantity,product_name,slot,customer_name,fulfillment,address,options,dedication,allergies,notes,prepared_at,status')
    .eq('bakery_id', bakery.id)
    .eq('date', day)
    .in('status', ['confirmado', 'entregado'])
    .order('slot')
    .order('created_at');
  const { data: pendingRaw } = await supabase
    .from('orders')
    .select('id,quantity,product_name,slot,customer_name,expires_at,status')
    .eq('bakery_id', bakery.id)
    .eq('date', day)
    .eq('status', 'pendiente_sena')
    .order('slot');
  const pending = (pendingRaw || []).filter((o) => !o.expires_at || new Date(o.expires_at) > new Date());

  const items = (data || []).map((o) => ({
    id: o.id,
    qty: o.quantity,
    product: o.product_name,
    slot: o.slot,
    customer: o.customer_name,
    mode: o.fulfillment === 'envio' ? `${T.envio}${o.address ? ` · ${o.address}` : ''}` : T.retiro,
    options: Array.isArray(o.options) && o.options.length ? optionsSummary(o.options) : '',
    dedication: o.dedication,
    allergies: o.allergies,
    notes: o.notes,
    done: !!o.prepared_at || o.status === 'entregado',
  }));

  return (
    <div className="kitchen">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="eyebrow">{T.workMode} · {bakery.name}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <Link href="/cocina" className={`chip ${day === today ? 'on' : ''}`} style={day === today ? { background: '#fb923c', borderColor: '#fb923c', color: '#120e0b' } : { background: '#1e1814', borderColor: '#3a2f28', color: '#f6efe6' }}>Hoy · {dateLabel(today)}</Link>
            <Link href="/cocina?dia=manana" className={`chip ${day !== today ? 'on' : ''}`} style={day !== today ? { background: '#fb923c', borderColor: '#fb923c', color: '#120e0b' } : { background: '#1e1814', borderColor: '#3a2f28', color: '#f6efe6' }}>Mañana · {dateLabel(addDays(today, 1))}</Link>
          </div>
        </div>
        <Link href="/app" className="btn kitchen-exit">Volver al panel</Link>
      </div>
      <Board items={items} labels={{ note1: T.note1.label, note2: T.note2.label, warn: T.note2.warn }} />
      {pending.length > 0 && (
        <section aria-label="Esperando seña" style={{ border: '2px dashed #3a2f28', borderRadius: 18, padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Todavía sin seña · {T.pending}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 18, color: '#d9cbbe' }}>
            {pending.map((o) => (
              <li key={o.id}>{o.quantity} × {o.product_name} · {[o.slot, o.customer_name].filter(Boolean).join(' · ')}</li>
            ))}
          </ul>
        </section>
      )}
      <p style={{ margin: 0, fontSize: 15, color: '#a39283' }}>Tocá cada tarjeta cuando esté lista. Arriba solo aparecen los que ya tienen la seña pagada. La pantalla se actualiza sola cada minuto.</p>
    </div>
  );
}

import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { todayAR, addDays, dateLabel } from '@/lib/format';
import { optionsSummary } from '@/lib/options';
import Board from './board';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Modo cocina · AutoFlow Cocina' };

export default async function Cocina({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery, access } = await requireBakery();
  const today = todayAR();
  const day = sp.dia === 'manana' ? addDays(today, 1) : today;

  if (!access.costs) {
    return (
      <div className="kitchen">
        <p className="eyebrow disp" style={{ margin: 0, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Modo cocina</p>
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

  const items = (data || []).map((o) => ({
    id: o.id,
    qty: o.quantity,
    product: o.product_name,
    slot: o.slot,
    customer: o.customer_name,
    mode: o.fulfillment === 'envio' ? `Envío${o.address ? ` a ${o.address}` : ''}` : 'Retira',
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
          <div className="eyebrow">Modo cocina · {bakery.name}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <Link href="/cocina" className={`chip ${day === today ? 'on' : ''}`} style={day === today ? { background: '#fb923c', borderColor: '#fb923c', color: '#120e0b' } : { background: '#1e1814', borderColor: '#3a2f28', color: '#f6efe6' }}>Hoy · {dateLabel(today)}</Link>
            <Link href="/cocina?dia=manana" className={`chip ${day !== today ? 'on' : ''}`} style={day !== today ? { background: '#fb923c', borderColor: '#fb923c', color: '#120e0b' } : { background: '#1e1814', borderColor: '#3a2f28', color: '#f6efe6' }}>Mañana · {dateLabel(addDays(today, 1))}</Link>
          </div>
        </div>
        <Link href="/app" className="btn kitchen-exit">Salir del modo cocina</Link>
      </div>
      <Board items={items} />
      <p style={{ margin: 0, fontSize: 15, color: '#a39283' }}>Tocá cada tarjeta cuando esté lista. Solo aparecen pedidos con la seña pagada. La pantalla se actualiza sola cada minuto.</p>
    </div>
  );
}

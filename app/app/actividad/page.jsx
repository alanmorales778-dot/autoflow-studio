import { requireBakery } from '@/lib/session';
import { createAdmin } from '@/lib/supabase';
import { money, dateLabel } from '@/lib/format';
import Feed from './feed';

export const dynamic = 'force-dynamic';

export default async function Actividad() {
  const { supabase, bakery } = await requireBakery();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: orders }, { data: errors }] = await Promise.all([
    supabase
      .from('orders')
      .select('id,product_name,quantity,customer_name,date,channel,status,total,deposit_amount,created_at,paid_at,balance_paid_at,expires_at,prepared_at,subscription_id')
      .eq('bakery_id', bakery.id)
      .or(`created_at.gte.${since},paid_at.gte.${since},balance_paid_at.gte.${since},prepared_at.gte.${since}`)
      .order('created_at', { ascending: false })
      .limit(400),
    createAdmin().from('app_errors').select('at,source,message').eq('bakery_id', bakery.id).gte('at', since).order('at', { ascending: false }).limit(30),
  ]);

  const ev = [];
  const push = (at, kind, msg) => { if (at && at >= since) ev.push({ at, kind, msg }); };
  for (const o of orders || []) {
    const what = `${o.quantity}× ${o.product_name}`;
    const who = o.customer_name ? ` (${o.customer_name})` : '';
    const via = o.subscription_id ? 'Pedido recurrente generado' : o.channel === 'whatsapp' ? 'Nuevo pedido por WhatsApp' : o.channel === 'manual' ? 'Pedido cargado a mano' : 'Nuevo pedido desde tu link';
    push(o.created_at, 'pedido', `${via}: ${what} para el ${dateLabel(o.date)}${who}.`);
    if (o.paid_at) push(o.paid_at, 'pago', `Seña cobrada: ${money(o.deposit_amount)} · ${what}${who}.`);
    if (o.balance_paid_at) push(o.balance_paid_at, 'pago', `Saldo cobrado · ${what}${who}.`);
    if (o.prepared_at) push(o.prepared_at, 'cocina', `Listo en cocina: ${what}${who}.`);
    if (o.status === 'vencido' && o.expires_at) push(o.expires_at, 'cupo', `La seña venció sin pagarse: se liberó el lugar del ${dateLabel(o.date)} · ${what}.`);
  }
  if (bakery.last_sync_at) push(bakery.last_sync_at, 'costo', bakery.last_sync_error ? `Problema al leer tus planillas: ${bakery.last_sync_error}` : 'Planillas de Drive sincronizadas: costos y stock al día.');
  for (const e of errors || []) push(e.at, 'sistema', `Aviso técnico (${e.source}). Ya nos llegó la alerta.`);
  ev.sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Actividad</h1>
          <p>Todo lo que pasó en tu negocio en los últimos 30 días, en orden.</p>
        </div>
      </div>
      <Feed events={ev.slice(0, 300)} />
    </>
  );
}

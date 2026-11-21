import Link from 'next/link';
import { requireBakery } from '@/lib/session';
import { rubroOf } from '@/lib/rubros';
import { markBalance } from '../actions';
import { Flash } from '../ui';
import { todayAR, money, dateLabel } from '@/lib/format';
import { balanceDue, reminderLink } from '@/lib/balance';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

// Límites del mes en hora de Argentina (UTC-3, sin horario de verano)
function monthBounds(ym) {
  const [y, m] = ym.split('-').map(Number);
  return { start: `${ym}-01T00:00:00-03:00`, end: `${shiftMonth(ym, 1)}-01T00:00:00-03:00`, label: `${MONTHS[m - 1]} ${y}` };
}

const sum = (list, fn) => list.reduce((s, o) => s + fn(o), 0);

function hoursLabel(h) {
  if (h === null) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round(h / 24)} días`;
}

export default async function Cobros({ searchParams }) {
  const sp = await searchParams;
  const { supabase, bakery } = await requireBakery();
  const T = rubroOf(bakery);
  const today = todayAR();
  const ym = /^\d{4}-\d{2}$/.test(sp.mes || '') ? sp.mes : today.slice(0, 7);
  const { start, end, label } = monthBounds(ym);
  const isCurrent = ym === today.slice(0, 7);

  const cols = 'id,customer_name,customer_phone,product_name,quantity,total,deposit_amount,date,slot,status,fulfillment,address,paid_at,balance_paid_at,mp_payment_id,created_at,expires_at,public_token';
  const [{ data: deposits }, { data: balances }, { data: expired }, { data: pending }] = await Promise.all([
    supabase.from('orders').select(cols).eq('bakery_id', bakery.id).gte('paid_at', start).lt('paid_at', end).gt('deposit_amount', 0),
    supabase.from('orders').select(cols).eq('bakery_id', bakery.id).gte('balance_paid_at', start).lt('balance_paid_at', end),
    supabase.from('orders').select(cols).eq('bakery_id', bakery.id).eq('status', 'vencido').gte('expires_at', start).lt('expires_at', end),
    supabase.from('orders').select(cols).eq('bakery_id', bakery.id).in('status', ['confirmado', 'entregado']).is('balance_paid_at', null).order('date').limit(500),
  ]);

  // Comparación: el mes pasado completo y, si estamos en el mes actual, «a esta altura» del mes pasado.
  const prevYm = shiftMonth(ym, -1);
  const prevB = monthBounds(prevYm);
  const cut = isCurrent ? new Date(new Date(prevB.start).getTime() + (Date.now() - new Date(start).getTime())).toISOString() : prevB.end;
  const [{ data: pDep }, { data: pBal }] = await Promise.all([
    supabase.from('orders').select('paid_at,deposit_amount').eq('bakery_id', bakery.id).gte('paid_at', prevB.start).lt('paid_at', prevB.end).gt('deposit_amount', 0),
    supabase.from('orders').select('paid_at,balance_paid_at,total,deposit_amount').eq('bakery_id', bakery.id).gte('balance_paid_at', prevB.start).lt('balance_paid_at', prevB.end),
  ]);
  const prevAt = (limit) => sum((pDep || []).filter((o) => o.paid_at < limit), (o) => Number(o.deposit_amount))
    + sum((pBal || []).filter((o) => o.balance_paid_at < limit), (o) => Number(o.total) - (o.paid_at ? Number(o.deposit_amount) : 0));
  const prevFull = prevAt('9999');
  const prevSame = isCurrent ? prevAt(cut) : prevFull;
  const prevName = MONTHS[Number(prevYm.slice(5)) - 1];

  const dep = deposits || [];
  const bal = balances || [];
  const depMp = dep.filter((o) => o.mp_payment_id);
  const depTotal = sum(dep, (o) => Number(o.deposit_amount));
  const depMpTotal = sum(depMp, (o) => Number(o.deposit_amount));
  const balTotal = sum(bal, (o) => Number(o.total) - (o.paid_at ? Number(o.deposit_amount) : 0));
  const expiredList = expired || [];

  const waits = depMp.map((o) => (new Date(o.paid_at) - new Date(o.created_at)) / 3600000).filter((h) => h >= 0);
  const avgWait = waits.length ? sum(waits, (h) => h) / waits.length : null;

  const open = (pending || []).map((o) => ({ ...o, due: balanceDue(o) })).filter((o) => o.due > 0);
  const overdue = open.filter((o) => o.date < today);
  const upcoming = open.filter((o) => o.date >= today);

  return (
    <>
      <Flash sp={sp} />
      <h1>Cobros</h1>
      <div className="row between" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, textTransform: 'capitalize' }}>{label}</h2>
        <div className="row" style={{ gap: 6 }}>
          <Link className="btn secondary small" href={`/app/cobros?mes=${shiftMonth(ym, -1)}`} aria-label="Mes anterior">←</Link>
          {!isCurrent && <Link className="btn secondary small" href={`/app/cobros?mes=${shiftMonth(ym, 1)}`} aria-label="Mes siguiente">→</Link>}
        </div>
      </div>
      <p className="muted">Lo que entró en el mes y lo que todavía te deben.</p>

      <div className="grid grid-3">
        <div className="card kpi">
          <small className="muted">Cobrado en el mes</small>
          <div className="price">{money(depTotal + balTotal)}</div>
          <small className="muted">{money(depTotal)} en señas · {money(balTotal)} en saldos</small>
          {prevSame > 0 && (() => {
            const d = Math.round(((depTotal + balTotal - prevSame) / prevSame) * 100);
            return <small className={`delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`}>{d === 0 ? '=' : d > 0 ? '↑' : '↓'} {Math.abs(d)} % {d >= 0 ? 'más' : 'menos'} que {isCurrent ? `a esta altura de ${prevName}` : `en ${prevName}`}</small>;
          })()}
        </div>
        {bakery.mp_access_token_enc ? (
          <div className="card kpi">
            <small className="muted">Señas cobradas solas con Mercado Pago</small>
            <div className="price">{money(depMpTotal)}</div>
            <small className="muted">{depMp.length} {depMp.length === 1 ? T.order : T.orders.toLowerCase()} · tardaron {hoursLabel(avgWait)} en pagar en promedio</small>
          </div>
        ) : (
          <div className="card kpi">
            <small className="muted" style={{ textTransform: 'none' }}>Cobrado en {prevName}</small>
            <div className="price" style={{ color: 'var(--ink-2)' }}>{money(prevFull)}</div>
            <small className="muted">el mes completo</small>
          </div>
        )}
        <div className="card kpi">
          <small className="muted">Te deben hoy</small>
          <div className="price" style={overdue.length ? { color: 'var(--bad)' } : undefined}>{money(sum(overdue, (o) => o.due))}</div>
          <small className="muted">{overdue.length} {overdue.length === 1 ? `${T.order} ya pasó` : `${T.orders.toLowerCase()} ya pasaron`} sin saldo cobrado · {money(sum(upcoming, (o) => o.due))} a cobrar en próximas entregas</small>
        </div>
      </div>

      {expiredList.length > 0 && (
        <div className="alert info">
          <strong>{expiredList.length === 1 ? `1 ${T.order} no pagó` : `${expiredList.length} ${T.orders.toLowerCase()} no pagaron`} la seña a tiempo</strong> ({money(sum(expiredList, (o) => Number(o.total)))} en total) y el cupo se liberó solo para otros clientes.
        </div>
      )}

      <div className="card">
        <h2>Te deben</h2>
        {overdue.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Nadie te debe de {T.orders.toLowerCase()} anteriores. 🎉</p>
        ) : (
          <ul className="items">
            {overdue.map((o) => {
              const link = o.customer_phone ? reminderLink(bakery, o) : null;
              return (
                <li key={o.id} className="item">
                  <div className="item-head">
                    <div>
                      <div className="item-title">{o.customer_name}</div>
                      <div className="item-sub">{o.quantity} × {o.product_name} · {dateLabel(o.date)}{o.customer_phone ? ` · ${o.customer_phone}` : ''}</div>
                    </div>
                    <div className="item-title money-col" style={{ color: 'var(--bad)' }}>{money(o.due)}</div>
                  </div>
                  <div className="item-actions">
                    {link && <a className="btn small" href={link} target="_blank" rel="noreferrer">Recordar por WhatsApp</a>}
                    <form action={markBalance}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="back" value={`/app/cobros?mes=${ym}`} />
                      <button className="btn secondary small">Ya cobré</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {upcoming.length > 0 && (
        <details className="card fold">
          <summary><h2>A cobrar en las próximas entregas ({upcoming.length})</h2></summary>
          <ul className="items" style={{ marginTop: 8 }}>
            {upcoming.slice(0, 50).map((o) => (
              <li key={o.id} className="item">
                <div className="item-head">
                  <div>
                    <div className="item-title">{o.customer_name}</div>
                    <div className="item-sub">{o.quantity} × {o.product_name} · {dateLabel(o.date)}{o.slot ? ` · ${o.slot}` : ''}</div>
                  </div>
                  <div className="item-title money-col">{money(o.due)}</div>
                </div>
              </li>
            ))}
          </ul>
          {upcoming.length > 50 && <p className="muted">y {upcoming.length - 50} más.</p>}
        </details>
      )}
    </>
  );
}

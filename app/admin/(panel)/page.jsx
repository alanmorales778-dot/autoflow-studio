import Link from 'next/link';
import { requireAdmin, overview, accountState, daysLeft, ago } from '@/lib/admin';
import { money } from '@/lib/format';
import { RUBROS } from '@/lib/rubros';
import { Flash } from '@/app/app/ui';

export const dynamic = 'force-dynamic';

const WEEK = 7 * 86400000;

function weekBuckets(dates, weeks = 8) {
  const now = Date.now();
  const out = Array.from({ length: weeks }, (_, i) => ({ start: now - (weeks - i) * WEEK, n: 0 }));
  for (const d of dates) {
    const t = new Date(d).getTime();
    const idx = Math.floor((t - (now - weeks * WEEK)) / WEEK);
    if (idx >= 0 && idx < weeks) out[idx].n++;
  }
  return out.map((b) => ({ ...b, label: new Date(b.start + WEEK).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }) }));
}

function Bars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <div className="adm-bars" role="img" aria-label={data.map((d) => `${d.label}: ${d.n}`).join(', ')}>
      {data.map((d) => (
        <div className="b" key={d.start}>
          <span className="n">{d.n || ''}</span>
          <i style={{ height: `${(d.n / max) * 100}%` }} />
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Health({ label, at, maxMin, info }) {
  const min = at ? (Date.now() - new Date(at).getTime()) / 60000 : Infinity;
  const cls = min <= maxMin ? 'ok' : min <= maxMin * 3 ? 'warn' : 'bad';
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      <span className={`adm-dot ${cls}`} />
      <strong>{label}</strong> <span className="muted">· {at ? ago(at) : 'nunca'}</span>
      {info && <div className="muted" style={{ fontSize: 12, marginLeft: 14 }}>{info}</div>}
    </div>
  );
}

export default async function AdminHome({ searchParams }) {
  const sp = await searchParams;
  const { admin } = await requireAdmin('view');
  const rows = await overview(admin);
  const real = rows.filter((r) => !r.is_test && !r.admin_role);
  const withBiz = real.filter((r) => r.bakery_id);
  const states = real.map((r) => accountState(r).key);
  const count = (k) => states.filter((s) => s === k).length;
  const mrr = withBiz.filter((r) => r.sub_status === 'active' && !r.suspended_at).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const ended = count('activo') + count('vencido') + count('cancelado');
  const conversion = ended ? Math.round((100 * count('activo')) / ended) : null;
  const active7 = real.filter((r) => r.last_sign_in_at && Date.now() - new Date(r.last_sign_in_at).getTime() < WEEK).length;
  const orders30 = withBiz.reduce((s, r) => s + Number(r.orders_30d || 0), 0);
  const new30 = withBiz.filter((r) => Date.now() - new Date(r.bakery_created_at).getTime() < 30 * 86400000).length;

  const testIds = new Set(rows.filter((r) => r.is_test).map((r) => r.bakery_id));
  const { data: recentOrders } = await admin.from('orders').select('created_at,bakery_id').gte('created_at', new Date(Date.now() - 8 * WEEK).toISOString()).limit(10000);
  const ordersWeeks = weekBuckets((recentOrders || []).filter((o) => !testIds.has(o.bakery_id)).map((o) => o.created_at));
  const signupWeeks = weekBuckets(withBiz.map((r) => r.bakery_created_at));

  const byRubro = Object.entries(withBiz.reduce((m, r) => ({ ...m, [r.business_type]: (m[r.business_type] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);

  const { data: beats } = await admin.from('system_heartbeat').select('key,at,info');
  const beat = (k) => (beats || []).find((b) => b.key === k);
  const { count: err24 } = await admin.from('app_errors').select('id', { count: 'exact', head: true }).gte('at', new Date(Date.now() - 86400000).toISOString());
  const { count: fbNew } = await admin.from('pilot_feedback').select('id', { count: 'exact', head: true }).eq('status', 'nuevo');

  const endingSoon = withBiz.filter((r) => accountState(r).key === 'prueba' && daysLeft(r.trial_ends_at) <= 3);
  const pilotsQuiet = withBiz.filter((r) => r.pilot_status === 'activo' && (!r.last_order_at || Date.now() - new Date(r.last_order_at).getTime() > WEEK));
  const noBiz = real.filter((r) => !r.bakery_id);
  const sel = beat('selftest');

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <div>
          <h1>Resumen</h1>
          <p>Negocios reales (sin cuentas de prueba ni del equipo). Actualizado al abrir la página.</p>
        </div>
        <Link href="/admin/usuarios" className="btn secondary small">Ver usuarios</Link>
      </div>

      <div className="kpis">
        <div className="card kpi"><span className="l">Negocios</span><span className="v">{withBiz.length}</span><span className="s">+{new30} en 30 días</span></div>
        <div className="card kpi"><span className="l">En prueba</span><span className="v">{count('prueba')}</span><span className="s">{endingSoon.length} terminan en ≤ 3 días</span></div>
        <div className="card kpi"><span className="l">Pagando</span><span className="v">{count('activo')}</span><span className="s">{conversion === null ? 'sin pruebas terminadas' : `conversión ${conversion} %`}</span></div>
        <div className="card kpi"><span className="l">Ingreso mensual</span><span className="v">{money(mrr)}</span><span className="s">suscripciones activas</span></div>
        <div className="card kpi"><span className="l">Usaron la app (7 d)</span><span className="v">{active7}</span><span className="s">de {real.length} usuarios</span></div>
        <div className="card kpi"><span className="l">Pedidos (30 d)</span><span className="v">{orders30}</span><span className="s">en todos los negocios</span></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Pedidos por semana</h2>
          <Bars data={ordersWeeks} />
        </div>
        <div className="card">
          <h2>Negocios nuevos por semana</h2>
          <Bars data={signupWeeks} />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h2>Salud del sistema</h2>
          <Health label="Tarea cada 10 min" at={beat('cron')?.at} maxMin={20} info={beat('cron')?.info ? `vencidos ${beat('cron').info.expired ?? 0} · sincronizados ${beat('cron').info.synced ?? 0}` : null} />
          <Health label="Autoprueba diaria" at={sel?.at} maxMin={26 * 60} info={sel?.info ? `${sel.info.failed ?? 0} fallas de ${sel.info.total ?? 0}` : null} />
          <div style={{ padding: '8px 0' }}>
            <span className={`adm-dot ${err24 ? (err24 > 10 ? 'bad' : 'warn') : 'ok'}`} />
            <strong>Errores 24 h:</strong> {err24 || 0} <Link href="/admin/rendimiento#errores" style={{ fontSize: 13 }}>ver</Link>
          </div>
        </div>
        <div className="card">
          <h2>Para revisar</h2>
          <p><Link href="/admin/pilotos#comentarios">{fbNew || 0} comentarios nuevos</Link></p>
          <p><Link href="/admin/usuarios?f=prueba">{endingSoon.length} pruebas terminan en ≤ 3 días</Link></p>
          <p><Link href="/admin/pilotos#participantes">{pilotsQuiet.length} pilotos sin pedidos en 7 días</Link></p>
          <p style={{ marginBottom: 0 }}><Link href="/admin/usuarios?f=sin_negocio">{noBiz.length} usuarios sin crear su negocio</Link></p>
        </div>
        <div className="card">
          <h2>Por rubro</h2>
          {byRubro.length === 0 && <p className="muted">Todavía no hay negocios.</p>}
          {byRubro.map(([k, n]) => (
            <div key={k} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{RUBROS[k]?.label || k}</span><strong>{n}</strong>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

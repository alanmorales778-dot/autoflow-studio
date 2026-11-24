import Link from 'next/link';
import { requireAdmin, ago, bytes } from '@/lib/admin';
import { Flash } from '../../app/ui';
import { runSelftest } from '../actions';

export const dynamic = 'force-dynamic';

// Umbrales de Google para Core Web Vitals (p75): bueno / a mejorar
const VITALS = {
  LCP: { label: 'Carga del contenido principal (LCP)', unit: 'ms', good: 2500, poor: 4000, hint: 'Cuánto tarda en verse lo importante.' },
  INP: { label: 'Respuesta al tocar (INP)', unit: 'ms', good: 200, poor: 500, hint: 'Cuánto tarda en reaccionar a un toque o clic.' },
  CLS: { label: 'Saltos de pantalla (CLS)', unit: '', good: 0.1, poor: 0.25, hint: 'Cuánto se mueve el contenido mientras carga.' },
  FCP: { label: 'Primer contenido (FCP)', unit: 'ms', good: 1800, poor: 3000, hint: 'Cuándo aparece algo en pantalla.' },
  TTFB: { label: 'Respuesta del servidor (TTFB)', unit: 'ms', good: 800, poor: 1800, hint: 'Cuánto tarda el servidor en contestar.' },
};

function fmt(name, v) {
  if (v == null) return '—';
  if (name === 'CLS') return v.toFixed(3);
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
}
function cls(name, v) {
  const t = VITALS[name];
  if (v == null || !t) return '';
  return v <= t.good ? 'ok' : v <= t.poor ? 'warn' : 'bad';
}

export default async function Rendimiento({ searchParams }) {
  const sp = await searchParams;
  const { admin, can } = await requireAdmin('view');
  const days = [1, 7, 30].includes(Number(sp.d)) ? Number(sp.d) : 7;
  const { data: vitals } = await admin.rpc('web_vitals_summary', { p_days: days });
  const overall = new Map((vitals || []).filter((v) => v.route === '(todas)').map((v) => [v.name, v]));
  const routes = {};
  for (const v of vitals || []) {
    if (v.route === '(todas)') continue;
    (routes[v.route] ||= {})[v.name] = v;
  }
  const routeList = Object.entries(routes).sort((a, b) => (b[1].LCP?.samples || 0) - (a[1].LCP?.samples || 0)).slice(0, 25);

  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: errs } = await admin.from('app_errors').select('id,at,source,message,bakery_id').gte('at', since7).order('at', { ascending: false }).limit(300);
  const groups = Object.values((errs || []).reduce((m, e) => {
    const k = `${e.source}|${e.message}`;
    (m[k] ||= { source: e.source, message: e.message, n: 0, last: e.at, bakeries: new Set() }).n++;
    if (e.bakery_id) m[k].bakeries.add(e.bakery_id);
    return m;
  }, {})).sort((a, b) => b.n - a.n);
  const { data: beats } = await admin.from('system_heartbeat').select('key,at,info');
  const { data: db } = await admin.rpc('admin_db_stats');
  const sel = (beats || []).find((b) => b.key === 'selftest');

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <div>
          <h1>Rendimiento</h1>
          <p>Velocidad real que ven los usuarios (medida en sus celulares y computadoras), errores, tareas automáticas y base de datos.</p>
        </div>
        <div className="adm-filters" style={{ margin: 0 }}>
          {[1, 7, 30].map((d) => <Link key={d} href={`/admin/rendimiento?d=${d}`} className={days === d ? 'on' : ''}>{d === 1 ? '24 h' : `${d} días`}</Link>)}
        </div>
      </div>

      <div className="kpis">
        {Object.entries(VITALS).map(([k, t]) => {
          const v = overall.get(k);
          return (
            <div key={k} className="card kpi adm-vital">
              <span className="l">{t.label}</span>
              <span className="v"><span className={`adm-dot ${cls(k, v?.p75)}`} />{fmt(k, v?.p75)}</span>
              <span className="muted" style={{ fontSize: 12 }}>{v ? `${v.good_pct} % rápidas · ${v.samples} mediciones` : 'sin mediciones todavía'}</span>
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>Valor p75: 3 de cada 4 visitas fueron así de rápidas o más. Verde = bueno según Google; amarillo = a mejorar; rojo = lento.</p>

      <div className="card">
        <h2>Por página</h2>
        <div className="table-wrap">
          <table className="adm-table">
            <thead><tr><th>Página</th>{Object.keys(VITALS).map((k) => <th key={k} className="r">{k}</th>)}<th className="r">Visitas</th></tr></thead>
            <tbody>
              {!routeList.length && <tr><td colSpan={7} className="muted">Las mediciones empiezan a llegar cuando la gente usa la página con esta versión.</td></tr>}
              {routeList.map(([route, m]) => (
                <tr key={route}>
                  <td className="mono" style={{ fontSize: 12 }}>{route}</td>
                  {Object.keys(VITALS).map((k) => <td key={k} className="r"><span className={`adm-dot ${cls(k, m[k]?.p75)}`} />{fmt(k, m[k]?.p75)}</td>)}
                  <td className="r">{Math.max(0, ...Object.values(m).map((x) => Number(x.samples)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Tareas automáticas</h2>
          {(beats || []).map((b) => (
            <div key={b.key} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <strong>{b.key === 'cron' ? 'Tarea cada 10 min' : b.key === 'selftest' ? 'Autoprueba diaria' : b.key}</strong> <span className="muted">· {ago(b.at)}</span>
              <div className="mono muted" style={{ fontSize: 11, wordBreak: 'break-word' }}>{JSON.stringify(b.info)}</div>
            </div>
          ))}
          {sel?.info?.failedNames?.length > 0 && <div className="alert bad" style={{ marginTop: 10 }}>Última autoprueba falló en: {sel.info.failedNames.join(', ')}</div>}
          {can('support') && (
            <form action={runSelftest} style={{ marginTop: 12 }}>
              <button className="btn secondary small">Correr autoprueba ahora</button>
              <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>Revisa landing, login, registro, catálogos, base y cron (tarda unos segundos).</span>
            </form>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>Monitor externo: <a href="/api/health" target="_blank" rel="noreferrer">/api/health</a> (responde 503 si algo anda mal).</p>
        </div>
        <div className="card">
          <h2>Base de datos</h2>
          <p>Tamaño total: <strong>{bytes(db?.db_bytes)}</strong> <span className="muted" style={{ fontSize: 13 }}>(el plan gratis de Supabase permite 500 MB)</span></p>
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="adm-table">
              <thead><tr><th>Tabla</th><th className="r">Filas</th><th className="r">Tamaño</th></tr></thead>
              <tbody>
                {(db?.tables || []).map((t) => <tr key={t.name}><td className="mono" style={{ fontSize: 12 }}>{t.name}</td><td className="r">{t.rows}</td><td className="r">{bytes(t.bytes)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" id="errores">
        <h2>Errores de los últimos 7 días</h2>
        {!groups.length && <p className="muted">Sin errores. 🎉</p>}
        <div className="table-wrap">
          <table className="adm-table">
            {groups.length > 0 && <thead><tr><th>Origen</th><th>Mensaje</th><th className="r">Veces</th><th>Último</th><th className="r">Negocios</th></tr></thead>}
            <tbody>
              {groups.map((g, i) => (
                <tr key={i}>
                  <td><span className="badge bad">{g.source}</span></td>
                  <td style={{ fontSize: 13, maxWidth: 520 }}>{g.message}</td>
                  <td className="r">{g.n}</td>
                  <td>{ago(g.last)}</td>
                  <td className="r">{g.bakeries.size || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

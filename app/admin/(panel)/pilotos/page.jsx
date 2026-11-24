import Link from 'next/link';
import { requireAdmin, overview, accountState, daysLeft, ago, pilotUrl } from '@/lib/admin';
import { RUBROS, RUBRO_KEYS } from '@/lib/rubros';
import { Flash } from '@/app/app/ui';
import Copy from '@/app/admin/copy';
import { createInvite, toggleInvite, setParticipant, setFeedback } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

const KIND = { idea: 'Idea', error: 'Error', elogio: 'Le gustó', otro: 'Otro' };
const FB_FILTERS = [['nuevo', 'Nuevos'], ['visto', 'Vistos'], ['resuelto', 'Resueltos'], ['todos', 'Todos']];

export default async function Pilotos({ searchParams }) {
  const sp = await searchParams;
  const { admin, can } = await requireAdmin('view');
  const rows = await overview(admin);
  const { data: invites } = await admin.from('pilot_invites').select('*').order('created_at', { ascending: false });
  const pilots = rows.filter((r) => r.pilot_status);
  const fbf = FB_FILTERS.some(([k]) => k === sp.fb) ? sp.fb : 'nuevo';
  let fq = admin.from('pilot_feedback').select('*').order('created_at', { ascending: false }).limit(100);
  if (fbf !== 'todos') fq = fq.eq('status', fbf);
  const { data: feedback } = await fq;
  const byBakery = new Map(rows.filter((r) => r.bakery_id).map((r) => [r.bakery_id, r]));
  const { data: qa } = await admin.from('qa_results').select('bakery_id,result');
  const qaBy = (qa || []).reduce((m, x) => { (m[x.bakery_id] ||= { ok: 0, falla: 0 }); if (x.result !== 'pendiente') m[x.bakery_id][x.result]++; return m; }, {});
  const { data: ratings } = await admin.from('pilot_feedback').select('rating').not('rating', 'is', null);
  const avg = ratings?.length ? (ratings.reduce((s, x) => s + x.rating, 0) / ratings.length).toFixed(1) : null;
  const statusCount = (s) => pilots.filter((p) => p.pilot_status === s).length;
  const decided = statusCount('convertido') + statusCount('abandonado');

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <div>
          <h1>Programa piloto</h1>
          <p>Invitaciones con días de prueba extra, seguimiento de cada negocio piloto y lo que nos cuentan desde la app.</p>
        </div>
      </div>

      <div className="kpis">
        <div className="card kpi"><span className="l">Pilotos activos</span><span className="v">{statusCount('activo')}</span><span className="s">{pilots.length} en total</span></div>
        <div className="card kpi"><span className="l">Convertidos (pagan)</span><span className="v">{statusCount('convertido')}</span><span className="s">{decided ? `${Math.round((100 * statusCount('convertido')) / decided)} % de los que decidieron` : 'meta: 3 de 5–10'}</span></div>
        <div className="card kpi"><span className="l">Pedidos de pilotos (30 d)</span><span className="v">{pilots.reduce((s, p) => s + Number(p.orders_30d || 0), 0)}</span><span className="s">uso real</span></div>
        <div className="card kpi"><span className="l">Satisfacción</span><span className="v">{avg ? `${avg} ★` : '—'}</span><span className="s">{ratings?.length || 0} calificaciones</span></div>
      </div>

      <div className="card" id="invitaciones">
        <h2>Invitaciones</h2>
        <p className="muted" style={{ fontSize: 13 }}>Cada invitación es un link (<code>/piloto/CÓDIGO</code>) que abre una página de bienvenida y lleva al registro. Al crear su negocio, la cuenta queda como piloto con los días de prueba de la invitación y todos los módulos.</p>
        {can('manage') && (
          <form action={createInvite} className="grid grid-3" style={{ alignItems: 'end', marginBottom: 16 }}>
            <div className="field" style={{ margin: 0 }}><label>Nombre</label><input name="label" required placeholder="Ej: Pastelerías zona norte" /></div>
            <div className="field" style={{ margin: 0 }}><label>Código (opcional)</label><input name="code" placeholder="Se genera solo" style={{ textTransform: 'uppercase' }} /></div>
            <div className="field" style={{ margin: 0 }}>
              <label>Rubro sugerido</label>
              <select name="business_type" defaultValue=""><option value="">El que elija</option>{RUBRO_KEYS.map((k) => <option key={k} value={k}>{RUBROS[k].label}</option>)}</select>
            </div>
            <div className="field" style={{ margin: 0 }}><label>Días de prueba</label><input name="trial_days" type="number" min="1" max="365" defaultValue="30" /></div>
            <div className="field" style={{ margin: 0 }}><label>Cuántos pueden usarla</label><input name="max_uses" type="number" min="1" max="1000" defaultValue="1" /></div>
            <div className="field" style={{ margin: 0 }}><label>Vence en (días, 0 = nunca)</label><input name="expires_days" type="number" min="0" defaultValue="14" /></div>
            <div className="field" style={{ margin: 0 }}><label>Grupo</label><input name="cohort" placeholder="Ej: dic-2026" /></div>
            <div className="field" style={{ margin: 0 }}><label>Notas</label><input name="notes" placeholder="Ej: contacto por Instagram" /></div>
            <div><button className="btn block">Crear invitación</button></div>
          </form>
        )}
        <div className="table-wrap">
          <table className="adm-table">
            <thead><tr><th>Código</th><th>Nombre</th><th>Rubro</th><th className="r">Días</th><th className="r">Usos</th><th>Vence</th><th></th></tr></thead>
            <tbody>
              {!invites?.length && <tr><td colSpan={7} className="muted">Todavía no hay invitaciones.</td></tr>}
              {invites?.map((i) => {
                const expired = i.expires_at && new Date(i.expires_at) < new Date();
                const full = i.uses >= i.max_uses;
                const ok = i.active && !expired && !full;
                return (
                  <tr key={i.id}>
                    <td><strong className="mono">{i.code}</strong><small><span className={`badge ${ok ? 'ok' : 'bad'}`}>{!i.active ? 'Pausada' : expired ? 'Vencida' : full ? 'Agotada' : 'Activa'}</span></small></td>
                    <td>{i.label}<small className="muted">{[i.cohort, i.notes].filter(Boolean).join(' · ')}</small></td>
                    <td>{i.business_type ? RUBROS[i.business_type]?.short : '—'}</td>
                    <td className="r">{i.trial_days}</td>
                    <td className="r">{i.uses} / {i.max_uses}</td>
                    <td>{i.expires_at ? new Date(i.expires_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : 'Nunca'}</td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <Copy value={pilotUrl(i.code)} />
                        <a className="btn secondary small" href={`https://wa.me/?text=${encodeURIComponent(`Te invito a probar AutoFlow gratis ${i.trial_days} días como negocio piloto: ${pilotUrl(i.code)}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                        {can('manage') && (
                          <form action={toggleInvite}>
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="active" value={i.active ? '0' : '1'} />
                            <button className="btn ghost small">{i.active ? 'Pausar' : 'Activar'}</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" id="participantes">
        <h2>Negocios piloto</h2>
        <p className="muted" style={{ fontSize: 13 }}>También podés sumar una cuenta existente desde su ficha en Usuarios.</p>
        <div className="table-wrap">
          <table className="adm-table">
            <thead><tr><th>Negocio</th><th>Plan</th><th className="r">Pedidos 30 d</th><th>Último pedido</th><th>Último ingreso</th><th>Plan de pruebas</th><th>Estado del piloto</th></tr></thead>
            <tbody>
              {!pilots.length && <tr><td colSpan={7} className="muted">Todavía no hay pilotos. Creá una invitación y mandala.</td></tr>}
              {pilots.map((p) => {
                const st = accountState(p);
                const q = qaBy[p.bakery_id];
                const quiet = !p.last_order_at || Date.now() - new Date(p.last_order_at).getTime() > 7 * 86400000;
                return (
                  <tr key={p.bakery_id}>
                    <td><Link href={`/admin/usuarios/${p.user_id}`}><strong>{p.bakery_name}</strong></Link><small className="muted">{RUBROS[p.business_type]?.short} · {p.email}{p.pilot_cohort ? ` · ${p.pilot_cohort}` : ''}</small></td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span>{st.key === 'prueba' && <small className="muted">{daysLeft(p.trial_ends_at)} días</small>}</td>
                    <td className="r">{p.orders_30d}</td>
                    <td>{quiet ? <span className="badge warn">{ago(p.last_order_at)}</span> : ago(p.last_order_at)}</td>
                    <td>{ago(p.last_sign_in_at)}</td>
                    <td>{q ? <span>{q.ok} ✓ {q.falla ? <span style={{ color: 'var(--bad)' }}>· {q.falla} ✗</span> : null}</span> : <span className="muted">—</span>} <Link href={`/admin/pruebas?cuenta=${p.bakery_id}#plan`} style={{ fontSize: 12 }}>abrir</Link></td>
                    <td>
                      <form action={setParticipant} className="adm-inline">
                        <input type="hidden" name="bakery_id" value={p.bakery_id} />
                        <input type="hidden" name="back" value="/admin/pilotos#participantes" />
                        <select name="status" defaultValue={p.pilot_status} disabled={!can('support')}>
                          <option value="activo">Activo</option><option value="pausado">Pausado</option><option value="convertido">Convertido</option><option value="abandonado">Abandonó</option>
                        </select>
                        {can('support') && <button className="btn ghost small">OK</button>}
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" id="comentarios">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Comentarios desde la app</h2>
          <div className="adm-filters" style={{ margin: 0 }}>
            {FB_FILTERS.map(([k, l]) => <Link key={k} href={`/admin/pilotos?fb=${k}#comentarios`} className={fbf === k ? 'on' : ''}>{l}</Link>)}
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>Los pilotos y las cuentas de prueba ven un botón «Comentar» dentro de la app.</p>
        {!feedback?.length && <p className="muted">No hay comentarios en esta vista.</p>}
        {feedback?.map((f) => {
          const b = byBakery.get(f.bakery_id);
          return (
            <div key={f.id} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
              <div className="row" style={{ gap: 8 }}>
                <span className={`badge ${f.kind === 'error' ? 'bad' : f.kind === 'elogio' ? 'ok' : ''}`}>{KIND[f.kind]}</span>
                {f.rating ? <span style={{ color: '#f59e0b' }}>{'★'.repeat(f.rating)}<span style={{ color: '#d4d4d8' }}>{'★'.repeat(5 - f.rating)}</span></span> : null}
                <strong>{b ? <Link href={`/admin/usuarios/${b.user_id}`}>{b.bakery_name}</Link> : 'Negocio borrado'}</strong>
                <small className="muted">{ago(f.created_at)}{f.page ? ` · desde ${f.page}` : ''}</small>
              </div>
              <div className="adm-msg" style={{ margin: '6px 0' }}>{f.message}</div>
              {can('support') ? (
                <form action={setFeedback} className="adm-inline">
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="back" value={`/admin/pilotos?fb=${fbf}#comentarios`} />
                  <select name="status" defaultValue={f.status}><option value="nuevo">Nuevo</option><option value="visto">Visto</option><option value="resuelto">Resuelto</option></select>
                  <input name="admin_note" defaultValue={f.admin_note || ''} placeholder="Nota interna (qué hicimos)" style={{ minWidth: 220 }} />
                  <button className="btn secondary small">Guardar</button>
                </form>
              ) : f.admin_note && <small className="muted">Nota: {f.admin_note}</small>}
            </div>
          );
        })}
      </div>
    </>
  );
}

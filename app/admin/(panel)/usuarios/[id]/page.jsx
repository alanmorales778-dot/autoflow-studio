import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin, overview, accountState, daysLeft, ago } from '@/lib/admin';
import { RUBROS } from '@/lib/rubros';
import { money, dateTimeLabel } from '@/lib/format';
import { Flash, StatusBadge } from '@/app/app/ui';
import ConfirmButton from '@/app/app/confirm-button';
import LinkForm from '@/app/admin/link-form';
import {
  extendTrial, setPlan, suspendBakery, reactivateBakery, toggleTestFlag, saveAdminNotes,
  makeAccessLink, addParticipant, setParticipant, resetTestData, deleteTestAccount,
} from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function Ficha({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { admin, can } = await requireAdmin('view');
  const rows = await overview(admin);
  const r = rows.find((x) => x.user_id === id);
  if (!r) notFound();
  const here = `/admin/usuarios/${id}`;
  const st = accountState(r);

  let bakery = null;
  let orders = [];
  let feedback = [];
  let errors = [];
  let audits = [];
  let pilot = null;
  if (r.bakery_id) {
    const { data: noteRow } = await admin.from('bakery_admin_notes').select('notes').eq('bakery_id', r.bakery_id).maybeSingle();
    ({ data: bakery } = await admin.from('bakeries').select('id,name,slug,business_type,whatsapp_contact,pickup_address,created_at,suspended_reason,is_test,google_email,mp_access_token_enc,wa_phone_number_id,logo_url').eq('id', r.bakery_id).single());
    if (bakery) bakery.admin_notes = noteRow?.notes || '';
    ({ data: orders } = await admin.from('orders').select('id,product_name,customer_name,total,status,date,created_at,channel').eq('bakery_id', r.bakery_id).order('created_at', { ascending: false }).limit(8));
    ({ data: feedback } = await admin.from('pilot_feedback').select('id,kind,rating,message,status,created_at').eq('bakery_id', r.bakery_id).order('created_at', { ascending: false }).limit(10));
    ({ data: errors } = await admin.from('app_errors').select('id,at,source,message').eq('bakery_id', r.bakery_id).order('at', { ascending: false }).limit(10));
    ({ data: pilot } = await admin.from('pilot_participants').select('*, pilot_invites(code,label)').eq('bakery_id', r.bakery_id).maybeSingle());
  }
  ({ data: audits } = await admin.from('admin_audit').select('at,admin_email,action,details').in('target', [r.bakery_id, r.email].filter(Boolean)).order('at', { ascending: false }).limit(15));
  const dl = daysLeft(r.trial_ends_at);

  return (
    <>
      <Flash sp={sp} />
      <p style={{ marginBottom: 8 }}><Link href="/admin/usuarios">← Usuarios</Link></p>
      <div className="page-head">
        <div>
          <h1 style={{ wordBreak: 'break-word' }}>{r.bakery_name || r.email}</h1>
          <p>{r.email} · alta {ago(r.created_at)} · último ingreso {ago(r.last_sign_in_at)}{!r.confirmed ? ' · no confirmó el mail' : ''}</p>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className={`badge ${st.cls}`}>{st.label}</span>
          {r.pilot_status && <span className="badge">Piloto · {r.pilot_status}</span>}
          {r.is_test && <span className="badge">Cuenta de prueba</span>}
          {r.admin_role && <span className="badge ok">Equipo · {r.admin_role}</span>}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Perfil del negocio</h2>
          {!bakery && <p className="muted">Todavía no creó su negocio. Puede que no haya confirmado el mail o que no haya terminado el primer paso.</p>}
          {bakery && (
            <table>
              <tbody>
                <tr><th>Rubro</th><td>{RUBROS[bakery.business_type]?.label || bakery.business_type}</td></tr>
                <tr><th>Link</th><td><a href={`/c/${bakery.slug}`} target="_blank" rel="noreferrer">/c/{bakery.slug}</a></td></tr>
                <tr><th>WhatsApp</th><td>{bakery.whatsapp_contact || '—'}</td></tr>
                <tr><th>Dirección</th><td>{bakery.pickup_address || '—'}</td></tr>
                <tr><th>Productos</th><td>{r.products}</td></tr>
                <tr><th>Pedidos</th><td>{r.orders_total} en total · {r.orders_30d} en 30 días · último {ago(r.last_order_at)}</td></tr>
                <tr><th>Conexiones</th><td>
                  <div className="row" style={{ gap: 4 }}>
                    <span className={`badge ${bakery.google_email ? 'ok' : ''}`}>Drive {bakery.google_email ? '✓' : '—'}</span>
                    <span className={`badge ${bakery.mp_access_token_enc ? 'ok' : ''}`}>Mercado Pago {bakery.mp_access_token_enc ? '✓' : '—'}</span>
                    <span className={`badge ${bakery.wa_phone_number_id ? 'ok' : ''}`}>WhatsApp {bakery.wa_phone_number_id ? '✓' : '—'}</span>
                  </div>
                </td></tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Plan</h2>
          {!r.bakery_id ? <p className="muted">Sin negocio, sin plan.</p> : (
            <>
              <p>
                Estado: <strong>{r.sub_status || '—'}</strong>
                {r.sub_status === 'trial' && r.trial_ends_at && <> · prueba hasta {dateTimeLabel(r.trial_ends_at)} ({dl > 0 ? `${dl} días` : 'vencida'})</>}
                {r.amount ? <> · {money(r.amount)}/mes</> : null}
              </p>
              <p className="muted" style={{ fontSize: 13 }}>Módulos: {[r.has_base !== false && 'Base', r.has_costs && 'Costos', r.has_recurring && 'Recurrentes', r.has_whatsapp && 'Bot WhatsApp', r.has_marketing && 'Marketing IA'].filter(Boolean).join(' · ') || 'ninguno'}</p>
              {can('support') && (
                <form action={extendTrial} className="adm-inline" style={{ marginBottom: 12 }}>
                  <input type="hidden" name="bakery_id" value={r.bakery_id} />
                  <input type="hidden" name="back" value={here} />
                  <span>Extender prueba</span>
                  <select name="days" defaultValue="7"><option value="3">3 días</option><option value="7">7 días</option><option value="14">14 días</option><option value="30">30 días</option></select>
                  <button className="btn secondary small">Extender</button>
                </form>
              )}
              {can('manage') && (
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cambiar plan a mano</summary>
                  <form action={setPlan} style={{ marginTop: 10 }}>
                    <input type="hidden" name="bakery_id" value={r.bakery_id} />
                    <input type="hidden" name="back" value={here} />
                    <div className="row" style={{ gap: 8 }}>
                      <select name="status" defaultValue={r.sub_status || 'trial'} style={{ maxWidth: 180 }}>
                        <option value="trial">Prueba</option><option value="active">Activo (pagando)</option><option value="paused">Pausado</option><option value="cancelled">Cancelado</option>
                      </select>
                      <input name="amount" placeholder="Monto mensual" defaultValue={r.amount ?? ''} style={{ maxWidth: 150 }} />
                    </div>
                    <div className="row" style={{ gap: 14, margin: '10px 0' }}>
                      <label className="inline-label"><input type="checkbox" name="has_base" defaultChecked={r.has_base !== false} /> Base</label>
                      <label className="inline-label"><input type="checkbox" name="has_costs" defaultChecked={r.has_costs} /> Costos</label>
                      <label className="inline-label"><input type="checkbox" name="has_recurring" defaultChecked={r.has_recurring} /> Recurrentes</label>
                      <label className="inline-label"><input type="checkbox" name="has_whatsapp" defaultChecked={r.has_whatsapp} /> Bot WhatsApp</label>
                      <label className="inline-label"><input type="checkbox" name="has_marketing" defaultChecked={r.has_marketing} /> Marketing IA</label>
                    </div>
                    <p className="muted" style={{ fontSize: 12 }}>Si tiene una suscripción de Mercado Pago, el próximo aviso de MP puede volver a cambiar el estado.</p>
                    <button className="btn small">Guardar plan</button>
                  </form>
                </details>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Accesos</h2>
          {can('support') && (
            <>
              <p className="muted" style={{ fontSize: 13 }}>Si se olvidó la contraseña o no le llegó el mail, generá un link y mandáselo.</p>
              <LinkForm action={makeAccessLink} hidden={{ kind: 'recovery', email: r.email }} label="Link para nueva contraseña" shareText="Entrá desde acá para elegir una contraseña nueva de HakkiraApp" />
            </>
          )}
          {can('manage') && r.is_test && (
            <div style={{ marginTop: 14 }}>
              <LinkForm action={makeAccessLink} hidden={{ kind: 'magiclink', email: r.email }} label="Entrar a esta cuenta de prueba" className="btn dark small" />
            </div>
          )}
          {!can('support') && <p className="muted">Tu perfil es de solo lectura.</p>}
        </div>

        <div className="card">
          <h2>Administración</h2>
          {r.bakery_id && can('manage') && (
            <>
              {r.suspended_at ? (
                <form action={reactivateBakery} style={{ marginBottom: 12 }}>
                  <input type="hidden" name="bakery_id" value={r.bakery_id} />
                  <input type="hidden" name="back" value={here} />
                  <div className="alert bad">Suspendido {ago(r.suspended_at)}{bakery?.suspended_reason ? `: ${bakery.suspended_reason}` : ''}</div>
                  <button className="btn small">Reactivar negocio</button>
                </form>
              ) : (
                <form action={suspendBakery} className="adm-inline" style={{ marginBottom: 12 }}>
                  <input type="hidden" name="bakery_id" value={r.bakery_id} />
                  <input type="hidden" name="back" value={here} />
                  <input name="reason" placeholder="Motivo (lo ve solo el equipo)" style={{ minWidth: 200 }} />
                  <ConfirmButton className="btn danger small" message="El link deja de tomar pedidos y el panel queda bloqueado hasta que lo reactives. ¿Suspender?">Suspender</ConfirmButton>
                </form>
              )}
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <form action={toggleTestFlag}>
                  <input type="hidden" name="bakery_id" value={r.bakery_id} />
                  <input type="hidden" name="value" value={r.is_test ? '0' : '1'} />
                  <input type="hidden" name="back" value={here} />
                  <button className="btn secondary small">{r.is_test ? 'Quitar marca de prueba' : 'Marcar como cuenta de prueba'}</button>
                </form>
                {!r.pilot_status && (
                  <form action={addParticipant} className="adm-inline">
                    <input type="hidden" name="bakery_id" value={r.bakery_id} />
                    <input type="hidden" name="back" value={here} />
                    <input name="cohort" placeholder="Grupo (opcional)" style={{ width: 140 }} />
                    <button className="btn secondary small">Sumar al piloto</button>
                  </form>
                )}
              </div>
              {r.is_test && (
                <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                  <form action={resetTestData} className="adm-inline">
                    <input type="hidden" name="bakery_id" value={r.bakery_id} />
                    <input type="hidden" name="back" value={here} />
                    <label className="inline-label" style={{ fontSize: 13 }}><input type="checkbox" name="seed" defaultChecked /> cargar ejemplo</label>
                    <ConfirmButton className="btn secondary small" message="Se borran pedidos, clientes, avisos y compras de esta cuenta de prueba. ¿Seguir?">Reiniciar datos</ConfirmButton>
                  </form>
                  <form action={deleteTestAccount}>
                    <input type="hidden" name="bakery_id" value={r.bakery_id} />
                    <input type="hidden" name="back" value={here} />
                    <ConfirmButton className="btn danger small" message="Se borra la cuenta de prueba y todo su contenido. No se puede deshacer. ¿Borrar?">Borrar cuenta de prueba</ConfirmButton>
                  </form>
                </div>
              )}
            </>
          )}
          {pilot && (
            <form action={setParticipant} style={{ marginBottom: 12 }}>
              <input type="hidden" name="bakery_id" value={r.bakery_id} />
              <input type="hidden" name="back" value={here} />
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Piloto desde {ago(pilot.started_at)}{pilot.pilot_invites ? ` · invitación ${pilot.pilot_invites.code}` : ''}{pilot.cohort ? ` · grupo ${pilot.cohort}` : ''}</div>
              <div className="adm-inline">
                <select name="status" defaultValue={pilot.status}><option value="activo">Activo</option><option value="pausado">Pausado</option><option value="convertido">Convertido (paga)</option><option value="abandonado">Abandonó</option></select>
                <input name="notes" defaultValue={pilot.notes || ''} placeholder="Notas del piloto" style={{ minWidth: 200 }} />
                {can('support') && <button className="btn secondary small">Guardar</button>}
              </div>
            </form>
          )}
          {r.bakery_id && (
            <form action={saveAdminNotes}>
              <input type="hidden" name="bakery_id" value={r.bakery_id} />
              <input type="hidden" name="back" value={here} />
              <label style={{ fontSize: 13, fontWeight: 600 }}>Notas internas</label>
              <textarea name="admin_notes" rows={3} defaultValue={bakery?.admin_notes || ''} placeholder="Ej: la llamé el 25/11, quiere la factura C" readOnly={!can('support')} />
              {can('support') && <button className="btn secondary small" style={{ marginTop: 8 }}>Guardar notas</button>}
            </form>
          )}
        </div>
      </div>

      {r.bakery_id && (
        <div className="grid grid-2">
          <div className="card">
            <h2>Últimos pedidos</h2>
            {!orders?.length && <p className="muted">Sin pedidos.</p>}
            {orders?.map((o) => (
              <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span><strong>{o.product_name}</strong> <span className="muted">· {o.customer_name} · {o.channel}</span><br /><small className="muted">{ago(o.created_at)} · para el {o.date}</small></span>
                <span style={{ textAlign: 'right' }}>{money(o.total)}<br /><StatusBadge status={o.status} /></span>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>Comentarios y errores</h2>
            {!feedback?.length && !errors?.length && <p className="muted">Nada para mostrar.</p>}
            {feedback?.map((f) => (
              <div key={`f${f.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="badge">{f.kind}</span> {f.rating ? '★'.repeat(f.rating) : ''} <small className="muted">{ago(f.created_at)} · {f.status}</small>
                <div className="adm-msg">{f.message}</div>
              </div>
            ))}
            {errors?.map((e) => (
              <div key={`e${e.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="badge bad">{e.source}</span> <small className="muted">{ago(e.at)}</small>
                <div style={{ fontSize: 13 }}>{e.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Historial de administración</h2>
        {!audits?.length && <p className="muted">Nadie del equipo hizo cambios en esta cuenta.</p>}
        {audits?.map((a, i) => (
          <div key={i} style={{ fontSize: 13, padding: '4px 0' }}><span className="muted">{ago(a.at)}</span> · {a.admin_email} · <strong>{a.action.replace(/_/g, ' ')}</strong></div>
        ))}
      </div>
    </>
  );
}

import Link from 'next/link';
import { requireAdmin, overview, accountState, daysLeft, ago } from '@/lib/admin';
import { RUBROS, RUBRO_KEYS } from '@/lib/rubros';
import { Flash } from '@/app/app/ui';
import LinkForm from '@/app/admin/link-form';
import { inviteUser } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

const FILTERS = [
  ['', 'Todos'],
  ['prueba', 'En prueba'],
  ['activo', 'Pagando'],
  ['vencido', 'Prueba vencida'],
  ['piloto', 'Pilotos'],
  ['test', 'Cuentas de prueba'],
  ['suspendido', 'Suspendidos'],
  ['sin_negocio', 'Sin negocio'],
  ['equipo', 'Equipo'],
];

function match(r, f) {
  if (!f) return true;
  if (f === 'piloto') return !!r.pilot_status;
  if (f === 'test') return r.is_test;
  if (f === 'equipo') return !!r.admin_role;
  return accountState(r).key === f;
}

export default async function Usuarios({ searchParams }) {
  const sp = await searchParams;
  const { admin, can } = await requireAdmin('view');
  const rows = await overview(admin);
  const f = String(sp.f || '');
  const q = String(sp.q || '').trim().toLowerCase();
  const list = rows.filter((r) => match(r, f) && (!q || [r.email, r.bakery_name, r.slug].some((x) => x && x.toLowerCase().includes(q))));
  const { data: invites } = await admin.from('pilot_invites').select('code,label').eq('active', true).order('created_at', { ascending: false }).limit(30);

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <div>
          <h1>Usuarios</h1>
          <p>{rows.length} cuentas en total. Tocá una para ver su ficha, cambiar el plan o generar un acceso.</p>
        </div>
      </div>

      {can('manage') && (
        <details className="card" id="invitar">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>+ Dar usuario a alguien (invitación)</summary>
          <p className="muted" style={{ marginTop: 10 }}>Se crea la cuenta y te damos un link para mandarle. Al abrirlo elige su contraseña y crea su negocio con el rubro que pongas acá. Si le asignás un código piloto, recibe los días de prueba de esa invitación.</p>
          <LinkForm action={inviteUser} label="Crear usuario y generar link" className="btn small" shareText="Te invito a probar HakkiraApp. Entrá desde acá para crear tu contraseña">
            <input name="email" type="email" required placeholder="email@cliente.com" style={{ maxWidth: 240 }} />
            <input name="business_name" placeholder="Nombre del negocio (opcional)" style={{ maxWidth: 220 }} />
            <select name="business_type" defaultValue="cocina" style={{ maxWidth: 200 }}>
              {RUBRO_KEYS.map((k) => <option key={k} value={k}>{RUBROS[k].label}</option>)}
            </select>
            <select name="pilot_code" defaultValue="" style={{ maxWidth: 220 }}>
              <option value="">Sin código piloto</option>
              {(invites || []).map((i) => <option key={i.code} value={i.code}>{i.code} · {i.label}</option>)}
            </select>
          </LinkForm>
        </details>
      )}

      <form className="row" style={{ marginBottom: 10 }} role="search">
        {f && <input type="hidden" name="f" value={f} />}
        <input name="q" defaultValue={q} placeholder="Buscar por email, negocio o link…" style={{ maxWidth: 340 }} />
        <button className="btn secondary small">Buscar</button>
        {q && <Link href={`/admin/usuarios${f ? `?f=${f}` : ''}`} className="muted" style={{ fontSize: 13 }}>Limpiar</Link>}
      </form>
      <div className="adm-filters">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/admin/usuarios${k || q ? '?' : ''}${new URLSearchParams({ ...(k ? { f: k } : {}), ...(q ? { q } : {}) }).toString()}`} className={f === k ? 'on' : ''}>
            {label} <span className="muted">{rows.filter((r) => match(r, k)).length}</span>
          </Link>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Usuario</th><th>Negocio</th><th>Estado</th><th className="r">Pedidos 30 d</th><th>Último ingreso</th><th>Marcas</th></tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={6} className="muted">No hay cuentas con ese filtro.</td></tr>}
              {list.map((r) => {
                const st = accountState(r);
                const dl = daysLeft(r.trial_ends_at);
                return (
                  <tr key={r.user_id}>
                    <td>
                      <Link href={`/admin/usuarios/${r.user_id}`}><strong>{r.email}</strong></Link>
                      <small className="muted">alta {ago(r.created_at)}{!r.confirmed ? ' · sin confirmar mail' : ''}</small>
                    </td>
                    <td>
                      {r.bakery_id ? <>{r.bakery_name}<small className="muted">{RUBROS[r.business_type]?.short || r.business_type} · /c/{r.slug}</small></> : <span className="muted">—</span>}
                    </td>
                    <td>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      {st.key === 'prueba' && dl !== null && <small className="muted">{dl === 1 ? 'queda 1 día' : `quedan ${dl} días`}</small>}
                    </td>
                    <td className="r">{r.bakery_id ? r.orders_30d : '—'}<small className="muted">{r.bakery_id ? `${r.orders_total} total` : ''}</small></td>
                    <td>{ago(r.last_sign_in_at)}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        {r.pilot_status && <span className="badge">Piloto · {r.pilot_status}</span>}
                        {r.is_test && <span className="badge">Prueba</span>}
                        {r.admin_role && <span className="badge ok">Equipo</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

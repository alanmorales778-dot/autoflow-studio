import { requireAdmin, ROLES, ago } from '@/lib/admin';
import { Flash } from '@/app/app/ui';
import ConfirmButton from '@/app/app/confirm-button';
import { addTeamMember, setTeamRole, removeTeamMember } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

const MATRIX = [
  ['Ver resumen, usuarios, pilotos, pruebas y rendimiento', ['owner', 'admin', 'soporte', 'lectura']],
  ['Extender pruebas, generar link de nueva contraseña', ['owner', 'admin', 'soporte']],
  ['Responder comentarios, marcar el plan de pruebas, notas', ['owner', 'admin', 'soporte']],
  ['Dar usuario (invitar), cambiar plan, suspender', ['owner', 'admin']],
  ['Crear invitaciones piloto y cuentas de prueba', ['owner', 'admin']],
  ['Entrar a cuentas de prueba, reiniciarlas o borrarlas', ['owner', 'admin']],
  ['Sumar o sacar gente del equipo y cambiar perfiles', ['owner']],
];

export default async function Equipo({ searchParams }) {
  const sp = await searchParams;
  const { admin, user, can } = await requireAdmin('view');
  const { data: team } = await admin.from('platform_admins').select('*').order('created_at');

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <div>
          <h1>Equipo y perfiles</h1>
          <p>Quién del equipo de HakkiraApp entra a este panel y qué puede hacer. Los clientes nunca ven el panel: si abren /admin les aparece «página no encontrada».</p>
        </div>
      </div>

      <div className="card">
        <h2>Equipo</h2>
        <div className="table-wrap">
          <table className="adm-table">
            <thead><tr><th>Persona</th><th>Perfil</th><th>Desde</th><th></th></tr></thead>
            <tbody>
              {(team || []).map((m) => (
                <tr key={m.user_id}>
                  <td><strong>{m.email}</strong>{m.user_id === user.id && <small className="muted">vos</small>}</td>
                  <td>
                    {can('team') && m.user_id !== user.id ? (
                      <form action={setTeamRole} className="adm-inline">
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <select name="role" defaultValue={m.role}>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select>
                        <button className="btn ghost small">Cambiar</button>
                      </form>
                    ) : <span className="badge">{ROLES[m.role]?.label}</span>}
                  </td>
                  <td>{ago(m.created_at)}</td>
                  <td>
                    {can('team') && m.user_id !== user.id && (
                      <form action={removeTeamMember}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <ConfirmButton className="btn danger small" message={`¿Sacar a ${m.email} del panel? Su cuenta sigue existiendo.`}>Sacar</ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {can('team') && (
          <form action={addTeamMember} className="row" style={{ marginTop: 14, gap: 8 }}>
            <input name="email" type="email" required placeholder="email de la persona" style={{ maxWidth: 260 }} />
            <select name="role" defaultValue="soporte" style={{ maxWidth: 200 }}>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select>
            <button className="btn small">Sumar al equipo</button>
            <span className="muted" style={{ fontSize: 12 }}>La persona tiene que tener cuenta en HakkiraApp (si no, dale usuario desde Usuarios).</span>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Qué puede hacer cada perfil</h2>
        <div className="table-wrap">
          <table className="adm-table">
            <thead><tr><th>Acción</th>{Object.entries(ROLES).map(([k, r]) => <th key={k} style={{ textAlign: 'center' }}>{r.label}</th>)}</tr></thead>
            <tbody>
              {MATRIX.map(([label, roles]) => (
                <tr key={label}>
                  <td>{label}</td>
                  {Object.keys(ROLES).map((k) => <td key={k} style={{ textAlign: 'center', color: roles.includes(k) ? 'var(--ok)' : 'var(--muted)' }}>{roles.includes(k) ? '✓' : '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

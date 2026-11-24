import { requireAdmin, ago } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function Auditoria() {
  const { admin } = await requireAdmin('view');
  const { data: log } = await admin.from('admin_audit').select('*').order('at', { ascending: false }).limit(200);
  const { data: biz } = await admin.from('bakeries').select('id,name');
  const names = new Map((biz || []).map((b) => [b.id, b.name]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Auditoría</h1>
          <p>Todo lo que hizo el equipo desde este panel (últimos 200 movimientos). No se puede borrar desde acá.</p>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="adm-table">
            <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Sobre</th><th>Detalle</th></tr></thead>
            <tbody>
              {!log?.length && <tr><td colSpan={5} className="muted">Todavía no hay movimientos.</td></tr>}
              {log?.map((a) => (
                <tr key={a.id}>
                  <td title={a.at}>{ago(a.at)}</td>
                  <td>{a.admin_email}</td>
                  <td><strong>{a.action.replace(/_/g, ' ')}</strong></td>
                  <td>{names.get(a.target) || a.target || '—'}</td>
                  <td className="mono" style={{ fontSize: 11, maxWidth: 360, wordBreak: 'break-word' }}>{Object.keys(a.details || {}).length ? JSON.stringify(a.details) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

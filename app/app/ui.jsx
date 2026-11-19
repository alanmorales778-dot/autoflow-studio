import { STATUS_LABEL } from '@/lib/format';

export function Flash({ sp }) {
  if (!sp) return null;
  return (
    <>
      {sp.error && <div className="alert bad">{sp.error}</div>}
      {sp.ok && <div className="alert ok">{sp.ok}</div>}
    </>
  );
}

export function StatusBadge({ status }) {
  const cls = status === 'confirmado' || status === 'entregado' ? 'ok' : status === 'pendiente_sena' ? 'warn' : 'bad';
  return <span className={`badge ${cls}`}>{STATUS_LABEL[status] || status}</span>;
}

export function UploadCard({ kind, action, driveConnected }) {
  const label = kind === 'insumos' ? 'insumos y precios' : 'productos, precios y stock';
  return (
    <div className="card" id="importar">
      <h2>Actualizar con un archivo</h2>
      <p className="muted">
        Subí un Excel (.xlsx) o CSV con tus {label}. Usá las mismas columnas que la plantilla: los títulos tienen que estar en la primera fila.
        {driveConnected
          ? ' Como tenés Google Drive conectado, el archivo reemplaza tu planilla completa: tildá la casilla para confirmar.'
          : ' Por defecto se actualiza y se agrega lo que venga en el archivo, sin tocar el resto.'}
        {' '}Antes de aplicar te mostramos qué cambia.
      </p>
      <form action={action} className="row">
        <input type="hidden" name="kind" value={kind} />
        <input type="file" name="file" accept=".xlsx,.csv,.txt" required style={{ maxWidth: 360 }} />
        <label className="inline-label" style={{ margin: 0 }}><input type="checkbox" name="replace" /> Reemplazar la lista completa ({kind === 'insumos' ? 'borra' : 'oculta'} lo que no esté en el archivo)</label>
        <button className="btn">Subir y revisar</button>
        <a className="btn secondary" href={`/api/export/${kind}`}>Descargar planilla actual (.xlsx)</a>
      </form>
    </div>
  );
}

export function Locked({ title, children }) {
  return (
    <div className="alert info">
      <strong>{title}</strong>
      <div>{children} <a href="/app/plan">Ver planes →</a></div>
    </div>
  );
}

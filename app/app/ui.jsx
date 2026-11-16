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

export function Locked({ title, children }) {
  return (
    <div className="alert info">
      <strong>{title}</strong>
      <div>{children} <a href="/app/plan">Ver planes →</a></div>
    </div>
  );
}

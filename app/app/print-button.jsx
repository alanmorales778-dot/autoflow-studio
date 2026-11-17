'use client';

export default function PrintButton({ label = 'Imprimir' }) {
  return (
    <button type="button" className="btn secondary small no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}

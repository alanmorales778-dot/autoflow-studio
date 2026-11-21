import Link from 'next/link';

// «Costos y ganancias»: una sola entrada del menú con dos pestañas (antes eran dos secciones sueltas).
export default function NumerosTabs({ active }) {
  const tabs = [
    ['/app/rentabilidad', 'ganancia', 'Ganancia del mes'],
    ['/app/costos', 'costos', 'Si suben los precios'],
  ];
  return (
    <nav className="tabs-bar no-print" aria-label="Costos y ganancias">
      {tabs.map(([href, key, label]) => (
        <Link key={key} href={href} className={active === key ? 'on' : ''} aria-current={active === key ? 'page' : undefined}>{label}</Link>
      ))}
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  ['/admin', 'Resumen'],
  ['/admin/usuarios', 'Usuarios'],
  ['/admin/pilotos', 'Pilotos', 'pilotos'],
  ['/admin/pruebas', 'Pruebas'],
  ['/admin/rendimiento', 'Rendimiento', 'rendimiento'],
  ['/admin/equipo', 'Equipo y perfiles'],
  ['/admin/auditoria', 'Auditoría'],
];

export default function AdminNav({ badges = {} }) {
  const path = usePathname();
  return (
    <nav className="adm-nav" aria-label="Panel de administración">
      <div className="adm-nav-in">
        {ITEMS.map(([href, label, badge]) => {
          const on = href === '/admin' ? path === '/admin' : path.startsWith(href);
          return (
            <Link key={href} href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
              {label}
              {badge && badges[badge] > 0 && <span className="dot">{badges[badge]}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

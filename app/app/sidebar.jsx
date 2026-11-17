'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const I = {
  agenda: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  pedidos: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  cobros: 'M2 7h20v12H2zM2 11h20M6 15h4',
  produccion: 'M6 13.9A4 4 0 0 1 7.5 6a5 5 0 0 1 9 0A4 4 0 0 1 18 13.9V21H6zM6 17h12',
  clientes: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  recurrentes: 'M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2M21 4v5h-5M3 20v-5h5',
  productos: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  insumos: 'M4 7h16M4 12h16M4 17h10',
  costos: 'M3 17l6-6 4 4 8-8M14 7h7v7',
  rentabilidad: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  actividad: 'M22 12h-4l-3 9L9 3l-3 9H2',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.8H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.8-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.8H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  plan: 'M20 12V8H6a2 2 0 0 1 0-4h12v4M4 6v12a2 2 0 0 0 2 2h14v-4M18 12a2 2 0 0 0 0 4h4v-4z',
};

const GROUPS = [
  ['Operación', [['/app', 'Agenda', 'agenda'], ['/app/pedidos', 'Pedidos', 'pedidos'], ['/app/cobros', 'Cobros', 'cobros'], ['/app/produccion', 'Producción y compras', 'produccion'], ['/app/clientes', 'Clientes', 'clientes'], ['/app/suscripciones', 'Recurrentes', 'recurrentes']]],
  ['Catálogo y costos', [['/app/productos', 'Productos', 'productos'], ['/app/insumos', 'Insumos', 'insumos'], ['/app/costos', 'Costos e inflación', 'costos'], ['/app/rentabilidad', 'Rentabilidad', 'rentabilidad']]],
  ['Cuenta', [['/app/actividad', 'Actividad', 'actividad'], ['/app/configuracion', 'Ajustes', 'ajustes'], ['/app/plan', 'Plan', 'plan']]],
];

const KEYS = { a: '/app', p: '/app/pedidos', n: '/app/pedidos#nuevo', c: '/cocina', b: '/app/cobros', r: '/app/costos' };

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      const to = KEYS[e.key.toLowerCase()];
      if (!to) return;
      e.preventDefault();
      router.push(to);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <nav className="side no-print" aria-label="Secciones">
      {GROUPS.map(([title, links]) => (
        <div key={title} style={{ display: 'contents' }}>
          <div className="side-group">{title}</div>
          {links.map(([href, label, icon]) => {
            const on = href === '/app' ? path === '/app' : path.startsWith(href);
            return (
              <Link key={href} href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={I[icon]} /></svg>
                {label}
              </Link>
            );
          })}
        </div>
      ))}
      <p className="kbd-hint">Atajos: <kbd>A</kbd> agenda · <kbd>P</kbd> pedidos · <kbd>N</kbd> pedido nuevo · <kbd>B</kbd> cobros · <kbd>R</kbd> costos · <kbd>C</kbd> modo cocina</p>
    </nav>
  );
}

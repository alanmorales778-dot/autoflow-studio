'use client';

import { useEffect, useState } from 'react';
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
  recetas: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5M9 7h7M9 11h5',
  costos: 'M3 17l6-6 4 4 8-8M14 7h7v7',
  rentabilidad: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  actividad: 'M22 12h-4l-3 9L9 3l-3 9H2',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.8H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.8-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.8H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  plan: 'M20 12V8H6a2 2 0 0 1 0-4h12v4M4 6v12a2 2 0 0 0 2 2h14v-4M18 12a2 2 0 0 0 0 4h4v-4z',
};

// Menú corto: lo de todos los días arriba; lo que se toca de vez en cuando, abajo.
// [ruta, texto, ícono, otras rutas que también lo marcan como activo]
const groups = (t) => [
  ['Día a día', [
    ['/app', 'Agenda', 'agenda'],
    ['/app/pedidos', t.orders, 'pedidos'],
    ['/app/cobros', 'Cobros', 'cobros'],
    ['/app/produccion', t.prodTitle, 'produccion'],
    ['/app/clientes', 'Clientes', 'clientes'],
    ...(t.recurring ? [['/app/suscripciones', 'Recurrentes', 'recurrentes']] : []),
  ]],
  ['Tu negocio', [
    ['/app/productos', t.items, 'productos'],
    ['/app/insumos', t.insumos, 'insumos'],
    ['/app/recetas', t.recetas || 'Recetas', 'recetas'],
    ['/app/rentabilidad', 'Costos y ganancias', 'rentabilidad', ['/app/costos']],
  ]],
  ['Cuenta', [
    ['/app/configuracion', 'Ajustes', 'ajustes', ['/app/actividad']],
    ['/app/plan', 'Plan', 'plan'],
  ]],
];

const KEYS = { a: '/app', p: '/app/pedidos', n: '/app/pedidos?nuevo=1#nuevo', c: '/cocina', b: '/app/cobros', r: '/app/costos' };

export default function Sidebar({ terms }) {
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
      {groups(terms).map(([title, links]) => (
        <div key={title} style={{ display: 'contents' }}>
          <div className="side-group">{title}</div>
          {links.map(([href, label, icon, also = []]) => {
            const on = href === '/app' ? path === '/app' : [href, ...also].some((h) => path.startsWith(h));
            return (
              <Link key={href} href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={I[icon]} /></svg>
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// Celular: barra de abajo con lo de todos los días y «Más» para el resto (antes era una tira con 10 botones).
export function BottomNav({ terms, catalogUrl, signOutAction }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => { setMore(false); }, [path]);
  useEffect(() => {
    document.body.style.overflow = more ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [more]);

  const main = [
    ['/app', 'Agenda', 'agenda', (p) => p === '/app'],
    ['/app/pedidos', terms.orders, 'pedidos', (p) => p.startsWith('/app/pedidos')],
    null,
    ['/app/produccion?ver=compras', 'Compras', 'compras', (p) => p.startsWith('/app/produccion')],
  ];
  const rest = groups(terms).flatMap(([, links]) => links).filter(([href]) => !['/app', '/app/pedidos', '/app/produccion'].includes(href));
  const moreOn = rest.some(([href, , , also = []]) => [href, ...also].some((h) => path.startsWith(h))) || path.startsWith('/app/buscar');

  return (
    <>
      <nav className="bottom-nav no-print" aria-label="Secciones principales">
        {main.map((it) => (it === null ? (
          <Link key="nuevo" href="/app/pedidos?nuevo=1#nuevo" className="bn-add" aria-label={`Cargar ${terms.order} nuevo`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </Link>
        ) : (
          <Link key={it[0]} href={it[0]} className={`bn-item ${it[3](path) ? 'on' : ''}`} aria-current={it[3](path) ? 'page' : undefined}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={it[2] === 'compras' ? 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2M10 20.5h.01M17 20.5h.01' : I[it[2]]} /></svg>
            <span>{it[1]}</span>
          </Link>
        )))}
        <button type="button" className={`bn-item ${more || moreOn ? 'on' : ''}`} onClick={() => setMore(true)} aria-expanded={more}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          <span>Más</span>
        </button>
      </nav>
      {more && (
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet more-sheet" role="dialog" aria-label="Más secciones" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" aria-hidden="true" />
            <Link href="/app/buscar" className="more-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" /></svg>
              Buscar {terms.orders.toLowerCase()}, clientes o {terms.items.toLowerCase()}…
            </Link>
            <div className="more-grid">
              {[['/app/produccion', terms.prodTitle, 'produccion'], ...rest].map(([href, label, icon, also = []]) => {
                const on = [href, ...also].some((h) => path.startsWith(h)) && !(href === '/app/produccion' && false);
                return (
                  <Link key={href} href={href} className={`more-tile ${on ? 'on' : ''}`}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={I[icon]} /></svg>
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="more-links">
              <a href={catalogUrl} target="_blank" rel="noreferrer">Ver mi catálogo ↗</a>
              <Link href="/cocina">{terms.workMode}</Link>
              <form action={signOutAction}><button type="submit">Salir</button></form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

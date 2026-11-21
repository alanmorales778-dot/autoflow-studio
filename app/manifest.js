// La app instalable: nombre, ícono y cómo se abre desde la pantalla de inicio del celular.
export default function manifest() {
  return {
    name: 'AutoFlow',
    short_name: 'AutoFlow',
    description: 'Pedidos, turnos, señas y costos de tu negocio.',
    id: '/app',
    start_url: '/app?app=1',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fafaf9',
    theme_color: '#18181b',
    lang: 'es-AR',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Cargar pedido', url: '/app/pedidos?nuevo=1#nuevo', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Lista de compras', url: '/app/produccion?ver=compras', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}

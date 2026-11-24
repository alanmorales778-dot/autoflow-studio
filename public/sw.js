// HakkiraApp: recibe los avisos aunque la app esté cerrada y abre la pantalla correcta al tocarlos.
const VERSION = 'af-1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'HakkiraApp', body: event.data && event.data.text() }; }
  const title = data.title || 'HakkiraApp';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: data.tag || VERSION,
      renotify: true,
      data: { url: data.url || '/app' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/app', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.location.origin)) {
        await c.focus();
        if ('navigate' in c) return c.navigate(url);
        return undefined;
      }
    }
    return self.clients.openWindow(url);
  })());
});

// Si se pierde la conexión mientras usa la app, muestra un aviso simple en vez de la pantalla del navegador.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => new Response(
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#faf7f2;color:#1f1915;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><div style="font-size:40px">📶</div><h1 style="font-size:20px">Sin conexión</h1><p style="color:#74665b">Revisá tu internet y volvé a intentar.</p><button onclick="location.reload()" style="margin-top:8px;background:#c2410c;color:#fff;border:0;padding:12px 18px;border-radius:10px;font-weight:700;font-size:15px">Reintentar</button></div></body>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )),
  );
});

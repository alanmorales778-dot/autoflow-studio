'use client';

import { useReportWebVitals } from 'next/web-vitals';

// Mide la velocidad real que ve cada visitante (Core Web Vitals) y la manda a /api/vitals.
// Se ve en /admin/rendimiento. No manda datos personales: solo la página (sin ids) y el número.
const NAMES = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);

export function normRoute(path) {
  const p = String(path || '/').split('?')[0].split('#')[0];
  return p
    .replace(/^\/c\/[^/]+/, '/c/:slug')
    .replace(/^\/cal\/[^/]+/, '/cal/:token')
    .replace(/^\/piloto\/[^/]+/, '/piloto/:code')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/[0-9a-f]{20,}/gi, '/:token')
    .slice(0, 80) || '/';
}

export default function WebVitals() {
  useReportWebVitals((m) => {
    if (!NAMES.has(m.name)) return;
    try {
      const body = JSON.stringify({
        name: m.name,
        value: m.value,
        rating: m.rating,
        route: normRoute(window.location.pathname),
        device: window.matchMedia('(max-width: 860px)').matches ? 'mobile' : 'desktop',
      });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/vitals', new Blob([body], { type: 'application/json' }));
      else fetch('/api/vitals', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } });
    } catch {}
  });
  return null;
}

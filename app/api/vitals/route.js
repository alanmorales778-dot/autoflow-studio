import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Recibe las mediciones de velocidad del navegador (ver app/web-vitals.jsx).
// Valida todo: el endpoint es público, así que solo acepta nombres y rangos razonables.
const MAX = { LCP: 60000, INP: 30000, CLS: 10, FCP: 60000, TTFB: 60000 };
const RATINGS = new Set(['good', 'needs-improvement', 'poor']);

export async function POST(request) {
  try {
    const text = await request.text();
    if (text.length > 1000) return new NextResponse(null, { status: 413 });
    const m = JSON.parse(text);
    const max = MAX[m?.name];
    const value = Number(m?.value);
    const route = String(m?.route || '');
    if (!max || !Number.isFinite(value) || value < 0 || value > max) return new NextResponse(null, { status: 204 });
    if (!route.startsWith('/') || route.length > 80 || !/^[\w\-/:.]*$/.test(route)) return new NextResponse(null, { status: 204 });
    await createAdmin().from('web_vitals').insert({
      name: m.name,
      value,
      route,
      rating: RATINGS.has(m.rating) ? m.rating : null,
      device: m.device === 'mobile' ? 'mobile' : 'desktop',
    });
  } catch {
    // una medición perdida no importa
  }
  return new NextResponse(null, { status: 204 });
}

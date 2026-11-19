import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase';
import { safeEqual } from '@/lib/crypto';
import { appUrl } from '@/lib/env';
import { reportError, heartbeat } from '@/lib/alerts';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Autoprueba diaria (pg_cron): recorre las páginas públicas, los catálogos de los negocios activos,
// la base y el cron. Si algo falla, avisa por ALERT_WEBHOOK_URL y queda en app_errors.
async function run(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const base = appUrl();
  const admin = createAdmin();
  const checks = [];
  const check = async (name, fn) => {
    try {
      const r = await fn();
      checks.push({ name, ok: r === true, detail: r === true ? '' : String(r) });
    } catch (e) {
      checks.push({ name, ok: false, detail: String(e.message || e).slice(0, 200) });
    }
  };
  const page = (path, must, status = 200) => async () => {
    const res = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'autoflow-selftest' } });
    if (res.status !== status) return `HTTP ${res.status}`;
    if (must) {
      const body = await res.text();
      if (body.includes('Application error: a server-side exception')) return 'error de servidor en la página';
      if (!body.includes(must)) return `no aparece «${must}»`;
    }
    return true;
  };

  await check('landing', page('/', 'Dejá de responder pedidos'));
  await check('login', page('/login', 'Hola de nuevo'));
  await check('registro', page('/registro', 'Probá 14 días gratis'));
  await check('legal', page('/legal', 'Ley 25.326'));
  await check('panel sin sesión redirige', page('/app', null, 307));
  await check('calendario inválido da 404', page('/cal/tokenInventadoQueNoExiste123456789.ics', null, 404));
  await check('base de datos', async () => {
    const { error } = await admin.from('bakeries').select('id', { head: true, count: 'exact' });
    return error ? error.message : true;
  });
  await check('cron corriendo', async () => {
    const { data } = await admin.from('system_heartbeat').select('at').eq('key', 'cron').maybeSingle();
    if (!data) return 'sin registro del cron';
    const min = (Date.now() - new Date(data.at).getTime()) / 60000;
    return min < 30 ? true : `último tick hace ${Math.round(min)} min`;
  });
  const { data: bakeries } = await admin.from('bakeries').select('slug').order('created_at', { ascending: false }).limit(30);
  for (const b of bakeries || []) await check(`catálogo /c/${b.slug}`, page(`/c/${b.slug}`, '</html>'));

  const failed = checks.filter((c) => !c.ok);
  if (failed.length) await reportError('selftest', `Autoprueba: ${failed.length} de ${checks.length} fallaron — ${failed.map((f) => `${f.name}: ${f.detail}`).join(' · ')}`);
  await heartbeat('selftest', { total: checks.length, failed: failed.length });
  return NextResponse.json({ ok: failed.length === 0, total: checks.length, failed });
}

export const GET = run;
export const POST = run;

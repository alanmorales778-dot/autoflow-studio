import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase';
import { expireDueOrders } from '@/lib/lifecycle';
import { syncBakery } from '@/lib/sheets';
import { safeEqual } from '@/lib/crypto';
import { generateRecurringOrders, refreshPendingSubscriptions } from '@/lib/recurring';
import { reportError, heartbeat } from '@/lib/alerts';
import { sendMorningDigests } from '@/lib/digest';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Se llama cada 10 minutos (pg_cron en Supabase o Vercel Cron):
// 1) vence señas no pagadas y libera cupos  2) sincroniza planillas de Drive que cambiaron
async function run(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdmin();
  const failures = [];
  let expired = 0;
  try {
    expired = await expireDueOrders(admin);
  } catch (e) {
    failures.push('señas');
    await reportError('cron:vencer-senas', e);
  }
  let recurring = 0;
  try {
    await refreshPendingSubscriptions(admin);
    recurring = await generateRecurringOrders(admin);
  } catch (e) {
    failures.push('recurrentes');
    await reportError('cron:recurrentes', e);
  }

  let digests = 0;
  try {
    digests = await sendMorningDigests(admin);
  } catch (e) {
    failures.push('resumen');
    await reportError('cron:resumen', e);
  }

  const staleBefore = new Date(Date.now() - 9 * 60000).toISOString();
  const { data: bakeries } = await admin
    .from('bakeries')
    .select('*')
    .not('google_refresh_token_enc', 'is', null)
    .not('sheet_productos_id', 'is', null)
    .or(`last_sync_at.is.null,last_sync_at.lt.${staleBefore}`)
    .order('last_sync_at', { ascending: true, nullsFirst: true })
    .limit(15);
  const results = [];
  for (const b of bakeries || []) {
    try {
      const r = await syncBakery(admin, b);
      results.push({ id: b.id, changed: !!r.changed, error: r.error || null });
    } catch (e) {
      // r.error son problemas de la planilla del cliente (se le muestran a él); esto es una falla nuestra
      failures.push('drive');
      results.push({ id: b.id, changed: false, error: String(e.message || e) });
      await reportError('cron:sync-drive', e, { bakeryId: b.id });
    }
  }
  await heartbeat('cron', { expired, recurring, digests, synced: results.length, failures });
  return NextResponse.json({ ok: failures.length === 0, expired, recurring, digests, synced: results.length, failures, results });
}

export const GET = run;
export const POST = run;

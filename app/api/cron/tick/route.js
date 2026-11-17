import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase';
import { expireDueOrders } from '@/lib/lifecycle';
import { syncBakery } from '@/lib/sheets';
import { safeEqual } from '@/lib/crypto';
import { generateRecurringOrders, refreshPendingSubscriptions } from '@/lib/recurring';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Se llama cada 10 minutos (pg_cron en Supabase o Vercel Cron):
// 1) vence señas no pagadas y libera cupos  2) sincroniza planillas de Drive que cambiaron
async function run(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdmin();
  const expired = await expireDueOrders(admin);
  let recurring = 0;
  try {
    await refreshPendingSubscriptions(admin);
    recurring = await generateRecurringOrders(admin);
  } catch (e) {
    console.error('recurring', e);
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
    const r = await syncBakery(admin, b);
    results.push({ id: b.id, changed: !!r.changed, error: r.error || null });
  }
  return NextResponse.json({ ok: true, expired, recurring, synced: results.length, results });
}

export const GET = run;
export const POST = run;

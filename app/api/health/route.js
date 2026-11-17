import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Para un monitor externo (UptimeRobot, Better Stack, etc.): responde 503 si la base no contesta
// o si la tarea de cada 10 minutos no corrió en la última media hora.
// No expone datos de clientes: solo estados y la hora de la última corrida.
const MAX_CRON_AGE_MIN = 30;

export async function GET() {
  const checks = { db: false, cron: false, cronLastRun: null, errorsLastHour: null };
  try {
    const admin = createAdmin();
    const { data, error } = await admin.from('system_heartbeat').select('at').eq('key', 'cron').maybeSingle();
    if (error) throw error;
    checks.db = true;
    if (data?.at) {
      checks.cronLastRun = data.at;
      checks.cron = Date.now() - new Date(data.at).getTime() < MAX_CRON_AGE_MIN * 60000;
    }
    const { count } = await admin
      .from('app_errors')
      .select('id', { count: 'exact', head: true })
      .gte('at', new Date(Date.now() - 3600000).toISOString());
    checks.errorsLastHour = count ?? 0;
  } catch {
    // checks.db queda en false
  }
  const ok = checks.db && checks.cron;
  return NextResponse.json({ ok, ...checks }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}

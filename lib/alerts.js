// Registro de errores internos y aviso a los dueños de HakkiraApp.
// - Siempre se guarda en la tabla app_errors (solo accesible con la service role).
// - Si ALERT_WEBHOOK_URL está cargada (Discord, Slack o Google Chat), se manda un aviso,
//   como máximo uno por hora para el mismo origen y mensaje.
import { createAdmin } from './supabase';

const THROTTLE_MS = 60 * 60 * 1000;

function messageOf(err) {
  if (!err) return 'Error desconocido';
  if (typeof err === 'string') return err;
  return String(err.message || err).slice(0, 500);
}

async function postWebhook(url, text) {
  // Discord usa "content"; Slack y Google Chat usan "text".
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text.slice(0, 1900), text }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`webhook ${res.status}`);
}

export async function reportError(source, err, { bakeryId = null, ...context } = {}) {
  const message = messageOf(err);
  console.error(`[${source}]`, message, context, err?.stack || '');
  try {
    const admin = createAdmin();
    const since = new Date(Date.now() - THROTTLE_MS).toISOString();
    const { count } = await admin
      .from('app_errors')
      .select('id', { count: 'exact', head: true })
      .eq('source', source)
      .eq('message', message)
      .eq('notified', true)
      .gte('at', since);
    const url = process.env.ALERT_WEBHOOK_URL;
    let notified = false;
    if (url && !count) {
      try {
        const where = bakeryId ? ` · negocio ${bakeryId}` : '';
        await postWebhook(url, `⚠️ HakkiraApp · ${source}${where}\n${message}`);
        notified = true;
      } catch (e) {
        console.error('[alerts] no se pudo avisar', e.message);
      }
    }
    await admin.from('app_errors').insert({ source, message, context, bakery_id: bakeryId, notified });
  } catch (e) {
    console.error('[alerts] no se pudo registrar', e.message);
  }
}

export async function heartbeat(key, info = {}) {
  try {
    await createAdmin().from('system_heartbeat').upsert({ key, at: new Date().toISOString(), info });
  } catch (e) {
    console.error('[heartbeat]', e.message);
  }
}

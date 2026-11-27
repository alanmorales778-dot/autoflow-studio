// Tareas del cron de cada 10 minutos para las redes conectadas:
// 1) publicar las piezas aprobadas con publicación automática cuya hora llegó
// 2) renovar los permisos de Instagram antes de que venzan (duran 60 días)
import { notify } from './notifications';
import { reportError } from './alerts';
import { encrypt, decrypt } from './crypto';
import { getIgAccount, igPublishPhoto, igRefresh, hasInstagram } from './instagram';

const MAX_ATTEMPTS = 3;

export function captionOf(content) {
  const tags = (content?.hashtags || []).slice(0, 30).join(' ');
  return [content?.texto, tags].filter(Boolean).join('\n\n').slice(0, 2200);
}

async function bakeryOf(admin, id) {
  const { data } = await admin.from('bakeries').select('*').eq('id', id).maybeSingle();
  return data;
}

export async function publishDue(admin) {
  if (!hasInstagram()) return { published: 0, failed: 0 };
  const { data: due } = await admin.from('marketing_items')
    .select('id,bakery_id,title,content,product_id,publish_attempts')
    .eq('auto_publish', true).eq('status', 'aprobada').lte('publish_at', new Date().toISOString())
    .lt('publish_attempts', MAX_ATTEMPTS).order('publish_at').limit(3);
  let published = 0;
  let failed = 0;
  for (const it of due || []) {
    // Se «reserva» la pieza sumando un intento: si otro cron ya la tomó, no se publica dos veces.
    const { data: claimed } = await admin.from('marketing_items').update({ publish_attempts: it.publish_attempts + 1, updated_at: new Date().toISOString() })
      .eq('id', it.id).eq('publish_attempts', it.publish_attempts).eq('status', 'aprobada').select('id');
    if (!claimed?.length) continue;
    const bakery = await bakeryOf(admin, it.bakery_id);
    try {
      const account = await getIgAccount(admin, it.bakery_id);
      if (!account || account.status !== 'ok') throw Object.assign(new Error('Instagram no está conectado.'), { final: true });
      const { data: product } = it.product_id ? await admin.from('products').select('photo_url').eq('id', it.product_id).maybeSingle() : { data: null };
      if (!product?.photo_url) throw Object.assign(new Error('El producto ya no tiene foto.'), { final: true });
      const r = await igPublishPhoto(account, { imageUrl: product.photo_url, caption: captionOf(it.content) });
      await admin.from('marketing_items').update({
        status: 'publicada', published_at: new Date().toISOString(), external_post_id: String(r.id), external_url: r.permalink, publish_error: null, updated_at: new Date().toISOString(),
      }).eq('id', it.id);
      published += 1;
      if (bakery) await notify(admin, bakery, { kind: 'marketing', title: 'Se publicó en Instagram', body: it.title, url: `/app/marketing/pieza/${it.id}` });
    } catch (e) {
      failed += 1;
      const msg = String(e?.message || e).slice(0, 480);
      const last = e?.final || it.publish_attempts + 1 >= MAX_ATTEMPTS;
      await admin.from('marketing_items').update({ publish_error: msg, ...(last ? { auto_publish: false } : {}), updated_at: new Date().toISOString() }).eq('id', it.id);
      if (last && bakery) await notify(admin, bakery, { kind: 'marketing', title: 'No se pudo publicar en Instagram', body: `${it.title}: ${msg}`.slice(0, 380), url: `/app/marketing/pieza/${it.id}` });
      if (!e?.final) await reportError('instagram:publicar', e, { bakeryId: it.bakery_id });
    }
  }
  return { published, failed };
}

export async function refreshSocialTokens(admin) {
  if (!hasInstagram()) return 0;
  const soon = new Date(Date.now() + 10 * 86400000).toISOString();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const { data: accs } = await admin.from('social_accounts').select('*').eq('network', 'instagram').eq('status', 'ok')
    .lt('token_expires_at', soon).lt('refreshed_at', dayAgo).limit(20);
  let n = 0;
  for (const a of accs || []) {
    try {
      const r = await igRefresh(decrypt(a.token_enc));
      await admin.from('social_accounts').update({ token_enc: encrypt(r.token), token_expires_at: r.expiresAt, refreshed_at: new Date().toISOString(), last_error: null }).eq('id', a.id);
      n += 1;
    } catch (e) {
      const expired = a.token_expires_at && new Date(a.token_expires_at) < new Date();
      await admin.from('social_accounts').update({ last_error: String(e?.message || e).slice(0, 480), ...(expired ? { status: 'vencida' } : {}) }).eq('id', a.id);
      if (expired) {
        const bakery = await bakeryOf(admin, a.bakery_id);
        if (bakery) await notify(admin, bakery, { kind: 'marketing', title: 'Volvé a conectar Instagram', body: 'El permiso para publicar venció. Entrá a Marketing IA → Redes y tocá «Conectar».', url: '/app/marketing/redes' });
      }
      await reportError('instagram:renovar', e, { bakeryId: a.bakery_id });
    }
  }
  return n;
}

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireBakery } from '@/lib/session';
import { createAdmin } from '@/lib/supabase';
import { hasAI } from '@/lib/ai';
import { notify } from '@/lib/notifications';
import { reportError } from '@/lib/alerts';
import { addDays, todayAR } from '@/lib/format';
import { buildContext, generatePiece, planWeek, generateKit, usage, reviewPiece, KINDS, GOALS } from '@/lib/marketing';
import { getIgAccount, isPublicJpeg, hasInstagram } from '@/lib/instagram';

const HOME = '/app/marketing';
const internal = (path) => (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : HOME);

function back(path, { error, ok } = {}) {
  path = internal(path);
  const p = new URLSearchParams();
  if (error) p.set('error', String(error).slice(0, 300));
  if (ok) p.set('ok', String(ok).slice(0, 300));
  const qs = p.toString();
  const [base, hash] = String(path).split('#');
  redirect(qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}${hash ? `#${hash}` : ''}` : path);
}

const str = (fd, k, n = 600) => String(fd.get(k) ?? '').trim().slice(0, n);
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ''));
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

async function guard(from = HOME) {
  const ctx = await requireBakery();
  if (!ctx.access.marketing) back('/app/plan', { error: 'Activá el módulo Marketing IA para usar el agente.' });
  return ctx;
}

async function guardAI(ctx, from, pieces = 1) {
  if (!hasAI()) back(from, { error: 'La IA todavía no está configurada. Avisanos y la activamos.' });
  const u = await usage(ctx.supabase, ctx.bakery.id);
  if (u.piecesLeft < pieces) back(from, { error: 'Llegaste al límite de publicaciones de este mes. El mes que viene se renueva.' });
  if (u.todayLeft < pieces) back(from, { error: 'Llegaste al límite de publicaciones de hoy. Probá de nuevo mañana.' });
  return u;
}

async function ownProduct(supabase, bakeryId, id) {
  if (!isUuid(id)) return null;
  const { data } = await supabase.from('products').select('id,name,price,description,category,cost,min_price,photo_url,visible').eq('bakery_id', bakeryId).eq('id', id).maybeSingle();
  return data || null;
}

async function ownItem(supabase, bakeryId, id) {
  if (!isUuid(id)) return null;
  const { data } = await supabase.from('marketing_items').select('*').eq('bakery_id', bakeryId).eq('id', id).maybeSingle();
  return data || null;
}

function networksOf(fd) {
  const n = ['instagram', 'facebook', 'tiktok'].filter((k) => fd.get(`net_${k}`) === 'on');
  return n.length ? n : ['instagram', 'facebook'];
}

// ---------- Perfil de marca ----------

export async function saveBrand(fd) {
  const { supabase, bakery } = await guard();
  const row = {
    bakery_id: bakery.id,
    tone: str(fd, 'tone', 300) || null,
    audience: str(fd, 'audience', 300) || null,
    differential: str(fd, 'differential', 300) || null,
    pillars: str(fd, 'pillars', 300) || null,
    location: str(fd, 'location', 120) || null,
    hashtags: str(fd, 'hashtags', 300) || null,
    banned_words: str(fd, 'banned_words', 300) || null,
    examples: str(fd, 'examples', 1500) || null,
    emojis: fd.get('emojis') === 'on',
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('marketing_brand').upsert(row, { onConflict: 'bakery_id' });
  if (error) back('/app/marketing/marca', { error: 'No se pudo guardar. Probá de nuevo.' });
  revalidatePath(HOME);
  back(HOME, { ok: 'Perfil de marca guardado. El agente ya escribe con tu estilo.' });
}

// ---------- Publicaciones ----------

export async function createPiece(fd) {
  const ctx = await guard();
  const from = '/app/marketing/crear';
  await guardAI(ctx, from);
  const kind = KINDS[str(fd, 'kind')] ? str(fd, 'kind') : 'post';
  const product = await ownProduct(ctx.supabase, ctx.bakery.id, str(fd, 'product_id'));
  const request = str(fd, 'request', 600);
  const date = isDate(str(fd, 'date')) ? str(fd, 'date') : null;
  const mctx = await buildContext(ctx.supabase, ctx.bakery, { catalogOpen: ctx.access.base });
  const piece = await generatePiece(mctx, { kind, product, request, date });
  if (!piece) back(from, { error: 'La IA no pudo armar la publicación. Probá de nuevo en un momento.' });
  const { data, error } = await ctx.supabase.from('marketing_items').insert({
    bakery_id: ctx.bakery.id,
    kind,
    title: piece.titulo.slice(0, 160),
    product_id: product?.id || null,
    source: 'manual',
    networks: networksOf(fd),
    content: piece,
    request: request || null,
    scheduled_for: date,
  }).select('id').single();
  if (error) back(from, { error: 'No se pudo guardar la publicación.' });
  revalidatePath(HOME);
  back(`/app/marketing/pieza/${data.id}`, { ok: 'Listo: revisala y aprobala si te gusta.' });
}

export async function createWeekPlan() {
  const ctx = await guard();
  await guardAI(ctx, HOME, 5);
  const mctx = await buildContext(ctx.supabase, ctx.bakery, { catalogOpen: ctx.access.base });
  if (!mctx.products.length) back(HOME, { error: 'Cargá al menos un producto con precio para que el agente sepa qué promocionar.' });
  const ideas = await planWeek(mctx, 5);
  if (!ideas.length) back(HOME, { error: 'La IA no pudo armar el plan. Probá de nuevo en un momento.' });
  const byId = Object.fromEntries(mctx.products.map((p) => [p.id, p]));
  const results = await Promise.all(ideas.map(async (idea, i) => {
    const date = idea.date || addDays(mctx.today, i + 1);
    try {
      const piece = await generatePiece(mctx, { kind: idea.kind, product: byId[idea.productId] || null, request: idea.idea, date, occasion: idea.occasion });
      return piece ? { idea, date, piece } : null;
    } catch (e) {
      await reportError('marketing-plan', e, { bakeryId: ctx.bakery.id });
      return null;
    }
  }));
  const rows = results.filter(Boolean).map(({ idea, date, piece }) => ({
    bakery_id: ctx.bakery.id,
    kind: idea.kind,
    title: piece.titulo.slice(0, 160),
    product_id: idea.productId,
    source: 'plan',
    content: piece,
    request: idea.idea,
    scheduled_for: date,
  }));
  if (!rows.length) back(HOME, { error: 'La IA no pudo armar las publicaciones. Probá de nuevo en un momento.' });
  const { error } = await ctx.supabase.from('marketing_items').insert(rows);
  if (error) back(HOME, { error: 'No se pudo guardar el plan.' });
  await notify(createAdmin(), ctx.bakery, { kind: 'marketing', title: `Tenés ${rows.length} publicaciones para aprobar`, body: 'El plan de la semana está listo. Revisalas y aprobá las que te gusten.', url: HOME });
  revalidatePath(HOME);
  back(HOME, { ok: `Plan listo: ${rows.length} publicaciones para aprobar.` });
}

export async function approvePiece(fd) {
  const { supabase, bakery } = await guard();
  const item = await ownItem(supabase, bakery.id, str(fd, 'id'));
  if (!item) back(HOME, { error: 'No encontramos esa publicación.' });
  const to = `/app/marketing/pieza/${item.id}`;
  const date = isDate(str(fd, 'date')) ? str(fd, 'date') : item.scheduled_for;
  const patch = { status: 'aprobada', approved_at: new Date().toISOString(), scheduled_for: date, auto_publish: false, publish_at: null, publish_error: null, publish_attempts: 0, updated_at: new Date().toISOString() };
  // Publicación automática en Instagram: solo posteos con foto JPEG del producto y la cuenta conectada.
  if (fd.get('auto') === 'on') {
    const time = /^\d{2}:\d{2}$/.test(str(fd, 'time')) ? str(fd, 'time') : '19:00';
    const at = new Date(`${date || todayAR()}T${time}:00-03:00`);
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 5 * 60000) back(to, { error: 'Elegí un día y hora a partir de dentro de 5 minutos.' });
    if (!hasInstagram() || item.kind !== 'post' || !item.product_id) back(to, { error: 'La publicación automática es solo para posteos con un producto.' });
    const account = await getIgAccount(createAdmin(), bakery.id);
    if (!account || account.status !== 'ok') back(to, { error: 'Primero conectá Instagram en Marketing IA → Redes.' });
    const { data: product } = await supabase.from('products').select('photo_url').eq('id', item.product_id).maybeSingle();
    if (!(await isPublicJpeg(product?.photo_url))) back(to, { error: 'Para publicar solo, el producto necesita una foto JPG. Subila de nuevo desde la ficha del producto.' });
    patch.auto_publish = true;
    patch.publish_at = at.toISOString();
  }
  await supabase.from('marketing_items').update(patch).eq('id', item.id);
  revalidatePath(HOME);
  back(to, { ok: patch.auto_publish ? 'Aprobada. Se publica sola en Instagram el día y hora que elegiste.' : 'Aprobada. Copiá el texto y descargá la imagen para publicarla.' });
}

export async function cancelAutoPublish(fd) {
  const { supabase, bakery } = await guard();
  const item = await ownItem(supabase, bakery.id, str(fd, 'id'));
  if (!item) back(HOME, { error: 'No encontramos esa publicación.' });
  await supabase.from('marketing_items').update({ auto_publish: false, publish_at: null, updated_at: new Date().toISOString() }).eq('id', item.id).eq('status', 'aprobada');
  revalidatePath(HOME);
  back(`/app/marketing/pieza/${item.id}`, { ok: 'Publicación automática cancelada. Podés publicarla a mano.' });
}

export async function disconnectInstagram() {
  const { bakery } = await guard();
  const admin = createAdmin();
  await admin.from('social_accounts').delete().eq('bakery_id', bakery.id).eq('network', 'instagram');
  await admin.from('marketing_items').update({ auto_publish: false, publish_at: null }).eq('bakery_id', bakery.id).eq('status', 'aprobada').eq('auto_publish', true);
  revalidatePath(HOME);
  back('/app/marketing/redes', { ok: 'Instagram desconectado. Borramos el permiso para publicar.' });
}

export async function rejectPiece(fd) {
  const { supabase, bakery } = await guard();
  const item = await ownItem(supabase, bakery.id, str(fd, 'id'));
  if (!item) back(HOME, { error: 'No encontramos esa publicación.' });
  await supabase.from('marketing_items').update({ status: 'rechazada', reject_reason: str(fd, 'reason', 300) || null, updated_at: new Date().toISOString() }).eq('id', item.id);
  revalidatePath(HOME);
  back(HOME, { ok: 'Rechazada. El agente lo tiene en cuenta para las próximas.' });
}

export async function requestChanges(fd) {
  const ctx = await guard();
  const item = await ownItem(ctx.supabase, ctx.bakery.id, str(fd, 'id'));
  if (!item) back(HOME, { error: 'No encontramos esa publicación.' });
  const to = `/app/marketing/pieza/${item.id}`;
  const feedback = str(fd, 'feedback', 600);
  if (!feedback) back(to, { error: 'Escribí qué querés cambiar.' });
  if (item.revisions >= 5) back(to, { error: 'Ya pediste 5 cambios en esta publicación. Editala a mano o creá una nueva.' });
  if (!hasAI()) back(to, { error: 'La IA todavía no está configurada.' });
  const mctx = await buildContext(ctx.supabase, ctx.bakery, { catalogOpen: ctx.access.base });
  const product = item.product_id ? mctx.products.find((p) => p.id === item.product_id) || null : null;
  const piece = await generatePiece(mctx, { kind: item.kind, product, request: item.request || '', feedback, previous: item.content, date: item.scheduled_for });
  if (!piece) back(to, { error: 'La IA no pudo rehacerla. Probá de nuevo en un momento.' });
  await ctx.supabase.from('marketing_items').update({
    content: piece, title: piece.titulo.slice(0, 160), feedback, status: 'para_aprobar', revisions: item.revisions + 1, updated_at: new Date().toISOString(),
  }).eq('id', item.id);
  revalidatePath(HOME);
  back(to, { ok: 'Rehecha con tus cambios.' });
}

export async function editPiece(fd) {
  const ctx = await guard();
  const item = await ownItem(ctx.supabase, ctx.bakery.id, str(fd, 'id'));
  if (!item) back(HOME, { error: 'No encontramos esa publicación.' });
  const tags = str(fd, 'hashtags', 500).split(/[\s,]+/).map((h) => h.replace(/^#+/, '')).filter(Boolean).slice(0, 12).map((h) => `#${h}`);
  const content = {
    ...item.content,
    texto: str(fd, 'texto', 2200),
    texto_facebook: str(fd, 'texto_facebook', 2200),
    speech: str(fd, 'speech', 1500) || item.content?.speech || '',
    hashtags: tags,
  };
  const mctx = await buildContext(ctx.supabase, ctx.bakery, { catalogOpen: ctx.access.base });
  content.alertas = reviewPiece(content, mctx);
  const date = isDate(str(fd, 'date')) ? str(fd, 'date') : item.scheduled_for;
  await ctx.supabase.from('marketing_items').update({ content, scheduled_for: date, updated_at: new Date().toISOString() }).eq('id', item.id);
  revalidatePath(HOME);
  back(`/app/marketing/pieza/${item.id}`, { ok: 'Cambios guardados.' });
}

export async function markPublished(fd) {
  const { supabase, bakery } = await guard();
  const item = await ownItem(supabase, bakery.id, str(fd, 'id'));
  if (!item || item.status !== 'aprobada') back(HOME, { error: 'Solo se pueden marcar como publicadas las aprobadas.' });
  await supabase.from('marketing_items').update({ status: 'publicada', published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', item.id);
  revalidatePath(HOME);
  back(`${HOME}?ver=publicada`, { ok: 'Marcada como publicada.' });
}

export async function deletePiece(fd) {
  const { supabase, bakery } = await guard();
  const item = await ownItem(supabase, bakery.id, str(fd, 'id'));
  if (!item) back(HOME, { error: 'No encontramos esa publicación.' });
  await supabase.from('marketing_items').delete().eq('id', item.id);
  revalidatePath(HOME);
  back(HOME, { ok: 'Publicación borrada.' });
}

// ---------- Vendé este producto ----------

export async function createKit(fd) {
  const ctx = await guard();
  const from = '/app/marketing/vender';
  if (!hasAI()) back(from, { error: 'La IA todavía no está configurada. Avisanos y la activamos.' });
  const u = await usage(ctx.supabase, ctx.bakery.id);
  if (u.kitsLeft < 1) back(from, { error: 'Llegaste al límite de kits de venta de este mes.' });
  const product = await ownProduct(ctx.supabase, ctx.bakery.id, str(fd, 'product_id'));
  if (!product) back(from, { error: 'Elegí un producto de tu catálogo.' });
  const goal = GOALS[str(fd, 'goal')] ? str(fd, 'goal') : 'empujar';
  const answers = { publico: str(fd, 'publico', 300), distinto: str(fd, 'distinto', 300), promo: str(fd, 'promo', 300), donde: str(fd, 'donde', 200) };
  const mctx = await buildContext(ctx.supabase, ctx.bakery, { catalogOpen: ctx.access.base });
  const kit = await generateKit(mctx, product, goal, answers);
  if (!kit) back(from, { error: 'La IA no pudo armar el kit. Probá de nuevo en un momento.' });
  kit.alertas = reviewPiece(kit, mctx);
  const { data, error } = await ctx.supabase.from('marketing_kits').insert({
    bakery_id: ctx.bakery.id, product_id: product.id, product_name: product.name.slice(0, 200), goal, answers, content: kit,
  }).select('id').single();
  if (error) back(from, { error: 'No se pudo guardar el kit.' });
  back(`/app/marketing/kit/${data.id}`, { ok: 'Kit de venta listo.' });
}

// Convierte el kit en 5 publicaciones para aprobar, repartidas en 9 días (sin volver a llamar a la IA).
export async function kitToCampaign(fd) {
  const ctx = await guard();
  const id = str(fd, 'id');
  if (!isUuid(id)) back('/app/marketing/vender', { error: 'No encontramos ese kit.' });
  const to = `/app/marketing/kit/${id}`;
  const { data: kit } = await ctx.supabase.from('marketing_kits').select('*').eq('bakery_id', ctx.bakery.id).eq('id', id).maybeSingle();
  if (!kit) back('/app/marketing/vender', { error: 'No encontramos ese kit.' });
  const { count } = await ctx.supabase.from('marketing_items').select('id', { count: 'exact', head: true }).eq('kit_id', kit.id);
  if (count) back(to, { error: 'Este kit ya se convirtió en campaña.' });
  const u = await usage(ctx.supabase, ctx.bakery.id);
  if (u.piecesLeft < 5) back(to, { error: 'No te quedan publicaciones suficientes este mes para la campaña.' });
  const k = kit.content || {};
  const text = k.posteo?.texto || '';
  const tags = Array.isArray(k.posteo?.hashtags) ? k.posteo.hashtags.map((h) => `#${String(h).replace(/^#+/, '')}`) : [];
  const base = { texto_facebook: text, hashtags: tags, llamado: 'Pedilo desde el link de la bio.', horario: '', escenas: [], placas: [], speech: '', ganchos: [], idea_visual: '' };
  const day = (n) => addDays(todayAR(), n);
  const benefits = Array.isArray(k.ficha?.beneficios) ? k.ficha.beneficios : [];
  const pieces = [
    ['reel', 'Reel de 30 s', 1, { ...base, ganchos: k.reel30?.ganchos || [], escenas: k.reel30?.escenas || [], speech: k.speech_camara || '', texto: text, idea_visual: 'Seguí las escenas del guion.' }],
    ['carrusel', 'Carrusel', 3, { ...base, placas: k.carrusel || [], texto: text, idea_visual: 'Una foto del producto por placa, con el texto arriba.' }],
    ['historia', 'Historia', 4, { ...base, placas: [{ titulo: k.ficha?.promesa || kit.product_name, texto: k.ficha?.para_quien || '' }, ...benefits.slice(0, 3).map((b) => ({ titulo: kit.product_name, texto: b })), { titulo: '¿Lo querés?', texto: 'Pedilo desde el link.' }], speech: k.speech_camara || '', texto: text }],
    ['reel', 'Reel de prueba (10 s)', 6, { ...base, ganchos: k.reel10?.gancho ? [k.reel10.gancho] : [], escenas: k.reel10?.escenas || [], texto: text, idea_visual: 'Publicalo como Trial Reel para probarlo con gente que no te sigue.' }],
    ['post', 'Posteo', 8, { ...base, texto: text, idea_visual: 'La mejor foto del producto, con luz natural.' }],
  ];
  const rows = pieces.map(([kind, label, n, content]) => ({
    bakery_id: ctx.bakery.id,
    kind,
    title: `${kit.product_name} · ${label}`.slice(0, 160),
    product_id: kit.product_id,
    kit_id: kit.id,
    source: 'kit',
    content: { ...content, titulo: `${kit.product_name} · ${label}`, alertas: [] },
    scheduled_for: day(n),
    request: `Campaña del kit de venta (${GOALS[kit.goal] || ''})`,
  }));
  const { error } = await ctx.supabase.from('marketing_items').insert(rows);
  if (error) back(to, { error: 'No se pudo crear la campaña.' });
  await notify(createAdmin(), ctx.bakery, { kind: 'marketing', title: `Campaña de ${kit.product_name}: 5 publicaciones para aprobar`, url: HOME });
  revalidatePath(HOME);
  back(HOME, { ok: 'Campaña creada: 5 publicaciones para aprobar.' });
}

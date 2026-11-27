// Agente de Marketing: arma el contexto del negocio, le pide a la IA publicaciones, planes y kits de venta,
// y controla que los precios del texto coincidan con el catálogo. Nada se publica sin el OK del dueño.
import { askAI } from './ai';
import { appUrl } from './env';
import { rubroOf } from './rubros';
import { todayAR, addDays, weekdayOf, money } from './format';
import { MARKETING_LIMITS } from './modules';

export const KINDS = {
  post: { label: 'Posteo', hint: 'Foto con texto, para el feed' },
  reel: { label: 'Reel', hint: 'Video corto con guion' },
  historia: { label: 'Historia', hint: 'Secuencia de 3 a 5 pantallas' },
  carrusel: { label: 'Carrusel', hint: '5 placas para deslizar' },
};

export const GOALS = {
  lanzamiento: 'Lanzar un producto nuevo',
  empujar: 'Vender más un producto que sale poco',
  llenar: 'Llenar cupo o stock de esta semana',
  fecha: 'Fecha especial',
};

export const STATUS = {
  para_aprobar: 'Para aprobar',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  publicada: 'Publicada',
};

// ---------- Fechas comerciales de Argentina ----------

// n-ésimo día de la semana (0 = domingo) de un mes; n = -1 para el último.
function nthWeekday(year, month, weekday, n) {
  if (n === -1) {
    const last = new Date(Date.UTC(year, month, 0, 12));
    while (last.getUTCDay() !== weekday) last.setUTCDate(last.getUTCDate() - 1);
    return last.toISOString().slice(0, 10);
  }
  const d = new Date(Date.UTC(year, month - 1, 1, 12));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 7 * (n - 1));
  return d.toISOString().slice(0, 10);
}

function datesOfYear(y) {
  const md = (m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // Black Friday: el viernes siguiente al cuarto jueves de noviembre.
  const blackFriday = addDays(nthWeekday(y, 11, 4, 4), 1);
  return [
    [md(1, 6), 'Día de Reyes'],
    [md(2, 14), 'San Valentín'],
    [md(3, 1), 'Vuelta a clases'],
    [md(3, 8), 'Día de la Mujer'],
    [nthWeekday(y, 5, 1, 2), 'Hot Sale (semana aproximada)'],
    [nthWeekday(y, 6, 0, 3), 'Día del Padre'],
    [md(7, 20), 'Día del Amigo'],
    [nthWeekday(y, 8, 0, 3), 'Día de las Infancias'],
    [md(9, 11), 'Día del Maestro'],
    [md(9, 21), 'Día de la Primavera y del Estudiante'],
    [nthWeekday(y, 10, 0, 3), 'Día de la Madre'],
    [md(10, 31), 'Halloween'],
    [blackFriday, 'Black Friday'],
    [md(12, 8), 'Armado del arbolito'],
    [md(12, 24), 'Nochebuena y Navidad'],
    [md(12, 31), 'Fin de año'],
  ];
}

export function upcomingDates(from = todayAR(), days = 45) {
  const y = Number(from.slice(0, 4));
  const until = addDays(from, days);
  return [...datesOfYear(y), ...datesOfYear(y + 1)].filter(([d]) => d >= from && d <= until).sort((a, b) => a[0].localeCompare(b[0]));
}

// ---------- Contexto del negocio ----------

export async function loadBrand(supabase, bakeryId) {
  const { data } = await supabase.from('marketing_brand').select('*').eq('bakery_id', bakeryId).maybeSingle();
  return data || null;
}

export async function loadProducts(supabase, bakeryId) {
  const { data } = await supabase.from('products')
    .select('id,name,price,description,category,cost,min_price,photo_url,visible')
    .eq('bakery_id', bakeryId).not('sheet_row', 'is', null).order('name');
  return data || [];
}

// Cuántas unidades se vendieron de cada producto en los últimos 90 días (pedidos no cancelados).
export async function salesByProduct(supabase, bakeryId) {
  const since = addDays(todayAR(), -90);
  const { data } = await supabase.from('orders').select('product_id,quantity')
    .eq('bakery_id', bakeryId).gte('date', since).in('status', ['pendiente_sena', 'confirmado', 'entregado']).limit(5000);
  const out = {};
  for (const o of data || []) if (o.product_id) out[o.product_id] = (out[o.product_id] || 0) + Number(o.quantity || 1);
  return out;
}

// Lo que el dueño rechazó o pidió cambiar hace poco: el agente aprende a no repetirlo.
async function learnings(supabase, bakeryId) {
  const { data } = await supabase.from('marketing_items').select('reject_reason,feedback')
    .eq('bakery_id', bakeryId).or('reject_reason.not.is.null,feedback.not.is.null').order('updated_at', { ascending: false }).limit(8);
  return (data || []).flatMap((r) => [r.reject_reason, r.feedback]).filter(Boolean).map((t) => String(t).slice(0, 200));
}

// Link para pedir: el catálogo si está abierto (Base activa); si contrató solo Marketing, su WhatsApp o mensaje privado.
export function orderLink(bakery, catalogOpen = true) {
  if (catalogOpen) return `${appUrl()}/c/${bakery.slug}`;
  return null;
}

export async function buildContext(supabase, bakery, { catalogOpen = true } = {}) {
  const [brand, products, sales, learned] = await Promise.all([loadBrand(supabase, bakery.id), loadProducts(supabase, bakery.id), salesByProduct(supabase, bakery.id), learnings(supabase, bakery.id)]);
  return { bakery, brand, products, sales, learned, T: rubroOf(bakery), link: orderLink(bakery, catalogOpen), today: todayAR() };
}

function productLine(p, sales) {
  const margin = p.cost && Number(p.price) > 0 ? Math.round((1 - Number(p.cost) / Number(p.price)) * 100) : null;
  return [
    `- ${p.name} (id ${p.id})`,
    `precio ${money(p.price)}`,
    p.min_price ? `precio mínimo ${money(p.min_price)}` : null,
    margin !== null ? `margen ${margin} %` : null,
    sales[p.id] ? `vendidos en 90 días: ${sales[p.id]}` : null,
    p.category ? `categoría ${p.category}` : null,
    p.description ? `descripción: ${String(p.description).slice(0, 200)}` : null,
  ].filter(Boolean).join(' · ');
}

function brandBlock(brand, learned = []) {
  const lessons = learned.length ? `\nCorrecciones y rechazos recientes del dueño (no repitas esos errores):\n${learned.map((l) => `- ${l}`).join('\n')}` : '';
  if (!brand) return `Perfil de marca: no cargado todavía. Usá un tono cercano, cálido y profesional.${lessons}`;
  return [
    'Perfil de marca:',
    brand.tone && `- Tono: ${brand.tone}`,
    brand.audience && `- Público: ${brand.audience}`,
    brand.differential && `- Diferencial: ${brand.differential}`,
    brand.pillars && `- Temas fijos de la cuenta: ${brand.pillars}`,
    brand.location && `- Zona: ${brand.location}`,
    brand.hashtags && `- Hashtags propios: ${brand.hashtags}`,
    brand.banned_words && `- Palabras que NUNCA hay que usar: ${brand.banned_words}`,
    `- Emojis: ${brand.emojis === false ? 'no usar' : 'sí, con moderación (2 o 3 por texto)'}`,
    brand.examples && `- Publicaciones que le gustan al dueño (imitá el estilo, no el texto): ${brand.examples}`,
  ].filter(Boolean).join('\n') + lessons;
}

function businessBlock(ctx, focusId = null) {
  const { bakery, T, products, sales, link } = ctx;
  const list = products.filter((p) => p.visible !== false || p.id === focusId).slice(0, 40);
  return [
    `Negocio: «${bakery.name}», rubro ${T.label}.`,
    link ? `Link para pedir (${T.orders.toLowerCase()}): ${link}` : `Para pedir: por mensaje privado${bakery.whatsapp_contact ? ` o por WhatsApp al ${bakery.whatsapp_contact}` : ''}. No hay link de pedidos: no lo menciones.`,
    bakery.pickup_address ? `Dirección o zona: ${bakery.pickup_address}` : null,
    bakery.delivery_enabled ? 'Hace envíos a domicilio.' : null,
    bakery.deposit_percent ? `Se reserva con una seña del ${bakery.deposit_percent} %.` : null,
    bakery.min_days_ahead ? `Se pide con ${bakery.min_days_ahead} día(s) de anticipación como mínimo.` : null,
    bakery.policy_text ? `Condiciones del negocio: ${String(bakery.policy_text).slice(0, 600)}` : null,
    list.length ? `Catálogo (${T.items.toLowerCase()}):\n${list.map((p) => productLine(p, sales)).join('\n')}` : 'El catálogo todavía no tiene productos cargados.',
  ].filter(Boolean).join('\n');
}

const RULES = `Reglas obligatorias:
- Escribí en español rioplatense (vos, tenés, pedí), natural y sin frases hechas de publicidad.
- Usá SOLO datos que estén en el contexto. Nunca inventes precios, productos, promociones, reseñas, testimonios, cifras de ventas ni premios.
- Si mencionás un precio, copiá exactamente el del catálogo.
- No hagas afirmaciones de salud ni de dieta (por ejemplo «sin TACC», «saludable», «sin azúcar») salvo que estén en la descripción del producto.
- Toda promo tiene que decir hasta cuándo vale. No propongas descuentos que dejen el precio por debajo del precio mínimo.
- El gancho tiene que atrapar en los primeros 3 segundos. Preferí ideas que la gente quiera mandarle a otra persona.
- Contenido original del negocio: nada de copiar tendencias ajenas ni frases de otras marcas.
- El llamado a la acción lleva al link del negocio para pedir (o a escribir por privado o WhatsApp si no hay link).
- Hashtags: entre 4 y 8, mezclando el rubro, la zona y los propios del negocio, sin #fyp ni hashtags vacíos.`;

// ---------- Publicaciones ----------

const SCENE = { type: 'object', properties: { segundos: { type: 'string' }, toma: { type: 'string' }, texto_pantalla: { type: 'string' }, voz: { type: 'string' } }, required: ['segundos', 'toma'] };
const SLIDE = { type: 'object', properties: { titulo: { type: 'string' }, texto: { type: 'string' } }, required: ['titulo', 'texto'] };

export const PIECE_SCHEMA = {
  type: 'object',
  properties: {
    titulo: { type: 'string', description: 'Nombre interno corto de la pieza' },
    ganchos: { type: 'array', items: { type: 'string' }, description: '3 ganchos alternativos para los primeros 3 segundos' },
    texto: { type: 'string', description: 'Texto para Instagram' },
    texto_facebook: { type: 'string', description: 'Versión para Facebook' },
    hashtags: { type: 'array', items: { type: 'string' } },
    llamado: { type: 'string', description: 'Llamado a la acción' },
    idea_visual: { type: 'string', description: 'Qué foto o video usar y cómo encuadrarlo' },
    escenas: { type: 'array', items: SCENE },
    placas: { type: 'array', items: SLIDE },
    speech: { type: 'string', description: 'Texto para leer a cámara, con pausas marcadas con /' },
    horario: { type: 'string', description: 'Mejor día y hora para publicar' },
  },
  required: ['titulo', 'ganchos', 'texto', 'hashtags', 'llamado', 'idea_visual'],
};

const KIND_GUIDE = {
  post: 'Formato: posteo de foto. Completá texto, texto_facebook, hashtags, llamado e idea_visual. escenas y placas van vacías; speech vacío.',
  reel: 'Formato: reel de 15 a 30 segundos. Completá escenas (4 a 6, con segundos «0-3», «3-8», etc., toma, texto_pantalla y voz), speech para leer a cámara, texto y hashtags. placas vacía.',
  historia: 'Formato: historia de 3 a 5 pantallas. Usá placas (una por pantalla, con sticker o pregunta si suma) y un speech corto. escenas vacía.',
  carrusel: 'Formato: carrusel de 5 placas: problema, producto, detalle, prueba (solo datos reales) y cómo pedir. Completá placas, texto y hashtags. escenas vacía.',
};

function normalizePiece(raw, kind) {
  if (!raw || typeof raw !== 'object') return null;
  const arr = (v) => (Array.isArray(v) ? v : []);
  const s = (v, n = 2200) => String(v ?? '').trim().slice(0, n);
  const piece = {
    titulo: s(raw.titulo, 150) || KINDS[kind].label,
    ganchos: arr(raw.ganchos).map((g) => s(g, 200)).filter(Boolean).slice(0, 3),
    texto: s(raw.texto),
    texto_facebook: s(raw.texto_facebook),
    hashtags: arr(raw.hashtags).map((h) => `#${s(h, 40).replace(/^#+/, '').replace(/\s+/g, '')}`).filter((h) => h.length > 1).slice(0, 10),
    llamado: s(raw.llamado, 300),
    idea_visual: s(raw.idea_visual, 600),
    escenas: arr(raw.escenas).slice(0, 8).map((e) => ({ segundos: s(e?.segundos, 20), toma: s(e?.toma, 300), texto_pantalla: s(e?.texto_pantalla, 200), voz: s(e?.voz, 400) })),
    placas: arr(raw.placas).slice(0, 7).map((p) => ({ titulo: s(p?.titulo, 120), texto: s(p?.texto, 400) })),
    speech: s(raw.speech, 1500),
    horario: s(raw.horario, 120),
  };
  if (!piece.texto && !piece.escenas.length && !piece.placas.length) return null;
  return piece;
}

// Avisos para el dueño: precios que no están en el catálogo o palabras prohibidas.
export function reviewPiece(piece, ctx) {
  const warnings = [];
  const text = JSON.stringify(piece);
  const prices = new Set(ctx.products.map((p) => Math.round(Number(p.price))));
  for (const m of text.matchAll(/\$\s?(\d{1,3}(?:\.\d{3})+|\d{4,})/g)) {
    const n = Number(m[1].replace(/\./g, ''));
    if (n && !prices.has(n)) warnings.push(`El texto menciona $${m[1]} y no coincide con ningún precio de tu catálogo. Revisalo antes de aprobar.`);
  }
  const banned = String(ctx.brand?.banned_words || '').split(/[,;\n]/).map((w) => w.trim().toLowerCase()).filter((w) => w.length > 2);
  const lower = text.toLowerCase();
  for (const w of banned) if (lower.includes(w)) warnings.push(`Aparece «${w}», que está en tus palabras prohibidas.`);
  return [...new Set(warnings)].slice(0, 5);
}

export async function generatePiece(ctx, { kind, product = null, request = '', feedback = '', previous = null, date = null, occasion = null }) {
  const prompt = [
    'Sos el mejor especialista en marketing digital para pequeños negocios de Argentina. Escribís publicaciones que venden y que la gente comparte.',
    businessBlock(ctx, product?.id),
    brandBlock(ctx.brand, ctx.learned),
    `Hoy es ${ctx.today}.${date ? ` La pieza se va a publicar el ${date}.` : ''}`,
    occasion ? `Ocasión: ${occasion}.` : null,
    product ? `Producto protagonista: ${productLine(product, ctx.sales)}` : 'Elegí vos el mejor producto o tema del catálogo para esta pieza.',
    request ? `Pedido del dueño: ${request}` : null,
    previous ? `Versión anterior (mejorala según el pedido de cambios, sin perder lo que estaba bien): ${JSON.stringify(previous).slice(0, 3000)}` : null,
    feedback ? `Cambios que pidió el dueño: ${feedback}` : null,
    KIND_GUIDE[kind],
    RULES,
  ].filter(Boolean).join('\n\n');
  const raw = await askAI({}, prompt, PIECE_SCHEMA, 'marketing-pieza', { maxTokens: 4096, timeoutMs: 45000 });
  const piece = normalizePiece(raw, kind);
  if (!piece) return null;
  piece.alertas = reviewPiece(piece, ctx);
  return piece;
}

// ---------- Plan de la semana ----------

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    piezas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'AAAA-MM-DD' },
          tipo: { type: 'string', enum: ['post', 'reel', 'historia', 'carrusel'] },
          producto_id: { type: 'string', description: 'id del producto del catálogo, o vacío' },
          idea: { type: 'string', description: 'Qué cuenta la pieza y por qué ese día' },
          ocasion: { type: 'string' },
        },
        required: ['fecha', 'tipo', 'idea'],
      },
    },
  },
  required: ['piezas'],
};

export async function planWeek(ctx, count = 5) {
  const from = addDays(ctx.today, 1);
  const until = addDays(ctx.today, 7);
  const fechas = upcomingDates(ctx.today, 21).map(([d, n]) => `${d}: ${n}`).join('\n') || 'Ninguna en las próximas 3 semanas.';
  const prompt = [
    'Sos el estratega de contenido de este negocio. Armá el plan de publicaciones de la semana.',
    businessBlock(ctx),
    brandBlock(ctx.brand, ctx.learned),
    `Hoy es ${ctx.today}. El plan va del ${from} al ${until}.`,
    `Fechas comerciales cercanas:\n${fechas}`,
    `Proponé exactamente ${count} piezas en días distintos. Mezclá formatos (al menos 2 reels) y temas: producto, detrás de escena, consejo útil y venta directa.`,
    'Priorizá los productos con mejor margen y los más vendidos. Si se acerca una fecha comercial, preparala con anticipación.',
    'En producto_id usá exactamente el id del catálogo (o vacío si la pieza no es de un producto).',
    RULES,
  ].join('\n\n');
  const raw = await askAI({}, prompt, PLAN_SCHEMA, 'marketing-plan', { maxTokens: 2048, timeoutMs: 30000 });
  const ids = new Set(ctx.products.map((p) => p.id));
  return (Array.isArray(raw?.piezas) ? raw.piezas : []).slice(0, count).map((p) => ({
    date: /^\d{4}-\d{2}-\d{2}$/.test(p?.fecha) && p.fecha >= from && p.fecha <= addDays(until, 3) ? p.fecha : null,
    kind: KINDS[p?.tipo] ? p.tipo : 'post',
    productId: ids.has(p?.producto_id) ? p.producto_id : null,
    idea: String(p?.idea || '').slice(0, 400),
    occasion: String(p?.ocasion || '').slice(0, 100) || null,
  })).filter((p) => p.idea);
}

// ---------- Vendé este producto ----------

const KIT_SCHEMA = {
  type: 'object',
  properties: {
    ficha: {
      type: 'object',
      properties: { promesa: { type: 'string' }, para_quien: { type: 'string' }, beneficios: { type: 'array', items: { type: 'string' } }, diferencial: { type: 'string' }, prueba: { type: 'string' } },
      required: ['promesa', 'para_quien', 'beneficios'],
    },
    reel30: { type: 'object', properties: { ganchos: { type: 'array', items: { type: 'string' } }, escenas: { type: 'array', items: SCENE } }, required: ['ganchos', 'escenas'] },
    reel10: { type: 'object', properties: { gancho: { type: 'string' }, escenas: { type: 'array', items: SCENE } }, required: ['gancho', 'escenas'] },
    speech_camara: { type: 'string' },
    carrusel: { type: 'array', items: SLIDE },
    posteo: { type: 'object', properties: { texto: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } } }, required: ['texto'] },
    whatsapp: { type: 'string' },
    cara_a_cara: {
      type: 'object',
      properties: { apertura: { type: 'string' }, preguntas: { type: 'array', items: { type: 'string' } }, presentacion: { type: 'string' }, cierre: { type: 'string' }, sumar: { type: 'string' } },
      required: ['apertura', 'presentacion', 'cierre'],
    },
    objeciones: { type: 'array', items: { type: 'object', properties: { objecion: { type: 'string' }, respuesta: { type: 'string' } }, required: ['objecion', 'respuesta'] } },
    quiero: { type: 'string', description: 'Mensaje privado para quien comenta QUIERO' },
    anuncio: { type: 'object', properties: { textos: { type: 'array', items: { type: 'string' } }, publico: { type: 'string' }, presupuesto: { type: 'string' } }, required: ['textos'] },
    catalogo: { type: 'string', description: 'Descripción mejorada para el catálogo' },
  },
  required: ['ficha', 'reel30', 'speech_camara', 'carrusel', 'posteo', 'whatsapp', 'cara_a_cara', 'objeciones', 'quiero', 'catalogo'],
};

export async function generateKit(ctx, product, goal, answers = {}) {
  const fechas = upcomingDates(ctx.today, 30).map(([d, n]) => `${d}: ${n}`).join('; ');
  const others = ctx.products.filter((p) => p.id !== product.id && p.visible !== false).slice(0, 25).map((p) => `${p.name} (${money(p.price)})`).join('; ');
  const prompt = [
    'Sos el mejor vendedor y especialista en marketing digital de Argentina. Armá un kit de venta completo para UN producto.',
    businessBlock(ctx, product.id),
    brandBlock(ctx.brand, ctx.learned),
    `Producto a vender: ${productLine(product, ctx.sales)}`,
    `Objetivo: ${GOALS[goal] || GOALS.empujar}.`,
    answers.publico ? `A quién se lo quiere vender: ${answers.publico}` : null,
    answers.distinto ? `Qué lo hace distinto, según el dueño: ${answers.distinto}` : null,
    answers.promo ? `Promo o fecha límite: ${answers.promo}` : 'No hay promo: no inventes descuentos.',
    answers.donde ? `Dónde lo vende: ${answers.donde}` : null,
    `Hoy es ${ctx.today}. Fechas comerciales cercanas: ${fechas || 'ninguna'}.`,
    `Otros productos del catálogo (solo podés ofrecer estos como alternativa o para sumar): ${others || 'ninguno'}.`,
    'Qué entregar:',
    '- ficha: promesa en una frase, para quién es, 3 beneficios (no características), diferencial y prueba (solo ventas reales del contexto; si no hay, dejá prueba vacía).',
    '- reel30: 3 ganchos alternativos y 5 escenas con segundos, toma, texto_pantalla y voz.',
    '- reel10: un gancho y 3 escenas, para probar como Trial Reel.',
    '- speech_camara: 20 a 40 segundos para leer a cámara, con pausas marcadas con /.',
    '- carrusel: 5 placas (problema, producto, detalle, prueba, cómo pedir).',
    '- posteo: texto para Instagram y Facebook con hashtags.',
    '- whatsapp: mensaje corto para clientes que ya compraron, con [link] donde va el link.',
    '- cara_a_cara: apertura, 2 preguntas para entender qué necesita, presentación, cierre que pida la venta y qué producto sumar.',
    '- objeciones: 4 a 5 (por ejemplo «está caro», «lo pienso», envíos, restricciones), respondidas con datos reales.',
    '- quiero: mensaje privado para quien comenta QUIERO, con el link.',
    '- anuncio: 3 textos de anuncio, público sugerido y presupuesto diario sugerido en pesos (orientativo).',
    '- catalogo: descripción de 2 a 3 frases para el catálogo.',
    RULES,
  ].filter(Boolean).join('\n\n');
  const raw = await askAI({}, prompt, KIT_SCHEMA, 'marketing-kit', { maxTokens: 8192, timeoutMs: 55000 });
  if (!raw || typeof raw !== 'object' || !raw.ficha) return null;
  return raw;
}

// ---------- Límites ----------

function monthStartAR() {
  return `${todayAR().slice(0, 8)}01T03:00:00Z`; // 00:00 de Argentina
}

export async function usage(supabase, bakeryId) {
  const month = monthStartAR();
  const day = `${todayAR()}T03:00:00Z`;
  const [{ count: pieces }, { count: kits }, { count: today }] = await Promise.all([
    supabase.from('marketing_items').select('id', { count: 'exact', head: true }).eq('bakery_id', bakeryId).gte('created_at', month),
    supabase.from('marketing_kits').select('id', { count: 'exact', head: true }).eq('bakery_id', bakeryId).gte('created_at', month),
    supabase.from('marketing_items').select('id', { count: 'exact', head: true }).eq('bakery_id', bakeryId).gte('created_at', day),
  ]);
  return {
    pieces: pieces || 0,
    kits: kits || 0,
    today: today || 0,
    piecesLeft: Math.max(0, MARKETING_LIMITS.pieces - (pieces || 0)),
    kitsLeft: Math.max(0, MARKETING_LIMITS.kits - (kits || 0)),
    todayLeft: Math.max(0, MARKETING_LIMITS.perDay - (today || 0)),
  };
}

// Días de la semana con un horario sugerido simple (la IA puede proponer otro).
export function defaultHour(dateStr) {
  const wd = weekdayOf(dateStr);
  return wd === 0 || wd === 6 ? '11:00' : '19:00';
}

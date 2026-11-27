// Imagen sugerida para una publicación (1080 × 1350, formato vertical de Instagram):
// foto real del producto + gancho + nombre y precio + nombre del negocio. Solo la ve el dueño.
import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase';
import { money } from '@/lib/format';

export const runtime = 'nodejs';

const W = 1080;
const H = 1350;

// Trae la foto y la pasa como data URL; solo JPG o PNG de hasta 4 MB (otros formatos se omiten).
async function toDataUrl(url) {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').split(';')[0];
    if (!['image/jpeg', 'image/png'].includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

const cut = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trim()}…` : t;
};

export async function GET(req, { params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('No encontrado', { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Sin sesión', { status: 401 });
  // RLS: solo devuelve la pieza si es de un negocio del usuario.
  const { data: it } = await supabase.from('marketing_items').select('id,bakery_id,title,content,product_id').eq('id', id).maybeSingle();
  if (!it) return new Response('No encontrado', { status: 404 });
  const [{ data: bakery }, { data: product }] = await Promise.all([
    supabase.from('bakeries').select('name,logo_url').eq('id', it.bakery_id).maybeSingle(),
    it.product_id ? supabase.from('products').select('name,price,photo_url').eq('id', it.product_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const [photo, logo] = await Promise.all([toDataUrl(product?.photo_url), toDataUrl(bakery?.logo_url)]);
  const headline = cut(it.content?.ganchos?.[0] || it.title, 90);
  const download = new URL(req.url).searchParams.get('descargar') === '1';

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: photo ? '#18181B' : 'linear-gradient(135deg, #C2410C 0%, #7C2D12 100%)' }}>
        {photo && <img src={photo} width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }} />}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 820, display: 'flex', background: 'linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0))' }} />
        {logo && <img src={logo} width={128} height={128} style={{ position: 'absolute', top: 56, left: 56, width: 128, height: 128, borderRadius: 64, objectFit: 'cover', border: '4px solid #FFFFFF' }} />}
        <div style={{ position: 'absolute', left: 72, right: 72, bottom: 96, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 74, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.12 }}>{headline}</div>
          {product && (
            <div style={{ display: 'flex', marginTop: 36 }}>
              <div style={{ display: 'flex', background: '#C2410C', color: '#FFFFFF', fontSize: 40, fontWeight: 700, padding: '16px 30px', borderRadius: 999 }}>
                {cut(product.name, 34)} · {money(product.price)}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', marginTop: 30, color: 'rgba(255,255,255,0.85)', fontSize: 36 }}>{cut(bakery?.name, 50)}</div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: {
        'Cache-Control': 'private, max-age=300',
        ...(download ? { 'Content-Disposition': 'attachment; filename="publicacion.png"' } : {}),
      },
    },
  );
}

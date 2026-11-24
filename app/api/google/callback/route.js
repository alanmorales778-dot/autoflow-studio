import { rubroOf } from '@/lib/rubros';
import { NextResponse } from 'next/server';
import { createClient, createAdmin } from '@/lib/supabase';
import { exchangeCode, emailFromIdToken } from '@/lib/google';
import { unsign, encrypt, decrypt } from '@/lib/crypto';
import { createTemplateSheets, syncBakery, recomputeCosts, writeBackProducts, accessTokenFor, EXAMPLE_RECIPES } from '@/lib/sheets';

export const maxDuration = 60;

function back(request, params) {
  return NextResponse.redirect(new URL(`/app/configuracion?${new URLSearchParams(params)}#drive`, request.url));
}

export async function GET(request) {
  const url = new URL(request.url);
  if (url.searchParams.get('error')) return back(request, { error: 'No se otorgó el permiso de Google Drive.' });
  const code = url.searchParams.get('code');
  const state = unsign(url.searchParams.get('state'));
  if (!code || !state) return back(request, { error: 'Link de Google inválido. Probá de nuevo.' });
  const [bakeryId, ts] = state.split(':');
  if (Date.now() - Number(ts) > 15 * 60000) return back(request, { error: 'El link de Google venció. Probá de nuevo.' });

  // el usuario logueado tiene que ser el dueño del negocio
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));
  const admin = createAdmin();
  const { data: bakery } = await admin.from('bakeries').select('*').eq('id', bakeryId).eq('owner_id', user.id).maybeSingle();
  if (!bakery) return back(request, { error: 'Negocio no encontrado.' });

  try {
    const tokens = await exchangeCode(code);
    const refresh = tokens.refresh_token || (bakery.google_refresh_token_enc ? decrypt(bakery.google_refresh_token_enc) : null);
    if (!refresh) return back(request, { error: 'Google no devolvió permiso permanente. Quitá HakkiraApp en myaccount.google.com/permissions y volvé a conectar.' });
    const patch = { google_refresh_token_enc: encrypt(refresh), google_email: emailFromIdToken(tokens.id_token) };

    let fresh = { ...bakery, ...patch };
    if (!bakery.sheet_productos_id) {
      const ids = await createTemplateSheets(tokens.access_token, bakery.name, rubroOf(bakery).sample);
      patch.sheet_insumos_id = ids.insumos;
      patch.sheet_productos_id = ids.productos;
      fresh = { ...fresh, ...patch };
    }
    await admin.from('bakeries').update(patch).eq('id', bakery.id);

    const r = await syncBakery(admin, fresh, { force: true });
    if (r.error) return back(request, { error: `Conectado, pero falló la primera lectura: ${r.error}` });

    // recetas de ejemplo para los productos de ejemplo (solo si todavía no tienen)
    const { data: prods } = await admin.from('products').select('id,sku').eq('bakery_id', bakery.id).in('sku', Object.keys(rubroOf(bakery).sample.recipes));
    const toSeed = [];
    for (const p of prods || []) {
      const { count } = await admin.from('recipe_items').select('id', { count: 'exact', head: true }).eq('product_id', p.id);
      if (!count) rubroOf(bakery).sample.recipes[p.sku].forEach(([ingredient_name, qty, unit]) => toSeed.push({ product_id: p.id, ingredient_name, qty, unit }));
    }
    if (toSeed.length) {
      await admin.from('recipe_items').insert(toSeed);
      await recomputeCosts(admin, fresh);
      await writeBackProducts(admin, fresh, await accessTokenFor(fresh));
    }
    return back(request, { ok: 'Google Drive conectado. Creamos tus planillas con ejemplos: reemplazalos por tus productos e insumos.' });
  } catch (e) {
    return back(request, { error: `No se pudo conectar Google: ${e.message}` });
  }
}

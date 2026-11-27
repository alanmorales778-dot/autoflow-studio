import { rubroOf } from '@/lib/rubros';
import { has } from '@/lib/env';
import { GOOGLE_CAL_PATH } from '@/lib/ics';
// Checklist de primeros pasos: se calcula con datos reales, no con casillas que marca el usuario.
export async function onboardingSteps(supabase, bakery, access) {
  const [{ data: products }, { count: capCount }, { count: orderCount }] = await Promise.all([
    supabase.from('products').select('id').eq('bakery_id', bakery.id).not('sheet_row', 'is', null).limit(50),
    supabase.from('capacity_rules').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('bakery_id', bakery.id),
  ]);
  const productIds = (products || []).map((p) => p.id);
  let recipeCount = 0;
  if (access.costs && productIds.length) {
    const { count } = await supabase.from('recipe_items').select('id', { count: 'exact', head: true }).in('product_id', productIds);
    recipeCount = count || 0;
  }

  const T = rubroOf(bakery);
  const steps = [
    {
      key: 'productos',
      title: `Cargá tus ${T.items.toLowerCase()}`,
      hint: `Agregalos de a uno, subí un Excel o CSV${has.google() ? ', conectá Drive' : ''} o empezá con dos ${T.items.toLowerCase()} de ejemplo y editalos.`,
      done: productIds.length > 0,
      href: '/app/productos',
      example: productIds.length === 0,
    },
    access.costs && {
      key: 'receta',
      title: T.key === 'cocina' ? 'Cargá la receta de un producto' : `Cargá qué lleva un ${T.item}`,
      hint: `Con los ${T.insumos.toLowerCase()} calculamos el costo y el precio mínimo para no perder plata.`,
      done: recipeCount > 0,
      href: productIds.length ? `/app/productos/${productIds[0]}` : '/app/productos',
    },
    {
      key: 'cupos',
      title: T.capTitle,
      hint: T.capHint,
      done: (capCount || 0) > 0,
      href: '/app/configuracion#cupos',
    },
    {
      key: 'retiro',
      title: 'Completá la dirección de tu local o de retiro',
      hint: 'Aparece en el catálogo y en los recordatorios.',
      done: !!bakery.pickup_address,
      href: '/app/configuracion#negocio',
    },
    {
      key: 'mp',
      title: 'Conectá Mercado Pago',
      hint: 'Para cobrar la seña con un link que vence y liberar el cupo si no pagan.',
      done: !!bakery.mp_access_token_enc,
      href: '/app/configuracion#mercadopago',
    },
    {
      key: 'pedido',
      title: 'Hacé un pedido de prueba en tu catálogo',
      hint: 'Mirá lo que ve tu cliente. Después lo cancelás desde Pedidos.',
      done: (orderCount || 0) > 0,
      href: `/c/${bakery.slug}`,
      external: true,
    },
    {
      key: 'calendario',
      title: `Sumá tus ${T.orders.toLowerCase()} a Google Calendar`,
      hint: `Con un toque aparecen en tu calendario del celular, con horario, ${T.note1.label.toLowerCase()} y saldo a cobrar.`,
      done: !!bakery.calendar_token,
      href: GOOGLE_CAL_PATH,
      external: true,
    },
  ].filter(Boolean);

  return { steps, done: steps.filter((s) => s.done).length, total: steps.length };
}

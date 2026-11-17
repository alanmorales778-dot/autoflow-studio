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

  const steps = [
    {
      key: 'productos',
      title: 'Cargá tus productos',
      hint: 'Subí un Excel o CSV, conectá Drive, o empezá con dos productos de ejemplo y editalos.',
      done: productIds.length > 0,
      href: '/app/productos',
      example: productIds.length === 0,
    },
    access.costs && {
      key: 'receta',
      title: 'Cargá la receta de un producto',
      hint: 'Con los ingredientes calculamos el costo y el precio mínimo para no perder plata.',
      done: recipeCount > 0,
      href: productIds.length ? `/app/productos/${productIds[0]}` : '/app/productos',
    },
    {
      key: 'cupos',
      title: 'Poné cuántas unidades podés hacer por día',
      hint: 'Así nunca te piden más de lo que entra en el horno.',
      done: (capCount || 0) > 0,
      href: '/app/configuracion#cupos',
    },
    {
      key: 'retiro',
      title: 'Completá la dirección de retiro',
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
  ].filter(Boolean);

  return { steps, done: steps.filter((s) => s.done).length, total: steps.length };
}

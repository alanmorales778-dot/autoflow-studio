import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase';
import { moduleAccess } from './modules';

export const getContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: bakery } = await supabase.from('bakeries').select('*').eq('owner_id', user.id).maybeSingle();
  let sub = null;
  if (bakery) {
    const { data } = await supabase.from('subscriptions').select('*').eq('bakery_id', bakery.id).maybeSingle();
    sub = data;
  }
  return { supabase, user, bakery, sub, access: moduleAccess(sub, bakery) };
});

export async function requireBakery() {
  const ctx = await getContext();
  if (!ctx.bakery) redirect('/app');
  return ctx;
}

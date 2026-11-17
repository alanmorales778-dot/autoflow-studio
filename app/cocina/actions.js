'use server';

import { revalidatePath } from 'next/cache';
import { requireBakery } from '@/lib/session';
import { createAdmin } from '@/lib/supabase';

export async function setPrepared(id, done) {
  const { bakery, access } = await requireBakery();
  if (!access.costs) return { ok: false };
  const { error } = await createAdmin()
    .from('orders')
    .update({ prepared_at: done ? new Date().toISOString() : null })
    .eq('id', String(id))
    .eq('bakery_id', bakery.id);
  revalidatePath('/cocina');
  return { ok: !error };
}

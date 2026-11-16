import { NextResponse } from 'next/server';
import { createClient, createAdmin } from '@/lib/supabase';
import { exportWorkbook } from '@/lib/imports';
import { slugify } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { kind } = await params;
  if (!['insumos', 'productos'].includes(kind)) return new NextResponse('No encontrado', { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));
  const { data: bakery } = await supabase.from('bakeries').select('*').eq('owner_id', user.id).maybeSingle();
  if (!bakery) return NextResponse.redirect(new URL('/app', request.url));
  const buf = await exportWorkbook(createAdmin(), bakery, kind);
  const filename = `${kind === 'insumos' ? 'insumos' : 'productos-y-stock'}-${slugify(bakery.name) || 'autoflow'}.xlsx`;
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

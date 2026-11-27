-- Módulo «Marketing IA»: se puede contratar solo (sin la Base) o junto a los demás.
alter table public.subscriptions
  add column if not exists has_base boolean not null default true,
  add column if not exists has_marketing boolean not null default false;

-- Perfil de marca: cómo habla el negocio en redes.
create table if not exists public.marketing_brand (
  bakery_id uuid primary key references public.bakeries(id) on delete cascade,
  tone text check (char_length(tone) <= 300),
  audience text check (char_length(audience) <= 300),
  differential text check (char_length(differential) <= 300),
  banned_words text check (char_length(banned_words) <= 300),
  hashtags text check (char_length(hashtags) <= 300),
  location text check (char_length(location) <= 120),
  pillars text check (char_length(pillars) <= 300),
  examples text check (char_length(examples) <= 1500),
  emojis boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Kits de «Vendé este producto».
create table if not exists public.marketing_kits (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null check (char_length(product_name) <= 200),
  goal text not null check (goal in ('lanzamiento','empujar','llenar','fecha')),
  answers jsonb not null default '{}'::jsonb,
  content jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists marketing_kits_bakery_idx on public.marketing_kits (bakery_id, created_at desc);

-- Cada pieza propuesta por el agente. Nada se publica sin pasar por «aprobada».
create table if not exists public.marketing_items (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  kind text not null check (kind in ('post','reel','historia','carrusel')),
  title text not null check (char_length(title) <= 160),
  product_id uuid references public.products(id) on delete set null,
  kit_id uuid references public.marketing_kits(id) on delete set null,
  source text not null default 'manual' check (source in ('manual','plan','kit')),
  networks text[] not null default '{instagram,facebook}',
  content jsonb not null,
  status text not null default 'para_aprobar' check (status in ('para_aprobar','aprobada','rechazada','publicada')),
  scheduled_for date,
  request text check (char_length(request) <= 600),
  feedback text check (char_length(feedback) <= 600),
  reject_reason text check (char_length(reject_reason) <= 300),
  revisions integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  published_at timestamptz
);
create index if not exists marketing_items_bakery_idx on public.marketing_items (bakery_id, status, created_at desc);

alter table public.marketing_brand enable row level security;
alter table public.marketing_kits enable row level security;
alter table public.marketing_items enable row level security;

create policy marketing_brand_owner on public.marketing_brand for all
  using ((select private.owns_bakery(bakery_id))) with check ((select private.owns_bakery(bakery_id)));
create policy marketing_kits_owner on public.marketing_kits for all
  using ((select private.owns_bakery(bakery_id))) with check ((select private.owns_bakery(bakery_id)));
create policy marketing_items_owner on public.marketing_items for all
  using ((select private.owns_bakery(bakery_id))) with check ((select private.owns_bakery(bakery_id)));

-- El panel admin muestra y cambia los módulos nuevos.
drop function if exists public.admin_user_overview();
create function public.admin_user_overview()
 returns table(user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean, bakery_id uuid, bakery_name text, slug text, business_type text, is_test boolean, suspended_at timestamptz, bakery_created_at timestamptz, sub_status text, trial_ends_at timestamptz, has_costs boolean, has_whatsapp boolean, has_recurring boolean, amount numeric, orders_total bigint, orders_30d bigint, last_order_at timestamptz, products bigint, pilot_status text, pilot_cohort text, admin_role text, has_base boolean, has_marketing boolean)
 language sql stable security definer set search_path to ''
as $function$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, (u.email_confirmed_at is not null),
    b.id, b.name, b.slug, b.business_type, coalesce(b.is_test, false), b.suspended_at, b.created_at,
    s.status, s.trial_ends_at, s.has_costs, s.has_whatsapp, s.has_recurring, s.amount,
    (select count(*) from public.orders o where o.bakery_id = b.id),
    (select count(*) from public.orders o where o.bakery_id = b.id and o.created_at > now() - interval '30 days'),
    (select max(o.created_at) from public.orders o where o.bakery_id = b.id),
    (select count(*) from public.products p where p.bakery_id = b.id and p.sheet_row is not null),
    pp.status, pp.cohort, pa.role, s.has_base, s.has_marketing
  from auth.users u
  left join public.bakeries b on b.owner_id = u.id
  left join public.subscriptions s on s.bakery_id = b.id
  left join public.pilot_participants pp on pp.bakery_id = b.id
  left join public.platform_admins pa on pa.user_id = u.id
  order by u.created_at desc;
$function$;
revoke all on function public.admin_user_overview() from public, anon, authenticated;
grant execute on function public.admin_user_overview() to service_role;

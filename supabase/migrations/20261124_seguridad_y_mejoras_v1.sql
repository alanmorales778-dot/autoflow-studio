-- Los dueños pueden editar su negocio con la API de Supabase (clave pública + su sesión), así que
-- la política bakery_owner_update les dejaba cambiar CUALQUIER columna: quitarse la suspensión,
-- desmarcarse como cuenta de prueba o pisar las notas internas del equipo.
-- 1) Un trigger impide que alguien que no sea el servidor (service_role) toque esas columnas.
-- 2) Las notas internas pasan a una tabla aparte, que solo lee el servidor (los dueños podían leerlas con select *).

alter table public.bakeries
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.bakeries(id) on delete set null;

create or replace function private.proteger_campos_admin()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.referral_code is null then
    new.referral_code := upper(substr(md5(new.id::text || 'hk'), 1, 6));
  end if;
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.referred_by := null;
    new.suspended_at := null;
    new.suspended_reason := null;
    new.is_test := false;
    return new;
  end if;
  if new.suspended_at is distinct from old.suspended_at
     or new.suspended_reason is distinct from old.suspended_reason
     or new.is_test is distinct from old.is_test
     or new.owner_id is distinct from old.owner_id
     or new.referred_by is distinct from old.referred_by
     or new.referral_code is distinct from old.referral_code then
    raise exception 'No se pueden cambiar campos administrados por HakkiraApp' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists bakeries_proteger_campos_admin on public.bakeries;
create trigger bakeries_proteger_campos_admin
  before insert or update on public.bakeries
  for each row execute function private.proteger_campos_admin();

create table if not exists public.bakery_admin_notes (
  bakery_id uuid primary key references public.bakeries(id) on delete cascade,
  notes text check (notes is null or char_length(notes) <= 2000),
  updated_at timestamptz not null default now()
);
alter table public.bakery_admin_notes enable row level security;
revoke all on public.bakery_admin_notes from anon, authenticated;

insert into public.bakery_admin_notes (bakery_id, notes)
select id, admin_notes from public.bakeries where admin_notes is not null
on conflict (bakery_id) do update set notes = excluded.notes;

-- La columna vieja queda vacía (el panel nuevo usa bakery_admin_notes); se borra en una migración posterior.
update public.bakeries set admin_notes = null where admin_notes is not null;

create index if not exists pilot_participants_invite_id_idx on public.pilot_participants (invite_id);

-- ---------- Mejoras de la auditoría (24/11) ----------
-- Pedidos: deshacer, respuesta del cliente, comprobante de transferencia, cupón, envío y presupuesto
alter table public.orders
  add column if not exists status_prev text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists customer_reply text check (customer_reply is null or customer_reply in ('voy', 'no_puedo')),
  add column if not exists customer_reply_at timestamptz,
  add column if not exists receipt_path text,
  add column if not exists receipt_check jsonb,
  add column if not exists coupon_code text,
  add column if not exists discount numeric not null default 0 check (discount >= 0),
  add column if not exists delivery_fee numeric not null default 0 check (delivery_fee >= 0),
  add column if not exists quote_lines jsonb,
  add column if not exists quote_accepted_at timestamptz;

-- Negocio: transferencia, envío, monotributo, referidos y avisos de fin de prueba
alter table public.bakeries
  add column if not exists transfer_alias text check (transfer_alias is null or char_length(transfer_alias) <= 60),
  add column if not exists transfer_holder text check (transfer_holder is null or char_length(transfer_holder) <= 80),
  add column if not exists delivery_fee numeric check (delivery_fee is null or delivery_fee >= 0),
  add column if not exists free_delivery_from numeric check (free_delivery_from is null or free_delivery_from >= 0),
  add column if not exists monotributo_cat text check (monotributo_cat is null or monotributo_cat ~ '^[A-K]$'),
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.bakeries(id) on delete set null,
  add column if not exists trial_notice text;

update public.bakeries set referral_code = upper(substr(md5(id::text || 'hk'), 1, 6)) where referral_code is null;

-- Suscripción anual
alter table public.subscriptions add column if not exists billing_period text not null default 'mensual' check (billing_period in ('mensual', 'anual'));

-- Mermas por insumo
alter table public.ingredients add column if not exists waste_percent numeric not null default 0 check (waste_percent >= 0 and waste_percent < 90);

-- Reseñas de clientes
create table if not exists public.reviews (
  id bigserial primary key,
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  name text check (name is null or char_length(name) <= 80),
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists reviews_bakery_idx on public.reviews (bakery_id, created_at desc);
alter table public.reviews enable row level security;
drop policy if exists reviews_owner on public.reviews;
create policy reviews_owner on public.reviews for all to authenticated
  using ((select private.owns_bakery(bakery_id))) with check ((select private.owns_bakery(bakery_id)));

-- Cupones
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9-]{3,20}$'),
  kind text not null default 'percent' check (kind in ('percent', 'amount')),
  value numeric not null check (value > 0),
  starts_on date,
  ends_on date,
  max_uses int check (max_uses is null or max_uses > 0),
  uses int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (bakery_id, code)
);
alter table public.coupons enable row level security;
drop policy if exists coupons_owner on public.coupons;
create policy coupons_owner on public.coupons for all to authenticated
  using ((select private.owns_bakery(bakery_id))) with check ((select private.owns_bakery(bakery_id)));

-- Uso de IA (límite diario por negocio)
create table if not exists public.ai_usage (
  id bigserial primary key,
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  kind text not null,
  at timestamptz not null default now()
);
create index if not exists ai_usage_bakery_at_idx on public.ai_usage (bakery_id, at desc);
alter table public.ai_usage enable row level security;

-- Uso de cupón atómico (solo servidor)
create or replace function public.use_coupon(p_bakery uuid, p_code text)
returns public.coupons
language plpgsql
security definer
set search_path = ''
as $$
declare c public.coupons;
begin
  update public.coupons set uses = uses + 1
   where bakery_id = p_bakery and code = upper(p_code) and active
     and (starts_on is null or starts_on <= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
     and (ends_on is null or ends_on >= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
     and (max_uses is null or uses < max_uses)
  returning * into c;
  return c;
end;
$$;
revoke all on function public.use_coupon(uuid, text) from public, anon, authenticated;

-- Comprobantes de transferencia: privados, solo los lee el servidor
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

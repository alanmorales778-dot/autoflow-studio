-- Panel de administración, programa piloto y métricas de rendimiento (24/11/2026)
-- Todas las tablas nuevas tienen RLS sin políticas: solo se leen y escriben desde el servidor
-- con la clave admin (service role). Las funciones también son solo para service_role.

-- ---------- Rubros: la restricción no tenía oficios ni óptica ----------
alter table public.bakeries drop constraint if exists bakeries_business_type_check;
alter table public.bakeries add constraint bakeries_business_type_check
  check (business_type = any (array['cocina','belleza','regalos','servicios','eventos','oficios','optica','otro']));

-- ---------- Marcas de administración sobre cada negocio ----------
alter table public.bakeries add column if not exists is_test boolean not null default false;
alter table public.bakeries add column if not exists suspended_at timestamptz;
alter table public.bakeries add column if not exists suspended_reason text;
alter table public.bakeries add column if not exists admin_notes text;

-- ---------- Equipo de AutoFlow (perfiles con permisos) ----------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'lectura' check (role in ('owner','admin','soporte','lectura')),
  created_at timestamptz not null default now(),
  created_by uuid
);
alter table public.platform_admins enable row level security;

-- ---------- Auditoría: todo lo que se hace desde /admin ----------
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid,
  admin_email text,
  action text not null,
  target text,
  details jsonb not null default '{}'::jsonb
);
create index if not exists admin_audit_at_idx on public.admin_audit (at desc);
create index if not exists admin_audit_target_idx on public.admin_audit (target);
alter table public.admin_audit enable row level security;

-- ---------- Programa piloto ----------
create table if not exists public.pilot_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{4,32}$'),
  label text not null,
  business_type text,
  cohort text,
  trial_days integer not null default 30 check (trial_days between 1 and 365),
  max_uses integer not null default 1 check (max_uses between 1 and 1000),
  uses integer not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.pilot_invites enable row level security;

create table if not exists public.pilot_participants (
  bakery_id uuid primary key references public.bakeries(id) on delete cascade,
  invite_id uuid references public.pilot_invites(id) on delete set null,
  cohort text,
  status text not null default 'activo' check (status in ('activo','pausado','convertido','abandonado')),
  started_at timestamptz not null default now(),
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.pilot_participants enable row level security;

create table if not exists public.pilot_feedback (
  id bigint generated always as identity primary key,
  bakery_id uuid references public.bakeries(id) on delete cascade,
  user_id uuid,
  kind text not null default 'idea' check (kind in ('idea','error','elogio','otro')),
  rating integer check (rating between 1 and 5),
  message text not null check (char_length(message) between 3 and 2000),
  page text,
  status text not null default 'nuevo' check (status in ('nuevo','visto','resuelto')),
  admin_note text,
  created_at timestamptz not null default now()
);
create index if not exists pilot_feedback_created_idx on public.pilot_feedback (created_at desc);
create index if not exists pilot_feedback_bakery_idx on public.pilot_feedback (bakery_id);
alter table public.pilot_feedback enable row level security;

-- Plan de pruebas: resultado de cada escenario por cuenta probada
create table if not exists public.qa_results (
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  scenario text not null,
  result text not null check (result in ('ok','falla','pendiente')),
  note text,
  tested_by text,
  at timestamptz not null default now(),
  primary key (bakery_id, scenario)
);
alter table public.qa_results enable row level security;

-- ---------- Rendimiento real de la página (Core Web Vitals) ----------
create table if not exists public.web_vitals (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  route text not null,
  name text not null check (name in ('LCP','INP','CLS','FCP','TTFB')),
  value double precision not null,
  rating text,
  device text
);
create index if not exists web_vitals_at_idx on public.web_vitals (at desc);
alter table public.web_vitals enable row level security;

-- ---------- Funciones para el panel ----------
create or replace function public.admin_user_overview()
returns table (
  user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean,
  bakery_id uuid, bakery_name text, slug text, business_type text, is_test boolean, suspended_at timestamptz,
  bakery_created_at timestamptz, sub_status text, trial_ends_at timestamptz, has_costs boolean,
  has_whatsapp boolean, has_recurring boolean, amount numeric, orders_total bigint, orders_30d bigint,
  last_order_at timestamptz, products bigint, pilot_status text, pilot_cohort text, admin_role text
)
language sql security definer set search_path = '' stable as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, (u.email_confirmed_at is not null),
    b.id, b.name, b.slug, b.business_type, coalesce(b.is_test, false), b.suspended_at, b.created_at,
    s.status, s.trial_ends_at, s.has_costs, s.has_whatsapp, s.has_recurring, s.amount,
    (select count(*) from public.orders o where o.bakery_id = b.id),
    (select count(*) from public.orders o where o.bakery_id = b.id and o.created_at > now() - interval '30 days'),
    (select max(o.created_at) from public.orders o where o.bakery_id = b.id),
    (select count(*) from public.products p where p.bakery_id = b.id and p.sheet_row is not null),
    pp.status, pp.cohort, pa.role
  from auth.users u
  left join public.bakeries b on b.owner_id = u.id
  left join public.subscriptions s on s.bakery_id = b.id
  left join public.pilot_participants pp on pp.bakery_id = b.id
  left join public.platform_admins pa on pa.user_id = u.id
  order by u.created_at desc;
$$;

create or replace function public.admin_db_stats()
returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'tables', coalesce((select jsonb_agg(jsonb_build_object('name', relname, 'rows', n_live_tup,
        'bytes', pg_total_relation_size(relid)) order by pg_total_relation_size(relid) desc)
      from pg_catalog.pg_stat_user_tables where schemaname = 'public'), '[]'::jsonb)
  );
$$;

create or replace function public.web_vitals_summary(p_days integer default 7)
returns table (route text, name text, samples bigint, p75 double precision, good_pct double precision)
language sql security definer set search_path = '' stable as $$
  select coalesce(v.route, '(todas)'), v.name, count(*),
    percentile_cont(0.75) within group (order by v.value),
    round((100.0 * count(*) filter (where v.rating = 'good') / count(*))::numeric, 1)::double precision
  from public.web_vitals v
  where v.at > now() - make_interval(days => greatest(1, least(p_days, 90)))
  group by grouping sets ((v.name), (v.route, v.name))
  order by 1, 2;
$$;

-- Canje atómico de una invitación piloto al crear el negocio
create or replace function public.redeem_pilot_invite(p_code text, p_bakery uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare inv public.pilot_invites%rowtype;
begin
  select * into inv from public.pilot_invites where code = upper(trim(p_code)) for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_existe'); end if;
  if not inv.active then return jsonb_build_object('ok', false, 'reason', 'inactiva'); end if;
  if inv.expires_at is not null and inv.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'vencida'); end if;
  if inv.uses >= inv.max_uses then return jsonb_build_object('ok', false, 'reason', 'agotada'); end if;
  if exists (select 1 from public.pilot_participants where bakery_id = p_bakery) then
    return jsonb_build_object('ok', false, 'reason', 'ya_es_piloto');
  end if;
  update public.pilot_invites set uses = uses + 1 where id = inv.id;
  insert into public.pilot_participants (bakery_id, invite_id, cohort) values (p_bakery, inv.id, inv.cohort);
  update public.subscriptions
     set status = 'trial', has_costs = true, has_whatsapp = true, has_recurring = true,
         trial_ends_at = greatest(coalesce(trial_ends_at, now()), now() + make_interval(days => inv.trial_days)),
         updated_at = now()
   where bakery_id = p_bakery;
  return jsonb_build_object('ok', true, 'trial_days', inv.trial_days, 'cohort', inv.cohort);
end $$;

revoke all on function public.admin_user_overview() from public, anon, authenticated;
revoke all on function public.admin_db_stats() from public, anon, authenticated;
revoke all on function public.web_vitals_summary(integer) from public, anon, authenticated;
revoke all on function public.redeem_pilot_invite(text, uuid) from public, anon, authenticated;
grant execute on function public.admin_user_overview() to service_role;
grant execute on function public.admin_db_stats() to service_role;
grant execute on function public.web_vitals_summary(integer) to service_role;
grant execute on function public.redeem_pilot_invite(text, uuid) to service_role;

-- Primer dueño del panel
insert into public.platform_admins (user_id, email, role)
select id, email, 'owner' from auth.users where lower(email) = 'alan.morales778@gmail.com'
on conflict (user_id) do update set role = 'owner';

-- Limpieza diaria: las métricas de rendimiento se guardan 30 días
select cron.schedule('limpiar-web-vitals', '23 6 * * *', $$delete from public.web_vitals where at < now() - interval '30 days'$$);

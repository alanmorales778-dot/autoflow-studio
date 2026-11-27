-- Módulo «Asistente IA»: un chat en el catálogo que atiende a los clientes las 24 h con los datos reales del negocio.
-- Se puede contratar solo (sin la Base) o sumado a los demás módulos.
alter table public.subscriptions
  add column if not exists has_assistant boolean not null default false;

-- Cómo se presenta y cómo habla.
create table if not exists public.assistant_settings (
  bakery_id uuid primary key references public.bakeries(id) on delete cascade,
  enabled boolean not null default true,
  name text not null default 'Asistente' check (char_length(name) between 1 and 40),
  greeting text check (char_length(greeting) <= 300),
  tone text check (char_length(tone) <= 300),
  instructions text check (char_length(instructions) <= 1500),
  ask_contact boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Lo que el dueño le enseña: preguntas y respuestas, o notas sueltas (question vacía).
create table if not exists public.assistant_knowledge (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  question text check (char_length(question) <= 300),
  answer text not null check (char_length(answer) between 1 and 1000),
  source text not null default 'manual' check (source in ('manual', 'aprendida', 'nota')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assistant_knowledge_bakery_idx on public.assistant_knowledge (bakery_id, created_at desc);

-- Cada charla de un cliente. token: el secreto que guarda el navegador del cliente para volver a leerla.
create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  token text not null check (char_length(token) between 20 and 80),
  channel text not null default 'catalogo' check (channel in ('catalogo', 'prueba')),
  status text not null default 'ia' check (status in ('ia', 'necesita', 'resuelta')),
  customer_name text check (char_length(customer_name) <= 80),
  customer_phone text check (char_length(customer_phone) <= 40),
  messages_count integer not null default 0,
  unread_owner boolean not null default false,
  paused_until timestamptz,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists assistant_conversations_bakery_idx on public.assistant_conversations (bakery_id, last_message_at desc);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  role text not null check (role in ('cliente', 'ia', 'dueno')),
  text text not null check (char_length(text) between 1 and 2000),
  meta jsonb not null default '{}'::jsonb,
  learned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists assistant_messages_conv_idx on public.assistant_messages (conversation_id, created_at);
create index if not exists assistant_messages_bakery_idx on public.assistant_messages (bakery_id, created_at desc);

alter table public.assistant_settings enable row level security;
alter table public.assistant_knowledge enable row level security;
alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

-- El dueño ve y maneja lo suyo; el chat público del catálogo escribe solo desde el servidor (clave admin).
create policy assistant_settings_owner on public.assistant_settings for all
  using ((select private.owns_bakery(bakery_id))) with check ((select private.owns_bakery(bakery_id)));
create policy assistant_knowledge_owner on public.assistant_knowledge for all
  using ((select private.owns_bakery(bakery_id))) with check ((select private.owns_bakery(bakery_id)));
create policy assistant_conversations_owner on public.assistant_conversations for all
  using ((select private.owns_bakery(bakery_id))) with check ((select private.owns_bakery(bakery_id)));
create policy assistant_messages_owner on public.assistant_messages for all
  using ((select private.owns_bakery(bakery_id))) with check ((select private.owns_bakery(bakery_id)));

-- El panel admin muestra y cambia el módulo nuevo.
drop function if exists public.admin_user_overview();
create function public.admin_user_overview()
 returns table(user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean, bakery_id uuid, bakery_name text, slug text, business_type text, is_test boolean, suspended_at timestamptz, bakery_created_at timestamptz, sub_status text, trial_ends_at timestamptz, has_costs boolean, has_whatsapp boolean, has_recurring boolean, amount numeric, orders_total bigint, orders_30d bigint, last_order_at timestamptz, products bigint, pilot_status text, pilot_cohort text, admin_role text, has_base boolean, has_marketing boolean, has_assistant boolean)
 language sql stable security definer set search_path to ''
as $function$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, (u.email_confirmed_at is not null),
    b.id, b.name, b.slug, b.business_type, coalesce(b.is_test, false), b.suspended_at, b.created_at,
    s.status, s.trial_ends_at, s.has_costs, s.has_whatsapp, s.has_recurring, s.amount,
    (select count(*) from public.orders o where o.bakery_id = b.id),
    (select count(*) from public.orders o where o.bakery_id = b.id and o.created_at > now() - interval '30 days'),
    (select max(o.created_at) from public.orders o where o.bakery_id = b.id),
    (select count(*) from public.products p where p.bakery_id = b.id and p.sheet_row is not null),
    pp.status, pp.cohort, pa.role, s.has_base, s.has_marketing, s.has_assistant
  from auth.users u
  left join public.bakeries b on b.owner_id = u.id
  left join public.subscriptions s on s.bakery_id = b.id
  left join public.pilot_participants pp on pp.bakery_id = b.id
  left join public.platform_admins pa on pa.user_id = u.id
  order by u.created_at desc;
$function$;
revoke all on function public.admin_user_overview() from public, anon, authenticated;
grant execute on function public.admin_user_overview() to service_role;

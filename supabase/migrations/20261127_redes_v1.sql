-- Redes conectadas (Instagram primero). Solo las usa el servidor: RLS sin políticas, como wa_sessions.
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  bakery_id uuid not null references public.bakeries(id) on delete cascade,
  network text not null check (network in ('instagram','facebook','tiktok')),
  external_id text not null check (char_length(external_id) <= 100),
  username text check (char_length(username) <= 100),
  token_enc text not null,
  token_expires_at timestamptz,
  scopes text,
  status text not null default 'ok' check (status in ('ok','vencida','error')),
  last_error text check (char_length(last_error) <= 500),
  connected_at timestamptz not null default now(),
  refreshed_at timestamptz,
  unique (bakery_id, network)
);
create index if not exists social_accounts_external_idx on public.social_accounts (network, external_id);
alter table public.social_accounts enable row level security;

-- Publicación automática de piezas aprobadas.
alter table public.marketing_items
  add column if not exists auto_publish boolean not null default false,
  add column if not exists publish_at timestamptz,
  add column if not exists publish_attempts integer not null default 0,
  add column if not exists publish_error text check (char_length(publish_error) <= 500),
  add column if not exists external_post_id text check (char_length(external_post_id) <= 100),
  add column if not exists external_url text check (char_length(external_url) <= 500);
create index if not exists marketing_items_publish_idx on public.marketing_items (publish_at) where auto_publish and status = 'aprobada';

-- Pedidos de borrado de datos que manda Meta (callback de «Data Deletion»).
create table if not exists public.data_deletion_requests (
  code text primary key,
  network text not null,
  external_id text not null,
  status text not null default 'completado',
  created_at timestamptz not null default now()
);
alter table public.data_deletion_requests enable row level security;

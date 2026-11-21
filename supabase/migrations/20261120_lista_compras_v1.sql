-- Lista de compras editable (Producción y compras → Lista de compras)
-- Ítems cargados a mano o agregados desde los sugeridos por los pedidos.

create table if not exists public.shopping_items (
  id          uuid primary key default gen_random_uuid(),
  bakery_id   uuid not null references public.bakeries(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  qty         numeric check (qty is null or (qty >= 0 and qty <= 1000000)),
  unit        text not null default '' check (char_length(unit) <= 12),
  category    text not null default 'otros' check (char_length(category) between 1 and 20),
  est_cost    numeric check (est_cost is null or (est_cost >= 0 and est_cost <= 1000000000)),
  note        text not null default '' check (char_length(note) <= 140),
  source      text not null default 'manual' check (source in ('manual', 'pedidos')),
  bought      boolean not null default false,
  bought_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists shopping_items_bakery_idx on public.shopping_items (bakery_id, bought, created_at);

alter table public.shopping_items enable row level security;

drop policy if exists shopping_owner on public.shopping_items;
create policy shopping_owner on public.shopping_items
  for all
  using ((select private.owns_bakery(shopping_items.bakery_id)))
  with check ((select private.owns_bakery(shopping_items.bakery_id)));

create or replace function public.shopping_items_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists shopping_items_touch on public.shopping_items;
create trigger shopping_items_touch before update on public.shopping_items
  for each row execute function public.shopping_items_touch();

-- Recetas v1: rinde, pasos y orden de los ingredientes; importación de recetas.
alter table public.products
  add column if not exists recipe_yield numeric not null default 1,
  add column if not exists recipe_notes text;
alter table public.products drop constraint if exists products_recipe_yield_check;
alter table public.products add constraint products_recipe_yield_check check (recipe_yield > 0 and recipe_yield <= 100000);
alter table public.products drop constraint if exists products_recipe_notes_len;
alter table public.products add constraint products_recipe_notes_len check (recipe_notes is null or length(recipe_notes) <= 6000);

alter table public.recipe_items add column if not exists position integer not null default 0;
create index if not exists recipe_items_product_id_idx on public.recipe_items (product_id, position);

alter table public.import_previews drop constraint if exists import_previews_kind_check;
alter table public.import_previews add constraint import_previews_kind_check check (kind = any (array['insumos','productos','recetas','receta_foto']));

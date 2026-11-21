-- Oficios: lo que se gastó en materiales en cada trabajo (si está, la ganancia usa esto en vez de la receta).
alter table public.orders add column if not exists material_cost numeric(12,2);
alter table public.orders drop constraint if exists orders_material_cost_pos;
alter table public.orders add constraint orders_material_cost_pos check (material_cost is null or material_cost >= 0);

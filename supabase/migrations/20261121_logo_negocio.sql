-- Logo del negocio (se ve en el catálogo y arriba en la app)
alter table public.bakeries add column if not exists logo_url text;

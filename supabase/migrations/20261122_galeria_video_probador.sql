-- Galería de fotos y videos por producto, y la imagen del armazón para el probador virtual (ópticas).
alter table public.products add column if not exists gallery jsonb not null default '[]'::jsonb;
alter table public.products drop constraint if exists products_gallery_array;
alter table public.products add constraint products_gallery_array check (jsonb_typeof(gallery) = 'array' and jsonb_array_length(gallery) <= 12);
alter table public.products add column if not exists tryon_url text;
-- Videos cortos: el depósito de productos acepta hasta 50 MB por archivo (las fotos se siguen achicando en el navegador).
update storage.buckets set file_size_limit = 52428800 where id = 'productos';

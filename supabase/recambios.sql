-- Tabla recambios (almacén BSH) para Visualizador de Boletines
-- Ejecutar en Supabase → SQL Editor

create table if not exists public.recambios (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  item_key text,
  factura text,
  fecha_factura text,
  albaran text,
  pos integer,
  cantidad numeric,
  material text,
  descripcion text,
  peso_kg numeric,
  precio_unidad numeric,
  valor_bruto numeric,
  descuento_pct numeric,
  descuento_importe numeric,
  valor_neto numeric,
  pedido_bsh text,
  fecha_pedido text,
  pedido_cliente text,
  servicio text,
  aviso text,
  pedido_sufijo text,
  estado text not null default 'pedido',
  utilizado_en_aviso text,
  notas text default '',
  historial_estados jsonb default '[]'::jsonb,
  payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists recambios_factura_idx on public.recambios (factura);
create index if not exists recambios_aviso_idx on public.recambios (aviso);
create index if not exists recambios_estado_idx on public.recambios (estado);
create index if not exists recambios_material_idx on public.recambios (material);
create index if not exists recambios_item_key_idx on public.recambios (item_key);

alter table public.recambios enable row level security;

drop policy if exists "recambios_all" on public.recambios;
create policy "recambios_all" on public.recambios
  for all
  using (true)
  with check (true);

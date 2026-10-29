-- Nivel 4: esquema Supabase para Visualizador de Boletines
-- Ejecutar en: Supabase → SQL Editor → New query → Run

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now(),
  avisos_count int not null default 0
);

create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete cascade,
  aviso_key text not null,
  orden text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (batch_id, aviso_key)
);

create index if not exists avisos_aviso_key_idx on public.avisos (aviso_key);

create table if not exists public.aviso_meta (
  aviso_key text primary key,
  estado text default 'Pendiente',
  nota text default '',
  checklist jsonb default '{}'::jsonb,
  inicio_visita text default '',
  fin_visita text default '',
  piezas jsonb default '[]'::jsonb,
  cita_fecha text default '',
  cita_hora text default '',
  franja text default '',
  updated_at timestamptz not null default now()
);

alter table public.batches enable row level security;
alter table public.avisos enable row level security;
alter table public.aviso_meta enable row level security;

drop policy if exists "batches_all" on public.batches;
create policy "batches_all" on public.batches for all using (true) with check (true);

drop policy if exists "avisos_all" on public.avisos;
create policy "avisos_all" on public.avisos for all using (true) with check (true);

drop policy if exists "meta_all" on public.aviso_meta;
create policy "meta_all" on public.aviso_meta for all using (true) with check (true);

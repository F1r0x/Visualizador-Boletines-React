-- Fichas de preparación de reparaciones (ejecutar en SQL Editor de Supabase)
-- Idempotente: se puede volver a ejecutar

create table if not exists public.preparaciones (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  titulo text not null default '',
  marca text not null default '',
  modelo text not null default '',
  tipo text not null default '',
  aviso_ref text not null default '',
  notas text not null default '',
  piezas jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  adjuntos jsonb not null default '[]'::jsonb,
  adjuntos_truncados boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists preparaciones_marca_idx on public.preparaciones (marca);
create index if not exists preparaciones_modelo_idx on public.preparaciones (modelo);
create index if not exists preparaciones_tipo_idx on public.preparaciones (tipo);
create index if not exists preparaciones_aviso_ref_idx on public.preparaciones (aviso_ref);
create index if not exists preparaciones_updated_idx on public.preparaciones (updated_at desc);

create index if not exists preparaciones_texto_idx on public.preparaciones
  using gin (
    to_tsvector(
      'simple',
      coalesce(titulo, '') || ' ' ||
      coalesce(marca, '') || ' ' ||
      coalesce(modelo, '') || ' ' ||
      coalesce(tipo, '') || ' ' ||
      coalesce(aviso_ref, '') || ' ' ||
      coalesce(notas, '')
    )
  );

alter table public.preparaciones enable row level security;

drop policy if exists "preparaciones_all" on public.preparaciones;
create policy "preparaciones_all" on public.preparaciones
  for all using (true) with check (true);

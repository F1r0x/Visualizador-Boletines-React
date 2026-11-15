-- Estado realizada / archivada en fichas de preparación
-- Ejecutar en SQL Editor de Supabase (idempotente)

alter table public.preparaciones
  add column if not exists completada boolean not null default false,
  add column if not exists completada_en timestamptz,
  add column if not exists cerrada_por_aviso boolean not null default false;

create index if not exists preparaciones_completada_idx
  on public.preparaciones (completada)
  where completada = true;

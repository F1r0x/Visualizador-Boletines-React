-- Añadir cita propia a fichas de preparación (ejecutar en SQL Editor de Supabase)
alter table public.preparaciones
  add column if not exists cita_fecha text not null default '',
  add column if not exists cita_hora text not null default '';

create index if not exists preparaciones_cita_fecha_idx
  on public.preparaciones (cita_fecha)
  where cita_fecha <> '';

create index if not exists preparaciones_aviso_ref_idx
  on public.preparaciones (aviso_ref)
  where aviso_ref <> '';

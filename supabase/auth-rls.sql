-- Restringe tablas a usuarios autenticados
drop policy if exists "batches_all" on public.batches;
drop policy if exists "avisos_all" on public.avisos;
drop policy if exists "meta_all" on public.aviso_meta;

create policy "batches_auth" on public.batches
  for all to authenticated
  using (true) with check (true);

create policy "avisos_auth" on public.avisos
  for all to authenticated
  using (true) with check (true);

create policy "meta_auth" on public.aviso_meta
  for all to authenticated
  using (true) with check (true);

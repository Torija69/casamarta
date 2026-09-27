-- CasaMarta · 005 · Ajustes tras el asesor de Supabase
-- 1) es_miembro() sale del esquema expuesto por la API (evita /rest/v1/rpc/es_miembro).
--    Las políticas existentes siguen apuntando a la función (referencia por OID).
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;
alter function public.es_miembro() set schema privado;
grant execute on function privado.es_miembro() to authenticated;

-- 2) Una sola política permisiva por acción en usuarios_permitidos
drop policy "propietarios gestionan permitidos" on public.usuarios_permitidos;
create policy "propietarios añaden permitidos" on public.usuarios_permitidos
  for insert to authenticated
  with check (exists (select 1 from public.miembros m where m.user_id = (select auth.uid()) and m.rol = 'propietario'));
create policy "propietarios editan permitidos" on public.usuarios_permitidos
  for update to authenticated
  using (exists (select 1 from public.miembros m where m.user_id = (select auth.uid()) and m.rol = 'propietario'))
  with check (exists (select 1 from public.miembros m where m.user_id = (select auth.uid()) and m.rol = 'propietario'));
create policy "propietarios quitan permitidos" on public.usuarios_permitidos
  for delete to authenticated
  using (exists (select 1 from public.miembros m where m.user_id = (select auth.uid()) and m.rol = 'propietario'));

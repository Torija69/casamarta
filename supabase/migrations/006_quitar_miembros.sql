-- CasaMarta · 006 · Los propietarios pueden retirar miembros (al quitar un acceso)
create policy "propietarios quitan miembros" on public.miembros
  for delete to authenticated
  using (
    exists (select 1 from public.miembros m where m.user_id = (select auth.uid()) and m.rol = 'propietario')
    and user_id <> (select auth.uid())
  );

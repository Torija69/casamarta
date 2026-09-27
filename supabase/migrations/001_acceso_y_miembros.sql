-- CasaMarta · 001 · Acceso: lista de emails permitidos y miembros del espacio compartido
-- Todos los miembros comparten los mismos datos (una única operación de venta + compra).

create table public.usuarios_permitidos (
  email text primary key check (email = lower(email)),
  nombre text,
  rol text not null default 'colaborador' check (rol in ('propietario','colaborador')),
  created_at timestamptz not null default now()
);
comment on table public.usuarios_permitidos is 'Emails autorizados a crear cuenta en CasaMarta. Añade aquí a Marta para darle acceso.';

create table public.miembros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text,
  rol text not null default 'colaborador' check (rol in ('propietario','colaborador')),
  created_at timestamptz not null default now()
);

-- ¿El usuario actual es miembro? (security definer para evitar recursión de RLS)
create or replace function public.es_miembro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.miembros m where m.user_id = auth.uid());
$$;
revoke all on function public.es_miembro() from public, anon;
grant execute on function public.es_miembro() to authenticated;

-- Bloquea el alta de emails no autorizados
create or replace function public.validar_alta_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.usuarios_permitidos p where p.email = lower(new.email)) then
    raise exception 'Este email no está autorizado en CasaMarta';
  end if;
  return new;
end;
$$;

-- Da de alta al nuevo usuario como miembro
create or replace function public.alta_miembro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.miembros (user_id, email, nombre, rol)
  select new.id, lower(new.email), p.nombre, p.rol
  from public.usuarios_permitidos p where p.email = lower(new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.validar_alta_usuario() from public, anon, authenticated;
revoke all on function public.alta_miembro() from public, anon, authenticated;

create trigger casamarta_validar_alta before insert on auth.users
  for each row execute function public.validar_alta_usuario();
create trigger casamarta_alta_miembro after insert on auth.users
  for each row execute function public.alta_miembro();

alter table public.usuarios_permitidos enable row level security;
alter table public.miembros enable row level security;

create policy "miembros ven la lista de permitidos" on public.usuarios_permitidos
  for select to authenticated using ((select public.es_miembro()));
create policy "propietarios gestionan permitidos" on public.usuarios_permitidos
  for all to authenticated
  using (exists (select 1 from public.miembros m where m.user_id = (select auth.uid()) and m.rol = 'propietario'))
  with check (exists (select 1 from public.miembros m where m.user_id = (select auth.uid()) and m.rol = 'propietario'));
create policy "miembros ven miembros" on public.miembros
  for select to authenticated using ((select public.es_miembro()));

insert into public.usuarios_permitidos (email, nombre, rol)
values ('antonio.torija@me.com', 'Antonio', 'propietario');

-- Utilidad: updated_at automático
create or replace function public.tocar_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

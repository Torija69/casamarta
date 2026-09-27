-- CasaMarta · 002 · Tablas de la operación

-- Datos generales de la operación (fila única id = 1)
create table public.operacion (
  id int primary key default 1 check (id = 1),
  direccion_venta text default 'Majadahonda (Madrid)',
  municipio_venta text default 'Majadahonda',
  precio_venta_previsto numeric(12,2),
  precio_adquisicion numeric(12,2),
  gastos_adquisicion numeric(12,2),
  mejoras numeric(12,2),
  gastos_venta numeric(12,2),
  fecha_adquisicion date,
  valor_catastral_total numeric(12,2),
  valor_catastral_suelo numeric(12,2),
  hipoteca_pendiente numeric(12,2),
  fecha_firma_venta date,
  notaria_venta text,
  municipio_compra text default 'Majadahonda',
  precio_compra_previsto numeric(12,2),
  compra_obra_nueva boolean not null default false,
  fecha_firma_compra date,
  notaria_compra text,
  notas text,
  updated_at timestamptz not null default now()
);

create table public.titulares (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  porcentaje numeric(5,2) not null default 50 check (porcentaje >= 0 and porcentaje <= 100),
  fecha_nacimiento date,
  vivienda_habitual boolean not null default true,
  dependencia boolean not null default false,
  notas text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pisos (
  id uuid primary key default gen_random_uuid(),
  direccion text not null,
  municipio text default 'Majadahonda',
  barrio text,
  enlace_anuncio text,
  precio_pedido numeric(12,2),
  precio_oferta numeric(12,2),
  metros numeric(8,2),
  habitaciones int,
  banos int,
  planta text,
  ascensor boolean default false,
  garaje boolean default false,
  trastero boolean default false,
  terraza boolean default false,
  anio_construccion int,
  certificado_energetico text,
  gastos_comunidad numeric(10,2),
  ibi_anual numeric(10,2),
  obra_nueva boolean not null default false,
  estado text not null default 'interesante'
    check (estado in ('interesante','visita_programada','visitado','en_oferta','favorito','descartado','comprado')),
  valoracion int check (valoracion between 1 and 5),
  pros text,
  contras text,
  contacto_nombre text,
  contacto_telefono text,
  contacto_agencia text,
  fecha_visita date,
  hora_visita time,
  lat double precision,
  lng double precision,
  notas text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.visitas_pisos (
  id uuid primary key default gen_random_uuid(),
  piso_id uuid not null references public.pisos(id) on delete cascade,
  fecha date not null,
  hora time,
  asistentes text,
  impresiones text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.compradores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  email text,
  via text default 'agencia' check (via in ('agencia','directo','portal','conocido','otro')),
  fecha_visita date,
  hora_visita time,
  resultado text not null default 'pendiente'
    check (resultado in ('pendiente','interesado','muy_interesado','no_interesado')),
  notas text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ofertas (
  id uuid primary key default gen_random_uuid(),
  comprador_id uuid not null references public.compradores(id) on delete cascade,
  importe numeric(12,2) not null,
  fecha date not null default current_date,
  financiacion text default 'hipoteca' check (financiacion in ('hipoteca','contado','mixta','desconocida')),
  condiciones text,
  estado text not null default 'recibida' check (estado in ('recibida','contraofertada','aceptada','rechazada','retirada')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agencias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  agente text,
  telefono text,
  email text,
  tipo_comision text not null default 'porcentaje' check (tipo_comision in ('porcentaje','importe_fijo')),
  comision_valor numeric(12,2),
  iva_incluido boolean not null default false,
  exclusividad boolean not null default false,
  fecha_firma date,
  fecha_vencimiento date,
  prorroga_automatica boolean not null default false,
  dias_preaviso int default 15,
  clausulas text,
  notas text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  operacion text not null default 'venta' check (operacion in ('venta','compra')),
  obligatorio boolean not null default true,
  estado text not null default 'pendiente' check (estado in ('pendiente','en_tramite','obtenido','entregado','no_aplica')),
  responsable text,
  fecha_caducidad date,
  orden int default 100,
  notas text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suministros (
  id uuid primary key default gen_random_uuid(),
  vivienda text not null default 'actual' check (vivienda in ('actual','nueva')),
  tipo text not null default 'luz'
    check (tipo in ('luz','gas','agua','internet','movil','seguro_hogar','alarma','comunidad','otro')),
  compania text,
  titular text,
  numero_contrato text,
  cups_referencia text,
  iban text,
  fecha_alta date,
  fecha_vencimiento date,
  importe_mensual numeric(10,2),
  telefono_atencion text,
  estado text not null default 'activo'
    check (estado in ('activo','pendiente_cambio_titular','pendiente_baja','de_baja','pendiente_alta')),
  fecha_accion date,
  lectura_entrega text,
  notas text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reformas (
  id uuid primary key default gen_random_uuid(),
  piso_id uuid references public.pisos(id) on delete set null,
  titulo text not null,
  categoria text not null default 'otro'
    check (categoria in ('cocina','bano','electricidad','fontaneria','pintura','suelos','carpinteria','ventanas','climatizacion','otro')),
  estancia text,
  descripcion text,
  prioridad text not null default 'necesaria' check (prioridad in ('urgente','necesaria','opcional')),
  estado text not null default 'pendiente_presupuesto'
    check (estado in ('pendiente_presupuesto','presupuestada','aprobada','en_ejecucion','finalizada')),
  presupuesto_estimado numeric(12,2),
  pagado numeric(12,2) default 0,
  fecha_inicio date,
  fecha_fin date,
  notas text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  reforma_id uuid not null references public.reformas(id) on delete cascade,
  empresa text not null,
  contacto text,
  telefono text,
  importe numeric(12,2),
  fecha date default current_date,
  elegido boolean not null default false,
  notas text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria text not null default 'general' check (categoria in ('fiscal','mudanza','general','notaria')),
  fecha_limite date,
  hecha boolean not null default false,
  orden int default 100,
  notas text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  fecha date not null,
  hora time,
  tipo text not null default 'otro' check (tipo in ('notaria','banco','tasacion','mudanza','reunion','otro')),
  lugar text,
  notas text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Parámetros fiscales editables (con su fuente)
create table public.parametros (
  clave text primary key,
  valor jsonb not null,
  descripcion text,
  fuente_url text,
  consultado date default current_date,
  updated_at timestamptz not null default now()
);

-- Archivos adjuntos de cualquier módulo (fotos y documentos en Storage)
create table public.archivos (
  id uuid primary key default gen_random_uuid(),
  entidad text not null check (entidad in ('pisos','visitas_pisos','compradores','agencias','documentos','suministros','reformas','presupuestos','operacion','eventos')),
  entidad_id uuid,
  bucket text not null check (bucket in ('fotos-pisos','documentos','reformas-fotos')),
  path text not null unique,
  nombre text not null,
  mime text,
  tamano bigint,
  tipo text not null default 'documento' check (tipo in ('foto','documento')),
  descripcion text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Índices
create index on public.visitas_pisos (piso_id);
create index on public.ofertas (comprador_id);
create index on public.reformas (piso_id);
create index on public.presupuestos (reforma_id);
create index on public.archivos (entidad, entidad_id);
create index on public.pisos (fecha_visita);
create index on public.compradores (fecha_visita);
create index on public.documentos (fecha_caducidad);
create index on public.agencias (fecha_vencimiento);
create index on public.eventos (fecha);
do $$
declare t text;
begin
  foreach t in array array['titulares','pisos','visitas_pisos','compradores','ofertas','agencias','documentos',
                           'suministros','reformas','presupuestos','tareas','eventos','archivos'] loop
    execute format('create index on public.%I (created_by)', t);
  end loop;
end $$;

-- updated_at + RLS (solo miembros) en todas las tablas de datos
do $$
declare t text;
begin
  foreach t in array array['operacion','titulares','pisos','visitas_pisos','compradores','ofertas','agencias','documentos',
                           'suministros','reformas','presupuestos','tareas','eventos','parametros'] loop
    execute format('create trigger tocar_updated_at before update on public.%I for each row execute function public.tocar_updated_at()', t);
  end loop;
  foreach t in array array['operacion','titulares','pisos','visitas_pisos','compradores','ofertas','agencias','documentos',
                           'suministros','reformas','presupuestos','tareas','eventos','parametros','archivos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "miembros leen" on public.%I for select to authenticated using ((select public.es_miembro()))', t);
    execute format('create policy "miembros crean" on public.%I for insert to authenticated with check ((select public.es_miembro()))', t);
    execute format('create policy "miembros editan" on public.%I for update to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()))', t);
    execute format('create policy "miembros borran" on public.%I for delete to authenticated using ((select public.es_miembro()))', t);
  end loop;
end $$;

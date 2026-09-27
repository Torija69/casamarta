-- CasaMarta · 003 · Storage privado (solo miembros)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('fotos-pisos', 'fotos-pisos', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('reformas-fotos', 'reformas-fotos', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('documentos', 'documentos', false, 26214400, null)
on conflict (id) do nothing;

create policy "casamarta miembros leen archivos" on storage.objects
  for select to authenticated
  using (bucket_id in ('fotos-pisos','reformas-fotos','documentos') and (select public.es_miembro()));
create policy "casamarta miembros suben archivos" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('fotos-pisos','reformas-fotos','documentos') and (select public.es_miembro()));
create policy "casamarta miembros actualizan archivos" on storage.objects
  for update to authenticated
  using (bucket_id in ('fotos-pisos','reformas-fotos','documentos') and (select public.es_miembro()))
  with check (bucket_id in ('fotos-pisos','reformas-fotos','documentos') and (select public.es_miembro()));
create policy "casamarta miembros borran archivos" on storage.objects
  for delete to authenticated
  using (bucket_id in ('fotos-pisos','reformas-fotos','documentos') and (select public.es_miembro()));

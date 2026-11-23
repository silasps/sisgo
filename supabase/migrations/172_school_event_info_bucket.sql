-- Bucket público pra PDF de informações do evento (valores, hospedagem,
-- horários etc.) — mostrado pro candidato assim que ele termina a
-- inscrição. Texto livre fica em schools.form_config.event_info (jsonb já
-- existente, sem migration pra isso); aqui só o storage do PDF opcional,
-- mesmo padrão de school-media (003_schools_public_page.sql).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-event-info',
  'school-event-info',
  true,
  10485760, -- 10MB
  array['application/pdf']
)
on conflict (id) do nothing;

create policy "school_event_info_bucket_public_read" on storage.objects
  for select using (bucket_id = 'school-event-info');

create policy "school_event_info_bucket_admin_upload" on storage.objects
  for insert with check (
    bucket_id = 'school-event-info' and auth.uid() is not null
  );

create policy "school_event_info_bucket_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'school-event-info' and auth.uid() is not null
  );

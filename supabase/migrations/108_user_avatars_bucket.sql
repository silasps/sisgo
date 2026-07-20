-- ============================================================
-- SISGO — Migration 108: Bucket de avatars de usuário
-- ============================================================
-- Foto de perfil pessoal (self-service, guardada em
-- auth.users.user_metadata.avatar_url), separada da foto oficial
-- em people.photo_url usada na carteirinha/registro administrativo.
-- Cada usuário só pode escrever dentro da própria pasta (auth.uid()).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, '{image/png,image/jpeg,image/webp}')
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_own_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_own_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_own_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

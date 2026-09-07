-- Documentos anexados no formulário de obreiro (foto pessoal, RG frente/
-- verso ou passaporte na Seção 10, certidão de casamento na Seção 03).
-- Bucket privado, mesmo padrão de application-documents (migration 118):
-- gravação só pela Server Action após validar o token da inscrição; a
-- equipe acessa por URL assinada temporária.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-application-documents',
  'staff-application-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

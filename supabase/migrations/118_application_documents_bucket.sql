-- Documentos anexados na Seção 15 do formulário de inscrição (foto do
-- rosto, RG frente/verso, CPF, passaporte). Bucket privado: gravação só
-- pela Server Action após validar o token da inscrição; a equipe acessa
-- por URL assinada temporária — mesmo padrão do bucket payment-receipts
-- (migration 117).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

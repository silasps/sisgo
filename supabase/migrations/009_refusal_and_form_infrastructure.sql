-- ============================================================
-- SISGO — Migration 009: Motivo de recusa + e-mail da ETED
-- ============================================================

-- Motivo de recusa em pré-inscrições
ALTER TABLE school_interest_forms
  ADD COLUMN IF NOT EXISTS refusal_reason text DEFAULT NULL;

-- Motivo de recusa em candidatos a aluno
ALTER TABLE student_applications
  ADD COLUMN IF NOT EXISTS refusal_reason text DEFAULT NULL;

-- E-mail e senha SMTP da ETED (Gmail App Password)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS contact_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS smtp_password text DEFAULT NULL;

-- Bucket privado para documentos dos candidatos (fotos, RG, CPF, passaporte)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'applicant-docs',
  'applicant-docs',
  false,
  20971520,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Apenas usuários autenticados (admin client) acessam os documentos
CREATE POLICY "applicant_docs_admin_all" ON storage.objects
  FOR ALL USING (bucket_id = 'applicant-docs' AND auth.uid() IS NOT NULL);

-- Configuração do formulário por escola
-- Permite ao líder desativar campos específicos do formulário de inscrição
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS form_config jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN schools.form_config IS
  'Configuração do formulário: { "hidden_fields": ["s5.passaporte", "s5.rg", ...] }';

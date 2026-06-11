-- Adiciona 'em_analise' ao status de school_interest_forms
-- para indicar que o candidato preencheu o formulário completo
ALTER TABLE school_interest_forms
  DROP CONSTRAINT IF EXISTS school_interest_forms_status_check;

ALTER TABLE school_interest_forms
  ADD CONSTRAINT school_interest_forms_status_check
  CHECK (status IN ('pendente','formulario_enviado','em_contato','em_analise','convertido','descartado'));

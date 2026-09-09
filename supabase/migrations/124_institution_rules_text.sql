-- Texto livre com as regras e valores da instituição, configurado pelo
-- líder de base em Configurações e exibido no formulário de inscrição de
-- obreiro (seção de aceite final), com opção de baixar ou receber por
-- e-mail.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS institution_rules_text TEXT;

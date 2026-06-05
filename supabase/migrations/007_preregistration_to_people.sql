-- ============================================================
-- SISGO — Migration 007: Pré-inscrição cria pessoa automaticamente
-- ============================================================

-- Coluna de origem em people (para identificar pré-inscritos públicos)
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;
-- valores esperados: null (cadastro manual), 'pre_inscricao_publica'

-- Vincula school_interest_forms → people
ALTER TABLE school_interest_forms
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_school_interest_forms_person_id
  ON school_interest_forms(person_id);

-- ============================================================
-- Novos roles podem ler e atualizar pré-inscrições da sua org
-- ============================================================

-- SELECT: lider_eted, dh e lider_base veem todos os interest forms da org.
-- A filtragem por escola e a regra dos 3 dias são feitas na aplicação.
CREATE POLICY "school_interest_forms_leader_select" ON school_interest_forms
  FOR SELECT USING (
    organization_id = auth_organization_id() AND
    auth_role() IN ('lider_eted', 'dh', 'lider_base')
  );

-- UPDATE: mesmos roles podem atualizar status
CREATE POLICY "school_interest_forms_leader_update" ON school_interest_forms
  FOR UPDATE USING (
    organization_id = auth_organization_id() AND
    auth_role() IN ('lider_eted', 'dh', 'lider_base')
  );

-- INSERT em people via admin (server action público):
-- Feito pelo admin client no servidor — políticas de RLS normais aplicadas.
-- Garantir que novos roles possam inserir pessoas (necessário para o admin client)
-- O admin client bypassa RLS, então nenhuma policy adicional é necessária aqui.

-- Novos roles podem ler person_contacts (email/phone dos pré-inscritos)
-- já coberto pela migration 006 "novos roles - person_contacts select"

-- Formulários de referência (pastor e amigo) vinculados a school_applications
CREATE TABLE IF NOT EXISTS reference_forms (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_application_id uuid        NOT NULL REFERENCES school_applications(id) ON DELETE CASCADE,
  type                  text        NOT NULL CHECK (type IN ('pastor', 'amigo')),
  token                 text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at      timestamptz NOT NULL DEFAULT now() + interval '30 days',
  status                text        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado')),
  form_data             jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca por token (acesso público)
CREATE INDEX IF NOT EXISTS reference_forms_token_idx ON reference_forms (token);

-- Índice para busca por aplicação
CREATE INDEX IF NOT EXISTS reference_forms_application_idx ON reference_forms (school_application_id, type);

-- RLS: acesso apenas via service_role (server actions usam admin client)
ALTER TABLE reference_forms ENABLE ROW LEVEL SECURITY;

-- Nenhuma política pública — acesso controlado via admin client no servidor

-- 019: sistema de reservas (espaços e quartos)

CREATE TABLE reservations (
  id                   uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id      uuid         REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  type                 text         NOT NULL CHECK (type IN ('espaco', 'quarto')),
  title                text         NOT NULL,
  description          text,
  requester_type       text         NOT NULL CHECK (requester_type IN ('ministry', 'school', 'person')),
  requester_id         uuid         NOT NULL,
  requested_by         uuid         REFERENCES auth.users(id) NOT NULL,
  starts_at            date         NOT NULL,
  ends_at              date         NOT NULL,
  resource_description text,
  guests_count         int,
  guests_description   text,
  estimated_cost       numeric(10,2),
  final_cost           numeric(10,2),
  status               text         NOT NULL DEFAULT 'pendente'
                                    CHECK (status IN ('pendente','aprovada','rejeitada','cancelada')),
  reviewed_by          uuid         REFERENCES auth.users(id),
  reviewed_at          timestamptz,
  review_notes         text,
  created_at           timestamptz  DEFAULT now() NOT NULL,
  updated_at           timestamptz  DEFAULT now() NOT NULL
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- membros da org podem ver todas as reservas da org
CREATE POLICY "org members can view reservations" ON reservations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- solicitante pode inserir
CREATE POLICY "requester can insert reservation" ON reservations
  FOR INSERT
  WITH CHECK (
    requested_by = auth.uid() AND
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid() AND active = true
    )
  );

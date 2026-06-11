-- 021: solicitações de obreiros para escola (aprovadas pelo DH)

CREATE TABLE school_pending_requests (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid        REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  school_id       uuid        REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  requested_by    uuid        REFERENCES auth.users(id) NOT NULL,
  request_type    text        NOT NULL DEFAULT 'add_obreiro'
                              CHECK (request_type IN ('add_obreiro')),
  person_id       uuid        REFERENCES people(id),
  role            text        NOT NULL DEFAULT 'Obreiro',
  notes           text,
  status          text        NOT NULL DEFAULT 'pendente'
                              CHECK (status IN ('pendente','aprovado','rejeitado','cancelado')),
  reviewed_by     uuid        REFERENCES auth.users(id),
  reviewed_at     timestamptz,
  review_notes    text,
  created_at      timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE school_pending_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view school_pending_requests" ON school_pending_requests
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users
      WHERE user_id = auth.uid() AND active = true
    )
  );

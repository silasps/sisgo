-- Push notification device tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token           TEXT NOT NULL,
  platform        TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);

-- ─── Trigger function: queue notification on pending-relevant changes ───

CREATE OR REPLACE FUNCTION queue_pending_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_payload    JSONB;
  v_name       TEXT;
BEGIN
  -- Skip if status didn't actually change on UPDATE
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_event_type := TG_ARGV[0];

  -- Build payload with available columns
  v_payload := jsonb_build_object(
    'table_name',      TG_TABLE_NAME,
    'operation',       TG_OP,
    'record_id',       NEW.id,
    'organization_id', NEW.organization_id,
    'old_status',      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    'new_status',      NEW.status
  );

  -- Add school_id if the table has it
  IF TG_TABLE_NAME IN ('school_interest_forms', 'student_applications', 'staff_applications') THEN
    v_payload := v_payload || jsonb_build_object('school_id', NEW.school_id);
  END IF;

  -- Add name for display
  IF TG_TABLE_NAME = 'school_interest_forms' THEN
    v_payload := v_payload || jsonb_build_object('person_name', NEW.full_name);
  END IF;

  INSERT INTO notification_events (event_type, payload)
  VALUES (v_event_type, v_payload);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Triggers on pending-relevant tables ───

CREATE TRIGGER trg_notify_interest_form
  AFTER INSERT OR UPDATE OF status ON school_interest_forms
  FOR EACH ROW EXECUTE FUNCTION queue_pending_notification('interest_form');

CREATE TRIGGER trg_notify_student_application
  AFTER INSERT OR UPDATE OF status ON student_applications
  FOR EACH ROW EXECUTE FUNCTION queue_pending_notification('student_application');

CREATE TRIGGER trg_notify_staff_application
  AFTER INSERT OR UPDATE OF status ON staff_applications
  FOR EACH ROW EXECUTE FUNCTION queue_pending_notification('staff_application');

CREATE TRIGGER trg_notify_ministry_request
  AFTER INSERT OR UPDATE OF status ON ministry_pending_requests
  FOR EACH ROW EXECUTE FUNCTION queue_pending_notification('ministry_request');

CREATE TRIGGER trg_notify_service_request
  AFTER INSERT OR UPDATE OF status ON service_requests
  FOR EACH ROW EXECUTE FUNCTION queue_pending_notification('service_request');

-- ─── Add processed_at to notification_events for queue processing ───

ALTER TABLE notification_events
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notification_events_unprocessed
  ON notification_events(created_at) WHERE processed_at IS NULL;

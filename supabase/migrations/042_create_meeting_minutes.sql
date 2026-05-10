-- Migration 042: atas de reunião por projeto
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  meeting_date  DATE NOT NULL,
  recording_url TEXT,
  attendees     JSONB NOT NULL DEFAULT '[]',
  template      JSONB NOT NULL DEFAULT '{}',
  next_actions  JSONB NOT NULL DEFAULT '[]',
  notes         TEXT,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_project ON meeting_minutes(project_id, meeting_date DESC);

ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY meeting_minutes_admin ON meeting_minutes
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY meeting_minutes_member_select ON meeting_minutes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects_v2 p
      WHERE p.id = meeting_minutes.project_id
        AND p.squad IS NOT NULL
        AND is_squad_member(p.squad)
    )
  );

CREATE POLICY meeting_minutes_member_insert ON meeting_minutes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects_v2 p
      WHERE p.id = meeting_minutes.project_id
        AND p.squad IS NOT NULL
        AND is_squad_member(p.squad)
    )
  );

CREATE POLICY meeting_minutes_member_update ON meeting_minutes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects_v2 p
      WHERE p.id = meeting_minutes.project_id
        AND p.squad IS NOT NULL
        AND is_squad_member(p.squad)
    )
  );

CREATE POLICY meeting_minutes_member_delete ON meeting_minutes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects_v2 p
      WHERE p.id = meeting_minutes.project_id
        AND p.squad IS NOT NULL
        AND is_squad_member(p.squad)
    )
  );

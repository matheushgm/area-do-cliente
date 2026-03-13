-- Migration 013: Create attachments
-- Anexos do projeto — substitui base64 no JSONB; arquivos físicos no Supabase Storage

CREATE TABLE attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  size         INTEGER NOT NULL,
  type         TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS via join com projects_v2
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachments_admin ON attachments
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY attachments_account ON attachments
  USING (
    project_id IN (
      SELECT id FROM projects_v2 WHERE account_id = auth.uid()
    )
  );

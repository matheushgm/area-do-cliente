-- Migration 009: Create landing_pages
-- Landing pages geradas por IA — múltiplos por projeto

CREATE TABLE landing_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  generated_content TEXT,
  rating            TEXT,
  generated_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS via join com projects_v2
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY landing_pages_admin ON landing_pages
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY landing_pages_account ON landing_pages
  USING (
    project_id IN (
      SELECT id FROM projects_v2 WHERE account_id = auth.uid()
    )
  );

-- Migration 003: Create personas
-- Personas geradas por IA — múltiplas por projeto

CREATE TABLE personas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  answers           JSONB NOT NULL DEFAULT '{}',
  generated_content TEXT,
  generated_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS via join com projects_v2
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY personas_admin ON personas
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY personas_account ON personas
  USING (
    project_id IN (
      SELECT id FROM projects_v2 WHERE account_id = auth.uid()
    )
  );

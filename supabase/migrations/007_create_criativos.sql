-- Migration 007: Create criativos
-- Criativos de anúncios gerados por IA — múltiplos por projeto

CREATE TABLE criativos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  answers           JSONB NOT NULL DEFAULT '{}',
  generated_content TEXT,
  rating            TEXT,
  generated_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS via join com projects_v2
ALTER TABLE criativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY criativos_admin ON criativos
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY criativos_account ON criativos
  USING (
    project_id IN (
      SELECT id FROM projects_v2 WHERE account_id = auth.uid()
    )
  );

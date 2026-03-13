-- Migration 011: Create estrategia
-- Narrativa estratégica gerada por IA — 1:1 com projects_v2

CREATE TABLE estrategia (
  project_id   UUID PRIMARY KEY REFERENCES projects_v2(id) ON DELETE CASCADE,
  narrativa    TEXT,
  generated_at TIMESTAMPTZ
);

-- RLS via join com projects_v2
ALTER TABLE estrategia ENABLE ROW LEVEL SECURITY;

CREATE POLICY estrategia_admin ON estrategia
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY estrategia_account ON estrategia
  USING (
    project_id IN (
      SELECT id FROM projects_v2 WHERE account_id = auth.uid()
    )
  );

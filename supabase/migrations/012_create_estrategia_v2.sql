-- Migration 012: Create estrategia_v2
-- Análise estratégica estruturada com inputs do usuário — 1:1 com projects_v2

CREATE TABLE estrategia_v2 (
  project_id   UUID PRIMARY KEY REFERENCES projects_v2(id) ON DELETE CASCADE,
  problemas    TEXT[],
  swot         JSONB,
  concorrentes JSONB,
  riscos       JSONB,
  funis        TEXT[],
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER estrategia_v2_updated_at
  BEFORE UPDATE ON estrategia_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS via join com projects_v2
ALTER TABLE estrategia_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY estrategia_v2_admin ON estrategia_v2
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY estrategia_v2_account ON estrategia_v2
  USING (
    project_id IN (
      SELECT id FROM projects_v2 WHERE account_id = auth.uid()
    )
  );

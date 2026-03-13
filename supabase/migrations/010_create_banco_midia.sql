-- Migration 010: Create banco_midia
-- Biblioteca de marca do projeto — 1:1 com projects_v2
-- Inclui fonte_principal/secundaria/obs e logo_url (campos adicionais descobertos no JSONB atual)

CREATE TABLE banco_midia (
  project_id        UUID PRIMARY KEY REFERENCES projects_v2(id) ON DELETE CASCADE,
  photos            JSONB,
  videos            JSONB,
  color_palette     JSONB,
  logo_url          TEXT,
  fonte_principal   TEXT,
  fonte_secundaria  TEXT,
  fonte_obs         TEXT,
  observacoes       TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER banco_midia_updated_at
  BEFORE UPDATE ON banco_midia
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS via join com projects_v2
ALTER TABLE banco_midia ENABLE ROW LEVEL SECURITY;

CREATE POLICY banco_midia_admin ON banco_midia
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY banco_midia_account ON banco_midia
  USING (
    project_id IN (
      SELECT id FROM projects_v2 WHERE account_id = auth.uid()
    )
  );

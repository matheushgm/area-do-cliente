-- Migration 004: Create ofertas
-- Oferta matadora gerada por IA — 1:N com projeto (mas tipicamente 1)

CREATE TABLE ofertas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  answers           JSONB NOT NULL DEFAULT '{}',
  generated_content TEXT,
  generated_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS via join com projects_v2
ALTER TABLE ofertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY ofertas_admin ON ofertas
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY ofertas_account ON ofertas
  USING (
    project_id IN (
      SELECT id FROM projects_v2 WHERE account_id = auth.uid()
    )
  );

-- Migration 006: Create resultados
-- Tracking de métricas semanais/mensais por projeto
-- Inclui investido e valor_vendas (campos adicionais descobertos no JSONB atual)

CREATE TABLE resultados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  period      DATE NOT NULL,
  investido   NUMERIC(12,2),
  leads       INTEGER,
  mql         INTEGER,
  sql         INTEGER,
  vendas      INTEGER,
  valor_vendas NUMERIC(12,2),
  UNIQUE (project_id, period)
);

-- RLS via join com projects_v2
ALTER TABLE resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY resultados_admin ON resultados
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY resultados_account ON resultados
  USING (
    project_id IN (
      SELECT id FROM projects_v2 WHERE account_id = auth.uid()
    )
  );

-- Migration 002: Create roi_calculators
-- Múltiplos cenários de ROI por projeto

CREATE TABLE roi_calculators (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  name             TEXT NOT NULL DEFAULT 'Principal',
  media_orcamento  NUMERIC(12,2),
  custo_marketing  NUMERIC(12,2),
  ticket_medio     NUMERIC(12,2),
  qtd_compras      SMALLINT,
  margem_bruta     NUMERIC(5,2),
  roi_desejado     NUMERIC(6,2),
  taxa_lead_mql    NUMERIC(5,2),
  taxa_mql_sql     NUMERIC(5,2),
  taxa_sql_venda   NUMERIC(5,2),
  benchmark_type   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS via join com projects_v2
ALTER TABLE roi_calculators ENABLE ROW LEVEL SECURITY;

CREATE POLICY roi_calculators_admin ON roi_calculators
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY roi_calculators_account ON roi_calculators
  USING (
    project_id IN (
      SELECT id FROM projects_v2 WHERE account_id = auth.uid()
    )
  );

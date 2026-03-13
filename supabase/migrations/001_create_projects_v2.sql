-- Migration 001: Create projects_v2
-- Tabela normalizada para substituir o JSONB em projects.data
-- A tabela projects original é preservada intacta durante a migração.

CREATE TABLE projects_v2 (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id             TEXT,           -- ID antigo (timestamp string) para rastreabilidade
  company_name          TEXT NOT NULL,
  cnpj                  TEXT,
  business_type         TEXT NOT NULL,
  segmento              TEXT,
  responsible_name      TEXT NOT NULL,
  responsible_role      TEXT,
  contract_model        TEXT NOT NULL,
  contract_payment_type TEXT,
  contract_value        NUMERIC(12,2),
  contract_date         DATE,
  competitors           TEXT[],
  has_sales_team        BOOLEAN,
  digital_maturity      SMALLINT,
  upsell_potential      BOOLEAN,
  upsell_notes          TEXT,
  other_people          JSONB,
  services              TEXT[],
  services_data         JSONB,
  raio_x_file_url       TEXT,
  sla_file_url          TEXT,
  account_id            UUID NOT NULL REFERENCES profiles(id),
  status                TEXT NOT NULL DEFAULT 'onboarding',
  completed_steps       TEXT[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_v2_updated_at
  BEFORE UPDATE ON projects_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE projects_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_v2_admin ON projects_v2
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY projects_v2_account ON projects_v2
  USING (account_id = auth.uid());

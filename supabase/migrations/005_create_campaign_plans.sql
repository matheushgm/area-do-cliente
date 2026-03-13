-- Migration 005: Create campaign_plans
-- Planos de campanha — múltiplos por projeto

CREATE TABLE campaign_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Principal',
  answers    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS via join com projects_v2
ALTER TABLE campaign_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_plans_admin ON campaign_plans
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY campaign_plans_account ON campaign_plans
  USING (
    project_id IN (
      SELECT id FROM projects_v2 WHERE account_id = auth.uid()
    )
  );

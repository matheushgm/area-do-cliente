-- Migration 008: Create google_ads
-- Campanhas Google Ads geradas por IA — múltiplos por projeto

CREATE TABLE google_ads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  answers           JSONB NOT NULL DEFAULT '{}',
  generated_content TEXT,
  rating            TEXT,
  generated_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS via join com projects_v2
ALTER TABLE google_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY google_ads_admin ON google_ads
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

CREATE POLICY google_ads_account ON google_ads
  USING (
    project_id IN (
      SELECT id FROM projects_v2 WHERE account_id = auth.uid()
    )
  );

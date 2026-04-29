-- Migration 032: Add is_test flag to squads
-- When TRUE, the squad's clients are excluded from home-page financial
-- aggregations (Contrato Cheio, MRR, Churn) and from the consolidated
-- totals on /squads-report.

ALTER TABLE squads ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

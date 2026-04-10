-- Migration 025: Add NPS (Net Promoter Score) column to projects_v2
-- Stores milestone-based NPS responses as JSONB
-- Structure: { marco1: { score, q2, q3, q4, q5, q6, submittedAt } | null, marco2: ..., marco3: ... }

ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS nps JSONB;

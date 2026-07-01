-- Migration 067: add planejamento_marketing JSONB column to projects_v2
ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS planejamento_marketing JSONB;

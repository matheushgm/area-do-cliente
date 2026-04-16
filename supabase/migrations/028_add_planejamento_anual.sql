-- Migration 028: add planejamento_anual JSONB column to projects_v2
ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS planejamento_anual JSONB;

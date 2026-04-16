-- Migration 029: add meta_lab_budget and meta_lab_audience_type to projects_v2
ALTER TABLE projects_v2
  ADD COLUMN IF NOT EXISTS meta_lab_budget      NUMERIC,
  ADD COLUMN IF NOT EXISTS meta_lab_audience_type TEXT;

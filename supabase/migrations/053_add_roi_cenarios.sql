-- Migration 053: add roi_cenarios JSONB column to projects_v2
--
-- Permite múltiplas calculadoras de ROI por cliente (cenários distintos /
-- por produto). Shape: [{ id, nome, calc, result, createdAt, updatedAt }].
-- O primeiro cenário continua espelhado em roiCalc/roiResult (tabela
-- roi_calculators) pra compatibilidade com o onboarding e a Jornada.
ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS roi_cenarios JSONB;

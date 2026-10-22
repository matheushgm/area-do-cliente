-- Migration 105: add roi_livres JSONB column to projects_v2
--
-- Calculadoras de ROI avulsas (módulo "Calculadora de ROI" em Ferramentas),
-- independentes do perfil do cliente: nascem em branco, cada uma com nome
-- próprio. Shape: [{ id, nome, calc, result, createdAt, updatedAt }].
ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS roi_livres JSONB;

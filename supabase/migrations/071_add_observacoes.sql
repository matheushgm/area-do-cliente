-- Migration 071: add observacoes TEXT column to projects_v2
--
-- Campo livre "Observações" da seção "Dados do Cliente" (aba do ClientProfile).
-- Texto livre para informações adicionais sobre o cliente que não se encaixam
-- nos campos estruturados do onboarding. Nullable; segue o mesmo modelo de
-- upsell_notes.
ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS observacoes TEXT;

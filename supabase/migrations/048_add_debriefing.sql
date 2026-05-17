-- Migration 048: add debriefing JSONB column to projects_v2
--
-- Armazena a lista de criativos rastreados pra debriefing:
-- { ads: [{ id, createdAt, url, tipo, campanhaId, nome, funilId,
--           observacao, addedAt, updatedAt }] }
ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS debriefing JSONB;

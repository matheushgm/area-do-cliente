-- Migration 074: add lp_central JSONB column to projects_v2
--
-- Central de Landing Pages (banco de LPs do cliente):
-- { lps: [{ id, createdAt, nome, url, funilId, observacao, status,
--           aprovacao: { status, motivo, sugestao, enviadoEm, decididoEm },
--           addedAt, updatedAt }] }
ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS lp_central JSONB;

-- Migration 078: várias Ofertas Matadoras por cliente
-- A UNIQUE(project_id) prendia o módulo a uma única oferta por projeto.
-- Agora a lista é gravada por `id` (upsert) e a oferta que representa o
-- projeto nos outros módulos é a marcada com answers->>'principal'.

ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS ofertas_project_id_unique;
CREATE INDEX IF NOT EXISTS ofertas_project_id_idx ON ofertas (project_id);

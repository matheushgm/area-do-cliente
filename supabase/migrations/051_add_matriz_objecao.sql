-- Migration 051: add matriz_objecao JSONB column to projects_v2
--
-- Matriz de objeções do cliente — tabela editável (pela agência e pelo
-- cliente via link público). Shape:
-- { rows: [{ id, tipo, antecipar, causa, resposta }] }
ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS matriz_objecao JSONB;

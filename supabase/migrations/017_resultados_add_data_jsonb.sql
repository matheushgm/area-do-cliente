-- Adiciona coluna JSONB para armazenar o objeto aninhado de resultados
-- (formato legado: {modelo, b2b: {"YYYY-MM": {semana1: {...}}}, b2c: {...}})
-- enquanto as colunas flat (leads, mql, etc.) ficam reservadas para Phase 5.
ALTER TABLE resultados ADD COLUMN IF NOT EXISTS data JSONB;

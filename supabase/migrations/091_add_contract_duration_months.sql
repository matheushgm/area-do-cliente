-- Migration 091: add contract_duration_months SMALLINT column to projects_v2
--
-- Duração (em meses) do Programa de Aceleração — antes fixa em 3 meses no
-- cálculo de MRR/LTV (src/lib/utils.js: mrrValue / ltvBreakdown). Passa a ser
-- editável por projeto (3, 6, 12...). NULL mantém o fallback de 3 meses no
-- código, para não quebrar projetos já cadastrados. Sem uso para o modelo
-- 'assessoria' (cobrança recorrente, sem cap).
ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS contract_duration_months SMALLINT;

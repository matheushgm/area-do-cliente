-- Migration 045: add kickoff JSONB column to projects_v2
--
-- Armazena o diagnóstico de Kickoff feito pelo Account Manager na primeira
-- reunião com o cliente. Shape:
-- {
--   businessType: 'b2b' | 'b2c' | 'hibrido',
--   answers: { [questionId]: <value> },
--   scores: { [pillarId]: 0..100 },
--   totalScore: 0..100,
--   stageId: 0..4,
--   stageLabel: 'Caos' | 'Validação' | 'Estruturação' | 'Aceleração' | 'Escala',
--   weaknesses: [pillarId, ...],
--   nextSteps: [string, ...],
--   aiAnalysis: null | '<markdown>',
--   completedAt: timestamp,
--   updatedAt: timestamp,
-- }

ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS kickoff JSONB;

-- Migration 038: múltiplos responsáveis + cliente como responsável
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_responsible BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: migrar assignee_id legado para assignee_ids
UPDATE tasks SET assignee_ids = ARRAY[assignee_id]
WHERE assignee_id IS NOT NULL
  AND (assignee_ids IS NULL OR cardinality(assignee_ids) = 0);

-- Drop antigo
ALTER TABLE tasks DROP COLUMN IF EXISTS assignee_id;
DROP INDEX IF EXISTS idx_tasks_assignee_id;

-- Índice GIN para queries por responsável
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_ids ON tasks USING GIN (assignee_ids);

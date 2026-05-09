-- Migration 037: rastrear data de conclusão das tarefas
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill: tarefas já concluídas usam updated_at como aproximação
UPDATE tasks SET completed_at = updated_at WHERE status = 'done' AND completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);

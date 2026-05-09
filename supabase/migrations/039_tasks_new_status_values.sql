-- Migration 039: novos valores de status (backlog, a_fazer, em_andamento, em_revisao, concluido)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

UPDATE tasks SET status = 'a_fazer'      WHERE status = 'pending';
UPDATE tasks SET status = 'em_andamento' WHERE status = 'in_progress';
UPDATE tasks SET status = 'concluido'    WHERE status = 'done';

ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'backlog';

ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('backlog', 'a_fazer', 'em_andamento', 'em_revisao', 'concluido'));

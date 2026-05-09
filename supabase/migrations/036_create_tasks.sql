-- Migration 036: tabela tasks (atividades por cliente / persona)
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  persona_id    UUID REFERENCES personas(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  assignee_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date      DATE,
  urgency       TEXT NOT NULL DEFAULT 'media' CHECK (urgency IN ('baixa', 'media', 'alta', 'critica')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_persona_id ON tasks(persona_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_admin ON tasks
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY tasks_member_select ON tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects_v2 p
      WHERE p.id = tasks.project_id
        AND p.squad IS NOT NULL
        AND is_squad_member(p.squad)
    )
  );

CREATE POLICY tasks_member_insert ON tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects_v2 p
      WHERE p.id = tasks.project_id
        AND p.squad IS NOT NULL
        AND is_squad_member(p.squad)
    )
  );

CREATE POLICY tasks_member_update ON tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects_v2 p
      WHERE p.id = tasks.project_id
        AND p.squad IS NOT NULL
        AND is_squad_member(p.squad)
    )
  );

CREATE POLICY tasks_member_delete ON tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects_v2 p
      WHERE p.id = tasks.project_id
        AND p.squad IS NOT NULL
        AND is_squad_member(p.squad)
    )
  );

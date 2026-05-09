-- Migration 040: anexos em tarefas
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';

-- Cria bucket task-attachments (privado) se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: espelham o acesso à tabela tasks (admin + squad members)
DROP POLICY IF EXISTS "task_attachments_admin_all" ON storage.objects;
CREATE POLICY "task_attachments_admin_all" ON storage.objects
  FOR ALL
  USING (bucket_id = 'task-attachments' AND auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS "task_attachments_member_all" ON storage.objects;
CREATE POLICY "task_attachments_member_all" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM tasks t
      JOIN projects_v2 p ON p.id = t.project_id
      WHERE t.id::text = split_part(storage.objects.name, '/', 1)
        AND p.squad IS NOT NULL
        AND is_squad_member(p.squad)
    )
  );

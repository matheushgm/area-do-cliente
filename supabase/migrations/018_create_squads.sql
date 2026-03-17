-- 1. Criar tabela squads
CREATE TABLE squads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  emoji      TEXT,
  members    JSONB NOT NULL DEFAULT '[]',
  -- formato: [{"profile_id": "uuid", "role": "Account Manager"}, ...]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: leitura para qualquer autenticado; escrita somente admin
ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squads_read"  ON squads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "squads_write" ON squads FOR ALL    USING ((auth.jwt()->'user_metadata'->>'role') = 'admin');

-- 2. Migrar coluna projects_v2.squad de text para UUID
-- Zera valores hardcoded inválidos (não são UUIDs)
UPDATE projects_v2 SET squad = NULL;
ALTER TABLE projects_v2 ALTER COLUMN squad TYPE UUID USING NULL;
ALTER TABLE projects_v2
  ADD CONSTRAINT fk_projects_squad
  FOREIGN KEY (squad) REFERENCES squads(id) ON DELETE SET NULL;

-- Migration 036: histórico de mudanças de contract_value em projects_v2
-- Cada UPDATE da coluna gera uma linha nova, classificada automaticamente
-- como 'upsell' (valor aumentou), 'downsell' (valor diminuiu) ou 'initial'
-- (primeira gravação a partir de NULL). Usado no /squads-report para
-- mostrar evolução mensal de upsell/downsell por squad.

CREATE TABLE IF NOT EXISTS contract_value_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  old_value   NUMERIC(12,2),
  new_value   NUMERIC(12,2),
  delta       NUMERIC(12,2) GENERATED ALWAYS AS (
                COALESCE(new_value, 0) - COALESCE(old_value, 0)
              ) STORED,
  change_type TEXT GENERATED ALWAYS AS (
                CASE
                  WHEN old_value IS NULL OR old_value = 0 THEN 'initial'
                  WHEN COALESCE(new_value, 0) > old_value  THEN 'upsell'
                  WHEN COALESCE(new_value, 0) < old_value  THEN 'downsell'
                  ELSE 'no_change'
                END
              ) STORED,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cvh_project_id  ON contract_value_history(project_id);
CREATE INDEX IF NOT EXISTS idx_cvh_changed_at  ON contract_value_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cvh_change_type ON contract_value_history(change_type);

CREATE OR REPLACE FUNCTION log_contract_value_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contract_value IS DISTINCT FROM OLD.contract_value THEN
    INSERT INTO contract_value_history (project_id, old_value, new_value)
    VALUES (NEW.id, OLD.contract_value, NEW.contract_value);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_contract_value_change ON projects_v2;
CREATE TRIGGER trg_log_contract_value_change
AFTER UPDATE OF contract_value ON projects_v2
FOR EACH ROW EXECUTE FUNCTION log_contract_value_change();

INSERT INTO contract_value_history (project_id, old_value, new_value, changed_at)
SELECT p.id, NULL, p.contract_value, p.created_at
FROM projects_v2 p
WHERE p.contract_value IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contract_value_history h
    WHERE h.project_id = p.id
  );

ALTER TABLE contract_value_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_cvh_authenticated" ON contract_value_history;
CREATE POLICY "read_cvh_authenticated"
  ON contract_value_history FOR SELECT
  TO authenticated
  USING (true);

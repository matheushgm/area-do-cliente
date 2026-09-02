-- Migration 080: NPS com marcos dinâmicos por cliente
--
-- Antes: projects_v2.nps (JSONB) com três chaves fixas — marco1/marco2/marco3 —
-- codificadas à mão em api/nps.js, NPSModule.jsx e NPSClientForm.jsx. Criar um
-- NPS novo ("9 meses", "Pós-renovação") exigia deploy.
--
-- Agora: marco é dado, não código. Cada projeto tem sua própria linha do tempo,
-- de tamanho indeterminado — o cliente pode ficar na base por anos.
--
-- Duas tabelas, e não uma, porque o marco precisa existir ANTES de qualquer
-- resposta: você cria "9 meses" e manda o link. Numa tabela só, o marco não
-- existiria até alguém responder, e não haveria o que listar nem para onde
-- apontar o link.
--
-- A coluna projects_v2.nps NÃO é removida aqui. Fica como rede de segurança
-- até o backfill ser validado em produção; o DROP vem em migration separada.

-- ─── Tabelas ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nps_marcos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  descricao   TEXT,
  ordem       INT  NOT NULL DEFAULT 0,
  due_at      DATE,
  origem      TEXT NOT NULL DEFAULT 'custom' CHECK (origem IN ('padrao', 'custom')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nps_respostas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marco_id      UUID NOT NULL REFERENCES nps_marcos(id) ON DELETE CASCADE,
  score         SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 10),
  nome          TEXT,
  email         TEXT,
  telefone      TEXT,
  q2 TEXT, q3 TEXT, q4 TEXT, q5 TEXT, q6 TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nps_marcos_project   ON nps_marcos(project_id, ordem);
CREATE INDEX IF NOT EXISTS idx_nps_respostas_marco  ON nps_respostas(marco_id, submitted_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Mesmo padrão das demais tabelas filhas (migration 020): admin vê tudo, membro
-- vê o que pertence ao squad dele. O formulário público não usa estas policies —
-- api/nps.js valida pelo client_share_token e escreve com a service role.

ALTER TABLE nps_marcos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nps_marcos_admin ON nps_marcos;
CREATE POLICY nps_marcos_admin ON nps_marcos FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS nps_marcos_squad_member ON nps_marcos;
CREATE POLICY nps_marcos_squad_member ON nps_marcos FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

DROP POLICY IF EXISTS nps_respostas_admin ON nps_respostas;
CREATE POLICY nps_respostas_admin ON nps_respostas FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS nps_respostas_squad_member ON nps_respostas;
CREATE POLICY nps_respostas_squad_member ON nps_respostas FOR ALL
  USING (marco_id IN (
    SELECT m.id FROM nps_marcos m
    JOIN projects_v2 p ON p.id = m.project_id
    WHERE p.squad IS NOT NULL AND is_squad_member(p.squad)
  ));

-- ─── Marcos padrão ───────────────────────────────────────────────────────────
-- Os três marcos que hoje são constantes no código. Continuam fixos do ponto de
-- vista do usuário (origem='padrao', o frontend não deixa excluir), mas agora
-- são linhas — o que permite conviver com marcos custom na mesma lista.
--
-- due_at sai de contract_date. Quando o projeto não tem contract_date, fica
-- NULL: sem data prevista, o marco só aparece para o cliente se você mandar o
-- link direto (/nps/<token>?marco=<id>).

CREATE OR REPLACE FUNCTION seed_nps_marcos_padrao(p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_date DATE;
BEGIN
  -- Idempotente: rodar a migration de novo (ou o trigger disparar duas vezes)
  -- não pode gerar marcos padrão duplicados.
  IF EXISTS (SELECT 1 FROM nps_marcos WHERE project_id = p_project_id AND origem = 'padrao') THEN
    RETURN;
  END IF;

  SELECT contract_date INTO v_contract_date FROM projects_v2 WHERE id = p_project_id;

  INSERT INTO nps_marcos (project_id, label, descricao, ordem, due_at, origem)
  VALUES
    (p_project_id, 'Pós-Onboarding',    'Após a primeira campanha ir ao ar', 1, v_contract_date,                      'padrao'),
    (p_project_id, 'Primeiros 3 Meses', '90 dias de parceria',               2, v_contract_date + INTERVAL '3 months', 'padrao'),
    (p_project_id, '6 Meses',           'Meio ano de parceria',              3, v_contract_date + INTERVAL '6 months', 'padrao');
END;
$$;

-- Todo projeto novo nasce com os três. Via trigger, e não no addProject do
-- frontend, para valer independentemente de por onde o projeto for criado.
CREATE OR REPLACE FUNCTION trg_seed_nps_marcos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM seed_nps_marcos_padrao(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_v2_seed_nps_marcos ON projects_v2;
CREATE TRIGGER projects_v2_seed_nps_marcos
  AFTER INSERT ON projects_v2
  FOR EACH ROW EXECUTE FUNCTION trg_seed_nps_marcos();

-- ─── Backfill ────────────────────────────────────────────────────────────────
-- Estado da produção em 2026-09-02: 68 projetos, 8 com nps não-nulo, 10
-- respostas ao todo (5 em marco1, 5 em marco3), nenhuma no formato legado de
-- objeto único. O CASE abaixo trata o legado mesmo assim — custo zero, e evita
-- perda silenciosa caso algum ambiente ainda o tenha.

-- 1. Marcos padrão para todos os projetos existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM projects_v2 LOOP
    PERFORM seed_nps_marcos_padrao(r.id);
  END LOOP;
END;
$$;

-- 2. Respostas do JSONB para nps_respostas
WITH legado AS (
  SELECT
    p.id AS project_id,
    e.key AS marco_key,
    CASE
      WHEN jsonb_typeof(e.value) = 'array'  THEN e.value
      WHEN jsonb_typeof(e.value) = 'object' THEN jsonb_build_array(e.value)
      ELSE '[]'::jsonb
    END AS respostas
  FROM projects_v2 p, jsonb_each(p.nps) e
  WHERE p.nps IS NOT NULL
),
expandido AS (
  SELECT l.project_id, l.marco_key, jsonb_array_elements(l.respostas) AS r
  FROM legado l
),
-- marco1/marco2/marco3 → ordem 1/2/3, que é como os marcos padrão foram criados
com_marco AS (
  SELECT
    e.r,
    m.id AS marco_id
  FROM expandido e
  JOIN nps_marcos m
    ON m.project_id = e.project_id
   AND m.origem = 'padrao'
   AND m.ordem = CASE e.marco_key
                   WHEN 'marco1' THEN 1
                   WHEN 'marco2' THEN 2
                   WHEN 'marco3' THEN 3
                 END
  WHERE e.r ? 'submittedAt'
    AND jsonb_typeof(e.r->'score') = 'number'
)
INSERT INTO nps_respostas (marco_id, score, nome, email, telefone, q2, q3, q4, q5, q6, submitted_at)
SELECT
  marco_id,
  (r->>'score')::smallint,
  NULLIF(r->>'name', ''),
  NULLIF(r->>'email', ''),
  NULLIF(r->>'phone', ''),
  NULLIF(r->>'q2', ''), NULLIF(r->>'q3', ''), NULLIF(r->>'q4', ''),
  NULLIF(r->>'q5', ''), NULLIF(r->>'q6', ''),
  (r->>'submittedAt')::timestamptz
FROM com_marco;

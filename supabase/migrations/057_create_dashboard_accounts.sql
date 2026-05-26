-- 054: Consolida client_squads + client_mapping em dashboard_accounts (cenário ideal).
--
-- O projeto (projects_v2) passa a ser a fonte de verdade do dashboard de tráfego:
-- cada conta (nome de conta Meta/Google) aponta para um projeto via project_id,
-- e squad / ClickUp / CPL passam a DERIVAR do projeto. squad_id e clickup_folder_id
-- ficam como OVERRIDE (nullable) — usados sobretudo para contas SEM projeto na AC.
--
-- O seed reproduz em SQL a mesma resolução do front (normStr + getClickupFolder,
-- incluindo a lista CU_FOLDERS hardcoded) para preservar exatamente a resolução
-- atual de pasta ClickUp antes de remover essa lista do código.
--
-- As tabelas antigas (client_squads, client_mapping) NÃO são dropadas aqui — isso
-- fica na migration 055, após verificação de paridade.

-- ─── 1. Tabela dashboard_accounts ─────────────────────────────────────────────
CREATE TABLE dashboard_accounts (
  account_name      text PRIMARY KEY,
  project_id        uuid REFERENCES projects_v2(id) ON DELETE SET NULL,
  squad_id          uuid REFERENCES squads(id)      ON DELETE SET NULL,  -- override
  clickup_folder_id text,                                                -- override
  updated_at        timestamptz DEFAULT now()
);
ALTER TABLE dashboard_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dashboard_accounts_read"  ON dashboard_accounts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "dashboard_accounts_write" ON dashboard_accounts FOR ALL    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE INDEX idx_dashboard_accounts_project ON dashboard_accounts(project_id);

-- ─── 2. View pública de projetos (para o dropdown de vínculo e derivação) ──────
-- security definer (security_invoker = false) para que qualquer usuário
-- autenticado enxergue todos os projetos, sem esbarrar na RLS por squad de
-- projects_v2 — espelha o padrão das views *_public já existentes.
CREATE VIEW dashboard_projects_public WITH (security_invoker = false) AS
SELECT p.id, p.company_name, s.name AS squad_name, p.clickup_folder_id
FROM projects_v2 p
LEFT JOIN squads s ON s.id = p.squad;
GRANT SELECT ON dashboard_projects_public TO anon, authenticated;

-- ─── 3. Seed a partir de client_squads + client_mapping + CU_FOLDERS ───────────
-- Normalização equivalente ao normStr() do front (lower + remove acentos +
-- só [a-z0-9 ] + colapsa espaços).
CREATE OR REPLACE FUNCTION dt_norm(s text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
           regexp_replace(
             translate(lower(coalesce(trim(s), '')),
               'áàâãäéèêëíìîïóòôõöúùûüç',
               'aaaaaeeeeiiiiooooouuuuc'),
             '[^a-z0-9 ]', '', 'g'),
           '\s+', ' ', 'g');
$$;

CREATE TEMP TABLE _dt_seed AS
WITH cu_folders(ord, id, name) AS (VALUES
  (1,'90133132396','Revenue Lab'),(2,'90091004681','Óticas Brasil'),(3,'90131020369','Go vendas'),
  (4,'90131734949','Grupo Aj'),(5,'90133288147','Tetralite'),(6,'90132148962','Rede Pop'),
  (7,'90091004658','Boa noite Colchões'),(8,'90134244751','Dr Ulyscélio'),(9,'90138731003','Festa de Luxo'),
  (10,'901314571929','PetKlinic'),(11,'90136881468','Imobitech'),(12,'90091004673','RGM'),
  (13,'90134144657','Nectar Crm'),(14,'90133157058','Cical Honda'),(15,'90091004669','FLASH CAR AUTO CENTER'),
  (16,'90134190733','Nacional Kart'),(17,'90137543120','NeuroExperts'),(18,'90133101447','AZFIT'),
  (19,'901313902635','Empório Kids'),(20,'901314276598','Dr Jorge Pinho'),(21,'901313651040','Nexus'),
  (22,'901314981180','CondoID'),(23,'901315145921','Bio Cosméticos'),(24,'901315294826','Inove Agropeças'),
  (25,'901315484069','Vital Centro de Saúde'),(26,'901315637343','Mercado Pet Store'),(27,'901315920301','Distribuidora Oeste'),
  (28,'901315924476','Mitra LAB'),(29,'901315924488','Hypado'),(30,'901315965985','RHEIMS'),
  (31,'901316124376','Africa PET STORE'),(32,'901316612751','Klooks'),(33,'901316612967','Escribo'),
  (34,'901317238620','Dr. Eduardo Moura'),(35,'901317350680','Aliare /myFarm'),(36,'901317397837','Funsales'),
  (37,'901317488127','2com'),(38,'901317558451','Niko Kids'),(39,'901317673213','Nomus ERP'),
  (40,'901317801444','Dra. Laura'),(41,'901317821050','Container Software'),(42,'901317959954','revo360'),
  (43,'901317965377','Colégio Cordeiro'),(44,'901318063989','Única Distribuidora'),(45,'901318084124','Riachuelo Seguros')
),
acct(account_name) AS (
  SELECT client_name FROM client_squads
  UNION
  SELECT dashboard_name FROM client_mapping
),
base AS (
  SELECT a.account_name, cs.squad AS label, cm.ac_company_name, cm.clickup_folder_id AS map_folder
  FROM acct a
  LEFT JOIN client_squads cs  ON cs.client_name   = a.account_name
  LEFT JOIN client_mapping cm ON cm.dashboard_name = a.account_name
),
proj AS (
  SELECT b.*, p.id AS project_id, p.squad AS project_squad
  FROM base b
  LEFT JOIN LATERAL (
    SELECT id, squad FROM projects_v2 p
    WHERE b.ac_company_name IS NOT NULL AND dt_norm(p.company_name) = dt_norm(b.ac_company_name)
    LIMIT 1
  ) p ON true
)
SELECT
  pr.account_name,
  pr.label,
  pr.project_id,
  pr.project_squad,
  COALESCE(
    pr.map_folder,
    (SELECT cf.id FROM cu_folders cf WHERE dt_norm(cf.name) = dt_norm(pr.account_name) ORDER BY cf.ord LIMIT 1),
    (SELECT cf.id FROM cu_folders cf
       WHERE position(dt_norm(pr.account_name) IN dt_norm(cf.name)) > 0
          OR position(dt_norm(cf.name) IN dt_norm(pr.account_name)) > 0
       ORDER BY cf.ord LIMIT 1)
  ) AS resolved_folder
FROM proj pr;

INSERT INTO dashboard_accounts (account_name, project_id, squad_id, clickup_folder_id)
SELECT
  s.account_name,
  s.project_id,
  CASE
    WHEN s.project_id IS NOT NULL AND s.project_squad IS NOT NULL THEN NULL          -- deriva do projeto
    WHEN s.label = 'Caça ROI'   THEN 'f8f34a9f-4ca5-46fc-b4a5-ad4278e1a775'::uuid    -- override (conta sem projeto)
    WHEN s.label = 'Zero Churn' THEN 'a5fedd04-2ea2-4ab0-a5f0-3e4ae0646434'::uuid
    ELSE NULL
  END,
  CASE WHEN s.project_id IS NOT NULL THEN NULL ELSE s.resolved_folder END             -- override só p/ conta sem projeto
FROM _dt_seed s;

-- Backfill: o ClickUp resolvido vai para o PROJETO (fonte de verdade) quando vazio.
UPDATE projects_v2 p
SET clickup_folder_id = s.resolved_folder
FROM _dt_seed s
WHERE s.project_id = p.id AND p.clickup_folder_id IS NULL AND s.resolved_folder IS NOT NULL;

DROP FUNCTION dt_norm(text);

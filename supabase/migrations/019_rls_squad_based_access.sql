-- 019: Atualiza RLS — acesso por participação no squad em vez de account_id
--
-- Novo modelo para role 'account':
--   - Visualiza e edita apenas projetos onde o squad atribuído ao projeto
--     contém o usuário como membro (members @> [{profile_id: uid}])
--   - Ainda pode CRIAR projetos (account_id = auth.uid())
--   - account_id permanece como registro do autor, não como controle de acesso
--
-- Admin: sem alteração (acessa tudo via JWT role = 'admin')
-- Projetos sem squad atribuído (squad IS NULL): invisíveis para accounts

-- ── Helper: subquery de squad membership ─────────────────────────────────────
-- Reutilizada inline em cada policy (sem SECURITY DEFINER para manter auditabilidade):
--   squad IN (SELECT id FROM squads WHERE members @> jsonb_build_array(
--               jsonb_build_object('profile_id', auth.uid()::text)))

-- ── projects_v2 ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS projects_v2_account ON projects_v2;

-- Leitura: pertence ao squad do projeto
CREATE POLICY projects_v2_account_select ON projects_v2
  FOR SELECT
  USING (
    squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  );

-- Criação: account registra quem criou
CREATE POLICY projects_v2_account_insert ON projects_v2
  FOR INSERT
  WITH CHECK (account_id = auth.uid());

-- Edição/exclusão: pertence ao squad do projeto
CREATE POLICY projects_v2_account_update ON projects_v2
  FOR UPDATE
  USING (
    squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  );

CREATE POLICY projects_v2_account_delete ON projects_v2
  FOR DELETE
  USING (
    squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  );

-- ── Tabelas filhas ────────────────────────────────────────────────────────────
-- Padrão: project_id IN (projetos acessíveis via squad do usuário)

DROP POLICY IF EXISTS roi_calculators_account ON roi_calculators;
CREATE POLICY roi_calculators_account ON roi_calculators FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

DROP POLICY IF EXISTS personas_account ON personas;
CREATE POLICY personas_account ON personas FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

DROP POLICY IF EXISTS ofertas_account ON ofertas;
CREATE POLICY ofertas_account ON ofertas FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

DROP POLICY IF EXISTS campaign_plans_account ON campaign_plans;
CREATE POLICY campaign_plans_account ON campaign_plans FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

DROP POLICY IF EXISTS resultados_account ON resultados;
CREATE POLICY resultados_account ON resultados FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

DROP POLICY IF EXISTS criativos_account ON criativos;
CREATE POLICY criativos_account ON criativos FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

DROP POLICY IF EXISTS google_ads_account ON google_ads;
CREATE POLICY google_ads_account ON google_ads FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

DROP POLICY IF EXISTS landing_pages_account ON landing_pages;
CREATE POLICY landing_pages_account ON landing_pages FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

DROP POLICY IF EXISTS banco_midia_account ON banco_midia;
CREATE POLICY banco_midia_account ON banco_midia FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

DROP POLICY IF EXISTS estrategia_account ON estrategia;
CREATE POLICY estrategia_account ON estrategia FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

DROP POLICY IF EXISTS estrategia_v2_account ON estrategia_v2;
CREATE POLICY estrategia_v2_account ON estrategia_v2 FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

DROP POLICY IF EXISTS attachments_account ON attachments;
CREATE POLICY attachments_account ON attachments FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

-- Tabela produtos (sem migration local, aplicar somente se existir no banco)
DROP POLICY IF EXISTS produtos_account ON produtos;
CREATE POLICY produtos_account ON produtos FOR ALL
  USING (project_id IN (
    SELECT p.id FROM projects_v2 p
    WHERE p.squad IN (
      SELECT id FROM squads
      WHERE members @> jsonb_build_array(jsonb_build_object('profile_id', auth.uid()::text))
    )
  ));

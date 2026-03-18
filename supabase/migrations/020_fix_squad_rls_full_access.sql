-- 020: Completa RLS por squad — upgrade de SELECT para ALL + tabelas faltantes
-- Usa is_squad_member() já existente no banco
-- Remove policies _account (account_id não controla mais acesso)
-- Mantém INSERT em projects_v2 via account_id (registra criador)

-- ── projects_v2 ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS projects_v2_account ON projects_v2;
DROP POLICY IF EXISTS projects_v2_squad_member ON projects_v2;

CREATE POLICY projects_v2_squad_member ON projects_v2
  FOR ALL
  USING ((squad IS NOT NULL) AND is_squad_member(squad));

CREATE POLICY projects_v2_account_insert ON projects_v2
  FOR INSERT
  WITH CHECK (account_id = auth.uid());

-- ── roi_calculators ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS roi_calculators_account ON roi_calculators;
DROP POLICY IF EXISTS roi_calculators_squad_member ON roi_calculators;
CREATE POLICY roi_calculators_squad_member ON roi_calculators FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

-- ── personas ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS personas_account ON personas;
DROP POLICY IF EXISTS personas_squad_member ON personas;
CREATE POLICY personas_squad_member ON personas FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

-- ── ofertas (sem policy de squad até agora) ───────────────────────────────────
DROP POLICY IF EXISTS ofertas_account ON ofertas;
DROP POLICY IF EXISTS ofertas_squad_member ON ofertas;
CREATE POLICY ofertas_squad_member ON ofertas FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

-- ── campaign_plans (sem policy de squad até agora) ────────────────────────────
DROP POLICY IF EXISTS campaign_plans_account ON campaign_plans;
DROP POLICY IF EXISTS campaign_plans_squad_member ON campaign_plans;
CREATE POLICY campaign_plans_squad_member ON campaign_plans FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

-- ── criativos ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS criativos_account ON criativos;
DROP POLICY IF EXISTS criativos_squad_member ON criativos;
CREATE POLICY criativos_squad_member ON criativos FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

-- ── google_ads ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS google_ads_account ON google_ads;
DROP POLICY IF EXISTS google_ads_squad_member ON google_ads;
CREATE POLICY google_ads_squad_member ON google_ads FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

-- ── landing_pages ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS landing_pages_account ON landing_pages;
DROP POLICY IF EXISTS landing_pages_squad_member ON landing_pages;
CREATE POLICY landing_pages_squad_member ON landing_pages FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

-- ── banco_midia ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS banco_midia_account ON banco_midia;
DROP POLICY IF EXISTS banco_midia_squad_member ON banco_midia;
CREATE POLICY banco_midia_squad_member ON banco_midia FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

-- ── estrategia ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS estrategia_account ON estrategia;
DROP POLICY IF EXISTS estrategia_squad_member ON estrategia;
CREATE POLICY estrategia_squad_member ON estrategia FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

-- ── estrategia_v2 ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS estrategia_v2_account ON estrategia_v2;
DROP POLICY IF EXISTS estrategia_v2_squad_member ON estrategia_v2;
CREATE POLICY estrategia_v2_squad_member ON estrategia_v2 FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

-- ── attachments ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS attachments_account ON attachments;
DROP POLICY IF EXISTS attachments_squad_member ON attachments;
CREATE POLICY attachments_squad_member ON attachments FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

-- ── resultados ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS resultados_account ON resultados;
DROP POLICY IF EXISTS resultados_squad_member ON resultados;
CREATE POLICY resultados_squad_member ON resultados FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

-- ── produtos ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS produtos_account_own ON produtos;
DROP POLICY IF EXISTS produtos_squad_member ON produtos;
CREATE POLICY produtos_squad_member ON produtos FOR ALL
  USING (project_id IN (
    SELECT id FROM projects_v2 WHERE squad IS NOT NULL AND is_squad_member(squad)
  ));

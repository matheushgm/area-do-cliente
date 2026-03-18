-- 021: Corrige policies _admin — usa app_metadata em vez de user_metadata
--
-- Problema: user_metadata é editável pelo próprio usuário via supabase.auth.updateUser().
-- Um account mal-intencionado poderia se autopromover a admin escrevendo role='admin'
-- no próprio user_metadata.
--
-- Solução: app_metadata só pode ser escrito pela service role (lado servidor).
-- Usuários comuns não conseguem modificá-lo.
--
-- Inclui migração dos usuários existentes: copia role de user_metadata → app_metadata
-- para garantir que admins não percam acesso após a migration.

-- ── 1. Migrar role dos usuários existentes ────────────────────────────────────
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('role', raw_user_meta_data->>'role')
WHERE raw_user_meta_data->>'role' IS NOT NULL;

-- ── 2. projects_v2 ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS projects_v2_admin ON projects_v2;
CREATE POLICY projects_v2_admin ON projects_v2
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

-- ── 3. Tabelas filhas ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS roi_calculators_admin ON roi_calculators;
CREATE POLICY roi_calculators_admin ON roi_calculators
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS personas_admin ON personas;
CREATE POLICY personas_admin ON personas
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS ofertas_admin ON ofertas;
CREATE POLICY ofertas_admin ON ofertas
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS campaign_plans_admin ON campaign_plans;
CREATE POLICY campaign_plans_admin ON campaign_plans
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS resultados_admin ON resultados;
CREATE POLICY resultados_admin ON resultados
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS criativos_admin ON criativos;
CREATE POLICY criativos_admin ON criativos
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS google_ads_admin ON google_ads;
CREATE POLICY google_ads_admin ON google_ads
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS landing_pages_admin ON landing_pages;
CREATE POLICY landing_pages_admin ON landing_pages
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS banco_midia_admin ON banco_midia;
CREATE POLICY banco_midia_admin ON banco_midia
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS estrategia_admin ON estrategia;
CREATE POLICY estrategia_admin ON estrategia
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS estrategia_v2_admin ON estrategia_v2;
CREATE POLICY estrategia_v2_admin ON estrategia_v2
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

DROP POLICY IF EXISTS attachments_admin ON attachments;
CREATE POLICY attachments_admin ON attachments
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

-- ── 4. squads ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS squads_write ON squads;
CREATE POLICY squads_write ON squads
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

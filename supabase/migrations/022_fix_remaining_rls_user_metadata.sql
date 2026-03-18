-- 022: Remove policies _designer indevidas + corrige _admin de profiles e produtos
--
-- As policies _designer foram criadas externamente via MCP sem alinhamento
-- com a arquitetura de roles do sistema (apenas 'admin' e 'account').
-- São removidas sem substituição.
--
-- As policies _admin de profiles e produtos usavam user_metadata (inseguro)
-- e são recriadas usando app_metadata.

-- ── Remove políticas _designer (indevidas) ────────────────────────────────────
DROP POLICY IF EXISTS projects_v2_designer  ON projects_v2;
DROP POLICY IF EXISTS personas_designer     ON personas;
DROP POLICY IF EXISTS criativos_designer    ON criativos;
DROP POLICY IF EXISTS google_ads_designer   ON google_ads;
DROP POLICY IF EXISTS landing_pages_designer ON landing_pages;
DROP POLICY IF EXISTS resultados_designer   ON resultados;
DROP POLICY IF EXISTS banco_midia_designer  ON banco_midia;
DROP POLICY IF EXISTS estrategia_designer   ON estrategia;
DROP POLICY IF EXISTS estrategia_v2_designer ON estrategia_v2;
DROP POLICY IF EXISTS attachments_designer  ON attachments;
DROP POLICY IF EXISTS produtos_designer     ON produtos;

-- ── profiles: corrige _admin_write e _admin_insert ────────────────────────────
DROP POLICY IF EXISTS profiles_admin_write  ON profiles;
DROP POLICY IF EXISTS profiles_admin_insert ON profiles;

CREATE POLICY profiles_admin_write ON profiles
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

CREATE POLICY profiles_admin_insert ON profiles
  FOR INSERT
  WITH CHECK (auth.jwt()->'app_metadata'->>'role' = 'admin');

-- ── produtos: corrige _admin_all ──────────────────────────────────────────────
DROP POLICY IF EXISTS produtos_admin_all ON produtos;

CREATE POLICY produtos_admin_all ON produtos
  FOR ALL
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');

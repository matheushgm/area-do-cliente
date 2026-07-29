-- 073: Expõe o ÚLTIMO plano de campanha de cada projeto para o dashboard de
-- tráfego (viewer dash-teste) calcular o pace de verba por canal/campanha.
--
-- security definer (security_invoker = false) — mesmo padrão das demais views
-- *_public (cpl_targets_public, dashboard_projects_public): o time todo enxerga
-- o plano de qualquer projeto sem esbarrar na RLS por squad de campaign_plans.
--
-- GRANT apenas para authenticated (NÃO anon): verba planejada é informação
-- interna de gestão — o link público do dashboard (?shared=1) não deve ler.
CREATE OR REPLACE VIEW campaign_plans_public WITH (security_invoker = false) AS
SELECT DISTINCT ON (cp.project_id)
  cp.project_id,
  cp.answers,
  cp.created_at
FROM campaign_plans cp
ORDER BY cp.project_id, cp.created_at DESC;

REVOKE ALL ON campaign_plans_public FROM anon, public;
GRANT SELECT ON campaign_plans_public TO authenticated;

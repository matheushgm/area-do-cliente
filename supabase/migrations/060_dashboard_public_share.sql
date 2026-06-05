-- Link compartilhável do Dashboard de Tráfego (modo /dashboard?shared=1).
--
-- O dashboard de um cliente precisa abrir SEM login para que o cliente final
-- consiga visualizar seus próprios resultados. As planilhas (Meta/Google CSV)
-- já são públicas e dashboard_projects_public / cpl_targets_public já são
-- legíveis por anon. Faltava apenas o acesso anônimo a:
--   - dashboard_accounts (RLS exige authenticated)  → resolve squad/CPL/projeto da conta
--   - squads             (RLS exige authenticated)  → resolve o NOME do squad
--
-- Em vez de afrouxar a RLS dessas tabelas (squads tem colunas sensíveis —
-- members, monthly_cost, department_assignments), seguimos o padrão *_public
-- já adotado no projeto: views security definer expondo SOMENTE as colunas
-- necessárias, com GRANT SELECT para anon. As escritas continuam indo para as
-- tabelas-base (apenas authenticated), pois o modo compartilhado é read-only.

-- ─── Contas do dashboard (somente o necessário para derivar squad/CPL/projeto) ─
CREATE OR REPLACE VIEW dashboard_accounts_public WITH (security_invoker = false) AS
SELECT account_name, project_id, squad_id, clickup_folder_id
FROM dashboard_accounts;
GRANT SELECT ON dashboard_accounts_public TO anon, authenticated;

-- ─── Squads: expõe APENAS id + name (sem members/custos/atribuições) ──────────
CREATE OR REPLACE VIEW dashboard_squads_public WITH (security_invoker = false) AS
SELECT id, name
FROM squads;
GRANT SELECT ON dashboard_squads_public TO anon, authenticated;

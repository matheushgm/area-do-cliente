-- 055: Remove as tabelas legadas do dashboard, consolidadas em dashboard_accounts
-- pela migration 054. A paridade de resolução (squad 47/47, ClickUp preservado)
-- foi verificada antes do drop.
DROP TABLE IF EXISTS client_squads;
DROP TABLE IF EXISTS client_mapping;

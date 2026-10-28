-- Migration 118: índice (channel, account, day) em dash_insights
--
-- As leituras por conta com janela (/api/dash-data?account=X&de=...: hub da página do
-- cliente, Funil, Planejamento, página da conta no viewer) usavam o índice
-- (channel, account) e filtravam o dia linha a linha: para 416 linhas da janela de
-- 16 dias da AzFit, o banco abria as 2.185 da conta (~0,9 s, medido em 2026-10-28).
-- Com o dia no índice, só as linhas da janela são lidas.

create index if not exists dash_insights_channel_account_day_idx
  on public.dash_insights (channel, account, day);

-- Migration 104: libera o canal `google_keywords` em dash_insights
--
-- Snapshot das palavras-chave do Google Ads (positivas e negativas) com o tipo de
-- correspondência (exata/frase/ampla) e a situação atual (ativa/pausada/negativada),
-- coletado pelo repo dashboard-api (google_keywords_sync.py). Uma linha por palavra,
-- sem dia, como `meta_status` e `saldo`. Alimenta a sub-aba "Palavra-chave" do
-- dashboard, logo depois de "Grupos".
--
-- Sem este ALTER o CHECK de `channel` rejeita cada linha com 23514 e o sync grava
-- ZERO (mesma armadilha das migrations 082 e 089).
alter table public.dash_insights drop constraint if exists dash_insights_channel_check;

alter table public.dash_insights add constraint dash_insights_channel_check
  check (channel = any (array[
    'meta'::text, 'google'::text, 'google_terms'::text, 'meta_status'::text,
    'google_ads'::text, 'google_pages'::text, 'saldo'::text, 'google_keywords'::text
  ]));

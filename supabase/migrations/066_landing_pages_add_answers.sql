-- Metadados das copies de landing page (nome, direção criativa, produto/persona,
-- oferta e principalmente o wireframe estruturado: wireframeType + wireframeContent)
-- passam a ser persistidos num JSONB `answers`, seguindo o padrão das demais
-- tabelas filhas (google_ads, criativos, etc.). Sem isso, o refresh perdia o
-- wireframe e a copy caía no render legado de dobras.
alter table public.landing_pages
  add column if not exists answers jsonb;

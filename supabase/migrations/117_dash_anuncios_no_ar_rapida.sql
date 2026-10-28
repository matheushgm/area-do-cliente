-- Migration 117: dash_anuncios_no_ar() sem o laço aninhado
--
-- A 116 cruzava anúncio → conjunto → campanha com LEFT JOIN sobre a CTE `ent`. Sem
-- estatística de CTE o Postgres escolhia laço aninhado: ~8,7 milhões de comparações e
-- 7 a 9 s por chamada (medido em 2026-10-28), mais lento que o snapshot que ela veio
-- substituir. Agora conjuntos e campanhas viram UM mapa jsonb (nivel|conta|id →
-- { a: ativo, p: pai }), montado uma vez (MATERIALIZED), e cada anúncio consulta o
-- mapa: 94 ms. Regra e saída idênticas às da 116 (ver o cabeçalho de lá).

create or replace function public.dash_anuncios_no_ar()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with st as (
    select btrim(data->>'Nome da conta') as conta,
           data->>'Nível' as nivel,
           data->>'ID' as id,
           nullif(data->>'ID pai', '') as pai,
           coalesce(nullif(data->>'Veiculação', ''), nullif(data->>'Status', ''), '') as status,
           coalesce(data->>'Atualizado em', '') as ts
      from dash_insights
     where channel = 'meta_status'
       and coalesce(btrim(data->>'Nome da conta'), '') <> ''
       and coalesce(data->>'ID', '') <> ''
       and data->>'Nível' in ('campanha', 'conjunto', 'anuncio')
  ),
  ent as materialized (
    select distinct on (conta, nivel, id) conta, nivel, id, pai, ts,
           (position('ativ' in lower(status)) > 0 or lower(status) in ('active', 'enabled')) as ativo
      from st
     order by conta, nivel, id
  ),
  -- Conjuntos e campanhas por nivel|conta|id. MATERIALIZED: sem ele o Postgres
  -- remonta o mapa a cada anúncio (30 s).
  pais as materialized (
    select jsonb_object_agg(nivel || '|' || conta || '|' || id, jsonb_build_object('a', ativo, 'p', pai)) as m
      from ent where nivel <> 'anuncio'
  ),
  ads as (
    select a.conta, a.ts,
           a.ativo
           and coalesce((m -> ('conjunto|' || a.conta || '|' || a.pai) ->> 'a')::boolean, true)
           and coalesce((m -> ('campanha|' || a.conta || '|' || (m -> ('conjunto|' || a.conta || '|' || a.pai) ->> 'p')) ->> 'a')::boolean, true)
             as no_ar
      from ent a cross join pais
     where a.nivel = 'anuncio'
  ),
  meta as (
    select conta, jsonb_build_object('n', count(*) filter (where no_ar), 'ts', max(ts)) as v
      from ads group by conta
  ),
  g as (
    select btrim(data->>'Nome da conta') as conta, day,
           coalesce(nullif(data->>'ID do anúncio', ''), nullif(data->>'Anúncio', ''), '') as id,
           (position('ativ' in lower(coalesce(data->>'Status do anúncio', ''))) > 0
             or lower(coalesce(data->>'Status do anúncio', '')) in ('active', 'enabled')) as ativo
      from dash_insights
     where channel = 'google_ads' and day >= current_date - 7
       and coalesce(btrim(data->>'Nome da conta'), '') <> ''
  ),
  gdia as (select conta, max(day) as dia from g group by conta),
  google as (
    select d.conta, jsonb_build_object('n', count(distinct g.id) filter (where g.ativo), 'dia', d.dia) as v
      from gdia d join g on g.conta = d.conta and g.day = d.dia
     group by d.conta, d.dia
  )
  select jsonb_build_object(
    'meta',   coalesce((select jsonb_object_agg(conta, v) from meta), '{}'::jsonb),
    'google', coalesce((select jsonb_object_agg(conta, v) from google), '{}'::jsonb)
  )
$$;

revoke all on function public.dash_anuncios_no_ar() from public, anon;
grant execute on function public.dash_anuncios_no_ar() to authenticated;

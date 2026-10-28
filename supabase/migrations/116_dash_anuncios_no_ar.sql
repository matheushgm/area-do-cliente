-- Migration 116: contagem de anúncios no ar por conta + índice da versão do rollup
--
-- A lista do Dashboard de Tráfego (viewer) baixava o snapshot inteiro de status
-- (dash_insights canal meta_status: ~6,4 mil campanhas/conjuntos/anúncios, 1,2 MB) e
-- os anúncios do Google de 7 dias só para mostrar UM número por conta, a coluna
-- "Anúncios no ar". Medido em 2026-10-28 em produção: 17 s na abertura do /dashboard.
-- Esta função devolve esse número pronto; o snapshot completo passa a ser lido só ao
-- abrir uma conta, filtrado por ela.
--
-- ESPELHA o viewer (public/dash-teste/viewer.html) — mudou um, mude o outro:
--   meta   → activeAdsOfAccount + adNoAr + buildStatusSnap: anúncio ativo cujo
--            conjunto (se existe no snapshot) e campanha do conjunto (idem) também
--            estão ativos; status = Veiculação, senão Status; ts = maior
--            "Atualizado em" entre os anúncios da conta; conta sem anúncio fica de fora.
--   google → buildGoogleAdsSnap: no dia mais recente de cada conta (últimos 7 dias),
--            IDs distintos de anúncio com status ativo.
--   ativo  → isActiveStatus: contém "ativ", ou é "active"/"enabled" (sem caixa).
--
-- security invoker: vale a RLS de dash_insights (só authenticated lê).

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
  -- Uma entrada por conta/nível/ID, como o objeto do viewer (a última vence; IDs
  -- repetidos no snapshot não acontecem na prática).
  ent as (
    select distinct on (conta, nivel, id) conta, nivel, id, pai, ts,
           (position('ativ' in lower(status)) > 0 or lower(status) in ('active', 'enabled')) as ativo
      from st
     order by conta, nivel, id
  ),
  ads as (
    select a.conta, a.ts,
           a.ativo
           and coalesce(cj.ativo, true)
           and coalesce(cp.ativo, true) as no_ar
      from ent a
      left join ent cj on cj.conta = a.conta and cj.nivel = 'conjunto' and cj.id = a.pai
      left join ent cp on cp.conta = a.conta and cp.nivel = 'campanha' and cp.id = cj.pai
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

-- Versão do cache do navegador (src/lib/dashCache.js): o maior updated_at do rollup
-- por canal. Sem índice era um seq scan de ~190 ms que, no pico da abertura do
-- dashboard, chegava a 5 s.
create index if not exists dash_daily_channel_updated_idx
  on public.dash_daily (channel, updated_at desc);

-- Migration 106: benchmark interno do Dashboard de Tráfego.
-- Soma, por conta e por canal, os últimos p_days dias FECHADOS (até ontem) de
-- dash_insights, sem as campanhas de TOPO (CPL e conversão só se julgam em fundo e
-- meio, igual a classifyFunnel() em src/lib/dashboardData.js). Alimenta a aba
-- "Benchmark" do viewer via /api/dash-benchmark.
--
-- Formato: { "meta": [ {account, spend, impr, clicks, conv, leads, msgs, mql, lpv} ],
--            "google": [ {account, spend, impr, clicks, conv} ] }
-- Parser BR dos números = dash_num() (migration 075).
create or replace function public.dash_benchmark(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select di.channel, di.account, di.data,
           translate(upper(coalesce(di.data->>'Nome da campanha', di.data->>'Campanha', '')),
                     'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') as camp
    from public.dash_insights di
    where di.channel in ('meta', 'google')
      and di.day between current_date - greatest(least(coalesce(p_days, 30), 365), 1) and current_date - 1
  ), fil as (
    select * from base
    where not (
      camp !~ '(^|[^A-Z])(MEIO|MOF)([^A-Z]|$)'
      and camp !~ '(^|[^A-Z])(FUNDO|BOFU|BOF)([^A-Z]|$)'
      and camp ~ '(^|[^A-Z])(TOPO|TOFU|TOF|RECONHECIMENTO|BRANDING)([^A-Z]|$)'
    )
  ), meta as (
    select account,
      sum(public.dash_num(data->>'Valor investido')) spend,
      sum(public.dash_num(data->>'Impressões')) impr,
      sum(public.dash_num(data->>'Número de cliques no link')) clicks,
      sum(public.dash_num(data->>'Conversões')) conv,
      sum(public.dash_num(data->>'Leads')) leads,
      sum(public.dash_num(data->>'Número de conversas iniciadas no Whatsapp')) msgs,
      sum(public.dash_num(data->>'MQL')) mql,
      sum(public.dash_num(data->>'Visualizações da página de destino')) lpv
    from fil where channel = 'meta' group by account
  ), goo as (
    select account,
      sum(public.dash_num(data->>'Gasto')) spend,
      sum(public.dash_num(data->>'Impressões')) impr,
      sum(public.dash_num(coalesce(data->>'CLiques', data->>'Cliques'))) clicks,
      sum(public.dash_num(data->>'Conversões')) conv
    from fil where channel = 'google' group by account
  )
  select jsonb_build_object(
    'meta', coalesce((select jsonb_agg(to_jsonb(m) order by m.spend desc) from meta m where m.spend > 0), '[]'::jsonb),
    'google', coalesce((select jsonb_agg(to_jsonb(g) order by g.spend desc) from goo g where g.spend > 0), '[]'::jsonb)
  );
$$;

revoke all on function public.dash_benchmark(int) from public;
grant execute on function public.dash_benchmark(int) to authenticated, service_role;

-- 075 — Agregação de gasto e conversões por conta/dia a partir de dash_insights.
--
-- Usada pelo preenchimento automático dos Resultados (api/resultados-autofill.js).
-- Sem isso a Edge Function teria que baixar dezenas de milhares de linhas JSONB
-- para somar no JS; aqui o Postgres devolve ~1 linha por conta/dia.

-- Converte os números em formato BR que vêm das planilhas/APIs ("R$ 1.234,56",
-- "12,5%", "") para numeric. Espelha exatamente o helper `num()` de
-- src/lib/dashboardData.js — se um mudar, o outro tem que mudar junto.
create or replace function public.dash_num(s text)
returns numeric
language sql
immutable
parallel safe
as $$
  select case when v ~ '^-?[0-9]+(\.[0-9]+)?$' then v::numeric else 0 end
  from (
    select case
      -- 1.234,56 → 1234.56 (ponto é separador de milhar)
      when raw like '%,%' and raw like '%.%' then replace(replace(raw, '.', ''), ',', '.')
      -- 1234,56 → 1234.56
      when raw like '%,%' then replace(raw, ',', '.')
      else raw
    end as v
    from (
      select btrim(
        translate(
          replace(replace(coalesce(s, ''), 'R$', ''), '%', ''),
          ' ' || chr(160), ''   -- espaço comum e espaço não-separável
        )
      ) as raw
    ) a
  ) b;
$$;

-- Gasto e conversões por PROJETO/dia no intervalo pedido, já somando todas as
-- contas de anúncio vinculadas ao projeto (Meta + Google).
-- Conversões seguem a MESMA definição do dashboard (CFG em dashboardData.js):
--   meta   = conversas no WhatsApp + leads + vendas
--   google = conversões
--
-- Devolve JSONB (e não uma tabela) de propósito: o PostgREST corta respostas
-- tabulares em 1000 linhas e um mês inteiro passa disso — paginar obrigaria a
-- refazer a agregação a cada página. Formato:
--   { "<project_id>": { "YYYY-MM-DD": [gasto, conversões] } }
create or replace function public.dash_totals_by_project(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      a.project_id,
      di.day,
      sum(
        case when di.channel = 'meta'
          then public.dash_num(di.data->>'Valor investido')
          else public.dash_num(di.data->>'Gasto')
        end
      ) as spend,
      sum(
        case when di.channel = 'meta'
          then public.dash_num(di.data->>'Número de conversas iniciadas no Whatsapp')
             + public.dash_num(di.data->>'Leads')
             + public.dash_num(di.data->>'Número de vendas')
          else public.dash_num(di.data->>'Conversões')
        end
      ) as conv
    from public.dash_insights di
    join public.dashboard_accounts a on a.account_name = di.account
    where di.channel in ('meta', 'google')
      and di.day between p_from and p_to
      and a.project_id is not null
    group by 1, 2
  ), por_projeto as (
    select project_id,
           jsonb_object_agg(day::text, jsonb_build_array(round(spend, 2), round(conv, 2))) as dias
    from base
    group by project_id
  )
  select coalesce(jsonb_object_agg(project_id::text, dias), '{}'::jsonb) from por_projeto;
$$;

revoke all on function public.dash_totals_by_project(date, date) from public;
grant execute on function public.dash_totals_by_project(date, date) to authenticated, service_role;

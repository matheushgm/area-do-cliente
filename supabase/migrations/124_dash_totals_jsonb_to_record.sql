-- 124 — dash_totals_by_project lê o JSONB uma vez por linha.
--
-- Cada `data->>'campo'` descomprime (detoast) o JSONB inteiro da linha de novo, e
-- a linha Meta tem ~1,6 kB comprimidos: com 4 campos por linha, outubro inteiro
-- (22 mil linhas, 34 MB) levava ~12 s, acima dos 8 s de statement_timeout do
-- PostgREST. O "Puxar da API" dos Resultados e o cron davam HTTP 500 desde 22/10.
-- `jsonb_to_record` extrai os seis campos de uma vez: o mesmo mês cai para ~6 s.
-- A Edge Function também passou a pedir uma semana por chamada.
--
-- Mesma saída e mesma definição de conversão da 075.
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
          then public.dash_num(r."Valor investido")
          else public.dash_num(r."Gasto")
        end
      ) as spend,
      sum(
        case when di.channel = 'meta'
          then public.dash_num(r."Número de conversas iniciadas no Whatsapp")
             + public.dash_num(r."Leads")
             + public.dash_num(r."Número de vendas")
          else public.dash_num(r."Conversões")
        end
      ) as conv
    from public.dash_insights di
    join public.dashboard_accounts a on a.account_name = di.account
    cross join lateral jsonb_to_record(di.data) as r(
      "Valor investido" text,
      "Gasto" text,
      "Número de conversas iniciadas no Whatsapp" text,
      "Leads" text,
      "Número de vendas" text,
      "Conversões" text
    )
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
